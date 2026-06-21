(function installDungeonWorkshop(){
  const STORAGE_KEY="dcw.devWorkshop.open";
  const PANEL_ID="devWorkshopPanel";
  const STYLE_ID="devWorkshopStyles";
  let panel=null;
  const log=[];

  function numberOr(value,fallback){
    const number=Number(value);
    return Number.isFinite(number)?number:fallback;
  }

  function escapeHtml(value){
    return String(value).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  }

  function writeLog(text){
    log.unshift({at:new Date().toLocaleTimeString(),text:String(text||"Workshop action")});
    log.splice(12);
    if(typeof announcer==="function") announcer(String(text||"Workshop action"));
    renderLog();
    renderStatus();
  }

  function injectStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .devWorkshopButton{border:1px solid rgba(255,216,107,.46);border-radius:10px;background:rgba(123,44,255,.22);color:#fff4cc;font-weight:900;min-height:38px;cursor:pointer}
      #${PANEL_ID}{position:fixed;right:max(12px,env(safe-area-inset-right));top:max(96px,env(safe-area-inset-top));z-index:160;width:min(430px,calc(100vw - 24px));max-height:min(78vh,720px);overflow:auto;padding:12px;border:1px solid rgba(255,216,107,.46);border-radius:14px;background:rgba(9,8,14,.95);color:#fff4cc;box-shadow:0 16px 48px rgba(0,0,0,.62);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #${PANEL_ID}[hidden]{display:none!important}
      #${PANEL_ID} header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
      #${PANEL_ID} h2{margin:0;font-size:18px;letter-spacing:.06em;text-transform:uppercase}
      #${PANEL_ID} .sub{color:#d8cfff;font-size:12px;line-height:1.35;margin-top:4px}
      #${PANEL_ID} .section{border-top:1px solid rgba(255,255,255,.12);padding-top:10px;margin-top:10px}
      #${PANEL_ID} .section h3{margin:0 0 8px;font-size:12px;color:#ffd86b;letter-spacing:.08em;text-transform:uppercase}
      #${PANEL_ID} .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      #${PANEL_ID} label{display:grid;gap:5px;font-size:11px;color:#d8cfff}
      #${PANEL_ID} input,#${PANEL_ID} textarea{width:100%;box-sizing:border-box;border:1px solid rgba(255,216,107,.32);border-radius:8px;background:rgba(255,255,255,.08);color:#fff4cc;padding:8px;font:inherit}
      #${PANEL_ID} textarea{min-height:100px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}
      #${PANEL_ID} button{border:1px solid rgba(255,216,107,.38);border-radius:9px;background:rgba(255,216,107,.12);color:#fff4cc;min-height:36px;padding:7px 9px;font-weight:900;cursor:pointer}
      #${PANEL_ID} .good{border-color:rgba(140,255,190,.38);color:#c8ffd9;background:rgba(70,255,140,.12)}
      #${PANEL_ID} .full{grid-column:1/-1}
      #${PANEL_ID} .status{font-size:11px;color:#d8cfff;display:grid;gap:3px}
      #${PANEL_ID} .log{display:grid;gap:5px;max-height:110px;overflow:auto;font-size:11px;color:#e9e1ff}
      #${PANEL_ID} .log div{border-left:2px solid rgba(255,216,107,.36);padding-left:7px}
      @media(max-width:700px),(max-height:560px){#${PANEL_ID}{left:8px;right:8px;top:8px;width:auto;max-height:calc(100vh - 16px)}#${PANEL_ID} .grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function removeLegacyWorkshopFab(){
    document.getElementById("devWorkshopFab")?.remove();
  }

  function roomInfo(){
    if(typeof roomForTile!=="function"||typeof player==="undefined"||typeof TILE==="undefined") return null;
    return roomForTile(Math.floor(player.x/TILE),Math.floor(player.y/TILE));
  }

  function exportState(){
    const room=roomInfo();
    return {
      generatedAt:new Date().toISOString(),
      mode:typeof gameMode!=="undefined"?gameMode:null,
      floor:typeof currentFloor!=="undefined"?currentFloor:null,
      room:room?{id:room.id,name:room.name,type:room.type,themeId:room.themeId}:null,
      player:typeof player!=="undefined"?{
        hp:player.hp,
        maxHp:player.maxHp,
        baseSpeed:player.baseSpeed,
        speed:player.speed,
        power:player.attackDamage,
        coins:player.coins,
        weapon:player.currentWeaponId
      }:null,
      floorTimeLeft:typeof floorTimeLeft!=="undefined"?floorTimeLeft:null,
      notes:log.slice()
    };
  }

  function applyTuning(){
    if(typeof player==="undefined") return;
    const speed=numberOr(document.getElementById("workshopSpeed")?.value,player.baseSpeed||player.speed||2.45);
    const maxHp=Math.max(1,Math.round(numberOr(document.getElementById("workshopMaxHp")?.value,player.maxHp||100)));
    const power=Math.max(0,Math.round(numberOr(document.getElementById("workshopPower")?.value,player.attackDamage||20)));
    const timer=Math.max(0,Math.round(numberOr(document.getElementById("workshopTimer")?.value,typeof floorTimeLeft!=="undefined"?floorTimeLeft:900)));
    if(typeof recalcEquipmentStats==="function") recalcEquipmentStats();
    player.baseSpeed=speed;
    player.speed=speed;
    player.maxHp=maxHp;
    player.hp=Math.min(Math.max(1,player.hp||maxHp),maxHp);
    player.attackDamage=power;
    if(typeof floorTimeLeft!=="undefined") floorTimeLeft=timer;
    if(typeof updateHUD==="function") updateHUD();
    writeLog("Workshop tuning applied.");
    syncControls();
  }

  function addCoins(){
    if(typeof player==="undefined") return;
    player.coins=(player.coins||0)+50;
    if(typeof updateHUD==="function") updateHUD();
    writeLog("Workshop added 50 coins.");
  }

  function restoreHp(){
    if(typeof player==="undefined") return;
    player.hp=player.maxHp;
    if(typeof updateHUD==="function") updateHUD();
    writeLog("Workshop restored crawler HP.");
  }

  function toggleTiles(){
    if(!window.DCWZKenneyTinyDungeon?.setEnabled){
      writeLog("Tiny Dungeon preview is not loaded yet.");
      return;
    }
    const enabled=window.DCWZKenneyTinyDungeon.setEnabled(!window.DCWZKenneyTinyDungeon.isEnabled());
    writeLog(`Tiny Dungeon preview ${enabled?"enabled":"disabled"}.`);
  }

  function regenerateRun(){
    if(typeof restartGame==="function") restartGame();
    else if(typeof resetState==="function") resetState();
    writeLog("Workshop regenerated the current run.");
    setTimeout(syncControls,60);
  }

  async function copyExport(asPrompt=false){
    const json=JSON.stringify(exportState(),null,2);
    const text=asPrompt?`Use this Dungeon Workshop export to make the tested values permanent where appropriate. Keep the change small and modular.\n\n${json}`:json;
    const box=document.getElementById("workshopExport");
    if(box) box.value=text;
    try{
      await navigator.clipboard.writeText(text);
      writeLog(asPrompt?"Workshop prompt copied.":"Workshop JSON copied.");
    }catch{
      writeLog("Workshop export generated. Copy it from the text box.");
    }
  }

  function renderStatus(){
    const el=document.getElementById("workshopStatus");
    if(!el) return;
    const room=roomInfo();
    el.innerHTML=`<span>Mode: ${escapeHtml(typeof gameMode!=="undefined"?gameMode:"unknown")} · Floor ${escapeHtml(typeof currentFloor!=="undefined"?currentFloor:"?")}</span><span>Room: ${escapeHtml(room?.name||"Unknown")} · Coins: ${escapeHtml(typeof player!=="undefined"?player.coins||0:0)}</span>`;
  }

  function renderLog(){
    const el=document.getElementById("workshopLog");
    if(!el) return;
    el.innerHTML=log.length?log.map(entry=>`<div><strong>${escapeHtml(entry.at)}</strong> ${escapeHtml(entry.text)}</div>`).join(""):`<div>No workshop actions yet.</div>`;
  }

  function syncControls(){
    if(!panel||typeof player==="undefined") return;
    const set=(id,value)=>{const el=document.getElementById(id);if(el) el.value=String(value);};
    set("workshopSpeed",Number(player.baseSpeed||player.speed||2.45).toFixed(2));
    set("workshopMaxHp",Math.round(player.maxHp||100));
    set("workshopPower",Math.round(player.attackDamage||20));
    set("workshopTimer",typeof floorTimeLeft!=="undefined"?Math.round(floorTimeLeft):900);
    renderStatus();
    renderLog();
  }

  function createPanel(){
    injectStyles();
    if(panel) return panel;
    panel=document.createElement("section");
    panel.id=PANEL_ID;
    panel.hidden=true;
    panel.innerHTML=`
      <header><div><h2>Dungeon Workshop</h2><div class="sub">Live knobs for testing. Tune in-game, then export the version that feels good.</div></div><button type="button" data-act="close">×</button></header>
      <div id="workshopStatus" class="status"></div>
      <section class="section"><h3>Live Tuning</h3><div class="grid">
        <label>Player Speed<input id="workshopSpeed" type="number" min="0.5" max="8" step="0.05"></label>
        <label>Max HP<input id="workshopMaxHp" type="number" min="1" max="999" step="1"></label>
        <label>Power<input id="workshopPower" type="number" min="0" max="999" step="1"></label>
        <label>Timer Seconds<input id="workshopTimer" type="number" min="0" max="3600" step="5"></label>
        <button class="good full" type="button" data-act="tune">Apply Tuning</button>
      </div></section>
      <section class="section"><h3>Run Tools</h3><div class="grid">
        <button type="button" data-act="coins">+50 Coins</button>
        <button type="button" data-act="hp">Restore HP</button>
        <button type="button" data-act="tiles">Toggle Tiny Tiles</button>
        <button type="button" data-act="regen">Regenerate Run</button>
      </div></section>
      <section class="section"><h3>Export</h3><div class="grid">
        <button type="button" data-act="export">Copy State JSON</button>
        <button type="button" data-act="prompt">Copy Prompt</button>
        <textarea id="workshopExport" class="full" spellcheck="false" placeholder="Workshop export appears here."></textarea>
      </div></section>
      <section class="section"><h3>Action Log</h3><div id="workshopLog" class="log"></div></section>`;
    panel.addEventListener("click",event=>{
      const button=event.target.closest("button[data-act]");
      if(!button) return;
      const action=button.dataset.act;
      if(action==="close") closeWorkshop();
      else if(action==="tune") applyTuning();
      else if(action==="coins") addCoins();
      else if(action==="hp") restoreHp();
      else if(action==="tiles") toggleTiles();
      else if(action==="regen") regenerateRun();
      else if(action==="export") copyExport(false);
      else if(action==="prompt") copyExport(true);
      renderStatus();
    });
    document.body.appendChild(panel);
    return panel;
  }

  function openWorkshop(){
    createPanel();
    panel.hidden=false;
    try{localStorage.setItem(STORAGE_KEY,"true");}catch{}
    syncControls();
  }

  function closeWorkshop(){
    if(panel) panel.hidden=true;
    try{localStorage.setItem(STORAGE_KEY,"false");}catch{}
  }

  function toggleWorkshop(){
    if(!panel||panel.hidden) openWorkshop();
    else closeWorkshop();
  }

  function installOpeners(){
    injectStyles();
    removeLegacyWorkshopFab();
    const danger=document.querySelector(".dangerSection");
    if(danger&&!document.getElementById("openDevWorkshopBtn")){
      const btn=document.createElement("button");
      btn.id="openDevWorkshopBtn";
      btn.className="settingsAction devWorkshopButton";
      btn.type="button";
      btn.textContent="Open Dungeon Workshop";
      btn.addEventListener("click",openWorkshop);
      danger.appendChild(btn);
    }
  }

  function shouldOpen(){
    const params=new URLSearchParams(window.location.search||"");
    if(/^(1|true|yes|on)$/i.test(String(params.get("workshop")||""))) return true;
    try{return localStorage.getItem(STORAGE_KEY)==="true";}catch{return false;}
  }

  document.addEventListener("keydown",event=>{
    if(!event.shiftKey||!(event.ctrlKey||event.metaKey)) return;
    if(event.key?.toLowerCase?.()!=="w") return;
    event.preventDefault();
    toggleWorkshop();
  });

  window.DCWZWorkshop=Object.freeze({open:openWorkshop,close:closeWorkshop,toggle:toggleWorkshop,exportState,applyTuning});

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>{installOpeners();if(shouldOpen()) openWorkshop();},{once:true});
  }else{
    installOpeners();
    if(shouldOpen()) openWorkshop();
  }
})();