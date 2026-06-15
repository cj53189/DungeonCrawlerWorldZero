(function installQuickPartyUi() {
  function safeMembers() {
    const members = Array.isArray(multiplayer?.lobbyMembers) ? multiplayer.lobbyMembers.filter(Boolean) : [];
    if (members.length) return members;
    return [{
      id: multiplayer?.playerId || "local",
      name: playerProfile?.name || "You",
      local: true,
      partyId: multiplayer?.partyId || null,
      floor0Status: multiplayer?.localFloor0Status || "exploring"
    }];
  }

  function localMemberFrom(members) {
    return members.find(member => member.local || member.id === multiplayer?.playerId) || members[0] || null;
  }

  function currentLocalPartyId(members = safeMembers()) {
    const local = localMemberFrom(members);
    return multiplayer?.partyId || local?.partyId || null;
  }

  function countParties(members) {
    const counts = new Map();
    for (const member of members) {
      if (!member?.partyId) continue;
      counts.set(member.partyId, (counts.get(member.partyId) || 0) + 1);
    }
    return counts;
  }

  function normalizePartyCode(code) {
    return String(code || "").trim().toUpperCase();
  }

  function visibleName(member, local = false) {
    if (local) return "You";
    return member?.name || "Crawler";
  }

  function mapHasActiveEntry(map, id) {
    if (!(map instanceof Map) || !id || !map.has(id)) return false;
    const value = map.get(id);
    const expiresAt = typeof value === "number" ? value : Number(value?.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt < Date.now()) {
      map.delete(id);
      return false;
    }
    return true;
  }

  function floorStatusText(member) {
    if (typeof formatMultiplayerCrawlerStatus === "function") {
      return formatMultiplayerCrawlerStatus(member?.floor0Status || (member?.local ? multiplayer?.localFloor0Status : "exploring"));
    }
    return member?.floor0Status || "Exploring";
  }

  function roleText(member, members, partyCounts, localPartyId) {
    const isLocal = !!(member?.local || member?.id === multiplayer?.playerId);
    const localPartySize = localPartyId ? (partyCounts.get(localPartyId) || 0) : 0;
    const memberPartySize = member?.partyId ? (partyCounts.get(member.partyId) || 0) : 0;

    if (isLocal) return localPartySize > 1 ? "You · Party" : "You · Solo";
    if (localPartyId && member?.partyId === localPartyId && localPartySize > 1) return "Party";
    if (mapHasActiveEntry(multiplayer?.pendingPartyInvites, member?.id)) return "Invite Received";
    if (mapHasActiveEntry(multiplayer?.sentPartyInvites, member?.id)) return "Invite Sent";
    if (member?.partyId && memberPartySize > 1) return "Other Party";
    return "Solo";
  }

  function sortedMembers(members, localPartyId) {
    const counts = countParties(members);
    return [...members].sort((a, b) => {
      const aLocal = a.local || a.id === multiplayer?.playerId;
      const bLocal = b.local || b.id === multiplayer?.playerId;
      if (aLocal !== bLocal) return aLocal ? -1 : 1;

      const aAlly = localPartyId && a.partyId === localPartyId && (counts.get(localPartyId) || 0) > 1;
      const bAlly = localPartyId && b.partyId === localPartyId && (counts.get(localPartyId) || 0) > 1;
      if (aAlly !== bAlly) return aAlly ? -1 : 1;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function renderPartySummary(members, localPartyId) {
    const partyCodeEl = document.getElementById("mpPartyCode");
    if (!partyCodeEl) return;

    const partyCode = normalizePartyCode(multiplayer?.partyCode || (!multiplayer?.lobbyCode ? multiplayer?.partyCode : ""));
    const localPartyMembers = localPartyId
      ? members.filter(member => member.partyId === localPartyId)
      : [];
    const partySize = Math.max(1, localPartyMembers.length || (multiplayer?.partyMembers?.length || 0));
    const partyNames = localPartyMembers.length > 1
      ? localPartyMembers.map(member => visibleName(member, member.local || member.id === multiplayer?.playerId)).join(", ")
      : "Solo";

    if (partyCode) {
      partyCodeEl.textContent = `Party Code: ${partyCode} · Party: ${partyNames} (${partySize})`;
    } else if (multiplayer?.lobbyCode) {
      partyCodeEl.textContent = `Room Code: ${multiplayer.lobbyCode} · Party: ${partyNames} (${partySize})`;
    } else {
      partyCodeEl.textContent = `Quick Match · Party: ${partyNames} (${partySize})`;
    }
  }

  function renderMemberList(members, localPartyId) {
    const list = document.getElementById("mpMemberList");
    if (!list) return;

    const partyCounts = countParties(members);
    list.innerHTML = "";
    for (const member of sortedMembers(members, localPartyId)) {
      const isLocal = member.local || member.id === multiplayer?.playerId;
      const role = roleText(member, members, partyCounts, localPartyId);
      const row = document.createElement("div");
      const memberPartySize = member.partyId ? (partyCounts.get(member.partyId) || 0) : 0;
      const isAlly = localPartyId && member.partyId === localPartyId && memberPartySize > 1;
      row.className = [
        "mpMember",
        isLocal ? "mpMemberLocal" : "",
        isAlly ? "mpMemberParty" : "",
        role === "Solo" || role === "You · Solo" ? "mpMemberSolo" : "",
        role.includes("Invite") ? "mpMemberInvite" : ""
      ].filter(Boolean).join(" ");

      const nameSpan = document.createElement("span");
      nameSpan.textContent = `${member.name || "Crawler"}${isLocal ? " (you)" : ""}`;

      const statusSpan = document.createElement("span");
      const floorStatus = currentFloor === 0 || ["start_pending", "active"].includes(multiplayer?.status)
        ? ` · ${floorStatusText(member)}`
        : "";
      statusSpan.textContent = `${role}${floorStatus}`;

      row.append(nameSpan, statusSpan);
      list.appendChild(row);
    }
  }

  function renderCopyButtonText() {
    const text = multiplayer?.partyCode ? "Copy Party Code" : "Copy Game Link";
    for (const id of ["mpCopyInviteBtn", "copyGameLinkBtn"]) {
      const button = document.getElementById(id);
      if (!button || button.classList.contains("copyStatusOk") || button.classList.contains("copyStatusWarn")) continue;
      button.textContent = text;
    }
  }

  function renderQuickPartyUi() {
    if (typeof multiplayer === "undefined" || !multiplayer.enabled) return;
    const members = safeMembers();
    const localPartyId = currentLocalPartyId(members);
    renderPartySummary(members, localPartyId);
    renderMemberList(members, localPartyId);
    renderCopyButtonText();
  }

  function injectQuickPartyStyles() {
    if (document.getElementById("quickPartyUiStyles")) return;
    const style = document.createElement("style");
    style.id = "quickPartyUiStyles";
    style.textContent = `
      .mpMember span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mpMember span:last-child { text-align: right; font-weight: 800; font-size: 10px; color: #cbd3ff; }
      .mpMemberParty { border-color: rgba(156,255,177,0.32); background: rgba(156,255,177,0.08); }
      .mpMemberLocal { border-color: rgba(255,216,107,0.32); }
      .mpMemberSolo span:last-child { color: #d7d7d7; }
      .mpMemberInvite { border-color: rgba(255,216,107,0.48); background: rgba(255,216,107,0.08); }
    `;
    document.head.appendChild(style);
  }

  injectQuickPartyStyles();

  const previousUpdateMultiplayerPanel = typeof updateMultiplayerPanel === "function" ? updateMultiplayerPanel : null;
  if (previousUpdateMultiplayerPanel && !previousUpdateMultiplayerPanel.__quickPartyUiWrapped) {
    updateMultiplayerPanel = function updateMultiplayerPanelWithQuickPartyUi(...args) {
      const result = previousUpdateMultiplayerPanel.apply(this, args);
      renderQuickPartyUi();
      return result;
    };
    updateMultiplayerPanel.__quickPartyUiWrapped = true;
  }

  window.renderQuickPartyUi = renderQuickPartyUi;
  setTimeout(renderQuickPartyUi, 0);
})();

(function installFloor0SpawnHotfix() {
  if (typeof ensureServerFloor0Dungeon !== "function") return;

  ensureServerFloor0Dungeon = function ensureServerFloor0DungeonWithoutLobbyUpdateRespawn() {
    if (!multiplayer.enabled || !multiplayer.usingServer || currentFloor !== 0 || !multiplayer.floor0Metadata?.seed) return;

    const seed = multiplayer.floor0Metadata.seed;
    const alreadyBuiltThisFloor = multiplayer.activeFloor0Seed === seed;

    if (alreadyBuiltThisFloor) {
      // Lobby/status updates happen whenever another crawler reaches stairs.
      // Do not treat those updates like a fresh Floor 0 load, or every client
      // gets teleported back to their safe-room spawn.
      syncSharedFloor0StairsFromDungeon();
      if (typeof updateVisibility === "function") updateVisibility(true);
      if (typeof updateHUD === "function") updateHUD();
      return;
    }

    resetState();
    multiplayer.activeFloor0Seed = seed;
    syncSharedFloor0StairsFromDungeon();
    placeLocalCrawlerAtFloor0Spawn();
    if (typeof updateVisibility === "function") updateVisibility(true);
    if (typeof updateHUD === "function") updateHUD();
  };
})();

(function installFloor0TransitionFix() {
  let lastCollapseNudgeAt = 0;

  function isLocalAdvancing() {
    return multiplayer?.localFloor0Status === "advancing" || multiplayer?.localFloor0Status === "at_stairs";
  }

  function startFloorOneFromServerResolution(message = {}) {
    if (!multiplayer.enabled || !multiplayer.usingServer) return false;
    if (currentFloor === 1 && multiplayer.status === "active") return true;
    if (currentFloor !== 0) return false;
    if (!isLocalAdvancing()) return false;

    if (!message.floorSeed) return false;
    const snapshot = typeof captureRunProgress === "function" ? captureRunProgress() : null;
    currentFloor = Number(message.floor) || 1;
    multiplayer.currentRunId = message.runId || multiplayer.currentRunId;
    multiplayer.currentFloorSeed = String(message.floorSeed);
    multiplayer.currentJoinState = "locked";
    gameWon = false;
    gameLost = false;
    pendingFloorAdvance = false;
    if (typeof setGameMode === "function") setGameMode(GAME_MODES.MULTIPLAYER_ACTIVE);
    multiplayer.status = "active";
    multiplayer.pvpEnabled = false;
    multiplayer.floorStartedAt = Date.now();
    multiplayer.collapseAt = multiplayer.floorStartedAt + (typeof getFloorTimeLimit === "function" ? getFloorTimeLimit() : 540) * 1000;
    multiplayer.remotePlayers = new Map();

    if (typeof resetState === "function") resetState({ preserveRun: true, snapshot });
    if (typeof applyServerFloorSpawnAssignment === "function") applyServerFloorSpawnAssignment(message.spawnAssignment || message.spawnAssignments?.[multiplayer.playerId]);
    if (typeof applyFloor0WorldState === "function") applyFloor0WorldState(message.worldState);
    const center = document.getElementById("centerMessage");
    if (center) center.style.display = "none";
    if (typeof showFloorSplash === "function") showFloorSplash();
    if (typeof updateMultiplayerPanel === "function") updateMultiplayerPanel();
    if (typeof announcer === "function") announcer(message.message || "Floor 1 started for advancing crawlers.");
    return true;
  }

  const originalHandleServerFloor0Resolved = typeof handleServerFloor0Resolved === "function" ? handleServerFloor0Resolved : null;
  if (originalHandleServerFloor0Resolved && !originalHandleServerFloor0Resolved.__floor0TransitionFixWrapped) {
    handleServerFloor0Resolved = function handleServerFloor0ResolvedWithImmediateStart(message) {
      originalHandleServerFloor0Resolved(message);
      const advancing = new Set(message?.advancedPlayerIds || []);
      // Wait for the authoritative floor_start message so Floor 1+ always uses a server-provided seed.
    };
    handleServerFloor0Resolved.__floor0TransitionFixWrapped = true;
  }

  const originalHandleServerFloorStart = typeof handleServerFloorStart === "function" ? handleServerFloorStart : null;
  if (originalHandleServerFloorStart && !originalHandleServerFloorStart.__floor0TransitionFixWrapped) {
    handleServerFloorStart = function handleServerFloorStartIdempotent(message) {
      if (currentFloor === 1 && multiplayer.status === "active") return;
      originalHandleServerFloorStart(message);
      if (Number(message?.floor) === 1 && currentFloor === 0 && isLocalAdvancing()) {
        startFloorOneFromServerResolution(message);
      }
    };
    handleServerFloorStart.__floor0TransitionFixWrapped = true;
  }

  setInterval(() => {
    if (!multiplayer.enabled || !multiplayer.usingServer || currentFloor !== 0) return;
    if (multiplayer.floor0Resolved || multiplayer.status === "active") return;
    if (!multiplayer.collapseAt || Date.now() < multiplayer.collapseAt) return;
    if (multiplayer.localFloor0Status !== "at_stairs" && multiplayer.localFloor0Status !== "advancing") return;
    if (Date.now() - lastCollapseNudgeAt < 1000) return;
    if (typeof isMultiplayerNetworkReady === "function" && !isMultiplayerNetworkReady()) return;

    lastCollapseNudgeAt = Date.now();
    if (typeof sendMultiplayerMessage === "function") {
      sendMultiplayerMessage("floor0_stairs_reached", {
        stairs: multiplayer.floor0Metadata?.stairs || { x: stairwellX, y: stairwellY },
        collapseExpired: true
      });
    }
  }, 1000);
})();
