(function installKenneyTinyDungeonPreview() {
  const TILESET = Object.freeze({
    id: "kenney_tiny_dungeon",
    imagePath: "./assets/tilesets/kenney/tiny-dungeon/Tilemap/tilemap.png",
    tileSize: 16,
    spacing: 1,
    columns: 12,
    rows: 11,
    drawScale: 2
  });

  const STORAGE_KEY = "dcw.kenneyTinyPreview.enabled";
  const OVERLAY_ID = "kenneyTinyDungeonPreview";
  const STYLE_ID = "kenneyTinyDungeonPreviewStyles";
  const QUERY = new URLSearchParams(window.location.search || "");
  const image = new Image();
  let loaded = false;
  let failed = false;
  let overlay = null;
  let overlayCanvas = null;
  let overlayCtx = null;

  image.onload = () => {
    loaded = true;
    failed = false;
    if (isEnabled()) renderOverlay();
  };
  image.onerror = () => {
    failed = true;
    console.warn("Kenney Tiny Dungeon tilemap failed to load:", TILESET.imagePath);
  };
  image.src = TILESET.imagePath;

  function explicitQueryEnabled() {
    const raw = QUERY.get("kenneyTiles") || QUERY.get("tinyDungeonTiles") || QUERY.get("tilesetPreview");
    return /^(1|true|yes|on)$/i.test(String(raw || ""));
  }

  function isEnabled() {
    if (explicitQueryEnabled()) return true;
    try { return localStorage.getItem(STORAGE_KEY) === "true"; }
    catch { return false; }
  }

  function setEnabled(enabled) {
    try { localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false"); } catch {}
    if (enabled) showOverlay();
    else hideOverlay();
    return enabled;
  }

  function sourceRect(row, col) {
    return {
      sx: col * (TILESET.tileSize + TILESET.spacing),
      sy: row * (TILESET.tileSize + TILESET.spacing),
      sw: TILESET.tileSize,
      sh: TILESET.tileSize
    };
  }

  function drawTile(targetCtx, row, col, dx, dy, size = TILESET.tileSize * TILESET.drawScale) {
    if (!loaded || failed) return false;
    const { sx, sy, sw, sh } = sourceRect(row, col);
    targetCtx.save();
    targetCtx.imageSmoothingEnabled = false;
    targetCtx.drawImage(image, sx, sy, sw, sh, dx, dy, size, size);
    targetCtx.restore();
    return true;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        right: max(12px, env(safe-area-inset-right));
        bottom: max(12px, env(safe-area-inset-bottom));
        z-index: 140;
        width: min(420px, calc(100vw - 24px));
        max-height: min(72vh, 520px);
        overflow: auto;
        padding: 10px;
        border: 1px solid rgba(255,216,107,0.38);
        border-radius: 12px;
        background: rgba(10, 8, 14, 0.92);
        color: #fff4cc;
        box-shadow: 0 12px 34px rgba(0,0,0,0.55);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        touch-action: pan-y;
      }
      #${OVERLAY_ID} header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
      #${OVERLAY_ID} strong { font-size:12px; letter-spacing:0.08em; text-transform:uppercase; }
      #${OVERLAY_ID} button {
        min-height: 32px;
        border: 1px solid rgba(255,216,107,0.46);
        border-radius: 8px;
        background: rgba(255,216,107,0.12);
        color: #fff4cc;
        font-weight: 900;
      }
      #${OVERLAY_ID} canvas {
        display: block;
        width: 100%;
        height: auto;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
        background: #120f18;
        border-radius: 8px;
      }
      #${OVERLAY_ID} p { margin: 8px 0 0; font-size: 11px; line-height: 1.35; color: #d7d0e8; }
      @media (max-width: 700px), (max-height: 520px) {
        #${OVERLAY_ID} { left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 50vh; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderOverlay() {
    if (!overlayCanvas || !overlayCtx) return;
    const tileDrawSize = 32;
    const labelHeight = 12;
    const gap = 4;
    overlayCanvas.width = TILESET.columns * (tileDrawSize + gap) + gap;
    overlayCanvas.height = TILESET.rows * (tileDrawSize + labelHeight + gap) + gap;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCtx.imageSmoothingEnabled = false;
    overlayCtx.fillStyle = "#120f18";
    overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCtx.font = "9px monospace";
    overlayCtx.textAlign = "left";
    overlayCtx.textBaseline = "top";

    for (let row = 0; row < TILESET.rows; row++) {
      for (let col = 0; col < TILESET.columns; col++) {
        const dx = gap + col * (tileDrawSize + gap);
        const dy = gap + row * (tileDrawSize + labelHeight + gap);
        drawTile(overlayCtx, row, col, dx, dy, tileDrawSize);
        overlayCtx.fillStyle = "rgba(255,244,204,0.88)";
        overlayCtx.fillText(`${row},${col}`, dx + 1, dy + tileDrawSize + 1);
      }
    }
  }

  function showOverlay() {
    injectStyles();
    if (!overlay) {
      overlay = document.createElement("section");
      overlay.id = OVERLAY_ID;
      overlay.innerHTML = `
        <header>
          <strong>Kenney Tiny Dungeon</strong>
          <button type="button" data-close>Hide</button>
        </header>
        <canvas aria-label="Tiny Dungeon tile contact sheet"></canvas>
        <p>Preview only. Tiles are 16×16 and should be drawn at 2× scale for the current 32px map. Press Ctrl/⌘ + Shift + T to toggle.</p>
      `;
      overlay.querySelector("[data-close]")?.addEventListener("click", () => setEnabled(false));
      overlayCanvas = overlay.querySelector("canvas");
      overlayCtx = overlayCanvas?.getContext("2d") || null;
      document.body.appendChild(overlay);
    }
    overlay.hidden = false;
    renderOverlay();
  }

  function hideOverlay() {
    if (overlay) overlay.hidden = true;
  }

  function toggle() {
    return setEnabled(!isEnabled());
  }

  document.addEventListener("keydown", event => {
    if (!event.shiftKey || !(event.ctrlKey || event.metaKey)) return;
    if (event.key?.toLowerCase?.() !== "t") return;
    event.preventDefault();
    toggle();
  });

  window.DCWZKenneyTinyDungeon = Object.freeze({
    tileset: TILESET,
    image,
    isReady: () => loaded && !failed,
    isEnabled,
    setEnabled,
    toggle,
    drawTile,
    showOverlay,
    hideOverlay
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { if (isEnabled()) showOverlay(); }, { once: true });
  } else if (isEnabled()) {
    showOverlay();
  }
})();
