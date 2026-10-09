/* =========================================================
   MIJN QR-CODES: lijst uit de backend (GET /api/qr-codes)
   ========================================================= */
(function () {
  var view = document.getElementById('myCodesView'), list = document.getElementById('codesList');
  function msg(key) { list.innerHTML = '<p class="muted-msg">' + t(key) + '</p>'; }
  function date(iso) { return i18n.fmt.date(new Date(iso), 'short'); }
  function render(rows) {
    if (!rows.length) return msg('myCodes.empty');
    list.innerHTML = '<div class="table-wrap"><table class="codes"><thead><tr><th>' + t('myCodes.colType') + '</th><th>' + t('myCodes.colLink') + '</th><th>' + t('myCodes.colCreated') + '</th><th class="num">' + t('myCodes.colScans') + '</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var type = getType(r.typeId);
        return '<tr><td><span class="ti">' + svg(type.icon, 1.7) + '</span>' + esc(typeName(type)) + '</td>' +
          '<td><a href="' + esc(r.shortUrl) + '" target="_blank" rel="noopener">' + esc(r.shortUrl.replace(/^https?:\/\//, '')) + '</a></td>' +
          '<td>' + date(r.createdAt) + '</td><td class="num">' + i18n.fmt.num(r.scans) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function load() {
    msg('myCodes.loading');
    api.available().then(function (on) {
      if (!on) return msg('myCodes.offline');
      return api.listQrCodes().then(render);
    }).catch(function () { msg('myCodes.error'); });
  }
  document.addEventListener('pagechange', function (e) { if (e.detail === 'myCodes') load(); });
  i18n.onChange(function () { if (!view.hidden) load(); });
})();
