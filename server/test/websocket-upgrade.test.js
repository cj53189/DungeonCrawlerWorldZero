const assert = require("assert/strict");
const { once } = require("events");
const { spawn } = require("child_process");
const test = require("node:test");
const { WebSocket } = require("ws");

const SERVER_READY_TEXT = "WebSocket server listening";

function startServer(t, env = {}) {
  const port = 19000 + (process.pid % 1000) + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: __dirname + "/..",
    env: {
      ...process.env,
      PORT: String(port),
      LEADERBOARD_FILE: `/tmp/dcwz-leaderboard-${process.pid}-${port}.json`,
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  t.after(() => {
    if (!child.killed) child.kill("SIGTERM");
  });

  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start. Output:\n${output}`)), 5000);
    child.on("exit", (code) => reject(new Error(`Server exited with ${code}. Output:\n${output}`)));
    child.stdout.on("data", () => {
      if (output.includes(SERVER_READY_TEXT)) {
        clearTimeout(timeout);
        resolve({ port, child });
      }
    });
  });

  return ready;
}

function openSocket(port, origin) {
  return new WebSocket(`ws://127.0.0.1:${port}`, { headers: { Origin: origin } });
}

async function expectOpen(ws) {
  await once(ws, "open");
  return ws;
}

async function expectRejected(ws, expectedStatusCode) {
  const [err] = await once(ws, "error");
  assert.match(err.message, new RegExp(`Unexpected server response: ${expectedStatusCode}`));
}

test("WebSocket upgrades accept configured API origin and reject other origins", async (t) => {
  const { port } = await startServer(t, { API_CORS_ORIGIN: "https://allowed.example" });

  const allowed = await expectOpen(openSocket(port, "https://allowed.example"));
  allowed.close();

  await expectRejected(openSocket(port, "https://blocked.example"), 403);
});

test("WebSocket upgrades reject connections over the per-IP cap before registration", async (t) => {
  const { port } = await startServer(t, {
    API_CORS_ORIGIN: "https://allowed.example",
    WS_MAX_CONNECTIONS_PER_IP: "1"
  });

  const first = await expectOpen(openSocket(port, "https://allowed.example"));
  await expectRejected(openSocket(port, "https://allowed.example"), 429);
  first.close();
});
