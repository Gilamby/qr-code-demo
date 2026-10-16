/* Aanpassingen van teksten per taal (Beheer > Vertalingen), opgeslagen als settings 'i18n:<taal>'.
   Los bestand zonder andere imports, zodat zowel de e-mails als de beheerpagina het kunnen gebruiken. */
import type { DatabaseService } from '../database/database.service';

export const LANGS = ['en', 'nl', 'fr', 'es', 'it', 'de', 'pt', 'pl', 'el', 'sq', 'bg', 'ca', 'da', 'fi', 'lv', 'nb', 'ro', 'sk', 'sv'];
/** Taal uit de browser (Accept-Language): eerste die we kennen. Noors kan als no/nb/nn binnenkomen. */
export function fromAcceptLanguage(header: string, ok: (l: string) => boolean = (l) => LANGS.includes(l)): string {
  const list = String(header || '').split(',').map((x) => x.trim().slice(0, 2).toLowerCase()).map((l) => (l === 'no' || l === 'nn' ? 'nb' : l));
  return list.find(ok) || 'en';
}

export async function overridesOf(db: DatabaseService, lang: string): Promise<Record<string, string>> {
  if (!LANGS.includes(lang)) return {};
  try { return JSON.parse((await db.getSetting('i18n:' + lang)) || '{}'); } catch (e) { return {}; }
}
