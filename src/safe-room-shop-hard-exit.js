// Emergency-grade shop exit controls.
// This adds a persistent bottom Leave Shop button outside the scroll content and
// closes the panel on touchend/pointerup as well as click. It is intentionally
// independent from the older pet merchant close path.
(function installSafeRoomShopHardExit() {
  if (window.__dcwSafeRoomShopHardExitInstalled) return;
  window.__dcwSafeRoomShopHardExitInstalled = true;

  const STYLE_ID = "safeRoomShopHardExitStyles";
  const EXIT_ID = "safeRoomShopHardExitBtn";
  const LOCK_MS = 1200;

  function nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function suppressReopen() {
    window.__dcwSuppressShopOpenUntil = Math.max(Number(window.__dcwSuppressShopOpenUntil) || 0, nowMs() + LOCK_MS);
  }

  function panel() {
    return document.getElementById("petMerchantPanel");
  }

  function isOpen(el = panel()) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return el.classList.contains("open") || style.display !== "none";
  }

  function hardHidePanel(el = panel()) {
    if (!el) return false;
    el.style.display = "none";
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
    document.body.classList.remove("safeRoomShopOpen");
    if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
    return true;
  }

  function hardCloseShop(event = null) {
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
    }
    suppressReopen();
    hardHidePanel();
    if (typeof resetTransientInputState === "function") resetTransientInputState();
    if (typeof syncControllerWindowFocus === "function") setTimeout(syncControllerWindowFocus, 0);

    // Some mobile tap sequences fire a delayed click/interact after touchend.
    // Re-apply the hide over the next few frames so the shop cannot bounce back.
    requestAnimationFrame(() => hardHidePanel());
    setTimeout(() => hardHidePanel(), 50);
    setTimeout(() => hardHidePanel(), 180);
    setTimeout(() => hardHidePanel(), 360);
    return false;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #petMerchantPanel.open,
      #petMerchantPanel.safeRoomShopPanel {
        padding-bottom: max(86px, calc(env(safe-area-inset-bottom) + 74px)) !important;
      }

      #${EXIT_ID} {
        display: none;
        position: fixed;
        left: var(--dcw-safe-left, max(12px, env(safe-area-inset-left)));
        right: var(--dcw-safe-right, max(12px, env(safe-area-inset-right)));
        bottom: var(--dcw-safe-bottom, max(12px, env(safe-area-inset-bottom)));
        z-index: 10050;
        min-height: 58px;
        border: 2px solid rgba(124,247,255,0.72);
        border-radius: 18px;
        background: linear-gradient(135deg, rgba(44,132,160,0.98), rgba(20,28,46,0.98));
        color: #f3feff;
        font-weight: 1000;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        box-shadow: 0 12px 30px rgba(0,0,0,0.48);
        touch-action: manipulation;
        pointer-events: auto;
      }

      body.safeRoomShopOpen #${EXIT_ID},
      #petMerchantPanel.open #${EXIT_ID},
      #petMerchantPanel.safeRoomShopPanel.open #${EXIT_ID} {
        display: block !important;
      }

      body.safeRoomShopOpen #closePetMerchantBtn,
      #petMerchantPanel.open #closePetMerchantBtn {
        pointer-events: auto !important;
        touch-action: manipulation !important;
        z-index: 10060 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function bindExitControl(btn) {
    if (!btn || btn.dataset.hardExitBound === "true") return;
    btn.dataset.hardExitBound = "true";
    btn.onclick = hardCloseShop;
    btn.ontouchstart = hardCloseShop;
    btn.ontouchend = hardCloseShop;
    btn.onpointerdown = hardCloseShop;
    btn.onpointerup = hardCloseShop;
    for (const type of ["pointerdown", "pointerup", "touchstart", "touchend", "mousedown", "mouseup", "click"]) {
      btn.addEventListener(type, hardCloseShop, { capture: true, passive: false });
      btn.addEventListener(type, hardCloseShop, { capture: false, passive: false });
    }
  }

  function ensureHardExitButton() {
    const el = panel();
    if (!el) return;
    let btn = document.getElementById(EXIT_ID);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = EXIT_ID;
      btn.type = "button";
      btn.textContent = "Leave Shop";
      btn.setAttribute("aria-label", "Leave shop");
      el.appendChild(btn);
    } else if (btn.parentElement !== el) {
      el.appendChild(btn);
    }
    bindExitControl(btn);

    const closeBtn = document.getElementById("closePetMerchantBtn");
    bindExitControl(closeBtn);
  }

  function bindDocumentFallback() {
    if (document.body.dataset.safeRoomShopHardExitDocumentBound === "true") return;
    document.body.dataset.safeRoomShopHardExitDocumentBound = "true";
    const handler = event => {
      if (!event.target?.closest?.(`#${EXIT_ID}, #closePetMerchantBtn, button[data-shop-exit]`)) return;
      hardCloseShop(event);
    };
    for (const type of ["pointerdown", "pointerup", "touchstart", "touchend", "mousedown", "mouseup", "click"]) {
      document.addEventListener(type, handler, { capture: true, passive: false });
    }
    document.addEventListener("keydown", event => {
      if (!isOpen()) return;
      const key = event.key?.toLowerCase?.();
      if (key === "escape" || key === "backspace") hardCloseShop(event);
    }, true);
  }

  function patchCloseGlobals() {
    window.closeSafeRoomShopPanel = hardCloseShop;
    window.hidePetMerchantPanel = hardCloseShop;
    try { closeSafeRoomShopPanel = hardCloseShop; } catch {}
    try { hidePetMerchantPanel = hardCloseShop; } catch {}
  }

  function watchPanel() {
    const el = panel();
    if (!el || el.dataset.hardExitObserved === "true") return;
    el.dataset.hardExitObserved = "true";
    new MutationObserver(() => {
      ensureHardExitButton();
      if (!isOpen(el)) document.body.classList.remove("safeRoomShopOpen");
    }).observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
  }

  function install() {
    injectStyles();
    ensureHardExitButton();
    bindDocumentFallback();
    patchCloseGlobals();
    watchPanel();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  const retry = setInterval(install, 200);
  setTimeout(() => clearInterval(retry), 8000);
})();
