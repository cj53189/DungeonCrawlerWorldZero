(function installCanvasTransformCompatibilityGuard() {
  const proto = window.CanvasRenderingContext2D?.prototype;
  if (!proto || proto.setTransform.__dcwCompatGuard) return;

  const nativeSetTransform = proto.setTransform;
  proto.setTransform = function setTransformCompat(a, b, c, d, e, f) {
    if (arguments.length === 5 && typeof a === "number") {
      return nativeSetTransform.call(this, a, b, c, d, e, 0);
    }
    return nativeSetTransform.apply(this, arguments);
  };
  proto.setTransform.__dcwCompatGuard = true;
})();

(function installTitleRoomBackoutSpawnReset() {
  function modePromptIsOpen() {
    const prompt = document.getElementById("titleRoomModePrompt");
    return !!prompt && prompt.classList.contains("open");
  }

  function leaderboardIsOpen() {
    const panel = document.getElementById("leaderboardPanel");
    return !!panel && panel.style.display === "block";
  }

  function resetTitleRoomToSpawn() {
    const screen = document.getElementById("titleScreen");
    if (!screen) return;

    const previousDisplay = screen.style.display;
    screen.style.display = "none";

    requestAnimationFrame(() => {
      screen.style.display = previousDisplay || "flex";
    });
  }

  document.addEventListener("click", event => {
    const prompt = document.getElementById("titleRoomModePrompt");
    if (!prompt?.classList.contains("open")) return;

    const choice = event.target.closest?.("button[data-title-choice]")?.dataset?.titleChoice;
    const clickedBackdrop = event.target === prompt;
    if (choice === "cancel" || clickedBackdrop) setTimeout(resetTitleRoomToSpawn, 0);
  }, true);

  document.addEventListener("click", event => {
    if (!leaderboardIsOpen()) return;
    const closeControl = event.target.closest?.("#closeLeaderboardBtn, #backFromLeaderboardBtn");
    if (closeControl) setTimeout(resetTitleRoomToSpawn, 0);
  }, true);

  document.addEventListener("keydown", event => {
    const key = event.key?.toLowerCase?.();
    if ((key === "escape" || key === "backspace") && modePromptIsOpen()) {
      setTimeout(resetTitleRoomToSpawn, 0);
      return;
    }
    if ((key === "escape" || key === "backspace") && leaderboardIsOpen()) {
      const hide = window.DCWZLeaderboard?.hide;
      if (typeof hide === "function") hide();
      setTimeout(resetTitleRoomToSpawn, 0);
    }
  }, true);
})();

(function loadCleanUiEditorV2() {
  if (document.querySelector('script[src="./src/ui-editor-v2.js"]')) return;
  const script = document.createElement("script");
  script.src = "./src/ui-editor-v2.js";
  script.defer = true;
  document.head.appendChild(script);
})();

(function loadPetVisionRevealFixAfterGameScripts() {
  function loadFix() {
    if (document.querySelector('script[src="./src/pet-vision-reveal-fix.js"]')) return;
    const script = document.createElement("script");
    script.src = "./src/pet-vision-reveal-fix.js";
    document.head.appendChild(script);
  }

  if (document.readyState === "complete") loadFix();
  else window.addEventListener("load", loadFix, { once: true });
})();

(function installSettingsLandscapeScrollAndReturnTitleFix() {
  const STYLE_ID = "settingsLandscapeScrollFixStyles";
  const BUTTON_ID = "settingsReturnTitleBtn";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.settingsOverlayOpen {
        touch-action: auto !important;
      }

      #settingsOverlay.open,
      #settingsPanel,
      #settingsPanel .settingsBody {
        touch-action: pan-y !important;
      }

      #settingsOverlay.open {
        overflow: hidden;
      }

      #settingsPanel .settingsBody {
        -webkit-overflow-scrolling: touch;
        overflow-y: auto !important;
      }

      #settingsPanel .settingsFooter {
        display: grid;
        gap: 8px;
      }

      #settingsReturnTitleBtn {
        border-color: rgba(124,247,255,0.52);
        background: linear-gradient(135deg, rgba(70,142,164,0.96), rgba(22,35,54,0.96));
        color: #effcff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.55);
      }

      #settingsReturnTitleBtn:active {
        transform: translateY(1px);
      }

      @media (hover: none) and (pointer: coarse), (max-width: 900px), (max-height: 520px) {
        #settingsOverlay.open {
          align-items: center;
          justify-content: center;
          padding: max(6px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right)) max(6px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left));
        }

        #settingsPanel {
          width: min(720px, calc(100vw - 16px));
          width: min(720px, calc(100dvw - 16px));
          height: min(520px, calc(100vh - 16px));
          height: min(520px, calc(100dvh - 16px));
          max-height: calc(100vh - 16px);
          max-height: calc(100dvh - 16px);
          min-height: 0;
        }

        #settingsPanel .settingsBody {
          min-height: 0;
        }
      }

      @media (orientation: landscape) and (max-height: 520px) {
        #settingsOverlay.open {
          align-items: stretch;
        }

        #settingsPanel {
          width: calc(100vw - 16px);
          width: calc(100dvw - 16px);
          height: calc(100vh - 16px);
          height: calc(100dvh - 16px);
          max-height: calc(100vh - 16px);
          max-height: calc(100dvh - 16px);
          padding: 8px;
          border-radius: 12px;
          font-size: 10px;
        }

        #settingsPanel h2 {
          margin-bottom: 4px;
          font-size: 14px;
        }

        .settingsSection {
          margin-top: 5px;
          padding: 5px 7px;
        }

        .settingsControlsTips {
          grid-template-columns: 1fr;
        }

        .settingsControlsTips div {
          font-size: 9px;
        }

        .settingsToggle,
        .settingsAction,
        #settingsPanel input[type="range"] {
          min-height: 40px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function syncSettingsBodyClass() {
    const overlay = document.getElementById("settingsOverlay");
    document.body.classList.toggle("settingsOverlayOpen", !!overlay?.classList.contains("open"));
  }

  function watchSettingsOverlay() {
    const overlay = document.getElementById("settingsOverlay");
    if (!overlay || overlay.dataset.scrollFixObserved === "true") return;
    overlay.dataset.scrollFixObserved = "true";
    new MutationObserver(syncSettingsBodyClass).observe(overlay, { attributes: true, attributeFilter: ["class"] });
    syncSettingsBodyClass();
  }

  function hidePanel(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = "none";
    el.classList.remove("open");
  }

  function returnToTitleFromSettings() {
    if (typeof resetTransientInputState === "function") resetTransientInputState();
    if (typeof closeSettingsPanel === "function") closeSettingsPanel();
    if (typeof resetMultiplayerState === "function") resetMultiplayerState();

    if (typeof setGameMode === "function" && typeof GAME_MODES !== "undefined") {
      setGameMode(GAME_MODES.TITLE);
    } else if (typeof GAME_MODES !== "undefined") {
      gameMode = GAME_MODES.TITLE;
    } else {
      gameMode = "title";
    }

    for (const id of [
      "centerMessage",
      "safeRoomRecap",
      "logPanel",
      "inventoryPanel",
      "progressionPanel",
      "lootWindow",
      "petMerchantPanel",
      "multiplayerPanel"
    ]) hidePanel(id);

    document.body.classList.remove("inventoryOpen", "progressionOpen");
    if (typeof hideMultiplayerPanel === "function") hideMultiplayerPanel();
    if (typeof showTitleScreen === "function") showTitleScreen();
    if (typeof updateModeChrome === "function") updateModeChrome();
    if (typeof updateTesterReadinessUI === "function") updateTesterReadinessUI();
    syncSettingsBodyClass();
  }

  function ensureReturnToTitleButton() {
    const footer = document.querySelector("#settingsPanel .settingsFooter");
    if (!footer || document.getElementById(BUTTON_ID)) return;
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = "settingsAction returnToTitleAction";
    button.type = "button";
    button.textContent = "Return to Title";
    button.addEventListener("click", returnToTitleFromSettings);
    footer.prepend(button);
  }

  function install() {
    injectStyles();
    watchSettingsOverlay();
    ensureReturnToTitleButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();

(function installFloorTransitionCarryoverHotfix() {
  if (window.__dcwFloorTransitionCarryoverHotfix) return;
  window.__dcwFloorTransitionCarryoverHotfix = true;

  const EQUIPMENT_SLOTS = ["weapon", "head", "chest", "offhand", "legs", "feet", "accessory", "light", "pet"];
  const originalResetState = window.resetState;

  function cloneValue(value, fallback = null) {
    if (value === undefined) return fallback;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      try { return structuredClone(value); }
      catch { return fallback; }
    }
  }

  function cloneInventory() {
    return Array.isArray(player?.inventory) ? player.inventory.map(item => cloneValue(item, { ...item })) : [];
  }

  function cloneEquipment() {
    const equipment = {};
    for (const slot of EQUIPMENT_SLOTS) {
      const item = player?.equipment?.[slot] || null;
      equipment[slot] = item ? cloneValue(item, { ...item }) : null;
    }
    return equipment;
  }

  function cloneStats() {
    const snapshot = {};
    if (!stats || typeof stats !== "object") return snapshot;
    for (const key of Object.keys(stats)) snapshot[key] = stats[key];
    return snapshot;
  }

  function achievementIdArray(value) {
    if (value instanceof Set) return Array.from(value);
    if (Array.isArray(value)) return value;
    return [];
  }

  function mergeAchievementHistory(snapshotHistory = []) {
    const live = Array.isArray(achievementHistory) ? achievementHistory.map(entry => ({ ...entry })) : [];
    const saved = Array.isArray(snapshotHistory) ? snapshotHistory.map(entry => ({ ...entry })) : [];
    const seen = new Set();
    const merged = [];
    for (const entry of [...live, ...saved]) {
      const key = `${entry?.title || ""}|${entry?.body || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
    }
    return merged.slice(0, 16);
  }

  window.captureRunProgress = function captureRunProgressWithCarryoverGuard() {
    return {
      player: {
        level: Number(player?.level) || 1,
        xp: Number(player?.xp) || 0,
        xpToNext: Number(player?.xpToNext) || 40,
        maxHp: Number(player?.maxHp) || 100,
        hp: Math.max(1, Number(player?.hp) || 1),
        attackDamage: Number(player?.attackDamage) || 20,
        baseSpeed: Number(player?.baseSpeed) || 2.45,
        speed: Number(player?.speed) || Number(player?.baseSpeed) || 2.45,
        defense: Number(player?.defense) || 0,
        audienceBonus: Number(player?.audienceBonus) || 0,
        coins: Math.max(0, Number(player?.coins) || 0),
        currentWeaponId: player?.currentWeaponId || "fists",
        aimX: Number(player?.aimX) || 1,
        aimY: Number(player?.aimY) || 0,
        inventory: cloneInventory(),
        equipment: cloneEquipment(),
        progression: player?.progression ? cloneValue(player.progression, null) : null,
        pet: player?.pet ? cloneValue(player.pet, null) : null
      },
      stats: cloneStats(),
      audienceScore: Number(audienceScore) || 10,
      currentReputation: currentReputation || "Undeclared Menace",
      achievementHistory: Array.isArray(achievementHistory) ? achievementHistory.map(entry => ({ ...entry })) : [],
      achievements: achievements instanceof Set ? Array.from(achievements) : []
    };
  };

  window.restoreRunProgress = function restoreRunProgressWithCarryoverGuard(snapshot) {
    if (!snapshot?.player) return;
    const saved = snapshot.player;
    const spawn = { x: player.x, y: player.y, currentRoomId: player.currentRoomId, safe: player.safe, wasSafe: player.wasSafe };

    player.level = Number(saved.level) || 1;
    player.xp = Math.max(0, Number(saved.xp) || 0);
    player.xpToNext = Math.max(1, Number(saved.xpToNext) || 40);
    player.maxHp = Math.max(1, Number(saved.maxHp) || 100);
    player.hp = Math.max(1, Math.min(Number(saved.hp) || player.maxHp, player.maxHp));
    player.attackDamage = Math.max(1, Number(saved.attackDamage) || 20);
    player.baseSpeed = Math.max(0.1, Number(saved.baseSpeed) || 2.45);
    player.speed = Math.max(0.1, Number(saved.speed) || player.baseSpeed);
    player.defense = Math.max(0, Number(saved.defense) || 0);
    player.audienceBonus = Math.max(0, Number(saved.audienceBonus) || 0);
    player.coins = Math.max(0, Number(saved.coins) || 0);
    player.currentWeaponId = saved.currentWeaponId || "fists";
    player.aimX = Number(saved.aimX) || 1;
    player.aimY = Number(saved.aimY) || 0;
    player.inventory = Array.isArray(saved.inventory) ? saved.inventory.map(item => cloneValue(item, { ...item })) : [];
    player.equipment = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, saved.equipment?.[slot] ? cloneValue(saved.equipment[slot], { ...saved.equipment[slot] }) : null]));

    if (typeof setActivePet === "function") {
      setActivePet(saved.pet ? cloneValue(saved.pet, null) : (player.equipment.pet || null));
    } else {
      player.pet = saved.pet ? cloneValue(saved.pet, null) : (player.equipment.pet || null);
    }

    if (saved.progression) {
      player.progression = typeof mergeProgression === "function" ? mergeProgression(saved.progression) : cloneValue(saved.progression, null);
    }

    if (snapshot.stats && typeof stats === "object") {
      for (const key of Object.keys(stats)) {
        if (key === "floorRooms") continue;
        if (Object.prototype.hasOwnProperty.call(snapshot.stats, key)) stats[key] = snapshot.stats[key];
      }
    }

    audienceScore = Number(snapshot.audienceScore) || audienceScore || 10;
    currentReputation = snapshot.currentReputation || currentReputation || "Undeclared Menace";

    const savedAchievements = achievementIdArray(snapshot.achievements);
    const liveAchievements = achievements instanceof Set ? Array.from(achievements) : [];
    achievements = new Set([...savedAchievements, ...liveAchievements]);
    achievementHistory = mergeAchievementHistory(snapshot.achievementHistory);

    if (typeof recalcEquipmentStats === "function") recalcEquipmentStats();
    if (!Number.isFinite(player.speed)) player.speed = player.baseSpeed;
    player.hp = Math.max(1, Math.min(player.hp, player.maxHp));

    player.x = spawn.x;
    player.y = spawn.y;
    player.currentRoomId = spawn.currentRoomId;
    player.safe = spawn.safe;
    player.wasSafe = spawn.wasSafe;

    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
    if (typeof renderLog === "function") renderLog();
  };

  if (typeof originalResetState === "function" && !originalResetState.__dcwCarryoverWrapped) {
    window.resetState = function resetStateWithCarryoverGuard(options = {}) {
      const preserveRun = !!options?.preserveRun;
      const snapshot = options?.snapshot || (preserveRun ? window.__dcwPendingRunSnapshot : null);
      const targetFloor = Number(options?.targetFloor);
      const hasTargetFloor = Number.isFinite(targetFloor);
      const guardedOptions = preserveRun && snapshot ? { ...options, snapshot } : options;

      if (preserveRun && hasTargetFloor) currentFloor = Math.trunc(targetFloor);
      const result = originalResetState.call(this, guardedOptions);

      if (preserveRun && snapshot) {
        if (hasTargetFloor) currentFloor = Math.trunc(targetFloor);
        window.restoreRunProgress(snapshot);
        if (hasTargetFloor) currentFloor = Math.trunc(targetFloor);
        gameWon = false;
        gameLost = false;
        pendingFloorAdvance = false;
        if (typeof updateHUD === "function") updateHUD();
      }

      return result;
    };
    window.resetState.__dcwCarryoverWrapped = true;
  }

  window.advanceToNextFloor = function advanceToNextFloorWithCarryoverGuard() {
    if (!pendingFloorAdvance) return;
    const targetFloor = Math.max(1, Math.trunc(Number(currentFloor) || 0) + 1);
    const snapshot = window.captureRunProgress();
    window.__dcwPendingRunSnapshot = snapshot;

    currentFloor = targetFloor;
    pendingFloorAdvance = false;

    if (typeof resetState === "function") {
      resetState({ preserveRun: true, snapshot, targetFloor });
    }

    currentFloor = targetFloor;
    window.restoreRunProgress(snapshot);
    currentFloor = targetFloor;
    gameWon = false;
    gameLost = false;
    pendingFloorAdvance = false;
    window.__dcwPendingRunSnapshot = null;

    if (typeof syncMusicToGameState === "function") syncMusicToGameState();
    if (typeof updateVisibility === "function") updateVisibility(true);
    if (typeof updateHUD === "function") updateHUD();
    if (typeof showFloorSplash === "function") showFloorSplash();
  };

  window.advanceToNextFloor.__dcwCarryoverWrapped = true;
})();