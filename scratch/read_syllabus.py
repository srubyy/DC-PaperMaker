import fitz  # PyMuPDF
import sys

pdf_path = "/Users/srutibaliga/Downloads/igcse math/IGCSE-Math-0850-Syllabus.pdf"

try:
    doc = fitz.open(pdf_path)
    print(f"Syllabus opened successfully. Number of pages: {len(doc)}")
    
    # Search for syllabus content sections
    found = False
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        if "Syllabus content at a glance" in text or "Subject content" in text or "Topics" in text:
            print(f"--- Page {page_num + 1} ---")
            print(text[:2000])  # Print first 2000 chars of the page
            found = True
            
    if not found:
        # Just print first 3 pages
        for page_num in range(min(5, len(doc))):
            page = doc[page_num]
            print(f"--- Page {page_num + 1} ---")
            print(page.get_text()[:1500])
            
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
