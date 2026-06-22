# Multiplayer Authority Contract

This game should treat the server as the shared source of truth and the clients as visual/input simulators.

## Server-owned shared state

The server owns anything that can affect more than one crawler:

- run id, lobby membership, party membership, and floor number
- Floor 0 collapse timer and advancement/failure results
- floor seeds and spawn assignments
- shared world events: opened doors, opened chests, found stairwells, taken loot
- enemy damage/death outcomes
- shared loot containers, including boss loot
- player corpse loot ownership and claim state
- PvP damage and downed/killed state

Clients may request these changes, but once the server accepts and rebroadcasts an event, clients should treat the server version as canonical.

## Client-owned local state

Clients own immediate input and presentation:

- local player input
- animation interpolation
- local camera and HUD
- temporary particles, hit flashes, audio, and screen shake
- predictive local movement until the server corrects it

## Room-owner enemy movement

For Floor 0 enemy movement, one crawler per occupied room acts as the movement snapshot owner. The server currently picks the earliest joined crawler in the room. Other clients should apply that movement visually but should not send competing movement snapshots for that room.

Damage is not movement ownership. Any valid crawler may submit enemy damage, but the server clamps HP so enemy health cannot increase from stale snapshots or stale damage events. Death is final.

## Loot containers

Shared loot containers are server-tracked. Boss loot and future shared enemy loot should follow this pattern:

1. Client observes a valid spawn condition and sends `loot_container_spawned`.
2. Server stores the first valid canonical container.
3. Server rebroadcasts the canonical container.
4. Clients render that container.
5. First valid loot claim sends `loot_taken` or a more specific loot-claim message.
6. Server marks the container taken.
7. Clients remove it.

Clients must not independently recreate shared loot once the server marks its id as taken.

## Event rules

Shared events should be idempotent. Every shared world event should have:

- `eventId`
- `runId`
- `floor` / `currentFloor`
- stable object id, such as `enemyId`, `corpseId`, chest id, or door id
- server revision when the event changes enemy authority state

If the same event arrives twice, applying it twice should not create a different result.

## Current stabilization status

Implemented:

- server-tracked shared loot containers
- boss loot sync through shared loot containers
- taken boss loot is not recreated
- enemy HP is monotonic on the server
- enemy death is final on the server
- client guards prevent stale enemy state from raising HP locally
- regression tests cover enemy HP rollback and death-final behavior

Still needed:

- authoritative floor transition cleanup
- reconnect/resync hardening
- richer multiplayer debug overlay
- eventually move these extensions into first-class core modules instead of runtime wrappers
