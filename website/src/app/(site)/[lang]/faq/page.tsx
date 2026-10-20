import type { Metadata } from 'next'
import Link from 'next/link'
import { getFaqs, getSettings } from '@/lib/data'
import type { Locale } from '@/lib/locales'
import Icon from '@/components/icons'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ lang: Locale }> }): Promise<Metadata> {
  const { lang } = await params; const s = await getSettings(lang)
  return { title: s.faqPage?.title, description: s.faqPage?.text, alternates: { canonical: `/${lang}/faq` } }
}

export default async function FaqPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const [faqs, s] = await Promise.all([getFaqs(lang), getSettings(lang)])
  const f = s.faqPage || {}
  const group = (cat: string, title: string) => (
    <div style={{ marginBottom: 64 }}>
      <h2 className="h2">{title}</h2>
      <div className="faq">{faqs.filter((q) => q.category === cat).map((q) => <details key={q.id}><summary>{q.question}<Icon name="plus" size={20} /></summary><p>{q.answer}</p></details>)}</div>
    </div>
  )
  // gestructureerde gegevens voor zoekmachines
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })) }
  return (
    <div className="light">
      <section className="page-head"><div className="wrap narrow"><h1 className="h1">{f.title}</h1><p className="lead">{f.text}</p></div></section>
      <section className="page-body"><div className="wrap narrow">
        {group('general', f.general)}
        {group('billing', f.billing)}
        <Link className="link-strong" href={`/${lang}/contact`}>{f.more} →</Link>
      </div></section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
    </div>
  )
}
