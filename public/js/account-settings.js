/* =========================================================
   MIJN ACCOUNT (met de echte server)
   Links een menu met onderdelen, rechts het gekozen onderdeel:
   - Profiel: naam wijzigen, e-mailadres zien
   - Beveiliging: wachtwoord wijzigen, uitloggen op andere apparaten
   - Voorkeuren: taal
   - Achtergrond: zie account.js
   - Gegevens & privacy: downloaden (AVG) en account verwijderen (met wachtwoord)
   Bovenaan: naam, e-mail, lid sinds en de cijfers (met links naar Mijn QR-codes en Statistieken).
   In de online demo: alleen Profiel (uitleg) en Achtergrond (er is geen echt account).
   ========================================================= */
(function () {
  var box = document.getElementById('acctCards'), menu = document.getElementById('acctMenu'), stats = document.getElementById('acctStats');
  var bgSection = document.getElementById('bgSection'), user = null, sum = null, tab = 'profile';
  var SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
  var TABS = [
    { id: 'profile',    label: 'acct.profile',    icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.4-4 4.4-6 8-6s6.6 2 8 6"/>' },
    { id: 'security',   label: 'acct.security',   icon: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', server: true },
    { id: 'prefs',      label: 'acct.prefsTitle', icon: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>', server: true },
    { id: 'background', label: 'account.background', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/>' },
    { id: 'data',       label: 'acct.dataTitle',  icon: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', server: true }
  ];
  function tabs() { return TABS.filter(function (x) { return !x.server || !api.isDemo(); }); }
  function loadSummary() { if (!user || api.isDemo()) return; api.account.summary().then(function (x) { sum = x; draw(); }).catch(function () {}); }
  function initials(n) { var w = String(n || '').trim().split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); }

  function drawMenu() {
    menu.innerHTML = tabs().map(function (x) {
      var on = x.id === tab;
      return '<button type="button" role="tab" id="acctTab-' + x.id + '" data-tab="' + x.id + '" aria-selected="' + on + '" aria-controls="' + (x.id === 'background' ? 'bgSection' : 'acctCards') + '" tabindex="' + (on ? 0 : -1) + '">' + SVG + x.icon + '</svg><span>' + t(x.label) + '</span></button>';
    }).join('') +
    '<span class="acct-menu-line" aria-hidden="true"></span>' +
    '<button type="button" class="acct-out" data-page="logout">' + SVG + '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg><span>' + t('nav.logout') + '</span></button>';
  }
  function head() {
    document.getElementById('acctAvatar').textContent = initials(user.name || user.email);
    document.getElementById('acctName').textContent = user.name || user.email;
    var since = sum && sum.createdAt ? new Date(sum.createdAt).toLocaleDateString(i18n.lang(), { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    var em = document.getElementById('acctEmail'); em.removeAttribute('data-i18n');
    em.textContent = user.email;
    var se = document.getElementById('acctSince'); se.textContent = since ? t('acct.since', { date: since }) : ''; se.hidden = !since;
    var stat = function (v, k, page) { return '<a href="#" class="acct-stat" data-goto="' + page + '"><b>' + (v == null ? '–' : i18n.fmt.num(v)) + '</b><small>' + t(k) + '</small></a>'; };
    stats.innerHTML = api.isDemo() ? '' : stat(sum && sum.codes, 'acct.codes', 'myCodes') + stat(sum && sum.scans, 'acct.scansTotal', 'analytics') + stat(sum && sum.scans30, 'acct.scans30', 'analytics');
  }
  function panel(m) {
    var note = function (k) { return m[k] ? '<p class="acct-msg ' + m[k][1] + '" role="status">' + esc(m[k][0]) + '</p>' : ''; };
    var field = function (label, input) { return '<label class="auth-f"><span>' + label + '</span><span class="auth-in">' + input + '</span></label>'; };
    if (tab === 'profile') return '<div class="glass bg-card acct"><h2>' + t('acct.profile') + '</h2>' +
      (api.isDemo() ? '<p>' + t('auth.demoAccount') + '</p></div>' :
      '<p>' + t('acct.profileLead') + '</p>' +
      '<form data-form="name"><div class="acct-grid">' + field(t('auth.name'), '<input name="name" value="' + esc(user.name) + '" maxlength="80" autocomplete="name">') +
      field(t('auth.email'), '<input value="' + esc(user.email) + '" disabled>') + '</div>' +
      '<div class="acct-actions"><button class="btn primary" type="submit">' + t('acct.save') + '</button></div></form>' + note('name') + '</div>');
    if (tab === 'security') return '<div class="glass bg-card acct"><h2>' + t('acct.passwordTitle') + '</h2><p>' + t('acct.passwordLead') + '</p>' +
      '<form data-form="password"><div class="acct-grid">' +
      field(t('acct.current'), '<input name="current" type="password" autocomplete="current-password" required>') +
      field(t('auth.newPassword'), '<input name="password" type="password" autocomplete="new-password" minlength="8" required>') + '</div>' +
      '<small class="auth-hint">' + t('auth.pwRule') + '</small>' +
      '<div class="acct-actions"><button class="btn primary" type="submit">' + t('auth.savePassword') + '</button></div></form>' + note('password') + '</div>' +
      '<div class="glass bg-card acct"><h2>' + t('acct.devicesTitle') + '</h2>' +
      '<div class="acct-dev"><p>' + t('acct.devices', { n: sum ? sum.sessions : 1 }) + '</p>' + (sum && sum.sessions > 1 ? '<button type="button" class="btn ghost" data-logout-others>' + t('acct.logoutOthers') + '</button>' : '') + '</div>' + note('devices') + '</div>';
    if (tab === 'prefs') return '<div class="glass bg-card acct"><h2>' + t('acct.prefsTitle') + '</h2><p>' + t('acct.prefsLead') + '</p>' +
      field(t('acct.language'), '<select id="acctLang">' + LANGUAGES.map(function (l) { return '<option value="' + l.code + '"' + (l.code === i18n.lang() ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select>').replace('class="auth-f"', 'class="auth-f acct-lang"') + '</div>';
    if (tab === 'data') return '<div class="glass bg-card acct"><h2>' + t('acct.dataTitle') + '</h2><p>' + t('acct.dataLead') + '</p>' +
      '<div class="acct-btns"><a class="btn ghost" href="' + api.account.exportUrl + '" download>' + t('acct.download') + '</a>' +
      '<button type="button" class="btn ghost danger-ghost" data-delete>' + t('acct.delete') + '</button></div>' + note('delete') + '</div>';
    return '';
  }
  function draw(msg) {
    if (!user) { box.innerHTML = ''; menu.innerHTML = ''; stats.innerHTML = ''; return; }
    if (!tabs().some(function (x) { return x.id === tab; })) tab = 'profile';
    head(); drawMenu();
    var isBg = tab === 'background';
    bgSection.hidden = !isBg; box.hidden = isBg;
    (isBg ? bgSection : box).setAttribute('aria-labelledby', 'acctTab-' + tab);
    box.innerHTML = isBg ? '' : panel(msg || {});
  }
  function open(id, focus) {
    tab = id; draw();
    if (focus) { var b = document.getElementById('acctTab-' + id); if (b) b.focus(); }
  }
  window.openAccountTab = function (id) { open(id); };

  function err(e) { return e && e.code === 'wrong' ? t('acct.wrongCurrent') : e && /^password_/.test(e.code || '') ? t({ password_short: 'auth.errShort', password_common: 'auth.errCommon', password_long: 'auth.errLong' }[e.code]) : e && e.code === 'too_many' ? t('auth.errTooMany') : t('auth.errGeneral'); }

  menu.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) open(b.getAttribute('data-tab')); });
  menu.addEventListener('keydown', function (e) {   // pijltjes: naar het vorige/volgende onderdeel
    var ids = tabs().map(function (x) { return x.id; }), i = ids.indexOf(tab), n = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = ids[(i + 1) % ids.length];
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = ids[(i - 1 + ids.length) % ids.length];
    if (e.key === 'Home') n = ids[0];
    if (e.key === 'End') n = ids[ids.length - 1];
    if (n && e.target.closest('[data-tab]')) { e.preventDefault(); open(n, true); }
  });
  stats.addEventListener('click', function (e) { var go = e.target.closest('[data-goto]'); if (go) { e.preventDefault(); window.goToPage(go.getAttribute('data-goto')); } });

  box.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, kind = f.getAttribute('data-form'), btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    if (kind === 'name') {
      api.account.update({ name: f.name.value }).then(function (u) { user = u; draw({ name: [t('acct.saved'), 'ok'] }); })
        .catch(function (x) { draw({ name: [err(x), 'bad'] }); });
    }
    if (kind === 'password') {
      api.account.password({ current: f.current.value, password: f.password.value }).then(function () { if (sum) sum.sessions = 1; draw({ password: [t('acct.passwordSaved'), 'ok'] }); })
        .catch(function (x) { draw({ password: [err(x), 'bad'] }); });
    }
  });
  box.addEventListener('change', function (e) { if (e.target.id === 'acctLang') i18n.set(e.target.value); });
  box.addEventListener('click', function (e) {
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
  Session.onUser(function (u) { user = u; sum = null; tab = 'profile'; draw(); loadSummary(); });
  // Elke keer dat je Mijn account opent: verse cijfers
  document.addEventListener('click', function (e) { if (e.target.closest('[data-page="account"], #bgBtn')) loadSummary(); });
  i18n.onChange(function () { draw(); });
})();
