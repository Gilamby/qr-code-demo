'use client'
import { useState } from 'react'

type Item = { key: string; title: string; text?: string }
const SHOTS: Record<string, string> = { type: '/app/create-menu', content: '/app/content', design: '/app/design' }

/* Hoofdstuk 03: de echte app in drie stappen (schermafbeeldingen van de app zelf) */
export default function HowTabs({ items }: { items: Item[] }) {
  const [i, setI] = useState(0)
  return (
    <div className="how">
      <ol className="how-steps">
        {items.map((it, n) => (
          <li key={it.key}>
            <button type="button" className={n === i ? 'on' : ''} aria-pressed={n === i} onClick={() => setI(n)}>
              <span className="how-n">{n + 1}</span>
              <span><b>{it.title}</b><small>{it.text}</small></span>
            </button>
          </li>
        ))}
      </ol>
      <div className="browser how-shot" data-reveal>
        <div className="browser-bar" aria-hidden="true"><i /><i /><i /><span>my.qr-codex.com</span></div>
        <div className="browser-body">
          {items.map((it, n) => (
            <picture key={it.key} className={n === i ? 'on' : ''}>
              <source media="(max-width: 700px)" srcSet={(SHOTS[it.key] || SHOTS.type) + '-sm.webp'} />
              <img src={(SHOTS[it.key] || SHOTS.type) + '.webp'} alt={it.title} width={1600} height={1000} loading="lazy" decoding="async" />
            </picture>
          ))}
        </div>
      </div>
    </div>
  )
}
