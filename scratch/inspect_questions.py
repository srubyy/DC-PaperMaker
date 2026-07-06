import fitz

pdf_path = "/Users/srutibaliga/Downloads/igcse math/2025-P2-ExtendedMath-0580.pdf"

try:
    doc = fitz.open(pdf_path)
    print("=== INSPECTING QUESTIONS ON PAGES 2-5 ===")
    for i in range(1, 5):
        page = doc[i]
        print(f"\n--- PAGE {i+1} ---")
        print(page.get_text())
except Exception as e:
    print(f"Error: {e}")
