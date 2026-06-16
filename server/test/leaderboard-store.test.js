const test = require('node:test');
const assert = require('node:assert/strict');
const { LeaderboardStore, normalizeMode, sanitizePlayerName } = require('../src/leaderboard-store');

test('leaderboard sanitizes names and modes', () => {
  assert.equal(sanitizePlayerName('  TheLongestCrawlerNameEver  '), 'TheLongestCrawler');
  assert.equal(sanitizePlayerName('   '), 'Crawler');
  assert.equal(normalizeMode('pvp_arena'), 'arena');
  assert.equal(normalizeMode('quick_match'), 'multiplayer');
  assert.equal(normalizeMode('nonsense'), 'single');
});

test('leaderboard keeps best floor and best gold by player name', () => {
  const store = new LeaderboardStore({ persist: false, maxEntries: 10 });

  store.submitScore('a', { name: 'Chris', highestFloor: 1, highestGold: 15, modeKey: 'single' });
  store.submitScore('b', { name: 'chris', highestFloor: 0, highestGold: 90, modeKey: 'multiplayer' });
  store.submitScore('c', { name: 'Chris', highestFloor: 3, highestGold: 12, modeKey: 'arena' });

  const [entry] = store.list();
  assert.equal(entry.name, 'Chris');
  assert.equal(entry.highestFloor, 3);
  assert.equal(entry.highestGold, 90);
  assert.deepEqual(entry.modes.sort(), ['arena', 'multiplayer', 'single']);
});

test('leaderboard sorts by floor then gold and limits entries', () => {
  const store = new LeaderboardStore({ persist: false, maxEntries: 2 });

  store.submitScore('a', { name: 'A', highestFloor: 1, highestGold: 999 });
  store.submitScore('b', { name: 'B', highestFloor: 3, highestGold: 1 });
  store.submitScore('c', { name: 'C', highestFloor: 3, highestGold: 5 });

  const entries = store.list();
  assert.deepEqual(entries.map(entry => entry.name), ['C', 'B']);
});
