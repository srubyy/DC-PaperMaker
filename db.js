import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDbPath = path.join(__dirname, 'questions.db');
const isVercel = !!process.env.VERCEL;
const dbPath = isVercel ? '/tmp/questions.db' : srcDbPath;

let dbPromise = null;

export async function getDb() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    if (isVercel && !fs.existsSync(dbPath)) {
      // Copy the original seed database to /tmp so we can write user rows and upload files
      fs.copyFileSync(srcDbPath, dbPath);
      console.log('Database copied to writeable /tmp path.');
    }

    return await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  })();

  return dbPromise;
}

export async function initDb() {
  const db = await getDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      year INTEGER NOT NULL,
      source_paper TEXT,
      source_type TEXT NOT NULL CHECK(source_type IN ('Original', 'Past Paper')),
      question_type TEXT NOT NULL CHECK(question_type IN ('MCQ', 'Short Answer', 'Structured', 'Essay')),
      marks INTEGER NOT NULL,
      difficulty TEXT NOT NULL CHECK(difficulty IN ('Easy', 'Medium', 'Hard')),
      question_text TEXT NOT NULL,
      answer_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft', 'Reviewed', 'Final'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
    CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
    CREATE INDEX IF NOT EXISTS idx_questions_year ON questions(year);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  // Seed demo user if not already present
  try {
    const demoExists = await db.get("SELECT COUNT(*) as count FROM users WHERE email = ?", ['demo@example.com']);
    if (demoExists && demoExists.count === 0) {
      const demoHash = await bcrypt.hash('Password123!', 10);
      await db.run(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        ['Demo User', 'demo@example.com', demoHash]
      );
      console.log('Demo user seeded successfully (demo@example.com / Password123!)');
    }
  } catch (err) {
    console.error('Failed to seed demo user:', err.message);
  }

  console.log('Database initialized successfully with users schema.');
  return db;
}
