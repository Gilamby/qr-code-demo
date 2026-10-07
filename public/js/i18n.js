var LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'pl', name: 'Polski' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'sq', name: 'Shqip' }
];

var i18n = (function () {
  var STORE_KEY = 'optimasys-lang';
  var DEFAULT = 'en';
  var dicts = {}, fetched = {}, current = DEFAULT, listeners = [];
  // Ingebouwde Engelse kopie (alleen in de online demo) zodat er direct tekst staat; anders komt alles uit locales/*.json
  try { dicts.en = JSON.parse(document.getElementById('locale-en').textContent); } catch (e) { dicts.en = {}; }

  function supported(code) { return LANGUAGES.some(function (l) { return l.code === code; }); }
  function lookup(dict, key) { return key.split('.').reduce(function (o, k) { return o && o[k] != null ? o[k] : undefined; }, dict); }
  function t(key, vars) {
    var s = lookup(dicts[current], key);
    if (s == null) s = lookup(dicts[DEFAULT], key);
    if (s == null) return key;
    return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }) : s;
  }
  function load(code) {
    if (fetched[code]) return Promise.resolve(dicts[code]);
    return fetch('locales/' + code + '.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { dicts[code] = d; fetched[code] = true; return d; });
  }
  function saved() { try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; } }
  function remember(code) { try { localStorage.setItem(STORE_KEY, code); } catch (e) {} }
  function detect() {
    var s = saved(); return s && supported(s) ? s : DEFAULT;
  }
  function applyDom(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'), args(el));
    });
    (root || document).querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'), args(el));
    });
    (root || document).querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
  }
  function args(el) { var a = el.getAttribute('data-i18n-args'); if (!a) return null; try { return JSON.parse(a); } catch (e) { return null; } }
  function set(code) {
    if (!supported(code)) code = DEFAULT;
    return load(DEFAULT).catch(function () {}).then(function () { return load(code); }).catch(function () { code = DEFAULT; }).then(function () {
      current = code; remember(code);
      document.documentElement.lang = code;
      applyDom();
      listeners.forEach(function (fn) { fn(code); });
    });
  }
  // Getallen, prijzen en datums in de stijl van de gekozen taal
  var fmt = {
    num: function (n) { return new Intl.NumberFormat(current).format(n); },
    eur: function (n) { return new Intl.NumberFormat(current, { style: 'currency', currency: 'EUR' }).format(n); },
    pct: function (n) { return new Intl.NumberFormat(current, { style: 'percent' }).format(n); },
    day: function (d) { return new Intl.DateTimeFormat(current, { day: 'numeric', month: 'long' }).format(d); }
  };
  function render() { document.documentElement.lang = current; applyDom(); listeners.forEach(function (fn) { fn(current); }); }
  function langName() { var c = current; return LANGUAGES.filter(function (l) { return l.code === c; })[0].name; }
  return { t: t, set: set, render: render, langName: langName, detect: detect, fmt: fmt, lang: function () { return current; }, onChange: function (fn) { listeners.push(fn); } };
})();
var t = i18n.t;
