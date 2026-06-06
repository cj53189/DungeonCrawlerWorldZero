
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; if (typeof updateInputVisibility === 'function') updateInputVisibility(); }
window.addEventListener("resize", resize);
resize();


function isMobileLike() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches || window.innerWidth <= 900;
}

function setupTouchControls() {
  const base = document.getElementById("stickBase");
  const knob = document.getElementById("stickKnob");
  const btnAttack = document.getElementById("btnAttack");
  const btnInteract = document.getElementById("btnInteract");
  const btnLog = document.getElementById("btnLog");
  const btnRecap = document.getElementById("btnRecap");
  const btnNew = document.getElementById("btnNew");
  const btnInv = document.getElementById("btnInv");

  const prevent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  function resetStick() {
    touchState.moveX = 0;
    touchState.moveY = 0;
    touchState.activeTouchId = null;
    knob.style.left = "39px";
    knob.style.top = "39px";
  }

  function updateStick(clientX, clientY) {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const max = rect.width / 2 - 25;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(max, dist);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clamped;
    const knobY = Math.sin(angle) * clamped;

    knob.style.left = `${39 + knobX}px`;
    knob.style.top = `${39 + knobY}px`;

    touchState.moveX = Math.abs(dx / max) > 0.12 ? Math.max(-1, Math.min(1, dx / max)) : 0;
    touchState.moveY = Math.abs(dy / max) > 0.12 ? Math.max(-1, Math.min(1, dy / max)) : 0;
  }

  base.addEventListener("touchstart", e => {
    prevent(e);
    const t = e.changedTouches[0];
    touchState.activeTouchId = t.identifier;
    updateStick(t.clientX, t.clientY);
  }, { passive: false });

  base.addEventListener("touchmove", e => {
    prevent(e);
    for (const t of e.changedTouches) {
      if (t.identifier === touchState.activeTouchId) {
        updateStick(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  base.addEventListener("touchend", e => {
    prevent(e);
    for (const t of e.changedTouches) {
      if (t.identifier === touchState.activeTouchId) {
        resetStick();
        break;
      }
    }
  }, { passive: false });

  base.addEventListener("touchcancel", e => {
    prevent(e);
    resetStick();
  }, { passive: false });

  btnAttack.addEventListener("touchstart", e => { prevent(e); attack(); }, { passive: false });
  btnInteract.addEventListener("touchstart", e => { prevent(e); interact(); }, { passive: false });
  btnLog.addEventListener("touchstart", e => { prevent(e); toggleLog(); }, { passive: false });
  btnRecap.addEventListener("touchstart", e => { prevent(e); toggleSafeRoomRecap(); }, { passive: false });
  btnNew.addEventListener("touchstart", e => { prevent(e); restartGame(); }, { passive: false });

  btnAttack.addEventListener("click", e => { prevent(e); attack(); });
  btnInteract.addEventListener("click", e => { prevent(e); interact(); });
  btnLog.addEventListener("click", e => { prevent(e); toggleLog(); });
  btnRecap.addEventListener("click", e => { prevent(e); toggleSafeRoomRecap(); });
  btnNew.addEventListener("click", e => { prevent(e); restartGame(); });

  document.addEventListener("gesturestart", e => e.preventDefault());
  document.addEventListener("touchmove", e => {
    const allowPanelScroll = e.target.closest && e.target.closest("#logPanel, #safeRoomRecap, #inventoryPanel, #inventoryPanel");
    if (isMobileLike() && !allowPanelScroll) e.preventDefault();
  }, { passive: false });
}


function setupDirectPanelButtonFallbacks() {
  const logBtn = document.getElementById("btnLog");
  const recapBtn = document.getElementById("btnRecap");

  const bindDirect = (el, fn) => {
    if (!el) return;

    let last = 0;
    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const now = performance.now();
      if (now - last < 180) return;
      last = now;
      fn();
    };

    el.addEventListener("pointerdown", fire, { passive: false, capture: true });
    el.addEventListener("touchstart", fire, { passive: false, capture: true });
    el.addEventListener("click", fire, { capture: true });
  };

  bindDirect(logBtn, toggleLogPanelMobile);
  bindDirect(recapBtn, toggleRecapPanelMobile);
}



function setupInventoryButtonFallback() {
  const invBtn = document.getElementById("btnInv");
  if (!invBtn || invBtn.dataset.invFallbackBound === "true") return;
  invBtn.dataset.invFallbackBound = "true";

  let last = 0;
  const fire = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    const now = performance.now();
    if (now - last < 180) return;
    last = now;

    toggleInventoryPanel();
  };

  invBtn.addEventListener("pointerdown", fire, { passive: false, capture: true });
  invBtn.addEventListener("touchstart", fire, { passive: false, capture: true });
  invBtn.addEventListener("click", fire, { capture: true });
}


setupTouchControls();
setupInventoryButtonFallback();


function isMobileLike() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches || window.innerWidth <= 900;
}

function updateInputVisibility() {
  const shouldShowTouch = isMobileLike() && !gamepadState.connected;
  document.body.classList.toggle("showTouchControls", shouldShowTouch);
}

function setupTouchControls() {
  const base = document.getElementById("stickBase");
  const knob = document.getElementById("stickKnob");
  const btnAttack = document.getElementById("btnAttack");
  const btnInteract = document.getElementById("btnInteract");
  const btnLog = document.getElementById("btnLog");
  const btnRecap = document.getElementById("btnRecap");
  const btnNew = document.getElementById("btnNew");
  const btnInv = document.getElementById("btnInv");

  if (!base || !knob) return;

  const prevent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  function resetStick() {
    touchState.moveX = 0;
    touchState.moveY = 0;
    touchState.activeTouchId = null;
    knob.style.left = "36px";
    knob.style.top = "36px";
  }

  function updateStick(clientX, clientY) {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const max = rect.width / 2 - 23;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(max, dist);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clamped;
    const knobY = Math.sin(angle) * clamped;

    knob.style.left = `${36 + knobX}px`;
    knob.style.top = `${36 + knobY}px`;

    touchState.moveX = Math.abs(dx / max) > 0.12 ? Math.max(-1, Math.min(1, dx / max)) : 0;
    touchState.moveY = Math.abs(dy / max) > 0.12 ? Math.max(-1, Math.min(1, dy / max)) : 0;
  }

  base.addEventListener("touchstart", e => {
    prevent(e);
    const t = e.changedTouches[0];
    touchState.activeTouchId = t.identifier;
    updateStick(t.clientX, t.clientY);
  }, { passive: false });

  base.addEventListener("touchmove", e => {
    prevent(e);
    for (const t of e.changedTouches) {
      if (t.identifier === touchState.activeTouchId) {
        updateStick(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  base.addEventListener("touchend", e => {
    prevent(e);
    for (const t of e.changedTouches) {
      if (t.identifier === touchState.activeTouchId) {
        resetStick();
        break;
      }
    }
  }, { passive: false });

  base.addEventListener("touchcancel", e => {
    prevent(e);
    resetStick();
  }, { passive: false });

  const bindButton = (el, fn) => {
    if (!el) return;

    let lastFire = 0;
    const fire = (e) => {
      prevent(e);
      const now = performance.now();
      if (now - lastFire < 180) return;
      lastFire = now;
      fn();
    };

    el.addEventListener("pointerdown", fire, { passive: false });
    el.addEventListener("touchstart", fire, { passive: false });
    el.addEventListener("click", fire);
  };

  bindButton(btnAttack, attack);
  bindButton(btnInteract, interact);
  bindButton(btnLog, toggleLogPanelMobile);
  bindButton(btnRecap, toggleRecapPanelMobile);
  bindButton(btnNew, restartGame);
  bindButton(btnInv, toggleInventoryPanel);

  document.addEventListener("gesturestart", e => e.preventDefault());
  document.addEventListener("touchmove", e => {
    const allowPanelScroll = e.target.closest && e.target.closest("#logPanel, #safeRoomRecap, #inventoryPanel, #inventoryPanel");
    if (isMobileLike() && !allowPanelScroll) e.preventDefault();
  }, { passive: false });
}


function setupDirectPanelButtonFallbacks() {
  const logBtn = document.getElementById("btnLog");
  const recapBtn = document.getElementById("btnRecap");

  const bindDirect = (el, fn) => {
    if (!el) return;

    let last = 0;
    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const now = performance.now();
      if (now - last < 180) return;
      last = now;
      fn();
    };

    el.addEventListener("pointerdown", fire, { passive: false, capture: true });
    el.addEventListener("touchstart", fire, { passive: false, capture: true });
    el.addEventListener("click", fire, { capture: true });
  };

  bindDirect(logBtn, toggleLogPanelMobile);
  bindDirect(recapBtn, toggleRecapPanelMobile);
}


setupTouchControls();
setupPanelCloseButtons();
setupDirectPanelButtonFallbacks();
updateInputVisibility();

window.addEventListener("gamepadconnected", e => {
  gamepadState.connected = true;
  gamepadState.name = e.gamepad.id || "Controller";
  updateInputVisibility();
  achievement("CONTROLLER CONNECTED", "A mysterious handheld device has joined the crawl. Try not to blame it for your decisions.", "controllerConnected");
  updateHUD();
});

window.addEventListener("gamepaddisconnected", () => {
  gamepadState.connected = false;
  gamepadState.name = "";
  gamepadState.previousButtons = [];
  updateInputVisibility();
  updateHUD();
});

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === "e") interact();
  if (e.key.toLowerCase() === "l") toggleLog();
  if (e.key.toLowerCase() === "r") toggleSafeRoomRecap();
  if (e.key.toLowerCase() === "n") restartGame();
  if (e.key.toLowerCase() === "i") toggleInventoryPanel();
  if (e.code === "Space") { e.preventDefault(); attack(); }
});
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = Array.from(pads).find(pad => pad && pad.connected !== false);
  if (!gp) {
    if (gamepadState.connected) {
      gamepadState.connected = false;
      updateInputVisibility();
    }
    gamepadState.moveX = 0;
    gamepadState.moveY = 0;
    return;
  }

  if (!gamepadState.connected) {
    gamepadState.connected = true;
    updateInputVisibility();
  }
  gamepadState.name = gp.id || "Controller";

  const axisX = gp.axes[0] || 0;
  const axisY = gp.axes[1] || 0;
  const dpadX = (gp.buttons[15]?.pressed ? 1 : 0) - (gp.buttons[14]?.pressed ? 1 : 0);
  const dpadY = (gp.buttons[13]?.pressed ? 1 : 0) - (gp.buttons[12]?.pressed ? 1 : 0);

  gamepadState.moveX = Math.abs(axisX) > GAMEPAD_DEADZONE ? axisX : dpadX;
  gamepadState.moveY = Math.abs(axisY) > GAMEPAD_DEADZONE ? axisY : dpadY;

  const justPressed = (index) => {
    const pressed = gp.buttons[index]?.pressed || false;
    const wasPressed = gamepadState.previousButtons[index] || false;
    return pressed && !wasPressed;
  };

  if (justPressed(0)) interact();                    // A / Cross
  if (justPressed(2) || justPressed(5) || justPressed(7)) attack(); // X/Square, RB, RT
  if (justPressed(8)) toggleLog();                   // View/Select
  if (justPressed(3)) toggleSafeRoomRecap();         // Y/Triangle
  if (justPressed(1)) toggleInventoryPanel();        // B/Circle
  if (justPressed(9)) restartGame();                 // Menu/Start

  gamepadState.previousButtons = gp.buttons.map(button => button.pressed);
}

