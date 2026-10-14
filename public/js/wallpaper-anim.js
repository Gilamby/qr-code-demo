/* =========================================================
   BEWEGENDE ACHTERGRONDEN (Mijn account > Achtergrond)
   Eigen 3D-animaties met three.js (scripts/wallpaper3d/src.js → public/anim/wallpaper3d.js).
   Dat bestand wordt pas geladen als iemand een bewegende achtergrond kiest (of de kaartjes bekijkt),
   zodat de app zelf snel blijft. Geen WebGL? Dan blijft de stilstaande kleurverloop-achtergrond staan.
   - Max. 30 beelden per seconde, stopt als het tabblad niet zichtbaar is
   - "Beweging verminderen" op het apparaat: één stilstaand beeld
   ========================================================= */
var WallAnim = (function () {
  var ANIM_VERSION = '1e9a1c7370';
  var KINDS = ['tide', 'galaxy', 'ribbons', 'sphere', 'fluid'];
  var canvas = null, want = null, loading = null, waiting = [];
  function load() {
    if (window.Wallpaper3D) return Promise.resolve(window.Wallpaper3D);
    if (loading) return loading;
    loading = new Promise(function (ok, bad) {
      var s = document.createElement('script'); s.src = 'anim/wallpaper3d.js?v=' + ANIM_VERSION; s.async = true;
      s.onload = function () { window.Wallpaper3D ? ok(window.Wallpaper3D) : bad(new Error('3d')); };
      s.onerror = function () { loading = null; bad(new Error('3d')); };
      document.head.appendChild(s);
    });
    loading.then(function () { var w = waiting; waiting = []; w.forEach(function (f) { f(); }); }, function () {});
    return loading;
  }
  /** Animatie aanzetten (id) of uitzetten (null) */
  function show(id) {
    want = KINDS.indexOf(id) >= 0 ? id : null;
    if (!want) { if (window.Wallpaper3D) Wallpaper3D.stop(); if (canvas) canvas.hidden = true; return; }
    if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'wp-anim'; canvas.setAttribute('aria-hidden', 'true'); canvas.hidden = true; document.body.insertBefore(canvas, document.body.firstChild); }
    load().then(function (W) { if (want !== id) return; canvas.hidden = !W.start(id, canvas); }).catch(function () { if (canvas) canvas.hidden = true; });
  }
  /** Stilstaand voorbeeld (data-URL) voor de kaartjes; '' zolang three.js nog niet geladen is (ready() roept je terug) */
  var shots = {};
  function snapshot(id, w, h) {
    if (!window.Wallpaper3D) return '';
    if (!(id in shots)) shots[id] = Wallpaper3D.snapshot(id, w, h);
    return shots[id];
  }
  function ready(fn) { if (window.Wallpaper3D) return fn(); waiting.push(fn); load().catch(function () {}); }
  return { show: show, kinds: KINDS, snapshot: snapshot, ready: ready };
})();
