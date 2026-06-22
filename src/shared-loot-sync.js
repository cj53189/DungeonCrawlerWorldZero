(function installSharedLootSync() {
  if (window.__dcwSharedLootSyncInstalled) return;
  window.__dcwSharedLootSyncInstalled = true;

  function clonePlain(value, fallback = null) {
    if (value === undefined) return fallback;
    try { return JSON.parse(JSON.stringify(value)); }
    catch { return fallback; }
  }

  function isServerSharedRun() {
    return !!(multiplayer?.enabled && multiplayer?.usingServer && typeof sendMultiplayerMessage === "function");
  }

  function ensureSharedLootState() {
    if (!multiplayer.floor0WorldState) {
      multiplayer.floor0WorldState = {
        openedDoorIds: new Set(),
        openedChestIds: new Set(),
        takenLootIds: new Set(),
        enemyStates: new Map(),
        lootContainers: new Map()
      };
    }
    if (!multiplayer.floor0WorldState.takenLootIds) multiplayer.floor0WorldState.takenLootIds = new Set();
    if (!multiplayer.floor0WorldState.lootContainers) multiplayer.floor0WorldState.lootContainers = new Map();
    return multiplayer.floor0WorldState;
  }

  function sharedCorpseId(enemy) {
    return enemy?.enemyId ? `corpse_${enemy.enemyId}` : null;
  }

  function findEnemyById(enemyId) {
    if (!enemyId || !Array.isArray(enemies)) return null;
    return enemies.find(candidate => candidate?.enemyId === enemyId) || null;
  }

  function normalizeSharedLootContainer(raw) {
    const source = raw?.container && typeof raw.container === "object" ? raw.container : raw;
    if (!source || typeof source !== "object" || !source.id) return null;
    const x = Number(source.x);
    const y = Number(source.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      id: String(source.id),
      kind: String(source.kind || (source.boss ? "bossLoot" : "lootContainer")),
      boss: !!source.boss,
      enemyId: source.enemyId || null,
      floor: Number.isFinite(Number(source.floor)) ? Math.trunc(Number(source.floor)) : currentFloor,
      x,
      y,
      roomId: Number.isFinite(Number(source.roomId)) ? Math.trunc(Number(source.roomId)) : null,
      r: Math.max(8, Number(source.r) || (source.boss ? 20 : 12)),
      name: source.name || (source.boss ? "Boss Loot" : "Loot Container"),
      loot: Array.isArray(source.loot) ? source.loot.map(item => clonePlain(item, { ...item })).filter(Boolean) : [],
      looted: !!source.looted,
      persistent: true,
      createdAt: Number(source.createdAt) || Date.now(),
      updatedAt: Number(source.updatedAt) || Date.now(),
      version: Math.max(1, Math.trunc(Number(source.version) || 1))
    };
  }

  function serializeLootContainer(corpse) {
    if (!corpse?.id) return null;
    return {
      id: corpse.id,
      kind: corpse.kind || (corpse.boss ? "bossLoot" : "lootContainer"),
      boss: !!corpse.boss,
      enemyId: corpse.enemyId || null,
      floor: Number.isFinite(Number(corpse.floor)) ? Math.trunc(Number(corpse.floor)) : currentFloor,
      x: corpse.x,
      y: corpse.y,
      roomId: Number.isFinite(Number(corpse.roomId)) ? Math.trunc(Number(corpse.roomId)) : null,
      r: corpse.r,
      name: corpse.name,
      loot: Array.isArray(corpse.loot) ? corpse.loot.map(item => clonePlain(item, { ...item })).filter(Boolean) : [],
      looted: !!corpse.looted,
      version: Math.max(1, Math.trunc(Number(corpse.version) || 1)),
      createdAt: Number(corpse.createdAt) || Date.now()
    };
  }

  function sendSharedWorldEvent(event) {
    if (!isServerSharedRun() || !event?.type || !event.id) return false;
    return sendMultiplayerMessage("floor0_world_event", {
      event: {
        ...event,
        runId: multiplayer.currentRunId || undefined,
        currentFloor,
        floor: currentFloor
      },
      runId: multiplayer.currentRunId || undefined,
      currentFloor,
      floor: currentFloor
    });
  }

  function sendSharedLootContainerSpawn(corpse, source = "unknown") {
    if (!corpse?.id || corpse.looted || corpse.__sharedLootSpawnSent) return false;
    const container = serializeLootContainer(corpse);
    if (!container || !container.loot?.length) return false;
    const sent = sendSharedWorldEvent({
      type: "loot_container_spawned",
      id: container.id,
      eventId: `loot_container_spawned:${container.id}`,
      source,
      container
    });
    if (sent) corpse.__sharedLootSpawnSent = true;
    return sent;
  }

  function sendSharedLootTaken(corpseOrId) {
    const id = typeof corpseOrId === "string" ? corpseOrId : corpseOrId?.id;
    if (!id) return false;
    return sendSharedWorldEvent({
      type: "loot_taken",
      id,
      eventId: `loot_taken:${id}`
    });
  }

  function decorateBossLootContainer(corpse, enemy, source = "unknown") {
    if (!corpse || !enemy?.boss) return corpse;
    corpse.enemyId = enemy.enemyId || corpse.enemyId || null;
    corpse.boss = true;
    corpse.kind = "bossLoot";
    corpse.persistent = true;
    corpse.floor = Number.isFinite(Number(corpse.floor)) ? Math.trunc(Number(corpse.floor)) : currentFloor;
    corpse.r = Math.max(Number(corpse.r) || 0, 20);
    corpse.name = `${enemy.name || "Boss"} Loot`;
    corpse.createdFrom = corpse.createdFrom || source;
    corpse.createdAt = corpse.createdAt || Date.now();
    if (!Array.isArray(corpse.loot)) corpse.loot = [];
    ensureSharedLootState().lootContainers.set(corpse.id, serializeLootContainer(corpse));
    sendSharedLootContainerSpawn(corpse, source);
    return corpse;
  }

  function applySharedLootContainer(rawContainer) {
    const container = normalizeSharedLootContainer(rawContainer);
    if (!container || container.floor !== currentFloor) return false;
    const shared = ensureSharedLootState();
    if (shared.takenLootIds?.has(container.id) || container.looted) {
      removeSharedLootContainer(container.id, { sync: false, announce: false });
      return false;
    }

    shared.lootContainers.set(container.id, clonePlain(container, container));
    let corpse = typeof getCorpseById === "function" ? getCorpseById(container.id) : null;
    if (corpse) {
      Object.assign(corpse, container, { persistent: true, looted: false });
    } else if (Array.isArray(corpses)) {
      corpse = { ...container, persistent: true, looted: false };
      corpses.push(corpse);
    }
    minimapDirty = true;
    return true;
  }

  function removeSharedLootContainer(id, options = {}) {
    if (!id) return false;
    const shared = ensureSharedLootState();
    shared.takenLootIds.add(id);
    shared.lootContainers.delete(id);
    const corpse = typeof getCorpseById === "function" ? getCorpseById(id) : null;
    if (corpse) {
      if (typeof markCorpseLooted === "function") markCorpseLooted(corpse, { sync: false, announce: options.announce === true });
      else {
        corpse.loot = [];
        corpse.looted = true;
      }
    }
    return true;
  }

  function ensureBossLootContainer(enemy, source = "unknown") {
    if (!enemy?.boss || Number(enemy.hp) > 0) return null;
    const id = sharedCorpseId(enemy);
    const shared = ensureSharedLootState();
    if (id && shared.takenLootIds?.has(id)) return null;
    const existingShared = id ? shared.lootContainers.get(id) : null;
    if (existingShared) {
      applySharedLootContainer(existingShared);
      return typeof getCorpseById === "function" ? getCorpseById(id) : null;
    }
    const existing = id && typeof getCorpseById === "function" ? getCorpseById(id) : null;
    if (existing) return decorateBossLootContainer(existing, enemy, source);
    if (typeof createCorpse !== "function") return null;
    return decorateBossLootContainer(createCorpse(enemy), enemy, source);
  }

  window.ensureBossLootContainer = ensureBossLootContainer;
  window.applySharedLootContainer = applySharedLootContainer;

  if (typeof resetFloor0WorldState === "function" && !resetFloor0WorldState.__sharedLootWrapped) {
    const originalResetFloor0WorldState = resetFloor0WorldState;
    resetFloor0WorldState = function resetFloor0WorldStateWithSharedLoot(...args) {
      const result = originalResetFloor0WorldState.apply(this, args);
      ensureSharedLootState();
      return result;
    };
    resetFloor0WorldState.__sharedLootWrapped = true;
  }

  if (typeof createCorpse === "function" && !createCorpse.__sharedLootWrapped) {
    const originalCreateCorpse = createCorpse;
    createCorpse = function createCorpseWithSharedLoot(enemy, ...args) {
      const corpse = originalCreateCorpse.apply(this, [enemy, ...args]);
      if (corpse && enemy?.boss) decorateBossLootContainer(corpse, enemy, "createCorpse");
      return corpse;
    };
    createCorpse.__sharedLootWrapped = true;
  }

  if (typeof damageEnemy === "function" && !damageEnemy.__sharedLootWrapped) {
    const originalDamageEnemy = damageEnemy;
    damageEnemy = function damageEnemyWithSharedLoot(enemy, ...args) {
      const wasAliveBoss = !!(enemy?.boss && Number(enemy.hp) > 0);
      const result = originalDamageEnemy.apply(this, [enemy, ...args]);
      if (wasAliveBoss && Number(enemy.hp) <= 0) ensureBossLootContainer(enemy, "local_lethal_damage");
      return result;
    };
    damageEnemy.__sharedLootWrapped = true;
  }

  if (typeof markCorpseLooted === "function" && !markCorpseLooted.__sharedLootWrapped) {
    const originalMarkCorpseLooted = markCorpseLooted;
    markCorpseLooted = function markCorpseLootedWithSharedLoot(corpse, options = {}) {
      const shouldSyncShared = options?.sync !== false && isServerSharedRun() && !!corpse?.id && (corpse.kind === "bossLoot" || corpse.persistent || corpse.boss);
      const result = originalMarkCorpseLooted.apply(this, [corpse, options]);
      if (result && shouldSyncShared) sendSharedLootTaken(corpse);
      return result;
    };
    markCorpseLooted.__sharedLootWrapped = true;
  }

  if (typeof applyFloor0WorldEvent === "function" && !applyFloor0WorldEvent.__sharedLootWrapped) {
    const originalApplyFloor0WorldEvent = applyFloor0WorldEvent;
    applyFloor0WorldEvent = function applyFloor0WorldEventWithSharedLoot(event, ...args) {
      if (event?.type === "loot_container_spawned") return applySharedLootContainer(event.container || event);
      const result = originalApplyFloor0WorldEvent.apply(this, [event, ...args]);
      if (event?.type === "loot_taken" || event?.type === "loot_container_looted") removeSharedLootContainer(event.id, { sync: false, announce: false });
      if (event?.type === "enemy_killed") {
        const enemyState = event.enemy || event;
        const enemy = findEnemyById(enemyState?.enemyId || enemyState?.id);
        if (enemy?.boss) ensureBossLootContainer(enemy, "enemy_killed_event");
      }
      return result;
    };
    applyFloor0WorldEvent.__sharedLootWrapped = true;
  }

  if (typeof applyFloor0WorldState === "function" && !applyFloor0WorldState.__sharedLootWrapped) {
    const originalApplyFloor0WorldState = applyFloor0WorldState;
    applyFloor0WorldState = function applyFloor0WorldStateWithSharedLoot(messageOrState, ...args) {
      const result = originalApplyFloor0WorldState.apply(this, [messageOrState, ...args]);
      const worldState = messageOrState?.worldState || messageOrState;
      ensureSharedLootState();
      for (const container of worldState?.lootContainers || []) applySharedLootContainer(container);
      return result;
    };
    applyFloor0WorldState.__sharedLootWrapped = true;
  }

  if (typeof applyFloor0EnemyState === "function" && !applyFloor0EnemyState.__sharedLootWrapped) {
    const originalApplyFloor0EnemyState = applyFloor0EnemyState;
    applyFloor0EnemyState = function applyFloor0EnemyStateWithSharedLoot(state, ...args) {
      const enemyId = state?.enemyId || state?.id;
      const before = findEnemyById(enemyId);
      const result = originalApplyFloor0EnemyState.apply(this, [state, ...args]);
      const enemy = before || findEnemyById(enemyId);
      const stateSaysDead = state?.alive === false || Number(state?.hp) <= 0 || state?.status === "dead";
      if (enemy?.boss && (stateSaysDead || Number(enemy.hp) <= 0)) ensureBossLootContainer(enemy, "enemy_state_dead");
      return result;
    };
    applyFloor0EnemyState.__sharedLootWrapped = true;
  }

  setInterval(() => {
    if (gameWon || gameLost) return;
    if (bossEnemy?.boss && Number(bossEnemy.hp) <= 0) ensureBossLootContainer(bossEnemy, "boss_safety_sweep");
    if (Array.isArray(enemies)) {
      for (const enemy of enemies) {
        if (enemy?.boss && Number(enemy.hp) <= 0) ensureBossLootContainer(enemy, "boss_safety_sweep");
      }
    }
  }, 1000);
})();
