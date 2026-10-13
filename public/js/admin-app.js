/* =========================================================
   BEHEER-OMGEVING (admin.html, adres /admin)
   Eigen schil: menu (Dashboard, Alle QR-codes, Gebruikers, Mijn account), taal, wie er is ingelogd.
   Inloggen gaat via session.js (zelfde inlogscherm, maar alleen admins komen erin).
   De pagina's zelf: admin.js (dashboard, codes) en customers.js (gebruikers).
   Adres per pagina (#/dashboard, #/codes, #/users, #/account): verversen houdt je op dezelfde pagina.
   ========================================================= */
(function () {
  var ROUTES = { dashboard: ['adminDash', 'nav.adminDash'], codes: ['adminCodes', 'nav.adminCodes'], users: ['customers', 'nav.users'], account: ['adminAccount', 'adminApp.account'] };
  var BY_PAGE = {}; Object.keys(ROUTES).forEach(function (r) { BY_PAGE[ROUTES[r][0]] = r; });
  var app = document.getElementById('admApp'), me = null, route = 'dashboard';

  function current() { var r = (location.hash.match(/^#\/(\w+)/) || [])[1]; return ROUTES[r] ? r : 'dashboard'; }
  function show() {
    route = current();
    document.querySelectorAll('.adm-view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== route; });
    document.querySelectorAll('.adm-nav [data-route]').forEach(function (a) { if (a.getAttribute('data-route') === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.getElementById('admTitle').textContent = t(ROUTES[route][1]);
    document.title = t(ROUTES[route][1]) + ' · Optimasys QR ' + t('adminApp.badge');
    app.classList.remove('drawer');
    if (me) document.dispatchEvent(new CustomEvent('pagechange', { detail: ROUTES[route][0] }));
    window.scrollTo(0, 0);
  }
  // Gebruikt door admin.js ("Alles bekijken", "Klant uitnodigen")
  window.goToPage = function (page) { var r = BY_PAGE[page] || 'dashboard'; if (location.hash === '#/' + r) show(); else location.hash = '#/' + r; };
  window.addEventListener('hashchange', show);

  // Mobiel: menu als lade
  document.getElementById('admMenu').addEventListener('click', function () { app.classList.add('drawer'); });
  document.getElementById('admScrim').addEventListener('click', function () { app.classList.remove('drawer'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') app.classList.remove('drawer'); });

  // Taal
  var langSel = document.getElementById('admLang');
  langSel.innerHTML = LANGUAGES.map(function (l) { return '<option value="' + l.code + '">' + l.name + '</option>'; }).join('');
  langSel.addEventListener('change', function () { i18n.set(langSel.value); });

  /* ---------- Wie is ingelogd (onderaan het menu) ---------- */
  function roleName(u) { return t(u.superAdmin ? 'adm.rSuper' : 'adm.rAdmin'); }
  function drawMe() {
    var box = document.getElementById('admMe'); if (!box || !me) return;
    box.innerHTML = Admin.avatar(me.name, me.email) + '<span class="adm-me-who"><b>' + esc(me.name || me.email) + '</b><small>' + roleName(me) + '</small></span>' +
      '<a href="#" class="adm-out" data-page="logout" title="' + esc(t('nav.logout')) + '" aria-label="' + esc(t('nav.logout')) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 17l5-5-5-5M19 12H9"/></svg></a>';
  }

  /* ---------- Mijn account (beheer): naam en wachtwoord ---------- */
  var acct = document.getElementById('adminAccountPage'), msg = {};
  function note(k) { return msg[k] ? '<p class="acct-msg ' + msg[k][1] + '" role="status">' + esc(msg[k][0]) + '</p>' : ''; }
  function drawAccount() {
    if (!acct || !me) return;
    acct.innerHTML = '<header class="help-head ad-head"><div><h2>' + t('adminApp.account') + '</h2><p>' + t('adminApp.accountLead') + '</p></div></header>' +
      '<div class="adm-acct">' +
        '<section class="glass ad-card adm-id">' + Admin.avatar(me.name, me.email, 'ad-av xl') + '<h3>' + esc(me.name || me.email) + '</h3><p>' + esc(me.email) + '</p>' +
          '<span class="ad-role ' + (me.superAdmin ? 'super' : 'admin') + '">' + roleName(me) + '</span>' +
          '<p class="adm-id-note">' + t(me.superAdmin ? 'adminApp.superNote' : 'adminApp.adminNote') + '</p></section>' +
        '<div class="adm-acct-forms">' +
          '<form class="glass ad-card" data-form="name" novalidate><h3>' + t('acct.profile') + '</h3>' +
            '<label class="auth-f"><span>' + t('auth.name') + '</span><span class="auth-in"><input name="name" maxlength="80" autocomplete="name" value="' + esc(me.name || '') + '"></span></label>' +
            note('name') + '<button class="btn primary" type="submit">' + t('acct.save') + '</button></form>' +
          '<form class="glass ad-card" data-form="pw" novalidate><h3>' + t('adminApp.pwTitle') + '</h3>' +
            '<input class="sr-only" type="text" name="username" autocomplete="username" value="' + esc(me.email) + '" tabindex="-1" aria-hidden="true">' +
            '<label class="auth-f"><span>' + t('adminApp.pwCurrent') + '</span><span class="auth-in"><input name="current" type="password" autocomplete="current-password"></span></label>' +
            '<label class="auth-f"><span>' + t('auth.newPassword') + '</span><span class="auth-in"><input name="password" type="password" autocomplete="new-password" data-pw-rules="admPwRules" aria-describedby="admPwRules"></span></label>' +
            PasswordRules.list('admPwRules') + note('pw') + '<button class="btn primary" type="submit">' + t('adminApp.pwSave') + '</button></form>' +
        '</div></div>';
  }
  if (acct) acct.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, kind = f.getAttribute('data-form'), btn = f.querySelector('button[type=submit]');
    var val = function (n) { return (f.querySelector('[name=' + n + ']') || {}).value || ''; };
    var done = function (text, cls) { msg[kind] = [text, cls]; drawAccount(); };
    if (kind === 'name') {
      if (!val('name').trim()) return done(t('acct.errRequired'), 'bad');
      btn.disabled = true;
      return api.account.update({ name: val('name').trim() }).then(function (u) { me = Object.assign(me, { name: u.name }); drawMe(); done(t('acct.saved'), 'ok'); }).catch(function () { done(t('auth.errGeneral'), 'bad'); });
    }
    var prob = PasswordRules.problem(val('password'));
    if (!val('current')) return done(t('auth.errPassword'), 'bad');
    if (prob) return done(t(PasswordRules.errorKey('password_' + prob)), 'bad');
    btn.disabled = true;
    api.account.password({ current: val('current'), password: val('password') })
      .then(function () { done(t('adminApp.pwSaved'), 'ok'); })
      .catch(function (x) { done(t(x && x.code === 'wrong' ? 'adminApp.pwWrong' : x && x.code === 'too_many' ? 'auth.errTooMany' : 'auth.errGeneral'), 'bad'); });
  });

  Session.onUser(function (u) {
    me = u; document.body.classList.add('adm-in');
    setTimeout(function () { drawMe(); drawAccount(); show(); }, 0);   // eerst laten ook admin.js en customers.js weten wie er is
  });
  document.addEventListener('pagechange', function (e) { if (e.detail === 'adminAccount') { msg = {}; drawAccount(); } });
  i18n.onChange(function (code) { langSel.value = code; drawMe(); drawAccount(); if (me) show(); else document.getElementById('admTitle').textContent = t(ROUTES[current()][1]); });
  api.available();
  i18n.set(i18n.detect());
})();
