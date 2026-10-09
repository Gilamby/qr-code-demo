/* =========================================================
   APP: koppelt state aan componenten
   ========================================================= */
(function () {
  var panel = document.getElementById('panel'), screen = document.getElementById('screen'), stepper = document.getElementById('stepper');
  Stepper.bind(stepper);
  // Alles behalve de knoppen in een eigen scrollvlak, zodat Terug/Doorgaan altijd onderin staan zonder over de velden heen te vallen.
  function layoutPanel() {
    var a = panel.querySelector(':scope > .actions'); if (!a) return;
    var sc = document.createElement('div'); sc.className = 'panel-scroll';
    while (panel.firstChild && panel.firstChild !== a) sc.appendChild(panel.firstChild);
    panel.insertBefore(sc, a);
  }
  // Telefoon tekenen. --pc = paginakleur (of de kleur waar de muis nu boven hangt).
  function drawPhone(state) {
    var shown = state.step === 'type' && state.hoverTypeId ? state.hoverTypeId : state.typeId, type = getType(shown);
    screen.innerHTML = renderPreview(state);
    // Kleuren van de telefoon: in stap 1 die van het type waar je naar kijkt, daarna die van je pagina (per type onthouden).
    var base = shown === state.typeId ? [state.pageColor, state.accentColor] : typeColors(shown, state);
    var h = state.hoverTheme || {}, pc = h.pc || base[0], ac = h.ac || base[1];
    var ink = function (c) { return luminance(c) > 0.42 ? '#14161a' : '#ffffff'; };   // leesbare tekst op elke kleur
    screen.style.setProperty('--pc', pc); screen.style.setProperty('--pc-ink', ink(pc));
    screen.style.setProperty('--ac', ac); screen.style.setProperty('--ac-ink', ink(ac));
  }

  panel.addEventListener('click', function (e) {
    var card = e.target.closest('.qr-card'); if (card) return actions.selectType(card.getAttribute('data-type'));
    var go = e.target.closest('[data-go]');
    if (go) {
      var to = go.getAttribute('data-go'), st = store.get();
      if (st.step === 'content' && STEPS.indexOf(to) > STEPS.indexOf('content')) {
        var miss = missingRequired(st);
        panel.querySelectorAll('[data-field]').forEach(function (f) { f.classList.toggle('invalid', miss.indexOf(f.getAttribute('data-field')) >= 0); });
        if (miss.length) { var first = panel.querySelector('.field.invalid'); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); var fi = first.querySelector('input'); if (fi && fi.type !== 'file') fi.focus({ preventScroll: true }); return; }
      }
      return actions.goTo(to);
    }
    var dl = e.target.closest('[data-dl]'); if (dl) return DesignPanel.download(dl.getAttribute('data-dl'));
    if (e.target.closest('[data-create]')) actions.create();
    if (e.target.closest('[data-cancel-edit]')) { actions.stopEdit(); return goToPage('myCodes'); }
    if (e.target.closest('[data-to-codes]')) { if (store.get().editing) actions.stopEdit(); else actions.startNew(); return goToPage('myCodes'); }
  });
  // Schakelaar boven de telefoon: Voorbeeld | QR-code (alleen in stap 2 en 3)
  var pvToggle = document.getElementById('pvToggle');
  function drawToggle(state) {
    var show = state.step !== 'type', ready = !missingRequired(state).length;
    pvToggle.hidden = !show; document.querySelector('.preview').classList.toggle('with-toggle', show);
    if (!show) return;
    pvToggle.innerHTML = ['preview', 'qr'].map(function (v) {
      var dis = v === 'qr' && !ready;
      return '<button type="button" role="tab" data-view="' + v + '" aria-selected="' + (state.phoneView === v) + '"' + (dis ? ' disabled title="' + esc(t('pv.toggle.needed')) + '"' : '') + '>' + t('pv.toggle.' + v) + '</button>';
    }).join('');
  }
  pvToggle.addEventListener('click', function (e) { var b = e.target.closest('[data-view]'); if (b && !b.disabled) actions.setPhoneView(b.getAttribute('data-view')); });
  store.subscribe(function (s, p) { if (s.step !== p.step || s.phoneView !== p.phoneView || s.content !== p.content) drawToggle(s); if (s.phoneView !== p.phoneView && s.step === p.step) drawPhone(s); });
  i18n.onChange(function () { drawToggle(store.get()); });

  // Telefoon: slot-scherm openen en weer vergrendelen
  screen.addEventListener('click', function (e) {
    if (e.target.closest('[data-unlock]')) actions.unlockPreview(true);
    if (e.target.closest('[data-lock]')) actions.unlockPreview(false);
  });
  // Wachtwoord: sterk wachtwoord maken en bewaren in de wachtwoordmanager van je apparaat
  // (Chrome/Edge/Android: direct via de Credential Management API; Safari/iPhone/Mac: sterk wachtwoord
  //  via autocomplete="new-password" wordt automatisch in iCloud-sleutelhanger bewaard; anders kopiëren.)
  panel.addEventListener('click', function (e) {
    var gen = e.target.closest('[data-pw-gen]'), save = e.target.closest('[data-pw-save]');
    if (!gen && !save) return;
    var box = e.target.closest('.field'), inp = box.querySelector('.pw-wrap input'), msg = box.querySelector('[data-pw-msg]');
    var say = function (k, cls) { msg.textContent = t(k); msg.className = 'field-msg ' + cls; };
    if (gen) {
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', a = new Uint32Array(14), pw = '';
      crypto.getRandomValues(a); a.forEach(function (n, i) { pw += chars[n % chars.length]; if (i === 4 || i === 9) pw += '-'; });
      inp.value = pw; inp.type = 'text'; box.querySelector('[data-eye]').classList.add('on');
      actions.setField(inp.name, pw); say('pw.generated', 'ok');
    }
    if (save) {
      if (!inp.value) return say('pw.empty', 'warn');
      var user = box.querySelector('[data-pw-user]'); user.value = pwUser(store.get().content[store.get().typeId]);
      if (window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
        navigator.credentials.store(new PasswordCredential({ id: user.value, password: inp.value, name: user.value }))
          .then(function () { say('pw.saved', 'ok'); }, function () { copy(); });
      } else copy();
    }
    function copy() {
      (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).then(function () { say('pw.copied', 'info'); }, function () { say('pw.copyFail', 'warn'); });
    }
  });
  // Wachtwoord tonen/verbergen
  panel.addEventListener('click', function (e) {
    var eye = e.target.closest('[data-eye]'); if (!eye) return;
    var inp = eye.parentNode.querySelector('input'), show = inp.type === 'password';
    inp.type = show ? 'text' : 'password'; eye.classList.toggle('on', show);
    eye.setAttribute('aria-label', t(show ? 'pw.hide' : 'pw.show')); eye.setAttribute('aria-pressed', String(show));
  });
  panel.addEventListener('mouseover', function (e) { var c = e.target.closest('.qr-card'); if (c) actions.hoverType(c.getAttribute('data-type')); });
  panel.addEventListener('mouseout', function (e) { if (e.target.closest('.qr-card') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.qr-card'))) actions.hoverType(null); });
  panel.addEventListener('input', function (e) { if (e.target.name) actions.setField(e.target.name, e.target.type === 'checkbox' ? (e.target.checked ? '1' : '') : e.target.value); });
  panel.addEventListener('submit', function (e) { e.preventDefault(); });

  function renderAll(state, animate) {
    Stepper.render(stepper, state);
    renderHero(state);
    PANELS[state.step].render(panel, state); layoutPanel();
    drawPhone(state);
    if (animate) { screen.classList.remove('swap'); void screen.offsetWidth; screen.classList.add('swap'); }
  }

  store.subscribe(function (state, prev) {
    var stepChanged = state.step !== prev.step, typeChanged = state.typeId !== prev.typeId;
    if (state.editing !== prev.editing) { renderAll(state, false); return; }   // bewerken gestart of gestopt: alles opnieuw
    if (state.previewUnlocked !== prev.previewUnlocked) { drawPhone(state); if (state.step === 'content') return; }
    if (state.hoverTheme !== prev.hoverTheme || state.pageColor !== prev.pageColor || state.accentColor !== prev.accentColor) { drawPhone(state); if (state.step === 'content') return; }
    if (state.step === 'type' && state.hoverTypeId !== prev.hoverTypeId && !typeChanged) { drawPhone(state); return; }
    if (stepChanged) { renderAll(state, false); document.getElementById('heroTitle').scrollIntoView({ block: 'nearest' }); return; }
    if (state.step === 'type' && typeChanged) { TypeGrid.update(panel, state); renderHero(state); panel.querySelector('.actions').outerHTML = Actions.html(state); drawPhone(state); screen.classList.remove('swap'); void screen.offsetWidth; screen.classList.add('swap'); return; }
    if (state.step === 'content') { drawPhone(state); return; }          // formulier niet opnieuw tekenen: focus blijft
    if (state.step === 'design') {
      if (state.design !== prev.design || state.created !== prev.created || state.saving !== prev.saving || state.error !== prev.error) { Stepper.render(stepper, state); DesignPanel.update(panel, state); }
      drawPhone(state);
    }
  });
  i18n.onChange(function () { renderAll(store.get(), false); });
  // Draait de eigen server? Dan wijzen de korte links naar die server.
  api.available().then(function (on) { if (on) { QR_BASE = location.origin; drawPhone(store.get()); } });
  document.addEventListener('preview:refresh', function () { drawPhone(store.get()); });
})();

/* ---------- Start: opgeslagen taal, anders Engels ---------- */
if (document.getElementById('locale-en')) i18n.render();
i18n.set(i18n.detect());
