(function installPlayableTitleRoom() {
  "use strict";

  const WORLD_W = 960;
  const WORLD_H = 640;
  const ROOM = { x: 72, y: 72, w: 816, h: 488 };
  const SPAWN = { x: WORLD_W / 2, y: 500 };
  const PLAYER_RADIUS = 14;
  const PLAYER_SPEED = 3.85;
  const INITIAL_ZOOM = 2.65;
  const HUB_ZOOM = 0.98;
  const LOW_TILT = 0.58;
  const GAME_TILT = 0.72;
  const DOOR_COOLDOWN_MS = 700;
  const STORAGE_SEEN_KEY = "dcw.titleRoom.seenIntro.v4";

  const titleSpriteCache = new Map();
  const keysDown = new Set();

  const zones = [
    { id: "startSingleBtn", kind: "main", label: "ENTER", subtitle: "Single Player", x: 372, y: 86, w: 216, h: 176, trigger: { x: 394, y: 240, w: 172, h: 96 }, color: "#ffd86b" },
    { id: "quickMatchBtn", kind: "door", label: "MULTIPLAYER", subtitle: "Quick Match", x: 138, y: 142, w: 168, h: 132, trigger: { x: 132, y: 258, w: 180, h: 80 }, color: "#9cffb1" },
    { id: "characterCreatorBtn", kind: "door", label: "CHARACTER", subtitle: "Creator", x: 654, y: 142, w: 168, h: 132, trigger: { x: 648, y: 258, w: 180, h: 80 }, color: "#9db1ff" },
    { id: "pvpArenaBtn", kind: "plaque", label: "PvP ARENA", subtitle: "Test combat", x: 118, y: 366, w: 148, h: 62, trigger: { x: 96, y: 336, w: 192, h: 114 }, color: "#ff8fb8" },
    { id: "joinPartyBtn", kind: "plaque", label: "JOIN PARTY", subtitle: "Code", x: 316, y: 414, w: 146, h: 58, trigger: { x: 294, y: 384, w: 190, h: 108 }, color: "#9cffb1" },
    { id: "leaderboardBtn", kind: "plaque", label: "LEADERBOARD", subtitle: "Records", x: 498, y: 414, w: 146, h: 58, trigger: { x: 476, y: 384, w: 190, h: 108 }, color: "#ffd86b", fallback: () => window.DCWZLeaderboard?.show?.() },
    { id: "copyGameLinkBtn", kind: "plaque", label: "COPY LINK", subtitle: "Invite", x: 700, y: 358, w: 130, h: 54, trigger: { x: 678, y: 330, w: 174, h: 100 }, color: "#d7c0ff" },
    { id: "localMultiTestBtn", kind: "plaque", label: "LOCAL TEST", subtitle: "4 Crawlers", x: 700, y: 468, w: 130, h: 54, trigger: { x: 678, y: 440, w: 174, h: 100 }, color: "#7cf7ff" }
  ];

  let titleScreen = null;
  let canvas = null;
  let ctx = null;
  let hud = null;
  let ghost = null;
  let active = false;
  let started = false;
  let zoom = INITIAL_ZOOM;
  let tilt = LOW_TILT;
  let cameraX = SPAWN.x;
  let cameraY = SPAWN.y - 28;
  let playerX = SPAWN.x;
  let playerY = SPAWN.y;
  let aimX = 0;
  let aimY = -1;
  let lastMoveLen = 0;
  let pulse = 0;
  let highlightedZone = null;
  let lastTriggeredAt = 0;
  let pointerId = null;
  let pointerStart = null;
  let pointerMove = { x: 0, y: 0 };
  let pointerMoved = false;

  function isMobilePointer() {
    return window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches || window.innerWidth < 780;
  }

  function controlPromptText() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (pads.some(pad => pad?.connected)) return "MOVE LEFT STICK";
    if (isMobilePointer()) return "DRAG TO MOVE";
    return "PRESS FORWARD";
  }

  function injectStyles() {
    if (document.getElementById("titleRoomStyles")) return;
    const style = document.createElement("style");
    style.id = "titleRoomStyles";
    style.textContent = `
      #titleScreen.dcwTitleRoomReady {
        padding: 0;
        overflow: hidden;
        align-items: stretch;
        justify-content: stretch;
        background: #020204;
        text-align: left;
      }
      #titleScreen.dcwTitleRoomReady > .titleBox:not(#leaderboardPanel) {
        position: absolute !important;
        left: -10000px !important;
        top: auto !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      #titleRoomCanvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        background: #020204;
        touch-action: none;
        user-select: none;
        z-index: 0;
      }
      .titleRoomHud {
        position: absolute;
        left: max(18px, env(safe-area-inset-left));
        top: max(14px, env(safe-area-inset-top));
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        pointer-events: none;
        text-align: left;
        text-shadow: 0 2px 10px #000, 0 0 18px rgba(0,0,0,0.95);
      }
      .titleRoomGameTitle {
        color: #ffd86b;
        font-weight: 1000;
        letter-spacing: 0.025em;
        font-size: clamp(22px, 3.7vw, 42px);
        line-height: 0.94;
      }
      .titleRoomSubtitle {
        color: #9cffb1;
        font-size: clamp(10px, 1.45vw, 13px);
        font-weight: 900;
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }
      .titleRoomHelp {
        position: absolute;
        left: 50%;
        bottom: max(14px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        z-index: 2;
        color: rgba(255,255,255,0.84);
        background: rgba(0,0,0,0.52);
        border: 1px solid rgba(255,216,107,0.26);
        border-radius: 999px;
        padding: 8px 14px;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        pointer-events: none;
        text-align: center;
        text-shadow: 0 1px 4px #000;
      }
      .titleRoomTouchGhost {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.32s ease;
      }
      .titleRoomTouchGhost.show { opacity: 0.66; }
      .titleRoomGhostStick {
        position: absolute;
        left: max(22px, env(safe-area-inset-left));
        bottom: max(28px, env(safe-area-inset-bottom));
        width: 112px;
        height: 112px;
        border-radius: 999px;
        border: 2px solid rgba(255,255,255,0.25);
        background: rgba(255,255,255,0.08);
      }
      .titleRoomGhostStick::after {
        content: "";
        position: absolute;
        width: 42px;
        height: 42px;
        border-radius: 999px;
        left: 35px;
        top: 25px;
        background: rgba(255,255,255,0.34);
        box-shadow: 0 0 18px rgba(255,255,255,0.14);
      }
      .titleRoomGhostButton {
        position: absolute;
        right: max(30px, env(safe-area-inset-right));
        bottom: max(42px, env(safe-area-inset-bottom));
        width: 72px;
        height: 72px;
        border-radius: 999px;
        border: 2px solid rgba(255,216,107,0.36);
        background: rgba(214,181,92,0.18);
      }
      #titleRoomFallback { display: none !important; }
      #leaderboardPanel {
        position: relative;
        z-index: 5;
        margin: auto;
      }
      #titleScreen.dcwTitleRoomReady #leaderboardPanel[style*="block"] {
        display: block !important;
      }
      @media (max-width: 640px) {
        .titleRoomHud { top: max(46px, env(safe-area-inset-top)); left: max(14px, env(safe-area-inset-left)); }
        .titleRoomGameTitle { font-size: clamp(22px, 7vw, 36px); }
        .titleRoomSubtitle { font-size: 10px; }
        .titleRoomHelp { max-width: 84vw; white-space: normal; line-height: 1.2; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureDom() {
    titleScreen = document.getElementById("titleScreen");
    if (!titleScreen) return false;
    injectStyles();
    titleScreen.classList.add("dcwTitleRoomReady");

    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "titleRoomCanvas";
      canvas.setAttribute("aria-label", "Playable title room menu");
      titleScreen.prepend(canvas);
      ctx = canvas.getContext("2d");
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
    }

    if (!hud) {
      hud = document.createElement("div");
      hud.className = "titleRoomHud";
      hud.innerHTML = `<div class="titleRoomGameTitle">Dungeon Crawler<br>World</div><div class="titleRoomSubtitle" id="titleRoomConnection">Connection: Checking</div>`;
      titleScreen.appendChild(hud);
    }

    if (!document.getElementById("titleRoomHelp")) {
      const help = document.createElement("div");
      help.id = "titleRoomHelp";
      help.className = "titleRoomHelp";
      help.textContent = controlPromptText();
      titleScreen.appendChild(help);
    }

    if (!ghost) {
      ghost = document.createElement("div");
      ghost.className = "titleRoomTouchGhost";
      ghost.innerHTML = `<div class="titleRoomGhostStick"></div><div class="titleRoomGhostButton"></div>`;
      titleScreen.appendChild(ghost);
    }

    return true;
  }

  function resizeCanvas() {
    const rect = titleScreen.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function isTitleVisible() {
    return !!titleScreen && titleScreen.style.display !== "none" && getComputedStyle(titleScreen).display !== "none";
  }

  function isBlockingTitlePanelOpen() {
    const leaderboard = document.getElementById("leaderboardPanel");
    const creator = document.getElementById("characterCreatorScreen");
    return !!(leaderboard && leaderboard.style.display === "block") || !!(creator && getComputedStyle(creator).display !== "none");
  }

  function resetForTitleIfNeeded() {
    const shouldBeActive = isTitleVisible() && !isBlockingTitlePanelOpen();
    if (shouldBeActive && !active) {
      active = true;
      const seenIntro = localStorage.getItem(STORAGE_SEEN_KEY) === "true";
      started = seenIntro;
      zoom = seenIntro ? HUB_ZOOM : INITIAL_ZOOM;
      tilt = seenIntro ? GAME_TILT : LOW_TILT;
      playerX = SPAWN.x;
      playerY = SPAWN.y;
      cameraX = playerX;
      cameraY = playerY - 24;
      highlightedZone = null;
      pointerId = null;
      pointerMove = { x: 0, y: 0 };
      if (isMobilePointer() && !seenIntro) showTouchGhost();
    } else if (!shouldBeActive && active) {
      active = false;
      pointerId = null;
      pointerMove = { x: 0, y: 0 };
    }
  }

  function showTouchGhost() {
    if (!ghost) return;
    ghost.classList.add("show");
    setTimeout(() => ghost?.classList.remove("show"), 2200);
  }

  function markStarted() {
    if (started) return;
    started = true;
    try { localStorage.setItem(STORAGE_SEEN_KEY, "true"); } catch {}
    ghost?.classList.remove("show");
  }

  function keyboardVector() {
    const right = keysDown.has("d") || keysDown.has("arrowright") ? 1 : 0;
    const left = keysDown.has("a") || keysDown.has("arrowleft") ? 1 : 0;
    const down = keysDown.has("s") || keysDown.has("arrowdown") ? 1 : 0;
    const up = keysDown.has("w") || keysDown.has("arrowup") ? 1 : 0;
    return { x: right - left, y: down - up };
  }

  function gamepadVector() {
    if (!navigator.getGamepads) return { x: 0, y: 0 };
    const pad = Array.from(navigator.getGamepads()).find(gp => gp && gp.connected !== false);
    if (!pad) return { x: 0, y: 0 };
    return {
      x: Math.abs(pad.axes[0] || 0) > 0.18 ? pad.axes[0] : 0,
      y: Math.abs(pad.axes[1] || 0) > 0.18 ? pad.axes[1] : 0
    };
  }

  function currentMoveVector() {
    const keyboard = keyboardVector();
    const gamepad = gamepadVector();
    let x = keyboard.x + gamepad.x + pointerMove.x;
    let y = keyboard.y + gamepad.y + pointerMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    if (len > 0.08) markStarted();
    return { x, y, len };
  }

  function clampPlayerToRoom() {
    playerX = Math.max(ROOM.x + PLAYER_RADIUS + 14, Math.min(ROOM.x + ROOM.w - PLAYER_RADIUS - 14, playerX));
    playerY = Math.max(ROOM.y + PLAYER_RADIUS + 18, Math.min(ROOM.y + ROOM.h - PLAYER_RADIUS - 12, playerY));
  }

  function pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function updatePlayer() {
    const move = currentMoveVector();
    lastMoveLen = move.len;
    if (started && move.len > 0.08) {
      playerX += move.x * PLAYER_SPEED;
      playerY += move.y * PLAYER_SPEED;
      aimX = move.x;
      aimY = move.y;
      clampPlayerToRoom();
    }

    highlightedZone = null;
    for (const zone of zones) {
      if (pointInRect(playerX, playerY, zone.trigger)) {
        highlightedZone = zone;
        if (Date.now() - lastTriggeredAt > DOOR_COOLDOWN_MS && started && zoom < 1.20) triggerZone(zone.id, zone);
        break;
      }
    }
  }

  function triggerZone(id, zone = null) {
    if (!id) return;
    lastTriggeredAt = Date.now();
    const target = zone || zones.find(candidate => candidate.id === id);
    const button = document.getElementById(id);
    if (button) {
      button.click();
      return;
    }
    if (target?.fallback) target.fallback();
  }

  function updateCamera() {
    const approach = Math.max(0, Math.min(1, (SPAWN.y - playerY) / 280));
    const targetZoom = started ? (HUB_ZOOM - approach * 0.06) : INITIAL_ZOOM;
    const targetTilt = started ? (LOW_TILT + (GAME_TILT - LOW_TILT) * Math.max(0.20, approach)) : LOW_TILT;
    zoom += (targetZoom - zoom) * 0.06;
    tilt += (targetTilt - tilt) * 0.06;

    const targetX = started ? WORLD_W / 2 : playerX;
    const targetY = started ? (WORLD_H / 2 + 36 - approach * 72) : (playerY - 26);
    cameraX += (targetX - cameraX) * 0.065;
    cameraY += (targetY - cameraY) * 0.065;
  }

  function worldToScreen(x, y) {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    return { x: (x - cameraX) * zoom + width / 2, y: (y - cameraY) * zoom * tilt + height / 2 };
  }

  function screenToWorld(x, y) {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    return { x: (x - width / 2) / zoom + cameraX, y: (y - height / 2) / (zoom * tilt) + cameraY };
  }

  function withWorldTransform(fn) {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom * tilt);
    ctx.translate(-cameraX, -cameraY);
    fn();
    ctx.restore();
  }

  function drawBackground() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.24, 0, width * 0.5, height * 0.46, Math.max(width, height) * 0.9);
    gradient.addColorStop(0, "rgba(70,48,18,0.76)");
    gradient.addColorStop(0.45, "rgba(13,13,16,0.97)");
    gradient.addColorStop(1, "#020204");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStoneRect(x, y, w, h, fill, stroke = null) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (stroke) { ctx.strokeStyle = stroke; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  }

  function seededShade(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return (n - Math.floor(n));
  }

  function drawStoneFloor() {
    drawStoneRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h, "#151516", "rgba(214,181,92,0.34)");
    const stone = 48;
    for (let y = ROOM.y; y < ROOM.y + ROOM.h; y += stone) {
      for (let x = ROOM.x; x < ROOM.x + ROOM.w; x += stone) {
        const shade = 18 + Math.floor(seededShade(x, y) * 14);
        ctx.fillStyle = `rgba(${shade},${shade},${shade + 2},0.38)`;
        ctx.fillRect(x + 1, y + 1, stone - 2, stone - 2);
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;
    for (let x = ROOM.x; x <= ROOM.x + ROOM.w; x += stone) { ctx.beginPath(); ctx.moveTo(x, ROOM.y); ctx.lineTo(x, ROOM.y + ROOM.h); ctx.stroke(); }
    for (let y = ROOM.y; y <= ROOM.y + ROOM.h; y += stone) { ctx.beginPath(); ctx.moveTo(ROOM.x, y); ctx.lineTo(ROOM.x + ROOM.w, y); ctx.stroke(); }
  }

  function drawCeilingAndBackWall() {
    drawStoneRect(ROOM.x - 16, ROOM.y - 132, ROOM.w + 32, 150, "#09090b", "rgba(214,181,92,0.22)");
    ctx.fillStyle = "rgba(0,0,0,0.54)";
    ctx.fillRect(ROOM.x - 16, ROOM.y - 132, ROOM.w + 32, 36);
    ctx.fillStyle = "rgba(255,216,107,0.055)";
    for (let x = ROOM.x + 34; x < ROOM.x + ROOM.w; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x, ROOM.y - 132);
      ctx.lineTo(x + 32, ROOM.y + 16);
      ctx.lineTo(x - 4, ROOM.y + 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,216,107,0.24)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ROOM.x + 24, ROOM.y - 12);
    ctx.lineTo(ROOM.x + ROOM.w - 24, ROOM.y - 12);
    ctx.stroke();
  }

  function drawFloorDetails() {
    ctx.strokeStyle = "rgba(255,216,107,0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(WORLD_W / 2, 450, 72, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(WORLD_W / 2, 450, 42, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(WORLD_W / 2, 512); ctx.lineTo(WORLD_W / 2, 260); ctx.stroke();
    const light = ctx.createRadialGradient(WORLD_W / 2, 245, 42, WORLD_W / 2, 310, 420);
    light.addColorStop(0, "rgba(255,216,107,0.20)");
    light.addColorStop(0.48, "rgba(255,216,107,0.075)");
    light.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = light;
    ctx.fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  }

  function drawTorch(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "rgba(45,25,12,0.95)";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(0, -7); ctx.stroke();
    ctx.fillStyle = "rgba(255,91,28,0.90)";
    ctx.beginPath(); ctx.moveTo(-7, -5); ctx.quadraticCurveTo(-2, -26, 5, -6); ctx.quadraticCurveTo(13, -16, 7, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,230,110,0.96)";
    ctx.beginPath(); ctx.moveTo(-1, -5); ctx.quadraticCurveTo(3, -15, 5, -3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawDoor(zone) {
    const hot = highlightedZone?.id === zone.id;
    const { x, y, w, h } = zone;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = hot ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.045)";
    ctx.fillRect(x + 12, y + 14, w - 24, h - 24);
    ctx.strokeStyle = zone.color;
    ctx.globalAlpha = hot ? 0.80 + Math.sin(pulse * 0.12) * 0.10 : 0.36;
    ctx.lineWidth = zone.kind === "main" ? 8 : 5;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    ctx.globalAlpha = 1;
    if (zone.kind === "main") {
      ctx.strokeStyle = "rgba(214,181,92,0.36)";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x + w / 2, y + 46, 56, Math.PI, 0); ctx.stroke();
      drawTorch(x - 18, y + h - 26);
      drawTorch(x + w + 18, y + h - 26);
      const glow = ctx.createRadialGradient(x + w / 2, y + h, 18, x + w / 2, y + h, 140);
      glow.addColorStop(0, "rgba(255,216,107,0.38)");
      glow.addColorStop(1, "rgba(255,216,107,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 90, y + h - 56, w + 180, 170);
    }
    drawLabel(zone, x + w / 2, y + h / 2, zone.kind === "main" ? 25 : 16, hot);
    ctx.restore();
  }

  function drawPlaque(zone) {
    const hot = highlightedZone?.id === zone.id;
    ctx.save();
    ctx.translate(zone.x + zone.w / 2, zone.y + zone.h / 2);
    ctx.rotate(zone.x < WORLD_W / 2 ? -0.05 : 0.05);
    ctx.fillStyle = hot ? "rgba(48,42,30,0.96)" : "rgba(22,22,24,0.94)";
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = hot ? 4 : 2;
    ctx.fillRect(-zone.w / 2, -zone.h / 2, zone.w, zone.h);
    ctx.strokeRect(-zone.w / 2, -zone.h / 2, zone.w, zone.h);
    drawLabel(zone, 0, -2, 12, hot, true);
    ctx.restore();
  }

  function drawLabel(zone, x, y, size, hot) {
    const label = zone.label;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,0.86)";
    ctx.fillStyle = hot ? "#ffffff" : zone.color;
    ctx.font = `900 ${size}px Arial`;
    ctx.strokeText(label, x, y - 6);
    ctx.fillText(label, x, y - 6);
    ctx.font = `900 ${Math.max(9, size - 7)}px Arial`;
    ctx.fillStyle = hot ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.70)";
    ctx.fillText(zone.subtitle || "", x, y + size * 0.72);
  }

  function getCharacterSheet(def) {
    if (!def?.image) return null;
    let sheet = titleSpriteCache.get(def.id);
    if (!sheet) {
      sheet = new Image();
      sheet.src = def.image;
      titleSpriteCache.set(def.id, sheet);
    }
    return sheet;
  }

  function drawSelectedCharacter() {
    const def = typeof getCharacterDef === "function" ? getCharacterDef(playerProfile?.characterId) : null;
    const sheet = getCharacterSheet(def);
    const rows = def?.directionRows || { down: 0, up: 1, left: 2, right: 3 };
    const row = Math.abs(aimX) > Math.abs(aimY) ? (aimX < 0 ? rows.left : rows.right) : (aimY < 0 ? rows.up : rows.down);
    const frame = lastMoveLen > 0.08 ? [0, 1, 2, 1][Math.floor(pulse / 12) % 4] : (Number.isFinite(Number(def?.idleFrame)) ? Number(def.idleFrame) : 0);
    const renderW = (Number(def?.renderWidth) || 34) * 1.45;
    const renderH = (Number(def?.renderHeight) || 42) * 1.45;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(playerX, playerY + 10, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (sheet && sheet.complete && sheet.naturalWidth >= def.frameWidth * def.columns && sheet.naturalHeight >= def.frameHeight * def.rows) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet, frame * def.frameWidth, row * def.frameHeight, def.frameWidth, def.frameHeight, playerX - renderW / 2, playerY + PLAYER_RADIUS - renderH, renderW, renderH);
    } else {
      ctx.fillStyle = "#f1f1f1";
      ctx.strokeStyle = "rgba(255,216,107,0.82)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(playerX, playerY - 10, 12, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffd86b"; ctx.beginPath(); ctx.arc(playerX, playerY - 31, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawIntroText() {
    if (started && zoom < 1.85) return;
    const p = worldToScreen(playerX, playerY - 92);
    const alpha = Math.max(0, Math.min(1, (zoom - 1.20) / 1.05));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(32, Math.min(60, (canvas.clientWidth || 900) * 0.07))}px Arial`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.88)";
    ctx.fillStyle = "#ffd86b";
    ctx.strokeText(controlPromptText(), p.x, p.y);
    ctx.fillText(controlPromptText(), p.x, p.y);
    ctx.font = "900 12px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillText("Approach a doorway to choose your path", p.x, p.y + 42);
    ctx.restore();
  }

  function drawTitleHub() {
    drawCeilingAndBackWall();
    drawStoneFloor();
    drawFloorDetails();
    drawDoor(zones[1]);
    drawDoor(zones[2]);
    drawDoor(zones[0]);
    for (const zone of zones.slice(3)) drawPlaque(zone);
    drawSelectedCharacter();
  }

  function draw() {
    if (!ensureDom()) return;
    resizeCanvas();
    resetForTitleIfNeeded();
    if (!active) return;
    updatePlayer();
    updateCamera();
    pulse++;
    drawBackground();
    withWorldTransform(drawTitleHub);
    drawIntroText();
    const status = document.getElementById("titleRoomConnection");
    const titleStatus = document.getElementById("titleConnectionStatus");
    if (status && titleStatus) status.textContent = titleStatus.textContent || "Connection: Connected";
    const help = document.getElementById("titleRoomHelp");
    if (help) help.textContent = started ? (highlightedZone ? `Enter ${highlightedZone.label}` : "Walk into a doorway to choose") : controlPromptText();
  }

  function onPointerDown(event) {
    if (!active || isBlockingTitlePanelOpen()) return;
    pointerId = event.pointerId;
    pointerStart = { x: event.clientX, y: event.clientY };
    pointerMove = { x: 0, y: 0 };
    pointerMoved = false;
    canvas.setPointerCapture?.(event.pointerId);
    if (isMobilePointer()) showTouchGhost();
  }

  function onPointerMove(event) {
    if (pointerId !== event.pointerId || !pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    const len = Math.hypot(dx, dy);
    pointerMoved = pointerMoved || len > 8;
    if (len > 10) {
      const mag = Math.min(1, len / 56);
      pointerMove = { x: (dx / len) * mag, y: (dy / len) * mag };
      markStarted();
    }
  }

  function onPointerUp(event) {
    if (pointerId !== event.pointerId) return;
    const start = pointerStart;
    pointerId = null;
    pointerStart = null;
    pointerMove = { x: 0, y: 0 };
    if (!start || pointerMoved) return;
    const world = screenToWorld(event.clientX, event.clientY);
    const clicked = zones.find(zone => pointInRect(world.x, world.y, { x: zone.x - 18, y: zone.y - 18, w: zone.w + 36, h: zone.h + 36 }));
    if (clicked) {
      markStarted();
      triggerZone(clicked.id, clicked);
    }
  }

  window.addEventListener("keydown", event => {
    const key = event.key?.toLowerCase?.();
    if (!key) return;
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      keysDown.add(key);
      if (isTitleVisible()) markStarted();
    }
  });
  window.addEventListener("keyup", event => keysDown.delete(event.key?.toLowerCase?.()));
  window.addEventListener("gamepadconnected", () => { if (isTitleVisible()) markStarted(); });
  window.addEventListener("resize", () => { if (canvas) resizeCanvas(); });

  function boot() {
    if (!ensureDom()) return;
    const loop = () => { draw(); requestAnimationFrame(loop); };
    loop();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
