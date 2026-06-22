const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.env.LEADERBOARD_FILE = path.join(mkdtempSync(path.join(tmpdir(), 'dcwz-leaderboard-')), 'leaderboard.json');
process.env.LEADERBOARD_POST_WINDOW_MS = '60000';
process.env.LEADERBOARD_POST_LIMIT = '2';

const { server, wss, leaderboard, leaderboardPostAttempts } = require('../src/index');

function listen() {
  return new Promise((resolve) => {
    if (server.listening) {
      resolve(server.address().port);
      return;
    }
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function postLeaderboard(port, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/api/leaderboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

test.after(() => {
  leaderboardPostAttempts.clear();
  rmSync(path.dirname(process.env.LEADERBOARD_FILE), { recursive: true, force: true });
  wss.close();
  if (server.listening) server.close();
});

test.beforeEach(() => {
  leaderboard.clear();
  leaderboardPostAttempts.clear();
});

test('production server requires an explicit API_CORS_ORIGIN', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./src/index')"], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      API_CORS_ORIGIN: ''
    },
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /API_CORS_ORIGIN must be configured explicitly in production/);
});

test('POST /api/leaderboard rejects disallowed origins', async () => {
  const port = await listen();

  const { response, body } = await postLeaderboard(port, {
    playerId: 'origin-test',
    score: { name: 'Bad Origin', highestFloor: 1, highestGold: 25 }
  }, { Origin: 'https://attacker.example' });

  assert.equal(response.status, 403);
  assert.match(body.error, /Origin is not allowed/);
});

test('POST /api/leaderboard rate-limits repeated submissions per IP and player', async () => {
  const port = await listen();
  const payload = {
    playerId: 'rate-test',
    score: { name: 'Rate Test', highestFloor: 1, highestGold: 25 }
  };

  assert.equal((await postLeaderboard(port, payload)).response.status, 200);
  assert.equal((await postLeaderboard(port, payload)).response.status, 200);
  const { response, body } = await postLeaderboard(port, payload);

  assert.equal(response.status, 429);
  assert.match(body.error, /Too many leaderboard submissions/);
});

test('POST /api/leaderboard accepts valid local submissions', async () => {
  const port = await listen();

  const { response, body } = await postLeaderboard(port, {
    playerId: 'local-test',
    score: { name: 'Local Hero', highestFloor: 2, highestGold: 150 }
  }, { Origin: `http://localhost:${port}` });

  assert.equal(response.status, 200);
  assert.equal(body.entry.name, 'Local Hero');
  assert.equal(body.entry.highestFloor, 2);
  assert.equal(body.entry.highestGold, 150);
});

test('POST /api/leaderboard rejects impossible score jumps', async () => {
  const port = await listen();

  const { response, body } = await postLeaderboard(port, {
    playerId: 'bounds-test',
    score: { name: 'Bounds Test', highestFloor: 999, highestGold: 999999999 }
  });

  assert.equal(response.status, 400);
  assert.match(body.error, /exceeds known game bounds/);
});
