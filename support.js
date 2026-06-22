document.addEventListener('DOMContentLoaded', () => {
  const SESSION_KEY = 'ptwSession';
  const HISTORY_KEY = 'ptwSupportRequests';
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

  const elements = {
    backLink: document.querySelector('#backLink'),
    logoutButton: document.querySelector('#logoutButton'),
    supportForm: document.querySelector('#supportForm'),
    userLine: document.querySelector('#userLine'),
    historyList: document.querySelector('#historyList'),
    clearHistoryButton: document.querySelector('#clearHistoryButton'),
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

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeHistory(items) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 8)));
  }

  function roleLabel(role) {
    return String(role || 'user')
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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

    if (response.status === 401) {
      clearSession();
      window.location.replace('/login');
      throw new Error('Session expired');
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  function renderUser(user) {
    const resolvedUser = user || session?.user || {};
    const name = resolvedUser.fullName || resolvedUser.email || 'User';
    elements.backLink.href = roleHome[resolvedUser.role] || '/dashboard';
    elements.userLine.textContent = `${name} - ${roleLabel(resolvedUser.role)} - ${resolvedUser.email || resolvedUser.employeeId || 'PTW user'}`;
  }

  function renderHistory() {
    const items = readHistory().filter((item) => item.userId === session?.user?.id);
    if (!items.length) {
      elements.historyList.innerHTML = '<p class="empty-state">No recent support requests.</p>';
      return;
    }

    elements.historyList.innerHTML = items
      .map(
        (item) => `
          <article class="history-item">
            <strong>${escapeHtml(item.ticketId)} - ${escapeHtml(item.subject)}</strong>
            <span>${escapeHtml(item.topic)} / ${escapeHtml(item.priority)} / ${escapeHtml(formatDate(item.createdAt))}</span>
          </article>
        `,
      )
      .join('');
  }

  async function refreshUser() {
    const result = await apiRequest('/api/auth/me');
    session = { ...session, user: result.user || session.user };
    const storage = localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify(session));
    renderUser(session.user);
  }

  function submitSupportRequest(event) {
    event.preventDefault();
    const form = new FormData(elements.supportForm);
    const subject = String(form.get('subject') || '').trim();
    const details = String(form.get('details') || '').trim();

    if (!subject || !details) {
      showToast('Subject and details are required.', 'error');
      return;
    }

    const ticket = {
      ticketId: `SUP-${Date.now().toString(36).toUpperCase()}`,
      userId: session.user.id,
      userEmail: session.user.email,
      topic: String(form.get('topic') || 'Other'),
      priority: String(form.get('priority') || 'Normal'),
      subject,
      details,
      createdAt: new Date().toISOString(),
    };
    writeHistory([ticket, ...readHistory()]);
    elements.supportForm.reset();
    renderHistory();
    showToast(`${ticket.ticketId} submitted.`);
  }

  async function logout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Keep local cleanup deterministic even if the token is already gone.
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
    renderHistory();
    elements.supportForm.addEventListener('submit', submitSupportRequest);
    elements.logoutButton.addEventListener('click', logout);
    elements.clearHistoryButton.addEventListener('click', () => {
      const others = readHistory().filter((item) => item.userId !== session?.user?.id);
      writeHistory(others);
      renderHistory();
      showToast('Support history cleared.');
    });

    try {
      await refreshUser();
    } catch {
      showToast('Could not refresh account details.', 'error');
    }
  }

  init();
});
