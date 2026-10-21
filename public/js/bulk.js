/* =========================================================
   VEEL QR-CODES TEGELIJK (Pro en Business) — Mijn QR-codes > "Meerdere tegelijk"
   1. Kies de soort (Website, Video, WhatsApp/SMS, Wifi, vCard) en download het voorbeeldbestand (CSV, opent in Excel)
   2. Kies je bestand (CSV of Excel .xlsx). Elke regel = één QR-code. We controleren alles vóór het maken.
   3. Ontwerp (standaard of kopie van een bestaande code) en eventueel een map. Maken = alles of niets (server: POST /api/qr-codes/bulk).
   4. Klaar: alles in één keer downloaden als ZIP (PNG).
   ========================================================= */
var Bulk = (function () {
  var TYPES = ['website', 'video', 'whatsapp', 'wifi', 'vcard'], MAX = 500;
  var SIMPLE = { undefined: 1, url: 1, tel: 1, email: 1, select: 1, choice: 1, number: 1, date: 1, password: 1 };
  var st = null, dlg = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lbl(x) { return typeof x === 'string' ? t(x) : x && x.t ? t(x.t) : ''; }

  /* ---------- Kolommen per soort ---------- */
  function columns(typeId) {
    var tp = getType(typeId), cols = [{ key: '__name', label: t('bulk.colName') }];
    (tp.fields || []).forEach(function (f) {
      if (f.advanced || !SIMPLE[f.type] || (f.key === 'title' && /qrName/.test(f.label))) return;
      cols.push({ key: f.key, label: t(f.label, { n: f.n }), f: f });
    });
    return cols;
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[\s*:_-]+/g, '').trim(); }
  function sampleOf(f) {
    if (f.type === 'url') return 'https://www.voorbeeld.nl';
    if (f.type === 'tel') return '+31612345678';
    if (f.type === 'email') return 'info@voorbeeld.nl';
    if (f.options) return f.options[0].value;
    if (f.sample && typeof f.sample === 'string') return f.sample;
    return f.sample ? lbl(f.sample) : '';
  }

  /* ---------- Bestanden lezen: CSV en Excel (.xlsx) ---------- */
  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    var first = text.split(/\r?\n/)[0] || '', d = [';', ',', '\t'].sort(function (a, b) { return first.split(b).length - first.split(a).length; })[0];
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"') q = true; else if (c === d) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim(); }); });
  }
  // .xlsx = zip met XML: zelf uitpakken (DecompressionStream), eerste werkblad lezen
  function unzip(buf) {
    var v = new DataView(buf), u8 = new Uint8Array(buf), files = {}, eocd = -1;
    for (var i = buf.byteLength - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.reject(new Error('zip'));
    var n = v.getUint16(eocd + 10, true), p = v.getUint32(eocd + 16, true), jobs = [];
    for (var k = 0; k < n; k++) {
      var method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
      var name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      var lo = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), data = u8.subarray(lo, lo + csize);
      if (/^xl\/(sharedStrings|worksheets\/sheet1|workbook)\.xml$/.test(name)) jobs.push((function (name, data, method) {
        var raw = method === 0 ? Promise.resolve(data) : new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
        return raw.then(function (d) { files[name] = new TextDecoder().decode(d); });
      })(name, data, method));
      p += 46 + nl + el + cl;
    }
    return Promise.all(jobs).then(function () { return files; });
  }
  function parseXlsx(buf) {
    return unzip(buf).then(function (f) {
      var P = new DOMParser(), sh = f['xl/worksheets/sheet1.xml']; if (!sh) throw new Error('sheet');
      var strings = f['xl/sharedStrings.xml'] ? Array.prototype.map.call(P.parseFromString(f['xl/sharedStrings.xml'], 'application/xml').getElementsByTagName('si'), function (si) { return Array.prototype.map.call(si.getElementsByTagName('t'), function (x) { return x.textContent; }).join(''); }) : [];
      var doc = P.parseFromString(sh, 'application/xml'), rows = [];
      Array.prototype.forEach.call(doc.getElementsByTagName('row'), function (r) {
        var out = [];
        Array.prototype.forEach.call(r.getElementsByTagName('c'), function (c) {
          var ref = c.getAttribute('r') || '', col = 0; ref.replace(/[A-Z]+/, function (L) { for (var i = 0; i < L.length; i++) col = col * 26 + L.charCodeAt(i) - 64; });
          var tt = c.getAttribute('t'), vv = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0], val = '';
          if (tt === 's' && vv) val = strings[+vv.textContent] || ''; else if (tt === 'inlineStr' && is) val = is.textContent; else if (vv) val = vv.textContent;
          out[(col || out.length + 1) - 1] = val;
        });
        for (var i = 0; i < out.length; i++) if (out[i] == null) out[i] = '';
        rows.push(out);
      });
      return rows.filter(function (r) { return r.some(function (v) { return String(v).trim(); }); });
    });
  }
  function readFile(file) {
    if (/\.xlsx$/i.test(file.name)) return file.arrayBuffer().then(parseXlsx);
    if (/\.xls$/i.test(file.name)) return Promise.reject(new Error('xls'));
    return file.text().then(parseCsv);
  }

  /* ---------- Regels → QR-codes (met controle) ---------- */
  function toItems(rows) {
    var cols = columns(st.type), head = rows[0] || [], map = {};
    head.forEach(function (h, i) {
      var n = norm(h); cols.forEach(function (c) { if (n && (n === norm(c.label) || n === norm(c.key) || (c.key === '__name' && /^(naam|name|nombre|nom|qrname)$/.test(n)))) map[i] = c; });
    });
    var known = Object.keys(map).length, items = [];
    rows.slice(1).forEach(function (r, ri) {
      var it = { typeId: st.type, name: '', content: {}, errors: [] };
      Object.keys(map).forEach(function (i) {
        var c = map[i], v = String(r[i] == null ? '' : r[i]).trim(); if (!v) return;
        if (c.key === '__name') { it.name = v.slice(0, 60); return; }
        var f = c.f;
        if (f.options) { var o = f.options.filter(function (o) { return norm(o.value) === norm(v) || norm(lbl(o.label)) === norm(v); })[0]; if (!o) { it.errors.push(t('bulk.errChoice', { field: c.label, v: v })); return; } v = o.value; }
        if (f.type === 'url' && !/^https?:\/\//i.test(v)) v = 'https://' + v;
        if (f.type === 'url' && !/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v)) it.errors.push(t('bulk.errUrl', { field: c.label }));
        if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) it.errors.push(t('bulk.errEmail', { field: c.label }));
        if (f.type === 'number') v = Number(v);
        it.content[f.key] = v;
      });
      cols.forEach(function (c) { if (c.f && c.f.required && !c.f.or && it.content[c.f.key] == null) it.errors.push(t('bulk.errMissing', { field: c.label })); });
      if (!it.name) it.name = t('bulk.defaultName', { n: ri + 1 });
      it.row = ri + 2; items.push(it);
    });
    return { items: items, known: known };
  }

  /* ---------- Venster ---------- */
  function plan() { var i = window.PlanGate && PlanGate.info(); return i && i.plan; }
  function room() { var i = window.PlanGate && PlanGate.info(); if (!i || !i.usage || i.usage.limit == null) return null; return Math.max(0, i.usage.limit - i.usage.used); }
  function open() {
    var p = plan(), u = window.Session && Session.user();
    if (p && !p.bulk && !(u && u.admin)) { if (window.PlanGate) PlanGate.upgrade('pro', 'bulk'); return; }
    if (api.isDemo && api.isDemo()) { if (window.toast) toast('bulk.demo'); return; }
    st = { step: 1, type: 'website', file: null, items: null, known: 0, design: '', folder: '', busy: false, created: null, err: '' };
    if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'bk-dlg'; document.body.appendChild(dlg); dlg.addEventListener('click', onClick); dlg.addEventListener('change', onChange); dlg.addEventListener('cancel', function () { st = null; }); }
    Promise.all([api.folders ? api.folders.list().catch(function () { return { folders: [] }; }) : { folders: [] }]).then(function (r) { st.folders = (r[0] && r[0].folders) || []; draw(); dlg.showModal(); });
  }
  function typeTabs() {
    return '<div class="bk-types" role="radiogroup" aria-label="' + esc(t('bulk.type')) + '">' + TYPES.map(function (id) {
      var tp = getType(id); return '<button type="button" role="radio" aria-checked="' + (st.type === id) + '" data-bk-type="' + id + '">' + esc(typeName(tp)) + '</button>';
    }).join('') + '</div>';
  }
  function draw() {
    var h = '<div class="bk"><button type="button" class="bk-x" data-bk-close aria-label="' + esc(t('legal.close')) + '">×</button>';
    if (st.created) {
      h += '<div class="bk-done"><span class="bk-ok" aria-hidden="true">✓</span><h3>' + esc(t('bulk.doneTitle', { n: st.created.length })) + '</h3><p>' + esc(t('bulk.doneLead')) + '</p>' +
        '<div class="bk-btns"><button type="button" class="btn ghost" data-bk-close>' + esc(t('bulk.close')) + '</button><button type="button" class="btn primary" data-bk-zip' + (st.busy ? ' disabled' : '') + '>' + esc(t(st.busy ? 'bulk.zipping' : 'bulk.zip')) + '</button></div></div></div>';
      dlg.innerHTML = h; return;
    }
    h += '<h3>' + esc(t('bulk.title')) + '</h3><p class="bk-lead">' + esc(t('bulk.lead', { max: MAX })) + '</p>' +
      '<ol class="bk-steps">' +
      '<li><b>' + esc(t('bulk.s1')) + '</b>' + typeTabs() + '<button type="button" class="link-btn bk-tpl" data-bk-tpl>↓ ' + esc(t('bulk.template', { type: typeName(getType(st.type)) })) + '</button></li>' +
      '<li><b>' + esc(t('bulk.s2')) + '</b><label class="bk-file"><input type="file" accept=".csv,.xlsx,text/csv" data-bk-file><span>' + esc(st.file ? st.file : t('bulk.pick')) + '</span></label><small>' + esc(t('bulk.pickHint')) + '</small></li>';
    if (st.items) {
      var bad = st.items.filter(function (x) { return x.errors.length; }), r = room(), over = r != null && st.items.length > r;
      h += '<li><b>' + esc(t('bulk.s3', { n: st.items.length })) + '</b>' +
        (st.known < 2 ? '<p class="bk-warn">' + esc(t('bulk.noColumns')) + '</p>' : '') +
        (bad.length ? '<p class="bk-warn">' + esc(t('bulk.someErrors', { n: bad.length })) + '</p>' : '') +
        (over ? '<p class="bk-warn">' + esc(t('bulk.overLimit', { n: st.items.length, room: r })) + ' <button type="button" class="link-btn" data-gate-open="" data-gate-reason="limit">' + esc(t('bulk.moreRoom')) + '</button></p>' : '') +
        (st.items.length > MAX ? '<p class="bk-warn">' + esc(t('bulk.tooMany', { max: MAX })) + '</p>' : '') +
        '<div class="bk-table"><table><thead><tr><th>#</th><th>' + esc(t('bulk.colName')) + '</th><th>' + esc(t('bulk.colContent')) + '</th><th></th></tr></thead><tbody>' +
        st.items.slice(0, 200).map(function (x) {
          var first = Object.keys(x.content).map(function (k) { return x.content[k]; }).filter(Boolean)[0] || '';
          return '<tr class="' + (x.errors.length ? 'bad' : '') + '"><td>' + x.row + '</td><td>' + esc(x.name) + '</td><td class="bk-c">' + esc(first) + '</td><td>' + (x.errors.length ? '<span class="bk-e" title="' + esc(x.errors.join(' · ')) + '">' + esc(x.errors[0]) + '</span>' : '<span class="bk-y">✓</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></li>' +
        '<li><b>' + esc(t('bulk.s4')) + '</b><div class="bk-opts"><label><span>' + esc(t('bulk.design')) + '</span><select data-bk-design><option value="">' + esc(t('bulk.designDefault')) + '</option>' +
          ((window.MyCodes && MyCodes.rows()) || []).slice(0, 200).map(function (r) { return '<option value="' + esc(r.id) + '"' + (st.design === r.id ? ' selected' : '') + '>' + esc(t('bulk.designLike', { name: MyCodes.displayName(r) })) + '</option>'; }).join('') + '</select></label>' +
          '<label><span>' + esc(t('bulk.folder')) + '</span><select data-bk-folder><option value="">' + esc(t('bulk.noFolder')) + '</option>' +
          (st.folders || []).map(function (f) { return '<option value="' + esc(f.id) + '"' + (st.folder === f.id ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('') + '</select></label></div></li>';
      var can = st.items.length && !bad.length && !over && st.items.length <= MAX && !st.busy;
      h += '</ol>' + (st.err ? '<p class="acct-msg bad" role="alert">' + esc(st.err) + '</p>' : '') +
        '<div class="bk-btns"><button type="button" class="btn ghost" data-bk-close>' + esc(t('myCodes.cancel')) + '</button><button type="button" class="btn primary" data-bk-go' + (can ? '' : ' disabled') + '>' + esc(t(st.busy ? 'bulk.making' : 'bulk.go', { n: st.items.length })) + '</button></div></div>';
    } else h += '</ol>' + (st.err ? '<p class="acct-msg bad" role="alert">' + esc(st.err) + '</p>' : '') + '</div>';
    dlg.innerHTML = h;
  }
  function template() {
    var cols = columns(st.type), q = function (v) { v = String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [cols.map(function (c) { return q(c.label); }).join(';')];
    for (var i = 1; i <= 3; i++) lines.push(cols.map(function (c) { return q(c.key === '__name' ? t('bulk.defaultName', { n: i }) : sampleOf(c.f)); }).join(';'));
    saveFile(new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }), 'qr-codex-' + st.type + '.csv');
  }
  function go() {
    var rows = (window.MyCodes && MyCodes.rows()) || [], src = rows.filter(function (r) { return r.id === st.design; })[0];
    var design = src ? JSON.parse(JSON.stringify(src.design || {})) : {};
    st.busy = true; st.err = ''; draw();
    api.bulkQrCodes({ items: st.items.map(function (x) { return { typeId: x.typeId, name: x.name, content: x.content, design: design }; }), folderId: st.folder || undefined })
      .then(function (r) {
        st.busy = false; st.created = r.created || [];
        if (window.MyCodes) MyCodes.reload(); if (window.PlanGate) PlanGate.load(); draw();
      }, function (e) {
        st.busy = false;
        if (e && e.code === 'plan_limit') st.err = t('bulk.overLimit', { n: st.items.length, room: e.data && e.data.room != null ? e.data.room : 0 });
        else if (e && e.code === 'plan_bulk') st.err = t('bulk.locked');
        else if (e && e.data && e.data.rows) { e.data.rows.forEach(function (x) { var it = st.items[x.row]; if (it) it.errors.push(t('bulk.errServer')); }); st.err = t('bulk.someErrors', { n: e.data.rows.length }); }
        else st.err = t('myCodes.failed');
        draw();
      });
  }
  function onClick(e) {
    if (e.target === dlg || e.target.closest('[data-bk-close]')) { dlg.close(); st = null; return; }
    var b = e.target.closest('[data-bk-type]'); if (b) { st.type = b.getAttribute('data-bk-type'); st.items = null; st.file = null; st.err = ''; return draw(); }
    if (e.target.closest('[data-bk-tpl]')) return template();
    if (e.target.closest('[data-bk-go]')) return go();
    if (e.target.closest('[data-bk-zip]')) {
      st.busy = true; draw();
      var made = st.created.map(function (c) { return (window.MyCodes && MyCodes.rows() || []).filter(function (r) { return r.id === c.id; })[0] || c; });
      CodeUtil.downloadMany(made, 'png', 1024, 'qr-codex').then(function () { st.busy = false; draw(); }, function () { st.busy = false; draw(); });
    }
  }
  function onChange(e) {
    if (e.target.matches('[data-bk-file]')) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      st.file = f.name; st.err = '';
      readFile(f).then(function (rows) { var r = toItems(rows); st.items = r.items; st.known = r.known; if (!r.items.length) st.err = t('bulk.empty'); draw(); },
        function (er) { st.items = null; st.err = t(er && er.message === 'xls' ? 'bulk.oldExcel' : 'bulk.readError'); draw(); });
    }
    if (e.target.matches('[data-bk-design]')) st.design = e.target.value;
    if (e.target.matches('[data-bk-folder]')) st.folder = e.target.value;
  }
  return { open: open, parseCsv: parseCsv };
})();
