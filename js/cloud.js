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

  /* ---- dataset sync (optional) ---- */
  function localNewer(remote) { return new Date(Store.getData().updatedAt || 0) >= new Date(remote.updatedAt || 0); }
  async function pull(sd) {
    if (!sd || !sd.payload) return false;
    let rd; try { rd = JSON.parse(sd.payload); } catch (e) { return false; }
    if (localNewer(rd)) return false;
    Store.replaceAll(rd); if (onRemote) onRemote(); return true;
  }
  async function push() {
    if (!docRef) return;
    try { await docRef.set({ payload: JSON.stringify(Store.getData()), updatedAt: new Date().toISOString() }); } catch (e) { console.warn('push', e); }
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
    try { await db.collection('share').doc(token).set({ data, updatedAt: new Date().toISOString() }); return true; }
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
