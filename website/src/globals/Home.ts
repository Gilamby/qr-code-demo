import type { GlobalConfig, Field } from 'payload'
import { L } from './fields'
import { revalidateAll } from '../lib/revalidate'

/* De homepage is opgebouwd uit hoofdstukken. Elk hoofdstuk heeft dezelfde velden:
   kopje, titel, tekst, knoppen en een lijst met regels (bij elke regel staat een vaste "sleutel" die de website gebruikt). */
export const SECTIONS: [string, string][] = [
  ['hero', 'Bovenaan: generator'], ['trust', 'Waarom wij'], ['dive', 'Wat gebeurt er als je scant (3D)'], ['story', 'Toepassingen (verhaal)'], ['how', 'Zo werkt het (filmpje)'],
  ['features', 'Functies'], ['pricing', 'Prijzen (kort)'], ['faq', 'Vragen en contact'], ['final', 'Afsluiter'],
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
