const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../../src/run-lifecycle.js'), 'utf8');

test('saved boss identity prefers the stable enemyId with legacy id fallback', () => {
  assert.match(source, /bossEnemyId:\s*bossEnemy\?\.enemyId\s*\?\?\s*bossEnemy\?\.id\s*\?\?\s*null/);
});

test('boss restoration matches both stable and legacy ids and has a living-boss fallback', () => {
  assert.match(source, /enemy\.enemyId\s*===\s*savedBossEnemyId\s*\|\|\s*enemy\.id\s*===\s*savedBossEnemyId/);
  assert.match(source, /enemies\.find\(enemy\s*=>\s*enemy\?\.boss\s*&&\s*enemy\.hp\s*>\s*0\)/);
});
