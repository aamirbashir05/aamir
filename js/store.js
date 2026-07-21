/* store.js — data model, DURABLE persistence (IndexedDB + localStorage mirror),
   auto version-history snapshots, image blobs, and shared helpers. */

const Store = (() => {
  const LS_KEY = 'meraKhata_v1';
  const DB_NAME = 'meraKhataDB';
  const S_KV = 'kv';            // main data (out-of-line key 'data')
  const S_IMG = 'images';       // image dataURLs keyed by imageId
  const S_SNAP = 'snapshots';   // auto version history keyed by ts

  let db = null;
  let data = defaultData();
  let lastSnapTs = 0;

  function defaultData() {
    return {
      shop: {
        name: 'Al Tariq Printers',
        phone: '', viewerBase: '',
        autoWhatsApp: true, waEndpoint: '',
        logo: '', logoSmall: '',
        bizLink: 'https://share.google/CufoPI1IgMa5h0rgc',
        paymentInfo: 'Payment ke liye:\nRaast ID = Aamir Bashir 03135202228\nEasypaisa 1 = Bashir Muhammad 03455084099\nEasypaisa 2 = Aamir Bashir 03480956097\n\nPayment Send karne k baad 03135202228 par Raseed lazmi send karain. Shukriya.',
        cloud: { enabled: false, config: '', syncId: '' }
      },
      customers: [],   // { id, name, phone, txns:[{id,amount,type,note,date,img}], quotes:[{id,job,rate,note,date,status,img}] }
      suppliers: [],   // jinse maal lena/dena hai — same shape as customers
      items: [],
      updatedAt: new Date().toISOString(),
      lastBackup: 0
    };
  }

  /* ---------- IndexedDB helpers ---------- */
  function openDB() {
    return new Promise(resolve => {
      let req;
      try { req = indexedDB.open(DB_NAME, 1); }
      catch (e) { return resolve(null); }
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(S_KV)) d.createObjectStore(S_KV);
        if (!d.objectStoreNames.contains(S_IMG)) d.createObjectStore(S_IMG);
        if (!d.objectStoreNames.contains(S_SNAP)) d.createObjectStore(S_SNAP);
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => resolve(null);
    });
  }
  function idbReq(request) {
    return new Promise((res, rej) => { request.onsuccess = () => res(request.result); request.onerror = () => rej(request.error); });
  }
  async function idbGet(store, key) {
    if (!db) return null;
    try { return await idbReq(db.transaction(store, 'readonly').objectStore(store).get(key)); }
    catch (e) { return null; }
  }
  async function idbPut(store, val, key) {
    if (!db) return;
    try { await idbReq(db.transaction(store, 'readwrite').objectStore(store).put(val, key)); } catch (e) {}
  }
  async function idbDel(store, key) {
    if (!db) return;
    try { await idbReq(db.transaction(store, 'readwrite').objectStore(store).delete(key)); } catch (e) {}
  }
  async function idbKeys(store) {
    if (!db) return [];
    try { return await idbReq(db.transaction(store, 'readonly').objectStore(store).getAllKeys()); }
    catch (e) { return []; }
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function migrate(d) {
    const def = defaultData();
    d.shop = Object.assign({}, def.shop, d.shop || {});
    if (!d.shop.cloud) d.shop.cloud = { enabled: false, config: '', syncId: '' };
    if (!d.shop.name) d.shop.name = 'Al Tariq Printers';
    // upgrade older multi-line payment default to the new same-line format
    const OLD_PAY = 'Payment ke liye:\nRaast ID = Aamir Bashir\n03135202228\nEasypaisa 1 = Bashir Muhammad\n03455084099\nEasypaisa 2 = Aamir Bashir\n03480956097\n\nPayment Send karne k baad 03135202228 par Raseed lazmi send karain. Shukriya.';
    if (d.shop.paymentInfo === OLD_PAY) d.shop.paymentInfo = def.shop.paymentInfo;
    if (!Array.isArray(d.customers)) d.customers = [];
    d.customers.forEach(c => {
      if (!Array.isArray(c.txns)) c.txns = [];
      if (!Array.isArray(c.quotes)) c.quotes = [];
    });
    if (!Array.isArray(d.suppliers)) d.suppliers = [];
    d.suppliers.forEach(s => {
      if (!Array.isArray(s.txns)) s.txns = [];
      if (!Array.isArray(s.quotes)) s.quotes = [];
    });
    if (!Array.isArray(d.items)) d.items = [];
    if (!d.updatedAt) d.updatedAt = new Date().toISOString();
    if (!d.lastBackup) d.lastBackup = 0;
    return d;
  }

  /* ---------- init / load ---------- */
  async function init() {
    db = await openDB();
    let idbData = await idbGet(S_KV, 'data');
    let lsData = null;
    try { const raw = localStorage.getItem(LS_KEY); if (raw) lsData = JSON.parse(raw); } catch (e) {}

    // pick the newer of the two durable copies
    let chosen = null;
    if (idbData && lsData) {
      chosen = (new Date(idbData.updatedAt || 0) >= new Date(lsData.updatedAt || 0)) ? idbData : lsData;
    } else {
      chosen = idbData || lsData;
    }
    if (chosen) data = migrate(chosen);
    // make sure both stores are in sync with chosen copy
    persist(false);
    return data;
  }

  /* ---------- save / persist ---------- */
  function persist(snapshot = true) {
    data.updatedAt = new Date().toISOString();
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
    idbPut(S_KV, clone(data), 'data');
    if (snapshot) maybeSnapshot();
  }
  const saveCbs = [];
  function onSave(cb) { saveCbs.push(cb); }
  function save() { persist(true); saveCbs.forEach(cb => { try { cb(); } catch (e) {} }); }

  function getData() { return data; }
  function replaceAll(d) { data = migrate(d); persist(false); }

  /* ---- Safe MERGE for multi-device sync (never lose entries) ---- */
  function mergeById(a, b) {
    a = a || []; b = b || [];
    const m = new Map();
    a.forEach(t => m.set(t.id, t));
    b.forEach(t => { if (!m.has(t.id)) m.set(t.id, t); });
    return [...m.values()];
  }
  function mergeParties(a, b) {
    a = a || []; b = b || [];
    const m = new Map();
    a.forEach(p => m.set(p.id, p));
    b.forEach(p => {
      if (!m.has(p.id)) { m.set(p.id, p); return; }
      const x = m.get(p.id);
      x.txns = mergeById(x.txns, p.txns).sort((u, v) => new Date(u.date) - new Date(v.date));
      x.quotes = mergeById(x.quotes, p.quotes).sort((u, v) => new Date(v.date) - new Date(u.date));
      if (!x.name && p.name) x.name = p.name;
      if (!x.phone && p.phone) x.phone = p.phone;
      if (!x.shareId && p.shareId) x.shareId = p.shareId;
    });
    return [...m.values()];
  }
  // Union-merge a remote copy into local; returns true if anything changed.
  function mergeRemote(remote) {
    try { remote = migrate(remote); } catch (e) { return false; }
    const before = JSON.stringify(data);
    data.customers = mergeParties(data.customers, remote.customers);
    data.suppliers = mergeParties(data.suppliers, remote.suppliers);
    data.items = mergeById(data.items, remote.items);
    if (new Date(remote.updatedAt || 0) > new Date(data.updatedAt || 0)) {
      data.shop = Object.assign({}, data.shop, remote.shop || {});
    }
    const changed = JSON.stringify(data) !== before;
    if (changed) persist(false);
    return changed;
  }

  async function maybeSnapshot() {
    const now = Date.now();
    if (now - lastSnapTs < 45000) return; // throttle: at most ~1/45s
    lastSnapTs = now;
    await idbPut(S_SNAP, { ts: now, at: new Date(now).toISOString(), data: clone(data) }, now);
    // prune to newest 60
    const keys = (await idbKeys(S_SNAP)).sort((a, b) => a - b);
    while (keys.length > 60) { await idbDel(S_SNAP, keys.shift()); }
  }

  async function listSnapshots() {
    const keys = (await idbKeys(S_SNAP)).sort((a, b) => b - a);
    const out = [];
    for (const k of keys.slice(0, 60)) {
      const s = await idbGet(S_SNAP, k);
      if (s) out.push({ ts: s.ts, at: s.at, customers: (s.data.customers || []).length });
    }
    return out;
  }
  async function restoreSnapshot(ts) {
    const s = await idbGet(S_SNAP, ts);
    if (!s) return false;
    data = migrate(s.data);
    persist(false);
    return true;
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- Images ---------- */
  async function putImage(dataUrl) { const id = 'img_' + uid(); await idbPut(S_IMG, dataUrl, id); return id; }
  async function getImage(id) { if (!id) return null; return await idbGet(S_IMG, id); }
  async function delImage(id) { if (id) await idbDel(S_IMG, id); }

  /* ---------- Shop / branding ---------- */
  function getShop() { return data.shop; }
  function setShop(patch) { Object.assign(data.shop, patch); save(); }

  /* ---------- Parties (customers + suppliers, same shape) ---------- */
  function listOf(kind) { return kind === 'supplier' ? data.suppliers : data.customers; }
  function getParties(kind) { return listOf(kind); }
  function getParty(kind, id) { return listOf(kind).find(p => p.id === id); }
  function addParty(kind, { name, phone }) {
    const p = { id: uid(), name: name.trim(), phone: (phone || '').trim(), txns: [], quotes: [] };
    listOf(kind).push(p); save(); return p;
  }
  function updateParty(kind, id, patch) { const p = getParty(kind, id); if (p) { Object.assign(p, patch); save(); } }
  function deleteParty(kind, id) {
    const p = getParty(kind, id);
    if (p) { p.txns.forEach(t => t.img && delImage(t.img)); (p.quotes || []).forEach(q => q.img && delImage(q.img)); }
    const l = listOf(kind); const i = l.findIndex(x => x.id === id);
    if (i >= 0) { l.splice(i, 1); save(); }
  }
  function addPartyTxn(kind, id, { amount, type, note, date, img }) {
    const p = getParty(kind, id); if (!p) return null;
    const t = { id: uid(), amount: Math.round(Number(amount) * 100) / 100, type, note: (note || '').trim(), date: date || new Date().toISOString(), img: img || '' };
    p.txns.push(t); p.txns.sort((a, b) => new Date(a.date) - new Date(b.date)); save(); return t;
  }
  function deletePartyTxn(kind, id, txnId) {
    const p = getParty(kind, id); if (!p) return;
    const t = p.txns.find(x => x.id === txnId); if (t && t.img) delImage(t.img);
    p.txns = p.txns.filter(x => x.id !== txnId); save();
  }
  function updatePartyTxn(kind, id, txnId, patch) {
    const p = getParty(kind, id); if (!p) return null;
    const t = p.txns.find(x => x.id === txnId); if (!t) return null;
    if (patch.amount != null) t.amount = Math.round(Number(patch.amount) * 100) / 100;
    if (patch.type) t.type = patch.type;
    if (patch.note != null) t.note = (patch.note || '').trim();
    if (patch.date) t.date = patch.date;
    if (patch.img !== undefined) t.img = patch.img || '';
    p.txns.sort((a, b) => new Date(a.date) - new Date(b.date));
    save(); return t;
  }

  /* ---------- Shareable permanent link token (per party) ---------- */
  function randToken() {
    const a = 'abcdefghijkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 14; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  function ensureShareId(kind, id) {
    const p = getParty(kind, id);
    if (!p) return '';
    if (!p.shareId) { p.shareId = randToken(); save(); }
    return p.shareId;
  }

  /* ---------- Customer wrappers (backward compatible) ---------- */
  function getCustomers() { return data.customers; }
  function getSuppliers() { return data.suppliers; }
  function getCustomer(id) { return getParty('customer', id); }
  function addCustomer(o) { return addParty('customer', o); }
  function updateCustomer(id, patch) { return updateParty('customer', id, patch); }
  function deleteCustomer(id) { return deleteParty('customer', id); }
  function addTxn(custId, t) { return addPartyTxn('customer', custId, t); }
  function deleteTxn(custId, txnId) { return deletePartyTxn('customer', custId, txnId); }

  /* ---------- Quotes / Rate memory ---------- */
  function addQuote(custId, { job, rate, note, date, status, img }) {
    const c = getCustomer(custId); if (!c) return null;
    const q = { id: uid(), job: (job || '').trim(), rate: Number(rate) || 0, note: (note || '').trim(), date: date || new Date().toISOString(), status: status || 'Rate Diya', img: img || '' };
    c.quotes.push(q); c.quotes.sort((a, b) => new Date(b.date) - new Date(a.date)); save(); return q;
  }
  function updateQuote(custId, qId, patch) {
    const c = getCustomer(custId); if (!c) return;
    const q = c.quotes.find(x => x.id === qId); if (q) { Object.assign(q, patch); save(); }
  }
  function deleteQuote(custId, qId) {
    const c = getCustomer(custId); if (!c) return;
    const q = c.quotes.find(x => x.id === qId); if (q && q.img) delImage(q.img);
    c.quotes = c.quotes.filter(x => x.id !== qId); save();
  }
  function allQuotes() {
    const out = [];
    data.customers.forEach(c => (c.quotes || []).forEach(q => out.push({ ...q, custId: c.id, custName: c.name, custPhone: c.phone })));
    out.sort((a, b) => new Date(b.date) - new Date(a.date));
    return out;
  }

  /* ---------- Calculations ---------- */
  function balanceOf(c) { return c.txns.reduce((s, t) => s + (t.type === 'debit' ? t.amount : -t.amount), 0); }
  function totals() {
    let lena = 0, dena = 0;
    // customers: +balance = they owe you (lena) ; -balance = you owe them (dena)
    data.customers.forEach(c => { const b = balanceOf(c); if (b > 0) lena += b; else if (b < 0) dena += -b; });
    // suppliers: +balance = you owe supplier (dena) ; -balance = supplier owes you (lena)
    data.suppliers.forEach(s => { const b = balanceOf(s); if (b > 0) dena += b; else if (b < 0) lena += -b; });
    return { lena, dena, customers: data.customers.length, suppliers: data.suppliers.length };
  }
  function recentTxns(limit = 12) {
    const all = [];
    data.customers.forEach(c => c.txns.forEach(t => all.push({ ...t, kind: 'customer', custId: c.id, custName: c.name })));
    data.suppliers.forEach(s => s.txns.forEach(t => all.push({ ...t, kind: 'supplier', custId: s.id, custName: s.name })));
    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    return all.slice(0, limit);
  }

  /* ---------- Backup ---------- */
  function markBackup() { data.lastBackup = Date.now(); save(); }
  function lastBackup() { return data.lastBackup || 0; }
  function exportJSON() { return JSON.stringify(data, null, 2); }
  function importJSON(json) {
    const d = JSON.parse(json);
    if (!d.customers) throw new Error('Ghalat file');
    data = migrate(d); persist(false);
  }

  return {
    init, save, onSave, getData, replaceAll, mergeRemote,
    getShop, setShop,
    getParties, getParty, addParty, updateParty, deleteParty, addPartyTxn, deletePartyTxn, updatePartyTxn,
    ensureShareId,
    getCustomers, getSuppliers, getCustomer, addCustomer, updateCustomer, deleteCustomer,
    addTxn, deleteTxn,
    addQuote, updateQuote, deleteQuote, allQuotes,
    putImage, getImage,
    balanceOf, totals, recentTxns,
    listSnapshots, restoreSnapshot,
    markBackup, lastBackup, exportJSON, importJSON
  };
})();

/* ---------- Shared helpers ---------- */
function fmtMoney(n) {
  const v = Math.abs(Math.round(n * 100) / 100);
  return 'Rs ' + v.toLocaleString('en-PK', { maximumFractionDigits: 2 });
}
function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function initials(name) {
  const p = (name || '?').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}
const AVATAR_COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1', '#14b8a6'];
function avatarColor(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff; return AVATAR_COLORS[h % AVATAR_COLORS.length]; }

function intlPhone(phone) {
  const p = (phone || '').replace(/[^\d]/g, '');
  if (!p) return '';
  if (p.startsWith('0')) return '92' + p.slice(1);
  if (p.startsWith('92')) return p;
  return p;
}

/* image resize -> dataURL (jpeg) */
function fileToDataURL(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality || 0.7));
      };
      img.onerror = reject;
      img.src = rd.result;
    };
    rd.onerror = reject;
    rd.readAsDataURL(file);
  });
}

/* URL-safe UTF-8 base64 */
function encodeData(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeData(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}
