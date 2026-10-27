/* =========================================================
   GESCHIEDENIS VAN EEN QR-CODE: wat stond er vóór een wijziging, en terugzetten met één klik
   - Bij elke opgeslagen wijziging van de inhoud (bestemming, teksten, bestanden) bewaren we de vorige versie.
   - Max. 10 versies per code, in settings 'hist:<code-id>' (nieuwste eerst). Weg bij definitief verwijderen.
   - Terugzetten bewaart eerst de huidige versie, zodat ook het terugzetten weer ongedaan kan.
   - Een versie met een bestand dat intussen is vervangen (PDF, video, foto's) kan niet meer terug: dat bestand is opgeruimd.
   ========================================================= */
import { DatabaseService } from '../database/database.service';
import { QR_TYPES } from './validation';
import type { QrCode } from '../types';

export const HISTORY_MAX = 10;
export type Version = { at: string; by: string; content: Record<string, any>; name?: string };

const key = (id: string) => 'hist:' + id;
const typeOf = (typeId: string) => QR_TYPES.find((t) => t.id === typeId);

export async function readHistory(db: DatabaseService, codeId: string): Promise<Version[]> {
  try { const v = JSON.parse((await db.getSetting(key(codeId))) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
export async function clearHistory(db: DatabaseService, codeId: string) { await db.setSetting(key(codeId), null); }

/** Gelijke inhoud? (volgorde van sleutels maakt niet uit) */
function same(a: Record<string, any>, b: Record<string, any>) {
  const norm = (o: Record<string, any>) => JSON.stringify(Object.keys(o || {}).filter((k) => o[k] !== '' && o[k] != null).sort().map((k) => [k, o[k]]));
  return norm(a) === norm(b);
}

/** Vóór het opslaan van nieuwe inhoud: de oude versie bewaren (alleen als er echt iets verandert) */
export async function remember(db: DatabaseService, old: QrCode, next: Record<string, any>, by: string) {
  if (same(old.content || {}, next || {})) return;
  const list = await readHistory(db, old.id);
  list.unshift({ at: new Date().toISOString(), by: String(by || '').slice(0, 80), content: old.content || {}, name: old.name });
  await db.setSetting(key(old.id), JSON.stringify(list.slice(0, HISTORY_MAX)));
}

/** Bestanden waar deze versie naar verwijst */
export function fileIds(typeId: string, content: Record<string, any>): string[] {
  const t = typeOf(typeId), out: string[] = []; if (!t) return out;
  for (const f of t.fields) {
    if (!content[f.key]) continue;
    try {
      if (f.type === 'file') { const o = JSON.parse(content[f.key]); if (o && o.f) out.push(o.f); }
      if (f.type === 'gallery') for (const x of JSON.parse(content[f.key])) if (x && typeof x === 'object' && x.f) out.push(x.f);
    } catch (e) { /* oude vorm: zit in de inhoud zelf */ }
  }
  return out;
}

/** Bestaan alle bestanden van deze versie nog (van deze code)? */
export async function restorable(db: DatabaseService, q: QrCode, v: Version) {
  for (const id of fileIds(q.typeId, v.content)) { const f = await db.getFile(id); if (!f || f.code_id !== q.id) return false; }
  return true;
}

/** Wat de klant mag zien: geen wachtwoord-hash, wel of er een wachtwoord was */
export function publicVersion(typeId: string, v: Version) {
  const t = typeOf(typeId), c = { ...(v.content || {}) };
  const pw = t && t.fields.find((f: any) => f.type === 'password');
  const hasPassword = !!(pw && c[pw.key]); if (pw) delete c[pw.key];
  return { at: v.at, by: v.by, name: v.name || null, content: c, hasPassword };
}
