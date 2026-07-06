import pdfplumber
import sys

pdf_path = "/Users/srutibaliga/Downloads/igcse math/2025-P2-ExtendedMath-0580.pdf"

try:
    with pdfplumber.open(pdf_path) as pdf:
        # Check page 26 (index 25)
        page = pdf.pages[25]
        print("=== EXTRACTING TABLES ===")
        tables = page.extract_tables()
        print(f"Number of tables found: {len(tables)}")
        for idx, table in enumerate(tables):
            print(f"\nTable {idx + 1}:")
            for row in table[:15]:  # Print first 15 rows
                print(row)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
