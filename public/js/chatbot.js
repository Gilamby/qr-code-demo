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

  function check() {
    if (!launcher || !launcher.isConnected) launcher = hidden && hidden.isConnected ? hidden : find();
    btn.hidden = !launcher;
    if (!launcher) { show(); return; }
    if (inView()) { if (hidden !== launcher || launcher.style.getPropertyValue('visibility') !== 'hidden') hide(launcher); }
    else show();
  }

  btn.addEventListener('click', function () {
    if (!launcher) return;
    // even klikbaar maken, klikken, en daarna weer verbergen (de chat zelf blijft open)
    ['pointer-events', 'visibility'].forEach(function (p) { launcher.style.removeProperty(p); });
    launcher.click();
    setTimeout(check, 50);
  });

  // De chatbot laadt los van de app (async) en kan zijn knopje later maken of vervangen: rustig blijven kijken
  var tries = 0, timer = setInterval(function () { check(); if (++tries > 120 && !launcher) clearInterval(timer); }, 1000);
  document.addEventListener('pagechange', function () { setTimeout(check, 100); });
  addEventListener('resize', function () { launcher = hidden; check(); });
})();
