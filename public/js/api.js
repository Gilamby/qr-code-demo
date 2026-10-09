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
          if (!res.ok) { var err = new Error(data.error || ('HTTP ' + res.status)); err.status = res.status; err.details = data.details; throw err; }
          return data;
        });
      });
  }
  function available() {
    if (online !== null) return Promise.resolve(online);
    return fetch('api/health').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { online = !!(d && d.ok); return online; })
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
  // Kies per aanroep: server als die er is, anders de demo-opslag
  function either(server, demo) { return function () { var a = arguments; return available().then(function (on) { return on ? server.apply(null, a) : demo.apply(null, a); }); }; }

  return {
    available: available,
    isDemo: function () { return online === false; },
    listQrCodes:  either(function () { return request('GET', 'api/qr-codes'); }, local.list),
    getQrCode:    either(function (id) { return request('GET', 'api/qr-codes/' + encodeURIComponent(id)); }, local.get),
    createQrCode: either(function (data) { return request('POST', 'api/qr-codes', data); }, local.create),
    updateQrCode: either(function (id, data) { return request('PUT', 'api/qr-codes/' + encodeURIComponent(id), data); }, local.update),
    patchQrCode:  either(function (id, patch) { return request('PATCH', 'api/qr-codes/' + encodeURIComponent(id), patch); }, local.patch),
    deleteQrCode: either(function (id) { return request('DELETE', 'api/qr-codes/' + encodeURIComponent(id)); }, local.remove),
    urlInfo:      function (url)   { return request('GET', 'api/url-info?url=' + encodeURIComponent(url)); },
    getMe:        function ()      { return request('GET', 'api/me'); },
    updateMe:     function (patch) { return request('PATCH', 'api/me', patch); }
  };
})();
