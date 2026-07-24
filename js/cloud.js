/* cloud.js — Firebase (optional).
   - LIVE share links: publishes each shared customer's hisaab to a public
     `share/{token}` doc so a permanent link always shows the current hisaab.
   - Cross-device sync (optional): mirrors the whole dataset to `khatas/{syncId}`.
   Stays a no-op until a Firebase config is present (firebase-config.js or Settings). */

const Cloud = (() => {
  let ready = false, syncOn = false, db = null, docRef = null, unsub = null, pushT = null, onRemote = null;
  let status = 'idle', onStatusCb = null, dirty = false, retryT = null, onlineHooked = false, curSyncId = null;
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
      ready = true;
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
  async function pull(sd) {
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

    // one-time clean replace
    if (sd.fullReset && String(sd.fullReset) !== (localStorage.getItem(RKEY) || '')) {
      try { applyReset(rd); localStorage.setItem(RKEY, String(sd.fullReset)); if (onRemote) onRemote(); schedulePush(); return true; }
      catch (e) { console.warn('reset', e); return false; }
    }
    let changed = false;
    try { changed = Store.mergeRemote(rd); } catch (e) { console.warn('merge', e); return false; }
    if (changed) { if (onRemote) onRemote(); schedulePush(); }
    return changed;
  }
  async function push() {
    if (!docRef) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { dirty = true; setStatus('offline'); return; }
    setStatus('saving');
    try {
      const json = JSON.stringify(Store.getData());
      const doc = { updatedAt: new Date().toISOString() };
      const r = localStorage.getItem(RKEY); if (r) doc.fullReset = r; // marker barqarar rakho
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
      dirty = false; clearTimeout(retryT); setStatus('saved');
    } catch (e) {
      console.warn('push', e); dirty = true; setStatus('error');
      clearTimeout(retryT); retryT = setTimeout(push, 8000); // khud dobara koshish
    }
  }
  function schedulePush() { if (!syncOn) return; dirty = true; setStatus('pending'); clearTimeout(pushT); pushT = setTimeout(push, 1500); }
  function retry() { clearTimeout(retryT); return push(); }
  async function startSync(syncId) {
    curSyncId = String(syncId).trim();
    docRef = db.collection('khatas').doc(curSyncId);
    const snap = await docRef.get();
    if (snap.exists) {
      const d = snap.data();
      const hasData = d && (d.gz || d.payload || d.chunks); // doc me pehle se data hai?
      const adopted = await pull(d);
      // Agar doc me data mojood hai lekin hum use padh nahi paye, to us par apna data
      // OVERWRITE mat karo (warna clean data zaya ho jaye). Sirf khaali doc par push.
      if (!adopted && !hasData) await push();
    } else { await push(); }
    unsub = docRef.onSnapshot(s => { if (s.exists) pull(s.data()); }, e => console.warn('sub', e));
    syncOn = true;
    Store.onSave(schedulePush);
    if (!onlineHooked && typeof window !== 'undefined') {
      onlineHooked = true;
      window.addEventListener('online', () => { if (docRef) { refresh(); if (dirty) push(); } });
      window.addEventListener('offline', () => setStatus('offline'));
      // App wapis khulte/foreground aate hi FORAN taza data lo (background me listener so sakta hai)
      const onResume = () => { if (!docRef) return; if (typeof document !== 'undefined' && document.hidden) return; refresh(); if (dirty) push(); };
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onResume);
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
    applyReset(rd);
    localStorage.setItem(RKEY, String(marker));
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

  return { init, isReady: () => ready, isSyncOn: () => syncOn, publishShare, fetchShare, testConnect, importFromGz,
    getStatus: () => ({ state: status, dirty }), onStatus: cb => { onStatusCb = cb; }, retry, refresh };
})();
