// Local crash and bug report capture for Dungeon Crawler World Zero.
// No network calls. Reports are generated on-device so they can be pasted into ChatGPT/GitHub.
(function installDcwBugReporter() {
  if (window.__dcwBugReporterInstalled) return;
  window.__dcwBugReporterInstalled = true;

  const REPORT_VERSION = 1;
  const STYLE_ID = "dcwBugReportStyles";
  const STORAGE_KEY = "dcw.bugReport.latest";
  const MAX_LOGS = 140;
  const MAX_EVENTS = 80;
  const logs = [];
  const events = [];
  let lastPersistAt = 0;
  let lastInputSnapshot = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function clampText(value, max = 1200) {
    const text = String(value ?? "");
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function summarizeArg(value, depth = 0) {
    if (value instanceof Error) return { name: value.name, message: value.message, stack: clampText(value.stack, 2400) };
    if (value === null || typeof value === "undefined") return value;
    if (["string", "number", "boolean"].includes(typeof value)) return clampText(value, 1200);
    if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
    if (depth >= 2) return Array.isArray(value) ? `[Array ${value.length}]` : "[Object]";
    try {
      if (Array.isArray(value)) return value.slice(0, 12).map(item => summarizeArg(item, depth + 1));
      const out = {};
      for (const key of Object.keys(value).slice(0, 18)) out[key] = summarizeArg(value[key], depth + 1);
      return out;
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  function toMessage(args) {
    return args.map(arg => {
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try { return JSON.stringify(summarizeArg(arg)); } catch { return String(arg); }
    }).join(" ");
  }

  function safeClone(value, fallback = null) {
    try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
  }

  function pushCapped(list, item, max) {
    list.push(item);
    while (list.length > max) list.shift();
  }

  function recordEvent(type, details = {}) {
    pushCapped(events, { t: nowIso(), type, details: summarizeArg(details) }, MAX_EVENTS);
    persistLatestReport(type);
  }

  function recordLog(level, args) {
    pushCapped(logs, { t: nowIso(), level, message: clampText(toMessage(args), 1800), args: summarizeArg(Array.from(args)) }, MAX_LOGS);
    persistLatestReport(`console:${level}`);
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function persistLatestReport(trigger = "snapshot") {
    const now = Date.now();
    if (now - lastPersistAt < 800 && !String(trigger).includes("error") && !String(trigger).includes("crash")) return;
    lastPersistAt = now;
    const report = buildBugReport(trigger, { includeStoredPrevious: false });
    storageSet(STORAGE_KEY, JSON.stringify(report));
  }

  function patchConsole() {
    for (const level of ["log", "warn", "error", "info", "debug"]) {
      const original = console[level];
      if (typeof original !== "function" || original.__dcwBugReporterWrapped) continue;
      const wrapped = function dcwBugReporterConsoleWrapper(...args) {
        try { recordLog(level, args); } catch {}
        return original.apply(this, args);
      };
      wrapped.__dcwBugReporterWrapped = true;
      console[level] = wrapped;
    }
  }

  function basicDeviceSnapshot() {
    const nav = navigator || {};
    const screenObj = window.screen || {};
    return {
      url: location.href,
      title: document.title,
      timestamp: nowIso(),
      userAgent: nav.userAgent,
      platform: nav.platform,
      vendor: nav.vendor,
      language: nav.language,
      online: nav.onLine,
      standalone: !!(nav.standalone || window.matchMedia?.("(display-mode: standalone)")?.matches),
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 },
      screen: { width: screenObj.width, height: screenObj.height, orientation: screenObj.orientation?.type || null },
      memory: nav.deviceMemory || null,
      hardwareConcurrency: nav.hardwareConcurrency || null,
      touchPoints: nav.maxTouchPoints || 0
    };
  }

  function gamepadSnapshot() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    return pads.map(pad => ({
      id: pad.id,
      index: pad.index,
      connected: pad.connected,
      mapping: pad.mapping,
      timestamp: pad.timestamp,
      axes: Array.from(pad.axes || []).map(value => Number(value.toFixed ? value.toFixed(3) : value)),
      buttons: Array.from(pad.buttons || []).map((button, index) => ({ index, pressed: !!button.pressed, touched: !!button.touched, value: Number((button.value || 0).toFixed ? button.value.toFixed(3) : button.value || 0) }))
    }));
  }

  function selectedWeaponSnapshot() {
    try {
      const weapon = typeof getCurrentWeapon === "function" ? getCurrentWeapon() : null;
      if (!weapon) return null;
      return { id: weapon.id, name: weapon.name, type: weapon.type, damage: weapon.damage, range: weapon.range, rarity: weapon.rarity };
    } catch { return null; }
  }

  function activePetSnapshot() {
    try {
      const pet = typeof getActivePet === "function" ? getActivePet() : player?.pet;
      if (!pet) return null;
      return { type: pet.type, name: pet.name, displayName: pet.displayName, hp: pet.hp, maxHp: pet.maxHp, level: pet.level, status: pet.status, down: pet.down, x: pet.x, y: pet.y };
    } catch { return null; }
  }

  function playerSnapshot() {
    try {
      if (typeof player === "undefined" || !player) return null;
      return {
        x: Math.round(Number(player.x) || 0),
        y: Math.round(Number(player.y) || 0),
        tileX: typeof TILE !== "undefined" ? Math.floor(player.x / TILE) : null,
        tileY: typeof TILE !== "undefined" ? Math.floor(player.y / TILE) : null,
        hp: player.hp,
        maxHp: player.maxHp,
        safe: player.safe,
        level: player.level,
        xp: player.xp,
        xpToNext: player.xpToNext,
        coins: player.coins,
        inventoryCount: Array.isArray(player.inventory) ? player.inventory.length : null,
        currentWeaponId: player.currentWeaponId,
        weapon: selectedWeaponSnapshot(),
        pet: activePetSnapshot()
      };
    } catch (error) {
      return { error: `${error.name}: ${error.message}` };
    }
  }

  function openPanelSnapshot() {
    const selectors = [
      "#settingsOverlay", "#safeRoomShopV2", "#petMerchantPanel", "#inventoryPanel", "#progressionPanel",
      "#lootWindow", "#safeRoomRecap", "#logPanel", "#multiplayerPanel", "#titleScreen", "#characterCreatorScreen", "#centerMessage"
    ];
    return selectors.map(selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return {
        selector,
        id: el.id,
        className: el.className,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        openClass: el.classList.contains("open"),
        ariaHidden: el.getAttribute("aria-hidden"),
        focusedInside: el.contains(document.activeElement)
      };
    }).filter(Boolean);
  }

  function gameStateSnapshot() {
    const getGlobal = name => {
      try { return window[name]; } catch { return undefined; }
    };
    return {
      gameMode: getGlobal("gameMode"),
      currentFloor: getGlobal("currentFloor"),
      currentRoomName: getGlobal("currentRoomName"),
      currentRoomSubtitle: getGlobal("currentRoomSubtitle"),
      roomsSeen: getGlobal("roomsSeen"),
      floorTimeLeft: getGlobal("floorTimeLeft"),
      gameWon: getGlobal("gameWon"),
      gameLost: getGlobal("gameLost"),
      pendingFloorAdvance: getGlobal("pendingFloorAdvance"),
      stairwellFound: getGlobal("stairwellFound"),
      audienceScore: getGlobal("audienceScore"),
      player: playerSnapshot(),
      multiplayer: safeClone(getGlobal("multiplayer"), null),
      inputState: safeClone(getGlobal("inputState"), null),
      gamepadState: safeClone(getGlobal("gamepadState"), null),
      touchState: safeClone(getGlobal("touchState"), null),
      openPanels: openPanelSnapshot(),
      bodyClasses: document.body ? Array.from(document.body.classList) : []
    };
  }

  function readPreviousStoredReport() {
    const raw = storageGet(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return { trigger: parsed.trigger, timestamp: parsed.timestamp, latestError: parsed.latestError || null, game: parsed.game || null, logs: parsed.logs || [] };
    } catch {
      return { raw: clampText(raw, 4000) };
    }
  }

  function latestErrorFromLogs() {
    for (let i = logs.length - 1; i >= 0; i--) {
      if (["error", "crash", "unhandledrejection"].includes(logs[i].level) || /error|exception|crash/i.test(logs[i].message || "")) return logs[i];
    }
    return null;
  }

  function buildBugReport(trigger = "manual", options = {}) {
    const includeStoredPrevious = options.includeStoredPrevious !== false;
    return {
      reportVersion: REPORT_VERSION,
      trigger,
      timestamp: nowIso(),
      latestError: latestErrorFromLogs(),
      device: basicDeviceSnapshot(),
      gamepads: gamepadSnapshot(),
      game: gameStateSnapshot(),
      recentInput: lastInputSnapshot,
      recentEvents: safeClone(events, []),
      logs: safeClone(logs, []),
      previousStoredReport: includeStoredPrevious ? readPreviousStoredReport() : null,
      notesForTester: "Describe what you were doing, what button you pressed, what you expected, and what happened. Paste this whole report into ChatGPT or a GitHub issue."
    };
  }

  function reportText(trigger = "manual") {
    return JSON.stringify(buildBugReport(trigger), null, 2);
  }

  async function copyBugReport(trigger = "manual") {
    const text = reportText(trigger);
    try {
      await navigator.clipboard.writeText(text);
      showToast("Bug report copied. Paste it to ChatGPT like evidence in a dungeon trial.");
      return true;
    } catch {
      showReportOverlay(text);
      showToast("Clipboard blocked. Report opened for manual copy.");
      return false;
    }
  }

  function downloadBugReport(trigger = "manual") {
    const text = reportText(trigger);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `dcwz-bug-report-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    showToast("Bug report downloaded.");
    return true;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .dcwBugReportRow { display:grid; gap:8px; }
      .dcwBugReportActions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .dcwBugReportActions button,
      #dcwCrashReportButton,
      .dcwBugReportOverlay button {
        border:1px solid rgba(255,216,107,.35);
        border-radius:12px;
        background:rgba(255,255,255,.08);
        color:#fff;
        font-weight:900;
        min-height:44px;
        padding:8px 10px;
      }
      #dcwBugReportToast {
        position:fixed;
        left:50%;
        bottom:max(18px, env(safe-area-inset-bottom));
        transform:translateX(-50%);
        z-index:20000;
        max-width:min(560px, calc(100vw - 24px));
        background:rgba(18,13,9,.96);
        color:#f7e7bd;
        border:1px solid rgba(255,216,107,.45);
        border-radius:14px;
        box-shadow:0 12px 32px rgba(0,0,0,.52);
        padding:12px 14px;
        font-weight:800;
        display:none;
      }
      #dcwCrashReportButton {
        position:fixed;
        right:max(12px, env(safe-area-inset-right));
        bottom:max(82px, calc(env(safe-area-inset-bottom) + 72px));
        z-index:20001;
        background:linear-gradient(135deg, rgba(146,42,42,.98), rgba(34,18,18,.98));
        display:none;
      }
      .dcwBugReportOverlay {
        position:fixed;
        inset:10px;
        z-index:20002;
        display:grid;
        grid-template-rows:auto minmax(0,1fr) auto;
        gap:10px;
        background:rgba(18,13,9,.98);
        color:#f7e7bd;
        border:2px solid rgba(255,216,107,.38);
        border-radius:16px;
        padding:12px;
        box-shadow:0 18px 50px rgba(0,0,0,.65);
      }
      .dcwBugReportOverlay h3 { margin:0; color:#ffd86b; }
      .dcwBugReportOverlay textarea {
        width:100%;
        height:100%;
        min-height:260px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,.2);
        background:rgba(0,0,0,.42);
        color:#fff;
        padding:10px;
        resize:none;
        font:12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .dcwBugReportOverlayActions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      @media (max-width:700px), (hover:none) and (pointer:coarse) {
        .dcwBugReportActions,
        .dcwBugReportOverlayActions { grid-template-columns:1fr; }
        #dcwCrashReportButton { left:max(12px, env(safe-area-inset-left)); right:max(12px, env(safe-area-inset-right)); }
      }
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    injectStyles();
    let toast = document.getElementById("dcwBugReportToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "dcwBugReportToast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => { toast.style.display = "none"; }, 3800);
  }

  function showCrashButton() {
    injectStyles();
    let button = document.getElementById("dcwCrashReportButton");
    if (!button) {
      button = document.createElement("button");
      button.id = "dcwCrashReportButton";
      button.type = "button";
      button.textContent = "Copy Crash Report";
      button.addEventListener("click", () => copyBugReport("crash-button"));
      document.body.appendChild(button);
    }
    button.style.display = "block";
  }

  function showReportOverlay(text) {
    injectStyles();
    document.getElementById("dcwBugReportOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "dcwBugReportOverlay";
    overlay.className = "dcwBugReportOverlay";
    overlay.innerHTML = `
      <h3>Bug Report</h3>
      <textarea readonly spellcheck="false"></textarea>
      <div class="dcwBugReportOverlayActions">
        <button type="button" data-copy>Try Copy Again</button>
        <button type="button" data-close>Close</button>
      </div>
    `;
    const textarea = overlay.querySelector("textarea");
    textarea.value = text;
    overlay.querySelector("[data-copy]").addEventListener("click", () => copyBugReport("manual-overlay"));
    overlay.querySelector("[data-close]").addEventListener("click", () => overlay.remove());
    document.body.appendChild(overlay);
    textarea.focus({ preventScroll: true });
    textarea.select();
  }

  function injectSettingsControls() {
    injectStyles();
    if (document.getElementById("copyBugReportBtn")) return;
    const settingsBody = document.querySelector("#settingsPanel .settingsBody");
    if (!settingsBody) return;
    const section = document.createElement("section");
    section.className = "settingsSection dcwBugReportRow";
    section.innerHTML = `
      <h3>Bug Reports</h3>
      <p>Copies a local report with recent errors, controller state, open panels, player/floor state, and device info. No network upload.</p>
      <div class="dcwBugReportActions">
        <button id="copyBugReportBtn" type="button">Copy Bug Report</button>
        <button id="downloadBugReportBtn" type="button">Download JSON</button>
      </div>
    `;
    settingsBody.appendChild(section);
    document.getElementById("copyBugReportBtn")?.addEventListener("click", () => copyBugReport("settings-copy"));
    document.getElementById("downloadBugReportBtn")?.addEventListener("click", () => downloadBugReport("settings-download"));
  }

  function captureInputSnapshot() {
    try {
      lastInputSnapshot = {
        t: nowIso(),
        lastActiveInputMethod: inputState?.lastActiveInputMethod,
        gamepadConnected: gamepadState?.connected,
        gamepadName: gamepadState?.name,
        gamepads: gamepadSnapshot().map(pad => ({ id: pad.id, axes: pad.axes, pressedButtons: pad.buttons.filter(button => button.pressed).map(button => button.index) })),
        openPanelIds: openPanelSnapshot().filter(panel => panel.display !== "none" && panel.visibility !== "hidden").map(panel => panel.id)
      };
    } catch {}
  }

  function installErrorHandlers() {
    window.addEventListener("error", event => {
      const error = event.error;
      recordLog("error", [error || event.message || "window error"]);
      recordEvent("window-error", { message: event.message, source: event.filename, line: event.lineno, column: event.colno, stack: error?.stack });
      showCrashButton();
      persistLatestReport("window-error");
    }, true);

    window.addEventListener("unhandledrejection", event => {
      recordLog("unhandledrejection", [event.reason || "Unhandled promise rejection"]);
      recordEvent("unhandled-rejection", { reason: summarizeArg(event.reason) });
      showCrashButton();
      persistLatestReport("unhandled-rejection");
    }, true);

    window.addEventListener("gamepadconnected", event => recordEvent("gamepad-connected", { id: event.gamepad?.id, index: event.gamepad?.index }));
    window.addEventListener("gamepaddisconnected", event => recordEvent("gamepad-disconnected", { id: event.gamepad?.id, index: event.gamepad?.index }));
    window.addEventListener("visibilitychange", () => recordEvent("visibility-change", { hidden: document.hidden }));
  }

  function install() {
    patchConsole();
    installErrorHandlers();
    injectSettingsControls();
    captureInputSnapshot();
    persistLatestReport("install");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  const retry = setInterval(injectSettingsControls, 500);
  setTimeout(() => clearInterval(retry), 10000);
  setInterval(captureInputSnapshot, 1000);
  setInterval(() => persistLatestReport("interval"), 5000);

  window.buildDcwBugReport = buildBugReport;
  window.copyDcwBugReport = copyBugReport;
  window.downloadDcwBugReport = downloadBugReport;
  window.showDcwBugReport = () => showReportOverlay(reportText("manual-show"));
})();
