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


function drawEngravedRoomNames(camX, camY) {
  if (!rooms || !visible) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const room of rooms) {
    if (!room.seen || !room.name) continue;

    const cx = room.cx * TILE + TILE / 2;
    const cy = room.cy * TILE + TILE / 2;

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
      for (let y = room.cy - 1; y <= room.cy + 1; y++) {
        for (let x = room.cx - 1; x <= room.cx + 1; x++) {
          if (visible[y]?.[x]) centerVisible = true;
        }
      }
    }

    if (!centerVisible) continue;

    const roomPixelW = room.w * TILE;
    const roomPixelH = room.h * TILE;
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
      } else if (t === "S") {
        ctx.fillStyle = isVisible ? "#203522" : "#172418";
        ctx.fillRect(px, py, TILE, TILE);
      } else {
        ctx.fillStyle = collapseStarted ? (isVisible ? "#2b1c1c" : "#1d1515") : (isVisible ? "#202020" : "#161616");
        ctx.fillRect(px, py, TILE, TILE);
      }

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

  ctx.fillStyle = player.safe ? "#7be07b" : "#f1f1f1";
  ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();

  if (player.attackCooldown > 24) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath(); ctx.arc(player.x, player.y, 58, 0, Math.PI * 2); ctx.stroke();
  }

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

