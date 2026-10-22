'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

/* Cookiemelding (KB Q156): de site gebruikt alleen noodzakelijke cookies, dus er valt niets te kiezen.
   We laten het één keer weten; "OK" onthoudt de browser (localStorage, geen cookie). */
export default function CookieNotice({ lang, t }: { lang: string; t: { text: string; more: string; ok: string } }) {
  const [show, setShow] = useState(false)
  useEffect(() => { try { setShow(!localStorage.getItem('cookie-notice')) } catch { setShow(true) } }, [])
  if (!show) return null
  const ok = () => { try { localStorage.setItem('cookie-notice', '1') } catch { /* privévenster */ } setShow(false) }
  return (
    <div className="cookie-notice" role="region" aria-label="Cookies">
      <p>{t.text} <Link href={`/${lang}/cookies`}>{t.more}</Link></p>
      <button type="button" className="btn btn-primary btn-sm" onClick={ok}>{t.ok}</button>
    </div>
  )
}
