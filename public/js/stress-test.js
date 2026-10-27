/* =========================================================
   STRESSTEST (tijdelijk): laat zien hoe de app eruitziet bij massaal gebruik.
   - Alleen voor admins zichtbaar: knop linksonder.
   - Aan = ?stress=<aantal> in de adresbalk. De echte antwoorden van de server worden in DEZE browser
     opgeblazen (duizenden codes en gebruikers, miljoenen scans). Er komt niets in de database.
   - Zolang hij aan staat, wordt er niets opgeslagen: elke wijziging wordt geweigerd.
   Weghalen na de test: dit bestand + de <script>-regel in index.html + het CSS-blok "Stresstest" in app.css.
   ========================================================= */
(function () {
  var N = 0;
  try { N = Math.min(1000000, Math.max(0, parseInt(new URLSearchParams(location.search).get('stress'), 10) || 0)); } catch (e) { N = 0; }
  var SIZES = [1000, 10000, 100000];

  /* ---------- Knop + balk ---------- */
  function setMode(n) {
    var u = new URL(location.href);
    if (n) u.searchParams.set('stress', String(n)); else u.searchParams.delete('stress');
    location.replace(u.toString());
  }
  function isAdmin() { try { return !!(window.Session && Session.user && (Session.user() || {}).admin); } catch (e) { return false; } }
  function draw() {
    var box = document.getElementById('stressBox');
    if (!N && !isAdmin()) { if (box) box.remove(); return; }
    if (box) return;
    box = document.createElement('div'); box.id = 'stressBox'; box.className = 'stress-box' + (N ? ' is-on' : '');
    box.innerHTML = (N ? '<div class="stress-bar">Stresstest: nepdata (' + N.toLocaleString('nl-NL') + ' items per lijst, miljoenen scans). Er wordt niets opgeslagen.</div>' : '') +
      '<button type="button" class="stress-btn" aria-expanded="false">' + (N ? 'Stresstest aan' : 'Stresstest') + '</button>' +
      '<div class="stress-menu" hidden>' + SIZES.map(function (s) { return '<button type="button" data-n="' + s + '"' + (s === N ? ' class="on"' : '') + '>' + s.toLocaleString('nl-NL') + ' items</button>'; }).join('') +
      (N ? '<button type="button" data-n="0">Uitzetten</button>' : '') + '</div>';
    document.body.appendChild(box);
    var btn = box.querySelector('.stress-btn'), menu = box.querySelector('.stress-menu');
    btn.addEventListener('click', function () { menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
    menu.addEventListener('click', function (e) { var b = e.target.closest('[data-n]'); if (b) setMode(+b.getAttribute('data-n')); });
  }
  document.addEventListener('pagechange', function () { setTimeout(draw, 0); });
  document.addEventListener('DOMContentLoaded', function () { setTimeout(draw, 0); });

  if (!N) return;                                   // uit: de app werkt precies zoals altijd

  /* ---------- Nepdata ---------- */
  var seed = 12345;
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
  function big(max) { return Math.floor(Math.pow(rnd(), 3) * max); }   // weinig heel groot, veel klein (zoals echt)
  var F = Math.max(50, Math.round(N / 8));          // vermenigvuldiger voor de scans
  var WORDS = ['Menu', 'Flyer', 'Poster', 'Event', 'Wifi', 'Coupon', 'Vcard', 'Shop', 'Sale', 'Tafel', 'Raam', 'Folder', 'Visitekaart', 'Beurs', 'Actie'];
  var CC = ['ES', 'NL', 'BE', 'DE', 'FR', 'GB', 'IT', 'PT', 'US', 'CA', 'MX', 'BR', 'AR', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'AT', 'CH', 'IE', 'GR', 'TR', 'MA', 'ZA', 'IN', 'JP', 'KR', 'CN', 'AU', 'NZ', 'AE', 'SA', 'EG', 'NG', 'KE', 'CO', 'CL', 'PE', 'RO', 'HU', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU'];
  var real = { codes: null, folders: [] }, fake = null, byId = {};
  function fid(i) { return 'st' + i.toString(36); }
  function codes() {
    if (fake) return fake;
    var base = real.codes && real.codes.length ? real.codes : [{ typeId: 'website', contentType: 'url', content: { url: 'https://example.com' }, design: { color: '#111827', background: '#ffffff' }, shortUrl: location.origin + '/x', dest: { kind: 'url', value: 'https://example.com' }, labels: [] }];
    var folders = real.folders.concat(fakeFolders()), now = Date.now();
    fake = [];
    for (var i = 0; i < N; i++) {
      var b = base[i % base.length], id = fid(i);
      var c = Object.assign({}, b, { id: id, _base: b.id || null, name: WORDS[i % WORDS.length] + ' ' + (i + 1), scans: big(2500000), paused: rnd() < 0.03, favorite: rnd() < 0.02,
        createdAt: new Date(now - big(3 * 365) * 864e5).toISOString(), lastScanAt: new Date(now - big(30) * 864e5).toISOString(),
        folderId: rnd() < 0.6 && folders.length ? folders[Math.floor(rnd() * folders.length)].id : null, labels: [] });
      fake.push(c); byId[id] = c;
    }
    return fake;
  }
  var ff = null;
  function fakeFolders() { if (!ff) { ff = []; for (var i = 0; i < 60; i++) ff.push({ id: 'stf' + i, name: 'Testmap ' + (i + 1), color: ['cyan', 'green', 'amber', 'pink', 'violet'][i % 5], createdAt: new Date().toISOString() }); } return ff; }
  function total() { return codes().reduce(function (s, c) { return s + c.scans; }, 0); }

  function scaleRows(arr, keys) { (arr || []).forEach(function (r) { keys.forEach(function (k) { if (typeof r[k] === 'number') r[k] = r[k] * F + big(F); }); }); }
  function analytics(j) {
    if (!j || !j.totals) return j;
    j.totals.scans = j.totals.scans * F + big(F); j.totals.unique = Math.round(j.totals.scans * 0.74); j.totals.codes = Math.max(j.totals.codes, N);
    scaleRows(j.series, ['s', 'u']);
    ['os', 'countries', 'cities', 'browsers', 'devices'].forEach(function (k) { scaleRows(j[k], ['s']); });
    var have = {}; (j.countries || []).forEach(function (r) { have[r.k] = 1; });
    CC.forEach(function (cc, i) { if (!have[cc]) { j.countries.push({ k: cc, s: Math.round(j.totals.scans / (40 + i * 6)) }); if (j.options && j.options.countries) j.options.countries.push(cc); } });
    j.countries.sort(function (a, b) { return b.s - a.s; });
    if (j.insights) {
      j.insights.weekdays = (j.insights.weekdays || []).map(function (v) { return v * F; });
      j.insights.hours = (j.insights.hours || []).map(function (v) { return v * F; });
      j.insights.prevScans = Math.round(j.totals.scans * 0.8); j.insights.prevUnique = Math.round(j.totals.unique * 0.8);
      if (j.insights.bestDay) j.insights.bestDay.s *= F;
      j.insights.activeCodes = Math.max(j.insights.activeCodes || 0, N);
    }
    if (!j.insights || !j.insights.filtered) {
      j.codes = codes().slice(0, 500).map(function (c) { return { k: c.id, s: c.scans, p: 0 }; }).sort(function (a, b) { return b.s - a.s; });
      j.names = codes().map(function (c) { return { id: c.id, typeId: c.typeId, name: c.name }; });
    } else scaleRows(j.codes, ['s']);
    return j;
  }
  function fakeUser(b, i) {
    return Object.assign({}, b, { id: 'stu' + i, email: 'gebruiker' + (i + 1) + '@test.example', name: 'Testgebruiker ' + (i + 1), codes: big(400), scans: big(900000), role: null, level: 'user', fixed: false, team: false,
      plan: ['free', 'pro', 'business'][Math.floor(rnd() * 3)], createdAt: new Date(Date.now() - big(900) * 864e5).toISOString(), lastLoginAt: new Date(Date.now() - big(60) * 864e5).toISOString() });
  }
  var BIG_USERS = 1240000, BIG_CODES = 3800000;

  function transform(path, q, j) {
    if (path === 'qr-codes') { real.codes = Array.isArray(j) ? j : (j && j.items) || []; fake = null; return codes(); }
    if (path === 'folders') { real.folders = (j && j.folders) || []; return { folders: real.folders.concat(fakeFolders()) }; }
    if (path === 'analytics') return analytics(j);
    if (path === 'account/summary') return Object.assign({}, j, { codes: N, scans: total(), scans30: Math.round(total() / 9) });
    if (path === 'admin/overview' && j && j.totals) {
      var t = j.totals; t.users = BIG_USERS; t.active = Math.round(BIG_USERS * 0.82); t.codes = BIG_CODES; t.scans = BIG_CODES * 140; t.scans30 = Math.round(t.scans / 14); t.scansPrev30 = Math.round(t.scans30 * 0.9); t.newUsers30 = 48000; t.newCodes30 = 210000;
      scaleRows(j.days, ['scans', 'uniq']); (j.types || []).forEach(function (r) { r.n = r.n * 90000 + big(9000); });
      if (j.plans) Object.keys(j.plans).forEach(function (k) { j.plans[k] = j.plans[k] * 300000 + big(30000); });
      if (j.recentUsers && j.recentUsers[0]) for (var i = j.recentUsers.length; i < 10; i++) j.recentUsers.push(fakeUser(j.recentUsers[0], i));
      return j;
    }
    if (path === 'admin/customers' && Array.isArray(j) && j.length) { var out = j.slice(); for (var u = out.length; u < N; u++) out.push(fakeUser(j[u % j.length], u)); return out; }
    if (path === 'admin/codes' && j && j.items) {
      var size = j.pageSize || 25, page = Math.max(1, parseInt(q.get('page'), 10) || 1), list = codes();
      j.total = BIG_CODES; j.all = BIG_CODES; j.page = page; j.pages = Math.ceil(BIG_CODES / size);
      var owner = (j.items[0] || {}).owner || { id: 'x', name: 'Test', email: 'test@test.example', level: 'user', codes: 1 };
      j.items = []; for (var k = 0; k < size; k++) { var c = list[((page - 1) * size + k) % list.length]; j.items.push(Object.assign({}, c, { userId: 'stu' + k, displayName: c.name, owner: Object.assign({}, owner, { id: 'stu' + k, name: 'Testgebruiker ' + (k + 1), email: 'gebruiker' + (k + 1) + '@test.example' }), kind: 'dynamic', uniq: Math.round(c.scans * 0.7), problem: null, risks: [], pattern: [] })); }
      for (var o = (j.owners || []).length; o < 200; o++) j.owners.push({ id: 'stu' + o, name: 'Testgebruiker ' + (o + 1), email: 'gebruiker' + (o + 1) + '@test.example', codes: big(400) });
      return j;
    }
    return j;
  }

  /* ---------- fetch omleiden ---------- */
  var orig = window.fetch.bind(window);
  function json(data, status) { return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } }); }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '', method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var u; try { u = new URL(url, location.href); } catch (e) { return orig(input, init); }
    var m = u.origin === location.origin && u.pathname.match(/\/api\/(.+)$/); if (!m) return orig(input, init);
    var path = m[1];
    if (method !== 'GET' && method !== 'HEAD') {
      if (/^auth\/(logout|login|me)/.test(path)) return orig(input, init);
      return Promise.resolve(json({ error: 'stress_test', message: 'Stresstest staat aan: er wordt niets opgeslagen.' }, 423));
    }
    var one = path.match(/^qr-codes\/(st[0-9a-z]+)$/);
    if (one) { codes(); return Promise.resolve(byId[one[1]] ? json(byId[one[1]]) : json({ error: 'QR code not found' }, 404)); }
    ['codes', 'code'].forEach(function (k) {         // nepcode in een filter: vraag de server naar de echte code waar hij van gemaakt is
      var cs = u.searchParams.get(k); if (!cs) return;
      codes(); u.searchParams.set(k, cs.split(',').map(function (x) { var c = byId[x]; return c ? c._base || '' : x; }).filter(Boolean).join(','));
    });
    if (path === 'qr-codes/health') return Promise.resolve(json({}));
    var need = path === 'qr-codes' ? null : (path === 'analytics' && !real.codes ? orig('api/qr-codes').then(function (r) { return r.ok ? r.json() : []; }).then(function (x) { real.codes = Array.isArray(x) ? x : []; }) : null);
    return Promise.resolve(need).then(function () { return orig(u.toString(), init); }).then(function (res) {
      if (!res.ok) return res;
      return res.clone().json().then(function (j) { return json(transform(path, u.searchParams, j), res.status); }).catch(function () { return res; });
    });
  };
})();
