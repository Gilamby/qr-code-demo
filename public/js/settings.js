/* =========================================================
   ZIJBALK-EXTRA'S: upgrade-kaartje en de balk bovenin over het abonnement.
   (Instellingen zelf: account-settings.js, pagina 'settings'.)
   ========================================================= */
/* De privacy-pagina heeft geen eigen knop in de zijbalk: "Mijn account" blijft dan oplichten */
document.addEventListener('pagechange', function (e) { if (e.detail === 'legal') { var it = document.querySelector('.item[data-page="account"]'); if (it) it.classList.add('active'); } });

/* Upgrade-kaartje in de zijbalk: rustig, niet opdringerig. Laat het huidige pakket en het gebruik zien; klik = Abonnement. */
(function () {
  var card = document.getElementById('upCard'), info = null;
  if (!card) return;
  function show() {
    var p = info && info.plan;
    var me = window.Session && Session.user && Session.user();
    if (!p || p.id === 'free' || (me && me.admin) || (window.api && api.isDemo && api.isDemo()) || (window.Team && Team.member())) { card.hidden = true; return; }   // teamlid: het abonnement is van de eigenaar
    // Ook bij Business zichtbaar: zo kun je altijd makkelijk van pakket of betaalperiode wisselen (wens Fabian 26 okt)
    card.hidden = false;
  }
  function load() { if (!window.api || !api.account || !api.account.plan) return; api.account.plan().then(function (r) { info = r; show(); banner(); }).catch(function () { card.hidden = true; }); }
  /* Balk bovenin als het abonnement niet betaald is: codes werken niet, tot wanneer je nog kunt betalen */
  var bar = document.createElement('div'); bar.className = 'maint-bar sub-bar'; bar.setAttribute('role', 'alert'); bar.hidden = true;
  var main = document.querySelector('.main'); if (main) main.insertBefore(bar, main.children[1] || null);
  // Rustige herinnering bovenin: opgezegd (loopt nog tot …) of de gratis proef stopt binnen 3 dagen. Wegklikken = tot de volgende keer openen.
  function soonKey() {
    var sb = info && info.sub, bl = (info && info.billing) || {};
    if (!sb || sb.state !== 'active' || !sb.periodEnd) return null;
    if (bl.cancelAtEnd) return 'end|' + sb.periodEnd;
    if (bl.trial && Date.parse(sb.periodEnd) - Date.now() <= 3 * 864e5) return 'trial|' + sb.periodEnd;
    return null;
  }
  function closed(k) { try { return sessionStorage.getItem('qrc-soon') === k; } catch (e) { return false; } }
  function soonBar(k) {
    var sb = info.sub, p = info.plan, iv = PlanPeriod.norm(sb.interval), date = i18n.fmt.stamp(sb.periodEnd, 'long');
    var amount = (Number(PlanPeriod.firstPay(p, iv)) || 0) + (p.extra || 0) * ((info.extraPrice && info.extraPrice[iv]) || 0);
    var money = new Intl.NumberFormat(i18n.lang(), { style: 'currency', currency: 'EUR' }).format(amount);
    bar.classList.add('sub-info', 'sub-soon');
    bar.innerHTML = '<b>' + esc(k.indexOf('end') === 0 ? t('sub.barEnds', { date: date }) : t('sub.barTrialEnds', { date: date, amount: money })) + '</b> ' +
      '<a href="#" data-sub-plan>' + esc(k.indexOf('end') === 0 ? t('bill.resume') : t('bill.manage')) + '</a>' +
      '<button type="button" class="sub-x" data-sub-x aria-label="' + esc(t('legal.close')) + '">×</button>';
  }
  function banner() {
    var sb = info && info.sub, st = sb && sb.state;
    bar.classList.remove('sub-soon');
    var me = window.Session && Session.user && Session.user(), k = soonKey();
    if (k && !closed(k) && !(me && me.admin) && !(window.Team && Team.member && Team.member())) { bar.hidden = false; return soonBar(k); }
    bar.hidden = !(st === 'grace' || st === 'ended' || st === 'unpaid');
    bar.classList.toggle('sub-info', st === 'unpaid');                // welkom, nog geen abonnement: geen rode alarmbalk
    if (bar.hidden) return;
    if (st === 'unpaid') { bar.innerHTML = '<b>' + esc(t('sub.barUnpaid')) + '</b> <a href="#" data-sub-go>' + esc(t('sub.choose')) + '</a>'; return; }
    bar.innerHTML = '<b>' + esc(st === 'grace' ? t('sub.barGrace', { date: i18n.fmt.stamp(sb.graceUntil, 'time') }) : t('sub.barEnded')) + '</b> <a href="#" data-sub-go>' + esc(t('sub.renew')) + '</a>';
  }
  bar.addEventListener('click', function (e) { if (e.target.closest('[data-sub-go]')) { e.preventDefault(); if (window.Plans) Plans.open(); } });
  bar.addEventListener('click', function (e) {
    if (e.target.closest('[data-sub-plan]')) { e.preventDefault(); goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); return; }
    if (e.target.closest('[data-sub-x]')) { try { sessionStorage.setItem('qrc-soon', soonKey() || ''); } catch (x) {} bar.hidden = true; }
  });
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
  var goContact = /[?&]go=contact\b/.test(location.search);         // antwoord op een supportvraag: meteen naar Contact (Mijn vragen)
  if (window.Session && Session.onUser) Session.onUser(function () {
    if (goContact) { goContact = false; history.replaceState(null, '', location.pathname); setTimeout(function () { goToPage('contact'); }, 600); return; }
    if (goCodes) { goCodes = false; history.replaceState(null, '', location.pathname); setTimeout(function () { goToPage('myCodes'); }, 600); return; }
    if (wanted()) goPlan = true;
    if (!goPlan) return; goPlan = false; if (/[?&]go=/.test(location.search)) history.replaceState(null, '', location.pathname); setTimeout(function () { goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); }, 600); });
  card.addEventListener('click', function (e) { e.preventDefault(); if (window.Plans) Plans.open(); else { goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); } });   // rustige pakketten-pagina
  if (window.Session && Session.onUser) Session.onUser(function () { setTimeout(load, 400); });
  document.addEventListener('pagechange', function (e) { if (e.detail === 'myCodes' || e.detail === 'home' || e.detail === 'account') load(); });
  // Pakket net betaald, gewijzigd of opnieuw opgehaald: de balk bovenaan meteen bijwerken (anders bleef 'Kies een pakket' staan)
  ['plan-changed', 'plan-info', 'paywall-done'].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(load, 300); }); });
  if (window.i18n) i18n.onChange(function () { show(); banner(); });
})();
