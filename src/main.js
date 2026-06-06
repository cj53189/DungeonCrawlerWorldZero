function gameLoop() {
  pollGamepad();
  updatePanelScrollFromController();
  if (!gameWon && !gameLost) {
    updatePlayer();
    updateBossLocks();
    updateEnemies();
    updateFloorTimer();
    updateVisibility();
    updatePrompt();
  }
  draw();
  requestAnimationFrame(gameLoop);
}

resetState();
gameLoop();

// Jeremiah gold reset fix: full death/new-run reset is handled by resetRunProgress().
