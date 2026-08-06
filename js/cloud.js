/* cloud.js — Firebase (optional).
   - LIVE share links: publishes each shared customer's hisaab to a public
     `share/{token}` doc so a permanent link always shows the current hisaab.
   - Cross-device sync (optional): mirrors the whole dataset to `khatas/{syncId}`.
   Stays a no-op until a Firebase config is present (firebase-config.js or Settings). */

const Cloud = (() => {
  let ready = false, syncOn = false, db = null, docRef = null, unsub = null, pushT = null, onRemote = null;
  let status = 'idle', onStatusCb = null, dirty = false, retryT = null, onlineHooked = false, curSyncId = null;
  // FAST BACKUP: delta doc — sirf nayi/badli hui entries chhoti si upload hoti hain
  // (slow net par bhi foran), poora bara snapshot background me kabhi kabhi jata hai.
  let deltaRef = null, deltaUnsub = null, deltaT = null, fullT = null;
  let fullPushedIds = new Set(); // aakhri POORE push me jo ids gayi thi
  let lastDelStr = '';           // aakhri delete-list jo delta me bheji
  const CHUNK = 700000; // base64 chars per chunk doc (Firestore 1 MiB limit ke neeche)
  function setStatus(s) { if (s === status) return; status = s; if (onStatusCb) { try { onStatusCb(s); } catch (e) {} } }

  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('load ' + src));
      document.head.appendChild(s);
    });
  }
  async function loadSDK() {
    if (window.firebase && window.firebase.firestore) return;
    const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    await loadScript(base + 'firebase-app-compat.js');
    await loadScript(base + 'firebase-auth-compat.js');
    await loadScript(base + 'firebase-firestore-compat.js');
  }

  function getActiveConfig() {
    const c = (Store.getShop().cloud) || {};
    if (c.config) { try { return typeof c.config === 'string' ? JSON.parse(c.config) : c.config; } catch (e) {} }
    if (typeof window !== 'undefined' && window.FIREBASE_CONFIG) return window.FIREBASE_CONFIG;
    return null;
  }

  async function init(cb) {
    onRemote = cb;
    const cfg = getActiveConfig();
    if (!cfg) { ready = false; return { ok: false }; }
    try {
      await loadSDK();
      firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      await firebase.auth().signInAnonymously();
      db = firebase.firestore();
      // OFFLINE PERSISTENCE: data local par cache ho jaye taake net na hone par bhi
      // aakhri synced hisaab dikhe, aur net aate hi khud (bina refresh) update ho jaye.
      try { await db.enablePersistence({ synchronizeTabs: true }); } catch (e) { console.warn('persistence', e && e.code); }
      ready = true;
      // reset-marker ko durable (IndexedDB) rakho: localStorage clear ho jaye to bhi
      // marker mehfooz — taake purana import-reset dobara chal kar entries na mita de.
      try {
        const dm = await Store.getMeta('reset');
        let lm = null; try { lm = localStorage.getItem(RKEY); } catch (e) {}
        if (dm && !lm) { try { localStorage.setItem(RKEY, dm); } catch (e) {} }     // localStorage bahal
        else if (lm && dm !== lm) { try { Store.setMeta('reset', lm); } catch (e) {} } // mojooda marker durable karo
      } catch (e) {}
      const c = (Store.getShop().cloud) || {};
      if (c.enabled && c.syncId) { try { await startSync(String(c.syncId).trim()); } catch (e) { console.warn('sync', e); } }
      return { ok: true };
    } catch (e) { ready = false; console.warn('cloud init', e); return { ok: false, error: e.message || String(e) }; }
  }

  /* ---- gzip helpers (bara data Firestore ki 1MB limit me fit karne ke liye) ---- */
  async function gzipB64(str) {
    if (typeof CompressionStream === 'undefined') return null;
    const cs = new CompressionStream('gzip');
    const buf = await new Response(new Blob([new TextEncoder().encode(str)]).stream().pipeThrough(cs)).arrayBuffer();
    const bytes = new Uint8Array(buf); let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(bin);
  }
  async function gunzipB64(b64) {
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ds = new DecompressionStream('gzip');
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new TextDecoder().decode(buf);
  }
  const RKEY = 'altariq_reset';
  const PSIG = 'altariq_pushsig'; // aakhri kamyab push ka signature
  // Reset-marker DURABLE: localStorage + IndexedDB dono me. Agar localStorage clear
  // ho jaye to bhi marker mehfooz — warna purana ek-baar ka import-reset dobara chal
  // kar (baad ki) entries mita sakta tha. Ye us khatarnak data-loss ko rokta hai.
  function getResetMarker() { try { return localStorage.getItem(RKEY) || ''; } catch (e) { return ''; } }
  function setResetMarker(m) { try { localStorage.setItem(RKEY, m); } catch (e) {} try { Store.setMeta('reset', m); } catch (e) {} }

  // Data ka halka signature (bina poora stringify) — add/edit/delete pakadta hai
  function dataSig() {
    const d = Store.getData(); let n = 0, s = 0;
    const acc = arr => (arr || []).forEach(c => (c.txns || []).forEach(t => { n++; s += (t.amount || 0); }));
    acc(d.customers); acc(d.suppliers);
    return (d.customers || []).length + '/' + (d.suppliers || []).length + '/' + n + '/' + Math.round(s);
  }
  // Agar local data cloud par bheje gaye se mukhtalif hai to push karo (unpushed entries mehfooz)
  function pushIfNeeded() {
    if (!docRef || !syncOn) return;
    try { if (dataSig() !== localStorage.getItem(PSIG)) schedulePush(); } catch (e) {}
  }

  // Clean rebuild: sirf LEDGER (customers/suppliers/items) replace karo — har device
  // ke apne shop settings (Sync ID, PIN, viewerBase) bilkul mehfooz rehte hain.
  function applyReset(rd) {
    const cur = Store.getData();
    // purane shared links (shareId) naam se match karke barqarar rakho — taake
    // pehle bheje gaye link band na hon aur naye data se update hote rahein.
    const keep = {};
    (cur.customers || []).forEach(c => { if (c.shareId) keep['c:' + c.name] = c.shareId; });
    (cur.suppliers || []).forEach(c => { if (c.shareId) keep['s:' + c.name] = c.shareId; });
    (rd.customers || []).forEach(c => { const k = keep['c:' + c.name]; if (k && !c.shareId) c.shareId = k; });
    (rd.suppliers || []).forEach(c => { const k = keep['s:' + c.name]; if (k && !c.shareId) c.shareId = k; });
    const merged = Object.assign({}, cur, {
      customers: rd.customers || [],
      suppliers: rd.suppliers || [],
      items: rd.items || []
    });
    Store.replaceAll(merged); // shop reference cur se aata hai — preserve
  }

  /* ---- dataset sync ---- */
  // Normal: union-merge (koi entry na khoye). Lekin agar remote par naya "fullReset"
  // marker ho (ek dafa clean rebuild) to ledger replace kar do — taake purana/
  // duplicate data saaf ho jaye. Bara data gzip me store hota hai.
  async function pull(sd, capture) {
    if (!sd) return false;
    let json = null;
    try {
      if (sd.chunks && sd.chunks > 0) {           // bara data — kai docs me
        let b64 = '';
        for (let i = 0; i < sd.chunks; i++) {
          const cs = await db.collection('khatas').doc(curSyncId + '_c' + i).get();
          if (!cs.exists) return false;
          b64 += (cs.data().part || '');
        }
        json = await gunzipB64(b64);
      } else if (sd.gz) json = await gunzipB64(sd.gz);
      else if (sd.payload) json = sd.payload;
    } catch (e) { console.warn('decompress', e); return false; }
    if (!json) return false;
    let rd; try { rd = JSON.parse(json); } catch (e) { return false; }

    // startup: cloud me jo pehle se hai wahi "base" hai — is se aage ki (aur band app
    // ke doran ki) entries chhote delta me foran jayengi, na ke bara snapshot ka intezaar.
    if (capture) {
      fullPushedIds = new Set();
      const add = list => (list || []).forEach(p => {
        (p.txns || []).forEach(t => fullPushedIds.add(t.id));
        (p.quotes || []).forEach(q => fullPushedIds.add(q.id));
      });
      add(rd.customers); add(rd.suppliers);
      lastDelStr = JSON.stringify(rd.deletedIds || {});
    }

    // one-time clean replace — SIRF jab marker waqai naya ho (durable marker se check)
    if (sd.fullReset && String(sd.fullReset) !== getResetMarker()) {
      try {
        // ledger replace karne se PEHLE mojooda data ka snapshot le lo (kuch bhi ho to
        // 'Purani Backups' se wapas laaya ja sake) — safety net.
        try { await Store.forceSnapshot('pre-reset'); } catch (e) {}
        applyReset(rd); setResetMarker(String(sd.fullReset)); if (onRemote) onRemote(); schedulePush(); return true;
      }
      catch (e) { console.warn('reset', e); return false; }
    }
    let changed = false;
    try { changed = Store.mergeRemote(rd); } catch (e) { console.warn('merge', e); return false; }
    if (changed) { if (onRemote) onRemote(); schedulePush(); }
    return changed;
  }
  /* ---- FAST delta backup ---- */
  // Aakhri poore push ke baad se jo nayi entries/rates hain unhe jama karo
  function markAllPushed() {
    const d = Store.getData();
    fullPushedIds = new Set();
    const add = list => (list || []).forEach(p => {
      (p.txns || []).forEach(t => fullPushedIds.add(t.id));
      (p.quotes || []).forEach(q => fullPushedIds.add(q.id));
    });
    add(d.customers); add(d.suppliers);
    lastDelStr = JSON.stringify(d.deletedIds || {});
  }
  function buildDelta() {
    const d = Store.getData();
    const pick = list => {
      const out = [];
      (list || []).forEach(p => {
        const nt = (p.txns || []).filter(t => !fullPushedIds.has(t.id));
        const nq = (p.quotes || []).filter(q => !fullPushedIds.has(q.id));
        if (nt.length || nq.length) out.push({ id: p.id, name: p.name, phone: p.phone, shareId: p.shareId, txns: nt, quotes: nq });
      });
      return out;
    };
    return { v: 1, c: pick(d.customers), s: pick(d.suppliers), del: d.deletedIds || {} };
  }
  // Sirf changes ki chhoti si upload — slow net par bhi foran ho jaati hai
  async function pushDelta() {
    if (!deltaRef || !syncOn) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setStatus('offline'); return; }
    const payload = buildDelta();
    const delStr = JSON.stringify(payload.del);
    if (!payload.c.length && !payload.s.length && delStr === lastDelStr) return; // kuch naya nahi
    setStatus('saving');
    try {
      await deltaRef.set({ d: JSON.stringify(payload), updatedAt: new Date().toISOString() });
      lastDelStr = delStr;
      setStatus('saved'); // user ko foran "backup ho gaya" — bara snapshot background me
    } catch (e) { console.warn('delta', e); setStatus('pending'); /* full push cover kar lega */ }
  }

  async function push() {
    if (!docRef) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { dirty = true; setStatus('offline'); return; }
    try {
      const snapData = Store.getData();
      const json = JSON.stringify(snapData);
      // JIS data ko abhi bhej rahe hain, USI ke ids ko "pushed" mark karo — await ke
      // DAURAN agar nayi entry add ho jaye, wo agle delta me jaye (cloud se na chhoote).
      const pushedIds = new Set();
      const addIds = list => (list || []).forEach(p => { (p.txns || []).forEach(t => pushedIds.add(t.id)); (p.quotes || []).forEach(q => pushedIds.add(q.id)); });
      addIds(snapData.customers); addIds(snapData.suppliers);
      const pushedDel = JSON.stringify(snapData.deletedIds || {});
      const doc = { updatedAt: new Date().toISOString() };
      const r = getResetMarker(); if (r) doc.fullReset = r; // marker barqarar rakho
      const gz = await gzipB64(json);
      if (gz) {
        if (gz.length <= 900000) { doc.gz = gz; doc.chunks = 0; }
        else {                                    // 1 MiB se bara — kai docs me tor do
          const parts = [];
          for (let i = 0; i < gz.length; i += CHUNK) parts.push(gz.slice(i, i + CHUNK));
          for (let i = 0; i < parts.length; i++) await db.collection('khatas').doc(curSyncId + '_c' + i).set({ part: parts[i] });
          doc.chunks = parts.length;              // chunks pehle likho, phir main doc
        }
      } else { doc.payload = json; doc.chunks = 0; }
      await docRef.set(doc);
      dirty = false; clearTimeout(retryT);
      fullPushedIds = pushedIds; lastDelStr = pushedDel; // JO bheja wahi base (race-safe)
      try { localStorage.setItem(PSIG, dataSig()); } catch (e) {}
      // stale delta doc khaali kar do (ab main doc me sab kuch hai)
      if (deltaRef) { try { await deltaRef.set({ d: JSON.stringify({ v: 1, c: [], s: [], del: snapData.deletedIds || {} }), updatedAt: new Date().toISOString() }); } catch (e) {} }
      // agar upload ke doran koi nayi entry aayi thi (jo bheji nahi gayi), foran delta bhej do
      if (dataSig() !== localStorage.getItem(PSIG)) schedulePush();
      setStatus('saved');
    } catch (e) {
      console.warn('push', e); dirty = true; setStatus('error');
      clearTimeout(retryT); retryT = setTimeout(push, 8000); // khud dobara koshish
    }
  }
  // Har change par: pehle FORAN chhota delta bhejo, bara snapshot thori der baad background me
  function schedulePush() {
    if (!syncOn) return;
    dirty = true; setStatus('pending');
    clearTimeout(deltaT); deltaT = setTimeout(pushDelta, 300);   // fast: sirf changes (live)
    clearTimeout(fullT); fullT = setTimeout(push, 12000);        // slow: poora snapshot
  }
  function retry() { clearTimeout(retryT); return push(); }
  // Receiver: chhota delta aaya to foran mila do (mergeRemote union+tombstone safe hai)
  function pullDelta(dd) {
    if (!dd || !dd.d) return;
    let p; try { p = JSON.parse(dd.d); } catch (e) { return; }
    if (!p) return;
    const rd = { customers: p.c || [], suppliers: p.s || [], items: [], deletedIds: p.del || {}, updatedAt: 0 };
    let changed = false; try { changed = Store.mergeRemote(rd); } catch (e) { return; }
    if (changed && onRemote) onRemote(); // sirf UI update — receiver dobara push na kare (loop se bacho)
  }
  async function startSync(syncId) {
    curSyncId = String(syncId).trim();
    docRef = db.collection('khatas').doc(curSyncId);
    deltaRef = db.collection('khatas').doc(curSyncId + '_d');
    const snap = await docRef.get();
    if (snap.exists) {
      const d = snap.data();
      const hasData = d && (d.gz || d.payload || d.chunks); // doc me pehle se data hai?
      const adopted = await pull(d, true); // cloud ke ids ko base bana lo
      // Agar doc me data mojood hai lekin hum use padh nahi paye, to us par apna data
      // OVERWRITE mat karo (warna clean data zaya ho jaye). Sirf khaali doc par push.
      if (!adopted && !hasData) await push();
    } else { await push(); }
    // koi pending delta (jo abhi main doc me na aaya ho) foran mila lo
    try { const ds = await deltaRef.get(); if (ds.exists) pullDelta(ds.data()); } catch (e) {}
    if (fullPushedIds.size === 0) markAllPushed(); // fallback agar base set na hua
    unsub = docRef.onSnapshot(s => { if (s.exists) pull(s.data()); }, e => console.warn('sub', e));
    deltaUnsub = deltaRef.onSnapshot(s => { if (s.exists) pullDelta(s.data()); }, e => console.warn('dsub', e));
    syncOn = true;
    Store.onSave(schedulePush);
    pushIfNeeded(); // app khulte hi: koi local entry jo pichli dafa push na hui thi, ab bhej do
    if (!onlineHooked && typeof window !== 'undefined') {
      onlineHooked = true;
      window.addEventListener('online', () => { if (docRef) refresh().then(pushIfNeeded); });
      window.addEventListener('offline', () => setStatus('offline'));
      // App wapis khulte/foreground aate hi: FORAN taza data lo aur local unpushed changes bhej do
      const onResume = () => { if (!docRef) return; if (typeof document !== 'undefined' && document.hidden) return; refresh().then(pushIfNeeded); };
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
        // App band/background hote hi: abhi ka chhota delta FORAN bhej do (taake aakhri
        // entry band karne se pehle mehfooz ho jaye — bara snapshot ka intezaar na ho).
        if (document.hidden) { clearTimeout(deltaT); pushDelta(); } else onResume();
      });
      window.addEventListener('focus', onResume);
    }
  }
  // cloud se seedha taza data khud maang lo (onSnapshot ka intezaar na karo)
  function refresh() {
    if (!docRef) return Promise.resolve(false);
    return docRef.get().then(s => (s.exists ? pull(s.data()) : false)).catch(() => false);
  }

  /* ---- live share links ---- */
  async function publishShare(token, data) {
    if (!ready || !db || !token) return false;
    // JSON string me store karo — Firestore nested arrays (txn payload) ko allow nahi karta.
    try { await db.collection('share').doc(token).set({ data: JSON.stringify(data), updatedAt: new Date().toISOString() }); return true; }
    catch (e) { console.warn('publishShare', e); return false; }
  }
  async function fetchShare(token) {
    if (!db || !token) return null;
    try { const s = await db.collection('share').doc(token).get(); return s.exists ? s.data() : null; }
    catch (e) { console.warn('fetchShare', e); return null; }
  }

  /* ---- one-time clean import (final Udhaar data) ----
     Sirf naye code (v19+) me chalta hai, isliye purana app is race me nahi aata.
     Incoming snapshots ko rok kar clean data local par likho, marker set karo,
     phir cloud par push karo taake doosra device (bhi v19) fullReset uthaye. */
  async function importFromGz(b64, marker) {
    let json = await gunzipB64(b64);
    const rd = JSON.parse(json);
    if (!rd || !Array.isArray(rd.customers)) throw new Error('bad import data');
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    try { await Store.forceSnapshot('pre-import'); } catch (e) {}
    applyReset(rd);
    setResetMarker(String(marker));
    if (docRef) {
      await push(); // gz + fullReset=marker
      unsub = docRef.onSnapshot(s => { if (s.exists) pull(s.data()); }, e => console.warn('sub', e));
    }
    if (onRemote) onRemote();
    return { customers: rd.customers.length, txns: rd.customers.reduce((n, c) => n + (c.txns || []).length, 0) };
  }

  async function testConnect(configStr, syncId) {
    try {
      const cfg = configStr ? JSON.parse(configStr) : getActiveConfig();
      if (!cfg) return { ok: false, error: 'Config nahi mila' };
      await loadSDK();
      firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      await firebase.auth().signInAnonymously();
      await firebase.firestore().collection('khatas').doc(String(syncId || 'test').trim()).get();
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message || String(e) }; }
  }

  // "Dono phone barabar karo" — IS phone ka poora hisaab authoritative bana kar bhej do.
  // Doosra phone (jaise Abu ka) fullReset marker dekh kar apna ledger ISI se badal lega,
  // is liye har farq (edit/duplicate/purani entry) foran khatam ho jata hai.
  async function forceResetAll() {
    if (!docRef || !syncOn) return { ok: false, error: 'Pehle Cloud Sync ON karein' };
    try {
      setResetMarker('force-' + Date.now()); // naya DURABLE marker; apne aap ko dobara reset na karo
      await push(); // poora data + fullReset marker — doosra phone isko apna lega
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message || String(e) }; }
  }

  return { init, isReady: () => ready, isSyncOn: () => syncOn, publishShare, fetchShare, testConnect, importFromGz, forceResetAll,
    getStatus: () => ({ state: status, dirty }), onStatus: cb => { onStatusCb = cb; }, retry, refresh };
})();
