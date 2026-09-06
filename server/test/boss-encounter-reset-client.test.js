const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runStateSource = fs.readFileSync(path.resolve(__dirname, '../../src/run-state.js'), 'utf8');

test('core reset clears every boss encounter global before generating the next dungeon', () => {
  const resetStart = runStateSource.indexOf('function resetState(options = {})');
  assert.notEqual(resetStart, -1, 'expected resetState');
  const generateIndex = runStateSource.indexOf('generateDungeon();', resetStart);
  assert.notEqual(generateIndex, -1, 'expected dungeon generation inside resetState');
  const teardown = runStateSource.slice(resetStart, generateIndex);

  assert.match(teardown, /bossRoom\s*=\s*null/);
  assert.match(teardown, /bossEnemy\s*=\s*null/);
  assert.match(teardown, /bossLockTiles\s*=\s*\[\]/);
  assert.match(teardown, /bossAggroed\s*=\s*false/);
  assert.match(teardown, /bossDoorsLocked\s*=\s*false/);
  assert.match(teardown, /pendingBossLocks\s*=\s*\[\]/);
});
