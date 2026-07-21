import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';
import archiver from 'archiver';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import { getDb, initDb } from './db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'direction-classes-secret-key-13579';

// Ensure upload folder exists
const isVercel = !!process.env.VERCEL;
const uploadDir = isVercel ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB on server start and capture the promise
const dbInitPromise = initDb().catch(err => {
  console.error("DB Initialization failed:", err);
});

// Middleware to block request processing until DB schema migrations and seeds finish
app.use(async (req, res, next) => {
  await dbInitPromise;
  next();
});

// Endpoint: Get distinct subjects
app.get('/api/subjects', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT DISTINCT subject FROM questions ORDER BY subject ASC');
    const subjects = rows.map(r => r.subject);
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Get metadata for a subject (topics, years range)
app.get('/api/metadata', async (req, res) => {
  const { subject } = req.query;
  if (!subject) {
    return res.status(400).json({ error: 'Subject parameter is required' });
  }

  try {
    const db = await getDb();
    
    // Get distinct topics
    const topicRows = await db.all(
      'SELECT DISTINCT topic FROM questions WHERE subject = ? ORDER BY topic ASC',
      [subject]
    );
    const topics = topicRows.map(r => r.topic);

    // Get distinct subtopics grouped by topic
    const subtopicRows = await db.all(
      'SELECT DISTINCT topic, subtopic FROM questions WHERE subject = ? ORDER BY subtopic ASC',
      [subject]
    );
    const subtopicsGrouped = {};
    subtopicRows.forEach(r => {
      if (!subtopicsGrouped[r.topic]) {
        subtopicsGrouped[r.topic] = [];
      }
      if (r.subtopic) {
        subtopicsGrouped[r.topic].push(r.subtopic);
      }
    });

    // Get year range
    const yearRow = await db.get(
      'SELECT MIN(year) as minYear, MAX(year) as maxYear FROM questions WHERE subject = ?',
      [subject]
    );

    // Get lightweight question metadata (id, topic, subtopic, year, marks) for live calculations
    const questionMetaRows = await db.all(
      'SELECT id, topic, subtopic, year, marks FROM questions WHERE subject = ? ORDER BY id ASC',
      [subject]
    );

    res.json({
      topics,
      subtopicsGrouped,
      minYear: yearRow.minYear || 2020,
      maxYear: yearRow.maxYear || 2026,
      questions: questionMetaRows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Get all questions (full details) for a subject
app.get('/api/questions', async (req, res) => {
  const { subject } = req.query;
  if (!subject) {
    return res.status(400).json({ error: 'Subject parameter is required' });
  }

  try {
    const db = await getDb();
    const questions = await db.all(
      'SELECT * FROM questions WHERE subject = ? ORDER BY id ASC',
      [subject]
    );
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Check question availability for dynamic UI validation
app.post('/api/check-availability', async (req, res) => {
  const { subject, topics, yearMin, yearMax } = req.body;
  
  if (!subject || !topics || !Array.isArray(topics)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    const db = await getDb();
    const availability = {};

    for (const topic of topics) {
      const row = await db.get(
        `SELECT COUNT(*) as count FROM questions 
         WHERE subject = ? AND topic = ? AND year >= ? AND year <= ?`,
        [subject, topic, yearMin, yearMax]
      );
      availability[topic] = row.count;
    }

    res.json(availability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Import questions from CSV spreadsheet
app.post('/api/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      const cleanData = {};
      for (const key in data) {
        if (data[key] !== undefined) {
          cleanData[key.trim().toLowerCase()] = data[key].trim();
        }
      }
      results.push(cleanData);
    })
    .on('end', async () => {
      // Delete temporary file
      fs.unlinkSync(req.file.path);
      
      const db = await getDb();
      let importedCount = 0;
      let skippedCount = 0;

      try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare(`
          INSERT OR REPLACE INTO questions (
            id, subject, topic, subtopic, year, source_paper, source_type, 
            question_type, marks, difficulty, question_text, answer_text, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const row of results) {
          const id = row.id || row.question_id || row['question id'];
          const subject = row.subject;
          const topic = row.topic;
          const subtopic = row.subtopic || '';
          const year = parseInt(row.year, 10);
          const source_paper = row.source_paper || row.source || row['source paper'] || '';
          
          let source_type = row.source_type || row['source type'] || 'Original';
          if (source_type.toLowerCase() === 'past_paper') source_type = 'Past Paper';
          
          let question_type = row.question_type || row['question type'] || 'Short Answer';
          
          const marks = parseInt(row.marks || row.mark || row.points, 10);
          const difficulty = row.difficulty || 'Medium';
          const question_text = row.question_text || row.text || row.question || '';
          const answer_text = row.answer_text || row.answer || row.solution || row['answer text'] || '';
          const status = row.status || 'Draft';

          // Basic validation to skip empty rows
          if (!id || !subject || !topic || isNaN(year) || isNaN(marks) || !question_text || !answer_text) {
            skippedCount++;
            continue;
          }

          // Enforce constraints
          const validSourceTypes = ['Original', 'Past Paper'];
          const finalSourceType = validSourceTypes.find(t => t.toLowerCase() === source_type.toLowerCase()) || 'Original';

          const validQuestionTypes = ['MCQ', 'Short Answer', 'Structured', 'Essay'];
          const finalQuestionType = validQuestionTypes.find(t => t.toLowerCase() === question_type.toLowerCase()) || 'Short Answer';

          const validDifficulties = ['Easy', 'Medium', 'Hard'];
          const finalDifficulty = validDifficulties.find(t => t.toLowerCase() === difficulty.toLowerCase()) || 'Medium';

          const validStatuses = ['Draft', 'Reviewed', 'Final'];
          const finalStatus = validStatuses.find(t => t.toLowerCase() === status.toLowerCase()) || 'Draft';

          await stmt.run(
            id,
            subject,
            topic,
            subtopic,
            year,
            source_paper,
            finalSourceType,
            finalQuestionType,
            marks,
            finalDifficulty,
            question_text,
            answer_text,
            finalStatus
          );
          importedCount++;
        }
        await stmt.finalize();
        await db.run('COMMIT');

        res.json({ success: true, imported: importedCount, skipped: skippedCount });
      } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ error: 'Database transaction error: ' + err.message });
      }
    })
    .on('error', (err) => {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Failed to process CSV file: ' + err.message });
    });
});

// Helper: Dynamically launch browser based on environment (Vercel serverless vs Local)
async function getBrowser() {
  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    // Force sparticuz/chromium-min environment detection to use AL2023 packages (Node 20+)
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs20.x';
    process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs20.x';

    const chromiumModule = await import('@sparticuz/chromium-min');
    const chromium = chromiumModule.default || chromiumModule;
    
    const puppeteerCoreModule = await import('puppeteer-core');
    const puppeteerCore = puppeteerCoreModule.default || puppeteerCoreModule;

    const executablePath = await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar');

    if (executablePath) {
      const execDir = path.dirname(executablePath);
      const libDir = path.join(execDir, 'lib');
      const pathsToAppend = `${execDir}:${libDir}`;
      process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH 
        ? `${process.env.LD_LIBRARY_PATH}:${pathsToAppend}` 
        : pathsToAppend;
    }

    return await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
    });
  } else {
    // Local development
    const puppeteerModule = await import('puppeteer');
    const puppeteer = puppeteerModule.default || puppeteerModule;
    return await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
}

// Helper: Get authenticated user from token
async function getAuthUser(req) {
  const token = req.cookies.token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await getDb();
    const user = await db.get('SELECT id, name, email FROM users WHERE id = ?', [decoded.id]);
    return user || null;
  } catch (err) {
    return null;
  }
}

// Endpoint: Register User
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Valid email and password (min 8 characters) are required.' });
  }

  try {
    const db = await getDb();
    
    // Check if user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({ error: 'This email is already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await db.run(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name || null, email.toLowerCase(), passwordHash]
    );

    // Create session token
    const token = jwt.sign({ id: result.lastID }, JWT_SECRET, { expiresIn: '7d' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      id: result.lastID,
      name: name || null,
      email: email.toLowerCase()
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed due to server error.' });
  }
});

// Endpoint: Login User
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const db = await getDb();
    
    // Look up user (use generic error message to prevent enumeration)
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Create session token
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed due to server error.' });
  }
});

// Endpoint: Request Password Reset (Mock for UX flow)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  
  try {
    const db = await getDb();
    const user = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    // Always return a success response to avoid email harvesting, but simulate sending a link if user exists
    if (user) {
      console.log(`Password reset link requested for ${email.toLowerCase()}`);
    }
    
    res.json({ message: 'If that email is registered, we have sent a reset password link.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error occurred.' });
  }
});

// Endpoint: Logout User
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Endpoint: Current Session user
app.get('/api/auth/me', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json(user);
});

// Endpoint: Generate Question Paper and Mark Scheme
app.post('/api/generate', async (req, res) => {
  const {
    subject,
    ExamBlueprint, // [{ topic, subtopic, count }]
    questionIds, // optional: array of question IDs
    yearMin,
    yearMax,
    randomize, // boolean
    headerImage, // base64 string or null
    footerImage  // base64 string or null
  } = req.body;

  console.log(`[generate] POST /api/generate hit - Subject: "${subject}", Questions count: ${questionIds ? questionIds.length : 0}`);

  const user = await getAuthUser(req);
  if (!user) {
    console.log("[generate] Request blocked: User is not authenticated.");
    return res.status(401).json({ error: 'Authentication required. Please log in or register to generate exam papers.' });
  }
  if (!subject) {
    return res.status(400).json({ error: 'Subject parameter is required' });
  }

  let questionPaperHtml = '';
  let markSchemeHtml = '';

  try {
    const db = await getDb();
    let finalQuestionsList = [];

    if (questionIds && Array.isArray(questionIds) && questionIds.length > 0) {
      // Query specific question IDs
      const placeholders = questionIds.map(() => '?').join(',');
      const questions = await db.all(
        `SELECT * FROM questions WHERE id IN (${placeholders})`,
        questionIds
      );

      // Create a map to preserve the exact order of questionIds
      const questionMap = {};
      questions.forEach(q => {
        questionMap[q.id] = q;
      });

      finalQuestionsList = questionIds.map(id => questionMap[id]).filter(Boolean);

      if (finalQuestionsList.length === 0) {
        return res.status(400).json({ error: 'None of the selected questions were found in the database.' });
      }

      if (randomize) {
        // If randomize is ON, shuffle the curated list
        for (let i = finalQuestionsList.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalQuestionsList[i], finalQuestionsList[j]] = [finalQuestionsList[j], finalQuestionsList[i]];
        }
      }
    } else {
      if (!ExamBlueprint || !Array.isArray(ExamBlueprint)) {
        return res.status(400).json({ error: 'Missing or invalid parameters' });
      }

      const selectedQuestions = [];

      // Query questions topic by topic according to ExamBlueprint
      for (const item of ExamBlueprint) {
        const count = parseInt(item.count, 10);
        if (isNaN(count) || count <= 0) continue;

        // Retrieve all eligible questions for this category and year range
        const questions = await db.all(
          `SELECT * FROM questions 
           WHERE subject = ? AND topic = ? AND subtopic = ? AND year >= ? AND year <= ?`,
          [subject, item.topic, item.subtopic, yearMin, yearMax]
        );

        // Validate question count matches request
        if (questions.length < count) {
          return res.status(400).json({
            error: `Only ${questions.length} questions available for "${item.subtopic}" in years ${yearMin}-${yearMax}, but you requested ${count}.`
          });
        }

        let selectedForTopic = [...questions];

        if (randomize) {
          // Shuffle array in-place
          for (let i = selectedForTopic.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [selectedForTopic[i], selectedForTopic[j]] = [selectedForTopic[j], selectedForTopic[i]];
          }
        } else {
          // Sort deterministically by ID
          selectedForTopic.sort((a, b) => a.id.localeCompare(b.id));
        }

        // Slice the requested number of questions
        selectedQuestions.push({
          topic: item.subtopic,
          questions: selectedForTopic.slice(0, count)
        });
      }

      if (selectedQuestions.length === 0) {
        return res.status(400).json({ error: 'No questions selected. Please choose at least one topic.' });
      }

      if (randomize) {
        // Shuffle the topics order
        for (let i = selectedQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [selectedQuestions[i], selectedQuestions[j]] = [selectedQuestions[j], selectedQuestions[i]];
        }
        
        // Flatten questions
        for (const group of selectedQuestions) {
          finalQuestionsList.push(...group.questions);
        }
        
        // Shuffle the flattened list one final time to fully mix topics if randomize is ON
        for (let i = finalQuestionsList.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalQuestionsList[i], finalQuestionsList[j]] = [finalQuestionsList[j], finalQuestionsList[i]];
        }
      } else {
        // Keep topics in sorted alphabetical/consistent order, and flatten questions
        selectedQuestions.sort((a, b) => a.topic.localeCompare(b.topic));
        for (const group of selectedQuestions) {
          finalQuestionsList.push(...group.questions);
        }
      }
    }

    // Convert all remote/local image URL placeholders inside questions list to inline Base64 data URLs
    const processedQuestions = await Promise.all(
      finalQuestionsList.map(async (q) => {
        const questionTextProcessed = await replaceImagePlaceholdersWithBase64(q.question_text);
        const answerTextProcessed = await replaceImagePlaceholdersWithBase64(q.answer_text);
        return {
          ...q,
          question_text: questionTextProcessed,
          answer_text: answerTextProcessed
        };
      })
    );

    // Generate total marks
    const totalMarks = processedQuestions.reduce((sum, q) => sum + q.marks, 0);

    // Build HTML for Question Paper
    questionPaperHtml = buildPaperHtml({
      subject,
      title: `${subject} Examination`,
      subtitle: `Question Paper`,
      totalMarks,
      yearMin,
      yearMax,
      questions: processedQuestions,
      isMarkScheme: false,
      headerImage,
      footerImage
    });

    // Build HTML for Mark Scheme
    markSchemeHtml = buildPaperHtml({
      subject,
      title: `${subject} Examination`,
      subtitle: `Mark Scheme`,
      totalMarks,
      yearMin,
      yearMax,
      questions: processedQuestions,
      isMarkScheme: true,
      headerImage,
      footerImage
    });

    // Render PDFs using Puppeteer
    let browser;
    try {
      browser = await getBrowser();

      const [qpPdf, msPdf] = await Promise.all([
        renderPdf(browser, questionPaperHtml, subject, 'Question Paper', headerImage, footerImage),
        renderPdf(browser, markSchemeHtml, subject, 'Mark Scheme', headerImage, footerImage)
      ]);

      await browser.close();
      browser = null;

      // Pack into a ZIP file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="Direction_Classes_${subject.replace(/\s+/g, '_')}_Exam.zip"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        throw err;
      });

      archive.pipe(res);
      archive.append(qpPdf, { name: 'Question_Paper.pdf' });
      archive.append(msPdf, { name: 'Mark_Scheme.pdf' });
      await archive.finalize();
      console.log(`[generate] ZIP generated and sent successfully for subject: "${subject}"`);
    } finally {
      if (browser) {
        try { await browser.close(); } catch (e) {}
      }
    }

  } catch (error) {
    console.error("PDF generation via Puppeteer failed, falling back to client-side renderer:", error.message);
    if (questionPaperHtml && markSchemeHtml) {
      return res.json({
        fallbackHtml: true,
        subject,
        questionPaperHtml,
        markSchemeHtml
      });
    } else {
      return res.status(500).json({ error: error.message || 'Failed to generate PDF documents.' });
    }
  }
});

// Helper: Render HTML to PDF via Puppeteer
async function renderPdf(browser, html, subject, documentType, headerImage, footerImage) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Design Puppeteer Header Template
    let headerTemplate = '';
    if (headerImage) {
      headerTemplate = `
        <style>
          html { -webkit-print-color-adjust: exact; }
          #header { 
            padding: 0 !important; 
            margin: 0 !important; 
            width: 100% !important;
            height: 75px !important;
          }
        </style>
        <div style="width: 100%; height: 75px; position: relative; margin: 0; padding: 0;">
          <img src="${headerImage}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; z-index: -1;" />
        </div>`;
    } else {
      headerTemplate = `
        <div style="font-size: 9px; font-family: Helvetica, Arial, sans-serif; width: 100%; display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 15px 50px 5px 50px; box-sizing: border-box; color: #666;">
          <span style="font-weight: bold; text-transform: uppercase;">Direction Classes</span>
          <span>${subject} - ${documentType}</span>
        </div>`;
    }

    // Design Puppeteer Footer Template
    let footerTemplate = '';
    if (footerImage) {
      footerTemplate = `
        <style>
          html { -webkit-print-color-adjust: exact; }
          #footer { 
            padding: 0 !important; 
            margin: 0 !important; 
            width: 100% !important;
            height: 75px !important;
          }
        </style>
        <div style="width: 100%; height: 75px; position: relative; margin: 0; padding: 0;">
          <img src="${footerImage}" style="position: absolute; bottom: 0; left: 0; width: 100%; height: 100%; object-fit: fill; z-index: -1;" />
          <div style="position: absolute; bottom: 10px; right: 50px; color: #666; font-size: 8px; font-family: Helvetica, Arial, sans-serif; z-index: 10;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        </div>`;
    } else {
      footerTemplate = `
        <div style="font-size: 9px; font-family: Helvetica, Arial, sans-serif; width: 100%; display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding: 5px 50px 15px 50px; box-sizing: border-box; color: #666;">
          <span>${documentType} - Direction Classes</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`;
    }

    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '75px',
        bottom: '75px',
        left: '50px',
        right: '50px'
      },
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      printBackground: true
    });

    return pdf;
  } finally {
    await page.close();
  }
}

// Helper: Build structured HTML for the exam/mark scheme
function buildPaperHtml({ subject, title, subtitle, totalMarks, yearMin, yearMax, questions, isMarkScheme, headerImage, footerImage }) {
  const pageBreakRule = 'avoid';
  const contentHtml = questions.map((q, index) => {
    if (isMarkScheme) {
      const bodyClass = q.answer_text.includes('[IMAGE:') ? 'item-body' : 'item-body font-mono';
      const headerStyle = subject === 'Mathematics' ? 'style="margin-bottom: 0px;"' : '';
      return `
        <div class="item-block">
          <div class="item-header" ${headerStyle}>
            <span class="item-title">Question ${index + 1} Mark Scheme</span>
            <span class="item-meta">[${q.marks} Marks | ${q.id}]</span>
          </div>
          <div class="${bodyClass}">${formatRichText(q.answer_text, subject, true)}</div>
        </div>`;
    } else {
      let workspaceHeight = 40;
      if (q.marks === 2) {
        workspaceHeight = 80;
      } else if (q.marks >= 3) {
        workspaceHeight = 120;
      }
      const headerStyle = subject === 'Mathematics' ? 'style="margin-bottom: 0px;"' : '';
      return `
        <div class="item-block">
          <div class="item-header" ${headerStyle}>
            <span class="item-title">Question ${index + 1}</span>
            <span class="item-meta">[${q.marks} Marks | ${q.id}]</span>
          </div>
          <div class="item-body">${formatRichText(q.question_text, subject, false)}</div>
          <div class="question-workspace" style="height: ${workspaceHeight}pt;"></div>
        </div>`;
    }
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #111;
          margin: 0;
          padding: 0;
          font-size: 14px;
          line-height: 1.6;
        }
        .cover-page {
          text-align: center;
          padding: 80px 40px 40px 40px;
          border-bottom: 2px double #333;
          margin-bottom: 40px;
          page-break-after: always;
        }
        .cover-logo {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 20px;
          color: #1a1a1a;
        }
        .cover-title {
          font-size: 32px;
          font-weight: 700;
          margin: 20px 0 10px 0;
          color: #111;
        }
        .cover-subtitle {
          font-size: 18px;
          font-weight: 400;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 40px;
        }
        .meta-table {
          width: 80%;
          margin: 0 auto;
          border-collapse: collapse;
          margin-top: 50px;
        }
        .meta-table td {
          padding: 10px 15px;
          border-bottom: 1px solid #eee;
          text-align: left;
          font-size: 14px;
        }
        .meta-table td.label {
          font-weight: bold;
          color: #555;
          width: 40%;
        }
        .instructions {
          width: 80%;
          margin: 40px auto 0 auto;
          text-align: left;
          border: 1px solid #ddd;
          padding: 20px;
          background: #fafafa;
          border-radius: 4px;
        }
        .instructions h3 {
          margin-top: 0;
          font-size: 16px;
        }
        .instructions ul {
          padding-left: 20px;
          margin-bottom: 0;
        }
        .instructions li {
          margin-bottom: 8px;
        }
        .item-block {
          page-break-inside: ${pageBreakRule};
          margin-bottom: 35px;
          clear: both;
        }
        .item-block::after {
          content: "";
          display: table;
          clear: both;
        }
        .item-header {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          border-bottom: 1px solid #222;
          padding-bottom: 5px;
          margin-bottom: 12px;
          font-size: 14px;
          clear: both;
        }
        .item-title {
          color: #111;
        }
        .item-meta {
          color: #444;
          font-weight: normal;
        }
        .item-body {
          font-size: 13px;
          white-space: pre-wrap;
          color: #222;
          clear: both;
        }
        .item-body * {
          page-break-inside: avoid;
        }
        .font-mono {
          font-family: 'Courier New', Courier, monospace;
          background: #f7f7f7;
          border: 1px solid #e1e1e1;
          padding: 12px;
          border-radius: 4px;
          line-height: 1.5;
        }
        .question-workspace {
          display: block;
          width: 100%;
          background: transparent;
        }
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 70px;
          font-weight: 800;
          letter-spacing: 6px;
          color: rgba(0, 0, 0, 0.05);
          pointer-events: none;
          z-index: -1000;
          white-space: nowrap;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      ${headerImage ? `<img src="${headerImage}" style="display: none;" />` : ''}
      ${footerImage ? `<img src="${footerImage}" style="display: none;" />` : ''}
      <div class="watermark">Direction Classes</div>
      <div class="cover-page">
        <div class="cover-logo">Direction Classes</div>
        <div class="cover-title">${title}</div>
        <div class="cover-subtitle">${subtitle}</div>
        
        <table class="meta-table">
          <tr>
            <td class="label">Subject:</td>
            <td>${subject}</td>
          </tr>
          <tr>
            <td class="label">Year Scope:</td>
            <td>${yearMin} — ${yearMax}</td>
          </tr>
          <tr>
            <td class="label">Total Marks:</td>
            <td><strong>${totalMarks} Marks</strong></td>
          </tr>
          <tr>
            <td class="label">Allocated Time:</td>
            <td>${Math.max(30, totalMarks * 1.5)} Minutes</td>
          </tr>
        </table>
        
        <div class="instructions">
          <h3>Instructions to Candidates</h3>
          <ul>
            <li>Answer all questions in the spaces provided.</li>
            <li>Show all your workings clearly. High marks are awarded for clear logic.</li>
            <li>Calculators are permitted where appropriate.</li>
            <li>Do not write in the margins or headers/footers.</li>
          </ul>
        </div>
      </div>
      
      <div class="questions-container" style="padding: 20px 0;">
        ${contentHtml}
      </div>
    </body>
    </html>`;
}

// Helper: Escape HTML strings
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper: Format question and answer texts to support embedded [IMAGE: url] placeholders
function formatRichText(text, subject, isMarkScheme = false) {
  let escaped = escapeHtml(text);
  const imageRegex = /\[IMAGE:\s*([^\]\s]+)\]/gi;
  
  let lastIndex = 0;
  let result = '';
  let match;
  let consecutiveImages = [];
  
  const flushImages = () => {
    if (consecutiveImages.length === 0) return '';
    
    // Check if any image is a Math slice
    const hasMathSlice = consecutiveImages.some(url => url.includes('math_0580') || subject === 'Mathematics');
    
    if (hasMathSlice) {
      // Math visual slices: render in a zero-space column block allowing clean image splits
      const breakRule = isMarkScheme ? 'avoid' : 'auto';
      const imgTags = consecutiveImages.map((url, index) => {
        let clip = 'inset(0 28px 0 0)';
        if (consecutiveImages.length === 1) {
          clip = 'inset(2px 28px 12px 0)';
        } else if (index === 0) {
          clip = 'inset(2px 28px 0 0)';
        } else if (index === consecutiveImages.length - 1) {
          clip = 'inset(0 28px 12px 0)';
        }
        return `<img src="${url}" style="width: 100%; display: block; margin: 0; padding: 0; border: none; box-shadow: none; page-break-inside: ${breakRule}; background-color: #ffffff; clip-path: ${clip};" />`;
      }).join('');
      consecutiveImages = [];
      return `
        <div style="margin-top: -15px; margin-bottom: 5px; line-height: 0; font-size: 0; text-align: left; page-break-inside: ${breakRule}; border: none; padding: 0; background: transparent; box-shadow: none;">
          ${imgTags}
        </div>`;
    } else {
      // Fallback for general subject illustrations
      const rendered = consecutiveImages.map(url => {
        return `
          <div style="margin: 15px 0; text-align: center; page-break-inside: avoid;">
            <img src="${url}" style="max-width: 90%; max-height: 250px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; background-color: #ffffff; clip-path: inset(2px 28px 12px 0);" />
          </div>`;
      }).join('');
      consecutiveImages = [];
      return rendered;
    }
  };

  imageRegex.lastIndex = 0;
  while ((match = imageRegex.exec(escaped)) !== null) {
    const textBefore = escaped.substring(lastIndex, match.index);
    if (textBefore.trim().length > 0) {
      result += flushImages();
      result += textBefore.replace(/\n/g, '<br>');
    }
    const url = match[1].replace(/&amp;/g, '&');
    consecutiveImages.push(url);
    lastIndex = imageRegex.lastIndex;
  }
  
  result += flushImages();
  if (lastIndex < escaped.length) {
    result += escaped.substring(lastIndex).replace(/\n/g, '<br>');
  }
  return result;
}

// Helper: Fetch image from remote URL and encode to Base64 data URL
function fetchImageAsBase64(imageUrl) {
  return new Promise((resolve) => {
    if (imageUrl.startsWith('data:')) {
      return resolve(imageUrl);
    }

    const client = imageUrl.startsWith('https') ? https : http;
    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };

    client.get(imageUrl, requestOptions, (res) => {
      if (res.statusCode !== 200) {
        console.error(`Failed to fetch image: HTTP status ${res.statusCode} for ${imageUrl}`);
        return resolve(imageUrl); // Fallback
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const mimeType = res.headers['content-type'] || 'image/png';
        const base64 = buffer.toString('base64');
        resolve(`data:${mimeType};base64,${base64}`);
      });
    }).on('error', (err) => {
      console.error(`Error requesting remote image ${imageUrl}:`, err.message);
      resolve(imageUrl); // Fallback
    });
  });
}

// Helper: Scan text for [IMAGE: url] placeholders and inline them to Base64
async function replaceImagePlaceholdersWithBase64(text) {
  if (!text) return text;

  const imageRegex = /\[IMAGE:\s*([^\]\s]+)\]/gi;
  const matches = [...text.matchAll(imageRegex)];

  if (matches.length === 0) return text;

  let newText = text;
  for (const match of matches) {
    const originalPlaceholder = match[0];
    const imageUrl = match[1];

    let base64Url = imageUrl;
    if (imageUrl.startsWith('/')) {
      const localPath = path.join(__dirname, 'public', imageUrl);
      if (fs.existsSync(localPath)) {
        const mimeType = localPath.endsWith('.svg') 
          ? 'image/svg+xml' 
          : (localPath.endsWith('.jpg') || localPath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png');
        const fileBuffer = fs.readFileSync(localPath);
        base64Url = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
      }
    } else {
      base64Url = await fetchImageAsBase64(imageUrl);
    }

    newText = newText.replace(originalPlaceholder, `[IMAGE: ${base64Url}]`);
  }

  return newText;
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

export default app;
