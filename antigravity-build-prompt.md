# Build Prompt: Question Paper Generator (for Direction Classes)

Paste this into Antigravity as your project brief. Sections marked **[YOU FILL IN]** need your input before or during the build.

---

## Project Overview

Build a web application that lets a teacher/admin generate exam question papers and their matching mark schemes from a pre-tagged question bank. The user selects topics, years, and how many questions per topic, optionally uploads a header/footer, and the system generates two paired PDFs: the question paper and the mark scheme, with identical question numbering.

This is a single-client internal tool for a tutoring institute (Direction Classes) — not a public multi-tenant SaaS. No user registration/login needed for MVP. No payment processing needed.

---

## Tech Stack

- **Frontend:** [YOU FILL IN — recommend: plain HTML/CSS/JS if you want fastest build and easiest maintenance; React if you want it to grow into something more complex later]
- **Backend:** Node.js + Express
- **Database:** SQLite (single subject, single institute — no need for Postgres at this scale)
- **PDF generation:** Puppeteer (render styled HTML to PDF — this makes matching header/footer images/styling much easier than a raw PDF library)
- **Hosting target:** Vercel (frontend) + a small persistent backend host (Render/Railway) since Puppeteer needs a real server environment, not serverless functions

---

## Data Model

Create a `questions` table with these fields (matches the tagging spreadsheet exactly):

```
id            (string, e.g. "CHEM-VEC-0001")
subject       (string)
topic         (string)
subtopic      (string)
year          (string or int)
source_paper  (string)
source_type   (string: "Original" | "Past Paper")
question_type (string: "MCQ" | "Short Answer" | "Structured" | "Essay")
marks         (integer)
difficulty    (string: "Easy" | "Medium" | "Hard")
question_text (text — may include image references)
answer_text   (text — the mark scheme content for this question)
status        (string: "Draft" | "Reviewed" | "Final")
```

Provide a seed script that imports this data from a CSV/JSON export (I will export this from my tagging spreadsheet — ask me for the file if not provided).

---

## Core Feature: Selection Form

Build a form with:

1. **Subject selector** (dropdown — pulls distinct subjects from the database)
2. **Topic checkboxes** (dynamically populated based on selected subject — pull distinct topics from the database, do not hardcode)
3. **Year range** (two dropdowns or a slider — min year, max year, populated from actual years present in the data)
4. **Questions per topic** (a number input next to each selected topic checkbox — e.g. "Chemical Bonding: [3] questions")
5. **Randomize toggle** — a single checkbox: "Randomize question order and topic order" (ON = shuffle both which questions are picked within a topic AND the order topics/questions appear in the final paper; OFF = questions appear in a consistent, predictable order — e.g. by topic then by year)
6. **Header/footer upload** — optional image upload (PNG/JPG) for header, separate optional upload for footer. If skipped, use a clean default layout (simple institute name + "Question Paper" title, page numbers in footer)
7. **Total marks display** — as the user makes selections, show a running total of marks so they can see if it matches a target paper length
8. **Generate button**

**Validation rules (must enforce before allowing generation):**
- If a topic is selected but the requested question count exceeds available questions for that topic within the selected year range, show a clear inline error (e.g. "Only 4 questions available for Organic Chemistry in 2022-2024, you requested 6") — do not allow generation to proceed silently with fewer questions than requested.
- At least one topic must be selected with at least 1 question requested.

---

## Core Feature: Generation Engine

On clicking Generate:

1. Query the database for questions matching each selected topic + year range.
2. Select the requested number of questions per topic:
   - If randomize is ON: randomly select from the pool for that topic, and randomize the order topics appear in the final paper.
   - If randomize is OFF: select in a consistent order (e.g. lowest ID first) and keep topics in the order they were selected/checked.
3. Assign sequential question numbers (Q1, Q2, Q3...) across the whole paper.
4. Build the **Question Paper document**: uploaded (or default) header → question paper title → each question in order, with its assigned number and marks shown → uploaded (or default) footer with page numbers.
5. Build the **Mark Scheme document**: same header/footer treatment → same question numbers → the matching answer_text for each question in the exact same order.
6. **Critical requirement: the question numbering in both documents must match exactly** — Q7 in the question paper must correspond to Q7 in the mark scheme, every time, with no drift.
7. Render both as PDFs via Puppeteer and return them to the user as two downloadable files (or a single zip).

---

## Edge Cases to Handle

- User uploads a header/footer image with unusual dimensions — don't let it break page layout or overlap question text. Constrain image size sensibly (e.g. max height as a percentage of the page).
- User selects a topic/year combination with zero matching questions — block generation with a clear message, don't generate an empty section.
- Regenerating the same selection with randomize ON should give a different question order/mix each time; with randomize OFF it should be identical every time.
- Long question text (multi-part structured questions) should not break page layout or get cut off mid-question across a page break — use page-break-avoid CSS rules around each question block.

---

## Explicitly Out of Scope for This Build (do not add)

- User accounts / login
- Payment/subscription logic
- Multi-subject switching in a single session (support one subject per generation for now)
- Difficulty-based auto-selection
- Image-heavy question rendering beyond basic embedded images (no diagram editor, no LaTeX rendering engine — if questions have complex diagrams, treat them as embedded images already prepared)

---

## Deliverable Checklist for Antigravity

- [ ] Working local dev environment with seed data loaded
- [ ] Selection form fully functional with live validation against available question counts
- [ ] Generation engine producing two correctly paired, correctly numbered PDFs
- [ ] Default header/footer layout looks clean and professional (no placeholder Lorem Ipsum styling)
- [ ] Tested with at least one real header/footer image upload
- [ ] Basic error handling on all edge cases listed above
- [ ] Simple README explaining how to run it locally and how to import new question data later
