const { LOBBY_MODES, LOBBY_STATUS, SERVER_MESSAGES, TARGET_PLAYERS, safeSend } = require("./protocol");

const PARTY_CODE_PREFIX = "RUNE";
const PARTY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PARTY_INVITE_TTL_MS = 30_000;
const FLOOR0_STAIRS_STATUSES = new Set(["at_stairs", "advancing"]);

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

function ensurePartyInviteMap(lobby) {
  if (!lobby.partyInvites) lobby.partyInvites = new Map();
  return lobby.partyInvites;
}

function inviteKey(fromPlayerId, toPlayerId) {
  return `${fromPlayerId}->${toPlayerId}`;
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

function getPartySize(lobby, partyId) {
  if (!partyId) return 0;
  return lobby.players.filter(player => player.partyId === partyId).length;
}

function cleanupSoloPartyCode(lobby, player) {
  if (!lobby || !player?.partyCode || getPartySize(lobby, player.partyId) > 1) return;
  lobby.partyCodes?.delete(player.partyCode);
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

function sendQuickPartyMatchmakingUpdate(client, lobby, partyCode, partyId) {
  safeSend(client.ws, SERVER_MESSAGES.MATCHMAKING_UPDATE, {
    lobbyCode: lobby.code,
    mode: lobby.mode,
    partyCode,
    partyId,
    players: lobby.players.length,
    targetPlayers: TARGET_PLAYERS
  });
}

function sendQuickPartyJoined(client, lobby, partyCode, partyId, { isPartyLeader = false, joinedByPartyCode = false } = {}) {
  safeSend(client.ws, SERVER_MESSAGES.LOBBY_JOINED, {
    lobbyCode: lobby.code,
    mode: lobby.mode,
    partyCode,
    partyId,
    isPartyLeader: !!isPartyLeader,
    joinedByPartyCode
  });
}

function joinQuickPartyByCode(manager, playerId, requestedCode) {
  const party = findPartyByCode(manager, requestedCode);
  if (!party) return null;
  const { lobby, code: partyCode, partyId } = party;
  if (lobby.mode !== LOBBY_MODES.QUICK_MATCH || lobby.floor !== 0 || lobby.joinState !== "open") {
    throw new Error("That run is locked after Floor 1. Find a new open Floor 0 run.");
  }

  const client = manager.requireClient(playerId);
  manager.leaveLobby(playerId, { silent: true });
  manager.addPlayerToLobby(lobby, client, { partyId, isPartyLeader: false });

  const player = lobby.players.find(candidate => candidate.id === playerId);
  if (player) {
    player.partyCode = partyCode;
    player.partyId = partyId;
    player.isPartyLeader = false;
  }

  sendQuickPartyMatchmakingUpdate(client, lobby, partyCode, partyId);
  sendQuickPartyJoined(client, lobby, partyCode, partyId, { isPartyLeader: false, joinedByPartyCode: true });
  manager.broadcastLobbyUpdate(lobby);
  return lobby;
}

function findPlayerLobby(manager, playerId) {
  const client = manager.requireClient(playerId);
  if (!client.lobbyCode) return { client, lobby: null, player: null };
  const lobby = manager.lobbies.get(client.lobbyCode);
  const player = lobby?.players.find(candidate => candidate.id === playerId) || null;
  return { client, lobby, player };
}

function expireOldInvites(lobby) {
  const invites = ensurePartyInviteMap(lobby);
  const now = Date.now();
  for (const [key, invite] of invites.entries()) {
    if (invite.expiresAt <= now) invites.delete(key);
  }
}

function applyQuickPartyExtension(LobbyManager) {
  const proto = LobbyManager.prototype;

  const originalCreateLobby = proto.createLobby;
  proto.createLobby = function createLobbyWithPartyCodes(args) {
    const lobby = originalCreateLobby.call(this, args);
    ensurePartyCodeMap(lobby);
    ensurePartyInviteMap(lobby);
    return lobby;
  };

  const originalJoinQuickMatch = proto.joinQuickMatch;
  proto.joinQuickMatch = function joinQuickMatchWithSoloParty(playerId, options = {}) {
    if (options?.arena) return originalJoinQuickMatch.call(this, playerId, options);
    const client = this.requireClient(playerId);
    this.leaveLobby(playerId, { silent: true });

    let lobby = Array.from(this.lobbies.values()).find(candidate => (
      candidate.mode === LOBBY_MODES.QUICK_MATCH &&
      candidate.floor === 0 &&
      candidate.joinState === "open"
    ));

    if (!lobby) {
      const code = `QUICK-${String(this.quickLobbyCounter++).padStart(4, "0")}`;
      lobby = this.createLobby({ code, mode: LOBBY_MODES.QUICK_MATCH });
    }

    this.addPlayerToLobby(lobby, client, { partyId: null, isPartyLeader: false });
    const player = lobby.players.find(candidate => candidate.id === playerId);
    const party = assignSoloQuickParty(this, lobby, player);

    sendQuickPartyMatchmakingUpdate(client, lobby, party.partyCode, party.partyId);
    sendQuickPartyJoined(client, lobby, party.partyCode, party.partyId, { isPartyLeader: true });
    this.broadcastLobbyUpdate(lobby);
    return lobby;
  };

  const originalJoinPrivateLobby = proto.joinPrivateLobby;
  proto.joinPrivateLobby = function joinLobbyOrQuickParty(playerId, requestedCode) {
    const quickPartyLobby = joinQuickPartyByCode(this, playerId, requestedCode);
    if (quickPartyLobby) return quickPartyLobby;
    return originalJoinPrivateLobby.call(this, playerId, requestedCode);
  };

  proto.requestPartyInvite = function requestPartyInvite(playerId, targetPlayerId, options = {}) {
    if (!targetPlayerId || targetPlayerId === playerId) return false;
    const { client, lobby, player: from } = findPlayerLobby(this, playerId);
    if (!lobby || !from) return false;
    if (lobby.mode !== LOBBY_MODES.QUICK_MATCH) throw new Error("Party invites are only available in Quick Match.");

    const to = lobby.players.find(candidate => candidate.id === targetPlayerId);
    if (!to) throw new Error("That crawler is not in your Quick Match run.");
    if (from.crawlerState?.currentFloor !== to.crawlerState?.currentFloor) throw new Error("Direct party invites require the same floor.");
    if (options.method === "interact") {
      const distance = Math.hypot((from.crawlerState?.x ?? Infinity) - (to.crawlerState?.x ?? -Infinity), (from.crawlerState?.y ?? Infinity) - (to.crawlerState?.y ?? -Infinity));
      if (!Number.isFinite(distance) || distance > 96) throw new Error("Move closer to invite that crawler.");
    }

    assignSoloQuickParty(this, lobby, from);
    assignSoloQuickParty(this, lobby, to);
    if (from.partyId === to.partyId) {
      safeSend(client.ws, SERVER_MESSAGES.PARTY_RESPONSE, {
        lobbyCode: lobby.code,
        accepted: true,
        alreadyParty: true,
        partyCode: from.partyCode,
        partyId: from.partyId,
        targetPlayerId: to.id,
        targetName: to.name
      });
      return true;
    }

    if (getPartySize(lobby, to.partyId) > 1) throw new Error(`${to.name} is already in another party.`);

    expireOldInvites(lobby);
    const invite = {
      fromPlayerId: from.id,
      fromName: from.name,
      toPlayerId: to.id,
      fromPartyId: from.partyId,
      fromPartyCode: from.partyCode,
      createdAt: Date.now(),
      expiresAt: Date.now() + PARTY_INVITE_TTL_MS
    };
    ensurePartyInviteMap(lobby).set(inviteKey(from.id, to.id), invite);

    const targetClient = this.clients.get(to.id);
    if (targetClient) {
      safeSend(targetClient.ws, SERVER_MESSAGES.PARTY_INVITE_RECEIVED, {
      lobbyCode: lobby.code,
      fromPlayerId: from.id,
      fromName: from.name,
      fromPartyId: from.partyId,
      fromPartyCode: from.partyCode,
      expiresAt: new Date(invite.expiresAt).toISOString()
      });
      safeSend(targetClient.ws, SERVER_MESSAGES.PARTY_INVITE, {
      lobbyCode: lobby.code,
      fromPlayerId: from.id,
      fromName: from.name,
      fromPartyId: from.partyId,
      fromPartyCode: from.partyCode,
      expiresAt: new Date(invite.expiresAt).toISOString()
      });
    }

    safeSend(client.ws, SERVER_MESSAGES.PARTY_RESPONSE, {
      lobbyCode: lobby.code,
      pending: true,
      accepted: false,
      partyCode: from.partyCode,
      partyId: from.partyId,
      targetPlayerId: to.id,
      targetName: to.name
    });
    return true;
  };

  proto.respondPartyInvite = function respondPartyInvite(playerId, fromPlayerId, accepted = false) {
    if (!fromPlayerId || fromPlayerId === playerId) return false;
    const { client, lobby, player: to } = findPlayerLobby(this, playerId);
    if (!lobby || !to) return false;

    expireOldInvites(lobby);
    const invites = ensurePartyInviteMap(lobby);
    const key = inviteKey(fromPlayerId, playerId);
    const invite = invites.get(key);
    if (!invite) throw new Error("That party invite expired.");
    invites.delete(key);

    const from = lobby.players.find(candidate => candidate.id === fromPlayerId);
    if (!from) throw new Error("That crawler left the match.");

    if (!accepted) {
      const sourceClient = this.clients.get(from.id);
      if (sourceClient) safeSend(sourceClient.ws, SERVER_MESSAGES.PARTY_RESPONSE, {
        lobbyCode: lobby.code,
        accepted: false,
        targetPlayerId: to.id,
        targetName: to.name
      });
      safeSend(client.ws, SERVER_MESSAGES.PARTY_RESPONSE, {
        lobbyCode: lobby.code,
        accepted: false,
        fromPlayerId: from.id,
        fromName: from.name
      });
      return true;
    }

    assignSoloQuickParty(this, lobby, from);
    assignSoloQuickParty(this, lobby, to);
    if (getPartySize(lobby, to.partyId) > 1 && to.partyId !== from.partyId) throw new Error(`${to.name} is already in another party.`);

    const oldPartyCode = to.partyCode;
    cleanupSoloPartyCode(lobby, to);
    to.partyId = from.partyId;
    to.partyCode = from.partyCode;
    to.isPartyLeader = false;
    if (oldPartyCode && oldPartyCode !== from.partyCode) lobby.partyCodes?.delete(oldPartyCode);

    const sourceClient = this.clients.get(from.id);
    if (sourceClient) safeSend(sourceClient.ws, SERVER_MESSAGES.PARTY_RESPONSE, {
      lobbyCode: lobby.code,
      accepted: true,
      partyCode: from.partyCode,
      partyId: from.partyId,
      targetPlayerId: to.id,
      targetName: to.name
    });
    safeSend(client.ws, SERVER_MESSAGES.PARTY_RESPONSE, {
      lobbyCode: lobby.code,
      accepted: true,
      partyCode: from.partyCode,
      partyId: from.partyId,
      fromPlayerId: from.id,
      fromName: from.name
    });

    this.broadcastLobbyUpdate(lobby);
    this.broadcastCrawlerSnapshot(lobby, { force: true });
    return true;
  };

  const originalMarkCrawlerAtFloor0Stairs = proto.markCrawlerAtFloor0Stairs;
  proto.markCrawlerAtFloor0Stairs = function markCrawlerAtFloor0StairsWithExpiredCollapseResolve(playerId) {
    const client = this.requireClient(playerId);
    const lobby = client.lobbyCode ? this.lobbies.get(client.lobbyCode) : null;
    const result = originalMarkCrawlerAtFloor0Stairs.call(this, playerId);
    const player = lobby?.players.find(candidate => candidate.id === playerId);

    if (
      lobby &&
      lobby.status === LOBBY_STATUS.STAGING &&
      player &&
      FLOOR0_STAIRS_STATUSES.has(player.floor0Status) &&
      Date.now() >= lobby.floor0CollapseAt
    ) {
      if (lobby.floor0CollapseTimer) {
        clearTimeout(lobby.floor0CollapseTimer);
        lobby.floor0CollapseTimer = null;
      }
      setTimeout(() => this.resolveFloor0Collapse(lobby.code), 0);
    }

    return result;
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
