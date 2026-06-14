const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocketServer } = require("ws");
const { randomUUID } = require("crypto");
const { LobbyManager } = require("./rooms");
const { applyQuickPartyExtension } = require("./quick-party-extension");
const { CLIENT_MESSAGES, SERVER_MESSAGES, parseClientMessage, safeSend } = require("./protocol");

applyQuickPartyExtension(LobbyManager);

const PORT = Number(process.env.PORT || 8080);
const CLIENT_ROOT = path.resolve(__dirname, "../..");
const rooms = new LobbyManager();

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

function sendResponse(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
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

const server = http.createServer(serveStaticFile);
const wss = new WebSocketServer({ server });

rooms.startCleanup();

function makePlayerId() {
  return `crawler_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

wss.on("connection", (ws) => {
  const playerId = makePlayerId();
  rooms.registerClient(ws, playerId);
  safeSend(ws, SERVER_MESSAGES.WELCOME, { playerId, targetPlayers: 4 });

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
          break;
        case CLIENT_MESSAGES.CREATE_LOBBY:
          rooms.updateClientProfile(playerId, message.profile || message);
          rooms.joinQuickMatch(playerId);
          break;
        case CLIENT_MESSAGES.JOIN_LOBBY:
          rooms.updateClientProfile(playerId, message.profile || message);
          rooms.joinPrivateLobby(playerId, message.lobbyCode || message.code);
          break;
        case CLIENT_MESSAGES.QUICK_MATCH:
          rooms.updateClientProfile(playerId, message.profile || message);
          rooms.joinQuickMatch(playerId);
          break;
        case CLIENT_MESSAGES.LEAVE_LOBBY:
          rooms.leaveLobby(playerId);
          break;
        case CLIENT_MESSAGES.CRAWLER_STATE:
          rooms.updateCrawlerState(playerId, message.state || message);
          break;
        case CLIENT_MESSAGES.PARTY_INVITE:
          rooms.requestPartyInvite(playerId, message.targetPlayerId);
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
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
