/* app.js — Al Tariq Printers Hisaab (Udhaar Book style) */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let currentCustId = null;
let txnType = 'debit';
let editingCust = false;
let editingQuoteId = null;
let pendingTxnImg = null;    // dataURL staged for a new txn
let pendingQuoteImg = null;  // dataURL staged for a new quote
let activeNav = 'overview';

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function esc(s) { return (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

/* ---------- Modals ---------- */
function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) { $('#' + id).classList.remove('open'); }
$$('[data-close]').forEach(b => b.addEventListener('click', e => e.target.closest('.modal-bg').classList.remove('open')));
$$('.modal-bg').forEach(bg => bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); }));

/* Load stored images into any <img data-img="id"> in the DOM */
async function hydrateImages(root = document) {
  const els = Array.from(root.querySelectorAll('img[data-img]'));
  for (const el of els) {
    const url = await Store.getImage(el.dataset.img);
    if (url) el.src = url; else el.style.display = 'none';
  }
}
function openImage(id) {
  Store.getImage(id).then(url => { if (url) { $('#imgFull').src = url; openModal('imgModal'); } });
}

/* ---------- Branding ---------- */
function applyBranding() {
  const s = Store.getShop();
  $('#ovShopName').textContent = s.name || 'Al Tariq Printers';
  const lg = $('#ovLogo');
  if (s.logo) { lg.src = s.logo; lg.classList.add('show'); } else lg.classList.remove('show');
}

/* ---------- Navigation ---------- */
const VIEWS = ['overviewView', 'accountsView', 'ratesView', 'settingsView', 'detailView'];
function showView(id) { VIEWS.forEach(v => $('#' + v).classList.toggle('hidden', v !== id)); window.scrollTo(0, 0); }
function nav(target) {
  activeNav = target;
  $$('.bottomnav button').forEach(b => b.classList.toggle('active', b.dataset.nav === target));
  $('#bottomnav').classList.remove('hidden');
  if (target === 'overview') { renderOverview(); showView('overviewView'); }
  else if (target === 'accounts') { renderAccounts(); showView('accountsView'); }
  else if (target === 'rates') { renderRates(); showView('ratesView'); }
  else if (target === 'settings') { loadSettings(); showView('settingsView'); }
}
$$('.bottomnav button').forEach(b => b.addEventListener('click', () => nav(b.dataset.nav)));

/* ---------- Overview ---------- */
function renderOverview() {
  applyBranding();
  const { lena, dena, customers } = Store.totals();
  $('#ovLena').textContent = fmtMoney(lena);
  $('#ovDena').textContent = fmtMoney(dena);
  $('#ovCustCount').textContent = customers;
  $('#ovNet').textContent = fmtMoney(lena - dena);
  $('#ovNet').className = 'm-val ' + ((lena - dena) >= 0 ? 'pos' : 'neg');

  const today = new Date().toDateString();
  const recent = Store.recentTxns(50);
  $('#ovTodayCount').textContent = recent.filter(t => new Date(t.date).toDateString() === today).length;

  // backup reminder banner (if no backup in last 24h and there is data)
  const stale = (Date.now() - Store.lastBackup()) > 86400000;
  $('#backupBanner').classList.toggle('hidden', !(stale && customers > 0));

  const list = $('#ovRecent');
  const show = recent.slice(0, 12);
  if (show.length === 0) {
    list.innerHTML = `<div class="empty"><div class="big">📊</div>Abhi koi lein-dein nahi.<br>"Accounts" me customer add karke shuru karein.</div>`;
    return;
  }
  list.innerHTML = show.map(t => {
    const d = t.type === 'debit';
    return `<div class="recent ${t.type}" data-cust="${t.custId}">
      <div class="r-ic">${d ? '↑' : '↓'}</div>
      <div class="r-info"><div class="r-name">${esc(t.custName)}</div><div class="r-date">${esc(t.note) || (d ? 'Udhaar Diya' : 'Paisay Milay')} • ${fmtDate(t.date)}</div></div>
      <div class="r-amt ${d ? 'neg' : 'pos'}">${d ? '−' : '+'}${fmtMoney(t.amount)}</div></div>`;
  }).join('');
  $$('#ovRecent .recent').forEach(el => el.addEventListener('click', () => openDetail(el.dataset.cust)));
}
$('#ovSettings').addEventListener('click', () => nav('settings'));
$('#bannerBackup').addEventListener('click', doExport);

/* ---------- Accounts ---------- */
function renderAccounts() {
  const q = $('#searchBox').value.trim().toLowerCase();
  let custs = Store.getCustomers().slice();
  if (q) custs = custs.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
  custs.sort((a, b) => Math.abs(Store.balanceOf(b)) - Math.abs(Store.balanceOf(a)));
  const list = $('#custList');
  if (custs.length === 0) {
    list.innerHTML = `<div class="empty"><div class="big">📒</div>${q ? 'Koi customer nahi mila' : 'Abhi koi customer nahi.<br>Upar "+ Naya Customer".'}</div>`;
    return;
  }
  list.innerHTML = custs.map(c => {
    const b = Store.balanceOf(c);
    const cls = b > 0 ? 'pos' : b < 0 ? 'neg' : 'zero';
    const tag = b > 0 ? 'Lena hai' : b < 0 ? 'Dena hai' : 'Barabar';
    return `<div class="cust" data-id="${c.id}">
      <div class="avatar" style="background:${avatarColor(c.id)}">${initials(c.name)}</div>
      <div class="info"><div class="name">${esc(c.name)}</div><div class="phone">${esc(c.phone) || '—'}</div></div>
      <div class="bal"><div class="amt ${cls}">${fmtMoney(b)}</div><div class="tag">${tag}</div></div></div>`;
  }).join('');
  $$('#custList .cust').forEach(el => el.addEventListener('click', () => openDetail(el.dataset.id)));
}
$('#searchBox').addEventListener('input', renderAccounts);

/* ---------- Rates (global quote memory) ---------- */
function renderRates() {
  const q = $('#rateSearch').value.trim().toLowerCase();
  let quotes = Store.allQuotes();
  if (q) quotes = quotes.filter(x => x.custName.toLowerCase().includes(q) || (x.job || '').toLowerCase().includes(q) || (x.note || '').toLowerCase().includes(q));
  const list = $('#rateList');
  if (quotes.length === 0) {
    list.innerHTML = `<div class="empty"><div class="big">🧾</div>${q ? 'Koi rate nahi mila' : 'Abhi koi rate darj nahi.<br>Customer kholein → "Rates diye" → "+ Rate likhein".'}</div>`;
    return;
  }
  list.innerHTML = quotes.map(x => quoteRowHtml(x, true)).join('');
  $$('#rateList .quote').forEach(el => el.addEventListener('click', e => {
    if (e.target.dataset.img) return openImage(e.target.dataset.img);
    openDetail(el.dataset.cust);
  }));
  hydrateImages(list);
}
$('#rateSearch').addEventListener('input', renderRates);

function quoteRowHtml(x, showCust) {
  const thumb = x.img ? `<img class="q-thumb" data-img="${x.img}" alt="">` : '';
  return `<div class="quote" data-cust="${x.custId || ''}" data-id="${x.id}">
    ${thumb}
    <div class="q-main">
      <div class="q-job">${esc(x.job) || 'Kaam'}<span class="badge ${x.status || 'Quoted'}">${x.status || 'Quoted'}</span></div>
      <div class="q-meta">${showCust ? esc(x.custName) + ' • ' : ''}${fmtDate(x.date)}${x.note ? ' • ' + esc(x.note) : ''}</div>
    </div>
    <div class="q-rate">${fmtMoney(x.rate)}</div>
  </div>`;
}

/* ---------- Detail ---------- */
function openDetail(id) {
  currentCustId = id;
  switchDetailTab('txns');
  renderDetail();
  $('#bottomnav').classList.add('hidden');
  showView('detailView');
}
function backFromDetail() { currentCustId = null; nav('accounts'); }
$('#btnBack').addEventListener('click', backFromDetail);

function switchDetailTab(tab) {
  $$('#detailView .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('#txnPane').classList.toggle('hidden', tab !== 'txns');
  $('#quotePane').classList.toggle('hidden', tab !== 'quotes');
  $('#detailActions').style.display = tab === 'txns' ? 'flex' : 'none';
}
$$('#detailView .tab').forEach(t => t.addEventListener('click', () => { switchDetailTab(t.dataset.tab); if (t.dataset.tab === 'quotes') renderQuotes(); }));

function renderDetail() {
  const c = Store.getCustomer(currentCustId); if (!c) return backFromDetail();
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
  if (c.txns.length === 0) { list.innerHTML = `<div class="empty" style="padding:24px;">Abhi koi lein-dein nahi</div>`; }
  else {
    list.innerHTML = c.txns.slice().reverse().map(t => {
      const d = t.type === 'debit';
      const thumb = t.img ? `<img class="t-thumb" data-img="${t.img}" alt="">` : '';
      return `<div class="txn ${t.type}" data-id="${t.id}">
        <div class="t-icon">${d ? '↑' : '↓'}</div>${thumb}
        <div class="t-info"><div class="t-note">${esc(t.note) || (d ? 'Udhaar Diya' : 'Paisay Milay')}</div><div class="t-date">${fmtDateTime(t.date)}</div></div>
        <div class="t-amt">${d ? '−' : '+'}${fmtMoney(t.amount)}</div>
        <button class="t-del" title="Delete">🗑</button></div>`;
    }).join('');
    $$('#txnList .txn').forEach(el => {
      el.querySelector('.t-del').addEventListener('click', e => { e.stopPropagation(); if (confirm('Ye lein-dein delete karein?')) { Store.deleteTxn(currentCustId, el.dataset.id); renderDetail(); } });
      const th = el.querySelector('.t-thumb'); if (th) th.addEventListener('click', () => openImage(th.dataset.img));
    });
    hydrateImages(list);
  }
  renderQuotes();
}

function renderQuotes() {
  const c = Store.getCustomer(currentCustId); if (!c) return;
  const list = $('#quoteList');
  if (!c.quotes || c.quotes.length === 0) { list.innerHTML = `<div class="empty" style="padding:20px;">Koi rate darj nahi.<br>Upar "+ Rate likhein".</div>`; return; }
  list.innerHTML = c.quotes.map(x => quoteRowHtml(x, false)).join('');
  $$('#quoteList .quote').forEach(el => el.addEventListener('click', e => {
    if (e.target.dataset.img) return openImage(e.target.dataset.img);
    openQuote(el.dataset.id);
  }));
  hydrateImages(list);
}

/* ---------- Customer add/edit ---------- */
$('#btnAddCust').addEventListener('click', () => {
  editingCust = false;
  $('#custModalTitle').textContent = 'Naya Customer';
  $('#custName').value = ''; $('#custPhone').value = '';
  $('#deleteCustRow').style.display = 'none';
  openModal('custModal'); setTimeout(() => $('#custName').focus(), 200);
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
  if (confirm('Ye customer aur uska poora hisaab delete ho jayega. Yaqeen hai?')) { Store.deleteCustomer(currentCustId); closeModal('custModal'); backFromDetail(); }
});

/* ---------- Transactions + image + auto WhatsApp ---------- */
function openTxn(type) {
  txnType = type;
  $('#txnModalTitle').textContent = type === 'debit' ? 'Udhaar Diya' : 'Paisay Milay';
  updateTypeToggle();
  $('#txnAmount').value = ''; $('#txnNote').value = '';
  $('#txnDate').value = new Date().toISOString().slice(0, 10);
  $('#txnNotify').checked = Store.getShop().autoWhatsApp !== false;
  $('#txnImage').value = ''; pendingTxnImg = null;
  $('#txnImgPreview').classList.add('hidden');
  openModal('txnModal'); setTimeout(() => $('#txnAmount').focus(), 200);
}
function updateTypeToggle() {
  $('#typeDebit').className = txnType === 'debit' ? 'act-debit' : '';
  $('#typeCredit').className = txnType === 'credit' ? 'act-credit' : '';
}
$('#btnGave').addEventListener('click', () => openTxn('debit'));
$('#btnGot').addEventListener('click', () => openTxn('credit'));
$('#typeDebit').addEventListener('click', () => { txnType = 'debit'; updateTypeToggle(); });
$('#typeCredit').addEventListener('click', () => { txnType = 'credit'; updateTypeToggle(); });
$('#txnImage').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { pendingTxnImg = await fileToDataURL(f, 1200, 0.7); const p = $('#txnImgPreview'); p.src = pendingTxnImg; p.classList.remove('hidden'); }
  catch (err) { toast('Tasveer load na hui'); }
});

$('#saveTxn').addEventListener('click', async () => {
  const amt = parseFloat($('#txnAmount').value);
  if (!amt || amt <= 0) { toast('Sahi raqam likhein'); return; }
  const dateStr = $('#txnDate').value;
  const date = dateStr ? new Date(dateStr + 'T' + new Date().toTimeString().slice(0, 8)).toISOString() : new Date().toISOString();
  let imgId = '';
  if (pendingTxnImg) imgId = await Store.putImage(pendingTxnImg);
  Store.addTxn(currentCustId, { amount: amt, type: txnType, note: $('#txnNote').value, date, img: imgId });
  const notify = $('#txnNotify').checked;
  closeModal('txnModal'); renderDetail();
  if (notify) sendEntryNotification(currentCustId, { amount: amt, type: txnType, note: $('#txnNote').value });
  else toast('Entry save ho gayi');
});

/* ---------- Quotes / Rate memory ---------- */
$('#btnAddQuote').addEventListener('click', () => {
  editingQuoteId = null;
  $('#quoteModalTitle').textContent = 'Rate likhein';
  $('#quoteJob').value = ''; $('#quoteRate').value = ''; $('#quoteNote').value = '';
  $('#quoteStatus').value = 'Quoted';
  $('#quoteDate').value = new Date().toISOString().slice(0, 10);
  $('#quoteImage').value = ''; pendingQuoteImg = null; $('#quoteImgPreview').classList.add('hidden');
  $('#deleteQuoteRow').style.display = 'none';
  openModal('quoteModal'); setTimeout(() => $('#quoteJob').focus(), 200);
});
function openQuote(id) {
  const c = Store.getCustomer(currentCustId); const q = c.quotes.find(x => x.id === id); if (!q) return;
  editingQuoteId = id;
  $('#quoteModalTitle').textContent = 'Rate Edit';
  $('#quoteJob').value = q.job; $('#quoteRate').value = q.rate; $('#quoteNote').value = q.note || '';
  $('#quoteStatus').value = q.status || 'Quoted';
  $('#quoteDate').value = new Date(q.date).toISOString().slice(0, 10);
  $('#quoteImage').value = ''; pendingQuoteImg = null;
  const p = $('#quoteImgPreview');
  if (q.img) { Store.getImage(q.img).then(u => { if (u) { p.src = u; p.classList.remove('hidden'); } }); } else p.classList.add('hidden');
  $('#deleteQuoteRow').style.display = 'flex';
  openModal('quoteModal');
}
$('#quoteImage').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { pendingQuoteImg = await fileToDataURL(f, 1200, 0.7); const p = $('#quoteImgPreview'); p.src = pendingQuoteImg; p.classList.remove('hidden'); }
  catch (err) { toast('Tasveer load na hui'); }
});
$('#saveQuote').addEventListener('click', async () => {
  const job = $('#quoteJob').value.trim();
  const rate = parseFloat($('#quoteRate').value);
  if (!job) { toast('Kaam likhein'); return; }
  if (!rate || rate <= 0) { toast('Rate likhein'); return; }
  const date = new Date($('#quoteDate').value + 'T' + new Date().toTimeString().slice(0, 8)).toISOString();
  const status = $('#quoteStatus').value, note = $('#quoteNote').value;
  let imgId = editingQuoteId ? undefined : '';
  if (pendingQuoteImg) imgId = await Store.putImage(pendingQuoteImg);
  if (editingQuoteId) {
    const patch = { job, rate, note, status, date };
    if (imgId !== undefined) patch.img = imgId;
    Store.updateQuote(currentCustId, editingQuoteId, patch);
  } else {
    Store.addQuote(currentCustId, { job, rate, note, status, date, img: imgId });
  }
  closeModal('quoteModal'); renderQuotes();
  toast('Rate mehfooz ho gaya ✅');
});
$('#deleteQuote').addEventListener('click', () => {
  if (editingQuoteId && confirm('Ye rate delete karein?')) { Store.deleteQuote(currentCustId, editingQuoteId); closeModal('quoteModal'); renderQuotes(); }
});

/* ---------- Link + WhatsApp ---------- */
function buildViewerLink(c) {
  const shop = Store.getShop();
  const payload = {
    v: 1, shop: shop.name || 'Al Tariq Printers', shopPhone: shop.phone || '', logo: shop.logoSmall || '',
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
function entryMessage(c, entry) {
  const shop = Store.getShop();
  const link = buildViewerLink(c);
  const b = Store.balanceOf(c);
  const kind = entry.type === 'debit' ? 'Udhaar (aap ne liya)' : 'Jama (aap ne diya)';
  const balLine = b > 0 ? `Ab aap par baqi: *${fmtMoney(b)}*` : b < 0 ? `Ab hamare zimmay: *${fmtMoney(b)}*` : `Ab hisaab barabar hai.`;
  return `*${shop.name || 'Al Tariq Printers'}*\nAssalam-o-Alaikum ${c.name},\nAap ke khaate me nayi entry hui hai:\n\n${kind}: *${fmtMoney(entry.amount)}*\n` +
    (entry.note ? `Tafseel: ${entry.note}\n` : '') + `${balLine}\n\nPoora hisaab (PDF) yahan dekhein:\n${link}`;
}
async function sendEntryNotification(custId, entry) {
  const c = Store.getCustomer(custId); if (!c) return;
  const phone = intlPhone(c.phone);
  if (!phone) { toast('WhatsApp ke liye customer ka number add karein'); return; }
  const msg = entryMessage(c, entry);
  const endpoint = (Store.getShop().waEndpoint || '').trim();
  if (endpoint) {
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: phone, message: msg }) });
      if (res.ok) { toast('✅ WhatsApp bhej diya gaya'); return; }
      toast('Auto-send fail — WhatsApp khol raha hoon');
    } catch (e) { toast('Server na mila — WhatsApp khol raha hoon'); }
  }
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
}
$('#btnWhatsApp').addEventListener('click', () => {
  const c = Store.getCustomer(currentCustId);
  const phone = intlPhone(c.phone), shop = Store.getShop(), link = buildViewerLink(c), b = Store.balanceOf(c);
  const balLine = b > 0 ? `Aap par baqi hai: *${fmtMoney(b)}*` : b < 0 ? `Hamare zimmay: *${fmtMoney(b)}*` : `Hisaab barabar hai.`;
  const msg = `*${shop.name || 'Al Tariq Printers'}*\nAssalam-o-Alaikum ${c.name},\n\n${balLine}\n\nApna poora hisaab (PDF) yahan dekhein:\n${link}`;
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
});
$('#btnCopyLink').addEventListener('click', async () => {
  const link = buildViewerLink(Store.getCustomer(currentCustId));
  try { await navigator.clipboard.writeText(link); toast('Link copy ho gaya ✅'); } catch (e) { prompt('Link copy karein:', link); }
});

/* ---------- Settings ---------- */
function loadSettings() {
  const s = Store.getShop();
  $('#setShopName').value = s.name || '';
  $('#setShopPhone').value = s.phone || '';
  $('#setViewerBase').value = s.viewerBase || '';
  $('#setAutoWa').checked = s.autoWhatsApp !== false;
  $('#setWaEndpoint').value = s.waEndpoint || '';
  const lp = $('#logoPreview');
  if (s.logo) { lp.src = s.logo; lp.style.display = 'block'; } else { lp.removeAttribute('src'); }
  const lb = Store.lastBackup();
  $('#storageInfo').textContent = 'Data phone me mehfooz hai (IndexedDB + backup copy). ' + (lb ? 'Aakhri backup: ' + fmtDateTime(new Date(lb).toISOString()) : 'Abhi tak file-backup nahi hua.');
}
$('#btnUploadLogo').addEventListener('click', () => $('#logoFile').click());
$('#logoFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const logo = await fileToDataURL(f, 240, 0.9);
    const logoSmall = await fileToDataURL(f, 140, 0.8);
    Store.setShop({ logo, logoSmall });
    $('#logoPreview').src = logo; $('#logoPreview').style.display = 'block';
    applyBranding(); toast('Logo save ho gaya ✅');
  } catch (err) { toast('Logo load na hua'); }
});
$('#btnRemoveLogo').addEventListener('click', () => { Store.setShop({ logo: '', logoSmall: '' }); $('#logoPreview').removeAttribute('src'); applyBranding(); toast('Logo hata diya'); });

$('#saveSettings').addEventListener('click', () => {
  Store.setShop({
    name: $('#setShopName').value.trim() || 'Al Tariq Printers',
    phone: $('#setShopPhone').value.trim(),
    viewerBase: $('#setViewerBase').value.trim(),
    autoWhatsApp: $('#setAutoWa').checked,
    waEndpoint: $('#setWaEndpoint').value.trim()
  });
  applyBranding(); toast('Settings save ho gayi ✅');
});

function doExport() {
  const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'altariq-hisaab-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click(); URL.revokeObjectURL(url);
  Store.markBackup();
  $('#backupBanner').classList.add('hidden');
  toast('Backup file save ho gayi ✅');
}
$('#btnExport').addEventListener('click', doExport);
$('#btnImport').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { Store.importJSON(reader.result); toast('Backup load ho gaya ✅'); loadSettings(); } catch (err) { toast('Ghalat backup file'); } };
  reader.readAsText(file);
});

/* Snapshot restore */
$('#btnSnapshots').addEventListener('click', async () => {
  const snaps = await Store.listSnapshots();
  const list = $('#snapList');
  if (snaps.length === 0) { list.innerHTML = `<div class="empty" style="padding:20px;">Abhi koi auto-backup nahi.</div>`; }
  else {
    list.innerHTML = snaps.map(s => `<div class="snap"><div class="s-info"><b>${fmtDateTime(s.at)}</b>${s.customers} customers</div><button data-ts="${s.ts}">Restore</button></div>`).join('');
    $$('#snapList .snap button').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Is version par wapas jayein? Mojooda data is se badal jayega.')) return;
      await Store.restoreSnapshot(Number(btn.dataset.ts));
      closeModal('snapModal'); toast('Purana version wapas aa gaya ✅'); nav('overview');
    }));
  }
  openModal('snapModal');
});

/* ---------- Boot ---------- */
(async function boot() {
  await Store.init();
  const s = Store.getShop();
  if (!s.viewerBase && location.protocol.startsWith('http')) {
    Store.setShop({ viewerBase: location.origin + location.pathname.replace(/\/index\.html.*$/, '').replace(/\/$/, '') });
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  applyBranding();
  nav('overview');
})();
