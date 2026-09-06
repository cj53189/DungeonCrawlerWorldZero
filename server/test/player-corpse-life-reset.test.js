const test = require('node:test');
const assert = require('node:assert/strict');

const { applyPlayerAuthorityExtension } = require('../src/player-authority-extension');

class StubLobbyManager {
  constructor() {
    this.clients = new Map();
    this.lobbies = new Map();
  }

  addPlayerToLobby(lobby, client) {
    client.lobbyCode = lobby.code;
    lobby.players.push({ id: client.playerId, crawlerState: null });
  }

  startNextFloor(lobby, advancingPlayers, floor) {
    lobby.floor = floor;
    return advancingPlayers.length;
  }

  updateCrawlerState() { return true; }
  handlePvpDamage() { return true; }
}

applyPlayerAuthorityExtension(StubLobbyManager);

test('fresh life clears the previous player corpse identity', () => {
  const manager = new StubLobbyManager();
  const lobby = { code: 'RUN', floor: 1, players: [] };
  const client = { playerId: 'crawler', lobbyCode: lobby.code };
  manager.clients.set(client.playerId, client);
  manager.lobbies.set(lobby.code, lobby);
  manager.addPlayerToLobby(lobby, client);

  const player = lobby.players[0];
  player.playerCorpseId = 'player_corpse_old_life';
  player.pvpDowned = true;
  player.pvpDamageAuthorityUntil = Date.now() + 2000;
  player.lastPvpDownCredit = 'attacker';

  manager.startNextFloor(lobby, [player], 2);

  assert.equal(player.playerCorpseId, null);
  assert.equal(player.pvpDowned, false);
  assert.equal(player.pvpDamageAuthorityUntil, 0);
  assert.equal(player.lastPvpDownCredit, null);
});
