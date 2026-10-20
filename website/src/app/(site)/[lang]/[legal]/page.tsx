import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getPage } from '@/lib/data'
import type { Locale } from '@/lib/locales'

export const revalidate = 300
export async function generateStaticParams() { return [] }
const SLUGS = ['privacy', 'terms', 'cookies']
const DRAFT: Record<string, string> = { nl: 'Concept: deze tekst wordt nog gecontroleerd.', es: 'Borrador: este texto aún se está revisando.', en: 'Draft: this text is still being reviewed.' }

export async function generateMetadata({ params }: { params: Promise<{ lang: Locale; legal: string }> }): Promise<Metadata> {
  const { lang, legal } = await params
  if (!SLUGS.includes(legal)) return {}
  const p = await getPage(lang, legal)
  return { title: p?.title, alternates: { canonical: `/${lang}/${legal}` } }
}

export default async function LegalPage({ params }: { params: Promise<{ lang: Locale; legal: string }> }) {
  const { lang, legal } = await params
  if (!SLUGS.includes(legal)) notFound()
  const p = await getPage(lang, legal)
  if (!p) notFound()
  return (
    <div className="light">
      <section className="page-head"><div className="wrap narrow"><h1 className="h1">{p.title}</h1></div></section>
      <section className="page-body"><div className="wrap narrow prose">
        {p.draft && <p className="draft-note">{DRAFT[lang] || DRAFT.en}</p>}
        {p.body && <RichText data={p.body} />}
      </div></section>
    </div>
  )
}
