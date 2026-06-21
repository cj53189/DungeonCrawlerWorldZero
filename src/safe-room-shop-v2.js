// Safe Room Shop V2.
// This is a clean shop surface that does not reuse the old pet merchant panel.
// The old panel may still exist for pet-care compatibility, but V2 owns shop UI, shop actions, and shop close behavior.
(function installSafeRoomShopV2() {
  if (window.__dcwSafeRoomShopV2Installed) return;
  window.__dcwSafeRoomShopV2Installed = true;

  const PANEL_ID = "safeRoomShopV2";
  const STYLE_ID = "safeRoomShopV2Styles";
  const SUPPRESS_MS = 900;

  const SHOP_ITEMS = Object.freeze({
    health_potion: { id: "health_potion", name: "Health Potion", type: "consumable", consumableType: "health", rarity: "Common", cost: 18, heal: 45, icon: "♥", description: "Restores crawler HP. Revives a downed pet first." },
    mana_potion: { id: "mana_potion", name: "Mana Potion", type: "consumable", consumableType: "mana", rarity: "Common", cost: 14, mana: 35, icon: "✦", description: "Restores mana for future class and magic systems." },
    torch: { id: "torch", name: "Crawler Torch", type: "light", rarity: "Common", cost: 10, icon: "☼", description: "A spare light source for bad rooms and worse decisions." }
  });

  function nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function suppressShopOpen(ms = SUPPRESS_MS) {
    const until = nowMs() + ms;
    window.__dcwSuppressShopOpenUntil = Math.max(Number(window.__dcwSuppressShopOpenUntil) || 0, until);
    window.__dcwShopV2SuppressUntil = Math.max(Number(window.__dcwShopV2SuppressUntil) || 0, until);
  }

  function shopOpenSuppressed() {
    return nowMs() < Math.max(Number(window.__dcwSuppressShopOpenUntil) || 0, Number(window.__dcwShopV2SuppressUntil) || 0);
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

  function oldPetMerchantPanel() {
    return document.getElementById("petMerchantPanel");
  }

  function closeOldPetMerchantPanel() {
    const panel = oldPetMerchantPanel();
    if (!panel) return;
    panel.style.display = "none";
    panel.classList.remove("open");
  }

  function isShopInReach() {
    try {
      if (typeof petMerchant !== "undefined" && petMerchant && player && Math.hypot(player.x - petMerchant.x, player.y - petMerchant.y) < player.r + petMerchant.r + 44) return true;
    } catch {}
    return !!player?.safe;
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

  function itemDescriptionSafe(item) {
    try { if (typeof itemDescription === "function") return itemDescription(item) || item.rarity || "Inventory item"; } catch {}
    if (item?.type === "weapon") return `${item.damage || 0} DMG · ${item.range || 0} RNG`;
    if (item?.type === "lootbox") return "Prize box. Can be sold or opened in safe rooms.";
    if (item?.type === "consumable") return item.description || "Consumable item.";
    return item?.rarity || "Inventory item";
  }

  function petStatusLine() {
    const pet = typeof getActivePet === "function" ? getActivePet() : player?.pet;
    if (!pet) return "No active pet";
    const hp = Math.max(0, Math.ceil(pet.hp || 0));
    const max = Math.max(1, Math.ceil(pet.maxHp || 1));
    const down = hp <= 0 || pet.down || pet.status === "downed";
    return `${pet.displayName || pet.name || "Pet"} · ${down ? "DOWN" : `${hp}/${max} HP`} · Lv ${pet.level || 1}`;
  }

  function makeConsumable(kind) {
    const base = SHOP_ITEMS[kind] || SHOP_ITEMS.health_potion;
    return {
      id: makeIdSafe(kind), type: "consumable", consumableType: base.consumableType,
      rarity: base.rarity, name: base.name, heal: base.heal || 0, mana: base.mana || 0,
      icon: base.icon, cost: base.cost, description: base.description
    };
  }

  function shopCard(kind) {
    const item = SHOP_ITEMS[kind];
    return `<button class="shopV2Card" type="button" data-shop-v2-buy="${esc(kind)}"><span>${esc(item.icon)}</span><strong>${esc(item.name)}</strong><small>${esc(item.description)}</small><em>${item.cost} coins</em></button>`;
  }

  function petCard(type) {
    const def = petDefinitions()[type];
    if (!def) return "";
    const active = (typeof getActivePet === "function" ? getActivePet() : player?.pet)?.type === type;
    const cost = Number(def.cost) > 0 ? Number(def.cost) : type === "small_dog" ? 24 : type === "small_velociraptor" ? 32 : 28;
    return `<button class="shopV2Card ${active ? "owned" : ""}" type="button" data-shop-v2-pet="${esc(type)}"><span>🐾</span><strong>${esc(def.displayName || def.name || type)}</strong><small>${esc(def.role || def.description || "Run companion")}</small><em>${active ? "Active" : `${cost} coins`}</em></button>`;
  }

  function sellRow(item) {
    const value = itemSellValue(item);
    return `<div class="shopV2SellRow ${item.junk ? "junk" : ""}"><div><strong>${item.junk ? "★ " : ""}${esc(item.name || "Unnamed Item")}</strong><small>${esc(itemDescriptionSafe(item))}</small></div><div class="shopV2SellActions"><span>${value}¢</span><button type="button" data-shop-v2-junk="${esc(item.id)}">${item.junk ? "Unmark" : "Junk"}</button><button type="button" data-shop-v2-sell="${esc(item.id)}">Sell</button></div></div>`;
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "safeRoomShopV2Title");
    panel.innerHTML = `
      <button id="safeRoomShopV2Close" class="shopV2Close" type="button" aria-label="Close shop">×</button>
      <div class="shopV2Header"><div><div class="shopV2Eyebrow">Safe Room</div><h3 id="safeRoomShopV2Title">Shop</h3></div><button class="shopV2Leave" type="button" data-shop-v2-close>Leave Shop</button></div>
      <div id="safeRoomShopV2Content" class="shopV2Content"></div>
      <div class="shopV2Footer"><button class="shopV2Leave" type="button" data-shop-v2-close>Leave Shop</button></div>
    `;
    document.body.appendChild(panel);
    bindPanelEvents(panel);
    return panel;
  }

  function renderPanel() {
    const panel = ensurePanel();
    const content = panel.querySelector("#safeRoomShopV2Content");
    if (!content) return;
    const sellables = carriedSellables();
    const junk = junkItems();
    const pets = petOptions().map(petCard).filter(Boolean).join("") || `<div class="shopV2Empty">No companions available right now.</div>`;
    const sellRows = sellables.length ? sellables.map(sellRow).join("") : `<div class="shopV2Empty">Nothing carried to sell.</div>`;
    content.innerHTML = `
      <div class="shopV2Status"><strong>Coins: ${player?.coins || 0}</strong><span>${esc(petStatusLine())}</span></div>
      <section class="shopV2Section"><h4>Buy Supplies</h4><div class="shopV2Grid">${shopCard("health_potion")}${shopCard("mana_potion")}${shopCard("torch")}</div></section>
      <section class="shopV2Section"><h4>Run Companions</h4><div class="shopV2Grid">${pets}</div></section>
      <section class="shopV2Section"><h4>Sell Carried Items</h4><div class="shopV2SellSummary"><span>${sellables.length} carried · ${junk.length} junk marked</span><button type="button" data-shop-v2-sell-junk>Sell All Junk</button></div><div class="shopV2SellList">${sellRows}</div></section>
    `;
  }

  function openShop(event = null) {
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
    }
    if (shopOpenSuppressed()) return false;
    if (!isShopInReach()) {
      announcer?.("The shop only does business in safe rooms.");
      return false;
    }
    closeOldPetMerchantPanel();
    renderPanel();
    const panel = ensurePanel();
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("safeRoomShopV2Open");
    if (typeof syncControllerWindowFocus === "function") syncControllerWindowFocus();
    return true;
  }

  function closeShop(event = null) {
    if (event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
    }
    suppressShopOpen();
    const panel = ensurePanel();
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("safeRoomShopV2Open");
    closeOldPetMerchantPanel();
    if (document.activeElement && panel.contains(document.activeElement)) document.activeElement.blur();
    if (typeof resetTransientInputState === "function") resetTransientInputState();
    if (typeof syncControllerWindowFocus === "function") setTimeout(syncControllerWindowFocus, 0);
    return false;
  }

  function buyItem(kind) {
    const base = SHOP_ITEMS[kind];
    if (!base) return false;
    if ((player.coins || 0) < base.cost) {
      announcer?.(`Not enough coins for ${base.name}.`);
      return false;
    }
    player.coins -= base.cost;
    const item = kind === "torch" && typeof generateTorchItem === "function" ? generateTorchItem() : makeConsumable(kind);
    player.inventory.push(item);
    announcer?.(`Purchased ${base.name}.`);
    updateInventoryUI?.();
    updateHUD?.();
    renderPanel();
    return true;
  }

  function hirePet(type) {
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
    announcer?.(`${pet.displayName || pet.name || "Pet"} joins the run.`);
    updateInventoryUI?.();
    updateHUD?.();
    renderPanel();
    return true;
  }

  function sellItem(id) {
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
    renderPanel();
    return true;
  }

  function toggleJunk(id) {
    const item = (player.inventory || []).find(entry => entry.id === id);
    if (!item || !isSellable(item)) return false;
    item.junk = !item.junk;
    updateInventoryUI?.();
    renderPanel();
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
    renderPanel();
    return true;
  }

  function bindPanelEvents(panel) {
    const action = event => {
      const close = event.target.closest("[data-shop-v2-close], #safeRoomShopV2Close");
      if (close) { closeShop(event); return; }
      const buy = event.target.closest("button[data-shop-v2-buy]");
      if (buy) { event.preventDefault(); event.stopImmediatePropagation(); buyItem(buy.dataset.shopV2Buy); return; }
      const pet = event.target.closest("button[data-shop-v2-pet]");
      if (pet) { event.preventDefault(); event.stopImmediatePropagation(); hirePet(pet.dataset.shopV2Pet); return; }
      const junk = event.target.closest("button[data-shop-v2-junk]");
      if (junk) { event.preventDefault(); event.stopImmediatePropagation(); toggleJunk(junk.dataset.shopV2Junk); return; }
      const sell = event.target.closest("button[data-shop-v2-sell]");
      if (sell) { event.preventDefault(); event.stopImmediatePropagation(); sellItem(sell.dataset.shopV2Sell); return; }
      if (event.target.closest("button[data-shop-v2-sell-junk]")) { event.preventDefault(); event.stopImmediatePropagation(); sellAllJunk(); }
    };
    for (const type of ["pointerdown", "touchstart", "click"]) panel.addEventListener(type, action, { capture: true, passive: false });
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.safeRoomShopV2Open #touchControls,
      body.safeRoomShopV2Open .devControls,
      body.safeRoomShopV2Open #testerDebugLine,
      body.safeRoomShopV2Open #petMerchantPanel {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      #${PANEL_ID} {
        display: none;
        position: fixed;
        inset: max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
        z-index: 12000;
        background: rgba(20,13,9,0.98);
        border: 2px solid rgba(255,216,107,0.35);
        border-radius: 18px;
        box-shadow: 0 18px 48px rgba(0,0,0,0.62);
        color: #f3ead7;
        overflow: hidden;
        touch-action: none;
      }

      #${PANEL_ID}.open { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
      .shopV2Close { position: fixed; top: max(16px, env(safe-area-inset-top)); right: max(16px, env(safe-area-inset-right)); z-index: 12010; min-width: 56px; min-height: 56px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.22); background: rgba(32,20,16,0.98); color: #fff; font-size: 30px; font-weight: 900; }
      .shopV2Header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 76px 10px 16px; border-bottom: 1px solid rgba(255,216,107,0.18); }
      .shopV2Header h3 { margin: 0; color: #ffd86b; letter-spacing: .05em; text-transform: uppercase; }
      .shopV2Eyebrow { color: #cdbf9e; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; }
      .shopV2Content { display: grid; gap: 12px; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; padding: 12px 14px 18px; }
      .shopV2Footer { padding: 10px 14px max(12px, env(safe-area-inset-bottom)); border-top: 1px solid rgba(255,216,107,0.18); background: rgba(0,0,0,0.24); }
      .shopV2Leave { min-height: 52px; border-radius: 999px; border: 2px solid rgba(124,247,255,0.52); background: linear-gradient(135deg, rgba(44,132,160,0.96), rgba(20,28,46,0.96)); color: #effcff; font-weight: 1000; padding: 8px 14px; }
      .shopV2Footer .shopV2Leave { width: 100%; }
      .shopV2Status { display: flex; justify-content: space-between; gap: 12px; padding: 9px 10px; border: 1px solid rgba(255,216,107,0.16); border-radius: 12px; background: rgba(0,0,0,0.26); }
      .shopV2Status strong { color: #ffd86b; }
      .shopV2Status span { color: #d8cdb7; font-size: 12px; text-align: right; }
      .shopV2Section { border: 1px solid rgba(255,216,107,0.15); border-radius: 13px; padding: 10px; background: rgba(0,0,0,0.18); }
      .shopV2Section h4 { margin: 0 0 8px; color: #ffd86b; text-transform: uppercase; letter-spacing: .11em; font-size: 12px; }
      .shopV2Grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
      .shopV2Card { min-height: 108px; border: 1px solid rgba(255,255,255,.16); border-radius: 12px; background: rgba(255,255,255,.07); color: #eee; padding: 9px; text-align: left; display: grid; gap: 4px; touch-action: manipulation; }
      .shopV2Card.owned { outline: 2px solid rgba(124,247,255,.6); }
      .shopV2Card span { font-size: 22px; }
      .shopV2Card strong, .shopV2Card small, .shopV2Card em { display: block; }
      .shopV2Card small { color: #cfc1aa; line-height: 1.25; }
      .shopV2Card em { color: #ffd86b; font-style: normal; font-weight: 900; }
      .shopV2SellSummary { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; margin-bottom: 8px; color: #cfc1aa; }
      .shopV2SellSummary button, .shopV2SellActions button { border: 1px solid rgba(255,216,107,.25); border-radius: 999px; background: rgba(255,255,255,.08); color: #fff; min-height: 44px; padding: 6px 10px; font-weight: 900; }
      .shopV2SellList { display: grid; gap: 7px; }
      .shopV2SellRow { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: center; border: 1px solid rgba(255,255,255,.13); border-radius: 11px; padding: 8px; background: rgba(0,0,0,.22); }
      .shopV2SellRow.junk { border-color: rgba(255,216,107,.55); background: rgba(120,84,22,.22); }
      .shopV2SellRow strong, .shopV2SellRow small { display: block; }
      .shopV2SellRow small { color: #bfb39e; line-height: 1.25; }
      .shopV2SellActions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-end; }
      .shopV2SellActions span { color: #ffd86b; font-weight: 900; }
      .shopV2Empty { color: #9f927f; font-style: italic; padding: 10px; }

      @media (max-width: 900px), (hover: none) and (pointer: coarse) {
        #${PANEL_ID} { inset: 0; border-radius: 0; border-width: 0; }
        .shopV2Header { padding-left: 14px; padding-top: max(14px, env(safe-area-inset-top)); }
        .shopV2Header .shopV2Leave { display: none; }
        .shopV2Status, .shopV2SellRow { display: grid; grid-template-columns: 1fr; }
        .shopV2Status span { text-align: left; }
        .shopV2Grid { grid-template-columns: 1fr; }
        .shopV2Card { min-height: 92px; }
        .shopV2SellSummary { grid-template-columns: 1fr; }
        .shopV2SellSummary button, .shopV2SellActions button { min-height: 50px; }
      }

      @media (orientation: landscape) and (max-height: 520px) {
        #${PANEL_ID}.open { grid-template-rows: auto minmax(0, 1fr) auto; }
        .shopV2Grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .shopV2Card { min-height: 82px; }
      }
    `;
    document.head.appendChild(style);
  }

  function patchInteract() {
    if (window.__dcwShopV2InteractPatched) return;
    window.__dcwShopV2InteractPatched = true;
    const original = typeof interact === "function" ? interact : window.interact;
    const wrapped = function interactWithShopV2(...args) {
      if (isShopInReach()) return openShop();
      return typeof original === "function" ? original.apply(this, args) : false;
    };
    window.interact = wrapped;
    try { interact = wrapped; } catch {}
  }

  function bindTouchInteractCapture() {
    const btn = document.getElementById("btnInteract");
    if (!btn || btn.dataset.shopV2CaptureBound === "true") return;
    btn.dataset.shopV2CaptureBound = "true";
    const fire = event => {
      if (!isShopInReach() || shopOpenSuppressed()) return;
      openShop(event);
    };
    for (const type of ["pointerdown", "touchstart", "click"]) btn.addEventListener(type, fire, { capture: true, passive: false });
  }

  function watchOldPanel() {
    const panel = oldPetMerchantPanel();
    if (!panel || panel.dataset.shopV2OldPanelWatched === "true") return;
    panel.dataset.shopV2OldPanelWatched = "true";
    new MutationObserver(() => {
      const style = window.getComputedStyle(panel);
      const oldOpen = panel.classList.contains("open") || style.display !== "none";
      if (!oldOpen) return;
      closeOldPetMerchantPanel();
      if (!document.getElementById(PANEL_ID)?.classList.contains("open") && !shopOpenSuppressed()) openShop();
    }).observe(panel, { attributes: true, attributeFilter: ["class", "style"] });
  }

  function install() {
    injectStyles();
    ensurePanel();
    patchInteract();
    bindTouchInteractCapture();
    watchOldPanel();
    window.openSafeRoomShopPanelV2 = openShop;
    window.closeSafeRoomShopPanelV2 = closeShop;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  const retry = setInterval(install, 250);
  setTimeout(() => clearInterval(retry), 8000);
})();
