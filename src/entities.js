
const ENEMY_BEHAVIOR_TAGS = {
  RAT_SWARM: "rat_swarm",
  RAT_BRUISER: "rat_bruiser",
  SPIDER_LUNGE: "spider_lunge",
  SPIDER_HIT_AND_RUN: "spider_hit_and_run",
  BOT_PATROL: "bot_patrol",
  GUARD_BRUISER: "guard_bruiser",
  DRONE_SKIRMISHER: "drone_skirmisher",
  BOSS_GATEKEEPER: "boss_gatekeeper",
  BOSS_SKELETON: "boss_skeleton"
};

const ENEMY_SPRITE_DEFINITIONS = {
  rat: {
    spriteKey: "rat",
    src: "./assets/sprites/enemies/rat.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 4,
    rows: 4,
    frameCount: 4,
    rowCount: 4,
    directionRows: { up: 0, right: 1, down: 2, left: 3 },
    directionalFrameRows: true,
    animationSpeed: 10
  },
  spider: { spriteKey: "spider", src: "./assets/sprites/enemies/spider.png", frameWidth: 32, frameHeight: 32, frameCount: 4, animationSpeed: 9 },
  janitor_bot: { spriteKey: "janitor_bot", src: "./assets/sprites/enemies/janitor_bot.png", frameWidth: 32, frameHeight: 32, frameCount: 4, animationSpeed: 12 },
  maintenance_guard: { spriteKey: "maintenance_guard", src: "./assets/sprites/enemies/maintenance_guard.png", frameWidth: 32, frameHeight: 32, frameCount: 4, animationSpeed: 11 },
  security_drone: { spriteKey: "security_drone", src: "./assets/sprites/enemies/security_drone.png", frameWidth: 32, frameHeight: 32, frameCount: 4, animationSpeed: 8 },
  gatekeeper: { spriteKey: "gatekeeper", src: "./assets/sprites/enemies/gatekeeper.png", frameWidth: 48, frameHeight: 48, frameCount: 4, animationSpeed: 11 },
  skeletonboss: {
    spriteKey: "skeletonboss",
    displayName: "Skeleton Boss",
    src: "./assets/sprites/enemies/skeletonboss/skeletonboss.png",
    missingWarning: "Skeleton Boss sprite missing: assets/sprites/enemies/skeletonboss/skeletonboss.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 4,
    rows: 4,
    frameCount: 4,
    rowCount: 4,
    directionRows: { down: 0, up: 1, left: 2, right: 3 },
    directionalFrameRows: true,
    animationSpeed: 14,
    animations: {
      attack: { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], fps: 12, loop: false, damageFrame: 7 },
      death: { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], fps: 8, loop: false, holdFinalFrame: true }
    }
  }
};

const ENEMY_IDENTITY_BY_NAME = {
  "Small Rat": { behaviorTag: ENEMY_BEHAVIOR_TAGS.RAT_SWARM, spriteKey: "rat" },
  "Hungry Rat": { behaviorTag: ENEMY_BEHAVIOR_TAGS.RAT_SWARM, spriteKey: "rat" },
  "Giant Rat": { behaviorTag: ENEMY_BEHAVIOR_TAGS.RAT_BRUISER, spriteKey: "rat" },
  "Cave Spider": { behaviorTag: ENEMY_BEHAVIOR_TAGS.SPIDER_LUNGE, spriteKey: "spider" },
  "Venom Spider": { behaviorTag: ENEMY_BEHAVIOR_TAGS.SPIDER_HIT_AND_RUN, spriteKey: "spider" },
  "Brood Spider": { behaviorTag: ENEMY_BEHAVIOR_TAGS.SPIDER_LUNGE, spriteKey: "spider" },
  "Janitor Bot": { behaviorTag: ENEMY_BEHAVIOR_TAGS.BOT_PATROL, spriteKey: "janitor_bot" },
  "Maintenance Guard": { behaviorTag: ENEMY_BEHAVIOR_TAGS.GUARD_BRUISER, spriteKey: "maintenance_guard" },
  "Security Drone": { behaviorTag: ENEMY_BEHAVIOR_TAGS.DRONE_SKIRMISHER, spriteKey: "security_drone" }
};

function enemyIdentityForName(name) {
  return ENEMY_IDENTITY_BY_NAME[name] || null;
}

function enemySpriteMetadataForKey(spriteKey) {
  const definition = ENEMY_SPRITE_DEFINITIONS[spriteKey];
  if (!definition) return null;
  return {
    spriteKey: definition.spriteKey,
    spritePath: definition.src,
    frameWidth: definition.frameWidth,
    frameHeight: definition.frameHeight,
    columns: definition.columns || definition.frameCount,
    rows: definition.rows || definition.rowCount || 1,
    frameCount: definition.frameCount,
    rowCount: definition.rowCount || 1,
    directionRows: definition.directionRows || null,
    directionalFrameRows: !!definition.directionalFrameRows,
    animationSpeed: definition.animationSpeed,
    animations: definition.animations || null,
    facesRightByDefault: !!definition.facesRightByDefault,
    missingWarning: definition.missingWarning || null,
    displayName: definition.displayName || null,
    animationState: "walk",
    animationStartedAt: 0
  };
}

function applyEnemyIdentity(enemy, variant = {}) {
  if (!enemy) return enemy;
  const identity = enemyIdentityForName(variant.name || enemy.name) || {};
  const spriteKey = variant.spriteKey || identity.spriteKey || enemy.spriteKey || null;
  enemy.behaviorTag = variant.behaviorTag || identity.behaviorTag || enemy.behaviorTag || null;
  if (spriteKey) Object.assign(enemy, enemySpriteMetadataForKey(spriteKey));
  return enemy;
}
function roomDistance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

function chooseCrawlerSpawnRoom(startRoom) {
  if (currentFloor === 0) return startRoom;

  const candidates = rooms.filter(room => {
    if (!room || room === startRoom) return false;
    if (room.type === "boss") return false;
    if (bossRoom && room === bossRoom) return false;
    if (bossRoom && roomDistance(room, bossRoom) < 18) return false;
    if (map[room.cy]?.[room.cx] !== ".") return false;
    return true;
  });

  const preferred = candidates.filter(room => room.sizeClass === "small" || room.sizeClass === "medium");
  const pool = preferred.length ? preferred : candidates;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : startRoom;
}

function placeCrawlerInRoom(room) {
  player.x = room.cx * TILE + TILE / 2;
  player.y = room.cy * TILE + TILE / 2;
  player.currentRoomId = null;
}

function getFloorEnemyPressure() {
  return Math.floor(currentFloor * 0.75);
}

function rollScaledEnemyLevel(room, spawnRoom) {
  const base = player.level + getFloorEnemyPressure();
  const distance = spawnRoom ? Math.hypot(room.cx - spawnRoom.cx, room.cy - spawnRoom.cy) : 0;
  const regionBonus = Math.floor(distance / 34);
  const r = Math.random();
  let variance = 0;
  if (r < 0.18) variance = -2;
  else if (r < 0.42) variance = -1;
  else if (r < 0.76) variance = 0;
  else if (r < 0.94) variance = 1;
  else variance = 2;
  return Math.max(1, base + regionBonus + variance);
}

function rollEnemyLoot(enemy) {
  const loot = [];
  const coins = (enemy.boss ? 18 : 2) + Math.floor(Math.random() * (enemy.boss ? 24 : 7)) + Math.floor((enemy.level || 1) * (enemy.boss ? 3 : 1.2));
  if (coins > 0) loot.push({ type: "coins", amount: coins, name: `${coins} Coins` });

  const gearChance = enemy.boss ? 0.85 : 0.09 + Math.min(0.12, (enemy.level || 1) * 0.01);
  const weaponChance = enemy.boss ? 1 : 0.16 + Math.min(0.18, (enemy.level || 1) * 0.012) + Math.min(0.10, currentFloor * 0.015);
  const boxChance = enemy.boss ? 0.95 : 0.07 + Math.min(0.10, currentFloor * 0.015);

  if (Math.random() < gearChance) loot.push(generateGear(enemy.boss || enemy.level > player.level + 2));
  if (Math.random() < weaponChance) loot.push(generateWeapon(enemy.boss || enemy.level > player.level + 2));
  if (Math.random() < boxChance) loot.push(generateLootBox(enemy.boss || enemy.level > player.level + 2));
  return loot;
}

function createCorpse(enemy) {
  const id = enemy?.enemyId ? `corpse_${enemy.enemyId}` : makeId("corpse");
  if (multiplayer.floor0WorldState?.takenLootIds?.has(id)) return null;
  const existing = getCorpseById(id);
  if (existing) return existing;
  const corpse = {
    id,
    x: enemy.x,
    y: enemy.y,
    r: enemy.boss ? 18 : 11,
    boss: !!enemy.boss,
    name: enemy.boss ? `${enemy.name || "Boss"} Corpse` : `${enemy.name || `Level ${enemy.level || 1}`} Corpse`,
    level: enemy.level || 1,
    loot: rollEnemyLoot(enemy),
    looted: false
  };
  corpses.push(corpse);
  return corpse;
}

function getCorpseById(id) {
  return corpses.find(corpse => corpse.id === id) || null;
}

function addFloatingFeedbackText(text, x, y, options = {}) {
  if (!Array.isArray(floatingFeedbackTexts)) floatingFeedbackTexts = [];
  const anchor = options.anchor || null;
  const jitter = Number.isFinite(options.jitter) ? options.jitter : 10;
  floatingFeedbackTexts.push({
    text: String(text || ""),
    x: Number.isFinite(Number(x)) ? Number(x) : player.x,
    y: Number.isFinite(Number(y)) ? Number(y) : player.y,
    offsetX: (Math.random() - 0.5) * jitter,
    offsetY: Number.isFinite(options.offsetY) ? options.offsetY : -22,
    vy: Number.isFinite(options.vy) ? options.vy : -0.42,
    life: Number.isFinite(options.life) ? options.life : 54,
    maxLife: Number.isFinite(options.life) ? options.life : 54,
    color: options.color || "#ffffff",
    stroke: options.stroke || "rgba(0,0,0,0.82)",
    size: Number.isFinite(options.size) ? options.size : 14,
    anchor
  });
  if (floatingFeedbackTexts.length > 36) floatingFeedbackTexts.splice(0, floatingFeedbackTexts.length - 36);
}

function addPlayerFeedbackText(text, options = {}) {
  addFloatingFeedbackText(text, player.x, player.y - player.r, { anchor: player, ...options });
}

function isCorpseGoldOnly(corpse) {
  return !!corpse && !corpse.looted && corpse.loot.length === 1 && corpse.loot[0]?.type === "coins";
}

function hasFloor0LootAlreadyTaken(corpse) {
  return !!corpse?.id && !!multiplayer.floor0WorldState?.takenLootIds?.has(corpse.id);
}

function rememberFloor0LootTaken(corpse) {
  if (corpse?.id && multiplayer.floor0WorldState?.takenLootIds) multiplayer.floor0WorldState.takenLootIds.add(corpse.id);
}

function removeCorpseFromMap(corpse) {
  if (!corpse) return;
  if (activeLootCorpseId === corpse.id) closeLootWindow();
  const before = corpses.length;
  corpses = corpses.filter(candidate => candidate !== corpse && candidate.id !== corpse.id);
  if (corpses.length !== before) minimapDirty = true;
}

function markCorpseLooted(corpse, { sync = true, announce = true } = {}) {
  if (!corpse) return false;
  const wasLooted = !!corpse.looted;
  corpse.loot = [];
  corpse.looted = true;
  rememberFloor0LootTaken(corpse);
  if (sync && typeof sendFloor0WorldEvent === "function") sendFloor0WorldEvent({ type: "loot_taken", id: corpse.id });
  if (!wasLooted && announce) {
    changeAudience(corpse.boss ? 8 : 1);
    achievement(
      corpse.boss ? "BOSS CORPSE LOOTED" : "CORPSE LOOTED",
      `You finished looting ${corpse.name}. The dungeon reminds you this is technically recycling.`,
      `loot_${corpse.id}`
    );
  }
  removeCorpseFromMap(corpse);
  updateHUD();
  return true;
}

function closeLootWindow() {
  activeLootCorpseId = null;
  const panel = document.getElementById("lootWindow");
  if (panel) {
    panel.style.display = "none";
    if (document.activeElement && panel.contains(document.activeElement)) document.activeElement.blur();
  }
}

function formatLootItem(item) {
  if (!item) return "";
  if (item.type === "coins") return `${item.amount} coins`;
  return item.name || "Unknown Loot";
}

function renderCorpseLootWindow(corpse) {
  const panel = document.getElementById("lootWindow");
  if (!panel || !corpse) return;
  const title = document.getElementById("lootWindowTitle");
  const grid = document.getElementById("lootWindowGrid");
  if (title) title.textContent = corpse.name;
  if (!grid) return;

  if (!corpse.loot.length) {
    grid.innerHTML = `<div class="invItem empty"><div class="itemIcon">□</div><div class="itemName">Empty Corpse</div><div class="itemMeta">This container has already contributed all available tragedy.</div></div>`;
  } else {
    grid.innerHTML = corpse.loot.map((item, index) => {
      if (item.type === "coins") {
        return `<div class="invItem rarityCommon itemTypeCoins"><div class="itemIcon">¢</div><div class="itemName">${escapeHtml(formatLootItem(item))}</div><div class="itemSlot">Currency</div><div class="itemMeta">Spendable poor decisions.</div><div class="itemActions"><button class="itemBtn" type="button" data-loot-index="${index}">Take</button></div></div>`;
      }
      return `<div class="invItem ${rarityClass(item)} ${typeClass(item)}"><div class="itemIcon">${slotIcon(item)}</div><div class="itemName">${escapeHtml(item.name)}</div><div class="itemSlot">${escapeHtml(item.type === "weapon" ? "Weapon" : item.type === "lootbox" ? "Loot Box" : SLOT_LABELS[item.slot] || "Loot")} · ${escapeHtml(item.rarity || "Common")}</div><div class="itemMeta">${escapeHtml(itemDescription(item))}</div><div class="itemActions"><button class="itemBtn" type="button" data-loot-index="${index}">Take</button></div></div>`;
    }).join("");
  }
  panel.style.display = "block";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function openCorpseLootWindow(corpse) {
  if (!corpse || corpse.looted || hasFloor0LootAlreadyTaken(corpse)) {
    if (corpse && hasFloor0LootAlreadyTaken(corpse)) markCorpseLooted(corpse, { sync: false, announce: false });
    return;
  }
  activeLootCorpseId = corpse.id;
  renderCorpseLootWindow(corpse);
}

function finishCorpseLootIfEmpty(corpse) {
  if (!corpse || corpse.loot.length) return;
  markCorpseLooted(corpse);
}

function isServerFloor0LootShared() {
  return multiplayer.enabled && multiplayer.usingServer && currentFloor === 0;
}

function awardCorpseLootItem(corpse, item) {
  if (!corpse || !item) return false;
  if (item.type === "coins") {
    const amount = Math.max(0, Number(item.amount) || 0);
    player.coins += amount;
    addPlayerFeedbackText(`+${amount} gold`, { color: "#ffd86b", size: 15 });
    announcer(`You took ${amount} coins from ${corpse.name}. Brave accounting.`);
  } else {
    player.inventory.push(item);
    if (item.type === "lootbox") stats.lootBoxesFound++;
    if (item.type === "gear") stats.gearFound++;
    achievement(item.type === "weapon" ? "WEAPON LOOTED" : "CORPSE LOOT", `You took ${item.name} from ${corpse.name}. ${itemDescription(item)}`, `corpse_take_${corpse.id}_${item.id}`);
  }
  return true;
}

function takeCorpseLootItem(corpse, index) {
  if (!corpse || corpse.looted || hasFloor0LootAlreadyTaken(corpse) || index < 0 || index >= corpse.loot.length) return;

  if (isServerFloor0LootShared()) {
    // Floor 0 corpses are server-shared containers. Claim the entire corpse on
    // first take so two crawlers cannot race individual items into duplicate loot.
    const claimedLoot = corpse.loot.splice(0);
    for (const item of claimedLoot) awardCorpseLootItem(corpse, item);
    markCorpseLooted(corpse);
    updateInventoryUI();
    updateHUD();
    return;
  }

  const [item] = corpse.loot.splice(index, 1);
  awardCorpseLootItem(corpse, item);
  updateInventoryUI();
  updateHUD();
  finishCorpseLootIfEmpty(corpse);
  if (!corpse.looted) renderCorpseLootWindow(corpse);
}

function takeAllCorpseLoot(corpse) {
  if (!corpse || corpse.looted || hasFloor0LootAlreadyTaken(corpse)) return;
  if (!corpse.loot.length) {
    announcer(`You searched ${corpse.name}. It contained disappointment and several fluids best left unidentified.`);
    finishCorpseLootIfEmpty(corpse);
    return;
  }
  while (corpse.loot.length) takeCorpseLootItem(corpse, 0);
}

function setupLootWindowHandlers() {
  const panel = document.getElementById("lootWindow");
  if (!panel || panel.dataset.actionsBound === "true") return;
  panel.dataset.actionsBound = "true";
  panel.addEventListener("click", e => {
    const closeButton = e.target.closest("#closeLootWindowBtn");
    if (closeButton) { closeLootWindow(); return; }
    const corpse = getCorpseById(activeLootCorpseId);
    const takeAllButton = e.target.closest("#takeAllLootBtn");
    if (takeAllButton) { takeAllCorpseLoot(corpse); return; }
    const takeButton = e.target.closest("button[data-loot-index]");
    if (takeButton) takeCorpseLootItem(corpse, Number(takeButton.dataset.lootIndex));
  });
}

function autoLootGoldOnlyCorpse(corpse) {
  if (hasFloor0LootAlreadyTaken(corpse)) {
    markCorpseLooted(corpse, { sync: false, announce: false });
    return true;
  }
  if (!isCorpseGoldOnly(corpse)) return false;
  rememberFloor0LootTaken(corpse);
  const gold = Math.max(0, Number(corpse.loot[0].amount) || 0);
  if (gold > 0) {
    player.coins += gold;
    addPlayerFeedbackText(`+${gold} gold`, { color: "#ffd86b", size: 16 });
    announcer(`You scooped ${gold} coins from ${corpse.name}. The accounting department applauds quietly.`);
  }
  markCorpseLooted(corpse);
  updateInventoryUI();
  updateHUD();
  return true;
}

function lootCorpse(corpse) {
  if (!corpse || corpse.looted) return;
  if (autoLootGoldOnlyCorpse(corpse)) return;
  openCorpseLootWindow(corpse);
}
