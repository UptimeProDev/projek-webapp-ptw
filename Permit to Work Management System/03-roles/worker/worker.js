document.addEventListener('DOMContentLoaded', () => {
  function storageScope() {
    const stored = localStorage.getItem('ptwSession') || sessionStorage.getItem('ptwSession');

    try {
      const session = stored ? JSON.parse(stored) : null;
      const user = session?.user || {};
      const rawScope =
        user.organizationId ||
        user.companyRegistrationNo ||
        user.organization ||
        'global';
      return String(rawScope)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'global';
    } catch {
      return 'global';
    }
  }

  function scopedStorageKey(key) {
    return `${key}:${storageScope()}`;
  }

  const EXTENSION_STORAGE_KEY = scopedStorageKey('ptwSupervisorWorkerExtensionRequests');
  const COMPLETION_STORAGE_KEY = scopedStorageKey('ptwWorkerCompletionRequests');
  const WORK_STATE_STORAGE_KEY = scopedStorageKey('ptwSupervisorWorkStates');

  const elements = {
    navItems: Array.from(document.querySelectorAll('.nav-item[data-view]')),
    pageTitle: document.querySelector('#pageTitle'),
    pageSubtitle: document.querySelector('#pageSubtitle'),
    profileName: document.querySelector('#profileName'),
    profileRole: document.querySelector('#profileRole'),
    profileAvatar: document.querySelector('#profileAvatar'),
    accountButton: document.querySelector('#accountButton'),
    notificationButton: document.querySelector('#notificationButton'),
    notificationPanel: document.querySelector('#notificationPanel'),
    notificationCloseButton: document.querySelector('#notificationCloseButton'),
    notificationList: document.querySelector('#notificationList'),
    notificationCount: document.querySelector('#notificationCount'),
    searchInput: document.querySelector('#searchInput'),
    refreshButton: document.querySelector('#refreshButton'),
    logoutButton: document.querySelector('#logoutButton'),
    globalStopButton: document.querySelector('#globalStopButton'),
    warning: document.querySelector('#workerWarning'),
    workspace: document.querySelector('#workerWorkspace'),
    completionSection: document.querySelector('#completionSection'),
    queueTitle: document.querySelector('#queueTitle'),
    queueHint: document.querySelector('#queueHint'),
    queueCount: document.querySelector('#queueCount'),
    queueItems: document.querySelector('#queueItems'),
    permitDetail: document.querySelector('#permitDetail'),
    logBody: document.querySelector('#logBody'),
    logCount: document.querySelector('#logCount'),
    statusLine: document.querySelector('#statusLine'),
    assignedCount: document.querySelector('#assignedCount'),
    activeCount: document.querySelector('#activeCount'),
    countdownCount: document.querySelector('#countdownCount'),
    completedCount: document.querySelector('#completedCount'),
    emergencyStrip: document.querySelector('#emergencyStrip'),
  };

  const state = {
    session: readSession(),
    permits: [],
    activeView: 'dashboard',
    detailMode: 'permit',
    selectedPermitId: null,
    notifications: [],
    logs: readStoredArray(logStorageKey()),
    extensionRequests: readStoredObject(EXTENSION_STORAGE_KEY),
    completionRequests: readStoredObject(COMPLETION_STORAGE_KEY),
    workStates: readStoredObject(WORK_STATE_STORAGE_KEY),
  };

  let countdownTimer;
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

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

  function logStorageKey() {
    const stored = localStorage.getItem('ptwSession') || sessionStorage.getItem('ptwSession');
    try {
      const session = stored ? JSON.parse(stored) : null;
      return `ptwWorkerLogs:${storageScope()}:${session?.user?.email || 'anonymous'}`;
    } catch {
      return `ptwWorkerLogs:${storageScope()}:anonymous`;
    }
  }

  function readStoredArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readStoredObject(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function persistStoredObject(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function persistLogs() {
    localStorage.setItem(logStorageKey(), JSON.stringify(state.logs.slice(0, 100)));
  }

  async function apiRequest(path, options = {}) {
    if (!state.session?.token) {
      throw new Error('Worker session required');
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

  function initials(name) {
    return String(name || 'W')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'W';
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

  function updateProfile(user) {
    const name = user?.fullName || user?.email || 'Worker';
    elements.profileName.textContent = name;
    elements.profileRole.textContent = `${user?.employeeId || user?.email || 'Worker'} - assigned work`;
    if (user?.profilePictureUrl) {
      elements.profileAvatar.innerHTML = `<img src="${escapeHtml(user.profilePictureUrl)}" alt="">`;
    } else {
      elements.profileAvatar.textContent = initials(name);
    }
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

  function workerNotificationItems() {
    const active = state.permits.filter((permit) => permit.status === 'active').length;
    const dueSoon = state.permits.filter(isDueWithinOneHour).length;
    const extensions = Object.values(state.extensionRequests || {}).length;
    return [
      {
        view: 'active',
        label: 'Active Work',
        title: `${active} active assigned permit${active === 1 ? '' : 's'}`,
        body: 'Monitor live work and close permits when work is complete.',
      },
      {
        view: 'dashboard',
        label: 'Countdown',
        title: `${dueSoon} permit${dueSoon === 1 ? '' : 's'} due within one hour`,
        body: 'Request an extension before the work window expires.',
      },
      {
        view: 'extension',
        label: 'Extensions',
        title: `${extensions} extension record${extensions === 1 ? '' : 's'}`,
        body: 'Review submitted extension requests and decisions.',
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

    const items = workerNotificationItems();
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

  function requireWorkerRole() {
    if (state.session?.user?.role === 'worker') {
      const user = state.session.user;
      elements.warning.classList.add('hidden');
      updateProfile(user);
      return true;
    }

    elements.warning.classList.remove('hidden');
    elements.workspace.classList.add('hidden');
    elements.completionSection.classList.add('hidden');
    elements.emergencyStrip.classList.add('hidden');
    setTimeout(() => window.location.assign('/login'), 700);
    return false;
  }

  async function loadData() {
    const [permitResult, extensionResult, notificationResult] = await Promise.all([
      apiRequest('/api/permits'),
      apiRequest('/api/extension-requests').catch(() => ({ requests: [] })),
      loadNotifications(),
    ]);
    state.permits = (permitResult.permits || permitResult.data || []).map(normalizePermit);
    state.notifications = notificationResult.notifications || notificationResult.data || [];
    state.extensionRequests = {
      ...normalizeExtensionRequestMap(readStoredObject(EXTENSION_STORAGE_KEY)),
      ...normalizeExtensionRequestMap(extensionResult.requests || extensionResult.data || []),
    };
    state.completionRequests = readStoredObject(COMPLETION_STORAGE_KEY);
    state.workStates = readStoredObject(WORK_STATE_STORAGE_KEY);
    renderNotifications();
  }

  async function loadNotifications() {
    try {
      return await apiRequest('/api/notifications?limit=20');
    } catch {
      return { notifications: [] };
    }
  }

  function normalizePermit(permit) {
    return {
      ...permit,
      status: String(permit.status || 'draft').toLowerCase(),
      hazards: Array.isArray(permit.hazards) ? permit.hazards : [],
      controls: Array.isArray(permit.controls) ? permit.controls : [],
      ppe: Array.isArray(permit.ppe) ? permit.ppe : [],
      approvers: Array.isArray(permit.approvers) ? permit.approvers : [],
      documents: Array.isArray(permit.documents) ? permit.documents : [],
      assignedWorkers: Array.isArray(permit.assignedWorkers) ? permit.assignedWorkers : [],
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

  function getPermitType(permit) {
    if (permit.workType) return permit.workType;
    const match = String(permit.description || '').match(/Permit Type:\s*([^\n]+)/i);
    return match ? match[1].trim() : 'Preventive Maintenance';
  }

  function extractScope(description) {
    return String(description || '')
      .split('\n')
      .filter((line) => !/^Permit Class:/i.test(line.trim()))
      .filter((line) => !/^Review Route:/i.test(line.trim()))
      .filter((line) => !/^Permit Type:/i.test(line.trim()))
      .filter((line) => !/^Assigned Worker/i.test(line.trim()))
      .filter((line) => !/^Required Documents:/i.test(line.trim()))
      .filter((line) => !/^(HIRARC|JSA|MOS|RAMS|SWP|ERP):/i.test(line.trim()))
      .join('\n')
      .trim();
  }

  function displayPermitId(permit) {
    const raw = String(permit.id || '').trim();
    if (/^PTW-/i.test(raw)) return raw.toUpperCase();
    if (/^[0-9a-f-]{20,}$/i.test(raw)) return `PTW-${raw.slice(0, 4).toUpperCase()}`;
    return raw || 'PTW';
  }

  function formatStatus(status) {
    if (status === 'approved') return 'Approved to Start';
    if (status === 'active') return 'Active';
    if (status === 'closed') return 'Completed';
    if (status === 'waiting_admin') return 'Submitted for Final Closure';
    return String(status || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatExtensionStatus(status) {
    if (status === 'waiting') return 'Pending';
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return formatStatus(status);
  }

  function statusClass(permit) {
    if (isFinalClosureSubmitted(permit)) return 'final-closure';
    if (permit.status === 'active') return getWorkState(permit);
    if (permit.status === 'approved') return 'approved';
    if (permit.status === 'closed') return 'closed';
    if (permit.status === 'rejected') return 'rejected';
    return permit.status || 'draft';
  }

  function workStatusLabel(permit) {
    if (isFinalClosureSubmitted(permit)) return 'Submitted for Final Closure';
    if (permit.status !== 'active') return formatStatus(permit.status);
    const workState = getWorkState(permit);
    if (workState === 'held') return 'Hold';
    if (workState === 'stopped') return 'Stop';
    if (workState === 'final_closure') return 'Submitted for Final Closure';
    if (workState === 'resumed') return 'Resume';
    return 'Active';
  }

  function getWorkState(permit) {
    return permit.workState || permit.work_state || state.workStates[permit.id]?.state || 'active';
  }

  function setWorkState(permit, status, note = '') {
    const updatedAt = window.PTWTime?.iso?.() || new Date().toISOString();
    state.workStates[permit.id] = {
      state: status,
      note,
      updatedAt,
      by: state.session?.user?.email || '',
    };
    permit.workState = status;
    persistStoredObject(WORK_STATE_STORAGE_KEY, state.workStates);
    apiRequest(`/api/permits/${encodeURIComponent(permit.id)}/work-state`, {
      method: 'PATCH',
      body: JSON.stringify({ workState: status, note }),
    })
      .then((result) => {
        if (!result?.permit) return;
        const updated = normalizePermit(result.permit);
        state.permits = state.permits.map((item) => (item.id === updated.id ? updated : item));
        if (state.selectedPermit?.id === updated.id) {
          state.selectedPermit = updated;
        }
      })
      .catch(() => {});
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function countdownParts(permit) {
    if (permit.status === 'closed') {
      return { value: 'CLOSED', label: 'Final closure complete', subvalue: '' };
    }

    if (isFinalClosureSubmitted(permit)) {
      return { value: 'STOPPED', label: 'Submitted for final closure', subvalue: '' };
    }

    const end = new Date(permit.endDateTime);
    if (Number.isNaN(end.getTime())) {
      return { value: '--:--:--', label: 'No end time', subvalue: '' };
    }

    const diff = end.getTime() - (window.PTWTime?.now?.() || Date.now());
    if (diff <= 0) {
      return { value: '00:00:00', label: 'Permit window expired', subvalue: '' };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const timeValue = `${String(hours).padStart(2, '0')}h:${String(minutes).padStart(2, '0')}m:${String(seconds).padStart(2, '0')}s`;

    return {
      value: timeValue,
      label: 'Permit validity remaining',
      subvalue: '',
    };
  }

  function isDueWithinOneHour(permit) {
    if (isFinalClosureSubmitted(permit)) return false;
    const end = new Date(permit.endDateTime);
    if (Number.isNaN(end.getTime())) return false;
    const diff = end.getTime() - (window.PTWTime?.now?.() || Date.now());
    return diff > 0 && diff <= 60 * 60 * 1000 && permit.status === 'active';
  }

  function riskLevel(permit) {
    const source = [getPermitType(permit), permit.title, ...(permit.hazards || [])].join(' ').toLowerCase();
    if (permit.isEmergency || source.includes('confined') || source.includes('electrical')) return 'High';
    if (source.includes('hot') || source.includes('weld') || source.includes('height') || source.includes('chemical')) {
      return 'Medium';
    }
    return 'Normal';
  }

  function isHotWork(permit) {
    const source = [getPermitType(permit), permit.title, ...(permit.hazards || [])].join(' ').toLowerCase();
    return source.includes('hot') || source.includes('weld') || source.includes('fire');
  }

  function latestExtensionRequest(permit) {
    return Object.values(state.extensionRequests)
      .filter((request) => request?.permitId === permit.id || request?.permitId === displayPermitId(permit))
      .sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0))[0] || null;
  }

  function latestCompletionRequest(permit) {
    return Object.values(state.completionRequests)
      .filter((request) => request?.permitId === permit.id)
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))[0] || null;
  }

  function finalClosureRequest(permit) {
    if (permit.status === 'closed') return null;

    const request = latestCompletionRequest(permit);
    if (request) {
      const status = String(request.status || 'waiting_admin').toLowerCase();
      if (!['rejected', 'cancelled', 'returned'].includes(status)) return request;
    }
    if (getWorkState(permit) === 'final_closure') return { status: 'waiting_admin' };
    return null;
  }

  function isFinalClosureSubmitted(permit) {
    return Boolean(finalClosureRequest(permit));
  }

  function updateCounts() {
    elements.assignedCount.textContent = state.permits.length;
    elements.activeCount.textContent = state.permits.filter((permit) => permit.status === 'active' && !isFinalClosureSubmitted(permit)).length;
    elements.countdownCount.textContent = state.permits.filter(isDueWithinOneHour).length;
    elements.completedCount.textContent = Object.values(state.completionRequests).filter((request) =>
      request?.workerEmail === state.session?.user?.email,
    ).length;
  }

  function getQueue(view = state.activeView) {
    if (view === 'active') {
      return state.permits.filter((permit) => permit.status === 'active' && !isFinalClosureSubmitted(permit));
    }

    if (view === 'extension') {
      return state.permits.filter((permit) => permit.status === 'active' && !isFinalClosureSubmitted(permit));
    }

    return state.permits.filter((permit) => !['draft', 'cancelled'].includes(permit.status));
  }

  function setView(view) {
    state.activeView = view;
    state.detailMode = view === 'extension' ? 'extension' : 'permit';
    state.selectedPermitId = null;
    elements.navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === view));

    const copy = {
      dashboard: {
        title: 'My Dashboard',
        subtitle: 'Display assigned permits, print site copies, and monitor active work status.',
        queue: 'Assigned Permits',
        hint: 'Permits assigned to your worker email, employee ID, or name.',
      },
      active: {
        title: 'Active Work',
        subtitle: 'View permit validity, work status, extension requests, and completion controls.',
        queue: 'Active Work',
        hint: 'Only supervisor-activated permits appear here.',
      },
      extension: {
        title: 'Permit Extension Request',
        subtitle: 'Create an extension request and send it to Supervisor for approval.',
        queue: 'Extension Candidates',
        hint: 'Active permits assigned to you can be extended.',
      },
      completion: {
        title: 'Worker History',
        subtitle: 'Review extension requests, stop-work notes, and completion submissions from this worker account.',
      },
    };

    elements.pageTitle.textContent = copy[view].title;
    elements.pageSubtitle.textContent = copy[view].subtitle;

    if (view === 'completion') {
      clearInterval(countdownTimer);
      elements.workspace.classList.add('hidden');
      elements.completionSection.classList.remove('hidden');
      elements.emergencyStrip.classList.add('hidden');
      renderLogs();
      return;
    }

    elements.workspace.classList.remove('hidden');
    elements.completionSection.classList.add('hidden');
    elements.emergencyStrip.classList.add('hidden');
    elements.queueTitle.textContent = copy[view].queue;
    elements.queueHint.textContent = copy[view].hint;
    renderQueue();
  }

  function renderQueue() {
    const term = elements.searchInput.value.trim().toLowerCase();
    const queue = getQueue()
      .filter((permit) =>
        [
          permit.id,
          displayPermitId(permit),
          permit.title,
          permit.location,
          getPermitType(permit),
          permit.status,
          workStatusLabel(permit),
          ...(permit.hazards || []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
      .sort((a, b) => {
        const aTime = Date.parse(a.updatedAt || a.createdAt || a.startDateTime) || 0;
        const bTime = Date.parse(b.updatedAt || b.createdAt || b.startDateTime) || 0;
        return bTime - aTime;
      });

    elements.queueItems.innerHTML = '';
    elements.queueCount.textContent = `${queue.length} item${queue.length === 1 ? '' : 's'}`;
    const selectedIndex = queue.findIndex((permit) => permit.id === state.selectedPermitId);
    const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;

    queue.forEach((permit, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'permit-card';
      item.innerHTML = `
        <span class="permit-status ${escapeHtml(statusClass(permit))}">${escapeHtml(workStatusLabel(permit))}</span>
        <strong>${escapeHtml(permit.title || getPermitType(permit))}</strong>
        <span>${escapeHtml(displayPermitId(permit))} - ${escapeHtml(getPermitType(permit))}</span>
        <span>${escapeHtml(permit.location || '-')} - ${escapeHtml(formatDateTime(permit.startDateTime))}</span>
      `;
      item.addEventListener('click', () => {
        document.querySelectorAll('.permit-card').forEach((button) => button.classList.remove('active'));
        item.classList.add('active');
        state.selectedPermitId = permit.id;
        renderSelectedPermit(permit);
      });
      elements.queueItems.append(item);

      if (index === activeIndex) {
        item.classList.add('active');
        state.selectedPermitId = permit.id;
        renderSelectedPermit(permit);
      }
    });

    if (!queue.length) {
      renderEmptyDetail();
    }
  }

  function renderSelectedPermit(permit) {
    if (state.detailMode === 'extension') {
      renderExtensionForm(permit);
      return;
    }
    renderPermitDetail(permit);
  }

  function renderEmptyDetail() {
    clearInterval(countdownTimer);
    elements.permitDetail.innerHTML = `
      <div class="empty-card">
        <strong>No assigned permit selected</strong>
        <p>This worker queue has no permit matching the current filter.</p>
      </div>
    `;
  }

  function renderPermitDetail(permit) {
    clearInterval(countdownTimer);
    const countdown = countdownParts(permit);
    const extension = latestExtensionRequest(permit);
    const completion = latestCompletionRequest(permit);
    const finalClosure = finalClosureRequest(permit);
    const permitClosed = permit.status === 'closed';
    const permitActive = permit.status === 'active' && !finalClosure;

    elements.permitDetail.innerHTML = `
      <section class="worker-console">
        <div class="worker-permit-head">
          <div>
            <span class="risk-chip">${escapeHtml(riskLevel(permit))} Risk</span>
            <span class="status ${escapeHtml(statusClass(permit))}">${escapeHtml(workStatusLabel(permit))}</span>
            <h3>Permit Validity</h3>
            <p>${escapeHtml(displayPermitId(permit))} - ${escapeHtml(permit.location || '-')}</p>
          </div>
          ${permitActive ? actionButton('stop', 'Emergency Stop', 'danger compact') : ''}
        </div>
        <div class="validity-compact">
          <strong class="validity-time" id="countdownValue">${escapeHtml(countdown.value)}</strong>
          <span class="validity-copy">
            <span id="countdownLabel">${escapeHtml(countdown.label)}</span>
            <small id="countdownSubvalue" ${countdown.subvalue ? '' : 'hidden'}>${escapeHtml(countdown.subvalue || '')}</small>
          </span>
        </div>
        <div class="site-row">
          <span>Work Site: <strong>${escapeHtml(permit.location || '-')}</strong></span>
          <span>Activity: <strong>${escapeHtml(getPermitType(permit))}</strong></span>
          <span>Authorized By: <strong>Supervisor</strong></span>
        </div>
      </section>

      ${renderPermitStatusRoute(permit)}

      <section class="field-actions">
        <h4>Field Operations</h4>
        <div class="button-row">
          ${actionButton('preview', 'View / Print Permit', 'secondary')}
          ${permitActive ? actionButton('extension', 'Request Extension', 'secondary') : ''}
          ${permitActive ? actionButton('complete', 'Work Complete', '') : ''}
        </div>
        ${finalClosure ? '<div class="final-closure-note">Work stopped. Submitted to Admin for final closure.</div>' : ''}
      </section>

      <section class="protocol-panel">
        <div class="protocol-head">
          <h4>Safety Protocol Status</h4>
        </div>
        <div class="protocol-grid">
          ${protocolItem('LOTO Verified', permit.controls.some((control) => /loto|isolation/i.test(control)))}
          ${protocolItem('PPE Inspection Complete', permit.ppe.length > 0)}
          ${protocolItem('Gas Levels Safe', !riskNarrative(permit).toLowerCase().includes('gas') || true)}
          ${protocolItem('Briefing Confirmed', true)}
        </div>
      </section>

      <div class="detail-grid">
        ${infoBlock('Work Status', workStatusLabel(permit))}
        ${infoBlock('Extension Request', extension ? `${formatExtensionStatus(extension.status)} - ${extension.requestedMinutes} min` : 'No request sent')}
        ${infoBlock('Completion', completion ? formatStatus(completion.status) : 'Not submitted')}
        ${infoBlock('Hazards', (permit.hazards || []).join(', ') || '-')}
        ${infoBlock('Controls', (permit.controls || []).join('\n') || '-')}
      </div>

      <div class="scope-box">
        <strong>Work Scope</strong>
        <p>${escapeHtml(extractScope(permit.description) || permit.description || '-')}</p>
      </div>
    `;

    if (!finalClosure && !permitClosed) {
      countdownTimer = setInterval(() => updateCountdown(permit), 1000);
    }
    wireDetailActions(permit);
  }

  function renderPermitStatusRoute(permit) {
    const finalStage = permit.status === 'closed'
      ? ['Closure', 'Final closeout complete']
      : isFinalClosureSubmitted(permit)
        ? ['Final Closure', 'Submitted to Admin']
        : ['Worker Active', 'Controlled execution'];
    const stages = [
      ['Requester Submit', 'Create permit package'],
      ['Admin Review', 'Completeness check'],
      ['Safety Officer', 'MOS / permit approval'],
      ['Supervisor Final', 'Release work'],
      finalStage,
    ];
    const { currentIndex, blocked } = getPermitRouteState(permit);

    return `
      <section class="permit-route" aria-label="Permit status route">
        <div class="permit-route-head">
          <div>
            <span>Permit status route</span>
            <strong>${escapeHtml(workStatusLabel(permit))}</strong>
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
    if (status === 'closed') return { currentIndex: 5, blocked: false };
    if (status === 'active') return { currentIndex: 4, blocked: false };
    return { currentIndex: 1, blocked: false };
  }

  function riskNarrative(permit) {
    const hazards = permit.hazards.length ? permit.hazards.join(', ') : 'standard work controls';
    return `${hazards}. Follow permit controls and stop work if conditions change.`;
  }

  function protocolItem(label, checked) {
    return `
      <div class="protocol-item ${checked ? 'ok' : 'warn'}">
        <span>${checked ? 'OK' : 'Check'}</span>
        <strong>${escapeHtml(label)}</strong>
      </div>
    `;
  }

  function infoBlock(label, value) {
    return `
      <div class="info-block">
        <strong>${escapeHtml(label)}</strong>
        <p>${escapeHtml(value || '-')}</p>
      </div>
    `;
  }

  function actionButton(action, label, tone = '') {
    return `<button class="action-button ${escapeHtml(tone)}" type="button" data-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`;
  }

  function updateCountdown(permit) {
    const value = document.querySelector('#countdownValue');
    const label = document.querySelector('#countdownLabel');
    const subvalue = document.querySelector('#countdownSubvalue');
    if (!value || !label) return;

    const countdown = countdownParts(permit);
    value.textContent = countdown.value;
    label.textContent = countdown.label;
    if (subvalue) {
      subvalue.textContent = countdown.subvalue || '';
      subvalue.hidden = !countdown.subvalue;
    }
  }

  function wireDetailActions(permit) {
    elements.permitDetail.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'preview') previewPermit(permit);
        if (action === 'extension') renderExtensionForm(permit);
        if (action === 'complete') renderCompletionForm(permit);
        if (action === 'stop') raiseStopWork(permit);
      });
    });
  }

  function renderExtensionForm(permit) {
    clearInterval(countdownTimer);
    if (isFinalClosureSubmitted(permit)) {
      elements.statusLine.textContent = `${displayPermitId(permit)} is already submitted for Admin final closure.`;
      renderPermitDetail(permit);
      return;
    }

    const latest = latestExtensionRequest(permit);
    elements.permitDetail.innerHTML = `
      <div class="form-page">
        <div class="breadcrumb">My Permits > ${escapeHtml(displayPermitId(permit))} > Extension Request</div>
        <div class="form-head">
          <div>
            <h3>Permit Extension Request</h3>
            <p>Submit this form to request additional time for the active permit.</p>
            <strong>${escapeHtml(displayPermitId(permit))} - ${escapeHtml(getPermitType(permit))} - ${escapeHtml(permit.location || '-')}</strong>
          </div>
          <span class="expiry-pill">Expires in: ${escapeHtml(countdownParts(permit).value)}</span>
        </div>

        <section class="form-card">
          <label class="form-field">
            <span>Reason for Extension</span>
            <textarea id="extensionReason" placeholder="Explain why additional time is required"></textarea>
          </label>
          <span class="form-label">Requested Extra Time</span>
          <div class="time-options">
            ${timeOption(30, 'Standard')}
            ${timeOption(60, 'Extended')}
            ${timeOption(90, 'Critical')}
            <label class="time-option custom">
              <input type="radio" name="extensionMinutes" value="custom">
              <strong>Custom</strong>
              <input id="customMinutes" type="number" min="15" step="15" placeholder="Minutes">
            </label>
          </div>
          <div class="duration-box">
            <span>Current End Time</span>
            <strong>${escapeHtml(formatDateTime(permit.endDateTime))}</strong>
            <span>Latest Request</span>
            <strong>${escapeHtml(latest ? `${formatExtensionStatus(latest.status)} (${latest.requestedMinutes} min)` : 'None')}</strong>
          </div>
          <div class="button-row end">
            ${actionButton('cancel-extension', 'Cancel', 'secondary')}
            ${actionButton('submit-extension', 'Submit Request')}
          </div>
        </section>
      </div>
    `;

    elements.permitDetail.querySelector('[data-action="cancel-extension"]')?.addEventListener('click', () => renderPermitDetail(permit));
    elements.permitDetail.querySelector('[data-action="submit-extension"]')?.addEventListener('click', () => submitExtensionRequest(permit));
  }

  function timeOption(minutes, label) {
    return `
      <label class="time-option">
        <input type="radio" name="extensionMinutes" value="${minutes}" ${minutes === 60 ? 'checked' : ''}>
        <strong>+${minutes}m</strong>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  async function submitExtensionRequest(permit) {
    const reason =
      elements.permitDetail.querySelector('#extensionReason')?.value.trim() ||
      'Extension requested by worker';
    const selected = elements.permitDetail.querySelector('input[name="extensionMinutes"]:checked')?.value || '60';
    const custom = Number(elements.permitDetail.querySelector('#customMinutes')?.value || 0);
    const minutes = selected === 'custom' ? custom : Number(selected);

    if (!minutes || minutes < 15) {
      elements.statusLine.textContent = 'Extension time must be at least 15 minutes.';
      return;
    }

    const submitButton = elements.permitDetail.querySelector('[data-action="submit-extension"]');
    submitButton?.setAttribute('disabled', 'disabled');
    elements.statusLine.textContent = 'Submitting extension request...';

    try {
      const result = await apiRequest(`/api/permits/${encodeURIComponent(permit.id)}/extension-requests`, {
        method: 'POST',
        body: JSON.stringify({ requestedMinutes: minutes, reason }),
      });
      const savedRequest = normalizeExtensionRequest(result.request || result);
      state.extensionRequests = {
        ...normalizeExtensionRequestMap(readStoredObject(EXTENSION_STORAGE_KEY)),
        ...state.extensionRequests,
        [savedRequest.requestId]: savedRequest,
      };
      persistStoredObject(EXTENSION_STORAGE_KEY, state.extensionRequests);
      addLog(permit, 'Extension requested', `+${minutes}m - ${reason}`);
      elements.statusLine.textContent = `${displayPermitId(permit)} extension sent to Supervisor.`;
      window.dispatchEvent(
        new CustomEvent('ptw-extension-request-created', { detail: { requestId: savedRequest.requestId } }),
      );
      renderPermitDetail(permit);
    } catch (error) {
      elements.statusLine.textContent = error.error || error.message || 'Unable to submit extension request.';
      submitButton?.removeAttribute('disabled');
    }
  }

  function renderCompletionForm(permit) {
    clearInterval(countdownTimer);
    if (isFinalClosureSubmitted(permit)) {
      elements.statusLine.textContent = `${displayPermitId(permit)} is already submitted for Admin final closure.`;
      renderPermitDetail(permit);
      return;
    }

    const hot = isHotWork(permit);
    elements.permitDetail.innerHTML = `
      <div class="completion-page">
        <div class="detail-head compact">
          <div>
            <h3>Work Completion</h3>
            <p>${escapeHtml(displayPermitId(permit))} - ${escapeHtml(getPermitType(permit))}</p>
          </div>
          <span class="status active">Active</span>
        </div>
        <div class="warning-strip">Post inspection is required before Admin final closure.</div>
        <section class="form-card">
          <div class="completion-head">
            <h4>Post-Work Inspection</h4>
            <span id="completionProgress">0 / 4 Completed</span>
          </div>
          ${completionCheck('housekeeping', 'Housekeeping completed', 'All debris, waste, and spills have been cleaned.')}
          ${completionCheck('tools', 'Tools removed', 'Tools and equipment are accounted for and removed.')}
          ${completionCheck('area', 'Area safe', 'Guards replaced, covers secured, and area safe for normal operations.')}
          ${completionCheck('isolation', 'Isolation restored', 'LOTO tags removed and system integrity verified.')}
          <div class="hot-work-box">
            <span>Hot work involved?</span>
            <label><input type="radio" name="hotWork" value="yes" ${hot ? 'checked' : ''}> Yes</label>
            <label><input type="radio" name="hotWork" value="no" ${hot ? '' : 'checked'}> No</label>
            <label class="full"><input id="fireWatchCompleted" type="checkbox" ${hot ? '' : 'checked'}> ${hot ? 'Fire watch completed' : 'Continue fire watch not required'}</label>
          </div>
          <label class="evidence-box">
            <span>Site Evidence</span>
            <input id="siteEvidence" type="file" accept="image/*,.pdf">
          </label>
          <label class="form-field">
            <span>Completion Notes</span>
            <textarea id="completionNotes" placeholder="Add handover notes for Admin final closure"></textarea>
          </label>
          <div class="button-row end">
            ${actionButton('cancel-completion', 'Save Progress', 'secondary')}
            ${actionButton('submit-completion', 'Submit Completion')}
          </div>
        </section>
      </div>
    `;

    elements.permitDetail.querySelectorAll('[data-completion-check]').forEach((checkbox) => {
      checkbox.addEventListener('change', updateCompletionProgress);
    });
    elements.permitDetail.querySelectorAll('input[name="hotWork"]').forEach((input) => {
      input.addEventListener('change', updateFireWatchText);
    });
    elements.permitDetail.querySelector('[data-action="cancel-completion"]')?.addEventListener('click', () => {
      addLog(permit, 'Completion progress saved', 'Checklist progress saved locally.');
      renderPermitDetail(permit);
    });
    elements.permitDetail.querySelector('[data-action="submit-completion"]')?.addEventListener('click', () => submitCompletion(permit));
  }

  function completionCheck(id, title, text) {
    return `
      <label class="completion-check">
        <input type="checkbox" data-completion-check="${escapeHtml(id)}">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(text)}</span>
        </div>
      </label>
    `;
  }

  function updateCompletionProgress() {
    const checks = Array.from(elements.permitDetail.querySelectorAll('[data-completion-check]'));
    const completed = checks.filter((check) => check.checked).length;
    const target = elements.permitDetail.querySelector('#completionProgress');
    if (target) target.textContent = `${completed} / ${checks.length} Completed`;
  }

  function updateFireWatchText() {
    const hot = elements.permitDetail.querySelector('input[name="hotWork"]:checked')?.value === 'yes';
    const fireWatch = elements.permitDetail.querySelector('#fireWatchCompleted');
    const label = fireWatch?.closest('label');
    if (!fireWatch || !label) return;
    fireWatch.checked = !hot;
    label.lastChild.textContent = hot ? ' Fire watch completed' : ' Continue fire watch not required';
  }

  function submitCompletion(permit) {
    const checks = Array.from(elements.permitDetail.querySelectorAll('[data-completion-check]'));
    const missing = checks.filter((check) => !check.checked);
    const hotWork = elements.permitDetail.querySelector('input[name="hotWork"]:checked')?.value === 'yes';
    const fireWatchCompleted = elements.permitDetail.querySelector('#fireWatchCompleted')?.checked === true;
    const evidence = elements.permitDetail.querySelector('#siteEvidence')?.files?.[0];
    const notes = elements.permitDetail.querySelector('#completionNotes')?.value.trim() || '';

    if (missing.length) {
      elements.statusLine.textContent = 'Complete all post-work inspection items before submitting.';
      return;
    }
    if (hotWork && !fireWatchCompleted) {
      elements.statusLine.textContent = 'Fire watch completion is required for hot work.';
      return;
    }

    const requestId = `${permit.id}:${Date.now()}`;
    state.completionRequests[requestId] = {
      requestId,
      permitId: permit.id,
      permitDisplayId: displayPermitId(permit),
      permitTitle: permit.title || getPermitType(permit),
      workerName: state.session.user.fullName || '',
      workerEmail: state.session.user.email || '',
      workerEmployeeId: state.session.user.employeeId || '',
      status: 'waiting_admin',
      checklist: checks.map((check) => check.dataset.completionCheck),
      hotWorkInvolved: hotWork,
      fireWatchCompleted,
      evidenceName: evidence?.name || '',
      notes,
      submittedAt: window.PTWTime?.iso?.() || new Date().toISOString(),
    };
    persistStoredObject(COMPLETION_STORAGE_KEY, state.completionRequests);
    setWorkState(permit, 'final_closure', 'Worker completed work and submitted to Admin for final closure');
    addLog(permit, 'Completion submitted', 'Sent to Admin audit trail for final closure.');
    elements.statusLine.textContent = `${displayPermitId(permit)} submitted for Admin final closure. Work timer stopped.`;
    updateCounts();
    renderQueue();
  }

  function reportUnsafeCondition(permit) {
    const reason = window.prompt('Describe the unsafe condition', 'Unsafe condition observed');
    if (reason === null) return;

    addLog(permit, 'Unsafe condition reported', reason || '-');
    elements.statusLine.textContent = `Unsafe condition recorded for ${displayPermitId(permit)}.`;
    renderLogs();
  }

  function raiseStopWork(permit) {
    const reason = window.prompt('Stop-work reason', 'Immediate danger observed');
    if (reason === null) return;

    setWorkState(permit, 'stopped', reason || 'Stop work raised by worker');
    addLog(permit, 'Emergency stop raised', reason || '-');
    elements.statusLine.textContent = `Stop-work recorded for ${displayPermitId(permit)}.`;
    renderPermitDetail(permit);
  }

  function emergencyStopAll() {
    const activePermits = state.permits.filter((permit) => permit.status === 'active');
    if (!activePermits.length) {
      elements.statusLine.textContent = 'No active assigned permits to stop.';
      return;
    }

    const reason = window.prompt('Emergency stop reason for all active assigned permits', 'Immediate danger observed');
    if (reason === null) return;

    activePermits.forEach((permit) => {
      setWorkState(permit, 'stopped', reason || 'Emergency stop work');
      addLog(permit, 'Emergency stop raised', reason || '-');
    });
    elements.statusLine.textContent = 'Emergency stop recorded for active assigned permits.';
    renderQueue();
  }

  function previewPermit(permit) {
    const previewWindow = window.open('', '_blank', 'width=960,height=760');
    if (!previewWindow) {
      elements.statusLine.textContent = 'Popup blocked. Allow popups to preview permit.';
      return;
    }

    const generatedAt = new Date().toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const workerName = state.session?.user?.fullName || state.session?.user?.email || 'Assigned worker';
    const permitCopyHtml = `
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(displayPermitId(permit))} Worker Permit Copy</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #edf2f5;
            color: #111820;
            font-family: Arial, sans-serif;
            font-size: 14px;
          }
          .toolbar {
            position: sticky;
            top: 0;
            z-index: 2;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 14px 20px;
            background: rgba(237, 242, 245, 0.94);
            border-bottom: 1px solid #d4dde3;
          }
          button {
            min-height: 42px;
            padding: 8px 16px;
            border: 1px solid #111820;
            border-radius: 6px;
            background: #111820;
            color: #fff;
            font-weight: 800;
            cursor: pointer;
          }
          button.secondary {
            background: #fff;
            color: #111820;
          }
          .page {
            width: min(960px, calc(100vw - 32px));
            margin: 22px auto 32px;
            padding: 28px;
            background: #fff;
            border: 1px solid #cfd7df;
            box-shadow: 0 16px 38px rgba(16, 24, 32, 0.12);
          }
          .head {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 18px;
            align-items: start;
            padding-bottom: 18px;
            border-bottom: 3px solid #111820;
          }
          .brand {
            font-size: 12px;
            font-weight: 900;
            letter-spacing: .08em;
            text-transform: uppercase;
            color: #52616d;
          }
          h1 {
            margin: 8px 0 6px;
            font-size: 28px;
            line-height: 1.15;
          }
          .sub {
            margin: 0;
            color: #5d6570;
            line-height: 1.45;
          }
          .permit-id {
            display: grid;
            gap: 8px;
            justify-items: end;
            text-align: right;
          }
          .badge {
            display: inline-block;
            padding: 8px 12px;
            border: 1px solid #111820;
            border-radius: 999px;
            font-weight: 900;
            text-transform: uppercase;
          }
          .copy-type {
            color: #0b6fb3;
            font-weight: 900;
            text-transform: uppercase;
          }
          .section {
            margin-top: 20px;
          }
          .section h2 {
            margin: 0 0 10px;
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: .04em;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .box {
            min-height: 74px;
            padding: 12px;
            border: 1px solid #cfd7df;
            border-radius: 6px;
            background: #fbfcfd;
          }
          .box.wide {
            grid-column: 1 / -1;
          }
          .box strong {
            display: block;
            margin-bottom: 6px;
            color: #30404a;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: .04em;
            text-transform: uppercase;
          }
          pre {
            margin: 0;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            font-family: inherit;
            line-height: 1.45;
          }
          .notice {
            margin-top: 18px;
            padding: 12px 14px;
            border: 1px solid #f1d18b;
            border-radius: 6px;
            background: #fff8e8;
            color: #5d3b00;
            font-weight: 700;
            line-height: 1.45;
          }
          .signatures {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-top: 20px;
          }
          .signature {
            min-height: 92px;
            display: grid;
            align-content: end;
            padding: 12px;
            border: 1px solid #cfd7df;
            border-radius: 6px;
          }
          .signature span {
            display: block;
            padding-top: 12px;
            border-top: 1px solid #111820;
            color: #30404a;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
          }
          .footer {
            margin-top: 18px;
            padding-top: 12px;
            border-top: 1px solid #d7dfe5;
            color: #66737d;
            font-size: 12px;
            line-height: 1.45;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
          @media print {
            body { background: #fff; }
            .toolbar { display: none; }
            .page {
              width: 100%;
              margin: 0;
              padding: 0;
              border: 0;
              box-shadow: none;
            }
            .box {
              break-inside: avoid;
            }
          }
          @media (max-width: 720px) {
            .head,
            .grid,
            .signatures {
              grid-template-columns: 1fr;
            }
            .permit-id {
              justify-items: start;
              text-align: left;
            }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button class="secondary" type="button" onclick="window.close()">Close</button>
          <button type="button" onclick="window.print()">Print / Save as PDF</button>
        </div>
        <main class="page">
          <header class="head">
            <div>
              <div class="brand">PTW Guardian</div>
              <h1>Permit To Work - Worker Copy</h1>
              <p class="sub">${escapeHtml(permit.title || getPermitType(permit))}</p>
              <p class="sub">${escapeHtml(getPermitType(permit))} at ${escapeHtml(permit.location || '-')}</p>
            </div>
            <div class="permit-id">
              <span class="badge">${escapeHtml(displayPermitId(permit))}</span>
              <span class="copy-type">${escapeHtml(workStatusLabel(permit))}</span>
              <span>Generated: ${escapeHtml(generatedAt)}</span>
            </div>
          </header>

          <section class="section">
            <h2>Permit Details</h2>
            <div class="grid">
              ${printBox('Permit ID', displayPermitId(permit))}
              ${printBox('Current Status', workStatusLabel(permit))}
              ${printBox('Work Type', getPermitType(permit))}
              ${printBox('Work Site / Location', permit.location || '-')}
              ${printBox('Start Date & Time', formatDateTime(permit.startDateTime))}
              ${printBox('End Date & Time', formatDateTime(permit.endDateTime))}
              ${printBox('Authorized By', 'Supervisor')}
              ${printBox('Worker Viewing Copy', workerName)}
            </div>
          </section>

          <section class="section">
            <h2>Work Scope</h2>
            <div class="grid">
              ${printBox('Scope / Description', extractScope(permit.description) || permit.description || '-', true)}
              ${printBox('Assigned Workers', formatPrintList(permit.assignedWorkers), true)}
            </div>
          </section>

          <section class="section">
            <h2>Safety Requirements</h2>
            <div class="grid">
              ${printBox('Hazards', formatPrintList(permit.hazards))}
              ${printBox('Control Measures', formatPrintList(permit.controls))}
              ${printBox('Required PPE', formatPrintList(permit.ppe))}
              ${printBox('Supporting Documents', formatPermitDocuments(permit))}
            </div>
          </section>

          <div class="notice">
            Worker must keep this permit copy available at the work site and follow the approved controls, PPE, and permit validity window.
          </div>

          <section class="signatures" aria-label="Permit acknowledgements">
            ${printSignature('Worker acknowledgement')}
            ${printSignature('Supervisor verification')}
            ${printSignature('Close-out sign off')}
          </section>

          <footer class="footer">
            Use the Print / Save as PDF button and choose "Save as PDF" in the browser print destination when a digital copy is needed.
          </footer>
        </main>
      </body>
      </html>
    `;

    previewWindow.document.open();
    previewWindow.document.write(permitCopyHtml);
    previewWindow.document.close();
    previewWindow.focus();
    addLog(permit, 'Permit copy opened', 'Displayed printable worker permit copy.');
    elements.statusLine.textContent = `${displayPermitId(permit)} worker permit copy opened.`;
  }

  function printBox(label, value, wide = false) {
    return `<div class="box ${wide ? 'wide' : ''}"><strong>${escapeHtml(label)}</strong><pre>${escapeHtml(value || '-')}</pre></div>`;
  }

  function formatPrintList(items) {
    const values = Array.isArray(items) ? items.map((item) => String(item || '').trim()).filter(Boolean) : [];
    return values.length ? values.map((item) => `- ${item}`).join('\n') : '-';
  }

  function formatPermitDocuments(permit) {
    const documents = Array.isArray(permit.documents) ? permit.documents : [];
    const values = documents
      .map((document) => document.fileName || document.name || document.type || document.id)
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return values.length ? values.map((item) => `- ${item}`).join('\n') : '-';
  }

  function printSignature(label) {
    return `<div class="signature"><span>${escapeHtml(label)}</span></div>`;
  }

  function addLog(permit, action, note) {
    const timestamp = new Date();
    state.logs.unshift({
      time: timestamp.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      sortTime: timestamp.getTime(),
      permit: permit.title || displayPermitId(permit),
      permitId: permit.id,
      action,
      note,
    });
    persistLogs();
  }

  function renderLogs() {
    const completionRows = Object.values(state.completionRequests)
      .filter((request) => request?.workerEmail === state.session?.user?.email)
      .map((request) => ({
        time: formatDateTime(request.submittedAt),
        sortTime: Date.parse(request.submittedAt || '') || 0,
        permit: request.permitTitle || request.permitDisplayId,
        action: 'Completion checklist',
        note: `${formatStatus(request.status)} - ${request.notes || 'Submitted to Admin'}`,
      }));
    const extensionRows = Object.values(state.extensionRequests)
      .filter((request) => request?.workerEmail === state.session?.user?.email)
      .map((request) => ({
        time: formatDateTime(request.requestedAt),
        sortTime: Date.parse(request.requestedAt || '') || 0,
        permit: request.permitTitle || request.permitDisplayId,
        action: 'Extension request',
        note: `${formatExtensionStatus(request.status)} - +${request.requestedMinutes || 0}m`,
      }));
    const rows = [...completionRows, ...extensionRows, ...state.logs].sort(
      (a, b) => (b.sortTime || 0) - (a.sortTime || 0),
    );

    elements.logBody.innerHTML = rows.length
      ? rows
          .map(
            (log) => `
              <tr>
                <td>${escapeHtml(log.time)}</td>
                <td>${escapeHtml(log.permit)}</td>
                <td>${escapeHtml(log.action)}</td>
                <td>${escapeHtml(log.note)}</td>
              </tr>
            `,
          )
          .join('')
      : '<tr><td colspan="4">No worker events recorded yet.</td></tr>';
    elements.logCount.textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
  }

  async function refresh() {
    try {
      await loadData();
      updateCounts();
      if (state.activeView === 'completion') {
        renderLogs();
      } else {
        renderQueue();
      }
      elements.statusLine.textContent = 'Worker portal refreshed.';
    } catch (error) {
      elements.statusLine.textContent = error.error || error.message || 'Unable to refresh worker portal.';
    }
  }

  function wireEvents() {
    elements.navItems.forEach((item) => {
      item.addEventListener('click', () => setView(item.dataset.view));
    });
    elements.searchInput.addEventListener('input', () => {
      if (state.activeView !== 'completion') renderQueue();
    });
    elements.refreshButton.addEventListener('click', refresh);
    elements.accountButton?.addEventListener('click', () => window.location.assign('/account'));
    elements.notificationButton?.addEventListener('click', (event) => {
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
    elements.globalStopButton.addEventListener('click', emergencyStopAll);
    elements.logoutButton.addEventListener('click', () => {
      clearSession();
      window.location.assign('/login');
    });
  }

  async function init() {
    if (!requireWorkerRole()) return;
    await refreshCurrentUser();
    wireEvents();
    await loadData();
    updateCounts();
    setView('dashboard');
  }

  init().catch((error) => {
    elements.statusLine.textContent = error.error || error.message || 'Unable to load worker portal.';
    renderEmptyDetail();
  });
});
