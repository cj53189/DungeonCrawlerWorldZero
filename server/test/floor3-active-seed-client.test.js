const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const floor3Source = fs.readFileSync(path.resolve(__dirname, '../../src/roaming-boss-sight-aggro.js'), 'utf8');
const dungeonSource = fs.readFileSync(path.resolve(__dirname, '../../src/dungeon.js'), 'utf8');

test('Floor 3 uses the canonical active dungeon seed helper', () => {
  const wrapperStart = floor3Source.indexOf('generateDungeon = function generateDungeonWithFloor3BroadcastDistrict()');
  assert.notEqual(wrapperStart, -1, 'expected Floor 3 generateDungeon wrapper');
  const wrapper = floor3Source.slice(wrapperStart, floor3Source.indexOf('generateDungeon.__floor3BroadcastDistrictWrapped', wrapperStart));

  assert.match(wrapper, /getActiveDungeonSeed\(\)/);
  assert.doesNotMatch(wrapper, /getSharedMultiplayerFloorSeed\(\)/);
});

test('active dungeon seed falls back to the Single Player floor seed', () => {
  const helperStart = dungeonSource.indexOf('function getActiveDungeonSeed()');
  assert.notEqual(helperStart, -1, 'expected getActiveDungeonSeed helper');
  const helper = dungeonSource.slice(helperStart, dungeonSource.indexOf('\n}', helperStart) + 2);

  assert.match(helper, /getSharedMultiplayerFloorSeed\(\)/);
  assert.match(helper, /singlePlayerDungeonSeed/);
  assert.match(helper, /createSinglePlayerDungeonSeed\(\)/);
});
