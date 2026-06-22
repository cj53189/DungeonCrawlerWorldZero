(function installSpawnAllocationUi() {
  if (window.__dcwSpawnAllocationUiInstalled) return;
  window.__dcwSpawnAllocationUiInstalled = true;

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

  function currentClassName() {
    return typeof getTemporaryClass === "function" ? getTemporaryClass() : (player?.progression?.temporaryClass || "Fresh Crawler");
  }

  function currentClassDescription() {
    return typeof getTemporaryClassDescription === "function" ? getTemporaryClassDescription() : (player?.progression?.temporaryClassDescription || "Opening build pending.");
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
      .spawnClassCard strong { display:block; font-size: 16px; color: #effcff; }
      .spawnClassCard span { display:block; margin-top: 3px; color: rgba(239,252,255,0.72); font-size: 11px; line-height: 1.35; }
      .spawnPointCard { text-align:center; align-self:stretch; display:grid; align-content:center; border-radius:10px; background:rgba(255,255,255,0.055); }
      .spawnPointCard span { display:block; color:rgba(239,252,255,0.68); font-size:10px; text-transform:uppercase; letter-spacing:.08em; }
      .spawnPointCard strong { display:block; color:#ffd86b; font-size:20px; }
      .attributeRow.spendable, .skillRow.spendable, .attributeCard.spendable { border-color: rgba(255,216,107,0.44); }
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
      #classHud { margin-top: 4px; font-size: 11px; color: rgba(239,252,255,0.82); }
      @media (max-width: 760px), (hover:none) and (pointer:coarse) {
        .spawnAllocationHero { grid-template-columns: 1fr 1fr; }
        .spawnClassCard { grid-column: 1 / -1; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderSpawnHero() {
    if (typeof initProgression === "function") initProgression({ skipLoad: true });
    if (typeof updateTemporaryClass === "function") updateTemporaryClass();
    const points = pointSummary();
    return `<div class="spawnAllocationHero"><div class="spawnClassCard"><strong>${esc(currentClassName())}</strong><span>${esc(currentClassDescription())}</span></div><div class="spawnPointCard"><span>Attribute Points</span><strong>${points.attributePoints}</strong></div><div class="spawnPointCard"><span>Skill Points</span><strong>${points.skillPoints}</strong></div></div>`;
  }

  function renderSpawnAttributeRows(compact = true) {
    const points = pointSummary();
    const attrs = Object.values(player.progression?.attributes || {});
    return attrs.map(attr => {
      const disabled = points.attributePoints <= 0;
      const button = `<button class="spendPointBtn" type="button" data-spend-attribute="${esc(attr.id)}" ${disabled ? "disabled" : ""}>+1 ${esc(attr.name)}</button>`;
      if (compact) {
        return `<button class="attributeRow spendable" type="button" data-progression-row="attribute-${esc(attr.id || attr.name)}" aria-label="${esc(attr.name)} ${attr.value}"><div><strong>${esc(attr.name)}</strong><small>${esc(attr.effect || attr.description || "")}</small>${button}</div><span>${attr.value}</span></button>`;
      }
      return `<div class="attributeCard spendable"><div><strong>${esc(attr.name)}</strong><span>${attr.value}</span></div><p>${esc(attr.description)}</p><small>${esc(attr.effect)}</small>${button}</div>`;
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
      return `<button class="skillRow ${compact ? "compact" : ""} spendable" type="button" data-skill-id="${esc(skill.id)}"><div class="skillRowText"><strong>${esc(skill.name)}</strong><span>${esc(bonus)}</span><small>${esc(skill.description)}</small>${spend}</div><div class="skillLevel">Lv ${skill.level}</div>${progress}<em>${skill.xp} / ${skill.xpToNext}</em></button>`;
    }).join("");
  }

  function renderSpawnProgressionInventoryView() {
    if (typeof initProgression === "function") initProgression({ skipLoad: true });
    const hero = renderSpawnHero();
    const attrRows = renderSpawnAttributeRows(true);
    const skillRows = renderSpawnSkillRows(true);
    return `<div class="progressionInventory" role="region" aria-label="Skills and attributes"><div class="spawnAllocationNote">Starting allocation is intentionally tiny: 3 attribute points and 1 skill point. Your temporary class updates from the stat spread.</div>${hero}<div class="progressionColumns"><section class="progressionSection attributesSection"><h4>Attributes</h4><div class="attributeGrid compact">${attrRows}</div></section><section class="progressionSection skillSection"><h4>Skills</h4><div class="skillList compact">${skillRows}</div></section></div><div class="progressionHelp">Spend points now or hold them. D-pad / left stick navigates · right stick scrolls · A / Enter selects · B / Escape backs out</div></div>`;
  }

  function renderSpawnProgressionPanel() {
    const panel = document.getElementById("progressionPanel");
    if (!panel) return;
    if (typeof initProgression === "function") initProgression({ skipLoad: true });
    panel.innerHTML = `<button id="closeProgressionBtn" class="panelClose" type="button" aria-label="Close skills">×</button><h3>Skills / Attributes</h3>${renderSpawnHero()}<section class="progressionSection"><h4>Attributes</h4><div class="attributeGrid">${renderSpawnAttributeRows(false)}</div></section><section class="progressionSection skillSection"><h4>Skills</h4><div class="skillList">${renderSpawnSkillRows(false)}</div></section><div class="progressionHelp">Spend your opening points to define a temporary class. You can keep points unspent if you want to decide later.</div>`;
    document.getElementById("closeProgressionBtn")?.addEventListener("click", closeProgressionPanel);
  }

  function refreshProgressionViews() {
    if (typeof updateTemporaryClass === "function") updateTemporaryClass();
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
    if (typeof announcer === "function") announcer(`Crawler Intake updated. Temporary class: ${currentClassName()}.`);
    refreshProgressionViews();
  }

  function syncClassHud() {
    const hudWeapon = document.querySelector(".hudWeapon");
    if (!hudWeapon) return;
    let classHud = document.getElementById("classHud");
    if (!classHud) {
      classHud = document.createElement("div");
      classHud.id = "classHud";
      hudWeapon.insertAdjacentElement("afterend", classHud);
    }
    classHud.textContent = `Class ${currentClassName()}`;
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
      if (typeof announcer === "function") announcer(`Crawler Intake: assign ${points.attributePoints} attribute points and ${points.skillPoints} skill point to define your temporary class.`);
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

    wrapSpawnAllocationFunction("updateHUD", original => function updateHudWithTemporaryClass() {
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
    document.addEventListener("click", spendPointFromClick, true);
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
