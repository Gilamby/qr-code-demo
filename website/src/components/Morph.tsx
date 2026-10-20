'use client'
import { useEffect, useRef, useState } from 'react'
import { matrix } from '@/lib/qr'
import Icon from './icons'

type Item = { key: string; title: string; text?: string }

/* Hoofdstuk 02: de blokjes van een QR-code bouwen zichzelf om tot wat de code opent.
   Elk blokje is een "deeltje" met een veer naar zijn doel: dat geeft een fysiek gevoel in plaats van een overgang. */
const G = 29
type Shape = (u: number, v: number) => boolean          // u,v van -1 tot 1
const ring = (u: number, v: number, r: number, w: number) => Math.abs(Math.hypot(u, v) - r) < w
const box = (u: number, v: number, x0: number, y0: number, x1: number, y1: number) => u >= x0 && u <= x1 && v >= y0 && v <= y1
const SHAPES: Record<string, Shape> = {
  website: (u, v) => {
    const frame = box(u, v, -0.9, -0.72, 0.9, 0.72) && !box(u, v, -0.82, -0.64, 0.82, 0.46)
    const bar = box(u, v, -0.9, -0.72, 0.9, -0.5)
    const lines = box(u, v, -0.68, -0.3, 0.3, -0.22) || box(u, v, -0.68, -0.08, 0.6, 0) || box(u, v, -0.68, 0.14, 0.1, 0.22) || box(u, v, 0.32, 0.12, 0.68, 0.4)
    return frame || bar || lines
  },
  menu: (u, v) => ring(u, v, 0.5, 0.1) || ring(u, v, 0.28, 0.05)
    || box(u, v, -0.92, -0.75, -0.86, 0.85) || (box(u, v, -1, -0.75, -0.78, -0.25) && Math.round((u + 1) * 14) % 2 === 0)
    || box(u, v, 0.8, -0.75, 0.88, 0.85) || (box(u, v, 0.8, -0.75, 0.98, 0.0) && u - 0.8 < (0.0 - v) * 0.4 + 0.08),
  video: (u, v) => {
    const screen = box(u, v, -0.92, -0.66, 0.92, 0.46)
    const tri = u > -0.2 && u < 0.36 && Math.abs(v + 0.1) < (0.36 - u) * 0.66
    const bar = box(u, v, -0.92, 0.66, 0.92, 0.7) || Math.hypot(u + 0.2, v - 0.68) < 0.1
    return (screen && !tri) || bar
  },

  wifi: (u, v) => {
    const up = 0.72 - v, ang = Math.atan2(up, u)                       // vanaf het puntje onderaan, naar boven
    const cone = ang > Math.PI * 0.24 && ang < Math.PI * 0.76
    return (cone && (ring(u, up, 0.5, 0.09) || ring(u, up, 0.95, 0.09) || ring(u, up, 1.4, 0.09))) || Math.hypot(u, up) < 0.15
  },

  vcard: (u, v) => {
    const card = box(u, v, -0.95, -0.62, 0.95, 0.62) && !box(u, v, -0.87, -0.54, 0.87, 0.54)
    const head = Math.hypot(u + 0.45, v + 0.12) < 0.18, body = Math.hypot(u + 0.45, v - 0.42) < 0.3 && v < 0.5
    const lines = box(u, v, 0.05, -0.2, 0.7, -0.12) || box(u, v, 0.05, 0.02, 0.6, 0.1) || box(u, v, 0.05, 0.24, 0.45, 0.32)
    return card || head || body || lines
  },
  social: (u, v) => {
    const X = u * 1.15, Y = -v * 1.15 + 0.2
    return Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y <= 0
  },
}
const COLORS: Record<string, [string, string]> = {
  qr: ['#f3f5f8', '#f3f5f8'], website: ['#38bdf8', '#2563eb'], menu: ['#ffb36b', '#ff6a3d'], video: ['#ff6b8a', '#e11d48'],
  wifi: ['#bef264', '#22c55e'], vcard: ['#f5f5f4', '#a8a29e'], social: ['#c4b5fd', '#ec4899'],
}

export default function Morph({ items, cta, signup, url }: { items: Item[]; cta: string; signup: string; url: string }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const [cur, setCur] = useState<string>('qr')
  const curRef = useRef('qr'), touched = useRef(false), redraw = useRef<() => void>(() => {})
  useEffect(() => { curRef.current = cur; redraw.current() }, [cur])

  useEffect(() => {
    const canvas = cv.current!, ctx = canvas.getContext('2d')!
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const m = matrix(url, 'M')
    const qrCells: [number, number][] = [...m.dark]
    m.finders.forEach(([fx, fy]) => { for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) { if (x === 0 || y === 0 || x === 6 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) qrCells.push([fx + x, fy + y]) } })
    const S = m.size
    const cellsFor = (key: string): [number, number][] => {
      if (key === 'qr') return qrCells.map(([x, y]) => [((x + 0.5) / S) * G, ((y + 0.5) / S) * G])
      const f = SHAPES[key], out: [number, number][] = []
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { const u = ((x + 0.5) / G) * 2 - 1, v = ((y + 0.5) / G) * 2 - 1; if (f(u, v)) out.push([x + 0.5, y + 0.5]) }
      return out
    }
    // genoeg deeltjes voor de grootste vorm (bij de QR-code zijn de extra deeltjes onzichtbaar)
    const n = Math.max(qrCells.length, ...['qr', ...Object.keys(SHAPES)].map((k) => cellsFor(k).length))
    const P = Array.from({ length: n }, () => ({ x: Math.random() * G, y: Math.random() * G, vx: 0, vy: 0, tx: 0, ty: 0, a: 1, ta: 1, s: 1 }))
    let shapeKey = '', raf = 0, w = 0, dpr = 1, mx = -99, my = -99, visible = false
    const setShape = (key: string) => {
      shapeKey = key
      const cells = cellsFor(key)
      // gelijkmatig verdelen: elk deeltje een doel; overgebleven deeltjes worden onzichtbaar stof erachter
      const order = P.map((_, i) => i).sort((a, b) => Math.atan2(P[a].y - G / 2, P[a].x - G / 2) - Math.atan2(P[b].y - G / 2, P[b].x - G / 2))
      const sorted = [...cells].sort((a, b) => Math.atan2(a[1] - G / 2, a[0] - G / 2) - Math.atan2(b[1] - G / 2, b[0] - G / 2))
      order.forEach((pi, j) => {
        const p = P[pi]
        if (j < sorted.length) { p.tx = sorted[j][0]; p.ty = sorted[j][1]; p.ta = 1 }
        else { const c = sorted[j % sorted.length]; p.tx = c[0] + (Math.random() - 0.5) * 0.4; p.ty = c[1] + (Math.random() - 0.5) * 0.4; p.ta = 0 }
        if (!still) { p.vx += (Math.random() - 0.5) * 1.6; p.vy += (Math.random() - 0.5) * 1.6 }   // kleine "plof" bij het wisselen
      })
    }
    const resize = () => { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); w = r.width; canvas.width = w * dpr; canvas.height = w * dpr; if (still) draw() }
    const draw = () => {
      if (curRef.current !== shapeKey) setShape(curRef.current)
      const unit = w / (G + 2), col = COLORS[shapeKey] || COLORS.qr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, w)
      const grad = ctx.createLinearGradient(0, 0, w, w); grad.addColorStop(0, col[0]); grad.addColorStop(1, col[1])
      ctx.fillStyle = grad
      for (const p of P) {
        // veer naar het doel + een beetje afstoting van de muis
        let ax = (p.tx - p.x) * 0.06, ay = (p.ty - p.y) * 0.06
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy
        if (d2 < 9) { const f = (9 - d2) * 0.02; ax += dx * f; ay += dy * f }
        p.vx = (p.vx + ax) * 0.8; p.vy = (p.vy + ay) * 0.8
        if (still) { p.x = p.tx; p.y = p.ty; p.a = p.ta } else { p.x += p.vx; p.y += p.vy; p.a += (p.ta - p.a) * 0.12 }
        if (p.a < 0.02) continue
        const sp = Math.min(1, Math.hypot(p.vx, p.vy) * 2), s = unit * (0.86 - sp * 0.25) * (0.4 + p.a * 0.6)
        ctx.globalAlpha = p.a
        ctx.beginPath(); ctx.roundRect((p.x + 1) * unit - s / 2, (p.y + 1) * unit - s / 2, s, s, s * (shapeKey === 'qr' ? 0.18 : 0.5)); ctx.fill()
      }
      ctx.globalAlpha = 1
      if (visible && !still) raf = requestAnimationFrame(draw)
    }
    const move = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(), unit = r.width / (G + 2); mx = (e.clientX - r.left) / unit - 1; my = (e.clientY - r.top) / unit - 1 }
    const leave = () => { mx = my = -99 }
    redraw.current = () => { if (still) draw() }
    resize(); setShape('qr')
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; cancelAnimationFrame(raf); if (visible) raf = requestAnimationFrame(draw); else if (still) draw() })
    io.observe(canvas); draw()
    canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', leave); window.addEventListener('resize', resize)
    // vanzelf door de soorten lopen tot iemand zelf kiest
    const keys = ['qr', ...items.map((x) => x.key)]
    const auto = setInterval(() => { if (!touched.current && visible && !still) setCur((k) => keys[(keys.indexOf(k) + 1) % keys.length]) }, 2600)
    return () => { cancelAnimationFrame(raf); io.disconnect(); clearInterval(auto); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave); window.removeEventListener('resize', resize) }
  }, [url, items])

  const pick = (k: string) => { touched.current = true; setCur(k) }
  const sel = items.find((x) => x.key === cur)
  return (
    <div className="morph">
      <div className={'morph-stage c-' + cur}>
        <canvas ref={cv} className="morph-canvas" role="img" aria-label={sel ? sel.title : 'QR code'} />
      </div>
      <div className="morph-side">
        <div className="morph-tabs" role="tablist" aria-label="QR types">
          <button type="button" role="tab" aria-selected={cur === 'qr'} className={cur === 'qr' ? 'on' : ''} onClick={() => pick('qr')}>QR</button>
          {items.map((it) => (
            <button key={it.key} type="button" role="tab" aria-selected={cur === it.key} className={'c-' + it.key + (cur === it.key ? ' on' : '')} onClick={() => pick(it.key)}>
              <Icon name={it.key} size={18} />{it.title}
            </button>
          ))}
        </div>
        <div className="morph-info" aria-live="polite">
          {sel ? (<><h3>{sel.title}</h3><p>{sel.text}</p><a className="btn btn-light" href={signup}>{cta} <Icon name="arrow" size={18} /></a></>)
            : (<><h3>QR</h3><p>{items.map((x) => x.title).join(' · ')}</p></>)}
        </div>
      </div>
    </div>
  )
}
