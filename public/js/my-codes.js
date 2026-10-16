/* =========================================================
   MIJN QR-CODES
   Lijst met al je codes: zoeken, filteren, sorteren.
   Per code: favoriet (sterretje), downloaden, link kopiëren, bewerken, naam wijzigen, aan/uit, dupliceren, verplaatsen, verwijderen.
   Mappen: balk bovenaan (Alle codes · Zonder map · jouw mappen · + Nieuwe map). Een code naar een map slepen
   of via ⋯ > Verplaatsen naar map. Map weg = de codes blijven bestaan, zonder map.
   Zonder server (online demo) staan de codes in deze browser (zie api.js).
   ========================================================= */
var MyCodes = (function () {
  var IC = {
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    search: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    folderPlus: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M12 11v6M9 14h6"/>',
    move: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M10 14h6M13.5 11.5L16 14l-2.5 2.5"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>', chev: '<path d="M6 9l6 6 6-6"/>',
    inbox: '<path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13h4.5l1 2h5l1-2H20"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    star: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2M14 11v6M11 14h6"/>',
    empty: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/>'
  };
  function ico(k) { return '<svg class="mc-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>'; }

  var view = document.getElementById('myCodesView'), list = document.getElementById('codesList'), tools = document.getElementById('mcTools');
  var dialog = document.getElementById('mcDialog'), toastEl = document.getElementById('mcToast');
  var rows = [], loaded = false, filter = { q: '', type: '', sort: 'new', folder: '' }, renaming = null, toastTimer = null;
  var picked = {};                                          // geselecteerde codes (id → true)
  var dlSize = 1024; try { var ds = +localStorage.getItem('mc.dlSize'); if (CodeUtil.sizes.indexOf(ds) >= 0) dlSize = ds; } catch (e) {}
  var FMT = [['png', 'myCodes.pngHint'], ['jpg', 'myCodes.jpgHint'], ['webp', 'myCodes.webpHint'], ['svg', 'myCodes.svgHint'], ['pdf', 'myCodes.pdfHint']];
  function dlMenu(bulk) {
    return '<div class="mc-sizes" role="group" aria-label="' + esc(t('myCodes.size')) + '"><span>' + t('myCodes.size') + '</span>' + CodeUtil.sizes.map(function (z) { return '<button type="button" class="mc-sz' + (z === dlSize ? ' on' : '') + '" data-size="' + z + '" aria-pressed="' + (z === dlSize) + '">' + z + '</button>'; }).join('') + '</div>' +
      FMT.map(function (f) { return '<button type="button" role="menuitem" data-' + (bulk ? 'bulk-fmt' : 'act="dl" data-fmt') + '="' + f[0] + '">' + f[0].toUpperCase() + '<small>' + t(f[1]) + '</small></button>'; }).join('');
  }
  var folders = [], newIn = null, bar = document.getElementById('mcFolders');   // folder: '' = alle codes, 'none' = zonder map, anders een map-id
  var COLORS = { cyan: '#22d3ee', blue: '#3b82f6', violet: '#8b5cf6', pink: '#ec4899', red: '#ef4444', orange: '#f97316', amber: '#f59e0b', green: '#22c55e' };
  function folderOf(id) { return folders.filter(function (f) { return f.id === id; })[0] || null; }
  function dot(f) { return '<i class="mf-dot" style="--fc:' + (COLORS[f.color] || COLORS.cyan) + '"></i>'; }

  // Gedeeld met het beheer: zie code-util.js
  var isStatic = CodeUtil.isStatic, displayName = CodeUtil.displayName, qrData = CodeUtil.qrData, qrDesign = CodeUtil.qrDesign, download = CodeUtil.download;

  /* ---------- Bovenkant: zoeken, type, sorteren ---------- */
  function drawTools() {
    var present = QR_TYPES.filter(function (tp) { return rows.some(function (r) { return r.typeId === tp.id; }); });
    tools.innerHTML =
      '<label class="mc-search">' + ico('search') + '<input type="search" id="mcQ" value="' + esc(filter.q) + '" placeholder="' + esc(t('myCodes.search')) + '" aria-label="' + esc(t('myCodes.search')) + '"></label>' +
      '<label class="mc-sel"><span>' + t('myCodes.type') + '</span><select id="mcType"><option value="">' + t('myCodes.allTypes') + '</option>' +
        present.map(function (tp) { return '<option value="' + tp.id + '"' + (filter.type === tp.id ? ' selected' : '') + '>' + esc(typeName(tp)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="mc-sel"><span>' + t('myCodes.sort') + '</span><select id="mcSort">' + ['new', 'old', 'scans', 'name'].map(function (k) {
        return '<option value="' + k + '"' + (filter.sort === k ? ' selected' : '') + '>' + t('myCodes.sort_' + k) + '</option>'; }).join('') + '</select></label>';
    tools.hidden = !rows.length;
  }
  /* ---------- Mappen: balk bovenaan ---------- */
  function drawFolders() {
    if (filter.folder && filter.folder !== 'none' && filter.folder !== 'fav' && !folderOf(filter.folder)) filter.folder = '';
    var count = function (fn) { return rows.filter(fn).length; };
    var chip = function (key, label, n, extra) {
      var on = filter.folder === key;
      return '<button type="button" class="mf-chip' + (on ? ' on' : '') + '" data-folder="' + esc(key) + '" aria-pressed="' + on + '" title="' + esc(String(label).replace(/<[^>]*>/g, '')) + '">' + label + '<span class="mf-n">' + i18n.fmt.num(n) + '</span>' + (extra || '') + '</button>';
    };
    var cur = folderOf(filter.folder);
    bar.innerHTML = '<div class="mf-row" role="toolbar" aria-label="' + esc(t('folders.title')) + '">' +
        chip('', ico('grid') + '<span>' + t('folders.all') + '</span>', rows.length) +
        chip('fav', '<span class="mf-star">' + ico('star') + '</span><span>' + t('folders.fav') + '</span>', count(function (r) { return r.favorite; })) +
        chip('none', ico('inbox') + '<span>' + t('folders.none') + '</span>', count(function (r) { return !r.folderId; })) +
        folders.map(function (f) { return '<span class="mf-wrap">' + chip(f.id, dot(f) + '<span>' + esc(f.name) + '</span>', count(function (r) { return r.folderId === f.id; })) +
          '<button type="button" class="mf-x" data-folder-x="' + esc(f.id) + '" aria-label="' + esc(t('folders.delete') + ': ' + f.name) + '" title="' + esc(t('folders.delete')) + '">' + ico('x') + '</button></span>'; }).join('') +
        '<span class="mf-more" hidden><button type="button" class="mf-chip" data-folder-more aria-haspopup="true" aria-expanded="false"><span>' + t('folders.more') + '</span><span class="mf-n"></span>' + ico('chev') + '</button><div class="mf-menu glass" role="menu" hidden></div></span>' +
        '<button type="button" class="mf-chip mf-add" data-folder-new aria-label="' + esc(t('folders.new')) + '">' + ico('folderPlus') + '<span>' + t('folders.new') + '</span></button>' +
      '</div>' +
      (cur ? '<div class="mf-head">' + dot(cur) + '<b>' + esc(cur.name) + '</b>' +
        '<button type="button" class="btn ghost sm" data-folder-edit>' + ico('pen') + '<span>' + t('folders.edit') + '</span></button>' +
        '<button type="button" class="btn ghost sm mf-del" data-folder-delete>' + ico('trash') + '<span>' + t('folders.delete') + '</span></button></div>' : '') +
      (folders.length ? '' : '<p class="mf-tip">' + t('folders.tip') + '</p>');
    bar.hidden = !rows.length && !folders.length;
    fitFolders();
  }
  /* Mappen als tabbladen: passen ze niet op één rij, dan gaan de laatste naar "Meer ▾" (de gekozen map blijft altijd zichtbaar) */
  function fitFolders() {
    var row = bar.querySelector('.mf-row'), more = row && row.querySelector('.mf-more'); if (!more || bar.hidden) return;
    var wraps = [].slice.call(row.querySelectorAll('.mf-wrap')), menu = more.querySelector('.mf-menu');
    wraps.forEach(function (w) { w.hidden = false; }); more.hidden = true; menu.hidden = true; row.classList.remove('tight', 'wrap');
    if (row.scrollWidth <= row.clientWidth + 1) return;
    more.hidden = false;
    for (var i = wraps.length - 1; i >= 0 && row.scrollWidth > row.clientWidth + 1; i--) { if (!wraps[i].querySelector('.mf-chip.on')) wraps[i].hidden = true; }
    // Past het nog steeds niet (smal scherm, alle mappen al in "Meer")? Dan knoppen alleen met icoon, en als laatste redmiddel twee regels
    if (row.scrollWidth > row.clientWidth + 1) row.classList.add('tight');
    if (row.scrollWidth > row.clientWidth + 1) row.classList.add('wrap');
    var hid = wraps.filter(function (w) { return w.hidden; });
    more.querySelector('.mf-n').textContent = i18n.fmt.num(hid.length);
    menu.innerHTML = hid.map(function (w) {
      var f = folderOf(w.querySelector('[data-folder]').getAttribute('data-folder')), n = rows.filter(function (r) { return r.folderId === f.id; }).length;
      return '<div class="mf-mi"><button type="button" role="menuitem" data-folder="' + esc(f.id) + '">' + dot(f) + '<span>' + esc(f.name) + '</span><span class="mf-n">' + i18n.fmt.num(n) + '</span></button>' +
        '<button type="button" class="mf-mx" data-folder-x="' + esc(f.id) + '" aria-label="' + esc(t('folders.delete') + ': ' + f.name) + '" title="' + esc(t('folders.delete')) + '">' + ico('trash') + '</button></div>';
    }).join('');
  }
  var fitTick = 0;
  addEventListener('resize', function () { clearTimeout(fitTick); fitTick = setTimeout(fitFolders, 80); });
  document.addEventListener('click', function (e) { var m = bar.querySelector('.mf-menu'); if (m && !m.hidden && !e.target.closest('.mf-more')) { m.hidden = true; bar.querySelector('[data-folder-more]').setAttribute('aria-expanded', 'false'); } });
  function visible() {
    var q = filter.q.trim().toLowerCase();
    var out = rows.filter(function (r) {
      if (filter.type && r.typeId !== filter.type) return false;
      if (filter.folder === 'fav' && !r.favorite) return false;
      if (filter.folder === 'none' && r.folderId) return false;
      if (filter.folder && filter.folder !== 'none' && filter.folder !== 'fav' && r.folderId !== filter.folder) return false;
      if (!q) return true;
      var dest = Object.keys(r.content || {}).filter(function (k) { return typeof r.content[k] === 'string' && !/password|secret/i.test(k); }).map(function (k) { return r.content[k]; }).join(' ');   // ook de bestemming (link, telefoon, e-mail …)
      return (displayName(r) + ' ' + typeName(getType(r.typeId)) + ' ' + r.id + ' ' + (r.shortUrl || '') + ' ' + dest).toLowerCase().indexOf(q) >= 0;
    });
    var by = {
      new: function (a, b) { return b.createdAt.localeCompare(a.createdAt); },
      old: function (a, b) { return a.createdAt.localeCompare(b.createdAt); },
      scans: function (a, b) { return (b.scans || 0) - (a.scans || 0) || b.createdAt.localeCompare(a.createdAt); },
      name: function (a, b) { return displayName(a).localeCompare(displayName(b), i18n.lang()); }
    }[filter.sort];
    return out.sort(by);
  }

  /* ---------- De lijst ---------- */
  function card(r) {
    var tp = getType(r.typeId), stat = isStatic(r), off = !!r.paused, name = displayName(r);
    var link = stat ? '<span class="mc-static">' + t('myCodes.static') + '</span>'
      : (api.isDemo() ? '<span class="mc-url">' + esc(r.shortUrl.replace(/^https?:\/\//, '')) + '</span>'          // demo: de link bestaat nog niet echt
        : '<a href="' + esc(r.shortUrl) + '" target="_blank" rel="noopener">' + esc(r.shortUrl.replace(/^https?:\/\//, '')) + '</a>') +
        '<button type="button" class="mc-ico" data-act="copy" aria-label="' + esc(t('myCodes.copy')) + '" title="' + esc(t('myCodes.copy')) + '">' + ico('copy') + '</button>';
    var nameHtml = renaming === r.id
      ? '<input class="mc-rename" data-rename value="' + esc(r.name || name) + '" maxlength="60" aria-label="' + esc(t('myCodes.rename')) + '">'
      : '<button type="button" class="mc-name" data-act="rename" title="' + esc(t('myCodes.rename')) + '"><b>' + esc(name) + '</b>' + ico('pen') + '</button>';
    var fo = !filter.folder && r.folderId ? folderOf(r.folderId) : null;
    var sel = !!picked[r.id];
    return '<article class="mc-card glass' + (off ? ' off' : '') + (sel ? ' is-picked' : '') + '" data-id="' + esc(r.id) + '" draggable="true">' +
      '<div class="mc-qr"><span aria-hidden="true">' + QRRender.svg(qrData(r), qrDesign(r)) + '</span><label class="mc-check" title="' + esc(t('myCodes.select')) + '"><input type="checkbox" data-sel' + (sel ? ' checked' : '') + ' aria-label="' + esc(t('myCodes.selectOne', { name: name })) + '"><span aria-hidden="true">' + ico('check') + '</span></label></div>' +
      '<div class="mc-main"><div class="mc-namerow"><button type="button" class="mc-star' + (r.favorite ? ' on' : '') + '" data-act="fav" aria-pressed="' + !!r.favorite + '" aria-label="' + esc(t(r.favorite ? 'folders.unfav' : 'folders.makeFav')) + '" title="' + esc(t(r.favorite ? 'folders.unfav' : 'folders.makeFav')) + '">' + ico('star') + '</button>' + nameHtml + '</div>' +
        '<div class="mc-meta"><span class="mc-type"><i>' + svg(tp.icon, 1.8) + '</i>' + esc(typeName(tp)) + '</span><span class="mc-dot">·</span><span>' + esc(t('myCodes.made', { date: i18n.fmt.stamp(r.createdAt, 'short') })) + '</span>' +
          (r.updatedAt && r.updatedAt !== r.createdAt ? '<span class="mc-dot">·</span><span title="' + esc(i18n.fmt.stamp(r.updatedAt, 'long')) + '">' + esc(t('myCodes.edited', { date: i18n.fmt.stamp(r.updatedAt, 'short') })) + '</span>' : '') +
          (fo ? '<button type="button" class="mc-folder" data-folder="' + esc(fo.id) + '">' + dot(fo) + esc(fo.name) + '</button>' : '') + '</div>' +
        '<div class="mc-link">' + link + '</div></div>' +
      (stat ? '<div class="mc-scans"><b>–</b><small>' + t('myCodes.noScans') + '</small></div>'
        : '<button type="button" class="mc-scans" data-act="stats" title="' + esc(t('myCodes.viewStats')) + '"><b>' + i18n.fmt.num(r.scans || 0) + '</b><small>' + t('myCodes.scans') + '</small></button>') +
      '<div class="mc-state">' + (stat ? '<span class="mc-pill on">' + t('myCodes.always') + '</span>'
        : '<button type="button" class="mc-switch" role="switch" aria-checked="' + !off + '" data-act="toggle"' + (off && r.hold && r.hold.lock ? ' aria-disabled="true" title="' + esc(t('myCodes.heldLocked')) + '"' : '') + '><span class="sw"></span><span>' + t(off ? 'myCodes.offLabel' : 'myCodes.onLabel') + '</span></button>') + '</div>' +
      '<div class="mc-acts">' +
        '<div class="mc-drop"><button type="button" class="btn ghost sm" data-act="dlmenu" aria-haspopup="true" aria-expanded="false">' + ico('dl') + '<span>' + t('myCodes.download') + '</span></button>' +
          '<div class="mc-menu mc-dlm" role="menu" hidden>' + dlMenu(false) + '</div></div>' +
        '<button type="button" class="btn ghost sm" data-act="edit">' + ico('edit') + '<span>' + t('myCodes.edit') + '</span></button>' +
        '<div class="mc-drop"><button type="button" class="mc-ico big" data-act="more" aria-haspopup="true" aria-expanded="false" aria-label="' + esc(t('myCodes.more')) + '" title="' + esc(t('myCodes.more')) + '">' + ico('more') + '</button>' +
          '<div class="mc-menu right" role="menu" hidden>' +
            (stat ? '' : (api.isDemo() ? '' : '<button type="button" role="menuitem" data-act="open">' + ico('open') + t('myCodes.open') + '</button>') + '<button type="button" role="menuitem" data-act="copy">' + ico('copy') + t('myCodes.copy') + '</button>') +
            '<button type="button" role="menuitem" data-act="rename">' + ico('pen') + t('myCodes.rename') + '</button>' +
            '<button type="button" role="menuitem" data-act="duplicate">' + ico('dup') + t('myCodes.duplicate') + '</button>' +
            '<button type="button" role="menuitem" data-act="move">' + ico('move') + t('folders.moveTo') + '</button>' +
            '<button type="button" role="menuitem" class="danger" data-act="delete">' + ico('trash') + t('myCodes.delete') + '</button></div></div>' +
      '</div>' +
      // Gepauzeerd door het team (met reden): over de hele breedte onder de kaart
      (off && r.hold ? '<p class="mc-hold">' + ico(r.hold.lock ? 'lock' : 'pause') + '<span><b>' + t('myCodes.heldTitle') + '</b> ' + (r.hold.reason ? esc(r.hold.reason) + '. ' : '') + t(r.hold.lock ? 'myCodes.heldLocked' : 'myCodes.heldOpen') +
        (r.hold.lock ? ' <button type="button" class="link-btn" data-act="support">' + t('myCodes.heldContact') + '</button>' : '') + '</span></p>' : '') + '</article>';
  }
  function draw() {
    drawFolders();
    document.getElementById('mcCount').textContent = loaded ? t(rows.length === 1 ? 'myCodes.countOne' : 'myCodes.count', { n: i18n.fmt.num(rows.length) }) : '';
    var demo = document.getElementById('mcDemo'); demo.hidden = !api.isDemo(); demo.textContent = t('myCodes.demoNote');
    if (!rows.length) {
      list.innerHTML = '<div class="mc-empty glass">' + ico('empty') + '<h3>' + t('myCodes.emptyTitle') + '</h3><p>' + t('myCodes.emptyText') + '</p>' +
        '<button type="button" class="btn primary" data-mc-new>' + ico('plus') + t('myCodes.first') + '</button></div>';
      return;
    }
    var vis = visible(), searching = filter.q.trim() || filter.type;
    list.innerHTML = vis.length ? vis.map(card).join('')
      : !searching && filter.folder === 'fav' ? '<div class="mc-empty small glass">' + ico('star') + '<h3>' + t('folders.favEmpty') + '</h3><p>' + t('folders.favEmptyText') + '</p></div>'
      : !searching && filter.folder ? '<div class="mc-empty small glass">' + ico('folder') + '<h3>' + t(filter.folder === 'none' ? 'folders.noneEmpty' : 'folders.empty') + '</h3><p>' + t(filter.folder === 'none' ? 'folders.noneEmptyText' : 'folders.emptyText') + '</p>' +
          (filter.folder !== 'none' ? '<button type="button" class="btn primary" data-mc-new>' + ico('plus') + t('folders.newHere') + '</button>' : '') + '</div>'
      : '<div class="mc-empty small glass"><h3>' + t('myCodes.noneFound') + '</h3><button type="button" class="btn ghost" data-act="clear">' + t('myCodes.clear') + '</button></div>';
    if (renaming) { var inp = list.querySelector('[data-rename]'); if (inp) { inp.focus(); inp.select(); } }
    drawBulk();
  }
  /* ---------- Meerdere codes tegelijk ---------- */
  var bulk = document.createElement('div'); bulk.className = 'mc-bulk glass'; bulk.hidden = true; bulk.setAttribute('role', 'region');
  list.parentNode.appendChild(bulk);
  function pickedRows() { return rows.filter(function (r) { return picked[r.id]; }); }
  function drawBulk() {
    Object.keys(picked).forEach(function (id) { if (!find(id)) delete picked[id]; });
    var sel = pickedRows(), vis = visible();
    view.classList.toggle('mc-picking', sel.length > 0);
    if (!sel.length) { bulk.hidden = true; return; }
    var allOn = vis.length && vis.every(function (r) { return picked[r.id]; }), dyn = sel.filter(function (r) { return !isStatic(r); });
    bulk.setAttribute('aria-label', t('myCodes.selected', { n: sel.length }));
    bulk.innerHTML = '<span class="mc-bn"><b>' + i18n.fmt.num(sel.length) + '</b> ' + t('myCodes.selectedShort') + '</span>' +
      '<button type="button" class="link-btn" data-bulk="all">' + t(allOn ? 'myCodes.selectNone' : 'myCodes.selectAll', { n: vis.length }) + '</button><span class="mc-bsp"></span>' +
      '<button type="button" class="btn ghost sm" data-bulk="move">' + ico('move') + '<span>' + t('folders.moveTo') + '</span></button>' +
      '<div class="mc-drop mc-up"><button type="button" class="btn ghost sm" data-bulk="dl" aria-haspopup="true" aria-expanded="false">' + ico('dl') + '<span>' + t('myCodes.download') + '</span></button><div class="mc-menu mc-dlm" role="menu" hidden>' + dlMenu(true) + '</div></div>' +
      (dyn.length ? '<button type="button" class="btn ghost sm" data-bulk="pause">' + t('myCodes.bulkPause') + '</button><button type="button" class="btn ghost sm" data-bulk="resume">' + t('myCodes.bulkResume') + '</button>' : '') +
      '<button type="button" class="btn ghost sm danger-ghost" data-bulk="delete">' + ico('trash') + '<span>' + t('myCodes.delete') + '</span></button>' +
      '<button type="button" class="mc-ico" data-bulk="clear" aria-label="' + esc(t('myCodes.cancel')) + '" title="' + esc(t('myCodes.cancel')) + '">' + ico('x') + '</button>';
    bulk.hidden = false;
  }
  bulk.addEventListener('click', function (e) {
    var sz = e.target.closest('[data-size]'); if (sz) { setSize(+sz.getAttribute('data-size')); return; }
    var f = e.target.closest('[data-bulk-fmt]');
    if (f) { var list2 = pickedRows(); bulk.querySelector('.mc-menu').hidden = true; toastText(t('myCodes.preparing'));
      return CodeUtil.downloadMany(list2, f.getAttribute('data-bulk-fmt'), dlSize, 'qr-codes-' + new Date().toISOString().slice(0, 10)).catch(function () { toast('myCodes.failed'); }); }
    var b = e.target.closest('[data-bulk]'); if (!b) return;
    var k = b.getAttribute('data-bulk'), sel = pickedRows();
    if (k === 'dl') { var m = b.nextElementSibling; m.hidden = !m.hidden; b.setAttribute('aria-expanded', String(!m.hidden)); return; }
    if (k === 'clear') { picked = {}; return draw(); }
    if (k === 'all') { var vis = visible(), allOn = vis.every(function (r) { return picked[r.id]; }); vis.forEach(function (r) { if (allOn) delete picked[r.id]; else picked[r.id] = true; }); return draw(); }
    if (k === 'move') return askMove(sel);
    if (k === 'delete') return askDeleteMany(sel);
    if (k === 'pause' || k === 'resume') {
      var next = k === 'pause', todo = sel.filter(function (r) { return !isStatic(r) && !!r.paused !== next && !(r.hold && r.hold.lock); });
      Promise.all(todo.map(function (r) { return api.patchQrCode(r.id, { paused: next }).then(replace).catch(function () { return null; }); }))
        .then(function () { draw(); toastText(t(next ? 'myCodes.bulkPaused' : 'myCodes.bulkResumed', { n: todo.length })); });
    }
  });
  document.addEventListener('click', function (e) { if (!bulk.hidden && !e.target.closest('.mc-bulk .mc-drop')) { var m = bulk.querySelector('.mc-menu'); if (m) m.hidden = true; } });
  function setSize(z) {
    dlSize = z; try { localStorage.setItem('mc.dlSize', String(z)); } catch (e) {}
    view.querySelectorAll('.mc-sz').forEach(function (b) { var on = +b.getAttribute('data-size') === z; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  }
  function askDeleteMany(sel) {
    dialog.innerHTML = '<form method="dialog" class="mc-dlg">' + '<span class="mc-dlg-ic">' + ico('trash') + '</span>' +
      '<h3>' + esc(t('myCodes.bulkDeleteTitle', { n: sel.length })) + '</h3><p>' + t('myCodes.bulkDeleteText') + '</p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok">' + t('myCodes.delete') + '</button></div></form>';
    dialog.onclose = function () {
      if (dialog.returnValue !== 'ok') return;
      Promise.all(sel.map(function (r) { return api.deleteQrCode(r.id).then(function () { return r.id; }).catch(function () { return null; }); })).then(function (ids) {
        var gone = ids.filter(Boolean); rows = rows.filter(function (x) { return gone.indexOf(x.id) < 0; }); gone.forEach(function (id) { delete picked[id]; });
        drawTools(); draw(); toastText(t('myCodes.bulkDeleted', { n: gone.length }));
      });
    };
    dialog.returnValue = ''; dialog.showModal(); dialog.querySelector('[value="cancel"]').focus();
  }
  function message(key) { list.innerHTML = '<p class="muted-msg">' + t(key) + '</p>'; }
  function load() {
    if (!loaded) message('myCodes.loading');
    return Promise.all([api.listQrCodes(), api.folders.list().catch(function () { return { folders: [] }; })])
      .then(function (res) { rows = res[0] || []; folders = (res[1] && res[1].folders) || []; loaded = true; drawTools(); draw(); })
      .catch(function () { message('myCodes.error'); });
  }

  /* ---------- Acties ---------- */
  function find(id) { return rows.filter(function (r) { return r.id === id; })[0]; }
  function replace(rec) { rows = rows.map(function (r) { return r.id === rec.id ? rec : r; }); }
  function toast(key) {
    toastEl.textContent = t(key); toastEl.hidden = false; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); setTimeout(function () { toastEl.hidden = true; }, 250); }, 2200);
  }
  function closeMenus(except) { list.querySelectorAll('.mc-menu').forEach(function (m) { if (m !== except) { m.hidden = true; var b = m.previousElementSibling; if (b) b.setAttribute('aria-expanded', 'false'); } }); }
  function copy(text) {
    var done = function () { toast('myCodes.copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(done, fallback);
    fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
  }
  function saveBlob(blob, filename) { saveFile(blob, filename); }
  function rename(id, value) {
    var r = find(id); renaming = null;
    value = String(value || '').replace(/\s+/g, ' ').trim();
    if (!r || value === (r.name || displayName(r))) return draw();
    api.patchQrCode(id, { name: value }).then(function (rec) { replace(rec); draw(); toast('myCodes.renamed'); }).catch(function () { draw(); toast('myCodes.failed'); });
  }
  function toggle(r) {
    if (r.paused && r.hold && r.hold.lock) return toast('myCodes.heldLocked');   // gepauzeerd door het beheer: alleen het team kan hem weer aanzetten
    var next = !r.paused;
    r.paused = next; draw();                                   // meteen zichtbaar; terugzetten als het mislukt
    api.patchQrCode(r.id, { paused: next }).then(function (rec) { replace(rec); draw(); toast(next ? 'myCodes.pausedToast' : 'myCodes.activeToast'); })
      .catch(function (x) { r.paused = !next; draw(); toast(x && x.code === 'admin_hold' ? 'myCodes.heldLocked' : 'myCodes.failed'); });
  }
  function favorite(r) {
    var next = !r.favorite; r.favorite = next; draw();                // meteen zichtbaar; terug als het mislukt
    api.patchQrCode(r.id, { favorite: next }).then(function (rec) { replace(rec); draw(); toast(next ? 'folders.favAdded' : 'folders.favRemoved'); })
      .catch(function () { r.favorite = !next; draw(); toast('myCodes.failed'); });
  }
  function duplicate(r) {
    api.duplicateQrCode(r.id, { name: t('myCodes.copyOf', { name: displayName(r) }).slice(0, 60) }).then(function (rec) {
      rows.unshift(rec); drawTools(); draw(); toast('myCodes.duplicated');
      var el = list.querySelector('.mc-card[data-id="' + rec.id + '"]');
      if (el) { el.classList.add('fresh'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); setTimeout(function () { el.classList.remove('fresh'); }, 1600); }
    }).catch(function (e) { toast(e && e.code === 'plan_limit' ? 'plan.limitCreate' : 'myCodes.failed'); });
  }
  function askDelete(r) {
    dialog.innerHTML = '<form method="dialog" class="mc-dlg">' + '<span class="mc-dlg-ic">' + ico('trash') + '</span>' +
      '<h3>' + esc(t('myCodes.deleteTitle', { name: displayName(r) })) + '</h3><p>' + t(isStatic(r) ? 'myCodes.deleteTextStatic' : 'myCodes.deleteText') + '</p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok">' + t('myCodes.delete') + '</button></div></form>';
    dialog.onclose = function () {
      if (dialog.returnValue !== 'ok') return;
      api.deleteQrCode(r.id).then(function () { rows = rows.filter(function (x) { return x.id !== r.id; }); drawTools(); draw(); toast('myCodes.deleted'); })
        .catch(function () { toast('myCodes.failed'); });
    };
    dialog.returnValue = ''; dialog.showModal();
    dialog.querySelector('[value="cancel"]').focus();
  }
  function edit(r) {
    // Met bestanden erbij ophalen (de lijst laat ze weg)
    api.getQrCode(r.id).then(function (full) { actions.startEdit(full); goToPage('create'); })
      .catch(function () { toast('myCodes.failed'); });
  }
  function startNew() { newIn = folderOf(filter.folder) ? filter.folder : null; actions.startNew(); goToPage('create'); }

  /* ---------- Mappen: maken, wijzigen, verwijderen, verplaatsen ---------- */
  function folderErr(x) { return x && x.code === 'exists' ? 'folders.errExists' : x && x.code === 'too_many_folders' ? 'folders.errMany' : 'myCodes.failed'; }
  /** Venster voor een nieuwe map of om een map te wijzigen (naam + kleur). then(folder) na opslaan. */
  function folderDialog(f, then) {
    var color = (f && f.color) || 'cyan';
    dialog.innerHTML = '<form method="dialog" class="mc-dlg mf-dlg" novalidate><span class="mc-dlg-ic mf-ic">' + ico(f ? 'folder' : 'folderPlus') + '</span>' +
      '<h3>' + t(f ? 'folders.editTitle' : 'folders.newTitle') + '</h3>' +
      '<label class="auth-f"><span>' + t('folders.name') + '</span><span class="auth-in"><input id="mfName" maxlength="40" value="' + esc(f ? f.name : '') + '" placeholder="' + esc(t('folders.namePh')) + '" autocomplete="off"></span></label>' +
      '<div class="mf-colors" role="radiogroup" aria-label="' + esc(t('folders.color')) + '"><span>' + t('folders.color') + '</span><div>' +
        Object.keys(COLORS).map(function (c) { return '<button type="button" role="radio" aria-checked="' + (c === color) + '" aria-label="' + esc(t('folders.c_' + c)) + '" title="' + esc(t('folders.c_' + c)) + '" data-color="' + c + '" style="--fc:' + COLORS[c] + '">' + ico('check') + '</button>'; }).join('') +
      '</div></div><p class="acct-msg bad" id="mfMsg" hidden></p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel" formnovalidate>' + t('myCodes.cancel') + '</button><button class="btn primary" value="ok" id="mfGo">' + t(f ? 'folders.save' : 'folders.create') + '</button></div></form>';
    var inp = dialog.querySelector('#mfName'), msg = dialog.querySelector('#mfMsg');
    dialog.querySelector('.mf-colors').addEventListener('click', function (e) {
      var b = e.target.closest('[data-color]'); if (!b) return; color = b.getAttribute('data-color');
      dialog.querySelectorAll('[data-color]').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
    });
    dialog.querySelector('#mfGo').addEventListener('click', function (e) {
      e.preventDefault(); var name = inp.value.replace(/\s+/g, ' ').trim();
      if (!name) { msg.hidden = false; msg.textContent = t('folders.errName'); inp.focus(); return; }
      var go = e.currentTarget; go.disabled = true;
      (f ? api.folders.update(f.id, { name: name, color: color }) : api.folders.create({ name: name, color: color })).then(function (res) {
        var nf = res.folder; folders = f ? folders.map(function (x) { return x.id === nf.id ? nf : x; }) : folders.concat([nf]);
        dialog.close(); if (then) then(nf); else draw();
        toast(f ? 'folders.saved' : 'folders.created');
      }).catch(function (x) { go.disabled = false; msg.hidden = false; msg.textContent = t(folderErr(x)); inp.focus(); });
    });
    dialog.onclose = null; dialog.returnValue = ''; dialog.showModal(); inp.focus(); inp.select();
  }
  function askDeleteFolder(f) {
    var n = rows.filter(function (r) { return r.folderId === f.id; }).length;
    dialog.innerHTML = '<form method="dialog" class="mc-dlg"><span class="mc-dlg-ic">' + ico('trash') + '</span>' +
      '<h3>' + esc(t('folders.deleteTitle', { name: f.name })) + '</h3><p>' + t(n ? (n === 1 ? 'folders.deleteTextOne' : 'folders.deleteText') : 'folders.deleteTextEmpty', { n: n }) + '</p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok">' + t('folders.delete') + '</button></div></form>';
    dialog.onclose = function () {
      if (dialog.returnValue !== 'ok') return;
      api.folders.remove(f.id).then(function () {
        folders = folders.filter(function (x) { return x.id !== f.id; });
        rows.forEach(function (r) { if (r.folderId === f.id) r.folderId = null; });
        filter.folder = ''; draw(); toast('folders.deleted');
      }).catch(function () { toast('myCodes.failed'); });
    };
    dialog.returnValue = ''; dialog.showModal(); dialog.querySelector('[value="cancel"]').focus();
  }
  function move(ids, folderId) {
    var before = {}; rows.forEach(function (r) { if (ids.indexOf(r.id) >= 0) { before[r.id] = r.folderId || null; r.folderId = folderId; } });
    draw();                                                           // meteen zichtbaar; terug als het mislukt
    api.folders.move({ ids: ids, folderId: folderId }).then(function () {
      var f = folderOf(folderId); toastText(f ? t('folders.movedTo', { name: f.name }) : t('folders.movedOut'));
    }).catch(function () { rows.forEach(function (r) { if (r.id in before) r.folderId = before[r.id]; }); draw(); toast('myCodes.failed'); });
  }
  /** Kiezen naar welke map een code gaat */
  function askMove(r) {
    var many = Array.isArray(r), ids = many ? r.map(function (x) { return x.id; }) : [r.id];
    if (many && r.length === 1) { r = r[0]; many = false; }
    var opt = function (id, label, on) { return '<button type="button" class="mf-pick' + (on ? ' on' : '') + '" data-pick="' + esc(id) + '"' + (on ? ' aria-current="true"' : '') + '>' + label + (on ? '<em>' + t('folders.current') + '</em>' : '') + '</button>'; };
    dialog.innerHTML = '<form method="dialog" class="mc-dlg mf-dlg"><span class="mc-dlg-ic mf-ic">' + ico('move') + '</span>' +
      '<h3>' + esc(many ? t('myCodes.bulkMoveTitle', { n: ids.length }) : t('folders.moveTitle', { name: displayName(r) })) + '</h3>' +
      '<div class="mf-picks">' + opt('', ico('inbox') + '<span>' + t('folders.none') + '</span>', !many && !r.folderId) +
        folders.map(function (f) { return opt(f.id, dot(f) + '<span>' + esc(f.name) + '</span>', !many && r.folderId === f.id); }).join('') +
        '<button type="button" class="mf-pick mf-pick-new" data-pick-new>' + ico('folderPlus') + '<span>' + t('folders.newAndMove') + '</span></button></div>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button></div></form>';
    dialog.querySelector('.mf-picks').addEventListener('click', function (e) {
      if (e.target.closest('[data-pick-new]')) { dialog.close(); return folderDialog(null, function (nf) { move(ids, nf.id); }); }
      var b = e.target.closest('[data-pick]'); if (!b) return;
      var to = b.getAttribute('data-pick') || null; dialog.close();
      if (many || (r.folderId || null) !== to) move(ids, to);
    });
    dialog.onclose = null; dialog.returnValue = ''; dialog.showModal();
    var cur = dialog.querySelector('.mf-pick.on') || dialog.querySelector('.mf-pick'); if (cur) cur.focus();
  }
  function toastText(text) {
    toastEl.textContent = text; toastEl.hidden = false; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); setTimeout(function () { toastEl.hidden = true; }, 250); }, 2200);
  }

  bar.addEventListener('click', function (e) {
    var mb = e.target.closest('[data-folder-more]');
    if (mb) { var mm = bar.querySelector('.mf-menu'); mm.hidden = !mm.hidden; mb.setAttribute('aria-expanded', String(!mm.hidden)); return; }
    var c = e.target.closest('[data-folder]'); if (c) { filter.folder = c.getAttribute('data-folder'); return draw(); }
    if (e.target.closest('[data-folder-new]')) return folderDialog(null, function (nf) { filter.folder = nf.id; draw(); });
    var cur = folderOf(filter.folder);
    if (cur && e.target.closest('[data-folder-edit]')) return folderDialog(cur);
    if (cur && e.target.closest('[data-folder-delete]')) return askDeleteFolder(cur);
    var fx = e.target.closest('[data-folder-x]'); if (fx) { var ff = folderOf(fx.getAttribute('data-folder-x')); if (ff) return askDeleteFolder(ff); }
  });
  // Slepen: een code op een map (of op "Zonder map") laten vallen
  var dragId = null;
  list.addEventListener('dragstart', function (e) {
    var c = e.target.closest && e.target.closest('.mc-card'); if (!c || renaming) return;
    dragId = c.getAttribute('data-id'); c.classList.add('dragging'); bar.classList.add('dropping');
    try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) {}
  });
  // Opruimen na het slepen (ook als de kaart intussen opnieuw getekend is en "dragend" niet meer aankomt)
  function endDrag() { dragId = null; bar.classList.remove('dropping'); list.querySelectorAll('.dragging').forEach(function (x) { x.classList.remove('dragging'); }); bar.querySelectorAll('.over').forEach(function (x) { x.classList.remove('over'); }); }
  list.addEventListener('dragend', endDrag);
  document.addEventListener('dragend', endDrag);
  bar.addEventListener('dragover', function (e) {
    var c = e.target.closest('[data-folder]'); if (!dragId || !c || c.getAttribute('data-folder') === '') return;
    e.preventDefault(); bar.querySelectorAll('.over').forEach(function (x) { if (x !== c) x.classList.remove('over'); }); c.classList.add('over');
  });
  bar.addEventListener('dragleave', function (e) { var c = e.target.closest('[data-folder]'); if (c && !c.contains(e.relatedTarget)) c.classList.remove('over'); });
  bar.addEventListener('drop', function (e) {
    var c = e.target.closest('[data-folder]'); if (!dragId || !c) return; e.preventDefault(); c.classList.remove('over');
    var key = c.getAttribute('data-folder'), to = key === 'none' ? null : key, r = find(dragId);
    endDrag();
    if (key === 'fav') { if (r && !r.favorite) favorite(r); return; }
    if (r && key !== '' && (r.folderId || null) !== to) move([r.id], to);
  });

  view.addEventListener('click', function (e) {
    if (e.target.closest('[data-mc-new]')) return startNew();
    var szb = e.target.closest('.mc-card [data-size]'); if (szb) { e.stopPropagation(); return setSize(+szb.getAttribute('data-size')); }
    var b = e.target.closest('[data-act]');
    if (!b) { if (!e.target.closest('.mc-menu')) closeMenus(); return; }
    var act = b.getAttribute('data-act');
    if (act === 'dl') { var rr = find(b.closest('[data-id]').getAttribute('data-id')); closeMenus(); return download(rr, b.getAttribute('data-fmt'), dlSize).catch(function () { toast('myCodes.failed'); }); }
    if (act === 'clear') { filter.q = ''; filter.type = ''; drawTools(); return draw(); }
    var el = b.closest('[data-id]'), r = el && find(el.getAttribute('data-id')); if (!r) return;
    if (act === 'dlmenu' || act === 'more') {
      var m = b.nextElementSibling, open = m.hidden; closeMenus(m); m.hidden = !open; b.setAttribute('aria-expanded', String(open));
      if (open) { var first = m.querySelector('button'); if (first) first.focus(); }
      return;
    }
    closeMenus();
    if (act === 'copy') return copy(r.shortUrl);
    if (act === 'open') return window.open(r.shortUrl, '_blank', 'noopener');
    if (act === 'edit') return edit(r);
    if (act === 'stats') return Analytics.open({ codes: [r.id] });
    if (act === 'toggle') return toggle(r);
    if (act === 'support') return goToPage('contact');
    if (act === 'delete') return askDelete(r);
    if (act === 'rename') { renaming = r.id; return draw(); }
    if (act === 'move') return askMove(r);
    if (act === 'fav') return favorite(r);
    if (act === 'duplicate') return duplicate(r);
  });
  list.addEventListener('change', function (e) {
    var cb = e.target.closest('[data-sel]'); if (!cb) return;
    var id = cb.closest('[data-id]').getAttribute('data-id'); if (cb.checked) picked[id] = true; else delete picked[id];
    cb.closest('.mc-card').classList.toggle('is-picked', cb.checked); drawBulk();
  });
  list.addEventListener('click', function (e) { var f = e.target.closest('.mc-folder[data-folder]'); if (f) { filter.folder = f.getAttribute('data-folder'); draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  list.addEventListener('keydown', function (e) {
    var inp = e.target.closest('[data-rename]');
    if (inp) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } if (e.key === 'Escape') { renaming = null; draw(); } return; }
    if (e.key === 'Escape') closeMenus();
  });
  list.addEventListener('focusout', function (e) { var inp = e.target.closest('[data-rename]'); if (inp && renaming) rename(renaming, inp.value); });
  tools.addEventListener('input', function (e) { if (e.target.id === 'mcQ') { filter.q = e.target.value; draw(); } });
  tools.addEventListener('change', function (e) {
    if (e.target.id === 'mcType') { filter.type = e.target.value; draw(); }
    if (e.target.id === 'mcSort') { filter.sort = e.target.value; draw(); }
  });
  document.addEventListener('click', function (e) { if (!view.hidden && !e.target.closest('.mc-drop')) closeMenus(); });

  function label() { view.querySelector('.mc-head [data-mc-new]').innerHTML = ico('plus') + t('myCodes.new'); }
  label();
  document.addEventListener('pagechange', function (e) { if (e.detail === 'myCodes') { renaming = null; picked = {}; load(); } else if (e.detail !== 'create') newIn = null; });
  i18n.onChange(function () { label(); if (!view.hidden) { drawTools(); draw(); } });
  /** Nieuwe code gemaakt vanuit een map: die map (één keer) */
  function folderForNew() { var f = newIn; newIn = null; return f; }
  /** Vanaf het Overzicht: meteen een map (of 'fav') openen */
  function showFolder(key) { filter.folder = key; if (loaded) draw(); }
  return { reload: load, displayName: displayName, folderForNew: folderForNew, showFolder: showFolder };
})();
