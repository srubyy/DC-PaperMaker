import os
import re
import sqlite3
import pdfplumber
import fitz
from PIL import Image

# Path configuration
igcse_dir = "/Users/srutibaliga/Documents/igcse math"
db_path = "/Users/srutibaliga/Documents/Projects/Paper/questions.db"
img_dir = "/Users/srutibaliga/Documents/Projects/Paper/public/images/math_0580"
os.makedirs(img_dir, exist_ok=True)

def slice_and_save_image(fitz_pixmap, base_filename, slice_height=80):
    # Save pixmap to a temporary file
    temp_path = os.path.join(img_dir, f"temp_{base_filename}.jpg")
    fitz_pixmap.save(temp_path)
    
    # Open with PIL
    img = Image.open(temp_path)
    width, height = img.size
    
    parts = []
    y = 0
    part_idx = 0
    while y < height:
        h = min(slice_height, height - y)
        box = (0, y, width, y + h)
        part_img = img.crop(box)
        
        part_filename = f"{base_filename}_part{part_idx}.jpg"
        part_path = os.path.join(img_dir, part_filename)
        part_img.save(part_path, "JPEG", quality=90)
        
        parts.append(part_filename)
        y += h
        part_idx += 1
        
    # Clean up temp file
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    return parts

# Topics list
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

def get_subtopic(topic, text):
    text_lower = text.lower()
    
    if topic == "Number":
        if any(x in text_lower for x in ["factor", "prime", "hcf", "lcm", "integer", "square number", "cube number", "rational", "irrational", "reciprocal"]):
            return "E1.1: Types of number"
        elif any(x in text_lower for x in ["venn", "set", "intersection", "union"]):
            return "E1.2: Sets"
        elif any(x in text_lower for x in ["power", "root", "square root", "cube root"]):
            return "E1.3: Powers and roots"
        elif any(x in text_lower for x in ["fraction", "vulgar fraction"]):
            return "E1.4: Fractions"
        elif "order" in text_lower or "ascending" in text_lower or "descending" in text_lower:
            return "E1.5: Ordering"
        elif "standard form" in text_lower or "scientific notation" in text_lower:
            return "E1.8: Standard form"
        elif any(x in text_lower for x in ["bound", "accuracy", "limits of accuracy"]):
            return "E1.10: Limits of accuracy"
        elif any(x in text_lower for x in ["ratio", "proportion"]) or "ratio" in text_lower:
            return "E1.11: Ratio and proportion"
        elif any(x in text_lower for x in ["percentage", "interest", "compound"]):
            return "E1.13: Percentages"
        elif "time" in text_lower or "clock" in text_lower or "timetable" in text_lower:
            return "E1.15: Time"
        elif "money" in text_lower or "finance" in text_lower or "currency" in text_lower:
            return "E1.16: Money"
        else:
            return "E1.1: Types of number"
            
    elif topic == "Algebra and graphs":
        if any(x in text_lower for x in ["differentiate", "derivative", "dy/dx", "gradient of the curve", "stationary point", "turning point"]):
            return "E2.12: Differentiation"
        elif "sequence" in text_lower or "nth term" in text_lower:
            return "E2.7: Sequences"
        elif any(x in text_lower for x in ["function", "f(x)", "g(x)", "inverse"]):
            return "E2.13: Functions"
        elif any(x in text_lower for x in ["solve", "equation", "simultaneous", "quadratic"]):
            return "E2.5: Equations"
        elif any(x in text_lower for x in ["expand", "factorise", "simplify", "bracket"]):
            return "E2.2: Algebraic manipulation"
        elif "algebraic fraction" in text_lower:
            return "E2.3: Algebraic fractions"
        elif "inequality" in text_lower:
            return "E2.6: Inequalities"
        elif "index" in text_lower or "indices" in text_lower:
            return "E2.4: Indices II"
        else:
            return "E2.1: Introduction to algebra"
            
    elif topic == "Coordinate geometry":
        if "equation of" in text_lower or "y = mx" in text_lower or "line equation" in text_lower:
            return "E3.5: Equations of linear graphs"
        elif "perpendicular" in text_lower:
            return "E3.7: Perpendicular lines"
        elif "parallel" in text_lower:
            return "E3.6: Parallel lines"
        elif "gradient" in text_lower:
            return "E3.3: Gradient of linear graphs"
        elif "midpoint" in text_lower or "length" in text_lower:
            return "E3.4: Length and midpoint"
        else:
            return "E3.1: Coordinates"
            
    elif topic == "Geometry":
        if "angle" in text_lower:
            return "E4.6: Angles"
        elif "symmetry" in text_lower:
            return "E4.5: Symmetry"
        elif "congruent" in text_lower or "similarity" in text_lower or "similar" in text_lower:
            return "E4.4: Similarity"
        elif "circle theorem" in text_lower or "tangent to circle" in text_lower or "cyclic quad" in text_lower:
            return "E4.7: Circle theorems I"
        else:
            return "E4.1: Geometrical terms"
            
    elif topic == "Mensuration":
        if "area" in text_lower:
            return "E5.2: Area and perimeter"
        elif "volume" in text_lower:
            return "E5.5: Compound shapes and parts of shapes"
        elif "sector" in text_lower or "arc length" in text_lower or "circle" in text_lower:
            return "E5.3: Circles"
        else:
            return "E5.2: Area and perimeter"
            
    elif topic == "Trigonometry":
        if "pythagoras" in text_lower:
            return "E6.1: Pythagoras’ theorem"
        elif "exact value" in text_lower or "sin 30" in text_lower or "cos 45" in text_lower:
            return "E6.3: Exact trigonometric values"
        elif "graph of" in text_lower or "sine graph" in text_lower:
            return "E6.4: Trigonometric functions"
        elif "sine rule" in text_lower or "cosine rule" in text_lower or "bearing" in text_lower or "depression" in text_lower or "elevation" in text_lower:
            return "E6.5: Non-right-angled triangles"
        else:
            return "E6.2: Right-angled triangles (Trigonometry)"
            
    elif topic == "Transformations and vectors":
        if "vector" in text_lower or "magnitude" in text_lower:
            return "E7.2: Vectors in two dimensions"
        elif any(x in text_lower for x in ["reflection", "rotation", "enlargement", "translation"]):
            return "E7.1: Transformations"
        else:
            return "E7.2: Vectors in two dimensions"
            
    elif topic == "Probability":
        if "tree diagram" in text_lower or "combined events" in text_lower:
            return "E8.3: Probability of combined events"
        elif "conditional" in text_lower:
            return "E8.4: Conditional probability"
        else:
            return "E8.1: Introduction to probability"
            
    elif topic == "Statistics":
        if any(x in text_lower for x in ["mean", "median", "mode", "quartile", "spread"]):
            return "E9.3: Averages and measures of spread"
        elif "scatter" in text_lower:
            return "E9.5: Scatter diagrams"
        elif "cumulative frequency" in text_lower:
            return "E9.6: Cumulative frequency diagrams"
        elif "histogram" in text_lower or "density" in text_lower:
            return "E9.7: Histograms"
        else:
            return "E9.4: Statistical charts and diagrams"
            
    return "E1.1: Types of number"

def classify_topic(text):
    scores = {topic: 0 for topic in TOPIC_KEYWORDS}
    text_lower = text.lower()
    for topic, keywords in TOPIC_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[topic] += 1
                
    best_topic = max(scores, key=scores.get)
    if scores[best_topic] == 0:
        return "Number", "E1.1: Types of number"
        
    subtopic = get_subtopic(best_topic, text)
    return best_topic, subtopic

def parse_pdf_file(filename):
    path = os.path.join(igcse_dir, filename)
    year_match = re.search(r'20\d{2}', filename)
    year = int(year_match.group(0)) if year_match else 2025
    
    print(f"\nProcessing file: {filename} (Year: {year})...")
    
    doc = fitz.open(path)
    
    # 1. Segment pages into QP and MS per component variant
    adjusted_pages = {}
    last_comp = "0580/22"
    in_ms = False
    
    for idx in range(len(doc)):
        page = doc[idx]
        text = page.get_text()
        
        is_qp_cover = "Cambridge IGCSE" in text and "MATHEMATICS" in text and "MARK SCHEME" not in text.upper()
        is_ms_cover = "MARK SCHEME" in text.upper() or "MAXIMUM MARK" in text.upper()
        
        comp_match = re.search(r'0580/(21|22|23|02)', text)
        if comp_match:
            last_comp = comp_match.group(0)
            if last_comp == "0580/02":
                last_comp = "0580/22"
            
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
        
    # 2. Extract row vertical bounds for each question in the MS
    # Dict structure: ms_coords[comp][base_q_num] = (page_idx, y0, y1)
    ms_coords = {}
    
    with pdfplumber.open(path) as pdf:
        for (comp, ms_flag), pages in adjusted_pages.items():
            if not ms_flag:
                continue
                
            if comp not in ms_coords:
                ms_coords[comp] = {}
                
            for page_idx in pages:
                page = pdf.pages[page_idx]
                tables = page.find_tables()
                for table in tables:
                    for r in table.rows:
                        valid_cells = [c for c in r.cells if c is not None]
                        if not valid_cells:
                            continue
                            
                        # Extract first cell text to identify question number
                        q_num_cell = r.cells[0]
                        if q_num_cell is None:
                            continue
                            
                        q_num_text = page.crop(q_num_cell).extract_text()
                        if not q_num_text:
                            continue
                            
                        q_num_clean = q_num_text.strip().replace('\n', ' ')
                        base_q_match = re.match(r'^(\d+)', q_num_clean)
                        if base_q_match:
                            base_q = int(base_q_match.group(1))
                            y0 = min(c[1] for c in valid_cells)
                            y1 = max(c[3] for c in valid_cells)
                            
                            # Exclude first column (question number) by reading its right boundary
                            first_cell = r.cells[0]
                            first_cell_right = 109
                            if first_cell is not None and len(first_cell) >= 3:
                                first_cell_right = first_cell[2]
                            
                            if base_q not in ms_coords[comp]:
                                ms_coords[comp][base_q] = []
                            ms_coords[comp][base_q].append((page_idx, y0, y1, first_cell_right))

    # Clean and consolidate MS crop bounds per question
    consolidated_ms = {}
    for comp, q_dict in ms_coords.items():
        consolidated_ms[comp] = {}
        for base_q, coords_list in q_dict.items():
            # Group by page_idx in case split, but usually it's on one page
            page_idx = coords_list[0][0]
            y0_min = min(y0 for p, y0, y1, x0_c in coords_list)
            y1_max = max(y1 for p, y0, y1, x0_c in coords_list)
            x0_max = max(x0_c for p, y0, y1, x0_c in coords_list)
            consolidated_ms[comp][base_q] = (page_idx, y0_min, y1_max, x0_max)

    # 3. Process Question Papers and slice visual questions
    questions_extracted = []
    
    with pdfplumber.open(path) as pdf:
        for (comp, ms_flag), pages in adjusted_pages.items():
            if ms_flag:
                continue
                
            safe_comp = comp.replace('/', '_')
            print(f"  Slicing Question Paper for component {comp}...")
            
            for page_idx in pages:
                page = pdf.pages[page_idx]
                words = page.extract_words()
                words.sort(key=lambda w: (w['top'], w['x0']))
                
                # Scan for question numbers starting coordinates
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
                    y_top = top - 12
                    if idx + 1 < len(q_markers):
                        y_bottom = q_markers[idx + 1][1] - 12
                    else:
                        y_bottom = 740  # Default footer boundary
                        
                    slices.append((q_num, y_top, y_bottom))
                    
                # Process each slice
                for q_num, y0, y1 in slices:
                    # Get plain text within boundary to extract marks and classify topic
                    slice_words = [w['text'] for w in words if y0 <= w['top'] <= y1]
                    raw_q_text = ' '.join(slice_words)
                    
                    if len(raw_q_text.strip()) < 5:
                        continue
                        
                    # Extract marks
                    marks = 1
                    marks_match = re.search(r'\[(\d+)\]\s*$', raw_q_text)
                    if marks_match:
                        marks = int(marks_match.group(1))
                        
                    # 1. CROP QUESTION SLICE IMAGE
                    fitz_page = doc[page_idx]
                    # Page width constraint: crop inside page frame borders (x=42 to 553) to exclude outer border lines but keep full diagrams/text
                    rect_q = fitz.Rect(42, max(52, y0), 553, min(738, y1))
                    pix_q = fitz_page.get_pixmap(clip=rect_q, dpi=150)
                    
                    # Slice the QP image into 80px high horizontal strips for dynamic page breaks
                    base_q_name = f"q_{year}_{safe_comp}_q{q_num}"
                    q_parts = slice_and_save_image(pix_q, base_q_name, slice_height=80)
                    question_html = "".join([f"[IMAGE: /images/math_0580/{p}]" for p in q_parts])
                    
                    # 2. CROP MS ANSWER SLICE IMAGE
                    answer_html = "See marking guide instructions."
                    if comp in consolidated_ms and q_num in consolidated_ms[comp]:
                        ms_page_idx, ms_y0, ms_y1, ms_x0 = consolidated_ms[comp][q_num]
                        fitz_ms_page = doc[ms_page_idx]
                        
                        # Crop from ms_x0+1 to 535 to capture columns 2,3,4 inside the table border (excluding column 1 and right frame line)
                        rect_ms = fitz.Rect(ms_x0 + 1, max(52, ms_y0 - 2), 535, min(750, ms_y1 + 2))
                        pix_ms = fitz_ms_page.get_pixmap(clip=rect_ms, dpi=150)
                        
                        # Slice the MS image into 80px high horizontal strips for dynamic page breaks
                        base_ms_name = f"ms_{year}_{safe_comp}_q{q_num}"
                        ms_parts = slice_and_save_image(pix_ms, base_ms_name, slice_height=80)
                        answer_html = "".join([f"[IMAGE: /images/math_0580/{p}]" for p in ms_parts])
                        
                    # Classify topic
                    topic, subtopic = classify_topic(raw_q_text)
                    
                    # Determine difficulty
                    difficulty = "Medium"
                    if marks <= 2:
                        difficulty = "Easy"
                    elif marks >= 5:
                        difficulty = "Hard"
                        
                    # Construct unique question ID
                    question_id = f"MATH-0580-{year}-ON-{safe_comp.split('_')[-1]}-Q{q_num}"
                    
                    questions_extracted.append({
                        "id": question_id,
                        "subject": "Mathematics",
                        "topic": topic,
                        "subtopic": subtopic,
                        "year": year,
                        "source_paper": f"Paper 2{safe_comp.split('_')[-1]} (Year {year})",
                        "marks": marks,
                        "difficulty": difficulty,
                        "question_text": question_html,
                        "answer_text": answer_html,
                        "status": "Final"
                    })
                    
    return questions_extracted

def main():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Clean previous Mathematics questions
    print("Clearing old math questions from database...")
    cursor.execute("DELETE FROM questions WHERE subject = 'Mathematics'")
    conn.commit()
    
    # Process all PDF files in Documents directory
    pdf_files = [f for f in os.listdir(igcse_dir) if f.endswith('.pdf') and 'Syllabus' not in f]
    pdf_files.sort(reverse=True) # Start from 2025 down to 2009
    
    all_questions = []
    for file in pdf_files:
        try:
            questions = parse_pdf_file(file)
            all_questions.extend(questions)
            print(f"  Extracted {len(questions)} questions.")
        except Exception as e:
            print(f"  Error parsing {file}: {e}")
            
    # Deduplicate questions by ID
    seen_ids = set()
    dedup_questions = []
    for q in all_questions:
        if q["id"] not in seen_ids:
            seen_ids.add(q["id"])
            dedup_questions.append(q)
        else:
            print(f"Skipping duplicate question ID: {q['id']}")
    all_questions = dedup_questions

    # Insert new visual questions in one transaction
    print(f"\nSeeding {len(all_questions)} high-fidelity visual questions into SQLite database...")
    for q in all_questions:
        cursor.execute("""
            INSERT INTO questions (id, subject, topic, subtopic, year, source_paper, source_type, question_type, marks, difficulty, question_text, answer_text, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            q["id"], q["subject"], q["topic"], q["subtopic"], q["year"], 
            q["source_paper"], "Past Paper", "Short Answer", q["marks"], q["difficulty"], 
            q["question_text"], q["answer_text"], q["status"]
        ))
        
    conn.commit()
    conn.close()
    print(f"\n==========================================")
    print(f"Success! Imported {len(all_questions)} Mathematics questions with paired question/MS image slices.")
    print(f"==========================================")

if __name__ == "__main__":
    main()
