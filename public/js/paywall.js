/* =========================================================
   PAKKET KIEZEN (verplicht, zoals bij Slack)
   Wie zelf een account heeft gemaakt en nog geen abonnement heeft, ziet na het inloggen alleen dit scherm:
   eerst een pakket kiezen, pas daarna de app in. Uitloggen en de taal wisselen kan wel.
   - Gekozen op de website (?signup&plan=…)? Dan staat dat pakket al klaar.
   - Straks: de knop opent de betaalpagina van Stripe (14 dagen gratis, kaart vooraf).
   - Nu (nog geen Stripe): de knop stuurt het team een aanvraag; het team zet het account aan (Beheer > Gebruikers > Betaling).
   Niet voor het team, niet voor teamleden (het abonnement is van de eigenaar) en niet voor de online demo.
   ========================================================= */
(function () {
  var box = null, info = null, year = false, chosen = 'pro', sent = false;
  function euro(n) { try { return new Intl.NumberFormat(i18n.lang(), { style: 'currency', currency: 'EUR' }).format(n); } catch (e) { return '€' + Number(n).toFixed(2); } }
  function needed() {
    var u = Session.user();
    if (!u || u.admin || (window.Team && Team.member && Team.member()) || (api.isDemo && api.isDemo())) return false;
    return info && info.sub && info.sub.state === 'unpaid';
  }
  function draw() {
    if (!box) { box = document.createElement('div'); box.className = 'paywall'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'pwTitle'); document.body.appendChild(box); }
    var plans = (info.plans || []).filter(function (p) { return p.price != null; });
    box.innerHTML = '<div class="pw-inner">' +
      '<div class="pw-top"><span class="auth-logo"><img class="logo-mark" src="icons/favicon.svg" alt=""><b>Optimasys <small>QR</small></b></span>' +
      '<button type="button" class="link-btn" data-pw-logout>' + esc(t('nav.logout')) + '</button></div>' +
      '<h1 id="pwTitle">' + esc(t('pw.title')) + '</h1><p class="pw-lead">' + esc(t('pw.lead')) + '</p>' +
      '<div class="pl-period" role="radiogroup" aria-label="' + esc(t('sub.period')) + '"><button type="button" role="radio" aria-checked="' + !year + '" data-pw-year="0">' + t('sub.monthly') + '</button><button type="button" role="radio" aria-checked="' + year + '" data-pw-year="1">' + t('sub.yearly') + ' <em>' + t('sub.yearSave') + '</em></button></div>' +
      '<div class="pw-grid" role="radiogroup" aria-label="' + esc(t('pw.title')) + '">' + plans.map(function (x) {
        var on = x.id === chosen;
        return '<button type="button" role="radio" aria-checked="' + on + '" class="pw-card' + (on ? ' on' : '') + '" data-pw-plan="' + x.id + '">' +
          (x.id === 'pro' ? '<span class="pw-pop">' + esc(t('pw.popular')) + '</span>' : '') +
          '<span class="pl-name">' + t('plan.n_' + x.id) + '</span>' +
          '<span class="pl-price"><b>' + euro(year ? x.priceYear : x.price) + '</b><small>' + t(year ? 'sub.perYear' : 'plan.perMonth') + '</small></span>' +
          (year && x.priceYearAfter ? '<span class="pl-then">' + t('sub.yearThen', { price: euro(x.priceYearAfter) }) + '</span>' : '') +
          '<span class="pw-list"><span>' + (x.codes ? t('plan.fCodes', { n: x.codes }) : t('acct.planF1')) + '</span><span>' + (x.statsDays ? t('plan.fStats', { n: x.statsDays }) : t('plan.fStatsAll')) + '</span><span>' + (x.users === 1 ? t('team.fUsers1') : x.users ? t('team.fUsers', { n: x.users }) : t('team.fUsersAll')) + '</span></span>' +
          '</button>';
      }).join('') + '</div>' +
      (sent ? '<p class="acct-msg ok" role="status">' + esc(t('pw.sent')) + '</p>'
        : '<button type="button" class="btn primary pw-go" data-pw-go>' + esc(t('pw.start')) + '</button><p class="pw-note">' + esc(t('pw.soon')) + '</p>') +
      '</div>';
  }
  function open() { draw(); document.body.classList.add('paywall-open'); var f = box.querySelector('[aria-checked="true"]'); if (f) f.focus(); }
  function close() { if (box) box.remove(); box = null; document.body.classList.remove('paywall-open'); }
  function check() {
    if (!api.account || !api.account.plan) return;
    api.account.plan().then(function (r) {
      info = r;
      var w = window.wantedPlan; if (w) { chosen = w.plan || chosen; year = w.period === 'year'; }
      if (needed()) open(); else close();
    }).catch(function () {});
  }
  document.addEventListener('click', function (e) {
    if (!box || !box.contains(e.target)) return;
    var p = e.target.closest('[data-pw-plan]'); if (p) { chosen = p.getAttribute('data-pw-plan'); return draw(); }
    var y = e.target.closest('[data-pw-year]'); if (y) { year = y.getAttribute('data-pw-year') === '1'; return draw(); }
    if (e.target.closest('[data-pw-logout]')) { api.auth.logout().catch(function () {}).then(function () { location.replace(location.pathname); }); return; }
    if (e.target.closest('[data-pw-go]')) {
      // Nog geen Stripe: aanvraag naar het team. (Met Stripe: hier naar de betaalpagina.)
      var u = Session.user() || {};
      api.contact({ name: u.name || u.email, email: u.email, topic: 'billing', message: t('plan.askMsg', { plan: t('plan.n_' + chosen) }) + ' (' + t(year ? 'sub.yearly' : 'sub.monthly') + ')' })
        .then(function () { sent = true; draw(); }, function () { sent = true; draw(); });
    }
  });
  if (window.Session && Session.onUser) Session.onUser(function () { setTimeout(check, 300); });
  document.addEventListener('sub-lapsed', check);
  if (window.i18n) i18n.onChange(function () { if (box) draw(); });
})();
