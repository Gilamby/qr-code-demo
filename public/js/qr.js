/* =========================================================
   DOMEIN: inhoud invullen, QR-data opbouwen, contrast meten
   ========================================================= */
function resolveSample(s) { return s && typeof s === 'object' ? t(s.t) : (s || ''); }
function resolvedContent(state) {
  var type = getType(state.typeId), entered = state.content[state.typeId] || {}, out = {};
  type.fields.forEach(function (f) { var v = entered[f.key]; out[f.key] = (v != null && String(v).trim() !== '') ? String(v).trim() : resolveSample(f.sample); });
  return out;
}
function shortLink(id) { return QR_BASE + '/q/' + id; }
function encodeQR(state) {
  var c = resolvedContent(state), id = state.typeId;
  var esc = function (v) { return String(v).replace(/([\\;,:"])/g, '\\$1'); };
  switch (getType(id).contentType) {
    case 'wifi': return 'WIFI:T:' + c.security + ';S:' + esc(c.ssid) + ';P:' + esc(c.password) + ';;';
    case 'contact': return ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + c.name, 'TITLE:' + c.role, 'TEL:' + c.phone, 'EMAIL:' + c.email, 'END:VCARD'].join('\n');
    // Dynamisch: elke QR-code krijgt een eigen korte link (uniek, telt scans, inhoud later aan te passen).
    // Het id wordt vooraf gereserveerd, dus wat je in de preview ziet is precies de code die je krijgt.
    default: return state.saved ? state.saved.shortUrl : shortLink(state.draftId);
  }
}
function contrastRatio(a, b) {
  function lum(hex) { var n = parseInt(hex.slice(1), 16), rgb = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; }
  var A = lum(a), B = lum(b); return (Math.max(A, B) + .05) / (Math.min(A, B) + .05);
}
function luminance(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].reduce(function (s, v, i) { v /= 255; v = v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); return s + v * [.2126, .7152, .0722][i]; }, 0); }
