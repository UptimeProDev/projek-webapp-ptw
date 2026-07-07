(function () {
  const SESSION_KEY = "ptwSession";
  const roleLabels = {
    organization_admin: "Organization Admin",
    admin: "Admin",
    safety_officer: "Safety Officer",
    supervisor: "Supervisor",
    approver: "Supervisor",
    requester: "Requester",
    worker: "Worker",
  };
  const rolePriority = ["organization_admin", "admin", "safety_officer", "supervisor", "requester", "worker"];
  const rolePaths = {
    organization_admin: "/organization",
    admin: "/admin",
    safety_officer: "/safety",
    supervisor: "/review",
    requester: "/dashboard",
    worker: "/worker",
  };
  const profileSelectors = [
    "#accountButton",
    "#profileButton",
    "#reviewProfileAvatar",
    ".profile-button",
    "button.profile",
  ];

  let menu;
  let activeTrigger;

  function readSession() {
    const stored = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    const storage = localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function normalizeRole(role) {
    const normalized = String(role || "").trim().toLowerCase();
    return normalized === "approver" ? "supervisor" : normalized;
  }

  function getUserRoles(user) {
    const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
    return roles
      .map(normalizeRole)
      .filter(Boolean)
      .filter((role, index, list) => list.indexOf(role) === index)
      .sort((a, b) => {
        const aIndex = rolePriority.indexOf(a);
        const bIndex = rolePriority.indexOf(b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
  }

  function currentPageRoles() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("admin")) return ["admin"];
    if (path.includes("safety")) return ["safety_officer"];
    if (path.includes("review") || path.includes("supervisor") || path.includes("approver")) return ["supervisor"];
    if (path.includes("worker")) return ["worker"];
    if (path.includes("dashboard")) return ["requester"];
    return [];
  }

  function syncActiveRole(session, roles) {
    const pageRoles = currentPageRoles().filter((role) => roles.includes(role));
    const requested = normalizeRole(session.activeRole);
    const activeRole = pageRoles.includes(requested)
      ? requested
      : pageRoles[0] || (roles.includes(requested) ? requested : roles[0]);
    if (session.activeRole !== activeRole) {
      writeSession({ ...session, activeRole });
    }
    return activeRole;
  }

  function injectStyles() {
    if (document.querySelector("#roleSwitcherStyle")) return;
    const style = document.createElement("style");
    style.id = "roleSwitcherStyle";
    style.textContent = `
      .role-profile-menu {
        position: fixed;
        z-index: 10000;
        width: min(280px, calc(100vw - 24px));
        padding: 8px;
        border: 1px solid #d9e0e7;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 18px 42px rgba(12,18,24,.2);
      }
      .role-profile-menu[hidden] {
        display: none;
      }
      .role-menu-head {
        padding: 10px 10px 8px;
        border-bottom: 1px solid #edf1f4;
      }
      .role-menu-head strong,
      .role-menu-head span {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .role-menu-head strong {
        color: #111820;
        font-size: 14px;
        font-weight: 900;
      }
      .role-menu-head span {
        margin-top: 3px;
        color: #5f6b76;
        font-size: 12px;
        font-weight: 700;
      }
      .role-menu-section {
        display: grid;
        gap: 5px;
        padding: 8px 0 0;
      }
      .role-menu-label {
        padding: 6px 10px 2px;
        color: #65717d;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .06em;
        text-transform: uppercase;
      }
      .role-menu-item {
        width: 100%;
        min-height: 38px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 10px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #111820;
        text-align: left;
        font: inherit;
        font-size: 13px;
        font-weight: 850;
        text-decoration: none;
        cursor: pointer;
      }
      .role-menu-item:hover,
      .role-menu-item:focus-visible {
        outline: none;
        background: #eef3f6;
      }
      .role-menu-item.is-current {
        background: #e8f6ef;
        color: #087443;
      }
      .role-menu-item small {
        color: inherit;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .04em;
        text-transform: uppercase;
        opacity: .82;
      }
    `;
    document.head.append(style);
  }

  function initials(name) {
    return String(name || "User")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U";
  }

  function getProfileTrigger(target) {
    const trigger = target.closest(profileSelectors.join(","));
    if (!trigger || trigger.closest(".notification-wrap")) return null;
    if (trigger.closest(".role-profile-menu")) return null;
    return trigger;
  }

  function renderMenu(session, roles, activeRole) {
    const user = session.user || {};
    const name = user.fullName || user.email || "Signed in user";
    const identity = user.employeeId || user.email || "PTW account";
    menu.innerHTML = `
      <div class="role-menu-head">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(identity)}</span>
      </div>
      <div class="role-menu-section">
        <a class="role-menu-item" href="/account">
          <span>Account profile</span>
          <small>${escapeHtml(initials(name))}</small>
        </a>
        ${roles.length > 1 ? `
          <div class="role-menu-label">Switch role</div>
          ${roles.map((role) => `
            <button class="role-menu-item ${role === activeRole ? "is-current" : ""}" type="button" data-switch-role="${escapeHtml(role)}">
              <span>${escapeHtml(roleLabels[role] || role)}</span>
              <small>${role === activeRole ? "Current" : "Open"}</small>
            </button>
          `).join("")}
        ` : ""}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function positionMenu(trigger) {
    const rect = trigger.getBoundingClientRect();
    menu.hidden = false;
    const menuRect = menu.getBoundingClientRect();
    const margin = 12;
    const left = Math.min(Math.max(margin, rect.right - menuRect.width), window.innerWidth - menuRect.width - margin);
    const top = Math.min(rect.bottom + 8, window.innerHeight - menuRect.height - margin);
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.max(margin, top)}px`;
  }

  function closeMenu() {
    if (!menu) return;
    menu.hidden = true;
    activeTrigger?.setAttribute("aria-expanded", "false");
    activeTrigger = null;
  }

  function openMenu(trigger) {
    const session = readSession();
    const roles = getUserRoles(session?.user);
    if (!session?.token || !roles.length) return;
    const activeRole = syncActiveRole(session, roles);
    renderMenu(session, roles, activeRole);
    activeTrigger = trigger;
    activeTrigger.setAttribute("aria-expanded", "true");
    positionMenu(trigger);
  }

  function toggleMenu(trigger) {
    if (!menu.hidden && activeTrigger === trigger) {
      closeMenu();
      return;
    }
    openMenu(trigger);
  }

  function switchRole(role) {
    const session = readSession();
    const roles = getUserRoles(session?.user);
    if (!session?.token || !roles.includes(role)) return;
    writeSession({ ...session, activeRole: role });
    window.location.assign(rolePaths[role] || "/dashboard");
  }

  function initRoleSwitcher() {
    const session = readSession();
    const roles = getUserRoles(session?.user);
    if (!session?.token || !roles.length) return;

    injectStyles();
    syncActiveRole(session, roles);
    menu = document.createElement("div");
    menu.className = "role-profile-menu";
    menu.hidden = true;
    document.body.append(menu);

    document.addEventListener("click", (event) => {
      const roleButton = event.target.closest("[data-switch-role]");
      if (roleButton && menu.contains(roleButton)) {
        event.preventDefault();
        switchRole(roleButton.dataset.switchRole);
        return;
      }

      const trigger = getProfileTrigger(event.target);
      if (trigger) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        toggleMenu(trigger);
        return;
      }

      if (!event.target.closest(".role-profile-menu")) closeMenu();
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRoleSwitcher);
  } else {
    initRoleSwitcher();
  }
})();
