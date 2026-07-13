/* store.js — data model, persistence, and shared helpers (Roman Urdu app) */

const Store = (() => {
  const KEY = 'meraKhata_v1';

  const defaultData = () => ({
    shop: {
      name: '',
      phone: '',
      viewerBase: '',
      autoWhatsApp: true,   // har entry par WhatsApp khud khole (1-tap)
      waEndpoint: ''        // optional backend URL for FULL-AUTO sending
    },
    customers: [],
    items: []
  });

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      const d = JSON.parse(raw);
      const def = defaultData();
      d.shop = Object.assign(def.shop, d.shop || {});
      if (!Array.isArray(d.customers)) d.customers = [];
      if (!Array.isArray(d.items)) d.items = [];
      return d;
    } catch (e) {
      return defaultData();
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---- Shop ---- */
  function getShop() { return data.shop; }
  function setShop(patch) { Object.assign(data.shop, patch); save(); }

  /* ---- Customers ---- */
  function getCustomers() { return data.customers; }
  function getCustomer(id) { return data.customers.find(c => c.id === id); }

  function addCustomer({ name, phone }) {
    const c = { id: uid(), name: name.trim(), phone: (phone || '').trim(), txns: [] };
    data.customers.push(c);
    save();
    return c;
  }

  function updateCustomer(id, patch) {
    const c = getCustomer(id);
    if (!c) return;
    Object.assign(c, patch);
    save();
  }

  function deleteCustomer(id) {
    data.customers = data.customers.filter(c => c.id !== id);
    save();
  }

  /* ---- Transactions ---- */
  // type: 'debit'  = Udhaar Diya (customer par baqi barhta hai)
  //       'credit' = Paisay Milay (customer par baqi kam hota hai)
  function addTxn(custId, { amount, type, note, date }) {
    const c = getCustomer(custId);
    if (!c) return null;
    const t = {
      id: uid(),
      amount: Math.round(Number(amount) * 100) / 100,
      type,
      note: (note || '').trim(),
      date: date || new Date().toISOString()
    };
    c.txns.push(t);
    c.txns.sort((a, b) => new Date(a.date) - new Date(b.date));
    save();
    return t;
  }

  function deleteTxn(custId, txnId) {
    const c = getCustomer(custId);
    if (!c) return;
    c.txns = c.txns.filter(t => t.id !== txnId);
    save();
  }

  /* ---- Items / Stock ---- */
  function getItems() { return data.items; }
  function addItem({ name, rate, unit }) {
    const it = { id: uid(), name: name.trim(), rate: Number(rate) || 0, unit: (unit || '').trim() };
    data.items.push(it);
    save();
    return it;
  }
  function updateItem(id, patch) {
    const it = data.items.find(i => i.id === id);
    if (it) { Object.assign(it, patch); save(); }
  }
  function deleteItem(id) {
    data.items = data.items.filter(i => i.id !== id);
    save();
  }

  /* ---- Calculations ---- */
  // balance = sum(debit) - sum(credit)
  //   > 0 => customer se lena hai ; < 0 => customer ko dena hai
  function balanceOf(c) {
    return c.txns.reduce((s, t) => s + (t.type === 'debit' ? t.amount : -t.amount), 0);
  }

  function totals() {
    let lena = 0, dena = 0;
    data.customers.forEach(c => {
      const b = balanceOf(c);
      if (b > 0) lena += b;
      else if (b < 0) dena += -b;
    });
    return { lena, dena, customers: data.customers.length };
  }

  function recentTxns(limit = 12) {
    const all = [];
    data.customers.forEach(c => c.txns.forEach(t => all.push({ ...t, custId: c.id, custName: c.name })));
    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    return all.slice(0, limit);
  }

  /* ---- Backup ---- */
  function exportJSON() { return JSON.stringify(data, null, 2); }
  function importJSON(json) {
    const d = JSON.parse(json);
    if (!d.customers) throw new Error('Ghalat file');
    const def = defaultData();
    data = d;
    data.shop = Object.assign(def.shop, d.shop || {});
    if (!Array.isArray(data.items)) data.items = [];
    save();
  }

  return {
    getShop, setShop,
    getCustomers, getCustomer, addCustomer, updateCustomer, deleteCustomer,
    addTxn, deleteTxn,
    getItems, addItem, updateItem, deleteItem,
    balanceOf, totals, recentTxns,
    exportJSON, importJSON
  };
})();

/* ---------- Shared formatting & encoding helpers ---------- */

function fmtMoney(n) {
  const v = Math.abs(Math.round(n * 100) / 100);
  return 'Rs ' + v.toLocaleString('en-PK', { maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  const parts = (name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

const AVATAR_COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1', '#14b8a6'];
function avatarColor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* Pakistan number -> intl (03xx -> 923xx) */
function intlPhone(phone) {
  const p = (phone || '').replace(/[^\d]/g, '');
  if (!p) return '';
  if (p.startsWith('0')) return '92' + p.slice(1);
  if (p.startsWith('92')) return p;
  return p;
}

/* URL-safe UTF-8 base64 (handles Urdu/Unicode in notes) */
function encodeData(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
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
