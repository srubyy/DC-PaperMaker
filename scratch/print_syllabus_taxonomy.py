import fitz
import re

pdf_path = "/Users/srutibaliga/Documents/igcse math/IGCSE-Math-0850-Syllabus.pdf"

try:
    doc = fitz.open(pdf_path)
    print(f"Syllabus Pages: {len(doc)}")
    
    # We will search for sections starting with E1.1, E2.1, etc.
    pattern = re.compile(r'(E\d+\.\d+)\s+([A-Za-z\s’]+)')
    
    taxonomy = {}
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        matches = pattern.findall(text)
        for code, title in matches:
            title_clean = title.strip().replace('\n', ' ')
            # Clean up trailing garbage
            title_clean = re.split(r'\s{2,}', title_clean)[0]
            if len(title_clean) > 3 and len(title_clean) < 60:
                taxonomy[code] = title_clean
                
    # Sort and print
    for code in sorted(taxonomy.keys()):
        print(f"{code}: {taxonomy[code]}")
        
except Exception as e:
    print(f"Error: {e}")
