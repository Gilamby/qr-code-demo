'use client'
import { useEffect, useRef, useState } from 'react'
import QR from './QR'
import { SHAPES } from '@/lib/qr'

/* Grote QR-code in de opening: blokjes vliegen binnen, daarna wisselt hij steeds van vorm en kleur (als een golf).
   Hij blijft scanbaar en gaat naar deze website. Met de muis kantel je hem een beetje. */
const PALETTES: [string, string][] = [['#0b0e13', '#0b0e13'], ['#0891b2', '#2563eb'], ['#7c3aed', '#db2777'], ['#0f766e', '#0b0e13'], ['#ea580c', '#be123c']]

export default function HeroQR({ url, hint }: { url: string; hint: string }) {
  const [step, setStep] = useState(0)
  const card = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setStep((s) => s + 1), 2600)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const el = card.current; if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
      el.style.setProperty('--rx', (-y * 14).toFixed(2) + 'deg'); el.style.setProperty('--ry', (x * 18).toFixed(2) + 'deg')
      el.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%'); el.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(1) + '%')
    }
    const leave = () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg') }
    window.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave)
    return () => { window.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave) }
  }, [])

  const shape = SHAPES[step % SHAPES.length]
  const pal = PALETTES[Math.floor(step / 2) % PALETTES.length]
  return (
    <div className="hero-qr-wrap">
      <div className="hero-qr" ref={card}>
        <div className="hero-qr-glare" aria-hidden="true" />
        <QR text={url} shape={shape} fg={pal} bg="#ffffff" fly logo label={hint + ' — ' + url} />
        <div className="scanline" aria-hidden="true" />
        <span className="corner tl" aria-hidden="true" /><span className="corner tr" aria-hidden="true" />
        <span className="corner bl" aria-hidden="true" /><span className="corner br" aria-hidden="true" />
      </div>
      <p className="hero-qr-hint">
        <svg width="46" height="34" viewBox="0 0 46 34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M44 30C30 31 12 26 6 6M2 12l4-7 6 5" /></svg>
        {hint}
      </p>
    </div>
  )
}
