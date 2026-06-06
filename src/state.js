
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE = 32;
const MAP_ROWS = 80;
const MAP_COLS = 110;
const VIEW_RADIUS = 9;
const MEMORY_RADIUS = 12;

let map, seen, visible, rooms, enemies, corpses, openedChests, achievements, achievementHistory, activePopups;
let dungeonVisuals = { floor: [], decals: [] };
let environmentalLights = [];
let lightingEnabled = true;
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
  baseSpeed:2.45, defense:0, audienceBonus:0, inventory:[], equipment:{weapon:null,body:null,offhand:null,trinket:null},
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
  const equippedWeapon = player.equipment?.weapon;
  if (equippedWeapon?.weaponId && WEAPON_DEFINITIONS[equippedWeapon.weaponId]) {
    const base = WEAPON_DEFINITIONS[equippedWeapon.weaponId];
    const stats = typeof getItemStats === "function" ? getItemStats(equippedWeapon) : (equippedWeapon.stats || {});
    return {
      ...base,
      name: equippedWeapon.name || base.name,
      damage: stats.damage || base.damage,
      range: stats.range || base.range,
      cooldown: stats.cooldown || base.cooldown
    };
  }
  return WEAPON_DEFINITIONS.fists;
}

function getHeldWeaponItems() {
  const weapons = [];
  if (player.equipment?.weapon) weapons.push(player.equipment.weapon);
  for (const item of player.inventory || []) if (item.type === "weapon" && item.weaponId) weapons.push(item);
  return weapons;
}

function setPlayerWeapon(weaponId, announce = true) {
  if (!WEAPON_DEFINITIONS[weaponId]) return;

  if (weaponId === "fists") {
    const old = player.equipment?.weapon;
    if (old) player.inventory.push(old);
    player.equipment.weapon = null;
    player.currentWeaponId = "fists";
  } else if (player.equipment?.weapon?.weaponId !== weaponId) {
    const idx = player.inventory.findIndex(item => item.type === "weapon" && item.weaponId === weaponId);
    if (idx < 0) {
      if (announce && typeof announcer === "function") announcer("Weapon not owned. The dungeon refuses to honor imaginary equipment, despite admiring the confidence.");
      return;
    }
    const [item] = player.inventory.splice(idx, 1);
    const old = player.equipment.weapon;
    player.equipment.weapon = item;
    if (old) player.inventory.push(old);
    player.currentWeaponId = weaponId;
  }

  player.attackCooldown = Math.min(player.attackCooldown, Math.ceil(getCurrentWeapon().cooldown * 0.35));
  if (typeof recalcEquipmentStats === "function") recalcEquipmentStats();
  if (announce && typeof announcer === "function") announcer(`Weapon readied: ${getCurrentWeapon().name}.`);
  if (typeof updateInventoryUI === "function") updateInventoryUI();
  if (typeof updateHUD === "function") updateHUD();
}

function cyclePlayerWeapon(direction = 1) {
  const held = getHeldWeaponItems();
  const ids = ["fists", ...held.map(item => item.weaponId).filter((id, index, arr) => id && arr.indexOf(id) === index)];
  const currentId = player.equipment?.weapon?.weaponId || "fists";
  const currentIndex = Math.max(0, ids.indexOf(currentId));
  const nextIndex = (currentIndex + direction + ids.length) % ids.length;
  setPlayerWeapon(ids[nextIndex]);
}

function updatePlayerAim(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len <= 0.12) return;
  player.aimX = dx / len;
  player.aimY = dy / len;
}

const keys = {};
const gamepadState = { connected: false, name: "", moveX: 0, moveY: 0, aimX: 0, aimY: 0, hasAimInput: false, previousButtons: [] };
const touchState = { moveX: 0, moveY: 0, activeTouchId: null, baseX: 0, baseY: 0 };
const GAMEPAD_DEADZONE = 0.22;
