import pdfplumber

pdf_path = "/Users/srutibaliga/Documents/igcse math/2025-P2-ExtendedMath-0580.pdf"

try:
    with pdfplumber.open(pdf_path) as pdf:
        for idx, page in enumerate(pdf.pages):
            text = page.extract_text()
            if "MARK SCHEME" in text or "MAXIMUM MARK" in text:
                tables = page.find_tables()
                if not tables:
                    continue
                print(f"MS Page Index: {idx}")
                for t_idx, t in enumerate(tables):
                    print(f"Table {t_idx} bbox: {t.bbox}")
                    for r_idx, r in enumerate(t.rows):
                        valid_cells = [c for c in r.cells if c is not None]
                        y0s = [c[1] for c in valid_cells]
                        y1s = [c[3] for c in valid_cells]
                        y_range = (min(y0s), max(y1s)) if y0s else (0,0)
                        
                        cells_text = []
                        for cell in r.cells:
                            if cell is not None:
                                text_crop = page.crop(cell).extract_text()
                                cells_text.append(text_crop.strip().replace('\n', ' ') if text_crop else "")
                            else:
                                cells_text.append("")
                                
                        print(f"  Row {r_idx} y_range {y_range}: {cells_text}")
                break
except Exception as e:
    print(f"Error: {e}")
