'use client'
import { useState } from 'react'
import QR from './QR'
import Icon from './icons'

type Item = { key: string; title: string; text?: string }
const TYPE: Record<string, string> = { restaurant: 'menu', poster: 'website', card: 'vcard', packaging: 'video', retail: 'coupon', hotel: 'wifi' }

/* Oplossingen: een QR-code in zijn omgeving (voorkant) en wat er na de scan gebeurt (achterkant). Tik/klik om te draaien. */
export default function Solutions({ items, signup }: { items: Item[]; signup: string }) {
  const [flip, setFlip] = useState<string | null>(null)
  const after = items.find((x) => x.key === 'l:after')?.title || ''
  const create = items.find((x) => x.key === 'l:create')?.title || ''
  const cards = items.filter((x) => !x.key.startsWith('l:'))
  return (
    <div className="sol-grid">
      {cards.map((c) => {
        const [text, typeName] = String(c.text || '').split('|')
        const on = flip === c.key
        return (
          <div key={c.key} className={'sol-card s-' + c.key + (on ? ' flipped' : '')} data-reveal>
            <button type="button" className="sol-inner" aria-pressed={on} onClick={() => setFlip(on ? null : c.key)}>
              <span className="sol-front">
                <Scene k={c.key} />
                <span className="sol-cap"><b>{c.title}</b><small>{text}</small></span>
              </span>
              <span className="sol-back" aria-hidden={!on}>
                <span className="mono">{after}</span>
                <span className="sol-phone"><Result k={c.key} /></span>
                <span className="sol-tag"><Icon name={TYPE[c.key]} size={16} />{typeName}</span>
              </span>
            </button>
            {on && <a className="sol-link" href={signup}>{create}: {typeName} →</a>}
          </div>
        )
      })}
    </div>
  )
}

const mini = (text: string, fg = '#111') => <QR text={text} shape="rounded" fg={fg} wave={false} label="" />

/* Geïllustreerde omgevingen (eigen tekeningen met CSS) */
function Scene({ k }: { k: string }) {
  if (k === 'restaurant') return (
    <span className="scene sc-restaurant" aria-hidden="true">
      <span className="lamp" /><span className="table" /><span className="glass" /><span className="plate" />
      <span className="tent"><span className="tent-qr">{mini('https://example.com/menu', '#3b2416')}</span><span className="tent-t">MENU</span></span>
    </span>
  )
  if (k === 'poster') return (
    <span className="scene sc-poster" aria-hidden="true">
      <span className="wall" /><span className="poster"><span className="p-big">LIVE</span><span className="p-small">FRI 21:00</span><span className="p-qr">{mini('https://example.com/live', '#1e1b4b')}</span></span>
    </span>
  )
  if (k === 'card') return (
    <span className="scene sc-card" aria-hidden="true">
      <span className="bcard back" /><span className="bcard"><span className="b-name" /><span className="b-line" /><span className="b-line s" /><span className="b-qr">{mini('BEGIN:VCARD', '#0f172a')}</span></span>
    </span>
  )
  if (k === 'packaging') return (
    <span className="scene sc-packaging" aria-hidden="true">
      <span className="box"><span className="box-top" /><span className="box-side" /><span className="box-front"><span className="box-qr">{mini('https://example.com/how-to', '#422006')}</span></span></span>
    </span>
  )
  if (k === 'retail') return (
    <span className="scene sc-retail" aria-hidden="true">
      <span className="awning" /><span className="window"><span className="sale">−15%</span><span className="w-qr">{mini('https://example.com/coupon', '#7f1d1d')}</span></span>
    </span>
  )
  return (
    <span className="scene sc-hotel" aria-hidden="true">
      <span className="bed" /><span className="pillow" /><span className="keycard"><span className="k-qr">{mini('WIFI:T:WPA;S:Hotel;P:x;;', '#134e4a')}</span></span>
    </span>
  )
}

function Result({ k }: { k: string }) {
  if (k === 'restaurant') return <span className="r r-menu"><b>Today</b>{['Soup of the day', 'Risotto', 'Tiramisu'].map((d) => <span key={d}><i>{d}</i><i className="dots" /></span>)}</span>
  if (k === 'poster') return <span className="r r-event"><span className="r-img" /><b>Live music</b><span className="r-btn">Tickets</span></span>
  if (k === 'card') return <span className="r r-vcard"><span className="r-avatar" /><b>Lisa de Vries</b><span className="r-btn">+ Contact</span></span>
  if (k === 'packaging') return <span className="r r-video"><span className="r-player"><i /></span><span className="r-line" /><span className="r-line s" /></span>
  if (k === 'retail') return <span className="r r-coupon"><b>−15%</b><span className="r-code">SPRING15</span><span className="r-bar" /></span>
  return <span className="r r-wifi"><Icon name="wifi" size={34} /><b>Hotel Guest</b><span className="r-btn">Join</span></span>
}
