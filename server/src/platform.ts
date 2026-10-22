/* =========================================================
   PLATFORMINSTELLINGEN (Beheer > Instellingen), bewaard in de instelling "platform".
   Wat hier leeg is, komt uit .env (zoals voorheen).
   - signup:        'open' | 'closed' | null (null = ALLOW_SIGNUP in .env)
   - notifySignup:  mail naar het team bij elke nieuwe klant
   - contactEmail:  waar het contactformulier en meldingen heen gaan (anders CONTACT_EMAIL, anders MAIL_FROM)
   10 seconden onthouden, zodat niet elk verzoek de database leest.
   ========================================================= */
export type Platform = { signup: 'open' | 'closed' | null; notifySignup: boolean; contactEmail: string };
type Db = { getSetting(k: string): Promise<string | null> };
const EMPTY: Platform = { signup: null, notifySignup: false, contactEmail: '' };
let cache = { at: 0, v: EMPTY };

export async function platform(db: Db): Promise<Platform> {
  if (Date.now() - cache.at < 10000) return cache.v;
  let v = EMPTY;
  try { const r = JSON.parse((await db.getSetting('platform')) || '{}'); v = { signup: r.signup === 'open' || r.signup === 'closed' ? r.signup : null, notifySignup: !!r.notifySignup, contactEmail: String(r.contactEmail || '') }; } catch (e) { /* standaard */ }
  cache = { at: Date.now(), v }; return v;
}
export function forgetPlatform() { cache.at = 0; }
/** Staat zelf aanmelden open? Instelling in Beheer gaat voor .env */
export async function signupOpen(db: Db): Promise<boolean> {
  const p = await platform(db);
  return p.signup ? p.signup === 'open' : process.env.ALLOW_SIGNUP === 'true';
}
/** Adres van het team voor het contactformulier en meldingen */
export async function teamEmail(db: Db): Promise<string> {
  const p = await platform(db);
  return p.contactEmail || process.env.CONTACT_EMAIL || process.env.LEGAL_EMAIL || 'support@optimasys.es';   // standaard: support van OptimaSys (zoals in de voorwaarden)
}
