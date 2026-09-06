const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const serverSource = fs.readFileSync(path.resolve(__dirname, '../src/shared-loot-extension.js'), 'utf8');
const clientSource = fs.readFileSync(path.resolve(__dirname, '../../src/shared-loot-sync.js'), 'utf8');

function loadServerExtension() {
  const context = {
    module: { exports: {} },
    exports: {},
    require(specifier) {
      if (specifier === 'crypto') return require('node:crypto');
      if (specifier === './protocol') return { SERVER_MESSAGES: { PLAYER_CORPSE_LOOT_TAKEN: 'player_corpse_loot_taken' } };
      if (specifier === './enemy-authority-extension') return { applyEnemyAuthorityExtension() {} };
      if (specifier === './player-authority-extension') return { applyPlayerAuthorityExtension() {} };
      throw new Error(`unexpected require: ${specifier}`);
    },
    console
  };
  vm.runInNewContext(serverSource, context, { filename: 'shared-loot-extension.js' });
  return context.module.exports.applySharedLootExtension;
}

class StubLobbyManager {
  constructor() {
    this.sent = [];
  }

  createFloorWorldState() {
    return { lootContainers: new Map(), takenLootIds: new Set() };
  }

  floorWorldStatePayload() {
    return {};
  }

  currentWorldState(lobby) {
    if (!lobby.worldState) lobby.worldState = this.createFloorWorldState();
    return lobby.worldState;
  }

  applyFloor0WorldEvent() {
    return null;
  }

  broadcast(lobby, type, payload) {
    this.sent.push({ lobby, type, payload });
    return true;
  }
}

test('server gives every successful corpse grant its own replay-safe identity', () => {
  const applySharedLootExtension = loadServerExtension();
  applySharedLootExtension(StubLobbyManager);
  const manager = new StubLobbyManager();
  const lobby = { code: 'TEST' };

  manager.broadcast(lobby, 'player_corpse_loot_taken', {
    corpseId: 'corpse_1',
    looterPlayerId: 'looter',
    loot: [{ id: 'item_a' }],
    remainingLoot: [{ id: 'item_b' }]
  });
  manager.broadcast(lobby, 'player_corpse_loot_taken', {
    corpseId: 'corpse_1',
    looterPlayerId: 'looter',
    loot: [{ id: 'item_b' }],
    remainingLoot: []
  });

  assert.equal(manager.sent.length, 2);
  const first = manager.sent[0].payload;
  const second = manager.sent[1].payload;
  assert.match(first.grantId, /^player_corpse_grant_[0-9a-f]+$/);
  assert.equal(first.eventId, first.grantId);
  assert.match(second.grantId, /^player_corpse_grant_[0-9a-f]+$/);
  assert.equal(second.eventId, second.grantId);
  assert.notEqual(first.grantId, second.grantId, 'distinct partial claims must not share an event/grant ID');

  manager.broadcast(lobby, 'player_corpse_loot_taken', first);
  assert.equal(manager.sent[2].payload.grantId, first.grantId, 'an already-stamped grant keeps its identity if it is rebroadcast');
});

function installClientGuard() {
  const corpse = { id: 'corpse_1', loot: [{ id: 'item_a' }, { id: 'item_b' }] };
  let awardCount = 0;
  let renderCount = 0;

  const context = {
    window: {},
    multiplayer: {
      enabled: true,
      usingServer: true,
      playerId: 'local',
      floor0WorldState: {
        openedDoorIds: new Set(),
        openedChestIds: new Set(),
        takenLootIds: new Set(),
        enemyStates: new Map(),
        lootContainers: new Map()
      }
    },
    multiplayerNetwork: {},
    currentFloor: 1,
    enemies: [],
    corpses: [corpse],
    bossEnemy: null,
    gameWon: false,
    gameLost: false,
    minimapDirty: false,
    activeLootCorpseId: corpse.id,
    getCorpseById(id) { return id === corpse.id ? corpse : null; },
    renderCorpseLootWindow() { renderCount += 1; },
    applyPlayerCorpseLootTaken(message) {
      if (message.looterPlayerId === 'local') awardCount += (message.loot || []).length;
      corpse.loot = (message.remainingLoot || []).map(item => ({ ...item }));
      return true;
    },
    setInterval() { return 1; },
    clearInterval() {},
    console
  };

  vm.runInNewContext(clientSource, context, { filename: 'shared-loot-sync.js' });
  return { context, corpse, awardCount: () => awardCount, renderCount: () => renderCount };
}

test('client awards a stamped corpse grant once and still applies replayed remainder state', () => {
  const { context, corpse, awardCount, renderCount } = installClientGuard();
  const message = {
    grantId: 'player_corpse_grant_abc123',
    eventId: 'player_corpse_grant_abc123',
    corpseId: 'corpse_1',
    looterPlayerId: 'local',
    loot: [{ id: 'item_a' }],
    remainingLoot: [{ id: 'item_b' }]
  };

  assert.equal(context.applyPlayerCorpseLootTaken(message), true);
  assert.equal(awardCount(), 1);
  assert.equal(corpse.loot.length, 1);

  // Make local presentation stale, then replay the same server message. The replay
  // must repair the remainder without re-awarding the granted item.
  corpse.loot = [{ id: 'item_a' }, { id: 'item_b' }];
  assert.equal(context.applyPlayerCorpseLootTaken(message), true);
  assert.equal(awardCount(), 1, 'replayed grant must not award twice');
  assert.deepEqual(Array.from(corpse.loot, item => item.id), ['item_b']);
  assert.ok(renderCount() >= 1);

  assert.equal(context.applyPlayerCorpseLootTaken({
    ...message,
    grantId: 'player_corpse_grant_def456',
    eventId: 'player_corpse_grant_def456',
    loot: [{ id: 'item_b' }],
    remainingLoot: []
  }), true);
  assert.equal(awardCount(), 2, 'a distinct valid grant must still award');
});

test('legacy loot messages without grantId are not falsely deduplicated', () => {
  const { context, awardCount } = installClientGuard();
  const legacy = {
    eventId: 'player_corpse_looted:corpse_1:local',
    corpseId: 'corpse_1',
    looterPlayerId: 'local',
    loot: [{ id: 'item_a' }],
    remainingLoot: [{ id: 'item_b' }]
  };

  context.applyPlayerCorpseLootTaken(legacy);
  context.applyPlayerCorpseLootTaken(legacy);
  assert.equal(awardCount(), 2, 'old eventId was not unique per partial claim and must not be used as a dedup key');
});
