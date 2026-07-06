import fitz
import os
import re

igcse_dir = "/Users/srutibaliga/Downloads/igcse math"

pdf_files = [f for f in os.listdir(igcse_dir) if f.endswith(".pdf") and f != "IGCSE-Math-0850-Syllabus.pdf"]
pdf_files.sort()

for filename in pdf_files:
    path = os.path.join(igcse_dir, filename)
    try:
        doc = fitz.open(path)
        print(f"\n==========================================")
        print(f"File: {filename} ({len(doc)} pages)")
        
        # Scan page text for components
        components = {}
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            
            # Look for paper codes like 0580/21, 0580/22, 0580/02
            paper_match = re.search(r'0580/(21|22|23|02|20|11|12|13)', text)
            ms_match = "MARK SCHEME" in text.upper() or "MAXIMUM MARK" in text.upper()
            
            if paper_match:
                paper_code = paper_match.group(0)
                # Look for session/year
                session = "Unknown"
                if "May/June" in text or "M/J" in text or "M/J" in filename:
                    session = "May/June"
                elif "October/November" in text or "O/N" in text or "O/N" in filename:
                    session = "Oct/Nov"
                elif "March" in text or "F/M" in text or "F/M" in filename:
                    session = "Feb/March"
                
                key = (paper_code, session)
                if key not in components:
                    components[key] = {"qp_pages": [], "ms_pages": []}
                
                if ms_match:
                    components[key]["ms_pages"].append(page_num + 1)
                else:
                    components[key]["qp_pages"].append(page_num + 1)
                    
        for (code, sess), ranges in components.items():
            qp = ranges["qp_pages"]
            ms = ranges["ms_pages"]
            qp_str = f"{min(qp)} - {max(qp)}" if qp else "None"
            ms_str = f"{min(ms)} - {max(ms)}" if ms else "None"
            print(f"  -> Component: {code} | Session: {sess} | QP Pages: [{qp_str}] | MS Pages: [{ms_str}]")
            
    except Exception as e:
        print(f"Error reading {filename}: {e}")
