/* =========================================================
   LIJST-EDITORS
   - FormEditor  (veldsoort 'questions', QR-soort Formulier): vragen met soort, tekst, keuzes, verplicht.
     Waarde: JSON [{ t:'text'|'long'|'choice'|'multi'|'stars'|'email', q, o:[…], r:true }] (max. 15 vragen, max. 8 keuzes).
   - BlocksEditor (veldsoort 'blocks', QR-soort Landingspagina): kopjes, tekst en knoppen onder elkaar.
     Waarde: JSON [{ k:'h'|'p'|'btn', v, url }] (max. 12 blokken).
   Controle op de server: validation.ts. Tekenen: phone-templates.js (form, landing).
   ========================================================= */
var FormEditor = (function () {
  var MAX = 15, MAX_OPT = 8, KINDS = ['text', 'long', 'choice', 'multi', 'stars', 'email'];
  function parse(v) { try { var a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  var hasOpts = function (t) { return t === 'choice' || t === 'multi'; };
  function row(q, i, n) {
    var opts = hasOpts(q.t) ? '<div class="le-opts">' + (q.o || []).map(function (o, k) {
      return '<span class="le-opt"><input type="text" data-k="o" data-o="' + k + '" value="' + esc(o) + '" maxlength="60" placeholder="' + esc(t('fq.option', { n: k + 1 })) + '" aria-label="' + esc(t('fq.option', { n: k + 1 })) + '">' +
        '<button type="button" class="le-x sm" data-act="rmo" data-o="' + k + '" aria-label="' + esc(t('fq.removeOption')) + '">×</button></span>';
    }).join('') + ((q.o || []).length < MAX_OPT ? '<button type="button" class="le-add-o" data-act="addo">+ ' + esc(t('fq.addOption')) + '</button>' : '') + '</div>' : '';
    return '<div class="le-row" data-i="' + i + '"><div class="le-head"><span class="le-n">' + (i + 1) + '</span>' +
      '<select data-k="t" aria-label="' + esc(t('fq.kind')) + '">' + KINDS.map(function (k) { return '<option value="' + k + '"' + (k === q.t ? ' selected' : '') + '>' + esc(t('fq.k_' + k)) + '</option>'; }).join('') + '</select>' +
      '<label class="le-req"><input type="checkbox" data-k="r"' + (q.r ? ' checked' : '') + '><span>' + esc(t('fq.required')) + '</span></label>' +
      '<span class="le-move"><button type="button" class="le-x" data-act="up" aria-label="' + esc(t('fq.up')) + '"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="le-x" data-act="down" aria-label="' + esc(t('fq.down')) + '"' + (i < n - 1 ? '' : ' disabled') + '>↓</button>' +
      '<button type="button" class="le-x" data-act="rm" aria-label="' + esc(t('fq.remove')) + '">×</button></span></div>' +
      '<input type="text" class="le-q" data-k="q" value="' + esc(q.q || '') + '" maxlength="140" placeholder="' + esc(t('fq.question')) + '" aria-label="' + esc(t('fq.question')) + '">' + opts + '</div>';
  }
  function rows(list) { return list.length ? list.map(function (q, i) { return row(q, i, list.length); }).join('') : '<p class="le-empty">' + esc(t('fq.empty')) + '</p>'; }
  function html(f, id, v) {
    var list = parse(v);
    return '<div class="le" data-questions="' + f.key + '" id="' + id + '"><div class="le-list">' + rows(list) + '</div>' +
      '<button type="button" class="add-row le-add" data-act="add"' + (list.length >= MAX ? ' hidden' : '') + '>+ ' + esc(t('fq.add')) + '</button></div>';
  }
  function clean(list) {
    return list.filter(function (q) { return (q.q || '').trim() && (!hasOpts(q.t) || (q.o || []).filter(function (o) { return o.trim(); }).length >= 2); })
      .map(function (q) { var o = { t: q.t, q: q.q.trim() }; if (q.r) o.r = true; if (hasOpts(q.t)) o.o = q.o.map(function (x) { return x.trim(); }).filter(Boolean); return o; });
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-questions]').forEach(function (box) {
      var key = box.getAttribute('data-questions'), listEl = box.querySelector('.le-list'), add = box.querySelector('.le-add');
      var list = parse((store.get().content[store.get().typeId] || {})[key]);
      function save(redraw, focus) {
        if (redraw) listEl.innerHTML = rows(list);
        add.hidden = list.length >= MAX;
        var done = clean(list); onChange(key, done.length ? JSON.stringify(done) : '');
        if (focus) { var el = listEl.querySelector(focus); if (el) el.focus(); }
      }
      box.addEventListener('input', function (e) {
        e.stopPropagation();
        var r = e.target.closest('[data-i]'), k = e.target.getAttribute('data-k'); if (!r || !k) return;
        var q = list[+r.getAttribute('data-i')];
        if (k === 'o') { q.o[+e.target.getAttribute('data-o')] = e.target.value; return save(false); }
        if (k === 'r') { q.r = e.target.checked; return save(false); }
        if (k === 't') { q.t = e.target.value; if (hasOpts(q.t) && !(q.o && q.o.length)) q.o = ['', '']; return save(true); }
        q[k] = e.target.value; save(false);
      });
      box.addEventListener('change', function (e) { e.stopPropagation(); if (e.target.getAttribute('data-k') === 'r') { var r = e.target.closest('[data-i]'); list[+r.getAttribute('data-i')].r = e.target.checked; save(false); } });
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]'); if (!b) return;
        var a = b.getAttribute('data-act'), r = b.closest('[data-i]'), i = r ? +r.getAttribute('data-i') : -1;
        if (a === 'add' && list.length < MAX) { list.push({ t: 'text', q: '' }); return save(true, '[data-i="' + (list.length - 1) + '"] .le-q'); }
        if (a === 'rm') { list.splice(i, 1); return save(true); }
        if (a === 'up' && i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); return save(true); }
        if (a === 'down' && i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); return save(true); }
        if (a === 'addo') { list[i].o = (list[i].o || []).concat(['']); return save(true, '[data-i="' + i + '"] [data-o="' + (list[i].o.length - 1) + '"]'); }
        if (a === 'rmo') { list[i].o.splice(+b.getAttribute('data-o'), 1); return save(true); }
      });
    });
  }
  return { html: html, mount: mount, parse: parse };
})();

var BlocksEditor = (function () {
  var MAX = 12, KINDS = ['h', 'p', 'btn'];
  function parse(v) { try { var a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function row(b, i, n) {
    var main = b.k === 'p' ? '<textarea data-k="v" rows="3" maxlength="1000" placeholder="' + esc(t('lb.text')) + '" aria-label="' + esc(t('lb.text')) + '">' + esc(b.v || '') + '</textarea>'
      : '<input type="text" data-k="v" value="' + esc(b.v || '') + '" maxlength="' + (b.k === 'h' ? 100 : 40) + '" placeholder="' + esc(t(b.k === 'h' ? 'lb.heading' : 'lb.btnLabel')) + '" aria-label="' + esc(t(b.k === 'h' ? 'lb.heading' : 'lb.btnLabel')) + '">';
    return '<div class="le-row" data-i="' + i + '"><div class="le-head"><span class="le-n">' + (i + 1) + '</span>' +
      '<select data-k="k" aria-label="' + esc(t('lb.kind')) + '">' + KINDS.map(function (k) { return '<option value="' + k + '"' + (k === b.k ? ' selected' : '') + '>' + esc(t('lb.k_' + k)) + '</option>'; }).join('') + '</select>' +
      '<span class="le-move"><button type="button" class="le-x" data-act="up" aria-label="' + esc(t('fq.up')) + '"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="le-x" data-act="down" aria-label="' + esc(t('fq.down')) + '"' + (i < n - 1 ? '' : ' disabled') + '>↓</button>' +
      '<button type="button" class="le-x" data-act="rm" aria-label="' + esc(t('fq.remove')) + '">×</button></span></div>' + main +
      (b.k === 'btn' ? '<input type="url" data-k="url" value="' + esc(b.url || '') + '" placeholder="https://" aria-label="' + esc(t('lb.btnUrl')) + '" autocomplete="off">' : '') + '</div>';
  }
  function rows(list) { return list.length ? list.map(function (b, i) { return row(b, i, list.length); }).join('') : '<p class="le-empty">' + esc(t('lb.empty')) + '</p>'; }
  function html(f, id, v) {
    var list = parse(v);
    return '<div class="le" data-blocks="' + f.key + '" id="' + id + '"><div class="le-list">' + rows(list) + '</div>' +
      '<div class="le-adds"' + (list.length >= MAX ? ' hidden' : '') + '>' + KINDS.map(function (k) { return '<button type="button" class="add-row" data-act="add" data-kind="' + k + '">+ ' + esc(t('lb.k_' + k)) + '</button>'; }).join('') + '</div></div>';
  }
  function clean(list) {
    return list.filter(function (b) { return (b.v || '').trim() && (b.k !== 'btn' || /^https?:\/\/\S+\.\S+/.test(b.url || '')); })
      .map(function (b) { var o = { k: b.k, v: b.v.trim() }; if (b.k === 'btn') o.url = b.url.trim(); return o; });
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-blocks]').forEach(function (box) {
      var key = box.getAttribute('data-blocks'), listEl = box.querySelector('.le-list'), adds = box.querySelector('.le-adds');
      var list = parse((store.get().content[store.get().typeId] || {})[key]);
      function save(redraw, focus) {
        if (redraw) listEl.innerHTML = rows(list);
        adds.hidden = list.length >= MAX;
        var done = clean(list); onChange(key, done.length ? JSON.stringify(done) : '');
        if (focus) { var el = listEl.querySelector(focus); if (el) el.focus(); }
      }
      box.addEventListener('input', function (e) {
        e.stopPropagation();
        var r = e.target.closest('[data-i]'), k = e.target.getAttribute('data-k'); if (!r || !k) return;
        var b = list[+r.getAttribute('data-i')];
        b[k] = e.target.value; save(k === 'k');
      });
      box.addEventListener('change', function (e) { e.stopPropagation(); });
      box.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]'); if (!btn) return;
        var a = btn.getAttribute('data-act'), r = btn.closest('[data-i]'), i = r ? +r.getAttribute('data-i') : -1;
        if (a === 'add' && list.length < MAX) { list.push({ k: btn.getAttribute('data-kind'), v: '' }); return save(true, '[data-i="' + (list.length - 1) + '"] [data-k="v"]'); }
        if (a === 'rm') { list.splice(i, 1); return save(true); }
        if (a === 'up' && i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); return save(true); }
        if (a === 'down' && i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); return save(true); }
      });
    });
  }
  return { html: html, mount: mount, parse: parse };
})();
