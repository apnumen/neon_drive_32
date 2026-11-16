'use strict';
const $=id=>document.getElementById(id),canvas=$('world');
let ctx=canvas.getContext('2d');
let fadeCanvas,fadeCtx;
let backgroundLayer,fogLayer,palmLayer;
const playerFrames=new Map(),trafficFrames=new Map();
let W,H,dpr,t=0,last=0,mode='idle',lane=1,carLane=1,distance=0,speed=0,spawn=0,obstacles=[],muted=true,soundChosen=false,scenePaused=matchMedia('(prefers-reduced-motion: reduce)').matches;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');reduced.onchange=e=>scenePaused=e.matches;
function resize(){
 const width=Math.min(innerWidth,500),height=Math.round(canvas.getBoundingClientRect().height||innerHeight);
 const ratio=Math.min(devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.25:2);
 if(width===W&&height===H&&ratio===dpr)return;
 W=width;H=height;dpr=ratio;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 backgroundLayer=fogLayer=palmLayer=null;playerFrames.clear();trafficFrames.clear();
}addEventListener('resize',resize);resize();
function poly(points,fill,stroke,line=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke()}}
function line(x,y,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function glow(color,blur){ctx.shadowColor=color;ctx.shadowBlur=blur}function unglow(){ctx.shadowBlur=0}
const skyline=Array.from({length:62},(_,i)=>({x:i/61,h:20+((Math.sin(i*12.97)*43758.54)%1+1)%1*96,w:8+(i*17%19)}));
// Camera projection: all road-attached objects use the same world Z and travel.
const FAR=82,NEAR=3,PLAYER_Z=12;
const START_SPEED=14,MAX_SPEED=48,ACCELERATION=(MAX_SPEED-START_SPEED)/70,MAX_PACE=2.6;
function project(z,l=1){const p=10/z;return {x:W/2+(l-1)*W/3*p,y:H*.39+H*.35*p,p}}
// Symmetric optical placement, shared by the car and its ground glow.
function playerPose(){
 const p=project(PLAYER_Z,1+(carLane-1)*1.05);
 return {...p,s:p.p*W/700*.97};
}
function world(x,z){const q=project(z);return {x:W/2+x*W*q.p,y:q.y,p:q.p}}
function palm(x,y,s,flip){ctx.save();ctx.translate(x,y);ctx.scale(s*flip,s);poly([[-7,0],[3,0],[14,-95],[10,-171],[4,-173],[6,-95]],'#140f25');line(-4,0,9,-168,'#9f417c',1.5);for(let i=0;i<9;i++){const a=-Math.PI+.14+i*Math.PI/8;const dx=Math.cos(a)*83,dy=Math.sin(a)*43;poly([[8,-170],[dx*.48,-196+dy*.5],[dx,-171+dy],[dx*.6,-181+dy*.6]],i%2?'#28152f':'#1b1028','#743158',.65);for(let j=1;j<5;j++){const u=j/5;line(8+dx*u,-170+dy*u-13*Math.sin(u*Math.PI),8+dx*u+8,-158+dy*u,'#24122d',1)}}ctx.restore()}
// Fixed chase camera: translating the car across lanes changes its off-axis
// perspective, never the camera yaw or roll. Equal-depth crossbars stay level.
function carVertex(X,Y,Z,x,s,steering=0,depthRatio=1){
 const cameraOffset=(x-W/2)/Math.max(s,.001);
 const cameraDepth=600/Math.max(.05,depthRatio);
 const k=cameraDepth/(cameraDepth+Z);
 return [(X+cameraOffset+Z*steering)*k-cameraOffset,(-Y*.9-Z*.78*depthRatio)*k];
}
function car(x,y,s,color='#8c548d',player=false){
ctx.save();ctx.translate(x,y);ctx.scale(s,s);
const turn=player?(lane-carLane)*.065:0;
const depthRatio=player?1:s/(project(PLAYER_Z).p*W/700);
const distant=!player&&depthRatio<.38;
// Camera axes remain aligned with the straight road on all three lanes.
function v(X,Y,Z){return carVertex(X,Y,Z,x,s,turn,depthRatio)}
function face(vertices,fill,stroke='#3e9bb8',width=.8){poly(vertices.map(q=>v(...q)),fill,stroke,width)}
function edge(a,b,c='#63d8eb',w=1){line(...v(...a),...v(...b),c,w)}
function grad(stops){const g=ctx.createLinearGradient(-90,-100,90,-30);stops.forEach(([p,c])=>g.addColorStop(p,c));return g}
const body=player?grad([[0,'#186f91'],[.22,'#76d6e3'],[.44,'#7187ad'],[.64,'#55547c'],[.86,'#3aa5c5'],[1,'#174b75']]):grad([[0,color],[.5,'#8a91b0'],[1,color]]);
// Four cylindrical tyres. The lower arc extends below the rear valance;
// the outward-facing sidewall and rim appear from the adjacent lane.
function wheel(side,z){
 const inner=side*(z>100?64:74),outer=side*(z>100?86:97),cy=10,r=25;
 function ring(x,radius){return Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return [x,cy+Math.cos(a)*radius,z+Math.sin(a)*radius]})}
 const near=ring(outer,r),far=ring(inner,r);
 for(let i=0;i<24;i++){const j=(i+1)%24;face([far[i],near[i],near[j],far[j]],i%3===0?'#1b2331':'#0b101c','#101a29',.4)}
 face(near,'#0b101a','#3d526b',.9);
 // Only show the metal hub on the side facing the fixed camera.
 if(!distant&&(W/2-x)*side>1){
  face(ring(outer+side*.4,17),'#1c2a3c','#53657b',.8);
  face(ring(outer+side*.6,12),'#0a111e','#2b8199',.8);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5,rr=12;
   edge([outer+side*.8,cy,z],[outer+side*.8,cy+Math.cos(a)*rr,z+Math.sin(a)*rr],'#758a9e',1.7)}
  face(ring(outer+side,4),'#8293a6','#22364d',.5);
 }
}
for(const z of [175,20])for(const side of [-1,1])wheel(side,z);
// Continuous lower side panels attach both axles to the body.
for(const side of [-1,1])face([[side*88,34,0],[side*86,44,30],[side*80,43,201],[side*76,28,218],[side*76,3,218],[side*84,3,40],[side*88,5,0]],side===1?'#16374c':'#24556c','#39748a');
// Nose and front deck, then long quarter panels and raised cabin.
face([[-76,28,218],[76,28,218],[80,43,201],[-80,43,201]],'#295373');
face([[-80,43,201],[80,43,201],[58,65,154],[-58,65,154]],body);
face([[-88,34,0],[-86,44,30],[-80,43,201],[-58,65,154],[-62,74,105],[-71,48,25]],body,'#5dd8e9');
face([[88,34,0],[86,44,30],[80,43,201],[58,65,154],[62,74,105],[71,48,25]],'#214260','#4eb6d5');
face([[-58,65,154],[58,65,154],[57,76,126],[-57,76,126]],grad([[0,'#649db9'],[.5,'#b08cbb'],[1,'#568fb0']]),'#8ae5eb');
face([[-57,76,126],[57,76,126],[62,74,105],[-62,74,105]],'#7a8fae','#b8e0e9');
// Deep black rear glass, bordered by silver cyan pillars.
face([[-62,74,105],[62,74,105],[73,45,25],[-73,45,25]],'#081424','#6de8ee',1.5);
face([[-62,74,105],[-73,45,25],[-82,40,19],[-69,74,108]],'#5bbad2','#78d8e6');
face([[62,74,105],[73,45,25],[82,40,19],[69,74,108]],'#2a819f','#68d2e1');
// Preserve the same eight louvers at every depth: no brightness step at the LOD boundary.
for(let i=0;i<8;i++){const z=29+i*10,Y=45+(z-25)*29/80,wide=73-(z-25)*11/80;
face([[-wide,Y,z],[wide,Y,z],[wide-.6,Y+2,z+3],[-wide+.6,Y+2,z+3]],'#172d44','#4bb9cb',1);}
// Deck lip gives the rear a visible top plane above the lamp panel.
face([[-82,40,19],[82,40,19],[89,37,0],[-89,37,0]],body,'#78dce8');
face([[-89,37,0],[89,37,0],[92,16,-2],[83,5,-3],[-83,5,-3],[-92,16,-2]],grad([[0,'#385e7c'],[.45,'#182337'],[1,'#293d5b']]),'#406f8e');
face([[-85,33,-3],[85,33,-3],[87,19,-3],[-87,19,-3]],'#091320','#44667e');
const lamp=player?'#67f1ff':'#ff528f';glow(lamp,10);
face([[-82,31,-4],[-28,31,-4],[-28,21,-4],[-85,21,-4]],lamp,lamp);
face([[28,31,-4],[82,31,-4],[85,21,-4],[28,21,-4]],lamp,lamp);unglow();
for(let i=0;i<6;i++){edge([-80+i*9,31,-5],[-80+i*9,21,-5],player?'#248da9':'#9d3159',.7);edge([31+i*9,31,-5],[31+i*9,21,-5],player?'#248da9':'#9d3159',.7)}
edge([-84,26,-5],[-28,26,-5],'#a3f7ff44',.6);edge([28,26,-5],[84,26,-5],'#a3f7ff44',.6);
face([[-23,31,-6],[23,31,-6],[23,18,-6],[-23,18,-6]],'#111525','#4d728a');
face([[-15,29,-7],[15,29,-7],[15,20,-7],[-15,20,-7]],'#c5d4da','#8494a7',.5);
if(!distant){ctx.save();const label=v(0,23,-7),labelL=v(-15,23,-7),labelR=v(15,23,-7);
ctx.translate(label[0],label[1]);ctx.rotate(Math.atan2(labelR[1]-labelL[1],labelR[0]-labelL[0]));
ctx.fillStyle='#1b354d';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText(player?'A.P.':'NIGHT',0,2.5);ctx.restore();}
face([[-89,17,-5],[89,17,-5],[84,7,-6],[-84,7,-6]],'#101725','#3f536e');
edge([-84,7,-7],[84,7,-7],'#7b99aa',1.2);
for(const side of [-1,1]){face([[side*61,3,-7],[side*69,3,-7],[side*69,8,-7],[side*61,8,-7]],'#7d8a99','#182338');
// Mirrors and the thin body seam continue into the distance.
face([[side*75,51,125],[side*91,49,123],[side*92,44,118],[side*77,44,117]],'#276c8d','#68ccde');
edge([side*84,33,4],[side*77,34,193],'#397391',.8);}
glow('#3be5ff',9);edge([-88,37,0],[-80,43,201],'#59e4f2',1);edge([88,37,0],[80,43,201],'#59e4f2',1);unglow();
ctx.restore()}
// Fade the finished silhouette once, never its individual overlapping faces.
function fadeObject(draw,x,y,opacity){
 if(opacity>=.9999){draw();return}
 if(opacity<=0)return;
 if(!fadeCanvas){fadeCanvas=document.createElement('canvas');fadeCanvas.width=fadeCanvas.height=256;fadeCtx=fadeCanvas.getContext('2d')}
 const main=ctx,scale=Math.min(dpr,2);
 fadeCtx.setTransform(1,0,0,1,0,0);fadeCtx.clearRect(0,0,256,256);
 fadeCtx.setTransform(scale,0,0,scale,128-x*scale,220-y*scale);fadeCtx.globalAlpha=1;
 ctx=fadeCtx;try{draw()}finally{ctx=main}
 ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(fadeCanvas,x-128/scale,y-220/scale,256/scale,256/scale);ctx.restore();
}
// Smooth falloff to zero at the boundary; no solid oval footprint.
function lightPool(x,y,rx,ry,rgb,strength){
 if(rx<.5||ry<.5||strength<=0)return;
 ctx.save();ctx.globalCompositeOperation='screen';ctx.translate(x,y);ctx.scale(rx,ry);
 const g=ctx.createRadialGradient(0,0,0,0,0,1);
 g.addColorStop(0,`rgba(${rgb},${strength})`);g.addColorStop(.18,`rgba(${rgb},${strength*.72})`);g.addColorStop(.48,`rgba(${rgb},${strength*.28})`);g.addColorStop(.76,`rgba(${rgb},${strength*.06})`);g.addColorStop(1,`rgba(${rgb},0)`);
 ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
}
function drawPlayerGlow(){
 const p=playerPose(),s=p.s;
 lightPool(p.x,p.y+14*s,155*s,42*s,'255,40,90',.18);
}
function smoothFade(value){const v=Math.max(0,Math.min(1,value));return v*v*(3-2*v)}
function objectVisibility(z){
 // Both palms and traffic enter the same fog volume in world space.
 const entry=smoothFade((FAR-z)/18);
 const depthHaze=smoothFade((z-38)/(FAR-38));
 return entry*(1-.48*depthHaze);
}
function drawHorizonFog(){
 const horizon=H*.435,top=horizon-H*.075,bottom=horizon+H*.155;
 const veil=ctx.createLinearGradient(0,top,0,bottom);
 veil.addColorStop(0,'rgba(245,112,182,0)');
 veil.addColorStop(.2,'rgba(244,108,177,.16)');
 veil.addColorStop(.34,'rgba(250,121,186,.58)');
 veil.addColorStop(.44,'rgba(236,103,169,.64)');
 veil.addColorStop(.59,'rgba(204,74,146,.32)');
 veil.addColorStop(.78,'rgba(173,52,130,.10)');
 veil.addColorStop(1,'rgba(156,43,120,0)');
 ctx.fillStyle=veil;ctx.fillRect(0,top,W,bottom-top);
 // Opaque at the actual road start, feathered both into the sky and asphalt.
 const seamY=project(FAR).y,seam=ctx.createLinearGradient(0,seamY-H*.022,0,seamY+H*.055);
 seam.addColorStop(0,'rgba(232,111,173,0)');seam.addColorStop(.26,'rgba(232,111,173,.98)');seam.addColorStop(.34,'rgba(232,111,173,.98)');seam.addColorStop(.58,'rgba(232,111,173,.50)');seam.addColorStop(1,'rgba(232,111,173,0)');
 ctx.fillStyle=seam;ctx.fillRect(0,seamY-H*.022,W,H*.077);

 // A broad, softer glow carries the pink haze onto the road and shoulders.
 ctx.save();ctx.translate(W*.5,horizon+H*.012);ctx.scale(1,H*.14/(W*.78));
 const glow=ctx.createRadialGradient(0,0,0,0,0,W*.78);
 glow.addColorStop(0,'rgba(255,140,195,.16)');glow.addColorStop(.5,'rgba(237,92,178,.06)');glow.addColorStop(1,'rgba(237,92,178,0)');
 ctx.fillStyle=glow;ctx.fillRect(-W*.5,-W*.78,W,W*1.56);ctx.restore();
}
function paintBackground(){ctx.clearRect(0,0,W,H);const horizon=H*.435;let sky=ctx.createLinearGradient(0,0,0,H*.66);sky.addColorStop(0,'#0b0a25');sky.addColorStop(.4,'#281439');sky.addColorStop(.69,'#a33d70');sky.addColorStop(1,'#ed7286');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);ctx.fillStyle='#ebbedb';for(let i=0;i<48;i++){const x=((i*137.53)%100)/100*W,y=((i*71.13)%100)/100*H*.29;ctx.globalAlpha=.2+(i%4)*.15;ctx.fillRect(x,y,i%7===0?2:1,1)}ctx.globalAlpha=1;
const sunR=Math.min(W*.29,H*.15),sunY=H*.32;glow('#ff708e',55);const sg=ctx.createLinearGradient(0,sunY-sunR,0,sunY+sunR);sg.addColorStop(0,'#ffdd9b');sg.addColorStop(.48,'#ff916d');sg.addColorStop(1,'#ff3a94');ctx.fillStyle=sg;ctx.beginPath();ctx.arc(W/2,sunY,sunR,0,Math.PI*2);ctx.fill();unglow();ctx.save();ctx.beginPath();ctx.arc(W/2,sunY,sunR+1,0,Math.PI*2);ctx.clip();for(let i=0;i<9;i++){ctx.fillStyle='#6d285b';ctx.fillRect(W/2-sunR-2,sunY+i*sunR*.12,sunR*2+4,2+i*.85)}ctx.restore();
for(const b of skyline){const bh=b.h*H/850;ctx.fillStyle='#24132f';ctx.fillRect(b.x*W,horizon-bh,b.w*W/400,bh+8);ctx.fillStyle='#ee649955';for(let j=0;j<4;j++)ctx.fillRect(b.x*W+4,horizon-bh+8+j*12,2,3)}
}
function fullLayer(paint){const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;const main=ctx;ctx=layer.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);try{paint()}finally{ctx=main}return layer}
function drawPalmSprite(x,y,scale,side,opacity){
 if(!palmLayer){palmLayer=document.createElement('canvas');palmLayer.width=384;palmLayer.height=448;const main=ctx;ctx=palmLayer.getContext('2d');try{palm(192,430,2,1)}finally{ctx=main}}
 ctx.save();ctx.globalAlpha=opacity;ctx.translate(x,y);ctx.scale(side*scale/2,scale/2);ctx.drawImage(palmLayer,-192,-430);ctx.restore();
}
function drawPlayerSprite(p){
 const bin=Math.round(carLane*20),key=bin;
 if(!playerFrames.has(key)){
  const layer=document.createElement('canvas');const size=Math.ceil(256*dpr/1.25);layer.width=layer.height=size;
  const ax=size/2,ay=size*.86;
  const main=ctx,oldLane=carLane,oldTarget=lane;carLane=lane=bin/20;const q=playerPose();
  ctx=layer.getContext('2d');ctx.setTransform(dpr,0,0,dpr,ax-q.x*dpr,ay-q.y*dpr);
  try{playerPorsche(q.x,q.y,q.s)}finally{ctx=main;carLane=oldLane;lane=oldTarget}
  if(playerFrames.size>=24)playerFrames.delete(playerFrames.keys().next().value);
  playerFrames.set(key,{layer,ax,ay});
 }
 const sprite=playerFrames.get(key);ctx.drawImage(sprite.layer,p.x-sprite.ax/dpr,p.y-sprite.ay/dpr,sprite.layer.width/dpr,sprite.layer.height/dpr);
}
function drawTrafficSprite(p,ob,opacity){
 const ratio=PLAYER_Z/ob.z;
 if(ratio>1.5){car(p.x,p.y,p.p*W/700,ob.color);return}
 const band=Math.max(2,Math.round(ratio*16)),key=ob.lane+'|'+ob.color+'|'+band;
 if(!trafficFrames.has(key)){
  const q=project(PLAYER_Z/(band/16),ob.lane),layer=document.createElement('canvas'),size=Math.ceil(256*dpr/1.25),ax=size/2,ay=size*.86;
  layer.width=layer.height=size;const main=ctx;ctx=layer.getContext('2d');ctx.setTransform(dpr,0,0,dpr,ax-q.x*dpr,ay-q.y*dpr);
  try{car(q.x,q.y,q.p*W/700,ob.color)}finally{ctx=main}
  if(trafficFrames.size>=64)trafficFrames.delete(trafficFrames.keys().next().value);
  trafficFrames.set(key,{layer,ax,ay,projection:q.p});
 }
 const sprite=trafficFrames.get(key),scale=p.p/sprite.projection;
 ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(sprite.layer,p.x-sprite.ax/dpr*scale,p.y-sprite.ay/dpr*scale,sprite.layer.width/dpr*scale,sprite.layer.height/dpr*scale);ctx.restore();
}
function draw(){
 if(!backgroundLayer)backgroundLayer=fullLayer(paintBackground);
 ctx.drawImage(backgroundLayer,0,0,W,H);
 const horizon=H*.435;
ctx.fillStyle='#1b102b';ctx.fillRect(0,horizon,W,H-horizon);
const top=project(FAR),bottom=project(NEAR);
// Grid, lane markings and roadside palms are spaced in world metres.
for(let i=-8;i<=8;i++){const a=world(i*.34,FAR),b=world(i*.34,NEAR);line(a.x,a.y,b.x,b.y,'#a43a793d',1)}
for(let i=0;i<20;i++){const z=NEAR+((i*4-t)%80+80)%80,q=project(z);line(0,q.y,W,q.y,'#bc408944',Math.max(.5,q.p))}
const lt=world(-.5,FAR),rt=world(.5,FAR),lb=world(-.5,NEAR),rb=world(.5,NEAR);let asphalt=ctx.createLinearGradient(0,top.y,0,H);asphalt.addColorStop(0,'#6a294b');asphalt.addColorStop(.2,'#24132e');asphalt.addColorStop(1,'#0d1021');poly([[lt.x,lt.y],[rt.x,rt.y],[rb.x,rb.y],[lb.x,lb.y]],asphalt);
for(const side of [-1,1]){const a=world(side*.5,FAR),b=world(side*.5,NEAR);glow('#fb4ca3',5);line(a.x,a.y,b.x,b.y,'#e75ba9',2);unglow();const c=world(side*.53,FAR),d=world(side*.53,NEAR);line(c.x,c.y,d.x,d.y,'#6b5596',1)}
for(let i=0;i<18;i++){const z=NEAR+((i*5-t)%90+90)%90;if(z>FAR)continue;for(const side of [-1,1]){const a=world(side/6,z),b=world(side/6,Math.min(z+2.1,FAR));line(a.x,a.y,b.x,b.y,'#ffc4d8',Math.max(.5,a.p*2))}}
if(!fogLayer)fogLayer=fullLayer(drawHorizonFog);ctx.drawImage(fogLayer,0,0,W,H);
const objects=[];for(let i=0;i<12;i++){const z=NEAR+((i*8-t)%96+96)%96;if(z<=FAR)objects.push({z,type:'palm'})}for(const ob of obstacles)objects.push({...ob,type:'car'});
objects.push({z:PLAYER_Z,lane:carLane,type:'player'});
drawPlayerGlow();
for(const ob of obstacles){
 const p=project(ob.z,ob.lane),s=p.p*W/700;
 lightPool(p.x,p.y+14*s,145*s,38*s,'255,40,90',objectVisibility(ob.z)*.18);
}
objects.sort((a,b)=>b.z-a.z);for(const ob of objects){
 if(ob.type==='player'){const p=playerPose();drawPlayerSprite(p);continue}
 const visibility=objectVisibility(ob.z);if(visibility<=0)continue;
 if(ob.type==='palm'){for(const side of [-1,1]){const p=world(side*.68,ob.z);drawPalmSprite(p.x,p.y,p.p*W/360,side,visibility)}}
 else{const p=project(ob.z,ob.lane);drawTrafficSprite(p,ob,visibility)}
}

}

function updateSpeedometer(){
 const fraction=Math.max(0,Math.min(1,(speed-START_SPEED)/(MAX_SPEED-START_SPEED)));
 const mph=Math.round(60+fraction*210);
 $('speed-value').textContent=mph;
 $('speed-arc').style.strokeDasharray=(fraction*100).toFixed(1)+' 100';
 $('speedometer').setAttribute('aria-label','Speed '+mph+' miles per hour');
}
function setMode(next){mode=next;$('landing').hidden=next!=='idle';$('hud').hidden=next!=='playing';$('controls').hidden=next!=='playing';$('result').hidden=next!=='over';$('sound').hidden=false;$('stop').hidden=next!=='playing';$('leaderboard-open').hidden=next!=='idle';if(next!=='over'){musicScene=next==='playing'?'race':'menu';syncMusic()}}
function start(){leaderboard.begin();lane=carLane=1;distance=0;speed=START_SPEED;updateSpeedometer();spawn=1.5;obstacles=[];chooseRaceTrack();setMode('playing');if(!soundChosen&&muted)toggleSound();$('left').focus({preventScroll:true})}
function stop(){leaderboard.cancel();obstacles=[];setMode('idle')}
function move(dir){if(mode==='playing')lane=Math.max(0,Math.min(2,lane+dir))}
$('start').onclick=start;$('retry').onclick=start;$('stop').onclick=stop;$('home').onclick=stop;$('left').onpointerdown=()=>move(-1);$('right').onpointerdown=()=>move(1);$('left').onclick=e=>{if(e.detail===0)move(-1)};$('right').onclick=e=>{if(e.detail===0)move(1)};addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1)}if(e.key==='ArrowRight'){e.preventDefault();move(1)}});
function end(){setMode('over');$('score').innerHTML='<span class="score-value">'+Math.floor(distance)+'</span><span class="score-unit">m</span>';let best=0;try{best=Math.max(Number(localStorage.getItem('neon32-best'))||0,Math.floor(distance));localStorage.setItem('neon32-best',best)}catch{}$('best').innerHTML='<span class="best-label">BEST</span><span class="best-value">'+best+'</span><span class="best-unit">m</span>';$('retry').focus();leaderboard.finish(Math.floor(distance))}
function simulate(dt,active,moving){
 const pace=1+(MAX_PACE-1)*Math.max(0,Math.min(1,(speed-START_SPEED)/(MAX_SPEED-START_SPEED)));
 const travel=moving?dt*(active?speed*pace:mode==='idle'?10:0):0;t+=travel;
 carLane+=(lane-carLane)*(1-Math.exp(-12*dt));
 if(!active)return;
 speed=Math.min(MAX_SPEED,speed+dt*ACCELERATION);distance+=travel;spawn-=dt*pace;
 if(spawn<=0){obstacles.push({z:FAR,lane:Math.floor(Math.random()*3),color:['#46728c','#885375','#70618f'][Math.floor(Math.random()*3)]});spawn+=1.6-speed*.018+Math.random()*.5}
 for(const ob of obstacles){const before=ob.z;ob.z-=travel;if(before>=PLAYER_Z-1.2&&ob.z<=PLAYER_Z+1.2&&Math.abs(ob.lane-carLane)<.58){end();break}}
 obstacles=obstacles.filter(o=>o.z>NEAR);
}
let meterTime=0;
function frame(now){
 let elapsed=last?Math.max(0,(now-last)/1000):0;last=now;
 const supported=!(innerWidth<768&&matchMedia('(pointer:coarse)').matches&&innerWidth>innerHeight)&&!document.hidden;
 // Resume after a suspended tab without teleporting through the road.
 if(elapsed>1)elapsed=0;
 const moving=supported&&!$('album').open&&(!scenePaused||mode==='playing');
 while(elapsed>1e-7){const step=Math.min(elapsed,1/120);simulate(step,mode==='playing'&&supported&&!$('album').open,moving);elapsed-=step}
 if(mode==='playing'&&now-meterTime>=100){meterTime=now;updateSpeedometer();$('distance').textContent=String(Math.floor(distance)).padStart(5,'0')}
 draw();requestAnimationFrame(frame);
}requestAnimationFrame(frame);

let returnFocus;document.querySelectorAll('.album').forEach(b=>b.onclick=()=>{returnFocus=b;$('album').showModal()});$('close').onclick=()=>$('album').close();$('album').onclose=()=>returnFocus?.focus();
// User-supplied soundtrack. Playback rate stays at 1 regardless of car speed.
const racePlaylist=['audio/race-blinding-lights.mp3','audio/race-i-see-murder.mp3','audio/race-true-survivor.mp3','audio/race-the-runner.mp3','audio/race-retrowave.mp3','audio/race-nostalgic-80s.mp3'];
const MENU_TRACK='audio/menu-neon-tears.mp3';
const tracks={menu:new Audio(),race:new Audio()};
for(const track of Object.values(tracks)){track.preload='none';track.volume=0;track.playbackRate=1}
tracks.menu.loop=true;tracks.race.loop=false;
let musicFade=0,musicToken=0,musicScene='menu',raceBag=[],lastRace=-1;
function chooseRaceTrack(){
 ++musicToken;cancelAnimationFrame(musicFade);
 if(!raceBag.length){
  raceBag=racePlaylist.map((_,i)=>i);
  for(let i=raceBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[raceBag[i],raceBag[j]]=[raceBag[j],raceBag[i]]}
  const end=raceBag.length-1;
  if(raceBag.length>1&&raceBag[end]===lastRace)[raceBag[0],raceBag[end]]=[raceBag[end],raceBag[0]];
 }
 lastRace=raceBag.pop();tracks.race.pause();tracks.race.volume=0;
}
tracks.race.addEventListener('ended',()=>{if(musicScene==='race'){chooseRaceTrack();syncMusic()}});
function soundLabel(){
 $('sound').removeAttribute('aria-busy');
 $('sound').textContent=muted?'♫':'♪';
 $('sound').setAttribute('aria-label',muted?'Turn music on':'Mute music');
 $('sound').setAttribute('aria-pressed',String(!muted));
}
// Compressed MP3 blobs live only in this page's Map. No persistent cache.
const audioMemory=new Map();
function memoryTrack(source){
 const existing=audioMemory.get(source);
 if(existing)return existing.url||existing.promise;
 const entry={controller:new AbortController(),url:null,promise:null};
 audioMemory.set(source,entry);
 entry.promise=fetch(source,{cache:'no-store',signal:entry.controller.signal})
 .then(response=>{if(!response.ok)throw Error('Audio download failed: '+response.status);return response.blob()})
 .then(blob=>{
  if(entry.controller.signal.aborted)throw Error('Audio download cancelled');
  if(!blob.size||blob.type.includes('text/html'))throw Error('Invalid audio response');
  entry.url=URL.createObjectURL(blob);return entry.url;
 }).catch(error=>{if(audioMemory.get(source)===entry)audioMemory.delete(source);throw error});
 return entry.promise;
}
function clearAudioMemory(){
 ++musicToken;cancelAnimationFrame(musicFade);
 for(const track of Object.values(tracks)){track.pause();track.removeAttribute('src');track.load()}
 for(const entry of audioMemory.values()){entry.controller.abort();if(entry.url)URL.revokeObjectURL(entry.url)}
 audioMemory.clear();
}
function syncMusic(){
 const token=++musicToken;cancelAnimationFrame(musicFade);
 if(muted||document.hidden){for(const track of Object.values(tracks))track.pause();return}
 const selected=musicScene==='race'?tracks.race:tracks.menu;
 const source=musicScene==='race'?racePlaylist[lastRace]:MENU_TRACK;
 if(!source)return;
 function failed(){if(token!==musicToken)return;muted=true;$('sound').removeAttribute('aria-busy');soundLabel();for(const track of Object.values(tracks))track.pause()}
 function ready(url){
  if(token!==musicToken||muted||document.hidden)return;
  soundLabel();$('sound').removeAttribute('aria-busy');
  if(selected.getAttribute('src')!==url)selected.src=url;
  const initial=new Map(Object.values(tracks).map(t=>[t,t.volume]));
  selected.play().catch(failed);
  const began=performance.now();
  function fade(now){
   if(token!==musicToken)return;
   const f=Math.max(0,Math.min(1,(now-began)/300));
   for(const track of Object.values(tracks)){const goal=track===selected ? .55 : 0;track.volume=initial.get(track)+(goal-initial.get(track))*f}
   if(f<1)musicFade=requestAnimationFrame(fade);
   else for(const track of Object.values(tracks))if(track!==selected)track.pause();
  }
  musicFade=requestAnimationFrame(fade);
 }
 const cached=memoryTrack(source);
 if(typeof cached==='string')ready(cached);
 else{$('sound').textContent='…';$('sound').setAttribute('aria-label','Loading music');$('sound').setAttribute('aria-busy','true');cached.then(ready).catch(failed);}
}
// Warm only menu audio. Race songs download on demand, once per page session.
memoryTrack(MENU_TRACK).catch(()=>{});
addEventListener('pagehide',clearAudioMemory);
addEventListener('pageshow',event=>{if(event.persisted&&!muted)syncMusic()});
function toggleSound(){soundChosen=true;muted=!muted;soundLabel();syncMusic()}
$('sound').onclick=toggleSound;
document.addEventListener('visibilitychange',syncMusic);

function firstTouchMusic(event){
 if(soundChosen||event.target.closest('#sound,#start,#retry'))return;
 soundChosen=true;muted=false;soundLabel();syncMusic();
}
document.addEventListener('click',firstTouchMusic);
document.addEventListener('visibilitychange',()=>{last=0});
