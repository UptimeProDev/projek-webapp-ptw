document.addEventListener('DOMContentLoaded', () => {
  const SESSION_KEY = 'ptwSession';
  const roleLabels = { requester: 'Requester', admin: 'Admin', safety_officer: 'Safety Officer', supervisor: 'Supervisor', worker: 'Worker' };
  const roleOrder = Object.keys(roleLabels);
  const workerPermitTypes = ['Hot Work', 'Confined Space', 'Electrical Isolation', 'Work at Height', 'Line Breaking', 'Chemical Handling'];
  const state = { session: readSession(), view: 'overview', overview: null, profile: null, users: [], sites: [], workers: [], audit: [], settings: null, assignableRoles: roleOrder, notifications: [] };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function readSession() { const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY); try { return raw ? JSON.parse(raw) : null; } catch { return null; } }
  function writeSession(session) { (localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session)); state.session = session; }
  function clearSession() { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); }
  function roles(user) { return [...new Set([...(Array.isArray(user?.roles) ? user.roles : []), user?.role].filter(Boolean))]; }
  function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
  function titleCase(value) { return String(value || '').replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
  function initials(value) { return String(value || 'OA').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase(); }
  function formatDate(value, time = true) { if (!value) return 'Not recorded'; const date = new Date(value); if (Number.isNaN(date.getTime())) return String(value); return new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(date); }
  function relativeTime(value) { const diff = Date.now() - new Date(value).getTime(); if (!Number.isFinite(diff)) return ''; const mins = Math.max(0, Math.floor(diff / 60000)); if (mins < 1) return 'Just now'; if (mins < 60) return `${mins}m ago`; if (mins < 1440) return `${Math.floor(mins / 60)}h ago`; return `${Math.floor(mins / 1440)}d ago`; }
  function setBusy(button, busy, label = 'Saving…') { if (!button) return; if (busy) { button.dataset.label = button.textContent; button.textContent = label; } else if (button.dataset.label) { button.textContent = button.dataset.label; delete button.dataset.label; } button.disabled = busy; }
  function status(message, type = '') { const el = $('#sectionStatus'); el.textContent = message; el.className = `org-status ${type}`; el.hidden = false; clearTimeout(status.timer); status.timer = setTimeout(() => { el.hidden = true; }, type === 'error' ? 7000 : 4200); }
  async function api(path, options = {}) { const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', Authorization: `Bearer ${state.session?.token || ''}`, ...(options.headers || {}) } }); const text = await response.text(); const data = text ? JSON.parse(text) : {}; if (!response.ok) { const error = new Error(data.error || 'Request failed'); error.status = response.status; error.data = data; throw error; } return data; }
  function handleError(error) { if (error.status === 401) { clearSession(); window.location.replace('/login'); return; } status(error.message || 'Unable to complete this action.', 'error'); }

  function showView(view) {
    state.view = view;
    $$('.org-view').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === view));
    $$('.org-nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    $('#topbarTitle').textContent = ({ overview: 'Overview', profile: 'Company Profile', users: 'User Management', sites: 'Sites & Locations', workers: 'Workers & Contractors', settings: 'Company Settings', audit: 'Audit Logs' })[view];
    $('#searchInput').value = '';
    $('#searchInput').placeholder = view === 'users' ? 'Search team members or roles…' : view === 'sites' ? 'Search sites or work areas…' : view === 'workers' ? 'Search workers or contractors…' : view === 'audit' ? 'Search audit events…' : 'Search organization workspace…';
    $('#orgSidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadView(view).catch(handleError);
  }
  async function loadView(view) { if (view === 'overview') return loadOverview(); if (view === 'profile') return loadProfile(); if (view === 'users') return loadUsers(); if (view === 'sites') return loadSites(); if (view === 'workers') return loadWorkers(); if (view === 'settings') return loadSettings(); if (view === 'audit') return loadAudit(); }

  function updateIdentity(organization) {
    if (!organization) return;
    $('#topbarTenant').textContent = organization.name;
    $('#organizationName').textContent = organization.name;
    $('#registrationNo').textContent = organization.registrationNo;
    $('#organizationStatus').textContent = organization.status;
    $('#organizationStatus').className = `org-badge ${organization.status}`;
    $('#companyProfileMark').textContent = initials(organization.name);
    $('#companyProfileName').textContent = organization.name;
    $('#companyProfileContact').textContent = [organization.primaryContactName, organization.contactEmail].filter(Boolean).join(' · ') || 'Company contact information';
    $('#companyProfileStatus').textContent = titleCase(organization.status);
    $('#companyProfileStatus').className = `status-chip ${organization.status}`;
    $('#companyProfileTier').textContent = `${titleCase(organization.serviceTier)} tier`;
    $('#companyProfileRegistration').textContent = organization.registrationNo || '-';
    $('#companyProfileAdmin').textContent = state.session?.user?.fullName || state.session?.user?.email || '-';
    $('#companyProfileModules').textContent = (organization.enabledModules || []).length ? organization.enabledModules.map(titleCase).join(', ') : 'No modules configured';
  }
  async function loadOverview() {
    const data = await api('/api/organization/overview'); state.overview = data; state.profile = data.organization; updateIdentity(data.organization);
    const m = data.metrics;
    $('#metricUsers').textContent = m.users; $('#metricActiveUsers').textContent = m.activeUsers;
    $('#metricWorkers').textContent = m.workers; $('#metricActiveWorkers').textContent = m.activeWorkers;
    $('#metricPermits').textContent = m.permits; $('#metricActivePermits').textContent = m.activePermits;
    $('#metricSites').textContent = m.sites; $('#metricActiveSites').textContent = m.activeSites;
    $('#recentActivity').innerHTML = data.recentActivity.length ? data.recentActivity.map((item) => `<div class="activity-row"><span>${item.category === 'configuration' ? '⚙' : item.category === 'security' ? '◇' : '•'}</span><div><strong>${escapeHtml(titleCase(item.action))}</strong><small>${escapeHtml(item.actor_name)}${item.reason ? ` · ${escapeHtml(item.reason)}` : ''}</small></div><time>${relativeTime(item.occurred_at)}</time></div>`).join('') : '<div class="empty-panel">No company administration activity has been recorded yet.</div>';
  }
  async function loadProfile() {
    const data = await api('/api/organization/profile'); state.profile = data.organization; updateIdentity(data.organization);
    const form = $('#companyProfileForm'); ['name', 'registrationNo', 'contactEmail', 'contactNumber', 'primaryContactName', 'serviceTier', 'registeredAddress'].forEach((key) => { form.elements[key].value = data.organization[key] || ''; });
  }

  function userRoles(user) { return roles(user).filter((role) => role !== 'organization_admin'); }
  function renderRoleOptions(container, selected = [], name = 'roles') { const chosen = new Set(selected); container.innerHTML = state.assignableRoles.map((role) => `<label class="org-role-option"><input type="checkbox" name="${name}" value="${role}" ${chosen.has(role) ? 'checked' : ''}><span>${escapeHtml(roleLabels[role] || titleCase(role))}</span></label>`).join(''); }
  async function loadUsers() { const data = await api('/api/users'); state.users = data.users || []; state.assignableRoles = data.assignableRoles || roleOrder; renderRoleOptions($('#newUserRoles')); renderUsers(); }
  function renderUsers(query = '') { const q = query.toLowerCase(); const users = state.users.filter((u) => !q || [u.fullName, u.email, u.employeeId, ...userRoles(u)].join(' ').toLowerCase().includes(q)); $('#userCount').textContent = `${users.length} user${users.length === 1 ? '' : 's'}`; $('#userList').innerHTML = users.length ? users.map((u) => `<article class="org-user-card"><div class="org-user-person"><span class="org-avatar">${escapeHtml(initials(u.fullName))}</span><div class="org-user-details"><strong>${escapeHtml(u.fullName)}</strong><span>${escapeHtml(u.email)}</span><small>${escapeHtml(u.employeeId || 'Employee ID pending')} · ${escapeHtml(titleCase(u.accountStatus || 'active'))}</small></div></div><div class="org-user-current"><span>Operational access</span><div class="org-role-badges">${userRoles(u).map((role) => `<span class="org-role-badge">${escapeHtml(roleLabels[role] || titleCase(role))}</span>`).join('')}</div></div><button class="org-icon-button org-edit-button" type="button" data-edit-user="${u.id}" aria-label="Edit ${escapeHtml(u.fullName)}">✎</button></article>`).join('') : '<div class="empty-panel">No team members match this search.</div>'; }

  async function loadSites() { const data = await api('/api/organization/sites'); state.sites = data.sites || []; renderSites(); }
  function renderSites(query = '') { const q = query.toLowerCase(); const sites = state.sites.filter((s) => !q || [s.name, s.code, s.address, ...(s.workAreas || [])].join(' ').toLowerCase().includes(q)); $('#siteCount').textContent = `${sites.length} site${sites.length === 1 ? '' : 's'}`; $('#siteList').innerHTML = sites.length ? sites.map((site) => `<article class="site-card"><div class="site-head"><div><h3>${escapeHtml(site.name)}</h3><p>${escapeHtml(site.code)}</p></div><span class="status-chip ${escapeHtml(site.status)}">${escapeHtml(site.status)}</span></div><p class="site-address">${escapeHtml(site.address)}</p><div class="work-area-list">${(site.workAreas || []).length ? site.workAreas.map((area) => `<span>${escapeHtml(area)}</span>`).join('') : '<span>No work areas yet</span>'}</div><div class="site-actions"><button data-edit-site="${site.id}">Edit</button><button class="warning" data-toggle-site="${site.id}" data-status="${site.status === 'active' ? 'inactive' : 'active'}">${site.status === 'active' ? 'Deactivate' : 'Activate'}</button></div></article>`).join('') : '<div class="org-panel empty-panel">No sites have been configured.</div>'; }
  function resetSiteForm() { const form = $('#siteForm'); form.reset(); form.elements.siteId.value = ''; $('#siteFormTitle').textContent = 'Add site'; $('#saveSiteButton').textContent = 'Add site'; $('#cancelSiteEdit').hidden = true; }

  function availableWorkerAccounts() {
    const profileEmails = new Set(state.workers.map((worker) => String(worker.email || '').toLowerCase()));
    return state.users.filter((user) =>
      userRoles(user).includes('worker')
      && user.accountStatus !== 'inactive'
      && !profileEmails.has(String(user.email || '').toLowerCase()),
    );
  }
  function renderWorkerAccountOptions() {
    const accounts = availableWorkerAccounts();
    const select = $('#workerAccount');
    select.innerHTML = accounts.length
      ? `<option value="">Select a worker account</option>${accounts.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.fullName)} — ${escapeHtml(user.employeeId || user.email)}</option>`).join('')}`
      : '<option value="">No unlinked worker accounts available</option>';
    select.disabled = !accounts.length;
    $('#saveWorkerButton').disabled = !accounts.length;
    $('#workerAccountHelp').textContent = accounts.length
      ? 'The worker name, email, employee ID, and company come from the selected user account.'
      : 'Create a company user with Worker access first, then return here to add the worker profile.';
    updateWorkerAccountPreview();
  }
  function renderWorkerPermitOptions() {
    $('#workerPermitTypes').innerHTML = workerPermitTypes.map((permitType) => `<label class="org-role-option"><input type="checkbox" name="permits" value="${escapeHtml(permitType)}"><span>${escapeHtml(permitType)}</span></label>`).join('');
  }
  function updateWorkerAccountPreview() {
    const account = state.users.find((user) => user.id === $('#workerAccount').value);
    const preview = $('#workerAccountPreview');
    preview.hidden = !account;
    preview.innerHTML = account
      ? `<strong>${escapeHtml(account.fullName)}</strong><span>${escapeHtml(account.employeeId || 'Employee ID pending')}</span><span>${escapeHtml(account.email)}</span><span>${escapeHtml(account.organization || state.profile?.name || '')}</span>`
      : '';
  }
  function openWorkerModal() {
    $('#addWorkerForm').reset();
    renderWorkerPermitOptions();
    renderWorkerAccountOptions();
    $('#addWorkerModal').hidden = false;
    $('#workerAccount').focus();
  }
  function closeWorkerModal() {
    $('#addWorkerModal').hidden = true;
    $('#addWorkerForm').reset();
    $('#workerAccountPreview').hidden = true;
  }
  async function loadWorkers() {
    const [workerData, userData] = await Promise.all([
      api('/api/workers'),
      state.users.length ? Promise.resolve({ users: state.users }) : api('/api/users'),
    ]);
    state.workers = workerData.workers || [];
    state.users = userData.users || state.users;
    renderWorkers();
  }
  function renderWorkers(query = '') { const q = query.toLowerCase(); const workers = state.workers.filter((w) => !q || [w.name, w.email, w.employeeId, w.role, w.trade, w.company, ...(w.permits || [])].join(' ').toLowerCase().includes(q)); $('#workerCount').textContent = `${workers.length} worker${workers.length === 1 ? '' : 's'}`; $('#workerRows').innerHTML = workers.length ? workers.map((w) => `<tr><td><strong>${escapeHtml(w.name || w.fullName)}</strong><small>${escapeHtml(w.email || 'No email')}</small></td><td>${escapeHtml(w.employeeId || '-')}</td><td>${escapeHtml(w.role || w.trade || '-')}</td><td><div class="org-role-badges">${(w.permits || []).length ? w.permits.map((permitType) => `<span class="org-role-badge">${escapeHtml(permitType)}</span>`).join('') : '<span class="org-role-badge">Not assigned</span>'}</div></td><td>${escapeHtml(w.company || w.organization || '-')}</td><td>${formatDate(w.expiry || w.licenseExpiry, false)}</td><td><span class="status-chip ${escapeHtml(w.status)}">${escapeHtml(w.status)}</span></td><td><div class="table-actions"><button data-worker-status="${w.status === 'inactive' ? 'valid' : 'inactive'}" data-worker="${w.id}" data-name="${escapeHtml(w.name || w.fullName)}">${w.status === 'inactive' ? 'Activate' : 'Deactivate'}</button></div></td></tr>`).join('') : '<tr><td colspan="8"><div class="empty-panel">No worker profiles are available for this organization.</div></td></tr>'; }

  async function loadSettings() { const data = await api('/api/organization/settings'); state.settings = data.settings; const form = $('#companySettingsForm'); Object.entries(data.settings).forEach(([key, value]) => { const input = form.elements[key]; if (!input) return; if (input.type === 'checkbox') input.checked = Boolean(value); else input.value = value ?? ''; }); $('#enabledModules').innerHTML = (data.enabledModules || []).length ? data.enabledModules.map((module) => `<span class="module-chip">${escapeHtml(titleCase(module))}</span>`).join('') : '<span class="module-chip">No modules configured</span>'; }
  async function loadAudit() { const category = encodeURIComponent($('#auditCategory').value); const data = await api(`/api/organization/audit?category=${category}`); state.audit = data.logs || []; renderAudit(); }
  function renderAudit(query = '') { const q = query.toLowerCase(); const logs = state.audit.filter((log) => !q || [log.action, log.actor_name, log.actor_role, log.category, log.reason, log.result].join(' ').toLowerCase().includes(q)); $('#auditCount').textContent = `${logs.length} record${logs.length === 1 ? '' : 's'}`; $('#auditRows').innerHTML = logs.length ? logs.map((log) => `<tr><td class="audit-event-copy"><strong>${escapeHtml(titleCase(log.action))}</strong><small>${escapeHtml(log.reason || log.target_type || '')}</small></td><td>${escapeHtml(log.actor_name)}<small>${escapeHtml(titleCase(log.actor_role))}</small></td><td>${escapeHtml(titleCase(log.category))}</td><td><span class="status-chip ${log.result === 'success' ? 'active' : 'inactive'}">${escapeHtml(log.result)}</span></td><td>${formatDate(log.occurred_at)}</td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-panel">No audit records match this selection.</div></td></tr>'; }

  async function loadNotifications() { try { const data = await api('/api/notifications?limit=20'); state.notifications = data.notifications || data.data || []; } catch { state.notifications = []; } renderNotifications(); }
  function renderNotifications() { const unread = state.notifications.filter((n) => n.unread).length; $('#notificationCount').textContent = unread ? `${unread} unread` : `${state.notifications.length} items`; $('#notificationDot').hidden = !unread; $('#notificationReadAllButton').disabled = !unread; $('#notificationList').innerHTML = state.notifications.length ? state.notifications.map((n) => `<button class="notification-item${n.unread ? ' unread' : ''}" type="button" data-notification-id="${escapeHtml(n.id)}" data-link="${escapeHtml(n.link || '')}"><small>${escapeHtml(titleCase(n.type))}</small><strong>${escapeHtml(n.title)}</strong><span>${escapeHtml(n.message || '')}</span></button>`).join('') : '<p class="notification-empty">No notifications yet.</p>'; }
  function setNotifications(open) { $('#notificationPanel').hidden = !open; $('#notificationButton').setAttribute('aria-expanded', open ? 'true' : 'false'); }

  function openEditUser(id) { const user = state.users.find((u) => u.id === id); if (!user) return; $('#editUserId').value = id; $('#editUserFullName').value = user.fullName || ''; $('#editUserEmail').value = user.email || ''; $('#editUserMeta').textContent = user.employeeId || 'Team member access'; renderRoleOptions($('#editUserRoles'), userRoles(user), 'editRoles'); $('#removeAccessButton').textContent = user.accountStatus === 'inactive' ? 'Activate' : 'Deactivate'; $('#editUserModal').hidden = false; }
  function closeEditUser() { $('#editUserModal').hidden = true; $('#editUserForm').reset(); }
  function exportAudit() { const fields = ['occurred_at', 'actor_name', 'actor_role', 'category', 'action', 'target_type', 'target_id', 'reason', 'result']; const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`; const csv = [fields.join(','), ...state.audit.map((row) => fields.map((field) => quote(row[field])).join(','))].join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `company-audit-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href); status('Audit export prepared.', 'success'); }

  $$('.org-nav-item').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  $$('[data-go-view]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.auditCategory) $('#auditCategory').value = button.dataset.auditCategory;
    showView(button.dataset.goView);
  }));
  $('#sidebarTrigger').addEventListener('click', () => $('#orgSidebar').classList.toggle('open'));
  $('#refreshButton').addEventListener('click', (event) => { setBusy(event.currentTarget, true, '↻'); loadView(state.view).then(() => status('Workspace refreshed.', 'success')).catch(handleError).finally(() => setBusy(event.currentTarget, false)); });
  $('#searchInput').addEventListener('input', (event) => { const q = event.target.value; if (state.view === 'users') renderUsers(q); if (state.view === 'sites') renderSites(q); if (state.view === 'workers') renderWorkers(q); if (state.view === 'audit') renderAudit(q); });

  $('#companyProfileForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const button = event.submitter; setBusy(button, true); try { const data = await api('/api/organization/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); state.profile = data.organization; updateIdentity(data.organization); state.session.user.organization = data.organization.name; writeSession(state.session); status('Company profile saved.', 'success'); } catch (error) { handleError(error); } finally { setBusy(button, false); } });
  $('#createUserForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); data.roles = new FormData(form).getAll('roles'); if (!data.roles.length) return status('Select at least one operational role.', 'error'); if (data.password !== data.confirmPassword) return status('Passwords do not match.', 'error'); const button = event.submitter; setBusy(button, true, 'Creating…'); try { const result = await api('/api/users', { method: 'POST', body: JSON.stringify(data) }); state.users.push(result.user); state.users.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName))); form.reset(); renderRoleOptions($('#newUserRoles')); renderUsers(); status(`${result.user.fullName} can now sign in.`, 'success'); } catch (error) { handleError(error); } finally { setBusy(button, false); } });
  $('#createUserForm').addEventListener('reset', () => setTimeout(() => renderRoleOptions($('#newUserRoles')), 0));
  $('#userList').addEventListener('click', (event) => { const button = event.target.closest('[data-edit-user]'); if (button) openEditUser(button.dataset.editUser); });
  $('#editUserForm').addEventListener('submit', async (event) => { event.preventDefault(); const id = $('#editUserId').value; const selectedRoles = $$('input[name="editRoles"]:checked', event.currentTarget).map((input) => input.value); if (!selectedRoles.length) return status('Select at least one role.', 'error'); const button = event.submitter; setBusy(button, true); try { const result = await api(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ fullName: $('#editUserFullName').value.trim(), email: $('#editUserEmail').value.trim(), roles: selectedRoles }) }); state.users = state.users.map((u) => u.id === id ? result.user : u); closeEditUser(); renderUsers(); status('User account updated.', 'success'); } catch (error) { handleError(error); } finally { setBusy(button, false); } });
  $('#removeAccessButton').addEventListener('click', async (event) => { const id = $('#editUserId').value; const user = state.users.find((u) => u.id === id); if (!user) return; const next = user.accountStatus === 'inactive' ? 'active' : 'inactive'; if (!confirm(`${next === 'inactive' ? 'Deactivate' : 'Activate'} access for ${user.fullName}?`)) return; setBusy(event.currentTarget, true); try { const result = await api(`/api/users/${encodeURIComponent(id)}/access`, { method: 'PATCH', body: JSON.stringify({ status: next }) }); state.users = state.users.map((u) => u.id === id ? result.user : u); closeEditUser(); renderUsers(); status(`User access ${next === 'active' ? 'activated' : 'deactivated'}.`, 'success'); } catch (error) { handleError(error); } finally { setBusy(event.currentTarget, false); } });
  $('#deleteUserButton').addEventListener('click', async (event) => { const id = $('#editUserId').value; const user = state.users.find((u) => u.id === id); if (!user || !confirm(`Delete ${user.fullName}? This is allowed only when no workflow history exists.`)) return; setBusy(event.currentTarget, true); try { await api(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }); state.users = state.users.filter((u) => u.id !== id); closeEditUser(); renderUsers(); status('Unused user account deleted.', 'success'); } catch (error) { handleError(error); } finally { setBusy(event.currentTarget, false); } });
  $('#closeEditModal').addEventListener('click', closeEditUser); $('#cancelEditModal').addEventListener('click', closeEditUser); $('#editUserModal').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeEditUser(); });

  $('#siteForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const payload = Object.fromEntries(new FormData(form)); payload.workAreas = String(payload.workAreas || '').split(/\r?\n|,/).map((v) => v.trim()).filter(Boolean); const id = payload.siteId; delete payload.siteId; const button = event.submitter; setBusy(button, true); try { if (id) await api(`/api/organization/sites/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }); else await api('/api/organization/sites', { method: 'POST', body: JSON.stringify(payload) }); resetSiteForm(); await loadSites(); status(id ? 'Site updated.' : 'Site added.', 'success'); } catch (error) { handleError(error); } finally { setBusy(button, false); } });
  $('#siteList').addEventListener('click', async (event) => { const edit = event.target.closest('[data-edit-site]'); if (edit) { const site = state.sites.find((s) => s.id === edit.dataset.editSite); if (!site) return; const form = $('#siteForm'); form.elements.siteId.value = site.id; form.elements.name.value = site.name; form.elements.code.value = site.code; form.elements.address.value = site.address; form.elements.workAreas.value = (site.workAreas || []).join('\n'); $('#siteFormTitle').textContent = 'Edit site'; $('#saveSiteButton').textContent = 'Save site'; $('#cancelSiteEdit').hidden = false; form.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } const toggle = event.target.closest('[data-toggle-site]'); if (!toggle) return; const site = state.sites.find((s) => s.id === toggle.dataset.toggleSite); if (!site || !confirm(`${toggle.dataset.status === 'active' ? 'Activate' : 'Deactivate'} ${site.name}?`)) return; setBusy(toggle, true); try { await api(`/api/organization/sites/${encodeURIComponent(site.id)}`, { method: 'PATCH', body: JSON.stringify({ status: toggle.dataset.status, reason: 'Site lifecycle updated by Tenant Admin' }) }); await loadSites(); status('Site status updated.', 'success'); } catch (error) { handleError(error); } finally { setBusy(toggle, false); } });
  $('#cancelSiteEdit').addEventListener('click', resetSiteForm);
  $('#addWorkerButton').addEventListener('click', openWorkerModal);
  $('#workerAccount').addEventListener('change', updateWorkerAccountPreview);
  $('#closeWorkerModal').addEventListener('click', closeWorkerModal);
  $('#cancelWorkerModal').addEventListener('click', closeWorkerModal);
  $('#addWorkerModal').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeWorkerModal(); });
  $('#addWorkerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const account = state.users.find((user) => user.id === form.elements.workerAccount.value);
    const permits = new FormData(form).getAll('permits');
    if (!account) return status('Select a registered worker account.', 'error');
    if (!permits.length) return status('Select at least one approved type of work.', 'error');
    const button = event.submitter;
    setBusy(button, true, 'Addingâ€¦');
    try {
      await api('/api/workers', {
        method: 'POST',
        body: JSON.stringify({
          name: account.fullName,
          email: account.email,
          company: account.organization || state.profile?.name || '',
          icPassport: form.elements.icPassport.value.trim(),
          phone: form.elements.phone.value.trim(),
          role: form.elements.role.value.trim(),
          expiry: form.elements.expiry.value,
          permits,
          status: 'valid',
        }),
      });
      closeWorkerModal();
      await loadWorkers();
      status(`${account.fullName} was added and is available for matching permit assignments.`, 'success');
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(button, false);
    }
  });
  $('#workerRows').addEventListener('click', async (event) => { const button = event.target.closest('[data-worker-status]'); if (!button || !confirm(`${button.dataset.workerStatus === 'valid' ? 'Activate' : 'Deactivate'} ${button.dataset.name}?`)) return; setBusy(button, true); try { await api(`/api/organization/workers/${encodeURIComponent(button.dataset.worker)}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.workerStatus, reason: 'Worker access reviewed by Organization Admin' }) }); await loadWorkers(); status('Worker access updated.', 'success'); } catch (error) { handleError(error); } finally { setBusy(button, false); } });
  $('#companySettingsForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const payload = Object.fromEntries(new FormData(form)); ['requireSiteSelection', 'emailNotifications', 'allowEmergencyPermits'].forEach((key) => { payload[key] = form.elements[key].checked; }); const button = event.submitter; setBusy(button, true); try { const result = await api('/api/organization/settings', { method: 'PATCH', body: JSON.stringify(payload) }); state.settings = result.settings; status('Company settings saved.', 'success'); } catch (error) { handleError(error); } finally { setBusy(button, false); } });
  $('#auditCategory').addEventListener('change', () => loadAudit().catch(handleError)); $('#exportAuditButton').addEventListener('click', exportAudit);
  $('#notificationButton').addEventListener('click', () => setNotifications($('#notificationPanel').hidden)); $('#notificationCloseButton').addEventListener('click', () => setNotifications(false)); $('#notificationReadAllButton').addEventListener('click', async () => { try { await api('/api/notifications/read-all', { method: 'PATCH' }); state.notifications = state.notifications.map((n) => ({ ...n, unread: false })); renderNotifications(); } catch {} });
  $('#notificationList').addEventListener('click', (event) => { const button = event.target.closest('[data-notification-id]'); if (!button) return; api(`/api/notifications/${encodeURIComponent(button.dataset.notificationId)}/read`, { method: 'PATCH' }).catch(() => {}); const link = button.dataset.link; setNotifications(false); if (link) window.location.assign(link); });
  $('#profileButton').addEventListener('click', () => showView('profile')); $('#supportButton').addEventListener('click', () => window.location.assign('/support')); $('#logoutButton').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} clearSession(); window.location.replace('/login'); });

  async function init() {
    if (!state.session?.token || !roles(state.session.user).includes('organization_admin')) return window.location.replace('/login');
    const user = state.session.user; $('#profileName').textContent = user.fullName || 'Organization Admin'; $('#profileAvatar').textContent = initials(user.fullName); $('#ownerName').textContent = user.fullName || user.email; $('#topbarTenant').textContent = user.organization || 'Organization workspace';
    await Promise.all([loadOverview(), loadNotifications()]);
  }
  init().catch(handleError);
});
