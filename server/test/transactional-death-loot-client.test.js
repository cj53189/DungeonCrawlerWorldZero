const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../src/multiplayer-session-auth.js'), 'utf8');

function createHarness() {
  const player = {
    coins: 73,
    inventory: [{ id: 'sword_1', name: 'Sword' }],
    equipment: { weapon: { id: 'axe_1', name: 'Axe' }, armor: null }
  };
  let clearCount = 0;

  const context = {
    multiplayerNetwork: { playerCorpseLootSent: false },
    multiplayer: { playerId: 'local_player', currentRunId: 'run_test' },
    currentFloor: 2,
    player,
    isLocalPlayerDead: () => true,
    capturePlayerCorpseLootSnapshot: () => ({
      coins: player.coins,
      inventory: player.inventory.map(item => ({ ...item })),
      equipment: Object.fromEntries(Object.entries(player.equipment).map(([slot, item]) => [slot, item ? { ...item } : null]))
    }),
    clearLocalLootAfterCorpseSnapshot: () => {
      clearCount += 1;
      player.coins = 0;
      player.inventory = [];
      for (const slot of Object.keys(player.equipment)) player.equipment[slot] = null;
    },
    captureLocalCrawlerNetworkState: () => {
      const state = { status: 'downed', hp: 0, currentFloor: 2 };
      if (!context.multiplayerNetwork.playerCorpseLootSent) {
        state.lootSnapshot = context.capturePlayerCorpseLootSnapshot();
        context.multiplayerNetwork.playerCorpseLootSent = true;
        context.clearLocalLootAfterCorpseSnapshot();
      }
      return state;
    },
    sendMultiplayerMessage: () => true,
    handleMultiplayerServerMessage: () => true,
    console
  };

  vm.runInNewContext(source, context, { filename: 'multiplayer-session-auth.js' });
  return { context, player, clearCount: () => clearCount };
}

test('downed crawler keeps loot through repeated/throttled state captures until server corpse confirmation', () => {
  const { context, player, clearCount } = createHarness();
  const first = context.captureLocalCrawlerNetworkState();
  assert.equal(first.lootSnapshot.coins, 73);
  assert.equal(player.coins, 73);
  assert.equal(clearCount(), 0);
  const retry = context.captureLocalCrawlerNetworkState();
  assert.equal(retry.lootSnapshot.coins, 73);
  assert.equal(player.coins, 73);
  assert.equal(clearCount(), 0);
  context.handleMultiplayerServerMessage({ type: 'player_corpse_created', runId: 'run_test', currentFloor: 2, corpse: { deadPlayerId: 'other_player', floor: 2 } });
  assert.equal(clearCount(), 0);
  context.handleMultiplayerServerMessage({ type: 'player_corpse_created', runId: 'old_run', currentFloor: 2, corpse: { deadPlayerId: 'local_player', floor: 2 } });
  assert.equal(clearCount(), 0);
  context.handleMultiplayerServerMessage({ type: 'player_corpse_created', runId: 'run_test', currentFloor: 2, corpse: { deadPlayerId: 'local_player', floor: 2 } });
  assert.equal(clearCount(), 1);
  assert.equal(player.coins, 0);
  assert.equal(context.multiplayerNetwork.pendingDeathLootSnapshot, null);
  assert.equal(context.multiplayerNetwork.deathLootCommitted, true);
  context.handleMultiplayerServerMessage({ type: 'player_died', runId: 'run_test', currentFloor: 2, corpse: { deadPlayerId: 'local_player', floor: 2 } });
  assert.equal(clearCount(), 1);
});

test('floor start resets the death-loot transaction for the next life', () => {
  const { context, player, clearCount } = createHarness();
  context.captureLocalCrawlerNetworkState();
  context.handleMultiplayerServerMessage({ type: 'player_corpse_created', runId: 'run_test', currentFloor: 2, corpse: { deadPlayerId: 'local_player', floor: 2 } });
  assert.equal(clearCount(), 1);
  context.handleMultiplayerServerMessage({ type: 'floor_start', runId: 'run_test', currentFloor: 3, floor: 3 });
  assert.equal(context.multiplayerNetwork.deathLootCommitted, false);
  assert.equal(context.multiplayerNetwork.playerCorpseLootSent, false);
  player.coins = 25;
  player.inventory = [{ id: 'new_item' }];
  context.currentFloor = 3;
  const nextDeath = context.captureLocalCrawlerNetworkState();
  assert.equal(nextDeath.lootSnapshot.coins, 25);
  assert.equal(player.coins, 25);
  assert.equal(clearCount(), 1);
});
