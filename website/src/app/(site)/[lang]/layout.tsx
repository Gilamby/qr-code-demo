import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import '@fontsource-variable/manrope'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '../site.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Effects from '@/components/Effects'
import { getSettings, getPages, appUrl, signupUrl } from '@/lib/data'
import { CODES, isLocale, type Locale } from '@/lib/locales'

export const revalidate = 300
// lege lijst = pagina's worden bij het eerste bezoek gemaakt en daarna bewaard (ISR); opslaan in het beheer ververst ze
export async function generateStaticParams() { return [] }

export const viewport: Viewport = { themeColor: '#05070a', colorScheme: 'dark light' }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const s = await getSettings(lang)
  const site = process.env.SITE_URL || 'https://qr-codex.com'
  return {
    metadataBase: new URL(site),
    title: { default: s?.seo?.title || 'QR-Codex', template: '%s · QR-Codex' },
    description: s?.seo?.description,
    icons: { icon: '/favicon.svg' },
    alternates: { canonical: `/${lang}`, languages: Object.fromEntries(CODES.map((c) => [c, `/${c}`])) },
    openGraph: { type: 'website', siteName: 'QR-Codex', title: s?.seo?.title, description: s?.seo?.description, locale: lang },
  }
}

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const s = await getSettings(lang as Locale)
  const pages = await getPages(lang as Locale)
  const legal = Object.fromEntries(pages.map((p) => [p.slug, p.title]))
  const app = appUrl(s)
  return (
    <html lang={lang}>
      <body>
        <Header lang={lang} nav={s.nav || {}} appUrl={app} signup={signupUrl(s, 'pro', 'month', lang)} />
        <main id="main">{children}</main>
        <Footer lang={lang} s={s} appUrl={app} legal={legal} />
        <Effects />
      </body>
    </html>
  )
}
