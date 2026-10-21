/* =========================================================
   EIGEN 3D-ACHTERGRONDEN (three.js) — QR-Codex
   Vijf zelfgemaakte animaties in de huisstijl (donker, cyaan/blauw). Wordt gebundeld door scripts/build-3d.js
   naar public/anim/wallpaper3d.js en pas geladen als iemand een bewegende achtergrond kiest.
     tide    – Golfveld: een veld van lichtpuntjes dat als water golft
     galaxy  – Spiraal: een langzaam draaiende spiraal van duizenden sterretjes
     ribbons – Lichtlinten: zachte, golvende lichtbanen (shader)
     sphere  – Netwerkbol: een draaiende bol van punten die met lijnen verbonden zijn
     fluid   – Vloeistof: diepblauwe kleuren die als inkt door elkaar stromen (shader)
   API (window.Wallpaper3D): start(id, canvas), stop(), snapshot(id, w, h) → data-URL, kinds
   ========================================================= */
import { WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial,
  AdditiveBlending, Color, LineSegments, LineBasicMaterial, Group, Mesh, PlaneGeometry, Vector2 } from 'three';

const BG = 0x070a12;
const CYAN = new Color('#2bb5f0'), BLUE = new Color('#1576c9'), VIOLET = new Color('#7c8cff'), ICE = new Color('#cfe9ff');

/* ---------- Kleine helpers ---------- */
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pointsMaterial = (size) => new ShaderMaterial({
  transparent: true, depthWrite: false, blending: AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uSize: { value: size }, uPr: { value: 1 } },
  vertexShader: `attribute vec3 color; attribute float scale; varying vec3 vColor; varying float vFade; uniform float uSize; uniform float uPr;
    void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * scale * uPr * (60.0 / -mv.z); vFade = clamp(1.0 - (-mv.z - 4.0) / 60.0, 0.15, 1.0); }`,
  fragmentShader: `varying vec3 vColor; varying float vFade; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vColor, a * vFade); }`,
});

/* ---------- 1. Golfveld ---------- */
function tide() {
  const scene = new Scene(), camera = new PerspectiveCamera(55, 1, 0.1, 200), W = 170, D = 110, pos = [], col = [], sc = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) { pos.push((i - W / 2) * 0.55, 0, (j - D / 2) * 0.55); col.push(0, 0, 0); sc.push(1); }
  const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new Float32BufferAttribute(col, 3)); geo.setAttribute('scale', new Float32BufferAttribute(sc, 1));
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uPr: { value: 1 }, uA: { value: CYAN }, uB: { value: BLUE } },
    vertexShader: `uniform float uTime; uniform float uPr; uniform vec3 uA; uniform vec3 uB; varying vec3 vColor; varying float vAlpha;
      void main(){ vec3 p = position; float t = uTime * 0.45;
        float h = sin(p.x * 0.22 + t) * 0.9 + sin(p.z * 0.31 + t * 1.3) * 0.7 + sin((p.x + p.z) * 0.12 - t * 0.7) * 1.1;
        p.y = h; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        float k = clamp((h + 2.7) / 5.4, 0.0, 1.0); vColor = mix(uB, uA, k) * (0.55 + k * 0.9);
        gl_PointSize = (1.4 + k * 2.2) * uPr * (40.0 / -mv.z); vAlpha = clamp(1.0 - (-mv.z - 6.0) / 55.0, 0.0, 1.0); }`,
    fragmentShader: `varying vec3 vColor; varying float vAlpha; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vColor, smoothstep(0.5, 0.05, d) * vAlpha); }`,
  });
  scene.add(new Points(geo, mat));
  camera.position.set(0, 7.5, 26); camera.lookAt(0, -1, -6);
  return { scene, camera, update(t) { mat.uniforms.uTime.value = t; camera.position.x = Math.sin(t * 0.05) * 4; camera.lookAt(0, -1, -6); }, mats: [mat], dispose() { geo.dispose(); mat.dispose(); } };
}

/* ---------- 2. Spiraal ---------- */
function galaxy() {
  const scene = new Scene(), camera = new PerspectiveCamera(60, 1, 0.1, 200), r = rng(77), N = 9000, pos = [], col = [], sc = [], arms = 4, c = new Color();
  for (let i = 0; i < N; i++) {
    const rad = Math.pow(r(), 1.6) * 16, arm = (i % arms) / arms * Math.PI * 2, spin = rad * 0.38, spread = (1 - rad / 18) * 0.25 + 0.35;
    const a = arm + spin + (r() - 0.5) * spread * 1.6;
    pos.push(Math.cos(a) * rad + (r() - 0.5) * 0.6, (r() - 0.5) * (1.2 - rad / 20) * 1.2, Math.sin(a) * rad + (r() - 0.5) * 0.6);
    c.copy(ICE).lerp(CYAN, Math.min(1, rad / 5)).lerp(VIOLET, Math.max(0, (rad - 7) / 10)); col.push(c.r, c.g, c.b); sc.push(0.6 + r() * 1.4);
  }
  const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new Float32BufferAttribute(col, 3)); geo.setAttribute('scale', new Float32BufferAttribute(sc, 1));
  const mat = pointsMaterial(1.5), pts = new Points(geo, mat), g = new Group(); g.add(pts); g.rotation.x = 0.55; g.rotation.z = -0.25; scene.add(g);
  camera.position.set(0, 2, 22); camera.lookAt(0, 0, 0);
  return { scene, camera, update(t) { pts.rotation.y = t * 0.035; }, mats: [mat], dispose() { geo.dispose(); mat.dispose(); } };
}

/* ---------- Schermvullende shaders (lichtlinten, vloeistof) ---------- */
const NOISE = `
  vec2 hash(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
  float noise(vec2 p){ const float K1 = 0.366025404; const float K2 = 0.211324865; vec2 i = floor(p + (p.x+p.y)*K1); vec2 a = p - i + (i.x+i.y)*K2;
    float m = step(a.y,a.x); vec2 o = vec2(m,1.0-m); vec2 b = a - o + K2; vec2 c = a - 1.0 + 2.0*K2;
    vec3 h = max(0.5-vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0); vec3 n = h*h*h*h*vec3(dot(a,hash(i)), dot(b,hash(i+o)), dot(c,hash(i+1.0))); return dot(n, vec3(70.0)); }
  float fbm(vec2 p){ float f = 0.0, w = 0.5; for (int i = 0; i < 5; i++){ f += w * noise(p); p *= 2.02; w *= 0.5; } return f; }
  float fbm3(vec2 p){ float f = 0.0, w = 0.5; for (int i = 0; i < 3; i++){ f += w * noise(p); p *= 1.9; w *= 0.5; } return f; }`;
function fullscreen(frag) {
  const scene = new Scene(), camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new ShaderMaterial({ uniforms: { uTime: { value: 0 }, uRes: { value: new Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: NOISE + frag });
  const geo = new PlaneGeometry(2, 2); scene.add(new Mesh(geo, mat));
  return { scene, camera, update(t) { mat.uniforms.uTime.value = t; }, resize(w, h) { mat.uniforms.uRes.value.set(w, h); }, mats: [], dispose() { geo.dispose(); mat.dispose(); } };
}
const ribbons = () => fullscreen(`uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
  void main(){ vec2 uv = vUv; float asp = uRes.x / max(uRes.y, 1.0); vec2 p = vec2(uv.x * asp, uv.y); float t = uTime * 0.06;
    vec3 col = vec3(0.027, 0.039, 0.07);
    for (int i = 0; i < 4; i++) { float fi = float(i);
      float y = 0.25 + fi * 0.16 + 0.12 * fbm(vec2(p.x * 0.9 + t * (1.0 + fi * 0.3), fi * 3.1 + t));
      float d = abs(uv.y - y); float band = exp(-d * d * 260.0) * (0.55 + 0.45 * fbm(vec2(p.x * 2.0 - t * 2.0, fi)));
      float glow = exp(-d * 9.0) * 0.12;
      vec3 c = mix(vec3(0.08, 0.46, 0.79), vec3(0.17, 0.71, 0.94), fi / 3.0); c = mix(c, vec3(0.49, 0.55, 1.0), step(2.5, fi) * 0.6);
      col += c * (band * 0.9 + glow); }
    col *= 0.85 + 0.15 * smoothstep(1.2, 0.0, length(uv - vec2(0.5, 0.6)));
    gl_FragColor = vec4(col, 1.0); }`);
const fluid = () => fullscreen(`uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
  void main(){ float asp = uRes.x / max(uRes.y, 1.0); vec2 p = (vUv - 0.5) * vec2(asp, 1.0) * 0.7; float t = uTime * 0.03;
    vec2 q = vec2(fbm3(p + t), fbm3(p + vec2(5.2, 1.3) - t));
    vec2 r = vec2(fbm3(p + 1.6 * q + vec2(1.7, 9.2) + t * 1.4), fbm3(p + 1.6 * q + vec2(8.3, 2.8) - t * 1.2));
    float f = fbm3(p + 1.4 * r);
    vec3 col = mix(vec3(0.02, 0.035, 0.07), vec3(0.06, 0.28, 0.55), clamp(f * 1.2 + 0.45, 0.0, 1.0));
    col = mix(col, vec3(0.17, 0.71, 0.94), clamp(length(q) * 0.55 - 0.15, 0.0, 1.0) * 0.55);
    col = mix(col, vec3(0.45, 0.5, 0.98), clamp(r.x * 0.8, 0.0, 1.0) * 0.35);
    col *= 0.75; gl_FragColor = vec4(col, 1.0); }`);

/* ---------- 4. Netwerkbol ---------- */
function sphere() {
  const scene = new Scene(), camera = new PerspectiveCamera(50, 1, 0.1, 100), N = 520, pts = [], pos = [], col = [], sc = [], c = new Color();
  for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.399963; pts.push([Math.cos(th) * rr * 6, y * 6, Math.sin(th) * rr * 6]); }
  pts.forEach((p, i) => { pos.push(p[0], p[1], p[2]); c.copy(CYAN).lerp(VIOLET, (p[1] + 6) / 12 * 0.6); col.push(c.r, c.g, c.b); sc.push(i % 9 === 0 ? 2.2 : 1); });
  const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new Float32BufferAttribute(col, 3)); geo.setAttribute('scale', new Float32BufferAttribute(sc, 1));
  const lines = [];                                              // elk punt verbonden met zijn 3 dichtste buren
  pts.forEach((p, i) => { const near = pts.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2]).filter((x) => x[0] > i).sort((a, b) => a[1] - b[1]).slice(0, 3); near.forEach(([j]) => lines.push(...p, ...pts[j])); });
  const lgeo = new BufferGeometry(); lgeo.setAttribute('position', new Float32BufferAttribute(lines, 3));
  const lmat = new LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.32, blending: AdditiveBlending, depthWrite: false });
  const mat = pointsMaterial(1.6), g = new Group(); g.add(new LineSegments(lgeo, lmat)); g.add(new Points(geo, mat)); scene.add(g);
  camera.position.set(0, 0, 17); g.position.x = 3.5;
  return { scene, camera, update(t) { g.rotation.y = t * 0.08; g.rotation.x = Math.sin(t * 0.05) * 0.25; }, mats: [mat], dispose() { geo.dispose(); lgeo.dispose(); mat.dispose(); lmat.dispose(); } };
}

const KINDS = { tide, galaxy, ribbons, sphere, fluid };

/* ---------- Afspelen ---------- */
let renderer = null, cur = null, raf = 0, last = 0, t0 = 0, kind = null, canvasEl = null;
const motion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function size() {
  if (!renderer || !cur) return;
  const w = window.innerWidth, h = window.innerHeight; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(w, h, false);
  if (cur.camera.isPerspectiveCamera) { cur.camera.aspect = w / h; cur.camera.updateProjectionMatrix(); }
  if (cur.resize) cur.resize(w, h);
  (cur.mats || []).forEach((m) => { if (m.uniforms.uPr) m.uniforms.uPr.value = renderer.getPixelRatio(); });
  draw(performance.now());
}
function draw(now) { if (!cur) return; cur.update((now - t0) / 1000 + 8); renderer.render(cur.scene, cur.camera); }
function loop(now) {
  raf = 0; if (!cur || document.hidden || motion.matches) return;
  if (now - last >= 1000 / 30 - 1) { last = now; draw(now); }
  raf = requestAnimationFrame(loop);
}
function play() { if (!raf && cur && !document.hidden && !motion.matches) raf = requestAnimationFrame(loop); }
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else play(); });
window.addEventListener('resize', size, { passive: true });

function start(id, canvas) {
  if (!KINDS[id]) return false;
  if (kind === id && canvasEl === canvas) return true;
  stop();
  try { if (!renderer || canvasEl !== canvas) { renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); canvasEl = canvas; renderer.setClearColor(BG, 1); } }
  catch (e) { return false; }                                   // geen WebGL: de stilstaande achtergrond blijft
  cur = KINDS[id](); kind = id; t0 = performance.now(); size(); play();
  return true;
}
function stop() { cancelAnimationFrame(raf); raf = 0; if (cur) cur.dispose(); cur = null; kind = null; }

/** Stilstaand voorbeeld voor de kaartjes (eigen kleine renderer, daarna weer opgeruimd) */
function snapshot(id, w, h) {
  if (!KINDS[id]) return '';
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  let r; try { r = new WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true }); } catch (e) { return ''; }
  r.setPixelRatio(1); r.setSize(w, h, false); r.setClearColor(BG, 1);
  const s = KINDS[id]();
  if (s.camera.isPerspectiveCamera) { s.camera.aspect = w / h; s.camera.updateProjectionMatrix(); }
  if (s.resize) s.resize(w, h);
  (s.mats || []).forEach((m) => { if (m.uniforms.uPr) m.uniforms.uPr.value = 0.7; });
  s.update(9); r.render(s.scene, s.camera);
  const url = c.toDataURL('image/jpeg', 0.85);
  s.dispose(); r.dispose(); r.forceContextLoss();
  return url;
}

window.Wallpaper3D = { start, stop, snapshot, kinds: Object.keys(KINDS) };
document.dispatchEvent(new Event('wallpaper3d:ready'));
