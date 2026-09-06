(function installFixedStepSimulationClock() {
  "use strict";

  if (window.__dcwFixedStepSimulationClockInstalled) return;
  window.__dcwFixedStepSimulationClockInstalled = true;

  const TARGET_SIMULATION_HZ = 60;
  const FIXED_STEP_MS = 1000 / TARGET_SIMULATION_HZ;
  const MAX_CATCH_UP_STEPS = 5;
  const MAX_FRAME_DELTA_MS = FIXED_STEP_MS * MAX_CATCH_UP_STEPS;

  let previousTimestamp = null;
  let accumulatorMs = 0;

  function simulationPaused() {
    return typeof isGameplayUpdatePaused === "function" && isGameplayUpdatePaused();
  }

  function runSimulationStep() {
    if (simulationPaused() || gameWon || gameLost) return;

    updatePlayer();
    updateBossLocks();
    if (typeof updatePet === "function") updatePet();
    updateEnemies();
    updateProjectiles();
    updateFloorTimer();
    updateVisibility();
    updatePrompt();
    updateTutorialSigns();
  }

  function fixedStepGameLoop(timestamp) {
    const now = Number.isFinite(Number(timestamp)) ? Number(timestamp) : performance.now();

    if (typeof recordFrameTiming === "function") recordFrameTiming(now);
    if (typeof syncMusicToGameState === "function") syncMusicToGameState();
    if (typeof pollGamepad === "function") pollGamepad();
    if (typeof updatePanelScrollFromController === "function") updatePanelScrollFromController();

    if (previousTimestamp === null) {
      previousTimestamp = now;
    } else {
      const elapsedMs = Math.min(MAX_FRAME_DELTA_MS, Math.max(0, now - previousTimestamp));
      previousTimestamp = now;
      accumulatorMs += elapsedMs;

      let steps = 0;
      while (accumulatorMs + 0.0001 >= FIXED_STEP_MS && steps < MAX_CATCH_UP_STEPS) {
        runSimulationStep();
        accumulatorMs -= FIXED_STEP_MS;
        steps++;
      }

      // Do not simulate a giant backlog after tab suspension or a severe frame stall.
      // The old requestAnimationFrame loop also stopped while hidden, so dropping excess
      // backlog preserves that behavior while still allowing normal low-FPS catch-up.
      if (steps === MAX_CATCH_UP_STEPS && accumulatorMs >= FIXED_STEP_MS) {
        accumulatorMs %= FIXED_STEP_MS;
      }
    }

    if (typeof maybeSendLocalCrawlerState === "function") maybeSendLocalCrawlerState();
    if (typeof maybeSendFloor0EnemySnapshot === "function") maybeSendFloor0EnemySnapshot();
    if (
      typeof updateTesterReadinessUI === "function" &&
      (typeof shouldUpdateTesterReadinessThisFrame !== "function" || shouldUpdateTesterReadinessThisFrame())
    ) updateTesterReadinessUI();
    if (typeof draw === "function") draw();

    requestAnimationFrame(gameLoop);
  }

  fixedStepGameLoop.__dcwFixedStepSimulation = true;
  gameLoop = fixedStepGameLoop;

  window.__dcwSimulationClock = Object.freeze({
    targetHz: TARGET_SIMULATION_HZ,
    fixedStepMs: FIXED_STEP_MS,
    maxCatchUpSteps: MAX_CATCH_UP_STEPS
  });
})();
