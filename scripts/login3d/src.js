/* =========================================================
   INLOGSCHERM – interactieve glazen QR-sculptuur (three.js) — Optimasys QR
   Een zwevende QR-code van losse glazen scherven: elk blokje bestaat uit twee driehoekige 3D-scherven
   (diagonaal gebroken, met geslepen randen).
     - muis erover: scherven in de buurt komen naar voren en kantelen
     - klik en houd vast: de code valt uiteen in zwevende, draaiende scherven
     - loslaten: alles veert terug en vormt weer de QR-code
   Gebundeld door scripts/build-3d.js naar public/anim/login3d.js; pas geladen op het inlogscherm (computer/tablet).
   "Beweging verminderen" op het apparaat: één stilstaand beeld, geen animatie.
   API (window.LoginScene): start(canvas) → true/false, stop()
   ========================================================= */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, InstancedMesh, MeshPhysicalMaterial, Object3D, Vector3, Color,
  PMREMGenerator, Raycaster, Plane, Vector2, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial,
  AdditiveBlending, PointLight, DirectionalLight, AmbientLight, ACESFilmicToneMapping, SRGBColorSpace, Mesh,
  PlaneGeometry, MeshBasicMaterial, CanvasTexture, Quaternion, Euler, Shape, ExtrudeGeometry
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const NAVY = new Color('#060b16'), CYAN = new Color('#2bb5f0'), BLUE = new Color('#1576c9'), ICE = new Color('#d8f1ff');
const N = 25, CELL = 0.34;                                   // 25×25 modules (QR versie 2), maat per module

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- Het QR-patroon: drie zoekvierkanten, uitlijnvierkant, tijdlijnen en (vaste) willekeurige modules ---------- */
function pattern() {
  const r = rng(20261015), g = [];
  for (let y = 0; y < N; y++) { g.push([]); for (let x = 0; x < N; x++) g[y].push(null); }
  const finder = (ox, oy) => { for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) { const X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
    const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3)); g[Y][X] = { on: ring !== 2 && ring !== 4, finder: true }; } };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const ring = Math.max(Math.abs(x), Math.abs(y)); g[18 + y][18 + x] = { on: ring !== 1, finder: true }; }
  for (let i = 8; i < N - 8; i++) { g[6][i] = { on: i % 2 === 0 }; g[i][6] = { on: i % 2 === 0 }; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x]) g[y][x] = { on: r() < 0.5 };
  return g;
}

/* ---------- Achtergrond: zachte gloed (ondoorzichtig, zodat het glas iets heeft om te breken) ---------- */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#060b16'; x.fillRect(0, 0, 512, 512);
  const blob = (cx, cy, r, col, a) => { const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); x.fillStyle = gr; x.fillRect(0, 0, 512, 512); };
  blob(256, 256, 240, 'rgba(21,118,201,A)', 0.6); blob(320, 200, 160, 'rgba(43,181,240,A)', 0.55); blob(180, 330, 170, 'rgba(80,100,235,A)', 0.35); blob(256, 256, 90, 'rgba(216,241,255,A)', 0.22);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

let S = null;   // de lopende scène (één tegelijk)

function start(canvas) {
  stop();
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { return false; }
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(NAVY, 1);

  const scene = new Scene(); scene.background = NAVY.clone();
  const pmrem = new PMREMGenerator(renderer), envRT = pmrem.fromScene(new RoomEnvironment(), 0.04); scene.environment = envRT.texture; pmrem.dispose();
  const camera = new PerspectiveCamera(34, 1, 0.1, 100); camera.position.set(0, 0, 16);

  // Gloed achter de sculptuur
  const glowTex = glowTexture(), glow = new Mesh(new PlaneGeometry(26, 26), new MeshBasicMaterial({ map: glowTex, depthWrite: false })); glow.position.z = -6; scene.add(glow);

  // Licht: koel wit van boven, cyaan en blauw strijklicht dat langzaam beweegt (voor de randen)
  scene.add(new AmbientLight(0x9fc8ff, 0.25));
  const key = new DirectionalLight(0xffffff, 1.6); key.position.set(-4, 6, 8); scene.add(key);
  const rimA = new PointLight(CYAN, 60, 30, 1.6), rimB = new PointLight(0x4f7bff, 45, 30, 1.6); scene.add(rimA, rimB);

  // De scherven: één InstancedMesh (snel). Elk blokje = twee driehoekige glasscherven (diagonaal gebroken, geslepen randen)
  const grid = pattern(), cells = [];
  grid.forEach((row, y) => row.forEach((c, x) => { if (c.on) cells.push({ x, y, finder: !!c.finder }); }));
  const h = CELL * 0.47, g = CELL * 0.03, tri = new Shape();
  tri.moveTo(-h, -h + g); tri.lineTo(h - g * 1.4, -h + g * 0.2); tri.lineTo(-h, h - g * 1.4); tri.closePath();   // halve module, kleine voeg langs de breuk
  const DEPTH = CELL * 0.8;
  const geo = new ExtrudeGeometry(tri, { depth: DEPTH, bevelEnabled: true, bevelThickness: CELL * 0.06, bevelSize: CELL * 0.045, bevelSegments: 2, curveSegments: 1 });
  geo.translate(0, 0, -DEPTH / 2); geo.computeVertexNormals();
  const mat = new MeshPhysicalMaterial({
    color: 0xd6f2ff, metalness: 0, roughness: 0.05, transmission: 1, thickness: 0.45, ior: 1.52,
    attenuationColor: new Color('#6fd0ff'), attenuationDistance: 0.85, clearcoat: 1, clearcoatRoughness: 0.03,
    specularIntensity: 1, specularColor: new Color('#e6f6ff'), envMapIntensity: 2.4, iridescence: 0.35, iridescenceIOR: 1.3,
    emissive: new Color('#1a7fc4'), emissiveIntensity: 0.1,
  });
  const pieces = []; const r = rng(77), dummy = new Object3D(), off = (N - 1) / 2;
  cells.forEach((c) => { const k = Math.floor(r() * 4); pieces.push({ c, rz: k * Math.PI / 2 }, { c, rz: (k + 2) * Math.PI / 2 }); });
  const mesh = new InstancedMesh(geo, mat, pieces.length);
  const depthOf = {};
  const P = pieces.map(({ c, rz }, i) => {
    const key = c.x + ',' + c.y; if (!(key in depthOf)) depthOf[key] = c.finder ? 1.25 : 0.75 + r() * 0.7;   // beide helften even dik
    const depth = depthOf[key];
    const home = new Vector3((c.x - off) * CELL, (off - c.y) * CELL, (depth - 1) * DEPTH * 0.5);
    const dir = new Vector3(r() * 2 - 1, r() * 2 - 1, r() * 1.2 + 0.35).normalize();
    const col = ICE.clone().lerp(CYAN, c.finder ? 0.45 : 0.1 + r() * 0.45); mesh.setColorAt(i, col);
    return { home, depth, dir, dist: 1.1 + r() * 2.6, base: new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rz), spinAx: new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), spin: (r() * 2 - 1) * 2.0, phase: r() * 6.28,
      pos: home.clone(), vel: new Vector3(), rot: new Vector3(), rvel: new Vector3(), delay: 0, tilt: (r() - 0.5) * 0.06 };
  });
  const group = new Group(); group.add(mesh); scene.add(group);
  const write = () => {
    const q = new Quaternion(), e = new Euler();
    P.forEach((p, i) => { dummy.position.copy(p.pos); e.set(p.rot.x + p.tilt, p.rot.y, p.rot.z); q.setFromEuler(e); dummy.quaternion.copy(q).multiply(p.base); dummy.scale.set(1, 1, p.depth); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.instanceMatrix.needsUpdate = true;
  };
  write(); if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  // Stofjes in de lucht (zacht, additief)
  const NP = 420, pp = [], pr = rng(5);
  for (let i = 0; i < NP; i++) pp.push((pr() - 0.5) * 22, (pr() - 0.5) * 16, -5 + pr() * 9);
  const pgeo = new BufferGeometry(); pgeo.setAttribute('position', new Float32BufferAttribute(pp, 3));
  const pmat = new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime: { value: 0 }, uPr: { value: renderer.getPixelRatio() } },
    vertexShader: `uniform float uTime; uniform float uPr; varying float vA;
      void main(){ vec3 p = position; float s = fract(sin(dot(p.xy, vec2(12.9898,78.233))) * 43758.5453);
        p.y = mod(p.y + uTime * (0.10 + s * 0.18) + 8.0, 16.0) - 8.0; p.x += sin(uTime * 0.3 + s * 6.28) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (1.2 + s * 2.4) * uPr * (14.0 / -mv.z);
        vA = (0.25 + 0.6 * s) * smoothstep(8.0, 5.5, abs(p.y)); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.55, 0.85, 1.0, smoothstep(0.5, 0.0, d) * vA); }` });
  const dust = new Points(pgeo, pmat); scene.add(dust);

  /* ---------- Muis / aanraking ---------- */
  const ray = new Raycaster(), ndc = new Vector2(), plane = new Plane(), hit = new Vector3(), local = new Vector3(), nrm = new Vector3();
  const st = { over: false, down: false, local: new Vector2(99, 99), look: new Vector2(), lookNow: new Vector2(), burst: 0, releasedAt: -1, pressAt: 0, blast: new Vector2() };
  function toLocal(ev) {
    const b = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - b.left) / b.width) * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1);
    st.look.set(ndc.x, ndc.y);
    group.updateMatrixWorld(); nrm.set(0, 0, 1).applyQuaternion(group.quaternion); plane.setFromNormalAndCoplanarPoint(nrm, group.position);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) { local.copy(hit); group.worldToLocal(local); st.local.set(local.x, local.y); }
  }
  const onMove = (ev) => { st.over = true; toLocal(ev); };
  const onDown = (ev) => { if (ev.button !== undefined && ev.button !== 0) return; toLocal(ev); st.down = true; st.pressAt = clock; st.blast.copy(st.local); canvas.classList.add('grab'); try { canvas.setPointerCapture(ev.pointerId); } catch (e) {} };
  const onUp = () => { if (!st.down) return; st.down = false; st.releasedAt = clock; canvas.classList.remove('grab');
    const wrap = (a) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;      // zelfde stand, zonder extra rondjes terug
    P.forEach((p) => { p.delay = clock + 0.04 + Math.min(0.35, p.home.length() * 0.06); p.rot.set(wrap(p.rot.x), wrap(p.rot.y), wrap(p.rot.z)); }); };
  const onLeave = () => { st.over = false; st.local.set(99, 99); st.look.set(0, 0); };
  if (!calm) {
    canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onUp);
  }

  /* ---------- Grootte: sculptuur past altijd mooi in het vlak ---------- */
  const SIZE = N * CELL;
  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h;
    const fill = 0.6, vfov = camera.fov * Math.PI / 180, need = SIZE / fill;
    const distH = need / 2 / Math.tan(vfov / 2), distW = need / camera.aspect / 2 / Math.tan(vfov / 2);
    camera.position.z = Math.max(distH, distW) + 1.5; camera.updateProjectionMatrix();
    const far = camera.position.z - glow.position.z, vh = 2 * Math.tan(vfov / 2) * far * 1.15;   // gloed altijd groter dan het beeld
    glow.scale.setScalar(Math.max(vh, vh * camera.aspect) / 26);
    render();                                                               // meteen een scherp beeld in de nieuwe maat
  }
  const ro = window.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);

  /* ---------- Beweging (veren: voelt natuurlijk; geen vaste animatie) ---------- */
  let clock = 0, last = 0, raf = 0, burst = 0;
  const tgt = new Vector3(), rtgt = new Vector3(), tmp = new Vector3();
  function step(dt) {
    clock += dt;
    burst += ((st.down ? 1 : 0) - burst) * Math.min(1, dt * (st.down ? 3.2 : 2.2));      // 0 = heel, 1 = uit elkaar
    // De hele sculptuur zweeft en kijkt een beetje mee met de muis
    st.lookNow.lerp(st.look, Math.min(1, dt * 2.5));
    group.position.y = Math.sin(clock * 0.55) * 0.12;
    group.rotation.y = Math.sin(clock * 0.21) * 0.16 + st.lookNow.x * 0.28;
    group.rotation.x = Math.sin(clock * 0.17) * 0.06 - st.lookNow.y * 0.2;
    rimA.position.set(Math.cos(clock * 0.4) * 7, Math.sin(clock * 0.3) * 4 + 2, 5); rimB.position.set(Math.cos(clock * 0.35 + 3) * 7, Math.sin(clock * 0.27 + 2) * 4 - 2, 4);
    const R = 1.6, apart = st.down;
    P.forEach((p) => {
      tgt.copy(p.home); rtgt.set(0, 0, 0);
      // muis in de buurt: naar voren + kantelen
      const dx = p.home.x - st.local.x, dy = p.home.y - st.local.y, d = Math.hypot(dx, dy);
      if (!apart && d < R) { const k = Math.pow(1 - d / R, 2); tgt.z += k * 0.9; tgt.x += dx / (d + 1e-3) * k * 0.12; tgt.y += dy / (d + 1e-3) * k * 0.12; rtgt.set(-dy * k * 0.9, dx * k * 0.9, 0); }
      // uit elkaar: wegvliegen vanaf het klikpunt, langzaam blijven draaien en zweven
      if (apart || burst > 0.02) {
        const bx = p.home.x - st.blast.x, by = p.home.y - st.blast.y, bd = Math.hypot(bx, by) + 0.4;
        tmp.set(bx / bd, by / bd, 0).multiplyScalar(0.9).add(p.dir).normalize();
        const far = p.dist * (0.55 + 0.7 / bd) * burst;
        tgt.addScaledVector(tmp, far); tgt.y += Math.sin(clock * 0.8 + p.phase) * 0.25 * burst; tgt.x += Math.cos(clock * 0.6 + p.phase) * 0.18 * burst;
        rtgt.addScaledVector(p.spinAx, (p.spin * (clock - st.pressAt) + p.phase) * burst);
      }
      const back = !apart && clock < p.delay;                                // na loslaten: kleine golf terug (vanuit het midden)
      const k = apart ? 14 : back ? 6 : 34, c = apart ? 4.2 : back ? 4 : 7.2;
      p.vel.x += ((tgt.x - p.pos.x) * k - p.vel.x * c) * dt; p.vel.y += ((tgt.y - p.pos.y) * k - p.vel.y * c) * dt; p.vel.z += ((tgt.z - p.pos.z) * k - p.vel.z * c) * dt;
      p.pos.addScaledVector(p.vel, dt);
      const kr = apart ? 10 : 26, cr = apart ? 3.5 : 6.5;
      p.rvel.x += ((rtgt.x - p.rot.x) * kr - p.rvel.x * cr) * dt; p.rvel.y += ((rtgt.y - p.rot.y) * kr - p.rvel.y * cr) * dt; p.rvel.z += ((rtgt.z - p.rot.z) * kr - p.rvel.z * cr) * dt;
      p.rot.addScaledVector(p.rvel, dt);
    });
    write();
    pmat.uniforms.uTime.value = clock;
  }
  function render() { renderer.render(scene, camera); }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60); last = now;
    for (let i = 0; i < 2; i++) step(dt / 2);                               // twee kleine stappen: stabielere veren
    render();
  }
  resize();
  if (calm) { group.rotation.set(-0.08, 0.18, 0); render(); } else raf = requestAnimationFrame(loop);

  S = {
    // Alleen voor tests (zonder grafische kaart): animatie stilzetten, handmatig stappen en één beeld tekenen
    test(cmd) { if (cmd.pause) { cancelAnimationFrame(raf); raf = 0; } if (cmd.pointer) { const ev = { clientX: cmd.pointer[0], clientY: cmd.pointer[1], button: 0, pointerId: 1 }; if (cmd.down) onDown(ev); else onMove(ev); }
      if (cmd.up) onUp(); for (let i = 0; i < (cmd.steps || 0); i++) step(1 / 60); render(); },
    stop() {
    cancelAnimationFrame(raf); if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('pointerleave', onLeave); window.removeEventListener('blur', onUp);
    geo.dispose(); mat.dispose(); mesh.dispose(); pgeo.dispose(); pmat.dispose(); glow.geometry.dispose(); glow.material.dispose(); glowTex.dispose(); envRT.dispose();
    renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
  } };
  return true;
}
function stop() { if (S) { S.stop(); S = null; } }

window.LoginScene = { start, stop, test: (cmd) => S && S.test(cmd || {}) };
