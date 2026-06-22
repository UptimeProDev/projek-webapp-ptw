document.addEventListener('DOMContentLoaded', () => {
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
    notificationList: document.querySelector('#notificationList'),
    notificationCount: document.querySelector('#notificationCount'),
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
    queueItems: document.querySelector('#queueItems'),
    permitDetail: document.querySelector('#permitDetail'),
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
  };

  const viewCopy = {
    all: {
      title: 'Safety Officer Dashboard',
      subtitle: 'Review active safety work, stage decisions, emergency approvals, and returned permits.',
      queue: 'All Safety Officer Permits',
      hint: 'Select any permit to inspect requester details and complete the current safety stage.',
    },
    stage1: {
      title: 'Stage 1 MOS Approval',
      subtitle: 'Review methodology, HIRARC/JSA, RAMS/SWP, ERP, hazards, controls, PPE, and competency evidence.',
      queue: 'Stage 1 Review Queue',
      hint: 'Normal permits submitted by Admin and waiting for Safety Officer Stage 1 approval.',
    },
    stage2: {
      title: 'Stage 2 Site Validation',
      subtitle: 'Validate site readiness before sending normal permits to Supervisor final approval.',
      queue: 'Stage 2 Validation Queue',
      hint: 'Permits that passed Stage 1 and need site validation.',
    },
    emergency: {
      title: 'Emergency Permit Approval',
      subtitle: 'Emergency permits come directly from Requester and are finally approved by Safety Officer.',
      queue: 'Emergency Review Queue',
      hint: 'Review Stage 1 evidence and Stage 2 site readiness together, then approve or reject.',
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
        label: 'Stage 1',
        title: `${stage1} Stage 1 review${stage1 === 1 ? '' : 's'}`,
        body: 'Review methodology, HIRARC, JSA, ERP, controls, and PPE.',
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

    const items = safetyNotificationItems();
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

  function requireSafetyOfficer() {
    if (state.session?.user?.role === 'safety_officer') {
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
      status: String(permit.status || 'draft').toLowerCase(),
    };
  }

  function getPermitType(permit) {
    if (permit.workType) return permit.workType;
    const match = String(permit.description || '').match(/Permit Type:\s*([^\n]+)/i);
    return match ? match[1].trim() : 'General Maintenance';
  }

  function getWorkflowStage(permit) {
    if (permit.isEmergency) {
      if (permit.status === 'active') return 'Emergency Approved';
      if (permit.status === 'rejected') return 'Emergency Rejected';
      if (permit.status === 'approved') return 'Emergency Final Activation';
      return 'Emergency Review';
    }

    if (permit.status === 'submitted') return 'Stage 1 Review';
    if (permit.status === 'stage1_complete') return 'Stage 2 Validation';
    if (permit.status === 'approved') return 'Supervisor Final Approval';
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
      approved: 4,
      active: 5,
      rejected: 6,
      closed: 7,
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
      renderQueueSection('Emergency Priority', sortLatest(queue.filter((permit) => permit.isEmergency)));
      renderQueueSection('Latest Permits', sortLatest(queue.filter((permit) => !permit.isEmergency)));
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
      <span>${escapeHtml(permit.id)}</span>
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

  function renderPermitDetail(permit) {
    const stage = getWorkflowStage(permit);

    elements.permitDetail.innerHTML = `
      <div class="detail-head">
        <div>
          <span class="detail-id">${escapeHtml(permit.id)}</span>
          <h3>${escapeHtml(permit.title || 'Untitled permit')}</h3>
          <p>${escapeHtml(permit.location || '-')} - ${escapeHtml(getPermitType(permit))}</p>
        </div>
        <span class="status ${escapeHtml(statusClass(permit))}">${escapeHtml(stage)}</span>
      </div>

      ${renderWorkflow(permit)}

      <section class="detail-section">
        <h4>Requester Details</h4>
        <div class="detail-grid">
          ${infoBlock('Requested By', permit.requestedBy || '-')}
          ${infoBlock('Permit Type', getPermitType(permit))}
          ${infoBlock('Start', formatDateTime(permit.startDateTime))}
          ${infoBlock('End', formatDateTime(permit.endDateTime))}
        </div>
      </section>

      <section class="detail-section">
        <h4>Work Information</h4>
        <div class="info-block wide">
          <strong>Description</strong>
          <p>${escapeHtml(permit.description || '-')}</p>
        </div>
      </section>

      <section class="detail-section">
        <h4>Risk Evidence</h4>
        <div class="detail-grid">
          ${infoBlock('Hazards', listText(permit.hazards))}
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

      ${needsSiteValidation(permit) ? renderSiteValidation(permit) : ''}

      ${renderDecisionPanel(permit)}
    `;

    elements.permitDetail.querySelectorAll('[data-download-document]').forEach((button) => {
      button.addEventListener('click', () => {
        const documentId = button.dataset.downloadDocument;
        downloadDocument(permit, documentId).catch((error) => {
          showDecisionMessage(error.error || error.message || 'Unable to open permit document.', true);
        });
      });
    });

    elements.permitDetail.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => handleDecision(permit, button.dataset.action));
    });
  }

  function renderWorkflow(permit) {
    const isEmergency = Boolean(permit.isEmergency);
    const steps = isEmergency
      ? [
          { key: 'submitted', label: 'Requester Submit' },
          { key: 'safety', label: 'SO Stage 1 + 2' },
          { key: 'active', label: 'Final Approved' },
        ]
      : [
          { key: 'submitted', label: 'Admin Submit' },
          { key: 'stage1', label: 'SO Stage 1' },
          { key: 'stage2', label: 'SO Stage 2' },
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

  function listText(items) {
    return Array.isArray(items) && items.length ? items.join('\n') : '-';
  }

  function workerText(permit) {
    if (!permit.assignedWorkers.length) return '-';

    return permit.assignedWorkers
      .map((workerId) => {
        const worker = state.workers.find((item) =>
          [item.id, item.employeeId, item.name, item.email].filter(Boolean).includes(workerId),
        );
        if (!worker) return workerId;
        return `${worker.name} (${worker.employeeId || worker.id}) - ${formatStatus(worker.status || 'valid')}`;
      })
      .join('\n');
  }

  function renderDocuments(permit) {
    const rows = permit.documents.length
      ? permit.documents
          .map((document) => {
            const canDownload = document.id && document.hasAttachment;
            return `
              <li>
                <div>
                  <strong>${escapeHtml(document.type || 'Document')}</strong>
                  <span>${escapeHtml(document.name || document.fileName || '-')}</span>
                </div>
                ${
                  canDownload
                    ? `<button class="mini-button" type="button" data-download-document="${escapeHtml(document.id)}">View</button>`
                    : '<em>No file</em>'
                }
              </li>
            `;
          })
          .join('')
      : '<li><div><strong>No documents</strong><span>Requester has not attached documents.</span></div></li>';

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

  function renderSiteValidation(permit) {
    return `
      <section class="detail-section site-panel" id="siteValidationPanel">
        <h4>Stage 2 Site Validation</h4>
        <div class="site-grid">
          <label>
            <span>Actual work date</span>
            <input data-site-field="actualWorkDate" type="date" value="${escapeHtml(formatDateOnly(permit.startDateTime))}">
          </label>
          <label>
            <span>Actual location</span>
            <input data-site-field="location" type="text" value="${escapeHtml(permit.location || '')}">
          </label>
          <label class="wide">
            <span>Attendance</span>
            <input data-site-field="attendance" type="text" value="${escapeHtml(permit.assignedWorkers.join(', '))}">
          </label>
        </div>
        <div class="check-grid">
          ${siteCheck('toolboxTalkCompleted', 'TBT completed')}
          ${siteCheck('ppeVerified', 'PPE verified')}
          ${siteCheck('gasTestValid', 'Gas test valid')}
          ${siteCheck('fireWatchAssigned', 'Fire watch assigned')}
          ${siteCheck('barricadingVerified', 'Barricading verified')}
          ${siteCheck('standbyPersonAssigned', 'Standby person assigned')}
          ${siteCheck('rescueEquipmentReady', 'Rescue equipment ready')}
          ${siteCheck('ventilationVerified', 'Ventilation verified')}
          ${siteCheck('scaffoldInspectionValid', 'Scaffold inspected')}
          ${siteCheck('lotoVerified', 'LOTO verified')}
          ${siteCheck('liftingExclusionZoneVerified', 'Lifting exclusion zone')}
          ${siteCheck('excavationProtectionVerified', 'Excavation protection')}
          ${siteCheck('chemicalControlsVerified', 'Chemical controls')}
        </div>
      </section>
    `;
  }

  function siteCheck(field, label) {
    return `
      <label>
        <input data-site-field="${field}" type="checkbox">
        ${escapeHtml(label)}
      </label>
    `;
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
      return 'Stage 2 is complete. This normal permit is now waiting for Supervisor final approval before work starts.';
    }

    if (permit.status === 'active') {
      return 'Work has started. Supervisor monitoring controls now apply.';
    }

    if (permit.status === 'rejected') {
      return 'Permit was rejected or returned to requester for correction.';
    }

    if (permit.status === 'stage1_complete') {
      return 'Stage 1 passed. Complete Stage 2 site validation, then submit to Supervisor.';
    }

    return permit.isEmergency
      ? 'Emergency review covers Stage 1 evidence and Stage 2 site readiness. Approving here is the final safety approval.'
      : 'Review Stage 1 evidence. Approve to move this permit to Stage 2, or reject to return it to the requester.';
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
        { key: 'approve-stage1', label: 'Approve Stage 1', className: 'dark-button' },
      ];
    }

    if (permit.status === 'stage1_complete') {
      return [
        { key: 'reject', label: 'Reject / Return', className: 'danger-button' },
        { key: 'approve-stage2', label: 'Approve Stage 2 & Submit to Supervisor', className: 'dark-button' },
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
          approvalComment('Safety Officer approved Stage 1. Permit moved to Stage 2 site validation.', note),
        );
        setView('stage2');
        return;
      }

      if (action === 'approve-stage2') {
        await applyStatus(
          permit,
          'approved',
          approvalComment('Safety Officer approved Stage 2. Permit submitted to Supervisor for final approval.', note),
        );
        setView('all');
        return;
      }

      if (action === 'approve-emergency') {
        await applyStatus(
          permit,
          'approved',
          approvalComment('Safety Officer approved emergency permit Stage 1 and Stage 2 checks.', note),
          { refresh: false },
        );
        const updatedPermit = await getPermit(permit.id);
        await applyStatus(
          updatedPermit,
          'active',
          approvalComment('Emergency permit final approval completed by Safety Officer. Work is active.', note),
        );
        setView('all');
        return;
      }

      if (action === 'activate-emergency') {
        await applyStatus(
          permit,
          'active',
          approvalComment('Emergency permit final activation completed by Safety Officer.', note),
        );
        setView('all');
      }
    } catch (error) {
      showDecisionMessage(error.error || error.message || 'Unable to update permit decision.', true);
    }
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
    if (log.status === 'stage1_complete' || comment.includes('stage 1')) return 'Stage 1';
    if (log.status === 'approved' || comment.includes('stage 2')) return 'Stage 2';
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
    elements.searchInput.addEventListener('input', renderQueue);
    elements.refreshButton.addEventListener('click', () => refresh());
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
