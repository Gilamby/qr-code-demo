/* =========================================================
   ABONNEMENT: BETAALPERIODE, BEDENKTIJD EN VERWIJDEREN
   Regels (Terms of Service van Geert, 20-10-2026, punt 5):
   - Loopt de betaalde periode af zonder nieuwe betaling, dan werken de QR-codes meteen niet meer
     (bezoeker ziet "niet actief", klant kan niets wijzigen of bekijken). Ze worden NIET meteen verwijderd.
   - Betaalt de klant binnen 30 dagen, dan werkt alles weer, ook de geprinte codes.
   - Na 30 dagen worden alle QR-codes (en bestanden) van de klant verwijderd (niet langer bewaren: AVG).
   - Waarschuwingsmails: bij het begin, 7 dagen en 1 dag voor het verwijderen.
   Zonder betaalperiode (testfase, gratis) en voor het team geldt dit niet.
   Zelf geregistreerd (mustPay): het account bestaat, maar codes maken kan pas na het kiezen en betalen van een abonnement.
   De periode zet nu het team (Beheer > Gebruikers > Betaald); straks doet Stripe dat automatisch.
   Opslag: settings 'sub:<userId>' (JSON).
   ========================================================= */
export const DAY = 864e5;
export const RETAIN = 30 * DAY, RESET_AFTER = 365 * DAY;    // hoe lang we codes bewaren na het verlopen (Terms punt 5: 30 dagen)

export type Interval = 'month' | 'quarter' | 'year';
export const toInterval = (v: unknown): Interval => (v === 'year' ? 'year' : v === 'quarter' ? 'quarter' : 'month');
export interface Sub {
  interval: Interval;
  periodEnd: string | null;      // tot wanneer is betaald
  graceUntil: string | null;     // einde van de huidige bedenktijd (null = niet te laat)
  lapses: number;                // hoe vaak te laat (bepaalt de lengte van de bedenktijd)
  lastLapseAt: string | null;    // begin van de laatste keer te laat
  notified: string[];            // verstuurde waarschuwingen in deze bedenktijd: start, week, day
  deletedAt: string | null;      // codes verwijderd na de bedenktijd
  mustPay?: boolean;             // zelf geregistreerd: eerst een abonnement kiezen en betalen, dan pas codes maken
}
export type SubState = 'none' | 'unpaid' | 'active' | 'grace' | 'ended';

export const emptySub = (interval: Interval = 'month'): Sub => ({ interval, periodEnd: null, graceUntil: null, lapses: 0, lastLapseAt: null, notified: [], deletedAt: null });

/** Hoe lang de codes bewaard blijven na het verlopen (altijd 30 dagen; n = hoeveelste keer te laat, alleen nog voor de statistiek) */
export function graceMs(_n: number): number { return RETAIN; }

/** Hoeveelste keer te laat is dit? Na 12 maanden zonder te laat betalen telt het weer als de eerste keer. */
export function nextLapse(s: Sub, at: number): number {
  return s.lastLapseAt && at - Date.parse(s.lastLapseAt) < RESET_AFTER ? s.lapses + 1 : 1;
}

/** Staat op een moment: none (geen betaalperiode), active, grace (codes werken niet, nog te redden), ended (codes verwijderd) */
export function stateOf(s: Sub | null, now = Date.now()): SubState {
  if (s && !s.periodEnd && s.mustPay) return 'unpaid';           // nog nooit betaald
  if (!s || !s.periodEnd) return 'none';
  if (now < Date.parse(s.periodEnd)) return 'active';
  if (s.deletedAt) return 'ended';
  return 'grace';
}

/** Einde van de bedenktijd (ook als die nog niet is vastgelegd door het opruimen) */
export function graceEnd(s: Sub): number | null {
  if (!s.periodEnd) return null;
  if (s.graceUntil) return Date.parse(s.graceUntil);
  const start = Date.parse(s.periodEnd);
  return start + graceMs(nextLapse(s, start));
}

/** Betaald: nieuwe periode vanaf het einde van de vorige (op tijd) of vanaf nu (te laat). Bedenktijd stopt. */
export function renew(s: Sub, interval: Interval, now = Date.now()): Sub {
  const from = s.periodEnd && Date.parse(s.periodEnd) > now ? new Date(s.periodEnd) : new Date(now);
  const end = new Date(from);
  if (interval === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1); else end.setUTCMonth(end.getUTCMonth() + (interval === 'quarter' ? 3 : 1));
  return { ...s, interval, periodEnd: end.toISOString(), graceUntil: null, notified: [], deletedAt: null, mustPay: false };
}

/** Wat moet het opruimen nu doen? Pure functie: geeft de nieuwe staat en de acties terug (getest in test/). */
export function tick(s: Sub, now = Date.now()): { sub: Sub; actions: Array<'mail:start' | 'mail:week' | 'mail:day' | 'delete' | 'mail:deleted'> } {
  const out = { ...s, notified: [...(s.notified || [])] }, actions: any[] = [];
  if (!s.periodEnd || now < Date.parse(s.periodEnd) || s.deletedAt) return { sub: out, actions };
  if (!out.graceUntil) {                                   // net te laat: bedenktijd vastleggen
    const start = Date.parse(s.periodEnd), n = nextLapse(s, start);
    out.lapses = n; out.lastLapseAt = s.periodEnd; out.graceUntil = new Date(start + graceMs(n)).toISOString(); out.notified = [];
  }
  const end = Date.parse(out.graceUntil), total = end - Date.parse(s.periodEnd), left = end - now;
  if (left <= 0) { out.deletedAt = new Date(now).toISOString(); actions.push('delete', 'mail:deleted'); return { sub: out, actions }; }
  const send = (k: string) => { if (!out.notified.includes(k)) { out.notified.push(k); actions.push('mail:' + k); } };
  send('start');
  if (total > 14 * DAY && left <= 7 * DAY && left > DAY) send('week');
  if (total > 2 * DAY && left <= DAY) send('day');
  return { sub: out, actions };
}

/* ---------- Opslag ---------- */
type Settings = { getSetting(k: string): Promise<string | null | undefined>; setSetting(k: string, v: string | null): Promise<void> };
export async function subFor(db: Settings, userId: string): Promise<Sub | null> {
  try { const v = await db.getSetting('sub:' + userId); return v ? { ...emptySub(), ...JSON.parse(v) } : null; } catch (e) { return null; }
}
export async function saveSub(db: Settings, userId: string, s: Sub | null) {
  await db.setSetting('sub:' + userId, s ? JSON.stringify(s) : null);
  track(userId, s);
}

/* ---------- Wie is geblokkeerd? (in het geheugen, voor elke scan en elk verzoek) ---------- */
// Per klant met een betaalperiode: tot wanneer is betaald. Geblokkeerd zodra dat moment voorbij is (meteen, niet pas bij het volgende opruimen).
const paidUntil = new Map<string, number>();
export function isBlocked(userId: string, now = Date.now()) { const t = paidUntil.get(userId); return t != null && now >= t; }
function track(userId: string, s: Sub | null) {
  if (s && s.periodEnd) paidUntil.set(userId, Date.parse(s.periodEnd));
  else if (s && s.mustPay) paidUntil.set(userId, 0);                  // nog niet betaald: geblokkeerd
  else paidUntil.delete(userId);
}
/** Bij het starten en elk uur: lijst opnieuw opbouwen */
export function rebuildBlocked(entries: Array<[string, Sub | null]>) { paidUntil.clear(); for (const [id, s] of entries) track(id, s); }

/** Voor de app: samenvatting die de klant ziet */
export function publicSub(s: Sub | null, now = Date.now()) {
  if (!s) return { state: 'none' as SubState };
  const st = stateOf(s, now), ge = st === 'grace' ? graceEnd(s) : null;
  return { state: st, interval: s.interval, periodEnd: s.periodEnd, graceUntil: ge ? new Date(ge).toISOString() : null, lapses: s.lapses,
    nextGraceDays: Math.round(graceMs(s.lastLapseAt && now - Date.parse(s.lastLapseAt) < RESET_AFTER ? s.lapses + 1 : 1) / DAY * 10) / 10 };
}
