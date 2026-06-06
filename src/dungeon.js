function generateDungeon() {
  map = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill("#"));
  seen = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(false));
  visible = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(false));
  rooms = [];

  const targetRooms = 34 + Math.floor(Math.random() * 18);
  let attempts = 0;

  while (rooms.length < targetRooms && attempts < 2200) {
    attempts++;
    const roomRoll = Math.random();
    let w, h, sizeClass, forcedBossCandidate = false;

    // First room becomes the safe room, so keep it small.
    if (rooms.length === 0) {
      w = 7 + Math.floor(Math.random() * 5);
      h = 6 + Math.floor(Math.random() * 4);
      sizeClass = "small";
    }

    // Second accepted room is intentionally boss-sized.
    // The boss chamber is a required ingredient now, not a lucky accident.
    else if (rooms.length === 1) {
      w = 22 + Math.floor(Math.random() * 9);
      h = 15 + Math.floor(Math.random() * 7);
      sizeClass = "large";
      forcedBossCandidate = true;
    }

    else if (roomRoll < 0.55) {
      w = 7 + Math.floor(Math.random() * 7);
      h = 6 + Math.floor(Math.random() * 6);
      sizeClass = "small";
    } else if (roomRoll < 0.88) {
      w = 12 + Math.floor(Math.random() * 8);
      h = 9 + Math.floor(Math.random() * 7);
      sizeClass = "medium";
    } else {
      w = 19 + Math.floor(Math.random() * 11);
      h = 13 + Math.floor(Math.random() * 9);
      sizeClass = "large";
    }
    const x = 2 + Math.floor(Math.random() * (MAP_COLS - w - 4));
    const y = 2 + Math.floor(Math.random() * (MAP_ROWS - h - 4));
    const room = { id: rooms.length, x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2), seen: false, sizeClass, name:null, type:"normal", locked:false, cleared:false, forcedBossCandidate };
    if (rooms.some(r => rectsOverlap(expandRect(room, 2), r))) continue;
    carveRoom(room, ".");
    if (rooms.length > 0) connectRooms(rooms[rooms.length - 1], room);
    rooms.push(room);
  }

  if (rooms.length < 8 || !rooms.some(r => r.forcedBossCandidate)) {
    generateDungeon();
    return;
  }

  assignRoomNamesAndBoss();

  const startRoom = rooms[0];
  startRoom.type="safe"; startRoom.name="Safe Room";
  carveRoom(startRoom, "S");

  cleanupBadDoors();

  const exitRoom = getFarthestRoom(startRoom);
  map[exitRoom.cy][exitRoom.cx] = "E";
  stairwellX = exitRoom.cx;
  stairwellY = exitRoom.cy;

  const spawnRoom = chooseCrawlerSpawnRoom(startRoom);
  placeCrawlerInRoom(spawnRoom);

  placeObjects("C", Math.min(10, Math.max(4, Math.floor(rooms.length / 5))), [startRoom, exitRoom, bossRoom, spawnRoom]);
  placeEnemies(Math.min(16, Math.max(6, Math.floor(rooms.length / 3))), [startRoom, bossRoom, spawnRoom], spawnRoom);
  placeBossEnemy();
  stats.floorRooms = rooms.length;
}

function expandRect(r, a) { return { x: r.x - a, y: r.y - a, w: r.w + a * 2, h: r.h + a * 2 }; }
function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function carveRoom(room, tile) { for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) map[y][x] = tile; }

function connectRooms(a, b) {
  if (Math.random() < 0.5) { carveHorizontal(a.cx, b.cx, a.cy); carveVertical(a.cy, b.cy, b.cx); }
  else { carveVertical(a.cy, b.cy, a.cx); carveHorizontal(a.cx, b.cx, b.cy); }
  maybePlaceDoorNear(a.cx, a.cy, b.cx, b.cy);
}

function carveHorizontal(x1, x2, y) { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) if (map[y][x] === "#") map[y][x] = "."; }
function carveVertical(y1, y2, x) { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) if (map[y][x] === "#") map[y][x] = "."; }

function isWalkableForDoor(tile) {
  return tile === "." || tile === "S" || tile === "C" || tile === "E";
}

function isValidDoorSpot(x, y) {
  if (x <= 1 || y <= 1 || x >= MAP_COLS - 2 || y >= MAP_ROWS - 2) return false;
  if (map[y][x] !== ".") return false;

  const up = map[y - 1][x];
  const down = map[y + 1][x];
  const left = map[y][x - 1];
  const right = map[y][x + 1];

  // Horizontal passage door:
  // wall above + wall below, walkable left + walkable right
  const horizontalDoor =
    up === "#" &&
    down === "#" &&
    isWalkableForDoor(left) &&
    isWalkableForDoor(right);

  // Vertical passage door:
  // wall left + wall right, walkable up + walkable down
  const verticalDoor =
    left === "#" &&
    right === "#" &&
    isWalkableForDoor(up) &&
    isWalkableForDoor(down);

  if (!horizontalDoor && !verticalDoor) return false;

  // Extra anti-goofiness rule:
  // Reject doors that have obvious walk-around space diagonally adjacent on both sides.
  // This helps prevent decorative doors in wide open rooms.
  const diagonalWalkables =
    [
      map[y - 1][x - 1], map[y - 1][x + 1],
      map[y + 1][x - 1], map[y + 1][x + 1]
    ].filter(isWalkableForDoor).length;

  return diagonalWalkables <= 2;
}

function cleanupBadDoors() {
  for (let y = 1; y < MAP_ROWS - 1; y++) {
    for (let x = 1; x < MAP_COLS - 1; x++) {
      if (map[y][x] === "D") {
        map[y][x] = ".";
        if (!isValidDoorSpot(x, y)) {
          map[y][x] = ".";
        } else {
          map[y][x] = "D";
        }
      }
    }
  }
}

function maybePlaceDoorNear(ax, ay, bx, by) {
  if (Math.random() > 0.45) return;

  const mx = Math.floor((ax + bx) / 2);
  const my = Math.floor((ay + by) / 2);

  // Prefer true chokepoints near the hallway midpoint.
  for (let radius = 1; radius <= 8; radius++) {
    const candidates = [];

    for (let y = my - radius; y <= my + radius; y++) {
      for (let x = mx - radius; x <= mx + radius; x++) {
        if (Math.abs(x - mx) !== radius && Math.abs(y - my) !== radius) continue;
        if (x <= 1 || y <= 1 || x >= MAP_COLS - 2 || y >= MAP_ROWS - 2) continue;
        if (isValidDoorSpot(x, y)) candidates.push({ x, y });
      }
    }

    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      map[pick.y][pick.x] = "D";
      return;
    }
  }
}



function assignRoomNamesAndBoss(){
 for(const room of rooms){
   room.sizeClass=room.sizeClass||((room.w*room.h>220)?"large":(room.w*room.h>120)?"medium":"small");
   room.name=choose(ROOM_NAMES[room.sizeClass]||ROOM_NAMES.medium);
 }

 const candidates=rooms
   .filter((r,i)=>i!==0 && r.type!=="safe")
   .sort((a,b)=>(b.w*b.h)-(a.w*a.h));

 // Prefer the intentionally generated boss room, then fall back to the largest large room.
 bossRoom =
   candidates.find(r=>r.forcedBossCandidate) ||
   candidates.find(r=>r.sizeClass==="large") ||
   candidates[0] ||
   null;

 if(bossRoom){
   bossRoom.type="boss";
   bossRoom.name=choose(ROOM_NAMES.boss);
   bossRoom.locked=false;
   bossRoom.cleared=false;
 }
}

function isAdjacentEdgeFloorForRoom(x, y, room) {
  if (!room) return false;
  if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return false;

  const tile = map[y]?.[x];
  if (!(tile === "." || tile === "D" || tile === "L" || tile === "C")) return false;

  const touchesLeft = x === room.x - 1 && y >= room.y && y < room.y + room.h;
  const touchesRight = x === room.x + room.w && y >= room.y && y < room.y + room.h;
  const touchesTop = y === room.y - 1 && x >= room.x && x < room.x + room.w;
  const touchesBottom = y === room.y + room.h && x >= room.x && x < room.x + room.w;

  return touchesLeft || touchesRight || touchesTop || touchesBottom;
}


function roomForTile(tx, ty) {
  // First: true room interior wins.
  for (const room of rooms) {
    if (tx >= room.x && tx < room.x + room.w && ty >= room.y && ty < room.y + room.h) {
      return room;
    }
  }

  // Second: if an open hallway/floor tile hugs a room edge, treat it as part of that room.
  // This keeps fog, room names, and player perception aligned.
  for (const room of rooms) {
    if (isAdjacentEdgeFloorForRoom(tx, ty, room)) {
      return room;
    }
  }

  return null;
}


function updateCurrentRoom(){
 const tx=Math.floor(player.x/TILE),ty=Math.floor(player.y/TILE),room=roomForTile(tx,ty); if(!room)return;
 if(player.currentRoomId!==room.id){player.currentRoomId=room.id; currentRoomName=room.name||"Unknown Chamber";
   if(room.type!=="safe"){stats.namedRoomsEntered++; announcer(`Room discovered: ${currentRoomName}. Try not to make it historically significant.`);}
   if(room.type==="boss"&&!room.cleared&&!room.locked)startBossEncounter(room);
   updateHUD();
 }
}
function startBossEncounter(room){
  // dcw_010: entering a boss room only announces it.
  // Actual lockdown happens only through triggerBossAggro().
  if (!room || room.encounterAnnounced) return;
  room.encounterAnnounced = true;
  achievement("BOSS ENCOUNTER",`${room.name}. Something large and legally distinct from your comfort zone is nearby.`,"bossEncounter");
  announcer("Entering unusually large rooms remains a leading cause of crawler-shaped stains.");
}

function isBossBorderCell(room,x,y){
  return (x>=room.x&&x<room.x+room.w&&(y===room.y-1||y===room.y+room.h)) ||
         (y>=room.y&&y<room.y+room.h&&(x===room.x-1||x===room.x+room.w));
}

function isInsideRoom(room,x,y){
  return x>=room.x && x<room.x+room.w && y>=room.y && y<room.y+room.h;
}

function isFloorLikeForBossDoor(tile){
  return tile === "." || tile === "D" || tile === "L";
}

function isPlayerStandingOnTile(x,y){
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  return px === x && py === y;
}

function bossPerimeterTiles(room){
  const tiles = [];

  // Top and bottom rings just outside room.
  for(let x=room.x; x<room.x+room.w; x++){
    tiles.push({x, y:room.y-1});
    tiles.push({x, y:room.y+room.h});
  }

  // Left and right rings just outside room.
  for(let y=room.y; y<room.y+room.h; y++){
    tiles.push({x:room.x-1, y});
    tiles.push({x:room.x+room.w, y});
  }

  return tiles.filter(t => t.x>0 && t.y>0 && t.x<MAP_COLS-1 && t.y<MAP_ROWS-1);
}

function isConnectedToBossInterior(room,x,y){
  return isInsideRoom(room,x-1,y) ||
         isInsideRoom(room,x+1,y) ||
         isInsideRoom(room,x,y-1) ||
         isInsideRoom(room,x,y+1);
}

function isConnectedToExteriorFloor(room,x,y){
  const neighbors = [
    {x:x-1,y},
    {x:x+1,y},
    {x,y:y-1},
    {x,y:y+1}
  ];

  return neighbors.some(n =>
    !isInsideRoom(room,n.x,n.y) &&
    n.x>0 && n.y>0 && n.x<MAP_COLS-1 && n.y<MAP_ROWS-1 &&
    isFloorLikeForBossDoor(map[n.y][n.x])
  );
}

function isBossDoorCandidate(room,x,y){
  if(x<=0||y<=0||x>=MAP_COLS-1||y>=MAP_ROWS-1) return false;
  if(!isBossBorderCell(room,x,y)) return false;
  if(!isFloorLikeForBossDoor(map[y][x])) return false;
  // Player-occupied seal tiles are still valid candidates; placeBossLockSafely() will queue them.

  // Less picky than before:
  // any floor-like perimeter tile that touches boss interior and also touches outside floor is a lock candidate.
  return isConnectedToBossInterior(room,x,y) && isConnectedToExteriorFloor(room,x,y);
}



function registerBossLock(x, y) {
  if (!bossLockTiles) bossLockTiles = [];
  if (!bossLockTiles.some(t => t.x === x && t.y === y)) {
    bossLockTiles.push({x, y});
  }

  // A spawned lock should be visible to the crawler. Doors block vision beyond them,
  // but the door itself should not be hidden in fog.
  visible[y] = visible[y] || [];
  seen[y] = seen[y] || [];
  visible[y][x] = true;
  seen[y][x] = true;
  minimapDirty = true;
  visibilityDirty = true;
}

function clearBossLocks() {
  if (!bossLockTiles) bossLockTiles = [];

  for (const t of bossLockTiles) {
    if (t.x < 0 || t.y < 0 || t.x >= MAP_COLS || t.y >= MAP_ROWS) continue;
    if (map[t.y]?.[t.x] === "L") {
      map[t.y][t.x] = ".";
    }
    if (visible[t.y]) visible[t.y][t.x] = true;
    if (seen[t.y]) seen[t.y][t.x] = true;
  }

  bossLockTiles = [];
  minimapDirty = true;
  visibilityDirty = true;
}


function isNearCrawlerTile(x, y, radius = 1) {
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  return Math.abs(x - px) <= radius && Math.abs(y - py) <= radius;
}

function isTileInsideRoom(x, y, room) {
  return room && x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
}

function nudgeCrawlerIntoBossRoom() {
  // dcw_007: no teleporting. Player movement should only come from player input.
  return;
}


function placeBossLockSafely(x, y) {
  if (!bossRoom) return false;
  if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return false;

  // No teleporting. If crawler is literally standing in the seal tile,
  // queue this exact lock and place it the moment they clear it.
  if (isCrawlerBlockingTile(x, y, 0)) {
    queueBossLock(x, y);
    return false;
  }

  const tile = map[y]?.[x];

  if (tile === "." || tile === "D" || tile === "C" || tile === "L") {
    map[y][x] = "L";
    registerBossLock(x, y);
    return true;
  }

  // If the ideal tile is invalid, try one tile outward/inward, but never around the crawler.
  const cx = bossRoom.cx;
  const cy = bossRoom.cy;
  const dx = Math.sign(x - cx);
  const dy = Math.sign(y - cy);

  const candidates = [
    {x: x + dx, y: y + dy},
    {x: x - dx, y: y - dy}
  ];

  for (const t of candidates) {
    if (t.x < 0 || t.y < 0 || t.x >= MAP_COLS || t.y >= MAP_ROWS) continue;
    if (isCrawlerBlockingTile(t.x, t.y, 0)) {
      queueBossLock(t.x, t.y);
      continue;
    }

    const alt = map[t.y]?.[t.x];
    if (alt === "." || alt === "D" || alt === "C" || alt === "L") {
      map[t.y][t.x] = "L";
      registerBossLock(t.x, t.y);
      return true;
    }
  }

  // Last resort: queue original. No entrance should be forgotten.
  queueBossLock(x, y);
  return false;
}


function isCrawlerBlockingTile(x, y, radius = 0) {
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);
  return Math.abs(x - px) <= radius && Math.abs(y - py) <= radius;
}

function queueBossLock(x, y) {
  if (!pendingBossLocks) pendingBossLocks = [];
  if (!pendingBossLocks.some(t => t.x === x && t.y === y)) {
    pendingBossLocks.push({x, y});
  }
}

function processPendingBossLocks() {
  if (!bossAggroed && !bossDoorsLocked) return;
  if (!pendingBossLocks || !pendingBossLocks.length) return;

  const remaining = [];

  for (const lock of pendingBossLocks) {
    if (isCrawlerBlockingTile(lock.x, lock.y, 0)) {
      remaining.push(lock);
      continue;
    }

    const tile = map[lock.y]?.[lock.x];
    if (tile === "." || tile === "D" || tile === "C" || tile === "L") {
      map[lock.y][lock.x] = "L";
      registerBossLock(lock.x, lock.y);
    } else {
      remaining.push(lock);
    }
  }

  pendingBossLocks = remaining;
}

// dcw_009: boss aggro requires LOS or attack. No proximity-only lockdown.
function triggerBossAggro(reason = "seen") {
  if (!bossEnemy || bossEnemy.hp <= 0 || bossAggroed) return;

  bossAggroed = true;
  lockBossDoors(bossRoom);

  achievement(
    "BOSS AGGRO",
    reason === "attack"
      ? "You attacked the boss. The exits seal. This is what scholars call commitment."
      : "The boss has noticed you. The exits seal. Running is now a historical concept.",
    `bossAggro_${currentFloor}`
  );
}


function lockBossDoors(room = bossRoom){
  if (!room) return;
  if (bossDoorsLocked) return;
  bossDoorsLocked = true;
  room.lockedDoors = [];

  for(const t of bossPerimeterTiles(room)){
    if(isBossDoorCandidate(room,t.x,t.y)){
      placeBossLockSafely(t.x, t.y);
      minimapDirty=true;
      room.lockedDoors.push({x:t.x,y:t.y});
    }
  }

  // Also scan one tile just inside the perimeter for weird wide-mouth entrances.
  // This catches cases where the "doorway" is technically inside the room edge.
  for(let y=room.y; y<room.y+room.h; y++){
    for(let x=room.x; x<room.x+room.w; x++){
      const nearEdge = x===room.x || x===room.x+room.w-1 || y===room.y || y===room.y+room.h-1;
      if(!nearEdge) continue;
      if(!isFloorLikeForBossDoor(map[y][x])) continue;
      // Player-occupied seal tiles are still valid; placeBossLockSafely() will queue them.

      const outsideNeighbor =
        (x===room.x && isFloorLikeForBossDoor(map[y][x-1])) ||
        (x===room.x+room.w-1 && isFloorLikeForBossDoor(map[y][x+1])) ||
        (y===room.y && isFloorLikeForBossDoor(map[y-1][x])) ||
        (y===room.y+room.h-1 && isFloorLikeForBossDoor(map[y+1][x]));

      if(outsideNeighbor){
        placeBossLockSafely(x, y);
        minimapDirty=true;
        room.lockedDoors.push({x,y});
      }
    }
  }

  if(room.lockedDoors.length===0){
    announcer("Boss door lock failed gracefully. The dungeon blames contractors.");
  }
}

function unlockBossDoors(room){
  clearBossLocks();
  if(room.lockedDoors){
    for(const door of room.lockedDoors){
      if(map[door.y]&&map[door.y][door.x]==="L"){map[door.y][door.x]=".";minimapDirty=true;}
    }
    room.lockedDoors=[];
    return;
  }

  for(const t of bossPerimeterTiles(room)){
    if(map[t.y][t.x]==="L"){map[t.y][t.x]=".";minimapDirty=true;}
  }
}

function placeBossEnemy(){
  if(!bossRoom)return;
  const lvl=Math.max(3, player.level + 2 + Math.floor(currentFloor * 1.25));
  const hp=120+lvl*32;
  bossEnemy={
    x:bossRoom.cx*TILE+TILE/2,
    y:bossRoom.cy*TILE+TILE/2,
    r:20,
    level:lvl,
    boss:true,
    name:choose(["Rat King","Goblin Champion","Bone Collector","Cavern Brute","Kobold Shaman"]),
    hp,
    maxHp:hp,
    damage:10+lvl*4,
    xpReward:75+lvl*24,
    speed:.62+lvl*.025,
    damageCooldown:0,
    wanderAngle:Math.random()*Math.PI*2
  };
  enemies.push(bossEnemy);
}
function completeBossEncounter(enemy){
  bossAggroed = false;
  bossDoorsLocked = false;
  pendingBossLocks = [];
  clearBossLocks();if(!bossRoom||bossRoom.cleared)return; bossRoom.cleared=true; bossRoom.locked=false; stats.bossesDefeated++; unlockBossDoors(bossRoom); const cx=Math.max(bossRoom.x+1,Math.min(bossRoom.x+bossRoom.w-2,bossRoom.cx+1)),cy=Math.max(bossRoom.y+1,Math.min(bossRoom.y+bossRoom.h-2,bossRoom.cy)); if(map[cy][cx]===".")map[cy][cx]="C"; changeAudience(15); achievement("BOSS DEFEATED",`You defeated ${enemy.name||"the boss"}. The doors unlock. The corpse remains lootable, because dignity is not included in the tutorial.`,"bossDefeated");}

function getFarthestRoom(fromRoom) {
  let best = rooms[0], bestDist = -1;
  for (const r of rooms) {
    const d = Math.hypot(r.cx - fromRoom.cx, r.cy - fromRoom.cy);
    if (d > bestDist) { bestDist = d; best = r; }
  }
  return best;
}

function placeObjects(tile, count, excludedRooms = []) {
  const excluded = new Set(excludedRooms.map(r => rooms.indexOf(r)));
  let placed = 0, guard = 0;
  while (placed < count && guard < 400) {
    guard++;
    const i = Math.floor(Math.random() * rooms.length);
    if (excluded.has(i)) continue;
    const room = rooms[i];
    const x = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
    const y = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
    if (map[y][x] === ".") { map[y][x] = tile; placed++; }
  }
}

function placeEnemies(count, excludedRooms = [], spawnRoom = null) {
  const excluded = new Set(excludedRooms.map(r => rooms.indexOf(r)));
  let placed = 0, guard = 0;
  while (placed < count && guard < 600) {
    guard++;
    const i = Math.floor(Math.random() * rooms.length);
    if (excluded.has(i)) continue;
    const room = rooms[i];
    const x = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
    const y = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
    if (map[y][x] === ".") {
      const enemyLevel = rollScaledEnemyLevel(room, spawnRoom);
      const maxHp = 24 + enemyLevel * 10;
      enemies.push({
        x: x * TILE + TILE / 2,
        y: y * TILE + TILE / 2,
        r: 11,
        level: enemyLevel,
        hp: maxHp,
        maxHp: maxHp,
        damage: 5 + enemyLevel * 3,
        xpReward: 12 + enemyLevel * 8,
        speed: 0.74 + enemyLevel * 0.045,
        damageCooldown: 0,
        wanderAngle: Math.random() * Math.PI * 2
      });
      placed++;
    }
  }
}

