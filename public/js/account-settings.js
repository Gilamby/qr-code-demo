/* =========================================================
   MIJN ACCOUNT (met de echte server)
   - Naam wijzigen, e-mailadres zien
   - Wachtwoord wijzigen (andere apparaten worden uitgelogd)
   - Overzicht: aantal QR-codes, scans, lid sinds (met links naar Mijn QR-codes en Statistieken)
   - Taal, uitloggen op andere apparaten
   - Mijn gegevens downloaden (AVG) en account verwijderen (AVG, met wachtwoord)
   In de online demo: alleen de achtergrond (er is geen account).
   ========================================================= */
(function () {
  var box = document.getElementById('acctCards'), user = null, sum = null;
  function loadSummary() { if (!user || api.isDemo()) return; api.account.summary().then(function (x) { sum = x; draw(); }).catch(function () {}); }
  function initials(n) { var w = String(n || '').trim().split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); }
  function head() {
    document.getElementById('acctAvatar').textContent = initials(user.name || user.email);
    document.getElementById('acctName').textContent = user.name || user.email;
    var em = document.getElementById('acctEmail'); em.removeAttribute('data-i18n'); em.textContent = user.email;
  }
  function draw(msg) {
    if (!user) { box.innerHTML = ''; return; }
    head();
    if (api.isDemo()) { box.innerHTML = '<div class="glass bg-card acct"><p>' + t('auth.demoAccount') + '</p></div>'; return; }   // demo: geen echte accountgegevens
    var m = msg || {};
    var note = function (k) { return m[k] ? '<p class="acct-msg ' + m[k][1] + '" role="status">' + esc(m[k][0]) + '</p>' : ''; };
    var stat = function (v, k, page) { return '<a href="#" class="acct-stat" data-goto="' + page + '"><b>' + (v == null ? '–' : i18n.fmt.num(v)) + '</b><small>' + t(k) + '</small></a>'; };
    var since = sum && sum.createdAt ? new Date(sum.createdAt).toLocaleDateString(i18n.lang(), { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    box.innerHTML =
      '<div class="glass bg-card acct"><h2>' + t('acct.overview') + '</h2>' +
        '<div class="acct-stats">' + stat(sum && sum.codes, 'acct.codes', 'myCodes') + stat(sum && sum.scans, 'acct.scansTotal', 'analytics') + stat(sum && sum.scans30, 'acct.scans30', 'analytics') + '</div>' +
        (since ? '<p class="acct-since">' + t('acct.since', { date: esc(since) }) + '</p>' : '') + '</div>' +
      '<div class="glass bg-card acct"><h2>' + t('acct.profile') + '</h2>' +
        '<form data-form="name" class="acct-row"><label class="auth-f"><span>' + t('auth.name') + '</span><span class="auth-in"><input name="name" value="' + esc(user.name) + '" maxlength="80" autocomplete="name"></span></label>' +
        '<label class="auth-f"><span>' + t('auth.email') + '</span><span class="auth-in"><input value="' + esc(user.email) + '" disabled></span></label>' +
        '<button class="btn ghost" type="submit">' + t('acct.save') + '</button></form>' + note('name') + '</div>' +
      '<div class="glass bg-card acct"><h2>' + t('acct.passwordTitle') + '</h2><p>' + t('acct.passwordLead') + '</p>' +
        '<form data-form="password" class="acct-row">' +
        '<label class="auth-f"><span>' + t('acct.current') + '</span><span class="auth-in"><input name="current" type="password" autocomplete="current-password" required></span></label>' +
        '<label class="auth-f"><span>' + t('auth.newPassword') + '</span><span class="auth-in"><input name="password" type="password" autocomplete="new-password" minlength="8" required></span></label>' +
        '<button class="btn ghost" type="submit">' + t('auth.savePassword') + '</button></form><small class="auth-hint">' + t('auth.pwRule') + '</small>' + note('password') + '</div>' +
      '<div class="glass bg-card acct"><h2>' + t('acct.prefsTitle') + '</h2>' +
        '<label class="auth-f acct-lang"><span>' + t('acct.language') + '</span><span class="auth-in"><select id="acctLang">' + LANGUAGES.map(function (l) { return '<option value="' + l.code + '"' + (l.code === i18n.lang() ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></span></label>' +
        '<div class="acct-dev"><p>' + t('acct.devices', { n: sum ? sum.sessions : 1 }) + '</p>' + (sum && sum.sessions > 1 ? '<button type="button" class="btn ghost" data-logout-others>' + t('acct.logoutOthers') + '</button>' : '') + '</div>' + note('devices') + '</div>' +
      '<div class="glass bg-card acct"><h2>' + t('acct.dataTitle') + '</h2><p>' + t('acct.dataLead') + '</p>' +
        '<div class="acct-btns"><a class="btn ghost" href="' + api.account.exportUrl + '" download>' + t('acct.download') + '</a>' +
        '<button type="button" class="btn ghost danger-ghost" data-delete>' + t('acct.delete') + '</button></div>' + note('delete') + '</div>';
  }
  function err(e) { return e && e.code === 'wrong' ? t('acct.wrongCurrent') : e && /^password_/.test(e.code || '') ? t({ password_short: 'auth.errShort', password_common: 'auth.errCommon', password_long: 'auth.errLong' }[e.code]) : e && e.code === 'too_many' ? t('auth.errTooMany') : t('auth.errGeneral'); }

  box.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, kind = f.getAttribute('data-form'), btn = f.querySelector('button'); btn.disabled = true;
    if (kind === 'name') {
      api.account.update({ name: f.name.value }).then(function (u) { user = u; draw({ name: [t('acct.saved'), 'ok'] }); })
        .catch(function (x) { draw({ name: [err(x), 'bad'] }); });
    }
    if (kind === 'password') {
      api.account.password({ current: f.current.value, password: f.password.value }).then(function () { draw({ password: [t('acct.passwordSaved'), 'ok'] }); })
        .catch(function (x) { draw({ password: [err(x), 'bad'] }); });
    }
  });
  box.addEventListener('change', function (e) { if (e.target.id === 'acctLang') i18n.set(e.target.value); });
  box.addEventListener('click', function (e) {
    var go = e.target.closest('[data-goto]'); if (go) { e.preventDefault(); window.goToPage(go.getAttribute('data-goto')); return; }
    if (e.target.closest('[data-logout-others]')) {
      api.account.logoutOthers().then(function () { sum.sessions = 1; draw({ devices: [t('acct.loggedOutOthers'), 'ok'] }); }).catch(function (x) { draw({ devices: [err(x), 'bad'] }); });
    }
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
  Session.onUser(function (u) { user = u; sum = null; draw(); loadSummary(); });
  // Elke keer dat je Mijn account opent: verse cijfers
  document.addEventListener('click', function (e) { if (e.target.closest('[data-page="account"], #bgBtn')) loadSummary(); });
  i18n.onChange(function () { draw(); });
})();
