function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeEventId(type, id, event = {}) {
  return typeof event.eventId === "string" ? event.eventId.slice(0, 120) : `${type}:${id}`;
}

function nextEnemyRevision(lobby) {
  lobby.enemyAuthorityRevision = Math.max(0, Math.trunc(Number(lobby.enemyAuthorityRevision) || 0)) + 1;
  return lobby.enemyAuthorityRevision;
}

function clampEnemyStateAgainstExisting(state, existing = null, { killed = false } = {}) {
  if (!state?.enemyId) return null;
  const merged = { ...(existing || { enemyId: state.enemyId, alive: true }), ...state };

  const incomingHp = finiteNumber(state.hp);
  const existingHp = finiteNumber(existing?.hp);
  if (existing?.alive === false || killed || state.alive === false || incomingHp === 0) {
    merged.alive = false;
    merged.hp = 0;
  } else {
    merged.alive = true;
    if (incomingHp !== null && existingHp !== null) merged.hp = Math.min(existingHp, Math.max(0, incomingHp));
    else if (incomingHp !== null) merged.hp = Math.max(0, incomingHp);
    else if (existingHp !== null) merged.hp = Math.max(0, existingHp);
  }

  if (finiteNumber(merged.maxHp) !== null) merged.maxHp = Math.max(1, Number(merged.maxHp));
  return merged;
}

function applyEnemyAuthorityExtension(LobbyManager) {
  if (!LobbyManager?.prototype || LobbyManager.prototype.__enemyAuthorityExtensionApplied) return;
  LobbyManager.prototype.__enemyAuthorityExtensionApplied = true;

  const originalCreateLobby = LobbyManager.prototype.createLobby;
  LobbyManager.prototype.createLobby = function createLobbyWithEnemyAuthority(args) {
    const lobby = originalCreateLobby.call(this, args);
    lobby.enemyAuthorityRevision = 0;
    return lobby;
  };

  const originalFloorWorldStatePayload = LobbyManager.prototype.floorWorldStatePayload;
  LobbyManager.prototype.floorWorldStatePayload = function floorWorldStatePayloadWithEnemyAuthority(lobby, floor = lobby.floor) {
    const payload = originalFloorWorldStatePayload.apply(this, [lobby, floor]);
    payload.enemyAuthorityRevision = Math.max(0, Math.trunc(Number(lobby.enemyAuthorityRevision) || 0));
    return payload;
  };

  const originalApplyFloor0WorldEvent = LobbyManager.prototype.applyFloor0WorldEvent;
  LobbyManager.prototype.applyFloor0WorldEvent = function applyFloor0WorldEventWithEnemyAuthority(lobby, event) {
    const type = String(event?.type || "");
    if (type !== "enemy_damaged" && type !== "enemy_killed") {
      return originalApplyFloor0WorldEvent.apply(this, [lobby, event]);
    }

    const world = this.currentWorldState(lobby);
    const rawState = this.sanitizeEnemyState(event.enemy || event);
    if (!rawState?.enemyId) return null;

    const id = rawState.enemyId;
    const eventId = normalizeEventId(type, id, event);
    if (!lobby.acceptedWorldEventIds) lobby.acceptedWorldEventIds = new Set();
    if (lobby.acceptedWorldEventIds.has(eventId)) return null;

    const existing = world.enemyStates.get(id) || { enemyId: id, alive: true };
    const merged = clampEnemyStateAgainstExisting(rawState, existing, { killed: type === "enemy_killed" });
    if (!merged) return null;

    merged.updatedAt = Date.now();
    merged.lastEventId = eventId;
    merged.serverRevision = nextEnemyRevision(lobby);
    if (typeof event.sourcePlayerId === "string") merged.sourcePlayerId = event.sourcePlayerId.slice(0, 80);

    world.enemyStates.set(id, merged);
    lobby.acceptedWorldEventIds.add(eventId);

    return { type, id, eventId, enemy: { ...merged } };
  };

  const originalUpdateFloor0EnemySnapshot = LobbyManager.prototype.updateFloor0EnemySnapshot;
  LobbyManager.prototype.updateFloor0EnemySnapshot = function updateFloor0EnemySnapshotWithEnemyAuthority(playerId, message = {}) {
    const client = this.requireClient(playerId);
    const lobby = client?.lobbyCode ? this.lobbies.get(client.lobbyCode) : null;
    const world = lobby ? this.currentWorldState(lobby) : null;
    if (!world || !Array.isArray(message.enemies)) return originalUpdateFloor0EnemySnapshot.apply(this, [playerId, message]);

    const protectedEnemies = message.enemies.map(raw => {
      const state = this.sanitizeEnemyState(raw);
      if (!state?.enemyId) return raw;
      const existing = world.enemyStates.get(state.enemyId);
      if (!existing) return raw;
      const clamped = clampEnemyStateAgainstExisting({ ...raw, enemyId: state.enemyId, hp: state.hp, alive: state.alive }, existing);
      return {
        ...raw,
        alive: clamped.alive,
        hp: clamped.hp,
        serverRevision: Math.max(Math.trunc(Number(existing.serverRevision) || 0), Math.trunc(Number(raw.serverRevision) || 0))
      };
    });

    return originalUpdateFloor0EnemySnapshot.apply(this, [playerId, { ...message, enemies: protectedEnemies }]);
  };
}

module.exports = { applyEnemyAuthorityExtension };
