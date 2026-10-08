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
    gift: '<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1s3 1 5 1zM12 7c1.5-3 5-3.5 5-1s-3 1-5 1z"/>'
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
    statusBar: statusBar,
    /* ---------- WhatsApp: precies het chatscherm dat opent ---------- */
    whatsapp: function (c, ex) {
      var msgs = ex
        ? '<div class="wa-in">' + esc(t('pv.whatsapp.m1')) + '<time>' + liveClock(-6) + '</time></div>' +
          '<div class="wa-out">' + esc(c.message) + '<time>' + liveClock(-4) + ' <em>✓✓</em></time></div>' +
          '<div class="wa-in">' + esc(t('pv.whatsapp.m3')) + '<time>' + liveClock(-1) + '</time></div>'
        : (c.message ? '<div class="wa-out">' + esc(c.message) + '<time>' + liveClock(0) + ' <em>✓✓</em></time></div>'
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
        '<div class="ig-bio"><b>' + (ex ? 'Marco Ferrer' : v(u, '40%')) + '</b>' +
          (ex ? '<small>' + esc(t('pv.instagram.category')) + '</small><p>' + esc(t('pv.instagram.bio')) + ' 📸</p><a>marcoferrer.com</a>' : '<i class="sk" style="width:85%"></i><i class="sk" style="width:60%"></i>') + '</div>' +
        '<div class="ig-btns"><span class="pri">' + esc(t('pv.instagram.cta')) + '</span><span>' + esc(t('pv.instagram.message')) + '</span><span>' + esc(t('pv.instagram.contact')) + '</span><span class="ic">' + ic('addp') + '</span></div>' +
        '<div class="ig-hl">' + [1, 2, 3, 4, 5].map(function (i) { return '<span' + (ex ? ' style="background:linear-gradient(135deg,' + tiles[i] + ')"' : '') + '></span>'; }).join('') + '</div>' +
        '<div class="ig-tabs"><span class="on">' + ic('grid') + '</span><span>' + ic('reel') + '</span><span>' + ic('tag') + '</span></div>' +
        '<div class="ig-grid">' + tiles.map(function (g) { return '<span' + (ex ? ' style="background:linear-gradient(135deg,' + g + ')"' : '') + '></span>'; }).join('') + '</div>' +
        '<div class="ig-nav">' + ic('home') + ic('search') + ic('plus') + ic('reel') + '<span class="ig-me">' + (u ? esc(u[0].toUpperCase()) : '') + '</span></div>' +
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
          '<span class="vc-av">' + (c.name ? esc(initials(c.name)) : ic('user')) + '</span>' +
          '<h4>' + v(c.name, '50%') + '</h4><p>' + (c.role || c.company ? esc([c.role, c.company].filter(Boolean).join(' · ')) : '<i class="sk" style="width:45%;margin:0 auto"></i>') + '</p>' +
          '<div class="vc-acts">' + act('call', t('pv.vcard.phone')) + act('mail', t('pv.vcard.email')) + act('globe', t('pv.vcard.website')) + act('pin', t('pv.vcard.route')) + '</div></div>' +
        '<div class="vc-list">' + row('call', t('pv.vcard.phone'), c.phone, '55%') + row('mail', t('pv.vcard.email'), c.email, '65%') + row('globe', t('pv.vcard.website'), domain(c.website), '50%') + row('pin', t('fields.address'), c.address, '70%') + '</div>' +
        '<div class="vc-save">' + ic('save') + esc(t('pv.vcard.cta')) + '</div>' +
      '</div>';
    },

    /* ---------- Lijst met links: omslag, profiel, één uitgelichte link en een nette lijst ---------- */
    links: function (c, ex) {
      var keys = ['link1', 'link2', 'link3'];
      var clean = function (x) { return String(x || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''); };
      var sk = function (w) { return '<i class="sk" style="width:' + w + '"></i>'; };
      var label = function (k) { var val = clean(c[k]); return /\.[a-z]{2,}/i.test(val) ? (val.split('/').pop() || val) : val; };
      var dom = function (k) { var val = clean(c[k]); return /\.[a-z]{2,}/i.test(val) ? val.split('/')[0] : ''; };
      var first = c[keys[0]];
      return '<div class="ph ph-lk2">' +
        '<div class="lk2-cover">' + statusBar(true) + '<span class="lk2-share">' + ic('share') + '</span></div>' +
        '<div class="lk2-prof"><span class="lk2-av">' + (c.title ? esc(initials(c.title)) : ic('user')) + '</span>' +
          '<h4>' + (c.title ? esc(c.title) : sk('55%')) + '</h4><p>' + (ex ? esc(t('pv.links.sub')) : sk('45%')) + '</p></div>' +
        '<div class="lk2-feat lk2-row" data-i="0"><span class="lk2-img"><i>' + ic('fwd') + '</i></span>' +
          '<span class="lk2-txt"><small>' + esc(t('pv.links.featured')) + '</small><b>' + (first ? esc(label(keys[0])) : sk('60%')) + '</b>' + (dom(keys[0]) ? '<em>' + esc(dom(keys[0])) + '</em>' : '') + '</span></div>' +
        '<div class="lk2-list">' + keys.slice(1).map(function (k, j) {
          return '<span class="lk2-row" data-i="' + (j + 1) + '"><i class="lk2-th t' + j + '"></i><span><b>' + (c[k] ? esc(label(k)) : sk('55%')) + '</b>' + (dom(k) ? '<small>' + esc(dom(k)) + '</small>' : '') + '</span>' + ic('fwd') + '</span>';
        }).join('') + '</div>' +
      '</div>';
    },

    /* ---------- PDF: het document in een echte PDF-viewer ---------- */
    pdf: function (c, ex) {
      var o = FILES.parse(c.file), name = o ? o.n : (c.title ? c.title + '.pdf' : '');
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
      var d = domain(c.url), yt = (c.url || '').match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);
      return '<div class="ph ph-vid">' + statusBar(true) +
        '<div class="vd-top">' + ic('back') + '<span>' + v(d, '100px') + '</span>' + ic('share') + '</div>' +
        '<div class="vd-player"' + (yt ? ' style="background-image:url(https://img.youtube.com/vi/' + yt[1] + '/hqdefault.jpg)"' : '') + '><span class="vd-play">' + ic('play') + '</span>' +
          '<div class="vd-bar"><i></i></div><small class="vd-time">0:24 / 1:42</small></div>' +
        '<div class="vd-info"><h4>' + v(c.title, '75%') + '</h4>' +
          '<div class="vd-ch"><span class="vd-av">' + (d ? esc(d[0].toUpperCase()) : '') + '</span><b>' + v(d, '90px') + '</b></div>' +
          '<p>' + (c.description ? esc(c.description) : '<i class="sk"></i><i class="sk" style="width:80%"></i><i class="sk" style="width:55%"></i>') + '</p></div>' +
        '<div class="vd-btn">' + ic('play') + esc(t('pv.video.watch')) + '</div>' +
      '</div>';
    },

    /* ---------- Afbeeldingen: grote foto bovenaan, daaronder een strak raster ---------- */
    images: function (c, ex) {
      var list = FILES.list(c.photos), n = list.length || (ex ? 12 : 0);
      var tile = function (i, cls) {
        if (list[i]) return '<span class="' + cls + '" style="background-image:url(' + list[i] + ')"></span>';
        if (ex) return '<span class="' + cls + ' gx-mesh" style="' + mesh(i) + '"></span>';
        return '<span class="' + cls + ' gx-none">' + ic('img') + '</span>';
      };
      var date = new Intl.DateTimeFormat(i18n.lang(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
      return '<div class="ph ph-gx">' +
        '<div class="gx-hero">' + tile(0, 'gx-hero-img') + statusBar(true) +
          '<div class="gx-cap"><small>' + esc(t('pv.images.album')) + '</small><h4>' + (c.title ? esc(c.title) : '<i class="sk" style="width:65%;height:18px"></i>') + '</h4>' +
            '<p>' + (n ? esc(t('pv.images.count', { count: i18n.fmt.num(n) })) + ' · ' + esc(date) : '<i class="sk" style="width:45%"></i>') + '</p></div></div>' +
        (c.description ? '<p class="gx-desc">' + esc(c.description) + '</p>' : '') +
        '<div class="gx-grid">' + [1, 2, 3, 4, 5, 6].map(function (i) { return tile(i, 'gx-t'); }).join('') + '</div>' +
        '<div class="gx-dl">' + ic('save') + esc(t('pv.images.cta')) + '</div>' +
      '</div>';
    },

    /* ---------- Facebook: de pagina zoals in de app ---------- */
    facebook: function (c, ex) {
      var name = c.pageName;
      return '<div class="ph ph-fb">' + statusBar() +
        '<div class="fb-nav"><b>facebook</b><span>' + ic('search') + ic('chat') + '</span></div>' +
        '<div class="fb-cover"></div>' +
        '<div class="fb-prof"><span class="fb-av">' + (name ? esc(initials(name)) : ic('user')) + '</span>' +
          '<h4>' + v(name, '55%') + (ex ? '<span class="fb-ver">' + ic('check') + '</span>' : '') + '</h4>' +
          '<small>' + (ex ? esc(t('pv.facebook.likes', { count: i18n.fmt.num(1240) })) + ' · ' + esc(t('pv.facebook.followers', { count: i18n.fmt.num(1310) })) : '<i class="sk" style="width:70%"></i>') + '</small>' +
          (c.description ? '<p>' + esc(c.description) + '</p>' : '') +
          '<div class="fb-btns"><span class="pri">' + ic('like') + esc(t('pv.facebook.like')) + '</span><span>' + ic('chat') + esc(t('pv.facebook.message')) + '</span><span class="sq">' + ic('dots', 'i dots') + '</span></div></div>' +
        '<div class="fb-tabs"><span class="on">' + esc(t('pv.facebook.tabPosts')) + '</span><span>' + esc(t('pv.facebook.tabAbout')) + '</span><span>' + esc(t('pv.facebook.tabPhotos')) + '</span></div>' +
        '<div class="fb-post"><div class="fb-ph"><span class="fb-av s">' + (name ? esc(initials(name)) : '') + '</span><span><b>' + v(name, '90px') + '</b><small>' + esc(t('pv.facebook.time')) + '</small></span></div>' +
          '<i class="sk" style="width:90%"></i><i class="sk" style="width:60%"></i><div class="fb-img"></div></div>' +
      '</div>';
    },

    /* ---------- Social media: donkere, chique pagina met een glazen kaart per kanaal ---------- */
    social: function (c, ex) {
      var so = SOCIALS.parse(c.socials), nets = SOCIALS.LIST.filter(function (n) { return n.id in so; });
      var handle = function (url) { var m = String(url || '').replace(/\/$/, '').split('/').pop(); return m ? (m[0] === '@' ? m : '@' + m) : ''; };
      return '<div class="ph ph-sx"><i class="sx-glow a"></i><i class="sx-glow b"></i>' + statusBar(true) +
        '<div class="sx-prof"><span class="sx-ring"><span class="sx-av">' + (c.title ? esc(initials(c.title)) : ic('user')) + '</span></span>' +
          '<h4>' + (c.title ? esc(c.title) : '<i class="sk" style="width:45%;margin:0 auto"></i>') + '</h4>' +
          '<p>' + (c.description ? esc(c.description) : '<i class="sk" style="width:60%;margin:0 auto"></i>') + '</p>' +
          (nets.length ? '<div class="sx-quick">' + nets.slice(0, 5).map(function (n) { return SOCIALS.icon(n.id); }).join('') + '</div>' : '') + '</div>' +
        '<div class="sx-list">' + (nets.length ? nets.slice(0, 6).map(function (n) {
            return '<span class="sx-card"><i class="sx-ic sx-' + n.id + '">' + SOCIALS.icon(n.id) + '</i><span><b>' + esc(n.name) + '</b><small>' + esc(handle(so[n.id])) + '</small></span>' + ic('fwd') + '</span>';
          }).join('') : [1, 2, 3].map(function () { return '<span class="sx-card"><i class="sx-ic sx-empty"></i><span><i class="sk" style="width:50%"></i><i class="sk" style="width:35%"></i></span></span>'; }).join('')) + '</div>' +
      '</div>';
    },

    /* ---------- MP3: muziekspeler ---------- */
    mp3: function (c, ex) {
      var o = FILES.parse(c.file), secs = o ? Math.max(30, Math.round(o.s / 16000)) : 192;
      var mm = function (x) { return Math.floor(x / 60) + ':' + ('0' + (x % 60)).slice(-2); };
      return '<div class="ph ph-mp3">' + statusBar(true) +
        '<div class="mp-top">' + ic('back') + '<small>' + esc(t('pv.mp3.nowPlaying')) + '</small>' + ic('dots', 'i dots') + '</div>' +
        '<div class="mp-art">' + (c.cover ? '<img src="' + c.cover + '" alt="">' : ic('note')) + '</div>' +
        '<div class="mp-info"><h4>' + v(c.title, '60%') + '</h4><p>' + v(c.artist, '40%') + '</p></div>' +
        '<div class="mp-bar"><i style="width:' + (o || ex ? 25 : 0) + '%"></i></div><div class="mp-time"><span>' + mm(Math.round(secs / 4)) + '</span><span>' + mm(secs) + '</span></div>' +
        '<div class="mp-ctrl">' + ic('prev') + '<span class="mp-play">' + ic('play') + '</span>' + ic('next') + '</div>' +
        '<div class="mp-file">' + ic('save') + (o ? esc(o.n) : esc(t('pv.mp3.download'))) + '</div>' +
      '</div>';
    },

    /* ---------- Menu: de menukaart van het restaurant ---------- */
    menu: function (c, ex) {
      var list = FILES.list(c.dishes);
      var price = function (p) { var n = parseFloat(String(p || '').replace(',', '.')); return isNaN(n) ? '' : i18n.fmt.eur(n); };
      return '<div class="ph ph-menu">' +
        '<div class="mn-cover">' + (c.cover ? '<img src="' + c.cover + '" alt="">' : '<svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="320" height="140" fill="#3b2a20"/><circle cx="160" cy="92" r="70" fill="#f4efe6"/><circle cx="160" cy="92" r="52" fill="#fff"/><circle cx="148" cy="84" r="14" fill="#e07a2f"/><circle cx="172" cy="96" r="12" fill="#6a994e"/><circle cx="160" cy="104" r="9" fill="#bc4749"/><path d="M60 20v60M52 20v22a8 8 0 0 0 16 0V20M262 20c10 10 12 30 0 40v30" stroke="#d9c7a7" stroke-width="5" fill="none" stroke-linecap="round"/></svg>') +
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
      var badge = function (kind) {
        return kind === 'ios' ? '<span class="ap-badge"><svg viewBox="0 0 24 24" fill="#fff"><path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.9-.8-3.1-.8C6.8 7.3 5.3 8.2 4.5 9.7c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.6-1-2.7-4.1zM14.1 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z"/></svg><span><small>' + esc(t('pv.apps.get')) + '</small><b>App Store</b></span></span>'
          : '<span class="ap-badge"><svg viewBox="0 0 24 24"><path d="M4 3.2l9.6 9.3L4 21.8c-.4-.2-.6-.6-.6-1.1V4.3c0-.5.2-.9.6-1.1z" fill="#34a853"/><path d="M16.8 9.4l-3.2 3.1 3.2 3.1 3.6-2c.9-.5.9-1.8 0-2.3z" fill="#fbbc04"/><path d="M13.6 12.5L4 3.2c.3-.2.8-.2 1.2 0l11.6 6.2z" fill="#4285f4"/><path d="M13.6 12.5l3.2 3.1-11.6 6.2c-.4.2-.9.2-1.2 0z" fill="#ea4335"/></svg><span><small>' + esc(t('pv.apps.getPlay')) + '</small><b>Google Play</b></span></span>';
      };
      var stores = (ex || c.ios ? badge('ios') : '') + (ex || c.android ? badge('android') : '');
      return '<div class="ph ph-as">' + statusBar() +
        '<div class="as-nav">' + ic('back') + '<span>' + esc(t('pv.apps.search')) + '</span></div>' +
        '<div class="as-top"><span class="as-icon">' + (c.logo ? '<img src="' + c.logo + '" alt="">' : (name ? esc(initials(name)) : ic('img'))) + '</span>' +
          '<div class="as-meta"><b>' + v(name, '70%') + '</b><small>' + (c.description ? esc(c.description) : '<i class="sk" style="width:85%"></i>') + '</small>' +
          '<div class="as-get"><span>' + esc(t('pv.apps.download')) + '</span>' + ic('share') + '</div></div></div>' +
        '<div class="as-stats"><span><small>' + esc(t('pv.apps.ratings')) + '</small><b>' + i18n.fmt.num(4.8) + '</b><em>★★★★★</em></span><span><small>' + esc(t('pv.apps.age')) + '</small><b>4+</b><em>' + esc(t('pv.apps.years')) + '</em></span><span><small>' + esc(t('pv.apps.chart')) + '</small><b>#12</b><em>' + esc(cat) + '</em></span></div>' +
        '<div class="as-shots">' + [0, 1, 2].map(shot).join('') + '</div>' +
        '<div class="as-stores">' + (stores || '<span class="ap-badge ap-empty"><i class="sk"></i></span>') + '</div>' +
      '</div>';
    },

    /* ---------- Coupon: een Wallet-achtige kaart met grote korting, scanbare code en kopieerknop ---------- */
    coupon: function (c, ex) {
      var exp = c.expires || (ex ? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) : '');
      var date = exp ? new Intl.DateTimeFormat(i18n.lang(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(exp + 'T12:00:00')) : '';
      var qr = c.code && typeof QRRender !== 'undefined' ? QRRender.svg(c.code, { color: '#000000' }) : '';
      return '<div class="ph ph-wl">' + statusBar(true) +
        '<div class="wl-nav"><b>' + esc(t('pv.pdf.done')) + '</b>' + ic('dots', 'i dots') + '</div>' +
        '<div class="wl-pass">' +
          '<div class="wl-row"><span class="wl-logo">' + ic('gift') + '</span><b class="wl-co">' + (c.company ? esc(c.company) : '<i class="sk" style="width:80px"></i>') + '</b></div>' +
          // De korting is het belangrijkste: groot en als eerste
          '<div class="wl-off">' + (c.discount ? '<b>' + esc(c.discount) + '<em>%</em></b><span>' + esc(t('pv.coupon.off')) + '</span>' : '<i class="sk" style="width:120px;height:46px"></i>') + '</div>' +
          '<div class="wl-big"><small>' + esc(t('pv.coupon.offer')) + '</small><b>' + (c.title ? esc(c.title) : '<i class="sk" style="width:70%;height:16px"></i>') + '</b></div>' +
          '<div class="wl-row f2"><span class="wl-f"><small>' + esc(t('pv.coupon.validLbl')) + '</small><b>' + (date ? esc(date) : '–') + '</b></span><span class="wl-f r"><small>' + esc(t('pv.coupon.yourCode')) + '</small><b>' + (c.code ? esc(c.code) : '–') + '</b></span></div>' +
          '<div class="wl-code"><span>' + (qr || '<i class="wl-qr-sk"></i>') + '</span><small>' + (c.code ? esc(c.code) : '') + '</small></div>' +
        '</div>' +
        (c.terms ? '<p class="wl-terms">' + esc(c.terms) + '</p>' : '') +
        '<button type="button" class="wl-add" data-copy="' + esc(c.code || '') + '">' + ic('copy') + '<span>' + esc(t('pv.coupon.cta')) + '</span></button>' +
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
        '<div class="gm-cover">' + (c.cover ? '<img src="' + c.cover + '" alt="">' : storefront(c.name)) + statusBar(true) +
          '<div class="gm-tb"><span>' + ic('back') + '</span><span>' + ic('share') + '</span></div></div>' +
        '<div class="gm-sheet"><i class="gm-grab"></i>' +
          '<h4>' + v(c.name, '55%') + '</h4>' +
          '<div class="gm-rate"><b>' + i18n.fmt.num(4.7) + '</b><em>★★★★★</em><small>(128)</small></div>' +
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
