(function installFloor0TransitionFix() {
  let lastCollapseNudgeAt = 0;

  function isLocalAdvancing() {
    return multiplayer?.localFloor0Status === "advancing" || multiplayer?.localFloor0Status === "at_stairs";
  }

  function startFloorOneFromServerResolution(message = {}) {
    if (!multiplayer.enabled || !multiplayer.usingServer) return false;
    if (currentFloor === 1 && multiplayer.status === "active") return true;
    if (currentFloor !== 0) return false;
    if (!isLocalAdvancing()) return false;

    const snapshot = typeof captureRunProgress === "function" ? captureRunProgress() : null;
    currentFloor = 1;
    gameWon = false;
    gameLost = false;
    pendingFloorAdvance = false;
    if (typeof setGameMode === "function") setGameMode(GAME_MODES.MULTIPLAYER_ACTIVE);
    multiplayer.status = "active";
    multiplayer.pvpEnabled = false;
    multiplayer.floorStartedAt = Date.now();
    multiplayer.collapseAt = multiplayer.floorStartedAt + (typeof getFloorTimeLimit === "function" ? getFloorTimeLimit() : 540) * 1000;
    multiplayer.remotePlayers = new Map();

    if (typeof resetState === "function") resetState({ preserveRun: true, snapshot });
    const center = document.getElementById("centerMessage");
    if (center) center.style.display = "none";
    if (typeof showFloorSplash === "function") showFloorSplash();
    if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
    if (typeof announcer === "function") announcer(message.message || "Floor 1 started for advancing crawlers.");
    return true;
  }

  const originalHandleServerFloor0Resolved = typeof handleServerFloor0Resolved === "function" ? handleServerFloor0Resolved : null;
  if (originalHandleServerFloor0Resolved && !originalHandleServerFloor0Resolved.__floor0TransitionFixWrapped) {
    handleServerFloor0Resolved = function handleServerFloor0ResolvedWithImmediateStart(message) {
      originalHandleServerFloor0Resolved(message);
      const advancing = new Set(message?.advancedPlayerIds || []);
      if (advancing.has(multiplayer.playerId) || multiplayer.localFloor0Status === "advancing") {
        startFloorOneFromServerResolution({ ...message, message: "Floor 0 resolved. Advancing to Floor 1." });
      }
    };
    handleServerFloor0Resolved.__floor0TransitionFixWrapped = true;
  }

  const originalHandleServerFloorStart = typeof handleServerFloorStart === "function" ? handleServerFloorStart : null;
  if (originalHandleServerFloorStart && !originalHandleServerFloorStart.__floor0TransitionFixWrapped) {
    handleServerFloorStart = function handleServerFloorStartIdempotent(message) {
      if (currentFloor === 1 && multiplayer.status === "active") return;
      originalHandleServerFloorStart(message);
      if (Number(message?.floor) === 1 && currentFloor === 0 && isLocalAdvancing()) {
        startFloorOneFromServerResolution(message);
      }
    };
    handleServerFloorStart.__floor0TransitionFixWrapped = true;
  }

  setInterval(() => {
    if (!multiplayer.enabled || !multiplayer.usingServer || currentFloor !== 0) return;
    if (multiplayer.floor0Resolved || multiplayer.status === "active") return;
    if (!multiplayer.collapseAt || Date.now() < multiplayer.collapseAt) return;
    if (multiplayer.localFloor0Status !== "at_stairs" && multiplayer.localFloor0Status !== "advancing") return;
    if (Date.now() - lastCollapseNudgeAt < 1000) return;
    if (typeof isMultiplayerNetworkReady === "function" && !isMultiplayerNetworkReady()) return;

    lastCollapseNudgeAt = Date.now();
    if (typeof sendMultiplayerMessage === "function") {
      sendMultiplayerMessage("floor0_stairs_reached", {
        stairs: multiplayer.floor0Metadata?.stairs || { x: stairwellX, y: stairwellY },
        collapseExpired: true
      });
    }
  }, 1000);
})();
