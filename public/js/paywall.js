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
  // Tekst: "Standaard heeft 5 QR-codes + 1 extra die je erbij kocht. Je hebt er 7." (zelfde 5 als op de kaart)
  function limitArgs() {
    var x = plans().filter(function (p) { return p.id === chosen; })[0] || {}, ex = (info.plan && info.plan.extra) || 0;
    return { plan: t('plan.n_' + chosen), limit: x.codes, plus: ex ? t('pw.plusExtra', { n: ex }) : '', used: info.usage.used };
  }
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
      '<p class="pw-lead">' + esc(t('pw.keepLead', limitArgs())) + '</p>' +
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
  function priceBlock(x) {
    var promo = mode === 'must' && x.trialDays, month = period === 'month', first = promo && month && x.priceFirstMonth != null;
    var now = first ? x.priceFirstMonth : PlanPeriod.price(x, period), was = first ? x.price : PlanPeriod.was(x, period);
    return (promo ? '<span class="pl-promo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/></svg>' + '<span class="pl-pl">' + esc(t('pw.promo', { n: x.trialDays })) + '</span><span class="pl-ps">' + esc(t('pw.promoShort', { n: x.trialDays })) + '</span></span>' : '') +
      '<span class="pl-price' + (first ? ' pl-first' : '') + '">' + (was ? '<s class="pl-was">' + euro(was) + '</s>' : '') + '<b>' + euro(now) + '</b><small>' + esc(first ? t('pw.firstMonthLabel') : PlanPeriod.per(period)) + '</small></span>' +
      (first ? '<span class="pl-then">' + esc(t('pw.thenMonth', { price: euro(x.price) })) + '</span>'
        : period === 'year' ? '<span class="pl-then"><b class="pl-save">' + esc(t('sub.yearSave')) + '</b> · ' + esc(t('pw.perMonthEq', { price: euro(Math.floor(x.priceYear / 12 * 100) / 100) })) + '</span>'
        : period === 'quarter' && was ? '<span class="pl-then"><b class="pl-save">' + esc(t('pw.youSave', { price: euro(Math.round((was - now) * 100) / 100) })) + '</b></span>' : '');
  }
  // Telefoon: de drie belangrijkste punten kort (de volledige lijst staat op de computer)
  function shortFeats(x) {
    var r = [x.codes == null ? t('pw.sCodesAll') : t('pw.sCodes', { n: x.codes }), x.statsDays ? t('pw.sStats', { n: x.statsDays }) : t('pw.sStatsAll'), x.users == null ? t('pw.sUsersAll') : x.users === 1 ? t('pw.sUsers1') : t('pw.sUsers', { n: x.users })];
    return '<ul class="pl-short">' + r.map(function (v) { return '<li><span aria-hidden="true">✓</span>' + esc(v) + '</li>'; }).join('') + '</ul>';
  }
  function feats(x) { return PlanGate.featuresHtml(x) + shortFeats(x); }             // met slotjes: wat zit er niet in dit pakket
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
      (mode === 'must' ? '<p class="pw-lead-s">' + t('pw.leadShort', { free: '<b>' + esc(t('pw.promoShort', { n: 14 })) + '</b>' }) + '</p>' : '<p class="pw-lead-s">' + esc(t('pw.changeLead')) + '</p>') +
      (reason && mode === 'change' ? '<p class="pw-reason" role="status">' + PlanGate.lock + esc(t('pw.reason_' + reason)) + '</p>' : '') +
      (mode === 'change' && cur ? '<p class="pw-now">' + esc(t('pw.now', { plan: t('plan.n_' + cur), period: PlanPeriod.label(PlanPeriod.norm(curPeriod())) })) + '</p>' : '') +
      PlanPeriod.toggle(period, 'data-pw-period', false) +   // korting staat op de kaarten zelf (wens Fabian 21 okt)
      '<div class="pw-grid" role="radiogroup" aria-label="' + esc(t('pw.title')) + '">' + list.map(function (x) {
        var here = isCurrent(x.id), on = !here && x.id === chosen;
        return '<button type="button" role="radio" aria-checked="' + on + '"' + (here ? ' disabled' : '') + ' class="pw-card' + (on ? ' on' : '') + (here ? ' is-cur' : '') + '" data-pw-plan="' + x.id + '">' +
          (here ? '<span class="pw-pop cur">' + esc(t('pw.current')) + '</span>' : x.id === 'pro' ? '<span class="pw-pop">' + esc(t('pw.popular')) + '</span>' : '') +
          '<span class="pl-name">' + t('plan.n_' + x.id) + '</span>' +
          // Prijs: actieprijs/korting groot, normale prijs doorgestreept. Nieuwe klant: label "14 dagen gratis" en per maand de actie voor de eerste maand.
          priceBlock(x) + feats(x) + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="btn primary pw-go" data-pw-go' + (busy || (!stripeOn() && !demo()) ? ' disabled' : '') + '>' + esc(mode === 'change' ? t(upFrom(chosen) ? 'pw.upgradeTo' : 'pw.choosePlan', { plan: t('plan.n_' + chosen) }) : t('pw.start')) + '</button>' +
      (needKeep() ? '<p class="pw-less" role="note">' + PlanGate.lock + esc(t('pw.lessWarn', limitArgs())) + '</p>' : '') +
      (stripeOn() ? '<p class="pw-safe">🔒 ' + esc(t('pw.viaStripe')) + '</p>' : '') +
      '<p class="pw-note">' + esc(t('pw.reassure')) + '</p></div>';
  }
  // Afrekenen (DEMO): zoals straks de betaalpagina van Stripe, met PayPal, iDEAL, Bancontact of kaart. Er wordt niets afgeschreven.
  var method = 'paypal', BANKS = ['ABN AMRO', 'ING', 'Rabobank', 'ASN Bank', 'bunq', 'Knab', 'SNS', 'Triodos Bank', 'Revolut'];
  var MICO = {
    paypal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
    ideal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18M12 3l9 5H3z"/></svg>',
    bancontact: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>'
  };
  function mName(m) { return m === 'card' ? t('pw.mCard') : { paypal: 'PayPal', ideal: 'iDEAL', bancontact: 'Bancontact' }[m]; }
  function methodBody(m) {
    if (m === 'paypal') return '<p class="pw-co-note">' + esc(t('pw.paypalNote')) + '</p>';
    if (m === 'ideal') return '<label class="pw-co-f"><span>' + esc(t('pw.idealBank')) + '</span><select>' + BANKS.map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('') + '</select></label><p class="pw-co-note">' + esc(t('pw.idealNote')) + '</p>';
    if (m === 'bancontact') return '<p class="pw-co-note">' + esc(t('pw.bancontactNote')) + '</p>';
    return '<label class="pw-co-f"><span>' + esc(t('pw.card')) + '</span><input value="4242 4242 4242 4242" readonly></label>' +
      '<div class="pw-two"><label class="pw-co-f"><span>MM/JJ</span><input value="12/34" readonly></label><label class="pw-co-f"><span>CVC</span><input value="123" readonly></label></div>';
  }
  function drawPay() {
    var x = plans().filter(function (p) { return p.id === chosen; })[0], price = PlanPeriod.price(x, period), per = PlanPeriod.per(period);
    var trial = mode === 'must', u = Session.user() || {};                // nieuwe klant: eerst 14 dagen gratis; wisselen: meteen
    box.innerHTML = '<div class="pw-inner">' + top() +
      '<p class="pw-demo" role="note">' + esc(t('pw.stripeDemo')) + '</p>' +
      '<div class="pw-co"><div class="pw-co-sum">' +
        '<span class="pw-co-small">' + esc(t(trial ? 'pw.coTrial' : 'pw.coSub', { plan: t('plan.n_' + x.id) })) + '</span>' +
        '<b class="pw-co-big">' + euro(trial ? 0 : price) + '</b>' +
        '<span class="pw-co-small">' + esc(trial ? t('pw.after') + ': ' + PlanPeriod.then(x, period, euro) : PlanPeriod.label(period)) + '</span>' +
        '<div class="pw-co-line"><span>QR-Codex ' + esc(t('plan.n_' + x.id)) + '<small>' + esc(PlanPeriod.label(period)) + '</small></span><b>' + euro(price) + '</b></div>' +
        (needKeep() ? '<p class="pw-co-warn">' + esc(t('pw.payPaused', { n: activeDyn().length - keep.length })) + '</p>' : '') +
        '<div class="pw-co-line tot"><span>' + esc(t('pw.today')) + '</span><b>' + euro(trial ? 0 : price) + '</b></div>' +
      '</div>' +
      '<form class="pw-co-form" data-pw-form>' +
        '<label class="pw-co-f"><span>' + esc(t('pw.email')) + '</span><input value="' + esc(u.email || '') + '" readonly></label>' +
        '<div class="pw-co-f"><span>' + esc(t('pw.method')) + '</span><div class="pw-co-methods" role="radiogroup" aria-label="' + esc(t('pw.method')) + '">' +
        ['paypal', 'ideal', 'bancontact', 'card'].map(function (m) {
          var on = m === method;
          return '<div class="pw-co-m' + (on ? ' on' : '') + '"><button type="button" role="radio" aria-checked="' + on + '" data-pw-method="' + m + '"><i class="pw-co-dot"></i><span class="pw-co-ico">' + MICO[m] + '</span>' + esc(mName(m)) + '</button>' +
            (on ? '<div class="pw-co-body">' + methodBody(m) + '</div>' : '') + '</div>';
        }).join('') + '</div></div>' +
        '<button type="submit" class="pw-co-go"' + (busy ? ' disabled' : '') + '>' + (busy ? '<span class="pw-spin sm" aria-hidden="true"></span>' : '') + esc(t(trial ? 'pw.startTrial' : 'pw.subscribe')) + '</button>' +
        '<p class="pw-co-fine">' + esc(t(trial ? 'pw.fineTrial' : 'pw.fine', { price: euro(price) + ' ' + per })) + '</p>' +
        '<p class="pw-co-safe">🔒 ' + esc(t('pw.safe')) + '</p>' +
        '<button type="button" class="link-btn pw-co-back" data-pw-back>' + esc(t('pw.back')) + '</button>' +
      '</form></div></div>';
  }
  // Bevestiging: rustig en zakelijk, zoals na betalen op een echte website (geen animatie)
  var pausedN = 0;
  function drawDone() {
    var sub = result && result.sub, x = plans().filter(function (p) { return p.id === chosen; })[0] || {}, trial = mode === 'must', u = Session.user() || {};
    var first = PlanPeriod.price(x, period), next = trial ? PlanPeriod.firstPay(x, period) : first;
    var date = sub && sub.periodEnd ? i18n.fmt.stamp(sub.periodEnd, 'long') : '';
    var row = function (k, v) { return '<div class="pw-rc-row"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; };
    box.innerHTML = '<div class="pw-inner">' + top() +
      '<div class="pw-rc">' +
        '<div class="pw-rc-head"><span class="pw-rc-ok" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12.5l4 4L18 8"/></svg></span>' +
          '<h1 id="pwTitle">' + esc(t(trial ? 'pw.rcTrial' : 'pw.rcPaid')) + '</h1><b class="pw-rc-amt">' + euro(trial ? 0 : first) + '</b><p>' + esc(t('pw.rcLead', { plan: t('plan.n_' + chosen) })) + '</p></div>' +
        '<div class="pw-rc-rows">' +
          row(t('pw.rcPlan'), 'QR-Codex ' + t('plan.n_' + chosen)) +
          row(t('pw.rcPeriod'), PlanPeriod.label(period)) +
          (date ? row(t('pw.rcNext'), euro(next) + ' · ' + date) : '') +
          (demo() ? row(t('pw.method'), mName(method)) : '') +
          (u.email ? row(t('pw.email'), u.email) : '') +
          (pausedN ? row(t('pw.rcPaused'), t('pw.rcPausedVal', { n: pausedN })) : '') +
        '</div>' +
        '<button type="button" class="pw-co-go" data-pw-enter>' + esc(t('pw.enter')) + '</button>' +
        '<p class="pw-co-fine">' + esc(t('pw.rcManage', { where: t('nav.account') + ' → ' + t('acct.planNav') })) + '</p>' +
        (demo() ? '<p class="pw-co-safe">' + esc(t('pw.rcDemo')) + '</p>' : '') +
      '</div></div>';
  }
  function pay() {
    if (busy) return; busy = true; pausedN = needKeep() ? activeDyn().length - keep.length : 0; drawPay();
    api.account.checkoutDemo({ plan: chosen, period: period, method: method, keep: needKeep() ? keep : undefined }).then(function (r) { busy = false; result = r; step = 'done'; draw(); })
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
    var mt = e.target.closest('[data-pw-method]'); if (mt) { method = mt.getAttribute('data-pw-method'); return draw(); }
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
