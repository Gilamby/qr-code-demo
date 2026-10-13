/* =========================================================
   Opslag in een SQL-database: SQLite (één bestand) of PostgreSQL.
   Beide stuurprogramma's (sqlite.driver.ts, postgres.driver.ts) hebben dezelfde vorm (SqlDriver);
   deze klasse weet niet welke het is.
   Tabellen: users, sessions, password_resets, email_verifications, qr_codes, scan_stats, files.
   ========================================================= */
import * as fs from 'fs';
import * as path from 'path';
import type { Billing, QrCode, SqlDriver, StoredFile, User } from '../types';
import {
  Customer, DatabaseService, FILES_DIR, INVITED, NewQrCode, QrPatch, RESET_HOURS, SENSITIVE_TYPES, SESSION_DAYS, Summary, UNVERIFIED_DAYS, UserPatch, UserRow, VERIFY_HOURS,
  hash, newId, now, openContent, removeFiles, sealContent, since30,
} from './database.service';

/* ---------- Rij → object ---------- */
function codeOut(r: any): QrCode {
  if (!r) return null;
  return { id: r.id, userId: r.user_id, typeId: r.type_id, contentType: r.content_type, content: openContent(r.content_type, JSON.parse(r.content)), design: JSON.parse(r.design),
    name: r.name || undefined, paused: !!r.paused, scans: Number(r.scans) || 0, lastScanAt: r.last_scan_at, createdAt: r.created_at, updatedAt: r.updated_at || undefined };
}
function userOut(r: any): User {
  return r && { id: r.id, email: r.email, name: r.name, background: r.background, customBackground: r.custom_background || null, createdAt: r.created_at };
}

const SQL = {
  userByEmail: 'SELECT * FROM users WHERE lower(email) = lower(?)',
  userById: 'SELECT * FROM users WHERE id = ?',
  code: 'SELECT * FROM qr_codes WHERE id = ?',
  codesOf: 'SELECT * FROM qr_codes WHERE user_id = ? ORDER BY created_at DESC',
  filesOfCode: 'SELECT id FROM files WHERE code_id = ?',
};

export class SqlDatabase extends DatabaseService {
  constructor(private readonly d: SqlDriver) { super(); }

  get kind() { return this.d.kind; }
  get label() { return this.d.label; }
  ping() { return this.d.ping(); }
  close() { return this.d.close(); }

  /* ---------- Gebruikers en inloggen ---------- */
  async createUser({ email, name, passwordHash }: { email: string; name: string; passwordHash: string }): Promise<User> {
    const id = newId(9);
    await this.d.run('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [id, email.trim(), String(name || '').trim().slice(0, 80), passwordHash, now()]);
    return this.getUser(id);
  }
  userByEmail(email: string): Promise<UserRow | null> { return this.d.get(SQL.userByEmail, [String(email || '').trim()]); }
  async isVerified(id: string) { return !!((await this.d.get('SELECT email_verified_at AS v FROM users WHERE id = ?', [id])) || ({} as any)).v; }
  markVerified(id: string) { return this.d.run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', [now(), id]); }
  async getUser(id: string): Promise<User> { return userOut(await this.d.get(SQL.userById, [id])); }
  async passwordHashOf(id: string): Promise<string> { return ((await this.d.get(SQL.userById, [id])) || ({} as any)).password_hash; }
  async updateUser(id: string, patch: UserPatch): Promise<User> {
    const cols = { name: 'name', background: 'background', customBackground: 'custom_background', passwordHash: 'password_hash', email: 'email' };
    const keys = Object.keys(patch).filter((k) => cols[k]); if (!keys.length) return this.getUser(id);
    await this.d.run('UPDATE users SET ' + keys.map((k) => cols[k] + ' = ?').join(', ') + ', updated_at = ? WHERE id = ?', [...keys.map((k) => patch[k]), now(), id]);
    return this.getUser(id);
  }
  async deleteUser(id: string) {
    const files = (await this.d.all('SELECT id FROM files WHERE user_id = ?', [id])).map((r) => r.id);
    await this.d.run('DELETE FROM users WHERE id = ?', [id]);       // de rest gaat mee (ON DELETE CASCADE)
    removeFiles(files);
  }

  async getBilling(userId: string): Promise<Billing | null> {
    const r = await this.d.get('SELECT billing FROM users WHERE id = ?', [userId]);
    try { return r && r.billing ? JSON.parse(r.billing) : null; } catch (e) { return null; }
  }
  async setBilling(userId: string, b: Billing) {
    await this.d.run('UPDATE users SET billing = ?, updated_at = ? WHERE id = ?', [JSON.stringify(b), now(), userId]);
    return this.getBilling(userId);
  }

  async createVerification(userId: string) {
    const token = newId(32);
    await this.d.batch([
      ['DELETE FROM email_verifications WHERE user_id = ?', [userId]],
      ['INSERT INTO email_verifications (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hash(token), userId, new Date(Date.now() + VERIFY_HOURS * 3600e3).toISOString()]],
    ]);
    return token;
  }
  async useVerification(token: string): Promise<string | null> {
    const r = await this.d.get('SELECT * FROM email_verifications WHERE token_hash = ?', [hash(token)]); if (!r) return null;
    const del = await this.d.run('DELETE FROM email_verifications WHERE token_hash = ?', [hash(token)]);
    if (!del.changes || r.expires_at < now()) return null;                // al gebruikt (tegelijk geklikt) of verlopen
    await this.markVerified(r.user_id); return r.user_id;
  }

  async createSession(userId: string) {
    const token = newId(32), exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
    await this.d.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [hash(token), userId, now(), exp]);
    return { token, expires: exp };
  }
  async sessionUser(token: string): Promise<User | null> {
    if (!token) return null;
    const r = await this.d.get('SELECT u.*, s.expires_at AS s_exp FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?', [hash(token)]);
    if (!r) return null;
    if (r.s_exp < now()) { await this.d.run('DELETE FROM sessions WHERE token_hash = ?', [hash(token)]); return null; }
    const u = userOut(r);
    if (new Date(r.s_exp).getTime() - Date.now() < (SESSION_DAYS - 1) * 864e5) {             // hooguit één keer per dag verlengen
      const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
      await this.d.run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', [exp, hash(token)]);
      Object.defineProperty(u, 'renewUntil', { value: exp, enumerable: false });   // dan wordt ook het cookie ververst
    }
    return u;
  }
  deleteSession(token: string) { return this.d.run('DELETE FROM sessions WHERE token_hash = ?', [hash(token)]); }
  deleteSessionsOf(userId: string, exceptToken?: string) { return this.d.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [userId, exceptToken ? hash(exceptToken) : '']); }

  async summary(userId: string): Promise<Summary> {
    const n = async (sql: string, p: unknown[]) => Number(((await this.d.get(sql, p)) || ({} as any)).n) || 0;
    return {
      codes: await n('SELECT COUNT(*) AS n FROM qr_codes WHERE user_id = ?', [userId]),
      scans: await n('SELECT COALESCE(SUM(s.scans), 0) AS n FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ?', [userId]),
      scans30: await n('SELECT COALESCE(SUM(s.scans), 0) AS n FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ? AND s.day >= ?', [userId, since30()]),
      sessions: await n('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ?', [userId, now()]),
    };
  }

  async createReset(userId: string, hours = RESET_HOURS) {
    const token = newId(32);
    await this.d.batch([
      ['DELETE FROM password_resets WHERE user_id = ?', [userId]],
      ['INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hash(token), userId, new Date(Date.now() + hours * 3600e3).toISOString()]],
    ]);
    return token;
  }
  async useReset(token: string): Promise<string | null> {
    const r = await this.d.get('SELECT * FROM password_resets WHERE token_hash = ?', [hash(token)]); if (!r) return null;
    const del = await this.d.run('DELETE FROM password_resets WHERE token_hash = ?', [hash(token)]);
    return del.changes && r.expires_at > now() ? r.user_id : null;
  }

  async cleanup() {
    const t = now();
    await this.d.run('DELETE FROM sessions WHERE expires_at < ?', [t]);
    await this.d.run('DELETE FROM password_resets WHERE expires_at < ?', [t]);
    await this.d.run('DELETE FROM email_verifications WHERE expires_at < ?', [t]);
    // geüploade bestanden die nooit bij een code zijn opgeslagen (na een dag)
    const loose = (await this.d.all('SELECT id FROM files WHERE code_id IS NULL AND created_at < ?', [new Date(Date.now() - 864e5).toISOString()])).map((r) => r.id);
    for (const id of loose) await this.d.run('DELETE FROM files WHERE id = ?', [id]);
    removeFiles(loose);
    // nooit bevestigde aanmeldingen weg; uitgenodigde klanten blijven staan (het team kan opnieuw uitnodigen)
    await this.d.run('DELETE FROM users WHERE email_verified_at IS NULL AND password_hash <> ? AND created_at < ?', [INVITED, new Date(Date.now() - UNVERIFIED_DAYS * 864e5).toISOString()]);
  }
  async listCustomers(): Promise<Customer[]> {
    const rows = await this.d.all('SELECT u.id, u.email, u.name, u.created_at, u.email_verified_at, (SELECT COUNT(*) FROM qr_codes q WHERE q.user_id = u.id) AS codes, (SELECT MAX(r.expires_at) FROM password_resets r WHERE r.user_id = u.id) AS invite_until FROM users u ORDER BY u.created_at DESC');
    return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, createdAt: r.created_at, active: !!r.email_verified_at, codes: Number(r.codes) || 0, inviteUntil: r.email_verified_at ? null : r.invite_until || null }));
  }

  /* ---------- QR-codes ---------- */
  async listQrCodes(userId: string): Promise<QrCode[]> { return (await this.d.all(SQL.codesOf, [userId])).map(codeOut); }
  async listWithStats(userId: string): Promise<QrCode[]> {
    const codes = (await this.d.all(SQL.codesOf, [userId])).map(codeOut), byId: Record<string, QrCode> = {};
    codes.forEach((c) => { c.stats = {}; byId[c.id] = c; });
    (await this.d.all('SELECT s.code_id, s.day, s.key, s.scans, s.uniq FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ?', [userId]))
      .forEach((r) => { const c = byId[r.code_id]; if (!c) return; (c.stats[r.day] = c.stats[r.day] || {})[r.key] = [Number(r.scans), Number(r.uniq)]; });
    return codes;
  }
  async getQrCode(id: string): Promise<QrCode> { return codeOut(await this.d.get(SQL.code, [id])); }
  async idTaken(id: string) { return !!(await this.d.get('SELECT 1 AS x FROM qr_codes WHERE id = ?', [id])); }
  async insertQrCode(userId: string, q: NewQrCode) {
    await this.d.run('INSERT INTO qr_codes (id, user_id, type_id, content_type, content, design, name, paused, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
      [q.id, userId, q.typeId, q.contentType, JSON.stringify(sealContent(q.contentType, q.content)), JSON.stringify(q.design || {}), q.name || null, q.createdAt || now()]);
    return this.getQrCode(q.id);
  }
  async updateQrCode(id: string, patch: QrPatch) {
    const sets: string[] = [], vals: unknown[] = [];
    if (patch.content) {
      const cur = await this.d.get('SELECT content_type FROM qr_codes WHERE id = ?', [id]);
      sets.push('content = ?'); vals.push(JSON.stringify(sealContent(cur && cur.content_type, patch.content)));
    }
    if (patch.design) { sets.push('design = ?'); vals.push(JSON.stringify(patch.design)); }
    if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name || null); }
    if (patch.paused !== undefined) { sets.push('paused = ?'); vals.push(patch.paused ? 1 : 0); }
    sets.push('updated_at = ?'); vals.push(now());
    await this.d.run('UPDATE qr_codes SET ' + sets.join(', ') + ' WHERE id = ?', [...vals, id]);
    return this.getQrCode(id);
  }
  async deleteQrCode(id: string, userId: string) {
    const q = await this.d.get(SQL.code, [id]); if (!q || q.user_id !== userId) return false;
    const files = (await this.d.all(SQL.filesOfCode, [id])).map((r) => r.id);
    await this.d.run('DELETE FROM qr_codes WHERE id = ?', [id]); removeFiles(files);
    return true;
  }
  async addScan(id: string, info?: { key: string; unique: boolean }) {
    const t = now(), day = t.slice(0, 10), key = (info && info.key) || 'other||';
    await this.d.batch([            // in één transactie
      ['UPDATE qr_codes SET scans = scans + 1, last_scan_at = ? WHERE id = ?', [t, id]],
      ['INSERT INTO scan_stats (code_id, day, key, scans, uniq) VALUES (?, ?, ?, 1, ?) ON CONFLICT (code_id, day, key) DO UPDATE SET scans = scan_stats.scans + 1, uniq = scan_stats.uniq + excluded.uniq',
        [id, day, key, !info || info.unique ? 1 : 0]],
    ]);
    return this.getQrCode(id);
  }
  async importStats(codeId: string, stats: Record<string, Record<string, [number, number]>>, scans: number, lastScanAt: string | null) {
    const list: [string, unknown[]][] = [];
    for (const [day, keys] of Object.entries(stats || {})) for (const [key, v] of Object.entries(keys)) {
      list.push(['INSERT INTO scan_stats (code_id, day, key, scans, uniq) VALUES (?, ?, ?, ?, ?) ON CONFLICT (code_id, day, key) DO UPDATE SET scans = excluded.scans, uniq = excluded.uniq', [codeId, day, key, v[0], v[1]]]);
    }
    list.push(['UPDATE qr_codes SET scans = ?, last_scan_at = ? WHERE id = ?', [scans || 0, lastScanAt || null, codeId]]);
    await this.d.batch(list);
  }

  /* ---------- Bestanden ---------- */
  async saveFile({ userId, codeId, name, mime, buffer }: { userId: string; codeId: string | null; name: string; mime: string; buffer: Buffer }) {
    const id = newId(16);
    fs.writeFileSync(path.join(FILES_DIR, id), buffer);
    await this.d.run('INSERT INTO files (id, code_id, user_id, name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, codeId || null, userId, name, mime, buffer.length, now()]);
    return id;
  }
  async addFileRecord(f: { id: string; userId: string; codeId: string | null; name: string; mime: string; size: number }) {
    await this.d.run('INSERT INTO files (id, code_id, user_id, name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [f.id, f.codeId || null, f.userId, f.name, f.mime, f.size, now()]);
  }
  attachFile(id: string, codeId: string) { return this.d.run('UPDATE files SET code_id = ? WHERE id = ?', [codeId, id]); }
  async getFile(id: string): Promise<StoredFile | null> { const r = await this.d.get('SELECT * FROM files WHERE id = ?', [id]); return r ? { ...r, size: Number(r.size), path: path.join(FILES_DIR, r.id) } : null; }
  async pruneFiles(codeId: string, keepIds: string[]) {
    const gone = (await this.d.all(SQL.filesOfCode, [codeId])).map((r) => r.id).filter((id) => keepIds.indexOf(id) < 0);
    for (const id of gone) await this.d.run('DELETE FROM files WHERE id = ?', [id]);
    removeFiles(gone);
  }

  async sealOldRows() {
    for (const type of SENSITIVE_TYPES) {
      for (const r of await this.d.all('SELECT id, content FROM qr_codes WHERE content_type = ?', [type])) {
        const sealed = JSON.stringify(sealContent(type, JSON.parse(r.content)));
        if (sealed !== r.content) await this.d.run('UPDATE qr_codes SET content = ? WHERE id = ?', [sealed, r.id]);
      }
    }
  }
  async backup(to: string) { if (!this.d.backup) throw new Error('Back-up via dit script kan alleen bij SQLite. Gebruik pg_dump voor PostgreSQL.'); return this.d.backup(to); }
  async storedContent(id: string) { const r = await this.d.get('SELECT content FROM qr_codes WHERE id = ?', [id]); return r ? r.content : null; }
}
