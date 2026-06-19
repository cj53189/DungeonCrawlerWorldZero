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

(function loadVoiceDebugOverlayAfterGameScripts() {
  function loadVoiceDebugOverlay() {
    if (document.querySelector('script[src="./src/voice-debug-overlay.js"]')) return;
    const script = document.createElement("script");
    script.src = "./src/voice-debug-overlay.js";
    document.head.appendChild(script);
  }

  if (document.readyState === "complete") loadVoiceDebugOverlay();
  else window.addEventListener("load", loadVoiceDebugOverlay, { once: true });
})();
