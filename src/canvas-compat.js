(function installCanvasTransformCompatibilityGuard() {
  const proto = window.CanvasRenderingContext2D?.prototype;
  if (!proto || proto.setTransform.__dcwCompatGuard) return;

  const nativeSetTransform = proto.setTransform;
  proto.setTransform = function setTransformCompat(a, b, c, d, e, f) {
    if (arguments.length === 5 && typeof a === "number") {
      return nativeSetTransform.call(this, a, b, c, d, e, 0);
    }
    return nativeSetTransform.apply(this, arguments);
  };
  proto.setTransform.__dcwCompatGuard = true;
})();

(function installTitleRoomBackoutSpawnReset() {
  function modePromptIsOpen() {
    const prompt = document.getElementById("titleRoomModePrompt");
    return !!prompt && prompt.classList.contains("open");
  }

  function leaderboardIsOpen() {
    const panel = document.getElementById("leaderboardPanel");
    return !!panel && panel.style.display === "block";
  }

  function resetTitleRoomToSpawn() {
    const screen = document.getElementById("titleScreen");
    if (!screen) return;

    const previousDisplay = screen.style.display;
    screen.style.display = "none";

    requestAnimationFrame(() => {
      screen.style.display = previousDisplay || "flex";
    });
  }

  document.addEventListener("click", event => {
    const prompt = document.getElementById("titleRoomModePrompt");
    if (!prompt?.classList.contains("open")) return;

    const choice = event.target.closest?.("button[data-title-choice]")?.dataset?.titleChoice;
    const clickedBackdrop = event.target === prompt;
    if (choice === "cancel" || clickedBackdrop) setTimeout(resetTitleRoomToSpawn, 0);
  }, true);

  document.addEventListener("click", event => {
    if (!leaderboardIsOpen()) return;
    const closeControl = event.target.closest?.("#closeLeaderboardBtn, #backFromLeaderboardBtn");
    if (closeControl) setTimeout(resetTitleRoomToSpawn, 0);
  }, true);

  document.addEventListener("keydown", event => {
    const key = event.key?.toLowerCase?.();
    if ((key === "escape" || key === "backspace") && modePromptIsOpen()) {
      setTimeout(resetTitleRoomToSpawn, 0);
      return;
    }
    if ((key === "escape" || key === "backspace") && leaderboardIsOpen()) {
      const hide = window.DCWZLeaderboard?.hide;
      if (typeof hide === "function") hide();
      setTimeout(resetTitleRoomToSpawn, 0);
    }
  }, true);
})();

(function loadCleanUiEditorV2() {
  if (document.querySelector('script[src="./src/ui-editor-v2.js"]')) return;
  const script = document.createElement("script");
  script.src = "./src/ui-editor-v2.js";
  script.defer = true;
  document.head.appendChild(script);
})();
