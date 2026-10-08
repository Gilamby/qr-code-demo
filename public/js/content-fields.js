/* =========================================================
   EXTRA INVULVELDEN voor stap Inhoud
   - FileUpload    : één bestand (PDF of audio). Bewaart naam + grootte als JSON {"n","s"}.
   - GalleryUpload : meerdere foto's (max. 6), automatisch verkleind. Bewaart een JSON-lijst met afbeeldingen.
   - DishesEditor  : gerechten met prijs, rij voor rij. Bewaart een JSON-lijst [{n, p}].
   Allemaal in dezelfde stijl als de andere velden; de telefoon past zich direct aan.
   ========================================================= */
var FILES = {
  parse: function (v) { try { var o = JSON.parse(v); return o && o.n ? o : null; } catch (e) { return null; } },
  size: function (b) { b = +b || 0; return b >= 1048576 ? i18n.fmt.num(Math.round(b / 104857.6) / 10) + ' MB' : i18n.fmt.num(Math.max(1, Math.round(b / 1024))) + ' KB'; },
  list: function (v) { try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
};

var FileUpload = (function () {
  var IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 17v-6M9 14l3-3 3 3"/></svg>';
  function inner(f, o) {
    return '<span class="up-thumb fu-thumb">' + IC + '</span>' +
      '<span class="up-text"><b>' + (o ? esc(o.n) : t('upload.file')) + '</b><small>' + (o ? FILES.size(o.s) : t(f.accept === 'application/pdf' ? 'upload.pdfHint' : 'upload.audioHint')) + '</small></span>';
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
      function take(file) {
        var ok = file && (accept === 'application/pdf' ? file.type === 'application/pdf' || /\.pdf$/i.test(file.name) : /^audio\//.test(file.type) || /\.(mp3|m4a|wav|ogg)$/i.test(file.name));
        if (!ok) { box.querySelector('small').textContent = t('upload.fileError'); return; }
        if (file.size > 10 * 1048576) { box.querySelector('small').textContent = t('upload.tooBig', { n: 10 }); return; }
        // Het bestand zelf gaat mee (als data-URL), zodat de bezoeker het echt kan openen en downloaden
        var rd = new FileReader();
        rd.onload = function () { set({ n: file.name.slice(0, 120), s: file.size, d: String(rd.result).replace(/^data:[^;]*;/, 'data:' + (accept === 'application/pdf' ? 'application/pdf' : (/^audio\//.test(file.type) ? file.type : 'audio/mpeg')) + ';') }); };
        rd.onerror = function () { box.querySelector('small').textContent = t('upload.fileError'); };
        rd.readAsDataURL(file);
      }
      box.addEventListener('click', function (e) { if (e.target.closest('.up-remove')) { e.stopPropagation(); input.value = ''; return set(null); } if (e.target !== input) input.click(); });
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
  var MAX = 6, SIZE = 800;
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, SIZE / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        var cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height);   // doorzichtig wordt wit, niet zwart
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); resolve(cv.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }
  function tiles(list) {
    return list.map(function (src, i) { return '<span class="ga-tile" style="background-image:url(' + src + ')"><button type="button" class="ga-x" data-ga-rm="' + i + '" aria-label="' + esc(t('upload.remove')) + '">×</button></span>'; }).join('') +
      (list.length < MAX ? '<button type="button" class="ga-add" data-ga-add><b>+</b><small>' + t('upload.photos') + '</small></button>' : '');
  }
  function html(f, id, value) {
    var list = FILES.list(value);
    return '<div class="ga" data-gallery="' + f.key + '"><div class="ga-grid">' + tiles(list) + '</div>' +
      '<small class="ga-hint">' + t('upload.photosHint', { n: MAX }) + '</small><input id="' + id + '" type="file" accept="image/jpeg,image/png,image/webp" multiple class="up-file"></div>';
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-gallery]').forEach(function (box) {
      var key = box.getAttribute('data-gallery'), input = box.querySelector('.up-file'), grid = box.querySelector('.ga-grid');
      var list = FILES.list((store.get().content[store.get().typeId] || {})[key]);
      function save() { grid.innerHTML = tiles(list); onChange(key, list.length ? JSON.stringify(list) : ''); }
      function take(files) {
        var todo = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); }).slice(0, MAX - list.length);
        Promise.all(todo.map(function (f) { return shrink(f).catch(function () { return null; }); })).then(function (srcs) { list = list.concat(srcs.filter(Boolean)).slice(0, MAX); save(); });
      }
      box.addEventListener('click', function (e) {
        var rm = e.target.closest('[data-ga-rm]');
        if (rm) { list.splice(+rm.getAttribute('data-ga-rm'), 1); save(); return; }
        if (e.target.closest('[data-ga-add]')) input.click();
      });
      input.addEventListener('change', function (e) { e.stopPropagation(); take(input.files); input.value = ''; });
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
