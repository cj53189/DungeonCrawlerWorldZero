function showSafeRoomRecap() {
  const panel = document.getElementById("safeRoomRecap");
  const statsBox = document.getElementById("recapStats");
  const commentBox = document.getElementById("recapComment");
  const rep = updateReputation();
  const safeSeconds = Math.floor(stats.timeInSafeRoomFrames / 60);
  const outsideSeconds = Math.floor(stats.timeOutsideSafeRoomFrames / 60);
  statsBox.innerHTML = `
    <div class="recapLine"><span>Reputation</span><span>${rep}</span></div>
    <div class="recapLine"><span>Level</span><span>${player.level}</span></div>
    <div class="recapLine"><span>XP</span><span>${player.xp}/${player.xpToNext}</span></div>
    <div class="recapLine"><span>Audience</span><span>${audienceScore}</span></div>
    <div class="recapLine"><span>Rooms</span><span>${roomsSeen}/${rooms.length}</span></div>
    <div class="recapLine"><span>Kills</span><span>${stats.enemiesKilled}</span></div>
    <div class="recapLine"><span>Bosses</span><span>${stats.bossesDefeated}</span></div>
    <div class="recapLine"><span>Boxes</span><span>${lootBoxCount()}</span></div>
    <div class="recapLine"><span>Damage</span><span>${stats.damageTaken}</span></div>`;
  commentBox.textContent = getReputationComment(rep);
  panel.style.display = "block";
}
function hideSafeRoomRecap() { document.getElementById("safeRoomRecap").style.display = "none"; }

function toggleSafeRoomRecap() {
  if (!player.safe) { announcer("Performance reviews are only available in safe rooms. The dungeon believes in work-life balance, briefly."); return; }
  const panel = document.getElementById("safeRoomRecap");
  if (panel.style.display === "block") hideSafeRoomRecap(); else showSafeRoomRecap();
}

function updatePrompt() {
  const prompt = document.getElementById("prompt");
  let text = "";

  for (const corpse of corpses) {
    if (corpse.looted) continue;
    const dist = Math.hypot(player.x - corpse.x, player.y - corpse.y);
    if (dist < player.r + corpse.r + 24) {
      text = corpse.boss ? "Loot boss corpse" : "Loot corpse";
      break;
    }
  }

  if (!text) for (const spot of getNearbyTiles()) {
    const t = map[spot.y][spot.x];
    if (t === "L") { text = "Boss door locked"; break; }
    if (t === "D") { text = "Open door"; break; }
    if (t === "C") { text = "Open chest"; break; }
  }
  if (!text && player.safe) text = "Safe Room";
  prompt.textContent = text;
  prompt.style.display = text ? "block" : "none";
}

function achievement(title, body, id = null) {
  const key = id || title + body;
  if (achievements.has(key)) return;
  achievements.add(key);
  addToLog(title, body);
  showPopup(title, body);
}
function announcer(text) { achievement("DUNGEON AI COMMENTARY", text); }

function showPopup(title, body) {
  const wrapper = document.createElement("div");
  const titleEl = document.createElement("div");
  const bodyEl = document.createElement("div");

  wrapper.className = "popup";
  titleEl.className = "title";
  bodyEl.className = "body";
  titleEl.textContent = title;
  bodyEl.textContent = body;
  wrapper.append(titleEl, bodyEl);

  document.getElementById("announcer").prepend(wrapper);
  activePopups.unshift(wrapper);
  while (activePopups.length > MAX_ACTIVE_POPUPS) {
    const oldPopup = activePopups.pop();
    if (oldPopup?.parentNode) oldPopup.remove();
  }
  setTimeout(() => {
    activePopups = activePopups.filter(p => p !== wrapper);
    if (wrapper.parentNode) wrapper.remove();
  }, POPUP_LIFETIME_MS);
}

function addToLog(title, body) {
  achievementHistory.unshift({ title, body });
  achievementHistory = achievementHistory.slice(0, 16);
  renderLog();
}
function renderLog() {
  const entries = document.getElementById("logEntries");
  entries.textContent = "";

  for (const entry of achievementHistory) {
    const wrapper = document.createElement("div");
    const title = document.createElement("div");
    const body = document.createElement("div");

    wrapper.className = "logEntry";
    title.className = "logTitle";
    title.textContent = entry.title;
    body.textContent = entry.body;
    wrapper.append(title, body);
    entries.appendChild(wrapper);
  }
}
function toggleLog() {
  const panel = document.getElementById("logPanel");
  const opening = panel.style.display === "none" || panel.style.display === "";
  panel.style.display = opening ? "block" : "none";
  if (opening && typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
  if (!opening && document.activeElement && panel.contains(document.activeElement)) document.activeElement.blur();
}


function openLogPanel() {
  const panel = document.getElementById("logPanel");
  const recap = document.getElementById("safeRoomRecap");
  if (recap) recap.style.display = "none";
  if (panel) panel.style.display = "block";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function closeLogPanel() {
  const panel = document.getElementById("logPanel");
  if (panel) {
    panel.style.display = "none";
    if (document.activeElement && panel.contains(document.activeElement)) document.activeElement.blur();
  }
}

function openRecapPanel() {
  const recap = document.getElementById("safeRoomRecap");
  const log = document.getElementById("logPanel");
  if (log) log.style.display = "none";

  if (!player.safe) {
    announcer("Performance reviews are only available in safe rooms. The dungeon believes in work-life balance, briefly.");
    return;
  }

  showSafeRoomRecap();
  if (recap) recap.style.display = "block";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function closeRecapPanel() {
  const recap = document.getElementById("safeRoomRecap");
  if (recap) {
    recap.style.display = "none";
    if (document.activeElement && recap.contains(document.activeElement)) document.activeElement.blur();
  }
}


function isVisiblePanel(el) {
  return el && el.style.display === "block";
}

function toggleLogPanelMobile() {
  const log = document.getElementById("logPanel");
  const recap = document.getElementById("safeRoomRecap");

  if (isVisiblePanel(log)) {
    log.style.display = "none";
    if (document.activeElement && log.contains(document.activeElement)) document.activeElement.blur();
    return;
  }

  if (recap) recap.style.display = "none";
  if (log) log.style.display = "block";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function toggleRecapPanelMobile() {
  const recap = document.getElementById("safeRoomRecap");
  const log = document.getElementById("logPanel");

  if (isVisiblePanel(recap)) {
    recap.style.display = "none";
    if (document.activeElement && recap.contains(document.activeElement)) document.activeElement.blur();
    return;
  }

  if (!player.safe) {
    announcer("Performance reviews are only available in safe rooms. The dungeon believes in work-life balance, briefly.");
    return;
  }

  if (log) log.style.display = "none";
  showSafeRoomRecap();
  if (recap) recap.style.display = "block";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function getOpenScrollablePanel() {
  const log = document.getElementById("logPanel");
  const recap = document.getElementById("safeRoomRecap");
  const inv = document.getElementById("inventoryPanel");

  if (isVisiblePanel(log)) return log;
  if (isVisiblePanel(recap)) return recap;
  if (isVisiblePanel(inv)) return inv;
  return null;
}

function updatePanelScrollFromController() {
  if (!gamepadState.connected) return;

  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = Array.from(pads).find(pad => pad && pad.connected !== false);
  if (!gp) return;

  const panel = getOpenScrollablePanel();
  if (!panel) return;

  const rightY = gp.axes[3] || 0;
  const controllerWindowHasButtons = typeof getControllerWindowButtons === "function" && getControllerWindowButtons(panel).length > 0;
  const dpadDown = !controllerWindowHasButtons && gp.buttons[13]?.pressed ? 1 : 0;
  const dpadUp = !controllerWindowHasButtons && gp.buttons[12]?.pressed ? -1 : 0;
  const scrollInput = Math.abs(rightY) > 0.18 ? rightY : (dpadDown + dpadUp);

  if (Math.abs(scrollInput) > 0.05) {
    panel.scrollTop += scrollInput * 12;
  }
}


function setupPanelCloseButtons() {
  const closeLog = document.getElementById("closeLogBtn");
  const closeRecap = document.getElementById("closeRecapBtn");
  const closeInventory = document.getElementById("closeInventoryBtn");

  const bind = (el, fn) => {
    if (!el) return;
    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    };
    el.addEventListener("pointerdown", fire, { passive: false });
    el.addEventListener("touchstart", fire, { passive: false });
    el.addEventListener("click", fire);
  };

  bind(closeLog, closeLogPanel);
  bind(closeRecap, closeRecapPanel);
  bind(closeInventory, closeInventoryPanel);
}


function isControllerWindowVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function getActiveControllerWindow() {
  const selectors = [
    "#centerMessage",
    "#lootWindow",
    "#inventoryPanel",
    "#multiplayerPanel",
    "#titleScreen",
    "#safeRoomRecap",
    "#logPanel"
  ];

  return selectors
    .map(selector => document.querySelector(selector))
    .find(isControllerWindowVisible) || null;
}

function getControllerWindowButtons(root = getActiveControllerWindow()) {
  if (!root) return [];
  return Array.from(root.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit'], [tabindex]"))
    .filter(el => {
      if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
      if (el.tabIndex < 0 && !["BUTTON", "INPUT"].includes(el.tagName)) return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
    });
}

function getPreferredControllerButton(buttons) {
  return buttons.find(button => !button.classList.contains("panelClose")) || buttons[0] || null;
}

function focusControllerWindowButton(button) {
  if (!button) return false;
  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function syncControllerWindowFocus() {
  if (!gamepadState.connected) return false;
  const root = getActiveControllerWindow();
  if (!root) return false;
  const buttons = getControllerWindowButtons(root);
  if (!buttons.length) return false;
  if (root.contains(document.activeElement) && buttons.includes(document.activeElement)) return true;
  return focusControllerWindowButton(getPreferredControllerButton(buttons));
}

function moveControllerWindowFocus(dx, dy) {
  const root = getActiveControllerWindow();
  const buttons = getControllerWindowButtons(root);
  if (!root || !buttons.length) return false;

  const current = root.contains(document.activeElement) && buttons.includes(document.activeElement)
    ? document.activeElement
    : getPreferredControllerButton(buttons);
  if (!current) return false;

  const currentRect = current.getBoundingClientRect();
  const currentCenter = {
    x: currentRect.left + currentRect.width / 2,
    y: currentRect.top + currentRect.height / 2
  };

  let best = null;
  let bestScore = Infinity;
  for (const button of buttons) {
    if (button === current) continue;
    const rect = button.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const offsetX = center.x - currentCenter.x;
    const offsetY = center.y - currentCenter.y;
    const forward = dx ? offsetX * dx : offsetY * dy;
    if (forward <= 4) continue;
    const sideways = dx ? Math.abs(offsetY) : Math.abs(offsetX);
    const score = forward + sideways * 1.65;
    if (score < bestScore) {
      best = button;
      bestScore = score;
    }
  }

  if (!best) {
    const currentIndex = Math.max(0, buttons.indexOf(current));
    const step = dx + dy > 0 ? 1 : -1;
    best = buttons[(currentIndex + step + buttons.length) % buttons.length];
  }

  return focusControllerWindowButton(best);
}

function activateControllerWindowSelection() {
  const root = getActiveControllerWindow();
  const buttons = getControllerWindowButtons(root);
  if (!root || !buttons.length) return false;
  const current = root.contains(document.activeElement) && buttons.includes(document.activeElement)
    ? document.activeElement
    : getPreferredControllerButton(buttons);
  if (!current) return false;
  focusControllerWindowButton(current);
  current.click();
  return true;
}

function hasControllerWindowOpen() {
  return !!getActiveControllerWindow();
}


function formatTimer(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}


function captureRunProgress() {
  return {
    player: {
      level: player.level, xp: player.xp, xpToNext: player.xpToNext,
      maxHp: player.maxHp, hp: player.hp, attackDamage: player.attackDamage,
      baseSpeed: player.baseSpeed, speed: player.speed, defense: player.defense,
      audienceBonus: player.audienceBonus, coins: player.coins,
      currentWeaponId: player.currentWeaponId, aimX: player.aimX, aimY: player.aimY,
      inventory: player.inventory.map(item => ({ ...item })),
      equipment: Object.fromEntries(Object.entries(player.equipment).map(([slot, item]) => [slot, item ? { ...item } : null]))
    },
    stats: { ...stats },
    audienceScore,
    achievementHistory: achievementHistory.map(entry => ({ ...entry })),
    achievements: new Set(achievements)
  };
}

function restoreRunProgress(snapshot) {
  if (!snapshot) return;
  player.level = snapshot.player.level;
  player.xp = snapshot.player.xp;
  player.xpToNext = snapshot.player.xpToNext;
  player.maxHp = snapshot.player.maxHp;
  player.hp = Math.min(snapshot.player.hp, snapshot.player.maxHp);
  player.attackDamage = snapshot.player.attackDamage;
  player.baseSpeed = snapshot.player.baseSpeed;
  player.speed = snapshot.player.speed;
  player.defense = snapshot.player.defense;
  player.audienceBonus = snapshot.player.audienceBonus;
  player.coins = snapshot.player.coins;
  player.currentWeaponId = snapshot.player.currentWeaponId || "fists";
  player.aimX = snapshot.player.aimX || 1;
  player.aimY = snapshot.player.aimY || 0;
  player.inventory = snapshot.player.inventory.map(item => ({ ...item }));
  player.equipment = {weapon:null,head:null,chest:null,legs:null,feet:null,accessory:null,light:null, ...Object.fromEntries(Object.entries(snapshot.player.equipment || {}).map(([slot, item]) => [slot, item ? { ...item } : null]))};

  for (const key of Object.keys(stats)) stats[key] = snapshot.stats[key] ?? 0;
  audienceScore = snapshot.audienceScore;
  achievementHistory = snapshot.achievementHistory.map(entry => ({ ...entry }));
  achievements = new Set(snapshot.achievements);

  recalcEquipmentStats();
  updateInventoryUI();
  renderLog();
}

function showFloorSplash() {
  const splash = document.getElementById("floorSplash");
  if (!splash) return;
  splash.textContent = `Floor ${currentFloor}`;
  splash.style.display = "flex";
  splash.style.animation = "none";
  splash.offsetHeight;
  splash.style.animation = "";
  setTimeout(() => { splash.style.display = "none"; }, 1850);
}

function advanceToNextFloor() {
  if (!pendingFloorAdvance) return;
  const snapshot = captureRunProgress();
  currentFloor++;
  pendingFloorAdvance = false;
  resetState({ preserveRun: true, snapshot });
  showFloorSplash();
}


function showTitleScreen() {
  const title = document.getElementById("titleScreen");
  if (title) title.style.display = "flex";
  updateModeChrome();
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function hideTitleScreen() {
  const title = document.getElementById("titleScreen");
  if (title) title.style.display = "none";
  updateModeChrome();
}

function setMultiplayerPanelOpen(isOpen) {
  const panel = document.getElementById("multiplayerPanel");
  if (panel) panel.style.display = isOpen ? "block" : "none";

  const openButton = document.getElementById("mpOpenPanelBtn");
  if (openButton) {
    const shouldShowOpenButton = multiplayer.enabled && !isOpen;
    openButton.style.display = shouldShowOpenButton ? "block" : "none";
  }
}

function showMultiplayerPanel() {
  setMultiplayerPanelOpen(true);
  updateMultiplayerPanel();
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function hideMultiplayerPanel() {
  setMultiplayerPanelOpen(false);
}

function closeMultiplayerPanel() {
  if (!multiplayer.enabled) return;
  hideMultiplayerPanel();
}

function updateMultiplayerPanel() {
  const panel = document.getElementById("multiplayerPanel");
  if (!panel) return;
  const count = multiplayer.partyMembers.length || 1;
  const statusLabel = {
    offline: "Offline",
    party: multiplayer.usingServer ? "Crawler Lobby" : (multiplayer.isPartyLeader ? "Party Created" : "In Party"),
    matchmaking: "Finding Crawlers",
    ready: "Ready for Floor 1",
    starting: "Starting Floor 1",
    start_pending: "Floor 1 Start Pending",
    active: "Floor 1 Active",
    stasis: "In Stasis"
  }[multiplayer.status] || multiplayer.status;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const countdownText = multiplayer.stagingEndsAt && typeof formatStagingCountdown === "function"
    ? ` · Floor 0 ${formatStagingCountdown(multiplayer.stagingEndsAt)}`
    : "";
  setText("mpStatus", `${statusLabel}${countdownText}`);
  setText("mpCount", `${count} / ${multiplayer.targetPlayers}`);
  setText("mpPartyCode", multiplayer.partyCode ? `Lobby Code: ${multiplayer.partyCode}` : "Quick Match Crawler Lobby");
  const serverRule = multiplayer.usingServer
    ? "Server-owned Crawler Lobby: no host, no ready button. Floor 1 start pending after staging."
    : "Floor 0: tutorial, party-up, matchmaking, and no PvP.";
  setText("mpRuleText", currentFloor === 0
    ? serverRule
    : "Floor 1+: PvP enabled outside safe rooms. Attacking from a safe room freezes you for 5 seconds.");

  const list = document.getElementById("mpMemberList");
  if (list) {
    list.innerHTML = "";
    const members = multiplayer.partyMembers.length ? multiplayer.partyMembers : [{ name: "You", local: true, leader: multiplayer.isPartyLeader }];
    for (const member of members) {
      const row = document.createElement("div");
      row.className = "mpMember";
      const role = member.admin ? "Admin" : (member.leader && !multiplayer.usingServer ? "Leader" : "Crawler");
      row.innerHTML = `<span>${member.name}${member.local ? " (local)" : ""}</span><span>${role}</span>`;
      list.appendChild(row);
    }
  }

  const forceStart = document.getElementById("mpForceStartBtn");
  if (forceStart) forceStart.disabled = !multiplayer.enabled;

  const mockControlsDisabled = multiplayer.usingServer;
  for (const id of ["mpAddMockBtn", "mpFillMockBtn", "mpForceStartBtn"]) {
    const button = document.getElementById(id);
    if (button) button.disabled = mockControlsDisabled || !multiplayer.enabled;
  }
}

function setupTitleScreenHandlers() {
  const bind = (id, handler) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener("click", handler);
  };

  bind("startSingleBtn", startSinglePlayer);
  bind("quickMatchBtn", startQuickMatch);
  bind("createPartyBtn", createParty);
  bind("joinPartyBtn", () => {
    const code = prompt("Enter lobby code", multiplayer.partyCode || "RUNE-");
    if (code) joinParty(code);
  });
  bind("localMultiTestBtn", () => {
    startMultiplayerFloor0({ partyCode: "LOCAL-TEST", leader: true, status: "party" });
    fillMockParty();
  });
  bind("mpAddMockBtn", addMockPartyMember);
  bind("mpFillMockBtn", fillMockParty);
  bind("mpForceStartBtn", forceLocalMultiplayerStart);
  bind("mpCancelBtn", returnToTitle);
  bind("closeMultiplayerPanelBtn", closeMultiplayerPanel);
  bind("mpOpenPanelBtn", showMultiplayerPanel);
}

function updateHUD() {
  const hpNow = Math.max(0, Math.floor(player.hp));
  const hpMax = Math.max(1, player.maxHp);
  const xpNow = Math.max(0, player.xp);
  const xpMax = Math.max(1, player.xpToNext);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("health", hpNow);
  setText("maxHealth", hpMax);
  setText("coins", player.coins);
  setText("playerLevel", player.level);
  setText("playerXP", xpNow);
  setText("xpNext", xpMax);
  setText("audience", audienceScore);
  const weapon = getCurrentWeapon();
  setText("weaponName", weapon.name);
  setText("timer", isFinalDescentWindow() ? `FINAL ${formatTimer(floorTimeLeft)}` : formatTimer(floorTimeLeft));
  setText("roomsSeen", roomsSeen);
  setText("roomTotal", rooms.length);

  const hpFill = document.getElementById("hpFill");
  const hpText = document.getElementById("hpText");
  const xpFill = document.getElementById("xpFill");
  const xpText = document.getElementById("xpText");

  if (hpFill) hpFill.style.width = `${Math.max(0, Math.min(100, (hpNow / hpMax) * 100))}%`;
  if (hpText) hpText.textContent = `${hpNow} / ${hpMax}`;
  if (xpFill) xpFill.style.width = `${Math.max(0, Math.min(100, (xpNow / xpMax) * 100))}%`;
  if (xpText) xpText.textContent = `LV ${player.level} · ${xpNow} / ${xpMax}`;

  const invCount=document.getElementById("inventoryCount"),boxCount=document.getElementById("lootBoxCount"),roomEl=document.getElementById("currentRoomName");
  const floorEl=document.getElementById("floorNumber"),stairEl=document.getElementById("stairStatus");

  if(invCount)invCount.textContent=player.inventory.length;
  if(boxCount)boxCount.textContent=lootBoxCount();
  if(roomEl)roomEl.textContent=currentRoomName;
  if(floorEl)floorEl.textContent=currentFloor;
  if(stairEl)stairEl.textContent=stairwellFound ? "Marked" : "Unknown";

  const stairHud=document.getElementById("stairHud");
  if(stairHud) stairHud.classList.toggle("visible", !!stairwellFound);

  const gpStatus = document.getElementById("gamepadStatus");
  if (gpStatus) gpStatus.textContent = gamepadState.connected ? "Connected" : "Press any button";

  updateReputation();
}

function showCenter(title, text, buttonText = "Generate New Floor", buttonHandler = restartGame) {
  document.getElementById("centerTitle").textContent = title;
  document.getElementById("centerText").textContent = text;
  const button = document.getElementById("centerButton");
  if (button) {
    button.textContent = buttonText;
    button.onclick = buttonHandler;
  }
  document.getElementById("centerMessage").style.display = "flex";
  if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
}

function descendStairwell() {
  if (gameWon || gameLost) return;
  if (multiplayer.enabled && currentFloor === 0) {
    showCenter(
      "Party Staging Floor",
      "Floor 0 is a no-PvP tutorial and matchmaking floor. Use the party panel to gather four crawlers and start the synchronized Floor 1 test.",
      "Keep Training",
      () => { document.getElementById("centerMessage").style.display = "none"; }
    );
    return;
  }
  if (multiplayer.enabled && currentFloor >= 1 && requestMultiplayerStasis()) return;

  stats.exitFinds++;
  changeAudience(10);

  const early = floorTimeLeft > 60;
  const timeText = formatTimer(floorTimeLeft);

  if (early) {
    gameWon = true;
    pendingFloorAdvance = true;
    achievement("STAIRWELL USED: EARLY DESCENT", "You chose survival over glory. In multiplayer, you would now wait in stasis until collapse.", `earlyDescent${currentFloor}`);
    showCenter(
      "Entered Stasis",
      `You descended with ${timeText} remaining. In multiplayer, you would wait here until floor collapse. For prototype testing, press the button when you are ready to advance.`,
      "Skip Countdown",
      advanceToNextFloor
    );
  } else {
    achievement("STAIRWELL USED: FINAL WINDOW", "You waited until the floor was actively trying to murder you. In multiplayer, this would give you a head start on the next floor.", `finalDescent${currentFloor}`);
    pendingFloorAdvance = true;
    advanceToNextFloor();
  }
}
function winGame() {
  gameWon = true;
  achievement("NEW ACHIEVEMENT: Escalator Enthusiast", "You found the exit. This means you get to leave one bad situation and enter a worse one.", "win");
  showCenter("Dungeon Crawler World v1.0 Cleared", "Congratulations, crawler. You survived this procedural floor. The dungeon is already pretending it let you win.");
}
function loseGame() {
  gameLost = true;
  pendingFloorAdvance = false;
  showCenter("You Died", "The dungeon would like to thank you for your brief but educational contribution to slapstick violence.", "Start New Run", restartGame);
}
function restartGame() {
  pendingFloorAdvance = false;
  if (multiplayer.enabled) startMultiplayerFloor0({ partyCode: multiplayer.partyCode, leader: multiplayer.isPartyLeader, status: multiplayer.partyCode ? "party" : "matchmaking" });
  else startSinglePlayer();
}





function updateLightingToggleLabel() {
  const button = document.getElementById("lightingToggle");
  if (!button) return;
  lightingEnabled = true;
  button.textContent = "Lighting LOCKED";
  button.setAttribute("aria-pressed", "true");
  button.disabled = true;
  button.classList.remove("off");
  button.classList.add("locked");
}

function toggleLighting() {
  lightingEnabled = true;
  updateLightingToggleLabel();
  announcer("Lighting controls are disabled. Equip a torch if you want the crawler lit.");
}
