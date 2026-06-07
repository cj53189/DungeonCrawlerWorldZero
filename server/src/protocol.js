const CLIENT_MESSAGES = Object.freeze({
  HELLO: "hello",
  CREATE_LOBBY: "create_lobby",
  JOIN_LOBBY: "join_lobby",
  QUICK_MATCH: "quick_match",
  LEAVE_LOBBY: "leave_lobby",
  CRAWLER_STATE: "crawler_state"
});

const SERVER_MESSAGES = Object.freeze({
  WELCOME: "welcome",
  LOBBY_CREATED: "lobby_created",
  LOBBY_JOINED: "lobby_joined",
  LOBBY_UPDATE: "lobby_update",
  MATCHMAKING_UPDATE: "matchmaking_update",
  STAGING_COMPLETE: "staging_complete",
  PLAYER_LEFT: "player_left",
  CRAWLER_SNAPSHOT: "crawler_snapshot",
  ERROR: "error"
});

const LOBBY_MODES = Object.freeze({
  PRIVATE: "private",
  QUICK_MATCH: "quick_match"
});

const LOBBY_STATUS = Object.freeze({
  STAGING: "staging",
  START_PENDING: "start_pending"
});

const TARGET_PLAYERS = 4;
const FLOOR0_COLLAPSE_CAPS_MS = Object.freeze({
  1: 15 * 60 * 1000,
  2: 7 * 60 * 1000,
  3: 5 * 60 * 1000,
  4: 3 * 60 * 1000
});

function safeSend(ws, type, payload = {}) {
  if (ws.readyState !== ws.OPEN) return false;
  ws.send(JSON.stringify({ type, ...payload }));
  return true;
}

function parseClientMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return { error: "Invalid JSON message." };
  }

  if (!message || typeof message !== "object" || typeof message.type !== "string") {
    return { error: "Message must include a string type." };
  }

  return { message };
}

module.exports = {
  CLIENT_MESSAGES,
  SERVER_MESSAGES,
  LOBBY_MODES,
  LOBBY_STATUS,
  TARGET_PLAYERS,
  FLOOR0_COLLAPSE_CAPS_MS,
  parseClientMessage,
  safeSend
};
