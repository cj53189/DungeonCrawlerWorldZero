// Restores Safe Room Shop content and keeps buy/sell actions self-contained.
// This is a defensive overlay for the shop UI so one bad inventory row or older
// pet merchant behavior cannot blank the whole shop.
(function installSafeRoomShopRenderFix() {
  if (window.__dcwSafeRoomShopRenderFixInstalled) return;
  window.__dcwSafeRoomShopRenderFixInstalled = true;

  const SHOP_ITEMS = Object.freeze({
    health_potion: { id: "health_potion", name: "Health Potion", type: "consumable", consumableType: "health", rarity: "Common", cost: 18, heal: 45, icon: "♥", description: "Restores crawler HP. Revives a downed pet first." },
    mana_potion: { id: "mana_potion", name: "Mana Potion", type: "consumable", consumableType: "mana", rarity: "Common", cost: 14, mana: 35, icon: "✦", description: "Restores mana for class and magic systems." },
    torch: { id: "torch", name: "Crawler Torch", type: "light", cost: 10, icon: "☼", description: "A spare light source for bad rooms and worse decisions." }
  });

  let renderingFixedShop = false;
  let watcherInstalled = false;

  function nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function suppressShopReopen(ms = 1000) {
    window.__dcwSuppressShopOpenUntil = Math.max(Number(window.__dcwSuppressShopOpenUntil) || 0, nowMs() + ms);
  }

  function shopOpenSuppressed() {
    return nowMs() < (Number(window.__dcwSuppressShopOpenUntil) || 0);
  }

  function esc(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  }

  function makeIdSafe(prefix) {
    return typeof makeId === "function" ? makeId(prefix) : `${prefix}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
  }

  function rarityValue(rarity) {
    if (typeof rarityPower === "function") return rarityPower(rarity);
    return { Common: 1, Uncommon: 2, Rare: 3, Epic: 4 }[rarity] || 1;
  }

  function petDefinitions() {
    try { return typeof PET_DEFINITIONS !== "undefined" ? PET_DEFINITIONS : {}; } catch { return {}; }
  }

  function petOptions() {
    try {
      if (typeof petMerchant !== "undefined" && Array.isArray(petMerchant?.options) && petMerchant.options.length) return petMerchant.options;
    } catch {}
    try { if (typeof PET_MERCHANT_OPTIONS !== "undefined" && Array.isArray(PET_MERCHANT_OPTIONS)) return PET_MERCHANT_OPTIONS; } catch {}
    return Object.keys(petDefinitions());
  }

  function itemSellValue(item) {
    if (!item) return 0;
    if (item.type === "consumable") return Math.max(2, Math.floor((item.cost || 14) * 0.5));
    if (item.type === "lootbox") return 8 + rarityValue(item.rarity) * 5;
    if (item.type === "weapon") return 9 + rarityValue(item.rarity) * 7 + Math.floor((item.damage || 0) / 5);
    if (item.type === "light") return 5;
    if (item.type === "gear") return 6 + rarityValue(item.rarity) * 6 + Math.max(0, item.hp || 0, item.attack || 0, item.defense || 0, Math.round((item.speed || 0) * 25), item.audience || 0);
    return 3 + rarityValue(item.rarity) * 2;
  }

  function isSellable(item) {
    const pets = petDefinitions();
    return !!item && item.slot !== "pet" && !pets[item.type];
  }

  function carriedSellables() {
    return (player?.inventory || []).filter(isSellable);
  }

  function junkItems() {
    return carriedSellables().filter(item => item.junk);
  }

  function safeItemDescription(item) {
    try {
      if (typeof itemDescription === "function") return itemDescription(item) || item.rarity || "Inventory item";
    } catch {}
    if (item?.type === "weapon") return `${item.damage || 0} DMG · ${item.range || 0} RNG`;
    if (item?.type === "lootbox") return "Prize box. Can be sold or opened in safe rooms.";
    if (item?.type === "consumable") return item.description || "Consumable item.";
    return item?.rarity || "Inventory item";
  }

  function makeConsumable(kind) {
    const base = SHOP_ITEMS[kind] || SHOP_ITEMS.health_potion;
    return {
      id: makeIdSafe(kind), type: "consumable", consumableType: base.consumableType,
      rarity: base.rarity, name: base.name, heal: base.heal || 0, mana: base.mana || 0,
      icon: base.icon, cost: base.cost, description: base.description
    };
  }

  function shopItemButton(kind) {
    const item = SHOP_ITEMS[kind];
    return `<button class="shopCard" type="button" data-shop-buy="${esc(kind)}"><span class="shopIcon">${esc(item.icon)}</span><strong>${esc(item.name)}</strong><small>${esc(item.description)}</small><em>${item.cost} coins</em></button>`;
  }

  function petShopButton(type) {
    const def = petDefinitions()[type];
    if (!def) return "";
    const currentPet = typeof getActivePet === "function" ? getActivePet() : player?.pet;
    const current = currentPet?.type === type;
    const cost = Number(def.cost) > 0 ? Number(def.cost) : type === "small_dog" ? 24 : type === "small_velociraptor" ? 32 : 28;
    return `<button class="shopCard ${current ? "owned" : ""}" type="button" data-shop-pet="${esc(type)}"><span class="shopIcon">🐾</span><strong>${esc(def.displayName || def.name || type)}</strong><small>${esc(def.role || def.description || "Run companion")}</small><em>${current ? "Active" : `${cost} coins`}</em></button>`;
  }

  function sellItemRow(item) {
    const value = itemSellValue(item);
    return `<div class="shopSellRow ${item.junk ? "junk" : ""}"><div><strong>${item.junk ? "★ " : ""}${esc(item.name || "Unnamed Item")}</strong><small>${esc(safeItemDescription(item))}</small></div><div class="shopSellActions"><span>${value}¢</span><button type="button" data-shop-junk="${esc(item.id)}">${item.junk ? "Unmark" : "Junk"}</button><button type="button" data-shop-sell="${esc(item.id)}">Sell</button></div></div>`;
  }

  function petStatusLine() {
    const pet = typeof getActivePet === "function" ? getActivePet() : player?.pet;
    if (!pet) return "No active pet.";
    const hp = Math.max(0, Math.ceil(pet.hp || 0));
    const max = Math.max(1, Math.ceil(pet.maxHp || 1));
    return `${pet.displayName || pet.name || "Pet"} · ${hp <= 0 || pet.down || pet.status === "downed" ? "DOWN" : `${hp}/${max} HP`} · Lv ${pet.level || 1}`;
  }

  function markFixedShopLayout(panel, box) {
    if (panel) panel.dataset.safeRoomShopLayout = "fixed";
    if (box) box.dataset.safeRoomShopLayout = "fixed";
  }

  function isShopOpen(panel = document.getElementById("petMerchantPanel")) {
    if (!panel) return false;
    const style = window.getComputedStyle(panel);
    return panel.classList.contains("open") || style.display !== "none";
  }

  function hasFixedShopLayout() {
    const panel = document.getElementById("petMerchantPanel");
    const box = document.getElementById("petMerchantOptions");
    if (!panel || !box || !isShopOpen(panel)) return true;
    return box.dataset.safeRoomShopLayout === "fixed"
      && !!box.querySelector("button[data-shop-buy='health_potion'], button[data-shop-buy=\"health_potion\"]")
      && !!box.querySelector("button[data-shop-sell-junk]")
      && !!box.querySelector("button[data-shop-exit]");
  }

  function renderFixedSafeRoomShopPanel() {
    const panel = document.getElementById("petMerchantPanel");
    const box = document.getElementById("petMerchantOptions");
    const title = document.getElementById("petMerchantTitle");
    if (!panel || !box) return false;
    renderingFixedShop = true;
    if (title) title.textContent = "Safe Room Shop";
    const sellables = carriedSellables();
    const junk = junkItems();
    const petCards = petOptions().map(petShopButton).filter(Boolean).join("") || `<div class="shopEmpty">No companions available right now.</div>`;
    const sellRows = sellables.length ? sellables.map(sellItemRow).join("") : `<div class="shopEmpty">Nothing carried to sell.</div>`;
    box.innerHTML = `
      <div class="shopHeader"><strong>Coins: ${player?.coins || 0}</strong><span>${esc(petStatusLine())}</span></div>
      <section class="shopSection"><h4>Buy Supplies</h4><div class="shopGrid">${shopItemButton("health_potion")}${shopItemButton("mana_potion")}${shopItemButton("torch")}</div></section>
      <section class="shopSection"><h4>Run Companions</h4><div class="shopGrid petGrid">${petCards}</div></section>
      <section class="shopSection"><h4>Sell Carried Items</h4><div class="shopSellSummary"><span>${sellables.length} carried · ${junk.length} junk marked</span><button type="button" data-shop-sell-junk>Sell All Junk</button><button type="button" class="shopExitButton" data-shop-exit>Exit Shop</button></div><div class="shopSellList">${sellRows}</div></section>
    `;
    panel.classList.add("safeRoomShopPanel");
    markFixedShopLayout(panel, box);
    setTimeout(() => { renderingFixedShop = false; }, 0);
    return true;
  }

  function forceFixedShopSoon() {
    const repair = () => {
      if (renderingFixedShop) return;
      const panel = document.getElementById("petMerchantPanel");
      if (!panel || !isShopOpen(panel)) return;
      if (!hasFixedShopLayout()) renderFixedSafeRoomShopPanel();
    };
    repair();
    setTimeout(repair, 0);
    setTimeout(repair, 60);
    setTimeout(repair, 160);
  }

  function openFixedSafeRoomShopPanel() {
    if (shopOpenSuppressed()) return false;
    const panel = document.getElementById("petMerchantPanel");
    if (!panel) return false;
    renderFixedSafeRoomShopPanel();
    panel.style.display = "block";
    panel.classList.add("open", "safeRoomShopPanel");
    document.body.classList.add("safeRoomShopOpen");
    forceFixedShopSoon();
    if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
    return true;
  }

  function closeFixedSafeRoomShopPanel(event = null) {
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
    }
    suppressShopReopen();
    const panel = document.getElementById("petMerchantPanel");
    if (panel) {
      panel.style.display = "none";
      panel.classList.remove("open");
    }
    document.body.classList.remove("safeRoomShopOpen");
    if (typeof resetTransientInputState === "function") resetTransientInputState();
    return true;
  }

  function buyShopItem(kind) {
    const base = SHOP_ITEMS[kind];
    if (!base) return false;
    if ((player.coins || 0) < base.cost) {
      announcer?.(`Not enough coins for ${base.name}.`);
      return false;
    }
    player.coins -= base.cost;
    const item = kind === "torch" && typeof generateTorchItem === "function" ? generateTorchItem() : makeConsumable(kind);
    player.inventory.push(item);
    announcer?.(`Purchased ${base.name} for ${base.cost} coins.`);
    updateInventoryUI?.();
    updateHUD?.();
    renderFixedSafeRoomShopPanel();
    return true;
  }

  function hireShopPet(type) {
    const def = petDefinitions()[type];
    if (!def || typeof createPet !== "function") return false;
    const cost = Number(def.cost) > 0 ? Number(def.cost) : type === "small_dog" ? 24 : type === "small_velociraptor" ? 32 : 28;
    if ((player.coins || 0) < cost) {
      announcer?.(`Not enough coins for ${def.displayName || "that companion"}.`);
      return false;
    }
    player.coins -= cost;
    const pet = createPet(type, player.x, player.y + 18);
    pet.status = "active";
    pet.down = false;
    if (typeof setActivePet === "function") setActivePet(pet);
    else { player.pet = pet; if (player.equipment) player.equipment.pet = pet; }
    updateInventoryUI?.();
    updateHUD?.();
    announcer?.(`${pet.displayName || pet.name} joins the run.`);
    renderFixedSafeRoomShopPanel();
    return true;
  }

  function sellCarriedItem(id) {
    const idx = (player.inventory || []).findIndex(item => item.id === id);
    if (idx < 0) return false;
    const item = player.inventory[idx];
    if (!isSellable(item)) return false;
    const value = itemSellValue(item);
    player.inventory.splice(idx, 1);
    player.coins = (player.coins || 0) + value;
    if (typeof selectedInventoryItemId !== "undefined" && selectedInventoryItemId === id) selectedInventoryItemId = null;
    announcer?.(`Sold ${item.name || "item"} for ${value} coins.`);
    updateInventoryUI?.();
    updateHUD?.();
    renderFixedSafeRoomShopPanel();
    return true;
  }

  function toggleJunkItem(id) {
    const item = (player.inventory || []).find(entry => entry.id === id);
    if (!item || !isSellable(item)) return false;
    item.junk = !item.junk;
    updateInventoryUI?.();
    renderFixedSafeRoomShopPanel();
    return true;
  }

  function sellAllJunk() {
    const junk = junkItems();
    if (!junk.length) {
      announcer?.("No junk marked.");
      return false;
    }
    const ids = new Set(junk.map(item => item.id));
    let total = 0;
    player.inventory = (player.inventory || []).filter(item => {
      if (!ids.has(item.id)) return true;
      total += itemSellValue(item);
      return false;
    });
    player.coins = (player.coins || 0) + total;
    if (typeof selectedInventoryItemId !== "undefined" && ids.has(selectedInventoryItemId)) selectedInventoryItemId = null;
    announcer?.(`Sold ${junk.length} junk item${junk.length === 1 ? "" : "s"} for ${total} coins.`);
    updateInventoryUI?.();
    updateHUD?.();
    renderFixedSafeRoomShopPanel();
    return true;
  }

  function shopInReach() {
    try {
      if (typeof petMerchant !== "undefined" && petMerchant && player && Math.hypot(player.x - petMerchant.x, player.y - petMerchant.y) < player.r + petMerchant.r + 44) return true;
    } catch {}
    return !!player?.safe;
  }

  function bindShopClicks() {
    const panel = document.getElementById("petMerchantPanel");
    if (!panel || panel.dataset.safeRoomShopRenderFixBound === "true") return;
    panel.dataset.safeRoomShopRenderFixBound = "true";
    panel.addEventListener("click", event => {
      const exit = event.target.closest("button[data-shop-exit], #closePetMerchantBtn");
      if (exit) { closeFixedSafeRoomShopPanel(event); return; }
      const buy = event.target.closest("button[data-shop-buy]");
      if (buy) { event.preventDefault(); event.stopImmediatePropagation(); buyShopItem(buy.dataset.shopBuy); return; }
      const pet = event.target.closest("button[data-shop-pet]");
      if (pet) { event.preventDefault(); event.stopImmediatePropagation(); hireShopPet(pet.dataset.shopPet); return; }
      const junk = event.target.closest("button[data-shop-junk]");
      if (junk) { event.preventDefault(); event.stopImmediatePropagation(); toggleJunkItem(junk.dataset.shopJunk); return; }
      const sell = event.target.closest("button[data-shop-sell]");
      if (sell) { event.preventDefault(); event.stopImmediatePropagation(); sellCarriedItem(sell.dataset.shopSell); return; }
      if (event.target.closest("button[data-shop-sell-junk]")) { event.preventDefault(); event.stopImmediatePropagation(); sellAllJunk(); }
    }, true);
  }

  function patchGlobals() {
    window.renderSafeRoomShopPanel = renderFixedSafeRoomShopPanel;
    window.openSafeRoomShopPanel = openFixedSafeRoomShopPanel;
    window.closeSafeRoomShopPanel = closeFixedSafeRoomShopPanel;
    window.hidePetMerchantPanel = closeFixedSafeRoomShopPanel;

    try { renderSafeRoomShopPanel = renderFixedSafeRoomShopPanel; } catch {}
    try { openSafeRoomShopPanel = openFixedSafeRoomShopPanel; } catch {}
    try { hidePetMerchantPanel = closeFixedSafeRoomShopPanel; } catch {}

    if (typeof interact === "function" && !interact.__safeRoomShopRenderFixWrapped) {
      const original = interact;
      interact = function interactWithFixedShop(...args) {
        if (shopInReach()) {
          if (shopOpenSuppressed()) return false;
          return openFixedSafeRoomShopPanel();
        }
        return original.apply(this, args);
      };
      interact.__safeRoomShopRenderFixWrapped = true;
    }
  }

  function watchShopPanel() {
    if (watcherInstalled) return;
    const panel = document.getElementById("petMerchantPanel");
    const box = document.getElementById("petMerchantOptions");
    if (!panel || !box) return;
    watcherInstalled = true;
    const observer = new MutationObserver(() => {
      if (renderingFixedShop) return;
      forceFixedShopSoon();
    });
    observer.observe(panel, { attributes: true, childList: true, subtree: true, attributeFilter: ["class", "style", "data-safe-room-shop-layout"] });
    observer.observe(box, { attributes: true, childList: true, subtree: true, attributeFilter: ["data-safe-room-shop-layout"] });
  }

  function install() {
    bindShopClicks();
    patchGlobals();
    watchShopPanel();
    const panel = document.getElementById("petMerchantPanel");
    if (panel?.classList.contains("open") || panel?.style.display === "block") renderFixedSafeRoomShopPanel();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  const retry = setInterval(install, 250);
  setTimeout(() => clearInterval(retry), 5000);
})();
