const {
  LOBBY_MODES,
  LOBBY_STATUS,
  SERVER_MESSAGES,
  STAGING_LIMITS_MS,
  TARGET_PLAYERS,
  safeSend
} = require("./protocol");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PLAYER_COLORS = ["#75c7ff", "#ff9bd1", "#ffd86b", "#9cffb1"];

class LobbyManager {
  constructor() {
    this.clients = new Map();
    this.lobbies = new Map();
    this.quickLobbyCounter = 1;
    this.cleanupTimer = null;
  }

  registerClient(ws, playerId) {
    this.clients.set(playerId, {
      ws,
      playerId,
      name: `Crawler ${playerId.slice(-4).toUpperCase()}`,
      lobbyCode: null,
      connectedAt: Date.now()
    });
  }

  unregisterClient(playerId) {
    this.leaveLobby(playerId, { silent: false });
    this.clients.delete(playerId);
  }

  createPrivateLobby(playerId) {
    const client = this.requireClient(playerId);
    this.leaveLobby(playerId, { silent: true });

    const code = this.generatePrivateCode();
    const lobby = this.createLobby({ code, mode: LOBBY_MODES.PRIVATE, adminId: playerId });
    this.addPlayerToLobby(lobby, client);

    safeSend(client.ws, SERVER_MESSAGES.LOBBY_CREATED, { lobbyCode: code, adminId: playerId });
    safeSend(client.ws, SERVER_MESSAGES.LOBBY_JOINED, { lobbyCode: code, mode: lobby.mode });
    this.broadcastLobbyUpdate(lobby);
    return lobby;
  }

  joinPrivateLobby(playerId, requestedCode) {
    const code = String(requestedCode || "").trim().toUpperCase();
    if (!code) throw new Error("Enter a lobby code.");

    const client = this.requireClient(playerId);
    const lobby = this.lobbies.get(code);
    if (!lobby || lobby.mode !== LOBBY_MODES.PRIVATE) throw new Error("Lobby code not found.");
    if (lobby.status !== LOBBY_STATUS.STAGING) throw new Error("That lobby has already left Floor 0 staging.");
    if (lobby.players.length >= TARGET_PLAYERS) throw new Error("That crawler lobby is full.");

    this.leaveLobby(playerId, { silent: true });
    this.addPlayerToLobby(lobby, client);
    safeSend(client.ws, SERVER_MESSAGES.LOBBY_JOINED, { lobbyCode: lobby.code, mode: lobby.mode });
    this.broadcastLobbyUpdate(lobby);
    return lobby;
  }

  joinQuickMatch(playerId) {
    const client = this.requireClient(playerId);
    this.leaveLobby(playerId, { silent: true });

    let lobby = Array.from(this.lobbies.values()).find(candidate => (
      candidate.mode === LOBBY_MODES.QUICK_MATCH &&
      candidate.status === LOBBY_STATUS.STAGING &&
      candidate.players.length < TARGET_PLAYERS
    ));

    if (!lobby) {
      const code = `QUICK-${String(this.quickLobbyCounter++).padStart(4, "0")}`;
      lobby = this.createLobby({ code, mode: LOBBY_MODES.QUICK_MATCH, adminId: null });
    }

    this.addPlayerToLobby(lobby, client);
    safeSend(client.ws, SERVER_MESSAGES.MATCHMAKING_UPDATE, {
      lobbyCode: lobby.code,
      players: lobby.players.length,
      targetPlayers: TARGET_PLAYERS
    });
    safeSend(client.ws, SERVER_MESSAGES.LOBBY_JOINED, { lobbyCode: lobby.code, mode: lobby.mode });
    this.broadcastLobbyUpdate(lobby);
    return lobby;
  }

  leaveLobby(playerId, { silent = false } = {}) {
    const client = this.clients.get(playerId);
    if (!client?.lobbyCode) return false;

    const lobby = this.lobbies.get(client.lobbyCode);
    client.lobbyCode = null;
    if (!lobby) return false;

    const leavingPlayer = lobby.players.find(player => player.id === playerId);
    lobby.players = lobby.players.filter(player => player.id !== playerId);

    if (lobby.players.length === 0) {
      this.destroyLobby(lobby);
      return true;
    }

    if (lobby.mode === LOBBY_MODES.PRIVATE && lobby.adminId === playerId && lobby.status === LOBBY_STATUS.STAGING) {
      lobby.adminId = lobby.players[0].id;
    }

    if (!silent && leavingPlayer) {
      this.broadcast(lobby, SERVER_MESSAGES.PLAYER_LEFT, {
        lobbyCode: lobby.code,
        playerId,
        name: leavingPlayer.name
      });
    }
    this.broadcastLobbyUpdate(lobby);
    return true;
  }

  createLobby({ code, mode, adminId }) {
    const now = Date.now();
    const lobby = {
      code,
      mode,
      adminId,
      players: [],
      status: LOBBY_STATUS.STAGING,
      createdAt: now,
      stagingEndsAt: now + STAGING_LIMITS_MS[1],
      stagingTimer: null
    };
    this.lobbies.set(code, lobby);
    return lobby;
  }

  addPlayerToLobby(lobby, client) {
    if (lobby.players.some(player => player.id === client.playerId)) return;
    client.lobbyCode = lobby.code;
    lobby.players.push({
      id: client.playerId,
      name: client.name,
      joinedAt: Date.now(),
      color: PLAYER_COLORS[(lobby.players.length) % PLAYER_COLORS.length]
    });
    this.applyStagingLimit(lobby);
    this.scheduleStaging(lobby);
  }

  applyStagingLimit(lobby) {
    if (lobby.status !== LOBBY_STATUS.STAGING) return;
    const count = Math.max(1, Math.min(TARGET_PLAYERS, lobby.players.length));
    const limit = STAGING_LIMITS_MS[count] || STAGING_LIMITS_MS[TARGET_PLAYERS];
    lobby.stagingEndsAt = Math.min(lobby.stagingEndsAt, Date.now() + limit);
  }

  scheduleStaging(lobby) {
    if (lobby.stagingTimer) clearTimeout(lobby.stagingTimer);
    if (lobby.status !== LOBBY_STATUS.STAGING) return;

    const delay = Math.max(0, lobby.stagingEndsAt - Date.now());
    lobby.stagingTimer = setTimeout(() => this.completeStaging(lobby.code), delay);
  }

  completeStaging(code) {
    const lobby = this.lobbies.get(code);
    if (!lobby || lobby.status !== LOBBY_STATUS.STAGING) return;
    lobby.status = LOBBY_STATUS.START_PENDING;
    lobby.adminId = null;
    lobby.stagingEndsAt = Date.now();
    if (lobby.stagingTimer) clearTimeout(lobby.stagingTimer);
    lobby.stagingTimer = null;

    this.broadcastLobbyUpdate(lobby);
    this.broadcast(lobby, SERVER_MESSAGES.STAGING_COMPLETE, {
      lobbyCode: lobby.code,
      message: "Floor 1 start pending"
    });
  }

  broadcastLobbyUpdate(lobby) {
    const payload = this.lobbyPayload(lobby);
    this.broadcast(lobby, SERVER_MESSAGES.LOBBY_UPDATE, payload);
    if (lobby.status === LOBBY_STATUS.STAGING) this.scheduleStaging(lobby);
  }

  lobbyPayload(lobby) {
    const payload = {
      lobbyCode: lobby.code,
      mode: lobby.mode,
      players: lobby.players.map(player => ({
        id: player.id,
        name: player.name,
        color: player.color,
        joinedAt: player.joinedAt,
        admin: lobby.mode === LOBBY_MODES.PRIVATE && player.id === lobby.adminId
      })),
      targetPlayers: TARGET_PLAYERS,
      status: lobby.status,
      stagingEndsAt: new Date(lobby.stagingEndsAt).toISOString()
    };

    if (lobby.mode === LOBBY_MODES.PRIVATE && lobby.adminId) payload.adminId = lobby.adminId;
    return payload;
  }

  broadcast(lobby, type, payload = {}) {
    for (const player of lobby.players) {
      const client = this.clients.get(player.id);
      if (client) safeSend(client.ws, type, payload);
    }
  }

  cleanupEmptyLobbies() {
    for (const lobby of this.lobbies.values()) {
      if (lobby.players.length === 0) this.destroyLobby(lobby);
    }
  }

  startCleanup(intervalMs = 30_000) {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanupEmptyLobbies(), intervalMs);
  }

  destroyLobby(lobby) {
    if (lobby.stagingTimer) clearTimeout(lobby.stagingTimer);
    this.lobbies.delete(lobby.code);
  }

  requireClient(playerId) {
    const client = this.clients.get(playerId);
    if (!client) throw new Error("Unknown crawler connection.");
    return client;
  }

  generatePrivateCode() {
    for (let attempt = 0; attempt < 100; attempt++) {
      let suffix = "";
      for (let i = 0; i < 4; i++) suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      const code = `RUNE-${suffix}`;
      if (!this.lobbies.has(code)) return code;
    }
    throw new Error("Could not allocate a lobby code.");
  }
}

module.exports = { LobbyManager };
