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
  const corpse = {
    id: makeId("corpse"),
    x: enemy.x,
    y: enemy.y,
    r: enemy.boss ? 18 : 11,
    boss: !!enemy.boss,
    name: enemy.boss ? `${enemy.name || "Boss"} Corpse` : `Level ${enemy.level || 1} Corpse`,
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
  if (!corpse || corpse.looted) return;
  activeLootCorpseId = corpse.id;
  renderCorpseLootWindow(corpse);
}

function finishCorpseLootIfEmpty(corpse) {
  if (!corpse || corpse.loot.length) return;
  corpse.looted = true;
  changeAudience(corpse.boss ? 8 : 1);
  achievement(
    corpse.boss ? "BOSS CORPSE LOOTED" : "CORPSE LOOTED",
    `You finished looting ${corpse.name}. The dungeon reminds you this is technically recycling.`,
    `loot_${corpse.id}`
  );
  closeLootWindow();
  updateHUD();
}

function takeCorpseLootItem(corpse, index) {
  if (!corpse || corpse.looted || index < 0 || index >= corpse.loot.length) return;
  const [item] = corpse.loot.splice(index, 1);
  if (item.type === "coins") {
    player.coins += item.amount;
    announcer(`You took ${item.amount} coins from ${corpse.name}. Brave accounting.`);
  } else {
    player.inventory.push(item);
    if (item.type === "lootbox") stats.lootBoxesFound++;
    if (item.type === "gear") stats.gearFound++;
    achievement(item.type === "weapon" ? "WEAPON LOOTED" : "CORPSE LOOT", `You took ${item.name} from ${corpse.name}. ${itemDescription(item)}`, `corpse_take_${corpse.id}_${item.id}`);
  }
  updateInventoryUI();
  updateHUD();
  finishCorpseLootIfEmpty(corpse);
  if (!corpse.looted) renderCorpseLootWindow(corpse);
}

function takeAllCorpseLoot(corpse) {
  if (!corpse || corpse.looted) return;
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

function lootCorpse(corpse) {
  openCorpseLootWindow(corpse);
}

