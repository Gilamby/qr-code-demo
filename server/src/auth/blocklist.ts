/* =========================================================
   BLOKKEERLIJST (Terms punt 14, KB Q25): wie geblokkeerd is, kan geen nieuw account maken.
   - Een regel is een e-mailadres (jan@voorbeeld.nl) of een heel domein (@voorbeeld.nl, ook subdomeinen).
   - Varianten tellen mee: jan.devries+2@gmail.com valt onder jandevries@gmail.com (zie email-rules.ts).
   - Gecontroleerd bij: registreren, inloggen met Google/Microsoft (nieuw account), uitnodigen (admin en team),
     en e-mailadres wijzigen. Bestaande accounts zet een admin uit met "Uitschakelen".
   Bewaard in de instelling "blocklist" (JSON-lijst).
   ========================================================= */
import { canonicalEmail } from './email-rules';

export type Block = { v: string; note: string; by: string; at: string };
type Db = { getSetting(k: string): Promise<string | null>; setSetting(k: string, v: string | null): Promise<unknown> };

/** "Jan@X.nl " -> "jan@x.nl", "x.nl" / "@x.nl" -> "@x.nl"; ongeldig -> '' */
export function normBlock(raw: string): string {
  const s = String(raw || '').trim().toLowerCase().replace(/^mailto:/, '');
  if (/^[^@\s]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return s;
  const d = s.replace(/^\*?@?/, '').replace(/^\*\./, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(d) ? '@' + d : '';
}
export async function listBlocks(db: Db): Promise<Block[]> {
  try { const l = JSON.parse((await db.getSetting('blocklist')) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}
export async function addBlock(db: Db, raw: string, note: string, by: string): Promise<Block | null> {
  const v = normBlock(raw); if (!v) return null;
  const list = await listBlocks(db), b = { v, note: String(note || '').replace(/\s+/g, ' ').trim().slice(0, 200), by, at: new Date().toISOString() };
  await db.setSetting('blocklist', JSON.stringify([b].concat(list.filter((x) => x.v !== v)).slice(0, 5000)));
  return b;
}
export async function removeBlock(db: Db, raw: string): Promise<boolean> {
  const v = normBlock(raw), list = await listBlocks(db), rest = list.filter((x) => x.v !== v);
  if (rest.length === list.length) return false;
  await db.setSetting('blocklist', rest.length ? JSON.stringify(rest) : null); return true;
}
/** Staat dit adres (of zijn domein) op de lijst? */
export async function isBlocked(db: Db, email: string): Promise<boolean> {
  const e = String(email || '').trim().toLowerCase(), c = canonicalEmail(e), domain = e.split('@')[1] || '';
  const list = await listBlocks(db); if (!list.length || !domain) return false;
  const parts = domain.split('.');
  return list.some((b) => {
    if (b.v.startsWith('@')) { for (let i = 0; i < parts.length - 1; i++) if ('@' + parts.slice(i).join('.') === b.v) return true; return false; }
    return b.v === e || canonicalEmail(b.v) === c;
  });
}
