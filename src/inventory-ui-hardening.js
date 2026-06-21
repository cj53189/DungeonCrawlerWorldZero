// Inventory and modal scroll hardening for touch + controller navigation.
(function installInventoryUiHardening() {
  if (window.__dcwInventoryUiHardeningInstalled) return;
  window.__dcwInventoryUiHardeningInstalled = true;

  const STYLE_ID = "inventoryUiHardeningStyles";
  const SCROLLABLE_SELECTOR = [
    "#inventoryPanel[data-inventory-category='skills'] .progressionInventory",
    "#inventoryList",
    "#equipmentStats",
    "#lootWindowGrid",
    "#logPanel",
    "#safeRoomRecap",
    "#petMerchantOptions",
    "#multiplayerPanel",
    "#mpMemberList",
    "#mpNearbyCrawlerList",
    "#settingsPanel .settingsBody",
    "#progressionPanel",
    ".progressionInventory",
    ".lootGrid",
    ".mobileCrawlerSheet",
    ".characterSheet",
    ".titleBox"
  ].join(",");

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #inventoryPanel,
      #lootWindow,
      #progressionPanel,
      #petMerchantPanel,
      #multiplayerPanel,
      #logPanel,
      #safeRoomRecap {
        box-sizing: border-box;
        overscroll-behavior: contain;
      }

      #inventoryPanel.open,
      #lootWindow[style*="display: block"],
      #lootWindow[style*="display:block"] {
        overflow: hidden !important;
      }

      #inventoryList,
      #equipmentStats,
      #lootWindowGrid,
      #petMerchantOptions,
      #mpMemberList,
      #mpNearbyCrawlerList,
      #logPanel,
      #safeRoomRecap,
      #progressionPanel,
      .progressionInventory,
      .lootGrid,
      .mobileCrawlerSheet,
      .characterSheet {
        min-height: 0;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
      }

      #inventoryPanel.open #inventoryList,
      #inventoryPanel.open #equipmentStats,
      #lootWindowGrid,
      #petMerchantOptions,
      #progressionPanel,
      .progressionInventory,
      .lootGrid,
      .mobileCrawlerSheet {
        overflow-y: auto;
      }

      #inventoryPanel.open[data-inventory-category="skills"] {
        min-height: 0 !important;
      }

      #inventoryPanel.open[data-inventory-category="skills"] #inventoryList {
        display: grid !important;
        grid-template-rows: auto auto auto minmax(0, 1fr) !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory {
        min-height: 0 !important;
        max-height: 100% !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-y !important;
        padding-right: 4px;
        padding-bottom: max(42px, env(safe-area-inset-bottom)) !important;
      }

      #inventoryPanel.open[data-inventory-category="skills"] #inventoryHelp {
        display: none !important;
      }

      #inventoryPanel.open[data-inventory-category="skills"] .inventoryScrollHint {
        grid-column: 1 / -1;
        align-self: end;
        margin-top: 0;
      }

      #lootWindowGrid {
        max-height: min(48vh, 360px);
      }

      #inventoryPanel .inventoryScrollHint,
      #lootWindow .inventoryScrollHint {
        color: #b5a890;
        font-size: 10px;
        font-style: italic;
        text-align: center;
        margin-top: 6px;
        pointer-events: none;
      }

      @media (hover: none) and (pointer: coarse), (max-width: 900px) {
        #inventoryPanel.open {
          display: grid !important;
          grid-template-columns: 1fr !important;
          grid-template-rows: auto minmax(0, auto) minmax(0, 1fr) auto !important;
          min-height: 0 !important;
        }

        #inventoryPanel.open #equipmentStats {
          max-height: min(34dvh, 240px) !important;
          overflow-y: auto !important;
          padding-right: 4px !important;
        }

        #inventoryPanel.open #inventoryList {
          max-height: none !important;
          overflow-y: auto !important;
          padding-right: 4px !important;
        }

        #inventoryPanel.open[data-inventory-category="skills"] {
          grid-template-rows: auto minmax(0, 1fr) auto !important;
        }

        #inventoryPanel.open[data-inventory-category="skills"] #equipmentStats {
          display: none !important;
        }

        #inventoryPanel.open[data-inventory-category="skills"] #inventoryList {
          overflow: hidden !important;
          min-height: 0 !important;
        }

        #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory {
          overflow-y: auto !important;
          min-height: 0 !important;
          max-height: 100% !important;
          touch-action: pan-y !important;
          -webkit-overflow-scrolling: touch !important;
        }

        #lootWindow[style*="display: block"],
        #lootWindow[style*="display:block"] {
          display: grid !important;
          grid-template-rows: auto minmax(0, 1fr) auto !important;
          min-height: 0 !important;
        }

        #lootWindowGrid {
          max-height: none !important;
          overflow-y: auto !important;
        }
      }

      @media (orientation: portrait) and (hover: none),
             (orientation: portrait) and (max-width: 900px) {
        #inventoryPanel.open[data-inventory-category="skills"] {
          height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important;
          max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important;
          overflow: hidden !important;
        }

        #inventoryPanel.open[data-inventory-category="skills"] #inventoryList {
          grid-template-rows: auto auto auto minmax(0, 1fr) !important;
        }

        #inventoryPanel.open[data-inventory-category="skills"] .progressionSummary {
          grid-template-columns: 1fr !important;
        }

        #inventoryPanel.open[data-inventory-category="skills"] .attributeGrid,
        #inventoryPanel.open[data-inventory-category="skills"] .skillList {
          grid-template-columns: 1fr !important;
        }
      }

      @media (orientation: landscape) and (hover: none) and (max-height: 520px),
             (orientation: landscape) and (max-height: 520px) {
        #inventoryPanel.open {
          grid-template-columns: minmax(190px, 32%) minmax(0, 1fr) !important;
          grid-template-rows: auto minmax(0, 1fr) auto !important;
          gap: 8px !important;
        }

        #inventoryPanel.open h3,
        #inventoryPanel.open .panelClose,
        #inventoryPanel.open #inventoryHelp {
          grid-column: 1 / -1 !important;
        }

        #inventoryPanel.open #equipmentStats {
          max-height: none !important;
          overflow-y: auto !important;
        }

        #inventoryPanel.open #inventoryList {
          max-height: none !important;
          overflow-y: auto !important;
        }

        #inventoryPanel.open[data-inventory-category="skills"] #equipmentStats {
          display: none !important;
        }

        #inventoryPanel.open[data-inventory-category="skills"] #inventoryList {
          grid-column: 1 / -1 !important;
          overflow: hidden !important;
        }

        #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory {
          overflow-y: auto !important;
          min-height: 0 !important;
        }

        #inventoryPanel .paperDoll,
        #inventoryPanel .characterStats,
        #inventoryPanel .inventorySummaryCard {
          max-height: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && el.getClientRects().length > 0;
  }

  function isScrollable(el) {
    if (!el || !isVisible(el)) return false;
    const style = getComputedStyle(el);
    const canScroll = /(auto|scroll)/.test(style.overflowY) || el.scrollHeight > el.clientHeight + 3;
    return canScroll && el.scrollHeight > el.clientHeight + 3;
  }

  function activeWindowRoot() {
    if (typeof getActiveControllerWindow === "function") return getActiveControllerWindow();
    return ["lootWindow", "inventoryPanel", "progressionPanel", "petMerchantPanel", "multiplayerPanel", "safeRoomRecap", "logPanel"]
      .map(id => document.getElementById(id))
      .find(isVisible) || null;
  }

  function scrollableAncestorsFrom(node, root) {
    const out = [];
    let cur = node;
    while (cur && cur !== document && cur !== document.body) {
      if ((!root || root.contains(cur) || root === cur) && isScrollable(cur)) out.push(cur);
      if (cur === root) break;
      cur = cur.parentElement;
    }
    return out;
  }

  function scrollCandidates(root = activeWindowRoot()) {
    if (!root) return [];
    const candidates = [];
    if (root.contains(document.activeElement)) candidates.push(...scrollableAncestorsFrom(document.activeElement, root));
    if (isScrollable(root)) candidates.push(root);
    candidates.push(...Array.from(root.querySelectorAll(SCROLLABLE_SELECTOR)).filter(isScrollable));
    return [...new Set(candidates)];
  }

  function bestScrollTarget(root = activeWindowRoot()) {
    const candidates = scrollCandidates(root);
    if (!candidates.length) return null;
    if (root?.id === "inventoryPanel" && root.dataset.inventoryCategory === "skills") {
      return candidates.find(el => el.classList?.contains("progressionInventory")) || candidates.find(el => el.id === "inventoryList") || candidates[0];
    }
    const preferredIds = ["inventoryList", "lootWindowGrid", "petMerchantOptions", "progressionPanel", "logPanel", "safeRoomRecap"];
    return candidates.find(el => preferredIds.includes(el.id)) || candidates[0];
  }

  function scrollUiPanel(deltaY) {
    const root = activeWindowRoot();
    const target = bestScrollTarget(root);
    if (!target) return false;
    const before = target.scrollTop;
    target.scrollTop += deltaY;
    return Math.abs(target.scrollTop - before) > 0.5;
  }

  function patchControllerScroll() {
    window.getOpenScrollablePanel = function getHardenedOpenScrollablePanel() {
      return bestScrollTarget();
    };

    window.updatePanelScrollFromController = function updateHardenedPanelScrollFromController() {
      if (!gamepadState?.connected) return;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(pads).find(pad => pad && pad.connected !== false);
      if (!gp) return;
      const rightY = gp.axes?.[3] || 0;
      const rightX = gp.axes?.[2] || 0;
      const vertical = Math.abs(rightY) > 0.18 ? rightY : 0;
      const pageDown = gp.buttons?.[7]?.pressed ? 1 : 0;
      const pageUp = gp.buttons?.[6]?.pressed ? -1 : 0;
      const dpadDown = gp.buttons?.[13]?.pressed ? 1 : 0;
      const dpadUp = gp.buttons?.[12]?.pressed ? -1 : 0;
      const root = activeWindowRoot();
      const hasButtons = typeof getControllerWindowButtons === "function" && root && getControllerWindowButtons(root).length > 0;
      const dpadScroll = hasButtons ? 0 : (dpadDown + dpadUp);
      const input = vertical || pageDown + pageUp || dpadScroll;
      if (Math.abs(input) <= 0.05) return;
      const speed = pageDown || pageUp ? 34 : Math.abs(rightX) > 0.65 ? 28 : 18;
      scrollUiPanel(input * speed);
    };
  }

  function ensureScrollHint(panel, text) {
    if (!panel || panel.querySelector(".inventoryScrollHint")) return;
    const hint = document.createElement("div");
    hint.className = "inventoryScrollHint";
    hint.textContent = text;
    panel.appendChild(hint);
  }

  function refreshPanels() {
    const inventory = document.getElementById("inventoryPanel");
    const loot = document.getElementById("lootWindow");
    if (inventory) {
      inventory.classList.toggle("dcwScrollableModal", inventory.classList.contains("open"));
      ensureScrollHint(inventory, "Touch scroll · Right stick scroll · D-pad selects");
      const progression = inventory.querySelector(".progressionInventory");
      if (progression) {
        progression.style.overflowY = "auto";
        progression.style.webkitOverflowScrolling = "touch";
        progression.style.touchAction = "pan-y";
      }
    }
    if (loot) ensureScrollHint(loot, "Touch scroll · Right stick scroll · Take items or Take All");
  }

  function patchOpenCloseHooks() {
    for (const name of ["toggleInventoryPanel", "openCorpseLootWindow", "renderCorpseLootWindow", "toggleProgressionPanel", "showSafeRoomRecap", "toggleLog", "setActiveInventoryCategory", "updateInventoryUI"]) {
      const original = window[name];
      if (typeof original !== "function" || original.__inventoryUiHardeningWrapped) continue;
      const wrapped = function inventoryUiHardeningWrappedFunction(...args) {
        const result = original.apply(this, args);
        setTimeout(refreshPanels, 0);
        setTimeout(refreshPanels, 120);
        return result;
      };
      wrapped.__inventoryUiHardeningWrapped = true;
      window[name] = wrapped;
      try { eval(`${name} = window[name]`); } catch {}
    }
  }

  function allowModalTouchScroll() {
    document.addEventListener("touchmove", event => {
      const target = event.target?.closest?.("#inventoryPanel .progressionInventory, #inventoryPanel #inventoryList, #lootWindow, #petMerchantPanel, #progressionPanel, #multiplayerPanel");
      if (!target) return;
      event.stopPropagation();
    }, { capture: true, passive: true });
  }

  function install() {
    injectStyles();
    patchControllerScroll();
    patchOpenCloseHooks();
    allowModalTouchScroll();
    refreshPanels();
    window.addEventListener("resize", () => setTimeout(refreshPanels, 0));
    window.addEventListener("orientationchange", () => setTimeout(refreshPanels, 80));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
