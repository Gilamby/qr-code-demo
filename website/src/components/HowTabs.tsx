'use client'
import { useEffect, useState } from 'react'
import QR from './QR'
import Icon from './icons'

type Item = { key: string; title: string; text?: string }
const TYPES = ['website', 'menu', 'wifi', 'vcard', 'pdf', 'video', 'instagram', 'coupon']

/* "Zo werkt het": drie stappen met een vereenvoudigde tekening van de app (bewust geen echte schermafbeeldingen). */
export default function HowTabs({ items }: { items: Item[] }) {
  const [i, setI] = useState(0)
  const [touched, setTouched] = useState(false)
  useEffect(() => {                                     // loopt vanzelf door de stappen tot iemand zelf klikt
    if (touched || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 4200)
    return () => clearInterval(t)
  }, [touched, items.length])
  const key = items[i]?.key
  return (
    <div className="how">
      <ol className="how-steps">
        {items.map((it, n) => (
          <li key={it.key}>
            <button type="button" className={n === i ? 'on' : ''} aria-pressed={n === i} onClick={() => { setI(n); setTouched(true) }}>
              <span className="how-n">{n + 1}</span>
              <span><b>{it.title}</b><small>{it.text}</small></span>
            </button>
          </li>
        ))}
      </ol>
      <div className="mock" aria-hidden="true">
        <div className="mock-bar"><i /><i /><i /></div>
        <div className="mock-body">
          <div className="mock-side"><b /><span className="on" /><span /><span /><span /></div>
          <div className="mock-main">
            <div className="mock-steps">{items.map((it, n) => <span key={it.key} className={n <= i ? 'on' : ''}>{n + 1}</span>)}</div>
            <div className="mock-stage">
              <div className={'mock-pane' + (key === 'type' ? ' on' : '')}>
                <div className="mock-grid">{TYPES.map((t, n) => <span key={t} className={n === 1 ? 'sel' : ''}><Icon name={t} size={22} /></span>)}</div>
              </div>
              <div className={'mock-pane' + (key === 'content' ? ' on' : '')}>
                <div className="mock-form">
                  <span className="lbl" /><span className="inp typed">https://cafe-lumen.example/menu</span>
                  <span className="lbl short" /><span className="inp" /><span className="lbl" /><span className="inp half" />
                  <span className="btn-m" />
                </div>
              </div>
              <div className={'mock-pane' + (key === 'design' ? ' on' : '')}>
                <div className="mock-design">
                  <div className="mock-swatches"><i style={{ background: '#14382c' }} className="sel" /><i style={{ background: '#1d4ed8' }} /><i style={{ background: '#7c3aed' }} /><i style={{ background: '#be123c' }} /><i style={{ background: '#0b0e13' }} /></div>
                  <div className="mock-frame"><div className="mock-qr"><QR text="https://example.com/menu" shape="rounded" fg="#14382c" wave={false} label="" /></div><b>MENU</b></div>
                </div>
              </div>
            </div>
          </div>
          <div className="mock-phone"><div className="mock-screen">
            <span className="ph-hero" /><span className="ph-title" />
            {[0, 1, 2, 3].map((n) => <span key={n} className="ph-row"><i /><i /></span>)}
          </div></div>
        </div>
      </div>
    </div>
  )
}
