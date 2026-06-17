// Local + server-backed title-screen leaderboard for single-player and multiplayer runs.
// LocalStorage keeps offline records; HTTP/WebSocket sync keeps shared records global when the server is available.
(function installDungeonCrawlerLeaderboard() {
  "use strict";

  const STORAGE_KEY = "dcwz.leaderboard.v1";
  const MAX_ENTRIES = 25;
  const LEADERBOARD_API_URL = window.DCW_LEADERBOARD_API_URL || "/api/leaderboard";
  const MODE_LABELS = {
    single: "Single Player",
    multiplayer: "Multiplayer",
    arena: "PvP Arena"
  };

  let lastProgressSignature = "";
  let lastServerSubmitSignature = "";
  let lastHttpSubmitSignature = "";
  let lastLocalPushPlayerId = null;
  let serverLeaderboardEntries = [];
  let serverLeaderboardStatus = "checking";
  let serverLeaderboardStatusMessage = "Server leaderboard: checking...";
  let httpLoadInFlight = null;

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getSanitizedName() {
    if (typeof sanitizePlayerName === "function") return sanitizePlayerName(playerProfile?.name);
    const cleaned = String(playerProfile?.name || "Crawler").trim().slice(0, 16);
    return cleaned || "Crawler";
  }

  function normalizeNameKey(name) {
    return String(name || "Crawler").trim().toLowerCase() || "crawler";
  }

  function normalizeMode(mode) {
    const value = String(mode || "").trim().toLowerCase();
    if (value === "pvp" || value === "pvp_arena") return "arena";
    if (value === "quick_match" || value === "local_multiplayer") return "multiplayer";
    return MODE_LABELS[value] ? value : "single";
  }

  function normalizeModes(modes, fallbackMode = "single") {
    const source = Array.isArray(modes) ? modes : [fallbackMode];
    const normalized = source.map(normalizeMode).filter(mode => MODE_LABELS[mode]);
    return Array.from(new Set(normalized.length ? normalized : [normalizeMode(fallbackMode)]));
  }

  function getCurrentModeKey() {
    const multiplayerActive = typeof multiplayer !== "undefined" && !!multiplayer?.enabled;
    if (multiplayerActive && multiplayer?.arena) return "arena";
    const isMulti = (typeof isMultiplayerMode === "function" && isMultiplayerMode()) || multiplayerActive;
    return isMulti ? "multiplayer" : "single";
  }

  function normalizeEntry(entry = {}) {
    const modeKey = normalizeMode(entry.modeKey || entry.mode || (Array.isArray(entry.modes) ? entry.modes[0] : "single"));
    return {
      name: typeof sanitizePlayerName === "function" ? sanitizePlayerName(entry?.name) : String(entry?.name || "Crawler").trim().slice(0, 16) || "Crawler",
      highestFloor: Math.max(0, Math.floor(safeNumber(entry?.highestFloor ?? entry?.floor))),
      highestGold: Math.max(0, Math.floor(safeNumber(entry?.highestGold ?? entry?.gold ?? entry?.coins))),
      modes: normalizeModes(entry?.modes, modeKey),
      updatedAt: Number.isFinite(Number(entry?.updatedAt)) ? Number(entry.updatedAt) : Date.now()
    };
  }

  function readLocalLeaderboard() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const entries = Array.isArray(raw) ? raw : (Array.isArray(raw?.entries) ? raw.entries : []);
      return entries.map(normalizeEntry).filter(entry => entry.name);
    } catch {
      return [];
    }
  }

  function sortLeaderboard(entries) {
    return entries.sort((a, b) =>
      b.highestFloor - a.highestFloor ||
      b.highestGold - a.highestGold ||
      b.updatedAt - a.updatedAt ||
      a.name.localeCompare(b.name)
    );
  }

  function mergeLeaderboardEntries(...entryGroups) {
    const merged = new Map();
    for (const group of entryGroups) {
      for (const rawEntry of group || []) {
        const entry = normalizeEntry(rawEntry);
        const nameKey = normalizeNameKey(entry.name);
        const existing = merged.get(nameKey);
        if (!existing) {
          merged.set(nameKey, entry);
          continue;
        }
        existing.highestFloor = Math.max(existing.highestFloor, entry.highestFloor);
        existing.highestGold = Math.max(existing.highestGold, entry.highestGold);
        existing.modes = normalizeModes([...(existing.modes || []), ...(entry.modes || [])], entry.modes?.[0]);
        existing.updatedAt = Math.max(existing.updatedAt, entry.updatedAt);
      }
    }
    return sortLeaderboard(Array.from(merged.values())).slice(0, MAX_ENTRIES);
  }

  function readLeaderboard() {
    return mergeLeaderboardEntries(serverLeaderboardEntries, readLocalLeaderboard());
  }

  function writeLeaderboard(entries) {
    const payload = {
      version: 1,
      updatedAt: Date.now(),
      entries: sortLeaderboard(entries).slice(0, MAX_ENTRIES)
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
    return payload.entries;
  }

  function setLeaderboardServerStatus(status, message) {
    serverLeaderboardStatus = status;
    serverLeaderboardStatusMessage = message || "";
    const syncStatus = document.getElementById("leaderboardSyncStatus");
    if (syncStatus) syncStatus.textContent = getLeaderboardServerStatusText();
  }

  function getLeaderboardServerStatusText() {
    if (serverLeaderboardStatusMessage) return serverLeaderboardStatusMessage;
    if (serverLeaderboardStatus === "online") {
      return `Server leaderboard: online · ${serverLeaderboardEntries.length} shared record${serverLeaderboardEntries.length === 1 ? "" : "s"}`;
    }
    if (serverLeaderboardStatus === "saving") return "Server leaderboard: saving score...";
    if (serverLeaderboardStatus === "checking") return "Server leaderboard: checking...";
    return "Server leaderboard: unavailable · showing local records";
  }

  function canRecordLeaderboardProgress() {
    if (typeof player === "undefined" || !player) return false;
    if (typeof gameMode !== "undefined" && typeof GAME_MODES !== "undefined" && gameMode === GAME_MODES.TITLE) return false;
    if (typeof currentFloor === "undefined") return false;
    return true;
  }

  function getCurrentProgressSnapshot(reason = "progress") {
    const modeKey = getCurrentModeKey();
    return {
      name: getSanitizedName(),
      highestFloor: Math.max(0, Math.floor(safeNumber(currentFloor))),
      highestGold: Math.max(0, Math.floor(safeNumber(player?.coins))),
      modes: [modeKey],
      modeKey,
      reason,
      updatedAt: Date.now()
    };
  }

  function isServerLeaderboardReady() {
    return typeof isMultiplayerNetworkReady === "function" && isMultiplayerNetworkReady() && typeof sendMultiplayerMessage === "function";
  }

  function getCurrentServerPlayerId() {
    return String(multiplayerNetwork?.playerId || multiplayer?.playerId || "server");
  }

  function applyServerLeaderboardEntries(entries = []) {
    serverLeaderboardEntries = Array.isArray(entries) ? entries.map(normalizeEntry).filter(entry => entry.name) : [];
    setLeaderboardServerStatus("online", `Server leaderboard: online · ${serverLeaderboardEntries.length} shared record${serverLeaderboardEntries.length === 1 ? "" : "s"}`);
    if (isLeaderboardPanelOpen()) renderLeaderboardEntries();
  }

  async function loadLeaderboardFromHttp(reason = "load") {
    if (typeof fetch !== "function") {
      setLeaderboardServerStatus("offline", "Server leaderboard: unavailable · fetch not supported");
      return false;
    }
    if (httpLoadInFlight) return httpLoadInFlight;
    setLeaderboardServerStatus("checking", "Server leaderboard: checking...");
    httpLoadInFlight = fetch(LEADERBOARD_API_URL, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store"
    })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        applyServerLeaderboardEntries(payload.entries || []);
        return true;
      })
      .catch(err => {
        console.warn(`Leaderboard HTTP load failed (${reason}):`, err);
        setLeaderboardServerStatus("offline", "Server leaderboard: unavailable · showing local records");
        return false;
      })
      .finally(() => {
        httpLoadInFlight = null;
      });
    return httpLoadInFlight;
  }

  async function submitLeaderboardScoreOverHttp(entry, reason = "progress") {
    if (!entry || typeof fetch !== "function") return false;
    const normalized = normalizeEntry(entry);
    const signature = `${normalized.name}|${normalized.highestFloor}|${normalized.highestGold}|${(normalized.modes || []).join("+")}`;
    if (signature === lastHttpSubmitSignature && reason === "hud") return false;
    lastHttpSubmitSignature = signature;
    setLeaderboardServerStatus("saving", "Server leaderboard: saving score...");
    try {
      const response = await fetch(LEADERBOARD_API_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          score: {
            name: normalized.name,
            highestFloor: normalized.highestFloor,
            highestGold: normalized.highestGold,
            modes: normalized.modes,
            modeKey: normalized.modes?.[0] || "single",
            updatedAt: normalized.updatedAt
          }
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      applyServerLeaderboardEntries(payload.entries || []);
      return true;
    } catch (err) {
      console.warn(`Leaderboard HTTP submit failed (${reason}):`, err);
      setLeaderboardServerStatus("offline", "Server leaderboard: save failed · showing local records");
      return false;
    }
  }

  function submitLeaderboardScoreToServer(entry, reason = "progress") {
    if (!entry) return false;
    const normalized = normalizeEntry(entry);
    const signature = `${normalized.name}|${normalized.highestFloor}|${normalized.highestGold}|${(normalized.modes || []).join("+")}`;
    if (signature === lastServerSubmitSignature && reason === "hud") return false;
    lastServerSubmitSignature = signature;

    let sentOverWebSocket = false;
    if (isServerLeaderboardReady()) {
      sentOverWebSocket = sendMultiplayerMessage("leaderboard_submit", {
        score: {
          name: normalized.name,
          highestFloor: normalized.highestFloor,
          highestGold: normalized.highestGold,
          modes: normalized.modes,
          modeKey: normalized.modes?.[0] || "single",
          updatedAt: normalized.updatedAt
        }
      });
    }

    submitLeaderboardScoreOverHttp(normalized, reason);
    return sentOverWebSocket;
  }

  function requestServerLeaderboard() {
    const sentOverWebSocket = isServerLeaderboardReady() ? sendMultiplayerMessage("leaderboard_request") : false;
    loadLeaderboardFromHttp("request");
    return sentOverWebSocket;
  }

  function pushLocalLeaderboardToServer(reason = "sync") {
    const entries = readLocalLeaderboard();
    if (!entries.length) return false;

    const serverPlayerId = getCurrentServerPlayerId();
    if (lastLocalPushPlayerId === serverPlayerId && reason !== "open") return false;
    for (const entry of entries) submitLeaderboardScoreToServer(entry, reason);
    lastLocalPushPlayerId = serverPlayerId;
    return true;
  }

  function recordCurrentLeaderboardProgress(reason = "progress") {
    if (!canRecordLeaderboardProgress()) return null;

    const snapshot = getCurrentProgressSnapshot(reason);
    const signature = `${snapshot.name}|${snapshot.highestFloor}|${snapshot.highestGold}|${snapshot.modeKey}|${reason}`;
    if (signature === lastProgressSignature && reason === "hud") return null;
    lastProgressSignature = signature;

    const entries = readLocalLeaderboard();
    const nameKey = normalizeNameKey(snapshot.name);
    let entry = entries.find(candidate => normalizeNameKey(candidate.name) === nameKey);
    let changed = false;

    if (!entry) {
      entry = {
        name: snapshot.name,
        highestFloor: snapshot.highestFloor,
        highestGold: snapshot.highestGold,
        modes: snapshot.modes,
        updatedAt: snapshot.updatedAt
      };
      entries.push(entry);
      changed = true;
    } else {
      const nextModes = normalizeModes([...(entry.modes || []), snapshot.modeKey], snapshot.modeKey);
      if (entry.name !== snapshot.name) { entry.name = snapshot.name; changed = true; }
      if (snapshot.highestFloor > entry.highestFloor) { entry.highestFloor = snapshot.highestFloor; changed = true; }
      if (snapshot.highestGold > entry.highestGold) { entry.highestGold = snapshot.highestGold; changed = true; }
      if (nextModes.join("|") !== (entry.modes || []).join("|")) { entry.modes = nextModes; changed = true; }
      if (changed) entry.updatedAt = snapshot.updatedAt;
    }

    if (!changed) return entry;
    const saved = writeLeaderboard(entries);
    const updatedEntry = saved.find(candidate => normalizeNameKey(candidate.name) === nameKey) || entry;
    submitLeaderboardScoreToServer(updatedEntry, reason);

    try {
      window.dispatchEvent(new CustomEvent("dcwz:leaderboard-progress", { detail: { ...updatedEntry, reason } }));
    } catch {}

    if (isLeaderboardPanelOpen()) renderLeaderboardEntries();
    return updatedEntry;
  }

  function injectLeaderboardStyles() {
    if (document.getElementById("leaderboardStyles")) return;
    const style = document.createElement("style");
    style.id = "leaderboardStyles";
    style.textContent = `
      #leaderboardPanel { display: none; text-align: left; width: min(760px, calc(100vw - 56px)); }
      #leaderboardPanel h1 { text-align: center; }
      #leaderboardPanel p { text-align: center; }
      .leaderboardBox { position: relative; }
      .leaderboardList { display: grid; gap: 8px; margin-top: 16px; }
      .leaderboardRow { display: grid; grid-template-columns: 42px minmax(0, 1fr) 112px 112px; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; background: rgba(255,255,255,0.06); }
      .leaderboardRow.header { color: #ffd86b; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; background: rgba(214,181,92,0.10); border-color: rgba(214,181,92,0.28); }
      .leaderboardRank { color: #9db1ff; font-weight: 900; text-align: center; }
      .leaderboardName { font-weight: 900; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .leaderboardModes { margin-top: 2px; color: #cbd3ff; font-size: 11px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .leaderboardValue { color: #ffd86b; font-weight: 900; text-align: right; }
      .leaderboardEmpty { padding: 18px; border: 1px dashed rgba(255,255,255,0.18); border-radius: 12px; color: #ddd; text-align: center; line-height: 1.4; }
      .leaderboardActions { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
      .leaderboardDanger { border-color: rgba(255,100,100,0.42) !important; color: #ffd1d1 !important; }
      .leaderboardSync { margin-top: 10px; text-align: center; color: #cbd3ff; font-size: 11px; font-weight: 800; }
      @media (max-width: 640px) {
        #leaderboardPanel { width: min(94vw, 760px); padding: 20px; }
        .leaderboardRow { grid-template-columns: 34px minmax(0, 1fr) 74px 74px; gap: 7px; padding: 9px 8px; font-size: 12px; }
        .leaderboardRow.header { font-size: 9px; letter-spacing: 0.08em; }
        .leaderboardModes { font-size: 9px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureLeaderboardUi() {
    const titleScreen = document.getElementById("titleScreen");
    const actions = titleScreen?.querySelector(".titleActions");
    if (!titleScreen || !actions) return false;

    if (!document.getElementById("leaderboardBtn")) {
      const button = document.createElement("button");
      button.id = "leaderboardBtn";
      button.type = "button";
      button.textContent = "Leaderboard";
      const characterButton = document.getElementById("characterCreatorBtn");
      if (characterButton?.nextSibling) actions.insertBefore(button, characterButton.nextSibling);
      else actions.appendChild(button);
      button.addEventListener("click", showLeaderboardPanel);
    }

    if (!document.getElementById("leaderboardPanel")) {
      const panel = document.createElement("div");
      panel.id = "leaderboardPanel";
      panel.className = "titleBox leaderboardBox";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-hidden", "true");
      panel.setAttribute("aria-labelledby", "leaderboardTitle");
      panel.innerHTML = `
        <button id="closeLeaderboardBtn" class="panelClose" type="button" aria-label="Close leaderboard">×</button>
        <div class="titleEyebrow">Crawler Records</div>
        <h1 id="leaderboardTitle">Leaderboard</h1>
        <p>Best floor and best gold are cached locally for offline play and synced to the global server leaderboard when available.</p>
        <div id="leaderboardSyncStatus" class="leaderboardSync">Server leaderboard: checking...</div>
        <div id="leaderboardEntries" class="leaderboardList" aria-live="polite"></div>
        <div class="titleActions leaderboardActions">
          <button id="backFromLeaderboardBtn" type="button">Back to Title</button>
          <button id="clearLeaderboardBtn" class="leaderboardDanger" type="button">Clear Local Records</button>
        </div>
      `;
      titleScreen.appendChild(panel);
      document.getElementById("closeLeaderboardBtn")?.addEventListener("click", hideLeaderboardPanel);
      document.getElementById("backFromLeaderboardBtn")?.addEventListener("click", hideLeaderboardPanel);
      document.getElementById("clearLeaderboardBtn")?.addEventListener("click", clearLeaderboardWithConfirm);
    }

    return true;
  }

  function getTitleMainBox() {
    return Array.from(document.querySelectorAll("#titleScreen > .titleBox"))
      .find(box => box.id !== "leaderboardPanel") || null;
  }

  function isLeaderboardPanelOpen() {
    const panel = document.getElementById("leaderboardPanel");
    return !!panel && panel.style.display === "block";
  }

  function formatModes(modes = []) {
    const labels = Array.from(new Set(normalizeModes(modes))).map(mode => MODE_LABELS[mode]).filter(Boolean);
    if (!labels.length) return "Single + Multiplayer";
    if (labels.length === 1) return labels[0];
    return labels.join(" + ").replace("Single Player + Multiplayer", "Single + Multiplayer");
  }

  function renderLeaderboardEntries() {
    const container = document.getElementById("leaderboardEntries");
    if (!container) return;
    const entries = readLeaderboard();
    container.innerHTML = "";

    const syncStatus = document.getElementById("leaderboardSyncStatus");
    if (syncStatus) syncStatus.textContent = getLeaderboardServerStatusText();

    const header = document.createElement("div");
    header.className = "leaderboardRow header";
    header.innerHTML = "<div>#</div><div>Player</div><div>Highest Floor</div><div>Highest Gold</div>";
    container.appendChild(header);

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "leaderboardEmpty";
      empty.textContent = "No crawler records yet. Start a run and the dungeon will begin judging you immediately. Politely, of course.";
      container.appendChild(empty);
      return;
    }

    entries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "leaderboardRow";

      const rank = document.createElement("div");
      rank.className = "leaderboardRank";
      rank.textContent = String(index + 1);

      const nameCell = document.createElement("div");
      const name = document.createElement("div");
      name.className = "leaderboardName";
      name.textContent = entry.name;
      const modes = document.createElement("div");
      modes.className = "leaderboardModes";
      modes.textContent = formatModes(entry.modes);
      nameCell.append(name, modes);

      const floor = document.createElement("div");
      floor.className = "leaderboardValue";
      floor.textContent = String(entry.highestFloor);

      const gold = document.createElement("div");
      gold.className = "leaderboardValue";
      gold.textContent = String(entry.highestGold);

      row.append(rank, nameCell, floor, gold);
      container.appendChild(row);
    });
  }

  function showLeaderboardPanel() {
    if (!ensureLeaderboardUi()) return;
    recordCurrentLeaderboardProgress("open");
    requestServerLeaderboard();
    pushLocalLeaderboardToServer("open");
    renderLeaderboardEntries();
    const mainBox = getTitleMainBox();
    const panel = document.getElementById("leaderboardPanel");
    if (mainBox) mainBox.style.display = "none";
    if (panel) {
      panel.style.display = "block";
      panel.setAttribute("aria-hidden", "false");
    }
    document.getElementById("closeLeaderboardBtn")?.focus({ preventScroll: true });
    if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
  }

  function hideLeaderboardPanel(options = {}) {
    const shouldFocus = options?.focus !== false;
    const mainBox = getTitleMainBox();
    const panel = document.getElementById("leaderboardPanel");
    if (panel) {
      panel.style.display = "none";
      panel.setAttribute("aria-hidden", "true");
    }
    if (mainBox) mainBox.style.display = "";
    if (shouldFocus) document.getElementById("leaderboardBtn")?.focus({ preventScroll: true });
    if (shouldFocus && typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
  }

  function clearLeaderboardWithConfirm() {
    const ok = window.confirm("Clear local leaderboard records on this device? Shared server records will remain online.");
    if (!ok) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    lastProgressSignature = "";
    renderLeaderboardEntries();
  }

  function wrapFunction(name, timing, callback) {
    const original = window[name];
    if (typeof original !== "function" || original.__leaderboardWrapped) return;
    const wrapped = function leaderboardWrappedFunction(...args) {
      if (timing === "before") {
        try { callback(name, args); } catch (err) { console.warn("Leaderboard hook failed", name, err); }
      }
      const result = original.apply(this, args);
      if (timing === "after") {
        try { callback(name, args, result); } catch (err) { console.warn("Leaderboard hook failed", name, err); }
      }
      return result;
    };
    wrapped.__leaderboardWrapped = true;
    wrapped.__leaderboardOriginal = original;
    window[name] = wrapped;
  }

  function installLeaderboardHooks() {
    wrapFunction("updateHUD", "after", () => recordCurrentLeaderboardProgress("hud"));
    wrapFunction("advanceToNextFloor", "after", () => recordCurrentLeaderboardProgress("floor"));
    wrapFunction("loseGame", "before", () => recordCurrentLeaderboardProgress("death"));
    wrapFunction("winGame", "before", () => recordCurrentLeaderboardProgress("clear"));
    wrapFunction("requestMultiplayerStasis", "before", () => recordCurrentLeaderboardProgress("stasis"));
    wrapFunction("returnToTitle", "before", () => recordCurrentLeaderboardProgress("return"));
    wrapFunction("showTitleScreen", "after", () => hideLeaderboardPanel({ focus: false }));
  }

  function installServerMessageHook() {
    const original = window.handleMultiplayerServerMessage;
    if (typeof original !== "function" || original.__leaderboardServerWrapped) return;
    const wrapped = function handleMultiplayerServerMessageWithLeaderboard(message) {
      if (message?.type === "leaderboard_update") {
        applyServerLeaderboardEntries(message.entries || []);
        return;
      }
      const result = original.apply(this, arguments);
      if (message?.type === "welcome") {
        requestServerLeaderboard();
        pushLocalLeaderboardToServer("welcome");
      }
      return result;
    };
    wrapped.__leaderboardServerWrapped = true;
    window.handleMultiplayerServerMessage = wrapped;
  }

  function bootLeaderboard() {
    injectLeaderboardStyles();
    ensureLeaderboardUi();
    installLeaderboardHooks();
    installServerMessageHook();
    loadLeaderboardFromHttp("boot");
    window.DCWZLeaderboard = Object.freeze({
      read: readLeaderboard,
      readLocal: readLocalLeaderboard,
      readServer: () => serverLeaderboardEntries.slice(),
      record: recordCurrentLeaderboardProgress,
      render: renderLeaderboardEntries,
      show: showLeaderboardPanel,
      hide: hideLeaderboardPanel,
      requestServer: requestServerLeaderboard,
      requestHttp: loadLeaderboardFromHttp,
      submitHttp: submitLeaderboardScoreOverHttp,
      applyServerEntries: applyServerLeaderboardEntries
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootLeaderboard, { once: true });
  else bootLeaderboard();
})();
