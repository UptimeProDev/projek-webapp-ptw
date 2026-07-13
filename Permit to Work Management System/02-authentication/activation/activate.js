document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#activationForm');
  const message = document.querySelector('#message');
  const token = new URLSearchParams(window.location.search).get('token') || '';

  function setMessage(text, type = 'error') {
    message.textContent = text;
    message.classList.toggle('success', type === 'success');
  }

  if (!token) {
    form.querySelector('button').disabled = true;
    setMessage('Activation token is missing. Ask Admin to resend the activation link.');
    return;
  }

  function normalizeRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return normalized === 'approver' ? 'supervisor' : normalized;
  }

  function getUserRoles(user) {
    const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
    return roles
      .map(normalizeRole)
      .filter(Boolean)
      .filter((role, index, list) => list.indexOf(role) === index);
  }

  function pathForRole(role) {
    if (role === 'organization_admin') return '/organization';
    if (role === 'admin') return '/admin';
    if (role === 'safety_officer') return '/safety';
    if (role === 'supervisor') return '/review';
    if (role === 'requester') return '/dashboard';
    if (role === 'worker') return '/worker';
    return '/login';
  }

  function firstRolePath(user) {
    const priority = ['organization_admin', 'admin', 'safety_officer', 'supervisor', 'requester', 'worker'];
    const roles = getUserRoles(user);
    const role = priority.find((item) => roles.includes(item)) || roles[0];
    return pathForRole(role);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json();
      if (!response.ok) throw body;

      localStorage.setItem('ptwSession', JSON.stringify({ user: body.user, token: body.token }));
      setMessage('Account activated. Opening workspace...', 'success');
      window.setTimeout(() => window.location.assign(firstRolePath(body.user)), 700);
    } catch (error) {
      setMessage(error.error || 'Unable to activate account.');
    }
  });
});
