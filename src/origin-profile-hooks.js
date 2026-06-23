(function installOriginProfileHooks() {
  if (window.__dcwOriginProfileHooksInstalled) return;
  window.__dcwOriginProfileHooksInstalled = true;

  function refreshBehaviorProfile() {
    if (typeof updateBehaviorProfile === "function") updateBehaviorProfile();
  }

  function wrap(name, wrapper) {
    const original = globalThis[name];
    if (typeof original !== "function" || original.__originProfileWrapped) return false;
    const wrapped = wrapper(original);
    wrapped.__originProfileWrapped = true;
    globalThis[name] = wrapped;
    return true;
  }

  function install() {
    wrap("advanceToNextFloor", original => function advanceToNextFloorWithBehaviorProfile() {
      refreshBehaviorProfile();
      return original.apply(this, arguments);
    });

    wrap("showSafeRoomRecap", original => function showSafeRoomRecapWithBehaviorProfile() {
      refreshBehaviorProfile();
      return original.apply(this, arguments);
    });

    refreshBehaviorProfile();
  }

  let attempts = 0;
  const retry = () => {
    attempts++;
    install();
    if (attempts < 12) setTimeout(retry, 250);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
})();