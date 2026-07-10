// Floor identity is intentionally data-only. Runtime systems may use this copy
// without activating the planned floor-specific mechanics described here.
(function installFloorIdentityBlueprints() {
  if (window.FLOOR_IDENTITY_BLUEPRINTS) return;

  const freezeBlueprint = value => Object.freeze(value);

  window.DEFAULT_FLOOR_IDENTITY_BLUEPRINT = freezeBlueprint({
    id: "unclassified_floor",
    name: "Unclassified Floor",
    durationDays: 1,
    stayReason: "Gather resources and improve the odds of surviving descent.",
    uniqueEvent: "The dungeon changes its entertainment schedule.",
    coreDecision: "Leave safely or remain for optional rewards.",
    environmentalStory: "Previous crawlers did not leave cleanly.",
    aiInterference: "The Dungeon AI reacts to rushing, hiding, and greed.",
    lootBias: [],
    enemyFlavor: [],
    dayMessages: ["The floor has refreshed its opportunities and threats."],
    recapLine: "The dungeon is still deciding what kind of mistake this floor is.",
    aiLines: Object.freeze({
      dormantStairwell: "You found where the exit will be. It has not populated yet.",
      stairsPopulated: "The stairwells are now active. Leaving is possible.",
      earlyDescent: "Survival is valid. Ratings remain judgmental."
    }),
    eventCopy: Object.freeze({})
  });

  window.FLOOR_IDENTITY_BLUEPRINTS = Object.freeze({
    0: freezeBlueprint({
      id: "arrival_crawl",
      name: "The Arrival Crawl",
      durationDays: 1,
      stayReason: "Gather starter gear, XP, tutorial knowledge, and boss-weakening rewards.",
      uniqueEvent: "Discover the first dormant stairwell before it populates.",
      coreDecision: "Rush the exit or enter Floor 1 properly equipped.",
      environmentalStory: "Maintenance rooms, rat nests, armories, storage rooms, and security offices reveal the dungeon service layer.",
      aiInterference: "The AI mocks speed-runners and places tempting rewards away from safety.",
      lootBias: Object.freeze(["starter_weapon", "starter_armor", "healing", "loot_box"]),
      enemyFlavor: Object.freeze(["service_vermin", "maintenance_security"]),
      dayMessages: Object.freeze([
        "Orientation has ended. Liability has begun.",
        "The service tunnels are opening their less educational attractions.",
        "Remaining starter supplies have been moved somewhere inconvenient."
      ]),
      recapLine: "Arrival crawl complete. Equipment remains a personal responsibility.",
      aiLines: Object.freeze({
        dormantStairwell: "You found the future exit. Orientation is not finished humiliating you yet.",
        stairsPopulated: "Orientation exits are active. Leaving underdressed is now permitted.",
        earlyDescent: "Leaving orientation early is bold. Entering Floor 1 underdressed is bolder."
      }),
      eventCopy: Object.freeze({
        sponsorCache: Object.freeze({
          title: "MISPLACED ORIENTATION PACKAGE",
          start: "Day {day}: starter supplies landed in {room}. Greed now includes cardio.",
          complete: "Orientation package recovered. The sponsors approve of educational looting."
        })
      })
    }),

    1: freezeBlueprint({
      id: "companion_market",
      name: "The Companion Market",
      durationDays: 5,
      stayReason: "Earn coins, visit the companion merchant, and test whether support is worth the investment.",
      uniqueEvent: "Run Companion Showcase, a planned threat that punishes solo tunnel vision.",
      coreDecision: "Buy a companion now or save early money for equipment.",
      environmentalStory: "A half-safe commerce zone shows that the dungeon economy is a trap with receipts.",
      aiInterference: "The AI treats refusing companionship as a questionable combat philosophy.",
      lootBias: Object.freeze(["coins", "pet_support", "healing", "utility"]),
      enemyFlavor: Object.freeze(["merchant_scavenger", "solo_hunter"]),
      dayMessages: Object.freeze([
        "Companion financing is available. Dignity is not accepted as collateral.",
        "The market has noticed you still have money.",
        "Solo combat remains technically legal and emotionally concerning."
      ]),
      recapLine: "Companion investment reviewed. Loneliness remains free.",
      aiLines: Object.freeze({
        dormantStairwell: "The exit is visible. The companion sales pitch is not finished.",
        stairsPopulated: "The exits are active. Your support strategy remains underfunded.",
        earlyDescent: "You skipped the sales pitch. The monsters appreciate your independence."
      }),
      eventCopy: Object.freeze({
        audienceChallenge: Object.freeze({
          title: "COMPANION SHOWCASE",
          start: "Day {day}: clear the challenge while keeping your support plan intact.",
          complete: "Showcase complete. Teamwork has briefly outperformed stubbornness."
        })
      })
    }),

    2: freezeBlueprint({
      id: "final_tutorial_quadrant",
      name: "The Final Tutorial",
      durationDays: 6,
      source: Object.freeze({
        book: 1,
        seriesFloor: 2,
        fidelity: "compressed_adaptation",
        chapters: Object.freeze([29, 30, 31, 32, 33, 34, 35, 37, 40, 41])
      }),
      stayReason: "Gather build-defining loot before Floor 3 while learning to manage the corpse ecology.",
      uniqueEvent: "Brindle Grubs feed on corpses, pupate, and emerge as Brindled Vespas.",
      coreDecision: "Loot and clear corpses, keep moving, or risk feeding the floor's janitor mobs.",
      environmentalStory: "White floors, orange lichen, cinderblock passages, and increasingly infested neighborhoods mark the final tutorial quadrant.",
      aiInterference: "The AI notices corpse farming, cleanup, retreating, and attempts to weaponize the ecology.",
      lootBias: Object.freeze(["low_tier_box", "bandage", "torch", "gold", "crafting_material"]),
      enemyFlavor: Object.freeze(["brindle_grub", "brindled_vespa", "danger_dingo", "kobold_rider", "mind_horror"]),
      dayMessages: Object.freeze([
        "Day two: audience metrics are live. The cleanup crew remains hungry.",
        "Day three: Brindle Grub density is rising around abandoned corpses.",
        "Day four: pupae have been reported. Leaving them intact is a lifestyle choice.",
        "Day five: Brindled Vespas are emerging from neglected neighborhoods.",
        "Day six: final tutorial privileges are ending with the floor."
      ]),
      recapLine: "Final tutorial report filed. Corpse management has been added to your permanent record.",
      aiLines: Object.freeze({
        dormantStairwell: "The future exit is marked. The final tutorial has not finished grading the remains.",
        stairsPopulated: "The stairwells are active. Floor 3 classification is accepting survivors.",
        earlyDescent: "You left before the ecology finished escalating. Survival remains an annoyingly defensible answer."
      }),
      eventCopy: Object.freeze({
        hazardEscalation: Object.freeze({
          title: "JANITOR MOB ESCALATION",
          start: "Day {day}: the cleanup population is maturing. Corpses are no longer passive scenery."
        })
      })
    }),

    3: freezeBlueprint({
      id: "identity_floor",
      name: "The Identity Floor",
      durationDays: 7,
      stayReason: "Review race and class offers, investigate transformation clues, and prepare a permanent build decision.",
      uniqueEvent: "Preview Chamber, a planned temporary trial of possible future builds.",
      coreDecision: "Choose survivability, damage, utility, mobility, social leverage, or wildcard power.",
      environmentalStory: "Broken booths, rejected class posters, graffiti, and unfinished transformations show identity's cost.",
      aiInterference: "The AI recommends identities based on the player's worst habits.",
      lootBias: Object.freeze(["class_clue", "race_clue", "respec_resource", "utility"]),
      enemyFlavor: Object.freeze(["failed_candidate", "trial_construct"]),
      dayMessages: Object.freeze([
        "Identity processing has begun. Regret remains available afterward.",
        "The dungeon has reviewed your habits and prepared several insulting career paths.",
        "Transformation booths are warming up. Some stains are considered normal."
      ]),
      recapLine: "Identity milestone reviewed. Branding may now be permanent.",
      aiLines: Object.freeze({
        dormantStairwell: "The exit is not accepting applicants until identity processing advances.",
        stairsPopulated: "The exits are active. Your personality defects remain equipped.",
        earlyDescent: "You rushed a permanent identity decision. Very on-brand."
      }),
      eventCopy: Object.freeze({
        audienceChallenge: Object.freeze({
          title: "IDENTITY TRIAL",
          start: "Day {day}: demonstrate the habits your future class will eventually pretend are strategy.",
          complete: "Trial complete. The dungeon has updated its deeply unflattering profile."
        })
      })
    }),

    4: freezeBlueprint({
      id: "mall_that_wants_you_back",
      name: "The Mall That Wants You Back",
      durationDays: 7,
      stayReason: "Loot specialized stores, cosmetics, food, tools, weapons, and arcade rewards.",
      uniqueEvent: "Midnight Sale, a planned simultaneous store opening with rare loot and competing threats.",
      coreDecision: "Risk high-value stores or safely clear lower-value shops.",
      environmentalStory: "Mannequins, broken gates, dead escalators, and barricaded storefronts preserve consumer panic.",
      aiInterference: "The AI creates personalized promotions based on inventory and bad habits.",
      lootBias: Object.freeze(["cosmetic", "food", "tools", "weapon", "jewelry"]),
      enemyFlavor: Object.freeze(["mall_security", "shopper_swarm", "faction_scavenger"]),
      dayMessages: Object.freeze([
        "The mall is extending its hours and shortening your life expectancy.",
        "Personalized offers are now available based on everything you hoard.",
        "Midnight pricing is active. All sales are final because most customers are."
      ]),
      recapLine: "Shopping performance reviewed. Impulse survival remains non-refundable.",
      aiLines: Object.freeze({
        dormantStairwell: "The mall exit is located. Store policy requires more browsing first.",
        stairsPopulated: "The exits are open. The dungeon hopes you enjoyed your purchase history.",
        earlyDescent: "You left before the sale. Financially mature behavior tests poorly."
      }),
      eventCopy: Object.freeze({
        sponsorCache: Object.freeze({
          title: "PERSONALIZED FLASH SALE",
          start: "Day {day}: a sponsor promotion appeared inside {room}. Conditions apply. Monsters also apply.",
          complete: "Flash-sale merchandise acquired. Your data has been sold to everyone."
        })
      })
    })
  });
})();
