const { LOBBY_STATUS } = require("./protocol");

const RESOLVED_RUN_RETENTION_MS = 5 * 60 * 1000;
const DISCONNECTED_RUN_RETENTION_MS = 10 * 60 * 1000;

function isClientConnected(client) {
  return !!(client?.ws && Number(client.ws.readyState) === 1);
}

function resolvedRunExpired(lobby, now = Date.now()) {
  if (!lobby || lobby.floor !== 0 || lobby.status !== LOBBY_STATUS.START_PENDING) return false;
  const resolvedAt = Number(lobby.floor0CollapseAt ?? lobby.collapseAt ?? lobby.createdAt);
  return Number.isFinite(resolvedAt) && now - resolvedAt >= RESOLVED_RUN_RETENTION_MS;
}

function disconnectedRunExpired(manager, lobby, now = Date.now()) {
  if (!manager || !lobby?.players?.length) return false;
  if (lobby.joinState !== "locked" && lobby.status !== "active") return false;

  let latestDisconnectAt = Number(lobby.createdAt) || now;
  for (const player of lobby.players) {
    const client = manager.clients.get(player.id);
    if (isClientConnected(client)) return false;
    const disconnectedAt = Number(client?.disconnectedAt);
    if (Number.isFinite(disconnectedAt)) latestDisconnectAt = Math.max(latestDisconnectAt, disconnectedAt);
  }

  return now - latestDisconnectAt >= DISCONNECTED_RUN_RETENTION_MS;
}

function applyRunRetentionExtension(LobbyManager) {
  if (!LobbyManager?.prototype || LobbyManager.prototype.__runRetentionExtensionApplied) return;
  LobbyManager.prototype.__runRetentionExtensionApplied = true;

  const originalDestroyLobby = LobbyManager.prototype.destroyLobby;
  LobbyManager.prototype.destroyLobby = function destroyLobbyWithClientCleanup(lobby) {
    if (lobby?.players?.length) {
      for (const player of lobby.players) {
        const client = this.clients?.get(player.id);
        if (!client) continue;
        if (client.lobbyCode === lobby.code) client.lobbyCode = null;
        if (!isClientConnected(client) && client.disconnectedAt) this.clients.delete(player.id);
      }
    }
    return originalDestroyLobby.call(this, lobby);
  };

  const originalCleanupEmptyLobbies = LobbyManager.prototype.cleanupEmptyLobbies;
  LobbyManager.prototype.cleanupEmptyLobbies = function cleanupExpiredRuns() {
    const now = Date.now();
    const expired = [];

    for (const lobby of this.lobbies.values()) {
      if (resolvedRunExpired(lobby, now) || disconnectedRunExpired(this, lobby, now)) expired.push(lobby);
    }

    for (const lobby of expired) {
      if (this.lobbies.has(lobby.code)) this.destroyLobby(lobby);
    }

    return originalCleanupEmptyLobbies.call(this);
  };
}

module.exports = {
  DISCONNECTED_RUN_RETENTION_MS,
  RESOLVED_RUN_RETENTION_MS,
  applyRunRetentionExtension,
  disconnectedRunExpired,
  isClientConnected,
  resolvedRunExpired
};
