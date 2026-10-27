/* =========================================================
   Opslag in MongoDB (DATABASE_URL=mongodb://… of mongodb+srv://…).
   Collections (worden bij het opstarten met hun indexen aangemaakt):
     users               { _id, email, emailLower (uniek), name, passwordHash, background, customBackground, billing {…}, emailVerifiedAt, role, disabledAt, lastLoginAt, avatar, timezone, passwordChangedAt, createdAt, updatedAt }
     settings            { _id: sleutel, value, updatedAt }   (vertalingen, DeepL-sleutel …)
     sessions            { _id: hash van de sessiecode, userId, createdAt, expiresAt, ua, ip, seenAt }
     activity            { _id, userId, kind, at, ip, ua }   (recente activiteit, 90 dagen)
     emailChanges        { _id: hash van de code, userId, email, expiresAt }
     folders             { _id, userId, name, color, createdAt }   (qrCodes.folderId wijst hiernaar)
     passwordResets      { _id: hash van de code, userId, expiresAt }
     emailVerifications  { _id: hash van de code, userId, expiresAt }
     qrCodes             { _id, userId, typeId, contentType, content {…}, design {…}, name, paused, scans, lastScanAt, createdAt, updatedAt }
     scanStats           { codeId, userId, day, key, scans, uniq }   uniek per (codeId, day, key); geen IP-adressen
     files               { _id, codeId, userId, name, mime, size, createdAt }   (het bestand zelf staat op schijf)
   - Datums zijn ISO-tekst (2026-10-12T18:00:00.000Z), net als bij SQLite/PostgreSQL.
   - MongoDB kent geen ON DELETE CASCADE: account of code verwijderen ruimt hier zelf alles op.
   - Werkt met een losse MongoDB-server (geen replica set nodig): er worden geen transacties gebruikt.
     Elke stap is op zichzelf veilig (bv. een bevestigingslink kan maar één keer gebruikt worden).
   ========================================================= */
import * as fs from 'fs';
import * as path from 'path';
import { Collection, Db, MongoClient, MongoServerError } from 'mongodb';
import type { Billing, QrCode, StoredFile, User } from '../types';
import {
  Activity, AdminLogEntry, parseMedia, ADMIN_LOG_DAYS, ClientMeta, CodeTotals, parseModeration, Customer, Folder, parsePrefs, DatabaseService, DayCount, EMAIL_CHANGE_HOURS, SESSION_ID_LEN, SessionInfo, FILES_DIR, INVITED, NewQrCode, QrPatch, RESET_HOURS, SENSITIVE_TYPES, SESSION_DAYS, Summary, UNVERIFIED_DAYS, UserPatch, UserRow, VERIFY_HOURS,
  hash, newId, now, openContent, removeFiles, sealContent, since30, parseLabels, SCAN_LOG_DAYS, ScanQuery } from './database.service';
import type { ScanInfo } from './database.service';

interface Doc { _id?: string; [k: string]: any }
const DUPLICATE = 11000;

function codeOut(d: Doc): QrCode {
  if (!d) return null;
  return { id: d._id, userId: d.userId, typeId: d.typeId, contentType: d.contentType, content: openContent(d.contentType, d.content || {}), design: d.design || {},
    name: d.name || undefined, paused: !!d.paused, scans: Number(d.scans) || 0, lastScanAt: d.lastScanAt || null, createdAt: d.createdAt, updatedAt: d.updatedAt || undefined, folderId: d.folderId || null, favorite: !!d.favorite, labels: parseLabels(d.labels), note: d.note || '', moderation: parseModeration(d.moderation), trashedAt: d.trashedAt || null };
}
const cut = (v: string | undefined, n: number) => (v ? String(v).slice(0, n) : null);
function userOut(d: Doc): User {
  return d && { id: d._id, email: d.email, name: d.name, background: d.background, customBackground: d.customBackground || null, createdAt: d.createdAt,
    role: d.role || null, disabledAt: d.disabledAt || null, lastLoginAt: d.lastLoginAt || null,
    avatar: d.avatar || null, timezone: d.timezone || null, verified: !!d.emailVerifiedAt, passwordChangedAt: d.passwordChangedAt || null, theme: d.theme || null, emailPrefs: parsePrefs(d.emailPrefs), lang: d.lang || null, media: parseMedia(d.media) };
}
/** Adres zonder wachtwoord, voor in de logs */
export function safeMongoLabel(url: string) { return String(url).replace(/\/\/[^@/]*@/, '//***@').replace(/\?.*$/, ''); }
/** Databasenaam uit het adres (mongodb://host/<naam>), anders "optimasys" */
function dbNameOf(url: string) { const m = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(url); return m ? decodeURIComponent(m[1]) : 'optimasys'; }

export class MongoDatabase extends DatabaseService {
  readonly kind = 'mongodb' as const;
  readonly label: string;
  private readonly users: Collection<Doc>;
  private readonly sessions: Collection<Doc>;
  private readonly resets: Collection<Doc>;
  private readonly verifications: Collection<Doc>;
  private readonly codes: Collection<Doc>;
  private readonly stats: Collection<Doc>;
  private readonly files: Collection<Doc>;
  private readonly settings: Collection<Doc>;
  private readonly activity: Collection<Doc>;
  private readonly emailChanges: Collection<Doc>;
  private readonly folders: Collection<Doc>;
  private readonly adminLog: Collection<Doc>;
  private readonly hours: Collection<Doc>;
  private readonly scanLog: Collection<Doc>;

  private constructor(private readonly client: MongoClient, readonly db: Db, url: string) {
    super();
    this.label = safeMongoLabel(url);
    this.users = db.collection('users'); this.sessions = db.collection('sessions');
    this.resets = db.collection('passwordResets'); this.verifications = db.collection('emailVerifications');
    this.codes = db.collection('qrCodes'); this.stats = db.collection('scanStats'); this.files = db.collection('files'); this.settings = db.collection('settings');
    this.activity = db.collection('activity'); this.emailChanges = db.collection('emailChanges'); this.folders = db.collection('folders');
    this.adminLog = db.collection('adminLog');
    this.hours = db.collection('scanHours');
    this.scanLog = db.collection('scanLog');
  }

  /** Verbinden en de indexen aanmaken (mag vaker: bestaat de index al, dan gebeurt er niets) */
  static async open(url: string): Promise<MongoDatabase> {
    const client = new MongoClient(url, { ignoreUndefined: true, serverSelectionTimeoutMS: 10000, appName: 'optimasys-qr' });
    await client.connect();
    const m = new MongoDatabase(client, client.db(dbNameOf(url)), url);
    await Promise.all([
      m.users.createIndex({ emailLower: 1 }, { unique: true, name: 'email_unique' }),
      m.sessions.createIndex({ userId: 1 }),
      m.activity.createIndex({ userId: 1, at: -1 }),
      m.emailChanges.createIndex({ userId: 1 }),
      m.folders.createIndex({ userId: 1 }),
      m.adminLog.createIndex({ at: -1 }),
      m.hours.createIndex({ codeId: 1, day: 1, hour: 1 }, { unique: true, name: 'code_day_hour' }),
      m.scanLog.createIndex({ codeId: 1, at: -1 }, { name: 'code_at' }),
      m.scanLog.createIndex({ userId: 1 }, { name: 'user' }),
      m.scanLog.createIndex({ at: 1 }, { name: 'at' }),
      m.hours.createIndex({ userId: 1 }),
      m.adminLog.createIndex({ codeId: 1, at: -1 }),
      m.resets.createIndex({ userId: 1 }),
      m.verifications.createIndex({ userId: 1 }),
      m.codes.createIndex({ userId: 1, createdAt: -1 }),
      m.stats.createIndex({ codeId: 1, day: 1, key: 1 }, { unique: true, name: 'code_day_key' }),
      m.stats.createIndex({ userId: 1, day: 1 }),
      m.files.createIndex({ codeId: 1 }),
      m.files.createIndex({ userId: 1 }),
    ]);
    return m;
  }

  async ping() { return (await this.db.command({ ping: 1 })).ok === 1; }
  close() { return this.client.close(); }

  /* ---------- Gebruikers en inloggen ---------- */
  async createUser({ email, name, passwordHash }: { email: string; name: string; passwordHash: string }): Promise<User> {
    const id = newId(9), e = email.trim();
    await this.users.insertOne({ _id: id, email: e, emailLower: e.toLowerCase(), name: String(name || '').trim().slice(0, 80), passwordHash,
      background: 'optimasys', customBackground: null, emailVerifiedAt: null, createdAt: now(), updatedAt: null });
    return this.getUser(id);
  }
  async userByEmail(email: string): Promise<UserRow | null> {
    const d = await this.users.findOne({ emailLower: String(email || '').trim().toLowerCase() });
    return d ? { id: d._id, email: d.email, name: d.name, password_hash: d.passwordHash, email_verified_at: d.emailVerifiedAt || null, created_at: d.createdAt } : null;
  }
  async isVerified(id: string) { return !!((await this.users.findOne({ _id: id }, { projection: { emailVerifiedAt: 1 } })) || ({} as Doc)).emailVerifiedAt; }
  markVerified(id: string) { return this.users.updateOne({ _id: id, emailVerifiedAt: null }, { $set: { emailVerifiedAt: now() } }); }
  async getUser(id: string): Promise<User> { return userOut(await this.users.findOne({ _id: id })); }
  async passwordHashOf(id: string): Promise<string> { return ((await this.users.findOne({ _id: id }, { projection: { passwordHash: 1 } })) || ({} as Doc)).passwordHash; }
  async updateUser(id: string, patch: UserPatch): Promise<User> {
    const set: Doc = {};
    for (const k of ['name', 'background', 'customBackground', 'passwordHash', 'role', 'disabledAt', 'lastLoginAt', 'avatar', 'timezone', 'passwordChangedAt', 'theme', 'emailPrefs', 'lang', 'media'] as const) if (k in patch) set[k] = patch[k];
    if (patch.email !== undefined) { set.email = patch.email.trim(); set.emailLower = set.email.toLowerCase(); }
    if (!Object.keys(set).length) return this.getUser(id);
    set.updatedAt = now();
    await this.users.updateOne({ _id: id }, { $set: set });
    return this.getUser(id);
  }
  async deleteUser(id: string) {
    const files = (await this.files.find({ userId: id }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
    removeFiles(parseMedia(((await this.users.findOne({ _id: id }, { projection: { media: 1 } })) || ({} as any)).media).map((m: any) => m.id));   // eigen achtergronden
    // eerst alles wat bij het account hoort, als laatste het account zelf (lukt iets niet, dan kan het opnieuw)
    await this.stats.deleteMany({ userId: id });
    await this.hours.deleteMany({ userId: id });
    await this.scanLog.deleteMany({ userId: id });
    await this.files.deleteMany({ userId: id });
    await this.markGone((await this.codes.find({ userId: id }, { projection: { _id: 1 } }).toArray()).map((d) => d._id));
    await this.codes.deleteMany({ userId: id });
    await this.sessions.deleteMany({ userId: id });
    await this.resets.deleteMany({ userId: id });
    await this.verifications.deleteMany({ userId: id });
    await this.activity.deleteMany({ userId: id });
    await this.emailChanges.deleteMany({ userId: id });
    await this.folders.deleteMany({ userId: id });
    await this.users.deleteOne({ _id: id });
    await this.setSetting('bghide:' + id, null); await this.setSetting('plan:' + id, null); await this.setSetting('disabled:' + id, null); await this.setSetting('totp:' + id, null); await this.setSetting('terms:' + id, null); await this.setSetting('stripe:' + id, null); await this.setSetting('extra:' + id, null); await this.setSetting('planPaused:' + id, null); await this.setSetting('keep:' + id, null); await this.setSetting('payments:' + id, null); await this.setSetting('paymeta:' + id, null); await this.setSetting('uprefs:' + id, null); await this.setSetting('templates:' + id, null);
    removeFiles(files);
  }

  async getBilling(userId: string): Promise<Billing | null> {
    const d = await this.users.findOne({ _id: userId }, { projection: { billing: 1 } });
    return (d && d.billing) || null;
  }
  async setBilling(userId: string, b: Billing) {
    await this.users.updateOne({ _id: userId }, { $set: { billing: b, updatedAt: now() } });
    return this.getBilling(userId);
  }

  async createVerification(userId: string) {
    const token = newId(32);
    await this.verifications.deleteMany({ userId });
    await this.verifications.insertOne({ _id: hash(token), userId, expiresAt: new Date(Date.now() + VERIFY_HOURS * 3600e3).toISOString() });
    return token;
  }
  async useVerification(token: string): Promise<string | null> {
    const r = await this.verifications.findOneAndDelete({ _id: hash(token) });      // in één stap: werkt maar één keer
    if (!r || r.expiresAt < now()) return null;
    await this.markVerified(r.userId); return r.userId;
  }

  async createSession(userId: string, meta: ClientMeta = {}) {
    const token = newId(32), exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString(), t = now();
    await this.sessions.insertOne({ _id: hash(token), userId, createdAt: t, expiresAt: exp, ua: cut(meta.ua, 300), ip: cut(meta.ip, 64), seenAt: t });
    return { token, expires: exp };
  }
  async listSessions(userId: string, currentToken?: string): Promise<SessionInfo[]> {
    const cur = currentToken ? hash(currentToken) : '';
    const rows = await this.sessions.find({ userId, expiresAt: { $gt: now() } }).toArray();
    return rows.map((r) => ({ id: String(r._id).slice(0, SESSION_ID_LEN), createdAt: r.createdAt, seenAt: r.seenAt || null, ua: r.ua || null, ip: r.ip || null, current: r._id === cur }))
      .sort((a, b) => String(b.seenAt || b.createdAt).localeCompare(String(a.seenAt || a.createdAt)));
  }
  async endSession(userId: string, id: string) {
    if (!/^[A-Za-z0-9_-]{16}$/.test(id)) return false;
    return (await this.sessions.deleteMany({ userId, _id: { $regex: '^' + id } })).deletedCount > 0;
  }
  async addActivity(userId: string, kind: string, meta: ClientMeta = {}) {
    await this.activity.insertOne({ _id: newId(16), userId, kind, at: now(), ip: cut(meta.ip, 64), ua: cut(meta.ua, 300) });
  }
  async listActivity(userId: string, limit = 20): Promise<Activity[]> {
    return (await this.activity.find({ userId }).sort({ at: -1 }).limit(Math.min(100, Math.max(1, limit | 0))).toArray())
      .map((r) => ({ kind: r.kind, at: r.at, ip: r.ip || null, ua: r.ua || null }));
  }
  async createEmailChange(userId: string, email: string) {
    const token = newId(32);
    await this.emailChanges.deleteMany({ userId });
    await this.emailChanges.insertOne({ _id: hash(token), userId, email, expiresAt: new Date(Date.now() + EMAIL_CHANGE_HOURS * 3600e3).toISOString() });
    return token;
  }
  async useEmailChange(token: string) {
    const r = await this.emailChanges.findOneAndDelete({ _id: hash(token) });          // in één stap: werkt maar één keer
    if (!r || r.expiresAt < now()) return null;
    return { userId: r.userId, email: r.email };
  }
  async sessionUser(token: string): Promise<User | null> {
    if (!token) return null;
    const s = await this.sessions.findOne({ _id: hash(token) }); if (!s) return null;
    if (s.expiresAt < now()) { await this.sessions.deleteOne({ _id: s._id }); return null; }
    const u = userOut(await this.users.findOne({ _id: s.userId })); if (!u || u.disabledAt) return null;   // uitgezet door het team: niet ingelogd
    if (!s.seenAt || Date.now() - new Date(s.seenAt).getTime() > 5 * 6e4) await this.sessions.updateOne({ _id: s._id }, { $set: { seenAt: now() } });   // laatst actief (max. 1x per 5 min)
    if (new Date(s.expiresAt).getTime() - Date.now() < (SESSION_DAYS - 1) * 864e5) {         // hooguit één keer per dag verlengen
      const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
      await this.sessions.updateOne({ _id: s._id }, { $set: { expiresAt: exp } });
      Object.defineProperty(u, 'renewUntil', { value: exp, enumerable: false });   // dan wordt ook het cookie ververst
    }
    return u;
  }
  deleteSession(token: string) { return this.sessions.deleteOne({ _id: hash(token) }); }
  deleteSessionsOf(userId: string, exceptToken?: string) { return this.sessions.deleteMany({ userId, _id: { $ne: exceptToken ? hash(exceptToken) : '' } }); }

  private async sumScans(match: Doc) {
    const r = await this.stats.aggregate([{ $match: match }, { $group: { _id: null, n: { $sum: '$scans' } } }]).toArray();
    return r.length ? Number(r[0].n) || 0 : 0;
  }
  async summary(userId: string): Promise<Summary> {
    return {
      codes: await this.codes.countDocuments({ userId, trashedAt: null }),
      scans: await this.sumScans({ userId }),
      scans30: await this.sumScans({ userId, day: { $gte: since30() } }),
      sessions: await this.sessions.countDocuments({ userId, expiresAt: { $gt: now() } }),
    };
  }

  async createReset(userId: string, hours = RESET_HOURS) {
    const token = newId(32);
    await this.resets.deleteMany({ userId });
    await this.resets.insertOne({ _id: hash(token), userId, expiresAt: new Date(Date.now() + hours * 3600e3).toISOString() });
    return token;
  }
  async useReset(token: string): Promise<string | null> {
    const r = await this.resets.findOneAndDelete({ _id: hash(token) });
    return r && r.expiresAt > now() ? r.userId : null;
  }

  async cleanup() {
    const t = now();
    await this.sessions.deleteMany({ expiresAt: { $lt: t } });
    await this.resets.deleteMany({ expiresAt: { $lt: t } });
    await this.verifications.deleteMany({ expiresAt: { $lt: t } });
    await this.emailChanges.deleteMany({ expiresAt: { $lt: t } });
    await this.activity.deleteMany({ at: { $lt: new Date(Date.now() - 90 * 864e5).toISOString() } });
    await this.adminLog.deleteMany({ at: { $lt: new Date(Date.now() - ADMIN_LOG_DAYS * 864e5).toISOString() } });
    await this.scanLog.deleteMany({ at: { $lt: new Date(Date.now() - SCAN_LOG_DAYS * 864e5).toISOString() } });   // logboek: alleen de laatste 400 dagen
    // geüploade bestanden die nooit bij een code zijn opgeslagen (na een dag)
    const loose = (await this.files.find({ codeId: null, createdAt: { $lt: new Date(Date.now() - 864e5).toISOString() } }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
    if (loose.length) await this.files.deleteMany({ _id: { $in: loose } });
    removeFiles(loose);
    // nooit bevestigde aanmeldingen weg; uitgenodigde klanten blijven staan (het team kan opnieuw uitnodigen)
    const old = await this.users.find({ emailVerifiedAt: null, passwordHash: { $ne: INVITED }, createdAt: { $lt: new Date(Date.now() - UNVERIFIED_DAYS * 864e5).toISOString() } }, { projection: { _id: 1 } }).toArray();
    for (const u of old) await this.deleteUser(u._id);
  }
  async listCustomers(): Promise<Customer[]> {
    const users = await this.users.find({}, { projection: { email: 1, name: 1, createdAt: 1, emailVerifiedAt: 1, role: 1, disabledAt: 1, lastLoginAt: 1 } }).sort({ createdAt: -1 }).toArray();
    const counts: Record<string, number> = {}, scans: Record<string, number> = {}, invites: Record<string, string> = {};
    for (const r of await this.codes.aggregate([{ $match: { trashedAt: null } }, { $group: { _id: '$userId', n: { $sum: 1 }, s: { $sum: '$scans' } } }]).toArray()) { counts[r._id] = Number(r.n) || 0; scans[r._id] = Number(r.s) || 0; }
    for (const r of await this.resets.find({}).toArray()) if (!invites[r.userId] || r.expiresAt > invites[r.userId]) invites[r.userId] = r.expiresAt;
    return users.map((u) => ({ id: u._id, email: u.email, name: u.name, createdAt: u.createdAt, active: !!u.emailVerifiedAt, codes: counts[u._id] || 0, inviteUntil: u.emailVerifiedAt ? null : invites[u._id] || null,
      role: u.role || null, disabledAt: u.disabledAt || null, lastLoginAt: u.lastLoginAt || null, scans: scans[u._id] || 0 }));
  }

  /* ---------- Beheer ---------- */
  async allQrCodes(): Promise<QrCode[]> { return (await this.codes.find({ trashedAt: null }).sort({ createdAt: -1 }).toArray()).map(codeOut); }
  async scansPerDay(since: string): Promise<DayCount[]> {
    return (await this.stats.aggregate([{ $match: { day: { $gte: since } } }, { $group: { _id: '$day', scans: { $sum: '$scans' }, uniq: { $sum: '$uniq' } } }, { $sort: { _id: 1 } }]).toArray())
      .map((r) => ({ day: r._id, scans: Number(r.scans) || 0, uniq: Number(r.uniq) || 0 }));
  }
  async codeTotals(since: string): Promise<CodeTotals> {
    const out: CodeTotals = {};
    for (const r of await this.stats.aggregate([{ $group: { _id: '$codeId', u: { $sum: '$uniq' } } }]).toArray()) out[r._id] = { uniq: Number(r.u) || 0, days: {} };
    for (const r of await this.stats.aggregate([{ $match: { day: { $gte: since } } }, { $group: { _id: { c: '$codeId', d: '$day' }, s: { $sum: '$scans' }, u: { $sum: '$uniq' } } }]).toArray()) {
      (out[r._id.c] = out[r._id.c] || { uniq: 0, days: {} }).days[r._id.d] = [Number(r.s) || 0, Number(r.u) || 0];
    }
    return out;
  }
  async addAdminLog(e: AdminLogEntry) {
    await this.adminLog.insertOne({ _id: newId(12), at: now(), adminId: e.adminId, adminName: cut(e.adminName, 120), action: e.action, codeId: e.codeId || null, ownerId: e.ownerId || null, detail: cut(e.detail || undefined, 500) });
  }
  async listAdminLog(f: { codeId?: string; limit?: number } = {}): Promise<AdminLogEntry[]> {
    const lim = Math.min(500, Math.max(1, (f.limit || 50) | 0));
    return (await this.adminLog.find(f.codeId ? { codeId: f.codeId } : {}).sort({ at: -1 }).limit(lim).toArray())
      .map((r) => ({ id: r._id, at: r.at, adminId: r.adminId, adminName: r.adminName || '', action: r.action, codeId: r.codeId || null, ownerId: r.ownerId || null, detail: r.detail || null }));
  }
  async getSetting(key: string) { const d = await this.settings.findOne({ _id: key }); return d ? d.value : null; }
  async setSetting(key: string, value: string | null) {
    if (value == null) { await this.settings.deleteOne({ _id: key }); return; }
    await this.settings.updateOne({ _id: key }, { $set: { value, updatedAt: now() } }, { upsert: true });
  }

  /* ---------- QR-codes ---------- */
  private codesOf(userId: string) { return this.codes.find({ userId, trashedAt: null }).sort({ createdAt: -1 }).toArray(); }
  async listQrCodes(userId: string): Promise<QrCode[]> { return (await this.codesOf(userId)).map(codeOut); }
  async listWithStats(userId: string, days?: { from?: string; to?: string }): Promise<QrCode[]> {
    const df: Doc = {}; if (days && days.from) df.$gte = days.from; if (days && days.to) df.$lte = days.to; const f: Doc = Object.keys(df).length ? { userId, day: df } : { userId };
    const codes = (await this.codesOf(userId)).map(codeOut), byId: Record<string, QrCode> = {};
    codes.forEach((c) => { c.stats = {}; byId[c.id] = c; });
    for (const r of await this.stats.find(f).toArray()) {
      const c = byId[r.codeId]; if (!c) continue;
      (c.stats[r.day] = c.stats[r.day] || {})[r.key] = [Number(r.scans), Number(r.uniq)];
    }
    codes.forEach((c) => { c.hours = {}; });
    for (const r of await this.hours.find(f).toArray()) { const c = byId[r.codeId]; if (c) (c.hours[r.day] = c.hours[r.day] || {})[String(r.hour)] = Number(r.scans); }
    return codes;
  }
  async getQrCode(id: string): Promise<QrCode> { return codeOut(await this.codes.findOne({ _id: id })); }
  async idTaken(id: string) { return !!(await this.codes.findOne({ _id: id }, { projection: { _id: 1 } })) || this.wasDeleted(id); }
  async listFolders(userId: string): Promise<Folder[]> {
    return (await this.folders.find({ userId }).sort({ createdAt: 1 }).toArray()).map((d) => ({ id: d._id, name: d.name, color: d.color, createdAt: d.createdAt }));
  }
  async createFolder(userId: string, f: { name: string; color: string }) {
    const id = newId(10), t = now();
    await this.folders.insertOne({ _id: id, userId, name: f.name, color: f.color, createdAt: t });
    return { id, name: f.name, color: f.color, createdAt: t };
  }
  async updateFolder(userId: string, id: string, patch: { name?: string; color?: string }) {
    const set: Doc = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.color !== undefined) set.color = patch.color;
    if (Object.keys(set).length) await this.folders.updateOne({ _id: id, userId }, { $set: set });
    return (await this.listFolders(userId)).find((f) => f.id === id) || null;
  }
  async deleteFolder(userId: string, id: string) {
    if (!(await this.folders.deleteOne({ _id: id, userId })).deletedCount) return false;
    await this.codes.updateMany({ userId, folderId: id }, { $set: { folderId: null } });
    return true;
  }
  async moveToFolder(userId: string, codeIds: string[], folderId: string | null) {
    if (!codeIds.length) return 0;
    return (await this.codes.updateMany({ userId, _id: { $in: codeIds } }, { $set: { folderId } })).modifiedCount;
  }
  async insertQrCode(userId: string, q: NewQrCode) {
    await this.codes.insertOne({ _id: q.id, userId, typeId: q.typeId, contentType: q.contentType, content: sealContent(q.contentType, q.content), design: q.design || {},
      name: q.name || null, paused: false, scans: 0, lastScanAt: null, createdAt: q.createdAt || now(), updatedAt: null });
    return this.getQrCode(q.id);
  }
  async updateQrCode(id: string, patch: QrPatch) {
    const set: Doc = {};
    if (patch.content) {
      const cur = await this.codes.findOne({ _id: id }, { projection: { contentType: 1 } });
      set.content = sealContent(cur && cur.contentType, patch.content);
    }
    if (patch.design) set.design = patch.design;
    if (patch.name !== undefined) set.name = patch.name || null;
    if (patch.paused !== undefined) set.paused = !!patch.paused;
    if (Object.keys(set).length) set.updatedAt = now();                 // alleen een sterretje of een markering = geen echte wijziging
    if (patch.moderation !== undefined) set.moderation = patch.moderation && (patch.moderation.hold || patch.moderation.flag) ? patch.moderation : null;
    if (patch.favorite !== undefined) set.favorite = !!patch.favorite;
    if (patch.labels !== undefined) set.labels = patch.labels.length ? JSON.stringify(patch.labels) : null;
    if (patch.note !== undefined) set.note = patch.note || null;
    if (!Object.keys(set).length) return this.getQrCode(id);
    await this.codes.updateOne({ _id: id }, { $set: set });
    return this.getQrCode(id);
  }
  /* Prullenbak: zie sql.database.ts */
  async trashQrCode(id: string, userId: string) {
    const q = await this.codes.findOne({ _id: id }, { projection: { userId: 1, trashedAt: 1 } }); if (!q || q.userId !== userId || q.trashedAt) return false;
    await this.codes.updateOne({ _id: id }, { $set: { trashedAt: now() } }); return true;
  }
  async restoreQrCode(id: string, userId: string) {
    const q = await this.codes.findOne({ _id: id }, { projection: { userId: 1, trashedAt: 1, folderId: 1 } }); if (!q || q.userId !== userId || !q.trashedAt) return false;
    const keepFolder = q.folderId && (await this.folders.findOne({ _id: q.folderId, userId }, { projection: { _id: 1 } }));
    await this.codes.updateOne({ _id: id }, { $set: { trashedAt: null, folderId: keepFolder ? q.folderId : null } }); return true;
  }
  async listTrash(userId: string): Promise<QrCode[]> { return (await this.codes.find({ userId, trashedAt: { $ne: null } }).sort({ trashedAt: -1 }).toArray()).map(codeOut); }
  async trashedBefore(before: string): Promise<{ id: string; userId: string }[]> {
    return (await this.codes.find({ trashedAt: { $ne: null, $lt: before } }, { projection: { userId: 1 } }).toArray()).map((d) => ({ id: d._id, userId: d.userId }));
  }
  async deleteQrCode(id: string, userId: string) {
    const q = await this.codes.findOne({ _id: id }, { projection: { userId: 1 } }); if (!q || q.userId !== userId) return false;
    const files = (await this.files.find({ codeId: id }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
    await this.stats.deleteMany({ codeId: id });
    await this.hours.deleteMany({ codeId: id });
    await this.scanLog.deleteMany({ codeId: id });
    await this.files.deleteMany({ codeId: id });
    await this.codes.deleteOne({ _id: id });
    removeFiles(files);
    await this.markGone([id]);                                       // deze link wordt nooit opnieuw uitgegeven
    return true;
  }
  async addScan(id: string, info?: ScanInfo) {
    const t = now(), day = t.slice(0, 10), key = (info && info.key) || 'other||', uniq = !info || info.unique ? 1 : 0;
    const code = await this.codes.findOneAndUpdate({ _id: id }, { $inc: { scans: 1 }, $set: { lastScanAt: t } }, { returnDocument: 'after' });
    if (!code) return null;
    const filter = { codeId: id, day, key }, inc = { $inc: { scans: 1, uniq } };
    try { await this.stats.updateOne(filter, { ...inc, $setOnInsert: { userId: code.userId } }, { upsert: true }); }
    catch (e) {
      // twee scans tegelijk op een nieuwe dag: de ander maakte de regel net aan, dus nu gewoon optellen
      if (e instanceof MongoServerError && e.code === DUPLICATE) await this.stats.updateOne(filter, inc); else throw e;
    }
    const hf = { codeId: id, day, hour: Number(t.slice(11, 13)) };     // scans per uur (UTC)
    try { await this.hours.updateOne(hf, { $inc: { scans: 1 }, $setOnInsert: { userId: code.userId } }, { upsert: true }); }
    catch (e) { if (e instanceof MongoServerError && e.code === DUPLICATE) await this.hours.updateOne(hf, { $inc: { scans: 1 } }); else throw e; }
    const L = info && info.log;
    if (L) {
      await this.scanLog.insertOne({ _id: newId(), codeId: id, userId: code.userId, at: t, cc: L.cc || '', city: L.city || '', region: L.region || '', lat: L.lat, lon: L.lon, os: L.os || '', br: L.br || '', dev: L.dev || '', uniq: !!L.uniq });
    }
    return codeOut(code);
  }
  private scanMatch(codeId: string, q: ScanQuery) {
    const at: Doc = {}; if (q.from) at.$gte = q.from; if (q.to) at.$lt = q.to; if (q.before && (!at.$lt || q.before < at.$lt)) at.$lt = q.before;
    const f: Doc = { codeId }; if (Object.keys(at).length) f.at = at;
    for (const k of ['os', 'cc', 'br', 'dev'] as const) if (q[k] && q[k]!.length) f[k] = { $in: q[k]!.slice(0, 200) };
    if (q.city && q.city.length) f.$or = q.city.slice(0, 200).map((x) => { const i = x.indexOf('|'); return { cc: x.slice(0, i), city: x.slice(i + 1) }; });
    return f;
  }
  async listScans(codeId: string, q: ScanQuery) {
    return (await this.scanLog.find(this.scanMatch(codeId, q)).sort({ at: -1 }).limit(Math.min(Math.max(Number(q.limit) || 50, 1), 5000)).toArray())
      .map((d: any) => ({ id: d._id, at: d.at, cc: d.cc || '', city: d.city || '', region: d.region || '', lat: d.lat == null ? null : Number(d.lat), lon: d.lon == null ? null : Number(d.lon), os: d.os || '', br: d.br || '', dev: d.dev || '', uniq: !!d.uniq }));
  }
  async scanSummary(codeId: string, q: ScanQuery) {
    const m = this.scanMatch(codeId, { ...q, before: undefined });
    const total = await this.scanLog.countDocuments(m);
    const rows = await this.scanLog.aggregate([{ $match: { ...m, lat: { $ne: null }, lon: { $ne: null } } },
      { $group: { _id: { cc: '$cc', city: '$city' }, region: { $max: '$region' }, lat: { $avg: '$lat' }, lon: { $avg: '$lon' }, n: { $sum: 1 }, u: { $sum: { $cond: ['$uniq', 1, 0] } } } },
      { $sort: { n: -1 } }, { $limit: 3000 }]).toArray();
    return { total, places: rows.map((r: any) => ({ cc: r._id.cc || '', city: r._id.city || '', region: r.region || '', lat: Math.round(Number(r.lat) * 100) / 100, lon: Math.round(Number(r.lon) * 100) / 100, n: r.n, u: r.u })) };
  }
  async importStats(codeId: string, stats: Record<string, Record<string, [number, number]>>, scans: number, lastScanAt: string | null) {
    const code = await this.codes.findOne({ _id: codeId }, { projection: { userId: 1 } }); if (!code) return;
    for (const [day, keys] of Object.entries(stats || {})) for (const [key, v] of Object.entries(keys)) {
      await this.stats.updateOne({ codeId, day, key }, { $set: { userId: code.userId, scans: Number(v[0]) || 0, uniq: Number(v[1]) || 0 } }, { upsert: true });
    }
    await this.codes.updateOne({ _id: codeId }, { $set: { scans: scans || 0, lastScanAt: lastScanAt || null } });
  }

  /* ---------- Bestanden ---------- */
  async saveFile({ userId, codeId, name, mime, buffer }: { userId: string; codeId: string | null; name: string; mime: string; buffer: Buffer }) {
    const id = newId(16);
    fs.writeFileSync(path.join(FILES_DIR, id), buffer);
    await this.files.insertOne({ _id: id, codeId: codeId || null, userId, name, mime, size: buffer.length, createdAt: now() });
    return id;
  }
  async addFileRecord(f: { id: string; userId: string; codeId: string | null; name: string; mime: string; size: number }) {
    await this.files.insertOne({ _id: f.id, codeId: f.codeId || null, userId: f.userId, name: f.name, mime: f.mime, size: f.size, createdAt: now() });
  }
  attachFile(id: string, codeId: string) { return this.files.updateOne({ _id: id }, { $set: { codeId } }); }
  async getFile(id: string): Promise<StoredFile | null> {
    const d = await this.files.findOne({ _id: id }); if (!d) return null;
    return { id: d._id, code_id: d.codeId || null, user_id: d.userId, name: d.name, mime: d.mime, size: Number(d.size), created_at: d.createdAt, path: path.join(FILES_DIR, d._id) };
  }
  async pruneLooseFile(id: string) { await this.files.deleteOne({ _id: id, codeId: null }); removeFiles([id]); }
  async pruneFiles(codeId: string, keepIds: string[]) {
    const gone = (await this.files.find({ codeId }, { projection: { _id: 1 } }).toArray()).map((d) => d._id).filter((id) => keepIds.indexOf(id) < 0);
    if (gone.length) await this.files.deleteMany({ _id: { $in: gone } });
    removeFiles(gone);
  }

  async sealOldRows() {
    for (const d of await this.codes.find({ contentType: { $in: SENSITIVE_TYPES } }, { projection: { contentType: 1, content: 1 } }).toArray()) {
      const sealed = sealContent(d.contentType, d.content);
      if (JSON.stringify(sealed) !== JSON.stringify(d.content)) await this.codes.updateOne({ _id: d._id }, { $set: { content: sealed } });
    }
  }
  async backup(): Promise<unknown> { throw new Error('Back-up via dit script kan alleen bij SQLite. Gebruik mongodump voor MongoDB.'); }
  async storedContent(id: string) { const d = await this.codes.findOne({ _id: id }, { projection: { content: 1 } }); return d ? JSON.stringify(d.content) : null; }
}
