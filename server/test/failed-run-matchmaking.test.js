const test = require('node:test');
const assert = require('node:assert/strict');
const { LobbyManager } = require('../src/rooms');
const { applyQuickPartyExtension } = require('../src/quick-party-extension');
const { LOBBY_STATUS } = require('../src/protocol');

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

test('an all-failed Floor 0 run is not reused by the next Quick Match', () => {
  const manager = new LobbyManager();
  addClient(manager, 'player_a');
  addClient(manager, 'player_b');

  const failedRun = manager.joinQuickMatch('player_a');
  const failedRunId = failedRun.runId;

  manager.resolveFloor0Collapse(failedRun.code);

  assert.notEqual(failedRun.status, LOBBY_STATUS.STAGING);
  assert.equal(failedRun.floor, 0);
  assert.equal(failedRun.joinState, 'open');

  const nextRun = manager.joinQuickMatch('player_b');

  assert.notEqual(nextRun.runId, failedRunId);
  assert.equal(nextRun.status, LOBBY_STATUS.STAGING);
  assert.equal(nextRun.floor, 0);
  assert.equal(nextRun.joinState, 'open');
  assert.ok(Number.isFinite(nextRun.floor0CollapseAt));
  assert.ok(nextRun.floor0CollapseAt > Date.now());

  manager.destroyLobby(failedRun);
  manager.destroyLobby(nextRun);
});
