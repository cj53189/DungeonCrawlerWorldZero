drawDynamicMarkers = true;

(function loadMobileHapticsModule() {
  if (document.querySelector('script[src="./src/haptics.js"]')) return;
  const script = document.createElement("script");
  script.src = "./src/haptics.js";
  script.async = false;
  script.defer = true;
  document.head.appendChild(script);
})();

(function loadSpawnAllocationUiModule() {
  if (document.querySelector('script[src="./src/spawn-allocation-ui.js"]')) return;
  const script = document.createElement("script");
  script.src = "./src/spawn-allocation-ui.js";
  script.async = false;
  script.defer = true;
  document.head.appendChild(script);
})();
