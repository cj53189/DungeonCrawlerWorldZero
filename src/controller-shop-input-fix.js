// Controller-safe shop interaction guard.
// Fixes Backbone/iOS controller crashes caused by X/Square falling through to gameplay
// while the safe-room shop is open or while the crawler is standing at the shop.
(function installControllerShopInputFix() {
  if (window.__dcwControllerShopInputFixInstalled) return;
  window.__dcwControllerShopInputFixInstalled = true;

  const RETRY_MS = 250;
  const RETRY_TIMEOUT_MS = 8000;
  let previousButtons = [];

  function nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function isSuppressed() {
    return nowMs() < Math.max(
      Number(window.__dcwSuppressShopOpenUntil) || 0,
      Number(window.__dcwShopV2SuppressUntil) || 0
    );
  }

  function panelIsOpen(panel) {
    if (!panel || !panel.isConnected) return false;
    const style = window.getComputedStyle(panel);
    return panel.classList.contains("open") && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function safeRoomShopV2Panel() {
    return document.getElementById("safeRoomShopV2");
  }

  function legacyShopPanel() {
    return document.getElementById("petMerchantPanel");
  }

  function getOpenShopPanel() {
    const v2 = safeRoomShopV2Panel();
    if (panelIsOpen(v2)) return v2;
    const legacy = legacyShopPanel();
    if (panelIsOpen(legacy)) return legacy;
    return null;
  }

  function isShopOpen() {
    return !!getOpenShopPanel();
  }

  function isShopReachable() {
    try { if (typeof petMerchantInReach === "function" && petMerchantInReach()) return true; } catch {}
    try { if (typeof player !== "undefined" && player?.safe) return true; } catch {}
    try {
      if (typeof petMerchant !== "undefined" && petMerchant && typeof player !== "undefined" && player) {
        return Math.hypot(player.x - petMerchant.x, player.y - petMerchant.y) < player.r + petMerchant.r + 44;
      }
    } catch {}
    return false;
  }

  function focusShopControllerButton() {
    const panel = getOpenShopPanel();
    if (!panel || typeof syncControllerWindowFocus !== "function") return false;
    setTimeout(syncControllerWindowFocus, 0);
    return true;
  }

  function openShopFromController() {
    if (isSuppressed()) return false;
    if (isShopOpen()) return focusShopControllerButton();
    if (!isShopReachable()) return false;

    try {
      if (typeof openSafeRoomShopPanelV2 === "function" && openSafeRoomShopPanelV2()) return true;
    } catch (error) {
      console.warn("Safe-room shop V2 controller open failed", error);
    }

    try {
      if (typeof openSafeRoomShopPanel === "function" && openSafeRoomShopPanel()) return true;
    } catch (error) {
      console.warn("Safe-room shop controller open failed", error);
    }

    // Final fallback: let the normal interact wrapper try. This keeps touch/keyboard paths untouched.
    try {
      if (typeof interact === "function") return !!interact();
    } catch (error) {
      console.warn("Safe-room shop interact fallback failed", error);
    }

    return false;
  }

  function closeShopFromController(event = null) {
    if (!isShopOpen()) return false;
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
    }

    try {
      if (panelIsOpen(safeRoomShopV2Panel()) && typeof closeSafeRoomShopPanelV2 === "function") return closeSafeRoomShopPanelV2(event) !== false;
    } catch (error) {
      console.warn("Safe-room shop V2 controller close failed", error);
    }

    try {
      if (typeof closeSafeRoomShopPanel === "function") return closeSafeRoomShopPanel(event) !== false;
    } catch (error) {
      console.warn("Safe-room shop controller close failed", error);
    }

    try {
      if (typeof hidePetMerchantPanel === "function") {
        hidePetMerchantPanel(event);
        return true;
      }
    } catch (error) {
      console.warn("Safe-room shop hide fallback failed", error);
    }

    const panel = getOpenShopPanel();
    if (panel) {
      panel.classList.remove("open");
      panel.style.display = "none";
      panel.setAttribute("aria-hidden", "true");
      document.body.classList.remove("safeRoomShopOpen", "safeRoomShopV2Open");
      return true;
    }

    return false;
  }

  function getPreferredShopButton(panel) {
    if (!panel) return null;
    const buttons = typeof getControllerWindowButtons === "function"
      ? getControllerWindowButtons(panel)
      : Array.from(panel.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit'], [tabindex]"));

    return buttons.find(button => button.matches?.("[data-shop-v2-buy], [data-shop-v2-pet], [data-shop-v2-sell], [data-shop-v2-junk], [data-shop-v2-sell-junk], [data-shop-buy], [data-shop-pet], [data-shop-sell], [data-shop-junk], [data-shop-sell-junk]"))
      || buttons.find(button => !button.matches?.("#safeRoomShopV2Close, [data-shop-v2-close], #closePetMerchantBtn, .panelClose, .shopV2Close, .shopV2Leave, [data-shop-exit]"))
      || buttons[0]
      || null;
  }

  function safelyClickShopButton(button) {
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return false;
    try {
      button.focus({ preventScroll: true });
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
      button.click();
      return true;
    } catch (error) {
      console.warn("Safe-room shop controller selection failed", error);
      if (typeof announcer === "function") announcer("Shop input hiccup blocked. Try again, crawler.");
      return false;
    }
  }

  function assignGlobalFunction(name, fn) {
    window[name] = fn;
    try { self[name] = fn; } catch {}
    try { eval(`${name} = window.${name}`); } catch {}
  }

  function patchControllerWindowDiscovery() {
    if (typeof getActiveControllerWindow === "function" && !getActiveControllerWindow.__controllerShopInputFixWrapped) {
      const originalGetActiveControllerWindow = getActiveControllerWindow;
      const wrappedGetActiveControllerWindow = function getActiveControllerWindowWithShop(...args) {
        return getOpenShopPanel() || originalGetActiveControllerWindow.apply(this, args);
      };
      wrappedGetActiveControllerWindow.__controllerShopInputFixWrapped = true;
      assignGlobalFunction("getActiveControllerWindow", wrappedGetActiveControllerWindow);
    }

    if (typeof hasControllerWindowOpen === "function" && !hasControllerWindowOpen.__controllerShopInputFixWrapped) {
      const originalHasControllerWindowOpen = hasControllerWindowOpen;
      const wrappedHasControllerWindowOpen = function hasControllerWindowOpenWithShop(...args) {
        return isShopOpen() || originalHasControllerWindowOpen.apply(this, args);
      };
      wrappedHasControllerWindowOpen.__controllerShopInputFixWrapped = true;
      assignGlobalFunction("hasControllerWindowOpen", wrappedHasControllerWindowOpen);
    }

    if (typeof getPreferredControllerButton === "function" && !getPreferredControllerButton.__controllerShopInputFixWrapped) {
      const originalGetPreferredControllerButton = getPreferredControllerButton;
      const wrappedGetPreferredControllerButton = function getPreferredControllerButtonWithShop(buttons, ...args) {
        const panel = getOpenShopPanel();
        if (panel) return getPreferredShopButton(panel) || originalGetPreferredControllerButton.call(this, buttons, ...args);
        return originalGetPreferredControllerButton.call(this, buttons, ...args);
      };
      wrappedGetPreferredControllerButton.__controllerShopInputFixWrapped = true;
      assignGlobalFunction("getPreferredControllerButton", wrappedGetPreferredControllerButton);
    }

    if (typeof activateControllerWindowSelection === "function" && !activateControllerWindowSelection.__controllerShopInputFixWrapped) {
      const originalActivateControllerWindowSelection = activateControllerWindowSelection;
      const wrappedActivateControllerWindowSelection = function activateControllerWindowSelectionWithShop(...args) {
        const panel = getOpenShopPanel();
        if (!panel) return originalActivateControllerWindowSelection.apply(this, args);
        const buttons = typeof getControllerWindowButtons === "function" ? getControllerWindowButtons(panel) : [];
        const current = panel.contains(document.activeElement) && buttons.includes(document.activeElement)
          ? document.activeElement
          : getPreferredShopButton(panel);
        return safelyClickShopButton(current);
      };
      wrappedActivateControllerWindowSelection.__controllerShopInputFixWrapped = true;
      assignGlobalFunction("activateControllerWindowSelection", wrappedActivateControllerWindowSelection);
    }
  }

  function patchGameplayActions() {
    if (typeof attack === "function" && !attack.__controllerShopInputFixWrapped) {
      const originalAttack = attack;
      const wrappedAttack = function attackWithControllerShopGuard(...args) {
        if (isShopOpen()) return false;
        if (inputState?.lastActiveInputMethod === "gamepad" && isShopReachable() && openShopFromController()) return true;
        return originalAttack.apply(this, args);
      };
      wrappedAttack.__controllerShopInputFixWrapped = true;
      assignGlobalFunction("attack", wrappedAttack);
    }

    if (typeof triggerDodge === "function" && !triggerDodge.__controllerShopInputFixWrapped) {
      const originalTriggerDodge = triggerDodge;
      const wrappedTriggerDodge = function dodgeWithShopGuard(...args) {
        if (isShopOpen()) return closeShopFromController();
        return originalTriggerDodge.apply(this, args);
      };
      wrappedTriggerDodge.__controllerShopInputFixWrapped = true;
      assignGlobalFunction("triggerDodge", wrappedTriggerDodge);
    }
  }

  function patchShopPanelClasses() {
    const panel = getOpenShopPanel();
    document.body.classList.toggle("safeRoomShopControllerOpen", !!panel);
    if (panel && typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
  }

  function pollControllerShopButtons() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads).find(pad => pad && pad.connected !== false);
    if (!gp) {
      previousButtons = [];
      requestAnimationFrame(pollControllerShopButtons);
      return;
    }

    const justPressed = index => {
      const pressed = !!gp.buttons[index]?.pressed;
      const wasPressed = !!previousButtons[index];
      return pressed && !wasPressed;
    };

    if (isShopOpen()) {
      // B/Circle backs out of the shop. Menu/Start is also accepted because some mobile
      // controller overlays map the right-side system button as the practical cancel button.
      if (justPressed(1) || justPressed(9)) closeShopFromController();
    } else if (isShopReachable() && (justPressed(0) || justPressed(2))) {
      // A/Cross and X/Square both open the safe-room shop when standing at it.
      // X is normally attack, so attack() is also guarded above in case poll order wins.
      openShopFromController();
    }

    previousButtons = gp.buttons.map(button => !!button.pressed);
    requestAnimationFrame(pollControllerShopButtons);
  }

  function install() {
    patchControllerWindowDiscovery();
    patchGameplayActions();
    patchShopPanelClasses();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  const retry = setInterval(install, RETRY_MS);
  setTimeout(() => clearInterval(retry), RETRY_TIMEOUT_MS);
  requestAnimationFrame(pollControllerShopButtons);

  window.isSafeRoomShopControllerOpen = isShopOpen;
  window.openSafeRoomShopFromController = openShopFromController;
  window.closeSafeRoomShopFromController = closeShopFromController;
})();
