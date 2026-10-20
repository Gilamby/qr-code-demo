/* =========================================================
   TEAM in Mijn account (Pro: 3 mensen, Business: onbeperkt)
   Eigenaar: collega's uitnodigen, rol kiezen (bewerker / kijker), verwijderen, en zien wie wat deed.
   Teamlid: ziet van wiens team hij is; betalen en abonnement horen bij de eigenaar.
   Kijker: kan niets wijzigen (knoppen voor maken zijn verborgen; de server weigert het ook).
   ========================================================= */
var Team = (function () {
  var info = null, log = null, busy = false, msg = null, form = { email: '', name: '', role: 'editor' }, link = null;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); };
  function redraw() { if (window.openAccountTab && document.getElementById('acctTab-team') && document.getElementById('acctTab-team').getAttribute('aria-selected') === 'true') openAccountTab('team'); }
  function load() {
    if (busy || !window.api || !api.team || api.isDemo()) return;
    busy = true;
    Promise.all([api.team.get(), api.team.log().catch(function () { return { log: [] }; })]).then(function (r) {
      busy = false; info = r[0]; log = r[1].log || []; apply(); redraw();
      document.dispatchEvent(new CustomEvent('team-loaded'));          // Mijn account: tab Team tonen of verbergen
    }).catch(function () { busy = false; info = { error: true }; redraw(); });
  }
  // Lid van een team: banner en (bij kijker) geen maak-knoppen
  function apply() {
    var m = info && info.member;
    var up = document.getElementById('upCard'); if (up && m) up.hidden = true;
    document.body.classList.toggle('team-viewer', !!(m && m.role === 'viewer'));
    var bar = document.getElementById('teamBar');
    if (!m) { if (bar) bar.hidden = true; return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'teamBar'; bar.className = 'maint-bar sub-bar sub-info'; var main = document.querySelector('.main'); if (main) main.insertBefore(bar, main.children[1] || null); }
    bar.hidden = false; bar.innerHTML = '<b>' + esc(t('team.barMember', { name: m.ownerName })) + '</b> ' + esc(t(m.role === 'viewer' ? 'team.roleViewerHint' : 'team.roleEditorHint'));
  }
  function when(s) { return i18n.fmt.stamp ? i18n.fmt.stamp(s, 'short') : s; }
  function codeName(id) { var rows = window.MyCodes && MyCodes.rows ? MyCodes.rows() : []; var r = rows.filter(function (x) { return x.id === id; })[0]; return r ? MyCodes.displayName(r) : ''; }
  function html() {
    if (!info) { load(); return '<div class="glass bg-card acct"><h2>' + t('team.title') + '</h2><p class="acct-note">' + t('plan.loading') + '</p></div>'; }
    if (info.error) return '<div class="glass bg-card acct"><h2>' + t('team.title') + '</h2><p class="acct-msg bad">' + t('plan.loadError') + '</p></div>';
    if (info.member) return '<div class="glass bg-card acct"><h2>' + t('team.title') + '</h2><p>' + esc(t('team.youAreMember', { name: info.member.ownerName })) + '</p>' +
      '<p class="acct-note">' + esc(t(info.member.role === 'viewer' ? 'team.roleViewerHint' : 'team.roleEditorHint')) + '</p></div>' + logCard();
    if (!info.canTeam) return '<div class="glass bg-card acct lock-card"><span class="lock-ic">' + PlanGate.lock + '</span><div><h2>' + t('team.title') + ' ' + PlanGate.badge('pro') + '</h2><p>' + t('team.notAvailable') + '</p>' +
      '<button type="button" class="btn primary" data-gate-open="pro" data-gate-reason="team">' + esc(t('pw.upgradeTo', { plan: t('plan.n_pro') })) + '</button></div></div>';
    var members = info.members || [], seats = info.seats, full = seats != null && members.length + 1 >= seats;
    return '<div class="glass bg-card acct"><h2>' + t('team.title') + '</h2><p>' + t('team.lead') + '</p>' +
      '<p class="acct-note">' + esc(seats == null ? t('team.seatsAll', { n: members.length + 1 }) : t('team.seats', { n: members.length + 1, max: seats })) + '</p>' +
      (full ? '<p class="acct-msg" role="status">' + t('team.full') + '</p>' :
      '<form class="team-form" data-team-form novalidate><label class="auth-f"><span>' + t('auth.email') + '</span><span class="auth-in"><input name="email" type="email" value="' + esc(form.email) + '" required autocomplete="off"></span></label>' +
        '<label class="auth-f"><span>' + t('auth.name') + '</span><span class="auth-in"><input name="name" type="text" maxlength="80" value="' + esc(form.name) + '" autocomplete="off"></span></label>' +
        '<label class="auth-f"><span>' + t('team.role') + '</span><span class="auth-in"><select name="role">' + ['editor', 'viewer'].map(function (r) { return '<option value="' + r + '"' + (form.role === r ? ' selected' : '') + '>' + t('team.role_' + r) + '</option>'; }).join('') + '</select></span></label>' +
        '<button class="btn primary" type="submit">' + t('team.invite') + '</button></form>') +
      (msg ? '<p class="acct-msg ' + msg[1] + '" role="status">' + esc(msg[0]) + '</p>' : '') +
      (link ? '<p class="acct-note">' + t('team.linkNote') + '</p><code class="team-link">' + esc(link) + '</code>' : '') +
      '<div class="team-list">' + '<div class="team-row team-owner"><span><b>' + esc(t('team.you')) + '</b><small>' + t('team.owner') + '</small></span></div>' +
        members.map(function (m) {
          return '<div class="team-row" data-member="' + esc(m.userId) + '"><span><b>' + esc(m.name || m.email) + '</b><small>' + esc(m.email) + (m.active ? '' : ' · ' + t('team.invited')) + '</small></span>' +
            '<select data-team-role aria-label="' + esc(t('team.role')) + '">' + ['editor', 'viewer'].map(function (r) { return '<option value="' + r + '"' + (m.role === r ? ' selected' : '') + '>' + t('team.role_' + r) + '</option>'; }).join('') + '</select>' +
            (m.active ? '' : '<button type="button" class="btn ghost sm" data-team-resend>' + t('team.resend') + '</button>') +
            '<button type="button" class="btn ghost sm danger-ghost" data-team-remove>' + t('team.remove') + '</button></div>';
        }).join('') + '</div>' +
      '<p class="acct-note">' + t('team.rolesExplain') + '</p></div>' + logCard();
  }
  function logCard() {
    if (!log || !log.length) return '';
    return '<div class="glass bg-card acct"><h2>' + t('team.logTitle') + '</h2><ul class="team-log">' + log.slice(0, 30).map(function (e) {
      var n = e.codeId ? codeName(e.codeId) : '';
      return '<li><b>' + esc(e.byName) + '</b> ' + esc(t('team.a_' + e.action)) + (n ? ' <em>' + esc(n) + '</em>' : '') + '<small>' + esc(when(e.at)) + '</small></li>';
    }).join('') + '</ul></div>';
  }
  function err(x) { return t(x && x.code === 'exists' ? 'team.errExists' : x && x.code === 'email' ? 'auth.errEmail' : x && x.code === 'email_disposable' ? 'auth.errDisposable' : x && x.code === 'seats' ? 'team.full' : 'myCodes.failed'); }
  // Gebeurtenissen in Mijn account (het kaartje wordt steeds opnieuw getekend)
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('[data-team-form]'); if (!f) return;
    e.preventDefault();
    form = { email: f.email.value.trim(), name: f.name.value.trim(), role: f.role.value };
    if (!form.email) { msg = [t('auth.errEmail'), 'bad']; return redraw(); }
    api.team.invite({ email: form.email, name: form.name, role: form.role, lang: i18n.lang() }).then(function (r) {
      msg = [t('team.sent', { email: form.email }), 'ok']; link = r && r.link || null; form = { email: '', name: '', role: form.role }; info = null; load();
    }).catch(function (x) { msg = [err(x), 'bad']; redraw(); });
  });
  document.addEventListener('change', function (e) {
    var s = e.target.closest && e.target.closest('[data-team-role]'); if (!s) return;
    var id = s.closest('[data-member]').getAttribute('data-member');
    api.team.role(id, s.value).then(function () { msg = [t('team.saved'), 'ok']; info = null; load(); }).catch(function (x) { msg = [err(x), 'bad']; redraw(); });
  });
  document.addEventListener('click', function (e) {
    var row = e.target.closest && e.target.closest('[data-member]'); if (!row) return;
    var id = row.getAttribute('data-member');
    if (e.target.closest('[data-team-resend]')) api.team.reinvite(id, { lang: i18n.lang() }).then(function (r) { msg = [t('team.resent'), 'ok']; link = r && r.link || null; redraw(); }).catch(function (x) { msg = [err(x), 'bad']; redraw(); });
    if (e.target.closest('[data-team-remove]') && confirm(t('team.removeConfirm'))) api.team.remove(id).then(function () { msg = [t('team.removed'), 'ok']; info = null; load(); }).catch(function (x) { msg = [err(x), 'bad']; redraw(); });
  });
  // Kijker probeert iets te wijzigen: korte uitleg
  document.addEventListener('team-viewer', function () { alert(t('team.viewerBlocked')); });
  setTimeout(function () { if (window.Session && Session.onUser) Session.onUser(function () { info = null; log = null; load(); }); }, 0);
  if (window.i18n) i18n.onChange(apply);
  return { html: html, load: function () { info = null; load(); }, ensure: function () { if (!info) load(); }, visible: function () { return !!(info && (info.member || info.canTeam || (info.members && info.members.length))); }, member: function () { return info && info.member; } };
})();
