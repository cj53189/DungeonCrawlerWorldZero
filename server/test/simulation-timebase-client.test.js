const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../src/simulation-timebase.js'), 'utf8');
const loaderSource = fs.readFileSync(path.resolve(__dirname, '../../src/feature-loader.js'), 'utf8');

function createHarness() {
  const counts = {
    player: 0,
    bossLocks: 0,
    pet: 0,
    enemies: 0,
    projectiles: 0,
    floorTimer: 0,
    visibility: 0,
    prompt: 0,
    tutorials: 0,
    draw: 0,
    gamepad: 0,
    panelScroll: 0,
    localState: 0,
    enemyState: 0
  };
  let playerX = 0;
  let paused = false;
  let scheduled = null;

  const context = {
    window: null,
    gameWon: false,
    gameLost: false,
    gameLoop() {},
    performance: { now: () => 0 },
    requestAnimationFrame(callback) {
      scheduled = callback;
      return 1;
    },
    recordFrameTiming() {},
    syncMusicToGameState() {},
    pollGamepad() { counts.gamepad += 1; },
    updatePanelScrollFromController() { counts.panelScroll += 1; },
    isGameplayUpdatePaused: () => paused,
    updatePlayer() { counts.player += 1; playerX += 1; },
    updateBossLocks() { counts.bossLocks += 1; },
    updatePet() { counts.pet += 1; },
    updateEnemies() { counts.enemies += 1; },
    updateProjectiles() { counts.projectiles += 1; },
    updateFloorTimer() { counts.floorTimer += 1; },
    updateVisibility() { counts.visibility += 1; },
    updatePrompt() { counts.prompt += 1; },
    updateTutorialSigns() { counts.tutorials += 1; },
    maybeSendLocalCrawlerState() { counts.localState += 1; },
    maybeSendFloor0EnemySnapshot() { counts.enemyState += 1; },
    shouldUpdateTesterReadinessThisFrame: () => false,
    draw() { counts.draw += 1; },
    console
  };
  context.window = context;

  vm.runInNewContext(source, context, { filename: 'simulation-timebase.js' });

  return {
    context,
    counts,
    getPlayerX: () => playerX,
    getScheduled: () => scheduled,
    setPaused: value => { paused = !!value; }
  };
}

function runForOneSecond(renderHz) {
  const harness = createHarness();
  harness.context.gameLoop(0);
  for (let frame = 1; frame <= renderHz; frame++) {
    harness.context.gameLoop(frame * (1000 / renderHz));
  }
  return harness;
}

test('gameplay advances at the same 60 Hz simulation rate on 60 Hz and 240 Hz displays', () => {
  const sixty = runForOneSecond(60);
  const twoForty = runForOneSecond(240);

  assert.equal(sixty.counts.player, 60);
  assert.equal(twoForty.counts.player, 60);
  assert.equal(sixty.getPlayerX(), twoForty.getPlayerX());
  assert.equal(twoForty.counts.floorTimer, sixty.counts.floorTimer);
  assert.equal(twoForty.counts.enemies, sixty.counts.enemies);
  assert.equal(twoForty.counts.projectiles, sixty.counts.projectiles);

  // Rendering/input/network polling stays tied to display refresh for smoothness and responsiveness.
  assert.equal(sixty.counts.draw, 61);
  assert.equal(twoForty.counts.draw, 241);
  assert.equal(twoForty.counts.gamepad, 241);
  assert.equal(twoForty.counts.localState, 241);
});

test('a long frame stall is bounded instead of replaying an unlimited simulation backlog', () => {
  const harness = createHarness();
  harness.context.gameLoop(0);
  harness.context.gameLoop(1000);

  assert.equal(harness.counts.player, 5);
  assert.equal(harness.counts.floorTimer, 5);
});

test('paused gameplay consumes simulation time without catching up when resumed', () => {
  const harness = createHarness();
  harness.context.gameLoop(0);
  harness.setPaused(true);
  for (let frame = 1; frame <= 60; frame++) harness.context.gameLoop(frame * (1000 / 60));
  assert.equal(harness.counts.player, 0);

  harness.setPaused(false);
  harness.context.gameLoop(1000 + (1000 / 60));
  assert.equal(harness.counts.player, 1);
});

test('feature loader installs the simulation clock explicitly', () => {
  assert.match(loaderSource, /\.\/src\/simulation-timebase\.js/);
  assert.match(source, /TARGET_SIMULATION_HZ\s*=\s*60/);
  assert.match(source, /gameLoop\s*=\s*fixedStepGameLoop/);
});
