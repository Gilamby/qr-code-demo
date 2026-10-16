/* =========================================================
   BEHEER > ALLE QR-CODES (alleen voor het team)
   Server: /api/admin/codes* (server/src/qr-codes/admin-panel.controller.ts)
   - Tabel met alle codes van alle klanten: voorbeeld, naam, type, id, eigenaar, scans + uniek, laatste scan, datums, status
   - Zoeken (naam, link, klant, e-mail, type, id) + filters die je kunt combineren: type, status, klant, soort (vast/dynamisch),
     aangemaakt, scans, laatste scan, controle (aandacht nodig, gemarkeerd, verdacht, bestemming ontbreekt)
   - Filters blijven bewaard als je naar een andere pagina gaat (en terugkomt)
   - Resultaten per pagina (10/25/50/100), "Alle filters wissen", totaal bij actieve filters
   - Meerdere codes selecteren: pauzeren, activeren, exporteren (CSV), verwijderen
   - Detailpaneel: alles over één code + bewerken, dupliceren, downloaden (PNG/SVG), link kopiëren,
     bestemming controleren, markeren, pauzeren met reden, verwijderen, logboek van het beheer
   - Elke actie vraagt eerst bevestiging. Ververst zichzelf elke minuut (en met de knop), zonder de pagina te herladen.
   - Codes van andere teamleden kan alleen de super-admin aanpassen (de server controleert dit ook)
   ========================================================= */
var AdminCodes = (function () {
  var box = document.getElementById('adminCodesPage');
  if (!box) return {};
  var me = null, res = null, err = false, loading = false, seq = 0, typing = null, updatedAt = null, moreOpen = false;
  var sel = {}, selCount = 0, drawerId = null, detail = null;
  var KEY = 'ac.filters', SIZES = [10, 25, 50, 100];
  var DEF = { q: '', type: '', status: '', sort: 'new', user: '', kind: '', created: '', from: '', to: '', scans: '', last: '', check: '', page: 1, size: 25 };
  var ADV = ['user', 'kind', 'created', 'scans', 'last', 'check'];
  var f = restore();

  /* ---------- Iconen ---------- */
  var IC = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    csv: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.4-4 4.4-6 8-6s6.6 2 8 6"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
    prev: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>',
    chev: '<path d="M6 9l6 6 6-6"/>'
  };
  function ico(k, cls) { return '<svg class="' + (cls || 'ad-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>'; }
  function num(n) { return i18n.fmt.num(n || 0); }
  function date(iso) { return iso ? i18n.fmt.stamp(iso, 'short') : '—'; }
  function full(iso) { return iso ? i18n.fmt.stamp(iso, 'time') : ''; }
  function ago(iso) { return window.Admin && Admin.ago ? Admin.ago(iso) : date(iso); }
  function avatar(o, cls) { return window.Admin && Admin.avatar ? Admin.avatar(o.name, o.email, cls) : ''; }
  function attr(s) { return esc(String(s == null ? '' : s)); }

  /* ---------- Filters bewaren (zolang het tabblad open is) ---------- */
  function restore() {
    var o = {};
    try { o = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch (e) { o = {}; }
    var out = Object.assign({}, DEF); Object.keys(DEF).forEach(function (k) { if (o[k] != null) out[k] = o[k]; });
    try { var s = +localStorage.getItem('ac.size'); if (SIZES.indexOf(s) >= 0) out.size = s; } catch (e) { /* geen opslag */ }
    return out;
  }
  function persist() {
    try { sessionStorage.setItem(KEY, JSON.stringify(f)); } catch (e) { /* geen opslag */ }
    try { localStorage.setItem('ac.size', String(f.size)); } catch (e) { /* geen opslag */ }
  }
  function activeFilters() {
    return ['q', 'type', 'status', 'user', 'kind', 'created', 'scans', 'last', 'check'].filter(function (k) { return f[k] !== ''; });
  }
  function query() {
    var p = Object.assign({}, f);
    // Zoeken op de (vertaalde) naam van een type: "visitekaartje" vindt ook vCards
    var q = f.q.trim().toLowerCase();
    if (q.length > 1) { var ids = QR_TYPES.filter(function (tp) { return typeName(tp).toLowerCase().indexOf(q) >= 0; }).map(function (tp) { return tp.id; }); if (ids.length) p.qt = ids.join(','); }
    if (f.created !== 'custom') { delete p.from; delete p.to; } else delete p.created;
    return p;
  }

  /* ---------- Laden ---------- */
  function load(silent) {
    if (!me || !me.admin) return;
    var my = ++seq; loading = true; setBusy();
    if (!silent && !res) drawList();
    return api.admin.codes(query()).then(function (r) {
      if (my !== seq) return; res = r; err = false; loading = false; updatedAt = new Date();
      if (r.page !== f.page) { f.page = r.page; persist(); }
      drawTools(); drawList();
    }).catch(function () { if (my === seq) { err = true; loading = false; drawList(); setBusy(); } });
  }
  function setBusy() {
    var b = box.querySelector('[data-refresh]'); if (b) { b.classList.toggle('spin', loading); b.setAttribute('aria-busy', String(loading)); }
    var u = box.querySelector('.ac-upd'); if (u) u.textContent = updatedAt ? t('ac.updated', { time: updatedAt.toLocaleTimeString(i18n.lang(), { hour: '2-digit', minute: '2-digit' }) }) : '';
  }

  /* ---------- Opbouw ---------- */
  function draw() {
    if (!me || !me.admin) return;
    box.innerHTML =
      '<header class="help-head ad-head"><div><h2>' + t('adm.allCodes') + '</h2><p>' + t('ac.lead') + '</p></div>' +
        '<div class="ad-head-acts"><span class="ac-upd" aria-live="polite"></span>' +
        '<button type="button" class="btn ghost" data-export>' + ico('csv') + t('ac.exportAll') + '</button></div></header>' +
      '<div id="acTools"></div><div id="acList"></div><div id="acBulk"></div>';
    drawTools(); drawList(); setBusy();
  }
  function opt(v, label, cur) { return '<option value="' + attr(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + label + '</option>'; }
  function select(id, label, cur, opts) {
    return '<label class="ac-f"><span>' + label + '</span><span class="ad-sel"><select id="' + id + '">' + opts.map(function (o) { return opt(o[0], o[1], cur); }).join('') + '</select></span></label>';
  }
  function drawTools() {
    var el = document.getElementById('acTools'); if (!el) return;
    var types = (res && res.types) || [], owners = (res && res.owners) || [], nAdv = ADV.filter(function (k) { return f[k] !== ''; }).length;
    var open = moreOpen || nAdv > 0;
    var focus = document.activeElement && document.activeElement.id, caret = focus === 'adQ' ? document.activeElement.selectionStart : null;
    el.innerHTML =
      '<div class="glass ad-card ad-tools ac-tools">' +
        '<label class="ad-search">' + ico('search') + '<span class="sr-only">' + t('ac.search') + '</span><input type="search" id="adQ" value="' + attr(f.q) + '" placeholder="' + attr(t('ac.search')) + '" autocomplete="off"></label>' +
        '<label class="ad-sel"><span class="sr-only">' + t('myCodes.type') + '</span><select id="adType">' + opt('', t('myCodes.allTypes'), f.type) +
          QR_TYPES.filter(function (tp) { return types.indexOf(tp.id) >= 0 || tp.id === f.type; }).map(function (tp) { return opt(tp.id, esc(typeName(tp)), f.type); }).join('') + '</select></label>' +
        '<label class="ad-sel"><span class="sr-only">' + t('myCodes.sort') + '</span><select id="adSort">' +
          [['new', t('myCodes.sort_new')], ['old', t('myCodes.sort_old')], ['scans', t('myCodes.sort_scans')], ['recent', t('adm.sortRecent')], ['updated', t('ac.sortUpdated')], ['name', t('ac.sortName')]].map(function (o) { return opt(o[0], o[1], f.sort); }).join('') + '</select></label>' +
        '<div class="ad-seg" role="radiogroup" aria-label="' + attr(t('adm.status')) + '">' + [['', t('adm.sAll')], ['active', t('cust.active')], ['paused', t('adm.sPaused')]].map(function (o) {
          return '<button type="button" role="radio" aria-checked="' + (f.status === o[0]) + '" data-status="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        '<button type="button" class="btn ghost ac-more" data-more aria-expanded="' + open + '" aria-controls="acAdv">' + ico('filter') + t('ac.filters') + (nAdv ? '<b class="ac-n">' + nAdv + '</b>' : '') + '</button>' +
      '</div>' +
      '<div class="glass ad-card ac-adv" id="acAdv"' + (open ? '' : ' hidden') + '>' +
        select('acUser', t('ac.fOwner'), f.user, [['', t('ac.anyOwner')]].concat(owners.map(function (o) { return [o.id, esc(o.name || o.email) + ' (' + num(o.codes) + ')']; }))) +
        select('acKind', t('ac.fKind'), f.kind, [['', t('adm.sAll')], ['dynamic', t('ac.dynamic')], ['static', t('ac.static')]]) +
        select('acCreated', t('ac.fCreated'), f.created, [['', t('ac.anyTime')], ['1', t('ac.today')], ['7', t('ac.days', { n: 7 })], ['30', t('ac.days', { n: 30 })], ['90', t('ac.days', { n: 90 })], ['custom', t('ac.custom')]]) +
        (f.created === 'custom' ? '<label class="ac-f"><span>' + t('ac.from') + '</span><input type="date" id="acFrom" value="' + attr(f.from) + '"></label><label class="ac-f"><span>' + t('ac.to') + '</span><input type="date" id="acTo" value="' + attr(f.to) + '"></label>' : '') +
        select('acScans', t('ac.fScans'), f.scans, [['', t('adm.sAll')], ['none', t('ac.noScans')], ['some', t('ac.someScans')], ['100', t('ac.manyScans')]]) +
        select('acLast', t('ac.fLast'), f.last, [['', t('adm.sAll')], ['1', t('ac.last24')], ['7', t('ac.days', { n: 7 })], ['30', t('ac.days', { n: 30 })], ['old', t('ac.lastOld')], ['never', t('ac.lastNever')]]) +
        select('acCheck', t('ac.fCheck'), f.check, [['', t('adm.sAll')], ['attention', t('ac.attention')], ['flagged', t('ac.flagged')], ['risky', t('ac.risky')], ['problem', t('ac.problem')], ['held', t('ac.held')]]) +
      '</div>' + chips();
    if (focus === 'adQ') { var q = document.getElementById('adQ'); q.focus(); if (caret != null) try { q.setSelectionRange(caret, caret); } catch (e) { /* */ } }
  }
  // Actieve filters als chips (met ×), het aantal resultaten en "Alle filters wissen"
  function chips() {
    var act = activeFilters(); if (!act.length) return res ? '<p class="ac-total">' + t('ac.totalAll', { n: num(res.total) }) + '</p>' : '';
    var label = function (k) {
      var v = f[k], owner = res && res.owners.filter(function (o) { return o.id === v; })[0];
      switch (k) {
        case 'q': return '“' + esc(v) + '”';
        case 'type': return esc(typeName(getType(v)) || v);
        case 'status': return v === 'paused' ? t('adm.sPaused') : t('cust.active');
        case 'user': return owner ? esc(owner.name || owner.email) : t('ac.fOwner');
        case 'kind': return v === 'static' ? t('ac.static') : t('ac.dynamic');
        case 'created': return t('ac.fCreated') + ': ' + (v === 'custom' ? esc((f.from || '…') + ' – ' + (f.to || '…')) : v === '1' ? t('ac.today') : t('ac.days', { n: v }));
        case 'scans': return v === 'none' ? t('ac.noScans') : v === 'some' ? t('ac.someScans') : t('ac.manyScans');
        case 'last': return t('ac.fLast') + ': ' + (v === 'never' ? t('ac.lastNever') : v === 'old' ? t('ac.lastOld') : v === '1' ? t('ac.last24') : t('ac.days', { n: v }));
        case 'check': return { attention: t('ac.attention'), flagged: t('ac.flagged'), risky: t('ac.risky'), problem: t('ac.problem'), held: t('ac.held') }[v] || v;
      }
    };
    return '<div class="ac-chips">' + (res ? '<span class="ac-total">' + t('ac.totalOf', { n: num(res.total), all: num(res.all) }) + '</span>' : '') +
      act.map(function (k) { return '<button type="button" class="ac-chip" data-clear="' + k + '" aria-label="' + attr(t('ac.removeFilter')) + '">' + label(k) + ico('x') + '</button>'; }).join('') +
      '<button type="button" class="link-btn" data-clear-all>' + t('ac.clearAll') + '</button></div>';
  }

  /* ---------- Tabel ---------- */
  function warnings(r, compact) {
    var w = [];
    if (r.moderation && r.moderation.flag) w.push(['bad', 'flag', t('ac.flagged'), r.moderation.flag.reason]);
    if (r.problem) w.push(['bad', 'warn', t('ac.prob_' + r.problem), '']);
    if (r.risks && r.risks.length) w.push(['warn', 'warn', t('ac.riskyLink'), r.risks.map(function (k) { return t('ac.risk_' + k); }).join(' · ')]);
    if (r.pattern && r.pattern.length) w.push(['warn', 'warn', t('ac.oddScans'), r.pattern.map(function (k) { return t('ac.pat_' + k); }).join(' · ')]);
    if (r.moderation && r.moderation.hold) w.push(['off', r.moderation.hold.lock ? 'lock' : 'pause', t('ac.heldShort'), r.moderation.hold.reason]);
    return w.map(function (x) { return '<i class="ac-warn ' + x[0] + '" title="' + attr(x[3] || x[2]) + '">' + ico(x[1]) + (compact ? '<span class="sr-only">' : '<span>') + esc(x[2]) + '</span></i>'; }).join('');
  }
  function row(r) {
    var st = r.kind === 'static', on = !!sel[r.id], name = CodeUtil.displayName(r), tp = getType(r.typeId);
    return '<div class="ac-row' + (r.paused ? ' is-paused' : '') + (on ? ' is-sel' : '') + '" role="row" data-id="' + attr(r.id) + '">' +
      '<span class="ac-c ac-cb" role="cell"><input type="checkbox" data-sel' + (on ? ' checked' : '') + ' aria-label="' + attr(t('ac.select', { name: name })) + '"></span>' +
      '<span class="ac-c ac-code" role="cell"><button type="button" class="ac-qr" data-open tabindex="-1" aria-hidden="true">' + CodeUtil.qrSvg(r) + '</button>' +
        '<span class="ac-who"><button type="button" class="ac-name" data-open title="' + attr(name) + '">' + esc(name) + '</button>' +
        '<span class="ac-sub">' + (tp ? '<span class="ac-type" title="' + attr(typeName(tp)) + '">' + svg(tp.icon, 1.8) + esc(typeName(tp)) + '</span>' : '') +
          '<span class="ac-kind ' + r.kind + '">' + t(st ? 'ac.static' : 'ac.dynamic') + '</span><code class="ac-id" title="ID">' + esc(r.id) + '</code></span>' +
        (st ? '<span class="ac-dest muted">' + t('adm.static') + '</span>' : '<span class="ac-dest"><a href="' + attr(r.shortUrl) + '" target="_blank" rel="noopener" title="' + attr(r.dest.value || r.shortUrl) + '">' + esc((r.dest.value || r.shortUrl).replace(/^https?:\/\/(www\.)?/, '')) + '</a>' +
          '<button type="button" class="ac-mini" data-act="copy" title="' + attr(t('adm.copyLink')) + '" aria-label="' + attr(t('adm.copyLink')) + '">' + ico('copy') + '</button></span>') +
      '</span></span>' +
      '<span class="ac-c ac-owner" role="cell">' + (r.owner ? '<button type="button" class="ac-ownbtn" data-owner title="' + attr(t('ac.openOwner')) + '">' + avatar(r.owner, 'ad-av s') + '<span><b>' + esc(r.owner.name || r.owner.email) + '</b><small>' + esc(r.owner.email) + '</small></span></button>' : '<span class="muted">—</span>') + '</span>' +
      '<span class="ac-c ac-num" role="cell" data-label="' + attr(t('an.scans')) + '">' + (st ? '<span class="muted">—</span>' : '<b>' + num(r.scans) + '</b><small>' + t('ac.uniqN', { n: num(r.uniq) }) + '</small>') + '</span>' +
      '<span class="ac-c ac-date" role="cell" data-label="' + attr(t('ac.lastScan')) + '">' + (st ? '<span class="muted">—</span>' : r.lastScanAt ? '<span title="' + attr(full(r.lastScanAt)) + '">' + ago(r.lastScanAt) + '</span>' : '<span class="muted">' + t('adm.never') + '</span>') + '</span>' +
      '<span class="ac-c ac-date" role="cell" data-label="' + attr(t('ac.created')) + '"><span title="' + attr(full(r.createdAt)) + '">' + date(r.createdAt) + '</span>' + (r.updatedAt ? '<small title="' + attr(full(r.updatedAt)) + '">' + t('ac.editedAgo', { when: ago(r.updatedAt) }) + '</small>' : '') + '</span>' +
      '<span class="ac-c ac-st" role="cell"><i class="ad-pill ' + (r.paused ? 'off' : 'ok') + '">' + (st ? t('ac.alwaysOn') : r.paused ? t('adm.sPaused') : t('cust.active')) + '</i>' + warnings(r, true) + '</span>' +
      '<span class="ac-c ac-acts" role="cell">' +
        (st ? '' : '<button type="button" class="ad-ibtn" data-act="pause"' + (r.canEdit ? '' : ' disabled') + ' title="' + attr(t(r.paused ? 'adm.resume' : 'adm.pause')) + '" aria-label="' + attr(t(r.paused ? 'adm.resume' : 'adm.pause')) + '">' + ico(r.paused ? 'play' : 'pause') + '</button>') +
        '<button type="button" class="ad-ibtn" data-act="dl" title="' + attr(t('ac.downloadPng')) + '" aria-label="' + attr(t('ac.downloadPng')) + '">' + ico('dl') + '</button>' +
        '<button type="button" class="ad-ibtn danger" data-act="del"' + (r.canEdit ? '' : ' disabled') + ' title="' + attr(t('cust.remove')) + '" aria-label="' + attr(t('cust.remove')) + '">' + ico('trash') + '</button>' +
        '<button type="button" class="ad-ibtn" data-open title="' + attr(t('ac.details')) + '" aria-label="' + attr(t('ac.details')) + '">' + ico('next') + '</button>' +
      '</span></div>';
  }
  function pager() {
    if (!res || !res.total) return '';
    var from = (res.page - 1) * res.pageSize + 1, to = Math.min(res.total, res.page * res.pageSize), nums = [];
    for (var i = 1; i <= res.pages; i++) if (i === 1 || i === res.pages || Math.abs(i - res.page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
    return '<nav class="glass ad-pager ac-pager" aria-label="' + attr(t('adm.pages')) + '"><span>' + t('adm.showing', { from: num(from), to: num(to), total: num(res.total) }) + '</span>' +
      '<label class="ac-size"><span>' + t('ac.perPage') + '</span><span class="ad-sel"><select id="acSize">' + SIZES.map(function (n) { return opt(n, n, f.size); }).join('') + '</select></span></label>' +
      (res.pages > 1 ? '<span class="ad-pages">' +
        '<button type="button" class="ad-ibtn" data-page="' + (res.page - 1) + '"' + (res.page <= 1 ? ' disabled' : '') + ' aria-label="' + attr(t('adm.prev')) + '">' + ico('prev') + '</button>' +
        nums.map(function (n) { return n === '…' ? '<span class="ad-dots">…</span>' : '<button type="button" class="ad-pnum" data-page="' + n + '"' + (n === res.page ? ' aria-current="page"' : '') + '>' + n + '</button>'; }).join('') +
        '<button type="button" class="ad-ibtn" data-page="' + (res.page + 1) + '"' + (res.page >= res.pages ? ' disabled' : '') + ' aria-label="' + attr(t('adm.next')) + '">' + ico('next') + '</button></span>' : '') + '</nav>';
  }
  function drawList() {
    var el = document.getElementById('acList'); if (!el) return;
    if (err) { el.innerHTML = '<div class="glass ad-card ad-none">' + ico('warn', 'ad-none-ic') + '<p>' + t('ac.loadError') + '</p><button type="button" class="btn ghost" data-refresh>' + ico('refresh') + t('ac.retry') + '</button></div>'; drawBulk(); return; }
    if (!res) { el.innerHTML = '<div class="glass ac-table ac-skel-t">' + [1, 2, 3, 4, 5].map(function () { return '<div class="ac-row ad-skel"></div>'; }).join('') + '</div>'; return; }
    if (!res.items.length) {
      el.innerHTML = '<div class="glass ad-card ad-none">' + ico('search', 'ad-none-ic') + '<p>' + (res.all ? t('adm.noMatch') : t('adm.noCodes')) + '</p>' +
        (activeFilters().length ? '<button type="button" class="btn ghost" data-clear-all>' + t('ac.clearAll') + '</button>' : '') + '</div>';
      drawBulk(); return;
    }
    var page = res.items.map(function (r) { return r.id; }), onPage = page.filter(function (id) { return sel[id]; }).length;
    el.innerHTML = '<div class="glass ac-table" role="table" aria-label="' + attr(t('adm.allCodes')) + '" aria-rowcount="' + res.total + '">' +
      '<div class="ac-row ac-head" role="row">' +
        '<span class="ac-c ac-cb" role="columnheader"><input type="checkbox" data-sel-page' + (onPage === page.length ? ' checked' : '') + ' aria-label="' + attr(t('ac.selectPage')) + '"></span>' +
        '<span class="ac-c" role="columnheader">' + t('ac.colCode') + '</span><span class="ac-c" role="columnheader">' + t('ac.colOwner') + '</span>' +
        '<span class="ac-c ac-num" role="columnheader">' + t('an.scans') + '</span><span class="ac-c" role="columnheader">' + t('ac.lastScan') + '</span>' +
        '<span class="ac-c" role="columnheader">' + t('ac.created') + '</span><span class="ac-c" role="columnheader">' + t('adm.status') + '</span><span class="ac-c" role="columnheader"><span class="sr-only">' + t('ac.actions') + '</span></span></div>' +
      res.items.map(row).join('') + '</div>' + pager();
    var all = el.querySelector('[data-sel-page]'); if (all) all.indeterminate = onPage > 0 && onPage < page.length;
    drawBulk();
  }

  /* ---------- Selectie en bulkacties ---------- */
  function setSel(id, on) { if (on && !sel[id]) { sel[id] = 1; selCount++; } else if (!on && sel[id]) { delete sel[id]; selCount--; } }
  function clearSel() { sel = {}; selCount = 0; }
  function drawBulk() {
    var el = document.getElementById('acBulk'); if (!el) return;
    if (!selCount) { el.innerHTML = ''; return; }
    var canAll = res && res.total > selCount && res.total <= 500;
    el.innerHTML = '<div class="glass ac-bulk" role="region" aria-label="' + attr(t('ac.bulk')) + '"><b>' + t('ac.selected', { n: num(selCount) }) + '</b>' +
      (canAll ? '<button type="button" class="link-btn" data-sel-all>' + t('ac.selectAll', { n: num(res.total) }) + '</button>' : '') +
      '<span class="ac-bulk-acts">' +
        '<button type="button" class="btn ghost" data-bulk="pause">' + ico('pause') + t('adm.pause') + '</button>' +
        '<button type="button" class="btn ghost" data-bulk="resume">' + ico('play') + t('ac.activate') + '</button>' +
        '<button type="button" class="btn ghost" data-bulk="export">' + ico('csv') + t('ac.export') + '</button>' +
        '<button type="button" class="btn danger" data-bulk="delete">' + ico('trash') + t('cust.remove') + '</button>' +
        '<button type="button" class="ad-ibtn" data-sel-none title="' + attr(t('ac.clearSel')) + '" aria-label="' + attr(t('ac.clearSel')) + '">' + ico('x') + '</button>' +
      '</span></div>';
  }
  function selIds() { return Object.keys(sel); }

  /* ---------- Melding onderin ---------- */
  var toastEl = document.getElementById('mcToast'), toastTm = null;
  function toast(text) {
    if (!toastEl) return; toastEl.textContent = text; toastEl.hidden = false; toastEl.classList.add('show');
    clearTimeout(toastTm); toastTm = setTimeout(function () { toastEl.classList.remove('show'); setTimeout(function () { toastEl.hidden = true; }, 250); }, 2600);
  }
  function errText(x) { return x && x.status === 403 ? t('ac.noRights') : t('auth.errGeneral'); }
  function copy(text, msg) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast(msg || t('adm.copied')); }, function () { toast(text); }); }

  /* ---------- Bevestigingsvensters ---------- */
  var dlg = document.getElementById('mcDialog');
  var REASONS = { pause: ['abuse', 'phishing', 'customer', 'billing', 'other'], flag: ['phishing', 'malware', 'spam', 'illegal', 'other'] };
  // Eén venster voor alle acties: titel, tekst, eventueel reden/checkbox, knop. onOk(values) moet een Promise geven.
  function confirmBox(o) {
    var reasons = o.reasons ? REASONS[o.reasons] : null;
    dlg.innerHTML = '<form method="dialog" class="mc-dlg ac-dlg"><span class="mc-dlg-ic ' + (o.tone || '') + '">' + ico(o.icon || 'warn', 'mc-i') + '</span><h3>' + o.title + '</h3>' + (o.text ? '<p>' + o.text + '</p>' : '') + (o.extra || '') +
      (reasons ? '<label class="auth-f ac-dlg-f"><span>' + t('ac.reason') + '</span><select name="preset">' + reasons.map(function (k) { return '<option value="' + k + '">' + t('ac.r_' + k) + '</option>'; }).join('') + '</select></label>' +
        '<label class="auth-f ac-dlg-f"><span>' + t('ac.note') + ' <small>(' + t('ac.optional') + ')</small></span><textarea name="note" rows="2" maxlength="240"></textarea></label>' : '') +
      (o.lock ? '<label class="ac-check"><input type="checkbox" name="unlock"><span>' + t('ac.unlock') + '</span></label>' : '') +
      (o.sure ? '<label class="ac-check"><input type="checkbox" name="sure" required><span>' + o.sure + '</span></label>' : '') +
      '<p class="acct-msg bad" data-msg hidden></p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel" type="button" data-cancel>' + t('myCodes.cancel') + '</button><button class="btn ' + (o.tone === 'danger' ? 'danger' : 'primary') + '" type="submit" data-ok>' + o.ok + '</button></div></form>';
    var form = dlg.querySelector('form'), okBtn = form.querySelector('[data-ok]'), msg = form.querySelector('[data-msg]');
    var preset = form.querySelector('[name=preset]'), unlock = form.querySelector('[name=unlock]');
    if (preset && unlock) preset.addEventListener('change', function () { unlock.checked = preset.value === 'customer'; });
    form.querySelector('[data-cancel]').onclick = function () { dlg.close(); };
    form.onsubmit = function (ev) {
      ev.preventDefault();
      var sure = form.querySelector('[name=sure]'); if (sure && !sure.checked) { sure.focus(); return; }
      var note = form.querySelector('[name=note]'), reason = preset ? (t('ac.r_' + preset.value) + (note && note.value.trim() ? ': ' + note.value.trim() : '')) : '';
      okBtn.disabled = true; msg.hidden = true;
      o.onOk({ reason: reason, lock: unlock ? !unlock.checked : undefined }).then(function () { dlg.close(); }).catch(function (x) { okBtn.disabled = false; msg.textContent = (x && x.message && x.local) ? x.message : errText(x); msg.hidden = false; });
    };
    dlg.showModal(); (preset || okBtn).focus();
  }
  function namesOf(rows) {
    var names = rows.slice(0, 5).map(function (r) { return '<li>' + esc(CodeUtil.displayName(r)) + (r.owner ? ' <small>· ' + esc(r.owner.name || r.owner.email) + '</small>' : '') + '</li>'; }).join('');
    return '<ul class="ac-dlg-list">' + names + (rows.length > 5 ? '<li class="muted">' + t('ac.andMore', { n: num(rows.length - 5) }) + '</li>' : '') + '</ul>';
  }
  function findRow(id) { return (res && res.items.filter(function (x) { return x.id === id; })[0]) || (detail && detail.id === id ? detail : null); }

  /* ---------- Acties op één code ---------- */
  function afterChange(updated) {
    if (updated && res) res.items = res.items.map(function (x) { return x.id === updated.id ? Object.assign({}, x, updated) : x; });
    drawList(); if (drawerId) openDrawer(drawerId, true); load(true);
  }
  function pauseOne(r) {
    if (r.paused) {
      return confirmBox({ icon: 'play', title: t('ac.resumeTitle', { name: esc(CodeUtil.displayName(r)) }), text: t('ac.resumeText') + (r.moderation && r.moderation.hold && r.moderation.hold.reason ? '<br><small>' + t('ac.pausedFor', { reason: esc(r.moderation.hold.reason) }) + '</small>' : ''), ok: t('adm.resume'),
        onOk: function () { return api.admin.patchCode(r.id, { paused: false }).then(function (x) { toast(t('adm.resumed')); afterChange(x); }); } });
    }
    confirmBox({ icon: 'pause', title: t('ac.pauseTitle', { name: esc(CodeUtil.displayName(r)) }), text: t('ac.pauseText', { owner: esc(r.owner ? r.owner.name || r.owner.email : '') }), reasons: 'pause', lock: true, ok: t('adm.pause'),
      onOk: function (v) { return api.admin.patchCode(r.id, { paused: true, reason: v.reason, lock: v.lock }).then(function (x) { toast(t('adm.paused')); afterChange(x); }); } });
  }
  function deleteOne(r) {
    confirmBox({ icon: 'trash', tone: 'danger', title: t('adm.delTitle', { name: esc(CodeUtil.displayName(r)) }),
      text: t('ac.delText', { owner: esc(r.owner ? r.owner.name || r.owner.email : ''), scans: num(r.scans) }), sure: t('ac.sure'), ok: t('ac.delForever'),
      onOk: function () { return api.admin.removeCode(r.id).then(function () { setSel(r.id, false); toast(t('adm.deleted')); closeDrawer(); load(true); }); } });
  }
  function flagOne(r) {
    if (r.moderation && r.moderation.flag) {
      return confirmBox({ icon: 'flag', title: t('ac.unflagTitle'), text: t('ac.unflagText'), ok: t('ac.unflag'),
        onOk: function () { return api.admin.patchCode(r.id, { flag: false }).then(function (x) { toast(t('ac.unflagged')); afterChange(x); }); } });
    }
    confirmBox({ icon: 'flag', title: t('ac.flagTitle', { name: esc(CodeUtil.displayName(r)) }), text: t('ac.flagText'), reasons: 'flag', ok: t('ac.flag'),
      onOk: function (v) { return api.admin.patchCode(r.id, { flag: true, reason: v.reason }).then(function (x) { toast(t('ac.flaggedMsg')); afterChange(x); }); } });
  }
  function duplicateOne(r) {
    confirmBox({ icon: 'dup', title: t('ac.dupTitle', { name: esc(CodeUtil.displayName(r)) }), text: t('ac.dupText', { owner: esc(r.owner ? r.owner.name || r.owner.email : '') }), ok: t('ac.duplicate'),
      onOk: function () { return api.admin.duplicateCode(r.id).then(function (x) { toast(t('ac.duplicated')); openDrawer(x.id); load(true); }); } });
  }
  function download(r, fmt) {
    // Via de server (wordt gelogd; bij wifi komt het wachtwoord mee als je de code mag aanpassen, anders klopt de QR-code niet)
    api.admin.code(r.id, 'for=download&format=' + fmt).then(function (x) { CodeUtil.download(x, fmt); }).catch(function (x) { toast(errText(x)); });
  }
  function editOne(d) {
    var tp = getType(d.typeId), fields = (tp ? tp.fields : []).filter(function (fl) { return d.editable.indexOf(fl.key) >= 0 && fl.label !== 'fields.qrName'; });   // 'Naam van de QR-code' = het naamveld hierboven
    var input = function (fl) {
      var v = d.content[fl.key] == null ? '' : d.content[fl.key], type = { url: 'url', email: 'email', tel: 'tel', date: 'date', number: 'number' }[fl.type] || 'text';
      if (fl.type === 'select') return '<select name="f_' + fl.key + '">' + fl.options.map(function (o) { return opt(o.value, esc(t(o.label || o.value)), v); }).join('') + '</select>';
      return '<input name="f_' + fl.key + '" type="' + type + '" value="' + attr(v) + '"' + (fl.required ? ' required' : '') + '>';
    };
    dlg.innerHTML = '<form class="mc-dlg ac-dlg ac-edit"><span class="mc-dlg-ic ok">' + ico('edit', 'mc-i') + '</span><h3>' + t('ac.editTitle') + '</h3><p>' + t('ac.editText', { owner: esc(d.owner ? d.owner.name || d.owner.email : '') }) + '</p>' +
      '<label class="auth-f ac-dlg-f"><span>' + t('ac.name') + '</span><input name="name" maxlength="60" value="' + attr(d.name || '') + '" placeholder="' + attr(CodeUtil.displayName(d)) + '"></label>' +
      fields.map(function (fl) { return '<label class="auth-f ac-dlg-f"><span>' + esc(t(fl.label)) + (fl.required ? '' : ' <small>(' + t('ac.optional') + ')</small>') + '</span>' + input(fl) + '</label>'; }).join('') +
      '<p class="ac-hint">' + t('ac.editHint') + '</p><p class="acct-msg bad" data-msg hidden></p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" type="button" data-cancel>' + t('myCodes.cancel') + '</button><button class="btn primary" type="submit">' + t('ac.save') + '</button></div></form>';
    var form = dlg.querySelector('form'), msg = form.querySelector('[data-msg]');
    form.querySelector('[data-cancel]').onclick = function () { dlg.close(); };
    form.onsubmit = function (ev) {
      ev.preventDefault();
      var content = {}; fields.forEach(function (fl) { content[fl.key] = form.querySelector('[name="f_' + fl.key + '"]').value; });
      var btn = form.querySelector('[type=submit]'); btn.disabled = true; msg.hidden = true;
      api.admin.patchCode(d.id, { name: form.querySelector('[name=name]').value, content: content }).then(function (x) { dlg.close(); toast(t('ac.saved')); afterChange(x); })
        .catch(function (x) {
          btn.disabled = false;
          var bad = (x && x.details || []).map(function (s) { var k = String(s).split(':')[0], fl = fields.filter(function (q) { return q.key === k; })[0]; return fl ? t(fl.label) : k; });
          msg.textContent = bad.length ? t('ac.checkFields', { fields: bad.join(', ') }) : errText(x); msg.hidden = false;
        });
    };
    dlg.showModal(); form.querySelector('[name=name]').focus();
  }

  /* ---------- Bulk ---------- */
  function bulk(action) {
    var ids = selIds(); if (!ids.length) return;
    var rows = ids.map(function (id) { return findRow(id) || { id: id }; });
    if (action === 'export') return exportCsv(ids);
    var run = function (v) {
      return api.admin.bulk({ ids: ids, action: action, reason: v.reason, lock: v.lock }).then(function (r) {
        var parts = [t('ac.bulkDone', { n: num(r.done) })];
        if (r.skipped) parts.push(t('ac.bulkSkipped', { n: num(r.skipped) }));
        if (r.forbidden) parts.push(t('ac.bulkForbidden', { n: num(r.forbidden) }));
        toast(parts.join(' · ')); if (action === 'delete') clearSel(); load(true);
      });
    };
    if (action === 'pause') return confirmBox({ icon: 'pause', title: t('ac.bulkPauseTitle', { n: num(ids.length) }), text: t('ac.bulkPauseText') + namesOf(rows.filter(function (r) { return r.typeId; })), reasons: 'pause', lock: true, ok: t('adm.pause'), onOk: run });
    if (action === 'resume') return confirmBox({ icon: 'play', title: t('ac.bulkResumeTitle', { n: num(ids.length) }), text: t('ac.bulkResumeText'), ok: t('ac.activate'), onOk: run });
    if (action === 'delete') return confirmBox({ icon: 'trash', tone: 'danger', title: t('ac.bulkDelTitle', { n: num(ids.length) }), text: t('ac.bulkDelText') + namesOf(rows.filter(function (r) { return r.typeId; })), sure: t('ac.sure'), ok: t('ac.delForever'), onOk: run });
  }
  function exportCsv(ids) {
    var p = query(); delete p.page; delete p.size;
    api.admin.exportCodes({ filters: p, ids: ids || [] }).then(function (blob) {
      saveFile(blob, 'qr-codes-' + new Date().toISOString().slice(0, 10) + '.csv'); toast(t('ac.exported'));
    }).catch(function (x) { toast(errText(x)); });
  }

  /* ---------- Detailpaneel ---------- */
  var drawer = document.createElement('dialog'); drawer.className = 'ac-drawer'; drawer.setAttribute('aria-labelledby', 'acdTitle'); document.body.appendChild(drawer);
  drawer.addEventListener('click', function (e) { if (e.target === drawer) closeDrawer(); });
  drawer.addEventListener('close', function () { drawerId = null; detail = null; });
  function closeDrawer() { if (drawer.open) drawer.close(); }
  function openDrawer(id, quiet) {
    drawerId = id;
    if (!quiet) { drawer.innerHTML = '<div class="acd"><div class="acd-load ad-skel"></div></div>'; if (!drawer.open) drawer.showModal(); }
    api.admin.code(id).then(function (d) { if (drawerId !== id) return; detail = d; drawDrawer(); })
      .catch(function (x) { if (drawerId !== id) return; drawer.innerHTML = '<div class="acd"><button type="button" class="acd-x" data-close aria-label="' + attr(t('legal.close')) + '">' + ico('x') + '</button><p class="acct-msg bad">' + (x && x.status === 404 ? t('ac.gone') : t('ac.loadError')) + '</p></div>'; });
  }
  function kv(label, value) { return '<div class="acd-kv"><dt>' + label + '</dt><dd>' + value + '</dd></div>'; }
  function logLine(e) {
    return '<li><span class="acd-dot ' + esc(e.action) + '"></span><span><b>' + t('ac.log_' + e.action) + '</b> · ' + esc(e.adminName || '') + (e.detail ? '<small>' + esc(e.detail) + '</small>' : '') + '</span><time title="' + attr(full(e.at)) + '">' + ago(e.at) + '</time></li>';
  }
  function drawDrawer() {
    var d = detail, st = d.kind === 'static', tp = getType(d.typeId), name = CodeUtil.displayName(d), can = d.canEdit, hold = d.moderation && d.moderation.hold, flag = d.moderation && d.moderation.flag;
    var plan = d.plan || {}, planLine = t('ac.plan_' + (plan.id || 'free')) + ' · ' + (plan.limit == null ? t('ac.codesNoLimit', { n: num(plan.used) }) : t('ac.codesOf', { n: num(plan.used), limit: num(plan.limit) }));
    var destVal = d.dest && d.dest.value;
    drawer.innerHTML = '<div class="acd">' +
      '<header class="acd-head"><button type="button" class="acd-x" data-close aria-label="' + attr(t('legal.close')) + '">' + ico('x') + '</button>' +
        '<span class="acd-qr' + (d.paused ? ' is-paused' : '') + '">' + CodeUtil.qrSvg(d) + '</span>' +
        '<div><h3 id="acdTitle">' + esc(name) + '</h3><div class="acd-tags">' + (tp ? '<span class="ad-type">' + svg(tp.icon, 1.8) + esc(typeName(tp)) + '</span>' : '') +
          '<span class="ac-kind ' + d.kind + '">' + t(st ? 'ac.static' : 'ac.dynamic') + '</span><i class="ad-pill ' + (d.paused ? 'off' : 'ok') + '">' + (st ? t('ac.alwaysOn') : d.paused ? t('adm.sPaused') : t('cust.active')) + '</i></div></div></header>' +
      (!can ? '<p class="acd-note">' + ico('lock') + t('ac.teamCode') + '</p>' : '') +
      (warnings(d) ? '<div class="acd-warns">' + warnings(d) + '</div>' : '') +
      '<div class="acd-acts">' +
        '<button type="button" class="btn ghost" data-d="edit"' + (can ? '' : ' disabled') + '>' + ico('edit') + t('ac.edit') + '</button>' +
        '<button type="button" class="btn ghost" data-d="dup"' + (can ? '' : ' disabled') + '>' + ico('dup') + t('ac.duplicate') + '</button>' +
        (st ? '' : '<button type="button" class="btn ghost" data-d="pause"' + (can ? '' : ' disabled') + '>' + ico(d.paused ? 'play' : 'pause') + t(d.paused ? 'adm.resume' : 'adm.pause') + '</button>') +
        '<button type="button" class="btn ghost" data-d="flag"' + (can ? '' : ' disabled') + '>' + ico('flag') + t(flag ? 'ac.unflag' : 'ac.flag') + '</button>' +
        '<button type="button" class="btn ghost" data-d="png">' + ico('dl') + 'PNG</button><button type="button" class="btn ghost" data-d="svg">' + ico('dl') + 'SVG</button>' +
        '<button type="button" class="btn danger" data-d="del"' + (can ? '' : ' disabled') + '>' + ico('trash') + t('cust.remove') + '</button></div>' +
      '<section class="acd-sec"><h4>' + t('ac.secInfo') + '</h4><dl>' +
        kv('ID', '<code>' + esc(d.id) + '</code><button type="button" class="ac-mini" data-d="copyid" aria-label="' + attr(t('ac.copyId')) + '" title="' + attr(t('ac.copyId')) + '">' + ico('copy') + '</button>') +
        kv(t('ac.fKind'), st ? t('ac.staticLong') : t('ac.dynamicLong')) +
        kv(t('ac.created'), esc(full(d.createdAt))) +
        kv(t('ac.updated2'), d.updatedAt ? esc(full(d.updatedAt)) + ' <small>(' + ago(d.updatedAt) + ')</small>' : '<span class="muted">' + t('ac.notEdited') + '</span>') +
        (st ? '' : kv(t('ac.lastScan'), d.lastScanAt ? esc(full(d.lastScanAt)) + ' <small>(' + ago(d.lastScanAt) + ')</small>' : '<span class="muted">' + t('adm.never') + '</span>') +
          kv(t('an.scans'), '<b>' + num(d.scans) + '</b> · ' + t('ac.uniqN', { n: num(d.uniq) }))) +
      '</dl></section>' +
      '<section class="acd-sec"><h4>' + t('ac.secDest') + '</h4>' +
        (st ? '<p class="muted">' + t('ac.staticDest') + '</p>' :
          '<div class="acd-link"><span>' + t('ac.shortLink') + '</span><a href="' + attr(d.shortUrl) + '" target="_blank" rel="noopener">' + esc(d.shortUrl.replace(/^https?:\/\//, '')) + '</a><button type="button" class="ac-mini" data-d="copyshort" aria-label="' + attr(t('adm.copyLink')) + '">' + ico('copy') + '</button></div>' +
          (destVal ? '<div class="acd-link"><span>' + t(d.dest.kind === 'file' ? 'ac.destFile' : 'ac.destUrl') + '</span>' + (/^https?:/i.test(destVal) ? '<a href="' + attr(destVal) + '" target="_blank" rel="noopener noreferrer" title="' + attr(destVal) + '">' + esc(destVal) + '</a>' : '<b title="' + attr(destVal) + '">' + esc(destVal) + '</b>') +
            '<button type="button" class="ac-mini" data-d="copydest" aria-label="' + attr(t('ac.copyDest')) + '">' + ico('copy') + '</button></div>' : d.dest.kind === 'page' ? '<p class="muted">' + t('ac.ownPage') + '</p>' : '') +
          (d.risks.length ? '<p class="acd-risk">' + ico('warn') + '<span><b>' + t('ac.riskyLink') + '</b>' + d.risks.map(function (k) { return t('ac.risk_' + k); }).join(' · ') + '</span></p>' : '') +
          (destVal && /^https?:/i.test(destVal) ? '<div class="acd-check"><button type="button" class="btn ghost" data-d="check">' + ico('globe') + t('ac.checkDest') + '</button><span id="acdCheck" aria-live="polite"></span></div>' : '')) +
      '</section>' +
      '<section class="acd-sec"><h4>' + t('ac.secOwner') + '</h4>' + (d.owner ? '<div class="acd-owner">' + avatar(d.owner) + '<span><b>' + esc(d.owner.name || d.owner.email) + '</b><small>' + esc(d.owner.email) + '</small><small>' + t('adm.r' + { super: 'Super', admin: 'Admin', user: 'User' }[d.owner.level]) + ' · ' + esc(planLine) + '</small></span>' +
          '<button type="button" class="btn ghost" data-d="owner">' + ico('user') + t('ac.openOwner') + '</button></div>' +
          (plan.state && plan.state !== 'ok' ? '<p class="acd-risk">' + ico('warn') + '<span>' + t(plan.state === 'full' ? 'ac.limitFull' : 'ac.limitNear') + '</span></p>' : '') +
          '<button type="button" class="link-btn" data-d="ownerCodes">' + t('ac.allOfOwner', { n: num(d.owner.codes) }) + ico('next') + '</button>' : '<p class="muted">—</p>') + '</section>' +
      ((hold || flag) ? '<section class="acd-sec"><h4>' + t('ac.secMod') + '</h4>' +
        (hold ? '<p class="acd-mod">' + ico(hold.lock ? 'lock' : 'pause') + '<span><b>' + t('ac.pausedBy', { name: esc(hold.byName || '') }) + '</b>' + esc(hold.reason || t('ac.noReason')) + '<small>' + esc(full(hold.at)) + ' · ' + t(hold.lock ? 'ac.locked' : 'ac.unlocked') + '</small></span></p>' : '') +
        (flag ? '<p class="acd-mod bad">' + ico('flag') + '<span><b>' + t('ac.flaggedBy', { name: esc(flag.byName || '') }) + '</b>' + esc(flag.reason || t('ac.noReason')) + '<small>' + esc(full(flag.at)) + '</small></span></p>' : '') + '</section>' : '') +
      '<section class="acd-sec"><h4>' + t('ac.secLog') + '</h4>' + (d.log && d.log.length ? '<ul class="acd-log">' + d.log.map(logLine).join('') + '</ul>' : '<p class="muted">' + t('ac.noLog') + '</p>') + '</section>' +
    '</div>';
  }
  function checkDest() {
    var out = document.getElementById('acdCheck'), id = drawerId; if (!out) return;
    out.className = 'muted'; out.textContent = t('ac.checking');
    api.admin.checkCode(id).then(function (r) {
      if (drawerId !== id) return;
      out.className = r.ok ? 'ok' : 'bad';
      out.innerHTML = r.status ? (r.ok ? ico('check') : ico('warn')) + esc(t(r.ok ? 'ac.destOk' : 'ac.destBad', { status: r.status })) + (r.title ? ' · <i>' + esc(r.title) + '</i>' : '') + (r.redirected ? '<small>' + t('ac.redirects', { url: esc(r.finalUrl) }) + '</small>' : '')
        : ico('warn') + esc(t('ac.dest_' + (r.reason || 'unreachable')));
    }).catch(function () { out.className = 'bad'; out.textContent = t('ac.dest_unreachable'); });
  }
  drawer.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) return closeDrawer();
    var b = e.target.closest('[data-d]'); if (!b || b.disabled || !detail) return;
    var d = detail, k = b.getAttribute('data-d');
    if (k === 'edit') return editOne(d);
    if (k === 'dup') return duplicateOne(d);
    if (k === 'pause') return pauseOne(d);
    if (k === 'flag') return flagOne(d);
    if (k === 'del') return deleteOne(d);
    if (k === 'png' || k === 'svg') return download(d, k);
    if (k === 'copyid') return copy(d.id, t('ac.idCopied'));
    if (k === 'copyshort') return copy(d.shortUrl);
    if (k === 'copydest') return copy(d.dest.value, t('ac.destCopied'));
    if (k === 'check') return checkDest();
    if (k === 'owner') { closeDrawer(); return showOwner(d.owner); }
    if (k === 'ownerCodes') { closeDrawer(); Object.assign(f, DEF, { size: f.size, user: d.owner.id }); moreOpen = true; persist(); clearSel(); drawTools(); return load(); }
  });
  function showOwner(o) { if (!o) return; goToPage('customers'); document.dispatchEvent(new CustomEvent('admin-show-user', { detail: o.email })); }

  /* ---------- Invoer ---------- */
  function setF(k, v) { f[k] = v; f.page = 1; persist(); drawTools(); load(); }
  box.addEventListener('input', function (e) {
    if (e.target.id !== 'adQ') return;
    f.q = e.target.value; f.page = 1; persist(); clearTimeout(typing); typing = setTimeout(function () { load(); }, 220);
  });
  box.addEventListener('change', function (e) {
    var id = e.target.id, map = { adType: 'type', adSort: 'sort', acUser: 'user', acKind: 'kind', acCreated: 'created', acScans: 'scans', acLast: 'last', acCheck: 'check', acFrom: 'from', acTo: 'to' };
    if (map[id]) { if (id === 'adSort') { f.sort = e.target.value; persist(); return load(); } return setF(map[id], e.target.value); }
    if (id === 'acSize') { f.size = +e.target.value; f.page = 1; persist(); return load(); }
    if (e.target.hasAttribute('data-sel')) { var rid = e.target.closest('[data-id]').getAttribute('data-id'); setSel(rid, e.target.checked); e.target.closest('.ac-row').classList.toggle('is-sel', e.target.checked); return updateHead(); }
    if (e.target.hasAttribute('data-sel-page')) { var on = e.target.checked; res.items.forEach(function (r) { setSel(r.id, on); }); return drawList(); }
  });
  function updateHead() {
    var h = box.querySelector('[data-sel-page]'); if (h && res) { var n = res.items.filter(function (r) { return sel[r.id]; }).length; h.checked = n === res.items.length; h.indeterminate = n > 0 && n < res.items.length; }
    drawBulk();
  }
  box.addEventListener('click', function (e) {
    var x;
    if ((x = e.target.closest('[data-status]'))) return setF('status', x.getAttribute('data-status'));
    if (e.target.closest('[data-more]')) { moreOpen = !(moreOpen || ADV.some(function (k) { return f[k] !== ''; })); if (!moreOpen) ADV.forEach(function (k) { f[k] = ''; }); persist(); drawTools(); if (!moreOpen) load(); return; }
    if ((x = e.target.closest('[data-clear]'))) { var k = x.getAttribute('data-clear'); f[k] = ''; if (k === 'created') { f.from = ''; f.to = ''; } f.page = 1; persist(); drawTools(); return load(); }
    if (e.target.closest('[data-clear-all]')) { Object.assign(f, DEF, { size: f.size, sort: f.sort }); moreOpen = false; persist(); drawTools(); return load(); }
    if (e.target.closest('[data-refresh]')) return load(true);
    if (e.target.closest('[data-export]')) return exportCsv(null);
    if ((x = e.target.closest('[data-page]')) && !x.disabled) { f.page = +x.getAttribute('data-page'); persist(); load(); return box.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    if ((x = e.target.closest('[data-bulk]'))) return bulk(x.getAttribute('data-bulk'));
    if (e.target.closest('[data-sel-none]')) { clearSel(); return drawList(); }
    if (e.target.closest('[data-sel-all]')) {
      return api.admin.codes(Object.assign(query(), { ids: '1', page: 1, size: 10 })).then(function (r) { (r.ids || []).forEach(function (id) { setSel(id, true); }); drawList(); }).catch(function (x2) { toast(errText(x2)); });
    }
    var rowEl = e.target.closest('[data-id]'), r = rowEl && findRow(rowEl.getAttribute('data-id')); if (!r) return;
    if (e.target.closest('[data-owner]')) return showOwner(r.owner);
    if (e.target.closest('[data-open]')) return openDrawer(r.id);
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var act = b.getAttribute('data-act');
    if (act === 'copy') return copy(r.shortUrl);
    if (act === 'dl') return download(r, 'png');
    if (act === 'pause') return pauseOne(r);
    if (act === 'del') return deleteOne(r);
  });

  /* ---------- Vanzelf verversen (elke minuut, alleen als je kijkt en er geen venster open is) ---------- */
  setInterval(function () {
    if (!me || !me.admin || box.closest('[hidden]') || document.visibilityState !== 'visible' || document.querySelector('dialog[open]') || loading) return;
    if (document.activeElement && box.contains(document.activeElement) && /^(INPUT|SELECT)$/.test(document.activeElement.tagName)) return;   // niet storen tijdens typen
    load(true);
  }, 60000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && me && me.admin && !box.closest('[hidden]') && updatedAt && Date.now() - updatedAt > 60000) load(true); });

  Session.onUser(function (u) { me = u; if (!u || !u.admin) { res = null; clearSel(); } });
  document.addEventListener('pagechange', function (e) { if (e.detail === 'adminCodes') { draw(); load(!!res); } });
  i18n.onChange(function () { if (!box.closest('[hidden]')) draw(); if (drawer.open && detail) drawDrawer(); });
  /** Van buitenaf (dashboard, gebruikers): Alle QR-codes openen met een filter, bv. { user: id } of { check: 'flagged' } */
  function filter(o) { Object.assign(f, DEF, { size: f.size }, o || {}); moreOpen = ADV.some(function (k) { return f[k] !== ''; }); persist(); clearSel(); res = null; goToPage('adminCodes'); }
  return { open: openDrawer, filter: filter };
})();
