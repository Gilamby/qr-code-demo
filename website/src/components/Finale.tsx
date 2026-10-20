'use client'
import { useEffect, useRef, useState } from 'react'
import { matrix } from '@/lib/qr'
import { LogoMark } from './QR'
import Icon from './icons'

/* Hoofdstuk 07, de afsluiter. Scrollen bestuurt het verhaal:
   alles valt uiteen in duizenden gekleurde blokjes → ze komen één voor één terug (snap) → een perfecte QR-code
   → die vormt zich om tot het Optimasys-logo → naam, belofte en de twee knoppen. */
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#000" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22v-7a7 7 0 0 1 7-7h7M42 8h7a7 7 0 0 1 7 7v7M56 42v7a7 7 0 0 1-7 7h-7M22 56h-7a7 7 0 0 1-7-7v-7"/><rect x="22.5" y="22.5" width="19" height="19" rx="5" stroke-width="5" transform="rotate(45 32 32)"/></g><rect x="28.5" y="28.5" width="7" height="7" rx="1.8" fill="#000" transform="rotate(45 32 32)"/></svg>'

export default function Finale({ url, title, text, cta, cta2, note, signup, login }: { url: string; title: string; text: string; cta: string; cta2: string; note: string; signup: string; login: string }) {
  const sec = useRef<HTMLElement>(null), cv = useRef<HTMLCanvasElement>(null)
  const [p, setP] = useState(0)
  const [still, setStill] = useState(false)

  useEffect(() => {
    const el = sec.current!, canvas = cv.current!, ctx = canvas.getContext('2d')!
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setStill(true); return }
    const m = matrix(url, 'M'), S = m.size
    const qr: [number, number][] = [...m.dark]
    m.finders.forEach(([fx, fy]) => { for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (x === 0 || y === 0 || x === 6 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) qr.push([fx + x, fy + y]) })
    // logo omzetten naar blokjes (zelfde raster)
    let logo: [number, number][] = []
    const img = new Image()
    img.onload = () => {
      const o = document.createElement('canvas'); o.width = o.height = S; const c = o.getContext('2d')!
      c.drawImage(img, 0, 0, S, S); const d = c.getImageData(0, 0, S, S).data
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 100) logo.push([x, y])
      assignLogo()
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO)
    const pal = ['#f97316', '#a78bfa', '#38bdf8', '#a3e635', '#f43f5e', '#facc15', '#e8edf3']
    const P = qr.map(([x, y], i) => {
      const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 0.9
      return { qx: x + 0.5, qy: y + 0.5, ex: Math.cos(a) * r, ey: Math.sin(a) * r, spin: (Math.random() - 0.5) * 6, lx: x + 0.5, ly: y + 0.5, la: 0, col: pal[i % pal.length], d: Math.random() }
    })
    function assignLogo() {
      const sorted = [...logo].sort((a, b) => Math.atan2(a[1] - S / 2, a[0] - S / 2) - Math.atan2(b[1] - S / 2, b[0] - S / 2))
      const order = P.map((_, i) => i).sort((a, b) => Math.atan2(P[a].qy - S / 2, P[a].qx - S / 2) - Math.atan2(P[b].qy - S / 2, P[b].qx - S / 2))
      order.forEach((pi, j) => {
        const c = sorted[Math.floor((j / order.length) * sorted.length)] || [S / 2, S / 2]
        P[pi].lx = c[0] + 0.5; P[pi].ly = c[1] + 0.5; P[pi].la = j < sorted.length * 1.6 ? 1 : 0.25
      })
    }
    let w = 0, h = 0, dpr = 1, raf = 0, shown = 0, visible = false
    const resize = () => { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); w = r.width; h = r.height; canvas.width = w * dpr; canvas.height = h * dpr }
    const prog = () => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.top / (r.height - innerHeight))) }
    const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
    const draw = () => {
      const target = prog(); shown += (target - shown) * 0.1; setP(shown)
      const t = performance.now() / 1000
      const explode = sm(0.04, 0.24, shown), back = sm(0.28, 0.62, shown), toLogo = sm(0.66, 0.82, shown)
      const size = Math.min(w, h) * (0.62 - toLogo * 0.36), unit = size / S
      const ox = (w - size) / 2, oy = (h - size) / 2 - toLogo * h * 0.2
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h)
      for (const q of P) {
        const b = Math.min(1, Math.max(0, back * 1.7 - q.d * 0.7)), be = b * b * (3 - 2 * b)   // elk blokje zijn eigen "snap"-moment
        const out = explode * (1 - be)
        // uit elkaar: ver weg over het hele scherm, zwevend
        const fx = q.ex * w * 0.75 + Math.sin(t * 0.6 + q.d * 9) * 14, fy = q.ey * h * 0.75 + Math.cos(t * 0.5 + q.d * 7) * 14
        const qx = ox + q.qx * unit, qy = oy + q.qy * unit
        const lx = ox + q.lx * unit, ly = oy + q.ly * unit
        let x = qx + fx * out, y = qy + fy * out
        x += (lx - x) * toLogo; y += (ly - y) * toLogo
        const s = unit * (0.9 - out * 0.2) * (toLogo > 0 ? 1 - toLogo * (1 - q.la) : 1)
        if (s < 0.3) continue
        const snapped = out < 0.02
        ctx.save(); ctx.translate(x, y); ctx.rotate(q.spin * out)
        ctx.fillStyle = toLogo > 0.4 ? (q.qx < S / 2 ? '#22d3ee' : '#2563eb') : snapped ? '#f3f5f8' : q.col
        ctx.globalAlpha = 0.5 + 0.5 * (1 - out * 0.4)
        ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, s * (0.2 + out * 0.3 + toLogo * 0.3)); ctx.fill(); ctx.restore()
      }
      ctx.globalAlpha = 1
      if (visible) raf = requestAnimationFrame(draw)
    }
    resize()
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; cancelAnimationFrame(raf); if (visible) raf = requestAnimationFrame(draw) })
    io.observe(el); window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', resize) }
  }, [url])

  const showBrand = still || p > 0.8
  return (
    <section ref={sec} className={'finale' + (still ? ' finale-still' : '')} id="start">
      <div className="finale-sticky">
        {!still && <canvas ref={cv} className="finale-canvas" aria-hidden="true" />}
        <div className={'finale-brand' + (showBrand ? ' on' : '')}>
          {still && <LogoMark size={96} id="fin" />}
          <h2 className="finale-title">{title}</h2>
          <p className="finale-text">{text}</p>
          <div className="finale-ctas">
            <a className="btn btn-primary btn-lg" href={signup} tabIndex={showBrand ? 0 : -1}>{cta} <Icon name="arrow" size={20} /></a>
            <a className="btn btn-ghost btn-lg" href={login} tabIndex={showBrand ? 0 : -1}>{cta2} →</a>
          </div>
          <p className="small muted">{note}</p>
        </div>
      </div>
    </section>
  )
}
