const RUN_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  FLOOR0_ACTIVE: "floor0_active",
  FLOOR0_STAIRS_REACHED: "floor0_stairs_reached",
  PRESERVED_AT_STAIRS: "preserved_at_stairs",
  PRESERVED_IN_SAFE_ROOM: "preserved_in_safe_room",
  EXPOSED: "exposed",
  EXPOSED_FLOOR0: "exposed_floor0",
  DEAD: "dead",
  DESCENDED: "descended"
});

const CRAWLER_RUN_STORAGE_KEY = "dcwz_crawlerRunState";
let runStatus = RUN_STATUS.NOT_STARTED;

function isPlayerAtStairwell() {
  if (!Array.isArray(map) || !player) return false;
  const x = Math.floor(player.x / TILE);
  const y = Math.floor(player.y / TILE);
  if (map[y]?.[x] === "E") return true;
  return Number.isFinite(stairwellX) && Number.isFinite(stairwellY) && Math.abs(x - stairwellX) <= 1 && Math.abs(y - stairwellY) <= 1;
}

function getAutoPreserveStatus() {
  if (gameLost) return RUN_STATUS.DEAD;
  const atStairs = isPlayerAtStairwell();
  const inSafeRoom = player?.safe === true;
  if (currentFloor === 0) {
    if (atStairs) return RUN_STATUS.PRESERVED_AT_STAIRS;
    return RUN_STATUS.EXPOSED_FLOOR0;
  }
  if (atStairs) return RUN_STATUS.PRESERVED_AT_STAIRS;
  if (inSafeRoom) return RUN_STATUS.PRESERVED_IN_SAFE_ROOM;
  return RUN_STATUS.EXPOSED;
}

function updateRunLifecycleStatus(nextStatus = null) {
  if (nextStatus && Object.values(RUN_STATUS).includes(nextStatus)) {
    runStatus = nextStatus;
    return runStatus;
  }
  if (gameLost) runStatus = RUN_STATUS.DEAD;
  else if (currentFloor === 0) runStatus = isPlayerAtStairwell() ? RUN_STATUS.FLOOR0_STAIRS_REACHED : RUN_STATUS.FLOOR0_ACTIVE;
  else if (isPlayerAtStairwell()) runStatus = RUN_STATUS.PRESERVED_AT_STAIRS;
  else if (player?.safe) runStatus = RUN_STATUS.PRESERVED_IN_SAFE_ROOM;
  else runStatus = RUN_STATUS.EXPOSED;
  return runStatus;
}

function makeCrawlerRunSave(status = updateRunLifecycleStatus()) {
  const snapshot = typeof captureRunProgress === "function" ? captureRunProgress() : null;
  return {
    version: 1,
    currentFloor,
    player: snapshot?.player || null,
    coins: player?.coins || 0,
    inventory: snapshot?.player?.inventory || [],
    equipment: snapshot?.player?.equipment || {},
    currentWeaponId: player?.currentWeaponId || "fists",
    pet: snapshot?.player?.pet || player?.pet || null,
    progression: snapshot?.player?.progression || player?.progression || null,
    audienceScore,
    achievements: Array.isArray(snapshot?.achievements) ? snapshot.achievements : Array.from(achievements || []),
    history: snapshot?.achievementHistory || achievementHistory || [],
    stats: snapshot?.stats || { ...stats },
    stairwellFound: !!stairwellFound,
    playerSafe: !!player?.safe,
    runStatus: status,
    autoPreserveStatus: status,
    savedAt: Date.now(),
    floorTimeLeft,
    collapseStarted: !!collapseStarted,
    playerPosition: { x: player?.x || 0, y: player?.y || 0 }
  };
}

function saveCrawlerRunState(status = updateRunLifecycleStatus()) {
  try { localStorage.setItem(CRAWLER_RUN_STORAGE_KEY, JSON.stringify(makeCrawlerRunSave(status))); } catch {}
  return status;
}

function saveRunForAppBackground() {
  if (gameMode === GAME_MODES.TITLE || gameLost) return runStatus;
  runStatus = getAutoPreserveStatus();
  return saveCrawlerRunState(runStatus);
}

function saveCrawlerRunCheckpoint(reason = "checkpoint") {
  if (gameMode === GAME_MODES.TITLE || gameLost) return runStatus;
  const status = updateRunLifecycleStatus();
  saveCrawlerRunState(status);
  return status;
}

function loadCrawlerRunState() {
  try { return JSON.parse(localStorage.getItem(CRAWLER_RUN_STORAGE_KEY) || "null"); } catch { return null; }
}

function clearCrawlerRunState() {
  try { localStorage.removeItem(CRAWLER_RUN_STORAGE_KEY); } catch {}
  runStatus = RUN_STATUS.NOT_STARTED;
  renderRunLifecycleTitlePanel();
}

function restoreCrawlerRunState(saved = loadCrawlerRunState()) {
  if (!saved?.player) return false;
  resetMultiplayerState();
  setGameMode(GAME_MODES.SINGLE_PLAYER);
  hideTitleScreen();
  resetState({ preserveRun: true, snapshot: { player: saved.player, stats: saved.stats || {}, audienceScore: saved.audienceScore || 10, achievementHistory: saved.history || [], achievements: saved.achievements || [] }, targetFloor: saved.currentFloor || 0 });
  currentFloor = Number(saved.currentFloor) || 0;
  stairwellFound = !!saved.stairwellFound;
  floorTimeLeft = Number.isFinite(saved.floorTimeLeft) ? saved.floorTimeLeft : floorTimeLeft;
  if (saved.playerPosition) { player.x = saved.playerPosition.x || player.x; player.y = saved.playerPosition.y || player.y; }
  runStatus = saved.runStatus || updateRunLifecycleStatus();
  updateHUD();
  announcer(runLifecycleReturnMessage(runStatus, currentFloor));
  saveCrawlerRunState(runStatus);
  return true;
}

function runLifecycleReturnMessage(status, floor = currentFloor, saved = null) {
  if (status === RUN_STATUS.EXPOSED_FLOOR0 && saved?.playerSafe) return "Crawler was sheltered, but not cleared. Floor 0 survival requires stairwell entry.";
  if (status === RUN_STATUS.EXPOSED_FLOOR0) return "Crawler left exposed. The dungeon does not offer refunds.";
  return {
    preserved_at_stairs: Number(floor) === 0 ? "Crawler preserved at stairwell. Floor 1 access authorized." : "Crawler preserved at stairwell. Ready to descend.",
    preserved_in_safe_room: "Crawler preserved in safe room. The dungeon resumes your suffering.",
    exposed: "Crawler left exposed. The dungeon does not offer refunds.",
    dead: "Crawler died on Floor 0. The dungeon appreciates your brief participation.",
    descended: "Crawler descended. The dungeon has updated its disappointment schedule."
  }[status] || "Crawler run state loaded.";
}

function simulateAppCloseForDev() {
  const status = saveRunForAppBackground();
  announcer(runLifecycleReturnMessage(status));
  renderRunLifecycleTitlePanel();
  return status;
}

function exposeCrawlerOnLeave() {
  return saveRunForAppBackground();
}

function renderRunLifecycleTitlePanel() {
  const actions = document.querySelector("#titleScreen .titleActions");
  if (!actions) return;
  let panel = document.getElementById("runLifecyclePanel");
  if (!panel) { panel = document.createElement("div"); panel.id = "runLifecyclePanel"; actions.before(panel); }
  const saved = loadCrawlerRunState();
  if (!saved) { panel.innerHTML = `<div class="runLifecycleTitle">No preserved crawler</div>`; return; }
  const canResume = [RUN_STATUS.PRESERVED_AT_STAIRS, RUN_STATUS.PRESERVED_IN_SAFE_ROOM, RUN_STATUS.EXPOSED, RUN_STATUS.EXPOSED_FLOOR0, RUN_STATUS.DESCENDED, RUN_STATUS.FLOOR0_ACTIVE, RUN_STATUS.FLOOR0_STAIRS_REACHED].includes(saved.runStatus);
  const primaryLabel = saved.runStatus === RUN_STATUS.DEAD ? "View Obituary" : ([RUN_STATUS.EXPOSED, RUN_STATUS.EXPOSED_FLOOR0].includes(saved.runStatus) ? "Resume Exposed Crawler" : "Resume Crawler");
  panel.innerHTML = `<div class="runLifecycleTitle">${runLifecycleReturnMessage(saved.runStatus, saved.currentFloor, saved)}</div><div class="runLifecycleMeta">Floor ${saved.currentFloor} · saved ${new Date(saved.savedAt).toLocaleString()}</div><div class="runLifecycleActions"><button id="resumeCrawlerBtn" type="button">${primaryLabel}</button><button id="forceExposedBtn" type="button">Force Exposed</button><button id="forcePreservedBtn" type="button">Force Preserved</button><button id="forceDeadBtn" type="button">Force Dead</button><button id="simulateAppCloseBtn" type="button">Simulate App Close</button><button id="clearSavedRunBtn" type="button">Clear Saved Run</button></div>`;
  document.getElementById("resumeCrawlerBtn")?.addEventListener("click", () => {
    if (canResume) restoreCrawlerRunState(saved);
    else showCenter("Crawler Obituary", runLifecycleReturnMessage(RUN_STATUS.DEAD), "Clear Saved Run", clearCrawlerRunState);
  });
  document.getElementById("forceExposedBtn")?.addEventListener("click", () => { saveCrawlerRunState(RUN_STATUS.EXPOSED); renderRunLifecycleTitlePanel(); });
  document.getElementById("forcePreservedBtn")?.addEventListener("click", () => { saveCrawlerRunState(RUN_STATUS.PRESERVED_AT_STAIRS); renderRunLifecycleTitlePanel(); });
  document.getElementById("forceDeadBtn")?.addEventListener("click", () => { saveCrawlerRunState(RUN_STATUS.DEAD); renderRunLifecycleTitlePanel(); });
  document.getElementById("simulateAppCloseBtn")?.addEventListener("click", () => { simulateAppCloseForDev(); });
  document.getElementById("clearSavedRunBtn")?.addEventListener("click", clearCrawlerRunState);
}

(function installRunLifecycle() {
  const originalStartSinglePlayer = startSinglePlayer;
  startSinglePlayer = function startSinglePlayerWithLifecycle() { const result = originalStartSinglePlayer.apply(this, arguments); runStatus = updateRunLifecycleStatus(); saveCrawlerRunState(runStatus); return result; };
  const originalLoseGame = loseGame;
  loseGame = function loseGameWithLifecycle() { runStatus = RUN_STATUS.DEAD; saveCrawlerRunState(runStatus); return originalLoseGame.apply(this, arguments); };
  const originalAdvanceToNextFloor = advanceToNextFloor;
  advanceToNextFloor = function advanceToNextFloorWithLifecycle() { const result = originalAdvanceToNextFloor.apply(this, arguments); runStatus = RUN_STATUS.DESCENDED; saveCrawlerRunState(runStatus); return result; };
  const originalShowTitleScreen = showTitleScreen;
  showTitleScreen = function showTitleScreenWithLifecycle() { const result = originalShowTitleScreen.apply(this, arguments); renderRunLifecycleTitlePanel(); return result; };
  window.addEventListener("pagehide", exposeCrawlerOnLeave);
  window.addEventListener("beforeunload", exposeCrawlerOnLeave);
  document.addEventListener("visibilitychange", () => { if (document.hidden) exposeCrawlerOnLeave(); });
  document.addEventListener("DOMContentLoaded", () => { renderRunLifecycleTitlePanel(); }, { once: true });
  setInterval(() => { if (gameMode !== GAME_MODES.TITLE && !gameLost) saveCrawlerRunCheckpoint("interval"); }, 5000);
})();
