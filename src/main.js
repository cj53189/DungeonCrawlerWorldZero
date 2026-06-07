function gameLoop() {
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
  }
  if (typeof maybeSendLocalCrawlerState === "function") maybeSendLocalCrawlerState();
  if (typeof maybeSendFloor0EnemySnapshot === "function") maybeSendFloor0EnemySnapshot();
  draw();
  requestAnimationFrame(gameLoop);
}

initInputControls();
setupLootWindowHandlers();
setupTitleScreenHandlers();
resetState();
showTitleScreen();
gameLoop();

// Jeremiah gold reset fix: full death/new-run reset is handled by resetRunProgress().
