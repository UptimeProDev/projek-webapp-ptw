document.addEventListener('DOMContentLoaded', () => {
  const SESSION_KEY = 'ptwSession';
  const state = { session: readSession(), view: 'overview', overview: null, tenants: [], companyTenants: [], audit: [], health: null };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function readSession() {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  function roles(user) { return [...new Set([...(Array.isArray(user?.roles) ? user.roles : []), user?.role].filter(Boolean))]; }
  function initials(value) { return String(value || 'SA').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
  function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
  function formatDate(value, includeTime = true) {
    if (!value) return 'No activity';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric', ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(date);
  }
  function relativeTime(value) {
    const diff = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(diff)) return '';
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  }
  function titleCase(value) { return String(value || '').replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', Authorization: `Bearer ${state.session?.token || ''}`, ...(options.headers || {}) } });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }
  function toast(message, type = '') {
    const element = $('#toast');
    element.textContent = message;
    element.className = `toast ${type}`;
    element.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { element.hidden = true; }, 4200);
  }
  function setBusy(button, busy, label = 'Working…') {
    if (!button) return;
    if (busy) { button.dataset.label = button.textContent; button.textContent = label; }
    else if (button.dataset.label) { button.textContent = button.dataset.label; delete button.dataset.label; }
    button.disabled = busy;
  }

  function showView(view) {
    state.view = view;
    $$('.view').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === view));
    $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    $('#breadcrumbTitle').textContent = titleCase(view);
    $('#sidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadView(view).catch(handleError);
  }
  async function loadView(view) {
    if (view === 'overview') return loadOverview();
    if (view === 'tenants') return loadTenants();
    if (view === 'admins') return loadAdmins();
    if (view === 'security') return loadSecurity();
    if (view === 'audit') return loadAudit();
    if (view === 'monitoring') return loadHealth();
    if (view === 'configuration') return loadSettings();
  }
  function handleError(error) {
    if (error.status === 401) {
      localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
      window.location.replace('/login');
      return;
    }
    toast(error.message, 'error');
  }

  async function loadOverview() {
    const data = await api('/api/platform/overview');
    state.overview = data;
    const m = data.metrics;
    $('#metricTenants').textContent = m.totalTenants;
    $('#metricActiveTenants').textContent = m.activeTenants;
    $('#metricUsers').textContent = m.tenantUsers;
    $('#metricPermits').textContent = m.totalPermits;
    $('#metricActivePermits').textContent = m.activePermits;
    $('#metricAlerts').textContent = m.securityAlerts;
    $('#pendingBadge').textContent = m.pendingTenants;
    $('#alertBadge').textContent = m.securityAlerts;
    $('#attentionText').textContent = m.pendingTenants ? `${m.pendingTenants} legacy tenant${m.pendingTenants === 1 ? '' : 's'} still needs activation.` : 'All tenant onboarding is complete.';
    $('#attentionBanner').hidden = !m.pendingTenants;
    $('#donutTotal').textContent = m.totalTenants;
    $('#legendActive').textContent = m.activeTenants;
    $('#legendPending').textContent = m.pendingTenants;
    $('#legendSuspended').textContent = m.suspendedTenants;
    const total = Math.max(1, m.activeTenants + m.pendingTenants + m.suspendedTenants);
    $('#tenantDonut').style.setProperty('--active', (m.activeTenants / total) * 100);
    $('#tenantDonut').style.setProperty('--pending', (m.pendingTenants / total) * 100);
    renderActivity(data.recentActivity);
  }
  function renderActivity(items) {
    $('#recentActivity').innerHTML = items.length ? items.map((item) => `
      <div class="activity-item"><span class="activity-mark">${item.category === 'security' ? '◇' : item.category === 'configuration' ? '⚙' : '▦'}</span><div><strong>${escapeHtml(titleCase(item.action))}</strong><small>${escapeHtml(item.actor_name)}${item.reason ? ` · ${escapeHtml(item.reason)}` : ''}</small></div><time>${relativeTime(item.occurred_at)}</time></div>
    `).join('') : '<div class="empty-state">No platform administration events yet.</div>';
  }

  async function loadTenants() {
    const q = encodeURIComponent($('#tenantSearch').value.trim());
    const status = encodeURIComponent($('#tenantStatusFilter').value);
    const data = await api(`/api/platform/tenants?q=${q}&status=${status}`);
    state.tenants = data.tenants;
    $('#tenantCount').textContent = `${data.count} organization${data.count === 1 ? '' : 's'}`;
    $('#tenantRows').innerHTML = data.tenants.length ? data.tenants.map(tenantRow).join('') : '<tr><td colspan="6"><div class="empty-state">No organizations match this search.</div></td></tr>';
  }
  async function ensureCompanySelectors() {
    if (!state.companyTenants.length) {
      const data = await api('/api/platform/tenants');
      state.companyTenants = data.tenants || [];
    }
    const activeTenants = state.companyTenants.filter((tenant) => tenant.status !== 'archived');
    const options = `<option value="">Select a company</option>${activeTenants.map((tenant) => `<option value="${escapeHtml(tenant.id)}">${escapeHtml(tenant.name)} · ${escapeHtml(tenant.registrationNo)}</option>`).join('')}`;
    ['securityTenantSelect', 'auditTenantSelect'].forEach((id) => {
      const select = $(`#${id}`);
      const selected = select.value;
      select.innerHTML = options;
      select.value = activeTenants.some((tenant) => tenant.id === selected) ? selected : (activeTenants[0]?.id || '');
    });
  }
  function tenantRow(tenant) {
    const nextAction = ['inactive', 'suspended', 'pending'].includes(tenant.status) ? ['active', 'Activate'] : tenant.status === 'archived' ? ['active', 'Unarchive'] : tenant.status === 'active' ? ['inactive', 'Deactivate'] : [null, null];
    return `<tr data-tenant-id="${escapeHtml(tenant.id)}"><td><div class="company-cell"><span class="company-logo">${escapeHtml(initials(tenant.name))}</span><div><strong>${escapeHtml(tenant.name)}</strong><small>${escapeHtml(tenant.registrationNo)}</small></div></div></td><td><div class="person-cell"><div><strong>${escapeHtml(tenant.adminName || 'Tenant Admin')}</strong><small>${escapeHtml(tenant.adminEmail || tenant.contactEmail)}</small></div></div></td><td><strong>${tenant.userCount}</strong> users · <strong>${tenant.permitCount}</strong> permits</td><td><span class="status-pill ${escapeHtml(tenant.status)}">${escapeHtml(tenant.status === 'suspended' ? 'inactive' : tenant.status)}</span></td><td>${formatDate(tenant.lastActivityAt, false)}</td><td><div class="row-actions"><button data-view-tenant="${tenant.id}">View</button>${nextAction[0] ? `<button class="${nextAction[0] === 'inactive' ? 'danger' : ''}" data-lifecycle="${nextAction[0]}" data-tenant="${tenant.id}" data-name="${escapeHtml(tenant.name)}">${nextAction[1]}</button>` : ''}${tenant.status !== 'archived' ? `<button data-lifecycle="archived" data-tenant="${tenant.id}" data-name="${escapeHtml(tenant.name)}">Archive</button>` : ''}${['pending', 'inactive', 'archived'].includes(tenant.status) && tenant.permitCount === 0 ? `<button class="danger" data-lifecycle="deleted" data-tenant="${tenant.id}" data-name="${escapeHtml(tenant.name)}">Delete</button>` : ''}</div></td></tr>`;
  }

  async function loadAdmins() {
    const data = await api('/api/platform/admins');
    $('#adminGrid').innerHTML = data.admins.length ? data.admins.map((admin) => `<article class="admin-card"><div class="admin-card-head"><span class="avatar">${escapeHtml(initials(admin.fullName))}</span><div><strong>${escapeHtml(admin.fullName)}</strong><small>${escapeHtml(admin.email)}</small></div></div><div class="admin-meta"><span class="status-pill ${escapeHtml(admin.accountStatus)}">${escapeHtml(admin.accountStatus)}</span><span>MFA required</span></div></article>`).join('') : '<div class="empty-state">No platform administrators found.</div>';
  }
  async function loadSecurity() {
    await ensureCompanySelectors();
    const organizationId = $('#securityTenantSelect').value;
    if (!organizationId) {
      $('#securityScopeBanner').textContent = 'Select a company to view its isolated security records.';
      $('#activeSessionCount').textContent = '0'; $('#lockedAccountCount').textContent = '0'; $('#securityEventCount').textContent = '0';
      $('#sessionRows').innerHTML = '<tr><td colspan="5"><div class="empty-state">Select a company first.</div></td></tr>';
      $('#securityEvents').innerHTML = '<div class="empty-state">Select a company first.</div>';
      return;
    }
    const selected = state.companyTenants.find((tenant) => tenant.id === organizationId);
    const data = await api(`/api/platform/security?organizationId=${encodeURIComponent(organizationId)}`);
    $('#securityScopeBanner').textContent = `Showing only security records for ${selected?.name || 'the selected company'}. Records from other companies are excluded.`;
    $('#activeSessionCount').textContent = data.sessions.length;
    $('#lockedAccountCount').textContent = data.lockedAccounts.length;
    $('#securityEventCount').textContent = data.events.length;
    $('#sessionRows').innerHTML = data.sessions.length ? data.sessions.map((session) => `<tr><td><div class="person-cell"><span class="avatar">${escapeHtml(initials(session.full_name))}</span><div><strong>${escapeHtml(session.full_name)}</strong><small>${escapeHtml(session.email)}</small></div></div></td><td>${escapeHtml(titleCase(session.role))}</td><td>${escapeHtml(session.organization)}</td><td>${formatDate(session.updated_at)}</td><td><div class="row-actions"><button class="danger" data-revoke-session="${escapeHtml(session.id)}">Revoke</button></div></td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><strong>No active sessions for this company.</strong><br>Sessions appear after a company user signs in.</div></td></tr>';
    $('#securityEvents').innerHTML = data.events.length ? data.events.map((event) => `<div class="audit-event"><div><strong>${escapeHtml(titleCase(event.action))}</strong><small>${escapeHtml(event.actor_name)} · ${escapeHtml(event.reason || event.result)}</small></div><time>${formatDate(event.occurred_at)}</time></div>`).join('') : '<div class="empty-state"><strong>No security alerts recorded.</strong><br>Failed logins, tenant logins, session revocations, and account locks will appear here.</div>';
  }
  async function loadAudit() {
    await ensureCompanySelectors();
    const organizationId = $('#auditTenantSelect').value;
    const category = encodeURIComponent($('#auditCategory').value);
    if (!organizationId) {
      state.audit = [];
      $('#auditScopeBanner').textContent = 'Select a company to view its isolated audit trail.';
      $('#auditCount').textContent = '0 records';
      $('#auditRows').innerHTML = '<tr><td colspan="5"><div class="empty-state">Select a company first.</div></td></tr>';
      return;
    }
    const selected = state.companyTenants.find((tenant) => tenant.id === organizationId);
    const data = await api(`/api/platform/audit?organizationId=${encodeURIComponent(organizationId)}&category=${category}`);
    $('#auditScopeBanner').textContent = `Showing only append-only records linked to ${selected?.name || 'the selected company'}.`;
    state.audit = data.logs;
    $('#auditCount').textContent = `${data.count} record${data.count === 1 ? '' : 's'}`;
    $('#auditRows').innerHTML = data.logs.length ? data.logs.map((log) => `<tr><td><strong>${escapeHtml(titleCase(log.action))}</strong><br><small>${escapeHtml(log.reason || log.target_type || '')}</small></td><td>${escapeHtml(log.actor_name)}<br><small>${escapeHtml(titleCase(log.actor_role))}</small></td><td>${escapeHtml(titleCase(log.category))}</td><td><span class="status-pill ${log.result === 'success' ? 'active' : 'suspended'}">${escapeHtml(log.result)}</span></td><td>${formatDate(log.occurred_at)}</td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state">No audit records in this category.</div></td></tr>';
  }
  async function loadHealth() {
    const data = await api('/api/platform/health');
    state.health = data;
    $('#lastChecked').textContent = `Checked ${relativeTime(data.checkedAt)}`;
    $('#healthGrid').innerHTML = data.services.map((service) => `<article class="health-card ${escapeHtml(service.status)}"><div class="health-top"><span class="health-icon">${service.status === 'operational' ? '✓' : '!'}</span><span class="status-pill ${service.status === 'operational' ? 'active' : 'pending'}">${escapeHtml(service.status)}</span></div><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.detail)}</p></article>`).join('');
  }
  async function loadSettings() {
    const data = await api('/api/platform/settings');
    Object.entries(data.settings).forEach(([key, value]) => {
      const input = $(`[name="${key}"]`, $('#settingsForm'));
      if (!input) return;
      if (input.type === 'checkbox') input.checked = Boolean(value); else input.value = value ?? '';
    });
  }

  function openCreateModal() { $('#createTenantModal').hidden = false; $('input[name="name"]', $('#createTenantForm')).focus(); }
  function closeCreateModal() {
    $('#createTenantModal').hidden = true;
    $$('[data-password-toggle]', $('#createTenantForm')).forEach((button) => {
      const input = button.closest('.password-control')?.querySelector('input');
      if (input) input.type = 'password';
      button.classList.remove('is-visible');
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `Show ${button.dataset.passwordToggle === 'adminPasswordConfirm' ? 'confirmation' : 'login'} password`);
    });
  }
  function openActionModal(button) {
    const status = button.dataset.lifecycle;
    $('#actionForm').elements.tenantId.value = button.dataset.tenant;
    $('#actionForm').elements.status.value = status;
    $('#actionTitle').textContent = status === 'deleted' ? 'Permanently delete tenant' : status === 'inactive' ? 'Deactivate tenant' : `${status === 'active' ? 'Activate' : titleCase(status)} tenant`;
    $('#actionDescription').textContent = status === 'deleted' ? `This permanently removes the empty tenant ${button.dataset.name}. Tenants with operational history cannot be deleted.` : `${status === 'inactive' ? 'This will deactivate access for' : status === 'archived' ? 'This preserves history but removes routine access for' : 'This will activate platform access for'} ${button.dataset.name}.`;
    $('#confirmActionButton').className = status === 'active' ? 'primary-button' : 'danger-button';
    $('#confirmActionButton').textContent = status === 'active' ? 'Confirm activation' : status === 'inactive' ? 'Confirm deactivation' : status === 'deleted' ? 'Permanently delete' : `Confirm ${status}`;
    $('#actionModal').hidden = false;
    $('#actionForm').elements.reason.focus();
  }
  function closeActionModal() { $('#actionModal').hidden = true; $('#actionForm').reset(); }
  function detailValue(value, fallback = 'Not provided') { return value || fallback; }
  function openTenantDetails(tenantId) {
    const tenant = [...state.tenants, ...state.companyTenants].find((item) => item.id === tenantId);
    if (!tenant) return;
    $('#tenantDetailsTitle').textContent = tenant.name;
    $('#tenantDetailsSubtitle').textContent = `${tenant.registrationNo} · ${titleCase(tenant.status)}`;
    $('#tenantDetailBody').innerHTML = `<div class="tenant-detail-grid">
      <div><span>Tenant ID</span><strong>${escapeHtml(tenant.id)}</strong></div><div><span>Status</span><strong><span class="status-pill ${escapeHtml(tenant.status)}">${escapeHtml(tenant.status)}</span></strong></div>
      <div><span>Business email</span><strong>${escapeHtml(detailValue(tenant.contactEmail))}</strong></div><div><span>Contact number</span><strong>${escapeHtml(detailValue(tenant.contactNumber))}</strong></div>
      <div class="wide"><span>Registered address</span><strong>${escapeHtml(detailValue(tenant.registeredAddress))}</strong></div>
      <div><span>Primary contact</span><strong>${escapeHtml(detailValue(tenant.primaryContactName))}</strong></div><div><span>Service tier</span><strong>${escapeHtml(titleCase(detailValue(tenant.serviceTier)))}</strong></div>
      <div><span>Primary Tenant Admin</span><strong>${escapeHtml(detailValue(tenant.adminName))}<small>${escapeHtml(detailValue(tenant.adminEmail))}</small></strong></div><div><span>Admin status</span><strong>${escapeHtml(titleCase(detailValue(tenant.adminStatus)))}</strong></div>
      <div><span>Created</span><strong>${escapeHtml(formatDate(tenant.createdAt))}</strong></div><div><span>Activated</span><strong>${escapeHtml(formatDate(tenant.activatedAt))}</strong></div>
      <div><span>Last activity</span><strong>${escapeHtml(formatDate(tenant.lastActivityAt))}</strong></div><div><span>Usage</span><strong>${tenant.userCount} users · ${tenant.permitCount} permits</strong></div>
      <div class="wide"><span>Enabled modules</span><strong>${(tenant.enabledModules || []).length ? tenant.enabledModules.map((module) => `<em>${escapeHtml(titleCase(module))}</em>`).join('') : 'Not configured'}</strong></div>
      <div class="wide"><span>Internal notes</span><strong>${escapeHtml(detailValue(tenant.notes))}</strong></div>
    </div>`;
    const canActivate = ['archived', 'inactive', 'suspended', 'pending'].includes(tenant.status);
    const canDeactivate = tenant.status === 'active';
    const canDelete = ['pending', 'inactive', 'archived'].includes(tenant.status);
    $('#tenantDetailActions').innerHTML = `<button class="secondary-button" type="button" data-close-details>Close</button>${canDelete ? `<button class="danger-button" type="button" data-lifecycle="deleted" data-tenant="${escapeHtml(tenant.id)}" data-name="${escapeHtml(tenant.name)}">Delete tenant</button>` : ''}${canDeactivate ? `<button class="danger-button" type="button" data-lifecycle="inactive" data-tenant="${escapeHtml(tenant.id)}" data-name="${escapeHtml(tenant.name)}">Deactivate tenant</button>` : ''}${canActivate ? `<button class="primary-button" type="button" data-lifecycle="active" data-tenant="${escapeHtml(tenant.id)}" data-name="${escapeHtml(tenant.name)}">Activate tenant</button>` : ''}`;
    $('#tenantDetailsModal').hidden = false;
  }
  function closeTenantDetails() { $('#tenantDetailsModal').hidden = true; }
  function exportAudit() {
    const fields = ['occurred_at', 'actor_name', 'actor_role', 'category', 'action', 'target_type', 'target_id', 'reason', 'result'];
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [fields.join(','), ...state.audit.map((row) => fields.map((field) => quote(row[field])).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `ptw-platform-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); URL.revokeObjectURL(link.href);
    toast('Audit export prepared.');
  }

  $$('.nav-item').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  $$('[data-view-link]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.viewLink)));
  $$('[data-open-create]').forEach((button) => button.addEventListener('click', openCreateModal));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeCreateModal));
  $$('[data-close-action]').forEach((button) => button.addEventListener('click', closeActionModal));
  $('#tenantDetailsModal').addEventListener('click', (event) => {
    if (event.target.closest('[data-close-details]')) return closeTenantDetails();
    const action = event.target.closest('[data-lifecycle]');
    if (action) { closeTenantDetails(); openActionModal(action); }
  });
  $('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#refreshButton').addEventListener('click', () => loadView(state.view).then(() => toast('Platform data refreshed.')).catch(handleError));
  $('#profileButton').addEventListener('click', () => window.location.assign('/account'));
  $('[data-refresh-health]').addEventListener('click', () => loadHealth().then(() => toast('Health check completed.')).catch(handleError));
  $('#tenantSearch').addEventListener('input', () => { clearTimeout(loadTenants.timer); loadTenants.timer = setTimeout(() => loadTenants().catch(handleError), 220); });
  $('#tenantStatusFilter').addEventListener('change', () => loadTenants().catch(handleError));
  $('#securityTenantSelect').addEventListener('change', () => loadSecurity().catch(handleError));
  $('#auditTenantSelect').addEventListener('change', () => loadAudit().catch(handleError));
  $('#auditCategory').addEventListener('change', () => loadAudit().catch(handleError));
  $('#exportAuditButton').addEventListener('click', exportAudit);
  $('#globalSearch').addEventListener('keydown', (event) => { if (event.key === 'Enter') { $('#tenantSearch').value = event.target.value; showView('tenants'); } });
  $('#logoutButton').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); window.location.replace('/login'); });

  ['adminPassword', 'adminPasswordConfirm'].forEach((fieldName) => {
    const input = $(`#createTenantForm input[name="${fieldName}"]`);
    if (!input) return;
    const control = document.createElement('div');
    control.className = 'password-control';
    input.parentNode.insertBefore(control, input);
    control.appendChild(input);

    const button = document.createElement('button');
    button.className = 'password-toggle';
    button.type = 'button';
    button.dataset.passwordToggle = fieldName;
    button.setAttribute('aria-label', `Show ${fieldName === 'adminPasswordConfirm' ? 'confirmation' : 'login'} password`);
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle><path class="password-toggle-slash" d="M4 4l16 16"></path></svg>';
    control.appendChild(button);

    button.addEventListener('click', () => {
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.classList.toggle('is-visible', showPassword);
      button.setAttribute('aria-pressed', String(showPassword));
      button.setAttribute('aria-label', `${showPassword ? 'Hide' : 'Show'} ${fieldName === 'adminPasswordConfirm' ? 'confirmation' : 'login'} password`);
    });
  });

  $('#tenantRows').addEventListener('click', async (event) => {
    const view = event.target.closest('[data-view-tenant]');
    if (view) return openTenantDetails(view.dataset.viewTenant);
    const lifecycle = event.target.closest('[data-lifecycle]');
    if (lifecycle) return openActionModal(lifecycle);
  });
  $('#sessionRows').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-revoke-session]');
    if (!button) return;
    setBusy(button, true);
    try { await api(`/api/platform/sessions/${encodeURIComponent(button.dataset.revokeSession)}`, { method: 'DELETE', body: JSON.stringify({ reason: 'Revoked from Platform Security Center' }) }); toast('Session revoked.'); await loadSecurity(); }
    catch (error) { handleError(error); } finally { setBusy(button, false); }
  });
  $('#createTenantForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    setBusy(button, true, 'Creating tenant…');
    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData);
      payload.enabledModules = formData.getAll('enabledModules');
      if (!payload.enabledModules.length) throw new Error('Select at least one enabled system module');
      if (payload.adminPassword !== payload.adminPasswordConfirm) throw new Error('Tenant Admin passwords do not match');
      await api('/api/platform/tenants', { method: 'POST', body: JSON.stringify(payload) });
      form.reset(); state.companyTenants = []; closeCreateModal(); toast('Tenant created and activated. The administrator can sign in now.'); await Promise.all([loadOverview(), loadTenants()]);
    } catch (error) {
      if (error.data?.code === 'TENANT_REGISTRATION_EXISTS' && error.data.existingTenant?.id) {
        toast('This company already exists. Opening its tenant record.');
        state.companyTenants = [];
        await loadTenants();
        closeCreateModal();
        openTenantDetails(error.data.existingTenant.id);
      } else if (error.data?.code === 'TENANT_ADMIN_EMAIL_EXISTS' && error.data.existingOrganizationId) {
        toast('This administrator email is already connected to an existing tenant.');
        state.companyTenants = [];
        await loadTenants();
        closeCreateModal();
        openTenantDetails(error.data.existingOrganizationId);
      } else {
        handleError(error);
      }
    } finally { setBusy(button, false); }
  });
  $('#actionForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const { tenantId, status, reason } = event.currentTarget.elements;
    const button = event.submitter;
    setBusy(button, true);
    try {
      if (status.value === 'deleted') {
        await api(`/api/platform/tenants/${encodeURIComponent(tenantId.value)}`, { method: 'DELETE', body: JSON.stringify({ reason: reason.value }) });
        toast('Tenant permanently deleted.');
      } else {
        await api(`/api/platform/tenants/${encodeURIComponent(tenantId.value)}/status`, { method: 'PATCH', body: JSON.stringify({ status: status.value, reason: reason.value }) });
        toast(`Tenant status changed to ${status.value}.`);
      }
      state.companyTenants = [];
      closeActionModal();
      await Promise.all([loadTenants(), loadOverview()]);
    }
    catch (error) { handleError(error); } finally { setBusy(button, false); }
  });
  $('#settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    ['passwordMinLength', 'sessionTimeoutMinutes', 'retentionDays', 'maxUploadMb'].forEach((key) => { payload[key] = Number(payload[key]); });
    payload.requireMfa = form.elements.requireMfa.checked;
    payload.reason = 'Reviewed from Platform Configuration';
    setBusy(event.submitter, true);
    try { await api('/api/platform/settings', { method: 'PATCH', body: JSON.stringify(payload) }); toast('Platform settings saved and audit-logged.'); }
    catch (error) { handleError(error); } finally { setBusy(event.submitter, false); }
  });

  function init() {
    if (!state.session?.token || !roles(state.session.user).includes('superadmin')) return window.location.replace('/login');
    const user = state.session.user;
    $('#profileName').textContent = user.fullName || 'Superadmin';
    $('#profileAvatar').textContent = initials(user.fullName);
    $('#welcomeName').textContent = String(user.fullName || 'Superadmin').split(' ')[0];
    $('#dayPeriod').textContent = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';
    Promise.all([loadOverview(), loadHealth()]).catch(handleError);
  }
  init();
});
