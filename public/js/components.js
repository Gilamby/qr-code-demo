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
  bind: function (el) { el.addEventListener('click', function (e) { var b = e.target.closest('.done [data-step]'); if (!b) return; var to = b.getAttribute('data-step'); if (to === 'type' && store.get().editing) return; /* type ligt vast bij bewerken */ actions.goTo(to); }); }
};

var HERO_TEXT = { type: ['hero.title', 'hero.lead'], content: ['content.title', 'content.lead'], design: ['design.title', 'design.lead'] };
function renderHero(state) {
  document.getElementById('heroTitle').textContent = state.editing ? t('edit.title', { name: state.editing.label || typeName(getType(state.typeId)) }) : t(HERO_TEXT[state.step][0]);
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

// Naam waaronder het wachtwoord in iCloud-sleutelhanger / Google Wachtwoordmanager komt te staan.
function pwUser(values) { return 'QR · ' + ((values && (values.title || values.url || '')).replace(/^https?:\/\//, '') || 'Optimasys'); }

var ContentForm = {
  render: function (el, state) {
    var type = getType(state.typeId), values = state.content[type.id] || {};
    el.innerHTML = '<div class="chosen"><span class="thumb">' + svg(type.icon, 1.8) + '</span>' +
      '<span><b>' + typeName(type) + '</b><small>' + typeDesc(type) + '</small></span>' +
      (state.editing ? '' : '<button class="link-btn" type="button" data-go="type">' + t('actions.change') + '</button>') + '</div>' +
      (state.editing && /^(contact|wifi)$/.test(type.contentType) ? '<p class="edit-note">' + t('edit.staticNote') + '</p>' : '') +
      '<form class="form" id="contentForm" novalidate>' + (function () { var render = function (f) {
        var id = 'f-' + type.id + '-' + f.key, label = t(f.label, { n: f.n }), v = values[f.key] != null ? values[f.key] : '';
        if (f.required) label += '<span class="req" aria-hidden="true">*</span>';
        var keepPw = f.type === 'password' && state.editing && state.editing.hasPassword;   // bestaand wachtwoord: leeg laten = houden
        var cls = f.advanced ? ' opt' : (f.extra ? ' opt extra' : ''), attrs = f.advanced ? ' data-opt-field="' + f.key + '"' + (v || keepPw ? '' : ' hidden') : (f.extra ? ' data-extra-field="' + f.key + '"' + (v ? '' : ' hidden') : '');
        var rm = f.advanced ? '<button type="button" class="opt-x" data-opt-rm="' + f.key + '" aria-label="' + esc(t('more.remove')) + '">×</button>'
               : f.extra ? '<button type="button" class="opt-x" data-extra-rm="' + f.key + '" aria-label="' + esc(t('more.remove')) + '">×</button>' : '';
        var wrap = function (inner) { return '<div class="field' + cls + '"' + attrs + ' data-field="' + f.key + '">' + rm + '<label for="' + id + '">' + label + '</label>' + inner + (f.check ? '<small class="field-msg" data-msg="' + f.key + '"></small>' : '') + (f.hint ? '<small class="field-hint">' + t(f.hint) + '</small>' : '') + '<small class="field-err">' + t('validate.required') + '</small></div>'; };
        if (f.type === 'toggle') return '<div class="field toggle-field' + cls + '"' + attrs + ' data-field="' + f.key + '">' + rm + '<label class="tg"><input type="checkbox" id="' + id + '" name="' + f.key + '"' + (v ? ' checked' : '') + '><span class="sw-ui"></span><span>' + label + (f.hint ? '<small class="field-hint">' + t(f.hint) + '</small>' : '') + '</span></label></div>';
        if (f.type === 'image') return wrap(ImageUpload.html(f, id, v));
        if (f.type === 'file') return wrap(FileUpload.html(f, id, v));
        if (f.type === 'gallery') return wrap(GalleryUpload.html(f, id, v));
        if (f.type === 'dishes') return wrap(DishesEditor.html(f, id, v));
        if (f.type === 'hours') return wrap(HoursEditor.html(f, id, v));
        if (f.type === 'address') return wrap(AddressSearch.html(f, id, v));
        if (f.type === 'socials') return wrap(SocialsEditor.html(f, id, v));
        if (f.type === 'tel') return wrap(PhoneInput.html(f, id, v));
        var input = f.type === 'select'
          ? '<select id="' + id + '" name="' + f.key + '">' + f.options.map(function (o) { var cur = v || f.sample; return '<option value="' + o.value + '"' + (o.value === cur ? ' selected' : '') + '>' + resolveSample(o.label) + '</option>'; }).join('') + '</select>'
          : '<input id="' + id + '" name="' + f.key + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '" placeholder="' + esc(keepPw ? t('edit.pwKeep') : resolveSample(f.sample)) + '"' +
            (f.type === 'date' ? ' min="' + new Date().toISOString().slice(0, 10) + '"' : '') + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') +
            ' autocomplete="' + (f.type === 'password' ? 'new-password' : 'off') + '">';
        if (f.type === 'password') input = '<input class="sr" type="text" name="" autocomplete="username" tabindex="-1" aria-hidden="true" data-pw-user value="' + esc(pwUser(values)) + '">' + '<div class="pw-wrap">' + input + '<button type="button" class="pw-eye" data-eye aria-pressed="false" aria-label="' + esc(t('pw.show')) + '">' +
          '<svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>' +
          '<svg class="eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></div>' +
          '<div class="pw-actions"><button type="button" class="pw-act" data-pw-gen>' + t('pw.generate') + '</button><button type="button" class="pw-act" data-pw-save>' + t('pw.save') + '</button></div><small class="field-msg" data-pw-msg></small>';
        return wrap(input);
      };
      var basic = type.fields.filter(function (f) { return !f.advanced; }), more = type.fields.filter(function (f) { return f.advanced; });
      var active = more.filter(function (f) { return values[f.key]; }).length;
      // Extra velden (bv. link 4-10): verborgen tot je op "+ toevoegen" klikt, knop direct onder de laatste
      var extras = basic.filter(function (f) { return f.extra; }), html = basic.map(render), lastExtra = basic.lastIndexOf(extras[extras.length - 1]);
      if (extras.length) html.splice(lastExtra + 1, 0, '<button type="button" class="add-row" data-extra-add' + (extras.every(function (f) { return values[f.key]; }) ? ' hidden' : '') + '>+ ' + t('fields.addLink') + '</button>');
      return html.join('') + (more.length
        ? '<details class="more"' + (active ? ' open' : '') + '><summary><span>' + t('more.title') + '</span><em class="more-count"' + (active ? '' : ' hidden') + '>' + t('more.active', { n: active }) + '</em></summary>' +
            '<div class="more-body"><div class="opt-chips">' + more.map(function (f) { return '<button type="button" class="opt-chip" data-opt="' + f.key + '"' + (values[f.key] ? ' hidden' : '') + '>+ ' + t(f.label) + '</button>'; }).join('') + '</div>' +
            more.map(render).join('') + '</div></details>'
        : '');
    })() + '</form>' +
      (type.page === false ? '' : '<section class="appearance" id="appearance"></section>') +
      Actions.html(state);
    ImageUpload.mount(el, actions.setField); FileUpload.mount(el, actions.setField); GalleryUpload.mount(el, actions.setField); DishesEditor.mount(el, actions.setField); HoursEditor.mount(el, actions.setField); AddressSearch.mount(el, actions.setField); PhoneInput.mount(el, actions.setField); EmailCheck.mount(el, actions.setField); SocialsEditor.mount(el, actions.setField);
    var ap = el.querySelector('#appearance'); if (ap) Appearance.mount(ap);
    // Meer opties: teller bijwerken
    // Meer opties: knopjes voegen één optie toe, × haalt hem weer weg (en wist de waarde). Teller bijwerken.
    var det = el.querySelector('.more');
    if (det) {
      var count = function () {
        var c = store.get().content[type.id] || {}, n = type.fields.filter(function (f) { return f.advanced && c[f.key]; }).length, em = det.querySelector('.more-count');
        em.hidden = !n; em.textContent = t('more.active', { n: n });
      };
      el.addEventListener('input', count);
      det.addEventListener('click', function (e) {
        var add = e.target.closest('[data-opt]'), rm = e.target.closest('[data-opt-rm]');
        if (add) {
          var k = add.getAttribute('data-opt'), box = det.querySelector('[data-opt-field="' + k + '"]'), inp = box.querySelector('input');
          add.hidden = true; box.hidden = false;
          if (inp && inp.type === 'checkbox') { inp.checked = true; actions.setField(k, '1'); count(); } else if (inp) inp.focus();
        }
        if (rm) {
          var key = rm.getAttribute('data-opt-rm'), f = det.querySelector('[data-opt-field="' + key + '"]');
          f.hidden = true; det.querySelector('[data-opt="' + key + '"]').hidden = false;
          f.querySelectorAll('input').forEach(function (i) { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
          actions.setField(key, ''); count();
        }
      });
    }
    // Extra velden: + toont het volgende lege veld, × wist en verbergt het weer
    var addBtn = el.querySelector('[data-extra-add]');
    if (addBtn) el.querySelector('#contentForm').addEventListener('click', function (e) {
      if (e.target.closest('[data-extra-add]')) {
        var next = el.querySelector('[data-extra-field][hidden]'); if (!next) return;
        next.hidden = false; var inp = next.querySelector('input'); if (inp) inp.focus();
        addBtn.hidden = !el.querySelector('[data-extra-field][hidden]');
      }
      var rm = e.target.closest('[data-extra-rm]');
      if (rm) {
        var k = rm.getAttribute('data-extra-rm'), box = el.querySelector('[data-extra-field="' + k + '"]');
        box.querySelectorAll('input').forEach(function (i) { i.value = ''; }); box.hidden = true; actions.setField(k, ''); addBtn.hidden = false;
      }
    });
    // Link-check: https toevoegen, typfouten verbeteren, kijken of de site bestaat en de naam invullen
    type.fields.filter(function (f) { return f.check; }).forEach(function (f) { LinkCheck.mount(el, f, type); });
  }
};

var Actions = {
  html: function (state) {
    var i = STEPS.indexOf(state.step), last = i === STEPS.length - 1;
    var ed = state.editing;
    var back = i > 0 && !(ed && STEPS[i - 1] === 'type') ? '<button type="button" class="btn ghost" data-go="' + STEPS[i - 1] + '">' + BACK + t('actions.back') + '</button>'
             : ed ? '<button type="button" class="btn ghost" data-cancel-edit>' + BACK + t('edit.cancel') + '</button>'
             : '<span class="picked">' + t('panel.selected', { type: '<b>' + esc(typeName(getType(state.typeId))) + '</b>' }) + '</span>';
    var shown = state.saved && !/^(contact|wifi)$/.test(getType(state.typeId).contentType);   // vaste codes hebben geen link
    var next = last
      ? (state.created
          ? '<span class="done-msg" role="status">' + CHECK + '<span>' + t(ed ? 'edit.saved' : 'design.done') + (shown ? ' <a href="' + esc(state.saved.shortUrl) + '" target="_blank" rel="noopener">' + esc(state.saved.shortUrl.replace(/^https?:\/\//, '')) + '</a>' : '') + '</span></span>' +
            '<button type="button" class="btn ghost" data-to-codes>' + t('nav.myCodes') + '</button>' +
            '<button type="button" class="btn ghost" data-dl="svg">SVG</button><button type="button" class="btn primary" data-dl="png">' + t('dz.lbl.download') + '</button>'
          : (state.error ? '<span class="save-error" role="alert">' + t(state.error) + '</span>' : '') +
            '<button type="button" class="btn primary" data-create' + (state.saving ? ' disabled' : '') + '>' + t(state.saving ? 'design.saving' : (state.error ? 'design.retry' : (ed ? 'edit.save' : 'actions.create'))) + '</button>')
      : '<button type="button" class="btn primary" data-go="' + STEPS[i + 1] + '">' + t('actions.continue') + CHEV.replace('class="chev"', '') + '</button>';
    return '<div class="actions' + (last && state.created ? ' is-done' : '') + '">' + back + '<span class="spacer"></span>' + next + '</div>';
  }
};

var PANELS = { type: TypeGrid, content: ContentForm, design: DesignPanel };
