(() => {
  if (typeof multiplayerNetwork !== "object" || multiplayerNetwork.sessionAuthInstalled) return;
  if (typeof sendMultiplayerMessage !== "function" || typeof handleMultiplayerServerMessage !== "function") return;

  multiplayerNetwork.sessionAuthInstalled = true;
  multiplayerNetwork.resumeCredential = multiplayerNetwork.resumeCredential || null;
  multiplayerNetwork.pendingDeathLootSnapshot = multiplayerNetwork.pendingDeathLootSnapshot || null;
  multiplayerNetwork.pendingDeathLootRunId = multiplayerNetwork.pendingDeathLootRunId || null;
  multiplayerNetwork.pendingDeathLootFloor = Number.isFinite(Number(multiplayerNetwork.pendingDeathLootFloor))
    ? Math.trunc(Number(multiplayerNetwork.pendingDeathLootFloor))
    : null;
  multiplayerNetwork.deathLootCommitted = !!multiplayerNetwork.deathLootCommitted;

  function cloneDeathLootSnapshot(snapshot) {
    return snapshot ? JSON.parse(JSON.stringify(snapshot)) : null;
  }

  function resetDeathLootTransaction() {
    multiplayerNetwork.pendingDeathLootSnapshot = null;
    multiplayerNetwork.pendingDeathLootRunId = null;
    multiplayerNetwork.pendingDeathLootFloor = null;
    multiplayerNetwork.deathLootCommitted = false;
    multiplayerNetwork.playerCorpseLootSent = false;
  }

  function localCrawlerIsDowned() {
    return typeof isLocalPlayerDead === "function" && isLocalPlayerDead();
  }

  function ensurePendingDeathLootSnapshot() {
    if (multiplayerNetwork.deathLootCommitted || multiplayerNetwork.pendingDeathLootSnapshot) {
      return multiplayerNetwork.pendingDeathLootSnapshot;
    }
    if (!localCrawlerIsDowned() || typeof capturePlayerCorpseLootSnapshot !== "function") return null;

    multiplayerNetwork.pendingDeathLootSnapshot = cloneDeathLootSnapshot(capturePlayerCorpseLootSnapshot());
    multiplayerNetwork.pendingDeathLootRunId = multiplayer?.currentRunId || null;
    multiplayerNetwork.pendingDeathLootFloor = Number.isFinite(Number(currentFloor)) ? Math.trunc(Number(currentFloor)) : null;
    return multiplayerNetwork.pendingDeathLootSnapshot;
  }

  function commitConfirmedDeathLoot(message) {
    if (multiplayerNetwork.deathLootCommitted || !multiplayerNetwork.pendingDeathLootSnapshot) return false;
    const corpse = message?.corpse;
    if (!corpse || corpse.deadPlayerId !== multiplayer?.playerId) return false;
    if (multiplayerNetwork.pendingDeathLootRunId && message.runId && message.runId !== multiplayerNetwork.pendingDeathLootRunId) return false;
    const messageFloor = message.currentFloor ?? message.floor ?? corpse.floor;
    if (
      multiplayerNetwork.pendingDeathLootFloor !== null &&
      Number.isFinite(Number(messageFloor)) &&
      Math.trunc(Number(messageFloor)) !== multiplayerNetwork.pendingDeathLootFloor
    ) return false;

    if (typeof clearLocalLootAfterCorpseSnapshot === "function") clearLocalLootAfterCorpseSnapshot();
    multiplayerNetwork.pendingDeathLootSnapshot = null;
    multiplayerNetwork.pendingDeathLootRunId = null;
    multiplayerNetwork.pendingDeathLootFloor = null;
    multiplayerNetwork.deathLootCommitted = true;
    return true;
  }

  if (typeof captureLocalCrawlerNetworkState === "function") {
    const originalCaptureLocalCrawlerNetworkState = captureLocalCrawlerNetworkState;
    captureLocalCrawlerNetworkState = function transactionSafeCrawlerStateCapture() {
      if (localCrawlerIsDowned() && !multiplayerNetwork.deathLootCommitted) {
        ensurePendingDeathLootSnapshot();
        // The legacy capture path clears loot when this flag is false. Keep it true while
        // the transaction is pending and attach the preserved snapshot ourselves instead.
        multiplayerNetwork.playerCorpseLootSent = true;
      }

      const state = originalCaptureLocalCrawlerNetworkState();
      if (state?.status === "downed" && !multiplayerNetwork.deathLootCommitted) {
        const pending = ensurePendingDeathLootSnapshot();
        if (pending) state.lootSnapshot = cloneDeathLootSnapshot(pending);
        multiplayerNetwork.playerCorpseLootSent = true;
      }
      return state;
    };
  }

  const originalSendMultiplayerMessage = sendMultiplayerMessage;
  sendMultiplayerMessage = function sessionAuthenticatedSend(type, payload = {}) {
    if (["create_lobby", "join_lobby", "quick_match"].includes(type)) resetDeathLootTransaction();
    if (type === "hello" && multiplayerNetwork.resumeCredential) {
      return originalSendMultiplayerMessage(type, {
        ...payload,
        resumeCredential: multiplayerNetwork.resumeCredential
      });
    }
    return originalSendMultiplayerMessage(type, payload);
  };

  const originalHandleMultiplayerServerMessage = handleMultiplayerServerMessage;
  handleMultiplayerServerMessage = function sessionAuthenticatedReceive(message) {
    if (message?.type === "welcome") {
      const credential = typeof message.resumeCredential === "string" ? message.resumeCredential.trim() : "";
      const isReconnectProbe = !!(
        message.provisional &&
        multiplayerNetwork.resumeCredential &&
        multiplayerNetwork.playerId
      );

      if (isReconnectProbe) return;
      if (credential) multiplayerNetwork.resumeCredential = credential;
    }

    const result = originalHandleMultiplayerServerMessage(message);

    if (message?.type === "player_corpse_created" || message?.type === "player_died") {
      commitConfirmedDeathLoot(message);
    } else if (message?.type === "floor_start") {
      resetDeathLootTransaction();
    }

    return result;
  };
})();
