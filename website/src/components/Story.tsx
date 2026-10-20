'use client'
import { useEffect, useRef, useState } from 'react'
import { Scene, Result } from './scenes'
import QR from './QR'
import Icon from './icons'

type Item = { key: string; title: string; text?: string }
const SCENES = ['restaurant', 'poster', 'packaging', 'card']
const TYPE_ICON: Record<string, string> = { restaurant: 'menu', poster: 'website', packaging: 'video', card: 'vcard' }
const SCANS = [1164, 758, 412, 263]

/* "Waar een QR-code voor je werkt": vier scènes, daarna het overzicht met scans.
   Scrollen bestuurt het verhaal: per scène eerst de plek, dan komt de telefoon en scant, dan zie je wat er opent.
   Bij "minder beweging" (of als scrollen niet past) staan de scènes gewoon onder elkaar. */
export default function Story({ items, cta, skip, signup, nextId, lang }: { items: Item[]; cta: string; skip: string; signup: string; nextId: string; lang: string }) {
  const sec = useRef<HTMLElement>(null)
  const [p, setP] = useState(0)
  const [still, setStill] = useState(false)
  const L = (k: string) => items.find((x) => x.key === 'l:' + k)
  const scenes = SCENES.map((k) => { const it = items.find((x) => x.key === k); const [text, type] = String(it?.text || '').split('|'); return { key: k, title: it?.title || k, text, type } })

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setStill(true); return }
    let raf = 0
    const tick = () => {
      const el = sec.current; if (!el) return
      const r = el.getBoundingClientRect()
      setP(Math.min(1, Math.max(0, -r.top / (r.height - innerHeight))))
      raf = 0
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(tick) }
    tick(); addEventListener('scroll', on, { passive: true }); addEventListener('resize', on)
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [])

  const end = L('end')
  if (still) return (
    <div className="story-still">
      {scenes.map((s, i) => (
        <div key={s.key} className="story-row">
          <div className="story-scene"><Scene k={s.key} /></div>
          <div className="story-phone"><div className="sp-screen"><Result k={s.key} lang={lang} /></div></div>
          <div><span className="mono">{i + 1} / 4</span><h3>{s.title}</h3><p>{s.text}</p><span className="story-tag"><Icon name={TYPE_ICON[s.key]} size={16} />{s.type}</span></div>
        </div>
      ))}
      <Dashboard scenes={scenes} k={1} label={L('scans')?.title || 'scans'} title={end?.title} text={end?.text} cta={cta} signup={signup} />
    </div>
  )

  // 5 delen: 4 scènes + het overzicht. Binnen een scène: 0–.35 de plek, .35–.6 scannen, .6–1 wat er opent.
  const seg = Math.min(4, Math.floor(p * 5)), local = p * 5 - seg
  const phase = local < 0.32 ? 'place' : local < 0.58 ? 'scan' : 'open'
  const cur = scenes[Math.min(seg, 3)]
  return (
    <section ref={sec} className="story" aria-label={cur.title}>
      <div className="story-sticky">
        <div className="wrap story-grid">
          <div className="story-copy">
            <div className="story-steps" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < seg ? 'done' : i === seg ? 'on' : ''} />)}</div>
            {seg < 4 ? (
              <div key={cur.key} className="story-text">
                <span className="mono">{seg + 1} / 4</span>
                <h3>{cur.title}</h3>
                <p>{cur.text}</p>
                <span className={'story-tag' + (phase === 'open' ? ' on' : '')}><Icon name={TYPE_ICON[cur.key]} size={16} />{L('made')?.title} · {cur.type}</span>
              </div>
            ) : (
              <div className="story-text">
                <h3>{end?.title}</h3><p>{end?.text}</p>
                <a className="btn btn-primary btn-lg" href={signup}>{cta} <Icon name="arrow" size={20} /></a>
              </div>
            )}
            <a className="story-skip mono" href={'#' + nextId}>{skip} ↓</a>
          </div>
          <div className="story-stage">
            {seg < 4 ? (
              <>
                <div key={'s' + cur.key} className={'story-scene ph-' + phase}><Scene k={cur.key} />{phase === 'scan' && <span className="story-beam" aria-hidden="true" />}</div>
                <div className={'story-phone ph-' + phase} aria-hidden="true">
                  <div className="sp-notch" />
                  <div className="sp-screen">
                    {phase === 'open' ? <Result k={cur.key} lang={lang} /> : <div className="sp-cam"><span className="sp-frame">{phase === 'scan' && <span className="sp-qr"><QR text={'https://qr-codex.com/' + cur.key} shape="rounded" fg="#111" wave={false} label="" /></span>}</span><b>{phase === 'scan' ? L('scan')?.title : ''}</b></div>}
                  </div>
                </div>
              </>
            ) : (
              <Dashboard scenes={scenes} k={Math.min(1, local * 1.6)} label={L('scans')?.title || 'scans'} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* Het einde: de vier codes uit het verhaal in één overzicht, de scans tellen op */
function Dashboard({ scenes, k, label, title, text, cta, signup }: { scenes: { key: string; title: string; type: string }[]; k: number; label: string; title?: string; text?: string; cta?: string; signup?: string }) {
  const max = SCANS[0], fmt = (n: number) => new Intl.NumberFormat(typeof document !== 'undefined' ? document.documentElement.lang : 'en').format(n)
  return (
    <div className="story-dash">
      {title && <div className="story-text"><h3>{title}</h3><p>{text}</p><a className="btn btn-primary btn-lg" href={signup}>{cta}</a></div>}
      <div className="dash-card" aria-hidden="true">
        <div className="dash-head"><i /><i /><i /></div>
        {scenes.map((s, i) => (
          <div key={s.key} className="dash-row" style={{ ['--w' as any]: (SCANS[i] / max) * k * 100 + '%' }}>
            <span className="dash-ic"><Icon name={TYPE_ICON[s.key]} size={18} /></span>
            <span className="dash-name"><b>{s.title}</b><small>{s.type}</small><span className="dash-bar"><i /></span></span>
            <span className="dash-n"><b>{fmt(Math.round(SCANS[i] * k))}</b><small>{label}</small></span>
          </div>
        ))}
      </div>
    </div>
  )
}
