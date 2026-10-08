/* =========================================================
   STAP 3 – ONTWERP
   Vijf glazen kaarten, in volgorde van belangrijkheid, die je in- en uitklapt:
   Stijlen · Logo · Patroon en kleuren · Frame · Hoeken.
   Elke keuze is meteen te zien op de telefoon; met de muis erover zie je het al vóór je klikt.
   ========================================================= */

function frameGroupOf(frame) { for (var g in FRAME_GROUPS) if (FRAME_GROUPS[g].indexOf(frame) >= 0) return g; return 'basic'; }
var DESIGN_SAMPLE = 'https://qr.example/scan';

function themeDesign(th, state) {
  if (th.brand) {                                       // eigen merk: donkerste paginakleur als code, de andere als hoeken
    var a = state.pageColor, b = state.accentColor, dark = luminance(a) < luminance(b) ? a : b, light = dark === a ? b : a;
    return Object.assign({}, QR_DEFAULT_DESIGN, { color: dark, pattern: 'rounded', cornerOuter: 'rounded', cornerInner: 'rounded', cornerColor: contrastRatio(light, '#ffffff') >= 3 ? light : dark,
      frame: 'label', frameColor: dark, frameText: t('dz.text.scan') });
  }
  var d = Object.assign({}, QR_DEFAULT_DESIGN, th.d);
  if (d.frameText) d.frameText = t(d.frameText);
  return d;
}
function themeById(id) { return DESIGN_THEMES.filter(function (x) { return x.id === id; })[0]; }

var DesignPanel = (function () {
  var colorOpen = null, frameGroup = null, themeGroup = 'business';

  // Elk onderdeel is een eigen glazen kaart die je in- en uitklapt. Stijlen en Logo staan open (belangrijkst).
  var openCards = { style: true, logo: true, colors: false, frame: false, corners: false };
  function card(id, title, body, domId) {
    var on = !!openCards[id];
    return '<section class="dz-card' + (on ? ' open' : '') + '" data-card="' + id + '"' + (domId ? ' id="' + domId + '"' : '') + '>' +
      '<button type="button" class="dz-card-head" data-card-toggle="' + id + '" aria-expanded="' + on + '"><span class="dz-card-title">' + title + '</span>' +
      '<i class="dz-chev" aria-hidden="true"></i></button>' +
      '<div class="dz-card-body">' + body + '</div></section>';
  }
  function tiles(key, list, render, cls) {
    return '<div class="dz-tiles ' + (cls || '') + '">' + list.map(function (v) {
      var name = t('dz.' + key + '.' + (v || 'none'));
      return '<button type="button" class="dz-tile" data-d="' + key + '" data-v="' + v + '" title="' + esc(name) + '" aria-label="' + esc(name) + '">' + render(v) + (key === 'decor' ? '<small>' + esc(name) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function colorRow(key, label, allowEmpty) {
    return '<div class="ap-row dz-color' + (colorOpen === key ? ' open' : '') + '" data-color="' + key + '"><button type="button" class="ap-head" data-color-open="' + key + '">' +
      '<span>' + label + '</span><span class="ap-val"><i></i><em></em></span></button>' +
      (allowEmpty ? '<button type="button" class="dz-same" data-same="' + key + '">' + t('dz.lbl.same') + '</button>' : '') +
      '<div class="ap-pick"></div></div>';
  }
  function build(state) {
    var type = getType(state.typeId), d = state.design;
    var sample = encodeQR(state);                       // de eigen, unieke code van de gebruiker
    var themeTile = function (th, reason) {
      return '<button type="button" class="dz-tile dz-theme" data-theme="' + th.id + '"><span class="dz-mini">' + QRRender.svg(sample, themeDesign(th, state), { fontScale: 1.25 }) + '</span><small>' + t('dz.theme.' + th.id) + '</small>' +
        (reason ? '<em class="dz-why">' + esc(t(reason.k, { v: reason.v || '' })) + '</em>' : '') + '</button>';
    };
    var recs = recommendThemes(state);

    var grp = frameGroup || frameGroupOf(d.frame);
    var sw = function (kind) { return function (v) { return QRRender.swatch(kind, v, { color: '#e8edf3' }); }; };

    // Stijlen: aanbevolen (Klassiek altijd eerst), daarna alle stijlen per groep (zakelijk eerst)
    var styles = 
      '<div class="dz-tiles quick" id="dzRecs">' + recs.map(function (r) { return themeTile(r.theme, r.reason); }).join('') + '</div>' +
      '<div class="dz-more"><div class="dz-cats" role="tablist">' + THEME_GROUPS.map(function (g) {
          return '<button type="button" role="tab" data-tgroup="' + g + '" aria-selected="' + (g === themeGroup) + '">' + t('dz.tgroup.' + g) + '</button>';
        }).join('') + '</div>' + THEME_GROUPS.map(function (g) {
          return '<div class="dz-tiles themes compact" data-tg="' + g + '"' + (g === themeGroup ? '' : ' hidden') + '>' + DESIGN_THEMES.filter(function (th) { return th.g === g; }).map(function (th) { return themeTile(th); }).join('') + '</div>';
        }).join('') + '</div>';

    // Logo
    var logo = 
      '<div class="dz-logo">' + ImageUpload.html({ key: 'logo' }, 'dzLogo', d.logo) + '</div>';

    // Patroon en kleuren · Frame · Hoeken: elk een eigen kaart
    var colors = '<div class="dz-sub">' + t('dz.lbl.pattern') + '</div>' + tiles('pattern', DESIGN_PATTERNS, sw('pattern'), 'pattern') +
        '<div class="dz-quick"><button type="button" class="pw-act" data-use-page>' + t('dz.lbl.usePage') + '</button></div>' +
        '<div class="ap-row dz-color dz-parts' + (colorOpen === 'parts' ? ' open' : '') + '" data-parts><button type="button" class="ap-head" data-color-open="parts">' +
          '<span>' + t('dz.lbl.colors') + '</span><span class="ap-val"><i data-pv="color"></i><i data-pv="outer"></i><i data-pv="inner"></i></span></button><div class="ap-pick"></div></div>' +
        '<label class="tg dz-check"><input type="checkbox" data-grad><span class="sw-ui"></span><span>' + t('dz.lbl.gradient') + '</span></label>' +
        '<div class="dz-when" data-when="gradient">' + colorRow('color2', t('dz.lbl.color2')) + '</div>' +
        '<div class="dz-sub">' + t('dz.lbl.decor') + '</div>' + tiles('decor', DESIGN_DECOR, function (v) {
          return v ? '<span class="dz-mini">' + QRRender.svg(DESIGN_SAMPLE, { decor: v, color: '#1e293b' }) + '</span>' : '<span class="dz-none"></span>';
        }, 'decor');
    var frame = '<div class="dz-cats" role="tablist">' + Object.keys(FRAME_GROUPS).map(function (g) {
          return '<button type="button" role="tab" data-fgroup="' + g + '" aria-selected="' + (g === grp) + '">' + t('dz.fgroup.' + g) + '</button>';
        }).join('') + '</div>' + Object.keys(FRAME_GROUPS).map(function (g) {
          return '<div class="dz-fgroup" data-fg="' + g + '"' + (g === grp ? '' : ' hidden') + '>' + tiles('frame', FRAME_GROUPS[g], function (v) {
            return v === 'none' ? '<span class="dz-none"></span>' : '<span class="dz-mini">' + QRRender.svg(DESIGN_SAMPLE, { frame: v, frameText: t('dz.text.scan'), frameColor: v === 'chalkboard' ? '#24332c' : v === 'pumpkin' ? '#f97316' : v === 'heart' ? '#e11d48' : '#1e293b' }, { fontScale: 1.25 }) + '</span>';
          }, 'frames') + '</div>';
        }).join('') +
        '<div class="dz-when" data-when="frame"><div class="field"><label for="dzFrameText">' + t('dz.lbl.frameText') + '</label><input id="dzFrameText" maxlength="32" data-text="frameText" value="' + esc(d.frameText) + '" placeholder="' + esc(t('dz.text.scan')) + '"></div>' +
        '<div class="dz-seg"><span>' + t('dz.lbl.frameFont') + '</span>' + FRAME_FONTS.map(function (fo) { return '<button type="button" data-d="frameFont" data-v="' + fo + '" class="ff-' + (fo || 'auto') + '">' + t('dz.font.' + (fo || 'auto')) + '</button>'; }).join('') + '</div>' +
        colorRow('frameColor', t('dz.lbl.frameColor')) + '</div>';
    var corners = '<div class="dz-corners"><div><div class="dz-sub">' + t('dz.lbl.outer') + '</div>' + tiles('cornerOuter', DESIGN_OUTER, sw('cornerOuter'), 'corner') + '</div>' +
        '<div><div class="dz-sub">' + t('dz.lbl.inner') + '</div>' + tiles('cornerInner', DESIGN_INNER, sw('cornerInner'), 'corner') + '</div></div>';

    return card('style', t('dz.card.style'), styles) +
      card('logo', t('dz.card.logo'), logo) +
      card('colors', t('dz.card.colors'), colors) +
      card('frame', t('dz.card.frame'), frame) +
      card('corners', t('dz.card.corners'), corners);
  }

  // Werkt alleen de wisselende delen bij (geen nieuwe HTML), zodat slepen en typen niet onderbroken worden.
  function update(el, state) {
    var d = Object.assign({}, QR_DEFAULT_DESIGN, state.design);
    el.querySelectorAll('[data-d]').forEach(function (b) { b.setAttribute('aria-pressed', String(String(d[b.getAttribute('data-d')] || '') === b.getAttribute('data-v'))); });
    el.querySelectorAll('.dz-theme').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme') === d.themeId)); });
    el.querySelectorAll('[data-when]').forEach(function (w) { var k = w.getAttribute('data-when'); w.hidden = k === 'frame' ? d.frame === 'none' : !d[k]; });
    el.querySelectorAll('[data-color]').forEach(function (r) {
      var k = r.getAttribute('data-color'), v = d[k], shown = v || (k === 'cornerInnerColor' ? d.cornerColor : '') || (k === 'frameColor2' ? '#94a3b8' : d.color);
      r.querySelector('.ap-val i').style.background = shown; r.querySelector('.ap-val em').textContent = v ? v.toUpperCase() : t(k === 'frameColor2' ? 'dz.font.auto' : 'dz.lbl.same');
      var same = r.querySelector('[data-same]'); if (same) same.hidden = !v;
    });
    var gr = el.querySelector('[data-grad]'); if (gr) gr.checked = !!d.gradient;

    var ef = eff(d); el.querySelectorAll('[data-pv]').forEach(function (i) { i.style.background = ef[i.getAttribute('data-pv')]; });
    var up = el.querySelector('[data-up="logo"]');
    if (up) { up.classList.toggle('has', !!d.logo); up.querySelector('.up-thumb').style.backgroundImage = d.logo ? 'url(' + d.logo + ')' : ''; }
    var ft = el.querySelector('#dzFrameText'); if (ft && document.activeElement !== ft) ft.value = d.frameText || '';
    var a = el.querySelector('.actions'); if (a) a.outerHTML = Actions.html(state);
  }
  /* Kleuren per onderdeel: alles, puntjes, hoeken buiten, hoeken binnen — in één kleurkiezer */
  var part = 'all', PARTS = ['all', 'color', 'outer', 'inner'];
  function eff(d) { return { all: d.color, color: d.color, outer: d.cornerColor || d.color, inner: d.cornerInnerColor || d.cornerColor || d.color }; }
  function partChange(d, p, v) {
    var e = eff(d), o = { themeId: '', gradient: p === 'all' || p === 'color' ? d.gradient : d.gradient };
    if (p === 'all') { o.color = v; o.cornerColor = ''; o.cornerInnerColor = ''; }
    if (p === 'color') { o.color = v; o.cornerColor = e.outer; o.cornerInnerColor = e.inner; }
    if (p === 'outer') { o.cornerColor = v; o.cornerInnerColor = e.inner; }
    if (p === 'inner') { o.cornerColor = e.outer; o.cornerInnerColor = v; }
    return o;
  }
  function mountParts(el) {
    var row = el.querySelector('[data-parts]'), pick = row.querySelector('.ap-pick'), d = store.get().design, e = eff(d);
    pick.innerHTML = '<div class="dz-partbar" role="radiogroup">' + PARTS.map(function (p) {
      return '<button type="button" role="radio" data-part="' + p + '" aria-checked="' + (p === part) + '"><i style="background:' + e[p] + '"></i>' + t('dz.part.' + p) + '</button>';
    }).join('') + '</div><div class="dz-pp">' + ColorPicker.html(t('dz.lbl.colors'), true) + '</div>';
    ColorPicker.mount(pick.querySelector('.cp'), {
      value: e[part],
      onChange: function (v) { var cur = store.get().design; actions.applyDesign(Object.assign({}, cur, partChange(cur, part, v))); var b = row.querySelector('[data-part="' + part + '"] i'); if (b) b.style.background = eff(store.get().design)[part]; },
      onPreview: function (v) { actions.previewDesign(v ? partChange(store.get().design, part, v) : null); }
    });
  }

  function mountColor(el, key) {
    var row = el.querySelector('[data-color="' + key + '"]'), pick = row.querySelector('.ap-pick'), d = store.get().design;
    pick.innerHTML = ColorPicker.html(key, true);
    ColorPicker.mount(pick.querySelector('.cp'), {
      value: d[key] || (key === 'cornerInnerColor' && d.cornerColor) || d.color,
      onChange: function (v) { if (key === 'cornerColor') { actions.applyDesign(Object.assign({}, store.get().design, { cornerColor: v, cornerInnerColor: '', themeId: '' })); } else actions.setDesign(key, v); },
      onPreview: function (v) { var o = null; if (v) { o = {}; o[key] = v; } actions.previewDesign(o); }
    });
  }

  function setCard(el, id, on) {
    openCards[id] = on; var c = el.querySelector('[data-card="' + id + '"]'); if (!c) return;
    c.classList.toggle('open', on); c.querySelector('.dz-card-head').setAttribute('aria-expanded', String(on));
  }
  function render(el, state) {
    el.innerHTML = build(state) + Actions.html(state);
    update(el, state);
    if (colorOpen === 'parts') mountParts(el); else if (colorOpen) mountColor(el, colorOpen);
    ImageUpload.mount(el, function (k, v) { actions.setDesign('logo', v); });
    if (el._dzBound) return; el._dzBound = true;
    el.addEventListener('click', function (e) {
      if (store.get().step !== 'design') return;
      var s = store.get(), opt = e.target.closest('[data-d]'), th = e.target.closest('.dz-theme');
      var co = e.target.closest('[data-color-open]'), same = e.target.closest('[data-same]');
      var ct = e.target.closest('[data-card-toggle]');
      if (ct) { var cid = ct.getAttribute('data-card-toggle'); setCard(el, cid, !openCards[cid]); return; }
      if (opt) { actions.previewDesign(null); actions.setDesign(opt.getAttribute('data-d'), opt.getAttribute('data-v')); if (opt.getAttribute('data-d') === 'frame' && !s.design.frameText) actions.setDesign('frameText', t('dz.text.scan')); }
      if (th) { var theme = themeById(th.getAttribute('data-theme')); actions.previewDesign(null); actions.applyDesign(Object.assign(themeDesign(theme, s), { logo: s.design.logo || '', themeId: theme.id })); }
      if (co) { var k = co.getAttribute('data-color-open'); el.querySelectorAll('.dz-color').forEach(function (r) { r.classList.remove('open'); r.querySelector('.ap-pick').innerHTML = ''; }); colorOpen = colorOpen === k ? null : k;
        if (colorOpen === 'parts') { el.querySelector('[data-parts]').classList.add('open'); mountParts(el); }
        else if (colorOpen) { el.querySelector('[data-color="' + k + '"]').classList.add('open'); mountColor(el, k); } }
      var pt = e.target.closest('[data-part]'); if (pt) { part = pt.getAttribute('data-part'); mountParts(el); }
      if (same) actions.applyDesign(Object.assign({}, s.design, { cornerColor: '', cornerInnerColor: '', themeId: '' }));
      var tgb = e.target.closest('[data-tgroup]');
      if (tgb) { themeGroup = tgb.getAttribute('data-tgroup'); el.querySelectorAll('[data-tgroup]').forEach(function (b) { b.setAttribute('aria-selected', String(b === tgb)); }); el.querySelectorAll('[data-tg]').forEach(function (x) { x.hidden = x.getAttribute('data-tg') !== themeGroup; }); }
      var fg = e.target.closest('[data-fgroup]');
      if (fg) { frameGroup = fg.getAttribute('data-fgroup'); el.querySelectorAll('[data-fgroup]').forEach(function (b) { b.setAttribute('aria-selected', String(b === fg)); }); el.querySelectorAll('[data-fg]').forEach(function (x) { x.hidden = x.getAttribute('data-fg') !== frameGroup; }); }
      if (e.target.closest('[data-use-page]')) { var b = themeDesign({ brand: true }, s); actions.applyDesign(Object.assign({}, s.design, { color: b.color, cornerColor: b.cornerColor, frameColor: b.frameColor, gradient: '' })); }

    });
    el.addEventListener('change', function (e) {
      if (!e.target.hasAttribute('data-grad')) return;
      var d = store.get().design;
      actions.applyDesign(Object.assign({}, d, { gradient: e.target.checked ? 'linear' : '', color2: d.color2 || d.cornerColor || '#2563eb', themeId: '' }));
    });
    el.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-text'); if (k) { e.stopPropagation(); actions.setDesign(k, e.target.value.slice(0, 32)); }
    });
    el.addEventListener('mouseover', function (e) {
      if (store.get().step !== 'design') return;
      var opt = e.target.closest('[data-d]'), th = e.target.closest('.dz-theme');
      if (opt) { var o = {}; o[opt.getAttribute('data-d')] = opt.getAttribute('data-v'); if (opt.getAttribute('data-d') === 'frame' && !store.get().design.frameText) o.frameText = t('dz.text.scan'); actions.previewDesign(o); }
      if (th) { var theme = themeById(th.getAttribute('data-theme')); if (theme) actions.previewDesign(Object.assign(themeDesign(theme, store.get()), { logo: store.get().design.logo || '' })); }
    });
    el.addEventListener('mouseout', function (e) {
      var sel = '.dz-tile,[data-d]', from = e.target.closest(sel), to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(sel);
      if (from && from !== to) actions.previewDesign(null);
    });
  }

  // Downloaden als PNG (1024 px) of SVG.
  function download(format) {
    var s = store.get(), data = encodeQR(s), name = 'qr-' + (s.typeId || 'code');
    var markup = QRRender.svg(data, s.design, { width: 1024 });
    if (format === 'svg') return save(new Blob([markup], { type: 'image/svg+xml' }), name + '.svg');
    var img = new Image(), url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      var ctx = cv.getContext('2d'); if (!s.design.transparent) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height); }
      ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      cv.toBlob(function (b) { save(b, name + '.png'); }, 'image/png');
    };
    img.src = url;
  }
  function save(blob, filename) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  return { render: render, update: update, download: download, qrSvg: function (data, design) { return QRRender.svg(data, design); } };
})();
