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
  var box = null, info = null, period = 'month', chosen = 'pro', sent = false, step = 'choose', busy = false, mode = 'must', result = null, reason = null, codes = null, keep = [];
  function euro(n) { try { return new Intl.NumberFormat(i18n.lang(), { style: 'currency', currency: 'EUR' }).format(n); } catch (e) { return '€' + Number(n).toFixed(2); } }
  function blocked() { var u = Session.user(); return !u || u.admin || (window.Team && Team.member && Team.member()) || (api.isDemo && api.isDemo()); }
  function needed() { return !blocked() && info && info.sub && info.sub.state === 'unpaid'; }
  function stripeOn() { return !!(api.info && api.info().stripe); }      // echt betalen via Stripe (testmodus of live)
  function demo() { return !stripeOn() && !!(api.info && api.info().demoCheckout); }
  var returned = /[?&]checkout=success\b/.test(location.search), waited = 0;      // terug van de betaalpagina van Stripe
  if (/[?&]checkout=(success|cancel)\b/.test(location.search)) history.replaceState(null, '', location.pathname);
  function curPlan() { return info && info.sub && info.sub.state !== 'unpaid' && info.plan ? info.plan.id : null; }
  function curPeriod() { return info && info.sub && info.sub.interval; }
  function isCurrent(id) { return mode === 'change' && id === curPlan() && PlanPeriod.norm(curPeriod()) === period && info.sub.state === 'active'; }
  var ORDER = ['standard', 'pro', 'business'];
  function upFrom(id) { var c = curPlan(); return !!c && ORDER.indexOf(id) > ORDER.indexOf(c); }
  function plans() { return (info.plans || []).filter(function (p) { return p.price != null; }); }
  function top() {
    return '<div class="pw-top"><span class="auth-logo"><img class="logo-mark" src="icons/favicon.svg" alt=""><b>QR-<small>Codex</small></b><em class="auth-by">by Optimasys</em></span>' +
      (mode === 'change' ? '<button type="button" class="btn ghost pw-close" data-pw-close>← ' + esc(t('pw.backApp')) + '</button>' : '<button type="button" class="link-btn" data-pw-logout>' + esc(t('nav.logout')) + '</button>') + '</div>';
  }
  /* ---------- Minder QR-codes (bv. Pro → Standard): de klant kiest welke codes aan blijven, de rest wordt gepauzeerd (niet verwijderd) ---------- */
  function limitOf(id) { var x = plans().filter(function (p) { return p.id === id; })[0]; return !x || x.codes == null ? null : x.codes + ((info.plan && info.plan.extra) || 0); }
  function isStat(r) { return window.CodeUtil ? CodeUtil.isStatic(r) : false; }
  function activeDyn() { return (codes || []).filter(function (r) { return !r.paused && !isStat(r); }); }
  function room() { var L = limitOf(chosen); return L == null ? null : Math.max(0, L - (codes || []).filter(function (r) { return !r.paused && isStat(r); }).length); }
  function needKeep() { var L = limitOf(chosen); return mode === 'change' && L != null && info.usage && info.usage.used > L; }
  function startKeep() {
    api.listQrCodes().then(function (list) {
      codes = list || []; var r = room();
      keep = activeDyn().slice().sort(function (a, b) { return (b.scans || 0) - (a.scans || 0); }).slice(0, r).map(function (x) { return x.id; });   // voorgesteld: de meest gescande
      step = 'keep'; draw();
    }).catch(function () { step = 'choose'; draw(); });
  }
  function drawKeep() {
    var L = limitOf(chosen), r = room(), list = activeDyn().slice().sort(function (a, b) { return (b.scans || 0) - (a.scans || 0); }), n = keep.length, off = list.length - n;
    box.innerHTML = '<div class="pw-inner pw-keep">' + top() +
      '<h1 id="pwTitle">' + esc(t('pw.keepTitle', { n: r })) + '</h1>' +
      '<p class="pw-lead">' + esc(t('pw.keepLead', { plan: t('plan.n_' + chosen), limit: L, used: info.usage.used })) + '</p>' +
      '<p class="pw-keep-safe" role="note">' + esc(t('pw.keepSafe')) + '</p>' +
      '<div class="pw-keep-bar"><b>' + esc(t('pw.keepCount', { n: n, max: r })) + '</b><span>' + esc(t('pw.keepOff', { n: off })) + '</span></div>' +
      '<ul class="pw-keep-list">' + list.map(function (q) {
        var on = keep.indexOf(q.id) >= 0, full = !on && n >= r;
        return '<li><label class="pw-keep-row' + (on ? ' on' : '') + (full ? ' full' : '') + '"><input type="checkbox" data-pw-keep="' + esc(q.id) + '"' + (on ? ' checked' : '') + (full ? ' disabled' : '') + '>' +
          '<span class="pw-keep-n"><b>' + esc(CodeUtil.displayName(q)) + '</b><small>' + esc(typeName(getType(q.typeId) || { id: q.typeId })) + '</small></span>' +
          '<span class="pw-keep-s">' + esc(t('pw.keepScans', { n: q.scans || 0 })) + '</span>' +
          '<i class="pw-keep-st">' + esc(t(on ? 'pw.keepOn' : 'pw.keepPaused')) + '</i></label></li>';
      }).join('') + '</ul>' +
      '<button type="button" class="btn primary pw-go" data-pw-keep-go' + (n !== r || busy ? ' disabled' : '') + '>' + esc(t('pw.keepGo', { plan: t('plan.n_' + chosen) })) + '</button>' +
      '<button type="button" class="link-btn" data-pw-back>' + esc(t('pw.back')) + '</button></div>';
  }
  function feats(x) { return PlanGate.featuresHtml(x); }             // met slotjes: wat zit er niet in dit pakket
  function draw() {
    if (!box) { box = document.createElement('div'); box.className = 'paywall'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'pwTitle'); document.body.appendChild(box); }
    if (step === 'pay') return drawPay();
    if (step === 'keep') return drawKeep();
    if (step === 'done') return drawDone();
    if (step === 'wait') { box.innerHTML = '<div class="pw-inner">' + top() + '<div class="pw-done"><span class="pw-spin" aria-hidden="true"></span><h1 id="pwTitle">' + esc(t('pw.processing')) + '</h1><p class="pw-lead">' + esc(t('pw.processingLead')) + '</p></div></div>'; return; }
    var cur = curPlan(), list = plans();
    if (isCurrent(chosen)) { var other = list.filter(function (p) { return !isCurrent(p.id); })[0]; if (other) chosen = other.id; }
    box.innerHTML = '<div class="pw-inner">' + top() +
      '<h1 id="pwTitle">' + esc(t(mode === 'change' ? 'pw.changeTitle' : 'pw.title')) + '</h1><p class="pw-lead">' + esc(t(mode === 'change' ? 'pw.changeLead' : 'pw.lead')) + '</p>' +
      (reason && mode === 'change' ? '<p class="pw-reason" role="status">' + PlanGate.lock + esc(t('pw.reason_' + reason)) + '</p>' : '') +
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
      '<button type="button" class="btn primary pw-go" data-pw-go' + (busy || (!stripeOn() && !demo()) ? ' disabled' : '') + '>' + esc(mode === 'change' ? t(upFrom(chosen) ? 'pw.upgradeTo' : 'pw.choosePlan', { plan: t('plan.n_' + chosen) }) : t('pw.start')) + '</button>' +
      (needKeep() ? '<p class="pw-less" role="note">' + PlanGate.lock + esc(t('pw.lessWarn', { plan: t('plan.n_' + chosen), limit: limitOf(chosen), used: info.usage.used })) + '</p>' : '') +
      (stripeOn() ? '<p class="pw-safe">🔒 ' + esc(t('pw.viaStripe')) + '</p>' : '') +
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
        '<div class="pw-row"><span>' + esc(t(trial ? 'pw.after' : 'pw.then')) + '</span><b>' + euro(price) + ' ' + esc(per) + '</b></div>' +
        (needKeep() ? '<p class="pw-less">' + esc(t('pw.payPaused', { n: activeDyn().length - keep.length })) + '</p>' : '') + '</div>' +
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
    api.account.checkoutDemo({ plan: chosen, period: period, keep: needKeep() ? keep : undefined }).then(function (r) { busy = false; result = r; step = 'done'; draw(); })
      .catch(function () { busy = false; step = 'choose'; draw(); });
  }
  function goStripe() {
    if (busy) return; busy = true; draw();
    api.account.stripeCheckout({ plan: chosen, period: period, keep: needKeep() ? keep : undefined }).then(function (r) { location.href = r.url; })
      .catch(function () { busy = false; draw(); var g = box && box.querySelector('[data-pw-go]'); if (g) g.insertAdjacentHTML('afterend', '<p class="acct-msg bad" role="alert">' + esc(t('pw.payError')) + '</p>'); });
  }
  function show() { draw(); document.body.classList.add('paywall-open'); var f = box.querySelector('.pw-card.on') || box.querySelector('[data-pw-go]'); if (f) f.focus(); }
  function close() { if (box) box.remove(); box = null; document.body.classList.remove('paywall-open'); }
  function check() {
    if (!api.account || !api.account.plan) return;
    if (window.TermsGate && TermsGate.waiting()) return;                 // eerst akkoord met de voorwaarden (terms-gate.js)
    api.account.plan().then(function (r) {
      info = r;
      // Net betaald bij Stripe: even wachten tot Stripe het heeft gemeld (webhook), dan de app in
      if (returned && info.sub && info.sub.state === 'unpaid' && waited < 15) { waited++; mode = 'must'; step = 'wait'; show(); setTimeout(check, 1500); return; }
      if (returned) { returned = false; if (step === 'wait') { result = { sub: info.sub }; chosen = info.plan.id; period = PlanPeriod.norm(info.sub.interval); step = 'done'; mode = 'must'; return show(); } }
      var w = window.wantedPlan; if (w) { chosen = w.plan || chosen; period = PlanPeriod.norm(w.period); }
      if (needed()) { mode = 'must'; step = 'choose'; show(); } else if (mode === 'must') close();
    }).catch(function () {});
  }
  /** Zelf openen: een ander pakket of andere betaalperiode kiezen */
  function open(planId, why, direct) {
    if (blocked()) { goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); return; }
    api.account.plan().then(function (r) {
      info = r; mode = needed() ? 'must' : 'change'; step = 'choose'; sent = false; result = null; reason = why || null;
      if (curPeriod()) period = PlanPeriod.norm(curPeriod());
      var cur = curPlan(), order = ['standard', 'pro', 'business'];
      chosen = planId || (cur && order[order.indexOf(cur) + 1]) || 'pro';                // standaard: één stap omhoog
      if (direct && demo() && !needKeep()) step = 'pay';                                                // "Upgrade naar Pro": meteen afrekenen
      show();
      if (direct && stripeOn() && !needKeep()) { var g = box.querySelector('[data-pw-go]'); if (g) g.click(); }
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
    var k = e.target.closest('[data-pw-keep]');
    if (k) { var id = k.getAttribute('data-pw-keep'); keep = keep.filter(function (x) { return x !== id; }); if (k.checked) keep.push(id); return draw(); }
    if (e.target.closest('[data-pw-go]') && step === 'choose' && needKeep()) return startKeep();
    var kg = e.target.closest('[data-pw-keep-go]');
    if (kg) { if (stripeOn()) { step = 'choose'; return goStripe(); } step = 'pay'; return draw(); }
    if (e.target.closest('[data-pw-go]') && step === 'choose' && stripeOn()) return goStripe();
    if (e.target.closest('[data-pw-go]') && step === 'choose' && demo()) { step = 'pay'; return draw(); }
  });
  document.addEventListener('keydown', function (e) { if (box && mode === 'change' && e.key === 'Escape') close(); });
  document.addEventListener('submit', function (e) { if (box && e.target.closest('[data-pw-form]')) { e.preventDefault(); pay(); } });
  if (window.Session && Session.onUser) Session.onUser(function () { setTimeout(check, 300); });
  document.addEventListener('sub-lapsed', check);
  document.addEventListener('terms-ok', check);
  if (window.i18n) i18n.onChange(function () { if (box) draw(); });
  return { open: open };
})();
