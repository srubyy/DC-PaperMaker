import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';
import archiver from 'archiver';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { getDb, initDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure upload folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: 'uploads/' });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB on server start
initDb().catch(err => {
  console.error("DB Initialization failed:", err);
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

    // Get year range
    const yearRow = await db.get(
      'SELECT MIN(year) as minYear, MAX(year) as maxYear FROM questions WHERE subject = ?',
      [subject]
    );

    // Get lightweight question metadata (id, topic, year, marks) for live calculations
    const questionMetaRows = await db.all(
      'SELECT id, topic, year, marks FROM questions WHERE subject = ? ORDER BY id ASC',
      [subject]
    );

    res.json({
      topics,
      minYear: yearRow.minYear || 2020,
      maxYear: yearRow.maxYear || 2026,
      questions: questionMetaRows
    });
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

// Endpoint: Generate Question Paper and Mark Scheme
app.post('/api/generate', async (req, res) => {
  const {
    subject,
    topicSelections, // e.g. { "Chemical Bonding": 2, "Organic Chemistry": 1 }
    yearMin,
    yearMax,
    randomize, // boolean
    headerImage, // base64 string or null
    footerImage  // base64 string or null
  } = req.body;

  if (!subject || !topicSelections || typeof topicSelections !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid parameters' });
  }

  try {
    const db = await getDb();
    const selectedQuestions = [];

    // Query questions topic by topic
    for (const [topic, requestedCount] of Object.entries(topicSelections)) {
      const count = parseInt(requestedCount, 10);
      if (isNaN(count) || count <= 0) continue;

      // Retrieve all eligible questions for this topic and year range
      const questions = await db.all(
        `SELECT * FROM questions 
         WHERE subject = ? AND topic = ? AND year >= ? AND year <= ?`,
        [subject, topic, yearMin, yearMax]
      );

      // Validate question count matches request
      if (questions.length < count) {
        return res.status(400).json({
          error: `Only ${questions.length} questions available for "${topic}" in years ${yearMin}-${yearMax}, but you requested ${count}.`
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
        topic,
        questions: selectedForTopic.slice(0, count)
      });
    }

    if (selectedQuestions.length === 0) {
      return res.status(400).json({ error: 'No questions selected. Please choose at least one topic.' });
    }

    // Determine final questions list and their order
    let finalQuestionsList = [];

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

    // Generate total marks
    const totalMarks = finalQuestionsList.reduce((sum, q) => sum + q.marks, 0);

    // Build HTML for Question Paper
    const questionPaperHtml = buildPaperHtml({
      subject,
      title: `${subject} Examination`,
      subtitle: `Question Paper`,
      totalMarks,
      yearMin,
      yearMax,
      questions: finalQuestionsList,
      isMarkScheme: false
    });

    // Build HTML for Mark Scheme
    const markSchemeHtml = buildPaperHtml({
      subject,
      title: `${subject} Examination`,
      subtitle: `Mark Scheme`,
      totalMarks,
      yearMin,
      yearMax,
      questions: finalQuestionsList,
      isMarkScheme: true
    });

    // Render PDFs using Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const [qpPdf, msPdf] = await Promise.all([
      renderPdf(browser, questionPaperHtml, subject, 'Question Paper', headerImage, footerImage),
      renderPdf(browser, markSchemeHtml, subject, 'Mark Scheme', headerImage, footerImage)
    ]);

    await browser.close();

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

  } catch (error) {
    console.error("PDF generation failed:", error);
    res.status(500).json({ error: 'Failed to generate PDF documents: ' + error.message });
  }
});

// Helper: Render HTML to PDF via Puppeteer
async function renderPdf(browser, html, subject, documentType, headerImage, footerImage) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Design Puppeteer Header Template
  let headerTemplate = '';
  if (headerImage) {
    headerTemplate = `
      <div style="font-size: 8px; font-family: Helvetica, Arial, sans-serif; width: 100%; display: flex; justify-content: center; padding: 10px 50px 0 50px; box-sizing: border-box;">
        <img src="${headerImage}" style="max-height: 40px; width: auto; object-fit: contain;" />
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
      <div style="font-size: 8px; font-family: Helvetica, Arial, sans-serif; width: 100%; display: flex; flex-direction: column; align-items: center; padding: 0 50px 10px 50px; box-sizing: border-box;">
        <img src="${footerImage}" style="max-height: 35px; width: auto; object-fit: contain; margin-bottom: 4px;" />
        <div style="color: #666; font-size: 8px; width: 100%; display: flex; justify-content: space-between;">
          <span>${documentType}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
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

  await page.close();
  return pdf;
}

// Helper: Build structured HTML for the exam/mark scheme
function buildPaperHtml({ subject, title, subtitle, totalMarks, yearMin, yearMax, questions, isMarkScheme }) {
  const contentHtml = questions.map((q, index) => {
    if (isMarkScheme) {
      return `
        <div class="item-block">
          <div class="item-header">
            <span class="item-title">Question ${index + 1} Mark Scheme</span>
            <span class="item-meta">[${q.marks} Marks | ${q.id}]</span>
          </div>
          <div class="item-body font-mono">${escapeHtml(q.answer_text).replace(/\n/g, '<br>')}</div>
        </div>`;
    } else {
      return `
        <div class="item-block">
          <div class="item-header">
            <span class="item-title">Question ${index + 1}</span>
            <span class="item-meta">[${q.marks} Marks | ${q.id}]</span>
          </div>
          <div class="item-body">${escapeHtml(q.question_text).replace(/\n/g, '<br>')}</div>
          <div class="item-spacing"></div>
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
          page-break-inside: avoid;
          margin-bottom: 35px;
        }
        .item-header {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          border-bottom: 1px solid #222;
          padding-bottom: 5px;
          margin-bottom: 12px;
          font-size: 14px;
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
        }
        .font-mono {
          font-family: 'Courier New', Courier, monospace;
          background: #f7f7f7;
          border: 1px solid #e1e1e1;
          padding: 12px;
          border-radius: 4px;
          line-height: 1.5;
        }
        .item-spacing {
          height: 100px;
          border-bottom: 1px dotted #ccc;
          margin-top: 20px;
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
          text-transform: uppercase;
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

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
