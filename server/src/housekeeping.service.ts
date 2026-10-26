/* Elk uur: opruimen (verlopen sessies en links, nooit bevestigde accounts na 7 dagen) en scanoverzichten per e-mail versturen */
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { MailerService } from './auth/mailer.service';
import { sendDueReports } from './reports';
import { subFor, saveSub, tick, rebuildBlocked, graceEnd } from './subscription';
import { stripeOn, readRecord } from './billing/stripe';
import { planFor, EXTRA_PRICE } from './plans';

@Injectable()
export class HousekeepingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout;
  constructor(private readonly db: DatabaseService, private readonly mailer: MailerService) {}

  onApplicationBootstrap() {
    const tidy = () => { this.db.cleanup().catch((e) => console.error('Opruimen mislukt:', e.message)); sendDueReports(this.db, this.mailer).catch((e) => console.error('Scanoverzichten mislukt:', e.message)); this.subscriptions().catch((e) => console.error('Abonnementen nakijken mislukt:', e.message)); this.legacyReminders().catch((e) => console.error('Herinneringen oude QR-app mislukt:', e.message)); };
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
    await this.reminders(now).catch((e) => console.error('Herinneringen abonnement mislukt:', e.message));
  }
  /** 3 dagen vooraf een herinnering: opgezegd abonnement stopt, of de gratis proef stopt en de eerste betaling volgt (één keer per einddatum) */
  async reminders(now = Date.now()) {
    if (!stripeOn()) return;
    for (const u of await this.db.listCustomers()) {
      const rec = await readRecord(this.db, u.id); if (!rec.subscription || rec.status === 'canceled') continue;
      const s = await subFor(this.db, u.id); if (!s || !s.periodEnd) continue;
      const end = Date.parse(s.periodEnd), left = end - now;
      if (left <= 0 || left > 7 * 864e5) continue;
      // 3 dagen vooraf: opgezegd of einde proef. 7 dagen vooraf: verlenging van een kwartaal- of jaarabonnement (per maand niet, dat is te vaak).
      const long = s.interval === 'year' || s.interval === 'quarter';
      const kind = rec.cancelAtEnd ? (left <= 3 * 864e5 ? 'end' : null) : rec.status === 'trialing' ? (left <= 3 * 864e5 ? 'trial' : null) : rec.status === 'active' && long ? 'renew' : null;
      if (!kind) continue;
      const key = 'remind:' + u.id, mark = kind + '|' + s.periodEnd;
      if ((await this.db.getSetting(key)) === mark) continue;
      await this.db.setSetting(key, mark);
      let amount: number | null = null;
      if (kind === 'renew') {
        const p = await planFor(this.db, u.id), iv = s.interval || 'year', base = iv === 'year' ? (p.priceYearAfter || p.priceYear) : p.priceQuarter;
        amount = Math.round(((Number(base) || 0) + (p.extra || 0) * ((EXTRA_PRICE as any)[iv] || 0)) * 100) / 100;
      }
      if (kind === 'trial') {
        const p = await planFor(this.db, u.id), iv = s.interval || 'month';
        const base = iv === 'month' && p.priceFirstMonth != null ? p.priceFirstMonth : iv === 'year' ? (p.priceYear != null ? p.priceYear : p.priceYearAfter) : iv === 'quarter' ? p.priceQuarter : p.price;
        amount = Math.round(((Number(base) || 0) + (p.extra || 0) * ((EXTRA_PRICE as any)[iv] || 0)) * 100) / 100;
      }
      const user = await this.db.getUser(u.id);
      if (user) await this.mailer.sendReminder(user, kind, end, amount).catch((e) => console.error('Herinnering mislukt:', e.message));
    }
  }
  /** Overgezette codes: het account bij de oude QR-app loopt af. Daarna werkt de geprinte code niet meer (hij gaat eerst langs die app).
      Herinnering per e-mail 60 en 14 dagen ervoor, en op de dag zelf. Zo weet het team het ook als niemand eraan denkt. */
  async legacyReminders(now = Date.now()) {
    for (const c of await this.db.listCustomers()) {
      let m: Record<string, { until: string; sent: string[] }>;
      try { const v = await this.db.getSetting('legacyUntil:' + c.id); m = v ? JSON.parse(v) : null; } catch (e) { m = null; }
      if (!m || !Object.keys(m).length) continue;
      let legacy: Record<string, string> = {};
      try { const v = await this.db.getSetting('legacy:' + c.id); legacy = v ? JSON.parse(v) : {}; } catch (e) { /* leeg */ }
      let changed = false, user: any = null;
      for (const id of Object.keys(m)) {
        const e = m[id], code = await this.db.getQrCode(id).catch(() => null);
        if (!code || code.userId !== c.id || !legacy[id]) { delete m[id]; changed = true; continue; }   // code weg of ontkoppeld
        const end = Date.parse(e.until + 'T00:00:00Z'), days = Math.ceil((end - now) / 864e5), sent = e.sent || (e.sent = []);
        const kind = days <= 0 ? 'over' : days <= 14 ? '14' : days <= 60 ? '60' : null;
        if (!kind || sent.includes(kind)) continue;
        // Een latere stap telt ook voor de eerdere (geen drie mails tegelijk bij een datum die al dichtbij is)
        ['60', '14', 'over'].slice(0, ['60', '14', 'over'].indexOf(kind) + 1).forEach((k) => { if (!sent.includes(k)) sent.push(k); });
        changed = true;
        user = user || await this.db.getUser(c.id);
        if (user) await this.mailer.sendLegacyDue(user, code.name || '', legacy[id], e.until, kind === 'over').catch((x) => console.error('Herinnering oude QR-app mislukt:', x.message));
      }
      if (changed) await this.db.setSetting('legacyUntil:' + c.id, Object.keys(m).length ? JSON.stringify(m) : null);
    }
  }
  onApplicationShutdown() { clearInterval(this.timer); }
}
