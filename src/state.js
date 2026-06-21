
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE = 32;
const MAP_ROWS = 80;
const MAP_COLS = 110;
const VIEW_RADIUS = 9;
const MEMORY_RADIUS = 12;

let map, seen, visible, rooms, enemies, corpses, openedChests, achievements, achievementHistory, activePopups, floatingFeedbackTexts;
let dodgeAfterimages = [], dodgePuffs = [];
let tutorialSigns = [], seenTutorialSignIds = new Set();
let petMerchant = null;
let activeLootCorpseId = null;
let dungeonVisuals = { floor: [], decals: [] };
let environmentalLights = [];
let lightingEnabled = true;
const PERFORMANCE_MODE_STORAGE_KEY = "dcw.performanceMode.v1";
let performanceMode = (() => {
  try { return localStorage.getItem(PERFORMANCE_MODE_STORAGE_KEY) === "true"; }
  catch { return false; }
})();
let frameTimingSamples = [];
let frameTimingSlowSince = 0;
let frameTimingSuggestionShown = false;
let projectiles = [], attackTelegraphs = [];
let bossRoom=null,bossEnemy=null,currentRoomName="Safe Room",currentRoomSubtitle="";
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

const GAME_MODES = {
  TITLE: "title",
  SINGLE_PLAYER: "single_player",
  MULTIPLAYER_FLOOR0: "multiplayer_floor0",
  MULTIPLAYER_MATCHMAKING: "multiplayer_matchmaking",
  MULTIPLAYER_ACTIVE: "multiplayer_active",
  MULTIPLAYER_STASIS: "multiplayer_stasis"
};

const MULTIPLAYER_TARGET_PLAYERS = 4;
const PVP_SAFE_ROOM_FREEZE_SECONDS = 5;
const PVP_SAFE_ROOM_FREEZE_FRAMES = 60 * PVP_SAFE_ROOM_FREEZE_SECONDS;

let gameMode = GAME_MODES.TITLE;

const PLAYER_PROFILE_STORAGE_KEY = "dcwz_playerProfile";
const DEFAULT_CHARACTER_ID = "player_base";
const CHARACTER_DEFS = Object.freeze({
  player_base: Object.freeze({
    id: "player_base",
    label: "Classic Crawler",
    mode: "baked",
    image: "./assets/sprites/player_base.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    rows: 4,
    idleFrame: 1,
    directionRows: Object.freeze({ down: 0, up: 1, left: 2, right: 3 }),
    renderWidth: 34,
    renderHeight: 42,
    supportsSkinColor: false,
    supportsHairColor: false,
    supportsHair: false
  }),
  armored_crawler: Object.freeze({
    id: "armored_crawler",
    label: "Armored Crawler",
    mode: "baked",
    image: "./assets/sprites/other_crawler_armored_52x52.png",
    frameWidth: 52,
    frameHeight: 52,
    columns: 3,
    rows: 5,
    idleFrame: 1,
    directionRows: Object.freeze({ down: 0, up: 1, left: 3, right: 4 }),
    renderWidth: 38,
    renderHeight: 38,
    previewScale: 1.2,
    supportsSkinColor: false,
    supportsHairColor: false,
    supportsHair: false
  })
});
const DEFAULT_PLAYER_PROFILE = Object.freeze({
  name: "Crawler",
  characterId: "custom_layered",
  appearance: DEFAULT_APPEARANCE
});

function getCharacterDef(characterId) {
  if (String(characterId || "") === "custom_layered" && typeof getCustomCharacterDef === "function") return getCustomCharacterDef();
  return CHARACTER_DEFS[String(characterId || DEFAULT_CHARACTER_ID)] || CHARACTER_DEFS[DEFAULT_CHARACTER_ID];
}

function sanitizePlayerName(name) {
  const cleaned = String(name ?? "").trim().slice(0, 16);
  return cleaned || DEFAULT_PLAYER_PROFILE.name;
}

function sanitizePlayerProfile(profile = {}) {
  const requestedCharacterId = profile.characterId || profile.sprite || DEFAULT_PLAYER_PROFILE.characterId;
  const layeredRequested = String(requestedCharacterId) === "custom_layered";
  const character = layeredRequested && typeof getCustomCharacterDef === "function" ? getCustomCharacterDef() : getCharacterDef(requestedCharacterId);
  return {
    name: sanitizePlayerName(profile.name),
    characterId: character.id,
    appearance: typeof sanitizeAppearance === "function" ? sanitizeAppearance(profile.appearance || DEFAULT_APPEARANCE) : (profile.appearance || DEFAULT_APPEARANCE)
  };
}

function readPlayerProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY) || "null");
    return sanitizePlayerProfile(saved || DEFAULT_PLAYER_PROFILE);
  } catch {
    return sanitizePlayerProfile(DEFAULT_PLAYER_PROFILE);
  }
}

function writePlayerProfile(profile) {
  const sanitized = sanitizePlayerProfile(profile);
  try { localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(sanitized)); } catch {}
  playerProfile = sanitized;
  return sanitized;
}

let playerProfile = readPlayerProfile();

const multiplayer = {
  enabled: false,
  targetPlayers: MULTIPLAYER_TARGET_PLAYERS,
  playerId: "local_crawler",
  lobbyCode: null,
  partyCode: null, // Backward-compatible alias for private lobby join codes.
  roomId: null,
  status: "offline",
  partyId: null,
  lobbyMembers: [],
  partyMembers: [],
  remotePlayers: new Map(),
  pvpEnabled: false,
  floorStartedAt: null,
  collapseAt: null,
  isPartyLeader: false,
  stagingEndsAt: null,
  floor0Metadata: null,
  activeFloor0Seed: null,
  currentRunId: null,
  currentFloorSeed: null,
  currentJoinState: "open",
  usingServer: false,
  networkStatus: "offline",
  networkError: null,
  floor0Resolved: null,
  localFloor0Status: "exploring",
  floor0WorldState: {
    openedDoorIds: new Set(),
    openedChestIds: new Set(),
    takenLootIds: new Set(),
    enemyStates: new Map()
  },
  mode: null,
  arena: false
};

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
const LOOTABLE_WEAPON_IDS = WEAPON_ORDER.filter(id => id !== "fists");

const player = {
  x: TILE * 2.5, y: TILE * 2.5, r: 11, speed: 2.45,
  hp: 100, maxHp: 100, coins: 0,
  level: 1, xp: 0, xpToNext: 40, attackDamage: 20,
  baseSpeed:2.45, defense:0, audienceBonus:0, inventory:[], equipment:{}, pet:null,
  attackCooldown: 0, pvpFreezeFrames: 0, currentWeaponId: "fists", aimX: 1, aimY: 0,
  safe: true, wasSafe: true, currentRoomId:null, lastTileX:0, lastTileY:0,
  dodgeCooldown: 0, dodgeFrames: 0, dodgeMaxFrames: 0, dodgeInvulnFrames: 0,
  dodgeDirX: 0, dodgeDirY: 0, dodgeVisualFrame: 0, dodgeFlashFrames: 0
};

const stats = {
  doorsOpened: 0, chestsOpened: 0, enemiesKilled: 0, damageTaken: 0,
  missedAttacks: 0, wallBumps: 0, interactionsWithNothing: 0,
  timeInSafeRoomFrames: 0, timeOutsideSafeRoomFrames: 0, potshotsFromAI: 0,
  riskyMoments: 0, safeRoomEntries: 0, exitFinds: 0, floorRooms: 0, lootBoxesFound:0, lootBoxesOpened:0, gearFound:0, bossesDefeated:0
};

function normalizeWeaponItem(item) {
  if (!item || item.type !== "weapon") return null;
  const base = WEAPON_DEFINITIONS[item.weaponId] || WEAPON_DEFINITIONS.fists;
  return {
    ...base,
    itemId: item.id,
    rarity: item.rarity || "Common",
    name: item.name || base.name,
    damage: item.damage ?? base.damage,
    range: item.range ?? base.range,
    cooldown: item.cooldown ?? base.cooldown,
    telegraphColor: item.telegraphColor || base.telegraphColor
  };
}

function getCurrentWeapon() {
  const equippedWeapon = normalizeWeaponItem(player.equipment?.weapon);
  return equippedWeapon || WEAPON_DEFINITIONS.fists;
}

function setPlayerWeapon(weaponId, announce = true) {
  if (weaponId === "fists") {
    if (player.equipment?.weapon && typeof unequipItem === "function") unequipItem("weapon", announce);
    else { player.currentWeaponId = "fists"; if (announce && typeof announcer === "function") announcer("Weapon readied: Fists."); }
    if (typeof updateHUD === "function") updateHUD();
    return;
  }

  const idx = player.inventory.findIndex(item => item.type === "weapon" && item.weaponId === weaponId);
  if (idx >= 0 && typeof equipItem === "function") {
    equipItem(player.inventory[idx].id);
    return;
  }

  if (player.equipment?.weapon?.weaponId === weaponId) {
    player.currentWeaponId = weaponId;
    player.attackCooldown = Math.min(player.attackCooldown, Math.ceil(getCurrentWeapon().cooldown * 0.35));
    if (announce && typeof announcer === "function") announcer(`Weapon readied: ${getCurrentWeapon().name}.`);
    if (typeof updateHUD === "function") updateHUD();
    return;
  }

  if (announce && typeof announcer === "function") announcer("You do not have that weapon. Loot something pointy first.");
}

function cyclePlayerWeapon(direction = 1) {
  const equipped = player.equipment?.weapon;
  if (equipped) setPlayerWeapon("fists");
  else {
    const firstWeapon = player.inventory.find(item => item.type === "weapon");
    if (firstWeapon) equipItem(firstWeapon.id);
    else setPlayerWeapon("fists");
  }
}

function updatePlayerAim(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len <= 0.12) return;
  player.aimX = dx / len;
  player.aimY = dy / len;
}

const keys = {};
const inputState = { lastActiveInputMethod: null, lastTouchAt: 0, touchControlsEnabled: false, mouseWorldX: null, mouseWorldY: null, mouseClientX: null, mouseClientY: null, mouseAimActive: false, mouseOverCanvas: false, mouseAttackActive: false, shiftDodgeHeld: false };
const gamepadState = { connected: false, name: "", moveX: 0, moveY: 0, aimX: 0, aimY: 0, hasAimInput: false, previousButtons: [] };
const touchState = {
  moveX: 0,
  moveY: 0,
  activeTouchId: null,
  attackTouchId: null,
  attackActive: false,
  attackX: 0,
  attackY: 0,
  baseX: 0,
  baseY: 0
};
const GAMEPAD_DEADZONE = 0.22;
