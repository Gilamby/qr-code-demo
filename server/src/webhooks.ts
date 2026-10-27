/* =========================================================
   WEBHOOKS (Business): bij een scan of een wijziging sturen we een POST naar de link van de klant
   - Max. 5 per account, settings 'webhooks:<eigenaar-id>'. Gebeurtenissen: scan, code (gemaakt / gewijzigd / verwijderd).
   - Inhoud (JSON): { event, at, code: { id, name, type, shortUrl }, scan?: { country, device, os } } — nooit een IP-adres.
   - Handtekening: header X-QR-Codex-Signature = "sha256=" + HMAC-SHA256(geheim, body). Zo weet de klant dat het van ons komt.
   - Alleen openbare adressen (geen interne netwerken), geen doorverwijzingen volgen, 5 s wachten, nooit de bezoeker laten wachten.
   - 20 mislukkingen op rij: uitgezet (klant ziet dat in de app en kan hem weer aanzetten).
   ========================================================= */
import * as crypto from 'crypto';
import type { DatabaseService } from './database/database.service';
import { assertPublic } from './helpers/url-check';
import { planFor } from './plans';

export type Hook = { id: string; url: string; events: ('scan' | 'code')[]; secret: string; createdAt: string; on: boolean; last?: { at: string; ok: boolean; status: number | null } | null; fails: number };
export const MAX_HOOKS = 5;
const key = (uid: string) => 'webhooks:' + uid;

export async function listHooks(db: DatabaseService, uid: string): Promise<Hook[]> {
  try { const v = JSON.parse((await db.getSetting(key(uid))) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
export async function saveHooks(db: DatabaseService, uid: string, list: Hook[]) { await db.setSetting(key(uid), list.length ? JSON.stringify(list) : null); }
export const publicHook = (h: Hook) => ({ id: h.id, url: h.url, events: h.events, on: h.on, last: h.last || null, fails: h.fails || 0, createdAt: h.createdAt, secretHint: h.secret.slice(0, 6) + '…' });
export function newHook(url: string, events: string[]): Hook {
  return { id: crypto.randomBytes(5).toString('hex'), url, events: events.filter((e) => e === 'scan' || e === 'code') as any, secret: 'whsec_' + crypto.randomBytes(24).toString('base64url'), createdAt: new Date().toISOString(), on: true, last: null, fails: 0 };
}
export const sign = (secret: string, body: string) => 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

/** Eén keer versturen (ook voor de test-knop) */
export async function deliver(h: Hook, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number | null }> {
  const body = JSON.stringify(payload);
  try {
    if (process.env.WEBHOOK_ALLOW_PRIVATE !== '1') await assertPublic(h.url);   // alleen in tests mag localhost
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(h.url, { method: 'POST', redirect: 'manual', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'QR-Codex-Webhook/1', 'X-QR-Codex-Event': String(payload.event), 'X-QR-Codex-Signature': sign(h.secret, body) }, body });
      return { ok: r.status >= 200 && r.status < 300, status: r.status };
    } finally { clearTimeout(timer); }
  } catch (e) { return { ok: false, status: null }; }
}

/** Gebeurtenis van een klant: naar al zijn actieve webhooks voor dit soort (op de achtergrond) */
export async function fire(db: DatabaseService, uid: string, kind: 'scan' | 'code', payload: Record<string, unknown>) {
  const list = await listHooks(db, uid); if (!list.some((h) => h.on && h.events.includes(kind))) return;
  if (!(await planFor(db, uid)).api) return;                                   // alleen Business (pakket kan intussen zijn veranderd)
  const results = await Promise.all(list.map((h) => (h.on && h.events.includes(kind) ? deliver(h, payload) : null)));
  const fresh = await listHooks(db, uid), at = new Date().toISOString();       // opnieuw lezen: kan intussen gewijzigd zijn
  list.forEach((h, i) => {
    const r = results[i]; if (!r) return; const f = fresh.find((x) => x.id === h.id); if (!f) return;
    f.last = { at, ok: r.ok, status: r.status }; f.fails = r.ok ? 0 : (f.fails || 0) + 1; if (f.fails >= 20) f.on = false;
  });
  await saveHooks(db, uid, fresh);
}
