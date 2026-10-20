/* =========================================================
   HULP: Contact en Veelgestelde vragen
   - Contact: formulier (naam, e-mail, onderwerp, bericht) → POST /api/contact (per e-mail naar het team).
     In de online demo wordt niets verstuurd; dat staat er dan ook bij.
   - Veelgestelde vragen: zoeken, filteren op onderwerp, uitklappen. Bij veel antwoorden een knop
     die meteen naar de juiste plek in de app gaat (bv. Mijn account > Beveiliging).
   Alle teksten staan in public/locales/*.json (contact.*, faq.*).
   ========================================================= */
(function () {
  var contactBox = document.getElementById('contactPage'), faqBox = document.getElementById('faqPage');
  var user = null;
  var SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
  var ICON = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    faq: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17h.01"/>',
    tip: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'
  };

  /* ---------- Contact ---------- */
  var TOPICS = ['problem', 'billing', 'idea', 'other'];   // zoals de KB (Q179)
  var form = { name: '', email: '', topic: '', message: '' }, bad = [], sent = null, busy = false, failMsg = '';
  function contactField(k, label, input, hint) {
    var isBad = bad.indexOf(k) >= 0;
    var msg = !isBad ? '' : k === 'message' ? t('contact.errMessage') : k === 'topic' ? t('contact.errTopic') : String(form[k] || '').trim() ? t('acct.errInvalid') : t('acct.errRequired');
    return '<label class="auth-f' + (k === 'message' ? ' acct-wide' : '') + '"><span>' + label + '</span><span class="auth-in">' + input.replace('>', (isBad ? ' aria-invalid="true" aria-describedby="cerr-' + k + '"' : '') + '>') + '</span>' +
      (isBad ? '<small class="acct-err" id="cerr-' + k + '">' + msg + '</small>' : hint ? '<small class="auth-hint">' + hint + '</small>' : '') + '</label>';
  }
  function drawContact() {
    if (!contactBox) return;
    var side = '<aside class="help-side">' +
      '<div class="glass help-card">' + '<span class="hic hic-q" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +'<path class="hic-bubble" d="M10 8h28a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H22l-8 7v-7h-4a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z"/>' +'<g class="hic-mark"><path d="M19.5 17a4.5 4.5 0 1 1 6.3 4.1c-1.1.5-1.8 1.5-1.8 2.7v.7"/><path d="M24 29.5h.01" stroke-width="3.2"/></g>' +'<g class="hic-dots" stroke-width="2.6"><path d="M41 4l2-2M45 9h2M44 1.5h.01"/></g></svg></span>' + '<h3>' + t('contact.faqTitle') + '</h3><p>' + t('contact.faqText') + '</p>' +
        '<button type="button" class="btn ghost" data-help-go="faq">' + t('contact.faqButton') + SVG + ICON.arrow + '</svg></button></div>' +
      '<div class="glass help-card">' + '<span class="hic hic-bulb" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +'<g class="hic-rays"><path d="M24 2v4M8.5 8.5l2.8 2.8M39.5 8.5l-2.8 2.8M2 23h4M42 23h4"/></g>' +'<path class="hic-glass" d="M24 11a12 12 0 0 0-7 21.7c1.3 1 2 2.4 2 4V38h10v-1.3c0-1.6.7-3 2-4A12 12 0 0 0 24 11z"/>' +'<path class="hic-fil" d="M20.5 27l3.5-3.5 3.5 3.5M24 23.5V38" stroke-width="2"/><path d="M19.5 42h9"/></svg></span>' + '<h3>' + t('contact.tipsTitle') + '</h3><ul class="help-tips">' +
        ['contact.tip1', 'contact.tip2', 'contact.tip3'].map(function (k) { return '<li>' + t(k) + '</li>'; }).join('') + '</ul></div></aside>';
    var main;
    if (sent) {
      main = '<div class="glass bg-card help-main help-sent" role="status"><span class="help-ic big">' + SVG + ICON.ok + '</svg></span><h3>' + t('contact.sentTitle') + '</h3>' +
        '<p>' + t('contact.sentText', { email: '<b>' + esc(sent.email) + '</b>' }) + '</p>' + (sent.demo ? '<p class="acct-note">' + t('contact.demoNote') + '</p>' : '') +
        '<button type="button" class="btn ghost" data-contact-new>' + t('contact.another') + '</button></div>';
    } else {
      main = '<form class="glass bg-card help-main" data-contact novalidate><h3>' + t('contact.formTitle') + '</h3>' +
        '<div class="acct-grid">' +
        contactField('name', t('auth.name'), '<input name="name" maxlength="80" autocomplete="name" value="' + esc(form.name) + '">') +
        contactField('email', t('auth.email'), '<input name="email" type="email" maxlength="254" autocomplete="email" value="' + esc(form.email) + '">', t('contact.emailHint')) +
        contactField('topic', t('contact.topic'), '<select name="topic"><option value="">' + t('contact.chooseTopic') + '</option>' +
          TOPICS.map(function (k) { return '<option value="' + k + '"' + (form.topic === k ? ' selected' : '') + '>' + t('contact.topics.' + k) + '</option>'; }).join('') + '</select>') +
        '<span class="help-gap" aria-hidden="true"></span>' +
        contactField('message', t('contact.message'), '<textarea name="message" rows="7" maxlength="4000" placeholder="' + esc(t('contact.messagePlaceholder')) + '">' + esc(form.message) + '</textarea>') +
        '</div><div class="help-form-foot"><small class="help-count" aria-live="polite">' + form.message.length + ' / 4000</small>' +
        '<button class="btn primary" type="submit"' + (busy ? ' disabled' : '') + '>' + SVG + ICON.send + '</svg>' + t('contact.send') + '</button></div>' +
        (failMsg ? '<p class="acct-msg bad" role="alert">' + esc(failMsg) + '</p>' : '') + '</form>';
    }
    contactBox.innerHTML = '<header class="help-head ct-head"><div><div class="ct-title"><h2>' + t('nav.contact') + '</h2>' + '<div class="ct-globe" aria-hidden="true"><svg viewBox="0 0 120 120">' +'<defs><radialGradient id="ctG" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#7fd6ff"/><stop offset=".55" stop-color="#2bb5f0"/><stop offset="1" stop-color="#0d4f86"/></radialGradient></defs>' +'<circle class="ct-glow" cx="60" cy="60" r="40"/><circle cx="60" cy="60" r="34" fill="url(#ctG)"/>' +'<g class="ct-lines" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"><ellipse class="m1" cx="60" cy="60" rx="34" ry="34"/><ellipse class="m2" cx="60" cy="60" rx="20" ry="34"/><ellipse class="m3" cx="60" cy="60" rx="6" ry="34"/>' +'<path d="M27 48h66M26 60h68M27 72h66"/></g>' +'<g class="ct-orbit"><g class="ct-plane" transform="translate(60 12)"><path d="M-9 2 9-6 3 9 0 3z" fill="#fff"/><path d="M0 3 9-6" stroke="#2bb5f0" stroke-width="1.2"/></g></g>' +'<circle class="ct-ping" cx="74" cy="50" r="3"/><circle cx="74" cy="50" r="2.6" fill="#fff"/></svg></div>' + '</div><p>' + t('contact.lead') + '</p></div></header><div class="help-grid">' + main + side + '</div>';
  }
  function checkContact() {
    var e = [];
    if (!form.name.trim()) e.push('name');
    if (!(window.EmailCheck ? EmailCheck.valid(form.email.trim()) : /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(form.email.trim()))) e.push('email');
    if (!form.topic) e.push('topic');
    if (form.message.trim().length < 10) e.push('message');
    return e;
  }
  if (contactBox) {
    contactBox.addEventListener('input', function (e) {
      var n = e.target.name; if (!n || !(n in form)) return;
      form[n] = e.target.value;
      if (n === 'message') { var c = contactBox.querySelector('.help-count'); if (c) c.textContent = form.message.length + ' / 4000'; }
      if (e.target.getAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); var m = document.getElementById('cerr-' + n); if (m) m.remove(); bad = bad.filter(function (k) { return k !== n; }); }
    });
    contactBox.addEventListener('change', function (e) { if (e.target.name === 'topic') form.topic = e.target.value; });
    contactBox.addEventListener('submit', function (e) {
      e.preventDefault(); failMsg = '';
      bad = checkContact();
      if (bad.length) { drawContact(); var f = contactBox.querySelector('[aria-invalid="true"]'); if (f) f.focus(); return; }
      busy = true; drawContact();
      api.contact({ name: form.name.trim(), email: form.email.trim(), topic: form.topic, message: form.message.trim(), lang: i18n.lang() })
        .then(function (r) { busy = false; sent = { email: form.email.trim(), demo: !!(r && r.demo) }; form.message = ''; form.topic = ''; drawContact(); var h = contactBox.querySelector('.help-sent h3'); if (h) { h.tabIndex = -1; h.focus(); } })
        .catch(function (x) { busy = false; bad = (x && x.details) || []; failMsg = x && x.code === 'too_many' ? t('auth.errTooMany') : bad.length ? t('acct.errBilling') : t('contact.errSend'); drawContact(); });
    });
    contactBox.addEventListener('click', function (e) {
      if (e.target.closest('[data-contact-new]')) { sent = null; bad = []; drawContact(); var n = contactBox.querySelector('select[name=topic]'); if (n) n.focus(); }
    });
  }

  /* ---------- Veelgestelde vragen ---------- */
  // [id, onderwerp, knop (tekst, waarheen)]
  // Onderwerpen zoals de KB (Q183): basisbegrippen, ontwerpen en maken, scannen en printen; plus statistieken en account
  var FAQ = [
    ['types', 'basics'],
    ['dynamic', 'basics'],
    ['edit', 'basics', ['faq.go.myCodes', 'myCodes']],
    ['make', 'design', ['faq.go.create', 'create']],
    ['format', 'design'],
    ['pause', 'design', ['faq.go.myCodes', 'myCodes']],
    ['scanFix', 'scan'],
    ['size', 'scan'],
    ['stats', 'stats', ['faq.go.analytics', 'analytics']],
    ['unique', 'stats', ['faq.go.analytics', 'analytics']],
    ['privacy', 'stats'],
    ['location', 'stats'],
    ['password', 'account', ['faq.go.security', 'account:security']],
    ['billing', 'account', ['faq.go.billing', 'account:billing']],
    ['data', 'account', ['faq.go.data', 'account:data']],
    ['price', 'account', ['faq.go.plan', 'account:plan']]
  ];
  var CATS = ['all', 'basics', 'design', 'scan', 'stats', 'account'];
  var cat = 'all', query = '', openIds = {};
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function matches(item) {
    if (cat !== 'all' && item[1] !== cat) return false;
    if (!query) return true;
    var hay = norm(t('faq.q.' + item[0]) + ' ' + t('faq.a.' + item[0]));
    return norm(query).split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function itemHtml(item) {
    var id = item[0], open = openIds[id] || (query && true);
    return '<details class="glass faq-item" data-faq="' + id + '"' + (open ? ' open' : '') + '><summary><span>' + t('faq.q.' + id) + '</span>' + SVG + ICON.chevron + '</svg></summary>' +
      '<div class="faq-a">' + t('faq.a.' + id).split('\n').map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      (item[2] ? '<button type="button" class="btn ghost faq-go" data-help-go="' + item[2][1] + '">' + t(item[2][0]) + SVG + ICON.arrow + '</svg></button>' : '') + '</div></details>';
  }
  function drawList() {
    var list = faqBox.querySelector('.faq-list'); if (!list) return;
    var shown = FAQ.filter(matches), html;
    if (!shown.length) html = '<div class="glass bg-card faq-none"><p>' + t('faq.none', { q: '<b>' + esc(query) + '</b>' }) + '</p><button type="button" class="btn ghost" data-help-go="contact">' + t('faq.askUs') + '</button></div>';
    else if (cat === 'all' && !query) html = CATS.slice(1).map(function (c) { return '<h3 class="faq-cat">' + t('faq.cats.' + c) + '</h3>' + FAQ.filter(function (x) { return x[1] === c; }).map(itemHtml).join(''); }).join('');
    else html = shown.map(itemHtml).join('');
    list.innerHTML = html;
    var n = faqBox.querySelector('.faq-count'); if (n) n.textContent = query || cat !== 'all' ? t('faq.count', { n: shown.length }) : '';
  }
  function drawFaq() {
    if (!faqBox) return;
    faqBox.innerHTML = '<header class="help-head"><h2>' + t('nav.faq') + '</h2><p>' + t('faq.lead') + '</p>' +
      '<label class="help-search">' + SVG + ICON.search + '</svg><span class="sr-only">' + t('faq.search') + '</span><input type="search" id="faqSearch" placeholder="' + esc(t('faq.searchPlaceholder')) + '" value="' + esc(query) + '" autocomplete="off"></label></header>' +
      '<div class="help-cats" role="group" aria-label="' + esc(t('faq.filter')) + '">' + CATS.map(function (c) { return '<button type="button" class="chip" data-cat="' + c + '" aria-pressed="' + (cat === c) + '">' + t('faq.cats.' + c) + '</button>'; }).join('') +
      '<span class="faq-count" aria-live="polite"></span></div>' +
      '<div class="faq-list"></div>' +
      '<div class="glass help-card faq-more"><div><h3>' + t('faq.moreTitle') + '</h3><p>' + t('faq.moreText') + '</p></div><button type="button" class="btn primary" data-help-go="contact">' + t('faq.askUs') + SVG + ICON.arrow + '</svg></button></div>';
    drawList();
  }
  if (faqBox) {
    faqBox.addEventListener('input', function (e) { if (e.target.id === 'faqSearch') { query = e.target.value.trim(); drawList(); } });
    faqBox.addEventListener('click', function (e) {
      var c = e.target.closest('[data-cat]');
      if (c) { cat = c.getAttribute('data-cat'); faqBox.querySelectorAll('[data-cat]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === c)); }); drawList(); }
    });
    faqBox.addEventListener('toggle', function (e) { var d = e.target.closest && e.target.closest('[data-faq]'); if (d && !query) openIds[d.getAttribute('data-faq')] = d.open; }, true);
  }

  /* ---------- Knoppen naar een plek in de app ---------- */
  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-help-go]'); if (!go) return;
    var to = go.getAttribute('data-help-go').split(':');
    window.goToPage(to[0]);
    if (to[1] && window.openAccountTab) window.openAccountTab(to[1]);
    var top = document.querySelector('.canvas:not([hidden])'); if (top) top.scrollTop = 0;
  });

  if (window.Session) Session.onUser(function (u) {
    user = u; sent = null; bad = []; failMsg = '';
    form.name = (u && u.name) || ''; form.email = (u && u.email) || '';
    drawContact();
  });
  i18n.onChange(function () { drawContact(); drawFaq(); });
  // Vanuit een andere pagina (bv. Abonnement): onderwerp en bericht alvast invullen
  document.addEventListener('contact-preset', function (e) { var d = e.detail || {}; form.topic = d.topic || ''; form.message = d.message || ''; sent = null; bad = []; drawContact(); });
  drawContact(); drawFaq();
})();
