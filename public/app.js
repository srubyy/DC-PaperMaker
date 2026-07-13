// Global State
let selectedSubject = '';
let questionsMetadata = []; // [{ id, topic, subtopic, year, marks }]
let availableTopics = [];
let subtopicsGrouped = {};
let selectedMainTopic = '';
let headerBase64 = null;
let footerBase64 = null;

// DOM Elements
const subjectSelect = document.getElementById('subject-select');
const mainTopicGroup = document.getElementById('main-topic-group');
const mainTopicSelect = document.getElementById('main-topic-select');
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
  
  // Mathematics Main Topic change
  mainTopicSelect.addEventListener('change', (e) => {
    selectedMainTopic = e.target.value;
    if (selectedMainTopic) {
      availableTopics = subtopicsGrouped[selectedMainTopic] || [];
    } else {
      availableTopics = [];
    }
    renderTopicsList();
  });
  
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
      selectedMainTopic = '';
      if (selectedSubject === 'Mathematics') {
        mainTopicGroup.style.display = 'block';
      } else {
        mainTopicGroup.style.display = 'none';
      }
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

    if (subject === 'Mathematics') {
      availableTopics = [];
      mainTopicSelect.innerHTML = '<option value="">-- Choose Main Topic --</option>';
      data.topics.forEach(topic => {
        const opt = document.createElement('option');
        opt.value = topic;
        opt.textContent = topic;
        mainTopicSelect.appendChild(opt);
      });
      topicsListContainer.innerHTML = '<p class="info-text">Please choose a syllabus topic to view subtopics.</p>';
      validateAndCalculate();
    } else {
      availableTopics = data.topics;
      renderTopicsList();
    }
  } catch (err) {
    showToast('Failed to load subject topics.', 'danger');
    topicsListContainer.innerHTML = '<p class="info-text text-danger">Error loading topics.</p>';
  }
}

// Render Checkboxes and Quantities for Topics
function renderTopicsList() {
  if (availableTopics.length === 0) {
    topicsListContainer.innerHTML = '<p class="info-text">No topics found for this subject.</p>';
    return;
  }

  topicsListContainer.innerHTML = '';
  availableTopics.forEach(topic => {
    const item = document.createElement('div');
    item.className = 'topic-item';
    item.id = `item-${cleanId(topic)}`;

    item.innerHTML = `
      <label class="topic-checkbox-label" for="chk-${cleanId(topic)}">
        <input type="checkbox" id="chk-${cleanId(topic)}" data-topic="${topic}" class="topic-checkbox">
        <div style="display: flex; flex-direction: column;">
          <span class="topic-name">${topic}</span>
          <span class="topic-avail-badge" id="avail-${cleanId(topic)}">available: 0</span>
        </div>
      </label>
      <div class="topic-control">
        <input type="number" id="qty-${cleanId(topic)}" data-topic="${topic}" class="qty-input" min="1" value="1" disabled>
      </div>
    `;

    topicsListContainer.appendChild(item);
  });

  // Attach Event Listeners to New Controls
  document.querySelectorAll('.topic-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const topic = e.target.dataset.topic;
      const idStr = cleanId(topic);
      const qtyInput = document.getElementById(`qty-${idStr}`);
      const itemDiv = document.getElementById(`item-${idStr}`);

      qtyInput.disabled = !e.target.checked;
      
      if (e.target.checked) {
        itemDiv.classList.add('selected');
      } else {
        itemDiv.classList.remove('selected');
        itemDiv.classList.remove('error-state');
      }
      
      validateAndCalculate();
    });
  });

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

  if (selectedSubject === 'Mathematics' && !selectedMainTopic) {
    updateSummaryUI(0, 0, []);
    disableGenerate('Please choose a syllabus topic.');
    return;
  }

  if (availableTopics.length === 0) {
    updateSummaryUI(0, 0, []);
    disableGenerate('No subtopics found for this topic.');
    return;
  }

  const yearMin = parseInt(yearMinInput.value);
  const yearMax = parseInt(yearMaxInput.value);
  let totalMarks = 0;
  let selectedCount = 0;
  let validationErrors = [];
  let summaryDetails = [];

  availableTopics.forEach(topic => {
    const idStr = cleanId(topic);
    const checkbox = document.getElementById(`chk-${idStr}`);
    const qtyInput = document.getElementById(`qty-${idStr}`);
    const availBadge = document.getElementById(`avail-${idStr}`);
    const itemDiv = document.getElementById(`item-${idStr}`);

    // Filter metadata to find available questions in selected scope
    const availableQuestions = questionsMetadata.filter(q => {
      if (selectedSubject === 'Mathematics') {
        return q.subtopic === topic && q.year >= yearMin && q.year <= yearMax;
      } else {
        return q.topic === topic && q.year >= yearMin && q.year <= yearMax;
      }
    });

    const availableCount = availableQuestions.length;
    if (availBadge) {
      availBadge.textContent = `available: ${availableCount}`;
    }

    if (checkbox && checkbox.checked) {
      const requestedQty = parseInt(qtyInput.value, 10) || 0;
      selectedCount++;

      // Check overflow error
      const categoryLabel = selectedSubject === 'Mathematics' ? 'Subtopic' : 'Topic';
      if (requestedQty > availableCount) {
        if (itemDiv) itemDiv.classList.add('error-state');
        validationErrors.push(`${categoryLabel} "${topic}": requested ${requestedQty} questions, but only ${availableCount} available.`);
      } else if (requestedQty <= 0) {
        if (itemDiv) itemDiv.classList.add('error-state');
        validationErrors.push(`${categoryLabel} "${topic}": requested count must be at least 1.`);
      } else {
        if (itemDiv) itemDiv.classList.remove('error-state');
        
        // Sum marks of the first N questions (sorted by ID for stability)
        const sortedSubset = [...availableQuestions]
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, requestedQty);
          
        const subsetMarks = sortedSubset.reduce((sum, q) => sum + q.marks, 0);
        totalMarks += subsetMarks;

        summaryDetails.push({ topic, qty: requestedQty });
      }
    } else {
      if (itemDiv) itemDiv.classList.remove('error-state');
    }
  });

  // Render Selection Summary List
  updateSummaryUI(totalMarks, selectedCount, summaryDetails);

  // Form level checks
  if (selectedCount === 0) {
    disableGenerate('Select at least one topic and request at least 1 question.');
    return;
  }

  if (validationErrors.length > 0) {
    disableGenerate(validationErrors[0]); // Display first validation error
    return;
  }

  // If valid, enable generate button
  enableGenerate();
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
    // Collect topic selections
    const topicSelections = {};
    let activeSelection = false;

    availableTopics.forEach(topic => {
      const idStr = cleanId(topic);
      const checkbox = document.getElementById(`chk-${idStr}`);
      const qtyInput = document.getElementById(`qty-${idStr}`);

      if (checkbox && checkbox.checked) {
        const qty = parseInt(qtyInput.value, 10);
        if (qty > 0) {
          topicSelections[topic] = qty;
          activeSelection = true;
        }
      }
    });

    if (!activeSelection) {
      showToast('Please select at least one topic.', 'danger');
      return;
    }

    // Set loading state
    generateBtn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.textContent = 'Generating...';

    const payload = {
      subject: selectedSubject,
      topicSelections,
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
