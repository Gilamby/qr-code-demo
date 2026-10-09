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
  // Getallen, prijzen en datums in de stijl van de gekozen taal.
  // Sommige browsers kennen een taal niet (Chrome kent bv. geen Albanees): dan nemen we een taal met dezelfde
  // schrijfwijze voor getallen, en de namen van maanden en dagen uit het taalbestand (sleutel "fmt").
  var NUM_FALLBACK = { sq: 'fr' };            // Albanees schrijft getallen als 1 240 en 7,50 €
  function known(code) { try { return Intl.DateTimeFormat.supportedLocalesOf([code]).length > 0; } catch (e) { return false; } }
  function numLoc() { return known(current) ? current : (NUM_FALLBACK[current] || current); }
  function own() { return !known(current) && lookup(dicts[current], 'fmt.months') ? lookup(dicts[current], 'fmt') : null; }
  var fmt = {
    num: function (n) { return new Intl.NumberFormat(numLoc()).format(n); },
    eur: function (n) { return new Intl.NumberFormat(numLoc(), { style: 'currency', currency: 'EUR' }).format(n); },
    pct: function (n) { return new Intl.NumberFormat(numLoc(), { style: 'percent' }).format(n); },
    compact: function (n) { var c = own() ? '' : new Intl.NumberFormat(current, { notation: 'compact', maximumFractionDigits: 1 }).format(n); return /\D/.test(c) ? c : fmt.num(n); },   // 3,1K / 3,1 mil; anders gewoon 3.100
    // style: 'long' (8 oktober 2026), 'short' (8 okt 2026) of 'day' (8 oktober)
    date: function (d, style) {
      var o = own();
      if (o) { var m = (style === 'short' ? o.monthsShort : o.months)[d.getMonth()]; return d.getDate() + ' ' + m + (style === 'day' ? '' : ' ' + d.getFullYear()); }
      var opt = { day: 'numeric', month: style === 'short' ? 'short' : 'long' }; if (style !== 'day') opt.year = 'numeric';
      return new Intl.DateTimeFormat(current, opt).format(d);
    },
    day: function (d) { return fmt.date(d, 'day'); },
    // i = 0 is maandag
    weekday: function (i, style) {
      var o = own(), w = o ? (style === 'short' ? o.daysShort : o.days)[i] : new Intl.DateTimeFormat(current, { weekday: style || 'long' }).format(new Date(2024, 0, 1 + i));
      return w.charAt(0).toUpperCase() + w.slice(1);     // alleen de eerste letter groot: "Segunda-feira", "E hënë"
    },
    // "HH:MM" -> tijd in de stijl van de taal (Engels 9:00 AM, de rest 24 uur: 09:00)
    time: function (hm) {
      if (current !== 'en') return hm.slice(0, 5);
      var d = new Date(2024, 0, 1, +hm.slice(0, 2), +hm.slice(3, 5));
      return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(d);
    }
  };
  function render() { document.documentElement.lang = current; applyDom(); listeners.forEach(function (fn) { fn(current); }); }
  function langName() { var c = current; return LANGUAGES.filter(function (l) { return l.code === c; })[0].name; }
  return { t: t, set: set, render: render, langName: langName, detect: detect, fmt: fmt, lang: function () { return current; }, onChange: function (fn) { listeners.push(fn); } };
})();
var t = i18n.t;
