(function installEnemyAuthoritySync() {
  if (window.__dcwEnemyAuthoritySyncInstalled) return;
  window.__dcwEnemyAuthoritySyncInstalled = true;

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function cloneState(state) {
    return state && typeof state === "object" ? { ...state } : state;
  }

  function currentStoredEnemyState(enemyId) {
    return enemyId && multiplayer?.floor0WorldState?.enemyStates
      ? multiplayer.floor0WorldState.enemyStates.get(enemyId)
      : null;
  }

  function protectEnemyState(rawState) {
    if (!rawState?.enemyId) return rawState;
    const state = cloneState(rawState);
    const stored = currentStoredEnemyState(state.enemyId);
    if (!stored) return state;

    const incomingRevision = numeric(state.serverRevision);
    const storedRevision = numeric(stored.serverRevision);
    if (incomingRevision !== null && storedRevision !== null && incomingRevision < storedRevision) return null;

    const incomingHp = numeric(state.hp);
    const storedHp = numeric(stored.hp);
    if (stored.alive === false || storedHp === 0) {
      state.alive = false;
      state.hp = 0;
      return state;
    }

    if (incomingHp !== null && storedHp !== null && incomingHp > storedHp && !state.allowHpIncrease) {
      state.hp = storedHp;
    }
    return state;
  }

  if (typeof rememberFloor0EnemyState === "function" && !rememberFloor0EnemyState.__enemyAuthorityWrapped) {
    const originalRememberFloor0EnemyState = rememberFloor0EnemyState;
    rememberFloor0EnemyState = function rememberFloor0EnemyStateWithAuthority(payload) {
      const protectedPayload = protectEnemyState(payload);
      if (!protectedPayload) return;
      return originalRememberFloor0EnemyState.call(this, protectedPayload);
    };
    rememberFloor0EnemyState.__enemyAuthorityWrapped = true;
  }

  if (typeof applyFloor0EnemyState === "function" && !applyFloor0EnemyState.__enemyAuthorityWrapped) {
    const originalApplyFloor0EnemyState = applyFloor0EnemyState;
    applyFloor0EnemyState = function applyFloor0EnemyStateWithAuthority(state, options = {}) {
      const protectedState = protectEnemyState(state);
      if (!protectedState) return false;
      return originalApplyFloor0EnemyState.call(this, protectedState, options);
    };
    applyFloor0EnemyState.__enemyAuthorityWrapped = true;
  }

  if (typeof floor0EnemyPayload === "function" && !floor0EnemyPayload.__enemyAuthorityWrapped) {
    const originalFloor0EnemyPayload = floor0EnemyPayload;
    floor0EnemyPayload = function floor0EnemyPayloadWithAuthority(enemy) {
      const payload = originalFloor0EnemyPayload.call(this, enemy);
      if (!payload?.enemyId) return payload;
      const stored = currentStoredEnemyState(payload.enemyId);
      if (stored?.alive === false) {
        payload.alive = false;
        payload.hp = 0;
      } else if (Number.isFinite(Number(stored?.hp)) && Number.isFinite(Number(payload.hp)) && Number(payload.hp) > Number(stored.hp)) {
        payload.hp = Number(stored.hp);
      }
      if (Number.isFinite(Number(stored?.serverRevision))) payload.serverRevision = Math.trunc(Number(stored.serverRevision));
      return payload;
    };
    floor0EnemyPayload.__enemyAuthorityWrapped = true;
  }

  if (typeof applyFloor0WorldState === "function" && !applyFloor0WorldState.__enemyAuthorityWrapped) {
    const originalApplyFloor0WorldState = applyFloor0WorldState;
    applyFloor0WorldState = function applyFloor0WorldStateWithEnemyAuthority(messageOrState, ...args) {
      const result = originalApplyFloor0WorldState.apply(this, [messageOrState, ...args]);
      const worldState = messageOrState?.worldState || messageOrState;
      if (Number.isFinite(Number(worldState?.enemyAuthorityRevision))) {
        multiplayer.enemyAuthorityRevision = Math.max(
          Math.trunc(Number(multiplayer.enemyAuthorityRevision) || 0),
          Math.trunc(Number(worldState.enemyAuthorityRevision))
        );
      }
      return result;
    };
    applyFloor0WorldState.__enemyAuthorityWrapped = true;
  }
})();
