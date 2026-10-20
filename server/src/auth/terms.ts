/* =========================================================
   AKKOORD MET DE VOORWAARDEN (Terms of Service, punten 1 en 3)
   Wie een account maakt, bevestigt: 18 jaar of ouder (of toestemming van een ouder/voogd) en akkoord met de Terms
   en de Privacy Policy. We bewaren per account welke versie en wanneer: settings 'terms:<userId>' (JSON).
   Nieuwe versie van de Terms? Verhoog TERMS_VERSION: iedereen ziet dan één keer opnieuw het akkoord-scherm.
   ========================================================= */
import { DatabaseService } from '../database/database.service';

export const TERMS_VERSION = '2026-10-19';
export type TermsRecord = { v: string; at: string };

export async function termsAccepted(db: DatabaseService, userId: string): Promise<boolean> {
  try { const r = JSON.parse((await db.getSetting('terms:' + userId)) || 'null') as TermsRecord | null; return !!r && r.v === TERMS_VERSION; } catch { return false; }
}
export async function acceptTerms(db: DatabaseService, userId: string) {
  await db.setSetting('terms:' + userId, JSON.stringify({ v: TERMS_VERSION, at: new Date().toISOString() } as TermsRecord));
}
