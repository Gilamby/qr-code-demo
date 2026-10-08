/* =========================================================
   FOTO UPLOADEN: kiezen of slepen, wordt verkleind (max 1200px, JPG)
   en als data-URL in de state gezet. Zelfde veld voor elk type met type: 'image'.
   ========================================================= */
var ImageUpload = (function () {
  var MAX = 1200;
  function html(f, id, value) {
    return '<div class="up' + (value ? ' has' : '') + '" data-up="' + f.key + '">' +
      '<span class="up-thumb"' + (value ? ' style="background-image:url(' + value + ')"' : '') + '>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg></span>' +
      '<span class="up-text"><b>' + t('upload.choose') + '</b><small>' + t('upload.hint') + '</small></span>' +
      '<button type="button" class="up-remove">' + t('upload.remove') + '</button>' +
      '<input id="' + id + '" type="file" accept="image/jpeg,image/png,image/webp" class="up-file">' +
    '</div>';
  }
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var keepAlpha = /png|webp|svg/.test(file.type), max = keepAlpha ? 600 : MAX;   // logo's met doorzichtige achtergrond blijven doorzichtig
        var s = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); resolve(keepAlpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-up]').forEach(function (box) {
      var key = box.getAttribute('data-up'), input = box.querySelector('.up-file'), thumb = box.querySelector('.up-thumb'), hint = box.querySelector('small');
      function set(v) {
        box.classList.toggle('has', !!v); thumb.style.backgroundImage = v ? 'url(' + v + ')' : '';
        hint.textContent = t('upload.hint'); onChange(key, v || '');
      }
      function take(file) {
        if (!file || !/^image\//.test(file.type)) { hint.textContent = t('upload.error'); return; }
        shrink(file).then(set, function () { hint.textContent = t('upload.error'); });
      }
      box.addEventListener('click', function (e) { if (e.target.closest('.up-remove')) { e.stopPropagation(); input.value = ''; return set(''); } if (e.target !== input) input.click(); });
      input.addEventListener('click', function (e) { e.stopPropagation(); });
      input.addEventListener('change', function (e) { e.stopPropagation(); take(input.files[0]); });
      box.addEventListener('dragover', function (e) { e.preventDefault(); box.classList.add('drag'); });
      box.addEventListener('dragleave', function () { box.classList.remove('drag'); });
      box.addEventListener('drop', function (e) { e.preventDefault(); box.classList.remove('drag'); take(e.dataTransfer.files[0]); });
    });
  }
  return { html: html, mount: mount };
})();
