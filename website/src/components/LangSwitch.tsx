'use client'
import { usePathname, useRouter } from 'next/navigation'
import { LOCALES } from '@/lib/locales'
import Icon from './icons'

/* Taalkeuze: onthoudt de keuze (cookie) en opent dezelfde pagina in de andere taal */
export default function LangSwitch({ lang, label }: { lang: string; label: string }) {
  const path = usePathname(), router = useRouter()
  const go = (code: string) => {
    document.cookie = 'lang=' + code + ';path=/;max-age=31536000;samesite=lax'
    router.push('/' + code + path.replace(/^\/[a-z]{2}(?=\/|$)/, ''))
  }
  return (
    <label className="lang-switch">
      <Icon name="globe" size={18} />
      <span className="sr-only">{label}</span>
      <select value={lang} onChange={(e) => go(e.target.value)} aria-label={label}>
        {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  )
}
