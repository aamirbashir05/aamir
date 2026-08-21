'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let SCENES = [];          // [{n,beat,imagePrompt,videoPrompt,imgDone,vidDone,imageSrc}]
let RUNNING = false, STOP = false;
let FLOWMAP = {};

const store = {
  get: k => new Promise(r => chrome.storage.local.get(k, o => r(o[k]))),
  set: (k, v) => new Promise(r => chrome.storage.local.set({ [k]: v }, r))
};

/* ---------- toast + log ---------- */
let tT;
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(tT); tT=setTimeout(()=>t.classList.remove('show'),1500); }
function log(m,cls){ const el=$('#log'); const d=document.createElement('div'); if(cls) d.className='log-'+cls; d.textContent=new Date().toLocaleTimeString()+'  '+m; el.appendChild(d); el.scrollTop=el.scrollHeight; }
$('#clearLog').onclick=()=>{ $('#log').innerHTML='ready.'; };
$$('h2[data-toggle]').forEach(h=>h.onclick=()=>$('#'+h.dataset.toggle).classList.toggle('collapsed'));

/* ================= IMPORT PROMPTS ================= */
function parseFreeText(text){
  const parts=text.split(/(?:^|\n)\s*(?:={2,}\s*)?scene\s*[#:]?\s*(\d+)/i);
  const out=[];
  for(let i=1;i<parts.length;i+=2){
    const num=parseInt(parts[i],10); const body=parts[i+1]||'';
    const img=matchBlock(body,/\(?A\)?[^\n]*?(?:image\s*prompt)/i);
    const vid=matchBlock(body,/\(?B\)?[^\n]*?(?:image-?to-?video\s*prompt|video\s*prompt|image-?to-?video)/i);
    if(img||vid) out.push({n:num,beat:'Scene '+num,imagePrompt:img||'',videoPrompt:vid||''});
  }
  return out;
}
function matchBlock(body,labelRe){ const m=body.match(labelRe); if(!m) return ''; return cleanBlock(body.slice(m.index+m[0].length)); }
function cleanBlock(s){
  const stop=s.search(/\n\s*(?:\(?[AB]\)?[^\n]*?prompt|image-?to-?video|dialogue|arabic|transliteration|meaning|caption|hashtag|thumbnail|={2,}|scene\s*\d)/i);
  let b=(stop>=0?s.slice(0,stop):s);
  return b.replace(/^(?:\s*prompt)?[:\s\-–)]+/i,'').trim().slice(0,1600);
}
function parsePrompts(text){
  const scoped=parseFreeText(text);
  if(scoped.length) return scoped.map((s,i)=>({n:s.n||i+1,beat:s.beat||('Scene '+(i+1)),imagePrompt:s.imagePrompt||'',videoPrompt:s.videoPrompt||''}));
  const re=/(image-?to-?video\s*prompt|video\s*prompt|image\s*prompt)/ig;
  let m, marks=[];
  while((m=re.exec(text))){ marks.push({type:/video|image-?to/i.test(m[1])?'vid':'img',start:m.index,end:m.index+m[0].length}); }
  if(!marks.length) return [];
  const imgs=[], vids=[];
  marks.forEach((mk,i)=>{ const next=marks[i+1]; const raw=text.slice(mk.end,next?next.start:text.length); (mk.type==='img'?imgs:vids).push(cleanBlock(raw)); });
  const n=Math.max(imgs.length,vids.length); const out=[];
  for(let i=0;i<n;i++) out.push({n:i+1,beat:'Scene '+(i+1),imagePrompt:imgs[i]||'',videoPrompt:vids[i]||''});
  return out;
}
function loadFromText(text){
  $('#err').style.display='none';
  if(!text||!text.trim()){ toast('Pehle prompts paste karo'); return; }
  const parsed=parsePrompts(text);
  if(!parsed.length){ showErr('Prompts pehchaan nahi paaya — har scene mein “IMAGE PROMPT:” aur “VIDEO PROMPT:” labels hon.'); log('⚠️ paste: koi prompt nahi mila','warn'); return; }
  SCENES=parsed.map(s=>({...s,imgDone:false,vidDone:false,imageSrc:''})); renderScenes();
  log('✓ '+SCENES.length+' scenes load ho gaye.','ok'); $('#cQueue').classList.remove('collapsed'); toast('Load ho gaya ✓');
}
function showErr(m){ const e=$('#err'); e.innerHTML=m; e.style.display='block'; }
$('#loadPaste').onclick=()=>loadFromText($('#pasteBox').value);
$('#pasteFile').onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ $('#pasteBox').value=r.result||''; loadFromText($('#pasteBox').value); }; r.onerror=()=>toast('File padhi nahi gayi'); r.readAsText(f); e.target.value=''; };

/* ================= QUEUE RENDER ================= */
function esc(s){ return (s==null?'':String(s)).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function renderScenes(){
  $('#qCount').textContent=SCENES.length;
  if(!SCENES.length){ $('#scenesWrap').innerHTML='<div class="fine">Abhi koi scene nahi — upar se prompts load karo.</div>'; return; }
  $('#scenesWrap').innerHTML=SCENES.map((s,i)=>`
    <div class="scene" id="sc${i}">
      <div class="scene-top"><span class="scene-n">${esc(s.n||i+1)}</span><b>${esc(s.beat||('Scene '+(i+1)))}</b>
        <span class="st ${s.vidDone?'vid':(s.imgDone?'img':'')}" id="st${i}">${s.vidDone?'video ✓':(s.imgDone?'image ✓':'pending')}</span></div>
      ${s.imagePrompt?`<div class="plab">🖼 image <button class="btn btn-ghost btn-sm" data-copy="${i}img">copy</button></div><div class="pr" id="pr${i}img">${esc(s.imagePrompt)}</div>`:''}
      ${s.videoPrompt?`<div class="plab">🎬 video <button class="btn btn-ghost btn-sm" data-copy="${i}vid">copy</button></div><div class="pr" id="pr${i}vid">${esc(s.videoPrompt)}</div>`:''}
      <div class="mini">
        ${s.imagePrompt?`<button class="btn btn-ghost btn-sm" data-run="${i}img">▶ image</button>`:''}
        ${s.videoPrompt?`<button class="btn btn-ghost btn-sm" data-run="${i}vid">▶ video</button>`:''}
      </div>
    </div>`).join('');
  $$('#scenesWrap [data-copy]').forEach(b=>b.onclick=()=>{ navigator.clipboard.writeText($('#pr'+b.dataset.copy).textContent); toast('Copy ✓'); });
  $$('#scenesWrap [data-run]').forEach(b=>b.onclick=()=>{ const i=parseInt(b.dataset.run); flowRunOne(i, b.dataset.run.endsWith('vid')?'vid':'img'); });
}
function setStatus(i,txt,cls){ const el=$('#st'+i); if(el){ el.textContent=txt; el.className='st '+(cls||''); } }

/* ================= EXPORT (optional) ================= */
function imgList(){ return SCENES.map(s=>(s.imagePrompt||'').trim()).filter(Boolean).join('\n\n'); }
function vidList(){ return SCENES.map(s=>(s.videoPrompt||'').trim()).filter(Boolean).join('\n\n'); }
function csvCell(v){ v=(v==null?'':String(v)); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
function csvBuild(){ const rows=[['scene','image_prompt','video_prompt']]; SCENES.forEach((s,i)=>rows.push([s.n||i+1,s.imagePrompt||'',s.videoPrompt||''])); return rows.map(r=>r.map(csvCell).join(',')).join('\r\n'); }
function dlText(name,text,mime){ if(!text||!text.trim()){ toast('Pehle prompts load karo'); return; } const b=new Blob([text],{type:(mime||'text/plain')+';charset=utf-8'}); const u=URL.createObjectURL(b); chrome.downloads.download({url:u,filename:name,saveAs:false},()=>{ setTimeout(()=>URL.revokeObjectURL(u),5000); toast('Download: '+name); }); }
function cpText(t){ if(!t||!t.trim()){ toast('Pehle prompts load karo'); return; } navigator.clipboard.writeText(t); toast('Copy ✓'); }
$('#copyImgs').onclick=()=>cpText(imgList());
$('#copyVids').onclick=()=>cpText(vidList());
$('#dlImgs').onclick=()=>dlText('drama-image-prompts.txt',imgList());
$('#dlVids').onclick=()=>dlText('drama-video-prompts.txt',vidList());
$('#dlCsv').onclick=()=>dlText('drama-prompts.csv',csvBuild(),'text/csv');

/* ================= FLOW TAB ================= */
function isVeoUrl(u){ return /labs\.google|flow\.google|gemini\.google\.com|aistudio\.google\.com/.test(u||''); }
async function refreshTabs(){
  const tabs=await chrome.tabs.query({});
  const veo=tabs.filter(t=>isVeoUrl(t.url));
  const sel=$('#veoTab'); sel.innerHTML='';
  if(!veo.length){ sel.innerHTML='<option value="">— koi Flow tab khula nahi —</option>'; return; }
  veo.forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.dataset.url=t.url||''; o.textContent=(t.title||t.url).slice(0,42); sel.appendChild(o); });
}
$('#refreshTabs').onclick=refreshTabs;
async function veoTabId(){ if(!$('#veoTab').value) await refreshTabs(); return parseInt($('#veoTab').value)||null; }
function originOf(url){ try{ return new URL(url).origin+'/*'; }catch(e){ return ''; } }
// Grant access to the selected Flow tab's origin (must be a direct user gesture)
$('#grantAccess').onclick=async()=>{
  const sel=$('#veoTab'); const opt=sel.options[sel.selectedIndex];
  const url=opt&&opt.dataset.url; const origin=originOf(url);
  if(!origin){ toast('Pehle Flow tab chuno + refresh'); return; }
  try{ const g=await chrome.permissions.request({origins:[origin]});
    if(g){ log('✓ access mil gaya: '+origin,'ok'); toast('Access ✓ — ab Test/Run karo'); }
    else log('✗ access nahi diya ('+origin+')','warn');
  }catch(e){ log('✗ grant: '+e.message,'err'); }
};
async function injectFlow(tabId){
  const tab=await chrome.tabs.get(tabId).catch(()=>null);
  const origin=tab?originOf(tab.url):'';
  if(origin){ const has=await chrome.permissions.contains({origins:[origin]}).catch(()=>false);
    if(!has) throw new Error('Is site ka access nahi — pehle “🔓 Grant access” dabao (Flow tab chun kar).'); }
  await chrome.scripting.executeScript({target:{tabId},files:['flow-agent.js']});
}
function sendTab(tabId,msg){ return new Promise(res=>{ chrome.tabs.sendMessage(tabId,{__drama:true,...msg},r=>{ if(chrome.runtime.lastError) res({ok:false,error:chrome.runtime.lastError.message}); else res(r||{ok:false,error:'no reply'}); }); }); }
$('#pingVeo').onclick=async()=>{ const id=await veoTabId(); if(!id) return toast('Pehle Flow tab kholo + refresh'); try{ await injectFlow(id); const r=await sendTab(id,{cmd:'ping',map:FLOWMAP}); if(r.ok&&r.promptFound) log('✓ Prompt box mil gaya'+(r.isFlow?' (Flow page).':'.'),'ok'); else log('⚠️ Prompt box nahi mila — “aur buttons” se prompt map karo.','warn'); }catch(e){ log('✗ '+e.message,'err'); } };

/* ================= MAPPING (learn/pick) ================= */
(async()=>{ FLOWMAP=await store.get('flow_map')||{}; updateMapBadges(); refreshTabs(); })();
function updateMapBadges(){ $$('[data-pick]').forEach(b=>{ const el=$('#m_'+b.dataset.pick); if(el){ el.textContent=FLOWMAP[b.dataset.pick]?'✓':'✗'; el.style.color=FLOWMAP[b.dataset.pick]?'var(--ok)':'var(--muted)'; } }); }
$('#moreMap').onclick=()=>{ const b=$('#moreMapBox'); b.style.display=b.style.display==='none'?'block':'none'; };
$('#resetMap').onclick=async()=>{ FLOWMAP={}; await store.set('flow_map',{}); updateMapBadges(); toast('Mapping reset'); };
$$('[data-pick]').forEach(b=>b.onclick=async()=>{
  const id=await veoTabId(); if(!id){ toast('Pehle Flow tab kholo + refresh'); return; }
  try{ await injectFlow(id); await sendTab(id,{cmd:'startPick',key:b.dataset.pick}); log('👆 Flow tab pe "'+b.dataset.pick+'" wale button pe click karo…','warn'); toast('Flow tab pe click karo'); }
  catch(e){ log('✗ pick: '+e.message,'err'); }
});
chrome.runtime.onMessage.addListener(msg=>{
  if(!msg||msg.__drama!==true||msg.type!=='pickResult') return;
  if(!msg.selector){ log('pick cancel','warn'); return; }
  FLOWMAP[msg.key]=msg.selector; store.set('flow_map',FLOWMAP); updateMapBadges();
  log('✓ mapped "'+msg.key+'" → '+msg.selector.slice(0,48)+(msg.text?('  ('+msg.text+')'):''),'ok');
});

/* ================= FLOW RUN ================= */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function setDlState(on){ const cur=await store.get('flow_dl')||{}; await store.set('flow_dl',{active:on, folder:($('#fFolder').value||'DramaStudio'), queue:on?(cur.active?cur.queue||[]:[]):[], count:on?(cur.active?cur.count||0:0):0}); }
async function pushDlName(i){ const cur=await store.get('flow_dl')||{}; const q=Array.isArray(cur.queue)?cur.queue:[]; q.push('scene-'+String(i+1).padStart(2,'0')); await store.set('flow_dl',{...cur,active:true,queue:q}); }

async function flowImage(id,i){
  const s=SCENES[i]; if(!s.imagePrompt){ log('scene '+(i+1)+': image prompt khaali','warn'); return null; }
  setStatus(i,'image chal raha…','busy'); log('Scene '+(i+1)+' IMAGE: recipe…');
  const r=await sendTab(id,{cmd:'runImage',map:FLOWMAP,prompt:s.imagePrompt,waitMs:(parseInt($('#fImgWait').value)||90)*1000});
  if(!r.ok){ setStatus(i,'image fail',''); log('✗ scene '+(i+1)+' image: '+(r.error||'?'),'err'); return null; }
  s.imageSrc=r.imageSrc||''; s.imgDone=true; setStatus(i,'image ✓','img');
  log('✓ scene '+(i+1)+' image ('+Math.round((r.elapsed||0)/1000)+'s)'+(s.imageSrc?'':' — src na mila; video attach fail ho sakta'),'ok');
  return s.imageSrc;
}
async function flowVideo(id,i){
  const s=SCENES[i]; if(!s.videoPrompt){ log('scene '+(i+1)+': video prompt khaali','warn'); return false; }
  const autoDl=$('#fAutoDl').checked;
  if(autoDl) await pushDlName(i);
  setStatus(i,'video chal raha…','busy'); log('Scene '+(i+1)+' VIDEO: recipe…');
  const r=await sendTab(id,{cmd:'runVideo',map:FLOWMAP,prompt:s.videoPrompt,imageSrc:s.imageSrc||'',
    waitMs:(parseInt($('#fVidWait').value)||180)*1000, autoDownload:autoDl, qualityWaitMs:(parseInt($('#fQualWait').value)||12)*1000});
  if(r.frameWarn) log('  ⚠️ start-frame: '+r.frameWarn,'warn');
  if(!r.ok){ setStatus(i,'video fail',''); log('✗ scene '+(i+1)+' video: '+(r.error||'?'),'err'); return false; }
  s.vidDone=true; setStatus(i,'video ✓','vid');
  log('✓ scene '+(i+1)+' video ('+Math.round((r.elapsed||0)/1000)+'s)'+(r.downloaded?' ⬇ 1080p':''),'ok');
  return true;
}
async function flowRunOne(i,kind){
  const id=await veoTabId(); if(!id){ toast('Flow tab chuno + refresh'); return; }
  try{ await injectFlow(id); await setDlState(true); if(kind==='vid') await flowVideo(id,i); else await flowImage(id,i); }
  catch(e){ log('✗ '+e.message,'err'); }
}
async function flowRun(mode){
  if(RUNNING){ toast('Pehle se chal raha'); return; }
  if(!SCENES.length){ toast('Pehle prompts load karo'); return; }
  const id=await veoTabId(); if(!id){ toast('Flow tab chuno + refresh'); return; }
  if(!FLOWMAP.generate) log('⚠️ “→ Generate” map nahi — auto-detect pe depend karega. Behtar hai pehle Pick kar lo.','warn');
  RUNNING=true; STOP=false; const gap=(parseInt($('#fGap').value)||6)*1000;
  try{ await injectFlow(id); await setDlState(true); }catch(e){ log('✗ inject: '+e.message,'err'); RUNNING=false; return; }
  log('=== Flow Auto ('+mode+') start — '+SCENES.length+' scenes, folder: '+($('#fFolder').value||'DramaStudio')+' ===');
  for(let i=0;i<SCENES.length;i++){
    if(STOP){ log('⏹ Stopped.','warn'); break; }
    if(mode==='all'){ await flowImage(id,i); await sleep(gap); if(STOP) break; await flowVideo(id,i); }
    else if(mode==='img'){ await flowImage(id,i); }
    else { await flowVideo(id,i); }
    if(i<SCENES.length-1) await sleep(gap);
  }
  await setDlState(false);
  RUNNING=false; log('=== Flow Auto done ===','ok'); toast('Flow batch done');
}
$('#fRunAll').onclick=()=>flowRun('all');
$('#fRunImgs').onclick=()=>flowRun('img');
$('#fRunVids').onclick=()=>flowRun('vid');
$('#fStop').onclick=async()=>{ STOP=true; await setDlState(false); toast('Rukega agle step pe'); };
