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

  document.addEventListener("keydown", event => {
    if (!modePromptIsOpen()) return;
    const key = event.key?.toLowerCase?.();
    if (key === "escape" || key === "backspace") setTimeout(resetTitleRoomToSpawn, 0);
  }, true);
})();
