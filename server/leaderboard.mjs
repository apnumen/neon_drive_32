const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
function validName(input){return typeof input==='string'?input.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim().replace(/\s+/g,' '):''}
export function maximumDistance(seconds){const a=34/70,k=1.6/34,t=Math.max(0,Math.min(seconds,70));return 14*t+(a+14*k*a)*t*t/2+k*a*a*t*t*t/3+Math.max(0,seconds-70)*48*2.6}
export const sorted=rows=>rows.filter(r=>r&&Number.isInteger(r.score)).sort((a,b)=>b.score-a.score||a.at-b.at);
export function qualifies(score,playerId,rows){const own=rows.find(r=>r.playerId===playerId);if(own&&own.score>=score)return false;const others=sorted(rows.filter(r=>r.playerId!==playerId));return score>0&&(others.length<10||score>others[9].score)}
export function createHandler(store,{now=Date.now,uuid=()=>crypto.randomUUID()}={}){
 async function allEntries(){const keys=[];for await(const page of store.list({prefix:'entries/',paginate:true}))for(const blob of page.blobs)keys.push(blob.key);return (await Promise.all(keys.map(key=>store.get(key,{type:'json'})))).filter(Boolean)}
 const publicTop=rows=>sorted(rows).slice(0,10).map(({name,score})=>({name,score}));
 return async request=>{
  try{
   if(request.method==='GET')return reply({entries:publicTop(await allEntries())});
   if(request.method!=='POST')return reply({error:'Method not allowed'},405);
   if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin not allowed'},403);
   const text=await request.text();if(text.length>2048)return reply({error:'Request too large'},413);
   let data;try{data=JSON.parse(text)}catch{return reply({error:'Invalid JSON'},400)}
   if(!data||typeof data!=='object'||Array.isArray(data))return reply({error:'Invalid request'},400);
   if(data.action==='begin'){
    if(!UUID.test(data.playerId||''))return reply({error:'Invalid player'},400);
    const token=uuid();await store.setJSON('runs/'+token,{playerId:data.playerId,started:now()},{onlyIfNew:true});return reply({token});
   }
   if(!UUID.test(data.token||''))return reply({error:'Invalid run'},400);
   if(data.action==='finish'){
    const run=await store.get('runs/'+data.token,{type:'json'});if(!run||now()-run.started>86400000)return reply({error:'Run expired'},410);
    const elapsed=Math.max(0,(now()-run.started)/1000)+3;
    if(!Number.isSafeInteger(data.score)||data.score<0||data.score>maximumDistance(elapsed)*1.08+30)return reply({error:'Invalid score'},400);
    const candidate={...run,score:data.score,at:now()};const write=await store.setJSON('results/'+data.token,candidate,{onlyIfNew:true});
    const result=write.modified?candidate:await store.get('results/'+data.token,{type:'json'});
    const rows=await allEntries();return reply({qualified:qualifies(result.score,result.playerId,rows),score:result.score,entries:publicTop(rows)});
   }
   if(data.action==='submit'){
    const result=await store.get('results/'+data.token,{type:'json'});if(!result||now()-result.at>86400000)return reply({error:'Result expired'},410);
    const name=validName(data.name);if(name.length<1||[...name].length>20)return reply({error:'Use a name from 1 to 20 characters'},400);
    if(!qualifies(result.score,result.playerId,await allEntries()))return reply({error:'Your result no longer qualifies for the top 10',qualified:false},409);
    const key='entries/'+result.playerId;let saved=false;
    for(let attempt=0;attempt<5;attempt++){
     const previous=await store.getWithMetadata(key,{type:'json'});
     if(previous&&previous.data.score>=result.score)return reply({error:'A better result is already saved'},409);
     const condition=previous?{onlyIfMatch:previous.etag}:{onlyIfNew:true};
     const write=await store.setJSON(key,{playerId:result.playerId,name,score:result.score,at:result.at},condition);if(write.modified){saved=true;break}
    }
    if(!saved)return reply({error:'Please try saving again'},409);
    return reply({saved:true,entries:publicTop(await allEntries())});
   }
   return reply({error:'Unknown action'},400);
  }catch(error){console.error('Leaderboard request failed',error);return reply({error:'Leaderboard temporarily unavailable'},503)}
 };
}
