/* =========================================================
   BEHEER > FACTUREN (de Super Admin, en beheerders aan wie hij toegang gaf)
   Alle facturen die het systeem zelf maakt bij een betaling (QR-Codex én Flexichat, zelfde Stripe-account),
   en de facturas rectificativas bij een terugbetaling. Inzien, zoeken, selecteren en downloaden (pdf of zip),
   en de lijst voor de boekhouder (csv). Niet bewerken: een verstuurde factuur mag in Spanje niet meer veranderd worden.
   Server: /api/admin/invoices (billing/invoices-admin.controller.ts).
   ========================================================= */
var AdminInvoices = (function () {
  var box = document.getElementById('adminInvoicesPage');
  if (!box) return {};
  var me = null, can = { view: false, manage: false }, access = null, accessErr = '', res = null, err = false, seq = 0, q = '', year = new Date().getFullYear(), sel = {}, busy = false;
  var IC = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    csv: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'
  };
  function ico(k, cls) { return '<svg class="' + (cls || 'ad-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>'; }
  function attr(s) { return esc(String(s == null ? '' : s)); }
  function money(n, cur) { try { return new Intl.NumberFormat(i18n.lang(), { style: 'currency', currency: cur || 'EUR' }).format(n || 0); } catch (e) { return (n || 0).toFixed(2) + ' ' + (cur || 'EUR'); } }
  function day(iso) { try { return new Date(iso).toLocaleDateString(i18n.lang(), { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' }); } catch (e) { return String(iso || '').slice(0, 10); } }
  function years() { var out = [], now = new Date().getFullYear(); for (var y = now; y >= 2026; y--) out.push(y); return out; }
  function pdfUrl(n) { return 'api/admin/invoices/' + encodeURIComponent(n) + '/pdf'; }
  function shown() { return res ? res.items.filter(match) : []; }
  function count() { return Object.keys(sel).length; }

  function load() {
    var my = ++seq; err = false;
    fetch('api/admin/invoices?year=' + year, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { if (my === seq) { res = d; drawList(); } })
      .catch(function () { if (my === seq) { err = true; drawList(); } });
  }
  function draw() {
    if (!me || !can.view) return;
    box.innerHTML =
      '<header class="help-head ad-head"><div><h2>' + t('inv.title') + '</h2><p>' + t('inv.lead') + '</p></div>' +
        '<div class="ad-head-acts"><a class="btn ghost" id="aiCsv" href="api/admin/invoices/export.csv?year=' + year + '" download>' + ico('csv') + t('inv.export') + '</a></div></header>' +
      '<div class="glass ad-card ad-tools ai-tools">' +
        '<label class="ad-search">' + ico('search') + '<span class="sr-only">' + t('inv.search') + '</span><input type="search" id="aiQ" value="' + attr(q) + '" placeholder="' + attr(t('inv.search')) + '" autocomplete="off"></label>' +
        '<label class="ad-sel"><span class="sr-only">' + t('inv.year') + '</span><select id="aiYear">' + years().map(function (y) { return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></label>' +
        '<button type="button" class="btn" id="aiDl" disabled>' + ico('dl') + '<span></span></button>' +
      '</div>' +
      '<div id="aiList"></div>' +
      '<p class="muted ai-note">' + t('inv.note') + '</p>' +
      (can.manage ? '<div id="aiAccess"></div>' : '');
    drawList(); drawAccess();
  }
  function match(r) {
    if (!q) return true;
    var s = q.toLowerCase();
    return [r.number, r.buyer, r.email, r.taxId, r.product, r.rectifies].some(function (v) { return String(v || '').toLowerCase().indexOf(s) >= 0; });
  }
  function setDl() {
    var b = document.getElementById('aiDl'); if (!b) return;
    var n = count();
    b.disabled = busy || !n;
    b.querySelector('span').textContent = busy ? t('inv.downloading') : n ? t('inv.downloadSel', { n: n }) : t('inv.selectFirst');
  }
  function drawList() {
    var el = document.getElementById('aiList'); if (!el) return;
    if (err) { el.innerHTML = '<div class="glass ad-card ad-none"><p>' + t('inv.loadError') + '</p><button type="button" class="btn ghost" data-ai-retry>' + ico('refresh') + t('inv.retry') + '</button></div>'; setDl(); return; }
    if (!res) { el.innerHTML = '<div class="glass ai-table">' + [1, 2, 3].map(function () { return '<div class="ai-row ad-skel"></div>'; }).join('') + '</div>'; setDl(); return; }
    var rows = shown();
    var test = res.test ? '<p class="ai-test">' + t('inv.testMode') + '</p>' : '';
    if (!rows.length) { el.innerHTML = test + '<div class="glass ad-card ad-none">' + ico('doc', 'ad-none-ic') + '<p>' + (res.items.length ? t('inv.noMatch') : t('inv.none', { year: year })) + '</p></div>'; setDl(); return; }
    var all = rows.every(function (r) { return sel[r.number]; });
    var sum = rows.reduce(function (a, r) { a.net += r.net; a.tax += r.tax; a.total += r.total; return a; }, { net: 0, tax: 0, total: 0 });
    el.innerHTML = test + '<div class="glass ai-table" role="table" aria-label="' + attr(t('inv.title')) + '">' +
      '<div class="ai-row ai-head" role="row"><span role="columnheader"><input type="checkbox" data-ai-all' + (all ? ' checked' : '') + ' aria-label="' + attr(t('inv.selectAll')) + '"></span>' +
        '<span role="columnheader">' + t('inv.colNumber') + '</span><span role="columnheader">' + t('inv.colDate') + '</span><span role="columnheader">' + t('inv.colCustomer') + '</span>' +
        '<span role="columnheader">' + t('inv.colProduct') + '</span><span class="ai-num" role="columnheader">' + t('inv.colNet') + '</span><span class="ai-num" role="columnheader">' + t('inv.colVat') + '</span>' +
        '<span class="ai-num" role="columnheader">' + t('inv.colTotal') + '</span><span role="columnheader"><span class="sr-only">PDF</span></span></div>' +
      rows.map(function (r) {
        var credit = r.kind === 'credit';
        return '<div class="ai-row' + (credit ? ' ai-credit' : '') + (sel[r.number] ? ' on' : '') + '" role="row">' +
          '<span role="cell"><input type="checkbox" data-ai-sel="' + attr(r.number) + '"' + (sel[r.number] ? ' checked' : '') + ' aria-label="' + attr(t('inv.select', { n: r.number })) + '"></span>' +
          '<span role="cell" class="ai-nr"><b>' + esc(r.number) + '</b><small>' + (credit ? t('inv.credit', { n: esc(r.rectifies || '') }) : t('inv.series_' + r.series)) + '</small></span>' +
          '<span role="cell">' + day(r.date) + '</span>' +
          '<span role="cell" class="ai-cust"><b>' + esc(r.buyer || '-') + '</b><small>' + esc([r.taxId, r.country, r.email].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span role="cell">' + esc(r.product || '-') + '</span>' +
          '<span role="cell" class="ai-num">' + money(r.net, r.currency) + '</span>' +
          '<span role="cell" class="ai-num">' + money(r.tax, r.currency) + '</span>' +
          '<span role="cell" class="ai-num"><b>' + money(r.total, r.currency) + '</b></span>' +
          '<span role="cell" class="ai-act"><a class="btn ghost" href="' + pdfUrl(r.number) + '" target="_blank" rel="noopener">' + ico('doc') + 'PDF</a></span></div>';
      }).join('') +
      '<div class="ai-row ai-sum" role="row"><span></span><span role="cell"><b>' + t('inv.count', { n: rows.length }) + '</b></span><span></span><span></span><span></span>' +
        '<span role="cell" class="ai-num">' + money(sum.net) + '</span><span role="cell" class="ai-num">' + money(sum.tax) + '</span><span role="cell" class="ai-num"><b>' + money(sum.total) + '</b></span><span></span></div>' +
      '</div>';
    setDl();
  }
  /* Toegang (alleen de Super Admin): welke beheerders de facturen ook mogen zien */
  function drawAccess() {
    var el = document.getElementById('aiAccess'); if (!el) return;
    var list = access || [];
    el.innerHTML = '<section class="glass ad-card ai-access"><h3>' + t('inv.accessTitle') + '</h3><p class="muted">' + t('inv.accessLead') + '</p>' +
      (access == null ? '<p class="muted">…</p>' : list.length ? '<ul class="ai-acc-list">' + list.map(function (e) { return '<li><span>' + esc(e) + '</span><button type="button" class="link-btn" data-ai-rm="' + attr(e) + '">' + t('inv.accessRemove') + '</button></li>'; }).join('') + '</ul>' : '<p class="muted">' + t('inv.accessNone') + '</p>') +
      '<form class="ai-acc-add" data-ai-add><label class="sr-only" for="aiAccEmail">' + t('inv.accessEmail') + '</label><input type="email" id="aiAccEmail" placeholder="' + attr(t('inv.accessEmail')) + '" autocomplete="off" required>' +
      '<button type="submit" class="btn ghost">' + t('inv.accessAdd') + '</button></form>' +
      (accessErr ? '<p class="ai-acc-err" role="alert">' + esc(accessErr) + '</p>' : '') + '</section>';
  }
  function saveAccess(list) {
    accessErr = '';
    return fetch('api/admin/invoices/access', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails: list }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw j; access = j.emails || []; }); })
      .catch(function (j) { accessErr = j && j.error === 'not_admin' ? t('inv.accessNotAdmin', { e: (j.details || []).join(', ') }) : t('inv.loadError'); })
      .then(drawAccess);
  }
  function loadAccess() {
    if (!can.manage) return;
    fetch('api/admin/invoices/access', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : { emails: [] }; }).then(function (j) { access = j.emails || []; drawAccess(); }).catch(function () { access = []; drawAccess(); });
  }

  /* Geselecteerde facturen downloaden: één = de pdf, meer = een zip met de pdf's */
  function downloadSel() {
    var nums = Object.keys(sel); if (!nums.length || busy) return;
    busy = true; setDl();
    Promise.all(nums.map(function (n) { return fetch(pdfUrl(n), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function (b) { return { blob: b, name: 'Factura-' + n + '.pdf' }; }); }))
      .then(function (files) { return files.length === 1 ? files[0] : CodeUtil.zip(files).then(function (z) { return { blob: z, name: 'facturas-' + year + '.zip' }; }); })
      .then(function (f) { var a = document.createElement('a'); a.href = URL.createObjectURL(f.blob); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); })
      .catch(function () { if (window.toast) toast(t('inv.loadError')); })
      .then(function () { busy = false; setDl(); });
  }
  box.addEventListener('input', function (e) { if (e.target.id === 'aiQ') { q = e.target.value.trim(); drawList(); } });
  box.addEventListener('change', function (e) {
    if (e.target.id === 'aiYear') { year = Number(e.target.value) || year; res = null; sel = {}; var a = document.getElementById('aiCsv'); if (a) a.href = 'api/admin/invoices/export.csv?year=' + year; drawList(); load(); return; }
    if (e.target.hasAttribute('data-ai-all')) { shown().forEach(function (r) { if (e.target.checked) sel[r.number] = 1; else delete sel[r.number]; }); drawList(); return; }
    var n = e.target.getAttribute('data-ai-sel'); if (n) { if (e.target.checked) sel[n] = 1; else delete sel[n]; drawList(); }
  });
  box.addEventListener('click', function (e) {
    if (e.target.closest('[data-ai-retry]')) { res = null; drawList(); load(); }
    if (e.target.closest('#aiDl')) downloadSel();
    var rm = e.target.closest('[data-ai-rm]'); if (rm) saveAccess((access || []).filter(function (x) { return x !== rm.getAttribute('data-ai-rm'); }));
  });
  box.addEventListener('submit', function (e) {
    if (!e.target.hasAttribute('data-ai-add')) return;
    e.preventDefault();
    var v = (document.getElementById('aiAccEmail').value || '').trim().toLowerCase(); if (!v) return;
    saveAccess((access || []).filter(function (x) { return x !== v; }).concat([v]));
  });

  // Menu-item alleen voor wie de facturen mag zien: de Super Admin en beheerders met toegang (de server controleert het ook)
  Session.onUser(function (u) {
    me = u; can = { view: false, manage: false }; access = null; res = null; sel = {};
    var nav = document.getElementById('navInvoices'); if (nav) nav.hidden = true;
    if (!u || !u.admin) return;
    fetch('api/admin/invoices/can', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
      can = { view: !!j.view, manage: !!j.manage }; if (nav) nav.hidden = !can.view;
      if (!box.closest('[hidden]')) { draw(); load(); loadAccess(); }
    }).catch(function () {});
  });
  document.addEventListener('pagechange', function (e) { if (e.detail === 'adminInvoices') { draw(); load(); loadAccess(); } });
  i18n.onChange(function () { if (!box.closest('[hidden]')) draw(); });
  return {};
})();
