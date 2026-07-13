// Global State
let selectedSubject = '';
let questionsMetadata = []; // [{ id, topic, subtopic, year, marks }]
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
const selectedTopicsCount = document.getElementById('selected-topics-count');
const selectedDetailsList = document.getElementById('selected-details-list');

const validationErrorBox = document.getElementById('validation-error-box');
const errorMessageText = document.getElementById('error-message-text');
const generateBtn = document.getElementById('generate-btn');

const csvDropZone = document.getElementById('csv-drop-zone');
const csvFileInput = document.getElementById('csv-file-input');

// Initialize Page
window.addEventListener('DOMContentLoaded', () => {
  loadSubjects();
  setupYearSliders();
  setupImageUploads();
  setupCsvImporter();
  
  // Submit action
  generateBtn.addEventListener('click', generateExamPaper);
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
    
    // Recalculate local validations
    validateAndCalculate();
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

// Load Metadata for Selected Subject
async function loadSubjectMetadata(subject) {
  try {
    topicsListContainer.innerHTML = '<p class="info-text">Loading topics...</p>';
    
    const res = await fetch(`/api/metadata?subject=${encodeURIComponent(subject)}`);
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();

    subtopicsGrouped = data.subtopicsGrouped || {};
    questionsMetadata = data.questions;

    // Reset range sliders to subject boundaries
    yearMinInput.min = data.minYear;
    yearMinInput.max = data.maxYear;
    yearMinInput.value = data.minYear;

    yearMaxInput.min = data.minYear;
    yearMaxInput.max = data.maxYear;
    yearMaxInput.value = data.maxYear;

    // Update Slider track color
    const min = data.minYear;
    const max = data.maxYear;
    sliderTrack.style.background = `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) 100%)`;
    yearDisplay.textContent = `${min} - ${max}`;

    availableTopics = data.topics;
    renderNestedTopicsList();
  } catch (err) {
    showToast('Failed to load subject topics.', 'danger');
    topicsListContainer.innerHTML = '<p class="info-text text-danger">Error loading topics.</p>';
  }
}

// Render Checkboxes and Quantities for Nested Syllabus Areas (Tier 1 & Tier 2)
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
          <input type="checkbox" id="chk-${subId}" data-module="${topic}" data-subtopic="${sub}" class="subtopic-checkbox">
          <div style="display: flex; flex-direction: column;">
            <span class="subtopic-name">${sub}</span>
            <span class="subtopic-avail-badge" id="avail-${subId}">available: 0</span>
          </div>
        </label>
        <div class="subtopic-control">
          <input type="number" id="qty-${subId}" data-module="${topic}" data-subtopic="${sub}" class="qty-input" min="1" value="1" disabled>
        </div>
      `;
      subListDiv.appendChild(subtopicItem);
    });
    
    moduleDiv.appendChild(headerDiv);
    moduleDiv.appendChild(subListDiv);
    topicsListContainer.appendChild(moduleDiv);
  });

  // Attach Toggle Listeners
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

  // Attach Module Checkbox (Tier 1) Listeners - Toggles all sub-topics under it
  document.querySelectorAll('.module-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const topic = e.target.dataset.module;
      const topicId = cleanId(topic);
      const subList = document.getElementById(`sublist-${topicId}`);
      
      subList.querySelectorAll('.subtopic-checkbox').forEach(subChk => {
        subChk.checked = isChecked;
        const subId = cleanId(subChk.dataset.subtopic);
        const qtyInput = document.getElementById(`qty-${subId}`);
        const itemDiv = document.getElementById(`item-${subId}`);
        
        qtyInput.disabled = !isChecked;
        if (isChecked) {
          itemDiv.classList.add('selected');
        } else {
          itemDiv.classList.remove('selected');
          itemDiv.classList.remove('error-state');
        }
      });
      
      validateAndCalculate();
    });
  });

  // Attach Sub-Topic Checkbox (Tier 2) Listeners
  document.querySelectorAll('.subtopic-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const subtopic = e.target.dataset.subtopic;
      const subId = cleanId(subtopic);
      const qtyInput = document.getElementById(`qty-${subId}`);
      const itemDiv = document.getElementById(`item-${subId}`);
      
      qtyInput.disabled = !isChecked;
      if (isChecked) {
        itemDiv.classList.add('selected');
      } else {
        itemDiv.classList.remove('selected');
        itemDiv.classList.remove('error-state');
      }

      // Check if all subtopics in this module are checked/unchecked to update parent checkbox
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
      
      validateAndCalculate();
    });
  });

  // Attach Quantity Input (Tier 3) Listeners
  document.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('input', validateAndCalculate);
  });

  // Initial Calculation
  validateAndCalculate();
}

// Perform Live Calculations & Validation Checks on Client
function validateAndCalculate() {
  if (!selectedSubject) {
    updateSummaryUI(0, 0, []);
    disableGenerate('Please select a subject first.');
    return;
  }

  const subtopicCheckboxes = document.querySelectorAll('.subtopic-checkbox');
  if (subtopicCheckboxes.length === 0) {
    updateSummaryUI(0, 0, []);
    disableGenerate('No subtopics loaded.');
    return;
  }

  const yearMin = parseInt(yearMinInput.value);
  const yearMax = parseInt(yearMaxInput.value);
  let totalMarks = 0;
  let selectedCount = 0;
  let validationErrors = [];
  let summaryDetails = [];

  subtopicCheckboxes.forEach(chk => {
    const topic = chk.dataset.module;
    const sub = chk.dataset.subtopic;
    const subId = cleanId(sub);
    const qtyInput = document.getElementById(`qty-${subId}`);
    const availBadge = document.getElementById(`avail-${subId}`);
    const itemDiv = document.getElementById(`item-${subId}`);

    // Filter metadata to find available questions in selected scope
    const availableQuestions = questionsMetadata.filter(q => {
      return q.topic === topic && q.subtopic === sub && q.year >= yearMin && q.year <= yearMax;
    });

    const availableCount = availableQuestions.length;
    if (availBadge) {
      availBadge.textContent = `available: ${availableCount}`;
    }

    if (chk.checked) {
      const requestedQty = parseInt(qtyInput.value, 10) || 0;
      selectedCount++;

      // Check overflow error
      if (requestedQty > availableCount) {
        if (itemDiv) itemDiv.classList.add('error-state');
        validationErrors.push(`Sub-Topic "${sub}": requested ${requestedQty} questions, but only ${availableCount} available.`);
      } else if (requestedQty <= 0) {
        if (itemDiv) itemDiv.classList.add('error-state');
        validationErrors.push(`Sub-Topic "${sub}": requested count must be at least 1.`);
      } else {
        if (itemDiv) itemDiv.classList.remove('error-state');
        
        // Sum marks of the first N questions (sorted by ID for stability)
        const sortedSubset = [...availableQuestions]
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, requestedQty);
          
        const subsetMarks = sortedSubset.reduce((sum, q) => sum + q.marks, 0);
        totalMarks += subsetMarks;

        summaryDetails.push({ topic: sub, qty: requestedQty });
      }
    } else {
      if (itemDiv) itemDiv.classList.remove('error-state');
    }
  });

  // Render Selection Summary List
  updateSummaryUI(totalMarks, selectedCount, summaryDetails);

  // Form level checks
  if (selectedCount === 0) {
    disableGenerate('Please select at least one subtopic and count.');
  } else if (validationErrors.length > 0) {
    disableGenerate(validationErrors[0]);
  } else {
    enableGenerate();
  }
}

// Update Summary Panel UI
function updateSummaryUI(marks, topicsCount, details) {
  totalMarksDisplay.textContent = marks;
  selectedTopicsCount.textContent = topicsCount;

  if (details.length === 0) {
    selectedDetailsList.innerHTML = '<p class="empty-selection-msg">No questions selected yet.</p>';
    return;
  }

  selectedDetailsList.innerHTML = details.map(item => `
    <div class="detail-row">
      <span class="detail-topic">${item.topic}</span>
      <span class="detail-qty">${item.qty} ${item.qty === 1 ? 'question' : 'questions'}</span>
    </div>
  `).join('');
}

// Enable/Disable Submit Button
function disableGenerate(errorMessage) {
  generateBtn.disabled = true;
  validationErrorBox.classList.remove('hidden');
  errorMessageText.textContent = errorMessage;
}

function enableGenerate() {
  generateBtn.disabled = false;
  validationErrorBox.classList.add('hidden');
}

// Clean ID for DOM manipulation
function cleanId(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

// Generate Paired PDF API Request
async function generateExamPaper() {
  const spinner = generateBtn.querySelector('.spinner');
  const btnText = generateBtn.querySelector('.btn-text');

  try {
    // Collect selected subtopics into ExamBlueprint
    const ExamBlueprint = [];
    document.querySelectorAll('.subtopic-checkbox:checked').forEach(chk => {
      const topic = chk.dataset.module;
      const subtopic = chk.dataset.subtopic;
      const subId = cleanId(subtopic);
      const qtyInput = document.getElementById(`qty-${subId}`);
      const qty = parseInt(qtyInput.value, 10) || 0;
      
      if (qty > 0) {
        ExamBlueprint.push({
          topic,
          subtopic,
          count: qty
        });
      }
    });

    if (ExamBlueprint.length === 0) {
      showToast('Please select at least one subtopic.', 'danger');
      return;
    }

    // Set loading state
    generateBtn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.textContent = 'Generating...';

    const payload = {
      subject: selectedSubject,
      ExamBlueprint,
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

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to generate');
    }

    // Get zip blob
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Direction_Classes_${selectedSubject.replace(/\s+/g, '_')}_Exam.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showToast('Exam packages downloaded successfully!', 'success');
  } catch (err) {
    console.error("[generate] Caught generation error:", err);
    showToast(`Error: ${err.message}`, 'danger');
  } finally {
    generateBtn.disabled = false;
    spinner.classList.add('hidden');
    btnText.textContent = 'Generate Paired PDFs';
    validateAndCalculate();
  }
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
