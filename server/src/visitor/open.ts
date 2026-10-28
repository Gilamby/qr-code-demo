/* Mag een bezoeker nu iets insturen bij deze code (feedback, aanmelding, formulier)?
   Dezelfde regels als het openen van de code: niet verwijderd, niet uit, abonnement in orde, binnen de geplande periode. */
import type { DatabaseService } from '../database/database.service';
import type { QrCode } from '../types';
import { isBlocked } from '../subscription';
import * as rules from './rules';

export async function ownerZone(db: DatabaseService, userId: string) {
  const u: any = await db.getUser(userId).catch(() => null);
  const dev = u && !u.timezone ? await db.getSetting('devtz:' + userId).catch(() => null) : null;
  return (u && u.timezone) || dev || 'Europe/Madrid';
}
export async function openForInput(db: DatabaseService, q: QrCode | null, typeId: string) {
  if (!q || q.typeId !== typeId || q.trashedAt || q.paused || isBlocked(q.userId)) return false;
  const c: any = q.content || {};
  const now = rules.nowIn(c.starts || c.expires ? await ownerZone(db, q.userId) : undefined);
  return !rules.isExpired(q, now) && !rules.notYet(q, now);
}
