/* Bestand opslaan (download). In de online demo (claude.ai) mag een pagina niet zelf downloaden:
   daar gaat het via claude.use("downloads"), met een bevestiging. Elders: gewone download-link. */
function saveFile(blob, filename) {
  function plain() { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  if (!(window.claude && typeof window.claude.use === 'function')) return plain();
  window.claude.use('downloads').then(function (dl) { if (!dl) return plain(); return dl.save({ filename: filename, data: blob }).catch(function () {}); }).catch(plain);
}

/* =========================================================
   API: het enige bestand dat met de backend praat.
   Zonder server (zoals in de online demo) bewaart de app je QR-codes in deze browser (demo-opslag),
   zodat Mijn QR-codes ook in de demo werkt. Een echte server telt scans; de demo niet.
   ========================================================= */
var api = (function () {
  var online = null;
  function request(method, url, body) {
    return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (res) {
        if (res.status === 204) return null;
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) {
            var err = new Error(data.error || ('HTTP ' + res.status)); err.status = res.status; err.code = data.error; err.details = data.details; err.data = data; if (data.error === 'subscription_lapsed') setTimeout(function () { document.dispatchEvent(new CustomEvent('sub-lapsed')); }, 0); if (data.error === 'viewer') setTimeout(function () { document.dispatchEvent(new CustomEvent('team-viewer')); }, 0); if (data.error === 'maintenance') { info.maintenance = { on: true, message: data.message || '' }; setTimeout(function () { document.dispatchEvent(new CustomEvent('maintenance-change')); }, 0); }
            if (res.status === 401 && url.indexOf('api/auth/') !== 0) document.dispatchEvent(new Event('auth:required'));   // sessie verlopen: opnieuw inloggen
            throw err;
          }
          return data;
        });
      });
  }
  var info = {};                                                   // { qrBase, phoneReachable } van de server
  function available() {
    if (online !== null) return Promise.resolve(online);
    return fetch('api/health').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { online = !!(d && d.ok); info = d || {}; return online; })
      .catch(function () { online = false; return online; });
  }

  /* ---------- Demo-opslag (alleen zonder server) ---------- */
  var local = (function () {
    var KEY = 'optimasys-demo-codes', FKEY = 'optimasys-demo-folders', memory = null, fmem = null;
    function read() {
      if (memory) return memory;
      try { memory = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { memory = []; }
      if (!Array.isArray(memory)) memory = [];
      return memory;
    }
    function write() { try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* vol of geblokkeerd: dan alleen zolang de pagina open is */ } }
    function secret(typeId) { var tp = getType(typeId), f = tp && tp.fields.filter(function (x) { return x.type === 'password'; })[0]; return f ? f.key : null; }
    // Zelfde vorm als de server teruggeeft: wachtwoord nooit mee, wel of er een is.
    function out(q) {
      var c = Object.assign({}, q.content), k = secret(q.typeId), r = Object.assign({}, q, { content: c, hasPassword: !!(k && c[k]), shortUrl: shortLink(q.id) });
      if (k) delete c[k];
      return r;
    }
    function find(id) { return read().filter(function (q) { return q.id === id; })[0]; }
    // Mappen in de demo: ook in deze browser
    function folders() { if (!fmem) { try { fmem = JSON.parse(localStorage.getItem(FKEY) || '[]'); } catch (e) { fmem = []; } if (!Array.isArray(fmem)) fmem = []; } return fmem; }
    function saveFolders() { try { localStorage.setItem(FKEY, JSON.stringify(fmem)); } catch (e) { /* alleen zolang de pagina open is */ } }
    function ferr(code, status) { var e = new Error(code); e.code = code; e.status = status; return Promise.reject(e); }
    function fname(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 40); }
    function notFound() { var e = new Error('QR code not found'); e.status = 404; return Promise.reject(e); }
    function clean(content) { var c = {}; Object.keys(content || {}).forEach(function (k) { var v = content[k]; if (v != null && String(v).trim() !== '') c[k] = String(v).trim(); }); return c; }
    return {
      list: function () { return Promise.resolve(read().slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).map(out)); },
      get: function (id) { var q = find(id); return q ? Promise.resolve(out(q)) : notFound(); },
      create: function (d) {
        var tp = getType(d.typeId);
        var q = { id: d.id || newDraftId(), createdAt: new Date().toISOString(), scans: 0, lastScanAt: null, typeId: d.typeId, contentType: tp.contentType, content: clean(d.content), design: d.design || {} };
        if (d.name) q.name = String(d.name).slice(0, 60);
        if (d.folderId && folders().some(function (f) { return f.id === d.folderId; })) q.folderId = d.folderId;
        read().push(q); write(); return Promise.resolve(out(q));
      },
      update: function (id, d) {
        var q = find(id); if (!q) return notFound();
        var k = secret(q.typeId), c = clean(d.content);
        if (k && !c[k] && d.keepPassword && q.content[k]) c[k] = q.content[k];
        q.content = c; q.design = d.design || q.design; q.updatedAt = new Date().toISOString();
        if (d.name !== undefined) q.name = String(d.name).slice(0, 60);
        write(); return Promise.resolve(out(q));
      },
      patch: function (id, p) {
        var q = find(id); if (!q) return notFound();
        if (p.name !== undefined) q.name = String(p.name).replace(/\s+/g, ' ').trim().slice(0, 60);
        if (p.paused !== undefined) q.paused = !!p.paused;
        if (p.favorite !== undefined) q.favorite = !!p.favorite;
        write(); return Promise.resolve(out(q));
      },
      remove: function (id) { memory = read().filter(function (q) { return q.id !== id; }); write(); return Promise.resolve(null); },
      duplicate: function (id, d) {
        var q = find(id); if (!q) return notFound();
        var c = JSON.parse(JSON.stringify(q)); c.id = newDraftId(); c.createdAt = new Date().toISOString(); c.updatedAt = null; c.scans = 0; c.lastScanAt = null; c.paused = false; c.favorite = false;
        if (d && d.name) c.name = String(d.name).slice(0, 60);
        read().push(c); write(); return Promise.resolve(out(c));
      },
      folders: {
        list: function () { return Promise.resolve({ folders: folders().slice() }); },
        order: function (ids) { var all = folders(), by = {}; all.forEach(function (f) { by[f.id] = f; }); var next = ids.map(function (id) { return by[id]; }).filter(Boolean); all.forEach(function (f) { if (next.indexOf(f) < 0) next.push(f); }); all.length = 0; next.forEach(function (f) { all.push(f); }); saveFolders(); return Promise.resolve({ folders: all.slice() }); },
        create: function (d) {
          var name = fname(d.name); if (!name) return ferr('name', 400);
          if (folders().some(function (f) { return f.name.toLowerCase() === name.toLowerCase(); })) return ferr('exists', 409);
          var f = { id: newDraftId(), name: name, color: d.color || 'cyan', createdAt: new Date().toISOString() }; folders().push(f); saveFolders(); return Promise.resolve({ folder: f });
        },
        update: function (id, d) {
          var f = folders().filter(function (x) { return x.id === id; })[0]; if (!f) return ferr('not_found', 404);
          if (d.name !== undefined) {
            var name = fname(d.name); if (!name) return ferr('name', 400);
            if (folders().some(function (x) { return x.id !== id && x.name.toLowerCase() === name.toLowerCase(); })) return ferr('exists', 409);
            f.name = name;
          }
          if (d.color !== undefined) f.color = d.color;
          saveFolders(); return Promise.resolve({ folder: f });
        },
        remove: function (id) {
          fmem = folders().filter(function (x) { return x.id !== id; }); saveFolders();
          read().forEach(function (q) { if (q.folderId === id) q.folderId = null; }); write(); return Promise.resolve(null);
        },
        move: function (d) {
          var n = 0; read().forEach(function (q) { if (d.ids.indexOf(q.id) >= 0) { q.folderId = d.folderId || null; n++; } }); write(); return Promise.resolve({ moved: n });
        }
      }
    };
  })();
  /* ---------- Demo-statistieken (alleen zonder server) ----------
     Voorbeeldcijfers, steeds dezelfde per code, zodat de pagina Statistieken te bekijken is.
     De pagina toont duidelijk dat het voorbeeldcijfers zijn. */
  var demoStats = (function () {
    var PLACES = [['NL', 'Amsterdam', 9], ['NL', 'Rotterdam', 6], ['NL', 'Utrecht', 4], ['BE', 'Antwerp', 3], ['BE', 'Brussels', 2], ['DE', 'Berlin', 4], ['DE', 'Hamburg', 2],
      ['ES', 'Madrid', 3], ['ES', 'Barcelona', 3], ['FR', 'Paris', 3], ['GB', 'London', 4], ['IT', 'Milan', 2], ['PT', 'Lisbon', 1], ['US', 'New York', 2], ['PL', 'Krakow', 1]];
    var OS = [['iOS', 46], ['Android', 38], ['Windows', 8], ['macOS', 5], ['other', 3]];
    function rnd(seed) { var h = 2166136261; for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h += 0x6D2B79F5; var t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function weighted(r, list, w) { var sum = list.reduce(function (s, x) { return s + x[w]; }, 0), x = r() * sum; for (var i = 0; i < list.length; i++) { x -= list[i][w]; if (x <= 0) return list[i]; } return list[0]; }
    return function (code) {
      var r = rnd(code.id), stats = {}, base = 3 + Math.floor(r() * 9);
      ANALYTICS.days(new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)).forEach(function (d, i) {
        var wk = new Date(d + 'T12:00:00Z').getUTCDay(), n = Math.max(0, Math.round(base * (wk === 0 || wk === 6 ? 1.5 : 1) * (0.4 + r() * 1.2) * (0.7 + i / 300)));
        if (!n) return; var day = stats[d] = {};
        for (var k = 0; k < n; k++) { var o = weighted(r, OS, 1)[0], p = weighted(r, PLACES, 2), key = o + '|' + p[0] + '|' + p[1], v = day[key] = day[key] || [0, 0]; v[0]++; if (r() < 0.82) v[1]++; }
      });
      return Object.assign({}, code, { stats: stats, createdAt: new Date(Date.now() - 120 * 864e5).toISOString() });
    };
  })();
  function demoCodes() {
    return local.list().then(function (rows) {
      if (!rows.length) rows = [['demo-site', 'website', 'Optimasys'], ['demo-menu', 'menu', t('sample.bizName')], ['demo-coupon', 'coupon', t('pv.coupon.title')], ['demo-wifi', 'wifi', t('sample.wifiSsid')]]
        .map(function (x) { return { id: x[0], typeId: x[1], name: x[2], content: {}, createdAt: new Date().toISOString() }; });
      return rows.map(demoStats);
    });
  }

  // Kies per aanroep: server als die er is, anders de demo-opslag
  function flat(q) { var o = {}; Object.keys(q || {}).forEach(function (k) { o[k] = Array.isArray(q[k]) ? q[k].join(',') : q[k]; }); return o; }
  function query(q) { var f = flat(q); return Object.keys(f).filter(function (k) { return f[k]; }).map(function (k) { return k + '=' + encodeURIComponent(f[k]); }).join('&'); }
  // Demo zonder server: accounts alleen in deze browser; de bevestigingsmail wordt nagebootst met een knop.
  var demoAuth = (function () {
    var KEY = 'optimasys-demo-user', ACCOUNTS = 'optimasys-demo-accounts';
    function fail(code, status) { var e = new Error(code); e.code = code; e.status = status || 401; return Promise.reject(e); }
    function get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
    function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function digest(pw) {                       // nooit het wachtwoord zelf bewaren, ook niet in de demo
      if (!(window.crypto && crypto.subtle)) return Promise.resolve(String(pw).length + ':' + String(pw).split('').reverse().join('').slice(0, 2));
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode('optimasys-demo:' + pw)).then(function (b) { return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); });
    }
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
    return {
      me: function () { var u = get(KEY); return u ? Promise.resolve(u) : fail('Not logged in'); },
      register: function (d) {
        var email = String(d.email || '').trim().toLowerCase(), acc = get(ACCOUNTS) || {};
        if (!EMAIL_RE.test(email)) return fail('email', 400);
        var pp = PasswordRules.problem(d.password); if (pp) return fail('password_' + pp, 400);
        return digest(d.password).then(function (h) {
          if (!acc[email] || !acc[email].verified) acc[email] = { email: email, name: String(d.name || '').trim() || email.split('@')[0], pw: h, verified: false, createdAt: new Date().toISOString() };
          put(ACCOUNTS, acc); return { verify: true, email: email };
        });
      },
      verify: function (d) {
        var email = String(d.token || '').replace(/^demo:/, ''), acc = get(ACCOUNTS) || {};
        if (!acc[email]) return fail('token', 400);
        acc[email].verified = true; put(ACCOUNTS, acc); return Promise.resolve({ ok: true, email: email });
      },
      login: function (d) {
        var email = String(d.email || '').trim().toLowerCase(), a = (get(ACCOUNTS) || {})[email];
        return digest(d.password || '').then(function (h) {
          if (!a || a.pw !== h) return fail('wrong');
          if (!a.verified) return fail('unverified', 403);
          var u = { id: 'demo', email: a.email, name: a.name, createdAt: a.createdAt, demo: true }; put(KEY, u); return u;
        });
      },
      logout: function () { try { localStorage.removeItem(KEY); } catch (e) {} return Promise.resolve(null); },

      /* Mijn account in de demo: zelfde antwoorden als de server, maar alles in deze browser */
      account: (function () {
        function cur() { var u = get(KEY), acc = get(ACCOUNTS) || {}; return u && acc[u.email] ? { u: u, acc: acc, a: acc[u.email] } : null; }
        function need() { var c = cur(); if (!c) { var e = new Error('Not logged in'); e.status = 401; throw e; } return c; }
        function save(c) { put(ACCOUNTS, c.acc); }
        return {
          update: function (d) { return Promise.resolve().then(function () {
            var c = need();
            if (d.name !== undefined) c.u.name = c.a.name = String(d.name || '').trim().slice(0, 80);
            if (d.avatar !== undefined) c.u.avatar = c.a.avatar = d.avatar;
            if (d.timezone !== undefined) c.u.timezone = c.a.timezone = d.timezone || null;
            if (d.theme !== undefined) c.u.theme = c.a.theme = d.theme;
            save(c); put(KEY, c.u); return c.u; }); },
          password: function (d) { return Promise.resolve().then(function () {
            var c = need();
            return digest(d.current || '').then(function (h) {
              if (h !== c.a.pw) return fail('wrong', 403);
              var pp = PasswordRules.problem(d.password); if (pp) return fail('password_' + pp, 400);
              return digest(d.password).then(function (nh) { c.a.pw = nh; save(c); return { ok: true }; });
            }); }); },
          summary: function () { return Promise.resolve().then(function () {
            var c = need();
            return demoCodes().then(function (codes) {
              var o = ANALYTICS.overview(codes, {}), since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), s30 = 0;
              codes.forEach(function (q) { Object.keys(q.stats || {}).forEach(function (day) { if (day >= since) Object.keys(q.stats[day]).forEach(function (k) { s30 += q.stats[day][k][0]; }); }); });
              return { createdAt: c.a.createdAt, codes: codes.length, scans: o.totals.scans, scans30: s30, sessions: 1 };
            }); }); },
          logoutOthers: function () { return Promise.resolve({ ok: true }); },
          billing: function () { return Promise.resolve().then(function () { return { billing: need().a.billing || null }; }); },
          saveBilling: function (b) { return Promise.resolve().then(function () {
            var c = need(), v = Object.assign({}, b), err = [];
            ['companyName', 'taxId', 'firstName', 'lastName', 'email', 'address', 'postalCode', 'city', 'country'].forEach(function (k) { v[k] = String(v[k] || '').replace(/\s+/g, ' ').trim(); });
            if (v.type !== 'private') { v.type = 'company'; v.taxId = v.taxId.toUpperCase().replace(/[\s.]/g, ''); } else { v.companyName = ''; v.taxId = ''; }
            v.postalCode = v.postalCode.toUpperCase(); v.country = v.country.toUpperCase(); v.email = v.email.toLowerCase();
            if (v.type === 'company' && !v.companyName) err.push('companyName');
            if (v.type === 'private' && !v.firstName) err.push('firstName');
            if (v.type === 'private' && !v.lastName) err.push('lastName');
            if (v.taxId && !/^[A-Z]{2}[A-Z0-9-]{2,15}$/.test(v.taxId)) err.push('taxId');
            if (v.email && !EMAIL_RE.test(v.email)) err.push('email');
            if (!v.address) err.push('address');
            if (!/^[A-Z0-9][A-Z0-9 -]{1,11}$/.test(v.postalCode)) err.push('postalCode');
            if (!v.city) err.push('city');
            if (!/^[A-Z]{2}$/.test(v.country)) err.push('country');
            if (err.length) { var e = new Error('Invalid billing details'); e.status = 400; e.details = err; throw e; }
            c.a.billing = v; save(c); return { billing: v }; }); },
          exportData: function () { return Promise.resolve().then(function () {
            var c = need();
            return local.list().then(function (codes) { return { exportedAt: new Date().toISOString(), demo: true, account: { email: c.a.email, name: c.a.name, createdAt: c.a.createdAt }, billing: c.a.billing || null, qrCodes: codes }; }); }); },
          remove: function (d) { return Promise.resolve().then(function () {
            var c = need();
            return digest(d.password || '').then(function (h) {
              if (h !== c.a.pw) return fail('wrong', 403);
              delete c.acc[c.u.email]; save(c);
              try { localStorage.removeItem(KEY); localStorage.removeItem('optimasys-demo-codes'); } catch (e) {}
              return null;
            }); }); }
        };
      })()
    };
  })();
  function either(server, demo) { return function () { var a = arguments; return available().then(function (on) { return on ? server.apply(null, a) : demo.apply(null, a); }); }; }

  return {
    available: available,
    info: function () { return info; },
    isDemo: function () { return online === false; },
    codeHealth:   function () { return api.isDemo && api.isDemo() ? Promise.resolve({}) : request('GET', 'api/qr-codes/health'); },
    codeHealthNow: function (id) { return request('POST', 'api/qr-codes/' + encodeURIComponent(id) + '/health', {}); },
    listQrCodes:  either(function () { return request('GET', 'api/qr-codes'); }, local.list),
    getQrCode:    either(function (id) { return request('GET', 'api/qr-codes/' + encodeURIComponent(id)); }, local.get),
    createQrCode: either(function (data) { return request('POST', 'api/qr-codes', data); }, local.create),
    updateQrCode: either(function (id, data) { return request('PUT', 'api/qr-codes/' + encodeURIComponent(id), data); }, local.update),
    patchQrCode:  either(function (id, patch) { return request('PATCH', 'api/qr-codes/' + encodeURIComponent(id), patch); }, local.patch),
    deleteQrCode: either(function (id) { return request('DELETE', 'api/qr-codes/' + encodeURIComponent(id)); }, local.remove),
    bulkQrCodes:  function (d) { return request('POST', 'api/qr-codes/bulk', d); },   // veel tegelijk (Pro, Business)
    // Prullenbak (alleen met server; in de demo wordt gewoon verwijderd)
    purgedLog:      function ()   { return api.isDemo() ? Promise.resolve([]) : request('GET', 'api/qr-codes/purged').then(function (r) { return (r && r.purged) || []; }); },
    trash:          function ()   { return api.isDemo() ? Promise.resolve([]) : request('GET', 'api/qr-codes/trash'); },
    restoreQrCode:  function (id) { return request('POST', 'api/qr-codes/' + encodeURIComponent(id) + '/restore', {}); },
    purgeQrCode:    function (id) { return request('DELETE', 'api/qr-codes/' + encodeURIComponent(id) + '/permanent'); },
    // Geschiedenis van de inhoud (vorige versies) en terugzetten
    codeHistory:    function (id)    { return request('GET', 'api/qr-codes/' + encodeURIComponent(id) + '/history'); },
    restoreVersion: function (id, n) { return request('POST', 'api/qr-codes/' + encodeURIComponent(id) + '/history/' + n + '/restore', {}); },
    duplicateQrCode: either(function (id, d) { return request('POST', 'api/qr-codes/' + encodeURIComponent(id) + '/duplicate', d || {}); }, local.duplicate),
    // Mappen in Mijn QR-codes
    folders: {
      list:   either(function ()      { return request('GET', 'api/folders'); }, local.folders.list),
      create: either(function (d)     { return request('POST', 'api/folders', d); }, local.folders.create),
      update: either(function (id, d) { return request('PATCH', 'api/folders/' + encodeURIComponent(id), d); }, local.folders.update),
      remove: either(function (id)    { return request('DELETE', 'api/folders/' + encodeURIComponent(id)); }, local.folders.remove),
      move:   either(function (d)     { return request('POST', 'api/folders/move', d); }, local.folders.move),
      order:  either(function (ids)   { return request('PUT', 'api/folders/order', { ids: ids }); }, local.folders.order)
    },
    // Statistieken: { from, to, codes: [], os: [], cc: [], city: [] }
    analytics: either(function (q) { return request('GET', 'api/analytics?' + query(q)); },
      function (q) { return demoCodes().then(function (codes) { return Object.assign(ANALYTICS.overview(codes, flat(q)), { demo: true, geo: true, names: codes.map(function (c) { return { id: c.id, typeId: c.typeId, name: c.name }; }) }); }); }),
    // Detailpagina: logboek per scan + plaatsen voor de kaart (alleen met server)
    analyticsScans: either(function (q) { return request('GET', 'api/analytics/scans?' + query(q)); }, function () { return Promise.resolve({ scans: [], points: [], total: 0, more: false }); }),
    // CSV: met server een link (downloadt zelf), zonder server de tekst
    analyticsCsv: either(function (q) { return Promise.resolve({ url: 'api/analytics.csv?' + query(q) }); },
      function (q) { return demoCodes().then(function (codes) { return { text: ANALYTICS.csv(codes, flat(q), function (c) { return c.name || c.id; }) }; }); }),
    // Accounts (alleen met server)
    // Online demo (geen server): het inlogscherm werkt ook, maar het "account" staat alleen in deze browser.
    auth: {
      me:       either(function ()  { return request('GET', 'api/auth/me'); }, demoAuth.me),
      login:    either(function (d) { return request('POST', 'api/auth/login', d); }, demoAuth.login),
      register: either(function (d) { return request('POST', 'api/auth/register', d); }, demoAuth.register),
      verify:   either(function (d) { return request('POST', 'api/auth/verify', d); }, demoAuth.verify),
      resend:   either(function (d) { return request('POST', 'api/auth/resend', d); }, function () { return Promise.resolve({ ok: true }); }),
      pending:  either(function () { return request('POST', 'api/auth/pending', {}); }, function () { return Promise.resolve({ state: 'none' }); }),
      demoToken: function (email) { return 'demo:' + String(email || '').trim().toLowerCase(); },
      logout:   either(function ()  { return request('POST', 'api/auth/logout', {}); }, demoAuth.logout),
      forgot:   either(function (d) { return request('POST', 'api/auth/forgot', d); }, function () { return Promise.resolve({ ok: true }); }),
      reset:    function (d) { return request('POST', 'api/auth/reset', d); },
      google2fa: function (d) { return request('POST', 'api/auth/google/2fa', d); },
      emailChange: function (d) { return request('POST', 'api/auth/email-change', d); }
    },
    // Team (Pro en Business): collega's in hetzelfde account (alleen met server)
    team: {
      get:      function ()      { return request('GET', 'api/team'); },
      log:      function ()      { return request('GET', 'api/team/log'); },
      invite:   function (d)     { return request('POST', 'api/team', d); },
      role:     function (id, r) { return request('PATCH', 'api/team/' + encodeURIComponent(id), { role: r }); },
      reinvite: function (id, d) { return request('POST', 'api/team/' + encodeURIComponent(id) + '/invite', d || {}); },
      remove:   function (id)    { return request('DELETE', 'api/team/' + encodeURIComponent(id)); }
    },
    // Mijn account. Zonder server (online demo): alles in deze browser, zelfde antwoorden.
    // Huisstijl-sjablonen (stap Ontwerp)
    templates: {
      list:   function ()      { return api.isDemo && api.isDemo() ? Promise.resolve({ templates: [] }) : request('GET', 'api/account/templates'); },
      add:    function (d)     { return request('POST', 'api/account/templates', d); },
      patch:  function (id, d) { return request('PATCH', 'api/account/templates/' + encodeURIComponent(id), d); },
      remove: function (id)    { return request('DELETE', 'api/account/templates/' + encodeURIComponent(id)); },
    },
    account: {
      prefs:     function ()  { return api.isDemo && api.isDemo() ? Promise.resolve({ start: 'home', tour: true }) : request('GET', 'api/account/prefs'); },
      savePrefs: function (d) { return request('PATCH', 'api/account/prefs', d); },
      update:   either(function (d) { return request('PATCH', 'api/account', d); }, demoAuth.account.update),
      password: either(function (d) { return request('POST', 'api/account/password', d); }, demoAuth.account.password),
      remove:   either(function (d) { return request('DELETE', 'api/account', d); }, demoAuth.account.remove),
      summary:  either(function ()  { return request('GET', 'api/account/summary'); }, demoAuth.account.summary),
      // Tweestapsverificatie (alleen met server)
      twoFactor:        function ()  { return request('GET', 'api/account/2fa'); },
      twoFactorSetup:   function ()  { return request('POST', 'api/account/2fa/setup', {}); },
      twoFactorEnable:  function (d) { return request('POST', 'api/account/2fa/enable', d); },
      twoFactorDisable: function (d) { return request('POST', 'api/account/2fa/disable', d); },
      // Abonnement (demo: altijd de testfase)
      apiKeys: function () { return request('GET', 'api/account/api-keys'); },
      apiKeyNew: function (d) { return request('POST', 'api/account/api-keys', d); },
      hooks:     function ()      { return request('GET', 'api/account/webhooks'); },
      hookNew:   function (d)     { return request('POST', 'api/account/webhooks', d); },
      hookEdit:  function (id, d) { return request('PATCH', 'api/account/webhooks/' + encodeURIComponent(id), d); },
      hookDel:   function (id)    { return request('DELETE', 'api/account/webhooks/' + encodeURIComponent(id)); },
      hookTest:  function (id)    { return request('POST', 'api/account/webhooks/' + encodeURIComponent(id) + '/test', {}); },
      apiKeyDel: function (id) { return request('DELETE', 'api/account/api-keys/' + encodeURIComponent(id)); },
      invoices: function () { return request('GET', 'api/account/invoices'); },
      checkoutDemo: function (d) { return request('POST', 'api/account/checkout-demo', d); },
      terms: function () { return request('GET', 'api/account/terms'); },
      domain: function () { return request('GET', 'api/account/domain'); },
      domainAdd: function (d) { return request('POST', 'api/account/domain', d); },
      domainCheck: function () { return request('POST', 'api/account/domain/check', {}); },
      domainRemove: function () { return request('DELETE', 'api/account/domain'); },
      stripeCheckout: function (d) { return request('POST', 'api/billing/checkout', d); },
      cancelSub: function (d) { return request('POST', 'api/billing/cancel', d || {}); },
      resumeSub: function () { return request('POST', 'api/billing/resume', {}); },
      payMethod: function () { return request('GET', 'api/billing/method'); },
      newPayMethod: function () { return request('POST', 'api/billing/method', {}); },
      payMethodDone: function (session) { return request('POST', 'api/billing/method/done', { session: session }); },
      stripePortal: function () { return request('POST', 'api/billing/portal'); },
      extraDemo: function (d) { return request('POST', 'api/account/extra-demo', d || { n: 1 }); },
      stripeExtra: function (d) { return request('POST', 'api/billing/extra', d || { n: 1 }); },
      acceptTerms: function () { return request('POST', 'api/account/terms', { accept: true }); },
      plan:     either(function ()  { return request('GET', 'api/account/plan'); }, function () { return Promise.resolve({ plan: { id: 'free', codes: null, statsDays: null }, usage: { used: 0, limit: null, state: 'ok' }, plans: [], payments: false }); }),
      logoutOthers: either(function () { return request('POST', 'api/account/logout-others', {}); }, demoAuth.account.logoutOthers),
      billing:  either(function ()  { return request('GET', 'api/account/billing'); }, demoAuth.account.billing),
      saveBilling: either(function (b) { return request('PUT', 'api/account/billing', b); }, demoAuth.account.saveBilling),
      // Gegevens downloaden: met server de echte export, zonder server wat in deze browser staat
      exportData: either(function () { return request('GET', 'api/account/export'); }, demoAuth.account.exportData),
      // Beveiliging en e-mail wijzigen: alleen met server (de demo heeft één apparaat en geen e-mail)
      sessions: either(function () { return request('GET', 'api/account/sessions'); }, function () { return Promise.resolve({ sessions: [], demo: true }); }),
      endSession: function (id) { return request('DELETE', 'api/account/sessions/' + encodeURIComponent(id)); },
      activity: either(function () { return request('GET', 'api/account/activity'); }, function () { return Promise.resolve({ activity: [], demo: true }); }),
      changeEmail: either(function (d) { return request('POST', 'api/account/email', d); }, function () { var e = new Error('demo'); e.code = 'demo'; return Promise.reject(e); })
    },
    // Vertalingen beheren + DeepL (alleen het team, alleen met server)
    translations: {
      all:       function ()        { return request('GET', 'api/admin/translations'); },
      save:      function (lang, d) { return request('PUT', 'api/admin/translations/' + encodeURIComponent(lang), d); },
      translate: function (d)       { return request('POST', 'api/admin/translations/translate', d); },
      setKey:    function (d)       { return request('PUT', 'api/admin/deepl', d); },
      removeKey: function ()        { return request('DELETE', 'api/admin/deepl'); }
    },
    // Beheer > Instellingen: bedrijfsgegevens en onderhoudsmodus
    settings: {
      get:  function ()  { return request('GET', 'api/admin/settings'); },
      save: function (d) { return request('PATCH', 'api/admin/settings', d).then(function (r) { info.maintenance = { on: !!(r.maintenance && r.maintenance.on), message: (r.maintenance && r.maintenance.message) || '' }; info.legal = Object.assign({}, info.legal, r.company || {}); document.dispatchEvent(new CustomEvent('maintenance-change')); return r; }); }
    },
    // Storingen en meldingen (Beheer > Instellingen > Onderhoud); openbaar: /status
    adminTickets: {
      list:   function ()       { return request('GET', 'api/admin/tickets'); },
      reply:  function (id, tx) { return request('POST', 'api/admin/tickets/' + encodeURIComponent(id) + '/reply', { text: tx }); },
      status: function (id, s)  { return request('PATCH', 'api/admin/tickets/' + encodeURIComponent(id), { status: s }); }
    },
    incidents: {
      list:   function ()      { return request('GET', 'api/admin/incidents'); },
      add:    function (d)     { return request('POST', 'api/admin/incidents', d); },
      edit:   function (id, d) { return request('PATCH', 'api/admin/incidents/' + encodeURIComponent(id), d); },
      remove: function (id)    { return request('DELETE', 'api/admin/incidents/' + encodeURIComponent(id)); },
    },
    // Klanten (alleen voor het team, alleen met server)
    customers: {
      list:     function ()       { return request('GET', 'api/admin/customers'); },
      add:      function (d)      { return request('POST', 'api/admin/customers', d); },
      reinvite: function (id, d)  { return request('POST', 'api/admin/customers/' + encodeURIComponent(id) + '/invite', d || {}); },
      remove:   function (id)     { return request('DELETE', 'api/admin/customers/' + encodeURIComponent(id)); },
      update:   function (id, d)  { return request('PATCH', 'api/admin/customers/' + encodeURIComponent(id), d); },   // { role } of { disabled }
      sub:      function (id, d)  { return request('POST', 'api/admin/customers/' + encodeURIComponent(id) + '/subscription', d); }   // { action: 'paid', interval } | { action: 'set', periodEnd, interval }
    },
    // Contactformulier. In de demo wordt er niets verstuurd (dat zegt de pagina er ook bij).
    tickets: {
      mine:  function ()       { return request('GET', 'api/tickets'); },
      reply: function (id, tx) { return request('POST', 'api/tickets/' + encodeURIComponent(id) + '/reply', { text: tx }); },
      close: function (id)     { return request('POST', 'api/tickets/' + encodeURIComponent(id) + '/close', {}); }
    },
    contact: either(function (d) { return request('POST', 'api/contact', d); }, function () { return Promise.resolve({ ok: true, demo: true }); }),
    // Video uploaden (groot bestand): rechtstreeks naar de server, met voortgang (0-100). Demo: blijft in deze browser.
    uploadVideo: function (file, onProgress) {
      return available().then(function (on) {
        if (!on) return { n: file.name.slice(0, 120), s: file.size, local: true };
        return new Promise(function (resolve, reject) {
          var x = new XMLHttpRequest();
          x.open('POST', 'api/uploads/video?name=' + encodeURIComponent(file.name.slice(0, 120)));
          x.setRequestHeader('Content-Type', /^video\/(mp4|quicktime|webm|x-m4v)$/.test(file.type) ? file.type : (/\.mov$/i.test(file.name) ? 'video/quicktime' : /\.webm$/i.test(file.name) ? 'video/webm' : 'video/mp4'));
          x.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100)); };
          x.onload = function () {
            var data = {}; try { data = JSON.parse(x.responseText); } catch (e) {}
            if (x.status >= 200 && x.status < 300) return resolve(data);
            var err = new Error(data.error || 'HTTP ' + x.status); err.status = x.status; err.code = data.error; err.maxMb = data.maxMb; reject(err);
          };
          x.onerror = function () { reject(new Error('network')); };
          x.send(file);
        });
      });
    },
    // Eén foto voor een galerij (al verkleind). Zonder server (demo): null, dan bewaart de galerij een kleine data-URL.
    uploadImage: function (blob, name) {
      return available().then(function (on) {
        if (!on) return null;
        return fetch('api/uploads/image?name=' + encodeURIComponent(String(name || 'foto.jpg').slice(0, 120)), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || 'HTTP ' + r.status); e.status = r.status; throw e; } return d; }); });
      });
    },
    // Beheer (alleen team): dashboard en alle QR-codes
    admin: {
      overview:   function ()      { return request('GET', 'api/admin/overview'); },
      system:     function ()      { return request('GET', 'api/admin/system'); },
      blocklist:  function ()      { return request('GET', 'api/admin/blocklist'); },
      testMail:   function ()      { return request('POST', 'api/admin/test-mail', {}); },
      block:      function (d)     { return request('POST', 'api/admin/blocklist', d); },          // { value: 'jan@x.nl' | '@x.nl', note }
      unblock:    function (v)     { return request('DELETE', 'api/admin/blocklist?v=' + encodeURIComponent(v)); },
      codes:      function (f)     { var q = Object.keys(f || {}).filter(function (k) { return f[k] !== '' && f[k] != null; }).map(function (k) { return k + '=' + encodeURIComponent(f[k]); }).join('&'); return request('GET', 'api/admin/codes' + (q ? '?' + q : '')); },
      code:       function (id, q) { return request('GET', 'api/admin/codes/' + encodeURIComponent(id) + (q ? '?' + q : '')); },
      patchCode:  function (id, d) { return request('PATCH', 'api/admin/codes/' + encodeURIComponent(id), d); },   // { paused, reason, lock } | { flag, reason } | { name, content }
      transferCode: function (id, email) { return request('POST', 'api/admin/codes/' + encodeURIComponent(id) + '/transfer', { email: email }); },
      duplicateCode: function (id) { return request('POST', 'api/admin/codes/' + encodeURIComponent(id) + '/duplicate', {}); },
      checkCode:  function (id)    { return request('GET', 'api/admin/codes/' + encodeURIComponent(id) + '/check'); },
      removeCode: function (id)    { return request('DELETE', 'api/admin/codes/' + encodeURIComponent(id)); },
      bulk:       function (d)     { return request('POST', 'api/admin/codes/bulk', d); },                         // { ids, action, reason, lock }
      log:        function (code)  { return request('GET', 'api/admin/log' + (code ? '?code=' + encodeURIComponent(code) : '')); },
      // CSV als bestand (Blob)
      exportCodes: function (d)    {
        return fetch('api/admin/codes/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d || {}) })
          .then(function (res) { if (!res.ok) { var e = new Error('HTTP ' + res.status); e.status = res.status; throw e; } return res.blob(); });
      }
    },
    urlInfo:      function (url)   { return request('GET', 'api/url-info?url=' + encodeURIComponent(url)); },
    getMe:        function ()      { return request('GET', 'api/me'); },
    updateMe:     function (patch) { return request('PATCH', 'api/me', patch); }
  };
})();
