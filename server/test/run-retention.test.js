const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DISCONNECTED_RUN_RETENTION_MS,
  RESOLVED_RUN_RETENTION_MS,
  applyRunRetentionExtension
} = require('../src/run-retention-extension');
const { LOBBY_STATUS } = require('../src/protocol');

class StubLobbyManager {
  constructor() {
    this.clients = new Map();
    this.lobbies = new Map();
    this.destroyed = [];
  }

  cleanupEmptyLobbies() {
    for (const lobby of Array.from(this.lobbies.values())) {
      if (!lobby.players.length) this.destroyLobby(lobby);
    }
  }

  destroyLobby(lobby) {
    this.destroyed.push(lobby.code);
    this.lobbies.delete(lobby.code);
  }
}

applyRunRetentionExtension(StubLobbyManager);

function openWs() {
  return { readyState: 1, OPEN: 1, send() {} };
}

function closedWs() {
  return { readyState: 3, OPEN: 1, send() {} };
}

function addRun(manager, {
  code,
  floor = 1,
  status = 'active',
  joinState = 'locked',
  createdAt = Date.now(),
  floor0CollapseAt = null,
  players = []
}) {
  const lobby = { code, floor, status, joinState, createdAt, floor0CollapseAt, players: players.map(player => ({ id: player.id })) };
  manager.lobbies.set(code, lobby);
  for (const player of players) {
    manager.clients.set(player.id, {
      playerId: player.id,
      lobbyCode: code,
      ws: player.connected ? openWs() : closedWs(),
      disconnectedAt: player.disconnectedAt ?? null
    });
  }
  return lobby;
}

test('resolved Floor 0 run expires after bounded recap retention and detaches connected clients', () => {
  const manager = new StubLobbyManager();
  const now = Date.now();
  const lobby = addRun(manager, {
    code: 'RESOLVED-OLD',
    floor: 0,
    status: LOBBY_STATUS.START_PENDING,
    joinState: 'open',
    floor0CollapseAt: now - RESOLVED_RUN_RETENTION_MS - 1,
    players: [{ id: 'p1', connected: true }]
  });

  manager.cleanupEmptyLobbies();

  assert.equal(manager.lobbies.has(lobby.code), false);
  assert.equal(manager.clients.has('p1'), true, 'connected crawler remains a usable connection');
  assert.equal(manager.clients.get('p1').lobbyCode, null, 'expired run cannot leave a stale lobby binding');
});

test('freshly resolved run remains available during recap retention', () => {
  const manager = new StubLobbyManager();
  const lobby = addRun(manager, {
    code: 'RESOLVED-FRESH',
    floor: 0,
    status: LOBBY_STATUS.START_PENDING,
    joinState: 'open',
    floor0CollapseAt: Date.now(),
    players: [{ id: 'p1', connected: true }]
  });

  manager.cleanupEmptyLobbies();
  assert.equal(manager.lobbies.has(lobby.code), true);
  assert.equal(manager.clients.get('p1').lobbyCode, lobby.code);
});

test('fully disconnected active run expires after reconnect retention', () => {
  const manager = new StubLobbyManager();
  const disconnectedAt = Date.now() - DISCONNECTED_RUN_RETENTION_MS - 1;
  const lobby = addRun(manager, {
    code: 'LOCKED-OLD',
    floor: 2,
    status: 'active',
    joinState: 'locked',
    createdAt: disconnectedAt - 1000,
    players: [
      { id: 'p1', connected: false, disconnectedAt },
      { id: 'p2', connected: false, disconnectedAt: disconnectedAt - 500 }
    ]
  });

  manager.cleanupEmptyLobbies();

  assert.equal(manager.lobbies.has(lobby.code), false);
  assert.equal(manager.clients.has('p1'), false, 'expired disconnected session record is released');
  assert.equal(manager.clients.has('p2'), false, 'all stale disconnected session records are released');
});

test('disconnected run remains during its reconnect window', () => {
  const manager = new StubLobbyManager();
  const lobby = addRun(manager, {
    code: 'LOCKED-RECENT',
    floor: 2,
    status: 'active',
    joinState: 'locked',
    createdAt: Date.now() - 60_000,
    players: [{ id: 'p1', connected: false, disconnectedAt: Date.now() - 60_000 }]
  });

  manager.cleanupEmptyLobbies();
  assert.equal(manager.lobbies.has(lobby.code), true);
  assert.equal(manager.clients.has('p1'), true);
});

test('one connected crawler protects an active run from disconnected-run expiry', () => {
  const manager = new StubLobbyManager();
  const old = Date.now() - DISCONNECTED_RUN_RETENTION_MS - 60_000;
  const lobby = addRun(manager, {
    code: 'LOCKED-LIVE',
    floor: 3,
    status: 'active',
    joinState: 'locked',
    createdAt: old,
    players: [
      { id: 'connected', connected: true },
      { id: 'gone', connected: false, disconnectedAt: old }
    ]
  });

  manager.cleanupEmptyLobbies();
  assert.equal(manager.lobbies.has(lobby.code), true);
  assert.equal(manager.clients.get('connected').lobbyCode, lobby.code);
});
