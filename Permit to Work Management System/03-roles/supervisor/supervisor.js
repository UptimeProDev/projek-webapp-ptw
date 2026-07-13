document.addEventListener('DOMContentLoaded', () => {
  const PAGE_SIZE = 5;
  const SUPERVISOR_ACCESS_ROLES = new Set(['supervisor', 'approver']);
  const HELD_STORAGE_KEY = 'ptwSupervisorHeldPermits';
  const WORK_STATE_STORAGE_KEY = 'ptwSupervisorWorkStates';
  const COMPLETION_STORAGE_KEY = 'ptwWorkerCompletionRequests';
  const DECISION_STORAGE_KEY = 'ptwSupervisorPermitDecisions';
  const EXTENSION_STORAGE_KEY = 'ptwSupervisorWorkerExtensionRequests';
  const SITE_VALIDATION_STORAGE_KEY = 'ptwSupervisorSiteValidationChecklists';

  const elements = {
    mainPanel: document.querySelector('.main-panel'),
    pageTitle: document.querySelector('#pageTitle'),
    searchInput: document.querySelector('#searchInput'),
    refreshButton: document.querySelector('#refreshButton'),
    authWarning: document.querySelector('#authWarning'),
    dashboardView: document.querySelector('#dashboardView'),
    listView: document.querySelector('#listView'),
    monitoringView: document.querySelector('#monitoringView'),
    extensionApprovalView: document.querySelector('#extensionApprovalView'),
    permitReviewView: document.querySelector('#permitReviewView'),
    permitReviewContent: document.querySelector('#permitReviewContent'),
    listTitle: document.querySelector('#listTitle'),
    listText: document.querySelector('#listText'),
    listContent: document.querySelector('#listContent'),
    navItems: Array.from(document.querySelectorAll('.nav-item[data-view]')),
    metricCards: Array.from(document.querySelectorAll('[data-metric-view]')),
    pendingApprovals: document.querySelector('#pendingApprovals'),
    approvedPermits: document.querySelector('#approvedPermits'),
    activeWork: document.querySelector('#activeWork'),
    liveTeams: document.querySelector('#liveTeams'),
    expiringPermits: document.querySelector('#expiringPermits'),
    todayDelta: document.querySelector('#todayDelta'),
    pendingMeter: document.querySelector('#pendingMeter'),
    approvedMeter: document.querySelector('#approvedMeter'),
    activeMeter: document.querySelector('#activeMeter'),
    expiringMeter: document.querySelector('#expiringMeter'),
    queueBody: document.querySelector('#queueBody'),
    queueSummary: document.querySelector('#queueSummary'),
    filterButton: document.querySelector('#filterButton'),
    filterStrip: document.querySelector('#filterStrip'),
    filterChips: Array.from(document.querySelectorAll('.filter-chip')),
    exportButton: document.querySelector('#exportButton'),
    prevPage: document.querySelector('#prevPage'),
    nextPage: document.querySelector('#nextPage'),
    pageNumbers: Array.from(document.querySelectorAll('.page-number')),
    listBackButton: document.querySelector('#listBackButton'),
    reviewBackButton: document.querySelector('#reviewBackButton'),
    approvedExecutionCards: document.querySelector('#approvedExecutionCards'),
    activeExecutionCards: document.querySelector('#activeExecutionCards'),
    monitoringActiveCount: document.querySelector('#monitoringActiveCount'),
    monitoringCriticalCount: document.querySelector('#monitoringCriticalCount'),
    extensionCount: document.querySelector('#extensionCount'),
    extensionList: document.querySelector('#extensionList'),
    extensionDialog: document.querySelector('#extensionDialog'),
    extensionDialogContent: document.querySelector('#extensionDialogContent'),
    siteChecklistDialog: document.querySelector('#siteChecklistDialog'),
    siteChecklistDialogContent: document.querySelector('#siteChecklistDialogContent'),
    supportButton: document.querySelector('#supportButton'),
    profileButton: document.querySelector('#profileButton'),
    profileName: document.querySelector('#profileName'),
    profileRole: document.querySelector('#profileRole'),
    profileAvatar: document.querySelector('#profileAvatar'),
    reviewProfileName: document.querySelector('#reviewProfileName'),
    reviewProfileRole: document.querySelector('#reviewProfileRole'),
    reviewProfileAvatar: document.querySelector('#reviewProfileAvatar'),
    reviewNotificationButton: document.querySelector('#reviewNotificationButton'),
    notificationButton: document.querySelector('#notificationButton'),
    notificationPanel: document.querySelector('#notificationPanel'),
    notificationCloseButton: document.querySelector('#notificationCloseButton'),
    notificationList: document.querySelector('#notificationList'),
    notificationCount: document.querySelector('#notificationCount'),
    logoutButton: document.querySelector('#logoutButton'),
  };

  const state = {
    session: readSession(),
    permits: [],
    workers: [],
    activeView: 'dashboard',
    selectedMetric: 'pending',
    activeFilter: 'all',
    page: 1,
    reviewPermitId: null,
    notifications: [],
    reviewReturnView: 'dashboard',
    heldPermits: readStoredSet(HELD_STORAGE_KEY),
    workStates: readStoredObject(WORK_STATE_STORAGE_KEY),
    completionRequests: readStoredObject(COMPLETION_STORAGE_KEY),
    permitDecisions: readStoredObject(DECISION_STORAGE_KEY),
    extensionDecisions: readStoredObject(EXTENSION_STORAGE_KEY),
    siteValidationChecklists: readStoredObject(SITE_VALIDATION_STORAGE_KEY),
  };

  const digitalDocumentLabels = {
    MOS: {
      title: 'MOS Digital Form',
      fields: {
        workTitle: 'Work Title',
        workLocation: 'Work Location',
        scope: 'Scope of Work',
        methodSteps: 'Method Steps',
        toolsEquipment: 'Tools / Equipment',
        materials: 'Materials / Chemicals',
        isolations: 'Isolation / Preparation',
        responsiblePerson: 'Responsible Person',
        emergencyArrangement: 'Emergency Arrangement',
      },
    },
    JSA: {
      title: 'JSA Digital Form',
      fields: {
        taskStep: 'Task Step / Activity',
        permitTypeHazards: 'Permit Type / Hazard',
        potentialConsequence: 'Potential Consequence',
        controlMeasures: 'Control Measures',
        requiredPpe: 'Required PPE',
        responsiblePerson: 'Responsible Person',
        residualRisk: 'Residual Risk',
      },
    },
  };

  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

  const metricPages = {
    pending: {
      title: 'Pending Approvals',
      text: 'Permits awaiting Supervisor Permit Approval or final release.',
      empty: 'No pending approvals',
      getPermits: () => commandPermits().filter((permit) => ['stage1_complete', 'approved'].includes(permit.status)),
    },
    approved: {
      title: 'Approved Permits',
      text: 'Safety verified permits ready for work release.',
      empty: 'No approved permits',
      getPermits: () => state.permits.filter((permit) => permit.status === 'approved' && !permit.isEmergency),
    },
    active: {
      title: 'Active Works',
      text: 'Live work fronts requiring monitoring actions.',
      empty: 'No active work',
      getPermits: () => state.permits.filter((permit) => permit.status === 'active' && !permit.isEmergency && !isClosureTrackingPermit(permit)),
    },
    expiring: {
      title: 'Expiring Permits',
      text: 'Permits nearing expiry and requiring supervisor attention.',
      empty: 'No expiring permits',
      getPermits: () => state.permits.filter((permit) => ['approved', 'active'].includes(permit.status) && !isClosureTrackingPermit(permit) && isDueWithin(permit, 2)),
    },
  };

  function readSession() {
    const stored = localStorage.getItem('ptwSession') || sessionStorage.getItem('ptwSession');
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      clearSession();
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem('ptwSession');
    sessionStorage.removeItem('ptwSession');
  }

  function writeSessionUser(user) {
    if (!state.session || !user) return;
    state.session = { ...state.session, user };
    const serialized = JSON.stringify(state.session);
    if (localStorage.getItem('ptwSession')) {
      localStorage.setItem('ptwSession', serialized);
    } else {
      sessionStorage.setItem('ptwSession', serialized);
    }
  }

  function initials(name) {
    return String(name || 'S')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'S';
  }

  function escapeAttribute(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getUserRoles(user) {
    const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
    return roles
      .map((role) => String(role || '').toLowerCase())
      .map((role) => role === 'approver' ? 'supervisor' : role)
      .filter(Boolean)
      .filter((role, index, list) => list.indexOf(role) === index);
  }

  function userHasRole(user, role) {
    return getUserRoles(user).includes(role);
  }

  function userHasAnyRole(user, roles) {
    return roles.some((role) => userHasRole(user, role));
  }

  function updateProfile(user) {
    const name = user?.fullName || user?.email || 'Supervisor';
    const roleLabel = 'Supervisor';
    elements.profileName.textContent = name;
    elements.profileRole.textContent = roleLabel;
    if (user?.profilePictureUrl) {
      elements.profileAvatar.innerHTML = `<img src="${escapeAttribute(user.profilePictureUrl)}" alt="">`;
      if (elements.reviewProfileAvatar) {
        elements.reviewProfileAvatar.innerHTML = `<img src="${escapeAttribute(user.profilePictureUrl)}" alt="">`;
      }
    } else {
      elements.profileAvatar.textContent = initials(name);
      if (elements.reviewProfileAvatar) elements.reviewProfileAvatar.textContent = initials(name);
    }
    if (elements.reviewProfileName) elements.reviewProfileName.textContent = name;
    if (elements.reviewProfileRole) elements.reviewProfileRole.textContent = roleLabel;
  }

  async function refreshCurrentUser() {
    try {
      const result = await apiRequest('/api/auth/me');
      if (result.user) {
        writeSessionUser(result.user);
        updateProfile(result.user);
      }
    } catch {
      updateProfile(state.session?.user);
    }
  }

  function supervisorNotificationItems() {
    const pending = commandPermits().filter((permit) => ['stage1_complete', 'approved'].includes(permit.status)).length;
    const active = state.permits.filter((permit) => permit.status === 'active' && !permit.isEmergency).length;
    const extensions = Object.values(state.extensionDecisions || {}).length;
    return [
      {
        view: 'dashboard',
        label: 'Approvals',
        title: `${pending} permit${pending === 1 ? '' : 's'} awaiting approval`,
        body: 'Review permits ready for Permit Approval or work release.',
      },
      {
        view: 'monitoring',
        label: 'Active Work',
        title: `${active} active work front${active === 1 ? '' : 's'}`,
        body: 'Monitor active permits and expiry risk.',
      },
      {
        view: 'extensions',
        label: 'Extensions',
        title: `${extensions} extension request${extensions === 1 ? '' : 's'}`,
        body: 'Review worker extension requests and decisions.',
      },
    ];
  }

  function renderNotifications() {
    if (state.notifications.length) {
      const unreadCount = state.notifications.filter((item) => item.unread).length;
      elements.notificationCount.textContent =
        unreadCount ? `${unreadCount} unread` : state.notifications.length === 1 ? '1 item' : `${state.notifications.length} items`;
      elements.notificationList.innerHTML = state.notifications
        .map((item) => `
          <button class="notification-item" type="button"
            data-notification-id="${escapeHtml(item.id || '')}"
            data-notification-link="${escapeHtml(item.link || '')}">
            <span>${escapeHtml(item.type || 'Update')}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.message || 'PTW update')}</p>
          </button>
        `)
        .join('');
      return;
    }

    const items = supervisorNotificationItems();
    elements.notificationCount.textContent = `${items.length} items`;
    elements.notificationList.innerHTML = items
      .map((item) => `
        <button class="notification-item" type="button" data-notification-view="${escapeHtml(item.view)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.body)}</p>
        </button>
      `)
      .join('');
  }

  function setNotificationPanel(open) {
    if (!elements.notificationPanel) return;
    elements.notificationPanel.hidden = !open;
    elements.notificationButton?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function readStoredSet(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function persistStoredSet(key, set) {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  }

  function readStoredObject(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function persistStoredObject(key, object) {
    localStorage.setItem(key, JSON.stringify(object));
  }

  async function apiRequest(path, options = {}) {
    if (!state.session?.token) {
      throw new Error('Supervisor session required');
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.session.token}`,
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
        window.location.replace('/login');
      }
      throw { status: response.status, ...body };
    }

    return body;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizePermit(permit) {
    return {
      ...permit,
      hazards: Array.isArray(permit.hazards) ? permit.hazards : [],
      controls: Array.isArray(permit.controls) ? permit.controls : [],
      ppe: Array.isArray(permit.ppe) ? permit.ppe : [],
      documents: Array.isArray(permit.documents) ? permit.documents : [],
      assignedWorkers: Array.isArray(permit.assignedWorkers) ? permit.assignedWorkers : [],
      approvers: Array.isArray(permit.approvers) ? permit.approvers : [],
      siteValidation: permit.siteValidation && typeof permit.siteValidation === 'object' && !Array.isArray(permit.siteValidation)
        ? permit.siteValidation
        : {},
    };
  }

  function normalizeExtensionRequestMap(input) {
    const items = Array.isArray(input) ? input : Object.values(input || {});
    return items.reduce((map, request) => {
      const normalized = normalizeExtensionRequest(request);
      if (normalized.requestId) {
        map[normalized.requestId] = normalized;
      }
      return map;
    }, {});
  }

  function normalizeExtensionRequest(request) {
    const requestId = request?.requestId || request?.id || '';
    return {
      ...request,
      requestId,
      permitId: request?.permitId || request?.permit?.id || '',
      requestedMinutes: Number(request?.requestedMinutes) || 60,
      status: request?.status || 'waiting',
      requestedAt: request?.requestedAt || request?.createdAt || '',
      decidedAt: request?.decidedAt || '',
      notes: request?.notes || '',
      reason: request?.reason || '',
    };
  }

  function requireSupervisorAccess() {
    if (userHasAnyRole(state.session?.user, Array.from(SUPERVISOR_ACCESS_ROLES))) {
      elements.authWarning.classList.add('hidden');
      elements.dashboardView.classList.remove('hidden');
      updateProfile(state.session.user);
      return true;
    }

    elements.authWarning.classList.remove('hidden');
    hideAllViews();
    setTimeout(() => window.location.assign('/login'), 800);
    return false;
  }

  async function loadData() {
    const [permitResult, workerResult, extensionResult, notificationResult] = await Promise.all([
      apiRequest('/api/permits'),
      apiRequest('/api/workers').catch(() => ({ workers: [] })),
      apiRequest('/api/extension-requests').catch(() => ({ requests: [] })),
      loadNotifications(),
    ]);

    state.permits = (permitResult.permits || permitResult.data || []).map(normalizePermit);
    state.siteValidationChecklists = {
      ...state.siteValidationChecklists,
      ...state.permits.reduce((records, permit) => {
        if (permit.siteValidation && Object.keys(permit.siteValidation).length) {
          records[permit.id] = permit.siteValidation;
        }
        return records;
      }, {}),
    };
    persistStoredObject(SITE_VALIDATION_STORAGE_KEY, state.siteValidationChecklists);
    state.workers = workerResult.workers || workerResult.data || [];
    state.notifications = notificationResult.notifications || notificationResult.data || [];
    state.extensionDecisions = {
      ...normalizeExtensionRequestMap(readStoredObject(EXTENSION_STORAGE_KEY)),
      ...normalizeExtensionRequestMap(extensionResult.requests || extensionResult.data || []),
    };
    state.workStates = readStoredObject(WORK_STATE_STORAGE_KEY);
    state.completionRequests = readStoredObject(COMPLETION_STORAGE_KEY);
    state.permitDecisions = readStoredObject(DECISION_STORAGE_KEY);
    renderNotifications();
  }

  async function loadNotifications() {
    try {
      return await apiRequest('/api/notifications?limit=20');
    } catch {
      return { notifications: [] };
    }
  }

  function extractPermitType(permit) {
    if (permit.workType) return permit.workType;
    const match = String(permit.description || '').match(/Permit Type:\s*([^\n]+)/i);
    return match ? match[1].trim() : 'Preventive Maintenance';
  }

  function cleanTitle(permit) {
    return permit.title || extractPermitType(permit);
  }

  function cleanDescription(permit) {
    return String(permit.description || '')
      .split('\n')
      .filter((line) => !/^Permit Class:/i.test(line.trim()))
      .filter((line) => !/^Review Route:/i.test(line.trim()))
      .filter((line) => !/^Permit Type:/i.test(line.trim()))
      .filter((line) => !/^Assigned Worker/i.test(line.trim()))
      .filter((line) => !/^Required Documents:/i.test(line.trim()))
      .filter((line) => !/^(HIRARC|MOS|JSA):/i.test(line.trim()))
      .join('\n')
      .trim() || '-';
  }

  function displayPermitId(permit) {
    const raw = String(permit.id || '').trim();
    if (/^PTW-/i.test(raw)) return raw.toUpperCase();
    if (/^[0-9a-f-]{20,}$/i.test(raw)) return `PTW-${raw.slice(0, 4).toUpperCase()}`;
    return raw || 'PTW';
  }

  function formatStatus(status) {
    return String(status || 'draft')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatQueueStatus(permit) {
    if (permit.status === 'stage1_complete') return { label: 'Permit Approval', className: 'pending' };
    if (permit.status === 'approved') return { label: 'Pending Final Approval', className: 'pending' };
    if (permit.status === 'rejected') {
      const outcome = state.permitDecisions[permit.id]?.outcome;
      return outcome === 'rejected'
        ? { label: 'Rejected', className: 'rejected' }
        : { label: 'Returned', className: 'returned' };
    }
    if (permit.status === 'active') return { label: 'Active Work', className: 'active' };
    return { label: 'Pending Review', className: 'pending' };
  }

  function formatDateTime(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';

    const date = parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const time = parsed.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${date}, ${time}`;
  }

  function latestCompletionRequest(permit) {
    return Object.values(state.completionRequests || {})
      .filter((request) => request?.permitId === permit.id || request?.permitDisplayId === displayPermitId(permit))
      .sort((a, b) => new Date(b.closedAt || b.submittedAt || 0) - new Date(a.closedAt || a.submittedAt || 0))[0] || null;
  }

  function getWorkCondition(permit) {
    if (permit.status === 'closed') return 'closed';

    const completion = latestCompletionRequest(permit);
    if (completion) {
      const status = String(completion.status || 'waiting_admin').toLowerCase();
      if (status === 'closed') return 'closed';
      if (!['rejected', 'cancelled', 'returned'].includes(status)) return 'sent_for_closure';
    }

    const stateName = state.workStates[permit.id]?.state || 'active';
    return stateName === 'final_closure' ? 'sent_for_closure' : stateName;
  }

  function isClosureTrackingPermit(permit) {
    return ['sent_for_closure', 'closed'].includes(getWorkCondition(permit));
  }

  function isLiveWorkPermit(permit) {
    return permit.status === 'active' && !permit.isEmergency && !isClosureTrackingPermit(permit);
  }

  function isToday(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    const now = new Date();
    return parsed.getFullYear() === now.getFullYear()
      && parsed.getMonth() === now.getMonth()
      && parsed.getDate() === now.getDate();
  }

  function isDueWithin(permit, hours) {
    if (isClosureTrackingPermit(permit)) return false;
    const end = new Date(permit.endDateTime);
    if (Number.isNaN(end.getTime())) return false;
    const diff = end.getTime() - Date.now();
    return diff > 0 && diff <= hours * 60 * 60 * 1000;
  }

  function remainingMs(permit) {
    const end = new Date(permit.endDateTime);
    if (Number.isNaN(end.getTime())) return 0;
    return Math.max(0, end.getTime() - Date.now());
  }

  function isPermitExpired(permit) {
    const end = new Date(permit.endDateTime);
    return !Number.isNaN(end.getTime()) && end.getTime() <= Date.now();
  }

  function formatRemaining(permit) {
    if (isClosureTrackingPermit(permit)) return 'Stopped';
    const ms = remainingMs(permit);
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  }

  function liveTimerElements() {
    return Array.from(document.querySelectorAll('[data-countdown-permit-id]'));
  }

  function updateLiveTimers() {
    liveTimerElements().forEach((element) => {
      const permit = state.permits.find((item) => item.id === element.dataset.countdownPermitId);
      if (!permit) return;

      const closureTracked = isClosureTrackingPermit(permit);
      const expired = !closureTracked && isPermitExpired(permit);
      const remaining = formatRemaining(permit);
      const timeClass = closureTracked ? '' : expired ? 'danger' : isDueWithin(permit, 1) ? 'danger' : isDueWithin(permit, 2) ? 'warning' : '';

      if (element.dataset.countdownValue === 'true') {
        element.textContent = remaining;
        element.classList.toggle('danger', timeClass === 'danger');
        element.classList.toggle('warning', timeClass === 'warning');
      }

      if (element.dataset.countdownBox === 'true') {
        element.classList.toggle('expired', expired);
        const label = element.querySelector('[data-countdown-label]');
        if (label) label.textContent = expired ? 'Window Expired' : 'Time Remaining';
        const note = element.querySelector('[data-countdown-expired-note]');
        if (note) note.hidden = !expired;
      }
    });

    document.querySelectorAll('[data-progress-permit-id]').forEach((bar) => {
      const permit = state.permits.find((item) => item.id === bar.dataset.progressPermitId);
      if (!permit) return;
      bar.style.width = `${remainingProgress(permit)}%`;
      const wrapper = bar.closest('.validity-bar');
      if (wrapper) {
        const closureTracked = isClosureTrackingPermit(permit);
        const expired = !closureTracked && isPermitExpired(permit);
        wrapper.classList.toggle('danger', expired || isDueWithin(permit, 1));
        wrapper.classList.toggle('warning', !expired && !isDueWithin(permit, 1) && isDueWithin(permit, 2));
      }
    });

    const permit = state.permits.find((item) => item.id === state.reviewPermitId);
    const releaseButton = document.querySelector('[data-live-release-button="true"]');
    if (permit && releaseButton && permit.status === 'approved' && isPermitExpired(permit)) {
      releaseButton.disabled = true;
      releaseButton.textContent = 'Expired';
      releaseButton.title = 'Permit window expired. Return/reschedule or approve an extension before release.';
    }
  }

  function remainingProgress(permit) {
    if (isClosureTrackingPermit(permit)) return 0;
    const start = new Date(permit.startDateTime).getTime();
    const end = new Date(permit.endDateTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 45;
    const remaining = Math.max(0, end - Date.now());
    return Math.max(4, Math.min(100, (remaining / (end - start)) * 100));
  }

  function commandPermits() {
    const commandStatuses = new Set(['stage1_complete', 'approved', 'active', 'rejected']);
    return state.permits.filter((permit) => !permit.isEmergency && commandStatuses.has(permit.status));
  }

  function applySearch(permits) {
    const term = elements.searchInput.value.trim().toLowerCase();
    if (!term) return permits;

    return permits.filter((permit) => {
      const haystack = [
        displayPermitId(permit),
        permit.id,
        cleanTitle(permit),
        extractPermitType(permit),
        permit.location,
        permit.requestedBy,
        permit.status,
        ...(permit.hazards || []),
        ...(permit.assignedWorkers || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  function filteredPermits() {
    const filtered = applySearch(commandPermits())
      .filter((permit) => state.activeFilter === 'all' || permit.status === state.activeFilter);

    return sortPermitsForAction(filtered);
  }

  function sortPermitsForAction(permits) {
    return [...permits].sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || a.startDateTime || a.endDateTime) || 0;
      const bTime = Date.parse(b.updatedAt || b.createdAt || b.startDateTime || b.endDateTime) || 0;
      if (bTime !== aTime) return bTime - aTime;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  function iconForWorkType(type) {
    const lower = String(type || '').toLowerCase();
    if (lower.includes('hot') || lower.includes('weld')) return { symbol: 'H', className: 'hot' };
    if (lower.includes('electrical') || lower.includes('isolation')) return { symbol: 'E', className: 'electrical' };
    if (lower.includes('height') || lower.includes('wah')) return { symbol: 'I', className: 'height' };
    if (lower.includes('chemical')) return { symbol: 'C', className: 'chemical' };
    if (lower.includes('confined')) return { symbol: 'C', className: 'confined' };
    return { symbol: 'P', className: '' };
  }

  function classifyRisk(permit) {
    const source = [
      extractPermitType(permit),
      cleanTitle(permit),
      ...(permit.hazards || []),
    ].join(' ').toLowerCase();

    if (source.includes('hot') || source.includes('weld') || source.includes('confined')) {
      return { label: 'Critical Risk', className: 'critical' };
    }
    if (source.includes('height') || source.includes('electrical') || source.includes('isolation')) {
      return { label: 'High Risk', className: 'high' };
    }
    if ((permit.hazards || []).length > 1) {
      return { label: 'Medium Risk', className: 'medium' };
    }
    return { label: 'Low Risk', className: 'low' };
  }

  function updateMetrics() {
    const pending = metricPages.pending.getPermits();
    const approved = metricPages.approved.getPermits();
    const active = metricPages.active.getPermits();
    const expiring = metricPages.expiring.getPermits();
    const today = pending.filter((permit) => isToday(permit.createdAt || permit.updatedAt || permit.startDateTime));
    const liveTeams = active.reduce(
      (total, permit) => total + Math.max(1, (permit.assignedWorkers || []).length),
      0,
    );

    elements.pendingApprovals.textContent = pending.length;
    elements.approvedPermits.textContent = approved.length;
    elements.activeWork.textContent = active.length;
    elements.liveTeams.textContent = `${liveTeams} Live Teams`;
    elements.expiringPermits.textContent = String(expiring.length).padStart(2, '0');
    elements.todayDelta.textContent = `+${today.length} today`;

    setMeter(elements.pendingMeter, pending.length, 12);
    setMeter(elements.approvedMeter, approved.length, 48);
    setMeter(elements.activeMeter, active.length, 34);
    setMeter(elements.expiringMeter, expiring.length, 7);
  }

  function setMeter(element, value, reference) {
    const percentage = reference > 0 ? Math.max(8, Math.min(100, (value / reference) * 100)) : 8;
    element.style.width = `${percentage}%`;
  }

  function renderQueue() {
    const permits = filteredPermits();
    const totalPages = Math.max(1, Math.ceil(permits.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);

    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = permits.slice(start, start + PAGE_SIZE);

    elements.queueBody.innerHTML = pageItems.length
      ? pageItems.map(renderQueueRow).join('')
      : `
        <div class="empty-state">
          <div>
            <strong>No permits routed to Supervisor yet</strong>
            <span>Permits appear here after Admin submission and Safety Officer verification.</span>
          </div>
        </div>
      `;

    elements.queueSummary.textContent = `Showing ${pageItems.length} of ${permits.length} permits`;
    elements.prevPage.disabled = state.page === 1;
    elements.nextPage.disabled = state.page === totalPages;
    elements.pageNumbers.forEach((button) => {
      const pageNumber = Number(button.dataset.page);
      button.classList.toggle('active', pageNumber === state.page);
      button.hidden = pageNumber > totalPages && pageNumber !== 1;
    });

    elements.queueBody.querySelectorAll('[data-review-id]').forEach((button) => {
      button.addEventListener('click', () => openPermitReview(button.dataset.reviewId, 'dashboard'));
    });
  }

  function renderQueueRow(permit) {
    const type = extractPermitType(permit);
    const icon = iconForWorkType(type);
    const status = formatQueueStatus(permit);
    return `
      <div class="queue-row">
        <div class="permit-id">#${escapeHtml(displayPermitId(permit))}</div>
        <div class="work-type">
          <span class="work-icon ${escapeHtml(icon.className)}">${escapeHtml(icon.symbol)}</span>
          <strong>${escapeHtml(type)}</strong>
        </div>
        <div class="location-text">${escapeHtml(permit.location || '-')}</div>
        <div class="date-text">${escapeHtml(formatDateTime(permit.startDateTime))}</div>
        <div><span class="status-badge ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span></div>
        <div><button class="review-button" type="button" data-review-id="${escapeHtml(permit.id)}">Review</button></div>
      </div>
    `;
  }

  function renderMetricPage() {
    const config = metricPages[state.selectedMetric] || metricPages.pending;
    const permits = sortPermitsForAction(applySearch(config.getPermits()));
    elements.listTitle.textContent = config.title;
    elements.listText.textContent = config.text;

    elements.listContent.innerHTML = permits.length
      ? permits.map((permit) => renderListPermit(permit, state.selectedMetric)).join('')
      : `
        <div class="empty-state standalone">
          <div>
            <strong>${escapeHtml(config.empty)}</strong>
            <span>No permits match the current dashboard page.</span>
          </div>
        </div>
      `;

    elements.listContent.querySelectorAll('[data-review-id]').forEach((button) => {
      button.addEventListener('click', () => openPermitReview(button.dataset.reviewId, 'list'));
    });
    elements.listContent.querySelectorAll('[data-monitoring-id]').forEach((button) => {
      button.addEventListener('click', () => setView('monitoring'));
    });
    elements.listContent.querySelectorAll('[data-work-id]').forEach((button) => {
      const permit = state.permits.find((item) => item.id === button.dataset.workId);
      if (permit) applyStatus(permit, 'active', 'Supervisor released permit for active work.');
    });
  }

  function renderListPermit(permit, metric) {
    const type = extractPermitType(permit);
    const icon = iconForWorkType(type);
    const status = formatQueueStatus(permit);
    const risk = classifyRisk(permit);
    const action = metric === 'approved'
      ? `<button class="action-button success" type="button" data-work-id="${escapeHtml(permit.id)}">Work</button>`
      : metric === 'active' || metric === 'expiring'
        ? `<button class="action-button primary" type="button" data-monitoring-id="${escapeHtml(permit.id)}">Monitor</button>`
        : '';

    return `
      <article class="work-item">
        <div class="work-item-icon ${escapeHtml(icon.className)}">${escapeHtml(icon.symbol)}</div>
        <div class="work-item-main">
          <div class="work-item-meta">
            <span>#${escapeHtml(displayPermitId(permit))}</span>
            <span class="risk-pill ${escapeHtml(risk.className)}">${escapeHtml(risk.label)}</span>
            <span class="status-badge ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
          </div>
          <h3>${escapeHtml(type)}</h3>
          <p>${escapeHtml(permit.location || 'Location pending')} | ${escapeHtml(formatDateTime(permit.startDateTime))}</p>
        </div>
        <div class="work-item-time">
          <span>Time Remaining</span>
          <strong>${escapeHtml(formatRemaining(permit))}</strong>
        </div>
        <div class="work-item-actions">
          <button class="action-button" type="button" data-review-id="${escapeHtml(permit.id)}">Review</button>
          ${action}
        </div>
      </article>
    `;
  }

  function renderMonitoring() {
    const liveActive = sortPermitsForAction(state.permits.filter(isLiveWorkPermit));
    const tracked = sortMonitoringPermits(state.permits.filter((permit) =>
      !permit.isEmergency && (permit.status === 'active' || isClosureTrackingPermit(permit)),
    ));
    const openTracked = tracked.filter((permit) => getWorkCondition(permit) !== 'closed');
    const closedTracked = tracked.filter((permit) => getWorkCondition(permit) === 'closed');
    const expiringUnderHour = liveActive.filter((permit) => isDueWithin(permit, 1));

    elements.monitoringActiveCount.textContent = liveActive.length;
    elements.monitoringCriticalCount.textContent = String(expiringUnderHour.length).padStart(2, '0');
    elements.activeExecutionCards.innerHTML = openTracked.length || closedTracked.length
      ? `${openTracked.map((permit) => renderExecutionCard(permit, 'active')).join('')}${renderClosureHistory(closedTracked)}`
      : emptyLane('No active work permits');

    wireMonitoringActions();
  }

  function renderClosureHistory(permits) {
    if (!permits.length) return '';

    return `
      <section class="closure-history" aria-label="Closure history">
        <div class="closure-history-head">
          <h4>Closure History</h4>
          <span>${permits.length} closed</span>
        </div>
        <div class="closure-history-cards">
          ${permits.map((permit) => renderExecutionCard(permit, 'active')).join('')}
        </div>
      </section>
    `;
  }

  function sortMonitoringPermits(permits) {
    const order = {
      active: 0,
      resumed: 1,
      held: 2,
      stopped: 3,
      sent_for_closure: 4,
      closed: 5,
    };

    return [...permits].sort((a, b) => {
      const aState = getWorkCondition(a);
      const bState = getWorkCondition(b);
      const stateDelta = (order[aState] ?? 9) - (order[bState] ?? 9);
      if (stateDelta !== 0) return stateDelta;
      const aTime = Date.parse(a.updatedAt || a.createdAt || a.startDateTime) || 0;
      const bTime = Date.parse(b.updatedAt || b.createdAt || b.startDateTime) || 0;
      return bTime - aTime;
    });
  }

  function emptyLane(message) {
    return `
      <div class="lane-empty">
        <strong>${escapeHtml(message)}</strong>
        <span>New permits will appear here once their workflow reaches this stage.</span>
      </div>
    `;
  }

  function renderExecutionCard(permit, stage) {
    const type = extractPermitType(permit);
    const icon = iconForWorkType(type);
    const risk = classifyRisk(permit);
    const workState = getWorkState(permit);
    const held = workState === 'held';
    const stopped = workState === 'stopped';
    const sentForClosure = workState === 'sent_for_closure';
    const closed = workState === 'closed';
    const closureTracked = sentForClosure || closed;
    const expired = !closureTracked && isPermitExpired(permit);
    const timeClass = closureTracked ? '' : expired ? 'danger' : isDueWithin(permit, 1) ? 'danger' : isDueWithin(permit, 2) ? 'warning' : '';
    const progressStyle = `width:${remainingProgress(permit)}%`;
    const actions = stage === 'approved'
      ? `
        <button class="execution-button success" type="button" data-work-id="${escapeHtml(permit.id)}">${expired ? 'Expired' : 'Work'}</button>
        <button class="execution-button" type="button" data-review-id="${escapeHtml(permit.id)}">Review</button>
      `
      : closureTracked
        ? `<button class="execution-button" type="button" data-review-id="${escapeHtml(permit.id)}">View Details</button>`
        : `
        <button class="execution-button" type="button" data-hold-id="${escapeHtml(permit.id)}">${held ? 'Held' : 'Hold'}</button>
        <button class="execution-button danger" type="button" data-stop-id="${escapeHtml(permit.id)}">${stopped ? 'Stopped' : 'Stop'}</button>
        <button class="execution-button success" type="button" data-resume-id="${escapeHtml(permit.id)}">${workState === 'active' ? 'Work' : 'Resume'}</button>
      `;

    return `
      <article class="execution-card ${held ? 'is-held' : ''} ${stopped ? 'is-stopped' : ''} ${sentForClosure ? 'is-closure' : ''} ${closed ? 'is-closed' : ''}">
        <div class="execution-card-head">
          <div>
            <span>${escapeHtml(displayPermitId(permit))}</span>
            <h4>${escapeHtml(type)}</h4>
          </div>
          <span class="execution-icon ${escapeHtml(icon.className)}">${escapeHtml(icon.symbol)}</span>
        </div>
        <div class="execution-card-body">
          <p class="location-line">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>
            <span>${escapeHtml(permit.location || 'Location pending')}</span>
          </p>
          <span class="risk-pill ${escapeHtml(risk.className)}">${escapeHtml(risk.label)}</span>
          <div class="validity-row">
            <span>${closureTracked ? 'Work Timer' : stage === 'approved' ? 'Validation Window' : 'Validity Remaining'}</span>
            <strong class="${timeClass}" data-countdown-permit-id="${escapeHtml(permit.id)}" data-countdown-value="true">${escapeHtml(formatRemaining(permit))}</strong>
          </div>
          <div class="validity-bar ${timeClass}"><span data-progress-permit-id="${escapeHtml(permit.id)}" style="${progressStyle}"></span></div>
          ${expired && stage === 'approved' ? '<div class="hold-banner danger">Permit window expired. Return for reschedule or approve an extension before release.</div>' : ''}
          <div class="work-state-line ${escapeHtml(workState)}">
            <span>Work Status</span>
            <strong>${escapeHtml(formatWorkState(workState))}</strong>
          </div>
        </div>
        <div class="execution-actions">${actions}</div>
      </article>
    `;
  }

  function renderExtensionRequests(activePermits) {
    const requests = buildExtensionRequests(activePermits);
    const waiting = requests.filter((request) => request.status === 'waiting');
    elements.extensionCount.textContent = `${waiting.length} Pending`;
    elements.extensionList.innerHTML = requests.length
      ? requests.map(renderExtensionItem).join('')
      : `
        <div class="lane-empty wide">
          <strong>No extension requests</strong>
          <span>Worker extension requests will appear here for approval or rejection.</span>
        </div>
      `;

    elements.extensionList.querySelectorAll('[data-extension-view-id]').forEach((button) => {
      button.addEventListener('click', () => openExtensionDialog(button.dataset.extensionViewId));
    });
  }

  function buildExtensionRequests(activePermits) {
    state.extensionDecisions = {
      ...normalizeExtensionRequestMap(readStoredObject(EXTENSION_STORAGE_KEY)),
      ...normalizeExtensionRequestMap(state.extensionDecisions),
    };
    const activeById = new Map(activePermits.map((permit) => [permit.id, permit]));

    return Object.entries(state.extensionDecisions)
      .map(([storageKey, decision]) => {
        const permitId = decision?.permitId || storageKey;
        const permit = activeById.get(permitId);
        if (!permit) return null;
        const requestedMinutes = Number(decision.requestedMinutes) || 60;
        const end = new Date(permit.endDateTime);
        const requestedEnd = Number.isNaN(end.getTime())
          ? '-'
          : formatDateTime(new Date(end.getTime() + requestedMinutes * 60 * 1000).toISOString());
        return {
          requestId: decision.requestId || storageKey,
          permit,
          requestedMinutes,
          requestedEnd,
          requestedAt: decision.requestedAt || '',
          status: decision.status || 'waiting',
          notes: decision.notes || '',
          reason: decision.reason || '',
          workerName: decision.workerName || '',
          workerEmail: decision.workerEmail || '',
          decidedAt: decision.decidedAt || '',
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
  }

  function renderExtensionItem(request) {
    const { permit } = request;
    const risk = classifyRisk(permit);
    return `
      <article class="extension-item">
        <div>
          <span class="permit-code">#${escapeHtml(displayPermitId(permit))}</span>
          <h4>${escapeHtml(extractPermitType(permit))}</h4>
          <p>${escapeHtml(permit.location || 'Location pending')} | Requesting ${escapeHtml(request.requestedMinutes)} minutes until ${escapeHtml(request.requestedEnd)}</p>
          <p>${escapeHtml(request.workerName || request.workerEmail || 'Worker')} - ${escapeHtml(request.reason || 'No reason supplied')}</p>
        </div>
        <div class="extension-meta">
          <span class="risk-pill ${escapeHtml(risk.className)}">${escapeHtml(risk.label)}</span>
          <span class="extension-state ${escapeHtml(request.status)}">${escapeHtml(formatExtensionStatus(request.status))}</span>
        </div>
        <div class="extension-actions">
          <button class="action-button" type="button" data-extension-view-id="${escapeHtml(request.requestId)}">View</button>
        </div>
      </article>
    `;
  }

  function formatExtensionStatus(status) {
    if (status === 'waiting') return 'Pending';
    return formatStatus(status);
  }

  function wireMonitoringActions() {
    elements.monitoringView.querySelectorAll('[data-review-id]').forEach((button) => {
      button.addEventListener('click', () => openPermitReview(button.dataset.reviewId, 'monitoring'));
    });
    elements.monitoringView.querySelectorAll('[data-work-id]').forEach((button) => {
      const permit = state.permits.find((item) => item.id === button.dataset.workId);
      if (permit) applyStatus(permit, 'active', 'Supervisor released permit for active work.');
    });
    elements.monitoringView.querySelectorAll('[data-hold-id]').forEach((button) => {
      button.addEventListener('click', () => holdPermit(button.dataset.holdId));
    });
    elements.monitoringView.querySelectorAll('[data-resume-id]').forEach((button) => {
      button.addEventListener('click', () => resumePermit(button.dataset.resumeId));
    });
    elements.monitoringView.querySelectorAll('[data-stop-id]').forEach((button) => {
      button.addEventListener('click', () => {
        stopPermit(button.dataset.stopId);
      });
    });
  }

  function getWorkState(permit) {
    return getWorkCondition(permit);
  }

  function setWorkState(permitId, stateName) {
    state.workStates[permitId] = {
      state: stateName,
      updatedAt: new Date().toISOString(),
    };
    persistStoredObject(WORK_STATE_STORAGE_KEY, state.workStates);
  }

  function formatWorkState(stateName) {
    if (stateName === 'held') return 'Hold';
    if (stateName === 'stopped') return 'Stop';
    if (stateName === 'resumed') return 'Resume';
    if (stateName === 'sent_for_closure' || stateName === 'final_closure') return 'Sent for Closure';
    if (stateName === 'closed') return 'Closed';
    return 'Active';
  }

  function holdPermit(permitId) {
    state.heldPermits.add(permitId);
    setWorkState(permitId, 'held');
    persistStoredSet(HELD_STORAGE_KEY, state.heldPermits);
    renderMonitoring();
    showToast('Work has been placed on hold for supervisor follow-up.');
  }

  function stopPermit(permitId) {
    state.heldPermits.delete(permitId);
    setWorkState(permitId, 'stopped');
    persistStoredSet(HELD_STORAGE_KEY, state.heldPermits);
    renderMonitoring();
    showToast('Work has been stopped and remains visible for monitoring.');
  }

  function resumePermit(permitId) {
    const wasHeld = state.heldPermits.delete(permitId);
    setWorkState(permitId, 'resumed');
    persistStoredSet(HELD_STORAGE_KEY, state.heldPermits);
    renderMonitoring();
    showToast(wasHeld ? 'Work state changed to resume.' : 'Work state is resume.');
  }

  function openExtensionDialog(requestId) {
    const request = buildExtensionRequests(metricPages.active.getPermits()).find(
      (item) => item.requestId === requestId || item.permit.id === requestId,
    );
    if (!request) return;

    const permit = request.permit;
    const risk = classifyRisk(permit);
    elements.extensionDialogContent.innerHTML = `
      <div class="extension-review-head">
        <div>
          <span class="permit-code">#${escapeHtml(displayPermitId(permit))}</span>
          <h3>Extension Request Approval</h3>
          <p>${escapeHtml(extractPermitType(permit))} | ${escapeHtml(permit.location || 'Location pending')}</p>
        </div>
        <span class="risk-pill ${escapeHtml(risk.className)}">${escapeHtml(risk.label)}</span>
      </div>
      <div class="extension-review-grid">
        ${reviewFact('Current Remaining', formatRemaining(permit))}
        ${reviewFact('Requested Extension', `${request.requestedMinutes} minutes`)}
        ${reviewFact('Requested Until', request.requestedEnd)}
        ${reviewFact('Current Decision', formatExtensionStatus(request.status))}
      </div>
      <div class="review-fact full">
        <span>Worker Reason</span>
        <strong>${escapeHtml(request.reason || 'No reason supplied')}</strong>
      </div>
      <div class="extension-checks">
        <h4>Approval Checks</h4>
        <div><span class="check-dot"></span><strong>Site supervisor confirms work remains controlled</strong></div>
        <div><span class="check-dot"></span><strong>Hazard controls stay valid for the extended window</strong></div>
        <div><span class="check-dot"></span><strong>Permit team remains competent and assigned</strong></div>
      </div>
      <label class="notes-block">
        <span>Decision Notes</span>
        <textarea id="extensionDecisionNotes" placeholder="Enter extension approval or rejection notes...">${escapeHtml(request.notes)}</textarea>
      </label>
      ${
        request.status === 'waiting'
          ? `
            <div class="dialog-actions">
              <button class="dialog-action secondary" type="button" data-extension-dialog-decision="rejected">Reject Extension</button>
              <button class="dialog-action" type="button" data-extension-dialog-decision="approved">Approve Extension</button>
            </div>
          `
          : `<div class="decision-note">${escapeHtml(formatExtensionStatus(request.status))} on ${escapeHtml(formatDateTime(request.decidedAt || request.requestedAt))}</div>`
      }
    `;

    elements.extensionDialogContent.querySelectorAll('[data-extension-dialog-decision]').forEach((button) => {
      button.addEventListener('click', () => applyExtensionDecision(request, button.dataset.extensionDialogDecision));
    });

    if (typeof elements.extensionDialog.showModal === 'function') {
      elements.extensionDialog.showModal();
    } else {
      elements.extensionDialog.setAttribute('open', '');
    }
  }

  function reviewFact(label, value) {
    return `
      <div class="review-fact">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  async function applyExtensionDecision(request, status) {
    if (request.status !== 'waiting') {
      showToast(`This extension is already ${formatExtensionStatus(request.status).toLowerCase()}.`);
      return;
    }

    const notes = elements.extensionDialogContent.querySelector('#extensionDecisionNotes')?.value.trim() || '';
    if (status === 'rejected' && !notes) {
      showToast('Please add a reason before rejecting the extension.');
      return;
    }

    const permit = request.permit;
    elements.extensionDialogContent
      .querySelectorAll('[data-extension-dialog-decision]')
      .forEach((button) => {
        button.setAttribute('disabled', 'disabled');
      });

    try {
      const result = await apiRequest(`/api/extension-requests/${encodeURIComponent(request.requestId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      });
      const savedRequest = normalizeExtensionRequest(result.request || result);
      state.extensionDecisions[savedRequest.requestId] = savedRequest;
      persistStoredObject(EXTENSION_STORAGE_KEY, state.extensionDecisions);
      closeExtensionDialog();
      await refreshData();
      showToast(`${displayPermitId(permit)} extension ${status}.`);
    } catch (error) {
      if (error.status === 404) {
        state.extensionDecisions[request.requestId] = {
          ...state.extensionDecisions[request.requestId],
          requestId: request.requestId,
          permitId: permit.id,
          status,
          notes,
          requestedMinutes: Number(request.requestedMinutes) || 60,
          requestedAt: request.requestedAt || new Date().toISOString(),
          decidedAt: new Date().toISOString(),
        };
        persistStoredObject(EXTENSION_STORAGE_KEY, state.extensionDecisions);
        closeExtensionDialog();
        renderExtensionRequests(metricPages.active.getPermits());
        showToast(`${displayPermitId(permit)} extension ${status}.`);
        return;
      }

      showToast(error.error || error.message || 'Unable to update extension request.');
      elements.extensionDialogContent
        .querySelectorAll('[data-extension-dialog-decision]')
        .forEach((button) => {
          button.removeAttribute('disabled');
        });
    }
  }

  function closeExtensionDialog() {
    if (typeof elements.extensionDialog.close === 'function') {
      elements.extensionDialog.close();
    } else {
      elements.extensionDialog.removeAttribute('open');
    }
  }

  function openPermitReview(permitId, returnView) {
    state.reviewPermitId = permitId;
    state.reviewReturnView = returnView || state.activeView || 'dashboard';
    setView('review');
  }

  function renderPermitReview() {
    const permit = state.permits.find((item) => item.id === state.reviewPermitId);
    if (!permit) {
      elements.permitReviewContent.innerHTML = `
        <div class="empty-state standalone">
          <div>
            <strong>Permit not found</strong>
            <span>The selected permit is no longer available.</span>
          </div>
        </div>
      `;
      return;
    }

    const risk = classifyRisk(permit);
    const status = formatQueueStatus(permit);
    const expired = isPermitExpired(permit);
    const decisionCopy = permit.status === 'stage1_complete'
      ? `Permit Approval review for #${escapeHtml(displayPermitId(permit))}.`
      : expired && permit.status === 'approved'
        ? `Permit window expired for #${escapeHtml(displayPermitId(permit))}. Return/reschedule or approve an extension before release.`
        : `Work release verification for #${escapeHtml(displayPermitId(permit))}.`;
    elements.permitReviewContent.innerHTML = `
      <article class="permit-hero">
        <div>
          <div class="hero-badges">
            <span class="permit-chip">#${escapeHtml(displayPermitId(permit))}</span>
            <span class="risk-banner ${escapeHtml(risk.className)}">${escapeHtml(risk.label)}</span>
          </div>
          <h1>${escapeHtml(cleanTitle(permit))}</h1>
          <div class="hero-meta">
            <span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>
              ${escapeHtml(permit.location || 'Location pending')}
            </span>
            <span class="status-line">Status: ${escapeHtml(status.label)}</span>
          </div>
        </div>
        <div class="time-box ${expired ? 'expired' : ''}" data-countdown-permit-id="${escapeHtml(permit.id)}" data-countdown-box="true">
          <span data-countdown-label>${expired ? 'Window Expired' : 'Time Remaining'}</span>
          <strong data-countdown-permit-id="${escapeHtml(permit.id)}" data-countdown-value="true">${escapeHtml(formatRemaining(permit))}</strong>
          <em data-countdown-expired-note ${expired ? '' : 'hidden'}>Release blocked</em>
        </div>
      </article>

      ${renderPermitStatusRoute(permit)}

      <div class="review-layout">
        <div class="review-main">
          <section class="review-panel">
            <h2>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 17h2v-6h-2v6Zm1-14a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm-1-10h2V7h-2v2Z"/></svg>
              Work Information
            </h2>
            <div class="section-rule"></div>
            <span class="section-label">Detailed Description</span>
            <p class="description-text">${escapeHtml(cleanDescription(permit))}</p>
            ${renderDigitalEvidence(permit)}
            ${renderSupportingDocuments(permit)}
          </section>

          ${permit.status === 'stage1_complete' ? renderPermitApprovalValidation(permit) : ''}

          <section class="review-panel">
            <h2>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 13c-3 0-5 1.5-5 3.6V19h10v-2.4C12 14.5 10 13 7 13Zm10 0c-1.1 0-2.1.2-2.9.6A4 4 0 0 1 16 17v2h6v-2.4c0-2.1-2-3.6-5-3.6Z"/></svg>
              Team Competency & Assignment
            </h2>
            <div class="section-rule"></div>
            <div class="team-grid">
              ${renderTeamRows(permit)}
            </div>
          </section>
        </div>

        <aside class="review-side">
          <section class="review-panel compact">
            <h2>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5V3Zm2 2v14h10V5H7Zm2 4 1.4-1.4 1.6 1.6 3.6-3.6L17 7l-5 5-3-3Zm0 6h6v2H9v-2Z"/></svg>
              Prerequisites
            </h2>
            <div class="section-rule"></div>
            ${renderPrerequisites(permit)}
          </section>

          <section class="review-panel compact">
            <h2>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v13H7l-3 3V4Zm2 2v9.2L6.2 15H18V6H6Zm2 2h8v2H8V8Zm0 4h6v2H8v-2Z"/></svg>
              Decision Notes
            </h2>
            <div class="section-rule"></div>
            <textarea class="decision-notes" id="decisionNotes" placeholder="Enter comments or reason for return/rejection..."></textarea>
            <p>Notes are mandatory for rejection or return.</p>
          </section>
        </aside>
      </div>

      <div class="review-decision-bar">
        <div class="certify-copy">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm0 2.2 6 2.2V11c0 3.8-2.4 7.4-6 8.8A9.7 9.7 0 0 1 6 11V6.4l6-2.2Z"/></svg>
          <span>${decisionCopy}</span>
        </div>
        <div class="decision-actions">
          ${renderReviewActions(permit)}
        </div>
      </div>
    `;

    elements.permitReviewContent.querySelectorAll('[data-decision]').forEach((button) => {
      button.addEventListener('click', () => applyStatusFromReview(permit, button.dataset.decision));
    });
    elements.permitReviewContent.querySelectorAll('[data-site-checklist]').forEach((button) => {
      button.addEventListener('click', () => openSiteChecklistDialog(permit, button.dataset.siteChecklist));
    });
    elements.permitReviewContent.querySelector('[data-mos-jsa-export]')?.addEventListener('click', (event) => {
      event.preventDefault();
      downloadMosJsaExcel(permit).catch((error) => {
        showToast(error.error || error.message || 'Unable to export MOS/JSA Excel.');
      });
    });
    elements.permitReviewContent.querySelectorAll('[data-document-download]').forEach((button) => {
      button.addEventListener('click', () => downloadPermitDocument(permit, button.dataset.documentDownload));
    });
    elements.permitReviewContent.querySelectorAll('[data-toast]').forEach((button) => {
      button.addEventListener('click', () => showToast(button.dataset.toast));
    });
  }

  function renderPermitStatusRoute(permit) {
    const stages = [
      ['Requester Submit', 'Create permit package'],
      ['Admin Review', 'Completeness check'],
      ['Safety Officer', 'MOS / permit approval'],
      ['Supervisor Final', 'Release work'],
      ['Worker Active', 'Controlled execution'],
    ];
    const { currentIndex, blocked } = getPermitRouteState(permit);
    const status = formatQueueStatus(permit);

    return `
      <section class="permit-route" aria-label="Permit status route">
        <div class="permit-route-head">
          <div>
            <span>Permit status route</span>
            <strong>${escapeHtml(status.label)}</strong>
          </div>
          <small>${escapeHtml(displayPermitId(permit))}</small>
        </div>
        <ol class="permit-route-steps">
          ${stages.map(([label, note], index) => {
            const classes = [
              'permit-route-step',
              index < currentIndex ? 'is-done' : '',
              index === currentIndex ? (blocked ? 'is-blocked' : 'is-current') : '',
            ].filter(Boolean).join(' ');
            return `
              <li class="${classes}">
                <i class="permit-route-dot">${index + 1}</i>
                <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note)}</small></span>
              </li>
            `;
          }).join('')}
        </ol>
      </section>
    `;
  }

  function getPermitRouteState(permit) {
    const status = String(permit.status || 'draft').toLowerCase();
    if (status === 'rejected' || status === 'cancelled') return { currentIndex: 1, blocked: true };
    if (status === 'submitted' || status === 'resubmitted' || status === 'stage1_complete') return { currentIndex: 2, blocked: false };
    if (status === 'approved') return { currentIndex: 3, blocked: false };
    if (status === 'active' || status === 'closed') return { currentIndex: 4, blocked: false };
    return { currentIndex: 1, blocked: false };
  }

  function normalizeStructuredData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    return Object.entries(value).reduce((normalized, [key, rawValue]) => {
      const cleanKey = String(key || '').trim();
      if (!cleanKey) return normalized;

      if (Array.isArray(rawValue)) {
        const items = rawValue.map((item) => String(item || '').trim()).filter(Boolean);
        if (items.length) normalized[cleanKey] = items.join('\n');
        return normalized;
      }

      const cleanValue = String(rawValue || '').trim();
      if (cleanValue) normalized[cleanKey] = cleanValue;
      return normalized;
    }, {});
  }

  function getStructuredDocument(permit, type) {
    return (permit.documents || []).find((document) => {
      const documentType = String(document?.type || '').trim().toUpperCase();
      const structuredData = normalizeStructuredData(document?.structuredData);
      return documentType === type && Object.keys(structuredData).length;
    }) || null;
  }

  function renderDigitalEvidence(permit) {
    const documents = ['MOS', 'JSA']
      .map((type) => getStructuredDocument(permit, type))
      .filter(Boolean);

    if (!documents.length) {
      return `
        <div class="digital-evidence-empty">
          <strong>MOS / JSA Digital Evidence</strong>
          <span>No MOS/JSA digital form data is available.</span>
        </div>
      `;
    }

    return `
      <section class="digital-evidence-section">
        <div class="digital-evidence-title">
          <span>MOS / JSA Digital Evidence</span>
          <button class="outline-button compact" type="button" data-mos-jsa-export="${escapeHtml(permit.id)}">Export Excel</button>
        </div>
        <div class="digital-evidence-grid">
          ${documents.map((document) => renderStructuredDocument(document)).join('')}
        </div>
      </section>
    `;
  }

  function renderStructuredDocument(document) {
    const type = String(document.type || '').trim().toUpperCase();
    const schema = digitalDocumentLabels[type] || { title: `${type} Digital Form`, fields: {} };
    const data = normalizeStructuredData(document.structuredData);
    const knownRows = Object.entries(schema.fields)
      .map(([key, label]) => [label, data[key]])
      .filter(([, value]) => value);
    const extraRows = Object.entries(data)
      .filter(([key]) => !schema.fields[key])
      .map(([key, value]) => [formatFieldLabel(key), value]);

    return `
      <article class="digital-evidence-card">
        <div class="digital-evidence-head">
          <strong>${escapeHtml(schema.title)}</strong>
          <span>${escapeHtml(document.source === 'mos-jsa-digital-form' ? 'Digital form' : document.source || 'Structured data')}</span>
        </div>
        <dl>
          ${[...knownRows, ...extraRows]
            .map(
              ([label, value]) => `
                <div>
                  <dt>${escapeHtml(label)}</dt>
                  <dd>${escapeHtml(value)}</dd>
                </div>
              `,
            )
            .join('')}
        </dl>
      </article>
    `;
  }

  function formatFieldLabel(key) {
    return String(key || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function renderSupportingDocuments(permit) {
    const rows = renderDocumentRows(permit);
    if (!rows) return '';

    return `
      <div class="info-box supporting-documents">
        <span>Supporting Files</span>
        <div class="document-list">${rows}</div>
      </div>
    `;
  }

  function renderDocumentRows(permit) {
    const documents = (permit.documents || []).filter((document) => document.id && document.hasAttachment);
    if (!documents.length) return '';

    return documents.map((document) => {
      const name = document.fileName || document.name || document.type || 'Permit Document';
      return `
        <button class="document-row" type="button" data-document-download="${escapeHtml(document.id)}">
          <span class="pdf-icon">PDF</span>
          <strong>${escapeHtml(name)}</strong>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v8l3-3 1.4 1.4L12 15.8l-5.4-5.4L8 9l3 3V4ZM5 18h14v2H5v-2Z"/></svg>
        </button>
      `;
    }).join('');
  }

  function renderPermitApprovalValidation(permit) {
    const checklists = getSiteValidationChecklists(permit);
    const completedCount = checklists.filter((checklist) => isSiteChecklistComplete(permit.id, checklist)).length;
    return `
      <section class="review-panel">
        <h2>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5V3Zm2 2v14h10V5H7Zm2 4 1.4-1.4 1.6 1.6 3.6-3.6L17 7l-5 5-3-3Zm0 6h6v2H9v-2Z"/></svg>
          Permit Approval Site Validation
        </h2>
        <div class="section-rule"></div>
        <div class="site-validation-grid">
          <label>
            <span>Actual work date</span>
            <input type="date" value="${escapeHtml(formatDateInput(permit.startDateTime))}">
          </label>
          <label>
            <span>Actual location</span>
            <input type="text" value="${escapeHtml(permit.location || '')}">
          </label>
          <label class="wide">
            <span>Attendance</span>
            <input type="text" value="${escapeHtml((permit.assignedWorkers || []).join(', '))}">
          </label>
        </div>
        <div class="site-validation-summary">
          <strong>${completedCount}/${checklists.length} checklists completed</strong>
          <span>Open each required checklist and verify every item before approval.</span>
        </div>
        <div class="site-checklist-grid">
          ${checklists.map((checklist) => siteChecklistCard(permit.id, checklist)).join('')}
        </div>
      </section>
    `;
  }

  function siteChecklistCard(permitId, checklist) {
    const completed = isSiteChecklistComplete(permitId, checklist);
    const checkedCount = getCheckedSiteChecklistCount(permitId, checklist);
    return `
      <button class="site-checklist-card ${completed ? 'complete' : ''}" type="button" data-site-checklist="${escapeHtml(checklist.key)}">
        <span>
          <strong>${escapeHtml(checklist.title)}</strong>
          <em>${escapeHtml(checklist.summary)}</em>
        </span>
        <b>
          <small>${completed ? 'Review' : 'Open'}</small>
          ${completed ? 'Complete' : `${checkedCount}/${checklist.items.length}`}
        </b>
      </button>
    `;
  }

  function getSiteValidationChecklists(permit) {
    const text = getPermitValidationText(permit);
    const checklists = [
      {
        key: 'work-readiness',
        title: 'Work Readiness',
        summary: 'Date, location, attendance, TBT, and nearby activity check',
        items: [
          'Actual work date matches approved permit window',
          'Actual work location matches the permit location',
          'All assigned workers are present and fit for work',
          'Toolbox talk completed for today before work starts',
          'Nearby simultaneous work checked for conflict',
        ],
      },
      {
        key: 'ppe',
        title: 'PPE',
        summary: 'Required PPE is available, worn, and fit for use',
        items: buildPpeChecklistItems(permit),
      },
    ];

    if (/hot\s*work|welding|cutting|grinding|spark|flame/i.test(text)) {
      checklists.push({
        key: 'hot-work',
        title: 'Hot Work',
        summary: 'Fire prevention, gas test, fire watch, and spark control',
        items: [
          'Combustible materials removed or protected from the hot work area',
          'Fire extinguisher or hose reel available at the work front',
          'Fire watch assigned and briefed on stop-work authority',
          'Gas test completed and reading is within safe limit',
          'Drains, vents, openings, and lower levels protected from sparks',
          'Hot work equipment, cables, and hoses inspected before use',
        ],
      });
    }

    if (/loto|lock\s*out|tag\s*out|isolation|isolat|electrical|energ/i.test(text)) {
      checklists.push({
        key: 'loto',
        title: 'LOTO / Isolation',
        summary: 'Energy sources isolated, locked, tagged, and verified',
        items: [
          'All energy sources and isolation points identified',
          'Lock and tag applied by authorized person',
          'Stored energy released, drained, discharged, or restrained',
          'Zero-energy verification completed before work starts',
          'Try-start or test-before-touch completed where applicable',
          'Isolation register or LOTO record matches the work scope',
        ],
      });
    }

    if (/confined\s*space|tank|vessel|manhole|pit/i.test(text)) {
      checklists.push({
        key: 'confined-space',
        title: 'Confined Space',
        summary: 'Entry control, gas test, ventilation, standby, and rescue',
        items: [
          'Entry point controlled and entrant list ready',
          'Gas test completed for oxygen, flammable gas, and toxic gas',
          'Ventilation running and suitable for the space',
          'Standby person assigned outside the space',
          'Rescue equipment and emergency response route ready',
          'Communication method between entrant and standby confirmed',
        ],
      });
    }

    if (/height|scaffold|ladder|roof|harness|lanyard/i.test(text)) {
      checklists.push({
        key: 'work-at-height',
        title: 'Work at Height',
        summary: 'Access, fall protection, anchor points, and exclusion zone',
        items: [
          'Scaffold, ladder, or access platform inspected before use',
          'Harness and lanyard inspected and worn correctly',
          'Anchor point is suitable and located above the worker where practical',
          'Tools and materials secured against falling objects',
          'Drop zone or barricade established below the work area',
          'Weather and surface conditions are safe for height work',
        ],
      });
    }

    if (/chemical|solvent|acid|alkali|sds|spill/i.test(text)) {
      checklists.push({
        key: 'chemical',
        title: 'Chemical Controls',
        summary: 'SDS, handling controls, spill response, and chemical PPE',
        items: [
          'SDS available and reviewed by the work team',
          'Chemical containers labelled and compatible with the work',
          'Spill kit, eyewash, or emergency shower available as required',
          'Chemical-resistant PPE selected and inspected',
          'Ventilation or containment controls ready before handling',
          'Waste and contaminated material disposal method confirmed',
        ],
      });
    }

    if (/lifting|crane|hoist|rigging|sling|forklift/i.test(text)) {
      checklists.push({
        key: 'lifting',
        title: 'Lifting',
        summary: 'Lifting plan, rigging, exclusion zone, and communication',
        items: [
          'Lifting plan or method confirmed for the load',
          'Crane, hoist, forklift, or lifting device inspected',
          'Slings, shackles, hooks, and lifting accessories certified and inspected',
          'Load weight and lifting points confirmed',
          'Exclusion zone established and controlled',
          'Signal person or communication method confirmed',
        ],
      });
    }

    return checklists;
  }

  function buildPpeChecklistItems(permit) {
    const ppe = Array.isArray(permit.ppe) ? permit.ppe.map((item) => String(item || '').trim()).filter(Boolean) : [];
    const listedPpe = ppe.length ? ppe : ['Required PPE'];
    return [
      ...listedPpe.map((item) => `${item} available, worn, and fit for use`),
      'Damaged or expired PPE removed from use',
      'PPE matches the work method and site conditions',
    ];
  }

  function getPermitValidationText(permit) {
    const documentData = (permit.documents || [])
      .map((document) => Object.values(normalizeStructuredData(document.structuredData || {})).join(' '))
      .join(' ');
    return [
      permit.title,
      permit.workType,
      permit.description,
      ...(permit.hazards || []),
      ...(permit.controls || []),
      ...(permit.ppe || []),
      documentData,
    ].join(' ');
  }

  function getSiteChecklistState(permitId, checklistKey) {
    const permit = state.permits.find((item) => item.id === permitId);
    return state.siteValidationChecklists?.[permitId]?.[checklistKey] || permit?.siteValidation?.[checklistKey] || { checked: {}, notes: '' };
  }

  function updatePermitSiteValidationState(permitId, siteValidation) {
    state.permits = state.permits.map((permit) =>
      permit.id === permitId ? { ...permit, siteValidation } : permit,
    );
  }

  async function saveSiteValidationToServer(permit, siteValidation = state.siteValidationChecklists[permit.id] || {}) {
    const result = await apiRequest(`/api/permits/${encodeURIComponent(permit.id)}/site-validation`, {
      method: 'PATCH',
      body: JSON.stringify({ siteValidation }),
    });
    const normalizedPermit = normalizePermit(result.permit || { ...permit, siteValidation: result.siteValidation || siteValidation });
    state.siteValidationChecklists[permit.id] = normalizedPermit.siteValidation || result.siteValidation || siteValidation;
    updatePermitSiteValidationState(permit.id, state.siteValidationChecklists[permit.id]);
    persistStoredObject(SITE_VALIDATION_STORAGE_KEY, state.siteValidationChecklists);
    return normalizedPermit;
  }

  function getCheckedSiteChecklistCount(permitId, checklist) {
    const checklistState = getSiteChecklistState(permitId, checklist.key);
    return checklist.items.filter((item) => checklistState.checked?.[checklistItemId(item)]).length;
  }

  function isSiteChecklistComplete(permitId, checklist) {
    return checklist.items.length > 0 && getCheckedSiteChecklistCount(permitId, checklist) === checklist.items.length;
  }

  function checklistItemId(item) {
    return String(item || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function ensureSiteChecklistDialog() {
    if (elements.siteChecklistDialog && elements.siteChecklistDialogContent) return true;

    document.body.insertAdjacentHTML(
      'beforeend',
      `
        <dialog class="site-checklist-dialog" id="siteChecklistDialog">
          <form method="dialog">
            <button class="dialog-close" value="cancel" aria-label="Close site validation checklist">x</button>
          </form>
          <div class="site-checklist-dialog-content" id="siteChecklistDialogContent"></div>
        </dialog>
      `,
    );
    elements.siteChecklistDialog = document.querySelector('#siteChecklistDialog');
    elements.siteChecklistDialogContent = document.querySelector('#siteChecklistDialogContent');
    return Boolean(elements.siteChecklistDialog && elements.siteChecklistDialogContent);
  }

  function openSiteChecklistDialog(permit, checklistKey) {
    const checklist = getSiteValidationChecklists(permit).find((item) => item.key === checklistKey);
    if (!checklist || !ensureSiteChecklistDialog()) {
      showToast('Unable to open checklist popup. Refresh the page and try again.');
      return;
    }

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const checklistState = getSiteChecklistState(permit.id, checklist.key);
    elements.siteChecklistDialogContent.innerHTML = `
      <div class="site-dialog-head">
        <div>
          <span class="permit-code">#${escapeHtml(displayPermitId(permit))}</span>
          <h3>${escapeHtml(checklist.title)} Checklist</h3>
          <p>${escapeHtml(checklist.summary)}</p>
        </div>
        <span class="risk-pill ${isSiteChecklistComplete(permit.id, checklist) ? 'low' : 'medium'}">
          ${escapeHtml(`${getCheckedSiteChecklistCount(permit.id, checklist)}/${checklist.items.length}`)}
        </span>
      </div>
      <div class="site-dialog-list">
        ${checklist.items.map((item) => {
          const itemId = checklistItemId(item);
          return `
            <label>
              <input type="checkbox" data-site-check-item="${escapeHtml(itemId)}" ${checklistState.checked?.[itemId] ? 'checked' : ''}>
              <span>${escapeHtml(item)}</span>
            </label>
          `;
        }).join('')}
      </div>
      <label class="site-dialog-notes">
        <span>Site notes</span>
        <textarea id="siteChecklistNotes" placeholder="Optional validation notes">${escapeHtml(checklistState.notes || '')}</textarea>
      </label>
      <div class="dialog-actions">
        <button class="dialog-action secondary" type="button" data-site-checklist-close>Cancel</button>
        <button class="dialog-action" type="button" data-site-checklist-save="${escapeHtml(checklist.key)}">Save Checklist</button>
      </div>
    `;

    elements.siteChecklistDialogContent
      .querySelector('[data-site-checklist-close]')
      ?.addEventListener('click', closeSiteChecklistDialog);
    elements.siteChecklistDialogContent
      .querySelector('[data-site-checklist-save]')
      ?.addEventListener('click', () => {
        saveSiteChecklist(permit, checklist).catch((error) => {
          showToast(error.error || error.message || 'Unable to save checklist notes.');
        });
      });

    try {
      if (typeof elements.siteChecklistDialog.showModal === 'function' && !elements.siteChecklistDialog.open) {
        elements.siteChecklistDialog.showModal();
      } else {
        elements.siteChecklistDialog.setAttribute('open', '');
      }
    } catch {
      elements.siteChecklistDialog.setAttribute('open', '');
    }
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
  }

  async function saveSiteChecklist(permit, checklist) {
    const checked = {};
    elements.siteChecklistDialogContent
      .querySelectorAll('[data-site-check-item]')
      .forEach((input) => {
        checked[input.dataset.siteCheckItem] = input.checked;
      });

    const missing = checklist.items.filter((item) => !checked[checklistItemId(item)]);
    if (missing.length) {
      showToast(`Complete all ${checklist.title} checks before saving.`);
      return;
    }

    state.siteValidationChecklists[permit.id] = {
      ...(state.siteValidationChecklists[permit.id] || {}),
      [checklist.key]: {
        checked,
        notes: elements.siteChecklistDialogContent.querySelector('#siteChecklistNotes')?.value.trim() || '',
        updatedAt: new Date().toISOString(),
      },
    };
    updatePermitSiteValidationState(permit.id, state.siteValidationChecklists[permit.id]);
    persistStoredObject(SITE_VALIDATION_STORAGE_KEY, state.siteValidationChecklists);
    await saveSiteValidationToServer(permit);
    closeSiteChecklistDialog();
    renderPermitReview();
    showToast(`${checklist.title} checklist completed.`);
  }

  function closeSiteChecklistDialog() {
    if (typeof elements.siteChecklistDialog?.close === 'function') {
      elements.siteChecklistDialog.close();
    } else {
      elements.siteChecklistDialog?.removeAttribute('open');
    }
  }

  function formatDateInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  function renderTeamRows(permit) {
    const assigned = permit.assignedWorkers.length ? permit.assignedWorkers : ['John Doe', 'Mike Smith'];
    return assigned.slice(0, 6).map((workerId) => {
      const worker = resolveWorker(workerId);
      const name = worker?.name || worker?.fullName || workerId;
      const role = worker?.role || worker?.position || 'Assigned Worker';
      const status = worker?.status || 'valid';
      return `
        <div class="team-member">
          <span class="initials">${escapeHtml(initials(name))}</span>
          <div>
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(role)}</span>
          </div>
          <em class="${escapeHtml(status)}">${escapeHtml(status === 'valid' ? 'Valid' : formatStatus(status))}</em>
        </div>
      `;
    }).join('');
  }

  function resolveWorker(workerId) {
    const normalized = normalizeIdentifier(workerId);
    return state.workers.find((worker) => {
      return [worker.id, worker.employeeId, worker.name, worker.fullName, worker.email]
        .map(normalizeIdentifier)
        .includes(normalized);
    });
  }

  function normalizeIdentifier(value) {
    return String(value || '').trim().toLowerCase();
  }

  function initials(name) {
    return String(name || 'PTW')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'PT';
  }

  function renderPrerequisites(permit) {
    const checks = permit.status === 'stage1_complete'
      ? [
          ['MOS Approval', 'Safety Officer completed MOS Approval', 'Complete'],
          ['Permit Package', 'MOS/JSA digital evidence is available for review', 'Ready'],
          ['Site Validation', 'Confirm site readiness before approving Permit Approval', 'Required'],
        ]
      : [
          ['Permit Approval', 'Permit Approval completed before work release', 'Complete'],
          isPermitExpired(permit)
            ? ['Permit Window', 'Approved end time has passed. Reschedule or extend before release.', 'Expired']
            : ['Permit Window', 'Approved work window is still valid', 'Valid'],
          ['Conflict Check', 'No overlapping active activities', 'No Conflicts'],
          ['LOTO Verification', permit.controls.some((control) => /loto|isolation/i.test(control)) ? 'Isolation controls listed' : 'Not required for this scope', 'Verified'],
        ];

    return checks.map(([title, text, result]) => `
      <div class="prereq-item">
        <span class="check-dot"></span>
        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(text)}</p>
        </div>
        <em>${escapeHtml(result)}</em>
      </div>
    `).join('');
  }

  function siteValidationNoteSummary(permit) {
    const record = state.siteValidationChecklists?.[permit.id] || permit.siteValidation || {};
    const notes = getSiteValidationChecklists(permit)
      .map((checklist) => {
        const note = String(record?.[checklist.key]?.notes || '').trim();
        return note ? `${checklist.title}: ${note}` : '';
      })
      .filter(Boolean);
    return notes.length ? ` Site validation notes: ${notes.join(' | ')}.` : '';
  }

  function renderReviewActions(permit) {
    if (!['stage1_complete', 'approved', 'active'].includes(permit.status)) {
      return '<button class="decision-button primary" type="button" data-decision="cancel">Back</button>';
    }

    const approveLabel = permit.status === 'stage1_complete' ? 'Approve Permit Approval' : 'Release Work';
    const releaseExpired = permit.status === 'approved' && isPermitExpired(permit);
    return `
      <button class="decision-button" type="button" data-decision="return">Return</button>
      <button class="decision-button primary" type="button" data-decision="approve" ${permit.status === 'approved' ? 'data-live-release-button="true"' : ''} ${releaseExpired ? 'disabled title="Permit window expired. Return/reschedule or approve an extension before release."' : ''}>${releaseExpired ? 'Expired' : approveLabel}</button>
      <button class="decision-button danger" type="button" data-decision="reject">Reject</button>
    `;
  }

  function applyStatusFromReview(permit, decision) {
    if (decision === 'cancel') {
      return setView(state.reviewReturnView || 'dashboard');
    }
    const notes = elements.permitReviewContent.querySelector('#decisionNotes')?.value.trim() || '';
    const decisions = {
      return: {
        status: 'rejected',
        fallbackNote: 'Returned to requester by Supervisor.',
        requiresNote: true,
        outcome: 'returned',
      },
      reject: {
        status: 'rejected',
        fallbackNote: 'Rejected by Supervisor.',
        requiresNote: true,
        outcome: 'rejected',
      },
      approve: {
        status: permit.status === 'stage1_complete' ? 'approved' : 'active',
        fallbackNote: permit.status === 'stage1_complete'
          ? `Supervisor approved Permit Approval.${siteValidationNoteSummary(permit)}`
          : 'Supervisor final approval granted. Permit released for active work.',
        requiresNote: false,
      },
    };
    const reviewDecision = decisions[decision];

    if (!reviewDecision) return null;
    if (decision === 'approve' && permit.status === 'active') {
      showToast(`${displayPermitId(permit)} is already approved and active.`);
      return null;
    }
    if (decision === 'approve' && permit.status === 'approved' && isPermitExpired(permit)) {
      showToast('Permit window expired. Return for reschedule or approve an extension before release.');
      return null;
    }
    if (decision === 'approve' && permit.status === 'stage1_complete') {
      const incompleteChecklist = getSiteValidationChecklists(permit).find(
        (checklist) => !isSiteChecklistComplete(permit.id, checklist),
      );
      if (incompleteChecklist) {
        showToast(`Complete ${incompleteChecklist.title} checklist before Permit Approval.`);
        openSiteChecklistDialog(permit, incompleteChecklist.key);
        return null;
      }
    }
    if (reviewDecision.requiresNote && !notes) {
      showToast('Please add a reason before returning or rejecting the permit.');
      return null;
    }

    return applyStatus(permit, reviewDecision.status, notes || reviewDecision.fallbackNote, {
      outcome: reviewDecision.outcome,
    });
  }

  async function applyStatus(permit, status, note, options = {}) {
    const notes = String(note || '').trim();
    if (['rejected', 'cancelled'].includes(status) && !notes) {
      showToast('Please add a reason before rejecting or returning the permit.');
      return;
    }

    const comments = {
      approved: 'Supervisor approved Permit Approval.',
      active: 'Supervisor final approval granted. Permit released for active work.',
      closed: 'Supervisor stopped or closed active work after monitoring verification.',
      rejected: 'Returned for correction by Supervisor.',
      cancelled: 'Cancelled by Supervisor.',
    };

    try {
      await apiRequest(`/api/permits/${encodeURIComponent(permit.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          comment: notes || comments[status] || `Status changed to ${status}`,
        }),
      });
      state.heldPermits.delete(permit.id);
      if (status === 'active') {
        delete state.permitDecisions[permit.id];
        setWorkState(permit.id, 'active');
      }
      if (options.outcome) {
        state.permitDecisions[permit.id] = {
          outcome: options.outcome,
          updatedAt: new Date().toISOString(),
        };
      }
      if (status === 'closed') {
        setWorkState(permit.id, 'closed');
      }
      if (['rejected', 'cancelled'].includes(status)) {
        delete state.workStates[permit.id];
      }
      persistStoredSet(HELD_STORAGE_KEY, state.heldPermits);
      persistStoredObject(WORK_STATE_STORAGE_KEY, state.workStates);
      persistStoredObject(DECISION_STORAGE_KEY, state.permitDecisions);
      showToast(`${displayPermitId(permit)} updated to ${formatStatus(status)}.`);
      await refreshData();
      if (state.activeView === 'review') {
        setView(state.reviewReturnView || 'dashboard');
      }
    } catch (error) {
      showToast(error.error || 'Unable to update permit status.');
    }
  }

  async function downloadPermitDocument(permit, documentId) {
    try {
      const response = await fetch(`${API_BASE}/api/permits/${encodeURIComponent(permit.id)}/documents/${encodeURIComponent(documentId)}/download`, {
        headers: {
          authorization: `Bearer ${state.session.token}`,
        },
      });
      if (!response.ok) throw new Error('Document download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${displayPermitId(permit)}-document`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Unable to download this document.');
    }
  }

  async function downloadMosJsaExcel(permit) {
    const documents = ['MOS', 'JSA']
      .map((type) => getStructuredDocument(permit, type))
      .filter(Boolean);

    if (!documents.length) {
      throw new Error('No MOS/JSA digital form data available for export.');
    }

    const response = await fetch(`${API_BASE}/api/permit-document-templates/mos-jsa/export`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.session.token}`,
      },
      body: JSON.stringify({ documents }),
    });

    if (!response.ok) {
      const text = await response.text();
      let body = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { error: text };
      }
      throw body;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${displayPermitId(permit)}-MOS-JSA.xlsx`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setMetricPage(metric) {
    state.selectedMetric = metric;
    state.page = 1;
    setView('list');
  }

  function hideAllViews() {
    elements.dashboardView.classList.add('hidden');
    elements.listView.classList.add('hidden');
    elements.monitoringView.classList.add('hidden');
    elements.extensionApprovalView.classList.add('hidden');
    elements.permitReviewView.classList.add('hidden');
  }

  function renderCurrentViewSoon(view, callback) {
    if (state.activeView === view) callback();
  }

  function setView(view) {
    state.activeView = view;
    hideAllViews();
    elements.mainPanel.classList.toggle('review-mode', view === 'review');
    elements.navItems.forEach((item) => {
      const activeNav = ['monitoring', 'extensions'].includes(view) ? view : 'dashboard';
      item.classList.toggle('active', item.dataset.view === activeNav);
    });

    if (view === 'dashboard') {
      elements.pageTitle.textContent = 'Supervisor Command Center';
      elements.dashboardView.classList.remove('hidden');
      renderCurrentViewSoon(view, renderQueue);
      return;
    }

    if (view === 'list') {
      const config = metricPages[state.selectedMetric] || metricPages.pending;
      elements.pageTitle.textContent = config.title;
      elements.listView.classList.remove('hidden');
      renderCurrentViewSoon(view, renderMetricPage);
      return;
    }

    if (view === 'monitoring') {
      elements.pageTitle.textContent = 'Daily Execution';
      elements.monitoringView.classList.remove('hidden');
      renderCurrentViewSoon(view, renderMonitoring);
      return;
    }

    if (view === 'extensions') {
      elements.pageTitle.textContent = 'Extension Approval';
      elements.extensionApprovalView.classList.remove('hidden');
      renderCurrentViewSoon(view, () => {
        renderExtensionRequests(metricPages.active.getPermits());
        refreshData().catch((error) => {
          showToast(error.error || error.message || 'Unable to refresh extension requests.');
        });
      });
      return;
    }

    if (view === 'review') {
      elements.permitReviewView.classList.remove('hidden');
      renderCurrentViewSoon(view, renderPermitReview);
    }
  }

  function exportQueue() {
    const permits = filteredPermits();
    const headers = ['Permit ID', 'Work Type', 'Location', 'Requested Date', 'Status'];
    const rows = permits.map((permit) => [
      displayPermitId(permit),
      extractPermitType(permit),
      permit.location || '',
      formatDateTime(permit.startDateTime),
      formatQueueStatus(permit).label,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supervisor-approval-queue.csv';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function showToast(message) {
    document.querySelector('.toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  async function refreshData() {
    await loadData();
    updateMetrics();

    if (state.activeView === 'dashboard') {
      renderQueue();
    } else if (state.activeView === 'list') {
      renderMetricPage();
    } else if (state.activeView === 'monitoring') {
      renderMonitoring();
    } else if (state.activeView === 'extensions') {
      renderExtensionRequests(metricPages.active.getPermits());
    } else if (state.activeView === 'review') {
      renderPermitReview();
    }
  }

  function wireEvents() {
    elements.navItems.forEach((item) => {
      item.addEventListener('click', () => setView(item.dataset.view));
    });

    elements.metricCards.forEach((card) => {
      card.addEventListener('click', () => setMetricPage(card.dataset.metricView));
    });

    elements.searchInput.addEventListener('input', () => {
      state.page = 1;
      if (state.activeView === 'dashboard') renderQueue();
      else if (state.activeView === 'list') renderMetricPage();
      else if (state.activeView === 'monitoring') renderMonitoring();
      else if (state.activeView === 'extensions') renderExtensionRequests(metricPages.active.getPermits());
    });

    elements.filterButton.addEventListener('click', () => {
      elements.filterStrip.classList.toggle('hidden');
    });

    elements.filterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        state.activeFilter = chip.dataset.filter;
        state.page = 1;
        elements.filterChips.forEach((item) => item.classList.toggle('active', item === chip));
        renderQueue();
      });
    });

    elements.exportButton.addEventListener('click', exportQueue);
    elements.refreshButton.addEventListener('click', async () => {
      elements.refreshButton.classList.add('is-spinning');
      try {
        await refreshData();
        showToast('Supervisor data refreshed.');
      } finally {
        elements.refreshButton.classList.remove('is-spinning');
      }
    });
    elements.prevPage.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        renderQueue();
      }
    });
    elements.nextPage.addEventListener('click', () => {
      state.page += 1;
      renderQueue();
    });
    elements.pageNumbers.forEach((button) => {
      button.addEventListener('click', () => {
        state.page = Number(button.dataset.page);
        renderQueue();
      });
    });

    elements.listBackButton.addEventListener('click', () => setView('dashboard'));
    elements.reviewBackButton.addEventListener('click', () => setView(state.reviewReturnView || 'dashboard'));
    elements.supportButton.addEventListener('click', () => window.location.assign('/support'));
    elements.notificationButton.addEventListener('click', (event) => {
      event.stopPropagation();
      renderNotifications();
      setNotificationPanel(elements.notificationPanel?.hidden);
    });
    elements.reviewNotificationButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      renderNotifications();
      setNotificationPanel(elements.notificationPanel?.hidden);
    });
    elements.notificationCloseButton?.addEventListener('click', () => setNotificationPanel(false));
    elements.notificationList?.addEventListener('click', (event) => {
      const persistentButton = event.target.closest('[data-notification-id]');
      if (persistentButton) {
        const notificationId = persistentButton.dataset.notificationId;
        const link = persistentButton.dataset.notificationLink || '';
        apiRequest(`/api/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH' }).catch(() => {});
        state.notifications = state.notifications.map((notification) =>
          notification.id === notificationId ? { ...notification, unread: false } : notification,
        );
        renderNotifications();
        setNotificationPanel(false);
        if (link && link !== window.location.pathname) {
          window.location.assign(link);
        }
        return;
      }

      const button = event.target.closest('[data-notification-view]');
      if (!button) return;
      setView(button.dataset.notificationView);
      setNotificationPanel(false);
    });
    document.addEventListener('click', (event) => {
      if (elements.notificationPanel?.hidden) return;
      if (event.target.closest('.notification-wrap')) return;
      setNotificationPanel(false);
    });
    elements.profileButton.addEventListener('click', () => window.location.assign('/account'));
    elements.reviewProfileAvatar?.addEventListener('click', () => window.location.assign('/account'));
    elements.logoutButton?.addEventListener('click', () => {
      clearSession();
      window.location.assign('/login');
    });
  }

  async function init() {
    if (!requireSupervisorAccess()) return;
    await refreshCurrentUser();
    wireEvents();
    await refreshData();
    setView('dashboard');
    updateLiveTimers();
    setInterval(updateLiveTimers, 1000);
  }

  init().catch((error) => {
    showToast(error.error || error.message || 'Unable to load Supervisor dashboard.');
  });
});
