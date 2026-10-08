/* =========================================================
   APP: koppelt state aan componenten
   ========================================================= */
(function () {
  var panel = document.getElementById('panel'), screen = document.getElementById('screen'), stepper = document.getElementById('stepper');
  Stepper.bind(stepper);
  // Telefoon tekenen. --pc = paginakleur (of de kleur waar de muis nu boven hangt).
  function drawPhone(state) {
    var type = getType(state.typeId);
    screen.innerHTML = renderPreview(state);
    var h = state.hoverTheme || {}, own = type.page !== false;
    var pc = own ? (h.pc || state.pageColor) : '#2bb5f0', ac = own ? (h.ac || state.accentColor) : '#0f172a';
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
    var sw = e.target.closest('[data-design]'); if (sw) return actions.setDesign(sw.getAttribute('data-design'), sw.getAttribute('data-value'));
    if (e.target.closest('[data-create]')) actions.create();
  });
  panel.addEventListener('mouseover', function (e) { var c = e.target.closest('.qr-card'); if (c) actions.hoverType(c.getAttribute('data-type')); });
  panel.addEventListener('mouseout', function (e) { if (e.target.closest('.qr-card') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.qr-card'))) actions.hoverType(null); });
  panel.addEventListener('input', function (e) { if (e.target.name) actions.setField(e.target.name, e.target.value); });
  panel.addEventListener('submit', function (e) { e.preventDefault(); });

  function renderAll(state, animate) {
    Stepper.render(stepper, state);
    renderHero(state);
    PANELS[state.step].render(panel, state);
    drawPhone(state);
    if (animate) { screen.classList.remove('swap'); void screen.offsetWidth; screen.classList.add('swap'); }
  }

  store.subscribe(function (state, prev) {
    var stepChanged = state.step !== prev.step, typeChanged = state.typeId !== prev.typeId;
    if (state.hoverTheme !== prev.hoverTheme || state.pageColor !== prev.pageColor || state.accentColor !== prev.accentColor) { drawPhone(state); if (state.step === 'content') return; }
    if (state.step === 'type' && state.hoverTypeId !== prev.hoverTypeId && !typeChanged) { drawPhone(state); return; }
    if (stepChanged) { renderAll(state, false); document.getElementById('heroTitle').scrollIntoView({ block: 'nearest' }); return; }
    if (state.step === 'type' && typeChanged) { TypeGrid.update(panel, state); renderHero(state); panel.querySelector('.actions').outerHTML = Actions.html(state); drawPhone(state); screen.classList.remove('swap'); void screen.offsetWidth; screen.classList.add('swap'); return; }
    if (state.step === 'content') { drawPhone(state); return; }          // formulier niet opnieuw tekenen: focus blijft
    if (state.step === 'design') { Stepper.render(stepper, state); DesignPanel.render(panel, state); drawPhone(state); }
  });
  i18n.onChange(function () { renderAll(store.get(), false); });
  document.addEventListener('preview:refresh', function () { drawPhone(store.get()); });
})();

/* ---------- Start: opgeslagen taal, anders Engels ---------- */
if (document.getElementById('locale-en')) i18n.render();
i18n.set(i18n.detect());
