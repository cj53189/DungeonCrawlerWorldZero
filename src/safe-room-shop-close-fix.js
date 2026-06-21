// Hardens the Safe Room Shop close button on mobile/controller builds.
// The shop uses the old pet merchant panel, while mobile touch controls sit above gameplay.
// This patch makes the close button a capture-level control and hides touch controls while the shop is open.
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

      @media (hover: none) and (pointer: coarse), (max-width: 900px) {
        body.safeRoomShopOpen #closePetMerchantBtn,
        #petMerchantPanel.safeRoomShopPanel #closePetMerchantBtn {
          position: fixed !important;
          top: var(--dcw-safe-top, max(10px, env(safe-area-inset-top))) !important;
          right: var(--dcw-safe-right, max(10px, env(safe-area-inset-right))) !important;
        }
      }
    `;
    document.head.appendChild(style);
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
      if (!event.target?.closest?.("#closePetMerchantBtn")) return;
      closeSafeRoomShopPanel(event);
    };

    document.addEventListener("pointerdown", closeFromTarget, { capture: true, passive: false });
    document.addEventListener("touchstart", closeFromTarget, { capture: true, passive: false });
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
        return result;
      };
      openSafeRoomShopPanel.__safeRoomShopCloseFixWrapped = true;
      window.openSafeRoomShopPanel = openSafeRoomShopPanel;
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
    new MutationObserver(syncShopOpenClass).observe(panel, { attributes: true, attributeFilter: ["class", "style"] });
    syncShopOpenClass();
  }

  function install() {
    injectStyles();
    bindCloseButton();
    bindDocumentFallbacks();
    patchShopOpenCloseFunctions();
    watchPanel();
    syncShopOpenClass();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  const retry = setInterval(() => {
    install();
    if (document.getElementById("closePetMerchantBtn") && document.getElementById("petMerchantPanel")) clearInterval(retry);
  }, 200);
  setTimeout(() => clearInterval(retry), 5000);
})();
