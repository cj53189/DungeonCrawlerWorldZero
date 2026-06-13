const PET_DEFINITIONS = {
  fluffy_cat: {
    id: "fluffy_cat", displayName: "Fluffy Cat", role: "Arcane Ranged", cost: 200,
    description: "A spoiled-looking cat whose eyes glow with deeply unreasonable magical confidence.",
    attackType: "magic_missile", primarySkill: "Magic Missile Eye Beams",
    baseStats: { hp: 53, damage: 14, speed: 2.35, range: 250, cooldown: 58, followDistance: 34, r: 8 },
    attributes: { strength: 4, agility: 7, endurance: 4, intellect: 11, perception: 9 },
    skills: { melee: 1, magic: 4, guard: 1, tracking: 3 }
  },
  small_velociraptor: {
    id: "small_velociraptor", displayName: "Small Velociraptor", role: "Fast Melee", cost: 200,
    description: "A tiny feathered problem with claws, teeth, and career goals.",
    attackType: "lunge_bite", primarySkill: "Lunge Bite",
    baseStats: { hp: 70, damage: 13, speed: 3.05, range: 30, cooldown: 38, followDistance: 38, r: 9 },
    attributes: { strength: 7, agility: 12, endurance: 7, intellect: 3, perception: 8 },
    skills: { melee: 4, magic: 0, guard: 1, tracking: 3 }
  },
  small_dog: {
    id: "small_dog", displayName: "Small Dog", role: "Loyal Guard", cost: 200,
    description: "A brave little dog who has not read the dungeon waiver.",
    attackType: "guard_bite", primarySkill: "Guard Bite / Distract",
    baseStats: { hp: 94, damage: 10, speed: 2.55, range: 28, cooldown: 48, followDistance: 42, r: 9 },
    attributes: { strength: 6, agility: 7, endurance: 12, intellect: 4, perception: 8 },
    skills: { melee: 3, magic: 0, guard: 4, tracking: 2 }
  }
};
const PET_MERCHANT_OPTIONS = ["fluffy_cat", "small_velociraptor", "small_dog"];

function createPet(type, x = player.x, y = player.y) {
  const def = PET_DEFINITIONS[type];
  if (!def) return null;
  const stats = def.baseStats;
  return {
    id: `pet_${type}_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
    type, name: def.displayName, displayName: def.displayName,
    level: 1, xp: 0, xpToNext: 30,
    hp: stats.hp, maxHp: stats.hp, damage: stats.damage, speed: stats.speed, range: stats.range,
    attackCooldown: 0, attackCooldownMax: stats.cooldown, followDistance: stats.followDistance,
    x, y, r: stats.r, targetEnemyId: null,
    attributes: { ...def.attributes }, skills: { ...def.skills }, kills: 0, damageDealt: 0
  };
}

function getPetDefinition(petOrType) { return PET_DEFINITIONS[typeof petOrType === "string" ? petOrType : petOrType?.type] || null; }
function getActivePet() { return player.pet || player.equipment?.pet || null; }
function setActivePet(pet) { player.pet = pet || null; if (player.equipment) player.equipment.pet = pet || null; }
function resetPetState() { setActivePet(null); }

function petLevelDamage(pet) {
  if (!pet) return 0;
  if (pet.type === "fluffy_cat") return 10 + pet.level * 4;
  if (pet.type === "small_velociraptor") return 8 + pet.level * 5;
  return 7 + pet.level * 3;
}
function petLevelHp(pet) {
  if (pet.type === "fluffy_cat") return 45 + pet.level * 8;
  if (pet.type === "small_velociraptor") return 60 + pet.level * 10;
  return 80 + pet.level * 14;
}
function awardPetXp(pet, amount) {
  if (!pet || amount <= 0) return;
  pet.xp += Math.ceil(amount);
  while (pet.xp >= pet.xpToNext) {
    pet.xp -= pet.xpToNext; pet.level++; pet.xpToNext = Math.floor(pet.xpToNext * 1.45 + 12);
    const oldMax = pet.maxHp; pet.maxHp = petLevelHp(pet); pet.hp = Math.min(pet.maxHp, pet.hp + Math.max(1, pet.maxHp - oldMax));
    pet.damage = petLevelDamage(pet); pet.speed += pet.type === "small_velociraptor" ? 0.06 : 0.035;
    announcer(`${pet.displayName} reached level ${pet.level}. The dungeon regrets offering a pet policy.`);
  }
  updateHUD();
}
function damageEnemyByPet(enemy, damage, pet) {
  if (!enemy || enemy.hp <= 0 || !pet) return false;
  if (enemy.boss) triggerBossAggro("pet");
  const before = enemy.hp;
  const dealt = Math.max(0, Math.min(before, damage));
  enemy.hp -= damage; pet.damageDealt += dealt;
  addFloatingFeedbackText(`-${Math.round(dealt)}`, enemy.x, enemy.y - enemy.r, { anchor: enemy, color: "#b9f6ff", size: 14 });
  applyKnockback(enemy, pet.x, pet.y, enemy.boss ? 0.5 : Math.min(10, 3 + dealt * 0.18));
  awardPetXp(pet, Math.max(1, dealt * 0.25));
  if (typeof sendFloor0EnemyEvent === "function") sendFloor0EnemyEvent(enemy.hp <= 0 ? "enemy_killed" : "enemy_damaged", enemy);
  if (enemy.hp <= 0) {
    pet.kills++; stats.enemiesKilled++; changeAudience(enemy.boss ? 8 : 3); gainXP(enemy.xpReward || 15); createCorpse(enemy);
    awardPetXp(pet, enemy.xpReward || 15);
    if (enemy.boss) completeBossEncounter(enemy);
  }
  return enemy.hp < before;
}
function playerRoomForPet() { return rooms.find(r => r.id === player.currentRoomId) || roomForTile(Math.floor(player.x / TILE), Math.floor(player.y / TILE)); }
function enemyInPlayerRoom(enemy, room) {
  if (!enemy || enemy.hp <= 0 || !room) return false;
  const ex = Math.floor(enemy.x / TILE), ey = Math.floor(enemy.y / TILE);
  return enemy.roomId === room.id || roomContainsTile(room, ex, ey) || roomForTile(ex, ey)?.id === room.id;
}
function findPetTarget(pet) {
  if (!pet || player.safe) return null;
  const room = playerRoomForPet();
  let best = null, bestDist = Infinity;
  for (const enemy of enemies) {
    if (!enemyInPlayerRoom(enemy, room)) continue;
    const distFromPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distFromPlayer > 420) continue;
    const d = Math.hypot(enemy.x - pet.x, enemy.y - pet.y);
    if (d < bestDist) { best = enemy; bestDist = d; }
  }
  return best;
}
function movePetToward(pet, x, y, speedScale = 1) {
  const dx = x - pet.x, dy = y - pet.y, dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const step = Math.min(dist, pet.speed * speedScale);
  moveEntity(pet, dx / dist * step, dy / dist * step, { countWallBump: false });
}
function followPlayer(pet) {
  const backX = player.x - (player.aimX || 1) * pet.followDistance;
  const backY = player.y - (player.aimY || 0) * pet.followDistance + 12;
  const dist = Math.hypot(pet.x - player.x, pet.y - player.y);
  if (dist > TILE * 8 || !canMoveTo(pet.x, pet.y, pet.r)) { pet.x = backX; pet.y = backY; return; }
  if (Math.hypot(pet.x - backX, pet.y - backY) > 10) movePetToward(pet, backX, backY, dist > TILE * 3 ? 1.6 : 0.8);
}
function updatePet() {
  const pet = getActivePet();
  if (!pet) return;
  pet.attackCooldown = Math.max(0, pet.attackCooldown - 1);
  if (pet.hp <= 0) { followPlayer(pet); return; }
  const target = findPetTarget(pet);
  pet.targetEnemyId = target?.id || null;
  if (!target) { followPlayer(pet); return; }
  const def = getPetDefinition(pet);
  const dist = Math.hypot(target.x - pet.x, target.y - pet.y);
  if (def.attackType === "magic_missile") {
    if (dist > pet.range * 0.72) movePetToward(pet, target.x, target.y, 0.9);
    if (dist <= pet.range && pet.attackCooldown <= 0 && hasLineOfSight(pet.x, pet.y, target.x, target.y)) {
      const dir = normalizeVector(target.x - pet.x, target.y - pet.y);
      projectiles.push({ x: pet.x + dir.x * (pet.r + 4), y: pet.y + dir.y * (pet.r + 4), vx: dir.x * 6.8, vy: dir.y * 6.8, remainingRange: pet.range, radius: 4, damage: pet.damage, color: "rgba(159,235,255,0.92)", hitEnemies: new Set(), hitCrawlers: new Set(), pvpEnabled: false, hit: false, petOwnerId: pet.id });
      pet.attackCooldown = pet.attackCooldownMax;
    }
  } else {
    if (dist > pet.r + target.r + 4) movePetToward(pet, target.x, target.y, def.attackType === "lunge_bite" ? 1.28 : 1.0);
    if (dist <= pet.r + target.r + pet.range && pet.attackCooldown <= 0) {
      let dmg = pet.damage;
      if (def.attackType === "lunge_bite" && Math.random() < 0.22) dmg = Math.round(dmg * 1.6);
      damageEnemyByPet(target, dmg, pet);
      if (def.attackType === "guard_bite" && Math.random() < 0.35) target.damageCooldown = Math.max(target.damageCooldown || 0, 35);
      pet.attackCooldown = pet.attackCooldownMax;
    }
  }
}
