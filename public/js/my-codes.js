/* =========================================================
   MIJN QR-CODES
   Lijst met al je codes: zoeken, filteren, sorteren.
   Per code: downloaden, link kopiëren, bewerken, naam wijzigen, aan/uit, verwijderen.
   Zonder server (online demo) staan de codes in deze browser (zie api.js).
   ========================================================= */
var MyCodes = (function () {
  var IC = {
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
    empty: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/>'
  };
  function ico(k) { return '<svg class="mc-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>'; }

  var view = document.getElementById('myCodesView'), list = document.getElementById('codesList'), tools = document.getElementById('mcTools');
  var dialog = document.getElementById('mcDialog'), toastEl = document.getElementById('mcToast');
  var rows = [], loaded = false, filter = { q: '', type: '', sort: 'new' }, renaming = null, toastTimer = null;

  // Vaste codes (wifi, vCard) hebben geen link: de inhoud zit in de code zelf. Die tellen geen scans en kunnen niet uit.
  function isStatic(r) { var tp = getType(r.typeId); return tp && (tp.contentType === 'wifi' || tp.contentType === 'contact'); }
  function domainOf(u) { return String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]; }
  // Naam: zelf gekozen, anders iets herkenbaars uit de inhoud, anders het type
  function displayName(r) {
    if (r.name) return r.name;
    var c = r.content || {};
    var v = c.title || c.name || c.pageName || c.restaurant || c.appName || c.company || c.ssid || (c.username ? '@' + c.username.replace(/^@/, '') : '') || domainOf(c.url) || '';
    if (!v && c.file) { try { v = JSON.parse(c.file).n; } catch (e) {} }
    return v || typeName(getType(r.typeId));
  }
  function qrData(r) { return encodeQR({ typeId: r.typeId, content: (function () { var o = {}; o[r.typeId] = r.content || {}; return o; })(), saved: isStatic(r) ? null : r, draftId: r.id }); }
  function qrDesign(r) { var d = Object.assign({}, QR_DEFAULT_DESIGN, r.design); delete d.pageColor; delete d.accentColor; return safeDesign(d); }

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
  function visible() {
    var q = filter.q.trim().toLowerCase();
    var out = rows.filter(function (r) {
      if (filter.type && r.typeId !== filter.type) return false;
      if (!q) return true;
      return (displayName(r) + ' ' + typeName(getType(r.typeId)) + ' ' + r.id + ' ' + (r.shortUrl || '')).toLowerCase().indexOf(q) >= 0;
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
    return '<article class="mc-card glass' + (off ? ' off' : '') + '" data-id="' + esc(r.id) + '">' +
      '<div class="mc-qr" aria-hidden="true">' + QRRender.svg(qrData(r), qrDesign(r)) + '</div>' +
      '<div class="mc-main">' + nameHtml +
        '<div class="mc-meta"><span class="mc-type"><i>' + svg(tp.icon, 1.8) + '</i>' + esc(typeName(tp)) + '</span><span class="mc-dot">·</span><span>' + esc(t('myCodes.made', { date: i18n.fmt.date(new Date(r.createdAt), 'short') })) + '</span></div>' +
        '<div class="mc-link">' + link + '</div></div>' +
      (stat ? '<div class="mc-scans"><b>–</b><small>' + t('myCodes.noScans') + '</small></div>'
        : '<button type="button" class="mc-scans" data-act="stats" title="' + esc(t('myCodes.viewStats')) + '"><b>' + i18n.fmt.num(r.scans || 0) + '</b><small>' + t('myCodes.scans') + '</small></button>') +
      '<div class="mc-state">' + (stat ? '<span class="mc-pill on">' + t('myCodes.always') + '</span>'
        : '<button type="button" class="mc-switch" role="switch" aria-checked="' + !off + '" data-act="toggle"><span class="sw"></span><span>' + t(off ? 'myCodes.offLabel' : 'myCodes.onLabel') + '</span></button>') + '</div>' +
      '<div class="mc-acts">' +
        '<div class="mc-drop"><button type="button" class="btn ghost sm" data-act="dlmenu" aria-haspopup="true" aria-expanded="false">' + ico('dl') + '<span>' + t('myCodes.download') + '</span></button>' +
          '<div class="mc-menu" role="menu" hidden><button type="button" role="menuitem" data-act="png">PNG<small>' + t('myCodes.pngHint') + '</small></button><button type="button" role="menuitem" data-act="svg">SVG<small>' + t('myCodes.svgHint') + '</small></button></div></div>' +
        '<button type="button" class="btn ghost sm" data-act="edit">' + ico('edit') + '<span>' + t('myCodes.edit') + '</span></button>' +
        '<div class="mc-drop"><button type="button" class="mc-ico big" data-act="more" aria-haspopup="true" aria-expanded="false" aria-label="' + esc(t('myCodes.more')) + '" title="' + esc(t('myCodes.more')) + '">' + ico('more') + '</button>' +
          '<div class="mc-menu right" role="menu" hidden>' +
            (stat ? '' : (api.isDemo() ? '' : '<button type="button" role="menuitem" data-act="open">' + ico('open') + t('myCodes.open') + '</button>') + '<button type="button" role="menuitem" data-act="copy">' + ico('copy') + t('myCodes.copy') + '</button>') +
            '<button type="button" role="menuitem" data-act="rename">' + ico('pen') + t('myCodes.rename') + '</button>' +
            '<button type="button" role="menuitem" class="danger" data-act="delete">' + ico('trash') + t('myCodes.delete') + '</button></div></div>' +
      '</div></article>';
  }
  function draw() {
    document.getElementById('mcCount').textContent = loaded ? t(rows.length === 1 ? 'myCodes.countOne' : 'myCodes.count', { n: i18n.fmt.num(rows.length) }) : '';
    var demo = document.getElementById('mcDemo'); demo.hidden = !api.isDemo(); demo.textContent = t('myCodes.demoNote');
    if (!rows.length) {
      list.innerHTML = '<div class="mc-empty glass">' + ico('empty') + '<h3>' + t('myCodes.emptyTitle') + '</h3><p>' + t('myCodes.emptyText') + '</p>' +
        '<button type="button" class="btn primary" data-mc-new>' + ico('plus') + t('myCodes.first') + '</button></div>';
      return;
    }
    var vis = visible();
    list.innerHTML = vis.length ? vis.map(card).join('')
      : '<div class="mc-empty small glass"><h3>' + t('myCodes.noneFound') + '</h3><button type="button" class="btn ghost" data-act="clear">' + t('myCodes.clear') + '</button></div>';
    if (renaming) { var inp = list.querySelector('[data-rename]'); if (inp) { inp.focus(); inp.select(); } }
  }
  function message(key) { list.innerHTML = '<p class="muted-msg">' + t(key) + '</p>'; }
  function load() {
    if (!loaded) message('myCodes.loading');
    return api.listQrCodes().then(function (r) { rows = r || []; loaded = true; drawTools(); draw(); })
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
  function fileName(r) { return 'qr-' + (displayName(r).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || r.typeId); }
  function download(r, format) {
    var markup = QRRender.svg(qrData(r), qrDesign(r), { width: 1024 }), name = fileName(r);
    if (format === 'svg') return saveBlob(new Blob([markup], { type: 'image/svg+xml' }), name + '.svg');
    var img = new Image(), url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      var cx = cv.getContext('2d'); if (!(r.design || {}).transparent) { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height); }
      cx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      cv.toBlob(function (b) { saveBlob(b, name + '.png'); }, 'image/png');
    };
    img.src = url;
  }
  function saveBlob(blob, filename) { saveFile(blob, filename); }
  function rename(id, value) {
    var r = find(id); renaming = null;
    value = String(value || '').replace(/\s+/g, ' ').trim();
    if (!r || value === (r.name || displayName(r))) return draw();
    api.patchQrCode(id, { name: value }).then(function (rec) { replace(rec); draw(); toast('myCodes.renamed'); }).catch(function () { draw(); toast('myCodes.failed'); });
  }
  function toggle(r) {
    var next = !r.paused;
    r.paused = next; draw();                                   // meteen zichtbaar; terugzetten als het mislukt
    api.patchQrCode(r.id, { paused: next }).then(function (rec) { replace(rec); draw(); toast(next ? 'myCodes.pausedToast' : 'myCodes.activeToast'); })
      .catch(function () { r.paused = !next; draw(); toast('myCodes.failed'); });
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
  function startNew() { actions.startNew(); goToPage('create'); }

  view.addEventListener('click', function (e) {
    if (e.target.closest('[data-mc-new]')) return startNew();
    var b = e.target.closest('[data-act]');
    if (!b) { if (!e.target.closest('.mc-menu')) closeMenus(); return; }
    var act = b.getAttribute('data-act');
    if (act === 'clear') { filter.q = ''; filter.type = ''; drawTools(); return draw(); }
    var el = b.closest('[data-id]'), r = el && find(el.getAttribute('data-id')); if (!r) return;
    if (act === 'dlmenu' || act === 'more') {
      var m = b.nextElementSibling, open = m.hidden; closeMenus(m); m.hidden = !open; b.setAttribute('aria-expanded', String(open));
      if (open) { var first = m.querySelector('button'); if (first) first.focus(); }
      return;
    }
    closeMenus();
    if (act === 'png' || act === 'svg') return download(r, act);
    if (act === 'copy') return copy(r.shortUrl);
    if (act === 'open') return window.open(r.shortUrl, '_blank', 'noopener');
    if (act === 'edit') return edit(r);
    if (act === 'stats') return Analytics.open({ codes: [r.id] });
    if (act === 'toggle') return toggle(r);
    if (act === 'delete') return askDelete(r);
    if (act === 'rename') { renaming = r.id; return draw(); }
  });
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
  document.addEventListener('pagechange', function (e) { if (e.detail === 'myCodes') { renaming = null; load(); } });
  i18n.onChange(function () { label(); if (!view.hidden) { drawTools(); draw(); } });
  return { reload: load, displayName: displayName };
})();
