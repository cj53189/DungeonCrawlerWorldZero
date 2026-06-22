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

(function loadSafeRoomLogoutDashboardModule() {
  if (document.querySelector('script[src="./src/safe-room-logout.js"]')) return;
  const script = document.createElement("script");
  script.src = "./src/safe-room-logout.js";
  script.async = false;
  script.defer = true;
  document.head.appendChild(script);
})();

(function loadMobileSkillsLayoutRefreshModule() {
  if (document.querySelector('script[src="./src/mobile-skills-layout-refresh.js"]')) return;
  const script = document.createElement("script");
  script.src = "./src/mobile-skills-layout-refresh.js";
  script.async = false;
  script.defer = true;
  document.head.appendChild(script);
})();
