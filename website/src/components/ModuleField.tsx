'use client'
import { useEffect, useRef } from 'react'

/* Achtergrond: een raster van kleine QR-blokjes. Rond de muis lichten ze op en worden ze groter;
   af en toe loopt er een golf doorheen. Stil bij "minder beweging" en buiten beeld. */
export default function ModuleField() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext('2d')!
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true
    const gap = 22, mouse = { x: -999, y: -999, tx: -999, ty: -999 }
    const seed = (x: number, y: number) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v) }
    const resize = () => {
      const r = cv.parentElement!.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1)
      w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'
    }
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h)
      mouse.x += (mouse.tx - mouse.x) * 0.12; mouse.y += (mouse.ty - mouse.y) * 0.12
      const wave = ((t / 5200) % 1) * (w + h) * 1.2
      for (let gy = gap / 2; gy < h; gy += gap) for (let gx = gap / 2; gx < w; gx += gap) {
        const s = seed(gx, gy); if (s < 0.45) continue
        const d = Math.hypot(gx - mouse.x, gy - mouse.y), near = Math.max(0, 1 - d / 220)
        const wd = Math.abs(gx + gy - wave), wv = still ? 0 : Math.max(0, 1 - wd / 90) * 0.6
        const k = Math.max(near, wv)
        const size = 2 + k * 9 * s
        ctx.globalAlpha = 0.07 + k * 0.75
        ctx.fillStyle = k > 0.05 ? (gx / w > 0.5 ? '#2563eb' : '#22d3ee') : '#8fa3bf'
        ctx.beginPath(); ctx.roundRect(gx - size / 2, gy - size / 2, size, size, size * 0.28); ctx.fill()
      }
      ctx.globalAlpha = 1
      if (!still && visible) raf = requestAnimationFrame(draw)
    }
    const move = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top; if (still) draw(0) }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; cancelAnimationFrame(raf); if (visible) raf = requestAnimationFrame(draw) })
    resize(); io.observe(cv); draw(0)
    window.addEventListener('resize', resize); window.addEventListener('pointermove', move)
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', move) }
  }, [])
  return <canvas ref={ref} className="module-field" aria-hidden="true" />
}
