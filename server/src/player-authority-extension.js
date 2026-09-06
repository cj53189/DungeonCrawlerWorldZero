const { SERVER_MESSAGES, safeSend } = require("./protocol");

function resetPlayerLifeAuthority(player) {
  if (!player) return;
  player.pvpDowned = false;
  player.pvpDamageAuthorityUntil = 0;
  player.lastPvpDownCredit = null;
  player.playerCorpseId = null;
}

function isCrawlerDowned(player) {
  return !!(
    player?.pvpDowned ||
    player?.crawlerState?.status === "downed" ||
    Number(player?.crawlerState?.hp) <= 0
  );
}

function applyPlayerAuthorityExtension(LobbyManager) {
  if (!LobbyManager?.prototype || LobbyManager.prototype.__playerAuthorityExtensionApplied) return;
  LobbyManager.prototype.__playerAuthorityExtensionApplied = true;

  const originalAddPlayerToLobby = LobbyManager.prototype.addPlayerToLobby;
  LobbyManager.prototype.addPlayerToLobby = function addPlayerToLobbyWithLifeAuthority(lobby, client, options = {}) {
    const result = originalAddPlayerToLobby.apply(this, [lobby, client, options]);
    const player = lobby?.players?.find(candidate => candidate.id === client?.playerId);
    if (player && typeof player.pvpDowned !== "boolean") resetPlayerLifeAuthority(player);
    return result;
  };

  const originalStartNextFloor = LobbyManager.prototype.startNextFloor;
  LobbyManager.prototype.startNextFloor = function startNextFloorWithFreshLives(lobby, advancingPlayers, floor) {
    for (const player of advancingPlayers || []) resetPlayerLifeAuthority(player);
    return originalStartNextFloor.apply(this, [lobby, advancingPlayers, floor]);
  };

  const originalUpdateCrawlerState = LobbyManager.prototype.updateCrawlerState;
  LobbyManager.prototype.updateCrawlerState = function updateCrawlerStateWithDeathFinality(playerId, state = {}) {
    const client = this.clients?.get(playerId);
    const lobby = client?.lobbyCode ? this.lobbies?.get(client.lobbyCode) : null;
    const player = lobby?.players?.find(candidate => candidate.id === playerId);

    if (player?.pvpDowned) {
      return originalUpdateCrawlerState.apply(this, [playerId, {
        ...state,
        hp: 0,
        status: "downed"
      }]);
    }

    return originalUpdateCrawlerState.apply(this, [playerId, state]);
  };

  const originalHandlePvpDamage = LobbyManager.prototype.handlePvpDamage;
  LobbyManager.prototype.handlePvpDamage = function handlePvpDamageWithDeathFinality(playerId, message = {}) {
    const client = this.clients?.get(playerId);
    const lobby = client?.lobbyCode ? this.lobbies?.get(client.lobbyCode) : null;
    const attacker = lobby?.players?.find(candidate => candidate.id === playerId);

    if (isCrawlerDowned(attacker)) {
      if (client?.ws) safeSend(client.ws, SERVER_MESSAGES.ERROR, { message: "PvP damage rejected: attacker downed" });
      return false;
    }

    const targetId = String(message.targetPlayerId || "");
    const target = lobby?.players?.find(candidate => candidate.id === targetId);
    const accepted = originalHandlePvpDamage.apply(this, [playerId, message]);

    if (accepted && target && isCrawlerDowned(target)) {
      target.pvpDowned = true;
    }

    return accepted;
  };
}

module.exports = {
  applyPlayerAuthorityExtension,
  isCrawlerDowned,
  resetPlayerLifeAuthority
};
