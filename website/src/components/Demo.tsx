'use client'
import { useMemo, useState } from 'react'
import QR from './QR'
import Icon from './icons'
import { contrast, SHAPES, type Shape } from '@/lib/qr'

type Item = { key: string; title: string; text?: string }
const TYPES = ['website', 'instagram', 'menu', 'wifi', 'video', 'pdf']
const SWATCHES: (string | [string, string])[] = ['#0b0e13', '#1d4ed8', ['#0891b2', '#2563eb'], '#7c3aed', ['#db2777', '#f97316'], '#0f766e', '#be123c', '#facc15']

/* Hoofdstuk 04: een vereenvoudigde versie van de app. De QR-code is echt (vast, niet dynamisch). */
export default function Demo({ items, cta, note, signup }: { items: Item[]; cta: string; note: string; signup: string }) {
  const L = (k: string) => items.find((x) => x.key === 'l:' + k)?.title || k
  const T = (k: string) => items.find((x) => x.key === k)
  const [type, setType] = useState('website')
  const [vals, setVals] = useState<Record<string, string>>({})
  const [shape, setShape] = useState<Shape>('rounded')
  const [color, setColor] = useState<string | [string, string]>(SWATCHES[2])
  const [frame, setFrame] = useState(L('frameDefault'))
  const [logo, setLogo] = useState(true)
  const shapeNames = L('shapes').split(',')
  const val = (k: string) => vals[type + ':' + k] ?? ''
  const set = (k: string, v: string) => setVals({ ...vals, [type + ':' + k]: v })
  const ph = T(type)?.text || ''

  const data = useMemo(() => {
    const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')
    if (type === 'wifi') return `WIFI:T:WPA;S:${esc(val('ssid') || ph)};P:${esc(val('pass') || 'welcome123')};;`
    if (type === 'instagram') return 'https://instagram.com/' + (val('user') || ph).replace(/^@/, '')
    const v = val('url') || ph.replace('…', '')
    return /^https?:\/\//i.test(v) ? v : 'https://' + v
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, vals, ph])
  const fg = Array.isArray(color) ? color[0] : color
  const low = contrast(fg, '#ffffff') < 3
  const frameBg = Array.isArray(color) ? `linear-gradient(135deg, ${color[0]}, ${color[1]})` : color

  return (
    <div className="demo">
      <div className="demo-panel" data-spot>
        <fieldset>
          <legend className="mono">1 · {L('type')}</legend>
          <div className="demo-types">
            {TYPES.map((k) => (
              <button key={k} type="button" className={type === k ? 'on' : ''} aria-pressed={type === k} onClick={() => setType(k)}>
                <Icon name={k} size={22} /><span>{T(k)?.title || k}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mono">2 · {L('content')}</legend>
          {type === 'wifi' ? (
            <div className="demo-row">
              <label className="field"><span>{L('network')}</span><input value={val('ssid')} placeholder={ph} onChange={(e) => set('ssid', e.target.value)} maxLength={32} /></label>
              <label className="field"><span>{L('password')}</span><input value={val('pass')} placeholder="welcome123" onChange={(e) => set('pass', e.target.value)} maxLength={63} /></label>
            </div>
          ) : type === 'instagram' ? (
            <label className="field"><span>{L('username')}</span><input value={val('user')} placeholder={ph} onChange={(e) => set('user', e.target.value)} maxLength={30} /></label>
          ) : (
            <label className="field"><span>{L('link')}</span><input type="url" inputMode="url" value={val('url')} placeholder={ph} onChange={(e) => set('url', e.target.value)} maxLength={300} /></label>
          )}
        </fieldset>
        <fieldset>
          <legend className="mono">3 · {L('design')}</legend>
          <div className="demo-design">
            <div role="group" aria-label={L('shape')} className="seg">
              {SHAPES.map((s, i) => <button key={s} type="button" className={shape === s ? 'on' : ''} aria-pressed={shape === s} onClick={() => setShape(s)}><i className={'shape-ic ' + s} aria-hidden="true" />{shapeNames[i] || s}</button>)}
            </div>
            <div role="group" aria-label={L('color')} className="swatches">
              {SWATCHES.map((c, i) => (
                <button key={i} type="button" className={'swatch' + (JSON.stringify(c) === JSON.stringify(color) ? ' on' : '')} aria-label={L('color') + ' ' + (i + 1)}
                  style={{ background: Array.isArray(c) ? `linear-gradient(135deg, ${c[0]}, ${c[1]})` : c }} onClick={() => setColor(c)} />
              ))}
            </div>
            <div className="demo-row">
              <label className="field"><span>{L('frame')}</span><input value={frame} onChange={(e) => setFrame(e.target.value.slice(0, 24))} /></label>
              <label className="check"><input type="checkbox" checked={logo} onChange={(e) => setLogo(e.target.checked)} /><span>{L('logo')}</span></label>
            </div>
            {low && <p className="warn" role="status">{L('lowContrast')}</p>}
          </div>
        </fieldset>
      </div>

      <div className="demo-result">
        <div className="demo-qr-card">
          <div className="demo-frame" style={{ background: frameBg }}>
            <div className="demo-qr"><QR text={data} shape={shape} fg={color} logo={logo} label={data} /></div>
            {frame && <div className="demo-frame-text">{frame}</div>}
          </div>
        </div>
        <div className="phone" aria-label={L('preview')}>
          <div className="phone-notch" aria-hidden="true" />
          <div className={'phone-screen t-' + type}>
            <Visitor type={type} data={data} L={L} name={val('user') || val('ssid') || ph} />
          </div>
          <span className="phone-cap mono">{L('preview')}</span>
        </div>
        <div className="demo-cta">
          <a className="btn btn-primary btn-lg" href={signup}>{cta} <Icon name="arrow" size={20} /></a>
          <p className="small muted">{note}</p>
        </div>
      </div>
    </div>
  )
}

/* Wat een bezoeker ongeveer ziet na het scannen (vereenvoudigd) */
function Visitor({ type, data, L, name }: { type: string; data: string; L: (k: string) => string; name: string }) {
  const host = (() => { try { return new URL(data).host } catch { return data.slice(0, 30) } })()
  if (type === 'wifi') return (
    <div className="v-wifi"><Icon name="wifi" size={44} /><b>{name}</b><span>WPA</span><span className="v-btn">{L('join')}</span></div>
  )
  if (type === 'instagram') return (
    <div className="v-insta">
      <div className="v-insta-head"><i className="v-avatar" /><div><b>@{name.replace(/^@/, '')}</b><span className="v-btn sm">{L('follow')}</span></div></div>
      <div className="v-grid">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ ['--h' as any]: (i * 37) % 360 }} />)}</div>
    </div>
  )
  if (type === 'menu') return (
    <div className="v-menu"><div className="v-menu-hero" /><b className="v-menu-title">Menu</b>
      {[['Bruschetta', '7.50'], ['Pasta vongole', '18.50'], ['Grilled sea bass', '22.00'], ['Tiramisu', '8.00']].map(([d, p]) => <div key={d} className="v-dish"><span>{d}</span><i /><span>€{p}</span></div>)}
    </div>
  )
  if (type === 'video') return (
    <div className="v-video"><div className="v-player"><span className="v-play" aria-hidden="true" /></div><span className="v-line" /><span className="v-line short" /><span className="v-btn">{L('play')}</span></div>
  )
  if (type === 'pdf') return (
    <div className="v-pdf"><div className="v-page"><span className="v-line" /><span className="v-line" /><span className="v-line short" /><span className="v-block" /><span className="v-line" /></div><span className="v-btn">{L('download')}</span></div>
  )
  return (
    <div className="v-web"><div className="v-urlbar">{host}</div><div className="v-hero" /><span className="v-line" /><span className="v-line short" /><span className="v-btn">{L('open')}</span></div>
  )
}
