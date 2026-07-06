import pdfplumber
import sys

pdf_path = "/Users/srutibaliga/Downloads/igcse math/2025-P2-ExtendedMath-0580.pdf"

try:
    with pdfplumber.open(pdf_path) as pdf:
        print("=== FINDING QUESTION NUMBERS AND COORDINATES ON PAGES 2-10 ===")
        for page_idx in range(1, 10):
            page = pdf.pages[page_idx]
            words = page.extract_words()
            words.sort(key=lambda w: (w['top'], w['x0']))
            print(f"\n--- Page {page_idx + 1} ---")
            for w in words:
                text = w['text'].strip()
                if text.isdigit() and 30 <= w['x0'] <= 70:
                    print(f"Question Number: {text} | x0: {w['x0']:.1f}, top: {w['top']:.1f}")
                
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
