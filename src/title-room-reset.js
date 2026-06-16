(function installTitleRoomSpawnReset() {
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
