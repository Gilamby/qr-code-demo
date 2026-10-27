/* =========================================================
   KORTE RONDLEIDING (eerste keer in de app)
   - Na het inloggen, als de voorwaarden en het pakket-scherm klaar zijn: welkom → 6 stappen langs het menu → klaar.
   - Altijd over te slaan (knop, Esc). Gezien of overgeslagen = onthouden op de server (account/prefs 'tour'),
     dus ook op een andere computer niet opnieuw. Opnieuw bekijken: Help (FAQ) > "Rondleiding opnieuw".
   - Niet voor het team (beheer) en niet in de online demo.
   ========================================================= */
var Tour = (function () {
  var STEPS = [
    { page: 'create', key: 'create' },
    { page: 'myCodes', key: 'myCodes' },
    { page: 'analytics', key: 'analytics' },
    { page: 'home', key: 'home' },
    { page: 'faq', key: 'help' },
    { page: 'account', key: 'account' }
  ];
  var box = null, i = -1, drawerWas = false, checked = false;
  var mq = window.matchMedia('(max-width: 900px)');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function app() { return document.getElementById('app'); }
  function target(s) { return document.querySelector('.sidebar .item[data-page="' + s.page + '"]'); }

  function start() {
    if (box) return;
    i = -1;
    box = document.createElement('div'); box.className = 'tour'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'tourTitle');
    box.innerHTML = '<div class="tour-hole" aria-hidden="true"></div><div class="tour-card glass"></div>';
    document.body.appendChild(box); document.body.classList.add('tour-open');
    draw();
  }
  function end(done) {
    if (!box) return;
    box.remove(); box = null; document.body.classList.remove('tour-open');
    if (mq.matches && !drawerWas && app().classList.contains('drawer-open')) { var c = document.getElementById('closeMobile'); if (c) c.click(); }
    if (api.account && api.account.savePrefs && !(api.isDemo && api.isDemo())) api.account.savePrefs({ tour: true }).catch(function () {});
    if (done === 'create' && window.goToPage) goToPage('create');
  }
  function openDrawer() {
    if (!mq.matches || app().classList.contains('drawer-open')) return;
    var b = document.getElementById('menuBtn'); if (b) b.click();
  }

  function draw() {
    if (!box) return;
    var hole = box.querySelector('.tour-hole'), card = box.querySelector('.tour-card'), n = STEPS.length;
    var dots = '<span class="tour-dots" aria-hidden="true">' + STEPS.map(function (s, k) { return '<i' + (k === i ? ' class="on"' : '') + '></i>'; }).join('') + '</span>';
    if (i < 0 || i >= n) {                                  // welkom of klaar: kaart in het midden
      var last = i >= n;
      box.classList.add('tour-center'); hole.style.cssText = '';
      card.innerHTML = '<span class="tour-logo"><img src="icons/logo-badge.png" alt=""></span>' +
        '<h2 id="tourTitle">' + esc(t(last ? 'tour.doneTitle' : 'tour.welcomeTitle')) + '</h2>' +
        '<p>' + esc(t(last ? 'tour.doneText' : 'tour.welcomeText')) + '</p>' +
        '<div class="tour-acts">' + (last
          ? '<button type="button" class="btn ghost sm" data-tour="close">' + esc(t('tour.close')) + '</button><button type="button" class="btn primary sm" data-tour="create">' + esc(t('tour.firstCode')) + '</button>'
          : '<button type="button" class="btn ghost sm" data-tour="skip">' + esc(t('tour.skip')) + '</button><button type="button" class="btn primary sm" data-tour="next">' + esc(t('tour.start')) + '</button>') + '</div>';
      focusBtn(card); return;
    }
    box.classList.remove('tour-center');
    openDrawer();
    var s = STEPS[i];
    card.innerHTML = '<div class="tour-top"><span class="tour-step">' + esc(t('tour.step', { n: i + 1, total: n })) + '</span>' +
        '<button type="button" class="tour-x" data-tour="skip" aria-label="' + esc(t('tour.skip')) + '" title="' + esc(t('tour.skip')) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<h2 id="tourTitle">' + esc(t('tour.' + s.key + 'Title')) + '</h2><p>' + esc(t('tour.' + s.key + 'Text')) + '</p>' +
      '<div class="tour-acts">' + dots + '<span class="tour-sp"></span>' +
        (i > 0 ? '<button type="button" class="btn ghost sm" data-tour="back">' + esc(t('tour.back')) + '</button>' : '') +
        '<button type="button" class="btn primary sm" data-tour="next">' + esc(t(i === n - 1 ? 'tour.finish' : 'tour.next')) + '</button></div>';
    // wachten tot de lade open is (mobiel), dan plaatsen
    setTimeout(place, mq.matches ? 320 : 0);
    focusBtn(card);
  }
  function focusBtn(card) { var b = card.querySelector('[data-tour="next"],[data-tour="create"]'); if (b) b.focus({ preventScroll: true }); }

  function place() {
    if (!box || i < 0 || i >= STEPS.length) return;
    var el = target(STEPS[i]), hole = box.querySelector('.tour-hole'), card = box.querySelector('.tour-card');
    if (!el || !el.getClientRects().length) { box.classList.add('tour-center'); hole.style.cssText = ''; return; }
    el.scrollIntoView({ block: 'nearest' });
    var r = el.getBoundingClientRect(), pad = 4;
    hole.style.cssText = 'top:' + (r.top - pad) + 'px;left:' + (r.left - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px';
    var cw = card.offsetWidth, ch = card.offsetHeight, W = innerWidth, H = innerHeight, gap = 16, x, y;
    if (r.right + gap + cw <= W - 12) { x = r.right + gap; y = r.top + r.height / 2 - ch / 2; card.setAttribute('data-side', 'right'); }
    else { x = Math.max(12, Math.min(W - cw - 12, r.left)); y = r.bottom + gap; card.setAttribute('data-side', 'below'); if (y + ch > H - 12) { y = r.top - gap - ch; card.setAttribute('data-side', 'above'); } }
    y = Math.max(12, Math.min(H - ch - 12, y));
    card.style.left = x + 'px'; card.style.top = y + 'px';
  }

  function go(d) { i += d; if (i < -1) i = -1; draw(); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tour]');
    if (b && box && box.contains(b)) {
      var a = b.getAttribute('data-tour');
      if (a === 'next') return go(1);
      if (a === 'back') return go(-1);
      if (a === 'skip' || a === 'close') return end();
      if (a === 'create') return end('create');
    }
    if (e.target.closest('[data-tour-replay]')) { e.preventDefault(); drawerWas = app().classList.contains('drawer-open'); start(); }
  });
  document.addEventListener('keydown', function (e) {
    if (!box) return;
    if (e.key === 'Escape') { e.preventDefault(); end(); }
    else if (e.key === 'ArrowRight' && i < STEPS.length) go(1);
    else if (e.key === 'ArrowLeft' && i > -1) go(-1);
    else if (e.key === 'Tab') {                             // focus binnen de kaart houden
      var f = [].slice.call(box.querySelectorAll('button')); if (!f.length) return;
      var k = f.indexOf(document.activeElement);
      if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  addEventListener('resize', function () { if (box) place(); });
  if (window.i18n) i18n.onChange(draw);

  /* Eerste keer? Wachten tot voorwaarden + pakket-scherm weg zijn en de app zichtbaar is */
  function check(tries) {
    if (checked || box) return;
    var u = window.Session && Session.user();
    if (!u || u.admin || (api.isDemo && api.isDemo())) return;
    if (document.body.classList.contains('paywall-open') || document.body.classList.contains('auth-checking') || (window.TermsGate && TermsGate.waiting())) {
      if ((tries || 0) < 120) setTimeout(function () { check((tries || 0) + 1); }, 1000);
      return;
    }
    checked = true;
    api.account.prefs().then(function (p) { if (p && !p.tour) { drawerWas = app().classList.contains('drawer-open'); setTimeout(start, 600); } }, function () {});
  }
  document.addEventListener('terms-ok', function () { checked = false; setTimeout(check, 1200); });
  return { start: start };
})();
