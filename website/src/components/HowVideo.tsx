'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import QR from './QR'
import Icon from './icons'
import { Result } from './scenes'

type Item = { key: string; title: string; text?: string }

/* "Zo werkt het" als filmpje: een getekende versie van de app (geen echte schermafbeelding) die vanzelf afspeelt.
   Een muis kiest een soort, vult de link in, kiest een kleur en een frame, en slaat op. Daarna staat de code in "Mijn QR-codes".
   Speelt alleen als het in beeld is; pauzeren kan, en op een stap klikken springt daarheen.
   Bij "minder beweging": geen autoplay, je klikt zelf door de stappen. */
const LEN = 18
const STARTS = [0, 4.1, 8.9, 13.7]
const KEYS: { at: number; el: string; click?: boolean }[] = [
  { at: 0, el: 'start' }, { at: 1.6, el: 'tile-menu', click: true }, { at: 3.8, el: 'next', click: true },
  { at: 5.2, el: 'field', click: true }, { at: 8.6, el: 'next', click: true },
  { at: 10.2, el: 'sw-1', click: true }, { at: 11.6, el: 'frame', click: true }, { at: 13.4, el: 'next', click: true },
  { at: 15.6, el: 'download', click: true }, { at: LEN, el: 'download' },
]
const TILES = ['website', 'menu', 'wifi', 'vcard', 'pdf', 'video', 'instagram', 'whatsapp']
const COLORS = ['#111827', '#14532d', '#7c2d12', '#312e81']
const URL_TEXT = 'cafe-lumen.example/menu'

export default function HowVideo({ items, types, lang }: { items: Item[]; types: Item[]; lang: string }) {
  const L = (k: string) => items.find((x) => x.key === 'l:' + k)?.title || k
  const steps = ['type', 'content', 'design'].map((k) => items.find((x) => x.key === k) || { key: k, title: k, text: '' })
  const name = (k: string) => types.find((x) => x.key === k)?.title || k
  const box = useRef<HTMLDivElement>(null)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [seen, setSeen] = useState(false)
  const [cur, setCur] = useState({ x: 50, y: 50 })
  const still = useRef(false)
  const last = useRef({ x: 46, y: 62 })

  // Alleen afspelen als het filmpje in beeld is
  useEffect(() => {
    still.current = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still.current) { setT(STARTS[1] + 3.6); return }
    const io = new IntersectionObserver(([e]) => { setSeen(e.isIntersecting); if (e.isIntersecting) setPlaying((p) => p || true) }, { threshold: 0.35 })
    if (box.current) io.observe(box.current)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!playing || !seen) return
    let raf = 0, last = performance.now()
    const f = (now: number) => { const dt = (now - last) / 1000; last = now; setT((v) => (v + dt) % LEN); raf = requestAnimationFrame(f) }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [playing, seen])

  // Waar staat de muis? Tussen twee doelen schuift hij er in 0,9 s heen.
  const pos = useCallback((el: string) => {
    if (el === 'start') return { x: 46, y: 62 }
    const root = box.current, n = root?.querySelector<HTMLElement>(`[data-t="${el}"]`)
    if (!root || !n) return null
    const a = root.getBoundingClientRect(), b = n.getBoundingClientRect()
    return { x: ((b.left + b.width / 2 - a.left) / a.width) * 100, y: ((b.top + b.height / 2 - a.top) / a.height) * 100 }
  }, [])
  useEffect(() => {
    let i = 0; while (i < KEYS.length - 1 && KEYS[i + 1].at <= t) i++
    const from = pos(KEYS[i].el) || last.current, next = KEYS[i + 1]
    let p = from
    if (next) { const s = Math.min(1, Math.max(0, (t - (next.at - 0.9)) / 0.9)), to = pos(next.el); if (to && s > 0) { const e = s < .5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2; p = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e } } }
    last.current = p; setCur(p)
  }, [t, pos])

  const step = t < STARTS[1] ? 0 : t < STARTS[2] ? 1 : t < STARTS[3] ? 2 : 3
  const clicking = KEYS.some((k) => k.click && t >= k.at && t < k.at + 0.3)
  const picked = t >= 1.6
  const typed = URL_TEXT.slice(0, Math.max(0, Math.min(URL_TEXT.length, Math.floor((t - 5.5) * 12))))
  const color = t >= 10.2 ? COLORS[1] : COLORS[0]
  const frame = t >= 11.6
  const downloaded = t >= 15.6
  const seek = (s: number) => { setT(STARTS[s] + (s === 1 ? 3.6 : s === 2 ? 3.6 : 0.4)); if (still.current) setPlaying(false) }
  const caption = step < 3 ? steps[step] : { title: L('done'), text: '' }

  return (
    <div className="hv">
      <div className="hv-win" ref={box} aria-hidden="true">
        <div className="hv-bar"><i /><i /><i /><span>my.qr-codex.com</span></div>
        <div className="hv-body">
          <aside className="hv-side"><b /><span className={step < 3 ? 'on' : ''} /><span className={step === 3 ? 'on' : ''} /><span /><span /></aside>
          <div className="hv-main">
            {step < 3 ? (
              <>
                <div className="hv-steps">{[0, 1, 2].map((i) => <span key={i} className={i === step ? 'on' : i < step ? 'done' : ''}><i>{i < step ? '✓' : i + 1}</i><em>{L(['type', 'content', 'design'][i])}</em></span>)}</div>
                <div className="hv-pane" key={step}>
                  {step === 0 && <div className="hv-tiles">{TILES.map((k) => <span key={k} data-t={'tile-' + k} className={picked && k === 'menu' ? 'sel' : ''}><Icon name={k} size={22} /><small>{name(k)}</small></span>)}</div>}
                  {step === 1 && (
                    <div className="hv-form">
                      <label>{L('link')}</label>
                      <span className={'hv-in' + (t >= 5.2 ? ' focus' : '')} data-t="field">https://{typed}<i className="hv-caret" /></span>
                      <label>{name('menu')}</label>
                      <span className="hv-in dim">{name('menu')} · Café Lumen</span>
                    </div>
                  )}
                  {step === 2 && (
                    <div className="hv-design">
                      <label>{name('l:color')}</label>
                      <div className="hv-sw">{COLORS.map((c, i) => <i key={c} data-t={'sw-' + i} style={{ background: c }} className={c === color ? 'sel' : ''} />)}</div>
                      <label>{name('l:frame')}</label>
                      <span className={'hv-chip' + (frame ? ' sel' : '')} data-t="frame">MENU</span>
                      <span className={'hv-mini' + (frame ? ' framed' : '')} style={{ ['--c' as any]: color }}><span className="hv-qr-in"><QR text={'https://' + URL_TEXT} shape="rounded" fg={color} wave={false} label="" /></span>{frame && <b>MENU</b>}</span>
                    </div>
                  )}
                </div>
                <div className="hv-foot"><span className={'hv-next' + (clicking && step < 3 ? ' press' : '')} data-t="next">{step === 2 ? L('save') : L('next')} →</span></div>
              </>
            ) : (
              <div className="hv-pane hv-list" key="list">
                <p className="hv-toast">✓ {L('done')}</p>
                <b className="hv-h">{L('codes')}</b>
                <div className="hv-card new">
                  <span className="hv-thumb"><QR text={'https://' + URL_TEXT} shape="rounded" fg={color} wave={false} label="" /></span>
                  <span className="hv-meta"><b>{name('menu')}</b><small>https://{URL_TEXT}</small><small>0 {L('scans')}</small></span>
                  <span className={'hv-dl' + (downloaded ? ' done' : '')} data-t="download"><Icon name="download" size={16} />{L('download')}</span>
                </div>
                <div className="hv-card ghost"><span className="hv-thumb" /><span className="hv-meta"><i /><i /></span></div>
              </div>
            )}
          </div>
          <div className="hv-phone">
            <div className="hv-screen">
              {step === 0 && (picked ? <Result k="restaurant" lang={lang} /> : <span className="hv-empty" />)}
              {step === 1 && <Result k="restaurant" lang={lang} />}
              {step >= 2 && (
                <span className={'hv-qr' + (frame ? ' framed' : '')} style={{ ['--c' as any]: color }}>
                  <span className="hv-qr-in"><QR text={'https://' + URL_TEXT} shape="rounded" fg={color} wave={false} label="" /></span>
                  {frame && <b>MENU</b>}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={'hv-cursor' + (clicking ? ' click' : '')} style={{ left: cur.x + '%', top: cur.y + '%' }}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        </span>
      </div>

      <div className="hv-ctrl">
        <button type="button" className="hv-play" onClick={() => setPlaying(!playing)} aria-label={playing ? L('pause') : L('play')}>
          {playing ? <svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="2" width="4" height="12" rx="1" fill="currentColor" /><rect x="9" y="2" width="4" height="12" rx="1" fill="currentColor" /></svg>
            : <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z" fill="currentColor" /></svg>}
        </button>
        <span className="hv-prog"><i style={{ width: (t / LEN) * 100 + '%' }} /></span>
      </div>
      <ol className="hv-caps">
        {steps.map((s, i) => (
          <li key={s.key} className={i === step ? 'on' : ''}>
            <button type="button" onClick={() => seek(i)} aria-current={i === step ? 'step' : undefined}>
              <span className="mono">{i + 1}</span><b>{s.title}</b><span>{s.text}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">{caption.title}</p>
    </div>
  )
}
