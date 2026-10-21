/* =========================================================
   STRIPE (echt betalen; Terms punt 4 en 5)
   Werkt alleen als STRIPE_SECRET_KEY in .env staat (testmodus: sk_test_…). Anders blijft de demo of de aanvraag.
   - Afrekenen: Stripe Checkout (de betaalpagina van Stripe zelf). Eerste keer: 14 dagen gratis, kaart vooraf.
   - Beheren: Stripe Customer Portal (facturen, betaalgegevens, opzeggen).
   - Stripe meldt alles via de webhook (/api/billing/webhook, STRIPE_WEBHOOK_SECRET). Die zet het pakket en de betaalperiode.
   Geen extra pakket nodig: gewone HTTPS-aanroepen naar api.stripe.com. API-versie vast, zodat velden niet verschuiven.
   Per klant bewaard: settings 'stripe:<userId>' = { customer, subscription, cancelMailed }.
   ========================================================= */
import * as crypto from 'crypto';
import { PLANS, Plan } from '../plans';
import type { Interval } from '../subscription';

export const STRIPE_VERSION = '2024-06-20';
export const stripeOn = () => !!process.env.STRIPE_SECRET_KEY;
/** Demo-betaling (er wordt niets afgeschreven): standaard aan zolang Stripe er niet is. Uitzetten: DEMO_CHECKOUT=false.
 *  Zodra STRIPE_SECRET_KEY er staat, is de demo vanzelf uit. */
export const demoCheckoutOn = () => !stripeOn() && process.env.DEMO_CHECKOUT !== 'false';
export type StripeRecord = { customer?: string; subscription?: string; cancelMailed?: string | null; status?: string; cancelAtEnd?: boolean };
type Settings = { getSetting(k: string): Promise<string | null | undefined>; setSetting(k: string, v: string | null): Promise<void> };

export async function readRecord(db: Settings, userId: string): Promise<StripeRecord> {
  try { return JSON.parse((await db.getSetting('stripe:' + userId)) || '{}') || {}; } catch { return {}; }
}
export async function writeRecord(db: Settings, userId: string, r: StripeRecord) { await db.setSetting('stripe:' + userId, JSON.stringify(r)); }

/** Parameters zoals Stripe ze wil: a[b][0][c]=… */
export function form(obj: any, prefix = '', out: string[] = []): string {
  for (const k of Object.keys(obj || {})) {
    const v = obj[k], key = prefix ? prefix + '[' + k + ']' : k;
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'object' ? form(x, key + '[' + i + ']', out) : out.push(encodeURIComponent(key + '[' + i + ']') + '=' + encodeURIComponent(String(x)))));
    else if (typeof v === 'object') form(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}

/** Eén aanroep naar Stripe. Bij een fout: Error met de melding van Stripe. */
export async function stripe(method: 'GET' | 'POST' | 'DELETE', path: string, params?: any): Promise<any> {
  const q = method === 'GET' && params ? '?' + form(params) : '';
  const r = await fetch('https://api.stripe.com/v1/' + path + q, {
    method, headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': STRIPE_VERSION },
    body: method === 'GET' ? undefined : form(params || {}),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j && j.error && j.error.message) || 'Stripe ' + r.status);
  return j;
}

/** Bedrag in centen voor een pakket en periode. Per jaar: de gewone jaarprijs; de korting van het eerste jaar (nieuwe klant) gaat via een coupon. */
export function amountFor(plan: Plan, interval: Interval) {
  const eur = interval === 'year' ? plan.priceYearAfter : interval === 'quarter' ? plan.priceQuarter : plan.price;
  return Math.round(Number(eur) * 100);
}
/** Korting eerste jaar (2 maanden gratis) in centen, of 0 */
export function firstYearDiscount(plan: Plan) { return plan.priceYearAfter && plan.priceYear ? Math.round((plan.priceYearAfter - plan.priceYear) * 100) : 0; }
export const recurringOf = (interval: Interval) => (interval === 'year' ? { interval: 'year', interval_count: 1 } : { interval: 'month', interval_count: interval === 'quarter' ? 3 : 1 });
export const planName = (id: string) => 'QR-Codex ' + ({ standard: 'Standard', pro: 'Pro', business: 'Business' } as any)[id];
export const isPlanId = (id: unknown): id is string => typeof id === 'string' && ['standard', 'pro', 'business'].includes(id) && !!PLANS[id];

/** Handtekening van een webhook controleren (Stripe-Signature: t=…,v1=…; HMAC-SHA256 over "t.payload"), max. 5 minuten oud */
export function verifySignature(raw: Buffer | string, header: string, secret: string, now = Date.now()): boolean {
  if (!raw || !header || !secret) return false;
  const parts = String(header).split(',').map((p) => p.split('=')), t = (parts.find(([k]) => k === 't') || [])[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(now / 1000 - Number(t)) > 300) return false;
  const want = crypto.createHmac('sha256', secret).update(t + '.' + (Buffer.isBuffer(raw) ? raw.toString('utf8') : raw)).digest('hex');
  return sigs.some((s) => s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)));
}
