/* =========================================================
   SNELTOETSEN (overzicht en aan/uit: Instellingen > Sneltoetsen)
   Losse toetsen, alleen in de app en nooit tijdens het typen in een veld:
     N nieuwe QR-code · O overzicht · M mijn QR-codes · S statistieken · / zoeken in mijn QR-codes · ? dit overzicht
   Uit te zetten per account (WCAG 2.1.4), bewaard bij de voorkeuren op de server.
   ========================================================= */
var Shortcuts = (function () {
  var on = true;
  var KEYS = [['N', 'keys.k_new', 'create'], ['O', 'keys.k_home', 'home'], ['M', 'keys.k_codes', 'myCodes'], ['S', 'keys.k_stats', 'analytics'], ['/', 'keys.k_search'], ['?', 'keys.k_help']];
  function typing(el) { return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); }
  function blocked() {
    var c = document.body.classList;
    return c.contains('auth-open') || c.contains('paywall-open') || c.contains('pw-wait') || document.body.getAttribute('data-app') === 'admin' ||
      !(window.Session && Session.user()) || !!document.querySelector('dialog[open], .tour');
  }
  // Mijn QR-codes tekent zich opnieuw als de lijst binnen is: tot ~1,5 s het (nieuwe) zoekveld focussen, tenzij je al ergens anders bent
  function focusSearch(n, last) {
    var q = document.getElementById('mcQ'), a = document.activeElement;
    if (q && q !== a && (!a || a === document.body || a === last || !a.isConnected)) q.focus();
    if (n < 30) setTimeout(function () { focusSearch(n + 1, q); }, 50);
  }
  document.addEventListener('keydown', function (e) {
    if (!on || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || typing(e.target) || blocked()) return;
    var k = e.key.length === 1 ? e.key.toUpperCase() : '', hit = KEYS.filter(function (x) { return x[0] === k; })[0];
    if (!hit) return;
    e.preventDefault();
    if (hit[2]) return window.goToPage(hit[2]);
    if (k === '/') { window.goToPage('myCodes'); return focusSearch(0, null); }
    window.goToPage('settings'); if (window.openAccountTab) openAccountTab('keys');
  });
  if (window.Session && Session.onUser) Session.onUser(function () {
    if (api.account && api.account.prefs) api.account.prefs().then(function (r) { on = !r || r.keys !== false; }).catch(function () {});
  });
  return { on: function () { return on; }, set: function (v) { on = v !== false; }, list: function () { return KEYS; } };
})();
