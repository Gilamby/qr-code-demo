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
  var box = null, info = null, period = 'month', chosen = 'pro', sent = false, step = 'choose', done = null, busy = false;
  function euro(n) { try { return new Intl.NumberFormat(i18n.lang(), { style: 'currency', currency: 'EUR' }).format(n); } catch (e) { return '€' + Number(n).toFixed(2); } }
  function needed() {
    var u = Session.user();
    if (!u || u.admin || (window.Team && Team.member && Team.member()) || (api.isDemo && api.isDemo())) return false;
    return info && info.sub && info.sub.state === 'unpaid';
  }
  function draw() {
    if (!box) { box = document.createElement('div'); box.className = 'paywall'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'pwTitle'); document.body.appendChild(box); }
    var plans = (info.plans || []).filter(function (p) { return p.price != null; });
    if (step === 'pay' || step === 'done') return drawPay(plans.filter(function (p) { return p.id === chosen; })[0]);
    box.innerHTML = '<div class="pw-inner">' +
      '<div class="pw-top"><span class="auth-logo"><img class="logo-mark" src="icons/favicon.svg" alt=""><b>QR-<small>Codex</small></b><em class="auth-by">by Optimasys</em></span>' +
      '<button type="button" class="link-btn" data-pw-logout>' + esc(t('nav.logout')) + '</button></div>' +
      '<h1 id="pwTitle">' + esc(t('pw.title')) + '</h1><p class="pw-lead">' + esc(t('pw.lead')) + '</p>' +
      PlanPeriod.toggle(period, 'data-pw-period', true) +
      '<div class="pw-grid" role="radiogroup" aria-label="' + esc(t('pw.title')) + '">' + plans.map(function (x) {
        var on = x.id === chosen;
        return '<button type="button" role="radio" aria-checked="' + on + '" class="pw-card' + (on ? ' on' : '') + '" data-pw-plan="' + x.id + '">' +
          (x.id === 'pro' ? '<span class="pw-pop">' + esc(t('pw.popular')) + '</span>' : '') +
          '<span class="pl-name">' + t('plan.n_' + x.id) + '</span>' +
          '<span class="pl-price"><b>' + euro(PlanPeriod.price(x, period)) + '</b><small>' + PlanPeriod.per(period) + '</small></span>' +
          (period === 'year' && x.priceYearAfter ? '<span class="pl-then">' + t('sub.yearThen', { price: euro(x.priceYearAfter) }) + '</span>' : '') +
          '<span class="pw-list"><span>' + (x.codes ? t('plan.fCodes', { n: x.codes }) : t('acct.planF1')) + '</span><span>' + (x.statsDays ? t('plan.fStats', { n: x.statsDays }) : t('plan.fStatsAll')) + '</span><span>' + (x.users === 1 ? t('team.fUsers1') : x.users ? t('team.fUsers', { n: x.users }) : t('team.fUsersAll')) + '</span></span>' +
          '</button>';
      }).join('') + '</div>' +
      (sent ? '<p class="acct-msg ok" role="status">' + esc(t('pw.sent')) + '</p>'
        : '<button type="button" class="btn primary pw-go" data-pw-go>' + esc(t('pw.start')) + '</button>' + (api.info && api.info().demoCheckout ? '' : '<p class="pw-note">' + esc(t('pw.soon')) + '</p>')) +
      '</div>';
  }
  // DEMO-afrekenen (zoals straks de betaalpagina van Stripe, maar er wordt niets afgeschreven)
  function drawPay(x) {
    var price = PlanPeriod.price(x, period), per = PlanPeriod.per(period);
    var top = '<div class="pw-top"><span class="auth-logo"><img class="logo-mark" src="icons/favicon.svg" alt=""><b>QR-<small>Codex</small></b><em class="auth-by">by Optimasys</em></span>' +
      '<button type="button" class="link-btn" data-pw-logout>' + esc(t('nav.logout')) + '</button></div>';
    if (step === 'done') {
      box.innerHTML = '<div class="pw-inner">' + top + '<div class="pw-done"><span class="pw-check" aria-hidden="true">✓</span><h1 id="pwTitle">' + esc(t('pw.done')) + '</h1>' +
        '<p class="pw-lead">' + esc(t('plan.n_' + x.id)) + ' · ' + esc(t('pw.trialUntil', { date: i18n.fmt.stamp(new Date(Date.now() + (x.trialDays || 14) * 864e5).toISOString(), 'long') })) + '</p>' +
        '<button type="button" class="btn primary pw-go" data-pw-enter>' + esc(t('pw.enter')) + '</button></div></div>';
      return;
    }
    box.innerHTML = '<div class="pw-inner">' + top + '<h1 id="pwTitle">' + esc(t('pw.payTitle')) + '</h1>' +
      '<p class="pw-demo" role="note">' + esc(t('pw.demo')) + '</p>' +
      '<div class="pw-pay"><div class="pw-sum"><b>' + esc(t('plan.n_' + x.id)) + '</b><span>' + esc(PlanPeriod.label(period)) + '</span>' +
        '<div class="pw-row"><span>' + esc(t('pw.today')) + '</span><b>' + euro(0) + '</b></div>' +
        '<div class="pw-row"><span>' + esc(t('pw.after')) + '</span><b>' + euro(price) + ' ' + esc(per) + '</b></div></div>' +
      '<form class="pw-card-form" data-pw-form><label class="auth-f"><span>' + esc(t('pw.card')) + '</span><span class="auth-in"><input value="4242 4242 4242 4242" readonly></span></label>' +
        '<div class="pw-two"><label class="auth-f"><span>MM/JJ</span><span class="auth-in"><input value="12/34" readonly></span></label><label class="auth-f"><span>CVC</span><span class="auth-in"><input value="123" readonly></span></label></div>' +
        '<button type="submit" class="btn primary pw-go"' + (busy ? ' disabled' : '') + '>' + esc(t('pw.confirm')) + '</button>' +
        '<button type="button" class="link-btn" data-pw-back>' + esc(t('pw.back')) + '</button></form></div></div>';
  }
  function pay() {
    if (busy) return; busy = true; drawPay((info.plans || []).filter(function (p) { return p.id === chosen; })[0]);
    api.account.checkoutDemo({ plan: chosen, period: period }).then(function () { busy = false; step = 'done'; draw(); })
      .catch(function () { busy = false; step = 'choose'; draw(); });
  }
  function open() { draw(); document.body.classList.add('paywall-open'); var f = box.querySelector('[aria-checked="true"]'); if (f) f.focus(); }
  function close() { if (box) box.remove(); box = null; document.body.classList.remove('paywall-open'); }
  function check() {
    if (!api.account || !api.account.plan) return;
    if (window.TermsGate && TermsGate.waiting()) return;                 // eerst akkoord met de voorwaarden (terms-gate.js)
    api.account.plan().then(function (r) {
      info = r;
      var w = window.wantedPlan; if (w) { chosen = w.plan || chosen; period = PlanPeriod.norm(w.period); }
      if (needed()) open(); else close();
    }).catch(function () {});
  }
  document.addEventListener('click', function (e) {
    if (!box || !box.contains(e.target)) return;
    var p = e.target.closest('[data-pw-plan]'); if (p) { chosen = p.getAttribute('data-pw-plan'); return draw(); }
    var y = e.target.closest('[data-pw-period]'); if (y) { period = PlanPeriod.norm(y.getAttribute('data-pw-period')); return draw(); }
    if (e.target.closest('[data-pw-logout]')) { api.auth.logout().catch(function () {}).then(function () { location.replace(location.pathname); }); return; }
    if (e.target.closest('[data-pw-back]')) { step = 'choose'; return draw(); }
    if (e.target.closest('[data-pw-enter]')) { location.replace(location.pathname); return; }
    if (e.target.closest('[data-pw-go]') && step === 'choose' && api.info && api.info().demoCheckout) { step = 'pay'; return draw(); }
    if (e.target.closest('[data-pw-go]')) {
      // Nog geen Stripe: aanvraag naar het team. (Met Stripe: hier naar de betaalpagina.)
      var u = Session.user() || {};
      api.contact({ name: u.name || u.email, email: u.email, topic: 'billing', message: t('plan.askMsg', { plan: t('plan.n_' + chosen) }) + ' (' + PlanPeriod.label(period) + ')' })
        .then(function () { sent = true; draw(); }, function () { sent = true; draw(); });
    }
  });
  document.addEventListener('submit', function (e) { if (box && e.target.closest('[data-pw-form]')) { e.preventDefault(); pay(); } });
  if (window.Session && Session.onUser) Session.onUser(function () { setTimeout(check, 300); });
  document.addEventListener('sub-lapsed', check);
  document.addEventListener('terms-ok', check);
  if (window.i18n) i18n.onChange(function () { if (box) draw(); });
})();
