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
            var err = new Error(data.error || ('HTTP ' + res.status)); err.status = res.status; err.code = data.error; err.details = data.details;
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
    var KEY = 'optimasys-demo-codes', memory = null;
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
    function notFound() { var e = new Error('QR code not found'); e.status = 404; return Promise.reject(e); }
    function clean(content) { var c = {}; Object.keys(content || {}).forEach(function (k) { var v = content[k]; if (v != null && String(v).trim() !== '') c[k] = String(v).trim(); }); return c; }
    return {
      list: function () { return Promise.resolve(read().slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).map(out)); },
      get: function (id) { var q = find(id); return q ? Promise.resolve(out(q)) : notFound(); },
      create: function (d) {
        var tp = getType(d.typeId);
        var q = { id: d.id || newDraftId(), createdAt: new Date().toISOString(), scans: 0, lastScanAt: null, typeId: d.typeId, contentType: tp.contentType, content: clean(d.content), design: d.design || {} };
        if (d.name) q.name = String(d.name).slice(0, 60);
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
        write(); return Promise.resolve(out(q));
      },
      remove: function (id) { memory = read().filter(function (q) { return q.id !== id; }); write(); return Promise.resolve(null); }
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
        if (String(d.password || '').length < 8) return fail('password_short', 400);
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
      logout: function () { try { localStorage.removeItem(KEY); } catch (e) {} return Promise.resolve(null); }
    };
  })();
  function either(server, demo) { return function () { var a = arguments; return available().then(function (on) { return on ? server.apply(null, a) : demo.apply(null, a); }); }; }

  return {
    available: available,
    info: function () { return info; },
    isDemo: function () { return online === false; },
    listQrCodes:  either(function () { return request('GET', 'api/qr-codes'); }, local.list),
    getQrCode:    either(function (id) { return request('GET', 'api/qr-codes/' + encodeURIComponent(id)); }, local.get),
    createQrCode: either(function (data) { return request('POST', 'api/qr-codes', data); }, local.create),
    updateQrCode: either(function (id, data) { return request('PUT', 'api/qr-codes/' + encodeURIComponent(id), data); }, local.update),
    patchQrCode:  either(function (id, patch) { return request('PATCH', 'api/qr-codes/' + encodeURIComponent(id), patch); }, local.patch),
    deleteQrCode: either(function (id) { return request('DELETE', 'api/qr-codes/' + encodeURIComponent(id)); }, local.remove),
    // Statistieken: { from, to, codes: [], os: [], cc: [], city: [] }
    analytics: either(function (q) { return request('GET', 'api/analytics?' + query(q)); },
      function (q) { return demoCodes().then(function (codes) { return Object.assign(ANALYTICS.overview(codes, flat(q)), { demo: true, geo: true, names: codes.map(function (c) { return { id: c.id, typeId: c.typeId, name: c.name }; }) }); }); }),
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
      demoToken: function (email) { return 'demo:' + String(email || '').trim().toLowerCase(); },
      logout:   either(function ()  { return request('POST', 'api/auth/logout', {}); }, demoAuth.logout),
      forgot:   either(function (d) { return request('POST', 'api/auth/forgot', d); }, function () { return Promise.resolve({ ok: true }); }),
      reset:    function (d) { return request('POST', 'api/auth/reset', d); }
    },
    account: {
      update:   function (d) { return request('PATCH', 'api/account', d); },
      password: function (d) { return request('POST', 'api/account/password', d); },
      remove:   function (d) { return request('DELETE', 'api/account', d); },
      summary:  function ()  { return request('GET', 'api/account/summary'); },
      logoutOthers: function () { return request('POST', 'api/account/logout-others', {}); },
      exportUrl: 'api/account/export'
    },
    urlInfo:      function (url)   { return request('GET', 'api/url-info?url=' + encodeURIComponent(url)); },
    getMe:        function ()      { return request('GET', 'api/me'); },
    updateMe:     function (patch) { return request('PATCH', 'api/me', patch); }
  };
})();
