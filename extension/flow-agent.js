/* flow-agent.js — Google Flow (labs.google/fx/tools/flow) ke andar.
   Asli UI ke hisaab se tuned (screenshots se):
     - Prompt box   : [data-slate-editor="true"]  (Slate contenteditable)
     - Start frame  : input[type="file"][accept="image/*"]
     - Buttons text  : Image / Video / Frames / 9:16 / x1 / Start  (text se auto-click)
     - Sirf →(submit) aur Download icon-only hain -> "pick" se sikhaye jaate hain.
   RECIPE:
     IMAGE : Image tab -> 9:16 -> x1 -> prompt -> Generate(→)
     VIDEO : Video tab -> Frames -> 9:16 -> start-frame(image) -> video prompt -> Generate(→) -> Download(1080p)
   Kuch stealth nahi — wahi clicks jo aap haath se karte. */
(() => {
  if (window.__dramaFlowAgent) return;
  window.__dramaFlowAgent = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vis = el => { if(!el) return false; const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return r.width>2&&r.height>2&&s.visibility!=='hidden'&&s.display!=='none'&&s.opacity!=='0'; };
  const q = sel => { try { return sel ? document.querySelector(sel) : null; } catch(e){ return null; } };

  /* ---------- text-based click (Flow labels) ---------- */
  function clickByText(labels){
    const set = labels.map(s=>s.toLowerCase());
    const els = [...document.querySelectorAll('button,[role="button"],[role="tab"],[role="radio"],div,span,li,a,p')].filter(vis);
    let best=null, bestLen=1e9;
    for(const el of els){
      const t=(el.textContent||'').trim().toLowerCase();
      if(!t || t.length>=bestLen) continue;
      if(set.includes(t) && el.querySelectorAll('*').length<=6){ best=el; bestLen=t.length; }
    }
    if(!best) return false;
    (best.closest('button,[role="button"],[role="tab"],[role="radio"],a')||best).click();
    return true;
  }

  /* ---------- prompt (Slate) ---------- */
  const PROMPT_SEL = '[data-slate-editor="true"],[role="textbox"][contenteditable="true"]';
  function promptBox(sel){ return q(sel) || [...document.querySelectorAll(PROMPT_SEL)].filter(vis).pop() || null; }
  // asli paste event simulate — Slate/React model ko update karta hai (button enable hota hai)
  function simulatePaste(el, text){
    try{
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      try{ dt.setData('text', text); }catch(e){}
      let ev;
      try{ ev = new ClipboardEvent('paste', { bubbles:true, cancelable:true, clipboardData:dt }); }
      catch(e){ ev = new Event('paste', { bubbles:true, cancelable:true }); }
      if(!ev.clipboardData){ try{ Object.defineProperty(ev,'clipboardData',{ value:dt }); }catch(e){} }
      el.dispatchEvent(ev);
      return true;
    }catch(e){ return false; }
  }
  function setPrompt(sel, text){
    const el = promptBox(sel); if(!el) return false;
    el.focus();
    if(el.tagName==='TEXTAREA'||el.tagName==='INPUT'){
      const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(p,'value').set.call(el,text);
      el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }
    // ---- contenteditable / Slate ----
    // 1) purana text clear (native beforeinput -> Slate model)
    try{ document.execCommand('selectAll',false); document.execCommand('delete',false); }catch(e){}
    // 2) PASTE simulate (yehi manual paste jaisa hai -> model + button update)
    let before = (el.textContent||'');
    simulatePaste(el, text);
    // 3) agar paste ne kaam na kiya to beforeinput insertFromPaste + execCommand fallback
    if((el.textContent||'') === before){
      try{
        el.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertFromPaste',data:text}));
      }catch(e){}
      try{ document.execCommand('insertText',false,text); }catch(e){}
    }
    // 4) frameworks ko nudge (canSubmit recompute)
    el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:text}));
    el.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'End'}));
    el.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:'End'}));
    return true;
  }

  /* ---------- generic ---------- */
  function clickSel(sel){ const el=q(sel); if(!el||!vis(el)) return false; el.click(); return true; }
  async function openClick(openSel,valSel){ if(!valSel) return false; if(openSel){clickSel(openSel);await sleep(500);} return clickSel(valSel); }

  /* ---------- start frame: set the image file into Flow's file input ---------- */
  async function attachFrame(sel, src){
    if(!src) return {ok:false, why:'no image'};
    let file;
    try{ const r=await fetch(src); const b=await r.blob(); file=new File([b],'frame.png',{type:b.type||'image/png'}); }
    catch(e){
      try{ const img=[...document.images].find(i=>i.src===src); if(img){ const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; c.getContext('2d').drawImage(img,0,0); const b=await new Promise(res=>c.toBlob(res,'image/png')); file=new File([b],'frame.png',{type:'image/png'}); } }catch(e2){}
    }
    if(!file) return {ok:false, why:'image fetch/canvas fail (CORS) — is scene ka start-frame haath se laga do'};
    let input = q(sel);
    if(!input || input.tagName!=='INPUT' || input.type!=='file'){
      input = document.querySelector('input[type="file"][accept*="image"]') || document.querySelector('input[type="file"]');
    }
    if(!input) return {ok:false, why:'file input nahi mila'};
    const dt=new DataTransfer(); dt.items.add(file); input.files=dt.files;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return {ok:true};
  }

  const newestImg = () => { const a=[...document.images].filter(i=>vis(i)&&i.naturalWidth>200); return a.length?a[a.length-1].src:''; };
  const newestVid = () => { const a=[...document.querySelectorAll('video')].filter(vis); return a.length?(a[a.length-1].currentSrc||a[a.length-1].src):''; };

  async function waitResult(kind, maxMs, map){
    const start=Date.now(); const baseV=document.querySelectorAll('video').length; const baseI=document.images.length;
    while(Date.now()-start<maxMs){
      if(kind==='video'){ const dl=q(map.download); if(document.querySelectorAll('video').length>baseV || (dl&&vis(dl))) return {ok:true,elapsed:Date.now()-start,src:newestVid()}; }
      else { if(document.images.length>baseI){ await sleep(1500); return {ok:true,elapsed:Date.now()-start,src:newestImg()}; } }
      await sleep(2500);
    }
    return {ok:false, elapsed:maxMs, src: kind==='video'?newestVid():newestImg()};
  }

  function doGenerate(map){ if(map.generate && clickSel(map.generate)) return true; return clickByText(['generate','create','submit']); }

  async function runImage(map, prompt, waitMs){
    (map.modeImage && clickSel(map.modeImage)) || clickByText(['image']); await sleep(700);
    (map.ratio_val ? await openClick(map.ratio_open,map.ratio_val) : clickByText(['9:16'])); await sleep(300);
    (map.outputs_val ? await openClick(map.outputs_open,map.outputs_val) : clickByText(['x1'])); await sleep(300);
    if(map.model_val) { await openClick(map.model_open,map.model_val); await sleep(300); }
    if(!setPrompt(map.prompt, prompt)) return {ok:false, error:'prompt box nahi mila'};
    await sleep(500);
    if(!doGenerate(map)) return {ok:false, error:'Generate (→) nahi mila — usay “pick” karo'};
    const r=await waitResult('image', waitMs, map);
    return {ok:r.ok, imageSrc:r.src, elapsed:r.elapsed, error:r.ok?'':'image confirm nahi hua (wait barhao)'};
  }

  async function runVideo(map, prompt, imageSrc, waitMs, autoDownload, qualityWaitMs){
    (map.modeVideo && clickSel(map.modeVideo)) || clickByText(['video']); await sleep(700);
    (map.modeFrames && clickSel(map.modeFrames)) || clickByText(['frames']); await sleep(600);
    (map.vratio_val ? await openClick(map.vratio_open,map.vratio_val) : clickByText(['9:16'])); await sleep(300);
    let frame={ok:true};
    if(imageSrc){ frame=await attachFrame(map.startFrame, imageSrc); await sleep(1000); }
    if(map.model_v_val){ await openClick(map.model_v_open,map.model_v_val); await sleep(300); }
    if(!setPrompt(map.prompt, prompt)) return {ok:false, error:'prompt box nahi mila'};
    await sleep(500);
    if(!doGenerate(map)) return {ok:false, error:'Generate (→) nahi mila — usay “pick” karo'};
    const r=await waitResult('video', waitMs, map);
    let dl=false;
    if(autoDownload && r.ok){
      await sleep(1500);
      // download control kholo (menu aata hai; direct = 720p)
      const opened = clickSel(map.download) || clickByText(['download','export']);
      if(opened){
        await sleep(1400);
        // 1080p option -> Flow ise upscale karke download karta hai
        const hi = (map.quality_val && clickSel(map.quality_val)) || clickByText(['1080p','1080p (upscaled)','1080','full hd','1080 p']);
        dl = true;
        if(hi){ await sleep(qualityWaitMs||8000); } // upscale ko thoda waqt do (download background mein hoga)
      }
    }
    return {ok:r.ok, elapsed:r.elapsed, downloaded:dl, frameWarn:frame.ok?'':frame.why, error:r.ok?'':'video confirm nahi hua (wait barhao)'};
  }

  /* ---------- LEARN / PICK ---------- */
  const escc = s => (window.CSS&&CSS.escape)?CSS.escape(s):String(s).replace(/[^a-zA-Z0-9_-]/g,'\\$&');
  const uniq = s => { try { return document.querySelectorAll(s).length===1; } catch(e){ return false; } };
  function selectorFor(el){
    if(!el||el.nodeType!==1) return '';
    if(el.id && uniq('#'+escc(el.id))) return '#'+escc(el.id);
    for(const a of ['data-testid','aria-label','name','data-value','title']){ const v=el.getAttribute&&el.getAttribute(a); if(v){ const s=el.tagName.toLowerCase()+'['+a+'="'+v.replace(/"/g,'\\"')+'"]'; if(uniq(s)) return s; } }
    const path=[]; let n=el, d=0;
    while(n&&n.nodeType===1&&d<7){ if(n.id){ path.unshift('#'+escc(n.id)); break; } let seg=n.tagName.toLowerCase(); const p=n.parentElement; if(p){ const sib=[...p.children].filter(c=>c.tagName===n.tagName); if(sib.length>1) seg+=':nth-of-type('+(sib.indexOf(n)+1)+')'; } path.unshift(seg); n=p; d++; }
    return path.join(' > ');
  }
  let picking=null, hl=null, banner=null;
  function ensureHL(){ if(hl) return hl; hl=document.createElement('div'); Object.assign(hl.style,{position:'fixed',zIndex:2147483647,pointerEvents:'none',border:'2px solid #e7a24c',background:'rgba(231,162,76,.15)',borderRadius:'6px'}); document.documentElement.appendChild(hl); return hl; }
  function showBanner(t){ if(!banner){ banner=document.createElement('div'); Object.assign(banner.style,{position:'fixed',zIndex:2147483647,left:'50%',top:'12px',transform:'translateX(-50%)',background:'#111319',color:'#f8da98',border:'1px solid #e7a24c',padding:'8px 14px',borderRadius:'20px',font:'700 13px system-ui',pointerEvents:'none'}); document.documentElement.appendChild(banner);} banner.textContent=t; banner.style.display='block'; }
  function hideUI(){ if(banner)banner.style.display='none'; if(hl)hl.style.display='none'; }
  const onMove=e=>{ const el=e.target; if(!el||el===hl) return; const r=el.getBoundingClientRect(); const h=ensureHL(); h.style.display='block'; h.style.left=r.left+'px'; h.style.top=r.top+'px'; h.style.width=r.width+'px'; h.style.height=r.height+'px'; };
  const onClick=e=>{ e.preventDefault(); e.stopPropagation(); const el=e.target; finishPick(selectorFor(el),(el.innerText||el.getAttribute?.('aria-label')||'').trim().slice(0,40)); };
  const onKey=e=>{ if(e.key==='Escape') finishPick('',''); };
  function startPick(key){ picking=key; document.addEventListener('mousemove',onMove,true); document.addEventListener('click',onClick,true); document.addEventListener('keydown',onKey,true); showBanner('👆 "'+key+'" wale button pe click karo  (Esc = cancel)'); }
  function finishPick(sel,text){ document.removeEventListener('mousemove',onMove,true); document.removeEventListener('click',onClick,true); document.removeEventListener('keydown',onKey,true); hideUI(); const k=picking; picking=null; try{ chrome.runtime.sendMessage({__drama:true,type:'pickResult',key:k,selector:sel,text}); }catch(e){} }

  chrome.runtime.onMessage.addListener((msg,_s,reply)=>{
    if(!msg||msg.__drama!==true) return;
    if(!['ping','startPick','cancelPick','testClick','runImage','runVideo'].includes(msg.cmd)) return;
    (async()=>{ try{
      if(msg.cmd==='ping'){ const box=promptBox(msg.map&&msg.map.prompt); return reply({ok:true,url:location.href,isFlow:/labs\.google\/fx\/tools\/flow/.test(location.href),promptFound:!!box}); }
      if(msg.cmd==='startPick'){ startPick(msg.key); return reply({ok:true}); }
      if(msg.cmd==='cancelPick'){ finishPick('',''); return reply({ok:true}); }
      if(msg.cmd==='testClick'){ return reply({ok:clickSel(msg.sel)}); }
      if(msg.cmd==='runImage'){ return reply(await runImage(msg.map||{}, msg.prompt, msg.waitMs||180000)); }
      if(msg.cmd==='runVideo'){ return reply(await runVideo(msg.map||{}, msg.prompt, msg.imageSrc, msg.waitMs||240000, msg.autoDownload, msg.qualityWaitMs||8000)); }
      return reply({ok:false,error:'unknown cmd'});
    }catch(e){ reply({ok:false,error:String(e&&e.message||e)}); } })();
    return true;
  });
})();
