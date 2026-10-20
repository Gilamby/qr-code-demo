'use client'
import { useEffect, useRef } from 'react'
import { matrix } from '@/lib/qr'

/* Hoofdstuk 05 "Van chaos naar structuur": blokjes zweven los rond; de muis is een magneet
   (dichtbij trekt hij aan en laat ze om zich heen draaien, heel dichtbij duwt hij weg).
   Zodra het in beeld is, klikken ze één voor één op hun plek tot een perfecte QR-code. */
export default function Magnet({ url, label }: { url: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext('2d')!
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const m = matrix(url, 'M'), S = m.size
    const cells: [number, number][] = [...m.dark]
    m.finders.forEach(([fx, fy]) => { for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (x === 0 || y === 0 || x === 6 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) cells.push([fx + x, fy + y]) })
    const pal = ['#f97316', '#a78bfa', '#38bdf8', '#a3e635', '#f43f5e', '#facc15']
    const P = cells.map(([x, y], i) => ({
      tx: x + 0.5, ty: y + 0.5, x: Math.random() * (S + 16) - 8, y: Math.random() * (S + 16) - 8, vx: 0, vy: 0,
      delay: (Math.hypot(x - S / 2, y - S / 2) / S) * 1.6 + Math.random() * 0.9, hue: pal[i % pal.length], snapped: 0,
    }))
    let w = 0, dpr = 1, raf = 0, visible = false, since = 0, mx = -999, my = -999, last = 0
    const resize = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); w = r.width; cv.width = w * dpr; cv.height = w * dpr; if (still) requestAnimationFrame(draw) }
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now
      if (visible) since += dt
      const unit = w / (S + 4)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, w)
      for (const p of P) {
        const on = still || since > p.delay
        let ax = 0, ay = 0
        if (on) { ax = (p.tx - p.x) * 0.09; ay = (p.ty - p.y) * 0.09 }
        else { ax = Math.sin(now / 900 + p.delay * 9) * 0.02; ay = Math.cos(now / 1100 + p.delay * 7) * 0.02 }
        const dx = mx - p.x, dy = my - p.y, d = Math.hypot(dx, dy)
        if (d < 7 && d > 0.01) {
          const f = d < 2.2 ? -0.5 / d : 0.12 / d                      // te dichtbij: wegduwen, anders aantrekken + draaien
          ax += dx * f + (-dy / d) * 0.08; ay += dy * f + (dx / d) * 0.08
        }
        p.vx = (p.vx + ax) * (on ? 0.72 : 0.94); p.vy = (p.vy + ay) * (on ? 0.72 : 0.94)
        if (still) { p.x = p.tx; p.y = p.ty } else { p.x += p.vx; p.y += p.vy }
        const near = Math.hypot(p.tx - p.x, p.ty - p.y) < 0.08
        p.snapped += ((near ? 1 : 0) - p.snapped) * 0.15
        const s = unit * (0.62 + p.snapped * 0.3)
        ctx.fillStyle = p.snapped > 0.6 ? '#0b0e13' : p.hue
        ctx.globalAlpha = 0.6 + p.snapped * 0.4
        ctx.beginPath(); ctx.roundRect((p.x + 2) * unit - s / 2, (p.y + 2) * unit - s / 2, s, s, s * (0.5 - p.snapped * 0.32)); ctx.fill()
      }
      ctx.globalAlpha = 1
      if (visible && !still) raf = requestAnimationFrame(draw)
    }
    const move = (e: PointerEvent) => { const r = cv.getBoundingClientRect(), unit = r.width / (S + 4); mx = (e.clientX - r.left) / unit - 2; my = (e.clientY - r.top) / unit - 2 }
    const leave = () => { mx = my = -999 }
    resize()
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && e.intersectionRatio > 0.35; cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(draw) }, { threshold: [0, 0.35, 0.6] })
    io.observe(cv)
    cv.addEventListener('pointermove', move); cv.addEventListener('pointerleave', leave); window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(raf); io.disconnect(); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerleave', leave); window.removeEventListener('resize', resize) }
  }, [url])
  return <canvas ref={ref} className="magnet-canvas" role="img" aria-label={label} />
}
