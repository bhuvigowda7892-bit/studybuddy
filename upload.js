// ============================================
// Marginalia — upload page
// ============================================

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const fileChipWrap = document.getElementById("file-chip-wrap");
const processingNote = document.getElementById("processing-note");
const processingText = document.getElementById("processing-text");
const resultsEl = document.getElementById("results");

// --- Dropzone interactions ---
dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("is-dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("is-dragover");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (file.type !== "application/pdf") {
    alert("Please choose a PDF file.");
    return;
  }
  showFileChip(file);
  processMaterial(file);
}

function showFileChip(file) {
  fileChipWrap.innerHTML = `
    <div class="file-chip">
      <span>${file.name}</span>
      <button type="button" class="remove-file" aria-label="Remove file">✕</button>
    </div>
  `;
  fileChipWrap.querySelector(".remove-file").addEventListener("click", () => {
    fileChipWrap.innerHTML = "";
    fileInput.value = "";
    resultsEl.style.display = "none";
    processingNote.style.display = "none";
  });
}

// --- Upload + generate ---
async function processMaterial(file) {
  resultsEl.style.display = "none";
  processingNote.style.display = "flex";
  processingText.textContent = "Reading your PDF and generating study material…";

  try {
    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch("/api/materials/upload", { method: "POST", body: formData });
    if (!uploadRes.ok) throw new Error("upload failed");
    const { material_id } = await uploadRes.json();

    const genRes = await fetch("/api/materials/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ material_id }),
    });
    if (!genRes.ok) throw new Error("generation failed");
    const data = await genRes.json();

    renderResults(data);
  } catch (err) {
    console.warn("Backend unavailable, showing local demo content:", err.message);
    renderResults(mockGenerate(file.name));
  } finally {
    processingNote.style.display = "none";
    resultsEl.style.display = "block";
    bumpMaterialsStat();
  }
}

function bumpMaterialsStat() {
  const stats = JSON.parse(localStorage.getItem("marginalia_stats") || "{}");
  stats.materials = (stats.materials || 0) + 1;
  localStorage.setItem("marginalia_stats", JSON.stringify(stats));
}

// --- Local fallback content, used when app.py's generate endpoint
//     isn't running yet. Swap this out once your backend calls a real
//     model — see app.py's /api/materials/generate for where that goes. ---
function mockGenerate(filename) {
  const topic = filename.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
  return {
    explanation: [
      `Here's ${topic} in plain terms: think of it as a set of related ideas that build on each other, each one only making sense once the last one clicks.`,
      "Once your Python backend is connected to a real model, this panel will explain the actual content of your PDF instead of this placeholder — see the generate() function in app.py.",
    ],
    summary: [
      `A short summary of ${topic} would normally appear here, pulled from the text extracted out of your PDF.`,
      "Connect ANTHROPIC_API_KEY (or your model of choice) in app.py to replace this with a real summary.",
    ],
    quiz: [
      {
        question: `Which statement best matches how ${topic} was just introduced?`,
        options: ["It builds on ideas covered earlier in the material", "It has no connection to anything else in the document", "It only appears in the appendix", "It contradicts the summary above"],
        correct: 0,
      },
      {
        question: "Once connected to a backend, where would real quiz questions come from?",
        options: ["Random generation with no source text", "The extracted text of your uploaded PDF", "A fixed question bank", "They wouldn't be generated at all"],
        correct: 1,
      },
    ],
    flashcards: [
      { front: topic, back: "Definition generated from your PDF will appear here." },
      { front: "Key term #2", back: "Its explanation will appear here once connected." },
      { front: "Key term #3", back: "Its explanation will appear here once connected." },
    ],
    plan: [
      { day: "Day 1", task: `Read through the ${topic} summary and explanation`, minutes: 20 },
      { day: "Day 2", task: "Take the generated quiz, note anything missed", minutes: 15 },
      { day: "Day 3", task: "Review flashcards until each one is easy", minutes: 15 },
      { day: "Day 5", task: "Quick re-quiz to check retention", minutes: 10 },
    ],
  };
}

// --- Rendering ---
function renderResults(data) {
  document.getElementById("tab-explanation").innerHTML = data.explanation.map((p) => `<p>${p}</p>`).join("");
  document.getElementById("tab-summary").innerHTML = data.summary.map((p) => `<p>${p}</p>`).join("");
  renderQuiz(data.quiz);
  renderFlashcards(data.flashcards);
  renderPlan(data.plan);
}

function renderQuiz(questions) {
  const el = document.getElementById("tab-quiz");
  el.innerHTML = "";
  questions.forEach((q, qi) => {
    const block = document.createElement("div");
    block.className = "quiz-q";
    block.innerHTML = `<h4>${qi + 1}. ${q.question}</h4>`;
    q.options.forEach((opt, oi) => {
      const label = document.createElement("label");
      label.className = "quiz-opt";
      label.innerHTML = `<input type="radio" name="q${qi}"> ${opt}`;
      label.querySelector("input").addEventListener("change", () => {
        block.querySelectorAll(".quiz-opt").forEach((o, i) => {
          o.classList.remove("is-correct", "is-wrong");
          if (i === q.correct) o.classList.add("is-correct");
        });
        if (oi !== q.correct) label.classList.add("is-wrong");
        bumpQuizStat();
      });
      block.appendChild(label);
    });
    el.appendChild(block);
  });
}

function bumpQuizStat() {
  const stats = JSON.parse(localStorage.getItem("marginalia_stats") || "{}");
  stats.quizzes = (stats.quizzes || 0) + 1;
  localStorage.setItem("marginalia_stats", JSON.stringify(stats));
}

function renderFlashcards(cards) {
  const grid = document.querySelector("#tab-flashcards .flash-grid");
  grid.innerHTML = "";
  cards.forEach((card) => {
    const el = document.createElement("div");
    el.className = "flashcard";
    el.innerHTML = `
      <div class="flashcard-inner">
        <div class="flashcard-face flashcard-front">${card.front}</div>
        <div class="flashcard-face flashcard-back">${card.back}</div>
      </div>
    `;
    el.addEventListener("click", () => {
      el.classList.toggle("is-flipped");
      const stats = JSON.parse(localStorage.getItem("marginalia_stats") || "{}");
      stats.flashcards = (stats.flashcards || 0) + 1;
      localStorage.setItem("marginalia_stats", JSON.stringify(stats));
    });
    grid.appendChild(el);
  });
}

function renderPlan(plan) {
  const el = document.getElementById("tab-plan");
  const rows = plan.map((p) => `
    <tr>
      <td>${p.day}</td>
      <td>${p.task}</td>
      <td>${p.minutes} min</td>
    </tr>
  `).join("");
  el.innerHTML = `
    <table class="plan-table">
      <thead><tr><th>Day</th><th>Task</th><th>Time</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// --- Tabs ---
document.querySelectorAll(".result-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".result-tab").forEach((t) => t.classList.remove("is-active"));
    document.querySelectorAll(".result-panel").forEach((p) => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.getElementById(tab.dataset.tab).classList.add("is-active");
  });
});
