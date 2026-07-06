import { initDb } from './db.js';

const mockQuestions = [
  // CHEMISTRY - Chemical Bonding
  {
    id: "CHEM-CB-0001",
    subject: "Chemistry",
    topic: "Chemical Bonding",
    subtopic: "Covalent Bonding",
    year: 2023,
    source_paper: "Paper 1 Var 2",
    source_type: "Past Paper",
    question_type: "Short Answer",
    marks: 5,
    difficulty: "Medium",
    question_text: "Explain the formation of a covalent bond in a carbon dioxide (CO2) molecule. Describe the sharing of valence electrons.",
    answer_text: "1. Carbon has 4 valence electrons and Oxygen has 6 valence electrons.\n2. In CO2, the central Carbon atom shares two pairs of electrons with each of the two Oxygen atoms.\n3. This results in the formation of two double covalent bonds (O=C=O).\n4. All three atoms achieve a stable octet (8 valence electrons) electronic configuration.",
    status: "Final"
  },
  {
    id: "CHEM-CB-0002",
    subject: "Chemistry",
    topic: "Chemical Bonding",
    subtopic: "Molecular Geometry",
    year: 2024,
    source_paper: "Paper 2 Var 1",
    source_type: "Past Paper",
    question_type: "Short Answer",
    marks: 2,
    difficulty: "Easy",
    question_text: "State the molecular shape and the approximate bond angle of a water (H2O) molecule.",
    answer_text: "1. Shape: Bent / V-shaped / Angular.\n2. Bond Angle: Approximately 104.5° (accept 104°-105°).\n3. Reason: Repulsion of two lone pairs on the central oxygen atom compresses the bond angle.",
    status: "Final"
  },
  {
    id: "CHEM-CB-0003",
    subject: "Chemistry",
    topic: "Chemical Bonding",
    subtopic: "Allotropes of Carbon",
    year: 2024,
    source_paper: "Mock Exam A",
    source_type: "Original",
    question_type: "Structured",
    marks: 6,
    difficulty: "Hard",
    question_text: "Compare the structure and bonding in diamond and graphite. Explain why graphite is electrical conductive whereas diamond is an insulator.",
    answer_text: "1. Diamond: Giant covalent structure. Each Carbon is tetrahedrally bonded to 4 other Carbons. Strong covalent bonds throughout. No free electrons.\n2. Graphite: Layered hexagonal structure. Each Carbon is bonded to 3 other Carbons in planar sheets. Weak van der Waals forces between layers.\n3. Conductivity: In graphite, the 4th valence electron is delocalized and free to move along layers. In diamond, all valence electrons are localized in single covalent bonds.",
    status: "Final"
  },
  {
    id: "CHEM-CB-0004",
    subject: "Chemistry",
    topic: "Chemical Bonding",
    subtopic: "Ionic Bonding",
    year: 2025,
    source_paper: "Paper 1 Var 1",
    source_type: "Past Paper",
    question_type: "MCQ",
    marks: 1,
    difficulty: "Easy",
    question_text: "Which of the following substances has a giant ionic lattice structure?\n\nA. Carbon Dioxide\nB. Sodium Chloride\nC. Water\nD. Methane",
    answer_text: "Correct Option: B\nExplanation: Sodium Chloride (NaCl) consists of sodium cations and chloride anions held together in a giant 3D lattice by strong electrostatic forces of attraction (ionic bonds). Methane, water, and CO2 are simple molecular substances.",
    status: "Final"
  },

  // CHEMISTRY - Organic Chemistry
  {
    id: "CHEM-OC-0001",
    subject: "Chemistry",
    topic: "Organic Chemistry",
    subtopic: "Functional Groups",
    year: 2023,
    source_paper: "Paper 2 Var 2",
    source_type: "Past Paper",
    question_type: "Short Answer",
    marks: 4,
    difficulty: "Medium",
    question_text: "Define the term 'homologous series' and list two characteristics of organic compounds belonging to the same series.",
    answer_text: "Definition: A family of organic compounds with the same functional group and similar chemical properties.\nCharacteristics (any two):\n- Represented by a general formula.\n- Consecutive members differ by a -CH2- group.\n- Gradual variation in physical properties (e.g., boiling point).\n- Similar chemical properties.",
    status: "Final"
  },
  {
    id: "CHEM-OC-0002",
    subject: "Chemistry",
    topic: "Organic Chemistry",
    subtopic: "Reaction Mechanisms",
    year: 2024,
    source_paper: "Paper 3 Var 1",
    source_type: "Past Paper",
    question_type: "Structured",
    marks: 5,
    difficulty: "Hard",
    question_text: "Describe the mechanism of nucleophilic substitution of bromoethane with warm aqueous NaOH (SN2 mechanism). Include curly arrows showing electron movement.",
    answer_text: "1. The hydroxide ion (OH-) acts as a nucleophile, attacking the delta-positive carbon atom from the side opposite to the leaving bromine atom.\n2. Curly arrow starts from a lone pair on oxygen of OH- and points to the C bonded to Br.\n3. Curly arrow starts from the C-Br bond and points to the Br atom.\n4. A transition state forms where the C-OH bond is partially forming and C-Br bond is partially breaking.\n5. The C-Br bond breaks heterolytically to yield ethanol and a bromide ion.",
    status: "Final"
  },
  {
    id: "CHEM-OC-0003",
    subject: "Chemistry",
    topic: "Organic Chemistry",
    subtopic: "Isomerism",
    year: 2025,
    source_paper: "Mock Exam B",
    source_type: "Original",
    question_type: "Essay",
    marks: 8,
    difficulty: "Hard",
    question_text: "Explain the difference between structural isomerism and stereoisomerism. Illustrate your answer by drawing and naming the isomers of butene (C4H8).",
    answer_text: "1. Structural Isomerism: Compounds with the same molecular formula but different structural arrangements.\n2. Stereoisomerism: Compounds with the same structural formula but different spatial arrangement of atoms.\n3. Isomers of C4H8:\n   - But-1-ene (structural isomer)\n   - But-2-ene (which shows stereoisomerism/cis-trans isomerism):\n     - cis-but-2-ene (both methyl groups on the same side of C=C)\n     - trans-but-2-ene (methyl groups on opposite sides of C=C)\n   - Methylpropene (structural branched isomer)",
    status: "Reviewed"
  },

  // CHEMISTRY - Stoichiometry
  {
    id: "CHEM-ST-0001",
    subject: "Chemistry",
    topic: "Stoichiometry",
    subtopic: "Thermal Decomposition",
    year: 2022,
    source_paper: "Paper 4 Var 1",
    source_type: "Past Paper",
    question_type: "Structured",
    marks: 3,
    difficulty: "Medium",
    question_text: "When copper(II) carbonate (CuCO3) is heated, it decomposes to form copper(II) oxide (CuO) and carbon dioxide (CO2). Calculate the mass of CuO formed by the complete decomposition of 12.35 g of CuCO3. [Molar masses: CuCO3 = 123.5 g/mol, CuO = 79.5 g/mol]",
    answer_text: "1. Equation: CuCO3 -> CuO + CO2\n2. Moles of CuCO3 = mass / Mr = 12.35 / 123.5 = 0.10 mol.\n3. Reaction ratio is 1:1, so moles of CuO formed = 0.10 mol.\n4. Mass of CuO = moles * Mr = 0.10 * 79.5 = 7.95 g.",
    status: "Final"
  },

  // PHYSICS - Mechanics
  {
    id: "PHYS-ME-0001",
    subject: "Physics",
    topic: "Mechanics",
    subtopic: "Kinematics",
    year: 2023,
    source_paper: "Paper 1 Var 1",
    source_type: "Past Paper",
    question_type: "Short Answer",
    marks: 4,
    difficulty: "Easy",
    question_text: "Differentiate between scalar and vector quantities. Classify speed and velocity into their correct categories.",
    answer_text: "1. Scalar quantity has magnitude only. Vector quantity has both magnitude and direction.\n2. Speed is a scalar quantity.\n3. Velocity is a vector quantity (displacement per unit time in a specific direction).",
    status: "Final"
  },
  {
    id: "PHYS-ME-0002",
    subject: "Physics",
    topic: "Mechanics",
    subtopic: "Equations of Motion",
    year: 2024,
    source_paper: "Paper 2 Var 2",
    source_type: "Past Paper",
    question_type: "Structured",
    marks: 5,
    difficulty: "Medium",
    question_text: "A stone is dropped from rest from the top of a cliff and falls freely under gravity. It takes 3.0 seconds to hit the ground. Calculate the height of the cliff. [Assume acceleration of free fall g = 9.81 m/s^2, ignore air resistance]",
    answer_text: "1. Use formula: s = ut + 0.5 * a * t^2\n2. Since dropped from rest, initial velocity u = 0.\n3. s = 0 + 0.5 * 9.81 * (3.0)^2\n4. s = 0.5 * 9.81 * 9 = 44.1 meters (accept 44.15m or 44m).",
    status: "Final"
  },
  {
    id: "PHYS-ME-0003",
    subject: "Physics",
    topic: "Mechanics",
    subtopic: "Newton's Laws",
    year: 2025,
    source_paper: "Mock Exam A",
    source_type: "Original",
    question_type: "Structured",
    marks: 4,
    difficulty: "Medium",
    question_text: "State Newton's Second Law of Motion. A force of 15 N is applied to a mass of 3.0 kg. Calculate the acceleration produced.",
    answer_text: "1. Statement: The rate of change of momentum of an object is directly proportional to the resultant force and acts in the direction of the force. (or Resultant Force = Mass * Acceleration).\n2. Formula: F = ma => a = F / m\n3. Calculation: a = 15 / 3.0 = 5.0 m/s^2.",
    status: "Final"
  },

  // PHYSICS - Electricity & Magnetism
  {
    id: "PHYS-EM-0001",
    subject: "Physics",
    topic: "Electricity & Magnetism",
    subtopic: "Ohm's Law",
    year: 2023,
    source_paper: "Paper 3 Var 2",
    source_type: "Past Paper",
    question_type: "Short Answer",
    marks: 3,
    difficulty: "Easy",
    question_text: "State Ohm's law and sketch a typical current-voltage (I-V) characteristic graph for a filament lamp.",
    answer_text: "1. Ohm's Law: The current through a conductor is directly proportional to the potential difference across it, provided temperature and other physical conditions remain constant.\n2. Graph description: An S-shaped curve passing through the origin. Resistance increases at higher currents due to heating of the filament.",
    status: "Final"
  },
  {
    id: "PHYS-EM-0002",
    subject: "Physics",
    topic: "Electricity & Magnetism",
    subtopic: "Electromagnetic Induction",
    year: 2024,
    source_paper: "Paper 4 Var 1",
    source_type: "Past Paper",
    question_type: "Structured",
    marks: 6,
    difficulty: "Hard",
    question_text: "State Faraday's law of electromagnetic induction. Explain how Lenz's law represents the conservation of energy.",
    answer_text: "1. Faraday's Law: The magnitude of the induced electromotive force (emf) is directly proportional to the rate of change of magnetic flux linkage.\n2. Lenz's Law: The direction of the induced current is such that it opposes the change in magnetic flux that produced it.\n3. Conservation of energy: Work must be done against this opposing magnetic force to generate electrical energy. If it did not oppose, we would create electrical energy from nothing, violating the law of conservation of energy.",
    status: "Final"
  },

  // PHYSICS - Waves
  {
    id: "PHYS-WA-0001",
    subject: "Physics",
    topic: "Waves",
    subtopic: "Wave Properties",
    year: 2022,
    source_paper: "Paper 1 Var 1",
    source_type: "Past Paper",
    question_type: "MCQ",
    marks: 1,
    difficulty: "Easy",
    question_text: "Which of the following is a longitudinal wave?\n\nA. Radio Wave\nB. Light Wave\nC. Sound Wave\nD. X-Ray",
    answer_text: "Correct Option: C\nExplanation: Sound waves are longitudinal waves, where the particles of the medium oscillate parallel to the direction of wave propagation. Radio, light, and X-rays are electromagnetic waves, which are transverse.",
    status: "Final"
  },

  // BIOLOGY - Cell Biology
  {
    id: "BIOL-CB-0001",
    subject: "Biology",
    topic: "Cell Biology",
    subtopic: "Cell Organelles",
    year: 2023,
    source_paper: "Paper 1 Var 1",
    source_type: "Past Paper",
    question_type: "Short Answer",
    marks: 4,
    difficulty: "Easy",
    question_text: "List three structural differences between animal cells and plant cells.",
    answer_text: "1. Cell Wall: Present in plant cells (made of cellulose), absent in animal cells.\n2. Chloroplasts: Present in green plant cells, absent in animal cells.\n3. Vacuole: Large permanent central vacuole in plant cells, only small temporary vacuoles in animal cells (if any).",
    status: "Final"
  },
  {
    id: "BIOL-CB-0002",
    subject: "Biology",
    topic: "Cell Biology",
    subtopic: "Membrane Transport",
    year: 2024,
    source_paper: "Paper 2 Var 1",
    source_type: "Past Paper",
    question_type: "Structured",
    marks: 5,
    difficulty: "Medium",
    question_text: "Describe the process of active transport. Give one example of active transport in human physiology.",
    answer_text: "1. Active transport is the movement of particles from a region of lower concentration to a region of higher concentration (against the concentration gradient).\n2. It requires energy in the form of ATP.\n3. It involves specific carrier proteins in the cell membrane.\n4. Example: Absorption of glucose in the small intestine, or sodium-potassium pump in neurons.",
    status: "Final"
  },

  // BIOLOGY - Genetics
  {
    id: "BIOL-GE-0001",
    subject: "Biology",
    topic: "Genetics",
    subtopic: "DNA Structure",
    year: 2023,
    source_paper: "Paper 3 Var 1",
    source_type: "Past Paper",
    question_type: "Structured",
    marks: 6,
    difficulty: "Hard",
    question_text: "Describe the structure of DNA. Explain the complementary base pairing rule.",
    answer_text: "1. DNA is a double helix composed of two polynucleotide strands running antiparallel to each other.\n2. The backbone is made of alternating sugar (deoxyribose) and phosphate groups.\n3. The strands are linked by nitrogenous bases held together by hydrogen bonds.\n4. Base pairing rule: Adenine (A) always pairs with Thymine (T) (2 hydrogen bonds), and Cytosine (C) always pairs with Guanine (G) (3 hydrogen bonds).",
    status: "Final"
  },
  {
    id: "BIOL-GE-0002",
    subject: "Biology",
    topic: "Genetics",
    subtopic: "Mitosis vs Meiosis",
    year: 2025,
    source_paper: "Mock Exam C",
    source_type: "Original",
    question_type: "Essay",
    marks: 8,
    difficulty: "Medium",
    question_text: "Compare the processes and outcomes of mitosis and meiosis. Highlight the importance of meiosis in sexual reproduction.",
    answer_text: "1. Mitosis: Occurs in somatic cells. Results in 2 genetically identical diploid daughter cells. Involved in growth, repair, asexual reproduction. 1 division cycle.\n2. Meiosis: Occurs in reproductive cells (gamete formation). Results in 4 genetically different haploid daughter cells. 2 division cycles. Creates genetic variation.\n3. Importance of Meiosis:\n   - Halves the chromosome number so that fertilization restores the diploid number (avoids doubling chromosomes every generation).\n   - Generates genetic diversity via crossing over (prophase I) and independent assortment (metaphase I).",
    status: "Reviewed"
  }
];

async function seed() {
  try {
    const db = await initDb();
    
    // Clear existing questions
    await db.run("DELETE FROM questions");
    console.log("Cleared existing questions from the database.");

    // Seed mock questions
    const stmt = await db.prepare(`
      INSERT INTO questions (
        id, subject, topic, subtopic, year, source_paper, source_type, 
        question_type, marks, difficulty, question_text, answer_text, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const q of mockQuestions) {
      await stmt.run(
        q.id,
        q.subject,
        q.topic,
        q.subtopic || null,
        q.year,
        q.source_paper || null,
        q.source_type,
        q.question_type,
        q.marks,
        q.difficulty,
        q.question_text,
        q.answer_text,
        q.status
      );
    }
    await stmt.finalize();
    console.log(`Successfully seeded ${mockQuestions.length} mock questions.`);

  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

// Check if run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.js')) {
  seed();
}

export { seed };
