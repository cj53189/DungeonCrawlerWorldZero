// Keep gameplay clear when a multiplayer run starts.
(function installMultiplayerPanelAutoClose() {
  function closeLobbyPanelForGameplay() {
    if (typeof hideMultiplayerPanel === "function") {
      hideMultiplayerPanel();
      return;
    }
    const panel = document.getElementById("multiplayerPanel");
    if (panel) panel.style.display = "none";
    const openButton = document.getElementById("mpOpenPanelBtn");
    if (openButton && typeof multiplayer !== "undefined" && multiplayer.enabled) openButton.style.display = "block";
  }

  function wrapGlobalFunction(name) {
    const original = window[name];
    if (typeof original !== "function" || original.__autoClosesLobbyPanel) return;
    const wrapped = function wrappedMultiplayerStartFunction(...args) {
      const result = original.apply(this, args);
      closeLobbyPanelForGameplay();
      return result;
    };
    wrapped.__autoClosesLobbyPanel = true;
    window[name] = wrapped;
  }

  function install() {
    wrapGlobalFunction("startMultiplayerFloor0");
    wrapGlobalFunction("prepareServerLobbyState");
    wrapGlobalFunction("startMockFloorOne");
    wrapGlobalFunction("handleServerFloorStart");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
