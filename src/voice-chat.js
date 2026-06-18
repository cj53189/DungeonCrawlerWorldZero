var voiceChat = {
  enabled: false,
  mode: "off",
  pushToTalkKey: "KeyV",
  localStream: null,
  peers: new Map(),
  remoteAudio: new Map(),
  mutedPlayerIds: new Set(),
  peerVolumes: new Map(),
  proximityTimer: null,
  selfMuted: true,
  initialized: false,
  lastError: null
};

const VOICE_ICE_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const VOICE_FULL_VOLUME_TILES = 2;
const VOICE_MAX_RANGE_TILES = 8;
const VOICE_PROXIMITY_UPDATE_MS = 200;
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

function updateVoiceProximityVolumes() {
  for (const [playerId, audio] of voiceChat.remoteAudio.entries()) {
    const distance = getVoiceDistanceToRemotePlayer(playerId);
    const volume = voiceChat.enabled && voiceChat.mode !== "off" ? getVoiceVolumeForDistance(distance) : 0;
    const clampedVolume = clampVoiceVolume(volume);
    const manuallyMuted = voiceChat.mutedPlayerIds.has(playerId);
    audio.volume = clampedVolume;
    audio.muted = voiceChat.mode === "off" || manuallyMuted || clampedVolume <= 0;
    voiceChat.peerVolumes.set(playerId, clampedVolume);
  }
}

function getVoiceDebugStatus() {
  return Array.from(voiceChat.remoteAudio.keys()).map(playerId => {
    const distance = getVoiceDistanceToRemotePlayer(playerId);
    const volume = voiceChat.peerVolumes.get(playerId) ?? getVoiceVolumeForDistance(distance);
    return {
      playerId,
      distance,
      volume: clampVoiceVolume(volume),
      muted: voiceChat.mode === "off" || voiceChat.mutedPlayerIds.has(playerId) || clampVoiceVolume(volume) <= 0
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
  if (voiceChat.enabled) startVoiceProximityTimer();
  else stopVoiceProximityTimer();
  updateLocalVoiceTrackState();
  updateVoiceProximityVolumes();
  if (typeof updateVoiceChatSettingsUI === "function") updateVoiceChatSettingsUI();
}

async function requestVoiceMicrophone() {
  initVoiceChat();
  if (!voiceChat.enabled) return null;
  if (voiceChat.localStream) return voiceChat.localStream;
  if (!navigator.mediaDevices?.getUserMedia) {
    voiceChat.lastError = "Microphone access is not available in this browser.";
    if (typeof announcer === "function") announcer("Voice chat needs a browser with microphone support.");
    if (typeof updateVoiceChatSettingsUI === "function") updateVoiceChatSettingsUI();
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
    if (typeof updateVoiceChatSettingsUI === "function") updateVoiceChatSettingsUI();
    return stream;
  } catch (err) {
    voiceChat.lastError = err?.message || "Microphone permission was denied.";
    updateLocalVoiceTrackState();
    if (typeof announcer === "function") announcer("Voice chat could not access your microphone. Check browser permissions to use push-to-talk.");
    if (typeof updateVoiceChatSettingsUI === "function") updateVoiceChatSettingsUI();
    return null;
  }
}

function startVoiceForLobby() {
  initVoiceChat();
  if (!voiceChat.enabled) return false;
  if (!multiplayer?.enabled || !multiplayer.usingServer || !multiplayer.playerId || !multiplayer.remotePlayers) return false;
  for (const targetPlayerId of multiplayer.remotePlayers.keys()) {
    if (targetPlayerId && targetPlayerId !== multiplayer.playerId) connectVoicePeer(targetPlayerId, { polite: false });
  }
  return true;
}

function stopVoiceChat(reason = "stopped") {
  const knownPeerIds = Array.from(voiceChat.peers.keys());
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
  voiceChat.selfMuted = true;
  stopVoiceProximityTimer();
  updateLocalVoiceTrackState();
  updateVoiceProximityVolumes();
  if (typeof updateVoiceChatSettingsUI === "function") updateVoiceChatSettingsUI();
}

async function connectVoicePeer(targetPlayerId, options = {}) {
  if (!voiceChat.enabled || !targetPlayerId || targetPlayerId === multiplayer?.playerId) return null;
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
    audio.play?.().catch(() => {});
  });
  pc.addEventListener("connectionstatechange", () => {
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
  updateLocalVoiceTrackState();
}

function updateLocalVoiceTrackState() {
  const shouldEnable = voiceChat.enabled && voiceChat.mode === "push_to_talk" && !voiceChat.selfMuted;
  for (const track of voiceChat.localStream?.getAudioTracks?.() || []) {
    track.enabled = shouldEnable;
  }
  if (typeof updateVoiceChatSettingsUI === "function") updateVoiceChatSettingsUI();
}

function cleanupVoicePeer(targetPlayerId, reason = "cleanup") {
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
}

window.addEventListener("DOMContentLoaded", initVoiceChat);
