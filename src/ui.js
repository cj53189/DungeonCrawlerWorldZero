function showSafeRoomRecap() {
  const panel = document.getElementById("safeRoomRecap");
  const statsBox = document.getElementById("recapStats");
  const commentBox = document.getElementById("recapComment");
  const rep = updateReputation();
  const safeSeconds = Math.floor(stats.timeInSafeRoomFrames / 60);
  const outsideSeconds = Math.floor(stats.timeOutsideSafeRoomFrames / 60);
  statsBox.innerHTML = `
    <div class="recapLine"><span>Reputation</span><span>${rep}</span></div>
    <div class="recapLine"><span>Level</span><span>${player.level}</span></div>
    <div class="recapLine"><span>XP</span><span>${player.xp}/${player.xpToNext}</span></div>
    <div class="recapLine"><span>Audience</span><span>${audienceScore}</span></div>
    <div class="recapLine"><span>Rooms</span><span>${roomsSeen}/${rooms.length}</span></div>
    <div class="recapLine"><span>Kills</span><span>${stats.enemiesKilled}</span></div>
    <div class="recapLine"><span>Bosses</span><span>${stats.bossesDefeated}</span></div>
    <div class="recapLine"><span>Boxes</span><span>${lootBoxCount()}</span></div>
    <div class="recapLine"><span>Damage</span><span>${stats.damageTaken}</span></div>`;
  commentBox.textContent = getReputationComment(rep);
  panel.style.display = "block";
}
function hideSafeRoomRecap() { document.getElementById("safeRoomRecap").style.display = "none"; }

function toggleSafeRoomRecap() {
  if (!player.safe) { announcer("Performance reviews are only available in safe rooms. The dungeon believes in work-life balance, briefly."); return; }
  const panel = document.getElementById("safeRoomRecap");
  if (panel.style.display === "block") hideSafeRoomRecap(); else showSafeRoomRecap();
}

function updatePrompt() {
  const prompt = document.getElementById("prompt");
  let text = "";

  for (const corpse of corpses) {
    if (corpse.looted) continue;
    const dist = Math.hypot(player.x - corpse.x, player.y - corpse.y);
    if (dist < player.r + corpse.r + 24) {
      text = corpse.boss ? "Loot boss corpse" : "Loot corpse";
      break;
    }
  }

  if (!text) for (const spot of getNearbyTiles()) {
    const t = map[spot.y][spot.x];
    if (t === "L") { text = "Boss door locked"; break; }
    if (t === "D") { text = "Open door"; break; }
    if (t === "C") { text = "Open chest"; break; }
  }
  if (!text && typeof petMerchantInReach === "function" && petMerchantInReach()) text = "Hire run companion";
  if (!text && typeof getNearbyInviteTarget === "function") {
    const inviteTarget = getNearbyInviteTarget();
    if (inviteTarget) text = `Invite ${inviteTarget.name || "Crawler"} to party`;
  }
  if (!text && player.safe) text = "Safe Room";
  prompt.textContent = text;
  prompt.style.display = text ? "block" : "none";
}

function achievement(title, body, id = null) {
  const key = id || title + body;
  if (achievements.has(key)) return;
  achievements.add(key);
  addToLog(title, body);
  showPopup(title, body);
}
function announcer(text) { achievement("DUNGEON AI COMMENTARY", text); }

function showPopup(title, body) {
  const wrapper = document.createElement("div");
  const titleEl = document.createElement("div");
  const bodyEl = document.createElement("div");

  wrapper.className = "popup";
  titleEl.className = "title";
  bodyEl.className = "body";
  titleEl.textContent = title;
  bodyEl.textContent = body;
  wrapper.append(titleEl, bodyEl);

  document.getElementById("announcer").prepend(wrapper);
  activePopups.unshift(wrapper);
  while (activePopups.length > MAX_ACTIVE_POPUPS) {
    const oldPopup = activePopups.pop();
    if (oldPopup?.parentNode) oldPopup.remove();
  }
  setTimeout(() => {
    activePopups = activePopups.filter(p => p !== wrapper);
    if (wrapper.parentNode) wrapper.remove();
  }, POPUP_LIFETIME_MS);
}

function addToLog(title, body) {
  achievementHistory.unshift({ title, body });
  achievementHistory = achievementHistory.slice(0, 16);
  renderLog();
}
function renderLog() {
  const entries = document.getElementById("logEntries");
  entries.textContent = "";

  for (const entry of achievementHistory) {
    const wrapper = document.createElement("div");
    const title = document.createElement("div");
    const body = document.createElement("div");

    wrapper.className = "logEntry";
    title.className = "logTitle";
    title.textContent = entry.title;
    body.textContent = entry.body;
    wrapper.append(title, body);
    entries.appendChild(wrapper);
  }
}
function toggleLog() {
  const panel = document.getElementById("logPanel");
  const opening = panel.style.display === "none" || panel.style.display === "";
  panel.style.display = opening ? "block" : "none";
  if (opening && typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
  if (!opening && document.activeElement && panel.contains(document.activeElement)) document.activeElement.blur();
}


function openLogPanel() {
  const panel = document.getElementById("logPanel");
  const recap = document.getElementById("safeRoomRecap");
  if (recap) recap.style.display = "none";
  if (panel) panel.style.display = "block";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function closeLogPanel() {
  const panel = document.getElementById("logPanel");
  if (panel) {
    panel.style.display = "none";
    if (document.activeElement && panel.contains(document.activeElement)) document.activeElement.blur();
  }
}

function openRecapPanel() {
  const recap = document.getElementById("safeRoomRecap");
  const log = document.getElementById("logPanel");
  if (log) log.style.display = "none";

  if (!player.safe) {
    announcer("Performance reviews are only available in safe rooms. The dungeon believes in work-life balance, briefly.");
    return;
  }

  showSafeRoomRecap();
  if (recap) recap.style.display = "block";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function closeRecapPanel() {
  const recap = document.getElementById("safeRoomRecap");
  if (recap) {
    recap.style.display = "none";
    if (document.activeElement && recap.contains(document.activeElement)) document.activeElement.blur();
  }
}


function isVisiblePanel(el) {
  return el && el.style.display === "block";
}

function toggleLogPanelMobile() {
  const log = document.getElementById("logPanel");
  const recap = document.getElementById("safeRoomRecap");

  if (isVisiblePanel(log)) {
    log.style.display = "none";
    if (document.activeElement && log.contains(document.activeElement)) document.activeElement.blur();
    return;
  }

  if (recap) recap.style.display = "none";
  if (log) log.style.display = "block";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function toggleRecapPanelMobile() {
  const recap = document.getElementById("safeRoomRecap");
  const log = document.getElementById("logPanel");

  if (isVisiblePanel(recap)) {
    recap.style.display = "none";
    if (document.activeElement && recap.contains(document.activeElement)) document.activeElement.blur();
    return;
  }

  if (!player.safe) {
    announcer("Performance reviews are only available in safe rooms. The dungeon believes in work-life balance, briefly.");
    return;
  }

  if (log) log.style.display = "none";
  showSafeRoomRecap();
  if (recap) recap.style.display = "block";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function getOpenScrollablePanel() {
  const log = document.getElementById("logPanel");
  const recap = document.getElementById("safeRoomRecap");
  const inv = document.getElementById("inventoryPanel");

  const prog = document.getElementById("progressionPanel");
  if (prog && prog.classList.contains("open")) return prog;
  if (inv && inv.classList.contains("open")) return document.querySelector("#inventoryPanel .progressionInventory") || document.querySelector("#inventoryPanel .lootGrid") || document.getElementById("inventoryList") || inv;
  if (isVisiblePanel(log)) return log;
  if (isVisiblePanel(recap)) return recap;
  return null;
}

function updatePanelScrollFromController() {
  if (!gamepadState.connected) return;

  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = Array.from(pads).find(pad => pad && pad.connected !== false);
  if (!gp) return;

  const panel = getOpenScrollablePanel();
  if (!panel) return;

  const rightY = gp.axes[3] || 0;
  const controllerWindowHasButtons = typeof getControllerWindowButtons === "function" && getControllerWindowButtons(panel).length > 0;
  const dpadDown = !controllerWindowHasButtons && gp.buttons[13]?.pressed ? 1 : 0;
  const dpadUp = !controllerWindowHasButtons && gp.buttons[12]?.pressed ? -1 : 0;
  const scrollInput = Math.abs(rightY) > 0.18 ? rightY : (dpadDown + dpadUp);

  if (Math.abs(scrollInput) > 0.05) {
    panel.scrollTop += scrollInput * 12;
  }
}

const UI_LAYOUT_STORAGE_KEY = "dcw.uiLayout.v1";
const UI_EDIT_STORAGE_KEY = "dcw.uiEditMode.v1";
const UI_SCALE_STORAGE_KEY = "dcw.uiScale.v1";
let uiEditMode = false;
let uiScale = 100;

function readUiLayout() {
  try { return JSON.parse(localStorage.getItem(UI_LAYOUT_STORAGE_KEY) || "{}"); } catch { return {}; }
}
function writeUiLayout(layout) { localStorage.setItem(UI_LAYOUT_STORAGE_KEY, JSON.stringify(layout)); }
function readSavedUiEditMode() { try { return localStorage.getItem(UI_EDIT_STORAGE_KEY) === "true"; } catch { return false; } }
function writeSavedUiEditMode(enabled) { try { localStorage.setItem(UI_EDIT_STORAGE_KEY, enabled ? "true" : "false"); } catch {} }
function readSavedUiScale() {
  try {
    const value = Number(localStorage.getItem(UI_SCALE_STORAGE_KEY) || "100");
    return Number.isFinite(value) ? Math.max(75, Math.min(125, value)) : 100;
  } catch { return 100; }
}
function writeSavedUiScale(value) { try { localStorage.setItem(UI_SCALE_STORAGE_KEY, String(value)); } catch {} }
function setUiScale(value, persist = true) {
  uiScale = Math.max(75, Math.min(125, Number(value) || 100));
  document.documentElement.style.setProperty("--ui-scale", uiScale / 100);
  const slider = document.getElementById("uiScaleSlider");
  const label = document.getElementById("uiScaleValue");
  if (slider) slider.value = String(uiScale);
  if (label) label.textContent = `${uiScale}%`;
  if (persist) writeSavedUiScale(uiScale);
}
function applyUiPanelLayout(el, saved) {
  if (!el || !saved) return;
  el.style.left = `${saved.left}px`; el.style.top = `${saved.top}px`;
  el.style.right = "auto"; el.style.bottom = "auto"; el.style.transform = "none";
  if (saved.width) el.style.width = `${saved.width}px`;
  if (saved.height) el.style.height = `${saved.height}px`;
}
function saveUiPanelLayout(el) {
  const key = el?.dataset.uiLayoutKey; if (!key) return;
  const rect = el.getBoundingClientRect();
  const layout = readUiLayout();
  layout[key] = { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
  writeUiLayout(layout);
}
function setUiEditMode(enabled, persist = true) {
  uiEditMode = !!enabled;
  document.body.classList.toggle("uiEditMode", uiEditMode);
  const toggle = document.getElementById("uiEditToggle");
  if (toggle) { toggle.setAttribute("aria-pressed", String(uiEditMode)); toggle.textContent = uiEditMode ? "On" : "Off"; }
  if (persist) writeSavedUiEditMode(uiEditMode);
}
function resetUiLayout() { localStorage.removeItem(UI_LAYOUT_STORAGE_KEY); location.reload(); }
function scrollSettingsPanel(deltaY) {
  const body = document.querySelector("#settingsPanel .settingsBody");
  if (!body) return false;
  body.scrollTop += deltaY;
  return true;
}
function confirmRegenerateMap() {
  if (gameMode === GAME_MODES.TITLE) return;
  const ok = window.confirm("Regenerate the dungeon map and start a fresh run? This is intended for dev/testing.");
  if (!ok) return;
  closeSettingsPanel();
  restartGame();
}
function isSettingsOpen() { return document.getElementById("settingsOverlay")?.classList.contains("open"); }
function openSettingsPanel() {
  const overlay = document.getElementById("settingsOverlay");
  if (!overlay) return;
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  resetTransientInputState?.();
  syncSettingsControls();
  document.getElementById("closeSettingsBtn")?.focus({ preventScroll: true });
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}
function closeSettingsPanel() {
  const overlay = document.getElementById("settingsOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  if (document.activeElement && overlay.contains(document.activeElement)) document.activeElement.blur();
  resetTransientInputState?.();
}
function syncSettingsControls() {
  setUiScale(uiScale, false);
  setUiEditMode(uiEditMode, false);
  if (typeof updateTouchControlsToggle === "function") updateTouchControlsToggle();
  if (typeof dungeonMusic !== "undefined") dungeonMusic.updateToggleLabel();
}
function setupUiLayoutEditor() {
  if (document.body.dataset.settingsBound !== "true") {
    document.body.dataset.settingsBound = "true";
    uiEditMode = readSavedUiEditMode();
    uiScale = readSavedUiScale();
    setUiScale(uiScale, false);
    setUiEditMode(uiEditMode, false);
    document.getElementById("settingsBtn")?.addEventListener("click", openSettingsPanel);
    document.getElementById("closeSettingsBtn")?.addEventListener("click", closeSettingsPanel);
    document.getElementById("settingsOverlay")?.addEventListener("pointerdown", e => { if (e.target.id === "settingsOverlay") closeSettingsPanel(); });
    document.getElementById("uiEditToggle")?.addEventListener("click", () => setUiEditMode(!uiEditMode));
    document.getElementById("touchControlsToggle")?.addEventListener("click", () => {
      if (typeof setTouchControlsEnabled === "function") setTouchControlsEnabled(!inputState.touchControlsEnabled);
    });
    document.getElementById("uiScaleSlider")?.addEventListener("input", e => setUiScale(e.target.value));
    document.getElementById("resetUiLayoutBtn")?.addEventListener("click", resetUiLayout);
    document.getElementById("settingsDoneBtn")?.addEventListener("click", closeSettingsPanel);
    document.getElementById("regenerateMapBtn")?.addEventListener("click", confirmRegenerateMap);
  }
  const layout = readUiLayout();
  const panels = [["inventory","inventoryPanel"],["recap","safeRoomRecap"],["log","logPanel"],["hud","hud"],["minimap","minimapEditPanel"]];
  for (const [key,id] of panels) {
    const el = document.getElementById(id); if (!el || el.dataset.uiLayoutBound === "true") continue;
    el.dataset.uiLayoutBound = "true"; el.dataset.uiLayoutKey = key; applyUiPanelLayout(el, layout[key]);
    const header = el.querySelector("h3") || el.querySelector(".hudTop") || el;
    header.classList.add("uiDragHandle");
    const resize = document.createElement("div"); resize.className = "uiResizeHandle"; resize.setAttribute("aria-hidden", "true"); el.appendChild(resize);
    let drag=null;
    header.addEventListener("pointerdown", e => { if (!uiEditMode || e.target.closest("button")) return; e.preventDefault(); const r=el.getBoundingClientRect(); drag={type:"move", id:e.pointerId, x:e.clientX, y:e.clientY, left:r.left, top:r.top}; header.setPointerCapture?.(e.pointerId); });
    resize.addEventListener("pointerdown", e => { if (!uiEditMode) return; e.preventDefault(); e.stopPropagation(); const r=el.getBoundingClientRect(); drag={type:"resize", id:e.pointerId, x:e.clientX, y:e.clientY, w:r.width, h:r.height}; resize.setPointerCapture?.(e.pointerId); });
    const move = e => { if (!drag || drag.id!==e.pointerId) return; if (drag.type==="move") { el.style.left=`${Math.max(0, Math.min(window.innerWidth-60, drag.left+e.clientX-drag.x))}px`; el.style.top=`${Math.max(0, Math.min(window.innerHeight-40, drag.top+e.clientY-drag.y))}px`; el.style.right="auto"; el.style.bottom="auto"; el.style.transform="none"; } else { el.style.width=`${Math.max(160, drag.w+e.clientX-drag.x)}px`; el.style.height=`${Math.max(120, drag.h+e.clientY-drag.y)}px`; } };
    const end = e => { if (!drag || drag.id!==e.pointerId) return; saveUiPanelLayout(el); drag=null; };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  }
}

function setupPanelCloseButtons() {
  const closeLog = document.getElementById("closeLogBtn");
  const closeRecap = document.getElementById("closeRecapBtn");
  const closeInventory = document.getElementById("closeInventoryBtn");
  const closeProgression = document.getElementById("closeProgressionBtn");

  const bind = (el, fn) => {
    if (!el) return;
    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    };
    el.addEventListener("pointerdown", fire, { passive: false });
    el.addEventListener("touchstart", fire, { passive: false });
    el.addEventListener("click", fire);
  };

  bind(closeLog, closeLogPanel);
  bind(closeRecap, closeRecapPanel);
  bind(closeInventory, closeInventoryPanel);
  bind(closeProgression, closeProgressionPanel);
}


function isControllerWindowVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function getActiveControllerWindow() {
  const selectors = [
    "#settingsOverlay",
    "#centerMessage",
    "#lootWindow",
    "#inventoryPanel",
    "#progressionPanel",
    "#petMerchantPanel",
    "#multiplayerPanel",
    "#titleScreen",
    "#safeRoomRecap",
    "#logPanel"
  ];

  return selectors
    .map(selector => document.querySelector(selector))
    .find(isControllerWindowVisible) || null;
}

function getControllerWindowButtons(root = getActiveControllerWindow()) {
  if (!root) return [];
  return Array.from(root.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit'], input[type='range'], [tabindex]"))
    .filter(el => {
      if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
      if (el.tabIndex < 0 && !["BUTTON", "INPUT"].includes(el.tagName)) return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
    });
}

function getPreferredControllerButton(buttons) {
  return buttons.find(button => !button.classList.contains("panelClose")) || buttons[0] || null;
}

function focusControllerWindowButton(button) {
  if (!button) return false;
  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function syncControllerWindowFocus() {
  if (!gamepadState.connected) return false;
  const root = getActiveControllerWindow();
  if (!root) return false;
  const buttons = getControllerWindowButtons(root);
  if (!buttons.length) return false;
  if (root.contains(document.activeElement) && buttons.includes(document.activeElement)) return true;
  return focusControllerWindowButton(getPreferredControllerButton(buttons));
}

function moveControllerWindowFocus(dx, dy) {
  const root = getActiveControllerWindow();
  const buttons = getControllerWindowButtons(root);
  if (!root || !buttons.length) return false;

  const current = root.contains(document.activeElement) && buttons.includes(document.activeElement)
    ? document.activeElement
    : getPreferredControllerButton(buttons);
  if (!current) return false;

  const currentRect = current.getBoundingClientRect();
  const currentCenter = {
    x: currentRect.left + currentRect.width / 2,
    y: currentRect.top + currentRect.height / 2
  };

  let best = null;
  let bestScore = Infinity;
  for (const button of buttons) {
    if (button === current) continue;
    const rect = button.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const offsetX = center.x - currentCenter.x;
    const offsetY = center.y - currentCenter.y;
    const forward = dx ? offsetX * dx : offsetY * dy;
    if (forward <= 4) continue;
    const sideways = dx ? Math.abs(offsetY) : Math.abs(offsetX);
    const score = forward + sideways * 1.65;
    if (score < bestScore) {
      best = button;
      bestScore = score;
    }
  }

  if (!best) {
    const currentIndex = Math.max(0, buttons.indexOf(current));
    const step = dx + dy > 0 ? 1 : -1;
    best = buttons[(currentIndex + step + buttons.length) % buttons.length];
  }

  return focusControllerWindowButton(best);
}

function activateControllerWindowSelection() {
  const root = getActiveControllerWindow();
  const buttons = getControllerWindowButtons(root);
  if (!root || !buttons.length) return false;
  const current = root.contains(document.activeElement) && buttons.includes(document.activeElement)
    ? document.activeElement
    : getPreferredControllerButton(buttons);
  if (!current) return false;
  focusControllerWindowButton(current);
  if (current.type === "range") return true;
  current.click();
  return true;
}

function hasControllerWindowOpen() {
  return !!getActiveControllerWindow();
}


function formatTimer(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}


function captureRunProgress() {
  return {
    player: {
      level: player.level, xp: player.xp, xpToNext: player.xpToNext,
      maxHp: player.maxHp, hp: player.hp, attackDamage: player.attackDamage,
      baseSpeed: player.baseSpeed, defense: player.defense,
      audienceBonus: player.audienceBonus, coins: player.coins,
      currentWeaponId: player.currentWeaponId, aimX: player.aimX, aimY: player.aimY,
      inventory: player.inventory.map(item => ({ ...item })),
      equipment: Object.fromEntries(Object.entries(player.equipment).map(([slot, item]) => [slot, item ? { ...item } : null])),
      progression: player.progression ? JSON.parse(JSON.stringify(player.progression)) : null,
      pet: player.pet ? JSON.parse(JSON.stringify(player.pet)) : null
    },
    stats: { ...stats },
    audienceScore,
    achievementHistory: achievementHistory.map(entry => ({ ...entry })),
    achievements: new Set(achievements)
  };
}

function restoreRunProgress(snapshot) {
  if (!snapshot) return;
  player.level = snapshot.player.level;
  player.xp = snapshot.player.xp;
  player.xpToNext = snapshot.player.xpToNext;
  player.maxHp = snapshot.player.maxHp;
  player.hp = Math.min(snapshot.player.hp, snapshot.player.maxHp);
  player.attackDamage = snapshot.player.attackDamage;
  player.baseSpeed = snapshot.player.baseSpeed;
  player.defense = snapshot.player.defense;
  player.audienceBonus = snapshot.player.audienceBonus;
  player.coins = snapshot.player.coins;
  player.currentWeaponId = snapshot.player.currentWeaponId || "fists";
  player.aimX = snapshot.player.aimX || 1;
  player.aimY = snapshot.player.aimY || 0;
  player.inventory = snapshot.player.inventory.map(item => ({ ...item }));
  player.equipment = {weapon:null,head:null,chest:null,legs:null,feet:null,accessory:null,light:null,pet:null, ...Object.fromEntries(Object.entries(snapshot.player.equipment || {}).map(([slot, item]) => [slot, item ? { ...item } : null]))};
  setActivePet(snapshot.player.pet ? JSON.parse(JSON.stringify(snapshot.player.pet)) : (player.equipment.pet || null));
  if (typeof mergeProgression === "function") player.progression = mergeProgression(snapshot.player.progression);

  for (const key of Object.keys(stats)) stats[key] = snapshot.stats[key] ?? 0;
  audienceScore = snapshot.audienceScore;
  achievementHistory = snapshot.achievementHistory.map(entry => ({ ...entry }));
  achievements = new Set(snapshot.achievements);

  recalcEquipmentStats();
  if (!Number.isFinite(player.speed)) player.speed = player.baseSpeed;
  updateInventoryUI();
  renderLog();
}

function showFloorSplash() {
  const splash = document.getElementById("floorSplash");
  if (!splash) return;
  splash.textContent = `Floor ${currentFloor}`;
  splash.style.display = "flex";
  splash.style.animation = "none";
  splash.offsetHeight;
  splash.style.animation = "";
  setTimeout(() => { splash.style.display = "none"; }, 1850);
}

function advanceToNextFloor() {
  if (!pendingFloorAdvance) return;
  const snapshot = captureRunProgress();
  currentFloor++;
  pendingFloorAdvance = false;
  resetState({ preserveRun: true, snapshot });
  if (typeof syncMusicToGameState === "function") syncMusicToGameState();
  showFloorSplash();
}



function getConnectionStatusInfo() {
  const network = typeof multiplayerNetwork !== "undefined" ? multiplayerNetwork : null;
  const rawStatus = multiplayer.networkStatus || (network?.connected ? "connected" : (network?.connecting ? "connecting" : "offline"));
  if (rawStatus === "connected" || network?.connected) return { label: "Connected", tone: "ok" };
  if (rawStatus === "connecting" || network?.connecting) return { label: "Connecting", tone: "warn" };
  if (rawStatus === "reconnecting" || network?.reconnectTimer) return { label: "Reconnecting", tone: "warn" };
  return { label: "Offline / server unavailable", tone: "warn" };
}

function getGameLink() {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}

function getInviteText() {
  const link = getGameLink();
  if (multiplayer.lobbyCode || multiplayer.partyCode) return `Join my Dungeon Crawler World lobby ${multiplayer.lobbyCode || multiplayer.partyCode}: ${link}`;
  return `Dungeon Crawler World Render build: ${link}`;
}

function isCopyInviteSupported() {
  return !!(navigator.clipboard?.writeText || document.queryCommandSupported?.("copy") || document.execCommand);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    textarea.remove();
  }
  if (!copied) throw new Error("Clipboard unavailable");
  return true;
}

function flashCopyButton(button, text, className = "copyStatusOk") {
  if (!button) return;
  const previousText = button.textContent;
  button.textContent = text;
  button.classList.add(className);
  setTimeout(() => {
    button.textContent = previousText;
    button.classList.remove(className);
  }, 1800);
}

async function copyInviteLink(buttonId = "copyGameLinkBtn") {
  const button = document.getElementById(buttonId);
  try {
    await copyTextToClipboard(getInviteText());
    flashCopyButton(button, (multiplayer.lobbyCode || multiplayer.partyCode) ? "Invite Copied" : "Link Copied");
    if (typeof announcer === "function" && gameMode !== GAME_MODES.TITLE) announcer((multiplayer.lobbyCode || multiplayer.partyCode) ? "Invite link copied with lobby code." : "Game link copied.");
  } catch {
    flashCopyButton(button, "Copy Unavailable", "copyStatusWarn");
    if (typeof announcer === "function" && gameMode !== GAME_MODES.TITLE) announcer("Copy is unavailable in this browser. Share the page URL and lobby code manually.");
  }
}

function updateTesterReadinessUI() {
  const connection = getConnectionStatusInfo();
  const lobbyText = (multiplayer.lobbyCode || multiplayer.partyCode) ? ` · lobby: ${multiplayer.lobbyCode || multiplayer.partyCode}` : "";
  const statusText = `Connection: ${connection.label}`;

  for (const id of ["titleConnectionStatus", "mpConnectionStatus"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.textContent = id === "mpConnectionStatus" && multiplayer.networkError
      ? `${statusText} · ${multiplayer.networkError}`
      : statusText;
    el.classList.toggle("copyStatusOk", connection.tone === "ok");
    el.classList.toggle("copyStatusWarn", connection.tone !== "ok");
  }

  const debug = document.getElementById("testerDebugLine");
  if (debug) debug.textContent = `build/source: Render · connection: ${connection.label}${lobbyText}`;

  const copySupported = isCopyInviteSupported();
  const copyGameLink = document.getElementById("copyGameLinkBtn");
  if (copyGameLink) {
    copyGameLink.hidden = !copySupported;
    if (copySupported && !copyGameLink.classList.contains("copyStatusOk") && !copyGameLink.classList.contains("copyStatusWarn")) {
      copyGameLink.textContent = (multiplayer.lobbyCode || multiplayer.partyCode) ? "Copy Invite Link" : "Copy Game Link";
    }
  }

  const copyInvite = document.getElementById("mpCopyInviteBtn");
  if (copyInvite) {
    copyInvite.hidden = !copySupported;
    if (copySupported && !copyInvite.classList.contains("copyStatusOk") && !copyInvite.classList.contains("copyStatusWarn")) {
      copyInvite.textContent = (multiplayer.lobbyCode || multiplayer.partyCode) ? "Copy Invite Link" : "Copy Game Link";
    }
  }
}

function showFriendlyMultiplayerError(message) {
  const text = String(message || "Multiplayer request failed.");
  let friendly = text;
  if (/lobby code|not found|invalid/i.test(text)) friendly = "That lobby code was not found. Check the code and try again, or create a new lobby.";
  else if (/websocket|server|reach|connection|disconnected/i.test(text)) friendly = "Multiplayer server is unavailable or disconnected. You can retry, use Single Player, or use Local 4-Crawler Test.";
  multiplayer.networkError = friendly;
  if (typeof announcer === "function") announcer(friendly);
  updateTesterReadinessUI();
}

function showTitleScreen() {
  const creator = document.getElementById("characterCreatorScreen");
  if (creator) {
    creator.style.display = "none";
    creator.setAttribute("aria-hidden", "true");
  }
  const title = document.getElementById("titleScreen");
  if (title) title.style.display = "flex";
  updateModeChrome();
  updateTesterReadinessUI();
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function hideTitleScreen() {
  const title = document.getElementById("titleScreen");
  if (title) title.style.display = "none";
  const creator = document.getElementById("characterCreatorScreen");
  if (creator) {
    creator.style.display = "none";
    creator.setAttribute("aria-hidden", "true");
  }
  updateModeChrome();
  updateTesterReadinessUI();
}

function getSelectedCreatorCharacterId() {
  const selected = document.querySelector('input[name="creatorCharacterId"]:checked');
  return getCharacterDef(selected?.value || playerProfile.characterId).id;
}

function updateCharacterCreatorPreview() {
  const input = document.getElementById("creatorNameInput");
  const name = sanitizePlayerName(input?.value ?? playerProfile.name);
  const characterDef = getCharacterDef(getSelectedCreatorCharacterId());
  const previewName = document.getElementById("creatorPreviewName");
  if (previewName) previewName.textContent = name;
  const previewMeta = document.getElementById("creatorPreviewMeta");
  if (previewMeta) previewMeta.textContent = `${characterDef.label} · ${characterDef.mode} sprite`;
  const preview = document.getElementById("creatorSpritePreview");
  if (preview && characterDef.mode === "baked") {
    preview.style.setProperty("--creator-sprite-image", `url(${characterDef.image})`);
    preview.style.setProperty("--creator-frame-width", `${characterDef.frameWidth}px`);
    preview.style.setProperty("--creator-preview-scale", "2");
  }
}

function renderCharacterCreatorOptions() {
  const options = document.getElementById("creatorCharacterOptions");
  if (!options) return;
  options.innerHTML = "";
  for (const characterDef of Object.values(CHARACTER_DEFS)) {
    const label = document.createElement("label");
    label.className = "creatorCharacterOption";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "creatorCharacterId";
    input.value = characterDef.id;
    input.checked = getCharacterDef(playerProfile.characterId).id === characterDef.id;
    input.addEventListener("change", updateCharacterCreatorPreview);
    const text = document.createElement("span");
    text.textContent = characterDef.label;
    label.append(input, text);
    options.appendChild(label);
  }
}

function showCharacterCreator() {
  const title = document.getElementById("titleScreen");
  const creator = document.getElementById("characterCreatorScreen");
  const input = document.getElementById("creatorNameInput");
  if (input) input.value = playerProfile.name;
  renderCharacterCreatorOptions();
  updateCharacterCreatorPreview();
  if (title) title.style.display = "none";
  if (creator) {
    creator.style.display = "flex";
    creator.setAttribute("aria-hidden", "false");
  }
  if (input) input.focus();
}

function saveCharacterProfileFromCreator() {
  const input = document.getElementById("creatorNameInput");
  writePlayerProfile({ name: input?.value, characterId: getSelectedCreatorCharacterId() });
  updateCharacterCreatorPreview();
  if (typeof announcer === "function") announcer(`Crawler profile saved: ${playerProfile.name}.`);
  showTitleScreen();
}

function setMultiplayerPanelOpen(isOpen) {
  const panel = document.getElementById("multiplayerPanel");
  if (panel) panel.style.display = isOpen ? "block" : "none";

  const openButton = document.getElementById("mpOpenPanelBtn");
  if (openButton) {
    const shouldShowOpenButton = multiplayer.enabled && !isOpen;
    openButton.style.display = shouldShowOpenButton ? "block" : "none";
  }
}

function showMultiplayerPanel() {
  setMultiplayerPanelOpen(true);
  updateMultiplayerPanel();
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function hideMultiplayerPanel() {
  setMultiplayerPanelOpen(false);
}

function closeMultiplayerPanel() {
  if (!multiplayer.enabled) return;
  hideMultiplayerPanel();
}


function formatMultiplayerCrawlerStatus(status) {
  return {
    exploring: "Exploring",
    at_stairs: "At Stairs",
    failed: "Failed",
    advancing: "Advancing"
  }[status] || "Exploring";
}

function updateMultiplayerPanel() {
  const panel = document.getElementById("multiplayerPanel");
  if (!panel) return;
  const lobbyMembers = typeof getLobbyMembers === "function" ? getLobbyMembers() : (multiplayer.lobbyMembers?.length ? multiplayer.lobbyMembers : multiplayer.partyMembers);
  const count = lobbyMembers.length || 1;
  const statusLabel = {
    offline: "Offline",
    party: "Floor 0 Collapse",
    matchmaking: "Floor 0 Collapse",
    ready: "Floor 0 Collapse",
    starting: "Local Floor 1 Test",
    start_pending: "Floor 0 Collapsed",
    active: "Floor 1 Active",
    stasis: "In Stasis"
  }[multiplayer.status] || multiplayer.status;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const countdownText = multiplayer.stagingEndsAt && typeof formatFloor0CollapseCountdown === "function"
    ? ` ${formatFloor0CollapseCountdown(multiplayer.stagingEndsAt)}`
    : currentFloor === 0 ? ` ${formatTimer(floorTimeLeft)}` : "";
  const joinStateLabel = multiplayer.currentJoinState === "locked" ? "Locked" : "Open";
  setText("mpStatus", `${statusLabel}${countdownText} · Floor ${currentFloor} · Run ${joinStateLabel}`);
  setText("mpCount", `${count} Crawlers in Run`);
  const partySummary = multiplayer.partyId
    ? `Party UI: Connected${multiplayer.partyMembers?.length ? ` (${multiplayer.partyMembers.length})` : ""}`
    : "Party UI: Solo Crawler";
  setText("mpPartyCode", (multiplayer.lobbyCode || multiplayer.partyCode)
    ? `Run Code: ${multiplayer.lobbyCode || multiplayer.partyCode} · ${partySummary}`
    : `Quick Match Run · ${partySummary}`);
  updateTesterReadinessUI();
  const serverRule = multiplayer.usingServer
    ? "Server-owned shared run. Quick Match joins open Floor 0 runs; Floor 1+ runs are locked to new joins."
    : "Floor 0 Collapse: Crawlers Registered shorten the timer. Find the stairs before collapse. No PvP on Floor 0.";
  setText("mpRuleText", currentFloor === 0
    ? serverRule
    : "Floor 1+: PvP enabled outside safe rooms. Attacking from a safe room freezes you for 5 seconds.");

  const list = document.getElementById("mpMemberList");
  if (list) {
    list.innerHTML = "";
    const members = lobbyMembers.length ? lobbyMembers : [{ name: "You", local: true, leader: multiplayer.isPartyLeader, isPartyLeader: multiplayer.isPartyLeader, partyId: multiplayer.partyId }];
    for (const member of members) {
      const row = document.createElement("div");
      row.className = "mpMember";
      const role = member.isPartyLeader || member.leader ? "Party Leader" : (member.partyId ? "Party Member" : "Solo Crawler");
      const floor0Status = formatMultiplayerCrawlerStatus(member.floor0Status || (member.local ? multiplayer.localFloor0Status : "exploring"));
      const statusText = currentFloor === 0 || ["start_pending", "active"].includes(multiplayer.status)
        ? `${role} · ${floor0Status}`
        : role;
      const nameSpan = document.createElement("span");
      nameSpan.textContent = `${member.name}${member.local ? " (local)" : ""}`;
      const statusSpan = document.createElement("span");
      statusSpan.textContent = statusText;
      row.append(nameSpan, statusSpan);
      list.appendChild(row);
    }
  }

  const forceStart = document.getElementById("mpForceStartBtn");
  if (forceStart) forceStart.disabled = !multiplayer.enabled;

  const mockControlsDisabled = multiplayer.usingServer;
  for (const id of ["mpAddMockBtn", "mpFillMockBtn", "mpForceStartBtn"]) {
    const button = document.getElementById(id);
    if (button) button.disabled = mockControlsDisabled || !multiplayer.enabled;
  }
}

function setupTitleScreenHandlers() {
  const bind = (id, handler) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener("click", handler);
  };

  bind("startSingleBtn", startSinglePlayer);
  bind("quickMatchBtn", startQuickMatch);
  bind("characterCreatorBtn", showCharacterCreator);
  bind("backToTitleBtn", showTitleScreen);
  bind("saveCharacterBtn", saveCharacterProfileFromCreator);
  const creatorNameInput = document.getElementById("creatorNameInput");
  if (creatorNameInput) creatorNameInput.addEventListener("input", updateCharacterCreatorPreview);
  bind("createPartyBtn", createLobby);
  bind("joinPartyBtn", () => {
    const code = prompt("Enter lobby code", multiplayer.lobbyCode || multiplayer.partyCode || "RUNE-");
    if (code) joinLobby(code);
    else showFriendlyMultiplayerError("Enter a lobby code to join a crawler lobby.");
  });
  bind("copyGameLinkBtn", () => copyInviteLink("copyGameLinkBtn"));
  bind("localMultiTestBtn", () => {
    startMultiplayerFloor0({ lobbyCode: "LOCAL-TEST", leader: true, status: "party" });
    fillMockLobby();
  });
  bind("mpAddMockBtn", addMockLobbyCrawler);
  bind("mpFillMockBtn", fillMockLobby);
  bind("mpForceStartBtn", forceLocalMultiplayerStart);
  bind("mpCopyInviteBtn", () => copyInviteLink("mpCopyInviteBtn"));
  bind("mpCancelBtn", returnToTitle);
  bind("closeMultiplayerPanelBtn", closeMultiplayerPanel);
  bind("mpOpenPanelBtn", showMultiplayerPanel);
}

function updateHUD() {
  const hpNow = Math.max(0, Math.floor(player.hp));
  const hpMax = Math.max(1, player.maxHp);
  const xpNow = Math.max(0, player.xp);
  const xpMax = Math.max(1, player.xpToNext);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("health", hpNow);
  setText("maxHealth", hpMax);
  setText("coins", player.coins);
  setText("playerLevel", player.level);
  setText("playerXP", xpNow);
  setText("xpNext", xpMax);
  setText("audience", audienceScore);
  const weapon = getCurrentWeapon();
  setText("weaponName", weapon.name);
  const pet = typeof getActivePet === "function" ? getActivePet() : null;
  setText("petName", pet ? `${pet.displayName} Lv ${pet.level} · ${Math.ceil(pet.hp)}/${pet.maxHp} HP` : "None");
  const displayedFloorTimeLeft = multiplayer.enabled && multiplayer.usingServer && currentFloor === 0 && multiplayer.collapseAt
    ? Math.max(0, Math.ceil((multiplayer.collapseAt - Date.now()) / 1000))
    : floorTimeLeft;
  setText("collapseLabel", currentFloor === 0 ? "Floor 0 Collapse" : "Collapse");
  setText("timer", displayedFloorTimeLeft <= 60 ? `FINAL ${formatTimer(displayedFloorTimeLeft)}` : formatTimer(displayedFloorTimeLeft));
  setText("roomsSeen", roomsSeen);
  setText("roomTotal", rooms.length);

  const hpFill = document.getElementById("hpFill");
  const hpText = document.getElementById("hpText");
  const xpFill = document.getElementById("xpFill");
  const xpText = document.getElementById("xpText");

  if (hpFill) hpFill.style.width = `${Math.max(0, Math.min(100, (hpNow / hpMax) * 100))}%`;
  if (hpText) hpText.textContent = `${hpNow} / ${hpMax}`;
  if (xpFill) xpFill.style.width = `${Math.max(0, Math.min(100, (xpNow / xpMax) * 100))}%`;
  if (xpText) xpText.textContent = `LV ${player.level} · ${xpNow} / ${xpMax}`;

  const invCount=document.getElementById("inventoryCount"),boxCount=document.getElementById("lootBoxCount"),roomEl=document.getElementById("currentRoomName"),roomSubEl=document.getElementById("currentRoomSubtitle");
  const floorEl=document.getElementById("floorNumber"),stairEl=document.getElementById("stairStatus");

  if(invCount)invCount.textContent=player.inventory.length;
  if(boxCount)boxCount.textContent=lootBoxCount();
  if(roomEl)roomEl.textContent=currentRoomName;
  if(roomSubEl)roomSubEl.textContent=currentRoomSubtitle||"";
  if(floorEl)floorEl.textContent=currentFloor;
  if(stairEl)stairEl.textContent=stairwellFound ? "Marked" : "Unknown";

  const stairHud=document.getElementById("stairHud");
  if(stairHud) stairHud.classList.toggle("visible", !!stairwellFound);

  const gpStatus = document.getElementById("gamepadStatus");
  if (gpStatus) gpStatus.textContent = gamepadState.connected ? "Connected" : "Press any button";

  updateReputation();
}

function showCenter(title, text, buttonText = "Generate New Floor", buttonHandler = restartGame) {
  document.getElementById("centerTitle").textContent = title;
  document.getElementById("centerText").textContent = text;
  const button = document.getElementById("centerButton");
  if (button) {
    button.textContent = buttonText;
    button.onclick = buttonHandler;
  }
  document.getElementById("centerMessage").style.display = "flex";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function descendStairwell() {
  if (gameWon || gameLost) return;
  if (multiplayer.enabled && requestMultiplayerStasis()) return;

  stats.exitFinds++;
  changeAudience(10);

  const early = floorTimeLeft > 60;
  const timeText = formatTimer(floorTimeLeft);

  if (early) {
    gameWon = true;
    pendingFloorAdvance = true;
    achievement("STAIRWELL USED: EARLY DESCENT", "You chose survival over glory. In multiplayer, you would now wait in stasis until collapse.", `earlyDescent${currentFloor}`);
    showCenter(
      "Entered Stasis",
      `You descended with ${timeText} remaining. In multiplayer, you would wait here until floor collapse. For prototype testing, press the button when you are ready to advance.`,
      "Skip Countdown",
      advanceToNextFloor
    );
  } else {
    achievement("STAIRWELL USED: FINAL WINDOW", "You waited until the floor was actively trying to murder you. In multiplayer, this would give you a head start on the next floor.", `finalDescent${currentFloor}`);
    pendingFloorAdvance = true;
    advanceToNextFloor();
  }
}
function winGame() {
  gameWon = true;
  achievement("NEW ACHIEVEMENT: Escalator Enthusiast", "You found the exit. This means you get to leave one bad situation and enter a worse one.", "win");
  showCenter("Dungeon Crawler World v1.0 Cleared", "Congratulations, crawler. You survived this procedural floor. The dungeon is already pretending it let you win.");
}
function loseGame() {
  gameLost = true;
  pendingFloorAdvance = false;
  showCenter("You Died", "The dungeon would like to thank you for your brief but educational contribution to slapstick violence.", "Start New Run", restartGame);
}
function restartGame() {
  pendingFloorAdvance = false;
  if (multiplayer.enabled) startMultiplayerFloor0({ lobbyCode: multiplayer.lobbyCode || multiplayer.partyCode, leader: multiplayer.isPartyLeader, status: (multiplayer.lobbyCode || multiplayer.partyCode) ? "party" : "matchmaking" });
  else startSinglePlayer();
}





function updateLightingToggleLabel() {
  const button = document.getElementById("lightingToggle");
  if (!button) return;
  lightingEnabled = true;
  button.textContent = "Lighting LOCKED";
  button.setAttribute("aria-pressed", "true");
  button.disabled = true;
  button.classList.remove("off");
  button.classList.add("locked");
}

function toggleLighting() {
  lightingEnabled = true;
  updateLightingToggleLabel();
  announcer("Lighting controls are disabled. Equip a torch if you want the crawler lit.");
}

function petMerchantInReach() {
  return petMerchant && currentFloor === 1 && Math.hypot(player.x - petMerchant.x, player.y - petMerchant.y) < player.r + petMerchant.r + 36;
}
function hidePetMerchantPanel() {
  const panel = document.getElementById("petMerchantPanel");
  if (panel) panel.style.display = "none";
}
function showPetMerchantPanel() {
  const panel = document.getElementById("petMerchantPanel");
  const list = document.getElementById("petMerchantOptions");
  if (!panel || !list || !petMerchant) return;
  list.innerHTML = PET_MERCHANT_OPTIONS.map(type => {
    const def = PET_DEFINITIONS[type], stats = def.baseStats;
    const disabled = player.coins < def.cost || !!getActivePet();
    const reason = getActivePet() ? "You already have a companion." : (player.coins < def.cost ? `Need ${def.cost} coins.` : "Hire companion");
    return `<div class="petOption"><div><strong>${escapeHtml(def.displayName)}</strong><span>${escapeHtml(def.role)} · ${def.cost} coins</span></div><p>${escapeHtml(def.description)}</p><small>HP ${stats.hp} · DMG ${stats.damage} · SPD ${stats.speed.toFixed(2)} · ${escapeHtml(def.primarySkill)}</small><button class="itemBtn primary" type="button" data-pet-type="${escapeHtml(type)}" ${disabled ? "disabled" : ""}>${escapeHtml(reason)}</button></div>`;
  }).join("");
  panel.style.display = "block";
  if (!panel.dataset.bound) {
    panel.dataset.bound = "true";
    document.getElementById("closePetMerchantBtn")?.addEventListener("click", hidePetMerchantPanel);
    panel.addEventListener("click", event => {
      const button = event.target.closest("button[data-pet-type]");
      if (button) purchasePet(button.dataset.petType);
    });
  }
}
function purchasePet(type) {
  const def = PET_DEFINITIONS[type];
  if (!def || !petMerchantInReach()) return;
  if (getActivePet()) { announcer("You already have a companion. The dungeon refuses to process a custody triangle."); showPetMerchantPanel(); return; }
  if (player.coins < def.cost) { announcer(`Need ${def.cost} coins. The merchant accepts exposure only from enemies.`); showPetMerchantPanel(); return; }
  player.coins -= def.cost;
  setActivePet(createPet(type, player.x - 18, player.y + 18));
  hidePetMerchantPanel();
  updateInventoryUI(); updateHUD();
  announcer(`${def.displayName} joins your run. No refunds, no chew-toy warranty, no questions from management.`);
}
