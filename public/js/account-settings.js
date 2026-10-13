/* =========================================================
   MIJN ACCOUNT
   Rechts een menu in drie groepen, links het gekozen onderdeel (op de telefoon staat het menu bovenaan):
     Account     Profiel · Beveiliging · Voorkeuren · Achtergrond
     Facturatie  Factuurgegevens · Abonnement en facturen
     Privacy     Mijn gegevens (downloaden, account verwijderen)
   Bovenaan een visitekaartje: profielfoto (klik = wijzigen), naam, rol en status, e-mail, lid sinds en de cijfers.
   Profiel: foto, voornaam/achternaam, e-mail (bevestigd), tijdzone (alle datums volgen die) en de gevarenzone.
   In de online demo (zonder server) werkt alles ook; de gegevens staan dan alleen in deze browser.
   ========================================================= */
(function () {
  var box = document.getElementById('acctCards'), menu = document.getElementById('acctMenu'), stats = document.getElementById('acctStats');
  var bgSection = document.getElementById('bgSection'), user = null, sum = null, tab = 'profile';
  var billing = null, billingLoaded = false, draft = null, bad = [];                 // factuurgegevens: opgeslagen, in bewerking, foute velden
  var SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
  var ICON = {
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
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'
  };
  var GROUPS = [
    ['acct.groupAccount', [['profile', 'acct.profile'], ['security', 'acct.security'], ['prefs', 'acct.prefsTitle'], ['background', 'account.background']]],
    ['acct.groupBilling', [['billing', 'acct.billing'], ['plan', 'acct.planNav']]],
    ['acct.groupPrivacy', [['data', 'acct.dataTitle']]]
  ];
  var TAB_IDS = [].concat.apply([], GROUPS.map(function (g) { return g[1].map(function (x) { return x[0]; }); }));
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
    var old = a.querySelector('.nav-av'), ic = a.querySelector('svg');
    if (user && user.avatar) {
      if (!old) { old = document.createElement('img'); old.className = 'nav-av'; old.alt = ''; a.insertBefore(old, a.firstChild); }
      old.src = user.avatar; if (ic) ic.style.display = 'none';
    } else { if (old) old.remove(); if (ic) ic.style.display = ''; }
  }

  /* ---------- Menu ---------- */
  function drawMenu() {
    menu.innerHTML = GROUPS.map(function (g) {
      return '<p class="acct-group" aria-hidden="true">' + t(g[0]) + '</p>' + g[1].map(function (x) {
        var on = x[0] === tab;
        return '<button type="button" role="tab" id="acctTab-' + x[0] + '" data-tab="' + x[0] + '" aria-selected="' + on + '" aria-controls="' + (x[0] === 'background' ? 'bgSection' : 'acctCards') + '" tabindex="' + (on ? 0 : -1) + '">' + SVG + ICON[x[0]] + '</svg><span>' + t(x[1]) + '</span>' +
          (x[0] === 'billing' && billingLoaded && !billing ? '<i class="acct-dot" title="' + esc(t('acct.billingMissing')) + '"></i>' : '') + '</button>';
      }).join('');
    }).join('') +
    '<span class="acct-menu-line" aria-hidden="true"></span>' +
    '<button type="button" class="acct-out" data-page="logout">' + SVG + ICON.out + '</svg><span>' + t('nav.logout') + '</span></button>';
  }
  function head() {
    var av = document.getElementById('acctAvatar');
    document.getElementById('acctAvatarIn').innerHTML = avatarHtml(user); av.classList.toggle('has-photo', !!user.avatar);
    av.setAttribute('aria-label', t(user.avatar ? 'acct.photoChange' : 'acct.photoAdd')); av.title = t(user.avatar ? 'acct.photoChange' : 'acct.photoAdd');
    document.getElementById('acctName').textContent = user.name || user.email;
    var role = user.role || (user.superAdmin ? 'super' : user.admin ? 'admin' : 'user');
    document.getElementById('acctBadges').innerHTML = '<span class="acct-chip role-' + role + '">' + (role !== 'user' ? SVG + ICON.shield + '</svg>' : '') + t('acct.role_' + role) + '</span>' +
      '<span class="acct-chip ok"><i></i>' + t('acct.statusActive') + '</span>';
    var since = sum && sum.createdAt ? i18n.fmt.stamp(sum.createdAt, 'long') : '';
    var em = document.getElementById('acctEmail'); em.removeAttribute('data-i18n');
    em.textContent = user.email;
    navAvatar();
    var se = document.getElementById('acctSince'); se.textContent = since ? t('acct.since', { date: since }) : ''; se.hidden = !since;
    var stat = function (v, k, page) { return '<a href="#" class="acct-stat" data-goto="' + page + '"><b>' + (v == null ? '–' : i18n.fmt.num(v)) + '</b><small>' + t(k) + '</small></a>'; };
    stats.innerHTML = stat(sum && sum.codes, 'acct.codes', 'myCodes') + stat(sum && sum.scans, 'acct.scansTotal', 'analytics') + stat(sum && sum.scans30, 'acct.scans30', 'analytics');
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
      '<div class="acct-seg" role="radiogroup" aria-label="' + esc(t('acct.typeLabel')) + '">' + seg('company', t('acct.company'), 'company') + seg('private', t('acct.private'), 'person') + '</div>' +
      '<div class="acct-grid">' +
      (company ? f('companyName', t('acct.companyName'), 'company', { attrs: ' maxlength="120" autocomplete="organization"' }) +
                 f('taxId', t('acct.taxId'), 'hash', { optional: true, hint: t('acct.taxIdHint'), attrs: ' maxlength="24" autocapitalize="characters" spellcheck="false"' }) : '') +
      f('firstName', t('acct.firstName'), 'person', { optional: company, attrs: ' maxlength="60" autocomplete="given-name"' }) +
      f('lastName', t('acct.lastName'), 'person', { optional: company, attrs: ' maxlength="60" autocomplete="family-name"' }) +
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
  function planPanel() {
    var feats = ['acct.planF1', 'acct.planF2', 'acct.planF3', 'acct.planF4'].map(function (k) { return '<li>' + SVG + ICON.check + '</svg>' + t(k) + '</li>'; }).join('');
    var addr = billing ? [billing.type === 'company' ? billing.companyName : (billing.firstName + ' ' + billing.lastName), billing.address, billing.postalCode + ' ' + billing.city, TEL.name(billing.country)].filter(Boolean).map(esc).join('<br>') : '';
    return '<div class="glass bg-card acct"><div class="acct-plan-head"><div><h2>' + t('acct.planCurrent') + '</h2><p>' + t('acct.planFreeLead') + '</p></div><span class="acct-badge">' + t('acct.planFree') + '</span></div>' +
        '<ul class="acct-feats">' + feats + '</ul><p class="acct-note">' + t('acct.planNote') + '</p></div>' +
      '<div class="glass bg-card acct"><h2>' + t('acct.billingTo') + '</h2>' +
        (billing ? '<p class="acct-addr">' + addr + (billing.taxId ? '<br><span>' + t('acct.taxId') + ': ' + esc(billing.taxId) + '</span>' : '') + '</p><button type="button" class="btn ghost" data-tab-go="billing">' + t('acct.billingEdit') + '</button>'
          : '<p>' + t('acct.billingMissing') + '</p><button type="button" class="btn primary" data-tab-go="billing">' + t('acct.billingFill') + '</button>') + '</div>' +
      '<div class="glass bg-card acct"><h2>' + t('acct.invoices') + '</h2>' +
        '<div class="acct-table" role="table" aria-label="' + esc(t('acct.invoices')) + '"><div class="acct-tr acct-th" role="row">' +
        ['acct.invDate', 'acct.invNumber', 'acct.invAmount', 'acct.invStatus'].map(function (k) { return '<span role="columnheader">' + t(k) + '</span>'; }).join('') + '</div>' +
        '<div class="acct-empty" role="row"><span role="cell">' + SVG + ICON.billing + '</svg>' + t('acct.invEmpty') + '</span></div></div></div>';
  }
  function dangerCard(m) {
    return '<div class="glass bg-card acct acct-danger"><div class="acct-danger-head">' + SVG + ICON.warn + '</svg><div><h2>' + t('acct.dangerTitle') + '</h2><p>' + t('acct.dangerLead') + '</p></div></div>' +
      '<div class="acct-danger-row"><div><b>' + t('acct.delete') + '</b><small>' + t('acct.deleteHint') + '</small></div>' +
      '<button type="button" class="btn danger" data-delete>' + SVG + ICON.trash + '</svg>' + t('acct.delete') + '</button></div>' + (m.delete ? '<p class="acct-msg ' + m.delete[1] + '" role="status">' + esc(m.delete[0]) + '</p>' : '') + '</div>';
  }
  function profilePanel(m, note) {
    var nm = splitName(user.name), tz = user.timezone || '', here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    var opts = '<option value="">' + esc(t('acct.tzAuto', { zone: (here || 'UTC').replace(/_/g, ' ') })) + '</option>' +
      zoneList().map(function (z) { return '<option value="' + z[0] + '"' + (z[0] === tz ? ' selected' : '') + '>' + esc(z[2]) + '</option>'; }).join('');
    return '<div class="glass bg-card acct"><h2>' + t('acct.photoTitle') + '</h2><p>' + t('acct.photoLead') + '</p>' +
        '<div class="acct-photo" data-photo-drop><span class="acct-photo-av' + (user.avatar ? ' has-photo' : '') + '">' + avatarHtml(user) + '</span>' +
        '<div class="acct-photo-txt"><div class="acct-btns"><button type="button" class="btn primary" data-photo-pick>' + SVG + ICON.camera + '</svg>' + t(user.avatar ? 'acct.photoChange' : 'acct.photoAdd') + '</button>' +
        (user.avatar ? '<button type="button" class="btn ghost" data-photo-remove>' + t('acct.photoRemove') + '</button>' : '') + '</div>' +
        '<small class="auth-hint">' + t('acct.photoHint') + '</small></div></div>' + note('photo') + '</div>' +
      '<div class="glass bg-card acct"><h2>' + t('acct.personalTitle') + '</h2><p>' + t('acct.profileLead') + '</p>' +
      '<form data-form="profile"><div class="acct-grid">' +
        field(t('acct.firstName'), '<input name="first" value="' + esc(nm[0]) + '" maxlength="40" autocomplete="given-name" required>', { icon: 'person' }) +
        field(t('acct.lastName'), '<input name="last" value="' + esc(nm[1]) + '" maxlength="40" autocomplete="family-name">', { icon: 'person', optional: true }) +
        '<label class="auth-f acct-wide"><span>' + t('auth.email') + '</span><span class="auth-in acct-ic acct-mail">' + SVG + ICON.mail + '</svg><input value="' + esc(user.email) + '" disabled>' +
          (user.verified !== false ? '<em class="acct-verified">' + SVG + ICON.check + '</svg>' + t('acct.verified') + '</em>' : '') + '</span><small class="auth-hint">' + t('acct.emailHint') + '</small></label>' +
        field(t('acct.timezone'), '<select name="timezone">' + opts + '</select>', { icon: 'clock', wide: true, hint: '<span id="acctTzNow">' + esc(t('acct.tzHint', { time: nowIn(tz) })) + '</span>' }) +
      '</div><div class="acct-actions"><button class="btn primary" type="submit">' + t('acct.save') + '</button></div></form>' + note('name') + '</div>' +
      dangerCard(m);
  }
  function panel(m) {
    var note = function (k) { return m[k] ? '<p class="acct-msg ' + m[k][1] + '" role="status">' + esc(m[k][0]) + '</p>' : ''; };
    if (tab === 'profile') return profilePanel(m, note);
    if (tab === 'security') return '<div class="glass bg-card acct"><h2>' + t('acct.passwordTitle') + '</h2><p>' + t('acct.passwordLead') + '</p>' +
      '<form data-form="password"><div class="acct-grid">' +
      field(t('acct.current'), '<input name="current" type="password" autocomplete="current-password" required>') +
      field(t('auth.newPassword'), '<input name="password" type="password" autocomplete="new-password" minlength="8" required data-pw-rules="acctPwRules" aria-describedby="acctPwRules">') + PasswordRules.list('acctPwRules').replace('<ul class="pw-rules"', '<ul class="pw-rules acct-wide"') + '</div>' +
      '<div class="acct-actions"><button class="btn primary" type="submit">' + t('auth.savePassword') + '</button></div></form>' + note('password') + '</div>' +
      '<div class="glass bg-card acct"><h2>' + t('acct.devicesTitle') + '</h2>' +
      '<div class="acct-dev"><p>' + t('acct.devices', { n: sum ? sum.sessions : 1 }) + '</p>' + (sum && sum.sessions > 1 ? '<button type="button" class="btn ghost" data-logout-others>' + t('acct.logoutOthers') + '</button>' : '') + '</div>' + note('devices') + '</div>';
    if (tab === 'prefs') return '<div class="glass bg-card acct"><h2>' + t('acct.prefsTitle') + '</h2><p>' + t('acct.prefsLead') + '</p>' +
      field(t('acct.language'), '<select id="acctLang">' + LANGUAGES.map(function (l) { return '<option value="' + l.code + '"' + (l.code === i18n.lang() ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select>', { icon: 'globe', cls: 'acct-lang' }) + '</div>';
    if (tab === 'billing') return billingPanel(m);
    if (tab === 'plan') return planPanel();
    if (tab === 'data') return '<div class="glass bg-card acct"><h2>' + t('acct.dataTitle') + '</h2><p>' + t('acct.dataLead') + '</p>' +
      '<div class="acct-btns"><button type="button" class="btn ghost" data-export>' + SVG + ICON.download + '</svg>' + t('acct.download') + '</button></div>' + note('export') + '</div>' + dangerCard(m);
    return '';
  }
  function draw(msg) {
    if (!user) { box.innerHTML = ''; menu.innerHTML = ''; stats.innerHTML = ''; return; }
    if (TAB_IDS.indexOf(tab) < 0) tab = 'profile';
    head(); drawMenu();
    var isBg = tab === 'background';
    bgSection.hidden = !isBg; box.hidden = isBg;
    (isBg ? bgSection : box).setAttribute('aria-labelledby', 'acctTab-' + tab);
    box.innerHTML = isBg ? '' : panel(msg || {});
  }
  function open(id, focus) {
    tab = id; bad = []; if (id === 'billing' && billingLoaded) draft = startDraft();
    draw();
    if (focus) { var b = document.getElementById('acctTab-' + id); if (b) b.focus(); }
  }
  window.openAccountTab = function (id) { open(id); };

  function err(e) { return e && e.code === 'wrong' ? t('acct.wrongCurrent') : e && PasswordRules.errorKey(e.code) ? t(PasswordRules.errorKey(e.code)) : e && e.code === 'too_many' ? t('auth.errTooMany') : t('auth.errGeneral'); }
  function readBilling(f) { BILLING_KEYS.forEach(function (k) { if (f.elements[k]) draft[k] = f.elements[k].value; }); }

  menu.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) open(b.getAttribute('data-tab')); });
  menu.addEventListener('keydown', function (e) {   // pijltjes: naar het vorige/volgende onderdeel
    var i = TAB_IDS.indexOf(tab), n = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = TAB_IDS[(i + 1) % TAB_IDS.length];
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = TAB_IDS[(i - 1 + TAB_IDS.length) % TAB_IDS.length];
    if (e.key === 'Home') n = TAB_IDS[0];
    if (e.key === 'End') n = TAB_IDS[TAB_IDS.length - 1];
    if (n && e.target.closest('[data-tab]')) { e.preventDefault(); open(n, true); }
  });
  stats.addEventListener('click', function (e) { var go = e.target.closest('[data-goto]'); if (go) { e.preventDefault(); window.goToPage(go.getAttribute('data-goto')); } });

  box.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, kind = f.getAttribute('data-form'), btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    if (kind === 'profile') {
      var name = (f.first.value.trim() + ' ' + f.last.value.trim()).trim();
      if (!f.first.value.trim()) { btn.disabled = false; f.first.focus(); return; }
      api.account.update({ name: name, timezone: f.timezone.value }).then(function (u) {
        user = Object.assign({}, user, u, { timezone: f.timezone.value || null }); i18n.setZone(user.timezone);
        draw({ name: [t('acct.saved'), 'ok'] }); document.dispatchEvent(new CustomEvent('account:changed'));
      }).catch(function (x) { draw({ name: [err(x), 'bad'] }); });
    }
    if (kind === 'password') {
      var prob = PasswordRules.problem(f.password.value);
      if (prob) { btn.disabled = false; return draw({ password: [t(PasswordRules.errorKey('password_' + prob)), 'bad'] }); }
      api.account.password({ current: f.current.value, password: f.password.value }).then(function () { if (sum) sum.sessions = 1; draw({ password: [t('acct.passwordSaved'), 'ok'] }); })
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
    var f = e.target.form; if (!f || f.getAttribute('data-form') !== 'billing' || !e.target.name) return;
    draft[e.target.name] = e.target.value;
    if (e.target.getAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); var m = document.getElementById('err-' + e.target.name); if (m) m.remove(); bad = bad.filter(function (k) { return k !== e.target.name; }); }
  });
  box.addEventListener('change', function (e) {
    if (e.target.id === 'acctLang') i18n.set(e.target.value);
    if (e.target.name === 'timezone') { var h = document.getElementById('acctTzNow'); if (h) h.textContent = t('acct.tzHint', { time: nowIn(e.target.value) }); }
    if (e.target.name === 'country' && draft) draft.country = e.target.value;
  });
  box.addEventListener('click', function (e) {
    var seg = e.target.closest('[data-btype]');
    if (seg) { readBilling(seg.closest('form')); draft.type = seg.getAttribute('data-btype'); bad = []; draw(); var s = box.querySelector('[data-btype="' + draft.type + '"]'); if (s) s.focus(); return; }
    if (e.target.closest('[data-billing-reset]')) { draft = startDraft(); bad = []; return draw(); }
    var go = e.target.closest('[data-tab-go]'); if (go) return open(go.getAttribute('data-tab-go'));
    if (e.target.closest('[data-export]')) {
      return api.account.exportData().then(function (d) { saveFile(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }), 'optimasys-mijn-gegevens.json'); })
        .catch(function (x) { draw({ export: [err(x), 'bad'] }); });
    }
    if (e.target.closest('[data-logout-others]')) {
      api.account.logoutOthers().then(function () { sum.sessions = 1; draw({ devices: [t('acct.loggedOutOthers'), 'ok'] }); }).catch(function (x) { draw({ devices: [err(x), 'bad'] }); });
    }
  });
  // Bedrijf / particulier: pijltjes wisselen (zoals bij een keuzerondje)
  box.addEventListener('keydown', function (e) {
    var seg = e.target.closest('[data-btype]'); if (!seg || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) < 0) return;
    e.preventDefault(); readBilling(seg.closest('form')); draft.type = draft.type === 'private' ? 'company' : 'private'; draw();
    var s = box.querySelector('[data-btype="' + draft.type + '"]'); if (s) s.focus();
  });
  // Account verwijderen: eerst bevestigen met het wachtwoord
  box.addEventListener('click', function (e) {
    if (!e.target.closest('[data-delete]')) return;
    var d = document.getElementById('mcDialog');
    d.innerHTML = '<form method="dialog" class="mc-dlg"><span class="mc-dlg-ic"><svg class="mc-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></span>' +
      '<h3>' + t('acct.deleteTitle') + '</h3><p>' + t('acct.deleteText') + '</p>' +
      '<label class="auth-f"><span>' + t('auth.password') + '</span><span class="auth-in"><input type="password" id="delPw" autocomplete="current-password"></span></label><p class="acct-msg bad" id="delMsg" hidden></p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok" id="delGo">' + t('acct.deleteForever') + '</button></div></form>';
    d.querySelector('#delGo').addEventListener('click', function (ev) {
      ev.preventDefault();
      api.account.remove({ password: d.querySelector('#delPw').value }).then(function () { location.replace(location.pathname); })
        .catch(function (x) { var m = d.querySelector('#delMsg'); m.hidden = false; m.textContent = err(x); });
    });
    d.showModal(); d.querySelector('#delPw').focus();
  });
  /* ---------- Profielfoto: kiezen, slepen, verwijderen ---------- */
  var picker = document.getElementById('acctPhoto');
  function savePhoto(v) {
    return api.account.update({ avatar: v }).then(function (u) { user = Object.assign({}, user, u, { avatar: v }); draw({ photo: [t(v ? 'acct.photoSaved' : 'acct.photoRemoved'), 'ok'] }); })
      .catch(function (x) { draw({ photo: [err(x), 'bad'] }); });
  }
  function usePhoto(file) {
    if (!file) return;
    if (tab !== 'profile') open('profile');
    shrink(file).then(savePhoto, function (x) { draw({ photo: [t(x.message === 'big' ? 'acct.photoBig' : 'acct.photoType'), 'bad'] }); });
  }
  document.getElementById('accountView').addEventListener('click', function (e) {
    if (e.target.closest('[data-photo-pick]')) { picker.value = ''; picker.click(); }
    if (e.target.closest('[data-photo-remove]')) savePhoto(null);
  });
  picker.addEventListener('change', function () { usePhoto(picker.files[0]); });
  box.addEventListener('dragover', function (e) { var z = e.target.closest('[data-photo-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
  box.addEventListener('dragleave', function (e) { var z = e.target.closest('[data-photo-drop]'); if (z) z.classList.remove('over'); });
  box.addEventListener('drop', function (e) { var z = e.target.closest('[data-photo-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); usePhoto(e.dataTransfer.files[0]); });

  Session.onUser(function (u) { user = u; sum = null; billing = null; billingLoaded = false; draft = null; bad = []; tab = 'profile'; draw(); loadSummary(); loadBilling(); });
  // Elke keer dat je Mijn account opent: verse cijfers
  document.addEventListener('click', function (e) { if (e.target.closest('[data-page="account"], #bgBtn')) loadSummary(); });
  i18n.onChange(function () { draw(); });
})();
