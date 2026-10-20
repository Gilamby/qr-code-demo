/* =========================================================
   DE DUIK (Three.js). Wordt pas geladen als het hoofdstuk bijna in beeld is.
   Scrollen (0 → 1) bestuurt de camera:
   0.00  plat veld van QR-blokjes, recht van boven (in het midden een echte, scanbare code)
   0.15  de blokjes krijgen diepte, ze gaan op en neer
   0.40  de camera duikt tussen de blokjes door
   0.58  de blokjes vliegen naar hun plek in de "QR-wereld": vijf wijken (website, menu, video, wifi, social)
   0.80  rondkijken in de wereld (slepen met de muis), labels worden klikbaar
   ========================================================= */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { matrix } from '@/lib/qr'
import { buildWorld, type V } from './world'

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t

export type Engine = { setProgress(p: number): void; setActive(on: boolean): void; labels(): { key: string; x: number; y: number; visible: boolean; front: number }[]; dispose(): void; drag(dx: number): void }

export function createEngine(canvas: HTMLCanvasElement, opts: { url: string; mobile: boolean }): Engine {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.mobile, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(opts.mobile ? 1.5 : 2, devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const scene = new THREE.Scene()
  const bg = new THREE.Color('#05070a')
  scene.background = bg
  scene.fog = new THREE.Fog(bg, 40, 130)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400)

  scene.add(new THREE.HemisphereLight('#dfe8ff', '#0b0d12', 0.9))
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(-30, 60, 25); scene.add(key)
  const warm = new THREE.PointLight('#ff8a3d', 0, 120, 1.6); warm.position.set(0, 18, 0); scene.add(warm)
  const rim = new THREE.DirectionalLight('#7dd3fc', 0.8); rim.position.set(40, 20, -40); scene.add(rim)

  /* ---------- het veld ---------- */
  const N = opts.mobile ? 57 : 85
  const qr = matrix(opts.url, 'M')
  const Q = qr.size, off = Math.floor((N - Q) / 2)
  const qrSet = new Set<string>()
  qr.dark.forEach(([x, y]) => qrSet.add(x + ',' + y))
  qr.finders.forEach(([fx, fy]) => { for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) { const ring = x === 0 || y === 0 || x === 6 || y === 6, core = x >= 2 && x <= 4 && y >= 2 && y <= 4; if (ring || core) qrSet.add(fx + x + ',' + (fy + y)) } })
  const rnd = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v) }

  type Cell = { x: number; z: number; inQr: boolean; d: number; h: number; ph: number }
  const cells: Cell[] = []
  for (let gx = 0; gx < N; gx++) for (let gz = 0; gz < N; gz++) {
    const qx = gx - off, qz = gz - off
    const inside = qx >= -1 && qz >= -1 && qx <= Q && qz <= Q
    const isQr = inside && qrSet.has(qx + ',' + qz)
    if (inside ? !isQr : rnd(gx, gz) > 0.44) continue
    const x = gx - N / 2 + 0.5, z = gz - N / 2 + 0.5
    cells.push({ x, z, inQr: isQr, d: Math.hypot(x, z) / (N * 0.7), h: 0.6 + rnd(gz, gx) * 5.5, ph: rnd(gx * 3, gz) * Math.PI * 2 })
  }

  /* ---------- de wereld: doelen voor elk blokje ---------- */
  const districts = buildWorld(opts.mobile ? 20 : 24)
  type Target = { p: V; color: THREE.Color; s: number }
  const targets: Target[] = []
  districts.forEach((d) => d.voxels.forEach((p) => targets.push({ p, color: new THREE.Color(d.color), s: 0.92 })))
  const plaza = new THREE.Color('#1a2130'), floatC = new THREE.Color('#e8edf3')
  // de rest: een plein van paden in ringen, en een paar zwevende blokjes
  let k = 0
  while (targets.length < cells.length) {
    k++
    if (k % 7 === 0) {
      const a = rnd(k, 3) * Math.PI * 2, r = 6 + rnd(k, 9) * 40
      targets.push({ p: [Math.cos(a) * r, 6 + rnd(k, 5) * 22, Math.sin(a) * r], color: floatC, s: 0.25 + rnd(k, 7) * 0.35 })
    } else {
      const ring = [8, 14, 32, 38][k % 4], a = rnd(k, 1) * Math.PI * 2
      targets.push({ p: [Math.round(Math.cos(a) * ring), -0.45, Math.round(Math.sin(a) * ring)], color: plaza, s: 0.9 })
    }
  }
  // dichtstbijzijnde blokjes gaan naar de wijken (korte, logische vluchten): sorteer beide op hoek
  const ang = (x: number, z: number) => Math.atan2(z, x)
  const order = cells.map((c, i) => i).sort((a, b) => ang(cells[a].x, cells[a].z) - ang(cells[b].x, cells[b].z))
  const torder = targets.map((t, i) => i).sort((a, b) => ang(targets[a].p[0], targets[a].p[2]) - ang(targets[b].p[0], targets[b].p[2]))
  const assign = new Array<number>(cells.length)
  order.forEach((ci, j) => { assign[ci] = torder[j] })

  /* ---------- blokjes (één InstancedMesh) ---------- */
  const geo = new RoundedBoxGeometry(1, 1, 1, 1, 0.12)
  geo.translate(0, 0.5, 0)                                            // onderkant op de grond
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.35 })
  const mesh = new THREE.InstancedMesh(geo, mat, cells.length)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  scene.add(mesh)
  const silver = new THREE.Color('#eef2f7'), steelNear = new THREE.Color('#3a4456'), steelFar = new THREE.Color('#141a24')
  const base: THREE.Color[] = cells.map((c) => c.inQr ? silver : steelNear.clone().lerp(steelFar, clamp(c.d * 1.4)))
  const tmpC = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), eul = new THREE.Euler()
  const stagger = cells.map((c, i) => rnd(i, 17) * 0.55 + c.d * 0.35)

  /* ---------- camera-route ---------- */
  const rect0 = canvas.getBoundingClientRect(), R = rect0.width < rect0.height ? 96 : 62   // staand scherm: verder weg
  type Key = { p: number; pos: [number, number, number]; look: [number, number, number] }
  const route: Key[] = [
    { p: 0.0, pos: [0, opts.mobile ? 95 : 72, 0.01], look: [0, 0, 0] },
    { p: 0.16, pos: [0, 52, 24], look: [0, 0, 0] },
    { p: 0.34, pos: [10, 14, 26], look: [0, 2, 0] },
    { p: 0.48, pos: [3, 2.2, 7], look: [-7, 3, -16] },
    { p: 0.58, pos: [-6, 3.5, -6], look: [-14, 5, -26] },
    { p: 0.76, pos: [0, 30, R], look: [0, 6, 0] },
  ]
  const lerp3 = (a: number[], b: number[], t: number) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]
  function camAt(p: number) {
    if (p >= 0.76) return null
    let i = 0; while (i < route.length - 2 && p > route[i + 1].p) i++
    const A = route[i], B = route[i + 1], t = smooth(A.p, B.p, p)
    return { pos: lerp3(A.pos, B.pos, t), look: lerp3(A.look, B.look, t) }
  }

  let target = 0, shown = 0, yaw = 0, yawT = 0, raf = 0, running = true, w = 0, h = 0
  const t0 = performance.now()
  const size = () => {
    const r = canvas.getBoundingClientRect(); w = r.width; h = r.height
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 58 : 40; camera.updateProjectionMatrix()
  }
  size(); window.addEventListener('resize', size)

  function frame() {
    if (!running) return
    shown += (target - shown) * ((window as any).__diveInstant ? 1 : 0.09)
    const p = shown, t = (performance.now() - t0) / 1000
    yaw += (yawT - yaw) * 0.08
    const rise = smooth(0.1, 0.42, p), morph = smooth(0.56, 0.8, p), world = smooth(0.74, 0.86, p)

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i], T = targets[assign[i]]
      const mi = clamp((morph * 1.9) - stagger[i])                     // eigen moment per blokje
      const e = mi * mi * (3 - 2 * mi)
      const wave = Math.sin(t * 0.9 + c.ph + c.x * 0.15) * 0.5 + 0.5
      const fh = 0.18 + rise * (c.inQr ? c.h * 0.6 + 1.2 : c.h) * (0.65 + 0.35 * wave)
      // vlucht: omhoog boog, dan naar de plek
      const arc = Math.sin(e * Math.PI) * (8 + c.d * 20)
      pos.set(mix(c.x, T.p[0], e), mix(0, T.p[1], e) + arc, mix(c.z, T.p[2], e))
      const sxz = mix(0.86, T.s, e), sy = mix(fh, T.s, e)
      scl.set(sxz, sy, sxz)
      eul.set(Math.sin(e * Math.PI) * 1.4 * (stagger[i] - 0.3), Math.sin(e * Math.PI) * 2 * stagger[i], 0)
      q.setFromEuler(eul)
      m4.compose(pos, q, scl); mesh.setMatrixAt(i, m4)
      tmpC.copy(base[i]).lerp(T.color, e)
      mesh.setColorAt(i, tmpC)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    warm.intensity = world * 900

    const cam = camAt(p)
    if (cam) {
      camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]); camera.lookAt(cam.look[0], cam.look[1], cam.look[2])
    } else {
      // rondkijken: scrollen draait langzaam rond, slepen draait mee
      const a = Math.PI / 2 + (p - 0.76) * Math.PI * 1.6 + yaw + Math.sin(t * 0.15) * 0.05
      const r = R
      camera.position.set(r * Math.cos(a), 30 - (p - 0.76) * 22, r * Math.sin(a))
      camera.lookAt(0, 6, 0)
    }
    renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  const v3 = new THREE.Vector3()
  return {
    setProgress(p) { target = clamp(p) },
    setActive(on) { if (on === running) return; running = on; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(frame) },
    drag(dx) { yawT += dx * 0.005 },
    labels() {
      const vis = shown > 0.8
      return districts.map((d) => {
        v3.set(d.label[0], d.label[1], d.label[2]); const camDist = camera.position.distanceTo(v3)
        v3.project(camera)
        return { key: d.key, x: (v3.x * 0.5 + 0.5) * w, y: (-v3.y * 0.5 + 0.5) * h, visible: vis && v3.z < 1, front: clamp(1.4 - camDist / 70) }
      })
    },
    dispose() { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', size); geo.dispose(); mat.dispose(); renderer.dispose() },
  }
}
