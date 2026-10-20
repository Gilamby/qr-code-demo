import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const site = process.env.SITE_URL || 'https://qr-codex.com'
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }], sitemap: `${site}/sitemap.xml` }
}
