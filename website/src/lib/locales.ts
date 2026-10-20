/* De 19 talen van de app; de website gebruikt dezelfde lijst (alfabetisch op eigen naam) */
export const LOCALES = [
  { code: 'bg', name: 'Български' },
  { code: 'ca', name: 'Català' },
  { code: 'da', name: 'Dansk' },
  { code: 'de', name: 'Deutsch' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'lv', name: 'Latviešu' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'nb', name: 'Norsk' },
  { code: 'pl', name: 'Polski' },
  { code: 'pt', name: 'Português' },
  { code: 'ro', name: 'Română' },
  { code: 'sq', name: 'Shqip' },
  { code: 'sk', name: 'Slovenčina' },
  { code: 'fi', name: 'Suomi' },
  { code: 'sv', name: 'Svenska' },
] as const

export type Locale = (typeof LOCALES)[number]['code']
export const CODES = LOCALES.map((l) => l.code) as string[]
export const DEFAULT_LOCALE: Locale = 'en'
export const isLocale = (v: string): v is Locale => CODES.includes(v)

/** Beste taal uit de Accept-Language-header van de browser */
export function fromAcceptLanguage(header: string | null | undefined): Locale {
  const parts = String(header || '').split(',').map((p) => {
    const [tag, q] = p.trim().split(';q=')
    return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 }
  }).sort((a, b) => b.q - a.q)
  for (const p of parts) {
    const base = p.tag.split('-')[0]
    if (base === 'no' || base === 'nn') return 'nb'
    if (isLocale(base)) return base
  }
  return DEFAULT_LOCALE
}

/** Bedrag in de stijl van de taal: €4,99 / €4.99 */
export function money(n: number, locale: string) {
  const tag = locale === 'nb' ? 'nb-NO' : locale
  try { return new Intl.NumberFormat(tag, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n) }
  catch { return '€' + n.toFixed(2) }
}
