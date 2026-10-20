/* Vormen voor de "QR-wereld": elke wijk is een stapel blokjes (voxels) die iets voorstelt
   dat je met de app kunt maken. Coördinaten in blokjes; y = hoogte boven de grond. */
export type V = [number, number, number]
export type District = { key: string; color: string; voxels: V[]; label: V }

/** Vlak (x,y) rechtop, naar het midden gedraaid en op de cirkel gezet */
function place(local: V[], angle: number, radius: number): V[] {
  const c = Math.cos(angle), s = Math.sin(angle)
  // plek op de cirkel P; de voorkant (lokale +z) kijkt naar buiten, naar de camera die eromheen draait
  return local.map(([x, y, z]) => {
    const wx = radius * c + x * s + z * c, wz = radius * s - x * c + z * s
    return [wx, y, wz] as V
  })
}

function rect(x0: number, y0: number, w: number, h: number, z = 0, fill = true): V[] {
  const out: V[] = []
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++)
    if (fill || x === 0 || y === 0 || x === w - 1 || y === h - 1) out.push([x0 + x, y0 + y, z])
  return out
}

function website(): V[] {
  const w = 17, h = 12, x0 = -8
  const v: V[] = rect(x0, 1, w, h, 0, false)                          // venster
  v.push(...rect(x0 + 1, h - 1, w - 2, 1))                             // titelbalk
  for (const x of [1, 3, 5]) v.push([x0 + x, h - 1, 1])                // drie knopjes (iets naar voren)
  v.push(...rect(x0 + 2, h - 4, 9, 1, 0.5), ...rect(x0 + 2, h - 6, 12, 1, 0.5), ...rect(x0 + 2, h - 7, 10, 1, 0.5))   // tekstregels
  v.push(...rect(x0 + 2, 3, 6, 3, 0.5), ...rect(x0 + 9, 3, 6, 3, 0.5))                                               // twee kaarten
  for (let y = 0; y < 1; y++) v.push([0, y, 0])
  return v
}

function menu(): V[] {
  const v: V[] = []
  for (let x = -5; x <= 5; x++) for (let z = -3; z <= 3; z++) v.push([x, 4, z])          // tafelblad
  for (const [x, z] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) for (let y = 0; y < 4; y++) v.push([x, y, z])   // poten
  v.push(...rect(-2, 5, 4, 6, 0).map(([x, y]) => [x, y, -1] as V))   // menukaartje op tafel
  v.push([-4, 5, 1], [-3, 5, 1], [3, 5, 1], [4, 5, 1], [4, 5, 2], [-4, 5, 2])            // borden
  return v
}

function video(): V[] {
  const v: V[] = [], w = 18, h = 11, x0 = -9, y0 = 2
  const inTri = (x: number, y: number) => { const cx = x - (x0 + 7), cy = y - (y0 + h / 2 - 0.5); return cx >= 0 && cx <= 5 && Math.abs(cy) <= (5 - cx) * 0.62 }
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { const X = x0 + x, Y = y0 + y; if (!inTri(X, Y)) v.push([X, Y, 0]) }
  for (let y = 0; y < y0; y++) v.push([-1, y, 0], [0, y, 0])            // voet
  return v
}
function videoAccent(): V[] {
  const v: V[] = [], x0 = -9, y0 = 2, h = 11
  for (let x = 0; x <= 5; x++) for (let y = -3; y <= 3; y++) if (Math.abs(y) <= (5 - x) * 0.62) v.push([x0 + 7 + x, y0 + h / 2 - 0.5 + y, 0.6])
  return v
}

function wifi(): V[] {
  const v: V[] = []
  for (const r of [3, 6.5, 10]) for (let a = Math.PI * 0.22; a <= Math.PI * 0.78; a += 0.9 / r) v.push([Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r) + 1, 0])
  v.push([0, 1, 0], [0, 2, 0], [-1, 1, 0], [1, 1, 0])
  const seen = new Set<string>(); return v.filter((p) => { const k = p.join(); if (seen.has(k)) return false; seen.add(k); return true })
}

function social(): V[] {
  const v: V[] = []
  // hartje in een rechtop vlak
  for (let x = -7; x <= 7; x++) for (let y = -7; y <= 6; y++) {
    const X = x / 6.5, Y = y / 6.5 + 0.15
    const f = Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y
    if (f <= 0) v.push([x, y + 9, 0])
  }
  for (let y = 0; y < 3; y++) v.push([0, y, 0])
  return v
}

export const DISTRICTS = [
  { key: 'website', color: '#38bdf8', make: website, accent: null as null | (() => V[]) },
  { key: 'menu', color: '#ff8a3d', make: menu, accent: null },
  { key: 'video', color: '#ff4d6d', make: video, accent: videoAccent },
  { key: 'wifi', color: '#a3e635', make: wifi, accent: null },
  { key: 'social', color: '#a78bfa', make: social, accent: null },
]

export function buildWorld(radius = 24) {
  const districts: District[] = []
  DISTRICTS.forEach((d, i) => {
    const angle = (i / DISTRICTS.length) * Math.PI * 2 + Math.PI / 2
    const vox = place(d.make(), angle, radius)
    const acc = d.accent ? place(d.accent(), angle, radius) : []
    const top = Math.max(...vox.map((p) => p[1]))
    const [cx, , cz] = place([[0, 0, 0]], angle, radius)[0]
    districts.push({ key: d.key, color: d.color, voxels: vox.concat(acc), label: [cx, top + 3, cz] })
  })
  return districts
}
