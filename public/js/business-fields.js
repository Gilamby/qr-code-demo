/* =========================================================
   SLIMME VELDEN voor Bedrijf (en later andere types):
   - hours   : openingstijden per dag met tijdkiezers (geen vrije tekst)
   - address : zoeken en kiezen uit echte adressen (OpenStreetMap / Photon)
   - socials : maximaal 8 bekende netwerken
   Alle waarden worden als JSON-tekst in de state bewaard, zodat opslaan en valideren gelijk blijven.
   ========================================================= */

/* ---------- Openingstijden ---------- */
var HOURS = (function () {
  // o = open, f/t = van/tot, f2/t2 = tweede tijdvak (pauze)
  var DEFAULT = [0, 1, 2, 3, 4].map(function () { return { o: 1, f: '09:00', t: '18:00' }; })
    .concat([{ o: 1, f: '10:00', t: '17:00' }, { o: 0, f: '10:00', t: '17:00' }]);
  var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  function parse(v) {
    try { var a = JSON.parse(v); if (Array.isArray(a) && a.length === 7) return a; } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  function mins(s) { return +s.slice(0, 2) * 60 + +s.slice(3, 5); }
  function slots(x) { var s = [[x.f, x.t]]; if (x.f2 && x.t2) s.push([x.f2, x.t2]); return s; }
  // 'open' of 'closed' op dit moment (tijd van de bezoeker). Tijden over middernacht tellen mee (ook die van gisteren).
  function status(arr) {
    var now = new Date(), d = (now.getDay() + 6) % 7, m = now.getHours() * 60 + now.getMinutes(), day = arr[d], prev = arr[(d + 6) % 7], open = false;
    if (day && day.o) slots(day).forEach(function (r) { var a = mins(r[0]), b = mins(r[1]); if (b > a ? (m >= a && m < b) : m >= a) open = true; });
    if (prev && prev.o) slots(prev).forEach(function (r) { var a = mins(r[0]), b = mins(r[1]); if (b <= a && m < b) open = true; });
    return open ? 'open' : 'closed';
  }
  function dayName(i, style) { return new Intl.DateTimeFormat(i18n.lang(), { weekday: style || 'long' }).format(new Date(2024, 0, 1 + i)); }
  function fmt(s) { var d = new Date(2024, 0, 1, +s.slice(0, 2), +s.slice(3, 5)); return new Intl.DateTimeFormat(i18n.lang(), { hour: i18n.lang() === 'en' ? 'numeric' : '2-digit', minute: '2-digit' }).format(d); }
  function valid(arr) {
    return Array.isArray(arr) && arr.length === 7 && arr.every(function (d) {
      return d && (!d.o || (TIME.test(d.f) && TIME.test(d.t) && (!d.f2 && !d.t2 || TIME.test(d.f2) && TIME.test(d.t2))));
    });
  }
  return { DEFAULT: DEFAULT, parse: parse, status: status, dayName: dayName, fmt: fmt, valid: valid };
})();

var HoursEditor = (function () {
  function rows(arr) {
    return arr.map(function (d, i) {
      var times = d.o
        ? '<span class="hr-times"><input type="time" data-k="f" value="' + d.f + '" aria-label="' + esc(HOURS.dayName(i)) + ' – ' + t('hours.from') + '">' +
            '<i>–</i><input type="time" data-k="t" value="' + d.t + '" aria-label="' + esc(HOURS.dayName(i)) + ' – ' + t('hours.to') + '">' +
            (d.f2 !== undefined
              ? '<span class="hr-break"><input type="time" data-k="f2" value="' + (d.f2 || '') + '"><i>–</i><input type="time" data-k="t2" value="' + (d.t2 || '') + '"><button type="button" class="hr-x" data-act="rm2" aria-label="' + t('hours.removeSlot') + '">×</button></span>'
              : '<button type="button" class="hr-add" data-act="add2" title="' + t('hours.addSlot') + '" aria-label="' + t('hours.addSlot') + '">+</button>') +
          '</span>'
        : '<span class="hr-closed">' + t('hours.closed') + '</span>';
      return '<div class="hr-row' + (d.o ? '' : ' off') + '" data-day="' + i + '">' +
        '<label class="hr-day"><input type="checkbox" data-k="o"' + (d.o ? ' checked' : '') + '><span class="sw-ui"></span>' + esc(HOURS.dayName(i, 'short')) + '</label>' + times + '</div>';
    }).join('');
  }
  function html(f, id, value) {
    return '<div class="hours" data-hours="' + f.key + '" id="' + id + '"><div class="hr-list">' + rows(HOURS.parse(value)) + '</div>' +
      '<button type="button" class="hr-same" data-act="same">' + t('hours.same') + '</button></div>';
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-hours]').forEach(function (box) {
      var key = box.getAttribute('data-hours'), list = box.querySelector('.hr-list');
      var arr = HOURS.parse(store.get().content[store.get().typeId] && store.get().content[store.get().typeId][key]);
      function save(redraw) { if (redraw) list.innerHTML = rows(arr); onChange(key, JSON.stringify(arr)); }
      if (!(store.get().content[store.get().typeId] || {})[key]) onChange(key, JSON.stringify(arr));   // standaardtijden direct als waarde
      box.addEventListener('input', function (e) {
        e.stopPropagation();
        var row = e.target.closest('[data-day]'), k = e.target.getAttribute('data-k'); if (!row || !k) return;
        var d = arr[+row.getAttribute('data-day')];
        if (k === 'o') { d.o = e.target.checked ? 1 : 0; return save(true); }
        if (e.target.value) { d[k] = e.target.value; save(false); }
      });
      box.addEventListener('change', function (e) { e.stopPropagation(); });
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]'); if (!b) return;
        var row = b.closest('[data-day]'), d = row && arr[+row.getAttribute('data-day')], act = b.getAttribute('data-act');
        if (act === 'add2') { d.f2 = '15:00'; d.t2 = '18:00'; if (d.t > '13:00') d.t = '13:00'; }
        if (act === 'rm2') { delete d.f2; delete d.t2; }
        if (act === 'same') { var first = arr[0]; arr = arr.map(function () { return JSON.parse(JSON.stringify(first)); }); }
        save(true);
      });
    });
  }
  return { html: html, mount: mount };
})();

/* ---------- Adres: zoeken in echte adressen ---------- */
var ADDRESS = {
  parse: function (v) { try { var a = JSON.parse(v); return a && a.l ? a : null; } catch (e) { return null; } },
  mapUrl: function (a) { return 'https://www.google.com/maps/search/?api=1&query=' + (a.lat != null ? a.lat + ',' + a.lon : encodeURIComponent(a.l)); }
};
var AddressSearch = (function () {
  var API = 'https://photon.komoot.io/api/';
  function label(p) {
    var street = [p.street || (p.type !== 'city' ? p.name : ''), p.housenumber].filter(Boolean).join(' ');
    var name = p.name && p.street && p.name !== p.street ? p.name : '';
    return [name, street, [p.postcode, p.city || p.town || p.village].filter(Boolean).join(' '), p.country].filter(Boolean).join(', ');
  }
  function html(f, id, value) {
    var a = ADDRESS.parse(value);
    return '<div class="addr' + (a ? ' ok' : '') + '" data-addr="' + f.key + '">' +
      '<input id="' + id + '" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(t('address.placeholder')) + '" value="' + esc(a ? a.l : '') + '" role="combobox" aria-expanded="false" aria-autocomplete="list">' +
      '<ul class="addr-list" role="listbox" hidden></ul><small class="addr-msg">' + (a ? (a.u ? t('address.unverified') : t('address.ok')) : '') + '</small></div>';
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-addr]').forEach(function (box) {
      var key = box.getAttribute('data-addr'), input = box.querySelector('input'), list = box.querySelector('.addr-list'), msg = box.querySelector('.addr-msg');
      var timer, results = [], active = -1, seq = 0;
      function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
      function pick(r) {
        box.classList.add('ok'); box.classList.remove('err'); input.value = r.l; msg.textContent = r.u ? t('address.unverified') : t('address.ok');
        close(); onChange(key, JSON.stringify(r));
      }
      function show() {
        list.innerHTML = results.map(function (r, i) { return '<li role="option" data-i="' + i + '"' + (i === active ? ' class="on"' : '') + '>' + esc(r.l) + '</li>'; }).join('');
        list.hidden = !results.length; input.setAttribute('aria-expanded', String(!!results.length));
      }
      function search(q) {
        var my = ++seq, lang = ['de', 'en', 'fr'].indexOf(i18n.lang()) >= 0 ? '&lang=' + i18n.lang() : '';
        msg.textContent = t('address.searching');
        fetch(API + '?limit=5' + lang + '&q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (data) {
          if (my !== seq) return;
          results = (data.features || []).map(function (f) { return { l: label(f.properties), lat: +f.geometry.coordinates[1].toFixed(6), lon: +f.geometry.coordinates[0].toFixed(6) }; })
            .filter(function (r, i, all) { return r.l && all.findIndex(function (x) { return x.l === r.l; }) === i; });
          active = -1; show(); msg.textContent = results.length ? t('address.pick') : t('address.none');
        }).catch(function () {
          // Zoekdienst niet bereikbaar (bv. geen internet): adres toch toestaan, maar gemarkeerd als niet gecontroleerd.
          if (my !== seq) return;
          results = [{ l: q, u: 1 }]; active = 0; show(); msg.textContent = t('address.offline');
        });
      }
      input.addEventListener('input', function (e) {
        e.stopPropagation();
        box.classList.remove('ok'); onChange(key, '');        // getypt maar nog niet gekozen = nog geen geldig adres
        clearTimeout(timer); var q = input.value.trim();
        if (q.length < 3) { results = []; show(); msg.textContent = ''; return; }
        timer = setTimeout(function () { search(q); }, 300);
      });
      input.addEventListener('keydown', function (e) {
        if (list.hidden) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length; show(); }
        if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(results[active]); }
        if (e.key === 'Escape') close();
      });
      list.addEventListener('mousedown', function (e) { var li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pick(results[+li.getAttribute('data-i')]); } });
      input.addEventListener('blur', function () { setTimeout(close, 120); });
    });
  }
  return { html: html, mount: mount };
})();

/* ---------- Social media ---------- */
var SOCIALS = (function () {
  var LIST = [
    { id: 'instagram', name: 'Instagram' }, { id: 'facebook', name: 'Facebook' }, { id: 'tiktok', name: 'TikTok' }, { id: 'linkedin', name: 'LinkedIn' },
    { id: 'x', name: 'X' }, { id: 'youtube', name: 'YouTube' }, { id: 'whatsapp', name: 'WhatsApp' }, { id: 'google', name: 'Google' }
  ];
  var G = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><rect x="4.5" y="4.5" width="15" height="15" rx="4.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="16.6" cy="7.4" r=".6" fill="#fff"/></svg>',
    facebook: '<b>f</b>', tiktok: '<b>♪</b>', linkedin: '<b>in</b>', x: '<b>X</b>',
    youtube: '<svg viewBox="0 0 24 24"><path d="M10 8.5l6 3.5-6 3.5z" fill="#fff"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.3z"/><path d="M9.5 9.5c.3 1.8 1.8 3.5 3.8 4.2l1-1 1.4.7-.4 1.3c-2.9.3-6-2.6-6.3-5.6l1.3-.4.7 1.4z" fill="#fff" stroke="none"/></svg>',
    google: '<b>G</b>'
  };
  function icon(id) { return '<span class="br br-' + id + '">' + G[id] + '</span>'; }
  function parse(v) { try { var o = JSON.parse(v); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  return { LIST: LIST, icon: icon, parse: parse };
})();
var SocialsEditor = (function () {
  function inputs(obj) {
    return SOCIALS.LIST.filter(function (s) { return s.id in obj; }).map(function (s) {
      return '<div class="so-row">' + SOCIALS.icon(s.id) + '<input type="url" data-net="' + s.id + '" value="' + esc(obj[s.id] || '') + '" placeholder="' + esc(t('socials.placeholder', { name: s.name })) + '"><button type="button" class="hr-x" data-rm="' + s.id + '" aria-label="' + esc(s.name) + '">×</button></div>';
    }).join('');
  }
  function html(f, id, value) {
    var obj = SOCIALS.parse(value);
    return '<div class="socials" data-socials="' + f.key + '" id="' + id + '"><div class="so-pick">' + SOCIALS.LIST.map(function (s) {
      return '<button type="button" class="so-chip" data-net-toggle="' + s.id + '" aria-pressed="' + (s.id in obj) + '" title="' + s.name + '">' + SOCIALS.icon(s.id) + '</button>';
    }).join('') + '</div><div class="so-list">' + inputs(obj) + '</div></div>';
  }
  function mount(root, onChange) {
    root.querySelectorAll('[data-socials]').forEach(function (box) {
      var key = box.getAttribute('data-socials'), list = box.querySelector('.so-list');
      var obj = SOCIALS.parse((store.get().content[store.get().typeId] || {})[key]);
      function save(redraw) {
        if (redraw) { list.innerHTML = inputs(obj); box.querySelectorAll('[data-net-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-net-toggle') in obj)); }); }
        onChange(key, Object.keys(obj).length ? JSON.stringify(obj) : '');
      }
      box.addEventListener('click', function (e) {
        var tg = e.target.closest('[data-net-toggle]'), rm = e.target.closest('[data-rm]');
        if (tg) { var n = tg.getAttribute('data-net-toggle'); if (n in obj) delete obj[n]; else obj[n] = ''; save(true); var inp = list.querySelector('[data-net="' + n + '"]'); if (inp) inp.focus(); }
        if (rm) { delete obj[rm.getAttribute('data-rm')]; save(true); }
      });
      box.addEventListener('input', function (e) { e.stopPropagation(); var n = e.target.getAttribute('data-net'); if (n) { obj[n] = e.target.value.trim(); save(false); } });
    });
  }
  return { html: html, mount: mount };
})();

/* ---------- Verplichte velden ---------- */
function missingRequired(state) {
  var type = getType(state.typeId), c = state.content[type.id] || {};
  return type.fields.filter(function (f) { return f.required && !(c[f.key] && String(c[f.key]).trim()); }).map(function (f) { return f.key; });
}
