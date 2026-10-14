/* =========================================================
   BEWEGENDE ACHTERGRONDEN (Mijn account > Achtergrond)
   Eén <canvas> achter de hele app. Vijf animaties in de Optimasys-stijl (donker, cyaan/blauw):
     orbit   – zwevende lichtdeeltjes ("Quiet Orbit", aangeleverd door Fabian, EvenMesh-instellingen)
     network – rustig sterrenbeeld: puntjes met dunne lijnen ertussen
     flow    – lichtstrepen die met een zachte stroming meebewegen
     waves   – langzame cyaan/blauwe lichtgolven
     mist    – zachte, drijvende nevel (vloeistof-achtig)
   - Max. 30 beelden per seconde, stopt als het tabblad niet zichtbaar is
   - "Beweging verminderen" (prefers-reduced-motion): één stilstaand beeld
   - Licht thema: lichte achtergrond met donkerdere deeltjes
   - Geen canvas mogelijk? Dan blijft de stilstaande kleurverloop-achtergrond (fallback in BACKGROUNDS)
   ========================================================= */
var WallAnim = (function () {
  var canvas = null, ctx = null, kind = null, raf = 0, last = 0, w = 0, h = 0, dpr = 1, state = null;
  var motion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var TAU = Math.PI * 2, FPS = 30, MAX_PIXELS = 1600000;
  function light() { return window.theme && theme.resolved() === 'light'; }
  // Kleuren per thema
  function pal() {
    return light()
      ? { bg: '#eef2f7', dots: ['#1576c9', '#2bb5f0', '#6d7ce0'], line: '#1576c9', wave: ['rgba(43,181,240,', 'rgba(21,118,201,', 'rgba(109,124,224,'] }
      : { bg: '#090b12', dots: ['#F7F3FF', '#B9CAFF', '#96A4FF'], line: '#7fd6ff', wave: ['rgba(43,181,240,', 'rgba(21,118,201,', 'rgba(150,164,255,'] };
  }
  // Vaste "willekeur": elke keer hetzelfde mooie beeld
  function seeded(seed) { var s = seed >>> 0 || 0x6d2b79f5; return function () { s += 0x6d2b79f5; var v = s; v = Math.imul(v ^ (v >>> 15), v | 1); v ^= v + Math.imul(v ^ (v >>> 7), v | 61); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------- Deeltjes (orbit, network, flow) — gebaseerd op Quiet Orbit ---------- */
  var PARTICLE = {
    orbit:   { mode: 'floating', count: 420, speed: 0.12, size: 0.9, direction: -33, opacity: 0.7, distance: 118, intensity: 0.34, motion: 1.8, seed: 8421 },
    network: { mode: 'network', count: 160, speed: 0.08, size: 1.1, direction: 20, opacity: 0.75, distance: 120, intensity: 0.6, motion: 1.2, seed: 5113, connections: true },
    flow:    { mode: 'flow', count: 420, speed: 0.16, size: 1.1, direction: -18, opacity: 0.6, distance: 100, intensity: 0.5, motion: 1.4, seed: 2207 }
  };
  function particlesInit(cfg) {
    var rnd = seeded(cfg.seed), list = [];
    var target = function () { var div = cfg.mode === 'flow' ? 900 : cfg.mode === 'network' ? 1500 : 1200, lim = cfg.mode === 'flow' ? 560 : cfg.mode === 'network' ? 280 : 440; return Math.min(cfg.count, Math.max(24, Math.round(w * h / div)), lim); };
    var make = function () { var x = rnd() * w, y = rnd() * h; return { x: x, y: y, ox: x, oy: y, phase: rnd() * TAU, drift: (rnd() - 0.5) * 0.75, size: 0.55 + rnd() * 0.9, pace: 0.62 + rnd() * 0.72, color: Math.floor(rnd() * 3) }; };
    return { cfg: cfg, list: list, fit: function () { var n = target(); if (list.length > n) list.length = n; while (list.length < n) list.push(make()); }, clear: true };
  }
  function wrap(p, m) { var r = false; if (p.x < -m) { p.x = w + m; r = true; } else if (p.x > w + m) { p.x = -m; r = true; } if (p.y < -m) { p.y = h + m; r = true; } else if (p.y > h + m) { p.y = -m; r = true; } if (r) { p.ox = p.x; p.oy = p.y; } return r; }
  function particlesDraw(st, time, dt, still) {
    var c = st.cfg, P = pal(); st.fit();
    if (c.mode === 'flow') {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = st.clear || still ? 1 : 0.06; ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h); st.clear = false;
      var pace = c.speed * (38 + c.intensity * 18) * (0.35 + c.motion * 0.65), dir = c.direction * Math.PI / 180, sc = 0.0034 + c.motion * 0.0048, tmp = time * 0.00016 * (0.25 + c.speed * 0.75);
      ctx.globalCompositeOperation = light() ? 'source-over' : 'lighter'; ctx.lineCap = 'round';
      st.list.forEach(function (p) {
        var a = dir + (Math.sin(p.y * sc + tmp + p.phase) + Math.cos(p.x * sc * 0.82 - tmp * 0.74)) * 0.5 * (0.34 + c.motion * 0.58) * c.intensity;
        var sx, sy, ex, ey;
        if (still) { var L = c.size * 4; sx = p.x - Math.cos(a) * L; sy = p.y - Math.sin(a) * L; ex = p.x + Math.cos(a) * L; ey = p.y + Math.sin(a) * L; }
        else { p.ox = p.x; p.oy = p.y; p.x += Math.cos(a) * pace * p.pace * dt; p.y += Math.sin(a) * pace * p.pace * dt; if (wrap(p, 12)) return; sx = p.ox; sy = p.oy; ex = p.x; ey = p.y; }
        ctx.globalAlpha = Math.min(0.9, c.opacity * (0.42 + p.size * 0.23)); ctx.strokeStyle = P.dots[p.color]; ctx.lineWidth = Math.max(0.35, c.size * p.size);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; return;
    }
    ctx.globalAlpha = 1; ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
    if (!still) {
      var d0 = c.direction * Math.PI / 180, pc = c.speed * (18 + c.intensity * 18) * (0.35 + c.motion * 0.65), nf = c.mode === 'network' ? 0.68 : 1;
      st.list.forEach(function (p) { var sway = Math.sin(time * 0.00024 + p.phase) * (0.08 + c.motion * 0.22) * nf, a = d0 + p.drift * c.motion * nf + sway; p.x += Math.cos(a) * pc * p.pace * dt; p.y += Math.sin(a) * pc * p.pace * dt; wrap(p, c.size * 5 + 8); });
    }
    if (c.connections) {                                         // lijnen tussen puntjes die dicht bij elkaar staan
      var cell = c.distance, grid = {};
      st.list.forEach(function (p, i) { var k = Math.floor(p.x / cell) + ':' + Math.floor(p.y / cell); (grid[k] = grid[k] || []).push(i); });
      ctx.globalAlpha = light() ? 0.22 : 0.16; ctx.strokeStyle = P.line; ctx.lineWidth = 0.6; ctx.beginPath();
      st.list.forEach(function (p, i) {
        var cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
        for (var x = -1; x <= 1; x++) for (var y = -1; y <= 1; y++) (grid[(cx + x) + ':' + (cy + y)] || []).forEach(function (j) {
          if (j <= i) return; var q = st.list[j], dx = q.x - p.x, dy = q.y - p.y; if (dx * dx + dy * dy < cell * cell) { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }
        });
      });
      ctx.stroke();
    }
    st.list.forEach(function (p) {
      var r = c.size * p.size * (0.76 + c.intensity * 0.24);
      ctx.globalAlpha = Math.min(1, c.opacity * (0.58 + p.size * 0.28)); ctx.fillStyle = P.dots[p.color];
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  /* ---------- Lichtgolven ---------- */
  function wavesDraw(st, time) {
    var P = pal(), t = time * 0.00012;
    ctx.globalAlpha = 1; ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = light() ? 'source-over' : 'lighter';
    for (var i = 0; i < 7; i++) {
      var base = h * (0.35 + i * 0.075), amp = h * (0.05 + 0.02 * Math.sin(i * 1.7)), len = w * (0.55 + i * 0.07), sp = 0.6 + i * 0.13, col = P.wave[i % 3];
      var g = ctx.createLinearGradient(0, base - amp * 2, 0, base + amp * 2);
      g.addColorStop(0, col + '0)'); g.addColorStop(0.5, col + (light() ? 0.16 : 0.22) + ')'); g.addColorStop(1, col + '0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, h);
      for (var x = 0; x <= w + 20; x += 20) ctx.lineTo(x, base + Math.sin(x / len * TAU + t * sp * 6 + i) * amp + Math.sin(x / (len * 0.43) - t * sp * 4) * amp * 0.35);
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col + (light() ? 0.35 : 0.45) + ')'; ctx.lineWidth = 1; ctx.beginPath();
      for (var x2 = 0; x2 <= w + 20; x2 += 20) { var y2 = base + Math.sin(x2 / len * TAU + t * sp * 6 + i) * amp + Math.sin(x2 / (len * 0.43) - t * sp * 4) * amp * 0.35; if (x2) ctx.lineTo(x2, y2); else ctx.moveTo(x2, y2); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- Nevel (zachte, drijvende vlekken) ---------- */
  function mistInit() { var r = seeded(9001), blobs = []; for (var i = 0; i < 7; i++) blobs.push({ x: r(), y: r(), r: 0.25 + r() * 0.3, sx: (r() - 0.5) * 0.6, sy: (r() - 0.5) * 0.6, ph: r() * TAU, c: i % 3 }); return { blobs: blobs }; }
  function mistDraw(st, time) {
    var P = pal(), t = time * 0.00005;
    ctx.globalAlpha = 1; ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = light() ? 'source-over' : 'lighter';
    var m = Math.max(w, h);
    st.blobs.forEach(function (b) {
      var x = (b.x + Math.sin(t * (1 + b.sx) + b.ph) * 0.18) * w, y = (b.y + Math.cos(t * (1 + b.sy) + b.ph) * 0.16) * h, r = b.r * m * (0.9 + 0.1 * Math.sin(t * 3 + b.ph));
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, P.wave[b.c] + (light() ? 0.18 : 0.26) + ')'); g.addColorStop(1, P.wave[b.c] + '0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  var KINDS = {
    orbit: { init: function () { return particlesInit(PARTICLE.orbit); }, draw: particlesDraw },
    network: { init: function () { return particlesInit(PARTICLE.network); }, draw: particlesDraw },
    flow: { init: function () { return particlesInit(PARTICLE.flow); }, draw: particlesDraw },
    waves: { init: function () { return {}; }, draw: wavesDraw },
    mist: { init: mistInit, draw: mistDraw }
  };

  function resize() {
    if (!canvas) return;
    var bw = window.innerWidth, bh = window.innerHeight; if (!bw || !bh) return;
    var ow = w, oh = h; w = bw; h = bh;
    dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / (w * h))));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state && state.list && ow && oh) state.list.forEach(function (p) { p.x *= w / ow; p.y *= h / oh; p.ox = p.x; p.oy = p.y; });
    if (state) state.clear = true;
    frame(performance.now(), true);
  }
  function frame(time, still) { if (kind && state) KINDS[kind].draw(state, time, 0, true === still || motion.matches); }
  function loop(time) {
    raf = 0; if (!kind) return;
    if (document.hidden || motion.matches) return;
    if (last && time - last < 1000 / FPS - 1) { raf = requestAnimationFrame(loop); return; }
    var dt = last ? Math.min(0.05, (time - last) / 1000) : 0; last = time;
    KINDS[kind].draw(state, time, dt, false);
    raf = requestAnimationFrame(loop);
  }
  function startLoop() { if (!raf && kind && !document.hidden && !motion.matches) { last = 0; raf = requestAnimationFrame(loop); } }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  /** Animatie aanzetten (id uit KINDS) of uitzetten (null) */
  function show(id) {
    if (id && !KINDS[id]) id = null;
    if (id === kind) return;
    stopLoop(); kind = id;
    if (!id) { if (canvas) canvas.hidden = true; state = null; return; }
    if (!canvas) {
      canvas = document.createElement('canvas'); canvas.className = 'wp-anim'; canvas.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(canvas, document.body.firstChild);
      ctx = canvas.getContext('2d'); if (!ctx) { canvas.remove(); canvas = null; kind = null; return; }   // geen canvas: stilstaande achtergrond blijft
      window.addEventListener('resize', resize, { passive: true });
      document.addEventListener('visibilitychange', function () { if (document.hidden) stopLoop(); else startLoop(); });
      if (motion.addEventListener) motion.addEventListener('change', function () { if (motion.matches) { stopLoop(); frame(performance.now(), true); } else startLoop(); });
      if (window.theme) theme.onChange(function () { if (state) { state.clear = true; frame(performance.now(), true); } });
    }
    canvas.hidden = false; state = KINDS[id].init(); w = 0; resize(); startLoop();
  }
  /** Voor de voorbeeldkaartjes: één stilstaand beeld van een animatie als afbeelding */
  function snapshot(id, cw, ch) {
    if (!KINDS[id]) return '';
    var c = document.createElement('canvas'), x = c.getContext('2d'); if (!x) return '';
    var keep = [canvas, ctx, w, h, state]; c.width = cw; c.height = ch; ctx = x; w = cw; h = ch; ctx.setTransform(1, 0, 0, 1, 0, 0);
    var st = KINDS[id].init(); if (st.cfg) { st.cfg = Object.assign({}, st.cfg, { size: st.cfg.size * 1.7, opacity: Math.min(1, st.cfg.opacity * 1.3) }); }   // klein kaartje: iets grotere puntjes
    KINDS[id].draw(st, 1000, 0, true);
    var url = c.toDataURL('image/jpeg', 0.8);
    ctx = keep[1]; w = keep[2]; h = keep[3]; state = keep[4];
    return url;
  }
  return { show: show, kinds: Object.keys(KINDS), snapshot: snapshot };
})();
