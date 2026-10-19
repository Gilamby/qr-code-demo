/* =========================================================
   ABONNEMENTEN (voorstel — nog zonder betaling)
   Het team kent een abonnement toe per klant (Beheer > Gebruikers); de limieten gelden meteen (server).
   Betalen komt later (aanbieder en sleutels volgen); de prijzen zijn een voorstel.
   Opslag: settings 'plan:<userId>'. Geen waarde = 'free' (testfase, geen limieten).
   ========================================================= */
export type Plan = { id: string; codes: number | null; statsDays: number | null; intro: number | null; price: number | null; priceYear: number | null; users: number | null };   // users: hoeveel mensen (eigenaar + teamleden), null = onbeperkt
export const PLANS: Record<string, Plan> = {
  free:     { id: 'free',     codes: null, statsDays: null, intro: null, price: null, priceYear: null, users: 1 },   // testfase
  standard: { id: 'standard', codes: 10,   statsDays: 30,   intro: 0,    price: 0.99, priceYear: 9.9, users: 1 },   // 1e maand gratis; jaar = 10 maanden (voorstel)
  pro:      { id: 'pro',      codes: 100,  statsDays: 365,  intro: 4.99, price: 9.99, priceYear: 99.9, users: 3 },
  business: { id: 'business', codes: null, statsDays: null, intro: 7.5,  price: 14.99, priceYear: 149.9, users: null },
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
