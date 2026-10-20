import type { Payload } from 'payload'
import { CONTENT, PRICES } from './defaults'
import { HOME, HOME_VERSION, NAV } from './home'

/* Eerste start: het beheer is leeg → vul het met de startteksten (en, nl, es).
   Draait alleen als er nog niets staat, dus wat in het beheer is aangepast blijft altijd staan. */

const text = (t: string) => ({ type: 'text', text: t, detail: 0, format: 0, mode: 'normal', style: '', version: 1 })
const block = (type: 'paragraph' | 'heading', t: string) => ({
  type, ...(type === 'heading' ? { tag: 'h2' } : { textFormat: 0, textStyle: '' }),
  children: [text(t)], direction: 'ltr', format: '', indent: 0, version: 1,
})
/** [kop, alinea] paren → Lexical-document voor het rich-text-veld */
export function richText(sections: [string, string][]): any {
  const children: any[] = []
  for (const [h, p] of sections) { children.push(block('heading', h)); children.push(block('paragraph', p)) }
  return { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } }
}

type Lang = keyof typeof CONTENT
const LANGS: Lang[] = ['en', 'nl', 'es']

/* Eerste beheerder uit .env (ADMIN_EMAIL + ADMIN_PASSWORD), zodat niet "de eerste bezoeker van /admin" beheerder wordt */
async function firstAdmin(payload: Payload) {
  const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD
  const { totalDocs } = await payload.count({ collection: 'users' })
  if (totalDocs > 0) return
  if (!email || !password) { payload.logger.warn('Website: nog geen beheerder. Zet ADMIN_EMAIL en ADMIN_PASSWORD in .env en herstart.'); return }
  await payload.create({ collection: 'users', data: { email, password, name: 'Beheer' } })
  payload.logger.info('Website: beheerder ' + email + ' aangemaakt.')
}

export async function seed(payload: Payload) {
  await firstAdmin(payload)
  const settings: any = await payload.findGlobal({ slug: 'settings', locale: 'en' })
  if (settings?.nav?.login) {                                            // al gevuld
    // Nieuwe opbouw van de homepage (versie): homepage-teksten en menu opnieuw zetten
    if ((settings.contentVersion || 1) < HOME_VERSION) {
      payload.logger.info('Website: nieuwe opbouw homepage (versie ' + HOME_VERSION + ')…')
      for (const lang of LANGS) {
        await payload.updateGlobal({ slug: 'home', locale: lang, data: { ...HOME[lang] } as any })
        const cur: any = await payload.findGlobal({ slug: 'settings', locale: lang, fallbackLocale: false as any })
        await payload.updateGlobal({ slug: 'settings', locale: lang, data: { nav: { ...(cur.nav || {}), ...NAV[lang] } } as any })
      }
      await payload.updateGlobal({ slug: 'settings', data: { contentVersion: HOME_VERSION } as any })
    }
    return
  }

  payload.logger.info('Website: startteksten in het beheer zetten…')
  for (const lang of LANGS) {
    const c = CONTENT[lang]
    await payload.updateGlobal({ slug: 'settings', locale: lang, data: { ...c.settings, nav: NAV[lang], contentVersion: HOME_VERSION } as any })
    await payload.updateGlobal({ slug: 'home', locale: lang, data: { ...HOME[lang] } as any })
  }

  /* Prijzen: de pakketten en de vergelijking zijn rijen met per taal hun eigen tekst.
     Eerst in het Engels aanmaken, daarna dezelfde rijen (zelfde id) per taal aanvullen. */
  const p = (lang: Lang) => CONTENT[lang].pricing
  const base = (lang: Lang) => {
    const { plans, rows, ...rest } = p(lang)
    return rest
  }
  await payload.updateGlobal({ slug: 'pricing', locale: 'en', data: {
    ...base('en'),
    plans: PRICES.map((x) => ({ ...x, ...p('en').plans[x.key] })),
    rows: p('en').rows.map((r: string[]) => ({ label: r[0], standard: r[1], pro: r[2], business: r[3] })),
  } })
  const saved: any = await payload.findGlobal({ slug: 'pricing', locale: 'en' })
  for (const lang of LANGS.filter((l) => l !== 'en')) {
    await payload.updateGlobal({ slug: 'pricing', locale: lang, data: {
      ...base(lang),
      plans: saved.plans.map((row: any) => ({ ...row, ...p(lang).plans[row.key] })),
      rows: saved.rows.map((row: any, i: number) => { const r = p(lang).rows[i] || []; return { id: row.id, label: r[0], standard: r[1], pro: r[2], business: r[3] } }),
    } })
  }

  /* Vragen: elke vraag één document, met de vertalingen erbij */
  const faqs = CONTENT.en.faqs
  for (let i = 0; i < faqs.length; i++) {
    const [category, home, question, answer] = faqs[i]
    const doc = await payload.create({ collection: 'faqs', locale: 'en', data: { category, home, question, answer, order: (i + 1) * 10 } })
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      const f = CONTENT[lang].faqs[i]
      if (f) await payload.update({ collection: 'faqs', id: doc.id, locale: lang, data: { question: f[2], answer: f[3] } })
    }
  }

  /* Juridische pagina's (concept: Fabian controleert de echte teksten) */
  for (const slug of ['privacy', 'terms', 'cookies'] as const) {
    const [title, ...sections] = CONTENT.en.pages[slug]
    const doc = await payload.create({ collection: 'pages', locale: 'en', data: { slug, title, body: richText(sections), draft: true } })
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      const [t, ...s] = CONTENT[lang].pages[slug]
      await payload.update({ collection: 'pages', id: doc.id, locale: lang, data: { title: t, body: richText(s) } })
    }
  }
  payload.logger.info('Website: startteksten staan erin.')
}
