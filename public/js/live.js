/* =========================================================
   ECHTE PAGINA: tekent het type met hetzelfde sjabloon als de telefoon in de tool
   en maakt alles werkend (bellen, mailen, route, downloaden, afspelen, kopiëren).
   ========================================================= */
(function () {
  var L = window.LIVE, type = getType(L.typeId), root = document.getElementById('live'), c = {};
  type.fields.forEach(function (f) { c[f.key] = L.content[f.key] != null ? String(L.content[f.key]) : ''; });

  function href(v) { v = String(v || '').trim(); return !v ? '' : /^(https?:|mailto:|tel:)/i.test(v) ? v : /^[^\s]+\.[a-z]{2,}(\/|$)/i.test(v) ? 'https://' + v : ''; }
  function go(el, url, download) {
    if (!el || !url) return;
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
      var row = sk.closest('.vc-row, .gm-row, .gm-desc, .lt-list > span, .pd-file, .mn-row, .wl-f, .vc-acts > span, .sm-tile, .ap-badge, .bz-row, p, small');
      if (row && !row.textContent.trim()) row.remove(); else sk.remove();
    });
    // Rijen met een label maar zonder waarde, en lege fotovakjes
    $$('.vc-row').forEach(function (r) { var b = r.querySelector('b'); if (b && !b.textContent.trim()) r.remove(); });
    $$('.gm-row').forEach(function (r) { var sp = r.querySelector('span'); if (sp && !sp.textContent.trim()) r.remove(); });
    $$('.al-grid .ph-none').forEach(function (x) { x.remove(); });
  }

  var WIRE = {
    links: function () {
      $$('.lt-list > span').forEach(function (el, i) { go(el, href(c['link' + (i + 1)])); });
      var s = $('.lt-top span:last-child'); if (s) { s.setAttribute('data-go', ''); s.onclick = share; }
    },
    vcard: function () {
      var addr = c.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address) : '';
      var urls = [tel(c.phone), mail(c.email), href(c.website), addr];
      $$('.vc-acts > span').forEach(function (el, i) { go(el, urls[i]); if (!urls[i]) el.style.opacity = '.35'; });
      $$('.vc-row').forEach(function (el, i) { go(el, urls[i]); });
      var vcf = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + c.name, c.role ? 'TITLE:' + c.role : '', c.company ? 'ORG:' + c.company : '', c.phone ? 'TEL:' + c.phone : '', c.email ? 'EMAIL:' + c.email : '', c.website ? 'URL:' + c.website : '', c.address ? 'ADR:;;' + c.address + ';;;;' : '', 'END:VCARD'].filter(Boolean).join('\r\n');
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
      var list = FILES.list(c.photos);
      $$('.al-grid span').forEach(function (el) {
        var m = (el.getAttribute('style') || '').match(/url\(([^)]+)\)/); if (!m) return;
        el.setAttribute('data-go', ''); el.addEventListener('click', function () { var lb = document.createElement('div'); lb.className = 'lb'; lb.innerHTML = '<img src="' + m[1] + '" alt="">'; lb.onclick = function () { lb.remove(); }; document.body.appendChild(lb); });
      });
      var dl = $('.al-dl'); if (!list.length && dl) dl.remove();
      if (dl) dl.addEventListener('click', function () { list.forEach(function (src, i) { setTimeout(function () { var a = document.createElement('a'); a.href = src; a.download = (c.title || 'foto').replace(/[^\w ]+/g, '') + '-' + (i + 1) + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); }, i * 300); }); });
    },
    social: function () {
      var so = SOCIALS.parse(c.socials), nets = SOCIALS.LIST.filter(function (n) { return n.id in so; });
      $$('.sm-tile').forEach(function (el, i) { if (nets[i]) go(el, href(so[nets[i].id])); });
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
    apps: function () {
      var b = $$('.ap-badge'), urls = []; if (c.ios) urls.push(href(c.ios)); if (c.android) urls.push(href(c.android));
      b.forEach(function (el, i) { go(el, urls[i]); });
      go($('.as-get span'), urls[0]);
      var sh = $('.as-get .i'); if (sh) { sh.setAttribute('data-go', ''); sh.addEventListener('click', share); }
    },
    coupon: function () {
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
