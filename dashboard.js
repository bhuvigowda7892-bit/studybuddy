// ============================================
// Marginalia — dashboard page
// ============================================

// --- Auth guard ---
// Real auth should check a server-issued session/token; this reads the
// same localStorage value auth.js writes after login/register so the
// page works stand-alone before a backend session is wired up.
const rawUser = localStorage.getItem("marginalia_user");
if (!rawUser) {
  window.location.href = "login.html";
}
const user = rawUser ? JSON.parse(rawUser) : { name: "Student" };

document.getElementById("user-name").textContent = user.name;
document.getElementById("user-avatar").textContent = user.name.charAt(0).toUpperCase();
document.getElementById("sidebar-greeting").textContent = `Welcome back, ${user.name.split(" ")[0]}`;

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("marginalia_user");
  window.location.href = "index.html";
});

// Sidebar active-link highlighting on click
document.querySelectorAll(".sidebar-nav a[href^='#'], .app-nav-links a[href^='#']").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-nav a, .app-nav-links a").forEach((a) => a.classList.remove("is-active"));
    document.querySelectorAll(`a[href="${link.getAttribute("href")}"]`).forEach((a) => a.classList.add("is-active"));
  });
});

// --- Stats (read from localStorage; app.py can replace this with a
//     real /api/stats endpoint once accounts are backed by a database) ---
const stats = JSON.parse(localStorage.getItem("marginalia_stats") || "{}");
document.getElementById("stat-materials").textContent = stats.materials || 0;
document.getElementById("stat-quizzes").textContent = stats.quizzes || 0;
document.getElementById("stat-flashcards").textContent = stats.flashcards || 0;
document.getElementById("stat-streak").textContent = stats.streak || 0;

// --- Ask AI mini chat (same fallback behavior as the home page demo) ---
const dashChatForm = document.getElementById("dash-chat-form");
const dashChatLog = document.getElementById("dash-chat-log");
const dashChatInput = document.getElementById("dash-chat-input");

const FALLBACK_REPLIES = [
  "Before I answer — what's your best guess, even if you're not sure it's right?",
  "What part of this would you say you already understand, and where does it start to slip?",
  "If you had to explain this to a classmate in one sentence, what would you say?",
  "What have you already tried, and what happened when you did?",
  "Let's back up one step — what's the definition of the term you're stuck on?",
];

function appendDashMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;
  const p = document.createElement("p");
  p.textContent = text;
  msg.appendChild(p);
  dashChatLog.appendChild(msg);
  dashChatLog.scrollTop = dashChatLog.scrollHeight;
}

let dashHistory = [];

dashChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = dashChatInput.value.trim();
  if (!text) return;
  appendDashMessage("student", text);
  dashHistory.push({ role: "user", content: text });
  dashChatInput.value = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: dashHistory }),
    });
    if (!res.ok) throw new Error("backend unavailable");
    const data = await res.json();
    appendDashMessage("tutor", data.reply);
    dashHistory.push({ role: "assistant", content: data.reply });
  } catch {
    const reply = FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
    appendDashMessage("tutor", reply);
    dashHistory.push({ role: "assistant", content: reply });
  }
});

// --- Study planner ---
const DEFAULT_PLAN = [
  { day: "Mon", task: "Review Organic Chem Ch. 7 flashcards", done: false },
  { day: "Mon", task: "10 practice problems — SN1 vs SN2", done: false },
  { day: "Tue", task: "Re-read summary of uploaded Bio notes", done: false },
  { day: "Wed", task: "Take the generated quiz on Ch. 7", done: false },
  { day: "Thu", task: "Draft essay outline for English", done: false },
  { day: "Fri", task: "Weekly review — everything missed this week", done: false },
];

function loadPlan() {
  const saved = localStorage.getItem("marginalia_planner");
  return saved ? JSON.parse(saved) : DEFAULT_PLAN;
}
function savePlan(plan) {
  localStorage.setItem("marginalia_planner", JSON.stringify(plan));
}

function renderPlanner() {
  const plan = loadPlan();
  const list = document.getElementById("planner-list");
  list.innerHTML = "";
  plan.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "planner-item";
    li.innerHTML = `
      <input type="checkbox" ${item.done ? "checked" : ""} id="plan-${i}">
      <span class="planner-day">${item.day}</span>
      <label class="planner-task ${item.done ? "is-done" : ""}" for="plan-${i}">${item.task}</label>
    `;
    li.querySelector("input").addEventListener("change", (e) => {
      const plan = loadPlan();
      plan[i].done = e.target.checked;
      savePlan(plan);
      renderPlanner();
    });
    list.appendChild(li);
  });
}
renderPlanner();

// --- Progress roadmap ---
// Status derives from the stats above so it reflects real usage once
// upload.html and the chat start writing to marginalia_stats.
const ROADMAP_STEPS = [
  { title: "Create your account", desc: "You're in — your notebook is ready.", done: true },
  { title: "Upload your first material", desc: "A PDF, notes, or slides to build your first summary from.", done: (stats.materials || 0) > 0 },
  { title: "Take your first quiz", desc: "Generated automatically from whatever you upload.", done: (stats.quizzes || 0) > 0 },
  { title: "Review a flashcard set", desc: "Short, spaced review beats one long cram session.", done: (stats.flashcards || 0) > 0 },
  { title: "Build a 3-day streak", desc: "Consistency compounds more than any single session.", done: (stats.streak || 0) >= 3 },
];

function renderRoadmap() {
  const el = document.getElementById("roadmap");
  el.innerHTML = "";
  let currentAssigned = false;
  ROADMAP_STEPS.forEach((step) => {
    const isCurrent = !step.done && !currentAssigned;
    if (isCurrent) currentAssigned = true;
    const div = document.createElement("div");
    div.className = `roadmap-step ${step.done ? "is-done" : isCurrent ? "is-current" : ""}`;
    div.innerHTML = `
      <span class="roadmap-dot"></span>
      <div class="roadmap-body">
        <h4>${step.title}${isCurrent ? '<span class="roadmap-tag">up next</span>' : ""}</h4>
        <p>${step.desc}</p>
      </div>
    `;
    el.appendChild(div);
  });
}
renderRoadmap();
