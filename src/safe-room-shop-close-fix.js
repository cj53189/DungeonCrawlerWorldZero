// Hardens Safe Room Shop exit controls on mobile/controller builds.
// The top-right X can be unreliable on some mobile layouts, so this also adds
// a large Exit Shop button beside Sell All Junk at the bottom of the shop list.
(function installSafeRoomShopCloseFix() {
  if (window.__dcwSafeRoomShopCloseFixInstalled) return;
  window.__dcwSafeRoomShopCloseFixInstalled = true;

  const STYLE_ID = "safeRoomShopCloseFixStyles";

  function shopPanel() {
    return document.getElementById("petMerchantPanel");
  }

  function shopIsOpen(panel = shopPanel()) {
    if (!panel) return false;
    const style = window.getComputedStyle(panel);
    return panel.classList.contains("open") || style.display !== "none";
  }

  function syncShopOpenClass() {
    const panel = shopPanel();
    document.body.classList.toggle("safeRoomShopOpen", shopIsOpen(panel));
  }

  function closeSafeRoomShopPanel(event = null) {
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
    }

    const panel = shopPanel();
    if (!panel) return false;
    panel.style.display = "none";
    panel.classList.remove("open");
    document.body.classList.remove("safeRoomShopOpen");
    if (document.activeElement && panel.contains(document.activeElement)) document.activeElement.blur();
    if (typeof resetTransientInputState === "function") resetTransientInputState();
    if (typeof syncControllerWindowFocus === "function") setTimeout(syncControllerWindowFocus, 0);
    return true;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.safeRoomShopOpen #touchControls,
      body.safeRoomShopOpen .devControls,
      body.safeRoomShopOpen #testerDebugLine {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      body.safeRoomShopOpen #petMerchantPanel.safeRoomShopPanel,
      body.safeRoomShopOpen #petMerchantPanel.open {
        z-index: 340 !important;
        pointer-events: auto !important;
      }

      body.safeRoomShopOpen #closePetMerchantBtn,
      #petMerchantPanel.safeRoomShopPanel #closePetMerchantBtn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: var(--dcw-touch-preferred, 56px) !important;
        min-height: var(--dcw-touch-preferred, 56px) !important;
        z-index: 9999 !important;
        pointer-events: auto !important;
        touch-action: manipulation !important;
        cursor: pointer !important;
      }

      #petMerchantPanel.safeRoomShopPanel .shopExitButton,
      body.safeRoomShopOpen .shopExitButton {
        border: 1px solid rgba(124,247,255,0.48) !important;
        border-radius: 999px !important;
        background: linear-gradient(135deg, rgba(70,142,164,0.96), rgba(22,35,54,0.96)) !important;
        color: #effcff !important;
        font-weight: 900 !important;
        min-height: 48px !important;
        padding: 8px 12px !important;
        touch-action: manipulation !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }

      #petMerchantPanel.safeRoomShopPanel .shopFooterExit {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        margin-top: 8px;
      }

      @media (hover: none) and (pointer: coarse), (max-width: 900px) {
        body.safeRoomShopOpen #closePetMerchantBtn,
        #petMerchantPanel.safeRoomShopPanel #closePetMerchantBtn {
          position: fixed !important;
          top: var(--dcw-safe-top, max(10px, env(safe-area-inset-top))) !important;
          right: var(--dcw-safe-right, max(10px, env(safe-area-inset-right))) !important;
        }

        #petMerchantPanel.safeRoomShopPanel .shopSellSummary {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          align-items: stretch !important;
        }

        #petMerchantPanel.safeRoomShopPanel .shopSellSummary span {
          grid-column: 1 / -1;
        }

        #petMerchantPanel.safeRoomShopPanel .shopExitButton,
        #petMerchantPanel.safeRoomShopPanel .shopSellSummary button {
          min-height: 52px !important;
          width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureExitShopButton() {
    const panel = shopPanel();
    if (!panel || !shopIsOpen(panel)) return;
    const existing = panel.querySelector("button[data-shop-exit]");
    if (existing) return;

    const sellJunkButton = panel.querySelector("button[data-shop-sell-junk]");
    const exitButton = document.createElement("button");
    exitButton.type = "button";
    exitButton.className = "shopExitButton";
    exitButton.dataset.shopExit = "true";
    exitButton.textContent = "Exit Shop";

    if (sellJunkButton?.parentElement) {
      sellJunkButton.insertAdjacentElement("afterend", exitButton);
      return;
    }

    const options = document.getElementById("petMerchantOptions");
    if (!options) return;
    const footer = document.createElement("div");
    footer.className = "shopFooterExit";
    footer.appendChild(exitButton);
    options.appendChild(footer);
  }

  function bindCloseButton() {
    const button = document.getElementById("closePetMerchantBtn");
    if (!button || button.dataset.safeRoomShopCloseFixBound === "true") return;
    button.dataset.safeRoomShopCloseFixBound = "true";

    const fire = event => closeSafeRoomShopPanel(event);
    button.addEventListener("pointerdown", fire, { capture: true, passive: false });
    button.addEventListener("touchstart", fire, { capture: true, passive: false });
    button.addEventListener("mousedown", fire, { capture: true, passive: false });
    button.addEventListener("click", fire, { capture: true });
  }

  function bindDocumentFallbacks() {
    if (document.body.dataset.safeRoomShopCloseFixDocumentBound === "true") return;
    document.body.dataset.safeRoomShopCloseFixDocumentBound = "true";

    const closeFromTarget = event => {
      if (!event.target?.closest?.("#closePetMerchantBtn, button[data-shop-exit]")) return;
      closeSafeRoomShopPanel(event);
    };

    document.addEventListener("pointerdown", closeFromTarget, { capture: true, passive: false });
    document.addEventListener("touchstart", closeFromTarget, { capture: true, passive: false });
    document.addEventListener("mousedown", closeFromTarget, { capture: true, passive: false });
    document.addEventListener("click", closeFromTarget, { capture: true });

    document.addEventListener("keydown", event => {
      if (!shopIsOpen()) return;
      const key = event.key?.toLowerCase?.();
      if (key === "escape" || key === "backspace") closeSafeRoomShopPanel(event);
    }, true);
  }

  function patchShopOpenCloseFunctions() {
    if (typeof openSafeRoomShopPanel === "function" && !openSafeRoomShopPanel.__safeRoomShopCloseFixWrapped) {
      const originalOpen = openSafeRoomShopPanel;
      openSafeRoomShopPanel = function openShopWithCloseFix(...args) {
        const result = originalOpen.apply(this, args);
        setTimeout(syncShopOpenClass, 0);
        setTimeout(bindCloseButton, 0);
        setTimeout(ensureExitShopButton, 0);
        return result;
      };
      openSafeRoomShopPanel.__safeRoomShopCloseFixWrapped = true;
      window.openSafeRoomShopPanel = openSafeRoomShopPanel;
    }

    if (typeof renderSafeRoomShopPanel === "function" && !renderSafeRoomShopPanel.__safeRoomShopExitWrapped) {
      const originalRender = renderSafeRoomShopPanel;
      renderSafeRoomShopPanel = function renderShopWithExitButton(...args) {
        const result = originalRender.apply(this, args);
        setTimeout(ensureExitShopButton, 0);
        return result;
      };
      renderSafeRoomShopPanel.__safeRoomShopExitWrapped = true;
      window.renderSafeRoomShopPanel = renderSafeRoomShopPanel;
    }

    if (typeof hidePetMerchantPanel === "function" && !hidePetMerchantPanel.__safeRoomShopCloseFixWrapped) {
      const originalHide = hidePetMerchantPanel;
      hidePetMerchantPanel = function hideShopWithCloseFix(...args) {
        const result = originalHide.apply(this, args);
        closeSafeRoomShopPanel();
        return result;
      };
      hidePetMerchantPanel.__safeRoomShopCloseFixWrapped = true;
      window.hidePetMerchantPanel = hidePetMerchantPanel;
    } else {
      window.hidePetMerchantPanel = closeSafeRoomShopPanel;
      try { hidePetMerchantPanel = closeSafeRoomShopPanel; } catch {}
    }
  }

  function watchPanel() {
    const panel = shopPanel();
    if (!panel || panel.dataset.safeRoomShopCloseFixObserved === "true") return;
    panel.dataset.safeRoomShopCloseFixObserved = "true";
    new MutationObserver(() => {
      syncShopOpenClass();
      ensureExitShopButton();
    }).observe(panel, { attributes: true, childList: true, subtree: true, attributeFilter: ["class", "style"] });
    syncShopOpenClass();
  }

  function install() {
    injectStyles();
    bindCloseButton();
    bindDocumentFallbacks();
    patchShopOpenCloseFunctions();
    watchPanel();
    syncShopOpenClass();
    ensureExitShopButton();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  const retry = setInterval(() => {
    install();
    if (document.getElementById("closePetMerchantBtn") && document.getElementById("petMerchantPanel")) clearInterval(retry);
  }, 200);
  setTimeout(() => clearInterval(retry), 5000);
})();
