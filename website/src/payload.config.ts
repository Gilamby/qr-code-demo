import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { Users, Faqs, Pages, Messages } from './collections'
import { Home } from './globals/Home'
import { Pricing } from './globals/Pricing'
import { Settings } from './globals/Settings'
import { LOCALES, DEFAULT_LOCALE } from './lib/locales'
import { seed } from './content/seed'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const uri = process.env.DATABASE_URI || ''

/* Database: op de server MongoDB (Atlas). Alleen om lokaal te testen zonder MongoDB: een SQLite-bestand. */
function database() {
  if (/^mongodb(\+srv)?:\/\//.test(uri)) return mongooseAdapter({ url: uri })
  return sqliteAdapter({ client: { url: uri || 'file:./website.db' }, push: true })
}

if (process.env.NODE_ENV === 'production' && !process.env.PAYLOAD_SECRET) throw new Error('PAYLOAD_SECRET ontbreekt in .env')

export default buildConfig({
  serverURL: process.env.SITE_URL || '',
  secret: process.env.PAYLOAD_SECRET || 'alleen-lokaal-testen',
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' · qr-codex.com beheer' },
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Users, Faqs, Pages, Messages],
  globals: [Settings, Home, Pricing],
  editor: lexicalEditor(),
  localization: {
    locales: LOCALES.map((l) => ({ code: l.code, label: l.name })),
    defaultLocale: DEFAULT_LOCALE,
    fallback: true,                                   // nog niet vertaald → Engels
  },
  db: database(),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  graphQL: { disable: true },
  telemetry: false,
  onInit: async (payload) => { try { await seed(payload) } catch (e: any) { payload.logger.error('Vullen mislukt: ' + e.message) } },
})
