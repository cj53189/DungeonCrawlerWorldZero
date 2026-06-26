// Floor 2 roaming boss sight aggro patch.
// Keeps the roaming boss from sealing doors, but makes "it saw you" feel like a real event.
(function installRoamingBossSightAggroPatch() {
  if (window.__dcwRoamingBossSightAggroPatchInstalled) return;
  window.__dcwRoamingBossSightAggroPatchInstalled = true;

  const originalCalculateRoamingBossMovement =
    typeof calculateRoamingBossMovement === "function" ? calculateRoamingBossMovement : null;

  if (!originalCalculateRoamingBossMovement) return;

  calculateRoamingBossMovement = function calculateRoamingBossMovementWithSightAggro(
    enemy,
    targetCrawler,
    canSeeTarget,
    bossCanAlwaysTrack,
    dist
  ) {
    if (
      enemy?.roamingBoss &&
      targetCrawler &&
      canSeeTarget &&
      !bossAggroed &&
      typeof triggerBossAggro === "function"
    ) {
      triggerBossAggro("seen");
      bossCanAlwaysTrack = true;
    }

    return originalCalculateRoamingBossMovement(
      enemy,
      targetCrawler,
      canSeeTarget,
      bossCanAlwaysTrack,
      dist
    );
  };
})();
