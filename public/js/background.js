/* =========================================================
   ACHTERGROND: eigen omgeving per gebruiker (vervangt licht/donker)
   Met server: opgeslagen in het profiel (GET/PATCH /api/me). Zonder server: alleen in de browser.
   ========================================================= */
document.documentElement.setAttribute('data-theme', 'dark');
var BACKGROUNDS = [
  { id: 'optimasys',  label: 'bg.optimasys',  css: 'radial-gradient(55% 60% at 18% 12%, rgba(43,181,240,.32), transparent 70%), radial-gradient(55% 60% at 85% 90%, rgba(21,118,201,.26), transparent 70%), linear-gradient(160deg, #0b1019, #06080b)' },
  { id: 'aurora',     label: 'bg.aurora',     css: 'radial-gradient(60% 55% at 20% 20%, rgba(0,220,170,.55), transparent 70%), radial-gradient(60% 60% at 82% 28%, rgba(130,80,255,.55), transparent 70%), radial-gradient(55% 55% at 50% 100%, rgba(43,181,240,.45), transparent 70%), #060a12' },
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
    return b.image ? { bg: 'url("' + new URL(b.image, document.baseURI).href + '")', filter: 'blur(5px) brightness(.95) saturate(1.15)' } : { bg: b.css, filter: 'none' };
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
  return { get: function () { return current; }, custom: function () { return custom; }, set: set, setCustom: setCustom, cssFor: cssFor, onChange: function (f) { listeners.push(f); } };
})();
