/* =========================================================
   OVERZICHT (dashboard voor klanten) — de startpagina na het inloggen
   In één oogopslag (ontwerp van Fabian):
   - Titel + periode (vandaag / 7 / 30 / 90 dagen; vandaag = per uur, vergeleken met gisteren) + knop "QR-code maken"
   - Vier tegels: QR-codes, scans, unieke scans (met verschil t.o.v. de periode ervoor), scans vandaag
   - Rij 1: scanactiviteit (staafjes, tooltip, tabel) | recente activiteit
   - Rij 2: favorieten als tabel (code, status, scans) | meest gescand
   - Onderaan: © QR-Codex · Privacy en voorwaarden
   - Nog geen codes? Dan een welkom met de eerste stappen.
   Admins beginnen op het Dashboard van Beheer, maar kunnen dit ook openen.
   ========================================================= */
var Home = (function () {
  var view = document.getElementById('homeView'), body = document.getElementById('homeBody');
  var codes = null, stats = null, statsP = null, acts = null, me = null, seq = 0, period = 30, plan = null;
  try { var sp = +localStorage.getItem('home.period'); if ([1, 7, 30, 90].indexOf(sp) >= 0) period = sp; } catch (e) {}
  var SVG = function (p, cls) { return '<svg class="' + (cls || 'hm-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var IC = {
    plus: '<path d="M12 5v14M5 12h14"/>', codes: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    chart: '<path d="M5 20V12M10 20V5M15 20v-9M20 20V9M2 21h20"/>', scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.4-4 4.4-6 8-6s6.6 2 8 6"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    star: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>', trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', up: '<path d="M7 14l5-5 5 5"/>', down: '<path d="M7 10l5 5 5-5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', arrow: '<path d="M9 6l6 6-6 6"/>',
    // Tegels van het overzicht (eigen iconen, met een kleine animatie bij aanwijzen; zie .hx-* in app.css)
    folder: '<path class="hx-back" d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2.2h8.7A1.5 1.5 0 0 1 21 8.7V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/><path class="hx-front" d="M3 10.2h18V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>',
    qrscan: '<path d="M3.5 8V5A1.5 1.5 0 0 1 5 3.5h3M16 3.5h3A1.5 1.5 0 0 1 20.5 5v3M20.5 16v3a1.5 1.5 0 0 1-1.5 1.5h-3M8 20.5H5A1.5 1.5 0 0 1 3.5 19v-3"/><rect x="7" y="7" width="4" height="4" rx=".6"/><rect x="13" y="7" width="4" height="4" rx=".6"/><rect x="7" y="13" width="4" height="4" rx=".6"/><path d="M13.5 13.5h1.5v1.5h-1.5zM16 16h1v1h-1zM13.5 16.5h.5"/><line class="hx-line" x1="2.5" x2="21.5" y1="12" y2="12"/>',
    frame: '<path d="M3.5 8V5A1.5 1.5 0 0 1 5 3.5h3M16 3.5h3A1.5 1.5 0 0 1 20.5 5v3M20.5 16v3a1.5 1.5 0 0 1-1.5 1.5h-3M8 20.5H5A1.5 1.5 0 0 1 3.5 19v-3"/><rect class="hx-box" x="7.5" y="7" width="9" height="8" rx="1"/><path class="hx-base" d="M5 18h14"/>',
    sun2: '<circle class="hx-core" cx="12" cy="12" r="3.6"/><g class="hx-rays"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g>',
    star2: '<path class="hx-star" d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>'
  };
  var ico = function (k, cls) { return SVG(IC[k], cls); };
  function iso(d) { return d.toISOString().slice(0, 10); }
  function day(s) { return new Date(s + 'T12:00:00'); }
  function ago(iso) { return window.Admin ? Admin.ago(iso) : i18n.fmt.stamp(iso, 'time'); }
  function name(r) { return window.CodeUtil ? CodeUtil.displayName(r) : (r.name || r.id); }
  function isStatic(r) { return window.CodeUtil ? CodeUtil.isStatic(r) : false; }

  /* ---------- Gegevens ---------- */
  function load() {
    var my = ++seq, to = new Date(), from = new Date(Date.now() - (period * 2 - 1) * 864e5);   // ook de periode ervoor (om te vergelijken)
    if (!codes) body.innerHTML = '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    Promise.all([
      api.listQrCodes().catch(function () { return []; }),
      api.analytics({ from: iso(from), to: iso(to), codes: [], os: [], cc: [], city: [] }).catch(function () { return null; }),
      api.analytics({ from: iso(new Date(Date.now() - (period - 1) * 864e5)), to: iso(to), codes: [], os: [], cc: [], city: [], tz: i18n.fmt.zone() }).catch(function () { return null; }),
      api.account.activity ? api.account.activity().catch(function () { return { activity: [] }; }) : Promise.resolve({ activity: [] }),
      api.account.plan ? api.account.plan().catch(function () { return null; }) : Promise.resolve(null)
    ]).then(function (r) {
      if (my !== seq) return;
      codes = r[0] || []; stats = r[1]; statsP = r[2]; acts = (r[3] && r[3].activity) || []; plan = r[4];
      draw();
    });
  }

  /* ---------- Onderdelen ---------- */
  function greeting() {
    var h = 12; try { h = +new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: i18n.fmt.zone() }).format(new Date()); } catch (e) {}
    var k = h < 6 ? 'home.night' : h < 12 ? 'home.morning' : h < 18 ? 'home.afternoon' : 'home.evening';
    var first = String((me && me.name) || '').trim().split(/\s+/)[0];
    return t(first ? k : k + 'Plain', { name: first });
  }
  function quickActions() {
    return '<div class="hm-acts"><button type="button" class="btn primary" data-hm-new>' + ico('plus') + t('myCodes.new') + '</button>' +
      '<button type="button" class="btn ghost" data-goto="myCodes">' + ico('codes') + t('nav.myCodes') + '</button>' +
      '<button type="button" class="btn ghost" data-goto="analytics">' + ico('chart') + t('nav.analytics') + '</button></div>';
  }
  function series30() {
    var s = (stats && stats.series) || [], by = {};
    s.forEach(function (p) { by[p.d] = p; });
    var out = [], prev = { s: 0, u: 0 };
    for (var i = period * 2 - 1; i >= 0; i--) {
      var d = iso(new Date(Date.now() - i * 864e5)), p = by[d] || { d: d, s: 0, u: 0 };
      if (i >= period) { prev.s += p.s; prev.u += p.u; } else out.push({ d: d, s: p.s, u: p.u });
    }
    var yd = by[iso(new Date(Date.now() - 864e5))] || { s: 0, u: 0 };
    var hours = null;
    if (period === 1) {                                                     // "Vandaag": per uur, dan zie je de dag zelf
      var hs = (statsP && statsP.insights && statsP.insights.hours) || null;
      if (hs) hours = hs.map(function (n, h) { return { h: h, s: n, u: n }; });
    }
    return { days: hours || out, prev: prev, today: out[out.length - 1] || { s: 0, u: 0 }, yesterday: yd, hourly: !!hours };
  }
  function tiles(sr) {
    var cur = sr.days.reduce(function (a, p) { a.s += p.s; a.u += p.u; return a; }, { s: 0, u: 0 }), today = sr.today;
    if (sr.hourly) cur = { s: (statsP && statsP.totals.scans) || 0, u: (statsP && statsP.totals.unique) || 0 };
    var dyn = codes.filter(function (r) { return !isStatic(r); }), off = dyn.filter(function (r) { return r.paused; }).length;
    var vsLong = period === 1 ? t('home.vsYesterday') : t('home.vsPrevN', { n: period }), vsShort = period === 1 ? t('home.vsYesterdayShort') : t('home.vsPrevShortN', { n: period });
    var trend = function (now, before, lng, sht) {
      lng = lng || vsLong; sht = sht || vsShort;
      if (!before && !now) return '<em class="hm-trend flat">' + t('home.noChange') + '</em>';
      if (!before) return '<em class="hm-trend t-up" title="' + esc(lng) + '">' + ico('up', 'hm-ti') + '+' + i18n.fmt.num(now) + '<span>' + sht + '</span></em>';   // vorige periode 0: "+37 vs. vorige 30 d." i.p.v. "Nieuw"
      var pct = Math.round((now - before) / before * 100);
      return '<em class="hm-trend ' + (pct > 0 ? 't-up' : pct < 0 ? 't-down' : 'flat') + '" title="' + esc(lng) + '">' + (pct ? ico(pct > 0 ? 'up' : 'down', 'hm-ti') : '') + (pct > 0 ? '+' : '') + pct + '%<span>' + sht + '</span></em>';
    };
    var tile = function (cls, icon, label, value, extra) { return '<div class="hm-tile glass ' + cls + '"><span class="hm-tic">' + ico(icon) + '</span><small>' + label + '</small><b>' + value + '</b>' + (extra || '') + '</div>'; };
    var active = codes.filter(function (r) { return !r.paused; }).length;
    return '<div class="hm-tiles">' +
      tile('t-codes', 'folder', t('home.tCodesAll'), i18n.fmt.num(codes.length)) +
      tile('t-scans', 'qrscan', t('home.tScansAll'), i18n.fmt.num(cur.s), trend(cur.s, sr.prev.s)) +
      tile('t-uniq', 'frame', t('home.tUniqueAll'), i18n.fmt.num(cur.u), trend(cur.u, sr.prev.u)) +
      tile('t-today', 'sun2', t('home.tToday'), i18n.fmt.num(today.s), trend(today.s, sr.yesterday.s, t('home.vsYesterday'), t('home.vsYesterdayShort'))) + '</div>';
  }
  // Staafgrafiek: één reeks (scans), dus geen legenda: de titel zegt wat het is
  function chart(sr) {
    var days = sr.days, max = Math.max.apply(null, days.map(function (p) { return p.s; }).concat([1]));
    var stepv = max <= 4 ? 1 : Math.ceil(max / 4 / Math.pow(10, Math.floor(Math.log10(max / 4)))) * Math.pow(10, Math.floor(Math.log10(max / 4)));
    var top = Math.ceil(max / stepv) * stepv, W = 720, H = 150, L = 34, R = 6, T = 10, B = 26, iw = W - L - R, ih = H - T - B, n = days.length, bw = iw / n;
    var grid = ''; for (var v = 0; v <= top; v += stepv) { var y = T + ih - v / top * ih; grid += '<line class="an-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text class="an-ax" x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + i18n.fmt.num(v) + '</text>'; }
    var bars = days.map(function (p, i) {
      var h = p.s ? Math.max(3, p.s / top * ih) : 0, x = L + i * bw + 1.5, w = Math.max(2, bw - 3), y = T + ih - h, r = Math.min(4, w / 2, h);
      var path = h ? 'M' + x + ' ' + (T + ih) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (T + ih) + 'Z' : '';
      return (path ? '<path class="hm-bar' + (i === n - 1 && !sr.hourly ? ' today' : '') + '" d="' + path + '"/>' : '') +
        '<rect class="hm-hit" data-i="' + i + '" x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + ih + '" fill="transparent"/>';
    }).join('');
    var labels = sr.hourly ? days.map(function (p, i) { return i % 3 === 0 ? '<text class="an-ax" x="' + (L + i * bw + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + String(p.h).padStart(2, '0') + ':00</text>' : ''; }).join('') : days.map(function (p, i) { return (i % 7 === 0 && i <= n - 4) || i === n - 1 ? '<text class="an-ax" x="' + (L + i * bw + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(i18n.fmt.date(day(p.d), 'dshort')) + '</text>' : ''; }).join('');
    var total = days.reduce(function (a, p) { return a + p.s; }, 0);
    return '<div class="hm-card glass hm-chart"><div class="hm-head"><h3>' + t('home.scanActivity') + '</h3><button type="button" class="link-btn" data-goto="analytics">' + t('home.viewAnalytics') + ico('arrow', 'hm-ti') + '</button></div>' +
      (total ? '' : '<p class="hm-none">' + t(period === 30 ? 'home.noScans30' : 'an.noScans') + '</p>') +
      '<div class="hm-plot"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('home.chartTitle')) + '">' + grid + bars + labels + '</svg><div class="an-tt" hidden></div></div>' +
      '<div class="hm-cfoot"><span><i class="sw s1"></i>' + t('home.totalScans') + '</span></div>' +
      '<details class="an-table"><summary>' + t('an.asTable') + '</summary><div class="an-tw"><table><thead><tr><th>' + t('an.date') + '</th><th>' + t('an.scans') + '</th><th>' + t('an.unique') + '</th></tr></thead><tbody>' +
      days.slice().reverse().filter(function (p) { return p.s; }).map(function (p) { return '<tr><td>' + esc(p.d ? i18n.fmt.date(day(p.d), 'short') : String(p.h).padStart(2, '0') + ':00') + '</td><td>' + i18n.fmt.num(p.s) + '</td><td>' + i18n.fmt.num(p.u) + '</td></tr>'; }).join('') +
      '</tbody></table></div></details></div>';
  }
  function codeRow(r, right) {
    return '<li><button type="button" class="hm-code" data-code="' + esc(r.id) + '"><span class="hm-qr" aria-hidden="true">' + QRRender.svg(CodeUtil.qrData(r), CodeUtil.qrDesign(r)) + '</span>' +
      '<span class="hm-cn"><b>' + esc(name(r)) + '</b><small>' + esc(typeName(getType(r.typeId))) + (r.paused ? ' · ' + t('myCodes.offLabel') : '') + '</small></span>' + right + '</button></li>';
  }
  function favorites() {
    var all = codes.filter(function (r) { return r.favorite; }), favs = all.slice(0, 3);
    return '<div class="hm-card glass hm-favs"><div class="hm-head"><h3>' + ico('star2', 'hm-hi star') + t('home.favCodes') + (all.length ? ' <em class="hm-count">' + i18n.fmt.num(all.length) + '</em>' : '') + '</h3>' + (all.length ? '<button type="button" class="link-btn" data-goto-fav>' + t('home.viewAll') + ico('arrow', 'hm-ti') + '</button>' : '') + '</div>' +
      (favs.length ? '<table class="hm-table"><thead><tr><th>' + t('ac.colCode') + '</th><th>' + t('adm.status') + '</th><th class="num">' + t('an.scans') + '</th></tr></thead><tbody>' + favs.map(function (r) {
          var on = isStatic(r) || !r.paused;
          return '<tr data-code="' + esc(r.id) + '" tabindex="0"><td><span class="hm-code"><span class="hm-qr" aria-hidden="true">' + QRRender.svg(CodeUtil.qrData(r), CodeUtil.qrDesign(r)) + '</span><span class="hm-cn"><b>' + esc(name(r)) + '</b><small>' + esc(typeName(getType(r.typeId))) + '</small></span></span></td>' +
            '<td><i class="ad-pill ' + (on ? 'ok' : 'off') + '">' + t(isStatic(r) ? 'ac.alwaysOn' : on ? 'cust.active' : 'adm.sPaused') + '</i></td><td class="num"><b>' + (isStatic(r) ? '–' : i18n.fmt.num(r.scans || 0)) + '</b></td></tr>';
        }).join('') + '</tbody></table>'
        : '<p class="hm-none">' + t('home.noFavs') + '</p>') + '</div>';
  }
  function top() {
    var by = {}; ((statsP && statsP.codes) || []).forEach(function (c) { by[c.k] = c.s; });   // alleen de gekozen periode
    var list = codes.filter(function (r) { return by[r.id]; }).sort(function (a, b) { return by[b.id] - by[a.id]; }).slice(0, 4);
    return '<div class="hm-card glass"><div class="hm-head"><h3>' + ico('trophy', 'hm-hi') + t('home.topTitle') + '</h3><small class="hm-per">' + t(period === 1 ? 'an.p_today' : 'an.p_' + period) + '</small></div>' +
      (list.length ? '<ol class="hm-list hm-rank">' + list.map(function (r) { return codeRow(r, '<span class="hm-num">' + i18n.fmt.num(by[r.id]) + '</span>'); }).join('') + '</ol>'
        : '<p class="hm-none">' + t('home.noTop') + '</p>') + '</div>';
  }
  // Recente activiteit: codes gemaakt/bewerkt/gescand + account (inloggen, wachtwoord …), nieuwste eerst
  function activity() {
    var ev = [];
    codes.forEach(function (r) {
      ev.push({ at: r.createdAt, icon: 'plus', text: t('home.evCreated', { name: name(r) }), code: r.id });
      if (r.updatedAt && r.updatedAt !== r.createdAt) ev.push({ at: r.updatedAt, icon: 'pen', text: t('home.evEdited', { name: name(r) }), code: r.id });
      if (r.lastScanAt) ev.push({ at: r.lastScanAt, icon: 'scan', text: t('home.evScanned', { name: name(r) }), code: r.id, cls: 'scan' });
    });
    var AI = { login: 'check', login_failed: 'warn', password: 'key', email: 'mail', sessions_ended: 'out', session_ended: 'out' };
    acts.forEach(function (a) { ev.push({ at: a.at, icon: AI[a.kind] || 'check', text: t('acct.act_' + a.kind), cls: a.kind === 'login_failed' ? 'bad' : 'acct' }); });
    ev.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    ev = ev.slice(0, 4);
    return '<div class="hm-card glass"><div class="hm-head"><h3>' + ico('clock', 'hm-hi') + t('home.activity') + '</h3><button type="button" class="link-btn" data-goto-sec>' + t('home.viewAll') + ico('arrow', 'hm-ti') + '</button></div>' +
      (ev.length ? '<ol class="hm-feed">' + ev.map(function (e) {
        return '<li class="' + (e.cls || '') + '"><span class="hm-fi">' + ico(e.icon) + '</span><div>' + (e.code ? '<button type="button" class="hm-flink" data-code="' + esc(e.code) + '">' + esc(e.text) + '</button>' : '<b>' + esc(e.text) + '</b>') + '<small>' + esc(ago(e.at)) + '</small></div></li>';
      }).join('') + '</ol>' : '<p class="hm-none">' + t('acct.activityEmpty') + '</p>') + '</div>';
  }
  function welcome() {
    var step = function (n, title, txt) { return '<li><span class="hm-step">' + n + '</span><div><b>' + title + '</b><small>' + txt + '</small></div></li>'; };
    return '<div class="hm-welcome glass"><div><h3>' + t('home.welcomeTitle') + '</h3><p>' + t('home.welcomeText') + '</p>' +
      '<ol class="hm-steps">' + step(1, t('home.step1'), t('home.step1t')) + step(2, t('home.step2'), t('home.step2t')) + step(3, t('home.step3'), t('home.step3t')) + '</ol>' +
      '<button type="button" class="btn primary" data-hm-new>' + ico('plus') + t('myCodes.first') + '</button></div>' +
      '<div class="hm-wqr" aria-hidden="true">' + QRRender.svg('https://optimasys.com', { color: '#0b1220', background: '#ffffff' }) + '</div></div>';
  }

  /* Abonnement in één regel: welk pakket en tot wanneer betaald (straks komt dit uit Stripe). Klik = Abonnement. */
  function subLine() {
    var sb = plan && plan.sub, p = plan && plan.plan;
    if (!sb || !p || (window.Team && Team.member && Team.member())) return '';
    if (sb.state === 'active' && sb.periodEnd) return '<button type="button" class="hm-sub" data-hm-plan><b>' + esc(t('plan.n_' + p.id)) + '</b> · ' + esc(t('sub.paidUntil', { date: i18n.fmt.stamp(sb.periodEnd, 'short') })) + '</button>';
    return '';
  }

  function draw() {
    if (!codes) return;
    var sr = series30();
    body.innerHTML = '<header class="hm-hero"><div><h2>' + esc(greeting()) + '</h2><p>' + t(codes.length ? 'home.welcomeBack' : 'home.leadNew') + '</p>' + subLine() + '</div>' +
        '<div class="hm-acts"><label class="ad-sel hm-period"><span class="sr-only">' + t('an.period') + '</span><select id="hmPeriod">' + [1, 7, 30, 90].map(function (n) { return '<option value="' + n + '"' + (n === period ? ' selected' : '') + '>' + t(n === 1 ? 'an.p_today' : 'an.p_' + n) + '</option>'; }).join('') + '</select></label>' +
        '<button type="button" class="btn primary" data-hm-new>' + ico('plus') + t('nav.create') + '</button></div></header>' +
      (stats && stats.demo ? '<p class="mc-demo">' + t('an.demoNote') + '</p>' : '') +
      (codes.length ? tiles(sr) + '<div class="hm-rows"><div class="hm-row">' + chart(sr) + activity() + '</div><div class="hm-row">' + favorites() + top() + '</div></div>' : welcome() + '<div class="hm-grid one">' + activity() + '</div>') +
      '';   // geen voettekst: alles past zo op één scherm (Privacy staat in de zijbalk)
    fit();
  }

  /* Alles op één scherm: is het scherm lager, dan wordt het overzicht iets kleiner (niet kleiner dan 75%) */
  function fit() {
    var sec = view.querySelector('.hm'); if (!sec || view.hidden) return;
    sec.style.zoom = '';
    if (window.innerWidth <= 760) return;
    var top = sec.getBoundingClientRect().top + window.scrollY, h = sec.offsetHeight, avail = window.innerHeight - top - 24;
    if (h > avail) sec.style.zoom = Math.max(.75, Math.floor(avail / h * 1000) / 1000);
  }
  addEventListener('resize', function () { clearTimeout(fit.t); fit.t = setTimeout(fit, 80); });

  /* ---------- Klikken en tooltip ---------- */
  body.addEventListener('click', function (e) {
    if (e.target.closest('[data-hm-new]')) { actions.startNew(); return goToPage('create'); }
    if (e.target.closest('[data-hm-plan]')) { goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); return; }
    var g = e.target.closest('[data-goto]'); if (g) return goToPage(g.getAttribute('data-goto'));
    if (e.target.closest('[data-goto-sec]')) { goToPage('account'); if (window.openAccountTab) openAccountTab('security'); return; }
    if (e.target.closest('[data-goto-fav]')) { goToPage('myCodes'); if (window.MyCodes && MyCodes.showFolder) MyCodes.showFolder('fav'); return; }
    var c = e.target.closest('[data-code]'); if (c) return Analytics.open({ codes: [c.getAttribute('data-code')] });
  });
  body.addEventListener('change', function (e) {
    if (e.target.id !== 'hmPeriod') return;
    period = +e.target.value; try { localStorage.setItem('home.period', String(period)); } catch (x) {}
    load();
  });
  body.addEventListener('keydown', function (e) { var r = e.target.closest && e.target.closest('tr[data-code]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); Analytics.open({ codes: [r.getAttribute('data-code')] }); } });
  body.addEventListener('mousemove', function (e) {
    var hit = e.target.closest && e.target.closest('.hm-hit'), box = body.querySelector('.hm-plot'); if (!box) return;
    var tt = box.querySelector('.an-tt');
    box.querySelectorAll('.hm-bar.on').forEach(function (b) { b.classList.remove('on'); });
    if (!hit) { tt.hidden = true; return; }
    var i = +hit.getAttribute('data-i'), p = series30().days[i], bars = box.querySelectorAll('.hm-hit');
    tt.hidden = false;
    tt.innerHTML = '<b>' + esc(p.d ? i18n.fmt.date(day(p.d), 'long') : String(p.h).padStart(2, '0') + ':00–' + String(p.h).padStart(2, '0') + ':59') + '</b><span><i class="sw s1"></i>' + t('an.scans') + '<em>' + i18n.fmt.num(p.s) + '</em></span><span><i class="sw s2"></i>' + t('an.unique') + '<em>' + i18n.fmt.num(p.u) + '</em></span>';
    var r = box.getBoundingClientRect(), hr = hit.getBoundingClientRect();
    tt.style.left = Math.min(Math.max(hr.left - r.left + hr.width / 2, 80), r.width - 80) + 'px'; tt.style.top = '0px';
    var bar = hit.previousElementSibling; if (bar && bar.classList.contains('hm-bar')) bar.classList.add('on');
  });
  body.addEventListener('mouseleave', function () { var tt = body.querySelector('.hm-plot .an-tt'); if (tt) tt.hidden = true; }, true);

  Session.onUser(function (u) {
    me = u; codes = null; stats = null; acts = null;
    if (!u.admin) setTimeout(function () { goToPage(Session.landOn('home')); }, 0);   // admins beginnen op het Dashboard van Beheer
  });
  document.addEventListener('pagechange', function (e) { if (e.detail === 'home') load(); });
  i18n.onChange(function () { if (!view.hidden) draw(); });
  return { reload: load };
})();
