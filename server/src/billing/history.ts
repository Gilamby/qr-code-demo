/* =========================================================
   BETAALOVERZICHT voor "Abonnement en facturen"
   - Met Stripe: de echte facturen komen van Stripe (GET /v1/invoices), met link naar de factuur/PDF.
   - Demo (zonder Stripe): de demo-betalingen worden hier bijgehouden (settings 'payments:<uid>'), duidelijk als demo.
   'paymeta:<uid>' = gekozen betaalmethode in de demo (alleen om te tonen).
   ========================================================= */
import type { Interval } from '../subscription';

type Settings = { getSetting(k: string): Promise<string | null | undefined>; setSetting(k: string, v: string | null): Promise<void> };
export type Payment = { id: string; at: string; kind: 'plan' | 'extra'; plan: string; interval: Interval; n?: number; amount: number; status: 'paid' | 'trial'; method: string | null; demo: true };
export const METHODS = ['paypal', 'ideal', 'bancontact', 'card'];

export async function listPayments(db: Settings, uid: string): Promise<Payment[]> {
  try { const x = JSON.parse((await db.getSetting('payments:' + uid)) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; }
}
export async function addPayment(db: Settings, uid: string, p: Omit<Payment, 'id' | 'at' | 'demo'>) {
  const list = await listPayments(db, uid), at = new Date();
  const id = 'DEMO-' + at.toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(list.length + 1).padStart(3, '0');
  list.unshift({ id, at: at.toISOString(), demo: true, ...p });
  await db.setSetting('payments:' + uid, JSON.stringify(list.slice(0, 60)));
}
export async function demoMethod(db: Settings, uid: string): Promise<string | null> {
  try { return (JSON.parse((await db.getSetting('paymeta:' + uid)) || '{}') || {}).method || null; } catch { return null; }
}
export async function setDemoMethod(db: Settings, uid: string, method: unknown) {
  if (typeof method === 'string' && METHODS.includes(method)) await db.setSetting('paymeta:' + uid, JSON.stringify({ method }));
}
