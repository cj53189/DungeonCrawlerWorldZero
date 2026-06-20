// Bullet-hell boss layer for Dungeon Crawler World Zero.
// Code-only: adds reusable boss projectile patterns without adding sprite assets.

const BOSS_HELL_MAX_PROJECTILES = 96;
const BOSS_HELL_BASE_COOLDOWN = 86;
let bossHellProjectiles = [];
let bossHellTelegraphs = [];

function clearBossHellProjectiles() {
  bossHellProjectiles = [];
  bossHellTelegraphs = [];
}

function bossHellClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isBossHellEnemy(enemy) {
  return !!enemy && enemy.boss && enemy.behaviorTag === "boss_skeleton";
}

function getBossHellPhase(enemy) {
  if (!enemy?.maxHp) return 1;
  const hpRatio = Math.max(0, enemy.hp) / enemy.maxHp;
  if (hpRatio <= 0.25) return 3;
  if (hpRatio <= 0.60) return 2;
  return 1;
}

function ensureBossHellState(enemy) {
  if (!enemy.bulletHellState) {
    enemy.bulletHellState = {
      cooldown: 48,
      windup: 0,
      movementLock: 0,
      patternIndex: 0,
      phase: 1,
      spiralAngle: Math.random() * Math.PI * 2,
      pendingPattern: null,
      announcedPhases: new Set([1])
    };
  }
  return enemy.bulletHellState;
}

function liveBossHellProjectileBudget() {
  return Math.max(0, BOSS_HELL_MAX_PROJECTILES - bossHellProjectiles.length);
}

function addBossHellTelegraph(telegraph) {
  bossHellTelegraphs.push({
    life: telegraph.life || 30,
    maxLife: telegraph.life || 30,
    color: telegraph.color || "rgba(255,96,180,0.72)",
    ...telegraph
  });
  if (bossHellTelegraphs.length > 18) bossHellTelegraphs.splice(0, bossHellTelegraphs.length - 18);
}

function spawnBossHellBullet(enemy, angle, options = {}) {
  if (!isBossHellEnemy(enemy) || liveBossHellProjectileBudget() <= 0) return false;
  const speed = options.speed || 2.8;
  const startOffset = enemy.r + (options.startOffset || 10);
  const radius = options.radius || 5;
  bossHellProjectiles.push({
    x: (options.x ?? enemy.x) + Math.cos(angle) * startOffset,
    y: (options.y ?? enemy.y) + Math.sin(angle) * startOffset,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    damage: options.damage || Math.max(6, Math.round((enemy.damage || 18) * 0.44)),
    color: options.color || "rgba(255,82,180,0.92)",
    life: options.life || 210,
    sourceX: enemy.x,
    sourceY: enemy.y,
    hitCrawlers: new Set()
  });
  return true;
}

function damageCrawlerFromBossHellBullet(crawler, bullet) {
  if (!crawler || !bullet) return false;
  if (crawler === player) {
    if (typeof isPlayerDodgeInvulnerable === "function" && isPlayerDodgeInvulnerable()) return false;
    const dmg = Math.max(1, Math.round((bullet.damage || 8) - (player.defense || 0)));
    player.hp -= dmg;
    if (typeof addPlayerFeedbackText === "function") addPlayerFeedbackText(`-${dmg} HP`, { color: "#ff6bcb", size: 16 });
    if (typeof applyKnockback === "function") applyKnockback(player, bullet.sourceX ?? bullet.x - bullet.vx, bullet.sourceY ?? bullet.y - bullet.vy, 5.5);
    stats.damageTaken += dmg;
    stats.riskyMoments++;
    if (typeof changeAudience === "function") changeAudience(2);
    if (typeof updateHUD === "function") updateHUD();
    if (typeof achievement === "function" && !achievements.has("firstBossBullet")) {
      achievement("NEW ACHIEVEMENT: Decorative Dodging", "You were struck by boss magic. The dungeon insists the pattern was extremely readable.", "firstBossBullet");
    }
    if (player.hp <= 0 && typeof loseGame === "function") loseGame();
    return true;
  }

  // Multiplayer crawlers are preview-only here. The server remains authoritative later.
  const crawlerId = crawler.id || crawler.playerId || crawler.name || "remote";
  if (bullet.hitCrawlers.has(crawlerId)) return false;
  bullet.hitCrawlers.add(crawlerId);
  const dmg = Math.max(1, Math.round((bullet.damage || 8) - (crawler.defense || 0)));
  crawler.hp = Math.max(0, (crawler.hp ?? crawler.maxHp ?? player.maxHp) - dmg);
  if (crawler.hp <= 0) crawler.status = "downed";
  return true;
}

function updateBossHellProjectiles() {
  for (let i = bossHellProjectiles.length - 1; i >= 0; i--) {
    const bullet = bossHellProjectiles[i];
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.life--;

    if (bullet.life <= 0 || isBlocked(bullet.x, bullet.y)) {
      bossHellProjectiles.splice(i, 1);
      continue;
    }

    let consumed = false;
    for (const crawler of getActiveCrawlers()) {
      if (crawler.safe) continue;
      const crawlerId = crawler === player ? "local" : (crawler.id || crawler.playerId || crawler.name || "remote");
      if (bullet.hitCrawlers.has(crawlerId)) continue;
      if (Math.hypot(bullet.x - crawler.x, bullet.y - crawler.y) <= bullet.radius + getCrawlerRadius(crawler)) {
        consumed = damageCrawlerFromBossHellBullet(crawler, bullet);
        break;
      }
    }

    if (consumed) bossHellProjectiles.splice(i, 1);
  }
}

function updateBossHellTelegraphs() {
  for (let i = bossHellTelegraphs.length - 1; i >= 0; i--) {
    bossHellTelegraphs[i].life--;
    if (bossHellTelegraphs[i].life <= 0) bossHellTelegraphs.splice(i, 1);
  }
}

function bossHellTargetAngle(enemy, target) {
  if (!target) return Math.random() * Math.PI * 2;
  return Math.atan2(target.y - enemy.y, target.x - enemy.x);
}

function makeBossHellPattern(enemy, target, phase, state) {
  const sequences = {
    1: ["spread", "ring", "spread"],
    2: ["ring", "spiral", "wideSpread"],
    3: ["spiral", "laneSweep", "denseRing", "wideSpread"]
  };
  const type = sequences[phase][state.patternIndex % sequences[phase].length];
  state.patternIndex++;

  const angle = bossHellTargetAngle(enemy, target);
  const damage = Math.max(6, Math.round((enemy.damage || 18) * (phase === 3 ? 0.38 : 0.44)));
  const speed = phase === 1 ? 2.35 : phase === 2 ? 2.65 : 2.95;
  const color = phase === 1 ? "rgba(255,110,190,0.92)" : phase === 2 ? "rgba(255,86,135,0.94)" : "rgba(255,216,107,0.95)";

  if (type === "ring") return { type, count: 14 + phase * 2, speed, damage, color, windup: 34, cooldown: BOSS_HELL_BASE_COOLDOWN - phase * 8 };
  if (type === "denseRing") return { type: "ring", count: 26, speed: speed + 0.15, damage, color, skipEvery: 7, windup: 36, cooldown: 82 };
  if (type === "spiral") return { type, count: phase === 2 ? 22 : 28, speed: speed + 0.1, damage, color, windup: 38, cooldown: 76 };
  if (type === "laneSweep") return { type, speed: speed + 0.2, damage, color, windup: 44, cooldown: 88, targetX: target?.x, targetY: target?.y };
  if (type === "wideSpread") return { type: "spread", count: phase === 3 ? 7 : 5, arc: phase === 3 ? 0.92 : 0.70, angle, speed: speed + 0.2, damage, color, windup: 30, cooldown: 70 };
  return { type: "spread", count: 3, arc: 0.45, angle, speed, damage, color, windup: 28, cooldown: 76 };
}

function telegraphBossHellPattern(enemy, pattern) {
  const life = Math.max(16, pattern.windup || 28);
  if (pattern.type === "spread") {
    addBossHellTelegraph({ type: "spread", x: enemy.x, y: enemy.y, angle: pattern.angle, arc: pattern.arc, range: 150, life, color: pattern.color });
  } else if (pattern.type === "ring" || pattern.type === "spiral") {
    addBossHellTelegraph({ type: "ring", x: enemy.x, y: enemy.y, radius: pattern.type === "spiral" ? 74 : 54, life, color: pattern.color });
  } else if (pattern.type === "laneSweep" && bossRoom) {
    addBossHellTelegraph({ type: "laneSweep", room: bossRoom, targetX: pattern.targetX, targetY: pattern.targetY, life, color: pattern.color });
  }
}

function fireBossHellSpread(enemy, pattern) {
  const count = Math.max(1, pattern.count || 3);
  const arc = pattern.arc || 0;
  const startAngle = pattern.angle - arc / 2;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    spawnBossHellBullet(enemy, startAngle + arc * t, pattern);
  }
}

function fireBossHellRing(enemy, pattern) {
  const count = Math.max(8, pattern.count || 16);
  for (let i = 0; i < count; i++) {
    if (pattern.skipEvery && i % pattern.skipEvery === 0) continue;
    spawnBossHellBullet(enemy, (Math.PI * 2 * i) / count, pattern);
  }
}

function fireBossHellSpiral(enemy, pattern, state) {
  const count = Math.max(12, pattern.count || 24);
  state.spiralAngle = (state.spiralAngle || 0) + Math.PI * 0.31;
  for (let i = 0; i < count; i++) {
    if (i % 6 === 0) continue; // built-in gaps keep the pattern nasty but fair.
    const angle = state.spiralAngle + (Math.PI * 2 * i) / count;
    spawnBossHellBullet(enemy, angle, pattern);
  }
}

function fireBossHellLaneSweep(enemy, pattern) {
  if (!bossRoom) return;
  const horizontal = Math.abs((pattern.targetX ?? player.x) - enemy.x) > Math.abs((pattern.targetY ?? player.y) - enemy.y);
  const targetTile = {
    x: Math.floor((pattern.targetX ?? player.x) / TILE),
    y: Math.floor((pattern.targetY ?? player.y) / TILE)
  };
  const stepTiles = 3;

  if (horizontal) {
    const fromLeft = targetTile.x >= bossRoom.cx;
    const spawnX = (fromLeft ? bossRoom.x + 1 : bossRoom.x + bossRoom.w - 2) * TILE + TILE / 2;
    const angle = fromLeft ? 0 : Math.PI;
    for (let y = bossRoom.y + 2; y < bossRoom.y + bossRoom.h - 2; y += stepTiles) {
      if (Math.abs(y - targetTile.y) <= 1) continue;
      spawnBossHellBullet(enemy, angle, { ...pattern, x: spawnX, y: y * TILE + TILE / 2, startOffset: 0, life: 180 });
    }
  } else {
    const fromTop = targetTile.y >= bossRoom.cy;
    const spawnY = (fromTop ? bossRoom.y + 1 : bossRoom.y + bossRoom.h - 2) * TILE + TILE / 2;
    const angle = fromTop ? Math.PI / 2 : -Math.PI / 2;
    for (let x = bossRoom.x + 2; x < bossRoom.x + bossRoom.w - 2; x += stepTiles) {
      if (Math.abs(x - targetTile.x) <= 1) continue;
      spawnBossHellBullet(enemy, angle, { ...pattern, x: x * TILE + TILE / 2, y: spawnY, startOffset: 0, life: 180 });
    }
  }
}

function fireBossHellPattern(enemy, pattern, state) {
  if (!pattern || !isBossHellEnemy(enemy)) return;
  if (pattern.type === "spread") fireBossHellSpread(enemy, pattern);
  else if (pattern.type === "ring") fireBossHellRing(enemy, pattern);
  else if (pattern.type === "spiral") fireBossHellSpiral(enemy, pattern, state);
  else if (pattern.type === "laneSweep") fireBossHellLaneSweep(enemy, pattern);
}

function announceBossHellPhase(enemy, phase, state) {
  if (state.announcedPhases.has(phase)) return;
  state.announcedPhases.add(phase);
  if (phase === 2) announcer(`${enemy.name || "The boss"} changes rhythm. The floor is now participating.`);
  if (phase === 3) announcer(`${enemy.name || "The boss"} enters panic mode. Respect the gaps. The gaps are your friends.`);
}

function updateBossHellPatterns() {
  const enemy = bossEnemy;
  if (!isBossHellEnemy(enemy) || !bossAggroed || enemy.hp <= 0 || enemy.isDying || gameWon || gameLost) return;
  if (!getActiveCrawlers().some(crawler => !crawler.safe)) return;

  const state = ensureBossHellState(enemy);
  const phase = getBossHellPhase(enemy);
  state.phase = phase;
  announceBossHellPhase(enemy, phase, state);

  if (state.windup > 0) {
    state.windup--;
    enemy.visualMoving = false;
    setEnemyAnimationState(enemy, "idle");
    if (state.windup === 0) {
      fireBossHellPattern(enemy, state.pendingPattern, state);
      state.cooldown = state.pendingPattern?.cooldown || BOSS_HELL_BASE_COOLDOWN;
      state.pendingPattern = null;
    }
    return;
  }

  state.cooldown = Math.max(0, (state.cooldown || 0) - 1);
  if (state.cooldown > 0) return;

  const targetInfo = getNearestActiveCrawler(enemy.x, enemy.y);
  const target = targetInfo?.crawler || player;
  const pattern = makeBossHellPattern(enemy, target, phase, state);
  state.pendingPattern = pattern;
  state.windup = pattern.windup;
  state.movementLock = Math.max(state.movementLock || 0, pattern.windup + 8);
  telegraphBossHellPattern(enemy, pattern);
}

function drawBossHellTelegraphs() {
  if (!bossHellTelegraphs.length) return;
  ctx.save();
  for (const telegraph of bossHellTelegraphs) {
    const alpha = bossHellClamp(telegraph.life / Math.max(1, telegraph.maxLife), 0, 1);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = telegraph.color;
    ctx.fillStyle = "rgba(255,80,170,0.08)";
    ctx.lineWidth = 3;

    if (telegraph.type === "spread") {
      const rays = 5;
      const startAngle = telegraph.angle - telegraph.arc / 2;
      for (let i = 0; i < rays; i++) {
        const t = rays === 1 ? 0.5 : i / (rays - 1);
        const angle = startAngle + telegraph.arc * t;
        ctx.beginPath();
        ctx.moveTo(telegraph.x, telegraph.y);
        ctx.lineTo(telegraph.x + Math.cos(angle) * telegraph.range, telegraph.y + Math.sin(angle) * telegraph.range);
        ctx.stroke();
      }
    } else if (telegraph.type === "ring") {
      ctx.beginPath();
      ctx.arc(telegraph.x, telegraph.y, telegraph.radius || 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (telegraph.type === "laneSweep" && telegraph.room) {
      const room = telegraph.room;
      ctx.strokeRect(room.x * TILE, room.y * TILE, room.w * TILE, room.h * TILE);
      if (Number.isFinite(telegraph.targetX) && Number.isFinite(telegraph.targetY)) {
        ctx.beginPath();
        ctx.arc(telegraph.targetX, telegraph.targetY, TILE * 1.35, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawBossHellProjectiles() {
  if (!bossHellProjectiles.length) return;
  ctx.save();
  for (const bullet of bossHellProjectiles) {
    const tx = Math.floor(bullet.x / TILE), ty = Math.floor(bullet.y / TILE);
    if (!visible[ty]?.[tx]) continue;
    ctx.fillStyle = bullet.color || "rgba(255,82,180,0.92)";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.68)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

const updateProjectilesWithoutBossHell = typeof updateProjectiles === "function" ? updateProjectiles : null;
if (updateProjectilesWithoutBossHell && !updateProjectilesWithoutBossHell.__bossHellWrapped) {
  updateProjectiles = function updateProjectilesWithBossHell() {
    updateBossHellProjectiles();
    updateBossHellTelegraphs();
    updateProjectilesWithoutBossHell();
  };
  updateProjectiles.__bossHellWrapped = true;
}

const updateEnemiesWithoutBossHell = typeof updateEnemies === "function" ? updateEnemies : null;
if (updateEnemiesWithoutBossHell && !updateEnemiesWithoutBossHell.__bossHellWrapped) {
  updateEnemies = function updateEnemiesWithBossHell() {
    updateBossHellPatterns();
    updateEnemiesWithoutBossHell();
  };
  updateEnemies.__bossHellWrapped = true;
}

const calculateEnemyMovementWithoutBossHell = typeof calculateEnemyMovement === "function" ? calculateEnemyMovement : null;
if (calculateEnemyMovementWithoutBossHell && !calculateEnemyMovementWithoutBossHell.__bossHellWrapped) {
  calculateEnemyMovement = function calculateEnemyMovementWithBossHell(enemy, targetCrawler, canSeeTarget, bossCanAlwaysTrack, dist) {
    const movement = calculateEnemyMovementWithoutBossHell(enemy, targetCrawler, canSeeTarget, bossCanAlwaysTrack, dist);
    if (!isBossHellEnemy(enemy)) return movement;

    const state = ensureBossHellState(enemy);
    if (state.movementLock > 0) {
      state.movementLock--;
      setEnemyAnimationState(enemy, "idle");
      return { dx: 0, dy: 0 };
    }

    if (targetCrawler && dist < 118) {
      const away = normalizeVector(enemy.x - targetCrawler.x, enemy.y - targetCrawler.y);
      return { dx: away.x * enemy.speed * 0.74, dy: away.y * enemy.speed * 0.74 };
    }

    return { dx: movement.dx * 0.68, dy: movement.dy * 0.68 };
  };
  calculateEnemyMovement.__bossHellWrapped = true;
}

const drawCombatVisualsWithoutBossHell = typeof drawCombatVisuals === "function" ? drawCombatVisuals : null;
if (drawCombatVisualsWithoutBossHell && !drawCombatVisualsWithoutBossHell.__bossHellWrapped) {
  drawCombatVisuals = function drawCombatVisualsWithBossHell() {
    drawBossHellTelegraphs();
    drawCombatVisualsWithoutBossHell();
    drawBossHellProjectiles();
  };
  drawCombatVisuals.__bossHellWrapped = true;
}

const resetStateWithoutBossHell = typeof resetState === "function" ? resetState : null;
if (resetStateWithoutBossHell && !resetStateWithoutBossHell.__bossHellWrapped) {
  resetState = function resetStateWithBossHell(...args) {
    clearBossHellProjectiles();
    return resetStateWithoutBossHell(...args);
  };
  resetState.__bossHellWrapped = true;
}

const completeBossEncounterWithoutBossHell = typeof completeBossEncounter === "function" ? completeBossEncounter : null;
if (completeBossEncounterWithoutBossHell && !completeBossEncounterWithoutBossHell.__bossHellWrapped) {
  completeBossEncounter = function completeBossEncounterWithBossHell(enemy) {
    clearBossHellProjectiles();
    completeBossEncounterWithoutBossHell(enemy);
  };
  completeBossEncounter.__bossHellWrapped = true;
}
