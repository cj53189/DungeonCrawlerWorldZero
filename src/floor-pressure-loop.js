// Source-material-inspired floor pressure loop.
// Keeps floors sticky through stairwell timing, daily events, spectacle rewards, and early-descent stasis pressure.
(function installFloorPressureLoop() {
  if (window.__dcwFloorPressureLoopInstalled) return;
  window.__dcwFloorPressureLoopInstalled = true;

  const DAY_SECONDS = 120;
  const MAX_BOSS_WEAKENS = 3;
  let floorLoopState = null;

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function randItem(items) {
    if (!items?.length) return null;
    if (typeof choose === "function") return choose(items);
    return items[Math.floor(Math.random() * items.length)];
  }

  function esc(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value).replace(/[&<>\"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch]));
  }

  function getFloorIdentity(floor = currentFloor) {
    const key = Math.max(0, Math.trunc(safeNumber(floor, 0)));
    return window.FLOOR_IDENTITY_BLUEPRINTS?.[key]
      || window.DEFAULT_FLOOR_IDENTITY_BLUEPRINT
      || { name: `Floor ${key}`, dayMessages: [], aiLines: {}, eventCopy: {} };
  }

  function floorCopy(path, values = {}, fallback = "") {
    const value = path.split(".").reduce((current, key) => current?.[key], getFloorIdentity());
    const template = typeof value === "string" ? value : fallback;
    return template.replace(/\{(\w+)\}/g, (match, key) => values[key] == null ? match : String(values[key]));
  }

  function floorEventTitle(eventType, fallback) {
    const custom = getFloorIdentity().eventCopy?.[eventType]?.title;
    return custom || `${getFloorIdentity().name.toUpperCase()} · ${fallback}`;
  }

  function floorDayMessage(day) {
    const messages = getFloorIdentity().dayMessages || [];
    if (!messages.length) return "The floor has refreshed its opportunities and threats. Staying alive remains optional but recommended.";
    return messages[Math.max(0, day - 2) % messages.length];
  }

  function floorLimit() {
    return typeof getFloorTimeLimit === "function" ? safeNumber(getFloorTimeLimit(), safeNumber(floorTimeLeft, 0)) : safeNumber(floorTimeLeft, 0);
  }

  function elapsedSeconds() {
    return Math.max(0, floorLimit() - safeNumber(floorTimeLeft, 0));
  }

  function currentDungeonDay() {
    return Math.max(1, Math.floor(elapsedSeconds() / DAY_SECONDS) + 1);
  }

  function stairwellPopulateDelay() {
    const limit = floorLimit();
    return Math.min(DAY_SECONDS, Math.max(45, Math.floor(limit * 0.22)));
  }

  function isStairwellPopulatedNow() {
    return elapsedSeconds() >= stairwellPopulateDelay() || (typeof isFinalDescentWindow === "function" && isFinalDescentWindow());
  }

  function resetFloorPressureState() {
    floorLoopState = {
      floor: safeNumber(currentFloor, 0),
      floorLimit: floorLimit(),
      day: currentDungeonDay(),
      lastElapsedSecond: -1,
      stairwellsPopulated: isStairwellPopulatedNow(),
      dormantStairwellSeen: false,
      blockUntilFrame: 0,
      earlyDescentPenaltyApplied: false,
      eventCaches: [],
      activeChallenge: null,
      usedEventTypes: new Set(),
      bossWeakens: 0,
      hazardLevel: 0
    };
    window.floorLoopState = floorLoopState;
    return floorLoopState;
  }

  function state() {
    if (!floorLoopState || floorLoopState.floor !== safeNumber(currentFloor, 0) || floorLoopState.floorLimit !== floorLimit()) {
      return resetFloorPressureState();
    }
    return floorLoopState;
  }

  function addFloorMessage(title, body, id) {
    if (typeof achievement === "function") achievement(title, body, id);
    else if (typeof announcer === "function") announcer(`${title}: ${body}`);
  }

  function visibleStairwellSeen() {
    return Number.isFinite(stairwellX) && Number.isFinite(stairwellY) && !!seen?.[stairwellY]?.[stairwellX];
  }

  function updateStairwellPopulation() {
    const st = state();
    if (st.stairwellsPopulated || !isStairwellPopulatedNow()) return;
    st.stairwellsPopulated = true;
    addFloorMessage(
      `${getFloorIdentity().name.toUpperCase()} · STAIRWELLS POPULATED`,
      floorCopy("aiLines.stairsPopulated", {}, "The stairwells are now active. Leaving is possible. Leaving with a boring brand remains socially punishable."),
      `stairwell_populated_${currentFloor}`
    );
    if (typeof baseDiscoverStairwellIfVisible === "function") baseDiscoverStairwellIfVisible();
    if (typeof updateHUD === "function") updateHUD();
  }

  function pickEventRoom() {
    if (!Array.isArray(rooms)) return null;
    const px = Math.floor(player.x / TILE);
    const py = Math.floor(player.y / TILE);
    const candidates = rooms.filter(room => {
      if (!room || room.type === "safe" || room === bossRoom) return false;
      if (Number.isFinite(stairwellX) && Number.isFinite(stairwellY) && Math.hypot(room.cx - stairwellX, room.cy - stairwellY) < 5) return false;
      if (Math.hypot(room.cx - px, room.cy - py) < 10) return false;
      return roomTileList(room).some(t => map[t.y]?.[t.x] === ".");
    });
    const unseen = candidates.filter(room => !room.seen);
    return randItem(unseen.length ? unseen : candidates);
  }

  function pickOpenTile(room) {
    if (!room) return null;
    const tiles = roomTileList(room, 1).filter(t => map[t.y]?.[t.x] === ".");
    return randItem(tiles.length ? tiles : roomTileList(room).filter(t => map[t.y]?.[t.x] === "."));
  }

  function weakenBossFromDiversion(reason) {
    const st = state();
    if (!bossEnemy || bossEnemy.hp <= 0 || st.bossWeakens >= MAX_BOSS_WEAKENS) return false;
    st.bossWeakens++;
    bossEnemy.maxHp = Math.max(1, Math.round((bossEnemy.maxHp || bossEnemy.hp || 1) * 0.92));
    bossEnemy.hp = Math.min(Math.max(1, bossEnemy.hp || bossEnemy.maxHp), bossEnemy.maxHp);
    bossEnemy.damage = Math.max(4, Math.round((bossEnemy.damage || 10) * 0.94));
    bossEnemy.speed = Math.max(0.35, (bossEnemy.speed || 0.8) * 0.96);
    addFloorMessage(
      "BOSS SYSTEM DEGRADED",
      `${reason}. Boss durability and damage reduced. Optional work has become suspiciously useful.`,
      `boss_weaken_${currentFloor}_${st.bossWeakens}`
    );
    if (typeof addFloatingFeedbackText === "function") addFloatingFeedbackText("BOSS -8%", bossEnemy.x, bossEnemy.y - bossEnemy.r, { anchor: bossEnemy, color: "#7cf7ff", size: 18 });
    return true;
  }

  function placeSponsorCache(day) {
    const st = state();
    const room = pickEventRoom();
    const tile = pickOpenTile(room);
    if (!room || !tile) return false;
    map[tile.y][tile.x] = "C";
    st.eventCaches.push({ x: tile.x, y: tile.y, roomId: room.id, day, opened: false });
    minimapDirty = true;
    visibilityDirty = true;
    addFloorMessage(
      floorEventTitle("sponsorCache", "SPONSOR CACHE DROPPED"),
      floorCopy(
        "eventCopy.sponsorCache.start",
        { day, room: room.name || "an unexplored room" },
        `Day ${day}: a reward cache landed in ${room.name || "an unexplored room"}. The dungeon recommends greed with cardio.`
      ),
      `sponsor_cache_${currentFloor}_${day}`
    );
    return true;
  }

  function spawnBountyElite(day) {
    const room = pickEventRoom();
    const tile = pickOpenTile(room);
    if (!room || !tile || !Array.isArray(enemies)) return false;
    const level = Math.max(2, player.level + Math.ceil(currentFloor / 2) + 1);
    const baseName = currentFloor >= 2 ? "Maintenance Guard" : "Giant Rat";
    const enemy = {
      enemyId: typeof makeId === "function" ? makeId("floor_event_elite") : `floor_event_elite_${Date.now()}`,
      x: tile.x * TILE + TILE / 2,
      y: tile.y * TILE + TILE / 2,
      r: 15,
      level,
      name: `Day ${day} Bounty Elite`,
      hp: 72 + level * 24,
      maxHp: 72 + level * 24,
      damage: 10 + level * 3,
      xpReward: 42 + level * 16,
      speed: 0.82 + level * 0.035,
      aggroRange: 270,
      attackReach: 6,
      damageCooldown: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      roomId: room.id,
      floorEventElite: true,
      floorEventDay: day,
      floorEventRewarded: false
    };
    if (typeof applyEnemyIdentity === "function") applyEnemyIdentity(enemy, { name: baseName });
    enemies.push(enemy);
    addFloorMessage(
      floorEventTitle("bountyElite", "BOUNTY EVENT ACTIVE"),
      `Day ${day}: a named elite has spawned in ${room.name || "the floor"}. Kill it for fame, cash, and boss interference privileges.`,
      `bounty_elite_${currentFloor}_${day}`
    );
    return true;
  }

  function startAudienceChallenge(day) {
    const st = state();
    if (st.activeChallenge && !st.activeChallenge.rewarded && !st.activeChallenge.failed) return false;
    st.activeChallenge = {
      id: `audience_challenge_${currentFloor}_${day}`,
      day,
      expiresDay: day + 1,
      startedKills: safeNumber(stats?.enemiesKilled, 0),
      killsNeeded: 3,
      rewarded: false,
      failed: false
    };
    addFloorMessage(
      floorEventTitle("audienceChallenge", "AUDIENCE CHALLENGE"),
      floorCopy(
        "eventCopy.audienceChallenge.start",
        { day },
        `Day ${day}: kill 3 enemies before the next day cycle. The viewers demand measurable stupidity.`
      ),
      st.activeChallenge.id
    );
    return true;
  }

  function escalateFloorHazard(day) {
    const st = state();
    st.hazardLevel++;
    for (const enemy of enemies || []) {
      if (!enemy || enemy.hp <= 0 || enemy.floorHazardBoosted === st.hazardLevel) continue;
      enemy.speed *= 1.07;
      enemy.floorHazardBoosted = st.hazardLevel;
    }
    if (typeof changeAudience === "function") changeAudience(3);
    addFloorMessage(
      floorEventTitle("hazardEscalation", "FLOOR ESCALATION"),
      floorCopy(
        "eventCopy.hazardEscalation.start",
        { day },
        `Day ${day}: enemies are moving faster. The dungeon has replaced pacing with poor boundaries.`
      ),
      `floor_escalation_${currentFloor}_${day}`
    );
    return true;
  }

  function triggerDailyEvent(day) {
    if (day <= 1 || gameWon || gameLost || collapseStarted) return;
    const st = state();
    const eventFns = [placeSponsorCache, spawnBountyElite, startAudienceChallenge, escalateFloorHazard];
    for (let i = 0; i < eventFns.length; i++) {
      const fn = eventFns[(day + currentFloor + i) % eventFns.length];
      const type = fn.name;
      if (st.usedEventTypes.has(`${type}_${day}`)) continue;
      if (fn(day)) {
        st.usedEventTypes.add(`${type}_${day}`);
        return;
      }
    }
    if (typeof announcer === "function") announcer(`Day ${day} has begun. No sponsored event fired. This is either mercy or a setup.`);
  }

  function rewardChallenge(challenge) {
    if (!challenge || challenge.rewarded) return;
    challenge.rewarded = true;
    if (typeof changeAudience === "function") changeAudience(12);
    player.coins += 24 + currentFloor * 6;
    if (typeof addItem === "function" && typeof generateLootBox === "function") addItem(generateLootBox(true));
    addFloorMessage(
      floorEventTitle("audienceChallenge", "AUDIENCE CHALLENGE CLEARED"),
      floorCopy(
        "eventCopy.audienceChallenge.complete",
        {},
        "The viewers are briefly satisfied. You receive coins, a prize box, and a small reduction in future boss nonsense."
      ),
      `${challenge.id}_complete`
    );
    weakenBossFromDiversion("Audience challenge cleared");
    if (typeof updateHUD === "function") updateHUD();
  }

  function checkChallenge() {
    const st = state();
    const challenge = st.activeChallenge;
    if (!challenge || challenge.rewarded || challenge.failed) return;
    const kills = safeNumber(stats?.enemiesKilled, 0) - challenge.startedKills;
    if (kills >= challenge.killsNeeded) {
      rewardChallenge(challenge);
      return;
    }
    if (currentDungeonDay() > challenge.expiresDay) {
      challenge.failed = true;
      if (typeof announcer === "function") announcer("Audience challenge failed. The viewers are not angry. Worse, they are scrolling.");
      if (typeof changeAudience === "function") changeAudience(-3);
    }
  }

  function checkEventCaches() {
    const st = state();
    for (const cache of st.eventCaches) {
      if (cache.opened) continue;
      if (map?.[cache.y]?.[cache.x] === "C") continue;
      cache.opened = true;
      if (typeof changeAudience === "function") changeAudience(8);
      weakenBossFromDiversion("Sponsor cache recovered");
      addFloorMessage(
        floorEventTitle("sponsorCache", "SPONSOR CACHE RECOVERED"),
        floorCopy(
          "eventCopy.sponsorCache.complete",
          {},
          "You opened the floor event cache. The sponsors applaud the greedy little detour."
        ),
        `sponsor_cache_opened_${currentFloor}_${cache.day}_${cache.x}_${cache.y}`
      );
    }
  }

  function updateFloorPressureLoop() {
    if (gameWon || gameLost || typeof floorTimeLeft !== "number") return;
    const st = state();
    const elapsed = elapsedSeconds();
    if (st.lastElapsedSecond === elapsed) return;
    st.lastElapsedSecond = elapsed;

    updateStairwellPopulation();
    checkEventCaches();
    checkChallenge();

    const day = currentDungeonDay();
    while (st.day < day) {
      st.day++;
      addFloorMessage(
        `${getFloorIdentity().name.toUpperCase()} · DAY ${st.day}`,
        floorDayMessage(st.day),
        `dungeon_day_${currentFloor}_${st.day}`
      );
      triggerDailyEvent(st.day);
    }
  }

  function blockDormantStairwell() {
    const st = state();
    if (safeNumber(frameCount, 0) < st.blockUntilFrame) return;
    st.blockUntilFrame = safeNumber(frameCount, 0) + 90;
    const remaining = Math.max(0, stairwellPopulateDelay() - elapsedSeconds());
    if (typeof announcer === "function") announcer(`Dormant stairwell. Entrances populate in ${typeof formatTimer === "function" ? formatTimer(remaining) : `${remaining}s`}. The dungeon refuses to reward sprint-goblins before the cameras are ready.`);
    if (typeof addPlayerFeedbackText === "function") addPlayerFeedbackText("STAIRS DORMANT", { color: "#7cf7ff", size: 18 });
    if (Number.isFinite(stairwellX) && Number.isFinite(stairwellY)) {
      const sx = stairwellX * TILE + TILE / 2;
      const sy = stairwellY * TILE + TILE / 2;
      let dx = player.x - sx;
      let dy = player.y - sy;
      const len = Math.hypot(dx, dy) || 1;
      if (typeof moveEntity === "function") moveEntity(player, (dx / len) * 30, (dy / len) * 30, { countWallBump: false });
    }
  }

  const baseResetFloorTimerForCurrentFloor = typeof resetFloorTimerForCurrentFloor === "function" ? resetFloorTimerForCurrentFloor : null;
  const baseUpdateFloorTimer = typeof updateFloorTimer === "function" ? updateFloorTimer : null;
  const baseDiscoverStairwellIfVisible = typeof discoverStairwellIfVisible === "function" ? discoverStairwellIfVisible : null;
  const baseDescendStairwell = typeof descendStairwell === "function" ? descendStairwell : null;
  const baseUpdateHUD = typeof updateHUD === "function" ? updateHUD : null;
  const baseShowSafeRoomRecap = typeof showSafeRoomRecap === "function" ? showSafeRoomRecap : null;
  const baseDamageEnemy = typeof damageEnemy === "function" ? damageEnemy : null;

  if (baseResetFloorTimerForCurrentFloor) {
    const patched = function resetFloorTimerWithPressure() {
      const result = baseResetFloorTimerForCurrentFloor.apply(this, arguments);
      resetFloorPressureState();
      return result;
    };
    window.resetFloorTimerForCurrentFloor = patched;
    try { resetFloorTimerForCurrentFloor = patched; } catch {}
  }

  if (baseUpdateFloorTimer) {
    const patched = function updateFloorTimerWithPressure() {
      const result = baseUpdateFloorTimer.apply(this, arguments);
      updateFloorPressureLoop();
      return result;
    };
    window.updateFloorTimer = patched;
    try { updateFloorTimer = patched; } catch {}
  }

  if (baseDiscoverStairwellIfVisible) {
    const patched = function discoverStairwellWithPopulationRule() {
      if (!isStairwellPopulatedNow() && visibleStairwellSeen()) {
        const st = state();
        if (!st.dormantStairwellSeen) {
          st.dormantStairwellSeen = true;
          addFloorMessage(
            `${getFloorIdentity().name.toUpperCase()} · DORMANT STAIRWELL`,
            floorCopy("aiLines.dormantStairwell", {}, "You found where the exit will be. It has not populated yet. Congratulations on locating a future problem."),
            `dormant_stairwell_${currentFloor}`
          );
          if (typeof updateHUD === "function") updateHUD();
        }
        return;
      }
      return baseDiscoverStairwellIfVisible.apply(this, arguments);
    };
    window.discoverStairwellIfVisible = patched;
    try { discoverStairwellIfVisible = patched; } catch {}
  }

  if (baseDescendStairwell) {
    const patched = function descendStairwellWithPressure() {
      if (!isStairwellPopulatedNow()) {
        blockDormantStairwell();
        return;
      }
      const st = state();
      if (floorTimeLeft > 60 && !st.earlyDescentPenaltyApplied) {
        st.earlyDescentPenaltyApplied = true;
        if (typeof changeAudience === "function") changeAudience(-6);
        addFloorMessage(
          `${getFloorIdentity().name.toUpperCase()} · EARLY DESCENT`,
          floorCopy("aiLines.earlyDescent", {}, "You chose the stairs before the floor finished becoming interesting. Survival is valid. Ratings are judgmental."),
          `early_descent_penalty_${currentFloor}`
        );
      }
      return baseDescendStairwell.apply(this, arguments);
    };
    window.descendStairwell = patched;
    try { descendStairwell = patched; } catch {}
  }

  if (baseDamageEnemy) {
    const patched = function damageEnemyWithFloorEvents(enemy) {
      const result = baseDamageEnemy.apply(this, arguments);
      if (enemy?.floorEventElite && enemy.hp <= 0 && !enemy.floorEventRewarded) {
        enemy.floorEventRewarded = true;
        if (typeof changeAudience === "function") changeAudience(14);
        player.coins += 30 + currentFloor * 8;
        if (typeof addItem === "function" && typeof generateLootBox === "function") addItem(generateLootBox(true));
        addFloorMessage(
          "BOUNTY CLAIMED",
          "The event elite is dead. You receive coins, a prize box, and a cleaner shot at the boss. Violence: occasionally productive.",
          `bounty_claimed_${currentFloor}_${enemy.enemyId || enemy.floorEventDay}`
        );
        weakenBossFromDiversion("Bounty elite slain");
        if (typeof updateHUD === "function") updateHUD();
      }
      return result;
    };
    window.damageEnemy = patched;
    try { damageEnemy = patched; } catch {}
  }

  if (baseUpdateHUD) {
    const patched = function updateHUDWithFloorPressure() {
      const result = baseUpdateHUD.apply(this, arguments);
      const st = state();
      const day = currentDungeonDay();
      const delayRemaining = Math.max(0, stairwellPopulateDelay() - elapsedSeconds());
      const stairHud = document.getElementById("stairHud");
      const stairStatus = document.getElementById("stairStatus");
      const collapseLabel = document.getElementById("collapseLabel");
      if (collapseLabel) collapseLabel.textContent = `Day ${day} · Collapse`;
      if (stairStatus) {
        stairStatus.textContent = !isStairwellPopulatedNow()
          ? `Dormant ${typeof formatTimer === "function" ? formatTimer(delayRemaining) : delayRemaining}`
          : stairwellFound ? "Marked" : "Populated";
      }
      if (stairHud) {
        if (!isStairwellPopulatedNow()) {
          stairHud.textContent = `Stairs populate in ${typeof formatTimer === "function" ? formatTimer(delayRemaining) : `${delayRemaining}s`}`;
          stairHud.classList.toggle("visible", st.dormantStairwellSeen || delayRemaining <= 30);
        } else if (stairwellFound) {
          stairHud.textContent = floorTimeLeft > 60 ? "Stairwell marked · early descent = stasis" : "Stairwell marked · final window";
          stairHud.classList.add("visible");
        } else {
          stairHud.textContent = "Stairwells populated · locate an exit";
          stairHud.classList.add("visible");
        }
      }
      return result;
    };
    window.updateHUD = patched;
    try { updateHUD = patched; } catch {}
  }

  if (baseShowSafeRoomRecap) {
    const patched = function showSafeRoomRecapWithFloorPressure() {
      const result = baseShowSafeRoomRecap.apply(this, arguments);
      const statsBox = document.getElementById("recapStats");
      if (!statsBox) return result;
      const st = state();
      const identity = getFloorIdentity();
      const challenge = st.activeChallenge;
      const eventText = challenge && !challenge.rewarded && !challenge.failed
        ? `Challenge: ${Math.max(0, challenge.killsNeeded - (safeNumber(stats?.enemiesKilled, 0) - challenge.startedKills))} kills left`
        : st.eventCaches.some(cache => !cache.opened)
          ? "Sponsor cache active"
          : "No active event";
      statsBox.insertAdjacentHTML("beforeend", [
        `<div class=\"recapLine\"><span>Floor Identity</span><span>${esc(identity.name)}</span></div>`,
        `<div class=\"recapLine\"><span>Floor Read</span><span>${esc(identity.recapLine || identity.stayReason || "Unclassified")}</span></div>`,
        `<div class=\"recapLine\"><span>Dungeon Day</span><span>${currentDungeonDay()}</span></div>`,
        `<div class=\"recapLine\"><span>Stairs</span><span>${esc(isStairwellPopulatedNow() ? (stairwellFound ? "Marked" : "Populated") : "Dormant")}</span></div>`,
        `<div class=\"recapLine\"><span>Floor Event</span><span>${esc(eventText)}</span></div>`,
        `<div class=\"recapLine\"><span>Boss Weakens</span><span>${st.bossWeakens}/${MAX_BOSS_WEAKENS}</span></div>`
      ].join(""));
      return result;
    };
    window.showSafeRoomRecap = patched;
    try { showSafeRoomRecap = patched; } catch {}
  }

  resetFloorPressureState();
})();
