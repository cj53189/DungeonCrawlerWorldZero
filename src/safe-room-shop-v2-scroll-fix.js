// Safe Room Shop V2 mobile scroll fix.
// The global touchmove guard in input.js prevents document scrolling unless a panel is whitelisted.
// V2 owns its own panel, so this file handles shop scrolling directly and prevents old touchstart
// shop actions from firing while the player is trying to drag-scroll.
(function installSafeRoomShopV2ScrollFix() {
  if (window.__dcwSafeRoomShopV2ScrollFixInstalled) return;
  window.__dcwSafeRoomShopV2ScrollFixInstalled = true;

  const PANEL_SELECTOR = "#safeRoomShopV2";
  const CONTENT_SELECTOR = "#safeRoomShopV2Content";
  const STYLE_ID = "safeRoomShopV2ScrollFixStyles";
  const TAP_MOVE_SLOP = 8;

  let drag = null;

  function panel() {
    return document.querySelector(PANEL_SELECTOR);
  }

  function content() {
    return document.querySelector(CONTENT_SELECTOR);
  }

  function isShopOpen() {
    return panel()?.classList.contains("open") === true;
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

  function patchPanelOpen() {
    const original = window.openSafeRoomShopPanelV2;
    if (typeof original !== "function" || original.__scrollFixWrapped) return;
    const wrapped = function openShopV2WithScrollFix(...args) {
      const result = original.apply(this, args);
      setTimeout(() => {
        const scroll = content();
        if (scroll) {
          scroll.style.overflowY = "auto";
          scroll.style.webkitOverflowScrolling = "touch";
          scroll.style.touchAction = "pan-y";
        }
      }, 0);
      return result;
    };
    wrapped.__scrollFixWrapped = true;
    window.openSafeRoomShopPanelV2 = wrapped;
  }

  function install() {
    injectStyles();
    bindManualScroll();
    patchPanelOpen();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  const retry = setInterval(install, 250);
  setTimeout(() => clearInterval(retry), 8000);
})();