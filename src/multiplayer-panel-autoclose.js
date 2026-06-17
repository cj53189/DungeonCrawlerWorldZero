// Multiplayer UI cleanup: keep gameplay clear, make the lobby easier to use, and prevent stale arena messages from hijacking the title screen.
(function installMultiplayerUiCleanup() {
  const IDLE_SERVER_MESSAGE_TYPES = new Set(["welcome", "error"]);

  function isTitleModeActive() {
    return typeof GAME_MODES !== "undefined" && gameMode === GAME_MODES.TITLE;
  }

  function isArenaModeActive() {
    return !!(multiplayer?.arena || multiplayer?.mode === "pvp_arena");
  }

  function updateArenaBodyClass() {
    document.body.classList.toggle("pvpArenaActive", !!(multiplayer?.enabled && isArenaModeActive()));
  }

  function injectMultiplayerUiCleanupStyles() {
    if (document.getElementById("multiplayerUiCleanupStyles")) return;
    const style = document.createElement("style");
    style.id = "multiplayerUiCleanupStyles";
    style.textContent = `
      body:not(.multiplayerActive) #mpOpenPanelBtn,
      body.titleActive #mpOpenPanelBtn,
      body.pvpArenaActive #mpOpenPanelBtn,
      body.pvpArenaActive #multiplayerPanel {
        display: none !important;
      }

      .mpOpenPanelBtn {
        left: auto !important;
        right: max(12px, env(safe-area-inset-right)) !important;
        top: max(64px, calc(env(safe-area-inset-top) + 56px)) !important;
        z-index: 95 !important;
        min-width: 78px;
        min-height: 48px;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 10px 15px;
        border-radius: 999px;
        font-size: 12px;
        letter-spacing: 0.08em;
        box-shadow: 0 8px 24px rgba(0,0,0,0.42), 0 0 18px rgba(157,177,255,0.18);
        touch-action: manipulation;
      }

      #multiplayerPanel {
        left: auto !important;
        right: max(10px, env(safe-area-inset-right)) !important;
        top: max(60px, calc(env(safe-area-inset-top) + 52px)) !important;
        z-index: 96 !important;
        width: min(300px, calc(100vw - 20px));
        max-height: calc(100dvh - 86px - env(safe-area-inset-bottom));
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding: 10px 12px;
      }

      #multiplayerPanel .panelEyebrow {
        margin-top: 8px;
        font-size: 9px;
        letter-spacing: 0.12em;
      }

      #multiplayerPanel .panelEyebrow:first-of-type {
        margin-top: 0;
      }

      #multiplayerPanel .panelTitle {
        gap: 8px;
        margin-top: 4px;
        font-size: 12px;
      }

      #multiplayerPanel .partyCode,
      #multiplayerPanel .mpRuleText,
      #multiplayerPanel .mpConnectionStatus {
        margin-top: 6px;
        font-size: 10px;
        line-height: 1.25;
      }

      #multiplayerPanel .partyCode {
        word-break: break-word;
      }

      #multiplayerPanel .mpRuleText {
        max-height: 3.75em;
        overflow: hidden;
      }

      #multiplayerPanel .mpMemberList {
        margin-top: 6px;
        gap: 4px;
      }

      #multiplayerPanel .mpMember {
        padding: 5px 6px;
        font-size: 10px;
        gap: 6px;
      }

      #multiplayerPanel .mpMember span:last-child {
        font-size: 9px;
      }

      #multiplayerPanel .mpActions {
        grid-template-columns: 1fr;
        gap: 6px;
        margin-top: 8px;
      }

      #multiplayerPanel .mpActions button {
        min-height: 38px;
        padding: 8px 10px;
        font-size: 10px;
      }

      #multiplayerPanel .mpNearbyEmpty {
        display: none;
      }

      @media (orientation: landscape) and (max-height: 520px) {
        .mpOpenPanelBtn {
          top: max(8px, env(safe-area-inset-top)) !important;
          right: max(58px, calc(env(safe-area-inset-right) + 58px)) !important;
          min-height: 44px;
        }

        #multiplayerPanel {
          top: max(8px, env(safe-area-inset-top)) !important;
          max-height: calc(100dvh - 16px - env(safe-area-inset-bottom));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanMultiplayerTransientState() {
    multiplayer.currentRunId = null;
    multiplayer.currentFloorSeed = null;
    multiplayer.currentJoinState = "open";
    multiplayer.mode = null;
    multiplayer.arena = false;
    multiplayer.localStatus = "offline";
    if (multiplayer.pendingPartyInvites instanceof Map) multiplayer.pendingPartyInvites.clear();
    if (multiplayer.sentPartyInvites instanceof Map) multiplayer.sentPartyInvites.clear();
    if (typeof multiplayerNetwork !== "undefined") {
      multiplayerNetwork.lastCrawlerStateSignature = null;
      multiplayerNetwork.lastCrawlerStateSentAt = 0;
      multiplayerNetwork.lastEnemySnapshotSignature = null;
      multiplayerNetwork.lastEnemySnapshotSentAt = 0;
    }
    updateArenaBodyClass();
  }

  function pruneLobbyPanel() {
    updateArenaBodyClass();
    const nearbyList = document.getElementById("mpNearbyCrawlerList");
    if (nearbyList) {
      const hasNearbyRows = Array.from(nearbyList.children).some(child => !child.classList.contains("mpNearbyEmpty"));
      nearbyList.hidden = !hasNearbyRows;
      const nearbyHeader = nearbyList.previousElementSibling?.classList.contains("panelEyebrow")
        ? nearbyList.previousElementSibling
        : null;
      if (nearbyHeader) nearbyHeader.hidden = !hasNearbyRows;
    }
  }

  function setLobbyPanelOpenClean(isOpen) {
    updateArenaBodyClass();
    const panel = document.getElementById("multiplayerPanel");
    const openButton = document.getElementById("mpOpenPanelBtn");
    const canShowLobbyUi = !!(multiplayer?.enabled && !isArenaModeActive() && !isTitleModeActive());
    const shouldOpenPanel = !!(isOpen && canShowLobbyUi);

    if (panel) panel.style.display = shouldOpenPanel ? "block" : "none";
    if (openButton) openButton.style.display = canShowLobbyUi && !shouldOpenPanel ? "flex" : "none";
    pruneLobbyPanel();
  }

  function closeLobbyPanelForGameplay() {
    setLobbyPanelOpenClean(false);
  }

  function wrapGlobalFunction(name, after) {
    const original = window[name];
    if (typeof original !== "function" || original.__multiplayerUiCleanupWrapped) return;
    const wrapped = function wrappedMultiplayerUiFunction(...args) {
      const result = original.apply(this, args);
      after?.(args, result);
      return result;
    };
    wrapped.__multiplayerUiCleanupWrapped = true;
    window[name] = wrapped;
  }

  function patchLobbyPanelFunctions() {
    window.setMultiplayerPanelOpen = setLobbyPanelOpenClean;
    window.showMultiplayerPanel = function showCleanMultiplayerPanel() {
      setLobbyPanelOpenClean(true);
      if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
      if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
    };
    window.hideMultiplayerPanel = function hideCleanMultiplayerPanel() {
      setLobbyPanelOpenClean(false);
    };
  }

  function patchMultiplayerStateReset() {
    const original = window.resetMultiplayerState;
    if (typeof original !== "function" || original.__multiplayerUiCleanupWrapped) return;
    window.resetMultiplayerState = function resetMultiplayerStateWithUiCleanup(...args) {
      const result = original.apply(this, args);
      cleanMultiplayerTransientState();
      setLobbyPanelOpenClean(false);
      return result;
    };
    window.resetMultiplayerState.__multiplayerUiCleanupWrapped = true;
  }

  function patchReturnToTitle() {
    const original = window.returnToTitle;
    if (typeof original !== "function" || original.__multiplayerUiCleanupWrapped) return;
    window.returnToTitle = function returnToTitleWithMultiplayerCleanup(...args) {
      const result = original.apply(this, args);
      cleanMultiplayerTransientState();
      currentFloor = 0;
      gameWon = false;
      gameLost = false;
      pendingFloorAdvance = false;
      const center = document.getElementById("centerMessage");
      if (center) center.style.display = "none";
      setLobbyPanelOpenClean(false);
      if (typeof updateModeChrome === "function") updateModeChrome();
      return result;
    };
    window.returnToTitle.__multiplayerUiCleanupWrapped = true;
  }

  function patchServerMessageHandling() {
    const original = window.handleMultiplayerServerMessage;
    if (typeof original !== "function" || original.__multiplayerUiCleanupWrapped) return;
    window.handleMultiplayerServerMessage = function handleMultiplayerServerMessageWithIdleGuard(message) {
      const type = message?.type;
      if (!multiplayer?.enabled && isTitleModeActive() && !IDLE_SERVER_MESSAGE_TYPES.has(type)) return;
      return original.apply(this, arguments);
    };
    window.handleMultiplayerServerMessage.__multiplayerUiCleanupWrapped = true;
  }

  function patchPanelUpdates() {
    const original = window.updateMultiplayerPanel;
    if (typeof original !== "function" || original.__multiplayerUiCleanupWrapped) return;
    window.updateMultiplayerPanel = function updateMultiplayerPanelWithUiCleanup(...args) {
      const result = original.apply(this, args);
      pruneLobbyPanel();
      if (isArenaModeActive()) setLobbyPanelOpenClean(false);
      return result;
    };
    window.updateMultiplayerPanel.__multiplayerUiCleanupWrapped = true;
  }

  function bindStartButtonFallback(id, { arena = false } = {}) {
    const button = document.getElementById(id);
    if (!button || button.__multiplayerUiCleanupBound) return;
    button.__multiplayerUiCleanupBound = true;
    button.addEventListener("click", () => {
      if (arena && typeof multiplayer !== "undefined") multiplayer.arena = true;
      setTimeout(closeLobbyPanelForGameplay, 0);
      setTimeout(closeLobbyPanelForGameplay, 250);
    });
  }

  function install() {
    injectMultiplayerUiCleanupStyles();
    patchLobbyPanelFunctions();
    patchMultiplayerStateReset();
    patchReturnToTitle();
    patchServerMessageHandling();
    patchPanelUpdates();

    wrapGlobalFunction("startMultiplayerFloor0", () => closeLobbyPanelForGameplay());
    wrapGlobalFunction("prepareServerLobbyState", () => closeLobbyPanelForGameplay());
    wrapGlobalFunction("startMockFloorOne", () => closeLobbyPanelForGameplay());
    wrapGlobalFunction("handleServerFloorStart", () => closeLobbyPanelForGameplay());
    wrapGlobalFunction("startPvpArena", () => {
      multiplayer.arena = true;
      updateArenaBodyClass();
      closeLobbyPanelForGameplay();
    });

    bindStartButtonFallback("quickMatchBtn");
    bindStartButtonFallback("pvpArenaBtn", { arena: true });
    bindStartButtonFallback("localMultiTestBtn");
    bindStartButtonFallback("joinPartyBtn");
    setLobbyPanelOpenClean(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
