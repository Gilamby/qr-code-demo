/* ---------- Achtergrondknop: naar Mijn account ---------- */
document.getElementById('bgBtn').addEventListener('click', function () { window.goToPage('account'); var s = document.getElementById('bgSection'); if (s) s.scrollIntoView({ block: 'start' }); });

/* ---------- Mijn account: achtergrond kiezen ---------- */
(function () {
  var grid = document.getElementById('bgGrid'), err = document.getElementById('bgError');
  var TICK = '<span class="tick">' + CHECK + '</span>';
  function render() {
    var cur = background.get();
    var opts = BACKGROUNDS.map(function (b) {
      var thumb = b.image ? 'background-image:url(' + b.image + ')' : 'background:' + b.css;
      return '<button type="button" class="bg-opt" role="radio" data-bg="' + b.id + '" aria-checked="' + (cur === b.id) + '"><span class="thumb" style="' + thumb + '">' + TICK + '</span><span class="name">' + t(b.label) + '</span></button>';
    });
    if (background.custom()) opts.push('<button type="button" class="bg-opt" role="radio" data-bg="custom" aria-checked="' + (cur === 'custom') + '"><span class="thumb" style="background-image:url(' + background.custom() + ')">' + TICK + '</span><span class="name">' + t('bg.custom') + '</span></button>');
    opts.push('<label class="bg-opt upload"><span class="thumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg></span><span class="name">' + t('bg.upload') + '</span><input type="file" id="bgFile" accept="image/jpeg,image/png,image/webp"></label>');
    grid.innerHTML = opts.join('');
  }
  grid.addEventListener('click', function (e) { var b = e.target.closest('[data-bg]'); if (b) background.set(b.getAttribute('data-bg')); });
  grid.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0]; if (!file) return;
    err.hidden = true;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {   // verkleinen zodat het snel laadt en in de opslag past
        var scale = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        background.setCustom(c.toDataURL('image/jpeg', .82));
      };
      img.onerror = function () { err.textContent = t('bg.uploadError'); err.hidden = false; };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  background.onChange(render); i18n.onChange(render); render();
})();
