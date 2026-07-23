/* app.js — Al Tariq Printers Hisaab (Udhaar Book style) */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let currentCustId = null;
let currentKind = 'customer';   // 'customer' | 'supplier'
let accountsKind = 'customer';
let txnType = 'debit';
let editingCust = false;
let editingTxn = null;   // txn object being edited (null = adding new)

function kindLabels(kind) {
  if (kind === 'supplier') return {
    debit: 'Maal Liya', credit: 'Paisa Diya',
    addTitle: 'Naya Supplier', editTitle: 'Supplier Edit', delText: 'Supplier Delete',
    balPos: 'Supplier ko dena hai', balNeg: 'Supplier se lena hai',
    addBtn: '+ Naya Supplier', search: '🔍 Supplier dhoondein...'
  };
  return {
    debit: 'Maal Diya', credit: 'Paisay Milay',
    addTitle: 'Naya Customer', editTitle: 'Customer Edit', delText: 'Customer Delete',
    balPos: 'Customer se lena hai', balNeg: 'Customer ko dena hai',
    addBtn: '+ Naya Customer', search: '🔍 Customer dhoondein...'
  };
}
function curParty() { return Store.getParty(currentKind, currentCustId); }
let editingQuoteId = null;
let pendingTxnImg = null;    // dataURL staged for a new txn
let pendingQuoteImg = null;  // dataURL staged for a new quote
let activeNav = 'overview';
let detailSearch = '';       // search within a customer/supplier account

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

/* ---------- Calculator ---------- */
function evalExpr(expr) {
  if (!expr) return 0;
  let s = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  s = s.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  s = s.replace(/[+\-*/.]+$/, '');
  if (!/^[-0-9+*/().\s]*$/.test(s)) return null;
  if (!s) return 0;
  try {
    const out = [], ops = [], prec = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const tokens = s.match(/\d+\.?\d*|[+\-*/()]/g) || [];
    let prev = null;
    tokens.forEach(tk => {
      if (/\d/.test(tk)) out.push(parseFloat(tk));
      else if (tk === '(') ops.push(tk);
      else if (tk === ')') { while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop()); ops.pop(); }
      else {
        if ((tk === '-' || tk === '+') && (prev === null || prev === '(' || prev === 'op')) out.push(0);
        while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[tk]) out.push(ops.pop());
        ops.push(tk);
      }
      prev = /\d/.test(tk) ? 'num' : (tk === ')' ? 'num' : (tk === '(' ? '(' : 'op'));
    });
    while (ops.length) out.push(ops.pop());
    const st = [];
    out.forEach(t => {
      if (typeof t === 'number') st.push(t);
      else { const b = st.pop(), a = st.pop(); st.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : a / b); }
    });
    const v = st.length ? st[st.length - 1] : 0;
    return isFinite(v) ? Math.round(v * 100) / 100 : null;
  } catch (e) { return null; }
}
function makeCalc(padEl, dispEl, eqEl) {
  let expr = '';
  const keys = [['C', 'op'], ['÷', 'op'], ['×', 'op'], ['⌫', 'del'],
    ['7', ''], ['8', ''], ['9', ''], ['−', 'op'],
    ['4', ''], ['5', ''], ['6', ''], ['+', 'op'],
    ['1', ''], ['2', ''], ['3', ''], ['%', 'op'],
    ['00', ''], ['0', ''], ['.', ''], ['=', 'eq']];
  padEl.innerHTML = keys.map(([k, c]) => `<button type="button" class="${c}" data-k="${k}">${k}</button>`).join('');
  function refresh() {
    dispEl.value = expr || '0';
    const v = evalExpr(expr);
    const hasOp = /[+\-×÷*/%]/.test(expr.replace(/^[−-]/, ''));
    eqEl.textContent = (hasOp && v != null) ? '= ' + fmtMoney(v) : '';
  }
  padEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'C') expr = '';
    else if (k === '⌫') expr = expr.slice(0, -1);
    else if (k === '=') { const v = evalExpr(expr); if (v != null) expr = String(v); }
    else expr += k;
    refresh();
  }));
  return { get value() { return evalExpr(expr) || 0; }, reset() { expr = ''; refresh(); }, set(v) { expr = (v == null ? '' : String(v)); refresh(); } };
}
const txnCalc = makeCalc(document.getElementById('txnPad'), document.getElementById('txnAmount'), document.getElementById('txnEq'));

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
  $('#ovLogo').src = s.logo || 'assets/mark.png';
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

  const today = localDay(new Date());
  let tc = 0;
  Store.getCustomers().forEach(c => (c.txns || []).forEach(t => { if (localDay(t.date) === today) tc++; }));
  Store.getSuppliers().forEach(c => (c.txns || []).forEach(t => { if (localDay(t.date) === today) tc++; }));
  $('#ovTodayCount').textContent = tc;

  // backup reminder banner (if no backup in last 24h and there is data)
  const stale = (Date.now() - Store.lastBackup()) > 86400000;
  $('#backupBanner').classList.toggle('hidden', !(stale && customers > 0));

  renderOvPanel(); // agar koi panel khula hai to fresh rakho
}
$('#ovSettings').addEventListener('click', () => nav('settings'));
$('#bannerBackup').addEventListener('click', doExport);

/* local calendar day (yyyy-mm-dd) — timezone-safe */
function localDay(iso) {
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* latest activity time (last txn) — sorting ke liye */
function lastActivity(c) {
  const t = c.txns;
  if (t && t.length) return new Date(t[t.length - 1].date).getTime();
  return 0;
}

/* ---------- Overview: tap-able boxes → niche list ---------- */
let ovPanelType = null;
let ovDateFilter = ''; // yyyy-mm-dd (today panel)
$$('#overviewView .tap').forEach(el => el.addEventListener('click', () => toggleOvPanel(el.dataset.panel)));

function toggleOvPanel(type) {
  if (ovPanelType === type) { ovPanelType = null; renderOvPanel(); return; }
  ovPanelType = type;
  if (type === 'today') ovDateFilter = '';
  renderOvPanel();
}
function partyRowHtml(kind, c, rightHtml) {
  return `<div class="cust" data-kind="${kind}" data-id="${c.id}">
    <div class="avatar" style="background:${avatarColor(c.id)}">${initials(c.name)}</div>
    <div class="info"><div class="name">${esc(c.name)}</div><div class="phone">${esc(c.phone) || '—'}</div></div>
    ${rightHtml || ''}</div>`;
}
function renderOvPanel() {
  const box = $('#ovPanel');
  $$('#overviewView .tap').forEach(el => el.classList.toggle('sel', el.dataset.panel === ovPanelType));
  if (!ovPanelType) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.classList.remove('hidden');

  if (ovPanelType === 'lena' || ovPanelType === 'dena') {
    // lena: customer b>0 + supplier b<0 ; dena: customer b<0 + supplier b>0
    const rows = [];
    Store.getCustomers().forEach(c => { const b = Store.balanceOf(c); if (ovPanelType === 'lena' ? b > 0 : b < 0) rows.push({ kind: 'customer', c, amt: Math.abs(b) }); });
    Store.getSuppliers().forEach(c => { const b = Store.balanceOf(c); if (ovPanelType === 'lena' ? b < 0 : b > 0) rows.push({ kind: 'supplier', c, amt: Math.abs(b) }); });
    rows.sort((a, b) => b.amt - a.amt); // sab se ziada balance upar, kam niche
    const title = ovPanelType === 'lena' ? `Jin se LENA hai (${rows.length})` : `Jin ko DENA hai (${rows.length})`;
    const cls = ovPanelType === 'lena' ? 'pos' : 'neg';
    box.innerHTML = `<div class="ov-head">${title}</div>` + (rows.length
      ? `<div class="list">` + rows.map(r => partyRowHtml(r.kind, r.c, `<div class="bal"><div class="amt ${cls}">${fmtMoney(r.amt)}</div></div>`)).join('') + `</div>`
      : `<div class="empty" style="padding:20px;">Koi nahi 🎉</div>`);
  }
  else if (ovPanelType === 'customers') {
    const list = Store.getCustomers().slice().sort((a, b) => lastActivity(b) - lastActivity(a));
    box.innerHTML = `<div class="ov-head">Customers (${list.length}) — naam &amp; number</div>`
      + `<div class="list">` + list.map(c => partyRowHtml('customer', c, '')).join('') + `</div>`;
  }
  else if (ovPanelType === 'today') {
    const all = [];
    Store.getCustomers().forEach(c => (c.txns || []).forEach(t => all.push({ t, c, kind: 'customer' })));
    Store.getSuppliers().forEach(c => (c.txns || []).forEach(t => all.push({ t, c, kind: 'supplier' })));
    const day = ovDateFilter || localDay(new Date());
    const rows = all.filter(x => localDay(x.t.date) === day)
      .sort((a, b) => new Date(b.t.date) - new Date(a.t.date));
    const label = ovDateFilter ? fmtDate(ovDateFilter + 'T12:00:00') : 'Aaj';
    box.innerHTML = `<div class="ov-head">${label} ki entries (${rows.length})
        <input type="date" id="ovDate" class="ov-date" value="${day}"></div>`
      + (rows.length
        ? `<div class="list">` + rows.map(x => {
            const d = x.t.type === 'debit';
            return `<div class="cust" data-kind="${x.kind}" data-id="${x.c.id}">
              <div class="t-icon ${x.t.type}">${d ? '↑' : '↓'}</div>
              <div class="info"><div class="name">${esc(x.c.name)}</div><div class="phone">${esc(x.t.note) || (d ? 'Maal diya' : 'Paisay milay')} • ${fmtDateTime(x.t.date)}</div></div>
              <div class="bal"><div class="amt ${d ? 'neg' : 'pos'}">${d ? '−' : '+'}${fmtMoney(x.t.amount)}</div></div></div>`;
          }).join('') + `</div>`
        : `<div class="empty" style="padding:20px;">Is din koi entry nahi</div>`);
    const di = $('#ovDate');
    if (di) di.addEventListener('change', e => { ovDateFilter = e.target.value; renderOvPanel(); });
  }
  // rows → open detail
  $$('#ovPanel .cust').forEach(el => el.addEventListener('click', ev => {
    if (ev.target.id === 'ovDate') return;
    openDetail(el.dataset.kind, el.dataset.id);
  }));
}

/* ---------- Udhaar reminders ---------- */
$('#btnReminders').addEventListener('click', () => {
  const debtors = Store.getCustomers().filter(c => Store.balanceOf(c) > 0).sort((a, b) => Store.balanceOf(b) - Store.balanceOf(a));
  const list = $('#reminderList');
  if (debtors.length === 0) { list.innerHTML = `<div class="empty" style="padding:24px;">Kisi se lena baqi nahi 🎉</div>`; }
  else {
    list.innerHTML = debtors.map(c => `<div class="cust" data-id="${c.id}">
      <div class="avatar" style="background:${avatarColor(c.id)}">${initials(c.name)}</div>
      <div class="info"><div class="name">${esc(c.name)}</div><div class="phone">${fmtMoney(Store.balanceOf(c))} lena</div></div>
      <button class="remind-one" data-id="${c.id}">🔔 Yaad dilayein</button></div>`).join('');
    $$('#reminderList .remind-one').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); sendReminder(b.dataset.id); }));
  }
  openModal('reminderModal');
});
async function sendReminder(custId) {
  const c = Store.getCustomer(custId); if (!c) return;
  const phone = intlPhone(c.phone);
  if (!phone) { toast('Is customer ka number add karein'); return; }
  await ensurePublished(c);
  const shop = Store.getShop(), link = shareLinkFor(c), b = Store.balanceOf(c);
  const msg = `*${shop.name || 'Al Tariq Printers'}*\nAssalam-o-Alaikum ${c.name},\n\nAap ke zimmay *${fmtMoney(b)}* baqaya hai. Baraye meharbani adaigi kar dein.\n\nApna hisaab (PDF) yahan dekhein:\n${link}${payFooter()}`;
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
}

/* ---------- Accounts ---------- */
function renderAccounts() {
  const L = kindLabels(accountsKind);
  $('#btnAddCust').textContent = L.addBtn;
  $('#searchBox').placeholder = L.search;
  $$('#partySeg button').forEach(b => b.classList.toggle('active', b.dataset.kind === accountsKind));

  const q = $('#searchBox').value.trim().toLowerCase();
  let custs = Store.getParties(accountsKind).slice();
  if (q) custs = custs.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
  // Sab se latest entry wala account sab se upar (jaise jaise entry karte jao top par aata jaye)
  custs.sort((a, b) => lastActivity(b) - lastActivity(a));
  const list = $('#custList');
  if (custs.length === 0) {
    const none = accountsKind === 'supplier' ? 'Abhi koi supplier nahi.<br>Upar "+ Naya Supplier".' : 'Abhi koi customer nahi.<br>Upar "+ Naya Customer".';
    list.innerHTML = `<div class="empty"><div class="big">📒</div>${q ? 'Koi nahi mila' : none}</div>`;
    return;
  }
  list.innerHTML = custs.map(c => {
    const b = Store.balanceOf(c);
    const cls = b > 0 ? 'pos' : b < 0 ? 'neg' : 'zero';
    let tag;
    if (accountsKind === 'supplier') tag = b > 0 ? 'Dena hai' : b < 0 ? 'Lena hai' : 'Barabar';
    else tag = b > 0 ? 'Lena hai' : b < 0 ? 'Dena hai' : 'Barabar';
    return `<div class="cust" data-id="${c.id}">
      <div class="avatar" style="background:${avatarColor(c.id)}">${initials(c.name)}</div>
      <div class="info"><div class="name">${esc(c.name)}</div><div class="phone">${esc(c.phone) || '—'}</div></div>
      <div class="bal"><div class="amt ${cls}">${fmtMoney(b)}</div><div class="tag">${tag}</div></div></div>`;
  }).join('');
  $$('#custList .cust').forEach(el => el.addEventListener('click', () => openDetail(accountsKind, el.dataset.id)));
}
$('#searchBox').addEventListener('input', renderAccounts);
$$('#partySeg button').forEach(b => b.addEventListener('click', () => { accountsKind = b.dataset.kind; $('#searchBox').value = ''; renderAccounts(); }));

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
    openDetail('customer', el.dataset.cust);
  }));
  hydrateImages(list);
}
$('#rateSearch').addEventListener('input', renderRates);

const STATUS_COLORS = {
  'Rate Diya': ['#dbeafe', '#1e40af'],
  'Confirmed': ['#fef3c7', '#92400e'],
  'Design': ['#ede9fe', '#6d28d9'],
  'File Aayi': ['#cffafe', '#155e75'],
  'Printing': ['#ffedd5', '#9a3412'],
  'Delivered': ['#dcfce7', '#166534'],
  'Cancelled': ['#fee2e2', '#991b1b']
};
function badgeHtml(status) {
  const s = status || 'Rate Diya';
  const [bg, fg] = STATUS_COLORS[s] || ['#e2e8f0', '#334155'];
  return `<span class="badge" style="background:${bg};color:${fg}">${esc(s)}</span>`;
}
function quoteRowHtml(x, showCust) {
  const thumb = x.img ? `<img class="q-thumb" data-img="${x.img}" alt="">` : '';
  return `<div class="quote" data-cust="${x.custId || ''}" data-id="${x.id}">
    ${thumb}
    <div class="q-main">
      <div class="q-job">${esc(x.job) || 'Kaam'}${badgeHtml(x.status)}</div>
      <div class="q-meta">${showCust ? esc(x.custName) + ' • ' : ''}${fmtDate(x.date)}${x.note ? ' • ' + esc(x.note) : ''}</div>
    </div>
    <div class="q-rate">${fmtMoney(x.rate)}</div>
  </div>`;
}

/* ---------- Detail ---------- */
let detailReturn = 'accounts';
function openDetail(kind, id) {
  detailReturn = (typeof activeNav !== 'undefined' && activeNav) ? activeNav : 'accounts';
  currentKind = kind || 'customer';
  currentCustId = id;
  const isCust = currentKind === 'customer';
  // suppliers: no share link, no rates tab
  $('#detailView .share-row').style.display = isCust ? 'flex' : 'none';
  $('#detailView .tabs').style.display = isCust ? 'flex' : 'none';
  const L = kindLabels(currentKind);
  $('#btnGave').textContent = '− ' + L.debit;
  $('#btnGot').textContent = '+ ' + L.credit;
  detailSearch = ''; $('#detailSearch').value = '';
  switchDetailTab('txns');
  renderDetail();
  $('#bottomnav').classList.add('hidden');
  showView('detailView');
}
function backFromDetail() { currentCustId = null; nav(detailReturn === 'settings' ? 'accounts' : detailReturn); }
$('#btnBack').addEventListener('click', backFromDetail);

function switchDetailTab(tab) {
  $$('#detailView .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('#txnPane').classList.toggle('hidden', tab !== 'txns');
  $('#quotePane').classList.toggle('hidden', tab !== 'quotes');
  $('#detailActions').style.display = tab === 'txns' ? 'flex' : 'none';
}
$$('#detailView .tab').forEach(t => t.addEventListener('click', () => { switchDetailTab(t.dataset.tab); if (t.dataset.tab === 'quotes') renderQuotes(); else renderDetail(); }));
$('#detailSearch').addEventListener('input', () => {
  detailSearch = $('#detailSearch').value;
  if (!$('#quotePane').classList.contains('hidden')) renderQuotes();
  else renderDetail();
});

function renderDetail() {
  const c = curParty(); if (!c) return backFromDetail();
  const L = kindLabels(currentKind);
  $('#detailTitle').textContent = c.name;
  $('#dName').textContent = c.name;
  $('#dPhone').textContent = c.phone || '—';
  const b = Store.balanceOf(c);
  const box = $('#dBalanceBox');
  box.className = 'balance-box ' + (b > 0 ? 'pos' : b < 0 ? 'neg' : 'zero');
  $('#dBalLabel').textContent = b > 0 ? L.balPos : b < 0 ? L.balNeg : 'Hisaab barabar hai';
  $('#dBalAmt').textContent = fmtMoney(b);
  $('#dBalAmt').className = 'b-amt ' + (b > 0 ? 'pos' : b < 0 ? 'neg' : 'zero');

  const q = detailSearch.trim().toLowerCase();
  const list = $('#txnList');
  // har entry ka running balance (chronological order) — Udhaar jaisa
  const chron = c.txns.slice().sort((x, y) => new Date(x.date) - new Date(y.date));
  const runMap = {}; let run = 0;
  chron.forEach(t => { run += t.type === 'debit' ? t.amount : -t.amount; runMap[t.id] = run; });
  const balCls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero';
  let txns = c.txns.slice().reverse();
  if (q) txns = txns.filter(t => (t.note || '').toLowerCase().includes(q) || String(t.amount).includes(q));
  if (txns.length === 0) { list.innerHTML = `<div class="empty" style="padding:24px;">${q ? 'Koi lein-dein nahi mila' : 'Abhi koi lein-dein nahi'}</div>`; }
  else {
    list.innerHTML = txns.map(t => {
      const d = t.type === 'debit';
      const thumb = t.img ? `<img class="t-thumb" data-img="${t.img}" alt="">` : '';
      const bv = runMap[t.id] || 0;
      return `<div class="txn ${t.type}" data-id="${t.id}">
        <div class="t-icon">${d ? '↑' : '↓'}</div>${thumb}
        <div class="t-info"><div class="t-note">${esc(t.note) || (d ? L.debit : L.credit)}</div>
          <div class="t-meta"><span class="t-date">${fmtDateTime(t.date)}</span><span class="t-bal ${balCls(bv)}">Bal. ${fmtMoney(bv)}</span></div></div>
        <div class="t-amt">${d ? '−' : '+'}${fmtMoney(t.amount)}</div>
        <button class="t-del" title="Delete">🗑</button></div>`;
    }).join('');
    $$('#txnList .txn').forEach(el => {
      el.querySelector('.t-del').addEventListener('click', e => { e.stopPropagation(); if (confirm('Ye lein-dein delete karein?')) { Store.deletePartyTxn(currentKind, currentCustId, el.dataset.id); renderDetail(); republishIfShared(curParty()); } });
      el.addEventListener('click', () => { const t = (curParty().txns || []).find(x => x.id === el.dataset.id); if (t) openTxnEdit(t); });
      const th = el.querySelector('.t-thumb'); if (th) th.addEventListener('click', () => openImage(th.dataset.img));
    });
    hydrateImages(list);
  }
  if (currentKind === 'customer') renderQuotes();
}

function renderQuotes() {
  const c = Store.getCustomer(currentCustId); if (!c) return;
  const list = $('#quoteList');
  const q = detailSearch.trim().toLowerCase();
  let quotes = c.quotes || [];
  if (q) quotes = quotes.filter(x => (x.job || '').toLowerCase().includes(q) || (x.note || '').toLowerCase().includes(q) || String(x.rate).includes(q));
  if (quotes.length === 0) { list.innerHTML = `<div class="empty" style="padding:20px;">${q ? 'Koi rate nahi mila' : 'Koi rate darj nahi.<br>Upar "+ Rate likhein".'}</div>`; return; }
  list.innerHTML = quotes.map(x => quoteRowHtml(x, false)).join('');
  $$('#quoteList .quote').forEach(el => el.addEventListener('click', e => {
    if (e.target.dataset.img) return openImage(e.target.dataset.img);
    openQuote(el.dataset.id);
  }));
  hydrateImages(list);
}

/* ---------- Customer add/edit ---------- */
$('#btnAddCust').addEventListener('click', () => {
  editingCust = false;
  currentKind = accountsKind;
  $('#custModalTitle').textContent = kindLabels(accountsKind).addTitle;
  $('#custName').value = ''; $('#custPhone').value = '';
  $('#deleteCustRow').style.display = 'none';
  openModal('custModal'); setTimeout(() => $('#custName').focus(), 200);
});
$('#btnEditCust').addEventListener('click', () => {
  const c = curParty(); if (!c) return;
  editingCust = true;
  $('#custModalTitle').textContent = kindLabels(currentKind).editTitle;
  $('#custName').value = c.name; $('#custPhone').value = c.phone || '';
  $('#deleteCust').textContent = '🗑 ' + kindLabels(currentKind).delText;
  $('#deleteCustRow').style.display = 'flex';
  openModal('custModal');
});
$('#saveCust').addEventListener('click', () => {
  const name = $('#custName').value.trim(), phone = $('#custPhone').value.trim();
  if (!name) { toast('Naam likhna zaroori hai'); return; }
  if (editingCust) { Store.updateParty(currentKind, currentCustId, { name, phone }); renderDetail(); republishIfShared(curParty()); closeModal('custModal'); }
  else { const c = Store.addParty(currentKind, { name, phone }); closeModal('custModal'); openDetail(currentKind, c.id); }
});
$('#deleteCust').addEventListener('click', () => {
  if (confirm('Ye account aur iska poora hisaab delete ho jayega. Yaqeen hai?')) { Store.deleteParty(currentKind, currentCustId); closeModal('custModal'); backFromDetail(); }
});

/* ---- Contacts se number chuno (Contact Picker API — Android Chrome) ---- */
const contactsSupported = !!(navigator.contacts && navigator.contacts.select);
(function setupContactPicker() {
  const btn = $('#custPickContact');
  if (!btn) return;
  if (!contactsSupported) { btn.style.display = 'none'; return; }
  btn.addEventListener('click', async () => {
    try {
      const sel = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!sel || !sel.length) return;
      const ct = sel[0];
      const tel = (ct.tel && ct.tel[0]) ? String(ct.tel[0]).replace(/[^\d+]/g, '') : '';
      const nm = (ct.name && ct.name[0]) ? ct.name[0] : '';
      if (tel) $('#custPhone').value = tel;
      if (nm && !$('#custName').value.trim()) $('#custName').value = nm;
      if (!tel) toast('Is contact me number nahi mila');
    } catch (e) { /* user ne cancel kiya ya ijazat nahi di */ }
  });
})();

/* ---------- Transactions + image + auto WhatsApp ---------- */
function openTxn(type) {
  editingTxn = null;
  txnType = type;
  const L = kindLabels(currentKind);
  $('#typeDebit').textContent = '− ' + L.debit;
  $('#typeCredit').textContent = '+ ' + L.credit;
  $('#txnModalTitle').textContent = type === 'debit' ? L.debit : L.credit;
  updateTypeToggle();
  txnCalc.reset(); $('#txnNote').value = '';
  $('#txnDate').value = new Date().toISOString().slice(0, 10);
  // WhatsApp notify only for customers
  const notifyRow = $('#txnNotify').closest('.switch-row');
  if (currentKind === 'customer') { notifyRow.style.display = 'flex'; $('#txnNotify').checked = Store.getShop().autoWhatsApp !== false; }
  else { notifyRow.style.display = 'none'; $('#txnNotify').checked = false; }
  $('#txnImage').value = ''; $('#txnImageCam').value = ''; pendingTxnImg = null;
  $('#txnImgPreview').classList.add('hidden');
  openModal('txnModal');
}
// Purani entry par click -> edit mode (raqam/type/note/date badlein ya delete)
function openTxnEdit(t) {
  editingTxn = t;
  txnType = t.type;
  const L = kindLabels(currentKind);
  $('#typeDebit').textContent = '− ' + L.debit;
  $('#typeCredit').textContent = '+ ' + L.credit;
  $('#txnModalTitle').textContent = '✏️ Entry Edit';
  updateTypeToggle();
  txnCalc.set(t.amount);
  $('#txnNote').value = t.note || '';
  $('#txnDate').value = (t.date || '').slice(0, 10);
  const notifyRow = $('#txnNotify').closest('.switch-row');
  notifyRow.style.display = 'none'; $('#txnNotify').checked = false;
  $('#txnImage').value = ''; $('#txnImageCam').value = ''; pendingTxnImg = null;
  if (t.img) { const p = $('#txnImgPreview'); Store.getImage(t.img).then(u => { if (u) { p.src = u; p.classList.remove('hidden'); } }); }
  else $('#txnImgPreview').classList.add('hidden');
  openModal('txnModal');
}
function updateTypeToggle() {
  $('#typeDebit').classList.toggle('act-debit', txnType === 'debit');
  $('#typeCredit').classList.toggle('act-credit', txnType === 'credit');
}
$('#btnGave').addEventListener('click', () => openTxn('debit'));
$('#btnGot').addEventListener('click', () => openTxn('credit'));
$('#typeDebit').addEventListener('click', () => { txnType = 'debit'; updateTypeToggle(); });
$('#typeCredit').addEventListener('click', () => { txnType = 'credit'; updateTypeToggle(); });
async function handleTxnImage(e) {
  const f = e.target.files[0]; if (!f) return;
  try { pendingTxnImg = await fileToDataURL(f, 1200, 0.7); const p = $('#txnImgPreview'); p.src = pendingTxnImg; p.classList.remove('hidden'); }
  catch (err) { toast('Tasveer load na hui'); }
}
$('#txnImage').addEventListener('change', handleTxnImage);
$('#txnImageCam').addEventListener('change', handleTxnImage);
$('#txnCamBtn').addEventListener('click', () => $('#txnImageCam').click());
$('#txnGalBtn').addEventListener('click', () => $('#txnImage').click());

$('#saveTxn').addEventListener('click', async () => {
  const amt = txnCalc.value;
  if (!amt || amt <= 0) { toast('Sahi raqam likhein'); return; }
  const dateStr = $('#txnDate').value;

  // EDIT mode — mojooda entry update karein
  if (editingTxn) {
    // date: agar din wahi hai to asli waqt rakho, warna nayi date
    let date = editingTxn.date;
    if (dateStr && dateStr !== (editingTxn.date || '').slice(0, 10)) {
      const tm = editingTxn.date ? new Date(editingTxn.date).toTimeString().slice(0, 8) : '09:00:00';
      date = new Date(dateStr + 'T' + tm).toISOString();
    }
    let patch = { amount: amt, type: txnType, note: $('#txnNote').value, date };
    if (pendingTxnImg) patch.img = await Store.putImage(pendingTxnImg);
    Store.updatePartyTxn(currentKind, currentCustId, editingTxn.id, patch);
    editingTxn = null;
    closeModal('txnModal'); renderDetail(); republishIfShared(curParty());
    toast('Entry update ho gayi ✅'); return;
  }

  const date = dateStr ? new Date(dateStr + 'T' + new Date().toTimeString().slice(0, 8)).toISOString() : new Date().toISOString();
  const noteVal = $('#txnNote').value;
  const notify = currentKind === 'customer' && $('#txnNotify').checked;
  // Popup-block se bachne ke liye: click ke DAURAN hi WhatsApp window khol lo (baad me URL set karenge).
  const hasEndpoint = !!(Store.getShop().waEndpoint || '').trim();
  const preWin = (notify && !hasEndpoint && intlPhone((curParty() || {}).phone)) ? window.open('', '_blank') : null;
  let imgId = '';
  if (pendingTxnImg) imgId = await Store.putImage(pendingTxnImg);
  Store.addPartyTxn(currentKind, currentCustId, { amount: amt, type: txnType, note: noteVal, date, img: imgId });
  closeModal('txnModal'); renderDetail();
  republishIfShared(curParty());
  if (notify) sendEntryNotification(currentCustId, { amount: amt, type: txnType, note: noteVal }, preWin);
  else toast('Entry save ho gayi');
});

/* ---------- Quotes / Rate memory ---------- */
$('#btnAddQuote').addEventListener('click', () => {
  editingQuoteId = null;
  $('#quoteModalTitle').textContent = 'Rate likhein';
  $('#quoteJob').value = ''; $('#quoteRate').value = ''; $('#quoteNote').value = '';
  $('#quoteStatus').value = 'Rate Diya';
  $('#quoteDate').value = new Date().toISOString().slice(0, 10);
  $('#quoteImage').value = ''; $('#quoteImageCam').value = ''; pendingQuoteImg = null; $('#quoteImgPreview').classList.add('hidden');
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
  $('#quoteImage').value = ''; $('#quoteImageCam').value = ''; pendingQuoteImg = null;
  const p = $('#quoteImgPreview');
  if (q.img) { Store.getImage(q.img).then(u => { if (u) { p.src = u; p.classList.remove('hidden'); } }); } else p.classList.add('hidden');
  $('#deleteQuoteRow').style.display = 'flex';
  openModal('quoteModal');
}
async function handleQuoteImage(e) {
  const f = e.target.files[0]; if (!f) return;
  try { pendingQuoteImg = await fileToDataURL(f, 1200, 0.7); const p = $('#quoteImgPreview'); p.src = pendingQuoteImg; p.classList.remove('hidden'); }
  catch (err) { toast('Tasveer load na hui'); }
}
$('#quoteImage').addEventListener('change', handleQuoteImage);
$('#quoteImageCam').addEventListener('change', handleQuoteImage);
$('#quoteCamBtn').addEventListener('click', () => $('#quoteImageCam').click());
$('#quoteGalBtn').addEventListener('click', () => $('#quoteImage').click());
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
// compact v2 payload — short links (logo loaded by viewer; dates base36; type d/c)
function sharePayload(c) {
  const shop = Store.getShop();
  return {
    v: 2, s: shop.name || 'Al Tariq Printers', sp: shop.phone || '', lg: shop.logoSmall || '', bl: shop.bizLink || '',
    n: c.name, p: c.phone || '', b: Store.balanceOf(c),
    t: c.txns.map(t => [t.amount, t.type === 'debit' ? 'd' : 'c', t.note || '', Math.floor(new Date(t.date).getTime() / 1000).toString(36)]),
    g: Math.floor(Date.now() / 1000).toString(36)
  };
}
function shareBase() {
  const shop = Store.getShop();
  let base = (shop.viewerBase || '').trim();
  if (!base) base = location.origin + location.pathname.replace(/\/[^\/]*\.html.*$/, "").replace(/\/$/, '');
  return base.replace(/\/+$/, '');
}
// SNAPSHOT link (data baked into URL) — used when cloud is off
function buildViewerLink(c) { return shareBase() + '/view.html#d=' + encodeData(sharePayload(c)); }

// PERMANENT live link if Firebase is active (customer sees current hisaab anytime),
// else falls back to the snapshot link. NOTE: link banana aur publish karna alag hai —
// publish ko hamesha AWAIT karo (ensurePublished) warna WhatsApp khulte hi write mar jati hai.
function shareLinkFor(party) {
  if (Cloud.isReady()) {
    const token = Store.ensureShareId(currentKind, party.id);
    return shareBase() + '/view.html?id=' + token;
  }
  return buildViewerLink(party);
}
// Customer ko link dene se PEHLE data cloud par likh do, aur likhne ka intezaar karo.
// Agar internet slow/off ho to zyada se zyada 5s ruko, phir bhi WhatsApp khol do.
async function ensurePublished(party) {
  if (!party || !Cloud.isReady()) return;
  const token = Store.ensureShareId(currentKind, party.id);
  const timeout = new Promise(res => setTimeout(res, 5000));
  try { await Promise.race([Cloud.publishShare(token, sharePayload(party)), timeout]); }
  catch (e) { console.warn('publish', e); }
}
// Shared customers jinki PDF link update honi hai. Agar abhi net/cloud na ho to
// yaad rakho aur baad me (net aane par ya backup hone par) khud update kar do.
const pendingShares = new Set();
function republishIfShared(party) {
  if (!party || !party.shareId) return;
  Store.recordShareToken(party.name, party.shareId); // token permanently yaad rakho
  if (Cloud.isReady() && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    Cloud.publishShare(party.shareId, sharePayload(party)).then(ok => { if (!ok) pendingShares.add(party.shareId); });
  } else {
    pendingShares.add(party.shareId); // baad me update hogi
  }
}
// Sab bheje gaye links ko ek saath naye data se update karo
async function republishAllShared() {
  if (!Cloud.isReady()) { toast('Internet nahi — thori der baad dobara'); return; }
  const all = [...Store.getCustomers(), ...Store.getSuppliers()].filter(c => c.shareId);
  if (!all.length) { toast('Koi bheja hua link nahi mila'); return; }
  toast('Links update ho rahe hain…');
  let done = 0;
  for (const c of all) {
    Store.recordShareToken(c.name, c.shareId);
    try { const ok = await Cloud.publishShare(c.shareId, sharePayload(c)); if (ok) done++; } catch (e) {}
  }
  toast('✅ ' + done + '/' + all.length + ' links update ho gaye');
}
function flushShares() {
  if (!pendingShares.size || !Cloud.isReady() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const all = [...Store.getCustomers(), ...Store.getSuppliers()];
  [...pendingShares].forEach(id => {
    const p = all.find(x => x.shareId === id);
    if (!p) { pendingShares.delete(id); return; }
    Cloud.publishShare(id, sharePayload(p)).then(ok => { if (ok) pendingShares.delete(id); });
  });
}
if (typeof window !== 'undefined') window.addEventListener('online', flushShares);
function bizLine() { const l = (Store.getShop().bizLink || '').trim(); return l ? '\n' + l : ''; }
function payFooter() { const p = (Store.getShop().paymentInfo || '').trim(); return p ? '\n\n' + p : ''; }
// Sirf us entry ke pese aur total — baaki kuch nahi (per-entry auto WhatsApp)
function entryMessage(c, entry) {
  const b = Store.balanceOf(c);
  const kind = entry.type === 'debit' ? 'Maal Diya' : 'Paisay Milay';
  const balLine = b > 0 ? `Total baqaya: *${fmtMoney(b)}*` : b < 0 ? `Total (hamare zimmay): *${fmtMoney(b)}*` : `Total: barabar`;
  return `${kind}: *${fmtMoney(entry.amount)}*\n` + (entry.note ? `Tafseel: ${entry.note}\n` : '') + balLine;
}
async function sendEntryNotification(custId, entry, preWin) {
  const c = Store.getCustomer(custId); if (!c) { if (preWin) preWin.close(); return; }
  const phone = intlPhone(c.phone);
  if (!phone) { if (preWin) preWin.close(); toast('WhatsApp nahi khula — is customer ka number add karein'); return; }
  const msg = entryMessage(c, entry);
  const endpoint = (Store.getShop().waEndpoint || '').trim();
  if (endpoint) {
    if (preWin) preWin.close();
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: phone, message: msg }) });
      if (res.ok) { toast('✅ WhatsApp bhej diya gaya'); return; }
      toast('Auto-send fail — WhatsApp khol raha hoon');
    } catch (e) { toast('Server na mila — WhatsApp khol raha hoon'); }
  }
  const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
  if (preWin && !preWin.closed) { preWin.location.href = url; }
  else { const w = window.open(url, '_blank'); if (!w) toast('WhatsApp block ho gaya — dobara koshish karein'); }
}
$('#btnWhatsApp').addEventListener('click', async () => {
  const c = curParty();
  const phone = intlPhone(c.phone);
  await ensurePublished(c);
  const shop = Store.getShop(), link = shareLinkFor(c), b = Store.balanceOf(c);
  const balLine = b > 0 ? `Aap par baqi hai: *${fmtMoney(b)}*` : b < 0 ? `Hamare zimmay: *${fmtMoney(b)}*` : `Hisaab barabar hai.`;
  const msg = `*${shop.name || 'Al Tariq Printers'}*\nAssalam-o-Alaikum ${c.name},\n\n${balLine}\n\nApna poora hisaab (PDF) yahan dekhein:\n${link}${payFooter()}`;
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
});
$('#btnCopyLink').addEventListener('click', async () => {
  await ensurePublished(curParty());
  const link = shareLinkFor(curParty());
  try { await navigator.clipboard.writeText(link); toast('Link copy ho gaya ✅'); } catch (e) { prompt('Link copy karein:', link); }
});

/* ---------- Settings ---------- */
function loadSettings() {
  const s = Store.getShop();
  $('#setShopName').value = s.name || '';
  $('#setShopPhone').value = s.phone || '';
  $('#setViewerBase').value = s.viewerBase || '';
  $('#setBizLink').value = s.bizLink || '';
  $('#setPaymentInfo').value = s.paymentInfo || '';
  $('#setAutoWa').checked = s.autoWhatsApp !== false;
  $('#setWaEndpoint').value = s.waEndpoint || '';
  const cl = s.cloud || {};
  $('#setCloudEnabled').checked = !!cl.enabled;
  // Agar sync pehle se ON hai magar ID khaali hai, to khud bana do (aur save kar do).
  if (cl.enabled && !cl.syncId) {
    cl.syncId = genSyncId();
    Store.setShop({ cloud: Object.assign({}, cl) });
  }
  $('#setCloudSyncId').value = cl.syncId || '';
  $('#setCloudConfig').value = cl.config || '';
  $('#cloudStatus').textContent = Cloud.isReady() ? (Cloud.isSyncOn() ? '☁️ Cloud connected + sync on.' : '☁️ Cloud connected (live links on).') : (cl.enabled ? 'Cloud on hai lekin connect nahi hua — Test karein.' : '');
  $('#logoPreview').src = s.logo || 'assets/logo.png';
  const lb = Store.lastBackup();
  $('#storageInfo').textContent = 'Data phone me mehfooz hai. ' + (lb ? 'Aakhri backup: ' + fmtDateTime(new Date(lb).toISOString()) : 'Abhi tak file-backup nahi hua.');
  $('#lockStatus').textContent = Store.getShop().pinHash
    ? '🔒 App Lock ON hai — har baar kholne par PIN maanga jayega. (Ye PIN Abu ke phone par bhi lag jayega.)'
    : 'App par PIN lagayein — sirf aap aur Abu (jinke paas PIN ho) khol sakein.';
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
$('#btnRemoveLogo').addEventListener('click', () => { Store.setShop({ logo: '', logoSmall: '' }); $('#logoPreview').src = 'assets/logo.png'; applyBranding(); toast('Default logo laga diya'); });

function genSyncId() {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)];
  return 'altariq-' + s;
}
// Jaise hi Cloud Sync ON karo, agar Sync ID khaali hai to khud ban jaye.
$('#setCloudEnabled').addEventListener('change', () => {
  if ($('#setCloudEnabled').checked && !$('#setCloudSyncId').value.trim()) {
    $('#setCloudSyncId').value = genSyncId();
    $('#cloudStatus').textContent = '🔑 Sync ID ban gayi. Ye ID Abu ke phone par bhi wahi daalein. Ab Test → Save.';
  }
});

$('#saveSettings').addEventListener('click', async () => {
  // Sync on hai magar ID khaali → khud bana do (taake kabhi blank na rahe)
  if ($('#setCloudEnabled').checked && !$('#setCloudSyncId').value.trim()) {
    $('#setCloudSyncId').value = genSyncId();
  }
  const cloud = {
    enabled: $('#setCloudEnabled').checked,
    config: $('#setCloudConfig').value.trim(),
    syncId: $('#setCloudSyncId').value.trim()
  };
  Store.setShop({
    name: $('#setShopName').value.trim() || 'Al Tariq Printers',
    phone: $('#setShopPhone').value.trim(),
    viewerBase: $('#setViewerBase').value.trim(),
    bizLink: $('#setBizLink').value.trim(),
    paymentInfo: $('#setPaymentInfo').value.trim(),
    autoWhatsApp: $('#setAutoWa').checked,
    waEndpoint: $('#setWaEndpoint').value.trim(),
    cloud
  });
  applyBranding(); toast('Settings save ho gayi ✅');
  const r = Cloud.isReady() ? { ok: true } : await Cloud.init(onCloudRemote);
  if (cloud.enabled && cloud.syncId) {
    if (r && r.ok) $('#cloudStatus').textContent = '☁️ Sync ON ✅  Aapki Sync ID: ' + cloud.syncId + '  — yehi ID Abu ke phone par daalein.';
    else $('#cloudStatus').textContent = 'Cloud connect fail: ' + ((r && r.error) || '');
  } else if (r && r.ok) {
    $('#cloudStatus').textContent = '☁️ Cloud connect ho gaya ✅';
  }
});
$('#btnCloudTest').addEventListener('click', async () => {
  $('#cloudStatus').textContent = 'Test ho raha hai...';
  const r = await Cloud.testConnect($('#setCloudConfig').value.trim(), $('#setCloudSyncId').value.trim());
  $('#cloudStatus').textContent = r.ok ? '✅ Connection theek hai. Ab Save karein.' : ('❌ Fail: ' + (r.error || ''));
});
$('#btnSetPin').addEventListener('click', () => showLock('set1'));
$('#btnRemovePin').addEventListener('click', () => {
  if (!Store.getShop().pinHash) { toast('Koi PIN set nahi hai'); return; }
  const p = prompt('Tasdeeq ke liye mojooda PIN daalein:');
  if (p == null) return;
  if (hashPin(p.trim()) === Store.getShop().pinHash) { Store.setShop({ pinHash: '' }); toast('🔓 App Lock hata diya'); loadSettings(); }
  else toast('Ghalat PIN');
});
function onCloudRemote() {
  // remote data adopted — refresh whatever is on screen
  if (activeNav === 'overview') renderOverview();
  else if (activeNav === 'accounts') renderAccounts();
  else if (activeNav === 'rates') renderRates();
  if (currentCustId && !$('#detailView').classList.contains('hidden')) renderDetail();
  maybeLock(); // agar doosre device se PIN aaya to lock laga do
  toast('☁️ Doosre device se data update hua');
}

/* ---------- App Lock (PIN) — sirf owner + Abu khol sakein ---------- */
function hashPin(p) { let h = 5381; for (let i = 0; i < p.length; i++) h = ((h << 5) + h + p.charCodeAt(i)) >>> 0; return 'p' + h.toString(36); }
let lockEntry = '', lockMode = 'unlock', lockSet1 = '';
function renderLockDots() { const n = lockEntry.length; $('#lockDots').innerHTML = [0, 1, 2, 3].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); }
function buildLockPad() {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  $('#lockPad').innerHTML = keys.map(k => k ? `<button data-k="${k}">${k}</button>` : '<span class="lk-empty"></span>').join('');
  $$('#lockPad button').forEach(b => b.addEventListener('click', () => lockKey(b.dataset.k)));
}
function lockKey(k) {
  if (k === '⌫') { lockEntry = lockEntry.slice(0, -1); renderLockDots(); return; }
  if (lockEntry.length >= 4) return;
  lockEntry += k; renderLockDots();
  if (lockEntry.length === 4) setTimeout(lockSubmit, 130);
}
function lockSubmit() {
  const pin = lockEntry; lockEntry = '';
  if (lockMode === 'unlock') {
    if (hashPin(pin) === Store.getShop().pinHash) { sessionStorage.setItem('altariq_unlocked', '1'); $('#lockScreen').classList.add('hidden'); }
    else { $('#lockSub').innerHTML = '<span class="lock-err">Ghalat PIN — dobara koshish karein</span>'; renderLockDots(); }
  } else if (lockMode === 'set1') {
    lockSet1 = pin; lockMode = 'set2'; $('#lockSub').textContent = 'Tasdeeq ke liye PIN dobara daalein'; renderLockDots();
  } else if (lockMode === 'set2') {
    if (pin === lockSet1) { Store.setShop({ pinHash: hashPin(pin) }); sessionStorage.setItem('altariq_unlocked', '1'); $('#lockScreen').classList.add('hidden'); toast('🔒 App Lock ON — ab PIN ke bagair nahi khulega'); }
    else { lockMode = 'set1'; lockSet1 = ''; $('#lockSub').innerHTML = '<span class="lock-err">PIN match nahi — naya PIN set karein</span>'; renderLockDots(); }
  }
}
function showLock(mode) {
  buildLockPad(); lockMode = mode; lockEntry = ''; lockSet1 = '';
  $('#lockSub').textContent = mode === 'unlock' ? 'PIN daalein' : 'Naya 4-digit PIN set karein';
  renderLockDots(); $('#lockScreen').classList.remove('hidden');
}
function maybeLock() {
  if (Store.getShop().pinHash && sessionStorage.getItem('altariq_unlocked') !== '1') showLock('unlock');
}

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
$('#btnRepublish') && $('#btnRepublish').addEventListener('click', republishAllShared);
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
  try { await Store.recoverShareIds(); } catch (e) {} // purane bheje link tokens wapis
  maybeLock(); // PIN lock (agar set hai) — sab se pehle
  const s = Store.getShop();
  if (!s.viewerBase && location.protocol.startsWith('http')) {
    Store.setShop({ viewerBase: location.origin + location.pathname.replace(/\/[^\/]*\.html.*$/, "").replace(/\/$/, '') });
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  applyBranding();
  nav('overview');
  // backup status bar — auto cloud backup ka haal + retry
  if (Cloud.onStatus) Cloud.onStatus(renderBackupBar);
  const bb = document.getElementById('backupBar');
  if (bb) bb.addEventListener('click', () => {
    const st = Cloud.getStatus ? Cloud.getStatus().state : '';
    if (st === 'offline' || st === 'error') { renderBackupBar('saving'); Cloud.retry && Cloud.retry(); flushShares(); }
  });
  // start cloud sync if configured (non-blocking)
  Cloud.init(onCloudRemote).then(r => {
    if (r && r.ok) { renderOverview(); if (Cloud.getStatus) renderBackupBar(Cloud.getStatus().state); }
    maybeRunImport();
  }).catch(() => { maybeRunImport(); });
})();

/* Backup status bar render (sync on hone par hi dikhta hai) */
let bkHideT = null;
function renderBackupBar(st) {
  const bar = document.getElementById('backupBar'); if (!bar) return;
  if (!(Cloud.isSyncOn && Cloud.isSyncOn())) { bar.className = 'backup-bar hidden'; return; }
  clearTimeout(bkHideT);
  if (st === 'saving') { bar.className = 'backup-bar saving'; bar.innerHTML = '<span class="spin">↻</span> Backup ho raha hai…'; }
  else if (st === 'pending') { bar.className = 'backup-bar pending'; bar.innerHTML = '⏳ Backup baqi hai…'; }
  else if (st === 'saved') { bar.className = 'backup-bar saved'; bar.innerHTML = '☁️ Backup save ho gaya ✓'; flushShares(); bkHideT = setTimeout(() => bar.classList.add('hidden'), 2300); }
  else if (st === 'offline' || st === 'error') { bar.className = 'backup-bar warn'; bar.innerHTML = '⚠️ Backup nahi hua — <b>tap karke dobara karein</b>'; }
  else { bar.className = 'backup-bar hidden'; }
}

/* Ek-baar final Udhaar data import: app.html?import=altariq-final
   Sirf yeh nayi (v19+) build me maujood hai, is liye purana app clean doc ko
   overwrite nahi kar sakta. Marker se do baara chalne par bhi double nahi hota. */
const IMPORT_MARKER = 'final-udhaar-desc-v3-2026-07-22'; // clean re-import (descriptions + links fix)
async function maybeRunImport() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('import') !== 'altariq-final') return;
    if (localStorage.getItem('altariq_import_done') === IMPORT_MARKER) {
      cleanImportUrl(); toast('Data pehle hi import ho chuka hai ✓'); return;
    }
    if (!Cloud.isSyncOn || !Cloud.isSyncOn()) {
      alert('Import ke liye pehle Sync ID set hona zaroori hai (Settings me). Sync on karke dobara try karain.');
      return;
    }
    if (!confirm('Udhaar data (DESCRIPTIONS ke sath) import karain?\n\n173 customers + 52,564 entries — ab har entry ki detail bhi.\nPurana data saaf kar ke naya laga dega (dono phones par).\n\nJari rakhain?')) return;
    toast('Import ho raha hai… (thora intezar)');
    const res = await fetch('data/altariq-final.txt?v=' + IMPORT_MARKER + '&t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('file');
    const b64 = (await res.text()).trim();
    const out = await Cloud.importFromGz(b64, IMPORT_MARKER + '-' + Date.now());
    localStorage.setItem('altariq_import_done', IMPORT_MARKER);
    cleanImportUrl();
    renderOverview();
    // pehle bheje gaye shared links ki PDF ko naye data se update kar do (globally)
    const shared = [...Store.getCustomers(), ...Store.getSuppliers()].filter(c => c.shareId);
    let done = 0;
    for (const c of shared) { Store.recordShareToken(c.name, c.shareId); try { await Cloud.publishShare(c.shareId, sharePayload(c)); done++; } catch (e) {} }
    alert('Import mukammal ✓\n\nCustomers: ' + out.customers + '\nEntries: ' + out.txns +
      (shared.length ? '\nShared links update: ' + done + '/' + shared.length : '') +
      '\n\nAbu ke phone par bhi khud-ba-khud aa jayega.');
  } catch (e) {
    alert('Import me masla: ' + (e && e.message ? e.message : e) + '\nDobara try karain.');
  }
}
function cleanImportUrl() {
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
}
