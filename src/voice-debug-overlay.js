(function installVoiceDebugOverlay() {
  const VOICE_LEVEL_THRESHOLD = 0.025;
  const VOICE_ANALYSER_FFT_SIZE = 256;

  function ensureVoiceDebugState() {
    if (typeof voiceChat === "undefined") return null;
    if (!voiceChat.remoteAnalysers) voiceChat.remoteAnalysers = new Map();
    if (!voiceChat.remoteAudioLevels) voiceChat.remoteAudioLevels = new Map();
    return voiceChat;
  }

  function getVoiceAudioContext() {
    const state = ensureVoiceDebugState();
    if (!state) return null;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!state.audioContext) state.audioContext = new AudioContextCtor();
    if (state.audioContext.state === "suspended") state.audioContext.resume?.().catch?.(() => {});
    return state.audioContext;
  }

  function ensureRemoteVoiceAnalyser(playerId) {
    const state = ensureVoiceDebugState();
    if (!state || !playerId) return null;
    if (state.remoteAnalysers.has(playerId)) return state.remoteAnalysers.get(playerId);

    const audio = state.remoteAudio?.get?.(playerId);
    const stream = audio?.srcObject;
    if (!stream || typeof stream.getAudioTracks !== "function" || stream.getAudioTracks().length === 0) return null;

    const audioContext = getVoiceAudioContext();
    if (!audioContext) return null;

    try {
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = VOICE_ANALYSER_FFT_SIZE;
      source.connect(analyser);
      const entry = {
        source,
        analyser,
        data: new Uint8Array(analyser.fftSize),
        stream
      };
      state.remoteAnalysers.set(playerId, entry);
      return entry;
    } catch (err) {
      console.warn("Voice analyser setup failed", err);
      return null;
    }
  }

  function getRemoteVoiceAudioLevel(playerId) {
    const state = ensureVoiceDebugState();
    if (!state || !playerId) return 0;

    const audio = state.remoteAudio?.get?.(playerId);
    const currentStream = audio?.srcObject || null;
    const existing = state.remoteAnalysers?.get?.(playerId);
    if (existing && existing.stream !== currentStream) {
      try { existing.source.disconnect(); } catch {}
      try { existing.analyser.disconnect(); } catch {}
      state.remoteAnalysers.delete(playerId);
    }

    const entry = ensureRemoteVoiceAnalyser(playerId);
    if (!entry) return state.remoteAudioLevels?.get?.(playerId) || 0;

    entry.analyser.getByteTimeDomainData(entry.data);
    let sumSquares = 0;
    for (const sample of entry.data) {
      const normalized = (sample - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / entry.data.length);
    const level = Math.max(0, Math.min(1, rms));
    state.remoteAudioLevels.set(playerId, level);
    return level;
  }

  function isRemoteVoiceActuallyTalking(playerId) {
    if (typeof getVoiceRemoteStatus !== "function") return false;
    const status = getVoiceRemoteStatus(playerId);
    if (!status?.connected || status.muted || status.volume <= 0) return false;
    return getRemoteVoiceAudioLevel(playerId) >= VOICE_LEVEL_THRESHOLD;
  }

  function drawVoiceIndicatorLabel(entity, label, yOffset = 62) {
    if (!entity || !label || typeof ctx === "undefined") return;
    ctx.save();
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.82)";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.strokeText(label, entity.x, entity.y - yOffset);
    ctx.fillText(label, entity.x, entity.y - yOffset);
    ctx.restore();
  }

  function drawRemoteCrawlerVoiceIndicator(crawler) {
    if (!crawler?.id || typeof getVoiceRemoteStatus !== "function") return;
    const status = getVoiceRemoteStatus(crawler.id);
    if (!status?.connected || status.muted) return;

    const talking = isRemoteVoiceActuallyTalking(crawler.id);
    const label = talking ? "TALKING" : (status.channel === "party" ? "PARTY" : "VOICE");
    drawVoiceIndicatorLabel(crawler, label, 62);
  }

  const previousIsRemoteVoiceActive = typeof isRemoteVoiceActive === "function" ? isRemoteVoiceActive : null;
  window.isRemoteVoiceActive = function isRemoteVoiceActiveWithAudioLevel(playerId) {
    if (isRemoteVoiceActuallyTalking(playerId)) return true;
    return false;
  };

  window.getRemoteVoiceAudioLevel = getRemoteVoiceAudioLevel;
  window.drawVoiceIndicatorLabel = drawVoiceIndicatorLabel;
  window.drawRemoteCrawlerVoiceIndicator = drawRemoteCrawlerVoiceIndicator;

  if (typeof drawRemoteCrawlerVoiceIcon === "function") {
    drawRemoteCrawlerVoiceIcon = function drawRemoteCrawlerVoiceIconWithConnectionState(crawler) {
      drawRemoteCrawlerVoiceIndicator(crawler);
    };
  }

  if (typeof drawPlayerSprite === "function" && !drawPlayerSprite.__voiceDebugWrapped) {
    const baseDrawPlayerSprite = drawPlayerSprite;
    drawPlayerSprite = function drawPlayerSpriteWithVoiceIndicator(...args) {
      const result = baseDrawPlayerSprite.apply(this, args);
      if (typeof isLocalVoiceTransmitting === "function" && isLocalVoiceTransmitting()) {
        drawVoiceIndicatorLabel(player, "MIC", 64);
      }
      return result;
    };
    drawPlayerSprite.__voiceDebugWrapped = true;
  }

  window.addEventListener("blur", () => {
    if (typeof setVoicePushToTalkActive === "function") setVoicePushToTalkActive(false);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && typeof setVoicePushToTalkActive === "function") setVoicePushToTalkActive(false);
  });
})();
