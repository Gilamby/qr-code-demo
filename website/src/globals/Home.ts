import type { GlobalConfig, Field } from 'payload'
import { L } from './fields'
import { revalidateAll } from '../lib/revalidate'

/* De homepage is opgebouwd uit hoofdstukken. Elk hoofdstuk heeft dezelfde velden:
   kopje, titel, tekst, knoppen en een lijst met regels (bij elke regel staat een vaste "sleutel" die de website gebruikt). */
export const SECTIONS: [string, string][] = [
  ['hero', 'Opening'], ['intro', '01 Wat is dit?'], ['dive', 'Duik in de QR-code (3D)'], ['become', '02 Wat kan een QR-code worden?'],
  ['how', '03 Zo maak je hem'], ['demo', '04 Probeer het'], ['manage', '05 Beheren'], ['track', 'Statistieken'],
  ['solutions', 'Oplossingen (voorbeelden)'], ['maze', 'Spelletje: vind de code'], ['pricing', '06 Prijzen (kort)'], ['faq', 'Vragen'], ['final', '07 Afsluiter'],
]

const section = (name: string, label: string): Field => ({
  name, label, type: 'group',
  fields: [
    { type: 'row', fields: [L('chapter', 'Hoofdstuk (bv. 01)'), L('eyebrow', 'Klein kopje')] },
    L('title', 'Titel (Enter = nieuwe regel)', true), L('text', 'Tekst', true),
    { type: 'row', fields: [L('cta', 'Knop 1'), L('cta2', 'Knop 2'), L('note', 'Kleine regel')] },
    {
      name: 'items', label: 'Regels', type: 'array', localized: true,
      admin: { initCollapsed: true },
      fields: [{ type: 'row', fields: [{ name: 'key', label: 'Sleutel (niet wijzigen)', type: 'text' }, L('title', 'Titel')] }, L('text', 'Tekst', true)],
    },
  ],
})

export const Home: GlobalConfig = {
  slug: 'home',
  label: 'Homepage',
  access: { read: () => true },
  hooks: { afterChange: [revalidateAll] },
  fields: SECTIONS.map(([n, l]) => section(n, l)),
}
