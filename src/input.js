
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; if (typeof updateInputVisibility === 'function') updateInputVisibility(); if (typeof updateLightingToggleLabel === 'function') updateLightingToggleLabel(); }
window.addEventListener("resize", resize);
resize();


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
  const attackBase = document.getElementById("attackStickBase");
  const btnInteract = document.getElementById("btnInteract");
  const btnLog = document.getElementById("btnLog");
  const btnRecap = document.getElementById("btnRecap");
  const btnNew = document.getElementById("btnNew");
  const btnInv = document.getElementById("btnInv");
  const btnWeapon = document.getElementById("btnWeapon");
  const btnLight = document.getElementById("btnLight");

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


  const bindAttackStick = () => {
    if (!attackBase || !btnAttack) return;

    const ATTACK_STICK_DEADZONE = 14;

    const resetAttackStick = () => {
      touchState.attackTouchId = null;
      touchState.attackActive = false;
      touchState.attackX = 0;
      touchState.attackY = 0;
      btnAttack.style.transform = "translate(0px, 0px)";
      btnAttack.classList.remove("peeling");
    };

    const updateAttackStick = (clientX, clientY) => {
      const rect = attackBase.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const max = rect.width / 2 - 26;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(max, dist);
      const angle = Math.atan2(dy, dx);
      const knobX = Math.cos(angle) * clamped;
      const knobY = Math.sin(angle) * clamped;

      btnAttack.style.transform = `translate(${knobX}px, ${knobY}px)`;
      btnAttack.classList.toggle("peeling", dist > 8);

      const attackX = Math.max(-1, Math.min(1, dx / max));
      const attackY = Math.max(-1, Math.min(1, dy / max));
      const isAimingAttack = dist > ATTACK_STICK_DEADZONE;
      touchState.attackActive = isAimingAttack;
      touchState.attackX = isAimingAttack ? attackX : 0;
      touchState.attackY = isAimingAttack ? attackY : 0;

      if (isAimingAttack) {
        updatePlayerAim(attackX, attackY);
        attack();
      }
    };

    attackBase.addEventListener("pointerdown", e => {
      prevent(e);
      touchState.attackTouchId = e.pointerId;
      touchState.attackActive = true;
      attackBase.setPointerCapture?.(e.pointerId);
      updateAttackStick(e.clientX, e.clientY);
    }, { passive: false });

    attackBase.addEventListener("pointermove", e => {
      if (touchState.attackTouchId !== e.pointerId) return;
      prevent(e);
      updateAttackStick(e.clientX, e.clientY);
    }, { passive: false });

    const endPointerAttack = e => {
      if (touchState.attackTouchId !== e.pointerId) return;
      prevent(e);
      attackBase.releasePointerCapture?.(e.pointerId);
      resetAttackStick();
    };

    attackBase.addEventListener("pointerup", endPointerAttack, { passive: false });
    attackBase.addEventListener("pointercancel", endPointerAttack, { passive: false });
    attackBase.addEventListener("lostpointercapture", resetAttackStick);
  };

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

  bindAttackStick();
  bindButton(btnInteract, interact);
  bindButton(btnLog, toggleLogPanelMobile);
  bindButton(btnRecap, toggleRecapPanelMobile);
  bindButton(btnNew, restartGame);
  bindButton(btnInv, toggleInventoryPanel);
  bindButton(btnWeapon, () => cyclePlayerWeapon(1));
  bindButton(btnLight, toggleLighting);

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


function initInputControls() {
  if (document.body.dataset.inputControlsInitialized === "true") return;
  document.body.dataset.inputControlsInitialized = "true";

  setupTouchControls();
  setupPanelCloseButtons();
  setupDirectPanelButtonFallbacks();
  setupInventoryButtonFallback();
  updateInputVisibility();
}

window.addEventListener("gamepadconnected", e => {
  gamepadState.connected = true;
  gamepadState.name = e.gamepad.id || "Controller";
  updateInputVisibility();
  achievement("CONTROLLER CONNECTED", "A mysterious handheld device has joined the crawl. D-pad maneuvers open windows; A/Cross confirms the selected option.", "controllerConnected");
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
  updateHUD();
});

window.addEventListener("gamepaddisconnected", () => {
  gamepadState.connected = false;
  gamepadState.name = "";
  gamepadState.previousButtons = [];
  gamepadState.aimX = 0;
  gamepadState.aimY = 0;
  gamepadState.hasAimInput = false;
  updateInputVisibility();
  updateHUD();
});

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === "e") interact();
  if (e.key.toLowerCase() === "l") toggleLog();
  if (e.key.toLowerCase() === "r") toggleSafeRoomRecap();
  if (e.key.toLowerCase() === "n" && gameMode !== GAME_MODES.TITLE) restartGame();
  if (e.key.toLowerCase() === "i") toggleInventoryPanel();
  if (e.key.toLowerCase() === "k") toggleLighting();
  if (e.key === "Escape" && multiplayer.enabled) closeMultiplayerPanel();
  if (e.code === "Space") { e.preventDefault(); attack(); }
  if (["1", "2", "3", "4", "5"].includes(e.key)) setPlayerWeapon(WEAPON_ORDER[Number(e.key) - 1]);
  if (e.key.toLowerCase() === "q") cyclePlayerWeapon(-1);
  if (e.key.toLowerCase() === "z") cyclePlayerWeapon(1);
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
    gamepadState.aimX = 0;
    gamepadState.aimY = 0;
    gamepadState.hasAimInput = false;
    return;
  }

  if (!gamepadState.connected) {
    gamepadState.connected = true;
    updateInputVisibility();
  }
  gamepadState.name = gp.id || "Controller";

  const axisX = gp.axes[0] || 0;
  const axisY = gp.axes[1] || 0;
  const aimAxisX = gp.axes[2] || 0;
  const aimAxisY = gp.axes[3] || 0;
  const dpadX = (gp.buttons[15]?.pressed ? 1 : 0) - (gp.buttons[14]?.pressed ? 1 : 0);
  const dpadY = (gp.buttons[13]?.pressed ? 1 : 0) - (gp.buttons[12]?.pressed ? 1 : 0);

  const controllerWindowOpen = typeof hasControllerWindowOpen === "function" && hasControllerWindowOpen();
  gamepadState.moveX = Math.abs(axisX) > GAMEPAD_DEADZONE ? axisX : (controllerWindowOpen ? 0 : dpadX);
  gamepadState.moveY = Math.abs(axisY) > GAMEPAD_DEADZONE ? axisY : (controllerWindowOpen ? 0 : dpadY);

  const aimLength = Math.hypot(aimAxisX, aimAxisY);
  if (aimLength > GAMEPAD_DEADZONE) {
    gamepadState.aimX = aimAxisX;
    gamepadState.aimY = aimAxisY;
    gamepadState.hasAimInput = true;
  } else {
    gamepadState.aimX = 0;
    gamepadState.aimY = 0;
  }

  const justPressed = (index) => {
    const pressed = gp.buttons[index]?.pressed || false;
    const wasPressed = gamepadState.previousButtons[index] || false;
    return pressed && !wasPressed;
  };

  const dpadLeftPressed = justPressed(14);
  const dpadRightPressed = justPressed(15);
  const dpadUpPressed = justPressed(12);
  const dpadDownPressed = justPressed(13);
  const uiConfirmPressed = justPressed(0) || justPressed(2); // A / Cross, or X / Square while a window is active
  const uiWindowOpen = typeof hasControllerWindowOpen === "function" && hasControllerWindowOpen();

  if (uiWindowOpen) {
    if (dpadLeftPressed && typeof moveControllerWindowFocus === "function") moveControllerWindowFocus(-1, 0);
    if (dpadRightPressed && typeof moveControllerWindowFocus === "function") moveControllerWindowFocus(1, 0);
    if (dpadUpPressed && typeof moveControllerWindowFocus === "function") moveControllerWindowFocus(0, -1);
    if (dpadDownPressed && typeof moveControllerWindowFocus === "function") moveControllerWindowFocus(0, 1);
    if (uiConfirmPressed && typeof activateControllerWindowSelection === "function") activateControllerWindowSelection();
  } else {
    if (justPressed(0)) interact();                    // A / Cross
    if (justPressed(2) || justPressed(5) || justPressed(7)) attack(); // X/Square, RB, RT
    if (justPressed(8)) toggleLog();                   // View/Select
    if (justPressed(3)) toggleSafeRoomRecap();         // Y/Triangle
    if (justPressed(1)) toggleInventoryPanel();        // B/Circle
    if (justPressed(4)) cyclePlayerWeapon(-1);         // LB/L1
    if (justPressed(6)) cyclePlayerWeapon(1);          // LT/L2
    if (justPressed(9) && gameMode !== GAME_MODES.TITLE) restartGame();                 // Menu/Start
    if (justPressed(10)) toggleLighting();              // Left stick
  }

  gamepadState.previousButtons = gp.buttons.map(button => button.pressed);
}

