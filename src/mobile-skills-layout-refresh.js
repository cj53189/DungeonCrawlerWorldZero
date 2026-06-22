(function installMobileSkillsLayoutRefresh() {
  if (window.__dcwMobileSkillsLayoutRefreshInstalled) return;
  window.__dcwMobileSkillsLayoutRefreshInstalled = true;

  function sync() {
    const panel = document.getElementById("inventoryPanel");
    const enabled = !!panel && panel.classList.contains("open") && panel.dataset.inventoryCategory === "skills";
    document.body.classList.toggle("inventorySkillsMobileLayout", enabled);
    if (!enabled || !panel) return;
    panel.style.overflowY = "auto";
    panel.style.webkitOverflowScrolling = "touch";
    panel.style.touchAction = "pan-y";
  }

  function scheduleSync() {
    sync();
    setTimeout(sync, 0);
    setTimeout(sync, 80);
    setTimeout(sync, 240);
  }

  const observer = new MutationObserver(scheduleSync);

  function observe() {
    const panel = document.getElementById("inventoryPanel");
    if (panel && panel.dataset.mobileSkillsRefreshObserved !== "true") {
      panel.dataset.mobileSkillsRefreshObserved = "true";
      observer.observe(panel, { attributes: true, attributeFilter: ["class", "data-inventory-category"], childList: true, subtree: true });
    }
    scheduleSync();
  }

  document.addEventListener("click", event => {
    if (event.target?.closest?.("[data-spend-attribute], [data-spend-skill], [data-inventory-category]")) scheduleSync();
  }, true);
  window.addEventListener("resize", scheduleSync);
  window.addEventListener("orientationchange", scheduleSync);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe, { once: true });
  else observe();
})();
