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
  var PAGE = 40, me = null, tab = 'company', info = null, base = {}, flatBase = {}, keys = [], shown = PAGE, busy = {}, notes = {};
  var f = { lang: 'nl', ref: 'en', q: '', status: '', group: '' };
  var SVG = function (p) { return '<svg class="ast-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var IC = {
    lang: '<path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c-.5 3-3 7-7 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>', search: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', home: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>', tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>', warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>', pulse: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'
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
  // Menu links, in groepen (zoals bij Stripe/Notion). Op de telefoon: een rij knoppen om te schuiven.
  var GROUPS = [
    ['set.gGeneral', [['company', 'home', 'set.tabCompany'], ['signup', 'user', 'set.tabSignup'], ['maint', 'tool', 'set.tabMaint']]],
    ['set.gComms', [['support', 'chat', 'tk.admTab'], ['mail', 'mail', 'set.tabMail']]],
    ['set.gTexts', [['texts', 'lang', 'as.tabTexts'], ['deepl', 'spark', 'as.tabDeepl']]],
    ['set.gSecurity', [['block', 'ban', 'set.tabBlock']]],
    ['set.gSystem', [['system', 'pulse', 'set.tabStatus']]]
  ];
  function tabs() {
    return '<nav class="ast-nav" role="tablist" aria-orientation="vertical">' + GROUPS.map(function (g) {
      return '<p class="ast-nav-g" aria-hidden="true">' + t(g[0]) + '</p>' + g[1].map(function (x) {
        return '<button type="button" role="tab" aria-selected="' + (tab === x[0]) + '" data-tab="' + x[0] + '">' + ico(x[1]) + '<span>' + t(x[2]) + '</span></button>'; }).join('');
    }).join('') + '</nav>';
  }
  function draw() {
    if (!info) return;
    var P = { texts: textsPanel, deepl: deeplPanel, company: companyPanel, signup: signupPanel, maint: maintPanel, mail: mailPanel, block: blockPanel, system: systemPanel, support: supportPanel }[tab] || companyPanel;
    body.innerHTML = '<header class="ast-head"><div><h2>' + t('nav.adminSettings') + '</h2><p>' + t('set.lead') + '</p></div></header>' +
      '<div class="ast-layout">' + tabs() + '<div id="asPanel" class="ast-main' + (tab === 'texts' ? ' wide' : '') + '">' + P() + '</div></div>';
    if (['company', 'signup', 'maint', 'mail', 'system'].indexOf(tab) >= 0 && !sets) loadSets();
    if (tab === 'block' && !blocks) loadBlocks();
    if (tab === 'maint' && !incs) loadIncs();
    if (tab === 'support' && !tks) loadTks();
  }
  function textsPanel() {
    // Onderdelen met een leesbare naam ("Beheer › Alle QR-codes" i.p.v. "ac"), op naam gesorteerd
    var gName = function (g) { var n = t('as.grp_' + g); return n === 'as.grp_' + g ? g : n; };
    var list = rows(), groups = Array.from(new Set(keys.map(function (k) { return k.split('.')[0]; }))).sort(function (a, b) { return gName(a).localeCompare(gName(b), i18n.lang()); });
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
        '<label class="ast-f"><span>' + t('as.section') + '</span><select data-f="group">' + opt('', t('as.allSections'), f.group) + groups.map(function (g) { return opt(g, gName(g), f.group); }).join('') + '</select></label>' +
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

  /* ---------- Bedrijfsgegevens en systeem ---------- */
  var sets = null, sys = null, setMsg = null;
  function loadSets() {
    Promise.all([api.settings.get(), api.admin && api.admin.system ? api.admin.system().catch(function () { return null; }) : Promise.resolve(null)])
      .then(function (r) { sets = r[0]; sys = r[1]; draw(); }).catch(function () { sets = { error: true }; draw(); });
  }
  function companyPanel() {
    if (!sets) return '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    var c = sets.company || {}, e = sets.companyEnv || {};
    var F = [['name', 'set.cName', 'organization'], ['address', 'set.cAddress', 'street-address'], ['kvk', 'set.cKvk', 'off'], ['vat', 'set.cVat', 'off'], ['email', 'set.cEmail', 'email'], ['phone', 'set.cPhone', 'tel'], ['website', 'set.cWebsite', 'url']];
    return '<form class="glass ast-card set-form set-sec" data-set="company"><header class="set-sec-h"><h3>' + t('set.companyTitle') + '</h3><p>' + t('set.companyLead') + '</p></header><div class="set-grid">' +
      F.map(function (f) { return '<label class="auth-f"><span>' + t(f[1]) + '</span><span class="auth-in"><input name="' + f[0] + '" autocomplete="' + f[2] + '" value="' + esc(c[f[0]] || '') + '" placeholder="' + esc(e[f[0]] || '') + '"' + (f[0] === 'email' ? ' type="email"' : f[0] === 'website' ? ' type="url"' : '') + '></span></label>'; }).join('') +
      '</div><p class="set-note">' + t('set.companyNote') + '</p>' + (setMsg && setMsg.k === 'company' ? '<p class="acct-msg ' + setMsg.kind + '" role="status">' + esc(setMsg.text) + '</p>' : '') +
      '<div class="acct-actions"><button type="submit" class="btn primary">' + t('acct.save') + '</button></div></form>';
  }
  // Kop van een onderdeel + rijen "uitleg links, instelling rechts"
  function sec(title, lead, inner, attrs) { return '<form class="glass ast-card set-sec"' + (attrs || '') + '><header class="set-sec-h"><h3>' + title + '</h3>' + (lead ? '<p>' + lead + '</p>' : '') + '</header>' + inner + '</form>'; }
  function srow(label, help, control) { return '<div class="set-row"><div class="set-row-l"><b>' + label + '</b>' + (help ? '<small>' + help + '</small>' : '') + '</div><div class="set-row-c">' + control + '</div></div>'; }
  function msg(k) { return setMsg && setMsg.k === k ? '<p class="acct-msg ' + setMsg.kind + '" role="status">' + esc(setMsg.text) + '</p>' : ''; }
  function saveBar(k) { return msg(k) + '<div class="set-save"><button type="submit" class="btn primary">' + t('acct.save') + '</button></div>'; }
  function seg(name, cur, opts) {
    return '<div class="set-seg" role="radiogroup">' + opts.map(function (o) { return '<label><input type="radio" name="' + name + '" value="' + esc(o[0]) + '"' + (cur === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>'; }).join('') + '</div>';
  }
  function sw(name, on) { return '<label class="set-tog"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '><i aria-hidden="true"></i></label>'; }

  function signupPanel() {
    if (!sets) return '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    var p = sets.platform || {}, e = sets.platformEnv || {};
    return sec(t('set.suTitle'), t('set.suLead'),
      srow(t('set.suMode'), t('set.suModeHelp'), seg('signup', p.signup || '', [['', t('set.suEnv', { state: t(e.signup ? 'set.stOpen' : 'set.stClosed') })], ['open', t('set.suOpen')], ['closed', t('set.suClosed')]])) +
      srow(t('set.suNotify'), t('set.suNotifyHelp', { email: esc(p.contactEmail || e.contactEmail || 'support@optimasys.es') }), sw('notifySignup', p.notifySignup)) +
      saveBar('platform-signup'), ' data-set="platform-signup"');
  }
  function maintPanel() {
    if (!sets) return '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    var m = sets.maintenance || {};
    return sec(t('set.mTitle'), t('set.mLead'),
      srow(t('set.mOn'), m.on && m.by ? esc(m.by) + (m.at ? ' · ' + esc(i18n.fmt.stamp(m.at, 'long')) : '') : '', sw('on', m.on)) +
      srow(t('set.mMsg'), '', '<span class="auth-in"><input name="message" maxlength="300" value="' + esc(m.message || '') + '" placeholder="' + esc(t('set.mPh')) + '"></span>') +
      saveBar('maintenance'), ' data-set="maintenance"') + incPanel();
  }
  /* Supportvragen van klanten: beantwoorden (klant krijgt een mail), status zetten */
  var tks = null, tkFilter = 'open', tkSel = null;
  function loadTks() { api.adminTickets.list().then(function (r) { tks = r.tickets || []; draw(); }).catch(function () { tks = []; draw(); }); }
  function supportPanel() {
    if (!tks) return '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    var when = function (iso) { return esc(i18n.fmt.stamp(iso, 'time')); };
    var n = function (s) { return tks.filter(function (x) { return s === 'all' || x.status === s; }).length; };
    var list = tks.filter(function (x) { return tkFilter === 'all' || x.status === tkFilter; });
    return '<div class="glass ast-card set-sec"><header class="set-sec-h"><h3>' + t('tk.admTitle') + '</h3><p>' + t('tk.admLead') + '</p></header>' +
      '<div class="tk-filt" role="group">' + ['open', 'answered', 'closed', 'all'].map(function (s) { return '<button type="button" class="chip" data-tkf="' + s + '" aria-pressed="' + (tkFilter === s) + '">' + t(s === 'all' ? 'tk.all' : 'tk.s_' + s) + ' <em>' + n(s) + '</em></button>'; }).join('') + '</div>' +
      (!list.length ? '<p class="muted-msg">' + t('tk.none') + '</p>' : '<ul class="tk-list adm">' + list.map(function (x) {
        var open = tkSel === x.id, last = x.messages[x.messages.length - 1];
        return '<li class="tk-item" data-atk="' + esc(x.id) + '"><button type="button" class="tk-head" data-atk-toggle aria-expanded="' + open + '"><span class="tk-st ' + x.status + '">' + t('tk.s_' + x.status) + '</span>' +
          '<span class="tk-sub"><b>' + esc(x.name) + ' · ' + esc(t('contact.topics.' + x.topic)) + ' · #' + esc(x.id) + '</b><small>' + esc(x.email) + ' — ' + esc(last.text.slice(0, 80)) + '</small></span><span class="tk-when">' + when(x.updatedAt) + '</span></button>' +
          (open ? '<div class="tk-body"><ol class="tk-thread">' + x.messages.map(function (m) { return '<li class="tk-msg ' + (m.from === 'team' ? 'customer' : 'team') + '"><small>' + esc(m.by) + ' · ' + when(m.at) + '</small><p>' + esc(m.text) + '</p></li>'; }).join('') + '</ol>' +
            '<form class="tk-reply" data-atk-reply><textarea name="text" rows="4" maxlength="4000" placeholder="' + esc(t('tk.admReplyPh')) + '" aria-label="' + esc(t('tk.reply')) + '"></textarea>' +
            '<div class="tk-acts">' + (x.status !== 'closed' ? '<button type="button" class="btn ghost sm" data-atk-st="closed">' + t('tk.close') + '</button>' : '<button type="button" class="btn ghost sm" data-atk-st="open">' + t('tk.reopen') + '</button>') +
            '<button class="btn primary sm" type="submit">' + t('tk.admSend') + '</button></div></form></div>' : '') + '</li>';
      }).join('') + '</ul>') + '</div>';
  }
  body.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-tkf]'))) { tkFilter = b.getAttribute('data-tkf'); return draw(); }
    if ((b = e.target.closest('[data-atk-toggle]'))) { var id = b.closest('[data-atk]').getAttribute('data-atk'); tkSel = tkSel === id ? null : id; draw(); var f = body.querySelector('[data-atk="' + id + '"] textarea'); if (f) f.focus(); return; }
    if ((b = e.target.closest('[data-atk-st]'))) { b.disabled = true; return api.adminTickets.status(b.closest('[data-atk]').getAttribute('data-atk'), b.getAttribute('data-atk-st')).then(function (r) { tks = r.tickets; draw(); }); }
  });
  body.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-atk-reply]'); if (!f) return; e.preventDefault();
    var txt = f.text.value.trim(); if (txt.length < 2) return f.text.focus();
    f.querySelector('[type=submit]').disabled = true;
    api.adminTickets.reply(f.closest('[data-atk]').getAttribute('data-atk'), txt).then(function (r) { tks = r.tickets; draw(); }, function () { f.querySelector('[type=submit]').disabled = false; });
  });
  /* Storingen en meldingen: klanten zien een rode balk in de app en de melding op /status */
  var incs = null, incMsg = null;
  function loadIncs() { api.incidents.list().then(function (r) { incs = r.incidents || []; draw(); }).catch(function () { incs = []; draw(); }); }
  function incDone(r) { incs = r.incidents || []; incMsg = null; draw(); document.dispatchEvent(new Event('incidents-change')); }
  function incFail() { incMsg = t('myCodes.failed'); draw(); }
  function incPanel() {
    var when = function (iso) { return esc(i18n.fmt.stamp(iso, 'time')); };
    var list = !incs ? '<p class="muted-msg">' + t('myCodes.loading') + '</p>' : !incs.length ? '<p class="muted-msg">' + t('set.iEmpty') + '</p>' :
      '<ul class="inc-list">' + incs.map(function (i) {
        var open = i.status === 'open';
        return '<li class="inc ' + (open ? 'open' : 'solved') + '" data-inc="' + esc(i.id) + '"><div class="inc-h"><b>' + esc(i.title) + '</b><span class="inc-tag">' + t(open ? 'set.iOpen' : 'set.iSolved') + '</span></div>' +
          '<small>' + when(i.at) + (i.solvedAt ? ' → ' + when(i.solvedAt) : '') + '</small>' + (i.text ? '<p>' + esc(i.text).replace(/\n/g, '<br>') + '</p>' : '') +
          ((i.updates || []).length ? '<ol class="inc-ups">' + i.updates.map(function (u) { return '<li><small>' + when(u.at) + '</small> ' + esc(u.text) + '</li>'; }).join('') + '</ol>' : '') +
          (open ? '<form class="inc-upd" data-incupd><span class="auth-in"><input name="update" maxlength="1000" placeholder="' + esc(t('set.iUpdate')) + '" aria-label="' + esc(t('set.iUpdate')) + '"></span><button type="submit" class="btn ghost sm">' + t('set.iUpdateAdd') + '</button></form>' : '') +
          '<div class="inc-acts"><button type="button" class="btn ' + (open ? 'primary' : 'ghost') + ' sm" data-incstate="' + (open ? 'solved' : 'open') + '">' + t(open ? 'set.iSolve' : 'set.iReopen') + '</button>' +
          '<button type="button" class="btn ghost sm" data-incdel>' + t('set.iDelete') + '</button></div></li>';
      }).join('') + '</ul>';
    return '<div class="glass ast-card set-sec"><header class="set-sec-h"><h3>' + t('set.iTitle') + '</h3><p>' + t('set.iLead') + ' <a href="status" target="_blank" rel="noopener">' + t('set.iPage') + ' →</a></p></header>' +
      '<form class="inc-new" data-incform><b>' + t('set.iNew') + '</b><label class="auth-f"><span>' + t('set.iTitleF') + '</span><span class="auth-in"><input name="title" maxlength="120" required></span></label>' +
      '<label class="auth-f"><span>' + t('set.iText') + '</span><span class="auth-in"><textarea name="text" rows="3" maxlength="2000"></textarea></span></label>' +
      '<div class="set-save"><button type="submit" class="btn primary">' + t('set.iAdd') + '</button></div></form>' +
      (incMsg ? '<p class="acct-msg bad" role="alert">' + esc(incMsg) + '</p>' : '') + list + '</div>';
  }
  var testMsg = null;
  function mailPanel() {
    if (!sets) return '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    var p = sets.platform || {}, e = sets.platformEnv || {}, on = !!e.mail;
    var dot = function (ok, txt) { return '<span class="set-state ' + (ok ? 'ok' : 'off') + '"><i></i>' + txt + '</span>'; };
    return sec(t('set.mailTitle'), t('set.mailLead'),
      srow(t('set.mailServer'), on ? '' : t('set.mailOffHelp'), dot(on, t(on ? 'set.sOn' : 'set.sMailOff'))) +
      srow(t('set.mailFrom'), t('set.mailFromHelp'), '<code class="set-code">' + esc(e.mailFrom || '–') + '</code>') +
      srow(t('set.mailTeam'), t('set.mailTeamHelp'), '<span class="auth-in"><input type="email" name="contactEmail" value="' + esc(p.contactEmail || '') + '" placeholder="' + esc(e.contactEmail || 'support@optimasys.es') + '"></span>') +
      srow(t('set.mailTest'), t('set.mailTestHelp', { email: esc(me && me.email || '') }), '<button type="button" class="btn ghost" data-test-mail' + (on ? '' : ' disabled') + '>' + ico('mail') + t('set.mailTestBtn') + '</button>' +
        (testMsg ? '<p class="acct-msg ' + testMsg.kind + '" role="status">' + esc(testMsg.text) + '</p>' : '')) +
      saveBar('platform-mail'), ' data-set="platform-mail"');
  }
  function systemPanel() {
    if (!sets) return '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    var row = function (ok, label, val) { return '<li><i class="set-dot ' + (ok ? 'ok' : 'off') + '"></i><b>' + label + '</b><span>' + val + '</span></li>'; };
    var bk = sys && sys.backup && sys.backup.last, m = sets.maintenance || {};
    return '<div class="glass ast-card set-sec"><header class="set-sec-h"><h3>' + t('set.statusTitle') + '</h3><p>' + t('set.statusLead') + '</p></header><ul class="set-status">' +
        row(!(sys && sys.db && sys.db.ok === false), t('set.sDb'), esc((sys && sys.db && sys.db.kind) || '–')) +
        row(!!(sys && sys.mail && sys.mail.configured), t('set.sMail'), t(sys && sys.mail && sys.mail.configured ? 'set.sOn' : 'set.sMailOff')) +
        row(!!(sys && sys.deepl && sys.deepl.configured), t('set.sDeepl'), t(sys && sys.deepl && sys.deepl.configured ? 'set.sOn' : 'set.sOff')) +
        row(!!bk, t('set.sBackup'), bk ? esc(i18n.fmt.stamp(bk.at || bk, 'long')) : t('set.sNever')) +
        row(!m.on, t('set.mTitle'), t(m.on ? 'set.sOn' : 'set.sOff')) +
      '</ul></div>';
  }

  /* ---------- Blokkeerlijst: deze adressen/domeinen kunnen geen nieuw account maken (Terms punt 14) ---------- */
  var blocks = null, blockMsg = null;
  function loadBlocks() {
    api.admin.blocklist().then(function (r) { blocks = r.items || []; if (tab === 'block') draw(); }).catch(function () { blocks = []; blockMsg = { kind: 'bad', text: t('myCodes.failed') }; if (tab === 'block') draw(); });
  }
  function blockPanel() {
    var form = '<form class="glass ast-card set-form" data-blockform><h3>' + t('set.bTitle') + '</h3><p>' + t('set.bLead') + '</p><div class="set-grid">' +
      '<label class="auth-f"><span>' + t('set.bValue') + '</span><span class="auth-in"><input name="value" required maxlength="254" placeholder="' + esc(t('set.bPh')) + '" autocomplete="off"></span></label>' +
      '<label class="auth-f"><span>' + t('set.bNote') + '</span><span class="auth-in"><input name="note" maxlength="200" placeholder="' + esc(t('set.bNotePh')) + '"></span></label></div>' +
      (blockMsg ? '<p class="acct-msg ' + blockMsg.kind + '" role="status">' + esc(blockMsg.text) + '</p>' : '') +
      '<div class="acct-actions"><button type="submit" class="btn primary">' + ico('ban') + t('set.bAdd') + '</button></div></form>';
    if (!blocks) return form + '<p class="muted-msg">' + t('myCodes.loading') + '</p>';
    return form + '<div class="glass ast-card"><h3>' + t('set.bListTitle', { n: blocks.length }) + '</h3>' + (!blocks.length ? '<p class="muted-msg">' + t('set.bEmpty') + '</p>' :
      '<ul class="bl-list">' + blocks.map(function (b) {
        var acc = (b.accounts || []).filter(function (a) { return !a.disabled; });
        return '<li><span class="bl-v">' + ico('ban') + '<b>' + esc(b.v) + '</b>' + (b.v.charAt(0) === '@' ? '<em>' + t('set.bDomain') + '</em>' : '') + '</span>' +
          '<span class="bl-meta">' + esc([b.note, b.by, b.at && i18n.fmt.stamp(b.at, 'date')].filter(Boolean).join(' · ')) +
            (acc.length ? '<span class="bl-warn">' + ico('warn') + t('set.bStillActive', { list: acc.map(function (a) { return esc(a.email); }).join(', ') }) + '</span>' : '') + '</span>' +
          '<button type="button" class="btn ghost" data-unblock="' + esc(b.v) + '">' + ico('x') + t('set.bRemove') + '</button></li>';
      }).join('') + '</ul>') + '</div>';
  }

  /* ---------- Gebeurtenissen ---------- */
  body.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-tab]'))) { tab = b.getAttribute('data-tab'); return draw(); }
    if ((b = e.target.closest('[data-incstate]'))) { b.disabled = true; return api.incidents.edit(b.closest('[data-inc]').getAttribute('data-inc'), { status: b.getAttribute('data-incstate') }).then(incDone).catch(incFail); }
    if ((b = e.target.closest('[data-incdel]'))) { if (!confirm(t('set.iConfirm'))) return; b.disabled = true; return api.incidents.remove(b.closest('[data-inc]').getAttribute('data-inc')).then(incDone).catch(incFail); }
    if ((b = e.target.closest('[data-lang]'))) { f.lang = b.getAttribute('data-lang'); if (f.ref === f.lang) f.ref = f.lang === 'en' ? 'nl' : 'en'; shown = PAGE; return draw(); }
    if ((b = e.target.closest('[data-status]'))) { f.status = b.getAttribute('data-status'); shown = PAGE; return draw(); }
    if (e.target.closest('[data-more]')) { shown += PAGE * 2; return draw(); }
    if ((b = e.target.closest('[data-test-mail]'))) {
      b.disabled = true; testMsg = null;
      return api.admin.testMail().then(function (r) { testMsg = { kind: 'ok', text: t('set.mailTestOk', { email: r.to }) }; draw(); })
        .catch(function (x) { testMsg = { kind: 'bad', text: t('set.mailTestBad', { msg: (x && x.data && x.data.message) || (x && x.code) || '' }) }; draw(); });
    }
    if ((b = e.target.closest('[data-unblock]'))) {
      b.disabled = true; var v = b.getAttribute('data-unblock');
      return api.admin.unblock(v).then(function () { blocks = blocks.filter(function (x) { return x.v !== v; }); blockMsg = { kind: 'ok', text: t('set.bRemoved', { v: v }) }; draw(); })
        .catch(function () { b.disabled = false; blockMsg = { kind: 'bad', text: t('myCodes.failed') }; draw(); });
    }
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
    var nf = e.target.closest('[data-incform]');
    if (nf) { e.preventDefault(); nf.querySelector('[type=submit]').disabled = true; return api.incidents.add({ title: nf.title.value, text: nf.text.value }).then(incDone).catch(incFail); }
    var uf = e.target.closest('[data-incupd]');
    if (uf) { e.preventDefault(); if (!uf.update.value.trim()) return; uf.querySelector('[type=submit]').disabled = true; return api.incidents.edit(uf.closest('[data-inc]').getAttribute('data-inc'), { update: uf.update.value }).then(incDone).catch(incFail); }
    var bf = e.target.closest('[data-blockform]');
    if (bf) {
      e.preventDefault(); var bb = bf.querySelector('[type=submit]'); bb.disabled = true;
      return api.admin.block({ value: bf.value.value, note: bf.note.value }).then(function (r) { blockMsg = { kind: 'ok', text: t('set.bAdded', { v: r.v }) }; blocks = null; loadBlocks(); draw(); })
        .catch(function (x) { blockMsg = { kind: 'bad', text: t(x && x.code === 'block_self' ? 'set.bSelf' : x && x.code === 'block_value' ? 'set.bBad' : 'myCodes.failed') }; draw(); });
    }
    var sf = e.target.closest('[data-set]');
    if (sf) {
      e.preventDefault(); var k = sf.getAttribute('data-set'), go = sf.querySelector('[type=submit]'); go.disabled = true;
      var d = {};
      if (k === 'company') { d.company = {}; ['name', 'address', 'kvk', 'vat', 'email', 'phone', 'website'].forEach(function (n) { d.company[n] = sf[n].value; }); }
      else if (k === 'platform-signup') { var r = sf.querySelector('input[name=signup]:checked'); d.platform = { signup: r ? r.value || null : null, notifySignup: sf.notifySignup.checked }; }
      else if (k === 'platform-mail') d.platform = { contactEmail: sf.contactEmail.value };
      else d.maintenance = { on: sf.on.checked, message: sf.message.value };
      return api.settings.save(d).then(function (r) { sets = r; setMsg = { k: k, kind: 'ok', text: t('acct.saved') }; draw(); setTimeout(function () { if (setMsg && setMsg.k === k) { setMsg = null; draw(); } }, 3000); })
        .catch(function (x) { setMsg = { k: k, kind: 'bad', text: t(x && x.details ? 'set.errFields' : 'set.errSave', { f: (x && x.details || []).map(function (f) { return f === 'contactEmail' ? t('set.mailTeam') : t('set.c' + f.charAt(0).toUpperCase() + f.slice(1)); }).join(', ') }) }; draw(); });
    }
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
