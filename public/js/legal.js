/* =========================================================
   PRIVACYVERKLARING · VOORWAARDEN · COOKIES
   - Pagina in de app (Hulp > Privacy en voorwaarden) met drie tabbladen
   - Ook als venster vanaf het inlogscherm (zonder in te loggen)
   - De teksten staan in de taalbestanden (sleutels legal.*), dus admins kunnen ze aanpassen en
     vertalen in Beheer > Instellingen > Vertalingen (ook met DeepL).
   - Opbouw van een tekst: legal.<doc>.title, .updated, .intro en dan s1t/s1, s2t/s2 … (titel + inhoud).
     In de inhoud: lege regel = nieuwe alinea, regel die begint met "- " = opsomming.
     {company} en {email} worden ingevuld met de bedrijfsgegevens uit .env (LEGAL_NAME, LEGAL_EMAIL …).
   - Admins zien bovenaan dat het een concept is dat nagekeken moet worden.
   ========================================================= */
var Legal = (function () {
  var view = document.getElementById('legalView'), body = document.getElementById('legalBody'), doc = 'privacy', me = null;
  var DOCS = ['privacy', 'terms', 'cookies'];
  function info() { var i = (window.api && api.info && api.info().legal) || {}; return { company: i.name || 'Optimasys', email: i.email || '', address: i.address, kvk: i.kvk, vat: i.vat }; }
  function has(key) { return t(key) !== key; }
  function paragraphs(text) {
    var esc2 = function (s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); };
    // Per blok: regels met "- " worden een opsomming, de andere regels gewone tekst (bv. een vetgedrukt kopje erboven)
    return String(text).split(/\n\s*\n/).map(function (block) {
      var out = '', list = [], text = [];
      var flushList = function () { if (list.length) { out += '<ul>' + list.map(function (l) { return '<li>' + esc2(l) + '</li>'; }).join('') + '</ul>'; list = []; } };
      var flushText = function () { if (text.length) { out += '<p>' + text.map(esc2).join('<br>') + '</p>'; text = []; } };
      block.split('\n').forEach(function (l) {
        if (/^\s*- /.test(l)) { flushText(); list.push(l.replace(/^\s*- /, '')); } else { flushList(); text.push(l); }
      });
      flushText(); flushList();
      return out;
    }).join('');
  }
  function render(d, inDialog) {
    var v = info(), vars = { company: v.company, email: v.email || t('legal.noEmail') };
    var secs = [], i = 1;
    while (has('legal.' + d + '.s' + i + 't')) { secs.push({ id: d + '-' + i, title: t('legal.' + d + '.s' + i + 't', vars), text: t('legal.' + d + '.s' + i, vars) }); i++; }
    var company = [v.company, v.address, v.kvk ? t('legal.kvk', { n: v.kvk }) : '', v.vat ? t('legal.vat', { n: v.vat }) : '', v.email].filter(Boolean);
    return '<article class="lg-doc">' +
      (me && me.admin && !inDialog ? '<p class="lg-draft">' + t('legal.draftNote') + '</p>' : '') +
      '<header><h2>' + esc(t('legal.' + d + '.title')) + '</h2><p class="lg-upd">' + esc(t('legal.updated', { date: t('legal.' + d + '.updated') })) + '</p>' +
      '<div class="lg-intro">' + paragraphs(t('legal.' + d + '.intro', vars)) + '</div></header>' +
      (secs.length > 3 && !inDialog ? '<nav class="lg-toc" aria-label="' + esc(t('legal.toc')) + '"><b>' + t('legal.toc') + '</b><ol>' + secs.map(function (s) { return '<li><a href="#' + s.id + '" data-jump="' + s.id + '">' + esc(s.title) + '</a></li>'; }).join('') + '</ol></nav>' : '') +
      secs.map(function (s, n) { return '<section id="' + s.id + '"><h3><span>' + (n + 1) + '</span>' + esc(s.title) + '</h3>' + paragraphs(s.text) + '</section>'; }).join('') +
      '<footer class="lg-company"><b>' + t('legal.contact') + '</b><span>' + company.map(esc).join('<br>') + '</span></footer></article>';
  }
  function draw() {
    body.innerHTML = '<div class="lg-tabs" role="tablist">' + DOCS.map(function (d) {
      return '<button type="button" role="tab" aria-selected="' + (d === doc) + '" data-doc="' + d + '">' + t('legal.' + d + '.short') + '</button>'; }).join('') + '</div>' +
      '<div class="glass lg-card" role="tabpanel">' + render(doc) + '</div>';
  }
  body.addEventListener('click', function (e) {
    var b = e.target.closest('[data-doc]'); if (b) { doc = b.getAttribute('data-doc'); draw(); return; }
    var j = e.target.closest('[data-jump]'); if (j) { e.preventDefault(); var el = document.getElementById(j.getAttribute('data-jump')); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  /** Venster (ook zonder inloggen, bv. vanaf het inlogscherm) */
  function dialog(d) {
    var dlg = document.getElementById('legalDialog');
    dlg.innerHTML = '<div class="lg-dlg"><button type="button" class="lg-close" data-close aria-label="' + esc(t('legal.close')) + '">×</button>' + render(d, true) + '</div>';
    dlg.onclick = function (e) { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); };
    dlg.setAttribute('aria-label', t('legal.' + d + '.title')); dlg.showModal(); dlg.querySelector('[data-close]').focus();
  }
  /** Pagina openen op een bepaald document */
  function open(d) { doc = DOCS.indexOf(d) >= 0 ? d : 'privacy'; goToPage('legal'); }
  if (window.Session) Session.onUser(function (u) { me = u; });
  document.addEventListener('pagechange', function (e) { if (e.detail === 'legal') draw(); });
  i18n.onChange(function () { if (view && !view.hidden) draw(); });
  return { dialog: dialog, open: open };
})();
