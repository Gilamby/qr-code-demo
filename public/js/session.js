/* =========================================================
   INLOGGEN (alleen met de echte server; de online demo werkt zonder account)
   - Bij het openen: ben je ingelogd? Zo niet, dan het inlogscherm over de app heen.
   - Inloggen, account maken, wachtwoord vergeten, nieuw wachtwoord (link uit de e-mail: ?reset=…).
   - Uitloggen via de zijbalk. Sessie verlopen? Dan verschijnt het inlogscherm vanzelf.
   ========================================================= */
var Session = (function () {
  var view = document.getElementById('authView'), card = view.querySelector('.auth-card');
  var user = null, mode = 'login', resetToken = '', listeners = [];
  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var LOGO = '<span class="logo-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></span>';

  function field(name, type, label, auto, value) {
    var pw = type === 'password';
    return '<label class="auth-f"><span>' + esc(label) + '</span><span class="auth-in">' +
      '<input name="' + name + '" type="' + type + '" autocomplete="' + auto + '" value="' + esc(value || '') + '" required' + (name === 'email' ? ' inputmode="email" spellcheck="false"' : '') + (pw && auto === 'new-password' ? ' minlength="8"' : '') + '>' +
      (pw ? '<button type="button" class="auth-eye" data-eye aria-label="' + esc(t('pw.show')) + '" aria-pressed="false">' + EYE + '</button>' : '') + '</span></label>';
  }
  function langPicker() {
    return '<select class="auth-lang" aria-label="' + esc(t('header.chooseLanguage')) + '">' + LANGUAGES.map(function (l) { return '<option value="' + l.code + '"' + (l.code === i18n.lang() ? ' selected' : '') + '>' + l.name + '</option>'; }).join('') + '</select>';
  }
  function draw(msg, kind) {
    var email = (card.querySelector('input[name=email]') || {}).value || '', name = (card.querySelector('input[name=name]') || {}).value || '';   // ingevulde waarden houden bij een foutmelding
    var head = '<div class="auth-top"><span class="auth-logo">' + LOGO + '<b>Optimasys <small>QR</small></b></span>' + langPicker() + '</div>';
    var note = msg ? '<p class="auth-msg ' + (kind || 'bad') + '" role="alert">' + esc(msg) + '</p>' : '';
    var body;
    if (mode === 'login' || mode === 'register') {
      body = '<h1 id="authTitle">' + t(mode === 'login' ? 'auth.loginTitle' : 'auth.registerTitle') + '</h1><p class="auth-lead">' + t(mode === 'login' ? 'auth.loginLead' : 'auth.registerLead') + '</p>' +
        '<div class="auth-tabs" role="tablist"><button type="button" role="tab" data-mode="login" aria-selected="' + (mode === 'login') + '">' + t('auth.login') + '</button><button type="button" role="tab" data-mode="register" aria-selected="' + (mode === 'register') + '">' + t('auth.register') + '</button></div>' + note +
        '<form class="auth-form" novalidate>' + (mode === 'register' ? field('name', 'text', t('auth.name'), 'name', name) : '') +
        field('email', 'email', t('auth.email'), 'email', email) + field('password', 'password', t('auth.password'), mode === 'login' ? 'current-password' : 'new-password') +
        (mode === 'register' ? '<small class="auth-hint">' + t('auth.pwRule') + '</small>' : '') +
        '<button class="btn primary auth-go" type="submit">' + t(mode === 'login' ? 'auth.login' : 'auth.createAccount') + '</button></form>' +
        (mode === 'login' ? '<button type="button" class="link-btn auth-link" data-mode="forgot">' + t('auth.forgot') + '</button>' : '<p class="auth-small">' + t('auth.privacyNote') + '</p>');
    } else if (mode === 'forgot') {
      body = '<h1 id="authTitle">' + t('auth.forgotTitle') + '</h1><p class="auth-lead">' + t('auth.forgotLead') + '</p>' + note +
        '<form class="auth-form" novalidate>' + field('email', 'email', t('auth.email'), 'email', email) + '<button class="btn primary auth-go" type="submit">' + t('auth.sendLink') + '</button></form>' +
        '<button type="button" class="link-btn auth-link" data-mode="login">← ' + t('auth.backToLogin') + '</button>';
    } else if (mode === 'sent') {
      body = '<h1 id="authTitle">' + t('auth.sentTitle') + '</h1><p class="auth-lead">' + t('auth.sentLead') + '</p><button type="button" class="btn ghost auth-go" data-mode="login">' + t('auth.backToLogin') + '</button>';
    } else {
      body = '<h1 id="authTitle">' + t('auth.resetTitle') + '</h1><p class="auth-lead">' + t('auth.resetLead') + '</p>' + note +
        '<form class="auth-form" novalidate>' + field('password', 'password', t('auth.newPassword'), 'new-password') + '<small class="auth-hint">' + t('auth.pwRule') + '</small>' +
        '<button class="btn primary auth-go" type="submit">' + t('auth.savePassword') + '</button></form>';
    }
    if (api.isDemo() && (mode === 'login' || mode === 'register')) body += '<p class="auth-demo">' + t('auth.demoNote') + '</p>';
    card.innerHTML = head + body;
    var first = card.querySelector('input[name=name], input[name=email]:not([value]), input[name=email][value=""], input[name=password]'); if (first) first.focus();
  }
  function errorText(e) {
    var map = { wrong: 'auth.errWrong', exists: 'auth.errExists', email: 'auth.errEmail', password_short: 'auth.errShort', password_common: 'auth.errCommon', password_long: 'auth.errLong', too_many: 'auth.errTooMany', token: 'auth.errToken' };
    return t(map[e && e.code] || 'auth.errGeneral');
  }
  function ready() { document.body.classList.remove('auth-checking'); }
  setTimeout(ready, 4000);                                                // nooit eeuwig een leeg scherm
  function show(m) { mode = m || 'login'; view.hidden = false; document.body.classList.add('auth-open'); ready(); draw(); }
  function hide() { view.hidden = true; document.body.classList.remove('auth-open'); }
  // Na inloggen: alles opnieuw laden met de nieuwe sessie (eigen codes, eigen achtergrond)
  function enter() { location.replace(location.pathname); }

  card.addEventListener('click', function (e) {
    var m = e.target.closest('[data-mode]'); if (m) { mode = m.getAttribute('data-mode'); return draw(); }
    var eye = e.target.closest('[data-eye]');
    if (eye) { var inp = eye.parentNode.querySelector('input'), on = inp.type === 'password'; inp.type = on ? 'text' : 'password'; eye.setAttribute('aria-pressed', String(on)); eye.setAttribute('aria-label', t(on ? 'pw.hide' : 'pw.show')); }
  });
  card.addEventListener('change', function (e) { if (e.target.classList.contains('auth-lang')) i18n.set(e.target.value); });
  card.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, val = function (n) { var i = f.querySelector('[name=' + n + ']'); return i ? i.value.trim() : ''; }, btn = f.querySelector('.auth-go');
    var pw = (f.querySelector('[name=password]') || {}).value || '';
    if (f.querySelector('[name=email]') && !EmailCheck.valid(val('email')) || f.querySelector('[name=email]') && !val('email')) return draw(t('auth.errEmail'));
    if (f.querySelector('[name=password]') && !pw) return draw(t('auth.errPassword'));
    btn.disabled = true;
    var job = mode === 'login' ? api.auth.login({ email: val('email'), password: pw })
      : mode === 'register' ? api.auth.register({ email: val('email'), password: pw, name: val('name') })
      : mode === 'forgot' ? api.auth.forgot({ email: val('email'), lang: i18n.lang() }).then(function () { mode = 'sent'; draw(); return null; })
      : api.auth.reset({ token: resetToken, password: pw });
    job.then(function (u) { if (u) enter(); }).catch(function (err) { draw(errorText(err)); var b = card.querySelector('.auth-go'); if (b) b.disabled = false; });
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
  var m = location.search.match(/[?&]reset=([^&]+)/);
  api.available().then(function (online) {
    if (m) { resetToken = decodeURIComponent(m[1]); history.replaceState(null, '', location.pathname); return show('reset'); }
    return api.auth.me().then(function (u) { user = u; ready(); listeners.forEach(function (f) { f(u); }); }).catch(function () { show('login'); });
  });
  return { user: function () { return user; }, onUser: function (f) { listeners.push(f); if (user) f(user); }, show: show };
})();
