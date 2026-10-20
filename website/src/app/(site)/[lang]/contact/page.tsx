import type { Metadata } from 'next'
import { getSettings, appUrl } from '@/lib/data'
import type { Locale } from '@/lib/locales'
import ContactForm from '@/components/ContactForm'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ lang: Locale }> }): Promise<Metadata> {
  const { lang } = await params; const s = await getSettings(lang)
  return { title: s.contactPage?.title, description: s.contactPage?.text, alternates: { canonical: `/${lang}/contact` } }
}

export default async function ContactPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const s = await getSettings(lang), c = s.contactPage || {}
  return (
    <div className="light">
      <section className="page-head"><div className="wrap"><h1 className="h1">{c.title}</h1></div></section>
      <section className="page-body"><div className="wrap contact-grid">
        <div>
          <p className="lead" style={{ marginTop: 0 }}>{c.text}</p>
          <p className="lead">{c.customers} <a className="link-strong" href={appUrl(s)}>{s.nav?.login} →</a></p>
          {s.contactEmail && <p className="lead"><a className="link-strong" href={'mailto:' + s.contactEmail}>{s.contactEmail}</a></p>}
        </div>
        <ContactForm t={c} lang={lang} />
      </div></section>
    </div>
  )
}
