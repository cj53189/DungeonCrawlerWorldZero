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
