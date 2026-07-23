(function () {
  const TOAST_ID = "ptw-refresh-toast";
  let clockOffsetMs = 0;

  function navigationWasReload() {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if (nav?.type) return nav.type === "reload";
    return performance.navigation?.type === 1;
  }

  function ensureToastStyles() {
    if (document.getElementById("ptw-runtime-styles")) return;
    const style = document.createElement("style");
    style.id = "ptw-runtime-styles";
    style.textContent = `
      .ptw-refresh-toast {
        position: fixed;
        right: 22px;
        bottom: 24px;
        z-index: 99999;
        max-width: 280px;
        padding: 13px 16px;
        border-radius: 16px;
        border: 1px solid rgba(30, 99, 214, 0.22);
        background: rgba(255, 255, 255, 0.96);
        color: #0f172a;
        box-shadow: 0 18px 48px rgba(15, 61, 145, 0.18);
        font: 700 14px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        opacity: 0;
        transform: translateY(14px);
        transition: opacity 220ms ease, transform 220ms ease;
      }
      .ptw-refresh-toast.is-visible {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
  }

  function ensureNotificationStyles() {
    if (document.getElementById("ptw-notification-styles")) return;
    const style = document.createElement("style");
    style.id = "ptw-notification-styles";
    style.textContent = `
      .topbar, .worker-topbar, .safety-topbar, .org-topbar {
        position: relative;
        z-index: 200;
        overflow: visible !important;
      }
      .notification-wrap { position: relative; z-index: 210; }
      .notification-panel { z-index: 9999 !important; }
      .notification-actions { display: flex; align-items: center; gap: 12px; }
      .notification-read-all {
        border: 0;
        background: transparent;
        color: #0f63b8;
        font: 800 12px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
        white-space: nowrap;
      }
      .notification-read-all:disabled { color: #94a3b8; cursor: default; }
      .notification-dot {
        top: -7px !important;
        right: -7px !important;
        width: auto !important;
        min-width: 21px;
        height: 21px !important;
        padding: 0 5px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: #dc2626 !important;
        color: #fff;
        box-shadow: 0 0 0 3px #fff !important;
        font: 900 11px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .notification-dot[hidden] { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  function ensureSidebarStyles() {
    if (document.getElementById("ptw-sidebar-styles")) return;
    const style = document.createElement("style");
    style.id = "ptw-sidebar-styles";
    style.textContent = `
      .ptw-role-sidebar {
        position: sticky !important;
        top: 0;
        z-index: 500 !important;
        width: 76px !important;
        min-width: 76px !important;
        height: 100vh !important;
        min-height: 100vh !important;
        display: flex !important;
        flex-direction: column !important;
        align-self: start;
        gap: 0 !important;
        padding: 18px 11px 16px !important;
        overflow: hidden !important;
        border-right: 1px solid rgba(255,255,255,.12) !important;
        background: linear-gradient(180deg, #123f69 0%, #0b3158 48%, #071f39 100%) !important;
        box-shadow: 12px 0 34px rgba(5,31,57,.12) !important;
        color: #fff !important;
        transition: width 220ms ease, min-width 220ms ease, box-shadow 220ms ease !important;
      }
      .ptw-role-sidebar:hover,
      .ptw-role-sidebar:focus-within {
        width: 272px !important;
        min-width: 272px !important;
        box-shadow: 18px 0 44px rgba(5,31,57,.22) !important;
      }
      .ptw-sidebar-trigger {
        flex: 0 0 52px !important;
        width: 52px !important;
        height: 52px !important;
        min-height: 52px !important;
        display: grid !important;
        place-content: center !important;
        gap: 5px !important;
        margin: 0 0 14px !important;
        padding: 0 !important;
        border: 1px solid rgba(255,255,255,.22) !important;
        border-radius: 16px !important;
        background: rgba(255,255,255,.08) !important;
        color: #fff !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.08) !important;
        cursor: pointer;
      }
      .ptw-sidebar-trigger:hover { background: rgba(255,255,255,.15) !important; }
      .ptw-sidebar-trigger span {
        display: block !important;
        width: 24px !important;
        height: 2px !important;
        margin: 0 !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: currentColor !important;
      }
      .ptw-sidebar-brand {
        flex: 0 0 52px !important;
        width: 52px !important;
        height: 52px !important;
        min-height: 52px !important;
        display: grid !important;
        place-items: center !important;
        margin: 0 0 18px !important;
        padding: 0 !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      .ptw-sidebar-brand img,
      .ptw-sidebar-brand .brand-logo {
        width: 42px !important;
        height: 42px !important;
        max-width: 42px !important;
        object-fit: contain !important;
      }
      .ptw-sidebar-nav,
      .ptw-sidebar-footer {
        width: 100% !important;
        display: grid !important;
        grid-template-columns: 1fr !important;
        align-content: start !important;
        gap: 8px !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .ptw-sidebar-footer {
        margin-top: auto !important;
        padding-top: 14px !important;
        border-top: 1px solid rgba(255,255,255,.12) !important;
      }
      .ptw-sidebar-item {
        width: 100% !important;
        min-width: 0 !important;
        min-height: 48px !important;
        height: 48px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        border: 1px solid transparent !important;
        border-radius: 14px !important;
        background: transparent !important;
        color: rgba(255,255,255,.82) !important;
        box-shadow: none !important;
        font: 800 14px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        text-align: left !important;
        white-space: nowrap !important;
        cursor: pointer;
        transition: color 160ms ease, background 160ms ease, border-color 160ms ease !important;
      }
      .ptw-sidebar-item svg {
        flex: 0 0 23px !important;
        width: 23px !important;
        height: 23px !important;
        display: block !important;
        fill: none !important;
        stroke: currentColor !important;
        stroke-width: 1.9 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
      }
      .ptw-sidebar-item::before,
      .ptw-sidebar-item::after { content: none !important; display: none !important; }
      .ptw-sidebar-item > span {
        max-width: 0 !important;
        margin-left: 0 !important;
        overflow: hidden !important;
        opacity: 0 !important;
        transform: translateX(-5px);
        transition: max-width 220ms ease, margin 220ms ease, opacity 150ms ease, transform 220ms ease !important;
      }
      .ptw-role-sidebar:hover .ptw-sidebar-item,
      .ptw-role-sidebar:focus-within .ptw-sidebar-item {
        justify-content: flex-start !important;
        gap: 12px !important;
        padding: 0 14px !important;
      }
      .ptw-role-sidebar:hover .ptw-sidebar-item > span,
      .ptw-role-sidebar:focus-within .ptw-sidebar-item > span {
        max-width: 190px !important;
        opacity: 1 !important;
        transform: translateX(0);
      }
      .ptw-sidebar-item:hover {
        border-color: rgba(255,255,255,.12) !important;
        background: rgba(255,255,255,.1) !important;
        color: #fff !important;
      }
      .ptw-sidebar-item.active,
      .ptw-sidebar-item.is-active {
        border-color: rgba(102,205,255,.38) !important;
        background: linear-gradient(135deg, rgba(42,142,219,.34), rgba(39,190,139,.18)) !important;
        color: #fff !important;
        box-shadow: inset 3px 0 0 #5bc8ff !important;
      }
      .ptw-sidebar-logout { color: #ffd5d5 !important; }
      .ptw-sidebar-logout:hover { background: rgba(220,38,38,.18) !important; }
      @media (max-width: 900px) {
        .ptw-role-sidebar,
        .ptw-role-sidebar:hover,
        .ptw-role-sidebar:focus-within {
          position: relative !important;
          width: 100% !important;
          min-width: 0 !important;
          height: 72px !important;
          min-height: 72px !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 9px 12px !important;
          overflow-x: auto !important;
          border-right: 0 !important;
          border-bottom: 1px solid rgba(255,255,255,.12) !important;
        }
        .ptw-sidebar-trigger { display: none !important; }
        .ptw-sidebar-brand { flex: 0 0 46px !important; width: 46px !important; height: 46px !important; min-height: 46px !important; margin: 0 4px 0 0 !important; }
        .ptw-sidebar-brand img, .ptw-sidebar-brand .brand-logo { width: 38px !important; height: 38px !important; }
        .ptw-sidebar-nav, .ptw-sidebar-footer { width: auto !important; display: flex !important; gap: 6px !important; }
        .ptw-sidebar-footer { margin: 0 0 0 auto !important; padding: 0 !important; border: 0 !important; }
        .ptw-sidebar-item,
        .ptw-role-sidebar:hover .ptw-sidebar-item,
        .ptw-role-sidebar:focus-within .ptw-sidebar-item { flex: 0 0 46px !important; width: 46px !important; height: 46px !important; min-height: 46px !important; justify-content: center !important; gap: 0 !important; padding: 0 !important; }
        .ptw-sidebar-item > span { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  const notificationTypeLabels = {
    emergency_permit_created: "Emergency permit",
    permit_draft_created: "Draft permit",
    permit_submitted: "Review required",
    permit_stage1_complete: "Permit approval",
    permit_approved: "Approved",
    permit_active: "Active work",
    permit_rejected: "Revision required",
    permit_resubmitted: "Resubmitted",
    permit_closed: "Closed",
    permit_cancelled: "Cancelled",
    worker_submitted: "Worker review",
    worker_valid: "Worker approved",
    worker_inactive: "Worker inactive",
    worker_reviewed: "Worker update",
  };

  window.PTWNotifications = {
    typeLabel(type) {
      const key = String(type || "general").trim().toLowerCase();
      return notificationTypeLabels[key] || key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    },
    updateBadge(element, unreadCount) {
      if (!element) return;
      const count = Math.max(0, Number(unreadCount) || 0);
      element.hidden = count === 0;
      element.textContent = count > 99 ? "99+" : String(count);
    },
  };

  function ensureSearchDropdownStyles() {
    if (document.getElementById("ptw-search-dropdown-styles")) return;
    const style = document.createElement("style");
    style.id = "ptw-search-dropdown-styles";
    style.textContent = `
      .search-box, label.search { position: relative !important; overflow: visible !important; }
      .ptw-search-dropdown {
        position: absolute;
        top: calc(100% + 10px);
        right: 0;
        left: 0;
        z-index: 10000;
        min-width: min(420px, calc(100vw - 32px));
        max-height: 360px;
        overflow-y: auto;
        border: 1px solid rgba(183, 204, 226, .92);
        border-radius: 16px;
        background: rgba(255,255,255,.98);
        box-shadow: 0 22px 54px rgba(15,61,145,.2);
        backdrop-filter: blur(18px);
      }
      .ptw-search-dropdown[hidden] { display: none !important; }
      .ptw-search-dropdown-head {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 11px 14px;
        border-bottom: 1px solid #e4ebf2;
        background: rgba(248,251,255,.98);
        color: #607086;
        font: 800 12px/1.2 system-ui, sans-serif;
      }
      .ptw-search-result {
        width: 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border: 0;
        border-bottom: 1px solid #e8eef4;
        background: #fff;
        color: #162033;
        text-align: left;
        cursor: pointer;
      }
      .ptw-search-result:last-child { border-bottom: 0; }
      .ptw-search-result:hover,
      .ptw-search-result.is-active { background: #edf6ff; }
      .ptw-search-result-copy { min-width: 0; }
      .ptw-search-result-copy strong,
      .ptw-search-result-copy span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ptw-search-result-copy strong { font: 850 14px/1.35 system-ui, sans-serif; }
      .ptw-search-result-copy span { margin-top: 3px; color: #68778b; font: 650 12px/1.35 system-ui, sans-serif; }
      .ptw-search-open { color: #0f63b8; font: 900 12px/1 system-ui, sans-serif; white-space: nowrap; }
      .ptw-search-empty { margin: 0; padding: 18px 14px; color: #68778b; font: 750 13px/1.4 system-ui, sans-serif; }
      .ptw-search-highlight { animation: ptw-search-pulse 1.1s ease; }
      @keyframes ptw-search-pulse {
        0%, 100% { box-shadow: inherit; }
        35% { box-shadow: 0 0 0 5px rgba(30,99,214,.2), 0 18px 42px rgba(30,99,214,.14); }
      }
      @media (max-width: 700px) {
        .ptw-search-dropdown { right: auto; width: min(92vw, 520px); min-width: 0; }
      }
      @media (prefers-reduced-motion: reduce) { .ptw-search-highlight { animation: none; } }
    `;
    document.head.appendChild(style);
  }

  function initializeSearchDropdowns() {
    const candidateSelector = [
      ".org-user-card",
      ".permit-card",
      ".queue-item",
      ".queue-row",
      ".permit-history-list-item",
      ".worker-row",
      "tbody tr",
    ].join(",");

    document.querySelectorAll(".search-box input[type='search'], label.search input[type='search']").forEach((input, searchIndex) => {
      const host = input.closest(".search-box, label.search");
      if (!host || host.querySelector(".ptw-search-dropdown")) return;

      const dropdown = document.createElement("div");
      dropdown.className = "ptw-search-dropdown";
      dropdown.id = `ptw-search-results-${searchIndex + 1}`;
      dropdown.hidden = true;
      dropdown.setAttribute("role", "listbox");
      dropdown.setAttribute("aria-label", "Search results");
      host.appendChild(dropdown);
      input.setAttribute("aria-controls", dropdown.id);
      input.setAttribute("aria-autocomplete", "list");

      let results = [];
      let activeIndex = -1;
      let renderTimer = 0;

      function cleanText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
      }

      function resultTitle(element) {
        const preferred = element.querySelector(
          ".name, .worker-name, .permit-id, .work-type strong, .org-user-details strong, h3, strong",
        );
        return cleanText(preferred?.textContent || element.textContent).slice(0, 90) || "Matching record";
      }

      function resultDetail(element, title) {
        const text = cleanText(element.textContent);
        const detail = text.startsWith(title) ? text.slice(title.length).trim() : text;
        return detail.slice(0, 130) || "Open matching result";
      }

      function findAction(element) {
        if (element.matches("button, a")) return element;
        return element.querySelector(
          "[data-edit-user], [data-review-id], [data-worker-review], [data-history-permit], .row-actions button, button:not([data-worker-cert-download]), a",
        );
      }

      function openResult(index) {
        const result = results[index];
        if (!result) return;
        dropdown.hidden = true;
        input.setAttribute("aria-expanded", "false");
        const action = findAction(result.element);
        if (action) action.click();
        window.setTimeout(() => {
          const focusTarget = document.querySelector("dialog[open], .modal:not([hidden]), .permit-detail, .queue-detail") || result.element;
          focusTarget.classList.add("ptw-search-highlight");
          focusTarget.scrollIntoView({ behavior: "smooth", block: "center" });
          window.setTimeout(() => focusTarget.classList.remove("ptw-search-highlight"), 1200);
        }, 40);
      }

      function paintActiveResult() {
        dropdown.querySelectorAll(".ptw-search-result").forEach((button, index) => {
          button.classList.toggle("is-active", index === activeIndex);
          button.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
        });
      }

      function renderResults() {
        const query = cleanText(input.value).toLowerCase();
        if (!query) {
          results = [];
          activeIndex = -1;
          dropdown.hidden = true;
          input.setAttribute("aria-expanded", "false");
          return;
        }

        const seen = new Set();
        results = Array.from(document.querySelectorAll(candidateSelector))
          .filter((element) => !element.closest(".ptw-search-dropdown, [hidden], .hidden, dialog"))
          .filter((element) => {
            const text = cleanText(element.textContent).toLowerCase();
            if (!text.includes(query) || /no .*match|no .*found/.test(text)) return false;
            const key = cleanText(element.textContent);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 8)
          .map((element) => {
            const title = resultTitle(element);
            return { element, title, detail: resultDetail(element, title) };
          });

        activeIndex = results.length ? 0 : -1;
        dropdown.innerHTML = results.length
          ? `<div class="ptw-search-dropdown-head"><span>Matching results</span><span>${results.length} shown</span></div>${results.map((result, index) => `
              <button class="ptw-search-result${index === 0 ? " is-active" : ""}" type="button" role="option" aria-selected="${index === 0 ? "true" : "false"}" data-search-result="${index}">
                <span class="ptw-search-result-copy"><strong>${result.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong><span>${result.detail.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span></span>
                <span class="ptw-search-open">Open</span>
              </button>
            `).join("")}`
          : '<p class="ptw-search-empty">No matching records found.</p>';
        dropdown.hidden = false;
        input.setAttribute("aria-expanded", "true");
      }

      input.addEventListener("input", () => {
        window.clearTimeout(renderTimer);
        renderTimer = window.setTimeout(renderResults, 0);
      });
      input.addEventListener("focus", () => { if (input.value.trim()) renderResults(); });
      input.addEventListener("keydown", (event) => {
        if (dropdown.hidden || !results.length) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          activeIndex = (activeIndex + 1) % results.length;
          paintActiveResult();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          activeIndex = (activeIndex - 1 + results.length) % results.length;
          paintActiveResult();
        } else if (event.key === "Enter") {
          event.preventDefault();
          openResult(activeIndex);
        } else if (event.key === "Escape") {
          dropdown.hidden = true;
          input.setAttribute("aria-expanded", "false");
        }
      });
      dropdown.addEventListener("mousedown", (event) => event.preventDefault());
      dropdown.addEventListener("click", (event) => {
        const button = event.target.closest("[data-search-result]");
        if (button) openResult(Number(button.dataset.searchResult));
      });
      document.addEventListener("click", (event) => {
        if (!host.contains(event.target)) {
          dropdown.hidden = true;
          input.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  function showRefreshToast() {
    ensureToastStyles();
    const existing = document.getElementById(TOAST_ID);
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "ptw-refresh-toast";
    toast.setAttribute("role", "status");
    toast.textContent = "Page has been refreshed.";
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("is-visible"));
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 260);
    }, 2800);
  }

  async function syncClock() {
    try {
      const response = await fetch("/api/server-time", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const serverEpoch = Number(data.epochMs);
      if (Number.isFinite(serverEpoch)) {
        clockOffsetMs = serverEpoch - Date.now();
      }
    } catch {
      // Keep local browser time when the backend is unavailable.
    }
  }

  window.PTWTime = {
    sync: syncClock,
    now() {
      return Date.now() + clockOffsetMs;
    },
    date(value) {
      return value ? new Date(value) : new Date(Date.now() + clockOffsetMs);
    },
    iso() {
      return new Date(Date.now() + clockOffsetMs).toISOString();
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    ensureSearchDropdownStyles();
    ensureNotificationStyles();
    initializeSearchDropdowns();
    syncClock();
    window.setInterval(syncClock, 60 * 1000);
    if (navigationWasReload()) {
      showRefreshToast();
    }
  });
})();
