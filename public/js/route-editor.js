/* =========================================================
   SLIM DOORSTUREN (Website > Meer opties)
   Regels: "Als [taal / land / tijd / apparaat] is …, ga naar [link]". De eerste die past wint, anders de gewone link.
   Waarde: JSON-lijst [{ k:'lang', v:'es', url }, { k:'time', d:'all|wd|we', f:'12:00', t:'16:00', url }, …] (max. 10).
   Controle en uitvoering op de server: validation.ts (type 'route') en routeUrl() in visitor/rules.ts.
   ========================================================= */
var RouteEditor = (function () {
  var MAX = 10;
  var LANGS = ['en', 'es', 'nl', 'de', 'fr', 'it', 'pt', 'ca', 'da', 'sv', 'nb', 'fi', 'pl', 'ro', 'sk', 'cs', 'hu', 'bg', 'el', 'lv', 'lt', 'et', 'sq', 'ru', 'uk', 'tr', 'ar', 'he', 'zh', 'ja', 'ko', 'hi'];
  var COUNTRIES = ['ES', 'GB', 'IE', 'NL', 'BE', 'LU', 'DE', 'AT', 'CH', 'FR', 'IT', 'PT', 'DK', 'SE', 'NO', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'CY', 'MT', 'HR', 'SI', 'LV', 'LT', 'EE', 'AL', 'RS', 'UA', 'RU', 'TR', 'IL', 'AE', 'SA', 'QA', 'MA', 'DZ', 'EG', 'ZA', 'NG', 'US', 'CA', 'MX', 'AR', 'BR', 'CL', 'CO', 'CN', 'JP', 'KR', 'IN', 'SG', 'AU', 'NZ', 'GI', 'AD'];
  function name(kind, code) {
    try { return new Intl.DisplayNames([i18n.lang()], { type: kind }).of(kind === 'language' ? code : code) || code; } catch (e) { return code; }
  }
  function parse(v) { try { var a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function opts(list, cur) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
  function sorted(codes, kind) { return codes.map(function (c) { return [c, name(kind, kind === 'language' ? c : c)]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); }); }

  function value(r) {
    if (r.k === 'lang') return '<select data-k="v" aria-label="' + esc(t('route.k_lang')) + '">' + opts(sorted(LANGS, 'language'), r.v) + '</select>';
    if (r.k === 'country') return '<select data-k="v" aria-label="' + esc(t('route.k_country')) + '">' + opts(sorted(COUNTRIES, 'region'), r.v) + '</select>';
    if (r.k === 'device') return '<select data-k="v" aria-label="' + esc(t('route.k_device')) + '">' + opts([['ios', t('route.dev_ios')], ['android', t('route.dev_android')], ['desktop', t('route.dev_desktop')]], r.v) + '</select>';
    return '<span class="rt-time"><select data-k="d" aria-label="' + esc(t('route.days')) + '">' + opts([['all', t('route.d_all')], ['wd', t('route.d_wd')], ['we', t('route.d_we')]], r.d) + '</select>' +
      '<input type="time" data-k="f" value="' + esc(r.f) + '" aria-label="' + esc(t('route.from')) + '"><i>–</i><input type="time" data-k="t" value="' + esc(r.t) + '" aria-label="' + esc(t('route.to')) + '"></span>';
  }
  function rows(list) {
    if (!list.length) return '<p class="rt-empty">' + esc(t('route.empty')) + '</p>';
    return list.map(function (r, i) {
      return '<div class="rt-row" data-i="' + i + '"><span class="rt-n">' + (i + 1) + '</span>' +
        '<div class="rt-if"><small>' + esc(t('route.if')) + '</small><select data-k="k" aria-label="' + esc(t('route.if')) + '">' + opts([['lang', t('route.k_lang')], ['country', t('route.k_country')], ['time', t('route.k_time')], ['device', t('route.k_device')]], r.k) + '</select>' + value(r) + '</div>' +
        '<div class="rt-go"><small>' + esc(t('route.goTo')) + '</small><input type="url" data-k="url" value="' + esc(r.url || '') + '" placeholder="https://" aria-label="' + esc(t('route.goTo')) + '" autocomplete="off"></div>' +
        '<button type="button" class="rt-x" data-act="rm" aria-label="' + esc(t('route.remove')) + '" title="' + esc(t('route.remove')) + '">×</button></div>';
    }).join('');
  }
  function fresh(k) {
    if (k === 'lang') return { k: k, v: 'en', url: '' };
    if (k === 'country') return { k: k, v: 'ES', url: '' };
    if (k === 'device') return { k: k, v: 'ios', url: '' };
    return { k: 'time', d: 'all', f: '12:00', t: '16:00', url: '' };
  }
  function html(f, id, v) {
    var list = parse(v);
    return '<div class="route" data-route="' + f.key + '" id="' + id + '"><div class="rt-list">' + rows(list) + '</div>' +
      '<button type="button" class="add-row rt-add" data-act="add"' + (list.length >= MAX ? ' hidden' : '') + '>+ ' + esc(t('route.add')) + '</button>' +
      '<p class="rt-note">' + esc(t('route.note')) + '</p></div>';
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-route]').forEach(function (box) {
      var key = box.getAttribute('data-route'), listEl = box.querySelector('.rt-list'), add = box.querySelector('.rt-add');
      var cur = store.get().content[store.get().typeId] || {}, list = parse(cur[key]);
      // alleen complete regels (met link) gaan mee; lege regels blijven in beeld tot ze ingevuld zijn
      function save(redraw) {
        if (redraw) listEl.innerHTML = rows(list);
        add.hidden = list.length >= MAX;
        var done = list.filter(function (r) { return /^https?:\/\/\S+\.\S+/.test(r.url || ''); });
        onChange(key, done.length ? JSON.stringify(done) : '');
      }
      box.addEventListener('input', function (e) {
        e.stopPropagation();
        var row = e.target.closest('[data-i]'), k = e.target.getAttribute('data-k'); if (!row || !k) return;
        var r = list[+row.getAttribute('data-i')];
        if (k === 'k') { var n = fresh(e.target.value); n.url = r.url; list[+row.getAttribute('data-i')] = n; return save(true); }
        r[k] = e.target.value; save(false);
      });
      box.addEventListener('change', function (e) { e.stopPropagation(); });
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]'); if (!b) return;
        if (b.getAttribute('data-act') === 'add' && list.length < MAX) { list.push(fresh(list.length ? list[list.length - 1].k : 'lang')); save(true); var u = listEl.querySelectorAll('[data-k="url"]'); if (u.length) u[u.length - 1].focus(); return; }
        if (b.getAttribute('data-act') === 'rm') { list.splice(+b.closest('[data-i]').getAttribute('data-i'), 1); save(true); }
      });
    });
  }
  return { html: html, mount: mount };
})();
