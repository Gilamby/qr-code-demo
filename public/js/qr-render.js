/* =========================================================
   QR-RENDER: tekent een QR-code als SVG met eigen vormen, kleuren, frame en logo.
   Geen externe ontwerp-library: alleen qrcode-generator voor de matrix.

   design = {
     color, background, transparent,          kleur van de code en achtergrond
     gradient: '' | 'linear' | 'radial', color2,
     pattern:  square | rounded | smooth | dots | classy | diamond | heart | star
     cornerOuter: square | rounded | extra | circle | leaf | dots
     cornerInner: square | rounded | circle | diamond | heart | star | leaf
     cornerColor, cornerInnerColor            leeg = zelfde als de code
     frame: none | label | labelTop | bubble | script | badge | tag, frameText, frameColor
     logo                                     data-URL (optioneel)
   }
   ========================================================= */
// Elke QR-code is uniek: hij krijgt een eigen korte link met een willekeurig id (7 tekens, ±3,5 biljoen mogelijkheden).
var QR_BASE = 'https://qr.optimasys.com';                  // wordt de eigen server zodra die bereikbaar is (zie main.js)
function newDraftId() { var a = new Uint8Array(7), c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', s = ''; crypto.getRandomValues(a); a.forEach(function (n) { s += c[n % c.length]; }); return s; }

var QR_DEFAULT_DESIGN = {
  color: '#0b0e13', background: '#ffffff', transparent: false, gradient: '', color2: '#2bb5f0',
  pattern: 'square', cornerOuter: 'square', cornerInner: 'square', cornerColor: '', cornerInnerColor: '',
  frame: 'none', frameText: '', frameColor: '#0b0e13', frameGradient: false, frameColor2: '', frameFont: '', decor: '', logo: '', themeId: 'classic'
};

var QRRender = (function () {
  var uid = 0;
  var f = function (n) { return Math.round(n * 1000) / 1000; };
  var escText = function (s) { return String(s || '').replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); };

  /* ---------- Basisvormen (x, y = linksboven, s = grootte) ---------- */
  function rr(x, y, w, h, r) {                        // afgeronde rechthoek; r = [lb, rb, ro, lo] of één getal
    if (!Array.isArray(r)) r = [r, r, r, r];
    var a = r[0], b = r[1], c = r[2], d = r[3];
    return 'M' + f(x + a) + ' ' + f(y) + 'H' + f(x + w - b) + (b ? 'A' + f(b) + ' ' + f(b) + ' 0 0 1 ' + f(x + w) + ' ' + f(y + b) : '') +
      'V' + f(y + h - c) + (c ? 'A' + f(c) + ' ' + f(c) + ' 0 0 1 ' + f(x + w - c) + ' ' + f(y + h) : '') +
      'H' + f(x + d) + (d ? 'A' + f(d) + ' ' + f(d) + ' 0 0 1 ' + f(x) + ' ' + f(y + h - d) : '') +
      'V' + f(y + a) + (a ? 'A' + f(a) + ' ' + f(a) + ' 0 0 1 ' + f(x + a) + ' ' + f(y) : '') + 'Z';
  }
  function circle(cx, cy, r) { return 'M' + f(cx - r) + ' ' + f(cy) + 'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0Z'; }
  function diamond(x, y, s) { var m = s / 2; return 'M' + f(x + m) + ' ' + f(y) + 'L' + f(x + s) + ' ' + f(y + m) + 'L' + f(x + m) + ' ' + f(y + s) + 'L' + f(x) + ' ' + f(y + m) + 'Z'; }
  function heart(x, y, s) {
    var p = function (a, b) { return f(x + a * s) + ' ' + f(y + b * s); };
    return 'M' + p(.5, .92) + 'C' + p(.12, .64) + ' ' + p(-.02, .4) + ' ' + p(.08, .22) + 'C' + p(.18, .04) + ' ' + p(.42, .04) + ' ' + p(.5, .24) +
      'C' + p(.58, .04) + ' ' + p(.82, .04) + ' ' + p(.92, .22) + 'C' + p(1.02, .4) + ' ' + p(.88, .64) + ' ' + p(.5, .92) + 'Z';
  }
  function star(x, y, s) {
    var cx = x + s / 2, cy = y + s / 2 + s * .04, R = s * .54, r = R * .45, d = '';
    for (var i = 0; i < 10; i++) { var a = Math.PI / 5 * i - Math.PI / 2, q = i % 2 ? r : R; d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * q) + ' ' + f(cy + Math.sin(a) * q); }
    return d + 'Z';
  }

  function oct(x, y, w, c) { return 'M' + f(x + c) + ' ' + f(y) + 'H' + f(x + w - c) + 'L' + f(x + w) + ' ' + f(y + c) + 'V' + f(y + w - c) + 'L' + f(x + w - c) + ' ' + f(y + w) + 'H' + f(x + c) + 'L' + f(x) + ' ' + f(y + w - c) + 'V' + f(y + c) + 'Z'; }
  function plus(x, y, s, t) { var a = (s - t) / 2; return 'M' + f(x + a) + ' ' + f(y) + 'h' + f(t) + 'v' + f(a) + 'h' + f(a) + 'v' + f(t) + 'h' + f(-a) + 'v' + f(a) + 'h' + f(-t) + 'v' + f(-a) + 'h' + f(-a) + 'v' + f(-t) + 'h' + f(a) + 'Z'; }

  /* ---------- Seizoensdecoratie ----------
     Alleen in de extra rand rond de code (nooit over de puntjes heen), dus de code blijft scanbaar.
     c1..c4 = de vier hoeken van de code. */
  function decorSvg(kind, Q, n) {
    if (!kind) return '';
    var c1 = [Q, Q], c2 = [Q + n, Q], c3 = [Q, Q + n], c4 = [Q + n, Q + n], out = '';
    var g = function (x, y, rot, s, inner) {                 // iets naar buiten schuiven en groter tekenen
      var cx = Q + n / 2, cy = Q + n / 2, dx = x - cx, dy = y - cy, len = Math.sqrt(dx * dx + dy * dy) || 1;
      x += dx / len * .7; y += dy / len * .7;
      return '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + (rot || 0) + ') scale(' + f((s || 1) * 1.45) + ')">' + inner + '</g>';
    };
    var holly = '<path d="M0 0C-1.6-.6-2.6-.2-3.2 1C-2.4 1-2 1.6-2 2.2C-1.2 1.6-.6 1.4 0 0Z" fill="#15803d"/><path d="M0 0C1.6-.6 2.6-.2 3.2 1C2.4 1 2 1.6 2 2.2C1.2 1.6.6 1.4 0 0Z" fill="#166534"/>' +
      '<circle cx="-.4" cy="-.3" r=".55" fill="#dc2626"/><circle cx=".45" cy="-.45" r=".55" fill="#b91c1c"/><circle cx=".05" cy=".35" r=".55" fill="#ef4444"/>';
    var hat = '<path d="M-2.2 1.2L.4-3.4L2.4 1.2Z" fill="#dc2626"/><path d="' + rr(-2.6, .8, 5.4, 1.2, .6) + '" fill="#fff" stroke="#e5e7eb" stroke-width=".15"/><circle cx=".4" cy="-3.4" r=".75" fill="#fff" stroke="#e5e7eb" stroke-width=".15"/>';
    var flake = function (col) { var l = ''; for (var i = 0; i < 6; i++) l += '<path d="M0 0V-1.8M0 -1.1L-.45 -1.5M0 -1.1L.45 -1.5" transform="rotate(' + i * 60 + ')"/>'; return '<g fill="none" stroke="' + col + '" stroke-width=".28" stroke-linecap="round">' + l + '</g>'; };
    var bat = '<path d="M0 .4C-.6-.4-1.6-.8-3-.4C-2.4 0-2.2.6-2.4 1C-1.8.6-1.2.8-1 1.2C-.6.8-.3.7 0 .9C.3.7.6.8 1 1.2C1.2.8 1.8.6 2.4 1C2.2.6 2.4 0 3-.4C1.6-.8.6-.4 0 .4Z" fill="#1c1917"/><circle cx="-.3" cy="0" r=".12" fill="#fbbf24"/><circle cx=".3" cy="0" r=".12" fill="#fbbf24"/>';
    var web = '<g fill="none" stroke="#9ca3af" stroke-width=".14"><path d="M0 0L3.6 0M0 0L3.2 1.6M0 0L1.6 3.2M0 0L0 3.6"/><path d="M1.2 0Q1 .5 .6 1.05Q.25 1 0 1.2M2.3 0Q2 1 1.2 1.9Q.6 2 0 2.3M3.4 0Q3 1.5 1.8 2.8Q.9 3.1 0 3.4"/></g>';
    var pump = '<ellipse cx="-.7" cy=".2" rx="1" ry="1.2" fill="#ea580c"/><ellipse cx=".7" cy=".2" rx="1" ry="1.2" fill="#ea580c"/><ellipse cx="0" cy=".1" rx="1.1" ry="1.3" fill="#f97316"/><path d="M0-1.1Q.1-1.7.5-1.9" stroke="#4d7c0f" stroke-width=".35" fill="none" stroke-linecap="round"/>';
    var egg = function (a, b) { return '<ellipse rx="1.15" ry="1.5" fill="' + a + '"/><path d="M-1.1 .1Q-.55-.35 0 .1T1.1 .1" fill="none" stroke="' + b + '" stroke-width=".35"/>'; };
    var flower = function (p, cc) { var l = ''; for (var i = 0; i < 5; i++) l += '<circle cx="0" cy="-.85" r=".7" fill="' + p + '" transform="rotate(' + i * 72 + ')"/>'; return l + '<circle r=".55" fill="' + cc + '"/>'; };
    var spark = function (col) { return '<path d="M0-1.8Q.25-.25 1.8 0Q.25 .25 0 1.8Q-.25 .25-1.8 0Q-.25-.25 0-1.8Z" fill="' + col + '"/>'; };
    var party = '<path d="M-1.6 1.4L0-3L1.6 1.4Z" fill="#8b5cf6"/><path d="M-1.05-.1L.5-.1M-1.4 .9L1.3 .9" stroke="#fde047" stroke-width=".45"/><circle cy="-3" r=".6" fill="#f472b6"/>';
    var hrt = function (col) { return '<path d="' + heart(-1, -1, 2) + '" fill="' + col + '"/>'; };
    switch (kind) {
      case 'xmas':      out = g(c1[0] - .3, c1[1] - .9, -24, .95, hat) + g(c2[0] - .2, c2[1] - .8, 18, .9, holly) + g(c3[0] + .3, c3[1] + .9, -160, .9, holly) + g(c4[0] + .4, c4[1] + .5, 0, .8, flake('#60a5fa')); break;
      case 'winter':    out = g(c1[0] - 1.6, c1[1] - 1.6, 0, .9, flake('#60a5fa')) + g(c2[0] + 1.6, c2[1] - 1.6, 15, .7, flake('#93c5fd')) + g(c3[0] - 1.6, c3[1] + 1.6, 30, .7, flake('#93c5fd')) + g(c4[0] + 1.6, c4[1] + 1.6, 10, .9, flake('#3b82f6')); break;
      case 'halloween': out = g(c1[0] - 3.6, c1[1] - 3.6, 0, 1, web) + g(c2[0] + .2, c2[1] - 2, 12, .85, bat) + g(c3[0] - 2, c3[1] + 1.9, 0, .8, pump) + g(c4[0] + 1.4, c4[1] + 1.6, -10, .55, bat); break;
      case 'valentine': out = g(c1[0] - 1.7, c1[1] - 1.7, -15, .9, hrt('#e11d48')) + g(c2[0] + 1.7, c2[1] - 1.8, 15, .75, hrt('#f472b6')) + g(c3[0] - 1.7, c3[1] + 1.7, 10, .75, hrt('#f472b6')) + g(c4[0] + 1.8, c4[1] + 1.8, -10, .95, hrt('#e11d48')) + g(c2[0] - 1, c2[1] - 2.8, 0, .4, hrt('#fb7185')); break;
      case 'easter':    out = g(c1[0] - 1.7, c1[1] - 1.7, 0, .75, flower('#fde68a', '#f59e0b')) + g(c2[0] + 1.6, c2[1] - 1.7, 18, .8, egg('#a7f3d0', '#10b981')) + g(c3[0] - 1.6, c3[1] + 1.7, -14, .8, egg('#fbcfe8', '#ec4899')) + g(c4[0] + 1.6, c4[1] + 1.6, 10, .8, egg('#bfdbfe', '#3b82f6')); break;
      case 'spring':    out = g(c1[0] - 1.7, c1[1] - 1.7, 0, .8, flower('#f9a8d4', '#fde047')) + g(c2[0] + 1.7, c2[1] - 1.7, 20, .7, flower('#c4b5fd', '#fde047')) + g(c3[0] - 1.7, c3[1] + 1.7, 40, .7, flower('#fdba74', '#fde047')) + g(c4[0] + 1.7, c4[1] + 1.7, 10, .8, flower('#f9a8d4', '#fde047')); break;
      case 'newyear':   out = g(c1[0] - 1.8, c1[1] - 1.8, 0, .95, spark('#d4a72c')) + g(c2[0] + 1.8, c2[1] - 1.6, 0, .7, spark('#facc15')) + g(c3[0] - 1.6, c3[1] + 1.8, 0, .7, spark('#facc15')) + g(c4[0] + 1.8, c4[1] + 1.8, 0, .95, spark('#d4a72c')) + g(c2[0] - .8, c2[1] - 2.6, 0, .35, spark('#d4a72c')); break;
      case 'birthday':  out = g(c1[0] - .2, c1[1] - .8, -26, .95, party) + g(c2[0] + 1.6, c2[1] - 1.6, 30, 1, '<rect x="-.9" y="-.3" width="1.8" height=".6" rx=".2" fill="#22c55e"/>') + g(c3[0] - 1.6, c3[1] + 1.6, -20, 1, '<rect x="-.9" y="-.3" width="1.8" height=".6" rx=".2" fill="#f59e0b"/>') + g(c4[0] + 1.6, c4[1] + 1.6, 0, 1, '<circle r=".55" fill="#3b82f6"/>') + g(c2[0] - 1.6, c2[1] - 2.4, 0, 1, '<circle r=".4" fill="#ec4899"/>'); break;
    }
    return out;
  }

  /* ---------- Eén module (puntje) van de code ---------- */
  function moduleShape(kind, x, y, isDark) {
    switch (kind) {
      case 'rounded': return rr(x + .05, y + .05, .9, .9, .3);
      case 'dots':    return circle(x + .5, y + .5, .44);
      case 'classy':  return rr(x, y, 1, 1, [.5, 0, .5, 0]);
      case 'diamond': return diamond(x - .04, y - .04, 1.08);
      case 'heart':   return heart(x - .03, y - .02, 1.06);
      case 'star':    return star(x - .05, y - .05, 1.1);
      case 'tiny':    return rr(x + .18, y + .18, .64, .64, .08);
      case 'cross':   return plus(x - .02, y - .02, 1.04, .42);
      case 'mosaic':  { var k = [.62, .82, 1][(x * 7 + y * 13) % 3], o = (1 - k) / 2; return rr(x + o, y + o, k, k, k * .3); }
      case 'vertical': { var up = isDark(y - 1, x), dn = isDark(y + 1, x); return rr(x + .12, y, .76, 1, [up ? 0 : .38, up ? 0 : .38, dn ? 0 : .38, dn ? 0 : .38]); }
      case 'horizontal': { var lf = isDark(y, x - 1), rt2 = isDark(y, x + 1); return rr(x, y + .12, 1, .76, [lf ? 0 : .38, rt2 ? 0 : .38, rt2 ? 0 : .38, lf ? 0 : .38]); }
      case 'smooth': {                                   // vloeiend: verbonden met de buren
        var r = isDark(y - 1, x) || isDark(y, x - 1) ? 0 : .5, tr = isDark(y - 1, x) || isDark(y, x + 1) ? 0 : .5;
        var br = isDark(y + 1, x) || isDark(y, x + 1) ? 0 : .5, bl = isDark(y + 1, x) || isDark(y, x - 1) ? 0 : .5;
        return rr(x, y, 1, 1, [r, tr, br, bl]);
      }
      default: return 'M' + x + ' ' + y + 'h1v1h-1z';
    }
  }

  /* ---------- De drie grote hoeken ---------- */
  function outerShape(kind, x, y, pos) {               // 7x7 ring; pos: 0 = linksboven, 1 = rechtsboven, 2 = linksonder
    var leafO = pos === 0 ? [3, 0, 3, 0] : [0, 3, 0, 3], leafI = pos === 0 ? [2, 0, 2, 0] : [0, 2, 0, 2];
    switch (kind) {
      case 'rounded': return rr(x, y, 7, 7, 2) + rr(x + 1, y + 1, 5, 5, 1.2);
      case 'extra':   return rr(x, y, 7, 7, 3) + rr(x + 1, y + 1, 5, 5, 2);
      case 'circle':  return circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5);
      case 'leaf':    return rr(x, y, 7, 7, leafO) + rr(x + 1, y + 1, 5, 5, leafI);
      case 'chamfer': return oct(x, y, 7, 2) + oct(x + 1, y + 1, 5, 1.4);
      case 'drop':    return rr(x, y, 7, 7, pos === 0 ? [3.5, 3.5, 0, 3.5] : pos === 1 ? [3.5, 3.5, 3.5, 0] : [3.5, 0, 3.5, 3.5]) + rr(x + 1, y + 1, 5, 5, pos === 0 ? [2.5, 2.5, 0, 2.5] : pos === 1 ? [2.5, 2.5, 2.5, 0] : [2.5, 0, 2.5, 2.5]);
      case 'dots': {
        var d = '';
        for (var i = 0; i < 7; i++) for (var j = 0; j < 7; j++) if (i === 0 || j === 0 || i === 6 || j === 6) d += circle(x + j + .5, y + i + .5, .45);
        return d;
      }
      default: return rr(x, y, 7, 7, 0) + rr(x + 1, y + 1, 5, 5, 0);
    }
  }
  function innerShape(kind, x, y, pos) {               // 3x3 middenstuk
    switch (kind) {
      case 'rounded': return rr(x, y, 3, 3, .8);
      case 'circle':  return circle(x + 1.5, y + 1.5, 1.5);
      case 'diamond': return diamond(x - .25, y - .25, 3.5);
      case 'heart':   return heart(x - .2, y - .15, 3.4);
      case 'star':    return star(x - .3, y - .3, 3.6);
      case 'leaf':    return rr(x, y, 3, 3, pos === 0 ? [1.4, 0, 1.4, 0] : [0, 1.4, 0, 1.4]);
      case 'flower':  return circle(x + 1.5, y + .75, .75) + circle(x + 2.25, y + 1.5, .75) + circle(x + 1.5, y + 2.25, .75) + circle(x + .75, y + 1.5, .75) + circle(x + 1.5, y + 1.5, .8);
      case 'plus':    return plus(x - .2, y - .2, 3.4, 1.5);
      case 'chamfer': return oct(x, y, 3, .9);
      default:        return rr(x, y, 3, 3, 0);
    }
  }

  function matrix(data, ec) {
    if (typeof qrcode !== 'function') return null;
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    var qr = qrcode(0, ec); qr.addData(data || ' '); qr.make();
    return qr;
  }

  /* ---------- Code (zonder frame) als <g>, op positie (0,0), grootte n+4 ---------- */
  function codeGroup(qr, d, id) {
    var n = qr.getModuleCount(), Q = d.decor ? 6 : 2;                // met decoratie: extra rand voor de versiering
    var isDark = function (r, c) { return r >= 0 && c >= 0 && r < n && c < n && qr.isDark(r, c) && !inFinder(r, c) && !inLogo(r, c); };
    function inFinder(r, c) { return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7); }
    var hole = d.logo ? Math.max(5, Math.round(n * .22)) | 1 : 0, h0 = (n - hole) / 2;
    function inLogo(r, c) { return hole && r >= h0 - .5 && r < h0 + hole - .5 && c >= h0 - .5 && c < h0 + hole - .5; }
    var dots = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (isDark(r, c)) dots += moduleShape(d.pattern, c + Q, r + Q, function (rr2, cc) { return isDark(rr2 - Q, cc - Q); });
    var fill = d.gradient ? 'url(#g' + id + ')' : d.color;
    var outerFill = d.cornerColor || fill, innerFill = d.cornerInnerColor || d.cornerColor || fill;
    var pos = [[Q, Q], [Q + n - 7, Q], [Q, Q + n - 7]], outer = '', inner = '';
    pos.forEach(function (p, i) { outer += outerShape(d.cornerOuter, p[0], p[1], i); inner += innerShape(d.cornerInner, p[0] + 2, p[1] + 2, i); });
    var S = n + 2 * Q, defs = '';
    if (d.gradient === 'linear') defs = '<linearGradient id="g' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + d.color + '"/><stop offset="1" stop-color="' + d.color2 + '"/></linearGradient>';
    if (d.gradient === 'radial') defs = '<radialGradient id="g' + id + '" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="' + d.color + '"/><stop offset="1" stop-color="' + d.color2 + '"/></radialGradient>';
    var logo = '';
    if (hole) {
      var lx = Q + h0 - .5, pad = .4;
      logo = (d.transparent ? '' : '<rect x="' + f(lx) + '" y="' + f(lx) + '" width="' + hole + '" height="' + hole + '" rx="1" fill="' + d.background + '"/>') +
        '<image href="' + d.logo + '" x="' + f(lx + pad) + '" y="' + f(lx + pad) + '" width="' + f(hole - 2 * pad) + '" height="' + f(hole - 2 * pad) + '" preserveAspectRatio="xMidYMid meet"/>';
    }
    return { size: S, defs: defs, body: (d.transparent ? '' : '<rect width="' + S + '" height="' + S + '" rx="1.2" fill="' + d.background + '"/>') +
      '<path d="' + dots + '" fill="' + fill + '"/><path d="' + outer + '" fill="' + outerFill + '" fill-rule="evenodd"/><path d="' + inner + '" fill="' + innerFill + '"/>' + logo + decorSvg(d.decor, Q, n) };
  }

  /* ---------- Frames rond de code ----------
     Alles in "frame-eenheden": het venster voor de code is 100 x 100. De code wordt daarin geschaald.
     Elke frame geeft { w, h, body }. fc = framekleur (of verloop), ink = leesbare tekst op fc. */
  function ink(hex) { var n = parseInt(hex.slice(1), 16), l = (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255; return l > .6 ? '#111111' : '#ffffff'; }
  function shade(hex, amt) {                           // amt < 0 = donkerder, > 0 = lichter
    var n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { return Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt); });
    return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  var FONTS = {
    modern: 'Manrope, Arial, sans-serif', hand: "Caveat, 'Segoe Script', 'Brush Script MT', cursive", serif: "'Playfair Display', Georgia, serif",
    bold: "'Bebas Neue', Impact, 'Arial Narrow', sans-serif", round: "Fredoka, 'Arial Rounded MT Bold', Arial, sans-serif"
  };
  var HAND_FRAMES = ['script', 'polaroid', 'chalkboard'];
  var FRAME_SIZE = {};                                  // wordt hieronder per frame gevuld (voor tegels)

  function framed(code, d, fontScale) {
    var S = code.size, id = code.id, base = d.frameColor || '#0b0e13', ik = ink(base), dk = shade(base, -.3), lt = shade(base, .82);
    var fc = d.frameGradient ? 'url(#fg' + id + ')' : base;
    var defs = d.frameGradient ? '<linearGradient id="fg' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + base + '"/><stop offset="1" stop-color="' + (d.frameColor2 || shade(base, .45)) + '"/></linearGradient>' : '';
    var txt = escText(d.frameText), sc = fontScale || 1;
    var font = FONTS[d.frameFont] || (HAND_FRAMES.indexOf(d.frame) >= 0 ? FONTS.hand : FONTS.modern);
    var bigFont = d.frameFont === 'bold' || (!d.frameFont && false) ? 1.25 : (font === FONTS.hand ? 1.35 : 1);
    function win(x, y, s, r) { return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(s) + '" height="' + f(s) + '" rx="' + (r == null ? 4 : r) + '" fill="#fff"/><g transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(s / S) + ')">' + code.body + '</g>'; }
    // Tekst past zich aan: te lang = kleiner lettertype, zodat hij altijd binnen het frame blijft.
    var widthK = font === FONTS.hand ? .5 : font === FONTS.bold ? .4 : font === FONTS.serif ? .56 : .58;
    function T(x, y, size, color, extra, maxW) {
      var fsz = size * sc * bigFont, est = String(d.frameText || '').length * fsz * widthK, room = maxW || 96;
      if (est > room) fsz = fsz * room / est;
      return '<text x="' + f(x) + '" y="' + f(y) + '" text-anchor="middle" dominant-baseline="auto" font-family="' + font.replace(/"/g, "'") + '" font-weight="800" font-size="' + f(fsz) + '" fill="' + color + '"' + (extra || '') + '>' + txt + '</text>';
    }
    function mask(w, h, holes) { return '<mask id="m' + id + '"><rect width="' + w + '" height="' + h + '" fill="#fff"/><path d="' + holes + '" fill="#000"/></mask>'; }
    function out(w, h, body) { return { w: w, h: h, body: (defs ? '<defs>' + defs + '</defs>' : '') + body }; }
    var M = ' mask="url(#m' + id + ')"';

    switch (d.frame) {
      /* ----- Basis ----- */
      case 'label':    return out(116, 146, '<path d="' + rr(0, 0, 116, 146, 10) + '" fill="' + fc + '"/>' + win(8, 8, 100) + T(58, 132, 15, ik));
      case 'labelTop': return out(116, 146, '<path d="' + rr(0, 0, 116, 146, 10) + '" fill="' + fc + '"/>' + win(8, 38, 100) + T(58, 28, 15, ik));
      case 'bubble':   return out(112, 152, '<path d="' + rr(1.5, 1.5, 109, 109, 10) + '" fill="#fff" stroke="' + fc + '" stroke-width="3"/>' + win(6, 6, 100) +
        '<path d="' + rr(6, 122, 100, 28, 14) + 'M48 123L56 113L64 123Z" fill="' + fc + '"/>' + T(56, 141, 13.5, ik));
      case 'tag':      return out(112, 142, '<path d="' + rr(16, 1, 80, 26, 13) + 'M48 26L56 35L64 26Z" fill="' + fc + '"/>' + T(56, 19, 13, ik) + win(6, 40, 100));
      case 'badge': {
        var c = 94, R = 92, inner = 72, rt = 81;
        return out(188, 188, '<defs><path id="arc' + id + '" d="M' + (c - rt) + ' ' + c + 'A' + rt + ' ' + rt + ' 0 0 0 ' + (c + rt) + ' ' + c + '"/></defs>' +
          '<circle cx="' + c + '" cy="' + c + '" r="' + R + '" fill="' + fc + '"/><circle cx="' + c + '" cy="' + c + '" r="' + inner + '" fill="#fff"/>' + win(c - 50, c - 50, 100, 2) +
          '<text font-family="' + font.replace(/"/g, "'") + '" font-weight="800" font-size="' + f(13 * sc) + '" fill="' + ik + '" letter-spacing="1.5"><textPath href="#arc' + id + '" startOffset="50%" text-anchor="middle">' + txt + '</textPath></text>');
      }
      case 'script':   return out(130, 172, win(15, 2, 100) +
        '<path d="M12 162C2 140 4 118 18 106" fill="none" stroke="' + fc + '" stroke-width="3" stroke-linecap="round"/><path d="M10 106L19 105L18 114" fill="none" stroke="' + fc + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
        T(76, 154, 17, fc, ' transform="rotate(-9 76 150)"', 104));
      case 'ticket':   return out(124, 168, mask(124, 168, circle(0, 122, 9) + circle(124, 122, 9)) + '<path d="' + rr(0, 0, 124, 168, 10) + '" fill="' + fc + '"' + M + '/>' + win(12, 12, 100) +
        '<path d="M14 122H110" stroke="' + ik + '" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="4 4"/>' + T(62, 152, 14, ik));
      case 'polaroid': return out(132, 160, '<g transform="rotate(-3 66 80)"><path d="' + rr(6, 8, 120, 146, 3) + '" fill="#000" opacity=".12"/><path d="' + rr(4, 4, 120, 146, 3) + '" fill="#fff" stroke="#d9dde3"/>' +
        win(14, 14, 100, 1) + '<rect x="46" y="-2" width="40" height="14" fill="' + fc + '" opacity=".55" transform="rotate(4 66 5)"/>' + T(64, 140, 15, fc) + '</g>');
      case 'phone':    return out(124, 198, '<path d="' + rr(0, 0, 124, 198, 22) + '" fill="' + fc + '"/><path d="' + rr(6, 6, 112, 186, 17) + '" fill="#fff"/><path d="' + rr(46, 11, 32, 8, 4) + '" fill="' + fc + '"/>' +
        win(12, 34, 100) + T(62, 160, 13, fc) + '<path d="' + rr(44, 180, 36, 4, 2) + '" fill="' + fc + '" opacity=".5"/>');
      case 'stamp': {
        var bites = '', i;
        for (i = 0; i <= 12; i++) { bites += circle(i * 10.33, 0, 4.2) + circle(i * 10.33, 152, 4.2); }
        for (i = 0; i <= 14; i++) { bites += circle(0, i * 10.86, 4.2) + circle(124, i * 10.86, 4.2); }
        return out(124, 152, mask(124, 152, bites) + '<rect width="124" height="152" fill="' + fc + '"' + M + '/>' + '<rect x="9" y="9" width="106" height="134" fill="none" stroke="' + ik + '" stroke-opacity=".5" stroke-dasharray="2 3"/>' + win(12, 12, 100, 2) + T(62, 136, 13, ik));
      }
      case 'scanner':  return out(120, 146, '<path d="M3 24V10A7 7 0 0 1 10 3H24M96 3H110A7 7 0 0 1 117 10V24M117 96V110A7 7 0 0 1 110 117H96M24 117H10A7 7 0 0 1 3 110V96" fill="none" stroke="' + fc + '" stroke-width="5" stroke-linecap="round"/>' +
        win(10, 10, 100) + T(60, 140, 15, fc));
      case 'ribbon':   return out(140, 150, '<path d="' + rr(20, 0, 100, 106, 6) + '" fill="#fff" stroke="' + fc + '" stroke-width="2"/>' + win(20, 2, 100) +
        '<path d="M0 116H16V142H0L7 129Z M124 116H140L133 129L140 142H124Z" fill="' + dk + '"/><path d="M16 142L24 136V142ZM124 142L116 136V142Z" fill="' + shade(base, -.5) + '"/><rect x="12" y="110" width="116" height="26" rx="2" fill="' + fc + '"/>' + T(70, 128, 13, ik, '', 108));

      /* ----- Eten & drinken ----- */
      case 'coffee':   return out(132, 218, '<path d="' + rr(14, 2, 104, 14, 6) + '" fill="' + dk + '"/><path d="' + rr(6, 14, 120, 12, 6) + '" fill="' + fc + '"/>' +
        '<path d="M12 26H120L110 214Q109 218 105 218H27Q23 218 22 214Z" fill="' + fc + '"/><path d="M15.5 140H116.5L113.6 178H18.4Z" fill="' + dk + '"/>' + win(18, 34, 96) + T(66, 164, 13, ink(dk), '', 90));
      case 'chalkboard': return out(150, 176, '<path d="' + rr(0, 0, 150, 168, 8) + '" fill="#8b5a2b"/><path d="' + rr(8, 8, 134, 152, 4) + '" fill="' + fc + '"/>' +
        '<rect x="20" y="164" width="110" height="8" rx="3" fill="#6b4220"/>' + win(25, 16, 100, 2) + T(75, 148, 15, '#ffffff', ' opacity=".92"', 120));
      case 'cutlery':  return out(218, 196, '<circle cx="109" cy="82" r="80" fill="' + lt + '"/><circle cx="109" cy="82" r="80" fill="none" stroke="' + fc + '" stroke-width="3"/><circle cx="109" cy="82" r="72" fill="#fff"/>' + win(59, 32, 100) +
        '<path d="M8 12V44Q8 52 15 54V150Q15 156 19 156Q23 156 23 150V54Q30 52 30 44V12M15 12V40M23 12V40" fill="none" stroke="' + fc + '" stroke-width="3.5" stroke-linecap="round"/>' +
        '<path d="M200 12Q214 30 212 80H204V150Q204 156 200 156Q196 156 196 150V12Z" fill="' + fc + '"/>' + T(109, 188, 15, fc, '', 180));
      case 'noodles':  return out(140, 186, '<path d="M24 44Q70 -10 116 44" fill="none" stroke="#9aa0a6" stroke-width="3"/><path d="M0 44H140L120 182H20Z" fill="' + fc + '"/>' +
        '<path d="M0 44L18 20H70V44ZM140 44L122 20H70V44Z" fill="' + dk + '"/><path d="M70 20V44" stroke="' + shade(base, -.5) + '" stroke-width="1.5"/>' + win(20, 52, 100) + T(70, 172, 13, ik));
      case 'pizza':    return out(150, 156, '<path d="' + rr(0, 0, 150, 156, 6) + '" fill="' + fc + '"/><path d="' + rr(7, 7, 136, 142, 3) + '" fill="none" stroke="' + ik + '" stroke-opacity=".35" stroke-width="1.5"/>' +
        '<path d="M14 120L34 146L14 146Z" fill="#f2b33d"/><circle cx="20" cy="138" r="2.4" fill="#c0392b"/><circle cx="25" cy="143" r="2" fill="#c0392b"/>' + win(25, 14, 100) + T(80, 140, 14, ik));

      /* ----- Winkel & events ----- */
      case 'bag':      return out(130, 176, '<path d="M38 34Q38 4 65 4Q92 4 92 34" fill="none" stroke="' + dk + '" stroke-width="5" stroke-linecap="round"/><path d="' + rr(0, 28, 130, 148, 6) + '" fill="' + fc + '"/><rect x="0" y="28" width="130" height="10" fill="' + dk + '" opacity=".5"/>' +
        '<circle cx="38" cy="38" r="3" fill="' + shade(base, -.5) + '"/><circle cx="92" cy="38" r="3" fill="' + shade(base, -.5) + '"/>' + win(15, 46, 100) + T(65, 164, 13, ik));
      case 'gift':     return out(136, 198, '<path d="M68 38C50 8 26 14 34 28C40 38 60 38 68 38C76 38 96 38 102 28C110 14 86 8 68 38Z" fill="' + lt + '" stroke="' + dk + '" stroke-width="2.5"/>' +
        '<path d="' + rr(6, 62, 124, 136, 4) + '" fill="' + fc + '"/><path d="' + rr(0, 38, 136, 28, 4) + '" fill="' + dk + '"/><rect x="60" y="38" width="16" height="28" fill="' + lt + '"/>' + win(18, 72, 100) + T(68, 190, 13, ik));
      case 'pricetag': return out(156, 132, mask(156, 132, circle(24, 66, 6.5)) + '<path d="M40 0H150Q156 0 156 6V126Q156 132 150 132H40L0 66Z" fill="' + fc + '"' + M + '/>' +
        win(50, 6, 98, 3) + '<path d="M24 66C10 40 -2 30 8 6" fill="none" stroke="#9aa0a6" stroke-width="2"/>' + T(99, 124, 11, ik, '', 96));
      case 'envelope': return out(150, 172, '<path d="' + rr(20, 0, 110, 122, 4) + '" fill="#fff" stroke="#d9dde3"/>' + win(25, 5, 100, 2) +
        '<path d="' + rr(0, 72, 150, 100, 6) + '" fill="' + dk + '"/><path d="M0 92L75 142L150 92V166Q150 172 144 172H6Q0 172 0 166Z" fill="' + fc + '"/>' + T(75, 162, 13, ik));
      case 'calendar': return out(136, 172, '<path d="' + rr(0, 12, 136, 160, 10) + '" fill="#fff" stroke="#d9dde3"/><path d="' + rr(0, 12, 136, 38, [10, 10, 0, 0]) + '" fill="' + fc + '"/>' +
        '<path d="' + rr(32, 0, 9, 24, 4.5) + rr(95, 0, 9, 24, 4.5) + '" fill="' + dk + '"/>' + T(68, 37, 13, ik) + win(18, 60, 100));
      case 'receipt': {
        var zz = 'M0 0H124V170'; for (var z = 0; z < 124; z += 8) zz += 'L' + (124 - z - 4) + ' 178L' + (124 - z - 8) + ' 170';
        return out(124, 180, '<path d="' + zz + 'Z" fill="#fff" stroke="#d9dde3"/><rect width="124" height="8" fill="' + fc + '"/>' + win(12, 16, 100) +
          '<path d="M12 126H112" stroke="#b8bec7" stroke-dasharray="3 3"/>' + T(62, 146, 13, fc) + '<path d="M28 158H96M40 165H84" stroke="#d9dde3" stroke-width="3" stroke-linecap="round"/>');
      }

      /* ----- Feestdagen ----- */
      case 'heart':    return out(205, 212, '<circle cx="60" cy="60" r="60" fill="' + fc + '"/><circle cx="145" cy="60" r="60" fill="' + fc + '"/><path d="M102.5 187.5L17.5 102.5L102.5 17.5L187.5 102.5Z" fill="' + fc + '"/>' + win(52.5, 32.5, 100, 6) + T(102.5, 207, 15, fc, '', 170));
      case 'ornament': return out(160, 200, '<circle cx="80" cy="5" r="4.5" fill="none" stroke="#b08d2b" stroke-width="2"/><path d="' + rr(64, 9, 32, 16, 3) + '" fill="#d4a72c"/>' +
        '<circle cx="80" cy="102" r="78" fill="' + fc + '"/><path d="M14 72Q80 92 146 72M10 128Q80 150 150 128" fill="none" stroke="' + lt + '" stroke-width="4" opacity=".5"/>' + win(32, 54, 96, 6) + T(80, 196, 14, fc, '', 150));
      case 'balloons': return out(152, 186, '<path d="M108 52Q112 70 104 92M130 64Q128 80 116 96M92 40Q98 70 96 94" fill="none" stroke="#9aa0a6" stroke-width="1.5"/>' +
        '<ellipse cx="92" cy="22" rx="14" ry="18" fill="#ec4899"/><ellipse cx="132" cy="44" rx="14" ry="18" fill="#f59e0b"/><ellipse cx="110" cy="34" rx="15" ry="19" fill="' + fc + '"/>' +
        '<path d="' + rr(2, 58, 122, 126, 10) + '" fill="#fff" stroke="' + fc + '" stroke-width="3"/>' + win(13, 62, 100) + T(63, 176, 13, fc));
      case 'confetti': {
        var cols = [base, '#f59e0b', '#10b981', '#3b82f6', '#ec4899'], pts = [[6, 10], [24, 4], [60, 6], [98, 3], [130, 9], [134, 40], [131, 78], [136, 112], [6, 44], [3, 84], [8, 118], [118, 132], [22, 134]], bits = '';
        pts.forEach(function (p, i) { var col = cols[i % 5]; bits += i % 3 === 0 ? '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="' + col + '"/>' : i % 3 === 1 ? '<rect x="' + p[0] + '" y="' + p[1] + '" width="7" height="3" rx="1" fill="' + col + '" transform="rotate(' + (i * 37 % 90) + ' ' + p[0] + ' ' + p[1] + ')"/>' : '<path d="M' + p[0] + ' ' + p[1] + 'l4 6h-8z" fill="' + col + '"/>'; });
        return out(140, 166, bits + '<path d="' + rr(16, 16, 108, 108, 8) + '" fill="#fff" stroke="' + fc + '" stroke-width="3"/>' + win(20, 20, 100) + T(70, 152, 15, fc));
      }
      case 'pumpkin':  return out(170, 194, '<path d="M84 26Q80 10 92 4" fill="none" stroke="#4d7c0f" stroke-width="7" stroke-linecap="round"/>' +
        '<ellipse cx="50" cy="100" rx="46" ry="68" fill="' + dk + '"/><ellipse cx="120" cy="100" rx="46" ry="68" fill="' + dk + '"/><ellipse cx="85" cy="98" rx="62" ry="72" fill="' + fc + '"/>' + win(37, 50, 96, 8) + T(85, 190, 14, fc, '', 160));

      /* ----- Overig ----- */
      case 'pin':      return out(160, 246, '<ellipse cx="80" cy="222" rx="26" ry="5" fill="#000" opacity=".12"/><path d="M80 220C68 194 8 150 8 80A72 72 0 0 1 152 80C152 150 92 194 80 220Z" fill="' + fc + '"/><circle cx="80" cy="80" r="70" fill="#fff"/>' + win(32, 32, 96, 4) + T(80, 242, 14, fc, '', 150));
      case 'laptop':   return out(184, 152, '<path d="' + rr(22, 0, 140, 116, 8) + '" fill="' + fc + '"/><path d="' + rr(29, 7, 126, 102, 3) + '" fill="#fff"/>' + win(43, 9, 98, 2) +
        '<path d="M0 118H184L174 132Q172 134 168 134H16Q12 134 10 132Z" fill="' + dk + '"/>' + T(92, 150, 13, fc, '', 170));
      case 'hanger':   return out(120, 212, mask(120, 212, circle(60, 30, 18) + rr(54, 44, 12, 14, 6)) + '<path d="' + rr(0, 0, 120, 212, 14) + '" fill="' + fc + '"' + M + '/>' + win(10, 66, 100) + T(60, 194, 14, ik));
      case 'box':      return out(150, 164, '<path d="' + rr(0, 10, 150, 154, 4) + '" fill="' + fc + '"/><rect x="58" y="10" width="34" height="154" fill="' + lt + '" opacity=".35"/><path d="M0 10L12 0H138L150 10Z" fill="' + dk + '"/>' +
        '<path d="M14 150V140M10 144L14 140L18 144M136 150V140M132 144L136 140L140 144" fill="none" stroke="' + ik + '" stroke-width="1.6" stroke-linecap="round"/>' + win(25, 24, 100) + T(75, 152, 13, ik));

      default: return { w: S, h: S, body: code.body };
    }
  }

  /* ---------- Publiek ---------- */
  function svg(data, design, opts) {
    opts = opts || {};
    var d = Object.assign({}, QR_DEFAULT_DESIGN, design);
    var ec = d.logo ? 'H' : (d.pattern !== 'square' || d.cornerInner !== 'square' ? 'Q' : 'M');
    var qr = matrix(data, ec);
    if (!qr) return '<div class="qr-fallback">QR</div>';
    var id = 'q' + (++uid), code = codeGroup(qr, d, id); code.id = id;
    var fr = framed(code, d, opts.fontScale);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + f(fr.w) + ' ' + f(fr.h) + '"' + (opts.width ? ' width="' + opts.width + '" height="' + Math.round(opts.width * fr.h / fr.w) + '"' : '') +
      ' role="img"' + (opts.label ? ' aria-label="' + escText(opts.label) + '"' : ' aria-hidden="true"') + '><defs>' + code.defs + '</defs>' + fr.body + '</svg>';
  }

  // Kleine voorbeeldjes voor de keuzetegels
  function swatch(kind, value, d) {
    d = Object.assign({}, QR_DEFAULT_DESIGN, d);
    var body = '', fill = d.color, vb = '0 0 7 7';
    if (kind === 'pattern') {
      var grid = ['1101', '0111', '1100', '1011'];
      var dark = function (r, c) { return r >= 0 && c >= 0 && r < 4 && c < 4 && grid[r][c] === '1'; };
      grid.forEach(function (row, r) { for (var c = 0; c < 4; c++) if (row[c] === '1') body += moduleShape(value, c, r, dark); });
      return '<svg viewBox="-.25 -.25 4.5 4.5" aria-hidden="true"><path d="' + body + '" fill="' + fill + '"/></svg>';
    }
    if (kind === 'cornerOuter') return '<svg viewBox="-.3 -.3 7.6 7.6" aria-hidden="true"><path d="' + outerShape(value, 0, 0, 0) + '" fill="' + fill + '" fill-rule="evenodd"/></svg>';
    if (kind === 'cornerInner') return '<svg viewBox="-.6 -.6 4.2 4.2" aria-hidden="true"><path d="' + innerShape(value, 0, 0, 0) + '" fill="' + fill + '"/></svg>';
    return '';
  }

  // Leesbaarheid: contrast, omgekeerde kleuren, transparant, speciale vormen
  function check(design) {
    var d = Object.assign({}, QR_DEFAULT_DESIGN, design), notes = [], level = 'ok';
    var bg = d.transparent ? '#ffffff' : d.background;
    var codeColors = [d.color].concat(d.gradient ? [d.color2] : []).concat(d.cornerColor ? [d.cornerColor] : []).concat(d.cornerInnerColor ? [d.cornerInnerColor] : []);
    var worst = Math.min.apply(null, codeColors.map(function (c) { return contrastRatio(c, bg); }));
    if (worst < 2.5) { level = 'bad'; notes.push('dz.check.low'); }
    else if (worst < 4) { level = 'warn'; notes.push('dz.check.low'); }
    if (codeColors.some(function (c) { return luminance(c) > luminance(bg); })) { level = 'bad'; notes.push('dz.check.inverted'); }
    if (d.transparent) { if (level === 'ok') level = 'warn'; notes.push('dz.check.transparent'); }
    if (['heart', 'star', 'diamond'].indexOf(d.pattern) >= 0 || ['heart', 'star'].indexOf(d.cornerInner) >= 0) { if (level === 'ok') level = 'warn'; notes.push('dz.check.fancy'); }
    return { level: level, notes: notes.length ? notes : ['design.contrastOk'] };
  }

  return { svg: svg, swatch: swatch, check: check };
})();
