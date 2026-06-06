const SLOT_LABELS={head:"Head",chest:"Chest",legs:"Legs",feet:"Feet",accessory:"Accessory",light:"Light"};
const ITEM_BASES={head:["Helmet","Cap","Crown","Hood"],chest:["Vest","Tunic","Breastplate","Jacket"],legs:["Pants","Greaves","Shorts","Trousers"],feet:["Boots","Sandals","Crocs","Footwraps"],accessory:["Ring","Charm","Badge","Pendant"]};
const ITEM_PREFIXES=["Goblin","Rat-hide","Bone","Rusty","Lucky","Crawler","Moldy","Questionable","Royal","Screaming"];
const ROOM_NAMES={small:["Crypt Nook","Goblin Pantry","Collapsed Alcove","Rat Nest","Old Guard Room"],medium:["Bone Gallery","Broken Armory","Forgotten Shrine","Goblin Barracks","Hall of Echoes","Mushroom Chapel"],large:["Feast Hall","The Drowned Hall","Cavern of Teeth","Hall of Rusted Banners"],boss:["The Rat King's Court","The Bone Collector's Pit","Champion's Den","The Blood-Marked Chamber","The Old Arena"]};
function makeId(p="item"){return `${p}_${Date.now()}_${Math.floor(Math.random()*999999)}`;}
function choose(a){return a[Math.floor(Math.random()*a.length)];}
function rollRarity(force=false){if(force)return"Rare";let r=Math.random();return r<.62?"Common":r<.88?"Uncommon":r<.98?"Rare":"Epic";}
function rarityPower(r){return {Common:1,Uncommon:2,Rare:3,Epic:4}[r]||1;}
function generateGear(forceRare=false){
 const slot=choose(Object.keys(ITEM_BASES)),rarity=rollRarity(forceRare),p=rarityPower(rarity);
 const item={id:makeId("gear"),type:"gear",slot,rarity,name:`${rarity} ${choose(ITEM_PREFIXES)} ${choose(ITEM_BASES[slot])}`,hp:0,attack:0,speed:0,defense:0,audience:0};
 if(slot==="head")item.audience=p*2; if(slot==="chest")item.hp=p*9; if(slot==="legs")item.defense=p; if(slot==="feet")item.speed=p*.08;
 if(slot==="accessory"){if(Math.random()<.5)item.attack=p*2; else item.audience=p*3;}
 if(Math.random()<.28)item.hp+=p*4; if(Math.random()<.22)item.attack+=p; if(Math.random()<.18)item.defense+=1;
 return item;
}
function generateLootBox(forceRare=false){const rarity=rollRarity(forceRare);return{id:makeId("box"),type:"lootbox",rarity,name:`${rarity} Prize Box`,opened:false};}
function generateTorchItem(){return{id:makeId("torch"),type:"light",slot:"light",rarity:"Common",name:"Crawler Torch",radius:isMobileLike()?142:164,intensity:.36};}
function hasEquippedLightSource(){return !!player.equipment?.light && player.equipment.light.type==="light";}
function itemDescription(i){if(!i)return""; if(i.type==="lootbox")return"Can only be opened in a safe room."; if(i.type==="light")return"Equipped light source. Illuminates the crawler while carried."; let b=[]; if(i.hp)b.push(`+${i.hp} HP`); if(i.attack)b.push(`+${i.attack} ATK`); if(i.defense)b.push(`+${i.defense} DEF`); if(i.speed)b.push(`+${i.speed.toFixed(2)} SPD`); if(i.audience)b.push(`+${i.audience} Audience`); return b.join(" · ")||"Mostly decorative. The dungeon approves of pointless confidence.";}
function addItem(item){
 player.inventory.push(item);
 if(item.type==="lootbox"){stats.lootBoxesFound++; achievement("NEW LOOT BOX",`You found a ${item.name}. It can only be opened in a safe room.`,`box_${item.id}`);}
 else if(item.type==="light"){achievement("NEW LIGHT",`You found ${item.name}. ${itemDescription(item)}`,`light_${item.id}`);}
 else{stats.gearFound++; achievement("NEW GEAR",`You found ${item.name}. ${itemDescription(item)}`,`gear_${item.id}`);}
 updateInventoryUI(); updateHUD();
}
function equipItem(id){
 const idx=player.inventory.findIndex(i=>i.id===id); if(idx<0)return; const item=player.inventory[idx]; if(item.type!=="gear"&&item.type!=="light")return;
 const old=player.equipment[item.slot]; player.equipment[item.slot]=item; player.inventory.splice(idx,1); if(old)player.inventory.push(old);
 recalcEquipmentStats(); achievement("EQUIPPED",`You equipped ${item.name}. ${itemDescription(item)}`,`equip_${item.id}`); updateInventoryUI(); updateHUD(); visibilityDirty=true;
}
function openLootBox(id){
 const idx=player.inventory.findIndex(i=>i.id===id); if(idx<0)return; const box=player.inventory[idx]; if(box.type!=="lootbox")return;
 if(!player.safe){announcer("Loot boxes may only be opened in safe rooms. The dungeon believes in responsible dopamine distribution.");return;}
 player.inventory.splice(idx,1); stats.lootBoxesOpened++; const coins=8+Math.floor(Math.random()*16)+rarityPower(box.rarity)*6; player.coins+=coins;
 const gear=generateGear(box.rarity==="Rare"||box.rarity==="Epic"); player.inventory.push(gear); stats.gearFound++;
 achievement("LOOT BOX OPENED",`You opened ${box.name} and received ${coins} coins and ${gear.name}. Pants-based civilization remains possible.`,`open_${box.id}`);
 if(!achievements.has("firstLootBoxOpen"))achievement("NEW ACHIEVEMENT: Delayed Gratification","You waited until a safe room to open a box. Somewhere, an impulse-control researcher just shed a single tear.","firstLootBoxOpen");
 updateInventoryUI(); updateHUD();
}
function discardItem(id){const idx=player.inventory.findIndex(i=>i.id===id); if(idx<0)return; const [item]=player.inventory.splice(idx,1); announcer(`You discarded ${item.name}. The dungeon has sold it to someone with lower standards.`); updateInventoryUI(); updateHUD();}
function recalcEquipmentStats(){
 let hp=0,atk=0,spd=0,def=0,aud=0; for(const item of Object.values(player.equipment)){if(!item||item.type==="light")continue; hp+=item.hp||0; atk+=item.attack||0; spd+=item.speed||0; def+=item.defense||0; aud+=item.audience||0;}
 const old=player.maxHp; player.maxHp=100+(player.level-1)*14+hp; player.attackDamage=20+(player.level-1)*4+atk; player.speed=player.baseSpeed+spd; player.defense=def; player.audienceBonus=aud; if(player.maxHp>old)player.hp+=player.maxHp-old; player.hp=Math.min(player.hp,player.maxHp);
}
function lootBoxCount(){return player.inventory.filter(i=>i.type==="lootbox").length;}
function escapeHtml(value){return String(value).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));}
function setupInventoryActionHandlers(){
 const panel=document.getElementById("inventoryPanel");
 if(!panel||panel.dataset.actionsBound==="true")return;
 panel.dataset.actionsBound="true";
 panel.addEventListener("click",e=>{
  const weaponButton=e.target.closest("button[data-weapon-id]");
  if(weaponButton){setPlayerWeapon(weaponButton.dataset.weaponId);updateInventoryUI();return;}
  const button=e.target.closest("button[data-action][data-item-id]");
  if(!button)return;
  const id=button.dataset.itemId;
  if(button.dataset.action==="equip")equipItem(id);
  if(button.dataset.action==="open")openLootBox(id);
  if(button.dataset.action==="drop")discardItem(id);
 });
}
function rarityClass(item){return `rarity${(item?.rarity||"Common").replace(/[^a-z0-9]/gi,"")}`;}
function typeClass(item){return `itemType${item?.type==="lootbox"?"LootBox":item?.type==="light"?"Light":"Gear"}`;}
function slotIcon(item){
 if(!item)return "?";
 if(item.type==="lootbox")return "⬡";
 if(item.type==="light")return "✦";
 return {head:"◠",chest:"▣",legs:"▥",feet:"⌞",accessory:"◇"}[item.slot]||"◆";
}
function renderItemCard(item, extraClass=""){
 const action=item.type==="gear"||item.type==="light"?"equip":"open";
 const actionLabel=action==="equip"?"Equip":"Open";
 const slotLabel=item.type==="gear"||item.type==="light"?SLOT_LABELS[item.slot]:"Loot Box";
 return `<div class="invItem ${rarityClass(item)} ${typeClass(item)} ${extraClass}"><div class="itemIcon">${slotIcon(item)}</div><div class="itemName">${escapeHtml(item.name)}</div><div class="itemSlot">${escapeHtml(slotLabel)} · ${escapeHtml(item.rarity||"Common")}</div><div class="itemMeta">${escapeHtml(itemDescription(item))}</div><div class="itemActions"><button class="itemBtn" type="button" data-action="${action}" data-item-id="${escapeHtml(item.id)}">${actionLabel}</button><button class="itemBtn" type="button" data-action="drop" data-item-id="${escapeHtml(item.id)}">Drop</button></div></div>`;
}
function renderEquipmentSlot(slot){
 const item=player.equipment[slot];
 if(!item)return `<div class="equipSlot empty"><div class="equipLabel">${SLOT_LABELS[slot]}</div><div class="equipEmpty">Empty</div></div>`;
 return `<div class="equipSlot ${rarityClass(item)} ${typeClass(item)}"><div class="equipLabel">${SLOT_LABELS[slot]}</div><div class="equipName">${escapeHtml(item.name)}</div><div class="equipMeta">${escapeHtml(itemDescription(item))}</div></div>`;
}
function renderWeaponGrid(){
 return WEAPON_ORDER.map(id=>{
  const weapon=WEAPON_DEFINITIONS[id];
  const active=id===player.currentWeaponId;
  return `<button class="weaponCell weapon${escapeHtml(id)} ${active?"active":""}" type="button" data-weapon-id="${escapeHtml(id)}"><span>${escapeHtml(weapon.name)}</span><small>${weapon.damage} DMG · ${weapon.range} RNG</small></button>`;
 }).join("");
}
function updateInventoryUI(){
 const panel=document.getElementById("inventoryPanel"); if(!panel)return; const eq=document.getElementById("equipmentStats"),list=document.getElementById("inventoryList");
 setupInventoryActionHandlers();
 eq.innerHTML=`<div class="inventoryHeader"><div><div class="inventoryTitle">Stash & Armory</div><div class="inventorySubTitle">Diablo-style loot grid</div></div><div class="inventoryPower">ATK ${player.attackDamage} · DEF ${player.defense} · SPD ${player.speed.toFixed(2)} · AUD +${player.audienceBonus}</div></div><div class="weaponGrid">${renderWeaponGrid()}</div><div class="equipGrid">${Object.keys(SLOT_LABELS).map(renderEquipmentSlot).join("")}</div>`;
 if(!player.inventory.length){list.innerHTML='<div class="inventoryGrid"><div class="invItem empty"><div class="itemIcon">□</div><div class="itemName">Empty Pack</div><div class="itemMeta">Inventory empty. The dungeon recommends crime.</div></div></div>';return;}
 const sorted=[...player.inventory].sort((a,b)=>(rarityPower(b.rarity)-rarityPower(a.rarity))||String(a.type).localeCompare(String(b.type))||String(a.slot||"").localeCompare(String(b.slot||""))||String(a.name).localeCompare(String(b.name)));
 list.innerHTML=`<div class="inventoryGrid">${sorted.map(item=>renderItemCard(item)).join("")}</div>`;
}
function toggleInventoryPanel(){const p=document.getElementById("inventoryPanel"),l=document.getElementById("logPanel"),r=document.getElementById("safeRoomRecap"); if(!p)return; if(p.style.display==="block"){p.style.display="none";return;} if(l)l.style.display="none"; if(r)r.style.display="none"; updateInventoryUI(); p.style.display="block";}
function closeInventoryPanel(){const p=document.getElementById("inventoryPanel"); if(p)p.style.display="none";}
function rewardChestLoot(){
 const roll=Math.random();
 if(roll<.42){const gained=5+Math.floor(Math.random()*12); player.coins+=gained; achievement("CHEST LOOT",`You found ${gained} coins. The dungeon reminds you that wealth is not a personality, but it helps.`,`coins_${Date.now()}_${Math.random()}`);}
 else if(roll<.68)addItem(generateLootBox());
 else if(roll<.78)addItem(generateTorchItem());
 else addItem(generateGear());
 if(!achievements.has("firstWearableLoot")&&stats.gearFound>0)achievement("NEW ACHIEVEMENT: Pants Adjacent","You found wearable equipment. Whether this improves your dignity remains under review.","firstWearableLoot");
 updateInventoryUI(); updateHUD();
}

function gainXP(amount) {
  player.xp += amount;

  if (!achievements.has("firstXP")) {
    achievement("NEW ACHIEVEMENT: Number Goes Up", "You gained experience. This is how games trick mammals into enjoying chores.", "firstXP");
  }

  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    levelUpPlayer();
  }

  updateHUD();
}

function levelUpPlayer() {
  player.level++;
  player.xpToNext = Math.floor(40 + player.level * 28);
  recalcEquipmentStats();
  player.hp = player.maxHp;

  changeAudience(6);
  achievement("LEVEL UP", `You reached level ${player.level}. Your numbers improved, which is technically character development.`, `level${player.level}`);
}


function changeAudience(amount) {
  audienceScore = Math.max(0, Math.min(100, audienceScore + amount));
  updateHUD();
  if (audienceScore >= 25 && !achievements.has("audience25")) achievement("NEW ACHIEVEMENT: Mildly Watchable", "Your audience score reached 25. Somewhere, a bored alien looked up from its sandwich.", "audience25");
  if (audienceScore >= 50 && !achievements.has("audience50")) achievement("NEW ACHIEVEMENT: Content Creature", "Your audience score reached 50. You are no longer background noise. Terrifying progress.", "audience50");
}

function updateReputation() {
  const safeSeconds = Math.floor(stats.timeInSafeRoomFrames / 60);
  const outsideSeconds = Math.floor(stats.timeOutsideSafeRoomFrames / 60);
  const c = [];
  if (roomsSeen >= 15 && stats.chestsOpened <= 1) c.push("Dungeon Tourist");
  if (stats.chestsOpened >= 2 && stats.chestsOpened >= stats.enemiesKilled + 1) c.push("Loot Goblin");
  if (stats.doorsOpened >= 4 && stats.enemiesKilled <= 1) c.push("Door Enthusiast");
  if (stats.enemiesKilled >= 2 && stats.enemiesKilled >= stats.chestsOpened) c.push("Murder Hobo Intern");
  if (safeSeconds > outsideSeconds && outsideSeconds > 10) c.push("Strategic Coward");
  if (stats.missedAttacks >= 5) c.push("Air Boxer");
  if (stats.wallBumps >= 12) c.push("Wall Conversationalist");
  if (stats.damageTaken >= 24 && stats.enemiesKilled >= 1) c.push("Damage Sponge");
  if (audienceScore >= 35 && stats.riskyMoments >= 3) c.push("Ratings Goblin");
  currentReputation = c[0] || "Undeclared Menace";
  return currentReputation;
}

function getReputationComment(rep) {
  return {
    "Dungeon Tourist": "You are sightseeing under conditions most travel agents would describe as legally indefensible.",
    "Loot Goblin": "You prioritize treasure over safety, dignity, and basic pattern recognition.",
    "Door Enthusiast": "You have formed a suspicious emotional attachment to doors.",
    "Murder Hobo Intern": "You are not yet a full murder hobo, but your resume has promise.",
    "Strategic Coward": "Cowardice is such an ugly word. We prefer 'resource-conserving mammal.'",
    "Air Boxer": "Your rivalry with empty space continues to define your brand.",
    "Wall Conversationalist": "The walls know your face better than your allies do.",
    "Damage Sponge": "You absorb punishment with the confidence of someone who has misunderstood the assignment.",
    "Ratings Goblin": "You are becoming entertaining in the worst possible way.",
    "Undeclared Menace": "Your brand remains unclear. Try committing to a bit before you die."
  }[rep] || "Your brand remains unclear. Try committing to a bit before you die.";
}

