
const CAMERA_TILT_SCALE = 0.72;
const WALL_RISE = 18;
const ENTITY_RISE = 10;

const PLAYER_SPRITE_PATH = "./assets/sprites/player_base.png";
const PLAYER_DODGE_SPRITE_PATH = "./assets/sprites/player_dodge_roll.png";
const PLAYER_SPRITE_SHEET = new Image();
PLAYER_SPRITE_SHEET.src = PLAYER_SPRITE_PATH;
const PLAYER_DODGE_SPRITE_SHEET = new Image();
PLAYER_DODGE_SPRITE_SHEET.src = PLAYER_DODGE_SPRITE_PATH;

const PLAYER_SPRITE_FRAME_WIDTH = 32;
const PLAYER_SPRITE_FRAME_HEIGHT = 32;
const PLAYER_SPRITE_RENDER_WIDTH = 34;
const PLAYER_SPRITE_RENDER_HEIGHT = 42;
const PLAYER_SPRITE_ANIMATION_SEQUENCE = [0, 1, 2, 1];
const PLAYER_SPRITE_WALK_FRAME_DELAY = 14;
const PLAYER_SPRITE_MOVEMENT_THRESHOLD = 0.12;

const SPRITE_FRAME_W = 52;
const SPRITE_FRAME_H = 52;
const OTHER_CRAWLER_SPRITE = "./assets/sprites/other_crawler_armored_52x52.png";
const OTHER_CRAWLER_SPRITE_SHEET = new Image();
OTHER_CRAWLER_SPRITE_SHEET.src = OTHER_CRAWLER_SPRITE;
const OTHER_CRAWLER_SPRITE_COLS = 3;
const OTHER_CRAWLER_SPRITE_ROWS = 5;
const OTHER_CRAWLER_RENDER_WIDTH = SPRITE_FRAME_W;
const OTHER_CRAWLER_RENDER_HEIGHT = SPRITE_FRAME_H;
const REMOTE_PLAYER_SPRITE_VISUAL_SCALE = 0.72;
const OTHER_CRAWLER_IDLE_FRAME = 1;
const OTHER_CRAWLER_DIRECTION_ROWS = { down: 0, up: 1, left: 3, right: 4 };
const NETWORK_DIRECTION_VALUES = { 0: "down", 1: "up", 2: "left", 3: "right" };

const ENEMY_SPRITE_CACHE = new Map();
const warnedMissingEnemySprites = new Set();

function getEnemySpriteSheet(enemy) {
  if (!enemy?.spriteKey || !enemy.spritePath) return null;
  let entry = ENEMY_SPRITE_CACHE.get(enemy.spriteKey);
  if (!entry) {
    const image = new Image();
    entry = { image, failed: false };
    image.onload = () => { entry.failed = false; };
    image.onerror = () => {
      entry.failed = true;
      if (enemy.missingWarning && !warnedMissingEnemySprites.has(enemy.spriteKey)) {
        warnedMissingEnemySprites.add(enemy.spriteKey);
        console.warn(enemy.missingWarning);
      }
    };
    image.src = enemy.spritePath;
    ENEMY_SPRITE_CACHE.set(enemy.spriteKey, entry);
  }
  if (entry.failed || !entry.image.complete) return null;
  const columns = Math.max(1, enemy.columns || enemy.frameCount || 1);
  const rows = Math.max(1, enemy.rows || enemy.rowCount || 1);
  const frameWidth = enemy.frameWidth || Math.floor(entry.image.naturalWidth / columns) || 32;
  const frameHeight = enemy.frameHeight || Math.floor(entry.image.naturalHeight / rows) || 32;
  if (entry.image.naturalWidth < frameWidth * columns || entry.image.naturalHeight < frameHeight * rows) return null;
  enemy.frameWidth = frameWidth;
  enemy.frameHeight = frameHeight;
  return entry.image;
}

function applyDungeonCameraTransform(camX) {
  const tiltedPlayerY = player.y * CAMERA_TILT_SCALE;
  const camOffsetY = canvas.height / 2 - tiltedPlayerY;
  ctx.translate(-camX, camOffsetY);
  ctx.scale(1, CAMERA_TILT_SCALE);
  return camOffsetY;
}

function visibleWorldYBounds(camOffsetY) {
  return {
    top: (0 - camOffsetY) / CAMERA_TILT_SCALE,
    bottom: (canvas.height - camOffsetY) / CAMERA_TILT_SCALE
  };
}

function drawDungeonTileBase(px, py, color, strokeColor = null) {
  ctx.fillStyle = color;
  ctx.fillRect(px, py, TILE, TILE);
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.strokeRect(px, py, TILE, TILE);
  }
}

function drawRaisedWallTile(px, py, isVisible) {
  const topColor = isVisible ? "#3d3d3d" : "#242424";
  const frontColor = isVisible ? "#252525" : "#171717";
  const sideColor = isVisible ? "#2c2c2c" : "#1b1b1b";
  const edgeColor = isVisible ? "rgba(90,90,90,0.65)" : "rgba(48,48,48,0.65)";

  ctx.fillStyle = sideColor;
  ctx.beginPath();
  ctx.moveTo(px + TILE, py);
  ctx.lineTo(px + TILE, py + TILE);
  ctx.lineTo(px + TILE, py + TILE - WALL_RISE);
  ctx.lineTo(px + TILE, py - WALL_RISE);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = frontColor;
  ctx.beginPath();
  ctx.moveTo(px, py + TILE);
  ctx.lineTo(px + TILE, py + TILE);
  ctx.lineTo(px + TILE, py + TILE - WALL_RISE);
  ctx.lineTo(px, py + TILE - WALL_RISE);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = topColor;
  ctx.fillRect(px, py - WALL_RISE, TILE, TILE);
  ctx.strokeStyle = edgeColor;
  ctx.strokeRect(px, py - WALL_RISE, TILE, TILE);
  drawWallAmbientShadow(px, py, isVisible);
}

function drawChestTile(px, py, isVisible) {
  const chestY = py + 7;
  ctx.fillStyle = isVisible ? "#a36a21" : "#553916";
  ctx.fillRect(px + 7, chestY + 6, TILE - 14, TILE - 16);
  ctx.fillStyle = isVisible ? "#7a4819" : "#392411";
  ctx.fillRect(px + 7, chestY, TILE - 14, 9);
  ctx.strokeStyle = isVisible ? "#e0b14a" : "#735826";
  ctx.strokeRect(px + 7, chestY, TILE - 14, TILE - 10);
  ctx.fillStyle = isVisible ? "#e0b14a" : "#806727";
  ctx.fillRect(px + 13, chestY + 11, 7, 7);
}

function drawPortalTile(px, py, isVisible) {
  ctx.save();
  ctx.translate(px + TILE / 2, py + TILE / 2 - 4);
  ctx.scale(1, 0.68);
  ctx.fillStyle = "#3f63ff";
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isVisible ? "#c6d0ff" : "#7788ff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 1;
}

function drawStandingFigure(entity, options = {}) {
  const radius = entity.r || 10;
  const color = options.color || "#f1f1f1";
  const outline = options.outline || "rgba(255,255,255,0.72)";
  const height = (options.height || radius * 1.75) + ENTITY_RISE;

  ctx.save();
  ctx.translate(entity.x, entity.y);

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.72, radius * 1.08, Math.max(4, radius * 0.42), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, -height * 0.28, radius * 0.82, height * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = options.lineWidth || 2;
  ctx.stroke();

  ctx.fillStyle = options.headColor || color;
  ctx.beginPath();
  ctx.arc(0, -height * 0.78, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (options.boss) {
    ctx.strokeStyle = "#ffd86b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -height * 0.35, radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnemyFallbackFigure(enemy) {
  drawStandingFigure(enemy, {
    color: enemy.boss ? "#8f38ff" : (collapseStarted ? "#d13b3b" : "#9b3131"),
    outline: enemy.boss ? "#ffd86b" : "rgba(255,185,185,0.72)",
    boss: enemy.boss,
    height: enemy.boss ? 32 : 22,
    lineWidth: enemy.boss ? 3 : 2
  });
}

function enemySpriteRow(enemy) {
  const rows = enemy?.directionRows;
  const animation = enemy?.animations?.[enemy.animationState || "walk"];
  if (rows) {
    const facingX = Number(enemy.facingX || 0);
    const facingY = Number(enemy.facingY || 0);
    if (Math.abs(facingX) > Math.abs(facingY)) {
      return facingX < 0 ? (rows.left ?? 0) : (rows.right ?? 0);
    }
    return facingY < 0 ? (rows.up ?? 0) : (rows.down ?? 0);
  }
  if (animation) return animation.row || 0;
  return 0;
}

function drawEnemySprite(enemy) {
  const sheet = getEnemySpriteSheet(enemy);
  if (!sheet) {
    drawEnemyFallbackFigure(enemy);
    return;
  }

  const frameWidth = enemy.frameWidth || 32;
  const frameHeight = enemy.frameHeight || 32;
  const animation = enemy.animations?.[enemy.animationState || "walk"] || null;
  const elapsedFrames = Math.max(0, frameCount - (enemy.animationStartedAt || 0));
  const ticksPerFrame = animation?.fps && !enemy.directionalFrameRows ? Math.max(1, Math.round(60 / animation.fps)) : Math.max(1, enemy.animationSpeed || 10);
  const row = Math.max(0, Math.min(Math.max(1, enemy.rows || enemy.rowCount || 1) - 1, enemySpriteRow(enemy)));
  let frame;
  if (enemy.directionalFrameRows) {
    const frameTotal = Math.max(1, Math.min(enemy.columns || enemy.frameCount || 1, enemy.frameCount || 1));
    frame = enemy.visualMoving ? Math.floor(frameCount / ticksPerFrame) % frameTotal : 0;
  } else {
    const frameTotal = Math.max(1, animation?.frames?.length || enemy.frameCount || 1);
    let animationFrameIndex = Math.floor(elapsedFrames / ticksPerFrame);
    if (animation && !animation.loop) animationFrameIndex = Math.min(frameTotal - 1, animationFrameIndex);
    frame = animation?.frames?.[animationFrameIndex % frameTotal] ?? (enemy.animationState === "idle" ? 0 : Math.floor(frameCount / ticksPerFrame) % frameTotal);
  }
  const renderWidth = enemy.directionalFrameRows ? frameWidth : Math.max(28, (enemy.r || 11) * (enemy.boss ? 2.8 : 2.35));
  const renderHeight = enemy.directionalFrameRows ? frameHeight : Math.max(34, renderWidth * (enemy.boss ? 1.25 : 1.18));
  const dx = enemy.x - renderWidth / 2;
  const dy = enemy.directionalFrameRows ? enemy.y - renderHeight / 2 : enemy.y + (enemy.r || 11) - renderHeight;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(enemy.x, enemy.y + (enemy.r || 11) * 0.72, (enemy.r || 11) * 1.08, Math.max(4, (enemy.r || 11) * 0.42), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.imageSmoothingEnabled = false;
  const shouldFlipLeft = enemy.facesRightByDefault && Number(enemy.facingX || 0) < -0.05;
  if (shouldFlipLeft) {
    ctx.translate(enemy.x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, frame * frameWidth, row * frameHeight, frameWidth, frameHeight, -renderWidth / 2, dy, renderWidth, renderHeight);
  } else {
    ctx.drawImage(sheet, frame * frameWidth, row * frameHeight, frameWidth, frameHeight, dx, dy, renderWidth, renderHeight);
  }
  if (enemy.boss) {
    ctx.strokeStyle = "#ffd86b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y - 6, (enemy.r || 11) + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayerFallbackFigure() {
  drawStandingFigure(player, {
    color: player.pvpFreezeFrames > 0 ? "#78b7ff" : player.safe ? "#7be07b" : "#f1f1f1",
    outline: player.safe ? "rgba(190,255,190,0.82)" : "rgba(255,255,255,0.82)",
    height: 24
  });
}

function isPlayerTryingToMove() {
  if (player.pvpFreezeFrames > 0) return false;

  const keyboardX = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
  const keyboardY = (keys["s"] || keys["arrowdown"] ? 1 : 0) - (keys["w"] || keys["arrowup"] ? 1 : 0);
  const movementX = keyboardX + (gamepadState.moveX || 0) + (touchState.moveX || 0);
  const movementY = keyboardY + (gamepadState.moveY || 0) + (touchState.moveY || 0);

  return Math.hypot(movementX, movementY) > PLAYER_SPRITE_MOVEMENT_THRESHOLD;
}

function playerSpriteRowForAim() {
  const aimX = Number.isFinite(player.aimX) ? player.aimX : 0;
  const aimY = Number.isFinite(player.aimY) ? player.aimY : 1;

  if (Math.abs(aimX) > Math.abs(aimY)) return aimX < 0 ? 2 : 3;
  return aimY < 0 ? 1 : 0;
}

function isPlayerSpriteLoaded(sheet = PLAYER_SPRITE_SHEET) {
  return sheet.complete &&
    sheet.naturalWidth >= PLAYER_SPRITE_FRAME_WIDTH * 3 &&
    sheet.naturalHeight >= PLAYER_SPRITE_FRAME_HEIGHT * 4;
}

function isOtherCrawlerSpriteLoaded() {
  return OTHER_CRAWLER_SPRITE_SHEET.complete &&
    OTHER_CRAWLER_SPRITE_SHEET.naturalWidth >= SPRITE_FRAME_W * OTHER_CRAWLER_SPRITE_COLS &&
    OTHER_CRAWLER_SPRITE_SHEET.naturalHeight >= SPRITE_FRAME_H * OTHER_CRAWLER_SPRITE_ROWS;
}

function getEntitySpriteRowForAim(entity) {
  const aimX = Number.isFinite(entity?.aimX) ? entity.aimX : 0;
  const aimY = Number.isFinite(entity?.aimY) ? entity.aimY : 1;
  if (Math.abs(aimX) > Math.abs(aimY)) return aimX < 0 ? 2 : 3;
  return aimY < 0 ? 1 : 0;
}

function normalizeNetworkDirection(direction) {
  if (typeof direction === "string") {
    const normalized = direction.trim().toLowerCase();
    if (normalized in OTHER_CRAWLER_DIRECTION_ROWS) return normalized;
  }

  if (Number.isFinite(Number(direction))) {
    return NETWORK_DIRECTION_VALUES[Math.trunc(Number(direction))] || null;
  }

  return null;
}

function getRemoteArmoredCrawlerSpriteRow(crawler) {
  const networkDirection = normalizeNetworkDirection(crawler?.direction);
  if (networkDirection) return OTHER_CRAWLER_DIRECTION_ROWS[networkDirection];

  const aimX = Number.isFinite(crawler?.aimX) ? crawler.aimX : 0;
  const aimY = Number.isFinite(crawler?.aimY) ? crawler.aimY : 1;
  if (Math.abs(aimX) > Math.abs(aimY)) {
    return aimX < 0 ? OTHER_CRAWLER_DIRECTION_ROWS.left : OTHER_CRAWLER_DIRECTION_ROWS.right;
  }
  return aimY < 0 ? OTHER_CRAWLER_DIRECTION_ROWS.up : OTHER_CRAWLER_DIRECTION_ROWS.down;
}

function drawPlayerSpriteStatusRing() {
  if (!player.safe && player.pvpFreezeFrames <= 0) return;

  const pulse = 1 + Math.sin(frameCount * 0.12) * 0.04;
  ctx.strokeStyle = player.pvpFreezeFrames > 0 ? "rgba(120,183,255,0.82)" : "rgba(190,255,190,0.82)";
  ctx.lineWidth = player.pvpFreezeFrames > 0 ? 3 : 2;
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + player.r * 0.18, (player.r + 6) * pulse, (player.r + 3) * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPlayerSprite() {
  if (!isPlayerSpriteLoaded()) {
    drawPlayerFallbackFigure();
    return;
  }

  const dodging = typeof isPlayerDodging === "function" && isPlayerDodging();
  const dodgeSheetReady = dodging && isPlayerSpriteLoaded(PLAYER_DODGE_SPRITE_SHEET);
  const sheet = dodgeSheetReady ? PLAYER_DODGE_SPRITE_SHEET : PLAYER_SPRITE_SHEET;
  const moving = isPlayerTryingToMove();
  const frame = dodgeSheetReady
    ? Math.floor((player.dodgeVisualFrame || 0) / 4) % 3
    : moving || dodging
      ? PLAYER_SPRITE_ANIMATION_SEQUENCE[Math.floor((dodging ? (player.dodgeVisualFrame || frameCount) : frameCount) / PLAYER_SPRITE_WALK_FRAME_DELAY) % PLAYER_SPRITE_ANIMATION_SEQUENCE.length]
      : 0;
  const row = playerSpriteRowForAim();
  const sx = frame * PLAYER_SPRITE_FRAME_WIDTH;
  const sy = row * PLAYER_SPRITE_FRAME_HEIGHT;
  const dx = player.x - PLAYER_SPRITE_RENDER_WIDTH / 2;
  const dy = player.y + player.r - PLAYER_SPRITE_RENDER_HEIGHT;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + player.r * 0.72, player.r * 1.08, Math.max(4, player.r * 0.42), 0, 0, Math.PI * 2);
  ctx.fill();

  drawPlayerSpriteStatusRing();

  ctx.imageSmoothingEnabled = false;
  if (dodging && !dodgeSheetReady) {
    const squash = 1.12 + Math.sin((player.dodgeVisualFrame || 0) * 0.55) * 0.05;
    const stretch = 0.86;
    ctx.translate(player.x, player.y - 10);
    ctx.rotate(Math.sin((player.dodgeVisualFrame || 0) * 0.7) * 0.18);
    ctx.scale(squash, stretch);
    ctx.translate(-player.x, -(player.y - 10));
  }

  ctx.drawImage(
    sheet,
    sx,
    sy,
    PLAYER_SPRITE_FRAME_WIDTH,
    PLAYER_SPRITE_FRAME_HEIGHT,
    dx,
    dy,
    PLAYER_SPRITE_RENDER_WIDTH,
    PLAYER_SPRITE_RENDER_HEIGHT
  );
  if (player.dodgeFlashFrames > 0) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.62, player.dodgeFlashFrames / 9)})`;
    ctx.fillRect(dx - 2, dy - 2, PLAYER_SPRITE_RENDER_WIDTH + 4, PLAYER_SPRITE_RENDER_HEIGHT + 4);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(255,255,255,0.86)";
    ctx.lineWidth = 2;
    ctx.strokeRect(dx - 1, dy - 1, PLAYER_SPRITE_RENDER_WIDTH + 2, PLAYER_SPRITE_RENDER_HEIGHT + 2);
  }
  ctx.restore();
}

function drawRemoteCrawlerBadge(crawler) {
  const color = crawler.color || "#75c7ff";
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(crawler.x, crawler.y + (crawler.r || player.r) * 0.72, (crawler.r || player.r) + 7, Math.max(5, (crawler.r || player.r) * 0.5), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(crawler.x + (crawler.r || player.r) + 8, crawler.y - (crawler.r || player.r) - 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRemoteCrawlerSprite(crawler, alpha = 1, tint = null) {
  if (!isOtherCrawlerSpriteLoaded()) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawStandingFigure(crawler, {
      color: crawler.status === "stasis" ? "#9db1ff" : crawler.status === "downed" ? "#555" : (crawler.color || "#75c7ff"),
      outline: "rgba(255,255,255,0.76)",
      height: 22
    });
    drawRemoteCrawlerBadge(crawler);
    ctx.restore();
    return;
  }

  const moving = !!crawler.moving || !!crawler.isDodging;
  const frame = moving
    ? PLAYER_SPRITE_ANIMATION_SEQUENCE[Math.floor(frameCount / PLAYER_SPRITE_WALK_FRAME_DELAY) % PLAYER_SPRITE_ANIMATION_SEQUENCE.length]
    : OTHER_CRAWLER_IDLE_FRAME;
  const row = Math.min(OTHER_CRAWLER_SPRITE_ROWS - 1, getRemoteArmoredCrawlerSpriteRow(crawler));
  const drawW = OTHER_CRAWLER_RENDER_WIDTH * REMOTE_PLAYER_SPRITE_VISUAL_SCALE;
  const drawH = OTHER_CRAWLER_RENDER_HEIGHT * REMOTE_PLAYER_SPRITE_VISUAL_SCALE;
  const dx = Math.round(crawler.x - drawW / 2);
  const dy = Math.round(crawler.y + (crawler.r || player.r) - drawH);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(crawler.x, crawler.y + (crawler.r || player.r) * 0.72, (crawler.r || player.r) * 1.08, Math.max(4, (crawler.r || player.r) * 0.42), 0, 0, Math.PI * 2);
  ctx.fill();
  drawRemoteCrawlerBadge(crawler);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(OTHER_CRAWLER_SPRITE_SHEET, frame * SPRITE_FRAME_W, row * SPRITE_FRAME_H, SPRITE_FRAME_W, SPRITE_FRAME_H, dx, dy, drawW, drawH);
  if (tint) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = tint;
    ctx.fillRect(dx, dy, drawW, drawH);
  }
  ctx.restore();
}

function drawPlayerSpriteAt(entity, alpha = 1, tint = null) {
  if (!isPlayerSpriteLoaded()) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawStandingFigure(entity, { color: tint || entity.color || "#75c7ff", outline: "rgba(255,255,255,0.55)", height: 22 });
    ctx.restore();
    return;
  }
  const frame = entity.frame ?? 0;
  const row = getEntitySpriteRowForAim(entity);
  const dx = entity.x - PLAYER_SPRITE_RENDER_WIDTH / 2;
  const dy = entity.y + (entity.r || player.r) - PLAYER_SPRITE_RENDER_HEIGHT;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(PLAYER_SPRITE_SHEET, frame * PLAYER_SPRITE_FRAME_WIDTH, row * PLAYER_SPRITE_FRAME_HEIGHT, PLAYER_SPRITE_FRAME_WIDTH, PLAYER_SPRITE_FRAME_HEIGHT, dx, dy, PLAYER_SPRITE_RENDER_WIDTH, PLAYER_SPRITE_RENDER_HEIGHT);
  if (tint) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = tint;
    ctx.fillRect(dx, dy, PLAYER_SPRITE_RENDER_WIDTH, PLAYER_SPRITE_RENDER_HEIGHT);
  }
  ctx.restore();
}

function drawDodgeEffects() {
  for (const puff of dodgePuffs) {
    const t = 1 - puff.life / Math.max(1, puff.maxLife);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t) * 0.65;
    ctx.fillStyle = puff.phase === "start" ? "rgba(210,190,145,0.58)" : "rgba(235,222,188,0.68)";
    for (let i = 0; i < 4; i++) {
      const side = i - 1.5;
      ctx.beginPath();
      ctx.ellipse(
        puff.x + puff.dirX * t * 22 + -puff.dirY * side * 4,
        puff.y + puff.dirY * t * 12 + puff.dirX * side * 3 + 5,
        puff.size * (0.6 + t) * (1 - i * 0.05),
        puff.size * 0.38 * (1 + t),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }
  for (const ghost of dodgeAfterimages) {
    const alpha = Math.max(0, ghost.life / Math.max(1, ghost.maxLife)) * 0.42;
    drawPlayerSpriteAt({ ...ghost, r: player.r }, alpha, "rgba(130,210,255,0.45)");
  }
}

function drawRemoteDodgeEffects(crawler) {
  if (!crawler?.isDodging) return;
  const dirX = Number.isFinite(crawler.aimX) ? crawler.aimX : 1;
  const dirY = Number.isFinite(crawler.aimY) ? crawler.aimY : 0;
  for (let i = 1; i <= 2; i++) {
    drawRemoteCrawlerSprite({ ...crawler, x: crawler.x - dirX * i * 12, y: crawler.y - dirY * i * 12, moving: true }, 0.2 / i, "rgba(117,199,255,0.42)");
  }
}

function wrapRoomLabel(label, maxCharsPerLine = 12) {
  const words = label.toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxCharsPerLine && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines.slice(0, 3) : [label.toUpperCase()];
}

function fitEngravedFont(lines, startingFontSize, maxWidth) {
  let fontSize = startingFontSize;

  while (fontSize > 12) {
    ctx.font = `900 ${fontSize}px Arial`;
    const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
    if (widest <= maxWidth) break;
    fontSize -= 2;
  }

  return fontSize;
}


const ENGRAVING_FLOOR_TILES = new Set([".", "S", "E", "C"]);

function isEngravableFloorTile(room, x, y) {
  return roomContainsTile(room, x, y) && ENGRAVING_FLOOR_TILES.has(map[y]?.[x]);
}

function contiguousFloorRun(room, startX, startY, dx, dy, componentTiles) {
  let length = 0;
  let x = startX;
  let y = startY;

  while (componentTiles.has(`${x},${y}`) && isEngravableFloorTile(room, x, y)) {
    length++;
    x += dx;
    y += dy;
  }

  return length;
}

function largestEngravingFloorComponent(room) {
  const floorTiles = roomTileList(room).filter(t => isEngravableFloorTile(room, t.x, t.y));
  const unvisited = new Set(floorTiles.map(t => `${t.x},${t.y}`));
  let largest = [];

  for (const tile of floorTiles) {
    const startKey = `${tile.x},${tile.y}`;
    if (!unvisited.has(startKey)) continue;

    const component = [];
    const queue = [tile];
    unvisited.delete(startKey);

    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      component.push(current);

      for (const direction of CARDINAL_DIRECTIONS) {
        const next = { x: current.x + direction.dx, y: current.y + direction.dy };
        const key = `${next.x},${next.y}`;
        if (!unvisited.has(key) || !isEngravableFloorTile(room, next.x, next.y)) continue;
        unvisited.delete(key);
        queue.push(next);
      }
    }

    if (component.length > largest.length) largest = component;
  }

  return largest;
}

function chooseEngravingPlacement(room) {
  const component = largestEngravingFloorComponent(room);
  if (component.length === 0) {
    return {
      cx: room.cx * TILE + TILE / 2,
      cy: room.cy * TILE + TILE / 2,
      tileWidth: Math.max(1, room.w) * TILE,
      tileHeight: Math.max(1, room.h) * TILE,
      centerTile: { x: room.cx, y: room.cy }
    };
  }

  const componentTiles = new Set(component.map(t => `${t.x},${t.y}`));
  const centroid = component.reduce((sum, t) => ({ x: sum.x + t.x, y: sum.y + t.y }), { x: 0, y: 0 });
  centroid.x /= component.length;
  centroid.y /= component.length;

  let best = component[0];
  let bestWidth = 1;
  let bestHeight = 1;
  let bestScore = -Infinity;

  for (const tile of component) {
    const horizontal = contiguousFloorRun(room, tile.x, tile.y, -1, 0, componentTiles) +
      contiguousFloorRun(room, tile.x + 1, tile.y, 1, 0, componentTiles);
    const vertical = contiguousFloorRun(room, tile.x, tile.y, 0, -1, componentTiles) +
      contiguousFloorRun(room, tile.x, tile.y + 1, 0, 1, componentTiles);
    const distancePenalty = Math.hypot(tile.x - centroid.x, tile.y - centroid.y) * 0.35;
    const score = horizontal * vertical + Math.min(horizontal, vertical) * 3 + horizontal * 0.8 - distancePenalty;

    if (score > bestScore) {
      best = tile;
      bestWidth = horizontal;
      bestHeight = vertical;
      bestScore = score;
    }
  }

  return {
    cx: best.x * TILE + TILE / 2,
    cy: best.y * TILE + TILE / 2,
    tileWidth: bestWidth * TILE,
    tileHeight: bestHeight * TILE,
    centerTile: best
  };
}

function drawEngravedRoomNames(camX, camY) {
  if (!rooms || !visible) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const room of rooms) {
    if (!room.seen || !room.name) continue;

    const placement = chooseEngravingPlacement(room);
    const cx = placement.cx;
    const cy = placement.cy;
    const centerTile = placement.centerTile;

    if (cx < camX - 260 || cx > camX + canvas.width + 260 || cy < camY - 200 || cy > camY + canvas.height / CAMERA_TILT_SCALE + 200) continue;

    const isRevealingThisRoom = roomRevealState?.roomId === room.id && !roomRevealState.complete;
    const revealFrames = 28;
    const revealProgress = roomRevealState?.roomId === room.id
      ? Math.max(0.18, Math.min(1, (frameCount - roomRevealState.startFrame) / revealFrames))
      : 1;

    let centerVisible = false;

    // During the reveal wave, allow the name to show while the crawler is inside the room,
    // even before the exact center tiles have become visible.
    if (isRevealingThisRoom) {
      centerVisible = true;
    } else {
      for (let y = centerTile.y - 1; y <= centerTile.y + 1; y++) {
        for (let x = centerTile.x - 1; x <= centerTile.x + 1; x++) {
          if (visible[y]?.[x]) centerVisible = true;
        }
      }
    }

    if (!centerVisible) continue;

    const roomPixelW = placement.tileWidth;
    const roomPixelH = placement.tileHeight;
    const usableWidth = Math.max(40, roomPixelW * 0.72);
    const usableHeight = Math.max(28, roomPixelH * 0.50);

    const maxChars = room.w <= 5 ? 7 : room.w <= 8 ? 10 : 14;
    const lines = wrapRoomLabel(room.name, maxChars);

    let fontSize = Math.floor(Math.min(roomPixelH * 0.22, roomPixelW * 0.105));
    fontSize = Math.max(14, Math.min(fontSize, room.type === "boss" ? 46 : 34));

    if (room.type === "boss") fontSize = Math.max(fontSize, 30);
    if (room.type === "safe") fontSize = Math.max(fontSize, 20);

    fontSize = fitEngravedFont(lines, fontSize, usableWidth);

    let lineHeight = fontSize * 0.92;
    const maxTotalHeight = usableHeight;
    if (lines.length * lineHeight > maxTotalHeight) {
      lineHeight = maxTotalHeight / lines.length;
      fontSize = Math.min(fontSize, Math.floor(lineHeight / 0.92));
      ctx.font = `900 ${fontSize}px Arial`;
    }

    const totalHeight = (lines.length - 1) * lineHeight;
    ctx.font = `900 ${fontSize}px Arial`;
    ctx.lineWidth = Math.max(1, Math.floor(fontSize / 18));

    const alpha = revealProgress;

    for (let i = 0; i < lines.length; i++) {
      const label = lines[i];
      const y = cy - totalHeight / 2 + i * lineHeight;

      ctx.fillStyle = room.type === "safe" ? `rgba(35,75,35,${0.24 * alpha})` :
                      room.type === "boss" ? `rgba(85,45,20,${0.28 * alpha})` :
                      `rgba(0,0,0,${0.22 * alpha})`;
      ctx.fillText(label, cx + 1.2, y + 1.2);

      ctx.fillStyle = room.type === "safe" ? `rgba(185,255,185,${0.095 * alpha})` :
                      room.type === "boss" ? `rgba(255,216,107,${0.105 * alpha})` :
                      `rgba(255,255,255,${0.08 * alpha})`;
      ctx.fillText(label, cx - 1, y - 1);

      ctx.fillStyle = room.type === "safe" ? `rgba(150,225,150,${0.055 * alpha})` :
                      room.type === "boss" ? `rgba(255,216,107,${0.065 * alpha})` :
                      `rgba(255,255,255,${0.046 * alpha})`;
      ctx.fillText(label, cx, y);
    }
  }

  ctx.restore();
}

function drawAttackTelegraph(telegraph) {
  const shape = telegraph.shape;
  const alpha = Math.max(0, telegraph.life / telegraph.maxLife);
  const aimAngle = Math.atan2(telegraph.aimY, telegraph.aimX);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = telegraph.color;
  ctx.fillStyle = telegraph.color.replace(/rgba\(([^)]+),[^,]+\)$/u, "rgba($1,0.10)");
  ctx.lineWidth = 3;

  if (shape.type === "circle") {
    ctx.beginPath();
    ctx.arc(telegraph.x, telegraph.y, shape.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (shape.type === "arc") {
    const start = aimAngle - shape.angle / 2;
    const end = aimAngle + shape.angle / 2;
    ctx.beginPath();
    ctx.moveTo(telegraph.x, telegraph.y);
    ctx.arc(telegraph.x, telegraph.y, shape.radius, start, end);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (shape.type === "line") {
    const half = shape.width / 2;
    const endX = telegraph.x + telegraph.aimX * shape.length;
    const endY = telegraph.y + telegraph.aimY * shape.length;
    const sideX = -telegraph.aimY * half;
    const sideY = telegraph.aimX * half;
    ctx.beginPath();
    ctx.moveTo(telegraph.x + sideX, telegraph.y + sideY);
    ctx.lineTo(endX + sideX, endY + sideY);
    ctx.lineTo(endX - sideX, endY - sideY);
    ctx.lineTo(telegraph.x - sideX, telegraph.y - sideY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (shape.type === "projectile") {
    ctx.beginPath();
    ctx.moveTo(telegraph.x, telegraph.y);
    ctx.lineTo(telegraph.x + telegraph.aimX * 44, telegraph.y + telegraph.aimY * 44);
    ctx.stroke();
  }

  ctx.restore();
}


function drawAimIndicator() {
  const startX = player.x + player.aimX * (player.r + 2);
  const startY = player.y + player.aimY * (player.r + 2);
  const endX = player.x + player.aimX * (player.r + 18);
  const endY = player.y + player.aimY * (player.r + 18);
  const sideX = -player.aimY;
  const sideY = player.aimX;

  ctx.save();
  ctx.strokeStyle = "rgba(255,216,107,0.82)";
  ctx.fillStyle = "rgba(255,216,107,0.92)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - player.aimX * 6 + sideX * 4, endY - player.aimY * 6 + sideY * 4);
  ctx.lineTo(endX - player.aimX * 6 - sideX * 4, endY - player.aimY * 6 - sideY * 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}


function drawFloatingFeedbackTexts() {
  if (!Array.isArray(floatingFeedbackTexts) || !floatingFeedbackTexts.length) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const feedback of floatingFeedbackTexts) {
    if (feedback.anchor) {
      feedback.x = feedback.anchor.x;
      feedback.y = feedback.anchor.y - (feedback.anchor.r || 0);
    }
    const age = feedback.maxLife - feedback.life;
    const alpha = Math.max(0, Math.min(1, feedback.life / Math.max(1, feedback.maxLife)));
    const x = feedback.x + feedback.offsetX;
    const y = feedback.y + feedback.offsetY + feedback.vy * age;
    ctx.globalAlpha = Math.min(1, alpha * 1.25);
    ctx.font = `900 ${feedback.size || 14}px Arial`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = feedback.stroke || "rgba(0,0,0,0.82)";
    ctx.fillStyle = feedback.color || "#fff";
    ctx.strokeText(feedback.text, x, y);
    ctx.fillText(feedback.text, x, y);
    feedback.life--;
  }
  ctx.restore();
  floatingFeedbackTexts = floatingFeedbackTexts.filter(feedback => feedback.life > 0);
}

function drawCombatVisuals() {
  for (const telegraph of attackTelegraphs) drawAttackTelegraph(telegraph);

  for (const projectile of projectiles) {
    const tx = Math.floor(projectile.x / TILE), ty = Math.floor(projectile.y / TILE);
    if (!visible[ty]?.[tx]) continue;
    ctx.fillStyle = projectile.color || "rgba(255,240,135,0.8)";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.stroke();
  }
}


const FLOORLIKE_VISUAL_TILES = new Set([".", "S", "C", "E"]);

function drawFloorDetail(detail, px, py, isVisible) {
  if (!detail) return;
  const alpha = isVisible ? 1 : 0.42;
  const cx = px + TILE / 2 + detail.ox;
  const cy = py + TILE / 2 + detail.oy;
  const s = detail.scale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(detail.rotation * Math.PI / 2);
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";

  if (detail.type === "crack") {
    ctx.strokeStyle = "rgba(0,0,0,0.26)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8 * s, -4 * s);
    ctx.lineTo(-2 * s, -1 * s);
    ctx.lineTo(2 * s, 5 * s);
    ctx.lineTo(8 * s, 2 * s);
    ctx.stroke();
  } else if (detail.type === "scratch") {
    ctx.strokeStyle = "rgba(210,210,190,0.09)";
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-8 * s, i * 4 * s);
      ctx.lineTo(7 * s, (i * 4 - 3) * s);
      ctx.stroke();
    }
  } else if (detail.type === "rubble") {
    ctx.fillStyle = "rgba(120,115,100,0.18)";
    ctx.fillRect(-7 * s, -4 * s, 5 * s, 4 * s);
    ctx.fillRect(1 * s, -2 * s, 6 * s, 5 * s);
    ctx.fillRect(-2 * s, 4 * s, 4 * s, 3 * s);
  } else if (detail.type === "stain") {
    ctx.fillStyle = "rgba(35,22,18,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 9 * s, 5 * s, 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (detail.type === "worn") {
    ctx.strokeStyle = "rgba(230,220,190,0.07)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-9 * s, -9 * s, 18 * s, 18 * s);
  }

  ctx.restore();
}

function drawWallAmbientShadow(px, py, isVisible) {
  ctx.fillStyle = isVisible ? "rgba(0,0,0,0.13)" : "rgba(0,0,0,0.08)";
  ctx.fillRect(px, py + TILE * 0.62, TILE, TILE * 0.38);
  ctx.strokeStyle = isVisible ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.14)";
  ctx.beginPath();
  ctx.moveTo(px, py + TILE - 0.5);
  ctx.lineTo(px + TILE, py + TILE - 0.5);
  ctx.stroke();
}

function drawWallFloorShadow(x, y, px, py, isVisible) {
  if (!FLOORLIKE_VISUAL_TILES.has(map[y]?.[x])) return;
  const alpha = isVisible ? 0.17 : 0.08;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  if (map[y - 1]?.[x] === "#") ctx.fillRect(px, py, TILE, 5);
  if (map[y + 1]?.[x] === "#") ctx.fillRect(px, py + TILE - 5, TILE, 5);
  if (map[y]?.[x - 1] === "#") ctx.fillRect(px, py, 5, TILE);
  if (map[y]?.[x + 1] === "#") ctx.fillRect(px + TILE - 5, py, 5, TILE);
}

function drawVisualDecal(decal, isVisible) {
  const px = decal.x * TILE + TILE / 2 + decal.ox;
  const py = decal.y * TILE + TILE / 2 + decal.oy;
  const s = decal.scale;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(decal.rotation);
  ctx.globalAlpha = isVisible ? 1 : 0.38;

  if (decal.type === "debris") {
    ctx.fillStyle = "rgba(120,110,92,0.42)";
    for (let i = 0; i < 5; i++) ctx.fillRect((i * 5 - 10) * s, ((i % 2) * 6 - 4) * s, 3 * s, 3 * s);
  } else if (decal.type === "brokenStone") {
    ctx.fillStyle = "rgba(145,140,122,0.36)";
    ctx.fillRect(-8 * s, -5 * s, 8 * s, 7 * s);
    ctx.fillRect(2 * s, -2 * s, 7 * s, 6 * s);
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.strokeRect(-8 * s, -5 * s, 8 * s, 7 * s);
  } else if (decal.type === "dust") {
    ctx.fillStyle = "rgba(190,180,150,0.13)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 12 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (decal.type === "scorch") {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 11 * s, 8 * s, 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (decal.type === "coins") {
    ctx.fillStyle = "rgba(224,177,74,0.72)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc((i * 5 - 7) * s, ((i % 2) * 5 - 2) * s, 2.4 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (decal.type === "marking") {
    ctx.strokeStyle = "rgba(190,185,150,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10 * s, 0);
    ctx.lineTo(10 * s, 0);
    ctx.moveTo(0, -10 * s);
    ctx.lineTo(0, 10 * s);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnvironmentalDecals(camX, camY) {
  if (!dungeonVisuals?.decals) return;
  for (const decal of dungeonVisuals.decals) {
    const px = decal.x * TILE;
    const py = decal.y * TILE;
    if (px < camX - TILE || px > camX + canvas.width + TILE || py < camY - TILE || py > camY + canvas.height / CAMERA_TILT_SCALE + TILE) continue;
    if (!seen[decal.y]?.[decal.x]) continue;
    drawVisualDecal(decal, visible[decal.y]?.[decal.x]);
  }
}


function shouldLightAffectTile(x, y) {
  if (visible[y]?.[x]) return true;

  // Let hallway torch glow linger in remembered corridor/doorway tiles without
  // revealing unseen rooms or changing the underlying visibility arrays.
  return !!seen[y]?.[x] && typeof isHallwayOrDoorwayFloor === "function" && isHallwayOrDoorwayFloor(x, y);
}

function addVisibleLightingClip(startX, endX, startY, endY) {
  ctx.beginPath();
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (shouldLightAffectTile(x, y)) ctx.rect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  ctx.clip();
}

function drawRadialLight(light) {
  const radius = light.radius || 96;
  const intensity = Math.max(0, Math.min(0.75, light.intensity || 0.25));
  const type = light.type || "lantern";
  const colors = ENVIRONMENTAL_LIGHT_COLORS?.[type] || ENVIRONMENTAL_LIGHT_COLORS?.lantern;
  const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius);
  gradient.addColorStop(0, `${colors.inner}${intensity})`);
  gradient.addColorStop(0.34, `${colors.inner}${intensity * 0.42})`);
  gradient.addColorStop(0.72, `${colors.outer}${intensity * 0.16})`);
  gradient.addColorStop(1, `${colors.outer}0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);
}

function drawAtmosphericLighting(startX, endX, startY, endY) {
  if (!lightingEnabled) return;

  const playerFlicker = 0.94 + Math.sin(frameCount * 0.19) * 0.045 + Math.sin(frameCount * 0.47) * 0.018;
  const lights = [];
  if (typeof hasEquippedLightSource === "function" && hasEquippedLightSource()) {
    const torch = player.equipment.light;
    lights.push({
      type: "torch",
      x: player.x,
      y: player.y,
      radius: torch.radius || (isMobileLike() ? 142 : 164),
      intensity: (torch.intensity || 0.36) * playerFlicker
    });
  }

  for (const light of environmentalLights) {
    if (!shouldDrawEnvironmentalLight(light, startX, endX, startY, endY)) continue;
    const flicker = light.type === "crystal"
      ? 0.96 + Math.sin(frameCount * 0.055 + light.tileX) * 0.04
      : 0.90 + Math.sin(frameCount * 0.17 + light.tileY) * 0.07 + Math.sin(frameCount * 0.41 + light.tileX) * 0.03;
    lights.push({ ...light, intensity: light.intensity * flicker });
  }

  ctx.save();
  addVisibleLightingClip(startX, endX, startY, endY);
  ctx.globalCompositeOperation = "lighter";
  for (const light of lights) drawRadialLight(light);
  ctx.restore();
}

function shouldDrawEnvironmentalLight(light, startX, endX, startY, endY) {
  if (visible[light.tileY]?.[light.tileX]) return true;
  if (!seen[light.tileY]?.[light.tileX]) return false;

  const radiusTiles = Math.ceil((light.radius || 96) / TILE);
  if (light.tileX + radiusTiles < startX || light.tileX - radiusTiles > endX ||
      light.tileY + radiusTiles < startY || light.tileY - radiusTiles > endY) return false;

  for (let y = Math.max(startY, light.tileY - radiusTiles); y <= Math.min(endY, light.tileY + radiusTiles); y++) {
    for (let x = Math.max(startX, light.tileX - radiusTiles); x <= Math.min(endX, light.tileX + radiusTiles); x++) {
      if (shouldLightAffectTile(x, y)) return true;
    }
  }

  return false;
}

function drawEnvironmentalLightFixtures() {
  if (!lightingEnabled) return;
  for (const light of environmentalLights) {
    if (!visible[light.tileY]?.[light.tileX]) continue;
    ctx.save();
    ctx.translate(light.x, light.y);
    if (light.type === "campfire") {
      ctx.fillStyle = "rgba(92,56,32,0.9)";
      ctx.beginPath();
      ctx.ellipse(0, 7, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(45,27,16,0.8)";
      ctx.stroke();
      ctx.fillStyle = "rgba(255,112,38,0.9)";
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.quadraticCurveTo(-1, -9, 2, 3);
      ctx.quadraticCurveTo(8, -5, 5, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,221,120,0.92)";
      ctx.beginPath();
      ctx.moveTo(-1, 4);
      ctx.quadraticCurveTo(2, -5, 4, 5);
      ctx.closePath();
      ctx.fill();
    } else if (light.type === "crystal") {
      ctx.fillStyle = "rgba(115,210,255,0.88)";
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(220,245,255,0.7)";
      ctx.stroke();
    } else {
      const dir = light.fixture?.wallDir || { dx: 0, dy: -1 };
      ctx.strokeStyle = "rgba(82,50,25,0.92)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-dir.dx * 2, -dir.dy * 2);
      ctx.lineTo(-dir.dx * 12, -dir.dy * 12);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(255,145,44,0.92)";
      ctx.beginPath();
      ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTutorialSigns() {
  if (!Array.isArray(tutorialSigns)) return;

  for (const sign of tutorialSigns) {
    if (!sign || seenTutorialSignIds.has(sign.id)) continue;
    if (!visible[sign.y]?.[sign.x]) continue;

    const sx = sign.x * TILE + TILE / 2;
    const sy = sign.y * TILE + TILE / 2;
    const pulse = 1 + Math.sin(frameCount * 0.08 + sign.x) * 0.08;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath();
    ctx.ellipse(0, 11, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5b3a1f";
    ctx.fillRect(-2, -1, 4, 17);
    ctx.fillStyle = "#d6b55c";
    ctx.strokeStyle = "#3f2a18";
    ctx.lineWidth = 2;
    ctx.fillRect(-12, -14, 24, 14);
    ctx.strokeRect(-12, -14, 24, 14);
    ctx.fillStyle = "#24180e";
    ctx.font = "900 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 0, -7);
    ctx.restore();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const camX = player.x - canvas.width / 2;

  ctx.save();
  const camOffsetY = applyDungeonCameraTransform(camX);
  const worldY = visibleWorldYBounds(camOffsetY);
  const camY = worldY.top;
  const viewWorldHeight = worldY.bottom - worldY.top;

  const startX = Math.max(0, Math.floor(camX / TILE) - 3);
  const endX = Math.min(MAP_COLS - 1, Math.floor((camX + canvas.width) / TILE) + 3);
  const startY = Math.max(0, Math.floor(worldY.top / TILE) - 4);
  const endY = Math.min(MAP_ROWS - 1, Math.floor(worldY.bottom / TILE) + 4);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const px = x * TILE, py = y * TILE;
      if (!seen[y][x]) { drawDungeonTileBase(px, py, "#080808"); continue; }
      const t = map[y][x], isVisible = visible[y][x];

      if (t === "#") {
        drawRaisedWallTile(px, py, isVisible);
      } else if (t === "S") {
        drawDungeonTileBase(px, py, isVisible ? "#203522" : "#172418");
      } else {
        drawDungeonTileBase(px, py, collapseStarted ? (isVisible ? "#2b1c1c" : "#1d1515") : (isVisible ? "#202020" : "#161616"));
      }

      drawWallFloorShadow(x, y, px, py, isVisible);
      drawFloorDetail(dungeonVisuals?.floor?.[y]?.[x], px, py, isVisible);

      if (t === "D") {
        ctx.fillStyle = isVisible ? "#7b4a22" : "#3f2a18";
        ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
        ctx.fillStyle = isVisible ? "rgba(35,20,12,0.55)" : "rgba(0,0,0,0.38)";
        ctx.fillRect(px + 5, py + 5, TILE - 10, 6);
      }
      if (t === "L") {
        ctx.fillStyle = isVisible ? "#4b1111" : "#241010";
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        if (isVisible) {
          ctx.strokeStyle = "#ff6b6b";
          ctx.strokeRect(px + 7, py + 7, TILE - 14, TILE - 14);
        }
      }
      if (t === "C" && isVisible) drawChestTile(px, py, isVisible);
      if (t === "E" && (isVisible || stairwellFound)) drawPortalTile(px, py, isVisible);
      if (!isVisible) { ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(px, py, TILE, TILE); }
    }
  }

  drawEnvironmentalDecals(camX, camY);
  drawPetMerchant();
  drawAtmosphericLighting(startX, endX, startY, endY);
  drawEnvironmentalLightFixtures();
  drawEngravedRoomNames(camX, camY);
  drawTutorialSigns();

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
    if (enemy.hp <= 0 && !enemy.isDying) continue;
    const tx = Math.floor(enemy.x / TILE), ty = Math.floor(enemy.y / TILE);
    if (!visible[ty]?.[tx]) continue;
    drawEnemySprite(enemy);
    ctx.fillStyle = "#ffbaba"; ctx.fillRect(enemy.x - 13, enemy.y - 35, 26 * (Math.max(0, enemy.hp) / enemy.maxHp), 4);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(enemy.name || `${enemy.boss ? "BOSS " : ""}Lv ${enemy.level || 1}`, enemy.x, enemy.y - 52);
    ctx.fillText(`${enemy.boss ? "BOSS " : ""}Lv ${enemy.level || 1}`, enemy.x, enemy.y - 45);
  }

  drawCombatVisuals();

  if (multiplayer.enabled && multiplayer.remotePlayers?.size) {
    for (const crawler of multiplayer.remotePlayers.values()) {
      const tx = Math.floor(crawler.x / TILE), ty = Math.floor(crawler.y / TILE);
      if (!visible[ty]?.[tx]) continue;

      drawRemoteDodgeEffects(crawler);
      drawRemoteCrawlerSprite(crawler);

      if (crawler.maxHp && crawler.status === "active") {
        ctx.fillStyle = "#75c7ff";
        ctx.fillRect(crawler.x - 13, crawler.y - 34, 26 * Math.max(0, crawler.hp ?? crawler.maxHp) / crawler.maxHp, 4);
      }

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(crawler.status === "downed" ? `${crawler.name || "Crawler"} DOWN` : (crawler.name || "Crawler"), crawler.x, crawler.y - 43);
    }
  }

  drawDodgeEffects();
  drawActivePet();
  drawPlayerSprite();

  if (multiplayer.enabled) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(playerProfile?.name || "Crawler", player.x, player.y - 43);
  }

  drawAimIndicator();
  drawFloatingFeedbackTexts();

  if (collapseStarted && frameCount % 30 < 15) {
    ctx.fillStyle = "rgba(150, 20, 20, 0.08)";
    ctx.fillRect(camX, camY, canvas.width, viewWorldHeight);
  }

  ctx.restore();
  drawMinimap();
}

function getMinimapScale(){
  return isMobileLike() ? 1.45 : 2.2;
}

const MOBILE_MINIMAP_SIZE = 120;
const MOBILE_MINIMAP_BORDER = 4;
const MOBILE_MINIMAP_TILE_SCALE = 4.8;

function isPointInsideMobileMinimap(px, py, centerX, centerY, radius){
  return Math.hypot(px - centerX, py - centerY) <= radius;
}

function drawMobileMinimapMarker(x, y, radius, color, centerX, centerY, clipRadius){
  if(!isPointInsideMobileMinimap(x, y, centerX, centerY, clipRadius)) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function safeRoomWaypoint(){
  const safeRoom = rooms?.find(room => room.type === "safe");
  if(!safeRoom) return null;
  const discovered = safeRoom.seen || seen?.[safeRoom.cy]?.[safeRoom.cx];
  if(!discovered) return null;
  return { x: safeRoom.cx + 0.5, y: safeRoom.cy + 0.5 };
}

function drawMobileWaypointMarker(targetX, targetY, color, strokeColor, centerX, centerY, innerRadius, label){
  const playerTileX = player.x / TILE;
  const playerTileY = player.y / TILE;
  const dx = (targetX - playerTileX) * MOBILE_MINIMAP_TILE_SCALE;
  const dy = (targetY - playerTileY) * MOBILE_MINIMAP_TILE_SCALE;
  const dist = Math.hypot(dx, dy);
  if(dist < 0.001) return;

  const markerRadius = innerRadius - 7;
  const inside = dist <= markerRadius;
  const markerX = inside ? centerX + dx : centerX + (dx / dist) * markerRadius;
  const markerY = inside ? centerY + dy : centerY + (dy / dist) * markerRadius;
  const pulse = inside ? 4 + Math.sin(frameCount * 0.08) : 5 + Math.sin(frameCount * 0.1) * 0.7;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = inside ? 2 : 2.5;

  if(inside){
    ctx.beginPath();
    ctx.arc(markerX, markerY, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    const angle = Math.atan2(dy, dx);
    ctx.translate(markerX, markerY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-4, -6);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  ctx.font = "8px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fillText(label, markerX, markerY + (inside ? 0.2 : 0));
  ctx.restore();
}

function rebuildMinimapCache(scale){
  const w=Math.ceil(MAP_COLS*scale), h=Math.ceil(MAP_ROWS*scale);
  if(minimapCanvas.width!==w || minimapCanvas.height!==h){
    minimapCanvas.width=w;
    minimapCanvas.height=h;
  }

  minimapCtx.clearRect(0,0,w,h);

  for(let y=0;y<MAP_ROWS;y++){
    for(let x=0;x<MAP_COLS;x++){
      const t=map[y][x];
      if(!seen[y][x] && !(stairwellFound && x===stairwellX && y===stairwellY)) continue;
      if(t==="#") minimapCtx.fillStyle="rgba(95,95,95,0.45)";
      else if(t==="S") minimapCtx.fillStyle="rgba(123,224,123,0.8)";
      else if(t==="E") minimapCtx.fillStyle=stairwellFound ? "rgba(80,160,255,1)" : "rgba(80,120,255,0.95)";
      else if(t==="L") minimapCtx.fillStyle="rgba(255,90,90,0.95)";
      else minimapCtx.fillStyle="rgba(170,170,170,0.55)";

      minimapCtx.fillRect(Math.floor(x*scale),Math.floor(y*scale),Math.ceil(scale),Math.ceil(scale));
    }
  }

  minimapDirty=false;
  minimapLastScale=scale;
}

function drawMinimap(){
  if(isMobileLike()){
    drawMobileMinimap();
    return;
  }

  const scale=getMinimapScale();

  if(minimapDirty || minimapLastScale!==scale){
    rebuildMinimapCache(scale);
  }

  const w=minimapCanvas.width, h=minimapCanvas.height;
  let x0=canvas.width-w-14, y0=canvas.height-h-14;
  try {
    const saved=JSON.parse(localStorage.getItem("dcw.uiLayout.v1")||"{}").minimap;
    if(saved){ x0=saved.left+6; y0=saved.top+6; }
  } catch {}

  ctx.fillStyle="rgba(0,0,0,0.58)";
  ctx.fillRect(x0-6,y0-6,w+12,h+12);
  ctx.strokeStyle="rgba(255,255,255,0.22)";
  ctx.strokeRect(x0-6,y0-6,w+12,h+12);

  ctx.drawImage(minimapCanvas,x0,y0);

  ctx.fillStyle="#ffffff";
  ctx.beginPath();
  ctx.arc(x0+(player.x/TILE)*scale,y0+(player.y/TILE)*scale,3.2,0,Math.PI*2);
  ctx.fill();

  for (const corpse of corpses) {
    if (corpse.looted) continue;
    const cx = Math.floor(corpse.x / TILE);
    const cy = Math.floor(corpse.y / TILE);
    if (!seen[cy]?.[cx]) continue;
    ctx.fillStyle = corpse.boss ? "rgba(210,150,255,0.95)" : "rgba(160,120,85,0.85)";
    ctx.beginPath();
    ctx.arc(x0 + (corpse.x / TILE) * scale, y0 + (corpse.y / TILE) * scale, corpse.boss ? 2.8 : 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  if(stairwellFound && stairwellX !== null && stairwellY !== null){
    const sx = x0 + (stairwellX + 0.5) * scale;
    const sy = y0 + (stairwellY + 0.5) * scale;
    const pulse = 4.8 + Math.sin(frameCount * 0.08) * 1.2;
    ctx.fillStyle = "rgba(80,160,255,0.95)";
    ctx.beginPath();
    ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(190,215,255,1)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  if(bossEnemy && bossEnemy.hp>0){
    const bx=Math.floor(bossEnemy.x/TILE), by=Math.floor(bossEnemy.y/TILE);
    if(seen[by]?.[bx]){
      ctx.fillStyle="#ffd86b";
      ctx.beginPath();
      ctx.arc(x0+(bossEnemy.x/TILE)*scale,y0+(bossEnemy.y/TILE)*scale,2.8,0,Math.PI*2);
      ctx.fill();
    }
  }
}

function drawMobileMinimap(){
  const size = Math.min(MOBILE_MINIMAP_SIZE, Math.max(86, Math.floor(canvas.width * 0.28)));
  const border = MOBILE_MINIMAP_BORDER;
  const radius = size / 2;
  const innerRadius = radius - border;
  const controllerAnchored = gamepadState.connected;
  const centerX = controllerAnchored ? canvas.width - radius - 14 : canvas.width / 2;
  const centerY = canvas.height - radius - 12;
  const x0 = centerX - radius;
  const y0 = centerY - radius;
  const scale = MOBILE_MINIMAP_TILE_SCALE;
  const playerTileX = player.x / TILE;
  const playerTileY = player.y / TILE;
  const tileRadius = Math.ceil(innerRadius / scale) + 1;
  const startTileX = Math.max(0, Math.floor(playerTileX) - tileRadius);
  const endTileX = Math.min(MAP_COLS - 1, Math.floor(playerTileX) + tileRadius);
  const startTileY = Math.max(0, Math.floor(playerTileY) - tileRadius);
  const endTileY = Math.min(MAP_ROWS - 1, Math.floor(playerTileY) + tileRadius);

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.66)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,216,107,0.26)";
  ctx.lineWidth = border;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - border / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = "rgba(12,12,12,0.82)";
  ctx.fillRect(x0, y0, size, size);

  for(let y = startTileY; y <= endTileY; y++){
    for(let x = startTileX; x <= endTileX; x++){
      if(!seen[y]?.[x] && !(stairwellFound && x === stairwellX && y === stairwellY)) continue;
      const t = map[y][x];
      if(t === "#") ctx.fillStyle = "rgba(95,95,95,0.52)";
      else if(t === "S") ctx.fillStyle = "rgba(123,224,123,0.9)";
      else if(t === "E") ctx.fillStyle = stairwellFound ? "rgba(80,160,255,1)" : "rgba(80,120,255,0.95)";
      else if(t === "L") ctx.fillStyle = "rgba(255,90,90,0.95)";
      else ctx.fillStyle = "rgba(180,180,180,0.62)";

      const px = centerX + (x - playerTileX) * scale;
      const py = centerY + (y - playerTileY) * scale;
      ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(scale), Math.ceil(scale));
    }
  }

  for (const corpse of corpses) {
    if (corpse.looted) continue;
    const cx = Math.floor(corpse.x / TILE);
    const cy = Math.floor(corpse.y / TILE);
    if (!seen[cy]?.[cx]) continue;
    const px = centerX + ((corpse.x / TILE) - playerTileX) * scale;
    const py = centerY + ((corpse.y / TILE) - playerTileY) * scale;
    drawMobileMinimapMarker(px, py, corpse.boss ? 3 : 2.2, corpse.boss ? "rgba(210,150,255,0.95)" : "rgba(160,120,85,0.85)", centerX, centerY, innerRadius);
  }

  const safeWaypoint = safeRoomWaypoint();
  if(safeWaypoint){
    drawMobileWaypointMarker(safeWaypoint.x, safeWaypoint.y, "rgba(91,235,126,0.96)", "rgba(205,255,214,0.98)", centerX, centerY, innerRadius, "S");
  }

  if(stairwellFound && stairwellX !== null && stairwellY !== null){
    drawMobileWaypointMarker(stairwellX + 0.5, stairwellY + 0.5, "rgba(80,160,255,0.96)", "rgba(190,215,255,1)", centerX, centerY, innerRadius, "⇩");
  }

  if(bossEnemy && bossEnemy.hp > 0){
    const bx = Math.floor(bossEnemy.x / TILE), by = Math.floor(bossEnemy.y / TILE);
    if(seen[by]?.[bx]){
      const px = centerX + ((bossEnemy.x / TILE) - playerTileX) * scale;
      const py = centerY + ((bossEnemy.y / TILE) - playerTileY) * scale;
      drawMobileMinimapMarker(px, py, 3, "#ffd86b", centerX, centerY, innerRadius);
    }
  }

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawPetMerchant() {
  if (!petMerchant) return;
  const tx = Math.floor(petMerchant.x / TILE), ty = Math.floor(petMerchant.y / TILE);
  if (!visible[ty]?.[tx]) return;
  ctx.save();
  ctx.fillStyle = "rgba(255,216,107,0.88)";
  ctx.beginPath(); ctx.arc(petMerchant.x, petMerchant.y, petMerchant.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(70,35,10,0.9)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#2b1808"; ctx.font = "900 12px Arial"; ctx.textAlign = "center"; ctx.fillText("🐾", petMerchant.x, petMerchant.y + 4);
  ctx.fillStyle = "rgba(255,245,190,0.92)"; ctx.font = "10px Arial"; ctx.fillText("Pet Merchant", petMerchant.x, petMerchant.y - 22);
  ctx.restore();
}

function drawActivePet() {
  const pet = typeof getActivePet === "function" ? getActivePet() : null;
  if (!pet) return;
  const tx = Math.floor(pet.x / TILE), ty = Math.floor(pet.y / TILE);
  if (!visible[ty]?.[tx]) return;
  ctx.save();
  ctx.translate(pet.x, pet.y);
  const def = getPetDefinition(pet);
  if (pet.type === "fluffy_cat") {
    ctx.fillStyle = "#f7d7ff"; ctx.beginPath(); ctx.arc(0, 0, pet.r + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f0b8fb"; ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(-3, -16); ctx.lineTo(1, -6); ctx.moveTo(5, -6); ctx.lineTo(9, -16); ctx.lineTo(12, -5); ctx.fill();
    ctx.fillStyle = "#9ff3ff"; ctx.fillRect(-5, -2, 3, 3); ctx.fillRect(4, -2, 3, 3);
  } else if (pet.type === "small_velociraptor") {
    ctx.fillStyle = "#70d46f"; ctx.beginPath(); ctx.ellipse(0, 1, pet.r + 5, pet.r, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#b8ff9a"; ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(18, -7); ctx.lineTo(11, 5); ctx.fill();
    ctx.strokeStyle = "#3d8b3d"; ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(-18, 8); ctx.stroke();
  } else {
    ctx.fillStyle = "#d8a35d"; ctx.beginPath(); ctx.ellipse(0, 2, pet.r + 5, pet.r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8a5a2e"; ctx.beginPath(); ctx.arc(-6, -7, 4, 0, Math.PI * 2); ctx.arc(6, -7, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#f0c17b"; ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(20, -8, 17, -15); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.font = "10px Arial"; ctx.textAlign = "center";
  ctx.fillText(`${def?.displayName || pet.displayName} Lv ${pet.level}`, pet.x, pet.y - 24);
}
