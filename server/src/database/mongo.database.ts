/* =========================================================
   Opslag in MongoDB (DATABASE_URL=mongodb://… of mongodb+srv://…).
   Collections (worden bij het opstarten met hun indexen aangemaakt):
     users               { _id, email, emailLower (uniek), name, passwordHash, background, customBackground, billing {…}, emailVerifiedAt, createdAt, updatedAt }
     sessions            { _id: hash van de sessiecode, userId, createdAt, expiresAt }
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
  Customer, DatabaseService, FILES_DIR, INVITED, NewQrCode, QrPatch, RESET_HOURS, SENSITIVE_TYPES, SESSION_DAYS, Summary, UNVERIFIED_DAYS, UserPatch, UserRow, VERIFY_HOURS,
  hash, newId, now, openContent, removeFiles, sealContent, since30,
} from './database.service';

interface Doc { _id?: string; [k: string]: any }
const DUPLICATE = 11000;

function codeOut(d: Doc): QrCode {
  if (!d) return null;
  return { id: d._id, userId: d.userId, typeId: d.typeId, contentType: d.contentType, content: openContent(d.contentType, d.content || {}), design: d.design || {},
    name: d.name || undefined, paused: !!d.paused, scans: Number(d.scans) || 0, lastScanAt: d.lastScanAt || null, createdAt: d.createdAt, updatedAt: d.updatedAt || undefined };
}
function userOut(d: Doc): User {
  return d && { id: d._id, email: d.email, name: d.name, background: d.background, customBackground: d.customBackground || null, createdAt: d.createdAt };
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

  private constructor(private readonly client: MongoClient, readonly db: Db, url: string) {
    super();
    this.label = safeMongoLabel(url);
    this.users = db.collection('users'); this.sessions = db.collection('sessions');
    this.resets = db.collection('passwordResets'); this.verifications = db.collection('emailVerifications');
    this.codes = db.collection('qrCodes'); this.stats = db.collection('scanStats'); this.files = db.collection('files');
  }

  /** Verbinden en de indexen aanmaken (mag vaker: bestaat de index al, dan gebeurt er niets) */
  static async open(url: string): Promise<MongoDatabase> {
    const client = new MongoClient(url, { ignoreUndefined: true, serverSelectionTimeoutMS: 10000, appName: 'optimasys-qr' });
    await client.connect();
    const m = new MongoDatabase(client, client.db(dbNameOf(url)), url);
    await Promise.all([
      m.users.createIndex({ emailLower: 1 }, { unique: true, name: 'email_unique' }),
      m.sessions.createIndex({ userId: 1 }),
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
    for (const k of ['name', 'background', 'customBackground', 'passwordHash'] as const) if (k in patch) set[k] = patch[k];
    if (patch.email !== undefined) { set.email = patch.email.trim(); set.emailLower = set.email.toLowerCase(); }
    if (!Object.keys(set).length) return this.getUser(id);
    set.updatedAt = now();
    await this.users.updateOne({ _id: id }, { $set: set });
    return this.getUser(id);
  }
  async deleteUser(id: string) {
    const files = (await this.files.find({ userId: id }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
    // eerst alles wat bij het account hoort, als laatste het account zelf (lukt iets niet, dan kan het opnieuw)
    await this.stats.deleteMany({ userId: id });
    await this.files.deleteMany({ userId: id });
    await this.codes.deleteMany({ userId: id });
    await this.sessions.deleteMany({ userId: id });
    await this.resets.deleteMany({ userId: id });
    await this.verifications.deleteMany({ userId: id });
    await this.users.deleteOne({ _id: id });
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

  async createSession(userId: string) {
    const token = newId(32), exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
    await this.sessions.insertOne({ _id: hash(token), userId, createdAt: now(), expiresAt: exp });
    return { token, expires: exp };
  }
  async sessionUser(token: string): Promise<User | null> {
    if (!token) return null;
    const s = await this.sessions.findOne({ _id: hash(token) }); if (!s) return null;
    if (s.expiresAt < now()) { await this.sessions.deleteOne({ _id: s._id }); return null; }
    const u = userOut(await this.users.findOne({ _id: s.userId })); if (!u) return null;
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
      codes: await this.codes.countDocuments({ userId }),
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
    // geüploade bestanden die nooit bij een code zijn opgeslagen (na een dag)
    const loose = (await this.files.find({ codeId: null, createdAt: { $lt: new Date(Date.now() - 864e5).toISOString() } }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
    if (loose.length) await this.files.deleteMany({ _id: { $in: loose } });
    removeFiles(loose);
    // nooit bevestigde aanmeldingen weg; uitgenodigde klanten blijven staan (het team kan opnieuw uitnodigen)
    const old = await this.users.find({ emailVerifiedAt: null, passwordHash: { $ne: INVITED }, createdAt: { $lt: new Date(Date.now() - UNVERIFIED_DAYS * 864e5).toISOString() } }, { projection: { _id: 1 } }).toArray();
    for (const u of old) await this.deleteUser(u._id);
  }
  async listCustomers(): Promise<Customer[]> {
    const users = await this.users.find({}, { projection: { email: 1, name: 1, createdAt: 1, emailVerifiedAt: 1 } }).sort({ createdAt: -1 }).toArray();
    const counts: Record<string, number> = {}, invites: Record<string, string> = {};
    for (const r of await this.codes.aggregate([{ $group: { _id: '$userId', n: { $sum: 1 } } }]).toArray()) counts[r._id] = Number(r.n) || 0;
    for (const r of await this.resets.find({}).toArray()) if (!invites[r.userId] || r.expiresAt > invites[r.userId]) invites[r.userId] = r.expiresAt;
    return users.map((u) => ({ id: u._id, email: u.email, name: u.name, createdAt: u.createdAt, active: !!u.emailVerifiedAt, codes: counts[u._id] || 0, inviteUntil: u.emailVerifiedAt ? null : invites[u._id] || null }));
  }

  /* ---------- QR-codes ---------- */
  private codesOf(userId: string) { return this.codes.find({ userId }).sort({ createdAt: -1 }).toArray(); }
  async listQrCodes(userId: string): Promise<QrCode[]> { return (await this.codesOf(userId)).map(codeOut); }
  async listWithStats(userId: string): Promise<QrCode[]> {
    const codes = (await this.codesOf(userId)).map(codeOut), byId: Record<string, QrCode> = {};
    codes.forEach((c) => { c.stats = {}; byId[c.id] = c; });
    for (const r of await this.stats.find({ userId }).toArray()) {
      const c = byId[r.codeId]; if (!c) continue;
      (c.stats[r.day] = c.stats[r.day] || {})[r.key] = [Number(r.scans), Number(r.uniq)];
    }
    return codes;
  }
  async getQrCode(id: string): Promise<QrCode> { return codeOut(await this.codes.findOne({ _id: id })); }
  async idTaken(id: string) { return !!(await this.codes.findOne({ _id: id }, { projection: { _id: 1 } })); }
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
    set.updatedAt = now();
    await this.codes.updateOne({ _id: id }, { $set: set });
    return this.getQrCode(id);
  }
  async deleteQrCode(id: string, userId: string) {
    const q = await this.codes.findOne({ _id: id }, { projection: { userId: 1 } }); if (!q || q.userId !== userId) return false;
    const files = (await this.files.find({ codeId: id }, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
    await this.stats.deleteMany({ codeId: id });
    await this.files.deleteMany({ codeId: id });
    await this.codes.deleteOne({ _id: id });
    removeFiles(files);
    return true;
  }
  async addScan(id: string, info?: { key: string; unique: boolean }) {
    const t = now(), day = t.slice(0, 10), key = (info && info.key) || 'other||', uniq = !info || info.unique ? 1 : 0;
    const code = await this.codes.findOneAndUpdate({ _id: id }, { $inc: { scans: 1 }, $set: { lastScanAt: t } }, { returnDocument: 'after' });
    if (!code) return null;
    const filter = { codeId: id, day, key }, inc = { $inc: { scans: 1, uniq } };
    try { await this.stats.updateOne(filter, { ...inc, $setOnInsert: { userId: code.userId } }, { upsert: true }); }
    catch (e) {
      // twee scans tegelijk op een nieuwe dag: de ander maakte de regel net aan, dus nu gewoon optellen
      if (e instanceof MongoServerError && e.code === DUPLICATE) await this.stats.updateOne(filter, inc); else throw e;
    }
    return codeOut(code);
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
