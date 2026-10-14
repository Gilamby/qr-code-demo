/* =========================================================
   WEERGAVE (donker / licht / systeem) + ACHTERGROND: eigen omgeving per gebruiker
   Met server: opgeslagen in het profiel (GET/PATCH /api/me). Zonder server: alleen in de browser.
   ========================================================= */
/* Thema: meteen bij het laden (geen witte flits). 'system' volgt de instelling van het apparaat.
   Opgeslagen in deze browser en (met server) in je profiel, zodat het op elk apparaat hetzelfde is. */
var theme = (function () {
  var KEY = 'optimasys-theme', root = document.documentElement, listeners = [], mq = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  // Feedback 14 okt: geen licht thema meer nodig (je kiest al een eigen achtergrond). De app is altijd donker.
  var pref = 'dark'; try { localStorage.removeItem(KEY); } catch (e) {}
  function resolved() { return pref === 'system' ? (mq && mq.matches ? 'light' : 'dark') : pref === 'light' ? 'light' : 'dark'; }
  function apply() { root.setAttribute('data-theme', resolved()); listeners.forEach(function (f) { f(resolved(), pref); }); }
  function set(p, toServer) {
    pref = 'dark';
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
  // Bewegend: eigen 3D-animaties (three.js, wallpaper-anim.js). css = stilstaand beeld tijdens het laden of zonder WebGL
  { id: 'tide',    label: 'bg.tide',    anim: 'tide',    css: 'radial-gradient(80% 50% at 50% 75%, rgba(43,181,240,.22), transparent 70%), #070a12' }
];
var background = (function () {
  var KEY = 'optimasys-background', KEY_CUSTOM = 'optimasys-background-custom', root = document.documentElement, listeners = [];
  var current = 'optimasys', custom = null;
  try { current = localStorage.getItem(KEY) || current; custom = localStorage.getItem(KEY_CUSTOM); } catch (e) {}
  // Oude achtergronden (foto's) zijn vervangen door animaties
  // Rustig voor klanten: alleen Golfveld bleef over (feedback 14 okt); oude keuzes gaan daarheen
  var LEGACY = { city: 'tide', mountains: 'tide', office: 'tide', cafe: 'tide', restaurant: 'tide', orbit: 'tide', network: 'tide', flow: 'tide', waves: 'tide', mist: 'tide', galaxy: 'tide', ribbons: 'tide', sphere: 'tide', fluid: 'tide' };
  var hidden = [];                                               // verborgen standaard-achtergronden (Mijn account)
  var media = [], video = null;
  function mediaOf(id) { return /^media:/.test(id) ? media.filter(function (m) { return 'media:' + m.id === id; })[0] : null; }
  function mediaUrl(m) { return 'api/account/media/' + encodeURIComponent(m.id); }
  function cssFor(id) {
    id = LEGACY[id] || id;
    if (id === 'custom' && custom) return { bg: 'url("' + custom + '")', filter: 'blur(4px) brightness(.9)' };
    var m = mediaOf(id);
    if (m) return m.kind === 'image' ? { bg: 'url("' + new URL(mediaUrl(m), document.baseURI).href + '")', filter: 'blur(4px) brightness(.9)' } : { bg: 'none', filter: 'none', video: mediaUrl(m) };
    var b = BACKGROUNDS.filter(function (x) { return x.id === id; })[0] || BACKGROUNDS[0];
    var light = theme.resolved() === 'light';
    return b.image ? { bg: 'url("' + new URL(b.image, document.baseURI).href + '")', filter: light ? 'blur(6px) brightness(1.08) saturate(1.05)' : 'blur(5px) brightness(.95) saturate(1.15)' } : { bg: light && b.light ? b.light : b.css, filter: 'none' };
  }
  function apply() {
    var id = LEGACY[current] || current, c = cssFor(id), b = BACKGROUNDS.filter(function (x) { return x.id === id; })[0];
    root.style.setProperty('--wallpaper', c.bg); root.style.setProperty('--wp-filter', c.filter);
    if (window.WallAnim) WallAnim.show(b && b.anim ? b.anim : null);
    // Eigen video: één <video> achter de app, zonder geluid, in een lus. Kan hij niet laden: de standaard-achtergrond blijft zichtbaar.
    if (c.video) {
      if (!video) { video = document.createElement('video'); video.className = 'wp-video'; video.muted = true; video.loop = true; video.autoplay = true; video.playsInline = true; video.setAttribute('aria-hidden', 'true'); document.body.insertBefore(video, document.body.firstChild);
        video.addEventListener('error', function () { video.hidden = true; root.style.setProperty('--wallpaper', BACKGROUNDS[0].css); }); }
      if (video.getAttribute('src') !== c.video) video.src = c.video;
      video.hidden = false; var pl = video.play(); if (pl && pl.catch) pl.catch(function () {});
    } else if (video) { video.pause(); video.removeAttribute('src'); video.load(); video.hidden = true; }
    listeners.forEach(function (f) { f(current); });
  }
  document.addEventListener('visibilitychange', function () { if (video && !video.hidden) { if (document.hidden) video.pause(); else video.play().catch(function () {}); } });
  function save(patch) { api.available().then(function (on) { if (on) api.updateMe(patch).catch(function () {}); }); }   // profiel op de server
  function set(id) { current = id; try { localStorage.setItem(KEY, id); } catch (e) {} apply(); save({ background: id }); }
  function setCustom(dataUrl) { custom = dataUrl; try { localStorage.setItem(KEY_CUSTOM, dataUrl); } catch (e) {} current = 'custom'; try { localStorage.setItem(KEY, 'custom'); } catch (e) {} apply(); save({ background: 'custom', customBackground: dataUrl }); }
  // Bij het starten: keuze uit het profiel halen (wint van de browser-kopie)
  api.available().then(function (on) {
    if (!on) return;
    api.getMe().then(function (me) {
      if (me.customBackground) { custom = me.customBackground; try { localStorage.setItem(KEY_CUSTOM, custom); } catch (e) {} }
      media = me.media || []; hidden = me.hiddenBackgrounds || [];
      if (me.background && me.background !== current) { current = me.background; try { localStorage.setItem(KEY, current); } catch (e) {} }
      apply();
    }).catch(function () {});
  });
  apply();
  theme.onChange(function () { apply(); });                          // licht thema: lichte versie van de achtergrond
  // Na inloggen/uitloggen: de lijst met eigen foto's/video's opnieuw ophalen
  function reload() { return api.getMe().then(function (me) { media = me.media || []; hidden = me.hiddenBackgrounds || []; if (me.background) { current = me.background; try { localStorage.setItem(KEY, current); } catch (e) {} } apply(); }).catch(function () {}); }
  return { get: function () { return LEGACY[current] || current; }, custom: function () { return custom; }, set: set, setCustom: setCustom, cssFor: cssFor, onChange: function (f) { listeners.push(f); },
    media: function () { return media; }, setMedia: function (list) { media = list || []; apply(); }, mediaUrl: mediaUrl, reload: reload,
    hidden: function () { return hidden; },
    // Standaard-achtergrond verbergen/terughalen (Optimasys kan niet weg). Stond hij aan: terug naar Optimasys.
    setHidden: function (list) {
      hidden = list.filter(function (id) { return id !== 'optimasys'; });
      if (hidden.indexOf(LEGACY[current] || current) >= 0) set('optimasys');
      api.available().then(function (on) { if (on) api.updateMe({ hiddenBackgrounds: hidden }).catch(function () {}); }); listeners.forEach(function (f) { f(current); });
    },
    // Oude eigen foto ("Jouw foto") weghalen
    removeCustom: function () { custom = null; try { localStorage.removeItem(KEY_CUSTOM); } catch (e) {} if (current === 'custom') set('optimasys'); save({ customBackground: null }); listeners.forEach(function (f) { f(current); }); } };
})();
