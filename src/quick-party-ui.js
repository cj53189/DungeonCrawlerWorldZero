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
    if (!window.multiplayer || !multiplayer.enabled) return;
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
