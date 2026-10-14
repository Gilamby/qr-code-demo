/* =========================================================
   OVERZICHT (dashboard voor klanten) — de startpagina na het inloggen
   In één oogopslag (ontwerp van Fabian):
   - Titel + periode (7 / 30 / 90 dagen) + knop "QR-code maken"
   - Vier tegels: QR-codes (actief), scans, unieke scans (met verschil t.o.v. de periode ervoor), scans vandaag
   - Rij 1: scanactiviteit (staafjes, tooltip, tabel) | recente activiteit
   - Rij 2: favorieten als tabel (code, status, scans) | meest gescand
   - Onderaan: © Optimasys QR · Privacy en voorwaarden
   - Nog geen codes? Dan een welkom met de eerste stappen.
   Admins beginnen op het Dashboard van Beheer, maar kunnen dit ook openen.
   ========================================================= */
var Home = (function () {
  var view = document.getElementById('homeView'), body = document.getElementById('homeBody');
  var codes = null, stats = null, statsP = null, acts = null, me = null, seq = 0, period = 30;
  try { var sp = +localStorage.getItem('home.period'); if ([7, 30, 90].indexOf(sp) >= 0) period = sp; } catch (e) {}
  var SVG = function (p, cls) { return '<svg class="' + (cls || 'hm-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var IC = {
    plus: '<path d="M12 5v14M5 12h14"/>', codes: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    chart: '<path d="M5 20V12M10 20V5M15 20v-9M20 20V9M2 21h20"/>', scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.4-4 4.4-6 8-6s6.6 2 8 6"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    star: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>', trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', up: '<path d="M7 14l5-5 5 5"/>', down: '<path d="M7 10l5 5 5-5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', arrow: '<path d="M9 6l6 6-6 6"/>'
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
      api.analytics({ from: iso(new Date(Date.now() - (period - 1) * 864e5)), to: iso(to), codes: [], os: [], cc: [], city: [] }).catch(function () { return null; }),
      api.account.activity ? api.account.activity().catch(function () { return { activity: [] }; }) : Promise.resolve({ activity: [] })
    ]).then(function (r) {
      if (my !== seq) return;
      codes = r[0] || []; stats = r[1]; statsP = r[2]; acts = (r[3] && r[3].activity) || [];
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
    return { days: out, prev: prev };
  }
  // Kleine lijn onder een tegel: dezelfde reeks als de grafiek (geen extra berekening)
  function spark(vals) {
    var W = 120, H = 28, n = vals.length, max = Math.max.apply(null, vals.concat([1]));
    if (n < 2) return '';
    var pts = vals.map(function (v, i) { return [(i / (n - 1) * W).toFixed(1), (H - 2 - v / max * (H - 6)).toFixed(1)]; });
    var line = 'M' + pts.map(function (q) { return q.join(' '); }).join('L');
    return '<svg class="hm-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="' + line + 'L' + W + ' ' + H + 'L0 ' + H + 'Z"/><path class="ln" d="' + line + '"/></svg>';
  }
  // Scans per dag van de laatste 7 dagen; vandaag uitgelicht
  function week(days) {
    var max = Math.max.apply(null, days.map(function (p) { return p.s; }).concat([1]));
    return '<span class="hm-week" aria-hidden="true">' + days.map(function (p, i) { return '<i class="' + (i === days.length - 1 ? 'now' : '') + '" style="height:' + Math.max(8, Math.round(p.s / max * 100)) + '%"></i>'; }).join('') + '</span>';
  }
  function tiles(sr) {
    var cur = sr.days.reduce(function (a, p) { a.s += p.s; a.u += p.u; return a; }, { s: 0, u: 0 }), today = sr.days[sr.days.length - 1] || { s: 0 };
    var dyn = codes.filter(function (r) { return !isStatic(r); }), off = dyn.filter(function (r) { return r.paused; }).length;
    var trend = function (now, before) {
      if (!before && !now) return '<em class="hm-trend flat">' + t('home.noChange') + '</em>';
      if (!before) return '<em class="hm-trend t-up">' + ico('up', 'hm-ti') + t('home.new') + '</em>';
      var pct = Math.round((now - before) / before * 100);
      return '<em class="hm-trend ' + (pct > 0 ? 't-up' : pct < 0 ? 't-down' : 'flat') + '" title="' + esc(t('home.vsPrevN', { n: period })) + '">' + (pct ? ico(pct > 0 ? 'up' : 'down', 'hm-ti') : '') + (pct > 0 ? '+' : '') + pct + '%<span>' + t('home.vsPrevShortN', { n: period }) + '</span></em>';
    };
    var num = function (n) { return '<b data-count="' + n + '">' + i18n.fmt.num(n) + '</b>'; };
    var tile = function (cls, icon, label, n, extra, viz) { return '<div class="hm-tile glass ' + cls + '"><span class="hm-tic">' + ico(icon) + '</span><small>' + label + '</small>' + num(n) + (extra || '') + (viz || '') + '</div>'; };
    var active = codes.filter(function (r) { return !r.paused; }).length;
    var last7 = sr.days.slice(-7);
    return '<div class="hm-tiles">' +
      tile('t-codes', 'codes', t('home.tCodesAll'), codes.length, '<em class="hm-trend flat"><i class="hm-dot' + (off ? ' warn' : '') + '"></i>' + t('home.activeN', { n: i18n.fmt.num(active) }) + '</em>',
        '<span class="hm-meter" aria-hidden="true"><i style="width:' + (codes.length ? Math.round(active / codes.length * 100) : 0) + '%"></i></span>') +
      tile('t-scans', 'scan', t('home.tScansAll'), cur.s, trend(cur.s, sr.prev.s), spark(sr.days.map(function (p) { return p.s; }))) +
      tile('t-uniq', 'user', t('home.tUniqueAll'), cur.u, trend(cur.u, sr.prev.u), spark(sr.days.map(function (p) { return p.u; }))) +
      tile('t-today', 'sun', t('home.tToday'), today.s, '<em class="hm-trend flat">' + esc(i18n.fmt.date(new Date(), 'day')) + '</em>', week(last7)) + '</div>';
  }
  // Staafgrafiek: één reeks (scans), dus geen legenda: de titel zegt wat het is
  function chart(sr) {
    var days = sr.days, max = Math.max.apply(null, days.map(function (p) { return p.s; }).concat([1]));
    var stepv = max <= 4 ? 1 : Math.ceil(max / 4 / Math.pow(10, Math.floor(Math.log10(max / 4)))) * Math.pow(10, Math.floor(Math.log10(max / 4)));
    var top = Math.ceil(max / stepv) * stepv, W = 720, H = 200, L = 34, R = 6, T = 10, B = 26, iw = W - L - R, ih = H - T - B, n = days.length, bw = iw / n;
    var grid = ''; for (var v = 0; v <= top; v += stepv) { var y = T + ih - v / top * ih; grid += '<line class="an-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text class="an-ax" x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + i18n.fmt.num(v) + '</text>'; }
    var bars = days.map(function (p, i) {
      var h = p.s ? Math.max(3, p.s / top * ih) : 0, x = L + i * bw + 1.5, w = Math.max(2, bw - 3), y = T + ih - h, r = Math.min(4, w / 2, h);
      var path = h ? 'M' + x + ' ' + (T + ih) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (T + ih) + 'Z' : '';
      return (path ? '<path class="hm-bar' + (i === n - 1 ? ' today' : '') + '" style="--i:' + i + '" d="' + path + '"/>' : '') +
        '<rect class="hm-hit" data-i="' + i + '" x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + ih + '" fill="transparent"/>';
    }).join('');
    var labels = days.map(function (p, i) { return (i % 7 === 0 && i <= n - 4) || i === n - 1 ? '<text class="an-ax" x="' + (L + i * bw + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(i18n.fmt.date(day(p.d), 'dshort')) + '</text>' : ''; }).join('');
    var total = days.reduce(function (a, p) { return a + p.s; }, 0);
    // Gemiddelde per dag (stippellijn) en de drukste dag: alleen weergave van dezelfde reeks
    var avg = total / n, extra = '';
    if (total) {
      var ay = T + ih - avg / top * ih, pk = 0; days.forEach(function (p, i) { if (p.s > days[pk].s) pk = i; });
      var px = L + pk * bw + bw / 2, py = T + ih - days[pk].s / top * ih;
      extra = '<line class="hm-avg" x1="' + L + '" x2="' + (W - R) + '" y1="' + ay.toFixed(1) + '" y2="' + ay.toFixed(1) + '"/>' +
        '<text class="hm-avgl" x="' + (L + 6) + '" y="' + (ay - 5).toFixed(1) + '" text-anchor="start">' + esc(t('home.avgDay', { n: i18n.fmt.num(Math.round(avg * 10) / 10) })) + '</text>' +
        '<circle class="hm-peak" cx="' + px.toFixed(1) + '" cy="' + Math.max(T + 4, py - 6).toFixed(1) + '" r="3"/>';
    }
    grid = '<defs><linearGradient id="hmBarG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#0ea5e9" stop-opacity=".35"/></linearGradient></defs>' + grid +
      '<line class="hm-cross" x1="0" x2="0" y1="' + T + '" y2="' + (T + ih) + '" visibility="hidden"/>';
    return '<div class="hm-card glass hm-chart"><div class="hm-head"><h3>' + t('home.scanActivity') + '</h3><button type="button" class="link-btn" data-goto="analytics">' + t('home.viewAnalytics') + ico('arrow', 'hm-ti') + '</button></div>' +
      (total ? '' : '<p class="hm-none">' + t('home.noScans30') + '</p>') +
      '<div class="hm-plot"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('home.chartTitle')) + '">' + grid + bars + extra + labels + '</svg><div class="an-tt" hidden></div></div>' +
      '<div class="hm-cfoot"><span><i class="sw s1"></i>' + t('home.totalScans') + '</span></div>' +
      '<details class="an-table"><summary>' + t('an.asTable') + '</summary><div class="an-tw"><table><thead><tr><th>' + t('an.date') + '</th><th>' + t('an.scans') + '</th><th>' + t('an.unique') + '</th></tr></thead><tbody>' +
      days.slice().reverse().filter(function (p) { return p.s; }).map(function (p) { return '<tr><td>' + esc(i18n.fmt.date(day(p.d), 'short')) + '</td><td>' + i18n.fmt.num(p.s) + '</td><td>' + i18n.fmt.num(p.u) + '</td></tr>'; }).join('') +
      '</tbody></table></div></details></div>';
  }
  function codeRow(r, right) {
    return '<li><button type="button" class="hm-code" data-code="' + esc(r.id) + '"><span class="hm-qr" aria-hidden="true">' + QRRender.svg(CodeUtil.qrData(r), CodeUtil.qrDesign(r)) + '</span>' +
      '<span class="hm-cn"><b>' + esc(name(r)) + '</b><small>' + esc(typeName(getType(r.typeId))) + (r.paused ? ' · ' + t('myCodes.offLabel') : '') + '</small></span>' + right + '</button></li>';
  }
  function favorites() {
    var all = codes.filter(function (r) { return r.favorite; }), favs = all.slice(0, 5);
    return '<div class="hm-card glass hm-favs"><div class="hm-head"><h3>' + ico('star', 'hm-hi star') + t('home.favCodes') + (all.length ? ' <em class="hm-count">' + i18n.fmt.num(all.length) + '</em>' : '') + '</h3>' + (all.length ? '<button type="button" class="link-btn" data-goto-fav>' + t('home.viewAll') + ico('arrow', 'hm-ti') + '</button>' : '') + '</div>' +
      (favs.length ? '<table class="hm-table"><thead><tr><th>' + t('ac.colCode') + '</th><th>' + t('adm.status') + '</th><th class="num">' + t('an.scans') + '</th></tr></thead><tbody>' + favs.map(function (r) {
          var on = isStatic(r) || !r.paused;
          return '<tr data-code="' + esc(r.id) + '" tabindex="0"><td><span class="hm-code"><span class="hm-qr" aria-hidden="true">' + QRRender.svg(CodeUtil.qrData(r), CodeUtil.qrDesign(r)) + '</span><span class="hm-cn"><b>' + esc(name(r)) + '</b><small>' + esc(typeName(getType(r.typeId))) + '</small></span></span></td>' +
            '<td><i class="hm-st ' + (on ? 'ok' : 'off') + '">' + t(isStatic(r) ? 'ac.alwaysOn' : on ? 'cust.active' : 'adm.sPaused') + '</i></td><td class="num"><b>' + (isStatic(r) ? '–' : i18n.fmt.num(r.scans || 0)) + '</b></td></tr>';
        }).join('') + '</tbody></table>'
        : '<p class="hm-none">' + t('home.noFavs') + '</p>') + '</div>';
  }
  function top() {
    var by = {}; ((statsP && statsP.codes) || []).forEach(function (c) { by[c.k] = c.s; });   // alleen de gekozen periode
    var list = codes.filter(function (r) { return by[r.id]; }).sort(function (a, b) { return by[b.id] - by[a.id]; }).slice(0, 5);
    return '<div class="hm-card glass"><div class="hm-head"><h3>' + ico('trophy', 'hm-hi') + t('home.topTitle') + '</h3><small class="hm-per">' + t('an.p_' + period) + '</small></div>' +
      (list.length ? '<ol class="hm-list hm-rank">' + list.map(function (r) { return codeRow(r, '<span class="hm-num">' + i18n.fmt.num(by[r.id]) + '</span><span class="hm-share" aria-hidden="true"><i style="width:' + Math.max(3, Math.round(by[r.id] / by[list[0].id] * 100)) + '%"></i></span>'); }).join('') + '</ol>'
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
    ev = ev.slice(0, 5);
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

  function draw() {
    if (!codes) return;
    var sr = series30();
    body.innerHTML = '<header class="hm-hero"><div><p class="hm-tele"><i class="hm-live" aria-hidden="true"></i><span>' + t('home.live') + '</span><span class="hm-sep" aria-hidden="true"></span><time id="hmClock"></time></p><h2>' + t('nav.overview') + '</h2><p>' + t(codes.length ? 'home.sub' : 'home.leadNew') + '</p></div>' +
        '<div class="hm-acts"><label class="ad-sel hm-period"><span class="sr-only">' + t('an.period') + '</span><select id="hmPeriod">' + [7, 30, 90].map(function (n) { return '<option value="' + n + '"' + (n === period ? ' selected' : '') + '>' + t('an.p_' + n) + '</option>'; }).join('') + '</select></label>' +
        '<button type="button" class="btn primary" data-hm-new>' + ico('plus') + t('nav.create') + '</button></div></header>' +
      (stats && stats.demo ? '<p class="mc-demo">' + t('an.demoNote') + '</p>' : '') +
      (codes.length ? tiles(sr) + '<div class="hm-rows"><div class="hm-row">' + chart(sr) + activity() + '</div><div class="hm-row">' + favorites() + top() + '</div></div>' : welcome() + '<div class="hm-grid one">' + activity() + '</div>') +
      '<footer class="hm-foot"><span>© ' + new Date().getFullYear() + ' Optimasys QR</span><button type="button" class="link-btn" data-goto="legal">' + t('nav.legal') + '</button></footer>';
    clock(); countUp();
  }
  /* Klok in de kopregel (datum + tijd van de gebruiker) */
  function clock() {
    var c = document.getElementById('hmClock'); if (!c) return;
    var now = new Date(); c.dateTime = now.toISOString();
    var tm = ''; try { tm = now.toLocaleTimeString(i18n.lang(), { hour: '2-digit', minute: '2-digit', timeZone: i18n.fmt.zone() }); } catch (e) { tm = now.toLocaleTimeString(); }
    c.textContent = i18n.fmt.date(now, 'long') + ' · ' + tm;
  }
  setInterval(function () { if (!view.hidden) clock(); }, 30000);
  /* Getallen tellen even op bij het openen (niet bij "beweging verminderen", en maar één keer per bezoek) */
  var counted = false;
  function countUp() {
    if (counted) return; counted = true;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    body.querySelectorAll('[data-count]').forEach(function (el) {
      var to = +el.getAttribute('data-count'), t0 = performance.now(), dur = 700; if (!to) return;
      (function step(now) { var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = i18n.fmt.num(Math.round(to * e)); if (k < 1) requestAnimationFrame(step); })(t0);
    });
  }

  /* ---------- Klikken en tooltip ---------- */
  body.addEventListener('click', function (e) {
    if (e.target.closest('[data-hm-new]')) { actions.startNew(); return goToPage('create'); }
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
    var cross = box.querySelector('.hm-cross');
    if (!hit) { tt.hidden = true; if (cross) cross.setAttribute('visibility', 'hidden'); return; }
    if (cross) { var cx = +hit.getAttribute('x') + +hit.getAttribute('width') / 2; cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible'); }
    var i = +hit.getAttribute('data-i'), p = series30().days[i], bars = box.querySelectorAll('.hm-hit');
    tt.hidden = false;
    tt.innerHTML = '<b>' + esc(i18n.fmt.date(day(p.d), 'long')) + '</b><span><i class="sw s1"></i>' + t('an.scans') + '<em>' + i18n.fmt.num(p.s) + '</em></span><span><i class="sw s2"></i>' + t('an.unique') + '<em>' + i18n.fmt.num(p.u) + '</em></span>';
    var r = box.getBoundingClientRect(), hr = hit.getBoundingClientRect();
    tt.style.left = Math.min(Math.max(hr.left - r.left + hr.width / 2, 80), r.width - 80) + 'px'; tt.style.top = '0px';
    var bar = hit.previousElementSibling; if (bar && bar.classList.contains('hm-bar')) bar.classList.add('on');
  });
  body.addEventListener('mouseleave', function () { var tt = body.querySelector('.hm-plot .an-tt'); if (tt) tt.hidden = true; var c = body.querySelector('.hm-cross'); if (c) c.setAttribute('visibility', 'hidden'); }, true);


  /* ---------- Diepte achter het overzicht (alleen deze pagina) ----------
     Een rustig 3D-veld van lichtpuntjes, vooral langs de randen en onderin, met een vlak raster als "vloer".
     Ligt boven de gewone achtergrond en onder de kaarten; volgt de muis een heel klein beetje.
     Stopt als de pagina niet zichtbaar is; bij "beweging verminderen" één stilstaand beeld. */
  var Space = (function () {
    var cv = document.createElement('canvas'), ctx = cv.getContext('2d'), on = false, raf = 0, last = 0, pts = [], W = 0, H = 0, dpr = 1, mx = 0, my = 0, tx = 0, ty = 0, z0 = 0;
    cv.className = 'hm-space'; cv.setAttribute('aria-hidden', 'true'); view.insertBefore(cv, view.firstChild);
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function edge() { var s = Math.random() < .5 ? -1 : 1; return s * (1 - Math.pow(Math.random(), 2.2) * .85); }   // vaker aan de zijkant
    function seed() {
      var n = Math.round(Math.min(180, W * H / 9000)); pts = [];
      for (var i = 0; i < n; i++) pts.push({ x: edge() * 1.6, y: Math.random() < .55 ? rnd(.15, 1) : rnd(-1, 1), z: rnd(.2, 3), s: rnd(.6, 1.6) });
    }
    function place() {
      var r = view.getBoundingClientRect(), tb = document.querySelector('.topbar'), top = tb ? Math.max(0, tb.getBoundingClientRect().bottom) : 0;
      dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, Math.round(r.width)); H = Math.max(1, window.innerHeight - top);
      cv.style.left = Math.round(r.left) + 'px'; cv.style.top = Math.round(top) + 'px'; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (!pts.length) seed();
    }
    function frame(now) {
      raf = on && !still.matches ? requestAnimationFrame(frame) : 0;
      if (now - last < 33 && raf) return; var dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
      tx += (mx - tx) * .04; ty += (my - ty) * .04; z0 += dt * .05;
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2 - tx * 18, cy = H * .42 - ty * 12, f = Math.min(W, H) * .9;
      // vloer: raster in perspectief, onderin, vervaagt naar de horizon
      var hz = H * .62, g = ctx.createLinearGradient(0, hz, 0, H); g.addColorStop(0, 'rgba(56,189,248,0)'); g.addColorStop(1, 'rgba(56,189,248,.14)');
      ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.beginPath();
      for (var k = -12; k <= 12; k++) { ctx.moveTo(cx + k * W * .02, hz); ctx.lineTo(cx + k * W * .16, H); }
      for (var j = 0; j < 9; j++) { var d = ((j + (z0 * 4) % 1) / 9), y = hz + (H - hz) * d * d; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      // lichtpuntjes: drijven langzaam naar je toe
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i]; p.z -= dt * .06; if (p.z < .2) { p.z = 3; p.x = edge() * 1.6; }
        var sx = cx + p.x / p.z * f * .5, sy = cy + p.y / p.z * f * .5; if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
        var a = Math.min(1, (3 - p.z) / 2.2) * .7, r = p.s / p.z * 1.6;
        ctx.fillStyle = 'rgba(125,211,252,' + a.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(.4, r), 0, 6.283); ctx.fill();
      }
    }
    function toggle(v) {
      on = v; cv.hidden = !v; cancelAnimationFrame(raf); raf = 0;
      if (v) { place(); last = 0; frame(performance.now()); }
    }
    addEventListener('resize', function () { if (on) { pts = []; place(); if (!raf) frame(performance.now()); } });
    addEventListener('pointermove', function (e) { if (on) { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; } }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (on) { cancelAnimationFrame(raf); raf = 0; if (!document.hidden) frame(performance.now()); } });
    if (window.ResizeObserver) new ResizeObserver(function () { if (on) place(); }).observe(view);   // zijbalk in-/uitgeklapt
    return { toggle: toggle };
  })();

  Session.onUser(function (u) {
    me = u; codes = null; stats = null; acts = null;
    if (!u.admin) setTimeout(function () { goToPage(Session.landOn('home')); }, 0);   // admins beginnen op het Dashboard van Beheer
  });
  document.addEventListener('pagechange', function (e) { if (e.detail === 'home') { counted = false; load(); } Space.toggle(e.detail === 'home'); });
  i18n.onChange(function () { if (!view.hidden) draw(); });
  return { reload: load };
})();
