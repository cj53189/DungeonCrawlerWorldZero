// Floor 3 race/class selection shell.
// Reads generated offers, forces one race + one class selection, then stores the result.
(function installFloor3SelectionUi() {
  if (window.__dcwFloor3SelectionUiInstalled) return;
  window.__dcwFloor3SelectionUiInstalled = true;

  const MODAL_ID = "floor3SelectionOverlay";
  const STYLE_ID = "floor3SelectionStyles";
  let selectedRaceId = null;
  let selectedClassId = null;
  let modalOpen = false;

  function esc(value) {
    return typeof escapeHtml === "function"
      ? escapeHtml(value)
      : String(value ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  }

  function activeFloor() { return typeof currentFloor !== "undefined" ? Number(currentFloor) : 0; }
  function progression() { return typeof player !== "undefined" ? player?.progression : null; }
  function hasCompletedSelection() {
    const p = progression();
    return !!(p?.raceId && p?.classId && p?.floor3ChoiceComplete);
  }

  function selectionShouldOpen() {
    const p = progression();
    if (!p || activeFloor() < 3 || hasCompletedSelection()) return false;
    if (typeof getFloor3OfferSet !== "function") return false;
    return !!getFloor3OfferSet({ force: !p.floor3Offers });
  }

  function sourceLabel(source) {
    return ({ origin: "Origin", behavior: "Behavior", wildcard: "Wildcard", fallback: "Fallback" }[source] || "Offer");
  }

  function toTitleCase(id) {
    return String(id || "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, ch => ch.toUpperCase());
  }

  function behaviorLabel(id) {
    const tags = progression()?.behaviorProfile?.tags || [];
    const match = tags.find(tag => (typeof tag === "string" ? tag : tag?.id) === id);
    if (match && typeof match !== "string" && match.label) return match.label;
    return toTitleCase(id);
  }

  function behaviorSummary(offers) {
    const labels = (offers?.behaviorTagIds || []).map(behaviorLabel).filter(Boolean);
    return labels.length ? labels.join(", ") : "Insufficient Evidence";
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.floor3SelectionOpen {
        overflow: hidden !important;
        touch-action: pan-y !important;
      }
      body.floor3SelectionOpen #touchControls,
      body.floor3SelectionOpen #prompt {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      #floor3SelectionOverlay {
        position: fixed;
        inset: 0;
        z-index: 420;
        display: none;
        width: 100%;
        max-width: 100vw;
        height: 100dvh;
        max-height: 100dvh;
        overflow-x: hidden;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
        touch-action: pan-y;
        box-sizing: border-box;
        padding: max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
        background: radial-gradient(circle at 50% 18%, rgba(124,247,255,0.16), rgba(0,0,0,0.84) 48%, rgba(0,0,0,0.92));
        backdrop-filter: blur(3px);
        color: #f8f1df;
        pointer-events: auto;
      }
      #floor3SelectionOverlay.open {
        display: block;
      }
      #floor3SelectionOverlay,
      #floor3SelectionOverlay * {
        box-sizing: border-box;
      }
      .floor3Panel {
        width: min(1080px, calc(100vw - 28px));
        max-height: none;
        min-width: 0;
        margin: 0 auto;
        overflow-x: hidden;
        border: 2px solid rgba(255,216,107,0.72);
        border-radius: 20px;
        background: linear-gradient(145deg, rgba(14,10,8,0.98), rgba(33,22,14,0.98) 52%, rgba(10,9,12,0.98));
        box-shadow: 0 0 0 1px rgba(255,244,170,0.12) inset, 0 28px 80px rgba(0,0,0,0.75), 0 0 36px rgba(124,247,255,0.18);
        padding: 18px;
      }
      .floor3Eyebrow { color: #7cf7ff; font-size: 11px; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 5px; }
      .floor3Header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: start; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,216,107,0.22); }
      .floor3Header h2 { margin: 0; color: #ffd86b; font-size: clamp(24px, 4vw, 42px); line-height: 0.95; letter-spacing: 0.04em; text-transform: uppercase; }
      .floor3Header p { margin: 8px 0 0; max-width: 780px; color: rgba(248,241,223,0.78); line-height: 1.38; font-size: 13px; }
      .floor3StatusCard { min-width: 220px; border-radius: 14px; border: 1px solid rgba(124,247,255,0.24); background: rgba(124,247,255,0.07); padding: 10px 12px; text-align: right; }
      .floor3StatusCard span { display: block; color: rgba(248,241,223,0.6); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; }
      .floor3StatusCard strong { display: block; margin-top: 3px; color: #effcff; font-size: 16px; }
      .floor3JudgmentLines { display: grid; gap: 6px; margin: 0 0 12px; }
      .floor3JudgmentLine { border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; background: rgba(0,0,0,0.18); padding: 8px 10px; color: rgba(248,241,223,0.76); font-size: 12px; line-height: 1.3; }
      .floor3ChoiceGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .floor3ChoiceColumn { min-width: 0; border: 1px solid rgba(255,216,107,0.22); border-radius: 16px; background: rgba(0,0,0,0.20); padding: 12px; }
      .floor3ChoiceColumn h3 { margin: 0 0 10px; color: #ffdf91; font-size: 14px; text-transform: uppercase; letter-spacing: 0.14em; }
      .floor3OptionList { display: grid; gap: 9px; }
      .floor3Option { width: 100%; min-height: 82px; text-align: left; border-radius: 13px; border: 1px solid rgba(255,255,255,0.14); background: linear-gradient(135deg, rgba(255,255,255,0.065), rgba(0,0,0,0.18)); color: #f8f1df; padding: 10px; cursor: pointer; box-shadow: inset 0 0 20px rgba(0,0,0,0.22); touch-action: manipulation; }
      .floor3Option:hover { filter: brightness(1.14); }
      .floor3Option.selected { border-color: rgba(124,247,255,0.9); box-shadow: 0 0 0 2px rgba(124,247,255,0.14), 0 0 20px rgba(124,247,255,0.2), inset 0 0 20px rgba(124,247,255,0.08); background: linear-gradient(135deg, rgba(124,247,255,0.16), rgba(255,216,107,0.10)); }
      .floor3OptionTop { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .floor3Option strong { color: #fff3c4; font-size: 15px; line-height: 1.1; }
      .floor3Source { flex: 0 0 auto; color: #7cf7ff; border: 1px solid rgba(124,247,255,0.26); border-radius: 999px; padding: 3px 7px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; background: rgba(124,247,255,0.07); }
      .floor3Option p { margin: 7px 0 0; color: rgba(248,241,223,0.72); font-size: 12px; line-height: 1.28; }
      .floor3Footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,216,107,0.22); }
      .floor3SelectionSummary { color: rgba(248,241,223,0.76); font-size: 12px; line-height: 1.35; }
      .floor3ConfirmBtn { min-width: 210px; min-height: 46px; border: 1px solid rgba(255,244,170,0.88); border-radius: 999px; background: linear-gradient(135deg, #ffd86b, #f0a645); color: #201306; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; touch-action: manipulation; }
      .floor3ConfirmBtn:disabled { cursor: not-allowed; opacity: 0.48; filter: grayscale(0.6); }
      @media (min-width: 821px) and (hover: hover) {
        #floor3SelectionOverlay.open { display: flex; align-items: center; justify-content: center; }
        .floor3Panel { max-height: min(88vh, 820px); overflow-y: auto; }
      }
      @media (max-width: 820px), (hover:none) and (pointer:coarse) {
        #floor3SelectionOverlay {
          height: 100dvh;
          max-height: 100dvh;
          padding:
            calc(8px + env(safe-area-inset-top))
            calc(8px + env(safe-area-inset-right))
            calc(22px + env(safe-area-inset-bottom))
            calc(8px + env(safe-area-inset-left));
        }
        .floor3Panel {
          width: min(100%, 430px);
          max-width: calc(100dvw - 16px);
          margin: 0 auto 18px;
          padding: 10px;
          border-radius: 14px;
        }
        .floor3Eyebrow { font-size: 10px; letter-spacing: 0.14em; margin-bottom: 4px; }
        .floor3Header { grid-template-columns: 1fr; gap: 7px; padding-bottom: 8px; margin-bottom: 8px; }
        .floor3Header h2 { font-size: clamp(23px, 7.1vw, 31px); line-height: 1; letter-spacing: 0.025em; }
        .floor3Header p { margin-top: 6px; font-size: 12px; line-height: 1.32; }
        .floor3StatusCard { text-align: left; min-width: 0; padding: 8px 10px; border-radius: 12px; }
        .floor3StatusCard span { font-size: 9px; letter-spacing: 0.11em; }
        .floor3StatusCard strong { font-size: 14px; line-height: 1.15; }
        .floor3JudgmentLines { gap: 6px; margin-bottom: 10px; }
        .floor3JudgmentLine { padding: 7px 8px; font-size: 11px; line-height: 1.25; }
        .floor3ChoiceGrid { grid-template-columns: 1fr; gap: 10px; }
        .floor3ChoiceColumn { padding: 10px; border-radius: 14px; }
        .floor3ChoiceColumn h3 { margin-bottom: 8px; font-size: 13px; letter-spacing: 0.12em; }
        .floor3OptionList { gap: 8px; }
        .floor3Option { min-height: 68px; padding: 9px; border-radius: 12px; }
        .floor3Option strong { font-size: 14px; }
        .floor3Option p { margin-top: 6px; font-size: 11px; line-height: 1.25; }
        .floor3Source { padding: 3px 6px; font-size: 8px; letter-spacing: 0.07em; }
        .floor3Footer { flex-direction: column; align-items: stretch; gap: 9px; margin-top: 10px; padding-top: 10px; }
        .floor3SelectionSummary { font-size: 11px; }
        .floor3ConfirmBtn { width: 100%; min-width: 0; min-height: 44px; font-size: 12px; }
      }
      @media (max-width: 390px) {
        .floor3Panel { padding: 9px; }
        .floor3Header h2 { font-size: clamp(21px, 6.9vw, 28px); }
        .floor3Header p,
        .floor3Option p,
        .floor3JudgmentLine { font-size: 10px; }
        .floor3Option { min-height: 62px; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderOptions(kind, offers) {
    const selectedId = kind === "race" ? selectedRaceId : selectedClassId;
    return (offers || []).map(item => `<button class="floor3Option ${selectedId === item.id ? "selected" : ""}" type="button" data-floor3-${kind}="${esc(item.id)}" aria-pressed="${selectedId === item.id}"><div class="floor3OptionTop"><strong>${esc(item.name)}</strong><span class="floor3Source">${esc(sourceLabel(item.source))}</span></div><p>${esc(item.tone || item.reason || "The dungeon has declined to explain itself.")}</p></button>`).join("");
  }

  function findOffer(offers, id) {
    return (offers || []).find(item => item.id === id) || null;
  }

  function renderModal() {
    const offers = typeof getFloor3OfferSet === "function" ? getFloor3OfferSet({ force: !progression()?.floor3Offers }) : null;
    if (!offers) return;
    const overlay = ensureModal();
    const selectedRace = findOffer(offers.races, selectedRaceId);
    const selectedClass = findOffer(offers.classes, selectedClassId);
    const lines = (offers.lines || []).slice(0, 3).map(line => `<div class="floor3JudgmentLine">${esc(line)}</div>`).join("");
    overlay.innerHTML = `<div class="floor3Panel" role="dialog" aria-modal="true" aria-labelledby="floor3SelectionTitle"><div class="floor3Header"><div><div class="floor3Eyebrow">System Classification</div><h2 id="floor3SelectionTitle">Your application has been reviewed.</h2><p>The crawl has observed your origin, your behavior, and a few choices we are legally not calling mistakes. Choose one race and one class. This is where your build becomes official.</p></div><div class="floor3StatusCard"><span>Origin Read</span><strong>${esc(offers.originName || "Unsorted Crawler")}</strong><span style="margin-top:8px">Behavior</span><strong>${esc(behaviorSummary(offers))}</strong></div></div><div class="floor3JudgmentLines">${lines}</div><div class="floor3ChoiceGrid"><section class="floor3ChoiceColumn"><h3>Choose Race</h3><div class="floor3OptionList">${renderOptions("race", offers.races)}</div></section><section class="floor3ChoiceColumn"><h3>Choose Class</h3><div class="floor3OptionList">${renderOptions("class", offers.classes)}</div></section></div><div class="floor3Footer"><div class="floor3SelectionSummary"><strong>Selected:</strong> ${esc(selectedRace?.name || "No race")} / ${esc(selectedClass?.name || "No class")}<br><span>Actual stat effects come next. This shell only saves the selection.</span></div><button class="floor3ConfirmBtn" type="button" data-floor3-confirm ${selectedRace && selectedClass ? "" : "disabled"}>Confirm Classification</button></div></div>`;
  }

  function ensureModal() {
    injectStyles();
    let overlay = document.getElementById(MODAL_ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = MODAL_ID;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", event => {
        const raceButton = event.target.closest?.("[data-floor3-race]");
        const classButton = event.target.closest?.("[data-floor3-class]");
        const confirmButton = event.target.closest?.("[data-floor3-confirm]");
        if (raceButton) { selectedRaceId = raceButton.dataset.floor3Race; renderModal(); return; }
        if (classButton) { selectedClassId = classButton.dataset.floor3Class; renderModal(); return; }
        if (confirmButton && !confirmButton.disabled) confirmFloor3Selection();
      });
      overlay.addEventListener("touchmove", event => {
        // The mobile input layer prevents page touchmove by default.
        // Keep the event inside this overlay so iOS can scroll the classification panel.
        event.stopPropagation();
      }, { passive: true });
      overlay.addEventListener("wheel", event => {
        event.stopPropagation();
      }, { passive: true });
      overlay.addEventListener("keydown", event => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
        }
      });
    }
    return overlay;
  }

  function openFloor3SelectionModal(options = {}) {
    if (!options.force && !selectionShouldOpen()) return false;
    const offers = typeof getFloor3OfferSet === "function" ? getFloor3OfferSet({ force: !progression()?.floor3Offers }) : null;
    if (!offers) return false;
    selectedRaceId = selectedRaceId || offers.races?.[0]?.id || null;
    selectedClassId = selectedClassId || offers.classes?.[0]?.id || null;
    renderModal();
    const overlay = ensureModal();
    overlay.classList.add("open");
    overlay.scrollTop = 0;
    modalOpen = true;
    document.body.classList.add("floor3SelectionOpen");
    if (typeof resetTransientInputState === "function") resetTransientInputState();
    setTimeout(() => overlay.querySelector(".floor3Option")?.focus?.({ preventScroll: true }), 0);
    return true;
  }

  function closeFloor3SelectionModal() {
    const overlay = document.getElementById(MODAL_ID);
    if (overlay) overlay.classList.remove("open");
    modalOpen = false;
    document.body.classList.remove("floor3SelectionOpen");
    if (typeof resetTransientInputState === "function") resetTransientInputState();
  }

  function confirmFloor3Selection() {
    const p = progression();
    const offers = typeof getFloor3OfferSet === "function" ? getFloor3OfferSet() : null;
    if (!p || !offers) return false;
    const race = findOffer(offers.races, selectedRaceId);
    const chosenClass = findOffer(offers.classes, selectedClassId);
    if (!race || !chosenClass) return false;

    p.raceId = race.id;
    p.raceName = race.name;
    p.raceTone = race.tone || "";
    p.classId = chosenClass.id;
    p.className = chosenClass.name;
    p.classTone = chosenClass.tone || "";
    p.floor3ChoiceComplete = true;
    p.floor3ChoiceSelectedAtFloor = activeFloor();
    p.floor3ChoiceSelectedAt = Date.now();

    closeFloor3SelectionModal();
    if (typeof achievement === "function") achievement("CLASSIFICATION COMPLETE", `${race.name} ${chosenClass.name}. The dungeon has updated your file and several departments are already concerned.`, `floor3_choice_${race.id}_${chosenClass.id}`);
    if (typeof updateHUD === "function") updateHUD();
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof saveCrawlerRunCheckpoint === "function") saveCrawlerRunCheckpoint("floor3_classification_selected");
    return true;
  }

  function maybeOpenFloor3Selection() {
    if (modalOpen || !selectionShouldOpen()) return false;
    return openFloor3SelectionModal();
  }

  function wrap(name, wrapper) {
    const original = globalThis[name];
    if (typeof original !== "function" || original.__floor3SelectionWrapped) return false;
    const wrapped = wrapper(original);
    wrapped.__floor3SelectionWrapped = true;
    globalThis[name] = wrapped;
    return true;
  }

  function installHooks() {
    injectStyles();
    wrap("advanceToNextFloor", original => function advanceToNextFloorWithFloor3Selection() {
      const result = original.apply(this, arguments);
      setTimeout(maybeOpenFloor3Selection, 80);
      return result;
    });
    wrap("restorePersistentCrawlerRun", original => function restorePersistentCrawlerRunWithFloor3Selection() {
      const result = original.apply(this, arguments);
      setTimeout(maybeOpenFloor3Selection, 120);
      return result;
    });
    wrap("resetState", original => function resetStateWithFloor3Selection() {
      const result = original.apply(this, arguments);
      setTimeout(maybeOpenFloor3Selection, 120);
      return result;
    });
    wrap("isGameplayUpdatePaused", original => function isGameplayUpdatePausedWithFloor3Selection() {
      return modalOpen || document.body.classList.contains("floor3SelectionOpen") || original.apply(this, arguments);
    });
    maybeOpenFloor3Selection();
  }

  globalThis.openFloor3SelectionModal = openFloor3SelectionModal;
  globalThis.maybeOpenFloor3Selection = maybeOpenFloor3Selection;
  globalThis.confirmFloor3Selection = confirmFloor3Selection;
  globalThis.isFloor3SelectionOpen = () => modalOpen;

  let attempts = 0;
  const retry = () => {
    attempts++;
    installHooks();
    if (attempts < 12) setTimeout(retry, 250);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
})();
