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


  function activePendingInvites(members, localPartyId) {
    if (!(multiplayer?.pendingPartyInvites instanceof Map)) return [];
    const now = Date.now();
    const byId = new Map(members.map(member => [member.id, member]));
    const invites = [];
    for (const [fromPlayerId, invite] of multiplayer.pendingPartyInvites.entries()) {
      const expiresAt = Number(invite?.expiresAt);
      if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now) {
        multiplayer.pendingPartyInvites.delete(fromPlayerId);
        continue;
      }
      const inviter = byId.get(fromPlayerId);
      if (localPartyId && inviter?.partyId === localPartyId) {
        multiplayer.pendingPartyInvites.delete(fromPlayerId);
        continue;
      }
      invites.push({ ...invite, fromPlayerId, fromName: invite?.fromName || inviter?.name || "Crawler", expiresAt });
    }
    return invites.sort((a, b) => String(a.fromName).localeCompare(String(b.fromName)));
  }

  function renderPendingInviteCards(list, members, localPartyId) {
    const invites = activePendingInvites(members, localPartyId);
    if (!invites.length) return;
    const now = Date.now();
    for (const invite of invites) {
      const card = document.createElement("div");
      card.className = "mpPendingInviteCard";

      const text = document.createElement("div");
      text.className = "mpPendingInviteText";
      const seconds = Number.isFinite(invite.expiresAt) ? Math.max(0, Math.ceil((invite.expiresAt - now) / 1000)) : null;
      text.textContent = seconds === null
        ? `${invite.fromName} invited you to party.`
        : `${invite.fromName} invited you to party · ${seconds}s`;

      const actions = document.createElement("div");
      actions.className = "mpPendingInviteActions";
      const accept = document.createElement("button");
      accept.type = "button";
      accept.textContent = "Accept";
      accept.addEventListener("click", () => respondQuickPartyInvite?.(invite.fromPlayerId, true));
      const decline = document.createElement("button");
      decline.type = "button";
      decline.textContent = "Decline";
      decline.addEventListener("click", () => respondQuickPartyInvite?.(invite.fromPlayerId, false));
      actions.append(accept, decline);
      card.append(text, actions);
      list.appendChild(card);
    }
  }

  function renderMemberList(members, localPartyId) {
    const list = document.getElementById("mpMemberList");
    if (!list) return;

    const partyCounts = countParties(members);
    list.innerHTML = "";
    renderPendingInviteCards(list, members, localPartyId);
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

      if (!isLocal) {
        const voiceStatus = typeof getVoiceRemoteStatus === "function"
          ? getVoiceRemoteStatus(member.id)
          : { connected: false, muted: false, volume: 0, channel: "proximity" };
        const voiceLabel = document.createElement("span");
        voiceLabel.className = "mpVoiceStatus";
        voiceLabel.textContent = voiceStatus.muted
          ? "Voice: muted"
          : voiceStatus.channel === "party"
            ? "Voice: party"
            : voiceStatus.volume > 0
              ? "Voice: nearby"
              : voiceStatus.connected
                ? "Voice: far"
                : "Voice: off";

        const muteButton = document.createElement("button");
        muteButton.type = "button";
        muteButton.className = "mpVoiceMuteBtn";
        muteButton.textContent = voiceStatus.muted ? "Unmute" : "Mute";
        muteButton.title = voiceStatus.muted ? "Unmute voice for this crawler" : "Mute voice for this crawler";
        muteButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof toggleVoicePlayerMuted === "function") toggleVoicePlayerMuted(member.id);
          renderQuickPartyUi();
        });

        const voiceControls = document.createElement("div");
        voiceControls.className = "mpVoiceControls";
        voiceControls.append(voiceLabel, muteButton);
        row.appendChild(voiceControls);
      }

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
    if (typeof renderNearbyCrawlersUi === "function") renderNearbyCrawlersUi();
    renderCopyButtonText();
  }

  function injectQuickPartyStyles() {
    if (document.getElementById("quickPartyUiStyles")) return;
    const style = document.createElement("style");
    style.id = "quickPartyUiStyles";
    style.textContent = `
      .mpMember { gap: 6px; }
      .mpMember span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mpMember > span:nth-child(2) { text-align: right; font-weight: 800; font-size: 10px; color: #cbd3ff; }
      .mpVoiceControls { display:flex; align-items:center; justify-content:flex-end; gap:4px; flex-wrap:wrap; }
      .mpVoiceStatus { font-size:9px; font-weight:900; color:#9fd7ff; white-space:nowrap; }
      .mpVoiceMuteBtn { min-height:24px; padding:2px 6px; font-size:10px; font-weight:900; }
      .mpMemberParty { border-color: rgba(156,255,177,0.32); background: rgba(156,255,177,0.08); }
      .mpMemberLocal { border-color: rgba(255,216,107,0.32); }
      .mpMemberSolo > span:nth-child(2) { color: #d7d7d7; }
      .mpMemberInvite { border-color: rgba(255,216,107,0.48); background: rgba(255,216,107,0.08); }
      .mpPendingInviteCard { display:flex; align-items:center; gap:8px; padding:8px; margin:0 0 6px; border:1px solid rgba(255,216,107,0.62); border-radius:8px; background:rgba(255,216,107,0.12); }
      .mpPendingInviteText { flex:1; min-width:0; font-size:12px; font-weight:900; color:#fff2ba; }
      .mpPendingInviteActions { display:flex; gap:6px; }
      .mpPendingInviteActions button { font-weight:900; min-height:30px; }
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
    if (typeof applyServerFloorSpawnAssignment === "function") applyServerFloorSpawnAssignment(message.spawnAssignment || message.spawnAssignments?.[multiplayer.playerId], message);
    if (typeof applyFloor0WorldState === "function") applyFloor0WorldState(message.worldState);
    if (typeof updateVisibility === "function") updateVisibility(true);
    if (typeof updateHUD === "function") updateHUD();
    if (typeof multiplayerNetwork !== "undefined") {
      multiplayerNetwork.lastCrawlerStateSignature = "";
      multiplayerNetwork.lastCrawlerStateSentAt = 0;
    }
    if (typeof maybeSendLocalCrawlerState === "function") maybeSendLocalCrawlerState(0);
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

function getNearbyCrawlerCandidates({ limit = 8, maxDistance = TILE * 8 } = {}) {
  if (!multiplayer?.enabled || !multiplayer.remotePlayers || currentFloor == null) return [];
  const membersById = new Map((multiplayer.lobbyMembers || []).map(member => [member.id, member]));
  const localPartyId = multiplayer.partyId || (multiplayer.lobbyMembers || []).find(member => member.local || member.id === multiplayer.playerId)?.partyId || null;
  const now = Date.now();
  return Array.from(multiplayer.remotePlayers.values())
    .filter(remote => remote && remote.id !== multiplayer.playerId)
    .filter(remote => Number(remote.currentFloor) === Number(currentFloor))
    .filter(remote => (remote.hp ?? 1) > 0 && remote.status !== "downed" && now - (Number(remote.updatedAt) || now) < 10_000)
    .map(remote => {
      const distance = Math.hypot(remote.x - player.x, remote.y - player.y);
      const sameRoom = Number.isFinite(Number(player.currentRoomId)) && Math.trunc(Number(remote.currentRoomId)) === Math.trunc(Number(player.currentRoomId));
      const member = membersById.get(remote.id) || {};
      return {
        ...remote,
        name: member.name || remote.name || "Crawler",
        partyId: member.partyId || remote.partyId || null,
        sameRoom,
        distance,
        inParty: !!(localPartyId && (member.partyId || remote.partyId) === localPartyId),
        inviteSent: multiplayer.sentPartyInvites?.has?.(remote.id)
      };
    })
    .filter(remote => remote.sameRoom || remote.distance <= maxDistance)
    .sort((a, b) => (b.sameRoom - a.sameRoom) || (a.distance - b.distance))
    .slice(0, limit);
}

function getNearbyInviteTarget() {
  return getNearbyCrawlerCandidates({ limit: 1, maxDistance: TILE * 2.25 })[0] || null;
}

function renderNearbyCrawlersUi() {
  const list = document.getElementById("mpNearbyCrawlerList");
  if (!list) return;
  const crawlers = getNearbyCrawlerCandidates({ limit: 8 });
  list.innerHTML = "";
  if (!crawlers.length) {
    const empty = document.createElement("div");
    empty.className = "mpNearbyEmpty";
    empty.textContent = "No same-floor crawlers nearby.";
    list.appendChild(empty);
    return;
  }
  for (const crawler of crawlers) {
    const row = document.createElement("div");
    row.className = "mpMember mpNearbyCrawler";
    const info = document.createElement("span");
    info.textContent = `${crawler.name} · ${crawler.sameRoom ? "Same room" : "Nearby"}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mpNearbyInviteBtn";
    if (crawler.inParty) { button.textContent = "In Party"; button.disabled = true; }
    else if (crawler.inviteSent) { button.textContent = "Invite Sent"; button.disabled = true; }
    else { button.textContent = "Invite"; button.addEventListener("click", () => requestQuickPartyInvite?.(crawler.id, { method: "ui", distance: crawler.distance })); }
    row.append(info, button);
    list.appendChild(row);
  }
}

(function installNearbyCrawlerUi() {
  const style = document.createElement("style");
  style.textContent = `.mpNearbyCrawler button{margin-left:auto}.mpNearbyEmpty{font-size:11px;color:#cbd3ff;padding:6px 0}.mpNearbyInviteBtn{font-weight:800}`;
  document.head.appendChild(style);
  const previous = window.renderQuickPartyUi;
  if (typeof previous === "function" && !previous.__nearbyCrawlerWrapped) {
    window.renderQuickPartyUi = function renderQuickPartyUiWithNearby(...args) {
      const result = previous.apply(this, args);
      renderNearbyCrawlersUi();
      return result;
    };
    window.renderQuickPartyUi.__nearbyCrawlerWrapped = true;
  }
})();
