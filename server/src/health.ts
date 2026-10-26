/* =========================================================
   HEALTH CHECK: werkt de bestemming van een QR-code nog?
   - Elke 24 uur (via het uurlijkse onderhoud) per code de links controleren: url, iPhone-/Android-link, A/B-link,
     link na afloop en knop-link. Alleen openbare adressen (url-check.ts weigert interne netwerken).
   - Pas na 2 mislukte pogingen op rij "niet bereikbaar" (een website die even hapert geeft geen vals alarm);
     na een mislukte poging over 1 uur opnieuw.
   - Bereikbaar maar weigert robots (401/403/405/429): telt als werkend, de website bestaat.
   Resultaat in instelling "health:<code-id>": { state, at, fails, bad: [{ url, status }] }
   ========================================================= */
import { urlInfo } from './helpers/url-check';
import type { QrCode } from './types';

export type Health = { state: 'ok' | 'down' | 'checking'; at: string; fails: number; bad: { url: string; status: number }[] };
const FIELDS = ['url', 'iosUrl', 'androidUrl', 'abUrl', 'afterUrl', 'buttonUrl'];
const DAY = 864e5, RETRY = 3600e3;

export function urlsOf(q: QrCode): string[] {
  const c: any = q.content || {}, out: string[] = [];
  for (const k of FIELDS) { const v = String(c[k] || '').trim(); if (/^https?:\/\/\S+$/i.test(v) && !out.includes(v)) out.push(v); }
  return out;
}
/** Eén link: 0 = niet bereikbaar (netwerk/geen DNS/intern adres) */
async function probe(url: string): Promise<number> {
  try { const r = await urlInfo(url); return r.status; } catch { return 0; }
}
const fine = (s: number) => (s >= 200 && s < 400) || [401, 403, 405, 429].includes(s);

export async function checkCode(q: QrCode, prev: Health | null, now = Date.now()): Promise<Health | null> {
  const urls = urlsOf(q); if (!urls.length) return null;
  const bad: Health['bad'] = [];
  for (const u of urls) { const s = await probe(u); if (!fine(s)) bad.push({ url: u, status: s }); }
  const fails = bad.length ? ((prev && prev.fails) || 0) + 1 : 0;
  return { state: bad.length ? (fails >= 2 ? 'down' : (prev && prev.state === 'down' ? 'down' : 'checking')) : 'ok', at: new Date(now).toISOString(), fails, bad };
}
export const due = (h: Health | null, now = Date.now()) => !h || now - Date.parse(h.at) >= (h.fails ? RETRY : DAY);

type Db = { allQrCodes(): Promise<QrCode[]>; getSetting(k: string): Promise<string | null>; setSetting(k: string, v: string | null): Promise<unknown> };
export async function readHealth(db: Db, id: string): Promise<Health | null> { try { return JSON.parse((await db.getSetting('health:' + id)) || 'null'); } catch { return null; } }

/** Onderhoud: codes die aan de beurt zijn controleren (max. 300 per keer, 4 tegelijk) */
let busy = false;
export async function healthSweep(db: Db, now = Date.now()) {
  if (busy) return; busy = true;
  try {
    const todo: QrCode[] = [];
    for (const q of await db.allQrCodes()) {
      if (q.paused || !urlsOf(q).length) continue;
      if (due(await readHealth(db, q.id), now)) todo.push(q);
      if (todo.length >= 300) break;
    }
    let i = 0;
    const worker = async () => { while (i < todo.length) { const q = todo[i++]; const h = await checkCode(q, await readHealth(db, q.id), now); await db.setSetting('health:' + q.id, h ? JSON.stringify(h) : null); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
  } finally { busy = false; }
}
