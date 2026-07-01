// Explicit late-feature loader.
//
// The prototype used to hide major feature bootstraps inside unrelated patch files
// like minimap-mobile-compat.js and safe-room-shop-hard-exit.js. Keeping the late
// modules here makes load order visible and keeps compatibility files from quietly
// becoming second bootloaders.
(function installFeatureLoader() {
  if (window.__dcwFeatureLoaderInstalled) return;
  window.__dcwFeatureLoaderInstalled = true;

  function loadScript(src, options = {}) {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (options.afterExistingLoaded) options.afterExistingLoaded(existing);
      return existing;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.defer = true;
    if (typeof options.onload === "function") script.addEventListener("load", options.onload, { once: true });
    document.head.appendChild(script);
    return script;
  }

  function loadShopV2Stack() {
    const loadScrollFix = () => loadScript("./src/safe-room-shop-v2-scroll-fix.js");
    const existing = document.querySelector('script[src="./src/safe-room-shop-v2.js"]');
    if (existing) {
      if (window.__dcwSafeRoomShopV2Installed) loadScrollFix();
      else existing.addEventListener("load", loadScrollFix, { once: true });
      return;
    }
    loadScript("./src/safe-room-shop-v2.js", { onload: loadScrollFix });
  }

  const lateFeatureModules = [
    "./src/haptics.js",
    "./src/spawn-allocation-ui.js",
    "./src/floor3-offers.js",
    "./src/floor3-selection-ui.js",
    "./src/origin-profile-hooks.js",
    "./src/safe-room-logout.js",
    "./src/mobile-skills-layout-refresh.js",
    "./src/mobile-inventory-portrait-fix.js",
    "./src/floor-pressure-loop.js"
  ];

  for (const src of lateFeatureModules) loadScript(src);
  loadShopV2Stack();
})();