const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { applyPlayerAuthorityExtension } = require('../src/player-authority-extension');

class StubLobbyManager {
  constructor() {
    this.clients = new Map();
    this.lobbies = new Map();
  }

  addPlayerToLobby(lobby, client) {
    client.lobbyCode = lobby.code;
    lobby.players.push({
      id: client.playerId,
      crawlerState: null,
      lastPvpDownCredit: null,
      pvpDamageAuthorityUntil: 0
    });
  }

  startNextFloor(lobby, advancingPlayers, floor) {
    lobby.floor = floor;
    return advancingPlayers.length;
  }

  updateCrawlerState(playerId, state) {
    const client = this.clients.get(playerId);
    const lobby = this.lobbies.get(client.lobbyCode);
    const player = lobby.players.find(candidate => candidate.id === playerId);
    player.crawlerState = { ...state, id: playerId };
    return true;
  }

  handlePvpDamage(playerId, message = {}) {
    const client = this.clients.get(playerId);
    const lobby = this.lobbies.get(client.lobbyCode);
    const target = lobby.players.find(candidate => candidate.id === String(message.targetPlayerId || ''));
    if (!target?.crawlerState || target.crawlerState.status !== 'active' || target.crawlerState.hp <= 0) return false;
    const damage = Math.max(0, Number(message.damage) || 0);
    const hp = Math.max(0, target.crawlerState.hp - damage);
    target.crawlerState = {
      ...target.crawlerState,
      hp,
      status: hp <= 0 ? 'downed' : 'active'
    };
    target.pvpDamageAuthorityUntil = Date.now() + 2000;
    return true;
  }
}

applyPlayerAuthorityExtension(StubLobbyManager);

function createArena() {
  const manager = new StubLobbyManager();
  const lobby = { code: 'ARENA-1', floor: 1, players: [] };
  manager.lobbies.set(lobby.code, lobby);

  for (const id of ['attacker', 'target']) {
    const client = { playerId: id, lobbyCode: lobby.code, ws: { readyState: 3, OPEN: 1, send() {} } };
    manager.clients.set(id, client);
    manager.addPlayerToLobby(lobby, client);
    manager.updateCrawlerState(id, { hp: 100, maxHp: 100, status: 'active', currentFloor: 1, x: 10, y: 10 });
  }

  return {
    manager,
    lobby,
    attacker: lobby.players.find(player => player.id === 'attacker'),
    target: lobby.players.find(player => player.id === 'target')
  };
}

test('PvP down is final even after the legacy two-second authority window expires', () => {
  const { manager, target } = createArena();

  assert.equal(manager.handlePvpDamage('attacker', { targetPlayerId: 'target', damage: 100, floor: 1 }), true);
  assert.equal(target.crawlerState.hp, 0);
  assert.equal(target.crawlerState.status, 'downed');
  assert.equal(target.pvpDowned, true);

  // Reproduce the old exploit: once the temporary authority window elapsed, the
  // client could previously submit itself as alive again.
  target.pvpDamageAuthorityUntil = 0;
  assert.equal(manager.updateCrawlerState('target', {
    hp: 100,
    maxHp: 100,
    status: 'active',
    currentFloor: 1,
    x: 20,
    y: 20
  }), true);

  assert.equal(target.crawlerState.hp, 0);
  assert.equal(target.crawlerState.status, 'downed');
  assert.equal(target.pvpDowned, true);
});

test('downed crawlers cannot deal PvP damage', () => {
  const { manager, attacker, target } = createArena();

  manager.handlePvpDamage('attacker', { targetPlayerId: 'target', damage: 100, floor: 1 });
  const attackerHpBefore = attacker.crawlerState.hp;

  assert.equal(manager.handlePvpDamage('target', { targetPlayerId: 'attacker', damage: 40, floor: 1 }), false);
  assert.equal(attacker.crawlerState.hp, attackerHpBefore);

  // The rule also covers non-PvP downed state: status/hp are enough to forbid attacks.
  target.pvpDowned = false;
  target.crawlerState = { ...target.crawlerState, hp: 0, status: 'downed' };
  assert.equal(manager.handlePvpDamage('target', { targetPlayerId: 'attacker', damage: 40, floor: 1 }), false);
  assert.equal(attacker.crawlerState.hp, attackerHpBefore);
});

test('starting a new floor explicitly resets player life authority', () => {
  const { manager, lobby, target } = createArena();

  manager.handlePvpDamage('attacker', { targetPlayerId: 'target', damage: 100, floor: 1 });
  assert.equal(target.pvpDowned, true);

  manager.startNextFloor(lobby, [target], 2);
  assert.equal(target.pvpDowned, false);
  assert.equal(target.pvpDamageAuthorityUntil, 0);
  assert.equal(target.lastPvpDownCredit, null);

  manager.updateCrawlerState('target', {
    hp: 100,
    maxHp: 100,
    status: 'active',
    currentFloor: 2,
    x: 30,
    y: 30
  });
  assert.equal(target.crawlerState.hp, 100);
  assert.equal(target.crawlerState.status, 'active');
});

test('shared server extension chain installs player authority', () => {
  const sharedLootSource = fs.readFileSync(path.resolve(__dirname, '../src/shared-loot-extension.js'), 'utf8');
  assert.match(sharedLootSource, /require\("\.\/player-authority-extension"\)/);
  assert.match(sharedLootSource, /applyPlayerAuthorityExtension\(LobbyManager\)/);
});
