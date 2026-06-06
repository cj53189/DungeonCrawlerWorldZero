function gameLoop() {
  pollGamepad();
  updatePanelScrollFromController();
  if (!gameWon && !gameLost) {
    updatePlayer();
    updateBossLocks();
    updateEnemies();
    updateProjectiles();
    updateFloorTimer();
    updateVisibility();
    updatePrompt();
  }
  draw();
  requestAnimationFrame(gameLoop);
}

initInputControls();
setupLootWindowHandlers();
resetState();
gameLoop();

// Jeremiah gold reset fix: full death/new-run reset is handled by resetRunProgress().
