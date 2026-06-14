function resolveBossUnlockFromSyncedEnemyState(state) {
  if (!state?.enemyId || currentFloor !== 0) return;

  const defeated = state.alive === false || state.status === "dead" || Number(state.hp) <= 0;
  if (!defeated) return;

  const enemy = Array.isArray(enemies) ? enemies.find(candidate => candidate.enemyId === state.enemyId) : null;
  const matchesBoss = !!enemy?.boss || (!!bossEnemy?.enemyId && bossEnemy.enemyId === state.enemyId);
  if (!matchesBoss) return;

  const resolvedBoss = enemy || bossEnemy || { boss: true, name: "the boss" };
  resolvedBoss.hp = 0;
  resolvedBoss.isDying = false;
  resolvedBoss.pendingAttack = null;
  resolvedBoss.deathAnimationComplete = true;
  if (bossEnemy && bossEnemy.enemyId === state.enemyId) bossEnemy.hp = 0;

  if (typeof completeBossEncounter === "function") {
    completeBossEncounter(resolvedBoss);
  } else {
    bossAggroed = false;
    bossDoorsLocked = false;
    pendingBossLocks = [];
    if (typeof clearBossLocks === "function") clearBossLocks();
    if (bossRoom) {
      bossRoom.cleared = true;
      bossRoom.locked = false;
      if (typeof unlockBossDoors === "function") unlockBossDoors(bossRoom);
    }
  }
}

const applyFloor0EnemyStateWithoutBossUnlock = typeof applyFloor0EnemyState === "function" ? applyFloor0EnemyState : null;
if (applyFloor0EnemyStateWithoutBossUnlock) {
  applyFloor0EnemyState = function applyFloor0EnemyStateWithBossUnlock(state, options = {}) {
    const result = applyFloor0EnemyStateWithoutBossUnlock(state, options);
    resolveBossUnlockFromSyncedEnemyState(state);
    return result;
  };
}
