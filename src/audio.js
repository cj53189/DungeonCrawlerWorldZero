const DUNGEON_BGM_SRC = "./assets/audio/the_gatekeeper_s_final_stand.mp3";
const MUSIC_MUTED_STORAGE_KEY = "dcw.musicMuted";
const DEFAULT_MUSIC_VOLUME = 0.35;
const MUSIC_FADE_STEP_MS = 40;

function readSavedMusicMuted() {
  try {
    return localStorage.getItem(MUSIC_MUTED_STORAGE_KEY) === "true";
  } catch (error) {
    return false;
  }
}

function saveMusicMuted(muted) {
  try {
    localStorage.setItem(MUSIC_MUTED_STORAGE_KEY, muted ? "true" : "false");
  } catch (error) {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

function createDungeonMusicManager() {
  let audio = null;
  let loaded = false;
  let muted = readSavedMusicMuted();
  let volume = DEFAULT_MUSIC_VOLUME;
  let userInteracted = false;
  let wantsPlayback = false;
  let fadeTimer = null;
  let sourceUnavailable = false;
  let lastPlayAttemptAt = 0;

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(DUNGEON_BGM_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = muted ? 0 : volume;
    audio.addEventListener("error", () => {
      loaded = false;
      wantsPlayback = false;
      sourceUnavailable = true;
    });
    return audio;
  }

  function stopFade() {
    if (!fadeTimer) return;
    clearInterval(fadeTimer);
    fadeTimer = null;
  }

  function setButtonLabel() {
    const button = document.getElementById("musicToggleBtn");
    if (!button) return;
    button.textContent = `Music: ${muted ? "Off" : "On"}`;
    button.setAttribute("aria-pressed", muted ? "false" : "true");
  }

  function setAudioVolume(nextVolume = volume) {
    volume = Math.max(0, Math.min(1, nextVolume));
    if (audio) audio.volume = muted ? 0 : volume;
  }

  function load() {
    if (sourceUnavailable) return;
    const bgm = ensureAudio();
    if (!loaded) {
      bgm.load();
      loaded = true;
    }
  }

  function fadeTo(targetVolume, { pauseAtEnd = false } = {}) {
    const bgm = ensureAudio();
    stopFade();
    const safeTarget = Math.max(0, Math.min(1, muted ? 0 : targetVolume));

    fadeTimer = setInterval(() => {
      const diff = safeTarget - bgm.volume;
      if (Math.abs(diff) <= 0.02) {
        bgm.volume = safeTarget;
        stopFade();
        if (pauseAtEnd) bgm.pause();
        return;
      }
      bgm.volume = Math.max(0, Math.min(1, bgm.volume + Math.sign(diff) * 0.02));
    }, MUSIC_FADE_STEP_MS);
  }

  async function play({ fadeIn = false } = {}) {
    wantsPlayback = true;
    if (muted || !userInteracted || sourceUnavailable) return false;

    const now = performance.now();
    if (now - lastPlayAttemptAt < 1000) return false;
    lastPlayAttemptAt = now;

    const bgm = ensureAudio();
    if (fadeIn) bgm.volume = 0;

    try {
      await bgm.play();
      if (fadeIn) fadeTo(volume);
      else setAudioVolume(volume);
      return true;
    } catch (error) {
      // Browser autoplay policies can still block playback; keep gameplay quiet and error-free.
      return false;
    }
  }

  function pause({ fadeOut = false } = {}) {
    wantsPlayback = false;
    if (!audio) return;
    if (fadeOut && !audio.paused) fadeTo(0, { pauseAtEnd: true });
    else {
      stopFade();
      audio.pause();
    }
  }

  function resume(options = {}) {
    return play(options);
  }

  function setMuted(nextMuted) {
    muted = !!nextMuted;
    saveMusicMuted(muted);
    setButtonLabel();
    if (audio) {
      if (muted) {
        stopFade();
        audio.volume = 0;
        audio.pause();
      } else {
        audio.volume = volume;
        if (wantsPlayback) resume({ fadeIn: true });
      }
    }
  }

  function toggleMuted() {
    setMuted(!muted);
  }

  function markUserInteraction() {
    userInteracted = true;
    load();
    if (wantsPlayback && !muted) resume({ fadeIn: true });
  }

  function shouldPlayForGameState() {
    return gameMode !== GAME_MODES.TITLE && gameMode !== GAME_MODES.MULTIPLAYER_STASIS && !gameWon && !gameLost;
  }

  function syncToGameState() {
    if (shouldPlayForGameState()) {
      wantsPlayback = true;
      if (!audio) load();
      if (!muted && userInteracted && audio?.paused) resume({ fadeIn: true });
      return;
    }
    if (audio && !audio.paused) pause({ fadeOut: true });
    else wantsPlayback = false;
  }

  return {
    load,
    play,
    pause,
    resume,
    setVolume: setAudioVolume,
    setMuted,
    toggleMuted,
    markUserInteraction,
    syncToGameState,
    updateToggleLabel: setButtonLabel,
    isMuted: () => muted
  };
}

const dungeonMusic = createDungeonMusicManager();

function setupMusicControls() {
  dungeonMusic.updateToggleLabel();

  const button = document.getElementById("musicToggleBtn");
  if (button) {
    button.addEventListener("click", event => {
      event.stopPropagation();
      dungeonMusic.markUserInteraction();
      dungeonMusic.toggleMuted();
      dungeonMusic.syncToGameState();
    });
  }

  const markInteraction = event => {
    if (event.type === "keydown" && event.repeat) return;
    dungeonMusic.markUserInteraction();
    dungeonMusic.syncToGameState();
  };

  window.addEventListener("pointerdown", markInteraction, { passive: true, capture: true });
  window.addEventListener("touchstart", markInteraction, { passive: true, capture: true });
  window.addEventListener("keydown", markInteraction, { passive: true, capture: true });
}

function syncMusicToGameState() {
  dungeonMusic.syncToGameState();
}
