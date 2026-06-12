function gameLoop() {
  if (typeof syncMusicToGameState === "function") syncMusicToGameState();
  pollGamepad();
  updatePanelScrollFromController();
  if (!isGameplayUpdatePaused() && !gameWon && !gameLost) {
    updatePlayer();
    updateBossLocks();
    updateEnemies();
    updateProjectiles();
    updateFloorTimer();
    updateVisibility();
    updatePrompt();
    updateTutorialSigns();
  }
  if (typeof maybeSendLocalCrawlerState === "function") maybeSendLocalCrawlerState();
  if (typeof maybeSendFloor0EnemySnapshot === "function") maybeSendFloor0EnemySnapshot();
  if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
  draw();
  requestAnimationFrame(gameLoop);
}

initInputControls();
setupMusicControls();
setupLootWindowHandlers();
setupTitleScreenHandlers();
resetState();
showTitleScreen();
gameLoop();

// Jeremiah gold reset fix: full death/new-run reset is handled by resetRunProgress().
