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
        body.inventorySkillsMobileLayout #testerDebugLine {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] {
          display: block !important;
          position: fixed !important;
          inset: var(--dcw-safe-top, max(10px, env(safe-area-inset-top))) var(--dcw-safe-right, max(10px, env(safe-area-inset-right))) var(--dcw-safe-bottom, max(10px, env(safe-area-inset-bottom))) var(--dcw-safe-left, max(10px, env(safe-area-inset-left))) !important;
          width: auto !important;
          height: auto !important;
          max-width: none !important;
          max-height: none !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior: contain !important;
          touch-action: pan-y !important;
          padding: calc(var(--dcw-touch-preferred, 56px) + 10px) 14px max(22px, env(safe-area-inset-bottom)) !important;
          scroll-padding-top: calc(var(--dcw-touch-preferred, 56px) + 14px);
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .panelClose {
          position: fixed !important;
          top: var(--dcw-safe-top, max(10px, env(safe-area-inset-top))) !important;
          right: var(--dcw-safe-right, max(10px, env(safe-area-inset-right))) !important;
          z-index: 350 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] h3 {
          position: sticky !important;
          top: 0 !important;
          z-index: 4 !important;
          min-height: 42px !important;
          margin: -2px 64px 10px 0 !important;
          padding: 4px 0 8px !important;
          background: linear-gradient(180deg, rgba(20,13,9,0.98), rgba(20,13,9,0.88) 78%, rgba(20,13,9,0)) !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] #equipmentStats,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] #inventoryHelp,
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

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .inventorySummaryCard {
          display: block !important;
          margin-bottom: 10px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .inventorySummaryStats {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 6px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .inventorySummaryGear {
          display: none !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .inventoryTabs {
          position: sticky !important;
          top: 42px !important;
          z-index: 3 !important;
          display: grid !important;
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          gap: 6px !important;
          margin: 0 0 12px !important;
          padding: 8px 0 !important;
          background: linear-gradient(180deg, rgba(20,13,9,0.98), rgba(20,13,9,0.92)) !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .inventoryTab {
          min-width: 0 !important;
          min-height: 46px !important;
          padding: 6px 4px !important;
          border-radius: 12px !important;
          font-size: 10px !important;
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
          margin: 6px 0 10px !important;
          font-size: 14px !important;
          letter-spacing: 0.11em !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory {
          display: block !important;
          height: auto !important;
          max-height: none !important;
          min-height: auto !important;
          overflow: visible !important;
          padding: 0 0 24px !important;
          touch-action: pan-y !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory *,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow {
          touch-action: pan-y !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionSummary,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeGrid,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillList,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionColumns {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 8px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionSection {
          margin: 0 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow {
          min-height: 68px !important;
          border-radius: 12px !important;
          padding: 10px !important;
          text-align: left !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow strong,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow strong {
          font-size: 16px !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow small,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow small,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow span,
        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionHelp {
          font-size: 12px !important;
          line-height: 1.35 !important;
        }

        body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionHelp {
          position: static !important;
          margin: 12px 0 4px !important;
          padding: 8px !important;
          border: 1px solid rgba(255,216,107,0.14) !important;
          border-radius: 10px !important;
          background: rgba(0,0,0,0.22) !important;
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
