/* =========================================================
   BESTANDEN SLEPEN, overal in de app
   Elk element met data-drop (met daarin een <input type="file">) neemt gesleepte bestanden aan:
   de bestanden gaan in dat invoerveld en er komt een "change", net alsof je ze zelf had gekozen.
   Velden met een eigen sleep-afhandeling (foto-upload, galerij, profielfoto) doen dat zelf; die laten we met rust.
   Sleep je een bestand naast een vak, dan opent de browser het niet meer (je verliest dan niet je werk).
   ========================================================= */
(function () {
  function hasFiles(e) { var ty = e.dataTransfer && e.dataTransfer.types; return !!ty && Array.prototype.indexOf.call(ty, 'Files') >= 0; }
  function zoneOf(el) { var z = el && el.closest ? el.closest('[data-drop]') : null; if (!z) return null; var inp = z.querySelector('input[type="file"]'); return inp && !inp.disabled ? z : null; }
  // Past het bestand bij accept="image/*,video/mp4,.pdf"?
  function fits(file, accept) {
    if (!accept) return true;
    return accept.split(',').some(function (a) {
      a = a.trim().toLowerCase(); if (!a) return false;
      if (a[0] === '.') return file.name.toLowerCase().slice(-a.length) === a;
      if (/\/\*$/.test(a)) return (file.type || '').toLowerCase().indexOf(a.slice(0, -1)) === 0;
      return (file.type || '').toLowerCase() === a;
    });
  }
  var lit = null;
  function light(z) { if (lit && lit !== z) lit.classList.remove('drag'); lit = z; if (z) z.classList.add('drag'); }
  document.addEventListener('dragover', function (e) {
    if (!hasFiles(e) || e.defaultPrevented) return;   // een veld met eigen afhandeling heeft hem al
    e.preventDefault();
    var z = zoneOf(e.target); e.dataTransfer.dropEffect = z ? 'copy' : 'none'; light(z);
  });
  document.addEventListener('dragleave', function (e) { if (lit && !lit.contains(e.relatedTarget)) light(null); });
  document.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    var handled = e.defaultPrevented; e.preventDefault(); light(null);
    if (handled) return;
    var z = zoneOf(e.target); if (!z) return;
    var inp = z.querySelector('input[type="file"]'), list = Array.prototype.filter.call(e.dataTransfer.files, function (f) { return fits(f, inp.accept); });
    if (!list.length) { z.dispatchEvent(new CustomEvent('dropreject', { bubbles: true })); return; }
    if (!inp.multiple) list = list.slice(0, 1);
    try { var dt = new DataTransfer(); list.forEach(function (f) { dt.items.add(f); }); inp.files = dt.files; } catch (err) { return; }
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.addEventListener('dragend', function () { light(null); });
})();

/* Plakken (Ctrl+V / ⌘V) van een schermafbeelding in een open venster met een plak-vak (data-paste) */
(function () {
  document.addEventListener('paste', function (e) {
    var dlg = document.querySelector('dialog[open]'), z = dlg && dlg.querySelector('[data-paste]');
    if (!z || !e.clipboardData) return;
    var file = Array.prototype.map.call(e.clipboardData.items || [], function (i) { return i.kind === 'file' && /^image\//.test(i.type) ? i.getAsFile() : null; }).filter(Boolean)[0];
    if (!file) return;   // gewone tekst plakken in een veld: gewoon laten gebeuren
    e.preventDefault();
    var inp = z.querySelector('input[type="file"]'); if (!inp) return;
    try { var dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files; } catch (err) { return; }
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
})();
