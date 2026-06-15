const { randomUUID } = require("crypto");

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
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: -1 }
]);
const FLOOR0_LATE_JOIN_GRACE_MS = 120 * 1000;
const PLAYER_COLORS = ["#75c7ff", "#ff9bd1", "#ffd86b", "#9cffb1"];
const CRAWLER_STATE_BROADCAST_MS = 100;
const FLOOR0_ENEMY_SNAPSHOT_MS = 150;
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

  updateClientProfile(playerId, profile = {}) {
    const client = this.requireClient(playerId);
    client.name = this.sanitizePlayerName(profile.name || client.name);
    client.profile = {
      name: client.name,
      sprite: String(profile.sprite || "default").slice(0, 32) || "default",
      color: String(profile.color || "blue").slice(0, 32) || "blue"
    };
    if (client.lobbyCode) {
      const lobby = this.lobbies.get(client.lobbyCode);
      const player = lobby?.players.find(candidate => candidate.id === playerId);
      if (player) {
        player.name = client.name;
        player.profile = client.profile;
        this.broadcastLobbyUpdate(lobby);
      }
    }
  }

  sanitizePlayerName(name) {
    const cleaned = String(name || "").trim().slice(0, 16);
    return cleaned || "Crawler";
  }

  unregisterClient(playerId) {
    const client = this.clients.get(playerId);
    const lobby = client?.lobbyCode ? this.lobbies.get(client.lobbyCode) : null;
    if (lobby?.joinState === "locked" && lobby.players.some(player => player.id === playerId)) {
      client.disconnectedAt = Date.now();
      client.ws = { readyState: 3, OPEN: 1, send() {} };
      this.broadcastLobbyUpdate(lobby);
      return;
    }
    this.leaveLobby(playerId, { silent: false });
    this.clients.delete(playerId);
  }

  reconnectClient(ws, playerId, runId) {
    const lobby = Array.from(this.lobbies.values()).find(candidate => candidate.runId === runId && candidate.players.some(player => player.id === playerId));
    if (!lobby || lobby.joinState !== "locked") return false;
    const existing = this.clients.get(playerId) || { playerId, name: `Crawler ${String(playerId).slice(-4).toUpperCase()}` };
    existing.ws = ws;
    existing.lobbyCode = lobby.code;
    existing.disconnectedAt = null;
    this.clients.set(playerId, existing);
    safeSend(ws, SERVER_MESSAGES.LOBBY_JOINED, { lobbyCode: lobby.code, runId: lobby.runId, mode: lobby.mode, floor: lobby.floor, joinState: lobby.joinState });
    const spawnAssignments = this.assignSpawnPoints(lobby, lobby.players, lobby.floor);
    safeSend(ws, SERVER_MESSAGES.FLOOR_START, {
      lobbyCode: lobby.code,
      runId: lobby.runId,
      floor: lobby.floor,
      floorSeed: lobby.floorSeed,
      spawnAssignments,
      spawnAssignment: spawnAssignments[playerId] || null,
      worldState: this.floorWorldStatePayload(lobby),
      players: lobby.players.map(player => this.playerStatusPayload(player))
    });
    return true;
  }

  createPrivateLobby(playerId) {
    const client = this.requireClient(playerId);
    this.leaveLobby(playerId, { silent: true });

    const code = this.generatePrivateCode();
    const lobby = this.createLobby({ code, mode: LOBBY_MODES.PRIVATE });
    this.addPlayerToLobby(lobby, client, { partyId: this.privatePartyId(code), isPartyLeader: true });

    safeSend(client.ws, SERVER_MESSAGES.LOBBY_CREATED, { lobbyCode: code, partyId: this.privatePartyId(code), isPartyLeader: true });
    safeSend(client.ws, SERVER_MESSAGES.LOBBY_JOINED, { lobbyCode: code, mode: lobby.mode, partyId: this.privatePartyId(code), isPartyLeader: true });
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
    this.addPlayerToLobby(lobby, client, { partyId: this.privatePartyId(lobby.code), isPartyLeader: false });
    safeSend(client.ws, SERVER_MESSAGES.LOBBY_JOINED, { lobbyCode: lobby.code, mode: lobby.mode, partyId: this.privatePartyId(lobby.code), isPartyLeader: false });
    this.broadcastLobbyUpdate(lobby);
    return lobby;
  }

  joinQuickMatch(playerId) {
    const client = this.requireClient(playerId);
    this.leaveLobby(playerId, { silent: true });

    let lobby = Array.from(this.lobbies.values()).find(candidate => (
      candidate.mode === LOBBY_MODES.QUICK_MATCH &&
      candidate.floor === 0 &&
      candidate.joinState === "open"
    ));

    if (!lobby) {
      const code = `QUICK-${String(this.quickLobbyCounter++).padStart(4, "0")}`;
      lobby = this.createLobby({ code, mode: LOBBY_MODES.QUICK_MATCH });
    }

    this.addPlayerToLobby(lobby, client, { partyId: null, isPartyLeader: false });
    safeSend(client.ws, SERVER_MESSAGES.MATCHMAKING_UPDATE, {
      lobbyCode: lobby.code,
      players: lobby.players.length,
      targetPlayers: TARGET_PLAYERS
    });
    safeSend(client.ws, SERVER_MESSAGES.LOBBY_JOINED, { lobbyCode: lobby.code, mode: lobby.mode, partyId: null, isPartyLeader: false });
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

  createLobby({ code, mode }) {
    const now = Date.now();
    const lobby = {
      code,
      mode,
          players: [],
      status: LOBBY_STATUS.STAGING,
      createdAt: now,
      runId: `run_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      floor: 0,
      floorSeed: this.makeFloorSeed(0),
      joinState: "open",
      collapseStartedAt: now,
      collapseAt: now + FLOOR0_COLLAPSE_CAPS_MS[1],
      floor0CollapseAt: now + FLOOR0_COLLAPSE_CAPS_MS[1],
      floor0: null,
      worldState: this.createFloorWorldState(),
      floorWorldStates: new Map(),
      floor0WorldState: null,
      floor0CollapseTimer: null,
      crawlerSnapshotTimer: null,
      enemySnapshotTimer: null,
      lastCrawlerSnapshotAt: 0,
      lastEnemySnapshotAt: 0
    };
    lobby.floor0 = this.createFloor0Metadata(lobby, lobby.floor0CollapseAt);
    lobby.floorWorldStates.set(0, lobby.worldState);
    lobby.floor0WorldState = lobby.worldState;
    this.lobbies.set(code, lobby);
    return lobby;
  }

  privatePartyId(code) {
    return `party:${code}`;
  }

  addPlayerToLobby(lobby, client, { partyId = null, isPartyLeader = false } = {}) {
    if (lobby.players.some(player => player.id === client.playerId)) return;
    client.lobbyCode = lobby.code;
    lobby.players.push({
      id: client.playerId,
      name: client.name,
      profile: client.profile || { name: client.name, sprite: "default", color: "blue" },
      joinedAt: Date.now(),
      color: PLAYER_COLORS[(lobby.players.length) % PLAYER_COLORS.length],
      partyId,
      isPartyLeader: !!isPartyLeader,
      crawlerState: null,
      floor0Status: FLOOR0_ADVANCE_STATUSES.EXPLORING,
      floor0ReachedStairsAt: null
    });
    this.applyFloor0LateJoinTimer(lobby);
    safeSend(client.ws, SERVER_MESSAGES.FLOOR0_WORLD_STATE, {
      lobbyCode: lobby.code,
      runId: lobby.runId,
      currentFloor: lobby.floor,
      floorSeed: lobby.floorSeed,
      floor0: this.floor0Payload(lobby),
      worldState: this.floorWorldStatePayload(lobby)
    });
    this.syncFloor0CollapseMetadata(lobby);
    this.scheduleFloor0Collapse(lobby);
  }

  applyFloor0LateJoinTimer(lobby) {
    if (lobby.floor !== 0 || lobby.joinState !== "open") return;
    const now = Date.now();
    if (now - (lobby.collapseStartedAt || now) >= FLOOR0_LATE_JOIN_GRACE_MS) {
      lobby.collapseAt = now + FLOOR0_LATE_JOIN_GRACE_MS;
      lobby.floor0CollapseAt = lobby.collapseAt;
    }
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
    lobby.floor0CollapseAt = Date.now();
    lobby.collapseAt = lobby.floor0CollapseAt;

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

    if (!advancingPlayers.length) return;

    this.startNextFloor(lobby, advancingPlayers, 1);
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
    if (!sanitized || sanitized.currentFloor !== lobby.floor) {
      player.crawlerState = null;
      this.broadcastCrawlerSnapshot(lobby, { force: true });
      return false;
    }

    player.crawlerState = {
      ...sanitized,
      id: player.id,
      name: player.name,
      color: player.profile?.color || sanitized.color || player.color,
      sprite: player.profile?.sprite || sanitized.sprite || "default",
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
    const currentRoomId = finiteNumber(state.currentRoomId);
    const dodgeProgress = finiteNumber(state.dodgeProgress);
    const pvpKills = finiteNumber(state.pvpKills);
    const knockbackX = finiteNumber(state.knockbackX);
    const knockbackY = finiteNumber(state.knockbackY);
    const knockbackFrames = finiteNumber(state.knockbackFrames);
    const knockbackUntil = finiteNumber(state.knockbackUntil);

    return {
      x,
      y,
      hp: Math.min(hp, maxHp),
      maxHp,
      currentFloor,
      status,
      ...(currentRoomId === null ? {} : { currentRoomId: Math.trunc(currentRoomId) }),
      ...(state.isDodging ? { isDodging: true } : {}),
      ...(dodgeProgress === null ? {} : { dodgeProgress: Math.max(0, Math.min(1, dodgeProgress)) }),
      ...(pvpKills === null ? {} : { pvpKills: Math.max(0, Math.trunc(pvpKills)) }),
      ...(typeof state.partyId === "string" ? { partyId: state.partyId.slice(0, 80) } : {}),
      ...(knockbackX === null ? {} : { knockbackX }),
      ...(knockbackY === null ? {} : { knockbackY }),
      ...(knockbackFrames === null ? {} : { knockbackFrames: Math.max(0, Math.trunc(knockbackFrames)) }),
      ...(knockbackUntil === null ? {} : { knockbackUntil }),
      ...(aimX === null ? {} : { aimX }),
      ...(aimY === null ? {} : { aimY }),
      name: this.sanitizePlayerName(state.name),
      sprite: String(state.sprite || "default").slice(0, 32) || "default",
      color: String(state.color || "blue").slice(0, 32) || "blue"
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
      currentFloor: lobby.floor,
      players: lobby.players
        .filter(player => player.crawlerState?.currentFloor === lobby.floor)
        .map(player => ({
          ...player.crawlerState,
          floor0Status: player.floor0Status || FLOOR0_ADVANCE_STATUSES.EXPLORING
        }))
    });
  }

  handleFloor0WorldEvent(playerId, event) {
    const client = this.requireClient(playerId);
    if (!client.lobbyCode) return false;
    const lobby = this.lobbies.get(client.lobbyCode);
    if (!lobby || !event || typeof event !== "object") return false;

    const normalized = this.applyFloor0WorldEvent(lobby, event);
    if (!normalized) return false;

    this.broadcast(lobby, SERVER_MESSAGES.FLOOR0_WORLD_EVENT, {
      lobbyCode: lobby.code,
      runId: lobby.runId,
      currentFloor: lobby.floor,
      event: normalized
    });
    return true;
  }

  applyFloor0WorldEvent(lobby, event) {
    const world = this.currentWorldState(lobby);
    const type = String(event.type || "");
    const id = typeof event.id === "string" ? event.id.slice(0, 80) : null;
    if (!id) return null;

    if (type === "door_opened") {
      world.openedDoorIds.add(id);
      return { type, id };
    }
    if (type === "chest_opened") {
      world.openedChestIds.add(id);
      return { type, id };
    }
    if (type === "loot_taken") {
      world.takenLootIds.add(id);
      return { type, id };
    }
    if (type === "enemy_damaged" || type === "enemy_killed") {
      const state = this.sanitizeEnemyState(event.enemy || event);
      if (!state?.enemyId) return null;
      const existing = world.enemyStates.get(state.enemyId) || { enemyId: state.enemyId, alive: true };
      const merged = existing.alive === false
        ? { ...existing, ...state, alive: false, hp: 0 }
        : { ...existing, ...state, alive: type === "enemy_killed" ? false : state.alive };
      if (type === "enemy_killed") merged.hp = 0;
      world.enemyStates.set(merged.enemyId, merged);
      return { type, id: state.enemyId, enemy: { ...merged } };
    }
    return null;
  }

  updateFloor0EnemySnapshot(playerId, message) {
    const client = this.requireClient(playerId);
    if (!client.lobbyCode) return false;
    const lobby = this.lobbies.get(client.lobbyCode);
    if (!lobby) return false;

    const player = lobby.players.find(candidate => candidate.id === playerId);
    const roomId = Number.isFinite(Number(message.roomId)) ? Math.trunc(Number(message.roomId)) : player?.crawlerState?.currentRoomId;
    if (!Number.isFinite(roomId)) return false;

    const occupiedRooms = this.occupiedFloor0RoomIds(lobby);
    if (!occupiedRooms.has(roomId)) return false;

    const ownerPlayerId = this.floor0EnemySnapshotOwnerId(lobby, roomId);
    // Enemy movement is room-owner authoritative: only one crawler's local AI feeds snapshots for a room.
    // The sender never needs its own snapshot echoed back, which prevents solo-lobby rubber-banding.
    if (ownerPlayerId && ownerPlayerId !== playerId) return false;

    const world = this.currentWorldState(lobby);
    for (const raw of message.enemies || []) {
      const state = this.sanitizeEnemyState(raw);
      if (!state?.enemyId) continue;
      if (Number.isFinite(state.roomId) && state.roomId !== roomId) continue;
      const existing = world.enemyStates.get(state.enemyId) || { enemyId: state.enemyId, alive: true };
      if (existing.alive === false) continue;
      world.enemyStates.set(state.enemyId, { ...existing, ...state, roomId, ownerPlayerId: playerId, updatedAt: Date.now() });
    }

    this.broadcastFloor0EnemySnapshot(lobby, { ownerPlayerId, sourceRoomId: roomId });
    return true;
  }

  sanitizeEnemyState(raw) {
    if (!raw || typeof raw !== "object") return null;
    const enemyId = typeof raw.enemyId === "string" ? raw.enemyId.slice(0, 80) : (typeof raw.id === "string" ? raw.id.slice(0, 80) : null);
    if (!enemyId) return null;
    const finiteNumber = value => {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    const hp = finiteNumber(raw.hp);
    const maxHp = finiteNumber(raw.maxHp);
    const roomId = finiteNumber(raw.roomId);
    const x = finiteNumber(raw.x);
    const y = finiteNumber(raw.y);
    const knockbackX = finiteNumber(raw.knockbackX);
    const knockbackY = finiteNumber(raw.knockbackY);
    const knockbackFrames = finiteNumber(raw.knockbackFrames);
    const knockbackUntil = finiteNumber(raw.knockbackUntil);
    return {
      enemyId,
      alive: raw.alive === false || hp === 0 ? false : true,
      ...(hp === null ? {} : { hp: Math.max(0, hp) }),
      ...(maxHp === null ? {} : { maxHp: Math.max(1, maxHp) }),
      ...(roomId === null ? {} : { roomId: Math.trunc(roomId) }),
      ...(x === null ? {} : { x }),
      ...(y === null ? {} : { y }),
      ...(knockbackX === null ? {} : { knockbackX }),
      ...(knockbackY === null ? {} : { knockbackY }),
      ...(knockbackFrames === null ? {} : { knockbackFrames: Math.max(0, Math.trunc(knockbackFrames)) }),
      ...(knockbackUntil === null ? {} : { knockbackUntil }),
      ...(typeof raw.status === "string" ? { status: raw.status.slice(0, 32) } : {})
    };
  }

  occupiedFloor0RoomIds(lobby) {
    const rooms = new Set();
    for (const player of lobby.players) {
      if (player.crawlerState?.currentFloor !== lobby.floor) continue;
      const roomId = Number(player.crawlerState.currentRoomId);
      if (Number.isFinite(roomId)) rooms.add(Math.trunc(roomId));
    }
    return rooms;
  }

  floor0EnemySnapshotOwnerId(lobby, roomId) {
    const normalizedRoomId = Math.trunc(Number(roomId));
    const occupants = lobby.players
      .filter(player => player.crawlerState?.currentFloor === lobby.floor && Math.trunc(Number(player.crawlerState.currentRoomId)) === normalizedRoomId)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    return occupants[0]?.id || null;
  }

  broadcastFloor0EnemySnapshot(lobby, { force = false, ownerPlayerId = null, sourceRoomId = null } = {}) {
    if (!lobby || !lobby.players.length) return;
    const now = Date.now();
    const elapsed = now - (lobby.lastEnemySnapshotAt || 0);
    if (!force && elapsed < FLOOR0_ENEMY_SNAPSHOT_MS) {
      if (!lobby.enemySnapshotTimer) {
        lobby.enemySnapshotTimer = setTimeout(() => {
          lobby.enemySnapshotTimer = null;
          this.broadcastFloor0EnemySnapshot(lobby, { force: true, ownerPlayerId, sourceRoomId });
        }, FLOOR0_ENEMY_SNAPSHOT_MS - elapsed);
      }
      return;
    }
    if (lobby.enemySnapshotTimer) {
      clearTimeout(lobby.enemySnapshotTimer);
      lobby.enemySnapshotTimer = null;
    }
    lobby.lastEnemySnapshotAt = now;
    const occupiedRooms = this.occupiedFloor0RoomIds(lobby);
    if (!occupiedRooms.size) return;
    const enemies = Array.from((this.currentWorldState(lobby).enemyStates || new Map()).values())
      .filter(enemy => enemy.alive !== false && Number.isFinite(Number(enemy.roomId)) && occupiedRooms.has(Math.trunc(Number(enemy.roomId))))
      .map(enemy => ({ ...enemy, ownerPlayerId: enemy.ownerPlayerId || ownerPlayerId || null }));
    if (!enemies.length) return;
    const payload = {
      lobbyCode: lobby.code,
      currentFloor: lobby.floor,
      activeRoomIds: Array.from(occupiedRooms),
      ownerPlayerId,
      sourcePlayerId: ownerPlayerId,
      enemies
    };
    for (const player of lobby.players) {
      const client = this.clients.get(player.id);
      if (client) safeSend(client.ws, SERVER_MESSAGES.FLOOR0_ENEMY_SNAPSHOT, payload);
    }
  }

  createFloorWorldState() {
    return {
      openedDoorIds: new Set(),
      openedChestIds: new Set(),
      takenLootIds: new Set(),
      enemyStates: new Map()
    };
  }

  floorWorldStatePayload(lobby, floor = lobby.floor) {
    const world = lobby.floorWorldStates?.get(floor) || this.currentWorldState(lobby);
    return {
      openedDoorIds: Array.from(world.openedDoorIds),
      openedChestIds: Array.from(world.openedChestIds),
      takenLootIds: Array.from(world.takenLootIds),
      enemyStates: Object.fromEntries(Array.from(world.enemyStates.entries()).map(([id, state]) => [id, { ...state }]))
    };
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
        color: player.profile?.color || player.color,
        sprite: player.profile?.sprite || "default",
        joinedAt: player.joinedAt,
        partyId: player.partyId || null,
        isPartyLeader: !!player.isPartyLeader,
        floor0Status: player.floor0Status || FLOOR0_ADVANCE_STATUSES.EXPLORING
      })),
      targetPlayers: TARGET_PLAYERS,
      status: lobby.status,
      stagingEndsAt: new Date(lobby.floor0CollapseAt).toISOString(),
      floor0CollapseAt: new Date(lobby.floor0CollapseAt).toISOString(),
      floor0: this.floor0Payload(lobby),
      runId: lobby.runId,
      floor: lobby.floor,
      floorSeed: lobby.floorSeed,
      joinState: lobby.joinState,
      collapseStartedAt: new Date(lobby.collapseStartedAt).toISOString(),
      collapseAt: new Date(lobby.collapseAt).toISOString(),
      floor0WorldState: this.floorWorldStatePayload(lobby),
      worldState: this.floorWorldStatePayload(lobby)
    };

    return payload;
  }


  playerStatusPayload(player) {
    return {
      id: player.id,
      name: player.name,
      color: player.profile?.color || player.color,
      sprite: player.profile?.sprite || "default",
      partyId: player.partyId || null,
      isPartyLeader: !!player.isPartyLeader,
      floor0Status: player.floor0Status || FLOOR0_ADVANCE_STATUSES.EXPLORING,
      reachedStairsAt: player.floor0ReachedStairsAt ? new Date(player.floor0ReachedStairsAt).toISOString() : null
    };
  }

  createFloor0Metadata(lobbyOrCode, collapseAt) {
    const lobby = typeof lobbyOrCode === "object" ? lobbyOrCode : null;
    const code = lobby?.code || lobbyOrCode;
    const seed = lobby?.floorSeed || this.makeFloorSeed(0);
    return {
      runId: lobby?.runId || null,
      floor: 0,
      seed,
      floorSeed: seed,
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
    lobby.collapseAt = lobby.floor0CollapseAt;
    if (!lobby.floor0) lobby.floor0 = this.createFloor0Metadata(lobby, lobby.floor0CollapseAt);
    lobby.floor0.seed = lobby.floorSeed;
    lobby.floor0.floorSeed = lobby.floorSeed;
    lobby.floor0.runId = lobby.runId;
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

  makeFloorSeed(floor = 0) {
    return `floor${Math.max(0, Math.trunc(Number(floor) || 0))}-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }

  makeFloor0Seed() {
    return this.makeFloorSeed(0);
  }

  currentWorldState(lobby) {
    if (!lobby.floorWorldStates) lobby.floorWorldStates = new Map();
    if (!lobby.floorWorldStates.has(lobby.floor)) lobby.floorWorldStates.set(lobby.floor, this.createFloorWorldState());
    lobby.worldState = lobby.floorWorldStates.get(lobby.floor);
    if (lobby.floor === 0) lobby.floor0WorldState = lobby.worldState;
    return lobby.worldState;
  }

  startNextFloor(lobby, advancingPlayers, floor) {
    lobby.floor = floor;
    lobby.floorSeed = this.makeFloorSeed(floor);
    lobby.joinState = "locked";
    lobby.status = "active";
    lobby.worldState = this.createFloorWorldState();
    lobby.floorWorldStates.set(floor, lobby.worldState);
    const spawnAssignments = this.assignSpawnPoints(lobby, advancingPlayers, floor);
    const roster = lobby.players.map(player => this.playerStatusPayload(player));
    for (const player of advancingPlayers) {
      const client = this.clients.get(player.id);
      if (client) safeSend(client.ws, SERVER_MESSAGES.FLOOR_START, {
        lobbyCode: lobby.code,
        runId: lobby.runId,
        floor,
        floorSeed: lobby.floorSeed,
        spawnAssignments,
        spawnAssignment: spawnAssignments[player.id] || null,
        worldState: this.floorWorldStatePayload(lobby, floor),
        players: roster
      });
    }
    this.broadcastLobbyUpdate(lobby);
  }

  assignSpawnPoints(lobby, players, floor = lobby.floor) {
    const assignments = {};
    const roster = (players?.length ? players : lobby.players) || [];
    roster.forEach((player, index) => {
      const offset = FLOOR0_SPAWN_OFFSETS[index % FLOOR0_SPAWN_OFFSETS.length];
      assignments[player.id] = {
        playerId: player.id,
        floor,
        slot: index,
        playerIndex: index,
        roomId: null,
        roomType: "normal",
        // Server does not own exact client dungeon geometry for Floor 1+.
        // These coordinates are stable hints only; clients validate and resolve
        // the slot to a valid generated room tile from the shared floor seed.
        x: floor === 0 ? 8 + offset.dx : null,
        y: floor === 0 ? 8 + offset.dy : null,
        dx: offset.dx,
        dy: offset.dy,
        tileBlocked: false,
        safeRoom: false,
        bossRoom: false,
        lockedRoom: false,
        stairwellRoom: false,
        exitRoom: false
      };
    });
    return assignments;
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
    if (lobby.enemySnapshotTimer) clearTimeout(lobby.enemySnapshotTimer);
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
