/* =========================================================
   ABONNEMENTEN (voorstel — nog zonder betaling)
   Het team kent een abonnement toe per klant (Beheer > Gebruikers); de limieten gelden meteen (server).
   Betalen komt later (aanbieder en sleutels volgen); de prijzen zijn een voorstel.
   Opslag: settings 'plan:<userId>'. Geen waarde = 'free' (testfase, geen limieten).
   ========================================================= */
// Prijzen (besluit Fabian, 19 okt): tussen goedkoop en de grote QR-diensten in. Iedereen begint met 14 dagen gratis proberen.
// Per jaar: het eerste jaar 2 maanden gratis (priceYear), daarna de gewone jaarprijs (priceYearAfter = 12 × maand).
export type Plan = { id: string; codes: number | null; statsDays: number | null; price: number | null; priceYear: number | null; priceYearAfter: number | null; users: number | null; trialDays: number | null };   // users: eigenaar + teamleden, null = onbeperkt
export const PLANS: Record<string, Plan> = {
  free:     { id: 'free',     codes: null, statsDays: null, price: null,  priceYear: null,  priceYearAfter: null,   users: 1,    trialDays: null },   // testfase
  standard: { id: 'standard', codes: 5,    statsDays: 30,   price: 4.99,  priceYear: 49.9,  priceYearAfter: 59.88,  users: 1,    trialDays: 14 },
  pro:      { id: 'pro',      codes: 50,   statsDays: 365,  price: 12.99, priceYear: 129.9, priceYearAfter: 155.88, users: 3,    trialDays: 14 },
  business: { id: 'business', codes: null, statsDays: null, price: 24.99, priceYear: 249.9, priceYearAfter: 299.88, users: null, trialDays: 14 },
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
