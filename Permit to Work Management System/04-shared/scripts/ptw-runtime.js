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
    syncClock();
    window.setInterval(syncClock, 60 * 1000);
    if (navigationWasReload()) {
      showRefreshToast();
    }
  });
})();
