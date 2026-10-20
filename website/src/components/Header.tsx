'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoMark } from './QR'
import Icon from './icons'

type Nav = Record<string, string>
/* Het menu zoals op elke website: Waarom wij · Wat we bieden · Prijzen · Vragen · Contact. Zelfde volgorde als de pagina. Het onderdeel waar je bent licht op.
   "Inloggen" staat er altijd, ook op de telefoon (bestaande klanten eerst). */
const SECTIONS = ['why', 'offer', 'pricing', 'faq']

export default function Header({ lang, nav, appUrl, signup }: { lang: string; nav: Nav; appUrl: string; signup: string }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState('')
  const path = usePathname()
  const home = path === '/' + lang || path === '/' + lang + '/'

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 8)
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  useEffect(() => { document.documentElement.classList.toggle('menu-open', open) }, [open])
  // Welk onderdeel staat nu in beeld?
  useEffect(() => {
    if (!home) { setActive(path.includes('/pricing') ? 'pricing' : path.includes('/faq') ? 'faq' : ''); return }
    const els = SECTIONS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const pick = () => {
      const y = window.innerHeight * 0.35
      let cur = ''
      for (const el of els) if (el.getBoundingClientRect().top <= y) cur = el.id
      setActive(cur)
    }
    pick(); window.addEventListener('scroll', pick, { passive: true })
    return () => window.removeEventListener('scroll', pick)
  }, [home, path])

  const href = (id: string) => (home ? '#' + id : `/${lang}#${id}`)
  return (
    <header className={'site-header' + (scrolled ? ' is-scrolled' : '') + (open ? ' is-open' : '')}>
      <a className="skip" href="#main">Skip to content</a>
      <div className="wrap header-row">
        <Link href={`/${lang}`} className="brand" aria-label="Optimasys QR" onClick={() => setOpen(false)}>
          <LogoMark size={30} id="hdr" /><span>Optimasys <b>QR</b></span>
        </Link>
        <nav className="main-nav" aria-label="Main">
          {SECTIONS.map((id) => <a key={id} href={href(id)} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>{nav[id] || id}</a>)}
          <Link href={`/${lang}/contact`} className={path.includes('/contact') ? 'on' : ''}>{nav.contact}</Link>
        </nav>
        <div className="header-actions">
          <a className="btn btn-ghost btn-sm login-btn" href={appUrl}>{nav.login}</a>
          <a className="btn btn-primary btn-sm hide-sm" href={signup}>{nav.tryFree}</a>
          <button type="button" className="menu-btn" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? nav.close : nav.menu} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'close' : 'menuIcon'} />
          </button>
        </div>
      </div>
      <div id="mobile-nav" className="mobile-nav" hidden={!open}>
        {SECTIONS.map((id) => <a key={id} href={href(id)} onClick={() => setOpen(false)}>{nav[id] || id}</a>)}
        <Link href={`/${lang}/contact`} onClick={() => setOpen(false)}>{nav.contact}</Link>
        <a className="btn btn-primary" href={signup}>{nav.tryFree}</a>
      </div>
    </header>
  )
}
