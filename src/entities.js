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
  const level = enemy.level || 1;
  const goldChance = enemy.boss ? 1 : 0.68;
  if (Math.random() < goldChance) {
    const coins = (enemy.boss ? 18 : 1) + Math.floor(Math.random() * (enemy.boss ? 24 : 6)) + Math.floor(level * (enemy.boss ? 3 : 0.8));
    if (coins > 0) loot.push(generateGoldItem(coins));
  }

  const forceRare = enemy.boss || level > player.level + 2;
  const weaponChance = enemy.boss ? 0.55 : 0.05 + Math.min(0.07, level * 0.006);
  const gearChance = enemy.boss ? 0.72 : 0.07 + Math.min(0.10, level * 0.008);
  const boxChance = enemy.boss ? 0.45 : 0.035 + Math.min(0.06, currentFloor * 0.01);
  const junkChance = enemy.boss ? 0.20 : 0.18;

  if (Math.random() < weaponChance) loot.push(generateWeaponItem(forceRare));
  if (Math.random() < gearChance) loot.push(generateGear(forceRare));
  if (Math.random() < boxChance) loot.push(generateLootBox(forceRare));
  if (Math.random() < junkChance || loot.length === 0) loot.push(generateJunkItem());
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
  openCorpseLoot(corpse);
}
