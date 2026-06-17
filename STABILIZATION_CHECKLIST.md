# Dungeon Crawler World Zero Stabilization Checklist

Use this before a final playable push. The goal is not to add new systems here. The goal is to confirm that the existing systems do not fight each other.

## 1. Boot and title flow
- Hard refresh the deployed app.
- Confirm the settings gear is visible on title and in-game.
- Open Settings, close Settings, then reopen Settings.
- Start Single Player from title.
- Return to title after death or center-message restart.
- Start another Single Player run without refreshing.

## 2. UI editor smoke test
- Open Settings and turn UI Edit Mode on.
- Select HUD, move it with the overlay MOVE control, resize it, then turn UI Edit Mode off.
- Hard refresh and confirm the saved HUD placement persists.
- Confirm the settings gear cannot be hidden.
- Use Reset UI Layout and confirm the HUD/settings return to usable defaults.

## 3. Single-player crawl
- Leave the safe room.
- Open a door.
- Enter a new room and confirm the fog reveal wave dissipates smoothly.
- Fight one normal enemy.
- Open a chest.
- Find the stairwell and confirm the stairwell marker appears correctly.
- Descend to the next floor.

## 4. Pet behavior and vision
- Acquire or spawn a pet.
- Walk through a hallway with the pet trailing behind and slightly ahead.
- Confirm the pet is not swallowed by fog while still respecting walls and line-of-sight.
- Enter a new room with the pet and confirm the pet does not instantly reveal the entire room.
- Confirm pet attacks still work and projectiles do not break fog/minimap behavior.

## 5. Multiplayer lobby and Floor 0
- Start Quick Match.
- Confirm the lobby panel does not auto-open over gameplay.
- Tap LOBBY and confirm the compact lobby panel opens.
- Confirm dev/test buttons are hidden unless `localStorage.setItem("dcw.showDevLobby", "true")` is used.
- Confirm Copy Invite/Copy Link still works.
- Confirm Floor 0 timer/status is readable.

## 6. PvP arena
- Start PvP Arena.
- Confirm the LOBBY button is still available.
- Confirm the old PvP info card under the vitals is gone.
- Confirm left/right/up/down remote crawler direction looks correct.
- Return to title and start a new run without refreshing.

## 7. Recap
- Open Recap in a safe room.
- Confirm normal recap stats render.
- In multiplayer, confirm Crawlers Remaining appears without showing a max-player count.
- Close and reopen Recap without duplicate lines stacking.

## 8. Mobile landscape
- Test on iPhone Safari/Home Screen in landscape.
- Confirm touch controls are reachable.
- Confirm character creator is usable.
- Confirm the lobby panel does not block the entire screen.
- Confirm Settings can always be opened.

## Known stabilization risks
- Some current fixes are compatibility-layer wrappers rather than clean core integrations.
- `canvas-compat.js` currently loads the clean UI editor and pet vision fix dynamically.
- `multiplayer-panel-autoclose.js` is doing several jobs and should eventually be folded into the core multiplayer/UI modules.
- The recap system needs a dedicated cleanup pass.

## Final-push rule
If any item above fails, fix that item before adding new features.
