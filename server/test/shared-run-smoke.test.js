const test = require('node:test');
const assert = require('node:assert/strict');
const { LobbyManager } = require('../src/rooms');
const { applyQuickPartyExtension } = require('../src/quick-party-extension');

applyQuickPartyExtension(LobbyManager);

function ws() {
  return { OPEN: 1, readyState: 1, sent: [], send(raw) { this.sent.push(JSON.parse(raw)); } };
}

function addClient(manager, id) {
  const socket = ws();
  manager.registerClient(socket, id);
  manager.updateClientProfile(id, { name: id });
  return socket;
}

function last(socket, type) {
  return [...socket.sent].reverse().find(message => message.type === type);
}

test('quick match creates and shares an open Floor 0 server seed', () => {
  const manager = new LobbyManager();
  const a = addClient(manager, 'player_a');
  const b = addClient(manager, 'player_b');

  const run = manager.joinQuickMatch('player_a');
  assert.equal(run.floor, 0);
  assert.equal(run.joinState, 'open');
  assert.match(run.floorSeed, /^floor0-/);
  assert.equal(run.floor0.seed, run.floorSeed);

  const same = manager.joinQuickMatch('player_b');
  assert.equal(same.runId, run.runId);
  assert.equal(last(a, 'lobby_update').floor0.seed, run.floorSeed);
  assert.equal(last(b, 'lobby_update').floor0.seed, run.floorSeed);

  manager.destroyLobby(run);
});

test('Floor 0 late join timer only extends after 120 seconds elapsed', () => {
  const manager = new LobbyManager();
  addClient(manager, 'player_a');
  addClient(manager, 'player_b');
  addClient(manager, 'player_c');
  const run = manager.joinQuickMatch('player_a');
  const originalCollapseAt = run.floor0CollapseAt;

  run.collapseStartedAt = Date.now() - 119_000;
  manager.joinQuickMatch('player_b');
  assert.equal(run.floor0CollapseAt, originalCollapseAt);

  run.collapseStartedAt = Date.now() - 121_000;
  const before = Date.now();
  manager.joinQuickMatch('player_c');
  assert.ok(run.floor0CollapseAt >= before + 119_000);
  assert.ok(run.floor0CollapseAt <= Date.now() + 120_500);

  manager.destroyLobby(run);
});

test('Floor 0 resolution locks Floor 1 and quick match uses a different open Floor 0 run', () => {
  const manager = new LobbyManager();
  const a = addClient(manager, 'player_a');
  const b = addClient(manager, 'player_b');
  const c = addClient(manager, 'player_c');
  const run = manager.joinQuickMatch('player_a');
  manager.joinQuickMatch('player_b');
  manager.markCrawlerAtFloor0Stairs('player_a');
  manager.markCrawlerAtFloor0Stairs('player_b');
  manager.resolveFloor0Collapse(run.code);

  assert.equal(run.floor, 1);
  assert.equal(run.joinState, 'locked');
  assert.match(run.floorSeed, /^floor1-/);

  const floorStarts = [last(a, 'floor_start'), last(b, 'floor_start')];
  assert.equal(floorStarts[0].floorSeed, run.floorSeed);
  assert.equal(floorStarts[1].floorSeed, run.floorSeed);
  for (const start of floorStarts) {
    assert.equal(start.runId, run.runId);
    assert.ok(start.worldState);
    const assignment = start.spawnAssignments[start.type === 'noop' ? '' : start.players.find(p => p.id === start.spawnAssignment?.playerId)?.id] || start.spawnAssignment;
    assert.equal(assignment.safeRoom, false);
    assert.equal(assignment.bossRoom, false);
    assert.equal(assignment.lockedRoom, false);
    assert.equal(assignment.stairwellRoom, false);
    assert.equal(assignment.tileBlocked, false);
  }

  const newRun = manager.joinQuickMatch('player_c');
  assert.notEqual(newRun.runId, run.runId);
  assert.equal(newRun.floor, 0);
  assert.equal(newRun.joinState, 'open');

  manager.destroyLobby(run);
  manager.destroyLobby(newRun);
});

test('reconnect is allowed only for players already registered in a locked run', () => {
  const manager = new LobbyManager();
  addClient(manager, 'player_a');
  const run = manager.joinQuickMatch('player_a');
  manager.markCrawlerAtFloor0Stairs('player_a');
  manager.resolveFloor0Collapse(run.code);

  const returning = ws();
  assert.equal(manager.reconnectClient(returning, 'player_a', run.runId), true);
  assert.equal(last(returning, 'floor_start').floorSeed, run.floorSeed);

  const stranger = ws();
  assert.equal(manager.reconnectClient(stranger, 'player_x', run.runId), false);
  assert.equal(manager.reconnectClient(stranger, 'player_a', 'missing_run'), false);

  manager.destroyLobby(run);
});
