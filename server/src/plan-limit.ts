/* =========================================================
   MINDER CODES DAN JE HEBT (bv. van Pro naar Standard)
   Besluit Fabian 20 okt: niets wordt verwijderd. De klant kiest welke codes actief blijven (zoveel als het pakket toestaat);
   de rest wordt GEPAUZEERD: niet scanbaar, wel bewaard. Upgrade of een QR-code erbij = automatisch weer aan (meest gescand eerst).
   De limiet telt alleen actieve (niet-gepauzeerde) codes.
   Welke codes door het pakket gepauzeerd zijn: settings 'planPaused:<userId>' = [ids] (zelf pauzeren telt daar niet in mee).
   ========================================================= */
import { DatabaseService } from './database/database.service';
import { planFor } from './plans';
import { STATIC } from './qr-codes/moderation';

/** wifi en visitekaartje staan zelf in de QR-code: altijd aan, kunnen niet gepauzeerd worden (tellen wel mee) */
export const isStaticCode = (q: { contentType?: string }) => STATIC.includes(String(q.contentType));

export async function planPausedIds(db: DatabaseService, userId: string): Promise<string[]> {
  try { return JSON.parse((await db.getSetting('planPaused:' + userId)) || '[]') || []; } catch { return []; }
}
async function savePaused(db: DatabaseService, userId: string, ids: string[]) {
  await db.setSetting('planPaused:' + userId, ids.length ? JSON.stringify(ids) : null);
}
/** Code zelf aangezet of verwijderd: hoort niet meer bij "gepauzeerd door je pakket" */
export async function forgetPlanPaused(db: DatabaseService, userId: string, ids: string[]) {
  const cur = await planPausedIds(db, userId), rest = cur.filter((x) => ids.indexOf(x) < 0);
  if (rest.length !== cur.length) await savePaused(db, userId, rest);
}
/** Aantal actieve (niet-gepauzeerde) codes */
export async function activeCount(db: DatabaseService, userId: string) {
  return (await db.listQrCodes(userId)).filter((q) => !q.paused).length;
}

/** Codes laten passen bij het pakket. keep = de codes die de klant actief wil houden (bij het downgraden gekozen). */
export async function fitToPlan(db: DatabaseService, userId: string, keep?: string[] | null) {
  const plan = await planFor(db, userId), codes = await db.listQrCodes(userId);
  let paused = await planPausedIds(db, userId);
  const byScans = (a: any, b: any) => (b.scans || 0) - (a.scans || 0) || String(b.createdAt).localeCompare(String(a.createdAt));
  if (plan.codes == null) {                                                   // onbeperkt: alles weer aan wat door het pakket uit stond
    for (const q of codes) if (q.paused && paused.includes(q.id)) await db.updateQrCode(q.id, { paused: false } as any);
    return savePaused(db, userId, []);
  }
  const limit = plan.codes, active = codes.filter((q) => !q.paused);
  if (active.length > limit) {
    const fixed = active.filter(isStaticCode), room = Math.max(0, limit - fixed.length), dyn = active.filter((q) => !isStaticCode(q));
    const stay = new Set(fixed.map((q) => q.id)), wanted = Array.isArray(keep) ? keep.filter((id) => dyn.some((q) => q.id === id)).slice(0, room) : [];
    wanted.forEach((id) => stay.add(id));
    for (const q of dyn.slice().sort(byScans)) { if (stay.size - fixed.length >= room) break; stay.add(q.id); }   // aanvullen met de meest gescande
    for (const q of active) if (!stay.has(q.id)) { await db.updateQrCode(q.id, { paused: true } as any); paused.push(q.id); }
  } else if (active.length < limit && paused.length) {                        // meer ruimte: door het pakket gepauzeerde codes weer aan
    let room = limit - active.length;
    for (const q of codes.filter((x) => x.paused && paused.includes(x.id)).sort(byScans)) {
      if (room <= 0) break; await db.updateQrCode(q.id, { paused: false } as any); paused = paused.filter((x) => x !== q.id); room--;
    }
  }
  paused = paused.filter((id) => codes.some((q) => q.id === id));             // verwijderde codes vergeten
  await savePaused(db, userId, Array.from(new Set(paused)));
}
