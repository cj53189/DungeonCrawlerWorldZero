# Dungeon Crawler World Zero Sprite Bible

This document is the official sprite-generation and sprite-integration standard for Dungeon Crawler World Zero.

Every generated sprite, edited sprite, player layer, enemy sheet, item overlay, and companion sprite should follow this document unless a specific issue or commit intentionally overrides it.

The goal is simple: assets should drop into the game without needing emergency surgery every time.

---

## 1. Core Art Direction

Dungeon Crawler World Zero uses cute dark-fantasy pixel art for a top-down dungeon crawler.

The style should feel:

- readable at small sizes
- colorful but not neon
- fantasy arcade / JRPG inspired
- slightly goofy, slightly dangerous
- clean enough for fast gameplay
- consistent across players, enemies, items, and pets

The style should not feel:

- blurry
- painterly
- realistic
- overly detailed
- muddy
- horror-gore focused
- AI-smudged
- randomly scaled
- mismatched between frames

Important rule: readability beats detail. If a tiny belt buckle ruins the silhouette, delete the belt buckle. The dungeon will survive.

---

## 2. Universal Technical Rules

All sprite sheets must use:

- PNG format
- transparent background
- crisp pixel edges
- no blur
- no anti-aliased softness unless already part of the project style
- no checkerboard background
- no black background
- no white background
- no labels
- no borders
- no visible grid lines
- no extra padding outside the required canvas
- consistent character center point across every frame
- consistent feet baseline across every frame
- consistent head and body position across animation frames

Every frame must be aligned to the exact grid required by its sheet type.

Do not allow image generators to create uneven frame sizes. Do not allow image generators to add decorative sheet labels, sample poses outside the grid, or extra unused frames.

---

## 3. Player Sprite Sheet Standard

Player base sprites and player equipment layers use this format:

- canvas size: `192 x 256 px`
- grid: `3 columns x 4 rows`
- frame size: `64 x 64 px`
- background: transparent
- file type: PNG

### Player Animation Layout

Rows:

- Row 0: front-facing walk cycle
- Row 1: back-facing walk cycle
- Row 2: left-facing walk cycle
- Row 3: right-facing walk cycle

Columns:

- Column 0: left foot / left step frame
- Column 1: neutral idle frame
- Column 2: right foot / right step frame

This means the sheet order is:

```text
front-left-step   front-idle   front-right-step
back-left-step    back-idle    back-right-step
left-left-step    left-idle    left-right-step
right-left-step   right-idle   right-right-step
```

Do not swap left and right rows. Do not rotate directional rows. Do not use a different row order unless the animation code is updated at the same time.

---

## 4. Player Layering / Paper-Doll Standard

The character creator should use layered sprite sheets. Every visual layer must match the player base sheet exactly.

Layer sheets must use:

- canvas size: `192 x 256 px`
- grid: `3 columns x 4 rows`
- frame size: `64 x 64 px`
- transparent background
- same row order as the player base
- same column order as the player base
- same center point
- same feet baseline

Recommended layer order from bottom to top:

1. body base
2. skin details / scars / markings
3. eyes / face details
4. underwear or modesty layer if needed
5. pants / lower clothing
6. shirt / upper clothing
7. armor
8. boots / gloves
9. hair
10. helmet / hat
11. weapon overlay if attached to body animation
12. special effects / aura, only when needed

Equipment overlays must not include body pixels unless intentionally replacing that body section.

Hair layers must be generated bald-compatible. Do not bake hair into the base body.

Armor layers must be generated body-compatible. Do not create a fully new character sheet for every outfit unless it is a special skin.

---

## 5. Character Creator Minimum Viable Set

The first character creator pass should prove the system works before expanding art content.

Recommended first set:

- one male base
- one female base
- three skin tones
- three hair styles
- three hair colors
- one shirt
- one pants layer
- one armor layer
- one helmet or hat layer
- save/load customization data
- show the same customized character in multiplayer

The character creator should save data like this:

```js
const playerCustomization = {
  body: "male_base",
  skinTone: "tone_02",
  eyeColor: "green",
  hair: "hair_003",
  hairColor: "brown",
  shirt: "starter_tunic",
  pants: "starter_pants",
  armor: "none",
  helmet: "none"
};
```

The saved customization should reference asset IDs, not unique generated sprite files whenever possible.

---

## 6. Enemy Sprite Sheet Standards

Small enemy sprites may use either of these formats depending on the enemy type already supported by the game.

### Standard Enemy Sheet

- canvas size: `256 x 256 px`
- grid: `4 columns x 4 rows`
- frame size: `64 x 64 px`
- transparent background
- PNG

Use this for normal enemies such as skeletons, goblins, rats, bats, slimes, and similar creatures.

### Boss / Large Enemy Sheet

- canvas size: `768 x 576 px`
- grid: `12 columns x 6 rows`
- frame size: `64 x 96 px`
- transparent background
- PNG

Use this for larger enemies or boss characters that need more animation space.

Bosses should still be readable and centered in every frame. Bigger does not mean the sprite gets to wander around the cell like it pays rent.

---

## 7. Companion / Pet Sprite Sheet Standard

Pet companions should use the player-style movement format unless the code says otherwise.

Recommended companion format:

- canvas size: `192 x 256 px`
- grid: `3 columns x 4 rows`
- frame size: `64 x 64 px`
- transparent background
- PNG

Rows:

- Row 0: front-facing walk cycle
- Row 1: back-facing walk cycle
- Row 2: left-facing walk cycle
- Row 3: right-facing walk cycle

Columns:

- Column 0: left step
- Column 1: idle
- Column 2: right step

Pets should have readable silhouettes, clear direction facing, and consistent center alignment.

---

## 8. Item, Weapon, and Equipment Art

Standalone item icons should be square PNGs unless a specific UI requires something else.

Recommended item icon sizes:

- `32 x 32 px` for inventory icons
- `64 x 64 px` for larger UI previews

Item icons must use:

- transparent background
- readable silhouette
- strong contrast
- no labels
- no UI frame baked into the image unless specifically requested

Weapons that appear in player animation should be either:

1. part of an equipment overlay sheet that matches the player sheet, or
2. a separate runtime-attached sprite if the code supports weapon anchoring

Do not bake a sword into the base player body.

---

## 9. Naming Conventions

Use lowercase file names with underscores.

Good:

```text
player_base_male.png
player_base_female.png
hair_short_001.png
hair_long_001.png
armor_starter_leather.png
enemy_skeleton_basic.png
boss_skeleton_king.png
pet_princess_donut.png
```

Bad:

```text
FinalSpriteNEW.png
sprite sheet test.png
Skeleton Boss Better Fixed FINAL.png
player-right-facing-maybe.png
```

Suggested folders:

```text
assets/sprites/player/base/
assets/sprites/player/hair/
assets/sprites/player/clothing/
assets/sprites/player/armor/
assets/sprites/player/weapons/
assets/sprites/enemies/
assets/sprites/bosses/
assets/sprites/pets/
assets/sprites/items/
```

---

## 10. Image Generator Prompt Template: Player Base

Use this template when generating a new player base.

```text
Create a game-ready 2D pixel-art sprite sheet for a top-down dungeon crawler RPG.

Style: cute dark-fantasy JRPG pixel art, clean readable silhouette, crisp pixel edges, no blur, no painterly texture, transparent background.

Output one transparent PNG only.
Exact canvas size: 192 x 256 pixels.
Strict grid layout: 3 columns x 4 rows.
Each frame exactly 64 x 64 pixels.
No labels, no borders, no grid lines, no checkerboard background, no black background, no shadows outside the sprite.

Animation layout:
Row 0: front-facing walk cycle, 3 frames.
Row 1: back-facing walk cycle, 3 frames.
Row 2: left-facing walk cycle, 3 frames.
Row 3: right-facing walk cycle, 3 frames.

Frame columns:
Column 0: left step.
Column 1: neutral idle.
Column 2: right step.

Keep the character centered in every 64 x 64 frame.
Keep feet aligned to the same baseline in every frame.
Keep head and body position consistent across all frames.
Character must be bald if hair will be handled as a separate layer.
Do not include weapons, armor, or hair unless specifically requested.
```

---

## 11. Image Generator Prompt Template: Player Equipment Layer

Use this template when generating equipment, clothing, hair, or armor overlays.

```text
Create a game-ready transparent PNG equipment overlay sprite sheet for a top-down dungeon crawler RPG.

This overlay must align perfectly over the existing player base sprite sheet.

Output one transparent PNG only.
Exact canvas size: 192 x 256 pixels.
Strict grid layout: 3 columns x 4 rows.
Each frame exactly 64 x 64 pixels.
No labels, no borders, no grid lines, no checkerboard background, no black background.

Animation layout:
Row 0: front-facing walk cycle, 3 frames.
Row 1: back-facing walk cycle, 3 frames.
Row 2: left-facing walk cycle, 3 frames.
Row 3: right-facing walk cycle, 3 frames.

Frame columns:
Column 0: left step.
Column 1: neutral idle.
Column 2: right step.

Only draw the requested equipment layer.
Do not draw the full body.
Do not draw background pixels.
Keep every piece aligned to the same body position, head position, and feet baseline as the base sprite.
```

---

## 12. Image Generator Prompt Template: Companion / Pet

```text
Create a game-ready 2D pixel-art sprite sheet for a companion pet in a top-down dungeon crawler RPG.

Style: cute dark-fantasy JRPG pixel art, clean readable silhouette, crisp pixel edges, transparent background.

Output one transparent PNG only.
Exact canvas size: 192 x 256 pixels.
Strict grid layout: 3 columns x 4 rows.
Each frame exactly 64 x 64 pixels.
No labels, no borders, no grid lines, no checkerboard background, no black background.

Animation layout:
Row 0: front-facing walk cycle, 3 frames.
Row 1: back-facing walk cycle, 3 frames.
Row 2: left-facing walk cycle, 3 frames.
Row 3: right-facing walk cycle, 3 frames.

Frame columns:
Column 0: left step.
Column 1: neutral idle.
Column 2: right step.

Keep the pet centered in every frame.
Keep the feet/paws aligned to the same baseline.
Make facing direction clear in every row.
```

---

## 13. Image Generator Prompt Template: Standard Enemy

```text
Create a game-ready 2D pixel-art enemy sprite sheet for a top-down dungeon crawler RPG.

Style: cute dark-fantasy JRPG pixel art, readable at small size, crisp pixel edges, transparent background.

Output one transparent PNG only.
Exact canvas size: 256 x 256 pixels.
Strict grid layout: 4 columns x 4 rows.
Each frame exactly 64 x 64 pixels.
No labels, no borders, no grid lines, no checkerboard background, no black background.

Keep the enemy centered in every frame.
Keep the feet or body baseline consistent.
Make the enemy readable and clearly animated.
Do not include gore or realistic horror details.
```

---

## 14. Image Generator Prompt Template: Boss Enemy

```text
Create a game-ready 2D pixel-art boss sprite sheet for a top-down dungeon crawler RPG.

Style: cute dark-fantasy JRPG pixel art, readable at small size, crisp pixel edges, transparent background.

Output one transparent PNG only.
Exact canvas size: 768 x 576 pixels.
Strict grid layout: 12 columns x 6 rows.
Each frame exactly 64 x 96 pixels.
No labels, no borders, no grid lines, no checkerboard background, no black background.

Keep the boss centered in every frame.
Keep the feet or body baseline consistent across animation frames.
Make the silhouette readable.
Do not include gore or realistic corpse horror.
```

---

## 15. Quality Checklist Before Committing a Sprite

Before adding a sprite to the repo, confirm:

- PNG format
- transparent background
- correct canvas size
- correct grid size
- correct frame size
- no labels
- no borders
- no checkerboard background
- no extra frames
- no extra padding
- character centered in every frame
- feet/body baseline consistent
- directional rows match the code
- left and right directions are not swapped
- animation columns are in the correct order
- file name follows naming conventions
- asset is placed in the correct folder

If any of these fail, fix the asset before wiring it into the game.

---

## 16. Common Failure Modes

Watch for these problems:

- generator adds a visible grid
- generator makes the image 1024 x 1024 instead of the requested size
- transparent background becomes black or white
- character drifts around between frames
- feet baseline changes between frames
- left-facing and right-facing rows are swapped
- back-facing row is accidentally side-facing
- sprite has too much detail and becomes unreadable
- armor layer includes body pixels
- hair layer includes head pixels
- item icon has a baked-in background
- generator adds text labels
- generator creates a pretty image that is useless as a sprite sheet

Pretty but unusable is still unusable. No mercy. Tiny art goblin law.

---

## 17. Codex / Dev Integration Notes

When adding or fixing a sprite, Codex should verify:

1. The file exists in the expected asset folder.
2. The image dimensions match the declared sprite format.
3. The animation loader uses the correct frame width and height.
4. The animation row order matches this document.
5. The animation column order matches this document.
6. Multiplayer clients use the same sprite mapping.
7. Character customization data references asset IDs consistently.

For player animation bugs, inspect row mapping first. Most facing bugs are caused by row-order mismatches between the sheet and the code.

---

## 18. Current Official Direction Mapping

Unless changed in code and documented here, player-style sheets use:

```text
front/down = row 0
back/up    = row 1
left       = row 2
right      = row 3
```

If the game engine uses `down`, `up`, `left`, `right`, map them to the rows above.

If a sprite appears to face the wrong direction in multiplayer, verify this mapping before editing the art.

---

## 19. Final Rule

Do not generate more art chaos than the code can support.

Start with a small, consistent set of assets. Prove the pipeline. Then expand.
