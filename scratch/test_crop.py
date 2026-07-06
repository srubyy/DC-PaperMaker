import pdfplumber
import fitz
import os

pdf_path = "/Users/srutibaliga/Downloads/igcse math/2025-P2-ExtendedMath-0580.pdf"
img_dir = "/Users/srutibaliga/Documents/Projects/Paper/public/images/math_0580"
os.makedirs(img_dir, exist_ok=True)

try:
    # 1. Use pdfplumber to find slices
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[3]  # Page 4 (index 3)
        words = page.extract_words()
        words.sort(key=lambda w: (w['top'], w['x0']))
        
        # Find question numbers
        q_markers = []
        for w in words:
            text = w['text'].strip()
            if text.isdigit() and 30 <= w['x0'] <= 70:
                q_markers.append((int(text), w['top']))
                
        print(f"Detected questions on Page 4: {q_markers}")
        
        # Slices
        slices = []
        for idx, (q_num, top) in enumerate(q_markers):
            # Top boundary
            y_top = top - 10
            # Bottom boundary
            if idx + 1 < len(q_markers):
                y_bottom = q_markers[idx + 1][1] - 10
            else:
                y_bottom = 780  # Default footer boundary
                
            slices.append((q_num, y_top, y_bottom))
            
        # Inspect lines and curves in slices
        doc = fitz.open(pdf_path)
        fitz_page = doc[3]
        
        for q_num, y0, y1 in slices:
            # Find drawings (lines, rects, curves) in pdfplumber
            slice_drawings = []
            for line in page.lines:
                if y0 <= line['top'] <= y1 and y0 <= line['bottom'] <= y1:
                    slice_drawings.append(line)
            for curve in page.curves:
                if y0 <= curve['top'] <= y1 and y0 <= curve['bottom'] <= y1:
                    slice_drawings.append(curve)
                    
            print(f"Question {q_num}: Found {len(slice_drawings)} drawing elements")
            
            if slice_drawings:
                # Find bounding box of drawings
                x0s = [d['x0'] for d in slice_drawings]
                x1s = [d['x1'] for d in slice_drawings]
                y0s = [d['top'] for d in slice_drawings]
                y1s = [d['bottom'] for d in slice_drawings]
                
                bbox = (min(x0s) - 15, min(y0s) - 15, max(x1s) + 15, max(y1s) + 15)
                # Keep within bounds
                bbox = (max(10, bbox[0]), max(y0, bbox[1]), min(page.width - 10, bbox[2]), min(y1, bbox[3]))
                
                print(f"  Drawing Bounding Box: {bbox}")
                
                # Render using PyMuPDF Rect
                rect = fitz.Rect(bbox[0], bbox[1], bbox[2], bbox[3])
                pix = fitz_page.get_pixmap(clip=rect, dpi=150)
                out_path = os.path.join(img_dir, f"diag_2025_p23_q{q_num}.jpg")
                pix.save(out_path)
                print(f"  Saved diagram to: {out_path}")
                
except Exception as e:
    print(f"Error: {e}")
