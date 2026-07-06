# Direction Classes - Question Paper Generator

A professional and chic web application for generating matched, styled Question Papers and Mark Schemes (in PDF format) from a seeded SQLite question bank. 

## Features

- **Dynamic Form Configuration**: Live-filtered topics, dynamic year dual-sliders, and question count selections.
- **Client-Side Live Validation**: Highlights and blocks generation with clear error explanations if requested question count exceeds database availability for the selected year range.
- **Marks Counter**: Live calculations displaying the total marks for the selected configuration.
- **Matched Question Numbering**: Sequential numbering (Q1, Q2, Q3...) that guarantees 100% matching order and numbering between the Question Paper and the Mark Scheme.
- **Custom Branding**: Drag-and-drop PNG/JPG image fields for custom headers and footers (automatically base64-inlined into Puppeteer print templates).
- **CSV Data Importer**: A utility dropzone in the web interface to upload additional question tagging sheets directly into the SQLite database.
- **Beautiful Design**: A professional violet/indigo glassmorphism dark-theme dashboard utilizing premium typography (Outfit & Inter fonts) and micro-animations.

---

## Technical Stack

- **Frontend**: Plain HTML, Vanilla CSS, Vanilla JavaScript (Single Page App)
- **Backend**: Node.js + Express
- **Database**: SQLite (using `sqlite` and `sqlite3` drivers)
- **PDF Engine**: Puppeteer (Chromium headless browser)
- **Archiving**: Zip packing using `archiver`

---

## Getting Started

### Prerequisites

- Node.js (v18.0.0 or higher recommended)
- Google Chrome/Chromium (Puppeteer will automatically download a local chromium binary during `npm install` on macOS)

### Installation

1. Install npm dependencies:
   ```bash
   npm install
   ```

2. Seed the database with high-quality mock questions (Chemistry, Physics, and Biology):
   ```bash
   npm run seed
   ```
   This will initialize `questions.db` and insert 18 realistic sample questions so you can test all features immediately.

3. Start the application:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## Import Format (CSV)

To import additional questions, upload a CSV file with the following column headers (case-insensitive, spaces and underscores are normalized automatically):

| Column Header | Type | Valid Values | Description |
|---|---|---|---|
| `id` | Text (Required) | e.g. `CHEM-CB-0001` | Unique question identifier (Primary Key) |
| `subject` | Text (Required) | e.g. `Chemistry` | Main academic subject |
| `topic` | Text (Required) | e.g. `Chemical Bonding` | Specific topic category |
| `subtopic` | Text (Optional) | e.g. `Covalent Bonding` | Sub-category of the topic |
| `year` | Integer (Required) | e.g. `2024` | Year of examination |
| `source_paper`| Text (Optional) | e.g. `Paper 1 Var 2` | Document origin of the question |
| `source_type` | Text | `Original`, `Past Paper` | Source classification (default: `Original`) |
| `question_type`| Text | `MCQ`, `Short Answer`, `Structured`, `Essay` | Question structure classification |
| `marks` | Integer (Required)| e.g. `5` | Points weight of the question |
| `difficulty` | Text | `Easy`, `Medium`, `Hard` | Difficulty rating (default: `Medium`) |
| `question_text`| Text (Required) | e.g. `Define active transport.` | Text contents of the exam question |
| `answer_text` | Text (Required) | e.g. `Active transport is...` | Detailed solution / mark scheme points |
| `status` | Text | `Draft`, `Reviewed`, `Final` | Development status of question (default: `Draft`) |

> **Note**: The importer uses database transactions. If any row is corrupted or invalid, it will skip it, but keep the database consistent.
