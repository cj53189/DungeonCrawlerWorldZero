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
