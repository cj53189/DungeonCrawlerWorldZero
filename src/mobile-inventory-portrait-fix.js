// Final mobile portrait overrides for Inventory and Skills modals.
// Keeps iPhone portrait from using cramped two-column skill cards or overlapping footer hints.
(function installMobileInventoryPortraitFix() {
  if (window.__dcwMobileInventoryPortraitFixInstalled) return;
  window.__dcwMobileInventoryPortraitFixInstalled = true;

  const STYLE_ID = "mobileInventoryPortraitFixStyles";
  const CSS = `
    @media (hover: none) and (pointer: coarse), (max-width: 900px) {
      html body #inventoryPanel.open .inventoryScrollHint {
        display: none !important;
      }

      html body #lootWindow .inventoryScrollHint {
        display: block !important;
      }

      html body #inventoryPanel.open:not([data-inventory-category="skills"]) {
        display: grid !important;
        grid-template-columns: 1fr !important;
        grid-template-rows: auto minmax(0, auto) minmax(0, 1fr) auto !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      html body #inventoryPanel.open:not([data-inventory-category="skills"]) #equipmentStats {
        min-height: 0 !important;
        max-height: min(34dvh, 240px) !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        padding-right: 4px !important;
      }

      html body #inventoryPanel.open:not([data-inventory-category="skills"]) #inventoryList {
        min-height: 0 !important;
        max-height: none !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-y !important;
        padding-right: 4px !important;
        padding-bottom: max(96px, calc(env(safe-area-inset-bottom) + 72px)) !important;
      }

      html body #inventoryPanel.open:not([data-inventory-category="skills"]) #inventoryHelp {
        grid-column: 1 / -1 !important;
        align-self: end !important;
        margin: 0 !important;
        padding: 8px 6px max(8px, env(safe-area-inset-bottom)) !important;
        border-top: 1px solid rgba(255,216,107,0.16) !important;
        background: linear-gradient(180deg, rgba(20,13,9,0), rgba(20,13,9,0.96) 24%) !important;
        font-size: 12px !important;
        line-height: 1.25 !important;
        text-align: center !important;
      }
    }

    @media (orientation: portrait) and (hover: none),
           (orientation: portrait) and (max-width: 900px),
           (max-width: 700px) {
      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] {
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        padding-bottom: max(96px, calc(env(safe-area-inset-bottom) + 72px)) !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] #inventoryList,
      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory {
        min-height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        padding-bottom: 18px !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionColumns,
      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionSummary {
        display: block !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeGrid,
      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeGrid.compact {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto !important;
        gap: 6px 10px !important;
        align-items: start !important;
        min-height: 92px !important;
        padding: 10px !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow > div,
      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRowText {
        min-width: 0 !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow strong,
      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow strong {
        font-size: 14px !important;
        line-height: 1.12 !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow small,
      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow small,
      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow span {
        display: block !important;
        margin-top: 3px !important;
        font-size: 12px !important;
        line-height: 1.28 !important;
        white-space: normal !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .attributeRow > span {
        align-self: center !important;
        padding-left: 8px !important;
        font-size: 13px !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spendPointBtn {
        min-width: 48px !important;
        width: fit-content !important;
        min-height: 48px !important;
        margin-top: 7px !important;
        padding: 10px 12px !important;
        font-size: 12px !important;
        line-height: 1 !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .skillRow {
        min-height: 96px !important;
        padding: 10px !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .progressionSection {
        margin-bottom: 9px !important;
        padding: 9px !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spawnAllocationHero {
        grid-template-columns: 1fr 1fr !important;
        gap: 7px !important;
      }

      html body.inventorySkillsMobileLayout #inventoryPanel.open[data-inventory-category="skills"] .spawnClassCard {
        grid-column: 1 / -1 !important;
      }
    }
  `;

  function injectStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
    }
    if (style.textContent !== CSS) style.textContent = CSS;
    if (document.head && document.head.lastElementChild !== style) document.head.appendChild(style);
  }

  function markInventoryHintAsDecorative() {
    const inventory = document.getElementById("inventoryPanel");
    if (!inventory) return;
    inventory.querySelectorAll(":scope > .inventoryScrollHint").forEach(hint => {
      hint.setAttribute("aria-hidden", "true");
    });
  }

  let scheduled = false;
  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      injectStyles();
      markInventoryHintAsDecorative();
    });
  }

  function install() {
    injectStyles();
    markInventoryHintAsDecorative();
    if (document.head) {
      const headObserver = new MutationObserver(scheduleRefresh);
      headObserver.observe(document.head, { childList: true });
    }
    const inventory = document.getElementById("inventoryPanel");
    if (inventory) {
      const inventoryObserver = new MutationObserver(scheduleRefresh);
      inventoryObserver.observe(inventory, { childList: true, subtree: false, attributes: true, attributeFilter: ["class", "data-inventory-category"] });
    }
    window.addEventListener("resize", scheduleRefresh);
    window.addEventListener("orientationchange", () => setTimeout(scheduleRefresh, 80));
    window.addEventListener("load", () => {
      scheduleRefresh();
      setTimeout(scheduleRefresh, 120);
      setTimeout(scheduleRefresh, 420);
      setTimeout(scheduleRefresh, 900);
    }, { once: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();