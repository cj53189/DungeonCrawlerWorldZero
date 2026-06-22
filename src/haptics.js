const HAPTICS_STORAGE_KEY = "dcw.haptics.enabled.v1";

const HAPTIC_PATTERNS = Object.freeze({
  tap: 8,
  ui: 10,
  dodge: 14,
  hit: 18,
  heavyHit: [24, 18, 24],
  damage: [35, 28, 42],
  loot: [14, 24, 18],
  success: [18, 26, 38],
  warning: [28, 34, 28],
  boss: [38, 28, 58, 34, 78],
  death: [80, 40, 120]
});

const HAPTIC_COOLDOWNS_MS = Object.freeze({
  tap: 70,
  ui: 90,
  dodge: 180,
  hit: 85,
  heavyHit: 160,
  damage: 420,
  loot: 220,
  success: 450,
  warning: 600,
  boss: 1200,
  death: 1800
});

let hapticsEnabled = readSavedHapticsEnabled();
let lastHapticAt = 0;
const lastHapticByType = new Map();

function isHapticsSupported() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function readSavedHapticsEnabled() {
  try {
    const saved = localStorage.getItem(HAPTICS_STORAGE_KEY);
    return saved == null ? true : saved === "true";
  } catch {
    return true;
  }
}

function writeSavedHapticsEnabled(enabled) {
  try { localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? "true" : "false"); } catch {}
}

function setHapticsEnabled(enabled, persist = true) {
  hapticsEnabled = !!enabled;
  if (persist) writeSavedHapticsEnabled(hapticsEnabled);
  updateHapticsSettingsUI();
  if (hapticsEnabled) triggerHaptic("ui", { force: true });
  return hapticsEnabled;
}

function getHapticsLabel() {
  if (!isHapticsSupported()) return "Unavailable";
  return hapticsEnabled ? "On" : "Off";
}

function updateHapticsSettingsUI() {
  const button = document.getElementById("hapticsToggleBtn");
  const status = document.getElementById("hapticsStatusText");
  if (button) {
    button.textContent = getHapticsLabel();
    button.setAttribute("aria-pressed", String(hapticsEnabled && isHapticsSupported()));
    button.classList.toggle("off", !hapticsEnabled || !isHapticsSupported());
    button.disabled = !isHapticsSupported();
  }
  if (status) {
    status.textContent = isHapticsSupported()
      ? "Combat, loot, danger, and big moments"
      : "Not supported by this browser/device";
  }
}

function triggerHaptic(type = "tap", options = {}) {
  if (!hapticsEnabled && !options.force) return false;
  if (!isHapticsSupported()) return false;
  if (typeof document !== "undefined" && document.hidden) return false;

  const now = Date.now();
  const cooldown = Number(options.cooldownMs ?? HAPTIC_COOLDOWNS_MS[type] ?? 120);
  const lastForType = lastHapticByType.get(type) || 0;
  if (!options.force && (now - lastForType < cooldown || now - lastHapticAt < 35)) return false;

  const pattern = options.pattern ?? HAPTIC_PATTERNS[type] ?? HAPTIC_PATTERNS.tap;
  try {
    navigator.vibrate(pattern);
    lastHapticAt = now;
    lastHapticByType.set(type, now);
    return true;
  } catch {
    return false;
  }
}

function injectHapticsSettingsRow() {
  if (document.getElementById("hapticsToggleBtn")) return;
  const interfaceSection = Array.from(document.querySelectorAll("#settingsPanel .settingsSection"))
    .find(section => /interface/i.test(section.querySelector("h3")?.textContent || ""));
  if (!interfaceSection) return;

  const row = document.createElement("div");
  row.className = "settingsRow";
  row.innerHTML = `<span>Haptics <small id="hapticsStatusText"></small></span><button id="hapticsToggleBtn" class="settingsToggle" type="button" aria-pressed="false">Off</button>`;
  const touchControlsRow = document.getElementById("touchControlsToggle")?.closest(".settingsRow");
  if (touchControlsRow?.nextSibling) interfaceSection.insertBefore(row, touchControlsRow.nextSibling);
  else interfaceSection.appendChild(row);

  document.getElementById("hapticsToggleBtn")?.addEventListener("click", () => setHapticsEnabled(!hapticsEnabled));
  updateHapticsSettingsUI();
}

function wrapHapticFunction(name, wrapper) {
  const original = globalThis[name];
  if (typeof original !== "function" || original.__hapticsWrapped) return false;
  const wrapped = wrapper(original);
  wrapped.__hapticsWrapped = true;
  globalThis[name] = wrapped;
  return true;
}

function installGameplayHapticHooks() {
  wrapHapticFunction("triggerDodge", original => function triggerDodgeWithHaptics() {
    const result = original.apply(this, arguments);
    if (result) triggerHaptic("dodge");
    return result;
  });

  wrapHapticFunction("damageEnemy", original => function damageEnemyWithHaptics(enemy, damage, sourceWeapon, attacker) {
    const wasAlive = !!enemy && Number(enemy.hp) > 0;
    const wasBoss = !!enemy?.boss;
    const beforeHp = Number(enemy?.hp) || 0;
    const result = original.apply(this, arguments);
    if (result && wasAlive) {
      const nowDead = Number(enemy?.hp) <= 0;
      if (nowDead && wasBoss) triggerHaptic("boss");
      else if (nowDead) triggerHaptic("success");
      else if (beforeHp - Number(enemy?.hp || 0) >= 25 || wasBoss) triggerHaptic("heavyHit");
      else triggerHaptic("hit");
    }
    return result;
  });

  wrapHapticFunction("damageCrawlerFromEnemy", original => function damageCrawlerFromEnemyWithHaptics(crawler, enemy) {
    const beforeHp = crawler === player ? Number(player.hp) || 0 : null;
    const result = original.apply(this, arguments);
    if (result && crawler === player && Number(player.hp) < beforeHp) {
      triggerHaptic(Number(player.hp) <= 0 ? "death" : "damage");
    }
    return result;
  });

  wrapHapticFunction("loseGame", original => function loseGameWithHaptics() {
    triggerHaptic("death", { force: true });
    return original.apply(this, arguments);
  });

  wrapHapticFunction("rewardChestLoot", original => function rewardChestLootWithHaptics() {
    const result = original.apply(this, arguments);
    triggerHaptic("loot");
    return result;
  });

  wrapHapticFunction("lootCorpse", original => function lootCorpseWithHaptics(corpse) {
    const result = original.apply(this, arguments);
    if (corpse && !corpse.looted) triggerHaptic(corpse.boss ? "boss" : "loot");
    return result;
  });

  wrapHapticFunction("openLootBox", original => function openLootBoxWithHaptics() {
    const beforeOpened = Number(stats?.lootBoxesOpened) || 0;
    const result = original.apply(this, arguments);
    if ((Number(stats?.lootBoxesOpened) || 0) > beforeOpened) triggerHaptic("success");
    return result;
  });

  wrapHapticFunction("equipItem", original => function equipItemWithHaptics() {
    const result = original.apply(this, arguments);
    triggerHaptic("ui");
    return result;
  });

  wrapHapticFunction("advanceToNextFloor", original => function advanceToNextFloorWithHaptics() {
    triggerHaptic("success", { force: true });
    return original.apply(this, arguments);
  });

  wrapHapticFunction("floorCollapseDeath", original => function floorCollapseDeathWithHaptics() {
    triggerHaptic("death", { force: true });
    return original.apply(this, arguments);
  });

  wrapHapticFunction("triggerBossAggro", original => function triggerBossAggroWithHaptics() {
    const wasAggroed = !!bossAggroed;
    const result = original.apply(this, arguments);
    if (!wasAggroed && bossAggroed) triggerHaptic("warning");
    return result;
  });
}

window.triggerHaptic = triggerHaptic;
window.setHapticsEnabled = setHapticsEnabled;
window.updateHapticsSettingsUI = updateHapticsSettingsUI;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    injectHapticsSettingsRow();
    updateHapticsSettingsUI();
  }, { once: true });
} else {
  injectHapticsSettingsRow();
  updateHapticsSettingsUI();
}

installGameplayHapticHooks();
