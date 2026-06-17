(function installUiLayoutGuard(){
  const KEY="dcw.uiLayout.v1";
  const CONFIRM_MS=1600;
  function layout(){try{return JSON.parse(localStorage.getItem(KEY)||"{}");}catch{return {};}}
  function write(v){try{localStorage.setItem(KEY,JSON.stringify(v));}catch{}}
  function edit(){return document.body.classList.contains("uiEditMode") || (typeof uiEditMode!=="undefined" && !!uiEditMode);}
  function saveHidden(el, hidden){
    const key=el?.dataset?.uiLayoutKey; if(!key)return;
    const r=el.getBoundingClientRect(); const l=layout();
    l[key]={...(l[key]||{}),left:Math.round(r.left||l[key]?.left||0),top:Math.round(r.top||l[key]?.top||0),width:Math.round(r.width||l[key]?.width||0),height:Math.round(r.height||l[key]?.height||0),hidden:!!hidden};
    write(l);
  }
  function reset(icon){
    if(!icon || icon.classList.contains("restore"))return;
    icon.classList.remove("confirm"); icon.textContent="🗑";
    icon.title=icon.dataset.normalTitle||icon.title||"Hide UI"; icon.setAttribute("aria-label",icon.title);
    icon.dataset.confirmUntil="0";
  }
  function arm(icon,label){
    icon.dataset.confirmUntil=String(Date.now()+CONFIRM_MS);
    icon.dataset.normalTitle=icon.dataset.normalTitle||icon.title||`Hide ${label}`;
    icon.classList.add("confirm"); icon.textContent="?";
    icon.title=`Tap again to hide ${label}`; icon.setAttribute("aria-label",icon.title);
    clearTimeout(icon.__confirmTimer); icon.__confirmTimer=setTimeout(()=>reset(icon),CONFIRM_MS);
  }
  function onClick(e){
    const icon=e.target.closest?.(".uiDeleteIcon"); if(!icon || !edit())return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
    const el=icon.closest(".uiLayoutTarget"); if(!el || icon.classList.contains("protected"))return;
    const label=el.dataset.uiLabel||el.dataset.uiLayoutKey||"UI";
    if(el.classList.contains("uiLayoutDeleted")){
      el.classList.remove("uiLayoutDeleted"); el.setAttribute("data-ui-hidden","false");
      icon.classList.remove("restore","confirm"); icon.textContent="🗑"; icon.title=`Hide ${label}`; icon.setAttribute("aria-label",icon.title);
      saveHidden(el,false); return;
    }
    if(Date.now()<Number(icon.dataset.confirmUntil||0)){
      el.classList.add("uiLayoutDeleted"); el.setAttribute("data-ui-hidden","true");
      icon.classList.remove("confirm"); icon.classList.add("restore"); icon.textContent="↺"; icon.title=`Restore ${label}`; icon.setAttribute("aria-label",icon.title);
      saveHidden(el,true); return;
    }
    arm(icon,label);
  }
  function css(){
    if(document.getElementById("uiLayoutGuardStyles"))return;
    const s=document.createElement("style"); s.id="uiLayoutGuardStyles"; s.textContent=`
      body.uiEditMode #touchControls{display:block!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;transition:none!important;}
      body.uiEditMode #touchControls .uiLayoutTarget,body.uiEditMode #hud,body.uiEditMode #announcer,body.uiEditMode #prompt,body.uiEditMode #testerDebugLine,body.uiEditMode #multiplayerPanel,body.uiEditMode #mpOpenPanelBtn,body.uiEditMode #safeRoomRecap,body.uiEditMode #logPanel,body.uiEditMode #inventoryPanel{pointer-events:auto!important;}
      body.uiEditMode .uiLayoutTarget>.uiLayoutTools{left:0!important;right:0!important;top:-30px!important;width:100%!important;min-width:64px;justify-content:space-between!important;gap:0!important;pointer-events:none!important;}
      body.uiEditMode .uiLayoutTarget>.uiLayoutTools .uiLayoutTool{width:30px!important;height:30px!important;font-size:15px!important;pointer-events:auto!important;}
      body.uiEditMode .uiDeleteIcon.confirm{border-color:rgba(255,216,107,.95)!important;color:#ffd86b!important;background:rgba(70,45,8,.95)!important;}
    `; document.head.appendChild(s);
  }
  function install(){css(); document.addEventListener("pointerdown",e=>{if(e.target.closest?.(".uiDeleteIcon")&&edit()){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();}}, {capture:true,passive:false}); document.addEventListener("click",onClick,{capture:true});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true}); else install();
})();
