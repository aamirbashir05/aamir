'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const LS = { key:'drama_key', model:'drama_model', lang:'drama_lang', bible:'drama_bible', sel:'drama_sel' };

let SCENES = [];          // [{n,beat,imagePrompt,videoPrompt,imgDone,vidDone}]
let RUNNING = false;
let STOP = false;

/* ---------- storage helpers (chrome.storage.local) ---------- */
const store = {
  get: (k) => new Promise(r => chrome.storage.local.get(k, o => r(o[k]))),
  set: (k, v) => new Promise(r => chrome.storage.local.set({ [k]: v }, r))
};

/* ---------- toast + log ---------- */
let tT;
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(tT); tT=setTimeout(()=>t.classList.remove('show'),1500); }
function log(m, cls){ const el=$('#log'); const line=document.createElement('div'); if(cls) line.className='log-'+cls; line.textContent=new Date().toLocaleTimeString()+'  '+m; el.appendChild(line); el.scrollTop=el.scrollHeight; }
$('#clearLog').onclick = ()=>{ $('#log').innerHTML='ready.'; };

/* ---------- collapse cards ---------- */
$$('h2[data-toggle]').forEach(h=>h.onclick=()=>$('#'+h.dataset.toggle).classList.toggle('collapsed'));

/* ---------- settings init ---------- */
(async function init(){
  $('#apiKey').value = await store.get(LS.key) || '';
  const m = await store.get(LS.model); if(m) $('#model').value=m;
  const l = await store.get(LS.lang); if(l) $('#meaningLang').value=l;
  const b = await store.get(LS.bible); if(b) $('#bibleReuse').value=b;
  const sel = await store.get(LS.sel) || {};
  $('#selPrompt').value=sel.prompt||''; $('#selGenerate').value=sel.generate||''; $('#selDownload').value=sel.download||'';
  refreshKeyPill();
  if(!(await store.get(LS.key))) $('#cSetup').classList.remove('collapsed');
  refreshTabs();
})();
async function refreshKeyPill(){ const has=!!(await store.get(LS.key)); const p=$('#keyPill'); p.textContent=has?'key ✓':'key nahi'; p.className='pill '+(has?'on':'off'); }
$('#saveKey').onclick = async()=>{ await store.set(LS.key,$('#apiKey').value.trim()); refreshKeyPill(); toast('Key save ✓'); };
$('#showKey').onclick = ()=>{ const i=$('#apiKey'); i.type=i.type==='password'?'text':'password'; };
$('#model').onchange = e=>store.set(LS.model,e.target.value);
$('#meaningLang').onchange = e=>store.set(LS.lang,e.target.value);
$('#saveSel').onclick = async()=>{ await store.set(LS.sel,{prompt:$('#selPrompt').value.trim(),generate:$('#selGenerate').value.trim(),download:$('#selDownload').value.trim()}); toast('Selectors save ✓'); };
async function getSelectors(){ return await store.get(LS.sel) || {}; }

/* ---------- surprise ---------- */
const SEEDS=[
 "Saas apni bahu ko taane deti hai; ek din bahu bemaar saas ke liye raat bhar jaag kar dawai banati hai, saas ko apni ghalti ka ehsaas hota hai.",
 "Bahu ke paas maa ke ilaaj ke paise nahi; saas chupke apna sona bech kar paise deti hai par batati nahi, bahu ko sach baad mein pata chalta hai.",
 "Saas ko lagta hai bahu ne kangan chura liya; sach mein pote ne chhupaya tha — saas sharminda ho jaati hai.",
 "Beti shaadi ke baad maa se door; ek phone call par purana jhagda yaad karke dono ro deti hain aur maaf kar deti hain."
];
$('#surpriseBtn').onclick=()=>{ $('#idea').value=SEEDS[Math.floor(Math.random()*SEEDS.length)]; toast('Story daal di 🎲'); };

/* ---------- build instruction (same spec as web tool) ---------- */
function buildInstruction(forAPI){
  const n=$('#scenes').value, tone=$('#tone').value, dialect=$('#dialect').value;
  const lang=$('#meaningLang').value, meaning=lang==='both'?'Urdu AND English':lang;
  const idea=$('#idea').value.trim()||'(No idea given — invent a fresh original emotional Khaleeji family micro-drama.)';
  const reuse=$('#bibleReuse').value.trim();
  const reuseBlock=reuse?`\nREUSE THESE EXACT CHARACTERS (do not change name/age/skin/hair/eyes/outfit — recurring series):\n${reuse}\n`:'';
  const spec=`You are an expert creative director for a vertical short-form (TikTok/Reels/Shorts) channel in the Khaleeji/Arab family-drama niche — emotional, cinematic, photorealistic AI micro-dramas (saas–bahu conflict → aansu → twist → emotional resolution), tone like "dramatots". Pipeline is image-to-video in Veo 3: each scene has a still first-frame IMAGE PROMPT, then animated with a VIDEO PROMPT.

TASK: Build a complete ${n}-scene story (~${Math.round(n*9)}s, each ~8–10s) from:
"${idea}"
Tone: ${tone}. Dialogue dialect: ${dialect}. Meaning language: ${meaning}.
${reuseBlock}
HARD RULES:
- Fixed CHARACTER BIBLE (name, age, skin, hair, eyes, exact outfit); reuse IDENTICAL wording in every image prompt so faces & clothes never change. Keep recurring props consistent.
- IMAGE PROMPT: vertical 9:16, ultra-realistic cinematic, ARRI Alexa look, warm lighting, shallow depth of field; detailed characters/wardrobe/setting/composition; NO on-screen text/watermark/logo; restrained pose just beginning.
- VIDEO PROMPT: motion, camera movement, micro-expressions; include spoken Arabic dialogue (${dialect}); ambient sound; no music unless needed.
- Dialogue per scene: Arabic script + transliteration + meaning in ${meaning}.
- Also: one TikTok caption (first-person hook + "..." + twist tease + emoji), Arabic hashtags, and a thumbnail prompt (9:16 bold expressive face; if Arabic text included give exact text + note AI may misspell so verify).`;
  if(forAPI){
    return spec+`\n\nReturn ONLY valid minified JSON (no markdown/backticks), EXACT shape:
{"title":string,"logline":string,"characters":[{"name":string,"age":string,"skin":string,"hair":string,"eyes":string,"outfit":string,"note":string}],"props":[string],"scenes":[{"n":number,"beat":string,"imagePrompt":string,"videoPrompt":string,"dialogue":{"arabic":string,"translit":string,"meaning":string},"sound":string}],"caption":string,"hashtags":string,"thumbnail":string}
Make exactly ${n} scenes.`;
  }
  return spec+`\n\nRespond scene-by-scene. For EACH scene clearly label and separate:
(A) FIRST-FRAME IMAGE PROMPT
(B) VEO IMAGE-TO-VIDEO PROMPT  (with Arabic dialogue + transliteration + ${meaning} meaning)
Start with CHARACTER BIBLE + props, then all ${n} scenes, then caption + hashtags, then thumbnail prompt.`;
}

/* ---------- Gemini ---------- */
async function callGemini(prompt){
  const key=(await store.get(LS.key)||'').trim(); if(!key) throw new Error('NOKEY');
  const model=$('#model').value;
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.95,topP:0.95,maxOutputTokens:8192,responseMimeType:'application/json'}})});
  if(!res.ok){ let msg='HTTP '+res.status; try{const j=await res.json();msg=(j.error&&j.error.message)||msg;}catch(e){}
    if(/API key not valid/i.test(msg))throw new Error('BADKEY');
    if(res.status===429)throw new Error('Free limit bhar gaya — 1 min baad ya doosra Model.');
    if(res.status===404)throw new Error('Model available nahi — doosra Model chuno.');
    throw new Error(msg); }
  const data=await res.json();
  const txt=(((data.candidates||[])[0]||{}).content||{}).parts?.map(p=>p.text).join('')||'';
  if(!txt)throw new Error('Khaali jawab.'); return txt;
}
function parseJSON(txt){ let t=txt.trim().replace(/^```[a-z]*\s*/i,'').replace(/```\s*$/,'').trim();
  try{return JSON.parse(t);}catch(e){} const a=t.indexOf('{'),b=t.lastIndexOf('}'); if(a>=0&&b>a)return JSON.parse(t.slice(a,b+1)); throw new Error('Parse fail.'); }

/* ---------- parse free text (Claude master-prompt output) ---------- */
function parseFreeText(text){
  // scenes split on "SCENE n" markers
  const parts = text.split(/(?:^|\n)\s*(?:={2,}\s*)?scene\s*[#:]?\s*(\d+)/i);
  const out=[];
  for(let i=1;i<parts.length;i+=2){
    const num=parseInt(parts[i],10); const body=parts[i+1]||'';
    const img = matchBlock(body, /\(?A\)?[^\n]*?(?:image\s*prompt)/i);
    const vid = matchBlock(body, /\(?B\)?[^\n]*?(?:image-?to-?video\s*prompt|video\s*prompt|image-?to-?video)/i);
    if(img||vid) out.push({ n:num, beat:'Scene '+num, imagePrompt:img||'', videoPrompt:vid||'' });
  }
  return out;
}
function matchBlock(body, labelRe){
  const m=body.match(labelRe); if(!m) return '';
  const start=m.index+m[0].length;
  const rest=body.slice(start);
  return cleanBlock(rest);
}
function cleanBlock(s){
  // stop at next (A)/(B) label, dialogue/caption/thumbnail heading, or scene marker
  const stop=s.search(/\n\s*(?:\(?[AB]\)?[^\n]*?prompt|image-?to-?video|dialogue|arabic|transliteration|meaning|caption|hashtag|thumbnail|={2,}|scene\s*\d)/i);
  let block=(stop>=0?s.slice(0,stop):s);
  return block.replace(/^(?:\s*prompt)?[:\s\-–)]+/i,'').trim().slice(0,1600);
}

/* Robust: scene-scoped parse, warna image/video labels ko order mein pair kar do */
function parsePrompts(text){
  const scoped=parseFreeText(text);
  if(scoped.length) return scoped.map((s,i)=>({n:s.n||i+1,beat:s.beat||('Scene '+(i+1)),imagePrompt:s.imagePrompt||'',videoPrompt:s.videoPrompt||''}));
  const re=/(image-?to-?video\s*prompt|video\s*prompt|image\s*prompt)/ig;
  let m, marks=[];
  while((m=re.exec(text))){ marks.push({type:/video|image-?to/i.test(m[1])?'vid':'img',start:m.index,end:m.index+m[0].length}); }
  if(!marks.length) return [];
  const imgs=[], vids=[];
  marks.forEach((mk,i)=>{ const next=marks[i+1]; const raw=text.slice(mk.end,next?next.start:text.length); const b=cleanBlock(raw); (mk.type==='img'?imgs:vids).push(b); });
  const count=Math.max(imgs.length,vids.length); const out=[];
  for(let i=0;i<count;i++) out.push({n:i+1,beat:'Scene '+(i+1),imagePrompt:imgs[i]||'',videoPrompt:vids[i]||''});
  return out;
}
function loadFromText(text){
  $('#err').style.display='none';
  if(!text||!text.trim()){ toast('Pehle prompts paste karo'); return; }
  const parsed=parsePrompts(text);
  if(!parsed.length){ showErr('Prompts pehchaan nahi paaya — har scene mein “IMAGE PROMPT:” aur “VIDEO PROMPT:” labels hon.'); log('⚠️ paste: koi prompt nahi mila','warn'); return; }
  SCENES=parsed.map(s=>({...s,imgDone:false,vidDone:false})); renderScenes();
  log('✓ '+SCENES.length+' scenes text se load ho gaye.','ok'); $('#cQueue').classList.remove('collapsed'); toast('Load ho gaya ✓');
}

/* ---------- render queue ---------- */
function esc(s){ return (s==null?'':String(s)).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function renderScenes(){
  $('#qCount').textContent=SCENES.length;
  if(!SCENES.length){ $('#scenesWrap').innerHTML='<div class="fine">Abhi koi scene nahi — upar se Generate karo.</div>'; return; }
  $('#scenesWrap').innerHTML=SCENES.map((s,i)=>`
    <div class="scene" id="sc${i}">
      <div class="scene-top"><span class="scene-n">${esc(s.n||i+1)}</span><b>${esc(s.beat||('Scene '+(i+1)))}</b>
        <span class="st ${s.vidDone?'vid':(s.imgDone?'img':'')}" id="st${i}">${s.vidDone?'video ✓':(s.imgDone?'image ✓':'pending')}</span></div>
      ${s.imagePrompt?`<div class="plab">🖼 Image prompt <button class="btn btn-ghost btn-sm" data-copy="${i}img">copy</button></div><div class="pr" id="pr${i}img">${esc(s.imagePrompt)}</div>`:''}
      ${s.videoPrompt?`<div class="plab">🎬 Video prompt <button class="btn btn-ghost btn-sm" data-copy="${i}vid">copy</button></div><div class="pr" id="pr${i}vid">${esc(s.videoPrompt)}</div>`:''}
      <div class="mini">
        ${s.imagePrompt?`<button class="btn btn-ghost btn-sm" data-run="${i}img">▶ image</button>`:''}
        ${s.videoPrompt?`<button class="btn btn-ghost btn-sm" data-run="${i}vid">▶ video</button>`:''}
      </div>
    </div>`).join('');
  $$('#scenesWrap [data-copy]').forEach(b=>b.onclick=()=>{ const t=$('#pr'+b.dataset.copy).textContent; navigator.clipboard.writeText(t); toast('Copy ✓'); });
  $$('#scenesWrap [data-run]').forEach(b=>b.onclick=()=>{ const i=parseInt(b.dataset.run); const kind=b.dataset.run.endsWith('vid')?'vid':'img'; runOne(i,kind); });
}
function setStatus(i,txt,cls){ const el=$('#st'+i); if(el){ el.textContent=txt; el.className='st '+(cls||''); } }

/* ---------- generate (auto) ---------- */
$('#genBtn').onclick=async()=>{
  $('#err').style.display='none';
  if(!(await store.get(LS.key))){ showErr('Pehle Setup mein Gemini key daalo — ya “Master prompt copy” karke Claude use karo.'); $('#cSetup').classList.remove('collapsed'); return; }
  $('#genBtn').disabled=true; $('#genBtn').textContent='… likh raha';
  try{
    log('Story generate ho rahi hai…');
    const d=parseJSON(await callGemini(buildInstruction(true)));
    if(!d.scenes||!d.scenes.length) throw new Error('Scenes nahi bane.');
    SCENES=d.scenes.map((s,i)=>({n:s.n||i+1,beat:s.beat||('Scene '+(i+1)),imagePrompt:s.imagePrompt||'',videoPrompt:s.videoPrompt||'',imgDone:false,vidDone:false}));
    lastFull=d; renderScenes();
    log('✓ '+SCENES.length+' scenes ban gaye. Title: '+(d.title||''),'ok');
    $('#cQueue').classList.remove('collapsed');
    toast('Ban gaya ✓');
  }catch(e){ let m=e.message; if(m==='NOKEY')m='Key nahi lagi.'; else if(m==='BADKEY')m='API key sahi nahi.'; showErr('⚠️ '+m); log('✗ '+m,'err'); }
  finally{ $('#genBtn').disabled=false; $('#genBtn').textContent='✨ Generate'; }
};
let lastFull=null;
$('#copyMaster').onclick=()=>{ navigator.clipboard.writeText(buildInstruction(false)); toast('Master prompt copy ✓ — Claude mein paste karo'); };
function showErr(m){ const e=$('#err'); e.innerHTML=m; e.style.display='block'; }

/* paste / .txt import */
$('#loadPaste').onclick=()=>loadFromText($('#pasteBox').value);
$('#pasteFile').onchange=(e)=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ $('#pasteBox').value=r.result||''; loadFromText($('#pasteBox').value); }; r.onerror=()=>toast('File padhi nahi gayi'); r.readAsText(f); e.target.value=''; };

/* ---------- tabs ---------- */
function isVeoUrl(u){ return /labs\.google|flow\.google|gemini\.google\.com|aistudio\.google\.com/.test(u||''); }
async function refreshTabs(){
  const tabs=await chrome.tabs.query({});
  const veo=tabs.filter(t=>isVeoUrl(t.url));
  const sel=$('#veoTab'); sel.innerHTML='';
  if(!veo.length){ sel.innerHTML='<option value="">— koi Veo/Flow tab khula nahi —</option>'; return; }
  veo.forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.textContent=(t.title||t.url).slice(0,42); sel.appendChild(o); });
}
$('#refreshTabs').onclick=refreshTabs;
async function veoTabId(){ const v=$('#veoTab').value; if(!v){ await refreshTabs(); } return parseInt($('#veoTab').value)||null; }

async function injectAgent(tabId){
  await chrome.scripting.executeScript({ target:{tabId}, files:['veo-agent.js'] });
}
function sendTab(tabId,msg){ return new Promise(res=>{ chrome.tabs.sendMessage(tabId,{__drama:true,...msg},r=>{ if(chrome.runtime.lastError) res({ok:false,error:chrome.runtime.lastError.message}); else res(r||{ok:false,error:'no reply'}); }); }); }

$('#pingVeo').onclick=async()=>{
  const id=await veoTabId(); if(!id) return toast('Pehle Veo tab kholo + refresh');
  try{ await injectAgent(id); const r=await sendTab(id,{cmd:'ping'});
    if(r.ok&&r.hasBox) log('✓ Prompt box mil gaya. Ready.','ok'); else log('⚠️ Prompt box nahi mila — Selectors card se manually do.','warn');
  }catch(e){ log('✗ '+e.message,'err'); }
};

/* ---------- Claude grab ---------- */
$('#grabClaude').onclick=async()=>{
  const tabs=await chrome.tabs.query({url:'https://claude.ai/*'});
  if(!tabs.length){ toast('Pehle claude.ai tab kholo'); return; }
  const id=tabs[0].id;
  try{
    await chrome.scripting.executeScript({target:{tabId:id},files:['claude-agent.js']});
    const r=await sendTab(id,{cmd:'grabClaude'});
    if(!r.ok||!r.text){ log('✗ Claude se text nahi mila.','err'); return; }
    const parsed=parsePrompts(r.text);
    if(!parsed.length){ log('⚠️ Claude ke jawab mein (A)/(B) prompts nahi pehchaan paaya. Format check karo.','warn'); return; }
    SCENES=parsed.map(s=>({...s,imgDone:false,vidDone:false})); renderScenes();
    log('✓ Claude se '+SCENES.length+' scenes aa gaye.','ok'); $('#cQueue').classList.remove('collapsed'); toast('Claude se aa gaya ✓');
  }catch(e){ log('✗ '+e.message,'err'); }
};

/* ---------- export for VEO Automation (blank-line lists / txt / csv) ---------- */
function imgList(){ return SCENES.map(s=>(s.imagePrompt||'').trim()).filter(Boolean).join('\n\n'); }
function vidList(){ return SCENES.map(s=>(s.videoPrompt||'').trim()).filter(Boolean).join('\n\n'); }
function csvCell(v){ v=(v==null?'':String(v)); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
function csvBuild(){
  const rows=[['scene','image_prompt','video_prompt']];
  SCENES.forEach((s,i)=>rows.push([s.n||i+1, s.imagePrompt||'', s.videoPrompt||'']));
  return rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
function downloadText(filename, text, mime){
  if(!text || !text.trim()){ toast('Pehle scenes banao'); return; }
  const blob=new Blob([text],{type:(mime||'text/plain')+';charset=utf-8'});
  const url=URL.createObjectURL(blob);
  chrome.downloads.download({url, filename, saveAs:false}, ()=>{ setTimeout(()=>URL.revokeObjectURL(url),5000); toast('Download: '+filename); });
}
function copyText(t){ if(!t||!t.trim()){ toast('Pehle scenes banao'); return; } navigator.clipboard.writeText(t); toast('Copy ✓'); }
$('#copyImgs').onclick=()=>copyText(imgList());
$('#copyVids').onclick=()=>copyText(vidList());
$('#dlImgs').onclick=()=>downloadText('drama-image-prompts.txt', imgList());
$('#dlVids').onclick=()=>downloadText('drama-video-prompts.txt', vidList());
$('#dlCsv').onclick=()=>downloadText('drama-prompts.csv', csvBuild(), 'text/csv');

/* ---------- run automation ---------- */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function runOne(i,kind){
  const id=await veoTabId(); if(!id){ toast('Veo tab chuno'); return false; }
  const s=SCENES[i]; const prompt=kind==='vid'?s.videoPrompt:s.imagePrompt;
  if(!prompt){ log('scene '+(i+1)+' '+kind+': prompt khaali','warn'); return false; }
  const sel=await getSelectors();
  const waitMs=(parseInt($('#waitSec').value)||120)*1000;
  try{
    await injectAgent(id);
    setStatus(i,kind+' chal raha…','busy'); log('Scene '+(i+1)+' '+kind+': fill + generate…');
    const r=await sendTab(id,{cmd:'fillAndGenerate',text:prompt,maxWaitMs:waitMs,selectors:sel});
    if(!r.ok){ setStatus(i,kind+' fail',''); log('✗ scene '+(i+1)+' '+kind+': '+(r.error||'?'),'err'); return false; }
    if(!r.media){ log('⚠️ scene '+(i+1)+' '+kind+': result confirm nahi hua (wait barhao?)','warn'); }
    else log('✓ scene '+(i+1)+' '+kind+' ready ('+Math.round(r.elapsed/1000)+'s).','ok');
    if($('#autoDownload').checked){ await sleep(1500); const d=await sendTab(id,{cmd:'download',selectors:sel});
      if(d.ok) log('  ⬇ download '+(d.clicked?'clicked':'(media mila)')); else log('  ⚠️ download button nahi mila','warn'); }
    if(kind==='vid'){ s.vidDone=true; setStatus(i,'video ✓','vid'); } else { s.imgDone=true; setStatus(i,'image ✓','img'); }
    return true;
  }catch(e){ log('✗ '+e.message,'err'); setStatus(i,'error',''); return false; }
}
async function runBatch(kind){
  if(RUNNING){ toast('Pehle se chal raha'); return; }
  const id=await veoTabId(); if(!id){ toast('Veo tab chuno + refresh'); return; }
  RUNNING=true; STOP=false; const gap=(parseInt($('#gapSec').value)||6)*1000;
  log('=== Batch '+kind+' start ('+SCENES.length+' scenes) ===');
  for(let i=0;i<SCENES.length;i++){
    if(STOP){ log('⏹ Stopped.','warn'); break; }
    await runOne(i,kind);
    if(i<SCENES.length-1){ await sleep(gap); }
  }
  RUNNING=false; log('=== Batch '+kind+' done ===','ok'); toast('Batch done');
}
$('#runImages').onclick=()=>runBatch('img');
$('#runVideos').onclick=()=>runBatch('vid');
$('#stopRun').onclick=()=>{ STOP=true; toast('Rukega agle step pe'); };

/* ========== FLOW AUTO (full recipe via flow-agent.js) ========== */
let FLOWMAP={};
(async()=>{ FLOWMAP=await store.get('flow_map')||{}; updateMapBadges(); })();
function updateMapBadges(){ document.querySelectorAll('[data-pick]').forEach(b=>{ const k=b.dataset.pick; const el=$('#m_'+k); if(el){ el.textContent=FLOWMAP[k]?'✓':'✗'; el.style.color=FLOWMAP[k]?'var(--ok)':'var(--muted)'; } }); }
async function injectFlow(tabId){ await chrome.scripting.executeScript({target:{tabId},files:['flow-agent.js']}); }

$('#moreMap').onclick=()=>{ const b=$('#moreMapBox'); b.style.display=b.style.display==='none'?'block':'none'; };
$('#resetMap').onclick=async()=>{ FLOWMAP={}; await store.set('flow_map',{}); updateMapBadges(); toast('Mapping reset'); };

let PICKING=null;
document.querySelectorAll('[data-pick]').forEach(b=>b.onclick=async()=>{
  const id=await veoTabId(); if(!id){ toast('Pehle Flow tab kholo + refresh'); return; }
  try{ await injectFlow(id); PICKING=b.dataset.pick; await sendTab(id,{cmd:'startPick',key:PICKING});
    log('👆 Flow tab pe jao aur "'+PICKING+'" wale button pe click karo…','warn'); toast('Flow tab pe click karo'); }
  catch(e){ log('✗ pick: '+e.message,'err'); }
});
chrome.runtime.onMessage.addListener((msg)=>{
  if(!msg||msg.__drama!==true||msg.type!=='pickResult') return;
  if(!msg.selector){ log('pick cancel','warn'); PICKING=null; return; }
  FLOWMAP[msg.key]=msg.selector; store.set('flow_map',FLOWMAP); updateMapBadges();
  log('✓ mapped "'+msg.key+'" → '+msg.selector.slice(0,50)+(msg.text?('  ('+msg.text+')'):''),'ok'); PICKING=null;
});

async function flowImage(id,i){
  const s=SCENES[i]; if(!s.imagePrompt){ log('scene '+(i+1)+': image prompt khaali','warn'); return null; }
  setStatus(i,'image chal raha…','busy'); log('Scene '+(i+1)+' IMAGE: recipe chala raha…');
  const r=await sendTab(id,{cmd:'runImage',map:FLOWMAP,prompt:s.imagePrompt,waitMs:(parseInt($('#fImgWait').value)||90)*1000});
  if(!r.ok){ setStatus(i,'image fail',''); log('✗ scene '+(i+1)+' image: '+(r.error||'?'),'err'); return null; }
  s.imageSrc=r.imageSrc||''; s.imgDone=true; setStatus(i,'image ✓','img');
  log('✓ scene '+(i+1)+' image ready ('+Math.round((r.elapsed||0)/1000)+'s)'+(s.imageSrc?'':' — src na mila, video attach fail ho sakta'),'ok');
  return s.imageSrc;
}
async function flowVideo(id,i){
  const s=SCENES[i]; if(!s.videoPrompt){ log('scene '+(i+1)+': video prompt khaali','warn'); return false; }
  setStatus(i,'video chal raha…','busy'); log('Scene '+(i+1)+' VIDEO: recipe chala raha…');
  const r=await sendTab(id,{cmd:'runVideo',map:FLOWMAP,prompt:s.videoPrompt,imageSrc:s.imageSrc||'',waitMs:(parseInt($('#fVidWait').value)||180)*1000,autoDownload:$('#fAutoDl').checked});
  if(r.frameWarn) log('  ⚠️ start-frame: '+r.frameWarn,'warn');
  if(!r.ok){ setStatus(i,'video fail',''); log('✗ scene '+(i+1)+' video: '+(r.error||'?'),'err'); return false; }
  s.vidDone=true; setStatus(i,'video ✓','vid');
  log('✓ scene '+(i+1)+' video ready ('+Math.round((r.elapsed||0)/1000)+'s)'+(r.downloaded?' ⬇ downloaded':''),'ok');
  return true;
}
async function flowRun(mode){ // 'all' | 'img' | 'vid'
  if(RUNNING){ toast('Pehle se chal raha'); return; }
  if(!SCENES.length){ toast('Pehle scenes banao'); return; }
  const id=await veoTabId(); if(!id){ toast('Flow tab chuno + refresh'); return; }
  if(!FLOWMAP.generate){ log('⚠️ “→ Generate” map nahi hai — pehle usay Pick karo warna auto-detect pe depend karega.','warn'); }
  RUNNING=true; STOP=false; const gap=(parseInt($('#gapSec')?.value)||6)*1000;
  try{ await injectFlow(id); }catch(e){ log('✗ inject: '+e.message,'err'); RUNNING=false; return; }
  log('=== Flow Auto ('+mode+') start — '+SCENES.length+' scenes ===');
  for(let i=0;i<SCENES.length;i++){
    if(STOP){ log('⏹ Stopped.','warn'); break; }
    if(mode==='all'){ const src=await flowImage(id,i); await sleep(gap); if(STOP)break; await flowVideo(id,i); }
    else if(mode==='img'){ await flowImage(id,i); }
    else { await flowVideo(id,i); }
    if(i<SCENES.length-1) await sleep(gap);
  }
  RUNNING=false; log('=== Flow Auto done ===','ok'); toast('Flow batch done');
}
$('#fRunAll').onclick=()=>flowRun('all');
$('#fRunImgs').onclick=()=>flowRun('img');
$('#fRunVids').onclick=()=>flowRun('vid');
$('#fStop').onclick=()=>{ STOP=true; toast('Rukega agle step pe'); };
