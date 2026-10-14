/* =========================================================
   WEERGAVE (donker / licht / systeem) + ACHTERGROND: eigen omgeving per gebruiker
   Met server: opgeslagen in het profiel (GET/PATCH /api/me). Zonder server: alleen in de browser.
   ========================================================= */
/* Thema: meteen bij het laden (geen witte flits). 'system' volgt de instelling van het apparaat.
   Opgeslagen in deze browser en (met server) in je profiel, zodat het op elk apparaat hetzelfde is. */
var theme = (function () {
  var KEY = 'optimasys-theme', root = document.documentElement, listeners = [], mq = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  var pref = 'dark'; try { pref = localStorage.getItem(KEY) || 'dark'; } catch (e) {}
  function resolved() { return pref === 'system' ? (mq && mq.matches ? 'light' : 'dark') : pref === 'light' ? 'light' : 'dark'; }
  function apply() { root.setAttribute('data-theme', resolved()); listeners.forEach(function (f) { f(resolved(), pref); }); }
  function set(p, toServer) {
    pref = ['dark', 'light', 'system'].indexOf(p) >= 0 ? p : 'dark';
    try { localStorage.setItem(KEY, pref); } catch (e) {}
    apply();
    if (toServer !== false && window.api && window.Session && Session.user()) api.account.update({ theme: pref }).catch(function () {});
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (pref === 'system') apply(); });
  root.setAttribute('data-theme', resolved());
  // Knop bovenin: wisselen tussen licht en donker (het label zegt wat er gebeurt als je klikt)
  function label() {
    var b = document.getElementById('themeBtn'); if (!b || !window.i18n) return;
    var txt = t(resolved() === 'light' ? 'theme.toDark' : 'theme.toLight'); b.setAttribute('aria-label', txt); b.title = txt;
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#themeBtn')) set(resolved() === 'light' ? 'dark' : 'light'); });
  listeners.push(label);
  document.addEventListener('DOMContentLoaded', function () { label(); if (window.i18n) i18n.onChange(label); });
  setTimeout(function () { label(); if (window.i18n) i18n.onChange(label); }, 0);
  return { get: function () { return pref; }, resolved: resolved, set: set, onChange: function (f) { listeners.push(f); } };
})();
var BACKGROUNDS = [
  { id: 'optimasys',  label: 'bg.optimasys',  css: 'radial-gradient(55% 60% at 18% 12%, rgba(43,181,240,.32), transparent 70%), radial-gradient(55% 60% at 85% 90%, rgba(21,118,201,.26), transparent 70%), linear-gradient(160deg, #0b1019, #06080b)',
    light: 'radial-gradient(55% 60% at 18% 12%, rgba(43,181,240,.22), transparent 70%), radial-gradient(55% 60% at 85% 90%, rgba(37,99,235,.14), transparent 70%), linear-gradient(160deg, #f7fbfe, #e8eef6)' },
  { id: 'aurora',     label: 'bg.aurora',     css: 'radial-gradient(60% 55% at 20% 20%, rgba(0,220,170,.55), transparent 70%), radial-gradient(60% 60% at 82% 28%, rgba(130,80,255,.55), transparent 70%), radial-gradient(55% 55% at 50% 100%, rgba(43,181,240,.45), transparent 70%), #060a12',
    light: 'radial-gradient(60% 55% at 20% 20%, rgba(0,220,170,.22), transparent 70%), radial-gradient(60% 60% at 82% 28%, rgba(130,80,255,.2), transparent 70%), radial-gradient(55% 55% at 50% 100%, rgba(43,181,240,.2), transparent 70%), #f5f7fb' },
  { id: 'city',       label: 'bg.city',       image: 'assets/qr-types/links.jpg' },
  { id: 'mountains',  label: 'bg.mountains',  image: 'assets/qr-types/images.jpg' },
  { id: 'office',     label: 'bg.office',     image: 'assets/qr-types/business.jpg' },
  { id: 'cafe',       label: 'bg.cafe',       image: 'assets/qr-types/wifi.jpg' },
  { id: 'restaurant', label: 'bg.restaurant', image: 'assets/qr-types/menu.jpg' }
];
var background = (function () {
  var KEY = 'optimasys-background', KEY_CUSTOM = 'optimasys-background-custom', root = document.documentElement, listeners = [];
  var current = 'optimasys', custom = null;
  try { current = localStorage.getItem(KEY) || current; custom = localStorage.getItem(KEY_CUSTOM); } catch (e) {}
  function cssFor(id) {
    if (id === 'custom' && custom) return { bg: 'url("' + custom + '")', filter: 'blur(4px) brightness(.9)' };
    var b = BACKGROUNDS.filter(function (x) { return x.id === id; })[0] || BACKGROUNDS[0];
    var light = theme.resolved() === 'light';
    return b.image ? { bg: 'url("' + new URL(b.image, document.baseURI).href + '")', filter: light ? 'blur(6px) brightness(1.08) saturate(1.05)' : 'blur(5px) brightness(.95) saturate(1.15)' } : { bg: light && b.light ? b.light : b.css, filter: 'none' };
  }
  function apply() { var c = cssFor(current); root.style.setProperty('--wallpaper', c.bg); root.style.setProperty('--wp-filter', c.filter); listeners.forEach(function (f) { f(current); }); }
  function save(patch) { api.available().then(function (on) { if (on) api.updateMe(patch).catch(function () {}); }); }   // profiel op de server
  function set(id) { current = id; try { localStorage.setItem(KEY, id); } catch (e) {} apply(); save({ background: id }); }
  function setCustom(dataUrl) { custom = dataUrl; try { localStorage.setItem(KEY_CUSTOM, dataUrl); } catch (e) {} current = 'custom'; try { localStorage.setItem(KEY, 'custom'); } catch (e) {} apply(); save({ background: 'custom', customBackground: dataUrl }); }
  // Bij het starten: keuze uit het profiel halen (wint van de browser-kopie)
  api.available().then(function (on) {
    if (!on) return;
    api.getMe().then(function (me) {
      if (me.customBackground) { custom = me.customBackground; try { localStorage.setItem(KEY_CUSTOM, custom); } catch (e) {} }
      if (me.background && me.background !== current) { current = me.background; try { localStorage.setItem(KEY, current); } catch (e) {} }
      apply();
    }).catch(function () {});
  });
  apply();
  theme.onChange(function () { apply(); });                          // licht thema: lichte versie van de achtergrond
  return { get: function () { return current; }, custom: function () { return custom; }, set: set, setCustom: setCustom, cssFor: cssFor, onChange: function (f) { listeners.push(f); } };
})();
