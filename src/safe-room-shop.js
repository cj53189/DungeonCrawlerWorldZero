// Safe Room Shop, junk selling, consumables, and pet down/revive rules.
(function installSafeRoomShopAndPetCare() {
  if (window.__dcwSafeRoomShopInstalled) return;
  window.__dcwSafeRoomShopInstalled = true;

  const STYLE_ID = "safeRoomShopStyles";
  const SHOP_ITEMS = Object.freeze({
    health_potion: { id: "health_potion", name: "Health Potion", type: "consumable", consumableType: "health", rarity: "Common", cost: 18, heal: 45, icon: "♥", description: "Restores crawler HP. If your pet is down, revives the pet instead." },
    mana_potion: { id: "mana_potion", name: "Mana Potion", type: "consumable", consumableType: "mana", rarity: "Common", cost: 14, mana: 35, icon: "✦", description: "Restores mana for upcoming magic/class systems. Safe to stockpile now." },
    torch: { id: "torch", name: "Crawler Torch", cost: 10, icon: "☼", description: "A spare light source for bad rooms and worse decisions." }
  });

  function rarityValue(rarity) {
    if (typeof rarityPower === "function") return rarityPower(rarity);
    return { Common: 1, Uncommon: 2, Rare: 3, Epic: 4 }[rarity] || 1;
  }

  function makeConsumable(kind) {
    const base = SHOP_ITEMS[kind] || SHOP_ITEMS.health_potion;
    return {
      id: typeof makeId === "function" ? makeId(kind) : `${kind}_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
      type: "consumable",
      consumableType: base.consumableType,
      rarity: base.rarity,
      name: base.name,
      heal: base.heal || 0,
      mana: base.mana || 0,
      icon: base.icon,
      cost: base.cost,
      description: base.description
    };
  }

  function ensureManaStats() {
    if (!Number.isFinite(player.maxMana)) player.maxMana = 60;
    if (!Number.isFinite(player.mana)) player.mana = player.maxMana;
  }

  function itemSellValue(item) {
    if (!item) return 0;
    if (item.type === "consumable") return Math.max(2, Math.floor((item.cost || SHOP_ITEMS[item.consumableType === "mana" ? "mana_potion" : "health_potion"].cost) * 0.5));
    if (item.type === "lootbox") return 8 + rarityValue(item.rarity) * 5;
    if (item.type === "weapon") return 9 + rarityValue(item.rarity) * 7 + Math.floor((item.damage || 0) / 5);
    if (item.type === "light") return 5;
    if (item.type === "gear") return 6 + rarityValue(item.rarity) * 6 + Math.max(0, item.hp || 0, item.attack || 0, item.defense || 0, Math.round((item.speed || 0) * 25), item.audience || 0);
    return 3 + rarityValue(item.rarity) * 2;
  }

  function isSellableCarriedItem(item) {
    return !!item && item.slot !== "pet" && !PET_DEFINITIONS?.[item.type];
  }

  function carriedSellables() {
    return (player.inventory || []).filter(isSellableCarriedItem);
  }

  function junkItems() {
    return carriedSellables().filter(item => !!item.junk);
  }

  function addShopItem(item) {
    player.inventory.push(item);
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
  }

  function buyShopItem(kind) {
    const base = SHOP_ITEMS[kind];
    if (!base) return false;
    if ((player.coins || 0) < base.cost) {
      announcer?.(`Not enough coins for ${base.name}. The shopkeeper refuses exposure as payment.`);
      return false;
    }
    player.coins -= base.cost;
    if (kind === "torch" && typeof generateTorchItem === "function") addShopItem(generateTorchItem());
    else addShopItem(makeConsumable(kind));
    announcer?.(`Purchased ${base.name} for ${base.cost} coins.`);
    renderSafeRoomShopPanel();
    return true;
  }

  function shopPetCost(def) {
    const base = Number(def?.cost) || 0;
    if (base > 0) return base;
    if (def?.id === "small_dog") return 24;
    if (def?.id === "small_velociraptor") return 32;
    return 28;
  }

  function hireShopPet(type) {
    const def = PET_DEFINITIONS?.[type];
    if (!def || typeof createPet !== "function") return false;
    const cost = shopPetCost(def);
    if ((player.coins || 0) < cost) {
      announcer?.(`Not enough coins for ${def.displayName}. The companion has standards.`);
      return false;
    }
    player.coins -= cost;
    const pet = createPet(type, player.x, player.y + 18);
    pet.status = "active";
    pet.down = false;
    if (typeof setActivePet === "function") setActivePet(pet);
    else { player.pet = pet; player.equipment.pet = pet; }
    if (player.equipment) player.equipment.pet = pet;
    announcer?.(`${pet.displayName || pet.name} joins the run. The waiver was ignored.`);
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
    renderSafeRoomShopPanel();
    return true;
  }

  function sellCarriedItem(itemId) {
    const idx = (player.inventory || []).findIndex(item => item.id === itemId);
    if (idx < 0) return false;
    const item = player.inventory[idx];
    if (!isSellableCarriedItem(item)) return false;
    const value = itemSellValue(item);
    player.inventory.splice(idx, 1);
    player.coins = (player.coins || 0) + value;
    selectedInventoryItemId = selectedInventoryItemId === itemId ? null : selectedInventoryItemId;
    announcer?.(`Sold ${item.name} for ${value} coins.`);
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
    renderSafeRoomShopPanel();
    return true;
  }

  function toggleJunkItem(itemId) {
    const item = (player.inventory || []).find(entry => entry.id === itemId);
    if (!item || !isSellableCarriedItem(item)) return false;
    item.junk = !item.junk;
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    renderSafeRoomShopPanel();
    return true;
  }

  function sellAllJunk() {
    const junk = junkItems();
    if (!junk.length) {
      announcer?.("No junk marked. The shopkeeper stares at your organizational choices.");
      return 0;
    }
    let total = 0;
    const junkIds = new Set(junk.map(item => item.id));
    player.inventory = (player.inventory || []).filter(item => {
      if (!junkIds.has(item.id)) return true;
      total += itemSellValue(item);
      return false;
    });
    selectedInventoryItemId = selectedInventoryItemId && junkIds.has(selectedInventoryItemId) ? null : selectedInventoryItemId;
    player.coins = (player.coins || 0) + total;
    announcer?.(`Sold ${junk.length} junk item${junk.length === 1 ? "" : "s"} for ${total} coins.`);
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
    renderSafeRoomShopPanel();
    return total;
  }

  function revivePet(pet, source = "revived") {
    if (!pet) return false;
    pet.maxHp = Math.max(1, Number(pet.maxHp) || (typeof petLevelHp === "function" ? petLevelHp(pet) : 50));
    pet.hp = Math.max(1, Math.ceil(pet.maxHp * (source === "safe_room" ? 0.65 : 0.5)));
    pet.status = "active";
    pet.down = false;
    pet.targetEnemyId = null;
    pet.attackCooldown = Math.max(pet.attackCooldown || 0, 35);
    return true;
  }

  function downPet(pet, enemy = null) {
    if (!pet || pet.down) return false;
    pet.hp = 0;
    pet.down = true;
    pet.status = "downed";
    pet.targetEnemyId = null;
    pet.attackCooldown = 90;
    addFloatingFeedbackText?.("DOWN", pet.x, pet.y - 24, { anchor: pet, color: "#ff8a8a", size: 14 });
    announcer?.(`${pet.displayName || pet.name || "Your pet"} is down. Use a health potion or reach a safe room to revive them.`);
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
    return true;
  }

  function healPetWithPotion(pet, potion) {
    if (!pet) return false;
    if ((pet.hp || 0) <= 0 || pet.down || pet.status === "downed") {
      revivePet(pet, "potion");
      announcer?.(`${pet.displayName || pet.name || "Your pet"} is back up. The health potion has been unionized.`);
      return true;
    }
    const heal = Math.max(1, potion.heal || 45);
    pet.hp = Math.min(pet.maxHp, (pet.hp || 0) + heal);
    announcer?.(`${pet.displayName || pet.name || "Your pet"} healed for ${heal} HP.`);
    return true;
  }

  function useConsumable(itemId, target = "auto") {
    const idx = (player.inventory || []).findIndex(item => item.id === itemId);
    if (idx < 0) return false;
    const item = player.inventory[idx];
    if (item.type !== "consumable") return false;
    ensureManaStats();
    const pet = typeof getActivePet === "function" ? getActivePet() : player.pet;
    let used = false;
    if (item.consumableType === "health") {
      if (target === "pet" || ((pet?.hp || 0) <= 0 || pet?.down || pet?.status === "downed")) used = healPetWithPotion(pet, item);
      else {
        const heal = Math.max(1, item.heal || 45);
        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        used = player.hp > before;
        if (used) announcer?.(`Health potion restored ${Math.ceil(player.hp - before)} HP.`);
        else if (pet) used = healPetWithPotion(pet, item);
      }
    } else if (item.consumableType === "mana") {
      const before = player.mana;
      player.mana = Math.min(player.maxMana, player.mana + Math.max(1, item.mana || 35));
      used = player.mana > before;
      announcer?.(used ? `Mana potion restored ${Math.ceil(player.mana - before)} mana.` : "Mana is already full. The bottle remains smugly corked.");
    }
    if (!used) return false;
    player.inventory.splice(idx, 1);
    selectedInventoryItemId = selectedInventoryItemId === itemId ? null : selectedInventoryItemId;
    if (typeof updateInventoryUI === "function") updateInventoryUI();
    if (typeof updateHUD === "function") updateHUD();
    renderSafeRoomShopPanel();
    return true;
  }

  function petStatusLine() {
    const pet = typeof getActivePet === "function" ? getActivePet() : player.pet;
    if (!pet) return "No active pet.";
    const hp = Math.max(0, Math.ceil(pet.hp || 0));
    const down = hp <= 0 || pet.down || pet.status === "downed";
    return `${pet.displayName || pet.name} · ${down ? "DOWN" : `${hp}/${pet.maxHp} HP`} · Lv ${pet.level || 1}`;
  }

  function shopItemButton(kind) {
    const item = SHOP_ITEMS[kind];
    return `<button class="shopCard" type="button" data-shop-buy="${item.id}"><span class="shopIcon">${item.icon}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small><em>${item.cost} coins</em></button>`;
  }

  function petShopButton(type) {
    const def = PET_DEFINITIONS?.[type];
    if (!def) return "";
    const current = (typeof getActivePet === "function" ? getActivePet() : player.pet)?.type === type;
    const cost = shopPetCost(def);
    return `<button class="shopCard ${current ? "owned" : ""}" type="button" data-shop-pet="${escapeHtml(type)}"><span class="shopIcon">🐾</span><strong>${escapeHtml(def.displayName || def.name || type)}</strong><small>${escapeHtml(def.role || def.description || "Run companion")}</small><em>${current ? "Active" : `${cost} coins`}</em></button>`;
  }

  function sellItemRow(item) {
    const value = itemSellValue(item);
    return `<div class="shopSellRow ${item.junk ? "junk" : ""}"><div><strong>${item.junk ? "★ " : ""}${escapeHtml(item.name)}</strong><small>${escapeHtml(itemDescription(item) || item.rarity || "Inventory item")}</small></div><div class="shopSellActions"><span>${value}¢</span><button type="button" data-shop-junk="${escapeHtml(item.id)}">${item.junk ? "Unmark" : "Junk"}</button><button type="button" data-shop-sell="${escapeHtml(item.id)}">Sell</button></div></div>`;
  }

  function renderSafeRoomShopPanel() {
    const panel = document.getElementById("petMerchantPanel");
    const box = document.getElementById("petMerchantOptions");
    const title = document.getElementById("petMerchantTitle");
    if (!panel || !box) return;
    if (title) title.textContent = "Safe Room Shop";
    const sellables = carriedSellables();
    const junk = junkItems();
    box.innerHTML = `
      <div class="shopHeader"><strong>Coins: ${player.coins || 0}</strong><span>${escapeHtml(petStatusLine())}</span></div>
      <section class="shopSection"><h4>Buy Supplies</h4><div class="shopGrid">${shopItemButton("health_potion")}${shopItemButton("mana_potion")}${shopItemButton("torch")}</div></section>
      <section class="shopSection"><h4>Run Companions</h4><div class="shopGrid petGrid">${(petMerchant?.options || PET_MERCHANT_OPTIONS || []).map(petShopButton).join("")}</div></section>
      <section class="shopSection"><h4>Sell Carried Items</h4><div class="shopSellSummary"><span>${sellables.length} carried · ${junk.length} junk marked</span><button type="button" data-shop-sell-junk>Sell All Junk</button></div><div class="shopSellList">${sellables.length ? sellables.map(sellItemRow).join("") : `<div class="shopEmpty">Nothing carried to sell.</div>`}</div></section>
    `;
  }

  function openSafeRoomShopPanel() {
    if (!player.safe && !petMerchantInReach()) {
      announcer?.("The shop only does business in safe rooms. Capitalism fears teeth.");
      return false;
    }
    const panel = document.getElementById("petMerchantPanel");
    if (!panel) return false;
    renderSafeRoomShopPanel();
    panel.style.display = "block";
    panel.classList.add("open", "safeRoomShopPanel");
    if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
    return true;
  }

  function hidePetMerchantPanelSafeRoomShop() {
    const panel = document.getElementById("petMerchantPanel");
    if (!panel) return;
    panel.style.display = "none";
    panel.classList.remove("open");
    if (document.activeElement && panel.contains(document.activeElement)) document.activeElement.blur();
  }

  function petMerchantInReachSafeRoomShop() {
    if (petMerchant && Math.hypot(player.x - petMerchant.x, player.y - petMerchant.y) < player.r + petMerchant.r + 44) return true;
    return !!player.safe;
  }

  function bindShopPanel() {
    const panel = document.getElementById("petMerchantPanel");
    if (!panel || panel.dataset.safeShopBound === "true") return;
    panel.dataset.safeShopBound = "true";
    document.getElementById("closePetMerchantBtn")?.addEventListener("click", hidePetMerchantPanelSafeRoomShop);
    panel.addEventListener("click", event => {
      const buy = event.target.closest("button[data-shop-buy]");
      if (buy) { buyShopItem(buy.dataset.shopBuy); return; }
      const pet = event.target.closest("button[data-shop-pet]");
      if (pet) { hireShopPet(pet.dataset.shopPet); return; }
      const junk = event.target.closest("button[data-shop-junk]");
      if (junk) { toggleJunkItem(junk.dataset.shopJunk); return; }
      const sell = event.target.closest("button[data-shop-sell]");
      if (sell) { sellCarriedItem(sell.dataset.shopSell); return; }
      if (event.target.closest("button[data-shop-sell-junk]")) { sellAllJunk(); return; }
    });
  }

  function bindInventoryJunkActions() {
    const panel = document.getElementById("inventoryPanel");
    if (!panel || panel.dataset.safeShopInventoryBound === "true") return;
    panel.dataset.safeShopInventoryBound = "true";
    panel.addEventListener("click", event => {
      const action = event.target.closest("button[data-shop-action]");
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      const id = action.dataset.itemId;
      if (action.dataset.shopAction === "junk") toggleJunkItem(id);
      if (action.dataset.shopAction === "sell") sellCarriedItem(id);
      if (action.dataset.shopAction === "consume") useConsumable(id, action.dataset.target || "auto");
    });
  }

  function decorateInventoryDetails() {
    const item = typeof selectedInventoryItem === "function" ? selectedInventoryItem() : null;
    const actions = document.querySelector("#inventoryPanel .itemDetails .itemActions");
    if (!item || !actions || actions.dataset.safeShopDecorated === item.id) return;
    actions.dataset.safeShopDecorated = item.id;
    if (item.type === "consumable") {
      actions.insertAdjacentHTML("afterbegin", `<button class="itemBtn primary" type="button" data-shop-action="consume" data-item-id="${escapeHtml(item.id)}">Use</button>`);
      if (item.consumableType === "health" && (typeof getActivePet === "function" ? getActivePet() : player.pet)) {
        actions.insertAdjacentHTML("beforeend", `<button class="itemBtn" type="button" data-shop-action="consume" data-target="pet" data-item-id="${escapeHtml(item.id)}">Use on Pet</button>`);
      }
    }
    if (isSellableCarriedItem(item)) {
      actions.insertAdjacentHTML("beforeend", `<button class="itemBtn" type="button" data-shop-action="junk" data-item-id="${escapeHtml(item.id)}">${item.junk ? "Unmark Junk" : "Mark Junk"}</button>`);
      if (player.safe) actions.insertAdjacentHTML("beforeend", `<button class="itemBtn" type="button" data-shop-action="sell" data-item-id="${escapeHtml(item.id)}">Sell ${itemSellValue(item)}¢</button>`);
    }
  }

  function patchInventoryRendering() {
    if (typeof inventoryCategoryFor === "function" && !inventoryCategoryFor.__safeRoomShopWrapped) {
      const original = inventoryCategoryFor;
      inventoryCategoryFor = function inventoryCategoryWithConsumables(item) {
        if (item?.type === "consumable") return "items";
        return original(item);
      };
      inventoryCategoryFor.__safeRoomShopWrapped = true;
    }
    if (typeof itemDescription === "function" && !itemDescription.__safeRoomShopWrapped) {
      const original = itemDescription;
      itemDescription = function safeRoomShopItemDescription(item) {
        if (item?.type === "consumable") return item.description || (item.consumableType === "mana" ? "Restores mana." : "Restores HP.");
        const text = original(item);
        return item?.junk ? `${text} · Marked junk` : text;
      };
      itemDescription.__safeRoomShopWrapped = true;
    }
    if (typeof slotIcon === "function" && !slotIcon.__safeRoomShopWrapped) {
      const original = slotIcon;
      slotIcon = function safeRoomShopSlotIcon(item) {
        if (item?.type === "consumable") return item.icon || (item.consumableType === "mana" ? "✦" : "♥");
        return original(item);
      };
      slotIcon.__safeRoomShopWrapped = true;
    }
    if (typeof updateInventoryUI === "function" && !updateInventoryUI.__safeRoomShopWrapped) {
      const original = updateInventoryUI;
      updateInventoryUI = function updateInventoryWithJunkActions(...args) {
        const result = original.apply(this, args);
        setTimeout(decorateInventoryDetails, 0);
        return result;
      };
      updateInventoryUI.__safeRoomShopWrapped = true;
    }
  }

  function patchInteraction() {
    if (typeof petMerchantInReach !== "function" || !petMerchantInReach.__safeRoomShopWrapped) {
      window.petMerchantInReach = petMerchantInReachSafeRoomShop;
      try { petMerchantInReach = petMerchantInReachSafeRoomShop; } catch {}
      petMerchantInReach.__safeRoomShopWrapped = true;
    }
    if (typeof hidePetMerchantPanel !== "function" || !hidePetMerchantPanel.__safeRoomShopWrapped) {
      window.hidePetMerchantPanel = hidePetMerchantPanelSafeRoomShop;
      try { hidePetMerchantPanel = hidePetMerchantPanelSafeRoomShop; } catch {}
      hidePetMerchantPanel.__safeRoomShopWrapped = true;
    }
    window.openSafeRoomShopPanel = openSafeRoomShopPanel;
    window.renderSafeRoomShopPanel = renderSafeRoomShopPanel;
    if (typeof interact === "function" && !interact.__safeRoomShopWrapped) {
      const original = interact;
      interact = function interactWithSafeRoomShop(...args) {
        if (petMerchantInReachSafeRoomShop()) return openSafeRoomShopPanel();
        return original.apply(this, args);
      };
      interact.__safeRoomShopWrapped = true;
    }
  }

  function patchPetBattleRules() {
    if (typeof getActiveCrawlers === "function" && !getActiveCrawlers.__safeRoomShopPetsWrapped) {
      const original = getActiveCrawlers;
      getActiveCrawlers = function getActiveCrawlersWithPets(options = {}) {
        const crawlers = original(options) || [];
        const pet = typeof getActivePet === "function" ? getActivePet() : player.pet;
        if (pet && !player.safe && (pet.hp || 0) > 0 && !pet.down && pet.status !== "downed") crawlers.push(pet);
        return crawlers;
      };
      getActiveCrawlers.__safeRoomShopPetsWrapped = true;
    }
    if (typeof damageCrawlerFromEnemy === "function" && !damageCrawlerFromEnemy.__safeRoomShopPetsWrapped) {
      const original = damageCrawlerFromEnemy;
      damageCrawlerFromEnemy = function damageCrawlerOrPetFromEnemy(crawler, enemy) {
        const pet = typeof getActivePet === "function" ? getActivePet() : player.pet;
        if (pet && crawler === pet) {
          if (!enemy || enemy.damageCooldown > 0 || pet.down || pet.status === "downed") return false;
          const rawDmg = enemy.damage || 8;
          const guard = Math.floor((pet.skills?.guard || 0) * 0.8);
          const dmg = Math.max(1, rawDmg - guard);
          pet.hp = Math.max(0, (pet.hp || pet.maxHp || 1) - dmg);
          addFloatingFeedbackText?.(`-${dmg}`, pet.x, pet.y - pet.r, { anchor: pet, color: "#ff9b9b", size: 13 });
          applyKnockback?.(pet, enemy.x, enemy.y, 5 + Math.min(4, dmg * 0.2));
          enemy.damageCooldown = 70;
          if (pet.hp <= 0) downPet(pet, enemy);
          if (typeof updateInventoryUI === "function") updateInventoryUI();
          if (typeof updateHUD === "function") updateHUD();
          return true;
        }
        return original(crawler, enemy);
      };
      damageCrawlerFromEnemy.__safeRoomShopPetsWrapped = true;
    }
    if (typeof updatePlayer === "function" && !updatePlayer.__safeRoomShopPetsWrapped) {
      const original = updatePlayer;
      updatePlayer = function updatePlayerWithPetSafeRoomRevive(...args) {
        const wasSafeBefore = !!player.safe;
        const result = original.apply(this, args);
        const pet = typeof getActivePet === "function" ? getActivePet() : player.pet;
        if (pet && player.safe && !wasSafeBefore && ((pet.hp || 0) <= 0 || pet.down || pet.status === "downed")) {
          revivePet(pet, "safe_room");
          announcer?.(`${pet.displayName || pet.name || "Your pet"} recovers in the safe room.`);
          if (typeof updateInventoryUI === "function") updateInventoryUI();
          if (typeof updateHUD === "function") updateHUD();
        }
        return result;
      };
      updatePlayer.__safeRoomShopPetsWrapped = true;
    }
    window.reviveActivePet = () => revivePet(typeof getActivePet === "function" ? getActivePet() : player.pet, "manual");
  }

  function patchPetRendering() {
    if (typeof drawActivePet === "function" && !drawActivePet.__safeRoomShopPetsWrapped) {
      const original = drawActivePet;
      drawActivePet = function drawActivePetWithHealthBar(...args) {
        const result = original.apply(this, args);
        const pet = typeof getActivePet === "function" ? getActivePet() : player.pet;
        if (!pet) return result;
        const tx = Math.floor(pet.x / TILE), ty = Math.floor(pet.y / TILE);
        if (!visible?.[ty]?.[tx]) return result;
        const pct = Math.max(0, Math.min(1, (pet.hp || 0) / Math.max(1, pet.maxHp || 1)));
        const down = pct <= 0 || pet.down || pet.status === "downed";
        const w = 34, h = 5, x = pet.x - w / 2, y = pet.y - 40;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.72)";
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = down ? "#5f5f5f" : "#2b2118";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = down ? "#ff6b6b" : (pct < 0.35 ? "#ff8a4a" : "#7ee06d");
        ctx.fillRect(x, y, Math.max(0, w * pct), h);
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
        if (down) {
          ctx.font = "bold 9px Arial";
          ctx.textAlign = "center";
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          ctx.fillStyle = "#ffd8d8";
          ctx.strokeText("DOWN", pet.x, y - 3);
          ctx.fillText("DOWN", pet.x, y - 3);
        }
        ctx.restore();
        return result;
      };
      drawActivePet.__safeRoomShopPetsWrapped = true;
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #petMerchantPanel.safeRoomShopPanel { width: min(760px, calc(100vw - 32px)); max-height: min(78vh, 640px); overflow: hidden; }
      #petMerchantOptions { display: grid; gap: 12px; max-height: min(58vh, 480px); overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; padding-right: 4px; }
      .shopHeader { display:flex; justify-content:space-between; gap:10px; align-items:center; padding:8px 10px; border:1px solid rgba(255,216,107,0.16); border-radius:12px; background:rgba(0,0,0,0.26); color:#f6d07a; }
      .shopHeader span { color:#d8cdb7; font-size:12px; text-align:right; }
      .shopSection { border:1px solid rgba(255,216,107,0.15); border-radius:13px; padding:10px; background:rgba(0,0,0,0.18); }
      .shopSection h4 { margin:0 0 8px; color:#ffd86b; text-transform:uppercase; letter-spacing:.11em; font-size:12px; }
      .shopGrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; }
      .shopCard { min-height:112px; border:1px solid rgba(255,255,255,.16); border-radius:12px; background:rgba(255,255,255,.07); color:#eee; padding:9px; text-align:left; display:grid; gap:4px; cursor:pointer; }
      .shopCard.owned { outline:2px solid rgba(124,247,255,.6); }
      .shopCard strong,.shopCard small,.shopCard em { display:block; }
      .shopIcon { font-size:22px; }
      .shopCard small { color:#cfc1aa; line-height:1.25; }
      .shopCard em { color:#ffd86b; font-style:normal; font-weight:900; }
      .shopSellSummary { display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:8px; color:#cfc1aa; }
      .shopSellSummary button,.shopSellActions button { border:1px solid rgba(255,216,107,.25); border-radius:999px; background:rgba(255,255,255,.08); color:#fff; padding:6px 9px; font-weight:900; cursor:pointer; }
      .shopSellList { display:grid; gap:7px; }
      .shopSellRow { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; border:1px solid rgba(255,255,255,.13); border-radius:11px; padding:8px; background:rgba(0,0,0,.22); }
      .shopSellRow.junk { border-color:rgba(255,216,107,.55); background:rgba(120,84,22,.22); }
      .shopSellRow strong,.shopSellRow small { display:block; }
      .shopSellRow small { color:#bfb39e; line-height:1.25; }
      .shopSellActions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
      .shopSellActions span { color:#ffd86b; font-weight:900; }
      .shopEmpty { color:#9f927f; font-style:italic; padding:10px; }
      @media (hover:none) and (pointer:coarse), (max-width:900px) {
        #petMerchantPanel.safeRoomShopPanel { display:block !important; position:fixed !important; inset:var(--dcw-safe-top, max(10px, env(safe-area-inset-top))) var(--dcw-safe-right, max(10px, env(safe-area-inset-right))) var(--dcw-safe-bottom, max(10px, env(safe-area-inset-bottom))) var(--dcw-safe-left, max(10px, env(safe-area-inset-left))) !important; width:auto !important; height:auto !important; max-width:none !important; max-height:none !important; overflow-y:auto !important; padding:calc(var(--dcw-touch-preferred, 56px) + 8px) 14px 16px !important; touch-action:pan-y !important; -webkit-overflow-scrolling:touch !important; }
        #petMerchantPanel.safeRoomShopPanel .panelClose { position:fixed !important; top:var(--dcw-safe-top, max(10px, env(safe-area-inset-top))) !important; right:var(--dcw-safe-right, max(10px, env(safe-area-inset-right))) !important; z-index:360 !important; }
        #petMerchantOptions { max-height:none !important; overflow:visible !important; }
        .shopHeader,.shopSellRow { grid-template-columns:1fr; align-items:start; }
        .shopHeader { display:grid; }
        .shopHeader span { text-align:left; }
        .shopGrid,.petGrid { grid-template-columns:1fr !important; }
        .shopCard { min-height:92px; }
        .shopSellSummary { display:grid; grid-template-columns:1fr; }
        .shopSellSummary button,.shopSellActions button,.shopCard { min-height:48px; }
      }
      @media (orientation:landscape) and (max-height:520px) { .shopGrid,.petGrid { grid-template-columns:repeat(3,minmax(0,1fr)); } .shopCard { min-height:86px; } }
    `;
    document.head.appendChild(style);
  }

  function install() {
    ensureManaStats();
    injectStyles();
    bindShopPanel();
    bindInventoryJunkActions();
    patchInventoryRendering();
    patchInteraction();
    patchPetBattleRules();
    patchPetRendering();
    if (typeof updateInventoryUI === "function") updateInventoryUI();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
