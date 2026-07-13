/* app.js — Mera Khata (Udhaar Book style) */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let currentCustId = null;
let txnType = 'debit';
let editingCust = false;
let editingItemId = null;
let activeNav = 'overview';

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function esc(s) {
  return (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* ---------- Modals ---------- */
function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) { $('#' + id).classList.remove('open'); }
$$('[data-close]').forEach(b => b.addEventListener('click', e => e.target.closest('.modal-bg').classList.remove('open')));
$$('.modal-bg').forEach(bg => bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); }));

/* ---------- Navigation ---------- */
const VIEWS = ['overviewView', 'accountsView', 'itemsView', 'settingsView', 'detailView'];
function showView(id) {
  VIEWS.forEach(v => $('#' + v).classList.toggle('hidden', v !== id));
  window.scrollTo(0, 0);
}
function nav(target) {
  activeNav = target;
  $$('.bottomnav button').forEach(b => b.classList.toggle('active', b.dataset.nav === target));
  $('#bottomnav').classList.remove('hidden');
  if (target === 'overview') { renderOverview(); showView('overviewView'); }
  else if (target === 'accounts') { renderAccounts(); showView('accountsView'); }
  else if (target === 'items') { renderItems(); showView('itemsView'); }
  else if (target === 'settings') { loadSettings(); showView('settingsView'); }
}
$$('.bottomnav button').forEach(b => b.addEventListener('click', () => nav(b.dataset.nav)));

/* ---------- Overview ---------- */
function renderOverview() {
  const shop = Store.getShop();
  $('#ovShopName').textContent = shop.name || 'Mera Khata';
  const { lena, dena, customers } = Store.totals();
  $('#ovLena').textContent = fmtMoney(lena);
  $('#ovDena').textContent = fmtMoney(dena);
  $('#ovCustCount').textContent = customers;
  $('#ovNet').textContent = fmtMoney(lena - dena);
  $('#ovNet').className = 'm-val ' + ((lena - dena) >= 0 ? 'pos' : 'neg');

  const today = new Date().toDateString();
  const recent = Store.recentTxns(50);
  $('#ovTodayCount').textContent = recent.filter(t => new Date(t.date).toDateString() === today).length;

  const list = $('#ovRecent');
  const show = recent.slice(0, 12);
  if (show.length === 0) {
    list.innerHTML = `<div class="empty"><div class="big">📊</div>Abhi koi lein-dein nahi.<br>Neeche "Accounts" me customer add karke shuru karein.</div>`;
    return;
  }
  list.innerHTML = show.map(t => {
    const isDebit = t.type === 'debit';
    return `<div class="recent ${t.type}" data-cust="${t.custId}">
      <div class="r-ic">${isDebit ? '↑' : '↓'}</div>
      <div class="r-info">
        <div class="r-name">${esc(t.custName)}</div>
        <div class="r-date">${esc(t.note) || (isDebit ? 'Udhaar Diya' : 'Paisay Milay')} • ${fmtDate(t.date)}</div>
      </div>
      <div class="r-amt ${isDebit ? 'neg' : 'pos'}">${isDebit ? '−' : '+'}${fmtMoney(t.amount)}</div>
    </div>`;
  }).join('');
  $$('#ovRecent .recent').forEach(el => el.addEventListener('click', () => openDetail(el.dataset.cust)));
}

/* ---------- Accounts (customer list) ---------- */
function renderAccounts() {
  const q = $('#searchBox').value.trim().toLowerCase();
  let custs = Store.getCustomers().slice();
  if (q) custs = custs.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
  custs.sort((a, b) => Math.abs(Store.balanceOf(b)) - Math.abs(Store.balanceOf(a)));

  const list = $('#custList');
  if (custs.length === 0) {
    list.innerHTML = `<div class="empty"><div class="big">📒</div>
      ${q ? 'Koi customer nahi mila' : 'Abhi koi customer nahi.<br>Upar "+ Naya Customer" par tap karein.'}</div>`;
    return;
  }
  list.innerHTML = custs.map(c => {
    const b = Store.balanceOf(c);
    const cls = b > 0 ? 'pos' : b < 0 ? 'neg' : 'zero';
    const tag = b > 0 ? 'Lena hai' : b < 0 ? 'Dena hai' : 'Barabar';
    return `<div class="cust" data-id="${c.id}">
      <div class="avatar" style="background:${avatarColor(c.id)}">${initials(c.name)}</div>
      <div class="info"><div class="name">${esc(c.name)}</div><div class="phone">${esc(c.phone) || '—'}</div></div>
      <div class="bal"><div class="amt ${cls}">${fmtMoney(b)}</div><div class="tag">${tag}</div></div>
    </div>`;
  }).join('');
  $$('#custList .cust').forEach(el => el.addEventListener('click', () => openDetail(el.dataset.id)));
}
$('#searchBox').addEventListener('input', renderAccounts);

/* ---------- Detail ---------- */
function openDetail(id) {
  currentCustId = id;
  renderDetail();
  $('#bottomnav').classList.add('hidden');
  showView('detailView');
}
function backFromDetail() {
  currentCustId = null;
  nav('accounts');
}
$('#btnBack').addEventListener('click', backFromDetail);

function renderDetail() {
  const c = Store.getCustomer(currentCustId);
  if (!c) return backFromDetail();
  $('#detailTitle').textContent = c.name;
  $('#dName').textContent = c.name;
  $('#dPhone').textContent = c.phone || '—';

  const b = Store.balanceOf(c);
  const box = $('#dBalanceBox');
  box.className = 'balance-box ' + (b > 0 ? 'pos' : b < 0 ? 'neg' : 'zero');
  $('#dBalLabel').textContent = b > 0 ? 'Customer se lena hai' : b < 0 ? 'Customer ko dena hai' : 'Hisaab barabar hai';
  $('#dBalAmt').textContent = fmtMoney(b);
  $('#dBalAmt').className = 'b-amt ' + (b > 0 ? 'pos' : b < 0 ? 'neg' : 'zero');

  const list = $('#txnList');
  if (c.txns.length === 0) {
    list.innerHTML = `<div class="empty" style="padding:24px;">Abhi koi lein-dein nahi</div>`;
    return;
  }
  const txns = c.txns.slice().reverse();
  list.innerHTML = txns.map(t => {
    const isDebit = t.type === 'debit';
    return `<div class="txn ${t.type}" data-id="${t.id}">
      <div class="t-icon">${isDebit ? '↑' : '↓'}</div>
      <div class="t-info"><div class="t-note">${esc(t.note) || (isDebit ? 'Udhaar Diya' : 'Paisay Milay')}</div><div class="t-date">${fmtDateTime(t.date)}</div></div>
      <div class="t-amt">${isDebit ? '−' : '+'}${fmtMoney(t.amount)}</div>
      <button class="t-del" title="Delete">🗑</button>
    </div>`;
  }).join('');
  $$('#txnList .txn').forEach(el => {
    el.querySelector('.t-del').addEventListener('click', () => {
      if (confirm('Ye lein-dein delete karein?')) { Store.deleteTxn(currentCustId, el.dataset.id); renderDetail(); }
    });
  });
}

/* ---------- Customer add/edit ---------- */
$('#btnAddCust').addEventListener('click', () => {
  editingCust = false;
  $('#custModalTitle').textContent = 'Naya Customer';
  $('#custName').value = ''; $('#custPhone').value = '';
  $('#deleteCustRow').style.display = 'none';
  openModal('custModal');
  setTimeout(() => $('#custName').focus(), 200);
});
$('#btnEditCust').addEventListener('click', () => {
  const c = Store.getCustomer(currentCustId); if (!c) return;
  editingCust = true;
  $('#custModalTitle').textContent = 'Customer Edit';
  $('#custName').value = c.name; $('#custPhone').value = c.phone || '';
  $('#deleteCustRow').style.display = 'flex';
  openModal('custModal');
});
$('#saveCust').addEventListener('click', () => {
  const name = $('#custName').value.trim(), phone = $('#custPhone').value.trim();
  if (!name) { toast('Naam likhna zaroori hai'); return; }
  if (editingCust) { Store.updateCustomer(currentCustId, { name, phone }); renderDetail(); closeModal('custModal'); }
  else { const c = Store.addCustomer({ name, phone }); closeModal('custModal'); openDetail(c.id); }
});
$('#deleteCust').addEventListener('click', () => {
  if (confirm('Ye customer aur uska poora hisaab delete ho jayega. Yaqeen hai?')) {
    Store.deleteCustomer(currentCustId); closeModal('custModal'); backFromDetail();
  }
});

/* ---------- Transactions + Auto WhatsApp ---------- */
function openTxn(type) {
  txnType = type;
  $('#txnModalTitle').textContent = type === 'debit' ? 'Udhaar Diya' : 'Paisay Milay';
  updateTypeToggle();
  $('#txnAmount').value = ''; $('#txnNote').value = '';
  $('#txnDate').value = new Date().toISOString().slice(0, 10);
  $('#txnNotify').checked = Store.getShop().autoWhatsApp;
  // populate items dropdown
  const items = Store.getItems();
  const sel = $('#txnItem');
  sel.innerHTML = '<option value="">— Item chunein (optional) —</option>' +
    items.map(i => `<option value="${i.id}">${esc(i.name)} — ${fmtMoney(i.rate)}${i.unit ? '/' + esc(i.unit) : ''}</option>`).join('');
  $('#itemPickRow').style.display = items.length ? 'block' : 'none';
  openModal('txnModal');
  setTimeout(() => $('#txnAmount').focus(), 200);
}
function updateTypeToggle() {
  $('#typeDebit').className = txnType === 'debit' ? 'act-debit' : '';
  $('#typeCredit').className = txnType === 'credit' ? 'act-credit' : '';
}
$('#btnGave').addEventListener('click', () => openTxn('debit'));
$('#btnGot').addEventListener('click', () => openTxn('credit'));
$('#typeDebit').addEventListener('click', () => { txnType = 'debit'; updateTypeToggle(); });
$('#typeCredit').addEventListener('click', () => { txnType = 'credit'; updateTypeToggle(); });
$('#txnItem').addEventListener('change', e => {
  const it = Store.getItems().find(i => i.id === e.target.value);
  if (it) { $('#txnAmount').value = it.rate || ''; if (!$('#txnNote').value) $('#txnNote').value = it.name; }
});

$('#saveTxn').addEventListener('click', () => {
  const amt = parseFloat($('#txnAmount').value);
  if (!amt || amt <= 0) { toast('Sahi raqam likhein'); return; }
  const dateStr = $('#txnDate').value;
  const date = dateStr ? new Date(dateStr + 'T' + new Date().toTimeString().slice(0, 8)).toISOString() : new Date().toISOString();
  const note = $('#txnNote').value;
  Store.addTxn(currentCustId, { amount: amt, type: txnType, note, date });
  const notify = $('#txnNotify').checked;
  closeModal('txnModal');
  renderDetail();

  if (notify) sendEntryNotification(currentCustId, { amount: amt, type: txnType, note });
  else toast('Entry save ho gayi');
});

/* Build the customer's shareable hisaab link */
function buildViewerLink(c) {
  const shop = Store.getShop();
  const payload = {
    v: 1, shop: shop.name || 'Mera Khata', shopPhone: shop.phone || '',
    name: c.name, phone: c.phone || '', balance: Store.balanceOf(c),
    txns: c.txns.map(t => ({ a: t.amount, y: t.type, n: t.note, d: t.date })),
    gen: new Date().toISOString()
  };
  const enc = encodeData(payload);
  let base = (shop.viewerBase || '').trim();
  if (!base) base = location.origin + location.pathname.replace(/\/index\.html.*$/, '').replace(/\/$/, '');
  base = base.replace(/\/+$/, '');
  return base + '/view.html#d=' + enc;
}

/* Compose the Roman-Urdu message that tells customer what was entered */
function entryMessage(c, entry) {
  const shop = Store.getShop();
  const link = buildViewerLink(c);
  const b = Store.balanceOf(c);
  const kind = entry.type === 'debit' ? 'Udhaar (aap ne liya)' : 'Jama (aap ne diya)';
  const balLine = b > 0 ? `Ab aap par baqi: *${fmtMoney(b)}*`
    : b < 0 ? `Ab hamare zimmay: *${fmtMoney(b)}*` : `Ab hisaab barabar hai.`;
  return `*${shop.name || 'Mera Khata'}*\n` +
    `Assalam-o-Alaikum ${c.name},\n` +
    `Aap ke khaate me nayi entry hui hai:\n\n` +
    `${kind}: *${fmtMoney(entry.amount)}*\n` +
    (entry.note ? `Tafseel: ${entry.note}\n` : '') +
    `${balLine}\n\n` +
    `Poora hisaab (PDF) yahan dekhein:\n${link}`;
}

/* Fire the notification: FULL-AUTO if backend set, else 1-tap WhatsApp */
async function sendEntryNotification(custId, entry) {
  const c = Store.getCustomer(custId);
  if (!c) return;
  const phone = intlPhone(c.phone);
  if (!phone) { toast('WhatsApp ke liye customer ka number add karein'); return; }
  const msg = entryMessage(c, entry);
  const endpoint = (Store.getShop().waEndpoint || '').trim();

  if (endpoint) {
    // Full-auto via user's own backend (WhatsApp Business API)
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message: msg })
      });
      if (res.ok) { toast('✅ WhatsApp bhej diya gaya'); return; }
      toast('Auto-send fail — WhatsApp khol raha hoon');
    } catch (e) {
      toast('Server na mila — WhatsApp khol raha hoon');
    }
  }
  // 1-tap fallback (also default path)
  const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}

/* Manual share buttons on detail page */
$('#btnWhatsApp').addEventListener('click', () => {
  const c = Store.getCustomer(currentCustId);
  const phone = intlPhone(c.phone);
  const shop = Store.getShop();
  const link = buildViewerLink(c);
  const b = Store.balanceOf(c);
  const balLine = b > 0 ? `Aap par baqi hai: *${fmtMoney(b)}*` : b < 0 ? `Hamare zimmay: *${fmtMoney(b)}*` : `Hisaab barabar hai.`;
  const msg = `*${shop.name || 'Mera Khata'}*\nAssalam-o-Alaikum ${c.name},\n\n${balLine}\n\nApna poora hisaab (PDF) yahan dekhein:\n${link}`;
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
});
$('#btnCopyLink').addEventListener('click', async () => {
  const link = buildViewerLink(Store.getCustomer(currentCustId));
  try { await navigator.clipboard.writeText(link); toast('Link copy ho gaya ✅'); }
  catch (e) { prompt('Link copy karein:', link); }
});

/* ---------- Items ---------- */
function renderItems() {
  const items = Store.getItems();
  const list = $('#itemList');
  if (items.length === 0) {
    list.innerHTML = `<div class="empty"><div class="big">🏷️</div>Abhi koi item nahi.<br>Upar "+ Naya Item" par tap karein.<br><br><span style="font-size:13px">Items add karne se entry ke waqt raqam khud aa jayegi.</span></div>`;
    return;
  }
  list.innerHTML = items.map(i => `<div class="cust" data-id="${i.id}">
    <div class="avatar" style="background:${avatarColor(i.id)}">${initials(i.name)}</div>
    <div class="info"><div class="name">${esc(i.name)}</div><div class="phone">${i.unit ? 'Per ' + esc(i.unit) : 'Item'}</div></div>
    <div class="bal"><div class="amt">${fmtMoney(i.rate)}</div></div>
  </div>`).join('');
  $$('#itemList .cust').forEach(el => el.addEventListener('click', () => openItem(el.dataset.id)));
}
$('#btnAddItem').addEventListener('click', () => {
  editingItemId = null;
  $('#itemModalTitle').textContent = 'Naya Item';
  $('#itemName').value = ''; $('#itemRate').value = ''; $('#itemUnit').value = '';
  $('#deleteItemRow').style.display = 'none';
  openModal('itemModal');
  setTimeout(() => $('#itemName').focus(), 200);
});
function openItem(id) {
  const it = Store.getItems().find(i => i.id === id); if (!it) return;
  editingItemId = id;
  $('#itemModalTitle').textContent = 'Item Edit';
  $('#itemName').value = it.name; $('#itemRate').value = it.rate; $('#itemUnit').value = it.unit || '';
  $('#deleteItemRow').style.display = 'flex';
  openModal('itemModal');
}
$('#saveItem').addEventListener('click', () => {
  const name = $('#itemName').value.trim();
  if (!name) { toast('Item ka naam likhein'); return; }
  const rate = parseFloat($('#itemRate').value) || 0, unit = $('#itemUnit').value.trim();
  if (editingItemId) Store.updateItem(editingItemId, { name, rate, unit });
  else Store.addItem({ name, rate, unit });
  closeModal('itemModal'); renderItems();
});
$('#deleteItem').addEventListener('click', () => {
  if (editingItemId && confirm('Ye item delete karein?')) { Store.deleteItem(editingItemId); closeModal('itemModal'); renderItems(); }
});

/* ---------- Settings ---------- */
function loadSettings() {
  const s = Store.getShop();
  $('#setShopName').value = s.name || '';
  $('#setShopPhone').value = s.phone || '';
  $('#setViewerBase').value = s.viewerBase || '';
  $('#setAutoWa').checked = s.autoWhatsApp !== false;
  $('#setWaEndpoint').value = s.waEndpoint || '';
}
$('#ovSettings').addEventListener('click', () => nav('settings'));
$('#saveSettings').addEventListener('click', () => {
  Store.setShop({
    name: $('#setShopName').value.trim(),
    phone: $('#setShopPhone').value.trim(),
    viewerBase: $('#setViewerBase').value.trim(),
    autoWhatsApp: $('#setAutoWa').checked,
    waEndpoint: $('#setWaEndpoint').value.trim()
  });
  toast('Settings save ho gayi ✅');
  renderOverview();
});
$('#btnExport').addEventListener('click', () => {
  const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'mera-khata-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click(); URL.revokeObjectURL(url);
  toast('Backup file save ho gayi');
});
$('#btnImport').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { Store.importJSON(reader.result); toast('Backup load ho gaya ✅'); loadSettings(); }
    catch (err) { toast('Ghalat backup file'); }
  };
  reader.readAsText(file);
});

/* Auto-fill viewerBase on first run */
(function autoBase() {
  const s = Store.getShop();
  if (!s.viewerBase && location.protocol.startsWith('http')) {
    const base = location.origin + location.pathname.replace(/\/index\.html.*$/, '').replace(/\/$/, '');
    Store.setShop({ viewerBase: base });
  }
})();

/* PWA */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* Boot */
nav('overview');
