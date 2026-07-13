/* cloud.js — OPTIONAL Firebase cloud sync so data is safe even if phone is lost.
   Disabled until the user pastes their Firebase config + a Sync ID in Settings.
   Text hisaab syncs across devices; images stay local on each device. */

const Cloud = (() => {
  let enabled = false, docRef = null, unsub = null, pushT = null, onRemote = null;

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

  function localNewer(remote) {
    return new Date(Store.getData().updatedAt || 0) >= new Date(remote.updatedAt || 0);
  }

  async function pull(snapshotData) {
    if (!snapshotData || !snapshotData.payload) return false;
    let rd; try { rd = JSON.parse(snapshotData.payload); } catch (e) { return false; }
    if (localNewer(rd)) return false;
    Store.replaceAll(rd);
    if (onRemote) onRemote();
    return true;
  }

  async function push() {
    if (!docRef) return;
    try {
      await docRef.set({ payload: JSON.stringify(Store.getData()), updatedAt: new Date().toISOString(), device: navigator.userAgent.slice(0, 60) });
    } catch (e) { console.warn('cloud push', e); }
  }
  function schedulePush() { if (!enabled) return; clearTimeout(pushT); pushT = setTimeout(push, 1500); }

  async function init(cb) {
    onRemote = cb;
    const c = (Store.getShop().cloud) || {};
    if (!c.enabled || !c.config || !c.syncId) { enabled = false; return { ok: false }; }
    try {
      const cfg = typeof c.config === 'string' ? JSON.parse(c.config) : c.config;
      const syncId = String(c.syncId).trim();
      await loadSDK();
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      await firebase.auth().signInAnonymously();
      docRef = firebase.firestore().collection('khatas').doc(syncId);

      const snap = await docRef.get();
      if (snap.exists) { const adopted = await pull(snap.data()); if (!adopted) await push(); }
      else { await push(); }

      unsub = docRef.onSnapshot(s => { if (s.exists) pull(s.data()); }, err => console.warn('cloud sub', err));

      enabled = true;
      Store.onSave(schedulePush);
      return { ok: true };
    } catch (e) {
      enabled = false;
      console.warn('cloud init', e);
      return { ok: false, error: e.message || String(e) };
    }
  }

  function isEnabled() { return enabled; }
  async function testConnect(configStr, syncId) {
    try {
      const cfg = JSON.parse(configStr);
      await loadSDK();
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      await firebase.auth().signInAnonymously();
      await firebase.firestore().collection('khatas').doc(String(syncId).trim()).get();
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message || String(e) }; }
  }

  return { init, isEnabled, testConnect, push };
})();
