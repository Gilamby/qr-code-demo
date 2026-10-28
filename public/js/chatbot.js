/* =========================================================
   CHATBOT-KNOP BOVENIN
   De chatbot (Optimasys webchat, script onderaan index.html) zet zelf een rond knopje rechtsonder.
   In de app staat er een eigen knop bovenin naast Taal en Achtergrond (#chatBtn):
   - we zoeken het knopje van de chatbot op (ook binnen zijn shadow DOM);
   - staat onze knop in beeld, dan verbergen we dat knopje en opent onze knop de chat door erop te "klikken";
   - vinden we het knopje niet (of staat onze knop niet in beeld, bv. op het inlogscherm),
     dan blijft alles zoals de chatbot het zelf doet. Er gaat dus nooit iets kapot.
   ========================================================= */
(function () {
  var btn = document.getElementById('chatBtn');
  if (!btn) return;
  var mine = null, launcher = null, hidden = null;

  // Alles wat al in de pagina stond voordat de chatbot laadde, is van ons
  function snapshot() { mine = new Set([].slice.call(document.body.children)); }
  if (document.body) snapshot(); else document.addEventListener('DOMContentLoaded', snapshot);

  function isChatRoot(el) {
    if (!mine || mine.has(el)) return false;
    var s = (el.id + ' ' + (typeof el.className === 'string' ? el.className : '') + ' ' + el.tagName).toLowerCase();
    return /greet|widget|chat|bot/.test(s) || !!el.shadowRoot;
  }
  // Alle elementen in een stuk DOM, ook binnen open shadow roots
  function walk(root, out) {
    var list = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (var i = 0; i < list.length; i++) { out.push(list[i]); if (list[i].shadowRoot) walk(list[i].shadowRoot, out); }
    return out;
  }
  // Het knopje: klein, klikbaar, rechtsonder in beeld
  function find() {
    var roots = [].slice.call(document.body.children).filter(isChatRoot), best = null;
    roots.forEach(function (r) {
      var all = [r].concat(r.shadowRoot ? walk(r.shadowRoot, []) : []).concat(walk(r, []));
      all.forEach(function (el) {
        if (el === hidden) { best = best || el; return; }
        var tag = el.tagName, clickable = tag === 'BUTTON' || el.getAttribute('role') === 'button' || /launcher|bubble|toggle|fab/i.test((typeof el.className === 'string' ? el.className : '') + ' ' + el.id);
        if (!clickable) return;
        var b = el.getBoundingClientRect();
        if (!b.width || b.width > 140 || b.height > 140) return;
        if (b.right < innerWidth - 160 || b.bottom < innerHeight - 200) return;
        if (!best || b.bottom > best.getBoundingClientRect().bottom) best = el;
      });
    });
    return best;
  }
  function inView() { return btn.offsetParent !== null; }        // knop zichtbaar (niet op het inlogscherm)

  function hide(el) {
    if (hidden && hidden !== el) show();
    hidden = el; el.setAttribute('data-qrc-hidden', '1');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
  }
  function show() {
    if (!hidden) return;
    ['opacity', 'pointer-events', 'visibility'].forEach(function (p) { hidden.style.removeProperty(p); });
    hidden.removeAttribute('data-qrc-hidden'); hidden = null;
  }

  // Zelfde uiterlijk als het knopje van de chatbot: zijn foto en tekst (bv. "I'm Clara...") in onze knop
  var looked = '';
  function copyLook(el) {
    var img = el.querySelector && el.querySelector('img'), src = img && img.getAttribute('src');
    var label = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    var key = (src || '') + '|' + label; if (key === looked) return; looked = key;
    var ava = btn.querySelector('.chat-ava');
    if (src) {
      if (!ava) { ava = document.createElement('img'); ava.className = 'chat-ava'; ava.alt = ''; btn.insertBefore(ava, btn.firstChild); }
      ava.src = img.currentSrc || img.src; btn.classList.add('has-ava');
    }
    if (label) { btn.querySelector('.chat-full').textContent = label; btn.querySelector('.chat-short').textContent = label; btn.setAttribute('aria-label', label); }
  }

  function check() {
    if (!launcher || !launcher.isConnected) launcher = hidden && hidden.isConnected ? hidden : find();
    btn.hidden = !launcher;
    var app = document.body.classList.contains('auth-open') ? false : !!(window.Session && Session.user());   // ingelogd en in de app
    rootsOff(!app);
    if (!launcher) { show(); return; }
    copyLook(launcher);
    if (inView()) { if (hidden !== launcher || launcher.style.getPropertyValue('visibility') !== 'hidden') hide(launcher); }
    else show();
  }

  // Alles van de chatbot verbergen (knopje, begroeting, venster): op het inlogscherm hoort hij niet
  function rootsOff(off) {
    [].slice.call(document.body.children).filter(isChatRoot).forEach(function (r) {
      if (off) { r.setAttribute('data-qrc-off', '1'); r.style.setProperty('display', 'none', 'important'); }
      else if (r.getAttribute('data-qrc-off')) { r.removeAttribute('data-qrc-off'); r.style.removeProperty('display'); }
    });
  }

  btn.addEventListener('click', function () {
    if (!launcher) return;
    // even klikbaar maken, klikken, en daarna weer verbergen (de chat zelf blijft open)
    ['pointer-events', 'visibility'].forEach(function (p) { launcher.style.removeProperty(p); });
    launcher.click();
    setTimeout(check, 50);
  });

  // De chatbot pas laden na het inloggen (het script staat als type="text/plain" in index.html, met zijn eigen gegevens)
  var loaded = false, tries = 0, timer = null;
  function load() {
    var tpl = document.getElementById('chatbotScript'); if (loaded || !tpl) return; loaded = true;
    var s = document.createElement('script'); s.async = true;
    [].slice.call(tpl.attributes).forEach(function (a) { if (/^data-/.test(a.name) && a.name !== 'data-src') s.setAttribute(a.name, a.value); });
    s.src = tpl.getAttribute('data-src'); document.body.appendChild(s);
    // De chatbot laadt los van de app (async) en kan zijn knopje later maken of vervangen: rustig blijven kijken
    timer = setInterval(function () { check(); if (++tries > 120 && !launcher) clearInterval(timer); }, 1000);
  }
  if (window.Session && Session.onUser) Session.onUser(function (u) { if (u) load(); });
  setInterval(function () { if (loaded) rootsOff(document.body.classList.contains('auth-open') || !(window.Session && Session.user())); }, 1500);   // uitgelogd of sessie verlopen: weer weg
  document.addEventListener('pagechange', function () { setTimeout(check, 100); });
  addEventListener('resize', function () { launcher = hidden; check(); });
})();
