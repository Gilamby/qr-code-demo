/* =========================================================
   INSTELLINGEN (voor iedereen, zijbalk onder "Mijn account")
   Eén overzicht met alles wat erbij hoort maar je niet elke dag nodig hebt:
   - Account: profiel, beveiliging, meldingen, voorkeuren, achtergrond   → Mijn account (tabblad)
   - Facturatie: factuurgegevens, abonnement en facturen                 → Mijn account (tabblad)
   - Privacy en juridisch: privacyverklaring, voorwaarden, cookies        → Privacy-pagina
                           mijn gegevens, account verwijderen             → Mijn account (tabblad)
   - Hulp: contact, veelgestelde vragen
   Elke regel is een knop die je naar de juiste plek brengt; hier wordt zelf niets gewijzigd.
   ========================================================= */
(function () {
  var view = document.getElementById('settingsView'), box = document.getElementById('settingsBody');
  if (!view || !box) return;
  var I = {
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.4-4 4.4-6 8-6s6.6 2 8 6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    scale: '<path d="M12 4v16M6 20h12M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"/>',
    cookie: '<path d="M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3-3 3 3 0 0 1-3-3 3 3 0 0 1-3-3z"/><path d="M8.5 11.5h.01M12 15.5h.01M15.5 14h.01M9 16h.01"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17v.01"/>',
    chev: '<path d="M9 6l6 6-6 6"/>'
  };
  function ico(k, cls) { return '<svg class="' + (cls || 'st-i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[k] + '</svg>'; }
  // [titel-sleutel, uitleg-sleutel, icoon, actie]
  var GROUPS = [
    ['acct.groupAccount', [
      ['acct.profile', 'st.d_profile', 'person', 'acct:profile'], ['acct.security', 'st.d_security', 'lock', 'acct:security'],
      ['notify.title', 'st.d_notify', 'bell', 'acct:notify'], ['acct.prefsTitle', 'st.d_prefs', 'sliders', 'acct:prefs'], ['account.background', 'st.d_background', 'image', 'acct:background']]],
    ['acct.groupBilling', [['acct.billing', 'st.d_billing', 'doc', 'acct:billing'], ['acct.planNav', 'st.d_plan', 'card', 'acct:plan']]],
    ['nav.legal', [
      ['legal.privacy.title', 'st.d_privacy', 'shield', 'legal:privacy'], ['legal.terms.title', 'st.d_terms', 'scale', 'legal:terms'],
      ['legal.cookies.title', 'st.d_cookies', 'cookie', 'legal:cookies'], ['acct.dataTitle', 'st.d_data', 'download', 'acct:data'],
      ['acct.delete', 'st.d_delete', 'trash', 'acct:delete', 'danger']]],
    ['nav.help', [['nav.contact', 'st.d_contact', 'mail', 'page:contact'], ['nav.faq', 'st.d_faq', 'help', 'page:faq']]]
  ];
  function draw() {
    box.innerHTML = '<header class="help-head"><h2>' + t('nav.settings') + '</h2><p>' + t('st.lead') + '</p></header><div class="st-grid">' +
      GROUPS.map(function (g) {
        return '<section class="glass st-card" aria-labelledby="st_' + g[0].replace(/\W/g, '') + '"><h3 id="st_' + g[0].replace(/\W/g, '') + '">' + t(g[0]) + '</h3><ul class="st-list">' +
          g[1].map(function (r) {
            return '<li><button type="button" class="st-row' + (r[4] ? ' ' + r[4] : '') + '" data-st="' + r[3] + '"><span class="st-ic">' + ico(r[2]) + '</span>' +
              '<span class="st-txt"><b>' + t(r[0]) + '</b><small>' + t(r[1]) + '</small></span>' + ico('chev', 'st-chev') + '</button></li>';
          }).join('') + '</ul></section>';
      }).join('') + '</div>';
  }
  var fromSettings = false;
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-st]'); if (!b) return;
    var a = b.getAttribute('data-st').split(':');
    if (a[0] === 'acct') { goToPage('account'); if (window.openAccountTab) window.openAccountTab(a[1]); }
    else if (a[0] === 'legal') { fromSettings = true; if (window.Legal) Legal.open(a[1]); }
    else goToPage(a[1]);
    window.scrollTo(0, 0);
  });
  // De privacy-pagina heeft geen eigen knop meer in de zijbalk: "Instellingen" blijft dan oplichten
  document.addEventListener('pagechange', function (e) {
    if (e.detail === 'settings') { draw(); var ac = document.querySelector('.item[data-page="account"]'); if (ac) ac.classList.add('active'); return; }   // Instellingen hoort bij Mijn account
    if (e.detail === 'legal') { var it = document.querySelector('.item[data-page="account"]'); if (it) it.classList.add('active'); }
    else fromSettings = false;
  });
  if (window.i18n) i18n.onChange(function () { if (!view.hidden) draw(); });
})();

/* Upgrade-kaartje in de zijbalk: rustig, niet opdringerig. Laat het huidige pakket en het gebruik zien; klik = Abonnement. */
(function () {
  var card = document.getElementById('upCard'), info = null;
  if (!card) return;
  function show() {
    var p = info && info.plan;
    var me = window.Session && Session.user && Session.user();
    if (!p || p.id === 'business' || p.id === 'free' || (me && me.admin) || (window.api && api.isDemo && api.isDemo()) || (window.Team && Team.member())) { card.hidden = true; return; }   // teamlid: het abonnement is van de eigenaar
    card.hidden = false;
  }
  function load() { if (!window.api || !api.account || !api.account.plan) return; api.account.plan().then(function (r) { info = r; show(); banner(); }).catch(function () { card.hidden = true; }); }
  /* Balk bovenin als het abonnement niet betaald is: codes werken niet, tot wanneer je nog kunt betalen */
  var bar = document.createElement('div'); bar.className = 'maint-bar sub-bar'; bar.setAttribute('role', 'alert'); bar.hidden = true;
  var main = document.querySelector('.main'); if (main) main.insertBefore(bar, main.children[1] || null);
  function banner() {
    var sb = info && info.sub, st = sb && sb.state;
    bar.hidden = !(st === 'grace' || st === 'ended' || st === 'unpaid');
    bar.classList.toggle('sub-info', st === 'unpaid');                // welkom, nog geen abonnement: geen rode alarmbalk
    if (bar.hidden) return;
    if (st === 'unpaid') { bar.innerHTML = '<b>' + esc(t('sub.barUnpaid')) + '</b> <a href="#" data-sub-go>' + esc(t('sub.choose')) + '</a>'; return; }
    bar.innerHTML = '<b>' + esc(st === 'grace' ? t('sub.barGrace', { date: i18n.fmt.stamp(sb.graceUntil, 'time') }) : t('sub.barEnded')) + '</b> <a href="#" data-sub-go>' + esc(t('sub.renew')) + '</a>';
  }
  bar.addEventListener('click', function (e) { if (e.target.closest('[data-sub-go]')) { e.preventDefault(); if (window.Plans) Plans.open(); } });
  document.addEventListener('sub-lapsed', load);
  // Nog geen abonnement: QR-code maken leidt naar Abonnement kiezen (anders vul je alles in en kun je niet opslaan)
  document.addEventListener('pagechange', function (e) {
    if (e.detail !== 'create' || !info || !info.sub || info.sub.state !== 'unpaid') return;
    setTimeout(function () { goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); }, 0);
  });
  // Link uit de mail: ?go=plan opent na het inloggen meteen Abonnement
  var goPlan = /[?&]go=plan\b/.test(location.search);
  // Pakket gekozen op de website (zie session.js): na het inloggen meteen naar Abonnement (max. 1 dag bewaard)
  function wanted() { try { var w = JSON.parse(localStorage.getItem('optimasys-want') || 'null'); localStorage.removeItem('optimasys-want'); if (w && Date.now() - w.at < 864e5) { window.wantedPlan = w; return true; } } catch (e) {} return false; }
  var goCodes = /[?&]go=myCodes\b/.test(location.search);           // herinnering oude QR-app: meteen naar Mijn QR-codes
  if (window.Session && Session.onUser) Session.onUser(function () {
    if (goCodes) { goCodes = false; history.replaceState(null, '', location.pathname); setTimeout(function () { goToPage('myCodes'); }, 600); return; }
    if (wanted()) goPlan = true;
    if (!goPlan) return; goPlan = false; if (/[?&]go=/.test(location.search)) history.replaceState(null, '', location.pathname); setTimeout(function () { goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); }, 600); });
  card.addEventListener('click', function (e) { e.preventDefault(); if (window.Plans) Plans.open(); else { goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); } });   // rustige pakketten-pagina
  if (window.Session && Session.onUser) Session.onUser(function () { setTimeout(load, 400); });
  document.addEventListener('pagechange', function (e) { if (e.detail === 'myCodes' || e.detail === 'home') load(); });
  if (window.i18n) i18n.onChange(function () { show(); banner(); });
})();
