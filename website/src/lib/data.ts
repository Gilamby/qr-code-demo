import 'server-only'
import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Locale } from './locales'

/* Alle teksten komen uit het beheer (Payload). Per verzoek één keer ophalen. */
const payload = cache(() => getPayload({ config }))

export const getSettings = cache(async (locale: Locale) => (await payload()).findGlobal({ slug: 'settings', locale, depth: 0 }) as Promise<any>)
export const getHome = cache(async (locale: Locale) => (await payload()).findGlobal({ slug: 'home', locale, depth: 0 }) as Promise<any>)
export const getPricing = cache(async (locale: Locale) => (await payload()).findGlobal({ slug: 'pricing', locale, depth: 0 }) as Promise<any>)
export const getFaqs = cache(async (locale: Locale) =>
  (await (await payload()).find({ collection: 'faqs', locale, sort: 'order', limit: 100, depth: 0 })).docs as any[])
export const getPages = cache(async (locale: Locale) =>
  (await (await payload()).find({ collection: 'pages', locale, limit: 10, depth: 0 })).docs as any[])
export const getPage = cache(async (locale: Locale, slug: string) =>
  (await (await payload()).find({ collection: 'pages', locale, where: { slug: { equals: slug } }, limit: 1, depth: 0 })).docs[0] as any)

/** Adres van de app (uit het beheer, anders uit .env) */
export function appUrl(s: any) {
  return String(s?.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://my.qr-codex.com').replace(/\/$/, '')
}
/** Knop "proberen": opent aanmelden in de app, met het gekozen pakket */
export function signupUrl(s: any, plan = 'pro', period: 'month' | 'year' = 'month', lang?: string) {
  return appUrl(s) + '/?signup&plan=' + plan + '&period=' + period + (lang ? '&lang=' + lang : '')
}
