// Weapon balance pass: make weapon families feel different without adding new animation requirements.
(function installWeaponBalancePass() {
  if (window.__dcwWeaponBalancePassInstalled) return;
  window.__dcwWeaponBalancePassInstalled = true;

  const BALANCE = Object.freeze({
    sword: { name: "Sword", feel: "Reliable blade", weight: 13, rarityVariance: 2, damage: 20, range: 66, cooldown: 26, attackShape: { type: "arc", radius: 66, angle: Math.PI * 0.62 }, telegraphColor: "rgba(145,205,255,0.56)" },
    dagger: { name: "Dagger", feel: "Fast short blade", weight: 11, rarityVariance: 1, damage: 14, range: 44, cooldown: 16, attackShape: { type: "arc", radius: 44, angle: Math.PI * 0.48 }, telegraphColor: "rgba(210,165,255,0.56)" },
    greatsword: { name: "Greatsword", feel: "Heavy wide blade", weight: 5, rarityVariance: 3, damage: 29, range: 80, cooldown: 40, attackShape: { type: "arc", radius: 80, angle: Math.PI * 0.76 }, telegraphColor: "rgba(145,205,255,0.56)" },
    axe: { name: "Axe", feel: "Slow heavy cleaver", weight: 8, rarityVariance: 3, damage: 32, range: 60, cooldown: 42, attackShape: { type: "arc", radius: 60, angle: Math.PI * 0.72 }, telegraphColor: "rgba(255,145,110,0.58)" },
    spear: { name: "Spear", feel: "Long narrow thrust", weight: 8, rarityVariance: 2, damage: 22, range: 122, cooldown: 32, attackShape: { type: "line", length: 122, width: 18 }, telegraphColor: "rgba(155,255,175,0.58)" },
    halberd: { name: "Halberd", feel: "Reach weapon", weight: 4, rarityVariance: 3, damage: 27, range: 108, cooldown: 40, attackShape: { type: "line", length: 108, width: 24 }, telegraphColor: "rgba(155,255,175,0.58)" },
    hammer: { name: "Hammer", feel: "Brutal close bonk", weight: 6, rarityVariance: 4, damage: 39, range: 48, cooldown: 56, attackShape: { type: "circle", radius: 48 }, telegraphColor: "rgba(255,190,90,0.58)" },
    mace: { name: "Mace", feel: "Compact blunt force", weight: 8, rarityVariance: 3, damage: 34, range: 50, cooldown: 46, attackShape: { type: "circle", radius: 50 }, telegraphColor: "rgba(255,190,90,0.58)" },
    shield: { name: "Shield", feel: "Defensive bash", weight: 5, rarityVariance: 1, damage: 13, range: 44, cooldown: 22, defenseBonus: 1, attackShape: { type: "circle", radius: 44 }, telegraphColor: "rgba(160,210,255,0.52)" },
    bow: { name: "Bow", feel: "Steady ranged fire", weight: 9, rarityVariance: 2, damage: 19, range: 320, cooldown: 40, attackShape: { type: "projectile", speed: 7.5, radius: 4 }, telegraphColor: "rgba(255,240,135,0.62)" },
    crossbow: { name: "Crossbow", feel: "Slow hard shot", weight: 5, rarityVariance: 3, damage: 30, range: 300, cooldown: 56, attackShape: { type: "projectile", speed: 8.8, radius: 4 }, telegraphColor: "rgba(255,240,135,0.62)" },
    staff: { name: "Staff", feel: "Quick magic bolt", weight: 7, rarityVariance: 2, damage: 16, range: 260, cooldown: 45, attackShape: { type: "projectile", speed: 6.4, radius: 5 }, telegraphColor: "rgba(195,145,255,0.62)" },
    tome: { name: "Tome", feel: "Slow charged spell", weight: 4, rarityVariance: 3, damage: 24, range: 220, cooldown: 56, attackShape: { type: "projectile", speed: 5.7, radius: 7 }, telegraphColor: "rgba(255,125,80,0.64)" }
  });

  const RARITY_POWER = Object.freeze({ Common: 1, Uncommon: 2, Rare: 3, Epic: 4 });
  const RARITY_DAMAGE_MULT = Object.freeze({ Common: 1, Uncommon: 1.13, Rare: 1.28, Epic: 1.48 });
  const RARITY_RANGE_BONUS = Object.freeze({ Common: 0, Uncommon: 3, Rare: 7, Epic: 12 });
  const RARITY_COOLDOWN_BONUS = Object.freeze({ Common: 0, Uncommon: 1, Rare: 3, Epic: 5 });

  function applyDefinitions() {
    if (typeof WEAPON_DEFINITIONS === "undefined") return false;
    for (const [id, def] of Object.entries(BALANCE)) {
      WEAPON_DEFINITIONS[id] = { ...(WEAPON_DEFINITIONS[id] || {}), id, name: def.name, damage: def.damage, range: def.range, cooldown: def.cooldown, attackShape: { ...def.attackShape }, telegraphColor: def.telegraphColor, feel: def.feel, defenseBonus: def.defenseBonus || 0 };
      if (Array.isArray(WEAPON_ORDER) && !WEAPON_ORDER.includes(id)) WEAPON_ORDER.push(id);
      if (Array.isArray(LOOTABLE_WEAPON_IDS) && !LOOTABLE_WEAPON_IDS.includes(id)) LOOTABLE_WEAPON_IDS.push(id);
    }
    return true;
  }

  function chooseWeightedWeaponId() {
    const rows = Object.entries(BALANCE).filter(([id]) => typeof WEAPON_DEFINITIONS === "undefined" || WEAPON_DEFINITIONS[id]);
    const total = rows.reduce((sum, [, def]) => sum + Math.max(0, def.weight || 1), 0) || rows.length || 1;
    let roll = Math.random() * total;
    for (const [id, def] of rows) { roll -= Math.max(0, def.weight || 1); if (roll <= 0) return id; }
    return rows[0]?.[0] || "sword";
  }

  function rollBalancedRarity(forceRare = false) {
    const roll = Math.random();
    if (forceRare) return roll < 0.82 ? "Rare" : "Epic";
    if (roll < 0.57) return "Common";
    if (roll < 0.87) return "Uncommon";
    if (roll < 0.98) return "Rare";
    return "Epic";
  }

  function rarityPowerValue(rarity) { return RARITY_POWER[rarity] || 1; }
  function randomInt(maxInclusive) { return Math.floor(Math.random() * (Math.max(0, maxInclusive) + 1)); }

  function iconForWeapon(weaponId) {
    const pools = typeof RPG_WEAPON_ICONS !== "undefined" ? window.RPG_WEAPON_ICONS : null;
    if (!pools || typeof getRpgWeaponIcon !== "function") return null;
    const typeMatches = pools.filter(icon => {
      if (weaponId === "greatsword") return icon.type === "sword";
      if (weaponId === "hammer") return icon.type === "hammer" || icon.type === "mace";
      if (weaponId === "spear") return icon.type === "spear";
      if (weaponId === "bow") return icon.type === "bow";
      return icon.type === weaponId;
    });
    const pool = typeMatches.length ? typeMatches : pools.filter(icon => icon.type === "sword");
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  function buildWeaponName(rarity, weaponId, base, icon) {
    const prefix = Array.isArray(WEAPON_PREFIXES) && WEAPON_PREFIXES.length ? WEAPON_PREFIXES[Math.floor(Math.random() * WEAPON_PREFIXES.length)] : rarity;
    const baseName = icon?.name || base.name || BALANCE[weaponId]?.name || weaponId;
    return `${rarity} ${prefix} ${baseName}`;
  }

  function makeBalancedWeapon(forceRare = false, forcedWeaponId = null) {
    applyDefinitions();
    const weaponId = forcedWeaponId && WEAPON_DEFINITIONS?.[forcedWeaponId] && forcedWeaponId !== "fists" ? forcedWeaponId : chooseWeightedWeaponId();
    const base = WEAPON_DEFINITIONS[weaponId] || WEAPON_DEFINITIONS.sword || WEAPON_DEFINITIONS.greatsword;
    const tuned = BALANCE[weaponId] || base;
    const rarity = rollBalancedRarity(forceRare);
    const power = rarityPowerValue(rarity);
    const icon = iconForWeapon(weaponId);
    const variance = tuned.rarityVariance || 2;
    const damage = Math.max(1, Math.round((base.damage + randomInt(variance)) * (RARITY_DAMAGE_MULT[rarity] || 1)));
    const shapeType = base.attackShape?.type;
    const rangeBonus = RARITY_RANGE_BONUS[rarity] || 0;
    const range = base.range + (shapeType === "projectile" ? rangeBonus * 2 : shapeType === "line" ? rangeBonus : Math.floor(rangeBonus * 0.65));
    const cooldown = Math.max(10, base.cooldown - (RARITY_COOLDOWN_BONUS[rarity] || 0));
    const id = typeof makeId === "function" ? makeId("weapon") : `weapon_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
    const item = { id, type: "weapon", slot: "weapon", weaponId, iconId: icon?.id || null, rarity, name: buildWeaponName(rarity, weaponId, base, icon), damage, range, cooldown, attackShape: { ...base.attackShape }, telegraphColor: base.telegraphColor, feel: tuned.feel || base.feel || base.name };
    if (weaponId === "shield") item.defense = Math.max(1, (tuned.defenseBonus || 1) + Math.floor(power / 2));
    return item;
  }

  function patchGenerateWeapon() {
    if (typeof window.generateWeapon !== "function" && typeof generateWeapon !== "function") return false;
    window.generateWeapon = makeBalancedWeapon;
    try { generateWeapon = makeBalancedWeapon; } catch {}
    return true;
  }

  function patchDescriptions() {
    if (typeof itemDescription !== "function" || itemDescription.__dcwWeaponBalanceWrapped) return;
    const original = itemDescription;
    itemDescription = function weaponBalanceItemDescription(item) {
      if (item?.type === "weapon") {
        const base = BALANCE[item.weaponId] || WEAPON_DEFINITIONS?.[item.weaponId] || {};
        const feel = item.feel || base.feel || base.name || "Weapon";
        const defense = item.defense ? ` · +${item.defense} DEF` : "";
        return `${feel} · ${item.damage} DMG · ${item.range} RNG · ${item.cooldown} CD${defense}`;
      }
      return original(item);
    };
    itemDescription.__dcwWeaponBalanceWrapped = true;
  }

  function patchSkillMapping() {
    if (typeof getWeaponSkillForItem !== "function") return;
    getWeaponSkillForItem = function weaponBalanceSkillForItem(item) {
      const weaponId = item?.weaponId || item?.id || player.currentWeaponId || "fists";
      const name = `${item?.name || weaponId}`.toLowerCase();
      if (weaponId === "fists" || name.includes("fist")) return "unarmed";
      if (["bow", "crossbow", "staff", "tome"].includes(weaponId) || /bow|crossbow|staff|tome|wand|orb/.test(name)) return "ranged";
      if (["hammer", "mace", "shield"].includes(weaponId) || /hammer|mace|club|shield|blunt/.test(name)) return "blunt";
      if (/throw|thrown|javelin/.test(name)) return "thrown";
      return "blades";
    };
  }

  function install() {
    if (!applyDefinitions()) return false;
    patchGenerateWeapon();
    patchDescriptions();
    patchSkillMapping();
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
    return true;
  }

  if (!install()) {
    const retry = setInterval(() => { if (install()) clearInterval(retry); }, 100);
    setTimeout(() => clearInterval(retry), 3000);
  }

  window.DCW_WEAPON_BALANCE = BALANCE;
  window.generateBalancedWeapon = makeBalancedWeapon;
})();

(function loadInventoryUiScrollPatchAfterGameScripts() {
  function loadMobileSettingsWorkshop() {
    if (document.querySelector('script[src="./src/mobile-settings-workshop.js"]')) return;
    const settingsWorkshop = document.createElement("script");
    settingsWorkshop.src = "./src/mobile-settings-workshop.js";
    document.head.appendChild(settingsWorkshop);
  }

  function loadMobileSkillsLayout() {
    const existingMobileSkills = document.querySelector('script[src="./src/mobile-skills-layout.js"]');
    if (existingMobileSkills) {
      if (window.__dcwMobileSkillsLayoutInstalled) loadMobileSettingsWorkshop();
      else existingMobileSkills.addEventListener("load", loadMobileSettingsWorkshop, { once: true });
      return;
    }
    const mobileSkills = document.createElement("script");
    mobileSkills.src = "./src/mobile-skills-layout.js";
    mobileSkills.addEventListener("load", loadMobileSettingsWorkshop, { once: true });
    document.head.appendChild(mobileSkills);
  }

  const existing = document.querySelector('script[src="./src/inventory-ui-hardening.js"]');
  if (existing) {
    if (window.__dcwInventoryUiHardeningInstalled) loadMobileSkillsLayout();
    else existing.addEventListener("load", loadMobileSkillsLayout, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.src = "./src/inventory-ui-hardening.js";
  script.addEventListener("load", loadMobileSkillsLayout, { once: true });
  document.head.appendChild(script);
})();
