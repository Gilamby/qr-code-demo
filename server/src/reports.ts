/* =========================================================
   SCANOVERZICHT PER E-MAIL (Mijn account > Meldingen)
   - Wekelijks: elke maandag over de week ervoor (maandag t/m zondag)
   - Maandelijks: op de 1e over de maand ervoor
   - Verstuurd door de opruimtaak (elk uur), vanaf 08:00 (tijd van de server); per gebruiker één keer per periode
     (onthouden in settings 'report:<gebruiker>' = begindatum van de periode)
   - Alleen als er een mailserver is ingesteld (SMTP_HOST). Een voorbeeld kan altijd: /api/account/report-preview
   ========================================================= */
import type { DatabaseService } from './database/database.service';

export type Period = 'weekly' | 'monthly';
export type Range = { from: string; to: string; prevFrom: string; prevTo: string };
export type ReportData = { period: Period; range: Range; total: number; unique: number; prevTotal: number; codes: number; top: { name: string; scans: number }[] };

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);

/** De afgelopen hele periode: vorige week (ma–zo) of vorige maand, plus de periode daarvoor (om te vergelijken) */
export function lastPeriod(period: Period, now: Date): Range {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'weekly') {
    const monday = addDays(today, -((today.getUTCDay() + 6) % 7)), from = addDays(monday, -7);
    return { from: day(from), to: day(addDays(monday, -1)), prevFrom: day(addDays(from, -7)), prevTo: day(addDays(from, -1)) };
  }
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), from = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1));
  const prevFrom = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1));
  return { from: day(from), to: day(addDays(first, -1)), prevFrom: day(prevFrom), prevTo: day(addDays(from, -1)) };
}

export async function buildReport(db: DatabaseService, userId: string, period: Period, range: Range): Promise<ReportData> {
  const codes = await db.listWithStats(userId);
  let total = 0, unique = 0, prevTotal = 0; const per: { name: string; scans: number }[] = [];
  for (const c of codes) {
    let n = 0;
    for (const [d, keys] of Object.entries(c.stats || {})) {
      const s = Object.values(keys).reduce((a, v) => a + v[0], 0), u = Object.values(keys).reduce((a, v) => a + v[1], 0);
      if (d >= range.from && d <= range.to) { total += s; unique += u; n += s; }
      if (d >= range.prevFrom && d <= range.prevTo) prevTotal += s;
    }
    if (n) per.push({ name: c.name || (c.content && (c.content.title || c.content.url)) || c.id, scans: n });
  }
  per.sort((a, b) => b.scans - a.scans);
  return { period, range, total, unique, prevTotal, codes: codes.length, top: per.slice(0, 3) };
}

/** Elk uur aangeroepen: overzichten versturen die nu aan de beurt zijn */
export async function sendDueReports(db: DatabaseService, mailer: { configured: boolean; sendReport: (u: any, d: ReportData) => Promise<void> }, now = new Date()) {
  if (!mailer.configured || now.getHours() < 8) return;
  const isMonday = now.getDay() === 1, isFirst = now.getDate() === 1;
  if (!isMonday && !isFirst) return;
  for (const c of await db.listCustomers()) {
    if (!c.active || c.disabledAt) continue;
    const u = await db.getUser(c.id), pref = u && u.emailPrefs && u.emailPrefs.report;
    const period: Period | null = pref === 'weekly' && isMonday ? 'weekly' : pref === 'monthly' && isFirst ? 'monthly' : null;
    if (!period) continue;
    const range = lastPeriod(period, now), key = 'report:' + u.id;
    if ((await db.getSetting(key)) === period + ':' + range.from) continue;        // deze periode al verstuurd
    try {
      await mailer.sendReport(u, await buildReport(db, u.id, period, range));
      await db.setSetting(key, period + ':' + range.from);
    } catch (e) { console.error('Scanoverzicht versturen mislukt voor ' + u.email + ':', (e as Error).message); }
  }
}
