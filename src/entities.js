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
  const boxChance = enemy.boss ? 0.95 : 0.07 + Math.min(0.10, currentFloor * 0.015);

  if (Math.random() < gearChance) loot.push(generateGear(enemy.boss || enemy.level > player.level + 2));
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

function lootCorpse(corpse) {
  if (!corpse || corpse.looted) return;
  corpse.looted = true;

  if (!corpse.loot.length) {
    announcer(`You searched ${corpse.name}. It contained disappointment and several fluids best left unidentified.`);
    return;
  }

  const gained = [];
  for (const item of corpse.loot) {
    if (item.type === "coins") {
      player.coins += item.amount;
      gained.push(`${item.amount} coins`);
    } else {
      player.inventory.push(item);
      if (item.type === "lootbox") stats.lootBoxesFound++;
      if (item.type === "gear") stats.gearFound++;
      gained.push(item.name);
    }
  }

  changeAudience(corpse.boss ? 8 : 1);
  achievement(
    corpse.boss ? "BOSS CORPSE LOOTED" : "CORPSE LOOTED",
    `You searched ${corpse.name} and found ${gained.join(", ")}. The dungeon reminds you this is technically recycling.`,
    `loot_${corpse.id}`
  );
  updateInventoryUI();
  updateHUD();
}


