// Extends Settings > UI Edit Mode so every gameplay UI surface can be moved, resized, and hidden for final UI tuning.
(function installCompleteUiLayoutEditor() {
  const UI_LAYOUT_STORAGE_KEY = "dcw.uiLayout.v1";

  const LAYOUT_TARGETS = [
    // Core HUD and gameplay chrome.
    { key: "hud", label: "HUD", selector: "#hud" },
    { key: "settingsButton", label: "Settings", selector: "#settingsBtn", minW: 40, minH: 40, protected: true },
    { key: "announcer", label: "Popups", selector: "#announcer", minW: 180, minH: 54 },
    { key: "prompt", label: "Prompt", selector: "#prompt", minW: 120, minH: 32 },
    { key: "testerDebugLine", label: "Debug", selector: "#testerDebugLine", minW: 220, minH: 28 },
    { key: "stairHud", label: "Stair HUD", selector: "#stairHud", minW: 110, minH: 30 },
    { key: "floorSplash", label: "Floor Splash", selector: "#floorSplash", minW: 180, minH: 60 },

    // Windows and overlays.
    { key: "inventory", label: "Inventory", selector: "#inventoryPanel" },
    { key: "recap", label: "Recap", selector: "#safeRoomRecap" },
    { key: "log", label: "Log", selector: "#logPanel" },
    { key: "lootWindow", label: "Loot Window", selector: "#lootWindow" },
    { key: "petMerchant", label: "Pet Merchant", selector: "#petMerchantPanel" },
    { key: "progression", label: "Skills", selector: "#progressionPanel", minW: 260, minH: 220 },
    { key: "centerMessageBox", label: "Center Message", selector: "#centerMessage .box", minW: 240, minH: 140 },
    { key: "multiplayerPanel", label: "Lobby Panel", selector: "#multiplayerPanel" },
    { key: "multiplayerOpenButton", label: "Lobby Button", selector: "#mpOpenPanelBtn", minW: 64, minH: 44 },
    { key: "minimap", label: "Minimap", selector: "#minimapEditPanel" },

    // Touch controls. The attack button is intentionally controlled by attackStickBase.
    { key: "moveStick", label: "Move Stick", selector: "#stickBase", minW: 72, minH: 72 },
    { key: "attackStick", label: "Attack Stick", selector: "#attackStickBase", minW: 72, minH: 72 },
    { key: "touchInteract", label: "Interact", selector: "#btnInteract", minW: 44, minH: 44 },
    { key: "touchDodge", label: "Dodge", selector: "#btnDodge", minW: 44, minH: 44 },
    { key: "touchInventory", label: "Inventory Button", selector: "#btnInv", minW: 44, minH: 44 },
    { key: "touchWeapon", label: "Weapon Button", selector: "#btnWeapon", minW: 44, minH: 44 },
    { key: "touchLog", label: "Log Button", selector: "#btnLog", minW: 44, minH: 44 },
    { key: "touchRecap", label: "Recap Button", selector: "#btnRecap", minW: 44, minH: 44 },
    { key: "touchSettings", label: "Settings Button", selector: "#btnNew", minW: 44, minH: 44 },
    { key: "touchLight", label: "Light Button", selector: "#btnLight", minW: 44, minH: 44 }
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
    el.classList.toggle("uiLayoutDeleted", saved.hidden === true);
    el.setAttribute("data-ui-hidden", saved.hidden === true ? "true" : "false");
  }

  function snapshotLayout(el, extra = {}) {
    const rect = el.getBoundingClientRect();
    const previous = readLayout()[el.dataset.uiLayoutKey] || {};
    return {
      ...previous,
      left: Math.round(rect.left || previous.left || 0),
      top: Math.round(rect.top || previous.top || 0),
      width: Math.round(rect.width || previous.width || 0),
      height: Math.round(rect.height || previous.height || 0),
      ...extra
    };
  }

  function saveLayout(el, extra = {}) {
    const key = el?.dataset.uiLayoutKey;
    if (!key) return;
    const layout = readLayout();
    layout[key] = snapshotLayout(el, extra);
    writeLayout(layout);
  }

  function chooseDragHandle(el) {
    return el.querySelector(".uiMoveIcon, .uiDragHandle, h1, h2, h3, .hudTop, .panelTitle, .panelEyebrow, .minimapEditHeader") || el;
  }

  function createEditorTool(className, icon, label) {
    const tool = document.createElement("span");
    tool.className = `uiLayoutTool ${className}`;
    tool.textContent = icon;
    tool.setAttribute("role", "button");
    tool.setAttribute("aria-label", label);
    tool.title = label;
    tool.tabIndex = -1;
    return tool;
  }

  function updateDeleteTool(el, deleteTool, target) {
    const hidden = el.classList.contains("uiLayoutDeleted");
    deleteTool.textContent = hidden ? "↺" : "🗑";
    deleteTool.title = target.protected
      ? "Settings cannot be hidden from the editor"
      : hidden ? `Restore ${target.label}` : `Hide ${target.label}`;
    deleteTool.setAttribute("aria-label", deleteTool.title);
    deleteTool.classList.toggle("restore", hidden);
    deleteTool.classList.toggle("protected", !!target.protected);
  }

  function addEditorControls(el, target, beginMove) {
    let tray = Array.from(el.children).find(child => child.classList?.contains("uiLayoutTools"));
    if (!tray) {
      tray = document.createElement(el.tagName === "BUTTON" ? "span" : "div");
      tray.className = "uiLayoutTools";
      el.appendChild(tray);
    }

    let moveTool = tray.querySelector(".uiMoveIcon");
    if (!moveTool) {
      moveTool = createEditorTool("uiMoveIcon", "✥", `Move ${target.label}`);
      tray.appendChild(moveTool);
    }

    let deleteTool = tray.querySelector(".uiDeleteIcon");
    if (!deleteTool) {
      deleteTool = createEditorTool("uiDeleteIcon", "🗑", `Hide ${target.label}`);
      tray.appendChild(deleteTool);
    }

    moveTool.addEventListener("pointerdown", beginMove, { passive: false });
    deleteTool.addEventListener("pointerdown", event => {
      if (!isEditMode()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }, { passive: false });
    deleteTool.addEventListener("click", event => {
      if (!isEditMode()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (target.protected) return;
      const hidden = !el.classList.contains("uiLayoutDeleted");
      el.classList.toggle("uiLayoutDeleted", hidden);
      el.setAttribute("data-ui-hidden", hidden ? "true" : "false");
      saveLayout(el, { hidden });
      updateDeleteTool(el, deleteTool, target);
    });

    updateDeleteTool(el, deleteTool, target);
    return { tray, moveTool, deleteTool };
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
    // Prevent the older limited editor from double-binding this element.
    el.dataset.uiLayoutBound = "true";
    el.dataset.uiLayoutKey = target.key;
    el.dataset.uiLabel = target.label;
    el.classList.add("uiLayoutTarget");
    applyLayout(el, savedLayout[target.key]);

    const computed = window.getComputedStyle(el);
    if (computed.position === "static") el.style.position = "fixed";
    if (computed.position === "relative" && target.selector !== "#centerMessage .box") el.style.position = "fixed";
    if (computed.position === "fixed" || computed.position === "absolute") {
      el.style.overflow = el.style.overflow || computed.overflow;
    }

    let drag = null;

    const beginMove = event => {
      if (!isEditMode() || event.target.closest("button:not(#settingsBtn):not(.touchButton):not(.mpOpenPanelBtn), input, select, textarea, .uiDeleteIcon, .uiResizeHandle")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const rect = el.getBoundingClientRect();
      drag = { type: "move", id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const dragHandle = chooseDragHandle(el);
    dragHandle.classList.add("uiDragHandle");
    const resizeHandle = addResizeHandle(el);
    addEditorControls(el, target, beginMove);

    const beginResize = event => {
      if (!isEditMode()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
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
      saveLayout(el, { hidden: el.classList.contains("uiLayoutDeleted") });
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

      body:not(.uiEditMode) .uiLayoutDeleted {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      body.uiEditMode .uiLayoutTarget {
        outline: 2px dashed rgba(124,247,255,.74) !important;
        outline-offset: 3px;
        pointer-events: auto !important;
      }

      body.uiEditMode .uiLayoutDeleted {
        display: block !important;
        visibility: visible !important;
        opacity: 0.38 !important;
        filter: grayscale(1);
      }

      body.uiEditMode .uiLayoutDeleted.touchButton,
      body.uiEditMode .uiLayoutDeleted.mpOpenPanelBtn,
      body.uiEditMode #settingsBtn.uiLayoutDeleted {
        display: flex !important;
      }

      body.uiEditMode .uiLayoutDeleted::after {
        content: "HIDDEN";
        position: absolute;
        left: 4px;
        bottom: 4px;
        padding: 2px 5px;
        border-radius: 6px;
        background: rgba(255,70,70,.88);
        color: #fff;
        font: 900 9px Arial, sans-serif;
        letter-spacing: .08em;
        pointer-events: none;
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

      .uiLayoutTarget {
        box-sizing: border-box;
      }

      .uiLayoutTools {
        position: absolute;
        left: 4px;
        top: 4px;
        z-index: 1000;
        display: none;
        align-items: center;
        gap: 3px;
        pointer-events: auto;
      }

      body.uiEditMode .uiLayoutTarget > .uiLayoutTools {
        display: flex !important;
      }

      .uiLayoutTool {
        width: 23px;
        height: 23px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(124,247,255,.88);
        border-radius: 7px;
        background: rgba(4,12,18,.92);
        color: #7cf7ff;
        font: 900 13px Arial, sans-serif;
        line-height: 1;
        box-shadow: 0 2px 8px rgba(0,0,0,.42);
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }

      .uiMoveIcon {
        cursor: move;
      }

      .uiDeleteIcon {
        border-color: rgba(255,96,96,.92);
        color: #ff8d8d;
      }

      .uiDeleteIcon.restore {
        border-color: rgba(140,255,160,.92);
        color: #9cff9c;
      }

      .uiDeleteIcon.protected {
        opacity: 0.42;
        cursor: not-allowed;
      }

      body.uiEditMode .uiLayoutTarget > .uiResizeHandle {
        display: block !important;
      }

      .uiLayoutTarget > .uiResizeHandle {
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
