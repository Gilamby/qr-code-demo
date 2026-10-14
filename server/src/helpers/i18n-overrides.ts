/* Aanpassingen van teksten per taal (Beheer > Vertalingen), opgeslagen als settings 'i18n:<taal>'.
   Los bestand zonder andere imports, zodat zowel de e-mails als de beheerpagina het kunnen gebruiken. */
import type { DatabaseService } from '../database/database.service';

export const LANGS = ['en', 'nl', 'fr', 'es', 'it', 'de', 'pt', 'pl', 'el', 'sq'];

export async function overridesOf(db: DatabaseService, lang: string): Promise<Record<string, string>> {
  if (!LANGS.includes(lang)) return {};
  try { return JSON.parse((await db.getSetting('i18n:' + lang)) || '{}'); } catch (e) { return {}; }
}
