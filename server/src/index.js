const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocketServer } = require("ws");
const { randomUUID } = require("crypto");
const { LobbyManager } = require("./rooms");
const { LeaderboardStore } = require("./leaderboard-store");
const { applyQuickPartyExtension } = require("./quick-party-extension");
const { applySharedLootExtension } = require("./shared-loot-extension");
const { CLIENT_MESSAGES, SERVER_MESSAGES, parseClientMessage, safeSend } = require("./protocol");

applyQuickPartyExtension(LobbyManager);
applySharedLootExtension(LobbyManager);

const PORT = Number(process.env.PORT || 8080);
const CLIENT_ROOT = path.resolve(__dirname, "../..");
const LEADERBOARD_FILE = process.env.LEADERBOARD_FILE || path.resolve(__dirname, "../data/leaderboard.json");
const API_CORS_ORIGIN = process.env.API_CORS_ORIGIN || "*";
const WS_MAX_CONNECTIONS_PER_IP = Number(process.env.WS_MAX_CONNECTIONS_PER_IP || 20);
const rooms = new LobbyManager();
const leaderboard = new LeaderboardStore({ filePath: LEADERBOARD_FILE, maxEntries: 50 });

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg"
};

const API_HEADERS = {
  "Access-Control-Allow-Origin": API_CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "no-store"
};

function sendResponse(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function sendJson(res, statusCode, payload, headers = {}) {
  sendResponse(res, statusCode, JSON.stringify(payload), {
    "Content-Type": "application/json; charset=utf-8",
    ...API_HEADERS,
    ...headers
  });
}

function leaderboardPayload() {
  return { entries: leaderboard.list(), updatedAt: Date.now() };
}

function sendLeaderboard(ws) {
  return safeSend(ws, SERVER_MESSAGES.LEADERBOARD_UPDATE, leaderboardPayload());
}

function broadcastLeaderboard() {
  for (const client of wss.clients) sendLeaderboard(client);
}

function readJsonBody(req, maxBytes = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(Object.assign(new Error("Request body too large."), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

async function handleLeaderboardPost(req, res) {
  try {
    const body = await readJsonBody(req);
    const score = body.score || body;
    const profile = body.profile || {};
    const playerId = body.playerId || `http_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const result = leaderboard.submitScore(playerId, score, profile);
    if (result.changed) broadcastLeaderboard();
    sendJson(res, 200, { ...leaderboardPayload(), changed: result.changed, entry: result.entry });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    sendJson(res, statusCode, { error: err.message || "Leaderboard submit failed." });
  }
}

function handleApiRequest(req, res) {
  let requestUrl;
  try {
    requestUrl = new URL(req.url || "/", "http://localhost");
  } catch {
    sendResponse(res, 400, "Bad Request", API_HEADERS);
    return true;
  }

  if (requestUrl.pathname !== "/api/leaderboard") return false;

  if (req.method === "OPTIONS") {
    sendResponse(res, 204, "", API_HEADERS);
    return true;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const body = req.method === "HEAD" ? "" : JSON.stringify(leaderboardPayload());
    sendResponse(res, 200, body, { "Content-Type": "application/json; charset=utf-8", ...API_HEADERS });
    return true;
  }

  if (req.method === "POST") {
    handleLeaderboardPost(req, res);
    return true;
  }

  sendResponse(res, 405, "Method Not Allowed", { Allow: "GET, HEAD, POST, OPTIONS", ...API_HEADERS });
  return true;
}

function getStaticFilePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  if (pathSegments.some((segment) => segment.startsWith(".")) || pathSegments[0] === "server") return null;

  const filePath = path.resolve(CLIENT_ROOT, `.${normalizedPath}`);

  if (!filePath.startsWith(`${CLIENT_ROOT}${path.sep}`) && filePath !== CLIENT_ROOT) return null;
  return filePath;
}

function serveStaticFile(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendResponse(res, 405, "Method Not Allowed", { Allow: "GET, HEAD" });
    return;
  }

  let filePath;
  try {
    filePath = getStaticFilePath(req.url || "/");
  } catch {
    sendResponse(res, 400, "Bad Request");
    return;
  }

  if (!filePath) {
    sendResponse(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      sendResponse(res, 404, "Not Found");
      return;
    }

    const headers = {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stats.size
    };

    if (req.method === "HEAD") {
      sendResponse(res, 200, "", headers);
      return;
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (handleApiRequest(req, res)) return;
  serveStaticFile(req, res);
});
const wss = new WebSocketServer({ noServer: true });
const wsConnectionsByIp = new Map();

rooms.startCleanup();

function parseAllowedOrigins(originConfig = API_CORS_ORIGIN) {
  return String(originConfig)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, originConfig = API_CORS_ORIGIN) {
  const allowedOrigins = parseAllowedOrigins(originConfig);
  if (allowedOrigins.includes("*")) return true;
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

function getRequestIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) return forwardedFor.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function rejectWebSocketUpgrade(socket, statusCode, reason) {
  const statusText = http.STATUS_CODES[statusCode] || "Rejected";
  socket.write([
    `HTTP/1.1 ${statusCode} ${statusText}`,
    "Connection: close",
    "Content-Type: text/plain; charset=utf-8",
    `Content-Length: ${Buffer.byteLength(reason)}`,
    "",
    reason
  ].join("\r\n"));
  socket.destroy();
}

function canAcceptIpConnection(ip) {
  return (wsConnectionsByIp.get(ip) || 0) < WS_MAX_CONNECTIONS_PER_IP;
}

function trackIpConnection(ip, ws) {
  wsConnectionsByIp.set(ip, (wsConnectionsByIp.get(ip) || 0) + 1);
  ws.once("close", () => {
    const remaining = (wsConnectionsByIp.get(ip) || 1) - 1;
    if (remaining > 0) wsConnectionsByIp.set(ip, remaining);
    else wsConnectionsByIp.delete(ip);
  });
}

server.on("upgrade", (req, socket, head) => {
  socket.on("error", () => {});

  if (!isAllowedOrigin(req.headers.origin)) {
    rejectWebSocketUpgrade(socket, 403, "WebSocket origin is not allowed.");
    return;
  }

  const ip = getRequestIp(req);
  if (!canAcceptIpConnection(ip)) {
    rejectWebSocketUpgrade(socket, 429, "Too many WebSocket connections from this IP.");
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    trackIpConnection(ip, ws);
    wss.emit("connection", ws, req);
  });
});

function makePlayerId() {
  return `crawler_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

wss.on("connection", (ws) => {
  const playerId = makePlayerId();
  rooms.registerClient(ws, playerId);
  safeSend(ws, SERVER_MESSAGES.WELCOME, { playerId, targetPlayers: 4 });
  sendLeaderboard(ws);

  ws.on("message", (raw) => {
    const { message, error } = parseClientMessage(raw);
    if (error) {
      safeSend(ws, SERVER_MESSAGES.ERROR, { message: error });
      return;
    }

    try {
      switch (message.type) {
        case CLIENT_MESSAGES.HELLO:
          rooms.updateClientProfile(playerId, message.profile || message);
          safeSend(ws, SERVER_MESSAGES.WELCOME, { playerId, targetPlayers: 4 });
          sendLeaderboard(ws);
          break;
        case CLIENT_MESSAGES.PARTY_CREATE:
        case CLIENT_MESSAGES.CREATE_LOBBY:
          rooms.updateClientProfile(playerId, message.profile || message);
          rooms.createPrivateLobby(playerId);
          break;
        case CLIENT_MESSAGES.PARTY_JOIN_BY_CODE:
        case CLIENT_MESSAGES.JOIN_LOBBY:
          rooms.updateClientProfile(playerId, message.profile || message);
          rooms.joinPrivateLobby(playerId, message.lobbyCode || message.code);
          break;
        case CLIENT_MESSAGES.QUICK_MATCH:
          rooms.updateClientProfile(playerId, message.profile || message);
          rooms.joinQuickMatch(playerId, { arena: !!message.arena });
          break;
        case CLIENT_MESSAGES.PARTY_LEAVE:
        case CLIENT_MESSAGES.LEAVE_LOBBY:
          rooms.leaveLobby(playerId);
          break;
        case CLIENT_MESSAGES.CRAWLER_STATE:
          rooms.updateCrawlerState(playerId, message.state || message);
          break;
        case CLIENT_MESSAGES.VOICE_OFFER:
        case CLIENT_MESSAGES.VOICE_ANSWER:
        case CLIENT_MESSAGES.VOICE_ICE_CANDIDATE:
        case CLIENT_MESSAGES.VOICE_DISCONNECT:
          rooms.relayVoiceSignal(playerId, message);
          break;
        case CLIENT_MESSAGES.PARTY_INVITE_SEND:
        case CLIENT_MESSAGES.PARTY_INVITE:
          rooms.requestPartyInvite(playerId, message.targetPlayerId, message);
          break;
        case CLIENT_MESSAGES.PARTY_INVITE_ACCEPT:
          rooms.respondPartyInvite(playerId, message.fromPlayerId, true);
          break;
        case CLIENT_MESSAGES.PARTY_INVITE_DECLINE:
          rooms.respondPartyInvite(playerId, message.fromPlayerId, false);
          break;
        case CLIENT_MESSAGES.PARTY_RESPONSE:
          rooms.respondPartyInvite(playerId, message.fromPlayerId, !!message.accepted);
          break;
        case CLIENT_MESSAGES.FLOOR0_STAIRS_REACHED:
          rooms.markCrawlerAtFloor0Stairs(playerId);
          break;
        case CLIENT_MESSAGES.FLOOR0_WORLD_EVENT:
          rooms.handleFloor0WorldEvent(playerId, message.event || message);
          break;
        case CLIENT_MESSAGES.FLOOR0_ENEMY_SNAPSHOT:
          rooms.updateFloor0EnemySnapshot(playerId, message);
          break;
        case CLIENT_MESSAGES.PVP_DAMAGE:
          rooms.handlePvpDamage(playerId, message);
          break;
        case CLIENT_MESSAGES.PLAYER_CORPSE_LOOT_TAKE:
          rooms.handlePlayerCorpseLootTake(playerId, message);
          break;
        case CLIENT_MESSAGES.LEADERBOARD_REQUEST:
          sendLeaderboard(ws);
          break;
        case CLIENT_MESSAGES.LEADERBOARD_SUBMIT: {
          const client = rooms.clients.get(playerId);
          const result = leaderboard.submitScore(playerId, message.score || message, client?.profile || { name: client?.name });
          if (result.changed) broadcastLeaderboard();
          else sendLeaderboard(ws);
          break;
        }
        default:
          safeSend(ws, SERVER_MESSAGES.ERROR, { message: `Unsupported message type: ${message.type}` });
      }
    } catch (err) {
      safeSend(ws, SERVER_MESSAGES.ERROR, { message: err.message || "Floor 0 collapse request failed." });
    }
  });

  ws.on("close", () => rooms.unregisterClient(playerId));
  ws.on("error", () => rooms.unregisterClient(playerId));
});

server.listen(PORT, () => {
  console.log(`Dungeon Crawler World client and Floor 0 collapse WebSocket server listening on http://localhost:${PORT}`);
  console.log(`Leaderboard storage: ${LEADERBOARD_FILE}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
