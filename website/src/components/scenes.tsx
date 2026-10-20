'use client'
import QR from './QR'
import Icon from './icons'


/* Getekende omgevingen (Scene) en wat de telefoon na het scannen laat zien (Result). Eigen tekeningen met CSS. */
const mini = (text: string, fg = '#111') => <QR text={text} shape="rounded" fg={fg} wave={false} label="" />

/* Geïllustreerde omgevingen (eigen tekeningen met CSS) */
export function Scene({ k }: { k: string }) {
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

/* Teksten op het telefoonscherm, in de taal van de pagina (andere talen: Engels) */
const RT: Record<string, string[]> = {
  en: ['Today', 'Soup of the day', 'Risotto', 'Tiramisu', 'Live music', 'Buy tickets', '+ Add contact', 'How to assemble'],
  nl: ['Vandaag', 'Soep van de dag', 'Risotto', 'Tiramisu', 'Livemuziek', 'Koop tickets', '+ Contact opslaan', 'Zo zet je hem in elkaar'],
  es: ['Hoy', 'Sopa del día', 'Risotto', 'Tiramisú', 'Música en directo', 'Comprar entradas', '+ Guardar contacto', 'Cómo montarlo'],
}
const menuPrice = ['6,50', '14,50', '7,00']
export function Result({ k, lang = 'en' }: { k: string; lang?: string }) {
  const T = RT[lang] || RT.en
  if (k === 'restaurant') return <span className="r r-menu"><b>{T[0]}</b>{[T[1], T[2], T[3]].map((d, i) => <span key={d}><i>{d}</i><i>€{menuPrice[i]}</i></span>)}</span>
  if (k === 'poster') return <span className="r r-event"><span className="r-img"><b style={{ color: '#fff', fontSize: 22 }}>LIVE</b></span><b>{T[4]}</b><small>FRI 21:00</small><span className="r-btn">{T[5]}</span></span>
  if (k === 'card') return <span className="r r-vcard"><span className="r-avatar" /><b>Lisa de Vries</b><small>Café Lumen</small><span className="r-line" /><span className="r-line s" style={{ margin: '0 auto' }} /><span className="r-btn">{T[6]}</span></span>
  if (k === 'packaging') return <span className="r r-video"><span className="r-player"><i /></span><b>{T[7]}</b><span className="r-line" /><span className="r-line s" /></span>
  if (k === 'retail') return <span className="r r-coupon"><b>−15%</b><span className="r-code">SPRING15</span><span className="r-bar" /></span>
  return <span className="r r-wifi"><Icon name="wifi" size={34} /><b>Hotel Guest</b><span className="r-btn">Join</span></span>
}
