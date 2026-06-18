(function installInventoryBackbone() {
  if (window.DCWZInventoryBackboneInstalled) return;
  window.DCWZInventoryBackboneInstalled = true;

  const SUPPLY_DEFS = Object.freeze({
    small_potion: Object.freeze({ id: "small_potion", type: "item", name: "Small Healing Potion", rarity: "Common", icon: "+", stackable: true, maxStack: 9, heal: 28, description: "Restores 28 HP." }),
    bandage: Object.freeze({ id: "bandage", type: "item", name: "Emergency Wrap", rarity: "Common", icon: "=", stackable: true, maxStack: 12, heal: 16, description: "Restores 16 HP." }),
    ration: Object.freeze({ id: "ration", type: "item", name: "Crawler Ration", rarity: "Uncommon", icon: "o", stackable: true, maxStack: 6, heal: 12, audience: 1, description: "Restores 12 HP and adds +1 Audience." }),
    focus_can: Object.freeze({ id: "focus_can", type: "item", name: "Focus Can", rarity: "Rare", icon: "!", stackable: true, maxStack: 4, heal: 10, cooldownReduction: 18, audience: 2, description: "Restores 10 HP, reduces cooldowns, and adds +2 Audience." })
  });
  const SUPPLY_IDS = ["small_potion", "bandage", "ration", "focus_can"];

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function qty(value) { return Math.max(1, Math.floor(Number(value) || 1)); }
  function makeBackboneId(prefix) { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 999999)}`; }
  function baseId(item) { return item?.itemId || item?.definitionId || item?.baseId || null; }
  function isSupply(item) { return !!item && item.type === "item" && !!SUPPLY_DEFS[baseId(item) || item.id]; }
  function isStackable(item) { return !!item && (item.stackable === true || Number(item.maxStack) > 1) && baseId(item); }
  function normalizeSupply(item) {
    if (!item) return null;
    const def = SUPPLY_DEFS[baseId(item)] || SUPPLY_DEFS[item.id];
    if (!def) return item;
    return { ...def, ...item, itemId: def.id, quantity: qty(item.quantity || 1), visualSheet: item.visualSheet || null };
  }
  function normalizeInventory() {
    if (!Array.isArray(player.inventory)) player.inventory = [];
    player.inventory = player.inventory.map(normalizeSupply).filter(Boolean);
    ensureBackboneEquipmentSlots();
    return player.inventory;
  }
  function ensureBackboneEquipmentSlots() {
    if (!player.equipment) player.equipment = {};
    for (const slot of ["weapon", "offhand", "head", "chest", "legs", "feet", "accessory", "light", "pet"]) {
      if (!Object.prototype.hasOwnProperty.call(player.equipment, slot)) player.equipment[slot] = null;
    }
    return player.equipment;
  }
  function createSupply(id, amount = 1) {
    const def = SUPPLY_DEFS[id];
    if (!def) return null;
    return { ...def, id: makeBackboneId(id), itemId: id, quantity: qty(amount), visualSheet: null };
  }
  function randomSupply(forceRare = false) {
    const pool = forceRare ? ["ration", "focus_can", "small_potion"] : ["small_potion", "small_potion", "bandage", "bandage", "ration", "focus_can"];
    return createSupply(pick(pool));
  }

  window.DCWZ_ITEM_DEFINITIONS = SUPPLY_DEFS;
  window.createInventoryItem = createSupply;
  window.createRandomConsumable = randomSupply;

  if (typeof SLOT_LABELS === "object") SLOT_LABELS.offhand = SLOT_LABELS.offhand || "Offhand / Shield";
  if (typeof ITEM_BASES === "object") ITEM_BASES.offhand = ITEM_BASES.offhand || ["Shield", "Buckler", "Parry Plate", "Trash Lid"];

  const originalGenerateGear = window.generateGear || (typeof generateGear === "function" ? generateGear : null);
  if (originalGenerateGear && !originalGenerateGear.__inventoryBackboneWrapped) {
    window.generateGear = generateGear = function generateGearWithOffhand(forceRare = false) {
      const item = originalGenerateGear(forceRare);
      if (item && Math.random() < 0.16) {
        const rarity = item.rarity || "Common";
        const power = typeof rarityPower === "function" ? rarityPower(rarity) : 1;
        item.slot = "offhand";
        item.name = `${rarity} ${pick(["Rusty", "Goblin", "Bone", "Lucky", "Questionable"])} ${pick(ITEM_BASES.offhand)}`;
        item.defense = (item.defense || 0) + power + 1;
        item.hp = item.hp || 0;
        item.attack = item.attack || 0;
        item.speed = item.speed || 0;
        item.audience = item.audience || 0;
      }
      if (item && !Object.prototype.hasOwnProperty.call(item, "visualSheet")) item.visualSheet = null;
      return item;
    };
    window.generateGear.__inventoryBackboneWrapped = true;
  }

  const originalItemDescription = window.itemDescription || (typeof itemDescription === "function" ? itemDescription : null);
  window.itemDescription = itemDescription = function itemDescriptionBackbone(item) {
    const normalized = normalizeSupply(item) || item;
    if (isSupply(normalized)) {
      const parts = [];
      if (normalized.heal) parts.push(`Restores ${normalized.heal} HP`);
      if (normalized.cooldownReduction) parts.push(`-${normalized.cooldownReduction} cooldown`);
      if (normalized.audience) parts.push(`+${normalized.audience} Audience`);
      return parts.join(" · ") || normalized.description || "Usable supply item.";
    }
    return originalItemDescription ? originalItemDescription(item) : "";
  };

  const originalAddItem = window.addItem || (typeof addItem === "function" ? addItem : null);
  window.addItem = addItem = function addItemBackbone(item, amount = 1) {
    normalizeInventory();
    if (typeof item === "string") item = createSupply(item, amount);
    item = normalizeSupply(item);
    if (!item) return null;

    if (!isStackable(item)) {
      if (originalAddItem) return originalAddItem(item);
      player.inventory.push(item);
      if (typeof updateInventoryUI === "function") updateInventoryUI();
      if (typeof updateHUD === "function") updateHUD();
      return item;
    }

    let remaining = qty(amount || item.quantity || 1);
    for (const existing of player.inventory) {
      if (baseId(existing) !== baseId(item) || !isStackable(existing)) continue;
      const max = qty(existing.maxStack || item.maxStack || 1);
      const room = max - qty(existing.quantity || 1);
      if (room <= 0) continue;
      const moved = Math.min(room, remaining);
      existing.quantity = qty(existing.quantity || 1) + moved;
      remaining -= moved;
      if (remaining <= 0) break;
    }
    while (remaining > 0) {
      const stackQty = Math.min(qty(item.maxStack || 1), remaining);
      player.inventory.push({ ...item, id: makeBackboneId(item.itemId || "item"), quantity: stackQty });
      remaining -= stackQty;
    }
    if (typeof achievement === "function") achievement("NEW ITEM", `You found ${item.name}. ${itemDescription(item)}`, `item_${item.itemId}_${Date.now()}`);
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
    return item;
  };
  window.addItemToInventory = function addItemToInventory(itemId, amount = 1) { return addItem(itemId, amount); };

  window.removeItemFromInventory = function removeItemFromInventory(index, amount = 1) {
    normalizeInventory();
    const item = player.inventory[index];
    if (!item) return null;
    const removeQty = qty(amount);
    if (isStackable(item) && qty(item.quantity) > removeQty) {
      item.quantity = qty(item.quantity) - removeQty;
      if (typeof updateInventoryUI === "function") updateInventoryUI();
      if (typeof updateHUD === "function") updateHUD();
      return item;
    }
    const removed = player.inventory.splice(index, 1)[0] || null;
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
    return removed;
  };

  window.equipItemFromInventory = function equipItemFromInventory(index) {
    normalizeInventory();
    const item = player.inventory[index];
    if (item && typeof equipItem === "function") equipItem(item.id);
  };

  window.useInventoryItem = function useInventoryItem(id) {
    normalizeInventory();
    const index = player.inventory.findIndex(item => item.id === id);
    if (index < 0) return false;
    const item = normalizeSupply(player.inventory[index]);
    if (!isSupply(item)) return false;

    let used = false;
    if (item.heal && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + item.heal);
      used = true;
    }
    if (item.cooldownReduction) {
      player.attackCooldown = Math.max(0, (player.attackCooldown || 0) - item.cooldownReduction);
      player.dodgeCooldown = Math.max(0, (player.dodgeCooldown || 0) - item.cooldownReduction);
      if (typeof updateDodgeButtonCooldown === "function") updateDodgeButtonCooldown();
      used = true;
    }
    if (item.audience) {
      if (typeof changeAudience === "function") changeAudience(item.audience);
      else audienceScore = Math.max(0, Math.min(100, (audienceScore || 0) + item.audience));
      used = true;
    }
    if (!used) {
      if (typeof announcer === "function") announcer(`${item.name} would be wasted right now.`);
      return false;
    }

    if (qty(player.inventory[index].quantity) > 1) player.inventory[index].quantity = qty(player.inventory[index].quantity) - 1;
    else player.inventory.splice(index, 1);
    if (typeof achievement === "function") achievement("ITEM USED", `You used ${item.name}. ${itemDescription(item)}`, `use_${item.itemId}_${Date.now()}`);
    if (typeof addPlayerFeedbackText === "function" && item.heal) addPlayerFeedbackText(`+${item.heal} HP`, { color: "#7cff9b", size: 15, offsetY: -42 });
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
    return true;
  };
  window.useInventoryItemByIndex = function useInventoryItemByIndex(index) {
    normalizeInventory();
    const item = player.inventory[index];
    return item ? window.useInventoryItem(item.id) : false;
  };

  const originalOpenLootBox = window.openLootBox || (typeof openLootBox === "function" ? openLootBox : null);
  if (originalOpenLootBox && !originalOpenLootBox.__inventoryBackboneWrapped) {
    window.openLootBox = openLootBox = function openLootBoxWithSupplies(id) {
      if (Math.random() >= 0.28) return originalOpenLootBox(id);
      normalizeInventory();
      const index = player.inventory.findIndex(item => item.id === id);
      if (index < 0 || player.inventory[index].type !== "lootbox") return originalOpenLootBox(id);
      if (!player.safe) {
        if (typeof announcer === "function") announcer("Loot boxes may only be opened in safe rooms.");
        return;
      }
      const box = player.inventory.splice(index, 1)[0];
      if (typeof stats === "object") stats.lootBoxesOpened++;
      const coins = 8 + Math.floor(Math.random() * 16) + (typeof rarityPower === "function" ? rarityPower(box.rarity) * 6 : 6);
      player.coins += coins;
      const supply = randomSupply(box.rarity === "Rare" || box.rarity === "Epic");
      addItem(supply);
      if (typeof achievement === "function") achievement("LOOT BOX OPENED", `You opened ${box.name} and received ${coins} coins and ${supply.name}.`, `open_${box.id}`);
      if (typeof updateInventoryUI === "function") updateInventoryUI();
      if (typeof updateHUD === "function") updateHUD();
    };
    window.openLootBox.__inventoryBackboneWrapped = true;
  }

  const originalRewardChestLoot = window.rewardChestLoot || (typeof rewardChestLoot === "function" ? rewardChestLoot : null);
  if (originalRewardChestLoot && !originalRewardChestLoot.__inventoryBackboneWrapped) {
    window.rewardChestLoot = rewardChestLoot = function rewardChestLootWithSupplies(room = null) {
      if (room?.themeId === "supplyCloset" || Math.random() < 0.16) {
        addItem(randomSupply(room?.themeId === "supplyCloset" && Math.random() < 0.25), room?.themeId === "supplyCloset" ? 1 + Math.floor(Math.random() * 2) : 1);
        if (typeof updateInventoryUI === "function") updateInventoryUI();
        if (typeof updateHUD === "function") updateHUD();
        return;
      }
      return originalRewardChestLoot(room);
    };
    window.rewardChestLoot.__inventoryBackboneWrapped = true;
  }

  const originalEquipmentSlotKeys = window.equipmentSlotKeys || (typeof equipmentSlotKeys === "function" ? equipmentSlotKeys : null);
  window.equipmentSlotKeys = equipmentSlotKeys = function equipmentSlotKeysBackbone() {
    ensureBackboneEquipmentSlots();
    if (originalEquipmentSlotKeys) {
      const keys = originalEquipmentSlotKeys();
      return keys.includes("offhand") ? keys : ["weapon", "offhand", ...keys.filter(key => key !== "weapon")];
    }
    return ["weapon", "offhand", "head", "chest", "legs", "feet", "accessory", "light", "pet"];
  };

  const originalSlotIcon = window.slotIcon || (typeof slotIcon === "function" ? slotIcon : null);
  window.slotIcon = slotIcon = function slotIconBackbone(item) {
    const normalized = normalizeSupply(item) || item;
    if (normalized?.icon) return normalized.icon;
    if (normalized?.slot === "offhand") return "[]";
    return originalSlotIcon ? originalSlotIcon(item) : "?";
  };

  const originalRenderInventorySlot = window.renderInventorySlot || (typeof renderInventorySlot === "function" ? renderInventorySlot : null);
  if (originalRenderInventorySlot) {
    window.renderInventorySlot = renderInventorySlot = function renderInventorySlotBackbone(item, index) {
      const normalized = normalizeSupply(item);
      const html = originalRenderInventorySlot(normalized, index);
      if (!normalized || !isStackable(normalized) || qty(normalized.quantity) <= 1) return html;
      return html.replace("</button>", `<span class="lootQty">x${qty(normalized.quantity)}</span></button>`);
    };
  }

  const originalRenderItemDetails = window.renderItemDetails || (typeof renderItemDetails === "function" ? renderItemDetails : null);
  if (originalRenderItemDetails) {
    window.renderItemDetails = renderItemDetails = function renderItemDetailsBackbone() {
      const html = originalRenderItemDetails();
      if (!html || typeof selectedInventoryItem !== "function") return html;
      const item = normalizeSupply(selectedInventoryItem());
      if (!isSupply(item)) return html;
      return html.replace("No equipped comparison", item.description || "Usable supply item.");
    };
  }

  function installUseCapture() {
    const panel = document.getElementById("inventoryPanel");
    if (!panel || panel.dataset.backboneUseCapture === "true") return;
    panel.dataset.backboneUseCapture = "true";
    panel.addEventListener("click", event => {
      const button = event.target.closest?.('button[data-action="use"][data-item-id]');
      if (!button) return;
      const item = player.inventory?.find(candidate => candidate.id === button.dataset.itemId);
      if (!isSupply(normalizeSupply(item))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.useInventoryItem(button.dataset.itemId);
    }, true);
  }

  const originalUpdateInventoryUI = window.updateInventoryUI || (typeof updateInventoryUI === "function" ? updateInventoryUI : null);
  if (originalUpdateInventoryUI && !originalUpdateInventoryUI.__inventoryBackboneWrapped) {
    window.updateInventoryUI = updateInventoryUI = function updateInventoryUIBackbone(...args) {
      normalizeInventory();
      ensureBackboneEquipmentSlots();
      const result = originalUpdateInventoryUI.apply(this, args);
      installUseCapture();
      return result;
    };
    window.updateInventoryUI.__inventoryBackboneWrapped = true;
  }

  for (const fnName of ["resetRunProgress", "resetState"]) {
    const original = window[fnName];
    if (typeof original !== "function" || original.__inventoryBackboneWrapped) continue;
    window[fnName] = function inventoryBackboneResetWrapper(...args) {
      const result = original.apply(this, args);
      ensureBackboneEquipmentSlots();
      return result;
    };
    window[fnName].__inventoryBackboneWrapped = true;
  }

  const style = document.createElement("style");
  style.id = "inventoryBackboneStyles";
  style.textContent = `.lootSlot{position:relative}.lootQty{position:absolute;right:5px;top:4px;min-width:18px;padding:1px 4px;border-radius:999px;background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.3);font-size:9px;font-weight:900;color:#fff}.itemTypeConsumable{background:radial-gradient(circle at 50% 0%, rgba(124,255,155,.18), rgba(0,0,0,.26) 68%)}`;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  normalizeInventory();
  ensureBackboneEquipmentSlots();
})();
