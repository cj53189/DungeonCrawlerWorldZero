(function installPartyVisibilityAndMapSystems() {
  const PARTY_REVEAL_RADIUS_TILES = 5;
  const PARTY_ENEMY_DETECT_RANGE = TILE * 8.5;
  const MINIMAP_ENEMY_DOT_COLOR = "rgba(255,58,58,0.96)";
  const MINIMAP_ENEMY_DOT_STROKE = "rgba(45,0,0,0.9)";

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS;
  }

  function entityTile(entity) {
    return {
      x: Math.max(0, Math.min(MAP_COLS - 1, Math.floor(Number(entity?.x || 0) / TILE))),
      y: Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(Number(entity?.y || 0) / TILE)))
    };
  }

  function entityRoom(entity) {
    const tile = entityTile(entity);
    return typeof roomForTile === "function" ? roomForTile(tile.x, tile.y) : null;
  }

  function localPlayerRoom() {
    return entityRoom(player);
  }

  function isSameRoom(a, b) {
    return !!a && !!b && a.id === b.id;
  }

  function isActiveRemotePartyCrawler(crawler) {
    if (!crawler || crawler.status === "downed" || crawler.status === "failed") return false;
    if (Number.isFinite(Number(crawler.currentFloor)) && Number(crawler.currentFloor) !== currentFloor) return false;
    if (typeof isFriendlyCrawler === "function" && isFriendlyCrawler(player, crawler)) return true;
    if (currentFloor === 0 && multiplayer?.enabled) return true;
    return !!(multiplayer?.partyId && crawler.partyId && crawler.partyId === multiplayer.partyId);
  }

  function getSharedVisionObservers() {
    const observers = [];
    const pet = typeof getActivePet === "function" ? getActivePet() : null;
    if (pet && pet.hp > 0) observers.push({ ...pet, __observerType: "pet" });
    if (multiplayer?.remotePlayers?.size) {
      for (const crawler of multiplayer.remotePlayers.values()) {
        if (isActiveRemotePartyCrawler(crawler)) observers.push({ ...crawler, __observerType: "crawler" });
      }
    }
    return observers;
  }

  function markTileSeen(x, y, makeVisible = false) {
    if (!inBounds(x, y)) return false;
    if (!map?.[y]) return false;
    let changed = false;
    if (!seen[y]?.[x]) {
      seen[y][x] = true;
      changed = true;
    }
    if (makeVisible && !visible[y]?.[x]) {
      visible[y][x] = true;
      changed = true;
    }
    return changed;
  }

  function markRoomDiscovered(room) {
    if (!room || room.seen) return false;
    room.seen = true;
    roomsSeen = Math.min(rooms.length, Math.max(roomsSeen + 1, rooms.filter(candidate => candidate.seen).length));
    return true;
  }

  function exposeObserverRoom(observer, shouldMakeVisible) {
    const room = entityRoom(observer);
    const origin = entityTile(observer);
    let changed = false;

    if (room) {
      if (markRoomDiscovered(room)) changed = true;
      if (typeof forEachRoomTile === "function") {
        forEachRoomTile(room, (x, y) => {
          const visibleThroughObserver = shouldMakeVisible && typeof hasLineOfSight === "function"
            ? hasLineOfSight(observer.x, observer.y, x * TILE + TILE / 2, y * TILE + TILE / 2)
            : shouldMakeVisible;
          if (markTileSeen(x, y, visibleThroughObserver)) changed = true;
        });
      }
    }

    for (let y = origin.y - PARTY_REVEAL_RADIUS_TILES; y <= origin.y + PARTY_REVEAL_RADIUS_TILES; y++) {
      for (let x = origin.x - PARTY_REVEAL_RADIUS_TILES; x <= origin.x + PARTY_REVEAL_RADIUS_TILES; x++) {
        if (!inBounds(x, y)) continue;
        const dist = Math.hypot(x - origin.x, y - origin.y);
        if (dist > PARTY_REVEAL_RADIUS_TILES) continue;
        const visibleThroughObserver = shouldMakeVisible && typeof hasLineOfSight === "function"
          ? hasLineOfSight(observer.x, observer.y, x * TILE + TILE / 2, y * TILE + TILE / 2)
          : shouldMakeVisible;
        if (markTileSeen(x, y, visibleThroughObserver)) changed = true;
      }
    }

    return changed;
  }

  function applySharedPartyMapExposure() {
    if (!map || !seen || !visible || !Array.isArray(rooms)) return false;
    const localRoom = localPlayerRoom();
    let changed = false;

    for (const observer of getSharedVisionObservers()) {
      const observerRoom = entityRoom(observer);
      const sameRoomAsLocal = isSameRoom(observerRoom, localRoom);
      if (exposeObserverRoom(observer, sameRoomAsLocal)) changed = true;
    }

    if (changed) {
      minimapDirty = true;
      if (typeof discoverStairwellIfVisible === "function") discoverStairwellIfVisible();
      if (typeof updateHUD === "function") updateHUD();
    }
    return changed;
  }

  const baseUpdateVisibility = typeof updateVisibility === "function" ? updateVisibility : null;
  if (baseUpdateVisibility && !baseUpdateVisibility.__partySharedMapWrapped) {
    updateVisibility = function updateVisibilityWithPartySharedMap(force = false) {
      baseUpdateVisibility(force);
      applySharedPartyMapExposure();
    };
    updateVisibility.__partySharedMapWrapped = true;
  }

  function screenPositionForEntity(entity) {
    const camX = player.x - canvas.width / 2;
    const camOffsetY = canvas.height / 2 - player.y * CAMERA_TILT_SCALE;
    return {
      x: entity.x - camX,
      y: entity.y * CAMERA_TILT_SCALE + camOffsetY
    };
  }

  function isEntityOnScreen(entity, padding = 80) {
    if (!entity || !Number.isFinite(Number(entity.x)) || !Number.isFinite(Number(entity.y))) return false;
    const p = screenPositionForEntity(entity);
    return p.x >= -padding && p.x <= canvas.width + padding && p.y >= -padding && p.y <= canvas.height + padding;
  }

  window.isPartyEntityRenderable = function isPartyEntityRenderable(entity) {
    if (!entity) return false;
    const tile = entityTile(entity);
    return !!visible?.[tile.y]?.[tile.x] || !!seen?.[tile.y]?.[tile.x] || isEntityOnScreen(entity);
  };

  function observerCanDetectEnemy(observer, enemy) {
    if (!observer || !enemy || enemy.hp <= 0) return false;
    const localRoom = localPlayerRoom();
    const observerRoom = entityRoom(observer);
    const enemyRoom = entityRoom(enemy);
    if (!isSameRoom(observerRoom, localRoom) || !isSameRoom(enemyRoom, localRoom)) return false;
    if (Math.hypot(observer.x - enemy.x, observer.y - enemy.y) > PARTY_ENEMY_DETECT_RANGE) return false;
    return typeof hasLineOfSight !== "function" || hasLineOfSight(observer.x, observer.y, enemy.x, enemy.y);
  }

  window.isEnemyVisibleToPlayerOrParty = function isEnemyVisibleToPlayerOrParty(enemy) {
    if (!enemy || enemy.hp <= 0) return false;
    const tile = entityTile(enemy);
    if (visible?.[tile.y]?.[tile.x]) return true;
    for (const observer of getSharedVisionObservers()) {
      if (observerCanDetectEnemy(observer, enemy)) return true;
    }
    return false;
  };

  window.getDetectedEnemiesForMinimap = function getDetectedEnemiesForMinimap() {
    if (!Array.isArray(enemies)) return [];
    return enemies.filter(enemy => enemy && enemy.hp > 0 && window.isEnemyVisibleToPlayerOrParty(enemy));
  };

  function drawRemotePartyCrawlerOverlays() {
    if (!multiplayer?.remotePlayers?.size) return;
    const camX = player.x - canvas.width / 2;
    ctx.save();
    applyDungeonCameraTransform(camX);
    for (const crawler of multiplayer.remotePlayers.values()) {
      if (!isActiveRemotePartyCrawler(crawler) || !isEntityOnScreen(crawler)) continue;
      const tile = entityTile(crawler);
      if (visible?.[tile.y]?.[tile.x]) continue;
      drawRemoteDodgeEffects(crawler);
      drawRemoteCrawlerSprite(crawler, 0.92);
      if (crawler.maxHp && crawler.status === "active") {
        ctx.fillStyle = "#75c7ff";
        ctx.fillRect(crawler.x - 13, crawler.y - 34, 26 * Math.max(0, crawler.hp ?? crawler.maxHp) / crawler.maxHp, 4);
      }
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(crawler.status === "downed" ? `${crawler.name || "Crawler"} DOWN` : (crawler.name || "Crawler"), crawler.x, crawler.y - 43);
      if (typeof drawPvpKillMarker === "function") drawPvpKillMarker(crawler, 56);
    }
    ctx.restore();
  }

  function drawSharedPetIfNeeded() {
    const pet = typeof getActivePet === "function" ? getActivePet() : null;
    if (!pet || !isEntityOnScreen(pet)) return;
    const tile = entityTile(pet);
    if (visible?.[tile.y]?.[tile.x]) return;
    if (!seen?.[tile.y]?.[tile.x]) return;
    const oldVisible = visible[tile.y][tile.x];
    visible[tile.y][tile.x] = true;
    try { drawActivePet(); }
    finally { visible[tile.y][tile.x] = oldVisible; }
  }

  function layoutForCurrentMinimap() {
    if (typeof isMobileLike === "function" && isMobileLike()) {
      const size = Math.min(120, Math.max(86, Math.floor(canvas.width * 0.28)));
      const radius = size / 2;
      return {
        mode: "mobile",
        centerX: gamepadState.connected ? canvas.width - radius - 14 : canvas.width / 2,
        centerY: canvas.height - radius - 12,
        innerRadius: radius - 4,
        scale: 4.8,
        playerTileX: player.x / TILE,
        playerTileY: player.y / TILE
      };
    }

    const size = 150;
    const radius = size / 2;
    let x0 = canvas.width - size - 14;
    let y0 = canvas.height - size - 14;
    try {
      const saved = JSON.parse(localStorage.getItem("dcw.uiLayout.v1") || "{}").minimap;
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
        x0 = saved.left + 6;
        y0 = saved.top + 6;
      }
    } catch {}
    return {
      mode: "desktop",
      centerX: x0 + radius,
      centerY: y0 + radius,
      innerRadius: radius - 4,
      scale: 5.0,
      playerTileX: player.x / TILE,
      playerTileY: player.y / TILE
    };
  }

  function drawDetectedEnemyMinimapDots() {
    const detected = typeof getDetectedEnemiesForMinimap === "function" ? getDetectedEnemiesForMinimap() : [];
    if (!detected.length) return;
    const layout = layoutForCurrentMinimap();
    ctx.save();
    ctx.fillStyle = MINIMAP_ENEMY_DOT_COLOR;
    ctx.strokeStyle = MINIMAP_ENEMY_DOT_STROKE;
    ctx.lineWidth = 1.2;
    for (const enemy of detected) {
      const x = layout.centerX + ((enemy.x / TILE) - layout.playerTileX) * layout.scale;
      const y = layout.centerY + ((enemy.y / TILE) - layout.playerTileY) * layout.scale;
      if (Math.hypot(x - layout.centerX, y - layout.centerY) > layout.innerRadius) continue;
      ctx.beginPath();
      ctx.arc(x, y, enemy.boss ? 3.4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  const baseDrawMinimap = typeof drawMinimap === "function" ? drawMinimap : null;
  if (baseDrawMinimap && !baseDrawMinimap.__partyEntityOverlayWrapped) {
    drawMinimap = function drawMinimapWithPartyEntityAndEnemyDots() {
      drawRemotePartyCrawlerOverlays();
      drawSharedPetIfNeeded();
      baseDrawMinimap();
      drawDetectedEnemyMinimapDots();
    };
    drawMinimap.__partyEntityOverlayWrapped = true;
  }

  function safeRoomWaypoint() {
    const safeRoom = rooms?.find(room => room.type === "safe") || rooms?.[0] || null;
    return safeRoom ? { room: safeRoom, x: safeRoom.cx, y: safeRoom.cy } : null;
  }

  function revealFloorMapWaypoints({ announce = true, sync = true } = {}) {
    const safe = safeRoomWaypoint();
    let changed = false;
    if (safe?.room) {
      if (markRoomDiscovered(safe.room)) changed = true;
      if (markTileSeen(safe.x, safe.y, false)) changed = true;
    }
    if (Number.isFinite(stairwellX) && Number.isFinite(stairwellY)) {
      if (markTileSeen(stairwellX, stairwellY, false)) changed = true;
      if (!stairwellFound) {
        stairwellFound = true;
        changed = true;
      }
    }
    player.floorMapFound = true;
    window.floorMapFound = true;
    minimapDirty = true;
    visibilityDirty = true;
    if (announce) achievement("FLOOR MAP ACQUIRED", "Safe room and stairwell waypoints are now marked on the party minimap. Congratulations: you have discovered cartography.", `floor_map_${currentFloor}`);
    if (announce && typeof announcer === "function") announcer("Floor map acquired. Safe room and stairwell waypoints marked for the party.");
    if (sync) broadcastWaypointState("floor_map_found");
    if (changed && typeof updateHUD === "function") updateHUD();
    return changed;
  }

  window.revealFloorMapWaypoints = revealFloorMapWaypoints;

  function broadcastWaypointState(kind) {
    if (!multiplayer?.enabled || !multiplayer?.usingServer) return false;
    const event = {
      type: kind || "waypoint_found",
      id: `floor${currentFloor}:party_waypoints`,
      floor: currentFloor,
      stairwellFound: !!stairwellFound,
      floorMapFound: !!(player.floorMapFound || window.floorMapFound),
      stairwell: Number.isFinite(stairwellX) && Number.isFinite(stairwellY) ? { x: stairwellX, y: stairwellY } : null,
      safeRoom: safeRoomWaypoint()
    };
    if (typeof sendFloor0WorldEvent === "function" && currentFloor === 0) return sendFloor0WorldEvent(event);
    if (typeof sendMultiplayerMessage === "function" && typeof isMultiplayerNetworkReady === "function" && isMultiplayerNetworkReady()) {
      return sendMultiplayerMessage("floor0_world_event", { event });
    }
    return false;
  }

  const baseDiscoverStairwellIfVisible = typeof discoverStairwellIfVisible === "function" ? discoverStairwellIfVisible : null;
  if (baseDiscoverStairwellIfVisible && !baseDiscoverStairwellIfVisible.__partyWaypointWrapped) {
    discoverStairwellIfVisible = function discoverStairwellIfVisibleWithPartySync() {
      const hadStairs = !!stairwellFound;
      baseDiscoverStairwellIfVisible();
      if (!hadStairs && stairwellFound) broadcastWaypointState("stairwell_found");
    };
    discoverStairwellIfVisible.__partyWaypointWrapped = true;
  }

  const baseCreateCorpse = typeof createCorpse === "function" ? createCorpse : null;
  if (baseCreateCorpse && !baseCreateCorpse.__floorMapDropWrapped) {
    createCorpse = function createCorpseWithBossFloorMap(enemy) {
      const corpse = baseCreateCorpse(enemy);
      if (corpse && enemy?.boss && !corpse.loot?.some(item => item.type === "floor_map")) {
        corpse.loot = corpse.loot || [];
        corpse.loot.unshift({
          id: typeof makeId === "function" ? makeId("floor_map") : `floor_map_${Date.now()}`,
          type: "floor_map",
          rarity: "Rare",
          name: `Floor ${currentFloor} Map`,
          floor: currentFloor
        });
      }
      return corpse;
    };
    createCorpse.__floorMapDropWrapped = true;
  }

  const baseAwardCorpseLootItem = typeof awardCorpseLootItem === "function" ? awardCorpseLootItem : null;
  if (baseAwardCorpseLootItem && !baseAwardCorpseLootItem.__floorMapWrapped) {
    awardCorpseLootItem = function awardCorpseLootItemWithFloorMap(corpse, item) {
      if (item?.type === "floor_map") {
        revealFloorMapWaypoints({ announce: true, sync: true });
        return true;
      }
      return baseAwardCorpseLootItem(corpse, item);
    };
    awardCorpseLootItem.__floorMapWrapped = true;
  }

  const baseItemDescription = typeof itemDescription === "function" ? itemDescription : null;
  if (baseItemDescription && !baseItemDescription.__floorMapWrapped) {
    itemDescription = function itemDescriptionWithFloorMap(item) {
      if (item?.type === "floor_map") return "Reveals the safe room and stairwell waypoints on the party minimap.";
      return baseItemDescription(item);
    };
    itemDescription.__floorMapWrapped = true;
  }

  const baseSlotIcon = typeof slotIcon === "function" ? slotIcon : null;
  if (baseSlotIcon && !baseSlotIcon.__floorMapWrapped) {
    slotIcon = function slotIconWithFloorMap(item) {
      if (item?.type === "floor_map") return "🗺";
      return baseSlotIcon(item);
    };
    slotIcon.__floorMapWrapped = true;
  }

  const baseApplyFloor0WorldEvent = typeof applyFloor0WorldEvent === "function" ? applyFloor0WorldEvent : null;
  if (baseApplyFloor0WorldEvent && !baseApplyFloor0WorldEvent.__partyWaypointWrapped) {
    applyFloor0WorldEvent = function applyFloor0WorldEventWithPartyWaypoints(event) {
      if (event?.type === "stairwell_found" || event?.type === "floor_map_found" || event?.type === "waypoint_found") {
        if (Number.isFinite(Number(event.floor)) && Number(event.floor) !== currentFloor) return false;
        if (event.stairwell && Number.isFinite(Number(event.stairwell.x)) && Number.isFinite(Number(event.stairwell.y))) {
          stairwellX = Math.trunc(Number(event.stairwell.x));
          stairwellY = Math.trunc(Number(event.stairwell.y));
        }
        if (event.stairwellFound || event.type === "stairwell_found" || event.type === "floor_map_found") stairwellFound = true;
        if (event.floorMapFound || event.type === "floor_map_found") player.floorMapFound = true;
        revealFloorMapWaypoints({ announce: false, sync: false });
        minimapDirty = true;
        return true;
      }
      return baseApplyFloor0WorldEvent(event);
    };
    applyFloor0WorldEvent.__partyWaypointWrapped = true;
  }

  const baseCaptureLocalCrawlerNetworkState = typeof captureLocalCrawlerNetworkState === "function" ? captureLocalCrawlerNetworkState : null;
  if (baseCaptureLocalCrawlerNetworkState && !baseCaptureLocalCrawlerNetworkState.__partyWaypointWrapped) {
    captureLocalCrawlerNetworkState = function captureLocalCrawlerNetworkStateWithWaypoints() {
      const state = baseCaptureLocalCrawlerNetworkState();
      state.stairwellFound = !!stairwellFound;
      state.floorMapFound = !!(player.floorMapFound || window.floorMapFound);
      state.safeRoomFound = !!safeRoomWaypoint()?.room?.seen;
      state.stairwell = Number.isFinite(stairwellX) && Number.isFinite(stairwellY) ? { x: stairwellX, y: stairwellY } : null;
      return state;
    };
    captureLocalCrawlerNetworkState.__partyWaypointWrapped = true;
  }

  const baseCrawlerStateSignature = typeof crawlerStateSignature === "function" ? crawlerStateSignature : null;
  if (baseCrawlerStateSignature && !baseCrawlerStateSignature.__partyWaypointWrapped) {
    crawlerStateSignature = function crawlerStateSignatureWithWaypoints(state) {
      return `${baseCrawlerStateSignature(state)}|stairs:${state.stairwellFound ? 1 : 0}|map:${state.floorMapFound ? 1 : 0}|safe:${state.safeRoomFound ? 1 : 0}`;
    };
    crawlerStateSignature.__partyWaypointWrapped = true;
  }

  const baseApplyServerCrawlerSnapshot = typeof applyServerCrawlerSnapshot === "function" ? applyServerCrawlerSnapshot : null;
  if (baseApplyServerCrawlerSnapshot && !baseApplyServerCrawlerSnapshot.__partyWaypointWrapped) {
    applyServerCrawlerSnapshot = function applyServerCrawlerSnapshotWithWaypoints(snapshot) {
      baseApplyServerCrawlerSnapshot(snapshot);
      for (const crawler of snapshot?.players || []) {
        if (!crawler || crawler.id === multiplayer?.playerId) continue;
        if (crawler.stairwell && Number.isFinite(Number(crawler.stairwell.x)) && Number.isFinite(Number(crawler.stairwell.y))) {
          stairwellX = Math.trunc(Number(crawler.stairwell.x));
          stairwellY = Math.trunc(Number(crawler.stairwell.y));
        }
        if (crawler.stairwellFound || crawler.floorMapFound || crawler.safeRoomFound) {
          if (crawler.stairwellFound || crawler.floorMapFound) stairwellFound = true;
          if (crawler.floorMapFound) player.floorMapFound = true;
          if (crawler.floorMapFound) revealFloorMapWaypoints({ announce: false, sync: false });
          minimapDirty = true;
        }
      }
    };
    applyServerCrawlerSnapshot.__partyWaypointWrapped = true;
  }

  if (PET_DEFINITIONS?.fluffy_cat?.sprite) {
    PET_DEFINITIONS.fluffy_cat.sprite.rowYOffset = {
      ...(PET_DEFINITIONS.fluffy_cat.sprite.rowYOffset || {}),
      2: 7,
      3: 10
    };
  }
})();
