/* =========================================================
   PAKKETTEN-PAGINA (volledig scherm, rustig)
   Twee manieren:
   - Verplicht (zoals bij Slack): wie zelf een account maakte en nog geen abonnement heeft, ziet na het inloggen
     alleen dit scherm. Eerst een pakket kiezen, pas daarna de app in. Uitloggen en de taal wisselen kan wel.
   - Zelf geopend (Plans.open(), bv. "Upgrade" in de zijbalk of "Bekijk pakketten" in Mijn account):
     een ander pakket of een andere betaalperiode kiezen. "Terug naar de app" sluit het.
   Betalen: nu een DEMO (DEMO_CHECKOUT=true in .env, er wordt niets afgeschreven). Straks: de betaalpagina van Stripe.
   Zonder demo: de knop stuurt het team een aanvraag.
   Niet voor het team (beheer), niet voor teamleden (het abonnement is van de eigenaar) en niet voor de online demo.
   ========================================================= */
var Plans = (function () {
  var box = null, info = null, period = 'month', chosen = 'pro', sent = false, step = 'choose', busy = false, mode = 'must', result = null;
  function euro(n) { try { return new Intl.NumberFormat(i18n.lang(), { style: 'currency', currency: 'EUR' }).format(n); } catch (e) { return '€' + Number(n).toFixed(2); } }
  function blocked() { var u = Session.user(); return !u || u.admin || (window.Team && Team.member && Team.member()) || (api.isDemo && api.isDemo()); }
  function needed() { return !blocked() && info && info.sub && info.sub.state === 'unpaid'; }
  function demo() { return !!(api.info && api.info().demoCheckout); }
  function curPlan() { return info && info.sub && info.sub.state !== 'unpaid' && info.plan ? info.plan.id : null; }
  function curPeriod() { return info && info.sub && info.sub.interval; }
  function isCurrent(id) { return mode === 'change' && id === curPlan() && PlanPeriod.norm(curPeriod()) === period && info.sub.state === 'active'; }
  function plans() { return (info.plans || []).filter(function (p) { return p.price != null; }); }
  function top() {
    return '<div class="pw-top"><span class="auth-logo"><img class="logo-mark" src="icons/favicon.svg" alt=""><b>QR-<small>Codex</small></b><em class="auth-by">by Optimasys</em></span>' +
      (mode === 'change' ? '<button type="button" class="btn ghost pw-close" data-pw-close>← ' + esc(t('pw.backApp')) + '</button>' : '<button type="button" class="link-btn" data-pw-logout>' + esc(t('nav.logout')) + '</button>') + '</div>';
  }
  function feats(x) {
    return '<span class="pw-list"><span>' + (x.codes ? t('plan.fCodes', { n: x.codes }) : t('acct.planF1')) + '</span><span>' + (x.statsDays ? t('plan.fStats', { n: x.statsDays }) : t('plan.fStatsAll')) + '</span><span>' +
      (x.users === 1 ? t('team.fUsers1') : x.users ? t('team.fUsers', { n: x.users }) : t('team.fUsersAll')) + '</span><span>' + t('acct.planF4') + '</span></span>';
  }
  function draw() {
    if (!box) { box = document.createElement('div'); box.className = 'paywall'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'pwTitle'); document.body.appendChild(box); }
    if (step === 'pay') return drawPay();
    if (step === 'done') return drawDone();
    var cur = curPlan(), list = plans();
    if (isCurrent(chosen)) { var other = list.filter(function (p) { return !isCurrent(p.id); })[0]; if (other) chosen = other.id; }
    box.innerHTML = '<div class="pw-inner">' + top() +
      '<h1 id="pwTitle">' + esc(t(mode === 'change' ? 'pw.changeTitle' : 'pw.title')) + '</h1><p class="pw-lead">' + esc(t(mode === 'change' ? 'pw.changeLead' : 'pw.lead')) + '</p>' +
      (mode === 'change' && cur ? '<p class="pw-now">' + esc(t('pw.now', { plan: t('plan.n_' + cur), period: PlanPeriod.label(PlanPeriod.norm(curPeriod())) })) + '</p>' : '') +
      PlanPeriod.toggle(period, 'data-pw-period', true) +
      '<div class="pw-grid" role="radiogroup" aria-label="' + esc(t('pw.title')) + '">' + list.map(function (x) {
        var here = isCurrent(x.id), on = !here && x.id === chosen;
        return '<button type="button" role="radio" aria-checked="' + on + '"' + (here ? ' disabled' : '') + ' class="pw-card' + (on ? ' on' : '') + (here ? ' is-cur' : '') + '" data-pw-plan="' + x.id + '">' +
          (here ? '<span class="pw-pop cur">' + esc(t('pw.current')) + '</span>' : x.id === 'pro' ? '<span class="pw-pop">' + esc(t('pw.popular')) + '</span>' : '') +
          '<span class="pl-name">' + t('plan.n_' + x.id) + '</span>' +
          '<span class="pl-price"><b>' + euro(PlanPeriod.price(x, period)) + '</b><small>' + PlanPeriod.per(period) + '</small></span>' +
          (period === 'year' && x.priceYearAfter ? '<span class="pl-then">' + t('sub.yearThen', { price: euro(x.priceYearAfter) }) + '</span>' : '') + feats(x) + '</button>';
      }).join('') + '</div>' +
      (sent ? '<p class="acct-msg ok" role="status">' + esc(t('pw.sent')) + '</p>'
        : '<button type="button" class="btn primary pw-go" data-pw-go>' + esc(mode === 'change' ? t('pw.choosePlan', { plan: t('plan.n_' + chosen) }) : t('pw.start')) + '</button>' +
          (demo() ? '' : '<p class="pw-note">' + esc(t('pw.soon')) + '</p>')) +
      '<p class="pw-note">' + esc(t('pw.reassure')) + '</p></div>';
  }
  // Afrekenen (DEMO: zoals straks de betaalpagina van Stripe, maar er wordt niets afgeschreven)
  function drawPay() {
    var x = plans().filter(function (p) { return p.id === chosen; })[0], price = PlanPeriod.price(x, period), per = PlanPeriod.per(period);
    var trial = mode === 'must';                                         // nieuwe klant: eerst 14 dagen gratis; wisselen: meteen
    box.innerHTML = '<div class="pw-inner">' + top() + '<h1 id="pwTitle">' + esc(t('pw.payTitle')) + '</h1>' +
      '<p class="pw-demo" role="note">' + esc(t('pw.demo')) + '</p>' +
      '<div class="pw-pay"><div class="pw-sum"><b>' + esc(t('plan.n_' + x.id)) + '</b><span>' + esc(PlanPeriod.label(period)) + '</span>' + feats(x) +
        '<div class="pw-row"><span>' + esc(t('pw.today')) + '</span><b>' + euro(trial ? 0 : price) + '</b></div>' +
        '<div class="pw-row"><span>' + esc(t(trial ? 'pw.after' : 'pw.then')) + '</span><b>' + euro(price) + ' ' + esc(per) + '</b></div></div>' +
      '<form class="pw-card-form" data-pw-form><label class="auth-f"><span>' + esc(t('pw.card')) + '</span><span class="auth-in"><input value="4242 4242 4242 4242" readonly></span></label>' +
        '<div class="pw-two"><label class="auth-f"><span>MM/JJ</span><span class="auth-in"><input value="12/34" readonly></span></label><label class="auth-f"><span>CVC</span><span class="auth-in"><input value="123" readonly></span></label></div>' +
        '<button type="submit" class="btn primary pw-go"' + (busy ? ' disabled' : '') + '>' + esc(trial ? t('pw.confirm') : t('pw.payNow', { price: euro(price) })) + '</button>' +
        '<p class="pw-safe">🔒 ' + esc(t('pw.safe')) + '</p>' +
        '<button type="button" class="link-btn" data-pw-back>' + esc(t('pw.back')) + '</button></form></div></div>';
  }
  function drawDone() {
    var sub = result && result.sub, until = sub && sub.periodEnd ? i18n.fmt.stamp(sub.periodEnd, 'long') : '';
    box.innerHTML = '<div class="pw-inner">' + top() + '<div class="pw-done"><span class="pw-check" aria-hidden="true">✓</span>' +
      '<h1 id="pwTitle">' + esc(t(mode === 'change' ? 'pw.changed' : 'pw.done')) + '</h1>' +
      '<p class="pw-lead">' + esc(t('plan.n_' + chosen)) + ' · ' + esc(PlanPeriod.label(period)) + '<br>' + esc(t(mode === 'change' ? 'sub.paidUntil' : 'pw.trialUntil', { date: until })) + '</p>' +
      '<button type="button" class="btn primary pw-go" data-pw-enter>' + esc(t('pw.enter')) + '</button></div></div>';
  }
  function pay() {
    if (busy) return; busy = true; drawPay();
    api.account.checkoutDemo({ plan: chosen, period: period }).then(function (r) { busy = false; result = r; step = 'done'; draw(); })
      .catch(function () { busy = false; step = 'choose'; draw(); });
  }
  function show() { draw(); document.body.classList.add('paywall-open'); var f = box.querySelector('.pw-card.on') || box.querySelector('[data-pw-go]'); if (f) f.focus(); }
  function close() { if (box) box.remove(); box = null; document.body.classList.remove('paywall-open'); }
  function check() {
    if (!api.account || !api.account.plan) return;
    if (window.TermsGate && TermsGate.waiting()) return;                 // eerst akkoord met de voorwaarden (terms-gate.js)
    api.account.plan().then(function (r) {
      info = r;
      var w = window.wantedPlan; if (w) { chosen = w.plan || chosen; period = PlanPeriod.norm(w.period); }
      if (needed()) { mode = 'must'; step = 'choose'; show(); } else if (mode === 'must') close();
    }).catch(function () {});
  }
  /** Zelf openen: een ander pakket of andere betaalperiode kiezen */
  function open(planId) {
    if (blocked()) { goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); return; }
    api.account.plan().then(function (r) {
      info = r; mode = needed() ? 'must' : 'change'; step = 'choose'; sent = false; result = null;
      if (curPeriod()) period = PlanPeriod.norm(curPeriod());
      var cur = curPlan(), order = ['standard', 'pro', 'business'];
      chosen = planId || (cur && order[order.indexOf(cur) + 1]) || 'pro';                // standaard: één stap omhoog
      show();
    }).catch(function () {});
  }
  document.addEventListener('click', function (e) {
    if (!box || !box.contains(e.target)) return;
    var p = e.target.closest('[data-pw-plan]'); if (p && !p.disabled) { chosen = p.getAttribute('data-pw-plan'); return draw(); }
    var y = e.target.closest('[data-pw-period]'); if (y) { period = PlanPeriod.norm(y.getAttribute('data-pw-period')); return draw(); }
    if (e.target.closest('[data-pw-logout]')) { api.auth.logout().catch(function () {}).then(function () { location.replace(location.pathname); }); return; }
    if (e.target.closest('[data-pw-close]')) return close();
    if (e.target.closest('[data-pw-back]')) { step = 'choose'; return draw(); }
    if (e.target.closest('[data-pw-enter]')) { location.replace(location.pathname); return; }
    if (e.target.closest('[data-pw-go]') && step === 'choose' && demo()) { step = 'pay'; return draw(); }
    if (e.target.closest('[data-pw-go]')) {
      // Geen demo en nog geen Stripe: aanvraag naar het team. (Met Stripe: hier naar de betaalpagina.)
      var u = Session.user() || {};
      api.contact({ name: u.name || u.email, email: u.email, topic: 'billing', message: t('plan.askMsg', { plan: t('plan.n_' + chosen) }) + ' (' + PlanPeriod.label(period) + ')' })
        .then(function () { sent = true; draw(); }, function () { sent = true; draw(); });
    }
  });
  document.addEventListener('keydown', function (e) { if (box && mode === 'change' && e.key === 'Escape') close(); });
  document.addEventListener('submit', function (e) { if (box && e.target.closest('[data-pw-form]')) { e.preventDefault(); pay(); } });
  if (window.Session && Session.onUser) Session.onUser(function () { setTimeout(check, 300); });
  document.addEventListener('sub-lapsed', check);
  document.addEventListener('terms-ok', check);
  if (window.i18n) i18n.onChange(function () { if (box) draw(); });
  return { open: open };
})();
