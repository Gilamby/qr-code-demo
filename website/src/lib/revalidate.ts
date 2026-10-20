import { revalidatePath } from 'next/cache'

/** Na opslaan in het beheer: de website toont meteen de nieuwe tekst */
export const revalidateAll = ({ doc }: any) => {
  try { revalidatePath('/', 'layout') } catch { /* buiten een verzoek (bv. bij het vullen): niets te doen */ }
  return doc
}
