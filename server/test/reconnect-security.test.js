const test = require('node:test');
const assert = require('node:assert/strict');
const { LobbyManager } = require('../src/rooms');
const { applyQuickPartyExtension } = require('../src/quick-party-extension');
const {
  authorizeReconnect,
  ensureResumeCredential,
  isCurrentPlayerSocket
} = require('../src/session-auth');

applyQuickPartyExtension(LobbyManager);

function ws() {
  return {
    OPEN: 1,
    readyState: 1,
    sent: [],
    send(raw) { this.sent.push(JSON.parse(raw)); },
    close(code, reason) {
      this.closeCode = code;
      this.closeReason = reason;
      this.readyState = 3;
    }
  };
}

function addClient(manager, id) {
  const socket = ws();
  manager.registerClient(socket, id);
  manager.updateClientProfile(id, { name: id });
  return { socket, credential: ensureResumeCredential(manager.clients.get(id)) };
}

function lockRun(manager, playerIds) {
  const run = manager.joinQuickMatch(playerIds[0]);
  for (const id of playerIds.slice(1)) manager.joinQuickMatch(id);
  for (const id of playerIds) manager.markCrawlerAtFloor0Stairs(id);
  manager.resolveFloor0Collapse(run.code);
  assert.equal(run.joinState, 'locked');
  return run;
}

function last(socket, type) {
  return [...socket.sent].reverse().find(message => message.type === type);
}

test('public player and run IDs are insufficient to reconnect', () => {
  const manager = new LobbyManager();
  const { credential } = addClient(manager, 'player_a');
  const run = lockRun(manager, ['player_a']);
  manager.unregisterClient('player_a');

  const attacker = ws();
  const result = authorizeReconnect(manager, attacker, {
    playerId: 'player_a',
    runId: run.runId
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_credential');
  assert.notEqual(credential, '');
  assert.notEqual(manager.clients.get('player_a').ws, attacker);
  manager.destroyLobby(run);
});

test('invalid and cross-player reconnect credentials are rejected', () => {
  const manager = new LobbyManager();
  addClient(manager, 'player_a');
  const playerB = addClient(manager, 'player_b');
  const run = lockRun(manager, ['player_a', 'player_b']);
  manager.unregisterClient('player_a');

  assert.equal(authorizeReconnect(manager, ws(), {
    playerId: 'player_a',
    runId: run.runId,
    resumeCredential: 'definitely-not-valid'
  }).ok, false);

  assert.equal(authorizeReconnect(manager, ws(), {
    playerId: 'player_a',
    runId: run.runId,
    resumeCredential: playerB.credential
  }).ok, false);

  manager.destroyLobby(run);
});

test('an active crawler cannot be displaced even with its valid credential', () => {
  const manager = new LobbyManager();
  const playerA = addClient(manager, 'player_a');
  const run = lockRun(manager, ['player_a']);
  const replacement = ws();

  const result = authorizeReconnect(manager, replacement, {
    playerId: 'player_a',
    runId: run.runId,
    resumeCredential: playerA.credential
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'session_active');
  assert.equal(manager.clients.get('player_a').ws, playerA.socket);
  assert.equal(isCurrentPlayerSocket(manager, 'player_a', playerA.socket), true);
  assert.equal(isCurrentPlayerSocket(manager, 'player_a', replacement), false);
  manager.destroyLobby(run);
});

test('a disconnected crawler reconnects with its credential and rotates it', () => {
  const manager = new LobbyManager();
  const playerA = addClient(manager, 'player_a');
  const run = lockRun(manager, ['player_a']);
  manager.unregisterClient('player_a');

  const returning = ws();
  const result = authorizeReconnect(manager, returning, {
    playerId: 'player_a',
    runId: run.runId,
    resumeCredential: playerA.credential
  });

  assert.equal(result.ok, true);
  assert.equal(result.playerId, 'player_a');
  assert.notEqual(result.resumeCredential, playerA.credential);
  assert.equal(manager.clients.get('player_a').resumeCredential, result.resumeCredential);
  assert.equal(isCurrentPlayerSocket(manager, 'player_a', returning), true);
  assert.equal(isCurrentPlayerSocket(manager, 'player_a', playerA.socket), false);
  assert.equal(last(returning, 'floor_start').floorSeed, run.floorSeed);

  manager.unregisterClient('player_a');
  const replay = authorizeReconnect(manager, ws(), {
    playerId: 'player_a',
    runId: run.runId,
    resumeCredential: playerA.credential
  });
  assert.equal(replay.ok, false);
  assert.equal(replay.reason, 'invalid_credential');
  manager.destroyLobby(run);
});

test('resume credentials are not exposed by lobby or floor player payloads', () => {
  const manager = new LobbyManager();
  const playerA = addClient(manager, 'player_a');
  const playerB = addClient(manager, 'player_b');
  const run = lockRun(manager, ['player_a', 'player_b']);

  const serializedLobby = JSON.stringify(last(playerA.socket, 'lobby_update'));
  const serializedFloor = JSON.stringify(last(playerB.socket, 'floor_start'));

  assert.equal(serializedLobby.includes(playerA.credential), false);
  assert.equal(serializedLobby.includes(playerB.credential), false);
  assert.equal(serializedLobby.includes('resumeCredential'), false);
  assert.equal(serializedFloor.includes(playerA.credential), false);
  assert.equal(serializedFloor.includes(playerB.credential), false);
  assert.equal(serializedFloor.includes('resumeCredential'), false);
  manager.destroyLobby(run);
});
