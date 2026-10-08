/* =========================================================
   STAP 3 – ONTWERP
   Drie rustige stappen, van snel naar precies:
   1. Snel kiezen   – 4 echte QR-codes: Klassiek (altijd eerst) + aanbevelingen.
   2. QR-assistent  – beschrijf wat je wilt; je krijgt 3 echte varianten + knoppen om bij te sturen.
   3. Zelf aanpassen – tabbladen (alleen tekst), één tegelijk zichtbaar.
   Elke keuze is meteen te zien op de telefoon; met de muis erover zie je het al vóór je klikt.
   ========================================================= */

function frameGroupOf(frame) { for (var g in FRAME_GROUPS) if (FRAME_GROUPS[g].indexOf(frame) >= 0) return g; return 'basic'; }
var DESIGN_SAMPLE = 'https://qr.example/scan';

function themeDesign(th, state) {
  if (th.brand) {                                       // eigen merk: donkerste paginakleur als code, de andere als hoeken
    var a = state.pageColor, b = state.accentColor, dark = luminance(a) < luminance(b) ? a : b, light = dark === a ? b : a;
    return Object.assign({}, QR_DEFAULT_DESIGN, { color: dark, pattern: 'rounded', cornerOuter: 'extra', cornerInner: 'rounded', cornerColor: contrastRatio(light, '#ffffff') >= 3 ? light : dark,
      frame: 'label', frameColor: dark, frameText: t('dz.text.scan') });
  }
  var d = Object.assign({}, QR_DEFAULT_DESIGN, th.d);
  if (d.frameText) d.frameText = t(d.frameText);
  return d;
}
function themeById(id) { return DESIGN_THEMES.filter(function (x) { return x.id === id; })[0]; }

/* ---------- QR-assistent (client) ----------
   Online vraagt hij het aan de server (/api/assistant: zelfde motor + controle + telt onbekende woorden),
   offline (demo) draait dezelfde motor gewoon in de browser. */
var Assistant = (function () {
  function finish(out, current) {
    out.variants = (out.variants || []).map(function (v) {
      var d = Object.assign({}, QR_DEFAULT_DESIGN, v, { logo: current.logo || '' });
      if (v.frameTextKey) d.frameText = t(v.frameTextKey);
      delete d.frameTextKey;
      return d;
    });
    return out;
  }
  function ask(text, current, ctx) {
    var cur = Object.assign({}, current, { logo: '' });  // het logo hoeft niet mee naar de server
    var local = function () { return finish(QRAssistant.parse(text, cur, ctx), current); };
    return api.available().then(function (on) {
      if (!on) return local();
      return api.assistant(text, cur).then(function (out) { return finish(out, current); }, local);
    }, local);
  }
  return { ask: ask };
})();

var DesignPanel = (function () {
  var tab = 'colors', colorOpen = null, frameGroup = null, themeGroup = 'business';
  var ai = { text: '', busy: false, out: null, pick: 0, base: null };   // laatste resultaat blijft staan bij opnieuw tekenen
  var TABS = ['colors', 'frame', 'corners'];   // volgorde = belangrijkheid

  function step(n, label, extra) { return '<div class="dz-step"><i>' + n + '</i><span>' + label + '</span>' + (extra || '') + '</div>'; }
  function tiles(key, list, render, cls) {
    return '<div class="dz-tiles ' + (cls || '') + '">' + list.map(function (v) {
      var name = t('dz.' + key + '.' + (v || 'none'));
      return '<button type="button" class="dz-tile" data-d="' + key + '" data-v="' + v + '" title="' + esc(name) + '" aria-label="' + esc(name) + '">' + render(v) + (key === 'decor' ? '<small>' + esc(name) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function colorRow(key, label, allowEmpty) {
    return '<div class="ap-row dz-color' + (colorOpen === key ? ' open' : '') + '" data-color="' + key + '"><button type="button" class="ap-head" data-color-open="' + key + '">' +
      '<span>' + label + '</span><span class="ap-val"><i></i><em></em></span></button>' +
      (allowEmpty ? '<button type="button" class="dz-same" data-same="' + key + '">' + t('dz.lbl.same') + '</button>' : '') +
      '<div class="ap-pick"></div></div>';
  }
  function pane(id, body) { return '<div class="dz-pane" role="tabpanel" id="dzPane-' + id + '" data-pane="' + id + '"' + (tab === id ? '' : ' hidden') + '>' + body + '</div>'; }

  /* ---------- 2. Assistent: alleen het resultaat-deel (wordt los opnieuw getekend) ---------- */
  function aiResult(state) {
    if (ai.busy) return '<div class="dz-ai-busy"><i></i><i></i><i></i></div>';
    var o = ai.out;
    if (!o) return '<div class="dz-ai-try"><span>' + t('dz.ai.try') + '</span>' + ['ex1', 'ex2', 'ex3'].map(function (k) {
      return '<button type="button" class="dz-chip" data-ai-example="' + esc(t('dz.ai.' + k)) + '">' + esc(t('dz.ai.' + k)) + '</button>';
    }).join('') + '</div>';
    if (!o.ok) return '<p class="dz-ai-none">' + esc(t('dz.ai.none')) + '</p>';
    var data = encodeQR(state), seen = {};
    var got = o.understood.filter(function (u) { var k = u.k + u.word; if (seen[k]) return false; seen[k] = 1; return true; }).map(function (u) {
      return '<span class="dz-got">' + (u.k === 'color' ? '<s style="background:' + esc(u.v) + '"></s>' : '') + esc(u.word) + '</span>';
    }).join('');
    return '<div class="dz-ai-out">' +
      '<div class="dz-vars" role="radiogroup" aria-label="' + esc(t('dz.ai.pick')) + '">' + o.variants.map(function (v, i) {
        return '<button type="button" class="dz-var" role="radio" data-var="' + i + '" aria-checked="' + (i === ai.pick) + '" aria-label="' + esc(t('dz.ai.variant', { n: i + 1 })) + '"><span class="dz-mini">' + QRRender.svg(data, v, { fontScale: 1.2 }) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="dz-ai-side"><div class="dz-gotline"><b>' + t('dz.ai.got') + '</b>' + got + '</div>' +
      '<div class="dz-refine">' + [['darker', 'donkerder'], ['noFrame', 'zonder frame'], ['text', ''], ['logo', '']].map(function (c) {
        return '<button type="button" class="dz-chip" data-refine="' + c[0] + '" data-cmd="' + c[1] + '">' + t('dz.ai.' + c[0]) + '</button>';
      }).join('') + '</div></div></div>';
  }

  function build(state) {
    var type = getType(state.typeId), d = state.design;
    var sample = encodeQR(state);                       // de eigen, unieke code van de gebruiker
    var themeTile = function (th, reason) {
      return '<button type="button" class="dz-tile dz-theme" data-theme="' + th.id + '"><span class="dz-mini">' + QRRender.svg(sample, themeDesign(th, state), { fontScale: 1.25 }) + '</span><small>' + t('dz.theme.' + th.id) + '</small>' +
        (reason ? '<em class="dz-why">' + esc(t(reason.k, { v: reason.v || '' })) + '</em>' : '') + '</button>';
    };
    var recs = recommendThemes(state);

    var grp = frameGroup || frameGroupOf(d.frame);
    var sw = function (kind) { return function (v) { return QRRender.swatch(kind, v, { color: '#e8edf3' }); }; };

    // 1. Stijl kiezen (altijd open): aanbevolen, daarna alle stijlen per groep (zakelijk eerst), en de QR-assistent
    var styles = step(1, t('dz.step.style')) +
      '<div class="dz-tiles quick" id="dzRecs">' + recs.map(function (r) { return themeTile(r.theme, r.reason); }).join('') + '</div>' +
      '<div class="dz-more"><span class="dz-sub">' + t('dz.lbl.moreStyles') + '</span><div class="dz-cats" role="tablist">' + THEME_GROUPS.map(function (g) {
          return '<button type="button" role="tab" data-tgroup="' + g + '" aria-selected="' + (g === themeGroup) + '">' + t('dz.tgroup.' + g) + '</button>';
        }).join('') + '</div>' + THEME_GROUPS.map(function (g) {
          return '<div class="dz-tiles themes compact" data-tg="' + g + '"' + (g === themeGroup ? '' : ' hidden') + '>' + DESIGN_THEMES.filter(function (th) { return th.g === g; }).map(function (th) { return themeTile(th); }).join('') + '</div>';
        }).join('') + '</div>' +
      '<div class="dz-aibox"><div class="dz-ailabel"><span>' + t('dz.step.ai') + '</span><em class="dz-badge">' + t('dz.ai.badge') + '</em></div>' +
      '<form class="dz-ai" id="dzAiForm" autocomplete="off"><input id="dzAiText" maxlength="300" value="' + esc(ai.text) + '" placeholder="' + esc(t('dz.ai.placeholder')) + '" aria-label="' + esc(t('dz.ai.placeholder')) + '">' +
      '<button type="submit" class="dz-ai-go">' + t('dz.ai.go') + '</button></form>' +
      '<div class="dz-ai-res" id="dzAiRes" aria-live="polite">' + aiResult(state) + '</div></div>';

    // 2. Logo (altijd open)
    var logo = step(2, t('dz.step.logo')) +
      '<div class="dz-logo"><div class="field">' + ImageUpload.html({ key: 'logo' }, 'dzLogo', d.logo) + '</div>' +
      '<div class="dz-logo-side"><button type="button" class="pw-act" data-type-logo>' + svg(type.icon, 1.8) + t('dz.lbl.typeLogo', { type: typeName(type) }) + '</button>' +
      '<small class="field-hint">' + t('dz.lbl.logoHint') + '</small></div></div>';

    // 3. Zelf aanpassen: Patroon en kleuren (met versiering) · Frame · Hoeken
    var tabsBar = '<div class="dz-tabs" role="tablist">' + TABS.map(function (id) {
      return '<button type="button" role="tab" data-tab="' + id + '" aria-controls="dzPane-' + id + '" aria-selected="' + (tab === id) + '">' + t('dz.tab.' + id) + '</button>';
    }).join('') + '</div>';
    var panes =
      pane('colors', '<div class="dz-sub">' + t('dz.lbl.pattern') + '</div>' + tiles('pattern', DESIGN_PATTERNS, sw('pattern'), 'small') +
        '<div class="dz-quick"><button type="button" class="pw-act" data-use-page>' + t('dz.lbl.usePage') + '</button></div>' +
        colorRow('color', t('dz.lbl.codeColor')) +
        '<label class="tg dz-check"><input type="checkbox" data-grad><span class="sw-ui"></span><span>' + t('dz.lbl.gradient') + '</span></label>' +
        '<div class="dz-when" data-when="gradient">' + colorRow('color2', t('dz.lbl.color2')) + '</div>' +
        '<div class="dz-sub">' + t('dz.tab.decor') + '</div>' + tiles('decor', DESIGN_DECOR, function (v) {
          return v ? '<span class="dz-mini">' + QRRender.svg(DESIGN_SAMPLE, { decor: v, color: '#1e293b' }) + '</span>' : '<span class="dz-none"></span>';
        }, 'decor')) +
      pane('frame', '<div class="dz-cats" role="tablist">' + Object.keys(FRAME_GROUPS).map(function (g) {
          return '<button type="button" role="tab" data-fgroup="' + g + '" aria-selected="' + (g === grp) + '">' + t('dz.fgroup.' + g) + '</button>';
        }).join('') + '</div>' + Object.keys(FRAME_GROUPS).map(function (g) {
          return '<div class="dz-fgroup" data-fg="' + g + '"' + (g === grp ? '' : ' hidden') + '>' + tiles('frame', FRAME_GROUPS[g], function (v) {
            return v === 'none' ? '<span class="dz-none"></span>' : '<span class="dz-mini">' + QRRender.svg(DESIGN_SAMPLE, { frame: v, frameText: t('dz.text.scan'), frameColor: v === 'chalkboard' ? '#24332c' : v === 'pumpkin' ? '#f97316' : v === 'heart' ? '#e11d48' : '#1e293b' }, { fontScale: 1.25 }) + '</span>';
          }, 'frames') + '</div>';
        }).join('') +
        '<div class="dz-when" data-when="frame"><div class="field"><label for="dzFrameText">' + t('dz.lbl.frameText') + '</label><input id="dzFrameText" maxlength="32" data-text="frameText" value="' + esc(d.frameText) + '" placeholder="' + esc(t('dz.text.scan')) + '"></div>' +
        '<div class="dz-seg"><span>' + t('dz.lbl.frameFont') + '</span>' + FRAME_FONTS.map(function (fo) { return '<button type="button" data-d="frameFont" data-v="' + fo + '" class="ff-' + (fo || 'auto') + '">' + t('dz.font.' + (fo || 'auto')) + '</button>'; }).join('') + '</div>' +
        colorRow('frameColor', t('dz.lbl.frameColor')) + '</div>') +
      pane('corners', '<div class="dz-sub">' + t('dz.lbl.outer') + '</div>' + tiles('cornerOuter', DESIGN_OUTER, sw('cornerOuter'), 'small') +
        '<div class="dz-sub">' + t('dz.lbl.inner') + '</div>' + tiles('cornerInner', DESIGN_INNER, sw('cornerInner'), 'small') +
        colorRow('cornerColor', t('dz.lbl.cornerColor'), true));

    return '<section class="dz-block">' + styles + '</section>' +
      '<section class="dz-block" id="dzLogoBlock">' + logo + '</section>' +
      '<section class="dz-block" id="dzOwn">' + step(3, t('dz.step.own')) + tabsBar + panes + '</section>' +
      '<div class="dz-unique" id="dzUnique"></div>';
  }

  // Werkt alleen de wisselende delen bij (geen nieuwe HTML), zodat slepen en typen niet onderbroken worden.
  function update(el, state) {
    var d = Object.assign({}, QR_DEFAULT_DESIGN, state.design);
    el.querySelectorAll('[data-d]').forEach(function (b) { b.setAttribute('aria-pressed', String(String(d[b.getAttribute('data-d')] || '') === b.getAttribute('data-v'))); });
    el.querySelectorAll('.dz-theme').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme') === d.themeId)); });
    el.querySelectorAll('[data-when]').forEach(function (w) { var k = w.getAttribute('data-when'); w.hidden = k === 'frame' ? d.frame === 'none' : !d[k]; });
    el.querySelectorAll('[data-color]').forEach(function (r) {
      var k = r.getAttribute('data-color'), v = d[k], shown = v || (k === 'cornerInnerColor' ? d.cornerColor : '') || (k === 'frameColor2' ? '#94a3b8' : d.color);
      r.querySelector('.ap-val i').style.background = shown; r.querySelector('.ap-val em').textContent = v ? v.toUpperCase() : t(k === 'frameColor2' ? 'dz.font.auto' : 'dz.lbl.same');
      var same = r.querySelector('[data-same]'); if (same) same.hidden = !v;
    });
    var gr = el.querySelector('[data-grad]'); if (gr) gr.checked = !!d.gradient;
    var ft = el.querySelector('#dzFrameText'); if (ft && document.activeElement !== ft) ft.value = d.frameText || '';
    // Een gekozen assistent-variant blijft alleen gemarkeerd zolang het ontwerp nog hetzelfde is
    if (ai.out && ai.out.ok) el.querySelectorAll('[data-var]').forEach(function (b) {
      var v = ai.out.variants[+b.getAttribute('data-var')];
      b.setAttribute('aria-checked', String(!!v && sameDesign(v, d)));
    });
    var u = el.querySelector('#dzUnique'), link = encodeQR(state);
    if (u) u.innerHTML = (/^https?:\/\//.test(link) ? '<span>' + t('dz.lbl.unique') + '</span> <code>' + esc(link.replace(/^https?:\/\//, '')) + '</code>' : '<span>' + t('dz.lbl.uniqueStatic') + '</span>');
    var a = el.querySelector('.actions'); if (a) a.outerHTML = Actions.html(state);
  }
  function sameDesign(a, b) {
    return ['color', 'background', 'pattern', 'cornerOuter', 'cornerInner', 'cornerColor', 'frame', 'frameColor', 'frameText', 'decor', 'gradient'].every(function (k) { return String(a[k] || '') === String(b[k] || ''); });
  }

  function mountColor(el, key) {
    var row = el.querySelector('[data-color="' + key + '"]'), pick = row.querySelector('.ap-pick'), d = store.get().design;
    pick.innerHTML = ColorPicker.html(key, true);
    ColorPicker.mount(pick.querySelector('.cp'), {
      value: d[key] || (key === 'cornerInnerColor' && d.cornerColor) || d.color,
      onChange: function (v) { if (key === 'cornerColor') { actions.applyDesign(Object.assign({}, store.get().design, { cornerColor: v, cornerInnerColor: '', themeId: '' })); } else actions.setDesign(key, v); },
      onPreview: function (v) { var o = null; if (v) { o = {}; o[key] = v; } actions.previewDesign(o); }
    });
  }

  function showTab(el, id, focus) {
    tab = id;
    el.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === id)); });
    el.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== id; });
    var own = el.querySelector('#dzOwn'); if (own && own.scrollIntoView) own.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (focus) { var f = el.querySelector(focus); if (f) { f.focus(); if (f.select) f.select(); } }
  }

  function showLogo(el) { var b = el.querySelector('#dzLogoBlock'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (b) { b.classList.add('dz-flash'); setTimeout(function () { b.classList.remove('dz-flash'); }, 1200); } }

  // De assistent vragen. base = het ontwerp waar hij op verder bouwt (bij "donkerder" e.d. het gekozen ontwerp).
  function runAssistant(el, text, base) {
    text = String(text || '').trim(); if (!text || ai.busy) return;
    var s = store.get(), res = el.querySelector('#dzAiRes');
    ai.busy = true; if (res) res.innerHTML = aiResult(s);
    Assistant.ask(text, base || s.design, { typeId: s.typeId }).then(function (out) {
      ai.busy = false; ai.out = out; ai.pick = 0;
      var st = store.get();
      if (out.ok && out.variants[0]) { actions.previewDesign(null); actions.applyDesign(out.variants[0]); }
      var r = el.querySelector('#dzAiRes'); if (r) r.innerHTML = aiResult(store.get());
      update(el, store.get());
      if (out.askLogo && !st.design.logo) showLogo(el);
    });
  }

  function render(el, state) {
    el.innerHTML = build(state) + Actions.html(state);
    update(el, state);
    if (colorOpen) mountColor(el, colorOpen);
    ImageUpload.mount(el, function (k, v) { actions.setDesign('logo', v); });
    if (el._dzBound) return; el._dzBound = true;
    el.addEventListener('submit', function (e) {
      if (e.target.id !== 'dzAiForm') return; e.preventDefault();
      ai.text = el.querySelector('#dzAiText').value; runAssistant(el, ai.text);
    });
    el.addEventListener('click', function (e) {
      if (store.get().step !== 'design') return;
      var s = store.get(), opt = e.target.closest('[data-d]'), th = e.target.closest('.dz-theme');
      var co = e.target.closest('[data-color-open]'), same = e.target.closest('[data-same]');
      var tb = e.target.closest('[data-tab]'), tgo = e.target.closest('[data-tab-go]');
      if (tb) showTab(el, tb.getAttribute('data-tab'));
      if (tgo) showTab(el, tgo.getAttribute('data-tab-go'));
      if (opt) { actions.previewDesign(null); actions.setDesign(opt.getAttribute('data-d'), opt.getAttribute('data-v')); if (opt.getAttribute('data-d') === 'frame' && !s.design.frameText) actions.setDesign('frameText', t('dz.text.scan')); }
      if (th) { var theme = themeById(th.getAttribute('data-theme')); actions.previewDesign(null); actions.applyDesign(Object.assign(themeDesign(theme, s), { logo: s.design.logo || '', themeId: theme.id })); }
      if (co) { var k = co.getAttribute('data-color-open'); el.querySelectorAll('.dz-color').forEach(function (r) { r.classList.remove('open'); r.querySelector('.ap-pick').innerHTML = ''; }); colorOpen = colorOpen === k ? null : k; if (colorOpen) { el.querySelector('[data-color="' + k + '"]').classList.add('open'); mountColor(el, k); } }
      if (same) actions.applyDesign(Object.assign({}, s.design, { cornerColor: '', cornerInnerColor: '', themeId: '' }));
      var tgb = e.target.closest('[data-tgroup]');
      if (tgb) { themeGroup = tgb.getAttribute('data-tgroup'); el.querySelectorAll('[data-tgroup]').forEach(function (b) { b.setAttribute('aria-selected', String(b === tgb)); }); el.querySelectorAll('[data-tg]').forEach(function (x) { x.hidden = x.getAttribute('data-tg') !== themeGroup; }); }
      var fg = e.target.closest('[data-fgroup]');
      if (fg) { frameGroup = fg.getAttribute('data-fgroup'); el.querySelectorAll('[data-fgroup]').forEach(function (b) { b.setAttribute('aria-selected', String(b === fg)); }); el.querySelectorAll('[data-fg]').forEach(function (x) { x.hidden = x.getAttribute('data-fg') !== frameGroup; }); }
      if (e.target.closest('[data-use-page]')) { var b = themeDesign({ brand: true }, s); actions.applyDesign(Object.assign({}, s.design, { color: b.color, cornerColor: b.cornerColor, frameColor: b.frameColor, gradient: '' })); }
      if (e.target.closest('[data-type-logo]')) actions.setDesign('logo', iconLogo(getType(s.typeId)));
      // Assistent
      var ex = e.target.closest('[data-ai-example]');
      if (ex) { ai.text = ex.getAttribute('data-ai-example'); el.querySelector('#dzAiText').value = ai.text; runAssistant(el, ai.text); }
      var vr = e.target.closest('[data-var]');
      if (vr && ai.out) { ai.pick = +vr.getAttribute('data-var'); actions.previewDesign(null); actions.applyDesign(Object.assign({}, ai.out.variants[ai.pick], { logo: s.design.logo || '' })); }
      var rf = e.target.closest('[data-refine]');
      if (rf) {
        var r = rf.getAttribute('data-refine');
        if (r === 'text') { if (s.design.frame === 'none') actions.setDesign('frame', 'label'); showTab(el, 'frame', '#dzFrameText'); }
        else if (r === 'logo') showLogo(el);
        else runAssistant(el, rf.getAttribute('data-cmd'), s.design);
      }
    });
    el.addEventListener('change', function (e) {
      if (!e.target.hasAttribute('data-grad')) return;
      var d = store.get().design;
      actions.applyDesign(Object.assign({}, d, { gradient: e.target.checked ? 'linear' : '', color2: d.color2 || d.cornerColor || '#2563eb', themeId: '' }));
    });
    el.addEventListener('input', function (e) {
      if (e.target.id === 'dzAiText') { ai.text = e.target.value; return; }
      var k = e.target.getAttribute('data-text'); if (k) { e.stopPropagation(); actions.setDesign(k, e.target.value.slice(0, 32)); }
    });
    el.addEventListener('mouseover', function (e) {
      if (store.get().step !== 'design') return;
      var opt = e.target.closest('[data-d]'), th = e.target.closest('.dz-theme'), vr = e.target.closest('[data-var]');
      if (opt) { var o = {}; o[opt.getAttribute('data-d')] = opt.getAttribute('data-v'); if (opt.getAttribute('data-d') === 'frame' && !store.get().design.frameText) o.frameText = t('dz.text.scan'); actions.previewDesign(o); }
      if (th) { var theme = themeById(th.getAttribute('data-theme')); if (theme) actions.previewDesign(Object.assign(themeDesign(theme, store.get()), { logo: store.get().design.logo || '' })); }
      if (vr && ai.out) actions.previewDesign(Object.assign({}, ai.out.variants[+vr.getAttribute('data-var')], { logo: store.get().design.logo || '' }));
    });
    el.addEventListener('mouseout', function (e) {
      var sel = '.dz-tile,[data-d],[data-var]', from = e.target.closest(sel), to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(sel);
      if (from && from !== to) actions.previewDesign(null);
    });
  }

  // Het icoon van het type als logo (wit icoon op een gekleurd rondje), als data-URL.
  function iconLogo(type) {
    var d = store.get().design, bg = d.cornerColor || d.color;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="' + bg + '"/><g transform="translate(10 10) scale(1.1667)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ICONS[type.icon] + '</g></svg>';
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)));
  }

  // Downloaden als PNG (1024 px) of SVG.
  function download(format) {
    var s = store.get(), data = encodeQR(s), name = 'qr-' + (s.typeId || 'code');
    var markup = QRRender.svg(data, s.design, { width: 1024 });
    if (format === 'svg') return save(new Blob([markup], { type: 'image/svg+xml' }), name + '.svg');
    var img = new Image(), url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      var ctx = cv.getContext('2d'); if (!s.design.transparent) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height); }
      ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      cv.toBlob(function (b) { save(b, name + '.png'); }, 'image/png');
    };
    img.src = url;
  }
  function save(blob, filename) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  return { render: render, update: update, download: download, qrSvg: function (data, design) { return QRRender.svg(data, design); } };
})();
