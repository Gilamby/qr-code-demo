'use client'
import { useEffect, useRef, useState } from 'react'
import type { Engine } from './engine'

type Item = { key: string; title: string; text?: string }

/* Hoofdstuk "Duik in een QR-code". Het blok is hoog (scrollruimte); het beeld blijft staan en scrollen stuurt de camera.
   "Sla dit over" springt er altijd voorbij. Zonder WebGL of bij "minder beweging": een rustige versie zonder duik. */
export default function Dive({ url, phases, places, cta, skip, note, nextId, signup }: {
  url: string; phases: Item[]; places: Item[]; cta: string; skip: string; note: string; nextId: string; signup: string
}) {
  const sec = useRef<HTMLElement>(null), cv = useRef<HTMLCanvasElement>(null)
  const eng = useRef<Engine | null>(null)
  const [p, setP] = useState(0)
  const [labels, setLabels] = useState<ReturnType<Engine['labels']>>([])
  const [open, setOpen] = useState<string | null>(null)
  const [mode, setMode] = useState<'wait' | 'gl' | 'still'>('wait')

  useEffect(() => {
    const el = sec.current!, canvas = cv.current!
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const gl = (() => { try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false } })()
    if (still || !gl) { setMode('still'); return }
    let alive = true, raf = 0
    const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches
    const progress = () => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.top / (r.height - innerHeight))) }
    const tick = () => {
      if (!eng.current) return
      const v = progress(); eng.current.setProgress(v); setP(v)
      setLabels(eng.current.labels())
      raf = requestAnimationFrame(tick)
    }
    // pas laden als het hoofdstuk eraan komt
    const near = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || eng.current) return
      near.disconnect()
      const { createEngine } = await import('./engine')
      if (!alive) return
      eng.current = createEngine(canvas, { url, mobile }); setMode('gl')
      eng.current.setProgress(progress())
    }, { rootMargin: '100% 0px' })
    near.observe(el)
    const vis = new IntersectionObserver(([e]) => {
      if (!eng.current) return
      eng.current.setActive(e.isIntersecting); cancelAnimationFrame(raf)
      if (e.isIntersecting) raf = requestAnimationFrame(tick)
    })
    vis.observe(el)
    const startTick = setInterval(() => { if (eng.current) { clearInterval(startTick); raf = requestAnimationFrame(tick) } }, 200)
    // slepen met de muis om rond te kijken (niet op touch: daar moet je kunnen scrollen)
    let down = false, lx = 0
    const pd = (e: PointerEvent) => { if (e.pointerType !== 'mouse') return; down = true; lx = e.clientX }
    const pm = (e: PointerEvent) => { if (!down || !eng.current) return; eng.current.drag(e.clientX - lx); lx = e.clientX }
    const pu = () => { down = false }
    canvas.addEventListener('pointerdown', pd); window.addEventListener('pointermove', pm); window.addEventListener('pointerup', pu)
    return () => {
      alive = false; near.disconnect(); vis.disconnect(); clearInterval(startTick); cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', pd); window.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu)
      eng.current?.dispose(); eng.current = null
    }
  }, [url])

  // welke tekst hoort bij dit moment van de duik
  const ranges: [number, number][] = [[0, 0.14], [0.17, 0.33], [0.38, 0.54], [0.6, 0.76]]
  const act = ranges.findIndex(([a, b]) => p >= a && p <= b)
  const inWorld = p > 0.8
  const chosen = places.find((x) => x.key === open)

  if (mode === 'still') {
    return (
      <section ref={sec} className="dive dive-still" id="explore" aria-label={phases[0]?.title}>
        <div className="wrap">
          {phases.map((ph) => <div key={ph.key} className="dive-still-line" data-reveal><h3>{ph.title}</h3><p>{ph.text}</p></div>)}
          <div className="dive-still-places">
            {places.map((pl) => <a key={pl.key} className={'place-chip c-' + pl.key} href={signup}><b>{pl.title}</b><span>{pl.text}</span></a>)}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section ref={sec} className="dive" id="explore" aria-label={phases[0]?.title}>
      <div className="dive-sticky">
        <canvas ref={cv} className={'dive-canvas' + (inWorld ? ' grab' : '')} aria-hidden="true" />
        <div className="dive-vignette" aria-hidden="true" />
        <div className="dive-copy">
          {phases.map((ph, i) => (
            <div key={ph.key} className={'dive-phase' + (i === act ? ' on' : '')} aria-hidden={i !== act}>
              <span className="mono">{String(i + 1).padStart(2, '0')} / {String(phases.length).padStart(2, '0')}</span>
              <h2>{ph.title}</h2>
              <p>{ph.text}</p>
            </div>
          ))}
        </div>
        {inWorld && labels.map((l) => {
          const pl = places.find((x) => x.key === l.key); if (!pl || !l.visible) return null
          return (
            <button key={l.key} type="button" className={'world-label c-' + l.key + (open === l.key ? ' on' : '')}
              style={{ transform: `translate(${l.x}px, ${l.y}px) translate(-50%, -100%)`, opacity: 0.35 + l.front * 0.65 }}
              onClick={() => setOpen(open === l.key ? null : l.key)} aria-expanded={open === l.key}>
              <i aria-hidden="true" />{pl.title}
            </button>
          )
        })}
        {inWorld && chosen && (
          <div className={'world-card c-' + chosen.key} role="dialog" aria-label={chosen.title}>
            <button type="button" className="world-card-x" onClick={() => setOpen(null)} aria-label="Close">×</button>
            <span className="mono">Optimasys QR → {chosen.title}</span>
            <h3>{chosen.title}</h3>
            <p>{chosen.text}</p>
            <a className="btn btn-primary btn-sm" href={signup}>{cta}</a>
          </div>
        )}
        <div className="dive-bottom">
          <div className="dive-progress" aria-hidden="true"><span style={{ transform: `scaleX(${p})` }} /></div>
          {inWorld ? <span className="dive-note">{note}</span> : <span />}
          <a className="dive-skip" href={'#' + nextId}>{skip} ↓</a>
        </div>
      </div>
    </section>
  )
}
