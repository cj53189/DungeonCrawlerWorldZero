
function getFloorTimeLimit() {
  // Prototype timing. Later floors get shorter, matching the book's pressure curve.
  return Math.max(300, 600 - currentFloor * 60);
}

function getFloorLabel() {
  return `Floor ${currentFloor}`;
}

function isFinalDescentWindow() {
  return floorTimeLeft <= 60;
}

function resetFloorTimerForCurrentFloor() {
  floorTimeLeft = getFloorTimeLimit();
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
  player.inventory = typeof generateStarterTorch === "function" ? [generateStarterTorch()] : [];
  player.equipment = {head:null,chest:null,legs:null,feet:null,accessory:null,light:null};
  player.coins = 0;
  player.attackCooldown = 0;
  player.currentWeaponId = "fists";
  player.aimX = 1;
  player.aimY = 0;
  currentFloor = 0;
  pendingFloorAdvance = false;
}


function resetState(options = {}) {
  const preserveRun = !!options.preserveRun;
  const snapshot = options.snapshot || null;

  if (!preserveRun) {
    resetRunProgress();
  }
  enemies = [];
  corpses = [];
  dungeonVisuals = { floor: [], decals: [] };
  environmentalLights = [];
  projectiles = [];
  attackTelegraphs = [];
  openedChests = new Set();
  if (!preserveRun) {
    achievements = new Set();
    achievementHistory = [];
  }
  activePopups = [];

  gameWon = false; gameLost = false; frameCount = 0;
  resetFloorTimerForCurrentFloor();
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
    player.inventory = typeof generateStarterTorch === "function" ? [generateStarterTorch()] : [];
    player.equipment = {head:null,chest:null,legs:null,feet:null,accessory:null,light:null};
    }
  player.currentRoomId = null;
  player.lastTileX = 0;
  player.lastTileY = 0;
  bossRoom=null; bossEnemy=null; currentRoomName="Safe Room";
  stairwellFound=false; stairwellX=null; stairwellY=null;
  minimapDirty=true;
  visibilityDirty=true;
  lastVisibilityTileX=null;
  lastVisibilityTileY=null;
  roomRevealState = { roomId: null, startFrame: 0, originX: 0, originY: 0, maxDist: 0, complete: false };
  player.attackCooldown = 0;
  projectiles = [];
  attackTelegraphs = [];
  player.safe = true;
  player.wasSafe = true;

  if (!preserveRun) for (const key of Object.keys(stats)) stats[key] = 0;

  document.getElementById("announcer").innerHTML = "";
  document.getElementById("centerMessage").style.display = "none";
  document.getElementById("logPanel").style.display = "none";
  const invPanel=document.getElementById("inventoryPanel"); if(invPanel) invPanel.style.display="none";
  hideSafeRoomRecap();

  generateDungeon();

  if (preserveRun && snapshot) restoreRunProgress(snapshot);

  updateVisibility(true);
  updateHUD();
  updateLightingToggleLabel();
  renderLog();

  achievement(`NEW FLOOR: ${getFloorLabel()}`, `This floor contains ${rooms.length} rooms. The dungeon has provided a generous supply of places to make mistakes.`, `startFloor${currentFloor}`);
}


