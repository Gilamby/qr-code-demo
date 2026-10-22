/* =========================================================
   SCANMELDING: mail aan de eigenaar bij de eerste scan van een code en bij mijlpalen (100, 1.000, 10.000 …).
   Aan/uit per klant in Mijn account > Meldingen. Draait na de doorverwijzing: de bezoeker wacht er nooit op.
   ========================================================= */
import type { DatabaseService } from './database/database.service';
import type { MailerService } from './auth/mailer.service';
import type { QrCode } from './types';

export const MILESTONES = [100, 1000, 10000, 100000, 1000000];

export async function scanAlert(db: DatabaseService, mailer: MailerService, q: QrCode) {
  const kind = q.scans === 1 ? 'first' : MILESTONES.includes(q.scans) ? 'milestone' : null;
  if (!kind) return;
  try {
    const u = await db.getUser(q.userId); if (!u || u.disabledAt) return;
    const p: any = u.emailPrefs || {};
    if (kind === 'first' ? p.firstScan === false : p.milestones === false) return;
    const name = q.name || (q.content && (q.content.title || q.content.name)) || q.id;
    await mailer.sendScanAlert(u, { id: q.id, name: String(name).slice(0, 80), scans: q.scans }, kind);
  } catch (e) { console.error('Scanmelding mislukt:', (e as Error).message); }
}
