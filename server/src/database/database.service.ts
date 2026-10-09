/* =========================================================
   OPSLAG (DatabaseService)
   - PostgreSQL als DATABASE_URL is ingesteld (productie), anders SQLite (één bestand: ontwikkelen, Codespaces).
     Beide stuurprogramma's (sqlite.driver.ts, postgres.driver.ts) hebben dezelfde vorm; deze service weet niet welke het is.
   - Tabellen: users, sessions, password_resets, email_verifications, qr_codes, scan_stats, files.
   - scan_stats: aantallen per code per dag per "systeem|land|stad" (geen IP-adressen).
   - PDF/MP3 staan als bestand op schijf (<DATA_DIR>/files), niet in de database.
   - Wifi-wachtwoorden staan versleuteld in de database (secret.ts).
   Alles wat codes van een klant raakt vraagt het user-id: een klant ziet nooit codes van een ander.
   ========================================================= */
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PATHS } from '../config/env';
import * as secret from './secret';
import type { QrCode, SqlDriver, StoredFile, User } from '../types';

export const SQL_DRIVER = 'SQL_DRIVER';
export const FILES_DIR = path.join(PATHS.data, 'files');
export const SQLITE_FILE = process.env.DB_PATH || path.join(PATHS.data, 'optimasys.db');

const now = () => new Date().toISOString();
const newId = (n = 9) => crypto.randomBytes(n).toString('base64url');
const hash = (token: string) => crypto.createHash('sha256').update(String(token)).digest('base64url');
const SESSION_DAYS = 365;                     // ingelogd blijven tot je zelf uitlogt; elke dag dat je de app gebruikt, schuift dit op

/* ---------- Gevoelige velden versleutelen (per soort inhoud) ---------- */
const SENSITIVE: Record<string, string[]> = { wifi: ['password'] };
function sealContent(contentType: string, content: Record<string, any>) {
  const keys = SENSITIVE[contentType]; if (!keys || !content) return content;
  const c = { ...content }; keys.forEach((k) => { if (c[k]) c[k] = secret.encrypt(c[k]); }); return c;
}
function openContent(contentType: string, content: Record<string, any>) {
  const keys = SENSITIVE[contentType]; if (!keys || !content) return content;
  keys.forEach((k) => { if (content[k]) content[k] = secret.decrypt(content[k]); }); return content;
}
/** Eenmalig bij het opstarten: gevoelige velden die nog leesbaar in de database staan alsnog versleutelen */
export async function sealOldRows(d: SqlDriver): Promise<void> {
  for (const type of Object.keys(SENSITIVE)) {
    for (const r of await d.all('SELECT id, content FROM qr_codes WHERE content_type = ?', [type])) {
      const sealed = JSON.stringify(sealContent(type, JSON.parse(r.content)));
      if (sealed !== r.content) await d.run('UPDATE qr_codes SET content = ? WHERE id = ?', [sealed, r.id]);
    }
  }
}

/* ---------- Rij → object ---------- */
function codeOut(r: any): QrCode {
  if (!r) return null;
  return { id: r.id, userId: r.user_id, typeId: r.type_id, contentType: r.content_type, content: openContent(r.content_type, JSON.parse(r.content)), design: JSON.parse(r.design),
    name: r.name || undefined, paused: !!r.paused, scans: Number(r.scans) || 0, lastScanAt: r.last_scan_at, createdAt: r.created_at, updatedAt: r.updated_at || undefined };
}
function userOut(r: any): User {
  return r && { id: r.id, email: r.email, name: r.name, background: r.background, customBackground: r.custom_background || null, createdAt: r.created_at };
}
function removeFiles(ids: string[]) { ids.forEach((id) => { try { fs.unlinkSync(path.join(FILES_DIR, id)); } catch (e) { /* al weg */ } }); }

const SQL = {
  userByEmail: 'SELECT * FROM users WHERE lower(email) = lower(?)',
  userById: 'SELECT * FROM users WHERE id = ?',
  code: 'SELECT * FROM qr_codes WHERE id = ?',
  codesOf: 'SELECT * FROM qr_codes WHERE user_id = ? ORDER BY created_at DESC',
  filesOfCode: 'SELECT id FROM files WHERE code_id = ?',
};

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(@Inject(SQL_DRIVER) private readonly d: SqlDriver) { fs.mkdirSync(FILES_DIR, { recursive: true }); }

  get kind() { return this.d.kind; }
  get label() { return this.d.label; }
  readonly filesDir = FILES_DIR;
  ping() { return this.d.ping(); }
  async onApplicationShutdown() { await this.d.close(); }

  /* ---------- Gebruikers en inloggen ---------- */
  async createUser({ email, name, passwordHash }: { email: string; name: string; passwordHash: string }): Promise<User> {
    const id = newId(9);
    await this.d.run('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [id, email.trim(), String(name || '').trim().slice(0, 80), passwordHash, now()]);
    return this.getUser(id);
  }
  /** Met password_hash (alleen voor inloggen) */
  userByEmail(email: string) { return this.d.get(SQL.userByEmail, [String(email || '').trim()]); }
  async isVerified(id: string) { return !!((await this.d.get('SELECT email_verified_at AS v FROM users WHERE id = ?', [id])) || ({} as any)).v; }
  markVerified(id: string) { return this.d.run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', [now(), id]); }
  async getUser(id: string): Promise<User> { return userOut(await this.d.get(SQL.userById, [id])); }
  async passwordHashOf(id: string): Promise<string> { return ((await this.d.get(SQL.userById, [id])) || ({} as any)).password_hash; }
  async updateUser(id: string, patch: Partial<{ name: string; background: string; customBackground: string | null; passwordHash: string; email: string }>): Promise<User> {
    const cols = { name: 'name', background: 'background', customBackground: 'custom_background', passwordHash: 'password_hash', email: 'email' };
    const keys = Object.keys(patch).filter((k) => cols[k]); if (!keys.length) return this.getUser(id);
    await this.d.run('UPDATE users SET ' + keys.map((k) => cols[k] + ' = ?').join(', ') + ', updated_at = ? WHERE id = ?', [...keys.map((k) => patch[k]), now(), id]);
    return this.getUser(id);
  }
  /** Account verwijderen: alles weg (codes, statistieken, sessies, bestanden op schijf) */
  async deleteUser(id: string) {
    const files = (await this.d.all('SELECT id FROM files WHERE user_id = ?', [id])).map((r) => r.id);
    await this.d.run('DELETE FROM users WHERE id = ?', [id]);
    removeFiles(files);
  }

  /* Bevestigingslink: 24 uur geldig, één keer te gebruiken */
  async createVerification(userId: string) {
    const token = newId(32);
    await this.d.batch([
      ['DELETE FROM email_verifications WHERE user_id = ?', [userId]],
      ['INSERT INTO email_verifications (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hash(token), userId, new Date(Date.now() + 24 * 3600e3).toISOString()]],
    ]);
    return token;
  }
  async useVerification(token: string): Promise<string | null> {
    const r = await this.d.get('SELECT * FROM email_verifications WHERE token_hash = ?', [hash(token)]); if (!r) return null;
    const del = await this.d.run('DELETE FROM email_verifications WHERE token_hash = ?', [hash(token)]);
    if (!del.changes || r.expires_at < now()) return null;                // al gebruikt (tegelijk geklikt) of verlopen
    await this.markVerified(r.user_id); return r.user_id;
  }

  /* Sessies */
  async createSession(userId: string) {
    const token = newId(32), exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
    await this.d.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [hash(token), userId, now(), exp]);
    return { token, expires: exp };
  }
  /** Geldige sessie? Dan de gebruiker; sessies worden bij gebruik verlengd (max. 1x per dag) */
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

  /** Overzicht voor Mijn account: aantal codes, scans (totaal en laatste 30 dagen), ingelogde apparaten */
  async summary(userId: string) {
    const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
    const n = async (sql: string, p: unknown[]) => Number(((await this.d.get(sql, p)) || ({} as any)).n) || 0;
    return {
      codes: await n('SELECT COUNT(*) AS n FROM qr_codes WHERE user_id = ?', [userId]),
      scans: await n('SELECT COALESCE(SUM(s.scans), 0) AS n FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ?', [userId]),
      scans30: await n('SELECT COALESCE(SUM(s.scans), 0) AS n FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ? AND s.day >= ?', [userId, since]),
      sessions: await n('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ?', [userId, now()]),
    };
  }

  /* Wachtwoord vergeten: één keer bruikbaar, 1 uur geldig */
  async createReset(userId: string) {
    const token = newId(32);
    await this.d.batch([
      ['DELETE FROM password_resets WHERE user_id = ?', [userId]],
      ['INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hash(token), userId, new Date(Date.now() + 3600e3).toISOString()]],
    ]);
    return token;
  }
  async useReset(token: string): Promise<string | null> {
    const r = await this.d.get('SELECT * FROM password_resets WHERE token_hash = ?', [hash(token)]); if (!r) return null;
    const del = await this.d.run('DELETE FROM password_resets WHERE token_hash = ?', [hash(token)]);
    return del.changes && r.expires_at > now() ? r.user_id : null;
  }

  /** Opruimen: verlopen sessies en links, nooit bevestigde accounts (na 7 dagen) */
  async cleanup() {
    const t = now();
    await this.d.run('DELETE FROM sessions WHERE expires_at < ?', [t]);
    await this.d.run('DELETE FROM password_resets WHERE expires_at < ?', [t]);
    await this.d.run('DELETE FROM email_verifications WHERE expires_at < ?', [t]);
    await this.d.run('DELETE FROM users WHERE email_verified_at IS NULL AND created_at < ?', [new Date(Date.now() - 7 * 864e5).toISOString()]);
  }

  /* ---------- QR-codes ---------- */
  async listQrCodes(userId: string): Promise<QrCode[]> { return (await this.d.all(SQL.codesOf, [userId])).map(codeOut); }
  /** Met statistieken (voor /api/analytics): { stats: { dag: { sleutel: [scans, uniek] } } } */
  async listWithStats(userId: string): Promise<QrCode[]> {
    const codes = (await this.d.all(SQL.codesOf, [userId])).map(codeOut), byId: Record<string, QrCode> = {};
    codes.forEach((c) => { c.stats = {}; byId[c.id] = c; });
    (await this.d.all('SELECT s.code_id, s.day, s.key, s.scans, s.uniq FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ?', [userId]))
      .forEach((r) => { const c = byId[r.code_id]; if (!c) return; (c.stats[r.day] = c.stats[r.day] || {})[r.key] = [Number(r.scans), Number(r.uniq)]; });
    return codes;
  }
  /** Openbaar (scannen) */
  async getQrCode(id: string): Promise<QrCode> { return codeOut(await this.d.get(SQL.code, [id])); }
  async getOwnedQrCode(id: string, userId: string): Promise<QrCode | null> { const q = await this.getQrCode(id); return q && q.userId === userId ? q : null; }
  async idTaken(id: string) { return !!(await this.d.get('SELECT 1 AS x FROM qr_codes WHERE id = ?', [id])); }
  async insertQrCode(userId: string, q: { id: string; typeId: string; contentType: string; content: Record<string, any>; design?: Record<string, any>; name?: string; createdAt?: string }) {
    await this.d.run('INSERT INTO qr_codes (id, user_id, type_id, content_type, content, design, name, paused, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
      [q.id, userId, q.typeId, q.contentType, JSON.stringify(sealContent(q.contentType, q.content)), JSON.stringify(q.design || {}), q.name || null, q.createdAt || now()]);
    return this.getQrCode(q.id);
  }
  async updateQrCode(id: string, patch: { content?: Record<string, any>; design?: Record<string, any>; name?: string; paused?: boolean }) {
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
  /** Scan tellen (in één transactie): totaal + per dag per "systeem|land|stad" */
  async addScan(id: string, info?: { key: string; unique: boolean }) {
    const t = now(), day = t.slice(0, 10), key = (info && info.key) || 'other||';
    await this.d.batch([
      ['UPDATE qr_codes SET scans = scans + 1, last_scan_at = ? WHERE id = ?', [t, id]],
      ['INSERT INTO scan_stats (code_id, day, key, scans, uniq) VALUES (?, ?, ?, 1, ?) ON CONFLICT (code_id, day, key) DO UPDATE SET scans = scan_stats.scans + 1, uniq = scan_stats.uniq + excluded.uniq',
        [id, day, key, !info || info.unique ? 1 : 0]],
    ]);
    return this.getQrCode(id);
  }

  /* ---------- Bestanden (PDF, MP3): op schijf, met een willekeurig id als naam ---------- */
  async saveFile({ userId, codeId, name, mime, buffer }: { userId: string; codeId: string | null; name: string; mime: string; buffer: Buffer }) {
    const id = newId(16);
    fs.writeFileSync(path.join(FILES_DIR, id), buffer);
    await this.d.run('INSERT INTO files (id, code_id, user_id, name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, codeId || null, userId, name, mime, buffer.length, now()]);
    return id;
  }
  attachFile(id: string, codeId: string) { return this.d.run('UPDATE files SET code_id = ? WHERE id = ?', [codeId, id]); }
  async getFile(id: string): Promise<StoredFile | null> { const r = await this.d.get('SELECT * FROM files WHERE id = ?', [id]); return r ? { ...r, path: path.join(FILES_DIR, r.id) } : null; }
  /** Bestanden van een code die niet meer gebruikt worden (na bewerken) weghalen */
  async pruneFiles(codeId: string, keepIds: string[]) {
    const gone = (await this.d.all(SQL.filesOfCode, [codeId])).map((r) => r.id).filter((id) => keepIds.indexOf(id) < 0);
    for (const id of gone) await this.d.run('DELETE FROM files WHERE id = ?', [id]);
    removeFiles(gone);
  }

  /* ---------- Back-up (alleen SQLite; bij PostgreSQL: pg_dump of de back-ups van de hostingpartij) ---------- */
  async backup(to: string) { if (!this.d.backup) throw new Error('Back-up via dit script kan alleen bij SQLite. Gebruik pg_dump voor PostgreSQL.'); return this.d.backup(to); }
  /** Voor scripts en tests: ruwe SQL */
  sql(kind: 'all' | 'get' | 'run', text: string, params?: unknown[]) { return (this.d as any)[kind](text, params); }
}
