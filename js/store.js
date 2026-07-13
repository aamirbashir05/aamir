/* store.js — data model, persistence, and shared helpers (Roman Urdu app) */

const Store = (() => {
  const KEY = 'meraKhata_v1';

  const defaultData = () => ({
    shop: { name: '', phone: '', viewerBase: '' },
    customers: []
  });

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      const d = JSON.parse(raw);
      if (!d.shop) d.shop = defaultData().shop;
      if (!Array.isArray(d.customers)) d.customers = [];
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
    if (!c) return;
    c.txns.push({
      id: uid(),
      amount: Math.round(Number(amount) * 100) / 100,
      type,
      note: (note || '').trim(),
      date: date || new Date().toISOString()
    });
    c.txns.sort((a, b) => new Date(a.date) - new Date(b.date));
    save();
  }

  function deleteTxn(custId, txnId) {
    const c = getCustomer(custId);
    if (!c) return;
    c.txns = c.txns.filter(t => t.id !== txnId);
    save();
  }

  /* ---- Calculations ---- */
  // Positive balance => customer aap se lena/dena? Convention:
  // balance = sum(debit) - sum(credit)
  //   > 0  => customer ne aap se lena hai? NO — customer aap ko dena hai (aap ka "Lena")
  function balanceOf(c) {
    return c.txns.reduce((s, t) => s + (t.type === 'debit' ? t.amount : -t.amount), 0);
  }

  function totals() {
    let lena = 0, dena = 0; // lena = aap ko milna hai, dena = aap ne dena hai
    data.customers.forEach(c => {
      const b = balanceOf(c);
      if (b > 0) lena += b;
      else if (b < 0) dena += -b;
    });
    return { lena, dena };
  }

  /* ---- Backup ---- */
  function exportJSON() { return JSON.stringify(data, null, 2); }
  function importJSON(json) {
    const d = JSON.parse(json);
    if (!d.customers) throw new Error('Ghalat file');
    data = d;
    if (!data.shop) data.shop = defaultData().shop;
    save();
  }

  return {
    getShop, setShop,
    getCustomers, getCustomer, addCustomer, updateCustomer, deleteCustomer,
    addTxn, deleteTxn,
    balanceOf, totals,
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
