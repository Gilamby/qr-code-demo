import Link from 'next/link'
import { LogoMark } from './QR'
import LangSwitch from './LangSwitch'

export default function Footer({ lang, s, appUrl, legal }: { lang: string; s: any; appUrl: string; legal: Record<string, string> }) {
  const f = s?.footer || {}, n = s?.nav || {}
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link href={`/${lang}`} className="brand"><LogoMark size={30} id="ftr" /><span>Optimasys <b>QR</b></span></Link>
          <p>{f.tagline}</p>
          <LangSwitch lang={lang} label={f.language || 'Language'} />
        </div>
        <nav aria-label={f.product}>
          <h3>{f.product}</h3>
          <Link href={`/${lang}#features`}>{n.features}</Link>
          <Link href={`/${lang}#solutions`}>{n.solutions}</Link>
          <Link href={`/${lang}/pricing`}>{n.pricing}</Link>
          <a href={appUrl}>{n.login}</a>
        </nav>
        <nav aria-label={f.company}>
          <h3>{f.company}</h3>
          <Link href={`/${lang}/faq`}>{n.faq}</Link>
          <Link href={`/${lang}/contact`}>{n.contact}</Link>
          <a href={`${appUrl}/?go=plan`}>{f.cancel}</a>
        </nav>
        <nav aria-label={f.legal}>
          <h3>{f.legal}</h3>
          {['privacy', 'terms', 'cookies'].map((k) => <Link key={k} href={`/${lang}/${k}`}>{legal[k] || k}</Link>)}
        </nav>
      </div>
      <div className="wrap footer-base">
        <span>© {new Date().getFullYear()} Optimasys · qr-codex.com · {f.rights}</span>
      </div>
    </footer>
  )
}
