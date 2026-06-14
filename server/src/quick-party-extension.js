const { LOBBY_MODES, LOBBY_STATUS, SERVER_MESSAGES, TARGET_PLAYERS, safeSend } = require("./protocol");

const PARTY_CODE_PREFIX = "RUNE";
const PARTY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizePartyCode(code) {
  return String(code || "").trim().toUpperCase();
}

function makePartyCode(manager) {
  for (let attempt = 0; attempt < 200; attempt++) {
    let suffix = "";
    for (let i = 0; i < 4; i++) suffix += PARTY_CODE_ALPHABET[Math.floor(Math.random() * PARTY_CODE_ALPHABET.length)];
    const code = `${PARTY_CODE_PREFIX}-${suffix}`;
    if (!manager.lobbies.has(code) && !findPartyByCode(manager, code)) return code;
  }
  throw new Error("Could not allocate a party code. The dungeon ate the code printer.");
}

function ensurePartyCodeMap(lobby) {
  if (!lobby.partyCodes) lobby.partyCodes = new Map();
  return lobby.partyCodes;
}

function findPartyByCode(manager, requestedCode) {
  const code = normalizePartyCode(requestedCode);
  if (!code) return null;

  for (const lobby of manager.lobbies.values()) {
    const entry = lobby.partyCodes?.get(code);
    if (entry) return { lobby, code, ...entry };
  }

  return null;
}

function assignSoloQuickParty(manager, lobby, player) {
  if (!lobby || !player) return null;
  if (player.partyCode && player.partyId) return { partyCode: player.partyCode, partyId: player.partyId };

  const partyCode = makePartyCode(manager);
  const partyId = `party:${partyCode}`;
  player.partyCode = partyCode;
  player.partyId = partyId;
  player.isPartyLeader = true;
  ensurePartyCodeMap(lobby).set(partyCode, { partyId, leaderPlayerId: player.id });
  return { partyCode, partyId };
}

function joinQuickPartyByCode(manager, playerId, requestedCode) {
  const party = findPartyByCode(manager, requestedCode);
  if (!party) return null;
  const { lobby, code: partyCode, partyId } = party;
  if (lobby.mode !== LOBBY_MODES.QUICK_MATCH || lobby.status !== LOBBY_STATUS.STAGING) {
    throw new Error("That party code is no longer accepting crawlers.");
  }
  if (lobby.players.length >= TARGET_PLAYERS) throw new Error("That Quick Match room is full.");

  const client = manager.requireClient(playerId);
  manager.leaveLobby(playerId, { silent: true });
  manager.addPlayerToLobby(lobby, client, { partyId, isPartyLeader: false });

  const player = lobby.players.find(candidate => candidate.id === playerId);
  if (player) {
    player.partyCode = partyCode;
    player.partyId = partyId;
    player.isPartyLeader = false;
  }

  safeSend(client.ws, SERVER_MESSAGES.MATCHMAKING_UPDATE, {
    lobbyCode: lobby.code,
    partyCode,
    players: lobby.players.length,
    targetPlayers: TARGET_PLAYERS
  });
  safeSend(client.ws, SERVER_MESSAGES.LOBBY_JOINED, {
    lobbyCode: lobby.code,
    mode: lobby.mode,
    partyCode,
    partyId,
    isPartyLeader: false,
    joinedByPartyCode: true
  });
  manager.broadcastLobbyUpdate(lobby);
  return lobby;
}

function applyQuickPartyExtension(LobbyManager) {
  const proto = LobbyManager.prototype;

  const originalCreateLobby = proto.createLobby;
  proto.createLobby = function createLobbyWithPartyCodes(args) {
    const lobby = originalCreateLobby.call(this, args);
    ensurePartyCodeMap(lobby);
    return lobby;
  };

  const originalJoinQuickMatch = proto.joinQuickMatch;
  proto.joinQuickMatch = function joinQuickMatchWithSoloParty(playerId) {
    const lobby = originalJoinQuickMatch.call(this, playerId);
    const client = this.requireClient(playerId);
    const player = lobby.players.find(candidate => candidate.id === playerId);
    const party = assignSoloQuickParty(this, lobby, player);

    if (party) {
      safeSend(client.ws, SERVER_MESSAGES.MATCHMAKING_UPDATE, {
        lobbyCode: lobby.code,
        partyCode: party.partyCode,
        players: lobby.players.length,
        targetPlayers: TARGET_PLAYERS
      });
      safeSend(client.ws, SERVER_MESSAGES.LOBBY_JOINED, {
        lobbyCode: lobby.code,
        mode: lobby.mode,
        partyCode: party.partyCode,
        partyId: party.partyId,
        isPartyLeader: true,
        joinedByPartyCode: false
      });
      this.broadcastLobbyUpdate(lobby);
    }

    return lobby;
  };

  const originalJoinPrivateLobby = proto.joinPrivateLobby;
  proto.joinPrivateLobby = function joinLobbyOrQuickParty(playerId, requestedCode) {
    const quickPartyLobby = joinQuickPartyByCode(this, playerId, requestedCode);
    if (quickPartyLobby) return quickPartyLobby;
    return originalJoinPrivateLobby.call(this, playerId, requestedCode);
  };

  const originalLobbyPayload = proto.lobbyPayload;
  proto.lobbyPayload = function lobbyPayloadWithQuickPartySummary(lobby) {
    const payload = originalLobbyPayload.call(this, lobby);
    payload.players = payload.players.map(playerPayload => {
      const source = lobby.players.find(player => player.id === playerPayload.id);
      return {
        ...playerPayload,
        partyId: source?.partyId || playerPayload.partyId || null
      };
    });
    return payload;
  };
}

module.exports = { applyQuickPartyExtension };
