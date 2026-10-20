import Link from 'next/link'
import { getHome, getPricing, getFaqs, getSettings, appUrl, signupUrl } from '@/lib/data'
import type { Locale } from '@/lib/locales'
import ModuleField from '@/components/ModuleField'
import Generator from '@/components/Generator'
import Dive from '@/components/dive/Dive'
import Morph from '@/components/Morph'
import HowTabs from '@/components/HowTabs'
import Solutions from '@/components/Solutions'
import PricingCards from '@/components/PricingCards'
import Finale from '@/components/Finale'
import Icon from '@/components/icons'

export const revalidate = 300

type Item = { key: string; title: string; text?: string }
const Lines = ({ t }: { t?: string }) => <>{String(t || '').split('\n').map((l, i, a) => <span key={i}>{l}{i < a.length - 1 && <br />}</span>)}</>
const Eyebrow = ({ t }: { t?: string }) => t ? <p className="chapter mono">{t}</p> : null
const SITE = process.env.SITE_URL || 'https://qr-codex.com'
const TRUST_ICON: Record<string, string> = { watermark: 'watermark', ads: 'noad', scans: 'infinity', edit: 'edit', privacy: 'shield', languages: 'languages' }

/* Volgorde: generator → waarom wij → zo werkt het / functies → oplossingen → beleving → prijzen → vragen → afsluiter.
   De id's (generator, features, solutions, pricing, faq) zijn dezelfde als in het menu bovenin. */
export default async function Home({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const [h, pr, faqs, s] = await Promise.all([getHome(lang), getPricing(lang), getFaqs(lang), getSettings(lang)])
  const app = appUrl(s), signup = signupUrl(s, 'pro', 'month', lang)
  const it = (sec: any): Item[] => (sec?.items || []).map((x: any) => ({ key: x.key, title: x.title, text: x.text }))
  const get = (sec: any, key: string) => it(sec).find((x) => x.key === key)
  const { hero, trust, how, features, become, track, solutions, dive, pricing, faq, final } = h
  const qrUrl = SITE + '/' + lang
  const days = String(get(track, 'days')?.title || 'M,T,W,T,F,S,S').split(',')
  const homeFaqs = faqs.filter((f) => f.home).slice(0, 6)
  const plans = (pr.plans || []).map((p: any) => ({ ...p, items: p.items || [] }))
  const ld = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Optimasys QR', applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
    offers: plans.map((p: any) => ({ '@type': 'Offer', name: p.name, price: p.priceMonth, priceCurrency: 'EUR' })) }

  return (
    <>
      {/* ---------- GENERATOR (bovenaan: meteen een code maken) ---------- */}
      <section className="hero" id="generator">
        <ModuleField />
        <div className="wrap">
          <div className="hero-head">
            <p className="eyebrow mono"><i className="dot" />{hero?.eyebrow}</p>
            <h1 className="display"><Lines t={hero?.title} /></h1>
            <p className="lead">{hero?.text}</p>
          </div>
          <Generator items={it(hero)} cta={hero?.cta} note={hero?.note} signup={signup} freeDownloads={s.freeDownloads ?? 1} />
        </div>
      </section>

      {/* ---------- WAAROM WIJ ---------- */}
      <section className="trust" aria-labelledby="trust-t">
        <div className="wrap">
          <div className="trust-head"><Eyebrow t={trust?.eyebrow} /><h2 className="h2" id="trust-t">{trust?.title}</h2></div>
          <ul className="trust-list">
            {it(trust).map((t, i) => (
              <li key={t.key} data-reveal style={{ ['--i' as any]: i }}><Icon name={TRUST_ICON[t.key] || 'check'} size={24} /><div><b>{t.title}</b><span>{t.text}</span></div></li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- FUNCTIES: zo werkt het (echte app), wat het kan, soorten, statistieken ---------- */}
      <div id="features">
        <section className="light how-sec">
          <div className="wrap">
            <Eyebrow t={how?.eyebrow} />
            <div className="split">
              <h2 className="h1" data-reveal><Lines t={how?.title} /></h2>
              <p className="lead" data-reveal>{how?.text}</p>
            </div>
            <HowTabs items={it(how)} />
          </div>
        </section>

        <section className="light feat-sec">
          <div className="wrap">
            <Eyebrow t={features?.eyebrow} />
            <h2 className="h1" data-reveal><Lines t={features?.title} /></h2>
            <p className="lead" data-reveal>{features?.text}</p>
            <div className="feat-grid">
              {it(features).map((f, i) => (
                <article key={f.key} className="feat" data-reveal data-spot style={{ ['--i' as any]: i % 3 }}>
                  <span className="feat-ic"><Icon name={f.key === 'dynamic' ? 'dynamic' : f.key} size={26} /></span>
                  <h3>{f.title}</h3><p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="become">
          <div className="wrap">
            <Eyebrow t={become?.eyebrow} />
            <h2 className="h1" data-reveal><Lines t={become?.title} /></h2>
            <p className="lead" data-reveal>{become?.text}</p>
            <Morph items={it(become)} cta={become?.cta} signup={signup} url={qrUrl} />
          </div>
        </section>

        <section className="track">
          <div className="wrap">
            <Eyebrow t={track?.eyebrow} />
            <h2 className="h1" data-reveal><Lines t={track?.title} /></h2>
            <p className="lead" data-reveal>{track?.text}</p>
            <div className="track-grid">
              <div className="stats" data-reveal>
                <span className="sample mono">{get(track, 'sample')?.title}</span>
                <div className="stat"><span>{get(track, 'scans')?.title}</span><b data-count="3652">0</b><em>+40%</em></div>
                <div className="stat"><span>{get(track, 'unique')?.title}</span><b data-count="2821">0</b><em>+42%</em></div>
                <div className="stat-bars"><span>{get(track, 'devices')?.title}</span>
                  {[['iOS', 62], ['Android', 27], ['Desktop', 11]].map(([k, v]) => <div key={k} className="bar"><i>{k}</i><span style={{ ['--v' as any]: v + '%' }} /><b>{v}%</b></div>)}
                </div>
                <div className="stat-week"><span>{get(track, 'scans')?.title}</span>
                  <div className="week">{[44, 50, 58, 62, 88, 100, 74].map((v, i) => <i key={i} style={{ ['--v' as any]: v + '%', ['--i' as any]: i }}><em>{days[i]}</em></i>)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ---------- OPLOSSINGEN ---------- */}
      <section className="solutions" id="solutions">
        <div className="wrap">
          <Eyebrow t={solutions?.eyebrow} />
          <div className="split">
            <h2 className="h1" data-reveal><Lines t={solutions?.title} /></h2>
            <div data-reveal><p className="lead">{solutions?.text}</p><p className="mono small muted">{solutions?.note}</p></div>
          </div>
          <Solutions items={it(solutions)} signup={signup} />
        </div>
      </section>

      {/* ---------- BELEVING: wat gebeurt er als je scant (3D, over te slaan) ---------- */}
      <section className="dive-intro">
        <div className="wrap"><Eyebrow t={dive?.eyebrow} /><h2 className="h1">{dive?.title}</h2></div>
      </section>
      <Dive url={qrUrl} phases={it(dive).filter((x) => /^p\d/.test(x.key))} places={it(dive).filter((x) => !/^p\d/.test(x.key))}
        cta={dive?.cta} skip={dive?.cta2} note={dive?.note} nextId="pricing" signup={signup} />

      {/* ---------- PRIJZEN ---------- */}
      <section className="light pricing-sec" id="pricing">
        <div className="wrap">
          <Eyebrow t={pricing?.eyebrow} />
          <div className="split">
            <h2 className="h1" data-reveal>{pricing?.title}</h2>
            <div data-reveal><p className="lead">{pricing?.text}</p><Link className="link-strong" href={`/${lang}/pricing`}>{pricing?.cta} →</Link></div>
          </div>
          <PricingCards plans={plans} t={pr} lang={lang} appUrl={app} />
          <p className="small muted center">{pr.vatNote}</p>
        </div>
      </section>

      {/* ---------- VRAGEN ---------- */}
      <section className="light faq-sec" id="faq">
        <div className="wrap narrow">
          <Eyebrow t={faq?.eyebrow} />
          <h2 className="h2">{faq?.title}</h2>
          <div className="faq">
            {homeFaqs.map((f) => <details key={f.id}><summary>{f.question}<Icon name="plus" size={20} /></summary><p>{f.answer}</p></details>)}
          </div>
          <Link className="link-strong" href={`/${lang}/faq`}>{faq?.cta} →</Link>
        </div>
      </section>

      {/* ---------- AFSLUITER ---------- */}
      <Finale url={qrUrl} title={final?.title} text={final?.text} cta={final?.cta} cta2={final?.cta2} note={final?.note} signup={signup} login={app} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
    </>
  )
}
