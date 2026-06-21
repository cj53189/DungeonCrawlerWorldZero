drawDynamicMarkers = true;

(function installPersistentBossLootHotfix() {
  if (window.__dcwPersistentBossLootHotfix) return;
  window.__dcwPersistentBossLootHotfix = true;

  function bossCorpseId(enemy) {
    return enemy?.enemyId ? `corpse_${enemy.enemyId}` : null;
  }

  function findEnemyById(enemyId) {
    if (!enemyId || !Array.isArray(enemies)) return null;
    return enemies.find(candidate => candidate?.enemyId === enemyId) || null;
  }

  function decorateBossCorpse(corpse, enemy, source = "unknown") {
    if (!corpse || !enemy?.boss) return corpse;
    corpse.enemyId = enemy.enemyId || corpse.enemyId || null;
    corpse.boss = true;
    corpse.kind = "bossLoot";
    corpse.persistent = true;
    corpse.r = Math.max(Number(corpse.r) || 0, 20);
    corpse.name = `${enemy.name || "Boss"} Loot`;
    corpse.createdFrom = corpse.createdFrom || source;
    corpse.createdAtFrame = corpse.createdAtFrame || (typeof frameCount === "number" ? frameCount : 0);
    if (!Array.isArray(corpse.loot)) corpse.loot = [];
    return corpse;
  }

  function ensureBossLootContainer(enemy, source = "unknown") {
    if (!enemy?.boss || Number(enemy.hp) > 0) return null;
    const id = bossCorpseId(enemy);
    if (id && multiplayer?.floor0WorldState?.takenLootIds?.has?.(id)) return null;

    const existing = id && typeof getCorpseById === "function" ? getCorpseById(id) : null;
    if (existing) return decorateBossCorpse(existing, enemy, source);
    if (typeof createCorpse !== "function") return null;

    const corpse = createCorpse(enemy);
    if (!corpse) return null;
    decorateBossCorpse(corpse, enemy, source);
    minimapDirty = true;

    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[BossLoot] persistent boss loot container ensured", {
        source,
        corpseId: corpse.id,
        enemyId: enemy.enemyId || null,
        lootCount: corpse.loot?.length || 0
      });
    }
    return corpse;
  }

  window.ensureBossLootContainer = ensureBossLootContainer;

  if (typeof createCorpse === "function" && !createCorpse.__persistentBossLootWrapped) {
    const originalCreateCorpse = createCorpse;
    createCorpse = function createCorpseWithPersistentBossLoot(enemy, ...args) {
      const corpse = originalCreateCorpse.apply(this, [enemy, ...args]);
      return decorateBossCorpse(corpse, enemy, "createCorpse");
    };
    createCorpse.__persistentBossLootWrapped = true;
  }

  if (typeof damageEnemy === "function" && !damageEnemy.__persistentBossLootWrapped) {
    const originalDamageEnemy = damageEnemy;
    damageEnemy = function damageEnemyWithPersistentBossLoot(enemy, ...args) {
      const wasAliveBoss = !!(enemy?.boss && Number(enemy.hp) > 0);
      const result = originalDamageEnemy.apply(this, [enemy, ...args]);
      if (wasAliveBoss && Number(enemy.hp) <= 0) ensureBossLootContainer(enemy, "local_lethal_damage");
      return result;
    };
    damageEnemy.__persistentBossLootWrapped = true;
  }

  if (typeof applyFloor0EnemyState === "function" && !applyFloor0EnemyState.__persistentBossLootWrapped) {
    const originalApplyFloor0EnemyState = applyFloor0EnemyState;
    applyFloor0EnemyState = function applyFloor0EnemyStateWithPersistentBossLoot(state, ...args) {
      const enemyId = state?.enemyId || state?.id;
      const before = findEnemyById(enemyId);
      const result = originalApplyFloor0EnemyState.apply(this, [state, ...args]);
      const after = before || findEnemyById(enemyId);
      const stateSaysDead = state?.alive === false || Number(state?.hp) <= 0 || state?.status === "dead";
      if (after?.boss && (stateSaysDead || Number(after.hp) <= 0)) ensureBossLootContainer(after, "floor0_enemy_state");
      return result;
    };
    applyFloor0EnemyState.__persistentBossLootWrapped = true;
  }

  if (typeof applyFloor0WorldEvent === "function" && !applyFloor0WorldEvent.__persistentBossLootWrapped) {
    const originalApplyFloor0WorldEvent = applyFloor0WorldEvent;
    applyFloor0WorldEvent = function applyFloor0WorldEventWithPersistentBossLoot(event, ...args) {
      const result = originalApplyFloor0WorldEvent.apply(this, [event, ...args]);
      const type = String(event?.type || "");
      if (type === "enemy_killed") {
        const enemyState = event.enemy || event;
        const enemy = findEnemyById(enemyState?.enemyId || enemyState?.id);
        if (enemy?.boss) ensureBossLootContainer(enemy, "floor0_world_event");
      }
      return result;
    };
    applyFloor0WorldEvent.__persistentBossLootWrapped = true;
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
