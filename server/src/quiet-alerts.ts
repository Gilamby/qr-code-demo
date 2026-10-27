/* =========================================================
   MELDING: CODE WORDT NIET MEER (OF VEEL MINDER) GESCAND
   Eén keer per dag (vanaf 09:00 servertijd) per actieve code:
   - stil:   de 4 weken ervoor samen minstens 20 scans, de laatste 7 dagen 0 → "geen scans meer sinds 7 dagen"
             (vaak: poster weggehaald, sticker kapot, menu vervangen)
   - daling: de 4 weken ervoor gemiddeld minstens 35 scans per week, de laatste 7 dagen minder dan 30% daarvan
   Per code één mail per keer dat het gebeurt (settings 'quiet:<id>'); weer normaal (≥ 50%) = opnieuw wapenen.
   Aan/uit in Mijn account > Meldingen ('quietCodes'). Alleen tellingen per dag, niets over wie scant.
   ========================================================= */
import type { DatabaseService } from './database/database.service';
import type { QrCode } from './types';

const DAY = 864e5;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export type Quiet = { kind: 'stopped' | 'drop'; before: number; now: number; pct: number };

/** Scans per dag van één code → oordeel (of null als alles normaal is) */
export function judge(q: QrCode, today: number): Quiet | 'normal' | null {
  const last7From = iso(today - 7 * DAY), last7To = iso(today - DAY), baseFrom = iso(today - 35 * DAY), baseTo = iso(today - 8 * DAY);
  let now = 0, base = 0;
  for (const [d, keys] of Object.entries(q.stats || {})) {
    const n = Object.values(keys).reduce((a, v) => a + v[0], 0);
    if (d >= last7From && d <= last7To) now += n; else if (d >= baseFrom && d <= baseTo) base += n;
  }
  const weekly = base / 4;
  if (base >= 20 && now === 0) return { kind: 'stopped', before: Math.round(weekly), now, pct: 100 };
  if (weekly >= 35 && now < weekly * 0.3) return { kind: 'drop', before: Math.round(weekly), now, pct: Math.round((1 - now / weekly) * 100) };
  if (weekly > 0 && now >= weekly * 0.5) return 'normal';
  return null;
}

export async function quietSweep(db: DatabaseService, mailer: { sendQuiet: (u: any, code: { id: string; name: string }, q: Quiet) => Promise<void> }, now = Date.now()) {
  const d = new Date(now); if (d.getHours() < 9) return 0;
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if ((await db.getSetting('quietSweep')) === iso(today)) return 0;            // vandaag al gedaan
  await db.setSetting('quietSweep', iso(today));
  let sent = 0;
  for (const c of await db.listCustomers()) {
    if (!c.active || c.disabledAt) continue;
    const u = await db.getUser(c.id); if (!u || u.disabledAt || (u.emailPrefs && (u.emailPrefs as any).quietCodes === false)) continue;
    const codes = await db.listWithStats(u.id, { from: iso(today - 35 * DAY), to: iso(today - DAY) });
    for (const q of codes) {
      if (q.paused || (q as any).trashedAt) continue;
      if (q.content && q.content.expires && q.content.expires < iso(today)) continue;   // afgelopen: logisch dat het stil is
      const r = judge(q, today), key = 'quiet:' + q.id, was = await db.getSetting(key);
      if (r === 'normal') { if (was) await db.setSetting(key, null); continue; }
      if (!r || was) continue;
      await db.setSetting(key, r.kind + ':' + iso(today));
      const name = String(q.name || (q.content && (q.content.title || q.content.name || q.content.url)) || q.id).slice(0, 80);
      try { await mailer.sendQuiet(u, { id: q.id, name }, r); sent++; } catch (e) { console.error('Stil-melding mislukt:', (e as Error).message); }
    }
  }
  return sent;
}
