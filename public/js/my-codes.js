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
    warn: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    search: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/>',
    print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
    share: '<path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    chain: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    folderPlus: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M12 11v6M9 14h6"/>',
    move: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M10 14h6M13.5 11.5L16 14l-2.5 2.5"/>',
    moveOut: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M9.5 14h6"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>', chev: '<path d="M6 9l6 6 6-6"/>',
    inbox: '<path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13h4.5l1 2h5l1-2H20"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    star: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    tag: '<path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>', note: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8.5 12h7M8.5 16h5"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2M14 11v6M11 14h6"/>',
    empty: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/>'
  };
  function ico(k) { return '<svg class="mc-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>'; }

  var view = document.getElementById('myCodesView'), list = document.getElementById('codesList'), tools = document.getElementById('mcTools');
  var dialog = document.getElementById('mcDialog'), toastEl = document.getElementById('mcToast');
  var bin = [];   // Onlangs verwijderd (prullenbak, 30 dagen)
  var purged = [], purgedOpen = false;   // logboek: definitief verwijderd
  var rows = [], loaded = false, filter = { q: '', type: '', sort: 'new', folder: '', label: '' }, renaming = null, toastTimer = null;
  // Veel codes: niet alles tegelijk tekenen (elke kaart maakt een QR-plaatje), maar per blok; meer bij het scrollen
  var STEP = 60, limit = STEP, limitKey = '', moreObs = null;
  var picked = {};
  var health = {};                                          // health check per code: { state, at, bad }                                          // geselecteerde codes (id → true)
  var dlSize = 1024; try { var ds = +localStorage.getItem('mc.dlSize'); if (CodeUtil.sizes.indexOf(ds) >= 0) dlSize = ds; } catch (e) {}
  var FMT = [['png', 'myCodes.pngHint'], ['jpg', 'myCodes.jpgHint'], ['webp', 'myCodes.webpHint'], ['svg', 'myCodes.svgHint'], ['pdf', 'myCodes.pdfHint'], ['eps', 'myCodes.epsHint']];
  /* Printcontrole: tot hoe groot is dit formaat scherp, en hoe groot moet de code zijn voor de scanafstand? (vuistregel: afstand / 10) */
  var DISTS = [0.3, 0.5, 1, 2, 3, 5, 10], dlDist = 1; try { var dd = +localStorage.getItem('mc.dist'); if (DISTS.indexOf(dd) >= 0) dlDist = dd; } catch (e) {}
  function cm(n) { return i18n.fmt.num(Math.round(n * 10) / 10); }
  function ptipInner() {
    var sharp = dlSize / 300 * 2.54, need = Math.max(2, dlDist * 10), ok = need <= sharp;
    return '<div class="mc-pt-row"><span>' + t('ptip.sharp', { cm: cm(sharp) }) + '</span></div>' +
      '<label class="mc-pt-row"><span>' + t('ptip.distance') + '</span><select data-dist aria-label="' + esc(t('ptip.distance')) + '">' + DISTS.map(function (d) { return '<option value="' + d + '"' + (d === dlDist ? ' selected' : '') + '>' + (d < 1 ? i18n.fmt.num(d * 100) + ' cm' : i18n.fmt.num(d) + ' m') + '</option>'; }).join('') + '</select></label>' +
      '<p class="mc-pt-res' + (ok ? '' : ' bad') + '">' + (ok ? t('ptip.min', { cm: cm(need) }) : t('ptip.tooSmall', { cm: cm(need) })) + '</p>';
  }
  function ptip() { return '<div class="mc-ptip" role="group" aria-label="' + esc(t('ptip.title')) + '">' + ptipInner() + '</div>'; }
  function dlMenu(bulk) {
    return '<div class="mc-sizes" role="group" aria-label="' + esc(t('myCodes.size')) + '"><span>' + t('myCodes.size') + '</span>' + CodeUtil.sizes.map(function (z) { return '<button type="button" class="mc-sz' + (z === dlSize ? ' on' : '') + '" data-size="' + z + '" aria-pressed="' + (z === dlSize) + '">' + z + '</button>'; }).join('') + '</div>' +
      ptip() +
      FMT.map(function (f) { return '<button type="button" role="menuitem" data-' + (bulk ? 'bulk-fmt' : 'act="dl" data-fmt') + '="' + f[0] + '">' + f[0].toUpperCase() + '<small>' + t(f[1]) + '</small></button>'; }).join('') +
      (bulk ? '' : '<div class="mc-dlx"><button type="button" role="menuitem" data-act="print">' + ico('print') + '<span>' + t('myCodes.print') + '<small>' + t('myCodes.printHint') + '</small></span></button>' +
        '<button type="button" role="menuitem" data-act="share">' + ico('share') + '<span>' + t('myCodes.share') + '<small>' + t('myCodes.shareHint') + '</small></span></button></div>');
  }
  var folders = [], newIn = null, bar = document.getElementById('mcFolders');   // folder: '' = alle codes, 'none' = zonder map, anders een map-id
  var COLORS = { cyan: '#22d3ee', blue: '#3b82f6', violet: '#8b5cf6', pink: '#ec4899', red: '#ef4444', orange: '#f97316', amber: '#f59e0b', green: '#22c55e' };
  function folderOf(id) { return folders.filter(function (f) { return f.id === id; })[0] || null; }
  // Mapje-icoon: één rustige kleur voor alle mappen (kleuren kiezen is weggehaald: voegde niets toe en maakte het druk)
  function dot(f) { return '<svg class="mf-dot" style="--fc:' + COLORS.cyan + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 6.5A2 2 0 0 1 4.5 4.5h4.6l2.2 2.3h8.2a2 2 0 0 1 2 2v9.7a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z"/></svg>'; }

  // Gedeeld met het beheer: zie code-util.js
  var isStatic = CodeUtil.isStatic, displayName = CodeUtil.displayName, qrData = CodeUtil.qrData, qrDesign = CodeUtil.qrDesign, download = CodeUtil.download;

  /* ---------- Bovenkant: zoeken, type, sorteren ---------- */
  function drawTools() {
    var present = QR_TYPES.filter(function (tp) { return rows.some(function (r) { return r.typeId === tp.id; }); });
    tools.innerHTML =
      '<label class="mc-search">' + ico('search') + '<input type="search" id="mcQ" value="' + esc(filter.q) + '" placeholder="' + esc(t('myCodes.search')) + '" aria-label="' + esc(t('myCodes.search')) + '"></label>' +
      '<label class="mc-sel"><span>' + t('myCodes.type') + '</span><select id="mcType"><option value="">' + t('myCodes.allTypes') + '</option>' +
        present.map(function (tp) { return '<option value="' + tp.id + '"' + (filter.type === tp.id ? ' selected' : '') + '>' + esc(typeName(tp)) + '</option>'; }).join('') + '</select></label>' +
      (allLabels().length ? '<label class="mc-sel"><span>' + t('labels.label') + '</span><select id="mcLabel"><option value="">' + t('labels.all') + '</option>' +
        allLabels().map(function (l) { return '<option value="' + esc(l) + '"' + (filter.label === l ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="mc-sel"><span>' + t('myCodes.sort') + '</span><select id="mcSort">' + ['new', 'old', 'scans', 'name'].map(function (k) {
        return '<option value="' + k + '"' + (filter.sort === k ? ' selected' : '') + '>' + t('myCodes.sort_' + k) + '</option>'; }).join('') + '</select></label>';
    tools.hidden = !rows.length;
  }
  // Alle labels die de klant gebruikt (voor het filter en als suggestie)
  function allLabels() { var s = {}; rows.forEach(function (r) { (r.labels || []).forEach(function (l) { s[l.toLowerCase()] = s[l.toLowerCase()] || l; }); }); return Object.keys(s).map(function (k) { return s[k]; }).sort(function (a, b) { return a.localeCompare(b, i18n.lang()); }); }
  function hasLabel(r, l) { return (r.labels || []).some(function (x) { return x.toLowerCase() === l.toLowerCase(); }); }
  /* ---------- Mappen: balk bovenaan ---------- */
  function drawFolders() {
    if (filter.folder && filter.folder !== 'none' && filter.folder !== 'fav' && filter.folder !== 'bin' && !folderOf(filter.folder)) filter.folder = '';
    var count = function (fn) { return rows.filter(fn).length; };
    var chip = function (key, label, n, extra) {
      var on = filter.folder === key;
      return '<button type="button" class="mf-chip' + (on ? ' on' : '') + '" data-folder="' + esc(key) + '" aria-pressed="' + on + '" title="' + esc(String(label).replace(/<[^>]*>/g, '')) + '">' + label + '<span class="mf-n">' + i18n.fmt.num(n) + '</span>' + (extra || '') + '</button>';
    };
    var cur = folderOf(filter.folder), noneN = count(function (r) { return !r.folderId; });
    var many = folders.length > 8;
    bar.innerHTML = '<div class="mf-row" role="toolbar" aria-label="' + esc(t('folders.title')) + '">' +
        chip('', ico('grid') + '<span>' + t('folders.all') + '</span>', rows.length) +
        chip('fav', '<span class="mf-star">' + ico('star') + '</span><span>' + t('folders.fav') + '</span>', count(function (r) { return r.favorite; })) +
        // "Zonder map" alleen als het iets toevoegt: niet als alle codes zonder map zijn (dan is het hetzelfde als "Alle codes")
        (noneN && noneN < rows.length || filter.folder === 'none' ? chip('none', ico('inbox') + '<span>' + t('folders.none') + '</span>', noneN) : '') +
        (bin.length || purged.length || filter.folder === 'bin' ? chip('bin', ico('trash') + '<span>' + t('bin.title') + '</span>', bin.length) : '') +
        '<button type="button" class="mf-chip mf-add" data-folder-new aria-label="' + esc(t('folders.new')) + '">' + ico('folderPlus') + '<span>' + t('folders.new') + '</span></button>' +
      '</div>' +
      // Mappen op een eigen regel: volledige namen, lopen door naar een volgende regel, te verslepen
      // Mappen op een eigen regel. Dicht: één regel plus "+N meer". Open: alles, met zoeken bij veel mappen. Lege mappen zachter en zonder 0.
      (folders.length ? '<div class="mf-folders' + (foldOpen ? ' open' : '') + '"><span class="mf-lbl">' + t('folders.title') + '</span>' +
        (foldOpen && many ? '<label class="mf-find">' + ico('search') + '<input type="search" data-folder-find value="' + esc(foldQ) + '" placeholder="' + esc(t('folders.find')) + '" aria-label="' + esc(t('folders.find')) + '"></label>' : '') +
        folders.map(function (f) { var n = count(function (r) { return r.folderId === f.id; });
          return '<span class="mf-wrap' + (n ? '' : ' mf-empty') + '" draggable="true" data-fid="' + esc(f.id) + '" data-name="' + esc(f.name.toLowerCase()) + '" title="' + esc(t('folders.dragHint')) + '">' + chip(f.id, dot(f) + '<span>' + esc(f.name) + '</span>', n) +
          '<button type="button" class="mf-x" data-folder-x="' + esc(f.id) + '" aria-label="' + esc(t('folders.delete') + ': ' + f.name) + '" title="' + esc(t('folders.delete')) + '">' + ico('x') + '</button></span>'; }).join('') +
        '<button type="button" class="mf-toggle" data-folder-toggle aria-expanded="' + foldOpen + '"></button></div>' : '') +
      (cur ? '<div class="mf-head">' + dot(cur) + '<b>' + esc(cur.name) + '</b>' +
        '<button type="button" class="btn ghost sm" data-folder-edit>' + ico('pen') + '<span>' + t('folders.edit') + '</span></button>' +
        '<button type="button" class="btn ghost sm mf-del" data-folder-delete>' + ico('trash') + '<span>' + t('folders.delete') + '</span></button></div>' : '') +
      (folders.length ? '' : '<p class="mf-tip">' + t('folders.tip') + '</p>');
    bar.hidden = !rows.length && !folders.length && !bin.length && !purged.length;
    fitFolders();
  }
  /* Dicht: mappen die niet op de eerste regel passen verbergen, met "+N meer" erachter (de gekozen map blijft altijd zichtbaar).
     Tijdens het slepen van een code zijn alle mappen zichtbaar, zodat je hem op elke map kunt neerzetten. */
  var foldOpen = false, foldQ = ''; try { foldOpen = localStorage.getItem('mc.foldOpen') === '1'; } catch (e) {}
  function fitFolders() {
    var box = bar.querySelector('.mf-folders'); if (!box || bar.hidden) return;
    var wraps = [].slice.call(box.querySelectorAll('.mf-wrap')), tg = box.querySelector('[data-folder-toggle]');
    wraps.forEach(function (w) { w.classList.remove('mf-cut'); });
    if (foldOpen) {
      var q = foldQ.trim().toLowerCase();
      wraps.forEach(function (w) { if (q && w.getAttribute('data-name').indexOf(q) < 0) w.classList.add('mf-cut'); });
      tg.hidden = false; tg.textContent = t('folders.less'); return;
    }
    tg.hidden = true;
    var top = wraps.length ? wraps[0].offsetTop : 0, over = function (el) { return el.offsetTop > top + 4; };
    if (!wraps.some(over)) return;
    tg.hidden = false;
    var label = function () { var n = wraps.filter(function (w) { return w.classList.contains('mf-cut'); }).length; tg.textContent = t('folders.moreN', { n: i18n.fmt.num(n) }); };
    wraps.forEach(function (w) { if (over(w)) w.classList.add('mf-cut'); }); label();
    // Ruimte maken voor de knop en voor de gekozen map
    var sel = wraps.filter(function (w) { return w.querySelector('.mf-chip.on'); })[0];
    if (sel) sel.classList.remove('mf-cut');
    for (var i = wraps.length - 1; i >= 0 && (over(tg) || (sel && over(sel))); i--) {
      if (wraps[i] !== sel && !wraps[i].classList.contains('mf-cut')) { wraps[i].classList.add('mf-cut'); label(); }
    }
  }
  var fitTick = 0;
  addEventListener('resize', function () { clearTimeout(fitTick); fitTick = setTimeout(fitFolders, 80); });
  // Ook als de breedte van de balk later pas verandert (menu in- of uitklappen, overgang naar mobiel)
  var fitW = 0; if (window.ResizeObserver) new ResizeObserver(function () { var w = bar.clientWidth; if (w && w !== fitW) { fitW = w; clearTimeout(fitTick); fitTick = setTimeout(fitFolders, 30); } }).observe(bar);
  document.addEventListener('click', function (e) { var m = bar.querySelector('.mf-menu'); if (m && !m.hidden && !e.target.closest('.mf-more')) { m.hidden = true; bar.querySelector('[data-folder-more]').setAttribute('aria-expanded', 'false'); } });
  function visible() {
    var q = filter.q.trim().toLowerCase();
    var out = rows.filter(function (r) {
      if (filter.type && r.typeId !== filter.type) return false;
      if (filter.label && !hasLabel(r, filter.label)) return false;
      if (filter.folder === 'fav' && !r.favorite) return false;
      if (filter.folder === 'none' && r.folderId) return false;
      if (filter.folder && filter.folder !== 'none' && filter.folder !== 'fav' && r.folderId !== filter.folder) return false;
      if (!q) return true;
      var dest = Object.keys(r.content || {}).filter(function (k) { return typeof r.content[k] === 'string' && !/password|secret/i.test(k); }).map(function (k) { return r.content[k]; }).join(' ');   // ook de bestemming (link, telefoon, e-mail …)
      return (displayName(r) + ' ' + typeName(getType(r.typeId)) + ' ' + r.id + ' ' + (r.shortUrl || '') + ' ' + dest + ' ' + (r.labels || []).join(' ') + ' ' + (r.note || '')).toLowerCase().indexOf(q) >= 0;   // ook labels en notitie
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
  // Door het pakket gepauzeerd (minder codes na downgraden): bewaard, weer aan na upgraden of een QR-code erbij
  function planPaused(r) { var i = window.PlanGate && PlanGate.info(); return !!(r.paused && i && i.usage && (i.usage.planPaused || []).indexOf(r.id) >= 0); }
  function card(r) {
    var tp = getType(r.typeId), stat = isStatic(r), off = !!r.paused, name = displayName(r);
    var link = stat ? '<span class="mc-static">' + t('myCodes.static') + '</span>'
      : (api.isDemo() ? '<span class="mc-url">' + esc(destText(r)) + '</span>'          // demo: de link bestaat nog niet echt
        : '<a href="' + esc(destHref(r)) + '" target="_blank" rel="noopener" title="' + esc(destText(r, true)) + '">' + esc(destText(r)) + '</a>') +
        '<button type="button" class="mc-ico" data-act="copydest" aria-label="' + esc(t('myCodes.copyDest')) + '" title="' + esc(t('myCodes.copyDest')) + '">' + ico('copy') + '</button>';
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
          (r.legacyUrl ? '<span class="mc-legacy" title="' + esc(t('legacy.badgeTip', { url: r.legacyUrl })) + '">' + ico('chain') + t('legacy.badge') + '</span>' + untilPill(r) : '') +
          // Startdatum in de toekomst: de code werkt nog niet
          (r.content && r.content.starts && r.content.starts > new Date().toISOString().slice(0, 10) ? '<span class="mc-until soon">' + ico('pause') + esc(t('fields.starts') + ' ' + i18n.fmt.date(new Date(r.content.starts + 'T00:00:00'), 'long')) + '</span>' : '') +
          (planPaused(r) ? '<span class="mc-until soon mc-planoff" title="' + esc(t('myCodes.planPausedTip')) + '">' + ico('pause') + esc(t('myCodes.planPaused')) + '</span>' : '') +
          (fo ? '<button type="button" class="mc-folder" data-folder="' + esc(fo.id) + '">' + dot(fo) + esc(fo.name) + '</button>' : '') + '</div>' +
        // Labels (klik = filteren) en notitie (klik = bewerken)
        ((r.labels || []).length || r.note ? '<div class="mc-tags">' + (r.labels || []).map(function (l) { return '<button type="button" class="mc-tag' + (filter.label && filter.label.toLowerCase() === l.toLowerCase() ? ' on' : '') + '" data-label="' + esc(l) + '">#' + esc(l) + '</button>'; }).join('') +
          (r.note ? '<button type="button" class="mc-note" data-act="labels" title="' + esc(r.note) + '">' + ico('note') + '<span>' + esc(r.note.split('\n')[0].slice(0, 60)) + '</span></button>' : '') + '</div>' : '') +
        '<div class="mc-link">' + link + hlBadge(r) + '</div></div>' +
      (stat ? '<div class="mc-scans"><b>–</b><small>' + t('myCodes.noScans') + '</small></div>'
        : '<button type="button" class="mc-scans" data-act="where" title="' + esc(t('myCodes.whereTip')) + '"><b title="' + esc(i18n.fmt.num(r.scans || 0)) + '">' + ((r.scans || 0) >= 1000000 ? i18n.fmt.compact(r.scans) : i18n.fmt.num(r.scans || 0)) + '</b><small>' + (r.content && r.content.maxScans ? esc(t('myCodes.ofLimit', { max: i18n.fmt.num(Number(r.content.maxScans)) })) : t('myCodes.scansTotal')) + '</small>' +
          // Scanlimiet: hoe ver is de actie? (balkje, oranje vanaf 80%, rood als het op is)
          (r.content && r.content.maxScans ? (function () { var pct = Math.min(100, Math.round((r.scans || 0) / Number(r.content.maxScans) * 100)); return '<i class="mc-limit' + (pct >= 100 ? ' full' : pct >= 80 ? ' near' : '') + '"><i style="width:' + pct + '%"></i></i>'; })() : '') + '</button>') +
      '<div class="mc-state">' + (stat ? '<span class="mc-pill on">' + t('myCodes.always') + '</span>'
        : '<button type="button" class="mc-switch" role="switch" aria-checked="' + !off + '" data-act="toggle"' + (off && r.hold && r.hold.lock ? ' aria-disabled="true" title="' + esc(t('myCodes.heldLocked')) + '"' : '') + '><span class="sw"></span><span>' + t(off ? 'myCodes.offLabel' : 'myCodes.onLabel') + '</span></button>') + '</div>' +
      '<div class="mc-acts">' +
        '<div class="mc-drop"><button type="button" class="btn ghost sm" data-act="dlmenu" aria-haspopup="true" aria-expanded="false">' + ico('dl') + '<span>' + t('myCodes.download') + '</span></button>' +
          '<div class="mc-menu mc-dlm" role="menu" hidden>' + dlMenu(false) + '</div></div>' +
        '<button type="button" class="btn ghost sm" data-act="edit">' + ico('edit') + '<span>' + t('myCodes.edit') + '</span></button>' +
        '<div class="mc-drop"><button type="button" class="mc-ico big" data-act="more" aria-haspopup="true" aria-expanded="false" aria-label="' + esc(t('myCodes.more')) + '" title="' + esc(t('myCodes.more')) + '">' + ico('more') + '</button>' +
          '<div class="mc-menu right" role="menu" hidden>' +
            '<button type="button" role="menuitem" data-act="where">' + ico('pin') + t('cd.menu') + '</button>' +
            (stat ? '' : (api.isDemo() ? '' : '<button type="button" role="menuitem" data-act="open">' + ico('open') + t('myCodes.open') + '</button>') + '<button type="button" role="menuitem" data-act="copy">' + ico('copy') + t('myCodes.copy') + '</button>') +
            '<button type="button" role="menuitem" data-act="rename">' + ico('pen') + t('myCodes.rename') + '</button>' +
            (stat || api.isDemo() ? '' : '<button type="button" role="menuitem" data-act="history">' + ico('history') + t('hist.menu') + '</button>') +
            '<button type="button" role="menuitem" data-act="duplicate">' + ico('dup') + t('myCodes.duplicate') + '</button>' +
            '<button type="button" role="menuitem" data-act="labels">' + ico('tag') + t('labels.menu') + '</button>' +
            '<button type="button" role="menuitem" data-act="sheet">' + ico('print') + t('sheet.title') + '</button>' +
            '<button type="button" role="menuitem" data-act="move">' + ico('move') + t('folders.moveTo') + '</button>' +
            (r.folderId ? '<button type="button" role="menuitem" data-act="moveout">' + ico('moveOut') + t('folders.moveOut') + '</button>' : '') +
            (!stat && isTeam() ? '<button type="button" role="menuitem" data-act="legacy">' + ico('chain') + t(r.legacyUrl ? 'legacy.menuEdit' : 'legacy.menu') + '</button>' : '') +
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
    tools.hidden = !rows.length || filter.folder === 'bin';
    if (filter.folder === 'bin') { drawBin(); drawBulk(); return; }
    if (!rows.length) {
      list.innerHTML = '<div class="mc-empty glass">' + ico('empty') + '<h3>' + t('myCodes.emptyTitle') + '</h3><p>' + t('myCodes.emptyText') + '</p>' +
        '<span class="mc-empty-btns"><button type="button" class="btn primary" data-mc-new>' + ico('plus') + t('myCodes.first') + '</button>' +
        (isTeam() ? '<button type="button" class="btn ghost" data-import>' + ico('qr') + t('imp.button') + '</button>' : '') + '</span></div>';
      return;
    }
    var vis = visible(), searching = filter.q.trim() || filter.type;
    var due = rows.filter(function (r) { var n = untilDays(r); return n != null && n <= 60; });
    var dueHtml = due.length ? '<div class="mc-due' + (due.some(function (r) { return untilDays(r) <= 0; }) ? ' over' : '') + '" role="alert">' + ico('lock') + '<span><b>' + esc(t('legacy.bannerTitle', { n: due.length })) + '</b> ' + esc(t('legacy.bannerText')) +
      ' <span class="mc-due-list">' + due.map(function (r) { return esc(displayName(r)) + ' (' + esc(untilDate(r)) + ')'; }).join(', ') + '</span></span></div>' : '';
    var pp = rows.filter(planPaused).length;
    if (pp) dueHtml += '<div class="mc-due mc-planbar" role="status">' + ico('pause') + '<span><b>' + esc(t(pp === 1 ? 'myCodes.planBarOne' : 'myCodes.planBar', { n: pp })) + '</b> ' + esc(t('myCodes.planBarText')) + '</span>' +
      '<button type="button" class="btn primary sm" data-gate-open="" data-gate-reason="limit">' + esc(t('myCodes.planBarBtn')) + '</button></div>';
    var lk = [filter.q, filter.type, filter.sort, filter.folder, filter.label].join('|'); if (lk !== limitKey) { limitKey = lk; limit = STEP; }
    var shown = vis.slice(0, limit), rest = vis.length - shown.length;
    list.innerHTML = dueHtml + (vis.length ? shown.map(card).join('') + (rest > 0 ? '<div class="mc-more"><button type="button" class="btn ghost" data-more>' + esc(t('myCodes.showMore', { n: i18n.fmt.num(rest) })) + '</button></div>' : '')
      : !searching && filter.folder === 'fav' ? '<div class="mc-empty small glass">' + ico('star') + '<h3>' + t('folders.favEmpty') + '</h3><p>' + t('folders.favEmptyText') + '</p></div>'
      : !searching && filter.folder ? '<div class="mc-empty small glass">' + ico('folder') + '<h3>' + t(filter.folder === 'none' ? 'folders.noneEmpty' : 'folders.empty') + '</h3><p>' + t(filter.folder === 'none' ? 'folders.noneEmptyText' : 'folders.emptyText') + '</p>' +
          (filter.folder !== 'none' ? '<button type="button" class="btn primary" data-mc-new>' + ico('plus') + t('folders.newHere') + '</button>' : '') + '</div>'
      : '<div class="mc-empty small glass"><h3>' + t('myCodes.noneFound') + '</h3><button type="button" class="btn ghost" data-act="clear">' + t('myCodes.clear') + '</button></div>');
    if (renaming) { var inp = list.querySelector('[data-rename]'); if (inp) { inp.focus(); inp.select(); } }
    var mb = list.querySelector('[data-more]');
    if (moreObs) moreObs.disconnect();
    if (mb && 'IntersectionObserver' in window) { moreObs = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { moreObs.disconnect(); showMore(); } }, { rootMargin: '600px' }); moreObs.observe(mb); }
    drawBulk();
  }
  function showMore() { limit += STEP * 2; draw(); }
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
      '<button type="button" class="btn ghost sm" data-bulk="move" title="' + esc(t('folders.moveTo')) + '">' + ico('move') + '<span>' + t('folders.moveTo') + '</span></button>' +
      (sel.some(function (r) { return r.folderId; }) ? '<button type="button" class="btn ghost sm" data-bulk="moveout" title="' + esc(t('folders.moveOut')) + '">' + ico('moveOut') + '<span>' + t('folders.moveOut') + '</span></button>' : '') +
      '<div class="mc-drop mc-up"><button type="button" class="btn ghost sm" data-bulk="dl" aria-haspopup="true" aria-expanded="false" title="' + esc(t('myCodes.download')) + '">' + ico('dl') + '<span>' + t('myCodes.download') + '</span></button><div class="mc-menu mc-dlm" role="menu" hidden>' + dlMenu(true) + '</div></div>' +
      (dyn.length ? '<button type="button" class="btn ghost sm" data-bulk="pause">' + t('myCodes.bulkPause') + '</button><button type="button" class="btn ghost sm" data-bulk="resume">' + t('myCodes.bulkResume') + '</button>' : '') +
      '<button type="button" class="btn ghost sm" data-bulk="sheet" title="' + esc(t('sheet.title')) + '">' + ico('print') + '<span>' + t('sheet.short') + '</span></button>' +
      '<button type="button" class="btn ghost sm danger-ghost" data-bulk="delete" title="' + esc(t('myCodes.delete')) + '">' + ico('trash') + '<span>' + t('myCodes.delete') + '</span></button>' +
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
    if (k === 'moveout') return move(sel.filter(function (r) { return r.folderId; }).map(function (r) { return r.id; }), null);
    if (k === 'delete') return askDeleteMany(sel);
    if (k === 'sheet') return askSheet(sel);
    if (k === 'pause' || k === 'resume') {
      var next = k === 'pause', todo = sel.filter(function (r) { return !isStatic(r) && !!r.paused !== next && !(r.hold && r.hold.lock); });
      // Na elkaar (niet tegelijk): bij aanzetten telt de limiet van het pakket per code
      var ok = 0, full = false;
      todo.reduce(function (p, r) { return p.then(function () { if (full) return; return api.patchQrCode(r.id, { paused: next }).then(function (rec) { replace(rec); ok++; }).catch(function (x) { if (x && x.code === 'plan_limit') full = true; }); }); }, Promise.resolve())
        .then(function () { if (window.PlanGate) PlanGate.load(); draw(); toastText(t(next ? 'myCodes.bulkPaused' : 'myCodes.bulkResumed', { n: ok })); if (full && window.PlanGate) PlanGate.upgrade(null, 'limit'); });
    }
  });
  document.addEventListener('click', function (e) { if (!bulk.hidden && !e.target.closest('.mc-bulk .mc-drop')) { var m = bulk.querySelector('.mc-menu'); if (m) m.hidden = true; } });
  view.addEventListener('change', function (e) {
    var sel = e.target.closest && e.target.closest('[data-dist]'); if (!sel) return;
    dlDist = +sel.value; try { localStorage.setItem('mc.dist', String(dlDist)); } catch (x) {}
    view.querySelectorAll('.mc-ptip').forEach(function (el) { el.innerHTML = ptipInner(); });
    var again = view.querySelector('.mc-menu:not([hidden]) [data-dist]'); if (again) again.focus();
  });
  function setSize(z) {
    dlSize = z; try { localStorage.setItem('mc.dlSize', String(z)); } catch (e) {}
    view.querySelectorAll('.mc-sz').forEach(function (b) { var on = +b.getAttribute('data-size') === z; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    view.querySelectorAll('.mc-ptip').forEach(function (el) { el.innerHTML = ptipInner(); });
  }
  // Labels en notitie bewerken (venster): labels als losse knopjes, suggesties uit je andere codes
  function askLabels(r) {
    var cur = (r.labels || []).slice();
    function chips() {
      var sug = allLabels().filter(function (l) { return !cur.some(function (c) { return c.toLowerCase() === l.toLowerCase(); }); });
      return '<div class="lb-cur">' + (cur.length ? cur.map(function (l, i) { return '<span class="lb-chip">#' + esc(l) + '<button type="button" data-lb-del="' + i + '" aria-label="' + esc(t('labels.remove', { l: l })) + '">×</button></span>'; }).join('') : '<small>' + t('labels.none') + '</small>') + '</div>' +
        (sug.length ? '<div class="lb-sug"><small>' + t('labels.suggest') + '</small>' + sug.slice(0, 12).map(function (l) { return '<button type="button" class="mc-tag" data-lb-add="' + esc(l) + '">+ ' + esc(l) + '</button>'; }).join('') + '</div>' : '');
    }
    dialog.innerHTML = '<form method="dialog" class="mc-dlg lb-dlg"><span class="mc-dlg-ic">' + ico('tag') + '</span><h3>' + esc(t('labels.title', { name: displayName(r) })) + '</h3><p>' + t('labels.lead') + '</p>' +
      '<label class="auth-f"><span>' + t('labels.labels') + '</span><span class="auth-in"><input id="lbIn" maxlength="30" placeholder="' + esc(t('labels.ph')) + '" autocomplete="off"></span></label>' +
      '<div id="lbChips">' + chips() + '</div>' +
      '<label class="auth-f"><span>' + t('labels.note') + '</span><span class="auth-in"><textarea id="lbNote" rows="3" maxlength="1000" placeholder="' + esc(t('labels.notePh')) + '">' + esc(r.note || '') + '</textarea></span></label>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn primary" value="ok">' + t('acct.save') + '</button></div></form>';
    var inp = dialog.querySelector('#lbIn'), box = dialog.querySelector('#lbChips');
    function add(v) { v = String(v || '').replace(/^#/, '').replace(/\s+/g, ' ').trim().slice(0, 30); if (v && cur.length < 10 && !cur.some(function (c) { return c.toLowerCase() === v.toLowerCase(); })) cur.push(v); box.innerHTML = chips(); }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(inp.value); inp.value = ''; } else if (e.key === 'Backspace' && !inp.value && cur.length) { cur.pop(); box.innerHTML = chips(); } });
    box.addEventListener('click', function (e) {
      var d = e.target.closest('[data-lb-del]'), a = e.target.closest('[data-lb-add]');
      if (d) { cur.splice(+d.getAttribute('data-lb-del'), 1); box.innerHTML = chips(); }
      if (a) add(a.getAttribute('data-lb-add'));
    });
    dialog.onclose = function () {
      if (dialog.returnValue !== 'ok') return;
      if (inp.value.trim()) add(inp.value);
      api.patchQrCode(r.id, { labels: cur, note: dialog.querySelector('#lbNote').value }).then(function (rec) { replace(rec); drawTools(); draw(); toast('labels.saved'); }).catch(function () { toast('myCodes.failed'); });
    };
    dialog.returnValue = ''; dialog.showModal(); inp.focus();
  }
  // Printvel: meerdere codes op A4 (tafelkaartjes, stickers). Eén code: de pagina vullen met kopieën
  var sheetPer = 6, sheetNames = true, sheetCut = true;
  function askSheet(sel) {
    var one = sel.length === 1, L = [[1, '1'], [4, '2 × 2'], [6, '2 × 3'], [12, '3 × 4'], [24, '4 × 6']];
    var pages = function () { return one ? 1 : Math.ceil(sel.length / sheetPer); };
    function html() {
      return '<form method="dialog" class="mc-dlg sh-dlg"><span class="mc-dlg-ic">' + ico('print') + '</span><h3>' + esc(t('sheet.title')) + '</h3><p>' + esc(one ? t('sheet.leadOne', { name: displayName(sel[0]) }) : t('sheet.lead', { n: sel.length })) + '</p>' +
        '<div class="sh-grid" role="radiogroup" aria-label="' + esc(t('sheet.per')) + '">' + L.map(function (l) {
          var g = { 1: [1, 1], 4: [2, 2], 6: [2, 3], 12: [3, 4], 24: [4, 6] }[l[0]], cells = '';
          for (var i = 0; i < g[0] * g[1]; i++) cells += '<i></i>';
          return '<button type="button" role="radio" aria-checked="' + (sheetPer === l[0]) + '" data-sh="' + l[0] + '"><span class="sh-a4" style="--c:' + g[0] + ';--r:' + g[1] + '">' + cells + '</span><small>' + t('sheet.perN', { n: l[0] }) + '</small></button>';
        }).join('') + '</div>' +
        '<label class="set-switch"><input type="checkbox" id="shNames"' + (sheetNames ? ' checked' : '') + '><span>' + t('sheet.names') + '</span></label>' +
        '<label class="set-switch"><input type="checkbox" id="shCut"' + (sheetCut ? ' checked' : '') + '><span>' + t('sheet.cut') + '</span></label>' +
        '<p class="sh-sum">' + esc(t(one ? 'sheet.sumOne' : 'sheet.sum', { n: one ? sheetPer : sel.length, p: pages() })) + '</p>' +
        '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn primary" value="ok">' + ico('dl') + t('sheet.make') + '</button></div></form>';
    }
    dialog.innerHTML = html();
    dialog.onclick = function (e) { var b = e.target.closest('[data-sh]'); if (!b) return; sheetPer = +b.getAttribute('data-sh'); sheetNames = dialog.querySelector('#shNames').checked; sheetCut = dialog.querySelector('#shCut').checked; dialog.innerHTML = html(); };
    dialog.onclose = function () {
      dialog.onclick = null;
      if (dialog.returnValue !== 'ok') return;
      sheetNames = dialog.querySelector('#shNames').checked; sheetCut = dialog.querySelector('#shCut').checked;
      toast('sheet.busy');
      CodeUtil.sheetPdf(sel, sheetPer, { names: sheetNames, cut: sheetCut, fill: one })
        .then(function (b) { saveFile(b, (one ? CodeUtil.fileName(sel[0]) : 'qr-codes') + '-a4-' + new Date().toISOString().slice(0, 10) + '.pdf'); })
        .catch(function () { toast('myCodes.failed'); });
    };
    dialog.returnValue = ''; dialog.showModal();
  }
  function askDeleteMany(sel) {
    dialog.innerHTML = '<form method="dialog" class="mc-dlg">' + '<span class="mc-dlg-ic">' + ico('trash') + '</span>' +
      '<h3>' + esc(t('myCodes.bulkDeleteTitle', { n: sel.length })) + '</h3><p>' + t('myCodes.bulkDeleteText') + '</p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok">' + t('myCodes.delete') + '</button></div></form>';
    dialog.onclose = function () {
      if (dialog.returnValue !== 'ok') return;
      Promise.all(sel.map(function (r) { return api.deleteQrCode(r.id).then(function () { return r.id; }).catch(function () { return null; }); })).then(function (ids) {
        var gone = ids.filter(Boolean); rows = rows.filter(function (x) { return gone.indexOf(x.id) < 0; }); gone.forEach(function (id) { delete picked[id]; });
        drawTools(); draw(); afterDelete(sel.filter(function (r) { return gone.indexOf(r.id) >= 0; }));
      });
    };
    dialog.returnValue = ''; dialog.showModal(); dialog.querySelector('[value="cancel"]').focus();
  }
  function message(key) { list.innerHTML = '<p class="muted-msg">' + t(key) + '</p>'; }
  function load() {
    if (!loaded) message('myCodes.loading');
    return Promise.all([api.listQrCodes(), api.folders.list().catch(function () { return { folders: [] }; }), api.trash ? api.trash().catch(function () { return []; }) : [], api.purgedLog ? api.purgedLog().catch(function () { return []; }) : []])
      .then(function (res) { rows = res[0] || []; folders = (res[1] && res[1].folders) || []; bin = res[2] || []; purged = res[3] || []; if (filter.folder === 'bin' && !bin.length && !purged.length) filter.folder = ''; loaded = true; label(); drawTools(); draw();
        if (api.codeHealth) api.codeHealth().then(function (h) { health = h || {}; draw(); document.dispatchEvent(new CustomEvent('health-loaded', { detail: health })); }).catch(function () {}); })
      .catch(function () { message('myCodes.error'); });
  }

  /* ---------- Acties ---------- */
  /* Health check: groen bolletje = link werkt, rood = werkt niet (klik = opnieuw controleren) */
  function hlBadge(r) {
    var h = health[r.id]; if (!h || h.state === 'checking') return '';
    var when = i18n.fmt.stamp(h.at, 'short');
    if (h.state === 'ok') return '<span class="mc-hl ok" title="' + esc(t('myCodes.hlOkTip', { when: when })) + '" aria-label="' + esc(t('myCodes.hlOkTip', { when: when })) + '"></span>';
    var b = (h.bad || [])[0] || {};
    return '<button type="button" class="mc-hl bad" data-act="recheck" title="' + esc(t('myCodes.hlBadTip', { url: b.url || '', status: b.status ? String(b.status) : t('myCodes.hlNoAnswer'), when: when })) + '">' + ico('warn') + '<span>' + esc(t('myCodes.hlBad')) + '</span></button>';
  }
  function find(id) { return rows.filter(function (r) { return r.id === id; })[0]; }
  function replace(rec) { rows = rows.map(function (r) { return r.id === rec.id ? rec : r; }); }
  function toast(key) {
    toastEl.textContent = t(key); toastEl.classList.remove('has-action'); toastEl.hidden = false; toastEl.classList.add('show');
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
    api.patchQrCode(r.id, { paused: next }).then(function (rec) { replace(rec); if (window.PlanGate) PlanGate.load(); draw(); toast(next ? 'myCodes.pausedToast' : 'myCodes.activeToast'); })
      .catch(function (x) { r.paused = !next; draw(); if (x && x.code === 'plan_limit' && window.PlanGate) return PlanGate.upgrade(null, 'limit'); toast(x && x.code === 'admin_hold' ? 'myCodes.heldLocked' : 'myCodes.failed'); });
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
    }).catch(function (e) { toast(e && e.code === 'plan_limit' ? 'plan.limitCreate' : 'myCodes.failed'); if (e && /^plan_(limit|type)$/.test(e.code) && window.PlanGate) PlanGate.upgrade(null, e.code === 'plan_type' ? 'type' : 'limit'); });
  }
  function askDelete(r) {
    dialog.innerHTML = '<form method="dialog" class="mc-dlg">' + '<span class="mc-dlg-ic">' + ico('trash') + '</span>' +
      '<h3>' + esc(t('myCodes.deleteTitle', { name: displayName(r) })) + '</h3><p>' + t(isStatic(r) ? 'myCodes.deleteTextStatic' : 'myCodes.deleteText') + '</p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok">' + t('myCodes.delete') + '</button></div></form>';
    dialog.onclose = function () {
      if (dialog.returnValue !== 'ok') return;
      api.deleteQrCode(r.id).then(function () { rows = rows.filter(function (x) { return x.id !== r.id; }); drawTools(); draw(); afterDelete([r]); })
        .catch(function () { toast('myCodes.failed'); });
    };
    dialog.returnValue = ''; dialog.showModal();
    dialog.querySelector('[value="cancel"]').focus();
  }
  /* ---------- Prullenbak (Onlangs verwijderd): 30 dagen terug te zetten ---------- */
  function afterDelete(list) {
    if (api.isDemo()) return toastText(list.length === 1 ? t('myCodes.deleted') : t('myCodes.bulkDeleted', { n: list.length }));
    api.trash().then(function (b) { bin = b || []; drawFolders(); }).catch(function () {});
    toastAction(list.length === 1 ? t('bin.moved') : t('bin.movedMany', { n: list.length }), t('bin.undo'), function () { restore(list.map(function (r) { return r.id; }), true); });
  }
  function restore(ids, quiet) {
    Promise.all(ids.map(function (id) { return api.restoreQrCode(id).then(function (r) { return r; }).catch(function () { return null; }); })).then(function (res) {
      var ok = res.filter(Boolean), paused = ok.some(function (r) { return r.paused; });
      ok.forEach(function (r) { rows.unshift(r.code); bin = bin.filter(function (x) { return x.id !== r.code.id; }); });
      if (filter.folder === 'bin' && !bin.length && !purged.length) filter.folder = '';
      drawTools(); draw();
      if (!ok.length) return toast('myCodes.failed');
      toastText(paused ? t('bin.restoredPaused') : ok.length === 1 ? t('bin.restored') : t('bin.restoredMany', { n: ok.length }));
    });
  }
  function askPurge(r) {
    dialog.innerHTML = '<form method="dialog" class="mc-dlg"><span class="mc-dlg-ic">' + ico('trash') + '</span>' +
      '<h3>' + esc(t('bin.purgeTitle', { name: displayName(r) })) + '</h3><p>' + t('bin.purgeText') + '</p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok">' + t('bin.purge') + '</button></div></form>';
    dialog.onclose = function () {
      if (dialog.returnValue !== 'ok') return;
      api.purgeQrCode(r.id).then(function () { bin = bin.filter(function (x) { return x.id !== r.id; }); return api.purgedLog().catch(function () { return purged; }); }).then(function (p) { purged = p || []; drawTools(); draw(); toastText(t('bin.purged')); })
        .catch(function () { toast('myCodes.failed'); });
    };
    dialog.returnValue = ''; dialog.showModal(); dialog.querySelector('[value="cancel"]').focus();
  }
  function binCard(r) {
    var tp = getType(r.typeId), left = Math.max(0, Math.ceil((new Date(r.purgeAt) - new Date()) / 864e5));
    return '<article class="mc-card glass mc-binned" data-bin="' + esc(r.id) + '">' +
      '<div class="mc-qr"><span aria-hidden="true">' + QRRender.svg(qrData(r), qrDesign(r)) + '</span></div>' +
      '<div class="mc-info"><h3 class="mc-name">' + esc(displayName(r)) + '</h3>' +
        '<div class="mc-meta"><span class="mc-type"><i>' + svg(tp.icon, 1.8) + '</i>' + esc(typeName(tp)) + '</span><span class="mc-dot">·</span><span>' + esc(t('bin.deletedOn', { date: i18n.fmt.date(new Date(r.trashedAt), 'short') })) + '</span></div>' +
        '<p class="mc-binleft' + (left <= 3 ? ' soon' : '') + '">' + esc(left === 1 ? t('bin.leftOne') : t('bin.left', { n: left })) + '</p></div>' +
      '<div class="mc-binacts"><button type="button" class="btn primary sm" data-bin-restore>' + ico('undo') + '<span>' + t('bin.restore') + '</span></button>' +
        '<button type="button" class="btn ghost sm mf-del" data-bin-purge>' + ico('trash') + '<span>' + t('bin.purge') + '</span></button></div></article>';
  }
  /* Logboek: definitief verwijderd (alleen naam, soort, datum, door wie) */
  function purgedLog() {
    if (!purged.length) return '';
    return '<details class="mc-purged glass"' + (purgedOpen ? ' open' : '') + '><summary><span>' + ico('trash') + '<b>' + t('bin.logTitle') + '</b><em>' + purged.length + '</em></span>' + ico('chev') + '</summary>' +
      '<p class="mc-purged-lead">' + t('bin.logLead') + '</p><ol>' + purged.map(function (x) {
        var tp = getType(x.type) || { icon: 'link' };
        return '<li><i>' + svg(tp.icon, 1.8) + '</i><span><b>' + esc(x.name || typeName(tp)) + '</b><small>' + esc(typeName(tp)) + '</small></span>' +
          '<span class="mc-purged-when">' + esc(i18n.fmt.stamp(x.at, 'time')) + '<small>' + esc(x.auto ? t('bin.logAuto') : t('bin.logBy', { name: x.by || '' })) + '</small></span></li>';
      }).join('') + '</ol></details>';
  }
  function drawBin() {
    list.innerHTML = '<div class="mc-binnote glass">' + ico('trash') + '<span>' + t('bin.note') + '</span></div>' + (bin.length ? bin.map(binCard).join('') : '<div class="mc-empty small glass"><h3>' + t('bin.empty') + '</h3></div>') + purgedLog();
    var d = list.querySelector('.mc-purged'); if (d) d.addEventListener('toggle', function () { purgedOpen = d.open; });
  }
  list.addEventListener('click', function (e) {
    var c = e.target.closest('[data-bin]'); if (!c) return;
    var r = bin.filter(function (x) { return x.id === c.getAttribute('data-bin'); })[0]; if (!r) return;
    if (e.target.closest('[data-bin-restore]')) { e.target.closest('button').disabled = true; return restore([r.id]); }
    if (e.target.closest('[data-bin-purge]')) return askPurge(r);
  });
  function toastAction(text, label, fn) {
    toastEl.innerHTML = ''; var s = document.createElement('span'); s.textContent = text; toastEl.appendChild(s);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'mc-toast-btn'; b.textContent = label;
    b.onclick = function () { b.disabled = true; toastEl.classList.remove('show'); toastEl.hidden = true; fn(); }; toastEl.appendChild(b);
    toastEl.hidden = false; toastEl.classList.add('show', 'has-action');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show', 'has-action'); setTimeout(function () { toastEl.hidden = true; }, 250); }, 7000);
  }
  /* ---------- Geschiedenis: vorige versies van de inhoud, terugzetten met één klik ---------- */
  function askHistory(r) {
    var when = function (iso) { return i18n.fmt.stamp(iso, 'time'); };
    var destOf = function (x) { return x.dest && x.dest.value ? x.dest.value.replace(/^https?:\/\/(www\.)?/, '') : t('myCodes.ownPage'); };
    dialog.innerHTML = '<form method="dialog" class="mc-dlg hs-dlg"><span class="mc-dlg-ic">' + ico('history') + '</span><h3>' + esc(t('hist.title', { name: displayName(r) })) + '</h3>' +
      '<div class="hs-now"><small>' + t('hist.now') + '</small><b>' + esc(destText(r)) + '</b></div><div class="hs-list"><p class="muted-msg">' + t('myCodes.loading') + '</p></div>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('hist.close') + '</button></div></form>';
    var box = dialog.querySelector('.hs-list');
    dialog.onclose = null; dialog.returnValue = ''; dialog.showModal();
    api.codeHistory(r.id).then(function (list) {
      if (!list.length) { box.innerHTML = '<p class="hs-empty">' + t('hist.empty') + '</p>'; return; }
      box.innerHTML = '<p class="hs-lead">' + t('hist.lead') + '</p><ol class="hs-items">' + list.map(function (v) {
        return '<li><div><b>' + esc(destOf(v)) + '</b><small>' + esc(when(v.at)) + (v.by ? ' · ' + esc(v.by) : '') + '</small></div>' +
          (v.restorable ? '<button type="button" class="btn ghost sm" data-hs="' + v.n + '">' + ico('undo') + '<span>' + t('hist.restore') + '</span></button>' : '<span class="hs-gone" title="' + esc(t('hist.goneTip')) + '">' + t('hist.gone') + '</span>') + '</li>';
      }).join('') + '</ol>';
    }).catch(function () { box.innerHTML = '<p class="acct-msg bad">' + t('myCodes.failed') + '</p>'; });
    box.onclick = function (e) {
      var b = e.target.closest('[data-hs]'); if (!b) return;
      b.disabled = true;
      api.restoreVersion(r.id, b.getAttribute('data-hs')).then(function (saved) {
        rows = rows.map(function (x) { return x.id === r.id ? Object.assign({}, x, saved) : x; });
        dialog.close(); draw(); toastText(t('hist.restored'));
        document.dispatchEvent(new CustomEvent('code-changed', { detail: saved }));
      }).catch(function (x) { b.disabled = false; toastText(t(x && x.code === 'files_gone' ? 'hist.goneTip' : 'myCodes.failed')); });
    };
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
    dialog.innerHTML = '<form method="dialog" class="mc-dlg mf-dlg" novalidate><span class="mc-dlg-ic mf-ic">' + ico(f ? 'folder' : 'folderPlus') + '</span>' +
      '<h3>' + t(f ? 'folders.editTitle' : 'folders.newTitle') + '</h3>' +
      '<label class="auth-f"><span>' + t('folders.name') + '</span><span class="auth-in"><input id="mfName" maxlength="40" value="' + esc(f ? f.name : '') + '" placeholder="' + esc(t('folders.namePh')) + '" autocomplete="off"></span></label>' +
      '<p class="acct-msg bad" id="mfMsg" hidden></p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel" formnovalidate>' + t('myCodes.cancel') + '</button><button class="btn primary" value="ok" id="mfGo">' + t(f ? 'folders.save' : 'folders.create') + '</button></div></form>';
    var inp = dialog.querySelector('#mfName'), msg = dialog.querySelector('#mfMsg');
    dialog.querySelector('#mfGo').addEventListener('click', function (e) {
      e.preventDefault(); var name = inp.value.replace(/\s+/g, ' ').trim();
      if (!name) { msg.hidden = false; msg.textContent = t('folders.errName'); inp.focus(); return; }
      var go = e.currentTarget; go.disabled = true;
      (f ? api.folders.update(f.id, { name: name }) : api.folders.create({ name: name })).then(function (res) {
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
  // Wat onder de naam staat: de bestemming die je hebt ingevuld (zoals in het beheer), niet onze korte link
  /* Overgezette code: tot wanneer loopt het account bij de oude QR-app? (daarna werkt de geprinte code niet meer) */
  function untilDays(r) { if (!r.legacyUrl || !r.legacyUntil) return null; var d = new Date(r.legacyUntil + 'T00:00:00'); return Math.ceil((d - new Date()) / 864e5); }
  function untilDate(r) { return i18n.fmt.date(new Date(r.legacyUntil + 'T00:00:00'), 'long'); }
  function untilPill(r) {
    var n = untilDays(r); if (n == null) return '';
    var cls = n <= 0 ? ' over' : n <= 60 ? ' soon' : '', key = n <= 0 ? 'legacy.untilOver' : n <= 60 ? 'legacy.untilSoon' : 'legacy.untilOk';
    return '<span class="mc-until' + cls + '" title="' + esc(t('legacy.untilTip')) + '">' + ico('lock') + esc(t(key, { date: untilDate(r) })) + '</span>';
  }
  function untilField(val) {
    var today = new Date(); today.setHours(12);
    return '<label class="imp-until"><span>' + t('legacy.until') + '</span><input type="date" name="until" value="' + esc(val || '') + '" min="' + today.toISOString().slice(0, 10) + '"><small>' + t('legacy.untilHint') + '</small></label>';
  }
  function destVal(r) { return (r.dest && r.dest.value) || ''; }
  function destText(r, full) { var v = destVal(r); if (!v) return t('myCodes.ownPage'); return full ? v : v.replace(/^https?:\/\/(www\.)?/, ''); }   // eigen pagina (menu, coupon …): geen externe link
  function destHref(r) { var v = destVal(r); return /^https?:\/\//i.test(v) ? v : r.shortUrl; }
  // Overzetten uit een andere QR-app: alleen het team. Klanten komen er niet mee van hun oude abonnement af (de geprinte code
  // gaat altijd eerst langs de oude app), dus voor hen zou het vooral verwarring geven.
  function isTeam() { var me = window.Session && Session.user ? Session.user() : null; return !api.isDemo() && !!(me && me.admin); }
  /* Bestaande QR-code (uit een andere app, al geprint) koppelen: deze code toont en downloadt dan precies die QR-code.
     De oude app moet doorsturen naar onze korte link; zo lopen de scans via ons en blijft de geprinte code werken. Alleen voor het team. */
  // QR-code uit een afbeelding lezen: BarcodeDetector als de browser dat kan, anders jsQR (pas geladen als het nodig is)
  var jsqrLoad = null;
  function loadJsQr() {
    if (window.jsQRmod) return Promise.resolve(window.jsQRmod.default || window.jsQRmod);
    return jsqrLoad || (jsqrLoad = new Promise(function (ok, bad) { var sc = document.createElement('script'); sc.src = 'vendor/jsqr.min.js'; sc.onload = function () { ok(window.jsQRmod.default || window.jsQRmod); }; sc.onerror = function () { jsqrLoad = null; bad(); }; document.head.appendChild(sc); }));
  }
  function readQr(file) {
    return new Promise(function (ok, bad) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var viaJs = function () { return loadJsQr().then(function (jsQR) { var d = x.getImageData(0, 0, c.width, c.height), res = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' }); return res ? res.data : ''; }); };
        var p = window.BarcodeDetector ? new BarcodeDetector({ formats: ['qr_code'] }).detect(c).then(function (r) { return r[0] ? r[0].rawValue : viaJs(); }, viaJs) : viaJs();
        p.then(ok, bad);
      };
      img.onerror = function () { URL.revokeObjectURL(url); bad(); };
      img.src = url;
    });
  }
  /* Vak voor je bestaande QR-code: foto/screenshot slepen, plakken (Ctrl+V) of kiezen, of de link zelf invullen.
     De foto wordt in de browser gelezen en niet geüpload. */
  function pickerHtml(val) {
    return '<div class="lg-drop" data-drop data-paste><label class="lg-dz">' + ico('scan') +
        '<span><b data-lg-dzt>' + t('legacy.dropTitle') + '</b><small>' + t('legacy.dropHint') + '</small></span>' +
        '<input type="file" accept="image/*" data-lg-img hidden></label></div>' +
      '<span class="lg-or">' + t('legacy.orLink') + '</span>' +
      '<input name="old" type="url" inputmode="url" spellcheck="false" maxlength="500" placeholder="https://…" value="' + esc(val || '') + '">';
  }
  function wirePicker(f, msg) {
    var dz = f.querySelector('.lg-drop'), dzt = f.querySelector('[data-lg-dzt]');
    var bad = function (key) { dz.classList.remove('ok'); dzt.textContent = t('legacy.dropTitle'); msg.textContent = t(key); msg.hidden = false; };
    dz.addEventListener('dropreject', function () { bad('legacy.notImage'); });
    f.querySelector('[data-lg-img]').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
      msg.hidden = true;
      if (!/^image\//.test(file.type)) return bad('legacy.notImage');
      dz.classList.add('busy');
      readQr(file).then(function (text) {
        dz.classList.remove('busy');
        if (!text) return bad('legacy.noQr');
        if (!/^https?:\/\//i.test(text)) return bad(/^WIFI:/i.test(text) ? 'legacy.isWifi' : 'legacy.isStatic');
        f.old.value = text; dz.classList.add('ok'); dzt.textContent = t('legacy.found');
        f.dispatchEvent(new CustomEvent('qrread'));
      }).catch(function () { dz.classList.remove('busy'); bad('legacy.noQr'); });
    });
    f.old.addEventListener('input', function () { dz.classList.remove('ok'); dzt.textContent = t('legacy.dropTitle'); });
  }
  /* Bestaande QR-code overzetten als NIEUWE code (de duidelijke plek: knop bovenaan Mijn QR-codes en bij QR-code maken).
     1) je bestaande code (foto of link)  2) waar hij naartoe moet  → we maken een website-code die precies je oude QR-code toont
     3) daarna: in je oude app de bestemming op onze korte link zetten. */
  function askImport() {
    if (api.isDemo()) return;
    var made = null;   // al aangemaakt (bij een fout in stap 2 niet nog een keer maken)
    dialog.innerHTML = '<form method="dialog" class="mc-dlg lg-dlg imp-dlg" novalidate><span class="mc-dlg-ic mf-ic">' + ico('qr') + '</span><h3>' + esc(t('imp.button')) + '</h3><p>' + t('imp.lead') + '</p>' +
      '<ol class="lg-steps"><li><b>' + t('imp.step1') + '</b>' + pickerHtml('') + '</li>' +
      '<li><b>' + t('imp.step2') + '</b><small>' + t('imp.step2Hint') + '</small><input name="dest" type="url" inputmode="url" spellcheck="false" maxlength="2000" placeholder="https://…"></li>' +
      '<li><b>' + t('imp.name') + '</b><input name="nm" type="text" maxlength="80" placeholder="' + esc(t('imp.namePh')) + '"></li></ol>' +
      '<div class="imp-check" data-imp-check hidden></div>' +
      '<p class="acct-msg bad" data-lg-msg hidden role="alert"></p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel" formnovalidate>' + t('myCodes.cancel') + '</button><button type="button" class="btn primary" data-imp-go>' + t('imp.go') + '</button></div></form>';
    var f = dialog.querySelector('form'), msg = f.querySelector('[data-lg-msg]'), go = f.querySelector('[data-imp-go]'), box = f.querySelector('[data-imp-check]');
    wirePicker(f, msg);
    /* Controle: loopt de geprinte code via een QR-dienst (dynamisch) of staat de website er direct in (statisch)?
       Statisch: overzetten kan niet (de code gaat nooit langs ons), dus tegenhouden.
       Dynamisch: de geprinte code blijft afhangen van het oude account. Dat moet de klant zien en bevestigen,
       anders zegt hij het oude account op en werkt de geprinte code ineens niet meer. */
    var kind = null, checked = '', checkNo = 0;
    var BRAND = { 'scan.page': 'qr-code.io' };                       // kort-linkdomein → naam van de dienst die de klant kent
    function hostOf(u) { try { var h = new URL(u).hostname.replace(/^www\./, ''); return BRAND[h] || h; } catch (e) { return ''; } }
    function showCheck() {
      var old = f.old.value.trim(), host = hostOf(old);
      if (!host) { box.hidden = true; kind = null; return; }
      if (kind === 'static') {
        box.className = 'imp-check stop'; go.disabled = true;
        box.innerHTML = '<b>' + ico('x') + t('imp.staticTitle') + '</b><p>' + esc(t('imp.static', { host: host })) + '</p>' +
          '<button type="button" class="btn ghost sm" data-imp-new>' + ico('plus') + '<span>' + t('imp.staticNew') + '</span></button>';
      } else {
        box.className = 'imp-check warn'; go.disabled = false;
        box.innerHTML = '<b>' + ico('lock') + t('imp.warnTitle') + '</b><p>' + esc(t('imp.warn', { host: host })) + '</p>' +
          '<label class="imp-ack"><input type="checkbox" data-imp-ack><span>' + esc(t('imp.ack', { host: host })) + '</span></label>' + untilField('');
      }
      box.hidden = false;
    }
    function check() {
      var old = f.old.value.trim();
      if (!/^https?:\/\/\S{3,}$/i.test(old)) { box.hidden = true; kind = null; checked = ''; go.disabled = false; return; }
      if (old === checked) return;
      checked = old; kind = null; var no = ++checkNo, host = hostOf(old);
      box.className = 'imp-check'; box.innerHTML = '<p>' + t('imp.checking') + '</p>'; box.hidden = false; go.disabled = true;
      // Bekende QR-diensten zijn altijd dynamisch; anders kijken of de link doorstuurt naar een ander domein
      var known = /(^|\.)(qr-code\.io|scan\.page|qrco\.de|qr\.io|qrfy\.com|me-qr\.com|qrcodechimp\.com|l\.ead\.me|scnv\.io|qr\.codes|qrs\.ly|uqr\.me|qr1\.be|bit\.ly|tinyurl\.com|rebrand\.ly|ow\.ly|flowcode\.com|qr\.link|qrgo\.page)$/i.test(host);
      (known ? Promise.resolve(null) : api.urlInfo(old).catch(function () { return null; })).then(function (info) {
        if (no !== checkNo) return;
        var to = info && info.ok && info.finalUrl ? hostOf(info.finalUrl) : '';
        kind = !known && to && to === host ? 'static' : 'dynamic';   // niet te controleren: voor de zekerheid als dynamisch (met waarschuwing)
        showCheck();
      });
    }
    f.addEventListener('qrread', function () { check(); if (!f.dest.value) f.dest.focus(); });
    f.old.addEventListener('change', check);
    f.old.addEventListener('blur', check);
    box.addEventListener('click', function (e) { if (e.target.closest('[data-imp-new]')) { dialog.close(); startNew(); } });
    var err = function (key, el) { msg.textContent = t(key); msg.hidden = false; go.disabled = false; if (el) el.focus(); };
    var done = function (rec) {
      dialog.querySelector('form').innerHTML = '<span class="mc-dlg-ic mf-ic">' + ico('check') + '</span><h3>' + t('imp.doneTitle') + '</h3><p>' + t('imp.doneLead') + '</p>' +
        '<span class="lg-link imp-link"><code>' + esc(rec.shortUrl) + '</code><button type="button" class="btn primary sm" data-lg-copy>' + ico('copy') + '<span>' + t('myCodes.copy') + '</span></button></span>' +
        '<p class="imp-note">' + t('imp.doneNote') + '</p><div class="mc-dlg-btns"><button class="btn primary" value="ok">' + t('imp.done') + '</button></div>';
      dialog.querySelector('[data-lg-copy]').addEventListener('click', function () { copy(rec.shortUrl); });
      load();
    };
    go.addEventListener('click', function () {
      msg.hidden = true;
      var old = f.old.value.trim(), dest = f.dest.value.trim(), nm = f.nm.value.trim();
      if (!/^https?:\/\/\S{3,}$/i.test(old)) return err('legacy.bad', f.old);
      if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(dest)) return err('imp.badDest', f.dest);
      if (old !== checked || !kind) { check(); return; }                          // eerst de controle afmaken
      if (kind === 'static') return;
      var ack = f.querySelector('[data-imp-ack]');
      if (!ack || !ack.checked) { msg.textContent = t('imp.needAck'); msg.hidden = false; if (ack) ack.focus(); return; }
      go.disabled = true;
      var step = made ? Promise.resolve(made) : api.createQrCode({ id: newDraftId(), typeId: 'website', content: { url: dest }, design: Object.assign({}, QR_DEFAULT_DESIGN), name: nm || undefined, folderId: folderOf(filter.folder) ? filter.folder : null })
        .then(function (rec) { made = rec; return rec; });
      step.then(function (rec) {
        if (old.replace(/\/$/, '') === rec.shortUrl.replace(/\/$/, '')) throw { self: true };
        var u = f.querySelector('[name=until]'), body = { legacyUrl: old };
        if (u && u.value) body.legacyUntil = u.value;
        return api.patchQrCode(rec.id, body);
      }).then(done).catch(function (e) {
        if (e && e.self) return err('legacy.self', f.old);
        if (e && e.code === 'plan_limit') return err('plan.limitCreate');
        err(made ? 'legacy.bad' : 'imp.badDest', made ? f.old : f.dest);
      });
    });
    dialog.onclose = null; dialog.returnValue = ''; dialog.showModal();
  }
  // Knoppen elders in de app (bv. bij QR-code maken) met data-import openen dit venster
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-import]')) return;
    e.preventDefault(); goToPage('myCodes'); askImport();
  });
  function askLegacy(r) {
    dialog.innerHTML = '<form method="dialog" class="mc-dlg lg-dlg"><h3>' + esc(t('legacy.title')) + '</h3><p>' + t('legacy.lead') + '</p>' +
      '<ol class="lg-steps"><li><b>' + t('legacy.step1') + '</b>' + pickerHtml(r.legacyUrl) + '</li>' +
      '<li><b>' + t('legacy.step2') + '</b><span class="lg-link"><code>' + esc(r.shortUrl) + '</code><button type="button" class="btn ghost sm" data-lg-copy>' + ico('copy') + '<span>' + t('myCodes.copy') + '</span></button></span></li>' +
      '<li><b>' + t('legacy.step3') + '</b></li></ol>' + untilField(r.legacyUntil) +
      '<p class="acct-msg bad" data-lg-msg hidden></p>' +
      '<div class="mc-dlg-btns">' + (r.legacyUrl ? '<button type="button" class="btn ghost" data-lg-off>' + t('legacy.unlink') + '</button>' : '') +
        '<button class="btn ghost" value="cancel" formnovalidate>' + t('myCodes.cancel') + '</button><button type="button" class="btn primary" data-lg-save>' + t('acct.save') + '</button></div></form>';
    var f = dialog.querySelector('form'), msg = f.querySelector('[data-lg-msg]');
    var save = function (url) {
      var u = f.querySelector('[name=until]'), body = { legacyUrl: url };
      if (url) body.legacyUntil = u && u.value ? u.value : null;
      api.patchQrCode(r.id, body).then(function (rec) { replace(rec); dialog.close(); draw(); toast(url ? 'legacy.saved' : 'legacy.removed'); })
        .catch(function () { msg.textContent = t('legacy.bad'); msg.hidden = false; f.old.focus(); });
    };
    wirePicker(f, msg);
    f.addEventListener('click', function (e) {
      if (e.target.closest('[data-lg-copy]')) return copy(r.shortUrl);
      if (e.target.closest('[data-lg-off]')) return save(null);
      if (e.target.closest('[data-lg-save]')) {
        var v = f.old.value.trim();
        if (!/^https?:\/\/\S{3,}$/i.test(v)) { msg.textContent = t('legacy.bad'); msg.hidden = false; return f.old.focus(); }
        if (v.replace(/\/$/, '') === r.shortUrl.replace(/\/$/, '')) { msg.textContent = t('legacy.self'); msg.hidden = false; return f.old.focus(); }
        save(v);
      }
    });
    dialog.onclose = null; dialog.returnValue = ''; dialog.showModal(); f.old.focus();
  }
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
    toastEl.textContent = text; toastEl.classList.remove('has-action'); toastEl.hidden = false; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); setTimeout(function () { toastEl.hidden = true; }, 250); }, 2200);
  }

  bar.addEventListener('click', function (e) {
    var mb = e.target.closest('[data-folder-more]');
    if (mb) { var mm = bar.querySelector('.mf-menu'); mm.hidden = !mm.hidden; mb.setAttribute('aria-expanded', String(!mm.hidden)); return; }
    if (e.target.closest('[data-folder-toggle]')) {
      foldOpen = !foldOpen; foldQ = ''; try { localStorage.setItem('mc.foldOpen', foldOpen ? '1' : '0'); } catch (x) {}
      drawFolders(); var fi = bar.querySelector('[data-folder-find]'); if (fi) fi.focus(); return;
    }
    var c = e.target.closest('[data-folder]'); if (c) { filter.folder = c.getAttribute('data-folder'); return draw(); }
    if (e.target.closest('[data-folder-new]')) return folderDialog(null, function (nf) { filter.folder = nf.id; draw(); });
    var cur = folderOf(filter.folder);
    if (cur && e.target.closest('[data-folder-edit]')) return folderDialog(cur);
    if (cur && e.target.closest('[data-folder-delete]')) return askDeleteFolder(cur);
    var fx = e.target.closest('[data-folder-x]'); if (fx) { var ff = folderOf(fx.getAttribute('data-folder-x')); if (ff) return askDeleteFolder(ff); }
  });
  bar.addEventListener('input', function (e) { if (e.target.matches('[data-folder-find]')) { foldQ = e.target.value; fitFolders(); } });
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
  /* Mappen zelf verslepen (volgorde zoals jij wilt; wordt bewaard) */
  var dragFid = null;
  bar.addEventListener('dragstart', function (e) {
    var w = e.target.closest && e.target.closest('.mf-wrap[data-fid]'); if (!w) return;
    dragFid = w.getAttribute('data-fid'); w.classList.add('mf-dragging');
    try { e.dataTransfer.setData('text/x-folder', dragFid); e.dataTransfer.effectAllowed = 'move'; } catch (x) {}
  });
  bar.addEventListener('dragover', function (e) {
    if (!dragFid) return;
    var w = e.target.closest('.mf-wrap[data-fid]'), src = bar.querySelector('.mf-wrap[data-fid="' + dragFid + '"]'); if (!w || !src) return;
    e.preventDefault(); if (w === src) return;
    var r = w.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
    w.parentNode.insertBefore(src, after ? w.nextSibling : w);
  });
  function endFolderDrag(save) {
    if (!dragFid) return; var src = bar.querySelector('.mf-dragging'); if (src) src.classList.remove('mf-dragging'); dragFid = null;
    if (!save) return;
    var ids = [].slice.call(bar.querySelectorAll('.mf-folders .mf-wrap[data-fid]')).map(function (w) { return w.getAttribute('data-fid'); });
    var rest = folders.filter(function (f) { return ids.indexOf(f.id) < 0; }).map(function (f) { return f.id; });   // verborgen onder "Meer"
    ids = ids.concat(rest);
    if (ids.join() === folders.map(function (f) { return f.id; }).join()) return;
    var by = {}; folders.forEach(function (f) { by[f.id] = f; }); folders = ids.map(function (id) { return by[id]; }).filter(Boolean);
    api.folders.order(ids).catch(function () { toast('myCodes.failed'); });
    drawFolders();
  }
  bar.addEventListener('drop', function (e) { if (dragFid) { e.preventDefault(); endFolderDrag(true); } });
  bar.addEventListener('dragend', function () { endFolderDrag(true); });
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
    if (e.target.closest('[data-bulk-new]')) return window.Bulk && Bulk.open();
    if (e.target.closest('[data-more]')) return showMore();
    var szb = e.target.closest('.mc-card [data-size]'); if (szb) { e.stopPropagation(); return setSize(+szb.getAttribute('data-size')); }
    var lb = e.target.closest('.mc-tag[data-label]');
    if (lb) { var lv = lb.getAttribute('data-label'); filter.label = filter.label && filter.label.toLowerCase() === lv.toLowerCase() ? '' : lv; drawTools(); return draw(); }
    var b = e.target.closest('[data-act]');
    if (!b) { if (!e.target.closest('.mc-menu')) closeMenus(); return; }
    var act = b.getAttribute('data-act');
    if (act === 'dl') { var rr = find(b.closest('[data-id]').getAttribute('data-id')); closeMenus(); return download(rr, b.getAttribute('data-fmt'), dlSize).catch(function () { toast('myCodes.failed'); }); }
    if (act === 'clear') { filter.q = ''; filter.type = ''; filter.label = ''; drawTools(); return draw(); }
    var el = b.closest('[data-id]'), r = el && find(el.getAttribute('data-id')); if (!r) return;
    if (act === 'dlmenu' || act === 'more') {
      var m = b.nextElementSibling, open = m.hidden; closeMenus(m); m.hidden = !open; b.setAttribute('aria-expanded', String(open));
      if (open) { var first = m.querySelector('button'); if (first) first.focus(); }
      return;
    }
    closeMenus();
    if (act === 'copy') return copy(r.shortUrl);
    if (act === 'print') { closeMenus(); return CodeUtil.print(r).catch(function () { toast('myCodes.failed'); }); }
    if (act === 'share') { closeMenus(); return CodeUtil.share(r).then(function (done) { if (!done) { download(r, 'png', dlSize); toast('myCodes.shareFallback'); } }).catch(function () { toast('myCodes.failed'); }); }
    if (act === 'copydest') return copy(destVal(r) || r.shortUrl);
    if (act === 'recheck') { var hb = e.target.closest('[data-act]'); if (hb) hb.disabled = true; return api.codeHealthNow(r.id).then(function (h) { if (h && h.state !== 'none') health[r.id] = h; else delete health[r.id]; draw(); toast(h && h.state === 'ok' ? 'myCodes.hlNowOk' : 'myCodes.hlNowBad'); }).catch(function () { draw(); }); }
    if (act === 'open') return window.open(r.shortUrl, '_blank', 'noopener');
    if (act === 'history') { closeMenus(); return askHistory(r); }
    if (act === 'edit') return edit(r);
    if (act === 'stats') return Analytics.open({ codes: [r.id] });
    if (act === 'where') return Analytics.open({ codes: [r.id], detail: true });   // klik op scans: detailpagina van deze code
    if (act === 'toggle') return toggle(r);
    if (act === 'support') return goToPage('contact');
    if (act === 'delete') return askDelete(r);
    if (act === 'rename') { renaming = r.id; return draw(); }
    if (act === 'move') return askMove(r);
    if (act === 'moveout') return move([r.id], null);
    if (act === 'legacy') return askLegacy(r);
    if (act === 'fav') return favorite(r);
    if (act === 'duplicate') return duplicate(r);
    if (act === 'labels') return askLabels(r);
    if (act === 'sheet') return askSheet([r]);
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
    if (e.target.id === 'mcLabel') { filter.label = e.target.value; draw(); }
    if (e.target.id === 'mcSort') { filter.sort = e.target.value; draw(); }
  });
  document.addEventListener('click', function (e) { if (!view.hidden && !e.target.closest('.mc-drop')) closeMenus(); });

  function label() {
    view.querySelector('.mc-head [data-mc-new]').innerHTML = ico('plus') + t('myCodes.new');
    var bk = view.querySelector('.mc-head [data-bulk-new]'); if (bk) { var pi = window.PlanGate && PlanGate.info(), su = window.Session && Session.user(), locked = pi && pi.plan && !pi.plan.bulk && !(su && su.admin); bk.innerHTML = (locked ? PlanGate.lock : ico('copy')) + '<span>' + t('bulk.button') + '</span>'; bk.classList.toggle('is-locked', !!locked); }
    var ib = view.querySelector('.mc-head [data-import]'); if (ib) { ib.innerHTML = ico('qr') + '<span>' + t('imp.button') + '</span>'; ib.hidden = !isTeam(); }
  }
  label();
  document.addEventListener('pagechange', function (e) { if (e.detail === 'myCodes') { renaming = null; picked = {}; load(); } else if (e.detail !== 'create') newIn = null; });
  i18n.onChange(function () { label(); if (!view.hidden) { drawTools(); draw(); } });
  /** Nieuwe code gemaakt vanuit een map: die map (één keer) */
  document.addEventListener('plan-info', function () { label(); if (loaded) draw(); });
  document.addEventListener('plan-changed', function () { if (loaded) load(); });   // QR-code erbij gekocht: een gepauzeerde code kan weer aan
  function folderForNew() { var f = newIn; newIn = null; return f; }
  /** Vanaf het Overzicht: meteen een map (of 'fav') openen */
  function showFolder(key) { filter.folder = key; if (loaded) draw(); }
  return { reload: load, rows: function () { return rows; }, displayName: displayName, folderForNew: folderForNew, showFolder: showFolder, edit: edit, labelsOf: askLabels, history: askHistory };
})();
