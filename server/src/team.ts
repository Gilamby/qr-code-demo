/* =========================================================
   TEAMS (alleen bij het Business-abonnement)
   De eigenaar (het Business-account) nodigt collega's uit. De codes, mappen en statistieken blijven van de eigenaar;
   een teamlid werkt in het account van de eigenaar. Bij Standard en Pro verandert er niets: één persoon, één account.
   Rollen: editor (bewerker: codes maken, wijzigen, verwijderen) en viewer (kijker: alleen bekijken en downloaden).
   Opslag (settings):
     'team:<eigenaarId>'   → { members: [{ userId, email, name, role, invitedAt }] }
     'member:<lidId>'      → { ownerId, role }
     'teamlog:<eigenaarId>'→ laatste 300 acties: wie deed wat
   ========================================================= */
export type Role = 'editor' | 'viewer';
export const ROLES: Role[] = ['editor', 'viewer'];
export interface Member { userId: string; email: string; name: string; role: Role; invitedAt: string }
export interface Membership { ownerId: string; role: Role }
type Settings = { getSetting(k: string): Promise<string | null | undefined>; setSetting(k: string, v: string | null): Promise<void> };

const parse = (v: any, d: any) => { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } };

/* Lidmaatschap wordt bij elk verzoek bekeken: kort onthouden (wijzigingen in dit proces wissen het meteen) */
const cache = new Map<string, { at: number; v: Membership | null }>();
export async function memberOf(db: Settings, userId: string): Promise<Membership | null> {
  const c = cache.get(userId); if (c && Date.now() - c.at < 30000) return c.v;
  const v = parse(await db.getSetting('member:' + userId).catch(() => null), null);
  const m = v && v.ownerId && ROLES.includes(v.role) ? { ownerId: String(v.ownerId), role: v.role as Role } : null;
  cache.set(userId, { at: Date.now(), v: m }); return m;
}
const hasTeamCache = new Map<string, { at: number; v: boolean }>();
export async function membersOf(db: Settings, ownerId: string): Promise<Member[]> {
  const v = parse(await db.getSetting('team:' + ownerId).catch(() => null), null);
  return v && Array.isArray(v.members) ? v.members : [];
}
/** Heeft deze eigenaar teamleden? (voor het logboek van wie wat deed) */
export async function hasTeam(db: Settings, ownerId: string): Promise<boolean> {
  const c = hasTeamCache.get(ownerId); if (c && Date.now() - c.at < 30000) return c.v;
  const v = (await membersOf(db, ownerId)).length > 0; hasTeamCache.set(ownerId, { at: Date.now(), v }); return v;
}
export async function saveMembers(db: Settings, ownerId: string, members: Member[]) {
  await db.setSetting('team:' + ownerId, members.length ? JSON.stringify({ members }) : null);
  hasTeamCache.delete(ownerId);
}
export async function setMembership(db: Settings, userId: string, m: Membership | null) {
  await db.setSetting('member:' + userId, m ? JSON.stringify(m) : null);
  cache.delete(userId);
}

/* ---------- Wie deed wat ---------- */
export interface LogEntry { at: string; by: string; byName: string; action: string; codeId: string | null }
export async function teamLog(db: Settings, ownerId: string): Promise<LogEntry[]> { return parse(await db.getSetting('teamlog:' + ownerId).catch(() => null), []); }
export async function addTeamLog(db: Settings, ownerId: string, e: LogEntry) {
  const list = await teamLog(db, ownerId); list.unshift(e);
  await db.setSetting('teamlog:' + ownerId, JSON.stringify(list.slice(0, 300)));
}
/** Welke actie was dit verzoek? (alleen wijzigingen aan codes en mappen) */
export function actionOf(method: string, path: string): { action: string; codeId: string | null } | null {
  let m = path.match(/^\/api\/qr-codes\/?([A-Za-z0-9_-]+)?(\/duplicate)?$/);
  if (m) {
    if (method === 'POST' && !m[1]) return { action: 'created', codeId: null };
    if (method === 'POST' && m[2]) return { action: 'duplicated', codeId: m[1] };
    if (method === 'PUT') return { action: 'edited', codeId: m[1] || null };
    if (method === 'PATCH') return { action: 'changed', codeId: m[1] || null };
    if (method === 'DELETE') return { action: 'deleted', codeId: m[1] || null };
  }
  m = path.match(/^\/api\/folders(\/.*)?$/);
  if (m && method !== 'GET') return { action: 'folders', codeId: null };
  return null;
}
