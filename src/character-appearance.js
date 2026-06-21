const PLAYER_SHEET_SPEC = Object.freeze({ width: 192, height: 256, frameWidth: 64, frameHeight: 64, columns: 3, rows: 4 });
const PLAYER_ANIMS = Object.freeze({
  front: Object.freeze({ row: 0, frames: Object.freeze([0, 1, 2]), frameWidth: 64, frameHeight: 64 }),
  back: Object.freeze({ row: 1, frames: Object.freeze([0, 1, 2]), frameWidth: 64, frameHeight: 64 }),
  left: Object.freeze({ row: 2, frames: Object.freeze([0, 1, 2]), frameWidth: 64, frameHeight: 64 }),
  right: Object.freeze({ row: 3, frames: Object.freeze([0, 1, 2]), frameWidth: 64, frameHeight: 64 })
});

const CHARACTER_APPEARANCE_OPTIONS = Object.freeze({
  bodyFrame: Object.freeze(["average"]),
  skinTone: Object.freeze(["#f0c7a3", "#d99b72", "#b9825c", "#8f5f3d", "#68412f", "#3d281f"]),
  eyeColor: Object.freeze(["#6fb7ff", "#8fd96f", "#a982ff", "#5a3520", "#d8c35a", "#c7d7df"]),
  hairStyle: Object.freeze(["bald", "short_messy", "long_wave"]),
  hairColor: Object.freeze(["#1e130f", "#2b1b12", "#6b3f22", "#c58b45", "#d8d0bd", "#7b2cff"]),
  shirt: Object.freeze(["crawler_tank", "tunic", "hoodie"]),
  shirtColor: Object.freeze(["#3a6ea5", "#552288", "#9f3a3a", "#2f7d4a", "#d8b14a", "#252a36"]),
  pants: Object.freeze(["cargo_pants", "jeans", "cloth_wrap"]),
  pantsColor: Object.freeze(["#2f2f2f", "#202040", "#54402d", "#26475f", "#3f4a35", "#1c1c22"]),
  shoes: Object.freeze(["boots"]),
  accessory: Object.freeze(["none"])
});

const DEFAULT_APPEARANCE = Object.freeze({
  bodyFrame: "average", genderPresentation: "unspecified", skinTone: "#b9825c", eyeColor: "#6fb7ff",
  hairStyle: "short_messy", hairColor: "#2b1b12", shirt: "crawler_tank", shirtColor: "#3a6ea5",
  pants: "cargo_pants", pantsColor: "#2f2f2f", shoes: "boots", accessory: "none"
});

const CUSTOM_CHARACTER_DEF = Object.freeze({
  id: "custom_layered", label: "Custom Crawler", mode: "layered", frameWidth: 64, frameHeight: 64,
  columns: 3, rows: 4, idleFrame: 1, directionRows: Object.freeze({ down: 0, up: 1, left: 2, right: 3 }),
  renderWidth: 40, renderHeight: 40, previewScale: 1, supportsSkinColor: true, supportsHairColor: true, supportsHair: true
});

const characterSpriteBuildCache = new Map();

function optionValue(group, value) {
  return CHARACTER_APPEARANCE_OPTIONS[group].includes(value) ? value : CHARACTER_APPEARANCE_OPTIONS[group][0];
}
function sanitizeHexColor(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
}
function sanitizeAppearance(appearance = {}) {
  return {
    bodyFrame: optionValue("bodyFrame", appearance.bodyFrame || DEFAULT_APPEARANCE.bodyFrame),
    genderPresentation: String(appearance.genderPresentation || DEFAULT_APPEARANCE.genderPresentation).slice(0, 24),
    skinTone: sanitizeHexColor(appearance.skinTone, DEFAULT_APPEARANCE.skinTone),
    eyeColor: sanitizeHexColor(appearance.eyeColor, DEFAULT_APPEARANCE.eyeColor),
    hairStyle: optionValue("hairStyle", appearance.hairStyle || DEFAULT_APPEARANCE.hairStyle),
    hairColor: sanitizeHexColor(appearance.hairColor, DEFAULT_APPEARANCE.hairColor),
    shirt: optionValue("shirt", appearance.shirt || DEFAULT_APPEARANCE.shirt),
    shirtColor: sanitizeHexColor(appearance.shirtColor, DEFAULT_APPEARANCE.shirtColor),
    pants: optionValue("pants", appearance.pants || DEFAULT_APPEARANCE.pants),
    pantsColor: sanitizeHexColor(appearance.pantsColor, DEFAULT_APPEARANCE.pantsColor),
    shoes: optionValue("shoes", appearance.shoes || DEFAULT_APPEARANCE.shoes),
    accessory: optionValue("accessory", appearance.accessory || DEFAULT_APPEARANCE.accessory)
  };
}
function appearanceCacheKey(appearance) {
  const safe = sanitizeAppearance(appearance);
  return [safe.bodyFrame, safe.skinTone, safe.eyeColor, safe.hairStyle, safe.hairColor, safe.shirt, safe.shirtColor, safe.pants, safe.pantsColor, safe.shoes, safe.accessory].join("_").replaceAll("#", "");
}
function getCustomCharacterDef() { return CUSTOM_CHARACTER_DEF; }
function getPlayerAppearance(profile = playerProfile) { return sanitizeAppearance(profile?.appearance || DEFAULT_APPEARANCE); }
function randomAppearance() {
  const pick = values => values[Math.floor(Math.random() * values.length)];
  return sanitizeAppearance({ bodyFrame: pick(CHARACTER_APPEARANCE_OPTIONS.bodyFrame), skinTone: pick(CHARACTER_APPEARANCE_OPTIONS.skinTone), eyeColor: pick(CHARACTER_APPEARANCE_OPTIONS.eyeColor), hairStyle: pick(CHARACTER_APPEARANCE_OPTIONS.hairStyle), hairColor: pick(CHARACTER_APPEARANCE_OPTIONS.hairColor), shirt: pick(CHARACTER_APPEARANCE_OPTIONS.shirt), shirtColor: pick(CHARACTER_APPEARANCE_OPTIONS.shirtColor), pants: pick(CHARACTER_APPEARANCE_OPTIONS.pants), pantsColor: pick(CHARACTER_APPEARANCE_OPTIONS.pantsColor), shoes: "boots", accessory: "none" });
}

function drawSheetPart(ctx, color, part, appearance) {
  for (let row = 0; row < 4; row++) for (let frame = 0; frame < 3; frame++) {
    const ox = frame * 64, oy = row * 64, bob = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    const side = row === 2 || row === 3;
    ctx.fillStyle = color;
    if (part === "skin") {
      ctx.fillRect(ox + (side ? 24 : 22), oy + 10 + bob, side ? 16 : 20, 18);
      ctx.fillRect(ox + (side ? 26 : 21), oy + 29 + bob, side ? 12 : 8, 14);
      ctx.fillRect(ox + (side ? 26 : 35), oy + 29 + bob, side ? 12 : 8, 14);
    } else if (part === "eyes" && row !== 1) {
      ctx.fillRect(ox + (row === 2 ? 25 : row === 3 ? 38 : 25), oy + 18 + bob, 3, 3);
      if (!side) ctx.fillRect(ox + 36, oy + 18 + bob, 3, 3);
    } else if (part === "pants") {
      ctx.fillRect(ox + 24, oy + 43 + bob, 7, 13); ctx.fillRect(ox + 34, oy + 43 + bob, 7, 13);
    } else if (part === "shirt") {
      const w = appearance.shirt === "hoodie" ? 24 : 20; ctx.fillRect(ox + 32 - w / 2, oy + 28 + bob, w, 17);
    } else if (part === "shoes") {
      ctx.fillRect(ox + 22, oy + 56 + bob, 10, 4); ctx.fillRect(ox + 33, oy + 56 + bob, 10, 4);
    } else if (part === "hair") {
      if (appearance.hairStyle === "bald") continue;
      ctx.fillRect(ox + (side ? 23 : 20), oy + 8 + bob, side ? 18 : 24, appearance.hairStyle === "long_wave" ? 25 : 10);
      if (appearance.hairStyle === "short_messy") { ctx.fillRect(ox + 27, oy + 5 + bob, 5, 5); ctx.fillRect(ox + 34, oy + 6 + bob, 5, 5); }
    }
  }
}

function buildCharacterSpriteSheet(appearance) {
  const safe = sanitizeAppearance(appearance);
  const key = appearanceCacheKey(safe);
  if (characterSpriteBuildCache.has(key)) return characterSpriteBuildCache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = PLAYER_SHEET_SPEC.width; canvas.height = PLAYER_SHEET_SPEC.height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  drawSheetPart(ctx, "rgba(0,0,0,0.52)", "skin", safe);
  drawSheetPart(ctx, safe.skinTone, "skin", safe);
  drawSheetPart(ctx, safe.eyeColor, "eyes", safe);
  drawSheetPart(ctx, safe.pantsColor, "pants", safe);
  drawSheetPart(ctx, safe.shirtColor, "shirt", safe);
  drawSheetPart(ctx, "#1b1512", "shoes", safe);
  drawSheetPart(ctx, safe.hairColor, "hair", safe);
  canvas.appearanceKey = key;
  characterSpriteBuildCache.set(key, canvas);
  return canvas;
}
