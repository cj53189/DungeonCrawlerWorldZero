(function installUiLayoutDragFix(){
  const KEY="dcw.uiLayout.v1";
  let active=null;

  function edit(){return document.body.classList.contains("uiEditMode") || (typeof uiEditMode!=="undefined" && !!uiEditMode);}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||"{}");}catch{return {};}}
  function write(v){try{localStorage.setItem(KEY,JSON.stringify(v));}catch{}}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function save(el){
    const key=el?.dataset?.uiLayoutKey; if(!key)return;
    const r=el.getBoundingClientRect(); const layout=read();
    layout[key]={...(layout[key]||{}),left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height),hidden:el.classList.contains("uiLayoutDeleted")};
    write(layout);
  }
  function targetFromEvent(e){return e.target.closest?.(".uiLayoutTarget");}
  function shouldStartMove(e){
    if(e.target.closest?.(".uiDeleteIcon,.uiResizeHandle,input,select,textarea"))return false;
    if(e.target.closest?.(".uiMoveIcon"))return true;
    const target=targetFromEvent(e); if(!target)return false;
    return !!e.target.closest?.(".uiDragHandle,.hudTop,.panelTitle,.panelEyebrow,.minimapEditHeader,h1,h2,h3");
  }
  function start(e,type){
    if(!edit())return;
    const el=targetFromEvent(e); if(!el)return;
    if(type==="move" && !shouldStartMove(e))return;
    if(type==="resize" && !e.target.closest?.(".uiResizeHandle"))return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
    const r=el.getBoundingClientRect();
    active={el,type,id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,width:r.width,height:r.height,minW:Number(el.dataset.minW)||44,minH:Number(el.dataset.minH)||32};
    el.classList.add("uiLayoutDragging");
    try{e.target.setPointerCapture?.(e.pointerId);}catch{}
  }
  function move(e){
    if(!active || active.id!==e.pointerId)return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
    const el=active.el;
    if(active.type==="move"){
      const left=clamp(active.left+e.clientX-active.x,0,Math.max(0,window.innerWidth-40));
      const top=clamp(active.top+e.clientY-active.y,0,Math.max(0,window.innerHeight-32));
      el.style.left=`${left}px`; el.style.top=`${top}px`; el.style.right="auto"; el.style.bottom="auto"; el.style.inset="auto"; el.style.transform="none";
    }else{
      el.style.width=`${Math.max(active.minW,active.width+e.clientX-active.x)}px`;
      el.style.height=`${Math.max(active.minH,active.height+e.clientY-active.y)}px`;
    }
  }
  function end(e){
    if(!active || active.id!==e.pointerId)return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
    active.el.classList.remove("uiLayoutDragging");
    save(active.el);
    active=null;
  }
  function css(){
    if(document.getElementById("uiLayoutDragFixStyles"))return;
    const s=document.createElement("style"); s.id="uiLayoutDragFixStyles"; s.textContent=`
      body.uiEditMode .uiMoveIcon,body.uiEditMode .uiDragHandle{touch-action:none!important;}
      body.uiEditMode .uiLayoutDragging{outline:3px solid rgba(255,216,107,.95)!important;z-index:9999!important;}
      body.uiEditMode .uiLayoutTarget{min-width:20px;min-height:20px;}
    `; document.head.appendChild(s);
  }
  function install(){
    css();
    document.querySelectorAll(".uiLayoutTarget").forEach(el=>{if(el.dataset.minW==null)el.dataset.minW="44";if(el.dataset.minH==null)el.dataset.minH="32";});
    document.addEventListener("pointerdown",e=>start(e,"resize"),{capture:true,passive:false});
    document.addEventListener("pointerdown",e=>start(e,"move"),{capture:true,passive:false});
    document.addEventListener("pointermove",move,{capture:true,passive:false});
    document.addEventListener("pointerup",end,{capture:true,passive:false});
    document.addEventListener("pointercancel",end,{capture:true,passive:false});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
