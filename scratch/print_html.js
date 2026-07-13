import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../questions.db');

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatRichText(text, subject) {
  let escaped = escapeHtml(text);
  const imageRegex = /\[IMAGE:\s*([^\]\s]+)\]/gi;
  escaped = escaped.replace(imageRegex, (match, url) => {
    const cleanUrl = url.replace(/&amp;/g, '&');
    const isMathSlice = (subject === 'Mathematics') || cleanUrl.includes('math_0580');
    const imgStyle = isMathSlice
      ? 'width: 100%; max-height: none; object-fit: contain; border: none; padding: 0; background-color: #ffffff; box-shadow: none;'
      : 'max-width: 90%; max-height: 250px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; background-color: #ffffff;';
    const wrapperStyle = isMathSlice
      ? 'margin: 5px 0; text-align: left; page-break-inside: avoid; border: none; padding: 0; background: transparent; box-shadow: none;'
      : 'margin: 15px 0; text-align: center; page-break-inside: avoid;';
    return `
      <div style="${wrapperStyle}">
        <img src="${cleanUrl}" style="${imgStyle}" />
      </div>`;
  });
  return escaped.replace(/\n/g, '<br>');
}

async function main() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  const q = await db.get("SELECT * FROM questions WHERE subject = 'Mathematics' AND year = 2013 LIMIT 1");
  console.log("DB text:", q.question_text);
  console.log("Formatted output:", formatRichText(q.question_text, 'Mathematics'));
  await db.close();
}

main();
