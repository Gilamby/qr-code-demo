import type { MetadataRoute } from 'next'
import { CODES } from '@/lib/locales'

const SITE = process.env.SITE_URL || 'https://qr-codex.com'
const PATHS = ['', '/pricing', '/faq', '/contact', '/cancel', '/privacy', '/terms', '/cookies']

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.flatMap((p) => CODES.map((c) => ({
    url: `${SITE}/${c}${p}`,
    changeFrequency: 'weekly' as const,
    priority: p === '' ? 1 : 0.6,
    alternates: { languages: Object.fromEntries(CODES.map((l) => [l, `${SITE}/${l}${p}`])) },
  })))
}
