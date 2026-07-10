const RUN_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  ACTIVE: "active",
  PRESERVED_AT_STAIRS: "preserved_at_stairs",
  PRESERVED_IN_SAFE_ROOM: "preserved_in_safe_room",
  EXPOSED_FLOOR0: "exposed_floor0",
  EXPOSED: "exposed",
  DEAD: "dead",
  DESCENDED: "descended"
});

const CRAWLER_RUN_STORAGE_KEY = "dcwz_crawlerRunState";
const RUN_LIFECYCLE_INTERVAL_MS = 20000;
let runStatus = RUN_STATUS.NOT_STARTED;

function cloneRunLifecycleValue(value, fallback = null) {
  if (value == null) return fallback;
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

function isPlayerAtStairs() {
  if (!Array.isArray(map) || !player) return false;
  const x = Math.floor(player.x / TILE);
  const y = Math.floor(player.y / TILE);
  if (map[y]?.[x] === "E") return true;
  return Number.isFinite(stairwellX) && Number.isFinite(stairwellY) && x === stairwellX && y === stairwellY;
}

function isPlayerAtStairwell() { return isPlayerAtStairs(); }

function getCrawlerPreservationStatus() {
  if (gameLost) return RUN_STATUS.DEAD;
  if (currentFloor === 0 && isPlayerAtStairs()) return RUN_STATUS.PRESERVED_AT_STAIRS;
  if (currentFloor === 0) return RUN_STATUS.EXPOSED_FLOOR0;
  if (isPlayerAtStairs()) return RUN_STATUS.PRESERVED_AT_STAIRS;
  if (player?.safe === true) return RUN_STATUS.PRESERVED_IN_SAFE_ROOM;
  return RUN_STATUS.EXPOSED;
}

function getAutoPreserveStatus() { return getCrawlerPreservationStatus(); }

function updateRunLifecycleStatus(nextStatus = null) {
  if (nextStatus && Object.values(RUN_STATUS).includes(nextStatus)) {
    runStatus = nextStatus;
    return runStatus;
  }
  if (gameLost) runStatus = RUN_STATUS.DEAD;
  else if (gameMode === GAME_MODES.TITLE) runStatus = RUN_STATUS.NOT_STARTED;
  else runStatus = RUN_STATUS.ACTIVE;
  return runStatus;
}

function capturePersistentCrawlerRun(status = getCrawlerPreservationStatus(), reason = "checkpoint") {
  const snapshot = typeof captureRunProgress === "function" ? captureRunProgress() : null;
  const snapshotAchievements = snapshot?.achievements instanceof Set ? Array.from(snapshot.achievements) : Array.from(achievements || []);
  const playerSnapshot = snapshot?.player || {};
  return {
    version: 2,
    runStatus: status,
    savedAt: Date.now(),
    reason,
    currentFloor,
    floorTimeLeft,
    floorPressure: typeof captureFloorPressureState === "function" ? cloneRunLifecycleValue(captureFloorPressureState(), null) : null,
    player: {
      x: player?.x || 0,
      y: player?.y || 0,
      hp: player?.hp || 0,
      maxHp: player?.maxHp || 0,
      level: player?.level || 1,
      xp: player?.xp || 0,
      xpToNext: player?.xpToNext || 40,
      safe: !!player?.safe,
      ...cloneRunLifecycleValue(playerSnapshot, {})
    },
    playerPosition: { x: player?.x || 0, y: player?.y || 0 },
    hp: player?.hp || 0,
    maxHp: player?.maxHp || 0,
    level: player?.level || 1,
    xp: player?.xp || 0,
    xpToNext: player?.xpToNext || 40,
    coins: player?.coins || 0,
    currentWeaponId: player?.currentWeaponId || "fists",
    inventory: cloneRunLifecycleValue(playerSnapshot.inventory || player?.inventory || [], []),
    equipment: cloneRunLifecycleValue(playerSnapshot.equipment || player?.equipment || {}, {}),
    pet: cloneRunLifecycleValue(playerSnapshot.pet || player?.pet || null, null),
    progression: cloneRunLifecycleValue(playerSnapshot.progression || player?.progression || null, null),
    stats: cloneRunLifecycleValue(snapshot?.stats || stats, {}),
    audienceScore,
    achievements: snapshotAchievements,
    achievementHistory: cloneRunLifecycleValue(snapshot?.achievementHistory || achievementHistory || [], []),
    stairwellFound: !!stairwellFound,
    stairwellX,
    stairwellY,
    gameMode,
    playerSafe: !!player?.safe
  };
}

function makeCrawlerRunSave(status = getCrawlerPreservationStatus(), reason = "checkpoint") {
  return capturePersistentCrawlerRun(status, reason);
}

function restorePersistentCrawlerRun(savedRun) {
  if (!savedRun?.player) return false;
  resetMultiplayerState();
  setGameMode(GAME_MODES.SINGLE_PLAYER);
  hideTitleScreen();
  const snapshot = {
    player: { ...savedRun.player, inventory: savedRun.inventory || savedRun.player.inventory || [], equipment: savedRun.equipment || savedRun.player.equipment || {}, progression: savedRun.progression || savedRun.player.progression || null, pet: savedRun.pet || savedRun.player.pet || null },
    stats: savedRun.stats || {},
    audienceScore: savedRun.audienceScore || 10,
    achievementHistory: savedRun.achievementHistory || savedRun.history || [],
    achievements: savedRun.achievements || []
  };
  resetState({ preserveRun: true, snapshot, targetFloor: savedRun.currentFloor || 0 });
  currentFloor = Number(savedRun.currentFloor) || 0;
  stairwellFound = !!savedRun.stairwellFound;
  stairwellX = Number.isFinite(savedRun.stairwellX) ? savedRun.stairwellX : stairwellX;
  stairwellY = Number.isFinite(savedRun.stairwellY) ? savedRun.stairwellY : stairwellY;
  floorTimeLeft = Number.isFinite(savedRun.floorTimeLeft) ? savedRun.floorTimeLeft : floorTimeLeft;
  if (savedRun.floorPressure && typeof restoreFloorPressureState === "function") restoreFloorPressureState(savedRun.floorPressure);
  player.x = savedRun.playerPosition?.x || savedRun.player.x || player.x;
  player.y = savedRun.playerPosition?.y || savedRun.player.y || player.y;
  player.safe = !!savedRun.player.safe;
  player.wasSafe = !!savedRun.player.safe;
  runStatus = savedRun.runStatus || RUN_STATUS.ACTIVE;
  updateVisibility(true);
  updateHUD();
  if (typeof updateInventoryUI === "function") updateInventoryUI();
  showCrawlerReturnStatus(savedRun);
  saveCrawlerRun("restore");
  return true;
}

function restoreCrawlerRunState(saved = loadCrawlerRun()) { return restorePersistentCrawlerRun(saved); }

function saveCrawlerRun(reason = "checkpoint", forcedStatus = null) {
  if (gameMode === GAME_MODES.TITLE && !forcedStatus) return runStatus;
  const status = forcedStatus || getCrawlerPreservationStatus();
  runStatus = status;
  try { localStorage.setItem(CRAWLER_RUN_STORAGE_KEY, JSON.stringify(capturePersistentCrawlerRun(status, reason))); } catch {}
  return status;
}

function saveCrawlerRunState(status = getCrawlerPreservationStatus(), reason = "checkpoint") { return saveCrawlerRun(reason, status); }
function saveRunForAppBackground() { return saveCrawlerRun("app_backgrounded"); }
function exposeCrawlerOnLeave() { return saveCrawlerRun("app_hidden_or_closed"); }
function saveCrawlerRunCheckpoint(reason = "checkpoint") { return saveCrawlerRun(reason); }

function loadCrawlerRun() {
  try { return JSON.parse(localStorage.getItem(CRAWLER_RUN_STORAGE_KEY) || "null"); } catch { return null; }
}

function loadCrawlerRunState() { return loadCrawlerRun(); }

function clearSavedCrawlerRun() {
  try { localStorage.removeItem(CRAWLER_RUN_STORAGE_KEY); } catch {}
  runStatus = RUN_STATUS.NOT_STARTED;
  renderRunLifecycleTitlePanel();
}

function clearCrawlerRunState() { return clearSavedCrawlerRun(); }

function shouldOfferResumeCrawler() {
  const saved = loadCrawlerRun();
  return !!saved && saved.runStatus !== RUN_STATUS.NOT_STARTED;
}

function runLifecycleReturnMessage(status, floor = currentFloor) {
  return {
    preserved_at_stairs: "Crawler preserved at stairwell. Ready to descend.",
    preserved_in_safe_room: "Crawler preserved in safe room. The dungeon resumes your suffering.",
    exposed_floor0: "Crawler was left exposed on Floor 0. Stairwell access is required for survival.",
    exposed: "Crawler was left exposed outside a protected zone.",
    dead: "Crawler died. The dungeon noticed.",
    descended: "Crawler descended. The dungeon has updated its disappointment schedule.",
    active: Number(floor) === 0 ? "Crawler active on Floor 0. Find the stairwell before leaving." : "Crawler active. Reach stairs or a safe room before leaving."
  }[status] || "Crawler run state loaded.";
}

function showCrawlerReturnStatus(savedRun = loadCrawlerRun()) {
  if (!savedRun) return;
  const message = runLifecycleReturnMessage(savedRun.runStatus, savedRun.currentFloor);
  if (typeof announcer === "function" && gameMode !== GAME_MODES.TITLE) announcer(message);
  return message;
}

function bindRunLifecycleDevButtons() {
  document.getElementById("devSaveCurrentRunBtn")?.addEventListener("click", () => { saveCrawlerRun("dev_manual_save", gameMode === GAME_MODES.TITLE ? RUN_STATUS.NOT_STARTED : null); renderRunLifecycleTitlePanel(); });
  document.getElementById("devClearSavedRunBtn")?.addEventListener("click", clearSavedCrawlerRun);
  document.getElementById("devForceExposedBtn")?.addEventListener("click", () => { saveCrawlerRun("dev_force_exposed", currentFloor === 0 ? RUN_STATUS.EXPOSED_FLOOR0 : RUN_STATUS.EXPOSED); renderRunLifecycleTitlePanel(); });
  document.getElementById("devForcePreservedStairsBtn")?.addEventListener("click", () => { saveCrawlerRun("dev_force_preserved_at_stairs", RUN_STATUS.PRESERVED_AT_STAIRS); renderRunLifecycleTitlePanel(); });
  document.getElementById("devForcePreservedSafeBtn")?.addEventListener("click", () => { saveCrawlerRun("dev_force_preserved_in_safe_room", RUN_STATUS.PRESERVED_IN_SAFE_ROOM); renderRunLifecycleTitlePanel(); });
}

function renderRunLifecycleTitlePanel() {
  const actions = document.querySelector("#titleScreen .titleActions");
  if (!actions) return;
  let panel = document.getElementById("runLifecyclePanel");
  if (!panel) { panel = document.createElement("div"); panel.id = "runLifecyclePanel"; actions.before(panel); }
  const saved = loadCrawlerRun();
  if (!saved) {
    panel.innerHTML = `<div class="runLifecycleTitle">No preserved crawler</div><div class="runLifecycleActions"><button id="devSaveCurrentRunBtn" type="button">Save Current Run</button><button id="devClearSavedRunBtn" type="button">Clear Saved Run</button><button id="devForceExposedBtn" type="button">Force Exposed</button><button id="devForcePreservedStairsBtn" type="button">Force Preserved at Stairs</button><button id="devForcePreservedSafeBtn" type="button">Force Preserved in Safe Room</button></div>`;
    bindRunLifecycleDevButtons();
    return;
  }
  const when = saved.savedAt ? new Date(saved.savedAt).toLocaleString() : "unknown time";
  panel.innerHTML = `<div class="runLifecycleTitle">${runLifecycleReturnMessage(saved.runStatus, saved.currentFloor)}</div><div class="runLifecycleMeta">Floor ${saved.currentFloor ?? 0} · ${saved.reason || "saved"} · ${when}</div><div class="runLifecycleActions"><button id="resumeCrawlerBtn" type="button">Load Saved Run</button><button id="devSaveCurrentRunBtn" type="button">Save Current Run</button><button id="devLoadSavedRunBtn" type="button">Load Saved Run</button><button id="devClearSavedRunBtn" type="button">Clear Saved Run</button><button id="devForceExposedBtn" type="button">Force Exposed</button><button id="devForcePreservedStairsBtn" type="button">Force Preserved at Stairs</button><button id="devForcePreservedSafeBtn" type="button">Force Preserved in Safe Room</button></div>`;
  document.getElementById("resumeCrawlerBtn")?.addEventListener("click", () => restorePersistentCrawlerRun(saved));
  document.getElementById("devLoadSavedRunBtn")?.addEventListener("click", () => restorePersistentCrawlerRun(loadCrawlerRun()));
  bindRunLifecycleDevButtons();
}

function wrapLifecycleCheckpoint(name, reason) {
  const original = window[name] || globalThis[name];
  if (typeof original !== "function") return;
  globalThis[name] = function lifecycleWrappedFunction() {
    const result = original.apply(this, arguments);
    saveCrawlerRunCheckpoint(reason);
    return result;
  };
}

(function installRunLifecycle() {
  startSinglePlayer = function startSinglePlayerWithLifecycle(original) {
    return function wrappedStartSinglePlayer() {
      const result = original.apply(this, arguments);
      runStatus = RUN_STATUS.ACTIVE;
      saveCrawlerRun("run_started", RUN_STATUS.EXPOSED_FLOOR0);
      return result;
    };
  }(startSinglePlayer);
  loseGame = function loseGameWithLifecycle(original) {
    return function wrappedLoseGame() {
      runStatus = RUN_STATUS.DEAD;
      saveCrawlerRun("death", RUN_STATUS.DEAD);
      return original.apply(this, arguments);
    };
  }(loseGame);
  advanceToNextFloor = function advanceToNextFloorWithLifecycle(original) {
    return function wrappedAdvanceToNextFloor() {
      const result = original.apply(this, arguments);
      runStatus = RUN_STATUS.DESCENDED;
      saveCrawlerRun("floor_transition", RUN_STATUS.DESCENDED);
      return result;
    };
  }(advanceToNextFloor);
  showTitleScreen = function showTitleScreenWithLifecycle(original) {
    return function wrappedShowTitleScreen() {
      const result = original.apply(this, arguments);
      renderRunLifecycleTitlePanel();
      return result;
    };
  }(showTitleScreen);
  wrapLifecycleCheckpoint("equipItem", "equipment_changed");
  wrapLifecycleCheckpoint("unequipItem", "equipment_changed");
  wrapLifecycleCheckpoint("dropEquippedItem", "equipment_changed");
  wrapLifecycleCheckpoint("discardItem", "inventory_changed");
  wrapLifecycleCheckpoint("openLootBox", "loot_pickup");
  window.addEventListener("pagehide", exposeCrawlerOnLeave);
  window.addEventListener("beforeunload", exposeCrawlerOnLeave);
  document.addEventListener("visibilitychange", () => { if (document.hidden) exposeCrawlerOnLeave(); });
  document.addEventListener("DOMContentLoaded", renderRunLifecycleTitlePanel, { once: true });
  setInterval(() => { if (gameMode !== GAME_MODES.TITLE && !gameLost) saveCrawlerRunCheckpoint("periodic_autosave"); }, RUN_LIFECYCLE_INTERVAL_MS);
})();
