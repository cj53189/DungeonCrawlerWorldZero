// Floor 3 race/class offer generation.
// This is intentionally data-only for now: no selection UI, no stat math shown to players.
(function installFloor3OfferGenerator() {
  if (window.__dcwFloor3OfferGeneratorInstalled) return;
  window.__dcwFloor3OfferGeneratorInstalled = true;

  const FLOOR3_OFFER_FLOOR = 3;
  const FLOOR3_OFFER_COUNT = 5;

  const RACE_DEFINITIONS = {
    humanVariant: { id: "humanVariant", name: "Human Variant", tone: "Flexible baseline with suspiciously durable paperwork." },
    halfGiant: { id: "halfGiant", name: "Half-Giant", tone: "Large, sturdy, and difficult to file under subtle." },
    stoneblood: { id: "stoneblood", name: "Stoneblood", tone: "Built for blunt trauma, bad weather, and worse management." },
    ironblood: { id: "ironblood", name: "Ironblood", tone: "Disciplined, stubborn, and probably carrying emotional plate armor." },
    goblin: { id: "goblin", name: "Goblin", tone: "Small hands, big schemes, container-related instincts." },
    ratkin: { id: "ratkin", name: "Ratkin", tone: "Fast, survivable, and comfortable in places that need permits." },
    shadowling: { id: "shadowling", name: "Shadowling", tone: "Hard to pin down, harder to supervise." },
    mothkin: { id: "mothkin", name: "Mothkin", tone: "Light-sensitive, oddly graceful, and drawn toward terrible ideas." },
    serpentkin: { id: "serpentkin", name: "Serpentkin", tone: "Poised, venom-adjacent, and legally distinct from a bad influence." },
    constructTouched: { id: "constructTouched", name: "Construct-Touched", tone: "Part person, part hardware error, all liability." },
    cockroachkin: { id: "cockroachkin", name: "Cockroachkin", tone: "Survives disasters that make the dungeon double-check its work.", wildcard: true },
    slimeTouched: { id: "slimeTouched", name: "Slime-Touched", tone: "Adaptable, grossly practical, and hard to fully explain.", wildcard: true },
    plagueTouched: { id: "plagueTouched", name: "Plague-Touched", tone: "Unsettling biology with promising customer-retention issues.", wildcard: true }
  };

  const CLASS_DEFINITIONS = {
    bulwark: { id: "bulwark", name: "Bulwark", tone: "Turns incoming violence into a scheduling problem." },
    doorKicker: { id: "doorKicker", name: "Door-Kicker", tone: "Treats architecture like it owes money." },
    bladeSentinel: { id: "bladeSentinel", name: "Blade Sentinel", tone: "Defensive edge work for people who brought discipline to a meat lottery." },
    bruiser: { id: "bruiser", name: "Bruiser", tone: "Simple answers, heavy punctuation." },
    painSponge: { id: "painSponge", name: "Pain Sponge", tone: "Absorbs punishment with the grace of wet carpet and the tenacity of debt." },
    ranger: { id: "ranger", name: "Ranger", tone: "Solves bite-range problems from a civilized distance." },
    trapwright: { id: "trapwright", name: "Trapwright", tone: "Makes the floor somebody else's problem." },
    cartographer: { id: "cartographer", name: "Cartographer", tone: "Maps danger, panic routes, and where dignity was last seen." },
    grifter: { id: "grifter", name: "Grifter", tone: "Survives with charm, theft, and plausible deniability." },
    lootguard: { id: "lootguard", name: "Lootguard", tone: "Protects treasure, even from common sense." },
    hypeConduit: { id: "hypeConduit", name: "Hype Conduit", tone: "Turns audience attention into a weaponized bad idea." },
    survivalist: { id: "survivalist", name: "Survivalist", tone: "Makes scraps last and panic look like a system." },
    junkArtificer: { id: "junkArtificer", name: "Junk Artificer", tone: "Duct tape, spite, and unsafe confidence." },
    brawler: { id: "brawler", name: "Brawler", tone: "Hands-first problem solving for a world with too many teeth." },
    knifeDancer: { id: "knifeDancer", name: "Knife Dancer", tone: "Footwork, edges, and court-admissible movement." },
    toxicologist: { id: "toxicologist", name: "Toxicologist", tone: "Makes liquids legally interesting." },
    tactician: { id: "tactician", name: "Tactician", tone: "Overthinks survival and occasionally gets rewarded for it." },
    escapeArtist: { id: "escapeArtist", name: "Escape Artist", tone: "A professional relationship with leaving." },
    wildShot: { id: "wildShot", name: "Wild Shot", tone: "Accuracy is a journey. Collateral is a lifestyle." },
    wallScholar: { id: "wallScholar", name: "Wall Scholar", tone: "Has learned many things from walls, none of them voluntarily." },
    violentSolutionist: { id: "violentSolutionist", name: "Violent Solutionist", tone: "Believes most problems have hit points." },
    omenListener: { id: "omenListener", name: "Omen Listener", tone: "Hears patterns in the nothing. The nothing is uncomfortable." },
    daredevil: { id: "daredevil", name: "Daredevil", tone: "Makes risk look intentional after the paperwork catches up." },
    luckyBastard: { id: "luckyBastard", name: "Lucky Bastard", tone: "The dungeon checked the math twice and is still annoyed.", wildcard: true },
    backAlleyAlchemist: { id: "backAlleyAlchemist", name: "Back-Alley Alchemist", tone: "Touches unknown fluids with entrepreneurial confidence.", wildcard: true },
    chaosAccountant: { id: "chaosAccountant", name: "Chaos Accountant", tone: "Balances risk, rewards, and whatever that smell is.", wildcard: true }
  };

  const ORIGIN_OFFER_RULES = {
    securityContractor: { races: ["humanVariant", "ironblood", "stoneblood"], classes: ["bulwark", "doorKicker", "bladeSentinel"], line: "Your pre-crawl profile suggests structured violence and familiarity with bad rooms." },
    bouncer: { races: ["halfGiant", "stoneblood", "ironblood"], classes: ["bruiser", "painSponge", "doorKicker"], line: "Your pre-crawl profile suggests crowd control, poor lighting, and excellent forearms." },
    scout: { races: ["humanVariant", "ratkin", "mothkin"], classes: ["ranger", "trapwright", "cartographer"], line: "Your pre-crawl profile suggests distance, routes, and not volunteering to be bitten." },
    grifter: { races: ["goblin", "ratkin", "shadowling"], classes: ["grifter", "lootguard", "hypeConduit"], line: "Your pre-crawl profile suggests flexible ethics and marketable survival instincts." },
    urbanExplorer: { races: ["ratkin", "goblin", "mothkin"], classes: ["trapwright", "survivalist", "cartographer"], line: "Your pre-crawl profile suggests comfort in places with warning signs and tetanus opportunities." },
    prizeIdiot: { races: ["halfGiant", "goblin", "humanVariant"], classes: ["brawler", "hypeConduit", "painSponge"], line: "Your pre-crawl profile suggests camera-friendly confidence and unclear long-term planning." },
    survivalist: { races: ["humanVariant", "ratkin", "stoneblood"], classes: ["survivalist", "junkArtificer", "bulwark"], line: "Your pre-crawl profile suggests you can make trash, hunger, and fear last longer than expected." },
    analyst: { races: ["constructTouched", "mothkin", "humanVariant"], classes: ["cartographer", "tactician", "trapwright"], line: "Your pre-crawl profile suggests pattern recognition, preparation, and dangerous amounts of thinking." },
    knifeProblem: { races: ["shadowling", "serpentkin", "goblin"], classes: ["knifeDancer", "toxicologist", "grifter"], line: "Your pre-crawl profile suggests edges, movement, and a pending discussion with legal." },
    unsortedCrawler: { races: ["humanVariant", "goblin", "ratkin"], classes: ["survivalist", "brawler", "luckyBastard"], line: "Your pre-crawl profile remains annoyingly broad. The dungeon has improvised, which is never comforting." }
  };

  const BEHAVIOR_OFFER_RULES = {
    pain_sponge: { races: ["stoneblood", "halfGiant", "ironblood"], classes: ["painSponge", "bulwark"], line: "Damage records indicate a concerning willingness to receive enemy feedback directly." },
    air_murderer: { races: ["goblin", "mothkin", "humanVariant"], classes: ["wildShot", "brawler"], line: "Combat logs show repeated hostility toward empty space. Empty space has declined to comment." },
    wall_scholar: { races: ["stoneblood", "halfGiant", "constructTouched"], classes: ["wallScholar", "doorKicker"], line: "Navigation records show extended academic engagement with walls." },
    loot_goblin: { races: ["goblin", "ratkin", "constructTouched"], classes: ["lootguard", "grifter", "junkArtificer"], line: "Container interaction records indicate treasure-adjacent moral flexibility." },
    door_problem: { races: ["halfGiant", "stoneblood", "goblin"], classes: ["doorKicker", "trapwright"], line: "Door interaction records suggest confidence around suspicious hinges." },
    violent_solutionist: { races: ["ironblood", "halfGiant", "serpentkin"], classes: ["violentSolutionist", "bladeSentinel", "bruiser"], line: "Hostile depreciation records indicate a strong preference for reducing monster inventory." },
    nothing_whisperer: { races: ["shadowling", "mothkin", "slimeTouched"], classes: ["omenListener", "chaosAccountant"], line: "Interaction logs show repeated attempts to communicate with nothing. Something may have answered." },
    cautious_or_lost: { races: ["ratkin", "mothkin", "cockroachkin"], classes: ["escapeArtist", "survivalist"], line: "Safe-room records suggest caution, confusion, or an impressive relationship with doors." },
    risk_tolerant: { races: ["humanVariant", "ironblood", "cockroachkin"], classes: ["daredevil", "ranger", "luckyBastard"], line: "Exposure records suggest you spend a lot of time outside safety, for bravery or because nobody stopped you." },
    gear_magpie: { races: ["goblin", "constructTouched", "ratkin"], classes: ["junkArtificer", "lootguard"], line: "Equipment records suggest a shiny-object survival strategy. Honestly, not the worst one." }
  };

  const FALLBACK_RACES = ["humanVariant", "goblin", "ratkin", "stoneblood", "mothkin"];
  const FALLBACK_CLASSES = ["survivalist", "brawler", "ranger", "grifter", "bulwark"];
  const WILDCARD_RACES = ["cockroachkin", "slimeTouched", "plagueTouched", "shadowling", "constructTouched"];
  const WILDCARD_CLASSES = ["luckyBastard", "backAlleyAlchemist", "chaosAccountant", "omenListener", "daredevil"];

  function activeStats() { return typeof stats !== "undefined" ? stats : {}; }
  function activeFloor() { return typeof currentFloor !== "undefined" ? Number(currentFloor) : 0; }
  function activeProgression() { return typeof player !== "undefined" ? player?.progression : null; }

  function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return Math.abs(hash >>> 0);
  }

  function rotate(ids, seed) {
    if (!ids.length) return [];
    const offset = seed % ids.length;
    return ids.slice(offset).concat(ids.slice(0, offset));
  }

  function cleanTagIds(tags) {
    return (Array.isArray(tags) ? tags : []).map(tag => typeof tag === "string" ? tag : tag?.id).filter(Boolean);
  }

  function addOffer(target, definitions, id, source, reason) {
    if (!id || !definitions[id] || target.some(item => item.id === id)) return false;
    const def = definitions[id];
    target.push({ id: def.id, name: def.name, tone: def.tone, source, reason });
    return true;
  }

  function addOffers(target, definitions, ids, source, reason, limit = Infinity) {
    let added = 0;
    for (const id of ids || []) {
      if (target.length >= FLOOR3_OFFER_COUNT || added >= limit) break;
      if (addOffer(target, definitions, id, source, reason)) added++;
    }
    return added;
  }

  function fillOffers(target, definitions, ids, source, reason) {
    for (const id of ids || []) {
      if (target.length >= FLOOR3_OFFER_COUNT) break;
      addOffer(target, definitions, id, source, reason);
    }
  }

  function currentOriginId(progression) {
    const saved = progression?.originProfileId;
    if (saved && ORIGIN_OFFER_RULES[saved]) return saved;
    const name = progression?.originProfile || progression?.temporaryClass;
    const match = Object.keys(ORIGIN_OFFER_RULES).find(id => {
      const def = typeof ORIGIN_DEFINITIONS !== "undefined" ? ORIGIN_DEFINITIONS[id] : null;
      return def?.name === name;
    });
    return match || "unsortedCrawler";
  }

  function buildFloor3OfferSet(options = {}) {
    const progression = options.progression || activeProgression() || {};
    const behavior = options.behaviorProfile || progression.behaviorProfile || (typeof getBehaviorProfile === "function" ? getBehaviorProfile() : { tags: [] });
    const originId = currentOriginId(progression);
    const originRule = ORIGIN_OFFER_RULES[originId] || ORIGIN_OFFER_RULES.unsortedCrawler;
    const tagIds = cleanTagIds(behavior.tags);
    const statsSource = activeStats();
    const seedInput = [originId, tagIds.join("|"), statsSource.damageTaken || 0, statsSource.enemiesKilled || 0, statsSource.chestsOpened || 0, statsSource.doorsOpened || 0].join("::");
    const seed = hashString(seedInput);

    const races = [];
    const classes = [];
    const lines = [];
    if (originRule.line) lines.push(originRule.line);

    addOffers(races, RACE_DEFINITIONS, originRule.races, "origin", originRule.line, 2);
    addOffers(classes, CLASS_DEFINITIONS, originRule.classes, "origin", originRule.line, 2);

    for (const tagId of tagIds) {
      const rule = BEHAVIOR_OFFER_RULES[tagId];
      if (!rule) continue;
      if (rule.line) lines.push(rule.line);
      addOffers(races, RACE_DEFINITIONS, rule.races, "behavior", rule.line, 1);
      addOffers(classes, CLASS_DEFINITIONS, rule.classes, "behavior", rule.line, 1);
      const behaviorRaceCount = races.filter(item => item.source === "behavior").length;
      const behaviorClassCount = classes.filter(item => item.source === "behavior").length;
      if (behaviorRaceCount >= 2 && behaviorClassCount >= 2) break;
    }

    addOffers(races, RACE_DEFINITIONS, rotate(WILDCARD_RACES, seed), "wildcard", "The dungeon reserved one option for statistical nonsense.", 1);
    addOffers(classes, CLASS_DEFINITIONS, rotate(WILDCARD_CLASSES, seed + 7), "wildcard", "The dungeon reserved one option for statistical nonsense.", 1);
    fillOffers(races, RACE_DEFINITIONS, FALLBACK_RACES, "fallback", "Fallback offer added to preserve choice count.");
    fillOffers(classes, CLASS_DEFINITIONS, FALLBACK_CLASSES, "fallback", "Fallback offer added to preserve choice count.");

    return {
      floor: FLOOR3_OFFER_FLOOR,
      version: 1,
      generatedAtFloor: Number.isFinite(activeFloor()) ? activeFloor() : null,
      originId,
      originName: progression.originProfile || progression.temporaryClass || "Unsorted Crawler",
      behaviorTagIds: tagIds,
      races: races.slice(0, FLOOR3_OFFER_COUNT),
      classes: classes.slice(0, FLOOR3_OFFER_COUNT),
      lines: Array.from(new Set(lines)).slice(0, 6),
      seed
    };
  }

  function ensureFloor3OfferSet(options = {}) {
    const progression = activeProgression();
    if (!progression) return null;
    if (typeof updateBehaviorProfile === "function") updateBehaviorProfile();
    const current = progression.floor3Offers;
    const shouldGenerate = options.force || !current || current.version !== 1;
    if (shouldGenerate) progression.floor3Offers = buildFloor3OfferSet(options);
    return progression.floor3Offers;
  }

  function maybeGenerateFloor3Offers() {
    const progression = activeProgression();
    if (!progression || activeFloor() < FLOOR3_OFFER_FLOOR) return null;
    const offers = ensureFloor3OfferSet();
    if (offers && !progression.floor3OfferNoticeShown) {
      progression.floor3OfferNoticeShown = true;
      console.info("Floor 3 offers generated", offers);
    }
    return offers;
  }

  function getFloor3OfferSet(options = {}) {
    return options.force ? ensureFloor3OfferSet({ force: true }) : (activeProgression()?.floor3Offers || maybeGenerateFloor3Offers());
  }

  function summarizeFloor3Offers(offers = getFloor3OfferSet()) {
    if (!offers) return "No Floor 3 offers generated yet.";
    const raceNames = offers.races.map(item => item.name).join(", ");
    const classNames = offers.classes.map(item => item.name).join(", ");
    return `Origin: ${offers.originName}. Behavior: ${offers.behaviorTagIds.join(", ") || "none"}. Race offers: ${raceNames}. Class offers: ${classNames}.`;
  }

  function wrap(name, wrapper) {
    const original = globalThis[name];
    if (typeof original !== "function" || original.__floor3OfferWrapped) return false;
    const wrapped = wrapper(original);
    wrapped.__floor3OfferWrapped = true;
    globalThis[name] = wrapped;
    return true;
  }

  function installHooks() {
    wrap("advanceToNextFloor", original => function advanceToNextFloorWithFloor3Offers() {
      const result = original.apply(this, arguments);
      maybeGenerateFloor3Offers();
      return result;
    });
    wrap("showSafeRoomRecap", original => function showSafeRoomRecapWithFloor3Offers() {
      maybeGenerateFloor3Offers();
      return original.apply(this, arguments);
    });
    maybeGenerateFloor3Offers();
  }

  globalThis.FLOOR3_RACE_DEFINITIONS = RACE_DEFINITIONS;
  globalThis.FLOOR3_CLASS_DEFINITIONS = CLASS_DEFINITIONS;
  globalThis.buildFloor3OfferSet = buildFloor3OfferSet;
  globalThis.ensureFloor3OfferSet = ensureFloor3OfferSet;
  globalThis.getFloor3OfferSet = getFloor3OfferSet;
  globalThis.summarizeFloor3Offers = summarizeFloor3Offers;

  let attempts = 0;
  const retry = () => {
    attempts++;
    installHooks();
    if (attempts < 12) setTimeout(retry, 250);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
})();