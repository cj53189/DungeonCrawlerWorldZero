const PROGRESSION_STORAGE_KEY = "dcw.progression.v1";
// Player progression is run-scoped. This key is only referenced to clear
// stale saves from older builds that persisted level, XP, skills, or attributes.
const STARTING_ATTRIBUTE_POINTS = 3;
const STARTING_SKILL_POINTS = 1;
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

function makeDefaultProgression() {
  return {
    attributes: Object.fromEntries(Object.values(ATTRIBUTE_DEFINITIONS).map(def => [def.id, { ...def, value: def.baseValue }])),
    skills: Object.fromEntries(Object.values(SKILL_DEFINITIONS).map(def => [def.id, { ...def, level: 1, xp: 0, xpToNext: 28 }])),
    unspentAttributePoints: STARTING_ATTRIBUTE_POINTS,
    unspentSkillPoints: STARTING_SKILL_POINTS,
    temporaryClass: "Fresh Crawler",
    temporaryClassDescription: "Unassigned. The dungeon is waiting to judge your opening mistakes."
  };
}

function initProgression(options = {}) {
  const fresh = makeDefaultProgression();
  if (!player.progression || options.reset) player.progression = fresh;
  else player.progression = mergeProgression(player.progression, fresh);
  updateTemporaryClass();
  clearLegacyProgressionSave();
  applyProgressionBonuses();
  return player.progression;
}

function mergeProgression(saved, defaults = makeDefaultProgression()) {
  const merged = { ...defaults, attributes: { ...defaults.attributes }, skills: { ...defaults.skills } };
  for (const [id, attr] of Object.entries(saved?.attributes || {})) if (merged.attributes[id]) merged.attributes[id] = { ...merged.attributes[id], value: Math.max(1, Number(attr.value) || merged.attributes[id].value) };
  for (const [id, skill] of Object.entries(saved?.skills || {})) if (merged.skills[id]) merged.skills[id] = { ...merged.skills[id], level: Math.max(1, Number(skill.level) || 1), xp: Math.max(0, Number(skill.xp) || 0), xpToNext: Math.max(1, Number(skill.xpToNext) || merged.skills[id].xpToNext) };
  merged.unspentAttributePoints = Math.max(0, Number(saved?.unspentAttributePoints) || 0);
  merged.unspentSkillPoints = Math.max(0, Number(saved?.unspentSkillPoints) || 0);
  merged.temporaryClass = saved?.temporaryClass || defaults.temporaryClass;
  merged.temporaryClassDescription = saved?.temporaryClassDescription || defaults.temporaryClassDescription;
  return merged;
}

function clearLegacyProgressionSave() { try { localStorage.removeItem(PROGRESSION_STORAGE_KEY); } catch {} }

// Reserved for future account/meta-progression. Current player progression is
// run-scoped, so these intentionally avoid saving or restoring level, XP,
// skills, or attributes across browser sessions.
function saveProgression() { clearLegacyProgressionSave(); }
function loadProgression() { clearLegacyProgressionSave(); }
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
function progressionPointSummary() {
  const progression = player.progression || initProgression({ skipLoad: true });
  return {
    attributePoints: Math.max(0, Number(progression.unspentAttributePoints) || 0),
    skillPoints: Math.max(0, Number(progression.unspentSkillPoints) || 0)
  };
}
function getTemporaryClass() {
  if (!player.progression) initProgression({ skipLoad: true });
  return player.progression?.temporaryClass || "Fresh Crawler";
}
function getTemporaryClassDescription() {
  if (!player.progression) initProgression({ skipLoad: true });
  return player.progression?.temporaryClassDescription || "Unassigned. The dungeon is waiting to judge your opening mistakes.";
}
function updateTemporaryClass() {
  if (!player.progression) return "Fresh Crawler";
  const attrs = player.progression.attributes || {};
  const offset = id => Math.max(0, Number(attrs[id]?.value || ATTRIBUTE_DEFINITIONS[id]?.baseValue || 10) - (ATTRIBUTE_DEFINITIONS[id]?.baseValue || 10));
  const spread = Object.keys(ATTRIBUTE_DEFINITIONS).map(id => ({ id, value: offset(id) })).sort((a, b) => b.value - a.value);
  const top = spread[0] || { id: "none", value: 0 };
  const second = spread[1] || { id: "none", value: 0 };
  let temporaryClass = "Fresh Crawler";
  let description = "Unassigned. The dungeon is waiting to judge your opening mistakes.";

  if (top.value <= 0) {
    temporaryClass = "Fresh Crawler";
    description = "No opening specialization. Brave, in the way blank forms are brave.";
  } else if (offset("strength") >= 2 && offset("endurance") >= 1) {
    temporaryClass = "Bruiser";
    description = "Melee-forward, durable, and probably overconfident near teeth.";
  } else if (offset("agility") >= 2 && offset("perception") >= 1) {
    temporaryClass = "Skirmisher";
    description = "Fast, twitchy, and built to survive by not being where the bite lands.";
  } else if (offset("perception") >= 2 && offset("intellect") >= 1) {
    temporaryClass = "Scout";
    description = "Observant and tactical. Still edible, but harder to surprise.";
  } else if (offset("intellect") >= 2 && offset("audienceAppeal") >= 1) {
    temporaryClass = "Strategist";
    description = "Learns quickly and knows how to make the dungeon camera care.";
  } else if (offset("endurance") >= 2) {
    temporaryClass = "Survivor";
    description = "Harder to remove from the board. The dungeon hates persistence.";
  } else if (offset("strength") >= 2) {
    temporaryClass = "Brawler";
    description = "Solves early problems by applying knuckles to the question.";
  } else if (offset("agility") >= 2) {
    temporaryClass = "Runner";
    description = "Movement-first. Great for people who believe distance is a medical plan.";
  } else if (offset("perception") >= 2) {
    temporaryClass = "Lookout";
    description = "Better odds of noticing openings before they become regrets.";
  } else if (offset("intellect") >= 2) {
    temporaryClass = "Tactician";
    description = "Learns faster. Still has to survive long enough for that to matter.";
  } else if (offset("audienceAppeal") >= 2) {
    temporaryClass = "Showboat";
    description = "The dungeon audience likes the brand. The monsters remain undecided.";
  } else {
    temporaryClass = `${ATTRIBUTE_DEFINITIONS[top.id]?.name || "Mixed"} Lean`;
    description = second.value > 0 ? `A light ${ATTRIBUTE_DEFINITIONS[top.id]?.name || "stat"}/${ATTRIBUTE_DEFINITIONS[second.id]?.name || "stat"} opening spread.` : `A light ${ATTRIBUTE_DEFINITIONS[top.id]?.name || "stat"} opening lean.`;
  }

  player.progression.temporaryClass = temporaryClass;
  player.progression.temporaryClassDescription = description;
  return temporaryClass;
}
function spendAttributePoint(attributeId) {
  if (!player.progression) initProgression({ skipLoad: true });
  const attr = player.progression.attributes?.[attributeId];
  if (!attr || player.progression.unspentAttributePoints <= 0) return false;
  attr.value = Math.max(1, Number(attr.value) || attr.baseValue || 10) + 1;
  player.progression.unspentAttributePoints = Math.max(0, Math.trunc(Number(player.progression.unspentAttributePoints) || 0) - 1);
  updateTemporaryClass();
  applyProgressionBonuses();
  if (typeof updateInventoryUI === "function") updateInventoryUI();
  if (typeof updateHUD === "function") updateHUD();
  return true;
}
function spendSkillPoint(skillId) {
  if (!player.progression) initProgression({ skipLoad: true });
  const skill = player.progression.skills?.[skillId];
  if (!skill || player.progression.unspentSkillPoints <= 0) return false;
  skill.level = Math.max(1, Math.trunc(Number(skill.level) || 1)) + 1;
  skill.xp = 0;
  player.progression.unspentSkillPoints = Math.max(0, Math.trunc(Number(player.progression.unspentSkillPoints) || 0) - 1);
  updateTemporaryClass();
  applyProgressionBonuses();
  if (typeof updateInventoryUI === "function") updateInventoryUI();
  if (typeof updateHUD === "function") updateHUD();
  return true;
}
function awardSkillXp(skillId, amount, reason = "practice") {
  if (!player.progression) initProgression({ skipLoad: true });
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
  updateTemporaryClass();
  applyProgressionBonuses();
  if (typeof updateInventoryUI === "function") updateInventoryUI();
  if (typeof updateHUD === "function") updateHUD();
  return leveled;
}
function applyProgressionBonuses() { if (!player.progression) return; if (typeof recalcEquipmentStats === "function") recalcEquipmentStats(); }
function awardWeaponSkillXpForHit(weapon, dealt = 0) { awardSkillXp(getWeaponSkillForItem(weapon), Math.max(3, Math.min(12, 4 + Math.round(dealt * 0.18))), "weapon_hit"); }
