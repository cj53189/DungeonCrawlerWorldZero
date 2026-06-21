(function installCharacterCreatorModelOptions() {
  "use strict";

  const CUSTOM_CHARACTER_ID = "custom_layered";
  let selectedCreatorCharacterId = CUSTOM_CHARACTER_ID;

  function injectCharacterModelStyles() {
    if (document.getElementById("characterCreatorModelOptionStyles")) return;
    const style = document.createElement("style");
    style.id = "characterCreatorModelOptionStyles";
    style.textContent = `
      #characterCreatorScreen .creatorOptions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 10px;
      }
      #characterCreatorScreen .creatorCharacterOption {
        display: grid;
        grid-template-columns: 54px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        min-height: 66px;
        width: 100%;
        border: 1px solid rgba(255,216,107,0.28);
        border-radius: 12px;
        background: rgba(255,255,255,0.07);
        color: #fff;
        padding: 8px 10px;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
      }
      #characterCreatorScreen .creatorCharacterOption.selected {
        border-color: rgba(255,216,107,0.92);
        background: linear-gradient(135deg, rgba(255,216,107,0.24), rgba(157,177,255,0.10));
        box-shadow: 0 0 18px rgba(255,216,107,0.18), inset 0 0 18px rgba(255,216,107,0.08);
      }
      #characterCreatorScreen .creatorCharacterOption strong {
        display: block;
        color: #ffd86b;
        font-size: 13px;
        line-height: 1.1;
      }
      #characterCreatorScreen .creatorCharacterOption span {
        display: block;
        color: rgba(255,255,255,0.72);
        font-size: 10px;
        line-height: 1.25;
        margin-top: 3px;
      }
      #characterCreatorScreen .creatorModelMini,
      #characterCreatorScreen .creatorSpritePreview {
        image-rendering: pixelated;
        image-rendering: crisp-edges;
        background-repeat: no-repeat;
        background-color: rgba(0,0,0,0.24);
        border-radius: 10px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10), 0 0 14px rgba(0,0,0,0.22);
      }
      #characterCreatorScreen .creatorModelMini {
        width: 46px;
        height: 46px;
        justify-self: center;
      }
      #characterCreatorScreen .creatorCustomizeGrid.modelLocked {
        display: none;
      }
      #characterCreatorScreen .creatorPreviewMeta .lockedNote {
        color: #9db1ff;
      }
    `;
    document.head.appendChild(style);
  }

  function safeAppearance() {
    if (typeof getCreatorAppearanceFromControls === "function") return getCreatorAppearanceFromControls();
    if (typeof getPlayerAppearance === "function") return getPlayerAppearance(playerProfile);
    return typeof DEFAULT_APPEARANCE !== "undefined" ? DEFAULT_APPEARANCE : {};
  }

  function getCustomModelDef() {
    const def = typeof getCustomCharacterDef === "function" ? getCustomCharacterDef() : null;
    return {
      id: CUSTOM_CHARACTER_ID,
      label: def?.label || "Custom Crawler",
      mode: "layered",
      frameWidth: def?.frameWidth || 64,
      frameHeight: def?.frameHeight || 64,
      columns: def?.columns || 3,
      rows: def?.rows || 4,
      idleFrame: def?.idleFrame ?? 1,
      directionRows: def?.directionRows || { down: 0, up: 1, left: 2, right: 3 },
      renderWidth: def?.renderWidth || 40,
      renderHeight: def?.renderHeight || 40,
      description: "Build your own layered crawler."
    };
  }

  function getCreatorModelOptions() {
    const baked = typeof CHARACTER_DEFS !== "undefined" ? Object.values(CHARACTER_DEFS) : [];
    const seen = new Set([CUSTOM_CHARACTER_ID]);
    return [getCustomModelDef(), ...baked.filter(def => {
      if (!def?.id || seen.has(def.id)) return false;
      seen.add(def.id);
      return true;
    })];
  }

  function normalizeCreatorCharacterId(id) {
    const text = String(id || "");
    return getCreatorModelOptions().some(def => def.id === text) ? text : CUSTOM_CHARACTER_ID;
  }

  function currentCreatorDef() {
    const id = normalizeCreatorCharacterId(selectedCreatorCharacterId || playerProfile?.characterId || CUSTOM_CHARACTER_ID);
    return getCreatorModelOptions().find(def => def.id === id) || getCustomModelDef();
  }

  function isLayeredCreatorSelected() {
    return currentCreatorDef().id === CUSTOM_CHARACTER_ID || currentCreatorDef().mode === "layered";
  }

  function getSpriteImageForDef(def, appearance) {
    if (def?.mode === "layered") {
      if (typeof buildCharacterSpriteSheet !== "function") return null;
      return buildCharacterSpriteSheet(appearance || safeAppearance());
    }
    return def?.image || null;
  }

  function applySpriteBackground(el, def, appearance, maxSize = 92) {
    if (!el || !def) return;
    const image = getSpriteImageForDef(def, appearance);
    const frameWidth = Number(def.frameWidth) || 64;
    const frameHeight = Number(def.frameHeight) || 64;
    const columns = Number(def.columns) || 3;
    const rows = Number(def.rows) || 4;
    const idleFrame = Number.isFinite(Number(def.idleFrame)) ? Number(def.idleFrame) : 1;
    const row = def.directionRows?.down ?? 0;
    const scale = Math.max(1, Math.min(3, maxSize / Math.max(frameWidth, frameHeight)));
    const width = Math.round(frameWidth * scale);
    const height = Math.round(frameHeight * scale);

    const url = image instanceof HTMLCanvasElement ? image.toDataURL("image/png") : image;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.backgroundImage = url ? `url(${url})` : "none";
    el.style.backgroundSize = `${Math.round(frameWidth * columns * scale)}px ${Math.round(frameHeight * rows * scale)}px`;
    el.style.backgroundPosition = `-${Math.round(idleFrame * frameWidth * scale)}px -${Math.round(row * frameHeight * scale)}px`;
  }

  function setCreatorCustomizationVisibility() {
    const grid = document.getElementById("creatorCustomizeGrid");
    if (!grid) return;
    grid.classList.toggle("modelLocked", !isLayeredCreatorSelected());
  }

  window.getSelectedCreatorCharacterId = function getSelectedCreatorCharacterId() {
    return normalizeCreatorCharacterId(selectedCreatorCharacterId || playerProfile?.characterId || CUSTOM_CHARACTER_ID);
  };

  window.renderCreatorModelOptions = function renderCreatorModelOptions() {
    injectCharacterModelStyles();
    const options = document.getElementById("creatorCharacterOptions");
    if (!options) return;
    const appearance = safeAppearance();
    const selectedId = window.getSelectedCreatorCharacterId();
    options.innerHTML = "";

    for (const def of getCreatorModelOptions()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `creatorCharacterOption${def.id === selectedId ? " selected" : ""}`;
      button.dataset.characterId = def.id;
      button.setAttribute("aria-pressed", String(def.id === selectedId));

      const mini = document.createElement("div");
      mini.className = "creatorModelMini";
      applySpriteBackground(mini, def, appearance, 46);

      const text = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = def.label || def.id.replaceAll("_", " ");
      const meta = document.createElement("span");
      meta.textContent = def.mode === "layered"
        ? "Custom layered body"
        : `${def.frameWidth}×${def.frameHeight} baked model`;
      text.append(label, meta);

      button.append(mini, text);
      button.addEventListener("click", () => {
        selectedCreatorCharacterId = def.id;
        window.renderCreatorModelOptions();
        setCreatorCustomizationVisibility();
        window.updateCharacterCreatorPreview();
      });
      options.appendChild(button);
    }
  };

  window.renderCharacterCreatorOptions = function renderCharacterCreatorOptions() {
    injectCharacterModelStyles();
    const grid = document.getElementById("creatorCustomizeGrid");
    if (grid) {
      grid.innerHTML = "";
      renderCreatorSelect(grid, "bodyFrame", "Body Frame", CHARACTER_APPEARANCE_OPTIONS.bodyFrame);
      renderCreatorColor(grid, "skinTone", "Skin Tone", CHARACTER_APPEARANCE_OPTIONS.skinTone);
      renderCreatorColor(grid, "eyeColor", "Eye Color", CHARACTER_APPEARANCE_OPTIONS.eyeColor);
      renderCreatorSelect(grid, "hairStyle", "Hair Style", CHARACTER_APPEARANCE_OPTIONS.hairStyle);
      renderCreatorColor(grid, "hairColor", "Hair Color", CHARACTER_APPEARANCE_OPTIONS.hairColor);
      renderCreatorSelect(grid, "shirt", "Top", CHARACTER_APPEARANCE_OPTIONS.shirt);
      renderCreatorColor(grid, "shirtColor", "Top Color", CHARACTER_APPEARANCE_OPTIONS.shirtColor);
      renderCreatorSelect(grid, "pants", "Bottom", CHARACTER_APPEARANCE_OPTIONS.pants);
      renderCreatorColor(grid, "pantsColor", "Bottom Color", CHARACTER_APPEARANCE_OPTIONS.pantsColor);
    }
    window.renderCreatorModelOptions();
    setCreatorCustomizationVisibility();
  };

  window.updateCharacterCreatorPreview = function updateCharacterCreatorPreview() {
    const input = document.getElementById("creatorNameInput");
    const name = sanitizePlayerName(input?.value ?? playerProfile.name);
    const appearance = safeAppearance();
    const def = currentCreatorDef();
    const previewName = document.getElementById("creatorPreviewName");
    if (previewName) previewName.textContent = name;

    const previewMeta = document.getElementById("creatorPreviewMeta");
    if (previewMeta) {
      previewMeta.innerHTML = def.mode === "layered"
        ? `${appearance.bodyFrame} body · ${appearance.hairStyle.replaceAll("_", " ")} · layered sprite`
        : `${def.label || def.id} · baked sprite · <span class="lockedNote">colors locked</span>`;
    }

    const preview = document.getElementById("creatorSpritePreview");
    if (preview) applySpriteBackground(preview, def, appearance, 104);
    window.renderCreatorModelOptions?.();
  };

  window.showCharacterCreator = function showCharacterCreator() {
    selectedCreatorCharacterId = normalizeCreatorCharacterId(playerProfile?.characterId || CUSTOM_CHARACTER_ID);
    const title = document.getElementById("titleScreen");
    const creator = document.getElementById("characterCreatorScreen");
    const input = document.getElementById("creatorNameInput");
    if (input) input.value = playerProfile.name;
    window.renderCharacterCreatorOptions();
    setCreatorAppearanceControls(playerProfile.appearance || DEFAULT_APPEARANCE);
    setCreatorCustomizationVisibility();
    window.updateCharacterCreatorPreview();
    if (title) title.style.display = "none";
    if (creator) {
      creator.style.display = "flex";
      creator.setAttribute("aria-hidden", "false");
    }
    if (input) input.focus();
  };

  window.randomizeCharacterCreator = function randomizeCharacterCreator() {
    const models = getCreatorModelOptions();
    selectedCreatorCharacterId = models[Math.floor(Math.random() * models.length)]?.id || CUSTOM_CHARACTER_ID;
    setCreatorAppearanceControls(randomAppearance());
    window.renderCreatorModelOptions();
    setCreatorCustomizationVisibility();
    window.updateCharacterCreatorPreview();
  };

  window.saveCharacterProfileFromCreator = function saveCharacterProfileFromCreator() {
    const input = document.getElementById("creatorNameInput");
    const characterId = window.getSelectedCreatorCharacterId();
    writePlayerProfile({
      name: input?.value,
      characterId,
      appearance: safeAppearance()
    });
    ensureLocalLobbyCrawler?.();
    window.updateCharacterCreatorPreview();
    if (typeof announcer === "function") announcer(`Crawler profile saved: ${playerProfile.name} · ${currentCreatorDef().label || characterId}.`);
    if (typeof showTitleScreen === "function") showTitleScreen();
  };
})();
