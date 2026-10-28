/* Betaalperiodes (Terms punt 4): per maand, per kwartaal, per jaar. Gedeeld met het pakket-scherm en het beheer. */
window.PlanPeriod = {
  list: ['month', 'quarter', 'year'],
  norm: function (p) { return p === 'year' || p === 'quarter' ? p : 'month'; },
  /** Gewone prijs (zonder actie). Acties (eerste maand goedkoper, eerste jaar 2 maanden gratis) gelden één keer: zie firstPay */
  price: function (x, p) { return p === 'year' ? (x.priceYearAfter || x.priceYear) : p === 'quarter' ? x.priceQuarter : x.price; },
  /** Eerste betaling na de 14 dagen gratis (nieuwe klant): per maand de eerste maand 50% korting */
  firstPay: function (x, p) { return p === 'month' && x.priceFirstMonth != null ? x.priceFirstMonth : p === 'year' && x.priceYear != null ? x.priceYear : this.price(x, p); },
  /** Zin onder "14 dagen gratis": wat je daarna betaalt */
  then: function (x, p, money) {
    if (p === 'month' && x.priceFirstMonth != null) return t('pw.firstMonthPhrase', { first: money(x.priceFirstMonth), price: money(x.price) });
    if (p === 'year' && x.priceYear != null && x.priceYearAfter) return t('pw.firstYearPhrase', { first: money(x.priceYear), price: money(x.priceYearAfter) });
    return money(this.price(x, p)) + ' ' + this.per(p);
  },
  /** Normale prijs om door te strepen: per kwartaal 3 × maand, per jaar 12 × maand (zo zie je de korting) */
  was: function (x, p) { return p === 'year' ? Math.round(x.price * 1200) / 100 : p === 'quarter' ? Math.round(x.price * 300) / 100 : null;
  },
  per: function (p) { return t(p === 'year' ? 'sub.perYear' : p === 'quarter' ? 'sub.perQuarter' : 'plan.perMonth'); },
  label: function (p) { return t(p === 'year' ? 'sub.yearly' : p === 'quarter' ? 'sub.quarterly' : 'sub.monthly'); },
  /** Keuzeknoppen; attr = data-attribuut met de periode, save = korting erbij tonen */
  toggle: function (cur, attr, save) {
    return '<div class="pl-period" role="radiogroup" aria-label="' + esc(t('sub.period')) + '">' + this.list.map(function (p) {
      var extra = save && p === 'year' ? ' <em>' + t('sub.yearSave') + '</em>' : save && p === 'quarter' ? ' <em>' + t('sub.quarterSave') + '</em>' : '';
      return '<button type="button" role="radio" aria-checked="' + (p === cur) + '" ' + attr + '="' + p + '">' + PlanPeriod.label(p) + extra + '</button>';
    }).join('') + '</div>';
  },
};
/* Wat zit in je pakket? Vergrendelde dingen tonen een slotje met "vanaf Pro/Business" en openen de pakketten-pagina.
   De server controleert het ook (plan_type, plan_media, plan_bg, plan_limit). Team en online demo: alles open. */
window.PlanGate = (function () {
  var info = null, LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/></svg>';   // bliksem = upgrade (zelfde als 'Upgrade plan' in de zijbalk)
  function plan() { var u = window.Session && Session.user && Session.user(); if (!info || !u || u.admin || (api.isDemo && api.isDemo())) return null; return info.plan; }
  function load() {
    if (!window.api || !api.account || !api.account.plan) return;
    api.account.plan().then(function (r) { info = r; document.dispatchEvent(new CustomEvent('plan-info')); }).catch(function () {});
  }
  if (window.Session && Session.onUser) Session.onUser(function (u) { info = null; if (u) setTimeout(load, 250); });
  return {
    load: load, info: function () { return info; },
    typeOk: function (id) { var p = plan(); return !p || !p.types || p.types.indexOf(id) >= 0; },
    /** what: 'extra' (meer achtergronden), 'image' (eigen foto), 'video' (eigen video) */
    bgOk: function (what) { var p = plan(); if (!p || !p.bg) return true; return what === 'video' ? p.bg === 'all' : p.bg !== 'basic'; },
    statsDays: function () { var p = plan(); return p ? p.statsDays : null; },
    lock: LOCK,
    /** Rustig slotje (alleen het icoon); de naam van het pakket staat in de tooltip */
    badge: function (min) { var l = esc(t('pw.lockFrom', { plan: t('plan.n_' + min) })); return '<span class="lock-badge" title="' + l + '" aria-label="' + l + '">' + LOCK + '</span>'; },
    /** Klik op iets vergrendelds: klein venster "Upgrade naar Pro" (of Business), met de reden */
    upgrade: function (min, reason) { upgradeDialog(min, reason); },
    /** Wat zit er in een pakket, als lijstje: { ok, text, min } (min = vanaf welk pakket, bij een slotje) */
    features: function (x) {
      var f = [];
      f.push({ ok: true, text: x.codes ? t('plan.fCodes', { n: x.codes }) : t('acct.planF1') });
      f.push(x.types ? { ok: true, text: t('pw.fTypes', { n: x.types.length }) } : { ok: true, text: t('acct.planF2') });
      if (x.types) f.push({ ok: false, text: t('acct.planF2'), min: 'pro' });
      f.push({ ok: true, text: x.statsDays ? t('plan.fStats', { n: x.statsDays }) : t('plan.fStatsAll') });
      f.push(x.users === 1 ? { ok: false, text: t('pw.fTeam'), min: 'pro' } : { ok: true, text: x.users ? t('team.fUsers', { n: x.users }) : t('team.fUsersAll') });
      f.push(x.bg === 'basic' ? { ok: false, text: t('pw.fBg'), min: 'pro' } : { ok: true, text: t('pw.fBg') });
      f.push(x.bg === 'all' ? { ok: true, text: t('pw.fVideo') } : { ok: false, text: t('pw.fVideo'), min: 'business' });
      f.push(x.bulk === false ? { ok: false, text: t('pw.fBulk'), min: 'pro' } : { ok: true, text: t(x.api ? 'pw.fBulkApi' : 'pw.fBulk') });
      f.push({ ok: true, text: t('acct.planF4') });
      return f;
    },
    featuresHtml: function (x, cls) {
      return '<ul class="' + (cls || 'pg-feats') + '">' + this.features(x).map(function (r) {
        return '<li class="' + (r.ok ? 'pg-on' : 'pg-off') + '">' + (r.ok ? '<span class="pg-ok" aria-hidden="true">✓</span>' : '<span class="pg-lk">' + LOCK + '</span>') + '<span>' + esc(r.text) + '</span></li>';
      }).join('') + '</ul>';
    },
  };
})();
/* Venster "Upgrade naar Pro/Business": rustig, één duidelijke knop. Daarna meteen afrekenen (demo of Stripe). */
function upgradeDialog(min, reason) {
  if (reason === 'limit') return fullDialog();
  var info = PlanGate.info(), ORDER = ['standard', 'pro', 'business'];
  var cur = info && info.plan && info.sub && info.sub.state !== 'unpaid' ? info.plan.id : null;
  if (!min || (cur && ORDER.indexOf(min) <= ORDER.indexOf(cur))) min = ORDER[Math.max(ORDER.indexOf(cur) + 1, 1)] || 'business';   // altijd één stap hoger
  var p = info && (info.plans || []).filter(function (x) { return x.id === min; })[0];
  var price = p ? new Intl.NumberFormat(i18n.lang(), { style: 'currency', currency: 'EUR' }).format(p.price) : '';
  var d = document.createElement('div'); d.className = 'up-dlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'upDlgT');
  d.innerHTML = '<div class="up-card glass"><button type="button" class="up-x" data-up-close aria-label="' + esc(t('legal.close')) + '">×</button>' +
    '<span class="up-lock">' + PlanGate.lock + '</span>' +
    '<h2 id="upDlgT">' + esc(t('pw.upgradeTo', { plan: t('plan.n_' + min) })) + '</h2>' +
    (reason ? '<p>' + esc(t('pw.reason_' + reason)) + '</p>' : '') +
    (p ? PlanGate.featuresHtml(p, 'pg-feats up-feats') : '') +
    '<button type="button" class="btn primary up-go" data-up-go>' + esc(t('pw.upgradeTo', { plan: t('plan.n_' + min) })) + '</button>' +
    (price ? '<small class="up-price">' + esc(price) + ' ' + esc(t('plan.perMonth')) + '</small>' : '') +
    '<button type="button" class="link-btn" data-up-all>' + esc(t('pw.allPlans')) + '</button></div>';
  document.body.appendChild(d);
  var close = function () { d.remove(); document.removeEventListener('keydown', esc1); };
  var esc1 = function (e) { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc1);
  d.addEventListener('click', function (e) {
    if (e.target === d || e.target.closest('[data-up-close]')) return close();
    if (e.target.closest('[data-up-go]')) { close(); if (window.Plans) Plans.open(min, reason, true); }
    if (e.target.closest('[data-up-all]')) { close(); if (window.Plans) Plans.open(min, reason); }
  });
  var go = d.querySelector('[data-up-go]'); if (go) go.focus();
}
/* Venster "Je QR-codes zijn op": één QR-code erbij kopen, of upgraden. Daarna kun je meteen verder. */
function fullDialog() {
  var info = PlanGate.info(), ORDER = ['standard', 'pro', 'business'];
  if (!info) { PlanGate.load(); return; }
  var p = info.plan, cur = p && info.sub && info.sub.state !== 'unpaid' ? p.id : null, next = ORDER[Math.max(ORDER.indexOf(cur) + 1, 1)] || 'business';
  var iv = PlanPeriod.norm(info.sub && info.sub.interval), xp = info.extraPrice ? info.extraPrice[iv] : 0.99;
  var money = function (n) { return new Intl.NumberFormat(i18n.lang(), { style: 'currency', currency: 'EUR' }).format(n); };
  var canBuy = p && p.codes != null && p.id !== 'free' && (api.info().demoCheckout || api.info().stripe);
  var d = document.createElement('div'); d.className = 'up-dlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'fullT');
  d.innerHTML = '<div class="up-card glass"><button type="button" class="up-x" data-up-close aria-label="' + esc(t('legal.close')) + '">×</button>' +
    '<span class="up-lock">' + PlanGate.lock + '</span>' +
    '<h2 id="fullT">' + esc(t('pw.fullTitle')) + '</h2>' +
    '<p>' + esc(t('pw.fullLead', { n: info.usage ? info.usage.limit : '', plan: t('plan.n_' + (cur || 'standard')) })) + '</p>' +
    (canBuy ? '<button type="button" class="btn primary up-go" data-buy-one>' + esc(t('pw.buyOne')) + '</button><small class="up-price">' + esc(money(xp) + ' ' + PlanPeriod.per(iv)) + '</small>' : '') +
    (cur !== 'business' ? '<button type="button" class="btn ' + (canBuy ? 'ghost' : 'primary') + ' up-go" data-up-next>' + esc(t('pw.upgradeTo', { plan: t('plan.n_' + next) })) + '</button>' : '') +
    '<p class="acct-msg bad" data-full-err hidden></p>' +
    '<button type="button" class="link-btn" data-up-all>' + esc(t('pw.allPlans')) + '</button></div>';
  document.body.appendChild(d);
  var close = function () { d.remove(); document.removeEventListener('keydown', k); };
  var k = function (e) { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', k);
  d.addEventListener('click', function (e) {
    if (e.target === d || e.target.closest('[data-up-close]')) return close();
    if (e.target.closest('[data-up-next]')) { close(); if (window.Plans) Plans.open(next, 'limit', true); return; }
    if (e.target.closest('[data-up-all]')) { close(); if (window.Plans) Plans.open(next, 'limit'); return; }
    var b = e.target.closest('[data-buy-one]'); if (!b) return;
    b.disabled = true;
    (api.info().stripe ? api.account.stripeExtra({ n: 1 }) : api.account.extraDemo({ n: 1 })).then(function () {
      d.querySelector('.up-card').innerHTML = '<span class="up-lock done">✓</span><h2>' + esc(t('pw.bought')) + '</h2><p>' + esc(t('pw.boughtLead')) + '</p>' +
        '<button type="button" class="btn primary up-go" data-up-close>' + esc(t('pw.goOn')) + '</button>';
      PlanGate.load(); document.dispatchEvent(new CustomEvent('plan-changed'));
    }, function () { b.disabled = false; var er = d.querySelector('[data-full-err]'); er.textContent = t('pw.payError'); er.hidden = false; });
  });
  var f = d.querySelector('.up-go'); if (f) f.focus();
}
/* Naar "QR-code maken" terwijl je codes op zijn: meteen het venster (niet pas na het invullen) */
document.addEventListener('pagechange', function (e) {
  if (e.detail !== 'create' || !window.PlanGate) return;
  var u = window.Session && Session.user && Session.user(); if (!u || u.admin || (api.isDemo && api.isDemo())) return;
  if (window.store && store.get && store.get().editing) return;
  PlanGate.load();
  document.addEventListener('plan-info', function once() {
    document.removeEventListener('plan-info', once);
    var i = PlanGate.info();
    if (i && i.usage && i.usage.state === 'full' && i.sub && i.sub.state !== 'unpaid') fullDialog();
  });
});
/* Knop met data-gate-open="pro" (en data-gate-reason) opent het upgrade-venster */
document.addEventListener('click', function (e) { var g = e.target.closest('[data-gate-open]'); if (g) { e.preventDefault(); PlanGate.upgrade(g.getAttribute('data-gate-open'), g.getAttribute('data-gate-reason')); } });
/* =========================================================
   MIJN ACCOUNT
   Rechts een menu in drie groepen, links het gekozen onderdeel (op de telefoon staat het menu bovenaan):
     Account     Profiel · Beveiliging · Voorkeuren · Achtergrond
     Facturatie  Factuurgegevens · Abonnement en facturen
     Privacy     Mijn gegevens (downloaden) · Account verwijderen
   Account verwijderen gaat in drie stappen, elk met een waarschuwing:
     1. wat je kwijtraakt (met jouw echte aantallen)  2. vinkjes + wachtwoord  3. laatste waarschuwing (venster)
   Bovenaan een visitekaartje: profielfoto (klik = wijzigen), naam, rol en status, e-mail, lid sinds en de cijfers.
   Profiel: foto, voornaam/achternaam, e-mail (bevestigd), tijdzone (alle datums volgen die) en de gevarenzone.
   In de online demo (zonder server) werkt alles ook; de gegevens staan dan alleen in deze browser.
   ========================================================= */
(function () {
  var box = document.getElementById('acctCards'), menu = document.getElementById('acctMenu'), stats = document.getElementById('acctStats');
  var bgSection = document.getElementById('bgSection'), user = null, sum = null, tab = 'profile';
  var billing = null, billingLoaded = false, draft = null, bad = [], delStep = 1, delErr = '';
  var sticky = null, editing = null, emailDraft = '', emailPending = null, sessions = null, activity = null;   // welke regel open staat; e-mail onderweg; apparaten en activiteit                 // factuurgegevens: opgeslagen, in bewerking, foute velden
  var SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
  var ICON = {
    keys: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10"/>',
    legal: '<path d="M12 4v16M6 20h12M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.4-4 4.4-6 8-6s6.6 2 8 6"/>',
    security: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    prefs: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    background: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/>',
    billing: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
    plan: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    data: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    company: '<rect x="4" y="7" width="16" height="13" rx="1.5"/><path d="M9 7V4h6v3M4 12h16"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.4-4 4.4-6 8-6s6.6 2 8 6"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    notify: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    'delete': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    api: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5.5l-3 13"/>',
    domain: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
    team: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.3.2 3.9 1.8 4.5 4.8"/>'
  };
  // Twee pagina's op hetzelfde scherm: Mijn account (jij, meldingen, voorkeuren, betalen) en Instellingen (sneltoetsen, privacy, juridisch, account verwijderen)
  var SCOPES = {
    account: [
      ['acct.groupAccount', [['profile', 'acct.profile'], ['security', 'acct.security'], ['notify', 'notify.title'], ['prefs', 'acct.prefsTitle'], ['background', 'account.background']]],
      ['acct.groupBilling', [['billing', 'acct.billing'], ['plan', 'acct.planNav'], ['team', 'team.nav'], ['api', 'api.nav'], ['domain', 'dom.nav']]]
    ],
    settings: [
      ['st.groupGeneral', [['keys', 'keys.title']]],
      ['acct.groupPrivacy', [['legal', 'nav.legal'], ['data', 'acct.dataTitle'], ['delete', 'acct.delete']]]
    ]
  };
  var scope = 'account';
  function ids(sc) { return [].concat.apply([], SCOPES[sc].map(function (g) { return g[1].map(function (x) { return x[0]; }); })); }
  function scopeOf(id) { return ids('settings').indexOf(id) >= 0 ? 'settings' : 'account'; }
  var GROUPS = SCOPES.account, ALL_TABS = ids('account');
  var GEAR = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>';
  /** Het hoofdaccount (super-admin) kan niet verwijderd worden: dan ook geen knop of onderdeel daarvoor */
  function canDelete() { return !(user && user.superAdmin); }
  // Teamlid: betalen en abonnement horen bij de eigenaar, niet bij het lid
  function isMember() { return !!(window.Team && Team.member()); }
  function shown(id) { return (id !== 'delete' || canDelete()) && !((isMember() || (user && user.admin)) && (id === 'billing' || id === 'plan' || id === 'api')) && !(id === 'domain' && (!(api.info && api.info().customDomains) || isMember() || (user && user.admin))) && !(id === 'team' && (user && user.admin || !window.Team)); }   // Team: altijd zichtbaar; bij Standard met een slotje (Team.html). Admins (Optimasys-team) zijn gratis: geen facturen, pakket, API of team
  function tabIds() { return ALL_TABS.filter(shown); }
  var BILLING_KEYS = ['companyName', 'taxId', 'firstName', 'lastName', 'email', 'address', 'postalCode', 'city', 'country'];

  function loadSummary() { if (!user) return; api.account.summary().then(function (x) { sum = x; draw(); }).catch(function () {}); }
  function loadBilling() {
    if (!user) return;
    api.account.billing().then(function (r) { billing = r.billing || null; billingLoaded = true; if (!draft) draft = startDraft(); draw(); }).catch(function () { billingLoaded = true; draw(); });
  }
  function startDraft() {
    var b = Object.assign({ type: 'company' }, billing || {});
    if (!billing) {                                                     // eerste keer: alvast invullen wat we weten
      var w = String(user.name || '').trim().split(/\s+/);
      b.firstName = w.length > 1 ? w.slice(0, -1).join(' ') : (w[0] || ''); b.lastName = w.length > 1 ? w[w.length - 1] : '';
      b.country = ({ nl: 'NL', en: 'GB', de: 'DE', es: 'ES', fr: 'FR', it: 'IT', pl: 'PL', pt: 'PT', el: 'GR', sq: 'AL' })[i18n.lang()] || 'NL';
    }
    BILLING_KEYS.forEach(function (k) { if (b[k] == null) b[k] = ''; });
    return b;
  }
  function initials(n) { var w = String(n || '').trim().split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); }
  function countries() {
    return TEL.C.map(function (c) { return c[0]; }).filter(function (v, i, a) { return a.indexOf(v) === i; })
      .map(function (iso) { return [iso, TEL.name(iso)]; }).sort(function (a, b) { return a[1].localeCompare(b[1], i18n.lang()); });
  }

  /* ---------- Naam, foto, tijdzone ---------- */
  function splitName(n) { var w = String(n || '').trim().split(/\s+/).filter(Boolean); return [w[0] || '', w.slice(1).join(' ')]; }   // "Jan van Dijk" -> Jan / van Dijk
  function avatarHtml(u) { return u.avatar ? '<img src="' + esc(u.avatar) + '" alt="">' : esc(initials(u.name || u.email)); }
  var zones = null;
  function zoneList() {
    if (zones) return zones;
    var list = []; try { list = Intl.supportedValuesOf('timeZone'); } catch (e) {}
    if (!list.length) list = ['Europe/Amsterdam', 'Europe/Brussels', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Rome', 'Europe/Lisbon', 'Europe/London', 'Europe/Warsaw', 'Europe/Athens', 'Europe/Tirane', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'];
    var now = new Date();
    zones = list.map(function (z) { var o = offset(z, now); return [z, o, '(UTC' + (o < 0 ? '−' : '+') + pad(Math.floor(Math.abs(o) / 60)) + ':' + pad(Math.abs(o) % 60) + ') ' + z.replace(/_/g, ' ')]; })
      .sort(function (a, b) { return a[1] - b[1] || a[0].localeCompare(b[0]); });
    return zones;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function offset(z, d) {                                             // minuten voor/achter UTC, nu
    try {
      var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(d).forEach(function (x) { p[x.type] = +x.value; });
      return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(d.getTime() / 6e4) * 6e4) / 6e4);
    } catch (e) { return 0; }
  }
  function nowIn(z) { try { return new Intl.DateTimeFormat(i18n.lang() === 'en' ? 'en' : 'nl', { timeZone: z || undefined, hour: '2-digit', minute: '2-digit' }).format(new Date()); } catch (e) { return ''; } }
  /** Foto verkleinen in de browser: vierkant uit het midden, 256 × 256, JPG */
  function shrink(file) {
    return new Promise(function (ok, no) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return no(new Error('type'));
      if (file.size > 15 * 1048576) return no(new Error('big'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var S = 256, c = document.createElement('canvas'), m = Math.min(img.naturalWidth, img.naturalHeight); c.width = c.height = S;
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, S, S);
        URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('type')); };
      img.src = url;
    });
  }
  // Je foto ook in het menu (in plaats van het poppetje bij Mijn account)
  function navAvatar() {
    var a = document.querySelector('.sidebar .item[data-page="account"], nav .item[data-page="account"]'); if (!a) return;
    var nm = document.getElementById('navMeName'); if (nm) nm.textContent = (user && (user.name || user.email)) || '';
    var old = a.querySelector('.nav-av'), ic = a.querySelector('svg');
    if (user && user.avatar) {
      if (!old) { old = document.createElement('img'); old.className = 'nav-av'; old.alt = ''; a.insertBefore(old, a.firstChild); }
      old.src = user.avatar; if (ic) ic.style.display = 'none';
    } else { if (old) old.remove(); if (ic) ic.style.display = ''; }
  }

  /* ---------- Menu ---------- */
  function drawMenu() {
    menu.innerHTML = '<div class="acct-tabs" role="tablist" aria-orientation="vertical" aria-label="' + esc(t('acct.sections')) + '">' + GROUPS.filter(function (g) { return g[1].some(function (x) { return shown(x[0]); }); }).map(function (g) {
      return '<p class="acct-group" aria-hidden="true">' + t(g[0]) + '</p>' + g[1].filter(function (x) { return shown(x[0]); }).map(function (x) {
        var on = x[0] === tab;
        return '<button type="button" role="tab"' + (x[0] === 'delete' ? ' class="acct-tab-danger"' : '') + ' id="acctTab-' + x[0] + '" data-tab="' + x[0] + '" aria-selected="' + on + '" aria-controls="' + (x[0] === 'background' ? 'bgSection' : 'acctCards') + '" tabindex="' + (on ? 0 : -1) + '">' + SVG + ICON[x[0]] + '</svg><span>' + t(x[1]) + '</span>' +
          (x[0] === 'billing' && billingLoaded && !billing && !user.admin && !viaStripe() ? '<i class="acct-dot" title="' + esc(t('acct.billingMissing')) + '"></i>' : '') + '</button>';
      }).join('');
    }).join('') + '</div>' +
    // Juridisch (stond eerst op een aparte pagina "Instellingen"; nu hier, zodat er maar één plek is)
    // Mijn account: knop naar de pagina Instellingen. Instellingen: terug naar Mijn account.
    (scope === 'account' ? '<span class="acct-menu-line" aria-hidden="true"></span><button type="button" class="acct-out acct-goset" data-go-scope="settings">' + SVG + GEAR + '</svg><span>' + t('nav.settings') + '</span></button>'
      : '<span class="acct-menu-line" aria-hidden="true"></span><button type="button" class="acct-out acct-goset" data-go-scope="account">' + SVG + ICON.profile + '</svg><span>' + t('nav.account') + '</span></button>') +
    (scope !== 'account' ? '' : '<span class="acct-menu-line" aria-hidden="true"></span>' +
    '<button type="button" class="acct-out" data-page="logout">' + SVG + ICON.out + '</svg><span>' + t('nav.logout') + '</span></button>');
    requestAnimationFrame(tabFades);
  }
  /* Telefoon: de tabbladen schuiven opzij. Vervaagde rand = er is nog meer; het open tabblad komt in beeld. */
  function tabFades() {
    var bar = menu.querySelector('.acct-tabs'); if (!bar) return;
    var sc = bar.scrollWidth > bar.clientWidth + 2 ? bar : (menu.scrollWidth > menu.clientWidth + 2 ? menu : null);
    var set = function () { if (!sc) return; bar.classList.toggle('fade-l', sc.scrollLeft > 4); bar.classList.toggle('fade-r', sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 4); };
    if (sc && !sc._fades) { sc._fades = true; sc.addEventListener('scroll', set, { passive: true }); }
    var on = bar.querySelector('[aria-selected="true"]'); if (sc && on) sc.scrollLeft = Math.max(0, on.offsetLeft - (sc.clientWidth - on.offsetWidth) / 2);
    bar.classList.remove('fade-l', 'fade-r'); set();
  }
  addEventListener('resize', function () { if (menu.innerHTML) tabFades(); });
  function head(m) {
    m = m || {};
    var av = document.getElementById('acctAvatar');
    document.getElementById('acctAvatarIn').innerHTML = avatarHtml(user); av.classList.toggle('has-photo', !!user.avatar);
    av.setAttribute('aria-label', t(user.avatar ? 'acct.photoChange' : 'acct.photoAdd')); av.title = t(user.avatar ? 'acct.photoChange' : 'acct.photoAdd');
    document.getElementById('acctName').textContent = user.name || user.email;
    var role = user.role || (user.superAdmin ? 'super' : user.admin ? 'admin' : 'user');
    document.getElementById('acctBadges').innerHTML = (role !== 'user' ? '<span class="acct-chip role-' + role + '">' + SVG + ICON.shield + '</svg>' + t('acct.role_' + role) + '</span>' : '') +
      '<span class="acct-chip ok"><i></i>' + t('acct.statusActive') + '</span>';
    var since = sum && sum.createdAt ? i18n.fmt.stamp(sum.createdAt, 'long') : '';
    var em = document.getElementById('acctEmail'); em.removeAttribute('data-i18n');
    em.textContent = user.email;
    navAvatar();
    var se = document.getElementById('acctSince'); se.textContent = since ? t('acct.since', { date: since }) : ''; se.hidden = !since;
    var stat = function (v, k, page) { return '<a href="#" class="acct-stat" data-goto="' + page + '"><b>' + (v == null ? '–' : i18n.fmt.num(v)) + '</b><small>' + t(k) + '</small></a>'; };
    stats.innerHTML = stat(sum && sum.codes, 'acct.codes', 'myCodes') + stat(sum && sum.scans, 'acct.scansTotal', 'analytics') + stat(sum && sum.scans30, 'acct.scans30', 'analytics');
    document.getElementById('acctPhotoBox').innerHTML = '<div class="idc-btns"><button type="button" class="btn ghost" data-photo-pick>' + SVG + ICON.camera + '</svg>' + t(user.avatar ? 'acct.photoChange' : 'acct.photoAdd') + '</button>' +
      (user.avatar ? '<button type="button" class="btn ghost idc-rm" data-photo-remove aria-label="' + esc(t('acct.photoRemove')) + '" title="' + esc(t('acct.photoRemove')) + '">' + SVG + ICON.trash + '</svg></button>' : '') + '</div>' +
      '<small>' + t('acct.photoHintShort') + '</small>' + (m.photo ? '<p class="acct-msg ' + m.photo[1] + '" role="status">' + esc(m.photo[0]) + '</p>' : '');
    var dn = document.getElementById('acctDemo'); if (dn) { dn.hidden = !api.isDemo(); dn.textContent = t('acct.demoNote'); }
  }

  /* ---------- Onderdelen ---------- */
  function field(label, input, opts) {
    opts = opts || {};
    return '<label class="auth-f' + (opts.wide ? ' acct-wide' : '') + (opts.cls ? ' ' + opts.cls : '') + '"><span>' + label + (opts.optional ? ' <em class="acct-opt">' + t('acct.optional') + '</em>' : '') + '</span>' +
      '<span class="auth-in' + (opts.icon ? ' acct-ic' : '') + '">' + (opts.icon ? SVG + ICON[opts.icon] + '</svg>' : '') + input + '</span>' +
      (opts.error ? '<small class="acct-err" id="' + opts.errId + '">' + opts.error + '</small>' : opts.hint ? '<small class="auth-hint">' + opts.hint + '</small>' : '') + '</label>';
  }
  function billingPanel(m) {
    if (!billingLoaded || !draft) return '<div class="glass bg-card acct"><h2>' + t('acct.billing') + '</h2><p>…</p></div>';
    var b = draft, company = b.type !== 'private';
    var input = function (k, extra) {
      var isBad = bad.indexOf(k) >= 0;
      return '<input name="' + k + '" value="' + esc(b[k]) + '"' + (isBad ? ' aria-invalid="true" aria-describedby="err-' + k + '"' : '') + (extra || '') + '>';
    };
    var e = function (k) {
      if (bad.indexOf(k) < 0) return null;
      if (k === 'taxId') return t('acct.errTaxId');
      return String(b[k] || '').trim() ? t('acct.errInvalid') : t('acct.errRequired');
    };
    var f = function (k, label, icon, opts) { opts = Object.assign({ icon: icon, error: e(k), errId: 'err-' + k }, opts || {}); return field(label, input(k, opts.attrs), opts); };
    var seg = function (v, label, icon) { var on = b.type === v; return '<button type="button" role="radio" aria-checked="' + on + '" data-btype="' + v + '">' + SVG + ICON[icon] + '</svg>' + label + '</button>'; };
    return '<div class="glass bg-card acct"><h2>' + t('acct.billing') + '</h2><p>' + t('acct.billingLead') + '</p>' +
      '<form data-form="billing" novalidate>' +
      // Of bedrijf, of particulier: één keer kiezen. Daarna alleen dat type (wisselen verandert de btw, dat gaat via ons)
      (billing && billing.type ? '<div class="acct-type-lock">' + SVG + ICON[company ? 'company' : 'person'] + '</svg><b>' + esc(t(company ? 'acct.company' : 'acct.private')) + '</b><small>' + esc(t('acct.typeLocked')) + ' <a href="#" data-goto="contact">' + esc(t('acct.typeLockedLink')) + '</a></small></div>'
        : '<div class="acct-seg" role="radiogroup" aria-label="' + esc(t('acct.typeLabel')) + '">' + seg('company', t('acct.company'), 'company') + seg('private', t('acct.private'), 'person') + '</div>') +
      '<div class="acct-grid">' +
      (company ? f('companyName', t('acct.companyName'), 'company', { attrs: ' maxlength="120" autocomplete="organization"' }) +
                 f('taxId', t('acct.taxId'), 'hash', { optional: true, hint: t('acct.taxIdHint'), attrs: ' maxlength="24" autocapitalize="characters" spellcheck="false"' }) : '') +
      // Of bedrijf, of particulier: bedrijf = bedrijfsnaam + btw-nummer, particulier = voor- en achternaam (niet allebei)
      (company ? '' : f('firstName', t('acct.firstName'), 'person', { attrs: ' maxlength="60" autocomplete="given-name"' }) +
      f('lastName', t('acct.lastName'), 'person', { attrs: ' maxlength="60" autocomplete="family-name"' })) +
      f('email', t('acct.billingEmail'), 'mail', { optional: true, wide: true, hint: t('acct.billingEmailHint'), attrs: ' type="email" maxlength="254" autocomplete="email" placeholder="' + esc(user.email) + '"' }) +
      f('address', t('acct.address'), 'pin', { attrs: ' maxlength="160" autocomplete="street-address"' }) +
      f('postalCode', t('acct.postalCode'), 'hash', { attrs: ' maxlength="12" autocomplete="postal-code"' }) +
      f('city', t('acct.city'), 'pin', { attrs: ' maxlength="80" autocomplete="address-level2"' }) +
      field(t('acct.country'), '<select name="country"' + (bad.indexOf('country') >= 0 ? ' aria-invalid="true"' : '') + ' autocomplete="country"><option value="">' + t('acct.chooseCountry') + '</option>' +
        countries().map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === b.country ? ' selected' : '') + '>' + TEL.flag(c[0]) + ' ' + esc(c[1]) + '</option>'; }).join('') + '</select>',
        { icon: 'globe', error: e('country'), errId: 'err-country' }) +
      '</div>' +
      '<div class="acct-actions">' + (billing ? '<button class="btn ghost" type="button" data-billing-reset>' + t('myCodes.cancel') + '</button>' : '') +
      '<button class="btn primary" type="submit">' + t('acct.save') + '</button></div></form>' + (m.billing ? '<p class="acct-msg ' + m.billing[1] + '" role="status">' + esc(m.billing[0]) + '</p>' : '') + '</div>';
  }
  var planInfo = null, planBusy = false;
  function loadPlan() { if (planBusy) return; planBusy = true; api.account.plan().then(function (r) { planBusy = false; planInfo = r; if (tab === 'plan') draw(); if (r && r.portal) loadPm(); }).catch(function () { planBusy = false; planInfo = { error: true }; if (tab === 'plan') draw(); }); }
  /* Abonnement beheren in de app zelf (geen klantportal van Stripe meer): betaalmethode, opzeggen, doorgaan */
  var pmInfo = null, planMsg = null, subBusy = false;
  function loadPm() { api.account.payMethod().then(function (r) { pmInfo = (r && r.method) || false; if (tab === 'plan') draw(); }).catch(function () { pmInfo = false; }); }
  function pmText(m) {
    if (!m) return esc(t('bill.viaStripe'));
    var brand = m.brand ? m.brand.charAt(0).toUpperCase() + m.brand.slice(1) : t('pw.mCard');
    if (m.type === 'card') return esc(brand) + ' •••• ' + esc(m.last4 || '') + (m.exp ? ' <small class="bl-pm-exp">' + esc(m.exp) + '</small>' : '');
    if (m.type === 'sepa_debit') return esc(t('bill.pmSepa')) + ' •••• ' + esc(m.last4 || '');
    if (m.type === 'paypal') return 'PayPal' + (m.email ? ' <small class="bl-pm-exp">' + esc(m.email) + '</small>' : '');
    return esc(m.type) + (m.last4 ? ' •••• ' + esc(m.last4) : '');
  }
  function askCancel() {
    var sb = (planInfo && planInfo.sub) || {}, bl = (planInfo && planInfo.billing) || {}, d = document.getElementById('mcDialog'); if (!d) return;
    var R = ['too_expensive', 'missing_features', 'switched_service', 'unused', 'too_complex', 'other'];
    d.innerHTML = '<form method="dialog" class="mc-dlg"><h3>' + esc(t('bill.cancelTitle')) + '</h3><p>' + esc(bl.trial ? t('bill.cancelTrialText') : t('bill.cancelPaidText', { date: day(sb.periodEnd) })) + '</p>' +
      '<label class="auth-f cx-why"><span>' + esc(t('bill.why')) + '</span><select name="why"><option value="">—</option>' + R.map(function (r) { return '<option value="' + r + '">' + esc(t('bill.r_' + r)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="auth-f cx-why"><span class="auth-in"><textarea name="comment" rows="2" maxlength="500"></textarea></span></label>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="no" autofocus>' + esc(t('bill.cancelKeep')) + '</button><button class="btn danger" value="yes">' + esc(t('bill.cancelYes')) + '</button></div></form>';
    d.addEventListener('close', function () {
      if (d.returnValue !== 'yes') return;
      subBusy = true; draw();
      var fw = d.querySelector('[name=why]'), fc = d.querySelector('[name=comment]');
      api.account.cancelSub({ reason: fw ? fw.value : '', comment: fc ? fc.value : '' }).then(function () { subBusy = false; planMsg = ['bill.cancelled', 'ok']; planInfo = null; invInfo = null; loadPlan(); loadInv(); document.dispatchEvent(new Event('sub-lapsed')); })
        .catch(function () { subBusy = false; planMsg = ['pw.payError', 'bad']; draw(); });
    }, { once: true });
    d.returnValue = ''; d.showModal();
  }
  function resumeSub() {
    subBusy = true; draw();
    api.account.resumeSub().then(function () { subBusy = false; planMsg = ['bill.resumed', 'ok']; planInfo = null; loadPlan(); document.dispatchEvent(new Event('sub-lapsed')); })
      .catch(function () { subBusy = false; planMsg = ['pw.payError', 'bad']; draw(); });
  }
  // Terug van een nieuwe betaalmethode (?go=plan&pm=cs_…): meteen als standaard zetten en melden
  var pmBack = (location.search.match(/[?&]pm=(cs_[A-Za-z0-9_]+)/) || [])[1];
  function euro(n) { return n === 0 ? t('plan.freeMonth') : new Intl.NumberFormat(i18n.lang(), { style: 'currency', currency: 'EUR' }).format(n); }
  /* ---------- Abonnement en facturen: overzicht zoals bij een professionele dienst ----------
     1. Je pakket (status, prijs, volgende betaling, periode, betaalmethode, knoppen)  2. Gebruik  3. Inbegrepen
     4. Factuuradres  5. Facturen (Stripe: echte facturen met PDF; demo: voorbeeldbetalingen) */
  var invInfo = null, invBusy = false;
  function loadInv() { if (invBusy) return; invBusy = true; api.account.invoices().then(function (r) { invBusy = false; invInfo = r; if (tab === 'plan') draw(); }).catch(function () { invBusy = false; invInfo = { error: true }; if (tab === 'plan') draw(); }); }
  function money(n) { return new Intl.NumberFormat(i18n.lang(), { style: 'currency', currency: 'EUR' }).format(n || 0); }
  function day(x) { return x ? i18n.fmt.stamp(x, 'long') : ''; }
  var METHOD = { paypal: 'PayPal', ideal: 'iDEAL', bancontact: 'Bancontact' };
  function methodName(m) { return m === 'card' ? t('pw.mCard') : METHOD[m] || ''; }
  function nextAmount(p, sb, bl) {                                     // wat de volgende keer wordt afgeschreven (pakket + losse codes)
    var iv = PlanPeriod.norm(sb && sb.interval), base = bl && bl.trial ? PlanPeriod.firstPay(p, iv) : PlanPeriod.price(p, iv);
    var xp = planInfo.extraPrice ? planInfo.extraPrice[iv] || 0 : 0;
    return (Number(base) || 0) + (p.extra || 0) * xp;
  }
  function meter(label, used, limit, extra) {
    var pct = limit ? Math.min(100, Math.round(used / limit * 100)) : 0, st = !limit ? 'ok' : used >= limit ? 'full' : pct >= 90 ? 'near' : 'ok';
    return '<div class="bl-meter"><div class="bl-meter-top"><span>' + esc(label) + '</span><b>' + (limit ? esc(t('bill.ofN', { used: i18n.fmt.num(used), limit: i18n.fmt.num(limit) })) : esc(i18n.fmt.num(used)) + ' · ' + esc(t('bill.unlimited'))) + '</b></div>' +
      (limit ? '<div class="pl-bar ' + st + '" role="progressbar" aria-valuemin="0" aria-valuemax="' + limit + '" aria-valuenow="' + used + '" aria-label="' + esc(label) + '"><i style="width:' + pct + '%"></i></div>' : '<div class="pl-bar unl" aria-hidden="true"><i style="width:100%"></i></div>') +
      (extra || '') + '</div>';
  }
  function planCurrent() {
    if (!planInfo) { setTimeout(loadPlan, 0); return '<div class="glass bg-card acct"><h2>' + t('acct.planCurrent') + '</h2><p class="acct-note">' + t('plan.loading') + '</p></div>'; }
    if (planInfo.error) return '<div class="glass bg-card acct"><h2>' + t('acct.planCurrent') + '</h2><p class="acct-msg bad" role="alert">' + t('plan.loadError') + '</p></div>';
    var p = planInfo.plan, u = planInfo.usage, sb = planInfo.sub || {}, bl = planInfo.billing || {}, free = p.id === 'free', member = window.Team && Team.member && Team.member();
    if (sb.state === 'unpaid') return '<div class="glass bg-card acct"><div class="acct-plan-head"><div><h2>' + t('acct.planCurrent') + '</h2><p>' + t('sub.unpaidMsg') + '</p></div><span class="acct-badge">' + t('sub.admUnpaid') + '</span></div>' +
      '<div class="bl-actions"><button type="button" class="btn primary" data-open-plans>' + t('plan.seePlans') + '</button></div></div>';
    // Status
    var st = sb.state === 'grace' ? ['bad', 'bill.stGrace'] : sb.state === 'ended' ? ['bad', 'bill.stEnded'] : bl.cancelAtEnd ? ['warn', 'bill.stCancel'] : bl.trial ? ['info', 'bill.stTrial'] : ['ok', 'bill.stActive'];
    var iv = PlanPeriod.norm(sb.interval), paid = sb.state === 'active' && sb.periodEnd, price = free ? null : PlanPeriod.price(p, iv);
    var fact = function (label, value, sub) { return '<div class="bl-fact"><span>' + esc(label) + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; };
    // Geplande wissel naar een kleiner pakket: de volgende betaling is al het nieuwe pakket
    var nx = bl.next, nxPlan = nx && (planInfo.plans || []).filter(function (x) { return x.id === nx.plan; })[0];
    var nextCell = !paid ? fact(t('bill.next'), '—', esc(sb.state === 'none' ? t('bill.byTeam') : ''))
      : nxPlan ? fact(t('bill.next'), esc(money((Number(PlanPeriod.price(nxPlan, PlanPeriod.norm(nx.period))) || 0) + (nxPlan.codes != null ? (p.extra || 0) * ((planInfo.extraPrice || {})[PlanPeriod.norm(nx.period)] || 0) : 0))), esc(t('bill.on', { date: day(nx.at) })))
      : bl.cancelAtEnd ? fact(t('bill.endsOn'), esc(day(sb.periodEnd)), esc(t('bill.endsSub')))
      : fact(t('bill.next'), esc(money(nextAmount(p, sb, bl))), esc(t(bl.trial ? 'bill.afterTrial' : 'bill.on', { date: day(sb.periodEnd) })));
    var method = bl.method ? esc(methodName(bl.method)) + ' <em class="bl-demo">' + esc(t('bill.demoTag')) + '</em>' : planInfo.portal ? (pmInfo === null ? '…' : pmText(pmInfo)) : '—';
    var live = planInfo.portal && !member && (sb.state === 'active' || bl.trial);
    var hero = '<div class="glass bg-card acct bl-hero">' +
      '<div class="bl-top"><div><span class="bl-label">' + t('bill.yourPlan') + '</span><h2 class="bl-plan">QR-Codex ' + esc(t('plan.n_' + p.id)) + ' <i class="bl-st ' + st[0] + '">' + esc(t(st[1])) + '</i></h2></div>' +
        (price != null ? '<div class="bl-price"><b>' + esc(money(price)) + '</b><small>' + esc(PlanPeriod.per(iv)) + '</small></div>' : '') + '</div>' +
      (sb.state === 'grace' ? '<p class="acct-msg bad" role="alert">' + t('sub.graceMsg', { date: i18n.fmt.stamp(sb.graceUntil, 'time') }) + '</p>' : sb.state === 'ended' ? '<p class="acct-msg bad" role="alert">' + t('sub.endedMsg') + '</p>' : '') +
      '<div class="bl-facts">' + nextCell + fact(t('bill.period'), esc(sb.interval ? PlanPeriod.label(iv) : '—')) + fact(t('bill.method'), method, planInfo.portal && !member ? '<button type="button" class="link-btn" data-pm-change>' + esc(t('bill.changeMethod')) + '</button>' : '') + '</div>' +
      (member ? '' : '<div class="bl-actions"><button type="button" class="btn primary" data-open-plans>' + t('bill.change') + '</button>' +
        (live && bl.cancelAtEnd ? '<button type="button" class="btn ghost" data-sub-resume' + (subBusy ? ' disabled' : '') + '>' + esc(t('bill.resume')) + '</button>' : '') +
        (live && !bl.cancelAtEnd ? '<button type="button" class="btn ghost danger-ghost" data-sub-cancel' + (subBusy ? ' disabled' : '') + '>' + esc(t('bill.cancelSub')) + '</button>' : '') + '</div>') +
      (nxPlan ? '<div class="bl-next" role="note"><span>' + esc(t('bill.nextPlan', { plan: t('plan.n_' + nx.plan), date: day(nx.at), cur: t('plan.n_' + p.id) })) + '</span>' +
        (member ? '' : '<button type="button" class="btn ghost sm" data-next-cancel' + (subBusy ? ' disabled' : '') + '>' + esc(t('bill.keepPlan', { plan: t('plan.n_' + p.id) })) + '</button>') + '</div>' : '') +
      (planMsg ? '<p class="acct-msg ' + planMsg[1] + '" role="status">' + esc(t(planMsg[0], planMsg[2])) + '</p>' : '') +
      '<p class="bl-fine">' + esc(t('sub.graceRule', { n: '' })) + '</p></div>';
    // Gebruik
    var canBuy = p.codes != null && !free && (api.info().demoCheckout || api.info().stripe);
    var codesExtra = (p.extra ? '<small class="bl-sub">' + esc(t('plan.extraNote', { n: p.extra })) + '</small>' : '') +
      (u.planPaused && u.planPaused.length ? '<small class="bl-sub">' + esc(t(u.planPaused.length === 1 ? 'myCodes.planBarOne' : 'myCodes.planBar', { n: u.planPaused.length })) + '</small>' : '');
    var users = p.users;
    var use = '<div class="glass bg-card acct"><div class="bl-head"><h2>' + t('bill.usage') + '</h2>' + (canBuy ? '<button type="button" class="btn ghost sm" data-gate-open="" data-gate-reason="limit">+ ' + esc(t('plan.buyExtra')) + '</button>' : '') + '</div>' +
      '<div class="bl-meters">' + meter(t('bill.codes'), u.used, u.limit, codesExtra) +
        (users === 1 ? '' : meter(t('bill.team'), bl.teamUsed || 1, users)) +
        '<div class="bl-meter"><div class="bl-meter-top"><span>' + esc(t('bill.stats')) + '</span><b>' + esc(p.statsDays ? t('bill.statsDays', { n: p.statsDays }) : t('bill.statsAll')) + '</b></div></div>' +
      '</div></div>';
    var inc = free ? '' : '<div class="glass bg-card acct"><h2>' + esc(t('bill.inPlan', { plan: t('plan.n_' + p.id) })) + '</h2>' + PlanGate.featuresHtml(p, 'pg-feats two') + '</div>';
    return hero + use + inc;
  }
  function invRows() {
    if (!invInfo) { setTimeout(loadInv, 0); return '<div class="acct-empty" role="row"><span role="cell">' + t('plan.loading') + '</span></div>'; }
    if (invInfo.error) return '<div class="acct-empty" role="row"><span role="cell">' + t('plan.loadError') + '</span></div>';
    if (!invInfo.items.length) return '<div class="acct-empty" role="row"><span role="cell">' + SVG + ICON.billing + '</svg>' + t('acct.invEmpty') + '</span></div>';
    var S = { paid: 'bill.sPaid', trial: 'bill.sTrial', open: 'bill.sOpen', void: 'bill.sVoid', uncollectible: 'bill.sUncollectible' };
    return invInfo.items.map(function (x) {
      var desc = x.desc || (x.kind === 'extra' ? t(x.n === 1 ? 'bill.lineExtraOne' : 'bill.lineExtra', { n: x.n }) : 'QR-Codex ' + t('plan.n_' + x.plan)) + (x.interval ? ' · ' + PlanPeriod.label(PlanPeriod.norm(x.interval)) : '');
      var cls = x.status === 'paid' ? 'ok' : x.status === 'trial' ? 'info' : x.status === 'open' ? 'warn' : 'bad';
      return '<div class="acct-tr bl-tr" role="row"><span role="cell" data-l="' + esc(t('acct.invDate')) + '">' + esc(i18n.fmt.stamp(x.at, 'short')) + '</span>' +
        '<span role="cell" class="bl-desc"><b>' + esc(desc) + '</b><small>' + esc(x.number) + '</small></span>' +
        '<span role="cell" class="bl-amt">' + esc(money(x.amount)) + '</span>' +
        '<span role="cell"><i class="bl-st ' + cls + '">' + esc(t(S[x.status] || 'bill.sOpen')) + '</i></span>' +
        (invInfo.demo ? '' : '<span role="cell" class="bl-dl">' + (x.pdf ? '<a class="btn ghost sm" href="' + esc(x.pdf) + '" target="_blank" rel="noopener">' + SVG + ICON.download + '</svg>' + esc(t('bill.download')) + '</a>' : x.url ? '<a class="link-btn" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(t('bill.view')) + '</a>' : '<span class="bl-none">—</span>') + '</span>') + '</div>';
    }).join('');
  }
  function planPanel() {
    var addr = billing ? [billing.type === 'company' ? billing.companyName : (billing.firstName + ' ' + billing.lastName), billing.address, (billing.postalCode + ' ' + billing.city).trim(), TEL.name(billing.country)].filter(Boolean).map(esc).join('<br>') : '';
    return planCurrent() +
      '<div class="glass bg-card acct bl-addr"><div><h2>' + t('acct.billingTo') + '</h2>' +
        (billing ? '<p class="acct-addr">' + addr + (billing.taxId ? '<br><span>' + t('acct.taxId') + ': ' + esc(billing.taxId) + '</span>' : '') + (billing.email ? '<br><span>' + esc(billing.email) + '</span>' : '') + '</p>'
          : viaStripe() ? '<p class="acct-addr">' + esc(t('acct.billingAuto')) + '</p>' : '<p class="bl-missing">' + SVG + ICON.warn + '</svg>' + t('acct.billingMissing') + '</p>') + '</div>' +
        '<button type="button" class="btn ' + (billing || viaStripe() ? 'ghost' : 'primary') + '" data-tab-go="billing">' + t(billing ? 'bill.edit' : 'acct.billingFill') + '</button></div>' +
      '<div class="glass bg-card acct"><div class="bl-head"><h2>' + t('acct.invoices') + '</h2></div>' +
        '<div class="acct-table bl-table' + (invInfo && invInfo.demo ? ' nodl' : '') + '" role="table" aria-label="' + esc(t('acct.invoices')) + '"><div class="acct-tr acct-th bl-tr" role="row">' +
        ['acct.invDate', 'bill.desc', 'acct.invAmount', 'acct.invStatus'].concat(invInfo && invInfo.demo ? [] : ['bill.invoice']).map(function (k) { return '<span role="columnheader">' + t(k) + '</span>'; }).join('') + '</div>' +
        invRows() + '</div>' +
        (invInfo && invInfo.demo && invInfo.items && invInfo.items.length ? '<p class="bl-fine">' + esc(t('bill.demoNote')) + '</p>' : '') + '</div>';
  }
  /* ---------- API (Business): sleutels maken en intrekken, korte uitleg met voorbeelden ---------- */
  var apiInfo = null, apiNew = null, apiErr = '';
  function loadApi() { api.account.apiKeys().then(function (r) { apiInfo = r; if (tab === 'api') draw(); }, function () { apiInfo = { error: true }; if (tab === 'api') draw(); }); }
  /* ---------- Eigen domein (Business): korte links op je eigen domein ---------- */
  var domInfo = null, domMsg = null, domBusy = false;
  function loadDom() { api.account.domain().then(function (r) { domInfo = r; if (tab === 'domain') draw(); }, function () { domInfo = { loadFailed: true }; if (tab === 'domain') draw(); }); }
  function domPanel() {
    var head = '<h2>' + t('dom.title') + '</h2><p>' + t('dom.lead') + '</p>';
    if (!domInfo) return '<div class="glass bg-card acct">' + head + '<p class="acct-note">' + t('plan.loading') + '</p></div>';
    if (domInfo.loadFailed) return '<div class="glass bg-card acct">' + head + '<p class="acct-msg bad" role="alert">' + esc(t('dom.errOther')) + '</p></div>';
    if (!domInfo.allowed) return '<div class="glass bg-card acct api-lock">' + head +
      '<button type="button" class="btn primary" data-gate-open="business" data-gate-reason="domain">' + PlanGate.lock + ' ' + esc(t('pw.upgradeTo', { plan: t('plan.n_business') })) + '</button></div>';
    var msg = domMsg ? '<p class="acct-msg ' + (domMsg[1] || '') + '" role="status">' + esc(domMsg[0]) + '</p>' : '';
    if (!domInfo.host) return '<div class="glass bg-card acct">' + head +
      '<form data-dom-form class="dom-form"><label class="auth-f"><span>' + t('dom.host') + '</span><span class="auth-in"><input name="host" placeholder="' + esc(t('dom.ph')) + '" spellcheck="false" autocomplete="off" maxlength="200" required></span></label>' +
      '<p class="acct-note">' + t('dom.hostHint') + '</p>' + msg + '<button type="submit" class="btn primary"' + (domBusy ? ' disabled' : '') + '>' + t('dom.add') + '</button></form></div>';
    var on = domInfo.state === 'active';
    return '<div class="glass bg-card acct">' + head +
      '<div class="dom-status ' + (on ? 'ok' : 'wait') + '"><b>' + esc(domInfo.host) + '</b><span>' + esc(t(on ? 'dom.active' : domInfo.error === 'ssl' ? 'dom.waitSsl' : 'dom.waitDns')) + '</span></div>' +
      (on ? '<p class="acct-note">' + esc(t('dom.activeNote', { example: 'https://' + domInfo.host + '/q/abc123' })) + '</p>'
        : '<h3 class="dom-h">' + t('dom.stepsTitle') + '</h3><ol class="dom-steps"><li>' + t('dom.step1') + '</li><li>' + t('dom.step2') + '<div class="dom-rec"><span>' + t('dom.type') + '</span><code>CNAME</code><span>' + t('dom.name') + '</span><code>' + esc(domInfo.host) + '</code><span>' + t('dom.value') + '</span><code>' + esc(domInfo.target) + '</code></div></li><li>' + t('dom.step3') + '</li></ol>') +
      msg + '<div class="dom-acts">' + (on ? '' : '<button type="button" class="btn primary" data-dom="check"' + (domBusy ? ' disabled' : '') + '>' + t('dom.check') + '</button>') +
      '<button type="button" class="btn ghost danger-ghost" data-dom="remove"' + (domBusy ? ' disabled' : '') + '>' + t('dom.remove') + '</button></div>' +
      '<p class="acct-note">' + t('dom.printed') + '</p></div>';
  }
  function domErr(x) { var c = x && x.code; return t(c === 'host' ? 'dom.errHost' : c === 'taken' ? 'dom.errTaken' : c === 'too_many' ? 'auth.errTooMany' : 'dom.errOther'); }
  box.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-dom-form]'); if (!f) return; e.preventDefault(); domBusy = true; domMsg = null; draw();
    api.account.domainAdd({ host: f.host.value }).then(function () { domBusy = false; loadDom(); }, function (x) { domBusy = false; domMsg = [domErr(x), 'bad']; draw(); });
  });
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-dom]'); if (!b) return; var a = b.getAttribute('data-dom'); domBusy = true; domMsg = null; draw();
    if (a === 'check') api.account.domainCheck().then(function (r) { domBusy = false; domInfo = Object.assign({}, domInfo, r); domMsg = r.state === 'active' ? [t('dom.nowActive'), 'ok'] : [t(r.error === 'ssl' ? 'dom.waitSsl' : 'dom.notYet'), '']; draw(); }, function (x) { domBusy = false; domMsg = [domErr(x), 'bad']; draw(); });
    if (a === 'remove') api.account.domainRemove().then(function () { domBusy = false; loadDom(); }, function (x) { domBusy = false; domMsg = [domErr(x), 'bad']; draw(); });
  });

  function apiPanel() {
    if (!apiInfo) return '<div class="glass bg-card acct"><h2>' + t('api.title') + '</h2><p class="acct-note">' + t('plan.loading') + '</p></div>';
    if (apiInfo.error) return '<div class="glass bg-card acct"><h2>' + t('api.title') + '</h2><p class="acct-msg bad" role="alert">' + t('plan.loadError') + '</p></div>';
    var base = location.origin + location.pathname.replace(/[^/]*$/, '') + 'api/v1';
    var docs = '<div class="glass bg-card acct api-docs"><h2>' + t('api.docsTitle') + '</h2><p>' + t('api.docsLead') + '</p>' +
      '<div class="api-kv"><span>' + t('api.base') + '</span><code>' + esc(base) + '</code></div>' +
      '<div class="api-kv"><span>' + t('api.auth') + '</span><code>Authorization: Bearer qrc_…</code></div>' +
      '<table class="api-tbl"><tbody>' + [
        ['GET', '/qr-codes', 'api.e1'], ['GET', '/qr-codes/{id}', 'api.e2'], ['POST', '/qr-codes', 'api.e3'], ['POST', '/qr-codes/bulk', 'api.e4'],
        ['PUT', '/qr-codes/{id}', 'api.e5'], ['PATCH', '/qr-codes/{id}', 'api.e6'], ['DELETE', '/qr-codes/{id}', 'api.e7'], ['GET', '/analytics?codes={id}&from=…&to=…', 'api.e8']
      ].map(function (r) { return '<tr><td><b class="api-m m-' + r[0].toLowerCase() + '">' + r[0] + '</b></td><td><code>' + esc(r[1]) + '</code></td><td>' + esc(t(r[2])) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="api-ex-t">' + t('api.example') + '</p><pre class="api-pre" tabindex="0"><code>' + esc('curl -X POST ' + base + '/qr-codes \\\n  -H "Authorization: Bearer qrc_…" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"typeId":"website","name":"Tafel 1","content":{"url":"https://example.com"},"design":{}}\'') + '</code></pre>' +
      '<p class="acct-note">' + t('api.limits') + '</p></div>';
    if (!apiInfo.allowed) return '<div class="glass bg-card acct api-lock"><h2>' + t('api.title') + '</h2><p>' + t('api.lockedLead') + '</p>' +
      '<button type="button" class="btn primary" data-gate-open="business" data-gate-reason="api">' + PlanGate.lock + ' ' + esc(t('pw.upgradeTo', { plan: t('plan.n_business') })) + '</button>' +
      // Zonder Business: de handleiding dichtgeklapt (wie wil kan kijken wat het is, de rest ziet geen lap tekst)
      '<details class="api-peek"><summary>' + esc(t('api.peek')) + '</summary>' + docs.replace('glass bg-card acct api-docs', 'api-docs in-peek') + '</details></div>';
    var keys = apiInfo.keys || [];
    return '<div class="glass bg-card acct"><h2>' + t('api.title') + '</h2><p>' + t('api.lead') + '</p>' +
      (apiNew ? '<div class="api-new" role="status"><b>' + t('api.newTitle') + '</b><p>' + t('api.newLead') + '</p><div class="api-keybox"><code id="apiNewKey">' + esc(apiNew) + '</code><button type="button" class="btn primary sm" data-api-copy>' + t('api.copy') + '</button></div></div>' : '') +
      (keys.length ? '<ul class="api-keys">' + keys.map(function (k) {
        return '<li><div><b>' + esc(k.name) + '</b><small><code>' + esc(k.prefix) + '…</code> · ' + esc(t('api.created', { date: i18n.fmt.stamp(k.createdAt, 'short') })) + ' · ' + esc(k.lastUsedAt ? t('api.used', { date: i18n.fmt.stamp(k.lastUsedAt, 'short') }) : t('api.never')) + '</small></div>' +
          '<button type="button" class="btn ghost sm danger-ghost" data-api-del="' + esc(k.id) + '">' + t('api.revoke') + '</button></li>';
      }).join('') + '</ul>' : '<p class="acct-note">' + t('api.none') + '</p>') +
      (keys.length < (apiInfo.max || 10) ? '<form class="api-form" data-form="apikey"><label class="auth-f"><span>' + t('api.name') + '</span><span class="auth-in"><input name="name" maxlength="60" placeholder="' + esc(t('api.namePh')) + '"></span></label><button class="btn primary" type="submit">' + t('api.create') + '</button></form>' : '') +
      (apiErr ? '<p class="acct-msg bad" role="alert">' + esc(apiErr) + '</p>' : '') + '</div>' + docs;
  }
  function confirmApiDel() { return window.confirm(t('api.revokeConfirm')); }
  function dangerCard(m) {
    if (!canDelete()) return '';
    return '<div class="glass bg-card acct acct-danger"><div class="acct-danger-head">' + SVG + ICON.warn + '</svg><div><h2>' + t('acct.dangerTitle') + '</h2><p>' + t('acct.dangerLead') + '</p></div></div>' +
      '<div class="acct-danger-row"><div><b>' + t('acct.delete') + '</b><small>' + t('acct.deleteHint') + '</small></div>' +
      '<button type="button" class="btn danger" data-tab-go="delete">' + SVG + ICON.trash + '</svg>' + t('acct.delete') + '</button></div></div>';
  }
  /* ---------- Profiel: eerst bekijken, per regel "Wijzigen" (zoals bij grote apps: niets verandert per ongeluk) ---------- */
  function row(key, label, value, o) {
    o = o || {};
    var open = editing === key;
    return '<div class="ar' + (open ? ' open' : '') + '" data-row="' + key + '"><div class="ar-top">' +
      '<span class="ar-ic">' + SVG + ICON[o.icon || 'person'] + '</svg></span>' +
      '<div class="ar-main"><span class="ar-label">' + label + '</span><div class="ar-val">' + value + '</div></div>' +
      (o.locked ? '<span class="ar-lock" title="' + esc(t('acct.locked')) + '">' + SVG + ICON.lock + '</svg></span>'
        : o.edit && !open ? '<button type="button" class="btn ghost ar-btn" data-edit="' + key + '" aria-label="' + esc(t('acct.change') + ': ' + label) + '">' + SVG + ICON.edit + '</svg>' + t('acct.change') + '</button>' : '') + '</div>' +
      (o.why ? '<details class="ar-why"><summary>' + t('acct.whyLocked') + '</summary><p>' + o.why + '</p></details>' : '') +
      (open && o.form ? '<div class="ar-form">' + o.form + '</div>' : '') +
      (o.msg ? '<p class="acct-msg ' + o.msg[1] + '" role="status">' + esc(o.msg[0]) + '</p>' : '') + '</div>';
  }
  function btns(label) {
    return '<div class="ar-actions"><button type="button" class="btn ghost" data-edit-cancel>' + t('myCodes.cancel') + '</button><button class="btn primary" type="submit">' + (label || t('acct.save')) + '</button></div>';
  }
  /** Voltooi je profiel: wat is er al, wat nog (klik = er meteen heen) */
  // Met Stripe vult de betaling de factuurgegevens zelf in: dan niet zeuren dat ze ontbreken (wens Fabian 26 okt)
  function viaStripe() { return !!(api.info && api.info().stripe); }
  function completeness() {
    var items = [
      ['photo', !!user.avatar, 'acct.cpPhoto', 'data-photo-pick', 'camera'],
      ['name', !!String(user.name || '').trim(), 'acct.cpName', 'data-edit="name"', 'person'],
      ['email', user.verified !== false, 'acct.cpEmail', '', 'mail'],
      ['tz', !!user.timezone, 'acct.cpTz', 'data-edit="tz"', 'clock'],
      user.admin || viaStripe() ? null : ['billing', !!billing, 'acct.cpBilling', 'data-tab-go="billing"', 'billing'],   // admin-accounts zijn gratis: geen factuur
      ['code', !!(sum && sum.codes), 'acct.cpCode', 'data-goto="create"', 'qr']
    ].filter(Boolean);
    var done = items.filter(function (x) { return x[1]; }).length, pct = Math.round(done / items.length * 100);
    if (pct === 100) return '<div class="glass bg-card acct cp cp-done"><span class="cp-badge">' + SVG + ICON.check + '</svg></span><div><h2>' + t('acct.cpDoneTitle') + '</h2><p>' + t('acct.cpDoneText') + '</p></div></div>';
    return '<div class="glass bg-card acct cp"><div class="cp-head"><div><h2>' + t('acct.cpTitle') + '</h2><p>' + t(items.length - done === 1 ? 'acct.cpLeadOne' : 'acct.cpLead', { n: items.length - done }) + '</p></div>' +
      '<b class="cp-pct">' + pct + '%</b></div>' +
      '<div class="cp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(t('acct.cpTitle')) + '"><i style="width:' + pct + '%"></i></div>' +
      '<ul class="cp-list">' + items.map(function (x) {
        return '<li class="' + (x[1] ? 'ok' : '') + '">' + (x[1] || !x[3] ? '<span>' : '<button type="button" ' + x[3] + '>') +
          '<i>' + SVG + (x[1] ? ICON.check : ICON[x[4]]) + '</svg></i>' + t(x[2]) + (x[1] || !x[3] ? '</span>' : '<em>' + SVG + '<path d="M9 6l6 6-6 6"/></svg></em></button>') + '</li>';
      }).join('') + '</ul></div>';
  }
  function profilePanel(m, note) {
    var nm = splitName(user.name), tz = user.timezone || '', here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    var role = user.role || (user.superAdmin ? 'super' : user.admin ? 'admin' : 'user'), locked = !!user.emailLocked;
    var tzLabel = tz ? (zoneList().filter(function (z) { return z[0] === tz; })[0] || [0, 0, tz])[2] : t('acct.tzAuto', { zone: (here || 'UTC').replace(/_/g, ' ') });
    var opts = '<option value="">' + esc(t('acct.tzAuto', { zone: (here || 'UTC').replace(/_/g, ' ') })) + '</option>' +
      zoneList().map(function (z) { return '<option value="' + z[0] + '"' + (z[0] === tz ? ' selected' : '') + '>' + esc(z[2]) + '</option>'; }).join('');
    var verified = user.verified !== false ? ' <em class="acct-verified inline">' + SVG + ICON.check + '</svg>' + t('acct.verified') + '</em>' : '';
    var pending = emailPending ? '<div class="ar-pending">' + SVG + ICON.mail + '</svg><div><b>' + t('acct.emailSentTitle') + '</b><small>' + t('acct.emailSentText', { email: '<b>' + esc(emailPending.email) + '</b>' }) + '</small>' +
      (emailPending.link ? '<a class="btn ghost" href="' + esc(emailPending.link) + '">' + t('acct.emailOpenLink') + '</a>' : emailPending.mail === false ? '<small class="ar-warn">' + t('acct.emailNoMail') + '</small>' : '') + '</div></div>' : '';
    return '' +   // (feedback: geen 'Maak je profiel compleet' meer; voor- en achternaam zijn verplicht, zie requireName)
      '<div class="glass bg-card acct"><h2>' + t('acct.personalTitle') + '</h2><p>' + t('acct.personalLead') + '</p><div class="ar-list">' +
        row('name', t('auth.name'), esc(user.name || '–'), { edit: true, icon: 'person', msg: m.name,
          form: '<form data-form="name" class="acct-grid">' +
            '<div class="acct-wide">' + field(t('auth.name'), '<input name="nick" value="' + esc(user.name || '') + '" maxlength="60" autocomplete="nickname" required>') + '</div>' +
            '<div class="acct-wide">' + btns() + '</div></form>' }) +
        row('email', t('auth.email'), esc(user.email) + verified + pending, { edit: !locked, locked: locked, icon: 'mail', msg: m.email,
          why: locked ? t(user.superAdmin ? 'acct.whyEmailSuper' : 'acct.whyEmailAdmin') : '',
          form: '<form data-form="email" class="acct-grid" novalidate><p class="ar-help acct-wide">' + t('acct.emailHow') + '</p>' +
            field(t('acct.emailNew'), '<input name="email" type="email" maxlength="254" autocomplete="email" required value="' + esc(emailDraft) + '">') +
            field(t('acct.current'), '<input name="password" type="password" autocomplete="current-password" required>') +
            '<div class="acct-wide">' + btns(t('acct.emailSend')) + '</div></form>' }) +
        row('tz', t('acct.timezone'), esc(tzLabel) + '<small>' + esc(t('acct.tzHint', { time: nowIn(tz) })) + '</small>', { edit: true, icon: 'clock', msg: m.tz,
          form: '<form data-form="tz">' + field(t('acct.timezone'), '<select name="timezone">' + opts + '</select>', { icon: 'clock', hint: '<span id="acctTzNow">' + esc(t('acct.tzHint', { time: nowIn(tz) })) + '</span>' }) + btns() + '</form>' }) +
        // Rol alleen tonen voor beheerders; gewone gebruikers weten niet wat "User/Admin" is en hebben er niets aan
        (role !== 'user' ? row('role', t('acct.role'), '<span class="acct-chip role-' + role + '">' + SVG + ICON.shield + '</svg>' + t('acct.role_' + role) + '</span>', { locked: true, icon: 'shield',
          why: t(role === 'super' ? 'acct.whyRoleSuper' : 'acct.whyRole') }) : '') +
      '</div></div>';   // Account verwijderen staat niet meer onder je gegevens: zie Privacy > Mijn gegevens / Account verwijderen
  }
  /* ---------- Beveiliging: wachtwoord, apparaten, recente activiteit ---------- */
  function devName(x) { return x.browser || x.os ? t('acct.devOn', { browser: x.browser || t('acct.devBrowser'), os: x.os || t('acct.devUnknown') }) : t('acct.devUnknownFull'); }
  var ACT_ICON = { login: 'check', login_failed: 'warn', password: 'key', email: 'mail', sessions_ended: 'out', session_ended: 'out', '2fa_on': 'shield', '2fa_off': 'warn' };
  /* ---------- Tweestapsverificatie (authenticator-app) ---------- */
  var tfa = null, tfaSetup = null, tfaCodes = null, tfaOff = false, tfaMsg = null;
  function loadTfa() { if (api.isDemo()) { tfa = { demo: true }; return; } api.account.twoFactor().then(function (r) { tfa = r; if (tab === 'security') draw(); }).catch(function () { tfa = { error: true }; }); }
  function tfaCard() {
    var head = '<div class="glass bg-card acct tfa"><div class="sec-head"><div><h2>' + t('tfa.title') + '</h2><p>' + t('tfa.lead') + '</p></div>' +
      (tfa && tfa.enabled ? '<span class="tfa-st on">' + t('tfa.on') + '</span>' : tfa && !tfa.demo && !tfa.error ? '<span class="tfa-st">' + t('tfa.off') + '</span>' : '') + '</div>';
    var msg = tfaMsg ? '<p class="acct-msg ' + tfaMsg[1] + '" role="status">' + esc(tfaMsg[0]) + '</p>' : '';
    if (!tfa) return head + '<p class="sec-empty">…</p></div>';
    if (tfa.demo) return head + '<p class="sec-empty">' + t('acct.secDemo') + '</p></div>';
    if (tfaCodes) return head + '<div class="tfa-codes"><b>' + t('tfa.codesTitle') + '</b><p>' + t('tfa.codesLead') + '</p><ol>' + tfaCodes.map(function (c) { return '<li><code>' + esc(c) + '</code></li>'; }).join('') + '</ol>' +
      '<div class="acct-actions"><button type="button" class="btn ghost" data-tfa="copy">' + t('tfa.copy') + '</button><button type="button" class="btn ghost" data-tfa="dl">' + t('tfa.download') + '</button><button type="button" class="btn primary" data-tfa="done">' + t('tfa.done') + '</button></div></div>' + msg + '</div>';
    if (tfa.enabled) return head + '<p>' + t('tfa.onLead', { n: tfa.recoveryLeft }) + '</p>' +
      (tfaOff ? '<form data-tfa-form="off" class="tfa-form"><label class="auth-f"><span>' + t('tfa.offPw') + '</span><span class="auth-in"><input name="password" type="password" autocomplete="current-password" required></span></label>' +
        '<div class="acct-actions"><button type="button" class="btn ghost" data-tfa="cancel">' + t('myCodes.cancel') + '</button><button type="submit" class="btn danger">' + t('tfa.turnOff') + '</button></div></form>'
        : '<div class="acct-actions"><button type="button" class="btn ghost" data-tfa="off">' + t('tfa.turnOff') + '</button></div>') + msg + '</div>';
    if (tfaSetup) return head + '<div class="tfa-setup"><div class="tfa-qr" aria-hidden="true">' + QRRender.svg(tfaSetup.otpauth, { color: '#0b1220', background: '#ffffff' }) + '</div>' +
      '<ol class="tfa-steps"><li>' + t('tfa.step1') + '</li><li>' + t('tfa.step2') + '<code class="tfa-key">' + esc(tfaSetup.secret.replace(/(.{4})/g, '$1 ').trim()) + '</code></li><li>' + t('tfa.step3') +
      '<form data-tfa-form="on" class="tfa-form"><label class="auth-f"><span class="sr-only">' + t('tfa.code') + '</span><span class="auth-in"><input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" required></span></label>' +
      '<div class="acct-actions"><button type="button" class="btn ghost" data-tfa="cancel">' + t('myCodes.cancel') + '</button><button type="submit" class="btn primary">' + t('tfa.confirm') + '</button></div></form></li></ol></div>' + msg + '</div>';
    return head + '<div class="acct-actions"><button type="button" class="btn primary" data-tfa="start">' + t('tfa.turnOn') + '</button></div>' + msg + '</div>';
  }
  function securityPanel(m, note) {
    var ago = function (iso) { return window.Admin ? Admin.ago(iso) : i18n.fmt.stamp(iso, 'time'); };
    var pwVal = user.passwordChangedAt ? t('acct.pwChanged', { date: i18n.fmt.stamp(user.passwordChangedAt, 'long') }) : t('acct.pwNever');
    var pwCard = '<div class="glass bg-card acct"><h2>' + t('acct.passwordTitle') + '</h2><p>' + t('acct.passwordLead') + '</p><div class="ar-list">' +
      row('password', t('auth.password'), '<span class="ar-dots">••••••••••</span><small>' + esc(pwVal) + '</small>', { edit: true, icon: 'key', msg: m.password,
        form: '<form data-form="password"><div class="acct-grid">' +
          field(t('acct.current'), '<input name="current" type="password" autocomplete="current-password" required>') +
          field(t('auth.newPassword'), '<input name="password" type="password" autocomplete="new-password" minlength="8" required data-pw-rules="acctPwRules" aria-describedby="acctPwRules">') + PasswordRules.list('acctPwRules').replace('<ul class="pw-rules"', '<ul class="pw-rules acct-wide"') + '</div>' +
          btns(t('auth.savePassword')) + '</form>' }) + '</div></div>';
    var demo = api.isDemo();
    var others = (sessions || []).filter(function (x) { return !x.current; }).length;
    var devCard = '<div class="glass bg-card acct"><div class="sec-head"><div><h2>' + t('acct.devicesTitle') + '</h2><p>' + t('acct.devicesLead') + '</p></div>' +
      (others ? '<button type="button" class="btn ghost" data-logout-others>' + SVG + ICON.out + '</svg>' + t('acct.logoutOthers') + '</button>' : '') + '</div>' +
      (demo ? '<p class="sec-empty">' + t('acct.secDemo') + '</p>' : !sessions ? '<p class="sec-empty">…</p>' :
        '<ul class="dev-list">' + sessions.map(function (x) {
          return '<li class="' + (x.current ? 'cur' : '') + '"><span class="dev-ic">' + SVG + ICON[x.mobile ? 'phone' : 'laptop'] + '</svg></span>' +
            '<div class="dev-main"><b>' + esc(devName(x)) + (x.current ? ' <em class="acct-chip ok"><i></i>' + t('acct.thisDevice') + '</em>' : '') + '</b>' +
            '<small>' + (x.current ? t('acct.activeNow') : t('acct.lastActive', { when: ago(x.seenAt || x.createdAt) })) + (x.ip ? ' · IP ' + esc(x.ip) : '') + '</small>' +
            '<small>' + t('acct.signedInOn', { date: i18n.fmt.stamp(x.createdAt, 'time') }) + '</small></div>' +
            (x.current ? '' : '<button type="button" class="btn ghost dev-out" data-end-session="' + esc(x.id) + '">' + t('acct.signOut') + '</button>') + '</li>';
        }).join('') + '</ul>') + note('devices') + '</div>';
    var actCard = '<div class="glass bg-card acct"><h2>' + t('acct.activityTitle') + '</h2><p>' + t('acct.activityLead') + '</p>' +
      (demo ? '<p class="sec-empty">' + t('acct.secDemo') + '</p>' : !activity ? '<p class="sec-empty">…</p>' : !activity.length ? '<p class="sec-empty">' + t('acct.activityEmpty') + '</p>' :
        '<ol class="act-list">' + activity.map(function (a) {
          return '<li class="act-' + a.kind + '"><span class="act-ic">' + SVG + ICON[ACT_ICON[a.kind] || 'check'] + '</svg></span><div><b>' + t('acct.act_' + a.kind) + '</b>' +
            '<small>' + [devName(a), a.ip ? 'IP ' + esc(a.ip) : '', esc(i18n.fmt.stamp(a.at, 'time'))].filter(Boolean).join(' · ') + '</small></div></li>';
        }).join('') + '</ol>' +
        '<div class="act-tip">' + SVG + ICON.shield + '</svg><span>' + t('acct.activityTip') + '</span><button type="button" class="btn ghost" data-edit="password">' + t('acct.pwChangeNow') + '</button></div>') + '</div>';
    return pwCard + tfaCard() + devCard + actCard;
  }
  function loadSecurity() {
    if (!user) return;
    api.account.sessions().then(function (r) { sessions = (r.sessions || []).sort(function (x, y) { return (y.current ? 1 : 0) - (x.current ? 1 : 0); }); if (tab === 'security') draw(); }).catch(function () { sessions = []; });
    api.account.activity().then(function (r) { activity = r.activity || []; if (tab === 'security') draw(); }).catch(function () { activity = []; });
  }
  /* ---------- Account verwijderen: stap 1 en 2 op de pagina, stap 3 in een venster ---------- */
  function deletePanel() {
    var dots = '<ol class="del-steps" aria-label="' + esc(t('acct.delStepOf', { n: delStep, total: 3 })) + '">' + [1, 2, 3].map(function (i) {
      return '<li class="' + (i < delStep ? 'done' : i === delStep ? 'on' : '') + '"><span>' + (i < delStep ? SVG + ICON.check + '</svg>' : i) + '</span><em>' + t('acct.delStep' + i) + '</em></li>'; }).join('') + '</ol>';
    if (delStep === 1) {
      var n = function (v) { return v == null ? '–' : i18n.fmt.num(v); };
      var lose = [['acct.delLoseCodes', n(sum && sum.codes)], ['acct.delLoseScans', n(sum && sum.scans)], ['acct.delLoseFiles'], ['acct.delLoseBilling'], ['acct.delLosePrinted']];
      return '<div class="glass bg-card acct acct-danger del-card">' + dots +
        '<div class="del-hero"><span class="del-ic">' + SVG + ICON.warn + '</svg></span><div><h2>' + t('acct.del1Title') + '</h2><p>' + t('acct.del1Lead') + '</p></div></div>' +
        '<ul class="del-lose">' + lose.map(function (x) { return '<li>' + SVG + ICON.x + '</svg><span>' + (x[1] != null ? '<b>' + x[1] + '</b> ' : '') + t(x[0]) + '</span></li>'; }).join('') + '</ul>' +
        '<div class="del-tip">' + SVG + ICON.download + '</svg><div><b>' + t('acct.delTipTitle') + '</b><small>' + t('acct.delTipText') + '</small></div><button type="button" class="btn ghost" data-export>' + t('acct.download') + '</button></div>' +
        '<div class="acct-actions del-actions"><button type="button" class="btn ghost" data-tab-go="profile">' + t('acct.delKeep') + '</button>' +
        '<button type="button" class="btn danger" data-del-next>' + t('acct.del1Go') + '</button></div></div>';
    }
    var checks = ['acct.delCheck1', 'acct.delCheck2', 'acct.delCheck3'].map(function (k, i) {
      return '<label class="del-check"><input type="checkbox" name="c' + i + '"><span class="del-box">' + SVG + ICON.check + '</svg></span><span>' + t(k) + '</span></label>'; }).join('');
    return '<div class="glass bg-card acct acct-danger del-card">' + dots +
      '<div class="del-hero"><span class="del-ic">' + SVG + ICON.warn + '</svg></span><div><h2>' + t('acct.del2Title') + '</h2><p>' + t('acct.del2Lead') + '</p></div></div>' +
      '<form data-form="delete" novalidate><div class="del-checks">' + checks + '</div>' +
      field(t('acct.delPassword'), '<input name="password" type="password" autocomplete="current-password" required>', { icon: 'security', cls: 'del-pw' }) +
      (delErr ? '<p class="acct-msg bad" role="alert">' + esc(delErr) + '</p>' : '') +
      '<div class="acct-actions del-actions"><button type="button" class="btn ghost" data-del-back>' + t('acct.delBack') + '</button>' +
      '<button type="submit" class="btn danger" data-del-go disabled>' + SVG + ICON.trash + '</svg>' + t('acct.delete') + '</button></div></form></div>';
  }
  /* ---------- Meldingen: e-mailvoorkeuren ---------- */
  function prefs() { return Object.assign({ report: 'off', security: true, product: false, firstScan: true, milestones: true, brokenLinks: true, quietCodes: true }, user.emailPrefs || {}); }
  function nextSend(kind) {
    var d = new Date(); d.setHours(8, 0, 0, 0);
    if (kind === 'weekly') { var add = (8 - d.getDay()) % 7 || 7; if (new Date().getDay() === 1 && new Date().getHours() < 8) add = 0; d.setDate(d.getDate() + add); }
    else { if (!(new Date().getDate() === 1 && new Date().getHours() < 8)) { d.setMonth(d.getMonth() + 1); } d.setDate(1); }
    return i18n.fmt.stamp(d.toISOString(), 'long');
  }
  function toggle(key, title, text, on) {
    return '<label class="nf-row"><span class="nf-txt"><b>' + title + '</b><small>' + text + '</small></span>' +
      '<span class="nf-sw"><input type="checkbox" data-pref="' + key + '"' + (on ? ' checked' : '') + '><i></i></span></label>';
  }
  function notifyPanel(m) {
    var p = prefs(), mailOn = !!(api.info && api.info().mail);
    return '<div class="glass bg-card acct"><h2>' + t('notify.title') + '</h2><p>' + t('notify.lead') + '</p>' +
      (api.isDemo() ? '<p class="acct-demo">' + t('notify.demo') + '</p>' : !mailOn ? '<p class="nf-warn">' + t('notify.noMail') + '</p>' : '') +
      '<div class="nf-list"><div class="nf-row nf-report"><span class="nf-txt"><b>' + t('notify.report') + '</b><small>' + t('notify.reportText') + '</small>' +
        (p.report !== 'off' ? '<small class="nf-next">' + t('notify.next', { date: nextSend(p.report) }) + '</small>' : '') + '</span>' +
        '<div class="nf-seg" role="radiogroup" aria-label="' + esc(t('notify.report')) + '">' + ['off', 'weekly', 'monthly'].map(function (k) {
          return '<button type="button" role="radio" aria-checked="' + (p.report === k) + '" data-report="' + k + '">' + t('notify.r_' + k) + '</button>'; }).join('') + '</div>' +
        '<button type="button" class="btn ghost sm nf-prev" data-report-preview>' + SVG + ICON.eye + '</svg>' + t('notify.preview') + '</button></div>' +
      toggle('firstScan', t('notify.firstScan'), t('notify.firstScanText'), p.firstScan !== false) +
      toggle('milestones', t('notify.milestones'), t('notify.milestonesText'), p.milestones !== false) +
      toggle('brokenLinks', t('notify.brokenLinks'), t('notify.brokenLinksText'), p.brokenLinks !== false) +
      toggle('quietCodes', t('notify.quietCodes'), t('notify.quietCodesText'), p.quietCodes !== false) +
      toggle('security', t('notify.security'), t('notify.securityText'), p.security) +
      toggle('product', t('notify.product'), t('notify.productText'), p.product) + '</div>' +
      (m.notify ? '<p class="acct-msg ' + m.notify[1] + '" role="status">' + esc(m.notify[0]) + '</p>' : '') + '</div>';
  }
  function savePrefs(patch) {
    var next = Object.assign(prefs(), patch); user = Object.assign({}, user, { emailPrefs: next }); draw();
    api.account.update({ emailPrefs: patch }).then(function () { draw({ notify: [t('acct.saved'), 'ok'] }); })
      .catch(function (x) { draw({ notify: [err(x), 'bad'] }); });
  }
  function previewReport() {
    var period = prefs().report === 'weekly' ? 'weekly' : 'monthly', d = document.getElementById('mcDialog');
    var show = function (r) {
      d.innerHTML = '<form method="dialog" class="mc-dlg nf-dlg"><h3>' + t('notify.previewTitle') + '</h3><p class="nf-subj"><b>' + esc(t('notify.subject')) + ':</b> ' + esc(r.subject) + '</p>' +
        '<iframe class="nf-frame" sandbox="" title="' + esc(t('notify.previewTitle')) + '"></iframe><div class="mc-dlg-btns"><button class="btn primary" value="ok" autofocus>' + t('legal.close') + '</button></div></form>';
      d.querySelector('iframe').srcdoc = '<!doctype html><meta charset="utf-8"><body style="margin:16px;background:#fff">' + r.html;
      d.showModal();
    };
    if (api.isDemo()) return draw({ notify: [t('notify.demo'), 'bad'] });
    fetch('api/account/report-preview?period=' + period + '&lang=' + i18n.lang()).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(show)
      .catch(function () { draw({ notify: [t('myCodes.failed'), 'bad'] }); });
  }
  function panel(m) {
    var note = function (k) { return m[k] ? '<p class="acct-msg ' + m[k][1] + '" role="status">' + esc(m[k][0]) + '</p>' : ''; };
    if (tab === 'profile') return profilePanel(m, note);
    if (tab === 'security') return securityPanel(m, note);
    if (tab === 'prefs') return prefsPanel(note);
    if (tab === 'notify') return notifyPanel(m);
    if (tab === 'keys') return keysPanel(m);
    if (tab === 'legal') return legalPanel();
    if (tab === 'delete') return deletePanel();
    if (tab === 'billing') return billingPanel(m);
    if (tab === 'plan') return planPanel();
    if (tab === 'api') return apiPanel();
    if (tab === 'domain') return domPanel();
    if (tab === 'team') return window.Team ? Team.html() : '';
    if (tab === 'data') return '<div class="glass bg-card acct"><h2>' + t('acct.dataTitle') + '</h2><p>' + t('acct.dataLead') + '</p>' +
      '<div class="acct-btns"><button type="button" class="btn ghost" data-export>' + SVG + ICON.download + '</svg>' + t('acct.download') + '</button></div>' + note('export') + '</div>' + dangerCard(m);
    return '';
  }
  /* Sneltoetsen (shortcuts.js): overzicht en aan/uit (WCAG 2.1.4: losse lettertoetsen moeten uit kunnen) */
  function keysPanel(m) {
    var on = window.Shortcuts ? Shortcuts.on() : true;
    return '<div class="glass bg-card acct"><h2>' + t('keys.title') + '</h2><p>' + t('keys.lead') + '</p>' +
      '<div class="nf-list"><label class="nf-row"><span class="nf-txt"><b>' + t('keys.on') + '</b><small>' + t('keys.onText') + '</small></span><span class="nf-sw"><input type="checkbox" data-keys-on' + (on ? ' checked' : '') + '><i></i></span></label></div>' +
      '<dl class="keys-list' + (on ? '' : ' off') + '">' + (window.Shortcuts ? Shortcuts.list() : []).map(function (k) { return '<div><dt><kbd>' + esc(k[0]) + '</kbd></dt><dd>' + esc(t(k[1])) + '</dd></div>'; }).join('') + '</dl>' +
      (m.keys ? '<p class="acct-msg ' + m.keys[1] + '" role="status">' + esc(m.keys[0]) + '</p>' : '') + '</div>';
  }
  /* Privacyverklaring, voorwaarden en cookies: lezen in een venster */
  function legalPanel() {
    return '<div class="glass bg-card acct"><h2>' + t('nav.legal') + '</h2><p>' + t('st.legalLead') + '</p><div class="nf-list">' + ['privacy', 'terms', 'cookies'].map(function (k) {
      return '<div class="nf-row"><span class="nf-txt"><b>' + esc(t('legal.' + k + '.title')) + '</b></span><a class="btn ghost sm" href="' + esc(Legal.url(k)) + '" target="_blank" rel="noopener">' + esc(t('st.read')) + '<span class="sr-only"> (' + esc(t('legal.' + k + '.title')) + ')</span></a></div>'; }).join('') + '</div></div>';
  }
  // Voorkeuren: rijen (uitleg links, keuze rechts), zelfde stijl als Beheer > Instellingen
  var uprefs = null;
  function prefsPanel(note) {
    if (!uprefs) { api.account.prefs().then(function (r) { uprefs = r; if (tab === 'prefs') draw(); }).catch(function () { uprefs = { start: 'home' }; if (tab === 'prefs') draw(); }); }
    var row = function (label, help, control) { return '<div class="set-row"><div class="set-row-l"><b>' + label + '</b>' + (help ? '<small>' + help + '</small>' : '') + '</div><div class="set-row-c">' + control + '</div></div>'; };
    var cur = theme.get(), start = (uprefs && uprefs.start) || 'home';
    return '<div class="glass ast-card set-sec acct-prefs"><header class="set-sec-h"><h3>' + t('acct.prefsTitle') + '</h3><p>' + t('acct.prefsLead2') + '</p></header>' +
      row(t('acct.language'), t('acct.prefsLead'), '<span class="auth-in acct-sel"><select id="acctLang">' + LANGUAGES.map(function (l) { return '<option value="' + l.code + '"' + (l.code === i18n.lang() ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></span>') +
      // Licht/donker staat alleen bij Achtergrond (wens Fabian 21 okt); hier niet nog een keer
      row(t('acct.prefStart'), t('acct.prefStartHelp'), '<span class="auth-in acct-sel"><select id="acctStart"' + (uprefs ? '' : ' disabled') + '>' + [['home', 'nav.overview'], ['create', 'nav.create'], ['myCodes', 'nav.myCodes'], ['analytics', 'nav.analytics']].map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === start ? ' selected' : '') + '>' + esc(t(o[1])) + '</option>'; }).join('') + '</select></span>' + note('prefs')) +
      '</div>';
  }
  function draw(msg) {
    if (!msg && sticky) msg = sticky();                                  // melding blijft staan als de cijfers later binnenkomen
    if (!user) { box.innerHTML = ''; menu.innerHTML = ''; stats.innerHTML = ''; return; }
    if (tabIds().indexOf(tab) < 0) tab = tabIds()[0];
    var sec = box.closest('.account'); if (sec) sec.classList.toggle('is-settings', scope === 'settings');
    document.getElementById('acctTitle').textContent = t(scope === 'settings' ? 'nav.settings' : 'nav.account');
    document.getElementById('acctLead').textContent = t(scope === 'settings' ? 'st.lead' : 'acct.lead');
    head(msg); drawMenu();
    var isBg = tab === 'background';
    bgSection.hidden = !isBg; box.hidden = isBg;
    (isBg ? bgSection : box).setAttribute('aria-labelledby', 'acctTab-' + tab);
    box.innerHTML = isBg ? '' : panel(msg || {});
  }
  function setScope(sc) { scope = sc; GROUPS = SCOPES[sc]; ALL_TABS = ids(sc); }
  function open(id, focus) {
    if (!shown(id)) id = 'profile';
    var sc = scopeOf(id);
    if (sc !== scope || !document.body.classList.contains('page-' + sc)) { setScope(sc); tab = id; window.goToPage(sc); }   // onderdeel hoort op de andere pagina: daarheen
    if (id === 'team' && window.Team) Team.ensure();
    tab = id; sticky = null; bad = []; delStep = 1; delErr = ''; editing = null; if (id === 'security') { loadSecurity(); tfaSetup = null; tfaCodes = null; tfaOff = false; tfaMsg = null; loadTfa(); } if (id === 'plan') { planInfo = null; invInfo = null; pmInfo = null; loadPlan(); loadInv(); } if (id === 'api') { apiInfo = null; apiNew = null; loadApi(); } if (id === 'domain') { domInfo = null; domMsg = null; loadDom(); }
    if (id === 'billing' && billingLoaded) draft = startDraft();
    draw();
    document.dispatchEvent(new CustomEvent('accounttab', { detail: id }));   // adresbalk bijwerken (#/account/…)
    if (focus) { var b = document.getElementById('acctTab-' + id); if (b) b.focus(); }
  }
  window.openAccountTab = function (id) { open(id); };
  document.addEventListener('pagechange', function (e) {
    document.body.classList.toggle('page-account', e.detail === 'account'); document.body.classList.toggle('page-settings', e.detail === 'settings');
    if (e.detail === 'settings') { var me = document.querySelector('.item[data-page="account"]'); if (me) me.classList.add('active'); }   // Instellingen hoort bij Mijn account
    if (e.detail !== 'account' && e.detail !== 'settings') return;
    if (e.detail !== scope) { setScope(e.detail); if (ids(scope).indexOf(tab) < 0) tab = ids(scope)[0]; if (user) draw(); }
    document.dispatchEvent(new CustomEvent('accounttab', { detail: tab }));   // adres: welk tabblad open staat
  });
  document.addEventListener('plan-changed', function () { planInfo = null; invInfo = null; if (tab === 'plan' && user) { loadPlan(); loadInv(); } });
  document.addEventListener('team-loaded', function () { if (user && menu.innerHTML) drawMenu(); });

  function err(e) { return e && e.code === 'wrong' ? t('acct.wrongCurrent') : e && PasswordRules.errorKey(e.code) ? t(PasswordRules.errorKey(e.code)) : e && e.code === 'too_many' ? t('auth.errTooMany') : t('auth.errGeneral'); }
  function readBilling(f) { BILLING_KEYS.forEach(function (k) { if (f.elements[k]) draft[k] = f.elements[k].value; }); }

  menu.addEventListener('click', function (e) { var gs = e.target.closest('[data-go-scope]'); if (gs) return window.goToPage(gs.getAttribute('data-go-scope')); var lg = e.target.closest('[data-legal]'); if (lg && window.Legal) return Legal.open(lg.getAttribute('data-legal')); var b = e.target.closest('[data-tab]'); if (b) open(b.getAttribute('data-tab')); });
  menu.addEventListener('keydown', function (e) {   // pijltjes: naar het vorige/volgende onderdeel
    var TAB_IDS = tabIds(), i = TAB_IDS.indexOf(tab), n = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = TAB_IDS[(i + 1) % TAB_IDS.length];
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = TAB_IDS[(i - 1 + TAB_IDS.length) % TAB_IDS.length];
    if (e.key === 'Home') n = TAB_IDS[0];
    if (e.key === 'End') n = TAB_IDS[TAB_IDS.length - 1];
    if (n && e.target.closest('[data-tab]')) { e.preventDefault(); open(n, true); }
  });
  stats.addEventListener('click', function (e) { var go = e.target.closest('[data-goto]'); if (go) { e.preventDefault(); window.goToPage(go.getAttribute('data-goto')); } });

  box.addEventListener('submit', function (e) {
    var af = e.target.closest('[data-form="apikey"]');
    if (af) { e.preventDefault(); apiErr = ''; api.account.apiKeyNew({ name: af.name.value }).then(function (r) { apiNew = r.key; loadApi(); }, function (x) { apiErr = t(x && x.code === 'max_keys' ? 'api.max' : 'myCodes.failed'); draw(); }); return; }
    var tf = e.target.closest('[data-tfa-form]');
    if (tf) {
      e.preventDefault(); var inp = tf.querySelector('input'), go = tf.querySelector('[type=submit]'); go.disabled = true; tfaMsg = null;
      if (tf.getAttribute('data-tfa-form') === 'on') {
        return api.account.twoFactorEnable({ code: inp.value.replace(/\s+/g, '') }).then(function (r) { tfaSetup = null; tfaCodes = r.recoveryCodes; tfa = { enabled: true, recoveryLeft: r.recoveryCodes.length }; draw(); loadSecurity(); })
          .catch(function (x) { go.disabled = false; tfaMsg = [t(x && x.code === 'code_wrong' ? 'tfa.errWrong' : x && x.code === 'too_many' ? 'auth.errTooMany' : 'tfa.errGeneral'), 'bad']; draw(); var i = box.querySelector('[data-tfa-form="on"] input'); if (i) i.focus(); });
      }
      return api.account.twoFactorDisable({ password: inp.value }).then(function () { tfaOff = false; tfa = { enabled: false }; tfaMsg = [t('tfa.offDone'), 'ok']; draw(); loadSecurity(); })
        .catch(function (x) { go.disabled = false; tfaMsg = [t(x && x.code === 'wrong' ? 'tfa.errPassword' : 'tfa.errGeneral'), 'bad']; draw(); });
    }
    e.preventDefault(); sticky = null;
    var f = e.target, kind = f.getAttribute('data-form'), btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    var saved = function (key, u, extra) { user = Object.assign({}, user, u, extra || {}); editing = null; var o = {}; o[key] = [t('acct.saved'), 'ok']; draw(o); document.dispatchEvent(new CustomEvent('account:changed')); };
    var failed = function (key) { return function (x) { var o = {}; o[key] = [err(x), 'bad']; btn.disabled = false; draw(o); }; };
    if (kind === 'name') {
      var name = f.nick.value.replace(/\s+/g, ' ').trim();
      if (!name) { btn.disabled = false; f.nick.focus(); return; }
      api.account.update({ name: name }).then(function (u) { saved('name', u); }).catch(failed('name'));
    }
    if (kind === 'tz') {
      var tz = f.timezone.value;
      api.account.update({ timezone: tz }).then(function (u) { i18n.setZone(tz || null); saved('tz', u, { timezone: tz || null }); }).catch(failed('tz'));
    }
    if (kind === 'email') {
      var em = f.email.value.trim(); emailDraft = em;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { btn.disabled = false; f.email.setAttribute('aria-invalid', 'true'); f.email.focus(); return; }
      if (!f.password.value) { btn.disabled = false; f.password.focus(); return; }
      api.account.changeEmail({ email: em, password: f.password.value, lang: i18n.lang() }).then(function (r) {
        emailPending = { email: r.email, link: r.link || null, mail: r.mail }; editing = null; emailDraft = ''; draw();
      }).catch(function (x) {
        var k = x && x.code === 'wrong' ? 'acct.wrongCurrent' : x && x.code === 'exists' ? 'acct.emailErrExists' : x && x.code === 'blocked' ? 'auth.errBlocked' : x && x.code === 'same' ? 'acct.emailErrSame' : x && x.code === 'email' ? 'acct.emailErrInvalid' : x && x.code === 'locked' ? 'acct.whyEmailAdmin' : x && x.code === 'demo' ? 'acct.secDemo' : null;
        btn.disabled = false; draw({ email: [k ? t(k) : err(x), 'bad'] });
        var fi = box.querySelector(x && x.code === 'wrong' ? 'form[data-form=email] input[name=password]' : 'form[data-form=email] input[name=email]'); if (fi) fi.focus();
      });
    }
    if (kind === 'delete') { btn.disabled = false; return lastWarning(f); }
    if (kind === 'password') {
      var prob = PasswordRules.problem(f.password.value);
      if (prob) { btn.disabled = false; return draw({ password: [t(PasswordRules.errorKey('password_' + prob)), 'bad'] }); }
      api.account.password({ current: f.current.value, password: f.password.value }).then(function (r) {
        if (sum) sum.sessions = 1; user = Object.assign({}, user, { passwordChangedAt: (r && r.passwordChangedAt) || new Date().toISOString() }); editing = null;
        draw({ password: [t('acct.passwordSaved'), 'ok'] }); loadSecurity();
      })
        .catch(function (x) { draw({ password: [err(x), 'bad'] }); });
    }
    if (kind === 'billing') {
      readBilling(f);
      api.account.saveBilling(draft).then(function (r) { billing = r.billing; draft = startDraft(); bad = []; draw({ billing: [t('acct.billingSaved'), 'ok'] }); })
        .catch(function (x) {
          bad = (x && x.details) || []; draw({ billing: [bad.length ? t('acct.errBilling') : err(x), 'bad'] });
          var first = box.querySelector('[aria-invalid="true"]'); if (first) first.focus();
        });
    }
  });
  box.addEventListener('input', function (e) {
    var df = e.target.form;
    if (df && df.getAttribute('data-form') === 'delete') {             // knop pas aan als alles is aangevinkt en het wachtwoord er staat
      var all = [].every.call(df.querySelectorAll('input[type=checkbox]'), function (c) { return c.checked; });
      df.querySelector('[data-del-go]').disabled = !(all && df.password.value);
      return;
    }
    var f = e.target.form; if (!f || f.getAttribute('data-form') !== 'billing' || !e.target.name) return;
    draft[e.target.name] = e.target.value;
    if (e.target.getAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); var m = document.getElementById('err-' + e.target.name); if (m) m.remove(); bad = bad.filter(function (k) { return k !== e.target.name; }); }
  });
  box.addEventListener('change', function (e) {
    if (e.target.matches('[data-keys-on]')) { var kv = e.target.checked; if (window.Shortcuts) Shortcuts.set(kv);
      api.account.savePrefs({ keys: kv }).then(function () { draw({ keys: [t('acct.saved'), 'ok'] }); }).catch(function () { draw({ keys: [t('myCodes.failed'), 'bad'] }); }); return; }
    if (e.target.matches('[data-pref]')) { var o = {}; o[e.target.getAttribute('data-pref')] = e.target.checked; savePrefs(o); return; }
    if (e.target.id === 'acctLang') i18n.set(e.target.value);
    if (e.target.id === 'acctStart') { var v = e.target.value; api.account.savePrefs({ start: v }).then(function (r) { uprefs = r; draw({ prefs: [t('acct.saved'), 'ok'] }); }).catch(function () { draw({ prefs: [t('myCodes.failed'), 'bad'] }); }); }
    if (e.target.name === 'timezone') { var h = document.getElementById('acctTzNow'); if (h) h.textContent = t('acct.tzHint', { time: nowIn(e.target.value) }); }
    if (e.target.name === 'country' && draft) draft.country = e.target.value;
  });
  box.addEventListener('click', function (e) {
    var tb = e.target.closest('[data-tfa]');
    if (tb) {
      var k = tb.getAttribute('data-tfa'); tfaMsg = null;
      if (k === 'start') { tb.disabled = true; return api.account.twoFactorSetup().then(function (r) { tfaSetup = r; draw(); var i = box.querySelector('[data-tfa-form="on"] input'); if (i) i.focus(); }).catch(function () { tfaMsg = [t('tfa.errGeneral'), 'bad']; draw(); }); }
      if (k === 'cancel') { tfaSetup = null; tfaOff = false; return draw(); }
      if (k === 'off') { tfaOff = true; draw(); var pi = box.querySelector('[data-tfa-form="off"] input'); if (pi) pi.focus(); return; }
      if (k === 'copy') { var txt = tfaCodes.join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { tfaMsg = [t('tfa.copied'), 'ok']; draw(); }).catch(function () {}); return; }
      if (k === 'dl') return saveFile(new Blob(['QR-Codex — ' + t('tfa.codesTitle') + '\n' + user.email + '\n\n' + tfaCodes.join('\n') + '\n'], { type: 'text/plain' }), 'qr-codex-herstelcodes.txt');
      if (k === 'done') { tfaCodes = null; return draw(); }
    }
    var seg = e.target.closest('[data-btype]');
    if (seg) { readBilling(seg.closest('form')); draft.type = seg.getAttribute('data-btype'); bad = []; draw(); var s = box.querySelector('[data-btype="' + draft.type + '"]'); if (s) s.focus(); return; }
    if (e.target.closest('[data-billing-reset]')) { draft = startDraft(); bad = []; return draw(); }
    var go = e.target.closest('[data-tab-go]'); if (go) return open(go.getAttribute('data-tab-go'));
    var ad = e.target.closest('[data-api-del]');
    if (ad) { if (!confirmApiDel()) return; api.account.apiKeyDel(ad.getAttribute('data-api-del')).then(function () { apiNew = null; loadApi(); }, function () { apiErr = t('myCodes.failed'); draw(); }); return; }
    if (e.target.closest('[data-api-copy]')) { var kt = document.getElementById('apiNewKey'); if (kt && navigator.clipboard) navigator.clipboard.writeText(kt.textContent).then(function () { e.target.closest('[data-api-copy]').textContent = t('api.copied'); }); return; }
    if (e.target.closest('[data-open-plans]') && window.Plans) { Plans.open(); return; }
    if (e.target.closest('[data-pm-change]') && window.Plans) { planMsg = null; Plans.method(); return; }
    if (e.target.closest('[data-sub-cancel]')) { planMsg = null; askCancel(); return; }
    if (e.target.closest('[data-sub-resume]')) { planMsg = null; resumeSub(); return; }
    if (e.target.closest('[data-next-cancel]')) {                        // toch het huidige pakket houden
      var cur = planInfo && planInfo.plan; subBusy = true; planMsg = null; draw();
      api.account.downgradeCancel().then(function () { subBusy = false; planMsg = ['bill.nextCancelled', 'ok', { plan: t('plan.n_' + (cur ? cur.id : '')) }]; planInfo = null; loadPlan(); })
        .catch(function () { subBusy = false; planMsg = ['pw.payError', 'bad']; draw(); });
      return;
    }
    var pb = e.target.closest('[data-portal]');
    if (pb) { pb.disabled = true; api.account.stripePortal().then(function (r) { location.href = r.url; }, function () { pb.disabled = false; pb.insertAdjacentHTML('afterend', '<p class="acct-msg bad" role="alert">' + esc(t('pw.payError')) + '</p>'); }); return; }
    var ask = e.target.closest('[data-plan-ask]');
    if (ask) { goToPage('contact'); document.dispatchEvent(new CustomEvent('contact-preset', { detail: { topic: 'billing', message: t('plan.askMsg', { plan: t('plan.n_' + ask.getAttribute('data-plan-ask')) }) } })); return; }
    var ed = e.target.closest('[data-edit]');
    if (ed) {
      editing = ed.getAttribute('data-edit'); sticky = null; draw();
      var rw = box.querySelector('[data-row="' + editing + '"]');
      if (rw) { rw.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); var fi = rw.querySelector('.ar-form input, .ar-form select'); if (fi) fi.focus({ preventScroll: true }); }
      return;
    }
    if (e.target.closest('[data-edit-cancel]')) { var was = editing; editing = null; draw(); var b2 = box.querySelector('[data-edit="' + was + '"]'); if (b2) b2.focus(); return; }
    var gt = e.target.closest('[data-goto]'); if (gt) { e.preventDefault(); return window.goToPage(gt.getAttribute('data-goto')); }
    var rp = e.target.closest('[data-report]'); if (rp) return savePrefs({ report: rp.getAttribute('data-report') });
    if (e.target.closest('[data-report-preview]')) return previewReport();
    var tp = e.target.closest('[data-theme-pick]'); if (tp) { theme.set(tp.getAttribute('data-theme-pick')); user = Object.assign({}, user, { theme: theme.get() }); return draw(); }
    var es = e.target.closest('[data-end-session]');
    if (es) {
      es.disabled = true;
      return api.account.endSession(es.getAttribute('data-end-session')).then(function () { draw({ devices: [t('acct.signedOutOne'), 'ok'] }); loadSecurity(); loadSummary(); })
        .catch(function (x) { draw({ devices: [err(x), 'bad'] }); loadSecurity(); });
    }
    if (e.target.closest('[data-export]')) {
      return api.account.exportData().then(function (d) { saveFile(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }), 'qr-codex-mijn-gegevens.json'); })
        .catch(function (x) { draw({ export: [err(x), 'bad'] }); });
    }
    if (e.target.closest('[data-logout-others]')) {
      api.account.logoutOthers().then(function () { if (sum) sum.sessions = 1; draw({ devices: [t('acct.loggedOutOthers'), 'ok'] }); loadSecurity(); }).catch(function (x) { draw({ devices: [err(x), 'bad'] }); });
    }
  });
  // Bedrijf / particulier: pijltjes wisselen (zoals bij een keuzerondje)
  box.addEventListener('keydown', function (e) {
    var seg = e.target.closest('[data-btype]'); if (!seg || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) < 0) return;
    e.preventDefault(); readBilling(seg.closest('form')); draft.type = draft.type === 'private' ? 'company' : 'private'; draw();
    var s = box.querySelector('[data-btype="' + draft.type + '"]'); if (s) s.focus();
  });
  // Account verwijderen: stap 1 -> 2 op de pagina, stap 3 = laatste waarschuwing in een venster
  box.addEventListener('click', function (e) {
    if (e.target.closest('[data-del-next]')) { delStep = 2; delErr = ''; draw(); focusDel(); }
    if (e.target.closest('[data-del-back]')) { delStep = 1; delErr = ''; draw(); focusDel(); }
  });
  function focusDel() { var h = box.querySelector('.del-hero h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } box.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  function lastWarning(f) {
    var pw = f.password.value, d = document.getElementById('mcDialog'), sent = false;
    delStep = 3; draw();                                                // bolletje 3 aan
    d.innerHTML = '<form method="dialog" class="mc-dlg del-final"><span class="mc-dlg-ic">' + SVG + ICON.warn + '</svg></span>' +
      '<p class="del-final-tag">' + t('acct.del3Tag') + '</p><h3>' + t('acct.del3Title') + '</h3><p>' + t('acct.del3Text', { email: '<b>' + esc(user.email) + '</b>' }) + '</p>' +
      '<div class="mc-dlg-btns"><button class="btn primary" value="cancel" autofocus>' + t('acct.del3No') + '</button><button class="btn danger" value="ok" id="delGo">' + SVG + ICON.trash + '</svg>' + t('acct.del3Yes') + '</button></div></form>';
    var back = function (msg) { delStep = 2; delErr = msg || ''; draw(); };
    d.querySelector('#delGo').addEventListener('click', function (ev) {
      ev.preventDefault(); if (sent) return; sent = true; ev.currentTarget.disabled = true;
      api.account.remove({ password: pw }).then(function () { location.replace(location.pathname); })
        .catch(function (x) {
          sent = false; d.close();
          back(x && x.code === 'wrong' ? t('acct.wrongCurrent') : x && x.code === 'super' ? t('acct.delSuperText') : err(x));
          var p = box.querySelector('input[name=password]'); if (p) p.focus();
        });
    });
    d.addEventListener('close', function () { if (delStep === 3 && !sent) back(); }, { once: true });
    d.showModal();
  }

  /* ---------- Profielfoto: kiezen, slepen, verwijderen ---------- */
  var picker = document.getElementById('acctPhoto');
  function savePhoto(v) {
    return api.account.update({ avatar: v }).then(function (u) { user = Object.assign({}, user, u, { avatar: v }); draw({ photo: [t(v ? 'acct.photoSaved' : 'acct.photoRemoved'), 'ok'] }); })
      .catch(function (x) { draw({ photo: [err(x), 'bad'] }); });
  }
  function usePhoto(file) {
    if (!file) return;
    shrink(file).then(savePhoto, function (x) { draw({ photo: [t(x.message === 'big' ? 'acct.photoBig' : 'acct.photoType'), 'bad'] }); });
  }
  document.getElementById('accountView').addEventListener('click', function (e) {
    if (e.target.closest('[data-photo-pick]')) { picker.value = ''; picker.click(); }
    if (e.target.closest('[data-photo-remove]')) savePhoto(null);
  });
  picker.addEventListener('change', function () { usePhoto(picker.files[0]); });
  // Foto op het visitekaartje slepen
  var idc = document.querySelector('.acct-idc');
  idc.addEventListener('dragover', function (e) { e.preventDefault(); idc.classList.add('over'); });
  idc.addEventListener('dragleave', function (e) { if (!idc.contains(e.relatedTarget)) idc.classList.remove('over'); });
  idc.addEventListener('drop', function (e) { e.preventDefault(); idc.classList.remove('over'); usePhoto(e.dataTransfer.files[0]); });

  theme.onChange(function () { if (user && tab === 'prefs' && !box.hidden) draw(); });
  if (window.Session) Session.onUser(function () { uprefs = null; });
  /* Verplicht om de app te gebruiken: een naam (vrij: voornaam, bijnaam, één woord – wat je wilt). Ontbreekt die, dan eerst invullen.
     Tijdzone: niet gekozen = die van dit apparaat, en die slaan we meteen op (dan klopt hij ook in mails en overzichten). */
  function requireName(u) {
    if (api.isDemo() || !u) return;
    if (!u.timezone) { var here = Intl.DateTimeFormat().resolvedOptions().timeZone; if (here) api.account.update({ timezone: here }).then(function (r) { user = Object.assign({}, user, r, { timezone: here }); if (window.i18n && i18n.setZone) i18n.setZone(here); }).catch(function () {}); }
    if (String(u.name || '').trim()) return;                                   // elke naam is goed (ook één woord of een bijnaam)
    var d = document.getElementById('mcDialog');
    d.innerHTML = '<form class="mc-dlg" novalidate><h3>' + t('acct.needNameTitle') + '</h3><p>' + t('acct.needNameText') + '</p>' +
      field(t('auth.name'), '<input name="nick" value="" maxlength="60" autocomplete="nickname" required>') +
      '<p class="acct-msg bad" data-msg hidden></p><div class="mc-dlg-btns"><button class="btn primary" type="submit">' + t('acct.save') + '</button></div></form>';
    var f = d.querySelector('form'), msg = f.querySelector('[data-msg]');
    var block = function (ev) { ev.preventDefault(); }; d.addEventListener('cancel', block);   // Escape sluit hem niet
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var name = f.nick.value.replace(/\s+/g, ' ').trim();
      if (!name) { msg.textContent = t('acct.needNameEmpty'); msg.hidden = false; f.nick.focus(); return; }
      api.account.update({ name: name }).then(function (r) {
        user = Object.assign({}, user, r, { name: name }); d.removeEventListener('cancel', block); d.close(); d.innerHTML = ''; draw(); navAvatar();
      }).catch(function () { msg.textContent = t('auth.errGeneral'); msg.hidden = false; });
    };
    if (!d.open) d.showModal(); f.nick.focus();
  }
  Session.onUser(function (u) {
    if (pmBack) { var sid = pmBack; pmBack = null; api.account.payMethodDone(sid).then(function () { planMsg = ['bill.pmDone', 'ok']; pmInfo = null; loadPm(); if (tab === 'plan') draw(); }).catch(function () {}); } setTimeout(function () { requireName(u); }, 300); });
  Session.onUser(function (u) { if (u.theme && u.theme !== theme.get()) theme.set(u.theme, false); user = u; sum = null; billing = null; billingLoaded = false; draft = null; bad = []; tab = 'profile'; editing = null; emailPending = null; sessions = null; activity = null; planInfo = null; invInfo = null; draw(); loadSummary(); loadBilling(); });
  // Net op de link in de mail geklikt (nieuw e-mailadres): Mijn account openen met de uitkomst
  document.addEventListener('account:email-note', function (e) {
    var n = e.detail || {}; window.goToPage('account'); open('profile');
    if (n.ok) { user = Object.assign({}, user, { email: n.email, verified: true }); emailPending = null; sticky = function () { return { email: [t('acct.emailChanged', { email: n.email }), 'ok'] }; }; }
    else sticky = function () { return { email: [t(n.code === 'exists' ? 'acct.emailErrExists' : n.code === 'blocked' ? 'auth.errBlocked' : 'acct.emailErrToken'), 'bad'] }; };
    draw();
  });
  // Elke keer dat je Mijn account opent: verse cijfers
  document.addEventListener('click', function (e) { if (e.target.closest('[data-page="account"], #bgBtn')) loadSummary(); });
  i18n.onChange(function () {
    draw();
    // Taal ook in je profiel: e-mails die we zelf sturen (zoals het scanoverzicht) komen in jouw taal
    if (user && !api.isDemo() && user.lang !== i18n.lang()) { user = Object.assign({}, user, { lang: i18n.lang() }); api.account.update({ lang: i18n.lang() }).catch(function () {}); }
  });
})();
