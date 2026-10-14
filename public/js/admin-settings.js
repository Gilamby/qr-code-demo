/* =========================================================
   BEHEER > INSTELLINGEN
   Tabblad Vertalingen: elke tekst van de app per taal bekijken en aanpassen, zonder programmeur.
     - per taal hoe compleet hij is (klik = die taal)
     - zoeken (in sleutel en tekst), filter Alles / Ontbreekt / Aangepast, onderdeel
     - links de tekst in een vergelijkingstaal, rechts de tekst die je aanpast
     - opslaan bij verlaten van het veld (of Ctrl/Cmd+Enter); Herstellen = terug naar de standaardtekst
     - {naam}-plekken moeten blijven staan, anders wordt het niet opgeslagen
     - met een DeepL-sleutel: per regel of alle ontbrekende in één keer vertalen
   Tabblad Automatisch vertalen: DeepL-sleutel (alleen de super-admin) en verbruik.
   Aanpassingen gaan direct live voor iedereen (ook in de e-mails).
   ========================================================= */
var AdminSettings = (function () {
  var view = document.getElementById('adminSettingsView'), body = document.getElementById('asBody');
  var PAGE = 40, me = null, tab = 'texts', info = null, base = {}, flatBase = {}, keys = [], shown = PAGE, busy = {}, notes = {};
  var f = { lang: 'nl', ref: 'en', q: '', status: '', group: '' };
  var SVG = function (p) { return '<svg class="ast-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var IC = {
    lang: '<path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c-.5 3-3 7-7 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>', search: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>'
  };
  var ico = function (k) { return SVG(IC[k]); };
  function langName(c) { var l = LANGUAGES.filter(function (x) { return x.code === c; })[0]; return l ? l.name : c; }
  function flatten(o, pre, out) {
    out = out || {};
    Object.keys(o || {}).forEach(function (k) { var key = pre ? pre + '.' + k : k, v = o[k]; if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out); else if (typeof v === 'string') out[key] = v; });
    return out;
  }
  function vars(s) { return (String(s || '').match(/\{\w+\}/g) || []).sort().join(','); }

  /* ---------- Gegevens ---------- */
  function load() {
    body.innerHTML = '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    Promise.all([api.translations.all()].concat(LANGUAGES.map(function (l) { return i18n.raw(l.code).catch(function () { return {}; }); }))).then(function (res) {
      info = res[0];
      LANGUAGES.forEach(function (l, i) { base[l.code] = res[i + 1]; flatBase[l.code] = flatten(res[i + 1]); });
      keys = Object.keys(flatBase.en).sort();
      if (f.lang === f.ref) f.ref = f.lang === 'en' ? 'nl' : 'en';
      draw();
    }).catch(function () { body.innerHTML = '<p class="muted-msg">' + t('as.error') + '</p>'; });
  }
  function current(lang, key) { var o = info.overrides[lang] || {}; return key in o ? o[key] : flatBase[lang][key]; }
  function status(lang, key) { var o = info.overrides[lang] || {}; return key in o ? 'custom' : flatBase[lang][key] == null || flatBase[lang][key] === '' ? 'missing' : 'default'; }
  function percent(lang) { var n = 0; keys.forEach(function (k) { if (status(lang, k) !== 'missing') n++; }); return keys.length ? Math.floor(n / keys.length * 100) : 100; }
  function rows() {
    var q = f.q.trim().toLowerCase();
    return keys.filter(function (k) {
      if (f.group && k.split('.')[0] !== f.group) return false;
      var st = status(f.lang, k);
      if (f.status && st !== f.status) return false;
      if (!q) return true;
      return (k + ' ' + (current(f.lang, k) || '') + ' ' + (current(f.ref, k) || '')).toLowerCase().indexOf(q) >= 0;
    });
  }

  /* ---------- Tekenen ---------- */
  function tabs() {
    return '<div class="ast-tabs" role="tablist">' + [['texts', 'lang', 'as.tabTexts'], ['deepl', 'spark', 'as.tabDeepl']].map(function (x) {
      return '<button type="button" role="tab" aria-selected="' + (tab === x[0]) + '" data-tab="' + x[0] + '">' + ico(x[1]) + t(x[2]) + '</button>'; }).join('') + '</div>';
  }
  function draw() {
    if (!info) return;
    body.innerHTML = '<header class="ast-head"><div><h2>' + t('nav.adminSettings') + '</h2><p>' + t('as.lead') + '</p></div></header>' + tabs() +
      '<div id="asPanel">' + (tab === 'texts' ? textsPanel() : deeplPanel()) + '</div>';
  }
  function textsPanel() {
    var list = rows(), groups = Array.from(new Set(keys.map(function (k) { return k.split('.')[0]; }))).sort();
    var custom = Object.keys(info.overrides[f.lang] || {}).length, missing = keys.filter(function (k) { return status(f.lang, k) === 'missing'; }).length;
    var canAuto = info.deepl.configured && info.deepl.langs.indexOf(f.lang) >= 0;
    var opt = function (v, label, sel) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(label) + '</option>'; };
    return '<div class="ast-langs">' + LANGUAGES.map(function (l) {
        var p = percent(l.code);
        return '<button type="button" class="ast-lang' + (l.code === f.lang ? ' on' : '') + '" data-lang="' + l.code + '"><span>' + esc(l.name) + '</span><b>' + p + '%</b><i style="--p:' + p + '%"></i></button>'; }).join('') + '</div>' +
      '<div class="ast-bar glass">' +
        '<label class="ast-f"><span>' + t('as.editLang') + '</span><select data-f="lang">' + LANGUAGES.map(function (l) { return opt(l.code, l.name, f.lang); }).join('') + '</select></label>' +
        '<label class="ast-f"><span>' + t('as.refLang') + '</span><select data-f="ref">' + LANGUAGES.filter(function (l) { return l.code !== f.lang; }).map(function (l) { return opt(l.code, l.name, f.ref); }).join('') + '</select></label>' +
        '<label class="ast-f ast-q">' + ico('search') + '<input type="search" data-f="q" value="' + esc(f.q) + '" placeholder="' + esc(t('as.search')) + '" aria-label="' + esc(t('as.search')) + '"></label>' +
        '<label class="ast-f"><span>' + t('as.section') + '</span><select data-f="group">' + opt('', t('as.allSections'), f.group) + groups.map(function (g) { return opt(g, g, f.group); }).join('') + '</select></label>' +
        '<div class="ast-seg" role="radiogroup" aria-label="' + esc(t('as.show')) + '">' + [['', 'as.all', keys.length], ['missing', 'as.missing', missing], ['custom', 'as.custom', custom]].map(function (x) {
          return '<button type="button" role="radio" aria-checked="' + (f.status === x[0]) + '" data-status="' + x[0] + '">' + t(x[1]) + ' <em>' + i18n.fmt.num(x[2]) + '</em></button>'; }).join('') + '</div>' +
      '</div>' +
      (missing && canAuto ? '<div class="ast-auto">' + ico('spark') + '<span>' + t('as.autoAll', { n: missing, lang: langName(f.lang) }) + '</span><button type="button" class="btn primary sm" data-auto-all>' + t('as.autoAllBtn') + '</button></div>'
        : missing && !info.deepl.configured ? '<p class="ast-hint">' + t('as.noDeeplHint') + '</p>' : '') +
      '<p class="ast-count">' + t('as.count', { n: i18n.fmt.num(list.length) }) + '</p>' +
      (list.length ? '<div class="ast-list">' + list.slice(0, shown).map(row).join('') + '</div>' +
        (list.length > shown ? '<button type="button" class="btn ghost ast-more" data-more>' + t('as.more', { n: i18n.fmt.num(list.length - shown) }) + '</button>' : '')
        : '<div class="mc-empty small glass"><h3>' + t('as.none') + '</h3></div>');
  }
  function row(k) {
    var st = status(f.lang, k), val = current(f.lang, k) || '', ref = current(f.ref, k) || '', long = val.length > 70 || ref.length > 70;
    var canAuto = info.deepl.configured && info.deepl.langs.indexOf(f.lang) >= 0, n = notes[f.lang + '|' + k];
    return '<div class="ast-row st-' + st + '" data-key="' + esc(k) + '">' +
      '<div class="ast-meta"><code>' + esc(k) + '</code><span class="ast-pill">' + t('as.st_' + st) + '</span></div>' +
      '<div class="ast-cols"><div class="ast-ref"><small>' + esc(langName(f.ref)) + '</small><p>' + (ref ? esc(ref) : '<em>' + t('as.st_missing') + '</em>') + '</p></div>' +
      '<label class="ast-edit"><small>' + esc(langName(f.lang)) + '</small><textarea rows="' + (long ? 3 : 1) + '" data-edit placeholder="' + esc(t('as.st_missing')) + '">' + esc(val) + '</textarea></label></div>' +
      '<div class="ast-acts">' + (n ? '<span class="ast-note ' + n[1] + '">' + (n[1] === 'ok' ? ico('check') : ico('warn')) + esc(n[0]) + '</span>' : '') +
        (canAuto ? '<button type="button" class="btn ghost sm" data-auto' + (busy[k] ? ' disabled' : '') + '>' + ico('spark') + t('as.auto') + '</button>' : '') +
        (st === 'custom' ? '<button type="button" class="btn ghost sm" data-reset>' + ico('undo') + t('as.reset') + '</button>' : '') + '</div></div>';
  }
  function deeplPanel() {
    var d = info.deepl, sup = me && me.superAdmin;
    var usage = d.limit ? '<div class="ast-usage"><div><b>' + i18n.fmt.num(d.used) + '</b> / ' + i18n.fmt.num(d.limit) + ' ' + t('as.chars') + '</div><i><s style="width:' + Math.min(100, d.used / d.limit * 100).toFixed(1) + '%"></s></i></div>' : '';
    return '<div class="glass ast-card"><div class="ast-dhead"><span class="ast-dic">' + ico('spark') + '</span><div><h3>DeepL</h3><p>' + t('as.deeplLead') + '</p></div>' +
        '<span class="acct-chip ' + (d.configured && !d.error ? 'ok' : '') + '">' + (d.configured && !d.error ? '<i></i>' + t('as.connected') : d.error === 'key' ? t('as.badKey') : d.configured ? t('as.unreachable') : t('as.notConnected')) + '</span></div>' +
        usage +
        (d.fromEnv ? '<p class="ast-hint">' + t('as.fromEnv') + '</p>'
          : sup ? '<form class="ast-keyform" data-keyform><label class="auth-f"><span>' + t('as.apiKey') + '</span><span class="auth-in acct-ic">' + ico('key') + '<input name="key" type="password" autocomplete="off" spellcheck="false" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"></span></label>' +
            '<div class="ar-actions">' + (d.configured ? '<button type="button" class="btn ghost" data-key-remove>' + t('as.removeKey') + '</button>' : '') + '<button class="btn primary" type="submit">' + t(d.configured ? 'as.replaceKey' : 'as.saveKey') + '</button></div><p class="acct-msg" id="asKeyMsg" hidden></p></form>'
          : '<p class="ast-hint">' + t('as.superOnly') + '</p>') +
        '<p class="ast-hint">' + t('as.howTo') + '</p>' +
        '<p class="ast-hint">' + t('as.langsNote', { list: d.langs.map(langName).join(', ') }) + '</p></div>';
  }
  function redrawRow(k) { var el = body.querySelector('.ast-row[data-key="' + CSS.escape(k) + '"]'); if (el) el.outerHTML = row(k); }

  /* ---------- Opslaan ---------- */
  function save(k, value, after) {
    var lang = f.lang, ref = flatBase.en[k] || '';
    if (value.trim() && vars(value) !== vars(ref)) { notes[lang + '|' + k] = [t('as.keepVars', { vars: (ref.match(/\{\w+\}/g) || []).join(' ') }), 'bad']; redrawRow(k); return Promise.resolve(false); }
    var o = info.overrides[lang] = info.overrides[lang] || {}, fileVal = flatBase[lang][k] || '';
    var v = value.trim() && value !== fileVal ? value : '';           // gelijk aan het bestand = geen aanpassing nodig
    if ((o[k] || '') === v) return Promise.resolve(true);
    return api.translations.save(lang, { key: k, value: v }).then(function () {
      if (v) o[k] = v; else delete o[k];
      i18n.override(lang, k, v || null);
      notes[lang + '|' + k] = [t(v ? 'as.saved' : 'as.restored'), 'ok']; redrawRow(k);
      setTimeout(function () { delete notes[lang + '|' + k]; }, 2500);
      if (after) after();
      return true;
    }).catch(function () { notes[lang + '|' + k] = [t('myCodes.failed'), 'bad']; redrawRow(k); return false; });
  }
  function translate(list) {
    var texts = list.map(function (k) { return current(f.ref === 'en' || !current(f.ref, k) ? 'en' : f.ref, k) || ''; });
    var from = list.length && f.ref !== 'en' && list.every(function (k) { return current(f.ref, k); }) ? f.ref : 'en';
    return api.translations.translate({ texts: texts, to: f.lang, from: from }).then(function (r) { return r.texts; });
  }

  /* ---------- Gebeurtenissen ---------- */
  body.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-tab]'))) { tab = b.getAttribute('data-tab'); return draw(); }
    if ((b = e.target.closest('[data-lang]'))) { f.lang = b.getAttribute('data-lang'); if (f.ref === f.lang) f.ref = f.lang === 'en' ? 'nl' : 'en'; shown = PAGE; return draw(); }
    if ((b = e.target.closest('[data-status]'))) { f.status = b.getAttribute('data-status'); shown = PAGE; return draw(); }
    if (e.target.closest('[data-more]')) { shown += PAGE * 2; return draw(); }
    var r = e.target.closest('.ast-row'), k = r && r.getAttribute('data-key');
    if (k && e.target.closest('[data-reset]')) return save(k, '', function () { redrawRow(k); });
    if (k && e.target.closest('[data-auto]')) {
      busy[k] = true; redrawRow(k);
      return translate([k]).then(function (out) { delete busy[k]; return save(k, out[0] || ''); })
        .catch(function (x) { delete busy[k]; notes[f.lang + '|' + k] = [deeplErr(x), 'bad']; redrawRow(k); });
    }
    if ((b = e.target.closest('[data-auto-all]'))) {
      var todo = keys.filter(function (x) { return status(f.lang, x) === 'missing'; });
      b.disabled = true; var done = 0;
      var next = function () {
        var part = todo.splice(0, 40); if (!part.length) { draw(); return; }
        b.textContent = t('as.working', { n: done, total: done + part.length + todo.length });
        translate(part).then(function (out) {
          return part.reduce(function (p, key, i) { return p.then(function () { return save(key, out[i] || ''); }); }, Promise.resolve());
        }).then(function () { done += part.length; next(); }).catch(function (x) { alert(deeplErr(x)); draw(); });
      };
      return next();
    }
    if (e.target.closest('[data-key-remove]')) {
      return api.translations.removeKey().then(function () { info.deepl.configured = false; info.deepl.used = info.deepl.limit = null; draw(); });
    }
  });
  function deeplErr(x) { var c = x && x.code; return t(c === 'deepl_key' ? 'as.badKey' : c === 'deepl_quota' ? 'as.quota' : c === 'unsupported_lang' ? 'as.unsupported' : c === 'too_many' ? 'auth.errTooMany' : 'as.unreachable'); }
  body.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-keyform]'); if (!form) return; e.preventDefault();
    var msg = form.querySelector('#asKeyMsg'), btn = form.querySelector('[type=submit]'); btn.disabled = true;
    api.translations.setKey({ key: form.key.value.trim() }).then(function () { return api.translations.all(); }).then(function (r) { info.deepl = r.deepl; draw(); })
      .catch(function (x) { btn.disabled = false; msg.hidden = false; msg.className = 'acct-msg bad'; msg.textContent = t(x && x.code === 'key_format' ? 'as.keyFormat' : x && x.code === 'deepl_key' ? 'as.badKey' : 'myCodes.failed'); });
  });
  body.addEventListener('change', function (e) {
    var k = e.target.getAttribute('data-f'); if (!k || k === 'q') return;
    f[k] = e.target.value; if (k === 'lang' && f.ref === f.lang) f.ref = f.lang === 'en' ? 'nl' : 'en'; shown = PAGE; draw();
  });
  var qTimer = null;
  body.addEventListener('input', function (e) {
    if (e.target.getAttribute('data-f') === 'q') { f.q = e.target.value; clearTimeout(qTimer); qTimer = setTimeout(function () { var pos = e.target.selectionStart; shown = PAGE; draw(); var q = body.querySelector('[data-f="q"]'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }, 200); }
    if (e.target.matches('[data-edit]')) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }
  });
  body.addEventListener('focusout', function (e) {
    if (!e.target.matches('[data-edit]')) return;
    var k = e.target.closest('.ast-row').getAttribute('data-key');
    if (e.target.value !== (current(f.lang, k) || '')) save(k, e.target.value);
  });
  body.addEventListener('keydown', function (e) {
    if (e.target.matches('[data-edit]') && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.target.blur(); }
    if (e.target.matches('[data-edit]') && e.key === 'Escape') { var k = e.target.closest('.ast-row').getAttribute('data-key'); e.target.value = current(f.lang, k) || ''; e.target.blur(); }
  });

  Session.onUser(function (u) { me = u; info = null; f.lang = i18n.lang() === 'en' ? 'nl' : i18n.lang(); });
  document.addEventListener('pagechange', function (e) { if (e.detail === 'adminSettings') load(); });
  i18n.onChange(function () { if (!view.hidden && info) draw(); });
  return { reload: load };
})();
