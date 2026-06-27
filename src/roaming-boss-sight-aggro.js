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
