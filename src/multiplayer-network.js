const MULTIPLAYER_WS_URL = window.DCW_WS_URL || `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname || "localhost"}:8080`;

const multiplayerNetwork = {
  socket: null,
  url: MULTIPLAYER_WS_URL,
  connected: false,
  connecting: false,
  playerId: null,
  lastError: null,
  reconnectTimer: null,
  countdownTimer: null
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
  multiplayer.networkStatus = "connected";

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
      multiplayer.status = "start_pending";
      multiplayer.stagingEndsAt = Date.now();
      multiplayer.collapseAt = Date.now();
      floorTimeLeft = 0;
      if (typeof updateHUD === "function") updateHUD();
      if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
      if (typeof announcer === "function") announcer("Floor 0 collapse resolved. Floor 1 transition pending.");
      if (typeof showCenter === "function") {
        showCenter("Floor 0 Collapse", "Floor 0 collapsed before a server-driven Floor 1 transition was available. Real Floor 1 server startup is not implemented in this slice.", "Return to Title", returnToTitle);
      }
      break;
    case "player_left":
      if (typeof announcer === "function") announcer(`${message.name || "A crawler"} left Floor 0. The collapse timer will not increase.`);
      break;
    case "error":
      handleMultiplayerNetworkError(message.message || "Floor 0 collapse server request failed.");
      break;
  }

  if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
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
  multiplayer.stagingEndsAt = update.floor0CollapseAt ? Date.parse(update.floor0CollapseAt) : (update.stagingEndsAt ? Date.parse(update.stagingEndsAt) : null);
  multiplayer.collapseAt = multiplayer.stagingEndsAt;
  syncFloor0TimerFromServer();
  multiplayer.partyMembers = (update.players || []).map((player, index) => ({
    id: player.id,
    name: player.id === multiplayer.playerId ? "You" : (player.name || `Crawler ${index + 1}`),
    leader: !!player.admin,
    admin: !!player.admin,
    local: player.id === multiplayer.playerId,
    color: player.color
  }));

  setGameMode(update.mode === "quick_match" ? GAME_MODES.MULTIPLAYER_MATCHMAKING : GAME_MODES.MULTIPLAYER_FLOOR0);
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
