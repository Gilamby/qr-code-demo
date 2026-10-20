import type { GlobalConfig } from 'payload'
import { L, list } from './fields'
import { revalidateAll } from '../lib/revalidate'

/* Prijzen staan één keer (niet per taal); namen en teksten wel per taal.
   Let op: dit is wat de WEBSITE laat zien. De echte afrekening komt straks uit Stripe; houd ze gelijk. */
export const Pricing: GlobalConfig = {
  slug: 'pricing',
  label: 'Prijzen',
  access: { read: () => true },
  hooks: { afterChange: [revalidateAll] },
  fields: [
    L('title', 'Titel'), L('subtitle', 'Tekst', true),
    L('monthly', 'Knop maandelijks'), L('yearly', 'Knop jaarlijks'), L('yearlyBadge', 'Label bij jaarlijks'),
    L('perMonth', '"/ maand"'), L('perFirstYear', '"/ eerste jaar"'),
    L('monthNote', 'Regel bij maandprijs'), L('yearNote', 'Regel bij jaarprijs ({month} en {after} worden ingevuld)'),
    L('cta', 'Knop'), L('popular', 'Label populair'), L('vatNote', 'Regel onder de pakketten', true),
    {
      name: 'plans', label: 'Pakketten', type: 'array', minRows: 1, maxRows: 4,
      fields: [
        { name: 'key', type: 'select', options: ['standard', 'pro', 'business'], required: true },
        { type: 'row', fields: [
          { name: 'priceMonth', label: 'Per maand (€)', type: 'number', required: true },
          { name: 'priceYear', label: 'Eerste jaar (€)', type: 'number', required: true },
          { name: 'priceYearAfter', label: 'Jaar daarna (€)', type: 'number', required: true },
        ] },
        { name: 'popular', label: 'Uitgelicht', type: 'checkbox' },
        L('name', 'Naam'), L('lead', 'Voor wie'),
        { name: 'items', label: 'Wat zit erin', type: 'array', localized: true, fields: [L('text', 'Regel')] },
      ],
    },
    L('compareTitle', 'Titel vergelijking'), L('compareFeature', 'Kop eerste kolom'),
    {
      name: 'rows', label: 'Vergelijking', type: 'array',
      fields: [L('label', 'Functie'), { type: 'row', fields: [L('standard', 'Standard'), L('pro', 'Pro'), L('business', 'Business')] }],
    },
    L('faqTitle', 'Titel vragen'),
  ],
}
