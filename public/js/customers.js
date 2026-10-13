/* =========================================================
   KLANTEN (alleen zichtbaar voor het team)
   Optimasys verkoopt licenties: klanten maken niet zelf een account.
   Hier voegt het team een klant toe (naam + e-mail). De klant krijgt een mail om een wachtwoord te kiezen
   (7 dagen geldig). Is er geen mailserver, dan toont de pagina de link om zelf te sturen.
   Lijst met alle accounts: zoeken, filter op status en rol, opnieuw uitnodigen, uitzetten/aanzetten,
   admin maken (alleen de super-admin) en verwijderen.
   Server: /api/admin/customers (auth/admin.controller.ts).
   ========================================================= */
(function () {
  var box = document.getElementById('customersPage'), nav = document.getElementById('navCustomers');
  var me = null, list = null, query = '', fStatus = '', fRole = '', showForm = false, form = { name: '', email: '', lang: '' }, bad = [], result = null, busy = false, loadErr = false;
  var SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
  var ICON = {
    add: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.6 3.6-5.5 6.5-5.5 1.6 0 3.1.6 4.3 1.6M18 13v6M15 16h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.4-4 4.4-6 8-6s6.6 2 8 6"/>',
    off: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    on: '<path d="M12 3v9"/><path d="M6.3 7.3a8 8 0 1 0 11.4 0"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  function date(iso) { return iso ? new Date(iso).toLocaleDateString(i18n.lang(), { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function statusKey(c) { return c.disabledAt ? 'disabled' : c.active ? 'active' : 'invited'; }
  function roleBadge(c) {
    return c.level === 'super' ? '<i class="ad-role super">' + SVG + ICON.shield + '</svg>' + t('adm.rSuper') + '</i>' : c.level === 'admin' ? '<i class="ad-role admin">' + t('adm.rAdmin') + '</i>' : '<i class="ad-role">' + t('adm.rUser') + '</i>';
  }
  function status(c) {
    if (c.disabledAt) return ['off', t('adm.sDisabled'), t('adm.since', { date: date(c.disabledAt) })];
    if (c.active) return ['ok', t('cust.active')];
    if (c.inviteUntil && c.inviteUntil > new Date().toISOString()) return ['wait', t('cust.invited'), t('cust.until', { date: date(c.inviteUntil) })];
    return ['bad', t('cust.expired')];
  }
  function load() {
    if (!me || !me.admin) return;
    api.customers.list().then(function (r) { list = r; loadErr = false; draw(); }).catch(function () { loadErr = true; draw(); });
  }
  function field(k, label, input) {
    var isBad = bad.indexOf(k) >= 0;
    return '<label class="auth-f"><span>' + label + '</span><span class="auth-in acct-ic">' + SVG + ICON[k === 'email' ? 'mail' : 'person'] + '</svg>' + input.replace('>', (isBad ? ' aria-invalid="true"' : '') + '>') + '</span>' +
      (isBad ? '<small class="acct-err">' + (String(form[k] || '').trim() ? t('acct.errInvalid') : t('acct.errRequired')) + '</small>' : '') + '</label>';
  }
  function resultHtml() {
    if (!result) return '';
    var msg = '<p class="acct-msg ' + result.kind + '" role="status">' + esc(result.text) + '</p>';
    if (!result.link) return msg;
    return msg + '<div class="cust-link"><p>' + t('cust.noMail') + '</p><div class="cust-copy"><input readonly value="' + esc(result.link) + '" aria-label="' + esc(t('cust.inviteLink')) + '"><button type="button" class="btn ghost" data-copy>' + SVG + ICON.copy + '</svg>' + t('cust.copy') + '</button></div></div>';
  }
  function rows() {
    if (loadErr) return '<p class="acct-msg bad">' + t('auth.errGeneral') + '</p>';
    if (!list) return '<p class="cust-empty">…</p>';
    var q = query.toLowerCase(), shown = list.filter(function (c) {
      return (!q || (c.name + ' ' + c.email).toLowerCase().indexOf(q) >= 0) && (!fStatus || statusKey(c) === fStatus) && (!fRole || (fRole === 'team' ? c.level !== 'user' : c.level === 'user'));
    });
    if (!shown.length) return '<p class="cust-empty">' + (q ? t('cust.none', { q: '<b>' + esc(query) + '</b>' }) : list.length ? t('adm.noMatchUsers') : t('cust.empty')) + '</p>';
    var sup = me && me.superAdmin;
    return '<div class="cust-table ad-users" role="table" aria-label="' + esc(t('nav.users')) + '">' +
      '<div class="cust-tr cust-th" role="row"><span role="columnheader">' + t('adm.user') + '</span><span role="columnheader">' + t('adm.role') + '</span><span role="columnheader">' + t('cust.status') + '</span><span role="columnheader">' + t('acct.codes') + '</span><span role="columnheader">' + t('an.scans') + '</span><span role="columnheader">' + t('adm.lastLogin') + '</span><span role="columnheader"><span class="sr-only">' + t('cust.actions') + '</span></span></div>' +
      shown.map(function (c) {
        var s = status(c), self = c.id === me.id, canEdit = !self && c.level !== 'super' && (c.level === 'user' || sup);
        var roleCell = sup && !self && c.level !== 'super' && !c.fixed
          ? '<label class="ad-rolesel"><span class="sr-only">' + t('adm.role') + '</span><select data-role>' + ['user', 'admin'].map(function (r) { return '<option value="' + r + '"' + (c.level === r ? ' selected' : '') + '>' + t(r === 'admin' ? 'adm.rAdmin' : 'adm.rUser') + '</option>'; }).join('') + '</select></label>'
          : roleBadge(c);
        return '<div class="cust-tr' + (c.disabledAt ? ' is-off' : '') + '" role="row" data-id="' + esc(c.id) + '">' +
          '<span role="cell" class="cust-who ad-who">' + Admin.avatar(c.name, c.email) + '<span><b>' + esc(c.name || c.email) + (self ? ' <em class="cust-team">' + t('adm.you') + '</em>' : '') + '</b><small>' + esc(c.email) + '</small></span></span>' +
          '<span role="cell"><span class="cust-lbl">' + t('adm.role') + ': </span>' + roleCell + '</span>' +
          '<span role="cell"><i class="cust-badge ' + s[0] + '">' + s[1] + '</i>' + (s[2] ? '<small class="cust-sub">' + s[2] + '</small>' : '') + '</span>' +
          '<span role="cell" class="cust-muted"><span class="cust-lbl">' + t('acct.codes') + ': </span>' + i18n.fmt.num(c.codes) + '</span>' +
          '<span role="cell" class="cust-muted"><span class="cust-lbl">' + t('an.scans') + ': </span>' + i18n.fmt.num(c.scans || 0) + '</span>' +
          '<span role="cell" class="cust-muted"><span class="cust-lbl">' + t('adm.lastLogin') + ': </span>' + (c.lastLoginAt ? Admin.ago(c.lastLoginAt) : t('adm.never')) + '<small class="cust-sub">' + t('cust.added') + ' ' + date(c.createdAt) + '</small></span>' +
          '<span role="cell" class="cust-acts">' + (!c.active && !c.disabledAt ? '<button type="button" class="btn ghost" data-reinvite>' + SVG + ICON.mail + '</svg>' + t('cust.reinvite') + '</button>' : '') +
            (canEdit ? '<button type="button" class="btn ghost ' + (c.disabledAt ? '' : 'warn-ghost') + '" data-toggle>' + SVG + (c.disabledAt ? ICON.on : ICON.off) + '</svg>' + t(c.disabledAt ? 'adm.enable' : 'adm.disable') + '</button>' : '') +
            (canEdit && !c.fixed ? '<button type="button" class="btn ghost danger-ghost cust-del" data-remove aria-label="' + esc(t('cust.remove') + ': ' + (c.name || c.email)) + '" title="' + esc(t('cust.remove')) + '">' + SVG + ICON.trash + '</svg></button>' : '') + '</span>' +
        '</div>';
      }).join('') + '</div>';
  }
  function counts() {
    if (!list) return '';
    var n = function (k) { return list.filter(function (c) { return statusKey(c) === k; }).length; };
    return t('adm.userCounts', { active: i18n.fmt.num(n('active')), invited: i18n.fmt.num(n('invited')), disabled: i18n.fmt.num(n('disabled')) });
  }
  function draw() {
    if (!box || !me || !me.admin) return;
    var sel = function (id, cur, opts) { return '<label class="ad-sel"><span class="sr-only">' + opts[0][1] + '</span><select id="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>'; };
    box.innerHTML = '<header class="help-head ad-head"><div><h2>' + t('nav.users') + '</h2><p>' + t('cust.lead') + '</p></div>' +
        '<div class="ad-head-acts"><button type="button" class="btn ' + (showForm ? 'ghost' : 'primary') + '" data-showform aria-expanded="' + showForm + '">' + SVG + (showForm ? ICON.x : ICON.plus) + '</svg>' + t(showForm ? 'myCodes.cancel' : 'cust.addTitle') + '</button></div></header>' +
      (showForm ? '<form class="glass bg-card cust-add" data-add novalidate><h3>' + SVG + ICON.add + '</svg>' + t('cust.addTitle') + '</h3><p class="cust-addlead">' + t('cust.addLead') + '</p>' +
        '<div class="cust-grid">' + field('name', t('auth.name'), '<input name="name" maxlength="80" autocomplete="off" value="' + esc(form.name) + '">') +
        field('email', t('auth.email'), '<input name="email" type="email" maxlength="254" autocomplete="off" spellcheck="false" value="' + esc(form.email) + '">') +
        '<label class="auth-f"><span>' + t('cust.mailLang') + '</span><span class="auth-in"><select name="lang">' + LANGUAGES.map(function (l) { return '<option value="' + l.code + '"' + (l.code === (form.lang || i18n.lang()) ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></span></label>' +
        '<button class="btn primary" type="submit"' + (busy ? ' disabled' : '') + '>' + t('cust.send') + '</button></div>' + resultHtml() + '</form>' : (result ? '<div class="glass bg-card cust-add">' + resultHtml() + '</div>' : '')) +
      '<div class="glass bg-card cust-list"><div class="cust-bar"><h3>' + t('cust.all') + ' <small>' + counts() + '</small></h3>' +
        '<div class="ad-filters"><label class="help-search cust-search">' + SVG + ICON.search + '</svg><span class="sr-only">' + t('cust.search') + '</span><input type="search" id="custSearch" placeholder="' + esc(t('cust.search')) + '" value="' + esc(query) + '" autocomplete="off"></label>' +
        sel('custStatus', fStatus, [['', t('adm.allStatuses')], ['active', t('cust.active')], ['invited', t('cust.invited')], ['disabled', t('adm.sDisabled')]]) +
        sel('custRole', fRole, [['', t('adm.allRoles')], ['team', t('adm.rTeam')], ['user', t('adm.rUser')]]) + '</div></div>' +
        '<div id="custRows">' + rows() + '</div></div>';
  }
  function redrawRows() { var r = document.getElementById('custRows'); if (r) r.innerHTML = rows(); }
  function errText(x) {
    return x && x.code === 'exists' ? t('cust.exists') : x && x.code === 'active' ? t('cust.alreadyActive') : x && x.code === 'team_member' ? t('cust.cantRemove') : x && x.code === 'super_only' ? t('adm.superOnly') : t('auth.errGeneral');
  }

  if (box) {
    box.addEventListener('input', function (e) {
      if (e.target.id === 'custSearch') { query = e.target.value.trim(); return redrawRows(); }
      var n = e.target.name; if (n && n in form) { form[n] = e.target.value; if (e.target.getAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); var m = e.target.closest('.auth-f').querySelector('.acct-err'); if (m) m.remove(); bad = bad.filter(function (k) { return k !== n; }); } }
    });
    box.addEventListener('submit', function (e) {
      e.preventDefault(); result = null;
      bad = [];
      if (!form.name.trim()) bad.push('name');
      if (!form.email.trim() || !EmailCheck.valid(form.email.trim())) bad.push('email');
      if (bad.length) { draw(); var f = box.querySelector('[aria-invalid="true"]'); if (f) f.focus(); return; }
      busy = true; draw();
      var sel = box.querySelector('select[name=lang]');
      api.customers.add({ name: form.name.trim(), email: form.email.trim(), lang: (sel && sel.value) || i18n.lang() }).then(function (r) {
        busy = false; result = { kind: 'ok', text: t('cust.sent', { email: form.email.trim() }), link: r.link };
        form.name = ''; form.email = ''; showForm = false; load(); draw();
      }).catch(function (x) { busy = false; bad = (x && x.details) || []; result = { kind: 'bad', text: errText(x) }; draw(); });
    });
    box.addEventListener('click', function (e) {
      var row = e.target.closest('[data-id]'), id = row && row.getAttribute('data-id'), c = id && list && list.filter(function (x) { return x.id === id; })[0];
      if (e.target.closest('[data-copy]')) {
        var inp = box.querySelector('.cust-copy input'); inp.select();
        (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).catch(function () { document.execCommand('copy'); });
        var b = e.target.closest('[data-copy]'); b.lastChild.textContent = t('cust.copied'); return;
      }
      if (e.target.closest('[data-showform]')) { showForm = !showForm; if (!showForm) { bad = []; } result = null; draw(); if (showForm) { var i = box.querySelector('input[name=name]'); if (i) i.focus(); } return; }
      if (e.target.closest('[data-toggle]') && c) {
        var turnOff = !c.disabledAt;
        var go = function () {
          return api.customers.update(id, { disabled: turnOff }).then(function () { result = { kind: 'ok', text: t(turnOff ? 'adm.disabledMsg' : 'adm.enabledMsg', { email: c.email }) }; load(); draw(); })
            .catch(function (x) { result = { kind: 'bad', text: errText(x) }; draw(); });
        };
        if (!turnOff) return go();
        var dd = document.getElementById('mcDialog');
        dd.innerHTML = '<form method="dialog" class="mc-dlg"><span class="mc-dlg-ic">' + SVG.replace('aria-hidden="true"', 'class="mc-i" aria-hidden="true"') + ICON.off + '</svg></span>' +
          '<h3>' + t('adm.disableTitle', { name: esc(c.name || c.email) }) + '</h3><p>' + t('adm.disableText') + '</p>' +
          '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok" id="custOffGo">' + t('adm.disable') + '</button></div></form>';
        dd.querySelector('#custOffGo').addEventListener('click', function (ev) { ev.preventDefault(); dd.close(); go(); });
        return dd.showModal();
      }
      if (e.target.closest('[data-reinvite]') && c) {
        e.target.closest('[data-reinvite]').disabled = true;
        return api.customers.reinvite(id, { lang: i18n.lang() }).then(function (r) { result = { kind: 'ok', text: t('cust.sent', { email: c.email }), link: r.link }; load(); draw(); var m = box.querySelector('.cust-add .acct-msg'); if (m) m.scrollIntoView({ block: 'center' }); })
          .catch(function (x) { result = { kind: 'bad', text: errText(x) }; draw(); });
      }
      if (e.target.closest('[data-remove]') && c) {
        var d = document.getElementById('mcDialog');
        d.innerHTML = '<form method="dialog" class="mc-dlg"><span class="mc-dlg-ic">' + SVG.replace('aria-hidden="true"', 'class="mc-i" aria-hidden="true"') + ICON.trash + '</svg></span>' +
          '<h3>' + t('cust.removeTitle', { name: esc(c.name || c.email) }) + '</h3><p>' + t('cust.removeText') + '</p>' +
          '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok" id="custDelGo">' + t('cust.remove') + '</button></div></form>';
        d.querySelector('#custDelGo').addEventListener('click', function (ev) {
          ev.preventDefault();
          api.customers.remove(id).then(function () { d.close(); result = { kind: 'ok', text: t('cust.removed', { email: c.email }) }; load(); draw(); })
            .catch(function (x) { d.close(); result = { kind: 'bad', text: errText(x) }; draw(); });
        });
        d.showModal();
      }
    });
    box.addEventListener('change', function (e) {
      if (e.target.name === 'lang') form.lang = e.target.value;
      if (e.target.id === 'custStatus') { fStatus = e.target.value; redrawRows(); }
      if (e.target.id === 'custRole') { fRole = e.target.value; redrawRows(); }
      if (e.target.hasAttribute('data-role')) {   // alleen de super-admin ziet deze keuze
        var id = e.target.closest('[data-id]').getAttribute('data-id'), sel = e.target; sel.disabled = true;
        api.customers.update(id, { role: sel.value }).then(function () { result = { kind: 'ok', text: t('adm.roleSaved') }; load(); draw(); })
          .catch(function (x) { result = { kind: 'bad', text: errText(x) }; draw(); });
      }
    });
    document.addEventListener('admin-add-user', function () { showForm = true; result = null; draw(); setTimeout(function () { var i = box.querySelector('input[name=name]'); if (i) i.focus(); }, 60); });
  }

  Session.onUser(function (u) {
    me = u; var admin = !!(u && u.admin);
    if (nav) nav.hidden = !admin;
    if (admin) { draw(); load(); }
  });
  document.addEventListener('pagechange', function (e) { if (e.detail === 'customers') { draw(); load(); } });
  i18n.onChange(draw);
})();
