/* =========================================================
   Opslag in een SQL-database: SQLite (één bestand) of PostgreSQL.
   Beide stuurprogramma's (sqlite.driver.ts, postgres.driver.ts) hebben dezelfde vorm (SqlDriver);
   deze klasse weet niet welke het is.
   Tabellen: users, sessions, password_resets, email_verifications, email_changes, activity, qr_codes, scan_stats, files, settings.
   ========================================================= */
import * as fs from 'fs';
import * as path from 'path';
import type { Billing, QrCode, SqlDriver, StoredFile, User } from '../types';
import {
  Activity, AdminLogEntry, parseMedia, ADMIN_LOG_DAYS, ClientMeta, CodeTotals, parseModeration, Customer, Folder, parsePrefs, DatabaseService, DayCount, EMAIL_CHANGE_HOURS, SESSION_ID_LEN, SessionInfo, FILES_DIR, INVITED, NewQrCode, QrPatch, RESET_HOURS, SENSITIVE_TYPES, SESSION_DAYS, Summary, UNVERIFIED_DAYS, UserPatch, UserRow, VERIFY_HOURS,
  hash, newId, now, openContent, removeFiles, sealContent, since30, parseLabels, SCAN_LOG_DAYS, ScanQuery } from './database.service';
import type { ScanInfo } from './database.service';

const cut = (v: string | undefined, n: number) => (v ? String(v).slice(0, n) : null);

/* ---------- Rij → object ---------- */
function codeOut(r: any): QrCode {
  if (!r) return null;
  return { id: r.id, userId: r.user_id, typeId: r.type_id, contentType: r.content_type, content: openContent(r.content_type, JSON.parse(r.content)), design: JSON.parse(r.design),
    name: r.name || undefined, paused: !!r.paused, scans: Number(r.scans) || 0, lastScanAt: r.last_scan_at, createdAt: r.created_at, updatedAt: r.updated_at || undefined, folderId: r.folder_id || null, favorite: !!Number(r.favorite), archived: !!Number(r.archived), labels: parseLabels(r.labels), note: r.note || '', moderation: parseModeration(r.moderation), trashedAt: r.trashed_at || null };
}
function userOut(r: any): User {
  return r && { id: r.id, email: r.email, name: r.name, background: r.background, customBackground: r.custom_background || null, createdAt: r.created_at,
    role: r.role || null, disabledAt: r.disabled_at || null, lastLoginAt: r.last_login_at || null,
    avatar: r.avatar || null, timezone: r.timezone || null, verified: !!r.email_verified_at, passwordChangedAt: r.password_changed_at || null, theme: r.theme || null, emailPrefs: parsePrefs(r.email_prefs), lang: r.lang || null, media: parseMedia(r.media) };
}

const SQL = {
  userByEmail: 'SELECT * FROM users WHERE lower(email) = lower(?)',
  userById: 'SELECT * FROM users WHERE id = ?',
  code: 'SELECT * FROM qr_codes WHERE id = ?',
  codesOf: 'SELECT * FROM qr_codes WHERE user_id = ? AND trashed_at IS NULL ORDER BY created_at DESC',
  trashOf: 'SELECT * FROM qr_codes WHERE user_id = ? AND trashed_at IS NOT NULL ORDER BY trashed_at DESC',
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
    const cols = { name: 'name', background: 'background', customBackground: 'custom_background', passwordHash: 'password_hash', email: 'email', role: 'role', disabledAt: 'disabled_at', lastLoginAt: 'last_login_at', avatar: 'avatar', timezone: 'timezone', passwordChangedAt: 'password_changed_at', theme: 'theme', emailPrefs: 'email_prefs', lang: 'lang', media: 'media' };
    const keys = Object.keys(patch).filter((k) => cols[k]); if (!keys.length) return this.getUser(id);
    await this.d.run('UPDATE users SET ' + keys.map((k) => cols[k] + ' = ?').join(', ') + ', updated_at = ? WHERE id = ?', [...keys.map((k) => patch[k]), now(), id]);
    return this.getUser(id);
  }
  async deleteUser(id: string) {
    const files = (await this.d.all('SELECT id FROM files WHERE user_id = ?', [id])).map((r) => r.id);
    const codes = (await this.d.all('SELECT id FROM qr_codes WHERE user_id = ?', [id])).map((r) => r.id);
    const media = parseMedia(((await this.d.get('SELECT media FROM users WHERE id = ?', [id])) || ({} as any)).media).map((m: any) => m.id);
    await this.d.run('DELETE FROM users WHERE id = ?', [id]);
    removeFiles(media);                                               // eigen achtergronden (foto's/video's)
    await this.setSetting('bghide:' + id, null); await this.setSetting('plan:' + id, null); await this.setSetting('disabled:' + id, null); await this.setSetting('totp:' + id, null); await this.setSetting('terms:' + id, null); await this.setSetting('stripe:' + id, null); await this.setSetting('extra:' + id, null); await this.setSetting('planPaused:' + id, null); await this.setSetting('keep:' + id, null); await this.setSetting('payments:' + id, null); await this.setSetting('paymeta:' + id, null); await this.setSetting('uprefs:' + id, null); await this.setSetting('templates:' + id, null); await this.setSetting('purged:' + id, null); await this.setSetting('webhooks:' + id, null); await this.setSetting('brand:' + id, null); try { const tl = JSON.parse((await this.getSetting('tickets')) || '[]'); if (Array.isArray(tl) && tl.some((x: any) => x.userId === id)) await this.setSetting('tickets', JSON.stringify(tl.filter((x: any) => x.userId !== id))); } catch (e) { /* geen vragen */ }
    await this.markGone(codes);       // de rest gaat mee (ON DELETE CASCADE)
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

  async createSession(userId: string, meta: ClientMeta = {}) {
    const token = newId(32), exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString(), t = now();
    await this.d.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ua, ip, seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [hash(token), userId, t, exp, cut(meta.ua, 300), cut(meta.ip, 64), t]);
    return { token, expires: exp };
  }
  async listSessions(userId: string, currentToken?: string): Promise<SessionInfo[]> {
    const cur = currentToken ? hash(currentToken) : '';
    return (await this.d.all('SELECT token_hash, created_at, seen_at, ua, ip FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY COALESCE(seen_at, created_at) DESC', [userId, now()]))
      .map((r) => ({ id: r.token_hash.slice(0, SESSION_ID_LEN), createdAt: r.created_at, seenAt: r.seen_at || null, ua: r.ua || null, ip: r.ip || null, current: r.token_hash === cur }));
  }
  async endSession(userId: string, id: string) {
    if (!/^[A-Za-z0-9_-]{16}$/.test(id)) return false;
    return !!(await this.d.run('DELETE FROM sessions WHERE user_id = ? AND substr(token_hash, 1, 16) = ?', [userId, id])).changes;
  }
  async addActivity(userId: string, kind: string, meta: ClientMeta = {}) {
    await this.d.run('INSERT INTO activity (id, user_id, kind, at, ip, ua) VALUES (?, ?, ?, ?, ?, ?)', [newId(16), userId, kind, now(), cut(meta.ip, 64), cut(meta.ua, 300)]);
  }
  async listActivity(userId: string, limit = 20): Promise<Activity[]> {
    return (await this.d.all('SELECT kind, at, ip, ua FROM activity WHERE user_id = ? ORDER BY at DESC LIMIT ' + Math.min(100, Math.max(1, limit | 0)), [userId]))
      .map((r) => ({ kind: r.kind, at: r.at, ip: r.ip || null, ua: r.ua || null }));
  }
  async createEmailChange(userId: string, email: string) {
    const token = newId(32);
    await this.d.batch([
      ['DELETE FROM email_changes WHERE user_id = ?', [userId]],
      ['INSERT INTO email_changes (token_hash, user_id, email, expires_at) VALUES (?, ?, ?, ?)', [hash(token), userId, email, new Date(Date.now() + EMAIL_CHANGE_HOURS * 3600e3).toISOString()]],
    ]);
    return token;
  }
  async useEmailChange(token: string) {
    const r = await this.d.get('SELECT * FROM email_changes WHERE token_hash = ?', [hash(token)]); if (!r) return null;
    const del = await this.d.run('DELETE FROM email_changes WHERE token_hash = ?', [hash(token)]);
    if (!del.changes || r.expires_at < now()) return null;
    return { userId: r.user_id, email: r.email };
  }
  async sessionUser(token: string): Promise<User | null> {
    if (!token) return null;
    const r = await this.d.get('SELECT u.*, s.expires_at AS s_exp, s.seen_at AS s_seen FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?', [hash(token)]);
    if (!r) return null;
    if (r.s_exp < now()) { await this.d.run('DELETE FROM sessions WHERE token_hash = ?', [hash(token)]); return null; }
    if (r.disabled_at) return null;                                               // uitgezet door het team
    const u = userOut(r);
    if (!r.s_seen || Date.now() - new Date(r.s_seen).getTime() > 5 * 6e4) await this.d.run('UPDATE sessions SET seen_at = ? WHERE token_hash = ?', [now(), hash(token)]);   // laatst actief (max. 1x per 5 min)
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
      codes: await n('SELECT COUNT(*) AS n FROM qr_codes WHERE user_id = ? AND trashed_at IS NULL', [userId]),
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
    await this.d.run('DELETE FROM email_changes WHERE expires_at < ?', [t]);
    await this.d.run('DELETE FROM activity WHERE at < ?', [new Date(Date.now() - 90 * 864e5).toISOString()]);
    await this.d.run('DELETE FROM admin_log WHERE at < ?', [new Date(Date.now() - ADMIN_LOG_DAYS * 864e5).toISOString()]);
    await this.d.run('DELETE FROM scan_log WHERE at < ?', [new Date(Date.now() - SCAN_LOG_DAYS * 864e5).toISOString()]);   // logboek: alleen de laatste 400 dagen
    // geüploade bestanden die nooit bij een code zijn opgeslagen (na een dag)
    const loose = (await this.d.all('SELECT id FROM files WHERE code_id IS NULL AND created_at < ?', [new Date(Date.now() - 864e5).toISOString()])).map((r) => r.id);
    for (const id of loose) await this.d.run('DELETE FROM files WHERE id = ?', [id]);
    removeFiles(loose);
    // nooit bevestigde aanmeldingen weg; uitgenodigde klanten blijven staan (het team kan opnieuw uitnodigen)
    await this.d.run('DELETE FROM users WHERE email_verified_at IS NULL AND password_hash <> ? AND created_at < ?', [INVITED, new Date(Date.now() - UNVERIFIED_DAYS * 864e5).toISOString()]);
  }
  async listCustomers(): Promise<Customer[]> {
    const rows = await this.d.all('SELECT u.id, u.email, u.name, u.created_at, u.email_verified_at, u.role, u.disabled_at, u.last_login_at, (SELECT COUNT(*) FROM qr_codes q WHERE q.user_id = u.id AND q.trashed_at IS NULL) AS codes, (SELECT COALESCE(SUM(q.scans), 0) FROM qr_codes q WHERE q.user_id = u.id) AS scans, (SELECT MAX(r.expires_at) FROM password_resets r WHERE r.user_id = u.id) AS invite_until FROM users u ORDER BY u.created_at DESC');
    return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, createdAt: r.created_at, active: !!r.email_verified_at, codes: Number(r.codes) || 0, inviteUntil: r.email_verified_at ? null : r.invite_until || null,
      role: r.role || null, disabledAt: r.disabled_at || null, lastLoginAt: r.last_login_at || null, scans: Number(r.scans) || 0 }));
  }

  /* ---------- Beheer ---------- */
  async allQrCodes(): Promise<QrCode[]> { return (await this.d.all('SELECT * FROM qr_codes WHERE trashed_at IS NULL ORDER BY created_at DESC')).map(codeOut); }
  async scansPerDay(since: string): Promise<DayCount[]> {
    return (await this.d.all('SELECT day, SUM(scans) AS scans, SUM(uniq) AS uniq FROM scan_stats WHERE day >= ? GROUP BY day ORDER BY day', [since]))
      .map((r) => ({ day: r.day, scans: Number(r.scans) || 0, uniq: Number(r.uniq) || 0 }));
  }
  async codeTotals(since: string): Promise<CodeTotals> {
    const out: CodeTotals = {};
    for (const r of await this.d.all('SELECT code_id, SUM(uniq) AS u FROM scan_stats GROUP BY code_id')) out[r.code_id] = { uniq: Number(r.u) || 0, days: {} };
    for (const r of await this.d.all('SELECT code_id, day, SUM(scans) AS s, SUM(uniq) AS u FROM scan_stats WHERE day >= ? GROUP BY code_id, day', [since])) {
      (out[r.code_id] = out[r.code_id] || { uniq: 0, days: {} }).days[r.day] = [Number(r.s) || 0, Number(r.u) || 0];
    }
    return out;
  }
  async addAdminLog(e: AdminLogEntry) {
    await this.d.run('INSERT INTO admin_log (id, at, admin_id, admin_name, action, code_id, owner_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [newId(12), now(), e.adminId, cut(e.adminName, 120), e.action, e.codeId || null, e.ownerId || null, cut(e.detail || undefined, 500)]);
  }
  async listAdminLog(f: { codeId?: string; limit?: number } = {}): Promise<AdminLogEntry[]> {
    const lim = Math.min(500, Math.max(1, (f.limit || 50) | 0));
    const rows = f.codeId ? await this.d.all('SELECT * FROM admin_log WHERE code_id = ? ORDER BY at DESC LIMIT ' + lim, [f.codeId]) : await this.d.all('SELECT * FROM admin_log ORDER BY at DESC LIMIT ' + lim);
    return rows.map((r) => ({ id: r.id, at: r.at, adminId: r.admin_id, adminName: r.admin_name || '', action: r.action, codeId: r.code_id || null, ownerId: r.owner_id || null, detail: r.detail || null }));
  }
  async getSetting(key: string) { const r = await this.d.get('SELECT value FROM settings WHERE key = ?', [key]); return r ? r.value : null; }
  async setSetting(key: string, value: string | null) {
    if (value == null) { await this.d.run('DELETE FROM settings WHERE key = ?', [key]); return; }
    await this.d.run('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', [key, value, now()]);
  }

  /* ---------- QR-codes ---------- */
  async listFolders(userId: string): Promise<Folder[]> {
    return (await this.d.all('SELECT id, name, color, created_at FROM folders WHERE user_id = ? ORDER BY created_at', [userId])).map((r) => ({ id: r.id, name: r.name, color: r.color, createdAt: r.created_at }));
  }
  async createFolder(userId: string, f: { name: string; color: string }) {
    const id = newId(10), t = now();
    await this.d.run('INSERT INTO folders (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)', [id, userId, f.name, f.color, t]);
    return { id, name: f.name, color: f.color, createdAt: t };
  }
  async updateFolder(userId: string, id: string, patch: { name?: string; color?: string }) {
    const sets: string[] = [], vals: unknown[] = [];
    if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name); }
    if (patch.color !== undefined) { sets.push('color = ?'); vals.push(patch.color); }
    if (sets.length) await this.d.run('UPDATE folders SET ' + sets.join(', ') + ' WHERE id = ? AND user_id = ?', [...vals, id, userId]);
    return (await this.listFolders(userId)).find((f) => f.id === id) || null;
  }
  async deleteFolder(userId: string, id: string) {
    const del = await this.d.run('DELETE FROM folders WHERE id = ? AND user_id = ?', [id, userId]);
    if (!del.changes) return false;
    await this.d.run('UPDATE qr_codes SET folder_id = NULL WHERE folder_id = ? AND user_id = ?', [id, userId]);
    return true;
  }
  async moveToFolder(userId: string, codeIds: string[], folderId: string | null) {
    if (!codeIds.length) return 0;
    return (await this.d.run('UPDATE qr_codes SET folder_id = ? WHERE user_id = ? AND id IN (' + codeIds.map(() => '?').join(', ') + ')', [folderId, userId, ...codeIds])).changes || 0;
  }
  async listQrCodes(userId: string): Promise<QrCode[]> { return (await this.d.all(SQL.codesOf, [userId])).map(codeOut); }
  async listWithStats(userId: string, days?: { from?: string; to?: string }): Promise<QrCode[]> {
    const dw = (days && days.from ? ' AND day >= ?' : '') + (days && days.to ? ' AND day <= ?' : ''), dv = [days && days.from, days && days.to].filter(Boolean);
    const codes = (await this.d.all(SQL.codesOf, [userId])).map(codeOut), byId: Record<string, QrCode> = {};
    codes.forEach((c) => { c.stats = {}; byId[c.id] = c; });
    (await this.d.all('SELECT s.code_id, s.day, s.key, s.scans, s.uniq FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ?' + dw.replace(/day/g, 's.day'), [userId, ...dv]))
      .forEach((r) => { const c = byId[r.code_id]; if (!c) return; (c.stats[r.day] = c.stats[r.day] || {})[r.key] = [Number(r.scans), Number(r.uniq)]; });
    codes.forEach((c) => { c.hours = {}; });
    (await this.d.all('SELECT h.code_id, h.day, h.hour, h.scans FROM scan_hours h JOIN qr_codes q ON q.id = h.code_id WHERE q.user_id = ?' + dw.replace(/day/g, 'h.day'), [userId, ...dv]))
      .forEach((r) => { const c = byId[r.code_id]; if (!c) return; (c.hours[r.day] = c.hours[r.day] || {})[String(r.hour)] = Number(r.scans); });
    return codes;
  }
  async getQrCode(id: string): Promise<QrCode> { return codeOut(await this.d.get(SQL.code, [id])); }
  async idTaken(id: string) { return !!(await this.d.get('SELECT 1 AS x FROM qr_codes WHERE id = ?', [id])) || this.wasDeleted(id); }
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
    const real = sets.length > 0;                                      // alleen een sterretje of een markering = geen echte wijziging (Laatst bewerkt blijft)
    if (patch.moderation !== undefined) { sets.push('moderation = ?'); vals.push(patch.moderation && (patch.moderation.hold || patch.moderation.flag) ? JSON.stringify(patch.moderation) : null); }
    if (patch.favorite !== undefined) { sets.push('favorite = ?'); vals.push(patch.favorite ? 1 : 0); }
    if (patch.archived !== undefined) { sets.push('archived = ?'); vals.push(patch.archived ? 1 : 0); }
    if (patch.labels !== undefined) { sets.push('labels = ?'); vals.push(patch.labels.length ? JSON.stringify(patch.labels) : null); }
    if (patch.note !== undefined) { sets.push('note = ?'); vals.push(patch.note || null); }
    if (real) { sets.push('updated_at = ?'); vals.push(now()); }
    if (!sets.length) return this.getQrCode(id);
    await this.d.run('UPDATE qr_codes SET ' + sets.join(', ') + ' WHERE id = ?', [...vals, id]);
    return this.getQrCode(id);
  }
  /* Prullenbak: verwijderen = eerst 30 dagen in de prullenbak (link werkt dan niet), daarna echt weg (purgeQrCode) */
  async trashQrCode(id: string, userId: string) {
    const q = await this.d.get(SQL.code, [id]); if (!q || q.user_id !== userId || q.trashed_at) return false;
    await this.d.run('UPDATE qr_codes SET trashed_at = ? WHERE id = ?', [now(), id]); return true;
  }
  async restoreQrCode(id: string, userId: string) {
    const q = await this.d.get(SQL.code, [id]); if (!q || q.user_id !== userId || !q.trashed_at) return false;
    await this.d.run('UPDATE qr_codes SET trashed_at = NULL, folder_id = CASE WHEN folder_id IN (SELECT id FROM folders WHERE user_id = ?) THEN folder_id ELSE NULL END WHERE id = ?', [userId, id]); return true;
  }
  async transferQrCode(id: string, toUserId: string): Promise<boolean> {
    const q = await this.d.get(SQL.code, [id]); if (!q || q.trashed_at) return false;
    await this.d.run('UPDATE qr_codes SET user_id = ?, folder_id = NULL, archived = 0 WHERE id = ?', [toUserId, id]);
    await this.d.run('UPDATE files SET user_id = ? WHERE code_id = ?', [toUserId, id]);
    return true;
  }
  async listTrash(userId: string): Promise<QrCode[]> { return (await this.d.all(SQL.trashOf, [userId])).map(codeOut); }
  async trashedBefore(before: string): Promise<{ id: string; userId: string }[]> {
    return (await this.d.all('SELECT id, user_id FROM qr_codes WHERE trashed_at IS NOT NULL AND trashed_at < ?', [before])).map((r) => ({ id: r.id, userId: r.user_id }));
  }
  async deleteQrCode(id: string, userId: string) {
    const q = await this.d.get(SQL.code, [id]); if (!q || q.user_id !== userId) return false;
    const files = (await this.d.all(SQL.filesOfCode, [id])).map((r) => r.id);
    await this.d.run('DELETE FROM qr_codes WHERE id = ?', [id]); removeFiles(files);
    await this.markGone([id]);                                       // deze link wordt nooit opnieuw uitgegeven
    return true;
  }
  async addScan(id: string, info?: ScanInfo) {
    const t = now(), day = t.slice(0, 10), key = (info && info.key) || 'other||', L = info && info.log;
    const log: [string, unknown[]][] = L ? [['INSERT INTO scan_log (id, code_id, at, cc, city, region, lat, lon, os, br, dev, uniq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [newId(), id, t, L.cc || '', L.city || '', L.region || '', L.lat, L.lon, L.os || '', L.br || '', L.dev || '', L.uniq ? 1 : 0]]] : [];
    await this.d.batch([            // in één transactie
      ...log,
      ['UPDATE qr_codes SET scans = scans + 1, last_scan_at = ? WHERE id = ?', [t, id]],
      ['INSERT INTO scan_stats (code_id, day, key, scans, uniq) VALUES (?, ?, ?, 1, ?) ON CONFLICT (code_id, day, key) DO UPDATE SET scans = scan_stats.scans + 1, uniq = scan_stats.uniq + excluded.uniq',
        [id, day, key, !info || info.unique ? 1 : 0]],
      ['INSERT INTO scan_hours (code_id, day, hour, scans) VALUES (?, ?, ?, 1) ON CONFLICT (code_id, day, hour) DO UPDATE SET scans = scan_hours.scans + 1', [id, day, Number(t.slice(11, 13))]],
    ]);
    return this.getQrCode(id);
  }
  private scanWhere(codeId: string, q: ScanQuery) {
    const w = ['code_id = ?'], v: unknown[] = [codeId];
    if (q.from) { w.push('at >= ?'); v.push(q.from); } if (q.to) { w.push('at < ?'); v.push(q.to); } if (q.before) { w.push('at < ?'); v.push(q.before); }
    const inList = (col: string, list?: string[]) => { if (list && list.length) { w.push(col + ' IN (' + list.map(() => '?').join(',') + ')'); v.push(...list.slice(0, 200)); } };
    inList('os', q.os); inList('cc', q.cc); inList('br', q.br); inList('dev', q.dev); inList("(cc || '|' || city)", q.city);
    return { w: w.join(' AND '), v };
  }
  async listScans(codeId: string, q: ScanQuery) {
    const { w, v } = this.scanWhere(codeId, q);
    return (await this.d.all('SELECT * FROM scan_log WHERE ' + w + ' ORDER BY at DESC LIMIT ?', [...v, Math.min(Math.max(Number(q.limit) || 50, 1), 5000)])).map((r: any) => ({ id: r.id, at: r.at, cc: r.cc || '', city: r.city || '', region: r.region || '',
      lat: r.lat == null ? null : Number(r.lat), lon: r.lon == null ? null : Number(r.lon), os: r.os || '', br: r.br || '', dev: r.dev || '', uniq: !!Number(r.uniq) }));
  }
  async scanSummary(codeId: string, q: ScanQuery) {
    const { w, v } = this.scanWhere(codeId, { ...q, before: undefined });
    const tot: any = await this.d.get('SELECT COUNT(*) AS n FROM scan_log WHERE ' + w, v);
    const rows = await this.d.all('SELECT cc, city, MAX(region) AS region, AVG(lat) AS lat, AVG(lon) AS lon, COUNT(*) AS n, SUM(uniq) AS u FROM scan_log WHERE ' + w + ' AND lat IS NOT NULL AND lon IS NOT NULL GROUP BY cc, city ORDER BY n DESC LIMIT 3000', v);
    return { total: Number(tot && tot.n) || 0, places: rows.map((r: any) => ({ cc: r.cc || '', city: r.city || '', region: r.region || '', lat: Math.round(Number(r.lat) * 100) / 100, lon: Math.round(Number(r.lon) * 100) / 100, n: Number(r.n) || 0, u: Number(r.u) || 0 })) };
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
  async pruneLooseFile(id: string) { await this.d.run('DELETE FROM files WHERE id = ? AND code_id IS NULL', [id]); removeFiles([id]); }
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
