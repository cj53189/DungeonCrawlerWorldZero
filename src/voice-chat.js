var voiceChat = {
  enabled: false,
  mode: "off",
  pushToTalkKey: "KeyV",
  localStream: null,
  peers: new Map(),
  remoteAudio: new Map(),
  mutedPlayerIds: new Set(),
  peerVolumes: new Map(),
  localSpeaking: false,
  remoteSpeaking: new Map(),
  proximityTimer: null,
  lifecycleTimer: null,
  pendingConnections: new Set(),
  remoteLastSeen: new Map(),
  selfMuted: true,
  initialized: false,
  lastError: null
};

const VOICE_ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const VOICE_FULL_VOLUME_TILES = 2;
const VOICE_MAX_RANGE_TILES = 8;
const VOICE_PROXIMITY_UPDATE_MS = 200;
const VOICE_LIFECYCLE_SYNC_MS = 1000;
const VOICE_REMOTE_STALE_MS = 5000;
const VOICE_FALLBACK_TILE_SIZE = 32;

function initVoiceChat() {
  if (voiceChat.initialized) return;
  voiceChat.initialized = true;

  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.code !== voiceChat.pushToTalkKey || isVoiceTypingTarget(event.target)) return;
    setVoicePushToTalkActive(true);
  });
  window.addEventListener("keyup", (event) => {
    if (event.code !== voiceChat.pushToTalkKey) return;
    setVoicePushToTalkActive(false);
  });

  startVoiceProximityTimer();
  startVoiceLifecycleTimer();
  updateLocalVoiceTrackState();
}

function startVoiceProximityTimer() {
  if (voiceChat.proximityTimer) return;
  voiceChat.proximityTimer = setInterval(updateVoiceProximityVolumes, VOICE_PROXIMITY_UPDATE_MS);
}

function stopVoiceProximityTimer() {
  if (!voiceChat.proximityTimer) return;
  clearInterval(voiceChat.proximityTimer);
  voiceChat.proximityTimer = null;
}

function startVoiceLifecycleTimer() {
  if (voiceChat.lifecycleTimer) return;
  voiceChat.lifecycleTimer = setInterval(syncVoicePeersToMultiplayerState, VOICE_LIFECYCLE_SYNC_MS);
}

function stopVoiceLifecycleTimer() {
  if (!voiceChat.lifecycleTimer) return;
  clearInterval(voiceChat.lifecycleTimer);
  voiceChat.lifecycleTimer = null;
}

function getVoiceTileSize() {
  const tileSize = typeof TILE !== "undefined" ? Number(TILE) : VOICE_FALLBACK_TILE_SIZE;
  return Number.isFinite(tileSize) && tileSize > 0 ? tileSize : VOICE_FALLBACK_TILE_SIZE;
}

function clampVoiceVolume(volume) {
  const number = Number(volume);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function getVoiceDistanceToRemotePlayer(playerId) {
  const multiplayerState = typeof multiplayer !== "undefined" ? multiplayer : null;
  const localPlayer = typeof player !== "undefined" ? player : null;
  const crawler = multiplayerState?.remotePlayers?.get?.(playerId);
  const localX = Number(localPlayer?.x);
  const localY = Number(localPlayer?.y);
  const remoteX = Number(crawler?.x);
  const remoteY = Number(crawler?.y);
  if (!crawler || !Number.isFinite(localX) || !Number.isFinite(localY) || !Number.isFinite(remoteX) || !Number.isFinite(remoteY)) return Infinity;
  return Math.hypot(remoteX - localX, remoteY - localY) / getVoiceTileSize();
}

function getVoiceVolumeForDistance(distanceTiles) {
  const distance = Number(distanceTiles);
  if (!Number.isFinite(distance)) return 0;
  if (distance <= VOICE_FULL_VOLUME_TILES) return 1;
  if (distance >= VOICE_MAX_RANGE_TILES) return 0;
  const fadeRange = VOICE_MAX_RANGE_TILES - VOICE_FULL_VOLUME_TILES;
  return clampVoiceVolume(1 - ((distance - VOICE_FULL_VOLUME_TILES) / fadeRange));
}

function getLocalVoicePartyId() {
  const multiplayerState = typeof multiplayer !== "undefined" ? multiplayer : null;
  const localPlayer = typeof player !== "undefined" ? player : null;
  return multiplayerState?.partyId || localPlayer?.partyId || null;
}

function getRemoteVoicePartyId(playerId) {
  const multiplayerState = typeof multiplayer !== "undefined" ? multiplayer : null;
  const crawler = multiplayerState?.remotePlayers?.get?.(playerId);
  return crawler?.partyId || null;
}

function isVoicePartyMember(playerId) {
  const localPartyId = getLocalVoicePartyId();
  const remotePartyId = getRemoteVoicePartyId(playerId);
  return !!localPartyId && !!remotePartyId && localPartyId === remotePartyId;
}

function getVoiceChannelForPlayer(playerId) {
  return isVoicePartyMember(playerId) ? "party" : "proximity";
}

function updateVoiceProximityVolumes() {
  const enabled = isVoiceChatEnabled();
  for (const [playerId, audio] of voiceChat.remoteAudio.entries()) {
    const manuallyMuted = isVoicePlayerMuted(playerId);
    let volume = 0;

    if (enabled && !manuallyMuted) {
      if (getVoiceChannelForPlayer(playerId) === "party") {
        volume = 1;
      } else {
        volume = getVoiceVolumeForDistance(getVoiceDistanceToRemotePlayer(playerId));
      }
    }

    const clampedVolume = clampVoiceVolume(volume);
    audio.volume = clampedVolume;
    audio.muted = !enabled || manuallyMuted || clampedVolume <= 0;
    voiceChat.peerVolumes.set(playerId, clampedVolume);
    updateRemoteSpeakingState(playerId, audio);
  }
  if (typeof updateVoiceChatUi === "function") updateVoiceChatUi();
}


function shouldHaveVoicePeer(playerId) {
  const multiplayerState = typeof multiplayer !== "undefined" ? multiplayer : null;
  if (!isVoiceChatEnabled()) return false;
  if (!multiplayerState?.enabled || !multiplayerState.usingServer || !multiplayerState.playerId) return false;
  if (!playerId || playerId === multiplayerState.playerId) return false;
  const crawler = multiplayerState.remotePlayers?.get?.(playerId);
  if (!crawler) return false;
  const currentFloorValue = typeof currentFloor !== "undefined" ? currentFloor : crawler.currentFloor;
  const localFloor = Number.isFinite(Number(currentFloorValue)) ? Number(currentFloorValue) : currentFloorValue;
  const remoteFloor = Number.isFinite(Number(crawler.currentFloor)) ? Number(crawler.currentFloor) : localFloor;
  if (remoteFloor !== localFloor) return false;
  if (crawler.status === "failed") return false;
  return true;
}

function syncVoicePeersToMultiplayerState() {
  if (!voiceChat.pendingConnections) voiceChat.pendingConnections = new Set();
  if (!voiceChat.remoteLastSeen) voiceChat.remoteLastSeen = new Map();
  if (!isVoiceChatEnabled()) {
    if (voiceChat.peers.size || voiceChat.remoteAudio.size || voiceChat.pendingConnections.size || voiceChat.localStream) stopVoiceChat("disabled");
    return;
  }

  const multiplayerState = typeof multiplayer !== "undefined" ? multiplayer : null;
  const now = Date.now();
  const desiredPlayerIds = new Set();
  for (const [playerId, crawler] of multiplayerState?.remotePlayers?.entries?.() || []) {
    const updatedAt = Number(crawler?.updatedAt);
    if (Number.isFinite(updatedAt) && updatedAt > 0) voiceChat.remoteLastSeen.set(playerId, updatedAt);
    else if (!voiceChat.remoteLastSeen.has(playerId)) voiceChat.remoteLastSeen.set(playerId, now);
    if (shouldHaveVoicePeer(playerId)) desiredPlayerIds.add(playerId);
  }

  const knownPeerIds = new Set([
    ...voiceChat.peers.keys(),
    ...voiceChat.remoteAudio.keys(),
    ...voiceChat.pendingConnections
  ]);

  for (const playerId of desiredPlayerIds) {
    if (!voiceChat.peers.has(playerId) && !voiceChat.pendingConnections.has(playerId)) connectVoicePeer(playerId);
  }

  for (const playerId of knownPeerIds) {
    const crawler = multiplayerState?.remotePlayers?.get?.(playerId);
    const lastSeen = voiceChat.remoteLastSeen.get(playerId);
    const validUpdatedAt = Number.isFinite(Number(crawler?.updatedAt)) && Number(crawler?.updatedAt) > 0;
    if ((!crawler || !validUpdatedAt) && Number.isFinite(lastSeen) && now - lastSeen > VOICE_REMOTE_STALE_MS) {
      cleanupVoicePeer(playerId, "stale_remote");
      continue;
    }
    if (!desiredPlayerIds.has(playerId)) cleanupVoicePeer(playerId, "no_longer_eligible");
  }
}

function isVoicePlayerMuted(playerId) {
  return voiceChat.mutedPlayerIds.has(playerId);
}

function setVoicePlayerMuted(playerId, muted) {
  if (!playerId) return false;
  if (muted) voiceChat.mutedPlayerIds.add(playerId);
  else voiceChat.mutedPlayerIds.delete(playerId);
  updateVoiceProximityVolumes();
  if (typeof updateVoiceChatUi === "function") updateVoiceChatUi();
  if (typeof renderQuickPartyUi === "function") renderQuickPartyUi();
  return true;
}

function toggleVoicePlayerMuted(playerId) {
  return setVoicePlayerMuted(playerId, !isVoicePlayerMuted(playerId));
}

function isVoiceChatEnabled() {
  return !!voiceChat.enabled && voiceChat.mode !== "off";
}

function isLocalVoiceTransmitting() {
  return isVoiceChatEnabled()
    && voiceChat.localStream
    && Array.from(voiceChat.localStream.getAudioTracks()).some(track => track.enabled);
}

function getVoiceRemoteStatus(playerId) {
  const volume = voiceChat.peerVolumes?.get(playerId) ?? 0;
  const channel = getVoiceChannelForPlayer(playerId);
  return {
    connected: !!(voiceChat.peers?.has(playerId) || voiceChat.remoteAudio?.has(playerId)),
    muted: isVoicePlayerMuted(playerId),
    volume,
    inRange: channel === "party" || volume > 0,
    channel
  };
}

function updateRemoteSpeakingState(playerId, audio = voiceChat.remoteAudio?.get(playerId)) {
  if (!playerId || !voiceChat.remoteSpeaking) return;
  const active = !!audio && !audio.paused && !audio.muted && (voiceChat.peerVolumes?.get(playerId) ?? 0) > 0 && !isVoicePlayerMuted(playerId);
  if (active) voiceChat.remoteSpeaking.set(playerId, Date.now() + (VOICE_PROXIMITY_UPDATE_MS * 2));
  else voiceChat.remoteSpeaking.delete(playerId);
}

function isRemoteVoiceActive(playerId) {
  const status = getVoiceRemoteStatus(playerId);
  if (!status.connected || status.muted || status.volume <= 0) return false;
  const activeUntil = voiceChat.remoteSpeaking?.get(playerId) || 0;
  return activeUntil > Date.now();
}

function getVoiceDebugStatus() {
  return Array.from(voiceChat.remoteAudio.keys()).map(playerId => {
    const distance = getVoiceDistanceToRemotePlayer(playerId);
    const volume = voiceChat.peerVolumes.get(playerId) ?? getVoiceVolumeForDistance(distance);
    return {
      playerId,
      distance,
      volume: clampVoiceVolume(volume),
      muted: voiceChat.mode === "off" || voiceChat.mutedPlayerIds.has(playerId) || clampVoiceVolume(volume) <= 0,
      channel: getVoiceChannelForPlayer(playerId)
    };
  });
}

function isVoiceTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || !!target.isContentEditable;
}

function setVoiceChatMode(mode) {
  initVoiceChat();
  const nextMode = mode === "push_to_talk" ? "push_to_talk" : "off";
  voiceChat.mode = nextMode;
  voiceChat.enabled = nextMode !== "off";
  if (!voiceChat.enabled) voiceChat.selfMuted = true;
  if (voiceChat.enabled) {
    startVoiceProximityTimer();
    startVoiceLifecycleTimer();
  } else {
    stopVoiceProximityTimer();
    syncVoicePeersToMultiplayerState();
  }
  updateLocalVoiceTrackState();
  updateVoiceProximityVolumes();
  if (typeof updateVoiceChatUi === "function") updateVoiceChatUi();
}

async function requestVoiceMicrophone() {
  initVoiceChat();
  if (!voiceChat.enabled) return null;
  if (voiceChat.localStream) return voiceChat.localStream;
  if (!navigator.mediaDevices?.getUserMedia) {
    voiceChat.lastError = "Microphone access is not available in this browser.";
    if (typeof announcer === "function") announcer("Voice chat needs a browser with microphone support.");
    if (typeof updateVoiceChatUi === "function") updateVoiceChatUi();
    return null;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChat.localStream = stream;
    voiceChat.lastError = null;
    updateLocalVoiceTrackState();
    for (const pc of voiceChat.peers.values()) {
      addLocalVoiceTracks(pc);
    }
    if (typeof updateVoiceChatUi === "function") updateVoiceChatUi();
    return stream;
  } catch (err) {
    voiceChat.lastError = err?.message || "Microphone permission was denied.";
    updateLocalVoiceTrackState();
    if (typeof announcer === "function") announcer("Voice chat could not access your microphone. Check browser permissions to use push-to-talk.");
    if (typeof updateVoiceChatUi === "function") updateVoiceChatUi();
    return null;
  }
}

function startVoiceForLobby() {
  initVoiceChat();
  if (!voiceChat.enabled) return false;
  if (!multiplayer?.enabled || !multiplayer.usingServer || !multiplayer.playerId || !multiplayer.remotePlayers) return false;
  syncVoicePeersToMultiplayerState();
  return true;
}

function stopVoiceChat(reason = "stopped") {
  const knownPeerIds = Array.from(new Set([
    ...voiceChat.peers.keys(),
    ...voiceChat.remoteAudio.keys(),
    ...(voiceChat.pendingConnections || [])
  ]));
  for (const targetPlayerId of knownPeerIds) {
    if (typeof sendVoiceDisconnect === "function") sendVoiceDisconnect(targetPlayerId, reason);
    cleanupVoicePeer(targetPlayerId, reason);
  }
  if (voiceChat.localStream) {
    for (const track of voiceChat.localStream.getTracks()) {
      track.enabled = false;
      track.stop();
    }
    voiceChat.localStream = null;
  }
  voiceChat.pendingConnections?.clear?.();
  voiceChat.selfMuted = true;
  stopVoiceProximityTimer();
  stopVoiceLifecycleTimer();
  updateLocalVoiceTrackState();
  updateVoiceProximityVolumes();
  if (typeof updateVoiceChatUi === "function") updateVoiceChatUi();
}

async function connectVoicePeer(targetPlayerId, options = {}) {
  if (!voiceChat.enabled || !targetPlayerId || targetPlayerId === multiplayer?.playerId) return null;
  if (!voiceChat.pendingConnections) voiceChat.pendingConnections = new Set();
  if (voiceChat.peers.has(targetPlayerId) || voiceChat.pendingConnections.has(targetPlayerId)) return voiceChat.peers.get(targetPlayerId) || null;
  voiceChat.pendingConnections.add(targetPlayerId);
  const pc = createVoicePeerConnection(targetPlayerId);
  pc.voicePolite = !!options.polite;
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (typeof sendVoiceOffer === "function") sendVoiceOffer(targetPlayerId, pc.localDescription);
  } catch (err) {
    voiceChat.lastError = err?.message || "Could not start voice connection.";
    cleanupVoicePeer(targetPlayerId, "offer_failed");
  }
  return pc;
}

function createVoicePeerConnection(targetPlayerId) {
  if (voiceChat.peers.has(targetPlayerId)) return voiceChat.peers.get(targetPlayerId);
  const pc = new RTCPeerConnection(VOICE_ICE_CONFIG);
  pc.voiceTargetPlayerId = targetPlayerId;
  voiceChat.peers.set(targetPlayerId, pc);
  addLocalVoiceTracks(pc);

  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate && typeof sendVoiceIceCandidate === "function") sendVoiceIceCandidate(targetPlayerId, event.candidate);
  });
  pc.addEventListener("track", (event) => {
    let audio = voiceChat.remoteAudio.get(targetPlayerId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      voiceChat.remoteAudio.set(targetPlayerId, audio);
    }
    audio.srcObject = event.streams?.[0] || new MediaStream([event.track]);
    updateVoiceProximityVolumes();
    const playResult = audio.play?.();
    playResult?.then?.(() => updateRemoteSpeakingState(targetPlayerId, audio))?.catch?.(() => {});
  });
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "connected") voiceChat.pendingConnections?.delete?.(targetPlayerId);
    if (["closed", "failed", "disconnected"].includes(pc.connectionState)) cleanupVoicePeer(targetPlayerId, pc.connectionState);
  });
  return pc;
}

function addLocalVoiceTracks(pc) {
  if (!voiceChat.localStream || !pc) return;
  const senders = pc.getSenders?.() || [];
  for (const track of voiceChat.localStream.getAudioTracks()) {
    if (!senders.some(sender => sender.track === track)) pc.addTrack(track, voiceChat.localStream);
  }
}

function handleVoiceSignalMessage(message) {
  if (!message || typeof message.type !== "string") return;
  if (!voiceChat.enabled && message.type !== "voice_disconnect") return;
  if (message.fromPlayerId && message.fromPlayerId === multiplayer?.playerId) return;
  switch (message.type) {
    case "voice_offer":
      handleVoiceOffer(message);
      break;
    case "voice_answer":
      handleVoiceAnswer(message);
      break;
    case "voice_ice_candidate":
      handleVoiceIceCandidate(message);
      break;
    case "voice_disconnect":
      handleVoiceDisconnect(message);
      break;
  }
}

async function handleVoiceOffer(message) {
  if (!message?.fromPlayerId || !message.offer) return;
  if (!shouldHaveVoicePeer(message.fromPlayerId)) {
    cleanupVoicePeer(message.fromPlayerId, "no_longer_eligible");
    return;
  }
  try {
    const pc = createVoicePeerConnection(message.fromPlayerId);
    await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (typeof sendVoiceAnswer === "function") sendVoiceAnswer(message.fromPlayerId, pc.localDescription);
  } catch (err) {
    voiceChat.lastError = err?.message || "Could not answer voice connection.";
    cleanupVoicePeer(message.fromPlayerId, "answer_failed");
  }
}

async function handleVoiceAnswer(message) {
  const pc = message?.fromPlayerId ? voiceChat.peers.get(message.fromPlayerId) : null;
  if (!pc || !message.answer) return;
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
    voiceChat.pendingConnections?.delete?.(message.fromPlayerId);
  } catch (err) {
    voiceChat.lastError = err?.message || "Could not finish voice connection.";
  }
}

async function handleVoiceIceCandidate(message) {
  const pc = message?.fromPlayerId ? voiceChat.peers.get(message.fromPlayerId) : null;
  if (!pc || !message.candidate) return;
  try {
    await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
  } catch (err) {
    voiceChat.lastError = err?.message || "Could not add voice network candidate.";
  }
}

function handleVoiceDisconnect(message) {
  if (!message?.fromPlayerId) return;
  cleanupVoicePeer(message.fromPlayerId, message.reason || "remote_disconnect");
}

function setVoicePushToTalkActive(active) {
  if (voiceChat.mode !== "push_to_talk") return;
  voiceChat.selfMuted = !active;
  voiceChat.localSpeaking = !!active && !!isLocalVoiceTransmitting();
  updateLocalVoiceTrackState();
}

function updateLocalVoiceTrackState() {
  const shouldEnable = voiceChat.enabled && voiceChat.mode === "push_to_talk" && !voiceChat.selfMuted;
  for (const track of voiceChat.localStream?.getAudioTracks?.() || []) {
    track.enabled = shouldEnable;
  }
  voiceChat.localSpeaking = !!isLocalVoiceTransmitting();
  if (typeof updateVoiceChatUi === "function") updateVoiceChatUi();
}

function cleanupVoicePeer(targetPlayerId, reason = "cleanup") {
  voiceChat.pendingConnections?.delete?.(targetPlayerId);
  const pc = voiceChat.peers.get(targetPlayerId);
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    try { pc.close(); } catch {}
    voiceChat.peers.delete(targetPlayerId);
  }
  const audio = voiceChat.remoteAudio.get(targetPlayerId);
  if (audio) {
    audio.pause();
    audio.srcObject = null;
    voiceChat.remoteAudio.delete(targetPlayerId);
  }
  voiceChat.peerVolumes.delete(targetPlayerId);
  voiceChat.remoteSpeaking?.delete(targetPlayerId);
  if (typeof updateVoiceChatUi === "function") updateVoiceChatUi();
  if (typeof renderQuickPartyUi === "function") renderQuickPartyUi();
}

window.isVoicePlayerMuted = isVoicePlayerMuted;
window.toggleVoicePlayerMuted = toggleVoicePlayerMuted;
window.getVoiceRemoteStatus = getVoiceRemoteStatus;
window.getVoiceChannelForPlayer = getVoiceChannelForPlayer;
window.isVoicePartyMember = isVoicePartyMember;
window.isLocalVoiceTransmitting = isLocalVoiceTransmitting;
function getVoicePeerSummary() {
  return {
    enabled: voiceChat.enabled,
    mode: voiceChat.mode,
    peers: Array.from(voiceChat.peers.keys()),
    pending: Array.from(voiceChat.pendingConnections || []),
    remoteAudio: Array.from(voiceChat.remoteAudio.keys())
  };
}

window.isRemoteVoiceActive = isRemoteVoiceActive;
window.shouldHaveVoicePeer = shouldHaveVoicePeer;
window.syncVoicePeersToMultiplayerState = syncVoicePeersToMultiplayerState;
window.getVoicePeerSummary = getVoicePeerSummary;

window.addEventListener("DOMContentLoaded", initVoiceChat);
