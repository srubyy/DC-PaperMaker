import fitz

pdf_path = "/Users/srutibaliga/Downloads/igcse math/2025-P2-ExtendedMath-0580.pdf"

try:
    doc = fitz.open(pdf_path)
    print(f"Total Pages: {len(doc)}")
    
    # Inspect first page
    print("--- PAGE 1 ---")
    print(doc[0].get_text()[:1000])
    
    # Inspect page 17 (after page 16, which is usually the end of a paper)
    print("--- PAGE 17 ---")
    print(doc[16].get_text()[:1000])
    
    # Let's inspect page 75 (first mark scheme shown in previous run)
    print("--- PAGE 75 ---")
    print(doc[74].get_text()[:1000])
    
except Exception as e:
    print(f"Error: {e}")
