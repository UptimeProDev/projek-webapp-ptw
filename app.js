const shell = document.querySelector(".auth-shell");
const signupForm = document.querySelector("#signupForm");
const loginForm = document.querySelector("#loginForm");
const sessionPanel = document.querySelector("#sessionPanel");
const sessionSummary = document.querySelector("#sessionSummary");
const sessionDetails = document.querySelector("#sessionDetails");
const signupMessage = document.querySelector("#signupMessage");
const loginMessage = document.querySelector("#loginMessage");
const signupPassword = document.querySelector("#signupPassword");
const passwordMeterBar = document.querySelector("#passwordMeterBar");
const passwordMeterText = document.querySelector("#passwordMeterText");
const togglePassword = document.querySelector("#togglePassword");
const loginPassword = document.querySelector("#loginPassword");
const logoutButton = document.querySelector("#logoutButton");
const visualEyebrow = document.querySelector("#visualEyebrow");
const visualTitle = document.querySelector("#visualTitle");
const visualBody = document.querySelector("#visualBody");
const visualMetrics = document.querySelector("#visualMetrics");
const modeToggle = document.querySelector(".mode-toggle");

const roleLabels = {
  requester: "Requester",
  supervisor: "Supervisor",
  safety_officer: "Safety Officer",
  approver: "Supervisor",
  admin: "Admin",
  worker: "Contractor / Worker",
};

function isStaticHtmlPage() {
  return location.protocol === "file:" || /\.html$/i.test(location.pathname);
}

function getAuthUrl(mode) {
  if (isStaticHtmlPage()) {
    return `${location.pathname || "/index.html"}#${mode}`;
  }

  return mode === "login" ? "/login" : "/signup";
}

function getAppUrl(page) {
  if (isStaticHtmlPage()) {
    if (page === "admin") return "/admin.html";
    if (page === "safety") return "/safety.html";
    if (page === "review") return "/supervisor.html";
    if (page === "approver") return "/supervisor.html";
    if (page === "worker") return "/worker.html";
    return "/dashboard.html";
  }

  return `/${page}`;
}

function setMode(mode) {
  shell.dataset.mode = mode;
  modeToggle?.classList.remove("is-hidden");
  signupForm.classList.toggle("is-hidden", mode !== "signup");
  loginForm.classList.toggle("is-hidden", mode !== "login");
  sessionPanel.classList.add("is-hidden");
  signupMessage.textContent = "";
  loginMessage.textContent = "";
  signupMessage.classList.remove("success");
  loginMessage.classList.remove("success");

  if (mode === "login") {
    visualEyebrow.textContent = "";
    visualTitle.textContent = "Industrial Safety Compliance Division.";
    visualBody.textContent =
      "Secure authorization portal for Permit To Work (PTW) management, real-time hazard monitoring, and industrial safety orchestration. Your safety is our standard.";
    visualMetrics.innerHTML = `
      <div><span>Active Sites</span><strong>142</strong></div>
      <div><span>Compliance Rate</span><strong>99.9%</strong></div>
    `;
  } else {
    visualEyebrow.textContent = "Compliance Redefined";
    visualTitle.textContent = "Secure the Future of Industrial Safety.";
    visualBody.textContent =
      "Join the PTW Guardian network to streamline permits, manage compliance, and ensure every worker returns home safely.";
    visualMetrics.innerHTML = `
      <div><span>ISO 27001 Certified</span></div>
      <div><span>256-bit Encryption</span></div>
    `;
  }

  document.querySelectorAll("[data-switch]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.switch === mode);
  });
}

function getInitialMode() {
  if (location.hash === "#login") {
    return "login";
  }

  if (location.hash === "#signup") {
    return "signup";
  }

  return location.pathname === "/login" ? "login" : "signup";
}

function setMessage(element, message, type = "error") {
  element.textContent = message;
  element.classList.toggle("success", type === "success");
}

function getErrorMessage(error) {
  if (Array.isArray(error.errors)) {
    return error.errors.join(". ");
  }

  return error.error || "Request failed. Please try again.";
}

function getApiBase() {
  const { protocol } = window.location;

  if (protocol === "file:") {
    return "http://localhost:3000";
  }

  return "";
}

const API_BASE = getApiBase();

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw body;
  }

  return body;
}

function setBusy(form, isBusy) {
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = isBusy;
}

function saveSession(payload, remember) {
  const serialized = JSON.stringify(payload);
  const storage = remember ? localStorage : sessionStorage;
  clearSessionStorage();
  storage.setItem("ptwSession", serialized);
}

function readSession() {
  const stored =
    localStorage.getItem("ptwSession") || sessionStorage.getItem("ptwSession");

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch {
    clearSessionStorage();
    return null;
  }
}

function clearSessionStorage() {
  localStorage.removeItem("ptwSession");
  sessionStorage.removeItem("ptwSession");
}

function appendDetail(label, value) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = value;
  row.append(term, description);
  sessionDetails.append(row);
}

function renderSession(user) {
  modeToggle?.classList.add("is-hidden");
  signupForm.classList.add("is-hidden");
  loginForm.classList.add("is-hidden");
  sessionPanel.classList.remove("is-hidden");

  sessionSummary.textContent = `${user.fullName} is signed in to PTW Guardian.`;
  sessionDetails.replaceChildren();
  appendDetail("Employee ID", user.employeeId);
  appendDetail("Role", roleLabels[user.role] || user.role);
  appendDetail("Email", user.email);
  appendDetail("Organization", user.organization);
}

function redirectToDashboard(payload) {
  const role = String(payload?.user?.role || "").trim().toLowerCase();

  if (role === "requester") {
    window.location.href = getAppUrl("dashboard");
    return true;
  }

  if (["admin", "safety_officer"].includes(role)) {
    window.location.href = getAppUrl(role === "safety_officer" ? "safety" : "admin");
    return true;
  }

  if (role === "supervisor") {
    window.location.href = getAppUrl("review");
    return true;
  }

  if (role === "approver") {
    window.location.href = getAppUrl("review");
    return true;
  }

  if (role === "worker") {
    window.location.href = getAppUrl("worker");
    return true;
  }

  return false;
}

function calculatePasswordScore(password) {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  return score;
}

function updatePasswordMeter() {
  const password = signupPassword.value;
  const score = calculatePasswordScore(password);
  const width = Math.min(score * 20, 100);

  passwordMeterBar.style.width = `${width}%`;

  if (!password) {
    passwordMeterBar.style.background = "#9a9fa5";
    passwordMeterText.textContent = "Enter password";
    return;
  }

  if (score <= 2) {
    passwordMeterBar.style.background = "#9b1c1c";
    passwordMeterText.textContent = "Weak";
  } else if (score <= 4) {
    passwordMeterBar.style.background = "#a66a00";
    passwordMeterText.textContent = "Stable";
  } else {
    passwordMeterBar.style.background = "#137a3d";
    passwordMeterText.textContent = "Strong";
  }
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(signupForm, true);
  setMessage(signupMessage, "");

  const data = new FormData(signupForm);

  try {
    const result = await apiRequest("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        fullName: data.get("fullName"),
        email: data.get("email"),
        organization: data.get("organization"),
        role: data.get("role"),
        password: data.get("password"),
        acceptTerms: data.get("acceptTerms") === "on",
      }),
    });

    saveSession(result, true);
    setMessage(signupMessage, "Account created.", "success");
    if (redirectToDashboard(result)) {
      return;
    }
    renderSession(result.user);
  } catch (error) {
    setMessage(signupMessage, getErrorMessage(error));
  } finally {
    setBusy(signupForm, false);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(loginForm, true);
  setMessage(loginMessage, "");

  const data = new FormData(loginForm);

  try {
    const result = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        login: data.get("login"),
        password: data.get("password"),
      }),
    });

    saveSession(result, data.get("remember") === "on");
    setMessage(loginMessage, "Signed in.", "success");
    if (redirectToDashboard(result)) {
      return;
    }
    renderSession(result.user);
  } catch (error) {
    setMessage(loginMessage, getErrorMessage(error));
  } finally {
    setBusy(loginForm, false);
  }
});

logoutButton?.addEventListener("click", async () => {
  try {
    const session = readSession();
    if (session?.token) {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });
    }
  } catch {
    // ignore logout errors, but clear local session anyway
  } finally {
    clearSessionStorage();
    window.location.assign(getAuthUrl("login"));
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const existingSession = readSession();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";

  if (existingSession && existingSession.user) {
    if (redirectToDashboard(existingSession)) {
      return;
    }
    if (!isAuthRoute) {
      renderSession(existingSession.user);
      return;
    }
  }

  setMode(getInitialMode());
});

document.querySelectorAll("[data-switch]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.switch;
    history.replaceState(null, "", getAuthUrl(mode));
    setMode(mode);
  });
});

signupPassword.addEventListener("input", updatePasswordMeter);

togglePassword.addEventListener("click", () => {
  const willShow = loginPassword.type === "password";
  loginPassword.type = willShow ? "text" : "password";
  togglePassword.setAttribute(
    "aria-label",
    willShow ? "Hide password" : "Show password",
  );
});
