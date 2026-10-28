/* =========================================================
   ABONNEMENTEN (voorstel — nog zonder betaling)
   Het team kent een abonnement toe per klant (Beheer > Gebruikers); de limieten gelden meteen (server).
   Betalen komt later (aanbieder en sleutels volgen); de prijzen zijn een voorstel.
   Opslag: settings 'plan:<userId>'. Geen waarde = 'free' (testfase, geen limieten).
   ========================================================= */
// Prijzen (besluit Fabian, 19 okt): tussen goedkoop en de grote QR-diensten in. Iedereen begint met 14 dagen gratis proberen.
// Per kwartaal (Terms punt 4, besluit Fabian 20 okt): 3 maanden met ongeveer 10% korting (priceQuarter).
// Per jaar: het EERSTE jaar 2 maanden gratis (priceYear), daarna de gewone jaarprijs (priceYearAfter = 12 × maand). Acties gelden één keer per klant (besluit Fabian 21 okt).
// Nieuwe klant per maand: na de 14 dagen gratis een actieprijs voor de eerste maand (priceFirstMonth), besluit Fabian 21 okt.
/** Wat zit in welk pakket (besluit Fabian 20 okt):
 *  - soorten QR-codes: iedereen alle 16 (besluit 20 okt: niet frustreren); het aantal codes hoort bij het pakket (Standard 5)
 *  - vol? Eén QR-code erbij kopen (EXTRA_PRICE per stuk) of upgraden
 *  - achtergrond: Standard alleen de standaard-achtergrond; Pro alle achtergronden en eigen foto's; Business ook eigen video's
 *  - team: Pro tot 3 personen, Business onbeperkt. Bestaande codes blijven werken als je naar een kleiner pakket gaat. */
export const STANDARD_TYPES = ['website', 'pdf', 'vcard', 'wifi', 'menu', 'whatsapp'];
export type BgLevel = 'basic' | 'photos' | 'all';
/** Standard: alleen de 16 soorten van pagina 1. De extra soorten (pagina 2) horen bij Pro en Business. */
export const BASIC_TYPES = ['website', 'pdf', 'links', 'vcard', 'business', 'video', 'images', 'facebook', 'instagram', 'social', 'whatsapp', 'mp3', 'menu', 'apps', 'coupon', 'wifi'];
export type Plan = { id: string; types: string[] | null; bg: BgLevel; codes: number | null; extra?: number; statsDays: number | null; price: number | null; priceQuarter: number | null; priceYear: number | null; priceYearAfter: number | null; users: number | null; trialDays: number | null; priceFirstMonth: number | null; bulk: boolean; api: boolean };   // bulk = veel codes tegelijk uit een bestand (Pro, Business); api = eigen software koppelen (Business)   // users: eigenaar + teamleden, null = onbeperkt
export const PLANS: Record<string, Plan> = {
  free:     { id: 'free',     types: null,           bg: 'all',    codes: null, statsDays: null, price: null,  priceQuarter: null,  priceYear: null,  priceYearAfter: null,   users: 1,    trialDays: null, priceFirstMonth: null, bulk: true, api: true },   // testfase
  standard: { id: 'standard', types: BASIC_TYPES,           bg: 'basic',  codes: 5,    statsDays: 30,   price: 4.99,  priceQuarter: 13.49, priceYear: 49.9,  priceYearAfter: 59.88,  users: 1,    trialDays: 14, priceFirstMonth: 1.99, bulk: false, api: false },
  pro:      { id: 'pro',      types: null,           bg: 'photos', codes: 50,   statsDays: 365,  price: 12.99, priceQuarter: 34.99, priceYear: 129.9, priceYearAfter: 155.88, users: 3,    trialDays: 14, priceFirstMonth: 4.99, bulk: true, api: false },
  business: { id: 'business', types: null,           bg: 'all',    codes: null, statsDays: null, price: 24.99, priceQuarter: 67.49, priceYear: 249.9, priceYearAfter: 299.88, users: null, trialDays: 14, priceFirstMonth: 9.99, bulk: true, api: true },
};
export const PLAN_IDS = Object.keys(PLANS);
type Settings = { getSetting(k: string): Promise<string | null | undefined> };
/** Abonnement van een gebruiker */
export async function planFor(db: Settings, userId: string): Promise<Plan> {
  const v = await db.getSetting('plan:' + userId).catch(() => null);
  const plan = (v && PLANS[v]) || PLANS.free;
  if (plan.codes == null) return plan;
  const extra = Math.max(0, Number(await db.getSetting('extra:' + userId).catch(() => 0)) || 0);   // losse QR-codes erbij gekocht
  return extra ? { ...plan, codes: plan.codes + extra, extra } : plan;
}
/** Prijs van één extra QR-code, per betaalperiode van het abonnement (kwartaal ±10% korting, jaar 10 maanden) */
export const EXTRA_PRICE = { month: 0.99, quarter: 2.67, year: 9.9 } as const;
export const EXTRA_MAX = 100;
/** Hoe vol is het abonnement? ok / near (≥ 90%) / full (limiet bereikt) */
export function usage(plan: Plan, codes: number) {
  if (plan.codes == null) return { used: codes, limit: null, state: 'ok' as const };
  return { used: codes, limit: plan.codes, state: codes >= plan.codes ? 'full' as const : codes >= plan.codes * 0.9 ? 'near' as const : 'ok' as const };
}
/** Vroegste dag (YYYY-MM-DD) die de statistieken mogen tonen, of null */
export function statsFloor(plan: Plan): string | null {
  return plan.statsDays ? new Date(Date.now() - (plan.statsDays - 1) * 864e5).toISOString().slice(0, 10) : null;
}

/** Mag dit pakket deze soort QR-code maken? */
export const typeAllowed = (plan: Plan, typeId: string) => !plan.types || plan.types.includes(typeId);
/** Achtergrond: 'extra' = andere standaard-achtergronden, 'image' = eigen foto, 'video' = eigen video */
export function bgAllowed(plan: Plan, what: 'extra' | 'image' | 'video') {
  return what === 'video' ? plan.bg === 'all' : plan.bg !== 'basic';
}
