const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.env.LEADERBOARD_FILE = path.join(mkdtempSync(path.join(tmpdir(), 'dcwz-leaderboard-')), 'leaderboard.json');
process.env.LEADERBOARD_POST_WINDOW_MS = '60000';
process.env.LEADERBOARD_POST_LIMIT = '2';
process.env.WS_CONNECTION_WINDOW_MS = '60000';
process.env.WS_CONNECTION_LIMIT = '2';

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

test('production server without API_CORS_ORIGIN falls back to same-origin only', () => {
  const script = `
    const { validateLeaderboardRequestSource, validateWebSocketRequest, wsConnectionAttempts, wss } = require('./src/index');
    const sameOriginReq = { headers: { host: 'dungeoncrawlerworldzero.onrender.com', origin: 'https://dungeoncrawlerworldzero.onrender.com' }, socket: { remoteAddress: '127.0.0.1' } };
    const attackerReq = { headers: { host: 'dungeoncrawlerworldzero.onrender.com', origin: 'https://attacker.example' }, socket: { remoteAddress: '127.0.0.2' } };
    validateLeaderboardRequestSource(sameOriginReq);
    if (!validateWebSocketRequest(sameOriginReq)) process.exit(2);
    wsConnectionAttempts.clear();
    if (validateWebSocketRequest(attackerReq)) process.exit(3);
    wss.close();
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      API_CORS_ORIGIN: ''
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, `${result.stderr}${result.stdout}`);
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

test('WebSocket upgrade validation rejects disallowed origins and rate-limits accepted clients', () => {
  const { validateWebSocketRequest, wsConnectionAttempts } = require('../src/index');
  wsConnectionAttempts.clear();
  const localReq = { headers: { host: '127.0.0.1:8080', origin: 'http://localhost:8080' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(validateWebSocketRequest({ headers: { host: '127.0.0.1:8080', origin: 'https://attacker.example' }, socket: { remoteAddress: '127.0.0.1' } }), false);
  assert.equal(validateWebSocketRequest(localReq), true);
  assert.equal(validateWebSocketRequest(localReq), true);
  assert.equal(validateWebSocketRequest(localReq), false);
  wsConnectionAttempts.clear();
});