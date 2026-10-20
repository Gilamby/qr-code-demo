import type { Metadata } from 'next'
import { getPricing, getFaqs, getSettings, appUrl } from '@/lib/data'
import type { Locale } from '@/lib/locales'
import PricingCards from '@/components/PricingCards'
import Icon from '@/components/icons'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ lang: Locale }> }): Promise<Metadata> {
  const { lang } = await params; const p = await getPricing(lang)
  return { title: p.title, description: p.subtitle, alternates: { canonical: `/${lang}/pricing` } }
}

export default async function PricingPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const [p, faqs, s] = await Promise.all([getPricing(lang), getFaqs(lang), getSettings(lang)])
  const plans = (p.plans || []).map((x: any) => ({ ...x, items: x.items || [] }))
  return (
    <div className="light">
      <section className="page-head"><div className="wrap center">
        <h1 className="h1">{p.title}</h1>
        <p className="lead" style={{ marginInline: 'auto' }}>{p.subtitle}</p>
      </div></section>
      <section className="page-body"><div className="wrap">
        <PricingCards plans={plans} t={p} lang={lang} appUrl={appUrl(s)} />
        <p className="small muted center">{p.vatNote}</p>
        <h2 className="h2" style={{ marginTop: 100 }}>{p.compareTitle}</h2>
        <div className="compare">
          <table>
            <thead><tr><th scope="col">{p.compareFeature}</th>{plans.map((x: any) => <th key={x.key} scope="col">{x.name}</th>)}</tr></thead>
            <tbody>{(p.rows || []).map((r: any) => (
              <tr key={r.id}><th scope="row">{r.label}</th><td>{r.standard}</td><td>{r.pro}</td><td>{r.business}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="wrap narrow" style={{ marginTop: 100, width: '100%', maxWidth: 860 }}>
          <h2 className="h2">{p.faqTitle}</h2>
          <div className="faq">
            {faqs.filter((f) => f.category === 'billing').map((f) => <details key={f.id}><summary>{f.question}<Icon name="plus" size={20} /></summary><p>{f.answer}</p></details>)}
          </div>
        </div>
      </div></section>
    </div>
  )
}
