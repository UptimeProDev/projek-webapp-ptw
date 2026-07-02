document.addEventListener('DOMContentLoaded', () => {
  const EXTENSION_STORAGE_KEY = 'ptwSupervisorWorkerExtensionRequests';
  const COMPLETION_STORAGE_KEY = 'ptwWorkerCompletionRequests';
  const WORK_STATE_STORAGE_KEY = 'ptwSupervisorWorkStates';

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
      return `ptwWorkerLogs:${session?.user?.email || 'anonymous'}`;
    } catch {
      return 'ptwWorkerLogs:anonymous';
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
    if (permit.status === 'active') return getWorkState(permit);
    if (permit.status === 'approved') return 'approved';
    if (permit.status === 'closed') return 'closed';
    if (permit.status === 'rejected') return 'rejected';
    return permit.status || 'draft';
  }

  function workStatusLabel(permit) {
    if (permit.status !== 'active') return formatStatus(permit.status);
    const workState = getWorkState(permit);
    if (workState === 'held') return 'Hold';
    if (workState === 'stopped') return 'Stop';
    if (workState === 'resumed') return 'Resume';
    return 'Active';
  }

  function getWorkState(permit) {
    return state.workStates[permit.id]?.state || 'active';
  }

  function setWorkState(permit, status, note = '') {
    state.workStates[permit.id] = {
      state: status,
      note,
      updatedAt: new Date().toISOString(),
      by: state.session?.user?.email || '',
    };
    persistStoredObject(WORK_STATE_STORAGE_KEY, state.workStates);
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
    const end = new Date(permit.endDateTime);
    if (Number.isNaN(end.getTime())) {
      return { value: '--:--:--', label: 'No end time' };
    }

    const diff = end.getTime() - Date.now();
    if (diff <= 0) {
      return { value: '00:00:00', label: 'Permit window expired' };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      value: [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':'),
      label: 'Permit validity remaining',
    };
  }

  function isDueWithinOneHour(permit) {
    const end = new Date(permit.endDateTime);
    if (Number.isNaN(end.getTime())) return false;
    const diff = end.getTime() - Date.now();
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

  function updateCounts() {
    elements.assignedCount.textContent = state.permits.length;
    elements.activeCount.textContent = state.permits.filter((permit) => permit.status === 'active').length;
    elements.countdownCount.textContent = state.permits.filter(isDueWithinOneHour).length;
    elements.completedCount.textContent = Object.values(state.completionRequests).filter((request) =>
      request?.workerEmail === state.session?.user?.email,
    ).length;
  }

  function getQueue(view = state.activeView) {
    if (view === 'active') {
      return state.permits.filter((permit) => permit.status === 'active');
    }

    if (view === 'extension') {
      return state.permits.filter((permit) => permit.status === 'active');
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

      if (index === 0) {
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

    elements.permitDetail.innerHTML = `
      <section class="worker-console">
        <div class="worker-permit-head">
          <div>
            <span class="risk-chip">${escapeHtml(riskLevel(permit))} Risk</span>
            <span class="status ${escapeHtml(statusClass(permit))}">${escapeHtml(workStatusLabel(permit))}</span>
            <h3>Permit Validity</h3>
            <p>${escapeHtml(displayPermitId(permit))} - ${escapeHtml(permit.location || '-')}</p>
          </div>
          ${permit.status === 'active' ? actionButton('stop', 'Emergency Stop', 'danger compact') : ''}
        </div>
        <div class="validity-compact">
          <strong class="validity-time" id="countdownValue">${escapeHtml(countdown.value)}</strong>
          <span id="countdownLabel">${escapeHtml(countdown.label)}</span>
        </div>
        <div class="site-row">
          <span>Work Site: <strong>${escapeHtml(permit.location || '-')}</strong></span>
          <span>Activity: <strong>${escapeHtml(getPermitType(permit))}</strong></span>
          <span>Authorized By: <strong>Supervisor</strong></span>
        </div>
      </section>

      <section class="field-actions">
        <h4>Field Operations</h4>
        <div class="button-row">
          ${actionButton('preview', 'Preview Permit', 'secondary')}
          ${permit.status === 'active' ? actionButton('extension', 'Request Extension', 'secondary') : ''}
          ${permit.status === 'active' ? actionButton('complete', 'Work Complete', '') : ''}
        </div>
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

    countdownTimer = setInterval(() => updateCountdown(permit), 1000);
    wireDetailActions(permit);
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
    if (!value || !label) return;

    const countdown = countdownParts(permit);
    value.textContent = countdown.value;
    label.textContent = countdown.label;
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
      submittedAt: new Date().toISOString(),
    };
    persistStoredObject(COMPLETION_STORAGE_KEY, state.completionRequests);
    addLog(permit, 'Completion submitted', 'Sent to Admin audit trail for final closure.');
    elements.statusLine.textContent = `${displayPermitId(permit)} completion sent to Admin audit trail.`;
    updateCounts();
    renderPermitDetail(permit);
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
    const previewWindow = window.open('', '_blank', 'noopener,width=900,height=700');
    if (!previewWindow) {
      elements.statusLine.textContent = 'Popup blocked. Allow popups to preview permit.';
      return;
    }

    previewWindow.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>${escapeHtml(displayPermitId(permit))} Permit Preview</title>
        <style>
          body { margin: 0; background: #f4f6f8; color: #111820; font-family: Arial, sans-serif; }
          .page { max-width: 920px; margin: 28px auto; padding: 28px; background: #fff; border: 1px solid #cfd7df; }
          .head { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #111820; padding-bottom: 16px; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          .sub { color: #5d6570; }
          .badge { display: inline-block; padding: 6px 10px; border: 1px solid #111820; border-radius: 999px; font-weight: 700; text-transform: uppercase; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
          .box { border: 1px solid #cfd7df; padding: 12px; border-radius: 6px; background: #fbfcfd; }
          .box strong { display: block; margin-bottom: 6px; text-transform: uppercase; font-size: 12px; color: #30404a; }
          pre { margin: 0; white-space: pre-wrap; font-family: inherit; line-height: 1.45; }
          .actions { margin-top: 22px; display: flex; justify-content: flex-end; }
          button { min-height: 40px; padding: 8px 16px; border: 0; border-radius: 6px; background: #111820; color: #fff; font-weight: 800; cursor: pointer; }
          @media print { body { background: #fff; } .page { margin: 0; border: 0; } .actions { display: none; } }
        </style>
      </head>
      <body>
        <main class="page">
        <div class="head">
          <div>
            <h1>${escapeHtml(permit.title || getPermitType(permit))}</h1>
            <div class="sub">${escapeHtml(getPermitType(permit))} at ${escapeHtml(permit.location || '-')}</div>
          </div>
          <span class="badge">${escapeHtml(displayPermitId(permit))} - ${escapeHtml(workStatusLabel(permit))}</span>
        </div>
        <div class="grid">
          ${printBox('Permit Type', getPermitType(permit))}
          ${printBox('Location', permit.location || '-')}
          ${printBox('Validity', `${formatDateTime(permit.startDateTime)} to ${formatDateTime(permit.endDateTime)}`)}
          ${printBox('Assigned Workers', (permit.assignedWorkers || []).join(', ') || '-')}
          ${printBox('Hazards', (permit.hazards || []).join(', ') || '-')}
          ${printBox('Controls', (permit.controls || []).join('\n') || '-')}
          ${printBox('PPE', (permit.ppe || []).join(', ') || '-')}
          ${printBox('Work Scope', extractScope(permit.description) || permit.description || '-')}
        </div>
        <div class="actions"><button type="button" onclick="window.print()">Print Permit</button></div>
        </main>
      </body>
      </html>
    `);
    previewWindow.document.close();
    addLog(permit, 'Permit preview opened', 'Displayed permit preview at work site.');
  }

  function printBox(label, value) {
    return `<div class="box"><strong>${escapeHtml(label)}</strong><pre>${escapeHtml(value)}</pre></div>`;
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
