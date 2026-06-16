(function installPlayableTitleRoom() {
  "use strict";

  const WORLD_W = 1080;
  const WORLD_H = 760;
  const ROOM = { x: 90, y: 90, w: 900, h: 560 };
  const PLAYER_RADIUS = 15;
  const PLAYER_SPEED = 4.1;
  const INITIAL_ZOOM = 2.85;
  const ROOM_ZOOM = 0.92;
  const DOOR_COOLDOWN_MS = 650;
  const STORAGE_SEEN_KEY = "dcw.titleRoom.seenIntro.v1";

  const doors = [
    { id: "startSingleBtn", label: "Single Player", short: "Single", x: 445, y: 76, w: 190, h: 88, side: "north", color: "#ffd86b" },
    { id: "quickMatchBtn", label: "Quick Match", short: "Quick", x: 205, y: 92, w: 170, h: 78, side: "north", color: "#9cffb1" },
    { id: "pvpArenaBtn", label: "PvP Arena", short: "PvP", x: 705, y: 92, w: 170, h: 78, side: "north", color: "#ff8fb8" },
    { id: "characterCreatorBtn", label: "Character Creator", short: "Creator", x: 72, y: 250, w: 92, h: 156, side: "west", color: "#9db1ff" },
    { id: "leaderboardBtn", label: "Leaderboard", short: "Ranks", x: 72, y: 440, w: 92, h: 126, side: "west", color: "#ffd86b", fallback: () => window.DCWZLeaderboard?.show?.() },
    { id: "joinPartyBtn", label: "Join Party Code", short: "Join", x: 916, y: 240, w: 92, h: 142, side: "east", color: "#9cffb1" },
    { id: "localMultiTestBtn", label: "Local 4-Crawler Test", short: "Local Test", x: 916, y: 415, w: 92, h: 150, side: "east", color: "#7cf7ff" },
    { id: "copyGameLinkBtn", label: "Copy Game Link", short: "Copy Link", x: 428, y: 632, w: 224, h: 76, side: "south", color: "#d7c0ff" }
  ];

  let titleScreen = null;
  let canvas = null;
  let ctx = null;
  let hud = null;
  let ghost = null;
  let fallback = null;
  let active = false;
  let started = false;
  let introSeen = false;
  let zoom = INITIAL_ZOOM;
  let targetZoom = INITIAL_ZOOM;
  let cameraX = WORLD_W / 2;
  let cameraY = WORLD_H - 170;
  let playerX = WORLD_W / 2;
  let playerY = WORLD_H - 128;
  let aimX = 0;
  let aimY = -1;
  let pulse = 0;
  let highlightedDoor = null;
  let lastTriggeredAt = 0;
  let pointerId = null;
  let pointerStart = null;
  let pointerMove = { x: 0, y: 0 };
  let pointerMoved = false;
  const keysDown = new Set();

  function isMobilePointer() {
    return window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches || window.innerWidth < 780;
  }

  function controlPromptText() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (pads.some(pad => pad?.connected)) return "MOVE LEFT STICK";
    if (isMobilePointer()) return "DRAG TO MOVE";
    return "PRESS W / ↑ / FORWARD";
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
        top: max(14px, env(safe-area-inset-top));
        transform: translateX(-50%);
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        pointer-events: none;
        text-align: center;
        text-shadow: 0 2px 8px #000, 0 0 18px rgba(0,0,0,0.9);
      }
      .titleRoomGameTitle {
        color: #ffd86b;
        font-weight: 1000;
        letter-spacing: 0.03em;
        font-size: clamp(24px, 5.6vw, 64px);
        line-height: 0.9;
      }
      .titleRoomSubtitle {
        color: #9cffb1;
        font-size: clamp(11px, 2.3vw, 15px);
        font-weight: 900;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .titleRoomHelp {
        position: absolute;
        left: 50%;
        bottom: max(14px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        z-index: 2;
        color: rgba(255,255,255,0.78);
        background: rgba(0,0,0,0.44);
        border: 1px solid rgba(255,216,107,0.20);
        border-radius: 999px;
        padding: 7px 12px;
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
        opacity: 0.38;
        transition: opacity 0.18s ease;
      }
      .titleRoomFallback:hover,
      .titleRoomFallback:focus-within { opacity: 1; }
      .titleRoomFallback button {
        border: 1px solid rgba(255,216,107,0.42);
        background: rgba(10,10,12,0.72);
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
      .titleRoomTouchGhost.show { opacity: 0.74; }
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
        .titleRoomGameTitle { font-size: clamp(25px, 8.5vw, 44px); }
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
      help.textContent = "Walk into a doorway to choose";
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
      fallback.innerHTML = `<button type="button" data-title-action="startSingleBtn">Single</button><button type="button" data-title-action="quickMatchBtn">Quick</button><button type="button" data-title-action="characterCreatorBtn">Creator</button>`;
      fallback.addEventListener("click", event => {
        const button = event.target.closest("button[data-title-action]");
        if (button) triggerDoor(button.dataset.titleAction);
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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
      introSeen = localStorage.getItem(STORAGE_SEEN_KEY) === "true";
      started = introSeen;
      zoom = started ? ROOM_ZOOM : INITIAL_ZOOM;
      targetZoom = started ? ROOM_ZOOM : INITIAL_ZOOM;
      playerX = WORLD_W / 2;
      playerY = WORLD_H - 128;
      cameraX = playerX;
      cameraY = playerY - 30;
      highlightedDoor = null;
      if (isMobilePointer() && !introSeen) showTouchGhost();
    } else if (!shouldBeActive && active) {
      active = false;
      pointerId = null;
      pointerMove = { x: 0, y: 0 };
    }
  }

  function showTouchGhost() {
    if (!ghost) return;
    ghost.classList.add("show");
    setTimeout(() => ghost?.classList.remove("show"), 2400);
  }

  function markStarted(source = "input") {
    if (started) return;
    started = true;
    targetZoom = ROOM_ZOOM;
    try { localStorage.setItem(STORAGE_SEEN_KEY, "true"); } catch {}
    ghost?.classList.remove("show");
    const help = document.getElementById("titleRoomHelp");
    if (help) help.textContent = "Walk into a doorway to choose · tap a label as backup";
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
    const x = Math.abs(pad.axes[0] || 0) > 0.18 ? pad.axes[0] : 0;
    const y = Math.abs(pad.axes[1] || 0) > 0.18 ? pad.axes[1] : 0;
    return { x, y };
  }

  function currentMoveVector() {
    const keyboard = keyboardVector();
    const gamepad = gamepadVector();
    let x = keyboard.x + gamepad.x + pointerMove.x;
    let y = keyboard.y + gamepad.y + pointerMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    if (len > 0.08) markStarted("movement");
    return { x, y, len };
  }

  function clampPlayerToRoom() {
    playerX = Math.max(ROOM.x + PLAYER_RADIUS, Math.min(ROOM.x + ROOM.w - PLAYER_RADIUS, playerX));
    playerY = Math.max(ROOM.y + PLAYER_RADIUS, Math.min(ROOM.y + ROOM.h - PLAYER_RADIUS, playerY));
  }

  function doorTriggerZone(door) {
    const pad = 26;
    if (door.side === "north") return { x: door.x + 6, y: door.y + 54, w: door.w - 12, h: 58 };
    if (door.side === "south") return { x: door.x + 8, y: door.y - 30, w: door.w - 16, h: 70 };
    if (door.side === "west") return { x: door.x + door.w - 34, y: door.y + 8, w: 68, h: door.h - 16 };
    if (door.side === "east") return { x: door.x - 34, y: door.y + 8, w: 68, h: door.h - 16 };
    return { x: door.x - pad, y: door.y - pad, w: door.w + pad * 2, h: door.h + pad * 2 };
  }

  function pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
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

    highlightedDoor = null;
    for (const door of doors) {
      if (pointInRect(playerX, playerY, doorTriggerZone(door))) {
        highlightedDoor = door;
        if (Date.now() - lastTriggeredAt > DOOR_COOLDOWN_MS && started && zoom < 1.35) {
          triggerDoor(door.id, door);
        }
        break;
      }
    }
  }

  function triggerDoor(id, door = null) {
    if (!id) return;
    lastTriggeredAt = Date.now();
    const targetDoor = door || doors.find(candidate => candidate.id === id);
    const button = document.getElementById(id);
    if (button) {
      button.click();
      return;
    }
    if (targetDoor?.fallback) targetDoor.fallback();
  }

  function updateCamera() {
    const desiredZoom = started ? ROOM_ZOOM : INITIAL_ZOOM;
    targetZoom = desiredZoom;
    zoom += (targetZoom - zoom) * 0.055;
    const targetX = started ? WORLD_W / 2 : playerX;
    const targetY = started ? WORLD_H / 2 - 12 : playerY - 40;
    cameraX += (targetX - cameraX) * 0.06;
    cameraY += (targetY - cameraY) * 0.06;
  }

  function worldToScreen(x, y) {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    return {
      x: (x - cameraX) * zoom + width / 2,
      y: (y - cameraY) * zoom + height / 2
    };
  }

  function screenToWorld(x, y) {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    return {
      x: (x - width / 2) / zoom + cameraX,
      y: (y - height / 2) / zoom + cameraY
    };
  }

  function withWorldTransform(fn) {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX, -cameraY);
    fn();
    ctx.restore();
  }

  function drawBackground() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.32, 0, width * 0.5, height * 0.45, Math.max(width, height) * 0.8);
    gradient.addColorStop(0, "rgba(68,52,22,0.68)");
    gradient.addColorStop(0.35, "rgba(14,14,16,0.96)");
    gradient.addColorStop(1, "#030305");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawRoomFloor() {
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    ctx.fillStyle = "#141416";
    ctx.fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);

    ctx.strokeStyle = "rgba(214,181,92,0.42)";
    ctx.lineWidth = 8;
    ctx.strokeRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);

    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;
    for (let x = ROOM.x + 32; x < ROOM.x + ROOM.w; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, ROOM.y); ctx.lineTo(x, ROOM.y + ROOM.h); ctx.stroke();
    }
    for (let y = ROOM.y + 32; y < ROOM.y + ROOM.h; y += 32) {
      ctx.beginPath(); ctx.moveTo(ROOM.x, y); ctx.lineTo(ROOM.x + ROOM.w, y); ctx.stroke();
    }

    const glow = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 60, WORLD_W / 2, WORLD_H / 2, 520);
    glow.addColorStop(0, "rgba(255,216,107,0.10)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  }

  function drawDoor(door) {
    const isHot = highlightedDoor?.id === door.id;
    const t = pulse;
    const glowAlpha = isHot ? 0.62 + Math.sin(t * 0.12) * 0.14 : 0.28;
    const rect = { x: door.x, y: door.y, w: door.w, h: door.h };

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    ctx.strokeStyle = door.color;
    ctx.globalAlpha = glowAlpha;
    ctx.lineWidth = isHot ? 7 : 4;
    ctx.strokeRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8);
    ctx.globalAlpha = 1;

    const inner = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    inner.addColorStop(0, isHot ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)");
    inner.addColorStop(1, "rgba(0,0,0,0.30)");
    ctx.fillStyle = inner;
    ctx.fillRect(rect.x + 11, rect.y + 11, rect.w - 22, rect.h - 22);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = isHot ? "900 23px Arial" : "900 20px Arial";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,0.82)";
    ctx.fillStyle = isHot ? "#ffffff" : door.color;

    const label = rect.w < 120 ? door.short : door.label;
    const lines = label.split(/\s+/);
    const textLines = rect.w < 150 && lines.length > 1 ? [lines.slice(0, Math.ceil(lines.length / 2)).join(" "), lines.slice(Math.ceil(lines.length / 2)).join(" ")] : [label];
    textLines.forEach((line, index) => {
      const y = rect.y + rect.h / 2 + (index - (textLines.length - 1) / 2) * 24;
      ctx.strokeText(line, rect.x + rect.w / 2, y);
      ctx.fillText(line, rect.x + rect.w / 2, y);
    });

    if (isHot) {
      ctx.font = "900 12px Arial";
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.fillText("ENTER", rect.x + rect.w / 2, rect.y + rect.h + 18);
    }

    ctx.restore();
  }

  function drawPlayer() {
    const bob = started ? Math.sin(pulse * 0.16) * 1.2 : 0;
    ctx.save();
    ctx.translate(playerX, playerY + bob);
    ctx.fillStyle = "rgba(0,0,0,0.36)";
    ctx.beginPath();
    ctx.ellipse(0, 12, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const angle = Math.atan2(aimY || -1, aimX || 0);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = "#f1f1f1";
    ctx.strokeStyle = "rgba(255,216,107,0.82)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.lineTo(12, 12);
    ctx.lineTo(0, 7);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd86b";
    ctx.beginPath();
    ctx.arc(0, -8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawIntroText() {
    if (started && zoom < 2.1) return;
    const p = worldToScreen(playerX, playerY - 96);
    const alpha = Math.max(0, Math.min(1, (zoom - 1.35) / 1.1));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(34, Math.min(72, (canvas.clientWidth || 900) * 0.08))}px Arial`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.86)";
    ctx.fillStyle = "#ffd86b";
    const text = controlPromptText();
    ctx.strokeText(text, p.x, p.y);
    ctx.fillText(text, p.x, p.y);
    ctx.font = "900 13px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillText("The dungeon is not subtle. Move forward.", p.x, p.y + 46);
    ctx.restore();
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
    withWorldTransform(() => {
      drawRoomFloor();
      for (const door of doors) drawDoor(door);
      drawPlayer();
    });
    drawIntroText();

    const status = document.getElementById("titleRoomConnection");
    const titleStatus = document.getElementById("titleConnectionStatus");
    if (status && titleStatus) status.textContent = titleStatus.textContent || "Connection: Connected";
    const help = document.getElementById("titleRoomHelp");
    if (help) help.textContent = started
      ? (highlightedDoor ? `Enter ${highlightedDoor.label}` : "Walk into a doorway to choose")
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
      pointerMove = { x: dx / Math.max(52, len), y: dy / Math.max(52, len) };
      const mag = Math.min(1, len / 52);
      pointerMove.x *= mag;
      pointerMove.y *= mag;
      markStarted("touch");
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
    const clicked = doors.find(door => pointInRect(world.x, world.y, { x: door.x - 18, y: door.y - 18, w: door.w + 36, h: door.h + 36 }));
    if (clicked) {
      markStarted("tap");
      triggerDoor(clicked.id, clicked);
    }
  }

  window.addEventListener("keydown", event => {
    const key = event.key?.toLowerCase?.();
    if (!key) return;
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      keysDown.add(key);
      if (isTitleVisible()) markStarted("keyboard");
    }
  });
  window.addEventListener("keyup", event => keysDown.delete(event.key?.toLowerCase?.()));
  window.addEventListener("gamepadconnected", () => { if (isTitleVisible()) markStarted("gamepad"); });
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
