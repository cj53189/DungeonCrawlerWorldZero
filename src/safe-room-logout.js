(function installSafeRoomLogoutDashboard() {
  "use strict";

  if (window.__dcwSafeRoomLogoutDashboardInstalled) return;
  window.__dcwSafeRoomLogoutDashboardInstalled = true;

  const STATUS = typeof RUN_STATUS !== "undefined" ? RUN_STATUS : Object.freeze({
    NOT_STARTED: "not_started",
    ACTIVE: "active",
    PRESERVED_AT_STAIRS: "preserved_at_stairs",
    PRESERVED_IN_SAFE_ROOM: "preserved_in_safe_room",
    EXPOSED_FLOOR0: "exposed_floor0",
    EXPOSED: "exposed",
    DEAD: "dead",
    DESCENDED: "descended"
  });

  const STORAGE_KEY = typeof CRAWLER_RUN_STORAGE_KEY !== "undefined" ? CRAWLER_RUN_STORAGE_KEY : "dcwz_crawlerRunState";
  const TITLE_PANEL_REFRESH_MS = 1000;
  const BLOCKED_RESUME_STATUSES = new Set([STATUS.EXPOSED_FLOOR0, STATUS.EXPOSED, STATUS.DEAD]);
  const TIMER_EXEMPT_STATUSES = new Set([STATUS.PRESERVED_AT_STAIRS, STATUS.DESCENDED, STATUS.DEAD, STATUS.EXPOSED, STATUS.EXPOSED_FLOOR0]);
  let titlePanelTimer = null;

  function injectSafeRoomLogoutStyles() {
    if (document.getElementById("safeRoomLogoutDashboardStyles")) return;
    const style = document.createElement("style");
    style.id = "safeRoomLogoutDashboardStyles";
    style.textContent = `
      #runLifecyclePanel {
        position: absolute;
        right: max(16px, env(safe-area-inset-right));
        top: max(82px, env(safe-area-inset-top));
        z-index: 4;
        width: min(360px, calc(100vw - 32px));
        border: 1px solid rgba(255,216,107,0.34);
        border-radius: 16px;
        background: rgba(10,10,14,0.82);
        box-shadow: 0 14px 40px rgba(0,0,0,0.46), inset 0 0 22px rgba(255,216,107,0.055);
        padding: 14px;
        color: #fff;
        text-align: left;
        backdrop-filter: blur(4px);
      }
      #runLifecyclePanel.empty { opacity: 0.76; }
      .runLifecycleTitle {
        color: #ffd86b;
        font-size: 13px;
        line-height: 1.25;
        font-weight: 1000;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        text-shadow: 0 2px 10px #000;
      }
      .runLifecycleMeta,
      .runLifecycleObjective,
      .runLifecycleCountdown,
      .runLifecycleWarning {
        margin-top: 7px;
        color: rgba(255,255,255,0.82);
        font-size: 12px;
        line-height: 1.35;
        font-weight: 800;
      }
      .runLifecycleCountdown strong,
      .runLifecycleObjective strong { color: #9cffb1; }
      .runLifecycleWarning { color: #ffb3b3; }
      .runLifecycleActions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .runLifecycleActions button,
      #safeRoomLogoutActions button {
        border: 1px solid rgba(255,216,107,0.42);
        border-radius: 10px;
        padding: 8px 10px;
        background: rgba(214,181,92,0.92);
        color: #111;
        cursor: pointer;
        font-weight: 950;
        font-size: 12px;
      }
      .runLifecycleActions button.secondary,
      #safeRoomLogoutActions button.secondary {
        background: rgba(255,255,255,0.08);
        color: #fff;
      }
      .runLifecycleActions button:disabled,
      #safeRoomLogoutActions button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .runLifecycleDevTools {
        width: 100%;
        margin-top: 2px;
        color: rgba(255,255,255,0.70);
        font-size: 11px;
      }
      .runLifecycleDevTools summary {
        cursor: pointer;
        font-weight: 900;
      }
      #safeRoomLogoutActions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(255,255,255,0.12);
      }
      #safeRoomLogoutHint {
        width: 100%;
        color: rgba(255,255,255,0.74);
        font-size: 12px;
        line-height: 1.35;
      }
      @media (max-width: 700px) {
        #runLifecyclePanel {
          left: max(14px, env(safe-area-inset-left));
          right: max(14px, env(safe-area-inset-right));
          top: auto;
          bottom: max(62px, env(safe-area-inset-bottom));
          width: auto;
          max-height: 38vh;
          overflow: auto;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getSavedRunRemainingSeconds(savedRun) {
    if (!savedRun || !Number.isFinite(Number(savedRun.floorTimeLeft))) return null;
    const savedAt = Number(savedRun.savedAt) || Date.now();
    const elapsedSeconds = Math.max(0, (Date.now() - savedAt) / 1000);
    return Math.ceil(Number(savedRun.floorTimeLeft) - elapsedSeconds);
  }

  function formatRunCountdown(seconds) {
    if (!Number.isFinite(Number(seconds))) return "--:--";
    const total = Math.max(0, Math.ceil(Number(seconds)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function isSavedRunExpired(savedRun) {
    if (!savedRun || TIMER_EXEMPT_STATUSES.has(savedRun.runStatus)) return false;
    const remaining = getSavedRunRemainingSeconds(savedRun);
    return remaining !== null && remaining <= 0;
  }

  function writeSavedRun(savedRun) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRun)); } catch {}
  }

  function expireSavedCrawlerRunIfNeeded(savedRun) {
    if (!savedRun || !isSavedRunExpired(savedRun)) return savedRun;
    const nextStatus = Number(savedRun.currentFloor) === 0 ? STATUS.EXPOSED_FLOOR0 : STATUS.EXPOSED;
    const expired = {
      ...savedRun,
      runStatus: nextStatus,
      reason: "floor_collapsed_while_logged_out",
      floorTimeLeft: 0,
      expiredAt: Date.now()
    };
    writeSavedRun(expired);
    return expired;
  }

  function isResumeAllowed(savedRun) {
    return !!savedRun && !BLOCKED_RESUME_STATUSES.has(savedRun.runStatus) && savedRun.runStatus !== STATUS.NOT_STARTED;
  }

  function runStatusLabel(status) {
    return {
      [STATUS.NOT_STARTED]: "No active crawl",
      [STATUS.ACTIVE]: "Active crawl",
      [STATUS.PRESERVED_AT_STAIRS]: "At the stairs",
      [STATUS.PRESERVED_IN_SAFE_ROOM]: "Safe room logout",
      [STATUS.EXPOSED_FLOOR0]: "Floor 0 collapse risk",
      [STATUS.EXPOSED]: "Collapse caught you",
      [STATUS.DEAD]: "Dead",
      [STATUS.DESCENDED]: "Descended"
    }[status] || "Saved crawl";
  }

  function runObjectiveText(savedRun) {
    if (!savedRun) return "Start a new crawl or enter multiplayer.";
    if (savedRun.runStatus === STATUS.PRESERVED_IN_SAFE_ROOM) return "Resume in the safe room, then reach the stairs before collapse.";
    if (savedRun.runStatus === STATUS.PRESERVED_AT_STAIRS) return "You reached the stairs. Descend to survive the floor.";
    if (savedRun.runStatus === STATUS.DESCENDED) return "You descended. The next floor is waiting to be rude.";
    if (savedRun.runStatus === STATUS.EXPOSED_FLOOR0 || savedRun.runStatus === STATUS.EXPOSED) return "The timer expired before you reached stairs. This run is no longer safely resumable.";
    if (savedRun.runStatus === STATUS.DEAD) return "This crawler is dead. Start a fresh run.";
    return Number(savedRun.currentFloor) === 0 ? "Find the Floor 0 stairs before collapse." : "Reach stairs or a safe room before leaving.";
  }

  function makeEl(tag, className, text = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function getTitleRunPanelRoot() {
    const titleScreen = document.getElementById("titleScreen");
    if (!titleScreen) return null;
    let panel = document.getElementById("runLifecyclePanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "runLifecyclePanel";
    }
    if (panel.parentElement !== titleScreen) titleScreen.appendChild(panel);
    return panel;
  }

  function renderRunLifecycleDevTools(parent, hasSavedRun) {
    const details = document.createElement("details");
    details.className = "runLifecycleDevTools";
    const summary = document.createElement("summary");
    summary.textContent = "Dev lifecycle tools";
    const actions = document.createElement("div");
    actions.className = "runLifecycleActions";
    actions.innerHTML = `
      <button id="devSaveCurrentRunBtn" type="button" class="secondary">Save Current Run</button>
      ${hasSavedRun ? "<button id=\"devLoadSavedRunBtn\" type=\"button\" class=\"secondary\">Load Saved Run</button>" : ""}
      <button id="devClearSavedRunBtn" type="button" class="secondary">Clear Saved Run</button>
      <button id="devForceExposedBtn" type="button" class="secondary">Force Exposed</button>
      <button id="devForcePreservedStairsBtn" type="button" class="secondary">Force Stairs</button>
      <button id="devForcePreservedSafeBtn" type="button" class="secondary">Force Safe Room</button>
    `;
    details.append(summary, actions);
    parent.appendChild(details);
    if (typeof bindRunLifecycleDevButtons === "function") bindRunLifecycleDevButtons();
    document.getElementById("devLoadSavedRunBtn")?.addEventListener("click", () => restorePersistentCrawlerRun(loadCrawlerRun?.()));
  }

  function renderSafeRunPanel(savedRun) {
    injectSafeRoomLogoutStyles();
    const panel = getTitleRunPanelRoot();
    if (!panel) return;
    const saved = expireSavedCrawlerRunIfNeeded(savedRun || (typeof loadCrawlerRun === "function" ? loadCrawlerRun() : null));
    panel.innerHTML = "";
    panel.classList.toggle("empty", !saved);
    panel.dataset.runStatus = saved?.runStatus || STATUS.NOT_STARTED;
    panel.dataset.reason = saved?.reason || "";

    if (!saved) {
      panel.append(
        makeEl("div", "runLifecycleTitle", "No preserved crawler"),
        makeEl("div", "runLifecycleObjective", "Use a safe room to leave a run without abandoning it.")
      );
      renderRunLifecycleDevTools(panel, false);
      return;
    }

    const remaining = getSavedRunRemainingSeconds(saved);
    const when = saved.savedAt ? new Date(saved.savedAt).toLocaleString() : "unknown time";
    const title = makeEl("div", "runLifecycleTitle", runStatusLabel(saved.runStatus));
    const meta = makeEl("div", "runLifecycleMeta", `Floor ${saved.currentFloor ?? 0} · ${saved.reason || "saved"} · ${when}`);
    const countdown = makeEl("div", "runLifecycleCountdown");
    countdown.innerHTML = `Collapse in: <strong id="runLifecycleCountdownValue">${formatRunCountdown(remaining)}</strong>`;
    const objective = makeEl("div", "runLifecycleObjective");
    objective.innerHTML = `Objective: <strong>${runObjectiveText(saved)}</strong>`;
    panel.append(title, meta, countdown, objective);

    if (!isResumeAllowed(saved)) {
      panel.appendChild(makeEl("div", "runLifecycleWarning", "Normal resume is blocked because this crawler was not safely preserved before collapse."));
    }

    const actions = document.createElement("div");
    actions.className = "runLifecycleActions";
    const resume = document.createElement("button");
    resume.id = "resumeCrawlerBtn";
    resume.type = "button";
    resume.textContent = saved.runStatus === STATUS.PRESERVED_IN_SAFE_ROOM ? "Resume in Safe Room" : "Load Saved Run";
    resume.disabled = !isResumeAllowed(saved);
    resume.addEventListener("click", () => restorePersistentCrawlerRun(typeof loadCrawlerRun === "function" ? loadCrawlerRun() : saved));
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "secondary";
    clear.textContent = "Clear";
    clear.addEventListener("click", () => typeof clearSavedCrawlerRun === "function" && clearSavedCrawlerRun());
    actions.append(resume, clear);
    panel.appendChild(actions);
    renderRunLifecycleDevTools(panel, true);
  }

  function refreshRunLifecycleCountdown() {
    const panel = document.getElementById("runLifecyclePanel");
    const titleScreen = document.getElementById("titleScreen");
    if (!panel || !titleScreen || titleScreen.style.display === "none") return;
    const saved = typeof loadCrawlerRun === "function" ? loadCrawlerRun() : null;
    const checked = expireSavedCrawlerRunIfNeeded(saved);
    if ((checked?.runStatus || STATUS.NOT_STARTED) !== panel.dataset.runStatus || (checked?.reason || "") !== panel.dataset.reason) {
      renderSafeRunPanel(checked);
      return;
    }
    const countdown = document.getElementById("runLifecycleCountdownValue");
    if (countdown) countdown.textContent = formatRunCountdown(getSavedRunRemainingSeconds(checked));
  }

  function startTitlePanelTicker() {
    if (titlePanelTimer) return;
    titlePanelTimer = setInterval(refreshRunLifecycleCountdown, TITLE_PANEL_REFRESH_MS);
  }

  function safeRoomLogoutToTitle() {
    if (typeof GAME_MODES !== "undefined" && gameMode === GAME_MODES.TITLE) return true;
    if (typeof multiplayer !== "undefined" && multiplayer?.enabled) {
      if (typeof announcer === "function") announcer("Safe-room logout is wired for local runs first. Multiplayer safe-room persistence needs the server reconnect pass next.");
      return false;
    }
    if (!player?.safe) {
      if (typeof announcer === "function") announcer("Safe logout denied. Reach a safe room first. The dungeon is cruel, not your babysitter.");
      return false;
    }

    if (typeof saveCrawlerRun === "function") saveCrawlerRun("safe_room_logout", STATUS.PRESERVED_IN_SAFE_ROOM);
    if (typeof resetTransientInputState === "function") resetTransientInputState();
    if (typeof resetPlayerDodgeState === "function") resetPlayerDodgeState();
    if (typeof hideSafeRoomRecap === "function") hideSafeRoomRecap();
    const center = document.getElementById("centerMessage");
    if (center) center.style.display = "none";
    if (typeof setGameMode === "function" && typeof GAME_MODES !== "undefined") setGameMode(GAME_MODES.TITLE);
    if (typeof stopCollapseMusic === "function") stopCollapseMusic();
    if (typeof showTitleScreen === "function") showTitleScreen();
    renderSafeRunPanel(typeof loadCrawlerRun === "function" ? loadCrawlerRun() : null);
    return true;
  }

  function ensureSafeRoomLogoutButton() {
    const panel = document.getElementById("safeRoomRecap");
    if (!panel) return;
    let actions = document.getElementById("safeRoomLogoutActions");
    if (!actions) {
      actions = document.createElement("div");
      actions.id = "safeRoomLogoutActions";
      const hint = document.createElement("div");
      hint.id = "safeRoomLogoutHint";
      const button = document.createElement("button");
      button.id = "safeRoomLogoutBtn";
      button.type = "button";
      button.textContent = "Safe Logout to Title";
      button.addEventListener("click", safeRoomLogoutToTitle);
      actions.append(button, hint);
      panel.appendChild(actions);
    }
    const button = document.getElementById("safeRoomLogoutBtn");
    const hint = document.getElementById("safeRoomLogoutHint");
    const multiplayerBlocked = typeof multiplayer !== "undefined" && multiplayer?.enabled;
    if (button) button.disabled = !player?.safe || multiplayerBlocked;
    if (hint) {
      hint.textContent = multiplayerBlocked
        ? "Multiplayer safe-room logout comes next; this first pass protects local runs only."
        : "Leaves this run from the safe room and keeps the collapse timer ticking on the title screen.";
    }
  }

  function installSafeRoomLogoutButtonPatch() {
    const originalShowSafeRoomRecap = typeof showSafeRoomRecap === "function" ? showSafeRoomRecap : null;
    if (originalShowSafeRoomRecap && !originalShowSafeRoomRecap.__safeLogoutWrapped) {
      const wrapped = function showSafeRoomRecapWithSafeLogout() {
        const result = originalShowSafeRoomRecap.apply(this, arguments);
        ensureSafeRoomLogoutButton();
        return result;
      };
      wrapped.__safeLogoutWrapped = true;
      showSafeRoomRecap = wrapped;
    }
  }

  function installPreservationRulesPatch() {
    if (typeof getCrawlerPreservationStatus !== "function") return;
    getCrawlerPreservationStatus = function getCrawlerPreservationStatusSafeRoomFirst() {
      if (typeof gameLost !== "undefined" && gameLost) return STATUS.DEAD;
      if (typeof isPlayerAtStairs === "function" && isPlayerAtStairs()) return STATUS.PRESERVED_AT_STAIRS;
      if (player?.safe === true) return STATUS.PRESERVED_IN_SAFE_ROOM;
      return Number(currentFloor) === 0 ? STATUS.EXPOSED_FLOOR0 : STATUS.EXPOSED;
    };
  }

  function installRestorePatch() {
    const originalRestore = typeof restorePersistentCrawlerRun === "function" ? restorePersistentCrawlerRun : null;
    if (!originalRestore || originalRestore.__safeLogoutWrapped) return;
    const wrapped = function restorePersistentCrawlerRunWithCountdown(savedRun) {
      const checked = expireSavedCrawlerRunIfNeeded(savedRun || (typeof loadCrawlerRun === "function" ? loadCrawlerRun() : null));
      if (!isResumeAllowed(checked)) {
        renderSafeRunPanel(checked);
        return false;
      }
      const remaining = getSavedRunRemainingSeconds(checked);
      const resumeRun = remaining === null ? checked : { ...checked, floorTimeLeft: Math.max(1, remaining) };
      return originalRestore.call(this, resumeRun);
    };
    wrapped.__safeLogoutWrapped = true;
    restorePersistentCrawlerRun = wrapped;
  }

  function installTitlePanelPatch() {
    renderRunLifecycleTitlePanel = function renderRunLifecycleTitlePanelWithCountdown() {
      renderSafeRunPanel(typeof loadCrawlerRun === "function" ? loadCrawlerRun() : null);
      startTitlePanelTicker();
    };
  }

  injectSafeRoomLogoutStyles();
  installPreservationRulesPatch();
  installRestorePatch();
  installTitlePanelPatch();
  installSafeRoomLogoutButtonPatch();
  startTitlePanelTicker();

  window.safeRoomLogoutToTitle = safeRoomLogoutToTitle;
  window.renderSafeRoomLogoutTitlePanel = renderSafeRunPanel;

  document.addEventListener("DOMContentLoaded", () => {
    injectSafeRoomLogoutStyles();
    installSafeRoomLogoutButtonPatch();
    renderSafeRunPanel(typeof loadCrawlerRun === "function" ? loadCrawlerRun() : null);
  }, { once: true });
})();
