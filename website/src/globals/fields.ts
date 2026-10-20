import type { Field } from 'payload'

/* Kleine helpers zodat de schema's leesbaar blijven. Alles met L() is per taal in te vullen. */
export const L = (name: string, label?: string, textarea = false): Field =>
  ({ name, label: label || name, type: textarea ? 'textarea' : 'text', localized: true }) as Field

export const group = (name: string, label: string, fields: Field[]): Field => ({ name, label, type: 'group', fields })

/** Lijst die per taal apart is (eigen aantal regels per taal) */
export const list = (name: string, label: string, fields: Field[]): Field =>
  ({ name, label, type: 'array', localized: true, fields }) as Field
