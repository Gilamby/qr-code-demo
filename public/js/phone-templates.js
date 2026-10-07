/* =========================================================
   TELEFOON-SJABLONEN: per type een echt scherm.
   - Stap 1 (voorbeeld): ex = true, alle velden gevuld met voorbeeldwaarden.
   - Stap 2/3: alleen wat de gebruiker invult; lege velden = grijze balkjes.
   Nog geen sjabloon voor een type? Dan valt de preview terug op de oude kaart.
   ========================================================= */
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
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>'
  };
  function ic(k, cls) { return '<svg class="' + (cls || 'i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + I[k] + '</svg>'; }
  // Waarde of grijs balkje
  function v(val, w) { return val ? esc(val) : '<i class="sk" style="width:' + (w || '60%') + '"></i>'; }
  function statusBar(light) {
    return '<div class="sb' + (light ? ' light' : '') + '"><b>9:41</b><span>' +
      '<svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx=".6"/><rect x="5" y="5.5" width="3" height="6.5" rx=".6"/><rect x="10" y="3" width="3" height="9" rx=".6"/><rect x="15" y="0" width="3" height="12" rx=".6"/></svg>' +
      '<svg viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 0 0 8 .4 10.6 10.6 0 0 0 .5 3.4l1.3 1.3A8.7 8.7 0 0 1 8 2.2zm0 3.6c1.4 0 2.7.5 3.7 1.5l1.3-1.3A7 7 0 0 0 8 4 7 7 0 0 0 3 6l1.3 1.3c1-1 2.3-1.5 3.7-1.5zM8 9.4l2.1-2.1a3 3 0 0 0-4.2 0z"/></svg>' +
      '<i class="bat"><i></i></i></span></div>';
  }

  return {
    /* ---------- WhatsApp: precies het chatscherm dat opent ---------- */
    whatsapp: function (c, ex) {
      var msgs = ex
        ? '<div class="wa-in">' + esc(t('pv.whatsapp.m1')) + '<time>10:02</time></div>' +
          '<div class="wa-out">' + esc(c.message) + '<time>10:03 <em>✓✓</em></time></div>' +
          '<div class="wa-in">' + esc(t('pv.whatsapp.m3')) + '<time>10:04</time></div>'
        : (c.message ? '<div class="wa-out">' + esc(c.message) + '<time>10:03 <em>✓✓</em></time></div>'
                     : '<div class="wa-out sk-bub"><i class="sk"></i><i class="sk" style="width:70%"></i></div>');
      return '<div class="ph ph-wa">' + statusBar(true) +
        '<div class="wa-head">' + ic('back') + '<span class="wa-av">' + ic('user') + '</span>' +
          '<span class="wa-name"><b>' + v(c.phone, '110px') + '</b><small>' + esc(t('pv.whatsapp.online')) + '</small></span>' +
          ic('video') + ic('call') + ic('dots', 'i dots') + '</div>' +
        '<div class="wa-body"><div class="wa-pill">' + ic('lock', 'i s') + esc(t('pv.whatsapp.encrypted')) + '</div>' + msgs + '</div>' +
        '<div class="wa-bar"><div class="wa-input">' + ic('smile') + '<span>' + esc(t('pv.whatsapp.input')) + '</span>' + ic('clip') + ic('cam') + '</div><b class="wa-send">' + ic('send') + '</b></div>' +
      '</div>';
    },

    /* ---------- Bedrijf: bedrijfspagina met openingstijden en contact ---------- */
    business: function (c, ex) {
      var row = function (icon, main, sub) { return '<div class="bz-row"><span class="bz-ic">' + ic(icon) + '</span><span><b>' + main + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></div>'; };
      return '<div class="ph ph-bz">' +
        '<div class="bz-band">' + statusBar(true) + '<div class="bz-top">' + ic('back') + '<b>' + v(c.name, '120px') + '</b>' + ic('share') + '</div></div>' +
        '<div class="bz-scroll">' +
          '<div class="bz-card"><div class="bz-cover">' + ic('store', 'bz-store') + '</div>' +
            '<h4>' + v(c.name, '55%') + '</h4><p>' + (c.description ? esc(c.description) : '<i class="sk"></i><i class="sk" style="width:75%"></i>') + '</p>' +
            '<div class="bz-cta">' + esc(t('pv.business.cta')) + '</div></div>' +
          '<div class="bz-list">' +
            row('clock', esc(t('pv.business.hours')) + ' · <em>' + esc(t('pv.business.openNow')) + '</em>', v(c.hours, '70%')) +
            row('pin', v(c.address, '75%')) +
            row('call', v(c.phone, '55%')) +
            row('mail', v(c.email, '65%')) +
          '</div>' +
        '</div>' +
        '<span class="bz-fab">' + ic('dots') + '</span>' +
      '</div>';
    }
  };
})();
