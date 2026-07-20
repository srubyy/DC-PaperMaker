// Global error reporting boundary
window.onerror = function(message, source, lineno, colno, error) {
  const cleanSource = source ? source.split('/').pop() : 'script';
  if (typeof showToast === 'function') {
    showToast(`JS Error: ${message} (in ${cleanSource}:${lineno})`, 'danger');
  }
  return false;
};

// Global State
let selectedSubject = '';
let questionsMetadata = []; 
let allQuestions = []; // [{ id, subject, topic, subtopic, year, marks, difficulty, question_text, answer_text, ... }]
let selectedQuestionIds = []; // Ordered array of selected question IDs
let availableTopics = [];
let subtopicsGrouped = {};
let headerBase64 = null;
let footerBase64 = null;

// DOM Elements
const subjectSelect = document.getElementById('subject-select');
const yearMinInput = document.getElementById('year-min');
const yearMaxInput = document.getElementById('year-max');
const sliderTrack = document.querySelector('.slider-track');
const yearDisplay = document.getElementById('year-display');
const randomizeToggle = document.getElementById('randomize-toggle');

const headerUploadBox = document.getElementById('header-upload-box');
const headerImageInput = document.getElementById('header-image-input');
const headerPreview = document.getElementById('header-preview');

const footerUploadBox = document.getElementById('footer-upload-box');
const footerImageInput = document.getElementById('footer-image-input');
const footerPreview = document.getElementById('footer-preview');

const topicsListContainer = document.getElementById('topics-list-container');
const totalMarksDisplay = document.getElementById('total-marks-display');
const selectedQuestionsCount = document.getElementById('selected-questions-count');
const selectedDetailsList = document.getElementById('selected-details-list');

const validationErrorBox = document.getElementById('validation-error-box');
const errorMessageText = document.getElementById('error-message-text');
const generateBtn = document.getElementById('generate-btn');
const clearTestBtn = document.getElementById('clear-test-btn');

// Library Elements
const questionsLibraryContainer = document.getElementById('questions-library-container');
const libraryCountBadge = document.getElementById('library-count-badge');
const librarySearch = document.getElementById('library-search');

// Filter Checkboxes
const diffEasy = document.getElementById('diff-easy');
const diffMedium = document.getElementById('diff-medium');
const diffHard = document.getElementById('diff-hard');

const typeMcq = document.getElementById('type-mcq');
const typeShort = document.getElementById('type-short');
const typeStructured = document.getElementById('type-structured');
const typeEssay = document.getElementById('type-essay');

// Importer elements
const csvDropZone = document.getElementById('csv-dropzone');
const csvFileInput = document.getElementById('csv-file-input');

// Initialize Page
window.addEventListener('DOMContentLoaded', () => {
  // Submit & Clear actions registered first to guarantee responsiveness
  if (generateBtn) {
    generateBtn.addEventListener('click', generateExamPaper);
  }
  if (clearTestBtn) {
    clearTestBtn.addEventListener('click', clearDraft);
  }

  // Load other initializations safely with try-catch blocks to prevent load halts
  try {
    loadSubjects();
  } catch (e) {
    console.error("loadSubjects init failed:", e);
  }

  try {
    setupYearSliders();
  } catch (e) {
    console.error("setupYearSliders init failed:", e);
  }

  try {
    setupImageUploads();
  } catch (e) {
    console.error("setupImageUploads init failed:", e);
  }

  try {
    checkAuth();
  } catch (e) {
    console.error("checkAuth init failed:", e);
  }

  try {
    setupAuthEventListeners();
  } catch (e) {
    console.error("setupAuthEventListeners init failed:", e);
  }

  try {
    setupCsvImporter();
  } catch (e) {
    console.error("setupCsvImporter init failed:", e);
  }
  
  // Filter change actions safely
  [diffEasy, diffMedium, diffHard, typeMcq, typeShort, typeStructured, typeEssay].forEach(chk => {
    if (chk) {
      try {
        chk.addEventListener('change', renderQuestionLibrary);
      } catch (e) {
        console.error("Filter change listener registration failed:", e);
      }
    }
  });

  if (librarySearch) {
    try {
      librarySearch.addEventListener('input', renderQuestionLibrary);
    } catch (e) {
      console.error("Search input listener registration failed:", e);
    }
  }
});

// Setup Double Range Year Slider
function setupYearSliders() {
  function updateSlider() {
    const minVal = parseInt(yearMinInput.value);
    const maxVal = parseInt(yearMaxInput.value);
    const min = parseInt(yearMinInput.min);
    const max = parseInt(yearMinInput.max);

    if (minVal > maxVal) {
      yearMinInput.value = maxVal;
    }

    const percent1 = ((yearMinInput.value - min) / (max - min)) * 100;
    const percent2 = ((yearMaxInput.value - min) / (max - min)) * 100;

    sliderTrack.style.background = `linear-gradient(to right, rgba(51, 65, 85, 0.5) ${percent1}%, var(--color-accent) ${percent1}%, var(--color-accent) ${percent2}%, rgba(51, 65, 85, 0.5) ${percent2}%)`;
    yearDisplay.textContent = `${yearMinInput.value} - ${yearMaxInput.value}`;
    
    // Rerender/Filter Library
    renderQuestionLibrary();
  }

  yearMinInput.addEventListener('input', updateSlider);
  yearMaxInput.addEventListener('input', updateSlider);
}

// Load Distinct Subjects from DB
async function loadSubjects() {
  try {
    const res = await fetch('/api/subjects');
    if (!res.ok) throw new Error('Failed to fetch');
    const subjects = await res.json();

    subjectSelect.innerHTML = '<option value="" disabled selected>-- Choose Subject --</option>';
    if (subjects.length === 0) {
      subjectSelect.innerHTML = '<option value="" disabled>No subjects in database</option>';
      return;
    }

    subjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.textContent = sub;
      subjectSelect.appendChild(opt);
    });

    subjectSelect.addEventListener('change', (e) => {
      selectedSubject = e.target.value;
      loadSubjectMetadata(selectedSubject);
    });
  } catch (err) {
    showToast('Could not load subjects from backend.', 'danger');
  }
}

// Load Metadata & Questions for Selected Subject
async function loadSubjectMetadata(subject) {
  try {
    topicsListContainer.innerHTML = '<p class="info-text">Loading topics...</p>';
    questionsLibraryContainer.innerHTML = '<p class="info-text">Loading question bank...</p>';
    
    // Fetch subject schema metadata
    const resMeta = await fetch(`/api/metadata?subject=${encodeURIComponent(subject)}`);
    if (!resMeta.ok) throw new Error('Failed to fetch metadata');
    const metaData = await resMeta.json();

    subtopicsGrouped = metaData.subtopicsGrouped || {};
    availableTopics = metaData.topics;

    // Fetch detailed questions for library
    const resQuest = await fetch(`/api/questions?subject=${encodeURIComponent(subject)}`);
    if (!resQuest.ok) throw new Error('Failed to fetch questions details');
    allQuestions = await resQuest.json();

    // Reset range sliders to subject boundaries
    yearMinInput.min = metaData.minYear;
    yearMinInput.max = metaData.maxYear;
    yearMinInput.value = metaData.minYear;

    yearMaxInput.min = metaData.minYear;
    yearMaxInput.max = metaData.maxYear;
    yearMaxInput.value = metaData.maxYear;

    // Update Slider track color
    const min = metaData.minYear;
    const max = metaData.maxYear;
    sliderTrack.style.background = `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) 100%)`;
    yearDisplay.textContent = `${min} - ${max}`;

    selectedQuestionIds = []; // clear draft on subject switch

    renderNestedTopicsList();
    renderQuestionLibrary();
    renderTestAssembler();
  } catch (err) {
    showToast('Failed to load subject information.', 'danger');
    topicsListContainer.innerHTML = '<p class="info-text text-danger">Error loading topics.</p>';
    questionsLibraryContainer.innerHTML = '<p class="info-text text-danger">Error loading question bank.</p>';
  }
}

// Render Checkboxes for Nested Syllabus Areas (Tier 1 & Tier 2)
function renderNestedTopicsList() {
  const topics = Object.keys(subtopicsGrouped);
  if (topics.length === 0) {
    topicsListContainer.innerHTML = '<p class="info-text">No topics found for this subject.</p>';
    return;
  }

  topicsListContainer.innerHTML = '';
  
  topics.forEach(topic => {
    const topicId = cleanId(topic);
    const subtopics = subtopicsGrouped[topic] || [];
    
    const moduleDiv = document.createElement('div');
    moduleDiv.className = 'syllabus-module';
    moduleDiv.id = `module-${topicId}`;
    
    // Header for Syllabus Module (Tier 1)
    const headerDiv = document.createElement('div');
    headerDiv.className = 'module-header';
    headerDiv.innerHTML = `
      <span class="expand-toggle" data-module-id="${topicId}">▼</span>
      <label class="module-label">
        <input type="checkbox" class="module-checkbox" data-module="${topic}" id="mod-chk-${topicId}">
        <span class="module-name">${topic}</span>
      </label>
    `;
    
    // Sub-topics container (Tier 2)
    const subListDiv = document.createElement('div');
    subListDiv.className = 'subtopics-list';
    subListDiv.id = `sublist-${topicId}`;
    subListDiv.style.display = 'block'; // expanded by default
    
    subtopics.forEach(sub => {
      const subId = cleanId(sub);
      const subtopicItem = document.createElement('div');
      subtopicItem.className = 'subtopic-item';
      subtopicItem.id = `item-${subId}`;
      subtopicItem.innerHTML = `
        <label class="subtopic-checkbox-label" for="chk-${subId}">
          <input type="checkbox" id="chk-${subId}" data-module="${topic}" data-subtopic="${sub}" class="subtopic-checkbox" checked>
          <div style="display: flex; flex-direction: column;">
            <span class="subtopic-name">${sub}</span>
            <span class="subtopic-avail-badge" id="avail-${subId}">available: 0</span>
          </div>
        </label>
      `;
      subListDiv.appendChild(subtopicItem);
    });
    
    moduleDiv.appendChild(headerDiv);
    moduleDiv.appendChild(subListDiv);
    topicsListContainer.appendChild(moduleDiv);
  });

  // Expand / collapse subtopic group
  document.querySelectorAll('.expand-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modId = e.target.dataset.moduleId;
      const subList = document.getElementById(`sublist-${modId}`);
      if (subList.style.display === 'none') {
        subList.style.display = 'block';
        e.target.textContent = '▼';
      } else {
        subList.style.display = 'none';
        e.target.textContent = '▶';
      }
    });
  });

  // Parent topic checkbox toggles all children
  document.querySelectorAll('.module-checkbox').forEach(chk => {
    chk.checked = true; // default all checked
    chk.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const topic = e.target.dataset.module;
      const topicId = cleanId(topic);
      const subList = document.getElementById(`sublist-${topicId}`);
      
      subList.querySelectorAll('.subtopic-checkbox').forEach(subChk => {
        subChk.checked = isChecked;
        const subId = cleanId(subChk.dataset.subtopic);
        const itemDiv = document.getElementById(`item-${subId}`);
        if (isChecked) {
          itemDiv.classList.add('selected');
        } else {
          itemDiv.classList.remove('selected');
        }
      });
      
      renderQuestionLibrary();
    });
  });

  // Child subtopic checkbox updates parent checkbox
  document.querySelectorAll('.subtopic-checkbox').forEach(chk => {
    const subId = cleanId(chk.dataset.subtopic);
    const itemDiv = document.getElementById(`item-${subId}`);
    itemDiv.classList.add('selected'); // default checked/selected

    chk.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (isChecked) {
        itemDiv.classList.add('selected');
      } else {
        itemDiv.classList.remove('selected');
      }

      const topic = e.target.dataset.module;
      const topicId = cleanId(topic);
      const parentChk = document.getElementById(`mod-chk-${topicId}`);
      const subList = document.getElementById(`sublist-${topicId}`);
      const totalSubs = subList.querySelectorAll('.subtopic-checkbox').length;
      const checkedSubs = subList.querySelectorAll('.subtopic-checkbox:checked').length;
      
      if (checkedSubs === totalSubs) {
        parentChk.checked = true;
        parentChk.indeterminate = false;
      } else if (checkedSubs === 0) {
        parentChk.checked = false;
        parentChk.indeterminate = false;
      } else {
        parentChk.checked = false;
        parentChk.indeterminate = true;
      }
      
      renderQuestionLibrary();
    });
  });
}

// Clean ID for DOM manipulation
function cleanId(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

// Escape HTML utility
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Format rich text questions/answers with joined Math slices in the library preview
function formatRichText(text, subject, isMarkScheme = false) {
  let escaped = escapeHtml(text);
  const imageRegex = /\[IMAGE:\s*([^\]\s]+)\]/gi;
  
  let lastIndex = 0;
  let result = '';
  let match;
  let consecutiveImages = [];
  
  const flushImages = () => {
    if (consecutiveImages.length === 0) return '';
    
    const hasMathSlice = consecutiveImages.some(url => url.includes('math_0580') || subject === 'Mathematics');
    
    if (hasMathSlice) {
      const imgTags = consecutiveImages.map(url => {
        return `<img src="${url}" style="width: 100%; display: block; margin: 0; padding: 0; border: none; box-shadow: none; background-color: #ffffff;" />`;
      }).join('');
      consecutiveImages = [];
      return `
        <div class="embedded-math-slices" style="margin-top: 5px; margin-bottom: 5px; line-height: 0; font-size: 0; text-align: left; border: none; padding: 0; background: transparent; box-shadow: none; display: flex; flex-direction: column;">
          ${imgTags}
        </div>`;
    } else {
      const rendered = consecutiveImages.map(url => {
        return `
          <div class="embedded-image-container" style="margin: 15px 0; text-align: center;">
            <img src="${url}" style="max-width: 95%; max-height: 200px; object-fit: contain; border: 1px solid var(--border-color, #e2e8f0); border-radius: 6px; padding: 6px; background-color: #ffffff;" />
          </div>`;
      }).join('');
      consecutiveImages = [];
      return rendered;
    }
  };

  imageRegex.lastIndex = 0;
  while ((match = imageRegex.exec(escaped)) !== null) {
    const textBefore = escaped.substring(lastIndex, match.index);
    if (textBefore.trim().length > 0) {
      result += flushImages();
      result += textBefore.replace(/\n/g, '<br>');
    }
    const url = match[1].replace(/&amp;/g, '&');
    consecutiveImages.push(url);
    lastIndex = imageRegex.lastIndex;
  }
  
  result += flushImages();
  if (lastIndex < escaped.length) {
    result += escaped.substring(lastIndex).replace(/\n/g, '<br>');
  }
  return result;
}

// Render available questions in Column 2 (Middle)
function renderQuestionLibrary() {
  if (!selectedSubject) {
    questionsLibraryContainer.innerHTML = '<p class="info-text">Please select a subject to load available questions.</p>';
    libraryCountBadge.textContent = '0 matching';
    return;
  }

  const minYear = parseInt(yearMinInput.value);
  const maxYear = parseInt(yearMaxInput.value);
  const searchText = librarySearch ? librarySearch.value.trim().toLowerCase() : '';

  // Active difficulty checklist
  const allowedDiffs = [];
  if (diffEasy && diffEasy.checked) allowedDiffs.push('Easy');
  if (diffMedium && diffMedium.checked) allowedDiffs.push('Medium');
  if (diffHard && diffHard.checked) allowedDiffs.push('Hard');

  // Active question type checklist
  const allowedTypes = [];
  if (typeMcq && typeMcq.checked) allowedTypes.push('MCQ');
  if (typeShort && typeShort.checked) allowedTypes.push('Short Answer');
  if (typeStructured && typeStructured.checked) allowedTypes.push('Structured');
  if (typeEssay && typeEssay.checked) allowedTypes.push('Essay');

  // Active subtopics list from checkboxes
  const checkedSubtopics = new Set();
  document.querySelectorAll('.subtopic-checkbox:checked').forEach(chk => {
    checkedSubtopics.add(chk.dataset.subtopic);
  });

  // Calculate available counts per subtopic in-situ
  document.querySelectorAll('.subtopic-checkbox').forEach(chk => {
    const sub = chk.dataset.subtopic;
    const subId = cleanId(sub);
    const availBadge = document.getElementById(`avail-${subId}`);
    
    // Available count based on current year, difficulty, type filters
    const subCount = allQuestions.filter(q => {
      const matchSub = q.subtopic === sub;
      const matchYear = q.year >= minYear && q.year <= maxYear;
      const matchDiff = allowedDiffs.includes(q.difficulty);
      const matchType = allowedTypes.includes(q.question_type);
      return matchSub && matchYear && matchDiff && matchType;
    }).length;

    if (availBadge) {
      availBadge.textContent = `available: ${subCount}`;
    }
  });

  // Filter all questions
  const filteredQuestions = allQuestions.filter(q => {
    const matchSubtopic = checkedSubtopics.has(q.subtopic);
    const matchYear = q.year >= minYear && q.year <= maxYear;
    const matchDiff = allowedDiffs.includes(q.difficulty);
    const matchType = allowedTypes.includes(q.question_type);
    
    let matchSearch = true;
    if (searchText) {
      matchSearch = q.question_text.toLowerCase().includes(searchText) || 
                    q.id.toLowerCase().includes(searchText) || 
                    q.subtopic.toLowerCase().includes(searchText);
    }

    return matchSubtopic && matchYear && matchDiff && matchType && matchSearch;
  });

  libraryCountBadge.textContent = `${filteredQuestions.length} matching`;

  if (filteredQuestions.length === 0) {
    questionsLibraryContainer.innerHTML = '<p class="info-text">No questions match the current filters.</p>';
    return;
  }

  questionsLibraryContainer.innerHTML = filteredQuestions.map(q => {
    const isAdded = selectedQuestionIds.includes(q.id);
    const btnText = isAdded ? 'Remove' : 'Add to Test';
    const btnClass = isAdded ? 'btn-remove' : 'btn-add';
    const diffClass = `badge-${q.difficulty.toLowerCase()}`;

    const cleanText = formatRichText(q.question_text, selectedSubject, false);
    const cleanAnswer = formatRichText(q.answer_text, selectedSubject, true);

    return `
      <div class="question-card" id="card-${cleanId(q.id)}">
        <div class="question-card-header">
          <span class="question-card-id">${q.id}</span>
          <div class="question-card-badges">
            <span class="badge ${diffClass}">${q.difficulty}</span>
            <span class="badge badge-type">${q.question_type}</span>
            <span class="badge badge-year">${q.year}</span>
            <span class="badge badge-marks">${q.marks} Marks</span>
          </div>
        </div>
        <div class="question-card-body">${cleanText}</div>
        <div class="question-card-footer">
          <span class="question-card-subtopic">${q.subtopic}</span>
          <button class="btn question-action-btn ${btnClass}" onclick="toggleQuestionSelection('${q.id}')">
            ${btnText}
          </button>
        </div>
        <details class="model-answer-details">
          <summary class="model-answer-summary">Model Answer / Mark Scheme</summary>
          <div class="model-answer-content">${cleanAnswer}</div>
        </details>
      </div>
    `;
  }).join('');
}

// Global toggle question action
window.toggleQuestionSelection = function(id) {
  const index = selectedQuestionIds.indexOf(id);
  if (index === -1) {
    selectedQuestionIds.push(id);
    showToast(`Added ${id} to test.`, 'success');
  } else {
    selectedQuestionIds.splice(index, 1);
    showToast(`Removed ${id} from test.`, 'info');
  }
  renderQuestionLibrary();
  renderTestAssembler();
};

// Render chosen questions in Right Sidebar Assembly panel
function renderTestAssembler() {
  if (selectedQuestionsCount) {
    selectedQuestionsCount.textContent = selectedQuestionIds.length;
  }
  
  if (selectedQuestionIds.length === 0) {
    selectedDetailsList.innerHTML = '<p class="empty-selection-msg">No questions selected yet. Add questions from the Question Bank.</p>';
    totalMarksDisplay.textContent = '0';
    disableGenerate('Please add at least one question to the test.');
    return;
  }

  // Calculate sum of marks
  let totalMarks = 0;
  const draftHtml = selectedQuestionIds.map((id, index) => {
    const q = allQuestions.find(item => item.id === id);
    if (!q) return '';
    totalMarks += q.marks;

    const isFirst = index === 0;
    const isLast = index === selectedQuestionIds.length - 1;

    return `
      <div class="selected-question-item">
        <div class="selected-question-info">
          <span class="selected-question-id">Q${index + 1}: ${q.id}</span>
          <span class="selected-question-meta">${q.marks} Marks | ${q.subtopic}</span>
        </div>
        <div class="selected-question-actions">
          <button class="reorder-btn" onclick="reorderQuestion('${q.id}', 'up')" ${isFirst ? 'disabled' : ''} aria-label="Move Up">
            ▲
          </button>
          <button class="reorder-btn" onclick="reorderQuestion('${q.id}', 'down')" ${isLast ? 'disabled' : ''} aria-label="Move Down">
            ▼
          </button>
          <button class="delete-question-btn" onclick="toggleQuestionSelection('${q.id}')" aria-label="Delete">
            ×
          </button>
        </div>
      </div>
    `;
  }).join('');

  totalMarksDisplay.textContent = totalMarks;
  selectedDetailsList.innerHTML = draftHtml;
  enableGenerate();
}

// Reorder draft questions array
window.reorderQuestion = function(id, direction) {
  const index = selectedQuestionIds.indexOf(id);
  if (index === -1) return;
  if (direction === 'up' && index > 0) {
    [selectedQuestionIds[index], selectedQuestionIds[index - 1]] = [selectedQuestionIds[index - 1], selectedQuestionIds[index]];
  } else if (direction === 'down' && index < selectedQuestionIds.length - 1) {
    [selectedQuestionIds[index], selectedQuestionIds[index + 1]] = [selectedQuestionIds[index + 1], selectedQuestionIds[index]];
  }
  renderQuestionLibrary();
  renderTestAssembler();
};

// Clear Test Draft
function clearDraft() {
  selectedQuestionIds = [];
  renderQuestionLibrary();
  renderTestAssembler();
  showToast('Test draft cleared.', 'info');
}

// Enable/Disable generate trigger
function disableGenerate(errorMessage) {
  generateBtn.disabled = true;
  validationErrorBox.classList.remove('hidden');
  errorMessageText.textContent = errorMessage;
}

function enableGenerate() {
  generateBtn.disabled = false;
  validationErrorBox.classList.add('hidden');
}

// Concurrency lock for PDF generator
let isGenerating = false;

// Generate Paired PDF API Request
async function generateExamPaper() {
  if (isGenerating) {
    console.warn("Generation already in progress, ignoring duplicate trigger.");
    return;
  }

  const spinner = generateBtn.querySelector('.spinner');
  const btnText = generateBtn.querySelector('.btn-text');

  try {
    if (selectedQuestionIds.length === 0) {
      showToast('Please select at least one question.', 'danger');
      return;
    }

    isGenerating = true;

    // Set loading state
    generateBtn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.textContent = 'Generating...';

    const payload = {
      subject: selectedSubject,
      questionIds: selectedQuestionIds,
      yearMin: parseInt(yearMinInput.value),
      yearMax: parseInt(yearMaxInput.value),
      randomize: randomizeToggle.checked,
      headerImage: headerBase64,
      footerImage: footerBase64
    };
    
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      showToast('Authentication required. Please log in or register to generate exam papers.', 'danger');
      showAuthScreen('login');
      return;
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (data.fallbackHtml) {
        showToast('Compiling exam package client-side...', 'info');
        await generateZipClientSide(data.subject, data.questionPaperHtml, data.markSchemeHtml);
        showToast('Exam packages downloaded successfully!', 'success');
        return;
      }
      if (data.error) {
        throw new Error(data.error);
      }
    }

    if (!res.ok) {
      throw new Error('Failed to generate PDF documents.');
    }

    // Get zip blob directly from binary stream
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Direction_Classes_${selectedSubject.replace(/\s+/g, '_')}_Exam.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 1000);

    showToast('Exam packages downloaded successfully!', 'success');
  } catch (err) {
    console.error("[generate] Caught generation error:", err);
    showToast(`Error: ${err.message}`, 'danger');
  } finally {
    isGenerating = false;
    generateBtn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'Generate PDFs';
    renderTestAssembler();
  }
}

// Client-side PDF & ZIP Generator Fallback for Vercel/Serverless
async function generateZipClientSide(subject, qpHtml, msHtml) {
  if (typeof html2pdf === 'undefined' || typeof JSZip === 'undefined') {
    throw new Error('PDF compiler libraries failed to load in browser.');
  }

  const createPdfBlob = async (htmlContent, docTitle) => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px'; // A4 width at 96 DPI
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const opt = {
      margin:       [8, 8, 8, 8],
      filename:     `${docTitle}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
    document.body.removeChild(container);
    return pdfBlob;
  };

  const qpBlob = await createPdfBlob(qpHtml, 'Question_Paper');
  const msBlob = await createPdfBlob(msHtml, 'Mark_Scheme');

  const zip = new JSZip();
  zip.file('Question_Paper.pdf', qpBlob);
  zip.file('Mark_Scheme.pdf', msBlob);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `Direction_Classes_${subject.replace(/\s+/g, '_')}_Exam.zip`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 1000);
}

// Brand Image Upload Handling (Header & Footer)
function setupImageUploads() {
  // Header
  headerImageInput.addEventListener('change', (e) => {
    handleImageFile(e.target.files[0], 'header');
  });

  // Footer
  footerImageInput.addEventListener('change', (e) => {
    handleImageFile(e.target.files[0], 'footer');
  });

  // Drag and Drop handling
  ['dragenter', 'dragover'].forEach(eventName => {
    headerUploadBox.addEventListener(eventName, (e) => { e.preventDefault(); headerUploadBox.style.borderColor = 'var(--color-accent)'; }, false);
    footerUploadBox.addEventListener(eventName, (e) => { e.preventDefault(); footerUploadBox.style.borderColor = 'var(--color-accent)'; }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    headerUploadBox.addEventListener(eventName, (e) => { e.preventDefault(); headerUploadBox.style.borderColor = 'rgba(51, 65, 85, 0.8)'; }, false);
    footerUploadBox.addEventListener(eventName, (e) => { e.preventDefault(); footerUploadBox.style.borderColor = 'rgba(51, 65, 85, 0.8)'; }, false);
  });

  headerUploadBox.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file, 'header');
    }
  });

  footerUploadBox.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file, 'footer');
    }
  });
}

function handleImageFile(file, type) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const base64 = event.target.result;
    const previewDiv = type === 'header' ? headerPreview : footerPreview;
    
    if (type === 'header') {
      headerBase64 = base64;
    } else {
      footerBase64 = base64;
    }

    previewDiv.style.display = 'flex';
    previewDiv.innerHTML = `
      <img src="${base64}" class="preview-image" alt="${type} preview" />
      <button type="button" class="remove-btn" onclick="removeBrandImage(event, '${type}')">×</button>
    `;
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} image uploaded successfully.`, 'success');
  };
  reader.readAsDataURL(file);
}

// Global scope helper for image removal (called from dynamic HTML)
window.removeBrandImage = function(event, type) {
  event.stopPropagation();
  const previewDiv = type === 'header' ? headerPreview : footerPreview;
  const input = type === 'header' ? headerImageInput : footerImageInput;

  if (type === 'header') {
    headerBase64 = null;
  } else {
    footerBase64 = null;
  }

  input.value = '';
  previewDiv.style.display = 'none';
  previewDiv.innerHTML = '';
  showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} image removed.`, 'success');
};

// CSV Database Importer Setup
function setupCsvImporter() {
  csvDropZone.addEventListener('click', () => csvFileInput.click());
  csvFileInput.addEventListener('change', (e) => {
    handleCsvUpload(e.target.files[0]);
  });

  // Drag over animations
  csvDropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    csvDropZone.classList.add('dragover');
  });

  csvDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    csvDropZone.classList.add('dragover');
  });

  csvDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    csvDropZone.classList.remove('dragover');
  });

  csvDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    csvDropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleCsvUpload(file);
    } else {
      showToast('Please drop a valid .csv file.', 'danger');
    }
  });
}

async function handleCsvUpload(file) {
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    showToast('Uploading and importing database rows...', 'success');
    
    const res = await fetch('/api/import', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to import CSV');

    showToast(`Successfully imported ${data.imported} questions. (Skipped ${data.skipped})`, 'success');
    
    // Reload subjects & current configuration
    const currentSubject = subjectSelect.value;
    await loadSubjects();
    if (currentSubject) {
      subjectSelect.value = currentSubject;
      selectedSubject = currentSubject;
      await loadSubjectMetadata(currentSubject);
    }
  } catch (err) {
    showToast(`Import Error: ${err.message}`, 'danger');
  } finally {
    csvFileInput.value = '';
  }
}

// Toast Notification System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

// ==========================================
// User Authentication System (Frontend)
// ==========================================
let currentUser = null;

// DOM Selectors for Auth
const appAuthView = document.getElementById('app-auth-view');
const appDashboardView = document.getElementById('app-dashboard-view');
const authLoginView = document.getElementById('auth-login-view');
const authRegisterView = document.getElementById('auth-register-view');
const authForgotView = document.getElementById('auth-forgot-view');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const forgotForm = document.getElementById('forgot-form');

const registerPassword = document.getElementById('register-password');
const registerConfirmPassword = document.getElementById('register-confirm-password');
const registerTerms = document.getElementById('register-terms');
const registerSubmitBtn = document.getElementById('register-submit-btn');

// Check Current User Session
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      currentUser = await res.json();
      hideAuthScreen();
    } else {
      currentUser = null;
      showAuthScreen('login');
    }
  } catch (err) {
    currentUser = null;
    showAuthScreen('login');
  }
  updateAuthWidget();
}

// Update Header Navigation Widget
function updateAuthWidget() {
  const authWidget = document.getElementById('auth-widget');
  if (!authWidget) return;

  if (currentUser) {
    const displayName = currentUser.name || currentUser.email;
    authWidget.innerHTML = `
      <div class="user-display">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="user-avatar-icon"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span class="user-email-text" title="${displayName}">${displayName}</span>
      </div>
      <button class="btn btn-logout" id="logout-btn">Log Out</button>
    `;

    document.getElementById('logout-btn').addEventListener('click', handleLogout);
  } else {
    authWidget.innerHTML = '';
  }
}

// Show Auth Screen Overlay
function showAuthScreen(view = 'login') {
  appAuthView.classList.remove('hidden');
  appDashboardView.classList.add('hidden');
  resetAuthForms();
  showAuthView(view);
}

// Hide Auth Screen and Show Dashboard
function hideAuthScreen() {
  appAuthView.classList.add('hidden');
  appDashboardView.classList.remove('hidden');
}

// Switch between views
function showAuthView(view) {
  authLoginView.classList.add('hidden');
  authRegisterView.classList.add('hidden');
  authForgotView.classList.add('hidden');

  if (view === 'login') {
    authLoginView.classList.remove('hidden');
  } else if (view === 'register') {
    authRegisterView.classList.remove('hidden');
  } else if (view === 'forgot') {
    authForgotView.classList.remove('hidden');
  }
}

// Clear input errors and forms
function resetAuthForms() {
  loginForm.reset();
  registerForm.reset();
  forgotForm.reset();

  document.getElementById('login-error-box').classList.add('hidden');
  document.getElementById('register-error-box').classList.add('hidden');
  document.getElementById('forgot-error-box').classList.add('hidden');
  document.getElementById('forgot-success-box').classList.add('hidden');
  
  // Reset password validations
  const strengthIndicator = document.getElementById('register-password-strength');
  strengthIndicator.className = 'password-strength-indicator';
  strengthIndicator.querySelector('.strength-text').textContent = 'Password must be at least 8 characters.';
  document.getElementById('confirm-password-msg').classList.add('hidden');
  registerSubmitBtn.disabled = true;
}

// Configure Event Triggers
function setupAuthEventListeners() {
  // Switchers
  document.getElementById('go-to-register').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView('register');
  });
  document.getElementById('go-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView('login');
  });
  document.getElementById('forgot-password-trigger').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView('forgot');
  });
  document.getElementById('forgot-back-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView('login');
  });

  // Real-time validations
  registerPassword.addEventListener('input', validateRegisterForm);
  registerConfirmPassword.addEventListener('input', validateRegisterForm);
  registerTerms.addEventListener('change', validateRegisterForm);

  // Submits
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  forgotForm.addEventListener('submit', handleForgotPassword);

  // Password Visibility toggles
  setupPasswordToggle('login-password', 'toggle-login-password');
  setupPasswordToggle('register-password', 'toggle-register-password');
  setupPasswordToggle('register-confirm-password', 'toggle-register-confirm-password');
}

// Password Strength & Confirm validation Logic
function validateRegisterForm() {
  const password = registerPassword.value;
  const confirmPassword = registerConfirmPassword.value;
  const termsChecked = registerTerms.checked;
  const strengthIndicator = document.getElementById('register-password-strength');
  const strengthText = strengthIndicator.querySelector('.strength-text');
  const confirmMsg = document.getElementById('confirm-password-msg');

  let isPasswordOk = false;
  let isConfirmOk = false;

  // Strength Check
  strengthIndicator.className = 'password-strength-indicator';
  if (password.length === 0) {
    strengthText.textContent = 'Password must be at least 8 characters.';
  } else if (password.length < 8) {
    strengthIndicator.classList.add('weak');
    strengthText.textContent = 'Weak (too short)';
  } else {
    // Check complexity
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if (hasLetters && hasNumbers && hasSpecial) {
      strengthIndicator.classList.add('strong');
      strengthText.textContent = 'Strong password';
      isPasswordOk = true;
    } else if (hasLetters && hasNumbers) {
      strengthIndicator.classList.add('medium');
      strengthText.textContent = 'Medium complexity';
      isPasswordOk = true;
    } else {
      strengthIndicator.classList.add('weak');
      strengthText.textContent = 'Weak (include letters & numbers)';
    }
  }

  // Matching check
  if (confirmPassword.length > 0) {
    if (password !== confirmPassword) {
      confirmMsg.classList.remove('hidden');
      isConfirmOk = false;
    } else {
      confirmMsg.classList.add('hidden');
      isConfirmOk = true;
    }
  } else {
    confirmMsg.classList.add('hidden');
    isConfirmOk = false;
  }

  // Toggle submit
  registerSubmitBtn.disabled = !(isPasswordOk && isConfirmOk && termsChecked);
}

// Handle Login API Request
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorBox = document.getElementById('login-error-box');
  const submitBtn = document.getElementById('login-submit-btn');

  // Loading UI state
  submitBtn.disabled = true;
  submitBtn.querySelector('.spinner').classList.remove('hidden');
  submitBtn.querySelector('.btn-text').textContent = 'Logging In...';
  errorBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');

    currentUser = data;
    updateAuthWidget();
    hideAuthScreen();
    showToast('Logged in successfully!', 'success');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.spinner').classList.add('hidden');
    submitBtn.querySelector('.btn-text').textContent = 'Log In';
  }
}

// Handle Register API Request
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = registerPassword.value;
  const errorBox = document.getElementById('register-error-box');
  const submitBtn = document.getElementById('register-submit-btn');

  submitBtn.disabled = true;
  submitBtn.querySelector('.spinner').classList.remove('hidden');
  submitBtn.querySelector('.btn-text').textContent = 'Registering...';
  errorBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed.');

    currentUser = data;
    updateAuthWidget();
    hideAuthScreen();
    showToast('Account registered successfully!', 'success');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
    submitBtn.disabled = false;
  } finally {
    submitBtn.querySelector('.spinner').classList.add('hidden');
    submitBtn.querySelector('.btn-text').textContent = 'Create Account';
  }
}

// Handle Mock Reset Password Request
async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value;
  const errorBox = document.getElementById('forgot-error-box');
  const successBox = document.getElementById('forgot-success-box');
  const submitBtn = document.getElementById('forgot-submit-btn');

  submitBtn.disabled = true;
  submitBtn.querySelector('.spinner').classList.remove('hidden');
  submitBtn.querySelector('.btn-text').textContent = 'Sending...';
  errorBox.classList.add('hidden');
  successBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed.');

    successBox.textContent = data.message;
    successBox.classList.remove('hidden');
    forgotForm.reset();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.spinner').classList.add('hidden');
    submitBtn.querySelector('.btn-text').textContent = 'Send Reset Link';
  }
}

// Handle Logout API Request
async function handleLogout() {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      currentUser = null;
      updateAuthWidget();
      showAuthScreen('login');
      showToast('Logged out successfully.', 'info');
    }
  } catch (err) {
    showToast('Failed to log out.', 'danger');
  }
}

// Password Field Visibility Toggle Controller
function setupPasswordToggle(inputId, toggleId) {
  const input = document.getElementById(inputId);
  const toggleBtn = document.getElementById(toggleId);
  if (!input || !toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    
    if (isPassword) {
      // SVG: eye-off icon
      toggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      `;
    } else {
      // SVG: normal eye icon
      toggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      `;
    }
  });
}

// Expose key actions globally to guarantee HTML inline onclick handlers work
window.generateExamPaper = generateExamPaper;
window.clearDraft = clearDraft;

