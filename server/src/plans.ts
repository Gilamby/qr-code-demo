/* =========================================================
   ABONNEMENTEN (voorstel — nog zonder betaling)
   Het team kent een abonnement toe per klant (Beheer > Gebruikers); de limieten gelden meteen (server).
   Betalen komt later (aanbieder en sleutels volgen); de prijzen zijn een voorstel.
   Opslag: settings 'plan:<userId>'. Geen waarde = 'free' (testfase, geen limieten).
   ========================================================= */
export type Plan = { id: string; codes: number | null; statsDays: number | null; intro: number | null; price: number | null };
export const PLANS: Record<string, Plan> = {
  free:     { id: 'free',     codes: null, statsDays: null, intro: null, price: null },   // testfase
  standard: { id: 'standard', codes: 10,   statsDays: 30,   intro: 0,    price: 0.99 },   // 1e maand gratis
  pro:      { id: 'pro',      codes: 100,  statsDays: 365,  intro: 4.99, price: 9.99 },
  business: { id: 'business', codes: 1000, statsDays: null, intro: 7.5,  price: 14.99 },
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
