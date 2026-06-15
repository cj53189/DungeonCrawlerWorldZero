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

  // This is called while draw() already has the dungeon camera transform active.
  // Applying the camera transform a second time pushes the sprite offscreen.
  ctx.save();
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

function applyRatDirectionHotfix() {
  if (typeof ENEMY_SPRITE_DEFINITIONS === "undefined" || !ENEMY_SPRITE_DEFINITIONS.rat) return;
  ENEMY_SPRITE_DEFINITIONS.rat.directionRows = { up: 0, right: 3, down: 2, left: 1 };
}

function normalizeQuickPartyCode(code) {
  return String(code || "").trim().toUpperCase();
}

function ensureQuickPartyInviteState() {
  if (!(multiplayer.pendingPartyInvites instanceof Map)) multiplayer.pendingPartyInvites = new Map();
  if (!(multiplayer.sentPartyInvites instanceof Map)) multiplayer.sentPartyInvites = new Map();
}

function localQuickPartySize() {
  const partyId = multiplayer.partyId;
  if (!partyId) return 1;
  const members = multiplayer.lobbyMembers?.filter(member => member.partyId && member.partyId === partyId) || [];
  return Math.max(1, members.length || multiplayer.partyMembers?.length || 1);
}

function syncLocalQuickPartyMembership() {
  const partyId = multiplayer.partyId;
  multiplayer.partyMembers = (multiplayer.lobbyMembers || []).filter(member => partyId && member.partyId === partyId);
  for (const member of multiplayer.lobbyMembers || []) {
    if (member.local || member.id === multiplayer.playerId) member.partyId = partyId || member.partyId || null;
  }
}

function rememberQuickPartyCode(message) {
  const partyCode = normalizeQuickPartyCode(message?.partyCode || message?.fromPartyCode);
  let changed = false;
  if (partyCode) {
    multiplayer.partyCode = partyCode;
    changed = true;
  }
  if (message?.partyId) {
    multiplayer.partyId = message.partyId;
    changed = true;
  }
  if (message?.mode === "quick_match") multiplayer.lobbyCode = null;
  if (message?.lobbyCode) multiplayer.roomId = message.lobbyCode;
  if (changed) syncLocalQuickPartyMembership();
  return changed;
}

function crawlerNameById(crawlerId) {
  const member = multiplayer.lobbyMembers?.find(candidate => candidate.id === crawlerId);
  const remote = multiplayer.remotePlayers?.get?.(crawlerId);
  return member?.name || remote?.name || "Crawler";
}

function handleQuickPartyInviteMessage(message) {
  ensureQuickPartyInviteState();
  if (!message?.fromPlayerId) return;
  const fromPlayerId = message.fromPlayerId;
  const localPartyId = multiplayer.partyId || multiplayer.lobbyMembers?.find?.(member => member.local || member.id === multiplayer.playerId)?.partyId || null;
  const inviter = multiplayer.lobbyMembers?.find?.(member => member.id === fromPlayerId);
  if (localPartyId && inviter?.partyId === localPartyId) {
    multiplayer.pendingPartyInvites.delete(fromPlayerId);
    if (typeof announcer === "function") announcer("Already in party.");
    return;
  }
  const existing = multiplayer.pendingPartyInvites.get(fromPlayerId);
  multiplayer.pendingPartyInvites.set(fromPlayerId, {
    fromPlayerId,
    fromName: message.fromName || inviter?.name || existing?.fromName || "Crawler",
    fromPartyId: message.fromPartyId || existing?.fromPartyId || null,
    fromPartyCode: normalizeQuickPartyCode(message.fromPartyCode || existing?.fromPartyCode),
    expiresAt: message.expiresAt ? Date.parse(message.expiresAt) : (existing?.expiresAt || Date.now() + 30_000)
  });
  if (!existing && typeof announcer === "function") announcer(`${message.fromName || inviter?.name || "A crawler"} invited you to party.`);
}

function handleQuickPartyResponseMessage(message) {
  ensureQuickPartyInviteState();
  rememberQuickPartyCode(message);
  if (message.pending) {
    if (message.targetPlayerId) multiplayer.sentPartyInvites.set(message.targetPlayerId, Date.now() + 30_000);
    announcer(`Party invite sent to ${message.targetName || crawlerNameById(message.targetPlayerId)}.`);
    return;
  }

  if (message.targetPlayerId) multiplayer.sentPartyInvites.delete(message.targetPlayerId);
  if (message.fromPlayerId) multiplayer.pendingPartyInvites.delete(message.fromPlayerId);

  if (message.accepted) announcer(`Party formed with ${message.targetName || message.fromName || "Crawler"}. Friendly fire rules come later.`);
  else announcer(`Party invite declined by ${message.targetName || message.fromName || "Crawler"}.`);
}

function requestQuickPartyInvite(targetPlayerId, options = {}) {
  ensureQuickPartyInviteState();
  if (!targetPlayerId || !isMultiplayerNetworkReady?.()) return false;
  multiplayer.sentPartyInvites.set(targetPlayerId, Date.now() + 30_000);
  return sendMultiplayerMessage("party_invite_send", { targetPlayerId, ...options });
}

function respondQuickPartyInvite(fromPlayerId, accepted = true) {
  ensureQuickPartyInviteState();
  if (!fromPlayerId || !isMultiplayerNetworkReady?.()) return false;
  multiplayer.pendingPartyInvites.delete(fromPlayerId);
  if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
  return sendMultiplayerMessage(accepted ? "party_invite_accept" : "party_invite_decline", { fromPlayerId, accepted: !!accepted });
}

function installQuickPartyCodeClient() {
  ensureQuickPartyInviteState();
  const createLobbyButton = document.getElementById("createPartyBtn");
  if (createLobbyButton) createLobbyButton.textContent = "Quick Match + Party Code";
  const joinButton = document.getElementById("joinPartyBtn");
  if (joinButton) joinButton.textContent = "Join Party Code";

  if (typeof createLobby === "function") {
    createLobby = function createQuickMatchParty() {
      startQuickMatch();
    };
  }

  const handleServerMessageWithoutQuickParty = typeof handleMultiplayerServerMessage === "function" ? handleMultiplayerServerMessage : null;
  if (handleServerMessageWithoutQuickParty && !handleServerMessageWithoutQuickParty.__quickPartyWrapped) {
    handleMultiplayerServerMessage = function handleMultiplayerServerMessageWithQuickParty(message) {
      if (message?.type === "party_invite" || message?.type === "party_invite_received") {
        handleQuickPartyInviteMessage(message);
        if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
        if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
        return;
      }
      if (message?.type === "party_response") {
        handleQuickPartyResponseMessage(message);
        if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
        if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
        return;
      }

      const hadPartyCode = rememberQuickPartyCode(message);
      handleServerMessageWithoutQuickParty(message);
      if (hadPartyCode || rememberQuickPartyCode(message)) {
        if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
        if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
      }
    };
    handleMultiplayerServerMessage.__quickPartyWrapped = true;
  }

  const applyLobbyUpdateWithoutQuickParty = typeof applyServerLobbyUpdate === "function" ? applyServerLobbyUpdate : null;
  if (applyLobbyUpdateWithoutQuickParty && !applyLobbyUpdateWithoutQuickParty.__quickPartyWrapped) {
    applyServerLobbyUpdate = function applyServerLobbyUpdateWithQuickParty(update) {
      const previousPartyCode = multiplayer.partyCode;
      applyLobbyUpdateWithoutQuickParty(update);
      if (update?.mode === "quick_match" && previousPartyCode) multiplayer.partyCode = previousPartyCode;
      syncLocalQuickPartyMembership();
      const localPartyId = multiplayer.partyId;
      if (localPartyId && multiplayer.pendingPartyInvites instanceof Map) {
        for (const [fromPlayerId] of multiplayer.pendingPartyInvites.entries()) {
          const inviter = multiplayer.lobbyMembers?.find?.(member => member.id === fromPlayerId);
          if (inviter?.partyId === localPartyId) multiplayer.pendingPartyInvites.delete(fromPlayerId);
        }
      }
    };
    applyServerLobbyUpdate.__quickPartyWrapped = true;
  }

  const getInviteTextWithoutQuickParty = typeof getInviteText === "function" ? getInviteText : null;
  if (getInviteTextWithoutQuickParty && !getInviteTextWithoutQuickParty.__quickPartyWrapped) {
    getInviteText = function getInviteTextWithQuickPartyCode() {
      if (multiplayer.partyCode) return `Join my Dungeon Crawler World party ${multiplayer.partyCode}: ${getGameLink()}`;
      return getInviteTextWithoutQuickParty();
    };
    getInviteText.__quickPartyWrapped = true;
  }

  const updatePanelWithoutQuickParty = typeof updateMultiplayerPanel === "function" ? updateMultiplayerPanel : null;
  if (updatePanelWithoutQuickParty && !updatePanelWithoutQuickParty.__quickPartyWrapped) {
    updateMultiplayerPanel = function updateMultiplayerPanelWithQuickPartyCode() {
      updatePanelWithoutQuickParty();
      if (!multiplayer.partyCode) return;

      const partySummary = `Party: Connected (${localQuickPartySize()})`;
      const partyCode = document.getElementById("mpPartyCode");
      if (partyCode) partyCode.textContent = `Party Code: ${multiplayer.partyCode} · ${partySummary}`;

      const copyInvite = document.getElementById("mpCopyInviteBtn");
      if (copyInvite && !copyInvite.classList.contains("copyStatusOk") && !copyInvite.classList.contains("copyStatusWarn")) {
        copyInvite.textContent = "Copy Party Code";
      }
      const copyGame = document.getElementById("copyGameLinkBtn");
      if (copyGame && !copyGame.classList.contains("copyStatusOk") && !copyGame.classList.contains("copyStatusWarn")) {
        copyGame.textContent = "Copy Party Code";
      }
    };
    updateMultiplayerPanel.__quickPartyWrapped = true;
  }
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
installQuickPartyCodeClient();
setupTitleScreenHandlers();
applyRatDirectionHotfix();
resetState();
showTitleScreen();
gameLoop();

// Jeremiah gold reset fix: full death/new-run reset is handled by resetRunProgress().
