const shell = document.querySelector(".auth-shell");
const signupForm = document.querySelector("#signupForm");
const loginForm = document.querySelector("#loginForm");
const sessionPanel = document.querySelector("#sessionPanel");
const sessionTitle = sessionPanel?.querySelector("h2");
const sessionSummary = document.querySelector("#sessionSummary");
const sessionDetails = document.querySelector("#sessionDetails");
const roleSelection = document.querySelector("#roleSelection");
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
  organization_admin: "Organization Admin",
  requester: "Requester",
  supervisor: "Supervisor",
  safety_officer: "Safety Officer",
  approver: "Supervisor",
  admin: "Admin",
  worker: "Worker",
};

const rolePriority = ["organization_admin", "admin", "safety_officer", "supervisor", "requester", "worker"];

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
    if (page === "organization") return "/organization.html";
    if (page === "safety") return "/safety.html";
    if (page === "review") return "/supervisor.html";
    if (page === "approver") return "/supervisor.html";
    if (page === "worker") return "/worker.html";
    return "/dashboard.html";
  }

  return `/${page}`;
}

function getRoleDestination(role) {
  if (role === "requester") return getAppUrl("dashboard");
  if (role === "organization_admin") return getAppUrl("organization");
  if (role === "admin") return getAppUrl("admin");
  if (role === "safety_officer") return getAppUrl("safety");
  if (role === "supervisor") return getAppUrl("review");
  if (role === "worker") return getAppUrl("worker");
  return "";
}

function setMode(mode) {
  shell.dataset.mode = mode;
  modeToggle?.classList.remove("is-hidden");
  signupForm.classList.toggle("is-hidden", mode !== "signup");
  loginForm.classList.toggle("is-hidden", mode !== "login");
  sessionPanel.classList.add("is-hidden");
  if (roleSelection) roleSelection.innerHTML = "";
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
      "Sign up to create your organization workspace, streamline permits, manage compliance, and ensure every worker returns home safely.";
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

function writeSession(payload) {
  const storage = localStorage.getItem("ptwSession") ? localStorage : sessionStorage;
  storage.setItem("ptwSession", JSON.stringify(payload));
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

  if (sessionTitle) sessionTitle.textContent = "Access Granted";
  if (roleSelection) roleSelection.innerHTML = "";
  sessionSummary.textContent = `${user.fullName} is signed in to PTW Guardian.`;
  sessionDetails.replaceChildren();
  appendDetail("Employee ID", user.employeeId);
  appendDetail("Role", getUserRoles(user).map((role) => roleLabels[role] || role).join(", "));
  appendDetail("Email", user.email);
  appendDetail("Organization", user.organization);
}

function getUserRoles(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
  return roles
    .map((role) => String(role || "").trim().toLowerCase())
    .map((role) => role === "approver" ? "supervisor" : role)
    .filter(Boolean)
    .filter((role, index, list) => list.indexOf(role) === index)
    .sort((a, b) => {
      const aIndex = rolePriority.indexOf(a);
      const bIndex = rolePriority.indexOf(b);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
}

function getPreferredRole(user) {
  const roles = getUserRoles(user);
  return rolePriority.find((role) => roles.includes(role)) || "";
}

function setActiveRoleAndRedirect(role) {
  const session = readSession();
  if (session?.user && getUserRoles(session.user).includes(role)) {
    writeSession({ ...session, activeRole: role });
  }

  const destination = getRoleDestination(role);
  if (destination) {
    window.location.href = destination;
    return true;
  }

  return false;
}

function getRoleDescription(role) {
  if (role === "admin") return "Worker review and draft routing";
  if (role === "organization_admin") return "Organization users and workspace settings";
  if (role === "safety_officer") return "MOS Approval and safety review";
  if (role === "supervisor") return "Permit Approval and work release";
  if (role === "requester") return "Create and monitor permit requests";
  if (role === "worker") return "Assigned work and closure actions";
  return "Open dashboard";
}

function renderRoleSelection(user) {
  const roles = getUserRoles(user);
  modeToggle?.classList.add("is-hidden");
  signupForm.classList.add("is-hidden");
  loginForm.classList.add("is-hidden");
  sessionPanel.classList.remove("is-hidden");
  if (sessionTitle) sessionTitle.textContent = "Select Role";
  sessionSummary.textContent = `${user.fullName || user.email || "User"} has multiple access roles.`;
  sessionDetails.replaceChildren();
  appendDetail("Employee ID", user.employeeId || "-");
  appendDetail("Available Roles", roles.map((role) => roleLabels[role] || role).join(", "));
  if (!roleSelection) return;
  roleSelection.innerHTML = roles
    .map((role) => `
      <button class="role-option-button" type="button" data-role-choice="${role}">
        <strong>${roleLabels[role] || role}</strong>
        <span>${getRoleDescription(role)}</span>
      </button>
    `)
    .join("");
}

function handleAuthenticatedSession(payload, remember) {
  const roles = getUserRoles(payload?.user);
  if (roles.length === 1) {
    saveSession({ ...payload, activeRole: roles[0] }, remember);
    return setActiveRoleAndRedirect(roles[0]);
  }

  if (roles.length > 1) {
    const activeRole = roles.includes(payload?.activeRole) ? payload.activeRole : "";
    saveSession({ ...payload, activeRole }, remember);
    if (activeRole) return setActiveRoleAndRedirect(activeRole);
    renderRoleSelection(payload.user);
    return true;
  }

  saveSession(payload, remember);
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
  const password = data.get("password");
  const confirmPassword = data.get("confirmPassword");

  if (password !== confirmPassword) {
    setBusy(signupForm, false);
    setMessage(signupMessage, "Passwords do not match.");
    return;
  }

  try {
    const result = await apiRequest("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        fullName: data.get("fullName"),
        email: data.get("email"),
        organization: data.get("organization"),
        companyRegistrationNo: data.get("companyRegistrationNo"),
        password,
        confirmPassword,
        acceptTerms: data.get("acceptTerms") === "on",
      }),
    });

    setMessage(signupMessage, "Organization registered.", "success");
    saveSession({ ...result, activeRole: "organization_admin" }, true);
    window.location.href = getAppUrl("organization");
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

    setMessage(loginMessage, "Signed in.", "success");
    if (handleAuthenticatedSession(result, data.get("remember") === "on")) {
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
    const roles = getUserRoles(existingSession.user);
    const activeRole = roles.includes(existingSession.activeRole) ? existingSession.activeRole : "";
    if (roles.length > 1 && !activeRole) {
      renderRoleSelection(existingSession.user);
      return;
    }
    if (activeRole && setActiveRoleAndRedirect(activeRole)) return;
    if (roles.length === 1 && setActiveRoleAndRedirect(roles[0])) return;
    if (!isAuthRoute) renderSession(existingSession.user);
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

roleSelection?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-role-choice]");
  if (!button) return;
  setActiveRoleAndRedirect(button.dataset.roleChoice);
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
