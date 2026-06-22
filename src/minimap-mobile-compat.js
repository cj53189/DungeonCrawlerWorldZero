drawDynamicMarkers = true;

(function loadMobileHapticsModule() {
  if (document.querySelector('script[src="./src/haptics.js"]')) return;
  const script = document.createElement("script");
  script.src = "./src/haptics.js";
  script.async = false;
  script.defer = true;
  document.head.appendChild(script);
})();
