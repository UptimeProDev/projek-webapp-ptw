document.addEventListener('DOMContentLoaded', () => {
  const SESSION_KEY = 'ptwSession';
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

  const elements = {
    backLink: document.querySelector('#backLink'),
    logoutButton: document.querySelector('#logoutButton'),
    profilePicture: document.querySelector('#profilePicture'),
    profileName: document.querySelector('#profileName'),
    profileMeta: document.querySelector('#profileMeta'),
    pictureForm: document.querySelector('#pictureForm'),
    pictureInput: document.querySelector('#pictureInput'),
    addressForm: document.querySelector('#addressForm'),
    addressSummary: document.querySelector('#addressSummary'),
    addressSummaryLine1: document.querySelector('#addressSummaryLine1'),
    addressSummaryLine2: document.querySelector('#addressSummaryLine2'),
    rolePanel: document.querySelector('#rolePanel'),
    roleList: document.querySelector('#roleList'),
    passwordForm: document.querySelector('#passwordForm'),
    toast: document.querySelector('#toast'),
  };

  const roleHome = {
    requester: '/dashboard',
    admin: '/admin',
    supervisor: '/review',
    approver: '/approver',
    safety_officer: '/safety',
    worker: '/worker',
  };
  const rolePriority = ['admin', 'safety_officer', 'supervisor', 'requester', 'worker'];

  let session = readSession();
  let toastTimer;

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

  function writeSession(nextSession) {
    const storage = localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    session = nextSession;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function roleLabel(role) {
    return String(role || 'user')
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function getUserRoles(user) {
    const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
    return roles
      .map((role) => String(role || '').toLowerCase())
      .map((role) => role === 'approver' ? 'supervisor' : role)
      .filter(Boolean)
      .filter((role, index, list) => list.indexOf(role) === index)
      .sort((a, b) => {
        const aIndex = rolePriority.indexOf(a);
        const bIndex = rolePriority.indexOf(b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
  }

  function getPreferredRole(user) {
    const roles = getUserRoles(user);
    return ['admin', 'safety_officer', 'supervisor', 'requester', 'worker']
      .find((role) => roles.includes(role)) || user?.role;
  }

  function initials(name) {
    return String(name || 'U')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U';
  }

  function showToast(message, type = 'ok') {
    elements.toast.textContent = message;
    elements.toast.classList.toggle('error', type === 'error');
    elements.toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove('visible');
    }, 2800);
  }

  async function apiRequest(path, options = {}) {
    if (!session?.token) {
      window.location.replace('/login');
      throw new Error('Session required');
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.token}`,
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      if (response.status === 401 && path !== '/api/account/password') {
        clearSession();
        window.location.replace('/login');
      }
      throw { status: response.status, ...body };
    }

    return body;
  }

  function updateStoredUser(user) {
    if (!user) return;
    writeSession({ ...session, user });
    renderUser(user);
  }

  function renderUser(user) {
    const resolvedUser = user || session?.user || {};
    const roles = getUserRoles(resolvedUser);
    const home = roleHome[getPreferredRole(resolvedUser)] || '/dashboard';
    const name = resolvedUser.fullName || resolvedUser.email || 'User';
    elements.backLink.href = home;
    elements.profileName.textContent = name;
    elements.profileMeta.textContent = `${roles.map(roleLabel).join(', ') || roleLabel(resolvedUser.role)} - ${resolvedUser.employeeId || resolvedUser.email || 'PTW user'}`;

    if (resolvedUser.profilePictureUrl) {
      elements.profilePicture.innerHTML = `<img src="${resolvedUser.profilePictureUrl}" alt="">`;
    } else {
      elements.profilePicture.textContent = initials(name);
    }

    const address = resolvedUser.address || {};
    elements.addressForm.line1.value = address.line1 || '';
    elements.addressForm.line2.value = address.line2 || '';
    elements.addressForm.city.value = address.city || '';
    elements.addressForm.stateRegion.value = address.stateRegion || '';
    elements.addressForm.postalCode.value = address.postalCode || '';
    elements.addressForm.country.value = address.country || '';
    renderAddressSummary(address);
    renderRoles(resolvedUser);
  }

  function activeRoleFor(user) {
    const roles = getUserRoles(user);
    const activeRole = String(session?.activeRole || '').toLowerCase();
    return roles.includes(activeRole) ? activeRole : getPreferredRole(user);
  }

  function renderRoles(user) {
    const roles = getUserRoles(user);
    const activeRole = activeRoleFor(user);
    elements.rolePanel.classList.toggle('single-role', roles.length <= 1);
    elements.roleList.innerHTML = roles.map((role) => `
      <button class="role-card ${role === activeRole ? 'is-active' : ''}" type="button" data-switch-role="${role}">
        <span>
          <strong>${roleLabel(role)}</strong>
          <small>${role === activeRole ? 'Current session' : 'Open dashboard'}</small>
        </span>
        <em>${role === activeRole ? 'Active' : 'Switch'}</em>
      </button>
    `).join('');
  }

  function switchRole(role) {
    const roles = getUserRoles(session?.user);
    if (!roles.includes(role)) return;
    writeSession({ ...session, activeRole: role });
    window.location.assign(roleHome[role] || '/dashboard');
  }

  function renderAddressSummary(address = {}) {
    const line1 = String(address.line1 || '').trim();
    const line2 = String(address.line2 || '').trim();
    const cityLine = [address.city, address.stateRegion, address.postalCode]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(', ');
    const country = String(address.country || '').trim();
    const hasAddress = [line1, line2, cityLine, country].some(Boolean);

    elements.addressSummary.classList.toggle('hidden', !hasAddress);
    elements.addressSummaryLine1.textContent = line1 || 'Address saved';
    elements.addressSummaryLine2.textContent = [line2, cityLine, country].filter(Boolean).join('\n');
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function refreshUser() {
    const result = await apiRequest('/api/auth/me');
    updateStoredUser(result.user);
  }

  async function saveAddress(event) {
    event.preventDefault();
    const form = new FormData(elements.addressForm);
    const result = await apiRequest('/api/account', {
      method: 'PATCH',
      body: JSON.stringify({
        address: {
          line1: form.get('line1'),
          line2: form.get('line2'),
          city: form.get('city'),
          stateRegion: form.get('stateRegion'),
          postalCode: form.get('postalCode'),
          country: form.get('country'),
        },
      }),
    });
    updateStoredUser(result.user);
    showToast('Address saved.');
  }

  async function uploadPicture(event) {
    event.preventDefault();
    const file = elements.pictureInput.files?.[0];
    if (!file) {
      showToast('Choose a profile picture first.', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Profile picture must be 10 MB or smaller.', 'error');
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    const result = await apiRequest('/api/account/profile-picture', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        attachmentData: dataUrl,
      }),
    });
    elements.pictureInput.value = '';
    updateStoredUser(result.user);
    showToast('Profile picture updated.');
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = new FormData(elements.passwordForm);
    const currentPassword = String(form.get('currentPassword') || '');
    const newPassword = String(form.get('newPassword') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');

    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    await apiRequest('/api/account/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    elements.passwordForm.reset();
    showToast('Password changed.');
  }

  async function logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Local session cleanup is enough if the token is already invalid.
    }
    clearSession();
    window.location.replace('/login');
  }

  async function init() {
    if (!session?.token) {
      window.location.replace('/login');
      return;
    }

    renderUser(session.user);
    elements.addressForm.addEventListener('submit', (event) => {
      saveAddress(event).catch((error) => showToast(error.error || 'Could not save address.', 'error'));
    });
    elements.pictureForm.addEventListener('submit', (event) => {
      uploadPicture(event).catch((error) => showToast(error.error || 'Could not upload picture.', 'error'));
    });
    elements.passwordForm.addEventListener('submit', (event) => {
      changePassword(event).catch((error) => showToast(error.error || 'Could not change password.', 'error'));
    });
    elements.logoutButton.addEventListener('click', logout);
    elements.roleList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-switch-role]');
      if (!button) return;
      switchRole(button.dataset.switchRole);
    });

    try {
      await refreshUser();
    } catch (error) {
      showToast(error.error || 'Could not refresh account details.', 'error');
    }
  }

  init();
});
