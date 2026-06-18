function getDefaultMultiplayerWsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const hostname = window.location.hostname || "localhost";
  const isSecureHost = window.location.protocol === "https:";
  const port = isSecureHost
    ? window.location.port ? `:${window.location.port}` : ""
    : ":8080";
  return `${protocol}://${hostname}${port}`;
}

const MULTIPLAYER_WS_URL = window.DCW_WS_URL || getDefaultMultiplayerWsUrl();

const multiplayerNetwork = {
  socket: null,
  url: MULTIPLAYER_WS_URL,
  connected: false,
  connecting: false,
  playerId: null,
  lastError: null,
  lastErrorAt: 0,
  reconnectTimer: null,
  reconnectDelayMs: 3000,
  countdownTimer: null,
  lastCrawlerStateSentAt: 0,
  lastCrawlerStateSignature: null,
  lastEnemySnapshotSentAt: 0,
  lastEnemySnapshotSignature: null,
  loggedEnemySyncOwners: new Set()
};

const FLOOR0_ENEMY_SYNC_SNAP_DISTANCE = TILE * 3;
const FLOOR0_ENEMY_SYNC_INTERPOLATION = 0.28;
const FLOOR0_ENEMY_SYNC_TTL_MS = 650;

function isMultiplayerNetworkReady() {
  return !!(multiplayerNetwork.connected && multiplayerNetwork.socket?.readyState === WebSocket.OPEN && multiplayerNetwork.playerId);
}

function connectMultiplayerNetwork() {
  if (multiplayerNetwork.connected || multiplayerNetwork.connecting) return;
  if (typeof WebSocket === "undefined") {
    multiplayer.networkStatus = "offline";
    handleMultiplayerNetworkError("WebSocket is not available in this browser. Multiplayer server features are offline.");
    return;
  }

  if (multiplayerNetwork.reconnectTimer) {
    clearTimeout(multiplayerNetwork.reconnectTimer);
    multiplayerNetwork.reconnectTimer = null;
  }
  multiplayerNetwork.connecting = true;
  multiplayer.networkStatus = "connecting";
  multiplayerNetwork.lastError = null;
  if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();

  try {
    const socket = new WebSocket(multiplayerNetwork.url);
    multiplayerNetwork.socket = socket;

    socket.addEventListener("open", () => {
      multiplayerNetwork.connected = true;
      multiplayerNetwork.connecting = false;
      multiplayerNetwork.lastError = null;
      multiplayer.networkStatus = "connected";
      multiplayer.networkError = null;
      sendMultiplayerMessage("hello", { profile: playerProfile });
      if (typeof announcer === "function") announcer("Floor 0 collapse server connected.");
      if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
    });

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        handleMultiplayerNetworkError("Received an unreadable Floor 0 collapse server message.");
        return;
      }
      handleMultiplayerServerMessage(message);
    });

    socket.addEventListener("close", () => {
      if (typeof stopVoiceChat === "function") stopVoiceChat("multiplayer_disconnected");
      multiplayerNetwork.connected = false;
      multiplayerNetwork.connecting = false;
      multiplayerNetwork.socket = null;
      if (multiplayer.usingServer) multiplayer.status = "offline";
      multiplayer.networkStatus = "offline";
      handleMultiplayerNetworkError("Disconnected from the multiplayer server. Reconnecting; Single Player and Local 4-Crawler Test are still available.");
      scheduleMultiplayerReconnect();
      if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
      if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
    });

    socket.addEventListener("error", () => {
      multiplayerNetwork.connected = false;
      multiplayerNetwork.connecting = false;
      multiplayer.networkStatus = "offline";
      handleMultiplayerNetworkError("Failed WebSocket connection to the multiplayer server. You can keep testing with Single Player or Local 4-Crawler Test.");
      if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
    });
  } catch (err) {
    multiplayerNetwork.connected = false;
    multiplayerNetwork.connecting = false;
    multiplayer.networkStatus = "offline";
    handleMultiplayerNetworkError(err.message || "Could not create Floor 0 collapse server connection.");
    scheduleMultiplayerReconnect();
  }
}

function scheduleMultiplayerReconnect() {
  if (multiplayerNetwork.connected || multiplayerNetwork.connecting || multiplayerNetwork.reconnectTimer) return;
  multiplayer.networkStatus = "reconnecting";
  multiplayerNetwork.reconnectTimer = setTimeout(() => {
    multiplayerNetwork.reconnectTimer = null;
    connectMultiplayerNetwork();
  }, multiplayerNetwork.reconnectDelayMs);
  if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
}

function sendMultiplayerMessage(type, payload = {}) {
  if (!multiplayerNetwork.socket || multiplayerNetwork.socket.readyState !== WebSocket.OPEN) return false;
  multiplayerNetwork.socket.send(JSON.stringify({ type, ...payload }));
  return true;
}

function requestServerCreateLobby() {
  if (!isMultiplayerNetworkReady()) return false;
  prepareServerLobbyState({ status: "party", lobbyCode: null, partyId: null });
  return sendMultiplayerMessage("create_lobby", { profile: playerProfile });
}

function requestServerJoinLobby(code) {
  if (!isMultiplayerNetworkReady()) return false;
  const cleanedCode = String(code || "").trim().toUpperCase();
  if (!cleanedCode) return false;
  prepareServerLobbyState({ status: "party", lobbyCode: cleanedCode, partyId: `party:${cleanedCode}` });
  return sendMultiplayerMessage("join_lobby", { lobbyCode: cleanedCode, profile: playerProfile });
}

function requestServerQuickMatch(options = {}) {
  if (!isMultiplayerNetworkReady()) return false;
  const arena = !!options.arena;
  prepareServerLobbyState({ status: arena ? "arena" : "matchmaking", lobbyCode: null, partyId: null });
  return sendMultiplayerMessage("quick_match", { profile: playerProfile, arena });
}

function requestServerLeaveLobby() {
  if (typeof stopVoiceChat === "function") stopVoiceChat("multiplayer_disconnected");
  if (!isMultiplayerNetworkReady() || !multiplayer.usingServer) return false;
  return sendMultiplayerMessage("leave_lobby");
}

function sendVoiceOffer(targetPlayerId, offer) {
  return sendMultiplayerMessage("voice_offer", { targetPlayerId, offer });
}

function sendVoiceAnswer(targetPlayerId, answer) {
  return sendMultiplayerMessage("voice_answer", { targetPlayerId, answer });
}

function sendVoiceIceCandidate(targetPlayerId, candidate) {
  return sendMultiplayerMessage("voice_ice_candidate", { targetPlayerId, candidate });
}

function sendVoiceDisconnect(targetPlayerId, reason = "disconnect") {
  return sendMultiplayerMessage("voice_disconnect", { targetPlayerId, reason });
}

function requestServerFloor0StairsReached() {
  if (!multiplayer.enabled || !multiplayer.usingServer || currentFloor !== 0) return false;
  if (multiplayer.localFloor0Status === "at_stairs" || multiplayer.localFloor0Status === "advancing") return true;
  if (!isMultiplayerNetworkReady()) return false;

  stats.exitFinds++;
  changeAudience(10);
  multiplayer.localFloor0Status = "at_stairs";
  applyLocalFloor0Status("at_stairs");
  gameWon = true;
  pendingFloorAdvance = false;
  sendMultiplayerMessage("floor0_stairs_reached", {
    stairs: multiplayer.floor0Metadata?.stairs || { x: stairwellX, y: stairwellY }
  });
  achievement("FLOOR 0 STAIRS REACHED", "You reached the shared Floor 0 stairwell. Hold position until the collapse timer resolves advancement.", "floor0StairsReached");
  showCenter(
    "At Floor 0 Stairs",
    "You are marked At Stairs. When Floor 0 collapses, the server will advance eligible crawlers and fail anyone still exploring.",
    "Waiting for Collapse",
    () => {}
  );
  if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
  return true;
}

function prepareServerLobbyState({ status, lobbyCode = null, partyId = null }) {
  multiplayer.enabled = true;
  multiplayer.usingServer = true;
  multiplayer.targetPlayers = MULTIPLAYER_TARGET_PLAYERS;
  multiplayer.lobbyCode = lobbyCode;
  multiplayer.partyCode = lobbyCode;
  multiplayer.roomId = lobbyCode || "QUICK-MATCH";
  multiplayer.status = status;
  multiplayer.partyId = partyId;
  multiplayer.lobbyMembers = [];
  multiplayer.partyMembers = [];
  multiplayer.remotePlayers = new Map();
  multiplayer.pvpEnabled = false;
  multiplayer.floorStartedAt = null;
  multiplayer.collapseAt = null;
  multiplayer.isPartyLeader = false;
  multiplayer.stagingEndsAt = null;
  multiplayer.floor0Metadata = null;
  multiplayer.activeFloor0Seed = null;
  multiplayer.networkStatus = "connected";
  multiplayer.floor0Resolved = null;
  multiplayer.localFloor0Status = "exploring";
  resetFloor0WorldState();

  setGameMode(status === "matchmaking" ? GAME_MODES.MULTIPLAYER_MATCHMAKING : GAME_MODES.MULTIPLAYER_FLOOR0);
  hideTitleScreen();
  resetState();
  showMultiplayerPanel();
  if (typeof announcer === "function") announcer("Server Floor 0 collapse request sent.");
}

function handleMultiplayerServerMessage(message) {
  if (!message || typeof message.type !== "string") return;

  switch (message.type) {
    case "welcome":
      multiplayerNetwork.playerId = message.playerId;
      multiplayer.playerId = message.playerId;
      multiplayer.networkStatus = "connected";
      break;
    case "lobby_created":
      multiplayer.lobbyCode = message.lobbyCode;
      multiplayer.partyCode = message.lobbyCode;
      multiplayer.partyId = message.partyId || multiplayer.partyId;
      multiplayer.isPartyLeader = !!message.isPartyLeader;
      multiplayer.roomId = message.lobbyCode;
      if (typeof announcer === "function") announcer(`Crawler Lobby created for Floor 0 Collapse: ${message.lobbyCode}. Party: Connected.`);
      break;
    case "lobby_joined":
      multiplayer.lobbyCode = message.mode === "quick_match" ? null : message.lobbyCode;
      multiplayer.partyCode = multiplayer.lobbyCode;
      multiplayer.partyId = message.partyId || null;
      multiplayer.isPartyLeader = !!message.isPartyLeader;
      multiplayer.roomId = message.lobbyCode;
      multiplayer.usingServer = true;
      if (typeof announcer === "function") announcer(message.mode === "quick_match" ? "Joined Quick Match Floor 0 Collapse as a Solo Crawler." : `Joined Crawler Lobby ${message.lobbyCode}. Party: Connected.`);
      break;
    case "matchmaking_update":
      multiplayer.roomId = message.lobbyCode;
      multiplayer.targetPlayers = message.targetPlayers || MULTIPLAYER_TARGET_PLAYERS;
      multiplayer.status = "matchmaking";
      break;
    case "lobby_update":
      applyServerLobbyUpdate(message);
      break;
    case "staging_complete":
      handleServerFloor0Resolved({ lobbyCode: message.lobbyCode, advancedPlayerIds: [], failedPlayerIds: [multiplayer.playerId], players: [] });
      break;
    case "floor0_resolved":
      handleServerFloor0Resolved(message);
      break;
    case "floor_start":
      handleServerFloorStart(message);
      break;
    case "player_left":
      if (typeof cleanupVoicePeer === "function") cleanupVoicePeer(message.playerId, "player_left");
      multiplayer.remotePlayers.delete(message.playerId);
      if (typeof announcer === "function") announcer(`${message.name || "A crawler"} left Floor 0. The collapse timer will not increase.`);
      break;
    case "crawler_snapshot":
      applyServerCrawlerSnapshot(message);
      break;
    case "floor0_world_state":
      applyFloor0WorldState(message);
      break;
    case "floor0_world_event":
      applyFloor0WorldEventMessage(message);
      break;
    case "floor0_enemy_snapshot":
      applyFloor0EnemySnapshot(message);
      break;
    case "pvp_damage_applied":
      applyServerPvpDamage(message);
      break;
    case "player_corpse_created":
    case "player_died":
      applyPlayerCorpseCreated(message.corpse);
      break;
    case "player_corpse_loot_taken":
      applyPlayerCorpseLootTaken(message);
      break;
    case "player_corpse_looted":
      applyPlayerCorpseLooted(message.corpseId);
      break;
    case "voice_offer":
    case "voice_answer":
    case "voice_ice_candidate":
    case "voice_disconnect":
      if (typeof handleVoiceSignalMessage === "function") {
        handleVoiceSignalMessage(message);
      }
      break;
    case "error":
      handleMultiplayerNetworkError(formatServerErrorMessage(message.message || "Floor 0 collapse server request failed."));
      break;
  }

  if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
}

function sendServerPvpDamage(crawler, damage, metadata = {}) {
  if (!multiplayer.enabled || !multiplayer.usingServer || !isMultiplayerNetworkReady()) return false;
  if (!crawler?.id) return false;
  return sendMultiplayerMessage("pvp_damage", {
    attackerId: multiplayer.playerId,
    targetPlayerId: crawler.id,
    damage: Math.max(0, Math.round(Number(damage) || 0)),
    weaponId: metadata.weapon?.id || metadata.weaponId || player.currentWeaponId || "unknown",
    weaponType: metadata.weapon?.attackShape?.type || metadata.weaponType || "unknown",
    floor: currentFloor,
    hit: { x: Number(metadata.hitX ?? crawler.x) || 0, y: Number(metadata.hitY ?? crawler.y) || 0 },
    knockback: { x: Number(metadata.knockbackX) || 0, y: Number(metadata.knockbackY) || 0 }
  });
}

function applyServerPvpDamage(message) {
  if (!multiplayer.enabled || !multiplayer.usingServer) return;
  if (Number(message.floor) !== currentFloor) return;
  const targetId = message.targetPlayerId;
  const attackerId = message.attackerId;
  const hp = Math.max(0, Number(message.hp) || 0);
  const status = message.status || (hp <= 0 ? "downed" : "active");
  const knockback = message.knockback || {};
  if (targetId === multiplayer.playerId) {
    const before = player.hp;
    player.hp = Math.min(player.hp, hp);
    if (status === "downed" || player.hp <= 0) {
      player.hp = 0;
      multiplayer.localStatus = "downed";
      if (typeof die === "function" && !gameLost) die();
    }
    if (Number.isFinite(Number(knockback.x))) player.knockbackX = Number(knockback.x);
    if (Number.isFinite(Number(knockback.y))) player.knockbackY = Number(knockback.y);
    player.knockbackFrames = Math.max(player.knockbackFrames || 0, Math.trunc(Number(knockback.frames) || 8));
    player.knockbackUntil = Date.now() + 160;
    multiplayerNetwork.lastCrawlerStateSignature = "";
    if (typeof maybeSendLocalCrawlerState === "function") maybeSendLocalCrawlerState(0);
    console.warn("PvP damage applied by server", { attackerId, targetId, damage: before - player.hp, floor: currentFloor });
  } else {
    const crawler = multiplayer.remotePlayers?.get(targetId);
    if (crawler) {
      crawler.hp = hp;
      crawler.status = status;
      crawler.knockbackX = Number(knockback.x) || crawler.knockbackX || 0;
      crawler.knockbackY = Number(knockback.y) || crawler.knockbackY || 0;
      crawler.knockbackFrames = Math.max(crawler.knockbackFrames || 0, Math.trunc(Number(knockback.frames) || 8));
      crawler.knockbackUntil = Date.now() + 160;
    }
  }
  if (attackerId === multiplayer.playerId && Number.isFinite(Number(message.attackerPvpKills))) {
    player.pvpKills = Math.max(player.pvpKills || 0, Math.trunc(Number(message.attackerPvpKills)));
  } else {
    const attacker = multiplayer.remotePlayers?.get(attackerId);
    if (attacker && Number.isFinite(Number(message.attackerPvpKills))) attacker.pvpKills = Math.max(attacker.pvpKills || 0, Math.trunc(Number(message.attackerPvpKills)));
  }
}

function networkNumberSignature(value, precision = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return number.toFixed(precision);
}

function crawlerStateSignature(state) {
  return [
    networkNumberSignature(state.x),
    networkNumberSignature(state.y),
    networkNumberSignature(state.aimX, 2),
    networkNumberSignature(state.aimY, 2),
    Math.round(state.hp || 0),
    state.status || "",
    state.floor0Status || "",
    state.name || "",
    state.characterId || DEFAULT_CHARACTER_ID,
    state.isDodging ? "dodge" : "still",
    networkNumberSignature(state.dodgeProgress, 2),
    state.currentRoomId ?? "",
    state.pvpKills || 0,
    networkNumberSignature(state.knockbackX, 1),
    networkNumberSignature(state.knockbackY, 1),
    state.knockbackFrames || 0
  ].join("|");
}

function captureLocalCrawlerNetworkState() {
  const state = {
    x: player.x,
    y: player.y,
    aimX: Number.isFinite(player.aimX) ? player.aimX : undefined,
    aimY: Number.isFinite(player.aimY) ? player.aimY : undefined,
    hp: player.hp,
    maxHp: player.maxHp,
    currentFloor,
    status: (typeof isLocalPlayerDead === "function" && isLocalPlayerDead()) ? "downed" : (gameMode === GAME_MODES.MULTIPLAYER_STASIS ? "stasis" : "active"),
    floor0Status: multiplayer.localFloor0Status || "exploring",
    isDodging: typeof isPlayerDodging === "function" ? isPlayerDodging() : false,
    dodgeProgress: player.dodgeMaxFrames > 0 ? 1 - (player.dodgeFrames / player.dodgeMaxFrames) : 0,
    currentRoomId: Number.isFinite(Number(player.currentRoomId)) ? Math.trunc(Number(player.currentRoomId)) : undefined,
    pvpKills: Math.max(0, Math.trunc(Number(player.pvpKills) || 0)),
    partyId: multiplayer.partyId || player.partyId || null,
    knockbackX: Number(player.knockbackX) || 0,
    knockbackY: Number(player.knockbackY) || 0,
    knockbackFrames: Math.max(0, Math.trunc(Number(player.knockbackFrames) || 0)),
    knockbackUntil: Number(player.knockbackUntil) || 0,
    name: playerProfile?.name || "Crawler",
    characterId: getCharacterDef(playerProfile?.characterId).id
  };
  if (state.status === "downed" && !multiplayerNetwork.playerCorpseLootSent) {
    state.lootSnapshot = capturePlayerCorpseLootSnapshot();
    multiplayerNetwork.playerCorpseLootSent = true;
    clearLocalLootAfterCorpseSnapshot();
  }
  return state;
}

function cloneLootableItemForCorpse(item, originalSlot) {
  if (!item || typeof item !== "object") return null;
  return { ...JSON.parse(JSON.stringify(item)), originalSlot };
}

function capturePlayerCorpseLootSnapshot() {
  return {
    coins: Math.max(0, Math.trunc(Number(player.coins) || 0)),
    inventory: (player.inventory || []).map(item => cloneLootableItemForCorpse(item, "inventory")).filter(Boolean),
    equipment: Object.fromEntries(Object.entries(player.equipment || {}).map(([slot, item]) => [slot, cloneLootableItemForCorpse(item, slot)]).filter(([, item]) => !!item))
  };
}

function clearLocalLootAfterCorpseSnapshot() {
  player.coins = 0;
  player.inventory = [];
  for (const slot of Object.keys(player.equipment || {})) player.equipment[slot] = null;
  if (typeof recalcEquipmentStats === "function") recalcEquipmentStats();
  if (typeof updateInventoryUI === "function") updateInventoryUI();
  if (typeof updateHUD === "function") updateHUD();
}

function maybeSendLocalCrawlerState(now = Date.now()) {
  if (!multiplayer.enabled || !multiplayer.usingServer) return false;
  if (!isMultiplayerNetworkReady()) return false;

  const state = captureLocalCrawlerNetworkState();
  const signature = crawlerStateSignature(state);
  const timeSinceLastSend = now - multiplayerNetwork.lastCrawlerStateSentAt;
  if (signature === multiplayerNetwork.lastCrawlerStateSignature && timeSinceLastSend < 1000) return false;
  if (timeSinceLastSend < 100) return false;

  multiplayerNetwork.lastCrawlerStateSentAt = now;
  multiplayerNetwork.lastCrawlerStateSignature = signature;
  return sendMultiplayerMessage("crawler_state", { state });
}

function applyServerCrawlerSnapshot(snapshot) {
  if (!multiplayer.enabled || !multiplayer.usingServer) return;
  if (snapshot.lobbyCode && multiplayer.roomId && snapshot.lobbyCode !== multiplayer.roomId) return;
  const snapshotFloor = Number.isFinite(Number(snapshot.currentFloor)) ? Number(snapshot.currentFloor) : currentFloor;
  if (snapshotFloor !== currentFloor) {
    multiplayer.remotePlayers = new Map();
    return;
  }

  const rosterById = new Map((multiplayer.lobbyMembers?.length ? multiplayer.lobbyMembers : multiplayer.partyMembers).map(member => [member.id, member]));
  const nextRemotePlayers = new Map();

  for (const crawler of snapshot.players || []) {
    if (!crawler || crawler.id === multiplayer.playerId) continue;
    if (!rosterById.has(crawler.id)) continue;

    const x = Number(crawler.x);
    const y = Number(crawler.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const member = rosterById.get(crawler.id);
    const previousCrawler = multiplayer.remotePlayers?.get(crawler.id);
    const previousUpdatedAt = Number(previousCrawler?.updatedAt) || 0;
    const updatedAt = crawler.updatedAt || Date.now();
    const movedDistance = previousCrawler ? Math.hypot(x - previousCrawler.x, y - previousCrawler.y) : 0;
    const moving = movedDistance > 0.5 && updatedAt !== previousUpdatedAt;

    nextRemotePlayers.set(crawler.id, {
      id: crawler.id,
      name: member?.name || crawler.name || "Crawler",
      characterId: getCharacterDef(crawler.characterId || member?.characterId).id,
      x,
      y,
      r: player.r,
      aimX: Number.isFinite(Number(crawler.aimX)) ? Number(crawler.aimX) : undefined,
      aimY: Number.isFinite(Number(crawler.aimY)) ? Number(crawler.aimY) : undefined,
      direction: crawler.direction,
      hp: Math.max(0, Number(crawler.hp) || 0),
      maxHp: Math.max(1, Number(crawler.maxHp) || player.maxHp),
      currentFloor: snapshotFloor,
      status: crawler.status || "active",
      floor0Status: normalizeFloor0StatusValue(crawler.floor0Status || member?.floor0Status),
      currentRoomId: Number.isFinite(Number(crawler.currentRoomId)) ? Math.trunc(Number(crawler.currentRoomId)) : undefined,
      isDodging: !!crawler.isDodging,
      dodgeProgress: Math.max(0, Math.min(1, Number(crawler.dodgeProgress) || 0)),
      color: member?.color || crawler.color || "#75c7ff",
      partyId: crawler.partyId || member?.partyId || null,
      pvpKills: Math.max(0, Math.trunc(Number(crawler.pvpKills) || 0)),
      knockbackX: Number(crawler.knockbackX) || 0,
      knockbackY: Number(crawler.knockbackY) || 0,
      knockbackFrames: Math.max(0, Math.trunc(Number(crawler.knockbackFrames) || 0)),
      knockbackUntil: Number(crawler.knockbackUntil) || 0,
      moving,
      updatedAt
    });
  }

  multiplayer.remotePlayers = nextRemotePlayers;
}

function applyServerLobbyUpdate(update) {
  multiplayer.enabled = true;
  multiplayer.usingServer = true;
  const updateFloor = Number.isFinite(Number(update.floor)) ? Number(update.floor) : currentFloor;
  const isActiveSyncedFloor = updateFloor >= 1 || currentFloor >= 1 || update.joinState === "locked";
  multiplayer.targetPlayers = update.targetPlayers || MULTIPLAYER_TARGET_PLAYERS;
  multiplayer.roomId = update.lobbyCode;
  multiplayer.lobbyCode = update.mode === "quick_match" ? null : update.lobbyCode;
  multiplayer.partyCode = multiplayer.lobbyCode;
  multiplayer.status = isActiveSyncedFloor && currentFloor >= 1
    ? "active"
    : translateServerLobbyStatus(update.status, update.mode);
  multiplayer.currentRunId = update.runId || multiplayer.currentRunId;
  multiplayer.currentJoinState = update.joinState || multiplayer.currentJoinState || "open";
  if (update.floorSeed) multiplayer.currentFloorSeed = String(update.floorSeed);
  multiplayer.floor0Metadata = normalizeFloor0Metadata(update.floor0, update.floor0CollapseAt || update.stagingEndsAt);
  multiplayer.stagingEndsAt = multiplayer.floor0Metadata?.collapseAtMs || (update.floor0CollapseAt ? Date.parse(update.floor0CollapseAt) : (update.stagingEndsAt ? Date.parse(update.stagingEndsAt) : null));
  if (!isActiveSyncedFloor || currentFloor === 0) multiplayer.collapseAt = multiplayer.stagingEndsAt;
  multiplayer.lobbyMembers = (update.players || []).map((player, index) => ({
    id: player.id,
    name: player.id === multiplayer.playerId ? (playerProfile?.name || player.name || "Crawler") : (player.name || `Crawler ${index + 1}`),
    characterId: getCharacterDef(player.id === multiplayer.playerId ? playerProfile?.characterId : player.characterId).id,
    leader: !!player.isPartyLeader,
    isPartyLeader: !!player.isPartyLeader,
    local: player.id === multiplayer.playerId,
    partyId: player.partyId || null,
    color: player.color,
    floor0Status: normalizeFloor0StatusValue(player.floor0Status)
  }));
  const localMember = multiplayer.lobbyMembers.find(member => member.local || member.id === multiplayer.playerId);
  multiplayer.partyId = localMember?.partyId || null;
  multiplayer.isPartyLeader = !!localMember?.isPartyLeader;
  multiplayer.partyMembers = multiplayer.lobbyMembers.filter(member => member.partyId && member.partyId === multiplayer.partyId);

  if (isActiveSyncedFloor) {
    if (currentFloor >= 1) {
      setGameMode(GAME_MODES.MULTIPLAYER_ACTIVE);
      multiplayer.status = "active";
      multiplayer.pvpEnabled = true;
      if (update.collapseAt) {
        const collapseAt = Date.parse(update.collapseAt);
        if (Number.isFinite(collapseAt)) multiplayer.collapseAt = collapseAt;
      }
    }
  } else {
    setGameMode(update.mode === "quick_match" ? GAME_MODES.MULTIPLAYER_MATCHMAKING : GAME_MODES.MULTIPLAYER_FLOOR0);
    if (currentFloor === 0) {
      ensureServerFloor0Dungeon();
      applyFloor0WorldState(update.floor0WorldState);
      syncFloor0TimerFromServer();
    }
  }
  if (currentFloor === 0 && multiplayer.remotePlayers?.size) {
    const rosterIds = new Set((multiplayer.lobbyMembers?.length ? multiplayer.lobbyMembers : multiplayer.partyMembers).map(member => member.id));
    multiplayer.remotePlayers = new Map(Array.from(multiplayer.remotePlayers).filter(([id]) => rosterIds.has(id)));
  }
}


function normalizeFloor0StatusValue(status) {
  return ["exploring", "at_stairs", "failed", "advancing"].includes(status) ? status : "exploring";
}

function applyLocalFloor0Status(status) {
  const normalized = normalizeFloor0StatusValue(status);
  multiplayer.localFloor0Status = normalized;
  for (const member of multiplayer.lobbyMembers || []) {
    if (member.local || member.id === multiplayer.playerId) member.floor0Status = normalized;
  }
  for (const member of multiplayer.partyMembers || []) {
    if (member.local || member.id === multiplayer.playerId) member.floor0Status = normalized;
  }
}

function applyServerFloor0Statuses(players = []) {
  const statuses = new Map((players || []).map(player => [player.id, normalizeFloor0StatusValue(player.floor0Status)]));
  multiplayer.lobbyMembers = (multiplayer.lobbyMembers || []).map(member => ({
    ...member,
    floor0Status: statuses.get(member.id) || normalizeFloor0StatusValue(member.floor0Status)
  }));
  multiplayer.partyMembers = (multiplayer.partyMembers || []).map(member => ({
    ...member,
    floor0Status: statuses.get(member.id) || normalizeFloor0StatusValue(member.floor0Status)
  }));
  const localStatus = statuses.get(multiplayer.playerId);
  if (localStatus) multiplayer.localFloor0Status = localStatus;
}

function handleServerFloor0Resolved(message) {
  if (!multiplayer.enabled || !multiplayer.usingServer) return;
  if (message.lobbyCode && multiplayer.roomId && message.lobbyCode !== multiplayer.roomId) return;

  multiplayer.status = "start_pending";
  multiplayer.stagingEndsAt = Date.now();
  multiplayer.collapseAt = Date.now();
  multiplayer.floor0Resolved = message;
  floorTimeLeft = 0;
  applyServerFloor0Statuses(message.players || []);

  const advancing = new Set(message.advancedPlayerIds || []);
  const failed = new Set(message.failedPlayerIds || []);
  if (advancing.has(multiplayer.playerId)) {
    multiplayer.localFloor0Status = "advancing";
    applyLocalFloor0Status("advancing");
    gameWon = true;
    pendingFloorAdvance = false;
    if (typeof announcer === "function") announcer("Floor 0 resolved: you are advancing to the Floor 1 placeholder.");
  } else if (failed.has(multiplayer.playerId) || multiplayer.localFloor0Status !== "advancing") {
    multiplayer.localFloor0Status = "failed";
    applyLocalFloor0Status("failed");
    if (typeof floorCollapseDeath === "function" && !gameLost) floorCollapseDeath();
  }

  if (typeof updateHUD === "function") updateHUD();
  if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
}

function handleServerFloorStart(message) {
  if (!multiplayer.enabled || !multiplayer.usingServer) return;
  if (message.lobbyCode && multiplayer.roomId && message.lobbyCode !== multiplayer.roomId) return;
  const nextFloor = Math.trunc(Number(message.floor));
  const isArena = message.mode === "pvp_arena";
  if (!Number.isFinite(nextFloor) || nextFloor < 1 || (!isArena && currentFloor === 0 && multiplayer.localFloor0Status !== "advancing")) return;
  if (!message.floorSeed) { if (typeof announcer === "function") announcer("Server did not provide a floor seed; waiting for synced floor_start."); return; }

  const snapshot = captureRunProgress();
  currentFloor = nextFloor;
  multiplayer.currentRunId = message.runId || multiplayer.currentRunId;
  multiplayer.currentFloorSeed = String(message.floorSeed);
  multiplayer.currentJoinState = message.joinState || (isArena ? "open" : "locked");
  multiplayer.mode = message.mode || null;
  multiplayer.arena = isArena;
  gameWon = false;
  gameLost = false;
  pendingFloorAdvance = false;
  setGameMode(GAME_MODES.MULTIPLAYER_ACTIVE);
  multiplayer.status = "active";
  multiplayer.localStatus = "active";
  multiplayer.pvpEnabled = isArena || currentFloor >= 1;
  multiplayer.floorStartedAt = Date.now();
  multiplayerNetwork.playerCorpseLootSent = false;
  multiplayer.collapseAt = isArena ? null : multiplayer.floorStartedAt + getFloorTimeLimit() * 1000;
  multiplayer.remotePlayers = new Map();
  resetState({ preserveRun: true, snapshot, arena: isArena });
  applyServerFloorSpawnAssignment(message.spawnAssignment || message.spawnAssignments?.[multiplayer.playerId], message);
  applyFloor0WorldState(message.worldState);
  if (isArena && typeof revealEntireArena === "function") revealEntireArena();
  else if (typeof updateVisibility === "function") updateVisibility(true);
  if (typeof updateHUD === "function") updateHUD();
  multiplayerNetwork.lastCrawlerStateSignature = "";
  multiplayerNetwork.lastCrawlerStateSentAt = 0;
  if (typeof maybeSendLocalCrawlerState === "function") maybeSendLocalCrawlerState(0);
  showFloorSplash();
  if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
  if (typeof announcer === "function") announcer(message.message || (isArena ? "PvP Arena Test started. PvP enabled; no escape." : `Floor ${currentFloor} started from the shared server seed.`));
}

function isFloorSpawnTileClear(tx, ty, room = null) {
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return false;
  if (map?.[ty]?.[tx] !== ".") return false;
  const resolvedRoom = room || (typeof roomForTile === "function" ? roomForTile(tx, ty) : null);
  if (!resolvedRoom) return false;
  if (resolvedRoom.type === "safe" || resolvedRoom.type === "boss" || resolvedRoom.locked) return false;
  if (bossRoom && resolvedRoom.id === bossRoom.id) return false;
  if (Number.isFinite(stairwellX) && Number.isFinite(stairwellY) && tx === stairwellX && ty === stairwellY) return false;
  const blockedActors = [...(enemies || []), bossEnemy].filter(Boolean);
  if (blockedActors.some(entity => entity.hp !== 0 && Math.floor(entity.x / TILE) === tx && Math.floor(entity.y / TILE) === ty)) return false;
  if ((corpses || []).some(entity => Math.floor(entity.x / TILE) === tx && Math.floor(entity.y / TILE) === ty)) return false;
  if ((tutorialSigns || []).some(sign => Math.trunc(Number(sign.x)) === tx && Math.trunc(Number(sign.y)) === ty)) return false;
  if (petMerchant && Math.floor(petMerchant.x / TILE) === tx && Math.floor(petMerchant.y / TILE) === ty) return false;
  return true;
}

function roomWalkableSpawnTiles(room) {
  const tiles = [];
  if (!room || room.type === "safe" || room.type === "boss" || room.locked) return tiles;
  for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
    for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
      if (isFloorSpawnTileClear(x, y, room)) tiles.push({ x, y, room });
    }
  }
  return tiles;
}

function localSpawnSlotFromAssignment(assignment) {
  const slot = Number(assignment?.slot ?? assignment?.spawnSlot ?? assignment?.playerIndex);
  if (Number.isFinite(slot)) return Math.max(0, Math.trunc(slot));
  const roster = multiplayer.lobbyMembers?.length ? multiplayer.lobbyMembers : multiplayer.partyMembers;
  return Math.max(0, (roster || []).findIndex(member => member.id === multiplayer.playerId || member.local));
}

function findFallbackFloorSpawn(assignment) {
  const slot = localSpawnSlotFromAssignment(assignment);
  const roomSlot = Number.isFinite(Number(assignment?.roomSlot ?? assignment?.groupSlot)) ? Math.trunc(Number(assignment.roomSlot ?? assignment.groupSlot)) : slot;
  const tileSlot = Number.isFinite(Number(assignment?.groupMemberIndex)) ? Math.trunc(Number(assignment.groupMemberIndex)) : slot;
  const candidateRooms = (rooms || [])
    .filter(room => room && room.type !== "safe" && room.type !== "boss" && !room.locked && (!bossRoom || room.id !== bossRoom.id))
    .map(room => ({ room, tiles: roomWalkableSpawnTiles(room) }))
    .filter(entry => entry.tiles.length >= 4)
    .sort((a, b) => (a.room.type === "normal" ? -1 : 0) - (b.room.type === "normal" ? -1 : 0) || b.tiles.length - a.tiles.length);
  const entry = candidateRooms[roomSlot % Math.max(1, candidateRooms.length)] || candidateRooms[0];
  if (!entry) return null;
  const centerSorted = entry.tiles.sort((a, b) => Math.hypot(a.x - entry.room.cx, a.y - entry.room.cy) - Math.hypot(b.x - entry.room.cx, b.y - entry.room.cy));
  const tile = centerSorted[tileSlot % centerSorted.length] || centerSorted[0];
  return { ...tile, roomId: entry.room.id, fallback: true, slot, roomSlot, tileSlot };
}

function warnInvalidFloorSpawn(assignment, fallback, reason) {
  console.warn("Invalid floor_start spawn assignment; using fallback.", {
    playerId: multiplayer?.playerId,
    floor: currentFloor,
    seed: multiplayer?.currentFloorSeed,
    assignment,
    fallback,
    reason
  });
}

function applyServerFloorSpawnAssignment(assignment, floorStartMessage = {}) {
  const x = Number(assignment?.x);
  const y = Number(assignment?.y);
  let tileX = Number.isFinite(x) ? Math.trunc(x) : NaN;
  let tileY = Number.isFinite(y) ? Math.trunc(y) : NaN;
  let room = Number.isFinite(tileX) && Number.isFinite(tileY) && typeof roomForTile === "function" ? roomForTile(tileX, tileY) : null;
  let valid = isFloorSpawnTileClear(tileX, tileY, room);
  let fallback = null;
  if (!valid) {
    fallback = findFallbackFloorSpawn(assignment);
    warnInvalidFloorSpawn(assignment, fallback, assignment ? "invalid_tile" : "missing_assignment");
    if (!fallback) return;
    tileX = fallback.x;
    tileY = fallback.y;
    room = fallback.room || (typeof roomForTile === "function" ? roomForTile(tileX, tileY) : null);
    valid = true;
  }
  player.x = tileX * TILE + TILE / 2;
  player.y = tileY * TILE + TILE / 2;
  player.currentRoomId = room?.id ?? (Number.isFinite(Number(assignment?.roomId)) ? Math.trunc(Number(assignment.roomId)) : null);
  if (!Number.isFinite(Number(player.currentRoomId))) {
    const resolved = typeof roomForTile === "function" ? roomForTile(tileX, tileY) : null;
    player.currentRoomId = resolved?.id ?? fallback?.roomId ?? null;
    if (!Number.isFinite(Number(player.currentRoomId))) console.warn("Could not resolve currentRoomId after floor_start spawn.", { playerId: multiplayer?.playerId, floor: currentFloor, seed: multiplayer?.currentFloorSeed, assignment, fallback });
  }
  player.safe = false;
  player.wasSafe = false;
  visibilityDirty = true;
}

function syncSharedFloor0StairsFromDungeon() {
  if (!multiplayer.floor0Metadata || currentFloor !== 0 || stairwellX === null || stairwellY === null) return;
  multiplayer.floor0Metadata.stairs = {
    x: stairwellX,
    y: stairwellY,
    tileX: stairwellX,
    tileY: stairwellY,
    worldX: stairwellX * TILE + TILE / 2,
    worldY: stairwellY * TILE + TILE / 2
  };
}

function normalizeFloor0Metadata(floor0, fallbackCollapseAt) {
  if (!floor0 || floor0.floor !== 0 || !floor0.seed) return null;
  const collapseAt = floor0.collapseAt || fallbackCollapseAt || null;
  return {
    floor: 0,
    seed: String(floor0.seed),
    safeRoomId: Number.isFinite(Number(floor0.safeRoomId)) ? Number(floor0.safeRoomId) : 0,
    spawnRoom: floor0.spawnRoom || { id: Number.isFinite(Number(floor0.safeRoomId)) ? Number(floor0.safeRoomId) : 0 },
    spawnPoints: Array.isArray(floor0.spawnPoints) ? floor0.spawnPoints.map((point, index) => ({ ...point, index })) : [],
    stairs: floor0.stairs || null,
    collapseAt,
    collapseAtMs: collapseAt ? Date.parse(collapseAt) : null
  };
}

function ensureServerFloor0Dungeon() {
  if (!multiplayer.enabled || !multiplayer.usingServer || currentFloor !== 0 || !multiplayer.floor0Metadata?.seed) return;
  if (multiplayer.activeFloor0Seed === multiplayer.floor0Metadata.seed) {
    syncSharedFloor0StairsFromDungeon();
    placeLocalCrawlerAtFloor0Spawn();
    return;
  }

  resetState();
  multiplayer.activeFloor0Seed = multiplayer.floor0Metadata.seed;
  syncSharedFloor0StairsFromDungeon();
  placeLocalCrawlerAtFloor0Spawn();
  if (typeof updateVisibility === "function") updateVisibility(true);
  if (typeof updateHUD === "function") updateHUD();
}

function getLocalFloor0SpawnIndex() {
  const localIndex = (multiplayer.lobbyMembers?.length ? multiplayer.lobbyMembers : multiplayer.partyMembers).findIndex(member => member.local || member.id === multiplayer.playerId);
  return Math.max(0, localIndex);
}

function getFloor0SafeRoom() {
  const metadata = multiplayer.floor0Metadata;
  if (!metadata || !rooms?.length) return null;
  const safeRoomId = Number(metadata.safeRoomId ?? metadata.spawnRoom?.id ?? 0);
  return rooms.find(room => room.id === safeRoomId) || rooms.find(room => room.type === "safe") || rooms[0] || null;
}

function placeLocalCrawlerAtFloor0Spawn() {
  if (!multiplayer.floor0Metadata || currentFloor !== 0) return;
  const safeRoom = getFloor0SafeRoom();
  if (!safeRoom) return;
  const spawnPoints = multiplayer.floor0Metadata.spawnPoints || [];
  const spawnPoint = spawnPoints[getLocalFloor0SpawnIndex() % Math.max(1, spawnPoints.length)] || { dx: 0, dy: 0 };
  const tileX = Math.max(safeRoom.x + 1, Math.min(safeRoom.x + safeRoom.w - 2, safeRoom.cx + Number(spawnPoint.dx || 0)));
  const tileY = Math.max(safeRoom.y + 1, Math.min(safeRoom.y + safeRoom.h - 2, safeRoom.cy + Number(spawnPoint.dy || 0)));
  player.x = tileX * TILE + TILE / 2;
  player.y = tileY * TILE + TILE / 2;
  player.currentRoomId = null;
  visibilityDirty = true;
}

function translateServerLobbyStatus(status, mode) {
  if (status === "start_pending") return "start_pending";
  if (mode === "quick_match") return "matchmaking";
  return "party";
}

function formatServerErrorMessage(message) {
  const text = String(message || "Multiplayer request failed.");
  if (/lobby code|not found|invalid/i.test(text)) return "That lobby code was not found. Check the code and try again, or create a new lobby.";
  if (/disconnect/i.test(text)) return "Disconnected from the multiplayer server. Reconnecting; Single Player and Local 4-Crawler Test are still available.";
  if (/websocket|server|reach|connection/i.test(text)) return "Failed WebSocket connection to the multiplayer server. You can keep testing with Single Player or Local 4-Crawler Test.";
  return text;
}

function handleMultiplayerNetworkError(message) {
  const friendly = formatServerErrorMessage(message);
  const shouldAnnounce = multiplayerNetwork.lastError !== friendly || Date.now() - multiplayerNetwork.lastErrorAt > 10000;
  multiplayerNetwork.lastError = friendly;
  multiplayerNetwork.lastErrorAt = Date.now();
  multiplayer.networkError = friendly;
  if (shouldAnnounce && typeof showFriendlyMultiplayerError === "function") showFriendlyMultiplayerError(friendly);
  else if (shouldAnnounce && typeof announcer === "function") announcer(friendly);
  if (typeof addLog === "function") addLog(`Multiplayer: ${friendly}`);
  if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
}

function syncFloor0TimerFromServer() {
  if (!multiplayer.enabled || !multiplayer.usingServer || currentFloor !== 0 || !multiplayer.collapseAt) return;
  floorTimeLeft = Math.max(0, Math.ceil((multiplayer.collapseAt - Date.now()) / 1000));
  if (typeof updateHUD === "function") updateHUD();
}

function formatFloor0CollapseCountdown(endsAt) {
  if (!endsAt) return "--:--";
  const remainingMs = Math.max(0, endsAt - Date.now());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function startMultiplayerCountdownTicker() {
  if (multiplayerNetwork.countdownTimer) return;
  multiplayerNetwork.countdownTimer = setInterval(() => {
    if (multiplayer.enabled && multiplayer.stagingEndsAt) {
      syncFloor0TimerFromServer();
      if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
    }
  }, 1000);
}

window.addEventListener("load", () => {
  connectMultiplayerNetwork();
  startMultiplayerCountdownTicker();
});

function resetFloor0WorldState() {
  multiplayer.floor0WorldState = {
    openedDoorIds: new Set(),
    openedChestIds: new Set(),
    takenLootIds: new Set(),
    enemyStates: new Map()
  };
  multiplayerNetwork.loggedEnemySyncOwners.clear();
  multiplayerNetwork.lastCrawlerStateSignature = null;
  multiplayerNetwork.lastEnemySnapshotSignature = null;
}

function getServerLobbyCrawlerCount() {
  if (!multiplayer.enabled || !multiplayer.usingServer) return 0;
  return Math.max(
    multiplayer.lobbyMembers?.length || multiplayer.partyMembers?.length || 0,
    (multiplayer.remotePlayers?.size || 0) + (multiplayer.playerId ? 1 : 0)
  );
}

function logFloor0EnemySyncOwner(ownerId, reason) {
  if (!ownerId || !multiplayerNetwork.loggedEnemySyncOwners) return;
  const key = `${ownerId}:${reason}`;
  if (multiplayerNetwork.loggedEnemySyncOwners.has(key)) return;
  multiplayerNetwork.loggedEnemySyncOwners.add(key);
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(`[Floor0EnemySync] ${reason}; owner=${ownerId}; local=${multiplayer.playerId || "unknown"}`);
  }
}

function shouldSkipFloor0EnemySnapshot(message) {
  if (!message) return false;
  const ownerId = message.ownerPlayerId || message.sourcePlayerId || message.playerId;
  if (ownerId && ownerId === multiplayer.playerId) {
    logFloor0EnemySyncOwner(ownerId, "Ignoring local enemy snapshot echo to prevent Floor 0 rubber-banding");
    return true;
  }
  if (getServerLobbyCrawlerCount() <= 1 && ownerId) {
    logFloor0EnemySyncOwner(ownerId, "Ignoring redundant solo-lobby enemy snapshot");
    return true;
  }
  return false;
}

function floor0TileId(kind, x, y) {
  return `floor0:${kind}:${Math.trunc(x)},${Math.trunc(y)}`;
}

function floor0EnemyRoomId(enemy) {
  if (Number.isFinite(Number(enemy?.roomId))) return Math.trunc(Number(enemy.roomId));
  if (!enemy) return null;
  const room = typeof roomForTile === "function" ? roomForTile(Math.floor(enemy.x / TILE), Math.floor(enemy.y / TILE)) : null;
  return room ? room.id : null;
}

function floor0EnemyPayload(enemy) {
  if (!enemy?.enemyId) return null;
  return {
    enemyId: enemy.enemyId,
    id: enemy.enemyId,
    alive: enemy.hp > 0,
    hp: Math.max(0, enemy.hp || 0),
    maxHp: Math.max(1, enemy.maxHp || 1),
    roomId: floor0EnemyRoomId(enemy),
    x: enemy.x,
    y: enemy.y,
    knockbackX: Number(enemy.knockbackX) || 0,
    knockbackY: Number(enemy.knockbackY) || 0,
    knockbackFrames: Math.max(0, Math.trunc(Number(enemy.knockbackFrames) || 0)),
    knockbackUntil: Number(enemy.knockbackUntil) || 0,
    status: enemy.hp > 0 ? "active" : "dead"
  };
}

function rememberFloor0EnemyState(payload) {
  if (!payload?.enemyId) return;
  const existing = multiplayer.floor0WorldState.enemyStates.get(payload.enemyId) || { enemyId: payload.enemyId };
  if (existing.alive === false && payload.alive !== false) return;
  multiplayer.floor0WorldState.enemyStates.set(payload.enemyId, { ...existing, ...payload });
}

function sendFloor0WorldEvent(event) {
  if (!multiplayer.enabled || !multiplayer.usingServer || currentFloor !== 0) return false;
  if (!event?.type || !event.id || !isMultiplayerNetworkReady()) return false;
  return sendMultiplayerMessage("floor0_world_event", { event });
}

function sendFloor0EnemyEvent(type, enemy) {
  const payload = floor0EnemyPayload(enemy);
  if (!payload) return false;
  rememberFloor0EnemyState(payload);
  return sendFloor0WorldEvent({ type, id: payload.enemyId, enemy: payload });
}

function applyFloor0WorldEventMessage(message) {
  if (!multiplayer.enabled || !multiplayer.usingServer) return;
  if (message.lobbyCode && multiplayer.roomId && message.lobbyCode !== multiplayer.roomId) return;
  applyFloor0WorldEvent(message.event || message);
}

function applyFloor0WorldEvent(event) {
  if (!event?.type || !event.id) return false;
  if (!multiplayer.floor0WorldState) resetFloor0WorldState();
  if (event.type === "door_opened") {
    multiplayer.floor0WorldState.openedDoorIds.add(event.id);
    applyFloor0DoorOpened(event.id);
    return true;
  }
  if (event.type === "chest_opened") {
    multiplayer.floor0WorldState.openedChestIds.add(event.id);
    applyFloor0ChestOpened(event.id);
    return true;
  }
  if (event.type === "loot_taken") {
    multiplayer.floor0WorldState.takenLootIds.add(event.id);
    applyFloor0LootTaken(event.id);
    return true;
  }
  if (event.type === "enemy_damaged" || event.type === "enemy_killed") {
    const enemyState = event.enemy || event;
    if (enemyState.enemyId) {
      rememberFloor0EnemyState(enemyState);
      applyFloor0EnemyState(enemyState, { immediate: event.type === "enemy_killed" });
    }
    return true;
  }
  return false;
}

function parseFloor0TileEventId(id) {
  const match = String(id || "").match(/^floor0:[^:]+:(-?\d+),(-?\d+)$/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

function applyFloor0DoorOpened(id) {
  const spot = parseFloor0TileEventId(id);
  if (!spot || currentFloor !== 0) return;
  if (map?.[spot.y]?.[spot.x] === "D") {
    map[spot.y][spot.x] = ".";
    minimapDirty = true;
    visibilityDirty = true;
  }
}

function applyFloor0ChestOpened(id) {
  const spot = parseFloor0TileEventId(id);
  if (!spot || currentFloor !== 0) return;
  openedChests.add(`${spot.x},${spot.y}`);
  if (map?.[spot.y]?.[spot.x] === "C") {
    map[spot.y][spot.x] = ".";
    minimapDirty = true;
    visibilityDirty = true;
  }
}

function applyFloor0LootTaken(id) {
  const corpse = corpses?.find(corpse => corpse.id === id);
  if (corpse) {
    if (typeof markCorpseLooted === "function") markCorpseLooted(corpse, { sync: false, announce: false });
    else {
      corpse.loot = [];
      corpse.looted = true;
      if (activeLootCorpseId === corpse.id) closeLootWindow();
    }
  }
}

function applyFloor0EnemyState(state, { immediate = false } = {}) {
  if (!state?.enemyId || currentFloor !== 0 || !Array.isArray(enemies)) return;
  const enemy = enemies.find(candidate => candidate.enemyId === state.enemyId);
  if (!enemy) return;
  const stored = multiplayer.floor0WorldState?.enemyStates?.get(state.enemyId);
  if (stored?.alive === false && state.alive !== false) return;
  if (Number.isFinite(Number(state.hp))) enemy.hp = Math.max(0, Number(state.hp));
  if (Number.isFinite(Number(state.maxHp))) enemy.maxHp = Math.max(1, Number(state.maxHp));
  if (state.alive === false || enemy.hp <= 0) {
    // Death and damage events are world events, not movement ownership, so they resolve immediately.
    enemy.hp = 0;
    enemy.floor0SyncTarget = null;
    return;
  }

  const hasPosition = Number.isFinite(Number(state.x)) && Number.isFinite(Number(state.y));
  if (!hasPosition) return;

  const ownerId = state.ownerPlayerId || state.sourcePlayerId || state.playerId || null;
  enemy.floor0SyncOwnerId = ownerId;
  enemy.floor0SyncReceivedAt = Date.now();
  if (ownerId) logFloor0EnemySyncOwner(ownerId, "Applying remote enemy movement owner");

  const targetX = Number(state.x);
  const targetY = Number(state.y);
  const distance = Math.hypot(targetX - enemy.x, targetY - enemy.y);
  if (immediate || distance > FLOOR0_ENEMY_SYNC_SNAP_DISTANCE) {
    // Only snap when joining a world state or when a crawler is far enough out of sync that interpolation would look worse.
    if (typeof updateEnemyFacing === "function") updateEnemyFacing(enemy, targetX - enemy.x, targetY - enemy.y);
    enemy.x = targetX;
    enemy.y = targetY;
    enemy.floor0SyncTarget = null;
    return;
  }

  enemy.floor0SyncTarget = { x: targetX, y: targetY, receivedAt: enemy.floor0SyncReceivedAt };
}

function shouldUseRemoteFloor0EnemySync(enemy, now = Date.now()) {
  if (!enemy?.floor0SyncTarget || currentFloor !== 0) return false;
  if (!multiplayer.enabled || !multiplayer.usingServer || getServerLobbyCrawlerCount() <= 1) return false;
  if (enemy.floor0SyncOwnerId && enemy.floor0SyncOwnerId === multiplayer.playerId) return false;
  if (now - (enemy.floor0SyncReceivedAt || 0) > FLOOR0_ENEMY_SYNC_TTL_MS) {
    enemy.floor0SyncTarget = null;
    return false;
  }
  return true;
}

function updateFloor0EnemySyncInterpolation(enemy, now = Date.now()) {
  if (!shouldUseRemoteFloor0EnemySync(enemy, now)) return false;
  const target = enemy.floor0SyncTarget;
  const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
  if (distance > FLOOR0_ENEMY_SYNC_SNAP_DISTANCE) {
    if (typeof updateEnemyFacing === "function") updateEnemyFacing(enemy, target.x - enemy.x, target.y - enemy.y);
    enemy.x = target.x;
    enemy.y = target.y;
    enemy.floor0SyncTarget = null;
    return true;
  }
  const stepX = (target.x - enemy.x) * FLOOR0_ENEMY_SYNC_INTERPOLATION;
  const stepY = (target.y - enemy.y) * FLOOR0_ENEMY_SYNC_INTERPOLATION;
  if (typeof updateEnemyFacing === "function") updateEnemyFacing(enemy, stepX, stepY);
  enemy.x += stepX;
  enemy.y += stepY;
  if (distance < 0.5) enemy.floor0SyncTarget = null;
  return true;
}

function applyFloor0WorldState(messageOrState) {
  const worldState = messageOrState?.worldState || messageOrState;
  if (!worldState) return;
  resetFloor0WorldState();
  for (const id of worldState.openedDoorIds || []) applyFloor0WorldEvent({ type: "door_opened", id });
  for (const id of worldState.openedChestIds || []) applyFloor0WorldEvent({ type: "chest_opened", id });
  for (const id of worldState.takenLootIds || []) applyFloor0WorldEvent({ type: "loot_taken", id });
  for (const corpse of worldState.playerCorpses || []) applyPlayerCorpseCreated(corpse);
  const states = Array.isArray(worldState.enemyStates) ? worldState.enemyStates : Object.values(worldState.enemyStates || {});
  for (const state of states) {
    if (!state?.enemyId) continue;
    rememberFloor0EnemyState(state);
    applyFloor0EnemyState(state, { immediate: true });
  }
}



function normalizePlayerCorpse(corpse) {
  if (!corpse?.id || corpse.looted) return null;
  return {
    ...corpse,
    playerCorpse: true,
    kind: "player",
    boss: false,
    name: corpse.name || `${corpse.deadPlayerName || "Crawler"}'s Corpse`,
    r: Number(corpse.r) || 13,
    loot: (corpse.loot || []).map(item => ({ ...item }))
  };
}

function applyPlayerCorpseCreated(rawCorpse) {
  const corpse = normalizePlayerCorpse(rawCorpse);
  if (!corpse || Number(corpse.floor) !== currentFloor) return false;
  if (corpse.deadPlayerId === multiplayer.playerId) corpse.selfCorpse = true;
  const existing = getCorpseById(corpse.id);
  if (existing) Object.assign(existing, corpse);
  else corpses.push(corpse);
  minimapDirty = true;
  return true;
}

function applyPlayerCorpseLootTaken(message = {}) {
  const corpse = getCorpseById(message.corpseId);
  if (!corpse) return false;
  if (message.looterPlayerId === multiplayer.playerId) {
    for (const item of message.loot || []) awardCorpseLootItem(corpse, item);
    updateInventoryUI();
    updateHUD();
  }
  corpse.loot = (message.remainingLoot || []).map(item => ({ ...item }));
  if (activeLootCorpseId === corpse.id) renderCorpseLootWindow(corpse);
  return true;
}

function applyPlayerCorpseLooted(corpseId) {
  const corpse = getCorpseById(corpseId);
  if (corpse) markCorpseLooted(corpse, { sync: false, announce: false });
}

function takeServerPlayerCorpseLoot(corpse, index, takeAll = false) {
  if (!corpse?.playerCorpse || !multiplayer.enabled || !multiplayer.usingServer) return false;
  if (corpse.deadPlayerId === multiplayer.playerId) { if (typeof announcer === "function") announcer("You cannot loot your own corpse in this PvP test."); return false; }
  return sendMultiplayerMessage("player_corpse_loot_take", { corpseId: corpse.id, lootIndex: index, takeAll });
}

function applyFloor0EnemySnapshot(message) {
  if (!multiplayer.enabled || !multiplayer.usingServer) return;
  if (message.lobbyCode && multiplayer.roomId && message.lobbyCode !== multiplayer.roomId) return;
  if (message.currentFloor !== 0 || currentFloor !== 0) return;

  const snapshotOwnerId = message.ownerPlayerId || message.sourcePlayerId || message.playerId || null;
  for (const state of message.enemies || []) {
    const stateWithOwner = snapshotOwnerId && !state.ownerPlayerId && !state.sourcePlayerId
      ? { ...state, ownerPlayerId: snapshotOwnerId }
      : state;
    if (shouldSkipFloor0EnemySnapshot(stateWithOwner)) continue;
    rememberFloor0EnemyState(stateWithOwner);
    applyFloor0EnemyState(stateWithOwner);
  }
}

function maybeSendFloor0EnemySnapshot(now = Date.now()) {
  if (!multiplayer.enabled || !multiplayer.usingServer || currentFloor !== 0) return false;
  if (!isMultiplayerNetworkReady()) return false;
  if (now - multiplayerNetwork.lastEnemySnapshotSentAt < 150) return false;
  const roomId = Number(player.currentRoomId);
  if (!Number.isFinite(roomId)) return false;
  const activeEnemies = enemies
    .filter(enemy => enemy.hp > 0 && floor0EnemyRoomId(enemy) === roomId)
    .slice(0, 24)
    .map(floor0EnemyPayload)
    .filter(Boolean);
  if (!activeEnemies.length) return false;

  const signature = activeEnemies
    .map(enemy => `${enemy.enemyId}:${Math.round(enemy.hp)}:${networkNumberSignature(enemy.x)}:${networkNumberSignature(enemy.y)}`)
    .join("|");
  if (signature === multiplayerNetwork.lastEnemySnapshotSignature && now - multiplayerNetwork.lastEnemySnapshotSentAt < 1000) return false;

  multiplayerNetwork.lastEnemySnapshotSentAt = now;
  multiplayerNetwork.lastEnemySnapshotSignature = signature;
  return sendMultiplayerMessage("floor0_enemy_snapshot", { roomId, enemies: activeEnemies });
}
