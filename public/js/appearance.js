/* =========================================================
   UITERLIJK: twee kleuren (hoofdkleur + knopkleur)
   - Twee rustige regels (hoofdkleur, knopkleur); klik = kleurkiezer klapt open, muis erover = live op de telefoon.
   - "Uit je foto": passende combinaties automatisch gehaald uit de omslagfoto.
   Tekstkleur op beide kleuren wordt automatisch leesbaar gemaakt (zie drawPhone).
   ========================================================= */
/* Kleuren uit een foto: verkleinen, pixels groeperen op tint, de sterkste tint en een donkere kleur nemen. */
var PhotoColors = (function () {
  var cache = {};
  function hex(r, g, b) { return '#' + [r, g, b].map(function (x) { return ('0' + Math.round(x).toString(16)).slice(-2); }).join(''); }
  function extract(src) {
    if (cache[src]) return Promise.resolve(cache[src]);
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var n = 48, cv = document.createElement('canvas'); cv.width = cv.height = n;
        var ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, n, n);
        var px = ctx.getImageData(0, 0, n, n).data, bins = {}, dark = [0, 0, 0, 0];
        for (var i = 0; i < px.length; i += 4) {
          var r = px[i], g = px[i + 1], b = px[i + 2], max = Math.max(r, g, b), min = Math.min(r, g, b), s = max ? (max - min) / max : 0, v = max / 255;
          if (v < 0.35) { dark[0] += r; dark[1] += g; dark[2] += b; dark[3]++; }
          if (s < 0.25 || v < 0.25 || v > 0.97) continue;
          var h = max === min ? 0 : max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
          var k = Math.floor(h * 2), w = s * v;                          // 12 tintgroepen
          var bin = bins[k] || (bins[k] = [0, 0, 0, 0]); bin[0] += r * w; bin[1] += g * w; bin[2] += b * w; bin[3] += w;
        }
        var top = Object.keys(bins).map(function (k) { return bins[k]; }).sort(function (a, b) { return b[3] - a[3]; })
          .slice(0, 2).map(function (x) { return hex(x[0] / x[3], x[1] / x[3], x[2] / x[3]); });
        var d = dark[3] ? hex(dark[0] / dark[3] * 0.8, dark[1] / dark[3] * 0.8, dark[2] / dark[3] * 0.8) : '#111827';
        var out = [];
        if (top[0]) { out.push([top[0], d]); out.push([d, top[0]]); }
        if (top[1]) out.push([top[0], top[1]]);
        resolve(cache[src] = out);
      };
      img.onerror = function () { resolve(cache[src] = []); };
      img.src = src;
    });
  }
  return { extract: extract, cached: function (src) { return cache[src]; } };
})();

var Appearance = (function () {
  var open = null;                                           // welke kleur staat open: 'pc', 'ac' of null (rustig: standaard alles dicht)
  function row(key, label, color) {
    return '<div class="ap-row' + (open === key ? ' open' : '') + '">' +
      '<button type="button" class="ap-head" data-open="' + key + '" aria-expanded="' + (open === key) + '">' +
        '<span>' + label + '</span><span class="ap-val"><i style="background:' + color + '"></i>' + color.toUpperCase() + '</span></button>' +
      (open === key ? '<div class="ap-pick">' + ColorPicker.html(label, true) + '</div>' : '') + '</div>';
  }
  function inner() {
    var s = store.get(), cover = (s.content[s.typeId] || {}).cover, photo = cover && PhotoColors.cached(cover);
    return '<h3>' + t('appearance.title') + '</h3>' +
      (photo && photo.length ? '<div class="ap-photo"><span>' + t('appearance.fromPhoto') + '</span>' + photo.map(function (p) {
        var on = s.pageColor === p[0] && s.accentColor === p[1];
        return '<button type="button" class="ap-sug" data-pal="' + p.join(',') + '" aria-pressed="' + on + '"><i style="background:' + p[0] + '"></i><i style="background:' + p[1] + '"></i></button>';
      }).join('') + '</div>' : '') +
      row('pc', t('appearance.primary'), s.pageColor) + row('ac', t('appearance.button'), s.accentColor);
  }
  function render(el) {
    el.innerHTML = inner();
    var s = store.get(), cp = el.querySelector('.cp');
    if (cp) ColorPicker.mount(cp, {
      value: open === 'pc' ? s.pageColor : s.accentColor,
      onChange: function (c) {
        actions.setColor(open, c);
        var v = el.querySelector('[data-open="' + open + '"] .ap-val'); v.lastChild.textContent = c.toUpperCase(); v.querySelector('i').style.background = c;
      },
      onPreview: function (c) { var o = null; if (c) { o = {}; o[open] = c; } actions.previewTheme(o); }
    });
    var cover = (s.content[s.typeId] || {}).cover;
    if (cover && !PhotoColors.cached(cover)) PhotoColors.extract(cover).then(function () { if (el.isConnected) render(el); });
  }
  function mount(el) {
    open = null; render(el);
    el.addEventListener('click', function (e) {
      var p = e.target.closest('[data-pal]'), h = e.target.closest('[data-open]');
      if (p) { var c = p.getAttribute('data-pal').split(','); actions.setTheme(c[0], c[1]); actions.previewTheme(null); render(el); }
      if (h) { var k = h.getAttribute('data-open'); open = open === k ? null : k; render(el); var pk = el.querySelector('.ap-pick'); if (pk) pk.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    });
    el.addEventListener('mouseover', function (e) { var p = e.target.closest('[data-pal]'); if (p) { var c = p.getAttribute('data-pal').split(','); actions.previewTheme({ pc: c[0], ac: c[1] }); } });
    el.addEventListener('mouseout', function (e) { if (e.target.closest('[data-pal]') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-pal]'))) actions.previewTheme(null); });
  }
  // Nieuwe omslagfoto? Dan de kleuren uit de foto opnieuw berekenen.
  store.subscribe(function (s, prev) {
    var a = (s.content[s.typeId] || {}).cover, b = (prev.content[prev.typeId] || {}).cover, el = document.getElementById('appearance');
    if (a !== b && el && s.step === 'content') render(el);
  });
  return { mount: mount };
})();
