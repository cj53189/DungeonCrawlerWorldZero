(function(){
  function entTile(e){return{x:Math.max(0,Math.min(MAP_COLS-1,Math.floor(Number(e?.x||0)/TILE))),y:Math.max(0,Math.min(MAP_ROWS-1,Math.floor(Number(e?.y||0)/TILE)))}}
  function entRoom(e){if(typeof roomForTile!=='function')return null;const t=entTile(e);return roomForTile(t.x,t.y)}
  function same(a,b){return !!a&&!!b&&a.id===b.id}
  function petInRoom(room){const pet=typeof getActivePet==='function'?getActivePet():null;return !!(pet&&pet.hp>0&&same(entRoom(pet),room))}
  function revealRunning(room){return !!(room&&typeof roomRevealState!=='undefined'&&roomRevealState&&roomRevealState.roomId===room.id&&roomRevealState.complete!==true)}
  function trimPetReveal(){
    if(!Array.isArray(visible)||typeof roomForTile!=='function'||typeof forEachRoomTile!=='function')return;
    const px=Math.floor(player.x/TILE),py=Math.floor(player.y/TILE),room=roomForTile(px,py);
    if(!revealRunning(room)||!petInRoom(room))return;
    const elapsed=Math.max(0,frameCount-roomRevealState.startFrame);
    const progress=Math.min(1,elapsed/28);
    const radius=1.5+roomRevealState.maxDist*progress;
    let changed=false;
    forEachRoomTile(room,(x,y)=>{if(x<0||y<0||x>=MAP_COLS||y>=MAP_ROWS)return;const d=Math.hypot(x-roomRevealState.originX,y-roomRevealState.originY);if(d>radius&&visible[y]?.[x]){visible[y][x]=false;changed=true}});
    if(changed)minimapDirty=true;
  }
  const base=typeof updateVisibility==='function'?updateVisibility:null;
  if(base&&!base.__petRevealFixed){updateVisibility=function(force=false){base(force);trimPetReveal()};updateVisibility.__petRevealFixed=true}
})();
