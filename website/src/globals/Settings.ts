import type { GlobalConfig } from 'payload'
import { L, group } from './fields'
import { revalidateAll } from '../lib/revalidate'

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Algemeen',
  access: { read: () => true },
  hooks: { afterChange: [revalidateAll] },
  fields: [
    { name: 'appUrl', label: 'Adres van de app', type: 'text', defaultValue: 'https://my.qr-codex.com' },
    { name: 'freeDownloads', label: 'Gratis downloads in de generator per bezoeker (0 = uit)', type: 'number', defaultValue: 1, min: 0, max: 20 },
    { name: 'contentVersion', type: 'number', admin: { hidden: true } },
    { name: 'contactEmail', label: 'E-mailadres support (leeg = niet tonen)', type: 'email' },
    group('seo', 'Zoekmachines', [L('title', 'Titel'), L('description', 'Omschrijving', true)]),
    group('nav', 'Menu', [L('generator', 'Generator'), L('features', 'Functies'), L('solutions', 'Oplossingen'), L('pricing', 'Prijzen'), L('faq', 'Vragen'), L('contact', 'Contact'),
      L('login', 'Inloggen'), L('tryFree', 'Knop QR-code maken'), L('menu', 'Menu (mobiel)'), L('close', 'Sluiten')]),
    group('footer', 'Voettekst', [L('tagline', 'Zin onder het logo', true), L('product', 'Kop product'), L('company', 'Kop bedrijf'), L('legal', 'Kop juridisch'),
      L('cancel', 'Abonnement opzeggen'), L('language', 'Taal'), L('rights', 'Rechten')]),
    group('contactPage', 'Contactpagina', [L('title', 'Titel'), L('text', 'Tekst', true), L('name', 'Naam'), L('email', 'E-mail'), L('topic', 'Onderwerp'),
      L('topics', 'Onderwerpen (komma ertussen)'), L('message', 'Bericht'), L('send', 'Versturen'), L('sent', 'Verstuurd'), L('error', 'Fout'), L('privacy', 'Regel privacy', true),
      L('customers', 'Al klant? (regel)', true)]),
    group('faqPage', 'Vragenpagina', [L('title', 'Titel'), L('text', 'Tekst', true), L('general', 'Kop algemeen'), L('billing', 'Kop betalen'), L('more', 'Staat je vraag er niet bij?')]),
    group('notFound', 'Pagina niet gevonden', [L('title', 'Titel'), L('text', 'Tekst'), L('back', 'Terug')]),
  ],
}
