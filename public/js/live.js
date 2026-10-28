/* =========================================================
   ECHTE PAGINA: tekent het type met hetzelfde sjabloon als de telefoon in de tool
   en maakt alles werkend (bellen, mailen, route, downloaden, afspelen, kopiëren).
   ========================================================= */
(function () {
  var L = window.LIVE, type = getType(L.typeId), root = document.getElementById('live'), c = {};
  type.fields.forEach(function (f) { c[f.key] = L.content[f.key] != null ? String(L.content[f.key]) : ''; });

  function href(v) { v = String(v || '').trim(); return !v ? '' : /^(https?:|mailto:|tel:)/i.test(v) ? v : /^[^\s]+\.[a-z]{2,}(\/|$)/i.test(v) ? 'https://' + v : ''; }
  // Google Analytics (KB Q222): UTM-labels aan uitgaande links, als dat bij deze code aanstaat
  function utm(url) {
    if (!c.utm || !/^https?:/i.test(url)) return url;
    try {
      var u = new URL(url), camp = String(c.title || c.appName || c.name || L.name || 'qr').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'qr';
      if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'qr');
      if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'qr_code');
      if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', camp);
      return u.href;
    } catch (e) { return url; }
  }
  function go(el, url, download) {
    if (!el || !url) return;
    if (!download) url = utm(url);
    el.setAttribute('data-go', '');
    el.addEventListener('click', function (e) {
      e.preventDefault();
      if (download) { var a = document.createElement('a'); a.href = url; a.download = download; document.body.appendChild(a); a.click(); a.remove(); }
      else if (/^(tel|mailto):/.test(url)) location.href = url; else window.open(url, '_blank', 'noopener');
    });
  }
  function toast(msg) { var x = document.createElement('div'); x.className = 'toast'; x.textContent = msg; document.body.appendChild(x); setTimeout(function () { x.remove(); }, 1800); }
  function share() { if (navigator.share) navigator.share({ title: document.title, url: location.href }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { toast(t('live.linkCopied')); }); }
  function $(s) { return root.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(root.querySelectorAll(s)); }
  var tel = function (p) { return p ? 'tel:' + p.replace(/[^\d+]/g, '') : ''; };
  var mail = function (m) { return m ? 'mailto:' + m : ''; };

  // Lege velden: geen grijze balkjes zoals in de tool, maar gewoon weglaten
  function tidy() {
    $$('.sk').forEach(function (sk) {
      var row = sk.closest('.ev-row, .ev-desc, .vc-row, .gm-row, .gm-desc, .lk2-list > .lk2-row, .pd-file, .mn-row, .wl-f, .vc-acts > span, .sx-card, .ap-badge, .bz-row, p, small');
      if (row && !row.textContent.trim()) row.remove(); else sk.remove();
    });
    // Rijen met een label maar zonder waarde, en lege fotovakjes
    $$('.vc-row').forEach(function (r) { var b = r.querySelector('b'); if (b && !b.textContent.trim()) r.remove(); });
    $$('.gm-row').forEach(function (r) { var sp = r.querySelector('span'); if (sp && !sp.textContent.trim()) r.remove(); });
    $$('.gx-none').forEach(function (x) { x.remove(); });
  }

  /* Evenement: tijd in de tijdzone van de eigenaar (L.tz) omzetten naar UTC, voor de agenda */
  function zoned(date, time, tz) {
    var p = date.split('-').map(Number), h = time ? +time.slice(0, 2) : 0, m = time ? +time.slice(3, 5) : 0;
    var guess = Date.UTC(p[0], p[1] - 1, p[2], h, m);
    if (!tz) return new Date(guess);
    try {
      var o = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(new Date(guess)).forEach(function (x) { o[x.type] = x.value; });
      var asUtc = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute, +o.second);
      return new Date(guess - (asUtc - guess));
    } catch (e) { return new Date(guess); }
  }
  function eventTimes() {
    var day = function (d) { return d.replace(/-/g, ''); }, utc = function (d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    var next = function (d) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
    if (!c.startTime) return { allDay: true, start: day(c.startDate), end: day(next(c.endDate || c.startDate)) };   // hele dag(en)
    var s = zoned(c.startDate, c.startTime, L.tz), e = c.endTime ? zoned(c.endDate || c.startDate, c.endTime, L.tz) : new Date(s.getTime() + 2 * 3600e3);   // geen eindtijd: 2 uur
    if (e <= s) e = new Date(s.getTime() + 2 * 3600e3);
    return { allDay: false, start: utc(s), end: utc(e) };
  }
  function icsText(x) { return String(x || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }

  var WIRE = {
    text: function () {
      var b = $('.tx-copy'); if (!b) return; b.setAttribute('data-go', '');
      b.onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(c.text || '').then(function () { toast(t('pv.text.copied')); }); };
    },
    manual: function () {
      var o = FILES.parse(c.file), dl = $('.mn-dl'), vid = $('.mn-video'), call = $('.mn-call'), m = $('.mn-mail');
      if (dl) { if (o && o.url) go(dl, o.url, o.n); else dl.remove(); }
      if (vid) { if (href(c.video)) go(vid, href(c.video)); else vid.remove(); }
      if (call) { if (c.phone) go(call, tel(c.phone)); else call.remove(); }
      if (m) { if (c.email) go(m, mail(c.email) + '?subject=' + encodeURIComponent(c.title || '')); else m.remove(); }
    },
    lostfound: function () {
      var call = $('.lf-call'), m = $('.lf-mail');
      if (call) { if (c.phone) go(call, tel(c.phone)); else call.remove(); }
      if (m) { if (c.email) go(m, mail(c.email) + '?subject=' + encodeURIComponent(t('pv.lost.subject', { name: c.name || '' }))); else m.remove(); }
    },
    feedback: function () {
      var rating = 0, box = $('.ph-fb'); if (!box) return;
      $$('.fb-star').forEach(function (b) { b.classList.remove('on'); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
        b.onclick = function () { rating = +b.getAttribute('data-n'); $$('.fb-star').forEach(function (x) { var on = +x.getAttribute('data-n') <= rating; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(+x.getAttribute('data-n') === rating)); }); err(''); }; });
      function err(m) { var e = $('.fb-err'); if (!e) return; e.textContent = m; e.hidden = !m; }
      var send = $('.fb-send'); if (!send) return;
      send.onclick = function () {
        if (!rating) return err(t('pv.feedback.needStars'));
        var em = $('.fb-email'), ok = $('.fb-ok'), email = em ? em.value.trim() : '';
        if (email && !(ok && ok.checked)) return err(t('pv.feedback.needConsent'));
        send.disabled = true; err('');
        fetch('/api/feedback/' + encodeURIComponent(L.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: rating, comment: ($('.fb-text') || {}).value || '', email: email, consent: !!(ok && ok.checked) }) })
          .then(function (r) { if (!r.ok) throw r; $('.fb-form').hidden = true; $('.fb-done').hidden = false; var rv = $('.fb-review'); if (rv && rating >= 4) { rv.hidden = false; go(rv, href(c.reviewUrl)); } })
          .catch(function (r) { send.disabled = false; err(t(r && r.status === 429 ? 'pv.feedback.tooMany' : 'pv.feedback.failed')); });
      };
    },
    event: function () {
      if (!c.startDate) return;
      var tm = eventTimes(), a = ADDRESS.parse(c.address), place = a ? a.l : '', more = href(c.url), details = (c.description || '') + (more ? (c.description ? '\n\n' : '') + more : '');
      var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//QR-Codex//Event//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:' + L.id + '@qr-codex',
        'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
        tm.allDay ? 'DTSTART;VALUE=DATE:' + tm.start : 'DTSTART:' + tm.start, tm.allDay ? 'DTEND;VALUE=DATE:' + tm.end : 'DTEND:' + tm.end,
        'SUMMARY:' + icsText(c.title), place ? 'LOCATION:' + icsText(place) : '', details ? 'DESCRIPTION:' + icsText(details) : '', more ? 'URL:' + more : '',
        'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
      go($('.ev-add'), 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics), (c.title || 'event').replace(/[^\w ]+/g, '').trim().slice(0, 60) + '.ics');
      var g = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(c.title || '') + '&dates=' + tm.start + '/' + tm.end +
        (details ? '&details=' + encodeURIComponent(details) : '') + (place ? '&location=' + encodeURIComponent(place) : '') + (!tm.allDay && L.tz ? '&ctz=' + encodeURIComponent(L.tz) : '');
      go($('.ev-gcal'), g);
      go($('.ev-route'), a ? ADDRESS.mapUrl(a) : ''); go($('.ev-place'), a ? ADDRESS.mapUrl(a) : '');
      go($('.ev-more'), more);
      var sh = $('.gm-tb span:last-child'); if (sh) { sh.setAttribute('data-go', ''); sh.onclick = share; }
      var bk = $('.gm-tb span:first-child'); if (bk) bk.remove();
    },
    links: function () {
      $$('.lk2-row').forEach(function (el) { go(el, href(c[el.getAttribute('data-k')])); });
      var s = $('.lk2-share'); if (s) { s.setAttribute('data-go', ''); s.onclick = share; }
    },
    vcard: function () {
      var addr = c.address ? ADDRESS.mapUrl(ADDRESS.parse(c.address) || { l: c.address }) : '';
      var urls = [tel(c.phone), mail(c.email), href(c.website), addr];
      $$('.vc-acts > span').forEach(function (el, i) { go(el, urls[i]); if (!urls[i]) el.style.opacity = '.35'; });
      $$('.vc-row').forEach(function (el, i) { go(el, urls[i]); });
      var vcf = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + c.name, c.role ? 'TITLE:' + c.role : '', c.company ? 'ORG:' + c.company : '', c.phone ? 'TEL:' + c.phone : '', c.email ? 'EMAIL:' + c.email : '', c.website ? 'URL:' + c.website : '', c.address ? 'ADR:;;' + ADDRESS.text(c.address).replace(/([;,])/g, '\\$1') + ';;;;' : '', 'END:VCARD'].filter(Boolean).join('\r\n');
      go($('.vc-save'), 'data:text/vcard;charset=utf-8,' + encodeURIComponent(vcf), (c.name || 'contact').replace(/[^\w ]+/g, '') + '.vcf');
    },
    business: function () {
      var a = ADDRESS.parse(c.address), maps = a ? ADDRESS.mapUrl(a) : '';
      var acts = $$('.gm-acts > *'); [maps, tel(c.phone), href(c.website), ''].forEach(function (u, i) { if (acts[i] && u && acts[i].tagName !== 'A') go(acts[i], u); });
      if (acts[3]) acts[3].addEventListener('click', share);
      go($('.gm-map'), maps); if (!a) { var m = $('.gm-map'); if (m) m.remove(); }
      var rows = $$('.gm-row'); go(rows[0], maps); go(rows[2], tel(c.phone)); go(rows[3], mail(c.email)); go(rows[4], href(c.website));
      var sh = $('.gm-tb span:last-child'); if (sh) { sh.setAttribute('data-go', ''); sh.onclick = share; }
      var so = SOCIALS.parse(c.socials), nets = SOCIALS.LIST.filter(function (n) { return n.id in so; });
      $$('.gm-soc .br').forEach(function (el, i) { go(el, href(so[nets[i].id])); });
    },
    pdf: function () {
      var o = FILES.parse(c.file); if (!o || !o.url) { var d = $('.pv-dl'); if (d) d.remove(); return; }
      go($('.pv-dl'), o.url, o.n); go($('.pv-sheet'), o.url);
      var sh = $('.pv-bar > .i'); if (sh) { sh.setAttribute('data-go', ''); sh.addEventListener('click', share); }
    },
    images: function () {
      // Galerij: kolommen naar de schermbreedte (telefoon 2, tablet 3, computer 4), tik op een foto = grote weergave
      var list = FILES.photos(c.photos), grid = $('.gx-grid'); if (!grid || !list.length) return;
      root.classList.add('live-gallery');
      var items = $$('.gx-item').map(function (el) { var p = list[+el.getAttribute('data-i')] || {}; return { el: el, r: p.w && p.h ? p.h / p.w : 1 }; });
      var cols = 0;
      function layout() {
        var w = grid.clientWidth, n = w >= 900 ? 4 : w >= 600 ? 3 : 2; if (n === cols) return; cols = n;
        grid.innerHTML = GALLERY.columns(items.map(function (it, i) { return { r: it.r, html: '<i data-slot="' + i + '"></i>' }; }), n);
        grid.querySelectorAll('[data-slot]').forEach(function (slot) { slot.replaceWith(items[+slot.getAttribute('data-slot')].el); });
      }
      layout(); window.addEventListener('resize', layout);
      items.forEach(function (it) {
        var img = it.el.querySelector('img');
        img.addEventListener('error', function () { it.el.classList.add('gx-broken'); });   // foto kan niet laden: rustig grijs vlak
        it.el.addEventListener('click', function () { viewer(+it.el.getAttribute('data-i')); });
      });

      // Grote weergave: pijlen, teller, sluiten (×, Esc, tik naast de foto), vegen op de telefoon. Terug = zelfde plek in de galerij.
      function viewer(at) {
        var back = document.activeElement, IC = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
        var lb = document.createElement('div'); lb.className = 'lb2'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', c.title || t('live.photos'));
        lb.innerHTML = '<div class="lb2-stage"><img alt=""><p class="lb2-err" hidden>' + esc(t('live.photoFailed')) + '</p></div>' +
          '<span class="lb2-count" aria-live="polite"></span>' +
          '<button type="button" class="lb2-btn lb2-close" aria-label="' + esc(t('live.photoClose')) + '">' + IC('M6 6l12 12M18 6L6 18') + '</button>' +
          (list.length > 1 ? '<button type="button" class="lb2-btn lb2-prev" aria-label="' + esc(t('live.photoPrev')) + '">' + IC('M15 5l-7 7 7 7') + '</button>' +
            '<button type="button" class="lb2-btn lb2-next" aria-label="' + esc(t('live.photoNext')) + '">' + IC('M9 5l7 7-7 7') + '</button>' : '');
        var img = lb.querySelector('img'), err = lb.querySelector('.lb2-err'), count = lb.querySelector('.lb2-count'), prev = lb.querySelector('.lb2-prev'), next = lb.querySelector('.lb2-next');
        function show(i) {
          at = i; err.hidden = true; img.hidden = false; img.src = list[i].src;
          count.textContent = (i + 1) + ' / ' + list.length;
          if (prev) prev.disabled = i === 0;                       // begin en eind: niet rondgaan, de knop is dan uit
          if (next) next.disabled = i === list.length - 1;
          [i - 1, i + 1].forEach(function (k) { if (list[k]) new Image().src = list[k].src; });   // buren alvast laden
        }
        img.addEventListener('error', function () { img.hidden = true; err.hidden = false; });
        function go(d) { var k = at + d; if (k >= 0 && k < list.length) show(k); }
        function close() {
          document.removeEventListener('keydown', key); lb.remove(); document.documentElement.classList.remove('lb2-open');
          var tile = grid.querySelector('[data-i="' + at + '"]'); (tile || back || document.body).focus({ preventScroll: true });
        }
        function key(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); }
        lb.addEventListener('click', function (e) {
          if (e.target.closest('.lb2-close') || e.target === lb || e.target.classList.contains('lb2-stage')) return close();
          if (e.target.closest('.lb2-prev')) go(-1); if (e.target.closest('.lb2-next')) go(1);
        });
        var x0 = null;
        lb.addEventListener('touchstart', function (e) { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
        lb.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); });
        document.addEventListener('keydown', key);
        document.documentElement.classList.add('lb2-open'); document.body.appendChild(lb); show(at);
        lb.querySelector('.lb2-close').focus();
      }
    },
    social: function () {
      var so = SOCIALS.parse(c.socials), nets = SOCIALS.LIST.filter(function (n) { return n.id in so; });
      // Echte links: naam van het platform als tekst, de ingevulde URL als doel (werkt ook met toetsenbord en schermlezer)
      $$('.sx-card[data-net]').forEach(function (el) {
        var net = el.getAttribute('data-net'), url = href(so[net]); if (!url) return el.remove();
        var a = document.createElement('a'); a.className = el.className; a.href = url; a.target = '_blank'; a.rel = 'noopener';
        a.setAttribute('data-net', net); a.innerHTML = el.innerHTML; a.setAttribute('aria-label', (el.querySelector('b') || el).textContent); el.replaceWith(a);
      });
      $$('.sx-quick .br').forEach(function (el, i) { if (nets[i]) go(el, href(so[nets[i].id])); });
    },
    mp3: function () {
      var o = FILES.parse(c.file); if (!o || !o.url) return;
      var au = new Audio(o.url), play = $('.mp-play'), bar = $('.mp-bar i'), tm = $$('.mp-time span'), ctrl = $$('.mp-ctrl > .i');
      var mm = function (x) { x = Math.floor(x || 0); return Math.floor(x / 60) + ':' + ('0' + (x % 60)).slice(-2); };
      au.addEventListener('loadedmetadata', function () { tm[1].textContent = mm(au.duration); });
      au.addEventListener('timeupdate', function () { tm[0].textContent = mm(au.currentTime); bar.style.width = (au.duration ? au.currentTime / au.duration * 100 : 0) + '%'; });
      au.addEventListener('ended', function () { play.innerHTML = PLAY; });
      var PLAY = play.innerHTML, PAUSE = '<svg class="i" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
      bar.style.width = '0%'; tm[0].textContent = '0:00';
      play.addEventListener('click', function () { if (au.paused) { au.play(); play.innerHTML = PAUSE; } else { au.pause(); play.innerHTML = PLAY; } });
      if (ctrl[0]) ctrl[0].addEventListener('click', function () { au.currentTime = Math.max(0, au.currentTime - 15); });
      if (ctrl[1]) ctrl[1].addEventListener('click', function () { au.currentTime = Math.min(au.duration || 0, au.currentTime + 15); });
      $('.mp-bar').addEventListener('click', function (e) { var r = this.getBoundingClientRect(); if (au.duration) au.currentTime = (e.clientX - r.left) / r.width * au.duration; });
      go($('.mp-file'), o.url, o.n);
    },
    video: function () {
      // Eigen video (bestand op de server): de knop speelt de video af en scrollt ernaar; anders naar de link
      var vid = $('.vd-own video'), btn = $('.vd-btn');
      if (vid && btn) { btn.setAttribute('data-go', ''); btn.addEventListener('click', function () { vid.scrollIntoView({ behavior: 'smooth', block: 'center' }); vid.play().catch(function () {}); }); }
      else if (btn) go(btn, href(c.url));
      var s = $('.vd-top .i:last-child'); if (s) { s.setAttribute('data-go', ''); s.addEventListener('click', share); }
    },
    apps: function () {
      var b = $$('.ap-badge'), urls = []; if (c.ios) urls.push(href(c.ios)); if (c.android) urls.push(href(c.android));
      b.forEach(function (el, i) { go(el, urls[i]); });
      go($('.as-get span'), urls[0]);
      var sh = $('.as-get .i'); if (sh) { sh.setAttribute('data-go', ''); sh.addEventListener('click', share); }
    },
    coupon: function () {
      go($('[data-shop]'), href(c.buttonUrl));   // knop naar de webshop/boekingspagina
      var btn = $('[data-copy]'); if (!btn) return; if (!c.code) { btn.remove(); return; }
      btn.addEventListener('click', function () {
        var done = function () { toast(t('live.codeCopied')); };
        if (navigator.clipboard) navigator.clipboard.writeText(c.code).then(done, done); else done();
      });
    }
  };

  function draw() {
    if (!PHONE[type.id]) { root.innerHTML = '<div class="ph"></div>'; return; }
    root.innerHTML = PHONE[type.id](c, false, { previewUnlocked: true });
    tidy();
    if (WIRE[type.id]) WIRE[type.id]();
  }
  i18n.set(L.lang).then(draw, draw);
})();
