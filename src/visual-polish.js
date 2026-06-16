(function installVisualPolishFixes() {
  if (typeof drawEnvironmentalLightFixtures !== "function" || drawEnvironmentalLightFixtures.__visualPolishFixes) return;

  function isPlainDoor(tile) { return tile === "D"; }
  function passable(tile) { return tile === "." || tile === "S" || tile === "C" || tile === "E" || tile === "D" || tile === "L"; }
  function doorRunsLeftRight(x, y) {
    const up = map?.[y - 1]?.[x], down = map?.[y + 1]?.[x], left = map?.[y]?.[x - 1], right = map?.[y]?.[x + 1];
    if (up === "#" && down === "#" && passable(left) && passable(right)) return true;
    if (left === "#" && right === "#" && passable(up) && passable(down)) return false;
    return passable(left) || passable(right);
  }

  function drawDoor(x, y) {
    if (!isPlainDoor(map?.[y]?.[x]) || !visible?.[y]?.[x]) return;
    const px = x * TILE, py = y * TILE;
    const leftRight = doorRunsLeftRight(x, y);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = "#3a352d";
    ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = "#595143";
    if (leftRight) {
      ctx.fillRect(px + 2, py + 1, TILE - 4, 6);
      ctx.fillRect(px + 2, py + TILE - 7, TILE - 4, 6);
      ctx.fillStyle = "#79502b";
      ctx.fillRect(px + 8, py + 5, TILE - 16, TILE - 10);
      ctx.strokeStyle = "#3d2717";
      ctx.strokeRect(px + 8.5, py + 5.5, TILE - 17, TILE - 11);
      ctx.beginPath();
      ctx.moveTo(px + TILE / 2, py + 7);
      ctx.lineTo(px + TILE / 2, py + TILE - 7);
      ctx.stroke();
      ctx.fillStyle = "rgba(238,178,83,0.82)";
      ctx.fillRect(px + TILE - 13, py + TILE / 2 - 2, 4, 4);
    } else {
      ctx.fillRect(px + 1, py + 2, 6, TILE - 4);
      ctx.fillRect(px + TILE - 7, py + 2, 6, TILE - 4);
      ctx.fillStyle = "#79502b";
      ctx.fillRect(px + 5, py + 8, TILE - 10, TILE - 16);
      ctx.strokeStyle = "#3d2717";
      ctx.strokeRect(px + 5.5, py + 8.5, TILE - 11, TILE - 17);
      ctx.beginPath();
      ctx.moveTo(px + 7, py + TILE / 2);
      ctx.lineTo(px + TILE - 7, py + TILE / 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(238,178,83,0.82)";
      ctx.fillRect(px + TILE - 12, py + TILE - 13, 4, 4);
    }
    ctx.restore();
    ctx.lineWidth = 1;
  }

  function drawDoors() {
    if (!map || !visible) return;
    for (let y = 1; y < MAP_ROWS - 1; y++) for (let x = 1; x < MAP_COLS - 1; x++) drawDoor(x, y);
  }

  function drawCampLight() {
    ctx.fillStyle = "rgba(255,160,55,0.34)";
    ctx.beginPath();
    ctx.ellipse(0, 6, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,92,32,0.9)";
    ctx.beginPath();
    ctx.moveTo(-6, 5);
    ctx.quadraticCurveTo(-2, -10, 2, 4);
    ctx.quadraticCurveTo(8, -4, 5, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,232,126,0.95)";
    ctx.beginPath();
    ctx.moveTo(-1, 5);
    ctx.quadraticCurveTo(2, -5, 4, 6);
    ctx.closePath();
    ctx.fill();
  }

  function drawCrystal() {
    ctx.fillStyle = "rgba(112,215,255,0.95)";
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(230,250,255,0.86)";
    ctx.stroke();
  }

  function drawUprightWallLight() {
    ctx.strokeStyle = "rgba(35,24,16,0.92)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(0, -6);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,86,30,0.95)";
    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.quadraticCurveTo(-2, -17, 2, -4);
    ctx.quadraticCurveTo(8, -11, 5, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,232,126,0.95)";
    ctx.beginPath();
    ctx.moveTo(-1, -3);
    ctx.quadraticCurveTo(2, -11, 4, -2);
    ctx.closePath();
    ctx.fill();
  }

  function drawLight(light) {
    if (!light || !visible?.[light.tileY]?.[light.tileX]) return;
    ctx.save();
    ctx.translate(light.x, light.y);
    ctx.imageSmoothingEnabled = false;
    if (light.type === "campfire") drawCampLight();
    else if (light.type === "crystal") drawCrystal();
    else drawUprightWallLight();
    ctx.restore();
    ctx.lineWidth = 1;
  }

  drawEnvironmentalLightFixtures = function drawEnvironmentalLightFixturesPolished() {
    drawDoors();
    for (const light of environmentalLights || []) drawLight(light);
  };
  drawEnvironmentalLightFixtures.__visualPolishFixes = true;
})();

(function installPetSpriteSupportAndDefinitions() {
  if (typeof PET_DEFINITIONS === "undefined") return;

  if (PET_DEFINITIONS.fluffy_cat) {
    const donutDef = PET_DEFINITIONS.fluffy_cat;
    donutDef.displayName = "Princess Donut";
    donutDef.name = "Princess Donut";
    donutDef.description = "A royal Persian show cat with deeply unreasonable magical confidence.";
    donutDef.sprite = {
      key: "princess_donut",
      src: "./assets/sprites/pets/princess_donut.png",
      frameWidth: 64,
      frameHeight: 64,
      columns: 3,
      rows: 4,
      idleFrame: 1,
      sequence: [0, 1, 2, 1],
      animationSpeed: 10,
      renderWidth: 44,
      renderHeight: 44,
      directionRows: { down: 0, up: 1, left: 2, right: 3 },
      rowYOffset: { 2: 7, 3: 7 }
    };
  }

  if (PET_DEFINITIONS.small_velociraptor) {
    const mongoDef = PET_DEFINITIONS.small_velociraptor;
    mongoDef.displayName = "Mongo";
    mongoDef.name = "Mongo";
    mongoDef.description = "A small feathered velociraptor with blue and red plumage, big golden eyes, and murder-chicken confidence.";
    mongoDef.sprite = {
      key: "small_velociraptor",
      src: "./assets/sprites/pets/small_velociraptor.png",
      frameWidth: 64,
      frameHeight: 64,
      columns: 3,
      rows: 4,
      idleFrame: 1,
      sequence: [0, 1, 2, 1],
      animationSpeed: 8,
      renderWidth: 48,
      renderHeight: 48,
      directionRows: { down: 0, up: 1, left: 2, right: 3 }
    };
  }

  const PET_SPRITE_CACHE = new Map();

  function getPetSpriteSheet(sprite) {
    if (!sprite?.src) return null;
    const key = sprite.key || sprite.src;
    let entry = PET_SPRITE_CACHE.get(key);
    if (!entry) {
      const image = new Image();
      entry = { image, failed: false };
      image.onload = () => { entry.failed = false; };
      image.onerror = () => {
        entry.failed = true;
        console.warn(`Pet sprite missing: ${sprite.src}`);
      };
      image.src = sprite.src;
      PET_SPRITE_CACHE.set(key, entry);
    }
    if (entry.failed) return null;
    return entry.image;
  }

  function isPetSpriteReady(sprite, sheet) {
    return !!sprite && !!sheet && sheet.complete &&
      sheet.naturalWidth >= sprite.frameWidth * sprite.columns &&
      sheet.naturalHeight >= sprite.frameHeight * sprite.rows;
  }

  function petDirectionRow(pet, sprite) {
    const rows = sprite.directionRows || { down: 0, up: 1, left: 2, right: 3 };
    const fx = Number(pet.facingX || 0);
    const fy = Number(pet.facingY || 1);
    if (Math.abs(fx) > Math.abs(fy)) return fx < 0 ? rows.left : rows.right;
    return fy < 0 ? rows.up : rows.down;
  }

  function petAnimationFrame(pet, sprite) {
    if (!pet.visualMoving) return Number.isFinite(Number(sprite.idleFrame)) ? Number(sprite.idleFrame) : 0;
    const sequence = Array.isArray(sprite.sequence) && sprite.sequence.length ? sprite.sequence : [0, 1, 2, 1];
    const speed = Math.max(1, Number(sprite.animationSpeed) || 10);
    return sequence[Math.floor(frameCount / speed) % sequence.length];
  }

  function drawPetName(pet, def) {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${def?.displayName || pet.displayName} Lv ${pet.level}`, pet.x, pet.y - 28);
  }

  function drawPetSprite(pet, def, sprite) {
    const sheet = getPetSpriteSheet(sprite);
    if (!isPetSpriteReady(sprite, sheet)) return false;

    const frame = Math.max(0, Math.min(sprite.columns - 1, petAnimationFrame(pet, sprite)));
    const row = Math.max(0, Math.min(sprite.rows - 1, petDirectionRow(pet, sprite)));
    const rowYOffset = Number(sprite.rowYOffset?.[row]) || 0;
    const drawW = Number(sprite.renderWidth) || sprite.frameWidth;
    const drawH = Number(sprite.renderHeight) || sprite.frameHeight;
    const dx = Math.round(pet.x - drawW / 2);
    const dy = Math.round(pet.y + (pet.r || 8) - drawH + rowYOffset);

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(pet.x, pet.y + (pet.r || 8) * 0.76, (pet.r || 8) * 1.34, Math.max(3, (pet.r || 8) * 0.42), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sheet,
      frame * sprite.frameWidth,
      row * sprite.frameHeight,
      sprite.frameWidth,
      sprite.frameHeight,
      dx,
      dy,
      drawW,
      drawH
    );
    ctx.restore();
    drawPetName(pet, def);
    return true;
  }

  const baseDrawActivePet = typeof drawActivePet === "function" ? drawActivePet : null;
  drawActivePet = function drawActivePetWithSprites() {
    const pet = typeof getActivePet === "function" ? getActivePet() : null;
    if (!pet) return;
    const tx = Math.floor(pet.x / TILE), ty = Math.floor(pet.y / TILE);
    if (!visible?.[ty]?.[tx]) return;
    const def = typeof getPetDefinition === "function" ? getPetDefinition(pet) : null;
    if (def?.sprite && drawPetSprite(pet, def, def.sprite)) return;
    if (baseDrawActivePet) baseDrawActivePet();
  };

  const baseUpdatePet = typeof updatePet === "function" ? updatePet : null;
  if (baseUpdatePet && !baseUpdatePet.__petSpriteMotionWrapped) {
    updatePet = function updatePetWithSpriteMotion() {
      const pet = typeof getActivePet === "function" ? getActivePet() : null;
      const prevX = pet?.x;
      const prevY = pet?.y;
      if (pet) pet.visualMoving = false;

      baseUpdatePet();

      if (!pet) return;
      const dx = pet.x - prevX;
      const dy = pet.y - prevY;
      const moved = Math.hypot(dx, dy) > 0.05;
      if (moved) {
        pet.visualMoving = true;
        pet.facingX = dx;
        pet.facingY = dy;
      }

      const target = pet.targetEnemyId && Array.isArray(enemies)
        ? enemies.find(enemy => enemy?.id === pet.targetEnemyId || enemy?.enemyId === pet.targetEnemyId)
        : null;
      if (target) {
        const faceX = target.x - pet.x;
        const faceY = target.y - pet.y;
        if (Math.hypot(faceX, faceY) > 0.1) {
          pet.facingX = faceX;
          pet.facingY = faceY;
        }
      }
    };
    updatePet.__petSpriteMotionWrapped = true;
  }
})();

(function installPetMerchantTestMode() {
  if (typeof PET_DEFINITIONS !== "undefined") {
    for (const def of Object.values(PET_DEFINITIONS)) def.cost = 0;
  }

  if (typeof placePetMerchantInSafeRoom === "function" && !placePetMerchantInSafeRoom.__everyFloorTestMode) {
    placePetMerchantInSafeRoom = function placePetMerchantEveryFloorForTesting(room) {
      petMerchant = null;
      if (!room) return;
      const candidates = roomTileList(room, 1)
        .filter(tile => map[tile.y]?.[tile.x] === "S")
        .filter(tile => Math.hypot(tile.x + 0.5 - player.x / TILE, tile.y + 0.5 - player.y / TILE) > 1.4)
        .sort((a, b) => Math.hypot(a.x - room.cx, a.y - room.cy) - Math.hypot(b.x - room.cx, b.y - room.cy));
      const tile = candidates[0] || { x: room.cx, y: room.cy };
      petMerchant = {
        id: `floor${currentFloor}_pet_merchant`,
        type: "pet_merchant",
        x: tile.x * TILE + TILE / 2,
        y: tile.y * TILE + TILE / 2,
        r: 13,
        floor: currentFloor,
        options: [...PET_MERCHANT_OPTIONS]
      };
    };
    placePetMerchantInSafeRoom.__everyFloorTestMode = true;
  }

  if (typeof petMerchantInReach === "function" && !petMerchantInReach.__everyFloorTestMode) {
    petMerchantInReach = function petMerchantInReachEveryFloorForTesting() {
      return !!petMerchant && Math.hypot(player.x - petMerchant.x, player.y - petMerchant.y) < player.r + petMerchant.r + 36;
    };
    petMerchantInReach.__everyFloorTestMode = true;
  }
})();
