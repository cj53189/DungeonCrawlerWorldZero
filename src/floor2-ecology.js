// Book 1 Floor 2 ecology built on the existing corpse and enemy systems.
(function installFloor2Ecology() {
  if (window.__dcwFloor2EcologyInstalled) return;
  window.__dcwFloor2EcologyInstalled = true;

  const ACTIVE_CAP = 30;
  const GRUB_FEED_MS = 15 * 60 * 1000;
  const PUPA_EMERGENCE_MS = 6 * 60 * 60 * 1000;
  const NUTRITION_TO_PUPATE = 3;
  let ecologyState = null;

  function active() { return Number(currentFloor) === 2 && !multiplayer?.enabled; }
  function now() { return Date.now(); }
  function ecologyEnemies() { return (enemies || []).filter(enemy => enemy?.floor2Ecology && enemy.hp > 0); }
  function state() {
    if (!ecologyState || ecologyState.floor !== currentFloor) resetFloorEcology();
    return ecologyState;
  }

  function resetFloorEcology() {
    ecologyState = { version: 1, floor: Number(currentFloor) || 0, startedAt: now(), lastUpdatedAt: now(), spawnedFromCorpseIds: [], consumedCorpseIds: [] };
    window.floor2EcologyState = ecologyState;
    return ecologyState;
  }

  function makeEcologyEnemy(name, x, y, options = {}) {
    const level = Math.max(1, Number(player?.level) || 1);
    const grub = name === "Brindle Grub";
    const enemy = {
      enemyId: typeof makeId === "function" ? makeId(grub ? "brindle_grub" : "brindled_vespa") : `${grub ? "grub" : "vespa"}_${now()}_${Math.random()}`,
      x, y, r: grub ? 8 : 11, level, name, family: "floor2_ecology",
      hp: grub ? 12 + level * 4 : 34 + level * 10,
      maxHp: grub ? 12 + level * 4 : 34 + level * 10,
      damage: grub ? 2 + level : 7 + level * 2,
      xpReward: grub ? 5 + level * 2 : 22 + level * 7,
      speed: grub ? 0.72 + level * 0.02 : 1.08 + level * 0.035,
      aggroRange: grub ? 80 : 240, attackReach: grub ? 2 : 5,
      damageCooldown: 0, wanderAngle: Math.random() * Math.PI * 2,
      roomId: roomForTile(Math.floor(x / TILE), Math.floor(y / TILE))?.id,
      behaviorState: {}, floor2Ecology: true, ecologyStage: grub ? "grub" : "vespa",
      nutrition: Number(options.nutrition) || 0, spawnedAt: Number(options.spawnedAt) || now(), canUpdateUnseen: true
    };
    if (typeof applyEnemyIdentity === "function") applyEnemyIdentity(enemy, { name });
    return enemy;
  }

  function spawnNearCorpse(corpse, index) {
    const angle = (index / 3) * Math.PI * 2 + Math.random() * 0.6;
    const distance = 18 + Math.random() * 16;
    return makeEcologyEnemy("Brindle Grub", corpse.x + Math.cos(angle) * distance, corpse.y + Math.sin(angle) * distance);
  }

  function onCorpseCreatedForFloorEcology(corpse) {
    if (!active() || !corpse || corpse.ecologyProcessed) return;
    const st = state();
    corpse.ecologyProcessed = true;
    if (!st.spawnedFromCorpseIds.includes(corpse.id)) st.spawnedFromCorpseIds.push(corpse.id);
    const count = Math.min(Math.max(0, ACTIVE_CAP - ecologyEnemies().length), 1 + Math.floor(Math.random() * 3));
    for (let i = 0; i < count; i++) enemies.push(spawnNearCorpse(corpse, i));
    stats.corpsesCreated = (stats.corpsesCreated || 0) + 1;
    stats.grubsSpawned = (stats.grubsSpawned || 0) + count;
  }

  function availableCorpseFor(enemy) {
    const candidates = (corpses || []).filter(corpse => corpse && !corpse.looted && !corpse.consumedByGrubs);
    candidates.sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y));
    return candidates[0] || null;
  }

  function becomePupa(enemy, timestamp, countStat = true) {
    enemy.ecologyStage = "pupa"; enemy.name = "Brindle Pupa"; enemy.speed = 0; enemy.damage = 0;
    enemy.hp = Math.max(enemy.hp, 28 + enemy.level * 8); enemy.maxHp = Math.max(enemy.maxHp, enemy.hp);
    enemy.pupaStartedAt = timestamp; enemy.emergenceAt = timestamp + PUPA_EMERGENCE_MS; enemy.ecologyTarget = null;
    if (countStat) stats.grubsPupated = (stats.grubsPupated || 0) + 1;
  }

  function emergeVespa(enemy, timestamp) {
    Object.assign(enemy, makeEcologyEnemy("Brindled Vespa", enemy.x, enemy.y, { spawnedAt: timestamp, nutrition: enemy.nutrition }));
    enemy.ecologyStage = "vespa";
    stats.vespasEmerged = (stats.vespasEmerged || 0) + 1;
    if (typeof achievement === "function") achievement("BRINDLED VESPA EMERGED", "A fed janitor mob has completed its deeply preventable career change.", `vespa_${enemy.enemyId}`);
  }

  function feed(enemy, corpse, timestamp) {
    if (!enemy.feedingStartedAt) enemy.feedingStartedAt = timestamp;
    if (timestamp - enemy.feedingStartedAt < GRUB_FEED_MS) return;
    corpse.consumedByGrubs = true;
    enemy.nutrition = (enemy.nutrition || 0) + Math.max(1, corpse.nutritionValue || 1);
    enemy.feedingStartedAt = null; enemy.ecologyTarget = null;
    const st = state();
    if (!st.consumedCorpseIds.includes(corpse.id)) st.consumedCorpseIds.push(corpse.id);
    if (typeof removeCorpseFromMap === "function") removeCorpseFromMap(corpse);
    stats.corpsesConsumed = (stats.corpsesConsumed || 0) + 1;
    stats.grubsFed = (stats.grubsFed || 0) + 1;
    if (enemy.nutrition >= NUTRITION_TO_PUPATE) becomePupa(enemy, timestamp);
  }

  function updateFloorEcologyEnemy(enemy, timestamp = now()) {
    if (!active() || !enemy?.floor2Ecology || enemy.hp <= 0) return false;
    if (enemy.ecologyStage === "pupa") { if (timestamp >= enemy.emergenceAt) emergeVespa(enemy, timestamp); return true; }
    if (enemy.ecologyStage !== "grub") return false;
    const target = enemy.ecologyTarget && (corpses || []).find(corpse => corpse.id === enemy.ecologyTarget.id && !corpse.looted && !corpse.consumedByGrubs) || availableCorpseFor(enemy);
    enemy.ecologyTarget = target ? { id: target.id, x: target.x, y: target.y } : null;
    if (!target) { enemy.feedingStartedAt = null; return false; }
    if (Math.hypot(target.x - enemy.x, target.y - enemy.y) <= enemy.r + target.r + 7) feed(enemy, target, timestamp);
    else enemy.feedingStartedAt = null;
    return false;
  }

  function updateFloorEcology() {
    if (!active()) return;
    const timestamp = now(); state().lastUpdatedAt = timestamp;
    for (const enemy of ecologyEnemies()) updateFloorEcologyEnemy(enemy, timestamp);
  }

  function captureFloorEcologyState() {
    if (!active()) return null;
    const timestamp = now();
    return { ...state(), savedAt: timestamp,
      activeGrubs: ecologyEnemies().filter(enemy => enemy.ecologyStage === "grub").length,
      activeVespas: ecologyEnemies().filter(enemy => enemy.ecologyStage === "vespa").length,
      pupae: ecologyEnemies().filter(enemy => enemy.ecologyStage === "pupa").map(enemy => ({ remainingMs: Math.max(0, enemy.emergenceAt - timestamp), nutrition: enemy.nutrition || NUTRITION_TO_PUPATE })) };
  }

  function openEcologySpawnTile() {
    const room = (rooms || []).find(candidate => candidate?.type !== "safe" && candidate !== bossRoom);
    const tile = room && typeof chooseRandomRoomTile === "function" ? chooseRandomRoomTile(room, 1) : null;
    return tile ? { x: tile.x * TILE + TILE / 2, y: tile.y * TILE + TILE / 2 } : { x: player.x + TILE * 3, y: player.y };
  }

  function restoreFloorEcologyState(saved) {
    resetFloorEcology();
    if (!active() || !saved) return;
    const elapsed = Math.max(0, now() - (Number(saved.savedAt) || now()));
    const grubs = Math.min(ACTIVE_CAP, Math.max(0, Number(saved.activeGrubs) || 0));
    const vespas = Math.min(ACTIVE_CAP - grubs, Math.max(0, Number(saved.activeVespas) || 0));
    for (let i = 0; i < grubs; i++) { const spot = openEcologySpawnTile(); enemies.push(makeEcologyEnemy("Brindle Grub", spot.x, spot.y)); }
    for (let i = 0; i < vespas; i++) { const spot = openEcologySpawnTile(); enemies.push(makeEcologyEnemy("Brindled Vespa", spot.x, spot.y)); }
    for (const pupa of saved.pupae || []) {
      const spot = openEcologySpawnTile(); const enemy = makeEcologyEnemy("Brindle Grub", spot.x, spot.y, { nutrition: pupa.nutrition });
      becomePupa(enemy, now(), false); enemy.emergenceAt = now() + Math.max(0, Number(pupa.remainingMs) - elapsed);
      if (enemy.emergenceAt <= now()) emergeVespa(enemy, now()); enemies.push(enemy);
    }
  }

  window.resetFloorEcology = resetFloorEcology;
  window.onCorpseCreatedForFloorEcology = onCorpseCreatedForFloorEcology;
  window.updateFloorEcology = updateFloorEcology;
  window.updateFloorEcologyEnemy = updateFloorEcologyEnemy;
  window.captureFloorEcologyState = captureFloorEcologyState;
  window.restoreFloorEcologyState = restoreFloorEcologyState;
})();
