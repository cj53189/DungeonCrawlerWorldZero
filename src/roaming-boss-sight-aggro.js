// Floor 2 roaming boss sight aggro + tracking patch.
// Keeps the roaming boss from sealing doors, but makes "it saw you" feel like a real event
// and gives it tile-based pursuit so corners/doors do not turn it into a confused bone Roomba.
(function installRoamingBossSightAggroPatch() {
  if (window.__dcwRoamingBossSightAggroPatchInstalled) return;
  window.__dcwRoamingBossSightAggroPatchInstalled = true;

  const ROAMING_BOSS_RADIUS = 14;
  const ROAMING_BOSS_MAX_PATH_NODES = 1400;
  const ROAMING_BOSS_REPATH_FRAMES = 12;

  const originalPlaceBossEnemy = typeof placeBossEnemy === "function" ? placeBossEnemy : null;
  if (originalPlaceBossEnemy && !originalPlaceBossEnemy.__roamingBossTrackingWrapped) {
    placeBossEnemy = function placeBossEnemyWithRoamingTrackingPatch() {
      const result = originalPlaceBossEnemy.apply(this, arguments);
      tuneRoamingBossBody();
      return result;
    };
    placeBossEnemy.__roamingBossTrackingWrapped = true;
  }

  function tuneRoamingBossBody() {
    if (!bossEnemy?.roamingBoss) return;
    bossEnemy.r = Math.min(Number(bossEnemy.r) || ROAMING_BOSS_RADIUS, ROAMING_BOSS_RADIUS);
    bossEnemy.attackReach = Math.max(Number(bossEnemy.attackReach) || 8, 10);
  }

  function tileKey(x, y) { return `${x},${y}`; }
  function tileCenter(tile) { return { x: tile.x * TILE + TILE / 2, y: tile.y * TILE + TILE / 2, tx: tile.x, ty: tile.y }; }

  function inPathBounds(x, y) {
    return x > 0 && y > 0 && x < MAP_COLS - 1 && y < MAP_ROWS - 1;
  }

  function isRoamingBossPathTile(x, y, options = {}) {
    if (!inPathBounds(x, y)) return false;
    const tile = map[y]?.[x];
    if (tile === "#" || tile === "L") return false;
    if (tile === "D") return options.allowDoors !== false;
    if (tile === "S") return !!options.allowSafe;
    return tile === "." || tile === "C" || tile === "E";
  }

  function findNearestRoamingBossGoal(tx, ty, options = {}) {
    if (isRoamingBossPathTile(tx, ty, options)) return { x: tx, y: ty };
    for (let radius = 1; radius <= 5; radius++) {
      let best = null;
      let bestDist = Infinity;
      for (let y = ty - radius; y <= ty + radius; y++) {
        for (let x = tx - radius; x <= tx + radius; x++) {
          if (Math.abs(x - tx) !== radius && Math.abs(y - ty) !== radius) continue;
          if (!isRoamingBossPathTile(x, y, options)) continue;
          const dist = Math.hypot(x - tx, y - ty);
          if (dist < bestDist) { best = { x, y }; bestDist = dist; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function buildRoamingBossPath(start, goal, options = {}) {
    if (!start || !goal) return null;
    if (start.x === goal.x && start.y === goal.y) return [];

    const queue = [start];
    let head = 0;
    const startKey = tileKey(start.x, start.y);
    const goalKey = tileKey(goal.x, goal.y);
    const cameFrom = new Map([[startKey, null]]);
    const dirs = [
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 }
    ];

    while (head < queue.length && cameFrom.size < ROAMING_BOSS_MAX_PATH_NODES) {
      const current = queue[head++];
      if (tileKey(current.x, current.y) === goalKey) break;

      for (const dir of dirs) {
        const next = { x: current.x + dir.x, y: current.y + dir.y };
        const key = tileKey(next.x, next.y);
        if (cameFrom.has(key)) continue;
        if (!isRoamingBossPathTile(next.x, next.y, options)) continue;
        cameFrom.set(key, current);
        queue.push(next);
      }
    }

    if (!cameFrom.has(goalKey)) return null;
    const path = [];
    let current = goal;
    while (current && tileKey(current.x, current.y) !== startKey) {
      path.push(current);
      current = cameFrom.get(tileKey(current.x, current.y));
    }
    path.reverse();
    return path;
  }

  function getRoamingBossPathStep(enemy, targetX, targetY, options = {}) {
    const start = { x: Math.floor(enemy.x / TILE), y: Math.floor(enemy.y / TILE) };
    const targetTile = { x: Math.floor(targetX / TILE), y: Math.floor(targetY / TILE) };
    const goal = findNearestRoamingBossGoal(targetTile.x, targetTile.y, options);
    if (!goal) return null;

    const goalKey = tileKey(goal.x, goal.y);
    const needsPath =
      !Array.isArray(enemy.roamingPath) ||
      enemy.roamingPath.length === 0 ||
      enemy.roamingPathGoalKey !== goalKey ||
      (enemy.roamingPathRepathAt || 0) <= frameCount;

    if (needsPath) {
      enemy.roamingPath = buildRoamingBossPath(start, goal, options) || [];
      enemy.roamingPathGoalKey = goalKey;
      enemy.roamingPathRepathAt = frameCount + ROAMING_BOSS_REPATH_FRAMES;
    }

    while (enemy.roamingPath.length > 1) {
      const next = enemy.roamingPath[0];
      const center = tileCenter(next);
      if (Math.hypot(center.x - enemy.x, center.y - enemy.y) > TILE * 0.35) break;
      enemy.roamingPath.shift();
    }

    return enemy.roamingPath[0] ? tileCenter(enemy.roamingPath[0]) : tileCenter(goal);
  }

  function smashRoamingBossDoorAt(tile) {
    if (!tile || map[tile.ty]?.[tile.tx] !== "D") return;
    map[tile.ty][tile.tx] = ".";
    minimapDirty = true;
    visibilityDirty = true;
    if (bossEnemy) {
      bossEnemy.roamingDoorSmashCooldown = Math.max(0, bossEnemy.roamingDoorSmashCooldown || 0);
      if (bossEnemy.roamingDoorSmashCooldown <= 0 && typeof announcer === "function") {
        bossEnemy.roamingDoorSmashCooldown = 60 * 10;
        announcer("The roaming Skeleton Boss forces a door open somewhere nearby. Subtlety has left the floor.");
      }
    }
  }

  function movementToward(enemy, point, speedMultiplier = 1) {
    if (!point) return null;
    if (Number.isFinite(point.tx) && Number.isFinite(point.ty)) smashRoamingBossDoorAt(point);
    const dir = normalizeVector(point.x - enemy.x, point.y - enemy.y);
    return { dx: dir.x * enemy.speed * speedMultiplier, dy: dir.y * enemy.speed * speedMultiplier };
  }

  const originalCalculateRoamingBossMovement =
    typeof calculateRoamingBossMovement === "function" ? calculateRoamingBossMovement : null;

  if (!originalCalculateRoamingBossMovement) return;

  calculateRoamingBossMovement = function calculateRoamingBossMovementWithSightAggro(
    enemy,
    targetCrawler,
    canSeeTarget,
    bossCanAlwaysTrack,
    dist
  ) {
    tuneRoamingBossBody();
    if (enemy?.roamingDoorSmashCooldown > 0) enemy.roamingDoorSmashCooldown--;

    if (
      enemy?.roamingBoss &&
      targetCrawler &&
      canSeeTarget &&
      !bossAggroed &&
      typeof triggerBossAggro === "function"
    ) {
      triggerBossAggro("seen");
      bossCanAlwaysTrack = true;
    }

    if (!enemy?.roamingBoss) {
      return originalCalculateRoamingBossMovement(enemy, targetCrawler, canSeeTarget, bossCanAlwaysTrack, dist);
    }

    const hellState = enemy.bulletHellState;
    if (bossAggroed && hellState?.movementLock > 0) {
      hellState.movementLock--;
      setEnemyAnimationState(enemy, "idle");
      return { dx: 0, dy: 0 };
    }

    if (targetCrawler && (canSeeTarget || bossCanAlwaysTrack)) {
      const pathStep = getRoamingBossPathStep(enemy, targetCrawler.x, targetCrawler.y, {
        allowDoors: true,
        allowSafe: false
      });
      const pathMovement = movementToward(enemy, pathStep, canSeeTarget ? 0.82 : 0.72);
      if (pathMovement) return pathMovement;
      return originalCalculateRoamingBossMovement(enemy, targetCrawler, canSeeTarget, bossCanAlwaysTrack, dist);
    }

    let target = enemy.roamingTarget;
    if (!target || Math.hypot(target.x - enemy.x, target.y - enemy.y) < TILE * 0.75) {
      if (typeof chooseRoamingBossTarget === "function") target = chooseRoamingBossTarget(enemy);
    }

    if (target) {
      const pathStep = getRoamingBossPathStep(enemy, target.x, target.y, {
        allowDoors: true,
        allowSafe: false
      });
      const roamMovement = movementToward(enemy, pathStep, 0.54);
      if (roamMovement) return roamMovement;
    }

    return originalCalculateRoamingBossMovement(enemy, targetCrawler, canSeeTarget, bossCanAlwaysTrack, dist);
  };
})();

// Floor 3 Broadcast District prototype.
// This intentionally keeps the first overworld pass inside the existing tilemap pipeline:
// one large-feeling district, named zones, normal loot/enemies/boss behavior, and no new renderer.
(function installFloor3BroadcastDistrictPrototype() {
  if (window.__dcwFloor3BroadcastDistrictPrototypeInstalled) return;
  window.__dcwFloor3BroadcastDistrictPrototypeInstalled = true;
  if (typeof generateDungeon !== "function") return;

  const originalGenerateDungeon = generateDungeon;

  window.floor3WorldState = window.floor3WorldState || {
    currentZone: "broadcast_district",
    unlockedZones: ["hub", "mall", "arena", "studio", "subway", "apartments", "exit_plaza"],
    completedQuests: [],
    openedShortcuts: [],
    defeatedBosses: [],
    playerReputation: { violence: 0, style: 0, heart: 0 },
    floor3: {
      classChosen: false,
      raceChosen: false,
      exitGateUnlocked: true
    }
  };

  function makeDistrictRoom(def) {
    const parts = [{ x: def.x, y: def.y, w: def.w, h: def.h }];
    return {
      id: def.id,
      x: def.x,
      y: def.y,
      w: def.w,
      h: def.h,
      cx: Math.floor(def.x + def.w / 2),
      cy: Math.floor(def.y + def.h / 2),
      parts,
      shape: def.shape || "district",
      seen: false,
      sizeClass: def.sizeClass || "large",
      name: def.name,
      themeId: def.themeId || null,
      subtitle: def.subtitle || "",
      tutorialId: null,
      tutorialMessage: "",
      type: def.type || "normal",
      locked: false,
      cleared: false,
      forcedBossCandidate: !!def.forcedBossCandidate
    };
  }

  function setFloor3Tile(x, y, tile) {
    if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return;
    map[y][x] = tile;
  }

  function carveFloor3Rect(x, y, w, h, tile = ".") {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) setFloor3Tile(xx, yy, tile);
    }
  }

  function carveFloor3Road(x1, y1, x2, y2, width = 3) {
    const radius = Math.max(0, Math.floor(width / 2));
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY - radius; y <= maxY + radius; y++) {
      for (let x = minX - radius; x <= maxX + radius; x++) setFloor3Tile(x, y, ".");
    }
  }

  function addDistrictRoom(def, floorTile = ".") {
    const room = makeDistrictRoom(def);
    rooms.push(room);
    carveFloor3Rect(room.x, room.y, room.w, room.h, floorTile);
    return room;
  }

  function placeFloor3Chest(room) {
    if (!room) return;
    const spot = typeof chooseRandomRoomTile === "function"
      ? chooseRandomRoomTile(room, 1)
      : { x: room.cx, y: room.cy };
    if (spot && map[spot.y]?.[spot.x] === ".") map[spot.y][spot.x] = "C";
  }

  function assignFloor3EnemyIds() {
    if (!Array.isArray(enemies)) return;
    enemies.forEach((enemy, index) => {
      if (!enemy.enemyId) {
        const roomId = Number.isFinite(Number(enemy.roomId)) ? Math.trunc(Number(enemy.roomId)) : "street";
        enemy.enemyId = `floor3_enemy_${String(index + 1).padStart(3, "0")}_room_${roomId}`;
      }
    });
  }

  function revealFloor3SafeStart(room) {
    if (!room) return;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (seen[y]) seen[y][x] = true;
        if (visible[y]) visible[y][x] = true;
      }
    }
  }

  function resetFloor3TransientState() {
    enemies = [];
    corpses = [];
    tutorialSigns = [];
    petMerchant = null;
    bossRoom = null;
    bossEnemy = null;
    bossLockTiles = [];
    bossAggroed = false;
    bossDoorsLocked = false;
    pendingBossLocks = [];
    stairwellFound = false;
    stairwellX = null;
    stairwellY = null;
    minimapDirty = true;
    visibilityDirty = true;
    lastVisibilityTileX = null;
    lastVisibilityTileY = null;
    currentRoomName = "Broadcast District Hub";
    currentRoomSubtitle = "A whole city block pretending it is not a dungeon.";
  }

  function generateFloor3BroadcastDistrictLayout() {
    map = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill("#"));
    seen = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(false));
    visible = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(false));
    rooms = [];
    resetFloor3TransientState();

    // Wide roads create the overworld illusion without loading a separate world renderer.
    carveFloor3Road(4, 39, 105, 39, 5);
    carveFloor3Road(55, 6, 55, 73, 5);
    carveFloor3Road(22, 22, 92, 22, 3);
    carveFloor3Road(24, 60, 90, 60, 3);
    carveFloor3Road(21, 22, 21, 60, 3);
    carveFloor3Road(91, 22, 91, 60, 3);

    const hub = addDistrictRoom({
      id: 0,
      x: 40,
      y: 31,
      w: 31,
      h: 18,
      type: "safe",
      themeId: "safeRoom",
      name: "Broadcast District Hub",
      subtitle: "Safe-ish streets, bad signage, and cameras pretending not to watch.",
      sizeClass: "large"
    }, "S");

    const mall = addDistrictRoom({
      id: 1,
      x: 8,
      y: 12,
      w: 29,
      h: 20,
      themeId: "supplyCloset",
      name: "Mall Ruins",
      subtitle: "Loot kiosks, dead escalators, and absolutely no returns.",
      sizeClass: "large"
    });

    const arena = addDistrictRoom({
      id: 2,
      x: 40,
      y: 8,
      w: 29,
      h: 18,
      type: "boss",
      themeId: "boss",
      name: "Arena Plaza",
      subtitle: "The audience paid for violence. The dungeon hates refunds.",
      sizeClass: "large",
      forcedBossCandidate: true
    });

    const studio = addDistrictRoom({
      id: 3,
      x: 72,
      y: 10,
      w: 29,
      h: 21,
      themeId: "securityOffice",
      name: "Studio Lot",
      subtitle: "Fake houses, real enemies, and lighting rigs with legal immunity.",
      sizeClass: "large"
    });

    const subway = addDistrictRoom({
      id: 4,
      x: 10,
      y: 53,
      w: 29,
      h: 17,
      themeId: "floodedChamber",
      name: "Subway Tunnels",
      subtitle: "Shortcut potential with ambush seasoning.",
      sizeClass: "large"
    });

    const apartments = addDistrictRoom({
      id: 5,
      x: 72,
      y: 51,
      w: 28,
      h: 19,
      themeId: "barracks",
      name: "Collapsed Apartments",
      subtitle: "Every door has a story. Most stories bite.",
      sizeClass: "large"
    });

    const exitPlaza = addDistrictRoom({
      id: 6,
      x: 88,
      y: 34,
      w: 18,
      h: 13,
      themeId: "stairwell",
      name: "Exit Gate Plaza",
      subtitle: "The gate is visible early because the dungeon enjoys motivational cruelty.",
      sizeClass: "medium"
    });

    bossRoom = arena;
    stairwellX = exitPlaza.cx;
    stairwellY = exitPlaza.cy;
    map[stairwellY][stairwellX] = "E";

    player.x = hub.cx * TILE + TILE / 2;
    player.y = hub.cy * TILE + TILE / 2;
    player.currentRoomId = null;
    player.safe = true;
    player.wasSafe = true;

    for (const room of [mall, studio, subway, apartments]) placeFloor3Chest(room);
    if (typeof placeObjects === "function") placeObjects("C", 4, [hub, bossRoom, exitPlaza]);
    if (typeof placeEnemies === "function") placeEnemies(24, [hub, bossRoom, exitPlaza], hub);
    if (typeof placeBossEnemy === "function") placeBossEnemy();
    assignFloor3EnemyIds();

    revealFloor3SafeStart(hub);
    if (typeof buildDungeonVisuals === "function") buildDungeonVisuals();
    stats.floorRooms = rooms.length;
    currentRoomName = hub.name;
    currentRoomSubtitle = hub.subtitle;
  }

  generateDungeon = function generateDungeonWithFloor3BroadcastDistrict() {
    if (currentFloor === 3 && !multiplayer?.arena) {
      const seed = typeof getSharedMultiplayerFloorSeed === "function" ? getSharedMultiplayerFloorSeed() : null;
      if (seed && typeof withSeededRandom === "function") {
        return withSeededRandom(seed, generateFloor3BroadcastDistrictLayout);
      }
      return generateFloor3BroadcastDistrictLayout();
    }
    return originalGenerateDungeon.apply(this, arguments);
  };

  generateDungeon.__floor3BroadcastDistrictWrapped = true;
})();
