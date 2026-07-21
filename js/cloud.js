/* cloud.js — Firebase (optional).
   - LIVE share links: publishes each shared customer's hisaab to a public
     `share/{token}` doc so a permanent link always shows the current hisaab.
   - Cross-device sync (optional): mirrors the whole dataset to `khatas/{syncId}`.
   Stays a no-op until a Firebase config is present (firebase-config.js or Settings). */

const Cloud = (() => {
  let ready = false, syncOn = false, db = null, docRef = null, unsub = null, pushT = null, onRemote = null;

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

  /* ---- dataset sync ---- */
  // Normal: union-merge (koi entry na khoye). Lekin agar remote par naya "fullReset"
  // marker ho (ek dafa clean rebuild) to poora local replace kar do — taake purana/
  // duplicate data saaf ho jaye. Bara data gzip me store hota hai.
  async function pull(sd) {
    if (!sd) return false;
    let json = null;
    try {
      if (sd.gz) json = await gunzipB64(sd.gz);
      else if (sd.payload) json = sd.payload;
    } catch (e) { console.warn('decompress', e); return false; }
    if (!json) return false;
    let rd; try { rd = JSON.parse(json); } catch (e) { return false; }

    // one-time clean replace
    if (sd.fullReset && String(sd.fullReset) !== (localStorage.getItem(RKEY) || '')) {
      try { Store.replaceAll(rd); localStorage.setItem(RKEY, String(sd.fullReset)); if (onRemote) onRemote(); schedulePush(); return true; }
      catch (e) { console.warn('reset', e); return false; }
    }
    let changed = false;
    try { changed = Store.mergeRemote(rd); } catch (e) { console.warn('merge', e); return false; }
    if (changed) { if (onRemote) onRemote(); schedulePush(); }
    return changed;
  }
  async function push() {
    if (!docRef) return;
    try {
      const json = JSON.stringify(Store.getData());
      const doc = { updatedAt: new Date().toISOString() };
      const gz = await gzipB64(json);
      if (gz) doc.gz = gz; else doc.payload = json;
      const r = localStorage.getItem(RKEY); if (r) doc.fullReset = r; // marker barqarar rakho
      await docRef.set(doc);
    } catch (e) { console.warn('push', e); }
  }
  function schedulePush() { if (!syncOn) return; clearTimeout(pushT); pushT = setTimeout(push, 1500); }
  async function startSync(syncId) {
    docRef = db.collection('khatas').doc(syncId);
    const snap = await docRef.get();
    if (snap.exists) { const adopted = await pull(snap.data()); if (!adopted) await push(); } else { await push(); }
    unsub = docRef.onSnapshot(s => { if (s.exists) pull(s.data()); }, e => console.warn('sub', e));
    syncOn = true;
    Store.onSave(schedulePush);
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

  return { init, isReady: () => ready, isSyncOn: () => syncOn, publishShare, fetchShare, testConnect };
})();
