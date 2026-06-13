const ATTRIBUTE_DEFINITIONS = {
  strength: { id: "strength", name: "Strength", baseValue: 10, description: "Physical power for close-quarters violence.", effect: "+1% melee damage per point above 10." },
  agility: { id: "agility", name: "Agility", baseValue: 10, description: "Footwork, balance, and recovery under pressure.", effect: "+0.6% speed and dodge recovery per point above 10." },
  endurance: { id: "endurance", name: "Endurance", baseValue: 10, description: "Grit, pain tolerance, and not becoming floor decoration.", effect: "+3 max HP per point above 10." },
  perception: { id: "perception", name: "Perception", baseValue: 10, description: "Awareness of openings, traps, and incoming regret.", effect: "+0.2% critical chance per point above 10." },
  intellect: { id: "intellect", name: "Intellect", baseValue: 10, description: "Learning speed, tactical memory, and object permanence.", effect: "+1% skill XP per point above 10." },
  audienceAppeal: { id: "audienceAppeal", name: "Audience Appeal", baseValue: 10, description: "The crawler's gift for making danger marketable.", effect: "+1% dramatic coin and audience rewards per point above 10." }
};
const SKILL_DEFINITIONS = {
  blades: { id: "blades", name: "Blades", category: "Weapon", description: "Swords, daggers, axes, spears, and anything with an edge or point.", linkedAttribute: "strength" },
  blunt: { id: "blunt", name: "Blunt", category: "Weapon", description: "Hammers, clubs, maces, and other persuasive shapes.", linkedAttribute: "strength" },
  ranged: { id: "ranged", name: "Ranged", category: "Weapon", description: "Bows and projectile weapons used from cowardly, sensible distance.", linkedAttribute: "perception" },
  unarmed: { id: "unarmed", name: "Unarmed", category: "Weapon", description: "Fists, knees, elbows, and audited bad decisions.", linkedAttribute: "agility" },
  thrown: { id: "thrown", name: "Thrown", category: "Weapon", description: "Thrown weapons and lobbed items. Mostly future-proofed for now.", linkedAttribute: "agility" },
  armor: { id: "armor", name: "Armor", category: "Dungeon", description: "Getting hit while dressed for it.", linkedAttribute: "endurance" },
  evasion: { id: "evasion", name: "Evasion", category: "Dungeon", description: "Dodges, near-misses, and looking busy while not being bitten.", linkedAttribute: "agility" },
  looting: { id: "looting", name: "Looting", category: "Dungeon", description: "Finding value in containers, corpses, and legally gray opportunities.", linkedAttribute: "perception" },
  scavenging: { id: "scavenging", name: "Scavenging", category: "Dungeon", description: "Turning dungeon trash into survival margins.", linkedAttribute: "endurance" },
  survival: { id: "survival", name: "Survival", category: "Dungeon", description: "Lasting longer than the dungeon's confidence in you.", linkedAttribute: "endurance" },
  lightHandling: { id: "lightHandling", name: "Light Handling", category: "Dungeon", description: "Managing torches and visibility without becoming a glowing snack.", linkedAttribute: "perception" },
  trapSense: { id: "trapSense", name: "Trap Sense", category: "Dungeon", description: "Noticing suspicious floor décor before it notices you.", linkedAttribute: "perception" },
  cartography: { id: "cartography", name: "Cartography", category: "Dungeon", description: "Remembering where the walls, doors, and panic routes are.", linkedAttribute: "intellect" },
  audienceAppeal: { id: "audienceAppeal", name: "Audience Appeal", category: "Dungeon", description: "Earning cheers by making combat look intentional.", linkedAttribute: "audienceAppeal" }
};

function getDefaultProgressionState() {
  return {
    attributes: Object.fromEntries(Object.values(ATTRIBUTE_DEFINITIONS).map(def => [def.id, { ...def, value: def.baseValue }])),
    skills: Object.fromEntries(Object.values(SKILL_DEFINITIONS).map(def => [def.id, { ...def, level: 1, xp: 0, xpToNext: 28 }])),
    unspentAttributePoints: 0
  };
}

function initProgression(options = {}) {
  if (options.freshRun || options.reset || options.newRun) return resetRunProgression({ resetVitals: options.resetVitals !== false });
  return preserveActiveRunProgression({ resetVitals: options.resetVitals === true });
}

function initProgressionForNewRun(options = {}) { return resetRunProgression({ resetVitals: options.resetVitals !== false }); }
function resetProgression(options = {}) { return resetRunProgression(options); }

function preserveActiveRunProgression(options = {}) {
  player.progression = mergeProgression(player.progression);
  applyProgressionBonuses({ resetVitals: options.resetVitals === true });
  return player.progression;
}

function mergeProgression(saved, defaults = getDefaultProgressionState()) {
  const merged = { ...defaults, attributes: { ...defaults.attributes }, skills: { ...defaults.skills } };
  for (const [id, attr] of Object.entries(saved?.attributes || {})) if (merged.attributes[id]) merged.attributes[id] = { ...merged.attributes[id], value: Math.max(1, Number(attr.value) || merged.attributes[id].value) };
  for (const [id, skill] of Object.entries(saved?.skills || {})) if (merged.skills[id]) merged.skills[id] = { ...merged.skills[id], level: Math.max(1, Number(skill.level) || 1), xp: Math.max(0, Number(skill.xp) || 0), xpToNext: Math.max(1, Number(skill.xpToNext) || merged.skills[id].xpToNext) };
  merged.unspentAttributePoints = Math.max(0, Number(saved?.unspentAttributePoints) || 0);
  return merged;
}

function makeDefaultProgression() { return getDefaultProgressionState(); }
let savedProgressionStorageCleared = false;
function saveProgression() { return null; } // Deprecated no-op: progression is run-only and never persisted.
function loadProgression() { return null; } // Deprecated no-op: progression is run-only and never loaded.
function clearSavedProgressionStorage() {
  if (savedProgressionStorageCleared) return;
  savedProgressionStorageCleared = true;
  try {
    const oldProgressionKeys = [
      "dcw.progression.v1",
      "dcw.playerProgression.v1",
      "dcw.playerLevel.v1",
      "dcw.playerXp.v1",
      "dcw.skillProgression.v1",
      "dcw.attributeProgression.v1"
    ];
    for (const key of oldProgressionKeys) localStorage.removeItem(key);
  } catch {}
}
function resetRunProgression(options = {}) {
  player.level = 1;
  player.xp = 0;
  player.xpToNext = 40;
  player.progression = getDefaultProgressionState();
  clearSavedProgressionStorage();
  applyProgressionBonuses({ resetVitals: options.resetVitals !== false });
  if (typeof updateInventoryUI === "function") updateInventoryUI();
  if (typeof updateProgressionPanel === "function") {
    const panel = document.getElementById("progressionPanel");
    if (panel?.classList.contains("open")) updateProgressionPanel();
  }
  if (typeof updateHUD === "function") updateHUD();
  return player.progression;
}
function getSkillLevel(skillId) { return player.progression?.skills?.[skillId]?.level || 1; }
function getAttributeValue(attributeId) { return player.progression?.attributes?.[attributeId]?.value || ATTRIBUTE_DEFINITIONS[attributeId]?.baseValue || 1; }
function progressionBonusPct(level, perLevel = 0.01) { return Math.max(0, (getSkillLevel(level) - 1) * perLevel); }
function getAttributeOffset(attributeId) { return Math.max(0, getAttributeValue(attributeId) - (ATTRIBUTE_DEFINITIONS[attributeId]?.baseValue || 10)); }
function getSkillXpMultiplier() { return 1 + getAttributeOffset("intellect") * 0.01; }
function getMeleeDamageMultiplier() { return 1 + getAttributeOffset("strength") * 0.01; }
function getProgressionMaxHpBonus() { return getAttributeOffset("endurance") * 3; }
function getProgressionSpeedMultiplier() { return 1 + getAttributeOffset("agility") * 0.006; }
function getProgressionAudienceMultiplier() { return 1 + getAttributeOffset("audienceAppeal") * 0.01; }
function getProgressionCritChance() { return Math.min(0.08, getAttributeOffset("perception") * 0.002); }
function getWeaponSkillForItem(item) {
  const weaponId = item?.weaponId || item?.id || player.currentWeaponId || "fists";
  const name = `${item?.name || weaponId}`.toLowerCase();
  if (weaponId === "fists" || name.includes("fist")) return "unarmed";
  if (weaponId === "bow" || name.includes("bow") || name.includes("ranged")) return "ranged";
  if (weaponId === "hammer" || /hammer|club|mace|blunt/.test(name)) return "blunt";
  if (/throw|thrown|javelin/.test(name)) return "thrown";
  return "blades";
}
function getWeaponSkillDamageMultiplier(weapon) {
  const skillId = getWeaponSkillForItem(weapon);
  return 1 + Math.max(0, getSkillLevel(skillId) - 1) * 0.01;
}
function awardSkillXp(skillId, amount, reason = "practice") {
  if (!player.progression) preserveActiveRunProgression();
  const skill = player.progression.skills?.[skillId];
  if (!skill || amount <= 0) return false;
  skill.xp += Math.max(1, Math.round(amount * getSkillXpMultiplier()));
  let leveled = false;
  while (skill.xp >= skill.xpToNext) {
    skill.xp -= skill.xpToNext;
    skill.level++;
    skill.xpToNext = Math.floor(skill.xpToNext * 1.18 + 8);
    leveled = true;
    achievement("SKILL INCREASED", `${skill.name} increased to ${skill.level}`, `skill_${skill.id}_${skill.level}`);
  }
  if (typeof gainXP === "function") gainXP(Math.max(1, Math.floor(amount * 0.35)), { silent: true });
  applyProgressionBonuses();
  if (typeof updateInventoryUI === "function") updateInventoryUI();
  if (typeof updateHUD === "function") updateHUD();
  return leveled;
}
function applyProgressionBonuses(options = {}) { if (!player.progression) return; if (typeof recalcEquipmentStats === "function") recalcEquipmentStats(); if (options.resetVitals) player.hp = player.maxHp; }
function awardWeaponSkillXpForHit(weapon, dealt = 0) { awardSkillXp(getWeaponSkillForItem(weapon), Math.max(3, Math.min(12, 4 + Math.round(dealt * 0.18))), "weapon_hit"); }
