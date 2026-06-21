// Safe Room Shop V2 mobile scroll/input fix.
// The global touchmove guard in input.js prevents document scrolling unless a panel is whitelisted.
// V2 owns its own panel, so this file handles shop scrolling directly, prevents old touchstart
// shop actions from firing while the player is trying to drag-scroll, and makes the shop count
// as a real modal so gameplay input cannot keep firing behind it.
(function installSafeRoomShopV2ScrollFix() {
  if (window.__dcwSafeRoomShopV2ScrollFixInstalled) return;
  window.__dcwSafeRoomShopV2ScrollFixInstalled = true;

  const PANEL_SELECTOR = "#safeRoomShopV2";
  const CONTENT_SELECTOR = "#safeRoomShopV2Content";
  const STYLE_ID = "safeRoomShopV2ScrollFixStyles";
  const TAP_MOVE_SLOP = 8;

  let drag = null;
  let originalGetActiveControllerWindow = null;
  let originalGetOpenScrollablePanel = null;
  let originalHasControllerWindowOpen = null;
  let originalOpenShopV2 = null;
  let originalCloseShopV2 = null;

  function panel() {
    return document.querySelector(PANEL_SELECTOR);
  }

  function content() {
    return document.querySelector(CONTENT_SELECTOR);
  }

  function isShopOpen() {
    return panel()?.classList.contains("open") === true;
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && el.getClientRects().length > 0;
  }

  function closestShopTarget(event) {
    return event.target?.closest?.(PANEL_SELECTOR) || null;
  }

  function shouldLetCloseHandle(event) {
    return !!event.target?.closest?.("[data-shop-v2-close], #safeRoomShopV2Close");
  }

  function shouldBlockEarlyShopAction(event) {
    if (!isShopOpen() || !closestShopTarget(event)) return false;
    if (shouldLetCloseHandle(event)) return false;
    return !!event.target?.closest?.("button, .shopV2Card, .shopV2SellRow");
  }

  function syncShopModalState() {
    const shop = panel();
    const open = isShopOpen() && isVisible(shop);
    document.body.classList.toggle("safeRoomShopV2Open", open);
    if (!open) {
      document.body.classList.remove("safeRoomShopV2Open");
      if (shop) shop.setAttribute("aria-hidden", "true");
    } else if (shop) {
      shop.setAttribute("aria-hidden", "false");
    }
  }

  function closeShopFromFix(event = null) {
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
    }

    if (typeof originalCloseShopV2 === "function") originalCloseShopV2(event);
    else if (typeof window.closeSafeRoomShopPanelV2 === "function" && window.closeSafeRoomShopPanelV2 !== closeShopFromFix) window.closeSafeRoomShopPanelV2(event);
    else {
      const shop = panel();
      if (shop) {
        shop.classList.remove("open");
        shop.setAttribute("aria-hidden", "true");
      }
      document.body.classList.remove("safeRoomShopV2Open");
      if (typeof resetTransientInputState === "function") resetTransientInputState();
    }

    drag = null;
    syncShopModalState();
    setTimeout(syncShopModalState, 0);
    setTimeout(syncShopModalState, 80);
    return false;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #safeRoomShopV2.open {
        touch-action: pan-y !important;
      }

      #safeRoomShopV2.open #safeRoomShopV2Content,
      #safeRoomShopV2.open .shopV2Content,
      #safeRoomShopV2.open .shopV2Content * {
        touch-action: pan-y !important;
      }

      #safeRoomShopV2.open .shopV2Close,
      #safeRoomShopV2.open .shopV2Leave,
      #safeRoomShopV2.open button[data-shop-v2-close] {
        touch-action: manipulation !important;
      }
    `;
    document.head.appendChild(style);
  }

  function bindManualScroll() {
    if (document.body.dataset.safeRoomShopV2ScrollBound === "true") return;
    document.body.dataset.safeRoomShopV2ScrollBound = "true";

    document.addEventListener("touchstart", event => {
      const shop = closestShopTarget(event);
      const scroll = content();
      const touch = event.touches?.[0];
      if (!shop || !scroll || !touch || !isShopOpen()) {
        drag = null;
        return;
      }

      drag = {
        scroll,
        startY: touch.clientY,
        lastY: touch.clientY,
        startScrollTop: scroll.scrollTop,
        moved: false,
        allowClick: shouldLetCloseHandle(event)
      };

      // Stop the older V2 capture handler from treating touchstart on a shop card
      // as an immediate buy/sell. Click still handles intentional taps.
      if (shouldBlockEarlyShopAction(event)) {
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
    }, { capture: true, passive: false });

    document.addEventListener("pointerdown", event => {
      if (event.pointerType !== "touch") return;
      if (!shouldBlockEarlyShopAction(event)) return;
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }, { capture: true, passive: false });

    document.addEventListener("touchmove", event => {
      const shop = closestShopTarget(event);
      const touch = event.touches?.[0];
      if (!shop || !drag || !touch || !isShopOpen()) return;

      const deltaY = drag.lastY - touch.clientY;
      const totalMove = Math.abs(touch.clientY - drag.startY);
      drag.lastY = touch.clientY;

      if (totalMove > TAP_MOVE_SLOP) drag.moved = true;
      if (Math.abs(deltaY) >= 0.5) drag.scroll.scrollTop += deltaY;

      // We are doing the scroll ourselves so the global touchmove guard cannot cancel it.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }, { capture: true, passive: false });

    const endDrag = event => {
      if (!drag) return;
      if (drag.moved && closestShopTarget(event)) {
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
      }
      drag = null;
    };

    document.addEventListener("touchend", endDrag, { capture: true, passive: false });
    document.addEventListener("touchcancel", endDrag, { capture: true, passive: false });
  }

  function patchPanelOpenClose() {
    const open = window.openSafeRoomShopPanelV2;
    if (typeof open === "function" && open !== originalOpenShopV2 && !open.__scrollFixWrapped) {
      originalOpenShopV2 = open;
      const wrappedOpen = function openShopV2WithScrollFix(...args) {
        if (typeof resetTransientInputState === "function") resetTransientInputState();
        const result = originalOpenShopV2.apply(this, args);
        setTimeout(() => {
          const scroll = content();
          if (scroll) {
            scroll.style.overflowY = "auto";
            scroll.style.webkitOverflowScrolling = "touch";
            scroll.style.touchAction = "pan-y";
          }
          syncShopModalState();
        }, 0);
        return result;
      };
      wrappedOpen.__scrollFixWrapped = true;
      window.openSafeRoomShopPanelV2 = wrappedOpen;
    }

    const close = window.closeSafeRoomShopPanelV2;
    if (typeof close === "function" && close !== closeShopFromFix && close !== originalCloseShopV2) {
      originalCloseShopV2 = close;
      closeShopFromFix.__scrollFixWrapped = true;
      window.closeSafeRoomShopPanelV2 = closeShopFromFix;
    }
  }

  function patchControllerModalHooks() {
    if (!originalGetActiveControllerWindow && typeof window.getActiveControllerWindow === "function") originalGetActiveControllerWindow = window.getActiveControllerWindow;
    if (!originalGetOpenScrollablePanel && typeof window.getOpenScrollablePanel === "function") originalGetOpenScrollablePanel = window.getOpenScrollablePanel;
    if (!originalHasControllerWindowOpen && typeof window.hasControllerWindowOpen === "function") originalHasControllerWindowOpen = window.hasControllerWindowOpen;

    if (originalGetActiveControllerWindow && !window.getActiveControllerWindow.__safeRoomShopV2Wrapped) {
      const wrappedGetActive = function getActiveControllerWindowWithShopV2() {
        const shop = panel();
        if (isShopOpen() && isVisible(shop)) return shop;
        return originalGetActiveControllerWindow.apply(this, arguments);
      };
      wrappedGetActive.__safeRoomShopV2Wrapped = true;
      window.getActiveControllerWindow = wrappedGetActive;
      try { getActiveControllerWindow = wrappedGetActive; } catch {}
    }

    if (originalGetOpenScrollablePanel && !window.getOpenScrollablePanel.__safeRoomShopV2Wrapped) {
      const wrappedGetScrollable = function getOpenScrollablePanelWithShopV2() {
        if (isShopOpen()) return content() || panel();
        return originalGetOpenScrollablePanel.apply(this, arguments);
      };
      wrappedGetScrollable.__safeRoomShopV2Wrapped = true;
      window.getOpenScrollablePanel = wrappedGetScrollable;
      try { getOpenScrollablePanel = wrappedGetScrollable; } catch {}
    }

    if (originalHasControllerWindowOpen && !window.hasControllerWindowOpen.__safeRoomShopV2Wrapped) {
      const wrappedHasWindow = function hasControllerWindowOpenWithShopV2() {
        return isShopOpen() || originalHasControllerWindowOpen.apply(this, arguments);
      };
      wrappedHasWindow.__safeRoomShopV2Wrapped = true;
      window.hasControllerWindowOpen = wrappedHasWindow;
      try { hasControllerWindowOpen = wrappedHasWindow; } catch {}
    }
  }

  function bindKeyboardModalGuard() {
    if (document.body.dataset.safeRoomShopV2KeyboardGuardBound === "true") return;
    document.body.dataset.safeRoomShopV2KeyboardGuardBound = "true";

    document.addEventListener("keydown", event => {
      if (!isShopOpen()) return;
      const key = event.key?.toLowerCase?.();
      if (key === "escape" || key === "backspace") {
        closeShopFromFix(event);
        return;
      }
      if (key === "enter" && document.activeElement?.click && panel()?.contains(document.activeElement)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        document.activeElement.click();
        return;
      }
      // Most keys should not leak to gameplay while the shop modal is open.
      if (!["tab"].includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
    }, true);
  }

  function watchPanelOpenState() {
    const shop = panel();
    if (!shop || shop.dataset.safeRoomShopV2ModalObserved === "true") return;
    shop.dataset.safeRoomShopV2ModalObserved = "true";
    new MutationObserver(syncShopModalState).observe(shop, { attributes: true, attributeFilter: ["class", "style", "aria-hidden"] });
    syncShopModalState();
  }

  function install() {
    injectStyles();
    bindManualScroll();
    patchPanelOpenClose();
    patchControllerModalHooks();
    bindKeyboardModalGuard();
    watchPanelOpenState();
    syncShopModalState();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  const retry = setInterval(install, 250);
  setTimeout(() => clearInterval(retry), 8000);
})();