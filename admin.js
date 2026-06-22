document.addEventListener('DOMContentLoaded', () => {
  const COMPLETION_STORAGE_KEY = 'ptwWorkerCompletionRequests';

  const elements = {
    searchInput: document.querySelector('#searchInput'),
    navItems: Array.from(document.querySelectorAll('.nav-item')),
    sectionStatus: document.querySelector('#sectionStatus'),
    profileName: document.querySelector('.profile-name'),
    profileRole: document.querySelector('.profile-role'),
    profileAvatar: document.querySelector('.avatar'),
    adminWarning: document.querySelector('#adminWarning'),
    competencyBody: document.querySelector('#competencyBody'),
    competencyCount: document.querySelector('#competencyCount'),
    queueItems: document.querySelector('#queueItems'),
    queueCount: document.querySelector('#queueCount'),
    queueDetail: document.querySelector('#queueDetail'),
    routingItems: document.querySelector('#routingItems'),
    routingCount: document.querySelector('#routingCount'),
    routingDetail: document.querySelector('#routingDetail'),
    auditBody: document.querySelector('#auditBody'),
    auditCount: document.querySelector('#auditCount'),
    refreshButton: document.querySelector('#refreshButton'),
    topbarRefreshButton: document.querySelector('#topbarRefreshButton'),
    logoutButton: document.querySelector('#adminLogoutButton'),
    notificationButton: document.querySelector('#notificationButton'),
    notificationPanel: document.querySelector('#notificationPanel'),
    notificationCloseButton: document.querySelector('#notificationCloseButton'),
    notificationList: document.querySelector('#notificationList'),
    notificationCount: document.querySelector('#notificationCount'),
    accountButton: document.querySelector('#accountButton'),
    filtersToggle: document.querySelector('#filtersToggle'),
    filterPanel: document.querySelector('#filterPanel'),
    filterStatus: document.querySelector('#filterStatus'),
    filterPermit: document.querySelector('#filterPermit'),
    clearFiltersButton: document.querySelector('#clearFiltersButton'),
    addWorkerButton: document.querySelector('#addWorkerButton'),
    addWorkerForm: document.querySelector('#addWorkerForm'),
    addWorkerSubmit: document.querySelector('#addWorkerSubmit'),
    newWorkerName: document.querySelector('#newWorkerName'),
    newWorkerIcPassport: document.querySelector('#newWorkerIcPassport'),
    newWorkerId: document.querySelector('#newWorkerId'),
    newWorkerPhone: document.querySelector('#newWorkerPhone'),
    newWorkerEmail: document.querySelector('#newWorkerEmail'),
    newWorkerCompany: document.querySelector('#newWorkerCompany'),
    newWorkerRole: document.querySelector('#newWorkerRole'),
    newWorkerPermits: document.querySelector('#newWorkerPermits'),
    newWorkerCertifications: document.querySelector('#newWorkerCertifications'),
    addCertificationButton: document.querySelector('#addCertificationButton'),
    workerReviewDialog: document.querySelector('#workerReviewDialog'),
    workerReviewTitle: document.querySelector('#workerReviewTitle'),
    workerReviewSubtitle: document.querySelector('#workerReviewSubtitle'),
    workerReviewBody: document.querySelector('#workerReviewBody'),
    workerReturnReason: document.querySelector('#workerReturnReason'),
    approveWorkerButton: document.querySelector('#approveWorkerButton'),
    returnWorkerButton: document.querySelector('#returnWorkerButton'),
    settingsButton: document.querySelector('#settingsButton'),
    supportButton: document.querySelector('#supportButton'),
  };

  const sectionPanels = {
    competency: document.querySelector('#manageCompetencySection'),
    draftReview: document.querySelector('#permitQueueSection'),
    routing: document.querySelector('#permitClosureSection'),
    auditTrails: document.querySelector('#auditTrailsSection'),
  };

  const state = {
    session: readSession(),
    workers: [],
    permits: [],
    audits: [],
    notifications: [],
    completionRequests: readStoredObject(COMPLETION_STORAGE_KEY),
    activeSection: 'competency',
    activeReviewWorkerId: '',
  };

  const workerPermitTypes = [
    'Hot Work',
    'Confined Space',
    'Electrical Isolation',
    'Work at Height',
    'Line Breaking',
    'General Maintenance',
  ];

  const workerRoleOptions = [
    'Welder',
    'Senior Welder',
    'Fire Watch',
    'Authorized Gas Tester',
    'Confined Space Entrant',
    'Confined Space Attendant',
    'Electrical Technician',
    'LOTO Authorized Person',
    'Work at Height Worker',
    'Scaffold Inspector',
    'Mechanical Technician',
    'Line Breaking Technician',
    'Chemical Handler',
    'General Maintenance Technician',
    'Maintenance Technician',
    'Site Supervisor',
    'Safety Officer',
  ];

  const certificationTypeOptions = [
    'Safety Induction',
    'Hot Work',
    'Fire Watch',
    'Authorized Gas Tester',
    'Confined Space Entry',
    'Confined Space Attendant',
    'Electrical Competency',
    'LOTO',
    'Work at Height',
    'Scaffold Inspector',
    'Line Breaking',
    'Chemical Handling',
    'First Aid',
  ];

  const workerPermitAliases = new Map(
    [
      ['Hot Work', 'Hot Work'],
      ['Hotwork', 'Hot Work'],
      ['Confined Space', 'Confined Space'],
      ['Confinedspace', 'Confined Space'],
      ['Electrical Isolation', 'Electrical Isolation'],
      ['Electrical', 'Electrical Isolation'],
      ['LOTO', 'Electrical Isolation'],
      ['Lockout Tagout', 'Electrical Isolation'],
      ['Work at Height', 'Work at Height'],
      ['Working at Height', 'Work at Height'],
      ['WAH', 'Work at Height'],
      ['Line Breaking', 'Line Breaking'],
      ['Line Break', 'Line Breaking'],
      ['General Maintenance', 'General Maintenance'],
      ['Maintenance', 'General Maintenance'],
    ].map(([alias, canonical]) => [permitTypeKey(alias), canonical]),
  );

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

  function clearSession() {
    localStorage.removeItem('ptwSession');
    sessionStorage.removeItem('ptwSession');
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

  function getRoleUrl(role) {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'requester') return '/dashboard';
    if (normalized === 'safety_officer') return '/safety';
    if (normalized === 'supervisor') return '/review';
    if (normalized === 'approver') return '/approver';
    if (normalized === 'worker') return '/worker';
    return '/login';
  }

  function redirectToRoleHome() {
    const target = getRoleUrl(state.session?.user?.role);
    if (target !== '/login') {
      window.location.replace(target);
      return true;
    }

    return false;
  }

  async function apiRequest(path, options = {}) {
    if (!state.session?.token) {
      throw new Error('Admin session required');
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

  function permitTypeKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function canonicalPermitType(value) {
    return workerPermitAliases.get(permitTypeKey(value)) || '';
  }

  function normalizeWorkerPermits(permits, options = {}) {
    const values = Array.isArray(permits) ? permits : String(permits || '').split(',');
    const normalized = [];
    const seen = new Set();

    values.forEach((permit) => {
      const raw = String(permit || '').trim();
      if (!raw) return;

      const label = canonicalPermitType(raw) || (options.dropUnknown ? '' : raw);
      const key = permitTypeKey(label);
      if (!label || seen.has(key)) return;

      seen.add(key);
      normalized.push(label);
    });

    return normalized;
  }

  function renderPermitTypePicker() {
    if (!elements.newWorkerPermits) return;

    elements.newWorkerPermits.innerHTML = workerPermitTypes
      .map(
        (permitType) => `
          <label class="permit-type-option">
            <input type="checkbox" value="${escapeHtml(permitType)}" />
            ${escapeHtml(permitType)}
          </label>
        `,
      )
      .join('');
  }

  function renderWorkerRoleOptions(selectedRole = '') {
    if (!elements.newWorkerRole) return;

    const normalizedSelected = String(selectedRole || '').trim();
    const roles = workerRoleOptions.includes(normalizedSelected) || !normalizedSelected
      ? workerRoleOptions
      : [...workerRoleOptions, normalizedSelected];

    elements.newWorkerRole.innerHTML = [
      '<option value="">Select role / trade</option>',
      ...roles.map(
        (role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`,
      ),
    ].join('');
    elements.newWorkerRole.value = normalizedSelected;
  }

  function getSelectedWorkerPermits() {
    return Array.from(elements.newWorkerPermits?.querySelectorAll('input[type="checkbox"]:checked') || [])
      .map((checkbox) => checkbox.value);
  }

  function setSelectedWorkerPermits(permits = []) {
    const selected = new Set(normalizeWorkerPermits(permits, { dropUnknown: true }));

    elements.newWorkerPermits
      ?.querySelectorAll('input[type="checkbox"]')
      .forEach((checkbox) => {
        checkbox.checked = selected.has(checkbox.value);
      });
  }

  function normalizeWorkerCertifications(certifications = []) {
    const source = Array.isArray(certifications) ? certifications : [];

    return source
      .map((certification) => {
        if (typeof certification === 'string') {
          return {
            id: '',
            type: certification.trim(),
            number: '',
            issuer: '',
            issueDate: '',
            expiryDate: '',
            fileName: '',
            mimeType: '',
            hasAttachment: false,
          };
        }

        return {
          id: String(certification?.id || '').trim(),
          type: String(certification?.type || certification?.name || '').trim(),
          number: String(certification?.number || certification?.certificateNo || '').trim(),
          issuer: String(certification?.issuer || '').trim(),
          issueDate: String(certification?.issueDate || '').trim(),
          expiryDate: String(certification?.expiryDate || certification?.expiry || '').trim(),
          fileName: String(certification?.fileName || certification?.attachmentName || '').trim(),
          mimeType: String(certification?.mimeType || certification?.attachmentMimeType || '').trim(),
          attachmentData: String(certification?.attachmentData || certification?.fileData || certification?.contentBase64 || '').trim(),
          hasAttachment: Boolean(certification?.hasAttachment || certification?.attachmentData),
        };
      })
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
          certification.hasAttachment ? '1' : '',
        ].some((value) => String(value || '').trim()),
      );
  }

  async function downloadWorkerCertification(workerId, certificationId, fileName) {
    const response = await fetch(`/api/workers/${encodeURIComponent(workerId)}/certifications/${encodeURIComponent(certificationId)}/download`, {
      headers: {
        authorization: `Bearer ${state.session.token}`,
      },
    });

    if (!response.ok) {
      let message = 'Unable to download certificate.';
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {
        // Ignore non-JSON body.
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName || 'certificate';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  }

  async function readFileAsBase64(file) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const marker = result.indexOf(',');
        resolve(marker >= 0 ? result.slice(marker + 1) : result);
      };
      reader.onerror = () => reject(new Error('Unable to read uploaded file.'));
      reader.readAsDataURL(file);
    });
  }

  async function downloadPermitDocument(permitId, documentId, fileName) {
    const response = await fetch(`/api/permits/${encodeURIComponent(permitId)}/documents/${encodeURIComponent(documentId)}/download`, {
      headers: {
        authorization: `Bearer ${state.session.token}`,
      },
    });

    if (!response.ok) {
      let message = 'Unable to download permit document.';
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {
        // Ignore non-JSON body.
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName || 'permit-document';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  }

  function getWorkerRecord(id) {
    return state.workers.find((worker) => String(worker.id) === String(id));
  }

  function renderReviewDetail(label, value) {
    return `
      <div class="review-detail">
        <span>${escapeHtml(label)}</span>
        <p>${escapeHtml(value || '-')}</p>
      </div>
    `;
  }

  function workerSubmitterLabel(worker) {
    return worker.createdByName || worker.createdByEmail || worker.createdByEmployeeId || worker.createdBy || '-';
  }

  function renderWorkerCertificationReview(worker) {
    const certifications = normalizeWorkerCertifications(worker.certifications);
    if (!certifications.length) {
      return '<p class="muted">No certification records submitted.</p>';
    }

    return `
      <div class="review-cert-list">
        ${certifications
          .map((certification, index) => {
            const certificateName = certification.type || `Certification ${index + 1}`;
            return `
              <article class="review-cert">
                <div class="review-cert-head">
                  <div>
                    <strong>${escapeHtml(certificateName)}</strong>
                    <div class="meta-muted">Certificate No: ${escapeHtml(certification.number || '-')}</div>
                  </div>
                  ${
                    certification.hasAttachment && certification.id
                      ? `<button class="btn small secondary cert-download" type="button" data-worker-cert-download="${escapeHtml(worker.id)}" data-certification-id="${escapeHtml(certification.id)}" data-file-name="${escapeHtml(certification.fileName || 'certificate')}">Download File</button>`
                      : '<span class="review-file-missing">No downloadable file</span>'
                  }
                </div>
                <div class="review-cert-meta">
                  <span class="tag">Issuer: ${escapeHtml(certification.issuer || '-')}</span>
                  <span class="tag">Issue: ${escapeHtml(certification.issueDate || '-')}</span>
                  <span class="tag">Expiry: ${escapeHtml(certification.expiryDate || '-')}</span>
                  <span class="tag">File: ${escapeHtml(certification.fileName || '-')}</span>
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    `;
  }

  function renderCertificationEditor(certifications = []) {
    if (!elements.newWorkerCertifications) return;

    const rows = normalizeWorkerCertifications(certifications);
    if (!rows.length) {
      rows.push({ type: '', number: '', issuer: '', issueDate: '', expiryDate: '', fileName: '' });
    }

    elements.newWorkerCertifications.innerHTML = rows
      .map((certification) => certificationRowTemplate(certification))
      .join('');
  }

  function certificationRowTemplate(certification) {
    const types = certification.type && !certificationTypeOptions.includes(certification.type)
      ? [...certificationTypeOptions, certification.type]
      : certificationTypeOptions;
    const typeOptions = [
      '<option value="">Select type</option>',
      ...types.map((type) => {
        const selected = certification.type === type ? 'selected' : '';
        return `<option value="${escapeHtml(type)}" ${selected}>${escapeHtml(type)}</option>`;
      }),
    ].join('');

    return `
      <div class="certification-row" data-cert-id="${escapeHtml(certification.id || '')}" data-cert-file-name="${escapeHtml(certification.fileName)}" data-cert-has-attachment="${certification.hasAttachment ? 'true' : 'false'}">
        <div class="certification-field">
          <label>Type</label>
          <select data-cert-field="type">${typeOptions}</select>
        </div>
        <div class="certification-field">
          <label>Certificate No.</label>
          <input data-cert-field="number" value="${escapeHtml(certification.number)}" placeholder="CERT-001" />
        </div>
        <div class="certification-field">
          <label>Issuer</label>
          <input data-cert-field="issuer" value="${escapeHtml(certification.issuer)}" placeholder="NIOSH / DOSH" />
        </div>
        <div class="certification-field">
          <label>Issue Date</label>
          <input data-cert-field="issueDate" type="date" value="${escapeHtml(certification.issueDate)}" />
        </div>
        <div class="certification-field">
          <label>Expiry Date</label>
          <input data-cert-field="expiryDate" type="date" value="${escapeHtml(certification.expiryDate)}" />
        </div>
        <div class="certification-field">
          <label>Certificate File</label>
          <input data-cert-field="file" type="file" accept=".pdf,.jpg,.jpeg,.png" />
          <small>${escapeHtml(certification.fileName || 'No file selected')}</small>
        </div>
        <button class="btn small secondary certification-remove" type="button" data-cert-remove>Remove</button>
      </div>
    `;
  }

  function addCertificationRow(certification = {}) {
    if (!elements.newWorkerCertifications) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = certificationRowTemplate({
      type: '',
      number: '',
      issuer: '',
      issueDate: '',
      expiryDate: '',
      fileName: '',
      ...certification,
    }).trim();
    elements.newWorkerCertifications.append(wrapper.firstElementChild);
  }

  async function readWorkerCertifications() {
    return normalizeWorkerCertifications(
      await Promise.all(Array.from(elements.newWorkerCertifications?.querySelectorAll('.certification-row') || []).map(async (row) => {
        const file = row.querySelector('[data-cert-field="file"]')?.files?.[0];
        return {
          id: row.dataset.certId || '',
          type: row.querySelector('[data-cert-field="type"]')?.value || '',
          number: row.querySelector('[data-cert-field="number"]')?.value || '',
          issuer: row.querySelector('[data-cert-field="issuer"]')?.value || '',
          issueDate: row.querySelector('[data-cert-field="issueDate"]')?.value || '',
          expiryDate: row.querySelector('[data-cert-field="expiryDate"]')?.value || '',
          fileName: file?.name || row.dataset.certFileName || '',
          mimeType: file?.type || '',
          attachmentData: file ? await readFileAsBase64(file) : '',
          hasAttachment: file ? true : row.dataset.certHasAttachment === 'true',
        };
      })),
    );
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

  function formatStatus(status) {
    return String(status || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getPermitType(permit) {
    if (permit.workType) return permit.workType;
    const match = String(permit.description || '').match(/Permit Type:\s*([^\n]+)/i);
    return match ? match[1].trim() : 'General Maintenance';
  }

  function extractScope(description) {
    return String(description || '')
      .split('\n')
      .filter((line) => !/^Permit Class:/i.test(line.trim()))
      .filter((line) => !/^Review Route:/i.test(line.trim()))
      .filter((line) => !/^Permit Type:/i.test(line.trim()))
      .filter((line) => !/^Assigned Worker/i.test(line.trim()))
      .filter((line) => !/^Required Documents:/i.test(line.trim()))
      .join('\n')
      .trim();
  }

  function formatList(values) {
    const list = Array.isArray(values) ? values : [];
    return list.length ? list.join(', ') : '-';
  }

  function renderPermitDocumentCards(permit) {
    const documents = Array.isArray(permit?.documents) ? permit.documents : [];
    if (!documents.length) {
      return '<div class="document-empty">No documents uploaded for this draft.</div>';
    }

    return `
      <div class="permit-document-grid">
        ${documents
          .map((document) => {
            const fileName = document.fileName || document.name || 'permit-document';
            return `
              <article class="permit-document-card">
                <div>
                  <strong>${escapeHtml(document.type || 'Document')}</strong>
                  <span>${escapeHtml(document.name || '-')}</span>
                  <small>${escapeHtml(document.mimeType || 'Uploaded document')}</small>
                </div>
                ${
                  document.id && document.hasAttachment
                    ? `<button class="btn small secondary" type="button" data-permit-document-download="${escapeHtml(permit.id)}" data-document-id="${escapeHtml(document.id)}" data-file-name="${escapeHtml(fileName)}">Download</button>`
                    : '<em>No downloadable file</em>'
                }
              </article>
            `;
          })
          .join('')}
      </div>
    `;
  }

  function statusBadge(status) {
    const normalized = String(status || '').toLowerCase();
    if (['valid', 'approved', 'active'].includes(normalized)) return 'valid';
    if (['submitted', 'stage1_complete'].includes(normalized)) return 'pending';
    if (['expired', 'rejected', 'returned'].includes(normalized)) return 'danger';
    if (['expiring', 'warning', 'draft'].includes(normalized)) return 'warn';
    return 'pending';
  }

  function workerStatusLabel(status) {
    const normalized = String(status || 'submitted').toLowerCase();
    if (normalized === 'valid') return 'Valid';
    if (normalized === 'rejected') return 'Returned';
    if (normalized === 'expired') return 'Expired';
    return 'Submitted';
  }

  function updateProfile(user) {
    const name = user?.fullName || 'PTW Admin';
    elements.profileName.textContent = name;
    elements.profileRole.textContent = 'Admin - Lane 2';
    if (user?.profilePictureUrl) {
      elements.profileAvatar.innerHTML = `<img src="${escapeHtml(user.profilePictureUrl)}" alt="">`;
      return;
    }
    elements.profileAvatar.textContent = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'AD';
  }

  function requireAdmin() {
    if (state.session?.user?.role === 'admin') {
      elements.adminWarning?.classList.add('hidden');
      updateProfile(state.session.user);
      return true;
    }

    if (redirectToRoleHome()) {
      return false;
    }

    elements.adminWarning?.classList.remove('hidden');
    Object.values(sectionPanels).forEach((panel) => panel?.classList.add('hidden'));
    elements.sectionStatus.textContent = 'Please sign in as an administrator to access Lane 2.';
    setTimeout(() => window.location.assign('/login'), 700);
    return false;
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

    const invalid = state.workers.filter((worker) => String(worker.status || '').toLowerCase() !== 'valid').length;
    const drafts = getDraftQueue().length;
    const items = [
      {
        label: 'Worker Review',
        title: `${invalid} worker profile${invalid === 1 ? '' : 's'} need review`,
        body: 'Review submitted or returned worker competency records.',
      },
      {
        label: 'Draft Review',
        title: `${drafts} draft permit${drafts === 1 ? '' : 's'} in queue`,
        body: 'Complete Lane 2 clerical checks before formal routing.',
      },
    ];

    elements.notificationCount.textContent = `${items.length} items`;
    elements.notificationList.innerHTML = items
      .map((item) => `
        <button class="notification-item" type="button" data-notification-section="${item.label === 'Worker Review' ? 'competency' : 'draftReview'}">
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

  async function loadData() {
    const [workerResult, permitResult, notificationResult] = await Promise.all([
      apiRequest('/api/workers'),
      apiRequest('/api/permits'),
      loadNotifications(),
    ]);

    state.workers = workerResult.workers || workerResult.data || [];
    state.permits = permitResult.permits || permitResult.data || [];
    state.notifications = notificationResult.notifications || notificationResult.data || [];
    state.completionRequests = readStoredObject(COMPLETION_STORAGE_KEY);
    syncRequesterWorkersStorage();
    renderNotifications();
  }

  async function loadNotifications() {
    try {
      return await apiRequest('/api/notifications?limit=20');
    } catch {
      return { notifications: [] };
    }
  }

  function syncRequesterWorkersStorage() {
    const requesterWorkers = state.workers.map((worker, index) => ({
      id: worker.employeeId || worker.id || `W${String(index + 1).padStart(2, '0')}`,
      systemId: worker.id,
      name: worker.name,
      role: worker.role || '',
      icPassport: worker.icPassport || '',
      phone: worker.phone || '',
      email: worker.email || '',
      company: worker.company || '',
      status: String(worker.status || 'submitted').toLowerCase(),
      reviewComment: worker.reviewComment || '',
      permits: normalizeWorkerPermits(worker.permits),
      qualifications: normalizeWorkerPermits(worker.permits),
      certifications: normalizeWorkerCertifications(worker.certifications),
    }));
    localStorage.setItem('ptwRequesterWorkers', JSON.stringify(requesterWorkers));
  }

  function addAudit(action, status = 'Completed') {
    const timestamp = new Date();
    state.audits.unshift({
      time: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sortTime: timestamp.getTime(),
      actor: state.session?.user?.fullName || 'PTW Admin',
      action,
      status,
    });
    renderAudit();
  }

  function setActiveSection(section) {
    state.activeSection = section;
    elements.navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.section === section);
    });
    Object.entries(sectionPanels).forEach(([key, panel]) => {
      panel?.classList.toggle('hidden', key !== section);
      panel?.classList.toggle('active', key === section);
    });

    const titles = {
      competency: 'Worker Profile Review',
      draftReview: 'Review Draft Permits',
      auditTrails: 'Admin Audit Trail',
    };
    const subtitles = {
      competency: 'Review requester-submitted worker profiles, certifications, and permit authorization records.',
      draftReview: 'Clerically verify draft package completeness and formally submit to pending approval.',
      auditTrails: 'Track Lane 2 administrative actions and final closure history.',
    };

    document.querySelector('.page-head h2').textContent = titles[section];
    document.querySelector('.page-head p').textContent = subtitles[section];
    elements.sectionStatus.textContent = `${titles[section]} - ${subtitles[section]}`;
    updateSearchResults();
  }

  function getCompetencyFilters() {
    return {
      status: elements.filterStatus?.value || '',
      permit: elements.filterPermit?.value || '',
    };
  }

  function renderCompetency(query = '') {
    const lowerQuery = query.trim().toLowerCase();
    const filters = getCompetencyFilters();
    const rows = state.workers.filter((worker) => {
      const workerPermits = normalizeWorkerPermits(worker.permits);
      const workerCertifications = normalizeWorkerCertifications(worker.certifications);
      const normalizedStatus = workerStatusLabel(worker.status);
      const searchable = [
        worker.name,
        worker.icPassport,
        worker.employeeId,
        worker.phone,
        worker.email,
        worker.company,
        worker.role,
        ...workerPermits,
        ...workerCertifications.flatMap((certification) => [
          certification.type,
          certification.number,
          certification.issuer,
          certification.expiryDate,
        ]),
      ].join(' ').toLowerCase();

      if (filters.status && filters.status !== normalizedStatus) return false;
      if (filters.permit && !workerPermits.includes(filters.permit)) return false;
      return !lowerQuery || searchable.includes(lowerQuery);
    });

    elements.competencyBody.innerHTML = '';
    document.querySelector('#competencyEmpty')?.classList.toggle('hidden', rows.length > 0);

    rows.forEach((worker) => {
      const status = workerStatusLabel(worker.status);
      const permits = normalizeWorkerPermits(worker.permits)
        .map((permit) => `<span class="admin-permit-chip">${escapeHtml(permit)}</span>`)
        .join(' ');
      const certifications = normalizeWorkerCertifications(worker.certifications);
      const certificationSummary = certifications.length
        ? certifications
            .map((certification) => {
              const expiry = certification.expiryDate ? ` exp ${certification.expiryDate}` : '';
              return `
                <div class="admin-cert-card">
                  <div>
                    <span class="admin-cert-title">${escapeHtml(certification.type || 'Certification')}${escapeHtml(expiry)}</span>
                    ${certification.fileName ? `<span class="admin-cert-file">${escapeHtml(certification.fileName)}</span>` : ''}
                  </div>
                  ${
                    certification.hasAttachment && certification.id
                      ? `<button class="btn small secondary cert-download" type="button" data-worker-cert-download="${escapeHtml(worker.id)}" data-certification-id="${escapeHtml(certification.id)}" data-file-name="${escapeHtml(certification.fileName || 'certificate')}">Download</button>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')
        : '';
      const initials = String(worker.name || 'W')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');

      const row = document.createElement('tr');
      row.className = 'admin-worker-row';
      row.innerHTML = `
        <td>
          <div class="admin-worker-profile">
            <div class="admin-worker-avatar">${escapeHtml(initials || 'W')}</div>
            <div>
              <div class="admin-worker-name">${escapeHtml(worker.name)}</div>
              <div class="admin-worker-meta">
                <span class="admin-meta-chip">ID: ${escapeHtml(worker.employeeId || worker.id || '-')}</span>
                <span class="admin-meta-chip">IC: ${escapeHtml(worker.icPassport || '-')}</span>
              </div>
            </div>
          </div>
        </td>
        <td>
          <span class="admin-role">${escapeHtml(worker.role || '-')}</span>
        </td>
        <td>
          <span class="admin-company">${escapeHtml(worker.company || '-')}</span>
          <div class="admin-contact">
            <span>${escapeHtml(worker.phone || '-')}</span>
            <span>${escapeHtml(worker.email || '-')}</span>
          </div>
        </td>
        <td><div class="admin-permit-list">${permits || '<span class="meta-muted">No permit types</span>'}</div></td>
        <td>
          <div class="admin-cert-list">${certificationSummary || '<span class="meta-muted">No certifications</span>'}</div>
        </td>
        <td>
          <div class="admin-status-cell">
            <span class="badge ${statusBadge(status)}">${status}</span>
          </div>
        </td>
        <td>${renderWorkerReviewActions(worker)}</td>
      `;

      row.querySelector('[data-worker-status="valid"]')?.addEventListener('click', () =>
        updateWorkerReviewStatus(worker, 'valid'),
      );
      row.querySelector('[data-worker-status="rejected"]')?.addEventListener('click', () =>
        updateWorkerReviewStatus(worker, 'rejected'),
      );
      row.querySelector('[data-worker-review]')?.addEventListener('click', () => openWorkerReview(worker));
      row.querySelectorAll('[data-worker-cert-download]').forEach((button) => {
        button.addEventListener('click', () => {
          downloadWorkerCertification(
            button.dataset.workerCertDownload,
            button.dataset.certificationId,
            button.dataset.fileName,
          ).catch((error) => {
            elements.sectionStatus.textContent = error.message || 'Unable to download certificate.';
          });
        });
      });
      elements.competencyBody.append(row);
    });

    elements.competencyCount.textContent = `Showing ${rows.length} of ${state.workers.length} entries`;
  }

  function renderWorkerReviewActions(worker) {
    const status = String(worker.status || 'submitted').toLowerCase();
    if (status === 'submitted') {
      return `
        <span class="admin-actions">
        <button class="btn small secondary" type="button" data-worker-review>Review</button>
        <button class="btn small" type="button" data-worker-status="valid">Mark Valid</button>
        <button class="btn small danger" type="button" data-worker-status="rejected">Return</button>
        </span>
      `;
    }

    if (status === 'rejected') {
      return `
        <span class="admin-actions">
          <button class="btn small secondary" type="button" data-worker-review>Review</button>
          <span class="meta-muted">${escapeHtml(worker.reviewComment || 'Returned for correction')}</span>
        </span>
      `;
    }

    return `
      <span class="admin-actions">
        <button class="btn small secondary" type="button" data-worker-review>Review</button>
      </span>
    `;
  }

  function openWorkerReview(worker) {
    const status = workerStatusLabel(worker.status);
    const permits = normalizeWorkerPermits(worker.permits);
    state.activeReviewWorkerId = worker.id;
    elements.workerReviewTitle.textContent = worker.name || 'Worker profile';
    elements.workerReviewSubtitle.textContent = `${worker.employeeId || worker.id || '-'} - ${status}`;
    elements.workerReturnReason.value = worker.reviewComment || '';
    elements.approveWorkerButton.disabled = String(worker.status || '').toLowerCase() === 'valid';
    elements.returnWorkerButton.disabled = false;

    elements.workerReviewBody.innerHTML = `
      <section class="review-summary">
        <div class="review-fact">
          <span>Worker</span>
          <strong>${escapeHtml(worker.name || '-')}</strong>
          <p class="muted">IC/Passport: ${escapeHtml(worker.icPassport || '-')}</p>
        </div>
        <div class="review-fact">
          <span>Status</span>
          <strong><span class="badge ${statusBadge(status)}">${escapeHtml(status)}</span></strong>
        </div>
        <div class="review-fact">
          <span>Worker ID</span>
          <strong>${escapeHtml(worker.employeeId || worker.id || '-')}</strong>
        </div>
        <div class="review-fact">
          <span>Submitted By</span>
          <strong>${escapeHtml(workerSubmitterLabel(worker))}</strong>
        </div>
      </section>

      ${
        worker.reviewComment
          ? `<div class="review-comment">Return reason: ${escapeHtml(worker.reviewComment)}</div>`
          : ''
      }

      <section class="review-section">
        <h4>Worker Information</h4>
        <div class="review-grid">
          ${renderReviewDetail('Position / Role', worker.role)}
          ${renderReviewDetail('Company / Contractor', worker.company)}
          ${renderReviewDetail('Phone', worker.phone)}
          ${renderReviewDetail('Email', worker.email)}
        </div>
      </section>

      <section class="review-section">
        <h4>Permit Authorization</h4>
        <div class="review-cert-meta">
          ${permits.length ? permits.map((permit) => `<span class="tag">${escapeHtml(permit)}</span>`).join('') : '<span class="meta-muted">No permit types selected.</span>'}
        </div>
      </section>

      <section class="review-section">
        <h4>Certifications</h4>
        ${renderWorkerCertificationReview(worker)}
      </section>
    `;

    elements.workerReviewDialog.showModal();
  }

  function getDraftQueue() {
    return state.permits.filter((permit) => !permit.isEmergency && ['draft', 'rejected'].includes(permit.status));
  }

  function getSubmittedQueue() {
    return state.permits.filter(
      (permit) => !permit.isEmergency && ['submitted', 'stage1_complete', 'approved', 'active'].includes(permit.status),
    );
  }

  function renderQueue(query = '') {
    const queue = state.activeSection === 'routing' ? getSubmittedQueue() : getDraftQueue();
    const itemsTarget = state.activeSection === 'routing' ? elements.routingItems : elements.queueItems;
    const detailTarget = state.activeSection === 'routing' ? elements.routingDetail : elements.queueDetail;
    const countTarget = state.activeSection === 'routing' ? elements.routingCount : elements.queueCount;
    const lowerQuery = query.trim().toLowerCase();
    const visible = queue.filter((permit) =>
      [permit.id, permit.title, permit.location, permit.status, getPermitType(permit)]
        .join(' ')
        .toLowerCase()
        .includes(lowerQuery),
    );

    itemsTarget.innerHTML = '';
    if (state.activeSection !== 'routing') {
      document.querySelector('#queueEmpty')?.classList.toggle('hidden', visible.length > 0);
    }
    countTarget.textContent = `${visible.length} items`;

    visible.forEach((permit, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'queue-item';
      item.innerHTML = `
        <div>
          <div class="name">${escapeHtml(permit.title)}</div>
          <div class="meta-muted">${escapeHtml(permit.id)} - ${escapeHtml(permit.location)}</div>
        </div>
        <div class="queue-meta">
          <span class="badge ${statusBadge(permit.status)}">${formatStatus(permit.status)}</span>
          <span class="meta-muted">${formatDateTime(permit.startDateTime)}</span>
        </div>
      `;
      item.addEventListener('click', () => {
        document.querySelectorAll('.queue-item').forEach((button) => button.classList.remove('active-queue'));
        item.classList.add('active-queue');
        renderQueueDetail(permit, detailTarget);
      });
      itemsTarget.append(item);

      if (index === 0) {
        item.classList.add('active-queue');
        renderQueueDetail(permit, detailTarget);
      }
    });

    if (!visible.length) {
      renderQueueDetail(null, detailTarget);
    }
  }

  function renderQueueDetail(permit, target = elements.queueDetail) {
    if (!permit) {
      target.innerHTML = `
        <div class="detail-card">
          <div class="card-head">
            <div>
              <h3>No permit selected</h3>
              <p class="muted">Admin Lane 2 handles worker competency, draft completeness, and formal routing.</p>
            </div>
            <span class="badge pending">Waiting</span>
          </div>
        </div>
      `;
      return;
    }

    const documentCount = (permit.documents || []).length;
    const downloadableCount = (permit.documents || []).filter((doc) => doc.id && doc.hasAttachment).length;
    const workers = formatList(permit.assignedWorkers);
    const canSubmit = ['draft', 'rejected'].includes(permit.status);
    const routeText = formatList(permit.approvers);

    target.innerHTML = `
      <div class="detail-card">
        <div class="card-head">
          <div>
            <h3>${escapeHtml(permit.title)}</h3>
            <p class="muted">${escapeHtml(permit.id)} - ${escapeHtml(permit.location)}</p>
          </div>
          <span class="badge ${statusBadge(permit.status)}">${formatStatus(permit.status)}</span>
        </div>

        <div class="review-strip">
          <div>
            <span>Documents</span>
            <strong>${documentCount}</strong>
            <small>${downloadableCount} downloadable</small>
          </div>
          <div>
            <span>Workers</span>
            <strong>${(permit.assignedWorkers || []).length}</strong>
            <small>assigned</small>
          </div>
          <div>
            <span>Route</span>
            <strong>${escapeHtml(routeText === '-' ? 'Not set' : routeText)}</strong>
            <small>normal permit</small>
          </div>
        </div>

        <div class="detail-row">
          <div><strong>Requester</strong><p class="muted">${escapeHtml(permit.requestedBy || '-')}</p></div>
          <div><strong>Permit Type</strong><p class="muted">${escapeHtml(getPermitType(permit))}</p></div>
        </div>
        <div class="detail-row">
          <div><strong>Schedule</strong><p class="muted">${formatDateTime(permit.startDateTime)} to ${formatDateTime(permit.endDateTime)}</p></div>
          <div><strong>Assigned Workers</strong><p class="muted">${escapeHtml(workers)}</p></div>
        </div>
        <div class="detail-row">
          <div><strong>Hazards</strong><p class="muted">${escapeHtml(formatList(permit.hazards))}</p></div>
          <div><strong>Approver Route</strong><p class="muted">${escapeHtml(routeText)}</p></div>
        </div>
        <section class="review-block">
          <div class="review-block-head">
            <h4>Uploaded Documents</h4>
            <span class="badge pending">${downloadableCount}/${documentCount || 0} files</span>
          </div>
          ${renderPermitDocumentCards(permit)}
        </section>
        <section class="review-block">
          <div class="review-block-head">
            <h4>Scope and Controls</h4>
          </div>
          <div class="detail-row">
            <div><strong>Control Measures</strong><p class="muted multiline">${escapeHtml(formatList(permit.controls))}</p></div>
            <div><strong>PPE</strong><p class="muted multiline">${escapeHtml(formatList(permit.ppe))}</p></div>
          </div>
          <p class="detail-text">${escapeHtml(extractScope(permit.description) || permit.description || '-')}</p>
        </section>
        <div class="button-row">
          ${
            canSubmit
              ? '<button class="btn small" id="submitPermitButton" type="button">Submit to Approval Route</button><button class="btn small secondary" id="flagCorrectionButton" type="button">Return / Flag Correction</button>'
              : '<span class="badge pending">Already routed to pending approval</span>'
          }
        </div>
      </div>
    `;

    document.querySelector('#submitPermitButton')?.addEventListener('click', () => submitPermit(permit));
    document.querySelector('#flagCorrectionButton')?.addEventListener('click', () => {
      addAudit(`Flagged draft correction for ${permit.title}`, 'Pending');
      elements.sectionStatus.textContent = 'Draft correction flag recorded. The requester keeps ownership of the draft package.';
    });
  }

  async function submitPermit(permit) {
    try {
      await apiRequest(`/api/permits/${encodeURIComponent(permit.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'submitted',
          comment: 'Admin Lane 2 formal submission after clerical completeness check',
        }),
      });
      await loadData();
      addAudit(`Admin submitted ${permit.title} to pending approval`);
      renderQueue(elements.searchInput?.value || '');
      updateKpis();
      elements.sectionStatus.textContent = `${permit.title} routed to Pending Approval.`;
    } catch (error) {
      elements.sectionStatus.textContent = error.error || 'Unable to submit permit.';
    }
  }

  function renderAudit(query = '') {
    const lowerQuery = query.trim().toLowerCase();
    const completionRows = Object.values(state.completionRequests)
      .filter(Boolean)
      .map((request) => ({
        time: formatDateTime(request.submittedAt),
        sortTime: Date.parse(request.closedAt || request.submittedAt || '') || 0,
        actor: request.workerName || request.workerEmail || 'Assigned Worker',
        action: `Post inspection checklist submitted for ${request.permitDisplayId || request.permitId}`,
        status: request.status === 'closed' ? 'Closed' : 'Pending Closure',
        request,
      }));
    const rows = [...completionRows, ...state.audits].filter((audit) =>
      [audit.time, audit.actor, audit.action, audit.status].join(' ').toLowerCase().includes(lowerQuery),
    ).sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));

    elements.auditBody.innerHTML = rows
      .map(
        (audit) => `
          <tr>
            <td>${escapeHtml(audit.time)}</td>
            <td>${escapeHtml(audit.actor)}</td>
            <td>
              ${escapeHtml(audit.action)}
              ${audit.request ? renderCompletionAuditDetails(audit.request) : ''}
            </td>
            <td>
              <span class="badge ${statusBadge(audit.status)}">${escapeHtml(audit.status)}</span>
              ${audit.request && audit.request.status !== 'closed'
                ? `<button class="btn small" type="button" data-close-completion="${escapeHtml(audit.request.requestId)}">Close Permit</button>`
                : ''}
            </td>
          </tr>
        `,
      )
      .join('');
    elements.auditCount.textContent = `${rows.length} records`;

    elements.auditBody.querySelectorAll('[data-close-completion]').forEach((button) => {
      button.addEventListener('click', () => closeCompletionPermit(button.dataset.closeCompletion));
    });
  }

  function renderCompletionAuditDetails(request) {
    const checklist = Array.isArray(request.checklist) ? request.checklist.join(', ') : '-';
    return `
      <div class="meta-muted multiline">
        Worker: ${escapeHtml(request.workerEmail || '-')}<br>
        Checklist: ${escapeHtml(checklist)}<br>
        Hot work: ${escapeHtml(request.hotWorkInvolved ? 'Yes' : 'No')} | Fire watch: ${escapeHtml(request.fireWatchCompleted ? 'Completed' : 'Not required')}<br>
        Evidence: ${escapeHtml(request.evidenceName || 'No file name')}
      </div>
    `;
  }

  async function closeCompletionPermit(requestId) {
    const request = state.completionRequests[requestId];
    if (!request) return;

    const permit = state.permits.find((item) => item.id === request.permitId);
    if (!permit) {
      elements.sectionStatus.textContent = 'Permit for this completion request is no longer visible.';
      return;
    }

    try {
      await apiRequest(`/api/permits/${encodeURIComponent(permit.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'closed',
          comment: `Admin final closure after worker post-inspection checklist. ${request.notes || ''}`,
        }),
      });
      state.completionRequests[requestId] = {
        ...request,
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedBy: state.session?.user?.fullName || 'PTW Admin',
      };
      persistStoredObject(COMPLETION_STORAGE_KEY, state.completionRequests);
      await loadData();
      addAudit(`Admin closed ${request.permitDisplayId || permit.title} after post inspection checklist`, 'Closed');
      renderAudit(elements.searchInput?.value || '');
      updateKpis();
      elements.sectionStatus.textContent = `${request.permitDisplayId || permit.title} closed by Admin final audit.`;
    } catch (error) {
      elements.sectionStatus.textContent = error.error || 'Unable to close permit from completion audit.';
    }
  }

  function updateKpis() {
    const invalid = state.workers.filter((worker) => String(worker.status || '').toLowerCase() !== 'valid').length;
    const queue = getDraftQueue().length;
    const expiredKpi = document.querySelector('[data-kpi="expired_licenses_count"]');
    const queueKpi = document.querySelector('[data-kpi="verification_queue_count"]');
    if (expiredKpi) expiredKpi.textContent = invalid;
    if (queueKpi) queueKpi.textContent = queue;
  }

  function editWorker(worker) {
    elements.addWorkerForm.dataset.editingId = worker.id;
    elements.newWorkerName.value = worker.name || '';
    elements.newWorkerIcPassport.value = worker.icPassport || '';
    elements.newWorkerId.value = worker.employeeId || '';
    elements.newWorkerPhone.value = worker.phone || '';
    elements.newWorkerEmail.value = worker.email || '';
    elements.newWorkerCompany.value = worker.company || '';
    renderWorkerRoleOptions(worker.role || '');
    setSelectedWorkerPermits(worker.permits || []);
    renderCertificationEditor(worker.certifications || []);
    elements.addWorkerSubmit.textContent = 'Save Worker';
    elements.addWorkerForm.scrollIntoView({ behavior: 'smooth' });
  }

  async function deleteWorker(worker) {
    if (!confirm(`Delete ${worker.name || 'this worker'}?`)) return;

    try {
      await apiRequest(`/api/workers/${encodeURIComponent(worker.id)}`, { method: 'DELETE' });
      await loadData();
      addAudit(`Deleted worker record ${worker.name}`);
      renderCompetency(elements.searchInput?.value || '');
      updateKpis();
    } catch (error) {
      elements.sectionStatus.textContent = error.error || 'Unable to delete worker.';
    }
  }

  function formatActivationDelivery(delivery) {
    if (!delivery || !Array.isArray(delivery.channels)) {
      return 'Delivery status unavailable.';
    }

    const sent = delivery.channels
      .filter((channel) => channel.status === 'sent')
      .map((channel) => channel.channel.toUpperCase());
    const failed = delivery.channels
      .filter((channel) => channel.status === 'failed')
      .map((channel) => channel.channel.toUpperCase());
    const unavailable = delivery.channels
      .filter((channel) => channel.status === 'not_configured' || channel.status === 'skipped')
      .map((channel) => channel.channel.toUpperCase());

    if (sent.length) {
      return `Invite sent by ${sent.join(' and ')}${failed.length ? `; ${failed.join(' and ')} failed` : ''}.`;
    }

    if (failed.length) {
      return `Invite delivery failed by ${failed.join(' and ')}.`;
    }

    if (unavailable.length) {
      return `Invite delivery not configured for ${unavailable.join(' and ')}.`;
    }

    return 'Invite delivery status unavailable.';
  }

  function formatActivationInviteMessage({ email, link, delivery, created }) {
    if (!link) {
      return `Worker account matched for ${email}. No activation invite needed.`;
    }

    const action = created ? 'created' : 'refreshed';
    const deliveryText = formatActivationDelivery(delivery);
    return `Worker activation invite ${action} for ${email}. ${deliveryText} Activation link: ${link}`;
  }

  async function updateWorkerReviewStatus(worker, status, suppliedReviewComment) {
    const reviewComment =
      status === 'rejected'
        ? suppliedReviewComment ?? prompt(`Return ${worker.name || 'worker'} for correction. Add a short reason:`) ?? ''
        : '';

    if (status === 'rejected' && !reviewComment.trim()) {
      elements.sectionStatus.textContent = 'Return reason is required for worker correction.';
      return;
    }

    try {
      const result = await apiRequest(`/api/workers/${encodeURIComponent(worker.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewComment }),
      });
      await loadData();
      renderCompetency(elements.searchInput?.value || '');
      updateKpis();
      addAudit(
        `${status === 'valid' ? 'Marked valid' : 'Returned'} worker profile ${worker.name}`,
      );
      if (elements.workerReviewDialog?.open) {
        elements.workerReviewDialog.close();
      }
      if (status === 'valid' && result.workerAccount) {
        if (result.workerAccount.created) {
          elements.sectionStatus.textContent = formatActivationInviteMessage({
            email: result.workerAccount.user.email,
            link: result.workerAccount.activationLink,
            delivery: result.workerAccount.delivery,
            created: true,
          });
        } else if (result.workerAccount.skipped) {
          elements.sectionStatus.textContent = `Worker marked valid. Account not created: ${result.workerAccount.reason}`;
        } else {
          elements.sectionStatus.textContent = formatActivationInviteMessage({
            email: result.workerAccount.user.email,
            link: result.workerAccount.activationLink,
            delivery: result.workerAccount.delivery,
            created: false,
          });
        }
      } else {
        elements.sectionStatus.textContent = `${status === 'valid' ? 'Marked valid' : 'Returned'} worker profile ${worker.name}.`;
      }
    } catch (error) {
      elements.sectionStatus.textContent = error.error || 'Unable to review worker profile.';
    }
  }

  function clearWorkerForm() {
    elements.addWorkerForm.dataset.editingId = '';
    elements.newWorkerName.value = '';
    elements.newWorkerIcPassport.value = '';
    elements.newWorkerId.value = '';
    elements.newWorkerPhone.value = '';
    elements.newWorkerEmail.value = '';
    elements.newWorkerCompany.value = '';
    renderWorkerRoleOptions();
    setSelectedWorkerPermits([]);
    renderCertificationEditor();
    elements.addWorkerSubmit.textContent = 'Add Worker';
  }

  async function saveWorker(event) {
    event.preventDefault();
    const name = elements.newWorkerName.value.trim();
    const icPassport = elements.newWorkerIcPassport.value.trim();
    if (!name || !icPassport) {
      elements.sectionStatus.textContent = 'Full name and IC/Passport number are required.';
      return;
    }

    const editingId = elements.addWorkerForm.dataset.editingId;
    const payload = {
      name,
      icPassport,
      employeeId: elements.newWorkerId.value.trim() || undefined,
      phone: elements.newWorkerPhone.value.trim(),
      email: elements.newWorkerEmail.value.trim(),
      company: elements.newWorkerCompany.value.trim(),
      role: elements.newWorkerRole.value.trim(),
      permits: getSelectedWorkerPermits(),
      certifications: await readWorkerCertifications(),
      status: 'valid',
    };

    try {
      if (editingId) {
        await apiRequest(`/api/workers/${encodeURIComponent(editingId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        addAudit(`Updated worker competency record ${payload.name}`);
      } else {
        await apiRequest('/api/workers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        addAudit(`Added worker competency record ${payload.name}`);
      }

      clearWorkerForm();
      await loadData();
      renderCompetency(elements.searchInput?.value || '');
      updateKpis();
    } catch (error) {
      elements.sectionStatus.textContent = error.error || 'Unable to save worker.';
    }
  }

  function updateSearchResults() {
    const query = elements.searchInput?.value || '';
    if (state.activeSection === 'competency') renderCompetency(query);
    if (state.activeSection === 'draftReview') renderQueue(query);
    if (state.activeSection === 'auditTrails') renderAudit(query);
  }

  async function refresh() {
    await loadData();
    updateKpis();
    updateSearchResults();
    elements.sectionStatus.textContent = 'Admin Lane 2 refreshed.';
  }

  function wireEvents() {
    elements.navItems.forEach((item, index) => {
      item.dataset.section = ['competency', 'draftReview', 'auditTrails'][index];
      item.addEventListener('click', () => setActiveSection(item.dataset.section));
    });

    elements.searchInput?.addEventListener('input', updateSearchResults);
    elements.refreshButton?.addEventListener('click', refresh);
    elements.topbarRefreshButton?.addEventListener('click', refresh);
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

      const button = event.target.closest('[data-notification-section]');
      if (!button) return;
      setActiveSection(button.dataset.notificationSection);
      setNotificationPanel(false);
    });
    document.addEventListener('click', (event) => {
      if (elements.notificationPanel?.hidden) return;
      if (event.target.closest('.notification-wrap')) return;
      setNotificationPanel(false);
    });
    elements.filtersToggle?.addEventListener('click', () => elements.filterPanel?.classList.toggle('hidden'));
    elements.clearFiltersButton?.addEventListener('click', () => {
      if (elements.filterStatus) elements.filterStatus.value = '';
      if (elements.filterPermit) elements.filterPermit.value = '';
      updateSearchResults();
    });
    [elements.filterStatus, elements.filterPermit].forEach((control) => {
      control?.addEventListener('change', updateSearchResults);
    });
    elements.addWorkerForm?.addEventListener('submit', saveWorker);
    elements.addWorkerForm?.addEventListener('reset', () => window.setTimeout(clearWorkerForm, 0));
    elements.addWorkerButton?.addEventListener('click', () => elements.newWorkerName?.focus());
    elements.addCertificationButton?.addEventListener('click', () => addCertificationRow());
    document.querySelectorAll('[data-close-worker-review]').forEach((button) => {
      button.addEventListener('click', () => elements.workerReviewDialog?.close());
    });
    elements.workerReviewBody?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-worker-cert-download]');
      if (!button) return;

      downloadWorkerCertification(
        button.dataset.workerCertDownload,
        button.dataset.certificationId,
        button.dataset.fileName,
      ).catch((error) => {
        elements.sectionStatus.textContent = error.message || 'Unable to download certificate.';
      });
    });
    [elements.queueDetail, elements.routingDetail].forEach((detail) => {
      detail?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-permit-document-download]');
        if (!button) return;

        downloadPermitDocument(
          button.dataset.permitDocumentDownload,
          button.dataset.documentId,
          button.dataset.fileName,
        )
          .then(() => {
            elements.sectionStatus.textContent = `Downloaded ${button.dataset.fileName || 'permit document'}.`;
          })
          .catch((error) => {
            elements.sectionStatus.textContent = error.message || 'Unable to download permit document.';
          });
      });
    });
    elements.approveWorkerButton?.addEventListener('click', () => {
      const worker = getWorkerRecord(state.activeReviewWorkerId);
      if (worker) updateWorkerReviewStatus(worker, 'valid');
    });
    elements.returnWorkerButton?.addEventListener('click', () => {
      const worker = getWorkerRecord(state.activeReviewWorkerId);
      if (!worker) return;
      updateWorkerReviewStatus(worker, 'rejected', elements.workerReturnReason?.value || '');
    });
    elements.newWorkerCertifications?.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-cert-remove]');
      if (!removeButton) return;

      const rows = elements.newWorkerCertifications.querySelectorAll('.certification-row');
      if (rows.length <= 1) {
        renderCertificationEditor();
        return;
      }

      removeButton.closest('.certification-row')?.remove();
    });
    elements.newWorkerCertifications?.addEventListener('change', (event) => {
      const fileInput = event.target.closest('[data-cert-field="file"]');
      if (!fileInput) return;

      const fileName = fileInput.files?.[0]?.name || 'No file selected';
      const status = fileInput.closest('.certification-field')?.querySelector('small');
      if (status) status.textContent = fileName;
    });
    elements.logoutButton?.addEventListener('click', () => {
      localStorage.removeItem('ptwSession');
      sessionStorage.removeItem('ptwSession');
      window.location.assign('/login');
    });
    elements.settingsButton?.addEventListener('click', () => {
      elements.sectionStatus.textContent = 'Admin settings are not available in this MVP.';
    });
    elements.supportButton?.addEventListener('click', () => window.location.assign('/support'));
  }

  async function init() {
    if (!requireAdmin()) return;
    await refreshCurrentUser();

    renderPermitTypePicker();
    renderWorkerRoleOptions();
    renderCertificationEditor();
    wireEvents();
    await loadData();
    updateKpis();
    renderCompetency();
    renderAudit();
    setActiveSection(getDraftQueue().length ? 'draftReview' : state.activeSection);
    if (state.activeSection !== 'draftReview') {
      renderQueueDetail(null);
    }
  }

  init().catch((error) => {
    if (error.status === 401) {
      elements.sectionStatus.textContent = 'Session expired. Redirecting to sign in.';
      return;
    }
    elements.sectionStatus.textContent = error.error || error.message || 'Unable to load Admin Lane 2.';
  });
});
