'use client'
import { useEffect, useMemo, useState } from 'react'
import QR from './QR'
import Icon from './icons'
import { contrast, SHAPES, type Shape } from '@/lib/qr'
import { qrSvg, downloadPng, downloadSvg } from '@/lib/exportQr'

type Item = { key: string; title: string; text?: string }
const TYPES = ['website', 'menu', 'wifi', 'vcard', 'instagram', 'whatsapp', 'pdf', 'video']
const SWATCHES: (string | [string, string])[] = ['#0b0e13', '#1d4ed8', ['#0891b2', '#2563eb'], '#7c3aed', ['#db2777', '#f97316'], '#0f766e', '#b91c1c', '#facc15']

/* Bovenaan de homepage: een werkende QR-generator. Maakt een VASTE code (de inhoud zit in de code zelf).
   Dynamisch (later wijzigen, scans tellen) kan alleen in de app: daar wijst de knop naartoe. */
export default function Generator({ items, cta, note, signup, freeDownloads }: { items: Item[]; cta: string; note: string; signup: string; freeDownloads: number }) {
  const L = (k: string) => items.find((x) => x.key === 'l:' + k)?.title || k
  const T = (k: string) => items.find((x) => x.key === k)
  const [type, setType] = useState('website')
  const [vals, setVals] = useState<Record<string, string>>({})
  const [shape, setShape] = useState<Shape>('rounded')
  const [color, setColor] = useState<string | [string, string]>(SWATCHES[2])
  const [frame, setFrame] = useState(L('frameDefault'))
  const [logo, setLogo] = useState(false)
  const [view, setView] = useState<'qr' | 'phone'>('qr')
  // Gratis downloads per bezoeker (bijgehouden in deze browser). Dezelfde code nog eens downloaden (bv. als SVG) telt niet mee.
  const [used, setUsed] = useState<string[]>([])
  const [blocked, setBlocked] = useState(false)
  useEffect(() => { try { setUsed(JSON.parse(localStorage.getItem('oqr-free') || '[]')) } catch { /* geen opslag */ } }, [])
  // Op de telefoon: ontwerp ingeklapt, zodat de QR-code meteen onder het invulveld staat
  const [designOpen, setDesignOpen] = useState(true)
  useEffect(() => { if (matchMedia('(max-width: 980px)').matches) setDesignOpen(false) }, [])
  const shapeNames = L('shapes').split(',')
  const v = (k: string) => vals[type + ':' + k] ?? ''
  const set = (k: string, val: string) => { setVals({ ...vals, [type + ':' + k]: val }); setBlocked(false) }
  const ph = T(type)?.text || ''

  // Wat er in de code komt (standaard QR-formaten die elke telefoon kent)
  const data = useMemo(() => {
    const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')
    const url = (s: string) => { const x = (s || ph).replace('…', '').trim(); return /^https?:\/\//i.test(x) ? x : 'https://' + x }
    if (type === 'wifi') return `WIFI:T:WPA;S:${esc(v('ssid') || ph)};P:${esc(v('pass') || 'welcome123')};;`
    if (type === 'instagram') return 'https://instagram.com/' + (v('user') || ph).replace(/^@/, '').trim()
    if (type === 'whatsapp') { const n = (v('phone') || ph).replace(/[^\d]/g, ''); const msg = v('msg'); return 'https://wa.me/' + n + (msg ? '?text=' + encodeURIComponent(msg) : '') }
    if (type === 'vcard') return ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + (v('name') || ph), v('company') && 'ORG:' + v('company'), v('phone') && 'TEL:' + v('phone'), v('email') && 'EMAIL:' + v('email'), 'END:VCARD'].filter(Boolean).join('\n')
    return url(v('url'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, vals, ph])
  const fg = Array.isArray(color) ? color[0] : color
  const low = contrast(fg, '#ffffff') < 3
  const frameBg = Array.isArray(color) ? `linear-gradient(135deg, ${color[0]}, ${color[1]})` : color
  const field = (k: string, label: string, p = '', extra: any = {}) => (
    <label className="field"><span>{label}</span><input value={v(k)} placeholder={p} onChange={(e) => set(k, e.target.value)} maxLength={200} {...extra} /></label>
  )
  const download = (kind: 'png' | 'svg') => {
    if (!used.includes(data)) {
      if (used.length >= freeDownloads) { setBlocked(true); return }
      const next = [...used, data]; setUsed(next)
      try { localStorage.setItem('oqr-free', JSON.stringify(next)) } catch { /* geen opslag */ }
    }
    const { svg, W, H } = qrSvg({ text: data, shape, fg: color, logo, frame: frame.trim() || undefined })
    if (kind === 'svg') downloadSvg(svg); else downloadPng(svg, W, H)
  }

  return (
    <div className="gen" id="generator-tool">
      <div className="gen-form">
        <div className="gen-types" role="tablist" aria-label={L('content')}>
          {TYPES.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={type === k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>
              <Icon name={k} size={20} /><span>{T(k)?.title || k}</span>
            </button>
          ))}
        </div>
        <div className="gen-fields">
          {type === 'wifi' ? <div className="row2">{field('ssid', L('network'), ph)}{field('pass', L('password'), 'welcome123')}</div>
            : type === 'instagram' ? field('user', L('username'), ph)
            : type === 'whatsapp' ? <div className="row2">{field('phone', L('phone'), ph, { inputMode: 'tel' })}{field('msg', L('message'))}</div>
            : type === 'vcard' ? <><div className="row2">{field('name', L('name'), ph)}{field('company', L('company'))}</div><div className="row2">{field('phone', L('phone'), '', { inputMode: 'tel' })}{field('email', L('email'), '', { type: 'email' })}</div></>
            : field('url', L('link'), ph, { type: 'url', inputMode: 'url' })}
        </div>
        <details className="gen-design" open={designOpen} onToggle={(e) => setDesignOpen((e.target as HTMLDetailsElement).open)}>
          <summary>{L('design')}</summary>
          <div className="seg" role="group" aria-label={L('design')}>
            {SHAPES.map((s, i) => <button key={s} type="button" className={shape === s ? 'on' : ''} aria-pressed={shape === s} onClick={() => setShape(s)}><i className={'shape-ic ' + s} aria-hidden="true" />{shapeNames[i] || s}</button>)}
          </div>
          <div className="gen-row">
            <div role="group" aria-label={L('color')} className="swatches">
              {SWATCHES.map((c, i) => (
                <button key={i} type="button" className={'swatch' + (JSON.stringify(c) === JSON.stringify(color) ? ' on' : '')} aria-label={L('color') + ' ' + (i + 1)}
                  style={{ background: Array.isArray(c) ? `linear-gradient(135deg, ${c[0]}, ${c[1]})` : c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
          <div className="gen-row">
            <label className="field"><span>{L('frame')}</span><input value={frame} onChange={(e) => setFrame(e.target.value.slice(0, 20))} /></label>
            <label className="check"><input type="checkbox" checked={logo} onChange={(e) => setLogo(e.target.checked)} /><span>{L('logo')}</span></label>
          </div>
          {low && <p className="warn" role="status">{L('lowContrast')}</p>}
        </details>
      </div>

      <div className="gen-out">
        <div className="seg seg-2" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'qr'} className={view === 'qr' ? 'on' : ''} onClick={() => setView('qr')}>QR</button>
          <button type="button" role="tab" aria-selected={view === 'phone'} className={view === 'phone' ? 'on' : ''} onClick={() => setView('phone')}>{L('preview')}</button>
        </div>
        <div className="gen-stage">
          {view === 'qr' ? (
            <div className="demo-frame" style={{ background: frame ? frameBg : 'transparent', padding: frame ? undefined : 0 }}>
              <div className="demo-qr"><QR text={data} shape={shape} fg={color} logo={logo} label={data} /></div>
              {frame && <div className="demo-frame-text">{frame}</div>}
            </div>
          ) : (
            <div className="phone sm"><div className="phone-notch" aria-hidden="true" /><div className={'phone-screen t-' + type}><Visitor type={type} data={data} L={L} v={v} ph={ph} /></div></div>
          )}
        </div>
        <p className="gen-static small">{L('static')}</p>
        <div className="gen-actions">
          {freeDownloads > 0 && <>
            <button type="button" className="btn btn-ghost" onClick={() => download('png')}><Icon name="download" size={18} />PNG</button>
            <button type="button" className="btn btn-ghost" onClick={() => download('svg')}><Icon name="download" size={18} />SVG</button>
          </>}
          <a className="btn btn-primary" href={signup}>{cta} <Icon name="arrow" size={18} /></a>
        </div>
        {blocked && <p className="gen-limit" role="status">{L('limit')}</p>}
        <p className="small muted gen-note">{note}</p>
      </div>
    </div>
  )
}

/* Wat iemand ongeveer ziet na het scannen (vereenvoudigd) */
function Visitor({ type, data, L, v, ph }: { type: string; data: string; L: (k: string) => string; v: (k: string) => string; ph: string }) {
  const host = (() => { try { return new URL(data).host } catch { return '' } })()
  if (type === 'wifi') return <div className="v-wifi"><Icon name="wifi" size={44} /><b>{v('ssid') || ph}</b><span>WPA</span><span className="v-btn">OK</span></div>
  if (type === 'instagram') return (
    <div className="v-insta"><div className="v-insta-head"><i className="v-avatar" /><div><b>@{(v('user') || ph).replace(/^@/, '')}</b><span className="v-btn sm">Follow</span></div></div>
      <div className="v-grid">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ ['--h' as any]: (i * 37) % 360 }} />)}</div></div>
  )
  if (type === 'vcard') return <div className="v-wifi v-vcard"><i className="v-avatar grey" /><b>{v('name') || ph}</b><span>{v('company')}</span><span>{v('phone')}</span><span className="v-btn">+ Contact</span></div>
  if (type === 'whatsapp') return <div className="v-wa"><b>WhatsApp</b><span className="v-bubble">{v('msg') || '…'}</span><span className="v-btn wa">Chat</span></div>
  if (type === 'menu') return (
    <div className="v-menu"><div className="v-menu-hero" /><b className="v-menu-title">Menu</b>
      {[['Bruschetta', '7.50'], ['Pasta vongole', '18.50'], ['Tiramisu', '8.00']].map(([d, p]) => <div key={d} className="v-dish"><span>{d}</span><i /><span>€{p}</span></div>)}</div>
  )
  if (type === 'video') return <div className="v-video"><div className="v-player"><span className="v-play" aria-hidden="true" /></div><span className="v-line" /><span className="v-line short" /></div>
  if (type === 'pdf') return <div className="v-pdf"><div className="v-page"><span className="v-line" /><span className="v-line" /><span className="v-line short" /><span className="v-block" /></div><span className="v-btn">PDF</span></div>
  return <div className="v-web"><div className="v-urlbar">{host}</div><div className="v-hero" /><span className="v-line" /><span className="v-line short" /></div>
}
