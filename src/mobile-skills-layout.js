// Mobile-first Skills / Attributes layout.
// This intentionally stops using a nested scroll box for Inventory > Skills on phones.
// The whole inventory panel becomes one simple vertical scroll view, which is much
// more reliable on iOS Safari and controller/touch hybrid devices.
(function installMobileSkillsLayout() {
  if (window.__dcwMobileSkillsLayoutInstalled) return;
  window.__dcwMobileSkillsLayoutInstalled = true;

  const STYLE_ID = "mobileSkillsLayoutStyles";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @media (hover: none) and (pointer: coarse), (max-width: 900px) {
        body.inventorySkillsMobileLayout #touchControls,
        body.inventorySkillsMobileLayout .devControls,
        body.inventorySkillsMobileLayout #testerDebugLine,
        body.inventorySkillsMobileLayout #hud,
        body.inventorySkillsMobileLayout #prompt {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] {
          display: block !important;
          position: fixed !important;
          inset: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)) !important;
          width: auto !important;
          height: auto !important;
          max-width: none !important;
          max-height: none !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior: contain !important;
          touch-action: pan-y !important;
          padding: 10px 10px max(18px, env(safe-area-inset-bottom)) !important;
          border-radius: 12px !important;
          scroll-padding-top: 12px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"]::before {
          inset: 4px !important;
          border-radius: 10px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .panelClose {
          position: fixed !important;
          top: max(12px, env(safe-area-inset-top)) !important;
          right: max(12px, env(safe-area-inset-right)) !important;
          z-index: 360 !important;
          width: 42px !important;
          height: 42px !important;
          min-width: 42px !important;
          min-height: 42px !important;
          font-size: 26px !important;
          line-height: 1 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] h3 {
          position: static !important;
          min-height: 0 !important;
          margin: 0 54px 8px 0 !important;
          padding: 2px 0 4px !important;
          font-size: 15px !important;
          line-height: 1.05 !important;
          letter-spacing: 0.1em !important;
          background: transparent !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] #equipmentStats,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] #inventoryHelp,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .inventorySummaryCard,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .inventoryScrollHint {
          display: none !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] #inventoryList {
          display: block !important;
          height: auto !important;
          max-height: none !important;
          min-height: auto !important;
          overflow: visible !important;
          padding: 0 !important;
          touch-action: pan-y !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .inventoryTabs {
          position: static !important;
          display: grid !important;
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          gap: 6px !important;
          margin: 0 0 8px !important;
          padding: 0 !important;
          background: transparent !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .inventoryTab {
          min-width: 0 !important;
          min-height: 38px !important;
          padding: 5px 3px !important;
          border-radius: 10px !important;
          font-size: 9px !important;
          line-height: 1.05 !important;
          white-space: normal !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .tabLabelFull {
          display: none !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .tabLabelShort {
          display: inline !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .inventoryContentTitle {
          margin: 6px 0 6px !important;
          font-size: 12px !important;
          letter-spacing: 0.1em !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory {
          display: block !important;
          height: auto !important;
          max-height: none !important;
          min-height: auto !important;
          overflow: visible !important;
          padding: 0 0 14px !important;
          touch-action: pan-y !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory *,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow {
          touch-action: pan-y !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spawnAllocationNote {
          margin: 0 0 6px !important;
          font-size: 10px !important;
          line-height: 1.25 !important;
          color: rgba(239,252,255,0.72) !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spawnAllocationHero {
          grid-template-columns: 1fr repeat(2, 76px) !important;
          gap: 6px !important;
          margin: 0 0 8px !important;
          padding: 7px !important;
          border-radius: 10px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spawnClassCard strong {
          font-size: 13px !important;
          line-height: 1.1 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spawnClassCard span {
          margin-top: 2px !important;
          font-size: 9px !important;
          line-height: 1.2 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spawnPointCard {
          min-height: 48px !important;
          padding: 4px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spawnPointCard span {
          font-size: 7px !important;
          line-height: 1.05 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spawnPointCard strong {
          font-size: 17px !important;
          line-height: 1.05 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionSummary,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionColumns {
          display: block !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionSection {
          margin: 0 0 8px !important;
          padding: 7px !important;
          border-radius: 10px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionSection h4 {
          margin: 0 0 6px !important;
          font-size: 12px !important;
          line-height: 1 !important;
          letter-spacing: 0.08em !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeGrid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 6px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillList {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 6px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow {
          display: grid !important;
          grid-template-columns: 1fr auto !important;
          gap: 5px !important;
          align-items: center !important;
          min-height: 76px !important;
          border-radius: 9px !important;
          padding: 8px !important;
          text-align: left !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow {
          display: grid !important;
          grid-template-columns: 1fr auto !important;
          gap: 4px 8px !important;
          align-items: center !important;
          min-height: 82px !important;
          border-radius: 9px !important;
          padding: 8px !important;
          text-align: left !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow strong,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow strong {
          font-size: 13px !important;
          line-height: 1.1 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow small,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow small,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow span {
          font-size: 10px !important;
          line-height: 1.2 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillLevel {
          font-size: 10px !important;
          white-space: nowrap !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillProgress {
          grid-column: 1 / -1 !important;
          height: 4px !important;
          margin: 0 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow em {
          grid-column: 1 / -1 !important;
          font-size: 9px !important;
          line-height: 1 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spendPointBtn {
          width: fit-content !important;
          min-height: 28px !important;
          margin-top: 5px !important;
          padding: 4px 7px !important;
          font-size: 10px !important;
          line-height: 1 !important;
          border-radius: 8px !important;
          touch-action: manipulation !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionHelp {
          position: static !important;
          margin: 8px 0 2px !important;
          padding: 7px !important;
          border: 1px solid rgba(255,216,107,0.14) !important;
          border-radius: 9px !important;
          background: rgba(0,0,0,0.22) !important;
          font-size: 10px !important;
          line-height: 1.25 !important;
        }
      }

      @media (hover: none) and (pointer: coarse) and (orientation: landscape), (max-width: 900px) and (orientation: landscape) {
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] {
          padding: 8px 10px max(12px, env(safe-area-inset-bottom)) !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spawnAllocationHero {
          grid-template-columns: 1fr repeat(2, 70px) !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeGrid {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow {
          min-height: 64px !important;
          padding: 7px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow {
          min-height: 68px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function syncSkillsLayoutState() {
    const panel = document.getElementById("inventoryPanel");
    const enabled = !!panel && panel.classList.contains("open") && panel.dataset.inventoryCategory === "skills";
    document.body.classList.toggle("inventorySkillsMobileLayout", enabled);
    if (!enabled || !panel) return;
    panel.style.overflowY = "auto";
    panel.style.webkitOverflowScrolling = "touch";
    panel.style.touchAction = "pan-y";
  }

  function patchRenderHooks() {
    for (const name of ["toggleInventoryPanel", "closeInventoryPanel", "setActiveInventoryCategory", "updateInventoryUI"]) {
      const original = window[name];
      if (typeof original !== "function" || original.__mobileSkillsLayoutWrapped) continue;
      const wrapped = function mobileSkillsLayoutWrapped(...args) {
        const result = original.apply(this, args);
        setTimeout(syncSkillsLayoutState, 0);
        setTimeout(syncSkillsLayoutState, 80);
        return result;
      };
      wrapped.__mobileSkillsLayoutWrapped = true;
      window[name] = wrapped;
      try { eval(`${name} = window[name]`); } catch {}
    }
  }

  function bindPanelDragFallback() {
    if (window.__dcwMobileSkillsDragFallbackBound) return;
    window.__dcwMobileSkillsDragFallbackBound = true;
    let drag = null;
    const panelFromEvent = event => event.target?.closest?.("#inventoryPanel.open[data-inventory-category='skills']") || null;

    document.addEventListener("touchstart", event => {
      const panel = panelFromEvent(event);
      if (!panel || panel.scrollHeight <= panel.clientHeight + 2) {
        drag = null;
        return;
      }
      const touch = event.touches?.[0];
      if (!touch) return;
      drag = { panel, lastY: touch.clientY, moved: false };
    }, { capture: true, passive: true });

    document.addEventListener("touchmove", event => {
      if (!drag) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      const deltaY = drag.lastY - touch.clientY;
      if (Math.abs(deltaY) < 1) return;
      const before = drag.panel.scrollTop;
      drag.panel.scrollTop += deltaY;
      drag.lastY = touch.clientY;
      drag.moved = drag.moved || Math.abs(drag.panel.scrollTop - before) > 0;
      if (drag.moved && Math.abs(deltaY) > 2) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, { capture: true, passive: false });

    document.addEventListener("touchend", () => { drag = null; }, { capture: true, passive: true });
    document.addEventListener("touchcancel", () => { drag = null; }, { capture: true, passive: true });
  }

  function install() {
    injectStyles();
    patchRenderHooks();
    bindPanelDragFallback();
    syncSkillsLayoutState();
    window.addEventListener("resize", () => setTimeout(syncSkillsLayoutState, 0));
    window.addEventListener("orientationchange", () => setTimeout(syncSkillsLayoutState, 80));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
