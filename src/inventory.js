const SLOT_LABELS={weapon:"Weapon",head:"Head",chest:"Body / Armor",offhand:"Offhand / Shield",legs:"Legs",feet:"Feet",accessory:"Trinket",light:"Light",pet:"Pet"};
const INVENTORY_CATEGORIES={gear:"Gear",items:"Consumables / Items",lootboxes:"Loot Boxes",skills:"Skills"};
let activeInventoryCategory="gear";
let selectedInventoryItemId=null;
let selectedEquipmentSlot=null;
const ITEM_BASES={head:["Helmet","Cap","Crown","Hood"],chest:["Vest","Tunic","Breastplate","Jacket"],legs:["Pants","Greaves","Shorts","Trousers"],feet:["Boots","Sandals","Crocs","Footwraps"],accessory:["Ring","Charm","Badge","Pendant"]};
const ITEM_PREFIXES=["Goblin","Rat-hide","Bone","Rusty","Lucky","Crawler","Moldy","Questionable","Royal","Screaming"];
const WEAPON_PREFIXES=["Notched","Goblin-Forged","Bone","Rusted","Whispering","Crawler","Mold-Blessed","Royal","Arena-Worn","Blood-Marked"];
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
function generateWeapon(forceRare=false, forcedWeaponId=null){
 const weaponId=forcedWeaponId&&WEAPON_DEFINITIONS[forcedWeaponId]&&forcedWeaponId!=="fists"?forcedWeaponId:choose(LOOTABLE_WEAPON_IDS);
 const base=WEAPON_DEFINITIONS[weaponId],rarity=rollRarity(forceRare),p=rarityPower(rarity);
 const damage=base.damage+Math.max(1,p*3)+Math.floor(Math.random()*(p+2));
 const range=base.range+(weaponId==="bow"?p*14:p*4);
 const cooldown=Math.max(10,base.cooldown-Math.floor(p*1.5));
 return{id:makeId("weapon"),type:"weapon",slot:"weapon",weaponId,rarity,name:`${rarity} ${choose(WEAPON_PREFIXES)} ${base.name}`,damage,range,cooldown,attackShape:{...base.attackShape},telegraphColor:base.telegraphColor};
}
function generateTorchItem(){return{id:makeId("torch"),type:"light",slot:"light",rarity:"Common",name:"Crawler Torch",radius:isMobileLike()?142:164,intensity:.36};}
function hasEquippedLightSource(){return !!player.equipment?.light && player.equipment.light.type==="light";}
function itemDescription(i){if(!i)return""; if(i.type==="lootbox")return"Can only be opened in a safe room. Open it from the Loot Boxes tab when you reach safety."; if(i.type==="light")return"Equipped light source. Illuminates the crawler while carried."; if(i.type==="weapon")return`${i.damage} DMG · ${i.range} RNG · ${i.cooldown} CD`; let b=[]; if(i.hp)b.push(`+${i.hp} HP`); if(i.attack)b.push(`+${i.attack} ATK`); if(i.defense)b.push(`+${i.defense} DEF`); if(i.speed)b.push(`+${i.speed.toFixed(2)} SPD`); if(i.audience)b.push(`+${i.audience} Audience`); return b.join(" · ")||"Mostly decorative. The dungeon approves of pointless confidence.";}
function addItem(item){
 player.inventory.push(item);
 if(item.type==="lootbox"){stats.lootBoxesFound++; achievement("NEW LOOT BOX",`You found a ${item.name}. It can only be opened in a safe room.`,`box_${item.id}`);}
 else if(item.type==="light"){achievement("NEW LIGHT",`You found ${item.name}. ${itemDescription(item)}`,`light_${item.id}`);}
 else if(item.type==="weapon"){achievement("NEW WEAPON",`You found ${item.name}. ${itemDescription(item)}`,`weapon_${item.id}`);}
 else{stats.gearFound++; achievement("NEW GEAR",`You found ${item.name}. ${itemDescription(item)}`,`gear_${item.id}`);}
 updateInventoryUI(); updateHUD();
}
function moveInventorySelectionAfterRemoval(removedIndex, preferredCategory=activeInventoryCategory){
 const candidates=[...player.inventory].filter(item=>inventoryCategoryFor(item)===preferredCategory).sort((a,b)=>(rarityPower(b.rarity)-rarityPower(a.rarity))||String(a.type).localeCompare(String(b.type))||String(a.slot||"").localeCompare(String(b.slot||""))||String(a.name).localeCompare(String(b.name)));
 if(!candidates.length){selectedInventoryItemId=null;selectedEquipmentSlot=null;return;}
 const nextIndex=Math.min(Math.max(removedIndex,0),candidates.length-1);
 selectedInventoryItemId=candidates[nextIndex]?.id||candidates[candidates.length-1].id;
 selectedEquipmentSlot=null;
}
function equipItem(id){
 const idx=player.inventory.findIndex(i=>i.id===id); if(idx<0)return; const item=player.inventory[idx]; if(item.type!=="gear"&&item.type!=="light"&&item.type!=="weapon")return;
 const category=inventoryCategoryFor(item);
 const old=player.equipment[item.slot]; player.equipment[item.slot]=item; player.inventory.splice(idx,1); if(old)player.inventory.push(old);
 if(item.type==="weapon") player.currentWeaponId=item.weaponId;
 moveInventorySelectionAfterRemoval(idx, category);
 recalcEquipmentStats(); achievement("EQUIPPED",`You equipped ${item.name}. ${itemDescription(item)}`,`equip_${item.id}`); updateInventoryUI(); updateHUD(); visibilityDirty=true;
}
function unequipItem(slot, announce=true){
 if(!Object.prototype.hasOwnProperty.call(player.equipment,slot))return;
 const item=player.equipment[slot]; if(!item)return;
 player.equipment[slot]=null; player.inventory.push(item);
 if(slot==="weapon") player.currentWeaponId="fists";
 recalcEquipmentStats(); if(announce) announcer(`You unequipped ${item.name}. ${item.type==="light"?"The crawler is now relying on dungeon ambience and questionable courage.":item.type==="weapon"?"Your fists are now back on the payroll.":"It returns to your pack."}`); updateInventoryUI(); updateHUD(); visibilityDirty=true;
}
function openLootBox(id){
 const idx=player.inventory.findIndex(i=>i.id===id); if(idx<0)return; const box=player.inventory[idx]; if(box.type!=="lootbox")return;
 if(!player.safe){announcer("Loot boxes may only be opened in safe rooms. The dungeon believes in responsible dopamine distribution.");return;}
 const category=inventoryCategoryFor(box);
 player.inventory.splice(idx,1); stats.lootBoxesOpened++; const coins=8+Math.floor(Math.random()*16)+rarityPower(box.rarity)*6; player.coins+=coins;
 const gear=generateGear(box.rarity==="Rare"||box.rarity==="Epic"); player.inventory.push(gear); stats.gearFound++;
 moveInventorySelectionAfterRemoval(idx, category);
 achievement("LOOT BOX OPENED",`You opened ${box.name} and received ${coins} coins and ${gear.name}. Pants-based civilization remains possible.`,`open_${box.id}`);
 if(!achievements.has("firstLootBoxOpen"))achievement("NEW ACHIEVEMENT: Delayed Gratification","You waited until a safe room to open a box. Somewhere, an impulse-control researcher just shed a single tear.","firstLootBoxOpen");
 updateInventoryUI(); updateHUD();
}
function discardItem(id){const idx=player.inventory.findIndex(i=>i.id===id); if(idx<0)return; const category=inventoryCategoryFor(player.inventory[idx]); const [item]=player.inventory.splice(idx,1); moveInventorySelectionAfterRemoval(idx, category); announcer(`You dropped ${item.name}. The dungeon has sold it to someone with lower standards.`); updateInventoryUI(); updateHUD();}
function dropEquippedItem(slot){if(!Object.prototype.hasOwnProperty.call(player.equipment,slot))return; const item=player.equipment[slot]; if(!item)return; player.equipment[slot]=null; if(slot==="weapon")player.currentWeaponId="fists"; recalcEquipmentStats(); announcer(`You dropped ${item.name}. A future archaeologist will misinterpret this as a ritual.`); updateInventoryUI(); updateHUD(); visibilityDirty=true;}
function recalcEquipmentStats(){
 let hp=0,atk=0,spd=0,def=0,aud=0; for(const [slot,item] of Object.entries(player.equipment)){if(!item||item.type==="light"||slot==="pet")continue; hp+=item.hp||0; atk+=item.attack||0; spd+=item.speed||0; def+=item.defense||0; aud+=item.audience||0;}
 const progressionHp=typeof getProgressionMaxHpBonus==="function"?getProgressionMaxHpBonus():0;
 const speedMultiplier=typeof getProgressionSpeedMultiplier==="function"?getProgressionSpeedMultiplier():1;
 const old=player.maxHp; player.maxHp=100+(player.level-1)*14+hp+progressionHp; player.attackDamage=20+(player.level-1)*4+atk; player.speed=(player.baseSpeed+spd)*speedMultiplier; player.defense=def; player.audienceBonus=aud; if(player.maxHp>old)player.hp+=player.maxHp-old; player.hp=Math.min(player.hp,player.maxHp);
}
function lootBoxCount(){return player.inventory.filter(i=>i.type==="lootbox").length;}
function escapeHtml(value){return String(value).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));}
function shouldMoveInventoryFocusToActions() {
 return typeof gamepadState !== "undefined" && gamepadState.connected && inputState?.lastActiveInputMethod === "gamepad";
}
function focusSelectedInventoryAction() {
 const panel=document.getElementById("inventoryPanel");
 if(!panel||!shouldMoveInventoryFocusToActions())return;
 const action=panel.querySelector(".itemDetails .itemActions button");
 if(action&&typeof focusControllerWindowButton==="function")focusControllerWindowButton(action);
}
function setupInventoryActionHandlers(){
 const panel=document.getElementById("inventoryPanel");
 if(!panel||panel.dataset.actionsBound==="true")return;
 panel.dataset.actionsBound="true";
 panel.addEventListener("click",e=>{
  const tab=e.target.closest("button[data-inventory-category]");
  if(tab){setActiveInventoryCategory(tab.dataset.inventoryCategory);selectedInventoryItemId=null;selectedEquipmentSlot=null;updateInventoryUI();return;}
  const inventorySlot=e.target.closest("button[data-select-item-id]");
  if(inventorySlot){selectedInventoryItemId=inventorySlot.dataset.selectItemId;selectedEquipmentSlot=null;updateInventoryUI();focusSelectedInventoryAction();return;}
  const equipmentSlot=e.target.closest("button[data-select-slot]");
  if(equipmentSlot){selectedEquipmentSlot=equipmentSlot.dataset.selectSlot;selectedInventoryItemId=null;updateInventoryUI();focusSelectedInventoryAction();return;}
  const button=e.target.closest("button[data-action]");
  if(!button)return;
  if(button.dataset.action==="open-progression"){toggleProgressionPanel();return;}
  if(button.dataset.action==="unequip"&&button.dataset.slot){unequipItem(button.dataset.slot);selectedEquipmentSlot=null;return;}
  if(button.dataset.action==="drop-equipped"&&button.dataset.slot){dropEquippedItem(button.dataset.slot);selectedEquipmentSlot=null;return;}
  const id=button.dataset.itemId;
  if(!id)return;
  if(button.dataset.action==="equip"){equipItem(id);}
  if(button.dataset.action==="use"){if(player.safe)openLootBox(id);else announcer("This item cannot be used right now.");}
  if(button.dataset.action==="open"){openLootBox(id);}
  if(button.dataset.action==="drop"){discardItem(id);}
 });
}
function rarityClass(item){return `rarity${(item?.rarity||"Common").replace(/[^a-z0-9]/gi,"")}`;}
function typeClass(item){return `itemType${item?.type==="lootbox"?"LootBox":item?.type==="light"?"Light":item?.type==="weapon"?"Weapon":"Gear"}`;}
function slotIcon(item){
 if(!item)return "?";
 if(item.type&&PET_DEFINITIONS[item.type])return "🐾";
 if(item.type==="lootbox")return "⬡";
 if(item.type==="light")return "✦";
 if(item.type==="weapon")return {greatsword:"⚔",hammer:"◉",spear:"↗",bow:"弓"}[item.weaponId]||"⚔";
 return {head:"◠",chest:"▣",legs:"▥",feet:"⌞",accessory:"◇",pet:"🐾"}[item.slot]||"◆";
}
function inventoryCategoryFor(item){
 if(item.type==="lootbox")return"lootboxes";
 if(item.type==="gear"||item.type==="light"||item.type==="weapon")return"gear";
 return"items";
}
function setActiveInventoryCategory(category){
 activeInventoryCategory=Object.prototype.hasOwnProperty.call(INVENTORY_CATEGORIES,category)?category:"gear";
 return activeInventoryCategory;
}
function gearComparisonText(item){
 if(!item||!(item.type==="gear"||item.type==="light"||item.type==="weapon"))return"";
 const equipped=player.equipment?.[item.slot];
 if(!equipped)return"Compared: empty slot";
 if(item.type==="weapon")return `Compared: ${item.damage-(equipped.damage||0)>=0?"+":""}${item.damage-(equipped.damage||0)} DMG · ${item.range-(equipped.range||0)>=0?"+":""}${item.range-(equipped.range||0)} RNG · ${item.cooldown-(equipped.cooldown||0)<=0?"":"+"}${item.cooldown-(equipped.cooldown||0)} CD`;
 const parts=[];
 for(const [key,label] of [["hp","HP"],["attack","ATK"],["defense","DEF"],["speed","SPD"],["audience","AUD"]]){
  const diff=(item[key]||0)-(equipped[key]||0);
  if(diff)parts.push(`${diff>0?"+":""}${key==="speed"?diff.toFixed(2):diff} ${label}`);
 }
 return parts.length?`Compared: ${parts.join(" · ")}`:"Compared: no stat change";
}
function renderInventoryTabs(counts){return `<div class="inventoryTabs">${Object.entries(INVENTORY_CATEGORIES).map(([key,label])=>`<button class="inventoryTab ${activeInventoryCategory===key?"active":""}" type="button" data-inventory-category="${key}" aria-pressed="${activeInventoryCategory===key}">${escapeHtml(label)}${key!=="skills"?` <span>${counts[key]||0}</span>`:""}</button>`).join("")}</div>`;}

function renderProgressBar(value,max,label){
 const pct=Math.max(0,Math.min(100,(Number(value)||0)/Math.max(1,Number(max)||1)*100));
 return `<div class="skillProgress" aria-label="${escapeHtml(label)}"><span style="width:${pct.toFixed(1)}%"></span></div>`;
}
function renderProgressionInventoryView(){
 if(typeof initProgression==="function")initProgression({skipLoad:true});
 const attrs=Object.values(player.progression?.attributes||{});
 const skills=Object.values(player.progression?.skills||{});
 const attrRows=attrs.map(attr=>`<button class="attributeRow" type="button" data-progression-row="attribute-${escapeHtml(attr.id||attr.name)}" aria-label="${escapeHtml(attr.name)} ${attr.value}"><div><strong>${escapeHtml(attr.name)}</strong><small>${escapeHtml(attr.effect||attr.description||"")}</small></div><span>${attr.value}</span></button>`).join("");
 const skillRows=skills.map(skill=>{
  const attr=skill.linkedAttribute&&player.progression.attributes[skill.linkedAttribute]?.name;
  const bonus=[skill.category,attr].filter(Boolean).join(" · ");
  return `<button class="skillRow compact" type="button" data-skill-id="${escapeHtml(skill.id)}"><div class="skillRowText"><strong>${escapeHtml(skill.name)}</strong><span>${escapeHtml(bonus)}</span><small>${escapeHtml(skill.description)}</small></div><div class="skillLevel">Lv ${skill.level}</div>${renderProgressBar(skill.xp,skill.xpToNext,`${skill.name} XP progress`)}<em>${skill.xp} / ${skill.xpToNext}</em></button>`;
 }).join("");
 return `<div class="progressionInventory" role="region" aria-label="Skills and attributes"><div class="progressionSummary"><div><span>Crawler Level</span><strong>${player.level}</strong></div><div><span>Attribute Points</span><strong>${player.progression?.unspentAttributePoints||0}</strong></div><div class="summaryXp"><span>Next Level</span>${renderProgressBar(player.xp,player.xpToNext,"Crawler level progress")}<strong>${player.xp} / ${player.xpToNext}</strong></div></div><div class="progressionColumns"><section class="progressionSection attributesSection"><h4>Attributes</h4><div class="attributeGrid compact">${attrRows}</div></section><section class="progressionSection skillSection"><h4>Skills</h4><div class="skillList compact">${skillRows}</div></section></div><div class="progressionHelp">D-pad / left stick navigates · right stick scrolls · A / Enter selects · B / Escape backs out</div></div>`;
}

function equipmentSlotKeys(){return ["weapon","head","chest","legs","feet","accessory","light","pet"];}
function renderPaperDollSlot(slot){
 const item=player.equipment?.[slot];
 const selected=selectedEquipmentSlot===slot;
 return `<button class="paperSlot paperSlot-${escapeHtml(slot)} ${item?rarityClass(item):"empty"} ${item?typeClass(item):""} ${selected?"selected":""}" type="button" data-select-slot="${escapeHtml(slot)}" aria-pressed="${selected}"><span class="paperSlotLabel">${escapeHtml(SLOT_LABELS[slot]||slot)}</span><span class="paperSlotIcon">${item?slotIcon(item):"□"}</span><span class="paperSlotName">${item?escapeHtml(item.name):"Empty"}</span></button>`;
}
function renderCharacterPanel(){
 return `<div class="characterSheet"><div class="inventoryHeader compact"><div><div class="inventoryTitle">Crawler Sheet</div><div class="inventorySubTitle">Paper-doll equipment</div></div></div><div class="paperDoll"><div class="characterSilhouette"><div class="silHead"></div><div class="silTorso"></div><div class="silArm left"></div><div class="silArm right"></div><div class="silLeg left"></div><div class="silLeg right"></div></div>${equipmentSlotKeys().map(renderPaperDollSlot).join("")}</div><div class="characterStats"><div><span>Level</span><strong>${player.level}</strong></div><div><span>HP</span><strong>${Math.ceil(player.hp)}/${player.maxHp}</strong></div><div><span>ATK</span><strong>${player.attackDamage}</strong></div><div><span>DEF</span><strong>${player.defense}</strong></div><div><span>SPD</span><strong>${player.speed.toFixed(2)}</strong></div><div><span>AUD</span><strong>+${player.audienceBonus}</strong></div></div></div>`;
}
function renderInventorySlot(item,index){
 if(!item)return `<div class="lootSlot empty" aria-label="Empty inventory slot"><span>□</span></div>`;
 const selected=selectedInventoryItemId===item.id;
 return `<button class="lootSlot ${rarityClass(item)} ${typeClass(item)} ${selected?"selected":""}" type="button" data-select-item-id="${escapeHtml(item.id)}" aria-pressed="${selected}" title="${escapeHtml(item.name)}"><span class="lootIcon">${slotIcon(item)}</span><small>${escapeHtml(item.name)}</small></button>`;
}
function selectedInventoryItem(){return selectedInventoryItemId?player.inventory.find(i=>i.id===selectedInventoryItemId):null;}
function selectedEquippedItem(){return selectedEquipmentSlot?player.equipment?.[selectedEquipmentSlot]:null;}
function renderItemDetails(){
 const invItem=selectedInventoryItem(); const eqItem=selectedEquippedItem(); const item=invItem||eqItem;
 if(!item)return `<div class="itemDetails empty"><div class="detailTitle">Select Loot</div><div class="detailMeta">Choose an item slot or equipment slot to inspect stats and actions.</div></div>`;
 const isPet=!!PET_DEFINITIONS[item.type];
 const isGear=item.type==="gear"||item.type==="light"||item.type==="weapon";
 const actions=[];
 if(invItem&&isGear)actions.push(`<button class="itemBtn primary" type="button" data-action="equip" data-item-id="${escapeHtml(item.id)}">Equip</button>`);
 if(eqItem&&!isPet)actions.push(`<button class="itemBtn" type="button" data-action="unequip" data-slot="${escapeHtml(selectedEquipmentSlot)}">Unequip</button>`);
 if(invItem&&item.type==="lootbox")actions.push(`<button class="itemBtn primary" type="button" data-action="open" data-item-id="${escapeHtml(item.id)}">Open</button>`);
 if(invItem&&!isGear&&item.type!=="lootbox")actions.push(`<button class="itemBtn" type="button" data-action="use" data-item-id="${escapeHtml(item.id)}">Use</button>`);
 if(!isPet)actions.push(eqItem?`<button class="itemBtn danger" type="button" data-action="drop-equipped" data-slot="${escapeHtml(selectedEquipmentSlot)}">Drop</button>`:`<button class="itemBtn danger" type="button" data-action="drop" data-item-id="${escapeHtml(item.id)}">Drop</button>`);
 return `<div class="itemDetails ${rarityClass(item)}"><div class="detailTitle">${escapeHtml(item.name)}</div><div class="detailMeta">${escapeHtml(isPet?`Lv ${item.level} Companion`:item.rarity||"Common")} · ${escapeHtml(isGear?(SLOT_LABELS[item.slot]||item.slot):isPet?"Pet Slot":"Inventory Item")}</div><div class="detailStats">${escapeHtml(isPet?`HP ${Math.ceil(item.hp)}/${item.maxHp} · DMG ${item.damage} · XP ${item.xp}/${item.xpToNext}`:itemDescription(item))}</div><div class="detailCompare">${escapeHtml(isGear?gearComparisonText(item):isPet?"Run-scoped companion; resets on death, new run, or refresh.":"No equipped comparison")}</div><div class="itemActions">${actions.join("")}</div></div>`;
}
function updateInventoryUI(){
 const panel=document.getElementById("inventoryPanel"); if(!panel)return; const eq=document.getElementById("equipmentStats"),list=document.getElementById("inventoryList");
 setupInventoryActionHandlers();
 const counts={gear:0,items:0,lootboxes:0,skills:0}; for(const item of player.inventory)counts[inventoryCategoryFor(item)]++;
 setActiveInventoryCategory(activeInventoryCategory);
 if(activeInventoryCategory==="skills"){
  selectedInventoryItemId=null;
  selectedEquipmentSlot=null;
  eq.innerHTML=renderCharacterPanel();
  list.innerHTML=`${renderInventoryTabs(counts)}<div class="inventoryContentTitle">Skills / Attributes</div>${renderProgressionInventoryView()}`;
  return;
 }
 let sorted=[...player.inventory].filter(item=>inventoryCategoryFor(item)===activeInventoryCategory).sort((a,b)=>(rarityPower(b.rarity)-rarityPower(a.rarity))||String(a.type).localeCompare(String(b.type))||String(a.slot||"").localeCompare(String(b.slot||""))||String(a.name).localeCompare(String(b.name)));
 if(selectedInventoryItemId&&!sorted.some(i=>i.id===selectedInventoryItemId)){selectedInventoryItemId=null;}
 const slots=[...sorted]; while(slots.length<30)slots.push(null);
 eq.innerHTML=renderCharacterPanel();
 list.innerHTML=`${renderInventoryTabs(counts)}<div class="inventoryContentTitle">${escapeHtml(INVENTORY_CATEGORIES[activeInventoryCategory])}</div><div class="lootGrid" role="grid">${slots.map(renderInventorySlot).join("")}</div>${renderItemDetails()}`;
}
function setInventoryOpenState(open){document.body.classList.toggle("inventoryOpen",!!open);}
function toggleInventoryPanel(){const p=document.getElementById("inventoryPanel"),l=document.getElementById("logPanel"),r=document.getElementById("safeRoomRecap"); if(!p)return; if(p.classList.contains("open")){p.classList.remove("open");p.style.display="";setInventoryOpenState(false); if(document.activeElement&&p.contains(document.activeElement))document.activeElement.blur(); return;} if(l)l.style.display="none"; if(r)r.style.display="none"; updateInventoryUI(); p.style.display=""; p.classList.add("open"); setInventoryOpenState(true); if(typeof syncControllerWindowFocus==="function")syncControllerWindowFocus();}
function closeInventoryPanel(){const p=document.getElementById("inventoryPanel"); if(p){p.classList.remove("open");p.style.display="";setInventoryOpenState(false); if(document.activeElement&&p.contains(document.activeElement))document.activeElement.blur();}}
function rewardChestLoot(room=null){
 const themeId=room?.themeId;
 if(themeId==="armory"){
  addItem(Math.random()<.68?generateWeapon(true):generateGear(true));
  achievement("ARMORY CACHE", "The Armory coughs up equipment. Open inventory to equip better gear before the next bad idea.", `armory_cache_${Date.now()}_${Math.random()}`);
  updateInventoryUI(); updateHUD();
  return;
 }
 if(themeId==="supplyCloset"){
  if(Math.random()<.55)addItem(generateGear()); else addItem(generateLootBox());
  achievement("SUPPLY CLOSET LOOT", "Starter supplies acquired. Press I or the INV button to inspect anything wearable.", `supply_cache_${Date.now()}_${Math.random()}`);
  updateInventoryUI(); updateHUD();
  return;
 }
 if(themeId==="storageRoom"&&Math.random()<.45){addItem(generateLootBox()); updateInventoryUI(); updateHUD(); return;}
 const roll=Math.random();
 if(roll<.42){const gained=5+Math.floor(Math.random()*12); player.coins+=gained; addPlayerFeedbackText(`+${gained} gold`, { color: "#ffd86b", size: 15 }); achievement("CHEST LOOT",`You found ${gained} coins. The dungeon reminds you that wealth is not a personality, but it helps.`,`coins_${Date.now()}_${Math.random()}`);}
 else if(roll<.68)addItem(generateLootBox());
 else if(roll<.78)addItem(generateTorchItem());
 else if(roll<.88)addItem(generateWeapon());
 else addItem(generateGear());
 if(!achievements.has("firstWearableLoot")&&stats.gearFound>0)achievement("NEW ACHIEVEMENT: Pants Adjacent","You found wearable equipment. Whether this improves your dignity remains under review.","firstWearableLoot");
 updateInventoryUI(); updateHUD();
}

function gainXP(amount, options = {}) {
  player.xp += amount;
  if (!options.silent) addPlayerFeedbackText(`+${amount} XP`, { color: "#7cf7ff", size: 15, offsetY: -38 });

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
  addPlayerFeedbackText(`LEVEL ${player.level}!`, { color: "#b6ff7c", size: 18, life: 72, offsetY: -54 });
  achievement("CRAWLER LEVEL INCREASED", `Crawler Level Increased: ${player.level}`, `level${player.level}`);
  if (player.progression) player.progression.unspentAttributePoints = (player.progression.unspentAttributePoints || 0) + 1;
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

function renderProgressionPanel() {
 const panel=document.getElementById("progressionPanel"); if(!panel)return;
 if(typeof initProgression==="function")initProgression({skipLoad:true});
 const attrs=Object.values(player.progression?.attributes||{});
 const skills=Object.values(player.progression?.skills||{});
 const skillRows=skills.map(skill=>{
  const pct=Math.max(0,Math.min(100,(skill.xp/Math.max(1,skill.xpToNext))*100));
  const attr=skill.linkedAttribute&&player.progression.attributes[skill.linkedAttribute]?.name;
  return `<button class="skillRow" type="button" data-skill-id="${escapeHtml(skill.id)}"><div><strong>${escapeHtml(skill.name)}</strong><span>${escapeHtml(skill.category)}${attr?` · ${escapeHtml(attr)}`:""}</span><small>${escapeHtml(skill.description)}</small></div><div class="skillLevel">Lv ${skill.level}</div><div class="skillProgress" aria-label="${escapeHtml(skill.name)} progress"><span style="width:${pct.toFixed(1)}%"></span></div><em>${skill.xp} / ${skill.xpToNext}</em></button>`;
 }).join("");
 const attrRows=attrs.map(attr=>`<div class="attributeCard"><div><strong>${escapeHtml(attr.name)}</strong><span>${attr.value}</span></div><p>${escapeHtml(attr.description)}</p><small>${escapeHtml(attr.effect)}</small></div>`).join("");
 panel.innerHTML=`<button id="closeProgressionBtn" class="panelClose" type="button" aria-label="Close skills">×</button><h3>Skills / Attributes</h3><div class="progressionHero"><div><span>Crawler Level</span><strong>${player.level}</strong></div><div><span>Progress XP</span><strong>${player.xp} / ${player.xpToNext}</strong></div><div><span>Attribute Points</span><strong>${player.progression?.unspentAttributePoints||0}</strong></div></div><section class="progressionSection"><h4>Attributes</h4><div class="attributeGrid">${attrRows}</div></section><section class="progressionSection skillSection"><h4>Skills</h4><div class="skillList">${skillRows}</div></section><div class="progressionHelp">D-pad / left stick navigates · right stick scrolls · A / Enter selects · B / Escape backs out</div>`;
 document.getElementById("closeProgressionBtn")?.addEventListener("click",closeProgressionPanel);
}
function toggleProgressionPanel(){activeInventoryCategory="skills"; const p=document.getElementById("inventoryPanel"); if(!p?.classList.contains("open"))toggleInventoryPanel(); else updateInventoryUI(); if(typeof syncControllerWindowFocus==="function")syncControllerWindowFocus();}
function closeProgressionPanel(){const p=document.getElementById("progressionPanel"); if(p){p.classList.remove("open");p.style.display="";document.body.classList.remove("progressionOpen"); if(document.activeElement&&p.contains(document.activeElement))document.activeElement.blur();}}
