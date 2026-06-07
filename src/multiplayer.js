function setGameMode(nextMode) {
  gameMode = nextMode;
  updateModeChrome();
}

function isTitleMode() {
  return gameMode === GAME_MODES.TITLE;
}

function isMultiplayerMode() {
  return multiplayer.enabled || gameMode === GAME_MODES.MULTIPLAYER_FLOOR0 || gameMode === GAME_MODES.MULTIPLAYER_MATCHMAKING || gameMode === GAME_MODES.MULTIPLAYER_ACTIVE || gameMode === GAME_MODES.MULTIPLAYER_STASIS;
}

function isGameplayUpdatePaused() {
  return gameMode === GAME_MODES.TITLE || gameMode === GAME_MODES.MULTIPLAYER_STASIS;
}

function resetMultiplayerState() {
  multiplayer.enabled = false;
  multiplayer.partyCode = null;
  multiplayer.roomId = null;
  multiplayer.status = "offline";
  multiplayer.partyMembers = [];
  multiplayer.remotePlayers = new Map();
  multiplayer.pvpEnabled = false;
  multiplayer.floorStartedAt = null;
  multiplayer.collapseAt = null;
  multiplayer.isPartyLeader = false;
}

function makePartyCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `RUNE-${suffix}`;
}

function ensureLocalPartyMember() {
  if (!multiplayer.partyMembers.some(member => member.id === multiplayer.playerId)) {
    multiplayer.partyMembers.unshift({ id: multiplayer.playerId, name: "You", leader: multiplayer.isPartyLeader, local: true });
  }
}

function startSinglePlayer() {
  resetMultiplayerState();
  setGameMode(GAME_MODES.SINGLE_PLAYER);
  hideTitleScreen();
  hideMultiplayerPanel();
  resetState();
  announcer("Single-player run started. Floor 0 is live.");
}

function startMultiplayerFloor0({ partyCode = null, leader = false, status = "party" } = {}) {
  multiplayer.enabled = true;
  multiplayer.targetPlayers = MULTIPLAYER_TARGET_PLAYERS;
  multiplayer.partyCode = partyCode;
  multiplayer.roomId = partyCode || "QUICK-MATCH";
  multiplayer.status = status;
  multiplayer.partyMembers = [];
  multiplayer.remotePlayers = new Map();
  multiplayer.pvpEnabled = false;
  multiplayer.floorStartedAt = null;
  multiplayer.collapseAt = null;
  multiplayer.isPartyLeader = leader;
  ensureLocalPartyMember();

  setGameMode(status === "matchmaking" ? GAME_MODES.MULTIPLAYER_MATCHMAKING : GAME_MODES.MULTIPLAYER_FLOOR0);
  hideTitleScreen();
  resetState();
  updateMultiplayerPanel();
  showMultiplayerPanel();
  announcer("Floor 0 party staging online. PvP is disabled while crawlers gather.");
}

function createParty() {
  startMultiplayerFloor0({ partyCode: makePartyCode(), leader: true, status: "party" });
}

function joinParty(code) {
  const cleanedCode = String(code || "").trim().toUpperCase();
  if (!cleanedCode) return;
  startMultiplayerFloor0({ partyCode: cleanedCode, leader: false, status: "party" });
}

function startQuickMatch() {
  startMultiplayerFloor0({ partyCode: null, leader: false, status: "matchmaking" });
}

function addMockPartyMember() {
  if (!multiplayer.enabled) return;
  if (multiplayer.partyMembers.length >= multiplayer.targetPlayers) return;
  const nextNumber = multiplayer.partyMembers.length + 1;
  multiplayer.partyMembers.push({ id: `mock_${nextNumber}`, name: `Crawler ${nextNumber}`, leader: false, local: false });
  multiplayer.status = multiplayer.partyMembers.length >= multiplayer.targetPlayers ? "ready" : multiplayer.status;
  updateMultiplayerPanel();
}

function fillMockParty() {
  while (multiplayer.partyMembers.length < multiplayer.targetPlayers) addMockPartyMember();
  multiplayer.status = "ready";
  updateMultiplayerPanel();
}

function clearMockPartyMembers() {
  if (!multiplayer.enabled) return;
  multiplayer.partyMembers = multiplayer.partyMembers.filter(member => member.local);
  multiplayer.status = multiplayer.partyCode ? "party" : "matchmaking";
  updateMultiplayerPanel();
}

function forceLocalMultiplayerStart() {
  if (!multiplayer.enabled) return;
  fillMockParty();
  multiplayer.status = "starting";
  updateMultiplayerPanel();
  setTimeout(startMockFloorOne, 450);
}

function startMockFloorOne() {
  if (!multiplayer.enabled) return;
  const snapshot = captureRunProgress();
  currentFloor = 1;
  setGameMode(GAME_MODES.MULTIPLAYER_ACTIVE);
  multiplayer.status = "active";
  multiplayer.pvpEnabled = true;
  multiplayer.floorStartedAt = Date.now();
  multiplayer.collapseAt = multiplayer.floorStartedAt + getFloorTimeLimit() * 1000;
  resetState({ preserveRun: true, snapshot });
  placeMockRemoteCrawlers();
  showFloorSplash();
  updateMultiplayerPanel();
  announcer("Local multiplayer test: Floor 1 synchronized start. PvP is enabled outside safe rooms.");
}

function placeMockRemoteCrawlers() {
  multiplayer.remotePlayers = new Map();
  const remoteMembers = multiplayer.partyMembers.filter(member => !member.local).slice(0, multiplayer.targetPlayers - 1);
  if (!remoteMembers.length || !rooms?.length) return;

  const candidates = rooms
    .filter(room => room.type !== "safe" && room !== bossRoom && room.type !== "boss")
    .sort(() => Math.random() - 0.5);

  remoteMembers.forEach((member, index) => {
    const room = candidates[index % Math.max(1, candidates.length)] || rooms[index % rooms.length];
    multiplayer.remotePlayers.set(member.id, {
      id: member.id,
      name: member.name,
      x: (room.cx + 0.5) * TILE,
      y: (room.cy + 0.5) * TILE,
      r: player.r,
      hp: player.maxHp,
      maxHp: player.maxHp,
      status: "active",
      color: ["#75c7ff", "#ff9bd1", "#ffd86b"][index % 3]
    });
  });
}

function requestMultiplayerStasis() {
  if (!multiplayer.enabled) return false;
  if (gameMode === GAME_MODES.MULTIPLAYER_STASIS) return true;

  stats.exitFinds++;
  changeAudience(10);
  multiplayer.status = "stasis";
  setGameMode(GAME_MODES.MULTIPLAYER_STASIS);
  gameWon = true;
  pendingFloorAdvance = false;
  achievement("MULTIPLAYER STASIS REQUESTED", "Floor 1 stairwell stasis is now a client-side test state. A future server will hold you here until all crawlers resolve the floor.", `multiplayerStasis${currentFloor}`);
  updateMultiplayerPanel();
  showCenter(
    "Entered Multiplayer Stasis",
    "PvP is disabled in stasis. In the online build, the server will keep you safe here until the other crawlers reach stasis, die, or the shared collapse timer expires.",
    "Return to Title",
    returnToTitle
  );
  return true;
}

function isPvpFloorActive() {
  return multiplayer.enabled && multiplayer.pvpEnabled && currentFloor >= 1 && gameMode === GAME_MODES.MULTIPLAYER_ACTIVE;
}

function isCrawlerInSafeRoom(crawler) {
  if (!crawler) return false;
  return tileAt(crawler.x, crawler.y) === "S";
}

function canCrawlerInitiatePvp(crawler) {
  return isPvpFloorActive() && !isCrawlerInSafeRoom(crawler);
}

function applySafeRoomPvpFreeze() {
  player.pvpFreezeFrames = PVP_SAFE_ROOM_FREEZE_FRAMES;
  player.attackCooldown = Math.max(player.attackCooldown, PVP_SAFE_ROOM_FREEZE_FRAMES);
  announcer(`Safe room PvP violation: crawler frozen for ${PVP_SAFE_ROOM_FREEZE_SECONDS} seconds.`);
}

function damageRemoteCrawler(crawler, damage) {
  if (!crawler || crawler.status !== "active") return false;
  if (!canCrawlerInitiatePvp(player) || isCrawlerInSafeRoom(crawler)) return false;
  crawler.hp = Math.max(0, (crawler.hp ?? crawler.maxHp ?? player.maxHp) - Math.max(0, damage));
  if (crawler.hp <= 0) {
    crawler.status = "downed";
    changeAudience(8);
    achievement("CRAWLER DOWNED", `${crawler.name || "Crawler"} was downed in PvP outside the safe room.`, `pvpDown_${crawler.id}`);
  } else {
    changeAudience(2);
    announcer(`${crawler.name || "Crawler"} took PvP damage. Safe rooms remain off-limits.`);
  }
  return true;
}

function returnToTitle() {
  pendingFloorAdvance = false;
  resetMultiplayerState();
  setGameMode(GAME_MODES.TITLE);
  hideMultiplayerPanel();
  document.getElementById("centerMessage").style.display = "none";
  showTitleScreen();
}

function updateModeChrome() {
  document.body.classList.toggle("titleActive", gameMode === GAME_MODES.TITLE);
  document.body.classList.toggle("multiplayerActive", isMultiplayerMode());
}
