const STAIRWELL_STONE_ENTRANCE_SPRITE = new Image();
STAIRWELL_STONE_ENTRANCE_SPRITE.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAApCAMAAAChm5+KAAAASFBMVEVbWVUoKCkkJCZgYGEuLjMmJihBQD6GgnqOi4KBfXVJSUpAPz7///9bXF4qKlU/P0E8SEhVVQCtra3fv78nKCkAAAAWFxlraWT2YGPcAAAAGHRSTlP++6UWD2b+////Yv8ClAaYFQMZCP4A/v6uSXYhAAADv0lEQVR42nVWiZYjIQiktI90ZvYm5v//dKFA285MfHnpS8uiQEAeL2NZ8mbVHAD8329/jUnL6zq5PFX/XgsHZBqIJ8SnQrD6Dqj6l3Vdiy3YoHhOQyQuKrJBYLNsy/qWUb2vbggXQk4Ue0yguBpBLev6hlGt9a46lotOXG4iuzz3TsyGS1ZnqRLIWFYFzqWHYA9ZnGP8mVC35AXbUdDa+vnvhdEKkI2hyI06tFg7vGZgCv9g/ABJQJTHMoCMzo/win1z/nR10/A6OhBB7c7m6dMsDSyUidFyl1DYrZIIHgPSHj49oDqcanrAp2Otj08CLb/XcJE8IRgrWyA18N4NDZJx48TSo7i75mImrkgJhaZw8/YyzheawqtJL/SMro+fzuhvoacPOblwGWZiqu38TH5O7ggtijNalh8Rgk+kDrl/4GAAnWrFO9DP7jn71T/yKBoeG9vRObHeJn9lFJ+plgsFdzbMtOLX7vLOg8La2EQHNb0M+NwMPgP4lAcYPUiFk4fFY2gqCkxiz1BEUga7MyqbYR4bHZ2hs21uqiH5dbPVmJw2YzEcNgpV3Co7jqFxiLhFCtqCk4Q47RIQl1gjkAri6u/co00Tp3txBoIfwHaGRgDxfDZPVW5HBBo1H6lRCYoEQksUhNDdxy0AMk1kwMa6gbRxFzrQGZ1SIe0jrB9fA2o89M4/xbGXgchUktCxV4vrqRT/qY0x8stOhbo4ngDywZE6EDLiu4n9MYHIjEtnJE+BoRNDSgMEecwuDowUYEAaCW2ixBcIUi1T46nQ1TxEatIEorA9gBIpvOjxcEIlzoTERH88bVeeWXtwpLkmevp3BzpexPY4KzOSnRAGTbGzpl5qWGHky2jgqW16apukwjCmSY8gz0dFe5XpAcvys0nPmS0tuwDx+LB83cwjyyILE9KeBbnN9Z4JAe1K5gSKSLR6YoZZhqzL6lXaOG6n+1lqxsanOhMhxccolrBOQKyq3e21aZv2Kl506iaNY4usbojgBVYDibrGlBj2RX3EFQ0acYg8rlGI3F8uaX0sWSBrZcHy8jJ6CNfXF2eiiocW5yCn3BgbWtkP9SYiWey3I2mdaelC7qP3KHuoo6j10kQstaRB3sO4K0aL1U3m3wfh9tBOtdT6pa1Z1qIdi3g7T/Poifz1vufXbAHK8rXR8g7JOrrex9Ce/TiOW+4vchxMyr2PsMnWPiz122bU+iRvQ6OhycCNpB5MesHtDem7HnJJ4Xvo6ku17p1bmae/YVR7s1ojszN4dGREPL7B4PgPkkOQBWVwHPsAAAAASUVORK5CYII=";

function isStairwellStoneSpriteReady() {
  return STAIRWELL_STONE_ENTRANCE_SPRITE.complete && STAIRWELL_STONE_ENTRANCE_SPRITE.naturalWidth > 0;
}

function drawStairwellSpriteFallback(px, py, isVisible) {
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

function drawStairwellStoneSprite(px, py, isVisible) {
  const drawW = TILE * 2.25;
  const drawH = drawW * (STAIRWELL_STONE_ENTRANCE_SPRITE.naturalHeight / STAIRWELL_STONE_ENTRANCE_SPRITE.naturalWidth);
  const centerX = px + TILE / 2;
  const centerY = py + TILE / 2 - 3;

  ctx.save();
  ctx.globalAlpha = isVisible ? 1 : 0.56;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    STAIRWELL_STONE_ENTRANCE_SPRITE,
    Math.round(centerX - drawW / 2),
    Math.round(centerY - drawH / 2),
    Math.round(drawW),
    Math.round(drawH)
  );
  ctx.restore();
}

function findStairwellTileForOverlay() {
  if (Number.isFinite(stairwellX) && Number.isFinite(stairwellY)) return { x: stairwellX, y: stairwellY };
  if (!Array.isArray(map)) return null;

  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    if (!row) continue;
    const x = row.indexOf("E");
    if (x >= 0) return { x, y };
  }

  return null;
}

function drawStairwellOverlayAfterDungeon() {
  if (!isStairwellStoneSpriteReady()) return;

  const tile = findStairwellTileForOverlay();
  if (!tile) return;
  if (map?.[tile.y]?.[tile.x] !== "E") return;

  const isVisible = !!visible?.[tile.y]?.[tile.x];
  if (!isVisible && !stairwellFound) return;

  const px = tile.x * TILE;
  const py = tile.y * TILE;
  const camX = player.x - canvas.width / 2;
  const camOffsetY = canvas.height / 2 - player.y * CAMERA_TILT_SCALE;
  const screenX = px - camX;
  const screenY = py * CAMERA_TILT_SCALE + camOffsetY;
  const margin = TILE * 3;
  if (screenX < -margin || screenX > canvas.width + margin || screenY < -margin || screenY > canvas.height + margin) return;

  ctx.save();
  applyDungeonCameraTransform(camX);
  drawStairwellStoneSprite(px, py, isVisible);
  ctx.restore();
}

// The stairwell sprite is wider than one tile. If it is drawn inside the tile loop,
// later floor tiles paint over its right edge. Suppress the in-loop sprite and draw it
// once right before the player, so the entrance is whole but the crawler still appears on top.
drawPortalTile = function drawStoneStairwellTile(px, py, isVisible) {
  if (!isStairwellStoneSpriteReady()) drawStairwellSpriteFallback(px, py, isVisible);
};

const drawPlayerSpriteWithoutStoneStairwell = typeof drawPlayerSprite === "function" ? drawPlayerSprite : null;
if (drawPlayerSpriteWithoutStoneStairwell) {
  drawPlayerSprite = function drawPlayerSpriteAboveStoneStairwell() {
    drawStairwellOverlayAfterDungeon();
    drawPlayerSpriteWithoutStoneStairwell();
  };
}

function gameLoop() {
  if (typeof syncMusicToGameState === "function") syncMusicToGameState();
  pollGamepad();
  updatePanelScrollFromController();
  if (!isGameplayUpdatePaused() && !gameWon && !gameLost) {
    updatePlayer();
    updateBossLocks();
    if (typeof updatePet === "function") updatePet();
    updateEnemies();
    updateProjectiles();
    updateFloorTimer();
    updateVisibility();
    updatePrompt();
    updateTutorialSigns();
  }
  if (typeof maybeSendLocalCrawlerState === "function") maybeSendLocalCrawlerState();
  if (typeof maybeSendFloor0EnemySnapshot === "function") maybeSendFloor0EnemySnapshot();
  if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
  draw();
  requestAnimationFrame(gameLoop);
}

initInputControls();
setupMusicControls();
setupLootWindowHandlers();
setupTitleScreenHandlers();
resetState();
showTitleScreen();
gameLoop();

// Jeremiah gold reset fix: full death/new-run reset is handled by resetRunProgress().
