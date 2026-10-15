/* =========================================================
   QR-CODE HULPMIDDELEN (gedeeld door Mijn QR-codes en het beheer)
   Naam van een code, de QR-afbeelding (met het eigen ontwerp) en downloaden als PNG/SVG.
   ========================================================= */
// In het beheer zijn content-fields.js en EmailCheck er niet: dan een kleine versie
var FILES = window.FILES || { parse: function (v) { try { var o = JSON.parse(v); return o && o.n ? o : null; } catch (e) { return null; } }, list: function (v) { try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } }, local: {} };
var EmailCheck = window.EmailCheck || { valid: function (v) { return /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/.test(String(v || '')); } };

var CodeUtil = (function () {
  // Vaste codes (wifi, vCard) hebben geen link: de inhoud zit in de code zelf. Die tellen geen scans en kunnen niet uit.
  function isStatic(r) { var tp = getType(r.typeId); return !!tp && (tp.contentType === 'wifi' || tp.contentType === 'contact'); }
  function domainOf(u) { return String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]; }
  // Naam: zelf gekozen, anders iets herkenbaars uit de inhoud, anders het type
  function displayName(r) {
    if (r.name) return r.name;
    var c = r.content || {};
    var v = c.title || c.name || c.pageName || c.restaurant || c.appName || c.company || c.ssid || (c.username ? '@' + c.username.replace(/^@/, '') : '') || domainOf(c.url) || domainOf(c.menuUrl) || ((FILES.parse(c.menuFile) || FILES.parse(c.file) || {}).n) || '';
    return v || typeName(getType(r.typeId));
  }
  function qrData(r) { return encodeQR({ typeId: r.typeId, content: (function () { var o = {}; o[r.typeId] = r.content || {}; return o; })(), saved: isStatic(r) ? null : r, draftId: r.id }); }
  function qrDesign(r) { var d = Object.assign({}, QR_DEFAULT_DESIGN, r.design); delete d.pageColor; delete d.accentColor; return safeDesign(d); }
  function qrSvg(r, opts) { return QRRender.svg(qrData(r), qrDesign(r), opts); }
  function fileName(r) { return 'qr-' + (displayName(r).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || r.typeId); }
  /* ---------- Downloaden: PNG, JPG, WebP, SVG, PDF (A4, om af te drukken) in verschillende maten ---------- */
  var FORMATS = ['png', 'jpg', 'webp', 'svg', 'pdf'];
  var SIZES = [512, 1024, 2048, 4096];
  function raster(r, size, type) {
    return new Promise(function (ok, bad) {
      var markup = qrSvg(r, { width: size }), img = new Image(), url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
      img.onload = function () {
        var cv = document.createElement('canvas'); cv.width = img.width || size; cv.height = img.height || size;
        var cx = cv.getContext('2d'); if (type !== 'image/png' || !(r.design || {}).transparent) { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height); }
        cx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? ok({ blob: b, w: cv.width, h: cv.height }) : bad(new Error('canvas')); }, type, .95);
      };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error('image')); };
      img.src = url;
    });
  }
  // Eenvoudige PDF (A4) met de QR-code gecentreerd (12 cm) en de naam erboven; geen extra bibliotheek nodig
  function pdfFrom(jpeg, w, h, title) {
    return jpeg.arrayBuffer().then(function (buf) {
      var img = new Uint8Array(buf), enc = new TextEncoder(), parts = [], offs = [], len = 0;
      var latin = String(title || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/([()\\])/g, '\\$1').slice(0, 70);
      function push(x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; }
      function obj(n, body) { offs[n] = len; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); }
      var S = 340, X = (595 - S) / 2, Y = (842 - S) / 2;
      var content = 'q ' + S + ' 0 0 ' + S + ' ' + X + ' ' + Y + ' cm /Im0 Do Q' + (latin ? ' BT /F1 16 Tf ' + X + ' ' + (Y + S + 28) + ' Td (' + latin + ') Tj ET' : '');
      push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
      obj(1, function () { push('<< /Type /Catalog /Pages 2 0 R >>'); });
      obj(2, function () { push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); });
      obj(3, function () { push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> /Font << /F1 6 0 R >> >> /Contents 5 0 R >>'); });
      obj(4, function () { push('<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.length + ' >>\nstream\n'); push(img); push('\nendstream'); });
      obj(5, function () { push('<< /Length ' + enc.encode(content).length + ' >>\nstream\n' + content + '\nendstream'); });
      obj(6, function () { push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); });
      var xref = len, tbl = 'xref\n0 7\n0000000000 65535 f \n';
      for (var i = 1; i <= 6; i++) tbl += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
      push(tbl + 'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
      return new Blob(parts, { type: 'application/pdf' });
    });
  }
  /** Bestand van één code maken: { blob, name } */
  function render(r, format, size) {
    format = FORMATS.indexOf(format) >= 0 ? format : 'png'; size = SIZES.indexOf(+size) >= 0 ? +size : 1024;
    var name = fileName(r);
    if (format === 'svg') return Promise.resolve({ blob: new Blob([qrSvg(r, { width: size })], { type: 'image/svg+xml' }), name: name + '.svg' });
    if (format === 'pdf') return raster(r, Math.max(size, 2048), 'image/jpeg').then(function (x) { return pdfFrom(x.blob, x.w, x.h, displayName(r)); }).then(function (b) { return { blob: b, name: name + '.pdf' }; });
    var type = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[format];
    return raster(r, size, type).then(function (x) { return { blob: x.blob, name: name + '.' + format }; });
  }
  function download(r, format, size) { return render(r, format, size).then(function (f) { saveFile(f.blob, f.name); }); }

  /* ZIP (zonder compressie) voor meerdere codes tegelijk */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(files) {
    return Promise.all(files.map(function (f) { return f.blob.arrayBuffer().then(function (a) { return { name: f.name, data: new Uint8Array(a) }; }); })).then(function (list) {
      var enc = new TextEncoder(), parts = [], central = [], off = 0, used = {};
      list.forEach(function (f) {
        var nm = f.name, k = 2; while (used[nm]) nm = f.name.replace(/(\.\w+)$/, '-' + (k++) + '$1'); used[nm] = 1;
        var name = enc.encode(nm), crc = crc32(f.data), sz = f.data.length;
        var h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, name.length, true);
        var c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
        parts.push(new Uint8Array(h.buffer), name, f.data); central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + sz;
      });
      var cs = central.reduce(function (a, b) { return a + b.length; }, 0), e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054b50, true); e.setUint16(8, list.length, true); e.setUint16(10, list.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
      return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
    });
  }
  /** Meerdere codes in één ZIP */
  function downloadMany(list, format, size, zipName) {
    return list.reduce(function (p, r) { return p.then(function (acc) { return render(r, format, size).then(function (f) { acc.push(f); return acc; }); }); }, Promise.resolve([]))
      .then(zip).then(function (b) { saveFile(b, (zipName || 'qr-codes') + '.zip'); });
  }
  /* Tegel-iconen (Overzicht, Statistieken, Dashboard): zonder vakje, met animatie bij aanwijzen (.hx-* in app.css) */
  var TILE = {
    folder: '<path class="hx-back" d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2.2h8.7A1.5 1.5 0 0 1 21 8.7V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/><path class="hx-front" d="M3 10.2h18V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>',
    qrscan: '<path d="M3.5 8V5A1.5 1.5 0 0 1 5 3.5h3M16 3.5h3A1.5 1.5 0 0 1 20.5 5v3M20.5 16v3a1.5 1.5 0 0 1-1.5 1.5h-3M8 20.5H5A1.5 1.5 0 0 1 3.5 19v-3"/><rect x="7" y="7" width="4" height="4" rx=".6"/><rect x="13" y="7" width="4" height="4" rx=".6"/><rect x="7" y="13" width="4" height="4" rx=".6"/><path d="M13.5 13.5h1.5v1.5h-1.5zM16 16h1v1h-1zM13.5 16.5h.5"/><line class="hx-line" x1="2.5" x2="21.5" y1="12" y2="12"/>',
    frame: '<path d="M3.5 8V5A1.5 1.5 0 0 1 5 3.5h3M16 3.5h3A1.5 1.5 0 0 1 20.5 5v3M20.5 16v3a1.5 1.5 0 0 1-1.5 1.5h-3M8 20.5H5A1.5 1.5 0 0 1 3.5 19v-3"/><rect class="hx-box" x="7.5" y="7" width="9" height="8" rx="1"/><path class="hx-base" d="M5 18h14"/>',
    sun: '<circle class="hx-core" cx="12" cy="12" r="3.6"/><g class="hx-rays"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g>',
    star: '<path class="hx-star" d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    users: '<g class="hx-p1"><circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.5c.9-3.4 3.3-5.3 6.2-5.3s5.3 1.9 6.2 5.3"/></g><g class="hx-p2"><circle cx="16.8" cy="9" r="2.6"/><path d="M16.6 14.3c2.3.2 4 1.9 4.6 4.6"/></g>'
  };
  function tileIcon(k) { return '<svg class="hm-i hx" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (TILE[k] || '') + '</svg>'; }
  return { isStatic: isStatic, displayName: displayName, qrData: qrData, qrDesign: qrDesign, qrSvg: qrSvg, download: download, downloadMany: downloadMany, render: render, formats: FORMATS, sizes: SIZES, tileIcon: tileIcon };
})();
