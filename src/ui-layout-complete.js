// Extends Settings > UI Edit Mode so every gameplay UI surface can be moved and resized.
(function installCompleteUiLayoutEditor() {
  const UI_LAYOUT_STORAGE_KEY = "dcw.uiLayout.v1";

  const LAYOUT_TARGETS = [
    // Core HUD and gameplay chrome.
    { key: "hud", selector: "#hud" },
    { key: "settingsButton", selector: "#settingsBtn", minW: 40, minH: 40 },
    { key: "announcer", selector: "#announcer", minW: 180, minH: 54 },
    { key: "prompt", selector: "#prompt", minW: 120, minH: 32 },
    { key: "testerDebugLine", selector: "#testerDebugLine", minW: 220, minH: 28 },
    { key: "stairHud", selector: "#stairHud", minW: 110, minH: 30 },
    { key: "floorSplash", selector: "#floorSplash", minW: 180, minH: 60 },

    // Windows and overlays.
    { key: "inventory", selector: "#inventoryPanel" },
    { key: "recap", selector: "#safeRoomRecap" },
    { key: "log", selector: "#logPanel" },
    { key: "lootWindow", selector: "#lootWindow" },
    { key: "petMerchant", selector: "#petMerchantPanel" },
    { key: "progression", selector: "#progressionPanel", minW: 260, minH: 220 },
    { key: "centerMessageBox", selector: "#centerMessage .box", minW: 240, minH: 140 },
    { key: "multiplayerPanel", selector: "#multiplayerPanel" },
    { key: "multiplayerOpenButton", selector: "#mpOpenPanelBtn", minW: 64, minH: 44 },
    { key: "minimap", selector: "#minimapEditPanel" },

    // Touch controls. The attack button is intentionally controlled by attackStickBase.
    { key: "moveStick", selector: "#stickBase", minW: 72, minH: 72 },
    { key: "attackStick", selector: "#attackStickBase", minW: 72, minH: 72 },
    { key: "touchInteract", selector: "#btnInteract", minW: 44, minH: 44 },
    { key: "touchDodge", selector: "#btnDodge", minW: 44, minH: 44 },
    { key: "touchInventory", selector: "#btnInv", minW: 44, minH: 44 },
    { key: "touchWeapon", selector: "#btnWeapon", minW: 44, minH: 44 },
    { key: "touchLog", selector: "#btnLog", minW: 44, minH: 44 },
    { key: "touchRecap", selector: "#btnRecap", minW: 44, minH: 44 },
    { key: "touchSettings", selector: "#btnNew", minW: 44, minH: 44 },
    { key: "touchLight", selector: "#btnLight", minW: 44, minH: 44 }
  ];

  function readLayout() {
    try { return JSON.parse(localStorage.getItem(UI_LAYOUT_STORAGE_KEY) || "{}"); }
    catch { return {}; }
  }

  function writeLayout(layout) {
    try { localStorage.setItem(UI_LAYOUT_STORAGE_KEY, JSON.stringify(layout)); } catch {}
  }

  function isEditMode() {
    return document.body.classList.contains("uiEditMode") || (typeof uiEditMode !== "undefined" && !!uiEditMode);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function applyLayout(el, saved) {
    if (!el || !saved) return;
    el.style.left = `${saved.left}px`;
    el.style.top = `${saved.top}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.inset = "auto";
    el.style.transform = "none";
    if (saved.width) el.style.width = `${saved.width}px`;
    if (saved.height) el.style.height = `${saved.height}px`;
  }

  function saveLayout(el) {
    const key = el?.dataset.uiLayoutKey;
    if (!key) return;
    const rect = el.getBoundingClientRect();
    const layout = readLayout();
    layout[key] = {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
    writeLayout(layout);
  }

  function chooseDragHandle(el) {
    return el.querySelector(".uiDragHandle, h1, h2, h3, .hudTop, .panelTitle, .panelEyebrow, .minimapEditHeader") || el;
  }

  function addResizeHandle(el) {
    let handle = Array.from(el.children).find(child => child.classList?.contains("uiResizeHandle"));
    if (!handle) {
      handle = document.createElement(el.tagName === "BUTTON" ? "span" : "div");
      handle.className = "uiResizeHandle";
      handle.setAttribute("aria-hidden", "true");
      el.appendChild(handle);
    }
    return handle;
  }

  function bindLayoutTarget(target, savedLayout) {
    const el = document.querySelector(target.selector);
    if (!el || el.dataset.uiLayoutCompleteBound === "true") return false;

    el.dataset.uiLayoutCompleteBound = "true";
    el.dataset.uiLayoutKey = target.key;
    el.classList.add("uiLayoutTarget");
    applyLayout(el, savedLayout[target.key]);

    const computed = window.getComputedStyle(el);
    if (computed.position === "static") el.style.position = "fixed";
    if (computed.position === "relative" && target.selector !== "#centerMessage .box") el.style.position = "fixed";

    const dragHandle = chooseDragHandle(el);
    dragHandle.classList.add("uiDragHandle");
    const resizeHandle = addResizeHandle(el);

    let drag = null;

    const beginMove = event => {
      if (!isEditMode() || event.target.closest("button:not(#settingsBtn):not(.touchButton):not(.mpOpenPanelBtn), input, select, textarea, .uiResizeHandle")) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = el.getBoundingClientRect();
      drag = { type: "move", id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      dragHandle.setPointerCapture?.(event.pointerId);
    };

    const beginResize = event => {
      if (!isEditMode()) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = el.getBoundingClientRect();
      drag = { type: "resize", id: event.pointerId, x: event.clientX, y: event.clientY, w: rect.width, h: rect.height };
      resizeHandle.setPointerCapture?.(event.pointerId);
    };

    const move = event => {
      if (!drag || drag.id !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      if (drag.type === "move") {
        const left = clamp(drag.left + event.clientX - drag.x, 0, Math.max(0, window.innerWidth - 40));
        const top = clamp(drag.top + event.clientY - drag.y, 0, Math.max(0, window.innerHeight - 32));
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.inset = "auto";
        el.style.transform = "none";
      } else {
        const minW = target.minW || 160;
        const minH = target.minH || 80;
        el.style.width = `${Math.max(minW, drag.w + event.clientX - drag.x)}px`;
        el.style.height = `${Math.max(minH, drag.h + event.clientY - drag.y)}px`;
      }
    };

    const end = event => {
      if (!drag || drag.id !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      saveLayout(el);
      drag = null;
    };

    dragHandle.addEventListener("pointerdown", beginMove, { passive: false });
    resizeHandle.addEventListener("pointerdown", beginResize, { passive: false });
    el.addEventListener("pointermove", move, { passive: false });
    el.addEventListener("pointerup", end, { passive: false });
    el.addEventListener("pointercancel", end, { passive: false });
    return true;
  }

  function injectStyles() {
    if (document.getElementById("completeUiLayoutEditorStyles")) return;
    const style = document.createElement("style");
    style.id = "completeUiLayoutEditorStyles";
    style.textContent = `
      #hud, #announcer, #prompt, #testerDebugLine, #stairHud, #floorSplash,
      #inventoryPanel, #safeRoomRecap, #logPanel, #lootWindow, #petMerchantPanel,
      #progressionPanel, #multiplayerPanel, #mpOpenPanelBtn, #settingsBtn,
      #minimapEditPanel, #stickBase, #attackStickBase, #btnInteract, #btnDodge,
      #btnInv, #btnWeapon, #btnLog, #btnRecap, #btnNew, #btnLight, #centerMessage .box {
        zoom: var(--ui-scale);
      }

      body.uiEditMode .uiLayoutTarget {
        outline: 2px dashed rgba(124,247,255,.74) !important;
        outline-offset: 3px;
        pointer-events: auto !important;
      }

      body.uiEditMode #announcer:empty,
      body.uiEditMode #prompt:empty,
      body.uiEditMode #testerDebugLine:empty,
      body.uiEditMode #stairHud:not(.visible),
      body.uiEditMode #floorSplash {
        display: block !important;
        min-width: 120px;
        min-height: 28px;
        background: rgba(0,0,0,.28);
      }

      body.uiEditMode #announcer:empty::before { content: "Popups"; color: #7cf7ff; font: 900 10px Arial; padding: 4px 6px; display: block; }
      body.uiEditMode #prompt:empty::before { content: "Prompt"; color: #7cf7ff; }
      body.uiEditMode #floorSplash:empty::before { content: "Floor Splash"; color: #7cf7ff; }

      body.uiEditMode .uiLayoutTarget .uiResizeHandle {
        display: block !important;
      }

      .uiLayoutTarget {
        box-sizing: border-box;
      }

      .uiLayoutTarget .uiResizeHandle {
        position: absolute;
        right: 3px;
        bottom: 3px;
        width: 16px;
        height: 16px;
        border-right: 2px solid rgba(124,247,255,.9);
        border-bottom: 2px solid rgba(124,247,255,.9);
        cursor: nwse-resize;
        z-index: 999;
        display: none;
        pointer-events: auto;
      }

      body.uiEditMode .uiDragHandle,
      body.uiEditMode .uiLayoutTarget {
        cursor: move;
        user-select: none;
      }
    `;
    document.head.appendChild(style);
  }

  function install() {
    injectStyles();
    const savedLayout = readLayout();
    let boundAny = false;
    for (const target of LAYOUT_TARGETS) boundAny = bindLayoutTarget(target, savedLayout) || boundAny;
    return boundAny;
  }

  window.setupCompleteUiLayoutEditor = install;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      install();
      setTimeout(install, 250);
      setTimeout(install, 1000);
    }, { once: true });
  } else {
    install();
    setTimeout(install, 250);
    setTimeout(install, 1000);
  }
})();
