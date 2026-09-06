const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const entitiesSource = fs.readFileSync(path.resolve(__dirname, '../../src/entities.js'), 'utf8');
const lootCorpseSource = entitiesSource.slice(entitiesSource.indexOf('function lootCorpse(corpse)'));

function makeContext(overrides = {}) {
  const calls = [];
  const context = {
    multiplayer: { playerId: 'local_player' },
    announcer(message) { calls.push({ type: 'announce', message }); },
    isCorpseGoldOnly(corpse) {
      return corpse?.loot?.length === 1 && corpse.loot[0]?.type === 'coins';
    },
    takeServerPlayerCorpseLoot(corpse, index, takeAll) {
      calls.push({ type: 'server_claim', corpse, index, takeAll });
    },
    autoLootGoldOnlyCorpse(corpse) {
      calls.push({ type: 'auto_loot', corpse });
      return true;
    },
    openCorpseLootWindow(corpse) {
      calls.push({ type: 'open_window', corpse });
    },
    ...overrides
  };
  vm.runInNewContext(lootCorpseSource, context, { filename: 'entities.js#lootCorpse' });
  return { context, calls };
}

test('gold-only player corpse uses the server claim before local auto-loot', () => {
  const { context, calls } = makeContext();
  const corpse = {
    id: 'player_corpse_1',
    playerCorpse: true,
    deadPlayerId: 'other_player',
    looted: false,
    loot: [{ type: 'coins', amount: 42 }]
  };

  context.lootCorpse(corpse);

  assert.deepEqual(calls.map(call => call.type), ['server_claim']);
  assert.equal(calls[0].index, 0);
  assert.equal(calls[0].takeAll, true);
});

test('ordinary gold-only corpse keeps the existing local auto-loot path', () => {
  const { context, calls } = makeContext();
  const corpse = {
    id: 'enemy_corpse_1',
    playerCorpse: false,
    looted: false,
    loot: [{ type: 'coins', amount: 7 }]
  };

  context.lootCorpse(corpse);

  assert.deepEqual(calls.map(call => call.type), ['auto_loot']);
});

test('a crawler still cannot loot its own player corpse', () => {
  const { context, calls } = makeContext();
  const corpse = {
    id: 'player_corpse_self',
    playerCorpse: true,
    deadPlayerId: 'local_player',
    looted: false,
    loot: [{ type: 'coins', amount: 99 }]
  };

  context.lootCorpse(corpse);

  assert.deepEqual(calls.map(call => call.type), ['announce']);
});
