/* =========================================================
   EXTRA INVULVELDEN voor stap Inhoud
   - FileUpload    : één bestand (PDF of audio). Bewaart naam + grootte als JSON {"n","s"}.
   - GalleryUpload : veel foto's (max. in qr-types.js), verkleind in de browser en los geüpload. Bewaart [{ f, w, h }].
   - DishesEditor  : gerechten met prijs, rij voor rij. Bewaart een JSON-lijst [{n, p}].
   Allemaal in dezelfde stijl als de andere velden; de telefoon past zich direct aan.
   ========================================================= */
var FILES = {
  parse: function (v) { try { var o = JSON.parse(v); return o && o.n ? o : null; } catch (e) { return null; } },
  size: function (b) { b = +b || 0; return b >= 1048576 ? i18n.fmt.num(Math.round(b / 104857.6) / 10) + ' MB' : i18n.fmt.num(Math.max(1, Math.round(b / 1024))) + ' KB'; },
  list: function (v) { try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
  // Gekozen bestanden in deze browser (voor de preview, bv. een video die net is geüpload): veldnaam of bestand-id -> object-URL
  local: {},
  // Foto's van een galerij -> [{ src, w, h }]. Een foto is: een data-URL (oud/demo), { u } (echte pagina) of { f } (geüpload bestand)
  photos: function (v) {
    return FILES.list(v).map(function (x) {
      if (typeof x === 'string') return { src: x };
      if (!x) return null;
      return { src: x.u || FILES.local[x.f] || (x.f ? 'api/uploads/' + x.f : ''), w: x.w, h: x.h };
    }).filter(function (p) { return p && p.src; });
  }
};

var FileUpload = (function () {
  var IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 17v-6M9 14l3-3 3 3"/></svg>';
  function inner(f, o) {
    return '<span class="up-thumb fu-thumb">' + IC + '</span>' +
      '<span class="up-text"><b>' + (o ? esc(o.n) : t('upload.file')) + '</b><small>' + (o ? FILES.size(o.s) : t(f.accept === 'application/pdf' ? 'upload.pdfHint' : /^video/.test(f.accept || '') ? 'upload.videoHint' : /image\//.test(f.accept || '') ? 'upload.menuHint' : 'upload.audioHint')) + '</small></span>' +
      (/^video/.test(f.accept || '') ? '<span class="fu-bar" hidden><i></i></span>' : '');
  }
  function html(f, id, value) {
    var o = FILES.parse(value);
    return '<div class="up fu' + (o ? ' has' : '') + '" data-file="' + f.key + '" data-accept="' + esc(f.accept || '') + '">' + '<span class="fu-in">' + inner(f, o) + '</span>' +
      '<button type="button" class="up-remove">' + t('upload.remove') + '</button>' +
      '<input id="' + id + '" type="file" accept="' + esc(f.accept || '') + '" class="up-file"></div>';
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-file]').forEach(function (box) {
      var key = box.getAttribute('data-file'), input = box.querySelector('.up-file'), accept = box.getAttribute('data-accept');
      var f = { accept: accept };
      function set(o) { box.classList.toggle('has', !!o); box.querySelector('.fu-in').innerHTML = inner(f, o); onChange(key, o ? JSON.stringify(o) : ''); }
      function takeVideo(file) {
        // Video: meteen uploaden (kan groot zijn), met een voortgangsbalk; de preview speelt het bestand uit deze browser
        var small = box.querySelector('small'), bar = box.querySelector('.fu-bar'), MAX = 100;
        if (!(/^video\//.test(file.type) || /\.(mp4|mov|m4v|webm)$/i.test(file.name))) { small.textContent = t('upload.fileError'); return; }
        if (file.size > MAX * 1048576) { small.textContent = t('upload.tooBig', { n: MAX }); return; }
        box.classList.add('busy'); box.querySelector('b').textContent = file.name; small.textContent = t('upload.uploading', { p: 0 });
        if (bar) { bar.hidden = false; bar.firstChild.style.width = '0%'; }
        api.uploadVideo(file, function (p) { small.textContent = t('upload.uploading', { p: p }); if (bar) bar.firstChild.style.width = p + '%'; }).then(function (o) {
          box.classList.remove('busy');
          if (FILES.local[key]) URL.revokeObjectURL(FILES.local[key]);
          FILES.local[key] = URL.createObjectURL(file);
          set({ n: o.n, s: o.s, f: o.f, local: o.local || undefined });
        }).catch(function (e) {
          box.classList.remove('busy'); if (bar) bar.hidden = true;
          small.textContent = e && e.code === 'too_big' ? t('upload.tooBig', { n: e.maxMb || MAX }) : t('upload.videoError');
        });
      }
      function take(file) {
        if (file && /^video/.test(accept)) return takeVideo(file);
        // Welk soort bestand? Uit accept ("application/pdf,image/jpeg", "audio/*"); PDF en mp3 ook herkennen aan de naam
        var mime = file && (file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : /\.(mp3|m4a|wav|ogg)$/i.test(file.name) ? 'audio/mpeg' : ''));
        var ok = mime && accept.split(',').some(function (a) { a = a.trim(); return a === mime || (/\/\*$/.test(a) && mime.indexOf(a.slice(0, -1)) === 0); });
        if (!ok) { box.querySelector('small').textContent = t('upload.fileError'); return; }
        if (file.size > 10 * 1048576) { box.querySelector('small').textContent = t('upload.tooBig', { n: 10 }); return; }
        // Het bestand zelf gaat mee (als data-URL), zodat de bezoeker het echt kan openen en downloaden
        var rd = new FileReader();
        rd.onload = function () { set({ n: file.name.slice(0, 120), s: file.size, d: String(rd.result).replace(/^data:[^;]*;/, 'data:' + mime + ';') }); };
        rd.onerror = function () { box.querySelector('small').textContent = t('upload.fileError'); };
        rd.readAsDataURL(file);
      }
      box.addEventListener('click', function (e) { if (box.classList.contains('busy')) return; if (e.target.closest('.up-remove')) { e.stopPropagation(); input.value = ''; if (FILES.local[key]) { URL.revokeObjectURL(FILES.local[key]); delete FILES.local[key]; } return set(null); } if (e.target !== input) input.click(); });
      input.addEventListener('click', function (e) { e.stopPropagation(); });
      input.addEventListener('change', function (e) { e.stopPropagation(); take(input.files[0]); });
      box.addEventListener('dragover', function (e) { e.preventDefault(); box.classList.add('drag'); });
      box.addEventListener('dragleave', function () { box.classList.remove('drag'); });
      box.addEventListener('drop', function (e) { e.preventDefault(); box.classList.remove('drag'); take(e.dataTransfer.files[0]); });
    });
  }
  return { html: html, mount: mount };
})();

var GalleryUpload = (function () {
  // Verkleind tot max. 1600 px (scherp genoeg voor de fotoviewer, ~250 kB). Elke foto gaat meteen los naar de server;
  // in de inhoud staat alleen { f, w, h }. Zonder server (demo) blijft het een kleine data-URL.
  var SIZE = 1600, BUSY = 3;
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, SIZE / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        var cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height);   // doorzichtig wordt wit, niet zwart
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (blob) { blob ? resolve({ blob: blob, w: cv.width, h: cv.height, canvas: cv }) : reject(); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }
  // Eén foto: verkleinen en uploaden -> item voor de lijst
  function prepare(file) {
    return shrink(file).then(function (r) {
      return api.uploadImage(r.blob, file.name).then(function (o) {
        if (!o) { var c = r.canvas, k = Math.min(1, 800 / Math.max(c.width, c.height)), d = document.createElement('canvas');   // demo: kleine data-URL
          d.width = Math.round(c.width * k); d.height = Math.round(c.height * k); d.getContext('2d').drawImage(c, 0, 0, d.width, d.height); return d.toDataURL('image/jpeg', 0.8); }
        FILES.local[o.f] = URL.createObjectURL(r.blob);
        return { f: o.f, w: r.w, h: r.h };
      });
    });
  }
  function src(x) { var p = FILES.photos(JSON.stringify([x]))[0]; return p ? p.src : ''; }
  function tiles(list, max, busy) {
    return list.map(function (x, i) {
      return '<span class="ga-tile" style="background-image:url(' + src(x) + ')">' +
        '<button type="button" class="ga-swap" data-ga-swap="' + i + '" aria-label="' + esc(t('upload.photoReplace', { n: i + 1 })) + '" title="' + esc(t('upload.photoReplace', { n: i + 1 })) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg></button>' +
        '<button type="button" class="ga-x" data-ga-rm="' + i + '" aria-label="' + esc(t('upload.photoRemove', { n: i + 1 })) + '">×</button></span>';
    }).join('') +
      new Array(busy + 1).join('<span class="ga-tile ga-busy" aria-hidden="true"><i></i></span>') +
      (list.length + busy < max ? '<button type="button" class="ga-add" data-ga-add><b>+</b><small>' + t('upload.photos') + '</small></button>' : '');
  }
  function count(list, max) { return t('upload.photosCount', { n: list.length, max: max, left: Math.max(0, max - list.length) }); }
  function html(f, id, value) {
    var list = FILES.list(value), max = f.max || 6;
    return '<div class="ga" data-gallery="' + f.key + '" data-max="' + max + '"><div class="ga-grid">' + tiles(list, max, 0) + '</div>' +
      '<small class="ga-hint" aria-live="polite">' + count(list, max) + '</small><small class="ga-err" role="alert" hidden></small>' +
      '<input id="' + id + '" type="file" accept="image/jpeg,image/png,image/webp" multiple class="up-file"><input type="file" accept="image/jpeg,image/png,image/webp" class="up-file ga-one" tabindex="-1" aria-hidden="true"></div>';
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-gallery]').forEach(function (box) {
      var key = box.getAttribute('data-gallery'), max = +box.getAttribute('data-max') || 6, input = box.querySelector('.up-file:not(.ga-one)'), one = box.querySelector('.ga-one');
      var grid = box.querySelector('.ga-grid'), hint = box.querySelector('.ga-hint'), err = box.querySelector('.ga-err');
      var list = FILES.list((store.get().content[store.get().typeId] || {})[key]), busy = 0, swapAt = -1, failed = 0;
      function draw() { grid.innerHTML = tiles(list, max, busy); hint.textContent = count(list, max) + (busy ? ' · ' + t('upload.photosBusy', { n: busy }) : ''); }
      function save() { draw(); onChange(key, list.length ? JSON.stringify(list) : ''); }
      function oops() { failed++; err.textContent = t('upload.photoError', { n: failed }); err.hidden = false; }
      function take(files) {
        var all = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\/(jpeg|png|webp)$/.test(f.type); });
        var todo = all.slice(0, Math.max(0, max - list.length - busy));
        failed = 0; err.hidden = true;
        if (all.length > todo.length) { err.textContent = t('upload.photosTooMany', { max: max }); err.hidden = false; }
        busy += todo.length; draw();
        var queue = todo.slice(), running = 0;
        function next() {
          if (!queue.length) return;
          var file = queue.shift(); running++;
          prepare(file).then(function (item) { list.push(item); }, oops).then(function () { busy--; running--; save(); next(); });
        }
        for (var i = 0; i < BUSY; i++) next();
      }
      function swap(file) {
        if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type) || swapAt < 0) return;
        var at = swapAt; swapAt = -1; err.hidden = true;
        var tile = grid.querySelectorAll('.ga-tile')[at]; if (tile) tile.classList.add('ga-busy');
        prepare(file).then(function (item) { list[at] = item; save(); }, function () { failed = 0; oops(); draw(); });
      }
      box.addEventListener('click', function (e) {
        var rm = e.target.closest('[data-ga-rm]'), sw = e.target.closest('[data-ga-swap]');
        if (rm) { list.splice(+rm.getAttribute('data-ga-rm'), 1); err.hidden = true; save(); return; }
        if (sw) { swapAt = +sw.getAttribute('data-ga-swap'); one.click(); return; }
        if (e.target.closest('[data-ga-add]')) input.click();
      });
      input.addEventListener('change', function (e) { e.stopPropagation(); take(input.files); input.value = ''; });
      one.addEventListener('change', function (e) { e.stopPropagation(); swap(one.files[0]); one.value = ''; });
      box.addEventListener('dragover', function (e) { e.preventDefault(); box.classList.add('drag'); });
      box.addEventListener('dragleave', function () { box.classList.remove('drag'); });
      box.addEventListener('drop', function (e) { e.preventDefault(); box.classList.remove('drag'); take(e.dataTransfer.files); });
    });
  }
  return { html: html, mount: mount };
})();

var DishesEditor = (function () {
  var MAX = 30;
  function rows(list) {
    return list.map(function (d, i) {
      return '<div class="ds-row"><input data-ds="n" data-i="' + i + '" value="' + esc(d.n || '') + '" placeholder="' + esc(t('dish.name')) + '" maxlength="60">' +
        '<span class="ds-price"><em>€</em><input data-ds="p" data-i="' + i + '" value="' + esc(d.p || '') + '" placeholder="0,00" inputmode="decimal" maxlength="8"></span>' +
        '<button type="button" class="hr-x" data-ds-rm="' + i + '" aria-label="' + esc(t('dish.remove')) + '">×</button></div>';
    }).join('');
  }
  function html(f, id, value) {
    var list = FILES.list(value); if (!list.length) list = [{ n: '', p: '' }];
    return '<div class="ds" data-dishes="' + f.key + '" id="' + id + '"><div class="ds-list">' + rows(list) + '</div>' +
      '<button type="button" class="pw-act ds-add" data-ds-add>+ ' + t('dish.add') + '</button></div>';
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-dishes]').forEach(function (box) {
      var key = box.getAttribute('data-dishes'), listEl = box.querySelector('.ds-list');
      var list = FILES.list((store.get().content[store.get().typeId] || {})[key]); if (!list.length) list = [{ n: '', p: '' }];
      function save(redraw) {
        if (redraw) listEl.innerHTML = rows(list);
        var clean = list.filter(function (d) { return d.n && d.n.trim(); });
        onChange(key, clean.length ? JSON.stringify(clean) : '');
      }
      box.addEventListener('click', function (e) {
        if (e.target.closest('[data-ds-add]') && list.length < MAX) { list.push({ n: '', p: '' }); save(true); var ins = listEl.querySelectorAll('[data-ds="n"]'); ins[ins.length - 1].focus(); }
        var rm = e.target.closest('[data-ds-rm]');
        if (rm) { list.splice(+rm.getAttribute('data-ds-rm'), 1); if (!list.length) list.push({ n: '', p: '' }); save(true); }
      });
      box.addEventListener('input', function (e) {
        var k = e.target.getAttribute('data-ds'); if (!k) return; e.stopPropagation();
        var v = e.target.value; if (k === 'p') { v = v.replace(/[^0-9.,]/g, ''); e.target.value = v; }
        list[+e.target.getAttribute('data-i')][k] = v; save(false);
      });
    });
  }
  return { html: html, mount: mount };
})();

/* =========================================================
   TELEFOONNUMMER: land kiezen + alleen cijfers
   Bewaart "+31 612 345 678" (kengetal, spatie, nummer in groepjes van 3).
   De eerste 0 (bv. 06…) valt weg, behalve in Italië.
   ========================================================= */
var TEL = (function () {
  // [land, kengetal, min. cijfers, max. cijfers]
  var C = [['NL',31,9,9],['BE',32,8,9],['DE',49,6,13],['FR',33,9,9],['ES',34,9,9],['IT',39,6,11],['PT',351,9,9],['GB',44,9,10],['IE',353,7,9],['LU',352,6,11],
    ['AT',43,6,13],['CH',41,9,9],['DK',45,8,8],['SE',46,7,10],['NO',47,8,8],['FI',358,6,12],['IS',354,7,7],['PL',48,9,9],['CZ',420,9,9],['SK',421,9,9],['HU',36,8,9],
    ['RO',40,9,9],['BG',359,8,9],['GR',30,10,10],['CY',357,8,8],['MT',356,8,8],['HR',385,8,9],['SI',386,8,8],['RS',381,8,9],['BA',387,8,8],['ME',382,8,8],['MK',389,8,8],
    ['AL',355,8,9],['XK',383,8,8],['LT',370,8,8],['LV',371,8,8],['EE',372,7,8],['UA',380,9,9],['TR',90,10,10],['MA',212,9,9],['EG',20,10,10],['ZA',27,9,9],['NG',234,10,10],
    ['AE',971,8,9],['SA',966,9,9],['IN',91,10,10],['CN',86,11,11],['JP',81,10,10],['ID',62,9,12],['AU',61,9,9],['US',1,10,10],['CA',1,10,10],['MX',52,10,10],['BR',55,10,11],
    ['SR',597,7,7],['CW',599,7,8]];
  var BY_LANG = { nl: 'NL', en: 'GB', de: 'DE', es: 'ES', fr: 'FR', it: 'IT', pl: 'PL', pt: 'PT', el: 'GR', sq: 'AL' };
  function get(iso) { return C.filter(function (c) { return c[0] === iso; })[0]; }
  function flag(iso) { return iso.replace(/./g, function (ch) { return String.fromCodePoint(127397 + ch.charCodeAt(0)); }); }
  // Landnaam in de gekozen taal. Kent de browser die taal niet (Albanees), dan uit het taalbestand ("countries").
  function name(iso) {
    var own = t('countries.' + iso); if (own !== 'countries.' + iso) return own;
    try { if (Intl.DisplayNames.supportedLocalesOf([i18n.lang()]).length) return new Intl.DisplayNames([i18n.lang()], { type: 'region' }).of(iso) || iso; } catch (e) {}
    return iso;
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function national(c, d) { d = digits(d); return c[0] === 'IT' ? d : d.replace(/^0+/, ''); }
  function group(d) { return d.replace(/(\d{3})(?=\d)/g, '$1 '); }
  // "+31 6 1234 5678" -> { c: NL, n: "612345678" }
  function parse(v) {
    v = String(v || '').trim(); if (!v) return { c: get(BY_LANG[i18n.lang()] || 'NL'), n: '' };
    var all = digits(v), best = null;
    if (/^\+|^00/.test(v)) { all = all.replace(/^00/, ''); C.forEach(function (c) { var p = String(c[1]); if (all.indexOf(p) === 0 && (!best || p.length > String(best[1]).length)) best = c; }); }
    if (best) return { c: best[0] === 'CA' ? get('US') : best, n: all.slice(String(best[1]).length) };
    return { c: get(BY_LANG[i18n.lang()] || 'NL'), n: all };
  }
  function value(c, n) { n = national(c, n); return n ? '+' + c[1] + ' ' + group(n) : ''; }
  function valid(v) { if (!v) return true; var p = parse(v), n = p.n; return /^\+/.test(v) && n.length >= p.c[2] && n.length <= p.c[3]; }
  return { C: C, get: get, flag: flag, name: name, parse: parse, value: value, valid: valid, digits: digits, national: national };
})();

var PhoneInput = (function () {
  function options(cur) {
    var list = TEL.C.slice().sort(function (a, b) { return TEL.name(a[0]).localeCompare(TEL.name(b[0]), i18n.lang()); });
    return list.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === cur[0] ? ' selected' : '') + '>' + TEL.flag(c[0]) + ' ' + esc(TEL.name(c[0])) + ' (+' + c[1] + ')</option>'; }).join('');
  }
  function html(f, id, value) {
    var p = TEL.parse(value), sample = TEL.parse(resolveSample(f.sample));
    return '<div class="tel" data-tel="' + f.key + '"><span class="tel-cc"><span class="tel-flag" aria-hidden="true">' + TEL.flag(p.c[0]) + ' +' + p.c[1] + '</span>' +
      '<select aria-label="' + esc(t('phone.country')) + '">' + options(p.c) + '</select></span>' +
      '<input id="' + id + '" type="tel" inputmode="numeric" autocomplete="tel-national" value="' + esc(p.n.replace(/(\d{3})(?=\d)/g, '$1 ')) + '" placeholder="' + esc(sample.n.replace(/(\d{3})(?=\d)/g, '$1 ')) + '"></div>' +
      '<small class="field-msg" data-tel-msg="' + f.key + '"></small>';
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-tel]').forEach(function (box) {
      var key = box.getAttribute('data-tel'), sel = box.querySelector('select'), inp = box.querySelector('input'), msg = root.querySelector('[data-tel-msg="' + key + '"]');
      var field = box.closest('.field');
      function c() { return TEL.get(sel.value); }
      function check(show) {
        var n = TEL.national(c(), inp.value), bad = n && (n.length < c()[2] || n.length > c()[3]);
        if (field) field.classList.toggle('bad', !!bad);
        if (show || !bad) { msg.textContent = bad ? t('phone.invalid', { n: c()[2] === c()[3] ? c()[2] : c()[2] + '–' + c()[3] }) : ''; msg.className = 'field-msg' + (bad ? ' warn' : ''); }
        return !bad;
      }
      function save() { onChange(key, TEL.value(c(), inp.value)); }
      inp.addEventListener('input', function (e) {
        e.stopPropagation();
        var pos = inp.selectionStart, before = inp.value.slice(0, pos).replace(/\D/g, '').length;
        var d = TEL.digits(inp.value).slice(0, 15);                       // alleen cijfers
        inp.value = d.replace(/(\d{3})(?=\d)/g, '$1 ');
        var i = 0, seen = 0; while (i < inp.value.length && seen < before) { if (/\d/.test(inp.value[i])) seen++; i++; } inp.setSelectionRange(i, i);
        check(false); save();
      });
      inp.addEventListener('blur', function () { check(true); });
      sel.addEventListener('change', function (e) { e.stopPropagation(); box.querySelector('.tel-flag').textContent = TEL.flag(sel.value) + ' +' + c()[1]; check(!!inp.value); save(); inp.focus(); });
    });
  }
  return { html: html, mount: mount };
})();

/* =========================================================
   E-MAIL: moet echt kloppen
   - vorm: naam@domein.nl
   - typfout in bekende domeinen? "Bedoel je …@gmail.com?" (klik = verbeteren)
   - met server: bestaat het domein en kan het mail ontvangen?
   ========================================================= */
var EmailCheck = (function () {
  var RE = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
  var KNOWN = ['gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com', 'icloud.com', 'me.com', 'hotmail.nl', 'live.nl', 'outlook.nl', 'ziggo.nl', 'kpnmail.nl', 'planet.nl', 'xs4all.nl', 'telenet.be', 'skynet.be',
    'gmx.de', 'web.de', 't-online.de', 'yahoo.fr', 'orange.fr', 'free.fr', 'libero.it', 'yahoo.es', 'wp.pl', 'onet.pl', 'sapo.pt', 'proton.me', 'protonmail.com'];
  function dist(a, b) {
    var m = [], i, j; for (i = 0; i <= b.length; i++) m[i] = [i];
    for (j = 0; j <= a.length; j++) m[0][j] = j;
    for (i = 1; i <= b.length; i++) for (j = 1; j <= a.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1));
    return m[b.length][a.length];
  }
  function suggest(v) {
    var at = v.lastIndexOf('@'); if (at < 1) return '';
    var d = v.slice(at + 1).toLowerCase(); if (KNOWN.indexOf(d) >= 0) return '';
    var best = '', bd = 3; KNOWN.forEach(function (k) { var x = dist(d, k); if (x < bd) { bd = x; best = k; } });
    return best ? v.slice(0, at + 1) + best : '';
  }
  var cache = {};
  function server(v) {
    if (cache[v] != null) return Promise.resolve(cache[v]);
    return api.available().then(function (on) {
      if (!on) return true;                                                // demo zonder server: alleen de vorm
      return fetch('api/email-check?e=' + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (d) { cache[v] = !!d.ok; return cache[v]; }).catch(function () { return true; });
    });
  }
  function mount(root, onChange) {
    root.querySelectorAll('input[type="email"]').forEach(function (inp) {
      var field = inp.closest('.field'), msg = field.querySelector('[data-email-msg]');
      if (!msg) { msg = document.createElement('small'); msg.className = 'field-msg'; msg.setAttribute('data-email-msg', ''); inp.insertAdjacentElement('afterend', msg); }
      var token = 0;
      function show(html, kind) { msg.innerHTML = html; msg.className = 'field-msg' + (kind ? ' ' + kind : ''); }
      function check(final) {
        var v = inp.value.trim(), my = ++token;
        if (!v) { field.classList.remove('bad'); show(''); return; }
        if (!RE.test(v)) { field.classList.add('bad'); if (final) show(esc(t('email.format')), 'warn'); return; }
        field.classList.remove('bad');
        var s = suggest(v);
        if (!final) { if (!s) show(''); return; }
        if (s) show(esc(t('email.didYouMean')) + ' <button type="button" class="link-btn" data-email-fix="' + esc(s) + '">' + esc(s) + '</button>', 'warn');
        server(v).then(function (ok) {
          if (my !== token) return;
          if (!ok) { field.classList.add('bad'); show(esc(t('email.domain')) + (s ? ' ' + esc(t('email.didYouMean')) + ' <button type="button" class="link-btn" data-email-fix="' + esc(s) + '">' + esc(s) + '</button>' : ''), 'warn'); }
          else if (!s) show('✓ ' + esc(t('email.ok')), 'ok');
        });
      }
      inp.addEventListener('input', function () { check(false); });
      inp.addEventListener('blur', function () { check(true); });
      msg.addEventListener('mousedown', function (e) { if (e.target.closest('[data-email-fix]')) e.preventDefault(); });   // klik verbetert, zonder eerst te 'blurren'
      msg.addEventListener('click', function (e) {
        var b = e.target.closest('[data-email-fix]'); if (!b) return;
        inp.value = b.getAttribute('data-email-fix'); onChange(inp.name, inp.value); check(true);
      });
      if (inp.value) check(true);
    });
  }
  return { mount: mount, valid: function (v) { return !v || RE.test(v); } };
})();
