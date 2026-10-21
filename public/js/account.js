/* ---------- Achtergrondknop: naar Mijn account ---------- */
document.getElementById('bgBtn').addEventListener('click', function () { window.goToPage('account'); if (window.openAccountTab) window.openAccountTab('background'); });

/* ---------- Mijn account: achtergrond kiezen ----------
   - Optimasys en Aurora: vast (kunnen niet weg)
   - Vijf bewegende achtergronden (wallpaper-anim.js); het kaartje toont een stilstaand beeld + "Bewegend"
   - Eigen foto's en video's: zoveel als je wilt (max 12), elke upload is een eigen kaartje.
     Uploaden zet hem niet meteen aan: je kiest zelf. Weghalen vraagt eerst bevestiging;
     was het de actieve achtergrond, dan gaat hij terug naar Optimasys.
   - Video's in de kaartjes spelen niet allemaal tegelijk: alleen het eerste beeld (en afspelen als je erop wijst). */
(function () {
  var grid = document.getElementById('bgGrid'), err = document.getElementById('bgError');
  if (grid) grid.setAttribute('data-drop', '');   // foto's of video's erop slepen = uploaden
  var TICK = '<span class="tick">' + CHECK + '</span>', shots = {}, busy = 0;
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>';
  var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function shot(b) {                                            // stilstaand voorbeeld van een animatie (zodra three.js geladen is)
    var url = window.WallAnim ? WallAnim.snapshot(b.anim, 320, 200) : '';
    return url ? 'background-image:url(' + url + ')' : 'background:' + b.css;
  }
  function card(id, thumb, label, extra, lock) {
    var cur = background.get();
    return '<div class="bg-opt-wrap' + (lock ? ' locked' : '') + '"><button type="button" class="bg-opt" role="radio" data-bg="' + esc(id) + '" aria-checked="' + (cur === id) + '"' + (lock ? ' data-bg-lock="' + lock + '"' : '') + '><span class="thumb" style="' + thumb + '">' + (extra || '') + TICK + '</span><span class="name">' + label + (lock ? PlanGate.badge(lock) : '') + '</span></button>' +
      (id !== 'optimasys' ? '<button type="button" class="bg-del" data-del="' + esc(id) + '" aria-label="' + esc(t('bg.delete')) + '" title="' + esc(t('bg.delete')) + '">' + X + '</button>' : '') + '</div>';   // alles weg te halen behalve Optimasys
  }
  /* Licht / donker / systeem: bovenaan bij Achtergrond (wens Fabian 21 okt) */
  var ICONS = { dark: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>' };
  function drawTheme() {
    var box = document.getElementById('themePick'); if (!box) return;
    var cur = theme.get();
    box.innerHTML = '<h3>' + esc(t('theme.title')) + '</h3><div class="th-seg" role="radiogroup" aria-label="' + esc(t('theme.title')) + '">' + ['dark', 'light', 'system'].map(function (k) {
      return '<button type="button" role="radio" aria-checked="' + (cur === k) + '" data-theme-set="' + k + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[k] + '</svg><span>' + esc(t('theme.' + k)) + '</span>' + (k === 'system' ? '<small>' + esc(t('theme.systemHint')) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-theme-set]'); if (!b) return; theme.set(b.getAttribute('data-theme-set')); drawTheme(); });
  theme.onChange(function () { drawTheme(); });
  function render() {
    drawTheme();
    var hid = background.hidden(), G = window.PlanGate;
    // Wat zit in je pakket: Standard alleen de standaard-achtergrond, Pro alles + eigen foto's, Business ook video's
    var okExtra = !G || G.bgOk('extra'), okImage = !G || G.bgOk('image'), okVideo = !G || G.bgOk('video');
    var opts = BACKGROUNDS.filter(function (b) { return hid.indexOf(b.id) < 0; }).map(function (b) {
      var lock = b.id !== 'optimasys' && !okExtra ? 'pro' : null;
      return b.anim ? card(b.id, shot(b), t(b.label), '<i class="bg-badge">' + PLAY + t('bg.animated') + '</i>', lock)
        : card(b.id, b.image ? 'background-image:url(' + b.image + ')' : 'background:' + b.css, t(b.label), null, lock);
    });
    if (background.custom()) opts.push(card('custom', 'background-image:url(' + background.custom() + ')', t('bg.custom')));
    background.media().forEach(function (m) {
      var url = background.mediaUrl(m);
      opts.push(m.kind === 'image' ? card('media:' + m.id, 'background-image:url(' + url + ')', esc(m.name), null, okImage ? null : 'pro')
        : card('media:' + m.id, '', esc(m.name), '<video src="' + url + '#t=0.5" muted loop playsinline preload="metadata"></video><i class="bg-badge">' + PLAY + t('bg.video') + '</i>', okVideo ? null : 'business'));
    });
    if (!okImage) opts.push('<div class="bg-opt-wrap locked"><button type="button" class="bg-opt upload" data-bg-lock="pro"><span class="thumb">' + G.lock + '</span><span class="name">' + t('bg.upload') + G.badge('pro') + '</span></button></div>');
    else opts.push('<label class="bg-opt upload' + (busy ? ' busy' : '') + '"><span class="thumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg></span><span class="name">' + (busy ? t('bg.uploading') : t('bg.upload')) + '</span>' +
      '<input type="file" id="bgFile" accept="image/jpeg,image/png,image/webp' + (okVideo ? ',video/mp4,video/webm' : '') + '" multiple' + (busy ? ' disabled' : '') + '></label>');
    grid.innerHTML = opts.join('') + (okImage && !okVideo ? '<p class="bg-lock-note"><button type="button" class="link-btn" data-bg-lock="business">' + G.lock + esc(t('pw.reason_video')) + '</button></p>' : '') + (hid.length ? '<p class="bg-restore"><button type="button" class="link-btn" data-restore>' + t('bg.restore', { n: hid.length }) + '</button></p>' : '');
  }
  function showErr(key, vars) { err.textContent = t(key, vars); err.hidden = false; }
  grid.addEventListener('click', function (e) {
    if (e.target.closest('[data-restore]')) return background.setHidden([]);
    var d = e.target.closest('[data-del]'); if (d) return askDelete(d.getAttribute('data-del'));
    var lk = e.target.closest('[data-bg-lock]'); if (lk) { PlanGate.upgrade(lk.getAttribute('data-bg-lock'), lk.getAttribute('data-bg-lock') === 'business' ? 'video' : 'bg'); return; }
    var b = e.target.closest('[data-bg]'); if (b) background.set(b.getAttribute('data-bg'));
  });
  // Video's in de kaartjes: alleen afspelen als je erop wijst
  grid.addEventListener('mouseover', function (e) { var v = e.target.closest('.bg-opt') && e.target.closest('.bg-opt').querySelector('video'); if (v && v.paused) v.play().catch(function () {}); });
  grid.addEventListener('mouseout', function (e) { var o = e.target.closest('.bg-opt'); if (o && !o.contains(e.relatedTarget)) { var v = o.querySelector('video'); if (v) v.pause(); } });

  // Weghalen: eigen foto/video (echt weg), "Jouw foto" (oude upload, echt weg) of een standaard-achtergrond (verbergen, terug te zetten)
  function askDelete(id) {
    var isMedia = /^media:/.test(id), mid = isMedia ? id.slice(6) : null, m = isMedia ? background.media().filter(function (x) { return x.id === mid; })[0] : null;
    var b = BACKGROUNDS.filter(function (x) { return x.id === id; })[0];
    if (isMedia && !m) return;
    var name = m ? m.name : id === 'custom' ? t('bg.custom') : b ? t(b.label) : id, builtin = !!b;
    var dlg = document.getElementById('mcDialog');
    dlg.innerHTML = '<form method="dialog" class="mc-dlg"><span class="mc-dlg-ic"><svg class="mc-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></span>' +
      '<h3>' + t('bg.delTitle', { name: esc(name) }) + '</h3><p>' + t(builtin ? 'bg.hideText' : background.get() === id ? 'bg.delActive' : 'bg.delText') + '</p>' +
      '<div class="mc-dlg-btns"><button class="btn ghost" value="cancel">' + t('myCodes.cancel') + '</button><button class="btn danger" value="ok" id="bgDelGo">' + t('bg.delete') + '</button></div></form>';
    dlg.querySelector('#bgDelGo').addEventListener('click', function (ev) {
      ev.preventDefault(); dlg.close();
      if (builtin) return background.setHidden(background.hidden().concat([id]));
      if (id === 'custom') return background.removeCustom();
      fetch('api/account/media/' + encodeURIComponent(mid), { method: 'DELETE' }).then(function (r) {
        if (!r.ok && r.status !== 404) return showErr('bg.uploadError');
        var wasActive = background.get() === id;
        background.setMedia(background.media().filter(function (x) { return x.id !== mid; }));
        if (wasActive) background.set('optimasys');
      }).catch(function () { showErr('bg.uploadError'); });
    });
    dlg.showModal();
  }

  // Foto verkleinen in de browser (max 2400 px, JPEG): sneller laden, minder opslag
  function shrink(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 2400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); c.toBlob(function (b) { b ? ok(b) : bad(new Error('img')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error('img')); };
      img.src = url;
    });
  }
  function videoOk(file) {                                     // max. 60 seconden
    return new Promise(function (ok) {
      var v = document.createElement('video'), url = URL.createObjectURL(file); v.preload = 'metadata';
      v.onloadedmetadata = function () { URL.revokeObjectURL(url); ok(!(v.duration > 61)); };
      v.onerror = function () { URL.revokeObjectURL(url); ok(true); };   // kan de browser hem niet lezen: de server controleert het type
      v.src = url;
    });
  }
  function uploadOne(file) {
    var isVideo = /^video\//.test(file.type);
    if (!/^(image\/(jpeg|png|webp)|video\/(mp4|webm))$/.test(file.type)) return Promise.reject({ key: 'bg.typeError' });
    if (isVideo && window.PlanGate && !PlanGate.bgOk('video')) return Promise.reject({ key: 'pw.reason_video' });
    if (isVideo && file.size > 50 * 1048576) return Promise.reject({ key: 'bg.tooBig', vars: { mb: 50 } });
    var body = isVideo ? videoOk(file).then(function (ok) { if (!ok) throw { key: 'bg.tooLong' }; return file; }) : shrink(file);
    return body.then(function (blob) {
      return fetch('api/account/media?name=' + encodeURIComponent(file.name.replace(/\.[^.]+$/, '').slice(0, 60)), { method: 'POST', headers: { 'Content-Type': isVideo ? file.type : 'image/jpeg' }, body: blob });
    }).then(function (r) {
      if (r.status === 409) throw { key: 'bg.full' };
      if (r.status === 413) throw { key: 'bg.tooBig', vars: { mb: isVideo ? 50 : 8 } };
      if (r.status === 415) throw { key: 'bg.typeError' };
      if (r.status === 403) throw { key: isVideo ? 'pw.reason_video' : 'pw.reason_bg' };
      if (!r.ok) throw { key: 'bg.uploadError' };
      return r.json();
    });
  }
  grid.addEventListener('change', function (e) {
    var files = Array.prototype.slice.call((e.target.files || [])); if (!files.length) return;
    err.hidden = true; busy++; render();
    // Na elkaar uploaden (niet tegelijk), elke upload komt erbij
    files.reduce(function (p, f) {
      return p.then(function () { return uploadOne(f).then(function (item) { background.setMedia([item].concat(background.media())); }); });
    }, Promise.resolve()).catch(function (x) { showErr((x && x.key) || 'bg.uploadError', x && x.vars); })
      .then(function () { busy--; render(); });
  });
  background.onChange(render); i18n.onChange(render); theme.onChange(render); render();
  document.addEventListener('plan-info', render);
  // Voorbeelden van de animaties: three.js laden als je de achtergronden bekijkt, daarna opnieuw tekenen
  document.addEventListener('click', function (e) { if (e.target.closest('[data-tab="background"], #bgBtn')) WallAnim.ready(render); });
  if (BACKGROUNDS.some(function (b) { return b.anim && b.id === background.get(); })) WallAnim.ready(render);
  setTimeout(function () { if (window.Session) Session.onUser(function (u) { if (u) background.reload(); }); }, 0);   // session.js laadt na dit bestand
})();
