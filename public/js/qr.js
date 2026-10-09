/* =========================================================
   DOMEIN: inhoud invullen, QR-data opbouwen, contrast meten
   ========================================================= */
function resolveSample(s) { return s && typeof s === 'object' ? t(s.t) : (s || ''); }
function resolvedContent(state) {
  var type = getType(state.typeId), entered = state.content[state.typeId] || {}, out = {};
  type.fields.forEach(function (f) { var v = entered[f.key]; out[f.key] = (v != null && String(v).trim() !== '') ? String(v).trim() : resolveSample(f.sample); });
  return out;
}
// Wat de klant echt invulde. Lege velden blijven leeg (alleen keuzelijsten krijgen hun standaardwaarde),
// zodat er nooit voorbeeldtekst in een vaste QR-code (vCard, wifi) terechtkomt.
function enteredContent(state) {
  var type = getType(state.typeId), entered = state.content[state.typeId] || {}, out = {};
  type.fields.forEach(function (f) { var v = entered[f.key]; out[f.key] = (v != null && String(v).trim() !== '') ? String(v).trim() : (f.type === 'select' ? resolveSample(f.sample) : ''); });
  return out;
}
function shortLink(id) { return QR_BASE + '/q/' + id; }
function encodeQR(state) {
  var c = enteredContent(state), id = state.typeId;
  var esc = function (v) { return String(v).replace(/([\\;,:"])/g, '\\$1'); };
  switch (getType(id).contentType) {
    case 'wifi': {
      var sec = c.password ? c.security : 'nopass';
      return 'WIFI:T:' + sec + ';S:' + esc(c.ssid) + ';' + (sec === 'nopass' ? '' : 'P:' + esc(c.password) + ';') + ';';
    }
    case 'contact': {
      // vCard 3.0: alleen regels die ingevuld zijn
      var ve = function (v) { return String(v).replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n'); };
      var addr = c.address; try { var a = JSON.parse(c.address); if (a && a.l) addr = a.l; } catch (e) {}
      var parts = (c.name || '').trim().split(/\s+/), last = parts.length > 1 ? parts.pop() : '', first = parts.join(' ');
      var lines = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + ve(last) + ';' + ve(first) + ';;;', 'FN:' + ve(c.name || '')];
      if (c.company) lines.push('ORG:' + ve(c.company));
      if (c.role) lines.push('TITLE:' + ve(c.role));
      if (c.phone) lines.push('TEL;TYPE=CELL:' + c.phone.replace(/[^+0-9]/g, ''));
      if (c.email) lines.push('EMAIL:' + c.email);
      if (c.website) lines.push('URL:' + c.website);
      if (addr) lines.push('ADR:;;' + ve(addr) + ';;;;');
      lines.push('END:VCARD');
      return lines.join('\n');
    }
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
