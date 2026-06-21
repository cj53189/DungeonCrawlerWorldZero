// Mobile Settings + Workshop layout hardening.
// Uses the same philosophy as the mobile Skills layout: one reliable vertical page
// on phones instead of nested scroll boxes that fight button/touch handling.
(function installMobileSettingsWorkshop() {
  if (window.__dcwMobileSettingsWorkshopInstalled) return;
  window.__dcwMobileSettingsWorkshopInstalled = true;

  const STYLE_ID = "mobileSettingsWorkshopStyles";
  const WORKSHOP_ID = "settingsWorkshopSection";

  function injectWorkshopSection() {
    const body = document.querySelector("#settingsPanel .settingsBody");
    if (!body || document.getElementById(WORKSHOP_ID)) return;

    const section = document.createElement("section");
    section.id = WORKSHOP_ID;
    section.className = "settingsSection settingsWorkshopSection";
    section.innerHTML = `
      <h3>Workshop</h3>
      <div class="settingsWorkshopIntro">Advanced layout tools for testing mobile and controller UI.</div>
      <div id="workshopScaleReadout" class="workshopScaleReadout">UI Scale: 100%</div>
      <div class="settingsWorkshopGrid" role="group" aria-label="Workshop controls">
        <button id="workshopUiEditBtn" class="settingsAction workshopAction" type="button">UI Edit Mode: Off</button>
        <button id="workshopResetLayoutBtn" class="settingsAction workshopAction" type="button">Reset UI Layout</button>
        <button id="workshopScaleDownBtn" class="settingsAction workshopAction" type="button">UI Scale -</button>
        <button id="workshopScaleUpBtn" class="settingsAction workshopAction" type="button">UI Scale +</button>
      </div>
      <div class="settingsWorkshopContent" aria-label="Workshop help">
        <div><strong>UI Edit Mode</strong><span>Turn this on, then drag HUD, inventory, recap, log, and minimap boxes to test layouts.</span></div>
        <div><strong>Mobile rule</strong><span>Portrait and landscape should use large controls, clear labels, and reachable close buttons.</span></div>
        <div><strong>Scroll rule</strong><span>Settings and workshop content use the whole panel as the scroll page on phones.</span></div>
      </div>
    `;

    const danger = body.querySelector(".dangerSection");
    if (danger) body.insertBefore(section, danger);
    else body.appendChild(section);
  }

  function markDuplicateMobileControls() {
    const duplicateControls = [
      document.getElementById("uiEditToggle")?.closest(".settingsRow"),
      document.getElementById("uiScaleSlider")?.closest(".settingsRow"),
      document.getElementById("resetUiLayoutBtn")
    ].filter(Boolean);
    duplicateControls.forEach(el => el.classList.add("settingsWorkshopDuplicateMobile"));
  }

  function syncWorkshopButtons() {
    const editBtn = document.getElementById("workshopUiEditBtn");
    const readout = document.getElementById("workshopScaleReadout");
    const slider = document.getElementById("uiScaleSlider");
    if (editBtn) editBtn.textContent = document.body.classList.contains("uiEditMode") ? "UI Edit Mode: On" : "UI Edit Mode: Off";
    if (readout && slider) readout.textContent = `UI Scale: ${slider.value || "100"}%`;
  }

  function bindWorkshopButtons() {
    const editBtn = document.getElementById("workshopUiEditBtn");
    const resetBtn = document.getElementById("workshopResetLayoutBtn");
    const downBtn = document.getElementById("workshopScaleDownBtn");
    const upBtn = document.getElementById("workshopScaleUpBtn");

    if (editBtn && editBtn.dataset.bound !== "true") {
      editBtn.dataset.bound = "true";
      editBtn.addEventListener("click", () => {
        const toggle = document.getElementById("uiEditToggle");
        if (toggle) toggle.click();
        syncWorkshopButtons();
      });
    }
    if (resetBtn && resetBtn.dataset.bound !== "true") {
      resetBtn.dataset.bound = "true";
      resetBtn.addEventListener("click", () => document.getElementById("resetUiLayoutBtn")?.click());
    }
    if (downBtn && downBtn.dataset.bound !== "true") {
      downBtn.dataset.bound = "true";
      downBtn.addEventListener("click", () => {
        const slider = document.getElementById("uiScaleSlider");
        if (!slider) return;
        const step = Number(slider.step) || 5;
        slider.value = String(Math.max(Number(slider.min) || 75, Number(slider.value || 100) - step));
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        syncWorkshopButtons();
      });
    }
    if (upBtn && upBtn.dataset.bound !== "true") {
      upBtn.dataset.bound = "true";
      upBtn.addEventListener("click", () => {
        const slider = document.getElementById("uiScaleSlider");
        if (!slider) return;
        const step = Number(slider.step) || 5;
        slider.value = String(Math.min(Number(slider.max) || 125, Number(slider.value || 100) + step));
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        syncWorkshopButtons();
      });
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .settingsWorkshopIntro {
        color: #cdbf9e;
        font-size: 12px;
        line-height: 1.35;
        margin-bottom: 8px;
      }

      .workshopScaleReadout {
        margin-bottom: 8px;
        padding: 7px 9px;
        border: 1px solid rgba(255,216,107,0.16);
        border-radius: 999px;
        background: rgba(0,0,0,0.22);
        color: #ffd86b;
        font-size: 12px;
        font-weight: 900;
        text-align: center;
      }

      .settingsWorkshopGrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
      }

      .settingsWorkshopContent {
        display: grid;
        gap: 7px;
        margin-top: 10px;
        max-height: 220px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        touch-action: pan-y;
        padding-right: 4px;
      }

      .settingsWorkshopContent div {
        border: 1px solid rgba(255,216,107,0.14);
        border-radius: 10px;
        background: rgba(0,0,0,0.22);
        padding: 8px;
      }

      .settingsWorkshopContent strong,
      .settingsWorkshopContent span {
        display: block;
      }

      .settingsWorkshopContent strong {
        color: #ffd86b;
        margin-bottom: 3px;
      }

      .settingsWorkshopContent span {
        color: #dfd2b8;
        line-height: 1.32;
      }

      @media (hover: none) and (pointer: coarse), (max-width: 900px) {
        body.settingsMobileLayout #settingsOverlay.open {
          align-items: stretch !important;
          justify-content: stretch !important;
          padding: 0 !important;
          overflow: hidden !important;
          touch-action: none !important;
        }

        body.settingsMobileLayout #settingsPanel {
          display: block !important;
          position: fixed !important;
          inset: var(--dcw-safe-top, max(10px, env(safe-area-inset-top))) var(--dcw-safe-right, max(10px, env(safe-area-inset-right))) var(--dcw-safe-bottom, max(10px, env(safe-area-inset-bottom))) var(--dcw-safe-left, max(10px, env(safe-area-inset-left))) !important;
          width: auto !important;
          height: auto !important;
          min-height: 0 !important;
          max-width: none !important;
          max-height: none !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior: contain !important;
          touch-action: pan-y !important;
          padding: calc(var(--dcw-touch-preferred, 56px) + 10px) 14px max(76px, env(safe-area-inset-bottom)) !important;
          scroll-padding-top: calc(var(--dcw-touch-preferred, 56px) + 16px) !important;
        }

        body.settingsMobileLayout #settingsPanel,
        body.settingsMobileLayout #settingsPanel *,
        body.settingsMobileLayout .settingsBody,
        body.settingsMobileLayout .settingsWorkshopContent {
          touch-action: pan-y !important;
        }

        body.settingsMobileLayout #settingsPanel .panelClose,
        body.settingsMobileLayout #closeSettingsBtn {
          position: fixed !important;
          top: var(--dcw-safe-top, max(10px, env(safe-area-inset-top))) !important;
          right: var(--dcw-safe-right, max(10px, env(safe-area-inset-right))) !important;
          z-index: 370 !important;
        }

        body.settingsMobileLayout #settingsPanel .settingsHeader {
          position: sticky !important;
          top: 0 !important;
          z-index: 4 !important;
          min-height: 42px !important;
          margin: -2px 64px 10px 0 !important;
          padding: 4px 0 8px !important;
          background: linear-gradient(180deg, rgba(20,13,9,0.98), rgba(20,13,9,0.88) 78%, rgba(20,13,9,0)) !important;
        }

        body.settingsMobileLayout #settingsPanel h2 {
          margin: 0 !important;
          min-height: 42px !important;
          display: flex !important;
          align-items: center !important;
        }

        body.settingsMobileLayout #settingsPanel .settingsBody {
          display: block !important;
          height: auto !important;
          min-height: auto !important;
          max-height: none !important;
          overflow: visible !important;
          padding: 0 !important;
        }

        body.settingsMobileLayout #settingsPanel .settingsSection {
          margin-top: 10px !important;
          padding: 10px !important;
        }

        body.settingsMobileLayout #settingsPanel .settingsWorkshopDuplicateMobile {
          display: none !important;
        }

        body.settingsMobileLayout #settingsPanel .settingsRow {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 10px !important;
          min-height: 56px !important;
          align-items: center !important;
        }

        body.settingsMobileLayout #settingsPanel .settingsSliderRow {
          grid-template-columns: 1fr !important;
        }

        body.settingsMobileLayout #settingsPanel input[type="range"] {
          width: 100% !important;
          min-height: 48px !important;
        }

        body.settingsMobileLayout #settingsPanel .settingsToggle,
        body.settingsMobileLayout #settingsPanel .settingsAction,
        body.settingsMobileLayout #settingsPanel .workshopAction {
          min-height: 52px !important;
          font-size: 13px !important;
          white-space: normal !important;
        }

        body.settingsMobileLayout .settingsWorkshopGrid {
          grid-template-columns: 1fr 1fr !important;
          gap: 8px !important;
        }

        body.settingsMobileLayout .settingsWorkshopContent {
          max-height: none !important;
          overflow: visible !important;
          padding-right: 0 !important;
        }

        body.settingsMobileLayout #settingsPanel .settingsFooter {
          position: sticky !important;
          bottom: calc(-1 * max(76px, env(safe-area-inset-bottom))) !important;
          z-index: 5 !important;
          margin: 14px -14px calc(-1 * max(76px, env(safe-area-inset-bottom))) !important;
          padding: 12px 14px max(14px, env(safe-area-inset-bottom)) !important;
          background: linear-gradient(180deg, rgba(20,13,9,0), rgba(20,13,9,0.98) 22%) !important;
        }

        body.settingsMobileLayout #settingsDoneBtn {
          width: 100% !important;
          min-height: 56px !important;
          font-size: 15px !important;
        }
      }

      @media (orientation: landscape) and (hover: none) and (max-height: 520px),
             (orientation: landscape) and (max-height: 520px) {
        body.settingsMobileLayout #settingsPanel {
          padding-top: calc(var(--dcw-touch-preferred, 56px) + 6px) !important;
        }

        body.settingsMobileLayout #settingsPanel .settingsSection {
          margin-top: 8px !important;
        }

        body.settingsMobileLayout #settingsPanel .settingsRow {
          min-height: 48px !important;
        }

        body.settingsMobileLayout .settingsWorkshopGrid {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isSettingsOpenNow() {
    return document.getElementById("settingsOverlay")?.classList.contains("open") === true;
  }

  function syncSettingsLayoutState() {
    const panel = document.getElementById("settingsPanel");
    const open = isSettingsOpenNow();
    document.body.classList.toggle("settingsMobileLayout", open);
    if (!panel || !open) return;
    panel.style.overflowY = "auto";
    panel.style.webkitOverflowScrolling = "touch";
    panel.style.touchAction = "pan-y";
    syncWorkshopButtons();
  }

  function patchSettingsPanelHooks() {
    for (const name of ["openSettingsPanel", "closeSettingsPanel", "syncSettingsControls", "setUiEditMode", "setUiScale"]) {
      const original = window[name];
      if (typeof original !== "function" || original.__mobileSettingsWorkshopWrapped) continue;
      const wrapped = function mobileSettingsWorkshopWrapped(...args) {
        const result = original.apply(this, args);
        setTimeout(syncSettingsLayoutState, 0);
        setTimeout(syncWorkshopButtons, 0);
        return result;
      };
      wrapped.__mobileSettingsWorkshopWrapped = true;
      window[name] = wrapped;
      try { eval(`${name} = window[name]`); } catch {}
    }

    const originalScrollSettings = window.scrollSettingsPanel || (typeof scrollSettingsPanel === "function" ? scrollSettingsPanel : null);
    if (typeof originalScrollSettings === "function" && !originalScrollSettings.__mobileSettingsWorkshopWrapped) {
      const wrappedScroll = function mobileSettingsScroll(deltaY) {
        const panel = document.getElementById("settingsPanel");
        if (document.body.classList.contains("settingsMobileLayout") && panel) {
          panel.scrollTop += deltaY;
          return true;
        }
        return originalScrollSettings(deltaY);
      };
      wrappedScroll.__mobileSettingsWorkshopWrapped = true;
      window.scrollSettingsPanel = wrappedScroll;
      try { scrollSettingsPanel = wrappedScroll; } catch {}
    }
  }

  function bindSettingsDragFallback() {
    let drag = null;
    const panelFromEvent = event => event.target?.closest?.("#settingsOverlay.open #settingsPanel") || null;

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
    injectWorkshopSection();
    markDuplicateMobileControls();
    injectStyles();
    bindWorkshopButtons();
    patchSettingsPanelHooks();
    bindSettingsDragFallback();
    syncSettingsLayoutState();
    window.addEventListener("resize", () => setTimeout(syncSettingsLayoutState, 0));
    window.addEventListener("orientationchange", () => setTimeout(syncSettingsLayoutState, 80));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
