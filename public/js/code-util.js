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
  function download(r, format) {
    var markup = qrSvg(r, { width: 1024 }), name = fileName(r);
    if (format === 'svg') return saveFile(new Blob([markup], { type: 'image/svg+xml' }), name + '.svg');
    var img = new Image(), url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      var cx = cv.getContext('2d'); if (!(r.design || {}).transparent) { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height); }
      cx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      cv.toBlob(function (b) { saveFile(b, name + '.png'); }, 'image/png');
    };
    img.src = url;
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
  return { isStatic: isStatic, displayName: displayName, qrData: qrData, qrDesign: qrDesign, qrSvg: qrSvg, download: download, tileIcon: tileIcon };
})();
