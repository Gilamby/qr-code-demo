/* =========================================================
   STATISTIEKEN
   - Filters: periode + QR-codes altijd zichtbaar; systeem, land, stad, apparaat en browser achter "Filters".
     Gekozen filters staan als chips eronder (× = weghalen).
   - Vier tegels: scans, unieke scans (met groei t.o.v. de periode ervoor + mini-grafiekje), actieve codes, beste dag
   - Tabbladen: Overzicht (grafiek + top QR-codes), Waar (land, stad), Waarmee (systeem, apparaat, browser als
     donut), Wanneer (weekdag, uur, kalender). Zo past elk deel op één scherm.
   - "Onbekend" staat altijd onderaan en in grijs
   - Animaties: cijfers tellen op, balken/donuts groeien, lijn tekent zich (niet bij "minder beweging")
   - Exporteren als CSV (Excel) en rapport (PDF: alle tabbladen onder elkaar)
   Gegevens: api.analytics() → server (/api/analytics) of, in de online demo, voorbeeldcijfers.
   ========================================================= */
var Analytics = (function () {
  var view = document.getElementById('analyticsView'), body = document.getElementById('anBody'), bar = document.getElementById('anFilters');
  var PERIODS = ['today', 'yesterday', '7', '30', '90', 'all', 'custom'];
  var f = { period: '30', from: '', to: '', codes: [], os: [], cc: [], city: [], br: [], dev: [] };
  var data = null, names = {}, openDrop = null, expanded = {}, seq = 0, group = 'day';   // group: dag, week of maand
  var tab = 'overview', moreOpen = false, printAll = false, whereDim = 'cc', whenDim = 'wd';   // dashboard: land/stad en weekdag/uur wisselen
  var TABS = ['overview', 'where', 'with', 'when'], MORE = ['os', 'cc', 'city', 'dev', 'br'];
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Dagen samenvoegen tot weken (maandag) of maanden. Unieke scans worden opgeteld per dag. */
  function grouped(series) {
    if (group === 'day') return series;
    var out = [], by = {};
    series.forEach(function (p) {
      var dt = d(p.d), key = group === 'month' ? p.d.slice(0, 8) + '01' : iso(new Date(dt.getTime() - ((dt.getDay() + 6) % 7) * 864e5));
      if (!by[key]) { by[key] = { d: key, s: 0, u: 0 }; out.push(by[key]); }
      by[key].s += p.s; by[key].u += p.u;
    });
    return out;
  }
  // Wat er onder de grafiek / in de tooltip / in de tabel staat voor één punt
  function pointLabel(p, style) {
    if (group === 'month') return i18n.fmt.month(d(p.d), style !== 'long');
    if (group === 'week') return style === 'long' ? t('an.weekOf', { date: i18n.fmt.date(d(p.d), 'long') }) : i18n.fmt.date(d(p.d), style === 'axis' ? 'dshort' : 'short');
    return i18n.fmt.date(d(p.d), style === 'axis' ? 'dshort' : style);
  }
  var IC = {
    codes: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><path d="M14 14h2v2h-2zM18 18h2v2h-2z"/>',
    scans: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    unique: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', x: '<path d="M7 7l10 10M17 7L7 17"/>', filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    up: '<path d="M7 14l5-5 5 5"/>', down: '<path d="M7 10l5 5 5-5"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>', tablet: '<rect x="4.5" y="3" width="15" height="18" rx="2.5"/><path d="M11 18h2"/>', desktop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', chev: '<path d="M6 9l6 6 6-6"/>'
  };
  function ico(k, cls) { return '<svg class="' + (cls || 'an-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>'; }
  function iso(d) { return d.toISOString().slice(0, 10); }
  /** Periode langer dan je pakket toont? Dan 'pro' of 'business' (vanaf welk pakket), anders null */
  function periodLocked(p) {
    var d = window.PlanGate && PlanGate.statsDays(); if (!d) return null;
    var n = p === 'all' ? Infinity : /^\d+$/.test(p) ? +p : 0;
    return n > d ? (d < 365 && n <= 365 ? 'pro' : 'business') : null;
  }
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
  function query() { var r = range(); return { from: r.from, to: r.to, codes: f.codes, os: f.os, cc: f.cc, city: f.city, br: f.br, dev: f.dev, tz: i18n.fmt.zone() }; }

  /* ---------- Namen en labels ---------- */
  function osName(k) { return k === 'other' ? t('an.other') : k; }
  function ccName(k) { return k ? TEL.flag(k) + ' ' + TEL.name(k) : t('an.unknown'); }
  function cityName(k) { var p = k.split('|'); return p[1] ? p[1] + (p[0] ? ' (' + p[0] + ')' : '') : t('an.unknown'); }
  function codeName(id) { var c = names[id]; return c ? c.label : id; }
  function brName(k) { return k === 'unknown' ? t('an.unknown') : k === 'other' ? t('an.other') : k === 'In-app' ? t('an.inApp') : k; }
  function devName(k) { return t('an.dev_' + (/^(mobile|tablet|desktop)$/.test(k) ? k : 'unknown')); }
  function label(dim, k) { return dim === 'br' ? brName(k) : dim === 'dev' ? devName(k) : dim === 'os' ? osName(k) : dim === 'cc' ? ccName(k) : dim === 'city' ? cityName(k) : codeName(k); }
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
    var o = (data && data.options) || { os: [], countries: [], cities: [], browsers: [], devices: [] };
    var codeIds = Object.keys(names);
    var nMore = MORE.reduce(function (n, k) { return n + f[k].length; }, 0);
    var chips = [];
    ['codes'].concat(MORE).forEach(function (dim) { f[dim].forEach(function (k) { chips.push('<button type="button" class="an-chip" data-unpick="' + dim + '" data-k="' + esc(k) + '" aria-label="' + esc(t('an.removeFilter', { name: label(dim, k) })) + '"><span>' + esc(label(dim, k)) + '</span>' + ico('x', 'an-cx') + '</button>'); }); });
    bar.innerHTML = '<div class="an-frow">' +
      '<label class="an-f"><span class="an-flbl">' + t('an.period') + '</span><select id="anPeriod">' + PERIODS.map(function (p) { var lk = periodLocked(p); return '<option value="' + p + '"' + (f.period === p ? ' selected' : '') + '>' + t('an.p_' + p) + (lk ? ' ⚡ ' + t('pw.lockFrom', { plan: t('plan.n_' + lk) }) : '') + '</option>'; }).join('') + '</select></label>' +
      (f.period === 'custom' ? '<label class="an-f"><span class="an-flbl">' + t('an.from') + '</span><input type="date" id="anFrom" value="' + range().from + '" max="' + iso(new Date()) + '"></label>' +
        '<label class="an-f"><span class="an-flbl">' + t('an.to') + '</span><input type="date" id="anTo" value="' + range().to + '" max="' + iso(new Date()) + '"></label>' : '') +
      multi('codes', t('an.codes'), codeIds) +
      '<button type="button" class="an-morebtn' + (moreOpen ? ' on' : '') + '" data-more aria-expanded="' + moreOpen + '">' + ico('filter') + '<span>' + t('an.filters') + '</span>' + (nMore ? '<b>' + nMore + '</b>' : '') + ico('chev', 'an-chev') + '</button></div>' +
      (moreOpen ? '<div class="an-frow an-frow2">' + multi('os', t('an.os'), o.os) + multi('cc', t('an.countries'), o.countries) + multi('city', t('an.cities'), o.cities) + multi('dev', t('an.devices'), o.devices || []) + multi('br', t('an.browsers'), o.browsers || []) + '</div>' : '') +
      (chips.length ? '<div class="an-chips">' + chips.join('') + '<button type="button" class="link-btn an-clear" data-clear>' + t('an.clear') + '</button></div>' : '');
  }

  /* ---------- Tegels ---------- */
  // Groei t.o.v. de periode ervoor, als gekleurd label
  function delta(now, before) {
    if (!before && !now) return '';
    if (!before) return '<span class="an-delta is-up">' + ico('up', 'an-di') + t('an.newScans', { n: i18n.fmt.num(now) }) + '</span>';
    var p = Math.round((now - before) / before * 100);
    return '<span class="an-delta is-' + (p > 0 ? 'up' : p < 0 ? 'down' : 'flat') + '" title="' + esc(t('an.vsPrev')) + '">' + (p ? ico(p > 0 ? 'up' : 'down', 'an-di') : '') + i18n.fmt.num(Math.abs(p)) + '%<small>' + t('an.vsPrevShort') + '</small></span>';
  }
  // Mini-grafiekje onderin een tegel
  function spark(vals, cls) {
    if (vals.length < 2) return '';
    var m = Math.max.apply(null, vals.concat([1])), n = vals.length;
    var pts = vals.map(function (v, i) { return (i / (n - 1) * 100).toFixed(2) + ' ' + (30 - v / m * 26).toFixed(2); });
    return '<svg class="an-spark ' + cls + '" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path class="ar" d="M' + pts.join(' L') + ' L100 32 L0 32Z"/><path class="ln" d="M' + pts.join(' L') + '"/></svg>';
  }
  function num(n) { return '<b class="an-big" data-count="' + n + '">' + i18n.fmt.num(calm ? n : 0) + '</b>'; }
  function tiles(r) {
    var tot = r.totals, I = r.insights || {}, s = r.series || [];
    var tile = function (k, icon, title, value, foot, extra, tip) {
      return '<div class="an-tile glass an-' + k + '"><div class="an-ttop"><span class="an-tic">' + CodeUtil.tileIcon(icon) + '</span><small>' + title +
        (tip ? ' <button type="button" class="an-tip" aria-label="' + esc(tip) + '" data-tip="' + esc(tip) + '">' + ico('info', 'an-ii') + '</button>' : '') + '</small></div>' +
        value + '<div class="an-tfoot">' + foot + '</div>' + (extra || '') + '</div>';
    };
    var best = I.bestDay;
    return '<div class="an-tiles">' +
      tile('scans', 'qrscan', t('an.totalScans'), num(tot.scans), delta(tot.scans, I.prevScans || 0), spark(s.map(function (p) { return p.s; }), 's1')) +
      tile('unique', 'frame', t('an.totalUnique'), num(tot.unique), delta(tot.unique, I.prevUnique || 0), spark(s.map(function (p) { return p.u; }), 's2'), t('an.uniqueTip')) +
      tile('active', 'folder', t('an.activeCodes'), num(I.activeCodes || 0), '<span class="an-tsub">' + t('an.activeOf', { n: i18n.fmt.num(tot.codes) }) + '</span>' +
        '<span class="an-meter"><i style="width:' + (tot.codes ? Math.round((I.activeCodes || 0) / tot.codes * 100) : 0) + '%"></i></span>') +
      tile('best', 'star', t('an.bestDay'), best && best.s ? '<b class="an-big an-date">' + esc(i18n.fmt.date(d(best.d), 'dshort')) + '</b>' : '<b class="an-big an-date">–</b>',
        '<span class="an-tsub">' + (best && best.s ? t('an.nScans', { n: i18n.fmt.num(best.s) }) : t('an.noScansShort')) + '</span>') +
      '</div>';
  }
  // Cijfers optellen van 0 naar de echte waarde (kort, rustig)
  function countUp() {
    if (calm) return;
    body.querySelectorAll('[data-count]').forEach(function (el) {
      var to = +el.getAttribute('data-count'), t0 = performance.now(), dur = 900;
      (function tick(now) { var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = i18n.fmt.num(Math.round(to * e)); if (k < 1) requestAnimationFrame(tick); })(t0);
    });
  }

  /* ---------- Inzichten: gemiddelde, groei, beste dag, topcode, actieve codes, drukste moment ---------- */
  var WD = function (i) { return new Date(Date.UTC(2024, 0, 1 + i, 12)).toLocaleDateString(i18n.lang(), { weekday: 'long', timeZone: 'UTC' }); };   // 1 jan 2024 = maandag
  function maxIdx(a) { var m = -1; a.forEach(function (v, i) { if (v > 0 && (m < 0 || v > a[m])) m = i; }); return m; }
  // Eén duidelijke samenvatting in gewone taal (in plaats van losse vakjes)
  function insights(r) {
    var I = r.insights; if (!I) return '';
    if (!r.totals.scans) return '<div class="an-card glass an-summary"><p>' + t('an.sumNone') + '</p></div>';
    var top = r.codes[0], wd = maxIdx(I.weekdays), hr = I.hours ? maxIdx(I.hours) : -1, parts = [];
    var p = I.prevScans ? Math.round((r.totals.scans - I.prevScans) / I.prevScans * 100) : null;
    parts.push(t('an.sumMain', { scans: '<b>' + i18n.fmt.num(r.totals.scans) + '</b>', people: '<b>' + i18n.fmt.num(r.totals.unique) + '</b>' }));
    if (p !== null && p !== 0) parts.push(t(p > 0 ? 'an.sumUp' : 'an.sumDown', { pct: '<b class="' + (p > 0 ? 'an-up' : 'an-down') + '">' + i18n.fmt.num(Math.abs(p)) + '%</b>' }));
    if (top) parts.push(t('an.sumTop', { name: '<b>' + esc(codeName(top.k)) + '</b>', n: i18n.fmt.num(top.s) }));
    if (wd >= 0) parts.push(hr >= 0 ? t('an.sumWhen', { day: '<b>' + esc(WD(wd)) + '</b>', hour: '<b>' + String(hr).padStart(2, '0') + ':00</b>' }) : t('an.sumDay', { day: '<b>' + esc(WD(wd)) + '</b>' }));
    return '<div class="an-card glass an-summary"><p>' + parts.join(' ') + '</p>' + (r.totals.scans < 20 ? '<p class="an-few">' + t('an.fewData') + '</p>' : '') + '</div>';
  }
  // Wanneer wordt er gescand: per weekdag en per uur (staafjes, met de getallen ook als tekst voor schermlezers)
  function colBars(vals, lbl, cls) {
      var m = Math.max.apply(null, vals.concat([1]));
      return '<ol class="an-cols ' + cls + '">' + vals.map(function (v, i) { return '<li title="' + esc(lbl(i, true) + ': ' + i18n.fmt.num(v)) + '"><i style="height:' + (v ? Math.max(4, v / m * 100) : 0) + '%"></i><span>' + esc(lbl(i)) + '</span><b class="sr-only">' + i18n.fmt.num(v) + '</b></li>'; }).join('') + '</ol>';
  }
  var wdLabel = function (i, long) { var w = WD(i); return long ? w : w.slice(0, 2); };
  var hrLabel = function (i, long) { return long ? String(i).padStart(2, '0') + ':00–' + String(i).padStart(2, '0') + ':59' : (i % 6 ? '' : String(i)); };
  function when(r) {
    var I = r.insights; if (!I) return '';
    var bars = function (vals, lbl, cls) {
      var m = Math.max.apply(null, vals.concat([1]));
      return '<ol class="an-cols ' + cls + '">' + vals.map(function (v, i) { return '<li title="' + esc(lbl(i, true) + ': ' + i18n.fmt.num(v)) + '"><i style="height:' + (v ? Math.max(4, v / m * 100) : 0) + '%"></i><span>' + esc(lbl(i)) + '</span><b class="sr-only">' + i18n.fmt.num(v) + '</b></li>'; }).join('') + '</ol>';
    };
    var hourBox = I.filtered ? '<p class="an-none">' + t('an.hoursFiltered') + '</p>'
      : !I.hoursSince ? '<p class="an-none">' + t('an.hoursNone') + '</p>'
      : bars(I.hours, function (i, long) { return long ? String(i).padStart(2, '0') + ':00–' + String(i).padStart(2, '0') + ':59' : (i % 3 ? '' : String(i)); }, 'h24') + (I.hoursSince > r.from ? '<p class="an-note">' + t('an.hoursSince', { date: esc(i18n.fmt.date(d(I.hoursSince), 'long')) }) + '</p>' : '');
    return '<div class="an-grid2"><div class="an-card glass"><div class="an-chead"><h3>' + t('an.byWeekday') + '</h3></div>' + bars(I.weekdays, function (i, long) { var w = WD(i); return long ? w : w.slice(0, 2); }, 'w7') + '</div>' +
      '<div class="an-card glass"><div class="an-chead"><h3>' + t('an.byHour') + '</h3><small class="muted">' + esc(i18n.fmt.zone()) + '</small></div>' + hourBox + '</div></div>';
  }

  /* ---------- Lijngrafiek ---------- */
  var chart = { pts: [], w: 0 };
  // Stap tussen de lijnen: 1, 2, 5, 10, 20, 50 … (altijd hele getallen), 4 tot 5 lijnen
  function step(max) { var raw = Math.max(1, max / 4), p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p); }
  function lineChart(series) {
    var box = body.querySelector('.an-plot'); if (!box) return;
    var W = Math.max(280, box.clientWidth), H = printAll ? 280 : W < 520 ? (compactMq.matches ? 132 : 200) : (compactMq.matches ? 180 : 270), L = 40, R = 14, T = 12, B = 30, iw = W - L - R, ih = H - T - B;
    var top = Math.max.apply(null, series.map(function (p) { return p.s; }).concat([1])), st = step(top), max = Math.ceil(top / st) * st, n = series.length;
    var x = function (i) { return L + (n === 1 ? iw / 2 : i * iw / (n - 1)); }, y = function (v) { return T + ih - v / max * ih; };
    var ticks = []; for (var v = 0; v <= max + 1e-9; v += st) ticks.push(v);
    var every = Math.max(1, Math.ceil(n / (W < 520 ? 4 : 8)));
    var path = function (k) { return series.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[k]).toFixed(1); }).join(''); };
    // Piek: de hoogste dag krijgt een stip met het aantal erboven
    var peak = function () {
      var pi = -1; series.forEach(function (p, i) { if (p.s > 0 && (pi < 0 || p.s > series[pi].s)) pi = i; }); if (pi < 0) return '';
      var px = x(pi), py = y(series[pi].s), lx = Math.min(Math.max(px, L + 34), W - R - 34);
      return '<g class="an-peak"><circle cx="' + px + '" cy="' + py + '" r="9" class="an-pring"/><circle cx="' + px + '" cy="' + py + '" r="4.5" class="an-pdot"/>' +
        '<rect x="' + (lx - 32) + '" y="' + Math.max(0, py - 34) + '" width="64" height="22" rx="11" class="an-pbox"/><text x="' + lx + '" y="' + (Math.max(0, py - 34) + 15) + '" class="an-ptxt">' + esc(t('an.peak')) + ' ' + i18n.fmt.num(series[pi].s) + '</text></g>';
    };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(t('an.chartTitle')) + '">' +
      ticks.map(function (v) { return '<line class="an-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="an-ax" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + i18n.fmt.num(v) + '</text>'; }).join('') +
      series.map(function (p, i) { return i % every === 0 || i === n - 1 && (n - 1) % every > every / 2 ? '<text class="an-ax" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(pointLabel(p, 'axis')) + '</text>' : ''; }).join('') +
      (n > 1 ? '<path class="an-area" d="' + path('s') + 'L' + x(n - 1) + ' ' + y(0) + 'L' + x(0) + ' ' + y(0) + 'Z"/>' +
        '<path class="an-line s1" d="' + path('s') + '"/><path class="an-line s2" d="' + path('u') + '"/>' + peak()
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
    tt.innerHTML = '<b>' + esc(pointLabel(p, 'long')) + '</b><span><i class="sw s1"></i>' + t('an.scans') + '<em>' + i18n.fmt.num(p.s) + '</em></span><span><i class="sw s2"></i>' + t('an.unique') + '<em>' + i18n.fmt.num(p.u) + '</em></span>';
    var left = cx / (svg.viewBox.baseVal.width) * r.width; tt.style.left = Math.min(Math.max(left, 80), r.width - 80) + 'px'; tt.style.top = Math.max(0, chart.y(p.s) / svg.viewBox.baseVal.height * r.height - 70) + 'px';
  }
  function unhover() { var box = body.querySelector('.an-plot'); if (!box) return; box.querySelectorAll('.an-cross,.an-hl').forEach(function (el) { el.setAttribute('hidden', ''); }); var tt = box.querySelector('.an-tt'); if (tt) tt.hidden = true; }

  /* ---------- Verdelingen (liggende balken) ---------- */
  // Groei of daling per QR-code t.o.v. de periode ervoor (even lang)
  function growth(now, before) {
    if (!before && !now) return '';
    if (!before) return '<em class="an-gr up" title="' + esc(t('an.vsPrev')) + '">+' + i18n.fmt.num(now) + '</em>';
    var p = Math.round((now - before) / before * 100);
    return '<em class="an-gr ' + (p > 0 ? 'up' : p < 0 ? 'down' : '') + '" title="' + esc(t('an.vsPrev')) + '">' + (p > 0 ? '+' : '') + p + '%</em>';
  }
  // Kalender: elke dag een vakje, hoe donkerder hoe meer scans (zelfde gegevens als de grafiek)
  function calendar(series) {
    if (!series.length || series.length > 400) return '';
    var max = Math.max.apply(null, series.map(function (p) { return p.s; }).concat([1]));
    var first = (new Date(series[0].d + 'T12:00:00Z').getUTCDay() + 6) % 7;            // 0 = maandag
    var cells = []; for (var i = 0; i < first; i++) cells.push('<i class="pad"></i>');
    series.forEach(function (p) {
      var lv = p.s ? Math.min(4, 1 + Math.floor(p.s / max * 3.999)) : 0;
      cells.push('<i class="l' + lv + '" title="' + esc(i18n.fmt.date(d(p.d), 'long') + ': ' + i18n.fmt.num(p.s) + ' ' + t('an.scans').toLowerCase()) + '"></i>');
    });
    var wd = [0, 1, 2, 3, 4, 5, 6].map(function (k) { return '<span>' + esc(i18n.fmt.weekday(k, 'short')) + '</span>'; }).join('');
    return '<div class="an-card glass an-cal"><div class="an-chead"><h3>' + t('an.calTitle') + '</h3><span class="an-cal-key" aria-hidden="true">' + t('an.calLess') + '<i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i>' + t('an.calMore') + '</span></div>' +
      '<div class="an-cal-wrap"><div class="an-cal-wd" aria-hidden="true">' + wd + '</div><div class="an-cal-grid" role="img" aria-label="' + esc(t('an.calTitle')) + '">' + cells.join('') + '</div></div></div>';
  }
  var UNK = { unknown: 1, other: 1, '': 1 };
  function isUnknown(dim, k) { return dim === 'city' ? !k.split('|')[1] : dim === 'codes' ? false : !!UNK[k]; }
  // "Onbekend" en "Overig" altijd onderaan
  function ordered(dim, rows) { return rows.filter(function (r) { return !isUnknown(dim, r.k); }).concat(rows.filter(function (r) { return isUnknown(dim, r.k); })); }
  function breakdown(dim, title, rows, total, icon) {
    rows = ordered(dim, rows);
    var known = rows.filter(function (r) { return !isUnknown(dim, r.k); });
    var max = known.length ? Math.max.apply(null, known.map(function (r) { return r.s; })) : (rows[0] ? rows[0].s : 1), open = expanded[dim], shown = open ? rows : rows.slice(0, 6);
    var head = '<div class="an-chead"><h3>' + (icon ? ico(icon, 'an-hi') : '') + title + '</h3></div>';
    if (rows.length && !known.length) return '<div class="an-card glass">' + head + '<div class="an-empty">' + ico(icon || 'info', 'an-ei') + '<p>' + t('an.unknownOnly', { n: i18n.fmt.num(total) }) + '</p></div></div>';
    return '<div class="an-card glass">' + head +
      (rows.length ? '<ul class="an-bars">' + shown.map(function (r, i) {
        var pct = total ? r.s / total * 100 : 0, unk = isUnknown(dim, r.k);
        return '<li' + (unk ? ' class="unk"' : '') + ' style="--i:' + i + '"><button type="button" class="an-row" data-filter="' + dim + '" data-k="' + esc(r.k) + '" title="' + esc(t('an.onlyThis')) + '"><span class="an-name">' + esc(label(dim, r.k)) + '</span>' +
          '<span class="an-num">' + i18n.fmt.num(r.s) + '<small>' + i18n.fmt.pct(pct / 100).replace(/\s/g, ' ') + '</small></span>' +
          '<span class="an-track"><i style="width:' + Math.max(2, Math.min(100, r.s / max * 100)).toFixed(1) + '%"></i></span></button></li>';
      }).join('') + '</ul>' + (rows.length > 6 ? '<button type="button" class="link-btn an-more" data-expand="' + dim + '">' + (open ? t('an.less') : t('an.showAll', { n: rows.length })) + '</button>' : '')
        : '<div class="an-empty">' + ico(icon || 'info', 'an-ei') + '<p>' + t('an.noData') + '</p></div>') + '</div>';
  }

  /* ---------- Donut (systeem, apparaat, browser) ---------- */
  var PAL = ['#3b9cf5', '#22c39a', '#a78bfa', '#f5b544', '#f472b6', '#2dd4bf', '#fb7185'];
  function donut(dim, title, rows, total, icon) {
    rows = ordered(dim, rows);
    var head = '<div class="an-chead"><h3>' + ico(icon, 'an-hi') + title + '</h3></div>';
    if (!rows.length) return '<div class="an-card glass an-dcard">' + head + '<div class="an-empty">' + ico(icon, 'an-ei') + '<p>' + t('an.noData') + '</p></div></div>';
    var top = rows.slice(0, 5), rest = rows.slice(5).reduce(function (n, r) { return n + r.s; }, 0);
    if (rest) top.push({ k: 'other', s: rest, rest: true });
    var R = 52, C = 2 * Math.PI * R, at = 0, ci = 0;
    var segs = top.map(function (r) {
      var unk = isUnknown(dim, r.k) || r.rest, col = unk ? 'rgba(255,255,255,.22)' : PAL[ci++ % PAL.length], len = total ? r.s / total * C : 0;
      var seg = { r: r, col: col, unk: unk, len: len, off: at }; at += len; return seg;
    });
    var gap = segs.length > 1 ? 2 : 0;
    var svg = '<svg class="an-donut" viewBox="0 0 140 140" role="img" aria-label="' + esc(title) + '"><circle cx="70" cy="70" r="' + R + '" class="an-dbg"/>' +
      segs.map(function (g, i) { return '<circle cx="70" cy="70" r="' + R + '" class="an-dseg" style="--i:' + i + '" stroke="' + g.col + '" stroke-dasharray="' + Math.max(0, g.len - gap).toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-g.off).toFixed(2) + '"/>'; }).join('') +
      '<text x="70" y="68" class="an-dnum">' + i18n.fmt.num(total) + '</text><text x="70" y="86" class="an-dlbl">' + esc(t('an.scans').toLowerCase()) + '</text></svg>';
    var devIco = function (k) { return dim === 'dev' && /^(mobile|tablet|desktop)$/.test(k) ? ico(k === 'mobile' ? 'phone' : k, 'an-li') : ''; };
    return '<div class="an-card glass an-dcard">' + head + '<div class="an-dwrap">' + svg + '<ul class="an-legend2">' + segs.map(function (g) {
      var pct = total ? g.r.s / total : 0;
      return '<li' + (g.unk ? ' class="unk"' : '') + '>' + (g.r.rest ? '<span class="an-lrow">' : '<button type="button" class="an-lrow" data-filter="' + dim + '" data-k="' + esc(g.r.k) + '" title="' + esc(label(dim, g.r.k) + ': ' + t('an.nScans', { n: i18n.fmt.num(g.r.s) }) + ' · ' + t('an.onlyThis')) + '">') +
        '<i class="an-ldot" style="background:' + g.col + '"></i>' + devIco(g.r.k) + '<span class="an-lname">' + esc(g.r.rest ? t('an.other') : label(dim, g.r.k)) + '</span><b>' + i18n.fmt.pct(pct).replace(/\s/g, ' ') + '</b><small class="sr-only">' + i18n.fmt.num(g.r.s) + '</small>' + (g.r.rest ? '</span>' : '</button>') + '</li>';
    }).join('') + '</ul></div></div>';
  }

  /* ---------- Top QR-codes: ranglijst met plaatje, medaille en groei ---------- */
  function ranking(rows, total) {
    var open = expanded.rank, shown = open ? rows : rows.slice(0, 5), max = rows.length ? rows[0].s : 1;
    var medal = ['🥇', '🥈', '🥉'];
    return '<div class="an-card glass an-rank"><div class="an-chead"><h3>' + ico('codes', 'an-hi') + t('an.topCodes') + '</h3><small class="muted">' + t('an.vsPrevShort') + '</small></div>' +
      (rows.length ? '<ol class="an-rlist">' + shown.map(function (r, i) {
        var c = names[r.k], qr = '';
        try { qr = c && c.code ? CodeUtil.qrSvg(c.code) : ''; } catch (e) { qr = ''; }
        return '<li style="--i:' + i + '"><button type="button" class="an-rrow" data-filter="codes" data-k="' + esc(r.k) + '" title="' + esc(t('an.onlyThis')) + '">' +
          '<span class="an-pos' + (i < 3 ? ' m' : '') + '">' + (i < 3 ? medal[i] : i + 1) + '</span>' +
          '<span class="an-rqr" aria-hidden="true">' + qr + '</span>' +
          '<span class="an-rmain"><span class="an-rname">' + esc(codeName(r.k)) + '</span><span class="an-track"><i style="width:' + Math.max(2, r.s / max * 100).toFixed(1) + '%"></i></span></span>' +
          '<span class="an-rnum"><b>' + i18n.fmt.num(r.s) + '</b>' + growth(r.s, r.p || 0) + '</span></button></li>';
      }).join('') + '</ol>' + (rows.length > 5 ? '<button type="button" class="link-btn an-more" data-expand="rank">' + (open ? t('an.less') : t('an.showAll', { n: rows.length })) + '</button>' : '')
        : '<div class="an-empty">' + ico('codes', 'an-ei') + '<p>' + t('an.noData') + '</p></div>') + '</div>';
  }

  /* ---------- Dashboard: alles in één oogopslag (zoals Overzicht) ---------- */
  function seg(name, cur, opts) {
    return '<div class="an-seg" role="radiogroup">' + opts.map(function (o) { return '<button type="button" role="radio" data-' + name + '="' + o[0] + '" aria-checked="' + (cur === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function miniList(dim, rows, total) {
    rows = ordered(dim, rows);
    var known = rows.filter(function (r) { return !isUnknown(dim, r.k); });
    if (!known.length) return '<div class="an-empty sm">' + ico('globe', 'an-ei') + '<p>' + (rows.length ? t('an.unknownOnly', { n: i18n.fmt.num(total) }) : t('an.noData')) + '</p></div>';
    var max = Math.max.apply(null, known.map(function (r) { return r.s; }));
    return '<ul class="an-bars an-mini">' + rows.slice(0, 5).map(function (r, i) {
      var unk = isUnknown(dim, r.k), pct = total ? r.s / total : 0;
      return '<li' + (unk ? ' class="unk"' : '') + ' style="--i:' + i + '"><button type="button" class="an-row" data-filter="' + dim + '" data-k="' + esc(r.k) + '" title="' + esc(t('an.onlyThis')) + '"><span class="an-name">' + esc(label(dim, r.k)) + '</span>' +
        '<span class="an-num">' + i18n.fmt.pct(pct).replace(/\s/g, ' ') + '</span><span class="an-track"><i style="width:' + Math.max(2, Math.min(100, r.s / max * 100)).toFixed(1) + '%"></i></span></button></li>';
    }).join('') + '</ul>';
  }
  function whereCard(r) {
    var tot = r.totals.scans;
    // Kruimelpad bij doorklikken: Alle landen › Frankrijk › Parijs (klik = een stap terug)
    var crumb = f.cc.length === 1 ? '<nav class="an-crumb"><button type="button" class="link-btn" data-geo-up="all">' + t('an.allCountries') + '</button><span>›</span>' +
      (f.city.length === 1 ? '<button type="button" class="link-btn" data-geo-up="cc">' + esc(ccName(f.cc[0])) + '</button><span>›</span><b>' + esc(String(f.city[0]).split('|')[1] || t('an.unknown')) + '</b>' : '<b>' + esc(ccName(f.cc[0])) + '</b>') + '</nav>' : '';
    var hint = !f.cc.length && tot ? '<p class="an-drill">' + t('an.drillHint') + '</p>' : f.city.length === 1 ? '<p class="an-drill">' + t('an.cityHint') + '</p>' : '';
    return '<div class="an-card glass an-dc"><div class="an-chead"><h3>' + ico('globe', 'an-hi') + t('an.tab_where') + '</h3>' + seg('where', whereDim, [['cc', t('an.countries')], ['city', t('an.cities')]]) + '</div>' +
      crumb + miniList(whereDim, whereDim === 'cc' ? r.countries : r.cities, tot) + hint + '</div>';
  }
  function whenCard(r) {
    var I = r.insights || {}, body;
    if (whenDim === 'wd') body = colBars(I.weekdays || [0, 0, 0, 0, 0, 0, 0], wdLabel, 'w7');
    else body = I.filtered ? '<p class="an-none">' + t('an.hoursFiltered') + '</p>' : !I.hoursSince ? '<p class="an-none">' + t('an.hoursNone') + '</p>' : colBars(I.hours, hrLabel, 'h24');
    return '<div class="an-card glass an-dc"><div class="an-chead"><h3>' + ico('clock', 'an-hi') + t('an.tab_when') + '</h3>' + seg('when', whenDim, [['wd', t('an.g_day')], ['hr', t('an.hourShort')]]) + '</div>' + body + '</div>';
  }
  /* Telefoon en tablet (≤ 1100 px): alles op één scherm. Grafiek, daaronder tabbladjes; je ziet steeds één onderdeel. */
  var compactMq = matchMedia('(max-width: 1100px)'), mtab = 'top';
  var MTABS = [['top', 'an.mTop'], ['where', 'an.tab_where'], ['os', 'an.os'], ['dev', 'an.devices'], ['br', 'an.browsers'], ['when', 'an.tab_when']];
  function mpane(r) {
    var tot = r.totals.scans;
    return mtab === 'where' ? whereCard(r) : mtab === 'when' ? whenCard(r) : mtab === 'os' ? donut('os', t('an.os'), r.os, tot, 'phone')
      : mtab === 'dev' ? donut('dev', t('an.devices'), r.devices || [], tot, 'desktop') : mtab === 'br' ? donut('br', t('an.browsers'), r.browsers || [], tot, 'globe') : ranking(r.codes, tot);
  }
  function mtabs() {
    return '<div class="an-mtabs" role="tablist">' + MTABS.map(function (x) { return '<button type="button" role="tab" data-mtab="' + x[0] + '" aria-selected="' + (mtab === x[0]) + '">' + esc(t(x[1])) + '</button>'; }).join('') + '</div>';
  }
  function dashboard(r) {
    var tot = r.totals.scans;
    if (compactMq.matches && !printAll) return '<div class="an-dash an-compact">' + chartCard(r) + mtabs() + '<div class="an-mpane" id="anMPane">' + mpane(r) + '</div></div>';
    return '<div class="an-dash"><div class="an-d1">' + chartCard(r) + (isDetail() ? breakdown('city', t('an.byCity'), r.cities, tot, 'globe') : ranking(r.codes, tot)) + '</div>' +
      '<div class="an-d2">' + whereCard(r) + donut('os', t('an.os'), r.os, tot, 'phone') + donut('dev', t('an.devices'), r.devices || [], tot, 'desktop') + donut('br', t('an.browsers'), r.browsers || [], tot, 'globe') + whenCard(r) + '</div></div>';
  }
  // Alleen dat ene kaartje vervangen (de rest van het dashboard blijft rustig staan)
  function swapCard(btn, html, focusSel) {
    var card = btn.closest('.an-dc'); if (!card) return drawTab();
    var tmp = document.createElement('div'); tmp.innerHTML = html; var nc = tmp.firstChild; card.parentNode.replaceChild(nc, card);
    var f = nc.querySelector(focusSel); if (f) f.focus();
  }
  // Zoals Overzicht: past de pagina niet, dan iets kleiner (minimaal 75%), zodat je alles ziet zonder te scrollen
  function fit() {
    var sec = view.querySelector('.an'); if (!sec || view.hidden) return;
    sec.style.zoom = '';
    if (isDetail()) { if (data && data.series && body.querySelector('.an-plot')) lineChart(grouped(data.series)); if (scansD) drawMap(); return; }   // detailpagina mag scrollen; grafiek opnieuw op de echte breedte
    if (window.innerWidth <= 1100 || printAll) return;
    var top = sec.getBoundingClientRect().top + window.scrollY, h = sec.offsetHeight, avail = window.innerHeight - top - 24;
    var extra = document.documentElement.scrollHeight - window.innerHeight - Math.max(0, h - avail);   // ruimte onder de bubbel (marge van de pagina)
    if (extra > 0) avail -= extra;
    if (h > avail) sec.style.zoom = Math.max(.75, Math.floor(avail / h * 1000) / 1000);
    if (data && data.series && body.querySelector('.an-plot')) lineChart(grouped(data.series));
  }

  /* ---------- Tabbladen (alleen nog voor het rapport/PDF: alle details onder elkaar) ---------- */
  function chartCard(r) {
    var tot = r.totals.scans;
    return '<div class="an-card glass an-chart"><div class="an-chead"><h3>' + t(group === 'day' ? 'an.chartTitle' : group === 'week' ? 'an.chartWeek' : 'an.chartMonth') + '</h3>' +
      '<div class="an-group" role="radiogroup" aria-label="' + esc(t('an.groupBy')) + '">' + ['day', 'week', 'month'].map(function (g) { return '<button type="button" role="radio" aria-checked="' + (group === g) + '" data-group="' + g + '">' + t('an.g_' + g) + '</button>'; }).join('') + '</div>' +
      '<div class="an-legend"><span><i class="sw s1"></i>' + t('an.scans') + '</span><span><i class="sw s2"></i>' + t('an.unique') + '</span></div></div>' +
      (tot ? '' : '<p class="an-none an-zero">' + t('an.noScans') + '</p>') + '<div class="an-plot"></div>' +
      '<details class="an-table"><summary>' + t('an.asTable') + '</summary><div class="an-tw"><table><thead><tr><th>' + t(group === 'day' ? 'an.date' : 'an.g_' + group) + '</th><th>' + t('an.scans') + '</th><th>' + t('an.unique') + '</th></tr></thead><tbody>' +
      grouped(r.series).slice().reverse().filter(function (p) { return p.s; }).map(function (p) { return '<tr><td>' + esc(pointLabel(p, 'short')) + '</td><td>' + i18n.fmt.num(p.s) + '</td><td>' + i18n.fmt.num(p.u) + '</td></tr>'; }).join('') + '</tbody></table></div></details></div>';
  }
  function panel(k, r) {
    var tot = r.totals.scans;
    if (k === 'overview') return chartCard(r) + ranking(r.codes, tot);
    if (k === 'where') return '<div class="an-grid2">' + breakdown('cc', t('an.byCountry'), r.countries, tot, 'globe') + breakdown('city', t('an.byCity'), r.cities, tot, 'globe') + '</div>';
    if (k === 'with') return '<div class="an-grid3">' + donut('os', t('an.byOs'), r.os, tot, 'phone') + donut('dev', t('an.byDevice'), r.devices || [], tot, 'desktop') + donut('br', t('an.byBrowser'), r.browsers || [], tot, 'globe') + '</div>';
    var hasCal = r.series.length >= 14 && tot;
    return when(r) + (hasCal ? calendar(r.series) : '');
  }
  function drawTab() {
    var box = body.querySelector('#anTab'); if (!box) return;
    if (printAll) box.innerHTML = TABS.map(function (k) { return '<h3 class="an-ptitle">' + t('an.tab_' + k) + '</h3>' + panel(k, data); }).join('');
    else box.innerHTML = dashboard(data);
    box.classList.remove('an-in'); void box.offsetWidth; box.classList.add('an-in');
    lineChart(grouped(data.series)); var pl = body.querySelector('.an-plot'); if (pl && !printAll) { pl.classList.add('an-anim'); setTimeout(function () { pl.classList.remove('an-anim'); }, 1700); }   // één keer, niet bij elke schermwijziging
    requestAnimationFrame(fit);
  }

  /* ---------- Detailpagina van één QR-code (klik op de scans in Mijn QR-codes) ---------- */
  var detailId = null;
  function isDetail() { return !!(detailId && f.codes.length === 1 && f.codes[0] === detailId && names[detailId]); }
  function detailHead() {
    var c = names[detailId].code, tp = getType(c.typeId), stat = CodeUtil.isStatic(c), dest = c.content && (c.content.url || c.content.ios || c.content.android) || '';
    var row = function (label, val) { return val ? '<div class="cd-row"><span>' + label + '</span><b>' + val + '</b></div>' : ''; };
    return '<div class="glass cd-head"><div class="cd-qr">' + QRRender.svg(CodeUtil.qrData(c), CodeUtil.qrDesign(c)) + '</div>' +
      '<div class="cd-main"><button type="button" class="link-btn cd-back" data-cd-back>← ' + t('nav.myCodes') + '</button>' +
        '<h2>' + esc(MyCodes.displayName(c)) + '</h2>' +
        '<div class="cd-pills"><span class="cd-pill">' + esc(t('types.' + c.typeId + '.name')) + '</span>' + (stat ? '<span class="cd-pill">' + t('myCodes.static') + '</span>' : '<span class="cd-pill ' + (c.paused ? 'off' : 'on') + '"><i></i>' + t(c.paused ? 'myCodes.offLabel' : 'myCodes.onLabel') + '</span>') +
          (c.labels || []).map(function (l) { return '<span class="cd-pill tag">#' + esc(l) + '</span>'; }).join('') + '</div>' +
        '<div class="cd-rows">' + (stat ? '' : row(t('cd.link'), '<a href="' + esc(c.shortUrl || '') + '" target="_blank" rel="noopener">' + esc(String(c.shortUrl || '').replace(/^https?:\/\//, '')) + '</a>')) +
          row(t('cd.dest'), dest ? esc(String(dest).replace(/^https?:\/\//, '').slice(0, 80)) : '') +
          row(t('cd.made'), esc(i18n.fmt.stamp(c.createdAt, 'long'))) +
          row(t('cd.lastScan'), c.lastScanAt ? esc(i18n.fmt.stamp(c.lastScanAt, 'long')) : t('cd.never')) +
          row(t('cd.total'), i18n.fmt.num(c.scans || 0)) +
          (c.content && c.content.starts ? row(t('fields.starts'), esc(c.content.starts)) : '') + (c.content && c.content.expires ? row(t('fields.expires'), esc(c.content.expires)) : '') +
          (c.note ? row(t('labels.note'), esc(c.note)) : '') + '</div>' +
        '<div class="cd-acts"><button type="button" class="btn primary sm" data-cd="edit">' + ico('pen') + t('myCodes.edit') + '</button>' +
          '<button type="button" class="btn ghost sm" data-cd="png">' + ico('dl') + 'PNG</button><button type="button" class="btn ghost sm" data-cd="svg">' + ico('dl') + 'SVG</button>' +
          '<button type="button" class="btn ghost sm" data-cd="labels">' + t('labels.menu') + '</button>' + (stat ? '' : '<button type="button" class="btn ghost sm" data-cd="copy">' + t('myCodes.copy') + '</button>') + '</div>' +
      '</div></div>';
  }

  /* ---------- Detailpagina: kaart en logboek per scan ---------- */
  var scansD = null, scansSeq = 0, world = null, mapView = null, cities = null, provs = null, provsBusy = false, hiWorld = null, hiBusy = false;
  var MW = 2000;   // breedte van de kaart (zelfde schaal als assets/world.json)
  function mx(lon) { return (lon + 180) / 360 * MW; }
  function my(lat) { lat = Math.max(-85, Math.min(85, lat)); return (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 * MW; }
  function WORLD_VIEW() { var y0 = my(75), y1 = my(-56); return [0, (y0 + y1) / 2 - MW / 4, MW, MW / 2]; }   // hele wereld: van Groenland tot onder Zuid-Amerika
  function scansQuery(extra) { return Object.assign({ code: detailId }, query(), extra || {}); }
  function loadScans() {
    var my2 = ++scansSeq, box = document.getElementById('anDetail'); if (!box) return;
    if (!scansD) box.innerHTML = '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    var w = world ? Promise.resolve(world) : fetch('assets/world.json?v=3').then(function (r) { return r.json(); }).then(function (j) { world = j; return j; }).catch(function () { return null; });
    if (!cities) fetch('assets/cities.json?v=1').then(function (r) { return r.json(); }).then(function (j) { cities = j.c || []; if (scansD) drawMap(); }).catch(function () { cities = []; });   // plaatsnamen bij inzoomen
    Promise.all([api.analyticsScans(scansQuery({ limit: 50 })), w]).then(function (res) {
      if (my2 !== scansSeq) return; scansD = res[0]; mapView = null; drawDetail();
    }).catch(function () { var b = document.getElementById('anDetail'); if (b) b.innerHTML = '<p class="acct-msg bad">' + t('myCodes.failed') + '</p>'; });
  }
  function drawDetail() {
    var box = document.getElementById('anDetail'); if (!box || !scansD) return;
    box.innerHTML = mapCard() + logCard();
    drawMap();
  }
  // Stippen: alle scans uit de statistiek (zelfde getallen als de rest van de pagina). Plaats uit het logboek;
  // oudere scans (van vóór het logboek) zonder coördinaten: in het midden van het land, gemarkeerd als "bij benadering".
  function mapPoints() {
    var byK = {}, out = [], cen = {}, seen = {};
    (scansD.points || []).forEach(function (p) { byK[p.cc + '|' + p.city] = p; });
    if (world) world.countries.forEach(function (c) { if (c.c) cen[c.c] = c; });
    ((data && data.cities) || []).forEach(function (r) {
      var k = String(r.k || ''), cc = k.split('|')[0], city = k.split('|')[1] || '', lp = byK[k];
      if (lp) { out.push({ cc: cc, city: city, region: lp.region, x: mx(lp.lon), y: my(lp.lat), n: Math.max(r.s || 0, lp.n), u: Math.max(r.u || 0, lp.u) }); seen[k] = 1; return; }
      if (!cc || !cen[cc]) return;
      var i = (seen['#' + cc] = (seen['#' + cc] || 0) + 1) - 1, a = i * 2.4, d = i ? 6 + 4 * Math.sqrt(i) : 0;   // meer plaatsen in hetzelfde land: een klein stukje uit elkaar
      out.push({ cc: cc, city: city, region: '', x: cen[cc].x + Math.cos(a) * d, y: cen[cc].y + Math.sin(a) * d, n: r.s || 0, u: r.u || 0, approx: true });
    });
    (scansD.points || []).forEach(function (p) { var k = p.cc + '|' + p.city; if (!seen[k]) out.push({ cc: p.cc, city: p.city, region: p.region, x: mx(p.lon), y: my(p.lat), n: p.n, u: p.u }); });
    return out.filter(function (p) { return p.n > 0; });
  }
  function mapCard() {
    var pts = mapPoints();
    return '<div class="an-card glass cd-map"><div class="an-chead"><h3>' + ico('globe', 'an-hi') + t('cd.mapTitle') + '</h3>' +
      (pts.length ? '<div class="cd-mapbtns"><button type="button" class="btn ghost sm" data-map="in" aria-label="' + esc(t('cd.zoomIn')) + '">+</button><button type="button" class="btn ghost sm" data-map="out" aria-label="' + esc(t('cd.zoomOut')) + '">−</button>' +
        '<button type="button" class="btn ghost sm" data-map="fit">' + t('cd.fit') + '</button><button type="button" class="btn ghost sm" data-map="world">' + t('cd.world') + '</button></div>' : '') + '</div>' +
      (world ? '<div class="cd-mapbox"><svg class="cd-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + esc(t('cd.mapTitle')) + '"></svg><div class="cd-tip" hidden></div></div>' : '') +
      (pts.length ? '<p class="cd-maplead">' + t('cd.mapLead', { n: i18n.fmt.num(pts.length) }) + ' <span class="cd-credit">' + esc(t('cd.placesCredit')) + '</span></p>' : '<p class="an-none">' + t('cd.mapNone') + '</p>') + '</div>';
  }
  function fitView(pts) {
    if (!pts.length) return WORLD_VIEW();
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var w = Math.max(x1 - x0, 60), h = Math.max(y1 - y0, 30), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    w *= 1.6; h *= 1.6; if (w / h < 2) w = h * 2; else h = w / 2;      // kaart is 2:1
    return [cx - w / 2, cy - h / 2, w, h];
  }
  function drawMap() {
    var svgEl = body.querySelector('.cd-svg'); if (!svgEl || !world) return;
    var pts = mapPoints(), v = mapView || (mapView = clampView(fitView(pts))), withScans = {};
    pts.forEach(function (p) { withScans[p.cc] = (withScans[p.cc] || 0) + p.n; });
    var cw = svgEl.clientWidth || 800, px = v[2] / cw, sz = cw < 500 ? .65 : 1, max = Math.max.apply(null, pts.map(function (p) { return p.n; }).concat([1]));
    svgEl.setAttribute('viewBox', v.map(function (n) { return n.toFixed(1); }).join(' '));
    svgEl.innerHTML = '<rect x="-4000" y="-4000" width="10000" height="10000" class="cd-sea"/>' +
      landPaths(v, px, withScans) +
      provLines(v, px) + cityLabels(v, px, pts) +
      pts.slice().sort(function (a, b) { return b.n - a.n; }).map(function (p, i) {
        // Speld (druppelvorm) met de punt precies op de plaats; altijd even groot op het scherm, hoe ver je ook inzoomt
        var h = (24 + 10 * Math.sqrt(p.n / max)) * sz * px;
        return '<g class="cd-dot" data-pt="' + i + '" data-cc="' + esc(p.cc) + '" data-city="' + esc(p.city) + '" transform="translate(' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ') scale(' + h.toFixed(4) + ')">' +
          '<ellipse cx="0" cy="0" rx=".22" ry=".07" class="cd-shadow"/>' +
          '<path d="' + PIN + '" class="cd-pin' + (p.approx ? ' approx' : '') + '" vector-effect="non-scaling-stroke"/><circle cx="0" cy="-.66" r=".15" class="cd-pin-eye"/></g>';
      }).join('');
    svgEl._pts = pts.slice().sort(function (a, b) { return b.n - a.n; });
  }
  /* Landen: normaal de lichte wereldkaart; ingezoomd een scherpere versie (kust en grenzen niet meer blokkerig). Bron: Natural Earth. */
  function landPaths(v, px, withScans) {
    var title = function (cc, n) { return '<title>' + esc(cc ? TEL.name(cc) || n : n) + (withScans[cc] ? ' · ' + t('cd.scansN', { n: i18n.fmt.num(withScans[cc]) }) : '') + '</title>'; };
    if (v[2] <= MW / 4 && !hiWorld && !hiBusy) { hiBusy = true; fetch('assets/world-hi.json?v=1').then(function (r) { return r.json(); }).then(function (j) { hiWorld = j; drawMap(); }).catch(function () { hiBusy = false; }); }
    if (v[2] <= MW / 4 && hiWorld) {
      var q = hiWorld.q, x0 = v[0] * q, y0 = v[1] * q, x1 = (v[0] + v[2]) * q, y1 = (v[1] + v[3]) * q;
      return '<g transform="scale(' + (1 / q) + ')">' + hiWorld.c.filter(function (c) { return !(c[4] < x0 || c[2] > x1 || c[5] < y0 || c[3] > y1); }).map(function (c) {
        return '<path d="' + c[6] + '" class="cd-land' + (withScans[c[0]] ? ' on' : '') + '" vector-effect="non-scaling-stroke" style="stroke-width:.8px">' + title(c[0], c[1]) + '</path>';
      }).join('') + '</g>';
    }
    return world.countries.map(function (c) { return '<path d="' + c.d + '" class="cd-land' + (withScans[c.c] ? ' on' : '') + '" stroke-width="' + (px * .8).toFixed(2) + '">' + title(c.c, c.n) + '</path>'; }).join('');
  }
  /* Grenzen van provincies/regio's: pas zichtbaar als je inzoomt (bestand wordt dan pas geladen). Bron: Natural Earth (publiek domein). */
  function provLines(v, px) {
    if (v[2] > MW / 4) return '';
    if (!provs) { if (!provsBusy) { provsBusy = true; fetch('assets/provinces.json?v=1').then(function (r) { return r.json(); }).then(function (j) { provs = j; drawMap(); }).catch(function () { provsBusy = false; }); } return ''; }
    var q = provs.q, x0 = v[0] * q, y0 = v[1] * q, x1 = (v[0] + v[2]) * q, y1 = (v[1] + v[3]) * q, d = '';
    for (var i = 0; i < provs.l.length; i++) { var l = provs.l[i]; if (l[2] < x0 || l[0] > x1 || l[3] < y0 || l[1] > y1) continue; d += l[4]; }
    return d ? '<path d="' + d + '" transform="scale(' + (1 / q) + ')" class="cd-prov" vector-effect="non-scaling-stroke"/>' : '';
  }
  var PIN = 'M0 0C-.1-.2-.36-.42-.36-.66A.36.36 0 1 1 .36-.66C.36-.42.1-.2 0 0Z';   // druppel/speld, hoogte 1, punt op (0,0)
  /* Plaatsnamen bij inzoomen: hoe verder ingezoomd, hoe meer (kleinere) plaatsen. Nooit over elkaar heen.
     Plaatsen met scans krijgen altijd hun naam naast de speld. Bron: GeoNames (CC BY 4.0). */
  function cityLabels(v, px, pts) {
    var w = v[2]; if (!cities || w > MW / 2.2) return '';
    var minPop = w > MW / 5 ? 3000 : w > MW / 10 ? 1000 : w > MW / 25 ? 400 : w > MW / 60 ? 150 : 40;   // in duizenden inwoners
    var fs = 11 * px, used = [], out = '';
    var free = function (x, y, tw) { var b = [x - 4 * px, y - fs, x + tw, y + 4 * px]; if (used.some(function (u) { return !(b[2] < u[0] || b[0] > u[2] || b[3] < u[1] || b[1] > u[3]); })) return false; used.push(b); return true; };
    // Eerst de plaatsen met scans (naam naast de speld)
    pts.forEach(function (p) {
      if (!p.city || p.approx) return; var tw = p.city.length * fs * .6 + 6 * px, x = p.x + 12 * px, y = p.y - 8 * px;
      if (free(x, y, tw)) out += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" class="cd-city cd-city-hit" style="font-size:' + fs.toFixed(2) + 'px">' + esc(p.city) + '</text>';
    });
    var x0 = v[0], y0 = v[1], x1 = v[0] + v[2], y1 = v[1] + v[3];
    for (var i = 0; i < cities.length && used.length < 60; i++) {
      var c = cities[i]; if (c[3] < minPop) break;                     // lijst staat op inwoners (groot naar klein)
      if (c[1] < x0 || c[1] > x1 || c[2] < y0 || c[2] > y1) continue;
      var tw2 = c[0].length * fs * .58 + 8 * px, tx = c[1] + 5 * px, ty = c[2] + 4 * px;
      if (!free(c[1] - 3 * px, ty, tw2 + 5 * px)) continue;
      out += '<circle cx="' + c[1] + '" cy="' + c[2] + '" r="' + (2.2 * px).toFixed(2) + '" class="cd-cdot"/><text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" class="cd-city" style="font-size:' + fs.toFixed(2) + 'px">' + esc(c[0]) + '</text>';
    }
    return '<g class="cd-cities" aria-hidden="true">' + out + '</g>';
  }
  // Kaart altijd binnen de wereld houden (nooit 'weg' slepen of uitzoomen)
  function clampView(v) {
    var top = world ? world.top : 60, bottom = world ? world.h : 1420, w = Math.min(v[2], MW), h = Math.min(w / 2, bottom - top); w = h * 2;
    return [Math.max(0, Math.min(MW - w, v[0])), Math.max(top, Math.min(bottom - h, v[1])), w, h];
  }
  function zoomMap(f, cx, cy) {
    if (!mapView) return; var v = mapView, w = Math.min(MW * 1.2, Math.max(25, v[2] * f)), h = w / 2;
    cx = cx == null ? v[0] + v[2] / 2 : cx; cy = cy == null ? v[1] + v[3] / 2 : cy;
    mapView = clampView([cx - w / 2, cy - h / 2, w, h]); drawMap();
  }
  function logCard() {
    var rows = scansD.scans || [];
    var place = function (s) { return '<span class="cd-place"><i>' + (s.cc ? TEL.flag(s.cc) : '🌐') + '</i><span><b>' + esc(s.city || t('an.unknown')) + '</b><small>' + esc([s.region && s.region !== s.city ? s.region : '', s.cc ? TEL.name(s.cc) : ''].filter(Boolean).join(', ')) + '</small></span></span>'; };
    return '<div class="an-card glass cd-log"><div class="an-chead"><h3>' + ico('clock', 'an-hi') + t('cd.logTitle') + '</h3>' +
      (rows.length ? '<button type="button" class="btn ghost sm" data-log-csv>' + ico('dl') + t('cd.exportLog') + '</button>' : '') + '</div>' +
      '<p class="cd-loglead">' + t('cd.logLead', { n: i18n.fmt.num(scansD.total || 0) }) + '</p>' +
      (rows.length ? '<div class="cd-tw"><table class="cd-table"><thead><tr><th>' + t('cd.when') + '</th><th>' + t('cd.place') + '</th><th>' + t('cd.device') + '</th><th>' + t('cd.browser') + '</th><th>' + t('cd.visitor') + '</th></tr></thead><tbody>' +
        rows.map(function (s) {
          return '<tr><td><b>' + esc(i18n.fmt.stamp(s.at, 'time')) + '</b></td><td>' + place(s) + '</td><td>' + esc(devName(s.dev)) + ' · ' + esc(osName(s.os)) + '</td><td>' + esc(brName(s.br)) + '</td>' +
            '<td><span class="cd-vis ' + (s.uniq ? 'new' : 'back') + '">' + t(s.uniq ? 'cd.new' : 'cd.back') + '</span></td></tr>';
        }).join('') + '</tbody></table></div>' + (scansD.more ? '<div class="cd-more"><button type="button" class="btn ghost sm" data-log-more>' + t('cd.more') + '</button></div>' : '')
        : '<p class="an-none">' + t('cd.logNone') + '</p>') + '</div>';
  }
  function moreScans(btn) {
    var last = scansD.scans[scansD.scans.length - 1]; if (!last) return; btn.disabled = true;
    api.analyticsScans(scansQuery({ limit: 100, before: last.at })).then(function (r) { scansD.scans = scansD.scans.concat(r.scans || []); scansD.more = r.more; var c = body.querySelector('.cd-log'); if (c) c.outerHTML = logCard(); })
      .catch(function () { btn.disabled = false; });
  }
  function exportLog() {
    var all = [], step = function (before) {
      return api.analyticsScans(scansQuery({ limit: 500, before: before || '' })).then(function (r) { all = all.concat(r.scans || []); return r.more && all.length < 5000 ? step(all[all.length - 1].at) : all; });
    };
    step('').then(function (list) {
      var q = function (v) { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var head = [t('cd.when'), t('cd.city'), t('cd.region'), t('cd.country'), t('an.devices'), t('an.os'), t('cd.browser'), t('cd.visitor')];
      var lines = [head.map(q).join(';')].concat(list.map(function (s) { return [i18n.fmt.stamp(s.at, 'time'), s.city, s.region, s.cc ? TEL.name(s.cc) : '', devName(s.dev), osName(s.os), brName(s.br), t(s.uniq ? 'cd.new' : 'cd.back')].map(q).join(';'); }));
      var name = names[detailId] ? CodeUtil.fileName(names[detailId].code) : 'qr-code';
      saveFile(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), name + '-scans.csv');
    });
  }
  // Klik op een stip: venster met alles van die plaats (aantallen, apparaten, systemen, browsers, laatste scans)
  function placeInfo(p) {
    var dlg = document.getElementById('mcDialog'), key = p.cc + '|' + p.city;
    var where = esc(p.city || t('an.unknown')) + (p.cc ? ', ' + esc(TEL.name(p.cc)) : '');
    var shell = function (inner) {
      dlg.innerHTML = '<form method="dialog" class="mc-dlg pl-dlg"><span class="mc-dlg-ic">' + (p.cc ? TEL.flag(p.cc) : '🌐') + '</span><h3>' + where + '</h3>' + (p.region && p.region !== p.city ? '<p class="pl-sub">' + esc(p.region) + '</p>' : '') + inner +
        '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('legal.close') + '</button><button class="btn primary" value="filter">' + t('cd.filterPlace') + '</button></div></form>';
    };
    shell('<p class="muted-msg">' + t('myCodes.loading') + '</p>');
    dlg.onclose = function () { if (dlg.returnValue === 'filter') { f.cc = [p.cc]; f.city = [key]; whereDim = 'city'; window.scrollTo({ top: 0, behavior: 'smooth' }); load(); } };
    dlg.returnValue = ''; dlg.showModal();
    api.analyticsScans(scansQuery({ cc: p.cc, city: key, limit: 500 })).then(function (r) {
      var rows = r.scans || [], count = function (k, nm) { var o = {}; rows.forEach(function (s) { o[s[k]] = (o[s[k]] || 0) + 1; }); return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).map(function (x) { return '<li><span>' + esc(nm(x)) + '</span><b>' + i18n.fmt.num(o[x]) + '</b></li>'; }).join(''); };
      var last = rows.length ? rows[0].at : null, uniq = rows.filter(function (s) { return s.uniq; }).length;
      var tiles = '<div class="pl-tiles"><div><b>' + i18n.fmt.num(p.n) + '</b><small>' + t('an.scans') + '</small></div><div><b>' + i18n.fmt.num(Math.max(p.u || 0, uniq)) + '</b><small>' + t('an.unique') + '</small></div>' +
        '<div><b>' + (last ? esc(i18n.fmt.stamp(last, 'time')) : '–') + '</b><small>' + t('cd.lastScan') + '</small></div></div>';
      if (!rows.length) return shell(tiles + '<p class="pl-note">' + t('cd.placeOld') + '</p>');
      shell(tiles + '<div class="pl-cols"><div><h4>' + t('an.devices') + '</h4><ul>' + count('dev', devName) + '</ul></div><div><h4>' + t('an.os') + '</h4><ul>' + count('os', osName) + '</ul></div><div><h4>' + t('an.browsers') + '</h4><ul>' + count('br', brName) + '</ul></div></div>' +
        '<h4 class="pl-h">' + t('cd.lastScans') + '</h4><ul class="pl-last">' + rows.slice(0, 8).map(function (s) { return '<li><span>' + esc(i18n.fmt.stamp(s.at, 'time')) + '</span><span>' + esc(devName(s.dev)) + ' · ' + esc(osName(s.os)) + ' · ' + esc(brName(s.br)) + '</span><em class="cd-vis ' + (s.uniq ? 'new' : 'back') + '">' + t(s.uniq ? 'cd.new' : 'cd.back') + '</em></li>'; }).join('') + '</ul>' +
        (p.n > rows.length ? '<p class="pl-note">' + t('cd.placeSome', { n: i18n.fmt.num(p.n - rows.length) }) + '</p>' : ''));
    }).catch(function () { shell('<p class="acct-msg bad">' + t('myCodes.failed') + '</p>'); });
  }
  // Kaart: muis/vinger (tip, slepen, klik op een plaats = alles van die stad)
  var drag = null;
  body.addEventListener('pointerdown', function (e) { var s = e.target.closest('.cd-svg'); if (!s || e.target.closest('.cd-dot') || !mapView) return; drag = { x: e.clientX, y: e.clientY, v: mapView.slice(), w: s.clientWidth }; s.setPointerCapture(e.pointerId); });
  body.addEventListener('pointermove', function (e) {
    var s = e.target.closest && e.target.closest('.cd-svg');
    if (drag) { var k = drag.v[2] / drag.w; mapView = clampView([drag.v[0] - (e.clientX - drag.x) * k, drag.v[1] - (e.clientY - drag.y) * k, drag.v[2], drag.v[3]]); var sv = body.querySelector('.cd-svg'); if (sv) sv.setAttribute('viewBox', mapView.join(' ')); return; }
    var tip = body.querySelector('.cd-tip'), dot = e.target.closest && e.target.closest('.cd-dot'); if (!tip) return;
    if (!dot || !s) { tip.hidden = true; return; }
    var p = s._pts[+dot.getAttribute('data-pt')], box = s.getBoundingClientRect();
    tip.innerHTML = '<b>' + (p.cc ? TEL.flag(p.cc) + ' ' : '') + esc(p.city || t('an.unknown')) + '</b><small>' + esc([p.region !== p.city ? p.region : '', p.cc ? TEL.name(p.cc) : ''].filter(Boolean).join(', ')) + '</small>' +
      '<span>' + t('cd.scansN', { n: i18n.fmt.num(p.n) }) + (p.u ? ' · ' + t('cd.uniqN', { n: i18n.fmt.num(p.u) }) : '') + '</span>' + (p.approx ? '<small>' + t('cd.approx') + '</small>' : '') + '<em>' + t('cd.clickCity') + '</em>';
    tip.hidden = false; tip.style.left = Math.min(Math.max(e.clientX - box.left, 90), box.width - 90) + 'px'; tip.style.top = (e.clientY - box.top - 12) + 'px';
  });
  body.addEventListener('pointerup', function () { if (drag) { drag = null; drawMap(); } });   // na het slepen: plaatsnamen van het nieuwe stuk kaart
  // Geen zoomen met het scrollwiel: scrollen op de kaart scrolt gewoon de pagina (anders raak je de kaart kwijt)

  /* ---------- Alles tekenen ---------- */
  function draw() {
    var r = data, rg = { from: r.from, to: r.to };
    document.getElementById('anRange').textContent = rg.from === rg.to ? i18n.fmt.date(d(rg.from), 'long') : i18n.fmt.date(d(rg.from), 'long') + ' – ' + i18n.fmt.date(d(rg.to), 'long');
    var demo = document.getElementById('anDemo'); demo.hidden = !r.demo; demo.textContent = t('an.demoNote');
    document.getElementById('anFoot').innerHTML = (r.statsFloor ? '<button type="button" class="link-btn an-lock" data-gate-open="' + (PlanGate.statsDays() < 365 ? 'pro' : 'business') + '" data-gate-reason="stats">' + PlanGate.lock + esc(t('plan.statsFloor', { date: new Date(r.statsFloor + 'T00:00:00').toLocaleDateString(i18n.lang()) })) + '</button> ' : '') + (r.geo ? '' : esc(t('an.noGeo')));   // bronvermelding DB-IP staat in de privacyverklaring (niet hier: geen link die je uit de app haalt)   // bronvermelding DB-IP is verplicht (licentie CC BY 4.0)
    if (!Object.keys(names).length) {
      body.innerHTML = '<div class="mc-empty glass">' + ico('scans') + '<h3>' + t('an.emptyTitle') + '</h3><p>' + t('an.emptyText') + '</p><button type="button" class="btn primary" data-an-new>' + t('myCodes.first') + '</button></div>';
      return;
    }
    body.innerHTML = (isDetail() ? detailHead() : '') + tiles(r) + (isDetail() ? '<div id="anDetail" class="cd-extra"></div>' : '') +   // de samenvattingszin is weg: tegels + ranglijst laten hetzelfde zien

      '<div id="anTab" class="an-tabp"></div>';
    drawTab(); countUp();
    if (isDetail()) loadScans();
  }
  document.addEventListener('plan-info', function () { if (data) { drawFilters(); load(); } });
  function load() {
    var my = ++seq;
    if (!data) body.innerHTML = '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    Promise.all([api.analytics(query()), Object.keys(names).length ? null : api.listQrCodes().catch(function () { return []; })]).then(function (res) {
      if (my !== seq) return;
      data = res[0];
      if (res[1]) res[1].forEach(function (c) { names[c.id] = { label: MyCodes.displayName(c), typeId: c.typeId, code: c }; });
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

  /* Export naar Excel (.xlsx): dezelfde gegevens als de CSV, als echt Excel-bestand (KB Q101, Q110).
     Klein, zonder extra bibliotheek: CSV lezen en een minimaal werkboek in een ZIP zetten. */
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false;
    text = text.replace(/^\uFEFF/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function xlsx(rows) {
    var x = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var col = function (n) { var s = ''; n++; while (n) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      rows.map(function (r, ri) { return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) { var ref = col(ci) + (ri + 1);
        return ri && /^-?\d+(\.\d+)?$/.test(v) ? '<c r="' + ref + '"><v>' + v + '</v></c>' : '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + x(v) + '</t></is></c>'; }).join('') + '</row>'; }).join('') +
      '</sheetData></worksheet>';
    var f = function (name, text) { return { name: name, blob: new Blob([text], { type: 'application/xml' }) }; };
    return CodeUtil.zip([
      f('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
      f('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
      f('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Scans" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      f('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      f('xl/worksheets/sheet1.xml', sheet)
    ]).then(function (b) { return new Blob([b], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); });
  }
  function exportXlsx() {
    api.analyticsCsv(query()).then(function (r) {
      return r.url ? fetch(r.url, { credentials: 'same-origin' }).then(function (x) { if (!x.ok) throw new Error(); return x.text(); }) : r.text;
    }).then(function (text) { return xlsx(parseCsv(text)); })
      .then(function (b) { saveFile(b, 'statistieken-' + (range().from || 'alles') + '.xlsx'); })
      .catch(function () {});
  }

  /* ---------- Bediening ---------- */
  view.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'anPeriod' && periodLocked(el.value)) { var need = periodLocked(el.value); el.value = f.period; PlanGate.upgrade(need, 'stats'); return; }
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
    if (e.target.closest('[data-clear]')) { detailId = null; f.codes = []; f.os = []; f.cc = []; f.city = []; f.br = []; f.dev = []; return load(); }
    if (e.target.closest('[data-more]')) { moreOpen = !moreOpen; openDrop = null; drawFilters(); return requestAnimationFrame(fit); }
    if ((b = e.target.closest('[data-unpick]'))) { var ud = b.getAttribute('data-unpick'), uk = b.getAttribute('data-k'); f[ud] = f[ud].filter(function (v) { return v !== uk; }); return load(); }
    if ((b = e.target.closest('[data-where]'))) { whereDim = b.getAttribute('data-where'); return swapCard(b, whereCard(data), '[data-where="' + whereDim + '"]'); }
    if ((b = e.target.closest('[data-when]'))) { whenDim = b.getAttribute('data-when'); return swapCard(b, whenCard(data), '[data-when="' + whenDim + '"]'); }
    // Doorklikken: land → steden van dat land → alles van die stad; QR-code → detailpagina van die code
    if ((b = e.target.closest('[data-geo-up]'))) { var up = b.getAttribute('data-geo-up'); if (up === 'all') { f.cc = []; f.city = []; whereDim = 'cc'; } else { f.city = []; whereDim = 'city'; } return load(); }
    if ((b = e.target.closest('[data-filter]'))) {
      var k = b.getAttribute('data-filter'), kv = b.getAttribute('data-k');
      if (k === 'codes') { f.codes = [kv]; f.os = []; f.cc = []; f.city = []; f.br = []; f.dev = []; detailId = kv; return goToPage('codeDetail'); }
      f[k] = [kv];
      if (k === 'cc') { f.city = []; whereDim = 'city'; }
      if (k === 'city') { f.cc = [kv.split('|')[0]]; whereDim = 'city'; }
      if (MORE.indexOf(k) >= 0 && k !== 'cc' && k !== 'city') moreOpen = true;
      if (k !== 'cc' && k !== 'city') window.scrollTo({ top: 0, behavior: 'smooth' });
      return load();
    }
    if ((b = e.target.closest('[data-mtab]'))) {
      mtab = b.getAttribute('data-mtab'); body.querySelectorAll('[data-mtab]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      var mp = body.querySelector('#anMPane'); if (mp) mp.innerHTML = mpane(data); b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return;
    }
    if ((b = e.target.closest('[data-xopt]'))) { var xo = b.getAttribute('data-xopt'); view.querySelector('.an-xmenu').hidden = true; return xo === 'pdf' ? report() : xo === 'xlsx' ? exportXlsx() : exportCsv(); }
    if (e.target.closest('#anExport') && compactMq.matches) { var xm = view.querySelector('.an-xmenu'); xm.hidden = !xm.hidden; document.getElementById('anExport').setAttribute('aria-expanded', String(!xm.hidden)); return; }
    if ((b = e.target.closest('[data-group]'))) { group = b.getAttribute('data-group'); return drawTab(); }
    if ((b = e.target.closest('[data-expand]'))) { var x = b.getAttribute('data-expand'); expanded[x] = !expanded[x]; return drawTab(); }
    if (e.target.closest('#anExport')) return exportCsv();
    if (e.target.closest('#anXlsx')) return exportXlsx();
    if (e.target.closest('#anReport')) return report();
    if (e.target.closest('[data-an-new]')) { actions.startNew(); goToPage('create'); }
    if (e.target.closest('[data-cd-back]')) { detailId = null; f.codes = []; f.cc = []; f.city = []; return goToPage('myCodes'); }
    var mb = e.target.closest('[data-map]');
    if (mb && scansD) { var mk = mb.getAttribute('data-map'); if (mk === 'in') zoomMap(.6); else if (mk === 'out') zoomMap(1.6); else { mapView = clampView(mk === 'world' ? WORLD_VIEW() : fitView(mapPoints())); drawMap(); } return; }
    var dt = e.target.closest('.cd-dot');
    if (dt) { var sv = dt.closest('.cd-svg'); return placeInfo(sv._pts[+dt.getAttribute('data-pt')]); }
    if (e.target.closest('[data-log-more]')) return moreScans(e.target.closest('[data-log-more]'));
    if (e.target.closest('[data-log-csv]')) return exportLog();
    var cdb = e.target.closest('[data-cd]');
    if (cdb && isDetail()) {
      var cc = names[detailId].code, k = cdb.getAttribute('data-cd');
      if (k === 'edit') return MyCodes.edit(cc);
      if (k === 'png' || k === 'svg') return CodeUtil.download(cc, k, 1024);
      if (k === 'labels') return MyCodes.labelsOf(cc);
      if (k === 'copy') { if (navigator.clipboard) navigator.clipboard.writeText(cc.shortUrl); cdb.textContent = t('myCodes.copied'); return; }
    }
  });
  view.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openDrop) { var dim = openDrop; openDrop = null; drawFilters(); var btn = bar.querySelector('[data-drop="' + dim + '"]'); if (btn) btn.focus(); } });
  body.addEventListener('pointermove', function (e) { if (e.target.closest('.an-plot')) hover(e); });
  body.addEventListener('pointerleave', unhover, true);
  compactMq.addEventListener('change', function () { if (!view.hidden && data && data.series) drawTab(); });
  document.addEventListener('click', function (e) { var xm = view.querySelector('.an-xmenu'); if (xm && !xm.hidden && !e.target.closest('.an-acts')) xm.hidden = true; });
  addEventListener('resize', function () { clearTimeout(fit.t); fit.t = setTimeout(function () { if (!view.hidden && data && data.series) { lineChart(grouped(data.series)); fit(); } }, 80); });

  function labels() {
    var xm = view.querySelector('.an-xmenu'); if (!xm) { xm = document.createElement('div'); xm.className = 'an-xmenu'; xm.hidden = true; xm.setAttribute('role', 'menu'); view.querySelector('.an-acts').appendChild(xm); }
    xm.innerHTML = [['pdf', 'an.report'], ['csv', 'an.export'], ['xlsx', 'an.excel']].map(function (o) { return '<button type="button" role="menuitem" data-xopt="' + o[0] + '">' + ico('dl') + esc(t(o[1])) + '</button>'; }).join('');
    document.getElementById('anExport').setAttribute('data-short', t('an.exportShort'));
    document.getElementById('anExport').innerHTML = ico('dl') + '<span class="an-xl">' + t('an.export') + '</span><span class="an-xs">' + t('an.exportShort') + '</span>'; var xb = document.getElementById('anXlsx'); if (xb) xb.innerHTML = ico('dl') + t('an.excel'); var rp = document.getElementById('anReport'); if (rp) rp.innerHTML = ico('dl') + t('an.report'); }
  /* Rapport: de pagina netjes afdrukken; in het afdrukvenster kies je "Opslaan als PDF" */
  function report() {
    document.body.classList.add('an-printing'); printAll = true; if (data) drawTab();
    var done = function () { if (!printAll) return; printAll = false; document.body.classList.remove('an-printing'); removeEventListener('afterprint', done); if (data) drawTab(); };
    addEventListener('afterprint', done);
    setTimeout(function () { window.print(); setTimeout(done, 1000); }, 50);
  }
  labels();
  document.addEventListener('pagechange', function (e) {
    var head = view.querySelector('.an-head h2');
    if (e.detail === 'analytics') { if (detailId) { detailId = null; f.codes = []; f.cc = []; f.city = []; } if (head) head.textContent = t('nav.analytics'); view.classList.remove('is-detail'); names = {}; load(); }
    if (e.detail === 'codeDetail') { if (head) head.textContent = t('cd.pageTitle'); view.classList.add('is-detail'); data = null; scansD = null; mapView = null; names = {}; window.scrollTo(0, 0); load(); }   // altijd vers: nooit eerst de oude statistiek
  });
  i18n.onChange(function () { labels(); var hd = view.querySelector('.an-head h2'); if (hd && detailId) hd.textContent = t('cd.pageTitle'); if (!view.hidden && data) { drawFilters(); draw(); } });

  // Vanuit Mijn QR-codes: meteen de statistieken van één code
  return { open: function (opts) { f.codes = (opts && opts.codes) || []; f.os = []; f.cc = []; f.city = []; f.br = []; f.dev = []; detailId = opts && opts.detail && f.codes.length === 1 ? f.codes[0] : null; goToPage(detailId ? 'codeDetail' : 'analytics'); } };
})();
