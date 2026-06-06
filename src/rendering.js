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

    if (cx < camX - 260 || cx > camX + canvas.width + 260 || cy < camY - 200 || cy > camY + canvas.height + 200) continue;

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
    if (px < camX - TILE || px > camX + canvas.width + TILE || py < camY - TILE || py > camY + canvas.height + TILE) continue;
    if (!seen[decal.y]?.[decal.x]) continue;
    drawVisualDecal(decal, visible[decal.y]?.[decal.x]);
  }
}


function addVisibleLightingClip(startX, endX, startY, endY) {
  ctx.beginPath();
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (visible[y]?.[x]) ctx.rect(x * TILE, y * TILE, TILE, TILE);
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
  const lights = [{
    type: "lantern",
    x: player.x,
    y: player.y,
    radius: isMobileLike() ? 142 : 164,
    intensity: 0.36 * playerFlicker
  }];

  for (const light of environmentalLights) {
    if (!visible[light.tileY]?.[light.tileX]) continue;
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

function drawEnvironmentalLightFixtures() {
  if (!lightingEnabled) return;
  for (const light of environmentalLights) {
    if (!visible[light.tileY]?.[light.tileX]) continue;
    ctx.save();
    ctx.translate(light.x, light.y);
    if (light.type === "crystal") {
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
      ctx.fillStyle = light.type === "torch" ? "rgba(255,145,44,0.92)" : "rgba(255,220,130,0.86)";
      ctx.beginPath();
      ctx.arc(0, -2, light.type === "torch" ? 4.2 : 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,58,28,0.85)";
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(0, 10);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;

  ctx.save();
  ctx.translate(-camX, -camY);

  const startX = Math.max(0, Math.floor(camX / TILE) - 2);
  const endX = Math.min(MAP_COLS - 1, Math.floor((camX + canvas.width) / TILE) + 2);
  const startY = Math.max(0, Math.floor(camY / TILE) - 2);
  const endY = Math.min(MAP_ROWS - 1, Math.floor((camY + canvas.height) / TILE) + 2);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const px = x * TILE, py = y * TILE;
      if (!seen[y][x]) { ctx.fillStyle = "#080808"; ctx.fillRect(px, py, TILE, TILE); continue; }
      const t = map[y][x], isVisible = visible[y][x];

      if (t === "#") {
        ctx.fillStyle = isVisible ? "#333" : "#1e1e1e";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = isVisible ? "#444" : "#262626";
        ctx.strokeRect(px, py, TILE, TILE);
        drawWallAmbientShadow(px, py, isVisible);
      } else if (t === "S") {
        ctx.fillStyle = isVisible ? "#203522" : "#172418";
        ctx.fillRect(px, py, TILE, TILE);
      } else {
        ctx.fillStyle = collapseStarted ? (isVisible ? "#2b1c1c" : "#1d1515") : (isVisible ? "#202020" : "#161616");
        ctx.fillRect(px, py, TILE, TILE);
      }

      drawWallFloorShadow(x, y, px, py, isVisible);
      drawFloorDetail(dungeonVisuals?.floor?.[y]?.[x], px, py, isVisible);

      if (t === "D") { ctx.fillStyle = isVisible ? "#7b4a22" : "#3f2a18"; ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10); }
      if (t === "L") {
        ctx.fillStyle = isVisible ? "#4b1111" : "#241010";
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        if (isVisible) {
          ctx.strokeStyle = "#ff6b6b";
          ctx.strokeRect(px + 7, py + 7, TILE - 14, TILE - 14);
        }
      }
      if (t === "C" && isVisible) {
        ctx.fillStyle = "#a36a21"; ctx.fillRect(px + 7, py + 10, TILE - 14, TILE - 15);
        ctx.fillStyle = "#e0b14a"; ctx.fillRect(px + 13, py + 15, 7, 7);
      }
      if (t === "E" && (isVisible || stairwellFound)) {
        ctx.fillStyle = "#3f63ff";
        ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, 13, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#9db1ff"; ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 1;
      }
      if (!isVisible) { ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(px, py, TILE, TILE); }
    }
  }

  drawEnvironmentalDecals(camX, camY);
  drawAtmosphericLighting(startX, endX, startY, endY);
  drawEnvironmentalLightFixtures();
  drawEngravedRoomNames(camX, camY);

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
    const tx = Math.floor(enemy.x / TILE), ty = Math.floor(enemy.y / TILE);
    if (!visible[ty]?.[tx]) continue;
    ctx.fillStyle = enemy.boss ? "#8f38ff" : (collapseStarted ? "#d13b3b" : "#9b3131");
    ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2); ctx.fill();
    if(enemy.boss){ctx.strokeStyle="#ffd86b";ctx.lineWidth=3;ctx.stroke();ctx.lineWidth=1;}
    ctx.fillStyle = "#ffbaba"; ctx.fillRect(enemy.x - 13, enemy.y - 22, 26 * (enemy.hp / enemy.maxHp), 4);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${enemy.boss ? "BOSS " : ""}Lv ${enemy.level || 1}`, enemy.x, enemy.y - 27);
  }

  drawCombatVisuals();

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + player.r * 0.72, player.r * 1.05, Math.max(4, player.r * 0.42), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = player.safe ? "#7be07b" : "#f1f1f1";
  ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();

  drawAimIndicator();

  if (collapseStarted && frameCount % 30 < 15) {
    ctx.fillStyle = "rgba(150, 20, 20, 0.08)";
    ctx.fillRect(camX, camY, canvas.width, canvas.height);
  }

  ctx.restore();
  drawMinimap();
}

function getMinimapScale(){
  return isMobileLike() ? 1.45 : 2.2;
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
  const scale=getMinimapScale();

  if(minimapDirty || minimapLastScale!==scale){
    rebuildMinimapCache(scale);
  }

  const w=minimapCanvas.width, h=minimapCanvas.height;
  const x0=canvas.width-w-14, y0=canvas.height-h-14;

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

