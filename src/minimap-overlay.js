(function installEmbeddedDoorsAndLightingOverlay() {
  const originalDrawEnvironmentalLightFixtures = typeof drawEnvironmentalLightFixtures === "function" ? drawEnvironmentalLightFixtures : null;
  if (!originalDrawEnvironmentalLightFixtures || originalDrawEnvironmentalLightFixtures.__doorsLightingWrapped) return;

  const originalDrawRadialLight = typeof drawRadialLight === "function" ? drawRadialLight : null;
  if (originalDrawRadialLight && !originalDrawRadialLight.__wallLightBoostWrapped) {
    drawRadialLight = function drawRadialLightWithWallBoost(light) {
      if (light?.fixture?.wallMounted) {
        return originalDrawRadialLight({
          ...light,
          radius: Math.round((light.radius || 96) * 1.12),
          intensity: Math.min(0.62, (light.intensity || 0.25) * 1.16)
        });
      }
      return originalDrawRadialLight(light);
    };
    drawRadialLight.__wallLightBoostWrapped = true;
  }

  function isDoorOrLockTile(tile) {
    return tile === "D" || tile === "L";
  }

  function isDoorWalkableNeighbor(tile) {
    return tile === "." || tile === "S" || tile === "C" || tile === "E" || tile === "D" || tile === "L";
  }

  function doorOrientation(x, y) {
    const up = map?.[y - 1]?.[x];
    const down = map?.[y + 1]?.[x];
    const left = map?.[y]?.[x - 1];
    const right = map?.[y]?.[x + 1];
    if (up === "#" && down === "#" && isDoorWalkableNeighbor(left) && isDoorWalkableNeighbor(right)) return "eastWest";
    if (left === "#" && right === "#" && isDoorWalkableNeighbor(up) && isDoorWalkableNeighbor(down)) return "northSouth";
    return Math.abs((isDoorWalkableNeighbor(left) ? 1 : 0) + (isDoorWalkableNeighbor(right) ? 1 : 0)) >=
      Math.abs((isDoorWalkableNeighbor(up) ? 1 : 0) + (isDoorWalkableNeighbor(down) ? 1 : 0)) ? "eastWest" : "northSouth";
  }

  function drawDoorGlow(px, py, locked) {
    const color = locked
      ? { inner: "rgba(255,80,80,0.32)", outer: "rgba(255,40,40,0)" }
      : { inner: "rgba(255,176,76,0.14)", outer: "rgba(255,176,76,0)" };
    const cx = px + TILE / 2;
    const cy = py + TILE / 2;
    const radius = locked ? TILE * 0.95 : TILE * 0.72;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, color.inner);
    gradient.addColorStop(1, color.outer);
    ctx.fillStyle = gradient;
    ctx.fillRect(px - TILE * 0.3, py - TILE * 0.3, TILE * 1.6, TILE * 1.6);
  }

  function drawEmbeddedDoorTile(x, y) {
    const tile = map?.[y]?.[x];
    if (!isDoorOrLockTile(tile) || !visible?.[y]?.[x]) return;

    const px = x * TILE;
    const py = y * TILE;
    const locked = tile === "L";
    const orientation = doorOrientation(x, y);
    const stoneDark = locked ? "#38231f" : "#3a352d";
    const stoneMid = locked ? "#512421" : "#595143";
    const stoneLight = locked ? "rgba(255,108,92,0.30)" : "rgba(177,160,123,0.34)";
    const panel = locked ? "#471316" : "#79502b";
    const panelDark = locked ? "#240b0d" : "#3d2717";
    const trim = locked ? "rgba(255,100,92,0.70)" : "rgba(226,169,83,0.55)";

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    drawDoorGlow(px, py, locked);

    ctx.fillStyle = "rgba(0,0,0,0.36)";
    ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);

    ctx.fillStyle = stoneDark;
    ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);

    if (orientation === "eastWest") {
      ctx.fillStyle = stoneMid;
      ctx.fillRect(px + 2, py + 1, TILE - 4, 6);
      ctx.fillRect(px + 2, py + TILE - 7, TILE - 4, 6);
      ctx.fillStyle = stoneLight;
      ctx.fillRect(px + 3, py + 1, TILE - 6, 1);
      ctx.fillRect(px + 3, py + TILE - 7, TILE - 6, 1);

      ctx.fillStyle = panel;
      ctx.fillRect(px + 8, py + 5, TILE - 16, TILE - 10);
      ctx.strokeStyle = panelDark;
      ctx.strokeRect(px + 8.5, py + 5.5, TILE - 17, TILE - 11);
      ctx.strokeStyle = locked ? "rgba(255,155,145,0.58)" : "rgba(35,20,12,0.48)";
      ctx.beginPath();
      ctx.moveTo(px + TILE / 2, py + 7);
      ctx.lineTo(px + TILE / 2, py + TILE - 7);
      ctx.moveTo(px + 11, py + 10);
      ctx.lineTo(px + 11, py + TILE - 10);
      ctx.moveTo(px + TILE - 11, py + 10);
      ctx.lineTo(px + TILE - 11, py + TILE - 10);
      ctx.stroke();
    } else {
      ctx.fillStyle = stoneMid;
      ctx.fillRect(px + 1, py + 2, 6, TILE - 4);
      ctx.fillRect(px + TILE - 7, py + 2, 6, TILE - 4);
      ctx.fillStyle = stoneLight;
      ctx.fillRect(px + 1, py + 3, 1, TILE - 6);
      ctx.fillRect(px + TILE - 7, py + 3, 1, TILE - 6);

      ctx.fillStyle = panel;
      ctx.fillRect(px + 5, py + 8, TILE - 10, TILE - 16);
      ctx.strokeStyle = panelDark;
      ctx.strokeRect(px + 5.5, py + 8.5, TILE - 11, TILE - 17);
      ctx.strokeStyle = locked ? "rgba(255,155,145,0.58)" : "rgba(35,20,12,0.48)";
      ctx.beginPath();
      ctx.moveTo(px + 7, py + TILE / 2);
      ctx.lineTo(px + TILE - 7, py + TILE / 2);
      ctx.moveTo(px + 10, py + 11);
      ctx.lineTo(px + TILE - 10, py + 11);
      ctx.moveTo(px + 10, py + TILE - 11);
      ctx.lineTo(px + TILE - 10, py + TILE - 11);
      ctx.stroke();
    }

    ctx.strokeStyle = trim;
    ctx.lineWidth = locked ? 2 : 1;
    if (locked) {
      ctx.beginPath();
      ctx.moveTo(px + 9, py + 9);
      ctx.lineTo(px + TILE - 9, py + TILE - 9);
      ctx.moveTo(px + TILE - 9, py + 9);
      ctx.lineTo(px + 9, py + TILE - 9);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,74,74,0.92)";
      ctx.fillRect(px + TILE / 2 - 3, py + TILE / 2 - 3, 6, 6);
    } else {
      ctx.fillStyle = "rgba(238,178,83,0.82)";
      ctx.fillRect(orientation === "eastWest" ? px + TILE - 13 : px + TILE - 12, orientation === "eastWest" ? py + TILE / 2 - 2 : py + TILE - 13, 4, 4);
    }

    ctx.restore();
    ctx.lineWidth = 1;
  }

  function drawVisibleDoorOverlays() {
    if (!map || !visible) return;
    for (let y = 1; y < MAP_ROWS - 1; y++) {
      for (let x = 1; x < MAP_COLS - 1; x++) {
        if (isDoorOrLockTile(map[y]?.[x])) drawEmbeddedDoorTile(x, y);
      }
    }
  }

  function drawEnhancedLightFixture(light) {
    if (!light || !visible?.[light.tileY]?.[light.tileX]) return;

    ctx.save();
    ctx.translate(light.x, light.y);
    ctx.imageSmoothingEnabled = false;

    if (light.type === "campfire") {
      ctx.fillStyle = "rgba(255,160,55,0.34)";
      ctx.beginPath();
      ctx.ellipse(0, 6, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,224,132,0.92)";
      ctx.fillRect(-2, -3, 4, 9);
      ctx.fillStyle = "rgba(255,92,32,0.82)";
      ctx.fillRect(-6, 1, 4, 8);
      ctx.fillRect(3, 0, 4, 9);
      ctx.restore();
      return;
    }

    const dir = light.fixture?.wallDir || { dx: 0, dy: -1 };
    const anchorX = -dir.dx * 8;
    const anchorY = -dir.dy * 8;

    ctx.fillStyle = light.type === "crystal" ? "rgba(100,205,255,0.18)" : "rgba(255,160,72,0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 0, light.type === "crystal" ? 15 : 13, light.type === "crystal" ? 11 : 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(32,24,18,0.88)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(anchorX - dir.dx * 9, anchorY - dir.dy * 9);
    ctx.stroke();

    ctx.strokeStyle = light.type === "crystal" ? "rgba(190,238,255,0.72)" : "rgba(255,206,132,0.58)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(anchorX - dir.dx * 9, anchorY - dir.dy * 9);
    ctx.stroke();

    if (light.type === "crystal") {
      ctx.fillStyle = "rgba(112,215,255,0.95)";
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(230,250,255,0.86)";
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(255,86,30,0.95)";
      ctx.beginPath();
      ctx.moveTo(-5, 5);
      ctx.quadraticCurveTo(-2, -10, 2, 2);
      ctx.quadraticCurveTo(8, -5, 5, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,232,126,0.95)";
      ctx.beginPath();
      ctx.moveTo(-1, 5);
      ctx.quadraticCurveTo(2, -5, 4, 5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
    ctx.lineWidth = 1;
  }

  function drawEnhancedEnvironmentalLightFixtures() {
    for (const light of environmentalLights || []) {
      if (!light?.fixture?.wallMounted && light?.type !== "campfire") continue;
      drawEnhancedLightFixture(light);
    }
  }

  drawEnvironmentalLightFixtures = function drawEnvironmentalLightFixturesWithDoorsAndBetterLight() {
    originalDrawEnvironmentalLightFixtures();
    drawVisibleDoorOverlays();
    drawEnhancedEnvironmentalLightFixtures();
  };
  drawEnvironmentalLightFixtures.__doorsLightingWrapped = true;
})();

(function installDungeonWallEdgeOverlay() {
  const originalDrawWallFloorShadow = typeof drawWallFloorShadow === "function" ? drawWallFloorShadow : null;
  if (!originalDrawWallFloorShadow || originalDrawWallFloorShadow.__wallEdgeOverlayWrapped) return;

  // This file loads after rendering.js and before main.js. The hook belongs here so
  // we can add wall visuals without touching collision, map generation, fog, or assets.
  const FLOORLIKE_WALL_EDGE_TILES = new Set([".", "S", "C", "E", "D", "L"]);

  function isFloorLikeVisualTile(tile) {
    return FLOORLIKE_WALL_EDGE_TILES.has(tile);
  }

  function hasWallNeighbor(x, y, dx, dy) {
    return map?.[y + dy]?.[x + dx] === "#";
  }

  function drawWallEdgeOverlay(x, y, px, py, isVisible) {
    if (!isFloorLikeVisualTile(map?.[y]?.[x]) || !seen?.[y]?.[x]) return;

    const north = hasWallNeighbor(x, y, 0, -1);
    const south = hasWallNeighbor(x, y, 0, 1);
    const west = hasWallNeighbor(x, y, -1, 0);
    const east = hasWallNeighbor(x, y, 1, 0);
    if (!north && !south && !west && !east) return;

    const alpha = isVisible ? 0.88 : 0.38;
    const backFace = isVisible ? "#37332d" : "#22201d";
    const topCap = isVisible ? "#474238" : "#2c2924";
    const sideFace = isVisible ? "#2e2b26" : "#1d1b18";
    const lowLip = isVisible ? "#292721" : "#1b1916";
    const edge = isVisible ? "rgba(150,140,116,0.42)" : "rgba(86,80,68,0.32)";
    const seam = isVisible ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.16)";
    const shadow = isVisible ? "rgba(0,0,0,0.24)" : "rgba(0,0,0,0.14)";

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;

    // Floor contact shadows. These sell the wall without turning every border into a bulky block.
    ctx.fillStyle = shadow;
    if (north) ctx.fillRect(px, py, TILE, 6);
    if (south) ctx.fillRect(px, py + TILE - 6, TILE, 6);
    if (west) ctx.fillRect(px, py, 5, TILE);
    if (east) ctx.fillRect(px + TILE - 5, py, 5, TILE);

    if (north) {
      ctx.fillStyle = backFace;
      ctx.fillRect(px, py - 10, TILE, 10);
      ctx.fillStyle = topCap;
      ctx.fillRect(px, py - 14, TILE, 5);
      ctx.strokeStyle = edge;
      ctx.beginPath();
      ctx.moveTo(px, py - 9.5);
      ctx.lineTo(px + TILE, py - 9.5);
      ctx.moveTo(px, py - 0.5);
      ctx.lineTo(px + TILE, py - 0.5);
      ctx.stroke();
      ctx.strokeStyle = seam;
      ctx.beginPath();
      ctx.moveTo(px + TILE * 0.5, py - 13);
      ctx.lineTo(px + TILE * 0.5, py - 1);
      ctx.stroke();
    }

    if (west) {
      ctx.fillStyle = sideFace;
      ctx.fillRect(px, py, 5, TILE);
      ctx.strokeStyle = edge;
      ctx.beginPath();
      ctx.moveTo(px + 4.5, py);
      ctx.lineTo(px + 4.5, py + TILE);
      ctx.stroke();
    }

    if (east) {
      ctx.fillStyle = sideFace;
      ctx.fillRect(px + TILE - 5, py, 5, TILE);
      ctx.strokeStyle = edge;
      ctx.beginPath();
      ctx.moveTo(px + TILE - 5.5, py);
      ctx.lineTo(px + TILE - 5.5, py + TILE);
      ctx.stroke();
    }

    if (south) {
      ctx.fillStyle = lowLip;
      ctx.fillRect(px, py + TILE - 6, TILE, 6);
      ctx.strokeStyle = edge;
      ctx.beginPath();
      ctx.moveTo(px, py + TILE - 6.5);
      ctx.lineTo(px + TILE, py + TILE - 6.5);
      ctx.stroke();
    }

    // Darken seams where two edges meet so corners read as connected stone, not four loose strips.
    ctx.fillStyle = isVisible ? "rgba(18,17,15,0.42)" : "rgba(8,8,8,0.26)";
    if (north && west) ctx.fillRect(px, py - 10, 7, 16);
    if (north && east) ctx.fillRect(px + TILE - 7, py - 10, 7, 16);
    if (south && west) ctx.fillRect(px, py + TILE - 7, 7, 7);
    if (south && east) ctx.fillRect(px + TILE - 7, py + TILE - 7, 7, 7);

    ctx.restore();
  }

  drawWallFloorShadow = function drawWallFloorShadowWithWallEdgeOverlay(x, y, px, py, isVisible) {
    originalDrawWallFloorShadow(x, y, px, py, isVisible);
    drawWallEdgeOverlay(x, y, px, py, isVisible);
  };
  drawWallFloorShadow.__wallEdgeOverlayWrapped = true;
  window.drawWallEdgeOverlay = drawWallEdgeOverlay;
})();

(function installPlayerCenteredDesktopMinimap() {
  const originalDrawMinimap = typeof drawMinimap === "function" ? drawMinimap : null;
  const DESKTOP_MINIMAP_SIZE = 150;
  const DESKTOP_MINIMAP_BORDER = 4;
  const DESKTOP_MINIMAP_TILE_SCALE = 5.0;

  function savedDesktopMinimapOrigin(size) {
    let x0 = canvas.width - size - 14;
    let y0 = canvas.height - size - 14;
    try {
      const saved = JSON.parse(localStorage.getItem("dcw.uiLayout.v1") || "{}").minimap;
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
        x0 = saved.left + 6;
        y0 = saved.top + 6;
      }
    } catch {}
    return { x0, y0 };
  }

  function drawDesktopMinimapMarker(x, y, radius, color, centerX, centerY, clipRadius) {
    if (Math.hypot(x - centerX, y - centerY) > clipRadius) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDesktopWaypointMarker(targetX, targetY, color, strokeColor, centerX, centerY, innerRadius, label) {
    const playerTileX = player.x / TILE;
    const playerTileY = player.y / TILE;
    const dx = (targetX - playerTileX) * DESKTOP_MINIMAP_TILE_SCALE;
    const dy = (targetY - playerTileY) * DESKTOP_MINIMAP_TILE_SCALE;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;

    const markerRadius = innerRadius - 8;
    const inside = dist <= markerRadius;
    const markerX = inside ? centerX + dx : centerX + (dx / dist) * markerRadius;
    const markerY = inside ? centerY + dy : centerY + (dy / dist) * markerRadius;
    const pulse = inside ? 4 + Math.sin(frameCount * 0.08) : 5 + Math.sin(frameCount * 0.1) * 0.7;

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = inside ? 2 : 2.5;

    if (inside) {
      ctx.beginPath();
      ctx.arc(markerX, markerY, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const angle = Math.atan2(dy, dx);
      ctx.translate(markerX, markerY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    ctx.font = "9px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(label, markerX, markerY);
    ctx.restore();
  }

  function discoveredSafeRoomWaypoint() {
    const safeRoom = rooms?.find(room => room.type === "safe");
    if (!safeRoom) return null;
    const discovered = safeRoom.seen || seen?.[safeRoom.cy]?.[safeRoom.cx];
    if (!discovered) return null;
    return { x: safeRoom.cx + 0.5, y: safeRoom.cy + 0.5 };
  }

  function drawDesktopPlayerCenteredMinimap() {
    if (!map || !seen || !player) return;

    const size = DESKTOP_MINIMAP_SIZE;
    const border = DESKTOP_MINIMAP_BORDER;
    const radius = size / 2;
    const innerRadius = radius - border;
    const { x0, y0 } = savedDesktopMinimapOrigin(size);
    const centerX = x0 + radius;
    const centerY = y0 + radius;
    const playerTileX = player.x / TILE;
    const playerTileY = player.y / TILE;
    const tileRadius = Math.ceil(innerRadius / DESKTOP_MINIMAP_TILE_SCALE) + 1;
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

    for (let y = startTileY; y <= endTileY; y++) {
      for (let x = startTileX; x <= endTileX; x++) {
        if (!seen[y]?.[x] && !(stairwellFound && x === stairwellX && y === stairwellY)) continue;
        const t = map[y]?.[x];
        if (t === "#") ctx.fillStyle = "rgba(95,95,95,0.52)";
        else if (t === "S") ctx.fillStyle = "rgba(123,224,123,0.9)";
        else if (t === "E") ctx.fillStyle = stairwellFound ? "rgba(80,160,255,1)" : "rgba(80,120,255,0.95)";
        else if (t === "L") ctx.fillStyle = "rgba(255,90,90,0.95)";
        else ctx.fillStyle = "rgba(180,180,180,0.62)";

        const px = centerX + (x - playerTileX) * DESKTOP_MINIMAP_TILE_SCALE;
        const py = centerY + (y - playerTileY) * DESKTOP_MINIMAP_TILE_SCALE;
        ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(DESKTOP_MINIMAP_TILE_SCALE), Math.ceil(DESKTOP_MINIMAP_TILE_SCALE));
      }
    }

    for (const corpse of corpses || []) {
      if (corpse.looted) continue;
      const cx = Math.floor(corpse.x / TILE);
      const cy = Math.floor(corpse.y / TILE);
      if (!seen[cy]?.[cx]) continue;
      const px = centerX + ((corpse.x / TILE) - playerTileX) * DESKTOP_MINIMAP_TILE_SCALE;
      const py = centerY + ((corpse.y / TILE) - playerTileY) * DESKTOP_MINIMAP_TILE_SCALE;
      drawDesktopMinimapMarker(px, py, corpse.boss ? 3 : 2.2, corpse.playerCorpse ? "rgba(160,210,255,0.95)" : (corpse.boss ? "rgba(210,150,255,0.95)" : "rgba(160,120,85,0.85)"), centerX, centerY, innerRadius);
    }

    if (multiplayer?.remotePlayers?.size) {
      for (const crawler of multiplayer.remotePlayers.values()) {
        const px = centerX + ((crawler.x / TILE) - playerTileX) * DESKTOP_MINIMAP_TILE_SCALE;
        const py = centerY + ((crawler.y / TILE) - playerTileY) * DESKTOP_MINIMAP_TILE_SCALE;
        drawDesktopMinimapMarker(px, py, 2.8, "rgba(117,199,255,0.95)", centerX, centerY, innerRadius);
      }
    }

    const safeWaypoint = discoveredSafeRoomWaypoint();
    if (safeWaypoint) drawDesktopWaypointMarker(safeWaypoint.x, safeWaypoint.y, "rgba(91,235,126,0.96)", "rgba(205,255,214,0.98)", centerX, centerY, innerRadius, "S");

    if (stairwellFound && stairwellX !== null && stairwellY !== null) {
      drawDesktopWaypointMarker(stairwellX + 0.5, stairwellY + 0.5, "rgba(80,160,255,0.96)", "rgba(190,215,255,1)", centerX, centerY, innerRadius, "⇩");
    }

    if (bossEnemy && bossEnemy.hp > 0) {
      const bx = Math.floor(bossEnemy.x / TILE), by = Math.floor(bossEnemy.y / TILE);
      if (seen[by]?.[bx]) {
        const px = centerX + ((bossEnemy.x / TILE) - playerTileX) * DESKTOP_MINIMAP_TILE_SCALE;
        const py = centerY + ((bossEnemy.y / TILE) - playerTileY) * DESKTOP_MINIMAP_TILE_SCALE;
        drawDesktopMinimapMarker(px, py, 3, "#ffd86b", centerX, centerY, innerRadius);
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

  if (originalDrawMinimap && !originalDrawMinimap.__playerCenteredDesktopWrapped) {
    drawMinimap = function drawPlayerCenteredDesktopMinimap() {
      if (typeof isMobileLike === "function" && isMobileLike()) return originalDrawMinimap();
      return drawDesktopPlayerCenteredMinimap();
    };
    drawMinimap.__playerCenteredDesktopWrapped = true;
  }
})();
