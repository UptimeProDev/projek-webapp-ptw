(function () {
  function getApiBase() {
    const { protocol } = window.location;

    if (protocol === "file:") {
      return "http://localhost:3000";
    }

    return "";
  }

  const API_BASE = getApiBase();
  const OFFLINE_TOKEN = "offline-requester-demo";
  const MAX_PERMIT_DOCUMENT_BYTES = 5 * 1024 * 1024;
  const STORAGE_KEYS = {
    session: "ptwSession",
    offlinePermits: "ptwRequesterOfflinePermits",
    permitCodes: "ptwRequesterPermitCodes",
    workers: "ptwRequesterWorkers",
  };

  function isStaticHtmlPage() {
    return location.protocol === "file:" || /\.html$/i.test(location.pathname);
  }

  function getAuthUrl(mode = "login") {
    if (isStaticHtmlPage()) {
      return `/index.html#${mode}`;
    }

    return `/${mode}`;
  }

  const statusLabels = {
    draft: "Draft",
    submitted: "Pending Approval",
    resubmitted: "Resubmitted",
    stage1_complete: "Permit Approval",
    pending: "Pending Approval",
    approved: "Active",
    active: "Active",
    rejected: "Rejected",
    closed: "Closed",
    cancelled: "Cancelled",
  };

  const typeIcons = {
    "Emergency Permit":
      '<path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5M12 17h.01" />',
    "Preventive Maintenance":
      '<path d="M14.7 6.3a4 4 0 0 0-5.7 5.7L3 18v3h3l6-6a4 4 0 0 0 5.7-5.7l-2.8 2.8-2-2Z" />',
    "Corrective Maintenance":
      '<path d="M14.7 6.3a4 4 0 0 0-5.7 5.7L3 18v3h3l6-6a4 4 0 0 0 5.7-5.7l-2.8 2.8-2-2Z" />',
    "Housekeeping":
      '<path d="M3 21h18M7 21V9l5-6 5 6v12M9 13h6" />',
    "Predictive Maintenance":
      '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" />',
    "Project":
      '<path d="M4 6h16M4 12h10M4 18h16" />',
  };

  const defaultWorkers = [
    {
      id: "W01",
      name: "John Doe",
      role: "Senior Welder",
      status: "valid",
      qualifications: ["Safety Induction", "Hot Work", "Gas Test"],
    },
    {
      id: "W02",
      name: "Marcus Thorne",
      role: "Electrical Technician",
      status: "valid",
      qualifications: ["Safety Induction", "Electrical", "Electrical Isolation", "LOTO"],
    },
    {
      id: "W03",
      name: "David Chen",
      role: "Site Supervisor",
      status: "valid",
      qualifications: ["Safety Induction", "Work at Height", "Working at Height"],
    },
    {
      id: "W04",
      name: "Elena Rodriguez",
      role: "Confined Space Attendant",
      status: "valid",
      qualifications: ["Safety Induction", "Confined Space", "Gas Test"],
    },
    {
      id: "W05",
      name: "Nadia Rahman",
      role: "Mechanical Technician",
      status: "valid",
      qualifications: ["Safety Induction", "Line Breaking", "Chemical Handling"],
    },
    {
      id: "W06",
      name: "Mike Smith",
      role: "Maintenance Technician",
      status: "expired",
      qualifications: ["Safety Induction", "Chemical Handling"],
    },
  ];

  const workerPermitTypes = [
    "Hot Work",
    "Confined Space",
    "Electrical Isolation",
    "Work at Height",
    "Line Breaking",
    "Chemical Handling",
  ];

  const workerRoleOptions = [
    "Welder",
    "Senior Welder",
    "Fire Watch",
    "Authorized Gas Tester",
    "Confined Space Entrant",
    "Confined Space Attendant",
    "Electrical Technician",
    "LOTO Authorized Person",
    "Work at Height Worker",
    "Scaffold Inspector",
    "Mechanical Technician",
    "Line Breaking Technician",
    "Chemical Handler",
    "General Maintenance Technician",
    "Maintenance Technician",
    "Site Supervisor",
    "Safety Officer",
  ];

  const certificationTypeOptions = [
    "Safety Induction",
    "Hot Work",
    "Fire Watch",
    "Authorized Gas Tester",
    "Confined Space Entry",
    "Confined Space Attendant",
    "Electrical Competency",
    "LOTO",
    "Work at Height",
    "Scaffold Inspector",
    "Line Breaking",
    "Chemical Handling",
    "First Aid",
  ];

  const qualificationAliases = new Map(
    [
      ["Hot Work", "Hot Work"],
      ["Hotwork", "Hot Work"],
      ["Confined Space", "Confined Space"],
      ["Confinedspace", "Confined Space"],
      ["Electrical Isolation", "Electrical Isolation"],
      ["Electrical", "Electrical Isolation"],
      ["LOTO", "Electrical Isolation"],
      ["Lockout Tagout", "Electrical Isolation"],
      ["Work at Height", "Work at Height"],
      ["Working at Height", "Work at Height"],
      ["WAH", "Work at Height"],
      ["Line Breaking", "Line Breaking"],
      ["Line Break", "Line Breaking"],
      ["Chemical Handling", "Chemical Handling"],
      ["Chemical", "Chemical Handling"],
    ].map(([alias, canonical]) => [qualificationKey(alias), canonical]),
  );

  const approverNameMap = {
    "admin@example.com": "PTW Admin",
    "supervisor@example.com": "Sam Supervisor",
    "safety@example.com": "Sarah Safety",
    "approver@example.com": "Amir Approver",
  };

  const approverOptions = {
    normal: [{ value: "PTW Admin", label: "PTW Admin" }],
    emergency: [{ value: "Sarah Safety", label: "Sarah Safety" }],
  };

  const digitalDocumentRequirements = [
    { type: "MOS", label: "Method Statement / MOS" },
    { type: "JSA", label: "JSA / SWP" },
  ];

  const digitalDocumentSchemas = {
    MOS: {
      title: "MOS Digital Form",
      fields: [
        { key: "workTitle", label: "Work Title", input: "input", help: "Same title used in the permit request" },
        { key: "workLocation", label: "Work Location", input: "input", help: "Plant, unit, area, or equipment location" },
        { key: "scope", label: "Scope of Work", input: "textarea", help: "Work scope and boundary" },
        { key: "methodSteps", label: "Method Steps", input: "textarea", help: "One method step per line, in sequence" },
        { key: "toolsEquipment", label: "Tools / Equipment", input: "textarea", help: "Tools, machines, access equipment, test equipment" },
        { key: "materials", label: "Materials / Chemicals", input: "textarea", help: "Consumables, chemicals, SDS reference if applicable" },
        { key: "isolations", label: "Isolation / Preparation", input: "textarea", help: "LOTO, drains, barricades, depressurization, cleaning" },
        { key: "responsiblePerson", label: "Responsible Person", input: "input", help: "Supervisor or competent person accountable for the work" },
        { key: "emergencyArrangement", label: "Emergency Arrangement", input: "textarea", help: "Emergency contact, muster point, rescue or spill response" },
      ],
    },
    JSA: {
      title: "JSA Digital Form",
      fields: [
        { key: "taskStep", label: "Task Step / Activity", input: "textarea", help: "Task or activity being assessed" },
        { key: "permitTypeHazards", label: "Permit Type / Hazard", input: "textarea", help: "Hot work, confined space, electrical, height, chemical, etc." },
        { key: "potentialConsequence", label: "Potential Consequence", input: "textarea", help: "What could happen if the hazard is not controlled" },
        { key: "controlMeasures", label: "Control Measures", input: "textarea", help: "Preventive and protective controls required before work" },
        { key: "requiredPpe", label: "Required PPE", input: "textarea", help: "PPE required for the activity" },
        { key: "responsiblePerson", label: "Responsible Person", input: "input", help: "Person responsible for the controls" },
        { key: "residualRisk", label: "Residual Risk", input: "input", help: "Low, Medium, High, or local risk rating" },
      ],
    },
  };

  const emergencyDocumentRequirements = [
    { type: "ERP", label: "Emergency Response Plan", inputName: "erpDocument" },
  ];

  const permitDocumentRequirements = {
    "Hot Work": [
      {
        type: "HOT_WORK_CHECKLIST",
        label: "Hot Work Checklist / Fire Watch Plan",
        inputName: "hotWorkChecklistDocument",
      },
    ],
    "Confined Space": [
      {
        type: "CONFINED_SPACE_ENTRY",
        label: "Confined Space Entry Permit / Entry Plan",
        inputName: "confinedSpaceEntryDocument",
      },
      {
        type: "RESCUE_PLAN",
        label: "Confined Space Rescue Plan",
        inputName: "rescuePlanDocument",
      },
    ],
    "Work at Height": [
      {
        type: "WAH_PLAN",
        label: "Working at Height Fall Protection Plan",
        inputName: "wahPlanDocument",
      },
    ],
    "Electrical Isolation": [
      {
        type: "LOTO_PLAN",
        label: "LOTO / Electrical Isolation Plan",
        inputName: "lotoPlanDocument",
      },
      {
        type: "ELECTRICAL_CERTIFICATE",
        label: "Electrical Isolation Certificate",
        inputName: "electricalCertificateDocument",
      },
    ],
    "Line Breaking": [
      {
        type: "ISOLATION_PLAN",
        label: "Line Isolation / Depressurization Plan",
        inputName: "isolationPlanDocument",
      },
      {
        type: "SDS",
        label: "SDS / Exposure Controls",
        inputName: "sdsDocument",
      },
    ],
    "Preventive Maintenance": [],
    "Corrective Maintenance": [],
    "Housekeeping": [],
    "Predictive Maintenance": [],
    "Project": [],
  };

  const samplePermits = [
    {
      id: "PTW-2026-1194",
      title: "Pump skid preventive inspection",
      workType: "Preventive Maintenance",
      location: "Main Plant Alpha - Sector 4",
      status: "submitted",
      description: "Permit Type: Preventive Maintenance\n\nPreventive inspection near pump skid.",
      startDateTime: "2026-06-03T10:00",
      endDateTime: "2026-06-03T15:00",
      hazards: ["Mechanical", "Working at Height"],
      controls: ["Fire watch assigned", "Gas test before start"],
      ppe: ["Fire resistant coveralls", "Face shield"],
      approvers: ["PTW Admin"],
      documents: [
        { type: "JSA", name: "pump-skid-jsa.pdf" },
      ],
      assignedWorkers: ["W01"],
      createdAt: "2026-06-03T06:20:00.000Z",
      updatedAt: "2026-06-03T06:20:00.000Z",
      isOffline: true,
    },
    {
      id: "PTW-2026-1191",
      title: "Vessel 12 corrective inspection",
      workType: "Corrective Maintenance",
      location: "Tank Farm B - Vessel 12",
      status: "active",
      description: "Permit Type: Corrective Maintenance\n\nInternal inspection before maintenance entry.",
      startDateTime: "2026-06-03T08:00",
      endDateTime: "2026-06-03T18:00",
      hazards: ["Confined Space"],
      controls: ["Standby person assigned", "Continuous gas monitoring"],
      ppe: ["Respirator", "Harness"],
      approvers: ["PTW Admin"],
      documents: [
        { type: "JSA", name: "vessel-12-entry-jsa.pdf" },
      ],
      assignedWorkers: ["W04"],
      createdAt: "2026-06-02T08:30:00.000Z",
      updatedAt: "2026-06-03T00:20:00.000Z",
      isOffline: true,
    },
    {
      id: "PTW-2026-1189",
      title: "Substation panel predictive check",
      workType: "Predictive Maintenance",
      location: "Substation A - Panel 3",
      status: "draft",
      description: "Permit Type: Predictive Maintenance\n\nPrepare condition monitoring check for panel isolation.",
      startDateTime: "2026-06-04T09:00",
      endDateTime: "2026-06-04T13:00",
      hazards: ["Electrical"],
      controls: ["LOTO register prepared"],
      ppe: ["Arc flash PPE"],
      approvers: ["PTW Admin"],
      documents: [
        { type: "JSA", name: "panel-isolation-jsa.pdf" },
      ],
      assignedWorkers: ["W02"],
      createdAt: "2026-06-02T10:00:00.000Z",
      updatedAt: "2026-06-02T10:00:00.000Z",
      isOffline: true,
    },
    {
      id: "PTW-2026-1184",
      title: "Cooling water header project tie-in",
      workType: "Project",
      location: "Cooling Water Header",
      status: "rejected",
      description:
        "Permit Type: Project\n\nRevise isolation boundary and attach updated JSA.",
      startDateTime: "2026-06-04T08:00",
      endDateTime: "2026-06-04T12:00",
      hazards: ["Chemical Handling"],
      controls: ["Drain and depressurize line"],
      ppe: ["Chemical gloves", "Face shield"],
      approvers: ["PTW Admin"],
      documents: [
        { type: "JSA", name: "line-break-revised-jsa.pdf" },
      ],
      assignedWorkers: ["W05"],
      createdAt: "2026-06-01T06:00:00.000Z",
      updatedAt: "2026-06-02T09:15:00.000Z",
      isOffline: true,
    },
  ];

  const state = {
    activeFilter: "all",
    activeView: "dashboard",
    mode: "loading",
    query: "",
    session: readSession(),
    permits: [],
    notifications: [],
    permitCodes: readJsonStorage(STORAGE_KEYS.permitCodes, {}),
    workers: readStoredWorkers(),
    editingId: null,
    editingWorkerId: null,
    isEmergencyPermit: false,
    structuredDocuments: [],
  };

  const elements = {
    table: document.querySelector(".table-wrap table"),
    tableBody: document.querySelector("#permitTableBody"),
    tableHead: document.querySelector("#permitTableHead"),
    tableToolbar: document.querySelector(".table-toolbar"),
    searchInput: document.querySelector("#permitSearch"),
    toast: document.querySelector("#toast"),
    permitDialog: document.querySelector("#permitDialog"),
    permitForm: document.querySelector("#permitForm"),
    permitDialogTitle: document.querySelector("#permitDialogTitle"),
    permitDialogSubtitle: document.querySelector("#permitDialogSubtitle"),
    submitPermitButton: document.querySelector("#submitPermitButton"),
    permitDetailDialog: document.querySelector("#permitDetailDialog"),
    detailTitle: document.querySelector("#detailTitle"),
    detailSubtitle: document.querySelector("#detailSubtitle"),
    detailList: document.querySelector("#detailList"),
    workerOptions: document.querySelector("#workerOptions"),
    workerDialog: document.querySelector("#workerDialog"),
    workerForm: document.querySelector("#workerForm"),
    workerDialogTitle: document.querySelector("#workerDialogTitle"),
    workerDialogSubtitle: document.querySelector("#workerDialogSubtitle"),
    workerRoleSelect: document.querySelector("#workerRoleSelect"),
    workerPermitTypes: document.querySelector("#workerPermitTypes"),
    workerCertificationList: document.querySelector("#workerCertificationList"),
    addWorkerCertificationButton: document.querySelector("#addWorkerCertificationButton"),
    documentGrid: document.querySelector("#documentGrid"),
    digitalDocumentEditor: document.querySelector("#digitalDocumentEditor"),
    downloadMosJsaTemplateButton: document.querySelector("#downloadMosJsaTemplateButton"),
    importMosJsaTemplateInput: document.querySelector("#importMosJsaTemplateInput"),
    digitalDocumentStatus: document.querySelector("#digitalDocumentStatus"),
    notificationButton: document.querySelector("#notificationButton"),
    notificationCloseButton: document.querySelector("#notificationCloseButton"),
    notificationPanel: document.querySelector("#notificationPanel"),
    notificationList: document.querySelector("#notificationList"),
    notificationCount: document.querySelector("#notificationCount"),
    notificationDot: document.querySelector("#notificationDot"),
    profileName: document.querySelector("#profileName"),
    profileRole: document.querySelector("#profileRole"),
    profileAvatar: document.querySelector("#profileAvatar"),
    accountButton: document.querySelector("#accountButton"),
    currentDateLabel: document.querySelector("#currentDateLabel"),
    recentRequestsTitle: document.querySelector("#recentRequestsTitle"),
  };

  let toastTimer;
  const toastHome = elements.toast?.parentElement || document.body;

  function readSession() {
    const stored =
      localStorage.getItem(STORAGE_KEYS.session) ||
      sessionStorage.getItem(STORAGE_KEYS.session);

    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored);
    } catch {
      clearSession();
      return null;
    }
  }

  function saveSession(payload, remember = true) {
    clearSession();
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(STORAGE_KEYS.session, JSON.stringify(payload));
    state.session = payload;
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.session);
    sessionStorage.removeItem(STORAGE_KEYS.session);
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

  function readStoredWorkers() {
    const workers = readJsonStorage(STORAGE_KEYS.workers, defaultWorkers);
    return (Array.isArray(workers) ? workers : defaultWorkers).map(normalizeWorkerRecord);
  }

  function refreshWorkersFromStorage() {
    const stored = readJsonStorage(STORAGE_KEYS.workers, null);
    if (stored && Array.isArray(stored)) {
      state.workers = stored.map(normalizeWorkerRecord);
      // If permit form is open, refresh worker options; otherwise re-render summaries
      try {
        if (document.querySelector('#permitDialog')?.open) {
          const selectedWorkerIds = new FormData(elements.permitForm).getAll('assignedWorkers').map(String);
          renderWorkerOptions(selectedWorkerIds);
        } else {
          render();
        }
      } catch (e) {
        render();
      }
    }
  }

  function syncPermitCodes() {
    let changed = false;

    state.permits.forEach((permit) => {
      if (!permit.id || state.permitCodes[permit.id]) {
        return;
      }

      state.permitCodes[permit.id] = getNextPermitCode();
      changed = true;
    });

    if (changed) {
      writeJsonStorage(STORAGE_KEYS.permitCodes, state.permitCodes);
    }
  }

  function getNextPermitCode() {
    const maxCode = Object.values(state.permitCodes).reduce((max, code) => {
      const match = String(code).match(/^P(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `P${String(maxCode + 1).padStart(2, "0")}`;
  }

  function getDisplayPermitId(permitOrId) {
    const id = typeof permitOrId === "string" ? permitOrId : permitOrId?.id;
    return state.permitCodes[id] || id || "-";
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

  function showToast(message) {
    const openDialogShell = document.querySelector("dialog[open] .dialog-shell");

    if (openDialogShell && elements.toast.parentElement !== openDialogShell) {
      const actions = openDialogShell.querySelector(".dialog-actions");
      elements.toast.classList.add("in-dialog");
      if (actions) {
        openDialogShell.insertBefore(elements.toast, actions);
      } else {
        openDialogShell.append(elements.toast);
      }
    } else if (!openDialogShell && elements.toast.parentElement !== toastHome) {
      elements.toast.classList.remove("in-dialog");
      toastHome.append(elements.toast);
    }

    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("is-visible");
      if (elements.toast.parentElement !== toastHome && !document.querySelector("dialog[open]")) {
        elements.toast.classList.remove("in-dialog");
        toastHome.append(elements.toast);
      }
    }, 2800);
  }

  function getAuthHeaders() {
    return state.session?.token && state.session.token !== OFFLINE_TOKEN
      ? { authorization: `Bearer ${state.session.token}` }
      : {};
  }

  function redirectToLogin() {
    clearSession();
    state.session = null;
    window.location.assign(getAuthUrl("login"));
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (response.status === 401 && state.session?.token && state.session.token !== OFFLINE_TOKEN) {
      redirectToLogin();
    }

    if (!response.ok) {
      throw { status: response.status, ...body };
    }

    return body;
  }

  function setProfile(user) {
    const fallbackUser = {
      fullName: "Rina Requester",
      role: "requester",
      email: "requester@example.com",
    };
    const resolvedUser = user || state.session?.user || fallbackUser;
    const name = resolvedUser.fullName || resolvedUser.email || fallbackUser.fullName;

    elements.profileName.textContent = name;
    elements.profileRole.textContent =
      state.mode === "offline" ? "Permit Requester (Offline)" : "Permit Requester";
    if (resolvedUser.profilePictureUrl) {
      elements.profileAvatar.innerHTML = `<img src="${resolvedUser.profilePictureUrl}" alt="">`;
    } else {
      elements.profileAvatar.textContent = initials(name);
    }
  }

  function setCurrentDate() {
    const formatter = new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    elements.currentDateLabel.textContent = `Today, ${formatter.format(new Date())}`;
  }

  async function initializeSession() {
    setCurrentDate();

    if (state.session?.token && state.session.token !== OFFLINE_TOKEN) {
      try {
        await loadOnlineData();
        return;
      } catch {
        redirectToLogin();
        return;
      }
    }

    redirectToLogin();
  }

  async function loadOnlineData() {
    state.mode = "online";
    const [dashboardResult, permitsResult, notificationResult] = await Promise.all([
      apiRequest("/api/requester/dashboard"),
      apiRequest("/api/permits"),
      loadNotifications(),
    ]);

    state.session = {
      ...state.session,
      user: dashboardResult.user || state.session?.user,
    };
    state.permits = (permitsResult.permits || permitsResult.data || []).map(normalizePermit);
    state.notifications = notificationResult.notifications || notificationResult.data || [];
    syncPermitCodes();
    setProfile(dashboardResult.user);
    // Try to load workers from server; fallback to localStorage if unavailable
    try {
      const workersResp = await apiRequest('/api/workers');
      if (workersResp && Array.isArray(workersResp.workers)) {
        state.workers = workersResp.workers.map((w) => ({
          id: w.employeeId || w.id,
          systemId: w.id,
          employeeId: w.employeeId || "",
          name: w.name,
          role: w.role,
          icPassport: w.icPassport || "",
          phone: w.phone || "",
          email: w.email || "",
          company: w.company || "",
          permits: Array.isArray(w.permits) ? w.permits : [],
          certifications: Array.isArray(w.certifications) ? w.certifications : [],
          reviewComment: w.reviewComment || "",
          status: w.status || 'valid',
          qualifications: normalizeQualifications(w.permits),
        }));
      }
    } catch (e) {
      // ignore and continue with local storage workers
    }

    render();
  }

  async function refreshWorkersFromServer() {
    if (state.mode !== "online") return;

    const workersResp = await apiRequest("/api/workers");
    if (workersResp && Array.isArray(workersResp.workers)) {
      state.workers = workersResp.workers.map((w) => ({
        id: w.employeeId || w.id,
        systemId: w.id,
        employeeId: w.employeeId || "",
        name: w.name,
        role: w.role,
        icPassport: w.icPassport || "",
        phone: w.phone || "",
        email: w.email || "",
        company: w.company || "",
        permits: Array.isArray(w.permits) ? w.permits : [],
        certifications: Array.isArray(w.certifications) ? w.certifications : [],
        reviewComment: w.reviewComment || "",
        status: w.status || "valid",
        qualifications: normalizeQualifications(w.permits),
      }));
    }
  }

  function normalizePermit(permit) {
    const workType = permit.workType || extractWorkType(permit);
    const isEmergency = Boolean(
      permit.isEmergency ||
        String(permit.description || "").match(/^Permit Class:\s*Emergency$/im) ||
        (Array.isArray(permit.hazards) && permit.hazards.includes("Emergency")),
    );

    return {
      ...permit,
      workType,
      title: permit.title || "Untitled permit",
      status: permit.status || "draft",
      isEmergency,
      hazards: Array.isArray(permit.hazards) ? permit.hazards : [],
      controls: Array.isArray(permit.controls) ? permit.controls : [],
      ppe: Array.isArray(permit.ppe) ? permit.ppe : [],
      approvers: normalizeApprovers(permit.approvers),
      documents: normalizeDocuments(permit.documents, permit.description),
      assignedWorkers: Array.isArray(permit.assignedWorkers)
        ? permit.assignedWorkers
        : extractAssignedWorkerIds(permit.description),
    };
  }

  function extractWorkType(permit) {
    const description = String(permit.description || "");
    const match = description.match(/Permit Type:\s*([^\n]+)/i);
    if (match) {
      return match[1].trim();
    }

    const source = [permit.title, description, ...(permit.hazards || [])]
      .join(" ")
      .toLowerCase();

    if (source.includes("corrective") || source.includes("repair") || source.includes("breakdown")) {
      return "Corrective Maintenance";
    }
    if (source.includes("housekeeping") || source.includes("cleaning")) return "Housekeeping";
    if (source.includes("predictive") || source.includes("condition monitoring")) {
      return "Predictive Maintenance";
    }
    if (source.includes("project") || source.includes("tie-in")) return "Project";
    return "Preventive Maintenance";
  }

  function extractScope(description) {
    return String(description || "")
      .split("\n")
      .filter((line) => !/^Permit Class:/i.test(line.trim()))
      .filter((line) => !/^Review Route:/i.test(line.trim()))
      .filter((line) => !/^Permit Type:/i.test(line.trim()))
      .filter((line) => !/^Assigned Workers:/i.test(line.trim()))
      .filter((line) => !/^Assigned Worker IDs:/i.test(line.trim()))
      .filter((line) => !/^Required Documents:/i.test(line.trim()))
      .filter((line) => !/^(HIRARC|MOS|JSA):/i.test(line.trim()))
      .join("\n")
      .trim();
  }

  function extractAssignedWorkerIds(description) {
    const match = String(description || "").match(/^Assigned Worker IDs:\s*(.+)$/im);
    if (!match) {
      return [];
    }

    return match[1]
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && id !== "-" && Boolean(getWorkerById(id)));
  }

  function getWorkerById(workerId) {
    const needle = String(workerId || "").trim().toLowerCase();
    if (!needle) return null;

    return state.workers.find((worker) =>
      [worker.id, worker.systemId, worker.employeeId, worker.email, worker.name]
        .map((value) => String(value || "").trim().toLowerCase())
        .includes(needle),
    );
  }

  function qualificationKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizeQualification(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return qualificationAliases.get(qualificationKey(raw)) || raw;
  }

  function normalizeQualifications(values) {
    const list = Array.isArray(values) ? values : String(values || "").split(",");
    const normalized = [];
    const seen = new Set();

    list.forEach((value) => {
      const label = normalizeQualification(value);
      const key = qualificationKey(label);
      if (!label || seen.has(key)) return;
      seen.add(key);
      normalized.push(label);
    });

    return normalized;
  }

  function normalizeWorkerRecord(worker = {}) {
    return {
      ...worker,
      status: worker.status || "valid",
      systemId: worker.systemId || worker.id,
      permits: Array.isArray(worker.permits) ? worker.permits : [],
      qualifications: normalizeQualifications(worker.qualifications || worker.permits),
      certifications: normalizeWorkerCertifications(worker.certifications),
      reviewComment: worker.reviewComment || "",
    };
  }

  function normalizeWorkerCertifications(certifications = []) {
    const source = Array.isArray(certifications) ? certifications : [];

    return source
      .map((certification) => ({
        id: String(certification?.id || "").trim(),
        type: String(certification?.type || certification?.name || "").trim(),
        number: String(certification?.number || certification?.certificateNo || "").trim(),
        issuer: String(certification?.issuer || "").trim(),
        issueDate: String(certification?.issueDate || "").trim(),
        expiryDate: String(certification?.expiryDate || certification?.expiry || "").trim(),
        fileName: String(certification?.fileName || certification?.attachmentName || "").trim(),
        mimeType: String(certification?.mimeType || certification?.attachmentMimeType || "").trim(),
        attachmentData: String(certification?.attachmentData || certification?.fileData || certification?.contentBase64 || "").trim(),
        hasAttachment: Boolean(certification?.hasAttachment || certification?.attachmentData),
      }))
      .filter((certification) =>
        [
          certification.id,
          certification.type,
          certification.number,
          certification.issuer,
          certification.issueDate,
          certification.expiryDate,
          certification.fileName,
          certification.mimeType,
          certification.attachmentData,
          certification.hasAttachment ? "1" : "",
        ].some((value) => String(value || "").trim()),
      );
  }

  function workerCertificationDownloadButton(workerId, certification, label = "Download") {
    if (!workerId || !certification?.id || !certification?.hasAttachment) return "";
    return `<button class="row-button" type="button" data-worker-cert-download="${escapeHtml(workerId)}" data-certification-id="${escapeHtml(certification.id)}" data-file-name="${escapeHtml(certification.fileName || "certificate")}">${escapeHtml(label)}</button>`;
  }

  async function readFileAsBase64(file) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const marker = result.indexOf(",");
        resolve(marker >= 0 ? result.slice(marker + 1) : result);
      };
      reader.onerror = () => reject(new Error("Unable to read uploaded file."));
      reader.readAsDataURL(file);
    });
  }

  async function downloadWorkerCertification(workerId, certificationId, fileName) {
    const response = await fetch(`${API_BASE}/api/workers/${encodeURIComponent(workerId)}/certifications/${encodeURIComponent(certificationId)}/download`, {
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      let message = "Unable to download certificate.";
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {
        // Ignore non-JSON error body.
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName || "certificate";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  }

  function workerStatusLabel(status) {
    const normalized = String(status || "submitted").toLowerCase();
    if (normalized === "valid") return "Valid";
    if (normalized === "rejected") return "Returned";
    if (normalized === "expired") return "Expired";
    return "Submitted";
  }

  function formatAssignedWorkers(workerIds) {
    const names = (workerIds || [])
      .map((workerId) => getWorkerById(workerId))
      .filter(Boolean)
      .map((worker) => `${worker.name} (${worker.role})`);

    return names.length ? names.join(", ") : "-";
  }

  function buildAssignedWorkerIdentifiers(workerIds) {
    return (workerIds || [])
      .map((workerId) => String(workerId || "").trim())
      .filter(Boolean)
      .filter((value, index, list) =>
        list.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index,
      );
  }

  function getSelectedPermitTypes() {
    if (!elements.permitForm) return [];
    return Array.from(elements.permitForm.querySelectorAll('input[name="hazards"]:checked'))
      .map((input) => String(input.value || "").trim())
      .filter((permitType) => permitType && permitType !== "Emergency")
      .map(normalizeQualification)
      .filter((permitType, index, list) =>
        list.findIndex((item) => qualificationKey(item) === qualificationKey(permitType)) === index,
      );
  }

  function getWorkerMatchedPermitTypes(worker, permitTypes) {
    const required = (permitTypes || []).map(normalizeQualification);
    const qualifications = normalizeQualifications(worker.qualifications || worker.permits);
    return required.filter((permitType) =>
      qualifications.some((qualification) => qualificationKey(qualification) === qualificationKey(permitType)),
    );
  }

  function isWorkerCompetent(worker, permitTypes = []) {
    if (worker.status !== "valid") {
      return false;
    }

    const required = (permitTypes || []).map(normalizeQualification).filter(Boolean);
    if (!required.length) return true;

    return getWorkerMatchedPermitTypes(worker, required).length === required.length;
  }

  function toUiStatus(status) {
    if (status === "submitted" || status === "resubmitted" || status === "stage1_complete") return "pending";
    if (status === "approved" || status === "active") return "active";
    return status || "draft";
  }

  function formatStatus(status) {
    return statusLabels[status] || statusLabels[toUiStatus(status)] || "Draft";
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function buildNotifications() {
    if (state.notifications.length) {
      return state.notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        detail: notification.message || "PTW update",
        meta: formatDateTime(notification.createdAt),
        link: notification.link,
        unread: notification.unread,
      }));
    }

    const notifications = [];
    const counts = getCounts();
    const returnedPermits = state.permits
      .filter((permit) => toUiStatus(permit.status) === "rejected")
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    const pendingPermits = state.permits.filter((permit) => toUiStatus(permit.status) === "pending");
    const activePermits = state.permits.filter((permit) => toUiStatus(permit.status) === "active");
    const returnedWorkers = state.workers.filter(
      (worker) => String(worker.status || "").toLowerCase() === "rejected",
    );
    const expiringWorkers = state.workers.filter(
      (worker) => String(worker.status || "").toLowerCase() === "expired",
    );

    returnedPermits.slice(0, 3).forEach((permit) => {
      notifications.push({
        id: `permit-returned-${permit.id}`,
        title: `${getDisplayPermitId(permit)} needs revision`,
        detail: permit.latestRejectionReason || permit.title || permit.workType || "Returned permit",
        meta: formatDateTime(permit.updatedAt || permit.createdAt),
        view: "permits",
        filter: "rejected",
        query: getDisplayPermitId(permit),
      });
    });

    if (pendingPermits.length) {
      notifications.push({
        id: "permit-pending",
        title: `${pendingPermits.length} permit${pendingPermits.length === 1 ? "" : "s"} awaiting approval`,
        detail: "Submitted permits are still in the approval queue.",
        meta: "Pending",
        view: "permits",
        filter: "pending",
      });
    }

    if (activePermits.length) {
      notifications.push({
        id: "permit-active",
        title: `${activePermits.length} approved or active permit${activePermits.length === 1 ? "" : "s"}`,
        detail: "Monitor approved work and active jobs from the compliance view.",
        meta: "Active work",
        view: "compliance",
        filter: "active",
      });
    }

    if (counts.draft) {
      notifications.push({
        id: "permit-drafts",
        title: `${counts.draft} draft permit${counts.draft === 1 ? "" : "s"} not submitted`,
        detail: "Drafts must be completed before Admin Lane 2 review.",
        meta: "Draft",
        view: "permits",
        filter: "draft",
      });
    }

    returnedWorkers.slice(0, 3).forEach((worker) => {
      notifications.push({
        id: `worker-returned-${worker.id || worker.employeeId}`,
        title: `${worker.name || "Worker profile"} was returned`,
        detail: worker.reviewComment || "Update the worker profile and submit again.",
        meta: "Worker profile",
        view: "workers",
        filter: "all",
        query: worker.name || worker.employeeId || worker.email || "",
      });
    });

    if (expiringWorkers.length) {
      notifications.push({
        id: "worker-expired",
        title: `${expiringWorkers.length} worker profile${expiringWorkers.length === 1 ? "" : "s"} need attention`,
        detail: "Expired or invalid worker records may block permit assignment.",
        meta: "Workers",
        view: "workers",
        filter: "all",
      });
    }

    return notifications.slice(0, 8);
  }

  async function loadNotifications() {
    if (state.mode === "offline") {
      return { notifications: [] };
    }

    try {
      return await apiRequest("/api/notifications?limit=20");
    } catch {
      return { notifications: [] };
    }
  }

  function renderNotifications() {
    if (!elements.notificationList) return;
    const notifications = buildNotifications();
    const hasPersistentUnreadState = notifications.some((notification) =>
      Object.prototype.hasOwnProperty.call(notification, "unread"),
    );
    const unreadCount = hasPersistentUnreadState
      ? notifications.filter((notification) => notification.unread).length
      : notifications.length;
    const countLabel = unreadCount
      ? `${unreadCount} unread`
      : notifications.length === 1 ? "1 item" : `${notifications.length} items`;

    elements.notificationCount.textContent = countLabel;
    elements.notificationDot.hidden = unreadCount === 0;
    elements.notificationButton?.setAttribute(
      "aria-label",
      notifications.length ? `Open notifications, ${countLabel}` : "Open notifications",
    );

    if (!notifications.length) {
      elements.notificationList.innerHTML = '<p class="notification-empty">No active notifications.</p>';
      return;
    }

    elements.notificationList.innerHTML = notifications
      .map(
        (notification) => `
          <button class="notification-item" type="button"
            data-notification-id="${escapeHtml(notification.id || "")}"
            data-notification-link="${escapeHtml(notification.link || "")}"
            data-notification-view="${escapeHtml(notification.view)}"
            data-notification-filter="${escapeHtml(notification.filter || "all")}"
            data-notification-query="${escapeHtml(notification.query || "")}">
            <small>${escapeHtml(notification.meta || "Update")}</small>
            <strong>${escapeHtml(notification.title)}</strong>
            <span>${escapeHtml(notification.detail)}</span>
          </button>
        `,
      )
      .join("");
  }

  function setNotificationPanel(open) {
    if (!elements.notificationPanel || !elements.notificationButton) return;
    elements.notificationPanel.hidden = !open;
    elements.notificationButton.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function openNotificationTarget(button) {
    const notificationId = button.dataset.notificationId || "";
    const link = button.dataset.notificationLink || "";
    if (notificationId && state.mode === "online") {
      apiRequest(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: "PATCH",
      }).catch(() => {});
      state.notifications = state.notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, unread: false, readAt: new Date().toISOString() } : notification,
      );
      renderNotifications();
    }

    if (link && link !== window.location.pathname) {
      window.location.assign(link);
      return;
    }

    const view = button.dataset.notificationView || "dashboard";
    const filter = button.dataset.notificationFilter || "all";
    const query = button.dataset.notificationQuery || "";

    state.activeView = view;
    state.activeFilter = filter;
    state.query = query;
    elements.searchInput.value = query;
    setNotificationPanel(false);
    render();
  }

  function splitList(value) {
    return String(value || "")
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeApprovers(value) {
    const source = Array.isArray(value) ? value : splitList(value);
    return source.map((approver) => approverNameMap[approver] || approver);
  }

  function extractDocuments(description) {
    const documents = [];
    const pattern =
      /^(MOS|Method Statement|HIRARC|JSA|ERP|Emergency Response Plan|Hot Work Checklist|Fire Watch Plan|Confined Space Entry|Rescue Plan|WAH Plan|Working at Height Plan|LOTO Plan|Electrical Certificate|Isolation Plan|SDS):\s*(.+)$/gim;
    let match = pattern.exec(String(description || ""));

    while (match) {
      documents.push({
        type: canonicalDocumentType(match[1]),
        name: match[2].trim(),
      });
      match = pattern.exec(String(description || ""));
    }

    return documents;
  }

  function canonicalDocumentType(type) {
    const value = String(type || "").trim().toLowerCase();
    if (value === "method statement") return "MOS";
    if (value === "emergency response plan") return "ERP";
    if (value === "hot work checklist" || value === "fire watch plan") return "HOT_WORK_CHECKLIST";
    if (value === "confined space entry") return "CONFINED_SPACE_ENTRY";
    if (value === "rescue plan") return "RESCUE_PLAN";
    if (value === "wah plan" || value === "working at height plan") return "WAH_PLAN";
    if (value === "loto plan") return "LOTO_PLAN";
    if (value === "electrical certificate") return "ELECTRICAL_CERTIFICATE";
    if (value === "isolation plan") return "ISOLATION_PLAN";
    return String(type || "").trim().toUpperCase();
  }

  function normalizeStructuredData(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.entries(value).reduce((normalized, [key, rawValue]) => {
      const cleanKey = String(key || "").trim();
      if (!cleanKey) return normalized;

      if (Array.isArray(rawValue)) {
        const items = rawValue.map((item) => String(item || "").trim()).filter(Boolean);
        if (items.length) normalized[cleanKey] = items;
        return normalized;
      }

      const cleanValue = String(rawValue || "").trim();
      if (cleanValue) normalized[cleanKey] = cleanValue;
      return normalized;
    }, {});
  }

  function isStructuredDocumentType(type) {
    return ["MOS", "JSA"].includes(String(type || "").trim().toUpperCase());
  }

  function normalizeDocuments(documents, description) {
    const normalized = new Map();
    const sources = [
      ...(Array.isArray(documents) ? documents : []),
      ...extractDocuments(description),
    ];

    sources.forEach((document) => {
      const type = String(document?.type || "").trim().toUpperCase();
      const name = String(document?.name || "").trim();

      if (type && name) {
        const existing = normalized.get(type) || {};
        const structuredData = normalizeStructuredData(document?.structuredData || existing.structuredData);
        normalized.set(type, {
          ...existing,
          type,
          name,
          id: String(document?.id || existing.id || "").trim(),
          fileName: String(document?.fileName || document?.filename || name).trim(),
          mimeType: String(document?.mimeType || document?.attachmentMimeType || existing.mimeType || "").trim(),
          hasAttachment: Boolean(document?.hasAttachment || document?.attachmentData || existing.hasAttachment),
          ...(isStructuredDocumentType(type) && Object.keys(structuredData).length ? { structuredData } : {}),
          ...(document?.source || existing.source ? { source: String(document?.source || existing.source).trim() } : {}),
          ...(document?.templateVersion || existing.templateVersion
            ? { templateVersion: String(document?.templateVersion || existing.templateVersion).trim() }
            : {}),
        });
      }
    });

    return Array.from(normalized.values());
  }

  function getDocumentName(documents, type) {
    return (documents || []).find((document) => document.type === type)?.name || "";
  }

  function formatDocuments(documents) {
    return (documents || [])
      .map((document) => {
        const name = String(document?.name || "").trim();
        const type = String(document?.type || "").trim();
        return name && type ? `${type}: ${name}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  function toLocalInputValue(value, hourOffset = 1) {
    const source = value ? new Date(value) : new Date();
    if (!value) {
      source.setHours(source.getHours() + hourOffset, 0, 0, 0);
    }
    if (Number.isNaN(source.getTime())) return "";
    const local = new Date(source.getTime() - source.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function getCounts() {
    return state.permits.reduce(
      (summary, permit) => {
        const uiStatus = toUiStatus(permit.status);
        if (uiStatus === "draft") summary.draft += 1;
        if (uiStatus === "pending") summary.pending += 1;
        if (uiStatus === "active") summary.active += 1;
        if (uiStatus === "rejected") summary.rejected += 1;
        return summary;
      },
      { draft: 0, pending: 0, active: 0, rejected: 0 },
    );
  }

  function renderSummary() {
    const counts = getCounts();
    document.querySelector('[data-count="draft"]').textContent = counts.draft;
    document.querySelector('[data-count="pending"]').textContent = counts.pending;
    document.querySelector('[data-count="active"]').textContent = counts.active;
    document.querySelector('[data-count="rejected"]').textContent = counts.rejected;

    document.querySelector("#draftNote").textContent =
      counts.draft === 1 ? "1 permit not submitted" : `${counts.draft} permits not submitted`;
    document.querySelector("#pendingNote").textContent =
      counts.pending === 1
        ? "1 permit awaiting approval"
        : `${counts.pending} permits awaiting approval`;
    document.querySelector("#activeNote").textContent =
      counts.active === 1 ? "1 approved or active job" : `${counts.active} approved or active jobs`;
    document.querySelector("#rejectedNote").textContent =
      counts.rejected === 1 ? "1 permit needs revision" : `${counts.rejected} permits need revision`;
  }

  function getFilteredPermits() {
    const query = state.query.trim().toLowerCase();

    return state.permits.filter((permit) => {
      const uiStatus = toUiStatus(permit.status);
      const matchesFilter = state.activeFilter === "all" || uiStatus === state.activeFilter;
      const matchesQuery = [
        permit.id,
        getDisplayPermitId(permit),
        permit.title,
        permit.workType,
        permit.location,
        formatStatus(permit.status),
        permit.isEmergency ? "emergency safety officer" : "normal admin reviewer",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

      return matchesFilter && matchesQuery;
    });
  }

  function renderTable() {
    if (state.activeView === "workers") {
      renderWorkerProfiles();
      return;
    }

    elements.table?.classList.remove("worker-table");
    renderPermitToolbar();
    renderPermitTableHead();
    const rows = getFilteredPermits();
    elements.recentRequestsTitle.textContent =
      state.activeView === "permits" ? "My Permit Register" : "Recent Permit Requests";

    if (!rows.length) {
      elements.tableBody.innerHTML = `
        <tr>
          <td class="empty-row" colspan="5">No permit requests match the current filters.</td>
        </tr>
      `;
      return;
    }

    elements.tableBody.innerHTML = rows.map(renderPermitRow).join("");
  }

  function renderPermitToolbar() {
    elements.tableToolbar.innerHTML = `
      <button class="filter-button" type="button" data-status-filter="all">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M7 12h10M10 18h4" />
        </svg>
        All statuses
      </button>
      <button class="filter-button" type="button" data-status-filter="pending">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l3 2" />
        </svg>
        Pending
      </button>
      <button class="filter-button" type="button" data-status-filter="draft">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Drafts
      </button>
      <button class="filter-button" type="button" data-status-filter="active">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m20 6-11 11-5-5" />
        </svg>
        Active
      </button>
      <button class="filter-button" type="button" data-status-filter="rejected">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 9-6 6M9 9l6 6" />
        </svg>
        Rejected
      </button>
    `;
  }

  function renderPermitTableHead() {
    elements.tableHead.innerHTML = `
      <tr>
        <th>Permit ID</th>
        <th>Work Type</th>
        <th>Location</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    `;
  }

  function renderPermitRow(permit) {
    const uiStatus = toUiStatus(permit.status);
    const displayType = permit.isEmergency ? "Emergency Permit" : permit.workType;
    const icon = typeIcons[displayType] || typeIcons["Preventive Maintenance"];
    const displayId = getDisplayPermitId(permit);

    return `
      <tr>
        <td><span class="permit-id">${escapeHtml(displayId)}</span></td>
        <td>
          <span class="work-type">
            <span class="type-mark">
              <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>
            </span>
            ${escapeHtml(displayType)}
          </span>
        </td>
        <td><span class="location">${escapeHtml(permit.location)}</span></td>
        <td><span class="status-pill ${escapeHtml(uiStatus)}">${escapeHtml(formatStatus(permit.status))}</span></td>
        <td><div class="row-actions">${renderRowActions(permit)}</div></td>
      </tr>
    `;
  }

  function renderWorkerProfiles() {
    const query = state.query.trim().toLowerCase();
    elements.table?.classList.add("worker-table");
    elements.recentRequestsTitle.textContent = "Worker Profiles";
    elements.tableToolbar.innerHTML = "";
    elements.tableHead.innerHTML = `
      <tr>
        <th>Worker</th>
        <th>Position / Company</th>
        <th>Permit Types</th>
        <th>Status</th>
      </tr>
    `;

    const rows = state.workers.filter((worker) =>
      [
        worker.name,
        worker.employeeId,
        worker.icPassport,
        worker.role,
        worker.company,
        worker.phone,
        worker.email,
        workerStatusLabel(worker.status),
        worker.reviewComment,
        ...(worker.permits || []),
        ...normalizeWorkerCertifications(worker.certifications).flatMap((certification) => [
          certification.type,
          certification.number,
          certification.issuer,
          certification.expiryDate,
          certification.fileName,
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );

    if (!rows.length) {
      elements.tableBody.innerHTML = `
        <tr>
          <td class="empty-row" colspan="4">No worker profiles match the current search.</td>
        </tr>
      `;
      return;
    }

    elements.tableBody.innerHTML = rows.map(renderWorkerRow).join("");
  }

  function renderWorkerRow(worker) {
    const permits = (worker.permits || worker.qualifications || [])
      .map((permit) => `<span class="permit-chip">${escapeHtml(permit)}</span>`)
      .join(" ");
    const certifications = normalizeWorkerCertifications(worker.certifications);
    const certSummary = certifications.length
      ? certifications
          .map((certification) => {
            const expiry = certification.expiryDate ? ` exp ${certification.expiryDate}` : "";
            return `
              <div class="worker-cert-card">
                <div>
                  <span class="worker-cert-title">${escapeHtml(`${certification.type || "Certification"}${expiry}`)}</span>
                  ${certification.fileName ? `<span class="worker-cert-file">${escapeHtml(certification.fileName)}</span>` : ""}
                </div>
                ${workerCertificationDownloadButton(worker.systemId || worker.id, certification)}
              </div>
            `;
          })
          .join("")
      : "No certifications";
    const status = String(worker.status || "submitted").toLowerCase();
    const returnReason =
      status === "rejected" && worker.reviewComment
        ? `
          <span class="worker-return-note">
            <strong>Return reason</strong>
            ${escapeHtml(worker.reviewComment)}
          </span>
        `
        : "";

    return `
      <tr class="worker-row">
        <td>
          <div class="worker-cell">
            <div class="worker-name-line">
              <span class="worker-avatar">${escapeHtml(initials(worker.name || worker.email || "W"))}</span>
              <div>
                <span class="worker-name">${escapeHtml(worker.name || "-")}</span>
                <div class="worker-subline">${escapeHtml(worker.email || "-")}</div>
              </div>
            </div>
            <div class="worker-meta-grid">
              <span class="worker-meta">ID: ${escapeHtml(worker.employeeId || "-")}</span>
              <span class="worker-meta">IC: ${escapeHtml(worker.icPassport || "-")}</span>
              <span class="worker-meta">${escapeHtml(worker.phone || "-")}</span>
            </div>
          </div>
        </td>
        <td>
          <div class="worker-cell">
            <div>
              <span class="worker-role">${escapeHtml(worker.role || "-")}</span>
              <div class="worker-company">${escapeHtml(worker.company || "-")}</div>
            </div>
            <div class="worker-cert-list">${certSummary === "No certifications" ? '<span class="worker-meta">No certifications</span>' : certSummary}</div>
          </div>
        </td>
        <td><div class="permit-chip-list">${permits || '<span class="worker-meta">No permit types</span>'}</div></td>
        <td>
          <span class="status-pill ${status === "valid" ? "active" : status === "rejected" ? "rejected" : "pending"}">${escapeHtml(workerStatusLabel(worker.status))}</span>
          ${returnReason}
        </td>
      </tr>
    `;
  }

  function renderRowActions(permit) {
    const uiStatus = toUiStatus(permit.status);
    const id = escapeHtml(permit.id);
    const viewButton = rowButton("view", id, "View");

    if (uiStatus === "draft") {
      if (!permit.isEmergency) {
        return `${rowButton("edit", id, "Edit")}${viewButton}${rowButton("cancel", id, "Cancel", "danger")}<span class="route-note">Admin review</span>`;
      }

      return `${rowButton("edit", id, "Edit")}${rowButton("submit", id, "Submit", "primary")}${rowButton("cancel", id, "Cancel", "danger")}`;
    }

    if (uiStatus === "pending") {
      return `${viewButton}${rowButton("nudge", id, "Nudge")}${rowButton("cancel", id, "Cancel", "danger")}`;
    }

    if (uiStatus === "active") {
      const closeButton = permit.status === "active" ? rowButton("close", id, "Close") : "";
      return `${rowButton("monitor", id, "Monitor", "primary")}${closeButton}`;
    }

    if (uiStatus === "rejected") {
      return `${rowButton("revise", id, "Revise", "primary")}${viewButton}${rowButton("cancel", id, "Cancel", "danger")}`;
    }

    return viewButton;
  }

  function rowButton(operation, id, label, tone = "") {
    return `
      <button class="row-button ${tone}" type="button" data-operation="${operation}" data-id="${id}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
        ${escapeHtml(label)}
      </button>
    `;
  }

  function renderFilters() {
    document.querySelectorAll("[data-status-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.statusFilter === state.activeFilter);
    });
  }

  function renderNav() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === state.activeView);
    });
  }

  function renderWorkerOptions(selectedWorkerIds = []) {
    const permitTypes = getSelectedPermitTypes();
    const selected = new Set(selectedWorkerIds);

    elements.workerOptions.innerHTML = state.workers
      .map((worker) => {
        const competent = isWorkerCompetent(worker, permitTypes);
        const checked = selected.has(worker.id) && competent ? "checked" : "";
        const disabled = competent ? "" : "disabled";
        const stateClass = competent ? "" : "is-disabled";
        const matched = getWorkerMatchedPermitTypes(worker, permitTypes);
        const missing = permitTypes.filter((permitType) =>
          !matched.some((match) => qualificationKey(match) === qualificationKey(permitType)),
        );
        let note = permitTypes.length
          ? `Eligible for ${permitTypes.join(", ")}`
          : "Select permit type to verify competency";

        if (!competent && worker.status === "inactive") {
          note = "Inactive - cannot be assigned";
        } else if (!competent && worker.status !== "valid") {
          note = `${workerStatusLabel(worker.status)} - cannot be assigned`;
        } else if (!competent) {
          note = missing.length ? `Missing permit type: ${missing.join(", ")}` : "Not eligible for selected permit type";
        }

        return `
          <label class="worker-option ${stateClass}">
            <input name="assignedWorkers" type="checkbox" value="${escapeHtml(worker.id)}" ${checked} ${disabled} />
            <span>
              <strong>${escapeHtml(worker.name)}</strong>
              <span>${escapeHtml(worker.role)}</span>
              <small>${escapeHtml(note)}</small>
            </span>
          </label>
        `;
      })
      .join("");
  }

  async function getSelectedDocument(form, inputName, type, existingDocuments = []) {
    const file = form.elements[inputName]?.files?.[0];
    const existing = (existingDocuments || []).find((document) => document.type === type);
    const existingName = existing?.name || "";
    const name = file?.name || existingName || "";

    if (!name) return null;

    if (file) {
      if (file.size > MAX_PERMIT_DOCUMENT_BYTES) {
        throw {
          error: `${file.name} is too large. Permit document files must be 5 MB or smaller.`,
        };
      }

      return {
        id: existing?.id || "",
        type,
        name,
        fileName: file.name,
        mimeType: file.type || "",
        attachmentData: await readFileAsBase64(file),
        hasAttachment: true,
      };
    }

    return {
      id: existing?.id || "",
      type,
      name,
      fileName: existing?.fileName || existingName,
      mimeType: existing?.mimeType || "",
      hasAttachment: Boolean(existing?.hasAttachment),
      ...(existing?.structuredData ? { structuredData: normalizeStructuredData(existing.structuredData) } : {}),
      ...(existing?.source ? { source: existing.source } : {}),
      ...(existing?.templateVersion ? { templateVersion: existing.templateVersion } : {}),
    };
  }

  function getStructuredDocuments(documents = []) {
    return normalizeDocuments(documents)
      .filter((document) => isStructuredDocumentType(document.type) && Object.keys(normalizeStructuredData(document.structuredData)).length)
      .map((document) => ({
        ...document,
        name: document.name || `${document.type} digital form`,
        hasAttachment: Boolean(document.hasAttachment),
      }));
  }

  function upsertStructuredDocuments(documents = []) {
    const byType = new Map(state.structuredDocuments.map((document) => [document.type, document]));
    getStructuredDocuments(documents).forEach((document) => {
      byType.set(document.type, document);
    });
    state.structuredDocuments = Array.from(byType.values());
  }

  function getStructuredDocument(type) {
    return state.structuredDocuments.find((document) => document.type === type) || null;
  }

  function buildStructuredDocument(type, structuredData = {}) {
    return {
      type,
      name: `${type} digital form`,
      source: "mos-jsa-digital-form",
      structuredData: normalizeStructuredData(structuredData),
    };
  }

  function readDigitalDocumentEditor() {
    if (!elements.digitalDocumentEditor) return [];

    return Object.keys(digitalDocumentSchemas)
      .map((type) => {
        const structuredData = {};
        elements.digitalDocumentEditor
          .querySelectorAll(`[data-digital-doc-type="${type}"]`)
          .forEach((field) => {
            const key = field.dataset.digitalDocField;
            const value = String(field.value || "").trim();
            if (key && value) structuredData[key] = value;
          });

        return buildStructuredDocument(type, structuredData);
      })
      .filter((document) => Object.keys(document.structuredData).length);
  }

  function syncStructuredDocumentsFromEditor() {
    const editedDocuments = readDigitalDocumentEditor();
    const byType = new Map(state.structuredDocuments.map((document) => [document.type, document]));

    Object.keys(digitalDocumentSchemas).forEach((type) => byType.delete(type));
    editedDocuments.forEach((document) => byType.set(document.type, document));
    state.structuredDocuments = Array.from(byType.values());
    return editedDocuments;
  }

  function renderDigitalDocumentEditor(existingDocuments = []) {
    if (!elements.digitalDocumentEditor) return;

    const existingStructured = getStructuredDocuments(existingDocuments);
    elements.digitalDocumentEditor.innerHTML = Object.entries(digitalDocumentSchemas)
      .map(([type, schema]) => {
        const document = getStructuredDocument(type) || existingStructured.find((item) => item.type === type) || {};
        const data = normalizeStructuredData(document.structuredData);

        return `
          <section class="digital-document-form">
            <h4>${escapeHtml(schema.title)}</h4>
            <div class="digital-document-fields">
              ${schema.fields
                .map((field) => {
                  const value = data[field.key] || "";
                  const control =
                    field.input === "textarea"
                      ? `<textarea data-digital-doc-type="${escapeHtml(type)}" data-digital-doc-field="${escapeHtml(field.key)}" placeholder="${escapeHtml(field.help)}">${escapeHtml(value)}</textarea>`
                      : `<input data-digital-doc-type="${escapeHtml(type)}" data-digital-doc-field="${escapeHtml(field.key)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.help)}" />`;
                  return `
                    <label class="digital-document-field ${field.input === "textarea" ? "is-wide" : ""}">
                      <span>${escapeHtml(field.label)}</span>
                      ${control}
                      <small>${escapeHtml(field.help)}</small>
                    </label>
                  `;
                })
                .join("")}
            </div>
          </section>
        `;
      })
      .join("");
  }

  function renderDigitalDocumentStatus(existingDocuments = []) {
    if (!elements.digitalDocumentStatus) return;

    const existingStructured = getStructuredDocuments(existingDocuments);
    const types = ["MOS", "JSA"];

    elements.digitalDocumentStatus.innerHTML = types
      .map((type) => {
        const imported = getStructuredDocument(type) || existingStructured.find((document) => document.type === type);
        const ready = Boolean(imported && Object.keys(normalizeStructuredData(imported.structuredData)).length);
        return `
          <span class="${ready ? "is-ready" : ""}">
            <strong>${escapeHtml(type)}</strong>
            ${ready ? "Digital form ready" : "Fill online or import Excel"}
          </span>
        `;
      })
      .join("");
  }

  async function downloadMosJsaTemplate() {
    try {
      syncStructuredDocumentsFromEditor();
      const response = await fetch(`${API_BASE}/api/permit-document-templates/mos-jsa/export`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${state.session?.token || OFFLINE_TOKEN}`,
        },
        body: JSON.stringify({ documents: state.structuredDocuments }),
      });

      if (!response.ok) throw new Error("Template download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "MOS-JSA-digital-form-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast("Unable to download MOS/JSA Excel template.");
    }
  }

  function permitExportFileName(permit) {
    const label = String(getDisplayPermitId(permit) || permit?.id || permit?.title || "permit")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-");
    return `${label || "permit"}-MOS-JSA.xlsx`;
  }

  async function downloadPermitMosJsaExcel(permit) {
    const documents = getStructuredDocuments(permit?.documents || []);

    if (!documents.length) {
      throw new Error("No MOS/JSA digital form data available for export.");
    }

    const response = await fetch(`${API_BASE}/api/permit-document-templates/mos-jsa/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${state.session?.token || OFFLINE_TOKEN}`,
      },
      body: JSON.stringify({ documents }),
    });

    if (!response.ok) {
      let message = "Unable to export MOS/JSA Excel.";
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {
        // Ignore non-JSON response bodies.
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = permitExportFileName(permit);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importMosJsaTemplate(file) {
    if (!file) return;

    try {
      if (!/\.xlsx$/i.test(file.name)) {
        showToast("Upload the completed MOS/JSA .xlsx template.");
        return;
      }

      if (file.size > MAX_PERMIT_DOCUMENT_BYTES) {
        showToast("MOS/JSA Excel template must be 5 MB or smaller.");
        return;
      }

      const attachmentData = await readFileAsBase64(file);
      const result = await apiRequest("/api/permit-document-templates/mos-jsa/import", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          attachmentData,
        }),
      });

      upsertStructuredDocuments(result.documents || []);
      const existingPermit = state.editingId ? findPermit(state.editingId) : null;
      renderDigitalDocumentEditor(existingPermit?.documents || []);
      renderDigitalDocumentStatus(existingPermit?.documents || []);
      updateDocumentStatuses(existingPermit?.documents || []);
      showToast("MOS/JSA Excel form imported.");
    } catch (error) {
      showToast(error.error || "Unable to import MOS/JSA Excel template.");
    } finally {
      if (elements.importMosJsaTemplateInput) {
        elements.importMosJsaTemplateInput.value = "";
      }
    }
  }

  function getDocumentRequirements(workType, isEmergency = state.isEmergencyPermit) {
    return [
      ...(isEmergency ? emergencyDocumentRequirements : []),
      ...(permitDocumentRequirements[workType] || []),
    ];
  }

  function getRequiredDocumentTypes(workType, isEmergency = state.isEmergencyPermit) {
    return [
      ...digitalDocumentRequirements,
      ...getDocumentRequirements(workType, isEmergency),
    ];
  }

  function syncEmergencyPermitControls() {
    const emergencyOption = elements.permitForm.querySelector("[data-emergency-hazard-option]");
    const emergencyInput = emergencyOption?.querySelector('input[name="hazards"]');

    if (!emergencyOption) return;

    emergencyOption.hidden = !state.isEmergencyPermit;
    emergencyOption.style.display = state.isEmergencyPermit ? "" : "none";
    emergencyOption.classList.toggle("is-locked", state.isEmergencyPermit);
    emergencyOption.setAttribute("aria-disabled", state.isEmergencyPermit ? "true" : "false");

    if (emergencyInput) {
      emergencyInput.checked = state.isEmergencyPermit;
      emergencyInput.disabled = state.isEmergencyPermit;
    }
  }

  async function readRequiredDocuments(form, existingDocuments = []) {
    syncStructuredDocumentsFromEditor();
    const workType = form.elements.workType.value || "Preventive Maintenance";
    const digitalDocuments = digitalDocumentRequirements
      .map((requirement) => {
        const structured = getStructuredDocument(requirement.type);
        if (!structured) return null;
        return {
          ...structured,
          type: requirement.type,
          name: structured.name || `${requirement.type} digital form`,
          structuredData: normalizeStructuredData(structured.structuredData),
        };
      })
      .filter(Boolean);
    const uploadedDocuments = await Promise.all(
      getDocumentRequirements(workType).map((requirement) => {
        const file = form.elements[requirement.inputName]?.files?.[0];
        if (!file && isStructuredDocumentType(requirement.type)) return null;
        return getSelectedDocument(form, requirement.inputName, requirement.type, existingDocuments);
      }),
    );

    return [...digitalDocuments, ...uploadedDocuments.filter(Boolean)];
  }

  function hasRequiredDocuments(documents, workType) {
    return getRequiredDocumentTypes(workType).every((requirement) =>
      Boolean(getDocumentName(documents, requirement.type)),
    );
  }

  function renderDocumentUploads(existingDocuments = []) {
    const workType = elements.permitForm.elements.workType.value || "Preventive Maintenance";
    const requirements = getDocumentRequirements(workType);

    elements.documentGrid.innerHTML = requirements
      .map(
        (requirement) => `
          <label class="document-upload">
            <span>${escapeHtml(requirement.label)}</span>
            <input
              name="${escapeHtml(requirement.inputName)}"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              data-document-type="${escapeHtml(requirement.type)}"
            />
            <small data-document-status="${escapeHtml(requirement.type)}">Required for MOS Approval</small>
          </label>
        `,
      )
      .join("");

    requirements.forEach((requirement) => {
      elements.permitForm.elements[requirement.inputName]?.addEventListener("change", () => {
        const existingPermit = state.editingId ? findPermit(state.editingId) : null;
        updateDocumentStatuses(existingPermit?.documents || existingDocuments);
      });
    });

    renderDigitalDocumentEditor(existingDocuments);
    updateDocumentStatuses(existingDocuments);
    renderDigitalDocumentStatus(existingDocuments);
  }

  function updateDocumentStatuses(existingDocuments = []) {
    getDocumentRequirements(elements.permitForm.elements.workType.value || "Preventive Maintenance").forEach(
      (requirement) => {
        const file = elements.permitForm.elements[requirement.inputName]?.files?.[0];
        const structured = isStructuredDocumentType(requirement.type) ? getStructuredDocument(requirement.type) : null;
        const name = file?.name || structured?.name || getDocumentName(existingDocuments, requirement.type);
        const status = elements.documentGrid.querySelector(
          `[data-document-status="${requirement.type}"]`,
        );

        if (status) {
          status.textContent = structured && !file
            ? `Digital form: ${structured.name}`
            : name
              ? `Selected: ${name}`
              : "Required for MOS Approval";
        }
      },
    );
    renderDigitalDocumentStatus(existingDocuments);
  }

  function setApproverOptions(mode, selectedValue = "") {
    const options = approverOptions[mode] || approverOptions.normal;
    const approverSelect = elements.permitForm.elements.approvers;
    if (!approverSelect) return;
    const placeholder = mode === "emergency" ? "Safety officer" : "Admin reviewer";

    approverSelect.innerHTML = [
      `<option value="">${placeholder}</option>`,
      ...options.map(
        (option) =>
          `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`,
      ),
    ].join("");
    approverSelect.value = selectedValue || options[0]?.value || "";
  }

  function render() {
    renderSummary();
    renderNav();
    renderTable();
    renderFilters();
    renderNotifications();
  }

  function setSubmitButtonLabel(label) {
    if (!elements.submitPermitButton) return;
    const labelNode = elements.submitPermitButton.querySelector('[data-submit-label]');
    if (labelNode) {
      labelNode.textContent = label;
    } else {
      elements.submitPermitButton.lastChild.textContent = label;
    }
  }

  function setPermitDialogEmergencyMode(isEmergency) {
    elements.permitDialog.classList.toggle("is-emergency", Boolean(isEmergency));
  }

  async function openCreatePermit() {
    state.editingId = null;
    state.isEmergencyPermit = false;
    state.structuredDocuments = [];
    setPermitDialogEmergencyMode(false);
    elements.permitDialogTitle.textContent = "Create Permit Request";
    elements.permitDialogSubtitle.textContent = "Save the permit package for Admin Lane 2 draft review.";
    setSubmitButtonLabel("Send to Admin Review");
    elements.permitForm.reset();
    elements.permitForm.elements.id.value = "";
    elements.permitForm.elements.startDateTime.value = toLocalInputValue(null, 1);
    elements.permitForm.elements.endDateTime.value = toLocalInputValue(null, 5);
    setApproverOptions("normal");
    syncEmergencyPermitControls();
    await refreshWorkersFromServer().catch(() => {});
    renderWorkerOptions([]);
    renderDocumentUploads();
    elements.permitDialog.showModal();
  }

  async function openEmergencyPermit() {
    const start = new Date();
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    state.editingId = null;
    state.structuredDocuments = [];
    elements.permitDialogTitle.textContent = "Emergency Permit Request";
    setPermitDialogEmergencyMode(true);
    elements.permitDialogSubtitle.textContent =
      "Submit urgent work directly to Safety Officer emergency review. MOS and JSA are still required for submission.";
    setSubmitButtonLabel("Submit to Safety Officer");

    const form = elements.permitForm;
    form.reset();
    form.elements.id.value = "";
    form.elements.title.value = "Emergency Permit Request";
    form.elements.workType.value = "Preventive Maintenance";
    form.elements.location.value = "";
    form.elements.startDateTime.value = toLocalInputValue(start);
    form.elements.endDateTime.value = toLocalInputValue(end);
    form.elements.description.value =
      "Emergency work request. Confirm immediate controls, isolations, and safety officer authorization before work starts.";
    form.elements.controls.value = [
      "Area secured before work starts",
      "Safety officer notified",
      "Stop work authority confirmed",
    ].join("\n");
    form.querySelectorAll('[name="ppe"]').forEach((checkbox) => {
      checkbox.checked = false;
    });
    state.isEmergencyPermit = true;
    setApproverOptions("emergency", "Sarah Safety");
    syncEmergencyPermitControls();
    await refreshWorkersFromServer().catch(() => {});
    form.querySelectorAll('[name="hazards"]').forEach((checkbox) => {
      checkbox.checked = checkbox.value === "Emergency";
      checkbox.disabled = checkbox.value === "Emergency";
    });
    renderWorkerOptions([]);
    renderDocumentUploads();
    elements.permitDialog.showModal();
  }

  async function openEditPermit(id, isRevision = false) {
    const permit = findPermit(id);
    if (!permit) {
      showToast("Permit not found.");
      return;
    }

    state.editingId = permit.id;
    state.structuredDocuments = getStructuredDocuments(permit.documents || []);
    elements.permitDialogTitle.textContent = isRevision ? "Revise Rejected Permit" : "Edit Draft Permit";
    elements.permitDialogSubtitle.textContent = isRevision
      ? permit.isEmergency
        ? "Update the returned emergency request before Safety Officer resubmission."
        : "Update the returned request. Admin Lane 2 must re-submit it after correction."
      : permit.isEmergency
        ? "Update emergency draft details before Safety Officer submission."
        : "Update draft details for Admin Lane 2 review.";
    setSubmitButtonLabel(permit.isEmergency ? "Submit to Safety Officer" : "Send to Admin Review");

    const form = elements.permitForm;
    form.reset();
    form.elements.id.value = permit.id;
    form.elements.title.value = permit.title || "";
    form.elements.workType.value = permit.workType || "Preventive Maintenance";
    form.elements.location.value = permit.location || "";
    form.elements.startDateTime.value = toLocalInputValue(permit.startDateTime);
    form.elements.endDateTime.value = toLocalInputValue(permit.endDateTime);
    form.elements.description.value = extractScope(permit.description);
    form.elements.controls.value = (permit.controls || []).join("\n");
    state.isEmergencyPermit = Boolean(permit.isEmergency);
    setPermitDialogEmergencyMode(state.isEmergencyPermit);
    syncEmergencyPermitControls();
    const selectedPpe = (permit.ppe || []).map((item) => String(item).toLowerCase());
    form.querySelectorAll('[name="ppe"]').forEach((checkbox) => {
      const optionText = checkbox.closest("label")?.textContent?.toLowerCase() || "";
      checkbox.checked = selectedPpe.some((item) =>
        item === String(checkbox.value).toLowerCase() || optionText.includes(item),
      );
    });
    setApproverOptions(
      state.isEmergencyPermit ? "emergency" : "normal",
      state.isEmergencyPermit ? "Sarah Safety" : permit.approvers?.[0],
    );
    await refreshWorkersFromServer().catch(() => {});
    form.querySelectorAll('[name="hazards"]').forEach((checkbox) => {
      checkbox.checked =
        checkbox.value === "Emergency"
          ? state.isEmergencyPermit
          : (permit.hazards || []).includes(checkbox.value);
      if (checkbox.value === "Emergency") {
        checkbox.disabled = state.isEmergencyPermit;
      }
    });
    renderWorkerOptions(permit.assignedWorkers || []);
    renderDocumentUploads(permit.documents || []);

    elements.permitDialog.showModal();
  }

  function renderWorkerRoleOptions(selectedRole = "") {
    if (!elements.workerRoleSelect) return;

    const normalized = String(selectedRole || "").trim();
    const roles = normalized && !workerRoleOptions.includes(normalized)
      ? [...workerRoleOptions, normalized]
      : workerRoleOptions;

    elements.workerRoleSelect.innerHTML = [
      '<option value="">Select position</option>',
      ...roles.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`),
    ].join("");
    elements.workerRoleSelect.value = normalized;
  }

  function renderWorkerPermitPicker(selectedPermits = []) {
    if (!elements.workerPermitTypes) return;

    const selected = new Set((selectedPermits || []).map(normalizeQualification));
    elements.workerPermitTypes.innerHTML = workerPermitTypes
      .map(
        (permitType) => `
          <label><input name="workerPermits" type="checkbox" value="${escapeHtml(permitType)}" ${selected.has(permitType) ? "checked" : ""} /> ${escapeHtml(permitType)}</label>
        `,
      )
      .join("");
  }

  function workerCertificationRowTemplate(certification = {}) {
    const normalized = {
      id: "",
      type: "",
      number: "",
      issuer: "",
      issueDate: "",
      expiryDate: "",
      fileName: "",
      mimeType: "",
      hasAttachment: false,
      ...certification,
    };
    const types = normalized.type && !certificationTypeOptions.includes(normalized.type)
      ? [...certificationTypeOptions, normalized.type]
      : certificationTypeOptions;
    const typeOptions = [
      '<option value="">Select type</option>',
      ...types.map((type) => `<option value="${escapeHtml(type)}" ${normalized.type === type ? "selected" : ""}>${escapeHtml(type)}</option>`),
    ].join("");

    return `
      <div class="certification-row" data-cert-id="${escapeHtml(normalized.id)}" data-cert-file-name="${escapeHtml(normalized.fileName)}" data-cert-has-attachment="${normalized.hasAttachment ? "true" : "false"}">
        <div class="certification-field certification-field--type">
          <label>Type</label>
          <select data-cert-field="type">${typeOptions}</select>
        </div>
        <div class="certification-field certification-field--number">
          <label>Certificate No.</label>
          <input data-cert-field="number" value="${escapeHtml(normalized.number)}" placeholder="CERT-001" />
        </div>
        <div class="certification-field certification-field--issuer">
          <label>Issuer</label>
          <input data-cert-field="issuer" value="${escapeHtml(normalized.issuer)}" placeholder="NIOSH / DOSH" />
        </div>
        <div class="certification-field certification-field--issue">
          <label>Issue Date</label>
          <input data-cert-field="issueDate" type="date" value="${escapeHtml(normalized.issueDate)}" />
        </div>
        <div class="certification-field certification-field--expiry">
          <label>Expiry Date</label>
          <input data-cert-field="expiryDate" type="date" value="${escapeHtml(normalized.expiryDate)}" />
        </div>
        <div class="certification-field certification-field--file">
          <span class="certification-label">Certificate File</span>
          <label class="certification-file-picker">
            <input data-cert-field="file" type="file" accept=".pdf,.jpg,.jpeg,.png" />
            <span>Choose File</span>
            <small>${escapeHtml(normalized.fileName || "No file selected")}</small>
          </label>
          <div class="certification-file-actions">
            ${workerCertificationDownloadButton(state.editingWorkerId || elements.workerForm?.elements?.id?.value, normalized, "Download current file")}
          </div>
        </div>
        <button class="dialog-button certification-remove-button" type="button" data-worker-cert-remove>Remove</button>
      </div>
    `;
  }

  function renderWorkerCertificationEditor(certifications = []) {
    if (!elements.workerCertificationList) return;

    const rows = normalizeWorkerCertifications(certifications);
    if (!rows.length) {
      rows.push({ type: "", number: "", issuer: "", issueDate: "", expiryDate: "", fileName: "" });
    }

    elements.workerCertificationList.innerHTML = rows
      .map((certification) => workerCertificationRowTemplate(certification))
      .join("");
  }

  function addWorkerCertificationRow(certification = {}) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = workerCertificationRowTemplate(certification).trim();
    elements.workerCertificationList.append(wrapper.firstElementChild);
  }

  async function readWorkerCertifications() {
    const rows = Array.from(elements.workerCertificationList?.querySelectorAll(".certification-row") || []);
    const certifications = await Promise.all(
      rows.map(async (row) => {
        const file = row.querySelector('[data-cert-field="file"]')?.files?.[0];
        return {
          id: row.dataset.certId || "",
          type: row.querySelector('[data-cert-field="type"]')?.value || "",
          number: row.querySelector('[data-cert-field="number"]')?.value || "",
          issuer: row.querySelector('[data-cert-field="issuer"]')?.value || "",
          issueDate: row.querySelector('[data-cert-field="issueDate"]')?.value || "",
          expiryDate: row.querySelector('[data-cert-field="expiryDate"]')?.value || "",
          fileName: file?.name || row.dataset.certFileName || "",
          mimeType: file?.type || "",
          attachmentData: file ? await readFileAsBase64(file) : "",
          hasAttachment: file ? true : row.dataset.certHasAttachment === "true",
        };
      }),
    );

    return normalizeWorkerCertifications(certifications);
  }

  function findWorker(id) {
    return state.workers.find((worker) => String(worker.systemId || worker.id) === String(id));
  }

  function openCreateWorkerProfile() {
    state.editingWorkerId = null;
    elements.workerDialogTitle.textContent = "Add Worker";
    elements.workerDialogSubtitle.textContent = "Use the exact name and email from the worker's registered account.";
    elements.workerForm.reset();
    elements.workerForm.elements.id.value = "";
    renderWorkerRoleOptions();
    renderWorkerPermitPicker([]);
    renderWorkerCertificationEditor();
    elements.workerDialog.showModal();
  }

  function openEditWorkerProfile(id) {
    const worker = findWorker(id);
    if (!worker) {
      showToast("Worker profile not found.");
      return;
    }

    state.editingWorkerId = worker.systemId || worker.id;
    elements.workerDialogTitle.textContent =
      String(worker.status || "").toLowerCase() === "rejected"
        ? "Revise Returned Worker Profile"
        : "Edit Worker Profile";
    elements.workerDialogSubtitle.textContent = worker.reviewComment
      ? `Return reason: ${worker.reviewComment}`
      : "Name and email must still match the registered worker account.";

    const form = elements.workerForm;
    form.reset();
    form.elements.id.value = state.editingWorkerId;
    form.elements.name.value = worker.name || "";
    form.elements.icPassport.value = worker.icPassport || "";
    form.elements.employeeId.value = worker.employeeId || "";
    form.elements.phone.value = worker.phone || "";
    form.elements.email.value = worker.email || "";
    form.elements.company.value = worker.company || "";
    renderWorkerRoleOptions(worker.role || "");
    renderWorkerPermitPicker(worker.permits || worker.qualifications || []);
    renderWorkerCertificationEditor(worker.certifications || []);
    elements.workerDialog.showModal();
  }

  async function readWorkerProfileForm() {
    const form = elements.workerForm;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const icPassport = String(formData.get("icPassport") || "").trim();

    if (!name || !icPassport) {
      showToast("Worker name and IC/Passport are required.");
      return null;
    }

    return {
      name,
      icPassport,
      employeeId: String(formData.get("employeeId") || "").trim() || undefined,
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      company: String(formData.get("company") || "").trim(),
      role: String(formData.get("role") || "").trim(),
      permits: formData.getAll("workerPermits").map(String),
      certifications: await readWorkerCertifications(),
    };
  }

  async function saveWorkerProfile() {
    try {
      const payload = await readWorkerProfileForm();
      if (!payload) return;
      const workerId = elements.workerForm.elements.id.value;
      if (!workerId) {
        showToast("Only Admin can add worker profiles.");
        return;
      }

      if (state.mode === "online") {
        if (workerId) {
          await apiRequest(`/api/workers/${encodeURIComponent(workerId)}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        } else {
          await apiRequest("/api/workers", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
        await loadOnlineData();
      } else {
        const localId = elements.workerForm.elements.id.value || `local-worker-${Date.now()}`;
        const localWorker = normalizeWorkerRecord({
          id: localId,
          systemId: localId,
          ...payload,
          certifications: normalizeWorkerCertifications(payload.certifications),
          status: "submitted",
          qualifications: payload.permits,
        });
        state.workers = [
          localWorker,
          ...state.workers.filter((worker) => String(worker.systemId || worker.id) !== String(localId)),
        ];
        writeJsonStorage(STORAGE_KEYS.workers, state.workers);
      }

      elements.workerDialog.close();
      state.activeView = "workers";
      render();
        showToast("Worker profile sent to Admin review.");
    } catch (error) {
      showToast(error.error || "Unable to save worker profile.");
    }
  }

  async function readPermitForm(shouldSubmit) {
    const form = elements.permitForm;
    const formData = new FormData(form);
    const existingPermit = state.editingId ? findPermit(state.editingId) : null;
    const workType = String(formData.get("workType") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const startDateTime = String(formData.get("startDateTime") || "").trim();
    const endDateTime = String(formData.get("endDateTime") || "").trim();
    const isEmergency = Boolean(state.isEmergencyPermit);
    const hazards = formData
      .getAll("hazards")
      .map(String)
      .filter((hazard) => isEmergency || hazard !== "Emergency");
    const permitTypes = hazards
      .filter((hazard) => hazard !== "Emergency")
      .map(normalizeQualification)
      .filter((hazard, index, list) =>
        list.findIndex((item) => qualificationKey(item) === qualificationKey(hazard)) === index,
      );
    const approvers = isEmergency ? ["Sarah Safety"] : ["PTW Admin"];
    const documents = await readRequiredDocuments(form, existingPermit?.documents || []);
    const assignedWorkers = formData
      .getAll("assignedWorkers")
      .map(String)
      .filter((workerId) => {
        const worker = getWorkerById(workerId);
        return worker && isWorkerCompetent(worker, permitTypes);
      });

    if (!title || !workType || !location || !description || !startDateTime || !endDateTime) {
      showToast("Complete title, work type, location, scope, start time, and end time.");
      return null;
    }

    if (shouldSubmit && !assignedWorkers.length) {
      showToast("Assign at least one competent worker for the selected permit type.");
      return null;
    }

    if (shouldSubmit && !hasRequiredDocuments(documents, workType)) {
      showToast(`Complete MOS/JSA digital forms and required supporting attachments for ${workType}.`);
      return null;
    }

    if (new Date(endDateTime) <= new Date(startDateTime)) {
      showToast("End time must be after start time.");
      return null;
    }

    const assignedWorkerIdentifiers = buildAssignedWorkerIdentifiers(assignedWorkers);

    return {
      title,
      workType,
      location,
      description: [
        `Permit Class: ${isEmergency ? "Emergency" : "Normal"}`,
        `Review Route: ${isEmergency ? "Safety Officer" : "Admin Lane 2 -> Safety Officer"}`,
        `Permit Type: ${permitTypes.join(", ") || "-"}`,
        `Assigned Workers: ${formatAssignedWorkers(assignedWorkers)}`,
        `Assigned Worker IDs: ${assignedWorkerIdentifiers.join(", ") || "-"}`,
        "",
        description,
      ].join("\n"),
      startDateTime,
      endDateTime,
      hazards: isEmergency
        ? [...new Set([...hazards, "Emergency"])]
        : hazards,
      controls: splitList(formData.get("controls")),
      ppe: formData.getAll("ppe").map(String),
      approvers,
      documents,
      assignedWorkers: assignedWorkerIdentifiers,
      isEmergency,
    };
  }

  async function savePermit(shouldSubmit) {
    try {
      const payload = await readPermitForm(shouldSubmit);
      if (!payload) return;

      const id = elements.permitForm.elements.id.value;
      const shouldDirectSubmit = shouldSubmit && payload.isEmergency;

      if (state.mode === "offline") {
        saveOfflinePermit(id, payload, shouldDirectSubmit);
      } else if (id) {
        const updated = await apiRequest(`/api/permits/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        if (shouldDirectSubmit) {
          await apiRequest(`/api/permits/${encodeURIComponent(updated.id)}/status`, {
            method: "PATCH",
            body: JSON.stringify({
              status: "submitted",
              comment: payload.isEmergency
                ? "Emergency permit submitted directly to safety officer"
                : "Submitted by requester after update",
            }),
          });
        }
        await loadOnlineData();
      } else {
        const created = await apiRequest("/api/permits", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (shouldDirectSubmit) {
          await apiRequest(`/api/permits/${encodeURIComponent(created.id)}/status`, {
            method: "PATCH",
            body: JSON.stringify({
              status: "submitted",
              comment: payload.isEmergency
                ? "Emergency permit submitted directly to safety officer"
                : "Submitted by requester",
            }),
          });
        }
        await loadOnlineData();
      }

      elements.permitDialog.close();
      showToast(
        shouldSubmit
          ? payload.isEmergency
            ? "Emergency permit submitted to Safety Officer."
            : "Permit draft sent to Admin Lane 2 review."
          : "Permit draft saved.",
      );
    } catch (error) {
      showToast(error.error || "Unable to save permit.");
    }
  }

  function saveOfflinePermit(id, payload, shouldSubmit) {
    const now = new Date().toISOString();
    const status = shouldSubmit ? "submitted" : "draft";

    if (id) {
      state.permits = state.permits.map((permit) =>
        permit.id === id
          ? normalizePermit({
              ...permit,
              ...payload,
              status,
              updatedAt: now,
              isOffline: true,
            })
          : permit,
      );
    } else {
      state.permits = [
        normalizePermit({
          id: `OFF-${Date.now().toString(36).toUpperCase()}`,
          ...payload,
          status,
          createdAt: now,
          updatedAt: now,
          isOffline: true,
        }),
        ...state.permits,
      ];
    }

    syncPermitCodes();
    writeJsonStorage(STORAGE_KEYS.offlinePermits, state.permits);
    render();
  }

  function findPermit(id) {
    return state.permits.find((permit) => permit.id === id);
  }

  async function submitExistingPermit(id) {
    const permit = findPermit(id);

    if (!permit?.isEmergency) {
      showToast("Normal permit drafts must be submitted by Admin Lane 2 after draft review.");
      return;
    }

    try {
      if (state.mode === "offline") {
        updateOfflineStatus(id, "submitted");
      } else {
        await apiRequest(`/api/permits/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "submitted",
            comment: permit?.isEmergency
              ? "Emergency permit submitted directly to safety officer"
              : "Submitted from requester dashboard",
          }),
        });
        await loadOnlineData();
      }
      showToast("Permit submitted for approval.");
    } catch (error) {
      showToast(error.error || "Unable to submit permit.");
    }
  }

  async function cancelPermit(id) {
    try {
      if (state.mode === "offline") {
        updateOfflineStatus(id, "cancelled");
      } else {
        await apiRequest(`/api/permits/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "cancelled",
            comment: "Cancelled by requester",
          }),
        });
        await loadOnlineData();
      }
      showToast("Permit cancelled.");
    } catch (error) {
      showToast(error.error || "Unable to cancel permit.");
    }
  }

  async function closePermit(id) {
    try {
      if (state.mode === "offline") {
        updateOfflineStatus(id, "closed");
      } else {
        await apiRequest(`/api/permits/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "closed",
            comment: "Closed by requester after work completion",
          }),
        });
        await loadOnlineData();
      }
      showToast("Active work permit closed.");
    } catch (error) {
      showToast(error.error || "Unable to close permit.");
    }
  }

  async function deleteWorkerProfile(id) {
    const worker = getWorkerById(id);
    if (!worker) {
      showToast("Worker profile not found.");
      return;
    }

    if (!confirm(`Delete worker profile for ${worker.name || "this worker"}?`)) return;

    try {
      if (state.mode === "offline") {
        state.workers = state.workers.filter((item) => String(item.id) !== String(id));
        writeJsonStorage(STORAGE_KEYS.workers, state.workers);
      } else {
        await apiRequest(`/api/workers/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        await refreshWorkersFromServer();
      }

      render();
      showToast("Worker profile deleted.");
    } catch (error) {
      showToast(error.error || "Unable to delete worker profile.");
    }
  }

  function updateOfflineStatus(id, status) {
    const now = new Date().toISOString();
    state.permits = state.permits.map((permit) =>
      permit.id === id ? normalizePermit({ ...permit, status, updatedAt: now }) : permit,
    );
    writeJsonStorage(STORAGE_KEYS.offlinePermits, state.permits);
    render();
  }

  async function showPermitDetails(id) {
    let permit = findPermit(id);

    if (!permit) {
      showToast("Permit not found.");
      return;
    }

    if (state.mode === "online") {
      try {
        permit = normalizePermit(await apiRequest(`/api/permits/${encodeURIComponent(id)}`));
      } catch {
        // Fall back to the locally loaded row if the detail request fails.
      }
    }

    elements.detailTitle.textContent = `${getDisplayPermitId(permit)} - ${permit.title || permit.workType}`;
    elements.detailSubtitle.textContent = `${permit.workType} - ${formatStatus(permit.status)}`;
    elements.detailList.innerHTML = detailRows(permit);
    elements.detailList.querySelector("[data-detail-mos-jsa-export]")?.addEventListener("click", () => {
      downloadPermitMosJsaExcel(permit)
        .then(() => showToast("MOS/JSA Excel exported."))
        .catch((error) => showToast(error.message || "Unable to export MOS/JSA Excel."));
    });
    elements.permitDetailDialog.showModal();
  }

  function detailRows(permit) {
    const displayId = getDisplayPermitId(permit);
    const uiStatus = toUiStatus(permit.status);
    const permitClass = permit.isEmergency ? "Emergency - Safety Officer" : "Normal - Admin";
    const rejectionSection =
      uiStatus === "rejected"
        ? `
          <section class="detail-section">
            <h4>Latest Rejection Reason</h4>
            <div class="detail-grid">
              ${detailItem("Reason", renderTextBlock(permit.latestRejectionReason || "No rejection reason recorded."), true, true)}
              ${detailItem("Returned By", permit.latestRejectionBy || permit.latestRejectionByRole || "Reviewer")}
              ${detailItem("Returned At", formatDateTime(permit.latestRejectionAt))}
            </div>
          </section>
        `
        : "";

    return `
      <div class="detail-hero">
        <div>
          <span class="detail-kicker">Permit package</span>
          <strong>${escapeHtml(displayId)}</strong>
          <p>${escapeHtml(permit.title || permit.workType || "Permit request")}</p>
        </div>
        <span class="status-pill ${escapeHtml(uiStatus)}">${escapeHtml(formatStatus(permit.status))}</span>
      </div>

      ${rejectionSection}

      <section class="detail-section">
        <h4>Work Details</h4>
        <div class="detail-grid">
          ${detailItem("Permit ID", displayId)}
          ${detailItem("Permit Class", permitClass)}
          ${detailItem("Work Type", permit.workType)}
          ${detailItem("Location", permit.location)}
          ${detailItem("Schedule", `${formatDateTime(permit.startDateTime)} to ${formatDateTime(permit.endDateTime)}`, true)}
          ${detailItem("Assigned Workers", formatAssignedWorkers(permit.assignedWorkers), true)}
        </div>
      </section>

      <section class="detail-section">
        <h4>Safety Controls</h4>
        <div class="detail-grid">
          ${detailItem("Permit Type", renderChips(permit.hazards), false, true)}
          ${detailItem("PPE", renderChips(permit.ppe), false, true)}
          ${detailItem("Controls", renderMultiline(permit.controls), true, true)}
          ${detailItem("Admin Reviewer", renderChips(permit.approvers), true, true)}
        </div>
      </section>

      <section class="detail-section">
        <h4>Documents and Scope</h4>
        <div class="detail-grid">
          ${renderDigitalEvidenceDetail(permit)}
          ${renderSupportingDocumentsDetail(permit.documents)}
          ${detailItem("Scope", renderTextBlock(extractScope(permit.description) || "-"), true, true)}
        </div>
      </section>

      <section class="detail-section">
        <h4>Audit Trail</h4>
        <div class="detail-grid">
          ${detailItem("Audit", renderAuditTrail(permit.auditLogs), true, true)}
        </div>
      </section>
    `;
  }

  function detailItem(label, value, wide = false, isHtml = false) {
    return `
      <div class="detail-item${wide ? " wide" : ""}">
        <div>
          <span class="detail-label">${escapeHtml(label)}</span>
          <div class="detail-value">${isHtml ? value : escapeHtml(value || "-")}</div>
        </div>
      </div>
    `;
  }

  function renderTextBlock(value) {
    return `<div class="detail-text">${escapeHtml(value || "-")}</div>`;
  }

  function renderMultiline(values) {
    const text = Array.isArray(values) ? values.filter(Boolean).join("\n") : String(values || "");
    return renderTextBlock(text || "-");
  }

  function renderChips(values) {
    const items = (Array.isArray(values) ? values : String(values || "").split(","))
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    if (!items.length) return renderTextBlock("-");

    return `
      <div class="detail-chip-list">
        ${items.map((item) => `<span class="detail-chip">${escapeHtml(item)}</span>`).join("")}
      </div>
    `;
  }

  function renderDigitalEvidenceDetail(permit) {
    const documents = getStructuredDocuments(permit.documents || []);
    if (!documents.length) return "";

    return detailItem(
      "MOS / JSA Digital Evidence",
      `
        <div class="detail-digital-evidence">
          <div class="detail-digital-evidence-head">
            <span>${documents.length}/2 forms completed</span>
            <button class="detail-export-button" type="button" data-detail-mos-jsa-export>Export Excel</button>
          </div>
          <div class="detail-digital-evidence-grid">
            ${documents.map(renderStructuredDocumentDetail).join("")}
          </div>
        </div>
      `,
      true,
      true,
    );
  }

  function renderStructuredDocumentDetail(document) {
    const type = String(document.type || "").trim().toUpperCase();
    const schema = digitalDocumentSchemas[type] || { title: `${type} Digital Form`, fields: [] };
    const data = normalizeStructuredData(document.structuredData);
    const fieldLabels = Object.fromEntries((schema.fields || []).map((field) => [field.key, field.label]));
    const knownRows = (schema.fields || [])
      .map((field) => [field.label, data[field.key]])
      .filter(([, value]) => hasStructuredValue(value));
    const extraRows = Object.entries(data)
      .filter(([key]) => !fieldLabels[key])
      .map(([key, value]) => [formatStructuredFieldLabel(key), value]);
    const rows = [...knownRows, ...extraRows];

    return `
      <article class="detail-digital-card">
        <strong>${escapeHtml(schema.title)}</strong>
        <dl>
          ${rows
            .map(
              ([label, value]) => `
                <div>
                  <dt>${escapeHtml(label)}</dt>
                  <dd>${escapeHtml(formatStructuredValue(value))}</dd>
                </div>
              `,
            )
            .join("")}
        </dl>
      </article>
    `;
  }

  function hasStructuredValue(value) {
    return Array.isArray(value) ? value.length > 0 : Boolean(String(value || "").trim());
  }

  function formatStructuredValue(value) {
    return Array.isArray(value) ? value.join("\n") : String(value || "");
  }

  function formatStructuredFieldLabel(key) {
    return String(key || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function renderSupportingDocumentsDetail(documents) {
    const html = renderDocuments(documents);
    return html ? detailItem("Supporting Files", html, true, true) : "";
  }

  function renderDocuments(documents) {
    const items = (Array.isArray(documents) ? documents : []).filter(
      (document) => document?.hasAttachment && !isStructuredDocumentType(document.type),
    );
    if (!items.length) return "";

    return `
      <div class="detail-documents">
        ${items
          .map((document) => {
            const type = document.type || "Document";
            const name = document.fileName || document.name || "-";
            return `
              <div class="detail-document">
                <strong>${escapeHtml(type)}</strong>
                <span>${escapeHtml(name)}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderAuditTrail(auditLogs) {
    if (!Array.isArray(auditLogs) || !auditLogs.length) {
      return renderTextBlock("No audit log loaded.");
    }

    return `
      <div class="audit-list">
        ${auditLogs
          .map(
            (log) => `
              <div class="audit-item">
                <time>${escapeHtml(formatDateTime(log.when))}</time>
                <span>${escapeHtml(`${log.action}${log.status ? ` (${log.status})` : ""}`)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function setView(view) {
    state.activeView = view;

    if (view === "dashboard" || view === "permits" || view === "workers") {
      state.activeFilter = "all";
    }

    if (view === "compliance") {
      state.activeFilter = "active";
      showToast("Compliance view filtered to approved and active work.");
    }

    render();
  }

  function handleTableAction(button) {
    const id = button.dataset.id;
    const operation = button.dataset.operation;

    if (operation === "edit") openEditPermit(id);
    if (operation === "revise") openEditPermit(id, true);
    if (operation === "submit") submitExistingPermit(id);
    if (operation === "cancel") cancelPermit(id);
    if (operation === "close") closePermit(id);
    if (operation === "view" || operation === "monitor") showPermitDetails(id);
    if (operation === "edit-worker" || operation === "view-worker") openEditWorkerProfile(id);
    if (operation === "delete-worker") deleteWorkerProfile(id);
    if (operation === "nudge") showToast(`Reminder sent for ${getDisplayPermitId(id)}.`);
  }

  async function logout() {
    try {
      if (state.session?.token && state.session.token !== OFFLINE_TOKEN) {
        await apiRequest("/api/auth/logout", { method: "POST" });
      }
    } catch {
      // The local session should still be cleared if the server token is already invalid.
    } finally {
      clearSession();
      state.session = null;
      window.location.assign(getAuthUrl("login"));
    }
  }

  function attachEvents() {
    document.querySelector("#createPermitButton").addEventListener("click", openCreatePermit);
    document.querySelector("#emergencyPermitButton").addEventListener("click", openEmergencyPermit);
    document.querySelector("#logoutButton").addEventListener("click", logout);
    elements.accountButton?.addEventListener("click", () => window.location.assign("/account"));
    elements.notificationButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      setNotificationPanel(elements.notificationPanel?.hidden);
    });
    elements.notificationCloseButton?.addEventListener("click", () => setNotificationPanel(false));
    elements.notificationList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-notification-view]");
      if (button) {
        openNotificationTarget(button);
      }
    });
    document.addEventListener("click", (event) => {
      if (!elements.notificationPanel || elements.notificationPanel.hidden) return;
      if (event.target.closest(".notification-wrap")) return;
      setNotificationPanel(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setNotificationPanel(false);
      }
    });
    document.querySelector("#refreshButton").addEventListener("click", async () => {
      if (state.mode === "online") {
        try {
          await loadOnlineData();
          showToast("Dashboard refreshed.");
        } catch (error) {
          showToast(error.error || "Unable to refresh dashboard.");
        }
      } else {
        render();
        showToast("Offline dashboard refreshed.");
      }
    });

    elements.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderTable();
    });

    elements.tableToolbar.addEventListener("click", (event) => {
      const statusButton = event.target.closest("[data-status-filter]");
      if (statusButton) {
        state.activeFilter = statusButton.dataset.statusFilter;
        render();
        return;
      }

      if (event.target.closest("#createWorkerProfileButton")) {
        if (state.mode !== "offline") {
          showToast("Only Admin can add worker profiles.");
          return;
        }
        openCreateWorkerProfile();
      }
    });

    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.view));
    });

    elements.tableBody.addEventListener("click", (event) => {
      const certDownloadButton = event.target.closest("[data-worker-cert-download]");
      if (certDownloadButton) {
        downloadWorkerCertification(
          certDownloadButton.dataset.workerCertDownload,
          certDownloadButton.dataset.certificationId,
          certDownloadButton.dataset.fileName,
        ).catch((error) => showToast(error.message || "Unable to download certificate."));
        return;
      }

      const button = event.target.closest("[data-operation]");
      if (button) handleTableAction(button);
    });

    document.querySelectorAll("[data-dialog-close]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelector(`#${button.dataset.dialogClose}`)?.close();
      });
    });

    // listen for workers updated by admin in other tabs/windows
    window.addEventListener('storage', async (ev) => {
      if (ev.key === STORAGE_KEYS.workers) {
        if (state.mode === "online") {
          await refreshWorkersFromServer().catch(() => refreshWorkersFromStorage());
        } else {
          refreshWorkersFromStorage();
        }
        showToast("Worker list updated");
      }
    });

    elements.addWorkerCertificationButton?.addEventListener("click", () => addWorkerCertificationRow());
    elements.workerCertificationList?.addEventListener("click", (event) => {
      const downloadButton = event.target.closest("[data-worker-cert-download]");
      if (downloadButton) {
        downloadWorkerCertification(
          downloadButton.dataset.workerCertDownload,
          downloadButton.dataset.certificationId,
          downloadButton.dataset.fileName,
        ).catch((error) => showToast(error.message || "Unable to download certificate."));
        return;
      }

      const removeButton = event.target.closest("[data-worker-cert-remove]");
      if (!removeButton) return;

      const rows = elements.workerCertificationList.querySelectorAll(".certification-row");
      if (rows.length <= 1) {
        renderWorkerCertificationEditor();
        return;
      }

      removeButton.closest(".certification-row")?.remove();
    });
    elements.workerCertificationList?.addEventListener("change", (event) => {
      const fileInput = event.target.closest('[data-cert-field="file"]');
      if (!fileInput) return;

      const row = fileInput.closest(".certification-row");
      const fileName = fileInput.files?.[0]?.name || "No file selected";
      const status = fileInput.closest(".certification-field")?.querySelector("small");
      if (status) status.textContent = fileName;
      if (row) {
        row.dataset.certFileName = fileName === "No file selected" ? row.dataset.certFileName || "" : fileName;
      }
    });
    elements.workerForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      saveWorkerProfile();
    });
    elements.downloadMosJsaTemplateButton?.addEventListener("click", downloadMosJsaTemplate);
    elements.importMosJsaTemplateInput?.addEventListener("change", (event) => {
      importMosJsaTemplate(event.target.files?.[0]);
    });
    elements.digitalDocumentEditor?.addEventListener("input", () => {
      syncStructuredDocumentsFromEditor();
      const existingPermit = state.editingId ? findPermit(state.editingId) : null;
      renderDigitalDocumentStatus(existingPermit?.documents || []);
      updateDocumentStatuses(existingPermit?.documents || []);
    });
    elements.permitForm.elements.workType.addEventListener("change", () => {
      const selectedWorkerIds = new FormData(elements.permitForm)
        .getAll("assignedWorkers")
        .map(String);
      const existingPermit = state.editingId ? findPermit(state.editingId) : null;
      renderWorkerOptions(selectedWorkerIds);
      renderDocumentUploads(existingPermit?.documents || []);
    });
    elements.permitForm.querySelectorAll('input[name="hazards"]').forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const selectedWorkerIds = new FormData(elements.permitForm)
          .getAll("assignedWorkers")
          .map(String);
        renderWorkerOptions(selectedWorkerIds);
      });
    });
    elements.permitForm.addEventListener("submit", (event) => {
      event.preventDefault();
      savePermit(true);
    });
  }

  attachEvents();
  initializeSession();
})();
