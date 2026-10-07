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
    screen.style.setProperty('--pc', type.page === false ? '#2bb5f0' : (state.hoverColor || state.pageColor));
  }

  panel.addEventListener('click', function (e) {
    var card = e.target.closest('.qr-card'); if (card) return actions.selectType(card.getAttribute('data-type'));
    var go = e.target.closest('[data-go]'); if (go) return actions.goTo(go.getAttribute('data-go'));
    var sw = e.target.closest('[data-design]'); if (sw) return actions.setDesign(sw.getAttribute('data-design'), sw.getAttribute('data-value'));
    if (e.target.closest('[data-create]')) actions.create();
  });
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
    if (state.hoverColor !== prev.hoverColor || state.pageColor !== prev.pageColor) { drawPhone(state); if (state.step === 'content') return; }
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
