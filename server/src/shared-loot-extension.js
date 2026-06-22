const { randomUUID } = require("crypto");

function clonePlain(value, fallback = null) {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function sanitizeLootItem(item, index = 0) {
  if (!item || typeof item !== "object") return null;
  const copy = clonePlain(item, null);
  if (!copy || typeof copy !== "object") return null;
  copy.id = String(copy.id || `shared_loot_${Date.now()}_${index}_${randomUUID().replace(/-/g, "").slice(0, 8)}`).slice(0, 80);
  copy.type = String(copy.type || "loot").slice(0, 32);
  copy.name = String(copy.name || (copy.type === "coins" ? "Coins" : "Loot")).slice(0, 120);
  if (copy.type === "coins") copy.amount = Math.max(0, Math.trunc(Number(copy.amount) || 0));
  return copy;
}

function sanitizeLootContainer(raw, lobby) {
  const source = raw?.container && typeof raw.container === "object" ? raw.container : raw;
  if (!source || typeof source !== "object") return null;
  const id = typeof source.id === "string" ? source.id.slice(0, 100) : (typeof raw?.id === "string" ? raw.id.slice(0, 100) : null);
  if (!id) return null;

  const x = Number(source.x);
  const y = Number(source.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const loot = Array.isArray(source.loot)
    ? source.loot.map((item, index) => sanitizeLootItem(item, index)).filter(Boolean).slice(0, 24)
    : [];

  return {
    id,
    kind: String(source.kind || (source.boss ? "bossLoot" : "lootContainer")).slice(0, 32),
    boss: !!source.boss,
    enemyId: typeof source.enemyId === "string" ? source.enemyId.slice(0, 100) : null,
    floor: Math.trunc(Number(source.floor ?? lobby?.floor ?? 0) || 0),
    x,
    y,
    roomId: Number.isFinite(Number(source.roomId)) ? Math.trunc(Number(source.roomId)) : null,
    r: Math.max(8, Math.min(40, Number(source.r) || (source.boss ? 20 : 12))),
    name: String(source.name || (source.boss ? "Boss Loot" : "Loot Container")).slice(0, 120),
    loot,
    looted: !!source.looted || loot.length === 0,
    createdAt: Number(source.createdAt) || Date.now(),
    updatedAt: Date.now(),
    version: Math.max(1, Math.trunc(Number(source.version) || 1))
  };
}

function applySharedLootExtension(LobbyManager) {
  if (!LobbyManager?.prototype || LobbyManager.prototype.__sharedLootExtensionApplied) return;
  LobbyManager.prototype.__sharedLootExtensionApplied = true;

  const originalCreateFloorWorldState = LobbyManager.prototype.createFloorWorldState;
  LobbyManager.prototype.createFloorWorldState = function createFloorWorldStateWithSharedLoot(...args) {
    const world = originalCreateFloorWorldState.apply(this, args);
    if (!world.lootContainers) world.lootContainers = new Map();
    return world;
  };

  const originalFloorWorldStatePayload = LobbyManager.prototype.floorWorldStatePayload;
  LobbyManager.prototype.floorWorldStatePayload = function floorWorldStatePayloadWithSharedLoot(lobby, floor = lobby.floor) {
    const payload = originalFloorWorldStatePayload.apply(this, [lobby, floor]);
    const world = lobby.floorWorldStates?.get(floor) || this.currentWorldState(lobby);
    payload.lootContainers = Array.from((world.lootContainers || new Map()).values())
      .filter(container => !container.looted)
      .map(container => ({ ...container, loot: (container.loot || []).map(item => ({ ...item })) }));
    return payload;
  };

  LobbyManager.prototype.acceptWorldEventId = function acceptWorldEventId(lobby, eventId) {
    if (!lobby.acceptedWorldEventIds) lobby.acceptedWorldEventIds = new Set();
    if (lobby.acceptedWorldEventIds.has(eventId)) return false;
    lobby.acceptedWorldEventIds.add(eventId);
    return true;
  };

  LobbyManager.prototype.applyLootContainerSpawned = function applyLootContainerSpawned(lobby, event) {
    const world = this.currentWorldState(lobby);
    if (!world.lootContainers) world.lootContainers = new Map();
    const container = sanitizeLootContainer(event, lobby);
    if (!container) return null;
    if (container.floor !== lobby.floor) return null;

    const eventId = typeof event.eventId === "string" ? event.eventId.slice(0, 120) : `loot_container_spawned:${container.id}`;
    if (!this.acceptWorldEventId(lobby, eventId)) return null;
    if (world.takenLootIds?.has(container.id)) return { type: "loot_taken", id: container.id, eventId: `loot_taken:${container.id}` };

    const existing = world.lootContainers.get(container.id);
    const canonical = existing
      ? { ...existing, updatedAt: Date.now(), version: Math.max(existing.version || 1, container.version || 1) }
      : container;
    world.lootContainers.set(container.id, canonical);

    return {
      type: "loot_container_spawned",
      id: canonical.id,
      eventId,
      container: { ...canonical, loot: (canonical.loot || []).map(item => ({ ...item })) }
    };
  };

  LobbyManager.prototype.markSharedLootContainerTaken = function markSharedLootContainerTaken(lobby, id) {
    const world = this.currentWorldState(lobby);
    if (!world.lootContainers) world.lootContainers = new Map();
    const container = world.lootContainers.get(id);
    if (container) {
      container.loot = [];
      container.looted = true;
      container.updatedAt = Date.now();
      world.lootContainers.delete(id);
    }
  };

  const originalApplyFloor0WorldEvent = LobbyManager.prototype.applyFloor0WorldEvent;
  LobbyManager.prototype.applyFloor0WorldEvent = function applyFloor0WorldEventWithSharedLoot(lobby, event) {
    const type = String(event?.type || "");
    if (type === "loot_container_spawned") return this.applyLootContainerSpawned(lobby, event);

    const normalized = originalApplyFloor0WorldEvent.apply(this, [lobby, event]);
    if (normalized && (type === "loot_taken" || type === "loot_container_looted")) {
      this.markSharedLootContainerTaken(lobby, normalized.id || event.id);
    }
    return normalized;
  };
}

module.exports = { applySharedLootExtension };
