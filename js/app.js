/* app.js — Mera Khata owner app logic */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let currentCustId = null;
let txnType = 'debit';
let editingCust = false;

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Modals ---------- */
function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) { $('#' + id).classList.remove('open'); }
$$('[data-close]').forEach(b => b.addEventListener('click', e => e.target.closest('.modal-bg').classList.remove('open')));
$$('.modal-bg').forEach(bg => bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); }));

/* ---------- Rendering: Home ---------- */
function renderHome() {
  const shop = Store.getShop();
  $('#shopTitle').textContent = shop.name || 'Mera Khata';

  const { lena, dena } = Store.totals();
  $('#totalLena').textContent = fmtMoney(lena);
  $('#totalDena').textContent = fmtMoney(dena);

  const q = $('#searchBox').value.trim().toLowerCase();
  let custs = Store.getCustomers().slice();
  if (q) custs = custs.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));

  // sort: highest outstanding first
  custs.sort((a, b) => Math.abs(Store.balanceOf(b)) - Math.abs(Store.balanceOf(a)));

  const list = $('#custList');
  if (custs.length === 0) {
    list.innerHTML = `<div class="empty"><div class="big">📒</div>
      ${q ? 'Koi customer nahi mila' : 'Abhi koi customer nahi.<br>Neeche "+ Naya Customer" par tap karein.'}</div>`;
    return;
  }

  list.innerHTML = custs.map(c => {
    const b = Store.balanceOf(c);
    const cls = b > 0 ? 'pos' : b < 0 ? 'neg' : 'zero';
    const tag = b > 0 ? 'Lena hai' : b < 0 ? 'Dena hai' : 'Barabar';
    return `<div class="cust" data-id="${c.id}">
      <div class="avatar" style="background:${avatarColor(c.id)}">${initials(c.name)}</div>
      <div class="info">
        <div class="name">${esc(c.name)}</div>
        <div class="phone">${esc(c.phone) || '—'}</div>
      </div>
      <div class="bal">
        <div class="amt ${cls}">${fmtMoney(b)}</div>
        <div class="tag">${tag}</div>
      </div>
    </div>`;
  }).join('');

  $$('#custList .cust').forEach(el =>
    el.addEventListener('click', () => openDetail(el.dataset.id)));
}

function esc(s) {
  return (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* ---------- Detail ---------- */
function openDetail(id) {
  currentCustId = id;
  renderDetail();
  $('#homeView').classList.add('hidden');
  $('#detailView').classList.remove('hidden');
  window.scrollTo(0, 0);
}

function backHome() {
  currentCustId = null;
  $('#detailView').classList.add('hidden');
  $('#homeView').classList.remove('hidden');
  renderHome();
}

function renderDetail() {
  const c = Store.getCustomer(currentCustId);
  if (!c) return backHome();
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
  // newest first for display
  const txns = c.txns.slice().reverse();
  list.innerHTML = txns.map(t => {
    const isDebit = t.type === 'debit';
    return `<div class="txn ${t.type}" data-id="${t.id}">
      <div class="t-icon">${isDebit ? '↑' : '↓'}</div>
      <div class="t-info">
        <div class="t-note">${esc(t.note) || (isDebit ? 'Udhaar Diya' : 'Paisay Milay')}</div>
        <div class="t-date">${fmtDateTime(t.date)}</div>
      </div>
      <div class="t-amt">${isDebit ? '−' : '+'}${fmtMoney(t.amount)}</div>
      <button class="t-del" title="Delete">🗑</button>
    </div>`;
  }).join('');

  $$('#txnList .txn').forEach(el => {
    el.querySelector('.t-del').addEventListener('click', () => {
      if (confirm('Ye lein-dein delete karein?')) {
        Store.deleteTxn(currentCustId, el.dataset.id);
        renderDetail();
      }
    });
  });
}

/* ---------- Customer add/edit ---------- */
$('#btnAddCust').addEventListener('click', () => {
  editingCust = false;
  $('#custModalTitle').textContent = 'Naya Customer';
  $('#custName').value = '';
  $('#custPhone').value = '';
  $('#deleteCustRow').style.display = 'none';
  openModal('custModal');
  setTimeout(() => $('#custName').focus(), 200);
});

$('#btnEditCust').addEventListener('click', () => {
  const c = Store.getCustomer(currentCustId);
  if (!c) return;
  editingCust = true;
  $('#custModalTitle').textContent = 'Customer Edit';
  $('#custName').value = c.name;
  $('#custPhone').value = c.phone || '';
  $('#deleteCustRow').style.display = 'flex';
  openModal('custModal');
});

$('#saveCust').addEventListener('click', () => {
  const name = $('#custName').value.trim();
  const phone = $('#custPhone').value.trim();
  if (!name) { toast('Naam likhna zaroori hai'); return; }
  if (editingCust) {
    Store.updateCustomer(currentCustId, { name, phone });
    renderDetail();
  } else {
    const c = Store.addCustomer({ name, phone });
    closeModal('custModal');
    openDetail(c.id);
    return;
  }
  closeModal('custModal');
});

$('#deleteCust').addEventListener('click', () => {
  if (confirm('Ye customer aur uska poora hisaab delete ho jayega. Yaqeen hai?')) {
    Store.deleteCustomer(currentCustId);
    closeModal('custModal');
    backHome();
  }
});

/* ---------- Transactions ---------- */
function openTxn(type) {
  txnType = type;
  $('#txnModalTitle').textContent = type === 'debit' ? 'Udhaar Diya' : 'Paisay Milay';
  updateTypeToggle();
  $('#txnAmount').value = '';
  $('#txnNote').value = '';
  $('#txnDate').value = new Date().toISOString().slice(0, 10);
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

$('#saveTxn').addEventListener('click', () => {
  const amt = parseFloat($('#txnAmount').value);
  if (!amt || amt <= 0) { toast('Sahi raqam likhein'); return; }
  const dateStr = $('#txnDate').value;
  const date = dateStr ? new Date(dateStr + 'T' + new Date().toTimeString().slice(0, 8)).toISOString() : new Date().toISOString();
  Store.addTxn(currentCustId, { amount: amt, type: txnType, note: $('#txnNote').value, date });
  closeModal('txnModal');
  renderDetail();
});

/* ---------- Share link + WhatsApp ---------- */
function buildViewerLink(c) {
  const shop = Store.getShop();
  const payload = {
    v: 1,
    shop: shop.name || 'Mera Khata',
    shopPhone: shop.phone || '',
    name: c.name,
    phone: c.phone || '',
    balance: Store.balanceOf(c),
    txns: c.txns.map(t => ({ a: t.amount, y: t.type, n: t.note, d: t.date })),
    gen: new Date().toISOString()
  };
  const enc = encodeData(payload);
  let base = (shop.viewerBase || '').trim();
  if (!base) {
    // derive from current location
    base = location.href.replace(/\/index\.html.*$/, '').replace(/\/[^\/]*$/, '') || location.origin;
    if (location.pathname.endsWith('/')) base = location.origin + location.pathname.replace(/\/$/, '');
  }
  base = base.replace(/\/+$/, '');
  return base + '/view.html#d=' + enc;
}

$('#btnCopyLink').addEventListener('click', async () => {
  const c = Store.getCustomer(currentCustId);
  const link = buildViewerLink(c);
  try {
    await navigator.clipboard.writeText(link);
    toast('Link copy ho gaya ✅');
  } catch (e) {
    prompt('Link copy karein:', link);
  }
});

$('#btnWhatsApp').addEventListener('click', () => {
  const c = Store.getCustomer(currentCustId);
  const link = buildViewerLink(c);
  const b = Store.balanceOf(c);
  const shop = Store.getShop();
  const balLine = b > 0
    ? `Aap par baqi hai: ${fmtMoney(b)}`
    : b < 0 ? `Hamare zimmay: ${fmtMoney(b)}` : `Hisaab barabar hai.`;
  const msg =
    `*${shop.name || 'Mera Khata'}*\n` +
    `Assalam-o-Alaikum ${c.name},\n\n` +
    `${balLine}\n\n` +
    `Apna poora hisaab (PDF) yahan dekhein:\n${link}`;
  let waUrl = 'https://wa.me/';
  const phone = (c.phone || '').replace(/[^\d]/g, '');
  if (phone) {
    // convert local 03xx to intl 92 for Pakistan if starts with 0
    const intl = phone.startsWith('0') ? '92' + phone.slice(1) : phone;
    waUrl += intl;
  }
  waUrl += '?text=' + encodeURIComponent(msg);
  window.open(waUrl, '_blank');
});

/* ---------- Settings ---------- */
$('#btnSettings').addEventListener('click', () => {
  const s = Store.getShop();
  $('#setShopName').value = s.name || '';
  $('#setShopPhone').value = s.phone || '';
  $('#setViewerBase').value = s.viewerBase || '';
  openModal('settingsModal');
});

$('#saveSettings').addEventListener('click', () => {
  Store.setShop({
    name: $('#setShopName').value.trim(),
    phone: $('#setShopPhone').value.trim(),
    viewerBase: $('#setViewerBase').value.trim()
  });
  closeModal('settingsModal');
  renderHome();
  toast('Settings save ho gayi');
});

$('#btnExport').addEventListener('click', () => {
  const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mera-khata-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup file save ho gayi');
});

$('#btnImport').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      Store.importJSON(reader.result);
      toast('Backup load ho gaya ✅');
      closeModal('settingsModal');
      renderHome();
    } catch (err) {
      toast('Ghalat backup file');
    }
  };
  reader.readAsText(file);
});

/* ---------- Nav ---------- */
$('#btnBack').addEventListener('click', backHome);
$('#searchBox').addEventListener('input', renderHome);

/* Auto-fill viewerBase on first run if empty */
(function autoBase() {
  const s = Store.getShop();
  if (!s.viewerBase && location.protocol.startsWith('http')) {
    let base = location.origin + location.pathname.replace(/\/index\.html.*$/, '').replace(/\/$/, '');
    Store.setShop({ viewerBase: base });
  }
})();

/* ---------- PWA service worker ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------- Boot ---------- */
renderHome();
