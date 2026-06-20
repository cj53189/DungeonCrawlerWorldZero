const RUN_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  FLOOR0_ACTIVE: "floor0_active",
  FLOOR0_STAIRS_REACHED: "floor0_stairs_reached",
  PRESERVED_AT_STAIRS: "preserved_at_stairs",
  PRESERVED_IN_SAFE_ROOM: "preserved_in_safe_room",
  EXPOSED: "exposed",
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

function updateRunLifecycleStatus(nextStatus = null) {
  if (nextStatus && Object.values(RUN_STATUS).includes(nextStatus)) {
    runStatus = nextStatus;
    return runStatus;
  }
  if (gameLost) runStatus = RUN_STATUS.DEAD;
  else if (currentFloor === 0) runStatus = (stairwellFound || isPlayerAtStairwell()) ? RUN_STATUS.FLOOR0_STAIRS_REACHED : RUN_STATUS.FLOOR0_ACTIVE;
  else if (player?.safe) runStatus = RUN_STATUS.PRESERVED_IN_SAFE_ROOM;
  else if (isPlayerAtStairwell()) runStatus = RUN_STATUS.PRESERVED_AT_STAIRS;
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
  announcer(runLifecycleReturnMessage(runStatus));
  saveCrawlerRunState(runStatus);
  return true;
}

function runLifecycleReturnMessage(status) {
  return {
    preserved_at_stairs: "Crawler preserved at stairwell. Ready to descend.",
    preserved_in_safe_room: "Crawler survived in safe room.",
    exposed: "Crawler was exposed when the floor collapsed. Warning only for now; automatic death is not enabled.",
    dead: "Crawler died on Floor 0. The dungeon appreciates your brief participation.",
    descended: "Crawler descended. The dungeon has updated its disappointment schedule."
  }[status] || "Crawler run state loaded.";
}

function preserveCrawler() {
  const atStairs = isPlayerAtStairwell() || stairwellFound;
  let status;
  let message;
  if (currentFloor === 0 && atStairs) { status = RUN_STATUS.PRESERVED_AT_STAIRS; message = "Crawler preserved at stairwell."; }
  else if (currentFloor === 0) { status = RUN_STATUS.EXPOSED; message = "Crawler left exposed. Reach stairs to survive Floor 0."; }
  else if (player.safe) { status = RUN_STATUS.PRESERVED_IN_SAFE_ROOM; message = "Crawler preserved in safe room."; }
  else if (atStairs) { status = RUN_STATUS.PRESERVED_AT_STAIRS; message = "Crawler preserved at stairwell."; }
  else { status = RUN_STATUS.EXPOSED; message = "Crawler exposed."; }
  runStatus = status;
  saveCrawlerRunState(status);
  announcer(message);
  setGameMode(GAME_MODES.TITLE);
  document.getElementById("centerMessage").style.display = "none";
  showTitleScreen();
  return status;
}

function exposeCrawlerOnLeave() {
  if (gameMode === GAME_MODES.TITLE || gameLost) return;
  const status = (player?.safe && currentFloor > 0) ? RUN_STATUS.PRESERVED_IN_SAFE_ROOM : ((isPlayerAtStairwell() || stairwellFound) ? RUN_STATUS.PRESERVED_AT_STAIRS : RUN_STATUS.EXPOSED);
  saveCrawlerRunState(status);
}

function renderRunLifecycleTitlePanel() {
  const actions = document.querySelector("#titleScreen .titleActions");
  if (!actions) return;
  let panel = document.getElementById("runLifecyclePanel");
  if (!panel) { panel = document.createElement("div"); panel.id = "runLifecyclePanel"; actions.before(panel); }
  const saved = loadCrawlerRunState();
  if (!saved) { panel.innerHTML = `<div class="runLifecycleTitle">No preserved crawler</div>`; return; }
  const canResume = [RUN_STATUS.PRESERVED_AT_STAIRS, RUN_STATUS.PRESERVED_IN_SAFE_ROOM, RUN_STATUS.EXPOSED, RUN_STATUS.DESCENDED, RUN_STATUS.FLOOR0_ACTIVE, RUN_STATUS.FLOOR0_STAIRS_REACHED].includes(saved.runStatus);
  const primaryLabel = saved.runStatus === RUN_STATUS.DEAD ? "View Obituary" : (saved.runStatus === RUN_STATUS.EXPOSED ? "Resume Exposed Crawler" : "Resume Crawler");
  panel.innerHTML = `<div class="runLifecycleTitle">${runLifecycleReturnMessage(saved.runStatus)}</div><div class="runLifecycleMeta">Floor ${saved.currentFloor} · saved ${new Date(saved.savedAt).toLocaleString()}</div><div class="runLifecycleActions"><button id="resumeCrawlerBtn" type="button">${primaryLabel}</button><button id="forceExposedBtn" type="button">Force Exposed</button><button id="forcePreservedBtn" type="button">Force Preserved</button><button id="forceDeadBtn" type="button">Force Dead</button><button id="clearSavedRunBtn" type="button">Clear Saved Run</button></div>`;
  document.getElementById("resumeCrawlerBtn")?.addEventListener("click", () => {
    if (canResume) restoreCrawlerRunState(saved);
    else showCenter("Crawler Obituary", runLifecycleReturnMessage(RUN_STATUS.DEAD), "Clear Saved Run", clearCrawlerRunState);
  });
  document.getElementById("forceExposedBtn")?.addEventListener("click", () => { saveCrawlerRunState(RUN_STATUS.EXPOSED); renderRunLifecycleTitlePanel(); });
  document.getElementById("forcePreservedBtn")?.addEventListener("click", () => { saveCrawlerRunState(RUN_STATUS.PRESERVED_AT_STAIRS); renderRunLifecycleTitlePanel(); });
  document.getElementById("forceDeadBtn")?.addEventListener("click", () => { saveCrawlerRunState(RUN_STATUS.DEAD); renderRunLifecycleTitlePanel(); });
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
  window.addEventListener("beforeunload", exposeCrawlerOnLeave);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") exposeCrawlerOnLeave(); });
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.createElement("button");
    btn.id = "preserveCrawlerBtn";
    btn.className = "preserveCrawlerBtn";
    btn.type = "button";
    btn.textContent = "Preserve Crawler";
    btn.addEventListener("click", preserveCrawler);
    document.body.appendChild(btn);
    renderRunLifecycleTitlePanel();
  }, { once: true });
  setInterval(() => { if (gameMode !== GAME_MODES.TITLE && !gameLost) saveCrawlerRunState(updateRunLifecycleStatus()); }, 5000);
})();
