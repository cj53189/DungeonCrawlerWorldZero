(function installSpawnAllocationUi() {
  if (window.__dcwSpawnAllocationUiInstalled) return;
  window.__dcwSpawnAllocationUiInstalled = true;
  let spawnAllocationClickBound = false;

  function esc(value) {
    return typeof escapeHtml === "function"
      ? escapeHtml(value)
      : String(value).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  }

  function pointSummary() {
    return typeof progressionPointSummary === "function"
      ? progressionPointSummary()
      : {
        attributePoints: Math.max(0, Number(player?.progression?.unspentAttributePoints) || 0),
        skillPoints: Math.max(0, Number(player?.progression?.unspentSkillPoints) || 0)
      };
  }

  function currentOriginName() {
    if (typeof getOriginProfile === "function") return getOriginProfile();
    return typeof getTemporaryClass === "function" ? getTemporaryClass() : (player?.progression?.originProfile || player?.progression?.temporaryClass || "Unsorted Crawler");
  }

  function currentOriginDescription() {
    if (typeof getOriginProfileDescription === "function") return getOriginProfileDescription();
    return typeof getTemporaryClassDescription === "function" ? getTemporaryClassDescription() : (player?.progression?.originProfileDescription || player?.progression?.temporaryClassDescription || "The crawl has not formed a strong opinion yet.");
  }

  function canSpendAttr(attr) {
    if (!attr) return false;
    if (typeof canSpendAttributePoint === "function") return canSpendAttributePoint(attr.id);
    return pointSummary().attributePoints > 0;
  }

  function injectSpawnAllocationStyles() {
    if (document.getElementById("spawnAllocationStyles")) return;
    const style = document.createElement("style");
    style.id = "spawnAllocationStyles";
    style.textContent = `
      .spawnAllocationHero {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) repeat(2, minmax(84px, 0.5fr));
        gap: 10px;
        margin: 8px 0 10px;
        padding: 10px;
        border: 1px solid rgba(124,247,255,0.22);
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(28,36,60,0.92), rgba(20,20,30,0.92));
      }
      .spawnClassCard small { display:block; margin-bottom:3px; color:rgba(255,216,107,0.86); font-size:10px; text-transform:uppercase; letter-spacing:.08em; }
      .spawnClassCard strong { display:block; font-size: 16px; color: #effcff; }
      .spawnClassCard span { display:block; margin-top: 3px; color: rgba(239,252,255,0.72); font-size: 11px; line-height: 1.35; }
      .spawnPointCard { text-align:center; align-self:stretch; display:grid; align-content:center; border-radius:10px; background:rgba(255,255,255,0.055); }
      .spawnPointCard span { display:block; color:rgba(239,252,255,0.68); font-size:10px; text-transform:uppercase; letter-spacing:.08em; }
      .spawnPointCard strong { display:block; color:#ffd86b; font-size:20px; }
      .attributeRow.spendable, .skillRow.spendable, .attributeCard.spendable { border-color: rgba(255,216,107,0.44); }
      .attributeRow.spendable, .skillRow.spendable { cursor: default; }
      .spendPointBtn {
        margin-top: 7px;
        min-height: 32px;
        border-radius: 9px;
        border: 1px solid rgba(255,216,107,0.46);
        background: rgba(255,216,107,0.12);
        color: #ffe9a8;
        font-weight: 800;
      }
      .spendPointBtn:disabled { opacity: .42; filter: grayscale(0.5); }
      .spawnAllocationNote { color: rgba(239,252,255,0.7); font-size: 11px; line-height: 1.35; margin-top: 8px; }
      @media (min-width: 901px) and (hover: hover) {
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] {
          grid-template-columns: 1fr !important;
          grid-template-rows: auto minmax(0, 1fr) auto !important;
          column-gap: 0 !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] #equipmentStats {
          display: none !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] #inventoryList {
          max-height: calc(min(82vh, 760px) - 86px) !important;
          overflow-y: auto !important;
          padding-right: 10px !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .inventoryTabs {
          align-items: center !important;
          margin-bottom: 12px !important;
          padding-bottom: 10px !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .inventoryContentTitle {
          margin: 0 0 10px 2px !important;
          font-size: 13px !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .progressionInventory {
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
          min-height: 0 !important;
          padding-bottom: 4px !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .spawnAllocationNote {
          margin: 2px 0 0 !important;
          max-width: 980px !important;
          font-size: 12px !important;
          line-height: 1.45 !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .spawnAllocationHero {
          grid-template-columns: minmax(420px, 1fr) 132px 132px !important;
          align-items: stretch !important;
          gap: 12px !important;
          margin: 0 !important;
          padding: 12px !important;
          border-radius: 14px !important;
          background: linear-gradient(135deg, rgba(32,40,66,0.92), rgba(22,18,14,0.92)) !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .spawnClassCard strong {
          font-size: 20px !important;
          line-height: 1.1 !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .spawnClassCard span {
          max-width: 760px !important;
          font-size: 12px !important;
          line-height: 1.35 !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .spawnPointCard {
          min-height: 76px !important;
          padding: 8px !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .spawnPointCard strong {
          font-size: 26px !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .progressionColumns {
          display: grid !important;
          grid-template-columns: minmax(310px, 0.58fr) minmax(520px, 1.42fr) !important;
          gap: 12px !important;
          align-items: start !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .progressionSection {
          min-width: 0 !important;
          margin: 0 !important;
          padding: 11px !important;
          border: 1px solid rgba(255,216,107,0.24) !important;
          border-radius: 14px !important;
          background: rgba(0,0,0,0.20) !important;
          box-shadow: inset 0 0 22px rgba(0,0,0,0.18) !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .progressionSection h4 {
          margin: 0 0 9px !important;
          color: #ffdf91 !important;
          font-size: 13px !important;
          letter-spacing: 0.12em !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .attributeGrid.compact {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .skillList.compact {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(250px, 1fr)) !important;
          gap: 8px !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .attributeRow,
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .skillRow {
          min-height: 92px !important;
          padding: 10px !important;
          border-radius: 12px !important;
          background: rgba(20,12,8,0.62) !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .attributeRow strong,
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .skillRow strong {
          font-size: 13px !important;
          line-height: 1.1 !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .attributeRow small,
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .skillRow small,
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .skillRow span {
          font-size: 10px !important;
          line-height: 1.22 !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .skillProgress {
          height: 5px !important;
          margin-top: 6px !important;
        }
        body:not(.inventorySkillsMobileLayout) #inventoryPanel.open[data-inventory-category="skills"] .progressionHelp {
          margin-top: 0 !important;
          text-align: center !important;
          color: rgba(239,252,255,0.62) !important;
        }
      }
      @media (max-width: 760px), (hover:none) and (pointer:coarse) {
        .spawnAllocationHero { grid-template-columns: 1fr 1fr; }
        .spawnClassCard { grid-column: 1 / -1; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderSpawnHero() {
    if (typeof initProgression === "function") initProgression({ skipLoad: true });
    if (typeof updateOriginProfile === "function") updateOriginProfile();
    else if (typeof updateTemporaryClass === "function") updateTemporaryClass();
    const points = pointSummary();
    return `<div class="spawnAllocationHero"><div class="spawnClassCard"><small>Origin Read</small><strong>${esc(currentOriginName())}</strong><span>${esc(currentOriginDescription())}</span></div><div class="spawnPointCard"><span>Attribute Points</span><strong>${points.attributePoints}</strong></div><div class="spawnPointCard"><span>Skill Points</span><strong>${points.skillPoints}</strong></div></div>`;
  }

  function renderSpawnAttributeRows(compact = true) {
    const attrs = Object.values(player.progression?.attributes || {});
    const cap = typeof getStartingAttributeCap === "function" ? getStartingAttributeCap() : null;
    return attrs.map(attr => {
      const disabled = !canSpendAttr(attr);
      const value = Math.max(1, Number(attr.value) || attr.baseValue || 8);
      const capNote = cap && value >= cap ? ` · opening cap ${cap}` : "";
      const button = `<button class="spendPointBtn" type="button" data-spend-attribute="${esc(attr.id)}" ${disabled ? "disabled" : ""}>+1 ${esc(attr.name)}</button>`;
      if (compact) {
        return `<div class="attributeRow spendable" data-progression-row="attribute-${esc(attr.id || attr.name)}" aria-label="${esc(attr.name)} ${value}"><div><strong>${esc(attr.name)}</strong><small>${esc(attr.effect || attr.description || "")}${esc(capNote)}</small>${button}</div><span>${value}</span></div>`;
      }
      return `<div class="attributeCard spendable"><div><strong>${esc(attr.name)}</strong><span>${value}</span></div><p>${esc(attr.description)}</p><small>${esc(attr.effect)}${esc(capNote)}</small>${button}</div>`;
    }).join("");
  }

  function renderSpawnSkillRows(compact = true) {
    const points = pointSummary();
    const skills = Object.values(player.progression?.skills || {});
    return skills.map(skill => {
      const attr = skill.linkedAttribute && player.progression.attributes[skill.linkedAttribute]?.name;
      const bonus = [skill.category, attr].filter(Boolean).join(" · ");
      const pct = Math.max(0, Math.min(100, (skill.xp / Math.max(1, skill.xpToNext)) * 100));
      const disabled = points.skillPoints <= 0;
      const spend = `<button class="spendPointBtn" type="button" data-spend-skill="${esc(skill.id)}" ${disabled ? "disabled" : ""}>+1 Skill</button>`;
      const progress = typeof renderProgressBar === "function"
        ? renderProgressBar(skill.xp, skill.xpToNext, `${skill.name} XP progress`)
        : `<div class="skillProgress" aria-label="${esc(skill.name)} progress"><span style="width:${pct.toFixed(1)}%"></span></div>`;
      return `<div class="skillRow ${compact ? "compact" : ""} spendable" data-skill-id="${esc(skill.id)}"><div class="skillRowText"><strong>${esc(skill.name)}</strong><span>${esc(bonus)}</span><small>${esc(skill.description)}</small>${spend}</div><div class="skillLevel">Lv ${skill.level}</div>${progress}<em>${skill.xp} / ${skill.xpToNext}</em></div>`;
    }).join("");
  }

  function renderSpawnProgressionInventoryView() {
    if (typeof initProgression === "function") initProgression({ skipLoad: true });
    const hero = renderSpawnHero();
    const attrRows = renderSpawnAttributeRows(true);
    const skillRows = renderSpawnSkillRows(true);
    return `<div class="progressionInventory" role="region" aria-label="Skills and attributes"><div class="spawnAllocationNote">Spend opening points to shape who you were before the crawl. Race and class come later; the dungeon is merely taking notes, like a creep with funding.</div>${hero}<div class="progressionColumns"><section class="progressionSection attributesSection"><h4>Attributes</h4><div class="attributeGrid compact">${attrRows}</div></section><section class="progressionSection skillSection"><h4>Skills</h4><div class="skillList compact">${skillRows}</div></section></div><div class="progressionHelp">Spend points now or hold them. D-pad / left stick navigates · right stick scrolls · A / Enter selects · B / Escape backs out</div></div>`;
  }

  function renderSpawnProgressionPanel() {
    const panel = document.getElementById("progressionPanel");
    if (!panel) return;
    if (typeof initProgression === "function") initProgression({ skipLoad: true });
    panel.innerHTML = `<button id="closeProgressionBtn" class="panelClose" type="button" aria-label="Close skills">×</button><h3>Skills / Attributes</h3>${renderSpawnHero()}<section class="progressionSection"><h4>Attributes</h4><div class="attributeGrid">${renderSpawnAttributeRows(false)}</div></section><section class="progressionSection skillSection"><h4>Skills</h4><div class="skillList">${renderSpawnSkillRows(false)}</div></section><div class="progressionHelp">Opening points shape your origin read. Race and class are not assigned yet.</div>`;
    document.getElementById("closeProgressionBtn")?.addEventListener("click", closeProgressionPanel);
  }

  function refreshProgressionViews() {
    if (typeof updateOriginProfile === "function") updateOriginProfile();
    else if (typeof updateTemporaryClass === "function") updateTemporaryClass();
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    const panel = document.getElementById("progressionPanel");
    if (panel?.classList.contains("open") || panel?.style.display === "block") renderSpawnProgressionPanel();
    if (typeof updateHUD === "function") updateHUD();
  }

  function spendPointFromClick(event) {
    const attrButton = event.target.closest?.("[data-spend-attribute]");
    const skillButton = event.target.closest?.("[data-spend-skill]");
    if (!attrButton && !skillButton) return;
    event.preventDefault();
    event.stopPropagation();

    let spent = false;
    if (attrButton && typeof spendAttributePoint === "function") spent = spendAttributePoint(attrButton.dataset.spendAttribute);
    if (skillButton && typeof spendSkillPoint === "function") spent = spendSkillPoint(skillButton.dataset.spendSkill);
    if (!spent) return;

    if (typeof triggerHaptic === "function") triggerHaptic("success");
    if (typeof announcer === "function") announcer(`Crawler intake updated. Current origin read: ${currentOriginName()}.`);
    refreshProgressionViews();
  }

  function syncClassHud() {
    const existing = document.getElementById("classHud");
    if (existing) existing.remove();
  }

  function openSpawnAllocationPanel() {
    if (typeof setActiveInventoryCategory === "function") setActiveInventoryCategory("skills");
    else if (typeof activeInventoryCategory !== "undefined") activeInventoryCategory = "skills";
    if (typeof toggleInventoryPanel === "function") {
      const panel = document.getElementById("inventoryPanel");
      if (!panel?.classList.contains("open")) toggleInventoryPanel();
      else if (typeof updateInventoryUI === "function") updateInventoryUI();
    }
    if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
  }

  function maybePromptSpawnAllocation() {
    if (typeof GAME_MODES !== "undefined" && gameMode === GAME_MODES.TITLE) return;
    if (!player?.progression || player.progression.spawnAllocationPrompted) return;
    const points = pointSummary();
    if (points.attributePoints + points.skillPoints <= 0) return;
    player.progression.spawnAllocationPrompted = true;
    setTimeout(() => {
      if (typeof announcer === "function") announcer(`Crawler intake: assign ${points.attributePoints} attribute points and ${points.skillPoints} skill points to shape your opening build.`);
      openSpawnAllocationPanel();
    }, 650);
  }

  function wrapSpawnAllocationFunction(name, wrapper) {
    const original = globalThis[name];
    if (typeof original !== "function" || original.__spawnAllocationWrapped) return false;
    const wrapped = wrapper(original);
    wrapped.__spawnAllocationWrapped = true;
    globalThis[name] = wrapped;
    return true;
  }

  function installSpawnAllocationHooks() {
    if (typeof renderProgressionInventoryView === "function" && !renderProgressionInventoryView.__spawnAllocationWrapped) {
      renderProgressionInventoryView = function renderProgressionInventoryViewWithSpawnAllocation() {
        return renderSpawnProgressionInventoryView();
      };
      renderProgressionInventoryView.__spawnAllocationWrapped = true;
    }

    if (typeof renderProgressionPanel === "function" && !renderProgressionPanel.__spawnAllocationWrapped) {
      renderProgressionPanel = function renderProgressionPanelWithSpawnAllocation() {
        return renderSpawnProgressionPanel();
      };
      renderProgressionPanel.__spawnAllocationWrapped = true;
    }

    wrapSpawnAllocationFunction("updateHUD", original => function updateHudWithoutPreFloorClass() {
      const result = original.apply(this, arguments);
      syncClassHud();
      return result;
    });

    wrapSpawnAllocationFunction("resetState", original => function resetStateWithSpawnAllocationPrompt(options = {}) {
      const result = original.apply(this, arguments);
      if (!options?.preserveRun) maybePromptSpawnAllocation();
      return result;
    });
  }

  function install() {
    injectSpawnAllocationStyles();
    installSpawnAllocationHooks();
    if (!spawnAllocationClickBound) {
      spawnAllocationClickBound = true;
      document.addEventListener("click", spendPointFromClick, true);
    }
    syncClassHud();
    maybePromptSpawnAllocation();
  }

  let attempts = 0;
  const retry = () => {
    attempts++;
    install();
    if (attempts < 12) setTimeout(retry, 250);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
})();