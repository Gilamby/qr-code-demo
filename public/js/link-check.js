/* =========================================================
   LINK-CHECK voor URL-velden met check: true
   1. https:// automatisch toevoegen en bekende typfouten verbeteren (htps, .con, …)
   2. Met server: kijken of de website bestaat en de titel als naam voorstellen
   ========================================================= */
var LinkCheck = (function () {
  var FIXES = [[/^htps?:\/\//i, 'https://'], [/^https?\/\/(?!\/)/i, 'https://'], [/^https?:\/(?!\/)/i, 'https://'], [/^ttps?:\/\//i, 'https://'],
    [/\.con(\/|$)/i, '.com$1'], [/\.cmo(\/|$)/i, '.com$1'], [/\.ocm(\/|$)/i, '.com$1'], [/\.comm(\/|$)/i, '.com$1'], [/,com(\/|$)/i, '.com$1'], [/\.nll(\/|$)/i, '.nl$1']];
  function normalize(v) {
    var x = v.trim().replace(/\s+/g, '');
    if (!x) return '';
    FIXES.forEach(function (f) { x = x.replace(f[0], f[1]); });
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(x)) x = 'https://' + x.replace(/^\/+/, '');
    return x;
  }
  function valid(v) { try { var u = new URL(v); return /^https?:$/.test(u.protocol) && /\.[a-z]{2,}$/i.test(u.hostname); } catch (e) { return false; } }
  function mount(root, f, type) {
    var input = root.querySelector('[name="' + f.key + '"]'), msg = root.querySelector('[data-msg="' + f.key + '"]'), seq = 0;
    if (!input) return;
    function say(text, cls) { msg.textContent = text; msg.className = 'field-msg ' + (cls || ''); }
    function check() {
      var raw = input.value, v = normalize(raw), my = ++seq;
      if (!raw.trim()) return say('');
      if (v !== raw.trim()) { input.value = v; actions.setField(f.key, v); }
      if (!valid(v)) return say(t('url.invalid'), 'bad');
      say(v !== raw.trim() ? t('url.fixed', { url: v }) : '', 'info');
      api.available().then(function (online) {
        if (!online || my !== seq) return;
        say(t('url.checking'), 'info');
        api.urlInfo(v).then(function (r) {
          if (my !== seq) return;
          if (!r.ok) return say(t('url.fail'), 'warn');
          say(r.title ? t('url.okTitle', { title: r.title }) : t('url.ok'), 'ok');
          var name = root.querySelector('[name="title"]');
          if (r.title && name && !name.value.trim()) { name.value = r.title.slice(0, 120); actions.setField('title', name.value); }
        }).catch(function () { if (my === seq) say(t('url.fail'), 'warn'); });
      });
    }
    input.addEventListener('blur', check);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    if (input.value) check();
  }
  return { mount: mount, normalize: normalize };
})();
