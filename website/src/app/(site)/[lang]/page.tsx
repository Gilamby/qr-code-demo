import Link from 'next/link'
import { getHome, getPricing, getFaqs, getSettings, appUrl, signupUrl } from '@/lib/data'
import type { Locale } from '@/lib/locales'
import Generator from '@/components/Generator'
import Story from '@/components/Story'
import Dive from '@/components/dive/Dive'
import HowVideo from '@/components/HowVideo'
import PricingCards from '@/components/PricingCards'
import Icon from '@/components/icons'

export const revalidate = 300

type Item = { key: string; title: string; text?: string }
const Lines = ({ t }: { t?: string }) => <>{String(t || '').split('\n').map((l, i, a) => <span key={i}>{l}{i < a.length - 1 && <br />}</span>)}</>
const Eyebrow = ({ t }: { t?: string }) => t ? <p className="chapter mono">{t}</p> : null
const TRUST_ICON: Record<string, string> = { watermark: 'watermark', ads: 'noad', scans: 'infinity', edit: 'edit', privacy: 'shield', languages: 'languages' }

/* Eén logische volgorde. Menu: Waarom wij (#why) · Wat we bieden (#offer) · Prijzen · Vragen · Contact.
   generator → waarom wij → duik (wat gebeurt er als je scant) → voorbeelden (verhaal) → zo werkt het (filmpje) → functies → prijzen → vragen + contact → afsluiter. */
export default async function Home({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const [h, pr, faqs, s] = await Promise.all([getHome(lang), getPricing(lang), getFaqs(lang), getSettings(lang)])
  const app = appUrl(s), signup = signupUrl(s, 'pro', 'month', lang)
  const it = (sec: any): Item[] => (sec?.items || []).map((x: any) => ({ key: x.key, title: x.title, text: x.text }))
  const { hero, trust, dive, story, how, features, pricing, faq, final } = h
  const SITE = process.env.SITE_URL || 'https://qr-codex.com'
  const homeFaqs = faqs.filter((f) => f.home).slice(0, 6)
  const plans = (pr.plans || []).map((p: any) => ({ ...p, items: p.items || [] }))
  const mail = (s as any).contactEmail || 'support@optimasys.es'
  const ld = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Optimasys QR', applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
    offers: plans.map((p: any) => ({ '@type': 'Offer', name: p.name, price: p.priceMonth, priceCurrency: 'EUR' })) }

  return (
    <>
      {/* ---------- GENERATOR ---------- */}
      <section className="hero" id="generator">
        <div className="wrap">
          <div className="hero-head">
            <p className="eyebrow mono"><i className="dot" />{hero?.eyebrow}</p>
            <h1 className="display"><Lines t={hero?.title} /></h1>
            <p className="lead">{hero?.text}</p>
          </div>
          <Generator items={it(hero)} cta={hero?.cta} note={hero?.note} signup={signup} freeDownloads={s.freeDownloads ?? 1} />
        </div>
      </section>

      {/* ---------- WAAROM WIJ: geen kleine lettertjes, wat een QR-code doet (3D), voorbeelden ---------- */}
      <div id="why">
      <section className="trust" aria-labelledby="trust-t">
        <div className="wrap">
          <div className="trust-head"><Eyebrow t={trust?.eyebrow} /><h2 className="h2" id="trust-t">{trust?.title}</h2></div>
          <ul className="trust-list">
            {it(trust).map((t) => (
              <li key={t.key}><Icon name={TRUST_ICON[t.key] || 'check'} size={24} /><div><b>{t.title}</b><span>{t.text}</span></div></li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- WAT GEBEURT ER ALS JE SCANT (3D, over te slaan) ---------- */}
      <section className="dive-intro">
        <div className="wrap"><Eyebrow t={dive?.eyebrow} /><h2 className="h1">{dive?.title}</h2></div>
      </section>
      <Dive url={SITE + '/' + lang} phases={it(dive).filter((x) => /^p\d/.test(x.key))} places={it(dive).filter((x) => !/^p\d/.test(x.key))}
        cta={dive?.cta || ''} skip={dive?.cta2 || ''} note={dive?.note || ''} nextId="story" signup={signup} />

      {/* ---------- TOEPASSINGEN: vier scènes, telefoon scant, dan het overzicht ---------- */}
      <div id="story" className="story-wrap">
        <div className="wrap story-intro">
          <Eyebrow t={story?.eyebrow} />
          <h2 className="h1"><Lines t={story?.title} /></h2>
          <p className="lead">{story?.text}</p>
        </div>
        <Story items={it(story)} cta={story?.cta || ''} skip={story?.cta2 || ''} signup={signup} nextId="how" lang={lang} />
      </div>

      </div>

      {/* ---------- WAT WE BIEDEN: zo werkt het + functies ---------- */}
      <div id="offer">
      {/* ---------- ZO WERKT HET: de app als filmpje ---------- */}
      <section className="light how-sec" id="how">
        <div className="wrap">
          <Eyebrow t={how?.eyebrow} />
          <div className="split">
            <h2 className="h1"><Lines t={how?.title} /></h2>
            <p className="lead">{how?.text}</p>
          </div>
          <HowVideo items={it(how)} types={it(hero)} lang={lang} />
        </div>
      </section>

      {/* ---------- FUNCTIES ---------- */}
      <section className="light feat-sec" id="features">
        <div className="wrap">
          <Eyebrow t={features?.eyebrow} />
          <h2 className="h1"><Lines t={features?.title} /></h2>
          <p className="lead">{features?.text}</p>
          <div className="feat-grid">
            {it(features).map((f) => (
              <article key={f.key} className="feat">
                <span className="feat-ic"><Icon name={f.key} size={26} /></span>
                <h3>{f.title}</h3><p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      </div>

      {/* ---------- PRIJZEN ---------- */}
      <section className="light pricing-sec" id="pricing">
        <div className="wrap">
          <Eyebrow t={pricing?.eyebrow} />
          <div className="split">
            <h2 className="h1">{pricing?.title}</h2>
            <div><p className="lead">{pricing?.text}</p><Link className="link-strong" href={`/${lang}/pricing`}>{pricing?.cta} →</Link></div>
          </div>
          <PricingCards plans={plans} t={pr} lang={lang} appUrl={app} />
          <p className="small muted center">{pr.vatNote}</p>
        </div>
      </section>

      {/* ---------- VRAGEN + CONTACT ---------- */}
      <section className="light faq-sec" id="faq">
        <div className="wrap narrow">
          <Eyebrow t={faq?.eyebrow} />
          <h2 className="h2">{faq?.title}</h2>
          <div className="faq">
            {homeFaqs.map((f) => <details key={f.id}><summary>{f.question}<Icon name="plus" size={20} /></summary><p>{f.answer}</p></details>)}
          </div>
          <Link className="link-strong" href={`/${lang}/faq`}>{faq?.cta} →</Link>
          <div className="help-box" id="contact">
            <div><b>{faq?.cta2}</b><p>{faq?.note}</p></div>
            <div className="help-actions">
              <Link className="btn btn-dark" href={`/${lang}/contact`}>{faq?.cta2} <Icon name="arrow" size={18} /></Link>
              <a className="link-strong" href={'mailto:' + mail}>{mail}</a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- AFSLUITER ---------- */}
      <section className="final">
        <div className="wrap final-in">
          <Eyebrow t={final?.eyebrow} />
          <h2 className="h1">{final?.text}</h2>
          <div className="final-ctas">
            <a className="btn btn-primary btn-lg" href={signup}>{final?.cta} <Icon name="arrow" size={20} /></a>
            <a className="btn btn-ghost btn-lg" href={app}>{final?.cta2}</a>
          </div>
          <p className="small muted">{final?.note}</p>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
    </>
  )
}
