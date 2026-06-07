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
  reconnectTimer: null,
  countdownTimer: null,
  lastCrawlerStateSentAt: 0,
  lastEnemySnapshotSentAt: 0
};

function isMultiplayerNetworkReady() {
  return !!(multiplayerNetwork.connected && multiplayerNetwork.socket?.readyState === WebSocket.OPEN && multiplayerNetwork.playerId);
}

function connectMultiplayerNetwork() {
  if (multiplayerNetwork.connected || multiplayerNetwork.connecting || typeof WebSocket === "undefined") return;

  multiplayerNetwork.connecting = true;
  multiplayerNetwork.lastError = null;

  try {
    const socket = new WebSocket(multiplayerNetwork.url);
    multiplayerNetwork.socket = socket;

    socket.addEventListener("open", () => {
      multiplayerNetwork.connected = true;
      multiplayerNetwork.connecting = false;
      multiplayerNetwork.lastError = null;
      sendMultiplayerMessage("hello");
      if (typeof announcer === "function") announcer("Floor 0 collapse server connected.");
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
      multiplayerNetwork.connected = false;
      multiplayerNetwork.connecting = false;
      if (multiplayer.usingServer) {
        multiplayer.status = "offline";
        multiplayer.networkStatus = "disconnected";
        handleMultiplayerNetworkError("Floor 0 collapse server disconnected. Local 4-Crawler Test is still available.");
        if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
      }
    });

    socket.addEventListener("error", () => {
      multiplayerNetwork.connected = false;
      multiplayerNetwork.connecting = false;
      handleMultiplayerNetworkError("Could not reach the Floor 0 collapse server. Using local fallback when needed.");
    });
  } catch (err) {
    multiplayerNetwork.connected = false;
    multiplayerNetwork.connecting = false;
    handleMultiplayerNetworkError(err.message || "Could not create Floor 0 collapse server connection.");
  }
}

function sendMultiplayerMessage(type, payload = {}) {
  if (!multiplayerNetwork.socket || multiplayerNetwork.socket.readyState !== WebSocket.OPEN) return false;
  multiplayerNetwork.socket.send(JSON.stringify({ type, ...payload }));
  return true;
}

function requestServerCreateLobby() {
  if (!isMultiplayerNetworkReady()) return false;
  prepareServerLobbyState({ status: "party", partyCode: null });
  return sendMultiplayerMessage("create_lobby");
}

function requestServerJoinLobby(code) {
  if (!isMultiplayerNetworkReady()) return false;
  const cleanedCode = String(code || "").trim().toUpperCase();
  if (!cleanedCode) return false;
  prepareServerLobbyState({ status: "party", partyCode: cleanedCode });
  return sendMultiplayerMessage("join_lobby", { lobbyCode: cleanedCode });
}

function requestServerQuickMatch() {
  if (!isMultiplayerNetworkReady()) return false;
  prepareServerLobbyState({ status: "matchmaking", partyCode: null });
  return sendMultiplayerMessage("quick_match");
}

function requestServerLeaveLobby() {
  if (!isMultiplayerNetworkReady() || !multiplayer.usingServer) return false;
  return sendMultiplayerMessage("leave_lobby");
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

function prepareServerLobbyState({ status, partyCode }) {
  multiplayer.enabled = true;
  multiplayer.usingServer = true;
  multiplayer.targetPlayers = MULTIPLAYER_TARGET_PLAYERS;
  multiplayer.partyCode = partyCode;
  multiplayer.roomId = partyCode || "QUICK-MATCH";
  multiplayer.status = status;
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
      multiplayer.partyCode = message.lobbyCode;
      multiplayer.roomId = message.lobbyCode;
      if (typeof announcer === "function") announcer(`Crawlers Registered for Floor 0 Collapse: ${message.lobbyCode}.`);
      break;
    case "lobby_joined":
      multiplayer.partyCode = message.mode === "quick_match" ? null : message.lobbyCode;
      multiplayer.roomId = message.lobbyCode;
      multiplayer.usingServer = true;
      if (typeof announcer === "function") announcer(message.mode === "quick_match" ? "Joined Quick Match Floor 0 Collapse." : `Joined Floor 0 Collapse ${message.lobbyCode}.`);
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
    case "error":
      handleMultiplayerNetworkError(message.message || "Floor 0 collapse server request failed.");
      break;
  }

  if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
}

function captureLocalCrawlerNetworkState() {
  return {
    x: player.x,
    y: player.y,
    aimX: Number.isFinite(player.aimX) ? player.aimX : undefined,
    aimY: Number.isFinite(player.aimY) ? player.aimY : undefined,
    hp: player.hp,
    maxHp: player.maxHp,
    currentFloor,
    status: gameLost || player.hp <= 0 ? "downed" : (gameMode === GAME_MODES.MULTIPLAYER_STASIS ? "stasis" : "active"),
    floor0Status: multiplayer.localFloor0Status || "exploring",
    currentRoomId: Number.isFinite(Number(player.currentRoomId)) ? Math.trunc(Number(player.currentRoomId)) : undefined
  };
}

function maybeSendLocalCrawlerState(now = Date.now()) {
  if (!multiplayer.enabled || !multiplayer.usingServer || currentFloor !== 0) return false;
  if (!isMultiplayerNetworkReady()) return false;
  if (now - multiplayerNetwork.lastCrawlerStateSentAt < 100) return false;

  multiplayerNetwork.lastCrawlerStateSentAt = now;
  return sendMultiplayerMessage("crawler_state", { state: captureLocalCrawlerNetworkState() });
}

function applyServerCrawlerSnapshot(snapshot) {
  if (!multiplayer.enabled || !multiplayer.usingServer) return;
  if (snapshot.lobbyCode && multiplayer.roomId && snapshot.lobbyCode !== multiplayer.roomId) return;
  if (snapshot.currentFloor !== 0 || currentFloor !== 0) {
    multiplayer.remotePlayers = new Map();
    return;
  }

  const rosterById = new Map(multiplayer.partyMembers.map(member => [member.id, member]));
  const nextRemotePlayers = new Map();

  for (const crawler of snapshot.players || []) {
    if (!crawler || crawler.id === multiplayer.playerId) continue;
    if (!rosterById.has(crawler.id)) continue;

    const x = Number(crawler.x);
    const y = Number(crawler.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const member = rosterById.get(crawler.id);
    nextRemotePlayers.set(crawler.id, {
      id: crawler.id,
      name: member?.name || crawler.name || "Crawler",
      x,
      y,
      r: player.r,
      aimX: Number.isFinite(Number(crawler.aimX)) ? Number(crawler.aimX) : undefined,
      aimY: Number.isFinite(Number(crawler.aimY)) ? Number(crawler.aimY) : undefined,
      hp: Math.max(0, Number(crawler.hp) || 0),
      maxHp: Math.max(1, Number(crawler.maxHp) || player.maxHp),
      currentFloor: 0,
      status: crawler.status || "active",
      floor0Status: normalizeFloor0StatusValue(crawler.floor0Status || member?.floor0Status),
      color: member?.color || crawler.color || "#75c7ff",
      updatedAt: crawler.updatedAt || Date.now()
    });
  }

  multiplayer.remotePlayers = nextRemotePlayers;
}

function applyServerLobbyUpdate(update) {
  multiplayer.enabled = true;
  multiplayer.usingServer = true;
  multiplayer.targetPlayers = update.targetPlayers || MULTIPLAYER_TARGET_PLAYERS;
  multiplayer.roomId = update.lobbyCode;
  multiplayer.partyCode = update.mode === "quick_match" ? null : update.lobbyCode;
  multiplayer.status = translateServerLobbyStatus(update.status, update.mode);
  multiplayer.adminId = update.adminId || null;
  multiplayer.isPartyLeader = !!(update.adminId && update.adminId === multiplayer.playerId);
  multiplayer.floor0Metadata = normalizeFloor0Metadata(update.floor0, update.floor0CollapseAt || update.stagingEndsAt);
  multiplayer.stagingEndsAt = multiplayer.floor0Metadata?.collapseAtMs || (update.floor0CollapseAt ? Date.parse(update.floor0CollapseAt) : (update.stagingEndsAt ? Date.parse(update.stagingEndsAt) : null));
  multiplayer.collapseAt = multiplayer.stagingEndsAt;
  multiplayer.partyMembers = (update.players || []).map((player, index) => ({
    id: player.id,
    name: player.id === multiplayer.playerId ? "You" : (player.name || `Crawler ${index + 1}`),
    leader: !!player.admin,
    admin: !!player.admin,
    local: player.id === multiplayer.playerId,
    color: player.color,
    floor0Status: normalizeFloor0StatusValue(player.floor0Status)
  }));

  setGameMode(update.mode === "quick_match" ? GAME_MODES.MULTIPLAYER_MATCHMAKING : GAME_MODES.MULTIPLAYER_FLOOR0);
  ensureServerFloor0Dungeon();
  applyFloor0WorldState(update.floor0WorldState);
  syncFloor0TimerFromServer();
  if (currentFloor === 0 && multiplayer.remotePlayers?.size) {
    const rosterIds = new Set(multiplayer.partyMembers.map(member => member.id));
    multiplayer.remotePlayers = new Map(Array.from(multiplayer.remotePlayers).filter(([id]) => rosterIds.has(id)));
  }
}


function normalizeFloor0StatusValue(status) {
  return ["exploring", "at_stairs", "failed", "advancing"].includes(status) ? status : "exploring";
}

function applyLocalFloor0Status(status) {
  const normalized = normalizeFloor0StatusValue(status);
  multiplayer.localFloor0Status = normalized;
  for (const member of multiplayer.partyMembers) {
    if (member.local || member.id === multiplayer.playerId) member.floor0Status = normalized;
  }
}

function applyServerFloor0Statuses(players = []) {
  const statuses = new Map((players || []).map(player => [player.id, normalizeFloor0StatusValue(player.floor0Status)]));
  multiplayer.partyMembers = multiplayer.partyMembers.map(member => ({
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
  if (Number(message.floor) !== 1 || multiplayer.localFloor0Status !== "advancing") return;

  const snapshot = captureRunProgress();
  currentFloor = 1;
  gameWon = false;
  gameLost = false;
  pendingFloorAdvance = false;
  setGameMode(GAME_MODES.MULTIPLAYER_ACTIVE);
  multiplayer.status = "active";
  multiplayer.pvpEnabled = false;
  multiplayer.floorStartedAt = Date.now();
  multiplayer.collapseAt = multiplayer.floorStartedAt + getFloorTimeLimit() * 1000;
  multiplayer.remotePlayers = new Map();
  resetState({ preserveRun: true, snapshot });
  showFloorSplash();
  if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
  if (typeof announcer === "function") announcer(message.message || "Floor 1 placeholder started for advancing crawlers only.");
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
  const localIndex = multiplayer.partyMembers.findIndex(member => member.local || member.id === multiplayer.playerId);
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

function handleMultiplayerNetworkError(message) {
  multiplayerNetwork.lastError = message;
  multiplayer.networkError = message;
  if (typeof announcer === "function") announcer(message);
  if (typeof addLog === "function") addLog(`Multiplayer: ${message}`);
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
      applyFloor0EnemyState(enemyState);
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
    corpse.loot = [];
    corpse.looted = true;
    if (activeLootCorpseId === corpse.id) closeLootWindow();
  }
}

function applyFloor0EnemyState(state) {
  if (!state?.enemyId || currentFloor !== 0 || !Array.isArray(enemies)) return;
  const enemy = enemies.find(candidate => candidate.enemyId === state.enemyId);
  if (!enemy) return;
  const stored = multiplayer.floor0WorldState?.enemyStates?.get(state.enemyId);
  if (stored?.alive === false && state.alive !== false) return;
  if (Number.isFinite(Number(state.hp))) enemy.hp = Math.max(0, Number(state.hp));
  if (Number.isFinite(Number(state.maxHp))) enemy.maxHp = Math.max(1, Number(state.maxHp));
  if (state.alive === false || enemy.hp <= 0) {
    enemy.hp = 0;
    return;
  }
  if (Number.isFinite(Number(state.x)) && Number.isFinite(Number(state.y))) {
    enemy.x = Number(state.x);
    enemy.y = Number(state.y);
  }
}

function applyFloor0WorldState(messageOrState) {
  const worldState = messageOrState?.worldState || messageOrState;
  if (!worldState) return;
  resetFloor0WorldState();
  for (const id of worldState.openedDoorIds || []) applyFloor0WorldEvent({ type: "door_opened", id });
  for (const id of worldState.openedChestIds || []) applyFloor0WorldEvent({ type: "chest_opened", id });
  for (const id of worldState.takenLootIds || []) applyFloor0WorldEvent({ type: "loot_taken", id });
  const states = Array.isArray(worldState.enemyStates) ? worldState.enemyStates : Object.values(worldState.enemyStates || {});
  for (const state of states) {
    if (!state?.enemyId) continue;
    rememberFloor0EnemyState(state);
    applyFloor0EnemyState(state);
  }
}

function applyFloor0EnemySnapshot(message) {
  if (!multiplayer.enabled || !multiplayer.usingServer) return;
  if (message.lobbyCode && multiplayer.roomId && message.lobbyCode !== multiplayer.roomId) return;
  if (message.currentFloor !== 0 || currentFloor !== 0) return;
  for (const state of message.enemies || []) {
    rememberFloor0EnemyState(state);
    applyFloor0EnemyState(state);
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
  multiplayerNetwork.lastEnemySnapshotSentAt = now;
  return sendMultiplayerMessage("floor0_enemy_snapshot", { roomId, enemies: activeEnemies });
}
