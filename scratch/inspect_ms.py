import fitz

pdf_path = "/Users/srutibaliga/Downloads/igcse math/2025-P2-ExtendedMath-0580.pdf"

try:
    doc = fitz.open(pdf_path)
    print("=== INSPECTING MARK SCHEME PAGES 25 & 26 ===")
    for i in [24, 25]:
        page = doc[i]
        print(f"\n--- PAGE {i+1} ---")
        print(page.get_text())
except Exception as e:
    print(f"Error: {e}")
