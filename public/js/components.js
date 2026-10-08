/* =========================================================
   COMPONENTEN: lezen alleen state, roepen alleen actions aan
   ========================================================= */
var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
var BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';

var Stepper = {
  render: function (el, state) {
    var cur = STEPS.indexOf(state.step);
    el.innerHTML = STEPS.map(function (s, i) {
      var st = i < cur || (state.created && i === cur) ? 'done' : i === cur ? 'current' : 'todo';
      return (i ? '<li class="bar' + (i <= cur ? ' done' : '') + '" aria-hidden="true"></li>' : '') +
        '<li class="s ' + st + '"' + (st === 'current' ? ' aria-current="step"' : '') + '><button type="button" data-step="' + s + '"' + (st === 'done' ? '' : ' tabindex="-1"') + '>' +
        '<span class="mark">' + (st === 'done' ? CHECK : '') + '</span><span class="lbl">' + t('steps.' + s) + '</span>' +
        (st === 'done' ? '<span class="sr"> · ' + t('steps.completed') + '</span>' : '') + '</button></li>';
    }).join('');
  },
  bind: function (el) { el.addEventListener('click', function (e) { var b = e.target.closest('.done [data-step]'); if (b) actions.goTo(b.getAttribute('data-step')); }); }
};

var HERO_TEXT = { type: ['hero.title', 'hero.lead'], content: ['content.title', 'content.lead'], design: ['design.title', 'design.lead'] };
function renderHero(state) {
  document.getElementById('heroTitle').textContent = t(HERO_TEXT[state.step][0]);
}

var TypeGrid = {
  render: function (el, state) {
    el.innerHTML = '<div class="grid" role="list">' + QR_TYPES.map(function (type) {
      var on = type.id === state.typeId;
      return '<button class="qr-card' + (on ? ' selected' : '') + '" type="button" role="listitem" data-type="' + type.id + '" aria-pressed="' + on + '">' +
        '<span class="ic" aria-hidden="true">' + svg(type.icon, 1.6) + '</span><span class="title">' + typeName(type) + '</span></button>';
    }).join('') + '</div>' + Actions.html(state);
  },
  update: function (el, state) { el.querySelectorAll('.qr-card').forEach(function (b) { var on = b.getAttribute('data-type') === state.typeId; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); }); }
};

var ContentForm = {
  render: function (el, state) {
    var type = getType(state.typeId), values = state.content[type.id] || {};
    el.innerHTML = '<div class="chosen"><span class="thumb">' + svg(type.icon, 1.8) + '</span>' +
      '<span><b>' + typeName(type) + '</b><small>' + typeDesc(type) + '</small></span>' +
      '<button class="link-btn" type="button" data-go="type">' + t('actions.change') + '</button></div>' +
      '<form class="form" id="contentForm" novalidate>' + type.fields.map(function (f) {
        var id = 'f-' + type.id + '-' + f.key, label = t(f.label, { n: f.n }), v = values[f.key] != null ? values[f.key] : '';
        if (f.required) label += '<span class="req" aria-hidden="true">*</span>';
        var wrap = function (inner) { return '<div class="field" data-field="' + f.key + '"><label for="' + id + '">' + label + '</label>' + inner + '<small class="field-err">' + t('validate.required') + '</small></div>'; };
        if (f.type === 'image') return wrap(ImageUpload.html(f, id, v));
        if (f.type === 'hours') return wrap(HoursEditor.html(f, id, v));
        if (f.type === 'address') return wrap(AddressSearch.html(f, id, v));
        if (f.type === 'socials') return wrap(SocialsEditor.html(f, id, v));
        var input = f.type === 'select'
          ? '<select id="' + id + '" name="' + f.key + '">' + f.options.map(function (o) { var cur = v || f.sample; return '<option value="' + o.value + '"' + (o.value === cur ? ' selected' : '') + '>' + resolveSample(o.label) + '</option>'; }).join('') + '</select>'
          : '<input id="' + id + '" name="' + f.key + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '" placeholder="' + esc(resolveSample(f.sample)) + '" autocomplete="off">';
        return wrap(input);
      }).join('') + '</form>' +
      (type.page === false ? '' : '<section class="appearance" id="appearance"></section>') +
      Actions.html(state);
    ImageUpload.mount(el, actions.setField); HoursEditor.mount(el, actions.setField); AddressSearch.mount(el, actions.setField); SocialsEditor.mount(el, actions.setField);
    var ap = el.querySelector('#appearance'); if (ap) Appearance.mount(ap);
  }
};

var DesignPanel = {
  qrSvg: function (data, design) {
    if (typeof qrcode !== 'function') return '<div class="qr-fallback">QR</div>';
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    var qr = qrcode(0, 'M'); qr.addData(data); qr.make();
    var n = qr.getModuleCount(), p = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) p += 'M' + c + ' ' + r + 'h1v1h-1z';
    return '<svg viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" role="img" aria-label="' + esc(t('design.qrAlt', { type: typeName(getType(store.get().typeId)) })) + '" shape-rendering="crispEdges"><rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" fill="' + design.background + '"/><path d="' + p + '" fill="' + design.color + '"/></svg>';
  },
  render: function (el, state) {
    var d = state.design, ok = isScannable(d);
    var sw = function (key, list, labelKey) {
      return '<div class="opt"><h3>' + t(labelKey) + '</h3><div class="swatches">' + list.map(function (c, i) {
        return '<button type="button" class="sw" data-design="' + key + '" data-value="' + c + '" style="background:' + c + '" aria-pressed="' + (d[key] === c) + '" aria-label="' + t(labelKey) + ' ' + (i + 1) + '"></button>';
      }).join('') + '</div></div>';
    };
    el.innerHTML = '<div class="design"><div class="qr-box" style="background:' + d.background + '">' + this.qrSvg(encodeQR(state), d) + '</div>' +
      '<div class="opts">' + sw('color', DESIGN_OPTIONS.colors, 'design.color') + sw('background', DESIGN_OPTIONS.backgrounds, 'design.background') +
      '<div class="note ' + (ok ? 'ok' : 'warn') + '" role="status">' +
        (ok ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17v.01"/></svg>') +
        '<span>' + t(ok ? 'design.contrastOk' : 'design.contrastLow') + '</span></div></div></div>' + Actions.html(state);
  }
};

var Actions = {
  html: function (state) {
    var i = STEPS.indexOf(state.step), last = i === STEPS.length - 1;
    var back = i > 0 ? '<button type="button" class="btn ghost" data-go="' + STEPS[i - 1] + '">' + BACK + t('actions.back') + '</button>'
                     : '<span class="picked">' + t('panel.selected', { type: '<b>' + esc(typeName(getType(state.typeId))) + '</b>' }) + '</span>';
    var next = last
      ? (state.created
          ? '<span class="done-msg" role="status">' + CHECK + '<span>' + t('design.done') + (state.saved ? ' <a href="' + esc(state.saved.shortUrl) + '" target="_blank" rel="noopener">' + esc(state.saved.shortUrl.replace(/^https?:\/\//, '')) + '</a>' : '<small>' + t('design.demoMode') + '</small>') + '</span></span>'
          : (state.error ? '<span class="save-error" role="alert">' + t(state.error) + '</span>' : '') +
            '<button type="button" class="btn primary" data-create' + (state.saving ? ' disabled' : '') + '>' + t(state.saving ? 'design.saving' : (state.error ? 'design.retry' : 'actions.create')) + '</button>')
      : '<button type="button" class="btn primary" data-go="' + STEPS[i + 1] + '">' + t('actions.continue') + CHEV.replace('class="chev"', '') + '</button>';
    return '<div class="actions">' + back + '<span class="spacer"></span>' + next + '</div>';
  }
};

var PANELS = { type: TypeGrid, content: ContentForm, design: DesignPanel };
