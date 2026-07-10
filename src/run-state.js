
const DUNGEON_DAY_SECONDS = 24 * 60 * 60;
const FINAL_DESCENT_WINDOW_SECONDS = 60 * 60;

function getDungeonDayDurationSeconds() { return DUNGEON_DAY_SECONDS; }

function getFloorDurationDays(floor = currentFloor) {
  const floorNumber = Math.max(0, Math.trunc(Number(floor) || 0));
  const blueprintDays = Number(window.FLOOR_IDENTITY_BLUEPRINTS?.[floorNumber]?.durationDays);
  if (Number.isFinite(blueprintDays) && blueprintDays > 0) return Math.trunc(blueprintDays);
  return ({ 0: 1, 1: 5, 2: 6, 3: 7, 4: 7 })[floorNumber] || 1;
}

function getFloorTimeLimit(floor = currentFloor) {
  return getFloorDurationDays(floor) * DUNGEON_DAY_SECONDS;
}

function makeFloorTimeline(floor = currentFloor, startedAt = Date.now()) {
  const durationDays = getFloorDurationDays(floor);
  return {
    version: 1,
    floor: Math.max(0, Math.trunc(Number(floor) || 0)),
    durationDays,
    floorStartedAt: startedAt,
    floorDeadlineAt: startedAt + durationDays * DUNGEON_DAY_SECONDS * 1000,
    lastProcessedDay: 1
  };
}

function syncFloorTimeFromTimeline(now = Date.now()) {
  if (!floorTimeline || floorTimeline.floor !== currentFloor || !Number.isFinite(floorTimeline.floorDeadlineAt)) {
    floorTimeline = makeFloorTimeline(currentFloor, now);
  }
  floorTimeLeft = Math.max(0, Math.ceil((floorTimeline.floorDeadlineAt - now) / 1000));
  return floorTimeLeft;
}

function getCurrentDungeonDay(now = Date.now()) {
  if (!floorTimeline || !Number.isFinite(floorTimeline.floorStartedAt)) return 1;
  const elapsed = Math.max(0, now - floorTimeline.floorStartedAt);
  return Math.min(getFloorDurationDays(currentFloor), Math.floor(elapsed / (DUNGEON_DAY_SECONDS * 1000)) + 1);
}

function getFloorLabel() {
  return `Floor ${currentFloor}`;
}

function isFinalDescentWindow() {
  return floorTimeLeft <= FINAL_DESCENT_WINDOW_SECONDS;
}

function resetFloorTimerForCurrentFloor() {
  floorTimeline = makeFloorTimeline(currentFloor);
  floorTimeLeft = getFloorTimeLimit(currentFloor);
  collapseStarted = false;
  warnedAt360 = false;
  warnedAt240 = false;
  warnedAt120 = false;
  warnedAt60 = false;
  warnedAt30 = false;
  finalDescentAnnounced = false;
}


function resetRunProgress() {
  player.level = 1;
  player.xp = 0;
  player.xpToNext = 40;
  player.maxHp = 100;
  player.hp = player.maxHp;
  player.attackDamage = 20;
  player.baseSpeed = 2.45;
  player.speed = player.baseSpeed;
  player.defense = 0;
  player.audienceBonus = 0;
  player.inventory = [];
  player.equipment = {weapon:null,head:null,chest:null,legs:null,feet:null,accessory:null,light:typeof generateTorchItem === "function" ? generateTorchItem() : null,pet:null};
  if (typeof resetPetState === "function") resetPetState();
  player.coins = 0;
  player.attackCooldown = 0;
  player.pvpFreezeFrames = 0;
  player.pvpKills = 0;
  player.knockbackX = 0;
  player.knockbackY = 0;
  player.knockbackFrames = 0;
  player.knockbackUntil = 0;
  resetPlayerDodgeState();
  player.currentWeaponId = "fists";
  if (typeof initProgression === "function") initProgression({ reset: true, skipLoad: true });
  player.aimX = 1;
  player.aimY = 0;
  currentFloor = 0;
  pendingFloorAdvance = false;
}

function ensureStatsShape() {
  if (!stats || typeof stats !== "object") return;
  if (!Number.isFinite(stats.namedRoomsEntered)) stats.namedRoomsEntered = 0;
  for (const key of ["corpsesCreated", "corpsesConsumed", "grubsSpawned", "grubsFed", "grubsPupated", "vespasEmerged"]) {
    if (!Number.isFinite(stats[key])) stats[key] = 0;
  }
}


function resetState(options = {}) {
  if (typeof resetTransientInputState === "function") resetTransientInputState();
  if (typeof setActiveInventoryCategory === "function") setActiveInventoryCategory("gear");
  const preserveRun = !!options.preserveRun;
  if (Object.prototype.hasOwnProperty.call(options, "arena")) multiplayer.arena = !!options.arena;
  const snapshot = options.snapshot || null;
  const targetFloor = Number(options.targetFloor);
  const hasTargetFloor = Number.isFinite(targetFloor);

  if (!preserveRun) {
    resetRunProgress();
  }
  if (hasTargetFloor) {
    currentFloor = Math.trunc(targetFloor);
  }
  enemies = [];
  corpses = [];
  if (typeof resetFloorEcology === "function") resetFloorEcology();
  dungeonVisuals = { floor: [], decals: [] };
  tutorialSigns = [];
  petMerchant = null;
  environmentalLights = [];
  projectiles = [];
  attackTelegraphs = [];
  floatingFeedbackTexts = [];
  dodgeAfterimages = [];
  dodgePuffs = [];
  openedChests = new Set();
  if (!preserveRun) {
    achievements = new Set();
    achievementHistory = [];
  }
  activePopups = [];

  gameWon = false; gameLost = false; frameCount = 0;
  resetFloorTimerForCurrentFloor();
  if (typeof stopMusicState === "function") stopMusicState(MUSIC_STATES.COLLAPSE);
  lastObservationFrame = 0;
  audienceScore = 10; currentReputation = "Undeclared Menace"; roomsSeen = 0;

  if (!preserveRun) {
    player.level = 1;
    player.xp = 0;
    player.xpToNext = 40;
    player.maxHp = 100;
    player.hp = player.maxHp;
    player.attackDamage = 20;
    player.baseSpeed = 2.45;
    player.speed = player.baseSpeed;
    player.defense = 0;
    player.audienceBonus = 0;
    player.inventory = [];
    player.equipment = {weapon:null,head:null,chest:null,legs:null,feet:null,accessory:null,light:typeof generateTorchItem === "function" ? generateTorchItem() : null,pet:null};
  if (typeof resetPetState === "function") resetPetState();
    if (typeof initProgression === "function") initProgression({ reset: true, skipLoad: true });
    }
  player.currentRoomId = null;
  player.lastTileX = 0;
  player.lastTileY = 0;
  bossRoom=null; bossEnemy=null; currentRoomName="Safe Room"; currentRoomSubtitle="";
  stairwellFound=false; stairwellX=null; stairwellY=null;
  minimapDirty=true;
  visibilityDirty=true;
  lastVisibilityTileX=null;
  lastVisibilityTileY=null;
  roomRevealState = { roomId: null, startFrame: 0, originX: 0, originY: 0, maxDist: 0, complete: false };
  player.attackCooldown = 0;
  player.pvpFreezeFrames = 0;
  player.pvpKills = 0;
  player.knockbackX = 0;
  player.knockbackY = 0;
  player.knockbackFrames = 0;
  player.knockbackUntil = 0;
  resetPlayerDodgeState();
  projectiles = [];
  attackTelegraphs = [];
  floatingFeedbackTexts = [];
  dodgeAfterimages = [];
  dodgePuffs = [];
  player.safe = true;
  player.wasSafe = true;

  ensureStatsShape();
  if (!preserveRun) for (const key of Object.keys(stats)) stats[key] = 0;

  document.getElementById("announcer").innerHTML = "";
  document.getElementById("centerMessage").style.display = "none";
  document.getElementById("logPanel").style.display = "none";
  const invPanel=document.getElementById("inventoryPanel"); if(invPanel){invPanel.classList.remove("open"); invPanel.style.display="";} document.body.classList.remove("inventoryOpen");
  if (typeof closeProgressionPanel === "function") closeProgressionPanel();
  closeLootWindow();
  hideSafeRoomRecap();
  if (typeof hidePetMerchantPanel === "function") hidePetMerchantPanel();

  generateDungeon();

  if (preserveRun && snapshot) restoreRunProgress(snapshot);

  updateVisibility(true);
  updateHUD();
  updateLightingToggleLabel();
  renderLog();

  achievement(`NEW FLOOR: ${getFloorLabel()}`, `This floor contains ${rooms.length} rooms. The dungeon has provided a generous supply of places to make mistakes.`, `startFloor${currentFloor}`);
}
