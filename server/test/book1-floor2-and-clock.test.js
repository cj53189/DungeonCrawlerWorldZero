const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const source = file => fs.readFileSync(path.join(root, file), "utf8");

function browserContext(extra = {}) {
  const context = { console, Math, Date, ...extra };
  context.window = context;
  context.globalThis = context;
  return vm.createContext(context);
}

test("Floor 2 is the six-real-day final tutorial, not a parking garage", () => {
  const context = browserContext();
  vm.runInContext(source("src/floor-identity-blueprints.js"), context);
  const floor2 = context.FLOOR_IDENTITY_BLUEPRINTS[2];
  assert.equal(floor2.name, "The Final Tutorial");
  assert.equal(floor2.durationDays, 6);
  assert.equal(floor2.source.book, 1);
  assert.match(floor2.uniqueEvent, /Brindle Grubs/);
  assert.doesNotMatch(JSON.stringify(floor2), /parking garage/i);
});

test("one dungeon day is exactly 24 real hours", () => {
  const context = browserContext({
    currentFloor: 2,
    floorTimeline: null,
    floorTimeLeft: 0,
    collapseStarted: false,
    warnedAt360: false,
    warnedAt240: false,
    warnedAt120: false,
    warnedAt60: false,
    warnedAt30: false,
    finalDescentAnnounced: false
  });
  vm.runInContext(source("src/run-state.js"), context);
  assert.equal(vm.runInContext("getDungeonDayDurationSeconds()", context), 86_400);
  assert.equal(vm.runInContext("getFloorTimeLimit(2)", context), 6 * 86_400);
  assert.equal(vm.runInContext("makeFloorTimeline(2, 1000).floorDeadlineAt", context), 1000 + 6 * 86_400 * 1000);
  assert.equal(vm.runInContext("floorTimeline = makeFloorTimeline(2, 1000); getCurrentDungeonDay(1000 + 24 * 60 * 60 * 1000)", context), 2);
});

test("a fresh Floor 2 corpse seeds the Brindle ecology", () => {
  const stats = {};
  const context = browserContext({
    currentFloor: 2,
    multiplayer: { enabled: false },
    player: { level: 1, x: 0, y: 0 },
    enemies: [],
    corpses: [],
    stats,
    TILE: 48,
    rooms: [],
    bossRoom: null,
    roomForTile: () => ({ id: 7 })
  });
  vm.runInContext(source("src/floor2-ecology.js"), context);
  const corpse = { id: "corpse-1", x: 100, y: 100, r: 10 };
  context.onCorpseCreatedForFloorEcology(corpse);
  assert.equal(corpse.ecologyProcessed, true);
  assert.ok(context.enemies.length >= 1 && context.enemies.length <= 3);
  assert.ok(context.enemies.every(enemy => enemy.name === "Brindle Grub" && enemy.floor2Ecology));
  assert.equal(stats.corpsesCreated, 1);
  assert.equal(stats.grubsSpawned, context.enemies.length);
});
