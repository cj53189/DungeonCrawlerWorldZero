(function installPlayableTitleRoom() {
  "use strict";

  const TILE = 32;
  const WORLD_W = 1184;
  const WORLD_H = 832;
  const ROOM = { x: 96, y: 96, w: 992, h: 632 };
  const SPAWN = { x: WORLD_W / 2, y: 646 };
  const PLAYER_RADIUS = 14;
  const PLAYER_SPEED = 4.05;
  const INITIAL_ZOOM = 2.55;
  const HUB_ZOOM = 0.88;
  const DEFAULT_TILT = 0.72;
  const LOW_TITLE_TILT = 0.54;
  const DOOR_COOLDOWN_MS = 700;
  const STORAGE_SEEN_KEY = "dcw.titleRoom.seenIntro.v2";

  const titleSpriteCache = new Map();
  const keysDown = new Set();

  const zones = [
    {
      id: "startSingleBtn",
      kind: "door",
      label: "Enter the Dungeon",
      subtitle: "Single Player",
      x: 468,
      y: 82,
      w: 248,
      h: 178,
      trigger: { x: 494, y: 232, w: 196, h: 92 },
      color: "#ffd86b",
      priority: "primary"
    },
    {
      id: "quickMatchBtn",
      kind: "door",
      label: "Multiplayer",
      subtitle: "Quick Match",
      x: 214,
      y: 152,
      w: 168,
      h: 132,
      trigger: { x: 220, y: 264, w: 158, h: 72 },
      color: "#9cffb1",
      priority: "secondary"
    },
    {
      id: "characterCreatorBtn",
      kind: "door",
      label: "Character",
      subtitle: "Creator",
      x: 802,
      y: 152,
      w: 168,
      h: 132,
      trigger: { x: 808, y: 264, w: 158, h: 72 },
      color: "#9db1ff",
      priority: "secondary"
    },
    {
      id: "pvpArenaBtn",
      kind: "alcove",
      label: "PvP Arena",
      subtitle: "Test combat",
      x: 154,
      y: 392,
      w: 168,
      h: 86,
      trigger: { x: 138, y: 364, w: 200, h: 142 },
      color: "#ff8fb8"
    },
    {
      id: "joinPartyBtn",
      kind: "sign",
      label: "Join Party",
      subtitle: "Code",
      x: 346,
      y: 484,
      w: 160,
      h: 76,
      trigger: { x: 326, y: 462, w: 200, h: 114 },
      color: "#9cffb1"
    },
    {
      id: "leaderboardBtn",
      kind: "sign",
      label: "Leaderboard",
      subtitle: "Records",
      x: 680,
      y: 484,
      w: 160,
      h: 76,
      trigger: { x: 660, y: 462, w: 200, h: 114 },
      color: "#ffd86b",
      fallback: () => window.DCWZLeaderboard?.show?.()
    },
    {
      id: "copyGameLinkBtn",
      kind: "sign",
      label: "Copy Link",
      subtitle: "Invite",
      x: 858,
      y: 396,
      w: 150,
      h: 70,
      trigger: { x: 838, y: 374, w: 190, h: 108 },
      color: "#d7c0ff"
    },
    {
      id: "localMultiTestBtn",
      kind: "sign",
      label: "Local Test",
      subtitle: "4 Crawlers",
      x: 858,
      y: 556,
      w: 150,
      h: 70,
      trigger: { x: 838, y: 534, w: 190, h: 108 },
      color: "#7cf7ff"
    }
  ];

  let titleScreen = null;
  let canvas = null;
  let ctx = null;
  let hud = null;
  let ghost = null;
  let fallback = null;
  let active = false;
  let started = false;
  let zoom = INITIAL_ZOOM;
  let targetZoom = INITIAL_ZOOM;
  let tilt = LOW_TITLE_TILT;
  let targetTilt = LOW_TITLE_TILT;
  let cameraX = SPAWN.x;
  let cameraY = SPAWN.y - 36;
  let playerX = SPAWN.x;
  let playerY = SPAWN.y;
  let aimX = 0;
  let aimY = -1;
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
        background: #030305;
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
        background: #030305;
        touch-action: none;
        user-select: none;
        z-index: 0;
      }
      .titleRoomHud {
        position: absolute;
        left: 50%;
        top: max(18px, env(safe-area-inset-top));
        transform: translateX(-50%);
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        pointer-events: none;
        text-align: center;
        text-shadow: 0 2px 10px #000, 0 0 22px rgba(0,0,0,0.95);
      }
      .titleRoomGameTitle {
        color: #ffd86b;
        font-weight: 1000;
        letter-spacing: 0.02em;
        font-size: clamp(28px, 5.6vw, 68px);
        line-height: 0.90;
      }
      .titleRoomSubtitle {
        color: #9cffb1;
        font-size: clamp(11px, 2.1vw, 15px);
        font-weight: 900;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .titleRoomHelp {
        position: absolute;
        left: 50%;
        bottom: max(16px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        z-index: 2;
        color: rgba(255,255,255,0.82);
        background: rgba(0,0,0,0.46);
        border: 1px solid rgba(255,216,107,0.24);
        border-radius: 999px;
        padding: 8px 14px;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        pointer-events: none;
        text-align: center;
        text-shadow: 0 1px 4px #000;
      }
      .titleRoomFallback {
        position: absolute;
        right: max(10px, env(safe-area-inset-right));
        bottom: max(10px, env(safe-area-inset-bottom));
        z-index: 3;
        display: flex;
        gap: 6px;
        pointer-events: auto;
        opacity: 0.34;
        transition: opacity 0.18s ease;
      }
      .titleRoomFallback:hover,
      .titleRoomFallback:focus-within { opacity: 1; }
      .titleRoomFallback button {
        border: 1px solid rgba(255,216,107,0.42);
        background: rgba(10,10,12,0.74);
        color: #ffd86b;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 900;
        padding: 7px 9px;
      }
      .titleRoomTouchGhost {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.32s ease;
      }
      .titleRoomTouchGhost.show { opacity: 0.70; }
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
      #leaderboardPanel {
        position: relative;
        z-index: 5;
        margin: auto;
      }
      #titleScreen.dcwTitleRoomReady #leaderboardPanel[style*="block"] {
        display: block !important;
      }
      @media (max-width: 640px) {
        .titleRoomHud { top: max(48px, env(safe-area-inset-top)); }
        .titleRoomGameTitle { font-size: clamp(26px, 8.5vw, 46px); }
        .titleRoomSubtitle { font-size: 11px; }
        .titleRoomFallback { display: none; }
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

    if (!fallback) {
      fallback = document.createElement("div");
      fallback.className = "titleRoomFallback";
      fallback.innerHTML = `<button type="button" data-title-action="startSingleBtn">Enter</button><button type="button" data-title-action="quickMatchBtn">Quick</button><button type="button" data-title-action="characterCreatorBtn">Character</button>`;
      fallback.addEventListener("click", event => {
        const button = event.target.closest("button[data-title-action]");
        if (button) triggerZone(button.dataset.titleAction);
      });
      titleScreen.appendChild(fallback);
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
      ctx.setTransform(dpr, 0, 0, dpr, 0);
    }
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
      targetZoom = zoom;
      tilt = seenIntro ? DEFAULT_TILT : LOW_TITLE_TILT;
      targetTilt = tilt;
      playerX = SPAWN.x;
      playerY = SPAWN.y;
      cameraX = playerX;
      cameraY = playerY - 34;
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
    setTimeout(() => ghost?.classList.remove("show"), 2300);
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

  function distanceToZone(zone) {
    const cx = zone.trigger.x + zone.trigger.w / 2;
    const cy = zone.trigger.y + zone.trigger.h / 2;
    return Math.hypot(playerX - cx, playerY - cy);
  }

  function updatePlayer() {
    const move = currentMoveVector();
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
        if (Date.now() - lastTriggeredAt > DOOR_COOLDOWN_MS && started && zoom < 1.22) triggerZone(zone.id, zone);
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
    const approach = highlightedZone ? 1 : Math.max(0, Math.min(1, (SPAWN.y - playerY) / 360));
    targetZoom = started ? (HUB_ZOOM - approach * 0.05) : INITIAL_ZOOM;
    targetTilt = started ? (LOW_TITLE_TILT + (DEFAULT_TILT - LOW_TITLE_TILT) * Math.max(0.25, approach)) : LOW_TITLE_TILT;
    zoom += (targetZoom - zoom) * 0.055;
    tilt += (targetTilt - tilt) * 0.055;
    const targetX = started ? WORLD_W / 2 : playerX;
    const targetY = started ? (WORLD_H / 2 + 16 - approach * 60) : (playerY - 38);
    cameraX += (targetX - cameraX) * 0.06;
    cameraY += (targetY - cameraY) * 0.06;
  }

  function worldToScreen(x, y) {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    return {
      x: (x - cameraX) * zoom + width / 2,
      y: (y - cameraY) * zoom * tilt + height / 2
    };
  }

  function screenToWorld(x, y) {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    return {
      x: (x - width / 2) / zoom + cameraX,
      y: (y - height / 2) / (zoom * tilt) + cameraY
    };
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
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.28, 0, width * 0.5, height * 0.44, Math.max(width, height) * 0.9);
    gradient.addColorStop(0, "rgba(72,52,20,0.72)");
    gradient.addColorStop(0.42, "rgba(13,13,16,0.96)");
    gradient.addColorStop(1, "#020204");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStoneRect(x, y, w, h, fill, stroke = null) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  }

  function drawCeilingAndBackWall() {
    drawStoneRect(ROOM.x - 20, ROOM.y - 154, ROOM.w + 40, 160, "#0b0b0e", "rgba(214,181,92,0.26)");
    ctx.fillStyle = "rgba(255,216,107,0.05)";
    for (let x = ROOM.x + 42; x < ROOM.x + ROOM.w; x += 86) {
      ctx.beginPath();
      ctx.moveTo(x, ROOM.y - 154);
      ctx.lineTo(x + 28, ROOM.y + 2);
      ctx.lineTo(x - 8, ROOM.y + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(ROOM.x - 20, ROOM.y - 154, ROOM.w + 40, 36);
    ctx.strokeStyle = "rgba(255,216,107,0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ROOM.x + 28, ROOM.y - 28);
    ctx.lineTo(ROOM.x + ROOM.w - 28, ROOM.y - 28);
    ctx.stroke();
  }

  function drawRoomFloor() {
    drawStoneRect(0, 0, WORLD_W, WORLD_H, "#050506");
    drawCeilingAndBackWall();
    drawStoneRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h, "#151517", "rgba(214,181,92,0.40)");

    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;
    for (let x = ROOM.x + TILE; x < ROOM.x + ROOM.w; x += TILE) {
      ctx.beginPath(); ctx.moveTo(x, ROOM.y); ctx.lineTo(x, ROOM.y + ROOM.h); ctx.stroke();
    }
    for (let y = ROOM.y + TILE; y < ROOM.y + ROOM.h; y += TILE) {
      ctx.beginPath(); ctx.moveTo(ROOM.x, y); ctx.lineTo(ROOM.x + ROOM.w, y); ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,216,107,0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(WORLD_W / 2, 560, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(WORLD_W / 2, 560, 54, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,216,107,0.22)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(WORLD_W / 2, 650);
    ctx.lineTo(WORLD_W / 2, 260);
    ctx.stroke();

    const light = ctx.createRadialGradient(WORLD_W / 2, 300, 50, WORLD_W / 2, 360, 500);
    light.addColorStop(0, "rgba(255,216,107,0.22)");
    light.addColorStop(0.45, "rgba(255,216,107,0.08)");
    light.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = light;
    ctx.fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  }

  function drawTorch(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "rgba(50,28,14,0.9)";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(0, -8); ctx.stroke();
    ctx.fillStyle = "rgba(255,91,28,0.88)";
    ctx.beginPath();
    ctx.moveTo(-7, -6); ctx.quadraticCurveTo(-2, -28, 5, -7); ctx.quadraticCurveTo(13, -19, 7, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,230,110,0.96)";
    ctx.beginPath(); ctx.moveTo(-1, -5); ctx.quadraticCurveTo(3, -17, 5, -3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawDoor(zone) {
    const isHot = highlightedZone?.id === zone.id;
    const pulseGlow = isHot ? 0.72 + Math.sin(pulse * 0.12) * 0.12 : 0.32;
    const { x, y, w, h } = zone;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fillRect(x + 10, y + 12, w - 20, h - 20);
    ctx.strokeStyle = zone.color;
    ctx.globalAlpha = pulseGlow;
    ctx.lineWidth = zone.priority === "primary" ? 8 : 5;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    ctx.globalAlpha = 1;

    if (zone.priority === "primary") {
      ctx.strokeStyle = "rgba(214,181,92,0.38)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 44, 62, Math.PI, 0);
      ctx.stroke();
      drawTorch(x - 16, y + h - 28);
      drawTorch(x + w + 16, y + h - 28);
    }

    drawLabel(zone, x + w / 2, y + h / 2, zone.priority === "primary" ? 23 : 17, isHot);
    ctx.restore();
  }

  function drawSign(zone) {
    const isHot = highlightedZone?.id === zone.id;
    ctx.save();
    ctx.translate(zone.x + zone.w / 2, zone.y + zone.h / 2);
    if (zone.kind === "sign") ctx.rotate(zone.x < WORLD_W / 2 ? -0.08 : 0.08);
    ctx.fillStyle = isHot ? "rgba(47,41,28,0.96)" : "rgba(26,26,29,0.94)";
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = isHot ? 4 : 2;
    ctx.fillRect(-zone.w / 2, -zone.h / 2, zone.w, zone.h);
    ctx.strokeRect(-zone.w / 2, -zone.h / 2, zone.w, zone.h);
    drawLabel(zone, 0, -2, 15, isHot, true);
    ctx.restore();
  }

  function drawLabel(zone, x, y, size, isHot, local = false) {
    const lines = zone.label.split(/\s+/);
    const labelLines = zone.label.length > 13 ? [lines.slice(0, Math.ceil(lines.length / 2)).join(" "), lines.slice(Math.ceil(lines.length / 2)).join(" ")] : [zone.label];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,0.86)";
    ctx.fillStyle = isHot ? "#ffffff" : zone.color;
    ctx.font = `900 ${size}px Arial`;
    labelLines.forEach((line, index) => {
      const yy = y + (index - (labelLines.length - 1) / 2) * (size + 2);
      ctx.strokeText(line, x, yy);
      ctx.fillText(line, x, yy);
    });
    ctx.font = `900 ${Math.max(10, size - 7)}px Arial`;
    ctx.fillStyle = isHot ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.74)";
    ctx.fillText(zone.subtitle || "", x, y + labelLines.length * (size * 0.58) + 18);
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
    const moving = currentMoveVector().len > 0.08;
    const frame = moving ? [0, 1, 2, 1][Math.floor(pulse / 12) % 4] : (Number.isFinite(Number(def?.idleFrame)) ? Number(def.idleFrame) : 0);
    const renderW = Number(def?.renderWidth) || 34;
    const renderH = Number(def?.renderHeight) || 42;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(playerX, playerY + 10, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (sheet && sheet.complete && sheet.naturalWidth >= def.frameWidth * def.columns && sheet.naturalHeight >= def.frameHeight * def.rows) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet, frame * def.frameWidth, row * def.frameHeight, def.frameWidth, def.frameHeight, playerX - renderW / 2, playerY + PLAYER_RADIUS - renderH, renderW, renderH);
    } else {
      ctx.fillStyle = "#f1f1f1";
      ctx.strokeStyle = "rgba(255,216,107,0.82)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(playerX, playerY - 10, 12, 20, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ffd86b";
      ctx.beginPath(); ctx.arc(playerX, playerY - 31, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawIntroText() {
    if (started && zoom < 1.85) return;
    const p = worldToScreen(playerX, playerY - 96);
    const alpha = Math.max(0, Math.min(1, (zoom - 1.22) / 1.05));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(34, Math.min(68, (canvas.clientWidth || 900) * 0.078))}px Arial`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.88)";
    ctx.fillStyle = "#ffd86b";
    ctx.strokeText(controlPromptText(), p.x, p.y);
    ctx.fillText(controlPromptText(), p.x, p.y);
    ctx.font = "900 13px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillText("Approach a doorway to choose your path", p.x, p.y + 46);
    ctx.restore();
  }

  function drawTitleHub() {
    drawRoomFloor();
    drawDoor(zones[1]);
    drawDoor(zones[2]);
    drawDoor(zones[0]);
    drawSign(zones[3]);
    drawSign(zones[4]);
    drawSign(zones[5]);
    drawSign(zones[6]);
    drawSign(zones[7]);
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
    if (help) help.textContent = started
      ? (highlightedZone ? `Enter ${highlightedZone.label}` : "Walk into a doorway to choose")
      : controlPromptText();
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
    const loop = () => {
      draw();
      requestAnimationFrame(loop);
    };
    loop();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
