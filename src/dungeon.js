function generateDungeon() {
  const seed = getSharedFloor0Seed();
  if (!seed) return generateDungeonLayout();
  return withSeededRandom(seed, generateDungeonLayout);
}

function getSharedFloor0Seed() {
  if (!multiplayer?.enabled || !multiplayer.usingServer || currentFloor !== 0) return null;
  return multiplayer.floor0Metadata?.seed || null;
}

function hashDungeonSeed(seed) {
  let hash = 2166136261;
  for (const char of String(seed || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = hashDungeonSeed(seed) || 0x9e3779b9;
  return function seededRandom() {
    state = Math.imul(state + 0x6D2B79F5, 1);
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withSeededRandom(seed, fn) {
  const originalRandom = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

function generateDungeonLayout() {
  map = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill("#"));
  seen = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(false));
  visible = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(false));
  rooms = [];

  const targetRooms = 34 + Math.floor(Math.random() * 18);
  let attempts = 0;

  while (rooms.length < targetRooms && attempts < 2200) {
    attempts++;
    const roomRoll = Math.random();
    let w, h, sizeClass, forcedBossCandidate = false;

    // First room becomes the safe room, so keep it small.
    if (rooms.length === 0) {
      w = 7 + Math.floor(Math.random() * 5);
      h = 6 + Math.floor(Math.random() * 4);
      sizeClass = "small";
    }

    // Second accepted room is intentionally boss-sized.
    // The boss chamber is a required ingredient now, not a lucky accident.
    else if (rooms.length === 1) {
      w = 22 + Math.floor(Math.random() * 9);
      h = 15 + Math.floor(Math.random() * 7);
      sizeClass = "large";
      forcedBossCandidate = true;
    }

    else if (roomRoll < 0.55) {
      w = 7 + Math.floor(Math.random() * 7);
      h = 6 + Math.floor(Math.random() * 6);
      sizeClass = "small";
    } else if (roomRoll < 0.88) {
      w = 12 + Math.floor(Math.random() * 8);
      h = 9 + Math.floor(Math.random() * 7);
      sizeClass = "medium";
    } else {
      w = 19 + Math.floor(Math.random() * 11);
      h = 13 + Math.floor(Math.random() * 9);
      sizeClass = "large";
    }
    const x = 2 + Math.floor(Math.random() * (MAP_COLS - w - 4));
    const y = 2 + Math.floor(Math.random() * (MAP_ROWS - h - 4));
    const room = createRoom({ id: rooms.length, x, y, w, h, sizeClass, forcedBossCandidate });
    if (rooms.some(r => rectsOverlap(expandRect(room, 2), r))) continue;
    carveRoom(room, ".");
    if (rooms.length > 0) connectRooms(rooms[rooms.length - 1], room);
    rooms.push(room);
  }

  if (rooms.length < 8 || !rooms.some(r => r.forcedBossCandidate)) {
    generateDungeonLayout();
    return;
  }

  assignRoomThemesAndBoss();

  const startRoom = rooms[0];
  startRoom.type="safe"; startRoom.name="Safe Room"; startRoom.themeId="safeRoom"; startRoom.subtitle="A temporary mercy with walls."; startRoom.tutorialId="floor0_movement"; startRoom.tutorialMessage="Move through rooms with WASD, Arrow keys, or the left joystick.";
  carveRoom(startRoom, "S");

  cleanupBadDoors();

  const exitRoom = getFarthestRoom(startRoom, [bossRoom]);
  applyRoomTheme(exitRoom, FLOOR0_ROOM_THEMES.stairwell);
  map[exitRoom.cy][exitRoom.cx] = "E";
  stairwellX = exitRoom.cx;
  stairwellY = exitRoom.cy;

  const spawnRoom = chooseCrawlerSpawnRoom(startRoom);
  placeCrawlerInRoom(spawnRoom);
  placePetMerchantInSafeRoom(startRoom);

  placeObjects("C", Math.min(10, Math.max(4, Math.floor(rooms.length / 5))), [startRoom, exitRoom, bossRoom, spawnRoom]);
  placeFloor0StarterLoot([startRoom, exitRoom, bossRoom, spawnRoom]);
  const guaranteedEnemies = placeFloor0StarterEnemies([startRoom, bossRoom, spawnRoom], spawnRoom);
  placeEnemies(Math.max(0, Math.min(16, Math.max(6, Math.floor(rooms.length / 3))) - guaranteedEnemies), [startRoom, bossRoom, spawnRoom], spawnRoom);
  placeBossEnemy();
  assignStableFloor0EnemyIds();
  placeFloor0TutorialSigns(spawnRoom, exitRoom);
  buildDungeonVisuals();
  stats.floorRooms = rooms.length;
}

function placePetMerchantInSafeRoom(room) {
  petMerchant = null;
  if (currentFloor !== 1 || !room) return;
  const candidates = roomTileList(room, 1)
    .filter(tile => map[tile.y]?.[tile.x] === "S")
    .filter(tile => Math.hypot(tile.x + 0.5 - player.x / TILE, tile.y + 0.5 - player.y / TILE) > 1.4)
    .sort((a, b) => Math.hypot(a.x - room.cx, a.y - room.cy) - Math.hypot(b.x - room.cx, b.y - room.cy));
  const tile = candidates[0] || { x: room.cx, y: room.cy };
  petMerchant = {
    id: "floor1_pet_merchant", type: "pet_merchant",
    x: tile.x * TILE + TILE / 2, y: tile.y * TILE + TILE / 2, r: 13, floor: 1,
    options: [...PET_MERCHANT_OPTIONS]
  };
}

const FLOOR0_TUTORIAL_SIGN_DEFINITIONS = [
  { id: "floor0_sign_welcome", title: "Welcome Crawler", body: "Find the stairs before collapse." },
  { id: "floor0_sign_doors", title: "Doors", body: "Press E to interact." },
  { id: "floor0_sign_combat", title: "Combat", body: "Attack or become loot." },
  { id: "floor0_sign_loot", title: "Loot", body: "Better gear means longer survival." },
  { id: "floor0_sign_stairs", title: "Stairs", body: "Reach these before collapse." }
];

function placeFloor0TutorialSigns(spawnRoom, exitRoom) {
  tutorialSigns = [];
  if (currentFloor !== 0) return;

  ensureFloor0TutorialDoor();

  addTutorialSign(FLOOR0_TUTORIAL_SIGN_DEFINITIONS[0], {
    x: Math.floor(player.x / TILE),
    y: Math.floor(player.y / TILE)
  }, spawnRoom);

  const firstDoor = findNearestMapTile("D", player.x / TILE, player.y / TILE);
  if (firstDoor) addTutorialSign(FLOOR0_TUTORIAL_SIGN_DEFINITIONS[1], firstDoor, roomForTile(firstDoor.x, firstDoor.y));

  const firstEnemy = findNearestEnemy(player.x, player.y);
  if (firstEnemy) addTutorialSign(FLOOR0_TUTORIAL_SIGN_DEFINITIONS[2], {
    x: Math.floor(firstEnemy.x / TILE),
    y: Math.floor(firstEnemy.y / TILE)
  }, rooms.find(room => room.id === firstEnemy.roomId) || roomForTile(Math.floor(firstEnemy.x / TILE), Math.floor(firstEnemy.y / TILE)));

  const firstLoot = findNearestMapTile("C", player.x / TILE, player.y / TILE);
  if (firstLoot) addTutorialSign(FLOOR0_TUTORIAL_SIGN_DEFINITIONS[3], firstLoot, roomForTile(firstLoot.x, firstLoot.y));

  if (stairwellX !== null && stairwellY !== null) {
    addTutorialSign(FLOOR0_TUTORIAL_SIGN_DEFINITIONS[4], { x: stairwellX, y: stairwellY }, exitRoom);
  }
}


function ensureFloor0TutorialDoor() {
  if (findNearestMapTile("D", player.x / TILE, player.y / TILE)) return;

  let best = null;
  let bestDist = Infinity;
  for (let y = 1; y < MAP_ROWS - 1; y++) {
    for (let x = 1; x < MAP_COLS - 1; x++) {
      if (!isValidDoorSpot(x, y)) continue;
      const dist = Math.hypot(x - player.x / TILE, y - player.y / TILE);
      if (dist < bestDist) { best = { x, y }; bestDist = dist; }
    }
  }

  if (best) {
    map[best.y][best.x] = "D";
    cleanupBadDoors();
  }
}

function addTutorialSign(definition, target, room = null) {
  if (!definition || !target) return;
  const tile = chooseTutorialSignTile(target, room);
  if (!tile) return;
  if (tutorialSigns.some(sign => sign.x === tile.x && sign.y === tile.y)) return;
  tutorialSigns.push({ ...definition, x: tile.x, y: tile.y, radius: TILE * 1.85 });
}

function chooseTutorialSignTile(target, room = null) {
  const tx = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(target.x)));
  const ty = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(target.y)));
  let best = null;
  let bestScore = Infinity;

  for (let radius = 1; radius <= 5; radius++) {
    for (let y = ty - radius; y <= ty + radius; y++) {
      for (let x = tx - radius; x <= tx + radius; x++) {
        if (Math.abs(x - tx) !== radius && Math.abs(y - ty) !== radius) continue;
        if (!isValidTutorialSignTile(x, y, room)) continue;
        const score = Math.hypot(x - tx, y - ty) + Math.hypot(x - player.x / TILE, y - player.y / TILE) * 0.02;
        if (score < bestScore) { best = { x, y }; bestScore = score; }
      }
    }
    if (best) return best;
  }

  if (isValidTutorialSignTile(tx, ty, room)) return { x: tx, y: ty };
  return null;
}

function isValidTutorialSignTile(x, y, room = null) {
  if (!isInMapBounds(x, y)) return false;
  const tile = map[y]?.[x];
  if (!(tile === "." || tile === "S")) return false;
  if (room && !roomContainsTile(room, x, y) && roomForTile(x, y) !== room) return false;
  if (Math.hypot(x + 0.5 - player.x / TILE, y + 0.5 - player.y / TILE) < 0.75) return false;
  if (enemies.some(enemy => enemy.hp > 0 && Math.hypot(x + 0.5 - enemy.x / TILE, y + 0.5 - enemy.y / TILE) < 1.2)) return false;
  if (corpses.some(corpse => !corpse.looted && Math.hypot(x + 0.5 - corpse.x / TILE, y + 0.5 - corpse.y / TILE) < 1.2)) return false;
  return true;
}

function findNearestMapTile(tileType, fromX, fromY) {
  let best = null;
  let bestDist = Infinity;
  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      if (map[y]?.[x] !== tileType) continue;
      const dist = Math.hypot(x - fromX, y - fromY);
      if (dist < bestDist) { best = { x, y }; bestDist = dist; }
    }
  }
  return best;
}

function findNearestEnemy(fromX, fromY) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of enemies) {
    if (enemy.hp <= 0 || enemy.boss) continue;
    const dist = Math.hypot(enemy.x - fromX, enemy.y - fromY);
    if (dist < bestDist) { best = enemy; bestDist = dist; }
  }
  return best;
}

function expandRect(r, a) { return { x: r.x - a, y: r.y - a, w: r.w + a * 2, h: r.h + a * 2 }; }
function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

function createRoom({ id, x, y, w, h, sizeClass, forcedBossCandidate = false }) {
  const parts = createRoomParts(x, y, w, h, sizeClass, forcedBossCandidate, id === 0);
  const center = chooseRoomCenter({ x, y, w, h, parts });

  return {
    id,
    x,
    y,
    w,
    h,
    cx: center.x,
    cy: center.y,
    parts,
    shape: describeRoomShape(parts, forcedBossCandidate, id === 0),
    seen: false,
    sizeClass,
    name: null,
    themeId: null,
    subtitle: "",
    tutorialId: null,
    tutorialMessage: "",
    type: "normal",
    locked: false,
    cleared: false,
    forcedBossCandidate
  };
}

const FLOOR0_ROOM_THEMES = {
  ratNest: {
    id: "ratNest",
    name: "Rat Nest",
    subtitle: "The scratching never stops.",
    tutorialId: "floor0_attack",
    tutorialMessage: "Attack enemies to survive.",
    sizeWeights: { small: 5, medium: 2, large: 1 },
    lootBias: 0.8,
    enemies: [
      { name: "Small Rat", behaviorTag: "rat_swarm", r: 9, hp: 0.82, damage: 0.78, speed: 1.18, xp: 0.85 },
      { name: "Hungry Rat", behaviorTag: "rat_swarm", r: 11, hp: 1.0, damage: 1.05, speed: 1.06, xp: 1.0 },
      { name: "Giant Rat", behaviorTag: "rat_bruiser", r: 14, hp: 1.32, damage: 1.18, speed: 0.82, xp: 1.18 }
    ]
  },
  spiderDen: {
    id: "spiderDen",
    name: "Spider Den",
    subtitle: "Every web is load-bearing, apparently.",
    sizeWeights: { small: 4, medium: 3, large: 1 },
    lootBias: 0.55,
    enemies: [
      { name: "Cave Spider", behaviorTag: "spider_lunge", r: 10, hp: 0.9, damage: 0.9, speed: 1.18, xp: 0.95 },
      { name: "Venom Spider", behaviorTag: "spider_hit_and_run", r: 11, hp: 1.02, damage: 1.22, speed: 1.08, xp: 1.12 },
      { name: "Brood Spider", behaviorTag: "spider_lunge", r: 15, hp: 1.42, damage: 1.08, speed: 0.86, xp: 1.24 }
    ]
  },
  supplyCloset: {
    id: "supplyCloset",
    name: "Supply Closet",
    subtitle: "One crawler's trash is another crawler's starter gear.",
    tutorialId: "floor0_loot",
    tutorialMessage: "Press E to loot containers.",
    sizeWeights: { small: 5, medium: 2, large: 0.3 },
    lootBias: 2.8,
    enemies: [
      { name: "Small Rat", behaviorTag: "rat_swarm", r: 9, hp: 0.78, damage: 0.72, speed: 1.12, xp: 0.8 },
      { name: "Janitor Bot", behaviorTag: "bot_patrol", r: 12, hp: 1.08, damage: 0.88, speed: 0.78, xp: 1.0 }
    ]
  },
  maintenanceTunnel: {
    id: "maintenanceTunnel",
    name: "Maintenance Tunnel",
    subtitle: "The dungeon's plumbing has opinions.",
    tutorialId: "floor0_doors",
    tutorialMessage: "Press E near doors to open a path.",
    sizeWeights: { small: 3, medium: 4, large: 1 },
    lootBias: 0.9,
    enemies: [
      { name: "Janitor Bot", behaviorTag: "bot_patrol", r: 12, hp: 1.0, damage: 0.92, speed: 0.82, xp: 1.0 },
      { name: "Maintenance Guard", behaviorTag: "guard_bruiser", r: 13, hp: 1.16, damage: 1.08, speed: 0.9, xp: 1.12 },
      { name: "Security Drone", behaviorTag: "drone_skirmisher", r: 10, hp: 0.9, damage: 1.04, speed: 1.28, xp: 1.06 }
    ]
  },
  armory: {
    id: "armory",
    name: "Armory",
    subtitle: "Everything here has a handle and a grudge.",
    tutorialId: "floor0_equip",
    tutorialMessage: "Equip better gear from inventory.",
    sizeWeights: { small: 1, medium: 4, large: 2 },
    lootBias: 2.2,
    enemies: [
      { name: "Maintenance Guard", behaviorTag: "guard_bruiser", r: 13, hp: 1.2, damage: 1.12, speed: 0.92, xp: 1.14 },
      { name: "Security Drone", behaviorTag: "drone_skirmisher", r: 10, hp: 0.92, damage: 1.16, speed: 1.26, xp: 1.08 }
    ]
  },
  barracks: {
    id: "barracks",
    name: "Barracks",
    subtitle: "Somebody forgot to tell them the war ended.",
    sizeWeights: { small: 1, medium: 4, large: 3 },
    lootBias: 1.1,
    enemies: [
      { name: "Security Drone", behaviorTag: "drone_skirmisher", r: 10, hp: 0.95, damage: 1.12, speed: 1.28, xp: 1.08 },
      { name: "Janitor Bot", behaviorTag: "bot_patrol", r: 12, hp: 1.06, damage: 0.9, speed: 0.8, xp: 1.0 },
      { name: "Maintenance Guard", behaviorTag: "guard_bruiser", r: 14, hp: 1.28, damage: 1.18, speed: 0.88, xp: 1.2 }
    ]
  },
  storageRoom: {
    id: "storageRoom",
    name: "Storage Room",
    subtitle: "Crates stacked with total disregard for OSHA and destiny.",
    sizeWeights: { small: 2, medium: 4, large: 2 },
    lootBias: 1.8,
    enemies: [
      { name: "Hungry Rat", behaviorTag: "rat_swarm", r: 11, hp: 1.0, damage: 1.0, speed: 1.06, xp: 1.0 },
      { name: "Janitor Bot", behaviorTag: "bot_patrol", r: 12, hp: 1.05, damage: 0.92, speed: 0.78, xp: 1.0 }
    ]
  },
  floodedChamber: {
    id: "floodedChamber",
    name: "Flooded Chamber",
    subtitle: "The water is shallow. The consequences may not be.",
    sizeWeights: { small: 1, medium: 3, large: 4 },
    lootBias: 0.75,
    enemies: [
      { name: "Cave Spider", behaviorTag: "spider_lunge", r: 10, hp: 0.92, damage: 0.92, speed: 1.1, xp: 0.96 },
      { name: "Hungry Rat", behaviorTag: "rat_swarm", r: 11, hp: 1.0, damage: 1.0, speed: 1.02, xp: 1.0 },
      { name: "Giant Rat", behaviorTag: "rat_bruiser", r: 14, hp: 1.3, damage: 1.16, speed: 0.78, xp: 1.18 }
    ]
  },
  securityOffice: {
    id: "securityOffice",
    name: "Security Office",
    subtitle: "The monitors are dead. The paranoia is not.",
    sizeWeights: { small: 2, medium: 4, large: 1 },
    lootBias: 1.25,
    enemies: [
      { name: "Security Drone", behaviorTag: "drone_skirmisher", r: 10, hp: 0.96, damage: 1.18, speed: 1.3, xp: 1.1 },
      { name: "Maintenance Guard", behaviorTag: "guard_bruiser", r: 14, hp: 1.24, damage: 1.12, speed: 0.9, xp: 1.16 }
    ]
  },
  stairwell: {
    id: "stairwell",
    name: "Stairwell",
    subtitle: "Down is the only direction with a future.",
    tutorialId: "floor0_stairs",
    tutorialMessage: "The collapse timer is real. Reach the stairs before time expires.",
    sizeWeights: { small: 1, medium: 2, large: 3 },
    lootBias: 0.35,
    enemies: [
      { name: "Security Drone", behaviorTag: "drone_skirmisher", r: 10, hp: 0.92, damage: 1.08, speed: 1.26, xp: 1.05 },
      { name: "Maintenance Guard", behaviorTag: "guard_bruiser", r: 13, hp: 1.16, damage: 1.08, speed: 0.9, xp: 1.1 }
    ]
  }
};

const FLOOR0_REQUIRED_THEME_IDS = ["supplyCloset", "ratNest", "maintenanceTunnel", "armory"];

function roomThemeDefinition(room) {
  return FLOOR0_ROOM_THEMES[room?.themeId] || null;
}

function weightedThemeForRoom(room, avoidIds = new Set()) {
  const entries = Object.values(FLOOR0_ROOM_THEMES)
    .filter(theme => !avoidIds.has(theme.id) && theme.id !== "stairwell")
    .map(theme => ({ theme, weight: Math.max(0.1, theme.sizeWeights?.[room.sizeClass] ?? 1) }));
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.theme;
  }
  return entries[entries.length - 1]?.theme || FLOOR0_ROOM_THEMES.storageRoom;
}

function applyRoomTheme(room, theme) {
  if (!room || !theme) return;
  room.themeId = theme.id;
  room.name = theme.name;
  room.subtitle = theme.subtitle || "";
  room.tutorialId = theme.tutorialId || null;
  room.tutorialMessage = theme.tutorialMessage || "";
}

function createRoomParts(x, y, w, h, sizeClass, forcedBossCandidate, isSafeRoom) {
  const base = { x, y, w, h };

  // Safe rooms and boss candidates stay intentionally clean/conservative for gameplay clarity.
  if (isSafeRoom || forcedBossCandidate || sizeClass === "large") return [base];
  if (w < 9 || h < 8) return [base];

  const roll = Math.random();
  if (roll < 0.46) return [base];
  if (roll < 0.68) return createLRoomParts(x, y, w, h);
  if (roll < 0.82) return createAlcoveRoomParts(x, y, w, h);
  if (roll < 0.93) return createTRoomParts(x, y, w, h);
  return createCrossRoomParts(x, y, w, h);
}

function createLRoomParts(x, y, w, h) {
  const armW = Math.max(4, Math.floor(w * (0.48 + Math.random() * 0.18)));
  const armH = Math.max(4, Math.floor(h * (0.48 + Math.random() * 0.18)));
  const horizontalH = Math.max(4, h - Math.floor(h * (0.28 + Math.random() * 0.18)));
  const verticalW = Math.max(4, w - Math.floor(w * (0.28 + Math.random() * 0.18)));
  const right = Math.random() < 0.5;
  const bottom = Math.random() < 0.5;

  const horizontal = {
    x: right ? x + w - armW : x,
    y: bottom ? y + h - horizontalH : y,
    w: armW,
    h: horizontalH
  };
  const vertical = {
    x: right ? x + w - verticalW : x,
    y: bottom ? y + h - armH : y,
    w: verticalW,
    h: armH
  };

  return [horizontal, vertical];
}

function createAlcoveRoomParts(x, y, w, h) {
  const mainW = Math.max(6, Math.floor(w * (0.62 + Math.random() * 0.12)));
  const mainH = Math.max(5, Math.floor(h * (0.62 + Math.random() * 0.12)));
  const mainX = x + Math.floor((w - mainW) / 2);
  const mainY = y + Math.floor((h - mainH) / 2);
  const parts = [{ x: mainX, y: mainY, w: mainW, h: mainH }];
  const alcoves = 1 + Math.floor(Math.random() * 2);

  for (let i = 0; i < alcoves; i++) {
    const horizontal = Math.random() < 0.5;
    if (horizontal) {
      const aw = Math.max(3, Math.floor(w * (0.26 + Math.random() * 0.14)));
      const ah = Math.max(3, Math.min(mainH - 2, Math.floor(h * (0.34 + Math.random() * 0.18))));
      const onRight = Math.random() < 0.5;
      parts.push({
        x: onRight ? mainX + mainW - 1 : mainX - aw + 1,
        y: mainY + 1 + Math.floor(Math.random() * Math.max(1, mainH - ah - 1)),
        w: aw,
        h: ah
      });
    } else {
      const aw = Math.max(3, Math.min(mainW - 2, Math.floor(w * (0.34 + Math.random() * 0.18))));
      const ah = Math.max(3, Math.floor(h * (0.26 + Math.random() * 0.14)));
      const onBottom = Math.random() < 0.5;
      parts.push({
        x: mainX + 1 + Math.floor(Math.random() * Math.max(1, mainW - aw - 1)),
        y: onBottom ? mainY + mainH - 1 : mainY - ah + 1,
        w: aw,
        h: ah
      });
    }
  }

  return clampRoomParts(parts, x, y, w, h);
}

function createTRoomParts(x, y, w, h) {
  const horizontal = Math.random() < 0.5;
  if (horizontal) {
    const barH = Math.max(4, Math.floor(h * 0.45));
    const stemW = Math.max(4, Math.floor(w * (0.34 + Math.random() * 0.16)));
    const top = Math.random() < 0.5;
    return [
      { x, y: top ? y : y + h - barH, w, h: barH },
      { x: x + Math.floor((w - stemW) / 2), y: top ? y + barH - 1 : y, w: stemW, h: h - barH + 1 }
    ];
  }

  const barW = Math.max(4, Math.floor(w * 0.45));
  const stemH = Math.max(4, Math.floor(h * (0.34 + Math.random() * 0.16)));
  const left = Math.random() < 0.5;
  return [
    { x: left ? x : x + w - barW, y, w: barW, h },
    { x: left ? x + barW - 1 : x, y: y + Math.floor((h - stemH) / 2), w: w - barW + 1, h: stemH }
  ];
}

function createCrossRoomParts(x, y, w, h) {
  const centerW = Math.max(4, Math.floor(w * (0.42 + Math.random() * 0.12)));
  const centerH = Math.max(4, Math.floor(h * (0.42 + Math.random() * 0.12)));
  return [
    { x: x + Math.floor((w - centerW) / 2), y, w: centerW, h },
    { x, y: y + Math.floor((h - centerH) / 2), w, h: centerH }
  ];
}

function clampRoomParts(parts, boundsX, boundsY, boundsW, boundsH) {
  return parts.map(part => {
    const px = Math.max(boundsX, Math.min(boundsX + boundsW - 1, part.x));
    const py = Math.max(boundsY, Math.min(boundsY + boundsH - 1, part.y));
    return {
      x: px,
      y: py,
      w: Math.max(1, Math.min(part.w, boundsX + boundsW - px)),
      h: Math.max(1, Math.min(part.h, boundsY + boundsH - py))
    };
  });
}

function describeRoomShape(parts, forcedBossCandidate, isSafeRoom) {
  if (isSafeRoom) return "safe";
  if (forcedBossCandidate) return "bossArena";
  if (!parts || parts.length <= 1) return "rectangle";
  if (parts.length >= 3) return "alcove";
  const [a, b] = parts;
  if (a.w === b.w || a.h === b.h) return "compound";
  return "composite";
}

function roomParts(room) {
  return room?.parts?.length ? room.parts : [{ x: room.x, y: room.y, w: room.w, h: room.h }];
}

function roomContainsTile(room, x, y) {
  return roomParts(room).some(part => x >= part.x && x < part.x + part.w && y >= part.y && y < part.y + part.h);
}

function forEachRoomTile(room, visit) {
  const visited = new Set();
  for (const part of roomParts(room)) {
    for (let y = part.y; y < part.y + part.h; y++) {
      for (let x = part.x; x < part.x + part.w; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        visited.add(key);
        visit(x, y);
      }
    }
  }
}

function roomTileList(room, inset = 0) {
  const tiles = [];
  forEachRoomTile(room, (x, y) => {
    if (inset > 0) {
      let hasOutsideNeighbor = false;
      for (const n of [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }]) {
        if (!roomContainsTile(room, n.x, n.y)) {
          hasOutsideNeighbor = true;
          break;
        }
      }
      if (hasOutsideNeighbor) return;
    }
    tiles.push({ x, y });
  });
  return tiles;
}

function roomAdjacentTiles(room) {
  const tiles = [];
  const visited = new Set();

  forEachRoomTile(room, (x, y) => {
    for (const n of [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }]) {
      if (roomContainsTile(room, n.x, n.y)) continue;
      const key = `${n.x},${n.y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      tiles.push(n);
    }
  });

  return tiles;
}

function chooseRoomCenter(room) {
  const idealX = Math.floor(room.x + room.w / 2);
  const idealY = Math.floor(room.y + room.h / 2);
  const tiles = roomTileList(room);
  let best = tiles[0] || { x: idealX, y: idealY };
  let bestDist = Infinity;

  for (const t of tiles) {
    const d = Math.hypot(t.x - idealX, t.y - idealY);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }

  return best;
}

function chooseRandomRoomTile(room, preferredInset = 1) {
  const insetTiles = roomTileList(room, preferredInset).filter(t => map[t.y]?.[t.x] === ".");
  const tiles = insetTiles.length > 0 ? insetTiles : roomTileList(room).filter(t => map[t.y]?.[t.x] === ".");
  if (tiles.length === 0) return null;
  return tiles[Math.floor(Math.random() * tiles.length)];
}

function carveRoom(room, tile) {
  forEachRoomTile(room, (x, y) => {
    map[y][x] = tile;
  });
}

const CARDINAL_DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 }
];

function isInMapBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS;
}

function isRoomBoundaryTile(room, x, y) {
  if (!roomContainsTile(room, x, y)) return false;

  return CARDINAL_DIRECTIONS.some(dir =>
    !roomContainsTile(room, x + dir.dx, y + dir.dy)
  );
}

function isValidRoomEntranceCandidate(room, candidate) {
  if (!room || !candidate) return false;
  if (!isInMapBounds(candidate.x, candidate.y)) return false;
  if (!roomContainsTile(room, candidate.x, candidate.y)) return false;
  if (!isRoomBoundaryTile(room, candidate.x, candidate.y)) return false;
  if (!Number.isFinite(candidate.outX) || !Number.isFinite(candidate.outY)) return false;
  if (!isInMapBounds(candidate.outX, candidate.outY)) return false;
  if (roomContainsTile(room, candidate.outX, candidate.outY)) return false;
  return Math.abs(candidate.outX - candidate.x) + Math.abs(candidate.outY - candidate.y) === 1;
}

function chooseRoomEntranceToward(room, targetRoom) {
  const targetX = targetRoom?.cx ?? room.cx;
  const targetY = targetRoom?.cy ?? room.cy;
  const vx = Math.sign(targetX - room.cx);
  const vy = Math.sign(targetY - room.cy);
  const candidates = [];

  forEachRoomTile(room, (x, y) => {
    if (!isRoomBoundaryTile(room, x, y)) return;

    for (const dir of CARDINAL_DIRECTIONS) {
      const outX = x + dir.dx;
      const outY = y + dir.dy;
      if (!isInMapBounds(outX, outY)) continue;
      if (roomContainsTile(room, outX, outY)) continue;

      const facingScore = dir.dx * vx + dir.dy * vy;
      const targetDist = Math.hypot(x - targetX, y - targetY);
      const centerDist = Math.hypot(x - room.cx, y - room.cy);
      candidates.push({
        x,
        y,
        outX,
        outY,
        dx: dir.dx,
        dy: dir.dy,
        score: facingScore * 1000 - targetDist + centerDist * 0.05
      });
    }
  });

  const facingCandidates = candidates.filter(candidate => candidate.score > -900);
  const pool = facingCandidates.length > 0 ? facingCandidates : candidates;
  if (pool.length === 0) return null;

  pool.sort((a, b) => b.score - a.score);
  const bestScore = pool[0].score;
  const best = pool.filter(candidate => bestScore - candidate.score <= 3);
  const pick = best[Math.floor(Math.random() * best.length)];

  return isValidRoomEntranceCandidate(room, pick) ? pick : null;
}

function carveCorridorTile(x, y) {
  if (!isInMapBounds(x, y)) return;
  if (map[y][x] === "#") map[y][x] = ".";
}

function connectRooms(a, b) {
  const start = chooseRoomEntranceToward(a, b);
  const end = chooseRoomEntranceToward(b, a);

  if (!isValidRoomEntranceCandidate(a, start) || !isValidRoomEntranceCandidate(b, end)) {
    throw new Error("Unable to choose valid room boundary entrances for corridor");
  }

  carveCorridorTile(start.outX, start.outY);
  carveCorridorTile(end.outX, end.outY);

  if (Math.random() < 0.5) {
    carveHorizontal(start.outX, end.outX, start.outY);
    carveVertical(start.outY, end.outY, end.outX);
  }
  else {
    carveVertical(start.outY, end.outY, start.outX);
    carveHorizontal(start.outX, end.outX, end.outY);
  }

  maybePlaceDoorNear(start.x, start.y, end.x, end.y);
}

function carveHorizontal(x1, x2, y) { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carveCorridorTile(x, y); }
function carveVertical(y1, y2, x) { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carveCorridorTile(x, y); }

function isWalkableForDoor(tile) {
  return tile === "." || tile === "S" || tile === "C" || tile === "E" || tile === "D";
}

function isSolidForDoor(tile) {
  return tile === "#";
}

function hasDoorBypassAround(x, y, orientation) {
  if (orientation === "horizontal") {
    const topBypass = isWalkableForDoor(map[y - 1][x - 1]) && isWalkableForDoor(map[y - 1][x]) && isWalkableForDoor(map[y - 1][x + 1]);
    const bottomBypass = isWalkableForDoor(map[y + 1][x - 1]) && isWalkableForDoor(map[y + 1][x]) && isWalkableForDoor(map[y + 1][x + 1]);
    return topBypass || bottomBypass;
  }

  const leftBypass = isWalkableForDoor(map[y - 1][x - 1]) && isWalkableForDoor(map[y][x - 1]) && isWalkableForDoor(map[y + 1][x - 1]);
  const rightBypass = isWalkableForDoor(map[y - 1][x + 1]) && isWalkableForDoor(map[y][x + 1]) && isWalkableForDoor(map[y + 1][x + 1]);
  return leftBypass || rightBypass;
}

function isValidDoorSpot(x, y) {
  if (x <= 1 || y <= 1 || x >= MAP_COLS - 2 || y >= MAP_ROWS - 2) return false;
  if (map[y][x] !== ".") return false;

  const up = map[y - 1][x];
  const down = map[y + 1][x];
  const left = map[y][x - 1];
  const right = map[y][x + 1];

  const horizontalDoor =
    isSolidForDoor(up) &&
    isSolidForDoor(down) &&
    isWalkableForDoor(left) &&
    isWalkableForDoor(right);

  const verticalDoor =
    isSolidForDoor(left) &&
    isSolidForDoor(right) &&
    isWalkableForDoor(up) &&
    isWalkableForDoor(down);

  if (horizontalDoor) return !hasDoorBypassAround(x, y, "horizontal");
  if (verticalDoor) return !hasDoorBypassAround(x, y, "vertical");
  return false;
}

function cleanupBadDoors() {
  for (let y = 1; y < MAP_ROWS - 1; y++) {
    for (let x = 1; x < MAP_COLS - 1; x++) {
      if (map[y][x] === "D") {
        map[y][x] = ".";
        if (!isValidDoorSpot(x, y)) {
          map[y][x] = ".";
        } else {
          map[y][x] = "D";
        }
      }
    }
  }
}

function maybePlaceDoorNear(ax, ay, bx, by) {
  if (Math.random() > 0.45) return;

  const mx = Math.floor((ax + bx) / 2);
  const my = Math.floor((ay + by) / 2);

  // Prefer true chokepoints near the hallway midpoint.
  for (let radius = 1; radius <= 8; radius++) {
    const candidates = [];

    for (let y = my - radius; y <= my + radius; y++) {
      for (let x = mx - radius; x <= mx + radius; x++) {
        if (Math.abs(x - mx) !== radius && Math.abs(y - my) !== radius) continue;
        if (x <= 1 || y <= 1 || x >= MAP_COLS - 2 || y >= MAP_ROWS - 2) continue;
        if (isValidDoorSpot(x, y)) candidates.push({ x, y });
      }
    }

    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      map[pick.y][pick.x] = "D";
      return;
    }
  }
}



function assignRoomThemesAndBoss(){
 for(const room of rooms){
   room.sizeClass=room.sizeClass||((room.w*room.h>220)?"large":(room.w*room.h>120)?"medium":"small");
 }

 const candidates=rooms
   .filter((r,i)=>i!==0 && r.type!=="safe")
   .sort((a,b)=>(b.w*b.h)-(a.w*a.h));

 // Prefer the intentionally generated boss room, then fall back to the largest large room.
 bossRoom =
   candidates.find(r=>r.forcedBossCandidate) ||
   candidates.find(r=>r.sizeClass==="large") ||
   candidates[0] ||
   null;

 if(bossRoom){
   bossRoom.type="boss";
   bossRoom.name=choose(ROOM_NAMES.boss);
   bossRoom.themeId="boss";
   bossRoom.subtitle="The room is larger because the mistake inside it needs space.";
   bossRoom.locked=false;
   bossRoom.cleared=false;
 }

 const themeableRooms = rooms.filter((room, index) => index !== 0 && room !== bossRoom);
 const earlyRooms = themeableRooms.slice(0, FLOOR0_REQUIRED_THEME_IDS.length);
 for (let i = 0; i < earlyRooms.length; i++) {
   applyRoomTheme(earlyRooms[i], FLOOR0_ROOM_THEMES[FLOOR0_REQUIRED_THEME_IDS[i]]);
 }

 const recentThemeIds = new Set(earlyRooms.map(room => room.themeId).filter(Boolean));
 for(const room of themeableRooms){
   if(room.themeId) continue;
   const theme = weightedThemeForRoom(room, recentThemeIds.size > 2 ? recentThemeIds : new Set());
   applyRoomTheme(room, theme);
   recentThemeIds.add(theme.id);
   if(recentThemeIds.size > 4) recentThemeIds.delete([...recentThemeIds][0]);
 }
}

function isAdjacentEdgeFloorForRoom(x, y, room) {
  if (!room) return false;
  if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return false;

  const tile = map[y]?.[x];
  if (!(tile === "." || tile === "D" || tile === "L" || tile === "C")) return false;

  if (roomContainsTile(room, x, y)) return false;
  return roomContainsTile(room, x - 1, y) ||
         roomContainsTile(room, x + 1, y) ||
         roomContainsTile(room, x, y - 1) ||
         roomContainsTile(room, x, y + 1);
}


function roomForTile(tx, ty) {
  // First: true room interior wins.
  for (const room of rooms) {
    if (roomContainsTile(room, tx, ty)) {
      return room;
    }
  }

  // Second: if an open hallway/floor tile hugs a room edge, treat it as part of that room.
  // This keeps fog, room names, and player perception aligned.
  for (const room of rooms) {
    if (isAdjacentEdgeFloorForRoom(tx, ty, room)) {
      return room;
    }
  }

  return null;
}


function updateCurrentRoom(){
 const tx=Math.floor(player.x/TILE),ty=Math.floor(player.y/TILE),room=roomForTile(tx,ty); if(!room)return;
 if(player.currentRoomId!==room.id){player.currentRoomId=room.id; currentRoomName=room.name||"Unknown Chamber";
   currentRoomSubtitle=room.subtitle||"";
   if(room.type==="safe"){
     announceRoomIdentity(room);
   }
   if(room.type!=="safe"){
     stats.namedRoomsEntered++;
     announceRoomIdentity(room);
   }
   if(room.type==="boss"&&!room.cleared&&!room.locked)startBossEncounter(room);
   updateHUD();
 }
}

function announceRoomIdentity(room) {
  if (!room) return;
  const title = room.name || "Unknown Chamber";
  const body = room.subtitle || "Try not to make it historically significant.";
  achievement(title, body, `room_identity_${room.id}`);
}

function startBossEncounter(room){
  // dcw_010: entering a boss room only announces it.
  // Actual lockdown happens only through triggerBossAggro().
  if (!room || room.encounterAnnounced) return;
  room.encounterAnnounced = true;
  achievement("BOSS ENCOUNTER",`${room.name}. Something large and legally distinct from your comfort zone is nearby.`,"bossEncounter");
  if (typeof setMusicState === "function") setMusicState(MUSIC_STATES.BOSS);
  announcer("Entering unusually large rooms remains a leading cause of crawler-shaped stains.");
}

function isBossBorderCell(room,x,y){
  return (x>=room.x&&x<room.x+room.w&&(y===room.y-1||y===room.y+room.h)) ||
         (y>=room.y&&y<room.y+room.h&&(x===room.x-1||x===room.x+room.w));
}

function isInsideRoom(room,x,y){
  return roomContainsTile(room, x, y);
}

function isFloorLikeForBossDoor(tile){
  return tile === "." || tile === "D" || tile === "L";
}

function isPlayerStandingOnTile(x,y){
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  return px === x && py === y;
}

function bossPerimeterTiles(room){
  const tiles = [];

  // Top and bottom rings just outside room.
  for(let x=room.x; x<room.x+room.w; x++){
    tiles.push({x, y:room.y-1});
    tiles.push({x, y:room.y+room.h});
  }

  // Left and right rings just outside room.
  for(let y=room.y; y<room.y+room.h; y++){
    tiles.push({x:room.x-1, y});
    tiles.push({x:room.x+room.w, y});
  }

  return tiles.filter(t => t.x>0 && t.y>0 && t.x<MAP_COLS-1 && t.y<MAP_ROWS-1);
}

function isConnectedToBossInterior(room,x,y){
  return isInsideRoom(room,x-1,y) ||
         isInsideRoom(room,x+1,y) ||
         isInsideRoom(room,x,y-1) ||
         isInsideRoom(room,x,y+1);
}

function isConnectedToExteriorFloor(room,x,y){
  const neighbors = [
    {x:x-1,y},
    {x:x+1,y},
    {x,y:y-1},
    {x,y:y+1}
  ];

  return neighbors.some(n =>
    !isInsideRoom(room,n.x,n.y) &&
    n.x>0 && n.y>0 && n.x<MAP_COLS-1 && n.y<MAP_ROWS-1 &&
    isFloorLikeForBossDoor(map[n.y][n.x])
  );
}

function isBossDoorCandidate(room,x,y){
  if(x<=0||y<=0||x>=MAP_COLS-1||y>=MAP_ROWS-1) return false;
  if(!isBossBorderCell(room,x,y)) return false;
  if(!isFloorLikeForBossDoor(map[y][x])) return false;
  // Player-occupied seal tiles are still valid candidates; placeBossLockSafely() will queue them.

  // Less picky than before:
  // any floor-like perimeter tile that touches boss interior and also touches outside floor is a lock candidate.
  return isConnectedToBossInterior(room,x,y) && isConnectedToExteriorFloor(room,x,y);
}



function registerBossLock(x, y) {
  if (!bossLockTiles) bossLockTiles = [];
  if (!bossLockTiles.some(t => t.x === x && t.y === y)) {
    bossLockTiles.push({x, y});
  }

  // A spawned lock should be visible to the crawler. Doors block vision beyond them,
  // but the door itself should not be hidden in fog.
  visible[y] = visible[y] || [];
  seen[y] = seen[y] || [];
  visible[y][x] = true;
  seen[y][x] = true;
  minimapDirty = true;
  visibilityDirty = true;
}

function clearBossLocks() {
  if (!bossLockTiles) bossLockTiles = [];

  for (const t of bossLockTiles) {
    if (t.x < 0 || t.y < 0 || t.x >= MAP_COLS || t.y >= MAP_ROWS) continue;
    if (map[t.y]?.[t.x] === "L") {
      map[t.y][t.x] = ".";
    }
    if (visible[t.y]) visible[t.y][t.x] = true;
    if (seen[t.y]) seen[t.y][t.x] = true;
  }

  bossLockTiles = [];
  minimapDirty = true;
  visibilityDirty = true;
}


function isNearCrawlerTile(x, y, radius = 1) {
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  return Math.abs(x - px) <= radius && Math.abs(y - py) <= radius;
}

function isTileInsideRoom(x, y, room) {
  return room && roomContainsTile(room, x, y);
}

function nudgeCrawlerIntoBossRoom() {
  // dcw_007: no teleporting. Player movement should only come from player input.
  return;
}


function placeBossLockSafely(x, y) {
  if (!bossRoom) return false;
  if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return false;

  // No teleporting. If crawler is literally standing in the seal tile,
  // queue this exact lock and place it the moment they clear it.
  if (isCrawlerBlockingTile(x, y, 0)) {
    queueBossLock(x, y);
    return false;
  }

  const tile = map[y]?.[x];

  if (tile === "." || tile === "D" || tile === "C" || tile === "L") {
    map[y][x] = "L";
    registerBossLock(x, y);
    return true;
  }

  // If the ideal tile is invalid, try one tile outward/inward, but never around the crawler.
  const cx = bossRoom.cx;
  const cy = bossRoom.cy;
  const dx = Math.sign(x - cx);
  const dy = Math.sign(y - cy);

  const candidates = [
    {x: x + dx, y: y + dy},
    {x: x - dx, y: y - dy}
  ];

  for (const t of candidates) {
    if (t.x < 0 || t.y < 0 || t.x >= MAP_COLS || t.y >= MAP_ROWS) continue;
    if (isCrawlerBlockingTile(t.x, t.y, 0)) {
      queueBossLock(t.x, t.y);
      continue;
    }

    const alt = map[t.y]?.[t.x];
    if (alt === "." || alt === "D" || alt === "C" || alt === "L") {
      map[t.y][t.x] = "L";
      registerBossLock(t.x, t.y);
      return true;
    }
  }

  // Last resort: queue original. No entrance should be forgotten.
  queueBossLock(x, y);
  return false;
}


function isCrawlerBlockingTile(x, y, radius = 0) {
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  return Math.abs(x - px) <= radius && Math.abs(y - py) <= radius;
}

function queueBossLock(x, y) {
  if (!pendingBossLocks) pendingBossLocks = [];
  if (!pendingBossLocks.some(t => t.x === x && t.y === y)) {
    pendingBossLocks.push({x, y});
  }
}

function processPendingBossLocks() {
  if (!bossAggroed && !bossDoorsLocked) return;
  if (!pendingBossLocks || !pendingBossLocks.length) return;

  const remaining = [];

  for (const lock of pendingBossLocks) {
    if (isCrawlerBlockingTile(lock.x, lock.y, 0)) {
      remaining.push(lock);
      continue;
    }

    const tile = map[lock.y]?.[lock.x];
    if (tile === "." || tile === "D" || tile === "C" || tile === "L") {
      map[lock.y][lock.x] = "L";
      registerBossLock(lock.x, lock.y);
    } else {
      remaining.push(lock);
    }
  }

  pendingBossLocks = remaining;
}

// dcw_009: boss aggro requires LOS or attack. No proximity-only lockdown.
function triggerBossAggro(reason = "seen") {
  if (!bossEnemy || bossEnemy.hp <= 0 || bossAggroed) return;

  bossAggroed = true;
  lockBossDoors(bossRoom);

  if (typeof setMusicState === "function") setMusicState(MUSIC_STATES.BOSS);

  achievement(
    "BOSS AGGRO",
    reason === "attack"
      ? "You attacked the boss. The exits seal. This is what scholars call commitment."
      : "The boss has noticed you. The exits seal. Running is now a historical concept.",
    `bossAggro_${currentFloor}`
  );
}


function lockBossDoors(room = bossRoom){
  if (!room) return;
  if (bossDoorsLocked) return;
  bossDoorsLocked = true;
  room.lockedDoors = [];

  for(const t of bossPerimeterTiles(room)){
    if(isBossDoorCandidate(room,t.x,t.y)){
      placeBossLockSafely(t.x, t.y);
      minimapDirty=true;
      room.lockedDoors.push({x:t.x,y:t.y});
    }
  }

  // Also scan one tile just inside the perimeter for weird wide-mouth entrances.
  // This catches cases where the "doorway" is technically inside the room edge.
  for(let y=room.y; y<room.y+room.h; y++){
    for(let x=room.x; x<room.x+room.w; x++){
      const nearEdge = x===room.x || x===room.x+room.w-1 || y===room.y || y===room.y+room.h-1;
      if(!nearEdge) continue;
      if(!isFloorLikeForBossDoor(map[y][x])) continue;
      // Player-occupied seal tiles are still valid; placeBossLockSafely() will queue them.

      const outsideNeighbor =
        (x===room.x && isFloorLikeForBossDoor(map[y][x-1])) ||
        (x===room.x+room.w-1 && isFloorLikeForBossDoor(map[y][x+1])) ||
        (y===room.y && isFloorLikeForBossDoor(map[y-1][x])) ||
        (y===room.y+room.h-1 && isFloorLikeForBossDoor(map[y+1][x]));

      if(outsideNeighbor){
        placeBossLockSafely(x, y);
        minimapDirty=true;
        room.lockedDoors.push({x,y});
      }
    }
  }

  if(room.lockedDoors.length===0){
    announcer("Boss door lock failed gracefully. The dungeon blames contractors.");
  }
}

function unlockBossDoors(room){
  clearBossLocks();
  if(room.lockedDoors){
    for(const door of room.lockedDoors){
      if(map[door.y]&&map[door.y][door.x]==="L"){map[door.y][door.x]=".";minimapDirty=true;}
    }
    room.lockedDoors=[];
    return;
  }

  for(const t of bossPerimeterTiles(room)){
    if(map[t.y][t.x]==="L"){map[t.y][t.x]=".";minimapDirty=true;}
  }
}

function placeBossEnemy(){
  if(!bossRoom)return;
  const lvl=Math.max(3, player.level + 2 + Math.floor(currentFloor * 1.25));
  const hp=120+lvl*32;
  bossEnemy={
    x:bossRoom.cx*TILE+TILE/2,
    y:bossRoom.cy*TILE+TILE/2,
    r:20,
    level:lvl,
    boss:true,
    name:choose(["Rat King","Goblin Champion","Bone Collector","Cavern Brute","Kobold Shaman"]),
    hp,
    maxHp:hp,
    damage:10+lvl*4,
    xpReward:75+lvl*24,
    speed:.62+lvl*.025,
    behaviorTag:"boss_gatekeeper",
    ...enemySpriteMetadataForKey("gatekeeper"),
    roomId:bossRoom.id,
    damageCooldown:0,
    wanderAngle:Math.random()*Math.PI*2
  };
  enemies.push(bossEnemy);
}
function completeBossEncounter(enemy){
  bossAggroed = false;
  bossDoorsLocked = false;
  pendingBossLocks = [];
  clearBossLocks();
  if(!bossRoom||bossRoom.cleared)return;
  bossRoom.cleared=true;
  bossRoom.locked=false;
  stats.bossesDefeated++;
  unlockBossDoors(bossRoom);
  const cx=Math.max(bossRoom.x+1,Math.min(bossRoom.x+bossRoom.w-2,bossRoom.cx+1)),cy=Math.max(bossRoom.y+1,Math.min(bossRoom.y+bossRoom.h-2,bossRoom.cy));
  if(map[cy][cx]===".")map[cy][cx]="C";
  changeAudience(15);
  achievement("BOSS DEFEATED",`You defeated ${enemy.name||"the boss"}. The doors unlock. The corpse remains lootable, because dignity is not included in the tutorial.`,"bossDefeated");
  if (typeof syncMusicToGameState === "function") syncMusicToGameState();
}

function getFarthestRoom(fromRoom, excludedRooms = []) {
  const excluded = new Set(excludedRooms.filter(Boolean));
  let best = rooms[0], bestDist = -1;
  for (const r of rooms) {
    if (excluded.has(r)) continue;
    const d = Math.hypot(r.cx - fromRoom.cx, r.cy - fromRoom.cy);
    if (d > bestDist) { bestDist = d; best = r; }
  }
  return best;
}


const VISUAL_FLOOR_TYPES = ["crack", "scratch", "rubble", "stain", "worn"];
const VISUAL_DECAL_TYPES = ["debris", "brokenStone", "dust", "scorch", "coins", "marking"];
const VISUAL_DECORATION_TILES = new Set([".", "S"]);
const ENVIRONMENTAL_LIGHT_TYPES = ["torch", "lantern", "crystal", "campfire"];
const ENVIRONMENTAL_LIGHT_COLORS = {
  torch: { inner: "rgba(255,182,76,", outer: "rgba(255,112,36," },
  lantern: { inner: "rgba(255,220,136,", outer: "rgba(255,175,70," },
  crystal: { inner: "rgba(134,214,255,", outer: "rgba(82,126,255," },
  campfire: { inner: "rgba(255,205,112,", outer: "rgba(255,92,28," }
};
const HALLWAY_TORCH_MIN_SPACING = 8;
const HALLWAY_TORCH_TARGET_STEP = 22;

function tileHash(x, y, salt = 0) {
  let n = (x * 374761393 + y * 668265263 + currentFloor * 982451653 + salt * 1442695041) >>> 0;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  return (n >>> 0) / 4294967295;
}

function visualThemeForRoom(room) {
  const name = (room?.name || "").toLowerCase();
  if (room?.type === "safe") return { density: 0.015, floorBias: "worn", weights: { dust: 0.7, debris: 0.3 } };
  if (room?.type === "boss") return { density: 0.026, floorBias: "stain", weights: { scorch: 0.45, brokenStone: 0.35, debris: 0.2 } };
  if (room?.themeId === "ratNest") return { density: 0.06, floorBias: "scratch", weights: { debris: 0.36, dust: 0.34, brokenStone: 0.18, marking: 0.12 } };
  if (room?.themeId === "spiderDen") return { density: 0.052, floorBias: "stain", weights: { dust: 0.42, marking: 0.3, debris: 0.18, brokenStone: 0.1 } };
  if (["supplyCloset", "storageRoom", "armory"].includes(room?.themeId)) return { density: 0.05, floorBias: "worn", weights: { debris: 0.48, coins: 0.22, dust: 0.2, brokenStone: 0.1 } };
  if (["maintenanceTunnel", "securityOffice", "barracks"].includes(room?.themeId)) return { density: 0.046, floorBias: "scratch", weights: { debris: 0.38, scorch: 0.28, brokenStone: 0.2, dust: 0.14 } };
  if (room?.themeId === "floodedChamber") return { density: 0.035, floorBias: "stain", weights: { dust: 0.34, debris: 0.26, brokenStone: 0.22, marking: 0.18 } };
  if (room?.themeId === "stairwell") return { density: 0.032, floorBias: "worn", weights: { marking: 0.42, dust: 0.3, debris: 0.18, brokenStone: 0.1 } };
  if (name.includes("collapsed") || room?.shape === "alcove") return { density: 0.075, floorBias: "rubble", weights: { debris: 0.42, brokenStone: 0.42, dust: 0.16 } };
  if (name.includes("barracks") || name.includes("guard") || name.includes("armory")) return { density: 0.045, floorBias: "scratch", weights: { debris: 0.55, brokenStone: 0.25, dust: 0.2 } };
  if (name.includes("treasury") || name.includes("feast")) return { density: 0.026, floorBias: "worn", weights: { coins: 0.45, dust: 0.35, debris: 0.2 } };
  if (name.includes("chapel") || name.includes("shrine")) return { density: 0.035, floorBias: "worn", weights: { marking: 0.42, dust: 0.38, scorch: 0.2 } };
  return { density: 0.025, floorBias: null, weights: { dust: 0.34, debris: 0.28, brokenStone: 0.2, scorch: 0.18 } };
}

function weightedVisualPick(weights, roll) {
  let total = 0;
  for (const value of Object.values(weights)) total += value;
  let threshold = roll * total;
  for (const [type, weight] of Object.entries(weights)) {
    threshold -= weight;
    if (threshold <= 0) return type;
  }
  return Object.keys(weights)[0] || "dust";
}

function createFloorDetail(x, y, room) {
  const r = tileHash(x, y, 11);
  if (r > 0.24) return null;

  const theme = room ? visualThemeForRoom(room) : { floorBias: null };
  let type = VISUAL_FLOOR_TYPES[Math.floor(tileHash(x, y, 12) * VISUAL_FLOOR_TYPES.length) % VISUAL_FLOOR_TYPES.length];
  if (theme.floorBias && tileHash(x, y, 13) < 0.45) type = theme.floorBias;

  return {
    type,
    rotation: Math.floor(tileHash(x, y, 14) * 4),
    ox: Math.floor(tileHash(x, y, 15) * 12) - 6,
    oy: Math.floor(tileHash(x, y, 16) * 12) - 6,
    scale: 0.75 + tileHash(x, y, 17) * 0.45
  };
}

function isVisualDecalBaseTile(x, y) {
  return VISUAL_DECORATION_TILES.has(map[y]?.[x]);
}

function canPlaceVisualDecal(x, y) {
  if (!isVisualDecalBaseTile(x, y)) return false;
  return x !== Math.floor(player.x / TILE) || y !== Math.floor(player.y / TILE);
}


function nearestWallDirection(x, y) {
  let best = null;
  for (const dir of CARDINAL_DIRECTIONS) {
    if (map[y + dir.dy]?.[x + dir.dx] !== "#") continue;
    if (!best || tileHash(x + dir.dx, y + dir.dy, 89) > best.roll) best = { ...dir, roll: tileHash(x + dir.dx, y + dir.dy, 89) };
  }
  return best || { dx: 0, dy: -1 };
}

function createEnvironmentalLight(type, x, y, radius, intensity, fixture = {}) {
  const wallDir = fixture.wallMounted ? nearestWallDirection(x, y) : null;
  const offset = wallDir ? TILE * 0.34 : 0;
  return {
    type,
    x: x * TILE + TILE / 2 + (wallDir?.dx || 0) * offset,
    y: y * TILE + TILE / 2 + (wallDir?.dy || 0) * offset,
    tileX: x,
    tileY: y,
    radius,
    intensity,
    fixture: { ...fixture, wallDir }
  };
}

function isRoomInteriorTile(x, y) {
  return rooms?.some(room => roomContainsTile(room, x, y));
}

function isHallwayOrDoorwayFloor(x, y) {
  const tile = map[y]?.[x];
  if (!(tile === "." || tile === "D" || tile === "L")) return false;
  return !isRoomInteriorTile(x, y);
}

function countCardinalHallwayNeighbors(x, y) {
  let count = 0;
  for (const dir of CARDINAL_DIRECTIONS) {
    if (isHallwayOrDoorwayFloor(x + dir.dx, y + dir.dy)) count++;
  }
  return count;
}

function countCardinalWallNeighbors(x, y) {
  let count = 0;
  for (const dir of CARDINAL_DIRECTIONS) {
    if (map[y + dir.dy]?.[x + dir.dx] === "#") count++;
  }
  return count;
}

function isDoorwayAdjacentToRoom(x, y) {
  return rooms?.some(room =>
    !roomContainsTile(room, x, y) &&
    (roomContainsTile(room, x - 1, y) ||
     roomContainsTile(room, x + 1, y) ||
     roomContainsTile(room, x, y - 1) ||
     roomContainsTile(room, x, y + 1))
  );
}

function hallwayTorchCandidateScore(x, y) {
  if (!isHallwayOrDoorwayFloor(x, y)) return -Infinity;
  if (map[y]?.[x] === "L") return -Infinity;
  if (x === Math.floor(player.x / TILE) && y === Math.floor(player.y / TILE)) return -Infinity;

  const hallwayNeighbors = countCardinalHallwayNeighbors(x, y);
  const wallNeighbors = countCardinalWallNeighbors(x, y);

  // Prefer narrow corridor floor tiles, while still allowing doorway-adjacent
  // hall tiles so their glow can spill into nearby rooms without placing
  // fixtures in the room interiors themselves.
  let score = 0;
  score += map[y][x] === "." ? 24 : 10;
  score += wallNeighbors * 12;
  score += hallwayNeighbors <= 2 ? 20 : -8;
  score += isDoorwayAdjacentToRoom(x, y) ? 10 : 0;
  score += tileHash(x, y, 83) * 8;
  return score;
}

function collectHallwayTorchCandidates() {
  const candidates = [];

  for (let y = 1; y < MAP_ROWS - 1; y++) {
    for (let x = 1; x < MAP_COLS - 1; x++) {
      const score = hallwayTorchCandidateScore(x, y);
      if (!Number.isFinite(score)) continue;
      candidates.push({ x, y, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function buildEnvironmentalLights() {
  environmentalLights = [];

  const candidates = collectHallwayTorchCandidates();
  const target = Math.min(
    Math.max(6, Math.floor(candidates.length / HALLWAY_TORCH_TARGET_STEP)),
    Math.ceil((MAP_ROWS * MAP_COLS) / 285)
  );

  for (const tile of candidates) {
    if (environmentalLights.length >= target) break;
    if (environmentalLights.some(light => Math.hypot(light.tileX - tile.x, light.tileY - tile.y) < HALLWAY_TORCH_MIN_SPACING)) continue;

    const radius = 104 + Math.floor(tileHash(tile.x, tile.y, 84) * 22);
    const intensity = 0.31 + tileHash(tile.x, tile.y, 85) * 0.07;
    environmentalLights.push(createEnvironmentalLight("torch", tile.x, tile.y, radius, intensity, { wallMounted: true, fixtureType: "wallTorch" }));
  }

  buildRoomEnvironmentalLights();
}

function roomWallLightCandidateScore(room, x, y) {
  if (!roomContainsTile(room, x, y)) return -Infinity;
  if (map[y]?.[x] !== "." && map[y]?.[x] !== "S") return -Infinity;
  if (x === Math.floor(player.x / TILE) && y === Math.floor(player.y / TILE)) return -Infinity;
  const wallNeighbors = countCardinalWallNeighbors(x, y);
  if (wallNeighbors <= 0) return -Infinity;
  const edgeBias = Math.min(x - room.x, room.x + room.w - 1 - x, y - room.y, room.y + room.h - 1 - y);
  return wallNeighbors * 18 - edgeBias * 2 + tileHash(x, y, 90) * 10;
}

function roomCampfireTile(room) {
  const tiles = roomTileList(room, 2).filter(t => map[t.y]?.[t.x] === "." && canPlaceVisualDecal(t.x, t.y));
  if (!tiles.length) return null;
  tiles.sort((a, b) => {
    const da = Math.hypot(a.x - room.cx, a.y - room.cy) + tileHash(a.x, a.y, 91);
    const db = Math.hypot(b.x - room.cx, b.y - room.cy) + tileHash(b.x, b.y, 91);
    return da - db;
  });
  return tiles[0];
}

function buildRoomEnvironmentalLights() {
  for (const room of rooms) {
    if (room.type === "safe") continue;

    if ((room.sizeClass === "large" || room.type === "boss") && tileHash(room.id, currentFloor, 92) < 0.72) {
      const camp = roomCampfireTile(room);
      if (camp) {
        environmentalLights.push(createEnvironmentalLight("campfire", camp.x, camp.y, 134, 0.34, { fixtureType: "campfire" }));
      }
    }

    const candidates = roomTileList(room, 0)
      .map(t => ({ ...t, score: roomWallLightCandidateScore(room, t.x, t.y) }))
      .filter(t => Number.isFinite(t.score))
      .sort((a, b) => b.score - a.score);
    const target = room.sizeClass === "large" || room.type === "boss" ? 2 : tileHash(room.id, currentFloor, 93) < 0.58 ? 1 : 0;

    for (const tile of candidates) {
      const placedInRoom = environmentalLights.filter(light => roomContainsTile(room, light.tileX, light.tileY)).length;
      if (placedInRoom >= target + (room.sizeClass === "large" || room.type === "boss" ? 1 : 0)) break;
      if (environmentalLights.some(light => Math.hypot(light.tileX - tile.x, light.tileY - tile.y) < 5)) continue;
      const type = tileHash(tile.x, tile.y, 94) < 0.16 ? "crystal" : "torch";
      const radius = type === "crystal" ? 118 : 108;
      const intensity = type === "crystal" ? 0.27 : 0.32;
      environmentalLights.push(createEnvironmentalLight(type, tile.x, tile.y, radius, intensity, { wallMounted: true, fixtureType: type === "crystal" ? "wallCrystal" : "wallTorch" }));
    }
  }
}

function buildDungeonVisuals() {
  dungeonVisuals = {
    floor: Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(null)),
    decals: []
  };

  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      if (!VISUAL_DECORATION_TILES.has(map[y]?.[x])) continue;
      dungeonVisuals.floor[y][x] = createFloorDetail(x, y, roomForTile(x, y));
    }
  }

  buildEnvironmentalLights();

  for (const room of rooms) {
    const theme = visualThemeForRoom(room);
    const tiles = roomTileList(room, 1).filter(t => canPlaceVisualDecal(t.x, t.y));
    const target = Math.min(Math.ceil(tiles.length * theme.density), Math.max(1, Math.floor(tiles.length / 12)));
    let placed = 0;
    let guard = 0;

    while (placed < target && guard < target * 18 + 20 && tiles.length > 0) {
      guard++;
      const index = Math.floor(Math.random() * tiles.length);
      const tile = tiles.splice(index, 1)[0];
      if (!canPlaceVisualDecal(tile.x, tile.y)) continue;
      if (dungeonVisuals.decals.some(d => Math.abs(d.x - tile.x) <= 1 && Math.abs(d.y - tile.y) <= 1)) continue;

      dungeonVisuals.decals.push({
        x: tile.x,
        y: tile.y,
        type: weightedVisualPick(theme.weights, Math.random()),
        rotation: Math.random() * Math.PI * 2,
        scale: 0.7 + Math.random() * 0.55,
        ox: Math.floor(Math.random() * 10) - 5,
        oy: Math.floor(Math.random() * 10) - 5,
        roomId: room.id
      });
      placed++;
    }
  }
}

function validateDungeonVisualsAreVisualOnly() {
  if (!dungeonVisuals) return false;
  const floorOk = dungeonVisuals.floor.length === MAP_ROWS && dungeonVisuals.floor.every(row => row.length === MAP_COLS);
  const lightsOk = environmentalLights.every(light =>
    ENVIRONMENTAL_LIGHT_TYPES.includes(light.type) &&
    typeof light.x === "number" && typeof light.y === "number" &&
    light.radius > 0 && light.intensity > 0 &&
    (isHallwayOrDoorwayFloor(light.tileX, light.tileY) || isRoomInteriorTile(light.tileX, light.tileY))
  );
  const decalsOk = dungeonVisuals.decals.every(decal =>
    VISUAL_DECAL_TYPES.includes(decal.type) &&
    isVisualDecalBaseTile(decal.x, decal.y) &&
    !["C", "E", "D", "L", "#"].includes(map[decal.y]?.[decal.x])
  );
  return floorOk && decalsOk && lightsOk;
}

function placeObjects(tile, count, excludedRooms = []) {
  const excluded = new Set(excludedRooms.map(r => rooms.indexOf(r)));
  let placed = 0, guard = 0;
  while (placed < count && guard < 400) {
    guard++;
    const i = chooseWeightedRoomIndexForLoot(excluded);
    if (excluded.has(i)) continue;
    const room = rooms[i];
    const spot = chooseRandomRoomTile(room, 1);
    if (spot) { map[spot.y][spot.x] = tile; placed++; }
  }
}

function chooseWeightedRoomIndexForLoot(excluded) {
  const candidates = rooms.map((room, index) => ({ room, index }))
    .filter(entry => !excluded.has(entry.index) && entry.room?.type !== "boss");
  if (!candidates.length) return Math.floor(Math.random() * rooms.length);
  const total = candidates.reduce((sum, entry) => sum + (roomThemeDefinition(entry.room)?.lootBias || 1), 0);
  let roll = Math.random() * total;
  for (const entry of candidates) {
    roll -= roomThemeDefinition(entry.room)?.lootBias || 1;
    if (roll <= 0) return entry.index;
  }
  return candidates[candidates.length - 1].index;
}

function placeFloor0StarterLoot(excludedRooms = []) {
  if (currentFloor !== 0) return;
  const excluded = new Set(excludedRooms.map(room => room?.id).filter(id => id !== undefined));
  for (const themeId of ["supplyCloset", "armory"]) {
    const room = rooms.find(r => r.themeId === themeId && !excluded.has(r.id));
    const alreadyHasChest = room && roomTileList(room).some(t => map[t.y]?.[t.x] === "C");
    if (!room || alreadyHasChest) continue;
    const spot = chooseRandomRoomTile(room, 1);
    if (spot) map[spot.y][spot.x] = "C";
  }
}

function chooseEnemyVariantForRoom(room) {
  const family = roomThemeDefinition(room)?.enemies;
  const variants = family?.length ? family : [
    { name: "Dungeon Lurker", r: 11, hp: 1, damage: 1, speed: 1, xp: 1 },
    { name: "Restless Crawler", r: 12, hp: 1.05, damage: 1.02, speed: 0.96, xp: 1.02 }
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

function createEnemyForRoom(room, spot, spawnRoom = null) {
  const enemyLevel = rollScaledEnemyLevel(room, spawnRoom);
  const variant = chooseEnemyVariantForRoom(room);
  const maxHp = Math.max(12, Math.round((24 + enemyLevel * 10) * (variant.hp || 1)));
  return applyEnemyIdentity({
    x: spot.x * TILE + TILE / 2,
    y: spot.y * TILE + TILE / 2,
    r: variant.r || 11,
    level: enemyLevel,
    name: variant.name || "Dungeon Lurker",
    family: room.themeId || "floor0",
    hp: maxHp,
    maxHp: maxHp,
    damage: Math.max(1, Math.round((5 + enemyLevel * 3) * (variant.damage || 1))),
    xpReward: Math.max(1, Math.round((12 + enemyLevel * 8) * (variant.xp || 1))),
    speed: (0.74 + enemyLevel * 0.045) * (variant.speed || 1),
    roomId: room.id,
    damageCooldown: 0,
    wanderAngle: Math.random() * Math.PI * 2,
    behaviorState: {}
  }, variant);
}

function placeFloor0StarterEnemies(excludedRooms = [], spawnRoom = null) {
  if (currentFloor !== 0) return 0;
  const excluded = new Set(excludedRooms.map(room => room?.id).filter(id => id !== undefined));
  let placed = 0;
  for (const themeId of ["ratNest", "spiderDen", "barracks"]) {
    const room = rooms.find(r => r.themeId === themeId && !excluded.has(r.id));
    if (!room) continue;
    const spot = chooseRandomRoomTile(room, 1);
    if (!spot) continue;
    enemies.push(createEnemyForRoom(room, spot, spawnRoom));
    placed++;
  }
  return placed;
}

function placeEnemies(count, excludedRooms = [], spawnRoom = null) {
  const excluded = new Set(excludedRooms.map(r => rooms.indexOf(r)));
  let placed = 0, guard = 0;
  while (placed < count && guard < 600) {
    guard++;
    const i = Math.floor(Math.random() * rooms.length);
    if (excluded.has(i)) continue;
    const room = rooms[i];
    const spot = chooseRandomRoomTile(room, 1);
    if (spot) {
      enemies.push(createEnemyForRoom(room, spot, spawnRoom));
      placed++;
    }
  }
}



function assignStableFloor0EnemyIds() {
  if (!Array.isArray(enemies)) return;
  enemies.forEach((enemy, index) => {
    const roomId = Number.isFinite(Number(enemy.roomId)) ? Math.trunc(Number(enemy.roomId)) : (typeof floor0EnemyRoomId === "function" ? floor0EnemyRoomId(enemy) : "unknown");
    enemy.roomId = Number.isFinite(Number(roomId)) ? Number(roomId) : enemy.roomId;
    enemy.enemyId = `floor0_enemy_${String(index + 1).padStart(3, "0")}_room_${roomId}`;
  });
}
