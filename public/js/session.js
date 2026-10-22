/* =========================================================
   INLOGGEN (alleen met de echte server; de online demo werkt zonder account)
   - Bij het openen: ben je ingelogd? Zo niet, dan het inlogscherm over de app heen.
   - Licentie: klanten maken niet zelf een account. Het team nodigt uit (pagina Klanten); de klant opent de link
     uit de mail (?invite=…), kiest een wachtwoord en is meteen ingelogd. Zelf aanmelden alleen als de server
     dat toestaat (ALLOW_SIGNUP=true) en in de online demo.
   - Account maken (als dat aan staat) -> "check je e-mail" -> link uit de mail (?verify=…) bevestigt het account -> zelf inloggen.
     Pas na bevestigen kun je inloggen (zo kan niet zomaar iedereen of een robot accounts aanmaken).
   - Inloggen, wachtwoord vergeten, nieuw wachtwoord (link uit de e-mail: ?reset=…).
   - Uitloggen via de zijbalk. Sessie verlopen? Dan verschijnt het inlogscherm vanzelf.
   ========================================================= */
var Session = (function () {
  var view = document.getElementById('authView'), card = view.querySelector('.auth-card');
  var landing = null, user = null, mode = 'login', resetToken = '', listeners = [], pendingEmail = '', pendingToken = null, prefill = '', flash = null;   // flash: melding die blijft staan als de taal (opnieuw) laadt
  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var LOGO = '<img class="logo-mark" src="icons/favicon.svg" alt="">';
  var MICROSOFT = '<svg viewBox="0 0 23 23" width="20" height="20" aria-hidden="true"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>';
  var GOOGLE = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
  // Twee omgevingen met hetzelfde inlogscherm: de app (/) en het beheer (/admin, alleen voor admins).
  // Een admin kan alles wat een klant kan en wisselt met de knop App / Beheer; een klant kan het beheer niet in.
  var ADMIN = document.body.getAttribute('data-app') === 'admin';

  var accepted = false;                                                  // vinkje Terms bij registreren (blijft staan bij een foutmelding)
  function field(name, type, label, auto, value) {
    var pw = type === 'password';
    return '<label class="auth-f"><span>' + esc(label) + '</span><span class="auth-in">' +
      '<input name="' + name + '" type="' + type + '" autocomplete="' + auto + '" value="' + esc(value || '') + '" required' + (name === 'email' ? ' inputmode="email" spellcheck="false"' : '') + (pw && auto === 'new-password' ? ' minlength="8" data-pw-rules="authPwRules" aria-describedby="authPwRules"' : '') + '>' +
      (pw ? '<button type="button" class="auth-eye" data-eye aria-label="' + esc(t('pw.show')) + '" aria-pressed="false">' + EYE + '</button>' : '') + '</span></label>' +
      (pw && auto === 'new-password' ? PasswordRules.list('authPwRules') : '');
  }
  function langPicker() {
    return '<select class="auth-lang" aria-label="' + esc(t('header.chooseLanguage')) + '">' + LANGUAGES.map(function (l) { return '<option value="' + l.code + '"' + (l.code === i18n.lang() ? ' selected' : '') + '>' + l.name + '</option>'; }).join('') + '</select>';
  }
  var tfa = null;                                                        // e-mail + wachtwoord bewaren tot de 2FA-code er is (alleen in het geheugen)
  function draw(msg, kind) {
    if (mode !== 'twofa') tfa = null;
    if (!msg && flash) { msg = t(flash[0]); kind = flash[1]; }
    var email = (card.querySelector('input[name=email]') || {}).value || prefill || '', name = (card.querySelector('input[name=name]') || {}).value || '';   // ingevulde waarden houden bij een foutmelding
    var head = '<div class="auth-top"><span class="auth-logo">' + LOGO + '<b>QR-<small>Codex</small></b><em class="auth-by">by Optimasys</em>' + (ADMIN ? '<em class="auth-admin">' + t('adminApp.badge') + '</em>' : '') + '</span>' + langPicker() + '</div>';
    var note = msg ? '<p class="auth-msg ' + (kind || 'bad') + '" role="alert">' + esc(msg) + '</p>' : '';
    var body;
    var signup = !ADMIN && (api.isDemo() || !!api.info().signup);         // zelf een account maken: alleen als dat mag (nooit in het beheer)
    if (mode === 'register' && !signup) mode = 'login';
    if (mode === 'login' || mode === 'register') {
      body = '<h1 id="authTitle">' + t(mode === 'login' ? (ADMIN ? 'adminApp.loginTitle' : 'auth.loginTitle') : 'auth.registerTitle') + '</h1><p class="auth-lead">' + t(mode === 'login' ? (ADMIN ? 'adminApp.loginLead' : 'auth.loginLead') : 'auth.registerLead') + '</p>' +
        (!ADMIN && api.info && (api.info().google || api.info().microsoft) ?
          (api.info().google ? '<a class="btn auth-google" href="api/auth/google">' + GOOGLE + '<span>' + t('auth.google') + '</span></a>' : '') +
          (api.info().microsoft ? '<a class="btn auth-google auth-ms" href="api/auth/microsoft">' + MICROSOFT + '<span>' + t('auth.microsoft') + '</span></a>' : '') +
          '<p class="auth-or"><span>' + t('auth.or') + '</span></p>' : '') +
        (signup ? '<div class="auth-tabs" role="tablist"><button type="button" role="tab" data-mode="login" aria-selected="' + (mode === 'login') + '">' + t('auth.login') + '</button><button type="button" role="tab" data-mode="register" aria-selected="' + (mode === 'register') + '">' + t('auth.register') + '</button></div>' : '') + note +
        '<form class="auth-form" novalidate>' + (mode === 'register' ? field('name', 'text', t('auth.name'), 'name', name) : '') +
        field('email', 'email', t('auth.email'), 'email', email) + field('password', 'password', t('auth.password'), mode === 'login' ? 'current-password' : 'new-password') +
        (mode === 'register' ? termsBox(accepted) : '') +
        '<button class="btn primary auth-go" type="submit">' + t(mode === 'login' ? 'auth.login' : 'auth.createAccount') + '</button></form>' +
        (mode === 'login' ? '<button type="button" class="link-btn auth-link" data-mode="forgot">' + t('auth.forgot') + '</button>' : '<p class="auth-small">' + t('auth.privacyNote') + '</p>') +
        (mode === 'login' && !signup && !ADMIN ? '<p class="auth-license">' + t('auth.licenseNote') + '</p>' : '') +
        (mode === 'login' && ADMIN ? '<p class="auth-license">' + t('adminApp.onlyAdmins') + '</p>' : '');
    } else if (mode === 'twofa') {
      // Tweestapsverificatie: code uit de authenticator-app (of een herstelcode)
      body = '<h1 id="authTitle">' + t('tfa.loginTitle') + '</h1><p class="auth-lead">' + t('tfa.loginLead') + '</p>' + note +
        '<form class="auth-form" novalidate><label class="auth-f"><span>' + t('tfa.code') + '</span><span class="auth-in"><input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="11" required autofocus spellcheck="false"></span></label>' +
        '<p class="auth-small">' + t('tfa.recoveryHint') + '</p><button class="btn primary auth-go" type="submit">' + t('auth.login') + '</button></form>' +
        '<button type="button" class="link-btn auth-link" data-mode="login">← ' + t('auth.backToLogin') + '</button>';
    } else if (mode === 'check') {
      // Account gemaakt: eerst e-mail bevestigen
      body = '<span class="auth-mail" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></span>' +
        '<h1 id="authTitle">' + t('auth.checkTitle') + '</h1><p class="auth-lead">' + t('auth.checkLead', { email: '<b>' + esc(pendingEmail) + '</b>' }) + '</p>' + note +
        (api.isDemo() || pendingToken ? '<button type="button" class="btn primary auth-go" data-demo-verify>' + t('auth.demoVerify') + '</button>' : '') +
        '<button type="button" class="btn ghost auth-go" data-resend>' + t('auth.resend') + '</button>' +
        '<button type="button" class="link-btn auth-link" data-mode="login">← ' + t('auth.backToLogin') + '</button>';
    } else if (mode === 'forgot') {
      body = '<h1 id="authTitle">' + t('auth.forgotTitle') + '</h1><p class="auth-lead">' + t('auth.forgotLead') + '</p>' + note +
        '<form class="auth-form" novalidate>' + field('email', 'email', t('auth.email'), 'email', email) + '<button class="btn primary auth-go" type="submit">' + t('auth.sendLink') + '</button></form>' +
        '<button type="button" class="link-btn auth-link" data-mode="login">← ' + t('auth.backToLogin') + '</button>';
    } else if (mode === 'sent') {
      body = '<h1 id="authTitle">' + t('auth.sentTitle') + '</h1><p class="auth-lead">' + t('auth.sentLead') + '</p><button type="button" class="btn ghost auth-go" data-mode="login">' + t('auth.backToLogin') + '</button>';
    } else {
      var invite = mode === 'invite';                                     // uitnodiging van het team: eerste wachtwoord kiezen
      body = '<h1 id="authTitle">' + t(invite ? 'auth.inviteTitle' : 'auth.resetTitle') + '</h1><p class="auth-lead">' + t(invite ? 'auth.inviteLead' : 'auth.resetLead') + '</p>' + note +
        '<form class="auth-form" novalidate>' + field('password', 'password', t('auth.newPassword'), 'new-password') +
        '<button class="btn primary auth-go" type="submit">' + t(invite ? 'auth.inviteGo' : 'auth.savePassword') + '</button></form>';
    }
    if (api.isDemo() && (mode === 'login' || mode === 'register')) body += '<p class="auth-demo">' + t('auth.demoNote') + '</p>';
    // Privacy, voorwaarden en cookies: ook te lezen zonder in te loggen
    body += '<nav class="auth-legal" aria-label="' + esc(t('legal.nav')) + '">' + ['privacy', 'terms', 'cookies'].map(function (d) { return '<button type="button" class="link-btn" data-legal="' + d + '">' + t('legal.' + d + '.short') + '</button>'; }).join('<span aria-hidden="true">·</span>') + '</nav>';
    card.innerHTML = head + body;
    var first = card.querySelector('input[name=name], input[name=email]:not([value]), input[name=email][value=""], input[name=password]'); if (first) first.focus();
  }
  // Link uit de bevestigingsmail
  function verify(token) {
    return api.auth.verify({ token: token }).then(function (r) { prefill = (r && r.email) || pendingEmail; flash = ['auth.verified', 'ok']; show('login'); })
      .catch(function () { flash = ['auth.errVerifyToken', 'bad']; show('login'); });
  }
  /** Vinkje: 18+ en akkoord met Terms en Privacy (Terms punt 1 en 3). Ook gebruikt door TermsGate. */
  function termsBox(on) {
    return '<label class="auth-terms"><input type="checkbox" name="accept"' + (on ? ' checked' : '') + '><span>' + esc(t('terms.check')) + ' ' +
      '<button type="button" class="link-btn" data-legal="terms">' + esc(t('legal.terms.title')) + '</button> · <button type="button" class="link-btn" data-legal="privacy">' + esc(t('legal.privacy.title')) + '</button></span></label>';
  }
  window.TermsBox = termsBox;
  function errorText(e) {
    var map = { signup_closed: 'auth.licenseNote', disabled: 'auth.errDisabled', wrong: 'auth.errWrong', exists: 'auth.errExists', email: 'auth.errEmail', too_many: 'auth.errTooMany', token: 'auth.errToken', email_disposable: 'auth.errDisposable', blocked: 'auth.errBlocked', email_alias: 'auth.errAlias', terms: 'terms.err' };
    return t(map[e && e.code] || PasswordRules.errorKey(e && e.code) || 'auth.errGeneral');
  }
  function ready() { document.body.classList.remove('auth-checking'); }
  setTimeout(ready, 4000);                                                // nooit eeuwig een leeg scherm
  function show(m) { mode = m || 'login'; view.hidden = false; document.body.classList.add('auth-open'); ready(); draw(); }
  function hide() { view.hidden = true; document.body.classList.remove('auth-open'); }
  // Na inloggen: alles opnieuw laden met de nieuwe sessie (eigen codes, eigen achtergrond)
  function enter(u) {
    if (ADMIN && u && !u.admin) {                                         // klant probeert het beheer: weer uitloggen
      return api.auth.logout().catch(function () {}).then(function () { flash = ['adminApp.notAdmin', 'bad']; show('login'); });
    }
    location.replace(location.pathname);
  }

  card.addEventListener('click', function (e) {
    var lg = e.target.closest('[data-legal]'); if (lg && window.Legal) return Legal.dialog(lg.getAttribute('data-legal'));
    var m = e.target.closest('[data-mode]'); if (m) { flash = null; if (mode === 'check') prefill = pendingEmail; mode = m.getAttribute('data-mode'); return draw(); }
    if (e.target.closest('[data-resend]')) {
      var rb = e.target.closest('[data-resend]'); rb.disabled = true;
      return api.auth.resend({ email: pendingEmail, lang: i18n.lang() }).then(function (r) { if (r && r.token) pendingToken = r.token; draw(t('auth.resent'), 'ok'); }).catch(function (err) { draw(errorText(err)); });
    }
    if (e.target.closest('[data-demo-verify]')) return verify(pendingToken || api.auth.demoToken(pendingEmail));
    var eye = e.target.closest('[data-eye]');
    if (eye) { var inp = eye.parentNode.querySelector('input'), on = inp.type === 'password'; inp.type = on ? 'text' : 'password'; eye.setAttribute('aria-pressed', String(on)); eye.setAttribute('aria-label', t(on ? 'pw.hide' : 'pw.show')); }
  });
  card.addEventListener('change', function (e) { if (e.target.classList.contains('auth-lang')) i18n.set(e.target.value); });
  card.addEventListener('submit', function (e) {
    e.preventDefault(); flash = null;
    var f = e.target, val = function (n) { var i = f.querySelector('[name=' + n + ']'); return i ? i.value.trim() : ''; }, btn = f.querySelector('.auth-go');
    var pw = (f.querySelector('[name=password]') || {}).value || '';
    var acc = f.querySelector('[name=accept]'); if (acc) accepted = acc.checked;
    if (acc && !acc.checked) {                                            // melding zonder opnieuw tekenen: ingevuld wachtwoord blijft staan
      var m = card.querySelector('.auth-msg') || document.createElement('p'); m.className = 'auth-msg bad'; m.setAttribute('role', 'alert'); m.textContent = t('terms.err');
      if (!m.parentNode) f.parentNode.insertBefore(m, f); acc.focus(); return;
    }
    if (f.querySelector('[name=email]') && !EmailCheck.valid(val('email')) || f.querySelector('[name=email]') && !val('email')) return draw(t('auth.errEmail'));
    if (f.querySelector('[name=password]') && !pw) return draw(t('auth.errPassword'));
    var np = f.querySelector('[data-pw-rules]'), prob = np && PasswordRules.problem(pw);    // nieuw wachtwoord: eerst zelf controleren
    if (prob) return draw(t(PasswordRules.errorKey('password_' + prob)));
    btn.disabled = true;
    if (mode === 'twofa' && !val('code')) { btn.disabled = false; return draw(t('tfa.errEmpty')); }
    var job = mode === 'twofa' && tfa && tfa.google ? api.auth.google2fa({ token: tfa.google, code: val('code') })
      : mode === 'twofa' ? api.auth.login({ email: tfa.email, password: tfa.password, code: val('code') })
      : mode === 'login' ? api.auth.login({ email: val('email'), password: pw })
      : mode === 'register' ? api.auth.register({ email: val('email'), password: pw, name: val('name'), lang: i18n.lang(), accept: accepted }).then(function (r) { pendingEmail = val('email'); pendingToken = (r && r.token) || null; mode = 'check'; draw(); return null; })
      : mode === 'forgot' ? api.auth.forgot({ email: val('email'), lang: i18n.lang() }).then(function () { mode = 'sent'; draw(); return null; })
      : api.auth.reset({ token: resetToken, password: pw });
    job.then(function (u) { if (u) enter(u); }).catch(function (err) {
      if (err && err.code === '2fa_required' && mode === 'login') { tfa = { email: val('email'), password: pw }; mode = 'twofa'; draw(); var ci = card.querySelector('[name=code]'); if (ci) ci.focus(); return; }
      if (err && err.code === '2fa_wrong') { draw(t('tfa.errWrong')); var cb = card.querySelector('.auth-go'); if (cb) cb.disabled = false; var ci2 = card.querySelector('[name=code]'); if (ci2) { ci2.value = ''; ci2.focus(); } return; }
      if (err && err.code === 'unverified') { pendingEmail = val('email'); pendingToken = null; mode = 'check'; flash = ['auth.errUnverified', 'bad']; return draw(); }
      draw(errorText(err)); var b = card.querySelector('.auth-go'); if (b) b.disabled = false; });
  });
  i18n.onChange(function () { if (!view.hidden) draw(); });

  // Uitloggen via de zijbalk (vóór de gewone paginawissel)
  document.addEventListener('click', function (e) {
    var out = e.target.closest('[data-page="logout"]'); if (!out || !user) return;
    e.preventDefault(); e.stopPropagation();
    api.auth.logout().catch(function () {}).then(function () { user = null; location.replace(location.pathname); });
  }, true);
  document.addEventListener('auth:required', function () { if (user || view.hidden) { user = null; show('login'); } });

  // Starten
  var m = location.search.match(/[?&](reset|invite)=([^&]+)/);
  // Vanaf de website (qr-codex.com): ?signup&plan=pro&period=year&lang=nl → taal zetten, gekozen pakket onthouden
  // (ook na de bevestigingslink in een nieuw tabblad) en meteen het scherm "Account maken" tonen.
  var fromSite = /[?&]signup\b/.test(location.search), qp = function (k) { var r = location.search.match(new RegExp('[?&]' + k + '=([a-z]+)')); return r ? r[1] : ''; };
  if (fromSite) {
    var wl = qp('lang'), wp = qp('plan'), wper = qp('period');
    if (wl && window.LANGUAGES && LANGUAGES.some(function (l) { return l.code === wl; })) i18n.set(wl);
    if (/^(standard|pro|business)$/.test(wp)) { try { localStorage.setItem('optimasys-want', JSON.stringify({ plan: wp, period: wper === 'year' || wper === 'quarter' ? wper : 'month', at: Date.now() })); } catch (e) {} }
    history.replaceState(null, '', location.pathname);
  }
  var g2 = location.search.match(/[?&]g2fa=([A-Za-z0-9_-]+)/);
  if (g2) { history.replaceState(null, '', location.pathname); }
  var gerr = location.search.match(/[?&]([gm])err=([a-z_0-9]+)/);   // g = Google, m = Microsoft
  if (gerr) { history.replaceState(null, '', location.pathname); flash = [{ signup_closed: 'auth.licenseNote', disabled: 'auth.errDisabled', email_disposable: 'auth.errDisposable', blocked: 'auth.errBlocked', too_many: 'auth.errTooMany', '2fa': 'auth.g2fa' }[gerr[2]] || (gerr[1] === 'm' ? (gerr[2] === 'unverified' ? 'auth.mUnverified' : 'auth.mErr') : 'auth.gErr'), 'bad']; }
  api.available().then(function (online) {
    if (g2) { tfa = { google: g2[1] }; show('twofa'); return; }
    if (fromSite && !m) return api.auth.me().then(function (u) { user = u; i18n.setZone(u && u.timezone); ready(); listeners.forEach(function (f) { f(u); }); }, function () { show('register'); });
    if (m) { resetToken = decodeURIComponent(m[2]); history.replaceState(null, '', location.pathname); return show(m[1]); }
    var v = location.search.match(/[?&]verify=([^&]+)/);
    if (v) { history.replaceState(null, '', location.pathname); return verify(decodeURIComponent(v[1])); }
    // Link uit de mail naar je nieuwe e-mailadres (?email=…): eerst bevestigen, dan gewoon verder
    var ec = location.search.match(/[?&]email=([^&]+)/), note = null;
    var first = ec ? (history.replaceState(null, '', location.pathname), api.auth.emailChange({ token: decodeURIComponent(ec[1]), lang: i18n.lang() })
      .then(function (r) { note = { ok: true, email: r.email }; prefill = r.email; }, function (x) { note = { ok: false, code: x && x.code }; })) : Promise.resolve();
    return first.then(function () { return api.auth.me(); }).then(function (u) {
      if (ADMIN && !u.admin) { flash = ['adminApp.notAdmin', 'bad']; return show('login'); }
      user = u; i18n.setZone(u && u.timezone); landing = note ? 'account' : null; ready(); listeners.forEach(function (f) { f(u); });
      if (note) document.dispatchEvent(new CustomEvent('account:email-note', { detail: note }));
    }).catch(function () {
      if (note) flash = note.ok ? ['acct.emailChangedLogin', 'ok'] : [note.code === 'exists' ? 'acct.emailErrExists' : 'acct.emailErrToken', 'bad'];
      show('login');
    });
  });
  /** Waar je na het inloggen begint: normaal de standaard (Overzicht of Dashboard), na een link uit de mail Mijn account */
  function landOn(def) { return landing || def; }
  return { landOn: landOn, user: function () { return user; }, onUser: function (f) { listeners.push(f); if (user) f(user); }, show: show };
})();
