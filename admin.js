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
    userRoleList: document.querySelector('#userRoleList'),
    userRoleCount: document.querySelector('#userRoleCount'),
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
    settingsButton: document.querySelector('#settingsButton'),
    supportButton: document.querySelector('#supportButton'),
  };

  const sectionPanels = {
    competency: document.querySelector('#manageCompetencySection'),
    draftReview: document.querySelector('#permitQueueSection'),
    routing: document.querySelector('#permitClosureSection'),
    userRoles: document.querySelector('#userRolesSection'),
    auditTrails: document.querySelector('#auditTrailsSection'),
  };

  const state = {
    session: readSession(),
    workers: [],
    users: [],
    assignableRoles: [],
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

  const userRoleLabels = {
    admin: 'Admin',
    requester: 'Requester',
    supervisor: 'Supervisor',
    safety_officer: 'Safety Officer',
  };

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

  function roleLabel(role) {
    return userRoleLabels[role] || String(role || 'User').replace(/_/g, ' ');
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
    if (['valid', 'approved', 'active'].includes(normalized)) return 'valid';
    if (['submitted', 'resubmitted', 'stage1_complete'].includes(normalized)) return 'pending';
    if (['expired', 'rejected', 'returned', 'inactive'].includes(normalized)) return 'danger';
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
    const [workerResult, permitResult, notificationResult, userResult] = await Promise.all([
      apiRequest('/api/workers'),
      apiRequest('/api/permits'),
      loadNotifications(),
      apiRequest('/api/users'),
    ]);

    state.workers = workerResult.workers || workerResult.data || [];
    state.permits = permitResult.permits || permitResult.data || [];
    state.notifications = notificationResult.notifications || notificationResult.data || [];
    state.users = userResult.users || userResult.data || [];
    state.assignableRoles = userResult.assignableRoles || [];
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
      userRoles: 'User Role Management',
      auditTrails: 'Admin Audit Trail',
    };
    const subtitles = {
      competency: 'Review requester-submitted worker profiles, certifications, and permit authorization records.',
      draftReview: 'Clerically verify draft package completeness and formally submit to pending approval.',
      userRoles: 'Assign multiple application access roles to non-worker accounts.',
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
      row.querySelector('[data-worker-status="inactive"]')?.addEventListener('click', () =>
        updateWorkerReviewStatus(worker, 'inactive', 'Deactivated by Admin'),
      );
      row.querySelector('[data-worker-delete]')?.addEventListener('click', () => deleteWorker(worker));
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
    const deleteButton = '<button class="btn small danger" type="button" data-worker-delete>Delete</button>';
    if (status === 'submitted') {
      return `
        <span class="admin-actions">
          <button class="btn small secondary" type="button" data-worker-review>Review</button>
          <button class="btn small" type="button" data-worker-status="valid">Mark Valid</button>
          <button class="btn small secondary" type="button" data-worker-status="inactive">Deactivate</button>
          ${deleteButton}
        </span>
      `;
    }

    if (status === 'inactive' || status === 'rejected') {
      return `
        <span class="admin-actions">
          <button class="btn small secondary" type="button" data-worker-review>Review</button>
          <button class="btn small" type="button" data-worker-status="valid">Reactivate</button>
          ${deleteButton}
          <span class="meta-muted">${escapeHtml(worker.reviewComment || 'Inactive')}</span>
        </span>
      `;
    }

    return `
      <span class="admin-actions">
        <button class="btn small secondary" type="button" data-worker-review>Review</button>
        <button class="btn small secondary" type="button" data-worker-status="inactive">Deactivate</button>
        ${deleteButton}
      </span>
    `;
  }

  function openWorkerReview(worker) {
    const status = workerStatusLabel(worker.status);
    const permits = normalizeWorkerPermits(worker.permits);
    state.activeReviewWorkerId = worker.id;
    elements.workerReviewTitle.textContent = worker.name || 'Worker profile';
    elements.workerReviewSubtitle.textContent = `${worker.employeeId || worker.id || '-'} - ${status}`;
    elements.approveWorkerButton.disabled = String(worker.status || '').toLowerCase() === 'valid';

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
      ? '<button class="btn small" id="submitPermitButton" type="button">Submit to Approval Route</button>'
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

    target.innerHTML = `
      <div class="detail-card">
        <div class="card-head">
          <div>
            <h3>${escapeHtml(permit.title)}</h3>
            <p class="muted">${escapeHtml(permit.location || '-')}</p>
          </div>
          <span class="badge ${statusBadge(permit.status)}">${formatStatus(permit.status)}</span>
        </div>

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
        ${rejectionMarkup}
        ${renderDigitalEvidence(permit)}
        ${renderSupportingFiles(permit)}
        <section class="review-block">
          <div class="review-block-head">
            <h4>Scope and Controls</h4>
          </div>
          <div class="detail-row">
            <div><strong>Description</strong><p class="muted multiline">${escapeHtml(extractScope(permit.description) || permit.description || '-')}</p></div>
          </div>
          <div class="detail-row">
            <div><strong>Control Measures</strong><p class="muted multiline">${escapeHtml(formatList(permit.controls))}</p></div>
            <div><strong>PPE</strong><p class="muted multiline">${escapeHtml(formatList(permit.ppe))}</p></div>
          </div>
        </section>
        <div class="button-row">
          ${actionMarkup}
        </div>
      </div>
    `;

    document.querySelector('#submitPermitButton')?.addEventListener('click', () => submitPermit(permit));
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

  function renderUserRoles(query = '') {
    if (!elements.userRoleList) return;

    const roles = state.assignableRoles.length
      ? state.assignableRoles
      : ['admin', 'requester', 'supervisor', 'safety_officer'];
    const lowerQuery = query.trim().toLowerCase();
    const users = state.users.filter((user) => {
      const searchable = [
        user.fullName,
        user.email,
        user.employeeId,
        user.organization,
        ...getUserRoles(user).map(roleLabel),
      ].join(' ').toLowerCase();
      return !lowerQuery || searchable.includes(lowerQuery);
    });

    if (elements.userRoleCount) {
      elements.userRoleCount.textContent = `${users.length} user${users.length === 1 ? '' : 's'}`;
    }

    if (!users.length) {
      elements.userRoleList.innerHTML = `
        <div class="empty-state" role="status" aria-live="polite">
          <strong>No application users found</strong>
          <p class="muted">Create a non-worker account first, then assign access roles here.</p>
        </div>
      `;
      return;
    }

    elements.userRoleList.innerHTML = users
      .map((user) => {
        const userRoles = getUserRoles(user);
        const initials = (user.fullName || user.email || 'User')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0].toUpperCase())
          .join('') || 'U';
        const selectedLabels = userRoles.map(roleLabel).join(', ') || 'No role';
        return `
          <article class="user-role-card" data-user-id="${escapeHtml(user.id)}">
            <div class="user-role-person">
              <div class="admin-worker-avatar">${escapeHtml(initials)}</div>
              <div>
                <strong>${escapeHtml(user.fullName || 'Unnamed user')}</strong>
                <span>${escapeHtml(user.email || user.employeeId || '-')}</span>
                <small>${escapeHtml(user.organization || 'PTW Guardian')}</small>
              </div>
            </div>
            <div class="user-role-current">
              <span class="meta-muted">Current access</span>
              <strong>${escapeHtml(selectedLabels)}</strong>
            </div>
            <div class="user-role-options">
              ${roles.map((role) => `
                <label class="user-role-option">
                  <input type="checkbox" data-user-role="${escapeHtml(role)}" ${userRoles.includes(role) ? 'checked' : ''}>
                  <span>${escapeHtml(roleLabel(role))}</span>
                </label>
              `).join('')}
            </div>
            <button class="btn small" type="button" data-user-role-save="${escapeHtml(user.id)}">Save Roles</button>
          </article>
        `;
      })
      .join('');
  }

  async function saveUserRoles(userId) {
    const card = elements.userRoleList?.querySelector(`[data-user-id="${CSS.escape(userId)}"]`);
    if (!card) return;

    const roles = Array.from(card.querySelectorAll('[data-user-role]:checked'))
      .map((input) => input.dataset.userRole)
      .filter(Boolean);
    if (!roles.length) {
      elements.sectionStatus.textContent = 'Select at least one role for this user.';
      return;
    }

    try {
      const result = await apiRequest(`/api/users/${encodeURIComponent(userId)}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles }),
      });
      state.users = state.users.map((user) => user.id === userId ? result.user : user);
      if (result.user?.id === state.session?.user?.id) {
        writeSessionUser(result.user);
      }
      renderUserRoles(elements.searchInput?.value || '');
      elements.sectionStatus.textContent = `Updated roles for ${result.user?.fullName || 'user'}.`;
    } catch (error) {
      elements.sectionStatus.textContent = error.error || 'Unable to update user roles.';
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
    if (state.activeSection === 'userRoles') renderUserRoles(query);
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
      item.dataset.section = ['competency', 'draftReview', 'userRoles', 'auditTrails'][index];
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
    elements.userRoleList?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-user-role-save]');
      if (!button) return;
      saveUserRoles(button.dataset.userRoleSave);
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
    renderUserRoles();
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
