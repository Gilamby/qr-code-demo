import type { Metadata } from 'next'
import Link from 'next/link'
import { getSettings, appUrl } from '@/lib/data'
import type { Locale } from '@/lib/locales'
import { CANCEL, pick } from '@/content/extra'

/* Opzegpagina (link in de footer, KB Q150): drie stappen + wat er daarna gebeurt */
export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ lang: Locale }> }): Promise<Metadata> {
  const { lang } = await params; const c = pick(CANCEL, lang)
  return { title: c.title, description: c.lead, alternates: { canonical: `/${lang}/cancel` } }
}

export default async function CancelPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const s = await getSettings(lang), c = pick(CANCEL, lang), app = appUrl(s)
  return (
    <div className="light">
      <section className="page-head"><div className="wrap narrow"><h1 className="h1">{c.title}</h1><p className="lead">{c.lead}</p></div></section>
      <section className="page-body"><div className="wrap narrow">
        <ol className="cancel-steps">
          {c.steps.map(([h, p], i) => <li key={i}><span className="cancel-n">{i + 1}</span><div><h2>{h}</h2><p>{p}</p></div></li>)}
        </ol>
        <p><a className="btn btn-primary btn-lg" href={`${app}/?go=plan&lang=${lang}`}>{c.button} →</a></p>
        <ul className="cancel-notes">{c.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        <p className="cancel-help">{c.help} <Link className="link-strong" href={`/${lang}/contact`}>{c.helpLink}</Link>.</p>
      </div></section>
    </div>
  )
}
