# Floor Review Checklist

Use this checklist every time a new floor is designed, tuned, or reviewed. A floor should not pass just because the stairs work and enemies spawn. It should pass because the player has a reason to slow down, make choices, remember what happened, and feel like the Dungeon AI is watching.

## The Five Questions

For every floor, answer these before calling it shippable:

1. **Why would a player stay here longer than necessary?**
   - Strong answer: floor-only loot, faction reputation, timed events, hidden rooms, rescue opportunities, class/race prep, rare crafting materials, optional boss weakening, or merchant access.
   - Weak answer: there are enemies.

2. **What memorable event can happen only on this floor?**
   - Strong answer: a floor-specific spectacle, disaster, contest, ambush, ritual, auction, migration, broadcast, or set piece.
   - Weak answer: a random mini-boss appears.

3. **What decision does the player have to make?**
   - Strong answer: a choice with tradeoffs, such as safety vs. loot, rescue vs. speed, secrecy vs. reputation, early descent vs. optional rewards, or boss fight now vs. boss fight later.
   - Weak answer: open a chest or do not open a chest.

4. **What story does the environment tell without dialogue?**
   - Strong answer: the layout, objects, room names, corpses, barricades, stains, broken machines, traps, and loot placement tell the player what happened here.
   - Weak answer: the room looks spooky.

5. **If the Dungeon AI were watching, how could it mess with the player here?**
   - Strong answer: the AI reacts to what the player actually does: rushing, hiding, hoarding, farming, cowardice, heroics, greed, or repeated tactics.
   - Weak answer: spawn more enemies.

## Pass / Fail Rule

Score each answer from 0 to 2.

- 0 = missing, generic, or purely mechanical.
- 1 = usable, but not memorable yet.
- 2 = specific, flavorful, and tied to the floor identity.

A floor should score **8/10 or higher** before it is considered strong enough to ship.

Anything under 6/10 is probably just a hallway wearing a costume. That is how floors become forgettable speed-run paste.

---

# Current Implementation Audit

The repo already has the bones of a good floor-retention system. The strongest existing piece is `src/floor-pressure-loop.js`, which already supports:

- delayed/dormant stairwell access
- dungeon day cycles
- sponsor cache drops
- bounty elite events
- audience kill challenges
- hazard escalation
- boss weakening from optional detours
- audience penalties for leaving too early

That means the game already has a mechanical answer to: **“Why would the player stay?”**

The current weakness is that most of those systems are still generic. They make the floor stickier, but they do not yet make each floor feel like its own remembered place.

The next revision should not be “add more random stuff.” The next revision should be **floor identity**.

---

# Revised Design Direction

Every floor should be built from two layers:

## Layer 1: Shared Floor Pressure

These systems can appear on many floors:

- stairwells are dormant at first
- staying longer unlocks events
- sponsor caches appear away from the player
- bounties spawn in uncleared rooms
- audience challenges reward risky behavior
- floor hazards escalate over time
- optional objectives can weaken the boss
- early descent hurts audience/reputation

These systems are already aligned with the current code.

## Layer 2: Floor Identity

Each floor needs its own theme package:

- floor name
- stay reason
- unique event
- core decision
- environmental story
- AI manipulation angle
- special loot bias
- special enemy/event flavor
- day-by-day escalation text

The pressure loop should eventually pull from a floor identity table instead of using only generic messages.

---

# Floor Identity Blueprint Format

Use this format for every floor concept.

```md
## Floor X: Floor Name

**Stay reason:**
Why the player would voluntarily remain.

**Only-here event:**
The floor-specific spectacle or disaster.

**Core decision:**
The meaningful tradeoff.

**Environmental story:**
What the player learns without dialogue.

**Dungeon AI interference:**
How the AI exploits player behavior on this floor.

**Mechanical hooks:**
What the code can actually do now or soon.
```

---

# Revised Floor Concepts

## Floor 0: The Arrival Crawl

**Stay reason:**
The player needs starter loot, tutorial signs, first weapons, safe room orientation, and enough enemy XP to avoid entering Floor 1 naked and confused.

**Only-here event:**
The first dormant stairwell reveal. The player can find the exit early, but it does not populate until the floor has had time to become interesting.

**Core decision:**
Rush the stairs and take the audience hit, or stay long enough to gather starter gear and maybe weaken the boss.

**Environmental story:**
Maintenance rooms, rat nests, storage rooms, armories, flooded chambers, and security offices imply the player is inside the dungeon’s service layer rather than a proper fantasy dungeon yet.

**Dungeon AI interference:**
The AI mocks speed-runners, gives greedy players sponsor caches away from safety, and frames the tutorial as entertainment rather than mercy.

**Mechanical hooks:**
Already supported by dormant stairs, tutorial signs, room themes, sponsor caches, bounty elites, audience challenges, hazard escalation, and boss weakening.

## Floor 1: The Companion Market

**Stay reason:**
The player can access the pet/companion merchant, collect money, test party roles, and decide whether to invest in survival support before deeper floors.

**Only-here event:**
A “Run Companion Showcase” where the AI temporarily highlights companion advantages and then spawns a threat designed to punish solo tunnel vision.

**Core decision:**
Spend early coins on a companion or save for gear.

**Environmental story:**
A half-safe commerce zone surrounded by hostile rooms suggests other crawlers have already learned that the dungeon economy is a trap with receipts.

**Dungeon AI interference:**
If the player ignores the companion merchant, the AI starts offering backhanded commentary about “boldly choosing loneliness as a combat strategy.”

**Mechanical hooks:**
Pet merchant already exists for Floor 1. This floor should get companion-themed daily events and at least one event that rewards protecting or using the companion well.

## Floor 2: The Final Tutorial

**Stay reason:**
Floor 2 is the last tutorial floor: a huge quadrant network of cinderblock corridors, white-painted rooms, tutorial signage, loot caches, and increasingly dangerous corpse ecology.

**Only-here event:**
Brindle Grubs hatch around fresh corpses, feed, pupate on a real clock, and emerge as Brindled Vespas if crawlers fail to control the cleanup cycle.

**Core decision:**
Loot corpses immediately, abandon them to the grubs, or spend time suppressing the janitor mobs before they transform.

**Environmental story:**
Orange lichen, quadrant markings, abandoned staging areas, tutorial infrastructure, and corpse-fed infestations show a system built to teach crawlers by escalating preventable mistakes.

**Dungeon AI interference:**
The AI announces ecology milestones and frames delayed cleanup as a crawler-created content opportunity.

**Mechanical hooks:**
Uses existing corpse, enemy, room-theme, save, timer, boss, and Floor 3 offer systems. The existing skeleton art is a temporary visual fallback for the Krakaren Clone encounter.

## Floor 3: The Identity Floor

**Stay reason:**
This is where race and class selection happens, so players stay to explore trial rooms, compare builds, and collect transformation clues.

**Only-here event:**
The Preview Chamber: the player temporarily fights as possible future versions of themselves before locking in a race/class direction.

**Core decision:**
Choose survivability, damage, utility, social advantage, mobility, or weird wildcard power.

**Environmental story:**
Broken transformation booths, rejected class posters, crawler graffiti, and half-finished bodies show that identity has a cost.

**Dungeon AI interference:**
The AI recommends classes based on the player’s worst habits: hoarders get “Trash Paladin,” runners get “Strategic Coward,” and reckless fighters get “Future Corpse With Branding.”

**Mechanical hooks:**
Can connect directly to the character creator and future race/class system. This should be treated as a milestone floor, not a normal combat floor.

## Floor 4: The Mall That Wants You Back

**Stay reason:**
Stores provide specialized loot: clothing, cosmetics, food, tools, weapons, vending machines, arcade rewards, jewelry traps, and faction-controlled shops.

**Only-here event:**
The Midnight Sale: all shutters open at once, rare loot appears, monsters flood the concourse, and other crawlers or NPC factions compete for the best stores.

**Core decision:**
Hit high-value stores and risk conflict, or loot safer low-tier areas and leave with less.

**Environmental story:**
Mannequins posed like shoppers, security gates bent outward, dead escalators, abandoned food trays, and barricaded storefronts show panic disguised as consumerism.

**Dungeon AI interference:**
The AI creates personalized sale signs based on the player’s inventory and bad habits.

**Mechanical hooks:**
Can use room themes, loot bias, sponsor cache placement, faction NPCs later, and floor-specific event text now.

---

# Implementation Notes

## Short-term, safe changes

1. Keep the existing `floor-pressure-loop.js` system.
2. Make floor pressure a first-class script include instead of relying only on an indirect loader.
3. Add a `FLOOR_IDENTITY_BLUEPRINTS` data table.
4. Use the blueprint table for event titles, daily messages, recap lines, and AI commentary.
5. Start with flavor-only changes before adding new hazards.

## Medium-term changes

1. Make daily events floor-specific.
2. Add floor-only resources.
3. Add at least one optional objective per floor.
4. Tie optional objectives to boss weakening, audience gain, reputation, or merchant unlocks.
5. Give each floor a unique environmental decal/room theme pool.

## Long-term changes

1. Add faction settlements.
2. Add NPC rescue/betrayal choices.
3. Add persistent floor reputation.
4. Add race/class trial rooms on Floor 3.
5. Add AI behavior memory so the dungeon can punish repeated tactics.

---

# Design Rule Going Forward

Do not add a new floor unless it answers the five questions.

Do not add a new event unless it gives the player one of these:

- a reason to stay
- a meaningful decision
- a memorable spectacle
- a story clue
- an AI reaction
- a future consequence

The stairs should be available eventually. The mistake is making the stairs the only interesting thing on the floor.
