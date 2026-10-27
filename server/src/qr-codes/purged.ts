/* =========================================================
   LOGBOEK "DEFINITIEF VERWIJDERD" (Mijn QR-codes > Recent verwijderd, onderaan)
   - Alleen naam, soort, datum en door wie (of: automatisch na 30 dagen). Geen inhoud, geen bezoekersgegevens.
   - Settings 'purged:<eigenaar-id>', nieuwste eerst, max. 50 regels, regels ouder dan 1 jaar vallen eraf.
   ========================================================= */
import type { DatabaseService } from '../database/database.service';

export type Purged = { name: string; type: string; at: string; by: string | null; auto: boolean };
const key = (uid: string) => 'purged:' + uid;
const YEAR = 365 * 864e5;

export async function readPurged(db: DatabaseService, uid: string, now = Date.now()): Promise<Purged[]> {
  try { const v = JSON.parse((await db.getSetting(key(uid))) || '[]'); return Array.isArray(v) ? v.filter((x) => now - Date.parse(x.at) < YEAR) : []; } catch (e) { return []; }
}
export async function notePurged(db: DatabaseService, uid: string, e: Omit<Purged, 'at'>, now = Date.now()) {
  const list = await readPurged(db, uid, now);
  list.unshift({ ...e, name: String(e.name || '').slice(0, 120), by: e.by ? String(e.by).slice(0, 80) : null, at: new Date(now).toISOString() });
  await db.setSetting(key(uid), JSON.stringify(list.slice(0, 50)));
}
export async function clearPurged(db: DatabaseService, uid: string) { await db.setSetting(key(uid), null); }
