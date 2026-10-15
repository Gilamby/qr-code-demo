/* ---------- Taalkiezer ---------- */
(function () {
  var wrap = document.getElementById('lang'), btn = document.getElementById('langBtn');
  var menu = document.getElementById('langMenu'), list = document.getElementById('langList');
  var tick = '<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
  list.innerHTML = LANGUAGES.map(function (l) {
    return '<button type="button" role="menuitemradio" aria-checked="false" data-lang="' + l.code + '" lang="' + l.code + '">' + tick +
      '<span class="lname">' + l.name + '</span><span class="code">' + l.code.toUpperCase() + '</span></button>';
  }).join('');
  var items = [].slice.call(list.querySelectorAll('[data-lang]'));

  function open(v) {
    menu.hidden = !v; wrap.classList.toggle('open', v); btn.setAttribute('aria-expanded', String(v));
    if (v) { var cur = list.querySelector('[aria-checked="true"]') || items[0]; cur.focus(); }
  }
  btn.addEventListener('click', function () { open(menu.hidden); });
  document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) open(false); });
  menu.addEventListener('keydown', function (e) {
    var i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === 'Escape') { open(false); btn.focus(); }
  });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]'); if (!b) return;
    i18n.set(b.getAttribute('data-lang')).then(function () { open(false); btn.focus(); });
  });
  i18n.onChange(function (code) {
    var l = LANGUAGES.filter(function (x) { return x.code === code; })[0];
    document.getElementById('langName').textContent = l.name;
    document.getElementById('langCode').textContent = code.toUpperCase();
    btn.setAttribute('aria-label', t('header.language') + ': ' + l.name);
    items.forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-lang') === code)); });
  });
})();

/* ---------- Zijbalk ---------- */
(function () {
  var app = document.getElementById('app'), toggle = document.getElementById('toggle');
  var menuBtn = document.getElementById('menuBtn'), closeMobile = document.getElementById('closeMobile');
  var scrim = document.getElementById('scrim'), mq = window.matchMedia('(max-width: 900px)');
  var KEY = 'optimasys-sidebar-collapsed';
  var PAGES = { home: 'nav.overview', legal: 'nav.legal', adminSettings: 'nav.adminSettings', create: 'nav.create', analytics: 'nav.analytics', myCodes: 'nav.myCodes', account: 'nav.account', customers: 'nav.users', adminDash: 'nav.adminDash', adminCodes: 'nav.adminCodes', contact: 'nav.contact', faq: 'nav.faq', logout: 'nav.loggedOut' };
  var page = 'create';
  function load() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function save(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} }
  function labelToggle() {
    var txt = t(app.classList.contains('collapsed') ? 'nav.expand' : 'nav.collapse');
    toggle.setAttribute('aria-label', txt); toggle.title = txt;
  }
  function setCollapsed(v) { app.classList.toggle('collapsed', v); toggle.setAttribute('aria-expanded', String(!v)); labelToggle(); }
  function setDrawer(open) { app.classList.toggle('drawer-open', open); menuBtn.setAttribute('aria-expanded', String(open)); }
  function showPage() {
    var title = t(PAGES[page]);
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('createView').hidden = page !== 'create';
    document.body.classList.toggle('not-create', page !== 'create');
    // Elke pagina heeft een eigen <main id="…View">; de rest is verborgen
    var VIEWS = ['home', 'account', 'myCodes', 'analytics', 'contact', 'faq', 'legal', 'adminDash', 'adminCodes', 'customers', 'adminSettings'];
    VIEWS.forEach(function (p) { var v = document.getElementById(p + 'View'); if (v) v.hidden = page !== p; });
    document.getElementById('emptyView').hidden = page === 'create' || VIEWS.indexOf(page) >= 0;
    document.dispatchEvent(new CustomEvent('pagechange', { detail: page }));
    if (window.fitWorkspace) requestAnimationFrame(window.fitWorkspace);
  }
  window.goToPage = function (p) {
    page = p;
    document.querySelectorAll('.item').forEach(function (i) { i.classList.toggle('active', i.getAttribute('data-page') === page); });
    showPage();
  };
  var narrow = matchMedia('(max-width: 900px)');
  function applyWidth() { if (narrow.matches) setCollapsed(true); else setCollapsed(load()); }
  narrow.addEventListener('change', applyWidth);
  applyWidth();
  toggle.addEventListener('click', function () { var v = !app.classList.contains('collapsed'); setCollapsed(v); save(v); });
  menuBtn.addEventListener('click', function () { setDrawer(true); });
  closeMobile.addEventListener('click', function () { setDrawer(false); });
  scrim.addEventListener('click', function () { setDrawer(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });
  mq.addEventListener('change', function () { setDrawer(false); });
  document.querySelectorAll('[data-page]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      page = link.getAttribute('data-page');
      document.querySelectorAll('.item').forEach(function (i) { i.classList.toggle('active', i.getAttribute('data-page') === page); });
      showPage();
      if (mq.matches) setDrawer(false);
    });
  });
  i18n.onChange(function () { labelToggle(); showPage(); });
})();

/* ---------- Schalen: telefoon + paneel passen altijd in het scherm ---------- */
(function () {
  var W = 1084, H = 760;
  var outer = document.getElementById('fitOuter'), inner = document.getElementById('fitInner'), view = document.getElementById('createView');
  function fit() {
    if (view.hidden) return;
    var cs = getComputedStyle(view);
    var availW = view.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var availH = window.innerHeight - document.querySelector('.topbar').offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var s = Math.max(.25, Math.min(availW / W, availH / H, 1.3));
    inner.style.transform = 'scale(' + s + ')';
    outer.style.width = (W * s) + 'px';
    outer.style.height = (inner.offsetHeight * s) + 'px';
  }
  if (window.ResizeObserver) { var ro = new ResizeObserver(fit); ro.observe(inner); ro.observe(view); }
  addEventListener('resize', fit);
  window.fitWorkspace = fit;
  fit();
})();

/* ---------- Telefoon: voorbeeld openen als scherm erover ---------- */
(function () {
  var fab = document.getElementById('pvFab'), close = document.getElementById('pvClose'), phone = document.querySelector('.preview .phone');
  function size() { var s = Math.min(1, (window.innerHeight - 110) / 740, (window.innerWidth - 24) / 350); document.body.style.setProperty('--pvs', s.toFixed(3)); }
  function open(on) { document.body.classList.toggle('pv-open', on); if (on) { size(); close.focus(); } else fab.focus({ preventScroll: true }); }
  fab.addEventListener('click', function () { open(true); });
  /* Telefoon: het voorbeeld staat bovenaan, verkleind. Schaal zo dat de hele telefoon in dat vak past; tik = groot */
  var pv = document.querySelector('#createView .preview');
  function fitSmall() {
    if (window.innerWidth > 760) return;
    var tb = document.querySelector('.topbar'); if (tb && tb.offsetHeight) document.body.style.setProperty('--tbh', Math.round(tb.getBoundingClientRect().bottom > 0 ? tb.offsetHeight : 60) + 'px');
    var h = Math.round(Math.max(190, Math.min(window.innerHeight * 0.38, 340)));
    document.body.style.setProperty('--pvh', h + 'px');
    document.body.style.setProperty('--pvm', ((h - 14 - 34) / 726).toFixed(3));   // 34 px: de vraag boven de telefoon
  }
  fitSmall(); addEventListener('resize', fitSmall); document.addEventListener('pagechange', function () { setTimeout(fitSmall, 0); });
  pv.addEventListener('click', function (e) { if (window.innerWidth <= 760 && !document.body.classList.contains('pv-open') && !e.target.closest('.pv-close')) open(true); });
  pv.setAttribute('title', '');
  /* Telefoon: de vraag van de stap ("Wat voor QR-code wil je maken?") boven het voorbeeld, niet in het paneel */
  var hero = document.getElementById('heroTitle'), pvTitle = document.createElement('p');
  pvTitle.className = 'pv-title'; pvTitle.setAttribute('aria-hidden', 'true');      // de echte kop (h2) blijft voor schermlezers
  pv.insertBefore(pvTitle, pv.firstChild);
  function syncTitle() { if (pvTitle.textContent !== hero.textContent) pvTitle.textContent = hero.textContent; }
  syncTitle(); new MutationObserver(syncTitle).observe(hero, { childList: true, characterData: true, subtree: true });
  /* knop schuift omhoog zodra de Terug/Doorgaan-balk onderin zichtbaar is, zodat hij die nooit bedekt */
  var tick = 0;
  function lift() {
    tick = 0; var lifted = 0, bar = null;
    document.querySelectorAll('#createView .panel-card .actions').forEach(function (a) { if (a.offsetParent) bar = a; });
    if (bar && getComputedStyle(fab).display !== 'none') {
      var r = bar.getBoundingClientRect(), h = window.innerHeight;
      if (r.top < h - 10 && r.bottom > h - 72) lifted = Math.round(h - Math.max(r.top, 0) + 8);
    }
    fab.style.bottom = lifted ? 'calc(' + lifted + 'px + env(safe-area-inset-bottom, 0px))' : '';
  }
  function soon() { if (!tick) tick = requestAnimationFrame(lift); }
  window.addEventListener('scroll', soon, { passive: true }); window.addEventListener('resize', soon);
  document.addEventListener('click', function () { setTimeout(soon, 60); }, true);
  setInterval(soon, 800);
  close.addEventListener('click', function () { open(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('pv-open')) open(false); });
  addEventListener('resize', function () { if (document.body.classList.contains('pv-open')) size(); });
  document.addEventListener('pagechange', function () { document.body.classList.remove('pv-open'); });
})();

/* ---------- Onderhoudsmodus: balk bovenin (klanten: kunnen even niets wijzigen; team: herinnering dat hij aan staat) ---------- */
(function () {
  var bar = document.createElement('div'); bar.className = 'maint-bar'; bar.setAttribute('role', 'status'); bar.hidden = true;
  var main = document.querySelector('.main'); if (main) main.insertBefore(bar, main.children[1] || null);
  function show() {
    var m = (window.api && api.info && api.info().maintenance) || {}, me = window.Session && Session.user ? Session.user() : null;
    bar.hidden = !m.on || !me;
    if (!bar.hidden) bar.innerHTML = '<b>' + esc(t(me && me.admin ? 'set.bannerAdmin' : 'set.bannerUser')) + '</b>' + (m.message ? ' <span>' + esc(m.message) + '</span>' : '');
  }
  document.addEventListener('maintenance-change', show);
  document.addEventListener('pagechange', show);
  if (window.i18n) i18n.onChange(show);
  setTimeout(show, 1500);
})();

/* ---------- Bovenbalk: doorzichtig bovenaan, glas zodra je scrolt (anders loopt de inhoud er onzichtbaar onder door) ---------- */
(function () {
  function check(e) {
    var t = e && e.target && e.target.scrollTop != null && e.target !== document ? e.target.scrollTop : 0;
    document.body.classList.toggle('scrolled', (window.scrollY || document.documentElement.scrollTop || 0) > 4 || t > 4);
  }
  document.addEventListener('scroll', check, { capture: true, passive: true });
  document.addEventListener('pagechange', function () { setTimeout(check, 0); });
})();
