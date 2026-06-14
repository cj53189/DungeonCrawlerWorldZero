(function installFloor0SpawnHotfix() {
  if (typeof ensureServerFloor0Dungeon !== "function") return;

  ensureServerFloor0Dungeon = function ensureServerFloor0DungeonWithoutLobbyUpdateRespawn() {
    if (!multiplayer.enabled || !multiplayer.usingServer || currentFloor !== 0 || !multiplayer.floor0Metadata?.seed) return;

    const seed = multiplayer.floor0Metadata.seed;
    const alreadyBuiltThisFloor = multiplayer.activeFloor0Seed === seed;

    if (alreadyBuiltThisFloor) {
      // Lobby/status updates happen whenever another crawler reaches stairs.
      // Do not treat those updates like a fresh Floor 0 load, or every client
      // gets teleported back to their safe-room spawn.
      syncSharedFloor0StairsFromDungeon();
      if (typeof updateVisibility === "function") updateVisibility(true);
      if (typeof updateHUD === "function") updateHUD();
      return;
    }

    resetState();
    multiplayer.activeFloor0Seed = seed;
    syncSharedFloor0StairsFromDungeon();
    placeLocalCrawlerAtFloor0Spawn();
    if (typeof updateVisibility === "function") updateVisibility(true);
    if (typeof updateHUD === "function") updateHUD();
  };
})();
