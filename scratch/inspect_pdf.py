import fitz  # PyMuPDF
import sys

pdf_path = "/Users/srutibaliga/Downloads/igcse math/2025-P2-ExtendedMath-0580.pdf"

try:
    doc = fitz.open(pdf_path)
    print(f"File: 2025-P2-ExtendedMath-0580.pdf")
    print(f"Total Pages: {len(doc)}")
    
    # Print page headings and text snippets
    for i in range(len(doc)):
        page = doc[i]
        text = page.get_text()
        first_line = text.split('\n')[0] if text else "(empty)"
        # Search for core keywords
        keywords = []
        if "MARK SCHEME" in text.upper():
            keywords.append("MARK SCHEME")
        if "MATHEMATICS" in text.upper():
            keywords.append("MATHEMATICS")
        if "Cambridge IGCSE" in text:
            keywords.append("Cambridge IGCSE")
            
        print(f"Page {i+1:02d}: first line: '{first_line[:40]}' | keywords: {keywords}")
        
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
