const appWorkspace = document.querySelector("#appWorkspace");
const accessState = document.querySelector("#accessState");
const demoLoginButton = document.querySelector("#demoLoginButton");
const accessLoginButton = document.querySelector("#accessLoginButton");
const logoutButton = document.querySelector("#logoutButton");
const userAvatar = document.querySelector("#userAvatar");
const profileName = document.querySelector("#profileName");
const profileRole = document.querySelector("#profileRole");
const globalSearch = document.querySelector("#globalSearch");
const toast = document.querySelector("#toast");
const workerDialog = document.querySelector("#workerDialog");
const workerForm = document.querySelector("#workerForm");
const workerDialogTitle = document.querySelector("#workerDialogTitle");
const inviteDialog = document.querySelector("#inviteDialog");
const inviteForm = document.querySelector("#inviteForm");

const STORAGE_KEYS = {
  draft: "ptwRequesterWizardDraft",
  workers: "ptwRequesterWorkers",
  permitMeta: "ptwRequesterPermitMeta",
  offlinePermits: "ptwRequesterOfflinePermits",
};

const OFFLINE_TOKEN = "offline-demo-requester";

const hazardOptions = [
  "Hot Work",
  "Confined Space",
  "Working at Height",
  "Electrical",
  "Chemical Handling",
];

const permitTypes = [
  "Hot Work",
  "Confined Space",
  "Work at Height",
  "Electrical Isolation",
  "General PTW",
];

const defaultControls = [
  "1. Ensure proper scaffolding with safety rails.",
  "2. 100% tie-off required above 2 meters.",
  "3. Fire watcher present during hot work phase.",
].join("\n");

let session = readSession();
let state = {
  activeView: "dashboard",
  dashboardData: null,
  permits: readJsonStorage(STORAGE_KEYS.offlinePermits, []),
  permitMeta: readJsonStorage(STORAGE_KEYS.permitMeta, {}),
  draft: readJsonStorage(STORAGE_KEYS.draft, createDefaultDraft()),
  wizardStep: 1,
  workers: readJsonStorage(STORAGE_KEYS.workers, createDefaultWorkers()),
  selectedWorkerId: "mike-smith",
  editingWorkerId: null,
  qualifiedOnly: false,
  roleFilter: "all",
  search: "",
  busy: false,
};

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

function saveSession(payload, remember = true) {
  const storage = remember ? localStorage : sessionStorage;
  clearSessionStorage();
  storage.setItem("ptwSession", JSON.stringify(payload));
  session = payload;
}

function readJsonStorage(key, fallback) {
  const stored = localStorage.getItem(key);

  if (!stored) {
    return fallback;
  }

  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function createDefaultDraft() {
  const start = new Date();
  start.setHours(start.getHours() + 2, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 4);

  return {
    title: "Substation cable tray hot work",
    permitType: "Hot Work",
    location: "Main Plant Alpha - Sector 4",
    area: "Main Plant Alpha (Sector 4)",
    startDateTime: toLocalDateTime(start),
    endDateTime: toLocalDateTime(end),
    scope:
      "Welding support brackets and rerouting cable tray near Substation A. Work boundary includes scaffold bay 2 and adjacent isolation panel.",
    hazards: ["Hot Work", "Working at Height"],
    likelihood: 3,
    severity: 3,
    controls: defaultControls,
    ppe: "Fire resistant coveralls, gloves, face shield, harness",
    approvers: "supervisor@example.com, safety@example.com",
    fileNames: [],
    selectedWorkers: ["marcus-thorne"],
    invitedContractors: [],
  };
}

function createDefaultWorkers() {
  return [
    {
      id: "john-doe",
      name: "John Doe",
      employeeId: "EMP-9821",
      role: "Senior Welder",
      discipline: "Mechanical",
      status: "valid",
      tier: "Tier 2",
      competency: 92,
      qualifications: ["Safety Induction", "Hot Work", "Gas Test"],
      certs: [
        { name: "Hot Work Competency", status: "valid", detail: "Valid till: Nov 2026" },
        { name: "Safety Induction", status: "valid", detail: "Valid till: Dec 2026" },
      ],
    },
    {
      id: "mike-smith",
      name: "Mike Smith",
      employeeId: "EMP-7742",
      role: "Electrical Supervisor",
      discipline: "Electrical",
      status: "expired",
      tier: "Tier 3 (Lead)",
      competency: 82,
      qualifications: ["Electrical", "Substation Access"],
      certs: [
        { name: "HIRARC Certification", status: "expired", detail: "Expired: Jan 12, 2024" },
        { name: "Safety Induction", status: "valid", detail: "Valid till: Dec 2024" },
        { name: "High Voltage Permit", status: "warning", detail: "Valid till: Aug 2024" },
      ],
    },
    {
      id: "elena-rodriguez",
      name: "Elena Rodriguez",
      employeeId: "EMP-1120",
      role: "Safety Inspector",
      discipline: "HSE",
      status: "warning",
      tier: "Tier 2",
      competency: 74,
      qualifications: ["Safety Induction", "LOTO", "Confined Space"],
      certs: [
        { name: "Safety Induction", status: "valid", detail: "Valid till: Dec 2026" },
        { name: "LOTO Specialist", status: "warning", detail: "Renewal due in 7 days" },
      ],
    },
    {
      id: "marcus-thorne",
      name: "Marcus Thorne",
      employeeId: "EMP-3305",
      role: "Senior Electrical Technician",
      discipline: "Electrical",
      status: "valid",
      tier: "Tier 2",
      competency: 96,
      qualifications: ["Safety Induction", "Arc Flash Level 2", "Substation Access", "Hot Work"],
      certs: [
        { name: "Safety Induction", status: "valid", detail: "Valid till: Jan 2027" },
        { name: "Arc Flash Level 2", status: "valid", detail: "Valid till: Oct 2026" },
      ],
    },
    {
      id: "david-chen",
      name: "David Chen",
      employeeId: "EMP-4418",
      role: "Site Supervisor",
      discipline: "Civil",
      status: "valid",
      tier: "Tier 2",
      competency: 88,
      qualifications: ["Safety Induction", "Height Work", "Confined Space"],
      certs: [
        { name: "Height Work", status: "valid", detail: "Valid till: Sep 2026" },
        { name: "Safety Induction", status: "valid", detail: "Valid till: Dec 2026" },
      ],
    },
  ];
}

function toLocalDateTime(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initials(name) {
  return String(name || "R")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getAuthHeaders() {
  return {
    authorization: `Bearer ${session.token}`,
  };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(session?.token ? getAuthHeaders() : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw { status: response.status, ...body };
  }

  return body;
}

function showAccessState() {
  appWorkspace.classList.add("is-hidden");
  accessState.classList.remove("is-hidden");
}

function hideAccessState() {
  accessState.classList.add("is-hidden");
  appWorkspace.classList.remove("is-hidden");
}

function setProfile(user) {
  const name = user?.fullName || user?.email || "Requester";
  profileName.textContent = name;
  profileRole.textContent = "Permit Requester";
  userAvatar.textContent = initials(name);
}

async function loadAppData() {
  if (!session?.token) {
    showAccessState();
    return;
  }

  if (session.token === OFFLINE_TOKEN) {
    loadOfflineData();
    return;
  }

  state.busy = true;

  try {
    const [dashboard, permitsResult] = await Promise.all([
      apiRequest("/api/requester/dashboard"),
      apiRequest("/api/permits"),
    ]);

    state.dashboardData = dashboard;
    state.permits = permitsResult.permits || permitsResult.data || [];
    setProfile(dashboard.user);
    hideAccessState();
    render();
  } catch (error) {
    clearSessionStorage();
    session = null;
    showAccessState();
    showToast(error.error || "Requester session required.");
  } finally {
    state.busy = false;
  }
}

async function demoLogin() {
  demoLoginButton.disabled = true;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        login: "requester@example.com",
        password: "requester12345",
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      throw body;
    }

    saveSession(body, true);
    await loadAppData();
  } catch (error) {
    startOfflineDemo();
    showToast("Database unavailable. Offline requester demo started.");
  } finally {
    demoLoginButton.disabled = false;
  }
}

function getOfflineUser() {
  return {
    id: "offline-requester",
    employeeId: "EMP-DEMO",
    fullName: "Rina Requester",
    email: "requester@example.com",
    organization: "Global Engineering",
    role: "requester",
  };
}

function startOfflineDemo() {
  saveSession(
    {
      user: getOfflineUser(),
      token: OFFLINE_TOKEN,
    },
    true,
  );
  loadOfflineData();
}

function loadOfflineData() {
  const user = session?.user || getOfflineUser();
  const counts = state.permits.reduce(
    (summary, permit) => {
      summary[permit.status] = (summary[permit.status] || 0) + 1;
      return summary;
    },
    { draft: 0, submitted: 0, approved: 0, active: 0 },
  );

  state.dashboardData = {
    user,
    site: state.draft.area,
    stats: {
      draftPermits: counts.draft || 0,
      pendingApproval: counts.submitted || 0,
      approvedPermits: (counts.approved || 0) + (counts.active || 0),
      expiringCertificates: state.workers.filter((worker) => worker.status !== "valid").length,
    },
    resources: [
      "Safety Handbook v2.4",
      "Emergency Protocols",
      "Site HSE Contact List",
    ],
  };

  setProfile(user);
  hideAccessState();
  render();
}

function saveDraft() {
  writeJsonStorage(STORAGE_KEYS.draft, state.draft);
}

function saveWorkers() {
  writeJsonStorage(STORAGE_KEYS.workers, state.workers);
}

function savePermitMeta() {
  writeJsonStorage(STORAGE_KEYS.permitMeta, state.permitMeta);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("is-hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.add("is-hidden");
  }, 3200);
}

function setView(view) {
  state.activeView = view;

  if (view === "wizard" && !state.wizardStep) {
    state.wizardStep = 1;
  }

  syncNav();
  render();
}

function syncNav() {
  const navView = state.activeView === "wizard" ? "permits" : state.activeView;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === navView);
  });
}

function render() {
  syncNav();

  const renderers = {
    dashboard: renderDashboard,
    permits: renderPermits,
    wizard: renderWizard,
    workers: renderWorkers,
    compliance: renderCompliance,
    support: renderSupport,
  };

  appWorkspace.innerHTML = (renderers[state.activeView] || renderDashboard)();
}

function formatCount(value) {
  return String(Number(value || 0)).padStart(2, "0");
}

function formatStatus(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPermitType(permit) {
  const source = [permit.title, ...(permit.hazards || [])].join(" ").toLowerCase();

  if (source.includes("hot") || source.includes("weld") || source.includes("fire")) {
    return "Hot Work";
  }

  if (source.includes("confined") || source.includes("tank") || source.includes("vessel")) {
    return "Confined Space";
  }

  if (source.includes("height") || source.includes("scaffold") || source.includes("roof")) {
    return "Work at Height";
  }

  if (source.includes("electrical") || source.includes("substation")) {
    return "Electrical";
  }

  return "General PTW";
}

function searchMatchesPermit(permit) {
  const term = state.search.trim().toLowerCase();

  if (!term) {
    return true;
  }

  return [
    permit.id,
    permit.title,
    permit.location,
    permit.status,
    getPermitType(permit),
  ]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

function getLocalDraftPermit() {
  const draft = state.draft;
  const hasDraft =
    draft.title ||
    draft.scope ||
    draft.location ||
    draft.fileNames.length ||
    draft.selectedWorkers.length;

  if (!hasDraft) {
    return null;
  }

  return {
    id: "LOCAL-DRAFT",
    title: draft.title || "Unsynced requester draft",
    location: draft.location || draft.area,
    startDateTime: draft.startDateTime,
    endDateTime: draft.endDateTime,
    hazards: draft.hazards,
    status: "draft",
    isLocalDraft: true,
  };
}

function getAllVisiblePermits() {
  const localDraft = getLocalDraftPermit();
  const permits = localDraft ? [localDraft, ...state.permits] : [...state.permits];
  return permits.filter(searchMatchesPermit);
}

function getDashboardStats() {
  const stats = state.dashboardData?.stats || {};
  const hasLocalDraft = Boolean(getLocalDraftPermit());
  const expiringWorkers = state.workers.filter((worker) => worker.status !== "valid").length;

  return {
    draftPermits: Number(stats.draftPermits || 0) + (hasLocalDraft ? 1 : 0),
    pendingApproval: Number(stats.pendingApproval || 0),
    approvedPermits: Number(stats.approvedPermits || 0),
    expiringCertificates: Math.max(Number(stats.expiringCertificates || 0), expiringWorkers),
  };
}

function renderDashboard() {
  const stats = getDashboardStats();
  const total =
    stats.draftPermits +
    stats.pendingApproval +
    stats.approvedPermits +
    stats.expiringCertificates;
  const activePermits = getAllVisiblePermits()
    .filter((permit) => ["draft", "submitted", "approved", "active"].includes(permit.status))
    .slice(0, 6);

  return `
    <div class="page-heading">
      <div>
        <span class="eyebrow">Requester Workspace</span>
        <h2>Contractor Dashboard</h2>
        <p>Active Site: <strong>${escapeHtml(state.dashboardData?.site || state.draft.area)}</strong></p>
      </div>
      <div class="heading-actions">
        <button class="soft-button" type="button" data-action="filter-dashboard">
          ${icon("filter")}
          <span>Filter View</span>
        </button>
        <button class="black-button" type="button" data-action="start-wizard">
          ${icon("plus")}
          <span>New Permit</span>
        </button>
      </div>
    </div>

    <section class="metric-grid" aria-label="Permit summary">
      ${metricCard("Draft Permits", stats.draftPermits, "document", "+ local drafts", "", ratio(stats.draftPermits, total))}
      ${metricCard("Pending Approval", stats.pendingApproval, "clock", "Supervisor queue", "amber", ratio(stats.pendingApproval, total))}
      ${metricCard("Approved Permits", stats.approvedPermits, "check", "Active work", "green", ratio(stats.approvedPermits, total))}
      ${metricCard("Expiring Certificates", stats.expiringCertificates, "alert", "Worker access risk", "red", ratio(stats.expiringCertificates, total))}
    </section>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-head">
          <h3>Active Permits</h3>
          <button class="link-button" type="button" data-view="permits">View All</button>
        </div>
        ${renderPermitTable(activePermits, "Showing " + activePermits.length + " active permit" + (activePermits.length === 1 ? "" : "s"))}
      </section>

      <aside class="quick-panel panel">
        <h3>Quick Actions</h3>
        <div class="quick-stack">
          <button class="quick-button primary" type="button" data-action="start-wizard">
            ${icon("plus-circle")}
            <span>Create New Permit</span>
          </button>
          <button class="quick-button" type="button" data-view="workers">
            ${icon("user-plus")}
            <span>Add Worker</span>
          </button>
          <button class="quick-button" type="button" data-view="compliance">
            ${icon("shield")}
            <span>Check Compliance</span>
          </button>
        </div>
        <div class="section-divider"></div>
        <h3>Resources</h3>
        <ul class="resource-list">
          ${(state.dashboardData?.resources || [
            "Safety Handbook v2.4",
            "Emergency Protocols",
            "Site HSE Contact List",
          ])
            .map(
              (resource) => `
                <li>${icon("file")}<span>${escapeHtml(resource)}</span></li>
              `,
            )
            .join("")}
        </ul>
      </aside>
    </div>
  `;
}

function metricCard(label, value, iconName, note, tone, width) {
  return `
    <article class="metric-card">
      <div class="metric-top">
        <span class="metric-icon">${icon(iconName)}</span>
        <strong class="metric-note">${escapeHtml(note)}</strong>
      </div>
      <p class="metric-label">${escapeHtml(label)}</p>
      <h3 class="metric-value">${formatCount(value)}</h3>
      <span class="meter ${tone}"><i style="width: ${width}%"></i></span>
    </article>
  `;
}

function ratio(value, total) {
  if (!value || !total) {
    return 0;
  }

  return Math.min(100, Math.max(12, Math.round((value / total) * 100)));
}

function renderPermits() {
  const permits = getAllVisiblePermits();

  return `
    <div class="page-heading">
      <div>
        <span class="eyebrow">Permits</span>
        <h2>Permit Control Center</h2>
        <p>Manage drafts, submitted requests, and active work permits.</p>
      </div>
      <div class="heading-actions">
        <button class="soft-button" type="button" data-action="reset-draft">
          ${icon("refresh")}
          <span>Reset Draft</span>
        </button>
        <button class="black-button" type="button" data-action="start-wizard">
          ${icon("plus")}
          <span>New Permit</span>
        </button>
      </div>
    </div>

    <div class="permits-grid">
      <section class="panel">
        <div class="panel-head">
          <h3>Permit Register</h3>
          <span class="status-pill">${permits.length} Total</span>
        </div>
        ${renderPermitTable(permits, "Showing " + permits.length + " permit" + (permits.length === 1 ? "" : "s"))}
      </section>

      <aside class="quick-panel panel">
        <h3>Draft Readiness</h3>
        ${renderDraftReadiness()}
        <div class="section-divider"></div>
        <h3>Recent Activity</h3>
        <ul class="activity-list">
          <li>${icon("clock")}<span>Requester draft updated locally</span></li>
          <li>${icon("shield")}<span>${state.workers.filter((worker) => worker.status === "valid").length} workers available for assignment</span></li>
          <li>${icon("alert")}<span>${state.workers.filter((worker) => worker.status !== "valid").length} certificate warnings</span></li>
        </ul>
      </aside>
    </div>
  `;
}

function renderDraftReadiness() {
  const checks = [
    ["Work details", Boolean(state.draft.title && state.draft.location)],
    ["MOS/HIRAC scope", Boolean(state.draft.scope)],
    ["Risk matrix", Boolean(state.draft.likelihood && state.draft.severity)],
    ["Controls", Boolean(state.draft.controls)],
    ["Team assigned", state.draft.selectedWorkers.length > 0],
  ];

  return `
    <ul class="check-list">
      ${checks
        .map(
          ([label, ok]) => `
            <li>
              ${icon(ok ? "check" : "alert")}
              <span>${escapeHtml(label)} <strong class="${ok ? "" : "access-denied"}">${ok ? "Ready" : "Required"}</strong></span>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderPermitTable(permits, summary) {
  if (!permits.length) {
    return `
      <div class="empty-state">No permits found.</div>
      <div class="table-foot"><span>${escapeHtml(summary)}</span></div>
    `;
  }

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Permit ID</th>
            <th>Title</th>
            <th>Type</th>
            <th>Location</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${permits.map(renderPermitRow).join("")}
        </tbody>
      </table>
    </div>
    <div class="table-foot">
      <span>${escapeHtml(summary)}</span>
      <span>${escapeHtml(state.dashboardData?.site || state.draft.area)}</span>
    </div>
  `;
}

function renderPermitRow(permit) {
  const id = permit.id || "-";
  const shortId = id.length > 13 ? `${id.slice(0, 8)}...` : id;
  const type = getPermitType(permit);

  return `
    <tr>
      <td class="permit-id" title="${escapeHtml(id)}">${escapeHtml(shortId)}</td>
      <td>
        <strong>${escapeHtml(permit.title || "Untitled permit")}</strong>
        <div class="worker-meta">${escapeHtml(formatDateTime(permit.startDateTime))}</div>
      </td>
      <td>${escapeHtml(type)}</td>
      <td>${escapeHtml(permit.location || "-")}</td>
      <td><span class="status-pill ${escapeHtml(permit.status)}">${escapeHtml(formatStatus(permit.status))}</span></td>
      <td>
        <div class="row-actions">
          ${
            permit.isLocalDraft
              ? `<button class="icon-row-button" type="button" data-action="continue-local-draft" aria-label="Continue draft">${icon("edit")}</button>
                 <button class="icon-row-button" type="button" data-action="submit-local-draft" aria-label="Submit draft">${icon("send")}</button>`
              : `<button class="icon-row-button" type="button" data-action="view-permit" data-permit-id="${escapeHtml(id)}" aria-label="View permit">${icon("file")}</button>
                 ${
                   permit.status === "draft"
                     ? `<button class="icon-row-button" type="button" data-action="submit-existing-permit" data-permit-id="${escapeHtml(id)}" aria-label="Submit permit">${icon("send")}</button>`
                     : ""
                 }`
          }
        </div>
      </td>
    </tr>
  `;
}

function renderWizard() {
  const stepContent = {
    1: renderWorkDetailsStep,
    2: renderDocumentsStep,
    3: renderTeamStep,
    4: renderReviewStep,
  };

  return `
    <div class="wizard-header">
      <div class="wizard-title">
        <span class="eyebrow">Permit Wizard | New Permit Request</span>
        <h2>${state.wizardStep === 2 ? "Digital MOS & HIRAC Entry" : "Permit Wizard"}</h2>
        <p>${wizardSubtitle()}</p>
      </div>
      <span class="draft-chip">${icon("info")} Draft Mode</span>
    </div>

    ${renderStepper()}
    ${(stepContent[state.wizardStep] || renderWorkDetailsStep)()}
    ${renderWizardFooter()}
  `;
}

function wizardSubtitle() {
  const subtitles = {
    1: "Define work details, schedule, and permit classification.",
    2: "Submit Method of Statement and Hazard Identification for approval.",
    3: "Select certified personnel for this permit.",
    4: "Review permit data and submit to the approval queue.",
  };

  return subtitles[state.wizardStep];
}

function renderStepper() {
  const labels = ["Work Details", "Documents", "Team Assignment", "Review & Submit"];

  return `
    <div class="wizard-stepper" aria-label="Permit steps">
      ${labels
        .map((label, index) => {
          const step = index + 1;
          const stateClass =
            step < state.wizardStep ? "is-complete" : step === state.wizardStep ? "is-active" : "";
          const content = step < state.wizardStep ? "&#10003;" : step;
          return `
            <button class="step-item ${stateClass}" type="button" data-action="go-step" data-step="${step}">
              <span class="step-number">${content}</span>
              <span class="step-label">${escapeHtml(label)}</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderWorkDetailsStep() {
  const draft = state.draft;

  return `
    <section class="wizard-panel">
      <h3>${icon("file")} Work Details</h3>
      <div class="form-grid">
        ${field("title", "Work Title", draft.title, "text", true)}
        <label class="field">
          <span>Permit Type <b class="required">*</b></span>
          <select data-field="permitType">
            ${permitTypes
              .map(
                (type) => `
                  <option value="${escapeHtml(type)}" ${draft.permitType === type ? "selected" : ""}>${escapeHtml(type)}</option>
                `,
              )
              .join("")}
          </select>
        </label>
        ${field("location", "Location", draft.location, "text", true)}
        ${field("area", "Active Site", draft.area, "text", true)}
        ${field("startDateTime", "Start Date / Time", draft.startDateTime, "datetime-local", true)}
        ${field("endDateTime", "End Date / Time", draft.endDateTime, "datetime-local", true)}
        <label class="field full-span">
          <span>Initial Work Description <b class="required">*</b></span>
          <textarea data-field="scope" rows="6">${escapeHtml(draft.scope)}</textarea>
        </label>
        ${field("ppe", "Required PPE", draft.ppe, "text", false)}
        ${field("approvers", "Approvers", draft.approvers, "text", false)}
      </div>
    </section>
  `;
}

function field(name, label, value, type = "text", required = false) {
  return `
    <label class="field">
      <span>${escapeHtml(label)} ${required ? '<b class="required">*</b>' : ""}</span>
      <input data-field="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" />
    </label>
  `;
}

function renderDocumentsStep() {
  const draft = state.draft;

  return `
    <div class="wizard-grid">
      <section class="upload-card panel">
        <h3>${icon("upload")} Upload Standard Template</h3>
        <p>Upload standard MOS/HIRAC files (PDF/DOCX) for automated data extraction.</p>
        <div class="drop-zone" data-action="browse-files">
          <div>
            <div class="drop-icon">${icon("cloud")}</div>
            <strong>Drag and drop files here</strong>
            <span>or <button class="link-button" type="button" data-action="browse-files">Browse Files</button></span>
            <div class="file-list">
              ${draft.fileNames.length ? draft.fileNames.map((name) => `<span>${icon("file")} ${escapeHtml(name)}</span>`).join("") : "<span>PDF and DOCX accepted</span>"}
            </div>
          </div>
        </div>
        <input class="is-hidden" id="fileInput" type="file" accept=".pdf,.doc,.docx" multiple />
        <button class="soft-button" type="button" data-action="extract-template">
          ${icon("spark")}
          <span>AI Extraction Ready</span>
        </button>
        <div class="ai-card">
          ${icon("spark")}
          <div>
            <strong>AI Extraction Ready</strong>
            <p>Uploaded file names are mapped into this draft for review.</p>
          </div>
        </div>
      </section>

      <section class="wizard-panel">
        <h3>${icon("edit-file")} Direct System Entry</h3>
        <div class="section-divider"></div>
        <label class="field full-span">
          <span>Scope of Work <b class="required">*</b></span>
          <textarea data-field="scope" rows="6">${escapeHtml(draft.scope)}</textarea>
        </label>

        <div class="section-divider"></div>
        <span class="field-label">Hazard Categories</span>
        <div class="hazard-grid">
          ${hazardOptions
            .map(
              (hazard) => `
                <button class="hazard-button ${draft.hazards.includes(hazard) ? "is-active" : ""}" type="button" data-hazard="${escapeHtml(hazard)}">${escapeHtml(hazard)}</button>
              `,
            )
            .join("")}
        </div>

        ${renderRiskPanel()}

        <div class="section-divider"></div>
        <label class="field full-span">
          <span>Mitigation Control Measures <b class="required">*</b></span>
          <div class="editor-toolbar">
            <button type="button" data-action="editor-bold" aria-label="Bold">B</button>
            <button type="button" data-action="editor-italic" aria-label="Italic"><i>I</i></button>
            <button type="button" data-action="editor-list" aria-label="List">${icon("list")}</button>
          </div>
          <textarea class="editor-textarea" data-field="controls" rows="8">${escapeHtml(draft.controls)}</textarea>
        </label>
      </section>
    </div>
  `;
}

function renderRiskPanel() {
  const draft = state.draft;
  const score = draft.likelihood * draft.severity;
  const level = getRiskLevel(score);

  return `
    <div class="risk-panel">
      <h4>Interactive Risk Matrix</h4>
      <p>Select intersection of Likelihood and Severity.</p>
      <div class="risk-layout">
        <div class="risk-matrix">
          <span class="risk-cell risk-axis"></span>
          ${[1, 2, 3, 4, 5].map((severity) => `<span class="risk-cell">${severity}</span>`).join("")}
          ${[5, 4, 3, 2, 1]
            .map(
              (likelihood) => `
                <span class="risk-cell risk-axis">L${likelihood}</span>
                ${[1, 2, 3, 4, 5]
                  .map((severity) => {
                    const cellScore = likelihood * severity;
                    return `
                      <button
                        class="risk-cell ${getRiskClass(cellScore)} ${draft.likelihood === likelihood && draft.severity === severity ? "is-selected" : ""}"
                        type="button"
                        data-risk
                        data-likelihood="${likelihood}"
                        data-severity="${severity}"
                        aria-label="Likelihood ${likelihood}, severity ${severity}"
                      ></button>
                    `;
                  })
                  .join("")}
              `,
            )
            .join("")}
        </div>
        <div>
          <div class="risk-result">
            <span>Calculated Risk Level</span>
            <strong><i class="risk-dot ${getRiskClass(score)}"></i>${escapeHtml(level)} (${score})</strong>
          </div>
          <div class="risk-legend">
            <div><i class="legend-box risk-low"></i><span>1-4: Low Risk (Proceed with caution)</span></div>
            <div><i class="legend-box risk-med"></i><span>5-12: Medium Risk (Controls required)</span></div>
            <div><i class="legend-box risk-high"></i><span>15-25: High Risk (Stop work, redesign task)</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getRiskClass(score) {
  if (score <= 4) {
    return "risk-low";
  }

  if (score <= 12) {
    return "risk-med";
  }

  return "risk-high";
}

function getRiskLevel(score) {
  if (score <= 4) {
    return "Low";
  }

  if (score <= 12) {
    return "Medium";
  }

  return "High";
}

function renderTeamStep() {
  const filteredWorkers = state.workers.filter((worker) => {
    const roleMatch = state.roleFilter === "all" || worker.role === state.roleFilter;
    const qualifiedMatch = !state.qualifiedOnly || isWorkerQualified(worker);
    return roleMatch && qualifiedMatch;
  });
  const assignedCount = state.draft.selectedWorkers.length + state.draft.invitedContractors.length;

  return `
    <section class="wizard-panel">
      <div class="page-heading">
        <div>
          <h2>Select Certified Personnel</h2>
          <p>Only workers with valid competencies for the selected hazards are listed when qualified filtering is enabled.</p>
        </div>
        <div class="heading-actions">
          <select class="soft-button" id="roleFilter">
            <option value="all">All Roles</option>
            ${[...new Set(state.workers.map((worker) => worker.role))]
              .map(
                (role) => `
                  <option value="${escapeHtml(role)}" ${state.roleFilter === role ? "selected" : ""}>${escapeHtml(role)}</option>
                `,
              )
              .join("")}
          </select>
          <button class="toggle-button ${state.qualifiedOnly ? "is-active" : ""}" type="button" data-action="toggle-qualified">
            ${icon("filter")}
            <span>Qualified Only</span>
          </button>
        </div>
      </div>

      <div class="personnel-grid">
        ${filteredWorkers.map(renderPersonCard).join("")}
        <button class="invite-card" type="button" data-action="open-invite-dialog">
          ${icon("user-plus")}
          <span>Invite External Contractor</span>
        </button>
      </div>

      <div class="assignment-banner">
        <span class="summary-avatar">${assignedCount}</span>
        <span>${assignedCount} Team Member${assignedCount === 1 ? "" : "s"} assigned to this permit.</span>
        <button class="link-button" type="button" data-action="clear-selection">Clear Selection</button>
      </div>
    </section>
  `;
}

function renderPersonCard(worker) {
  const selected = state.draft.selectedWorkers.includes(worker.id);
  const qualified = isWorkerQualified(worker);

  return `
    <button class="person-card ${selected ? "is-selected" : ""} ${qualified ? "" : "is-muted"}" type="button" data-action="toggle-worker" data-worker-id="${escapeHtml(worker.id)}">
      <span class="worker-photo">${escapeHtml(initials(worker.name))}</span>
      <span>
        <h4>${escapeHtml(worker.name)}</h4>
        <p>${escapeHtml(worker.role)}</p>
        <span class="tag-row">
          ${worker.qualifications
            .slice(0, 3)
            .map((qualification) => `<span class="tag ${qualificationTone(qualification)}">${escapeHtml(qualification)}</span>`)
            .join("")}
        </span>
      </span>
      <span class="radio-dot"></span>
    </button>
  `;
}

function qualificationTone(qualification) {
  const text = qualification.toLowerCase();

  if (text.includes("loto") || text.includes("height")) {
    return "warn";
  }

  if (text.includes("expired")) {
    return "danger";
  }

  return "";
}

function isWorkerQualified(worker) {
  if (worker.status === "expired") {
    return false;
  }

  const qualifications = worker.qualifications.join(" ").toLowerCase();
  const hazards = state.draft.hazards.join(" ").toLowerCase();

  if (!qualifications.includes("safety induction")) {
    return false;
  }

  if (hazards.includes("hot work") && !qualifications.includes("hot work")) {
    return false;
  }

  if (hazards.includes("height") && !qualifications.includes("height")) {
    return false;
  }

  if (hazards.includes("electrical") && !/(electrical|arc flash|substation)/.test(qualifications)) {
    return false;
  }

  return true;
}

function renderReviewStep() {
  const riskScore = state.draft.likelihood * state.draft.severity;
  const assignedWorkers = state.workers.filter((worker) => state.draft.selectedWorkers.includes(worker.id));

  return `
    <section class="review-grid">
      <article class="review-card">
        <h3>Work Summary</h3>
        <dl>
          ${reviewRow("Title", state.draft.title)}
          ${reviewRow("Type", state.draft.permitType)}
          ${reviewRow("Location", state.draft.location)}
          ${reviewRow("Schedule", `${formatDateTime(state.draft.startDateTime)} to ${formatDateTime(state.draft.endDateTime)}`)}
          ${reviewRow("Scope", state.draft.scope)}
        </dl>
      </article>
      <article class="review-card">
        <h3>MOS & HIRAC</h3>
        <dl>
          ${reviewRow("Hazards", state.draft.hazards.join(", ") || "-")}
          ${reviewRow("Risk", `${getRiskLevel(riskScore)} (${riskScore})`)}
          ${reviewRow("Controls", state.draft.controls)}
          ${reviewRow("Files", state.draft.fileNames.join(", ") || "No files uploaded")}
        </dl>
      </article>
      <article class="review-card">
        <h3>Team Assignment</h3>
        <dl>
          ${reviewRow("Workers", assignedWorkers.map((worker) => worker.name).join(", ") || "-")}
          ${reviewRow("External Contractors", state.draft.invitedContractors.map((person) => person.name).join(", ") || "-")}
          ${reviewRow("Required PPE", state.draft.ppe || "-")}
        </dl>
      </article>
      <article class="review-card">
        <h3>Approval Route</h3>
        <dl>
          ${reviewRow("Approvers", state.draft.approvers || "-")}
          ${reviewRow("Draft Status", "Ready for requester submission")}
          ${reviewRow("Submission", "Creates a backend draft and moves it to submitted status")}
        </dl>
      </article>
    </section>
  `;
}

function reviewRow(label, value) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function renderWizardFooter() {
  const showBack = state.wizardStep > 1;
  const primaryAction = state.wizardStep === 4 ? "submit-permit" : "wizard-next";
  const primaryText = state.wizardStep === 4 ? "Submit to System" : "Continue";

  return `
    <footer class="wizard-footer">
      <button class="link-button" type="button" data-action="${showBack ? "wizard-back" : "close-wizard"}">
        ${icon("arrow-left")}
        <span>${showBack ? "Back" : "Back to Dashboard"}</span>
      </button>
      <div class="footer-right">
        <button class="soft-button" type="button" data-action="save-draft">Save as Draft</button>
        <button class="nav-button" type="button" data-action="${primaryAction}" ${state.busy ? "disabled" : ""}>
          <span>${primaryText}</span>
          ${state.wizardStep === 4 ? icon("send") : ""}
        </button>
      </div>
    </footer>
  `;
}

function renderWorkers() {
  const workers = filteredWorkersForManagement();
  const selected = state.workers.find((worker) => worker.id === state.selectedWorkerId) || state.workers[0];
  const expiredCount = state.workers.filter((worker) => worker.status === "expired").length;

  return `
    <div class="page-heading">
      <div>
        <span class="eyebrow">Workers</span>
        <h2>Worker Management</h2>
        <p>Manage personnel competencies, certifications, and active site access.</p>
      </div>
      <div class="heading-actions">
        <select class="soft-button" id="workerRoleFilter">
          <option value="all">Filter Roles</option>
          ${[...new Set(state.workers.map((worker) => worker.role))]
            .map((role) => `<option value="${escapeHtml(role)}" ${state.roleFilter === role ? "selected" : ""}>${escapeHtml(role)}</option>`)
            .join("")}
        </select>
        <button class="nav-button" type="button" data-action="open-worker-dialog">
          ${icon("user-plus")}
          <span>Add New Worker</span>
        </button>
      </div>
    </div>

    <div class="workers-grid">
      <section class="panel worker-table-card">
        <div class="workforce-head">
          <h3>Active Workforce</h3>
          <div class="count-pills">
            <span class="status-pill valid">${state.workers.length} Total</span>
            <span class="status-pill expired">${expiredCount} Expired</span>
          </div>
        </div>
        ${renderWorkerTable(workers)}
      </section>
      ${renderWorkerDetail(selected)}
    </div>
  `;
}

function filteredWorkersForManagement() {
  const term = state.search.trim().toLowerCase();

  return state.workers.filter((worker) => {
    const roleMatch = state.roleFilter === "all" || worker.role === state.roleFilter;
    const searchMatch =
      !term ||
      [worker.name, worker.employeeId, worker.role, worker.discipline, worker.qualifications.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(term);

    return roleMatch && searchMatch;
  });
}

function renderWorkerTable(workers) {
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Worker</th>
            <th>Role</th>
            <th>Competency</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${workers
            .map(
              (worker) => `
                <tr class="${state.selectedWorkerId === worker.id ? "is-selected" : ""}">
                  <td>
                    <button class="worker-cell link-button" type="button" data-action="select-worker-detail" data-worker-id="${escapeHtml(worker.id)}">
                      <span class="worker-photo">${escapeHtml(initials(worker.name))}</span>
                      <span>
                        <strong class="worker-name">${escapeHtml(worker.name)}</strong>
                        <span class="worker-meta">ID: ${escapeHtml(worker.employeeId)}</span>
                      </span>
                    </button>
                  </td>
                  <td>${escapeHtml(worker.role)}</td>
                  <td><span class="status-pill ${escapeHtml(worker.status)}">${escapeHtml(formatStatus(worker.status))}</span></td>
                  <td>
                    <div class="row-actions">
                      <button class="icon-row-button" type="button" data-action="edit-worker" data-worker-id="${escapeHtml(worker.id)}" aria-label="Edit worker">${icon("edit")}</button>
                      <button class="icon-row-button" type="button" data-action="upload-cert" data-worker-id="${escapeHtml(worker.id)}" aria-label="Upload certificate">${icon("cloud")}</button>
                    </div>
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="table-foot">
      <span>Showing ${workers.length} of ${state.workers.length} workers</span>
      <span>
        <button class="icon-row-button" type="button" data-action="prev-workers" aria-label="Previous">${icon("chevron-left")}</button>
        <button class="icon-row-button" type="button" data-action="next-workers" aria-label="Next">${icon("chevron-right")}</button>
      </span>
    </div>
  `;
}

function renderWorkerDetail(worker) {
  if (!worker) {
    return `<aside class="panel worker-detail"><p>No worker selected.</p></aside>`;
  }

  const accessText = worker.status === "expired" ? "Access Denied" : worker.status === "warning" ? "Renewal Required" : "Access Approved";

  return `
    <aside class="panel worker-detail">
      <div class="worker-profile">
        <span class="worker-photo">${escapeHtml(initials(worker.name))}</span>
        <div>
          <h3>${escapeHtml(worker.name)}</h3>
          <p>${escapeHtml(worker.discipline)}<br />${escapeHtml(worker.role)}</p>
          <span>Status: <strong class="${worker.status === "expired" ? "access-denied" : ""}">${escapeHtml(accessText)}</strong></span>
        </div>
        <button class="icon-row-button" type="button" data-action="edit-worker" data-worker-id="${escapeHtml(worker.id)}" aria-label="Edit worker">${icon("more")}</button>
      </div>

      <div class="competency-box">
        <strong>Competency Level <span>${escapeHtml(worker.tier)}</span></strong>
        <div class="progress"><span class="${escapeHtml(worker.status)}" style="width: ${worker.competency}%"></span></div>
      </div>

      <div>
        <h3>Digital Certificates</h3>
        <div class="cert-list">
          ${worker.certs.map(renderCertCard).join("")}
        </div>
      </div>

      <div class="heading-actions">
        <button class="black-button" type="button" data-action="upload-cert" data-worker-id="${escapeHtml(worker.id)}">Upload New Cert</button>
        <button class="soft-button" type="button" data-action="print-certs">${icon("print")}</button>
      </div>
    </aside>
  `;
}

function renderCertCard(cert) {
  return `
    <div class="cert-card">
      <span class="cert-icon ${escapeHtml(cert.status)}">${icon("file")}</span>
      <span>
        <strong>${escapeHtml(cert.name)}</strong>
        <span>${escapeHtml(cert.detail)}</span>
      </span>
      ${icon("external")}
    </div>
  `;
}

function renderCompliance() {
  const validWorkers = state.workers.filter((worker) => worker.status === "valid").length;
  const score = Math.round((validWorkers / state.workers.length) * 100);

  return `
    <div class="page-heading">
      <div>
        <span class="eyebrow">Compliance</span>
        <h2>Compliance Readiness</h2>
        <p>Requester view of permit controls, worker certification, and site readiness.</p>
      </div>
      <div class="heading-actions">
        <button class="soft-button" type="button" data-action="export-compliance">${icon("download")} Export</button>
      </div>
    </div>

    <div class="compliance-grid">
      <section class="panel">
        <div class="panel-head"><h3>Readiness Score</h3></div>
        <div class="panel-body compliance-score">
          <div>
            <div class="score-ring">${score}%</div>
            <p>${validWorkers} of ${state.workers.length} workers have valid competencies.</p>
          </div>
        </div>
      </section>
      <aside class="quick-panel panel">
        <h3>Permit Checklist</h3>
        ${renderDraftReadiness()}
        <div class="section-divider"></div>
        <h3>Certificate Exceptions</h3>
        <ul class="activity-list">
          ${state.workers
            .filter((worker) => worker.status !== "valid")
            .map((worker) => `<li>${icon("alert")}<span>${escapeHtml(worker.name)}: ${escapeHtml(formatStatus(worker.status))}</span></li>`)
            .join("")}
        </ul>
      </aside>
    </div>
  `;
}

function renderSupport() {
  return `
    <div class="page-heading">
      <div>
        <span class="eyebrow">Support</span>
        <h2>Requester Support</h2>
        <p>Raise workflow, certification, or permit submission issues.</p>
      </div>
    </div>
    <div class="support-layout">
      <section class="wizard-panel">
        <h3>${icon("help")} Support Request</h3>
        <form id="supportForm" class="form-grid one-column">
          <label class="field">
            <span>Topic</span>
            <select name="topic">
              <option>Permit submission</option>
              <option>Worker certification</option>
              <option>Approval routing</option>
              <option>System access</option>
            </select>
          </label>
          <label class="field">
            <span>Message</span>
            <textarea name="message" rows="8" required></textarea>
          </label>
          <button class="black-button" type="submit">Submit Support Request</button>
        </form>
      </section>
      <aside class="quick-panel panel">
        <h3>HSE Contacts</h3>
        <ul class="resource-list">
          <li>${icon("user")}<span>Safety Supervisor: Officer K. Vance</span></li>
          <li>${icon("phone")}<span>Emergency Control Room: 555-0199</span></li>
          <li>${icon("mail")}<span>hse-control@example.com</span></li>
        </ul>
      </aside>
    </div>
  `;
}

function updateDraftField(target) {
  const fieldName = target.dataset.field;

  if (!fieldName) {
    return;
  }

  state.draft[fieldName] = target.value;
  saveDraft();
}

function validateStep(step = state.wizardStep) {
  updateAllDraftInputs();

  if (step === 1) {
    if (!state.draft.title || !state.draft.location || !state.draft.startDateTime || !state.draft.endDateTime) {
      showToast("Complete work title, location, start time, and end time.");
      return false;
    }
  }

  if (step === 2) {
    if (!state.draft.scope || !state.draft.controls || !state.draft.hazards.length) {
      showToast("Complete scope, hazards, and mitigation controls.");
      return false;
    }
  }

  if (step === 3) {
    if (!state.draft.selectedWorkers.length && !state.draft.invitedContractors.length) {
      showToast("Assign at least one team member.");
      return false;
    }
  }

  return true;
}

function updateAllDraftInputs() {
  appWorkspace.querySelectorAll("[data-field]").forEach((field) => updateDraftField(field));
}

function resetDraft() {
  state.draft = createDefaultDraft();
  state.wizardStep = 1;
  saveDraft();
  showToast("Requester draft reset.");
  render();
}

function splitLines(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim().replace(/^\d+\.\s*/, ""))
    .filter(Boolean);
}

function buildPermitPayload() {
  return {
    title: state.draft.title,
    location: state.draft.location,
    description: [
      state.draft.scope,
      "",
      `Permit Type: ${state.draft.permitType}`,
      `Risk: ${getRiskLevel(state.draft.likelihood * state.draft.severity)} (${state.draft.likelihood * state.draft.severity})`,
      `Assigned Workers: ${state.draft.selectedWorkers
        .map((id) => state.workers.find((worker) => worker.id === id)?.name)
        .filter(Boolean)
        .join(", ")}`,
    ].join("\n"),
    startDateTime: state.draft.startDateTime,
    endDateTime: state.draft.endDateTime,
    hazards: state.draft.hazards,
    controls: splitLines(state.draft.controls),
    ppe: splitLines(state.draft.ppe),
    approvers: splitLines(state.draft.approvers),
  };
}

async function submitPermit() {
  if (![1, 2, 3].every((step) => validateStep(step))) {
    return;
  }

  if (session?.token === OFFLINE_TOKEN) {
    const permit = createOfflinePermit("submitted");
    state.permits = [permit, ...state.permits];
    writeJsonStorage(STORAGE_KEYS.offlinePermits, state.permits);
    state.permitMeta[permit.id] = {
      riskScore: state.draft.likelihood * state.draft.severity,
      riskLevel: getRiskLevel(state.draft.likelihood * state.draft.severity),
      workers: [...state.draft.selectedWorkers],
      files: [...state.draft.fileNames],
    };
    savePermitMeta();
    state.draft = createDefaultDraft();
    saveDraft();
    state.activeView = "permits";
    loadOfflineData();
    showToast("Offline permit submitted locally.");
    return;
  }

  state.busy = true;
  render();

  try {
    const created = await apiRequest("/api/permits", {
      method: "POST",
      body: JSON.stringify(buildPermitPayload()),
    });

    const submitted = await apiRequest(`/api/permits/${created.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "submitted",
        comment: "Submitted from requester permit wizard",
      }),
    });

    state.permitMeta[submitted.id] = {
      riskScore: state.draft.likelihood * state.draft.severity,
      riskLevel: getRiskLevel(state.draft.likelihood * state.draft.severity),
      workers: [...state.draft.selectedWorkers],
      files: [...state.draft.fileNames],
    };
    savePermitMeta();

    state.draft = createDefaultDraft();
    saveDraft();
    state.activeView = "permits";
    await loadAppData();
    showToast("Permit submitted to approval queue.");
  } catch (error) {
    showToast(error.error || "Unable to submit permit.");
    render();
  } finally {
    state.busy = false;
  }
}

async function submitExistingPermit(id) {
  if (session?.token === OFFLINE_TOKEN) {
    state.permits = state.permits.map((permit) =>
      permit.id === id ? { ...permit, status: "submitted" } : permit,
    );
    writeJsonStorage(STORAGE_KEYS.offlinePermits, state.permits);
    loadOfflineData();
    showToast("Offline draft submitted locally.");
    return;
  }

  try {
    await apiRequest(`/api/permits/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "submitted",
        comment: "Submitted from requester permit register",
      }),
    });
    await loadAppData();
    showToast("Draft submitted.");
  } catch (error) {
    showToast(error.error || "Unable to submit draft.");
  }
}

function createOfflinePermit(status = "submitted") {
  const payload = buildPermitPayload();

  return {
    id: `OFF-${Date.now().toString(36).toUpperCase()}`,
    requestedById: session?.user?.id || "offline-requester",
    requestedBy: session?.user?.fullName || "Rina Requester",
    ...payload,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function showPermitDetails(id) {
  const permit = state.permits.find((item) => item.id === id);

  if (!permit) {
    showToast("Permit not found.");
    return;
  }

  const details = [
    permit.title,
    `Status: ${formatStatus(permit.status)}`,
    `Location: ${permit.location}`,
    `Schedule: ${formatDateTime(permit.startDateTime)} to ${formatDateTime(permit.endDateTime)}`,
  ];

  window.alert(details.join("\n"));
}

function toggleHazard(hazard) {
  if (state.draft.hazards.includes(hazard)) {
    state.draft.hazards = state.draft.hazards.filter((item) => item !== hazard);
  } else {
    state.draft.hazards = [...state.draft.hazards, hazard];
  }

  saveDraft();
  render();
}

function toggleWorker(workerId) {
  if (state.draft.selectedWorkers.includes(workerId)) {
    state.draft.selectedWorkers = state.draft.selectedWorkers.filter((id) => id !== workerId);
  } else {
    state.draft.selectedWorkers = [...state.draft.selectedWorkers, workerId];
  }

  saveDraft();
  render();
}

function handleFiles(files) {
  const accepted = Array.from(files || []).filter((file) =>
    /\.(pdf|doc|docx)$/i.test(file.name),
  );

  if (!accepted.length) {
    showToast("Only PDF and DOCX files are accepted.");
    return;
  }

  state.draft.fileNames = [...new Set([...state.draft.fileNames, ...accepted.map((file) => file.name)])];
  saveDraft();
  render();
  showToast(`${accepted.length} document${accepted.length === 1 ? "" : "s"} attached.`);
}

function extractTemplate() {
  if (!state.draft.fileNames.length) {
    showToast("Upload a MOS/HIRAC file first.");
    return;
  }

  state.draft.scope ||= "Extracted work scope pending requester review.";
  state.draft.controls = state.draft.controls || defaultControls;

  if (!state.draft.hazards.length) {
    state.draft.hazards = ["Hot Work"];
  }

  saveDraft();
  render();
  showToast("Document fields mapped into the permit draft.");
}

function formatEditor(action) {
  const textarea = appWorkspace.querySelector('[data-field="controls"]');

  if (!textarea) {
    return;
  }

  if (action === "editor-list") {
    textarea.value = textarea.value
      .split("\n")
      .map((line, index) => (line.trim() ? `${index + 1}. ${line.replace(/^\d+\.\s*/, "")}` : line))
      .join("\n");
  }

  if (action === "editor-bold") {
    textarea.value += textarea.value.endsWith("\n") || !textarea.value ? "**control item**" : "\n**control item**";
  }

  if (action === "editor-italic") {
    textarea.value += textarea.value.endsWith("\n") || !textarea.value ? "_note_" : "\n_note_";
  }

  state.draft.controls = textarea.value;
  saveDraft();
}

function openWorkerDialog(workerId = null) {
  state.editingWorkerId = workerId;
  const worker = state.workers.find((item) => item.id === workerId);

  workerDialogTitle.textContent = worker ? "Edit Worker" : "Add New Worker";
  workerForm.elements.name.value = worker?.name || "";
  workerForm.elements.employeeId.value = worker?.employeeId || "";
  workerForm.elements.role.value = worker?.role || "";
  workerForm.elements.discipline.value = worker?.discipline || "";
  workerForm.elements.status.value = worker?.status || "valid";
  workerForm.elements.qualifications.value = worker?.qualifications.join(", ") || "";
  workerDialog.showModal();
}

function saveWorker(event) {
  event.preventDefault();
  const data = new FormData(workerForm);
  const workerPayload = {
    name: data.get("name").trim(),
    employeeId: data.get("employeeId").trim(),
    role: data.get("role").trim(),
    discipline: data.get("discipline").trim(),
    status: data.get("status"),
    qualifications: splitLines(data.get("qualifications")),
  };

  if (state.editingWorkerId) {
    state.workers = state.workers.map((worker) =>
      worker.id === state.editingWorkerId
        ? {
            ...worker,
            ...workerPayload,
            competency: workerPayload.status === "valid" ? Math.max(worker.competency, 86) : worker.competency,
          }
        : worker,
    );
    state.selectedWorkerId = state.editingWorkerId;
  } else {
    const id = workerPayload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const uniqueId = `${id || "worker"}-${Date.now().toString(36)}`;
    state.workers.push({
      id: uniqueId,
      ...workerPayload,
      tier: "Tier 1",
      competency: workerPayload.status === "valid" ? 82 : 55,
      certs: [
        {
          name: "Safety Induction",
          status: workerPayload.status,
          detail: workerPayload.status === "valid" ? "Valid till: Dec 2026" : "Review required",
        },
      ],
    });
    state.selectedWorkerId = uniqueId;
  }

  saveWorkers();
  workerDialog.close();
  state.activeView = "workers";
  showToast("Worker profile saved.");
  render();
}

function inviteContractor(event) {
  event.preventDefault();
  const data = new FormData(inviteForm);
  const contractor = {
    id: `external-${Date.now().toString(36)}`,
    name: data.get("name").trim(),
    email: data.get("email").trim(),
    company: data.get("company").trim(),
  };

  state.draft.invitedContractors = [...state.draft.invitedContractors, contractor];
  saveDraft();
  inviteDialog.close();
  inviteForm.reset();
  showToast("External contractor added to this permit.");
  render();
}

function uploadCertificate(workerId) {
  const worker = state.workers.find((item) => item.id === workerId);

  if (!worker) {
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
  input.addEventListener("change", () => {
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    worker.certs.unshift({
      name: file.name.replace(/\.[^.]+$/, ""),
      status: "valid",
      detail: "Uploaded today",
    });
    worker.status = worker.certs.some((cert) => cert.status === "expired") ? "expired" : "valid";
    worker.competency = Math.max(worker.competency, 88);
    saveWorkers();
    showToast("Certificate uploaded.");
    render();
  });
  input.click();
}

function exportCompliance() {
  const rows = state.workers
    .map((worker) => `${worker.employeeId},${worker.name},${worker.role},${worker.status}`)
    .join("\n");
  const blob = new Blob([`Employee ID,Name,Role,Status\n${rows}\n`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ptw-compliance-workers.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function logout() {
  try {
    if (session?.token && session.token !== OFFLINE_TOKEN) {
      await apiRequest("/api/auth/logout", { method: "POST" });
    }
  } catch {
    // Local cleanup still needs to happen if the token is already invalid.
  } finally {
    clearSessionStorage();
    window.location.replace("/login");
  }
}

function icon(name) {
  const icons = {
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/></svg>',
    "arrow-left": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>',
    "chevron-left": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    "chevron-right": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 19H8a5 5 0 1 1 1.2-9.85 7 7 0 0 1 13.2 2.35A3.8 3.8 0 0 1 17.5 19Z"/><path d="M12 12v6"/><path d="m9 15 3-3 3 3"/></svg>',
    document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l2 2v16H6V5l2-2Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4"/><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
    "edit-file": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m12 18 4-4 2 2-4 4h-2v-2Z"/></svg>',
    external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l2 2v16H6V5l2-2Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.6 1.5c-.9.7-1.7 1.2-1.7 2.5"/><path d="M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12h.01M12 5h.01M12 19h.01"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6.4 6.4l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    "plus-circle": '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6Z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.7 4.6L18 9.3l-4.3 1.7L12 15.5 10.3 11 6 9.3l4.3-1.7L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/><path d="m5 15 .9 2.1L8 18l-2.1.9L5 21l-.9-2.1L2 18l2.1-.9L5 15Z"/></svg>',
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8 12 3 7 8"/><path d="M12 3v12"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
    "user-plus": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="8" r="4"/><path d="M19 8v4M21 10h-4"/></svg>',
  };

  return icons[name] || icons.file;
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");

  if (viewButton) {
    setView(viewButton.dataset.view);
    return;
  }

  const riskCell = event.target.closest("[data-risk]");

  if (riskCell) {
    state.draft.likelihood = Number(riskCell.dataset.likelihood);
    state.draft.severity = Number(riskCell.dataset.severity);
    saveDraft();
    render();
    return;
  }

  const hazardButton = event.target.closest("[data-hazard]");

  if (hazardButton) {
    toggleHazard(hazardButton.dataset.hazard);
    return;
  }

  const actionButton = event.target.closest("[data-action]");

  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.action;

  if (action === "start-wizard") {
    state.activeView = "wizard";
    state.wizardStep = 1;
    setView("wizard");
  }

  if (action === "close-wizard") {
    setView("dashboard");
  }

  if (action === "wizard-next" && validateStep()) {
    state.wizardStep = Math.min(4, state.wizardStep + 1);
    saveDraft();
    render();
  }

  if (action === "wizard-back") {
    state.wizardStep = Math.max(1, state.wizardStep - 1);
    saveDraft();
    render();
  }

  if (action === "go-step") {
    const nextStep = Number(actionButton.dataset.step);
    if (nextStep <= state.wizardStep || validateStep(state.wizardStep)) {
      state.wizardStep = nextStep;
      render();
    }
  }

  if (action === "save-draft") {
    updateAllDraftInputs();
    saveDraft();
    showToast("Draft saved locally.");
  }

  if (action === "submit-permit" || action === "submit-local-draft") {
    submitPermit();
  }

  if (action === "continue-local-draft") {
    state.activeView = "wizard";
    state.wizardStep = 1;
    setView("wizard");
  }

  if (action === "submit-existing-permit") {
    submitExistingPermit(actionButton.dataset.permitId);
  }

  if (action === "view-permit") {
    showPermitDetails(actionButton.dataset.permitId);
  }

  if (action === "reset-draft") {
    resetDraft();
  }

  if (action === "browse-files") {
    appWorkspace.querySelector("#fileInput")?.click();
  }

  if (action === "extract-template") {
    extractTemplate();
  }

  if (["editor-bold", "editor-italic", "editor-list"].includes(action)) {
    formatEditor(action);
  }

  if (action === "toggle-qualified") {
    state.qualifiedOnly = !state.qualifiedOnly;
    render();
  }

  if (action === "toggle-worker") {
    toggleWorker(actionButton.dataset.workerId);
  }

  if (action === "clear-selection") {
    state.draft.selectedWorkers = [];
    state.draft.invitedContractors = [];
    saveDraft();
    render();
  }

  if (action === "open-invite-dialog") {
    inviteDialog.showModal();
  }

  if (action === "close-invite-dialog") {
    inviteDialog.close();
  }

  if (action === "open-worker-dialog") {
    openWorkerDialog();
  }

  if (action === "edit-worker") {
    openWorkerDialog(actionButton.dataset.workerId);
  }

  if (action === "close-worker-dialog") {
    workerDialog.close();
  }

  if (action === "select-worker-detail") {
    state.selectedWorkerId = actionButton.dataset.workerId;
    render();
  }

  if (action === "upload-cert") {
    uploadCertificate(actionButton.dataset.workerId);
  }

  if (action === "print-certs") {
    window.print();
  }

  if (action === "export-compliance") {
    exportCompliance();
  }

  if (action === "filter-dashboard") {
    state.search = "submitted";
    globalSearch.value = "submitted";
    render();
  }

  if (action === "show-activity") {
    showToast("Recent activity is visible in the permit register.");
  }
});

document.addEventListener("input", (event) => {
  if (event.target === globalSearch) {
    state.search = event.target.value;
    if (["dashboard", "permits", "workers"].includes(state.activeView)) {
      render();
    }
    return;
  }

  if (event.target.matches("[data-field]")) {
    updateDraftField(event.target);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-field]")) {
    updateDraftField(event.target);
  }

  if (event.target.id === "fileInput") {
    handleFiles(event.target.files);
  }

  if (event.target.id === "roleFilter" || event.target.id === "workerRoleFilter") {
    state.roleFilter = event.target.value;
    render();
  }
});

document.addEventListener("dragover", (event) => {
  const dropZone = event.target.closest(".drop-zone");

  if (!dropZone) {
    return;
  }

  event.preventDefault();
  dropZone.classList.add("is-dragover");
});

document.addEventListener("dragleave", (event) => {
  const dropZone = event.target.closest(".drop-zone");

  if (dropZone) {
    dropZone.classList.remove("is-dragover");
  }
});

document.addEventListener("drop", (event) => {
  const dropZone = event.target.closest(".drop-zone");

  if (!dropZone) {
    return;
  }

  event.preventDefault();
  dropZone.classList.remove("is-dragover");
  handleFiles(event.dataTransfer.files);
});

document.addEventListener("submit", (event) => {
  if (event.target === workerForm) {
    saveWorker(event);
  }

  if (event.target === inviteForm) {
    inviteContractor(event);
  }

  if (event.target.id === "supportForm") {
    event.preventDefault();
    event.target.reset();
    showToast("Support request logged locally.");
  }
});

demoLoginButton.addEventListener("click", demoLogin);
accessLoginButton.addEventListener("click", () => window.location.assign("/login"));
logoutButton.addEventListener("click", logout);

document.addEventListener("DOMContentLoaded", () => {
  syncNav();
  loadAppData();
});
