import Link from 'next/link'
import { getHome, getPricing, getFaqs, getSettings, appUrl, signupUrl } from '@/lib/data'
import type { Locale } from '@/lib/locales'
import HeroQR from '@/components/HeroQR'
import ModuleField from '@/components/ModuleField'
import Dive from '@/components/dive/Dive'
import Morph from '@/components/Morph'
import HowTabs from '@/components/HowTabs'
import Demo from '@/components/Demo'
import Magnet from '@/components/Magnet'
import Solutions from '@/components/Solutions'
import Maze from '@/components/Maze'
import PricingCards from '@/components/PricingCards'
import Finale from '@/components/Finale'
import Icon from '@/components/icons'

export const revalidate = 300

type Item = { key: string; title: string; text?: string }
const Lines = ({ t }: { t?: string }) => <>{String(t || '').split('\n').map((l, i, a) => <span key={i}>{l}{i < a.length - 1 && <br />}</span>)}</>
const Chapter = ({ n, label }: { n?: string; label?: string }) => label ? <p className="chapter mono">{n && <span>{n}</span>}{label}</p> : null
const SITE = process.env.SITE_URL || 'https://qr-codex.com'

export default async function Home({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const [h, pr, faqs, s] = await Promise.all([getHome(lang), getPricing(lang), getFaqs(lang), getSettings(lang)])
  const app = appUrl(s), signup = signupUrl(s, 'pro', 'month', lang)
  const it = (sec: any): Item[] => (sec?.items || []).map((x: any) => ({ key: x.key, title: x.title, text: x.text }))
  const get = (sec: any, key: string) => it(sec).find((x) => x.key === key)
  const { hero, intro, dive, become, how, demo, manage, track, solutions, maze, pricing, faq, final } = h
  const qrUrl = SITE + '/' + lang
  const days = String(get(track, 'days')?.title || 'M,T,W,T,F,S,S').split(',')
  const homeFaqs = faqs.filter((f) => f.home).slice(0, 5)
  const plans = (pr.plans || []).map((p: any) => ({ ...p, items: p.items || [] }))

  return (
    <>
      {/* ---------- OPENING (rustig en mooi; inloggen staat bovenin) ---------- */}
      <section className="hero">
        <ModuleField />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow mono"><i className="dot" />{hero?.eyebrow}</p>
            <h1 className="display"><Lines t={hero?.title} /></h1>
            <p className="lead">{hero?.text}</p>
            <div className="ctas">
              <a className="btn btn-primary btn-lg" href={signup}>{hero?.cta} <Icon name="arrow" size={20} /></a>
              <a className="btn btn-ghost btn-lg" href="#explore">{hero?.cta2} ↓</a>
            </div>
            <p className="small muted">{hero?.note} <a href={app} className="link-strong">{get(hero, 'login')?.title} →</a></p>
          </div>
          <HeroQR url={qrUrl} hint={get(hero, 'scan')?.title || ''} />
        </div>
        <nav className="wrap quick" aria-label="Quick links">
          <a href="#explore"><span className="mono">01</span>{get(hero, 'explore')?.title}</a>
          <a href="#how"><span className="mono">02</span>{get(hero, 'product')?.title}</a>
          <Link href={`/${lang}/pricing`}><span className="mono">03</span>{get(hero, 'pricing')?.title}</Link>
          <a href={app}><span className="mono">04</span>{get(hero, 'login')?.title}</a>
        </nav>
      </section>

      {/* ---------- 01 WAT IS DIT? (rustig, licht) ---------- */}
      <section className="light intro" id="features">
        <div className="wrap">
          <Chapter n={intro?.chapter} label={intro?.eyebrow} />
          <div className="split">
            <h2 className="h1" data-reveal><Lines t={intro?.title} /></h2>
            <div data-reveal>
              <p className="lead">{intro?.text}</p>
              <a className="link-strong" href="#how">{intro?.cta} →</a>
            </div>
          </div>
          <ol className="pillars">
            {it(intro).map((p, i) => (
              <li key={p.key} data-reveal style={{ ['--i' as any]: i }}>
                <span className="mono">0{i + 1}</span><h3>{p.title}</h3><p>{p.text}</p>
              </li>
            ))}
          </ol>
          <figure className="browser intro-shot" data-reveal>
            <div className="browser-bar" aria-hidden="true"><i /><i /><i /><span>my.qr-codex.com</span></div>
            <picture>
              <source media="(max-width: 700px)" srcSet="/app/dashboard-sm.webp" />
              <img src="/app/dashboard.webp" alt="Optimasys QR dashboard" width={1600} height={1000} loading="lazy" decoding="async" />
            </picture>
          </figure>
        </div>
      </section>

      {/* ---------- DE DUIK (spektakel) ---------- */}
      <Dive url={qrUrl} phases={it(dive).filter((x) => /^p\d/.test(x.key))} places={it(dive).filter((x) => !/^p\d/.test(x.key))}
        cta={dive?.cta} skip={dive?.cta2} note={dive?.note} nextId="become" signup={signup} />

      {/* ---------- 02 WAT KAN EEN QR-CODE WORDEN? ---------- */}
      <section className="become" id="become">
        <div className="wrap">
          <Chapter n={become?.chapter} label={become?.eyebrow} />
          <h2 className="h1" data-reveal><Lines t={become?.title} /></h2>
          <p className="lead" data-reveal>{become?.text}</p>
          <Morph items={it(become)} cta={become?.cta} signup={signup} url={qrUrl} />
        </div>
      </section>

      {/* ---------- 03 ZO MAAK JE HEM (rustig, de echte app) ---------- */}
      <section className="light how-sec" id="how">
        <div className="wrap">
          <Chapter n={how?.chapter} label={how?.eyebrow} />
          <div className="split">
            <h2 className="h1" data-reveal><Lines t={how?.title} /></h2>
            <p className="lead" data-reveal>{how?.text}</p>
          </div>
          <HowTabs items={it(how)} />
        </div>
      </section>

      {/* ---------- 04 PROBEER HET ---------- */}
      <section className="demo-sec" id="try">
        <div className="wrap">
          <Chapter n={demo?.chapter} label={demo?.eyebrow} />
          <h2 className="h1" data-reveal><Lines t={demo?.title} /></h2>
          <p className="lead" data-reveal>{demo?.text}</p>
          <Demo items={it(demo)} cta={demo?.cta} note={demo?.note} signup={signup} />
        </div>
      </section>

      {/* ---------- 05 BEHEREN (van chaos naar structuur) ---------- */}
      <section className="light manage" id="manage">
        <div className="wrap">
          <Chapter n={manage?.chapter} label={manage?.eyebrow} />
          <div className="manage-grid">
            <div>
              <h2 className="h1" data-reveal><Lines t={manage?.title} /></h2>
              <p className="lead" data-reveal>{manage?.text}</p>
              <ul className="manage-list">
                {it(manage).map((m) => <li key={m.key} data-reveal><Icon name="check" size={20} stroke={2.2} /><div><b>{m.title}</b><span>{m.text}</span></div></li>)}
              </ul>
            </div>
            <div className="magnet-box"><Magnet url={qrUrl} label={manage?.title || ''} /></div>
          </div>
          <figure className="browser manage-shot" data-reveal>
            <div className="browser-bar" aria-hidden="true"><i /><i /><i /><span>my.qr-codex.com</span></div>
            <picture>
              <source media="(max-width: 700px)" srcSet="/app/mycodes-sm.webp" />
              <img src="/app/mycodes.webp" alt="Optimasys QR — My QR Codes" width={1600} height={1000} loading="lazy" decoding="async" />
            </picture>
          </figure>
        </div>
      </section>

      {/* ---------- METEN (statistieken) ---------- */}
      <section className="track" id="track">
        <div className="wrap">
          <Chapter label={track?.eyebrow} />
          <h2 className="h1" data-reveal><Lines t={track?.title} /></h2>
          <p className="lead" data-reveal>{track?.text}</p>
          <div className="stats" data-reveal>
            <span className="sample mono">{get(track, 'sample')?.title}</span>
            <div className="stat"><span>{get(track, 'scans')?.title}</span><b data-count="3652">0</b><em>+40%</em></div>
            <div className="stat"><span>{get(track, 'unique')?.title}</span><b data-count="2821">0</b><em>+42%</em></div>
            <div className="stat-chart">
              <svg viewBox="0 0 280 120" preserveAspectRatio="none" aria-hidden="true">
                <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a78bfa" stopOpacity=".5" /><stop offset="1" stopColor="#a78bfa" stopOpacity="0" /></linearGradient></defs>
                <path className="area" d="M0 90 L20 70 L40 78 L60 52 L80 60 L100 40 L120 66 L140 48 L160 30 L180 50 L200 36 L220 22 L240 44 L260 14 L280 30 L280 120 L0 120Z" fill="url(#tg)" />
                <path className="line" d="M0 90 L20 70 L40 78 L60 52 L80 60 L100 40 L120 66 L140 48 L160 30 L180 50 L200 36 L220 22 L240 44 L260 14 L280 30" fill="none" stroke="#c4b5fd" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="stat-bars"><span>{get(track, 'devices')?.title}</span>
              {[['iOS', 62], ['Android', 27], ['Desktop', 11]].map(([k, v]) => <div key={k} className="bar"><i>{k}</i><span style={{ ['--v' as any]: v + '%' }} /><b>{v}%</b></div>)}
            </div>
            <div className="stat-week"><span>{get(track, 'scans')?.title}</span>
              <div className="week">{[44, 50, 58, 62, 88, 100, 74].map((v, i) => <i key={i} style={{ ['--v' as any]: v + '%', ['--i' as any]: i }}><em>{days[i]}</em></i>)}</div>
            </div>
          </div>
          <p className="mono real-label" data-reveal>↓ {get(track, 'real')?.title}</p>
          <figure className="browser track-shot" data-reveal>
            <div className="browser-bar" aria-hidden="true"><i /><i /><i /><span>my.qr-codex.com</span></div>
            <picture>
              <source media="(max-width: 700px)" srcSet="/app/analytics-sm.webp" />
              <img src="/app/analytics.webp" alt="Optimasys QR — Analytics" width={1600} height={1000} loading="lazy" decoding="async" />
            </picture>
          </figure>
        </div>
      </section>

      {/* ---------- OPLOSSINGEN ---------- */}
      <section className="solutions" id="solutions">
        <div className="wrap">
          <Chapter label={solutions?.eyebrow} />
          <div className="split">
            <h2 className="h1" data-reveal><Lines t={solutions?.title} /></h2>
            <div data-reveal><p className="lead">{solutions?.text}</p><p className="mono small">{solutions?.note}</p></div>
          </div>
          <Solutions items={it(solutions)} signup={signup} />
        </div>
      </section>

      {/* ---------- SPELLETJE (optioneel) ---------- */}
      <section className="light maze-sec" id="game">
        <div className="wrap">
          <Chapter label={maze?.eyebrow} />
          <Maze title={maze?.title} text={maze?.text} cta={maze?.cta} again={maze?.cta2} note={maze?.note}
            labels={Object.fromEntries(it(maze).map((x) => [x.key, x.title]))} signup={signup} />
        </div>
      </section>

      {/* ---------- 06 PRIJZEN (rustig en duidelijk) ---------- */}
      <section className="light pricing-sec" id="pricing">
        <div className="wrap">
          <Chapter n={pricing?.chapter} label={pricing?.eyebrow} />
          <div className="split">
            <h2 className="h1" data-reveal>{pricing?.title}</h2>
            <div data-reveal><p className="lead">{pricing?.text}</p><Link className="link-strong" href={`/${lang}/pricing`}>{pricing?.cta} →</Link></div>
          </div>
          <PricingCards plans={plans} t={pr} lang={lang} appUrl={app} />
          <p className="small muted center">{pr.vatNote}</p>
        </div>
      </section>

      {/* ---------- VRAGEN ---------- */}
      <section className="light faq-sec">
        <div className="wrap narrow">
          <Chapter label={faq?.eyebrow} />
          <h2 className="h2">{faq?.title}</h2>
          <div className="faq">
            {homeFaqs.map((f) => <details key={f.id}><summary>{f.question}<Icon name="plus" size={20} /></summary><p>{f.answer}</p></details>)}
          </div>
          <Link className="link-strong" href={`/${lang}/faq`}>{faq?.cta} →</Link>
        </div>
      </section>

      {/* ---------- 07 AFSLUITER ---------- */}
      <Finale url={qrUrl} title={final?.title} text={final?.text} cta={final?.cta} cta2={final?.cta2} note={final?.note} signup={signup} login={app} />
    </>
  )
}
