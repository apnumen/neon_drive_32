'use strict';
const leaderboard=(()=>{
 const el=id=>document.getElementById(id),endpoint='/.netlify/functions/leaderboard';
 let liveRun=null;
 async function api(data){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(endpoint,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,cache:'no-store',signal:controller.signal});
   if(!(response.headers.get('content-type')||'').includes('application/json'))throw Error('Leaderboard is not connected yet.');
   const result=await response.json();if(!response.ok)throw Error(result.error||'Leaderboard unavailable.');return result;
  }finally{clearTimeout(timeout)}
 }
 function status(message){const node=el('leaderboard-status');node.hidden=!message;node.textContent=message}
 function render(entries){const body=el('leaderboard-rows');body.replaceChildren();entries.forEach((entry,index)=>{const row=document.createElement('tr');for(const value of [index+1,entry.name,entry.score+' m']){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}body.append(row)});el('leaderboard-message').textContent=entries.length?'':'No scores yet. Set the first record.'}
 async function refresh(){el('leaderboard-message').textContent='Loading…';el('leaderboard-rows').replaceChildren();try{render((await api()).entries)}catch{el('leaderboard-message').textContent='Leaderboard unavailable. Please try again shortly.'}}
 function begin(){
  status('');el('name-error').textContent='';if(el('name-dialog').open)el('name-dialog').close();
  const run={promise:api({action:'begin'}).catch(()=>null),candidate:null};liveRun=run;
 }
 function cancel(){liveRun=null;status('');if(el('name-dialog').open)el('name-dialog').close()}
 async function finish(score){
  const run=liveRun;if(!run)return;status('Checking top 10…');
  const session=await run.promise;if(liveRun!==run||mode!=='over')return;
  if(!session){status('Leaderboard offline. Your best is saved on this device.');return}
  try{const result=await api({action:'finish',token:session.token,score});if(liveRun!==run||mode!=='over')return;status('');if(!result.qualified)return;
   run.candidate={token:session.token,score:result.score};el('name-score').textContent=result.score+' m';try{el('player-name').value=[...(localStorage.getItem('neon32-name')||'')].slice(0,10).join('')}catch{}
   el('name-dialog').showModal();el('player-name').focus();
  }catch{if(liveRun===run&&mode==='over')status('Leaderboard offline. Your best is saved on this device.')}
 }
 el('leaderboard-open').onclick=()=>{el('leaderboard-dialog').showModal();refresh()};el('leaderboard-close').onclick=()=>el('leaderboard-dialog').close();
 el('player-name').oninput=()=>{const input=el('player-name');input.value=[...input.value].slice(0,10).join('')};
 el('name-skip').onclick=()=>{el('name-dialog').close();el('retry').focus()};
 el('name-form').onsubmit=async event=>{
  event.preventDefault();const run=liveRun;if(!run?.candidate)return;
  const name=el('player-name').value.trim();if(!name||[...name].length>10){el('name-error').textContent='Enter a name from 1 to 10 characters.';return}
  el('name-submit').disabled=true;el('name-error').textContent='';
  try{const result=await api({action:'submit',token:run.candidate.token,name});if(liveRun!==run)return;
   try{localStorage.setItem('neon32-name',name)}catch{}
   el('name-dialog').close();render(result.entries);el('leaderboard-dialog').showModal();status('Saved to the leaderboard.');run.candidate=null;
  }catch(error){if(liveRun===run)el('name-error').textContent=error.message}
  finally{el('name-submit').disabled=false}
 };
 return {begin,finish,cancel};
})();
