
const DODGE_DURATION_FRAMES = 16;
const DODGE_INVULN_FRAMES = 11;
const DODGE_COOLDOWN_FRAMES = 42;
const DODGE_SPEED = 6.4;
const DODGE_EFFECT_MAX_LIFE = 18;

function resetPlayerDodgeState() {
  player.dodgeCooldown = 0;
  player.dodgeFrames = 0;
  player.dodgeMaxFrames = 0;
  player.dodgeInvulnFrames = 0;
  player.dodgeDirX = 0;
  player.dodgeDirY = 0;
  player.dodgeVisualFrame = 0;
  player.dodgeFlashFrames = 0;
}

function isPlayerDodging() {
  return player.dodgeFrames > 0;
}

function isPlayerDodgeInvulnerable() {
  return player.dodgeInvulnFrames > 0;
}

function isMajorUiOpen() {
  return typeof getActiveControllerWindow === "function" && !!getActiveControllerWindow();
}

function isDodgeBlockedByGameState() {
  return gameWon || gameLost || pendingFloorAdvance || isGameplayUpdatePaused() || player.pvpFreezeFrames > 0 || isMajorUiOpen();
}

function spawnDodgePuff(x, y, dirX, dirY, phase = "start") {
  dodgePuffs.push({
    x,
    y,
    dirX,
    dirY,
    phase,
    life: 18,
    maxLife: 18,
    size: phase === "start" ? 8 : 10
  });
}

function spawnDodgeAfterimage() {
  if (dodgeAfterimages.length > 8) dodgeAfterimages.shift();
  dodgeAfterimages.push({
    x: player.x,
    y: player.y,
    aimX: player.aimX,
    aimY: player.aimY,
    frame: player.dodgeVisualFrame || 0,
    life: DODGE_EFFECT_MAX_LIFE,
    maxLife: DODGE_EFFECT_MAX_LIFE
  });
}

function triggerDodge() {
  if (isDodgeBlockedByGameState()) return false;
  if (player.dodgeCooldown > 0 || isPlayerDodging()) return false;

  const keyboardX = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
  const keyboardY = (keys["s"] || keys["arrowdown"] ? 1 : 0) - (keys["w"] || keys["arrowup"] ? 1 : 0);
  let dirX = keyboardX + (gamepadState.moveX || 0) + (touchState.moveX || 0);
  let dirY = keyboardY + (gamepadState.moveY || 0) + (touchState.moveY || 0);
  if (Math.hypot(dirX, dirY) <= 0.18) {
    dirX = Number.isFinite(player.aimX) ? player.aimX : 1;
    dirY = Number.isFinite(player.aimY) ? player.aimY : 0;
  }
  const len = Math.hypot(dirX, dirY) || 1;
  player.dodgeDirX = dirX / len;
  player.dodgeDirY = dirY / len;
  updatePlayerAim(player.dodgeDirX, player.dodgeDirY);
  player.dodgeFrames = DODGE_DURATION_FRAMES;
  player.dodgeMaxFrames = DODGE_DURATION_FRAMES;
  player.dodgeInvulnFrames = DODGE_INVULN_FRAMES;
  player.dodgeCooldown = DODGE_COOLDOWN_FRAMES;
  player.dodgeVisualFrame = 0;
  player.dodgeFlashFrames = 7;
  spawnDodgeAfterimage();
  spawnDodgePuff(player.x, player.y, -player.dodgeDirX, -player.dodgeDirY, "start");
  updateDodgeButtonCooldown();
  return true;
}

function updateDodgeButtonCooldown() {
  const btn = document.getElementById("btnDodge");
  if (!btn) return;
  const pct = player.dodgeCooldown > 0 ? Math.max(0, Math.min(1, player.dodgeCooldown / DODGE_COOLDOWN_FRAMES)) : 0;
  btn.style.setProperty("--cooldown", pct.toFixed(3));
  btn.classList.toggle("cooling", pct > 0);
}

function updateDodgeEffects() {
  for (let i = dodgeAfterimages.length - 1; i >= 0; i--) {
    dodgeAfterimages[i].life--;
    if (dodgeAfterimages[i].life <= 0) dodgeAfterimages.splice(i, 1);
  }
  for (let i = dodgePuffs.length - 1; i >= 0; i--) {
    dodgePuffs[i].life--;
    if (dodgePuffs[i].life <= 0) dodgePuffs.splice(i, 1);
  }
}

function updateDodgeMovement() {
  if (!isPlayerDodging()) return false;
  if (isDodgeBlockedByGameState()) {
    resetPlayerDodgeState();
    updateDodgeButtonCooldown();
    return false;
  }
  const beforeX = player.x;
  const beforeY = player.y;
  const progress = 1 - (player.dodgeFrames / Math.max(1, player.dodgeMaxFrames));
  const ease = 0.72 + Math.sin(progress * Math.PI) * 0.5;
  const step = DODGE_SPEED * ease;
  moveEntity(player, player.dodgeDirX * step, player.dodgeDirY * step, { countWallBump: false });
  player.dodgeFrames = Math.max(0, player.dodgeFrames - 1);
  player.dodgeInvulnFrames = Math.max(0, player.dodgeInvulnFrames - 1);
  player.dodgeVisualFrame++;
  if (player.dodgeFlashFrames > 0) player.dodgeFlashFrames--;
  if (player.dodgeVisualFrame === 5 || player.dodgeVisualFrame === 10) spawnDodgeAfterimage();
  const blockedEarly = Math.hypot(player.x - beforeX, player.y - beforeY) < step * 0.35;
  if (blockedEarly) {
    player.dodgeFrames = 0;
    player.dodgeInvulnFrames = 0;
  }
  if (player.dodgeFrames === 0) {
    spawnDodgePuff(player.x, player.y, player.dodgeDirX, player.dodgeDirY, "end");
  }
  return true;
}


function getLocalCrawler() {
  return player;
}

function getRemoteCrawlers() {
  if (!multiplayer?.remotePlayers) return [];
  return Array.from(multiplayer.remotePlayers.values()).filter(Boolean);
}

function isCrawlerActive(crawler) {
  return !!crawler && crawler.status !== "downed" && crawler.status !== "failed" && (crawler.hp ?? 0) > 0;
}

function getActiveCrawlers({ includeRemote = true } = {}) {
  const crawlers = [getLocalCrawler()];
  if (includeRemote) crawlers.push(...getRemoteCrawlers());
  return crawlers.filter(isCrawlerActive);
}

function getNearestActiveCrawler(x, y, options = {}) {
  let best = null;
  let bestDist = Infinity;
  for (const crawler of getActiveCrawlers(options)) {
    const cx = Number(crawler.x);
    const cy = Number(crawler.y);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    const dist = Math.hypot(cx - x, cy - y);
    if (dist < bestDist) {
      best = crawler;
      bestDist = dist;
    }
  }
  return best ? { crawler: best, dist: bestDist } : null;
}

function getNearestVisibleCrawler(x, y, maxDistance = Infinity, options = {}) {
  let best = null;
  let bestDist = Infinity;
  for (const crawler of getActiveCrawlers(options)) {
    if (crawler.safe) continue;
    const cx = Number(crawler.x);
    const cy = Number(crawler.y);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    const dist = Math.hypot(cx - x, cy - y);
    if (dist > maxDistance || dist >= bestDist) continue;
    if (!hasLineOfSight(x, y, cx, cy)) continue;
    best = crawler;
    bestDist = dist;
  }
  return best ? { crawler: best, dist: bestDist } : null;
}

function getCrawlerRadius(crawler) {
  return Number.isFinite(Number(crawler?.r)) ? Number(crawler.r) : player.r;
}

function tileAt(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || tx >= MAP_COLS || ty < 0 || ty >= MAP_ROWS) return "#";
  return map[ty][tx];
}

function isBlocked(px, py) { const t = tileAt(px, py); return t === "#" || t === "D" || t === "L"; }
function canMoveTo(x, y, r) {
  return !isBlocked(x - r, y - r) && !isBlocked(x + r, y - r) && !isBlocked(x - r, y + r) && !isBlocked(x + r, y + r);
}

function moveEntity(entity, dx, dy, options = {}) {
  if (dx === 0 && dy === 0) return;
  const countWallBump = options.countWallBump !== false;
  let nx = entity.x + dx, ny = entity.y;
  if (canMoveTo(nx, ny, entity.r)) entity.x = nx;
  else if (entity === player && countWallBump) {
    stats.wallBumps++;
    if (stats.wallBumps === 10) achievement("NEW ACHIEVEMENT: Wall Scholar", "You have studied the wall with your face ten times. The wall remains undefeated.", "wallScholar");
  }

  nx = entity.x; ny = entity.y + dy;
  if (canMoveTo(nx, ny, entity.r)) entity.y = ny;
  else if (entity === player && countWallBump) stats.wallBumps++;
}

function applyKnockback(entity, fromX, fromY, distance) {
  if (!entity || !Number.isFinite(distance) || distance <= 0) return;
  if (entity === player && isPlayerDodging()) return;
  const dx = entity.x - fromX;
  const dy = entity.y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const capped = Math.min(distance, entity === player ? 9 : 18);
  const step = 3;
  let remaining = capped;
  while (remaining > 0) {
    const amount = Math.min(step, remaining);
    moveEntity(entity, dx / len * amount, dy / len * amount, { countWallBump: false });
    remaining -= amount;
  }
}


function updateBossLocks(){
  // dcw_010: no timed boss-room lockdown.
  // Pending locks are handled by processPendingBossLocks() after aggro.
  processPendingBossLocks();
}

function updatePlayer() {
  if (isMajorUiOpen()) {
    player.attackCooldown = Math.max(0, player.attackCooldown - 1);
    player.dodgeCooldown = Math.max(0, player.dodgeCooldown - 1);
    return;
  }
  const previousTileX = Math.floor(player.x / TILE);
  const previousTileY = Math.floor(player.y / TILE);
  player.lastTileX = previousTileX;
  player.lastTileY = previousTileY;
  let keyboardX = 0, keyboardY = 0;
  if (keys["w"] || keys["arrowup"]) keyboardY--;
  if (keys["s"] || keys["arrowdown"]) keyboardY++;
  if (keys["a"] || keys["arrowleft"]) keyboardX--;
  if (keys["d"] || keys["arrowright"]) keyboardX++;

  const movementX = keyboardX + gamepadState.moveX + touchState.moveX;
  const movementY = keyboardY + gamepadState.moveY + touchState.moveY;
  const aimLength = Math.hypot(gamepadState.aimX, gamepadState.aimY);
  const touchAttackAimLength = Math.hypot(touchState.attackX, touchState.attackY);
  const fallbackAimX = keyboardX + touchState.moveX;
  const fallbackAimY = keyboardY + touchState.moveY;

  if (aimLength > 0) {
    updatePlayerAim(gamepadState.aimX, gamepadState.aimY);
  } else if (touchAttackAimLength > 0) {
    updatePlayerAim(touchState.attackX, touchState.attackY);
  } else if (Math.hypot(fallbackAimX, fallbackAimY) > 0) {
    updatePlayerAim(fallbackAimX, fallbackAimY);
  } else if (gamepadState.connected && !gamepadState.hasAimInput && Math.hypot(gamepadState.moveX, gamepadState.moveY) > 0) {
    updatePlayerAim(gamepadState.moveX, gamepadState.moveY);
  }

  let dx = movementX;
  let dy = movementY;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx = dx / len * player.speed;
    dy = dy / len * player.speed;
  }

  if (player.pvpFreezeFrames > 0) {
    player.pvpFreezeFrames = Math.max(0, player.pvpFreezeFrames - 1);
    dx = 0;
    dy = 0;
  } else if (!updateDodgeMovement()) {
    moveEntity(player, dx, dy);
  }
  player.attackCooldown = Math.max(0, player.attackCooldown - 1);
  player.dodgeCooldown = Math.max(0, player.dodgeCooldown - 1);
  updateDodgeEffects();
  updateDodgeButtonCooldown();
  if (touchState.attackActive && player.pvpFreezeFrames <= 0 && !isPlayerDodging()) attack();

  const currentTile = tileAt(player.x, player.y);
  player.safe = currentTile === "S";
  updateCurrentRoom();

  if (player.safe) stats.timeInSafeRoomFrames++;
  else stats.timeOutsideSafeRoomFrames++;

  if (player.safe && !player.wasSafe) {
    stats.safeRoomEntries++;
    if (stats.safeRoomEntries > 1) announcer("Safe room re-entry detected. Press R or Y if you require the dungeon to summarize your questionable choices.");
    else announcer("Safe room entered. Press R or Y for your performance review, assuming your ego is insured.");
  }

  if (!player.safe && player.wasSafe) hideSafeRoomRecap();
  player.wasSafe = player.safe;

  if (currentTile !== "S" && !achievements.has("leftSafeRoom")) achievement("NEW ACHIEVEMENT: Bad Decision Geography", "You left the safe room. Statistically speaking, this is where problems begin.", "leftSafeRoom");

  if (currentTile === "E" && !gameWon) {
    descendStairwell();
  }
}


function hasLineOfSight(x1, y1, x2, y2) {
  const tx1 = Math.floor(x1 / TILE);
  const ty1 = Math.floor(y1 / TILE);
  const tx2 = Math.floor(x2 / TILE);
  const ty2 = Math.floor(y2 / TILE);

  let x = tx1;
  let y = ty1;
  const dx = Math.abs(tx2 - tx1);
  const dy = Math.abs(ty2 - ty1);
  const sx = tx1 < tx2 ? 1 : -1;
  const sy = ty1 < ty2 ? 1 : -1;
  let err = dx - dy;

  while (!(x === tx2 && y === ty2)) {
    if (!(x === tx1 && y === ty1)) {
      if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return false;
      const t = map[y]?.[x];
      if (t === "#" || t === "D" || t === "L") return false;
    }

    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }

  return true;
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);
  if (length <= 0.0001) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

function countNearbySwarmAllies(enemy) {
  if (!Array.isArray(enemies)) return 0;
  return enemies.filter(other => other !== enemy && other.hp > 0 && other.behaviorTag === "rat_swarm" && Math.hypot(other.x - enemy.x, other.y - enemy.y) < 76).length;
}

function updateSpiderLungeState(enemy, targetCrawler, dist, canSeeTarget, tag) {
  const state = enemy.behaviorState || (enemy.behaviorState = {});
  state.lungeCooldown = Math.max(0, (state.lungeCooldown || 0) - 1);
  state.windup = Math.max(0, state.windup || 0);
  state.lungeFrames = Math.max(0, state.lungeFrames || 0);
  state.repositionFrames = Math.max(0, state.repositionFrames || 0);

  if (state.windup > 0) {
    state.windup--;
    enemy.animationState = "windup";
    if (state.windup === 0) {
      const dir = normalizeVector(targetCrawler.x - enemy.x, targetCrawler.y - enemy.y);
      state.lungeDirX = dir.x;
      state.lungeDirY = dir.y;
      state.lungeFrames = tag === "spider_hit_and_run" ? 11 : 14;
      state.lungeCooldown = tag === "spider_hit_and_run" ? 72 : 56;
    }
    return { dx: 0, dy: 0 };
  }

  if (state.lungeFrames > 0) {
    state.lungeFrames--;
    enemy.animationState = "lunge";
    const lungeSpeed = enemy.speed * (tag === "spider_hit_and_run" ? 1.9 : 2.15);
    return { dx: (state.lungeDirX || 0) * lungeSpeed, dy: (state.lungeDirY || 0) * lungeSpeed };
  }

  if (tag === "spider_hit_and_run" && state.repositionFrames > 0) {
    state.repositionFrames--;
    enemy.animationState = "reposition";
    const away = normalizeVector(enemy.x - targetCrawler.x, enemy.y - targetCrawler.y);
    const side = state.repositionSide || 1;
    return {
      dx: (away.x * 0.72 + -away.y * side * 0.58) * enemy.speed * 1.22,
      dy: (away.y * 0.72 + away.x * side * 0.58) * enemy.speed * 1.22
    };
  }

  if (canSeeTarget && dist < (tag === "spider_hit_and_run" ? 168 : 148) && state.lungeCooldown <= 0) {
    state.windup = tag === "spider_hit_and_run" ? 12 : 16;
    state.repositionSide = Math.random() < 0.5 ? -1 : 1;
    enemy.animationState = "windup";
    return { dx: 0, dy: 0 };
  }

  return null;
}

function calculateEnemyMovement(enemy, targetCrawler, canSeeTarget, bossCanAlwaysTrack, dist) {
  const tag = enemy.behaviorTag || "";
  const state = enemy.behaviorState || (enemy.behaviorState = {});
  setEnemyAnimationState(enemy, "walk");

  if (targetCrawler && (canSeeTarget || bossCanAlwaysTrack)) {
    if (tag === "spider_lunge" || tag === "spider_hit_and_run") {
      const spiderMove = updateSpiderLungeState(enemy, targetCrawler, dist, canSeeTarget || bossCanAlwaysTrack, tag);
      if (spiderMove) return spiderMove;
    }

    const dir = normalizeVector(targetCrawler.x - enemy.x, targetCrawler.y - enemy.y);
    let speed = enemy.speed;
    let strafe = 0;

    if (tag === "rat_swarm") {
      const allies = countNearbySwarmAllies(enemy);
      speed *= 1.08 + Math.min(0.08, allies * 0.025);
      if (allies > 0 && dist > getCrawlerRadius(targetCrawler) + enemy.r + 18) strafe = (state.swarmSide || (state.swarmSide = Math.random() < 0.5 ? -1 : 1)) * 0.12;
    } else if (tag === "rat_bruiser") {
      speed *= 0.92;
    } else if (tag === "bot_patrol") {
      speed *= 0.78;
    } else if (tag === "guard_bruiser") {
      speed *= 0.98;
    } else if (tag === "drone_skirmisher") {
      speed *= 1.16;
      strafe = (state.skirmishSide || (state.skirmishSide = Math.random() < 0.5 ? -1 : 1)) * (dist < 130 ? 0.72 : 0.36);
      if (Math.random() < 0.018) state.skirmishSide *= -1;
    } else if (tag === "boss_gatekeeper") {
      speed *= 0.95;
    } else if (tag === "boss_skeleton") {
      speed *= 0.9;
    }

    return {
      dx: (dir.x + -dir.y * strafe) * speed,
      dy: (dir.y + dir.x * strafe) * speed
    };
  }

  setEnemyAnimationState(enemy, "idle");
  const patrolSpeed = tag === "bot_patrol" ? 0.24 : tag === "drone_skirmisher" ? 0.48 : 0.35;
  if (Math.random() < (tag === "bot_patrol" ? 0.006 : 0.015)) enemy.wanderAngle = Math.random() * Math.PI * 2;
  return { dx: Math.cos(enemy.wanderAngle) * patrolSpeed, dy: Math.sin(enemy.wanderAngle) * patrolSpeed };
}

function setEnemyAnimationState(enemy, state) {
  if (!enemy || enemy.animationState === state) return;
  enemy.animationState = state;
  enemy.animationStartedAt = frameCount;
}

function updateEnemyFacing(enemy, dx, dy) {
  if (!enemy?.spriteKey) return;
  enemy.visualMoving = Math.hypot(dx, dy) >= 0.05;
  if (!enemy.visualMoving) return;
  enemy.facingX = dx;
  enemy.facingY = dy;
}

function enemyPlayerKnockbackMultiplier(enemy) {
  if (enemy?.behaviorTag === "rat_bruiser") return 1.32;
  if (enemy?.behaviorTag === "guard_bruiser") return 1.18;
  if (enemy?.behaviorTag === "bot_patrol") return 1.08;
  if (enemy?.behaviorTag === "drone_skirmisher") return 0.9;
  return 1;
}


function damageCrawlerFromEnemy(crawler, enemy) {
  if (!crawler || enemy.damageCooldown > 0) return false;
  if (crawler === player) {
    if (isPlayerDodgeInvulnerable()) return false;
    const rawDmg = enemy.damage || 8;
    const dmg = Math.max(1, rawDmg - player.defense);
    player.hp -= dmg;
    addPlayerFeedbackText(`-${dmg} HP`, { color: "#ff6b6b", size: 16 });
    applyKnockback(player, enemy.x, enemy.y, (5 + Math.min(4, dmg * 0.18)) * enemyPlayerKnockbackMultiplier(enemy));
    stats.damageTaken += dmg;
    stats.riskyMoments++;
    changeAudience(1);
    enemy.damageCooldown = 70;
    if (enemy.behaviorTag === "spider_hit_and_run") {
      enemy.behaviorState = enemy.behaviorState || {};
      enemy.behaviorState.repositionFrames = 36;
    }
    updateHUD();
    if (!achievements.has("firstHit")) achievement("NEW ACHIEVEMENT: Physical Contact", "A dungeon creature touched you without consent. Human resources has been eaten.", "firstHit");
    if (player.hp <= 0) loseGame();
    return true;
  }

  // Remote/mock crawlers are non-authoritative here; keep local previews minimal and never end the local run.
  const rawDmg = enemy.damage || 8;
  const dmg = Math.max(1, rawDmg - (crawler.defense || 0));
  crawler.hp = Math.max(0, (crawler.hp ?? crawler.maxHp ?? player.maxHp) - dmg);
  if (crawler.hp <= 0) crawler.status = "downed";
  enemy.damageCooldown = 70;
  return true;
}

function updateEnemies() {
  processPendingBossLocks();
  for (const corpse of corpses) {
    if (corpse.looted) continue;
    const tx = Math.floor(corpse.x / TILE), ty = Math.floor(corpse.y / TILE);
    if (!visible[ty]?.[tx]) continue;

    ctx.fillStyle = corpse.boss ? "rgba(120,70,160,0.9)" : "rgba(105,88,72,0.9)";
    ctx.beginPath();
    ctx.ellipse(corpse.x, corpse.y + 2, corpse.r + 4, Math.max(6, corpse.r * 0.55), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = corpse.boss ? "rgba(255,216,107,0.85)" : "rgba(210,190,160,0.35)";
    ctx.lineWidth = corpse.boss ? 2 : 1;
    ctx.stroke();
    ctx.lineWidth = 1;
  }
for (const enemy of enemies) {
    if (enemy.isDying) {
      const deathAnim = enemy.animations?.death;
      const deathTicks = deathAnim ? Math.ceil((deathAnim.frames?.length || 1) * (60 / Math.max(1, deathAnim.fps || 8))) : 0;
      if (!deathAnim || frameCount - (enemy.animationStartedAt || frameCount) >= deathTicks) {
        enemy.isDying = false;
        enemy.deathAnimationComplete = true;
        stats.enemiesKilled++;
        changeAudience(enemy.boss ? 10 : 4);
        gainXP(enemy.xpReward || 15);
        createCorpse(enemy);
        if (enemy.boss) completeBossEncounter(enemy);
        achievement("NEW ACHIEVEMENT: Pest Control Adjacent", `You killed a level ${enemy.level || 1} dungeon creature. It left behind a corpse. The dungeon calls this an interactive container with smell.`);
      }
      continue;
    }
    if (enemy.hp <= 0) continue;
    enemy.damageCooldown = Math.max(0, enemy.damageCooldown - 1);
    if (enemy.pendingAttack) {
      enemy.visualMoving = false;
      const attack = enemy.animations?.attack;
      const ticksPerFrame = attack?.fps ? Math.max(1, Math.round(60 / attack.fps)) : 5;
      const damageFrame = attack?.damageFrame ?? Math.max(0, Math.floor((attack?.frames?.length || 1) * 0.65));
      const elapsed = frameCount - (enemy.animationStartedAt || frameCount);
      if (!enemy.pendingAttack.damageApplied && elapsed >= damageFrame * ticksPerFrame) {
        const crawler = enemy.pendingAttack.target;
        if (crawler && Math.hypot(crawler.x - enemy.x, crawler.y - enemy.y) < getCrawlerRadius(crawler) + enemy.r + (enemy.attackReach || 4)) {
          damageCrawlerFromEnemy(crawler, enemy);
        }
        enemy.pendingAttack.damageApplied = true;
      }
      if (elapsed >= (attack?.frames?.length || 1) * ticksPerFrame) {
        enemy.pendingAttack = null;
        setEnemyAnimationState(enemy, "idle");
      }
      continue;
    }
    if (!getActiveCrawlers().some(crawler => !crawler.safe)) {
      enemy.visualMoving = false;
      continue;
    }

    const exTile = Math.floor(enemy.x / TILE), eyTile = Math.floor(enemy.y / TILE);
    if (!seen[eyTile]?.[exTile] && !collapseStarted) continue;

    const remoteSynced = typeof updateFloor0EnemySyncInterpolation === "function" && updateFloor0EnemySyncInterpolation(enemy);

    if (!remoteSynced) {
      const visibleTarget = getNearestVisibleCrawler(enemy.x, enemy.y, enemy.aggroRange || 210);
      const fallbackTarget = enemy.boss && bossAggroed ? getNearestActiveCrawler(enemy.x, enemy.y) : null;
      const targetInfo = visibleTarget || fallbackTarget;
      const targetCrawler = targetInfo?.crawler || null;
      const dist = targetInfo?.dist ?? Infinity;
      const canSeeTarget = !!visibleTarget;
      if (enemy.boss && !bossAggroed && canSeeTarget) {
        triggerBossAggro("seen");
      }
      const bossCanAlwaysTrack = enemy.boss && bossAggroed;
      const movement = calculateEnemyMovement(enemy, targetCrawler, canSeeTarget, bossCanAlwaysTrack, dist);
      updateEnemyFacing(enemy, movement.dx, movement.dy);
      moveEntity(enemy, movement.dx, movement.dy);
    }
    if (typeof floor0EnemyRoomId === "function") {
      const roomId = floor0EnemyRoomId(enemy);
      if (Number.isFinite(Number(roomId))) enemy.roomId = Math.trunc(Number(roomId));
    }

    for (const crawler of getActiveCrawlers()) {
      const newDist = Math.hypot(crawler.x - enemy.x, crawler.y - enemy.y);
      if (newDist < getCrawlerRadius(crawler) + enemy.r + (enemy.attackReach || 4)) {
        if (enemy.animations?.attack && enemy.damageCooldown <= 0) {
          enemy.pendingAttack = { target: crawler, damageApplied: false };
          setEnemyAnimationState(enemy, "attack");
        } else {
          damageCrawlerFromEnemy(crawler, enemy);
        }
        break;
      }
    }
  }
}

function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

function getWeaponDamage(weapon) {
  const base = weapon.damage + Math.max(0, player.attackDamage - 20);
  const skillMult = typeof getWeaponSkillDamageMultiplier === "function" ? getWeaponSkillDamageMultiplier(weapon) : 1;
  const meleeMult = typeof getMeleeDamageMultiplier === "function" && weapon.attackShape?.type !== "projectile" ? getMeleeDamageMultiplier() : 1;
  const critChance = typeof getProgressionCritChance === "function" ? getProgressionCritChance() : 0;
  const critMult = Math.random() < critChance ? 1.25 : 1;
  return Math.round(base * skillMult * meleeMult * critMult);
}

function damageEnemy(enemy, damage, sourceWeapon = null, attacker = player) {
  if (!enemy || enemy.hp <= 0) return false;
  if (enemy.boss) triggerBossAggro("attack");
  const dealt = Math.max(0, Math.min(enemy.hp, damage));
  enemy.hp -= damage;
  addFloatingFeedbackText(`-${Math.round(dealt)}`, enemy.x, enemy.y - enemy.r, { anchor: enemy, color: enemy.boss ? "#ff9df8" : "#ffb86b", size: enemy.boss ? 17 : 15 });
  applyKnockback(enemy, attacker.x, attacker.y, (enemy.boss ? 0.45 : 1) * Math.min(18, 4 + dealt * 0.32));
  if (dealt > 0 && typeof awardWeaponSkillXpForHit === "function") awardWeaponSkillXpForHit(sourceWeapon || getCurrentWeapon(), dealt);
  if (typeof sendFloor0EnemyEvent === "function") sendFloor0EnemyEvent(enemy.hp <= 0 ? "enemy_killed" : "enemy_damaged", enemy);
  if (enemy.hp <= 0) {
    if (enemy.animations?.death) {
      enemy.hp = 0;
      enemy.pendingAttack = null;
      enemy.isDying = true;
      setEnemyAnimationState(enemy, "death");
    } else {
      stats.enemiesKilled++;
      changeAudience(enemy.boss ? 10 : 4);
      gainXP(enemy.xpReward || 15);
      createCorpse(enemy);
      if (enemy.boss) completeBossEncounter(enemy);
      achievement("NEW ACHIEVEMENT: Pest Control Adjacent", `You killed a level ${enemy.level || 1} dungeon creature. It left behind a corpse. The dungeon calls this an interactive container with smell.`);
    }
  }
  return true;
}

function resolveAttackShapeArgs(attacker, firstValue, secondValue) {
  if (typeof attacker === "number") return { attacker: player, firstValue: attacker, secondValue: firstValue };
  return { attacker: attacker || player, firstValue, secondValue };
}

function enemyInCircle(enemy, attacker = player, radius) {
  const args = resolveAttackShapeArgs(attacker, radius);
  return Math.hypot(args.attacker.x - enemy.x, args.attacker.y - enemy.y) <= args.firstValue + enemy.r;
}

function enemyInArc(enemy, attacker = player, radius, arcAngle) {
  const args = resolveAttackShapeArgs(attacker, radius, arcAngle);
  const dx = enemy.x - args.attacker.x;
  const dy = enemy.y - args.attacker.y;
  const dist = Math.hypot(dx, dy);
  if (dist > args.firstValue + enemy.r) return false;
  const enemyAngle = Math.atan2(dy, dx);
  const aimAngle = Math.atan2(args.attacker.aimY, args.attacker.aimX);
  return angleDifference(enemyAngle, aimAngle) <= args.secondValue / 2;
}

function enemyInLine(enemy, attacker = player, length, width) {
  const args = resolveAttackShapeArgs(attacker, length, width);
  const dx = enemy.x - args.attacker.x;
  const dy = enemy.y - args.attacker.y;
  const forward = dx * args.attacker.aimX + dy * args.attacker.aimY;
  if (forward < -enemy.r || forward > args.firstValue + enemy.r) return false;
  const side = Math.abs(dx * args.attacker.aimY - dy * args.attacker.aimX);
  return side <= args.secondValue / 2 + enemy.r;
}

function addAttackTelegraph(attacker = player, weapon) {
  if (!weapon) {
    weapon = attacker;
    attacker = player;
  }
  attackTelegraphs.push({
    x: attacker.x,
    y: attacker.y,
    aimX: attacker.aimX,
    aimY: attacker.aimY,
    shape: { ...weapon.attackShape },
    color: weapon.telegraphColor,
    life: 12,
    maxLife: 12
  });
}

function attack(attacker = player) {
  if (attacker !== player) return;
  if (player.attackCooldown > 0 || player.pvpFreezeFrames > 0 || isPlayerDodging() || gameWon || gameLost) return;
  if (isPvpFloorActive() && isCrawlerInSafeRoom(player)) {
    applySafeRoomPvpFreeze();
    return;
  }
  const weapon = getCurrentWeapon();
  const shape = weapon.attackShape;
  const damage = getWeaponDamage(weapon);
  player.attackCooldown = weapon.cooldown;
  addAttackTelegraph(attacker, weapon);

  if (shape.type === "projectile") {
    projectiles.push({
      x: player.x + player.aimX * (player.r + 6),
      y: player.y + player.aimY * (player.r + 6),
      vx: player.aimX * shape.speed,
      vy: player.aimY * shape.speed,
      remainingRange: weapon.range,
      radius: shape.radius,
      damage,
      color: weapon.telegraphColor,
      hitEnemies: new Set(),
      hitCrawlers: new Set(),
      pvpEnabled: canCrawlerInitiatePvp(player),
      hit: false,
      weapon
    });
    return;
  }

  let hit = false;
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    let inShape = false;
    if (shape.type === "circle") inShape = enemyInCircle(enemy, attacker, shape.radius);
    if (shape.type === "arc") inShape = enemyInArc(enemy, attacker, shape.radius, shape.angle);
    if (shape.type === "line") inShape = enemyInLine(enemy, attacker, shape.length, shape.width);
    if (inShape) hit = damageEnemy(enemy, damage, weapon, attacker) || hit;
  }

  if (canCrawlerInitiatePvp(player) && multiplayer.remotePlayers?.size) {
    for (const crawler of multiplayer.remotePlayers.values()) {
      if (crawler.status !== "active") continue;
      let inShape = false;
      if (shape.type === "circle") inShape = enemyInCircle(crawler, attacker, shape.radius);
      if (shape.type === "arc") inShape = enemyInArc(crawler, attacker, shape.radius, shape.angle);
      if (shape.type === "line") inShape = enemyInLine(crawler, attacker, shape.length, shape.width);
      if (inShape) hit = damageRemoteCrawler(crawler, damage) || hit;
    }
  }

  if (!hit) stats.missedAttacks++;
  if (!hit && !achievements.has("airPunch")) achievement("NEW ACHIEVEMENT: Ghost Violence", "You attacked the air. The air has declined to press charges.", "airPunch");
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    const step = Math.hypot(projectile.vx, projectile.vy);
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
    projectile.remainingRange -= step;

    if (projectile.remainingRange <= 0 || isBlocked(projectile.x, projectile.y)) {
      if (!projectile.hit && !projectile.petOwnerId) {
        stats.missedAttacks++;
        if (!achievements.has("airPunch")) achievement("NEW ACHIEVEMENT: Ghost Violence", "You attacked the air. The air has declined to press charges.", "airPunch");
      }
      projectiles.splice(i, 1);
      continue;
    }

    let hit = false;
    for (const enemy of enemies) {
      if (enemy.hp <= 0 || projectile.hitEnemies.has(enemy)) continue;
      if (Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) <= projectile.radius + enemy.r) {
        projectile.hitEnemies.add(enemy);
        if (projectile.petOwnerId) damageEnemyByPet(enemy, projectile.damage, getActivePet());
        else damageEnemy(enemy, projectile.damage, projectile.weapon);
        projectile.hit = true;
        hit = true;
        break;
      }
    }

    if (!hit && projectile.pvpEnabled && multiplayer.remotePlayers?.size) {
      for (const crawler of multiplayer.remotePlayers.values()) {
        if (crawler.status !== "active" || projectile.hitCrawlers?.has(crawler.id)) continue;
        if (Math.hypot(projectile.x - crawler.x, projectile.y - crawler.y) <= projectile.radius + crawler.r) {
          projectile.hitCrawlers.add(crawler.id);
          hit = damageRemoteCrawler(crawler, projectile.damage);
          projectile.hit = projectile.hit || hit;
          break;
        }
      }
    }
    if (hit) projectiles.splice(i, 1);
  }

  for (let i = attackTelegraphs.length - 1; i >= 0; i--) {
    attackTelegraphs[i].life--;
    if (attackTelegraphs[i].life <= 0) attackTelegraphs.splice(i, 1);
  }
}

function updateTutorialSigns() {
  if (!Array.isArray(tutorialSigns) || currentFloor !== 0 || gameWon || gameLost) return;

  for (const sign of tutorialSigns) {
    if (!sign || seenTutorialSignIds.has(sign.id)) continue;
    const sx = sign.x * TILE + TILE / 2;
    const sy = sign.y * TILE + TILE / 2;
    if (Math.hypot(player.x - sx, player.y - sy) > (sign.radius || TILE * 1.85)) continue;

    seenTutorialSignIds.add(sign.id);
    achievement(sign.title || "Tutorial Sign", sign.body || "Keep moving.", sign.id);
    break;
  }
}

function interact() {
  if (gameWon || gameLost || isPlayerDodging()) return;
  if (typeof petMerchantInReach === "function" && petMerchantInReach()) { showPetMerchantPanel(); return; }

  for (const corpse of corpses) {
    if (corpse.looted) continue;
    const dist = Math.hypot(player.x - corpse.x, player.y - corpse.y);
    if (dist < player.r + corpse.r + 24) {
      lootCorpse(corpse);
      return;
    }
  }

  for (const spot of getNearbyTiles()) {
    const t = map[spot.y][spot.x];
    if (t === "L") {
      announcer("That door is boss-locked. It will not open until the large angry problem in the room stops being alive.");
      return;
    }
    if (t === "D") {
      map[spot.y][spot.x] = ".";
      if (typeof sendFloor0WorldEvent === "function") sendFloor0WorldEvent({ type: "door_opened", id: floor0TileId("door", spot.x, spot.y) });
      stats.doorsOpened++;
      changeAudience(1);
      if (stats.doorsOpened === 1) achievement("NEW ACHIEVEMENT: Suspiciously Door-Shaped Object", "You found a door and immediately made it everybody else's problem.", "firstDoor");
      else announcer("Door opened. Bold. Original. Historians are already fighting over who gets to write your biography.");
      return;
    }
    if (t === "C") {
      const key = `${spot.x},${spot.y}`;
      if (!openedChests.has(key)) {
        openedChests.add(key);
        if (typeof sendFloor0WorldEvent === "function") sendFloor0WorldEvent({ type: "chest_opened", id: floor0TileId("chest", spot.x, spot.y) });
        stats.chestsOpened++;
        map[spot.y][spot.x] = ".";
        changeAudience(2);
        rewardChestLoot(roomForTile(spot.x, spot.y));
        if (!achievements.has("firstChest")) achievement("NEW ACHIEVEMENT: Box Goblin", "You opened a chest. The dungeon has begun the traditional process of bribing you into worse decisions.", "firstChest");
        return;
      }
    }
  }
  stats.interactionsWithNothing++;
  announcer("You interacted with absolutely nothing. Stunning. The nothing is considering a restraining order.");
}

function getNearbyTiles() {
  const px = Math.floor(player.x / TILE), py = Math.floor(player.y / TILE), spots = [];
  for (let y = py - 1; y <= py + 1; y++) for (let x = px - 1; x <= px + 1; x++) {
    if (x >= 0 && x < MAP_COLS && y >= 0 && y < MAP_ROWS) spots.push({x, y});
  }
  return spots;
}


function beginRoomReveal(room, px, py) {
  if (!room) return;

  let maxDist = 1;
  forEachRoomTile(room, (x, y) => {
    maxDist = Math.max(maxDist, Math.hypot(x - px, y - py));
  });

  roomRevealState = {
    roomId: room.id,
    startFrame: frameCount,
    originX: px,
    originY: py,
    maxDist,
    complete: false
  };
}

function updateRoomReveal(room, px, py) {
  if (!room) return false;

  if (roomRevealState.roomId !== room.id) {
    beginRoomReveal(room, px, py);
  }

  const framesElapsed = Math.max(0, frameCount - roomRevealState.startFrame);
  const revealFrames = 28; // about half a second at 60fps
  const progress = roomRevealState.complete ? 1 : Math.min(1, framesElapsed / revealFrames);
  const radius = 1.5 + roomRevealState.maxDist * progress;

  let changed = false;

  forEachRoomTile(room, (x, y) => {
    if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return;

    const dist = Math.hypot(x - roomRevealState.originX, y - roomRevealState.originY);
    const revealedByWave = dist <= radius;

    if (revealedByWave || progress >= 1) {
      visible[y][x] = true;
      if (!seen[y][x]) {
        seen[y][x] = true;
        changed = true;
      }
    }
  });

  if (progress >= 1) {
    roomRevealState.complete = true;
  }

  if (changed) minimapDirty = true;
  return changed;
}


function isVisionBlockingTile(t) {
  return t === "#" || t === "D" || t === "L";
}

function revealTileForVision(x, y) {
  if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return false;

  const t = map[y][x];

  // Walls block vision and stay hidden.
  if (t === "#") return false;

  // Doors and boss locks are visible as endpoints, but still block anything behind them.
  visible[y][x] = true;
  if (!seen[y][x]) {
    seen[y][x] = true;
    minimapDirty = true;
    return true;
  }
  return false;
}


function revealAdjacentRoomEdgeFloors(room) {
  if (!room) return;

  const candidates = roomAdjacentTiles(room);

  for (const t of candidates) {
    if (t.x < 0 || t.y < 0 || t.x >= MAP_COLS || t.y >= MAP_ROWS) continue;

    const tile = map[t.y]?.[t.x];

    // Only one tile deep. Reveal open hallway/floor, doors/locks as endpoints,
    // but never walls or stairs/safe-room/exit markers.
    if (tile === "." || tile === "D" || tile === "L" || tile === "C") {
      visible[t.y][t.x] = true;
      if (!seen[t.y][t.x]) {
        seen[t.y][t.x] = true;
        minimapDirty = true;
      }
    }
  }
}


function revealRoomDoorEdges(room) {
  if (!room) return;

  const edgeCandidates = roomAdjacentTiles(room);

  for (const t of edgeCandidates) {
    if (t.x < 0 || t.y < 0 || t.x >= MAP_COLS || t.y >= MAP_ROWS) continue;
    if (map[t.y][t.x] !== "#") revealTileForVision(t.x, t.y);
  }
}

function revealTightHallwayVision(px, py) {
  revealTileForVision(px, py);

  const dirs = [
    {dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1},
    {dx: 1, dy: 1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}, {dx: -1, dy: -1}
  ];

  for (const d of dirs) {
    const nx = px + d.dx;
    const ny = py + d.dy;

    if (d.dx === 0 || d.dy === 0) {
      revealTileForVision(nx, ny);
      continue;
    }

    const sideA = map[py]?.[px + d.dx];
    const sideB = map[py + d.dy]?.[px];
    if (!isVisionBlockingTile(sideA) && !isVisionBlockingTile(sideB)) {
      revealTileForVision(nx, ny);
    }
  }
}


function updateVisibility(force=false) {
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  const currentRoomForReveal = roomForTile(px, py);

  const roomRevealNeedsUpdate =
    currentRoomForReveal &&
    (roomRevealState.roomId !== currentRoomForReveal.id || !roomRevealState.complete);

  if (!force && !visibilityDirty && px === lastVisibilityTileX && py === lastVisibilityTileY && !roomRevealNeedsUpdate) {
    return;
  }

  lastVisibilityTileX = px;
  lastVisibilityTileY = py;
  visibilityDirty = false;

  visible = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(false));

  if (currentRoomForReveal) {
    updateRoomReveal(currentRoomForReveal, px, py);
    revealRoomDoorEdges(currentRoomForReveal);
    revealAdjacentRoomEdgeFloors(currentRoomForReveal);
  } else {
    revealTightHallwayVision(px, py);
  }

  let count = 0;
  for (const room of rooms) {
    if (!room.seen) {
      forEachRoomTile(room, (x, y) => {
        if (!room.seen && seen[y]?.[x]) {
          room.seen = true;
          count++;
        }
      });
    }
  }

  discoverStairwellIfVisible();

  if (count > 0) {
    roomsSeen += count;
    if (roomsSeen === 5) achievement("NEW ACHIEVEMENT: Lightly Trespassing", "You have discovered five rooms. The dungeon would like to remind you that curiosity killed the cat, then monetized the footage.", "rooms5");
    if (roomsSeen === 15) achievement("NEW ACHIEVEMENT: Real Estate Goblin", "You have discovered fifteen rooms. At this point you are less crawler and more aggressive home inspector.", "rooms15");
    updateHUD();
  }
}


function discoverStairwellIfVisible() {
  if (stairwellFound || stairwellX === null || stairwellY === null) return;

  if (seen[stairwellY]?.[stairwellX]) {
    stairwellFound = true;
    minimapDirty = true;
    achievement("NEW DISCOVERY: STAIRWELL LOCATED", "The stairwell has been permanently marked on your map. You may descend at any time. This is not the same thing as a good idea.", "stairwellFound");
    announcer("Stairwell located. The dungeon reminds you that leaving early is survival, not glory.");
    updateHUD();
  }
}

function updateFloorTimer() {
  if (gameWon || gameLost) return;
  frameCount++;
  if (frameCount % 60 === 0 && !collapseStarted) {
    floorTimeLeft = Math.max(0, floorTimeLeft - 1);
    if (frameCount % (60 * 20) === 0 && !player.safe) audienceScore = Math.max(0, audienceScore - 1);
    if (floorTimeLeft <= 360 && !warnedAt360) { warnedAt360 = true; announcer("Floor collapse in six minutes. This is not a threat. It is a scheduling policy."); }
    if (floorTimeLeft <= 240 && !warnedAt240) { warnedAt240 = true; announcer("Floor collapse in four minutes. Plenty of time to panic inefficiently."); }
    if (floorTimeLeft <= 120 && !warnedAt120) { warnedAt120 = true; achievement("NEW ACHIEVEMENT: Scheduling Conflict", "The floor is preparing to stop existing. Please wrap up any hobbies, grudges, or poor decisions.", "twoMinuteWarning"); }
    if (floorTimeLeft <= 60 && !warnedAt60) { warnedAt60 = true; finalDescentAnnounced = true; if (typeof syncMusicToGameState === "function") syncMusicToGameState(); achievement("FINAL DESCENT WINDOW", "One minute until collapse. Descending now grants immediate access to the next floor. Remaining here grants the dungeon plausible deniability.", "finalDescentWindow"); }
    if (floorTimeLeft <= 30 && !warnedAt30) { warnedAt30 = true; achievement("NEW ACHIEVEMENT: Time Management Goblin", "You have thirty seconds left and somehow this is still not the worst plan I've seen today.", "thirtySecondWarning"); }
    if (floorTimeLeft <= 0) {
      if (multiplayer.enabled && multiplayer.usingServer && currentFloor === 0) {
        collapseStarted = true;
        announcer("Floor 0 collapse timer reached zero. Waiting for server resolution.");
      } else floorCollapseDeath();
    }
    updateHUD();
    if (multiplayer.enabled && typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
  }
  if (!collapseStarted && frameCount - lastObservationFrame >= OBSERVATION_INTERVAL_FRAMES) {
    lastObservationFrame = frameCount;
    makeDungeonObservation();
  }
}


function floorCollapseDeath() {
  if (gameWon || gameLost) return;
  pendingFloorAdvance = false;
  gameLost = true;
  if (typeof stopCollapseMusic === "function") stopCollapseMusic();
  else if (typeof syncMusicToGameState === "function") syncMusicToGameState();
  achievement("FLOOR COLLAPSE", "You failed to descend before the floor collapsed. The dungeon thanks you for becoming load-bearing paste.", "collapseDeath");
  showCenter("Floor Collapse", "You failed to descend before the floor collapsed. Any crawler remaining on the floor dies. The dungeon has filed your remains under: avoidable.", "Start New Run", restartGame);
}

function startCollapse() {
  collapseStarted = true;
  if (typeof stopCollapseMusic === "function") stopCollapseMusic();
  changeAudience(5);
  achievement("FLOOR COLLAPSE STARTED", "The dungeon has begun aggressively uninstalling this floor. Enemies are faster. The exit is now less of a suggestion.", "collapseStarted");
  for (const enemy of enemies) if (enemy.hp > 0) enemy.speed *= 1.65;
  updateHUD();
}

function makeDungeonObservation() {
  stats.potshotsFromAI++;
  const rep = updateReputation();
  const safeSeconds = Math.floor(stats.timeInSafeRoomFrames / 60);
  const outsideSeconds = Math.floor(stats.timeOutsideSafeRoomFrames / 60);
  const obs = [];

  if (roomsSeen >= 10 && stats.doorsOpened <= 1) obs.push(`You have seen ${roomsSeen} rooms and opened ${stats.doorsOpened} doors. Either this floor is generous or you are wandering with heroic uncertainty.`);
  if (roomsSeen >= 12 && stats.chestsOpened === 0) obs.push("You have discovered multiple rooms and somehow avoided treasure. Bold anti-loot behavior. The goblins are confused and frankly offended.");
  if (stats.doorsOpened >= 3 && stats.enemiesKilled === 0) obs.push("You have opened multiple doors and killed nothing. Fascinating. A pacifist locksmith.");
  if (stats.chestsOpened >= 2 && stats.enemiesKilled === 0) obs.push("You appear to believe this is a treasure tour with occasional screaming. The dungeon respects the hustle, barely.");
  if (stats.missedAttacks >= 4) obs.push("Your combat strategy currently involves threatening oxygen. Oxygen remains undefeated.");
  if (stats.wallBumps >= 12) obs.push("Repeated wall impacts detected. The architecture has filed a formal complaint.");
  if (stats.damageTaken >= 24 && stats.enemiesKilled === 0) obs.push("You have taken significant damage without killing anything. This is less combat and more customer service.");
  if (safeSeconds > 35 && outsideSeconds < 20) obs.push("You are spending a lot of time in the safe room. Bold survival strategy. Cowardly, but bold.");
  if (stats.enemiesKilled >= 2 && stats.chestsOpened === 0) obs.push("You keep killing things and ignoring treasure. Somewhere, a goblin accountant just woke up screaming.");
  if (lootBoxCount() >= 3) obs.push(`You are carrying ${lootBoxCount()} unopened loot boxes. This is either discipline or a small cardboard addiction.`);
  if (stats.gearFound >= 2 && Object.values(player.equipment).filter(Boolean).length === 0) obs.push("You keep finding clothing and refusing to wear it. The dungeon has questions. So do I.");
  if (stats.interactionsWithNothing >= 3) obs.push("You keep interacting with empty space. The empty space has asked me not to give you its number.");
  if (audienceScore <= 8 && outsideSeconds > 20) obs.push("Your audience score is low. Even the dungeon's background fungus is testing better with viewers.");
  if (player.level >= 2 && stats.enemiesKilled >= 2) obs.push(`You are now level ${player.level}. The dungeon is forced to acknowledge your growth, legally and against its wishes.`);
  if (audienceScore >= 30) obs.push(`Current reputation: ${rep}. ${getReputationComment(rep)}`);
  if (stats.doorsOpened >= 4 && stats.chestsOpened >= 2 && stats.enemiesKilled >= 1) obs.push("Look at you, developing a gameplay loop. Door, loot, violence. Civilization began with less.");
  if (obs.length === 0) obs.push([
    `You have seen ${roomsSeen} of ${rooms.length} rooms. This is called exploration. Or trespassing, depending on the lawyer.`,
    "The dungeon is watching you. Not impressed yet. Still watching.",
    "You are doing fine. Unfortunately, fine is not a genre.",
    "No major pattern detected. Try becoming more entertaining before the floor becomes rubble.",
    "Your survival continues to be technically legal."
  ][Math.floor(Math.random() * 5)]);
  announcer(obs[Math.floor(Math.random() * obs.length)]);
}


