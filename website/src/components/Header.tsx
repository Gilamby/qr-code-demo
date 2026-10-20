'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LogoMark } from './QR'
import Icon from './icons'

type Nav = { features: string; solutions: string; pricing: string; faq: string; contact: string; login: string; tryFree: string; menu: string; close: string }

/* Kopbalk: altijd zichtbaar. "Inloggen" staat er altijd, ook op de telefoon (bestaande klanten eerst). */
export default function Header({ lang, nav, appUrl, signup }: { lang: string; nav: Nav; appUrl: string; signup: string }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 8)
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  useEffect(() => { document.documentElement.classList.toggle('menu-open', open) }, [open])
  const links = [
    { href: `/${lang}#features`, label: nav.features },
    { href: `/${lang}#solutions`, label: nav.solutions },
    { href: `/${lang}/pricing`, label: nav.pricing },
    { href: `/${lang}/faq`, label: nav.faq },
  ]
  return (
    <header className={'site-header' + (scrolled ? ' is-scrolled' : '') + (open ? ' is-open' : '')}>
      <a className="skip" href="#main">Skip to content</a>
      <div className="wrap header-row">
        <Link href={`/${lang}`} className="brand" aria-label="Optimasys QR" onClick={() => setOpen(false)}>
          <LogoMark size={30} id="hdr" /><span>Optimasys <b>QR</b></span>
        </Link>
        <nav className="main-nav" aria-label="Main">
          {links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
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
        {links.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>)}
        <Link href={`/${lang}/contact`} onClick={() => setOpen(false)}>{nav.contact}</Link>
        <a className="btn btn-primary" href={signup}>{nav.tryFree}</a>
      </div>
    </header>
  )
}
