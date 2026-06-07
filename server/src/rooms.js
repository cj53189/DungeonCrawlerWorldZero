const {
  LOBBY_MODES,
  LOBBY_STATUS,
  SERVER_MESSAGES,
  FLOOR0_COLLAPSE_CAPS_MS,
  TARGET_PLAYERS,
  safeSend
} = require("./protocol");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FLOOR0_SPAWN_OFFSETS = Object.freeze([
  { dx: 0, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 }
]);
const PLAYER_COLORS = ["#75c7ff", "#ff9bd1", "#ffd86b", "#9cffb1"];
const CRAWLER_STATE_BROADCAST_MS = 100;
const CRAWLER_STATUS_VALUES = new Set(["active", "downed", "stasis"]);
const FLOOR0_ADVANCE_STATUSES = Object.freeze({
  EXPLORING: "exploring",
  AT_STAIRS: "at_stairs",
  FAILED: "failed",
  ADVANCING: "advancing"
});

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
    if (lobby.status !== LOBBY_STATUS.STAGING) throw new Error("That Floor 0 collapse has already resolved.");
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
      this.broadcastCrawlerSnapshot(lobby, { force: true });
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
      floor0CollapseAt: now + FLOOR0_COLLAPSE_CAPS_MS[1],
      floor0: this.createFloor0Metadata(code, now + FLOOR0_COLLAPSE_CAPS_MS[1]),
      floor0CollapseTimer: null,
      crawlerSnapshotTimer: null,
      lastCrawlerSnapshotAt: 0
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
      color: PLAYER_COLORS[(lobby.players.length) % PLAYER_COLORS.length],
      crawlerState: null,
      floor0Status: FLOOR0_ADVANCE_STATUSES.EXPLORING,
      floor0ReachedStairsAt: null
    });
    this.applyFloor0CollapseCap(lobby);
    this.scheduleFloor0Collapse(lobby);
  }

  applyFloor0CollapseCap(lobby) {
    if (lobby.status !== LOBBY_STATUS.STAGING) return;
    const count = Math.max(1, Math.min(TARGET_PLAYERS, lobby.players.length));
    const cap = FLOOR0_COLLAPSE_CAPS_MS[count] || FLOOR0_COLLAPSE_CAPS_MS[TARGET_PLAYERS];
    lobby.floor0CollapseAt = Math.min(lobby.floor0CollapseAt, Date.now() + cap);
    this.syncFloor0CollapseMetadata(lobby);
  }

  scheduleFloor0Collapse(lobby) {
    if (lobby.floor0CollapseTimer) clearTimeout(lobby.floor0CollapseTimer);
    if (lobby.status !== LOBBY_STATUS.STAGING) return;

    const delay = Math.max(0, lobby.floor0CollapseAt - Date.now());
    lobby.floor0CollapseTimer = setTimeout(() => this.resolveFloor0Collapse(lobby.code), delay);
  }

  resolveFloor0Collapse(code) {
    const lobby = this.lobbies.get(code);
    if (!lobby || lobby.status !== LOBBY_STATUS.STAGING) return;
    lobby.status = LOBBY_STATUS.START_PENDING;
    lobby.adminId = null;
    lobby.floor0CollapseAt = Date.now();

    const advancingPlayers = [];
    const failedPlayers = [];
    for (const player of lobby.players) {
      if (player.floor0Status === FLOOR0_ADVANCE_STATUSES.AT_STAIRS || player.floor0Status === FLOOR0_ADVANCE_STATUSES.ADVANCING) {
        player.floor0Status = FLOOR0_ADVANCE_STATUSES.ADVANCING;
        advancingPlayers.push(player);
      } else {
        player.floor0Status = FLOOR0_ADVANCE_STATUSES.FAILED;
        failedPlayers.push(player);
      }
    }
    this.syncFloor0CollapseMetadata(lobby);
    if (lobby.floor0CollapseTimer) clearTimeout(lobby.floor0CollapseTimer);
    lobby.floor0CollapseTimer = null;

    this.broadcastLobbyUpdate(lobby);
    this.broadcast(lobby, SERVER_MESSAGES.FLOOR0_RESOLVED, {
      lobbyCode: lobby.code,
      floor: 0,
      advancedPlayerIds: advancingPlayers.map(player => player.id),
      failedPlayerIds: failedPlayers.map(player => player.id),
      players: lobby.players.map(player => this.playerStatusPayload(player))
    });

    for (const player of advancingPlayers) {
      const client = this.clients.get(player.id);
      if (client) {
        safeSend(client.ws, SERVER_MESSAGES.FLOOR_START, {
          lobbyCode: lobby.code,
          floor: 1,
          placeholder: true,
          message: "Floor 1 placeholder start. Movement sync will arrive in a later slice."
        });
      }
    }
  }


  markCrawlerAtFloor0Stairs(playerId) {
    const client = this.requireClient(playerId);
    if (!client.lobbyCode) return false;

    const lobby = this.lobbies.get(client.lobbyCode);
    if (!lobby || lobby.status !== LOBBY_STATUS.STAGING) return false;

    const player = lobby.players.find(candidate => candidate.id === playerId);
    if (!player || player.floor0Status !== FLOOR0_ADVANCE_STATUSES.EXPLORING) return false;

    player.floor0Status = FLOOR0_ADVANCE_STATUSES.AT_STAIRS;
    player.floor0ReachedStairsAt = Date.now();
    this.broadcastLobbyUpdate(lobby);
    this.broadcastCrawlerSnapshot(lobby, { force: true });
    return true;
  }

  updateCrawlerState(playerId, state) {
    const client = this.requireClient(playerId);
    if (!client.lobbyCode) return false;

    const lobby = this.lobbies.get(client.lobbyCode);
    if (!lobby) return false;

    const player = lobby.players.find(candidate => candidate.id === playerId);
    if (!player) return false;

    const sanitized = this.sanitizeCrawlerState(state);
    if (!sanitized || sanitized.currentFloor !== 0) {
      player.crawlerState = null;
      this.broadcastCrawlerSnapshot(lobby, { force: true });
      return false;
    }

    player.crawlerState = {
      ...sanitized,
      id: player.id,
      name: player.name,
      color: player.color,
      updatedAt: Date.now()
    };
    this.broadcastCrawlerSnapshot(lobby);
    return true;
  }

  sanitizeCrawlerState(state) {
    if (!state || typeof state !== "object") return null;

    const finiteNumber = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };

    const x = finiteNumber(state.x);
    const y = finiteNumber(state.y);
    if (x === null || y === null) return null;

    const currentFloor = Math.trunc(finiteNumber(state.currentFloor) ?? 0);
    const hp = Math.max(0, finiteNumber(state.hp) ?? 0);
    const maxHp = Math.max(1, finiteNumber(state.maxHp) ?? 1);
    const aimX = finiteNumber(state.aimX);
    const aimY = finiteNumber(state.aimY);
    const status = CRAWLER_STATUS_VALUES.has(state.status) ? state.status : "active";

    return {
      x,
      y,
      hp: Math.min(hp, maxHp),
      maxHp,
      currentFloor,
      status,
      ...(aimX === null ? {} : { aimX }),
      ...(aimY === null ? {} : { aimY })
    };
  }

  broadcastCrawlerSnapshot(lobby, { force = false } = {}) {
    if (!lobby || !lobby.players.length) return;

    const now = Date.now();
    const elapsed = now - (lobby.lastCrawlerSnapshotAt || 0);
    if (!force && elapsed < CRAWLER_STATE_BROADCAST_MS) {
      if (!lobby.crawlerSnapshotTimer) {
        lobby.crawlerSnapshotTimer = setTimeout(() => {
          lobby.crawlerSnapshotTimer = null;
          this.broadcastCrawlerSnapshot(lobby, { force: true });
        }, CRAWLER_STATE_BROADCAST_MS - elapsed);
      }
      return;
    }

    if (lobby.crawlerSnapshotTimer) {
      clearTimeout(lobby.crawlerSnapshotTimer);
      lobby.crawlerSnapshotTimer = null;
    }

    lobby.lastCrawlerSnapshotAt = now;
    this.broadcast(lobby, SERVER_MESSAGES.CRAWLER_SNAPSHOT, {
      lobbyCode: lobby.code,
      currentFloor: 0,
      players: lobby.players
        .filter(player => player.crawlerState?.currentFloor === 0)
        .map(player => ({
          ...player.crawlerState,
          floor0Status: player.floor0Status || FLOOR0_ADVANCE_STATUSES.EXPLORING
        }))
    });
  }

  broadcastLobbyUpdate(lobby) {
    const payload = this.lobbyPayload(lobby);
    this.broadcast(lobby, SERVER_MESSAGES.LOBBY_UPDATE, payload);
    if (lobby.status === LOBBY_STATUS.STAGING) this.scheduleFloor0Collapse(lobby);
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
        admin: lobby.mode === LOBBY_MODES.PRIVATE && player.id === lobby.adminId,
        floor0Status: player.floor0Status || FLOOR0_ADVANCE_STATUSES.EXPLORING
      })),
      targetPlayers: TARGET_PLAYERS,
      status: lobby.status,
      stagingEndsAt: new Date(lobby.floor0CollapseAt).toISOString(),
      floor0CollapseAt: new Date(lobby.floor0CollapseAt).toISOString(),
      floor0: this.floor0Payload(lobby)
    };

    if (lobby.mode === LOBBY_MODES.PRIVATE && lobby.adminId) payload.adminId = lobby.adminId;
    return payload;
  }


  playerStatusPayload(player) {
    return {
      id: player.id,
      name: player.name,
      color: player.color,
      floor0Status: player.floor0Status || FLOOR0_ADVANCE_STATUSES.EXPLORING,
      reachedStairsAt: player.floor0ReachedStairsAt ? new Date(player.floor0ReachedStairsAt).toISOString() : null
    };
  }

  createFloor0Metadata(code, collapseAt) {
    const seed = this.makeFloor0Seed(code);
    return {
      floor: 0,
      seed,
      safeRoomId: 0,
      spawnRoom: { id: 0, type: "safe" },
      spawnPoints: FLOOR0_SPAWN_OFFSETS.map((offset, index) => ({
        id: `floor0_spawn_${index + 1}`,
        roomId: 0,
        index,
        dx: offset.dx,
        dy: offset.dy
      })),
      // TODO: Populate from server-authoritative dungeon generation once Floor 1 transition work owns layout generation.
      stairs: null,
      collapseAt: new Date(collapseAt).toISOString()
    };
  }

  syncFloor0CollapseMetadata(lobby) {
    if (!lobby.floor0) lobby.floor0 = this.createFloor0Metadata(lobby.code, lobby.floor0CollapseAt);
    lobby.floor0.collapseAt = new Date(lobby.floor0CollapseAt).toISOString();
  }

  floor0Payload(lobby) {
    this.syncFloor0CollapseMetadata(lobby);
    return {
      ...lobby.floor0,
      spawnRoom: lobby.floor0.spawnRoom ? { ...lobby.floor0.spawnRoom } : null,
      spawnPoints: lobby.floor0.spawnPoints.map(point => ({ ...point })),
      stairs: lobby.floor0.stairs ? { ...lobby.floor0.stairs } : null
    };
  }

  makeFloor0Seed(code) {
    let hash = 2166136261;
    for (const char of String(code || "FLOOR0")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `floor0-${(hash >>> 0).toString(16).padStart(8, "0")}`;
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
    if (lobby.floor0CollapseTimer) clearTimeout(lobby.floor0CollapseTimer);
    if (lobby.crawlerSnapshotTimer) clearTimeout(lobby.crawlerSnapshotTimer);
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
