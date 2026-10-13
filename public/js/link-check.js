/* =========================================================
   LINK-CHECK voor alle URL-velden (en velden met een vaste vorm, zoals een Instagram-naam)
   1. https:// automatisch toevoegen en bekende typfouten verbeteren (htps, .con, …)
   2. domains: moet een link naar die website zijn (bv. Facebook, App Store)
   3. Alleen bij check: true en met server: kijken of de website bestaat en de titel als naam voorstellen
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
  function onDomain(v, domains) { try { var h = new URL(v).hostname.toLowerCase(); return domains.some(function (d) { return h === d || h.slice(-d.length - 1) === '.' + d; }); } catch (e) { return false; } }
  function mount(root, f, type) {
    var input = root.querySelector('[name="' + f.key + '"]'), msg = root.querySelector('[data-msg="' + f.key + '"]'), field = root.querySelector('[data-field="' + f.key + '"]'), seq = 0;
    if (!input || !msg) return;
    function say(text, cls) { msg.textContent = text; msg.className = 'field-msg ' + (cls || ''); if (field) field.classList.toggle('bad', cls === 'bad'); }
    function check() {
      var raw = input.value, my = ++seq;
      if (!raw.trim()) return say('');
      if (f.pattern) {   // bv. Instagram: een geplakte profiellink wordt de naam
        var m = raw.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i), name = (m ? m[1] : raw.trim()).replace(/^@/, '');
        if (name !== raw.trim()) { input.value = name; actions.setField(f.key, name); }
        return new RegExp(f.pattern).test(name) ? say('') : say(t(f.patternError || 'url.invalid'), 'bad');
      }
      var v = normalize(raw);
      if (v !== raw.trim()) { input.value = v; actions.setField(f.key, v); }
      if (!valid(v)) return say(t('url.invalid'), 'bad');
      if (f.domains && !onDomain(v, f.domains)) return say(t('url.wrongSite', { site: f.domains[0] }), 'bad');
      say(v !== raw.trim() ? t('url.fixed', { url: v }) : '', 'info');
      if (!f.check) return;
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
