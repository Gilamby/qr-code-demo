/* =========================================================
   BEHEER (alleen voor het team): Dashboard.
   Gebruikers staat in customers.js. Server: /api/admin/* (qr-codes/admin-panel.controller.ts).
   - Dashboard: tellers met trend, scans per dag (30 dagen) als grafiek, types, top-codes, nieuwste accounts.
   - Alle QR-codes staat in admin-codes.js.
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
  function date(iso) { return i18n.fmt.stamp(iso, 'short'); }
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
    if (!before) return '<span class="ad-trend up" title="' + esc(t('adm.vsPrev')) + '">' + ico('up') + '+' + num(now) + '</span>';   // vorige periode 0: het aantal erbij i.p.v. "nieuw"
    var p = Math.round((now - before) / before * 100);
    return '<span class="ad-trend ' + (p >= 0 ? 'up' : 'down') + '" title="' + esc(t('adm.vsPrev')) + '">' + ico(p >= 0 ? 'up' : 'down') + (p >= 0 ? '+' : '') + num(p) + '%</span>';
  }
  function kpi(k, icon, label, value, sub, extra) {
    return '<div class="glass ad-kpi ad-kpi-' + k + '"><div class="ad-kpi-top"><span class="ad-kpi-ic">' + CodeUtil.tileIcon({ users: 'users', qr: 'folder', pulse: 'qrscan', scan: 'frame' }[icon] || 'frame') + '</span><small>' + label + '</small></div>' +
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
        kpi('users', 'users', t('adm.kUsers'), num(T.users), t('adm.kUsersSub', { active: num(T.active), invited: num(T.invited) }) +
          (data.plans ? '<span class="ad-plans">' + ['free', 'standard', 'pro', 'business'].filter(function (k) { return data.plans[k]; }).map(function (k) { return '<i>' + esc(t('plan.n_' + k)) + ' <b>' + num(data.plans[k]) + '</b></i>'; }).join('') + '</span>' : ''), mix) +
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
      '</div>' +
      '<div class="ad-row three" id="adSystem"></div>';
    wireChart(dash, days); drawSystem();
  }
  function loadDash() {
    if (!me || !me.admin) return;
    api.admin.overview().then(function (r) { data = r; dashErr = false; drawDash(); }).catch(function () { dashErr = true; drawDash(); });
    api.admin.system().then(function (r) { sys = r; drawSystem(); }).catch(function () { sys = { error: true }; drawSystem(); });
  }
  /* ---------- Systeemstatus, aandachtspunten en recente beheeracties ---------- */
  var sys = null;
  function dur(s) { var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? t('adm.upD', { d: d, h: h }) : h ? t('adm.upH', { h: h, m: m }) : t('adm.upM', { m: m }); }
  function drawSystem() {
    var box = document.getElementById('adSystem'); if (!box) return;
    if (!sys) { box.innerHTML = '<div class="glass ad-card ad-skel"></div><div class="glass ad-card ad-skel"></div>'; return; }
    if (sys.error) { box.innerHTML = '<div class="glass ad-card"><p class="acct-msg bad">' + errMsg() + '</p></div>'; return; }
    var row = function (ok, label, value) { return '<li><i class="ad-dot ' + ok + '"></i><span>' + label + '</span><b>' + value + '</b></li>'; };
    var bk = sys.backup.last, bf = sys.backup.failed && (!bk || sys.backup.failed.at > bk.at);
    var status = '<section class="glass ad-card"><div class="ad-card-head"><h3>' + t('adm.system') + '</h3><button type="button" class="link-btn" data-sys-refresh>' + t('ac.refresh') + '</button></div><ul class="ad-sys">' +
      row(sys.db.ok ? 'ok' : 'bad', t('adm.sysDb'), sys.db.ok ? t('adm.sysOk', { ms: num(sys.db.ms) }) + ' · ' + esc(sys.db.kind) : t('adm.sysDown')) +
      row('ok', t('adm.sysUp'), dur(sys.uptime)) +
      row(bf ? 'bad' : bk ? 'ok' : 'warn', t('adm.sysBackup'), bf ? t('adm.sysBackupFailed', { when: ago(sys.backup.failed.at) }) : bk ? ago(bk.at) : t('adm.sysBackupNone')) +
      row(sys.mail.configured ? 'ok' : 'wait', t('adm.sysMail'), sys.mail.configured ? t('adm.sysOn') : t('adm.sysMailLater')) +
      row(sys.deepl.configured ? 'ok' : 'wait', 'DeepL', sys.deepl.configured ? t('adm.sysOn') : t('adm.sysOff')) +
      row(sys.errors.last24h ? 'warn' : 'ok', t('adm.sysErrors'), num(sys.errors.last24h)) +
      '</ul><p class="ad-sys-codes">' + t('adm.sysCodes', { active: num(sys.codes.active), paused: num(sys.codes.paused), stat: num(sys.codes.static), none: num(sys.codes.withoutScans) }) + '</p></section>';
    var warn = '<section class="glass ad-card"><div class="ad-card-head"><h3>' + t('adm.attention') + '</h3></div>' + (sys.warnings.length ? '<ul class="ad-warns">' + sys.warnings.map(function (w) {
      var txt = t('adm.w_' + w.kind, { n: num(w.n || 0) });
      return '<li class="' + w.level + '">' + (w.go ? '<button type="button" class="ad-wbtn" data-wgo="' + w.go + '">' + txt + ico('arrow') + '</button>' : w.kind === 'invites' ? '<button type="button" class="ad-wbtn" data-go-page="customers">' + txt + ico('arrow') + '</button>' : '<span>' + txt + '</span>') + '</li>';
    }).join('') + '</ul>' : '<p class="ad-empty">' + t('adm.allGood') + '</p>') + '</section>';
    var log = '<section class="glass ad-card"><div class="ad-card-head"><h3>' + t('adm.recentActions') + '</h3></div>' + (sys.log.length ? '<ul class="acd-log">' + sys.log.map(function (e) {
      return '<li><span class="acd-dot ' + esc(e.action) + '"></span><span><b>' + esc(t(/^user_/.test(e.action) ? 'adm.log_' + e.action : 'ac.log_' + e.action)) + '</b> · ' + esc(e.adminName || '') + (e.detail ? '<small>' + esc(e.detail) + '</small>' : '') + '</span><time title="' + esc(i18n.fmt.stamp(e.at, 'time')) + '">' + ago(e.at) + '</time></li>';
    }).join('') + '</ul>' : '<p class="ad-empty">' + t('ac.noLog') + '</p>') + '</section>';
    box.innerHTML = status + warn + log;
  }
  document.addEventListener('click', function (e) {
    var w = e.target.closest('[data-wgo]'); if (w && window.AdminCodes) return AdminCodes.filter({ check: w.getAttribute('data-wgo') });
    if (e.target.closest('[data-sys-refresh]')) { sys = null; drawSystem(); api.admin.system().then(function (r) { sys = r; drawSystem(); }).catch(function () { sys = { error: true }; drawSystem(); }); }
  });

  /* Beheer in het menu in- en uitklappen (onthouden in deze browser) */
  (function () {
    var btn = document.getElementById('admToggle'), items = document.getElementById('admItems'); if (!btn || !items) return;
    var closed = false; try { closed = localStorage.getItem('nav.adminClosed') === '1'; } catch (e) {}
    function apply() { btn.setAttribute('aria-expanded', String(!closed)); items.hidden = closed; }
    btn.addEventListener('click', function () { closed = !closed; try { localStorage.setItem('nav.adminClosed', closed ? '1' : '0'); } catch (e) {} apply(); });
    apply();
  })();

  /* Knoppen die naar een andere beheerpagina gaan (dashboard) */
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go-page]'); if (!g) return;
    if (g.hasAttribute('data-add-user')) document.dispatchEvent(new CustomEvent('admin-add-user'));
    goToPage(g.getAttribute('data-go-page'));
  });

  /* Eén menu voor iedereen. Admins zien daarin ook het blok Beheer en beginnen op het Dashboard. */
  Session.onUser(function (u) {
    me = u; var admin = !!(u && u.admin);
    var nav = document.getElementById('navAdmin'); if (nav) nav.hidden = !admin;
    if (!admin) { data = null; return; }
    setTimeout(function () { goToPage(Session.landOn('adminDash')); }, 0);
  });
  document.addEventListener('pagechange', function (e) {
    if (e.detail === 'adminDash') { drawDash(); loadDash(); }
  });
  i18n.onChange(function () { drawDash(); });
  return { avatar: avatar, ago: ago };
})();
