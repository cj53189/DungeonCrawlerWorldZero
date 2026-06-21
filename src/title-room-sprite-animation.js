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
      renderHeight: def?.renderHeight || 40
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
    const def = currentCreatorDef();
    return def.id === CUSTOM_CHARACTER_ID || def.mode === "layered";
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
      meta.textContent = def.mode === "layered" ? "Custom layered body" : `${def.frameWidth}×${def.frameHeight} baked model`;
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
    writePlayerProfile({ name: input?.value, characterId, appearance: safeAppearance() });
    ensureLocalLobbyCrawler?.();
    window.updateCharacterCreatorPreview();
    if (typeof announcer === "function") announcer(`Crawler profile saved: ${playerProfile.name} · ${currentCreatorDef().label || characterId}.`);
    if (typeof showTitleScreen === "function") showTitleScreen();
  };
})();

(function installTitleRoomSpriteAnimation() {
  "use strict";

  if (window.__dcwTitleRoomSpriteAnimationInstalled) return;
  window.__dcwTitleRoomSpriteAnimationInstalled = true;

  const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  const activeKeys = new Set();
  const WALK_SEQUENCE = [0, 1, 2, 1];
  const WALK_FRAME_MS = 115;
  const MOVE_THRESHOLD = 0.08;
  let pointerId = null;
  let pointerStart = null;
  let pointerMove = { x: 0, y: 0 };
  let lastFacing = { x: 0, y: 1 };

  function isTitleCanvas(ctx) {
    return ctx?.canvas?.id === "titleRoomCanvas";
  }

  function isTitleRoomVisible() {
    const titleScreen = document.getElementById("titleScreen");
    return !!titleScreen && titleScreen.style.display !== "none" && getComputedStyle(titleScreen).display !== "none";
  }

  function normalizeVector(x, y) {
    const len = Math.hypot(x, y);
    if (len <= MOVE_THRESHOLD) return { x: 0, y: 0, len: 0 };
    return { x: x / len, y: y / len, len };
  }

  function keyboardVector() {
    const right = activeKeys.has("d") || activeKeys.has("arrowright") ? 1 : 0;
    const left = activeKeys.has("a") || activeKeys.has("arrowleft") ? 1 : 0;
    const down = activeKeys.has("s") || activeKeys.has("arrowdown") ? 1 : 0;
    const up = activeKeys.has("w") || activeKeys.has("arrowup") ? 1 : 0;
    return { x: right - left, y: down - up };
  }

  function gamepadVector() {
    if (!navigator.getGamepads) return { x: 0, y: 0 };
    const pad = Array.from(navigator.getGamepads()).find(gp => gp && gp.connected !== false);
    if (!pad) return { x: 0, y: 0 };
    const x = Math.abs(pad.axes[0] || 0) > 0.18 ? pad.axes[0] : 0;
    const y = Math.abs(pad.axes[1] || 0) > 0.18 ? pad.axes[1] : 0;
    return { x, y };
  }

  function currentMoveVector() {
    const keys = keyboardVector();
    const pad = gamepadVector();
    return normalizeVector(keys.x + pad.x + pointerMove.x, keys.y + pad.y + pointerMove.y);
  }

  function rowsForSheet(image, frameHeight) {
    const height = image?.naturalHeight || image?.height || 0;
    const rowCount = Math.max(1, Math.floor(height / frameHeight));
    if (rowCount >= 5) return { down: 0, up: 1, left: 3, right: 4 };
    return { down: 0, up: 1, left: 2, right: 3 };
  }

  function rowForFacing(facing, rows) {
    if (Math.abs(facing.x) > Math.abs(facing.y)) return facing.x < 0 ? rows.left : rows.right;
    return facing.y < 0 ? rows.up : rows.down;
  }

  function looksLikeCharacterFrame(image, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (!isTitleRoomVisible()) return false;
    if (![32, 52, 64].includes(Math.round(sw)) || ![32, 52, 64].includes(Math.round(sh))) return false;
    if (dw < 20 || dh < 20 || dw > 120 || dh > 120) return false;
    const width = image?.naturalWidth || image?.width || 0;
    const height = image?.naturalHeight || image?.height || 0;
    if (width < sw * 3 || height < sh * 4) return false;
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(dx) || !Number.isFinite(dy)) return false;
    return true;
  }

  CanvasRenderingContext2D.prototype.drawImage = function patchedTitleRoomDrawImage(image, ...args) {
    if (isTitleCanvas(this) && args.length === 8) {
      const [sx, sy, sw, sh, dx, dy, dw, dh] = args;
      if (looksLikeCharacterFrame(image, sx, sy, sw, sh, dx, dy, dw, dh)) {
        const move = currentMoveVector();
        const moving = move.len > MOVE_THRESHOLD;
        if (moving) lastFacing = { x: move.x, y: move.y };

        const rows = rowsForSheet(image, sh);
        const row = rowForFacing(lastFacing, rows);
        const frame = moving
          ? WALK_SEQUENCE[Math.floor(performance.now() / WALK_FRAME_MS) % WALK_SEQUENCE.length]
          : 1;
        const nextSx = frame * sw;
        const nextSy = row * sh;
        const width = image?.naturalWidth || image?.width || 0;
        const height = image?.naturalHeight || image?.height || 0;
        if (nextSx + sw <= width && nextSy + sh <= height) {
          return originalDrawImage.call(this, image, nextSx, nextSy, sw, sh, dx, dy, dw, dh);
        }
      }
    }
    return originalDrawImage.call(this, image, ...args);
  };

  window.addEventListener("keydown", event => {
    const key = event.key?.toLowerCase?.();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) activeKeys.add(key);
  });

  window.addEventListener("keyup", event => activeKeys.delete(event.key?.toLowerCase?.()));

  window.addEventListener("pointerdown", event => {
    if (event.target?.id !== "titleRoomCanvas") return;
    pointerId = event.pointerId;
    pointerStart = { x: event.clientX, y: event.clientY };
    pointerMove = { x: 0, y: 0 };
  }, true);

  window.addEventListener("pointermove", event => {
    if (event.pointerId !== pointerId || !pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    const len = Math.hypot(dx, dy);
    if (len <= 10) {
      pointerMove = { x: 0, y: 0 };
      return;
    }
    const mag = Math.min(1, len / 56);
    pointerMove = { x: (dx / len) * mag, y: (dy / len) * mag };
  }, true);

  function clearPointer(event) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    pointerStart = null;
    pointerMove = { x: 0, y: 0 };
  }

  window.addEventListener("pointerup", clearPointer, true);
  window.addEventListener("pointercancel", clearPointer, true);
})();
