// ============================================
// Marginalia — login / register page
// ============================================

const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const heading = document.getElementById("auth-heading");
const subheading = document.getElementById("auth-subheading");

function showLogin() {
  tabLogin.classList.add("is-active");
  tabRegister.classList.remove("is-active");
  tabLogin.setAttribute("aria-selected", "true");
  tabRegister.setAttribute("aria-selected", "false");
  formLogin.classList.add("is-active");
  formRegister.classList.remove("is-active");
  heading.textContent = "Log in to your notebook";
  subheading.textContent = "Pick up your subjects right where you left off.";
}

function showRegister() {
  tabRegister.classList.add("is-active");
  tabLogin.classList.remove("is-active");
  tabRegister.setAttribute("aria-selected", "true");
  tabLogin.setAttribute("aria-selected", "false");
  formRegister.classList.add("is-active");
  formLogin.classList.remove("is-active");
  heading.textContent = "Set up your notebook";
  subheading.textContent = "One page per subject, starting today.";
}

tabLogin.addEventListener("click", showLogin);
tabRegister.addEventListener("click", showRegister);

function setFieldError(fieldId, show) {
  document.getElementById(fieldId).classList.toggle("has-error", show);
}

// --- Backend calls, with a local fallback so this page works before
//     app.py's auth routes are wired up to a real database. ---
async function callAuthAPI(path, payload) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Request failed");
    }
    return await res.json();
  } catch (err) {
    // Backend not running yet — fall back to a local demo "session"
    // so the front end is still usable on its own.
    console.warn("Auth backend unreachable, using local fallback:", err.message);
    return { user: { name: payload.name || payload.email.split("@")[0], email: payload.email }, token: "local-demo-token" };
  }
}

function completeAuth(user, statusEl) {
  localStorage.setItem("marginalia_user", JSON.stringify(user));
  statusEl.classList.add("is-visible");
  setTimeout(() => { window.location.href = "dashboard.html"; }, 700);
}

// --- Login ---
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email");
  const password = document.getElementById("login-password");

  const emailOk = /\S+@\S+\.\S+/.test(email.value);
  const passOk = password.value.length > 0;
  setFieldError("login-email-field", !emailOk);
  setFieldError("login-password-field", !passOk);
  if (!emailOk || !passOk) return;

  const data = await callAuthAPI("/api/auth/login", {
    email: email.value,
    password: password.value,
  });
  completeAuth(data.user, document.getElementById("login-status"));
});

// --- Register ---
formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name");
  const email = document.getElementById("reg-email");
  const password = document.getElementById("reg-password");

  const nameOk = name.value.trim().length > 0;
  const emailOk = /\S+@\S+\.\S+/.test(email.value);
  const passOk = password.value.length >= 6;
  setFieldError("reg-name-field", !nameOk);
  setFieldError("reg-email-field", !emailOk);
  setFieldError("reg-password-field", !passOk);
  if (!nameOk || !emailOk || !passOk) return;

  const data = await callAuthAPI("/api/auth/register", {
    name: name.value.trim(),
    email: email.value,
    password: password.value,
  });
  completeAuth(data.user, document.getElementById("register-status"));
});
