/* =========================================================
   ABONNEMENTEN (voorlopig)
   Er zijn nog geen betaalde abonnementen: iedereen heeft "free" zonder limieten.
   Zodra de pakketten en prijzen vastliggen, komen ze hier (één plek), bv.:
     pro: { codes: 100, ... }
   Het beheer (Alle QR-codes) toont al het abonnement van de eigenaar en hoeveel codes hij heeft t.o.v. de limiet.
   ========================================================= */
export type Plan = { id: string; codes: number | null };
export const PLANS: Record<string, Plan> = {
  free: { id: 'free', codes: null },               // null = geen limiet
};
/** Abonnement van een gebruiker (nu nog voor iedereen 'free') */
export function planOf(_user: unknown): Plan { return PLANS.free; }
/** Hoe vol is het abonnement? ok / near (≥ 90%) / full (limiet bereikt) */
export function usage(plan: Plan, codes: number) {
  if (plan.codes == null) return { used: codes, limit: null, state: 'ok' as const };
  return { used: codes, limit: plan.codes, state: codes >= plan.codes ? 'full' as const : codes >= plan.codes * 0.9 ? 'near' as const : 'ok' as const };
}
