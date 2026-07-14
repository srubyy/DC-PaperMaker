import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'questions.db');

let dbInstance = null;

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const isVercel = !!process.env.VERCEL;
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database,
    mode: isVercel ? sqlite3.OPEN_READONLY : undefined
  });

  return dbInstance;
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

    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
    CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
    CREATE INDEX IF NOT EXISTS idx_questions_year ON questions(year);
  `);

  console.log('Database initialized successfully.');
  return db;
}
