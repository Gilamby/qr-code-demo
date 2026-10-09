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
  var PAGES = { create: 'nav.create', analytics: 'nav.analytics', myCodes: 'nav.myCodes', account: 'nav.account', contact: 'nav.contact', faq: 'nav.faq', logout: 'nav.loggedOut' };
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
    document.getElementById('accountView').hidden = page !== 'account';
    document.getElementById('myCodesView').hidden = page !== 'myCodes';
    document.getElementById('emptyView').hidden = page === 'create' || page === 'account' || page === 'myCodes';
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
  close.addEventListener('click', function () { open(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('pv-open')) open(false); });
  addEventListener('resize', function () { if (document.body.classList.contains('pv-open')) size(); });
  document.addEventListener('pagechange', function () { document.body.classList.remove('pv-open'); });
})();
