/* =========================================================
   BEHEER (alleen voor het team): Dashboard en Alle QR-codes.
   Gebruikers staat in customers.js. Server: /api/admin/* (qr-codes/admin-panel.controller.ts).
   - Dashboard: tellers met trend, scans per dag (30 dagen) als grafiek, types, top-codes, nieuwste accounts.
   - Alle QR-codes: van alle klanten, zoeken, filters, sorteren, pagina's; per code openen, downloaden,
     link kopiëren, pauzeren/aanzetten en verwijderen.
   ========================================================= */
var Admin = (function () {
  var me = null;
  var SVG = function (d, cls) { return '<svg class="' + (cls || 'ad-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var IC = {
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.6 3.6-5.5 6.5-5.5s5.5 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM19 19h2v2M14 19v2M19 14h2"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    up: '<path d="M7 17L17 7M9 7h8v8"/>', down: '<path d="M7 7l10 10M17 9v8H9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    prev: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  function ico(k, cls) { return SVG(IC[k], cls); }
  function num(n) { return i18n.fmt.num(n || 0); }
  function date(iso) { return iso ? new Date(iso).toLocaleDateString(i18n.lang(), { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function ago(iso) {
    if (!iso) return t('adm.never');
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    var rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat(i18n.lang(), { numeric: 'auto' }) : null;
    if (!rtf) return date(iso);
    if (s < 60) return rtf.format(0, 'second');
    if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
    if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
    if (s < 86400 * 30) return rtf.format(-Math.round(s / 86400), 'day');
    return date(iso);
  }
  // Vaste kleur per persoon (zelfde naam = zelfde kleur), voor de rondjes met letters
  var HUES = [199, 262, 152, 24, 330, 45, 186, 290];
  function avatar(name, email, cls) {
    var s = String(name || email || '?'), h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var w = s.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean), ini = ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
    return '<span class="' + (cls || 'ad-av') + '" style="--h:' + HUES[h % HUES.length] + '" aria-hidden="true">' + esc(ini) + '</span>';
  }
  function owner(o) { return o ? '<span class="ad-owner">' + avatar(o.name, o.email, 'ad-av s') + '<span><b>' + esc(o.name || o.email) + '</b><small>' + esc(o.email) + '</small></span></span>' : ''; }
  function typeChip(id) { var tp = getType(id); return tp ? '<span class="ad-type">' + svg(tp.icon, 1.8) + esc(typeName(tp)) + '</span>' : ''; }
  function toast(msg) { var x = document.getElementById('mcToast'); if (!x) return; x.textContent = msg; x.hidden = false; clearTimeout(toast.tm); toast.tm = setTimeout(function () { x.hidden = true; }, 2200); }
  function errMsg() { return t('auth.errGeneral'); }

  /* =================== DASHBOARD =================== */
  var dash = document.getElementById('adminDashPage'), data = null, dashErr = false;
  function greet() { var h = new Date().getHours(); return t(h < 12 ? 'adm.morning' : h < 18 ? 'adm.afternoon' : 'adm.evening', { name: esc(((me && me.name) || '').split(' ')[0] || '') }); }
  // Kleine lijn onder een teller (laatste 14 dagen)
  function spark(values) {
    if (!values.length) return '';
    var max = Math.max.apply(null, values.concat([1])), w = 120, h = 34, step = w / Math.max(1, values.length - 1);
    var pts = values.map(function (v, i) { return [i * step, h - 3 - (v / max) * (h - 8)]; });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    return '<svg class="ad-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + line + 'L' + w + ' ' + h + 'L0 ' + h + 'Z" class="fill"/><path d="' + line + '" class="line"/></svg>';
  }
  function trend(now, before) {
    if (!before && !now) return '';
    if (!before) return '<span class="ad-trend up">' + ico('up') + t('adm.new') + '</span>';
    var p = Math.round((now - before) / before * 100);
    return '<span class="ad-trend ' + (p >= 0 ? 'up' : 'down') + '" title="' + esc(t('adm.vsPrev')) + '">' + ico(p >= 0 ? 'up' : 'down') + (p >= 0 ? '+' : '') + num(p) + '%</span>';
  }
  function kpi(k, icon, label, value, sub, extra) {
    return '<div class="glass ad-kpi ad-kpi-' + k + '"><div class="ad-kpi-top"><span class="ad-kpi-ic">' + ico(icon) + '</span><small>' + label + '</small></div>' +
      '<b class="ad-kpi-n">' + value + '</b><div class="ad-kpi-sub">' + sub + '</div>' + (extra || '') + '</div>';
  }
  // Grote grafiek: scans en unieke scans per dag, met lijnen, zachte vulling en een tip bij de muis/vinger
  function chart(days) {
    var W = 720, H = 220, P = { l: 36, r: 12, t: 14, b: 26 }, max = Math.max.apply(null, days.map(function (d) { return d.scans; }).concat([4]));
    var nice = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / nice) * nice; if (top / 4 !== Math.round(top / 4)) top = Math.ceil(top / 4) * 4;
    var x = function (i) { return P.l + i * (W - P.l - P.r) / (days.length - 1); }, y = function (v) { return P.t + (1 - v / top) * (H - P.t - P.b); };
    var path = function (k) { return days.map(function (d, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[k]).toFixed(1); }).join(''); };
    var grid = [0, 1, 2, 3, 4].map(function (g) { var v = top * g / 4; return '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (P.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + num(v) + '</text>'; }).join('');
    var labels = days.map(function (d, i) { return (i % 7 === 0 && i <= days.length - 4) || i === days.length - 1 ? '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + new Date(d.day + 'T12:00:00').toLocaleDateString(i18n.lang(), { day: 'numeric', month: 'short' }) + '</text>' : ''; }).join('');
    return '<svg class="ad-chart" viewBox="0 0 ' + W + ' ' + H + '" data-top="' + top + '" role="img" aria-label="' + esc(t('adm.chartTitle')) + '">' +
      '<defs><linearGradient id="adFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
      '<g class="grid">' + grid + '</g><g class="lbl">' + labels + '</g>' +
      '<path class="area" d="' + path('scans') + 'L' + x(days.length - 1) + ' ' + y(0) + 'L' + x(0) + ' ' + y(0) + 'Z"/>' +
      '<path class="l-scans" d="' + path('scans') + '"/><path class="l-uniq" d="' + path('uniq') + '"/>' +
      '<line class="cursor" y1="' + P.t + '" y2="' + (H - P.b) + '" hidden/><circle class="dot" r="4.5" hidden/>' +
      '<rect class="hit" x="' + P.l + '" y="0" width="' + (W - P.l - P.r) + '" height="' + H + '" fill="transparent"/></svg>' +
      '<div class="ad-tip" hidden></div>';
  }
  function wireChart(box, days) {
    var svgEl = box.querySelector('.ad-chart'), tip = box.querySelector('.ad-tip'); if (!svgEl) return;
    var cur = svgEl.querySelector('.cursor'), dot = svgEl.querySelector('.dot');
    function at(e) {
      var r = svgEl.getBoundingClientRect(), px = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width * 720;
      var i = Math.max(0, Math.min(days.length - 1, Math.round((px - 36) / (720 - 48) * (days.length - 1)))), d = days[i];
      var top = +svgEl.getAttribute('data-top') || 1;
      var xx = 36 + i * (720 - 48) / (days.length - 1), yy = 14 + (1 - d.scans / top) * (220 - 40);
      cur.setAttribute('x1', xx); cur.setAttribute('x2', xx); cur.removeAttribute('hidden');
      dot.setAttribute('cx', xx); dot.setAttribute('cy', yy); dot.removeAttribute('hidden');
      tip.innerHTML = '<b>' + new Date(d.day + 'T12:00:00').toLocaleDateString(i18n.lang(), { weekday: 'short', day: 'numeric', month: 'short' }) + '</b>' +
        '<span><i class="k-s"></i>' + t('an.scans') + ': ' + num(d.scans) + '</span><span><i class="k-u"></i>' + t('an.unique') + ': ' + num(d.uniq) + '</span>';
      tip.hidden = false; tip.style.left = Math.min(Math.max(xx / 720 * r.width, 70), r.width - 70) + 'px';
    }
    var hit = svgEl.querySelector('.hit');
    hit.addEventListener('mousemove', at); hit.addEventListener('touchstart', at, { passive: true }); hit.addEventListener('touchmove', at, { passive: true });
    hit.addEventListener('mouseleave', function () { tip.hidden = true; cur.setAttribute('hidden', ''); dot.setAttribute('hidden', ''); });
  }
  function drawDash() {
    if (!dash || !me || !me.admin) return;
    if (dashErr) { dash.innerHTML = '<p class="acct-msg bad">' + errMsg() + '</p>'; return; }
    if (!data) { dash.innerHTML = '<header class="help-head ad-head"><h2>' + greet() + '</h2><p>' + t('adm.dashLead') + '</p></header><div class="ad-kpis">' + [1, 2, 3, 4].map(function () { return '<div class="glass ad-kpi ad-skel"></div>'; }).join('') + '</div>'; return; }
    var T = data.totals, days = data.days, last14 = days.slice(-14).map(function (d) { return d.scans; });
    var share = function (n) { return T.users ? Math.round(n / T.users * 100) : 0; };
    var mix = '<div class="ad-mix" aria-hidden="true"><i class="a" style="width:' + share(T.active) + '%"></i><i class="w" style="width:' + share(T.invited) + '%"></i><i class="o" style="width:' + share(T.disabled) + '%"></i></div>';
    var maxType = data.types.length ? data.types[0].n : 1;
    dash.innerHTML =
      '<header class="help-head ad-head"><div><h2>' + greet() + '</h2><p>' + t('adm.dashLead') + '</p></div>' +
        '<div class="ad-head-acts"><span class="ad-live"><i></i>' + t('adm.live') + '</span>' +
        '<button type="button" class="btn ghost" data-go-page="adminCodes">' + ico('qr') + t('adm.allCodes') + '</button>' +
        '<button type="button" class="btn primary" data-go-page="customers" data-add-user>' + ico('plus') + t('adm.invite') + '</button></div></header>' +
      '<div class="ad-kpis">' +
        kpi('users', 'users', t('adm.kUsers'), num(T.users), t('adm.kUsersSub', { active: num(T.active), invited: num(T.invited) }), mix) +
        kpi('codes', 'qr', t('adm.kCodes'), num(T.codes), T.newCodes30 ? t('adm.kNew30', { n: num(T.newCodes30) }) : t('adm.kPaused', { n: num(T.paused) })) +
        kpi('scans30', 'pulse', t('adm.kScans30'), num(T.scans30), trend(T.scans30, T.scansPrev30) + ' <span>' + t('adm.vsPrev') + '</span>', spark(last14)) +
        kpi('scans', 'scan', t('adm.kScans'), num(T.scans), t('adm.kAdmins', { n: num(T.admins) })) +
      '</div>' +
      '<div class="ad-row">' +
        '<section class="glass ad-card ad-chart-card"><div class="ad-card-head"><h3>' + t('adm.chartTitle') + '</h3><span class="ad-legend"><i class="k-s"></i>' + t('an.scans') + '<i class="k-u"></i>' + t('an.unique') + '</span></div>' +
          '<div class="ad-chart-wrap">' + chart(days) + '</div></section>' +
        '<section class="glass ad-card"><div class="ad-card-head"><h3>' + t('adm.types') + '</h3></div>' +
          (data.types.length ? '<ul class="ad-bars">' + data.types.slice(0, 7).map(function (x) {
            var tp = getType(x.typeId); if (!tp) return '';
            return '<li><span class="ad-bar-lbl">' + svg(tp.icon, 1.8) + esc(typeName(tp)) + '</span><span class="ad-bar"><i style="width:' + Math.max(4, x.n / maxType * 100) + '%"></i></span><b>' + num(x.n) + '</b></li>';
          }).join('') + '</ul>' : '<p class="ad-empty">' + t('adm.noCodes') + '</p>') + '</section>' +
      '</div>' +
      '<div class="ad-row two">' +
        '<section class="glass ad-card"><div class="ad-card-head"><h3>' + t('adm.top') + '</h3><button type="button" class="link-btn" data-go-page="adminCodes">' + t('adm.seeAll') + ico('arrow') + '</button></div>' +
          (data.top.length ? '<ol class="ad-top">' + data.top.map(function (r, i) {
            return '<li><span class="ad-rank">' + (i + 1) + '</span><span class="ad-mini-qr">' + CodeUtil.qrSvg(r) + '</span><span class="ad-top-who"><b>' + esc(CodeUtil.displayName(r)) + '</b><small>' + esc(r.owner ? r.owner.name || r.owner.email : '') + ' · ' + esc(typeName(getType(r.typeId))) + '</small></span><span class="ad-top-n"><b>' + num(r.scans) + '</b><small>' + t('an.scans').toLowerCase() + '</small></span></li>';
          }).join('') + '</ol>' : '<p class="ad-empty">' + t('adm.noScans') + '</p>') + '</section>' +
        '<section class="glass ad-card"><div class="ad-card-head"><h3>' + t('adm.recent') + '</h3><button type="button" class="link-btn" data-go-page="customers">' + t('adm.seeAll') + ico('arrow') + '</button></div>' +
          '<ul class="ad-people">' + data.recentUsers.map(function (u) {
            var st = u.disabledAt ? ['off', t('adm.sDisabled')] : u.active ? ['ok', t('cust.active')] : ['wait', t('cust.invited')];
            return '<li>' + avatar(u.name, u.email) + '<span class="ad-top-who"><b>' + esc(u.name || u.email) + '</b><small>' + esc(u.email) + '</small></span><span class="ad-people-r"><i class="ad-pill ' + st[0] + '">' + st[1] + '</i><small>' + ago(u.createdAt) + '</small></span></li>';
          }).join('') + '</ul></section>' +
      '</div>';
    wireChart(dash, days);
  }
  function loadDash() {
    if (!me || !me.admin) return;
    api.admin.overview().then(function (r) { data = r; dashErr = false; drawDash(); }).catch(function () { dashErr = true; drawDash(); });
  }

  /* =================== ALLE QR-CODES =================== */
  var codesBox = document.getElementById('adminCodesPage'), res = null, codesErr = false, f = { q: '', type: '', status: '', sort: 'new', page: 1 }, seq = 0, typingTm = null;
  function loadCodes() {
    if (!me || !me.admin) return;
    var my = ++seq;
    api.admin.codes(f).then(function (r) { if (my !== seq) return; res = r; codesErr = false; drawList(); }).catch(function () { if (my === seq) { codesErr = true; drawList(); } });
  }
  function seg(name, value, opts) {
    return '<div class="ad-seg" role="radiogroup" aria-label="' + esc(t('adm.status')) + '">' + opts.map(function (o) { return '<button type="button" role="radio" aria-checked="' + (value === o[0]) + '" data-' + name + '="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function drawCodes() {
    if (!codesBox || !me || !me.admin) return;
    var types = (res && res.types) || [];
    codesBox.innerHTML =
      '<header class="help-head ad-head"><div><h2>' + t('adm.allCodes') + '</h2><p>' + t('adm.codesLead') + '</p></div></header>' +
      '<div class="glass ad-card ad-tools">' +
        '<label class="ad-search">' + ico('search') + '<span class="sr-only">' + t('adm.searchCodes') + '</span><input type="search" id="adQ" value="' + esc(f.q) + '" placeholder="' + esc(t('adm.searchCodes')) + '" autocomplete="off"></label>' +
        '<label class="ad-sel"><span class="sr-only">' + t('myCodes.type') + '</span><select id="adType"><option value="">' + t('myCodes.allTypes') + '</option>' +
          QR_TYPES.filter(function (tp) { return types.indexOf(tp.id) >= 0; }).map(function (tp) { return '<option value="' + tp.id + '"' + (f.type === tp.id ? ' selected' : '') + '>' + esc(typeName(tp)) + '</option>'; }).join('') + '</select></label>' +
        '<label class="ad-sel"><span class="sr-only">' + t('myCodes.sort') + '</span><select id="adSort">' + [['new', t('myCodes.sort_new')], ['old', t('myCodes.sort_old')], ['scans', t('myCodes.sort_scans')], ['recent', t('adm.sortRecent')]].map(function (o) { return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        seg('status', f.status, [['', t('adm.sAll')], ['active', t('cust.active')], ['paused', t('adm.sPaused')]]) +
      '</div><div id="adList" aria-live="polite"></div>';
    drawList();
  }
  function card(r) {
    var st = CodeUtil.isStatic(r), url = r.shortUrl;
    return '<article class="glass ad-code' + (r.paused ? ' is-paused' : '') + '" data-id="' + esc(r.id) + '">' +
      '<div class="ad-code-top"><span class="ad-qr">' + CodeUtil.qrSvg(r) + '</span><div class="ad-code-who"><h3 title="' + esc(CodeUtil.displayName(r)) + '">' + esc(CodeUtil.displayName(r)) + '</h3>' + typeChip(r.typeId) +
        '<span class="ad-code-stats">' + (st ? '<span class="ad-muted">' + t('adm.static') + '</span>' : '<b>' + num(r.scans) + '</b> ' + t('an.scans').toLowerCase() + ' · <span class="ad-muted">' + t('adm.lastScan') + ' ' + (r.lastScanAt ? ago(r.lastScanAt) : t('adm.never')) + '</span>') + '</span></div>' +
        '<i class="ad-pill ' + (r.paused ? 'off' : 'ok') + '">' + (r.paused ? t('adm.sPaused') : t('cust.active')) + '</i></div>' +
      (st ? '' : '<a class="ad-link" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(url.replace(/^https?:\/\//, '')) + '</a>') +
      '<div class="ad-code-meta">' + owner(r.owner) + '<small class="ad-muted">' + date(r.createdAt) + '</small></div>' +
      '<div class="ad-code-acts">' +
        (st ? '' : '<a class="ad-act" href="' + esc(url) + '" target="_blank" rel="noopener">' + ico('open') + '<span>' + t('adm.open') + '</span></a>') +
        '<span class="ad-act-row">' +
        '<button type="button" class="ad-ibtn" data-act="dl" title="' + esc(t('adm.download')) + '" aria-label="' + esc(t('adm.download')) + '">' + ico('dl') + '</button>' +
        (st ? '' : '<button type="button" class="ad-ibtn" data-act="copy" title="' + esc(t('adm.copyLink')) + '" aria-label="' + esc(t('adm.copyLink')) + '">' + ico('copy') + '</button>' +
          '<button type="button" class="ad-ibtn" data-act="pause" title="' + esc(t(r.paused ? 'adm.resume' : 'adm.pause')) + '" aria-label="' + esc(t(r.paused ? 'adm.resume' : 'adm.pause')) + '">' + ico(r.paused ? 'play' : 'pause') + '</button>') +
        '<button type="button" class="ad-ibtn danger" data-act="del" title="' + esc(t('cust.remove')) + '" aria-label="' + esc(t('cust.remove')) + '">' + ico('trash') + '</button></span></div>' +
    '</article>';
  }
  function pager() {
    if (!res || res.pages <= 1) return res && res.total ? '<p class="ad-count">' + t('adm.showing', { from: num(1), to: num(res.total), total: num(res.total) }) + '</p>' : '';
    var from = (res.page - 1) * res.pageSize + 1, to = Math.min(res.total, res.page * res.pageSize), nums = [];
    for (var i = 1; i <= res.pages; i++) if (i === 1 || i === res.pages || Math.abs(i - res.page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
    return '<nav class="glass ad-pager" aria-label="' + esc(t('adm.pages')) + '"><span>' + t('adm.showing', { from: num(from), to: num(to), total: num(res.total) }) + '</span><span class="ad-pages">' +
      '<button type="button" class="ad-ibtn" data-page="' + (res.page - 1) + '"' + (res.page <= 1 ? ' disabled' : '') + ' aria-label="' + esc(t('adm.prev')) + '">' + ico('prev') + '</button>' +
      nums.map(function (n) { return n === '…' ? '<span class="ad-dots">…</span>' : '<button type="button" class="ad-pnum" data-page="' + n + '"' + (n === res.page ? ' aria-current="page"' : '') + '>' + n + '</button>'; }).join('') +
      '<button type="button" class="ad-ibtn" data-page="' + (res.page + 1) + '"' + (res.page >= res.pages ? ' disabled' : '') + ' aria-label="' + esc(t('adm.next')) + '">' + ico('next') + '</button></span></nav>';
  }
  function drawList() {
    var box = document.getElementById('adList'); if (!box) return;
    if (codesErr) { box.innerHTML = '<p class="acct-msg bad">' + errMsg() + '</p>'; return; }
    if (!res) { box.innerHTML = '<div class="ad-grid">' + [1, 2, 3].map(function () { return '<div class="glass ad-code ad-skel"></div>'; }).join('') + '</div>'; return; }
    if (!res.items.length) { box.innerHTML = '<div class="glass ad-card ad-none">' + ico('qr', 'ad-none-ic') + '<p>' + (res.all ? t('adm.noMatch') : t('adm.noCodes')) + '</p></div>'; return; }
    box.innerHTML = '<div class="ad-grid">' + res.items.map(card).join('') + '</div>' + pager();
  }
  function findRow(id) { return res && res.items.filter(function (x) { return x.id === id; })[0]; }
  function confirmDelete(r) {
    var d = document.getElementById('mcDialog');
    d.innerHTML = '<form method="dialog" class="mc-dlg"><span class="mc-dlg-ic">' + ico('trash', 'mc-i') + '</span><h3>' + t('adm.delTitle', { name: esc(CodeUtil.displayName(r)) }) + '</h3><p>' + t('adm.delText', { owner: esc(r.owner ? r.owner.name || r.owner.email : '') }) + '</p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok" id="adDelGo">' + t('cust.remove') + '</button></div></form>';
    d.querySelector('#adDelGo').addEventListener('click', function (ev) {
      ev.preventDefault();
      api.admin.removeCode(r.id).then(function () { d.close(); toast(t('adm.deleted')); loadCodes(); }).catch(function () { d.close(); toast(errMsg()); });
    });
    d.showModal();
  }
  if (codesBox) {
    codesBox.addEventListener('input', function (e) {
      if (e.target.id !== 'adQ') return;
      f.q = e.target.value; f.page = 1; clearTimeout(typingTm); typingTm = setTimeout(loadCodes, 200);
    });
    codesBox.addEventListener('change', function (e) {
      if (e.target.id === 'adType') { f.type = e.target.value; f.page = 1; loadCodes(); }
      if (e.target.id === 'adSort') { f.sort = e.target.value; f.page = 1; loadCodes(); }
    });
    codesBox.addEventListener('click', function (e) {
      var s = e.target.closest('[data-status]');
      if (s) { f.status = s.getAttribute('data-status'); f.page = 1; codesBox.querySelectorAll('[data-status]').forEach(function (b) { b.setAttribute('aria-checked', String(b === s)); }); return loadCodes(); }
      var pg = e.target.closest('[data-page]');
      if (pg && !pg.disabled) { f.page = +pg.getAttribute('data-page'); loadCodes(); return codesBox.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      var b = e.target.closest('[data-act]'), el = b && b.closest('[data-id]'), r = el && findRow(el.getAttribute('data-id')); if (!r) return;
      var act = b.getAttribute('data-act');
      if (act === 'dl') return CodeUtil.download(r, 'png');
      if (act === 'copy') { (navigator.clipboard ? navigator.clipboard.writeText(r.shortUrl) : Promise.reject()).then(function () { toast(t('adm.copied')); }, function () { toast(r.shortUrl); }); return; }
      if (act === 'pause') { b.disabled = true; return api.admin.patchCode(r.id, { paused: !r.paused }).then(function (x) { r.paused = x.paused; toast(t(x.paused ? 'adm.paused' : 'adm.resumed')); drawList(); }).catch(function () { b.disabled = false; toast(errMsg()); }); }
      if (act === 'del') return confirmDelete(r);
    });
  }

  /* Knoppen die naar een andere beheerpagina gaan (dashboard) */
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go-page]'); if (!g) return;
    if (g.hasAttribute('data-add-user')) document.dispatchEvent(new CustomEvent('admin-add-user'));
    goToPage(g.getAttribute('data-go-page'));
  });

  /* App / Beheer: één pagina, één adres. Admins wisselen met de knop bovenin de zijbalk;
     in Beheer krijgt de zijbalk het beheermenu en de pagina een eigen, rustige achtergrond. */
  var ENV_KEY = 'optimasys-env', envSwitch = document.getElementById('envSwitch');
  // Admin logt in: meteen het beheer (tenzij je de vorige keer zelf op App hebt gezet)
  function savedEnv() { try { return localStorage.getItem(ENV_KEY) === 'app' ? 'app' : 'admin'; } catch (e) { return 'admin'; } }
  function setEnv(env, go) {
    var adm = env === 'admin' && !!(me && me.admin);
    document.body.classList.toggle('env-admin', adm);
    var navApp = document.getElementById('navApp'), navAdm = document.getElementById('navAdmin');
    if (navApp) navApp.hidden = adm; if (navAdm) navAdm.hidden = !adm;
    if (envSwitch) envSwitch.querySelectorAll('[data-env]').forEach(function (b) { b.setAttribute('aria-checked', String((b.getAttribute('data-env') === 'admin') === adm)); });
    if (me && me.admin) try { localStorage.setItem(ENV_KEY, adm ? 'admin' : 'app'); } catch (e) {}   // alleen de keuze van een admin onthouden
    if (go) goToPage(adm ? 'adminDash' : 'create');
  }
  if (envSwitch) envSwitch.addEventListener('click', function (e) { var b = e.target.closest('[data-env]'); if (b) setEnv(b.getAttribute('data-env'), true); });

  Session.onUser(function (u) {
    me = u; var admin = !!(u && u.admin);
    if (envSwitch) envSwitch.hidden = !admin;
    if (!admin) { data = null; res = null; setEnv('app', false); return; }
    if (savedEnv() === 'admin') setEnv('admin', true);           // je was in het beheer: daar ga je verder
  });
  document.addEventListener('pagechange', function (e) {
    if (e.detail === 'adminDash') { drawDash(); loadDash(); }
    if (e.detail === 'adminCodes') { drawCodes(); loadCodes(); }
  });
  i18n.onChange(function () { drawDash(); if (codesBox && !codesBox.closest('[hidden]')) drawCodes(); });
  return { avatar: avatar, ago: ago };
})();
