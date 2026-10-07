/* =========================================================
   KLEURKIEZER: vierkant (verzadiging x helderheid) + kleurstrook + hex.
   - Muis erover bewegen  = live voorbeeld (onPreview), muis weg = terug.
   - Klikken of slepen    = kiezen (onChange).
   Werkt met muis, touch en toetsenbord (hex-veld).
   ========================================================= */
var ColorPicker = (function () {
  var PRESETS = ['#2bb5f0', '#3b5bdb', '#7c3aed', '#e64980', '#f03e3e', '#f76707', '#f2c94c', '#2f9e44', '#0f766e', '#1e293b'];

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function hsvToHex(h, s, v) {
    var f = function (n) { var k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + [f(5), f(3), f(1)].map(function (x) { return ('0' + Math.round(x * 255).toString(16)).slice(-2); }).join('');
  }
  function hexToHsv(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b), d = max - Math.min(r, g, b), h = 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
  }
  var isHex = function (v) { return /^#[0-9a-f]{6}$/i.test(v); };

  function html(label) {
    return '<div class="cp">' +
      '<div class="cp-sv" tabindex="-1"><span class="cp-dot"></span><span class="cp-ghost"></span></div>' +
      '<div class="cp-hue"><span class="cp-knob"></span></div>' +
      '<div class="cp-row"><span class="cp-chip"></span><input class="cp-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="' + esc(label) + ' (hex)">' +
      '<div class="cp-presets">' + PRESETS.map(function (c) { return '<button type="button" class="cp-pre" data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div></div>' +
    '</div>';
  }

  function mount(root, opts) {
    var sv = root.querySelector('.cp-sv'), hue = root.querySelector('.cp-hue'), dot = root.querySelector('.cp-dot'), ghost = root.querySelector('.cp-ghost');
    var knob = root.querySelector('.cp-knob'), chip = root.querySelector('.cp-chip'), hex = root.querySelector('.cp-hex');
    var cur = hexToHsv(isHex(opts.value) ? opts.value : PRESETS[0]), dragging = null;

    function paint() {
      var c = hsvToHex(cur.h, cur.s, cur.v);
      sv.style.setProperty('--hue', 'hsl(' + cur.h + ',100%,50%)');
      dot.style.left = cur.s * 100 + '%'; dot.style.top = (1 - cur.v) * 100 + '%'; dot.style.background = c;
      knob.style.left = cur.h / 360 * 100 + '%'; knob.style.background = 'hsl(' + cur.h + ',100%,50%)';
      chip.style.background = c;
      if (document.activeElement !== hex) hex.value = c.toUpperCase();
      root.querySelectorAll('.cp-pre').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-c') === c)); });
      return c;
    }
    function fromSv(e) { var r = sv.getBoundingClientRect(); return { h: cur.h, s: clamp((e.clientX - r.left) / r.width, 0, 1), v: 1 - clamp((e.clientY - r.top) / r.height, 0, 1) }; }
    function fromHue(e) { var r = hue.getBoundingClientRect(); return { h: clamp((e.clientX - r.left) / r.width, 0, 1) * 359.9, s: cur.s, v: cur.v }; }
    function commit(hsv) { cur = hsv; opts.onChange(paint()); }

    // Vierkant
    sv.addEventListener('pointermove', function (e) {
      var p = fromSv(e);
      if (dragging === 'sv') return commit(p);
      if (e.pointerType !== 'mouse') return;
      ghost.style.left = p.s * 100 + '%'; ghost.style.top = (1 - p.v) * 100 + '%'; ghost.style.background = hsvToHex(p.h, p.s, p.v); ghost.style.opacity = 1;
      opts.onPreview(hsvToHex(p.h, p.s, p.v));
    });
    // Kleurstrook
    hue.addEventListener('pointermove', function (e) {
      var p = fromHue(e);
      if (dragging === 'hue') return commit(p);
      if (e.pointerType === 'mouse') opts.onPreview(hsvToHex(p.h, p.s, p.v));
    });
    [[sv, 'sv', fromSv], [hue, 'hue', fromHue]].forEach(function (x) {
      x[0].addEventListener('pointerdown', function (e) { e.preventDefault(); dragging = x[1]; x[0].setPointerCapture(e.pointerId); ghost.style.opacity = 0; commit(x[2](e)); });
      x[0].addEventListener('pointerup', function () { dragging = null; opts.onPreview(null); });
      x[0].addEventListener('pointerleave', function () { if (!dragging) { ghost.style.opacity = 0; opts.onPreview(null); } });
    });
    // Snelkeuze
    root.querySelectorAll('.cp-pre').forEach(function (b) {
      b.addEventListener('mouseenter', function () { opts.onPreview(b.getAttribute('data-c')); });
      b.addEventListener('mouseleave', function () { opts.onPreview(null); });
      b.addEventListener('click', function () { commit(hexToHsv(b.getAttribute('data-c'))); opts.onPreview(null); });
    });
    // Hex-veld
    hex.addEventListener('input', function (e) {
      e.stopPropagation();
      var v = hex.value.trim(); if (v[0] !== '#') v = '#' + v;
      if (isHex(v)) commit(hexToHsv(v.toLowerCase()));
    });
    hex.addEventListener('blur', paint);
    paint();
  }

  return { html: html, mount: mount };
})();
