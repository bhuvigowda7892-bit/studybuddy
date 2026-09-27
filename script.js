// ============================================
// Marginalia — front-end behavior
// ============================================

// Smooth-scroll for any element with data-scroll-to
document.querySelectorAll("[data-scroll-to]").forEach((el) => {
  el.addEventListener("click", () => {
    const target = document.querySelector(el.dataset.scrollTo);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

// Auto-grow the chat textarea
const chatInput = document.getElementById("chat-input");
if (chatInput) {
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = chatInput.scrollHeight + "px";
  });
}

// ---------------------------------------------
// Chat demo
//
// This calls sendToBackend() below. Right now that function fakes a
// reply locally so the page works with zero setup. Swap in the fetch()
// call (commented out inside sendToBackend) once your Python API is
// running — see README.md.
// ---------------------------------------------
const chatForm = document.getElementById("chat-form");
const chatLog = document.getElementById("chat-log");

function appendMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;
  const p = document.createElement("p");
  p.textContent = text;
  msg.appendChild(p);
  chatLog.appendChild(msg);
  chatLog.scrollTop = chatLog.scrollHeight;
  return msg;
}

function appendTypingIndicator() {
  const msg = document.createElement("div");
  msg.className = "msg tutor";
  msg.id = "typing-indicator";
  msg.innerHTML = `<p style="opacity:.6">thinking…</p>`;
  chatLog.appendChild(msg);
  chatLog.scrollTop = chatLog.scrollHeight;
  return msg;
}

// A small set of Socratic-style fallback replies so the demo feels
// alive before a real model is wired up. Replace with your backend.
const FALLBACK_REPLIES = [
  "Before I answer — what's your best guess, even if you're not sure it's right?",
  "What part of this would you say you already understand, and where does it start to slip?",
  "If you had to explain this to a classmate in one sentence, what would you say?",
  "What have you already tried, and what happened when you did?",
  "Let's back up one step — what's the definition of the term you're stuck on?",
];

async function sendToBackend(userText, history) {
  // --- Local fallback (no backend required) ---
  await new Promise((res) => setTimeout(res, 650 + Math.random() * 500));
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];

  // --- Once your Python backend is running, replace the two lines
  //     above with something like this: ---
  //
  // const response = await fetch("/api/chat", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ message: userText, history }),
  // });
  // if (!response.ok) throw new Error("Backend request failed");
  // const data = await response.json();
  // return data.reply;
}

let history = [];

if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage("student", text);
    history.push({ role: "user", content: text });
    chatInput.value = "";
    chatInput.style.height = "auto";

    const indicator = appendTypingIndicator();

    try {
      const reply = await sendToBackend(text, history);
      indicator.remove();
      appendMessage("tutor", reply);
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      indicator.remove();
      appendMessage(
        "tutor",
        "Couldn't reach the study backend just now — check that your Python server is running."
      );
      console.error(err);
    }
  });
}
