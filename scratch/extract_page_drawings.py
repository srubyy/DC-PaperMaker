import pdfplumber
import sys

pdf_path = "/Users/srutibaliga/Downloads/igcse math/2025-P2-ExtendedMath-0580.pdf"

try:
    with pdfplumber.open(pdf_path) as pdf:
        # Check page 3 (index 2)
        page = pdf.pages[2]
        print(f"=== PAGE 3 OBJECTS ===")
        print(f"Width: {page.width}, Height: {page.height}")
        print(f"Number of Rects: {len(page.rects)}")
        print(f"Number of Lines: {len(page.lines)}")
        print(f"Number of Curves: {len(page.curves)}")
        print(f"Number of Images: {len(page.images)}")
        
        # If there are lines/rects, let's print their bounding boxes
        if page.lines:
            print("First 3 lines bounding boxes:")
            for line in page.lines[:3]:
                print(f"  x0: {line['x0']:.1f}, y0: {line['top']:.1f}, x1: {line['x1']:.1f}, y1: {line['bottom']:.1f}")
                
        # Let's inspect page 4 (index 3)
        page4 = pdf.pages[3]
        print(f"\n=== PAGE 4 OBJECTS ===")
        print(f"Number of Rects: {len(page4.rects)}")
        print(f"Number of Lines: {len(page4.lines)}")
        print(f"Number of Curves: {len(page4.curves)}")
        print(f"Number of Images: {len(page4.images)}")
        
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
