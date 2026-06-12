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

const MUSIC_MUTED_STORAGE_KEY = "dcw.musicMuted";
const DEFAULT_MUSIC_VOLUME = 0.35;
const MUSIC_FADE_STEP_MS = 40;
const MUSIC_FADE_STEP_VOLUME = 0.02;
const MUSIC_PLAY_RETRY_MS = 1000;
const COLLAPSE_MUSIC_WARNING_SECONDS = 60;

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
  let fadeTimer = null;
  let lastPlayAttemptAt = 0;

  function getTrackInfo(state) {
    const src = MUSIC_TRACKS[state] || MUSIC_TRACKS[MUSIC_STATES.EXPLORATION];
    if (tracks.has(state)) return tracks.get(state);

    const audio = new Audio(src);
    const info = { audio, loaded: false, unavailable: false, state, src };
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.addEventListener("error", () => {
      info.loaded = false;
      info.unavailable = true;
      if (currentAudio === audio) {
        audio.pause();
        currentAudio = null;
        currentState = null;
      }
    });
    tracks.set(state, info);
    return info;
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
    if (currentAudio) currentAudio.volume = muted ? 0 : volume;
  }

  function loadState(state = desiredState) {
    const info = getTrackInfo(state);
    if (info.unavailable || info.loaded) return info;
    try {
      info.audio.load();
      info.loaded = true;
    } catch (error) {
      info.unavailable = true;
    }
    return info;
  }

  function fadeBetween(fromAudio, toAudio, targetVolume = volume, { pauseFrom = true } = {}) {
    stopFade();
    const safeTarget = Math.max(0, Math.min(1, muted ? 0 : targetVolume));

    fadeTimer = setInterval(() => {
      let done = true;

      if (fromAudio && !fromAudio.paused) {
        const nextVolume = Math.max(0, fromAudio.volume - MUSIC_FADE_STEP_VOLUME);
        fromAudio.volume = nextVolume;
        if (nextVolume > 0) done = false;
        else if (pauseFrom) {
          fromAudio.pause();
          fromAudio.currentTime = 0;
        }
      }

      if (toAudio && !muted) {
        const nextVolume = Math.min(safeTarget, toAudio.volume + MUSIC_FADE_STEP_VOLUME);
        toAudio.volume = nextVolume;
        if (nextVolume < safeTarget) done = false;
      }

      if (done) stopFade();
    }, MUSIC_FADE_STEP_MS);
  }

  async function startState(state, { fadeIn = true, force = false } = {}) {
    desiredState = state;
    wantsPlayback = true;

    if (muted || !userInteracted) return false;
    if (!force && currentState === state && currentAudio && !currentAudio.paused) return true;

    const now = performance.now();
    if (!force && now - lastPlayAttemptAt < MUSIC_PLAY_RETRY_MS) return false;
    lastPlayAttemptAt = now;

    const info = loadState(state);
    if (info.unavailable) return false;

    const nextAudio = info.audio;
    const previousAudio = currentAudio && currentAudio !== nextAudio ? currentAudio : null;
    currentState = state;
    currentAudio = nextAudio;

    try {
      if (nextAudio.paused) {
        nextAudio.volume = fadeIn ? 0 : (muted ? 0 : volume);
        await nextAudio.play();
      }
      if (fadeIn) fadeBetween(previousAudio, nextAudio, volume);
      else {
        if (previousAudio) {
          previousAudio.pause();
          previousAudio.currentTime = 0;
        }
        setAudioVolume(volume);
      }
      return true;
    } catch (error) {
      // Browser autoplay policies can still block playback; keep gameplay quiet and error-free.
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
    userInteracted = true;
    loadState(desiredState);
    if (wantsPlayback && !muted) startState(desiredState, { fadeIn: true, force: true });
  }

  function isBossMusicAppropriate() {
    return !!(bossEnemy && bossEnemy.hp > 0 && bossRoom && !bossRoom.cleared && (
      bossAggroed || bossDoorsLocked || player.currentRoomId === bossRoom.id
    ));
  }

  function isCollapseMusicAppropriate() {
    return Number.isFinite(floorTimeLeft) && floorTimeLeft <= COLLAPSE_MUSIC_WARNING_SECONDS;
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
      if (currentAudio && !currentAudio.paused) pause({ fadeOut: true });
      else wantsPlayback = false;
      return;
    }

    wantsPlayback = true;
    if (desiredState !== nextState || currentState !== nextState) setState(nextState, { fadeIn: true });
    else if (!muted && userInteracted && currentAudio?.paused) startState(nextState, { fadeIn: true });
  }

  return {
    load: loadState,
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
