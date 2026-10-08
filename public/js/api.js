/* =========================================================
   API: het enige bestand dat met de backend praat.
   Zonder server (zoals in de online demo) valt de app terug op demo-modus.
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
  return {
    // Is er een backend? Eén keer controleren en onthouden.
    available: function () {
      if (online !== null) return Promise.resolve(online);
      return fetch('api/health').then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { online = !!(d && d.ok); return online; })
        .catch(function () { online = false; return online; });
    },
    listQrCodes:  function ()      { return request('GET', 'api/qr-codes'); },
    createQrCode: function (data)  { return request('POST', 'api/qr-codes', data); },
    deleteQrCode: function (id)    { return request('DELETE', 'api/qr-codes/' + encodeURIComponent(id)); },
    urlInfo:      function (url)   { return request('GET', 'api/url-info?url=' + encodeURIComponent(url)); },
    getMe:        function ()      { return request('GET', 'api/me'); },
    updateMe:     function (patch) { return request('PATCH', 'api/me', patch); }
  };
})();
