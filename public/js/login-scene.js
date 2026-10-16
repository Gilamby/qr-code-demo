/* =========================================================
   INLOGSCHERM – glazen QR-sculptuur links (alleen computer en tablet)
   - anim/login3d.js (three.js, ±0,5 MB) wordt pas geladen als het inlogscherm echt zichtbaar is
   - Stopt en ruimt alles op zodra je bent ingelogd (inlogscherm verborgen) of het scherm smal wordt
   - Telefoon of geen WebGL: geen 3D, alleen een rustige gloed; het formulier werkt altijd
   - Raakt de inlogfunctie zelf niet aan (session.js)
   ========================================================= */
(function () {
  var SCENE_VERSION = '41669a91a1';
  var view = document.getElementById('authView'), canvas = document.getElementById('authScene'), art = canvas && canvas.parentNode;
  if (!view || !canvas || !window.matchMedia) return;
  var wide = matchMedia('(min-width: 761px)'), running = false, loading = null;
  /* 2D-reserve: een zwevende QR-code (gewoon SVG) achter de 3D-laag. Zichtbaar als de browser geen WebGL tekent
     (bv. Brave met strenge bescherming, oude computers) of als de 3D-scène onderweg stopt. */
  var fb = document.createElement('div'); fb.className = 'auth-fb'; fb.setAttribute('aria-hidden', 'true');
  art.insertBefore(fb, canvas);
  function drawFallback() { if (fb.firstChild || !window.QRRender) return; try { fb.innerHTML = QRRender.svg('https://optimasys.com', { color: '#cfeeff', transparent: true }); } catch (e) { fb.innerHTML = ''; } }
  window.addEventListener('loginscene-fail', function () { if (running) { art.classList.remove('on'); art.classList.add('no-3d'); } });
  function webgl() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function load() {
    if (window.LoginScene) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (ok, bad) {
      var s = document.createElement('script'); s.src = 'anim/login3d.js?v=' + SCENE_VERSION; s.async = true;
      s.onload = function () { window.LoginScene ? ok() : bad(); }; s.onerror = function () { loading = null; bad(); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function sync() {
    var want = !view.hidden && wide.matches;
    if (want && !running) {
      running = true; drawFallback();
      if (!webgl()) { art.classList.add('no-3d'); return; }
      load().then(function () {
        if (!running) return;
        var ok = false; try { ok = LoginScene.start(canvas); } catch (e) { ok = false; }
        art.classList.toggle('on', ok); art.classList.toggle('no-3d', !ok);
      }).catch(function () { art.classList.add('no-3d'); });
    } else if (!want && running) {
      running = false; art.classList.remove('on');
      if (window.LoginScene) LoginScene.stop();
    }
  }
  new MutationObserver(sync).observe(view, { attributes: true, attributeFilter: ['hidden'] });
  if (wide.addEventListener) wide.addEventListener('change', sync); else wide.addListener(sync);
  sync();
})();
