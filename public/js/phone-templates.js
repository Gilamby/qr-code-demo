/* =========================================================
   TELEFOON-SJABLONEN: per type een echt scherm.
   - Stap 1 (voorbeeld): ex = true, alle velden gevuld met voorbeeldwaarden.
   - Stap 2/3: alleen wat de gebruiker invult; lege velden = grijze balkjes.
   Nog geen sjabloon voor een type? Dan valt de preview terug op de oude kaart.
   ========================================================= */
/* Adres-onderdeel leesbaar maken (%20 -> spatie); kapotte codes laten we gewoon staan */
function decodeURIComponentSafe(x) { try { return decodeURIComponent(x); } catch (e) { return x; } }
var PHONE = (function () {
  var I = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    video: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 11l6-3v8l-6-3"/>',
    call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    dots: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    user: '<circle cx="12" cy="9" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    clip: '<path d="M20 11l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 17a2 2 0 0 1-3-3l7.5-7.5"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    store: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M10 20v-5h4v5"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
    grid: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>',
    reel: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M4 9h16M9 4l3 5M14 4l3 5M10.5 12.5v4l3.5-2z"/>',
    tag: '<rect x="4" y="5" width="16" height="15" rx="3"/><circle cx="12" cy="11" r="2.5"/><path d="M8 18c.8-2 2.2-3 4-3s3.2 1 4 3"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
    plus: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M12 8.5v7M8.5 12h7"/>',
    addp: '<circle cx="10" cy="9" r="3.5"/><path d="M3.5 19c1-3 3.4-4.5 6.5-4.5M18 12v6M15 15h6"/>',
    check: '<path d="M7 12.5l3.2 3L17 9"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    aa: '<path d="M3 18l4-11 4 11M4.5 14h5M14 18l3-8 3 8M15 15.5h4"/>',
    reload: '<path d="M19 12a7 7 0 1 1-2-5M19 4v4h-4"/>',
    fwd: '<path d="M9 5l7 7-7 7"/>',
    book: '<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13.5"/>',
    tabs: '<rect x="4" y="7" width="12" height="12" rx="2"/><path d="M8 4h10a2 2 0 0 1 2 2v10"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 15.8a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r="1"/>',
    flash: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    save: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    prev: '<path d="M18 6v12L9 12zM6 6v12"/>',
    next: '<path d="M6 6v12l9-6zM18 6v12"/>',
    like: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H18a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/>',
    chat: '<path d="M4 18.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8z"/>',
    note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" stroke="none"/>',
    img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
    gift: '<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1s3 1 5 1zM12 7c1.5-3 5-3.5 5-1s-3 1-5 1z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    keypad: '<circle cx="6" cy="5" r="1.2"/><circle cx="12" cy="5" r="1.2"/><circle cx="18" cy="5" r="1.2"/><circle cx="6" cy="11" r="1.2"/><circle cx="12" cy="11" r="1.2"/><circle cx="18" cy="11" r="1.2"/><circle cx="6" cy="17" r="1.2"/><circle cx="12" cy="17" r="1.2"/><circle cx="18" cy="17" r="1.2"/>',
    spk: '<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'
  };
  function ic(k, cls) { return '<svg class="' + (cls || 'i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + I[k] + '</svg>'; }
  // Waarde of grijs balkje
  function v(val, w) { return val ? esc(val) : '<i class="sk" style="width:' + (w || '60%') + '"></i>'; }
  /* ---------- Echte tijd ----------
     De klok van het apparaat (dus de tijdzone van de bezoeker). Engels: 12-uurs zonder AM/PM, zoals op een iPhone; andere talen 24-uurs.
     data-clock="-3" = 3 minuten geleden; wordt elke minuut bijgewerkt (zie tick onderaan). */
  function clock(offsetMin) {
    var d = new Date(Date.now() + (offsetMin || 0) * 60000), h = d.getHours(), m = ('0' + d.getMinutes()).slice(-2);
    if (i18n.lang() === 'en') h = h % 12 || 12;
    return h + ':' + m;
  }
  function liveClock(offsetMin) { return '<span data-clock="' + (offsetMin || 0) + '">' + clock(offsetMin) + '</span>'; }

  function statusBar(light) {
    return '<div class="sb' + (light ? ' light' : '') + '"><b>' + liveClock(0) + '</b><span>' +
      '<svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx=".6"/><rect x="5" y="5.5" width="3" height="6.5" rx=".6"/><rect x="10" y="3" width="3" height="9" rx=".6"/><rect x="15" y="0" width="3" height="12" rx=".6"/></svg>' +
      '<svg viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 0 0 8 .4 10.6 10.6 0 0 0 .5 3.4l1.3 1.3A8.7 8.7 0 0 1 8 2.2zm0 3.6c1.4 0 2.7.5 3.7 1.5l1.3-1.3A7 7 0 0 0 8 4 7 7 0 0 0 3 6l1.3 1.3c1-1 2.3-1.5 3.7-1.5zM8 9.4l2.1-2.1a3 3 0 0 0-4.2 0z"/></svg>' +
      '<i class="bat"><i></i></i></span></div>';
  }

  // Zachte kleurvlakken (zoals een iPhone-achtergrond) als voorbeeldfoto's
  var MESH = [['#ff9a8b', '#ff6a88', '#ffd194', '#7f53ac'], ['#4facfe', '#00f2fe', '#1e3c72', '#a1c4fd'], ['#a8e063', '#56ab2f', '#134e5e', '#fceabb'],
    ['#c471f5', '#fa71cd', '#7f53ac', '#ffd6e8'], ['#f6d365', '#fda085', '#e94e77', '#fff1c1'], ['#89f7fe', '#66a6ff', '#c2e9fb', '#3a1c71'], ['#fbc2eb', '#a6c1ee', '#f68084', '#ffffff']];
  function mesh(i) {
    var m = MESH[i % MESH.length];
    return 'background:radial-gradient(at 18% 22%,' + m[0] + ' 0,transparent 55%),radial-gradient(at 82% 18%,' + m[1] + ' 0,transparent 50%),radial-gradient(at 70% 85%,' + m[2] + ' 0,transparent 55%),radial-gradient(at 20% 90%,' + m[3] + ' 0,transparent 50%),' + m[1];
  }
  // Eerste letter van het eerste en het laatste woord ("Panadería El Molino" -> PM, "Chef Ruben" -> CR)
  function initials(name) { var w = (name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean); if (!w.length) return ''; return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); }
  // Voorbeeldfoto van het type (public/assets/previews/<id>.jpg), alleen in de voorbeeldweergave van stap 1.
  // Pas als álle foto's van dit voorbeeld klaar zijn, tonen we de fotoversie (anders even grijze vlakken).
  // Voorbeeldbedrijf van de extra soorten (pagina 2): een café in Marbella, past bij de voorbeeldfoto's
  var EX_BIZ = 'Café Lumen', EX_ADDR = 'Calle Ancha 12, 29601 Marbella';
  var EX_EXTRA = { instagram: ['ig/1', 'ig/2', 'ig/3', 'ig/4', 'ig/5', 'ig/6', 'ig/7', 'ig/8', 'ig/h1', 'ig/h2', 'ig/h3', 'ig/h4', 'ig/h5'], links: ['links-cover', 'links-feat'], facebook: ['facebook-cover', 'facebook-post'], social: ['social-avatar'] };
  function exPhoto(id, ex) {
    var tp = ex && getType(id), src = tp && tp.previewImage; if (!src || !imageReady(src)) return '';
    return (EX_EXTRA[id] || []).every(function (n) { return imageReady('assets/previews/' + n + '.jpg'); }) ? asset(src) : '';
  }
  function domain(url) { return (url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]; }

  // Mockup-foto zolang het bedrijf nog geen eigen foto heeft: een winkelpui in de paginakleur.
  function storefront(name) {
    var label = esc((name || EX_BIZ).slice(0, 22));
    return '<svg class="bz-mock" viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="bzSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6f7"/><stop offset="1" stop-color="#eef6fb"/></linearGradient>' +
      '<linearGradient id="bzWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7b3"/><stop offset="1" stop-color="#f5b75a"/></linearGradient>' +
      '<pattern id="bzStripe" width="24" height="10" patternUnits="userSpaceOnUse"><rect width="12" height="10" style="fill:var(--pc)"/><rect x="12" width="12" height="10" fill="#fff"/></pattern></defs>' +
      '<rect width="320" height="150" fill="url(#bzSky)"/>' +
      '<rect x="0" y="0" width="38" height="150" fill="#d9cbb8"/><rect x="282" y="0" width="38" height="150" fill="#cdbca6"/>' +
      '<rect x="38" y="6" width="244" height="144" fill="#f3ead9"/><rect x="38" y="6" width="244" height="8" fill="#e4d7c2"/>' +
      '<rect x="78" y="18" width="164" height="22" rx="4" fill="#2b2b2b"/>' +
      '<text x="160" y="33.5" text-anchor="middle" font-family="Georgia, serif" font-size="12" font-weight="700" fill="#f6e3b4" letter-spacing="1.5">' + label.toUpperCase() + '</text>' +
      '<rect x="46" y="46" width="228" height="16" fill="url(#bzStripe)"/>' +
      '<path d="M46 61' + new Array(20).join(' q6 9 12 0') + 'V61z" fill="url(#bzStripe)"/>' +
      '<rect x="56" y="78" width="120" height="60" rx="3" fill="url(#bzWin)" stroke="#5a4636" stroke-width="4"/>' +
      '<path d="M116 78v60M56 106h120" stroke="#5a4636" stroke-width="3"/>' +
      '<circle cx="80" cy="96" r="6" fill="#fff7e0" opacity=".9"/><circle cx="146" cy="93" r="5" fill="#fff7e0" opacity=".9"/>' +
      '<rect x="66" y="120" width="22" height="13" rx="2" fill="#c47b3c"/><rect x="134" y="121" width="30" height="12" rx="2" fill="#8c5a33"/>' +
      '<rect x="196" y="74" width="62" height="76" rx="3" fill="#4b3a2c"/><rect x="202" y="80" width="50" height="38" rx="2" fill="url(#bzWin)"/>' +
      '<circle cx="246" cy="124" r="2.5" fill="#e9c46a"/>' +
      '<rect x="38" y="140" width="244" height="10" fill="#bfae97"/>' +
      '<rect x="182" y="124" width="12" height="16" rx="2" fill="#7a5236"/><circle cx="188" cy="118" r="10" fill="#4f8a4b"/><circle cx="183" cy="113" r="6" fill="#5fa057"/>' +
      '<rect x="262" y="124" width="12" height="16" rx="2" fill="#7a5236"/><circle cx="268" cy="118" r="10" fill="#4f8a4b"/><circle cx="273" cy="113" r="6" fill="#5fa057"/>' +
    '</svg>';
  }

  // Fotogalerij: items { r: hoogte/breedte, html } over n kolommen, telkens in de kortste kolom
  window.GALLERY = {
    columns: function (items, n) {
      var h = [], out = [];
      for (var i = 0; i < n; i++) { h.push(0); out.push([]); }
      items.forEach(function (it) { var k = h.indexOf(Math.min.apply(null, h)); out[k].push(it.html); h[k] += it.r + 0.02; });
      return out.map(function (col) { return '<div class="gx-col">' + col.join('') + '</div>'; }).join('');
    }
  };

  // Streepjescode Code 128 (set B: gewone letters, cijfers en tekens) als SVG. Lukt het niet (bv. é), dan null -> QR-code.
  window.BARCODE = (function () {
    var W = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
    function svg(text) {
      text = String(text || ''); if (!text || text.length > 40 || /[^\x20-\x7e]/.test(text)) return '';
      var codes = [104], sum = 104;
      for (var i = 0; i < text.length; i++) { var v = text.charCodeAt(i) - 32; codes.push(v); sum += v * (i + 1); }
      codes.push(sum % 103); codes.push(106);
      var x = 10, bars = '';
      codes.forEach(function (c) { W[c].split('').forEach(function (w, k) { w = +w; if (k % 2 === 0) bars += '<rect x="' + x + '" y="0" width="' + w + '" height="60"/>'; x += w; }); });
      return '<svg viewBox="0 0 ' + (x + 10) + ' 60" preserveAspectRatio="none" role="img" aria-label="' + esc(text) + '"><rect width="' + (x + 10) + '" height="60" fill="#fff"/><g fill="#000">' + bars + '</g></svg>';
    }
    return { svg: svg };
  })();

  // Naam uit een Facebook-link: facebook.com/bakkerij.jansen → "Bakkerij Jansen"
  function fbName(url) {
    var m = String(url || '').match(/facebook\.com\/(?:pg\/|people\/)?([^/?#]+)/i), n = m && m[1];
    if (!n || /^(profile\.php|share|groups|watch|events)$/i.test(n)) return '';
    try { n = decodeURIComponent(n); } catch (e) { /* laten zoals het is */ }
    return n.replace(/[._-]+/g, ' ').replace(/\s+\d{6,}$/, '').trim().replace(/(^|\s)\S/g, function (x) { return x.toUpperCase(); });
  }

  return {
    statusBar: statusBar,
    /* ---------- SMS: het berichtenscherm dat opent, met nummer en tekst al ingevuld ---------- */
    sms: function (c) {
      return '<div class="ph ph-sms">' + statusBar() +
        '<div class="sms-head">' + ic('back') + '<span class="sms-av">' + ic('user') + '</span><b>' + v(c.phone, '110px') + '</b></div>' +
        '<div class="sms-body"><small>' + esc(t('pv.sms.new')) + '</small></div>' +
        '<div class="sms-bar"><div class="sms-input">' + (c.message ? esc(c.message) : '<i class="sk" style="width:70%"></i>') + '</div><b class="sms-send">' + ic('send') + '</b></div>' +
      '</div>';
    },

    /* ---------- WhatsApp: precies het chatscherm dat opent ---------- */
    whatsapp: function (c, ex) {
      if (c.channel === 'sms') return this.sms(c);                       // gekozen: SMS
      var msgs = ex
        ? '<div class="wa-in">' + esc(t('pv.whatsapp.m1')) + '<time>' + liveClock(-6) + '</time></div>' +
          '<div class="wa-out">' + esc(c.message) + '<time>' + liveClock(-4) + ' <em>✓✓</em></time></div>' +
          '<div class="wa-in">' + esc(t('pv.whatsapp.m3')) + '<time>' + liveClock(-1) + '</time></div>'
        : (c.message ? '<div class="wa-out">' + esc(c.message) + '<time>' + liveClock(0) + ' <em>✓✓</em></time></div>'
                     : '<div class="wa-out sk-bub"><i class="sk"></i><i class="sk" style="width:70%"></i></div>');
      return '<div class="ph ph-wa">' + statusBar(true) +
        '<div class="wa-head">' + ic('back') + '<span class="wa-av">' + (exPhoto('whatsapp', ex) ? '<img decoding="sync" src="' + exPhoto('whatsapp', ex) + '" alt="">' : ic('user')) + '</span>' +
          '<span class="wa-name"><b>' + v(c.phone, '110px') + '</b><small>' + esc(t('pv.whatsapp.online')) + '</small></span>' +
          ic('video') + ic('call') + ic('dots', 'i dots') + '</div>' +
        '<div class="wa-body"><div class="wa-pill">' + ic('lock', 'i s') + esc(t('pv.whatsapp.encrypted')) + '</div>' + msgs + '</div>' +
        '<div class="wa-bar"><div class="wa-input">' + ic('smile') + '<span>' + esc(t('pv.whatsapp.input')) + '</span>' + ic('clip') + ic('cam') + '</div><b class="wa-send">' + ic('send') + '</b></div>' +
      '</div>';
    },

    /* ---------- Instagram: het profiel dat opent ---------- */
    instagram: function (c, ex) {
      var u = c.username ? c.username.replace(/^@/, '') : ((String(c.url || '').match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i) || [])[1] || '');   // naam, of uit de profiellink
      var stat = function (n, k) { return '<span><b>' + (ex ? n : '<i class="sk" style="width:26px"></i>') + '</b><small>' + esc(t('pv.instagram.' + k)) + '</small></span>'; };
      var tiles = ['#f58529,#dd2a7b', '#515bd4,#8134af', '#2bb5f0,#1e3a8a', '#fcd34d,#f97316', '#10b981,#0f766e', '#f472b6,#7c3aed'];
      // Voorbeeldfoto's (stap 1): profielfoto, 5 highlights en 8 berichten in assets/previews/ig/
      var me = exPhoto('instagram', ex), pics = me ? [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { return asset('assets/previews/ig/' + i + '.jpg'); }) : null;
      var face = function (letter) { return me ? '<img decoding="sync" src="' + me + '" alt="">' : letter; };
      var hl = function (i) { return pics ? ' style="background:#ddd url(' + asset('assets/previews/ig/h' + i + '.jpg') + ') center / cover"' : (ex ? ' style="background:linear-gradient(135deg,' + tiles[i] + ')"' : ''); };
      return '<div class="ph ph-ig">' + statusBar() +
        '<div class="ig-head">' + ic('back') + '<b>' + v(u, '110px') + (ex ? '<span class="ig-ver">' + ic('check', 'i') + '</span>' : '') + '</b>' + ic('bell') + ic('dots', 'i dots') + '</div>' +
        '<div class="ig-prof"><span class="ig-av"><span>' + face(u ? esc(u[0].toUpperCase()) : ic('user')) + '</span></span>' +
          '<div class="ig-stats">' + stat('86', 'posts') + stat(i18n.fmt.compact(3100), 'followers') + stat('312', 'following') + '</div></div>' +
        '<div class="ig-bio"><b>' + (ex ? esc(t('sample.igName')) : v(u, '40%')) + '</b>' +
          (ex ? '<small>' + esc(t('pv.instagram.category')) + '</small><p>' + esc(t('pv.instagram.bio')) + ' 🌍</p><a>' + esc(t('sample.igSite')) + '</a>' : '<i class="sk" style="width:85%"></i><i class="sk" style="width:60%"></i>') + '</div>' +
        '<div class="ig-btns"><span class="pri">' + esc(t('pv.instagram.cta')) + '</span><span>' + esc(t('pv.instagram.message')) + '</span><span>' + esc(t('pv.instagram.contact')) + '</span><span class="ic">' + ic('addp') + '</span></div>' +
        '<div class="ig-hl">' + [1, 2, 3, 4, 5].map(function (i) { return '<span' + hl(i) + '></span>'; }).join('') + '</div>' +
        '<div class="ig-tabs"><span class="on">' + ic('grid') + '</span><span>' + ic('reel') + '</span><span>' + ic('tag') + '</span></div>' +
        '<div class="ig-grid">' + (pics ? pics.map(function (src) { return '<span style="background-image:url(' + src + ')"></span>'; }).join('')
          : tiles.map(function (g) { return '<span' + (ex ? ' style="background:linear-gradient(135deg,' + g + ')"' : '') + '></span>'; }).join('')) + '</div>' +
        '<div class="ig-nav">' + ic('home') + ic('search') + ic('plus') + ic('reel') + '<span class="ig-me">' + face(u ? esc(u[0].toUpperCase()) : '') + '</span></div>' +
      '</div>';
    },

    /* ---------- Website: de site in de browser, met het adres onderin ---------- */
    website: function (c, ex, state) {
      var d = domain(c.url);
      // Met wachtwoord: eerst het slot-scherm zoals de bezoeker het ziet. Tik op Openen = ontgrendelen (alleen in de preview).
      if (c.password && !ex && !(state && state.previewUnlocked)) return '<div class="ph ph-web ph-lock">' + statusBar() +
        '<div class="lk-card"><span class="lk-ic">' + ic('lock') + '</span><b>' + esc(t('pv.website.locked')) + '</b><p>' + esc(t('pv.website.enterPw')) + '</p>' +
        '<span class="lk-input">' + new Array(Math.min(c.password.length, 12) + 1).join('•') + '</span><button type="button" class="lk-btn" data-unlock>' + esc(t('pv.website.open')) + '</button><small class="lk-tip">' + esc(t('pv.website.tapToOpen')) + '</small></div>' +
        '<div class="web-bar"><div class="web-url">' + ic('aa') + '<span>' + ic('lock', 'i s') + esc(d || '') + '</span>' + ic('reload') + '</div>' +
          '<div class="web-tools">' + ic('back') + ic('fwd') + ic('share') + ic('book') + ic('tabs') + '</div></div></div>';
      return '<div class="ph ph-web">' + statusBar() +
        '<div class="web-page">' +
          (c.password && !ex ? '<button type="button" class="web-lockchip" data-lock>' + ic('lock', 'i s') + esc(t('pv.website.lockChip')) + '</button>' : '') +
          '<div class="web-nav"><span class="web-logo"><i></i>' + (d ? esc(d.split('.')[0]) : '<i class="sk" style="width:60px"></i>') + '</span>' + ic('menu') + '</div>' +
          '<div class="web-hero"><h4>' + v(c.title, '80%') + '</h4>' +
            (ex ? '<p>' + esc(t('pv.website.text')) + '</p>' : '<i class="sk" style="width:90%"></i><i class="sk" style="width:65%"></i>') +
            '<span class="web-btn">' + esc(t('pv.website.cta')) + '</span></div>' +
          '<div class="web-img"><span></span><span></span><span></span></div>' +
          '<div class="web-cards"><span><i class="sk"></i><i class="sk" style="width:70%"></i></span><span><i class="sk"></i><i class="sk" style="width:55%"></i></span></div>' +
        '</div>' +
        '<div class="web-bar"><div class="web-url">' + ic('aa') + '<span>' + ic('lock', 'i s') + v(d, '110px') + '</span>' + ic('reload') + '</div>' +
          '<div class="web-tools">' + ic('back') + ic('fwd') + ic('share') + ic('book') + ic('tabs') + '</div></div>' +
      '</div>';
    },

    /* ---------- WiFi: de camera scant de code en vraagt om te verbinden ---------- */
    wifi: function (c, ex) {
      var name = c.ssid ? '“' + esc(c.ssid) + '”' : '<i class="sk" style="width:90px"></i>';
      return '<div class="ph ph-wifi">' + statusBar(true) +
        '<div class="wf-cam"><span class="wf-frame"><i></i><i></i><i></i><i></i></span></div>' +
        '<div class="wf-alert"><span class="wf-ic">' + ic('wifi') + '</span><b>' + esc(t('pv.wifi.alert')) + '</b><p>' + name + '</p>' +
          '<div class="wf-btns"><span>' + esc(t('pv.wifi.cancel')) + '</span><span class="pri">' + esc(t('pv.wifi.cta')) + '</span></div></div>' +
        '<div class="wf-pill">' + ic('wifi', 'i s') + esc(t('pv.wifi.network')) + ' ' + name + '</div>' +
        '<div class="wf-shutter"><span class="wf-thumb"></span><span class="wf-btn"></span><span class="wf-flip">' + ic('flash') + '</span></div>' +
      '</div>';
    },

    /* ---------- vCard: digitaal visitekaartje ---------- */
    vcard: function (c, ex) {
      var act = function (icon, label) { return '<span><i>' + ic(icon) + '</i>' + esc(label) + '</span>'; };
      var row = function (icon, label, val, w) { return '<div class="vc-row"><span class="vc-ic">' + ic(icon) + '</span><span><small>' + esc(label) + '</small><b>' + v(val, w) + '</b></span></div>'; };
      return '<div class="ph ph-vc">' +
        '<div class="vc-band">' + statusBar(true) +
          '<span class="vc-av">' + (exPhoto('vcard', ex) ? '<img decoding="sync" src="' + exPhoto('vcard', ex) + '" alt="">' : (c.name ? esc(initials(c.name)) : ic('user'))) + '</span>' +
          '<h4>' + v(c.name, '50%') + '</h4><p>' + (c.role || c.company ? esc([c.role, c.company].filter(Boolean).join(' · ')) : '<i class="sk" style="width:45%;margin:0 auto"></i>') + '</p>' +
          '<div class="vc-acts">' + act('call', t('pv.vcard.phone')) + act('mail', t('pv.vcard.email')) + act('globe', t('pv.vcard.website')) + act('pin', t('pv.vcard.route')) + '</div></div>' +
        '<div class="vc-list">' + row('call', t('pv.vcard.phone'), c.phone, '55%') + row('mail', t('pv.vcard.email'), c.email, '65%') + row('globe', t('pv.vcard.website'), domain(c.website), '50%') + row('pin', t('fields.address'), ADDRESS.text(c.address), '70%') + '</div>' +
        '<div class="vc-save">' + ic('save') + esc(t('pv.vcard.cta')) + '</div>' +
      '</div>';
    },

    /* ---------- Lijst met links: omslag, profiel en een nette lijst (alle links even groot) ----------
       Per link: eigen naam en foto (optioneel). Zonder naam: een leesbare naam uit het adres. Zonder foto: de eerste letter.
       Op de echte pagina schuiven de links één voor één in beeld (zie live.css). */
    links: function (c, ex) {
      // Link 1-3 altijd (leeg = skelet), link 4-10 alleen als ze ingevuld zijn
      var keys = ['link1', 'link2', 'link3', 'link4', 'link5', 'link6', 'link7', 'link8', 'link9', 'link10'].filter(function (k, i) { return i < 3 || c[k]; });
      var clean = function (x) { return String(x || '').replace(/^https?:\/\/(www\.)?/i, '').split(/[?#]/)[0].replace(/\/$/, ''); };
      var sk = function (w) { return '<i class="sk" style="width:' + w + '"></i>'; };
      var dom = function (k) { var val = clean(c[k]); return /\.[a-z]{2,}/i.test(val) ? val.split('/')[0] : ''; };
      // "top-corsetero-stretch-p06050822.html" -> "Top corsetero stretch"; alleen cijfers -> naam van de website ("Redbrain")
      var site = function (k) { var d = dom(k).replace(/^(m|shop|store|es|nl|de|fr|en)\./i, ''); var n = d.split('.').slice(-2, -1)[0] || d; return n ? n.charAt(0).toUpperCase() + n.slice(1) : ''; };
      var label = function (k) {
        if (c[k + 'Name']) return c[k + 'Name'];
        var parts = clean(c[k]).split('/'), last = parts.length > 1 ? parts[parts.length - 1] : '';
        last = decodeURIComponentSafe(last).replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_](p|id|art|sku)?\d{4,}.*$/i, '').replace(/[-_+]+/g, ' ').trim();
        if (!last || /^\d+$/.test(last) || last.length < 3) return site(k) || clean(c[k]);
        return last.charAt(0).toUpperCase() + last.slice(1);
      };
      var img = function (k) { var v = c[k + 'Img']; return /^data:image\/(jpeg|png|webp);base64,/.test(v || '') ? v : ''; };
      var photo = /^data:image\/(jpeg|png|webp);base64,/.test(c.photo || '') ? c.photo : '';
      return '<div class="ph ph-lk2">' +
        '<div class="lk2-cover"' + (exPhoto('links', ex) ? ' style="background:#2a1d14 url(' + asset('assets/previews/links-cover.jpg') + ') center / cover"' : '') + '>' + statusBar(true) + '<span class="lk2-share">' + ic('share') + '</span></div>' +
        '<div class="lk2-prof"><span class="lk2-av">' + (photo || exPhoto('links', ex) ? '<img decoding="sync" src="' + (photo || exPhoto('links', ex)) + '" alt="">' : (c.title ? esc(initials(c.title)) : ic('user'))) + '</span>' +
          '<h4>' + (c.title ? esc(c.title) : sk('55%')) + '</h4><p>' + (ex ? esc(t('pv.links.sub')) : sk('45%')) + '</p></div>' +
        '<div class="lk2-list">' + keys.map(function (k, j) {
          var name = c[k] ? label(k) : '';
          return '<span class="lk2-row" data-k="' + k + '" style="--i:' + j + '"><i class="lk2-th t' + (j % 2) + (img(k) ? ' has-img" style="background-image:url(' + img(k) + ')">' : '">' + (name ? esc(name.charAt(0).toUpperCase()) : '')) + '</i>' +
            '<span><b>' + (name ? esc(name) : sk('55%')) + '</b>' + (dom(k) ? '<small>' + esc(dom(k)) + '</small>' : '') + '</span>' + ic('fwd') + '</span>';
        }).join('') + '</div>' +
      '</div>';
    },

    /* ---------- PDF: het document in een echte PDF-viewer ---------- */
    pdf: function (c, ex) {
      // De PDF opent meteen in de pdf-lezer van de telefoon. Voorbeeld: verzonnen inhoud; eigen PDF: neutrale pagina.
      var o = FILES.parse(c.file), name = o ? o.n : (c.title ? c.title + '.pdf' : '');
      c = ex ? { company: t('sample.pdfCompany'), title: t('pv.pdf.title'), description: t('pv.pdf.desc') } : {};
      return '<div class="ph ph-pv">' + statusBar() +
        '<div class="pv-bar"><b class="pv-done">' + esc(t('pv.pdf.done')) + '</b><span>' + v(name, '110px') + '</span>' + ic('share') + '</div>' +
        '<div class="pv-view"><div class="pv-sheet">' +
          '<div class="pv-hd"><span class="pv-logo">' + (c.company ? esc(initials(c.company)) : '') + '</span><b>' + (c.company ? esc(c.company) : '<i class="sk" style="width:70px"></i>') + '</b><small>2026</small></div>' +
          '<h5>' + (c.title ? esc(c.title) : '<i class="sk" style="width:70%;height:12px"></i>') + '</h5>' +
          (c.description ? '<p>' + esc(c.description) + '</p>' : '<i class="sk"></i><i class="sk" style="width:80%"></i>') +
          '<div class="pv-chart"><i style="height:45%"></i><i style="height:70%"></i><i style="height:55%"></i><i style="height:90%"></i><i style="height:65%"></i></div>' +
          '<i class="sk"></i><i class="sk" style="width:92%"></i><i class="sk" style="width:76%"></i><i class="sk" style="width:85%"></i>' +
          '<div class="pv-cols"><span><i class="sk"></i><i class="sk" style="width:80%"></i></span><span><i class="sk"></i><i class="sk" style="width:70%"></i></span></div>' +
        '</div><span class="pv-pg">1 / 12</span></div>' +
        '<div class="pv-dl">' + ic('save') + '<span><b>' + esc(t('pv.pdf.download')) + '</b><small>' + (o ? FILES.size(o.s) + ' · PDF' : 'PDF') + '</small></span></div>' +
      '</div>';
    },

    /* ---------- Video: de videopagina met speler ---------- */
    video: function (c, ex) {
      // Eigen videobestand: echte speler. src = op de echte pagina het bestand op de server, in de tool het bestand uit deze browser.
      var own = !ex && FILES.parse(c.file), src = own && (own.url || FILES.local.file || '');
      var d = own ? '' : domain(c.url);
      return '<div class="ph ph-vid">' + statusBar(true) +
        '<div class="vd-top">' + ic('back') + '<span>' + (own ? esc(c.title || own.n) : v(d, '100px')) + '</span>' + ic('share') + '</div>' +
        (own ? '<div class="vd-player vd-own">' + (src ? '<video src="' + esc(src) + '" playsinline preload="metadata"' + (own.url ? ' controls' : ' muted') + '></video>' : '') +
            (own.url ? '' : '<span class="vd-play">' + ic('play') + '</span>') + '</div>'
          : '<div class="vd-player"' + (exPhoto('video', ex) ? ' style="background-image:url(' + exPhoto('video', ex) + ')"' : '') + '><span class="vd-play">' + ic('play') + '</span>' +
          '<div class="vd-bar"><i></i></div><small class="vd-time">0:24 / 1:42</small></div>') +
        '<div class="vd-info"><h4>' + v(c.title, '75%') + '</h4>' +
          (own ? '' : '<div class="vd-ch"><span class="vd-av">' + (d ? esc(d[0].toUpperCase()) : '') + '</span><b>' + v(d, '90px') + '</b></div>') +
          '<p>' + (c.description ? esc(c.description) : '<i class="sk"></i><i class="sk" style="width:80%"></i><i class="sk" style="width:55%"></i>') + '</p></div>' +
        '<div class="vd-btn">' + ic('play') + esc(t('pv.video.watch')) + '</div>' +
      '</div>';
    },

    /* ---------- Afbeeldingen: rustige fotogalerij. Foto's in hun eigen verhouding, verdeeld over kolommen
       (steeds de kortste kolom eerst, zodat de volgorde van links naar rechts blijft). Tik = grote weergave (live.js). ---------- */
    images: function (c, ex) {
      var list = FILES.photos(c.photos), n = list.length || (ex ? 9 : 0);
      var items = list.length ? list.map(function (p, i) {
        var r = p.w && p.h ? p.h / p.w : 1;
        return { r: r, html: '<button type="button" class="gx-item" data-i="' + i + '" aria-label="' + esc(t('live.photoOpen', { n: i + 1, total: list.length })) + '"' + (p.w && p.h ? ' style="aspect-ratio:' + p.w + '/' + p.h + '"' : '') + '>' +
          '<img src="' + esc(p.src) + '" alt="" loading="lazy" decoding="async"></button>' };
      }) : (ex ? [1.33, .75, 1, .67, 1.25, .8, 1, .75, 1.33] : [1, 1, 1, 1]).map(function (r, i) {
        return { r: r, html: '<span class="gx-item ' + (ex ? 'gx-mesh' : 'gx-none') + '" style="aspect-ratio:1/' + r + (ex ? ';' + mesh(i) : '') + '">' + (ex ? '' : ic('img')) + '</span>' };
      });
      return '<div class="ph ph-gx">' + statusBar() +
        '<header class="gx-head"><h4>' + (c.title ? esc(c.title) : ex ? '' : '<i class="sk" style="width:60%;height:16px"></i>') + '</h4>' +
          '<p class="gx-meta">' + (n ? esc(t('pv.images.count', { count: i18n.fmt.num(n) })) : '<i class="sk" style="width:35%"></i>') + '</p>' +
          (c.description ? '<p class="gx-desc">' + esc(c.description) + '</p>' : '') + '</header>' +
        '<div class="gx-grid">' + GALLERY.columns(items, 2) + '</div>' +
      '</div>';
    },

    /* ---------- Facebook: de pagina zoals in de app ---------- */
    facebook: function (c, ex) {
      var name = c.pageName || fbName(c.url) || (ex ? t('sample.fbPage') : ''), fbLogo = exPhoto('facebook', ex);   // voorbeeld: logo, omslagfoto en een bericht met foto
      return '<div class="ph ph-fb">' + statusBar() +
        '<div class="fb-nav"><b>facebook</b><span>' + ic('search') + ic('chat') + '</span></div>' +
        '<div class="fb-cover"' + (fbLogo ? ' style="background:#ccc url(' + asset('assets/previews/facebook-cover.jpg') + ') center / cover"' : '') + '></div>' +
        '<div class="fb-prof"><span class="fb-av">' + (fbLogo ? '<img decoding="sync" src="' + fbLogo + '" alt="">' : (name ? esc(initials(name)) : ic('user'))) + '</span>' +
          '<h4>' + v(name, '55%') + (ex ? '<span class="fb-ver">' + ic('check') + '</span>' : '') + '</h4>' +
          '<small>' + (ex ? esc(t('pv.facebook.likes', { count: i18n.fmt.num(12400) })) + ' · ' + esc(t('pv.facebook.followers', { count: i18n.fmt.num(13100) })) : '<i class="sk" style="width:70%"></i>') + '</small>' +
          (c.description || ex ? '<p>' + esc(c.description || t('pv.facebook.desc')) + '</p>' : '') +
          '<div class="fb-btns"><span class="pri">' + ic('like') + esc(t('pv.facebook.like')) + '</span><span>' + ic('chat') + esc(t('pv.facebook.message')) + '</span><span class="sq">' + ic('dots', 'i dots') + '</span></div></div>' +
        '<div class="fb-tabs"><span class="on">' + esc(t('pv.facebook.tabPosts')) + '</span><span>' + esc(t('pv.facebook.tabAbout')) + '</span><span>' + esc(t('pv.facebook.tabPhotos')) + '</span></div>' +
        '<div class="fb-post"><div class="fb-ph"><span class="fb-av s">' + (fbLogo ? '<img decoding="sync" src="' + fbLogo + '" alt="">' : (name ? esc(initials(name)) : '')) + '</span><span><b>' + v(name, '90px') + '</b><small>' + esc(t('pv.facebook.time')) + '</small></span></div>' +
          (fbLogo ? '<p class="fb-text">' + esc(t('pv.facebook.post')) + '</p><div class="fb-img" style="background:#ccc url(' + asset('assets/previews/facebook-post.jpg') + ') center / cover"></div>'
            : '<i class="sk" style="width:90%"></i><i class="sk" style="width:60%"></i><div class="fb-img"></div>') + '</div>' +
      '</div>';
    },

    /* ---------- Social media: donkere, chique pagina met een glazen kaart per kanaal ---------- */
    social: function (c, ex) {
      var so = SOCIALS.parse(c.socials), nets = SOCIALS.LIST.filter(function (n) { return n.id in so; });
      var hero = exPhoto('social', ex);
      return '<div class="ph ph-sx' + (hero ? ' has-hero' : '') + '">' + (hero ? '<div class="sx-hero" style="background-image:url(' + hero + ')"></div>' : '<i class="sx-glow a"></i><i class="sx-glow b"></i>') + statusBar(true) +
        '<div class="sx-prof"><span class="sx-ring"><span class="sx-av">' + (hero ? '<img decoding="sync" src="' + asset('assets/previews/social-avatar.jpg') + '" alt="">' : (c.title ? esc(initials(c.title)) : ic('user'))) + '</span></span>' +
          '<h4>' + (c.title ? esc(c.title) : '<i class="sk" style="width:45%;margin:0 auto"></i>') + '</h4>' +
          '<p>' + (c.description ? esc(c.description) : '<i class="sk" style="width:60%;margin:0 auto"></i>') + '</p>' +
          (nets.length ? '<div class="sx-quick">' + nets.slice(0, 5).map(function (n) { return SOCIALS.icon(n.id); }).join('') + '</div>' : '') + '</div>' +
        '<div class="sx-list">' + (nets.length ? nets.map(function (n) {
            // Alleen de naam van het platform; de link zelf zit achter de kaart (geen lange URL's in beeld)
            return '<span class="sx-card" data-net="' + n.id + '"><i class="sx-ic sx-' + n.id + '">' + SOCIALS.icon(n.id) + '</i><span><b>' + esc(n.name) + '</b></span>' + ic('fwd') + '</span>';
          }).join('') : [1, 2, 3].map(function () { return '<span class="sx-card"><i class="sx-ic sx-empty"></i><span><i class="sk" style="width:50%"></i><i class="sk" style="width:35%"></i></span></span>'; }).join('')) + '</div>' +
      '</div>';
    },

    /* ---------- MP3: muziekspeler ---------- */
    mp3: function (c, ex) {
      var o = FILES.parse(c.file), secs = o ? Math.max(30, Math.round(o.s / 16000)) : 192;
      var mm = function (x) { return Math.floor(x / 60) + ':' + ('0' + (x % 60)).slice(-2); };
      return '<div class="ph ph-mp3">' + statusBar(true) +
        '<div class="mp-top">' + ic('back') + '<small>' + esc(t('pv.mp3.nowPlaying')) + '</small>' + ic('dots', 'i dots') + '</div>' +
        '<div class="mp-art">' + (c.cover || exPhoto('mp3', ex) ? '<img decoding="sync" src="' + (c.cover || exPhoto('mp3', ex)) + '" alt="">' : ic('note')) + '</div>' +
        '<div class="mp-info"><h4>' + v(c.title, '60%') + '</h4><p>' + v(c.artist, '40%') + '</p></div>' +
        '<div class="mp-bar"><i style="width:' + (o || ex ? 25 : 0) + '%"></i></div><div class="mp-time"><span>' + mm(Math.round(secs / 4)) + '</span><span>' + mm(secs) + '</span></div>' +
        '<div class="mp-ctrl">' + ic('prev') + '<span class="mp-play">' + ic('play') + '</span>' + ic('next') + '</div>' +
        '<div class="mp-file">' + ic('save') + (o ? esc(o.n) : esc(t('pv.mp3.download'))) + '</div>' +
      '</div>';
    },

    /* ---------- Menu: de menukaart van het restaurant ---------- */
    menu: function (c, ex) {
      // Wat de gast ziet hangt af van de keuze: de bestaande menusite, het geüploade menu, of het menu dat je hier maakt
      var mode = ex ? 'build' : QR_TYPES.choice(getType('menu'), 'mode', c);
      if (mode === 'link') return PHONE.website({ url: c.menuUrl, title: '' }, false);
      if (mode === 'upload') {
        var o = FILES.parse(c.menuFile), img = o && o.d && /^data:image\//.test(o.d) ? o.d : '';
        if (img) return '<div class="ph ph-mnimg">' + statusBar() + '<div class="mni-view"><img src="' + img + '" alt=""></div></div>';
        return PHONE.pdf({ file: c.menuFile }, false);
      }
      var list = FILES.list(c.dishes);
      var price = function (p) { var n = parseFloat(String(p || '').replace(',', '.')); return isNaN(n) ? '' : i18n.fmt.eur(n); };
      return '<div class="ph ph-menu">' +
        '<div class="mn-cover">' + (c.cover || exPhoto('menu', ex) ? '<img decoding="sync" src="' + (c.cover || exPhoto('menu', ex)) + '" alt="">' : '<svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="320" height="140" fill="#3b2a20"/><circle cx="160" cy="92" r="70" fill="#f4efe6"/><circle cx="160" cy="92" r="52" fill="#fff"/><circle cx="148" cy="84" r="14" fill="#e07a2f"/><circle cx="172" cy="96" r="12" fill="#6a994e"/><circle cx="160" cy="104" r="9" fill="#bc4749"/><path d="M60 20v60M52 20v22a8 8 0 0 0 16 0V20M262 20c10 10 12 30 0 40v30" stroke="#d9c7a7" stroke-width="5" fill="none" stroke-linecap="round"/></svg>') +
          statusBar(true) + '</div>' +
        '<div class="mn-head"><h4>' + v(c.restaurant, '55%') + '</h4><span class="mn-chip">' + esc(t('pv.menu.chip')) + '</span></div>' +
        '<div class="mn-list">' + (list.length ? list.slice(0, 7).map(function (d) { return '<div class="mn-row"><b>' + esc(d.n) + '</b><i></i><span>' + price(d.p) + '</span></div>'; }).join('')
          : [1, 2, 3, 4].map(function () { return '<div class="mn-row"><b><i class="sk" style="width:120px"></i></b><i></i><span><i class="sk" style="width:36px"></i></span></div>'; }).join('')) + '</div>' +
      '</div>';
    },

    /* ---------- Apps: zoals de App Store ---------- */
    apps: function (c, ex) {
      var name = c.appName, cat = t('pv.apps.category');
      var shot = function (k) {
        return '<span class="as-shot"><i class="as-sbar"></i><i class="as-hd"></i>' +
          (k === 0 ? '<i class="as-ring"></i><i class="as-ln"></i><i class="as-ln s"></i>' : k === 1 ? '<i class="as-card"></i><i class="as-card"></i><i class="as-card s"></i>' : '<i class="as-bars"><b style="height:40%"></b><b style="height:70%"></b><b style="height:55%"></b><b style="height:90%"></b></i><i class="as-ln"></i>') + '</span>';
      };
      // Gewone knoppen met de naam van de winkel. Geen Apple- of Google-logo: die mogen alleen in de officiële badges.
      var badge = function (kind) {
        return '<span class="ap-badge">' + ic('save') + '<span><small>' + esc(t(kind === 'ios' ? 'pv.apps.get' : 'pv.apps.getPlay')) + '</small><b>' + (kind === 'ios' ? 'App Store' : 'Google Play') + '</b></span></span>';
      };
      var stores = (ex || c.ios ? badge('ios') : '') + (ex || c.android ? badge('android') : '');
      return '<div class="ph ph-as">' + statusBar() +
        '<div class="as-nav">' + ic('back') + '<span>' + esc(t('pv.apps.search')) + '</span></div>' +
        // Geen eigen logo of tekst nodig: naam (mag leeg) en de winkelknoppen die echt ingevuld zijn
        '<div class="as-top"><span class="as-icon">' + (exPhoto('apps', ex) ? '<img decoding="sync" src="' + exPhoto('apps', ex) + '" alt="">' : (name ? esc(initials(name)) : ic('save'))) + '</span>' +
          '<div class="as-meta"><b>' + v(name, '70%') + '</b><small>' + (ex ? esc(t('pv.apps.desc')) : '') + '</small>' +
          '<div class="as-get"><span>' + esc(t('pv.apps.download')) + '</span>' + ic('share') + '</div></div></div>' +
        '<div class="as-shots">' + [0, 1, 2].map(shot).join('') + '</div>' +
        '<div class="as-stores">' + (stores || '<span class="ap-badge ap-empty"><i class="sk"></i></span>') + '</div>' +
      '</div>';
    },

    /* ---------- Coupon: een Wallet-achtige kaart met grote korting, scanbare code en kopieerknop ---------- */
    coupon: function (c, ex) {
      var exp = c.expires || (ex ? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) : '');
      var date = exp ? i18n.fmt.date(new Date(exp + 'T12:00:00'), 'short') : '';
      var scan = c.scan || 'qr', bar = c.code && scan === 'barcode' ? BARCODE.svg(c.code) : '';
      if (scan === 'barcode' && !bar) scan = 'qr';   // tekens die een streepjescode niet kan (bv. €): dan een QR-code
      var qr = c.code && scan === 'qr' && typeof QRRender !== 'undefined' ? QRRender.svg(c.code, { color: '#000000' }) : '';
      return '<div class="ph ph-wl">' + statusBar(true) +
        '<div class="wl-nav"><b>' + esc(t('pv.pdf.done')) + '</b>' + ic('dots', 'i dots') + '</div>' +
        '<div class="wl-pass">' +
          '<div class="wl-row"><span class="wl-logo">' + ic('gift') + '</span><b class="wl-co">' + (c.company ? esc(c.company) : '<i class="sk" style="width:80px"></i>') + '</b></div>' +
          // De korting is het belangrijkste: groot en als eerste
          '<div class="wl-off">' + (c.discount ? '<b>' + esc(c.discount) + '<em>%</em></b><span>' + esc(t('pv.coupon.off')) + '</span>' : '<i class="sk" style="width:120px;height:46px"></i>') + '</div>' +
          '<div class="wl-big"><small>' + esc(t('pv.coupon.offer')) + '</small><b>' + (c.title ? esc(c.title) : '<i class="sk" style="width:70%;height:16px"></i>') + '</b></div>' +
          '<div class="wl-row f2">' + (date ? '<span class="wl-f"><small>' + esc(t('pv.coupon.validLbl')) + '</small><b>' + esc(date) + '</b></span>' : '<span></span>') + '<span class="wl-f r"><small>' + esc(t('pv.coupon.yourCode')) + '</small><b>' + (c.code ? esc(c.code) : '–') + '</b></span></div>' +
          (bar ? '<div class="wl-code wl-bar"><span>' + bar + '</span><small>' + esc(c.code) + '</small></div>'
            : c.code && scan === 'none' ? '' : '<div class="wl-code"><span>' + (qr || '<i class="wl-qr-sk"></i>') + '</span><small>' + (c.code ? esc(c.code) : '') + '</small></div>') +
        '</div>' +
        // Hoe gebruik je deze korting? Online (knop naar de shop) of laten zien bij de kassa
        (c.code || ex ? '<p class="wl-how">' + esc(t(c.buttonUrl ? 'pv.coupon.howOnline' : 'pv.coupon.howStore')) + '</p>' : '') +
        (c.terms ? '<p class="wl-terms">' + esc(c.terms) + '</p>' : '') +
        '<div class="wl-acts">' + (c.buttonUrl ? '<button type="button" class="wl-add wl-go" data-shop>' + ic('fwd') + '<span>' + esc(c.buttonLabel || t('pv.coupon.shopNow')) + '</span></button>' : '') +
          '<button type="button" class="wl-add" data-copy="' + esc(c.code || '') + '">' + ic('copy') + '<span>' + esc(t('pv.coupon.cta')) + '</span></button></div>' +
      '</div>';
    },

    /* ---------- Bedrijf: zoals een bedrijfskaart in Google Maps ---------- */
    business: function (c, ex) {
      var hrs = HOURS.parse(c.hours), st = HOURS.status(hrs), today = (new Date().getDay() + 6) % 7, td = hrs[today];
      var addr = ADDRESS.parse(c.address), socials = SOCIALS.parse(c.socials), nets = SOCIALS.LIST.filter(function (n) { return n.id in socials; });
      var act = function (icon, label, href) { return (href ? '<a href="' + href + '" target="_blank" rel="noopener">' : '<span>') + '<i>' + ic(icon) + '</i>' + esc(label) + (href ? '</a>' : '</span>'); };
      var todayTxt = td && td.o ? HOURS.fmt(td.f) + ' – ' + HOURS.fmt(td.t2 || td.t) : t('hours.closed');
      var table = hrs.map(function (d, i) {
        var tm = d.o ? HOURS.fmt(d.f) + ' – ' + HOURS.fmt(d.t) + (d.f2 && d.t2 ? ', ' + HOURS.fmt(d.f2) + ' – ' + HOURS.fmt(d.t2) : '') : esc(t('hours.closed'));
        return '<div class="gm-day' + (i === today ? ' today' : '') + (d.o ? '' : ' off') + '"><span>' + esc(HOURS.dayName(i)) + '</span><span>' + tm + '</span></div>';
      }).join('');
      return '<div class="ph ph-gm">' +
        '<div class="gm-cover">' + (c.cover || exPhoto('business', ex) ? '<img decoding="sync" src="' + (c.cover || exPhoto('business', ex)) + '" alt="">' : storefront(c.name)) + statusBar(true) +
          '<div class="gm-tb"><span>' + ic('back') + '</span><span>' + ic('share') + '</span></div></div>' +
        '<div class="gm-sheet"><i class="gm-grab"></i>' +
          '<h4>' + v(c.name, '55%') + '</h4>' +
          '<div class="gm-open"><b class="' + st + '">' + esc(t(st === 'open' ? 'pv.business.openNow' : 'pv.business.closedNow')) + '</b> · ' + esc(todayTxt) + '</div>' +
          '<div class="gm-acts">' + act('pin', t('pv.vcard.route'), addr ? ADDRESS.mapUrl(addr) : '') + act('call', t('pv.vcard.call')) + act('globe', t('pv.vcard.website')) + act('share', t('pv.business.share')) + '</div>' +
          (c.description ? '<p class="gm-desc">' + esc(c.description) + '</p>' : (ex ? '' : '<p class="gm-desc"><i class="sk"></i><i class="sk" style="width:70%"></i></p>')) +
          '<div class="gm-row">' + ic('pin') + '<span>' + (addr ? '<b>' + esc(addr.l) + '</b>' : '<i class="sk" style="width:80%"></i>') + '</span></div>' +
          '<div class="gm-map">' + '<svg viewBox="0 0 300 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="300" height="90" fill="#e8eef3"/><path d="M0 60H300M0 20H300M70 0V90M190 0V90M250 0V90" stroke="#fff" stroke-width="7"/><path d="M0 40Q120 30 300 75" stroke="#fcd34d" stroke-width="6" fill="none"/><rect x="88" y="28" width="40" height="22" rx="3" fill="#c8e6c9"/><rect x="205" y="30" width="30" height="20" rx="3" fill="#dfe6ec"/></svg>' +
            '<span class="gm-pin">' + ic('pin') + '</span></div>' +
          '<div class="gm-row">' + ic('clock') + '<span><b>' + esc(t('pv.business.hours')) + '</b><div class="gm-table">' + table + '</div></span></div>' +
          '<div class="gm-row">' + ic('call') + '<span>' + v(c.phone, '55%') + '</span></div>' +
          '<div class="gm-row">' + ic('mail') + '<span>' + v(c.email, '65%') + '</span></div>' +
          '<div class="gm-row">' + ic('globe') + '<span>' + v(c.website ? c.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '', '50%') + '</span></div>' +
          (nets.length ? '<div class="gm-soc">' + nets.map(function (n) { return SOCIALS.icon(n.id); }).join('') + '</div>' : '') +
        '</div>' +
      '</div>';
    },

    /* ---------- Review: het venster "review schrijven" waar de scan naartoe gaat (algemeen, zonder merklogo's) ---------- */
    review: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : ''), host = domain(c.url) || (ex ? 'g.page' : '');
      var stars = [0, 1, 2, 3, 4].map(function (i) { return '<i class="rv-star' + (ex && i < 4 ? ' on' : '') + '">' + ic('star') + '</i>'; }).join('');
      return '<div class="ph ph-rv">' + statusBar() +
        '<div class="rv-url">' + ic('lock') + '<span>' + (host ? esc(host) : '<i class="sk" style="width:90px"></i>') + '</span></div>' +
        '<div class="rv-top">' + ic('back') + '<b>' + esc(t('pv.review.head')) + '</b><span class="rv-post-top">' + esc(t('pv.review.post')) + '</span></div>' +
        '<div class="rv-biz"><span class="rv-av">' + (exPhoto('review', ex) ? '<img src="' + exPhoto('review', ex) + '" alt="">' : esc(initials(name) || '★')) + '</span><div><b>' + v(name, '60%') + '</b><small>' + esc(t('pv.review.public')) + '</small></div></div>' +
        (ex ? '<div class="rv-sum"><div class="rv-score"><b>' + esc(i18n.fmt.num(4.8)) + '</b><span>★★★★★</span><small>' + i18n.fmt.num(312) + '</small></div><div class="rv-bars">' +
          [82, 12, 4, 1, 1].map(function (pc, i) { return '<span><em>' + (5 - i) + '</em><i><i style="width:' + pc + '%"></i></i></span>'; }).join('') + '</div></div>' : '') +
        '<div class="rv-stars" aria-hidden="true">' + stars + '</div>' +
        '<p class="rv-hint">' + esc(t('pv.review.tap')) + '</p>' +
        '<div class="rv-text">' + (ex ? esc(t('pv.review.sample')) : '<span>' + esc(t('pv.review.placeholder')) + '</span>') + '</div>' +
        '<div class="rv-photo">' + ic('cam') + '<span>' + esc(t('pv.review.addPhoto')) + '</span></div>' +
        '<div class="rv-foot"><button type="button" class="rv-post">' + esc(t('pv.review.post')) + '</button></div>' +
      '</div>';
    },


    /* ---------- Extra soorten: zakelijke schermen zoals de echte apps (alleen voorbeeld; bij het scannen opent de echte app) ---------- */
    phone: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : ''), logo = exPhoto('phone', ex);
      var btn = function (k) { return '<span>' + ic(k) + '</span>'; };
      return '<div class="ph ph-call">' + (logo ? '<div class="cl-bg" style="background-image:url(' + logo + ')"></div>' : '') + statusBar(true) +
        '<div class="cl-top"><small class="cl-time">00:12</small><h4>' + v(name, '55%') + '</h4><small>' + v(c.phone, '45%') + '</small>' +
          '<span class="cl-av">' + (logo ? '<img src="' + logo + '" alt="">' : esc(initials(name) || '☎')) + '</span></div>' +
        '<div class="cl-grid">' + btn('mic') + btn('keypad') + btn('spk') + btn('addp') + btn('video') + btn('user') + '</div>' +
        '<span class="cl-end">' + ic('call') + '</span></div>';
    },
    email: function (c, ex) {
      return '<div class="ph ph-mail">' + statusBar() + '<div class="ml-bar"><span>' + esc(t('pv.mail.cancel')) + '</span><b>' + esc(t('pv.mail.new')) + '</b><span class="ml-send">' + ic('send') + '</span></div>' +
        '<div class="ml-row"><small>' + esc(t('pv.mail.to')) + '</small><span class="ml-chip">' + v(c.email, '60%') + '</span></div>' +
        '<div class="ml-row"><small>' + esc(t('pv.mail.subject')) + '</small><b>' + v(c.subject || (ex ? t('sample.mailSubject') : ''), '50%') + '</b></div>' +
        '<div class="ml-body">' + (c.body || ex ? esc(c.body || t('sample.mailBody')) : '<i class="sk" style="width:80%"></i><i class="sk" style="width:60%"></i>') + '</div>' +
        '<div class="ml-sig">' + esc(t('pv.mail.sig')) + '</div>' +
        '<div class="ml-kb" aria-hidden="true">' + ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map(function (r, i) { return '<div class="kb-r' + (i === 1 ? ' r2' : '') + '">' + (i === 2 ? '<i class="kb-w">⇧</i>' : '') + r.split('').map(function (k) { return '<i>' + k + '</i>'; }).join('') + (i === 2 ? '<i class="kb-w">⌫</i>' : '') + '</div>'; }).join('') +
          '<div class="kb-r"><i class="kb-w">123</i><i class="kb-sp"></i><i class="kb-w kb-ok">⏎</i></div></div></div>';
    },
    location: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : ''), addr = ADDRESS.text(c.address) || (ex ? EX_ADDR : ''), photo = exPhoto('location', ex);
      return '<div class="ph ph-loc">' + statusBar() + '<div class="lc-map"><i class="lc-r a"></i><i class="lc-r b"></i><i class="lc-r c"></i><i class="lc-r d"></i><i class="lc-park"></i><span class="lc-pin">' + ic('pin') + '</span></div>' +
        '<div class="lc-sheet"><i class="lc-grab"></i>' + (photo ? '<div class="lc-photo"><img src="' + photo + '" alt=""></div>' : '') +
          '<h4>' + v(name, '55%') + '</h4><div class="lc-rate"><b>4,8</b><span>★★★★★</span><small>(' + i18n.fmt.num(312) + ')</small></div>' +
          '<small class="lc-addr">' + v(addr, '70%') + '</small><small class="lc-open">' + esc(t('pv.biz.open', { time: i18n.fmt.time('18:00') })) + '</small>' +
          '<div class="lc-btns"><span class="on">' + ic('pin') + esc(t('pv.ext.route')) + '</span><span>' + ic('call') + esc(t('pv.ext.call')) + '</span><span>' + ic('globe') + esc(t('pv.biz.website')) + '</span></div></div></div>';
    },
    payment: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : ''), logo = exPhoto('payment', ex);
      return '<div class="ph ph-pay">' + statusBar(true) + '<div class="py-head"><span class="py-logo">' + (logo ? '<img src="' + logo + '" alt="">' : esc(initials(name) || '€')) + '</span><b>' + v(name, '50%') + '</b><small>' + ic('lock') + esc(t('pv.pay.secure')) + '</small></div>' +
        '<div class="py-amount"><small>' + esc(t('pv.pay.title')) + '</small><b>' + esc(i18n.fmt.eur(24.5)) + '</b><span>' + esc(t('pv.pay.order')) + '</span></div>' +
        '<div class="py-lines"><span><em>' + esc(t('pv.pay.l1')) + '</em><b>' + esc(i18n.fmt.eur(21)) + '</b></span><span><em>' + esc(t('pv.pay.l2')) + '</em><b>' + esc(i18n.fmt.eur(3.5)) + '</b></span></div>' +
        '<div class="py-btns"><button type="button" class="py-dark">' + ic('flash') + '<span>' + esc(t('pv.pay.phone')) + '</span></button><button type="button" class="py-card">' + esc(t('pv.pay.card')) + '</button></div>' +
        '<small class="py-note">' + esc(t('pv.pay.note')) + '</small></div>';
    },
    tiktok: function (c, ex) {
      var on = exPhoto('tiktok', ex), handle = (c.url ? '@' + String(c.url).split('@').pop().split(/[/?]/)[0] : '@cafelumen'), th = ['location', 'menu', 'links-cover', 'spotify', 'business', 'video', 'facebook-cover', 'facebook-post', 'event'];
      return '<div class="ph ph-tt">' + statusBar() + '<div class="tt-top"><span class="tt-av">' + (on ? '<img src="' + asset('assets/previews/location.jpg') + '" alt="">' : esc(initials(handle.slice(1)) || 'T')) + '</span><b>' + esc(handle) + '</b>' +
        '<div class="tt-stats"><span><b>' + i18n.fmt.num(128) + '</b><small>' + esc(t('pv.tt.following')) + '</small></span><span><b>' + i18n.fmt.compact(24300) + '</b><small>' + esc(t('pv.tt.followers')) + '</small></span><span><b>' + i18n.fmt.compact(312000) + '</b><small>' + esc(t('pv.tt.likes')) + '</small></span></div>' +
        '<div class="tt-btns"><span class="on">' + esc(t('pv.tt.follow')) + '</span><span>' + ic('chat') + '</span></div><p>' + esc(t('pv.tt.bio')) + '</p></div>' +
        '<div class="tt-grid">' + th.map(function (n, i) { return '<span' + (on ? ' style="background-image:url(' + asset('assets/previews/' + n + '.jpg') + ')"' : '') + '><em>▶ ' + i18n.fmt.compact([12400, 8100, 31200, 5400, 19800, 7600, 44100, 2900, 15300][i]) + '</em></span>'; }).join('') + '</div></div>';
    },
    linkedin: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : ''), on = exPhoto('linkedin', ex);
      return '<div class="ph ph-li">' + statusBar() + '<div class="li-bar">' + ic('search') + '<span>' + esc(name || 'LinkedIn') + '</span></div>' +
        '<div class="li-cover"' + (on ? ' style="background-image:url(' + asset('assets/previews/location.jpg') + ')"' : '') + '></div>' +
        '<div class="li-main"><span class="li-logo">' + esc(initials(name) || 'in') + '</span><h4>' + v(name, '55%') + '</h4><p>' + esc(t('pv.li.tag')) + '</p>' +
          '<small>' + esc(t('pv.li.meta', { n: i18n.fmt.num(1240) })) + '</small><div class="li-btns"><span class="on">' + esc(t('pv.li.follow')) + '</span><span>' + esc(t('pv.li.visit')) + '</span></div></div>' +
        '<div class="li-tabs"><span class="on">' + esc(t('pv.li.home')) + '</span><span>' + esc(t('pv.li.about')) + '</span><span>' + esc(t('pv.li.posts')) + '</span><span>' + esc(t('pv.li.jobs')) + '</span></div>' +
        '<div class="li-post"><b>' + v(name, '40%') + '</b><p>' + esc(t('pv.li.post')) + '</p>' + (on ? '<div class="li-img" style="background-image:url(' + on + ')"></div>' : '') + '</div></div>';
    },
    youtube: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : ''), on = exPhoto('youtube', ex);
      var vid = function (img, title, views, dur) { return '<div class="yt-vid"><span class="yt-th"' + (on ? ' style="background-image:url(' + asset('assets/previews/' + img + '.jpg') + ')"' : '') + '><em>' + dur + '</em></span><span><b>' + esc(title) + '</b><small>' + esc(t('pv.yt.views', { n: i18n.fmt.compact(views) })) + '</small></span></div>'; };
      return '<div class="ph ph-yt">' + statusBar() + '<div class="yt-banner"' + (on ? ' style="background-image:url(' + asset('assets/previews/menu.jpg') + ')"' : '') + '></div>' +
        '<div class="yt-main"><span class="yt-av">' + esc(initials(name) || '▶') + '</span><div><h4>' + v(name, '60%') + '</h4><small>' + esc(t('pv.yt.meta', { n: i18n.fmt.compact(18200), v: 64 })) + '</small></div></div>' +
        '<button type="button" class="yt-sub">' + esc(t('pv.yt.subscribe')) + '</button><div class="yt-tabs"><span class="on">' + esc(t('pv.yt.home')) + '</span><span>' + esc(t('pv.yt.videos')) + '</span><span>Shorts</span></div>' +
        vid('youtube', t('pv.yt.v1'), 23400, '8:12') + vid('event', t('pv.yt.v2'), 9100, '3:45') + '</div>';
    },
    spotify: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : ''), on = exPhoto('spotify', ex), tracks = ['Sunset Terrace', 'Morning Espresso', 'Golden Hour', 'Mediterráneo', 'Slow Sunday'];
      return '<div class="ph ph-sp">' + statusBar(true) + '<div class="sp-cover">' + (on ? '<img src="' + on + '" alt="">' : '<span>' + ic('play') + '</span>') + '</div>' +
        '<h4>' + esc(t('pv.sp.title', { name: name || 'Playlist' })) + '</h4><small>' + esc(t('pv.sp.meta', { n: 42 })) + '</small>' +
        '<div class="sp-ctl"><span class="sp-heart">♡</span><span class="sp-play">' + ic('play') + '</span></div>' +
        '<ol class="sp-list">' + tracks.map(function (x, i) { return '<li><span class="sp-n">' + (i + 1) + '</span><span><b>' + esc(x) + '</b><small>' + esc(name || 'QR-Codex') + '</small></span><em>' + ['3:41', '4:02', '3:18', '5:06', '3:55'][i] + '</em></li>'; }).join('') + '</ol></div>';
    },
    telegram: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : ''), on = exPhoto('telegram', ex) || (ex ? asset('assets/previews/menu.jpg') : ''), on2 = on ? asset('assets/previews/location.jpg') : '';
      var re = function (a, b) { return '<div class="tl-re"><span>❤️ ' + a + '</span><span>🔥 ' + b + '</span></div>'; };
      return '<div class="ph ph-tl">' + statusBar() + '<div class="tl-head">' + ic('back') + '<span class="tl-av">' + esc(initials(name) || 'T') + '</span><span><b>' + v(name, '50%') + '</b><small>' + esc(t('pv.tg.subs', { n: i18n.fmt.num(3420) })) + '</small></span></div>' +
        '<div class="tl-pin"><i></i><span>' + esc(t('pv.tg.m2')) + '</span></div>' +
        '<div class="tl-chat"><div class="tl-msg">' + (on ? '<div class="tl-img" style="background-image:url(' + on + ')"></div>' : '') + '<p>' + esc(t('pv.tg.m1')) + '</p>' + re(48, 12) + '<small>10:24 · 👁 ' + i18n.fmt.compact(2100) + '</small></div>' +
          '<div class="tl-msg">' + (on2 ? '<div class="tl-img s" style="background-image:url(' + on2 + ')"></div>' : '') + '<p>' + esc(t('pv.tg.m2')) + '</p>' + re(31, 7) + '<small>17:02 · 👁 ' + i18n.fmt.compact(1800) + '</small></div></div>' +
        '<button type="button" class="tl-join">' + esc(t('pv.tg.join')) + '</button></div>';
    },
    booking: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : ''), on = exPhoto('booking', ex) || (ex ? asset('assets/previews/menu.jpg') : ''), d = new Date();
      var days = [0, 1, 2, 3, 4].map(function (k) { var x = new Date(d.getTime() + k * 864e5); return '<span' + (k === 1 ? ' class="on"' : '') + '><small>' + esc(i18n.fmt.weekday((x.getDay() + 6) % 7).slice(0, 3)) + '</small><b>' + x.getDate() + '</b></span>'; }).join('');
      return '<div class="ph ph-bk">' + statusBar(!!on) + '<div class="bk-hero"' + (on ? ' style="background-image:url(' + on + ')"' : '') + '><b>' + v(name, '50%') + '</b><small>' + esc(t('pv.bk.title')) + '</small></div>' +
        '<div class="bk-body"><small class="bk-l">' + esc(t('pv.bk.date')) + '</small><div class="bk-days">' + days + '</div>' +
          '<small class="bk-l">' + esc(t('pv.bk.time')) + '</small><div class="bk-times">' + ['12:30', '13:00', '13:30', '19:30', '20:00', '20:30'].map(function (x, i) { return '<span' + (i === 4 ? ' class="on"' : '') + '>' + esc(i18n.fmt.time(x)) + '</span>'; }).join('') + '</div>' +
          '<small class="bk-l">' + esc(t('pv.bk.guests')) + '</small><div class="bk-guests"><span>−</span><b>' + esc(t('pv.bk.people', { n: 2 })) + '</b><span>+</span></div>' +
          '<button type="button" class="bk-go">' + esc(t('pv.bk.reserve')) + '</button></div></div>';
    },
    meeting: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : '');
      var tiles = [['Ana V.', 1], ['Jorge M.', 4], ['Lisa K.', 3]].map(function (p, i) { return '<span class="mt-tile" style="' + mesh(p[1]) + '"><b>' + esc(initials(p[0])) + '</b><em>' + (i === 0 ? ic('mic') : '') + esc(p[0]) + '</em></span>'; }).join('');
      return '<div class="ph ph-mt">' + statusBar(true) + '<div class="mt-top"><b>' + esc(t('pv.mt.title', { name: name || '…' })) + '</b><small>' + esc(t('pv.mt.others', { n: 3 })) + '</small></div>' +
        '<div class="mt-tiles">' + tiles + '<span class="mt-tile me"><span class="mt-me">' + ic('user') + '</span></span></div>' +
        '<div class="mt-ctl"><span>' + ic('mic') + '</span><span>' + ic('video') + '</span><span>' + ic('chat') + '</span><span class="end">' + ic('call') + '</span></div>' +
        '<button type="button" class="mt-join">' + esc(t('pv.mt.join')) + '</button></div>';
    },

    /* ---------- Tekst: titel en tekst, rustig leesbaar ---------- */
    text: function (c, ex) {
      var body = c.text || (ex ? t('sample.textBody') : '');
      return '<div class="ph ph-tx">' + statusBar() + (exPhoto('text', ex) ? '<div class="tx-hero"><img src="' + exPhoto('text', ex) + '" alt=""></div>' : '') + '<article class="tx-page"><span class="tx-ic">' + ic('doc') + '</span>' +
        '<h4>' + v(c.title || (ex ? t('sample.textTitle') : ''), '60%') + '</h4>' +
        (body ? '<div class="tx-body">' + body.split('\n').map(function (l) { var m = /^\s*(\d+)[.)]\s+(.*)$/.exec(l); return m ? '<span class="tx-li"><b>' + m[1] + '</b><span>' + esc(m[2]) + '</span></span>' : (l.trim() ? '<span>' + esc(l) + '</span>' : ''); }).join('') + '</div>' : '<p class="tx-body"><i class="sk" style="width:90%"></i><i class="sk" style="width:75%"></i><i class="sk" style="width:82%"></i></p>') +
        '<button type="button" class="tx-copy">' + ic('copy') + '<span>' + esc(t('pv.text.copy')) + '</span></button></article></div>';
    },

    /* ---------- Handleiding: product, PDF downloaden, uitlegvideo, klantenservice ---------- */
    manual: function (c, ex) {
      var f = FILES.parse(c.file), name = c.title || (ex ? t('sample.manualProduct') : ''), model = c.model || (ex ? t('sample.manualModel') : '');
      var size = f && f.s ? i18n.fmt.num(Math.round(f.s / 104857.6) / 10) + ' MB' : '';
      var exP = exPhoto('manual', ex), photo = c.photo || exP ? '<img src="' + (c.photo || exP) + '" alt="">' : '<span class="mn-ph">' + ic('book') + '</span>';
      return '<div class="ph ph-mn">' + statusBar(true) + '<div class="mn-top">' + photo + '</div>' +
        '<div class="mn-sheet"><span class="mn-tag">' + esc(t('pv.man.tag')) + '</span><h4>' + v(name, '60%') + '</h4>' + (model ? '<small class="mn-model">' + esc(model) + '</small>' : '') +
          '<button type="button" class="mn-dl">' + ic('save') + '<span><b>' + esc(t('pv.man.download')) + '</b><small>PDF' + (size ? ' · ' + size : '') + '</small></span></button>' +
          (c.video || ex ? '<button type="button" class="mn-row mn-video">' + ic('play') + '<span>' + esc(t('pv.man.video')) + '</span></button>' : '') +
          (c.phone || c.email || ex ? '<p class="mn-help">' + esc(t('pv.man.help')) + '</p><div class="mn-acts">' +
            (c.phone || ex ? '<button type="button" class="mn-call">' + ic('call') + '<span>' + esc(t('pv.man.call')) + '</span></button>' : '') +
            (c.email || ex ? '<button type="button" class="mn-mail">' + ic('mail') + '<span>' + esc(t('pv.man.mail')) + '</span></button>' : '') + '</div>' : '') +
        '</div></div>';
    },

    /* ---------- Gevonden?: foto, naam, bericht, bellen / mailen ---------- */
    lostfound: function (c, ex) {
      var name = c.name || (ex ? t('sample.lostName') : ''), msg = c.message || (ex ? t('sample.lostMsg') : '');
      var exP = exPhoto('lostfound', ex), photo = c.photo ? '<img class="lf-photo" src="' + c.photo + '" alt="">' : exP ? '<img class="lf-photo" src="' + exP + '" alt="">' : '<span class="lf-photo lf-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="2"/><circle cx="12" cy="5.5" r="2"/><circle cx="17" cy="8" r="2"/><path d="M12 11c-3 0-6 3.5-6 6.5 0 1.7 1.3 2.5 3 2.5 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.7 0 3-.8 3-2.5 0-3-3-6.5-6-6.5z"/></svg></span>';
      return '<div class="ph ph-lf">' + statusBar(true) + '<div class="lf-top">' + photo + '<span class="lf-tag">' + esc(t('pv.lost.tag')) + '</span></div>' +
        '<div class="lf-sheet"><h4>' + v(name, '50%') + '</h4>' + (msg ? '<p class="lf-msg">' + esc(msg) + '</p>' : '') +
          (c.reward ? '<p class="lf-reward">' + ic('gift') + '<span>' + esc(t('pv.lost.reward', { reward: c.reward })) + '</span></p>' : '') +
          '<button type="button" class="lf-call">' + ic('call') + '<span>' + esc(t('pv.lost.call')) + '</span></button>' +
          (c.email || ex ? '<button type="button" class="lf-mail">' + ic('mail') + '<span>' + esc(t('pv.lost.mail')) + '</span></button>' : '') +
          '<p class="lf-note">' + esc(t('pv.lost.note')) + '</p></div></div>';
    },

    /* ---------- Feedback: sterren, opmerking, eventueel e-mail (met toestemming) ---------- */
    feedback: function (c, ex) {
      var name = c.title || (ex ? EX_BIZ : ''), q = c.question || t('sample.fbQuestion');
      var stars = [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" class="fb-star' + (ex && i <= 4 ? ' on' : '') + '" data-n="' + i + '" aria-label="' + esc(t('pv.feedback.stars', { n: i })) + '">' + ic('star') + '</button>'; }).join('');
      return '<div class="ph ph-fb">' + statusBar() +
        (exPhoto('feedback', ex) ? '<div class="fb-hero"><img src="' + exPhoto('feedback', ex) + '" alt=""></div>' : '') +
        '<div class="fb-form"><div class="fb-head">' + (c.logo ? '<img class="fb-logo" src="' + c.logo + '" alt="">' : '<span class="fb-logo fb-ini">' + esc(initials(name) || '★') + '</span>') + '<b>' + v(name, '50%') + '</b></div>' +
          '<h4 class="fb-q">' + esc(q) + '</h4><div class="fb-stars" role="radiogroup" aria-label="' + esc(q) + '">' + stars + '</div>' +
          '<label class="fb-lbl"><span>' + esc(t('pv.feedback.comment')) + '</span><textarea class="fb-text" rows="3" maxlength="1000" placeholder="' + esc(t('pv.feedback.commentPh')) + '"></textarea></label>' +
          (c.askEmail ? '<label class="fb-lbl"><span>' + esc(t('pv.feedback.email')) + '</span><input class="fb-email" type="email" maxlength="200" autocomplete="email" placeholder="name@example.com"></label>' +
            '<label class="fb-consent"><input type="checkbox" class="fb-ok"><span>' + esc(t('pv.feedback.consent', { name: name || 'QR-Codex' })) + '</span></label>' : '') +
          '<button type="button" class="fb-send">' + esc(t('pv.feedback.send')) + '</button><p class="fb-err" hidden></p>' +
          '<p class="fb-note">' + esc(t('pv.feedback.note')) + '</p></div>' +
        '<div class="fb-done" hidden><span class="fb-check">' + ic('star') + '</span><h4>' + esc(c.thanks || t('sample.fbThanks')) + '</h4>' +
          (c.reviewUrl ? '<button type="button" class="fb-review" hidden>' + esc(t('pv.feedback.review')) + '</button>' : '') + '</div>' +
      '</div>';
    },

    /* ---------- Evenement: datum, tijd, plaats en "Zet in agenda" ---------- */
    event: function (c, ex) {
      var sd = c.startDate || (ex ? new Date(Date.now() + 16 * 864e5).toISOString().slice(0, 10) : ''), st = c.startTime || (ex ? '19:30' : ''), et = c.endTime || (ex ? '23:00' : ''), ed = c.endDate;
      var d = sd ? new Date(sd + 'T12:00:00') : null, e2 = ed && ed !== sd ? new Date(ed + 'T12:00:00') : null;
      var mon = ''; try { mon = d ? new Intl.DateTimeFormat(i18n.lang(), { month: 'short' }).format(d).replace('.', '') : ''; } catch (x) { mon = ''; }
      var when = d ? i18n.fmt.weekday((d.getDay() + 6) % 7) + ', ' + i18n.fmt.date(d, 'long') + (e2 ? ' – ' + i18n.fmt.date(e2, 'long') : '') : '';
      var time = st ? i18n.fmt.time(st) + (et ? ' – ' + i18n.fmt.time(et) : '') : (d ? t('pv.event.allDay') : '');
      var addr = ADDRESS.parse(c.address), place = addr ? addr.l.split(',') : [];
      var exc = !c.cover && exPhoto('event', ex);
      var cover = c.cover || exc ? '<img decoding="sync" src="' + (c.cover || exc) + '" alt="">' : '<div class="ev-art" aria-hidden="true"><b>' + (d ? d.getDate() : '') + '</b><span>' + esc(mon) + '</span></div>';
      return '<div class="ph ph-ev">' +
        '<div class="ev-cover">' + cover + statusBar(true) + '<div class="gm-tb"><span>' + ic('back') + '</span><span>' + ic('share') + '</span></div></div>' +
        '<div class="ev-sheet">' +
          '<div class="ev-head"><div class="ev-date"><small>' + (mon ? esc(mon) : '<i class="sk" style="width:22px"></i>') + '</small><b>' + (d ? d.getDate() : '<i class="sk" style="width:20px;height:18px"></i>') + '</b></div>' +
            '<h4>' + v(c.title, '70%') + '</h4></div>' +
          '<div class="ev-row">' + ic('clock') + '<span><b>' + (when ? esc(when) : '<i class="sk" style="width:70%"></i>') + '</b>' + (time ? '<small>' + esc(time) + '</small>' : '') + '</span></div>' +
          '<div class="ev-row ev-place">' + ic('pin') + '<span><b>' + (place.length ? esc(place[0]) : '<i class="sk" style="width:55%"></i>') + '</b>' + (place.length > 1 ? '<small>' + esc(place.slice(1).join(',').trim()) + '</small>' : '') + '</span></div>' +
          (c.description ? '<p class="ev-desc">' + esc(c.description) + '</p>' : '<p class="ev-desc"><i class="sk" style="width:90%"></i><i class="sk" style="width:60%"></i></p>') +
          '<div class="ev-acts"><button type="button" class="ev-add">' + ic('cal') + '<span>' + esc(t('pv.event.add')) + '</span></button>' +
            '<div class="ev-sub"><button type="button" class="ev-gcal">' + esc(t('pv.event.google')) + '</button>' +
            (addr ? '<button type="button" class="ev-route">' + ic('pin') + '<span>' + esc(t('pv.event.route')) + '</span></button>' : '') + '</div>' +
            (c.url ? '<button type="button" class="ev-more">' + ic('globe') + '<span>' + esc(t('pv.event.more')) + '</span></button>' : '') + '</div>' +
        '</div>' +
      '</div>';
    }
  };
})();

/* Elke minuut: klokjes bijwerken; schermen met open/dicht opnieuw tekenen. */
(function () {
  function tick() {
    document.querySelectorAll('#screen [data-clock]').forEach(function (el) {
      var d = new Date(Date.now() + (+el.getAttribute('data-clock')) * 60000), h = d.getHours();
      if (i18n.lang() === 'en') h = h % 12 || 12;
      el.textContent = h + ':' + ('0' + d.getMinutes()).slice(-2);
    });
    if (document.querySelector('#screen .bz-status')) document.dispatchEvent(new Event('preview:refresh'));
  }
  setTimeout(function () { tick(); setInterval(tick, 60000); }, 60000 - Date.now() % 60000 + 50);
})();
