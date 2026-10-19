/* Elk uur: opruimen (verlopen sessies en links, nooit bevestigde accounts na 7 dagen) en scanoverzichten per e-mail versturen */
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { MailerService } from './auth/mailer.service';
import { sendDueReports } from './reports';
import { subFor, saveSub, tick, rebuildBlocked, graceEnd } from './subscription';

@Injectable()
export class HousekeepingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout;
  constructor(private readonly db: DatabaseService, private readonly mailer: MailerService) {}

  onApplicationBootstrap() {
    const tidy = () => { this.db.cleanup().catch((e) => console.error('Opruimen mislukt:', e.message)); sendDueReports(this.db, this.mailer).catch((e) => console.error('Scanoverzichten mislukt:', e.message)); this.subscriptions().catch((e) => console.error('Abonnementen nakijken mislukt:', e.message)); };
    tidy();
    this.timer = setInterval(tidy, 3600e3); this.timer.unref();
  }
  /** Abonnementen: bedenktijd vastleggen, waarschuwen, na de bedenktijd de codes verwijderen (regels: subscription.ts) */
  async subscriptions(now = Date.now()) {
    const entries: Array<[string, any]> = [];
    for (const u of await this.db.listCustomers()) {
      const s = await subFor(this.db, u.id); entries.push([u.id, s]);
      if (!s) continue;
      const r = tick(s, now);
      if (!r.actions.length && JSON.stringify(r.sub) === JSON.stringify(s)) continue;
      if (r.actions.includes('delete')) {
        for (const q of await this.db.listQrCodes(u.id)) await this.db.deleteQrCode(q.id, u.id).catch(() => false);
        await this.db.addAdminLog({ adminId: 'system', adminName: 'system', action: 'sub_deleted', codeId: null, ownerId: u.id, detail: u.email }).catch(() => {});
      }
      await saveSub(this.db, u.id, r.sub);
      entries[entries.length - 1][1] = r.sub;
      for (const a of r.actions) if (a.startsWith('mail:')) await this.mailer.sendLapse(await this.db.getUser(u.id), a.slice(5) as any, graceEnd(r.sub)).catch((e) => console.error('Abonnementsmail mislukt:', e.message));
    }
    rebuildBlocked(entries);
  }
  onApplicationShutdown() { clearInterval(this.timer); }
}
