'use strict';
// Approved shape study, using the original arcade car projection and materials.
function playerPorsche(x,y,s,color='#8c548d',player=true){
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
 const inner=side*(z>100?64:74),outer=side*(z>100?86:109),cy=10,r=25;
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
// Same projection and shading vocabulary as the original arcade car.
face([[-73,28,218],[73,28,218],[80,43,198],[-80,43,198]],'#295373','#4eb6d5');
face([[-80,43,198],[80,43,198],[61,68,159],[-61,68,159]],body,'#63b9d1');
for(const side of [-1,1]){
 face([[side*88,34,0],[side*96,43,28],[side*93,50,59],[side*81,52,86],[side*60,77,111],[side*59,76,159],[side*80,43,198]],side<0?body:'#214260','#4eb6d5');
 face([[side*88,34,0],[side*96,43,28],[side*93,50,59],[side*84,45,75],[side*86,33,27]],side<0?'#5d9eb7':'#275f7d','#64b0c8');
 face([[side*79,50,86],[side*62,72,115],[side*61,72,153],[side*72,47,175]],'#101d31','#568fa8');
}
// Rear fenders are mirrored 3D shells, not a flat side polygon.
const rearShell=[[0,89,37,78,38],[15,101,48,79,49],[30,104,53,78,55],[50,99,53,75,56],[72,85,49,70,51]];
for(const side of [-1,1])for(let i=1;i<rearShell.length;i++){
 const a=rearShell[i-1],b=rearShell[i];
 const inner=r=>[side*r[3],r[4],r[0]],outer=r=>[side*r[1],r[2],r[0]];
 const arch=z=>Math.abs(z-20)<26?10+Math.sqrt(26*26-(z-20)*(z-20)):5;
 face([inner(a),outer(a),outer(b),inner(b)],side<0?grad([[0,'#3a839f'],[.5,'#81bfd0'],[1,'#60769e']]):grad([[0,'#3b7598'],[.5,'#6a9db9'],[1,'#2b5e7c']]),'#74bed1',.8);
 face([outer(a),[side*a[1],arch(a[0]),a[0]],[side*b[1],arch(b[0]),b[0]],outer(b)],side<0?'#376f8a':'#28536f','#4a91aa',.7);
}
// Three gentle roof bands give a short curved coupe roof, not a long flat wedge.
const roof=[[111,59,77],[127,57,83],[145,57,83],[159,60,76]];
for(let i=1;i<roof.length;i++){const a=roof[i-1],b=roof[i];
 face([[-a[1],a[2]-5,a[0]],[-a[1]*.65,a[2],a[0]],[-b[1]*.65,b[2],b[0]],[-b[1],b[2]-5,b[0]]],'#61a7c2','#7bd2e3');
 face([[-a[1]*.65,a[2],a[0]],[a[1]*.65,a[2],a[0]],[b[1]*.65,b[2],b[0]],[-b[1]*.65,b[2],b[0]]],grad([[0,'#649db9'],[.5,'#a38cb6'],[1,'#568fb0']]),'#a1dce5');
 face([[a[1]*.65,a[2],a[0]],[a[1],a[2]-5,a[0]],[b[1],b[2]-5,b[0]],[b[1]*.65,b[2],b[0]]],'#346c90','#62b7d4');
}
// Broad curved rear glass: no louvers across the window.
face([[-70,48,43],[-66,62,73],[-55,76,110],[55,76,110],[66,62,73],[70,48,43]],'#101c31','#6de8ee',1.2);
face([[-55,76,110],[55,76,110],[58,72,101],[-58,72,101]],'#283956');
// Compact engine grille and low black whale-tail atop the rear deck.
face([[-82,40,19],[82,40,19],[70,48,43],[-70,48,43]],body,'#78dce8');
face([[-73,47,22],[73,47,22],[69,50,40],[-69,50,40]],'#142133','#5da2ba');
for(let i=0;i<5;i++){const z=24+i*3;edge([-70,50,z],[70,50,z],'#62aabd',1)}
face([[-93,55,10],[93,55,10],[102,55,17],[94,56,34],[-94,56,34],[-102,55,17]],'#102031','#68b3c9',1);
face([[-93,55,10],[93,55,10],[93,51,9],[-93,51,9]],'#081422','#376780');
// Deck lip gives the rear a visible top plane above the lamp panel.
face([[-82,40,19],[82,40,19],[89,37,0],[-89,37,0]],body,'#78dce8');
face([[-89,37,0],[89,37,0],[92,16,-2],[83,5,-3],[-83,5,-3],[-92,16,-2]],grad([[0,'#385e7c'],[.45,'#182337'],[1,'#293d5b']]),'#406f8e');
face([[-85,33,-3],[85,33,-3],[87,19,-3],[-87,19,-3]],'#091320','#44667e');
// One continuous Porsche-style red strip, with no center plate or gaps.
const lamp='#ff345b';glow(lamp,10);
face([[-82,31,-4],[82,31,-4],[85,22,-4],[-85,22,-4]],lamp,'#ff8ba4',.8);unglow();
edge([-83,24,-5],[83,24,-5],'#bc1d48',.6);
face([[-89,17,-5],[89,17,-5],[84,7,-6],[-84,7,-6]],'#101725','#3f536e');
edge([-84,7,-7],[84,7,-7],'#7b99aa',1.2);
for(const side of [-1,1]){face([[side*61,3,-7],[side*69,3,-7],[side*69,8,-7],[side*61,8,-7]],'#7d8a99','#182338');
// Mirrors and the thin body seam continue into the distance.
face([[side*75,51,125],[side*91,49,123],[side*92,44,118],[side*77,44,117]],'#276c8d','#68ccde');
}
glow('#3be5ff',7);for(const side of [-1,1])for(let i=1;i<rearShell.length;i++){const a=rearShell[i-1],b=rearShell[i];edge([side*a[1],a[2],a[0]],[side*b[1],b[2],b[0]],'#62ccdf',.8)}unglow();
ctx.restore()}
