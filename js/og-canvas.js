/* Oghi Garri report JPG (canvas) — app.html aur oghi-report.html dono isi se banate hain */
function ogFmt(n) { return 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-PK'); }
function ogRoundRect(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
function ogFit(x, s, maxW) { s = s + ''; if (x.measureText(s).width <= maxW) return s; while (s.length > 1 && x.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s + '…'; }
function ogGlass(x, X, Y, W, H, fill, glow, r) { r = r || 15; x.save(); x.shadowColor = glow; x.shadowBlur = 18; x.shadowOffsetY = 5; x.fillStyle = fill; ogRoundRect(x, X, Y, W, H, r); x.fill(); x.restore(); x.save(); ogRoundRect(x, X, Y, W, H, r); x.clip(); const hl = x.createLinearGradient(0, Y, 0, Y + H); hl.addColorStop(0, 'rgba(255,255,255,.55)'); hl.addColorStop(.45, 'rgba(255,255,255,0)'); x.fillStyle = hl; x.fillRect(X, Y, W, H); x.restore(); }
// Share JPG: reference-app jaisa — green glowing header + wasooli/paid + 2-col
// glowing cards (paid green ✓ Rs X, pending amber). Har customer ki status saaf.
function ogBuildCanvas(monthLabel, rows, totals) {
  const W = 760, pad = 30, gap = 16, cardW = (W - pad * 2 - gap) / 2, cardH = 70, cgap = 13;
  const n = rows.length, gRows = Math.ceil(Math.max(n, 1) / 2);
  const headH = 124, wy = 138, wh = 80, statY = 240, listHeadY = 282, gridTop = 300, footH = 66;
  const H = gridTop + gRows * (cardH + cgap) + footH;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#f6f1e8'); bg.addColorStop(1, '#efe7d8'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const hg = x.createLinearGradient(0, 0, 0, headH); hg.addColorStop(0, '#2b3039'); hg.addColorStop(1, '#20242b'); x.fillStyle = hg; x.fillRect(0, 0, W, headH);
  x.fillStyle = 'rgba(231,162,76,.95)'; x.fillRect(0, headH - 5, W, 5);
  x.textBaseline = 'alphabetic';
  x.fillStyle = '#fff'; x.font = '900 34px system-ui,Segoe UI,Arial'; x.fillText('Oghi Garri', pad, 54);
  x.fillStyle = '#f0c98a'; x.font = '800 20px system-ui,Arial'; x.fillText(monthLabel, pad, 86);
  x.fillStyle = '#c9bfae'; x.font = '700 15px system-ui,Arial'; x.textAlign = 'right'; x.fillText('Al Tariq Printers', W - pad, 48); x.fillText('Driver Payment', W - pad, 70); x.textAlign = 'left';
  // wasooli card + paid badge
  ogGlass(x, pad, wy, W - pad * 2, wh, '#ffffff', 'rgba(201,133,31,.22)', 18);
  x.fillStyle = '#7c7264'; x.font = '700 13px system-ui,Arial'; x.fillText('Is mahinay ki wasooli', pad + 20, wy + 30);
  x.fillStyle = '#0f7a52'; x.font = '900 32px system-ui,Arial'; x.fillText(ogFmt(totals.jama), pad + 20, wy + 66);
  const paidN = rows.filter(r => r.paid).length;
  const bw = 160, bx = W - pad - bw - 6, by = wy + wh / 2 - 24;
  x.save(); x.shadowColor = 'rgba(231,162,76,.5)'; x.shadowBlur = 18; const pg = x.createLinearGradient(bx, by, bx, by + 48); pg.addColorStop(0, '#f0b866'); pg.addColorStop(0.6, '#e7a24c'); pg.addColorStop(1, '#c9851f'); x.fillStyle = pg; ogRoundRect(x, bx, by, bw, 48, 24); x.fill(); x.restore();
  x.fillStyle = '#3a2606'; x.font = '900 20px system-ui,Arial'; x.textAlign = 'center'; x.fillText(paidN + ' / ' + n + ' paid', bx + bw / 2, by + 31); x.textAlign = 'left';
  // stat chips
  const chips = [['Pending', ogFmt(totals.pend), '#d84b45'], ['Driver diya', ogFmt(totals.driver), '#c9851f'], ['Bacha', (totals.jama - totals.driver < 0 ? '−' : '') + ogFmt(Math.abs(totals.jama - totals.driver)), '#2b2620']];
  const cw = (W - pad * 2 - 2 * 10) / 3;
  chips.forEach((c, i) => { const cx = pad + i * (cw + 10); ogGlass(x, cx, statY - 18, cw, 46, 'rgba(255,255,255,.92)', 'rgba(201,133,31,.14)', 12); x.fillStyle = '#7c7264'; x.font = '700 11px system-ui,Arial'; x.textAlign = 'center'; x.fillText(c[0], cx + cw / 2, statY - 1); x.fillStyle = c[2]; x.font = '900 15px system-ui,Arial'; x.fillText(ogFit(x, c[1], cw - 10), cx + cw / 2, statY + 19); x.textAlign = 'left'; });
  x.fillStyle = '#5a4a2e'; x.font = '800 14px system-ui,Arial'; x.fillText('CUSTOMERS — PAYMENT STATUS', pad, listHeadY);
  if (!n) { x.fillStyle = '#7c7264'; x.font = '700 16px system-ui,Arial'; x.textAlign = 'center'; x.fillText('Koi customer nahi', W / 2, gridTop + 30); x.textAlign = 'left'; }
  rows.forEach((r, i) => { const col = i % 2, row = (i - col) / 2, X = pad + col * (cardW + gap), Y = gridTop + row * (cardH + cgap);
    ogGlass(x, X, Y, cardW, cardH, r.paid ? '#f0faf4' : '#ffffff', r.paid ? 'rgba(16,150,90,.20)' : 'rgba(201,133,31,.16)', 15);
    x.save(); ogRoundRect(x, X, Y, cardW, cardH, 15); x.clip(); x.fillStyle = r.paid ? '#10b981' : '#e7a24c'; x.fillRect(X, Y, 7, cardH); x.restore();
    x.strokeStyle = r.paid ? 'rgba(16,150,90,.35)' : 'rgba(231,162,76,.4)'; x.lineWidth = 1.2; ogRoundRect(x, X, Y, cardW, cardH, 15); x.stroke();
    x.fillStyle = '#2b2620'; x.font = '800 17px system-ui,Arial'; x.fillText(ogFit(x, r.name, cardW - 30), X + 18, Y + 30);
    if (r.paid) { x.fillStyle = '#0c8a52'; x.font = '900 17px system-ui,Arial'; x.fillText('✓ ' + ogFmt(r.amount), X + 18, Y + 55); }
    else { x.fillStyle = '#c9851f'; x.font = '800 16px system-ui,Arial'; x.fillText('Pending', X + 18, Y + 55); }
  });
  const fy = H - footH + 36;
  x.fillStyle = '#7c7264'; x.font = '700 13px system-ui,Arial'; x.fillText(n + ' customers  ·  ' + paidN + ' aayi  ·  ' + (n - paidN) + ' pending', pad, fy);
  x.textAlign = 'right'; x.fillText(new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }), W - pad, fy); x.textAlign = 'left';
  return cv;
}
function ogBuildPending(rangeLabel, rows, grand) {
  const W = 760, pad = 30, gap = 16, cardW = (W - pad * 2 - gap) / 2, cardH = 62, cgap = 11;
  const n = rows.length, gRows = Math.ceil(Math.max(n, 1) / 2);
  const headH = 128, ty = 144, th = 86, listHeadY = 262, gridTop = 280, footH = 62;
  const H = gridTop + gRows * (cardH + cgap) + footH;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#f6f1e8'); bg.addColorStop(1, '#efe7d8'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const hg = x.createLinearGradient(0, 0, 0, headH); hg.addColorStop(0, '#2b3039'); hg.addColorStop(1, '#20242b'); x.fillStyle = hg; x.fillRect(0, 0, W, headH);
  x.fillStyle = 'rgba(231,162,76,.95)'; x.fillRect(0, headH - 5, W, 5);
  x.textBaseline = 'alphabetic';
  x.fillStyle = '#fff'; x.font = '900 32px system-ui,Segoe UI,Arial'; x.fillText('Oghi Garri', pad, 50);
  x.fillStyle = '#e7a24c'; x.font = '900 15px system-ui,Arial'; x.fillText('PENDING REPORT', pad, 78);
  x.fillStyle = '#f0c98a'; x.font = '800 18px system-ui,Arial'; x.fillText(rangeLabel, pad, 106);
  x.fillStyle = '#c9bfae'; x.font = '700 15px system-ui,Arial'; x.textAlign = 'right'; x.fillText('Al Tariq Printers', W - pad, 50); x.fillText('Driver Payment', W - pad, 72); x.textAlign = 'left';
  ogGlass(x, pad, ty, W - pad * 2, th, '#fff6ef', 'rgba(216,75,69,.22)', 18);
  x.save(); ogRoundRect(x, pad, ty, W - pad * 2, th, 18); x.clip(); x.fillStyle = '#d84b45'; x.fillRect(pad, ty, 8, th); x.restore();
  x.fillStyle = '#7c7264'; x.font = '700 13px system-ui,Arial'; x.fillText('Total Pending (sab customers)', pad + 26, ty + 34);
  x.fillStyle = '#c1362f'; x.font = '900 38px system-ui,Arial'; x.fillText(ogFmt(grand), pad + 26, ty + 74);
  x.fillStyle = '#7c7264'; x.font = '800 14px system-ui,Arial'; x.textAlign = 'right'; x.fillText(n + ' customers', W - pad - 22, ty + th / 2 + 6); x.textAlign = 'left';
  x.fillStyle = '#5a4a2e'; x.font = '800 14px system-ui,Arial'; x.fillText('HAR CUSTOMER KA PENDING', pad, listHeadY);
  rows.forEach((r, i) => { const col = i % 2, row = (i - col) / 2, X = pad + col * (cardW + gap), Y = gridTop + row * (cardH + cgap);
    const clear = r.pending <= 0;
    ogGlass(x, X, Y, cardW, cardH, clear ? '#f0faf4' : '#fff6ef', clear ? 'rgba(16,150,90,.18)' : 'rgba(216,75,69,.16)', 14);
    x.save(); ogRoundRect(x, X, Y, cardW, cardH, 14); x.clip(); x.fillStyle = clear ? '#10b981' : '#d84b45'; x.fillRect(X, Y, 7, cardH); x.restore();
    x.fillStyle = '#2b2620'; x.font = '800 16px system-ui,Arial'; x.fillText(ogFit(x, r.name, cardW - 30), X + 18, Y + 27);
    if (clear) { x.fillStyle = '#0c8a52'; x.font = '900 15px system-ui,Arial'; x.fillText('✓ Clear', X + 18, Y + 50); }
    else { x.fillStyle = '#c1362f'; x.font = '900 16px system-ui,Arial'; const at = ogFmt(r.pending); x.fillText(at, X + 18, Y + 50); if (r.paid > 0) { const aw = x.measureText(at).width; x.fillStyle = '#9a7b4a'; x.font = '700 12px system-ui,Arial'; x.fillText(' · diya ' + ogFmt(r.paid), X + 18 + aw + 4, Y + 50); } }
  });
  const fy = H - footH + 34;
  x.fillStyle = '#7c7264'; x.font = '700 13px system-ui,Arial'; x.fillText('Total pending: ' + ogFmt(grand), pad, fy);
  x.textAlign = 'right'; x.fillText(new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }), W - pad, fy); x.textAlign = 'left';
  return cv;
}
