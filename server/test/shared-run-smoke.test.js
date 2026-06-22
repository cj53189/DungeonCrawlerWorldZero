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
  assert.deepEqual(Object.keys(floorStarts[0].spawnAssignments).sort(), ['player_a', 'player_b']);
  assert.notEqual(floorStarts[0].spawnAssignments.player_a.slot, floorStarts[0].spawnAssignments.player_b.slot);
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
  assert.equal(last(returning, 'floor_start').spawnAssignment.playerId, 'player_a');

  const stranger = ws();
  assert.equal(manager.reconnectClient(stranger, 'player_x', run.runId), false);
  assert.equal(manager.reconnectClient(stranger, 'player_a', 'missing_run'), false);

  manager.destroyLobby(run);
});

test('PvP damage applies on Floor 1 and blocks same-party friendly fire', () => {
  const manager = new LobbyManager();
  const a = addClient(manager, 'player_a');
  const b = addClient(manager, 'player_b');
  const c = addClient(manager, 'player_c');
  const run = manager.joinQuickMatch('player_a');
  manager.joinQuickMatch('player_b');
  manager.joinQuickMatch('player_c');
  manager.markCrawlerAtFloor0Stairs('player_a');
  manager.markCrawlerAtFloor0Stairs('player_b');
  manager.markCrawlerAtFloor0Stairs('player_c');
  manager.resolveFloor0Collapse(run.code);

  manager.updateCrawlerState('player_a', { x: 100, y: 100, hp: 100, maxHp: 100, currentFloor: 1, status: 'active', pvpKills: 0 });
  manager.updateCrawlerState('player_b', { x: 130, y: 100, hp: 100, maxHp: 100, currentFloor: 1, status: 'active', pvpKills: 0 });
  manager.handlePvpDamage('player_a', { targetPlayerId: 'player_b', damage: 35, floor: 1, knockback: { x: 6, y: 0 } });

  const target = run.players.find(player => player.id === 'player_b');
  assert.equal(target.crawlerState.hp, 65);
  assert.equal(target.crawlerState.status, 'active');
  assert.equal(last(a, 'pvp_damage_applied').targetPlayerId, 'player_b');
  assert.equal(last(b, 'pvp_damage_applied').hp, 65);

  const playerA = run.players.find(player => player.id === 'player_a');
  const playerC = run.players.find(player => player.id === 'player_c');
  playerA.partyId = 'party:test';
  playerC.partyId = 'party:test';
  manager.updateCrawlerState('player_c', { x: 145, y: 100, hp: 100, maxHp: 100, currentFloor: 1, status: 'active', partyId: 'party:test' });
  manager.handlePvpDamage('player_a', { targetPlayerId: 'player_c', damage: 35, floor: 1 });
  assert.equal(playerC.crawlerState.hp, 100);
  assert.match(last(a, 'error').message, /same party/);

  manager.destroyLobby(run);
});

test('PvP down awards kill credit once and resists stale victim snapshots', () => {
  const manager = new LobbyManager();
  const a = addClient(manager, 'player_a');
  addClient(manager, 'player_b');
  const run = manager.joinQuickMatch('player_a');
  manager.joinQuickMatch('player_b');
  manager.markCrawlerAtFloor0Stairs('player_a');
  manager.markCrawlerAtFloor0Stairs('player_b');
  manager.resolveFloor0Collapse(run.code);

  manager.updateCrawlerState('player_a', { x: 100, y: 100, hp: 100, maxHp: 100, currentFloor: 1, status: 'active', pvpKills: 0 });
  manager.updateCrawlerState('player_b', { x: 130, y: 100, hp: 20, maxHp: 100, currentFloor: 1, status: 'active', pvpKills: 0 });
  manager.handlePvpDamage('player_a', { targetPlayerId: 'player_b', damage: 25, floor: 1 });

  const attacker = run.players.find(player => player.id === 'player_a');
  const target = run.players.find(player => player.id === 'player_b');
  assert.equal(attacker.crawlerState.pvpKills, 1);
  assert.equal(target.crawlerState.status, 'downed');
  assert.equal(last(a, 'pvp_damage_applied').attackerPvpKills, 1);

  manager.handlePvpDamage('player_a', { targetPlayerId: 'player_b', damage: 25, floor: 1 });
  assert.equal(attacker.crawlerState.pvpKills, 1);

  manager.updateCrawlerState('player_b', { x: 130, y: 100, hp: 100, maxHp: 100, currentFloor: 1, status: 'active', pvpKills: 0 });
  assert.equal(target.crawlerState.hp, 0);
  assert.equal(target.crawlerState.status, 'downed');

  manager.destroyLobby(run);
});

test('Floor 1 spawn assignments group parties and separate solos by room slot', () => {
  const manager = new LobbyManager();
  for (const id of ['player_a', 'player_b', 'player_c', 'player_d']) addClient(manager, id);
  const run = manager.createLobby({ code: 'TEST-PARTY', mode: 'quick_match' });
  manager.addPlayerToLobby(run, manager.clients.get('player_a'), { partyId: 'party_one' });
  manager.addPlayerToLobby(run, manager.clients.get('player_b'), { partyId: 'party_one' });
  manager.addPlayerToLobby(run, manager.clients.get('player_c'), { partyId: null });
  manager.addPlayerToLobby(run, manager.clients.get('player_d'), { partyId: null });

  const assignments = manager.assignSpawnPoints(run, run.players, 1);
  assert.equal(assignments.player_a.groupId, 'party_one');
  assert.equal(assignments.player_b.groupId, 'party_one');
  assert.equal(assignments.player_a.roomSlot, assignments.player_b.roomSlot);
  assert.notEqual(assignments.player_a.groupMemberIndex, assignments.player_b.groupMemberIndex);
  assert.notEqual(`${assignments.player_a.dx},${assignments.player_a.dy}`, `${assignments.player_b.dx},${assignments.player_b.dy}`);
  assert.notEqual(assignments.player_c.roomSlot, assignments.player_a.roomSlot);
  assert.notEqual(assignments.player_d.roomSlot, assignments.player_c.roomSlot);
  for (const assignment of Object.values(assignments)) {
    assert.equal(assignment.floor, 1);
    assert.equal(assignment.safeRoom, false);
    assert.equal(assignment.bossRoom, false);
    assert.equal(assignment.lockedRoom, false);
    assert.equal(assignment.stairwellRoom, false);
    assert.equal(assignment.exitRoom, false);
  }
  manager.destroyLobby(run);
});

test('player corpses persist until server-authoritative loot is fully taken', () => {
  const manager = new LobbyManager();
  const a = addClient(manager, 'player_a');
  const b = addClient(manager, 'player_b');
  const run = manager.joinQuickMatch('player_a');
  manager.joinQuickMatch('player_b');
  manager.markCrawlerAtFloor0Stairs('player_a');
  manager.markCrawlerAtFloor0Stairs('player_b');
  manager.resolveFloor0Collapse(run.code);

  manager.updateCrawlerState('player_a', {
    x: 160,
    y: 192,
    hp: 0,
    maxHp: 100,
    currentFloor: 1,
    status: 'downed',
    currentRoomId: 7,
    lootSnapshot: {
      coins: 42,
      inventory: [{ id: 'box_1', type: 'lootbox', name: 'Lost Box', rarity: 'Rare' }],
      equipment: { weapon: { id: 'sword_1', type: 'weapon', name: 'Test Sword', damage: 9, rarity: 'Common' } }
    }
  });

  const created = last(b, 'player_corpse_created');
  assert.equal(created.corpse.deadPlayerId, 'player_a');
  assert.equal(created.corpse.deadPlayerName, 'player_a');
  assert.equal(created.corpse.floor, 1);
  assert.equal(created.corpse.roomId, 7);
  assert.equal(created.corpse.loot.length, 3);
  assert.equal(manager.floorWorldStatePayload(run, 1).playerCorpses.length, 1);

  manager.handlePlayerCorpseLootTake('player_b', { corpseId: created.corpse.id, lootIndex: 0 });
  const partial = last(a, 'player_corpse_loot_taken');
  assert.equal(partial.loot[0].type, 'coins');
  assert.equal(partial.remainingLoot.length, 2);
  assert.equal(manager.floorWorldStatePayload(run, 1).playerCorpses[0].loot.length, 2);

  manager.handlePlayerCorpseLootTake('player_b', { corpseId: created.corpse.id, takeAll: true });
  assert.equal(last(a, 'player_corpse_looted').corpseId, created.corpse.id);
  assert.equal(manager.floorWorldStatePayload(run, 1).playerCorpses.length, 0);

  manager.destroyLobby(run);
});

test('PvP Arena quick match creates an active arena run and second arena player joins it', () => {
  const manager = new LobbyManager();
  const a = addClient(manager, 'arena_a');
  const b = addClient(manager, 'arena_b');

  const run = manager.joinQuickMatch('arena_a', { arena: true });
  assert.equal(run.mode, 'pvp_arena');
  assert.equal(run.floor, 1);
  assert.equal(run.joinState, 'open');
  assert.equal(run.status, 'active');
  assert.equal(run.floor0CollapseTimer, null);
  assert.match(run.floorSeed, /^floor1-/);

  const same = manager.joinQuickMatch('arena_b', { arena: true });
  assert.equal(same.runId, run.runId);
  assert.equal(run.players.length, 2);

  const startA = last(a, 'floor_start');
  const startB = last(b, 'floor_start');
  assert.equal(startA.mode, 'pvp_arena');
  assert.equal(startB.mode, 'pvp_arena');
  assert.equal(startA.floor, 1);
  assert.equal(startA.joinState, 'open');
  assert.ok(startB.spawnAssignments.arena_a);
  assert.ok(startB.spawnAssignments.arena_b);
  assert.equal(startB.spawnAssignments.arena_a.safeRoom, false);
  assert.equal(startB.spawnAssignments.arena_b.bossRoom, false);
  assert.equal(run.floor0CollapseAt, null);

  manager.destroyLobby(run);
});

test('PvP Arena damage uses PvP rules and blocks same-party friendly fire', () => {
  const manager = new LobbyManager();
  const a = addClient(manager, 'arena_a');
  addClient(manager, 'arena_b');
  addClient(manager, 'arena_c');
  const run = manager.joinQuickMatch('arena_a', { arena: true });
  manager.joinQuickMatch('arena_b', { arena: true });
  manager.joinQuickMatch('arena_c', { arena: true });

  manager.updateCrawlerState('arena_a', { x: 100, y: 100, hp: 100, maxHp: 100, currentFloor: 1, status: 'active', pvpKills: 0 });
  manager.updateCrawlerState('arena_b', { x: 130, y: 100, hp: 100, maxHp: 100, currentFloor: 1, status: 'active', pvpKills: 0 });
  manager.handlePvpDamage('arena_a', { targetPlayerId: 'arena_b', damage: 30, floor: 1 });
  assert.equal(run.players.find(player => player.id === 'arena_b').crawlerState.hp, 70);

  const playerA = run.players.find(player => player.id === 'arena_a');
  const playerC = run.players.find(player => player.id === 'arena_c');
  playerA.partyId = 'party:arena';
  playerC.partyId = 'party:arena';
  manager.updateCrawlerState('arena_c', { x: 150, y: 100, hp: 100, maxHp: 100, currentFloor: 1, status: 'active', partyId: 'party:arena' });
  manager.handlePvpDamage('arena_a', { targetPlayerId: 'arena_c', damage: 30, floor: 1 });
  assert.equal(playerC.crawlerState.hp, 100);
  assert.match(last(a, 'error').message, /same party/);

  manager.destroyLobby(run);
});

test('private lobby creation does not join quick match', () => {
  const manager = new LobbyManager();
  const a = addClient(manager, 'private_a');
  const b = addClient(manager, 'private_b');

  const privateRun = manager.createPrivateLobby('private_a');
  const quickRun = manager.joinQuickMatch('private_b');

  assert.equal(privateRun.mode, 'private');
  assert.notEqual(privateRun.code, quickRun.code);
  assert.match(last(a, 'lobby_created').lobbyCode, /^RUNE-/);
  assert.equal(last(a, 'lobby_joined').mode, 'private');
  assert.equal(last(b, 'lobby_joined').mode, 'quick_match');

  manager.destroyLobby(privateRun);
  manager.destroyLobby(quickRun);
});

test('Floor 0 world events are idempotent by eventId', () => {
  const manager = new LobbyManager();
  addClient(manager, 'event_a');
  const run = manager.joinQuickMatch('event_a');

  assert.equal(manager.handleFloor0WorldEvent('event_a', {
    type: 'loot_taken',
    id: 'floor0:loot:1,2',
    eventId: 'loot-once',
    runId: run.runId,
    currentFloor: 0,
    clientSeq: 1
  }), true);
  assert.equal(manager.handleFloor0WorldEvent('event_a', {
    type: 'loot_taken',
    id: 'floor0:loot:1,2',
    eventId: 'loot-once',
    runId: run.runId,
    currentFloor: 0,
    clientSeq: 2
  }), false);
  assert.deepEqual(Array.from(run.worldState.takenLootIds), ['floor0:loot:1,2']);

  manager.destroyLobby(run);
});

test('player corpse and coin loot IDs are collision-resistant UUID-based IDs', () => {
  const manager = new LobbyManager();
  addClient(manager, 'player_a');
  addClient(manager, 'player_b');
  const run = manager.joinQuickMatch('player_a');
  manager.joinQuickMatch('player_b');
  manager.markCrawlerAtFloor0Stairs('player_a');
  manager.markCrawlerAtFloor0Stairs('player_b');
  manager.resolveFloor0Collapse(run.code);
  manager.updateCrawlerState('player_a', { x: 100, y: 100, hp: 0, maxHp: 100, currentFloor: 1, status: 'downed', currentRoomId: 7, lootSnapshot: { coins: 12 } });
  const created = last(manager.clients.get('player_b').ws, 'player_corpse_created');

  assert.match(created.corpse.id, /^player_corpse_[a-f0-9]{12}$/);
  assert.match(created.corpse.loot[0].id, /^coins_[a-f0-9]{12}$/);

  manager.destroyLobby(run);
});
