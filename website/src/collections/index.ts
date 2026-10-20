import type { CollectionConfig } from 'payload'
import { revalidateAll } from '../lib/revalidate'

const loggedIn = ({ req }: any) => !!req.user

/* Beheerders van de website (los van de accounts in de app) */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Beheerder', plural: 'Beheerders' },
  admin: { useAsTitle: 'email' },
  access: { create: ({ req }) => !!req.user },                         // alleen een beheerder maakt nieuwe beheerders
  auth: { maxLoginAttempts: 5, lockTime: 15 * 60 * 1000, tokenExpiration: 8 * 3600 },
  fields: [{ name: 'name', type: 'text' }],
}

export const Faqs: CollectionConfig = {
  slug: 'faqs',
  labels: { singular: 'Vraag', plural: 'Vragen' },
  admin: { useAsTitle: 'question', defaultColumns: ['question', 'category', 'order'] },
  defaultSort: 'order',
  access: { read: () => true },
  hooks: { afterChange: [revalidateAll], afterDelete: [revalidateAll] },
  fields: [
    { name: 'question', label: 'Vraag', type: 'text', localized: true, required: true },
    { name: 'answer', label: 'Antwoord', type: 'textarea', localized: true, required: true },
    { name: 'category', label: 'Soort', type: 'select', options: [{ label: 'Algemeen', value: 'general' }, { label: 'Betalen', value: 'billing' }], defaultValue: 'general', required: true },
    { name: 'home', label: 'Ook op de homepage', type: 'checkbox' },
    { name: 'order', label: 'Volgorde', type: 'number', defaultValue: 10 },
  ],
}

/* Juridische pagina's: privacy, voorwaarden, cookies */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Pagina', plural: "Pagina's" },
  admin: { useAsTitle: 'title' },
  access: { read: () => true },
  hooks: { afterChange: [revalidateAll] },
  fields: [
    { name: 'slug', type: 'select', options: ['privacy', 'terms', 'cookies'], required: true, unique: true },
    { name: 'title', label: 'Titel', type: 'text', localized: true, required: true },
    { name: 'body', label: 'Tekst', type: 'richText', localized: true },
    { name: 'draft', label: 'Nog concept (toont een melding bovenaan)', type: 'checkbox', defaultValue: true },
  ],
}

/* Berichten van het contactformulier. Iedereen mag er één sturen, alleen beheerders lezen ze. */
const recent = new Map<string, number[]>()
export const Messages: CollectionConfig = {
  slug: 'messages',
  labels: { singular: 'Bericht', plural: 'Berichten' },
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'topic', 'createdAt'] },
  access: { create: () => true, read: loggedIn, update: loggedIn, delete: loggedIn },
  hooks: {
    beforeValidate: [({ data, req, operation }) => {
      if (operation !== 'create' || req.user) return data
      if (data && data.website) throw new Error('spam')                     // verborgen veld: alleen robots vullen dit in
      const ip = String(req.headers?.get?.('x-forwarded-for') || 'x').split(',')[0].trim()
      const now = Date.now(), list = (recent.get(ip) || []).filter((t) => now - t < 3600e3)
      if (list.length >= 5) throw new Error('too_many')                        // max 5 per uur per adres
      list.push(now); recent.set(ip, list)
      return { ...data, website: undefined }
    }],
  },
  fields: [
    { name: 'name', type: 'text', maxLength: 120 },
    { name: 'email', type: 'email', required: true },
    { name: 'topic', type: 'text', maxLength: 60 },
    { name: 'message', type: 'textarea', required: true, maxLength: 5000 },
    { name: 'locale', type: 'text', maxLength: 5 },
    { name: 'website', type: 'text', admin: { hidden: true } },
  ],
}
