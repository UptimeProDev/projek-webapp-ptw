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

  const SITE_VALIDATION_STORAGE_KEY = scopedStorageKey('ptwSafetySiteValidationChecklists');
  const WORK_STATE_STORAGE_KEY = scopedStorageKey('ptwSupervisorWorkStates');
  const COMPLETION_STORAGE_KEY = scopedStorageKey('ptwWorkerCompletionRequests');

  const elements = {
    navItems: Array.from(document.querySelectorAll('.nav-item')),
    pageTitle: document.querySelector('#pageTitle'),
    pageSubtitle: document.querySelector('#pageSubtitle'),
    profileName: document.querySelector('#profileName'),
    profileRole: document.querySelector('#profileRole'),
    profileAvatar: document.querySelector('#profileAvatar'),
    accountButton: document.querySelector('#accountButton'),
    notificationButton: document.querySelector('#notificationButton'),
    notificationPanel: document.querySelector('#notificationPanel'),
    notificationCloseButton: document.querySelector('#notificationCloseButton'),
    notificationReadAllButton: document.querySelector('#notificationReadAllButton'),
    notificationList: document.querySelector('#notificationList'),
    notificationCount: document.querySelector('#notificationCount'),
    notificationDot: document.querySelector('#notificationDot'),
    refreshButton: document.querySelector('#refreshButton'),
    logoutButton: document.querySelector('#logoutButton'),
    warning: document.querySelector('#safetyWarning'),
    stage1Count: document.querySelector('#stage1Count'),
    stage2Count: document.querySelector('#stage2Count'),
    emergencyCount: document.querySelector('#emergencyCount'),
    returnedCount: document.querySelector('#returnedCount'),
    reviewWorkspace: document.querySelector('#reviewWorkspace'),
    auditSection: document.querySelector('#auditSection'),
    queueTitle: document.querySelector('#queueTitle'),
    queueHint: document.querySelector('#queueHint'),
    queueCount: document.querySelector('#queueCount'),
    searchInput: document.querySelector('#searchInput'),
    searchClearButton: document.querySelector('#searchClearButton'),
    queueItems: document.querySelector('#queueItems'),
    permitDetail: document.querySelector('#permitDetail'),
    siteChecklistDialog: document.querySelector('#siteChecklistDialog'),
    siteChecklistDialogContent: document.querySelector('#siteChecklistDialogContent'),
    auditBody: document.querySelector('#auditBody'),
    auditCount: document.querySelector('#auditCount'),
  };

  const state = {
    session: readSession(),
    permits: [],
    workers: [],
    audits: [],
    notifications: [],
    activeView: 'all',
    selectedPermitId: null,
    siteValidationChecklists: readStoredObject(SITE_VALIDATION_STORAGE_KEY),
    workStates: readStoredObject(WORK_STATE_STORAGE_KEY),
    completionRequests: readStoredObject(COMPLETION_STORAGE_KEY),
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

  const viewCopy = {
    all: {
      title: 'Safety Officer Dashboard',
      subtitle: 'Review active safety work, stage decisions, emergency approvals, and returned permits.',
      queue: 'All Safety Officer Permits',
      hint: 'Select any permit to inspect requester details and complete the current safety stage.',
    },
    stage1: {
      title: 'MOS Approval',
      subtitle: 'Review methodology, JSA, RAMS/SWP, ERP, permit type, controls, PPE, and competency evidence.',
      queue: 'MOS Approval Queue',
      hint: 'Normal permits submitted by Admin and waiting for Safety Officer MOS Approval.',
    },
    stage2: {
      title: 'Permit Approval',
      subtitle: 'Validate site readiness before sending normal permits to Supervisor final approval.',
      queue: 'Permit Approval Queue',
      hint: 'Permits that passed MOS Approval and need site validation.',
    },
    emergency: {
      title: 'Emergency Permit Approval',
      subtitle: 'Emergency permits come directly from Requester and are finally approved by Safety Officer.',
      queue: 'Emergency Review Queue',
      hint: 'Review MOS Approval evidence and Permit Approval site readiness together, then approve or reject.',
    },
    audit: {
      title: 'Safety Review Log',
      subtitle: 'History of permit decisions and routing actions across Safety Officer visible permits.',
    },
  };

  function readSession() {
    const stored = localStorage.getItem('ptwSession') || sessionStorage.getItem('ptwSession');
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem('ptwSession');
      sessionStorage.removeItem('ptwSession');
      return null;
    }
  }

  async function apiRequest(path, options = {}) {
    if (!state.session?.token) {
      throw new Error('Safety officer session required');
    }

    const response = await fetch(path, {
      ...options,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.session.token}`,
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let body = {};

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text };
      }
    }

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

  function initials(name) {
    return String(name || 'SO')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'SO';
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
    const name = user?.fullName || user?.email || 'Safety Officer';
    elements.profileName.textContent = name;
    elements.profileRole.textContent = 'Safety Officer - Lane 3';
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

  function safetyNotificationItems() {
    const emergency = state.permits.filter((permit) => permit.isEmergency && ['submitted', 'approved'].includes(permit.status)).length;
    const stage1 = state.permits.filter((permit) => permit.status === 'submitted' && !permit.isEmergency).length;
    const returned = state.permits.filter((permit) => permit.status === 'rejected').length;
    return [
      {
        view: 'all',
        label: 'Emergency',
        title: `${emergency} emergency permit${emergency === 1 ? '' : 's'}`,
        body: 'Emergency requests require Safety Officer attention.',
      },
      {
        view: 'stage1',
        label: 'MOS Approval',
        title: `${stage1} MOS Approval review${stage1 === 1 ? '' : 's'}`,
        body: 'Review methodology, JSA, ERP, controls, and PPE.',
      },
      {
        view: 'audit',
        label: 'Returned',
        title: `${returned} returned permit${returned === 1 ? '' : 's'}`,
        body: 'Track correction outcomes and safety review history.',
      },
    ];
  }

  function renderNotifications() {
    if (state.notifications.length) {
      const unreadCount = state.notifications.filter((item) => item.unread).length;
      window.PTWNotifications?.updateBadge(elements.notificationDot, unreadCount);
      elements.notificationReadAllButton.disabled = unreadCount === 0;
      elements.notificationCount.textContent =
        unreadCount ? `${unreadCount} unread` : state.notifications.length === 1 ? '1 item' : `${state.notifications.length} items`;
      elements.notificationList.innerHTML = state.notifications
        .map((item) => `
          <button class="notification-item" type="button"
            data-notification-id="${escapeHtml(item.id || '')}"
            data-notification-link="${escapeHtml(item.link || '')}"
            data-notification-type="${escapeHtml(item.type || '')}"
            data-notification-entity-type="${escapeHtml(item.entityType || '')}"
            data-notification-entity-id="${escapeHtml(item.entityId || '')}">
            <span>${escapeHtml(window.PTWNotifications?.typeLabel(item.type) || item.type || 'Update')}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.message || 'PTW update')}</p>
          </button>
        `)
        .join('');
      return;
    }

    const items = safetyNotificationItems();
    window.PTWNotifications?.updateBadge(elements.notificationDot, 0);
    elements.notificationReadAllButton.disabled = true;
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

  async function markAllNotificationsRead() {
    elements.notificationReadAllButton.disabled = true;
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
      state.notifications = state.notifications.map((item) => ({ ...item, unread: false, readAt: new Date().toISOString() }));
      renderNotifications();
    } catch {
      elements.notificationReadAllButton.disabled = false;
    }
  }

  function getUserRoles(user) {
    const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
    return roles.map((role) => String(role || '').toLowerCase()).filter(Boolean);
  }

  function userHasRole(user, role) {
    return getUserRoles(user).includes(role);
  }

  function requireSafetyOfficer() {
    if (userHasRole(state.session?.user, 'safety_officer')) {
      elements.warning.classList.add('hidden');
      updateProfile(state.session.user);
      return true;
    }

    elements.warning.classList.remove('hidden');
    elements.reviewWorkspace.classList.add('hidden');
    setTimeout(() => window.location.assign('/login'), 700);
    return false;
  }

  async function loadData() {
    const [permitResult, workerResult, notificationResult] = await Promise.all([
      apiRequest('/api/permits'),
      apiRequest('/api/workers'),
      loadNotifications(),
    ]);
    state.permits = (permitResult.permits || permitResult.data || []).map(normalizePermit);
    state.workStates = readStoredObject(WORK_STATE_STORAGE_KEY);
    state.completionRequests = readStoredObject(COMPLETION_STORAGE_KEY);
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
    renderNotifications();
    await loadAuditHistory();
  }

  async function loadNotifications() {
    try {
      return await apiRequest('/api/notifications?limit=20');
    } catch {
      return { notifications: [] };
    }
  }

  async function loadAuditHistory() {
    const results = await Promise.allSettled(
      state.permits.map(async (permit) => {
        const result = await apiRequest(`/api/permits/${encodeURIComponent(permit.id)}/audit-logs`);
        return (result.logs || result.data || []).map((log) => ({ ...log, permit }));
      }),
    );

    state.audits = results
      .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
      .sort((a, b) => new Date(b.when) - new Date(a.when));
  }

  function normalizePermit(permit) {
    return {
      ...permit,
      hazards: Array.isArray(permit.hazards) ? permit.hazards : [],
      controls: Array.isArray(permit.controls) ? permit.controls : [],
      ppe: Array.isArray(permit.ppe) ? permit.ppe : [],
      approvers: Array.isArray(permit.approvers) ? permit.approvers : [],
      documents: Array.isArray(permit.documents) ? permit.documents : [],
      assignedWorkers: Array.isArray(permit.assignedWorkers) ? permit.assignedWorkers : [],
      siteValidation: permit.siteValidation && typeof permit.siteValidation === 'object' && !Array.isArray(permit.siteValidation)
        ? permit.siteValidation
        : {},
      status: String(permit.status || 'draft').toLowerCase(),
    };
  }

  function getPermitType(permit) {
    if (permit.workType) return permit.workType;
    const match = String(permit.description || '').match(/Permit Type:\s*([^\n]+)/i);
    return match ? match[1].trim() : 'Preventive Maintenance';
  }

  function displayPermitId(permit) {
    return permit?.permitId || permit?.id || 'Permit';
  }

  function cleanDescription(description) {
    return String(description || '')
      .split('\n')
      .filter((line) => !/^Permit Class:/i.test(line.trim()))
      .filter((line) => !/^Review Route:/i.test(line.trim()))
      .filter((line) => !/^Permit Type:/i.test(line.trim()))
      .filter((line) => !/^Assigned Worker/i.test(line.trim()))
      .filter((line) => !/^Required Documents:/i.test(line.trim()))
      .filter((line) => !/^(HIRARC|MOS|JSA):/i.test(line.trim()))
      .join('\n')
      .trim();
  }

  function getWorkflowStage(permit) {
    if (permit.isEmergency) {
      if (permit.status === 'active') return 'Emergency Approved';
      if (permit.status === 'rejected') return 'Emergency Rejected';
      if (permit.status === 'approved') return 'Emergency Final Activation';
      return 'Emergency Review';
    }

    if (permit.status === 'submitted') return 'MOS Approval';
    if (permit.status === 'stage1_complete') return 'Permit Approval';
    if (permit.status === 'approved') return 'Sent to Supervisor';
    if (permit.status === 'active') return 'Active Work';
    if (permit.status === 'rejected') return 'Returned to Requester';
    return formatStatus(permit.status);
  }

  function isSafetyVisiblePermit(permit) {
    if (permit.status === 'draft' || permit.status === 'cancelled') return false;
    if (permit.isEmergency) return ['submitted', 'approved', 'active', 'rejected'].includes(permit.status);
    return ['submitted', 'stage1_complete', 'approved', 'active', 'rejected'].includes(permit.status);
  }

  function getQueue(view = state.activeView) {
    const permits = state.permits.filter(isSafetyVisiblePermit);

    if (view === 'stage1') {
      return permits.filter((permit) => !permit.isEmergency && permit.status === 'submitted');
    }

    if (view === 'stage2') {
      return permits.filter((permit) => !permit.isEmergency && permit.status === 'stage1_complete');
    }

    if (view === 'emergency') {
      return permits.filter((permit) => permit.isEmergency && ['submitted', 'approved', 'active', 'rejected'].includes(permit.status));
    }

    return permits;
  }

  function sortPermits(permits) {
    const priority = {
      emergency_submitted: 0,
      submitted: 1,
      stage1_complete: 2,
      emergency_approved: 3,
      approved: 8,
      active: 9,
      rejected: 10,
      closed: 11,
    };

    return [...permits].sort((a, b) => {
      const aKey = a.isEmergency ? `emergency_${a.status}` : a.status;
      const bKey = b.isEmergency ? `emergency_${b.status}` : b.status;
      const priorityDelta = (priority[aKey] ?? 20) - (priority[bKey] ?? 20);
      if (priorityDelta) return priorityDelta;
      return latestPermitTime(b) - latestPermitTime(a);
    });
  }

  function latestPermitTime(permit) {
    return Date.parse(permit.updatedAt || permit.createdAt || permit.startDateTime || '') || 0;
  }

  function updateCounts() {
    elements.stage1Count.textContent = getQueue('stage1').length;
    elements.stage2Count.textContent = getQueue('stage2').length;
    elements.emergencyCount.textContent = getQueue('emergency').filter((permit) =>
      ['submitted', 'approved'].includes(permit.status),
    ).length;
    elements.returnedCount.textContent = state.permits.filter((permit) => permit.status === 'rejected').length;
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateOnly(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }

  function formatStatus(status) {
    return String(status || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function statusClass(permit) {
    if (permit.status === 'rejected') return 'critical';
    if (permit.isEmergency && ['submitted', 'approved'].includes(permit.status)) return 'critical';
    if (['stage1_complete', 'approved', 'active', 'closed'].includes(permit.status)) return 'ok';
    return 'warn';
  }

  function latestCompletionRequest(permit) {
    return Object.values(state.completionRequests || {})
      .filter((request) => request?.permitId === permit.id || request?.permitDisplayId === displayPermitId(permit))
      .sort((a, b) => new Date(b.closedAt || b.submittedAt || 0) - new Date(a.closedAt || a.submittedAt || 0))[0] || null;
  }

  function workCondition(permit) {
    if (permit.status === 'closed') return { key: 'closed', label: 'Closed' };

    const completion = latestCompletionRequest(permit);
    if (completion) {
      const status = String(completion.status || 'waiting_admin').toLowerCase();
      if (status === 'closed') return { key: 'closed', label: 'Closed' };
      if (!['rejected', 'cancelled', 'returned'].includes(status)) {
        return { key: 'sent-for-closure', label: 'Sent for Closure' };
      }
    }

    const stateName = String(permit.workState || permit.work_state || state.workStates?.[permit.id]?.state || '').toLowerCase();
    if (stateName === 'held') return { key: 'hold', label: 'Hold' };
    if (stateName === 'stopped') return { key: 'stop', label: 'Stop' };
    if (stateName === 'resumed') return { key: 'resume', label: 'Resume' };
    if (stateName === 'final_closure' || stateName === 'sent_for_closure') {
      return { key: 'sent-for-closure', label: 'Sent for Closure' };
    }
    if (stateName === 'closed') return { key: 'closed', label: 'Closed' };
    if (permit.status === 'active') return { key: 'active', label: 'Active' };
    return { key: 'not-started', label: 'Not Started' };
  }

  function setView(view) {
    state.activeView = view;
    elements.navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === view));

    const copy = viewCopy[view] || viewCopy.all;
    elements.pageTitle.textContent = copy.title;
    elements.pageSubtitle.textContent = copy.subtitle;

    if (view === 'audit') {
      elements.reviewWorkspace.classList.add('hidden');
      elements.auditSection.classList.remove('hidden');
      renderAudit();
      return;
    }

    elements.reviewWorkspace.classList.remove('hidden');
    elements.auditSection.classList.add('hidden');
    elements.queueTitle.textContent = copy.queue;
    elements.queueHint.textContent = copy.hint;
    renderQueue();
  }

  function permitMatchesSearch(permit, term) {
    if (!term) return true;

    return [
      permit.id,
      permit.title,
      permit.location,
      permit.requestedBy,
      getPermitType(permit),
      getWorkflowStage(permit),
      workCondition(permit).label,
      formatStatus(permit.status),
      ...permit.hazards,
      ...permit.controls,
    ]
      .join(' ')
      .toLowerCase()
      .includes(term);
  }

  function renderQueue() {
    const term = elements.searchInput.value.trim().toLowerCase();
    const queue = sortPermits(getQueue()).filter((permit) => permitMatchesSearch(permit, term));

    elements.queueItems.innerHTML = '';
    elements.queueCount.textContent = `${queue.length} item${queue.length === 1 ? '' : 's'}`;

    if (!queue.some((permit) => permit.id === state.selectedPermitId)) {
      state.selectedPermitId = queue[0]?.id || null;
    }

    if (state.activeView === 'all') {
      renderQueueSection('Emergency Priority', sortLatest(queue.filter((permit) => permit.isEmergency && isOpenSafetyReview(permit))));
      renderQueueSection('Latest Permits', sortLatest(queue.filter((permit) => !permit.isEmergency && isOpenSafetyReview(permit))));
      renderQueueSection('Sent to Supervisor', sortLatest(queue.filter(isSentToSupervisor)));
      renderQueueSection('Completed / Returned', sortLatest(queue.filter((permit) =>
        !isOpenSafetyReview(permit) && !isSentToSupervisor(permit) && !(permit.isEmergency && ['submitted', 'approved'].includes(permit.status)),
      )));
    } else {
      sortLatest(queue).forEach((permit) => elements.queueItems.append(createPermitCard(permit)));
    }

    const selected = queue.find((permit) => permit.id === state.selectedPermitId);
    if (selected) {
      renderPermitDetail(selected);
      return;
    }

    renderEmptyDetail();
  }

  function renderQueueSection(title, permits) {
    if (!permits.length) return;

    const section = document.createElement('section');
    section.className = 'queue-section';
    section.innerHTML = `<h4>${escapeHtml(title)}</h4>`;
    permits.forEach((permit) => section.append(createPermitCard(permit)));
    elements.queueItems.append(section);
  }

  function isOpenSafetyReview(permit) {
    if (permit.isEmergency) return ['submitted', 'approved'].includes(permit.status);
    return ['submitted', 'stage1_complete'].includes(permit.status);
  }

  function isSentToSupervisor(permit) {
    return !permit.isEmergency && permit.status === 'approved';
  }

  function sortLatest(permits) {
    return [...permits].sort((a, b) => latestPermitTime(b) - latestPermitTime(a));
  }

  function createPermitCard(permit) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `permit-card ${permit.isEmergency ? 'emergency-card' : ''} ${permit.id === state.selectedPermitId ? 'active' : ''}`;
    item.innerHTML = `
      <span class="queue-topline">
        <strong>${escapeHtml(permit.title)}</strong>
        <em class="${escapeHtml(statusClass(permit))}">${escapeHtml(getWorkflowStage(permit))}</em>
      </span>
      <span>${escapeHtml(getPermitType(permit))} at ${escapeHtml(permit.location || '-')}</span>
      <span>Requester: ${escapeHtml(permit.requestedBy || '-')}</span>
      <span class="queue-meta">${escapeHtml(formatDateTime(permit.startDateTime))}</span>
    `;
    item.addEventListener('click', () => {
      state.selectedPermitId = permit.id;
      renderQueue();
    });
    return item;
  }

  function renderEmptyDetail() {
    elements.permitDetail.innerHTML = `
      <div class="empty-card">
        <strong>No permit selected</strong>
        <p>No permit matches this queue or search filter.</p>
      </div>
    `;
  }

  function renderPermitDetail(permit, preferredStageIndex = null) {
    const stage = getWorkflowStage(permit);
    const condition = workCondition(permit);
    const initialStageIndex = Number.isInteger(preferredStageIndex)
      ? preferredStageIndex
      : getInitialSafetyReviewStage(permit);

    elements.permitDetail.innerHTML = `
      <div class="detail-head">
        <div>
          <h3>${escapeHtml(permit.title || 'Untitled permit')}</h3>
          <p>${escapeHtml(permit.location || '-')} - ${escapeHtml(getPermitType(permit))}</p>
        </div>
        <span class="status ${escapeHtml(statusClass(permit))}">${escapeHtml(stage)}</span>
      </div>

      <div class="safety-review-flow" data-safety-stages data-initial-stage="${initialStageIndex}">
        ${renderWorkflow(permit)}

        <div class="safety-review-stepper" role="tablist" aria-label="Safety approval review stages">
          <button class="safety-review-step active" type="button" role="tab" data-safety-step>1. Overview</button>
          <button class="safety-review-step" type="button" role="tab" data-safety-step>2. Evidence</button>
          <button class="safety-review-step" type="button" role="tab" data-safety-step>3. Risk</button>
          <button class="safety-review-step" type="button" role="tab" data-safety-step>4. Site</button>
          <button class="safety-review-step" type="button" role="tab" data-safety-step>5. Decision</button>
        </div>

        <section class="safety-review-stage active" data-safety-stage-panel>
          <section class="detail-section">
            <h4>Requester Details</h4>
            <div class="detail-grid">
              ${infoBlock('Requested By', permit.requestedBy || '-')}
              ${infoBlock('Work Type', getPermitType(permit))}
              ${infoBlock('Start', formatDateTime(permit.startDateTime))}
              ${infoBlock('End', formatDateTime(permit.endDateTime))}
              ${statusInfoBlock('Work Condition', condition)}
            </div>
          </section>

          <section class="detail-section">
            <h4>Work Information</h4>
            <div class="info-block wide">
              <strong>Description</strong>
              <p>${escapeHtml(cleanDescription(permit.description) || '-')}</p>
            </div>
          </section>
        </section>

        <section class="safety-review-stage" data-safety-stage-panel>
          ${renderDigitalEvidence(permit) || renderStageEmpty('No MOS / JSA digital evidence', 'The requester has not submitted structured MOS or JSA form data for this permit.')}
        </section>

        <section class="safety-review-stage" data-safety-stage-panel>
          <section class="detail-section">
            <h4>Risk Evidence</h4>
            <div class="detail-grid">
              ${infoBlock('Permit Type', listText(permit.hazards))}
              ${infoBlock('Controls', listText(permit.controls))}
              ${infoBlock('PPE', listText(permit.ppe))}
              ${infoBlock('Approvers / Contacts', listText(permit.approvers))}
            </div>
          </section>

          <section class="detail-section">
            <h4>Documents And Workers</h4>
            <div class="detail-grid">
              ${renderDocuments(permit)}
              ${infoBlock('Assigned Workers', workerText(permit))}
            </div>
          </section>
        </section>

        <section class="safety-review-stage" data-safety-stage-panel>
          ${needsSiteValidation(permit)
            ? renderSiteValidation(permit)
            : renderStageEmpty('Site validation not open yet', 'Complete MOS Approval first. Permit Approval site validation opens in the next Safety Officer stage.')}
        </section>

        <section class="safety-review-stage" data-safety-stage-panel>
          ${renderDecisionPanel(permit)}
        </section>

        <div class="safety-stage-actions">
          <button class="ghost-button" type="button" data-safety-stage-prev>Back</button>
          <button class="dark-button" type="button" data-safety-stage-next>Next</button>
        </div>
      </div>
    `;

    const setReviewStage = wireSafetyReviewStages(elements.permitDetail);

    elements.permitDetail.querySelectorAll('[data-download-document]').forEach((button) => {
      button.addEventListener('click', () => {
        const documentId = button.dataset.downloadDocument;
        downloadDocument(permit, documentId).catch((error) => {
          showDecisionMessage(error.error || error.message || 'Unable to open permit document.', true);
        });
      });
    });

    elements.permitDetail.querySelector('[data-mos-jsa-export]')?.addEventListener('click', (event) => {
      event.preventDefault();
      downloadMosJsaExcel(permit).catch((error) => {
        showDecisionMessage(error.error || error.message || 'Unable to export MOS/JSA Excel.', true);
      });
    });

    elements.permitDetail.querySelectorAll('[data-digital-doc-jump]').forEach((button) => {
      button.addEventListener('click', () => {
        const targetType = String(button.dataset.digitalDocJump || '').toUpperCase();
        setReviewStage(1);
        window.requestAnimationFrame(() => {
          const card = Array.from(elements.permitDetail.querySelectorAll('[data-digital-evidence-card]')).find(
            (item) => String(item.dataset.digitalEvidenceCard || '').toUpperCase() === targetType,
          );
          if (!card) {
            showDecisionMessage('MOS/JSA digital form data is not available for this permit.', true);
            return;
          }

          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('is-highlighted');
          window.setTimeout(() => card.classList.remove('is-highlighted'), 1400);
        });
      });
    });

    elements.permitDetail.querySelectorAll('[data-site-field]').forEach((input) => {
      input.addEventListener('input', () => persistSiteValidationFields(permit));
      input.addEventListener('change', () => persistSiteValidationFields(permit));
    });
    elements.permitDetail.querySelectorAll('[data-attendance-worker]').forEach((input) => {
      input.addEventListener('change', () => persistSiteValidationFields(permit));
    });

    elements.permitDetail.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => handleDecision(permit, button.dataset.action));
    });
  }

  function renderStageEmpty(title, message) {
    return `
      <section class="stage-empty">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(message)}</p>
      </section>
    `;
  }

  function getInitialSafetyReviewStage(permit) {
    if (permit.status === 'stage1_complete') return 3;
    if (permit.status === 'approved' || permit.status === 'rejected' || permit.status === 'active' || permit.status === 'closed') return 4;
    return 0;
  }

  function getActiveSafetyReviewStageIndex() {
    const panels = Array.from(elements.permitDetail.querySelectorAll('[data-safety-stage-panel]'));
    const activeIndex = panels.findIndex((panel) => panel.classList.contains('active'));
    return activeIndex >= 0 ? activeIndex : null;
  }

  function wireSafetyReviewStages(root) {
    const workflow = root.querySelector('[data-safety-stages]');
    if (!workflow) return () => {};

    const steps = Array.from(workflow.querySelectorAll('[data-safety-step]'));
    const panels = Array.from(workflow.querySelectorAll('[data-safety-stage-panel]'));
    const previousButton = workflow.querySelector('[data-safety-stage-prev]');
    const nextButton = workflow.querySelector('[data-safety-stage-next]');
    let activeIndex = 0;

    function setStage(index) {
      activeIndex = Math.max(0, Math.min(index, panels.length - 1));

      steps.forEach((step, stepIndex) => {
        const isActive = stepIndex === activeIndex;
        step.classList.toggle('active', isActive);
        step.setAttribute('aria-selected', isActive ? 'true' : 'false');
        step.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      panels.forEach((panel, panelIndex) => {
        panel.classList.toggle('active', panelIndex === activeIndex);
      });

      if (previousButton) previousButton.disabled = activeIndex === 0;

      if (nextButton) {
        const isLastStage = activeIndex === panels.length - 1;
        nextButton.disabled = isLastStage;
        nextButton.textContent = isLastStage ? 'Final stage' : 'Next';
        nextButton.classList.toggle('ghost-button', isLastStage);
        nextButton.classList.toggle('dark-button', !isLastStage);
      }
    }

    steps.forEach((step, index) => {
      step.addEventListener('click', () => setStage(index));
    });
    previousButton?.addEventListener('click', () => setStage(activeIndex - 1));
    nextButton?.addEventListener('click', () => setStage(activeIndex + 1));

    setStage(Number(workflow.dataset.initialStage || 0));
    return setStage;
  }

  function renderWorkflow(permit) {
    const isEmergency = Boolean(permit.isEmergency);
    const steps = isEmergency
      ? [
          { key: 'submitted', label: 'Requester Submit' },
          { key: 'safety', label: 'SO MOS + Permit Approval' },
          { key: 'active', label: 'Final Approved' },
        ]
      : [
          { key: 'submitted', label: 'Admin Submit' },
          { key: 'stage1', label: 'SO MOS Approval' },
          { key: 'stage2', label: 'SO Permit Approval' },
          { key: 'supervisor', label: 'Supervisor Final' },
          { key: 'active', label: 'Work Active' },
        ];

    return `
      <div class="workflow-strip ${isEmergency ? 'emergency' : ''}">
        ${steps.map((step) => renderWorkflowStep(permit, step)).join('')}
      </div>
    `;
  }

  function renderWorkflowStep(permit, step) {
    const stateName = workflowState(permit, step.key);
    return `
      <div class="workflow-step ${escapeHtml(stateName)}">
        <span></span>
        <strong>${escapeHtml(step.label)}</strong>
      </div>
    `;
  }

  function workflowState(permit, key) {
    if (permit.status === 'rejected') return ['submitted'].includes(key) ? 'done' : 'blocked';

    if (permit.isEmergency) {
      if (key === 'submitted') return ['submitted', 'approved', 'active', 'closed'].includes(permit.status) ? 'done' : 'pending';
      if (key === 'safety') return permit.status === 'submitted' ? 'current' : ['approved', 'active', 'closed'].includes(permit.status) ? 'done' : 'pending';
      if (key === 'active') return ['active', 'closed'].includes(permit.status) ? 'done' : permit.status === 'approved' ? 'current' : 'pending';
      return 'pending';
    }

    if (key === 'submitted') return ['submitted', 'stage1_complete', 'approved', 'active', 'closed'].includes(permit.status) ? 'done' : 'pending';
    if (key === 'stage1') return permit.status === 'submitted' ? 'current' : ['stage1_complete', 'approved', 'active', 'closed'].includes(permit.status) ? 'done' : 'pending';
    if (key === 'stage2') return permit.status === 'stage1_complete' ? 'current' : ['approved', 'active', 'closed'].includes(permit.status) ? 'done' : 'pending';
    if (key === 'supervisor') return permit.status === 'approved' ? 'current' : ['active', 'closed'].includes(permit.status) ? 'done' : 'pending';
    if (key === 'active') return ['active', 'closed'].includes(permit.status) ? 'done' : 'pending';
    return 'pending';
  }

  function infoBlock(label, value) {
    return `
      <div class="info-block">
        <strong>${escapeHtml(label)}</strong>
        <p>${escapeHtml(value || '-')}</p>
      </div>
    `;
  }

  function statusInfoBlock(label, condition) {
    return `
      <div class="info-block">
        <strong>${escapeHtml(label)}</strong>
        <span class="work-condition-pill ${escapeHtml(condition.key)}">${escapeHtml(condition.label)}</span>
      </div>
    `;
  }

  function listText(items) {
    return Array.isArray(items) && items.length ? items.join('\n') : '-';
  }

  function findWorkerByReference(workerId) {
    const needle = String(workerId || '').trim().toLowerCase();
    if (!needle) return null;

    return state.workers.find((item) =>
      [item.id, item.employeeId, item.name, item.email]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
        .includes(needle),
    ) || null;
  }

  function workerAttendanceIdentity(workerId) {
    const worker = findWorkerByReference(workerId);
    const id = worker?.employeeId || worker?.id || workerId;
    const name = worker?.name || workerId;
    const status = worker ? formatStatus(worker.status || 'valid') : 'Assigned';
    return {
      reference: String(workerId || '').trim(),
      id: String(id || '').trim(),
      name: String(name || '').trim(),
      status,
      label: worker ? `${id} - ${name}` : String(workerId || '').trim(),
    };
  }

  function workerText(permit) {
    if (!permit.assignedWorkers.length) return '-';

    return permit.assignedWorkers
      .map((workerId) => {
        const worker = findWorkerByReference(workerId);
        if (!worker) return workerId;
        return `${worker.name} (${worker.employeeId || worker.id}) - ${formatStatus(worker.status || 'valid')}`;
      })
      .join('\n');
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

    if (!documents.length) return '';

    return `
      <section class="detail-section digital-evidence-section">
        <div class="digital-evidence-title">
          <h4>MOS / JSA Digital Evidence</h4>
          <button class="mini-button" type="button" data-mos-jsa-export="${escapeHtml(permit.id)}">Export Excel</button>
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
    const rows = [...knownRows, ...extraRows];

    return `
      <article class="digital-evidence-card" data-digital-evidence-card="${escapeHtml(type)}">
        <div class="digital-evidence-head">
          <strong>${escapeHtml(schema.title)}</strong>
          <span>${escapeHtml(document.source === 'mos-jsa-digital-form' ? 'Digital form' : document.source || 'Structured data')}</span>
        </div>
        <dl>
          ${rows
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

  function renderDocuments(permit) {
    const visibleDocuments = (permit.documents || []).filter((document) => {
      const type = String(document?.type || '').trim().toUpperCase();
      return Boolean(document?.hasAttachment || getStructuredDocument(permit, type));
    });

    const rows = visibleDocuments.length
      ? visibleDocuments
          .map((document) => {
            const type = String(document.type || '').trim().toUpperCase();
            const hasStructuredData = Boolean(getStructuredDocument(permit, type));
            const canDownload = document.id && document.hasAttachment;
            return `
              <li>
                <div>
                  <strong>${escapeHtml(document.type || 'Document')}</strong>
                  <span>${escapeHtml(hasStructuredData ? 'Digital form' : document.name || document.fileName || '-')}</span>
                </div>
                ${
                  hasStructuredData
                    ? `<button class="mini-button" type="button" data-digital-doc-jump="${escapeHtml(type)}">View form</button>`
                    : canDownload
                    ? `<button class="mini-button" type="button" data-download-document="${escapeHtml(document.id)}">View</button>`
                    : '<em>No file</em>'
                }
              </li>
            `;
          })
          .join('')
      : '<li><div><strong>No supporting files</strong><span>MOS/JSA digital forms are shown in Digital Evidence.</span></div></li>';

    return `
      <div class="info-block document-block">
        <strong>Permit Documents</strong>
        <ul>${rows}</ul>
      </div>
    `;
  }

  function needsSiteValidation(permit) {
    return permit.isEmergency || permit.status === 'stage1_complete';
  }

  function defaultSiteValidationFields(permit) {
    return {
      actualWorkDate: formatDateOnly(permit.startDateTime),
      location: permit.location || '',
      attendance: {},
    };
  }

  function getSiteValidationRecord(permit) {
    return state.siteValidationChecklists?.[permit.id] || permit.siteValidation || {};
  }

  function getSiteValidationFields(permit) {
    return {
      ...defaultSiteValidationFields(permit),
      ...(getSiteValidationRecord(permit)._siteFields || {}),
    };
  }

  function readSiteValidationFieldsFromDom(permit) {
    const defaults = getSiteValidationFields(permit);
    const actualWorkDateInput = elements.permitDetail.querySelector('[data-site-field="actualWorkDate"]');
    const locationInput = elements.permitDetail.querySelector('[data-site-field="location"]');
    const attendance = {};
    elements.permitDetail.querySelectorAll('[data-attendance-worker]').forEach((input) => {
      attendance[input.dataset.attendanceWorker] = Boolean(input.checked);
    });
    return {
      actualWorkDate: actualWorkDateInput ? actualWorkDateInput.value.trim() : defaults.actualWorkDate,
      location: locationInput ? locationInput.value.trim() : defaults.location,
      attendance: Object.keys(attendance).length ? attendance : defaults.attendance,
    };
  }

  function persistSiteValidationFields(permit, fields = readSiteValidationFieldsFromDom(permit)) {
    state.siteValidationChecklists[permit.id] = {
      ...(state.siteValidationChecklists[permit.id] || {}),
      _siteFields: {
        actualWorkDate: fields.actualWorkDate,
        location: fields.location,
        attendance: fields.attendance,
        updatedAt: window.PTWTime?.iso?.() || new Date().toISOString(),
      },
    };
    updatePermitSiteValidationState(permit.id, state.siteValidationChecklists[permit.id]);
    persistStoredObject(SITE_VALIDATION_STORAGE_KEY, state.siteValidationChecklists);
  }

  function updatePermitSiteValidationState(permitId, siteValidation) {
    state.permits = state.permits.map((permit) =>
      permit.id === permitId ? { ...permit, siteValidation } : permit,
    );
    if (state.selectedPermitId === permitId) {
      const selectedPermit = state.permits.find((permit) => permit.id === permitId);
      if (selectedPermit) state.selectedPermitId = selectedPermit.id;
    }
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

  function renderSiteValidation(permit) {
    const checklists = getSiteValidationChecklists(permit);
    const completedCount = checklists.filter((checklist) => isSiteChecklistComplete(permit.id, checklist)).length;
    const siteFields = getSiteValidationFields(permit);
    return `
      <section class="detail-section site-panel" id="siteValidationPanel">
        <h4>Permit Approval Site Validation</h4>
        <div class="site-grid">
          <label>
            <span>Actual work date</span>
            <input data-site-field="actualWorkDate" type="date" value="${escapeHtml(siteFields.actualWorkDate)}" required>
          </label>
          <label>
            <span>Actual location</span>
            <input data-site-field="location" type="text" value="${escapeHtml(siteFields.location)}" required>
          </label>
        </div>
        <div class="attendance-panel">
          <div class="attendance-head">
            <strong>Attendance</strong>
            <span>Confirm present assigned workers by worker ID.</span>
          </div>
          <div class="attendance-list">
            ${renderAttendanceRows(permit, siteFields.attendance)}
          </div>
        </div>
        <div class="site-validation-summary">
          <strong>${completedCount}/${checklists.length} checklists completed</strong>
          <span>Confirm actual date, location, attendance, and every required checklist before Permit Approval.</span>
        </div>
        <div class="site-checklist-grid">
          ${checklists.map((checklist) => siteChecklistCard(permit.id, checklist)).join('')}
        </div>
      </section>
    `;
  }

  function renderAttendanceRows(permit, attendance = {}) {
    if (!permit.assignedWorkers.length) {
      return '<div class="attendance-empty">No assigned workers found. Return the permit for correction before approval.</div>';
    }

    return permit.assignedWorkers
      .map((workerId) => {
        const worker = workerAttendanceIdentity(workerId);
        const checked = attendance?.[worker.reference] ? 'checked' : '';
        return `
          <label class="attendance-row">
            <input data-attendance-worker="${escapeHtml(worker.reference)}" type="checkbox" ${checked}>
            <span>
              <strong>${escapeHtml(worker.id || worker.reference)}</strong>
              <em>${escapeHtml(worker.name)}</em>
              <small>${escapeHtml(worker.status)}</small>
            </span>
          </label>
        `;
      })
      .join('');
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
    return state.siteValidationChecklists?.[permitId]?.[checklistKey] || { checked: {}, notes: '' };
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
      showDecisionMessage('Unable to open checklist popup. Refresh the page and try again.', true);
      return;
    }

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const checklistState = getSiteChecklistState(permit.id, checklist.key);
    const checkedCount = getCheckedSiteChecklistCount(permit.id, checklist);
    const isComplete = checkedCount === checklist.items.length;
    elements.siteChecklistDialogContent.innerHTML = `
      <div class="site-dialog-head">
        <div>
          <h3>${escapeHtml(checklist.title)} Checklist</h3>
          <p>${escapeHtml(checklist.summary)}</p>
        </div>
        <span class="site-progress-pill ${isComplete ? 'complete' : ''}" data-site-check-progress>
          ${escapeHtml(`${checkedCount}/${checklist.items.length}`)}
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
        <button class="ghost-button" type="button" data-site-checklist-close>Cancel</button>
        <button class="dark-button" type="button" data-site-checklist-save="${escapeHtml(checklist.key)}" ${isComplete ? '' : 'disabled'}>Save Checklist</button>
      </div>
    `;

    elements.siteChecklistDialogContent
      .querySelector('[data-site-checklist-close]')
      ?.addEventListener('click', closeSiteChecklistDialog);
    elements.siteChecklistDialogContent
      .querySelector('[data-site-checklist-save]')
      ?.addEventListener('click', () => {
        saveSiteChecklist(permit, checklist).catch((error) => {
          showDecisionMessage(error.error || error.message || 'Unable to save checklist notes.', true);
        });
      });
    elements.siteChecklistDialogContent
      .querySelectorAll('[data-site-check-item]')
      .forEach((input) => input.addEventListener('change', () => updateSiteChecklistDialogState(checklist)));
    updateSiteChecklistDialogState(checklist);

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

  function updateSiteChecklistDialogState(checklist) {
    const dialogContent = elements.siteChecklistDialogContent;
    if (!dialogContent) return;

    const inputs = Array.from(dialogContent.querySelectorAll('[data-site-check-item]'));
    const totalCount = checklist?.items?.length || inputs.length;
    const checkedCount = inputs.filter((input) => input.checked).length;
    const isComplete = totalCount > 0 && checkedCount === totalCount;
    const progress = dialogContent.querySelector('[data-site-check-progress]');
    const saveButton = dialogContent.querySelector('[data-site-checklist-save]');

    if (progress) {
      progress.textContent = `${checkedCount}/${totalCount}`;
      progress.classList.toggle('complete', isComplete);
    }

    if (saveButton) {
      saveButton.disabled = !isComplete;
      saveButton.title = isComplete ? '' : 'Complete all checklist items before saving';
      saveButton.setAttribute('aria-disabled', String(!isComplete));
    }
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
      showDecisionMessage(`Complete all ${checklist.title} checks before saving.`, true);
      return;
    }

    state.siteValidationChecklists[permit.id] = {
      ...(state.siteValidationChecklists[permit.id] || {}),
      [checklist.key]: {
        checked,
        notes: elements.siteChecklistDialogContent.querySelector('#siteChecklistNotes')?.value.trim() || '',
        updatedAt: window.PTWTime?.iso?.() || new Date().toISOString(),
      },
    };
    updatePermitSiteValidationState(permit.id, state.siteValidationChecklists[permit.id]);
    persistStoredObject(SITE_VALIDATION_STORAGE_KEY, state.siteValidationChecklists);
    await saveSiteValidationToServer(permit);
    const activeStageIndex = getActiveSafetyReviewStageIndex();
    closeSiteChecklistDialog();
    renderPermitDetail(state.permits.find((item) => item.id === permit.id) || permit, activeStageIndex);
    showDecisionMessage(`${checklist.title} checklist completed.`, false);
  }

  function closeSiteChecklistDialog() {
    if (typeof elements.siteChecklistDialog?.close === 'function') {
      elements.siteChecklistDialog.close();
    } else {
      elements.siteChecklistDialog?.removeAttribute('open');
    }
  }

  function renderDecisionPanel(permit) {
    const actions = getActions(permit);
    const message = getDecisionMessage(permit);
    const buttons = actions
      .map(
        (action) => `
          <button class="${escapeHtml(action.className)}" type="button" data-action="${escapeHtml(action.key)}">
            ${escapeHtml(action.label)}
          </button>
        `,
      )
      .join('');

    return `
      <section class="decision-panel">
        <div class="decision-message" id="decisionMessage">${escapeHtml(message)}</div>
        ${
          actions.length
            ? `
              <label class="decision-notes">
                <span>Decision notes</span>
                <textarea id="decisionNotes" rows="3" placeholder="Add reason for rejection or any approval notes"></textarea>
              </label>
              <div class="button-row">${buttons}</div>
            `
            : ''
        }
      </section>
    `;
  }

  function getDecisionMessage(permit) {
    if (permit.isEmergency && permit.status === 'active') {
      return 'Emergency permit has final Safety Officer approval and is active.';
    }

    if (permit.isEmergency && permit.status === 'approved') {
      return 'Emergency permit is Safety Officer approved and waiting for final activation.';
    }

    if (permit.status === 'approved') {
      return 'Permit Approval is complete. This normal permit is now waiting for Supervisor final approval before work starts.';
    }

    if (permit.status === 'active') {
      return 'Work has started. Supervisor monitoring controls now apply.';
    }

    if (permit.status === 'rejected') {
      return 'Permit was rejected or returned to requester for correction.';
    }

    if (permit.status === 'stage1_complete') {
      return 'MOS Approval passed. Complete Permit Approval site validation, then submit to Supervisor.';
    }

    return permit.isEmergency
      ? 'Emergency review covers MOS Approval evidence and Permit Approval site readiness. Approving here is the final safety approval.'
      : 'Review MOS Approval evidence. Approve to move this permit to Permit Approval, or reject to return it to the requester.';
  }

  function getActions(permit) {
    if (permit.status === 'rejected' || permit.status === 'active' || permit.status === 'closed') return [];

    if (permit.isEmergency) {
      if (permit.status === 'submitted') {
        return [
          { key: 'reject', label: 'Reject Emergency', className: 'danger-button' },
          { key: 'approve-emergency', label: 'Approve Emergency', className: 'dark-button' },
        ];
      }

      if (permit.status === 'approved') {
        return [
          { key: 'reject', label: 'Reject Emergency', className: 'danger-button' },
          { key: 'activate-emergency', label: 'Activate Emergency Work', className: 'dark-button' },
        ];
      }

      return [];
    }

    if (permit.status === 'submitted') {
      return [
        { key: 'reject', label: 'Reject / Return', className: 'danger-button' },
        { key: 'approve-stage1', label: 'Approve MOS', className: 'dark-button' },
      ];
    }

    if (permit.status === 'stage1_complete') {
      return [
        { key: 'reject', label: 'Reject / Return', className: 'danger-button' },
        { key: 'approve-stage2', label: 'Approve Permit & Submit to Supervisor', className: 'dark-button' },
      ];
    }

    return [];
  }

  function getDecisionNotes() {
    return elements.permitDetail.querySelector('#decisionNotes')?.value.trim() || '';
  }

  async function handleDecision(permit, action) {
    const note = getDecisionNotes();

    try {
      if (action === 'reject') {
        if (!note) {
          showDecisionMessage('Please add a reason before rejecting or returning this permit.', true);
          return;
        }
        await applyStatus(permit, 'rejected', `Rejected by Safety Officer at ${getWorkflowStage(permit)}: ${note}`);
        showDecisionMessage('Permit rejected and returned to requester.', false);
        return;
      }

      if (action === 'approve-stage1') {
        await applyStatus(
          permit,
          'stage1_complete',
          approvalComment('Safety Officer approved MOS Approval. Permit moved to Permit Approval site validation.', note),
        );
        setView('stage2');
        return;
      }

      if (action === 'approve-stage2') {
        if (!(await ensureSiteValidationComplete(permit))) return;
        await applyStatus(
          permit,
          'approved',
          approvalComment(`Safety Officer approved Permit Approval. ${siteValidationSummary(permit)} Permit submitted to Supervisor for final approval.`, note),
        );
        state.selectedPermitId = null;
        setView('all');
        return;
      }

      if (action === 'approve-emergency') {
        if (!(await ensureSiteValidationComplete(permit))) return;
        await applyStatus(
          permit,
          'approved',
          approvalComment(`Safety Officer approved emergency permit MOS Approval and Permit Approval checks. ${siteValidationSummary(permit)}`, note),
          { refresh: false },
        );
        const updatedPermit = await getPermit(permit.id);
        await applyStatus(
          updatedPermit,
          'active',
          approvalComment(`Emergency permit final approval completed by Safety Officer. ${siteValidationSummary(permit)} Work is active.`, note),
        );
        setView('all');
        return;
      }

      if (action === 'activate-emergency') {
        if (!(await ensureSiteValidationComplete(permit))) return;
        await applyStatus(
          permit,
          'active',
          approvalComment(`Emergency permit final activation completed by Safety Officer. ${siteValidationSummary(permit)}`, note),
        );
        setView('all');
      }
    } catch (error) {
      showDecisionMessage(error.error || error.message || 'Unable to update permit decision.', true);
    }
  }

  async function ensureSiteValidationComplete(permit) {
    const siteFields = readSiteValidationFieldsFromDom(permit);
    persistSiteValidationFields(permit, siteFields);

    const missingFields = [
      ['Actual work date', siteFields.actualWorkDate],
      ['Actual location', siteFields.location],
    ].filter(([, value]) => !String(value || '').trim());
    if (missingFields.length) {
      showDecisionMessage(
        `Complete site validation field(s): ${missingFields.map(([label]) => label).join(', ')}.`,
        true,
      );
      elements.permitDetail.querySelector(`[data-site-field="${missingFields[0][0] === 'Actual work date' ? 'actualWorkDate' : missingFields[0][0] === 'Actual location' ? 'location' : 'attendance'}"]`)?.focus();
      return false;
    }

    if (!isActualWorkDateWithinPermitWindow(permit, siteFields.actualWorkDate)) {
      showDecisionMessage('Actual work date must be within the approved permit schedule.', true);
      elements.permitDetail.querySelector('[data-site-field="actualWorkDate"]')?.focus();
      return false;
    }

    const attendance = siteFields.attendance && typeof siteFields.attendance === 'object' ? siteFields.attendance : {};
    const assignedWorkerIds = permit.assignedWorkers || [];
    if (!assignedWorkerIds.length) {
      showDecisionMessage('At least one assigned worker is required before Permit Approval.', true);
      return false;
    }

    const presentWorkers = assignedWorkerIds.filter((workerId) => attendance[String(workerId || '').trim()]);
    if (!presentWorkers.length) {
      showDecisionMessage('Mark at least one assigned worker as present before Permit Approval.', true);
      elements.permitDetail.querySelector('[data-attendance-worker]')?.focus();
      return false;
    }

    const incompleteChecklist = getSiteValidationChecklists(permit).find(
      (checklist) => !isSiteChecklistComplete(permit.id, checklist),
    );
    if (!incompleteChecklist) {
      await saveSiteValidationToServer(permit);
      return true;
    }

    showDecisionMessage(`Complete ${incompleteChecklist.title} checklist before Permit Approval.`, true);
    openSiteChecklistDialog(permit, incompleteChecklist.key);
    return false;
  }

  function isActualWorkDateWithinPermitWindow(permit, actualWorkDate) {
    if (!actualWorkDate) return false;
    const startDay = dateOnlyFromValue(permit.startDateTime);
    const endDay = dateOnlyFromValue(permit.endDateTime);
    if (!startDay || !endDay) return true;
    return actualWorkDate >= startDay && actualWorkDate <= endDay;
  }

  function dateOnlyFromValue(value) {
    const direct = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  function siteValidationSummary(permit) {
    const fields = getSiteValidationFields(permit);
    const record = getSiteValidationRecord(permit);
    const attendance = fields.attendance && typeof fields.attendance === 'object' ? fields.attendance : {};
    const presentWorkers = (permit.assignedWorkers || [])
      .filter((workerId) => attendance[String(workerId || '').trim()])
      .map((workerId) => workerAttendanceIdentity(workerId).label);
    const checklistNotes = getSiteValidationChecklists(permit)
      .map((checklist) => {
        const notes = String(record?.[checklist.key]?.notes || '').trim();
        return notes ? `${checklist.title}: ${notes}` : '';
      })
      .filter(Boolean);
    return `Site validation confirmed. Actual work date: ${fields.actualWorkDate || '-'}; actual location: ${fields.location || '-'}; attendance: ${presentWorkers.join(', ') || '-'}${checklistNotes.length ? `; checklist notes: ${checklistNotes.join(' | ')}` : ''}.`;
  }

  function approvalComment(defaultComment, note) {
    return note ? `${defaultComment} Notes: ${note}` : defaultComment;
  }

  async function getPermit(id) {
    return normalizePermit(await apiRequest(`/api/permits/${encodeURIComponent(id)}`));
  }

  async function downloadDocument(permit, documentId) {
    const response = await fetch(
      `/api/permits/${encodeURIComponent(permit.id)}/documents/${encodeURIComponent(documentId)}/download`,
      {
        headers: {
          authorization: `Bearer ${state.session.token}`,
        },
      },
    );

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
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function permitExportFileName(permit) {
    const label = String(permit?.id || permit?.title || 'permit')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-');
    return `${label || 'permit'}-MOS-JSA.xlsx`;
  }

  async function downloadMosJsaExcel(permit) {
    const documents = ['MOS', 'JSA']
      .map((type) => getStructuredDocument(permit, type))
      .filter(Boolean);

    if (!documents.length) {
      throw new Error('No MOS/JSA digital form data available for export.');
    }

    const response = await fetch('/api/permit-document-templates/mos-jsa/export', {
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
    link.download = permitExportFileName(permit);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function applyStatus(permit, status, comment, options = {}) {
    const refreshAfter = options.refresh !== false;
    await apiRequest(`/api/permits/${encodeURIComponent(permit.id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    });

    if (refreshAfter) {
      await refresh({ preserveSelection: false });
    }
  }

  function showDecisionMessage(message, isError) {
    const messageElement = elements.permitDetail.querySelector('#decisionMessage');
    if (!messageElement) return;
    messageElement.textContent = message;
    messageElement.classList.toggle('error', Boolean(isError));
  }

  function stageFromLog(log, permit) {
    const comment = String(log.comment || '').toLowerCase();
    if (permit?.isEmergency) return 'Emergency';
    if (log.status === 'stage1_complete' || comment.includes('mos approval') || comment.includes('stage 1')) return 'MOS Approval';
    if (log.status === 'approved' || comment.includes('permit approval') || comment.includes('stage 2')) return 'Permit Approval';
    if (log.status === 'active') return 'Supervisor/Work';
    if (log.status === 'rejected') return 'Rejected';
    return 'Workflow';
  }

  function renderAudit() {
    elements.auditBody.innerHTML = state.audits.length
      ? state.audits
          .map(
            (audit) => `
              <tr>
                <td>${escapeHtml(formatDateTime(audit.when))}</td>
                <td>
                  <strong>${escapeHtml(audit.permit?.title || audit.permitId || '-')}</strong>
                  <span>${escapeHtml(audit.permit?.id || audit.permitId || '')}</span>
                </td>
                <td>${escapeHtml(stageFromLog(audit, audit.permit))}</td>
                <td>
                  <strong>${escapeHtml(formatStatus(audit.status || audit.action || '-'))}</strong>
                  <span>${escapeHtml(audit.comment || audit.action || '')}</span>
                </td>
              </tr>
            `,
          )
          .join('')
      : `
          <tr>
            <td colspan="4">No review history yet.</td>
          </tr>
        `;
    elements.auditCount.textContent = `${state.audits.length} record${state.audits.length === 1 ? '' : 's'}`;
  }

  async function refresh(options = {}) {
    const preserveSelection = options.preserveSelection !== false;
    const selected = preserveSelection ? state.selectedPermitId : null;
    await loadData();
    updateCounts();
    state.selectedPermitId = selected;

    if (state.activeView === 'audit') {
      renderAudit();
      return;
    }

    renderQueue();
  }

  function wireEvents() {
    elements.navItems.forEach((item) => {
      item.addEventListener('click', () => setView(item.dataset.view));
    });
    document.querySelectorAll('[data-summary-view]').forEach((card) => {
      const openSummaryView = () => setView(card.dataset.summaryView);
      card.addEventListener('click', openSummaryView);
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openSummaryView();
      });
    });
    elements.searchInput.addEventListener('input', () => {
      elements.searchClearButton.hidden = !elements.searchInput.value;
      renderQueue();
    });
    elements.searchClearButton.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.searchClearButton.hidden = true;
      elements.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      elements.searchInput.focus();
    });
    elements.refreshButton.addEventListener('click', () => refresh());
    elements.accountButton?.addEventListener('click', () => window.location.assign('/account'));
    elements.notificationButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      renderNotifications();
      setNotificationPanel(elements.notificationPanel?.hidden);
    });
    elements.notificationCloseButton?.addEventListener('click', () => setNotificationPanel(false));
    elements.notificationReadAllButton?.addEventListener('click', markAllNotificationsRead);
    elements.notificationList?.addEventListener('click', (event) => {
      const persistentButton = event.target.closest('[data-notification-id]');
      if (persistentButton) {
        const notificationId = persistentButton.dataset.notificationId;
        const link = persistentButton.dataset.notificationLink || '';
        const type = persistentButton.dataset.notificationType || '';
        const entityType = persistentButton.dataset.notificationEntityType || '';
        const entityId = persistentButton.dataset.notificationEntityId || '';
        apiRequest(`/api/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH' }).catch(() => {});
        state.notifications = state.notifications.map((notification) =>
          notification.id === notificationId ? { ...notification, unread: false } : notification,
        );
        renderNotifications();
        setNotificationPanel(false);
        if (link && link !== window.location.pathname) {
          window.location.assign(link);
          return;
        }
        const permit = entityType === 'permit' ? state.permits.find((item) => item.id === entityId) : null;
        if (permit) {
          state.selectedPermitId = permit.id;
          if (permit.isEmergency || type === 'emergency_permit_created') setView('emergency');
          else if (type === 'permit_stage1_complete') setView('stage2');
          else if (type === 'permit_rejected') setView('audit');
          else setView('stage1');
        } else {
          setView('all');
        }
        return;
      }

      const button = event.target.closest('[data-notification-view]');
      if (!button) return;
      setView(button.dataset.notificationView);
      setNotificationPanel(false);
    });
    elements.permitDetail?.addEventListener('click', (event) => {
      const checklistButton = event.target.closest('[data-site-checklist]');
      if (!checklistButton || !elements.permitDetail.contains(checklistButton)) return;

      event.preventDefault();
      event.stopPropagation();

      const permit = state.permits.find((item) => item.id === state.selectedPermitId);
      if (!permit) {
        showDecisionMessage('Select a permit before opening the checklist.', true);
        return;
      }

      openSiteChecklistDialog(permit, checklistButton.dataset.siteChecklist);
    });
    document.addEventListener('click', (event) => {
      if (elements.notificationPanel?.hidden) return;
      if (event.target.closest('.notification-wrap')) return;
      setNotificationPanel(false);
    });
    elements.logoutButton.addEventListener('click', () => {
      localStorage.removeItem('ptwSession');
      sessionStorage.removeItem('ptwSession');
      window.location.assign('/login');
    });
  }

  async function init() {
    if (!requireSafetyOfficer()) return;
    await refreshCurrentUser();
    wireEvents();
    await loadData();
    updateCounts();
    setView('all');
  }

  init().catch((error) => {
    elements.permitDetail.innerHTML = `
      <div class="empty-card">
        <strong>Unable to load Safety Officer Lane 3</strong>
        <p>${escapeHtml(error.error || error.message || 'Check backend connection.')}</p>
      </div>
    `;
  });
});
