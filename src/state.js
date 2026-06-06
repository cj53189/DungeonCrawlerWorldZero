
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE = 32;
const MAP_ROWS = 80;
const MAP_COLS = 110;
const VIEW_RADIUS = 9;
const MEMORY_RADIUS = 12;

let map, seen, visible, rooms, enemies, corpses, openedChests, achievements, achievementHistory, activePopups;
let projectiles = [], attackTelegraphs = [];
let bossRoom=null,bossEnemy=null,currentRoomName="Safe Room";
let currentFloor = 0, stairwellFound = false, stairwellX = null, stairwellY = null, finalDescentAnnounced = false;
let bossLockTiles = [];
let bossAggroed = false;
let bossDoorsLocked = false;
let pendingBossLocks = [];
let pendingFloorAdvance = false;
let minimapCanvas=document.createElement("canvas"),minimapCtx=minimapCanvas.getContext("2d"),minimapDirty=true,minimapLastScale=null;
let lastVisibilityTileX=null,lastVisibilityTileY=null,visibilityDirty=true;
let roomRevealState = { roomId: null, startFrame: 0, originX: 0, originY: 0, maxDist: 0, complete: false };
let gameWon, gameLost, frameCount, floorTimeLeft, collapseStarted;
let warnedAt360, warnedAt240, warnedAt120, warnedAt60, warnedAt30;
let lastObservationFrame, audienceScore, currentReputation, roomsSeen;

const MAX_ACTIVE_POPUPS = 2;
const POPUP_LIFETIME_MS = 7800;
const OBSERVATION_INTERVAL_FRAMES = 60 * 25;

const WEAPON_DEFINITIONS = {
  fists: {
    id: "fists",
    name: "Fists",
    damage: 12,
    range: 38,
    cooldown: 18,
    attackShape: { type: "circle", radius: 38 },
    telegraphColor: "rgba(255,255,255,0.52)"
  },
  greatsword: {
    id: "greatsword",
    name: "Greatsword",
    damage: 24,
    range: 78,
    cooldown: 34,
    attackShape: { type: "arc", radius: 78, angle: Math.PI * 0.72 },
    telegraphColor: "rgba(145,205,255,0.56)"
  },
  hammer: {
    id: "hammer",
    name: "Hammer",
    damage: 40,
    range: 46,
    cooldown: 58,
    attackShape: { type: "circle", radius: 46 },
    telegraphColor: "rgba(255,190,90,0.58)"
  },
  spear: {
    id: "spear",
    name: "Spear",
    damage: 22,
    range: 118,
    cooldown: 30,
    attackShape: { type: "line", length: 118, width: 20 },
    telegraphColor: "rgba(155,255,175,0.58)"
  },
  bow: {
    id: "bow",
    name: "Bow",
    damage: 20,
    range: 320,
    cooldown: 42,
    attackShape: { type: "projectile", speed: 7.5, radius: 4 },
    telegraphColor: "rgba(255,240,135,0.62)"
  }
};
const WEAPON_ORDER = ["fists", "greatsword", "hammer", "spear", "bow"];

const player = {
  x: TILE * 2.5, y: TILE * 2.5, r: 11, speed: 2.45,
  hp: 100, maxHp: 100, coins: 0,
  level: 1, xp: 0, xpToNext: 40, attackDamage: 20,
  baseSpeed:2.45, defense:0, audienceBonus:0, inventory:[], equipment:{},
  attackCooldown: 0, currentWeaponId: "fists", aimX: 1, aimY: 0,
  safe: true, wasSafe: true, currentRoomId:null, lastTileX:0, lastTileY:0
};

const stats = {
  doorsOpened: 0, chestsOpened: 0, enemiesKilled: 0, damageTaken: 0,
  missedAttacks: 0, wallBumps: 0, interactionsWithNothing: 0,
  timeInSafeRoomFrames: 0, timeOutsideSafeRoomFrames: 0, potshotsFromAI: 0,
  riskyMoments: 0, safeRoomEntries: 0, exitFinds: 0, floorRooms: 0, lootBoxesFound:0, lootBoxesOpened:0, gearFound:0, bossesDefeated:0
};

function getCurrentWeapon() {
  return WEAPON_DEFINITIONS[player.currentWeaponId] || WEAPON_DEFINITIONS.fists;
}

function setPlayerWeapon(weaponId, announce = true) {
  if (!WEAPON_DEFINITIONS[weaponId]) return;
  player.currentWeaponId = weaponId;
  player.attackCooldown = Math.min(player.attackCooldown, Math.ceil(getCurrentWeapon().cooldown * 0.35));
  if (announce && typeof announcer === "function") announcer(`Weapon readied: ${getCurrentWeapon().name}.`);
  if (typeof updateHUD === "function") updateHUD();
}

function cyclePlayerWeapon(direction = 1) {
  const currentIndex = Math.max(0, WEAPON_ORDER.indexOf(player.currentWeaponId));
  const nextIndex = (currentIndex + direction + WEAPON_ORDER.length) % WEAPON_ORDER.length;
  setPlayerWeapon(WEAPON_ORDER[nextIndex]);
}

function updatePlayerAim(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len <= 0.12) return;
  player.aimX = dx / len;
  player.aimY = dy / len;
}

const keys = {};
const gamepadState = { connected: false, name: "", moveX: 0, moveY: 0, previousButtons: [] };
const touchState = { moveX: 0, moveY: 0, activeTouchId: null, baseX: 0, baseY: 0 };
const GAMEPAD_DEADZONE = 0.22;
