const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../src/multiplayer-panel-autoclose.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `expected ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`could not extract ${name}`);
}

const functionSource = extractFunction('getRemainingCrawlerCount');

function count({ localHp = 100, localStatus = 'active', localFloor0Status = 'exploring', currentFloor = 1, remotePlayers = [], lobbyMembers = [] } = {}) {
  const context = {
    currentFloor,
    player: { hp: localHp },
    multiplayer: {
      enabled: true,
      playerId: 'local',
      localStatus,
      localFloor0Status,
      remotePlayers: new Map(remotePlayers),
      lobbyMembers
    }
  };
  vm.runInNewContext(functionSource, context, { filename: 'recap-count.js' });
  return context.getRemainingCrawlerCount();
}

test('recap count ignores retained lobby membership without live crawler state', () => {
  assert.equal(count({
    lobbyMembers: [
      { id: 'local' },
      { id: 'dead_retained_member', floor0Status: 'exploring' }
    ]
  }), 1);
});

test('recap count uses current-floor crawler status and hp', () => {
  assert.equal(count({
    remotePlayers: [
      ['active', { currentFloor: 1, status: 'active', hp: 80 }],
      ['downed', { currentFloor: 1, status: 'downed', hp: 0 }],
      ['failed', { currentFloor: 1, status: 'failed', hp: 100 }],
      ['other_floor', { currentFloor: 2, status: 'active', hp: 100 }]
    ]
  }), 2);
});

test('recap count can correctly report zero remaining crawlers', () => {
  assert.equal(count({ localHp: 0, localStatus: 'downed' }), 0);
});
