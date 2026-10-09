/* =========================================================
   STATISTIEKEN
   - Filters: periode, QR-codes, systeem, land, stad (alles in één rij)
   - Drie tegels: QR-codes, scans, unieke scans
   - Lijngrafiek scans + unieke scans per dag (met tooltip)
   - Verdeling per systeem, land, stad en QR-code (liggende balken: makkelijk te lezen)
   - Exporteren als CSV (Excel)
   Gegevens: api.analytics() → server (/api/analytics) of, in de online demo, voorbeeldcijfers.
   ========================================================= */
var Analytics = (function () {
  var view = document.getElementById('analyticsView'), body = document.getElementById('anBody'), bar = document.getElementById('anFilters');
  var PERIODS = ['today', 'yesterday', '7', '30', '90', 'all', 'custom'];
  var f = { period: '30', from: '', to: '', codes: [], os: [], cc: [], city: [] };
  var data = null, names = {}, openDrop = null, expanded = {}, seq = 0;
  var IC = {
    codes: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><path d="M14 14h2v2h-2zM18 18h2v2h-2z"/>',
    scans: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    unique: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', chev: '<path d="M6 9l6 6 6-6"/>'
  };
  function ico(k, cls) { return '<svg class="' + (cls || 'an-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>'; }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function range() {
    var now = new Date(), day = 864e5;
    switch (f.period) {
      case 'today': return { from: iso(now), to: iso(now) };
      case 'yesterday': return { from: iso(new Date(now - day)), to: iso(new Date(now - day)) };
      case '7': case '30': case '90': return { from: iso(new Date(now - (+f.period - 1) * day)), to: iso(now) };
      case 'custom': return { from: f.from || iso(new Date(now - 29 * day)), to: f.to || iso(now) };
      default: return { from: '', to: '' };                                 // alles
    }
  }
  function query() { var r = range(); return { from: r.from, to: r.to, codes: f.codes, os: f.os, cc: f.cc, city: f.city }; }

  /* ---------- Namen en labels ---------- */
  function osName(k) { return k === 'other' ? t('an.other') : k; }
  function ccName(k) { return k ? TEL.flag(k) + ' ' + TEL.name(k) : t('an.unknown'); }
  function cityName(k) { var p = k.split('|'); return p[1] ? p[1] + (p[0] ? ' (' + p[0] + ')' : '') : t('an.unknown'); }
  function codeName(id) { var c = names[id]; return c ? c.label : id; }
  function label(dim, k) { return dim === 'os' ? osName(k) : dim === 'cc' ? ccName(k) : dim === 'city' ? cityName(k) : codeName(k); }
  function d(s) { return new Date(s + 'T12:00:00'); }

  /* ---------- Filters ---------- */
  function multi(dim, title, options) {
    options = options.slice().sort(function (a, b) { return label(dim, a).replace(/^\S+\s/, dim === 'cc' ? '' : '$&').localeCompare(label(dim, b).replace(/^\S+\s/, dim === 'cc' ? '' : '$&'), i18n.lang()); });   // op naam (bij landen zonder de vlag)
    var sel = f[dim], txt = !sel.length ? t('an.all', { n: options.length }) : sel.length === 1 ? label(dim, sel[0]) : t('an.chosen', { n: sel.length });
    var open = openDrop === dim;
    return '<div class="an-f an-multi' + (open ? ' open' : '') + '" data-dim="' + dim + '"><span class="an-flbl">' + title + '</span>' +
      '<button type="button" class="an-sel" data-drop="' + dim + '" aria-expanded="' + open + '"' + (options.length ? '' : ' disabled') + '><span>' + esc(txt) + '</span>' + ico('chev', 'an-chev') + '</button>' +
      (open ? '<div class="an-drop" role="listbox" aria-multiselectable="true">' +
        '<label class="an-opt all"><input type="checkbox" data-all="' + dim + '"' + (!sel.length ? ' checked' : '') + '><span>' + t('an.everything') + '</span></label>' +
        options.map(function (k) { return '<label class="an-opt"><input type="checkbox" data-pick="' + dim + '" value="' + esc(k) + '"' + (sel.indexOf(k) >= 0 ? ' checked' : '') + '><span>' + esc(label(dim, k)) + '</span></label>'; }).join('') +
      '</div>' : '') + '</div>';
  }
  function drawFilters() {
    var o = (data && data.options) || { os: [], countries: [], cities: [] };
    var codeIds = Object.keys(names);
    var any = f.codes.length || f.os.length || f.cc.length || f.city.length;
    bar.innerHTML =
      '<label class="an-f"><span class="an-flbl">' + t('an.period') + '</span><select id="anPeriod">' + PERIODS.map(function (p) { return '<option value="' + p + '"' + (f.period === p ? ' selected' : '') + '>' + t('an.p_' + p) + '</option>'; }).join('') + '</select></label>' +
      (f.period === 'custom' ? '<label class="an-f"><span class="an-flbl">' + t('an.from') + '</span><input type="date" id="anFrom" value="' + range().from + '" max="' + iso(new Date()) + '"></label>' +
        '<label class="an-f"><span class="an-flbl">' + t('an.to') + '</span><input type="date" id="anTo" value="' + range().to + '" max="' + iso(new Date()) + '"></label>' : '') +
      multi('codes', t('an.codes'), codeIds) + multi('os', t('an.os'), o.os) + multi('cc', t('an.countries'), o.countries) + multi('city', t('an.cities'), o.cities) +
      (any ? '<button type="button" class="link-btn an-clear" data-clear>' + t('an.clear') + '</button>' : '');
  }

  /* ---------- Tegels ---------- */
  function tiles(tot) {
    var tile = function (k, n, txt, tip) {
      return '<div class="an-tile glass an-' + k + '"><span class="an-tic">' + ico(k) + '</span><span class="an-tl"><small>' + txt +
        (tip ? ' <button type="button" class="an-tip" aria-label="' + esc(tip) + '" data-tip="' + esc(tip) + '">' + ico('info', 'an-ii') + '</button>' : '') + '</small><b>' + i18n.fmt.num(n) + '</b></span></div>';
    };
    return '<div class="an-tiles">' + tile('codes', tot.codes, t('an.totalCodes')) + tile('scans', tot.scans, t('an.totalScans')) + tile('unique', tot.unique, t('an.totalUnique'), t('an.uniqueTip')) + '</div>';
  }

  /* ---------- Lijngrafiek ---------- */
  var chart = { pts: [], w: 0 };
  // Stap tussen de lijnen: 1, 2, 5, 10, 20, 50 … (altijd hele getallen), 4 tot 5 lijnen
  function step(max) { var raw = Math.max(1, max / 4), p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p); }
  function lineChart(series) {
    var box = body.querySelector('.an-plot'); if (!box) return;
    var W = Math.max(280, box.clientWidth), H = W < 520 ? 220 : 280, L = 40, R = 14, T = 12, B = 30, iw = W - L - R, ih = H - T - B;
    var top = Math.max.apply(null, series.map(function (p) { return p.s; }).concat([1])), st = step(top), max = Math.ceil(top / st) * st, n = series.length;
    var x = function (i) { return L + (n === 1 ? iw / 2 : i * iw / (n - 1)); }, y = function (v) { return T + ih - v / max * ih; };
    var ticks = []; for (var v = 0; v <= max + 1e-9; v += st) ticks.push(v);
    var every = Math.max(1, Math.ceil(n / (W < 520 ? 4 : 8)));
    var path = function (k) { return series.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[k]).toFixed(1); }).join(''); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(t('an.chartTitle')) + '">' +
      ticks.map(function (v) { return '<line class="an-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="an-ax" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + i18n.fmt.num(v) + '</text>'; }).join('') +
      series.map(function (p, i) { return i % every === 0 || i === n - 1 && (n - 1) % every > every / 2 ? '<text class="an-ax" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(i18n.fmt.date(d(p.d), 'dshort')) + '</text>' : ''; }).join('') +
      (n > 1 ? '<path class="an-area" d="' + path('s') + 'L' + x(n - 1) + ' ' + y(0) + 'L' + x(0) + ' ' + y(0) + 'Z"/>' +
        '<path class="an-line s1" d="' + path('s') + '"/><path class="an-line s2" d="' + path('u') + '"/>'
        : '<circle class="an-dot s1" cx="' + x(0) + '" cy="' + y(series[0].s) + '" r="5"/><circle class="an-dot s2" cx="' + x(0) + '" cy="' + y(series[0].u) + '" r="5"/>') +
      '<line class="an-cross" x1="0" x2="0" y1="' + T + '" y2="' + (T + ih) + '" hidden/><circle class="an-hl s1" r="5" hidden/><circle class="an-hl s2" r="5" hidden/>' +
      '<rect class="an-hit" x="' + L + '" y="' + T + '" width="' + iw + '" height="' + ih + '" fill="transparent"/></svg>' +
      '<div class="an-tt" hidden></div>';
    box.innerHTML = svg;
    chart = { series: series, x: x, y: y, L: L, iw: iw, n: n };
  }
  function hover(e) {
    var box = body.querySelector('.an-plot'); if (!box || !chart.series) return;
    var svg = box.querySelector('svg'), r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (svg.viewBox.baseVal.width / r.width);
    var i = chart.n === 1 ? 0 : Math.max(0, Math.min(chart.n - 1, Math.round((px - chart.L) / chart.iw * (chart.n - 1)))), p = chart.series[i], cx = chart.x(i);
    var cross = svg.querySelector('.an-cross'), h1 = svg.querySelector('.an-hl.s1'), h2 = svg.querySelector('.an-hl.s2'), tt = box.querySelector('.an-tt');
    cross.removeAttribute('hidden'); cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
    h1.removeAttribute('hidden'); h1.setAttribute('cx', cx); h1.setAttribute('cy', chart.y(p.s));
    h2.removeAttribute('hidden'); h2.setAttribute('cx', cx); h2.setAttribute('cy', chart.y(p.u));
    tt.hidden = false;
    tt.innerHTML = '<b>' + esc(i18n.fmt.date(d(p.d), 'long')) + '</b><span><i class="sw s1"></i>' + t('an.scans') + '<em>' + i18n.fmt.num(p.s) + '</em></span><span><i class="sw s2"></i>' + t('an.unique') + '<em>' + i18n.fmt.num(p.u) + '</em></span>';
    var left = cx / (svg.viewBox.baseVal.width) * r.width; tt.style.left = Math.min(Math.max(left, 80), r.width - 80) + 'px'; tt.style.top = Math.max(0, chart.y(p.s) / svg.viewBox.baseVal.height * r.height - 70) + 'px';
  }
  function unhover() { var box = body.querySelector('.an-plot'); if (!box) return; box.querySelectorAll('.an-cross,.an-hl').forEach(function (el) { el.setAttribute('hidden', ''); }); var tt = box.querySelector('.an-tt'); if (tt) tt.hidden = true; }

  /* ---------- Verdelingen (liggende balken) ---------- */
  function breakdown(dim, title, rows, total) {
    var max = rows.length ? rows[0].s : 1, open = expanded[dim], shown = open ? rows : rows.slice(0, 6);
    return '<div class="an-card glass"><h3>' + title + '</h3>' +
      (rows.length ? '<ul class="an-bars">' + shown.map(function (r) {
        var pct = total ? r.s / total * 100 : 0;
        return '<li><button type="button" class="an-row" data-filter="' + dim + '" data-k="' + esc(r.k) + '" title="' + esc(t('an.onlyThis')) + '"><span class="an-name">' + esc(label(dim, r.k)) + '</span>' +
          '<span class="an-num">' + i18n.fmt.num(r.s) + '<small>' + i18n.fmt.pct(pct / 100).replace(/\s/g, ' ') + '</small></span>' +
          '<span class="an-track"><i style="width:' + Math.max(2, r.s / max * 100).toFixed(1) + '%"></i></span></button></li>';
      }).join('') + '</ul>' + (rows.length > 6 ? '<button type="button" class="link-btn an-more" data-expand="' + dim + '">' + (open ? t('an.less') : t('an.showAll', { n: rows.length })) + '</button>' : '')
        : '<p class="an-none">' + t('an.noData') + '</p>') + '</div>';
  }

  /* ---------- Alles tekenen ---------- */
  function draw() {
    var r = data, rg = { from: r.from, to: r.to };
    document.getElementById('anRange').textContent = rg.from === rg.to ? i18n.fmt.date(d(rg.from), 'long') : i18n.fmt.date(d(rg.from), 'long') + ' – ' + i18n.fmt.date(d(rg.to), 'long');
    var demo = document.getElementById('anDemo'); demo.hidden = !r.demo; demo.textContent = t('an.demoNote');
    document.getElementById('anFoot').innerHTML = esc(t('an.privacy')) + (r.geo ? ' <a href="https://db-ip.com" target="_blank" rel="noopener">' + esc(t('an.geoBy')) + '</a>' : ' ' + esc(t('an.noGeo')));
    if (!Object.keys(names).length) {
      body.innerHTML = '<div class="mc-empty glass">' + ico('scans') + '<h3>' + t('an.emptyTitle') + '</h3><p>' + t('an.emptyText') + '</p><button type="button" class="btn primary" data-an-new>' + t('myCodes.first') + '</button></div>';
      return;
    }
    var tot = r.totals.scans;
    body.innerHTML = tiles(r.totals) +
      '<div class="an-card glass an-chart"><div class="an-chead"><h3>' + t('an.chartTitle') + '</h3><div class="an-legend"><span><i class="sw s1"></i>' + t('an.scans') + '</span><span><i class="sw s2"></i>' + t('an.unique') + '</span></div></div>' +
        (tot ? '' : '<p class="an-none an-zero">' + t('an.noScans') + '</p>') + '<div class="an-plot"></div>' +
        '<details class="an-table"><summary>' + t('an.asTable') + '</summary><div class="an-tw"><table><thead><tr><th>' + t('an.date') + '</th><th>' + t('an.scans') + '</th><th>' + t('an.unique') + '</th></tr></thead><tbody>' +
        r.series.slice().reverse().filter(function (p) { return p.s; }).map(function (p) { return '<tr><td>' + esc(i18n.fmt.date(d(p.d), 'short')) + '</td><td>' + i18n.fmt.num(p.s) + '</td><td>' + i18n.fmt.num(p.u) + '</td></tr>'; }).join('') + '</tbody></table></div></details></div>' +
      '<div class="an-grid4">' + breakdown('os', t('an.byOs'), r.os, tot) + breakdown('cc', t('an.byCountry'), r.countries, tot) + breakdown('city', t('an.byCity'), r.cities, tot) + breakdown('codes', t('an.byCode'), r.codes, tot) + '</div>';
    lineChart(r.series);
  }
  function load() {
    var my = ++seq;
    if (!data) body.innerHTML = '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    Promise.all([api.analytics(query()), Object.keys(names).length ? null : api.listQrCodes().catch(function () { return []; })]).then(function (res) {
      if (my !== seq) return;
      data = res[0];
      if (res[1]) res[1].forEach(function (c) { names[c.id] = { label: MyCodes.displayName(c), typeId: c.typeId }; });
      (data.names || []).forEach(function (c) { if (!names[c.id]) names[c.id] = { label: c.name || c.id, typeId: c.typeId }; });
      drawFilters(); draw();
    }).catch(function () { if (my === seq) body.innerHTML = '<p class="muted-msg">' + t('an.error') + '</p>'; });
  }
  function exportCsv() {
    api.analyticsCsv(query()).then(function (r) {
      var name = 'statistieken-' + (range().from || 'alles') + '.csv';
      if (!r.url) return saveFile(new Blob([r.text], { type: 'text/csv;charset=utf-8' }), name);   // demo
      var a = document.createElement('a'); a.href = r.url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500);
    });
  }

  /* ---------- Bediening ---------- */
  view.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'anPeriod') { f.period = el.value; if (f.period === 'custom') { var r0 = range(); f.from = r0.from; f.to = r0.to; } return load(); }
    if (el.id === 'anFrom') { f.from = el.value; return load(); }
    if (el.id === 'anTo') { f.to = el.value; return load(); }
    var all = el.getAttribute('data-all'), pick = el.getAttribute('data-pick');
    if (all) { f[all] = []; return load(); }
    if (pick) { var list = f[pick], i = list.indexOf(el.value); if (el.checked && i < 0) list.push(el.value); if (!el.checked && i >= 0) list.splice(i, 1); return load(); }
  });
  view.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-drop]'))) { var dim = b.getAttribute('data-drop'); openDrop = openDrop === dim ? null : dim; drawFilters(); var fst = bar.querySelector('.an-drop input'); if (fst) fst.focus(); return; }
    if (!e.target.closest('.an-drop') && openDrop) { openDrop = null; drawFilters(); }
    if (e.target.closest('[data-clear]')) { f.codes = []; f.os = []; f.cc = []; f.city = []; return load(); }
    if ((b = e.target.closest('[data-filter]'))) { var k = b.getAttribute('data-filter'); f[k] = [b.getAttribute('data-k')]; window.scrollTo({ top: 0, behavior: 'smooth' }); return load(); }
    if ((b = e.target.closest('[data-expand]'))) { var x = b.getAttribute('data-expand'); expanded[x] = !expanded[x]; return draw(); }
    if (e.target.closest('#anExport')) return exportCsv();
    if (e.target.closest('[data-an-new]')) { actions.startNew(); goToPage('create'); }
  });
  view.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openDrop) { var dim = openDrop; openDrop = null; drawFilters(); var btn = bar.querySelector('[data-drop="' + dim + '"]'); if (btn) btn.focus(); } });
  body.addEventListener('pointermove', function (e) { if (e.target.closest('.an-plot')) hover(e); });
  body.addEventListener('pointerleave', unhover, true);
  addEventListener('resize', function () { if (!view.hidden && data && data.series) lineChart(data.series); });

  function labels() { document.getElementById('anExport').innerHTML = ico('dl') + t('an.export'); }
  labels();
  document.addEventListener('pagechange', function (e) { if (e.detail === 'analytics') { names = {}; load(); } });
  i18n.onChange(function () { labels(); if (!view.hidden && data) { drawFilters(); draw(); } });

  // Vanuit Mijn QR-codes: meteen de statistieken van één code
  return { open: function (opts) { f.codes = (opts && opts.codes) || []; f.os = []; f.cc = []; f.city = []; goToPage('analytics'); } };
})();
