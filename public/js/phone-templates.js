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
    save: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'
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

  function initials(name) { return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(''); }
  function domain(url) { return (url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]; }

  // Mockup-foto zolang het bedrijf nog geen eigen foto heeft: een winkelpui in de paginakleur.
  function storefront(name) {
    var label = esc((name || 'Bloom & Co').slice(0, 22));
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

    /* ---------- Instagram: het profiel dat opent ---------- */
    instagram: function (c, ex) {
      var u = c.username ? c.username.replace(/^@/, '') : '';
      var stat = function (n, k) { return '<span><b>' + (ex ? n : '<i class="sk" style="width:26px"></i>') + '</b><small>' + esc(t('pv.instagram.' + k)) + '</small></span>'; };
      var tiles = ['#f58529,#dd2a7b', '#515bd4,#8134af', '#2bb5f0,#1e3a8a', '#fcd34d,#f97316', '#10b981,#0f766e', '#f472b6,#7c3aed'];
      return '<div class="ph ph-ig">' + statusBar() +
        '<div class="ig-head">' + ic('back') + '<b>' + v(u, '110px') + (ex ? '<span class="ig-ver">' + ic('check', 'i') + '</span>' : '') + '</b>' + ic('bell') + ic('dots', 'i dots') + '</div>' +
        '<div class="ig-prof"><span class="ig-av"><span>' + (u ? esc(u[0].toUpperCase()) : ic('user')) + '</span></span>' +
          '<div class="ig-stats">' + stat('86', 'posts') + stat('3.1K', 'followers') + stat('312', 'following') + '</div></div>' +
        '<div class="ig-bio"><b>' + (ex ? 'Studio Luna' : v(u, '40%')) + '</b>' +
          (ex ? '<small>' + esc(t('pv.instagram.category')) + '</small><p>' + esc(t('pv.instagram.bio')) + ' 📸</p><a>studioluna.com</a>' : '<i class="sk" style="width:85%"></i><i class="sk" style="width:60%"></i>') + '</div>' +
        '<div class="ig-btns"><span class="pri">' + esc(t('pv.instagram.cta')) + '</span><span>' + esc(t('pv.instagram.message')) + '</span><span>' + esc(t('pv.instagram.contact')) + '</span><span class="ic">' + ic('addp') + '</span></div>' +
        '<div class="ig-hl">' + [1, 2, 3, 4, 5].map(function (i) { return '<span' + (ex ? ' style="background:linear-gradient(135deg,' + tiles[i] + ')"' : '') + '></span>'; }).join('') + '</div>' +
        '<div class="ig-tabs"><span class="on">' + ic('grid') + '</span><span>' + ic('reel') + '</span><span>' + ic('tag') + '</span></div>' +
        '<div class="ig-grid">' + tiles.map(function (g) { return '<span' + (ex ? ' style="background:linear-gradient(135deg,' + g + ')"' : '') + '></span>'; }).join('') + '</div>' +
        '<div class="ig-nav">' + ic('home') + ic('search') + ic('plus') + ic('reel') + '<span class="ig-me">' + (u ? esc(u[0].toUpperCase()) : '') + '</span></div>' +
      '</div>';
    },

    /* ---------- Website: de site in de browser, met het adres onderin ---------- */
    website: function (c, ex) {
      var d = domain(c.url);
      return '<div class="ph ph-web">' + statusBar() +
        '<div class="web-page">' +
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
          '<span class="vc-av">' + (c.name ? esc(initials(c.name)) : ic('user')) + '</span>' +
          '<h4>' + v(c.name, '50%') + '</h4><p>' + (c.role || c.company ? esc([c.role, c.company].filter(Boolean).join(' · ')) : '<i class="sk" style="width:45%;margin:0 auto"></i>') + '</p>' +
          '<div class="vc-acts">' + act('call', t('pv.vcard.phone')) + act('mail', t('pv.vcard.email')) + act('globe', t('pv.vcard.website')) + act('pin', t('pv.vcard.route')) + '</div></div>' +
        '<div class="vc-list">' + row('call', t('pv.vcard.phone'), c.phone, '55%') + row('mail', t('pv.vcard.email'), c.email, '65%') + row('globe', t('pv.vcard.website'), domain(c.website), '50%') + row('pin', t('fields.address'), c.address, '70%') + '</div>' +
        '<div class="vc-save">' + ic('save') + esc(t('pv.vcard.cta')) + '</div>' +
      '</div>';
    },

    /* ---------- Lijst met links: profiel met knoppen ---------- */
    links: function (c, ex) {
      var keys = ['link1', 'link2', 'link3'];
      return '<div class="ph ph-lk">' + statusBar(true) +
        '<div class="lk-share">' + ic('share') + '</div>' +
        '<span class="lk-av">' + (c.title ? esc(initials(c.title)) : ic('user')) + '</span>' +
        '<h4>' + v(c.title, '45%') + '</h4><p>' + (ex ? esc(t('pv.links.sub')) : '<i class="sk" style="width:55%;margin:0 auto"></i>') + '</p>' +
        '<div class="lk-list">' + keys.map(function (k) { return '<span>' + ic('link') + '<b>' + v(c[k], '55%') + '</b>' + ic('dots', 'i dots') + '</span>'; }).join('') + '</div>' +
        '<div class="lk-soc"><i></i><i></i><i></i><i></i></div>' +
      '</div>';
    },

    /* ---------- Bedrijf: bedrijfspagina met openingstijden en contact ---------- */
    business: function (c, ex) {
      var row = function (icon, main, sub) { return '<div class="bz-row"><span class="bz-ic">' + ic(icon) + '</span><span><b>' + main + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></div>'; };
      return '<div class="ph ph-bz">' +
        '<div class="bz-band">' + statusBar(true) + '<div class="bz-top">' + ic('back') + '<b>' + v(c.name, '120px') + '</b>' + ic('share') + '</div></div>' +
        '<div class="bz-scroll">' +
          '<div class="bz-card"><div class="bz-cover">' + (c.cover ? '<img src="' + c.cover + '" alt="">' : storefront(c.name)) + '</div>' +
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
