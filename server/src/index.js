const { WebSocketServer } = require("ws");
const { randomUUID } = require("crypto");
const { LobbyManager } = require("./rooms");
const { CLIENT_MESSAGES, SERVER_MESSAGES, parseClientMessage, safeSend } = require("./protocol");

const PORT = Number(process.env.PORT || 8080);
const rooms = new LobbyManager();
const wss = new WebSocketServer({ port: PORT });

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
          safeSend(ws, SERVER_MESSAGES.WELCOME, { playerId, targetPlayers: 4 });
          break;
        case CLIENT_MESSAGES.CREATE_LOBBY:
          rooms.createPrivateLobby(playerId);
          break;
        case CLIENT_MESSAGES.JOIN_LOBBY:
          rooms.joinPrivateLobby(playerId, message.lobbyCode || message.code);
          break;
        case CLIENT_MESSAGES.QUICK_MATCH:
          rooms.joinQuickMatch(playerId);
          break;
        case CLIENT_MESSAGES.LEAVE_LOBBY:
          rooms.leaveLobby(playerId);
          break;
        case CLIENT_MESSAGES.CRAWLER_STATE:
          rooms.updateCrawlerState(playerId, message.state || message);
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

wss.on("listening", () => {
  console.log(`Dungeon Crawler World Floor 0 collapse WebSocket server listening on ws://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  wss.close(() => process.exit(0));
});
