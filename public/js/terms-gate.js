/* =========================================================
   AKKOORD MET DE VOORWAARDEN (één keer)
   Wie zich zelf registreert, vinkt het al aan bij "Account maken". Wie via Google of Microsoft binnenkomt, of een account
   van het team kreeg, ziet na het inloggen eerst dit scherm: 18+ (of toestemming van een ouder/voogd) en akkoord met de
   Terms en de Privacy Policy (Terms punt 1 en 3). Pas daarna de app (of het pakket-scherm).
   Niet voor het team (beheer), niet voor teamleden (het account is van de eigenaar) en niet in de online demo.
   ========================================================= */
var TermsGate = (function () {
  var box = null, state = 'unknown', err = false;   // unknown → checking → open | ok
  function skip() {
    var u = Session.user();
    return !u || u.admin || (window.Team && Team.member && Team.member()) || (api.isDemo && api.isDemo()) || !api.account || !api.account.terms;
  }
  function draw() {
    if (!box) { box = document.createElement('div'); box.className = 'paywall terms-gate'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'tgTitle'); document.body.appendChild(box); }
    box.innerHTML = '<div class="pw-inner tg-inner">' +
      '<div class="pw-top"><span class="auth-logo"><img class="logo-mark" src="icons/logo-badge.png" alt=""><b>QR-<small>Codex</small></b><em class="auth-by">by Optimasys</em></span>' +
      '<button type="button" class="link-btn" data-tg-logout>' + esc(t('nav.logout')) + '</button></div>' +
      '<h1 id="tgTitle">' + esc(t('terms.title')) + '</h1><p class="pw-lead">' + esc(t('terms.lead')) + '</p>' +
      (err ? '<p class="auth-msg bad" role="alert">' + esc(t('terms.err')) + '</p>' : '') +
      '<form data-tg-form>' + window.TermsBox(false) + '<button type="submit" class="btn primary pw-go">' + esc(t('terms.go')) + '</button></form></div>';
  }
  function open() { state = 'open'; draw(); document.body.classList.add('paywall-open'); var c = box.querySelector('input'); if (c) c.focus(); }
  function close() { if (box) box.remove(); box = null; document.body.classList.remove('paywall-open'); }
  function done() { state = 'ok'; close(); document.dispatchEvent(new CustomEvent('terms-ok')); }
  function check() {
    if (skip()) return done();
    state = 'checking';
    api.account.terms().then(function (r) { if (r && r.ok) done(); else open(); }, function () { done(); });
  }
  document.addEventListener('click', function (e) {
    if (!box || !box.contains(e.target)) return;
    var lg = e.target.closest('[data-legal]'); if (lg && window.Legal) { e.preventDefault(); return Legal.dialog(lg.getAttribute('data-legal')); }
    if (e.target.closest('[data-tg-logout]')) { api.auth.logout().catch(function () {}).then(function () { location.replace(location.pathname); }); }
  });
  document.addEventListener('submit', function (e) {
    if (!box || !e.target.closest('[data-tg-form]')) return;
    e.preventDefault();
    if (!box.querySelector('[name=accept]').checked) { err = true; return draw(); }
    api.account.acceptTerms().then(done, function () { err = true; draw(); });
  });
  if (window.Session && Session.onUser) Session.onUser(function () { state = 'unknown'; setTimeout(check, 200); });
  if (window.i18n) i18n.onChange(function () { if (box) draw(); });
  /** Nog bezig of nog niet akkoord: dan wacht het pakket-scherm */
  return { waiting: function () { return state !== 'ok'; } };
})();
