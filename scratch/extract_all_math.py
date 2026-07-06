import os
import re
import sqlite3
import pdfplumber
import fitz

# Path configuration
igcse_dir = "/Users/srutibaliga/Downloads/igcse math"
db_path = "/Users/srutibaliga/Documents/Projects/Paper/questions.db"
img_dir = "/Users/srutibaliga/Documents/Projects/Paper/public/images/math_0580"
os.makedirs(img_dir, exist_ok=True)

# Syllabus taxonomy keywords
TOPIC_KEYWORDS = {
    "Number": [
        "factor", "prime", "common factor", "vulgar", "standard form", "estimation", 
        "limits of accuracy", "upper bound", "lower bound", "ratio", "proportion", 
        "percentage", "compound interest", "growth", "decay", "venn", "set", "money", "currency"
    ],
    "Algebra and graphs": [
        "solve", "equation", "inequality", "simultaneous", "expand", "factorise", 
        "algebraic fraction", "indices", "index", "sequence", "nth term", "function", 
        "composite", "inverse", "f(x)", "g(x)", "tangent", "derivative", "differentiation", 
        "calculus", "dy/dx", "stationary point", "maximum point"
    ],
    "Coordinate geometry": [
        "coordinate", "straight line", "gradient", "y-intercept", "midpoint", "perpendicular line"
    ],
    "Geometry": [
        "similarity", "congruent", "symmetry", "angle", "polygon", "circle theorem", 
        "tangent to circle", "construction", "loci", "bisector"
    ],
    "Mensuration": [
        "perimeter", "area", "volume", "arc length", "sector", "surface area", "cylinder", 
        "cone", "sphere", "pyramid", "prism"
    ],
    "Trigonometry": [
        "pythagoras", "sin", "cos", "tan", "sine rule", "cosine rule", "bearing", "angle of elevation", 
        "angle of depression", "exact value", "3D trigonometry"
    ],
    "Transformations and vectors": [
        "reflection", "rotation", "enlargement", "translation", "vector", "magnitude", 
        "parallel vector", "collinear"
    ],
    "Probability": [
        "probability", "sample space", "tree diagram", "combined events", "conditional probability", 
        "random", "relative frequency"
    ],
    "Statistics": [
        "mean", "median", "mode", "range", "quartile", "interquartile", "stem-and-leaf", 
        "scatter diagram", "correlation", "line of best fit", "cumulative frequency", "histogram", 
        "frequency density"
    ]
}

def clean_text_block(text):
    """Clean header/footer noise from question text blocks."""
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        l = line.strip()
        # Skip exam codes/headers/footers
        if re.search(r'(0580/\d{2}|UCLES|Turn over|DO NOT WRITE|www\.exam-mate|This document consists|Page \d+)', l, re.IGNORECASE):
            continue
        cleaned_lines.append(line)
    return '\n'.join(cleaned_lines).strip()

def classify_topic(text):
    """Classify the question text into syllabus topics based on keywords."""
    scores = {topic: 0 for topic in TOPIC_KEYWORDS}
    text_lower = text.lower()
    for topic, keywords in TOPIC_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[topic] += 1
                
    best_topic = max(scores, key=scores.get)
    if scores[best_topic] == 0:
        return "Number", "General Arithmetic"  # Fallback default
        
    # Pick a simple subtopic name based on matched keyword
    subtopic = "General Concepts"
    for kw in TOPIC_KEYWORDS[best_topic]:
        if kw in text_lower:
            subtopic = kw.capitalize()
            break
            
    return best_topic, subtopic

def parse_pdf_file(filename):
    """Parse question papers and mark schemes from a merged PDF file."""
    path = os.path.join(igcse_dir, filename)
    year_match = re.search(r'20\d{2}', filename)
    year = int(year_match.group(0)) if year_match else 2025
    
    print(f"\nProcessing file: {filename} (Year: {year})...")
    
    doc = fitz.open(path)
    
    # 1. Segment pages into QP and MS per component variant
    # We group pages by (component, is_ms) -> list of page indices (0-indexed)
    component_pages = {}
    current_component = "0580/22"  # Default fallback
    
    for idx in range(len(doc)):
        page = doc[idx]
        text = page.get_text()
        
        # Detect component code
        comp_match = re.search(r'0580/(21|22|23|02)', text)
        if comp_match:
            current_component = comp_match.group(0)
            
        is_ms = "MARK SCHEME" in text.upper() or "MAXIMUM MARK" in text.upper() or "Page 2 of" in text
        
        # If it's a mark scheme page, mark the component's MS range
        # Note: If no MARK SCHEME keyword is on this page but it's part of MS block, we carry forward is_ms state
        # A simple state heuristic: if page is near the end of a component block or index matches previous scan ranges
        key = (current_component, is_ms)
        if key not in component_pages:
            component_pages[key] = []
        component_pages[key].append(idx)

    # Let's adjust is_ms grouping: pages following a MS cover page are also MS pages
    # until we hit a new QP cover page.
    adjusted_pages = {}
    last_comp = "0580/22"
    in_ms = False
    
    for idx in range(len(doc)):
        page = doc[idx]
        text = page.get_text()
        
        # Check if we hit a cover page of a QP
        is_qp_cover = "Cambridge IGCSE" in text and "MATHEMATICS" in text and "MARK SCHEME" not in text.upper()
        # Check if we hit a cover page of a MS
        is_ms_cover = "MARK SCHEME" in text.upper() or "MAXIMUM MARK" in text.upper()
        
        comp_match = re.search(r'0580/(21|22|23|02)', text)
        if comp_match:
            last_comp = comp_match.group(0)
            
        if is_qp_cover:
            in_ms = False
        elif is_ms_cover:
            in_ms = True
            
        key = (last_comp, in_ms)
        if key not in adjusted_pages:
            adjusted_pages[key] = []
        adjusted_pages[key].append(idx)
        
    print("Detected components and page ranges:")
    for (comp, ms_flag), pages in adjusted_pages.items():
        print(f"  Component: {comp} | MS: {ms_flag} | Pages: {min(pages)+1} - {max(pages)+1}")
        
    # 2. Extract all Mark Schemes (MS answers) for this document
    # Dict structure: ms_answers[component][question_number] = { "answer": str, "marks": int }
    ms_answers = {}
    
    with pdfplumber.open(path) as pdf:
        for (comp, ms_flag), pages in adjusted_pages.items():
            if not ms_flag:
                continue
            
            if comp not in ms_answers:
                ms_answers[comp] = {}
                
            for page_idx in pages:
                page = pdf.pages[page_idx]
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        # Clean row cell elements
                        clean_row = [str(cell).strip() if cell is not None else "" for cell in row]
                        clean_row = [cell for cell in clean_row if cell]
                        
                        # We expect a row structure like [Q_Num, Answer, Marks, Guidance]
                        # E.g. ['1', '130', '2', 'M1 for 180 ...'] or ['6(a)', 'Ring ...', '1']
                        if len(clean_row) >= 3:
                            q_num_raw = clean_row[0]
                            ans_text = clean_row[1]
                            marks_raw = clean_row[2]
                            
                            # Standardize question number (e.g. '6(a)' -> question '6')
                            base_q_num_match = re.match(r'^(\d+)', q_num_raw)
                            if base_q_num_match:
                                base_q_num = int(base_q_num_match.group(1))
                                if base_q_num not in ms_answers[comp]:
                                    ms_answers[comp][base_q_num] = []
                                    
                                ms_answers[comp][base_q_num].append({
                                    "part": q_num_raw,
                                    "answer": ans_text,
                                    "marks": marks_raw
                                })

    # 3. Process Question Papers and slice questions
    questions_extracted = []
    
    with pdfplumber.open(path) as pdf:
        for (comp, ms_flag), pages in adjusted_pages.items():
            if ms_flag:
                continue
                
            print(f"  Slicing Question Paper for component {comp}...")
            
            for page_idx in pages:
                page = pdf.pages[page_idx]
                words = page.extract_words()
                words.sort(key=lambda w: (w['top'], w['x0']))
                
                # Scan for question number starting coordinates
                q_markers = []
                for w in words:
                    text = w['text'].strip()
                    if text.isdigit() and 30 <= w['x0'] <= 70:
                        q_markers.append((int(text), w['top']))
                        
                if not q_markers:
                    continue
                    
                # Slice page horizontally by question markers
                slices = []
                for idx, (q_num, top) in enumerate(q_markers):
                    y_top = top - 10
                    if idx + 1 < len(q_markers):
                        y_bottom = q_markers[idx + 1][1] - 10
                    else:
                        y_bottom = 780 # Default footer margin
                        
                    slices.append((q_num, y_top, y_bottom))
                    
                # Process each slice
                for q_num, y0, y1 in slices:
                    # Get text in slice bounds
                    slice_words = [w['text'] for w in words if y0 <= w['top'] <= y1]
                    raw_q_text = ' '.join(slice_words)
                    q_text = clean_text_block(raw_q_text)
                    
                    if len(q_text) < 10:
                        continue
                        
                    # Extract marks count from brackets [ ]
                    marks = 1
                    marks_match = re.search(r'\[(\d+)\]\s*$', q_text)
                    if marks_match:
                        marks = int(marks_match.group(1))
                        
                    # Check for drawings (diagrams) inside slice
                    slice_drawings = []
                    for line in page.lines:
                        if y0 <= line['top'] <= y1 and y0 <= line['bottom'] <= y1:
                            # Filter out small underline answer lines
                            if line['x1'] - line['x0'] > 10:
                                slice_drawings.append(line)
                    for curve in page.curves:
                        if y0 <= curve['top'] <= y1 and y0 <= curve['bottom'] <= y1:
                            slice_drawings.append(curve)
                            
                    diagram_ref = ""
                    # If drawings form a large cluster, we crop them as a diagram!
                    if len(slice_drawings) >= 3:
                        x0s = [d['x0'] for d in slice_drawings]
                        x1s = [d['x1'] for d in slice_drawings]
                        y0s = [d['top'] for d in slice_drawings]
                        y1s = [d['bottom'] for d in slice_drawings]
                        
                        bbox = (min(x0s) - 15, min(y0s) - 15, max(x1s) + 15, max(y1s) + 15)
                        bbox = (max(10, bbox[0]), max(y0, bbox[1]), min(page.width - 10, bbox[2]), min(y1, bbox[3]))
                        
                        # Verify bounding box is large enough to be a diagram
                        if (bbox[2] - bbox[0]) > 40 and (bbox[3] - bbox[1]) > 40:
                            # Render cropped diagram
                            fitz_page = doc[page_idx]
                            rect = fitz.Rect(bbox[0], bbox[1], bbox[2], bbox[3])
                            pix = fitz_page.get_pixmap(clip=rect, dpi=150)
                            
                            safe_sess = comp.replace('/', '_')
                            diag_filename = f"diag_{year}_{safe_sess}_q{q_num}.jpg"
                            out_path = os.path.join(img_dir, diag_filename)
                            pix.save(out_path)
                            diagram_ref = f"\n\n[IMAGE: /images/math_0580/{diag_filename}]"
                            
                    # Match answers from Mark Scheme
                    answer_text = "See marking guide instructions."
                    if comp in ms_answers and q_num in ms_answers[comp]:
                        parts = ms_answers[comp][q_num]
                        ans_parts = []
                        for p in parts:
                            ans_parts.append(f"({p['part']}) {p['answer']}")
                        answer_text = '\n'.join(ans_parts)
                        
                    # Classify topic
                    topic, subtopic = classify_topic(q_text)
                    
                    # Determine difficulty
                    difficulty = "Medium"
                    if marks <= 2:
                        difficulty = "Easy"
                    elif marks > 5:
                        difficulty = "Hard"
                        
                    # Build record
                    safe_comp_sess = f"{comp} {year}"
                    q_id = f"MATH-0580-{year}-{comp.replace('/', '-')}-Q{q_num}"
                    
                    questions_extracted.append({
                        "id": q_id,
                        "subject": "Mathematics",
                        "topic": topic,
                        "subtopic": subtopic,
                        "year": year,
                        "source_paper": f"Paper {comp.split('/')[-1]} (Year {year})",
                        "source_type": "Past Paper",
                        "question_type": "Structured" if marks > 3 else "Short Answer",
                        "marks": marks,
                        "difficulty": difficulty,
                        "question_text": q_text + diagram_ref,
                        "answer_text": answer_text,
                        "status": "Final"
                    })
                    
    print(f"  Extracted {len(questions_extracted)} questions from {filename}.")
    return questions_extracted

def main():
    print("Starting Math 0580 Past Papers Extraction Pipeline...")
    
    # Scan downloads folder
    pdf_files = [f for f in os.listdir(igcse_dir) if f.endswith(".pdf") and f != "IGCSE-Math-0850-Syllabus.pdf"]
    pdf_files.sort(reverse=True) # Start from newest (2025) down to oldest
    
    # Connect to SQLite database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Ensure database table is initialized
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          subject TEXT NOT NULL,
          topic TEXT NOT NULL,
          subtopic TEXT,
          year INTEGER NOT NULL,
          source_paper TEXT,
          source_type TEXT NOT NULL,
          question_type TEXT NOT NULL,
          marks INTEGER NOT NULL,
          difficulty TEXT NOT NULL,
          question_text TEXT NOT NULL,
          answer_text TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Draft'
        )
    """)
    conn.commit()
    
    total_added = 0
    # Process files
    for filename in pdf_files:
        try:
            questions = parse_pdf_file(filename)
            
            # Insert into database
            inserted_count = 0
            for q in questions:
                try:
                    cursor.execute("""
                        INSERT OR REPLACE INTO questions 
                        (id, subject, topic, subtopic, year, source_paper, source_type, question_type, marks, difficulty, question_text, answer_text, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        q["id"], q["subject"], q["topic"], q["subtopic"], q["year"], q["source_paper"], 
                        q["source_type"], q["question_type"], q["marks"], q["difficulty"], 
                        q["question_text"], q["answer_text"], q["status"]
                    ))
                    inserted_count += 1
                except Exception as db_err:
                    print(f"    Failed to insert question {q['id']}: {db_err}")
            
            conn.commit()
            print(f"  Successfully imported {inserted_count} questions into the database.")
            total_added += inserted_count
            
        except Exception as file_err:
            print(f"Error parsing file {filename}: {file_err}")
            
    conn.close()
    print(f"\n==========================================")
    print(f"Import Complete! Successfully processed and seeded {total_added} Math 0580 questions into database.")
    print(f"==========================================")

if __name__ == "__main__":
    main()
