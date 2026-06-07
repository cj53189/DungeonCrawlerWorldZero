function tileAt(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || tx >= MAP_COLS || ty < 0 || ty >= MAP_ROWS) return "#";
  return map[ty][tx];
}

function isBlocked(px, py) { const t = tileAt(px, py); return t === "#" || t === "D" || t === "L"; }
function canMoveTo(x, y, r) {
  return !isBlocked(x - r, y - r) && !isBlocked(x + r, y - r) && !isBlocked(x - r, y + r) && !isBlocked(x + r, y + r);
}

function moveEntity(entity, dx, dy) {
  if (dx === 0 && dy === 0) return;
  let nx = entity.x + dx, ny = entity.y;
  if (canMoveTo(nx, ny, entity.r)) entity.x = nx;
  else if (entity === player) {
    stats.wallBumps++;
    if (stats.wallBumps === 10) achievement("NEW ACHIEVEMENT: Wall Scholar", "You have studied the wall with your face ten times. The wall remains undefeated.", "wallScholar");
  }

  nx = entity.x; ny = entity.y + dy;
  if (canMoveTo(nx, ny, entity.r)) entity.y = ny;
  else if (entity === player) stats.wallBumps++;
}


function updateBossLocks(){
  // dcw_010: no timed boss-room lockdown.
  // Pending locks are handled by processPendingBossLocks() after aggro.
  processPendingBossLocks();
}

function updatePlayer() {
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
  } else {
    moveEntity(player, dx, dy);
  }
  player.attackCooldown = Math.max(0, player.attackCooldown - 1);
  if (touchState.attackActive && player.pvpFreezeFrames <= 0) attack();

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
    if (enemy.hp <= 0) continue;
    enemy.damageCooldown = Math.max(0, enemy.damageCooldown - 1);
    if (player.safe) continue;

    const exTile = Math.floor(enemy.x / TILE), eyTile = Math.floor(enemy.y / TILE);
    if (!seen[eyTile]?.[exTile] && !collapseStarted) continue;

    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    const canSeePlayer = dist < 210 && hasLineOfSight(enemy.x, enemy.y, player.x, player.y);
    if (enemy.boss && !bossAggroed && canSeePlayer) {
      triggerBossAggro("seen");
    }
    const bossCanAlwaysTrack = enemy.boss && bossAggroed;
    let dx = 0, dy = 0;
    if (canSeePlayer || bossCanAlwaysTrack) { dx = (player.x - enemy.x) / Math.max(1, dist) * enemy.speed; dy = (player.y - enemy.y) / Math.max(1, dist) * enemy.speed; }
    else {
      dx = Math.cos(enemy.wanderAngle) * 0.35;
      dy = Math.sin(enemy.wanderAngle) * 0.35;
      if (Math.random() < 0.015) enemy.wanderAngle = Math.random() * Math.PI * 2;
    }
    moveEntity(enemy, dx, dy);

    const newDist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (newDist < player.r + enemy.r + 4 && enemy.damageCooldown <= 0) {
      const rawDmg = enemy.damage || 8;
      const dmg = Math.max(1, rawDmg - player.defense);
      player.hp -= dmg;
      stats.damageTaken += dmg;
      stats.riskyMoments++;
      changeAudience(1);
      enemy.damageCooldown = 70;
      updateHUD();
      if (!achievements.has("firstHit")) achievement("NEW ACHIEVEMENT: Physical Contact", "A dungeon creature touched you without consent. Human resources has been eaten.", "firstHit");
      if (player.hp <= 0) loseGame();
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
  return weapon.damage + Math.max(0, player.attackDamage - 20);
}

function damageEnemy(enemy, damage) {
  if (!enemy || enemy.hp <= 0) return false;
  if (enemy.boss) triggerBossAggro("attack");
  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    stats.enemiesKilled++;
    changeAudience(enemy.boss ? 10 : 4);
    gainXP(enemy.xpReward || 15);
    createCorpse(enemy);
    if (enemy.boss) completeBossEncounter(enemy);
    achievement("NEW ACHIEVEMENT: Pest Control Adjacent", `You killed a level ${enemy.level || 1} dungeon creature. It left behind a corpse. The dungeon calls this an interactive container with smell.`);
  }
  return true;
}

function enemyInCircle(enemy, radius) {
  return Math.hypot(player.x - enemy.x, player.y - enemy.y) <= radius + enemy.r;
}

function enemyInArc(enemy, radius, arcAngle) {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > radius + enemy.r) return false;
  const enemyAngle = Math.atan2(dy, dx);
  const aimAngle = Math.atan2(player.aimY, player.aimX);
  return angleDifference(enemyAngle, aimAngle) <= arcAngle / 2;
}

function enemyInLine(enemy, length, width) {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const forward = dx * player.aimX + dy * player.aimY;
  if (forward < -enemy.r || forward > length + enemy.r) return false;
  const side = Math.abs(dx * player.aimY - dy * player.aimX);
  return side <= width / 2 + enemy.r;
}

function addAttackTelegraph(weapon) {
  attackTelegraphs.push({
    x: player.x,
    y: player.y,
    aimX: player.aimX,
    aimY: player.aimY,
    shape: { ...weapon.attackShape },
    color: weapon.telegraphColor,
    life: 12,
    maxLife: 12
  });
}

function attack() {
  if (player.attackCooldown > 0 || player.pvpFreezeFrames > 0 || gameWon || gameLost) return;
  if (isPvpFloorActive() && isCrawlerInSafeRoom(player)) {
    applySafeRoomPvpFreeze();
    return;
  }
  const weapon = getCurrentWeapon();
  const shape = weapon.attackShape;
  const damage = getWeaponDamage(weapon);
  player.attackCooldown = weapon.cooldown;
  addAttackTelegraph(weapon);

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
      hit: false
    });
    return;
  }

  let hit = false;
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    let inShape = false;
    if (shape.type === "circle") inShape = enemyInCircle(enemy, shape.radius);
    if (shape.type === "arc") inShape = enemyInArc(enemy, shape.radius, shape.angle);
    if (shape.type === "line") inShape = enemyInLine(enemy, shape.length, shape.width);
    if (inShape) hit = damageEnemy(enemy, damage) || hit;
  }

  if (canCrawlerInitiatePvp(player) && multiplayer.remotePlayers?.size) {
    for (const crawler of multiplayer.remotePlayers.values()) {
      if (crawler.status !== "active") continue;
      let inShape = false;
      if (shape.type === "circle") inShape = enemyInCircle(crawler, shape.radius);
      if (shape.type === "arc") inShape = enemyInArc(crawler, shape.radius, shape.angle);
      if (shape.type === "line") inShape = enemyInLine(crawler, shape.length, shape.width);
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
      if (!projectile.hit) {
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
        damageEnemy(enemy, projectile.damage);
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

function interact() {
  if (gameWon || gameLost) return;

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
        stats.chestsOpened++;
        map[spot.y][spot.x] = ".";
        changeAudience(2);
        rewardChestLoot();
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
    if (floorTimeLeft <= 60 && !warnedAt60) { warnedAt60 = true; finalDescentAnnounced = true; achievement("FINAL DESCENT WINDOW", "One minute until collapse. Descending now grants immediate access to the next floor. Remaining here grants the dungeon plausible deniability.", "finalDescentWindow"); }
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
  achievement("FLOOR COLLAPSE", "You failed to descend before the floor collapsed. The dungeon thanks you for becoming load-bearing paste.", "collapseDeath");
  showCenter("Floor Collapse", "You failed to descend before the floor collapsed. Any crawler remaining on the floor dies. The dungeon has filed your remains under: avoidable.", "Start New Run", restartGame);
}

function startCollapse() {
  collapseStarted = true;
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



