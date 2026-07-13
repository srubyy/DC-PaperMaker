import sqlite3
import re

db_path = "/Users/srutibaliga/Documents/Projects/Paper/questions.db"

def get_subtopic(topic, subtopic_old, text):
    text_lower = text.lower()
    
    if topic == "Number":
        if subtopic_old in ["Factor", "Prime"] or any(x in text_lower for x in ["factor", "prime", "hcf", "lcm", "integer", "square number", "cube number", "rational", "irrational", "reciprocal"]):
            return "E1.1: Types of number"
        elif subtopic_old in ["Venn", "Set"] or any(x in text_lower for x in ["venn", "set", "intersection", "union"]):
            return "E1.2: Sets"
        elif any(x in text_lower for x in ["power", "root", "square root", "cube root"]):
            return "E1.3: Powers and roots"
        elif any(x in text_lower for x in ["fraction", "vulgar fraction"]):
            return "E1.4: Fractions"
        elif "order" in text_lower or "ascending" in text_lower or "descending" in text_lower:
            return "E1.5: Ordering"
        elif subtopic_old == "Standard form" or "standard form" in text_lower or "scientific notation" in text_lower:
            return "E1.8: Standard form"
        elif subtopic_old in ["Upper bound", "Lower bound"] or any(x in text_lower for x in ["bound", "accuracy", "limits of accuracy"]):
            return "E1.10: Limits of accuracy"
        elif subtopic_old in ["Ratio", "Proportion"] or "ratio" in text_lower:
            return "E1.11: Ratio and proportion"
        elif subtopic_old in ["Compound interest", "Percentage"] or any(x in text_lower for x in ["percentage", "interest", "compound"]):
            return "E1.13: Percentages"
        elif "time" in text_lower or "clock" in text_lower or "timetable" in text_lower:
            return "E1.15: Time"
        elif "money" in text_lower or "finance" in text_lower or "currency" in text_lower:
            return "E1.16: Money"
        else:
            return "E1.1: Types of number" # Default fallback
            
    elif topic == "Algebra and graphs":
        if any(x in text_lower for x in ["differentiate", "derivative", "dy/dx", "gradient of the curve", "stationary point", "turning point"]):
            return "E2.12: Differentiation"
        elif subtopic_old == "Sequence" or "sequence" in text_lower or "nth term" in text_lower:
            return "E2.7: Sequences"
        elif subtopic_old in ["Function", "F(x)"] or any(x in text_lower for x in ["function", "f(x)", "g(x)", "inverse"]):
            return "E2.13: Functions"
        elif subtopic_old == "Equation" or any(x in text_lower for x in ["solve", "equation", "simultaneous", "quadratic"]):
            return "E2.5: Equations"
        elif subtopic_old == "Expand" or any(x in text_lower for x in ["expand", "factorise", "simplify", "bracket"]):
            return "E2.2: Algebraic manipulation"
        elif subtopic_old == "Algebraic fraction" or "algebraic fraction" in text_lower:
            return "E2.3: Algebraic fractions"
        elif subtopic_old == "Inequality" or "inequality" in text_lower:
            return "E2.6: Inequalities"
        elif "index" in text_lower or "indices" in text_lower:
            return "E2.4: Indices II"
        else:
            return "E2.1: Introduction to algebra"
            
    elif topic == "Coordinate geometry":
        if "equation of" in text_lower or "y = mx" in text_lower or "line equation" in text_lower:
            return "E3.5: Equations of linear graphs"
        elif "perpendicular" in text_lower:
            return "E3.7: Perpendicular lines"
        elif "parallel" in text_lower:
            return "E3.6: Parallel lines"
        elif "gradient" in text_lower:
            return "E3.3: Gradient of linear graphs"
        elif "midpoint" in text_lower or "length" in text_lower:
            return "E3.4: Length and midpoint"
        else:
            return "E3.1: Coordinates"
            
    elif topic == "Geometry":
        if subtopic_old == "Angle" or "angle" in text_lower:
            return "E4.6: Angles"
        elif subtopic_old == "Symmetry" or "symmetry" in text_lower:
            return "E4.5: Symmetry"
        elif subtopic_old == "Congruent" or "congruent" in text_lower or "similarity" in text_lower or "similar" in text_lower:
            return "E4.4: Similarity"
        elif "circle theorem" in text_lower or "tangent to circle" in text_lower or "cyclic quad" in text_lower:
            return "E4.7: Circle theorems I"
        else:
            return "E4.1: Geometrical terms"
            
    elif topic == "Mensuration":
        if subtopic_old == "Area" or "area" in text_lower:
            return "E5.2: Area and perimeter"
        elif subtopic_old == "Volume" or "volume" in text_lower:
            return "E5.5: Compound shapes and parts of shapes"
        elif subtopic_old == "Sector" or "sector" in text_lower or "arc length" in text_lower or "circle" in text_lower:
            return "E5.3: Circles"
        else:
            return "E5.2: Area and perimeter"
            
    elif topic == "Trigonometry":
        if "pythagoras" in text_lower:
            return "E6.1: Pythagoras’ theorem"
        elif "exact value" in text_lower or "sin 30" in text_lower or "cos 45" in text_lower:
            return "E6.3: Exact trigonometric values"
        elif "graph of" in text_lower or "sine graph" in text_lower:
            return "E6.4: Trigonometric functions"
        elif "sine rule" in text_lower or "cosine rule" in text_lower or "bearing" in text_lower or "depression" in text_lower or "elevation" in text_lower:
            return "E6.5: Non-right-angled triangles"
        else:
            return "E6.2: Right-angled triangles (Trigonometry)"
            
    elif topic == "Transformations and vectors":
        if subtopic_old == "Vector" or "vector" in text_lower or "magnitude" in text_lower:
            return "E7.2: Vectors in two dimensions"
        elif subtopic_old in ["Reflection", "Translation"] or any(x in text_lower for x in ["reflection", "rotation", "enlargement", "translation"]):
            return "E7.1: Transformations"
        else:
            return "E7.2: Vectors in two dimensions"
            
    elif topic == "Probability":
        if "tree diagram" in text_lower or "combined events" in text_lower:
            return "E8.3: Probability of combined events"
        elif "conditional" in text_lower:
            return "E8.4: Conditional probability"
        else:
            return "E8.1: Introduction to probability"
            
    elif topic == "Statistics":
        if subtopic_old in ["Range", "Median", "Mean"] or any(x in text_lower for x in ["mean", "median", "mode", "quartile", "spread"]):
            return "E9.3: Averages and measures of spread"
        elif subtopic_old in ["Correlation", "Scatter diagram"] or "scatter" in text_lower:
            return "E9.5: Scatter diagrams"
        elif "cumulative frequency" in text_lower:
            return "E9.6: Cumulative frequency diagrams"
        elif "histogram" in text_lower or "density" in text_lower:
            return "E9.7: Histograms"
        else:
            return "E9.4: Statistical charts and diagrams"
            
    return subtopic_old

def main():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all math questions
    cursor.execute("SELECT id, topic, subtopic, question_text FROM questions WHERE subject = 'Mathematics'")
    rows = cursor.fetchall()
    print(f"Total Math questions to update: {len(rows)}")
    
    updated = 0
    for q_id, topic, subtopic_old, q_text in rows:
        new_subtopic = get_subtopic(topic, subtopic_old, q_text)
        if new_subtopic != subtopic_old:
            cursor.execute("UPDATE questions SET subtopic = ? WHERE id = ?", (new_subtopic, q_id))
            updated += 1
            
    conn.commit()
    conn.close()
    print(f"Seeded and updated {updated} questions with detailed syllabus subtopic classifications.")

if __name__ == "__main__":
    main()
