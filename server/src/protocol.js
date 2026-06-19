const CLIENT_MESSAGES = Object.freeze({
  HELLO: "hello",
  CREATE_LOBBY: "create_lobby",
  PARTY_CREATE: "party_create",
  JOIN_LOBBY: "join_lobby",
  PARTY_JOIN_BY_CODE: "party_join_by_code",
  QUICK_MATCH: "quick_match",
  PVP_ARENA: "pvp_arena",
  LEAVE_LOBBY: "leave_lobby",
  PARTY_LEAVE: "party_leave",
  CRAWLER_STATE: "crawler_state",
  PARTY_INVITE: "party_invite",
  PARTY_INVITE_RECEIVED: "party_invite_received",
  PARTY_INVITE_EXPIRED: "party_invite_expired",
  PARTY_INVITE_SEND: "party_invite_send",
  PARTY_INVITE_ACCEPT: "party_invite_accept",
  PARTY_INVITE_DECLINE: "party_invite_decline",
  PARTY_RESPONSE: "party_response",
  FLOOR0_STAIRS_REACHED: "floor0_stairs_reached",
  FLOOR0_WORLD_EVENT: "floor0_world_event",
  FLOOR0_ENEMY_SNAPSHOT: "floor0_enemy_snapshot",
  PVP_DAMAGE: "pvp_damage",
  PLAYER_CORPSE_LOOT_TAKE: "player_corpse_loot_take",
  LEADERBOARD_SUBMIT: "leaderboard_submit",
  LEADERBOARD_REQUEST: "leaderboard_request",
  VOICE_OFFER: "voice_offer",
  VOICE_ANSWER: "voice_answer",
  VOICE_ICE_CANDIDATE: "voice_ice_candidate",
  VOICE_DISCONNECT: "voice_disconnect"
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
  PARTY_INVITE: "party_invite",
  PARTY_INVITE_RECEIVED: "party_invite_received",
  PARTY_INVITE_EXPIRED: "party_invite_expired",
  PARTY_INVITE_SEND: "party_invite_send",
  PARTY_INVITE_ACCEPT: "party_invite_accept",
  PARTY_INVITE_DECLINE: "party_invite_decline",
  PARTY_RESPONSE: "party_response",
  FLOOR0_RESOLVED: "floor0_resolved",
  FLOOR_START: "floor_start",
  FLOOR0_WORLD_STATE: "floor0_world_state",
  FLOOR0_WORLD_EVENT: "floor0_world_event",
  FLOOR0_ENEMY_SNAPSHOT: "floor0_enemy_snapshot",
  PVP_DAMAGE_APPLIED: "pvp_damage_applied",
  PLAYER_DIED: "player_died",
  PLAYER_CORPSE_CREATED: "player_corpse_created",
  PLAYER_CORPSE_LOOT_TAKEN: "player_corpse_loot_taken",
  PLAYER_CORPSE_LOOTED: "player_corpse_looted",
  LEADERBOARD_UPDATE: "leaderboard_update",
  VOICE_OFFER: "voice_offer",
  VOICE_ANSWER: "voice_answer",
  VOICE_ICE_CANDIDATE: "voice_ice_candidate",
  VOICE_DISCONNECT: "voice_disconnect",
  ERROR: "error"
});

const LOBBY_MODES = Object.freeze({
  PRIVATE: "private",
  QUICK_MATCH: "quick_match",
  PVP_ARENA: "pvp_arena"
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

function scheduleVoiceRelayExtension() {
  if (scheduleVoiceRelayExtension.scheduled) return;
  scheduleVoiceRelayExtension.scheduled = true;
  process.nextTick(() => {
    try {
      const { LobbyManager } = require("./rooms");
      const { applyVoiceRelayExtension } = require("./voice-relay-extension");
      if (LobbyManager && typeof applyVoiceRelayExtension === "function") applyVoiceRelayExtension(LobbyManager);
    } catch (err) {
      console.warn("Voice relay extension could not be installed.", err?.message || err);
    }
  });
}

scheduleVoiceRelayExtension();

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
