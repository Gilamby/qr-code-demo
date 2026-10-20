/* =========================================================
   ABONNEMENTEN (voorstel — nog zonder betaling)
   Het team kent een abonnement toe per klant (Beheer > Gebruikers); de limieten gelden meteen (server).
   Betalen komt later (aanbieder en sleutels volgen); de prijzen zijn een voorstel.
   Opslag: settings 'plan:<userId>'. Geen waarde = 'free' (testfase, geen limieten).
   ========================================================= */
// Prijzen (besluit Fabian, 19 okt): tussen goedkoop en de grote QR-diensten in. Iedereen begint met 14 dagen gratis proberen.
// Per kwartaal (Terms punt 4, besluit Fabian 20 okt): 3 maanden met ongeveer 10% korting (priceQuarter).
// Per jaar: het eerste jaar 2 maanden gratis (priceYear), daarna de gewone jaarprijs (priceYearAfter = 12 × maand).
/** Wat zit in welk pakket (besluit Fabian 20 okt):
 *  - soorten QR-codes: Standard alleen de basis (STANDARD_TYPES), Pro en Business alle 16
 *  - achtergrond: Standard alleen de standaard-achtergrond; Pro alle achtergronden en eigen foto's; Business ook eigen video's
 *  - team: Pro tot 3 personen, Business onbeperkt. Bestaande codes blijven werken als je naar een kleiner pakket gaat. */
export const STANDARD_TYPES = ['website', 'pdf', 'vcard', 'wifi', 'menu', 'whatsapp'];
export type BgLevel = 'basic' | 'photos' | 'all';
export type Plan = { id: string; types: string[] | null; bg: BgLevel; codes: number | null; statsDays: number | null; price: number | null; priceQuarter: number | null; priceYear: number | null; priceYearAfter: number | null; users: number | null; trialDays: number | null };   // users: eigenaar + teamleden, null = onbeperkt
export const PLANS: Record<string, Plan> = {
  free:     { id: 'free',     types: null,           bg: 'all',    codes: null, statsDays: null, price: null,  priceQuarter: null,  priceYear: null,  priceYearAfter: null,   users: 1,    trialDays: null },   // testfase
  standard: { id: 'standard', types: STANDARD_TYPES, bg: 'basic',  codes: 5,    statsDays: 30,   price: 4.99,  priceQuarter: 13.49, priceYear: 49.9,  priceYearAfter: 59.88,  users: 1,    trialDays: 14 },
  pro:      { id: 'pro',      types: null,           bg: 'photos', codes: 50,   statsDays: 365,  price: 12.99, priceQuarter: 34.99, priceYear: 129.9, priceYearAfter: 155.88, users: 3,    trialDays: 14 },
  business: { id: 'business', types: null,           bg: 'all',    codes: null, statsDays: null, price: 24.99, priceQuarter: 67.49, priceYear: 249.9, priceYearAfter: 299.88, users: null, trialDays: 14 },
};
export const PLAN_IDS = Object.keys(PLANS);
type Settings = { getSetting(k: string): Promise<string | null | undefined> };
/** Abonnement van een gebruiker */
export async function planFor(db: Settings, userId: string): Promise<Plan> {
  const v = await db.getSetting('plan:' + userId).catch(() => null);
  return (v && PLANS[v]) || PLANS.free;
}
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
