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
  wrapper.className = "popup";
  wrapper.innerHTML = `<div class="title">${title}</div><div class="body">${body}</div>`;
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
  document.getElementById("logEntries").innerHTML = achievementHistory.map(entry => `
    <div class="logEntry"><div class="logTitle">${entry.title}</div><div>${entry.body}</div></div>
  `).join("");
}
function toggleLog() {
  const panel = document.getElementById("logPanel");
  panel.style.display = panel.style.display === "none" || panel.style.display === "" ? "block" : "none";
}


function openLogPanel() {
  const panel = document.getElementById("logPanel");
  const recap = document.getElementById("safeRoomRecap");
  if (recap) recap.style.display = "none";
  if (panel) panel.style.display = "block";
}

function closeLogPanel() {
  const panel = document.getElementById("logPanel");
  if (panel) panel.style.display = "none";
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
}

function closeRecapPanel() {
  const recap = document.getElementById("safeRoomRecap");
  if (recap) recap.style.display = "none";
}


function isVisiblePanel(el) {
  return el && el.style.display === "block";
}

function toggleLogPanelMobile() {
  const log = document.getElementById("logPanel");
  const recap = document.getElementById("safeRoomRecap");

  if (isVisiblePanel(log)) {
    log.style.display = "none";
    return;
  }

  if (recap) recap.style.display = "none";
  if (log) log.style.display = "block";
}

function toggleRecapPanelMobile() {
  const recap = document.getElementById("safeRoomRecap");
  const log = document.getElementById("logPanel");

  if (isVisiblePanel(recap)) {
    recap.style.display = "none";
    return;
  }

  if (!player.safe) {
    announcer("Performance reviews are only available in safe rooms. The dungeon believes in work-life balance, briefly.");
    return;
  }

  if (log) log.style.display = "none";
  showSafeRoomRecap();
  if (recap) recap.style.display = "block";
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
  const dpadDown = gp.buttons[13]?.pressed ? 1 : 0;
  const dpadUp = gp.buttons[12]?.pressed ? -1 : 0;
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
  player.equipment = Object.fromEntries(Object.entries(snapshot.player.equipment).map(([slot, item]) => [slot, item ? { ...item } : null]));

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
}

function descendStairwell() {
  if (gameWon || gameLost) return;

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
function restartGame() { pendingFloorAdvance = false; resetState(); }





function updateLightingToggleLabel() {
  const button = document.getElementById("lightingToggle");
  if (!button) return;
  button.textContent = lightingEnabled ? "Lighting ON" : "Lighting OFF";
  button.setAttribute("aria-pressed", lightingEnabled ? "true" : "false");
  button.classList.toggle("off", !lightingEnabled);
}

function toggleLighting() {
  lightingEnabled = !lightingEnabled;
  updateLightingToggleLabel();
}
