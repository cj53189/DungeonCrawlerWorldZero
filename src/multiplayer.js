const FLOOR0_COLLAPSE_CAP_SECONDS = Object.freeze({
  1: 15 * 60,
  2: 7 * 60,
  3: 5 * 60,
  4: 3 * 60
});

function floor0CollapseSecondsForCrawlerCount(count) {
  const safeCount = Math.max(1, Math.min(MULTIPLAYER_TARGET_PLAYERS, count || 1));
  return FLOOR0_COLLAPSE_CAP_SECONDS[safeCount] || FLOOR0_COLLAPSE_CAP_SECONDS[MULTIPLAYER_TARGET_PLAYERS];
}

function capLocalFloor0CollapseTimer() {
  if (!multiplayer.enabled || multiplayer.usingServer || currentFloor !== 0) return;
  const cap = floor0CollapseSecondsForCrawlerCount(getLobbyMembers().length || 1);
  floorTimeLeft = Math.min(floorTimeLeft, cap);
  updateHUD();
}

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
  multiplayer.lobbyCode = null;
  multiplayer.partyCode = null;
  multiplayer.roomId = null;
  multiplayer.status = "offline";
  multiplayer.partyId = null;
  multiplayer.lobbyMembers = [];
  multiplayer.partyMembers = [];
  multiplayer.remotePlayers = new Map();
  multiplayer.pvpEnabled = false;
  multiplayer.floorStartedAt = null;
  multiplayer.collapseAt = null;
  multiplayer.isPartyLeader = false;
  multiplayer.stagingEndsAt = null;
  multiplayer.floor0Metadata = null;
  multiplayer.activeFloor0Seed = null;
  multiplayer.usingServer = false;
  multiplayer.networkError = null;
  multiplayer.floor0Resolved = null;
  multiplayer.localFloor0Status = "exploring";
  resetFloor0WorldState();
}

function getLobbyMembers() {
  return multiplayer.lobbyMembers?.length ? multiplayer.lobbyMembers : (multiplayer.partyMembers || []);
}

function syncLocalPartyMembersFromLobby() {
  multiplayer.partyMembers = (multiplayer.lobbyMembers || []).filter(member => member.partyId && member.partyId === multiplayer.partyId);
}

function makeLobbyCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `RUNE-${suffix}`;
}

function ensureLocalLobbyCrawler() {
  const existingLocalMember = multiplayer.lobbyMembers.find(member => member.id === multiplayer.playerId);
  if (existingLocalMember) {
    existingLocalMember.name = playerProfile?.name || "Crawler";
    existingLocalMember.characterId = getCharacterDef(playerProfile?.characterId).id;
    existingLocalMember.floor0Status = multiplayer.localFloor0Status || existingLocalMember.floor0Status || "exploring";
  } else {
    multiplayer.lobbyMembers.unshift({
      id: multiplayer.playerId,
      name: playerProfile?.name || "Crawler",
      characterId: getCharacterDef(playerProfile?.characterId).id,
      leader: multiplayer.isPartyLeader,
      isPartyLeader: multiplayer.isPartyLeader,
      local: true,
      partyId: multiplayer.partyId,
      floor0Status: multiplayer.localFloor0Status || "exploring"
    });
  }
  syncLocalPartyMembersFromLobby();
}


function startSinglePlayer() {
  resetMultiplayerState();
  setGameMode(GAME_MODES.SINGLE_PLAYER);
  hideTitleScreen();
  hideMultiplayerPanel();
  resetState();
  announcer("Single-player run started. Floor 0 is live.");
}

function startMultiplayerFloor0({ lobbyCode = null, leader = false, status = "party" } = {}) {
  multiplayer.enabled = true;
  multiplayer.targetPlayers = MULTIPLAYER_TARGET_PLAYERS;
  multiplayer.lobbyCode = lobbyCode;
  multiplayer.partyCode = lobbyCode;
  multiplayer.roomId = lobbyCode || "QUICK-MATCH";
  multiplayer.status = status;
  multiplayer.partyId = lobbyCode ? `party:${lobbyCode}` : null;
  multiplayer.lobbyMembers = [];
  multiplayer.partyMembers = [];
  multiplayer.remotePlayers = new Map();
  multiplayer.pvpEnabled = false;
  multiplayer.floorStartedAt = null;
  multiplayer.collapseAt = null;
  multiplayer.isPartyLeader = leader;
  multiplayer.stagingEndsAt = null;
  multiplayer.floor0Metadata = null;
  multiplayer.activeFloor0Seed = null;
  multiplayer.usingServer = false;
  multiplayer.networkError = null;
  multiplayer.floor0Resolved = null;
  multiplayer.localFloor0Status = "exploring";
  resetFloor0WorldState();
  ensureLocalLobbyCrawler();

  setGameMode(status === "matchmaking" ? GAME_MODES.MULTIPLAYER_MATCHMAKING : GAME_MODES.MULTIPLAYER_FLOOR0);
  hideTitleScreen();
  resetState();
  updateMultiplayerPanel();
  showMultiplayerPanel();
  capLocalFloor0CollapseTimer();
  announcer("Floor 0 Collapse started. Crawlers registered here should find the stairs before collapse.");
}

function createLobby() {
  if (typeof requestServerCreateLobby === "function" && requestServerCreateLobby()) return;
  startMultiplayerFloor0({ lobbyCode: makeLobbyCode(), leader: true, status: "party" });
}

function joinLobby(code) {
  const cleanedCode = String(code || "").trim().toUpperCase();
  if (!cleanedCode) return;
  if (typeof requestServerJoinLobby === "function" && requestServerJoinLobby(cleanedCode)) return;
  startMultiplayerFloor0({ lobbyCode: cleanedCode, leader: false, status: "party" });
}

function startQuickMatch() {
  if (typeof requestServerQuickMatch === "function" && requestServerQuickMatch()) return;
  startMultiplayerFloor0({ lobbyCode: null, leader: false, status: "matchmaking" });
}

function addMockLobbyCrawler() {
  if (!multiplayer.enabled) return;
  if (getLobbyMembers().length >= multiplayer.targetPlayers) return;
  const nextNumber = getLobbyMembers().length + 1;
  const mockMember = { id: `mock_${nextNumber}`, name: `Crawler ${nextNumber}`, characterId: DEFAULT_CHARACTER_ID, leader: false, isPartyLeader: false, local: false, partyId: multiplayer.partyId, floor0Status: "exploring" };
  multiplayer.lobbyMembers.push(mockMember);
  syncLocalPartyMembersFromLobby();
  multiplayer.status = getLobbyMembers().length >= multiplayer.targetPlayers ? "ready" : multiplayer.status;
  capLocalFloor0CollapseTimer();
  updateMultiplayerPanel();
}

function fillMockLobby() {
  while (getLobbyMembers().length < multiplayer.targetPlayers) addMockLobbyCrawler();
  multiplayer.status = "ready";
  capLocalFloor0CollapseTimer();
  updateMultiplayerPanel();
}

function clearMockLobbyCrawlers() {
  if (!multiplayer.enabled) return;
  multiplayer.lobbyMembers = multiplayer.lobbyMembers.filter(member => member.local);
  syncLocalPartyMembersFromLobby();
  multiplayer.status = multiplayer.lobbyCode ? "party" : "matchmaking";
  updateMultiplayerPanel();
}



function forceLocalMultiplayerStart() {
  if (!multiplayer.enabled) return;
  fillMockLobby();
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
      characterId: getCharacterDef(member.characterId).id,
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
  if (multiplayer.usingServer && currentFloor === 0) return requestServerFloor0StairsReached();
  if (gameMode === GAME_MODES.MULTIPLAYER_STASIS) return true;

  stats.exitFinds++;
  changeAudience(10);
  multiplayer.status = "stasis";
  setGameMode(GAME_MODES.MULTIPLAYER_STASIS);
  gameWon = true;
  pendingFloorAdvance = false;
  achievement("MULTIPLAYER STASIS REQUESTED", `${getFloorLabel()} stairwell stasis is now a client-side test state. A future server will hold you here until all crawlers resolve the floor.`, `multiplayerStasis${currentFloor}`);
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
  if (typeof canDamageCrawler === "function" ? !canDamageCrawler(player, crawler) : (!canCrawlerInitiatePvp(player) || isCrawlerInSafeRoom(crawler))) {
    if (typeof isFriendlyCrawler === "function" && isFriendlyCrawler(player, crawler)) addFloatingFeedbackText("friendly", crawler.x, crawler.y - crawler.r - 8, { anchor: crawler, color: "#7be0ff", size: 12 });
    return false;
  }
  const before = crawler.hp ?? crawler.maxHp ?? player.maxHp;
  crawler.hp = Math.max(0, before - Math.max(0, damage));
  if (typeof applyKnockback === "function") applyKnockback(crawler, player.x, player.y, Math.min(12, 4 + Math.max(0, before - crawler.hp) * 0.2));
  if (crawler.hp <= 0) {
    crawler.status = "downed";
    if (typeof awardPvpKill === "function") awardPvpKill(player, crawler);
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
  if (typeof resetTransientInputState === "function") resetTransientInputState();
  if (typeof resetPlayerDodgeState === "function") resetPlayerDodgeState();
  if (typeof requestServerLeaveLobby === "function") requestServerLeaveLobby();
  resetMultiplayerState();
  setGameMode(GAME_MODES.TITLE);
  if (typeof stopCollapseMusic === "function") stopCollapseMusic();
  hideMultiplayerPanel();
  document.getElementById("centerMessage").style.display = "none";
  showTitleScreen();
}

function updateModeChrome() {
  document.body.classList.toggle("titleActive", gameMode === GAME_MODES.TITLE);
  document.body.classList.toggle("multiplayerActive", isMultiplayerMode());
}

function resolveBossUnlockFromSyncedEnemyState(state) {
  if (!state?.enemyId || currentFloor !== 0) return;

  const defeated = state.alive === false || state.status === "dead" || Number(state.hp) <= 0;
  if (!defeated) return;

  const enemy = Array.isArray(enemies) ? enemies.find(candidate => candidate.enemyId === state.enemyId) : null;
  const matchesBoss = !!enemy?.boss || (!!bossEnemy?.enemyId && bossEnemy.enemyId === state.enemyId);
  if (!matchesBoss) return;

  const resolvedBoss = enemy || bossEnemy || { boss: true, name: "the boss" };
  resolvedBoss.hp = 0;
  resolvedBoss.isDying = false;
  resolvedBoss.pendingAttack = null;
  resolvedBoss.deathAnimationComplete = true;
  if (bossEnemy && bossEnemy.enemyId === state.enemyId) bossEnemy.hp = 0;

  if (typeof completeBossEncounter === "function") completeBossEncounter(resolvedBoss);
  else {
    bossAggroed = false;
    bossDoorsLocked = false;
    pendingBossLocks = [];
    if (typeof clearBossLocks === "function") clearBossLocks();
    if (bossRoom) {
      bossRoom.cleared = true;
      bossRoom.locked = false;
      if (typeof unlockBossDoors === "function") unlockBossDoors(bossRoom);
    }
  }
}

const applyFloor0EnemyStateWithoutBossUnlock = typeof applyFloor0EnemyState === "function" ? applyFloor0EnemyState : null;
if (applyFloor0EnemyStateWithoutBossUnlock) {
  applyFloor0EnemyState = function applyFloor0EnemyStateWithBossUnlock(state, options = {}) {
    const result = applyFloor0EnemyStateWithoutBossUnlock(state, options);
    resolveBossUnlockFromSyncedEnemyState(state);
    return result;
  };
}
