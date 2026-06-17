(function(){
  const PET_HALLWAY_RADIUS=2;
  const PET_MAX_SHARED_VISION=TILE*9;
  function inBounds(x,y){return x>=0&&y>=0&&x<MAP_COLS&&y<MAP_ROWS}
  function entTile(e){return{x:Math.max(0,Math.min(MAP_COLS-1,Math.floor(Number(e?.x||0)/TILE))),y:Math.max(0,Math.min(MAP_ROWS-1,Math.floor(Number(e?.y||0)/TILE)))}}
  function entRoom(e){if(typeof roomForTile!=='function')return null;const t=entTile(e);return roomForTile(t.x,t.y)}
  function same(a,b){return !!a&&!!b&&a.id===b.id}
  function activePet(){const p=typeof getActivePet==='function'?getActivePet():null;return p&&p.hp>0?p:null}
  function petInRoom(room){const pet=activePet();return !!(pet&&same(entRoom(pet),room))}
  function revealRunning(room){return !!(room&&typeof roomRevealState!=='undefined'&&roomRevealState&&roomRevealState.roomId===room.id&&roomRevealState.complete!==true)}
  function canSharePetVision(pet){
    if(!pet||typeof hasLineOfSight!=='function')return false;
    if(Math.hypot(pet.x-player.x,pet.y-player.y)>PET_MAX_SHARED_VISION)return false;
    return hasLineOfSight(player.x,player.y,pet.x,pet.y);
  }
  function markVisible(x,y){
    if(!inBounds(x,y)||!map?.[y])return false;
    const tile=map[y][x];
    if(tile==='#')return false;
    let changed=false;
    if(!seen[y]?.[x]){seen[y][x]=true;changed=true}
    if(!visible[y]?.[x]){visible[y][x]=true;changed=true}
    return changed;
  }
  function revealPetHallwayVision(){
    if(!Array.isArray(visible)||typeof roomForTile!=='function')return;
    const pet=activePet();
    if(!canSharePetVision(pet))return;
    const playerRoom=entRoom(player);
    const petRoom=entRoom(pet);

    // Room reveal already has its own dissipating wave. This fix is for hallways and door approaches.
    if(playerRoom&&petRoom&&!same(playerRoom,petRoom))return;
    if(playerRoom&&petRoom&&same(playerRoom,petRoom))return;

    const origin=entTile(pet);
    let changed=false;
    for(let y=origin.y-PET_HALLWAY_RADIUS;y<=origin.y+PET_HALLWAY_RADIUS;y++){
      for(let x=origin.x-PET_HALLWAY_RADIUS;x<=origin.x+PET_HALLWAY_RADIUS;x++){
        if(!inBounds(x,y))continue;
        if(Math.hypot(x-origin.x,y-origin.y)>PET_HALLWAY_RADIUS)continue;
        const cx=x*TILE+TILE/2,cy=y*TILE+TILE/2;
        if(typeof hasLineOfSight==='function'&&!hasLineOfSight(pet.x,pet.y,cx,cy))continue;
        if(markVisible(x,y))changed=true;
      }
    }
    if(markVisible(origin.x,origin.y))changed=true;
    if(changed){
      minimapDirty=true;
      if(typeof discoverStairwellIfVisible==='function')discoverStairwellIfVisible();
    }
  }
  function trimPetReveal(){
    if(!Array.isArray(visible)||typeof roomForTile!=='function'||typeof forEachRoomTile!=='function')return;
    const px=Math.floor(player.x/TILE),py=Math.floor(player.y/TILE),room=roomForTile(px,py);
    if(!revealRunning(room)||!petInRoom(room))return;
    const elapsed=Math.max(0,frameCount-roomRevealState.startFrame);
    const progress=Math.min(1,elapsed/28);
    const radius=1.5+roomRevealState.maxDist*progress;
    let changed=false;
    forEachRoomTile(room,(x,y)=>{if(!inBounds(x,y))return;const d=Math.hypot(x-roomRevealState.originX,y-roomRevealState.originY);if(d>radius&&visible[y]?.[x]){visible[y][x]=false;changed=true}});
    if(changed)minimapDirty=true;
  }
  const base=typeof updateVisibility==='function'?updateVisibility:null;
  if(base&&!base.__petRevealFixed){updateVisibility=function(force=false){base(force);revealPetHallwayVision();trimPetReveal()};updateVisibility.__petRevealFixed=true}
})();
