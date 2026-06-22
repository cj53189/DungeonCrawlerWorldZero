const test = require("node:test");
const assert = require("node:assert/strict");

const { LobbyManager } = require("../src/rooms");
const { LOBBY_MODES } = require("../src/protocol");
const { applySharedLootExtension } = require("../src/shared-loot-extension");

applySharedLootExtension(LobbyManager);

function fakeWs() {
  return {
    readyState: 1,
    OPEN: 1,
    sent: [],
    send(message) {
      this.sent.push(JSON.parse(message));
    }
  };
}

function makeLobbyWithRoomOwner() {
  const manager = new LobbyManager();
  const lobby = manager.createLobby({ code: "TEST-ENEMY", mode: LOBBY_MODES.PRIVATE });
  const ws = fakeWs();
  manager.clients.set("p1", { playerId: "p1", lobbyCode: lobby.code, name: "Tester", ws });
  lobby.players.push({
    id: "p1",
    name: "Tester",
    joinedAt: 1,
    crawlerState: { currentFloor: 0, currentRoomId: 7 },
    lastClientSeqByType: new Map()
  });
  return { manager, lobby, ws };
}

test("enemy damage is monotonic and cannot heal through later events", () => {
  const { manager, lobby } = makeLobbyWithRoomOwner();

  const first = manager.applyFloor0WorldEvent(lobby, {
    type: "enemy_damaged",
    id: "enemy_a",
    eventId: "enemy_damaged:enemy_a:1",
    enemy: { enemyId: "enemy_a", hp: 80, maxHp: 100, roomId: 7, x: 10, y: 10 }
  });
  assert.equal(first.enemy.hp, 80);

  const stale = manager.applyFloor0WorldEvent(lobby, {
    type: "enemy_damaged",
    id: "enemy_a",
    eventId: "enemy_damaged:enemy_a:2",
    enemy: { enemyId: "enemy_a", hp: 95, maxHp: 100, roomId: 7, x: 11, y: 10 }
  });

  assert.equal(stale.enemy.hp, 80);
  assert.equal(manager.currentWorldState(lobby).enemyStates.get("enemy_a").hp, 80);
});

test("enemy death is final against later damage and snapshots", () => {
  const { manager, lobby } = makeLobbyWithRoomOwner();

  const killed = manager.applyFloor0WorldEvent(lobby, {
    type: "enemy_killed",
    id: "enemy_b",
    eventId: "enemy_killed:enemy_b:1",
    enemy: { enemyId: "enemy_b", hp: 0, maxHp: 100, roomId: 7, x: 10, y: 10 }
  });
  assert.equal(killed.enemy.alive, false);
  assert.equal(killed.enemy.hp, 0);

  const laterDamage = manager.applyFloor0WorldEvent(lobby, {
    type: "enemy_damaged",
    id: "enemy_b",
    eventId: "enemy_damaged:enemy_b:2",
    enemy: { enemyId: "enemy_b", hp: 50, maxHp: 100, roomId: 7, x: 12, y: 10 }
  });
  assert.equal(laterDamage.enemy.alive, false);
  assert.equal(laterDamage.enemy.hp, 0);

  manager.updateFloor0EnemySnapshot("p1", {
    type: "floor0_enemy_snapshot",
    runId: lobby.runId,
    currentFloor: 0,
    floor: 0,
    roomId: 7,
    enemies: [{ enemyId: "enemy_b", hp: 100, maxHp: 100, alive: true, roomId: 7, x: 20, y: 20 }]
  });

  const stored = manager.currentWorldState(lobby).enemyStates.get("enemy_b");
  assert.equal(stored.alive, false);
  assert.equal(stored.hp, 0);
});

test("enemy snapshots cannot roll hp above server-held damage", () => {
  const { manager, lobby } = makeLobbyWithRoomOwner();

  manager.applyFloor0WorldEvent(lobby, {
    type: "enemy_damaged",
    id: "enemy_c",
    eventId: "enemy_damaged:enemy_c:1",
    enemy: { enemyId: "enemy_c", hp: 40, maxHp: 100, roomId: 7, x: 10, y: 10 }
  });

  manager.updateFloor0EnemySnapshot("p1", {
    type: "floor0_enemy_snapshot",
    runId: lobby.runId,
    currentFloor: 0,
    floor: 0,
    roomId: 7,
    enemies: [{ enemyId: "enemy_c", hp: 90, maxHp: 100, alive: true, roomId: 7, x: 30, y: 30 }]
  });

  const stored = manager.currentWorldState(lobby).enemyStates.get("enemy_c");
  assert.equal(stored.hp, 40);
  assert.equal(stored.alive, true);
});
