
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE = 32;
const MAP_ROWS = 80;
const MAP_COLS = 110;
const VIEW_RADIUS = 9;
const MEMORY_RADIUS = 12;

let map, seen, visible, rooms, enemies, corpses, openedChests, achievements, achievementHistory, activePopups;
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

const player = {
  x: TILE * 2.5, y: TILE * 2.5, r: 11, speed: 2.45,
  hp: 100, maxHp: 100, coins: 0,
  level: 1, xp: 0, xpToNext: 40, attackDamage: 20,
  baseSpeed:2.45, defense:0, audienceBonus:0, inventory:[], equipment:{},
  attackCooldown: 0, safe: true, wasSafe: true, currentRoomId:null, lastTileX:0, lastTileY:0
};

const stats = {
  doorsOpened: 0, chestsOpened: 0, enemiesKilled: 0, damageTaken: 0,
  missedAttacks: 0, wallBumps: 0, interactionsWithNothing: 0,
  timeInSafeRoomFrames: 0, timeOutsideSafeRoomFrames: 0, potshotsFromAI: 0,
  riskyMoments: 0, safeRoomEntries: 0, exitFinds: 0, floorRooms: 0, lootBoxesFound:0, lootBoxesOpened:0, gearFound:0, bossesDefeated:0
};

const keys = {};
const gamepadState = { connected: false, name: "", moveX: 0, moveY: 0, previousButtons: [] };
const touchState = { moveX: 0, moveY: 0, activeTouchId: null, baseX: 0, baseY: 0 };
const GAMEPAD_DEADZONE = 0.22;
