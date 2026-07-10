const PROGRESSION_STORAGE_KEY = "dcw.progression.v1";
// Player progression is run-scoped. This key is only referenced to clear
// stale saves from older builds that persisted level, XP, skills, or attributes.
const STARTING_ATTRIBUTE_POINTS = 12;
const STARTING_SKILL_POINTS = 9;
const STARTING_ATTRIBUTE_CAP = 13;
const ATTRIBUTE_DEFINITIONS = {
  strength: { id: "strength", name: "Strength", baseValue: 8, description: "Physical power for close-quarters violence.", effect: "+1% melee damage per point above 8." },
  agility: { id: "agility", name: "Agility", baseValue: 8, description: "Footwork, balance, and recovery under pressure.", effect: "+0.6% speed and dodge recovery per point above 8." },
  endurance: { id: "endurance", name: "Endurance", baseValue: 8, description: "Grit, pain tolerance, and not becoming floor decoration.", effect: "+3 max HP per point above 8." },
  perception: { id: "perception", name: "Perception", baseValue: 8, description: "Awareness of openings, traps, and incoming regret.", effect: "+0.2% critical chance per point above 8." },
  intellect: { id: "intellect", name: "Intellect", baseValue: 8, description: "Learning speed, tactical memory, and object permanence.", effect: "+1% skill XP per point above 8." },
  audienceAppeal: { id: "audienceAppeal", name: "Audience Appeal", baseValue: 8, description: "The crawler's gift for making danger marketable.", effect: "+1% dramatic coin and audience rewards per point above 8." }
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

const ORIGIN_DEFINITIONS = {
  unsortedCrawler: {
    id: "unsortedCrawler",
    name: "Unsorted Crawler",
    description: "No strong read yet. The dungeon has filed you under 'pending incident.'",
    skillWeights: {},
    attributeWeights: {}
  },
  securityContractor: {
    id: "securityContractor",
    name: "Security Contractor",
    description: "Weapon comfort, armor instincts, and a suspicious familiarity with bad rooms.",
    skillWeights: { blades: 2.1, armor: 1.8, survival: 1.2, perception: 0.6 },
    attributeWeights: { strength: 0.7, endurance: 0.7, perception: 0.35 }
  },
  bouncer: {
    id: "bouncer",
    name: "Bouncer",
    description: "Built for handling problems that have elbows, shoes, and terrible timing.",
    skillWeights: { blunt: 2, unarmed: 1.7, armor: 1.2, evasion: 0.5 },
    attributeWeights: { strength: 0.9, endurance: 0.8 }
  },
  scout: {
    id: "scout",
    name: "Scout",
    description: "Distance, routes, traps, and the healthy belief that teeth are worse up close.",
    skillWeights: { ranged: 2, trapSense: 1.7, cartography: 1.5, lightHandling: 0.7 },
    attributeWeights: { perception: 0.9, agility: 0.5, intellect: 0.35 }
  },
  grifter: {
    id: "grifter",
    name: "Grifter",
    description: "Fast hands, faster excuses, and a gift for making survival look like branding.",
    skillWeights: { looting: 2, evasion: 1.6, audienceAppeal: 1.7, thrown: 0.7 },
    attributeWeights: { audienceAppeal: 0.9, agility: 0.55, perception: 0.35 }
  },
  urbanExplorer: {
    id: "urbanExplorer",
    name: "Urban Explorer",
    description: "Comfortable in abandoned spaces, dark corners, and places with lawsuits waiting to hatch.",
    skillWeights: { scavenging: 2, lightHandling: 1.7, cartography: 1.5, survival: 1.1 },
    attributeWeights: { perception: 0.55, endurance: 0.45, intellect: 0.35 }
  },
  prizeIdiot: {
    id: "prizeIdiot",
    name: "Prize Idiot",
    description: "A camera-friendly menace with hands, confidence, and unclear long-term planning.",
    skillWeights: { unarmed: 2, evasion: 1.5, audienceAppeal: 1.8, blunt: 0.6 },
    attributeWeights: { audienceAppeal: 0.9, agility: 0.55, strength: 0.35 }
  },
  survivalist: {
    id: "survivalist",
    name: "Survivalist",
    description: "Makes supplies last, mistakes hurt less, and panic look like meal prep.",
    skillWeights: { survival: 2, scavenging: 1.7, armor: 1.1, lightHandling: 0.7 },
    attributeWeights: { endurance: 0.9, perception: 0.45 }
  },
  analyst: {
    id: "analyst",
    name: "Analyst",
    description: "Reads patterns, maps bad decisions, and probably overthinks doors before opening them anyway.",
    skillWeights: { cartography: 2, trapSense: 1.8, ranged: 1, audienceAppeal: 0.4 },
    attributeWeights: { intellect: 0.9, perception: 0.7 }
  },
  knifeProblem: {
    id: "knifeProblem",
    name: "Knife Problem",
    description: "Edges, movement, and looting habits that make nearby legal departments sweat.",
    skillWeights: { blades: 2, evasion: 1.6, looting: 1.3, thrown: 0.9 },
    attributeWeights: { agility: 0.7, strength: 0.35, perception: 0.35 }
  }
};

function makeDefaultProgression() {
  return {
    attributes: Object.fromEntries(Object.values(ATTRIBUTE_DEFINITIONS).map(def => [def.id, { ...def, value: def.baseValue }])),
    skills: Object.fromEntries(Object.values(SKILL_DEFINITIONS).map(def => [def.id, { ...def, level: 1, xp: 0, xpToNext: 28 }])),
    unspentAttributePoints: STARTING_ATTRIBUTE_POINTS,
    unspentSkillPoints: STARTING_SKILL_POINTS,
    originProfile: ORIGIN_DEFINITIONS.unsortedCrawler.name,
    originProfileId: ORIGIN_DEFINITIONS.unsortedCrawler.id,
    originProfileDescription: ORIGIN_DEFINITIONS.unsortedCrawler.description,
    behaviorProfile: { tags: [], updatedAtFloor: 0 },
    floor3Offers: null,
    floor3OfferNoticeShown: false,
    raceId: null,
    raceName: null,
    raceTone: null,
    classId: null,
    className: null,
    classTone: null,
    floor3ChoiceComplete: false,
    floor3ChoiceSelectedAtFloor: null,
    floor3ChoiceSelectedAt: null,
    // Backward-compatible aliases. Race/class proper arrives later on Floor 3.
    temporaryClass: ORIGIN_DEFINITIONS.unsortedCrawler.name,
    temporaryClassDescription: ORIGIN_DEFINITIONS.unsortedCrawler.description
  };
}

function initProgression(options = {}) {
  const fresh = makeDefaultProgression();
  if (!player.progression || options.reset) player.progression = fresh;
  else player.progression = mergeProgression(player.progression, fresh);
  updateOriginProfile();
  updateBehaviorProfile();
  clearLegacyProgressionSave();
  applyProgressionBonuses();
  return player.progression;
}

function mergeProgression(saved, defaults = makeDefaultProgression()) {
  const merged = { ...defaults, attributes: { ...defaults.attributes }, skills: { ...defaults.skills }, behaviorProfile: { ...defaults.behaviorProfile } };
  for (const [id, attr] of Object.entries(saved?.attributes || {})) if (merged.attributes[id]) merged.attributes[id] = { ...merged.attributes[id], value: Math.max(1, Number(attr.value) || merged.attributes[id].value) };
  for (const [id, skill] of Object.entries(saved?.skills || {})) if (merged.skills[id]) merged.skills[id] = { ...merged.skills[id], level: Math.max(1, Number(skill.level) || 1), xp: Math.max(0, Number(skill.xp) || 0), xpToNext: Math.max(1, Number(skill.xpToNext) || merged.skills[id].xpToNext) };
  merged.unspentAttributePoints = Math.max(0, Number(saved?.unspentAttributePoints) || 0);
  merged.unspentSkillPoints = Math.max(0, Number(saved?.unspentSkillPoints) || 0);
  const savedOriginName = saved?.originProfile || saved?.temporaryClass || defaults.originProfile;
  const savedOriginDef = Object.values(ORIGIN_DEFINITIONS).find(def => def.name === savedOriginName || def.id === saved?.originProfileId) || ORIGIN_DEFINITIONS.unsortedCrawler;
  merged.originProfile = savedOriginName || savedOriginDef.name;
  merged.originProfileId = saved?.originProfileId || savedOriginDef.id;
  merged.originProfileDescription = saved?.originProfileDescription || saved?.temporaryClassDescription || savedOriginDef.description;
  merged.behaviorProfile = {
    tags: Array.isArray(saved?.behaviorProfile?.tags) ? saved.behaviorProfile.tags.slice(0, 12) : [],
    updatedAtFloor: Math.max(0, Math.trunc(Number(saved?.behaviorProfile?.updatedAtFloor) || 0))
  };
  for (const key of ["floor3Offers", "floor3OfferNoticeShown", "raceId", "raceName", "raceTone", "classId", "className", "classTone", "floor3ChoiceComplete", "floor3ChoiceSelectedAtFloor", "floor3ChoiceSelectedAt"]) {
    if (saved && Object.prototype.hasOwnProperty.call(saved, key)) merged[key] = saved[key];
  }
  merged.temporaryClass = merged.originProfile;
  merged.temporaryClassDescription = merged.originProfileDescription;
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
function getAttributeOffset(attributeId) { return Math.max(0, getAttributeValue(attributeId) - (ATTRIBUTE_DEFINITIONS[attributeId]?.baseValue || 8)); }
function getSkillOffset(skillId) { return Math.max(0, getSkillLevel(skillId) - 1); }
function getSkillXpMultiplier() { return 1 + getAttributeOffset("intellect") * 0.01; }
const CLASSIFICATION_RACE_EFFECTS = {
  halfGiant: { maxHp: 16, melee: 0.04, speed: -0.02 }, stoneblood: { maxHp: 14, melee: 0.03 }, ironblood: { maxHp: 10, melee: 0.04 },
  goblin: { speed: 0.025, audience: 0.05 }, ratkin: { speed: 0.04, crit: 0.01 }, shadowling: { speed: 0.035, crit: 0.015 },
  mothkin: { speed: 0.03, crit: 0.012 }, serpentkin: { melee: 0.035, crit: 0.01 }, constructTouched: { maxHp: 12, melee: 0.025 },
  cockroachkin: { maxHp: 18 }, slimeTouched: { maxHp: 8, speed: 0.02 }, plagueTouched: { melee: 0.05, maxHp: 6 }, humanVariant: { maxHp: 6, speed: 0.01, audience: 0.02 }
};
const CLASSIFICATION_CLASS_EFFECTS = {
  bulwark: { maxHp: 18 }, doorKicker: { melee: 0.08 }, bladeSentinel: { melee: 0.06, crit: 0.01 }, bruiser: { melee: 0.09 }, painSponge: { maxHp: 22 },
  ranger: { crit: 0.035, speed: 0.015 }, trapwright: { crit: 0.02 }, cartographer: { speed: 0.025 }, grifter: { audience: 0.1, speed: 0.015 }, lootguard: { maxHp: 8, audience: 0.07 },
  hypeConduit: { audience: 0.14 }, survivalist: { maxHp: 12, speed: 0.01 }, junkArtificer: { maxHp: 9, melee: 0.03 }, brawler: { melee: 0.1 }, knifeDancer: { melee: 0.07, speed: 0.025 },
  toxicologist: { crit: 0.025, melee: 0.03 }, tactician: { crit: 0.03 }, escapeArtist: { speed: 0.05 }, wildShot: { crit: 0.04 }, wallScholar: { maxHp: 10 },
  violentSolutionist: { melee: 0.11 }, omenListener: { crit: 0.025, audience: 0.05 }, daredevil: { speed: 0.03, audience: 0.08 }, luckyBastard: { crit: 0.05 },
  backAlleyAlchemist: { melee: 0.04, maxHp: 7 }, chaosAccountant: { crit: 0.02, audience: 0.08 }
};
function getClassificationEffects() {
  const effects = { maxHp: 0, melee: 0, speed: 0, audience: 0, crit: 0 };
  for (const source of [CLASSIFICATION_RACE_EFFECTS[player.progression?.raceId], CLASSIFICATION_CLASS_EFFECTS[player.progression?.classId]]) {
    for (const key of Object.keys(effects)) effects[key] += Number(source?.[key]) || 0;
  }
  return effects;
}
function describeClassificationEffects() {
  const e = getClassificationEffects();
  const parts = [];
  if (e.maxHp) parts.push(`${e.maxHp > 0 ? "+" : ""}${e.maxHp} max HP`);
  if (e.melee) parts.push(`${Math.round(e.melee * 100)}% melee damage`);
  if (e.speed) parts.push(`${Math.round(e.speed * 100)}% speed`);
  if (e.crit) parts.push(`${Math.round(e.crit * 100)}% critical chance`);
  if (e.audience) parts.push(`${Math.round(e.audience * 100)}% audience rewards`);
  return parts.join(", ") || "No classification modifiers";
}
function getMeleeDamageMultiplier() { return 1 + getAttributeOffset("strength") * 0.01 + getClassificationEffects().melee; }
function getProgressionMaxHpBonus() { return getAttributeOffset("endurance") * 3 + getClassificationEffects().maxHp; }
function getProgressionSpeedMultiplier() { return 1 + getAttributeOffset("agility") * 0.006 + getClassificationEffects().speed; }
function getProgressionAudienceMultiplier() { return 1 + getAttributeOffset("audienceAppeal") * 0.01 + getClassificationEffects().audience; }
function getProgressionCritChance() { return Math.min(0.2, getAttributeOffset("perception") * 0.002 + getClassificationEffects().crit); }
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
function getStartingAttributeCap() { return STARTING_ATTRIBUTE_CAP; }
function canSpendAttributePoint(attributeId) {
  if (!player.progression) initProgression({ skipLoad: true });
  const attr = player.progression?.attributes?.[attributeId];
  if (!attr || player.progression.unspentAttributePoints <= 0) return false;
  const value = Math.max(1, Number(attr.value) || attr.baseValue || 8);
  return value < STARTING_ATTRIBUTE_CAP;
}
function getOriginProfile() {
  if (!player.progression) initProgression({ skipLoad: true });
  return player.progression?.originProfile || ORIGIN_DEFINITIONS.unsortedCrawler.name;
}
function getOriginProfileDescription() {
  if (!player.progression) initProgression({ skipLoad: true });
  return player.progression?.originProfileDescription || ORIGIN_DEFINITIONS.unsortedCrawler.description;
}
function scoreOriginDefinition(def) {
  let score = 0;
  for (const [skillId, weight] of Object.entries(def.skillWeights || {})) score += getSkillOffset(skillId) * weight;
  for (const [attributeId, weight] of Object.entries(def.attributeWeights || {})) score += getAttributeOffset(attributeId) * weight;
  return score;
}
function updateOriginProfile() {
  if (!player.progression) return ORIGIN_DEFINITIONS.unsortedCrawler.name;
  const spentSkillPoints = Object.keys(SKILL_DEFINITIONS).reduce((sum, id) => sum + getSkillOffset(id), 0);
  const spentAttributePoints = Object.keys(ATTRIBUTE_DEFINITIONS).reduce((sum, id) => sum + getAttributeOffset(id), 0);
  let origin = ORIGIN_DEFINITIONS.unsortedCrawler;
  if (spentSkillPoints + spentAttributePoints > 0) {
    origin = Object.values(ORIGIN_DEFINITIONS)
      .filter(def => def.id !== ORIGIN_DEFINITIONS.unsortedCrawler.id)
      .map(def => ({ def, score: scoreOriginDefinition(def) }))
      .sort((a, b) => b.score - a.score)[0]?.def || ORIGIN_DEFINITIONS.unsortedCrawler;
  }
  player.progression.originProfile = origin.name;
  player.progression.originProfileId = origin.id;
  player.progression.originProfileDescription = origin.description;
  player.progression.temporaryClass = origin.name;
  player.progression.temporaryClassDescription = origin.description;
  return origin.name;
}
// Compatibility wrappers for older UI hooks. Pre-Floor-3 identity is an origin, not a class.
function getTemporaryClass() { return getOriginProfile(); }
function getTemporaryClassDescription() { return getOriginProfileDescription(); }
function updateTemporaryClass() { return updateOriginProfile(); }

function getCrawlerBehaviorTags(statsSource = (typeof stats !== "undefined" ? stats : null)) {
  if (!statsSource) return [];
  const tags = [];
  const push = (id, label, reason) => tags.push({ id, label, reason });
  if ((statsSource.damageTaken || 0) >= 60) push("pain_sponge", "Pain Sponge", "Took heavy early damage and stayed useful enough to remain a problem.");
  if ((statsSource.missedAttacks || 0) >= 10) push("air_murderer", "Air Murderer", "Attacked empty space with measurable conviction.");
  if ((statsSource.wallBumps || 0) >= 10) push("wall_scholar", "Wall Scholar", "Collected field data by face-checking architecture.");
  if ((statsSource.chestsOpened || 0) >= 6 || (statsSource.lootBoxesOpened || 0) >= 4) push("loot_goblin", "Loot Goblin", "Opened enough containers to concern local property law.");
  if ((statsSource.doorsOpened || 0) >= 8) push("door_problem", "Door Problem", "Displayed repeated confidence around suspicious doors.");
  if ((statsSource.enemiesKilled || 0) >= 12) push("violent_solutionist", "Violent Solutionist", "Resolved many arguments through sudden monster depreciation.");
  if ((statsSource.interactionsWithNothing || 0) >= 5) push("nothing_whisperer", "Nothing Whisperer", "Repeatedly attempted diplomacy with empty space.");
  if ((statsSource.safeRoomEntries || 0) >= 3) push("cautious_or_lost", "Cautious or Lost", "Returned to safety often enough for the dungeon to start a folder.");
  if ((statsSource.timeOutsideSafeRoomFrames || 0) > 3600 && (statsSource.timeOutsideSafeRoomFrames || 0) > (statsSource.timeInSafeRoomFrames || 0) * 2) push("risk_tolerant", "Risk Tolerant", "Spent a long time outside safe rooms, for bravery or poor planning.");
  if ((statsSource.gearFound || 0) >= 5) push("gear_magpie", "Gear Magpie", "Collected shiny survival-adjacent objects with purpose-ish energy.");
  if ((statsSource.corpsesConsumed || 0) >= 3) push("ecology_feeder", "Ecology Feeder", "Allowed the corpse cycle to convert several problems into winged problems.");
  if ((statsSource.vespasEmerged || 0) >= 2) push("vespa_midwife", "Vespa Midwife", "Presided over multiple janitor-mob transformations, intentionally or otherwise.");
  return tags.slice(0, 5);
}
function updateBehaviorProfile() {
  if (!player.progression) return [];
  const tags = getCrawlerBehaviorTags();
  player.progression.behaviorProfile = { tags, updatedAtFloor: Math.max(0, Number(currentFloor) || 0) };
  return tags;
}
function getBehaviorProfile() {
  if (!player.progression) initProgression({ skipLoad: true });
  return player.progression?.behaviorProfile || { tags: [], updatedAtFloor: 0 };
}

function spendAttributePoint(attributeId) {
  if (!player.progression) initProgression({ skipLoad: true });
  const attr = player.progression.attributes?.[attributeId];
  if (!attr || !canSpendAttributePoint(attributeId)) return false;
  attr.value = Math.max(1, Number(attr.value) || attr.baseValue || 8) + 1;
  player.progression.unspentAttributePoints = Math.max(0, Math.trunc(Number(player.progression.unspentAttributePoints) || 0) - 1);
  updateOriginProfile();
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
  updateOriginProfile();
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
  updateOriginProfile();
  applyProgressionBonuses();
  if (typeof updateInventoryUI === "function") updateInventoryUI();
  if (typeof updateHUD === "function") updateHUD();
  return leveled;
}
function applyProgressionBonuses() { if (!player.progression) return; if (typeof recalcEquipmentStats === "function") recalcEquipmentStats(); }
function awardWeaponSkillXpForHit(weapon, dealt = 0) { awardSkillXp(getWeaponSkillForItem(weapon), Math.max(3, Math.min(12, 4 + Math.round(dealt * 0.18))), "weapon_hit"); }
