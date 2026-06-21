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
