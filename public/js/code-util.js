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
  return { isStatic: isStatic, displayName: displayName, qrData: qrData, qrDesign: qrDesign, qrSvg: qrSvg, download: download };
})();
