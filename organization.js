document.addEventListener('DOMContentLoaded', () => {
  const SESSION_KEY = 'ptwSession';
  const roleLabels = {
    requester: 'Requester',
    admin: 'Admin',
    safety_officer: 'Safety Officer',
    supervisor: 'Supervisor',
    worker: 'Worker',
  };
  const roleOrder = ['requester', 'admin', 'safety_officer', 'supervisor', 'worker'];

  const elements = {
    profileName: document.querySelector('#profileName'),
    profileRole: document.querySelector('#profileRole'),
    profileAvatar: document.querySelector('#profileAvatar'),
    userCount: document.querySelector('#userCount'),
    sectionStatus: document.querySelector('#sectionStatus'),
    organizationName: document.querySelector('#organizationName'),
    registrationNo: document.querySelector('#registrationNo'),
    ownerName: document.querySelector('#ownerName'),
    createUserForm: document.querySelector('#createUserForm'),
    newUserFullName: document.querySelector('#newUserFullName'),
    newUserEmail: document.querySelector('#newUserEmail'),
    newUserRoles: document.querySelector('#newUserRoles'),
    userList: document.querySelector('#userList'),
    editUserModal: document.querySelector('#editUserModal'),
    editUserForm: document.querySelector('#editUserForm'),
    editUserId: document.querySelector('#editUserId'),
    editUserFullName: document.querySelector('#editUserFullName'),
    editUserEmail: document.querySelector('#editUserEmail'),
    editUserRoles: document.querySelector('#editUserRoles'),
    editUserMeta: document.querySelector('#editUserMeta'),
    removeAccessButton: document.querySelector('#removeAccessButton'),
    deleteUserButton: document.querySelector('#deleteUserButton'),
    closeEditModal: document.querySelector('#closeEditModal'),
    cancelEditModal: document.querySelector('#cancelEditModal'),
    supportButton: document.querySelector('#supportButton'),
    logoutButton: document.querySelector('#logoutButton'),
  };

  const state = {
    session: readSession(),
    users: [],
    assignableRoles: roleOrder,
    editingUserId: '',
  };

  function readSession() {
    const stored = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      clearSession();
      return null;
    }
  }

  function writeSession(session) {
    const storage = localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify(session));
    state.session = session;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getUserRoles(user) {
    const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
    return roles
      .map((role) => String(role || '').trim().toLowerCase())
      .map((role) => role === 'approver' ? 'supervisor' : role)
      .filter(Boolean)
      .filter((role, index, list) => list.indexOf(role) === index);
  }

  function hasRole(user, role) {
    return getUserRoles(user).includes(role);
  }

  function roleLabel(role) {
    return roleLabels[role] || String(role || 'User').replace(/_/g, ' ');
  }

  function roleSummary(user) {
    return getUserRoles(user)
      .filter((role) => role !== 'organization_admin')
      .map(roleLabel)
      .join(', ') || 'No operational role';
  }

  function initials(name) {
    return String(name || 'User')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'U';
  }

  function setStatus(message, type = '') {
    elements.sectionStatus.textContent = message;
    elements.sectionStatus.classList.toggle('success', type === 'success');
    elements.sectionStatus.classList.toggle('error', type === 'error');
  }

  function redirectToRoleHome(user) {
    const roles = getUserRoles(user);
    if (roles.includes('admin')) return window.location.replace('/admin');
    if (roles.includes('safety_officer')) return window.location.replace('/safety');
    if (roles.includes('supervisor')) return window.location.replace('/review');
    if (roles.includes('requester')) return window.location.replace('/dashboard');
    if (roles.includes('worker')) return window.location.replace('/worker');
    return window.location.replace('/login');
  }

  async function apiRequest(path, options = {}) {
    if (!state.session?.token) {
      throw { status: 401, error: 'Unauthorized' };
    }

    const response = await fetch(path, {
      ...options,
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${state.session.token}`,
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

  function updateProfile(user) {
    elements.profileName.textContent = user.fullName || user.email || 'Organization Admin';
    elements.profileRole.textContent = 'Organization Admin';
    elements.profileAvatar.textContent = initials(user.fullName || user.email);
    elements.organizationName.textContent = user.organization || '-';
    elements.registrationNo.textContent = user.companyRegistrationNo || '-';
    elements.ownerName.textContent = user.fullName || user.email || '-';
  }

  function renderRoleCheckboxes(container, selectedRoles = [], inputName = 'roles') {
    const selected = new Set(selectedRoles);
    container.innerHTML = state.assignableRoles
      .map((role) => `
        <label class="org-role-option">
          <input type="checkbox" name="${escapeHtml(inputName)}" value="${escapeHtml(role)}" ${selected.has(role) ? 'checked' : ''}>
          <span>${escapeHtml(roleLabel(role))}</span>
        </label>
      `)
      .join('');
  }

  function renderRoleOptions() {
    renderRoleCheckboxes(elements.newUserRoles, ['requester'], 'roles');
  }

  function renderUsers(query = '') {
    const lowerQuery = query.trim().toLowerCase();
    const users = state.users.filter((user) => {
      const searchable = [
        user.fullName,
        user.email,
        user.employeeId,
        user.organization,
        roleSummary(user),
      ].join(' ').toLowerCase();
      return !lowerQuery || searchable.includes(lowerQuery);
    });

    elements.userCount.textContent = `${users.length} user${users.length === 1 ? '' : 's'}`;

    if (!users.length) {
      elements.userList.innerHTML = `
        <div class="org-empty" role="status" aria-live="polite">
          <strong>No team members found</strong>
          <span>Create a user account above to assign PTW operational access.</span>
        </div>
      `;
      return;
    }

    elements.userList.innerHTML = users
      .map((user) => {
        const roles = getUserRoles(user);
        return `
          <article class="org-user-card" data-user-id="${escapeHtml(user.id)}">
            <div class="org-user-person">
              <span class="org-avatar">${escapeHtml(initials(user.fullName || user.email))}</span>
              <div class="org-user-details">
                <strong>${escapeHtml(user.fullName || 'Unnamed user')}</strong>
                <span>${escapeHtml(user.email || '-')}</span>
                <small>${escapeHtml([user.employeeId || 'Employee ID pending', accessStatusLabel(user)].filter(Boolean).join(' - '))}</small>
              </div>
            </div>
            <div class="org-user-current">
              <span>Operational access</span>
              <div class="org-role-badges">
                ${roles
                  .filter((role) => role !== 'organization_admin')
                  .map((role) => `<span class="org-role-badge">${escapeHtml(roleLabel(role))}</span>`)
                  .join('') || '<span class="org-role-badge muted">No role</span>'}
              </div>
            </div>
            <button class="org-icon-button org-edit-button" type="button" data-edit-user="${escapeHtml(user.id)}" title="Edit user" aria-label="Edit ${escapeHtml(user.fullName || user.email || 'user')}">
              <span aria-hidden="true">&#9998;</span>
            </button>
          </article>
        `;
      })
      .join('');
  }

  async function loadData() {
    const [meResult, userResult] = await Promise.all([
      apiRequest('/api/auth/me'),
      apiRequest('/api/users'),
    ]);
    state.assignableRoles = userResult.assignableRoles || roleOrder;
    state.users = userResult.users || userResult.data || [];
    writeSession({ ...state.session, user: meResult.user });
    updateProfile(meResult.user);
    renderRoleOptions();
    renderUsers();
    setStatus('Organization workspace ready.', 'success');
  }

  async function createUser(event) {
    event.preventDefault();
    const roles = Array.from(elements.newUserRoles.querySelectorAll('input[name="roles"]:checked'))
      .map((input) => input.value)
      .filter(Boolean);

    if (!roles.length) {
      setStatus('Select at least one operational role.', 'error');
      return;
    }

    const submitButton = elements.createUserForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const result = await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: elements.newUserFullName.value.trim(),
          email: elements.newUserEmail.value.trim(),
          roles,
        }),
      });
      state.users = [...state.users, result.user].sort((a, b) =>
        String(a.fullName || '').localeCompare(String(b.fullName || '')),
      );
      elements.createUserForm.reset();
      renderRoleOptions();
      renderUsers();
      setStatus(`Created account for ${result.user?.fullName || 'new user'}. Default password is 12345678.`, 'success');
    } catch (error) {
      setStatus(error.error || 'Unable to create user account.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  }

  function accessStatusLabel(user) {
    const status = String(user?.accountStatus || 'active').toLowerCase();
    if (status === 'inactive') return 'Access Removed';
    return '';
  }

  function openEditModal(userId) {
    const user = state.users.find((item) => item.id === userId);
    if (!user) return;
    state.editingUserId = userId;
    elements.editUserId.value = userId;
    elements.editUserFullName.value = user.fullName || '';
    elements.editUserEmail.value = user.email || '';
    elements.editUserMeta.textContent = user.employeeId || 'Team member access';
    renderRoleCheckboxes(elements.editUserRoles, getUserRoles(user), 'editRoles');
    elements.removeAccessButton.textContent = user.accountStatus === 'inactive' ? 'Restore Access' : 'Remove Access';
    elements.editUserModal.hidden = false;
    document.body.classList.add('org-modal-open');
    elements.editUserFullName.focus();
  }

  function closeEditModal() {
    state.editingUserId = '';
    elements.editUserForm.reset();
    elements.editUserRoles.innerHTML = '';
    elements.editUserModal.hidden = true;
    document.body.classList.remove('org-modal-open');
  }

  async function saveUserChanges(event) {
    event.preventDefault();
    const userId = elements.editUserId.value;
    const fullName = elements.editUserFullName.value.trim();
    const email = elements.editUserEmail.value.trim();
    const roles = Array.from(elements.editUserRoles.querySelectorAll('input[name="editRoles"]:checked'))
      .map((input) => input.value)
      .filter(Boolean);

    if (!fullName || !email) {
      setStatus('Name and email are required for this user.', 'error');
      return;
    }

    if (!roles.length) {
      setStatus('Select at least one role for this user.', 'error');
      return;
    }

    const button = elements.editUserForm.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
      const result = await apiRequest(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ fullName, email, roles }),
      });
      state.users = state.users.map((user) => user.id === userId ? result.user : user);
      closeEditModal();
      renderUsers();
      setStatus(`Updated ${result.user?.fullName || 'user'}.`, 'success');
    } catch (error) {
      setStatus(error.error || 'Unable to update user.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function toggleUserAccess() {
    const userId = elements.editUserId.value;
    const user = state.users.find((item) => item.id === userId);
    if (!user) return;
    const nextStatus = user.accountStatus === 'inactive' ? 'active' : 'inactive';
    const action = nextStatus === 'inactive' ? 'remove access for' : 'restore access for';
    if (!window.confirm(`Are you sure you want to ${action} ${user.fullName || user.email}?`)) return;

    elements.removeAccessButton.disabled = true;
    try {
      const result = await apiRequest(`/api/users/${encodeURIComponent(userId)}/access`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      state.users = state.users.map((item) => item.id === userId ? result.user : item);
      closeEditModal();
      renderUsers();
      setStatus(
        nextStatus === 'inactive'
          ? `Removed access for ${result.user?.fullName || 'user'}.`
          : `Restored access for ${result.user?.fullName || 'user'}.`,
        'success',
      );
    } catch (error) {
      setStatus(error.error || 'Unable to update user access.', 'error');
    } finally {
      elements.removeAccessButton.disabled = false;
    }
  }

  async function deleteUser() {
    const userId = elements.editUserId.value;
    const user = state.users.find((item) => item.id === userId);
    if (!user) return;
    if (!window.confirm(`Delete ${user.fullName || user.email}? This cannot be undone.`)) return;

    elements.deleteUserButton.disabled = true;
    try {
      await apiRequest(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
      state.users = state.users.filter((item) => item.id !== userId);
      closeEditModal();
      renderUsers();
      setStatus(`Deleted ${user.fullName || 'user'}.`, 'success');
    } catch (error) {
      setStatus(error.error || 'Unable to delete user.', 'error');
    } finally {
      elements.deleteUserButton.disabled = false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function wireEvents() {
    elements.createUserForm.addEventListener('submit', createUser);
    elements.createUserForm.addEventListener('reset', () => {
      window.setTimeout(renderRoleOptions, 0);
    });
    elements.userList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-edit-user]');
      if (!button) return;
      openEditModal(button.dataset.editUser);
    });
    elements.editUserForm.addEventListener('submit', saveUserChanges);
    elements.removeAccessButton.addEventListener('click', toggleUserAccess);
    elements.deleteUserButton.addEventListener('click', deleteUser);
    elements.closeEditModal.addEventListener('click', closeEditModal);
    elements.cancelEditModal.addEventListener('click', closeEditModal);
    elements.editUserModal.addEventListener('click', (event) => {
      if (event.target === elements.editUserModal) closeEditModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.editUserModal.hidden) closeEditModal();
    });
    elements.supportButton.addEventListener('click', () => window.location.assign('/support'));
    elements.logoutButton.addEventListener('click', async () => {
      try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
      } catch {
        // Clear the local session even if the server token is already gone.
      } finally {
        clearSession();
        window.location.assign('/login');
      }
    });
  }

  async function init() {
    if (!state.session?.token) {
      window.location.replace('/login');
      return;
    }

    if (!hasRole(state.session.user, 'organization_admin')) {
      redirectToRoleHome(state.session.user);
      return;
    }

    wireEvents();
    await loadData();
  }

  init().catch((error) => {
    if (error.status === 401 || error.status === 403) {
      clearSession();
      window.location.replace('/login');
      return;
    }
    setStatus(error.error || error.message || 'Unable to load organization workspace.', 'error');
  });
});
