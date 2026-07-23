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

  const COMPLETION_STORAGE_KEY = scopedStorageKey('ptwWorkerCompletionRequests');
  const WORK_STATE_STORAGE_KEY = scopedStorageKey('ptwSupervisorWorkStates');

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
    permitHistoryBody: document.querySelector('#permitHistoryBody'),
    permitHistoryCount: document.querySelector('#permitHistoryCount'),
    auditBody: document.querySelector('#auditBody'),
    auditCount: document.querySelector('#auditCount'),
    refreshButton: document.querySelector('#refreshButton'),
    topbarRefreshButton: document.querySelector('#topbarRefreshButton'),
    logoutButton: document.querySelector('#adminLogoutButton'),
    notificationButton: document.querySelector('#notificationButton'),
    notificationPanel: document.querySelector('#notificationPanel'),
    notificationCloseButton: document.querySelector('#notificationCloseButton'),
    notificationReadAllButton: document.querySelector('#notificationReadAllButton'),
    notificationList: document.querySelector('#notificationList'),
    notificationCount: document.querySelector('#notificationCount'),
    notificationDot: document.querySelector('#notificationDot'),
    accountButton: document.querySelector('#accountButton'),
    filtersToggle: document.querySelector('#filtersToggle'),
    filterPanel: document.querySelector('#filterPanel'),
    filterStatus: document.querySelector('#filterStatus'),
    filterPermit: document.querySelector('#filterPermit'),
    clearFiltersButton: document.querySelector('#clearFiltersButton'),
    addWorkerButton: document.querySelector('#addWorkerButton'),
    addWorkerDialog: document.querySelector('#addWorkerDialog'),
    addWorkerForm: document.querySelector('#addWorkerForm'),
    addWorkerDialogTitle: document.querySelector('#addWorkerDialogTitle'),
    addWorkerDialogSubtitle: document.querySelector('#addWorkerDialogSubtitle'),
    addWorkerKicker: document.querySelector('#addWorkerKicker'),
    addWorkerMessage: document.querySelector('#addWorkerMessage'),
    addWorkerSubmit: document.querySelector('#addWorkerSubmit'),
    cancelAddWorkerButton: document.querySelector('#cancelAddWorkerButton'),
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
    approveWorkerButton: document.querySelector('#approveWorkerButton'),
    deactivateWorkerButton: document.querySelector('#deactivateWorkerButton'),
    deleteWorkerButton: document.querySelector('#deleteWorkerButton'),
    settingsButton: document.querySelector('#settingsButton'),
    supportButton: document.querySelector('#supportButton'),
  };

  const sectionPanels = {
    competency: document.querySelector('#manageCompetencySection'),
    draftReview: document.querySelector('#permitQueueSection'),
    routing: document.querySelector('#permitClosureSection'),
    permitHistory: document.querySelector('#permitHistorySection'),
    auditTrails: document.querySelector('#auditTrailsSection'),
  };

  const state = {
    session: readSession(),
    workers: [],
    permits: [],
    permitLogs: {},
    audits: [],
    notifications: [],
    completionRequests: readStoredObject(COMPLETION_STORAGE_KEY),
    activeSection: 'competency',
    activeReviewWorkerId: '',
    activeHistoryPermitId: '',
  };

  const workerPermitTypes = [
    'Hot Work',
    'Confined Space',
    'Electrical Isolation',
    'Work at Height',
    'Line Breaking',
    'Chemical Handling',
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
      ['Chemical Handling', 'Chemical Handling'],
      ['Chemical', 'Chemical Handling'],
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

  function setPermitWorkState(permitId, stateName) {
    const workStates = readStoredObject(WORK_STATE_STORAGE_KEY);
    const updatedAt = window.PTWTime?.iso?.() || new Date().toISOString();
    workStates[permitId] = {
      state: stateName,
      updatedAt,
      by: state.session?.user?.email || '',
    };
    persistStoredObject(WORK_STATE_STORAGE_KEY, workStates);
    state.permits = state.permits.map((permit) =>
      permit.id === permitId ? { ...permit, workState: stateName } : permit,
    );
    apiRequest(`/api/permits/${encodeURIComponent(permitId)}/work-state`, {
      method: 'PATCH',
      body: JSON.stringify({ workState: stateName }),
    })
      .then((result) => {
        if (!result?.permit) return;
        state.permits = state.permits.map((permit) =>
          permit.id === result.permit.id ? result.permit : permit,
        );
      })
      .catch(() => {});
  }

  function pruneCompletionRequests(requests, permits) {
    const permitIds = new Set((permits || []).map((permit) => String(permit.id)));
    const entries = Object.entries(requests || {}).filter(([, request]) =>
      request?.permitId && permitIds.has(String(request.permitId)),
    );
    return Object.fromEntries(entries);
  }

  function getRoleUrl(role) {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'requester') return '/dashboard';
    if (normalized === 'safety_officer') return '/safety';
    if (normalized === 'supervisor') return '/review';
    if (normalized === 'worker') return '/worker';
    return '/login';
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

  function redirectToRoleHome() {
    const roles = getUserRoles(state.session?.user);
    const preferredRole = ['safety_officer', 'supervisor', 'requester', 'worker']
      .find((role) => roles.includes(role)) || state.session?.user?.role;
    const target = getRoleUrl(preferredRole);
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

  function permitExportFileName(permit) {
    const label = String(permit?.id || permit?.title || 'permit')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-');
    return `${label || 'permit'}-MOS-JSA.xlsx`;
  }

  async function downloadMosJsaExcel(permitId) {
    const permit = state.permits.find((item) => item.id === permitId);
    const documents = (permit?.documents || []).filter(isStructuredMosJsaDocument);
    if (!permit || !documents.length) {
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
      let message = 'Unable to export MOS/JSA Excel.';
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
    link.download = permitExportFileName(permit);
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
    if (String(status || '').toLowerCase() === 'resubmitted') return 'Resubmitted';
    return String(status || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
      .filter((line) => !/^(HIRARC|MOS|JSA):/i.test(line.trim()))
      .join('\n')
      .trim();
  }

  function formatList(values) {
    const list = Array.isArray(values) ? values : [];
    return list.length ? list.join(', ') : '-';
  }

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

  function isStructuredMosJsaDocument(document) {
    const type = String(document?.type || '').trim().toUpperCase();
    const data = normalizeStructuredData(document?.structuredData);
    return ['MOS', 'JSA'].includes(type) && Object.keys(data).length > 0;
  }

  function renderDigitalEvidence(permit) {
    const documents = (permit.documents || []).filter(isStructuredMosJsaDocument);
    if (!documents.length) return '';

    return `
      <section class="review-block">
        <div class="review-block-head">
          <h4>MOS / JSA Digital Evidence</h4>
          <div class="review-block-actions">
            <span class="badge valid">${documents.length}/2 forms</span>
            <button class="btn small secondary" type="button" data-mos-jsa-export="${escapeHtml(permit.id)}">Export Excel</button>
          </div>
        </div>
        <div class="admin-digital-evidence-grid">
          ${documents.map(renderStructuredDocument).join('')}
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
      <article class="admin-digital-evidence-card">
        <strong>${escapeHtml(schema.title)}</strong>
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

  function renderPermitDocumentCards(permit) {
    const documents = (Array.isArray(permit?.documents) ? permit.documents : []).filter(
      (document) => document?.hasAttachment,
    );

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

  function renderSupportingFiles(permit) {
    const downloadableCount = (permit.documents || []).filter((doc) => doc.id && doc.hasAttachment).length;
    if (!downloadableCount) return '';

    return `
      <section class="review-block">
        <div class="review-block-head">
          <h4>Supporting Files</h4>
          <span class="badge pending">${downloadableCount} files</span>
        </div>
        ${renderPermitDocumentCards(permit)}
      </section>
    `;
  }

  function statusBadge(status) {
    const normalized = String(status || '').toLowerCase();
    if (['valid', 'approved', 'active', 'closed'].includes(normalized)) return 'valid';
    if (['submitted', 'resubmitted', 'stage1_complete'].includes(normalized)) return 'pending';
    if (['expired', 'rejected', 'returned', 'inactive', 'cancelled'].includes(normalized)) return 'danger';
    if (['expiring', 'warning', 'draft'].includes(normalized)) return 'warn';
    return 'pending';
  }

  function workerStatusLabel(status) {
    const normalized = String(status || 'submitted').toLowerCase();
    if (normalized === 'valid') return 'Valid';
    if (normalized === 'inactive') return 'Inactive';
    if (normalized === 'rejected') return 'Inactive';
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
    if (userHasRole(state.session?.user, 'admin')) {
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

    const invalid = state.workers.filter((worker) => String(worker.status || '').toLowerCase() !== 'valid').length;
    window.PTWNotifications?.updateBadge(elements.notificationDot, 0);
    elements.notificationReadAllButton.disabled = true;
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

  async function loadData() {
    const [workerResult, permitResult, notificationResult] = await Promise.all([
      apiRequest('/api/workers'),
      apiRequest('/api/permits'),
      loadNotifications(),
    ]);

    state.workers = workerResult.workers || workerResult.data || [];
    state.permits = permitResult.permits || permitResult.data || [];
    state.permitLogs = await loadPermitLogs(state.permits);
    state.notifications = notificationResult.notifications || notificationResult.data || [];
    const storedCompletionRequests = readStoredObject(COMPLETION_STORAGE_KEY);
    state.completionRequests = pruneCompletionRequests(storedCompletionRequests, state.permits);
    if (Object.keys(state.completionRequests).length !== Object.keys(storedCompletionRequests).length) {
      persistStoredObject(COMPLETION_STORAGE_KEY, state.completionRequests);
    }
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

  async function loadPermitLogs(permits = []) {
    const entries = await Promise.all(
      permits.map(async (permit) => {
        try {
          const result = await apiRequest(`/api/permits/${encodeURIComponent(permit.id)}/audit-logs`);
          return [permit.id, result.logs || result.data || []];
        } catch {
          return [permit.id, []];
        }
      }),
    );

    return Object.fromEntries(entries);
  }

  function syncRequesterWorkersStorage() {
    const requesterWorkers = state.workers
      .filter((worker) => String(worker.status || '').toLowerCase() === 'valid')
      .map((worker, index) => ({
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
    localStorage.setItem(scopedStorageKey('ptwRequesterWorkers'), JSON.stringify(requesterWorkers));
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
      permitHistory: 'Permit Review History',
      auditTrails: 'Admin Audit Trail',
    };
    const subtitles = {
      competency: 'Review requester-submitted worker profiles, certifications, and permit authorization records.',
      draftReview: 'Clerically verify draft package completeness and formally submit to pending approval.',
      permitHistory: 'Track each permit movement from draft creation through review, approval, active work, and closure.',
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
      const downloadableCertifications = certifications.filter((certification) => certification.hasAttachment && certification.id);
      const certificationSummary = downloadableCertifications.length
        ? downloadableCertifications
            .map((certification, index) => {
              const label = downloadableCertifications.length > 1 ? `Download ${index + 1}` : 'Download Certificate';
              const fileName = certification.fileName || 'certificate';
              return `<button class="btn small secondary cert-download" type="button" title="${escapeHtml(fileName)}" data-worker-cert-download="${escapeHtml(worker.id)}" data-certification-id="${escapeHtml(certification.id)}" data-file-name="${escapeHtml(fileName)}">${escapeHtml(label)}</button>`;
            })
            .join('')
        : certifications.length
          ? '<span class="meta-muted">No downloadable file</span>'
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
    const normalizedStatus = String(worker.status || '').toLowerCase();
    const isValid = normalizedStatus === 'valid';
    const isInactive = normalizedStatus === 'inactive' || normalizedStatus === 'rejected';

    elements.approveWorkerButton.textContent = isValid ? 'Active' : isInactive ? 'Activate' : 'Mark Valid';
    elements.approveWorkerButton.disabled = isValid;
    elements.deactivateWorkerButton.disabled = isInactive;
    elements.deleteWorkerButton.disabled = false;

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
          ? `<div class="review-comment">Admin note: ${escapeHtml(worker.reviewComment)}</div>`
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
    return state.permits.filter((permit) => !permit.isEmergency && ['draft', 'rejected', 'resubmitted'].includes(permit.status));
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
          <div class="meta-muted">${escapeHtml(permit.location || '-')}</div>
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

  function wireReviewStages(root) {
    const workflow = root.querySelector('[data-review-stages]');
    if (!workflow) return;

    const steps = Array.from(workflow.querySelectorAll('[data-review-step]'));
    const panels = Array.from(workflow.querySelectorAll('[data-stage-panel]'));
    const previousButton = workflow.querySelector('[data-stage-prev]');
    const nextButton = workflow.querySelector('[data-stage-next]');
    let activeIndex = 0;

    function setStage(index) {
      activeIndex = Math.max(0, Math.min(index, panels.length - 1));

      steps.forEach((step, stepIndex) => {
        const isActive = stepIndex === activeIndex;
        step.classList.toggle('active', isActive);
        step.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      panels.forEach((panel, panelIndex) => {
        panel.classList.toggle('active', panelIndex === activeIndex);
      });

      if (previousButton) {
        previousButton.disabled = activeIndex === 0;
      }

      if (nextButton) {
        const isLastStage = activeIndex === panels.length - 1;
        nextButton.disabled = isLastStage;
        nextButton.textContent = isLastStage ? 'Ready to route' : 'Next stage';
        nextButton.classList.toggle('secondary', isLastStage);
      }
    }

    steps.forEach((step, index) => {
      step.addEventListener('click', () => setStage(index));
    });

    previousButton?.addEventListener('click', () => setStage(activeIndex - 1));
    nextButton?.addEventListener('click', () => setStage(activeIndex + 1));
    setStage(0);
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

    const downloadableCount = (permit.documents || []).filter((doc) => doc.id && doc.hasAttachment).length;
    const digitalEvidenceCount = (permit.documents || []).filter(isStructuredMosJsaDocument).length;
    const workers = formatList(permit.assignedWorkers);
    const needsRequesterRevision = permit.status === 'rejected' && permit.needsRequesterRevisionBeforeAdminSubmit;
    const canSubmit = permit.status === 'draft' || permit.status === 'resubmitted' || (permit.status === 'rejected' && !needsRequesterRevision);
    const routeText = formatList(permit.approvers);
    const actionMarkup = canSubmit
      ? '<button class="btn small" id="submitPermitButton" type="button">Submit to Safety Officer Review</button>'
      : needsRequesterRevision
        ? '<span class="badge danger">Awaiting requester correction</span>'
        : '<span class="badge pending">Already routed to pending approval</span>';
    const rejectionMarkup = permit.status === 'rejected'
      ? `
        <section class="review-block">
          <div class="review-block-head">
            <h4>Latest Rejection Reason</h4>
            <span class="badge danger">${escapeHtml(permit.latestRejectionByRole || 'Reviewer')}</span>
          </div>
          <p class="detail-text">${escapeHtml(permit.latestRejectionReason || 'No rejection reason recorded.')}</p>
          <p class="muted">${escapeHtml(permit.latestRejectionBy || 'Reviewer')} - ${formatDateTime(permit.latestRejectionAt)}</p>
        </section>
      `
      : '';
    const evidenceMarkup = [renderDigitalEvidence(permit), renderSupportingFiles(permit)]
      .filter(Boolean)
      .join('') || '<div class="document-empty">No MOS/JSA digital evidence or supporting files attached.</div>';

    target.innerHTML = `
      <div class="detail-card">
        <div class="card-head">
          <div>
            <h3>${escapeHtml(permit.title)}</h3>
            <p class="muted">${escapeHtml(permit.location || '-')}</p>
          </div>
          <span class="badge ${statusBadge(permit.status)}">${formatStatus(permit.status)}</span>
        </div>

        ${renderPermitStatusRoute(permit)}

        <div class="admin-review-workflow" data-review-stages>
          <div class="review-stepper" role="tablist" aria-label="Draft review stages">
            <button class="review-step active" type="button" role="tab" data-review-step>1. Overview</button>
            <button class="review-step" type="button" role="tab" data-review-step>2. Evidence</button>
            <button class="review-step" type="button" role="tab" data-review-step>3. Scope</button>
            <button class="review-step" type="button" role="tab" data-review-step>4. Route</button>
          </div>

          <section class="admin-review-stage active" data-stage-panel>
            <div class="review-strip">
              <div>
                <span>MOS/JSA Forms</span>
                <strong>${digitalEvidenceCount}/2</strong>
                <small>digital evidence</small>
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
            <div class="stage-card">
              <h4>Permit Information</h4>
              <div class="detail-row">
                <div><strong>Requester</strong><p class="muted">${escapeHtml(permit.requestedBy || '-')}</p></div>
                <div><strong>Work Type</strong><p class="muted">${escapeHtml(getPermitType(permit))}</p></div>
              </div>
              <div class="detail-row">
                <div><strong>Schedule</strong><p class="muted">${formatDateTime(permit.startDateTime)} to ${formatDateTime(permit.endDateTime)}</p></div>
                <div><strong>Assigned Workers</strong><p class="muted">${escapeHtml(workers)}</p></div>
              </div>
              <div class="detail-row">
                <div><strong>Permit Type</strong><p class="muted">${escapeHtml(formatList(permit.hazards))}</p></div>
              </div>
            </div>
            ${rejectionMarkup}
          </section>

          <section class="admin-review-stage" data-stage-panel>
            ${evidenceMarkup}
          </section>

          <section class="admin-review-stage" data-stage-panel>
            <div class="stage-card">
              <h4>Scope and Controls</h4>
              <div class="detail-row">
                <div><strong>Description</strong><p class="muted multiline">${escapeHtml(extractScope(permit.description) || permit.description || '-')}</p></div>
              </div>
              <div class="detail-row">
                <div><strong>Control Measures</strong><p class="muted multiline">${escapeHtml(formatList(permit.controls))}</p></div>
                <div><strong>PPE</strong><p class="muted multiline">${escapeHtml(formatList(permit.ppe))}</p></div>
              </div>
            </div>
          </section>

          <section class="admin-review-stage" data-stage-panel>
            <div class="route-submit-card">
              <h4>Final Route Check</h4>
              <p class="muted">Confirm the package is complete before sending this permit to Safety Officer review.</p>
              <div class="review-strip">
                <div>
                  <span>Route</span>
                  <strong>${escapeHtml(routeText === '-' ? 'Safety Officer' : routeText)}</strong>
                  <small>next approval stage</small>
                </div>
                <div>
                  <span>Status</span>
                  <strong>${formatStatus(permit.status)}</strong>
                  <small>current admin lane</small>
                </div>
                <div>
                  <span>Evidence</span>
                  <strong>${digitalEvidenceCount}/2</strong>
                  <small>MOS/JSA forms</small>
                </div>
              </div>
              <div class="button-row">
                ${actionMarkup}
              </div>
            </div>
          </section>

          <div class="review-stage-actions">
            <button class="btn small secondary" type="button" data-stage-prev>Back</button>
            <button class="btn small" type="button" data-stage-next>Next stage</button>
          </div>
        </div>
      </div>
    `;

    wireReviewStages(target);
    target.querySelector('#submitPermitButton')?.addEventListener('click', () => submitPermit(permit));
    target.querySelector('[data-mos-jsa-export]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      downloadMosJsaExcel(permit.id)
        .then(() => {
          elements.sectionStatus.textContent = 'Exported MOS/JSA digital form to Excel.';
        })
        .catch((error) => {
          elements.sectionStatus.textContent = error.message || 'Unable to export MOS/JSA Excel.';
        });
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

    return `
      <section class="permit-route" aria-label="Permit status route">
        <div class="permit-route-head">
          <div>
            <span>Permit status route</span>
            <strong>${escapeHtml(formatStatus(permit.status))}</strong>
          </div>
          <small>${escapeHtml(formatPermitRouteId(permit))}</small>
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

  function formatPermitRouteId(permit) {
    const raw = String(permit.id || '').trim();
    if (/^PTW-/i.test(raw)) return raw.toUpperCase();
    if (/^[0-9a-f-]{20,}$/i.test(raw)) return `PTW-${raw.slice(0, 4).toUpperCase()}`;
    return raw || 'PTW';
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

  function timeValue(value) {
    const parsed = Date.parse(value || '');
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function permitHistoryTitle(status, action = '') {
    const normalizedStatus = String(status || '').toLowerCase();
    const normalizedAction = String(action || '').toLowerCase();

    if (normalizedAction === 'created') return 'Draft Created';
    if (normalizedAction === 'details updated') {
      return normalizedStatus === 'resubmitted'
        ? 'Requester Updated and Resubmitted'
        : 'Permit Details Updated';
    }
    if (normalizedAction === 'extension requested') return 'Extension Requested';
    if (normalizedAction === 'extension reviewed') return 'Extension Reviewed';

    const labels = {
      draft: 'Draft Created',
      submitted: 'Sent to Safety Officer Review',
      resubmitted: 'Requester Resubmitted',
      stage1_complete: 'Safety Officer MOS/JSA Complete',
      approved: 'Supervisor Final Approval',
      active: 'Work Active',
      rejected: 'Returned for Correction',
      cancelled: 'Permit Cancelled',
      closed: 'Permit Closed',
    };

    return labels[normalizedStatus] || formatStatus(status || action || 'Updated');
  }

  function formatHistoryActor(log) {
    const actor = log?.by || 'System';
    const role = log?.byRole ? formatStatus(log.byRole) : '';
    return role ? `${actor} - ${role}` : actor;
  }

  function buildPermitHistoryEvents(permit) {
    const logs = Array.isArray(state.permitLogs[permit.id]) ? state.permitLogs[permit.id] : [];
    const events = logs
      .map((log) => {
        const transition = [log.from ? formatStatus(log.from) : '', log.status ? formatStatus(log.status) : '']
          .filter(Boolean)
          .join(' to ');

        return {
          time: log.when,
          title: permitHistoryTitle(log.status, log.action),
          actor: formatHistoryActor(log),
          detail: log.comment || transition || formatStatus(log.action || ''),
          status: log.status || permit.status,
        };
      })
      .filter((event) => event.title);

    const hasCreatedEvent = events.some((event) => event.title === 'Draft Created');
    if (!hasCreatedEvent && permit.createdAt) {
      events.unshift({
        time: permit.createdAt,
        title: 'Draft Created',
        actor: permit.requestedBy || 'Requester',
        detail: 'Permit created as draft',
        status: 'draft',
      });
    }

    const currentStatus = String(permit.status || '').toLowerCase();
    const hasCurrentStatus = events.some((event) => String(event.status || '').toLowerCase() === currentStatus);
    if (currentStatus && !hasCurrentStatus && permit.updatedAt) {
      events.push({
        time: permit.updatedAt,
        title: permitHistoryTitle(currentStatus),
        actor: 'PTW Guardian',
        detail: 'Current permit status',
        status: currentStatus,
      });
    }

    return events.sort((a, b) => timeValue(a.time) - timeValue(b.time));
  }

  function renderPermitHistoryDetail(permit) {
    const events = buildPermitHistoryEvents(permit);
    const latestEvent = events[events.length - 1] || {};

    return `
      <article class="permit-history-card permit-history-detail-card">
        <div class="permit-history-card-head">
          <div>
            <span class="permit-history-id">${escapeHtml(formatPermitRouteId(permit))}</span>
            <h4>${escapeHtml(permit.title || 'Untitled permit')}</h4>
            <p class="muted">${escapeHtml(permit.location || '-')} - ${escapeHtml(getPermitType(permit))}</p>
          </div>
          <span class="badge ${statusBadge(permit.status)}">${escapeHtml(formatStatus(permit.status))}</span>
        </div>

        <div class="permit-history-meta">
          <div>
            <span>Requester</span>
            <strong>${escapeHtml(permit.requestedBy || '-')}</strong>
          </div>
          <div>
            <span>Created</span>
            <strong>${escapeHtml(formatDateTime(permit.createdAt))}</strong>
          </div>
          <div>
            <span>Latest movement</span>
            <strong>${escapeHtml(formatDateTime(latestEvent.time || permit.updatedAt))}</strong>
          </div>
        </div>

        <ol class="permit-history-timeline">
          ${events.map((event, index) => `
            <li class="permit-history-event ${index === events.length - 1 ? 'is-current' : ''}">
              <i aria-hidden="true"></i>
              <div>
                <strong>${escapeHtml(event.title)}</strong>
                <span>${escapeHtml(event.actor)} - ${escapeHtml(formatDateTime(event.time))}</span>
                ${event.detail ? `<p>${escapeHtml(event.detail)}</p>` : ''}
              </div>
            </li>
          `).join('')}
        </ol>
      </article>
    `;
  }

  function renderPermitHistory(query = '') {
    if (!elements.permitHistoryBody) return;

    const lowerQuery = query.trim().toLowerCase();
    const permits = [...state.permits]
      .sort((a, b) => timeValue(b.updatedAt || b.createdAt) - timeValue(a.updatedAt || a.createdAt));
    const visible = permits.filter((permit) => {
      const events = buildPermitHistoryEvents(permit);
      const searchable = [
        permit.id,
        permit.title,
        permit.location,
        permit.requestedBy,
        permit.status,
        getPermitType(permit),
        ...events.flatMap((event) => [event.title, event.actor, event.detail, event.status]),
      ].join(' ').toLowerCase();

      return !lowerQuery || searchable.includes(lowerQuery);
    });

    const emptyState = document.querySelector('#permitHistoryEmpty');
    emptyState?.classList.toggle('hidden', visible.length > 0);
    if (elements.permitHistoryCount) {
      elements.permitHistoryCount.textContent = `${visible.length} permit${visible.length === 1 ? '' : 's'}`;
    }

    if (!visible.length) {
      state.activeHistoryPermitId = '';
      elements.permitHistoryBody.innerHTML = '';
      return;
    }

    const activeStillVisible = visible.some((permit) => permit.id === state.activeHistoryPermitId);
    if (!activeStillVisible) {
      state.activeHistoryPermitId = visible[0].id;
    }

    const selectedPermit = visible.find((permit) => permit.id === state.activeHistoryPermitId) || visible[0];

    elements.permitHistoryBody.innerHTML = `
      <div class="permit-history-layout">
        <div class="permit-history-list" aria-label="Permit history list">
          ${visible.map((permit) => {
            const events = buildPermitHistoryEvents(permit);
            const latestEvent = events[events.length - 1] || {};
            const isSelected = permit.id === selectedPermit.id;

            return `
              <button class="permit-history-list-item ${isSelected ? 'active' : ''}" type="button" data-history-permit="${escapeHtml(permit.id)}">
                <span class="permit-history-list-top">
                  <strong>${escapeHtml(permit.title || 'Untitled permit')}</strong>
                  <em class="badge ${statusBadge(permit.status)}">${escapeHtml(formatStatus(permit.status))}</em>
                </span>
                <span class="permit-history-list-meta">
                  ${escapeHtml(formatPermitRouteId(permit))} - ${escapeHtml(permit.location || '-')}
                </span>
                <span class="permit-history-list-event">
                  ${escapeHtml(latestEvent.title || permitHistoryTitle(permit.status))} - ${escapeHtml(formatDateTime(latestEvent.time || permit.updatedAt))}
                </span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="permit-history-detail">
          ${renderPermitHistoryDetail(selectedPermit)}
        </div>
      </div>
    `;

    elements.permitHistoryBody.querySelectorAll('[data-history-permit]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeHistoryPermitId = button.dataset.historyPermit;
        renderPermitHistory(elements.searchInput?.value || '');
      });
    });
  }

  function renderAudit(query = '') {
    const lowerQuery = query.trim().toLowerCase();
    const trackedWorkStates = new Set(['held', 'stopped', 'resumed', 'final_closure', 'sent_for_closure']);
    const permitAuditRows = Object.entries(state.permitLogs || {}).flatMap(([permitId, logs]) => {
      const permit = state.permits.find((item) => item.id === permitId);
      return (Array.isArray(logs) ? logs : [])
        .filter((log) => {
          const action = String(log.action || '').toLowerCase();
          const nextState = String(log.status || '').toLowerCase();
          return (action === 'work state changed' && trackedWorkStates.has(nextState))
            || (action === 'status changed' && nextState === 'closed');
        })
        .map((log) => {
          const stateLabel = permitHistoryTitle(log.status, log.action);
          const permitLabel = permit ? formatPermitRouteId(permit) : permitId;
          return {
            time: formatDateTime(log.when),
            sortTime: Date.parse(log.when || '') || 0,
            actor: formatHistoryActor(log),
            action: `${permitLabel} — ${stateLabel}${log.comment ? ` — ${log.comment}` : ''}`,
            status: formatStatus(log.status || 'Recorded'),
          };
        });
    });
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
    const rows = [...permitAuditRows, ...completionRows, ...state.audits].filter((audit) =>
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
        closedAt: window.PTWTime?.iso?.() || new Date().toISOString(),
        closedBy: state.session?.user?.fullName || 'PTW Admin',
      };
      persistStoredObject(COMPLETION_STORAGE_KEY, state.completionRequests);
      setPermitWorkState(permit.id, 'closed');
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
    elements.addWorkerKicker.textContent = 'Edit Worker Record';
    elements.addWorkerDialogTitle.textContent = 'Edit Worker';
    elements.addWorkerDialogSubtitle.textContent = 'Update the worker details, permit authorizations, and competency certificates.';
    elements.addWorkerMessage.textContent = '';
    elements.addWorkerSubmit.textContent = 'Save Worker';
    if (elements.addWorkerDialog && !elements.addWorkerDialog.open) {
      elements.addWorkerDialog.showModal();
    }
    window.setTimeout(() => elements.newWorkerName?.focus({ preventScroll: true }), 80);
  }

  function openAddWorkerForm() {
    clearWorkerForm();
    if (elements.addWorkerDialog && !elements.addWorkerDialog.open) {
      elements.addWorkerDialog.showModal();
    }
    elements.sectionStatus.textContent = 'Add worker details, then save the competency record.';
    elements.addWorkerMessage.textContent = '';
    window.setTimeout(() => elements.newWorkerName?.focus({ preventScroll: true }), 80);
  }

  function cancelAddWorkerForm() {
    clearWorkerForm();
    if (elements.addWorkerDialog?.open) {
      elements.addWorkerDialog.close();
    }
    elements.sectionStatus.textContent = 'Worker addition cancelled.';
  }

  async function deleteWorker(worker) {
    if (!confirm(`Delete ${worker.name || 'this worker'}?`)) return;

    try {
      await apiRequest(`/api/workers/${encodeURIComponent(worker.id)}`, { method: 'DELETE' });
      await loadData();
      addAudit(`Deleted worker record ${worker.name}`);
      renderCompetency(elements.searchInput?.value || '');
      updateKpis();
      if (elements.workerReviewDialog?.open) {
        elements.workerReviewDialog.close();
      }
      elements.sectionStatus.textContent = `Deleted worker record ${worker.name || worker.id}.`;
    } catch (error) {
      elements.sectionStatus.textContent = error.error || 'Unable to delete worker.';
    }
  }

  async function updateWorkerReviewStatus(worker, status, suppliedReviewComment) {
    const reviewComment = status === 'valid' ? '' : suppliedReviewComment || 'Deactivated by Admin';

    try {
      const result = await apiRequest(`/api/workers/${encodeURIComponent(worker.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewComment }),
      });
      await loadData();
      renderCompetency(elements.searchInput?.value || '');
      updateKpis();
      addAudit(
        `${status === 'valid' ? 'Marked valid' : 'Deactivated'} worker profile ${worker.name}`,
      );
      if (elements.workerReviewDialog?.open) {
        elements.workerReviewDialog.close();
      }
      if (status === 'valid' && result.workerAccount) {
        if (result.workerAccount.skipped) {
          elements.sectionStatus.textContent = `Worker marked valid. Account not created: ${result.workerAccount.reason}`;
        } else {
          elements.sectionStatus.textContent = `Marked valid worker profile ${worker.name}. Worker login account is active.`;
        }
      } else {
        elements.sectionStatus.textContent = `${status === 'valid' ? 'Marked valid' : 'Deactivated'} worker profile ${worker.name}.`;
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
    elements.addWorkerKicker.textContent = 'Worker Record';
    elements.addWorkerDialogTitle.textContent = 'Add Worker';
    elements.addWorkerDialogSubtitle.textContent = 'Enter the worker details, permit authorizations, and competency certificates.';
    elements.addWorkerMessage.textContent = '';
    elements.addWorkerSubmit.textContent = 'Add Worker';
  }

  async function saveWorker(event) {
    event.preventDefault();
    const name = elements.newWorkerName.value.trim();
    const icPassport = elements.newWorkerIcPassport.value.trim();
    if (!name || !icPassport) {
      elements.sectionStatus.textContent = 'Full name and IC/Passport number are required.';
      elements.addWorkerMessage.textContent = 'Full name and IC/Passport number are required.';
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
      if (elements.addWorkerDialog?.open) {
        elements.addWorkerDialog.close();
      }
      await loadData();
      renderCompetency(elements.searchInput?.value || '');
      updateKpis();
    } catch (error) {
      elements.sectionStatus.textContent = error.error || 'Unable to save worker.';
      elements.addWorkerMessage.textContent = error.error || 'Unable to save worker.';
    }
  }

  function updateSearchResults() {
    const query = elements.searchInput?.value || '';
    if (state.activeSection === 'competency') renderCompetency(query);
    if (state.activeSection === 'draftReview') renderQueue(query);
    if (state.activeSection === 'permitHistory') renderPermitHistory(query);
    if (state.activeSection === 'auditTrails') renderAudit(query);
  }

  async function refresh() {
    await loadData();
    updateKpis();
    updateSearchResults();
    elements.sectionStatus.textContent = 'Admin Lane 2 refreshed.';
  }

  function getRequestedSection() {
    const validSections = new Set(['competency', 'draftReview', 'permitHistory', 'auditTrails']);
    const aliases = {
      userRoles: '',
      userManagement: '',
      users: '',
      history: 'permitHistory',
      permits: 'permitHistory',
      permitHistory: 'permitHistory',
    };
    const rawSection =
      new URLSearchParams(window.location.search).get('section') ||
      window.location.hash.replace(/^#/, '');
    const requested = aliases[rawSection] || rawSection;
    return validSections.has(requested) ? requested : '';
  }

  function wireEvents() {
    const sections = ['competency', 'draftReview', 'permitHistory', 'auditTrails'];
    elements.navItems.forEach((item, index) => {
      item.dataset.section = sections[index];
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
    elements.notificationReadAllButton?.addEventListener('click', markAllNotificationsRead);
    elements.notificationList?.addEventListener('click', (event) => {
      const persistentButton = event.target.closest('[data-notification-id]');
      if (persistentButton) {
        const notificationId = persistentButton.dataset.notificationId;
        const link = persistentButton.dataset.notificationLink || '';
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
        if (elements.searchInput) elements.searchInput.value = entityId;
        setActiveSection(entityType === 'worker' ? 'competency' : 'draftReview');
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
    elements.addWorkerButton?.addEventListener('click', openAddWorkerForm);
    elements.cancelAddWorkerButton?.addEventListener('click', cancelAddWorkerForm);
    document.querySelectorAll('[data-close-add-worker]').forEach((button) => {
      button.addEventListener('click', cancelAddWorkerForm);
    });
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
        const exportButton = event.target.closest('[data-mos-jsa-export]');
        if (exportButton) {
          downloadMosJsaExcel(exportButton.dataset.mosJsaExport)
            .then(() => {
              elements.sectionStatus.textContent = 'Exported MOS/JSA digital form to Excel.';
            })
            .catch((error) => {
              elements.sectionStatus.textContent = error.message || 'Unable to export MOS/JSA Excel.';
            });
          return;
        }

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
    elements.deactivateWorkerButton?.addEventListener('click', () => {
      const worker = getWorkerRecord(state.activeReviewWorkerId);
      if (worker) updateWorkerReviewStatus(worker, 'inactive', 'Deactivated by Admin');
    });
    elements.deleteWorkerButton?.addEventListener('click', () => {
      const worker = getWorkerRecord(state.activeReviewWorkerId);
      if (worker) deleteWorker(worker);
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
    renderPermitHistory();
    renderAudit();
    const requestedSection = getRequestedSection();
    setActiveSection(requestedSection || (getDraftQueue().length ? 'draftReview' : state.activeSection));
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
