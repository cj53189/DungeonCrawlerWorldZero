const MUSIC_STATES = Object.freeze({
  TITLE: "title",
  EXPLORATION: "exploration",
  COLLAPSE: "collapse",
  BOSS: "boss"
});

const MUSIC_TRACKS = Object.freeze({
  [MUSIC_STATES.TITLE]: "./assets/audio/music/copper_bone.mp3",
  [MUSIC_STATES.EXPLORATION]: "./assets/audio/music/the_gatekeeper_s_final_stand.mp3",
  [MUSIC_STATES.COLLAPSE]: "./assets/audio/music/teeth_along_the_roof.mp3",
  [MUSIC_STATES.BOSS]: "./assets/audio/music/crown_of_the_fallen_boss_battle.mp3"
});

// These per-track targets keep perceived loudness easy to rebalance without
// recompressing, normalizing, or otherwise rewriting the uploaded source files.
const MUSIC_TRACK_TARGET_VOLUMES = Object.freeze({
  [MUSIC_STATES.TITLE]: 0.30,
  [MUSIC_STATES.EXPLORATION]: 0.35,
  [MUSIC_STATES.COLLAPSE]: 0.32,
  [MUSIC_STATES.BOSS]: 0.34
});

const MUSIC_MUTED_STORAGE_KEY = "dcw.musicMuted";
const DEFAULT_MUSIC_VOLUME = 0.35;
const MUSIC_CROSSFADE_MS = 1200;
const MUSIC_PLAY_RETRY_MS = 1000;
const COLLAPSE_MUSIC_WARNING_SECONDS = 60;
const MUSIC_DEBUG = false;

function clampMusicVolume(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(1, numericValue));
}

function musicDebug(event, details = {}) {
  if (!MUSIC_DEBUG) return;
  console.debug(`[music] ${event}`, details);
}

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
  const tracks = new Map();
  let currentState = null;
  let currentAudio = null;
  let desiredState = MUSIC_STATES.TITLE;
  let muted = readSavedMusicMuted();
  let volume = DEFAULT_MUSIC_VOLUME;
  let userInteracted = false;
  let wantsPlayback = false;
  let fadeAnimationFrame = null;
  let fadeToken = 0;
  let lastPlayAttemptAt = 0;
  let lastPlayAttemptState = null;

  function getTrackTargetVolume(state, baseVolume = volume) {
    const trackTarget = MUSIC_TRACK_TARGET_VOLUMES[state] ?? DEFAULT_MUSIC_VOLUME;
    const trackGain = DEFAULT_MUSIC_VOLUME > 0 ? trackTarget / DEFAULT_MUSIC_VOLUME : 1;
    return clampMusicVolume(clampMusicVolume(baseVolume) * trackGain);
  }

  function getTrackInfo(state) {
    const src = MUSIC_TRACKS[state];
    if (!src) return null;
    if (tracks.has(state)) return tracks.get(state);

    const audio = new Audio(src);
    const info = { audio, loaded: false, unavailable: false, state, src };
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.addEventListener("error", () => {
      info.loaded = false;
      info.unavailable = true;
      musicDebug("failed playback", { requestedState: state, src });
      if (currentAudio === audio) {
        audio.pause();
        currentAudio = null;
        currentState = null;
      }
    });
    tracks.set(state, info);
    return info;
  }

  function preloadAllTracks() {
    for (const state of Object.values(MUSIC_STATES)) loadState(state);
  }

  function stopFade() {
    if (!fadeAnimationFrame) return;
    cancelAnimationFrame(fadeAnimationFrame);
    fadeAnimationFrame = null;
    fadeToken++;
  }

  function setButtonLabel() {
    const button = document.getElementById("musicToggleBtn");
    if (!button) return;
    button.textContent = `Music: ${muted ? "Off" : "On"}`;
    button.setAttribute("aria-pressed", muted ? "false" : "true");
  }

  function setAudioVolume(nextVolume = volume) {
    volume = clampMusicVolume(nextVolume);
    if (currentAudio && currentState) currentAudio.volume = muted ? 0 : getTrackTargetVolume(currentState);
  }

  function loadState(state = desiredState) {
    const info = getTrackInfo(state);
    if (!info || info.unavailable || info.loaded) return info;
    try {
      info.audio.load();
      info.loaded = true;
    } catch (error) {
      info.unavailable = true;
      musicDebug("failed playback", { requestedState: state, src: info.src });
    }
    return info;
  }

  function fadeBetween(fromAudio, toAudio, targetVolume = volume, { pauseFrom = true, toState = desiredState } = {}) {
    stopFade();
    const token = fadeToken;
    const safeTarget = muted ? 0 : getTrackTargetVolume(toState, targetVolume);
    const fromStartVolume = clampMusicVolume(fromAudio?.volume ?? 0);
    const startAt = performance.now();

    function finishFade() {
      if (fromAudio && pauseFrom) {
        fromAudio.volume = 0;
        fromAudio.pause();
        fromAudio.currentTime = 0;
      }
      if (toAudio) toAudio.volume = safeTarget;
      fadeAnimationFrame = null;
    }

    function tick(now) {
      if (token !== fadeToken) return;
      const progress = Math.min(1, (now - startAt) / MUSIC_CROSSFADE_MS);
      const fromVolume = clampMusicVolume(fromStartVolume * (1 - progress));
      const toVolume = clampMusicVolume(safeTarget * progress);

      if (fromAudio && !fromAudio.paused) fromAudio.volume = fromVolume;
      if (toAudio) toAudio.volume = muted ? 0 : toVolume;

      if (progress >= 1) {
        finishFade();
        return;
      }
      fadeAnimationFrame = requestAnimationFrame(tick);
    }

    fadeAnimationFrame = requestAnimationFrame(tick);
  }

  async function startState(state, { fadeIn = true, force = false } = {}) {
    if (!MUSIC_TRACKS[state]) return false;

    const wasDesiredState = desiredState;
    desiredState = state;
    wantsPlayback = true;
    musicDebug("requested music state", { requestedState: state, currentState, wasDesiredState });

    if (muted || !userInteracted) return false;
    if (!force && currentState === state && currentAudio && !currentAudio.paused) {
      musicDebug("ignored duplicate state change", { requestedState: state, currentState });
      return true;
    }

    const now = performance.now();
    if (!force && lastPlayAttemptState === state && now - lastPlayAttemptAt < MUSIC_PLAY_RETRY_MS) return false;
    lastPlayAttemptAt = now;
    lastPlayAttemptState = state;

    const info = loadState(state);
    if (!info || info.unavailable) return false;

    const nextAudio = info.audio;
    const previousAudio = currentAudio && currentAudio !== nextAudio ? currentAudio : null;
    const targetVolume = getTrackTargetVolume(state);

    try {
      if (nextAudio.paused) {
        nextAudio.volume = fadeIn ? 0 : targetVolume;
        await nextAudio.play();
      }

      currentState = state;
      currentAudio = nextAudio;
      musicDebug("current music state", { currentState, volume: targetVolume });

      if (fadeIn) fadeBetween(previousAudio, nextAudio, volume, { toState: state });
      else {
        stopFade();
        if (previousAudio) {
          previousAudio.volume = 0;
          previousAudio.pause();
          previousAudio.currentTime = 0;
        }
        setAudioVolume(volume);
      }
      return true;
    } catch (error) {
      musicDebug("failed playback", { requestedState: state, src: info.src, reason: error?.name || "play rejected" });
      return false;
    }
  }

  function pause({ fadeOut = false } = {}) {
    wantsPlayback = false;
    if (!currentAudio) return;
    if (fadeOut && !currentAudio.paused) fadeBetween(currentAudio, null, 0);
    else {
      stopFade();
      currentAudio.pause();
    }
  }

  function setState(state, options = {}) {
    if (!MUSIC_TRACKS[state]) return false;
    desiredState = state;
    if (!wantsPlayback && !options.force) return false;
    return startState(state, options);
  }

  function setMuted(nextMuted) {
    muted = !!nextMuted;
    saveMusicMuted(muted);
    setButtonLabel();

    if (muted) {
      stopFade();
      for (const info of tracks.values()) {
        info.audio.volume = 0;
        info.audio.pause();
      }
      return;
    }

    if (wantsPlayback) startState(desiredState, { fadeIn: true, force: true });
  }

  function toggleMuted() {
    setMuted(!muted);
  }

  function markUserInteraction() {
    if (userInteracted) return;
    userInteracted = true;
    preloadAllTracks();
    if (wantsPlayback && !muted) startState(desiredState, { fadeIn: true, force: true });
  }

  function isBossMusicAppropriate() {
    return !!(bossEnemy && bossEnemy.hp > 0 && bossRoom && !bossRoom.cleared && (
      bossAggroed || bossDoorsLocked || player.currentRoomId === bossRoom.id
    ));
  }

  function isCollapseMusicAppropriate() {
    return !collapseStarted && Number.isFinite(floorTimeLeft) && floorTimeLeft <= COLLAPSE_MUSIC_WARNING_SECONDS;
  }

  function getStateForGameState() {
    if (gameMode === GAME_MODES.TITLE) return MUSIC_STATES.TITLE;
    if (gameMode === GAME_MODES.MULTIPLAYER_STASIS || gameWon || gameLost) return null;
    if (isBossMusicAppropriate()) return MUSIC_STATES.BOSS;
    if (isCollapseMusicAppropriate()) return MUSIC_STATES.COLLAPSE;
    return MUSIC_STATES.EXPLORATION;
  }

  function syncToGameState() {
    const nextState = getStateForGameState();
    if (!nextState) {
      if (wantsPlayback && currentAudio && !currentAudio.paused) pause({ fadeOut: true });
      else wantsPlayback = false;
      return;
    }

    wantsPlayback = true;
    if (desiredState !== nextState || currentState !== nextState) setState(nextState, { fadeIn: true });
    else if (!muted && userInteracted && currentAudio?.paused) startState(nextState, { fadeIn: true });
    else musicDebug("ignored duplicate state change", { requestedState: nextState, currentState });
  }

  return {
    load: loadState,
    preloadAll: preloadAllTracks,
    play: startState,
    pause,
    resume: startState,
    setState,
    setVolume: setAudioVolume,
    setMuted,
    toggleMuted,
    markUserInteraction,
    syncToGameState,
    updateToggleLabel: setButtonLabel,
    isMuted: () => muted,
    getCurrentState: () => currentState,
    states: MUSIC_STATES
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

function setMusicState(state) {
  dungeonMusic.setState(state, { fadeIn: true });
}
