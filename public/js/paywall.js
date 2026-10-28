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
  function pk() { return (api.info && api.info().stripePk) || ''; }
  function inApp() { return stripeOn() && !!pk(); }                    // echt betalen op onze eigen pagina (velden van Stripe)
  var returned = /[?&]checkout=success\b/.test(location.search), waited = 0;      // terug van de betaalpagina van Stripe
  if (/[?&]checkout=(success|cancel)\b/.test(location.search)) history.replaceState(null, '', location.pathname);
  function curPlan() { return info && info.sub && info.sub.state !== 'unpaid' && info.plan ? info.plan.id : null; }
  function curPeriod() { return info && info.sub && info.sub.interval; }
  function isCurrent(id) { return mode === 'change' && id === curPlan() && PlanPeriod.norm(curPeriod()) === period && info.sub.state === 'active'; }
  var ORDER = ['standard', 'pro', 'business'];
  function upFrom(id) { var c = curPlan(); return !!c && ORDER.indexOf(id) > ORDER.indexOf(c); }
  function plans() { return (info.plans || []).filter(function (p) { return p.price != null; }); }
  function top() {
    return '<div class="pw-top"><span class="auth-logo"><img class="logo-mark" src="icons/logo-badge.png" alt=""><b>QR-<small>Codex</small></b><em class="auth-by">by Optimasys</em></span>' +
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
    // Acties gelden één keer (nieuwe klant): per maand de eerste maand goedkoper, per jaar het eerste jaar 2 maanden gratis
    var promo = mode === 'must' && x.trialDays, first = promo && period === 'month' && x.priceFirstMonth != null, year1 = promo && period === 'year' && x.priceYear != null;
    var now = first ? x.priceFirstMonth : year1 ? x.priceYear : PlanPeriod.price(x, period);
    var was = first ? x.price : year1 ? x.priceYearAfter : period === 'quarter' ? PlanPeriod.was(x, period) : null;
    return (promo ? '<span class="pl-promo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/></svg><span class="pl-pl">' + esc(t('pw.promo', { n: x.trialDays })) + '</span><span class="pl-ps">' + esc(t('pw.promoShort', { n: x.trialDays })) + '</span></span>' : '') +
      '<span class="pl-price' + (first || year1 ? ' pl-first' : '') + '">' + (was ? '<s class="pl-was">' + euro(was) + '</s>' : '') + '<b>' + euro(now) + '</b><small>' + esc(first ? t('pw.firstMonthLabel') : year1 ? t('pw.firstYearLabel') : PlanPeriod.per(period)) + '</small></span>' +
      (first ? '<span class="pl-then">' + esc(t('pw.thenMonth', { price: euro(x.price) })) + '</span>'
        : year1 ? '<span class="pl-then"><b class="pl-save">' + esc(t('sub.yearSave')) + '</b> · ' + esc(t('pw.thenYear', { price: euro(x.priceYearAfter) })) + '</span>'
        : period === 'year' ? '<span class="pl-then">' + esc(t('pw.perMonthEq', { price: euro(Math.floor(now / 12 * 100) / 100) })) + '</span>'
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
    if (step === 'method') return drawMethod();
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
      '</div>';
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
      (inApp() ? '' : '<p class="pw-demo" role="note">' + esc(t('pw.stripeDemo')) + '</p>') +
      '<div class="pw-co"><div class="pw-co-sum">' +
        '<span class="pw-co-small">' + esc(t(trial ? 'pw.coTrial' : 'pw.coSub', { plan: t('plan.n_' + x.id) })) + '</span>' +
        '<b class="pw-co-big">' + euro(trial ? 0 : price) + '</b>' +
        '<span class="pw-co-small">' + esc(trial ? t('pw.after') + ': ' + PlanPeriod.then(x, period, euro) : PlanPeriod.label(period)) + '</span>' +
        '<div class="pw-co-line"><span>QR-Codex ' + esc(t('plan.n_' + x.id)) + '<small>' + esc(PlanPeriod.label(period)) + '</small></span><b>' + euro(price) + '</b></div>' +
        extraLine() +
        (needKeep() ? '<p class="pw-co-warn">' + esc(t('pw.payPaused', { n: activeDyn().length - keep.length })) + '</p>' : '') +
        '<div class="pw-co-line pw-tax" id="pwTax" hidden><span></span><b></b></div>' +
        '<div class="pw-co-line tot"><span>' + esc(t('pw.today')) + '</span><b id="pwTotal">' + euro(trial ? 0 : price) + '</b></div>' +
        (inApp() && sBuyer ? '<p class="pw-co-small pw-vatnote">' + esc(t(noVatFor(sBuyer) ? 'pw.b_noVat' : sBuyer.type === 'company' ? 'pw.b_exclVat' : 'pw.b_inclVat')) + '</p>' : '') +
      '</div>' +
      '<form class="pw-co-form" data-pw-form>' +
        '<label class="pw-co-f"><span>' + esc(t('pw.email')) + '</span><input value="' + esc(u.email || '') + '" readonly></label>' +
        (inApp() && !sBuyer
          ? buyerForm()
          : inApp()
          ? buyerLine() + '<div class="pw-co-f"><span>' + esc(t('pw.method')) + '</span><div id="pwPe" class="pw-pe"><span class="pw-spin sm" aria-hidden="true"></span></div></div><p class="acct-msg bad" id="pwErr" role="alert" hidden></p>' +
            (trial && mode === 'must' ? '' : '<details class="pw-promo"' + (sPromo ? ' open' : '') + '><summary>' + esc(t('pw.promoCode')) + '</summary><div class="pw-promo-row"><input data-pw-promo maxlength="40" spellcheck="false" autocomplete="off" value="' + esc(sPromo || '') + '"><button type="button" class="btn ghost sm" data-pw-promo-go>' + esc(t('pw.promoApply')) + '</button></div><p class="pw-promo-msg" role="status"></p></details>')
          : '<div class="pw-co-f"><span>' + esc(t('pw.method')) + '</span><div class="pw-co-methods" role="radiogroup" aria-label="' + esc(t('pw.method')) + '">' +
        ['paypal', 'ideal', 'bancontact', 'card'].map(function (m) {
          var on = m === method;
          return '<div class="pw-co-m' + (on ? ' on' : '') + '"><button type="button" role="radio" aria-checked="' + on + '" data-pw-method="' + m + '"><i class="pw-co-dot"></i><span class="pw-co-ico">' + MICO[m] + '</span>' + esc(mName(m)) + '</button>' +
            (on ? '<div class="pw-co-body">' + methodBody(m) + '</div>' : '') + '</div>';
        }).join('') + '</div></div>') +
        (inApp() && !sBuyer ? '' : '<button type="submit" class="pw-co-go"' + (busy || (inApp() && !sReady) ? ' disabled' : '') + '>' + (busy ? '<span class="pw-spin sm" aria-hidden="true"></span>' : '') + esc(t(trial ? 'pw.startTrial' : 'pw.subscribe')) + '</button>') +
        '<p class="pw-co-fine">' + esc(t(trial ? 'pw.fineTrial' : 'pw.fine', { price: euro(price) + ' ' + per })) + '</p>' +
        '<p class="pw-co-safe">🔒 ' + esc(t(inApp() ? 'pw.viaStripe' : 'pw.safe')) + '</p>' +
        '<button type="button" class="link-btn pw-co-back" data-pw-back>' + esc(t('pw.back')) + '</button>' +
      '</form></div></div>';
    if (inApp() && sBuyer) mountStripe();
  }
  // Andere betaalmethode opslaan (zelfde betaalvelden van Stripe, in onze stijl)
  function drawMethod() {
    var cur = curPlan();
    box.innerHTML = '<div class="pw-inner">' + top() + '<div class="pw-co pw-pm"><div class="pw-co-sum">' +
      '<span class="pw-co-small">' + esc(t('bill.pmTitle')) + '</span>' + (cur ? '<b class="pw-co-big pw-pm-plan">QR-Codex ' + esc(t('plan.n_' + cur)) + '</b>' : '') +
      '<p class="pw-co-note">' + esc(t('bill.pmLead')) + '</p></div>' +
      '<form class="pw-co-form" data-pw-form><div class="pw-co-f"><span>' + esc(t('pw.method')) + '</span><div id="pwPe" class="pw-pe"><span class="pw-spin sm" aria-hidden="true"></span></div></div>' +
      '<p class="acct-msg bad" id="pwErr" role="alert" hidden></p>' +
      '<button type="submit" class="pw-co-go"' + (busy || !sReady ? ' disabled' : '') + '>' + esc(t('bill.pmSave')) + '</button>' +
      '<p class="pw-co-safe">🔒 ' + esc(t('pw.viaStripe')) + '</p></form></div></div>';
    mountStripe();
  }
  // Losse QR-codes die je erbij kocht: gaan mee in het abonnement
  function extraLine() {
    var n = (info && info.plan && info.plan.extra) || 0, x = plans().filter(function (p) { return p.id === chosen; })[0];
    if (!n || !x || x.codes == null || !info.extraPrice) return '';
    return '<div class="pw-co-line"><span>' + esc(t('pw.extraLine', { n: n })) + '<small>' + esc(PlanPeriod.label(period)) + '</small></span><b>' + euro(Math.round(n * info.extraPrice[period] * 100) / 100) + '</b></div>';
  }

  /* ---------- Echt betalen in de app: Stripe Payment Element in onze eigen pagina (stijl van de app) ----------
     De server maakt een Checkout Session (ui_mode 'elements'); Stripe.js tekent alleen de betaalvelden.
     Na betalen stuurt Stripe terug naar /?checkout=success en verwerkt de webhook het abonnement (zelfde als hiervoor). */
  var sJs = null, sCo = null, sPe = null, sKey = '', sReady = false;
  /* Bedrijf of particulier (voor de btw). Eerst invullen, dan pas de betaalvelden. Ingevuld blijft onthouden in deze sessie. */
  var sBuyer = null, bDraft = null, bBad = [], sPromo = '', bLocked = false;   // bLocked: type staat vast (factuurgegevens al opgeslagen)
  var EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
  function draftBuyer() {
    if (bDraft) return bDraft;
    var lang = { nl: 'NL', es: 'ES', de: 'DE', fr: 'FR', it: 'IT', pt: 'PT', pl: 'PL', ro: 'RO', sk: 'SK', lv: 'LV', el: 'GR', bg: 'BG', da: 'DK', sv: 'SE', nb: 'NO', fi: 'FI', ca: 'ES', sq: 'AL' }[i18n.lang()] || 'ES';
    bDraft = { type: (info && info.billing && info.billing.buyer) || 'private', country: lang, companyName: '', vat: '', address: '', postalCode: '', city: '' };
    if (api.account.billing) api.account.billing().then(function (r) { var b = r && r.billing; if (!b || !bDraft) return;
      if (b.type === 'company') bDraft = Object.assign(bDraft, { type: 'company', companyName: b.companyName || '', vat: b.taxId || '' });
      if (b.type === 'private') bDraft.type = 'private';
      bLocked = !!b.type;
      Object.assign(bDraft, { country: b.country || bDraft.country, address: b.address || '', postalCode: b.postalCode || '', city: b.city || '' });
      // Factuurgegevens al ingevuld en compleet: niet nog eens vragen, meteen gebruiken (met "Wijzigen")
      if (!sBuyer && !checkBuyer().length) useDraft();
      if (step === 'pay') draw(); }).catch(function () {});
    return bDraft;
  }
  function countryOpts(sel) {
    var NO = ['KP', 'IR', 'CU', 'SY', 'RU', 'BY'];   // sancties: niet verkopen (zelfde lijst als de server)
    return TEL.C.map(function (c) { return c[0]; }).filter(function (v, i, a) { return a.indexOf(v) === i && NO.indexOf(v) < 0; }).map(function (iso) { return [iso, TEL.name(iso)]; })
      .sort(function (a, b) { return a[1].localeCompare(b[1], i18n.lang()); }).map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === sel ? ' selected' : '') + '>' + TEL.flag(c[0]) + ' ' + esc(c[1]) + '</option>'; }).join('');
  }
  function bField(k, label, attrs, wide) { var d = draftBuyer(); return '<label class="pw-co-f' + (wide ? ' wide' : '') + (bBad.indexOf(k) >= 0 || (k === 'vat' && (bBad.indexOf('vies') >= 0 || bBad.indexOf('viesDown') >= 0)) ? ' bad' : '') + '"><span>' + esc(label) + '</span><input data-pw-b="' + k + '" value="' + esc(d[k] || '') + '"' + (attrs || '') + '></label>'; }
  function buyerForm() {
    var d = draftBuyer(), co = d.type === 'company';
    return (bLocked ? '' : '<div class="pw-co-f"><span>' + esc(t('pw.b_buyerAs')) + '</span><div class="pw-seg" role="radiogroup">' +
        ['private', 'company'].map(function (k) { return '<button type="button" role="radio" aria-checked="' + (d.type === k) + '" class="' + (d.type === k ? 'on' : '') + '" data-pw-btype="' + k + '">' + esc(t('pw.b_' + k)) + '</button>'; }).join('') + '</div></div>') +
      '<label class="pw-co-f' + (bBad.indexOf('country') >= 0 ? ' bad' : '') + '"><span>' + esc(t('pw.b_country')) + '</span><select data-pw-b="country">' + countryOpts(d.country) + '</select></label>' +
      (!co && d.country === 'ES' ? bField('postalCode', t('pw.b_postal'), ' maxlength="5" inputmode="numeric" autocomplete="postal-code"', true) + '<p class="pw-co-note">' + esc(t('pw.b_esPostalHint')) + '</p>' : '') +
      (co ? bField('companyName', t('pw.b_companyName'), ' maxlength="120" autocomplete="organization"', true) +
        bField('vat', t('pw.b_vat'), ' maxlength="24" spellcheck="false" placeholder="' + esc((d.country === 'GR' ? 'EL' : d.country) + '…') + '"', true) + '<p class="pw-co-note">' + esc(t('pw.b_vatHint')) + '</p>' +
        bField('address', t('pw.b_address'), ' maxlength="160" autocomplete="street-address"', true) +
        '<div class="pw-two">' + bField('postalCode', t('pw.b_postal'), ' maxlength="12" autocomplete="postal-code"') + bField('city', t('pw.b_city'), ' maxlength="80" autocomplete="address-level2"') + '</div>' : '') +
      (bBad.length ? '<p class="acct-msg bad" role="alert">' + esc(t(bBad.indexOf('nonEuB2c') >= 0 ? 'pw.b_nonEuB2c' : bBad.indexOf('esB2c') >= 0 ? 'pw.b_esB2c' : bBad.indexOf('blocked') >= 0 ? 'pw.b_blocked' : bBad.indexOf('vies') >= 0 ? 'pw.b_viesBad' : bBad.indexOf('viesDown') >= 0 ? 'pw.b_viesDown' : 'pw.b_buyerErr')) + '</p>' : '') +
      '<button type="button" class="pw-co-go" data-pw-bgo>' + esc(t('pw.b_toPay')) + '</button>';
  }
  // Buiten de EU-btw (ander land buiten de EU, of Canarias/Ceuta/Melilla): 0% btw
  function noVatFor(b) { return !!b && (EU.indexOf(b.country) < 0 || (b.country === 'ES' && /^(35|38|51|52)\d{3}$/.test(b.postalCode || ''))); }
  function buyerLine() {
    var b = sBuyer; if (!b) return '';
    return '<div class="pw-buyer"><span>' + TEL.flag(b.country) + ' <b>' + esc(b.type === 'company' ? b.companyName : t('pw.b_private')) + '</b>' + (b.vat ? ' · ' + esc(b.vat) : '') + '</span><button type="button" class="link-btn" data-pw-bedit>' + esc(t('pw.b_change')) + '</button></div>';
  }
  function useDraft() { var d0 = draftBuyer(); sBuyer = { type: d0.type, country: d0.country, companyName: d0.type === 'company' ? String(d0.companyName).trim() : '', vat: d0.type === 'company' ? d0.vat : '', address: (d0.address || '').trim(), postalCode: (d0.postalCode || '').trim(), city: (d0.city || '').trim() }; }
  function checkBuyer() {
    var d = draftBuyer(), bad = [], co = d.type === 'company', eu = EU.indexOf(d.country) >= 0;
    d.vat = String(d.vat || '').toUpperCase().replace(/[\s.\-]/g, '');
    if (!/^[A-Z]{2}$/.test(d.country)) bad.push('country');
    d.postalCode = String(d.postalCode || '').trim().toUpperCase();
    if (d.country === 'ES' && !/^\d{5}$/.test(d.postalCode)) bad.push('postalCode');
    if (co) {
      if (!String(d.companyName).trim()) bad.push('companyName');
      if (!String(d.address).trim()) bad.push('address');
      if (!String(d.city).trim()) bad.push('city');
      if (!/^[A-Z0-9][A-Z0-9 -]{1,11}$/.test(d.postalCode)) bad.push('postalCode');
      if (eu && (!/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(d.vat) || d.vat.slice(0, 2) !== (d.country === 'GR' ? 'EL' : d.country))) bad.push('vat');
    }
    return bad;
  }
  // Btw en totaal uit de betaling bij Stripe (Stripe Tax): bij elke wijziging bijwerken
  function showTotals(ses) {
    var T = ses && ses.total; if (!T || !box) return;
    var amt = function (x) { return x && (x.amount != null ? x.amount : x); }, minor = function (x) { return x && x.minorUnitsAmount != null ? x.minorUnitsAmount : null; };
    var tx = T.taxExclusive && minor(T.taxExclusive) ? T.taxExclusive : T.taxInclusive && minor(T.taxInclusive) ? T.taxInclusive : null;
    var line = box.querySelector('#pwTax'), tot = box.querySelector('#pwTotal');
    if (tot && amt(T.total) != null) tot.textContent = amt(T.total);
    if (!line) return;
    if (tx) { line.hidden = false; line.querySelector('span').textContent = t('pw.b_vatLine') + (T.taxInclusive === tx ? ' (' + t('pw.b_inclVat') + ')' : ''); line.querySelector('b').textContent = amt(tx); }
    else if (sBuyer && EU.indexOf(sBuyer.country) < 0 && info && info.billing && info.billing.tax) { line.hidden = false; line.querySelector('span').textContent = t('pw.b_noVat'); line.querySelector('b').textContent = euro(0); }
    else if (sBuyer && sBuyer.country === 'ES' && /^(35|38|51|52)\d{3}$/.test(sBuyer.postalCode || '') && info && info.billing && info.billing.tax) { line.hidden = false; line.querySelector('span').textContent = t('pw.b_noVatEs'); line.querySelector('b').textContent = euro(0); }
    else if (sBuyer && sBuyer.type === 'company' && sBuyer.vat && sBuyer.country !== 'ES' && EU.indexOf(sBuyer.country) >= 0 && info && info.billing && info.billing.tax) { line.hidden = false; line.querySelector('span').textContent = t('pw.b_reverse'); line.querySelector('b').textContent = euro(0); }
    else line.hidden = true;
  }
  function loadStripe() {
    if (sJs) return sJs;
    sJs = new Promise(function (ok, bad) {
      if (window.Stripe) return ok();
      var sc = document.createElement('script'); sc.src = 'https://js.stripe.com/endive/stripe.js'; sc.onload = function () { ok(); }; sc.onerror = function () { sJs = null; bad(new Error('stripe.js')); };
      document.head.appendChild(sc);
    });
    return sJs;
  }
  function cssVar(n, d) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || d; }
  function look() {
    var bg = getComputedStyle(document.body).backgroundColor, m = bg.match(/\d+/g) || [0, 0, 0], dark = (+m[0] * 0.3 + +m[1] * 0.59 + +m[2] * 0.11) < 128;
    return {
      theme: dark ? 'night' : 'stripe',
      variables: { colorPrimary: cssVar('--accent', '#2bb5f0'), colorBackground: cssVar('--bg', dark ? '#0b0e13' : '#ffffff'), colorText: cssVar('--fg', dark ? '#f3f5f8' : '#111827'),
        colorTextSecondary: cssVar('--muted', '#98a2b3'), colorDanger: '#ff6b6b', fontFamily: 'Manrope, system-ui, -apple-system, sans-serif', borderRadius: '12px', spacingUnit: '4px' },
      rules: { '.Input': { border: '1px solid ' + (dark ? 'rgba(255,255,255,.12)' : 'rgba(17,24,39,.14)'), boxShadow: 'none' }, '.Tab': { border: '1px solid ' + (dark ? 'rgba(255,255,255,.12)' : 'rgba(17,24,39,.14)') }, '.AccordionItem': { border: '1px solid ' + (dark ? 'rgba(255,255,255,.12)' : 'rgba(17,24,39,.14)') } }
    };
  }
  function stripeErr(msg) { var e = box && box.querySelector('#pwErr'); if (e) { e.textContent = msg || t('pw.payError'); e.hidden = false; } }
  function setGo() { var g = box && box.querySelector('.pw-co-go'); if (!g) return; g.disabled = busy || !sReady; g.classList.toggle('busy', busy); }
  function stripeReset() { try { if (sPe) sPe.destroy(); } catch (e) {} sCo = null; sPe = null; sKey = ''; sReady = false; }
  function mountStripe() {
    var host = box && box.querySelector('#pwPe'); if (!host) return;
    var key = step === 'method' ? 'method' : chosen + '|' + period + '|' + (needKeep() ? keep.join(',') : '') + '|' + JSON.stringify(sBuyer || {});
    if (sPe && sKey === key) { try { sPe.unmount(); } catch (e) {} host.innerHTML = ''; sPe.mount(host); setGo(); return; }   // opnieuw getekend (bv. taal): zelfde betaling
    stripeReset(); sKey = key;
    loadStripe().then(function () {
      var st = window.Stripe(pk(), { locale: 'auto' });
      var secret = (key === 'method' ? api.account.newPayMethod() : api.account.stripeCheckout({ plan: chosen, period: period, keep: needKeep() ? keep : undefined, embedded: true, buyer: sBuyer || undefined })).then(function (r) {
        if (r && r.clientSecret) return r.clientSecret;
        if (r && r.url) location.href = r.url;                          // de server viel terug op de betaalpagina van Stripe
        return new Promise(function () {});
      });
      secret.catch(function (x) { if (x && x.code === 'buyer') { bBad = x.details || ['vat']; sBuyer = null; stripeReset(); return draw(); } stripeErr(); });
      sCo = st.initCheckoutElementsSdk({ clientSecret: secret, elementsOptions: { appearance: look(), fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap' }] } });
      sCo.on('change', function (ses) { sReady = !!(ses && ses.canConfirm); setGo(); showTotals(ses); });
      sPe = sCo.createPaymentElement();
      var h = box && box.querySelector('#pwPe'); if (h) { h.innerHTML = ''; sPe.mount(h); }
    }).catch(function () {                                              // Stripe.js niet te laden: dan de betaalpagina van Stripe zelf
      stripeReset(); step = 'choose'; goStripe();
    });
  }
  function confirmStripe() {
    if (busy || !sCo) return;
    busy = true; setGo(); var e = box && box.querySelector('#pwErr'); if (e) e.hidden = true;
    sCo.loadActions().then(function (r) {
      if (!r || r.type === 'error' || !r.actions) throw (r && r.error) || new Error('actions');
      return r.actions.confirm();
    }).then(function (res) {                                            // gelukt = Stripe stuurt door naar /?checkout=success (of eerst naar de bank, bv. iDEAL)
      if (res && res.type === 'error') { busy = false; setGo(); stripeErr(res.error && res.error.message); }
    }).catch(function (x) { busy = false; setGo(); stripeErr(x && x.message); });
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
  function show() {
    // Gaat het tekenen mis, dan nooit een leeg scherm: sluiten en naar Mijn account > Abonnement
    try { draw(); } catch (e) { console.error('Pakketten-scherm:', e); close(); goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); return; }
    document.body.classList.add('paywall-open'); unwait(); var f = box.querySelector('.pw-card.on') || box.querySelector('[data-pw-go]'); if (f) f.focus(); }
  function close() { stripeReset(); if (box) box.remove(); box = null; document.body.classList.remove('paywall-open'); }
  function unwait() { document.body.classList.remove('pw-wait'); }
  function check() {
    if (!api.account || !api.account.plan) return unwait();
    if (window.TermsGate && TermsGate.waiting()) return unwait();        // eerst akkoord met de voorwaarden (terms-gate.js)
    api.account.plan().then(function (r) {
      info = r;
      // Net betaald bij Stripe: even wachten tot Stripe het heeft gemeld (webhook), dan de app in
      if (returned && info.sub && info.sub.state === 'unpaid' && waited < 15) { waited++; mode = 'must'; step = 'wait'; show(); setTimeout(check, 1500); return; }
      if (returned) { returned = false; document.dispatchEvent(new CustomEvent('paywall-done')); if (step === 'wait') { result = { sub: info.sub }; chosen = info.plan.id; period = PlanPeriod.norm(info.sub.interval); step = 'done'; mode = 'must'; return show(); } }
      var w = window.wantedPlan; if (w) { chosen = w.plan || chosen; period = PlanPeriod.norm(w.period); }
      if (needed()) { mode = 'must'; step = 'choose'; show(); } else if (mode === 'must') close();
      unwait();
    }).catch(unwait);
  }
  /** Betaalmethode wijzigen (Mijn account > Abonnement): eigen scherm met de velden van Stripe */
  function changeMethod() {
    if (!stripeOn()) return;
    if (!inApp()) { api.account.newPayMethod().then(function (r) { if (r && r.url) location.href = r.url; }).catch(function () {}); return; }
    api.account.plan().then(function (r) { info = r; mode = 'change'; step = 'method'; busy = false; stripeReset(); show(); }).catch(function () {});
  }
  /** Zelf openen: een ander pakket of andere betaalperiode kiezen */
  function open(planId, why, direct) {
    if (blocked()) { goToPage('account'); if (window.openAccountTab) openAccountTab('plan'); return; }
    api.account.plan().then(function (r) {
      info = r; mode = needed() ? 'must' : 'change'; step = 'choose'; sent = false; result = null; reason = why || null;
      if (curPeriod()) period = PlanPeriod.norm(curPeriod());
      var cur = curPlan(), order = ['standard', 'pro', 'business'];
      chosen = planId || (cur && order[order.indexOf(cur) + 1]) || 'pro';                // standaard: één stap omhoog
      if (direct && (demo() || inApp()) && !needKeep()) step = 'pay';                                                // "Upgrade naar Pro": meteen afrekenen
      show();
      if (direct && stripeOn() && !inApp() && !needKeep()) { var g = box.querySelector('[data-pw-go]'); if (g) g.click(); }
    }).catch(function () {});
  }
  document.addEventListener('click', function (e) {
    if (!box || !box.contains(e.target)) return;
    var p = e.target.closest('[data-pw-plan]'); if (p && !p.disabled) { chosen = p.getAttribute('data-pw-plan'); return draw(); }
    var mt = e.target.closest('[data-pw-method]'); if (mt) { method = mt.getAttribute('data-pw-method'); return draw(); }
    var y = e.target.closest('[data-pw-period]'); if (y) { period = PlanPeriod.norm(y.getAttribute('data-pw-period')); return draw(); }
    if (e.target.closest('[data-pw-logout]')) { api.auth.logout().catch(function () {}).then(function () { location.replace(location.pathname); }); return; }
    if (e.target.closest('[data-pw-close]')) return close();
    var bt = e.target.closest('[data-pw-btype]'); if (bt) { draftBuyer().type = bt.getAttribute('data-pw-btype'); bBad = []; return draw(); }
    if (e.target.closest('[data-pw-bgo]')) { bBad = checkBuyer(); if (bBad.length) return draw(); useDraft(); return draw(); }
    if (e.target.closest('[data-pw-promo-go]') && sCo) {
      var pin = box.querySelector('[data-pw-promo]'), msg = box.querySelector('.pw-promo-msg'), code = pin ? pin.value.trim() : ''; if (!code) return;
      Promise.resolve(sCo.applyPromotionCode ? sCo.applyPromotionCode(code) : sCo.loadActions().then(function (r) { return r.actions.applyPromotionCode(code); })).then(function (r) {
        var bad = r && r.type === 'error'; sPromo = bad ? '' : code; if (msg) { msg.textContent = t(bad ? 'pw.promoBad' : 'pw.promoOk'); msg.className = 'pw-promo-msg ' + (bad ? 'bad' : 'ok'); }
      }).catch(function () { if (msg) { msg.textContent = t('pw.promoBad'); msg.className = 'pw-promo-msg bad'; } });
      return;
    }
    if (e.target.closest('[data-pw-bedit]')) { stripeReset(); sBuyer = null; return draw(); }
    if (e.target.closest('[data-pw-back]')) { stripeReset(); busy = false; step = 'choose'; return draw(); }
    if (e.target.closest('[data-pw-enter]')) { location.replace(location.pathname); return; }
    var k = e.target.closest('[data-pw-keep]');
    if (k) { var id = k.getAttribute('data-pw-keep'); keep = keep.filter(function (x) { return x !== id; }); if (k.checked) keep.push(id); return draw(); }
    if (e.target.closest('[data-pw-go]') && step === 'choose' && needKeep()) return startKeep();
    var kg = e.target.closest('[data-pw-keep-go]');
    if (kg) { if (stripeOn() && !inApp()) { step = 'choose'; return goStripe(); } step = 'pay'; return draw(); }
    if (e.target.closest('[data-pw-go]') && step === 'choose' && inApp()) { step = 'pay'; return draw(); }
    if (e.target.closest('[data-pw-go]') && step === 'choose' && stripeOn()) return goStripe();
    if (e.target.closest('[data-pw-go]') && step === 'choose' && demo()) { step = 'pay'; return draw(); }
  });
  document.addEventListener('input', function (e) { var k = box && e.target.getAttribute && e.target.getAttribute('data-pw-b'); if (k) { draftBuyer()[k] = e.target.value; } });
  document.addEventListener('change', function (e) { var k = box && e.target.getAttribute && e.target.getAttribute('data-pw-b'); if (k === 'country') { draftBuyer().country = e.target.value; draw(); } });
  document.addEventListener('keydown', function (e) { if (box && mode === 'change' && e.key === 'Escape') close(); });
  document.addEventListener('submit', function (e) { if (box && e.target.closest('[data-pw-form]')) { e.preventDefault(); if (inApp()) confirmStripe(); else pay(); } });
  // Na inloggen: laadscherm laten staan tot bekend is of er eerst een pakket gekozen moet worden (anders flitst de app even)
  if (window.Session && Session.onUser) Session.onUser(function () { if (!blocked()) { document.body.classList.add('pw-wait'); setTimeout(unwait, 8000); } setTimeout(check, 300); });
  document.addEventListener('sub-lapsed', check);
  document.addEventListener('terms-ok', check);
  if (window.i18n) i18n.onChange(function () { if (box) draw(); });
  return { open: open, method: changeMethod };
})();
