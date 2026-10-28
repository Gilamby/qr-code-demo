/* =========================================================
   OPSLAG (DatabaseService)
   De rest van de app praat alleen met deze klasse. Welke database erachter zit, kiest database.module.ts:
   - MongoDB     als DATABASE_URL begint met mongodb:// of mongodb+srv://   (mongo.database.ts)
   - PostgreSQL  als DATABASE_URL begint met postgres://                     (sql.database.ts + postgres.driver.ts)
   - SQLite      zonder DATABASE_URL: één bestand, om te ontwikkelen          (sql.database.ts + sqlite.driver.ts)
   Alle drie geven precies dezelfde antwoorden terug.
   - Statistieken: aantallen per code per dag per "systeem|land|stad" (geen IP-adressen).
   - PDF/MP3 staan als bestand op schijf (<DATA_DIR>/files), niet in de database.
   - Wifi-wachtwoorden staan versleuteld in de database (secret.ts).
   Alles wat codes van een klant raakt vraagt het user-id: een klant ziet nooit codes van een ander.
   ========================================================= */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PATHS } from '../config/env';
import * as secret from './secret';
import type { Billing, QrCode, StoredFile, User } from '../types';

export const FILES_DIR = path.join(PATHS.data, 'files');
export const SQLITE_FILE = process.env.DB_PATH || path.join(PATHS.data, 'optimasys.db');

export const now = () => new Date().toISOString();
export const newId = (n = 9) => crypto.randomBytes(n).toString('base64url');
export const hash = (token: string) => crypto.createHash('sha256').update(String(token)).digest('base64url');
export const SESSION_DAYS = 365;              // ingelogd blijven tot je zelf uitlogt; elke dag dat je de app gebruikt, schuift dit op
export const VERIFY_HOURS = 24, RESET_HOURS = 1, UNVERIFIED_DAYS = 7;
/** Begin van de "laatste 30 dagen" (vandaag meegerekend), als JJJJ-MM-DD */
export const since30 = () => new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);

/* ---------- Gevoelige velden versleutelen (per soort inhoud) ---------- */
const SENSITIVE: Record<string, string[]> = { wifi: ['password'] };
export const SENSITIVE_TYPES = Object.keys(SENSITIVE);
export function sealContent(contentType: string, content: Record<string, any>) {
  const keys = SENSITIVE[contentType]; if (!keys || !content) return content;
  const c = { ...content }; keys.forEach((k) => { if (c[k]) c[k] = secret.encrypt(c[k]); }); return c;
}
export function openContent(contentType: string, content: Record<string, any>) {
  const keys = SENSITIVE[contentType]; if (!keys || !content) return content;
  keys.forEach((k) => { if (content[k]) content[k] = secret.decrypt(content[k]); }); return content;
}
export function removeFiles(ids: string[]) { ids.forEach((id) => { try { fs.unlinkSync(path.join(FILES_DIR, id)); } catch (e) { /* al weg */ } }); }

/** Gebruiker zoals userByEmail hem teruggeeft (met wachtwoord-hash, alleen voor inloggen) */
export interface UserRow { id: string; email: string; name: string; password_hash: string; email_verified_at: string | null; created_at: string }
export type NewQrCode = { id: string; typeId: string; contentType: string; content: Record<string, any>; design?: Record<string, any>; name?: string; createdAt?: string };
export type QrPatch = { content?: Record<string, any>; design?: Record<string, any>; name?: string; paused?: boolean; favorite?: boolean; labels?: string[]; note?: string; moderation?: Moderation | null };
/** Labels van een code: JSON-lijst in de database (leeg of kapot = geen labels) */
export function parseLabels(v: any): string[] { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, 10) : []; } catch (e) { return []; } }
/** Beheer: gepauzeerd door het team (hold, met reden; lock = klant mag hem niet zelf weer aanzetten) en/of gemarkeerd als verdacht (flag) */
export type ModNote = { reason: string; by: string; byName?: string; at: string; lock?: boolean };
export type Moderation = { hold?: ModNote; flag?: ModNote };
export function parseModeration(v: unknown): Moderation | null { let o: any = null; try { o = typeof v === 'string' ? JSON.parse(v) : v || null; } catch (e) { o = null; } return o && (o.hold || o.flag) ? o : null; }
/** Logboek van het beheer: wie deed wat met welke code (pauzeren, verwijderen, bewerken, exporteren …) */
export type AdminLogEntry = { id?: string; at?: string; adminId: string; adminName: string; action: string; codeId?: string | null; ownerId?: string | null; detail?: string | null };
/** Per code: unieke scans (alles) en scans per dag vanaf een datum (voor verdachte patronen) */
export type CodeTotals = Record<string, { uniq: number; days: Record<string, [number, number]> }>;
/** Hoe lang het beheerlog bewaard blijft */
export const ADMIN_LOG_DAYS = 365;
export type UserPatch = Partial<{ name: string; background: string; customBackground: string | null; passwordHash: string; email: string; role: string | null; disabledAt: string | null; lastLoginAt: string; avatar: string | null; timezone: string | null; passwordChangedAt: string; theme: string | null; emailPrefs: string | null; lang: string | null; media: string | null }>;
/** Waar je bent ingelogd (Mijn account > Beveiliging). id = deel van de hash, nooit de sessiecode zelf */
export type SessionInfo = { id: string; createdAt: string; seenAt: string | null; ua: string | null; ip: string | null; current?: boolean };
export type ClientMeta = { ua?: string; ip?: string };
/** Recente activiteit: login, login_failed, password, email, sessions_ended, session_ended */
export type Activity = { kind: string; at: string; ip: string | null; ua: string | null };
export const SESSION_ID_LEN = 16;
export const DEFAULT_EMAIL_PREFS = { report: 'off' as const, security: true, product: false, firstScan: true, milestones: true, brokenLinks: true, quietCodes: true };
export function parseMedia(v: unknown) { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch (e) { return []; } }
export function parsePrefs(v: unknown) { let o: any = {}; try { o = typeof v === 'string' ? JSON.parse(v) : v || {}; } catch (e) { o = {}; } return { ...DEFAULT_EMAIL_PREFS, ...o }; }
/** Map in Mijn QR-codes */
export type Folder = { id: string; name: string; color: string; createdAt: string };
export const EMAIL_CHANGE_HOURS = 24;
export type Summary = { codes: number; scans: number; scans30: number; sessions: number };
/** Een klant in de lijst van het team (pagina Klanten) */
export type Customer = { id: string; email: string; name: string; createdAt: string; active: boolean; codes: number; inviteUntil: string | null;
  role: string | null; disabledAt: string | null; lastLoginAt: string | null; scans: number };
/** Scans van het hele platform per dag (beheer-dashboard) */
export type DayCount = { day: string; scans: number; uniq: number };
/** Wachtwoord-hash van een account dat is uitgenodigd maar nog geen wachtwoord heeft gekozen (kan nooit inloggen) */
export const INVITED = 'invited';
export const INVITE_HOURS = 7 * 24;

/** Eén scan in het logboek: tijd, plaats (stad, regio, land, ongeveer), systeem, browser, apparaat, nieuw of terug. Geen IP. */
export type ScanLog = { cc: string; city: string; region: string; lat: number | null; lon: number | null; os: string; br: string; dev: string; uniq: boolean };
export type ScanInfo = { key: string; unique: boolean; log?: ScanLog };
/** Filters voor het logboek: periode, bladeren (before) en keuzes op de detailpagina */
export type ScanQuery = { from?: string; to?: string; before?: string; limit?: number; os?: string[]; cc?: string[]; city?: string[]; br?: string[]; dev?: string[] };
export type ScanPlace = { cc: string; city: string; region: string; lat: number; lon: number; n: number; u: number };
export type ScanRow = ScanLog & { id: string; at: string };
export const SCAN_LOG_DAYS = 400;   // logboek ruim een jaar bewaren, daarna weg (privacyverklaring)

export abstract class DatabaseService {
  abstract readonly kind: 'sqlite' | 'postgres' | 'mongodb';
  abstract readonly label: string;
  readonly filesDir = FILES_DIR;
  constructor() { fs.mkdirSync(FILES_DIR, { recursive: true }); }
  /** Naam voor in de logs en /api/health */
  get kindName() { return { sqlite: 'SQLite', postgres: 'PostgreSQL', mongodb: 'MongoDB' }[this.kind]; }

  abstract ping(): Promise<boolean>;
  abstract close(): Promise<void>;
  async onApplicationShutdown() { await this.close(); }

  /* ---------- Gebruikers en inloggen ---------- */
  abstract createUser(u: { email: string; name: string; passwordHash: string }): Promise<User>;
  /** Met password_hash (alleen voor inloggen) */
  abstract userByEmail(email: string): Promise<UserRow | null>;
  abstract isVerified(id: string): Promise<boolean>;
  abstract markVerified(id: string): Promise<unknown>;
  abstract getUser(id: string): Promise<User>;
  abstract passwordHashOf(id: string): Promise<string>;
  abstract updateUser(id: string, patch: UserPatch): Promise<User>;
  /** Account verwijderen: alles weg (codes, statistieken, sessies, bestanden op schijf) */
  abstract deleteUser(id: string): Promise<void>;
  /** Factuurgegevens (null = nog niet ingevuld) */
  abstract getBilling(userId: string): Promise<Billing | null>;
  abstract setBilling(userId: string, b: Billing): Promise<Billing>;

  /* Bevestigingslink: 24 uur geldig, één keer te gebruiken */
  abstract createVerification(userId: string): Promise<string>;
  abstract useVerification(token: string): Promise<string | null>;

  /* Sessies */
  abstract createSession(userId: string, meta?: ClientMeta): Promise<{ token: string; expires: string }>;
  /** Alle ingelogde apparaten (nieuwste eerst); current = deze sessie */
  abstract listSessions(userId: string, currentToken?: string): Promise<SessionInfo[]>;
  /** Eén apparaat uitloggen (id uit listSessions). true = gevonden */
  abstract endSession(userId: string, id: string): Promise<boolean>;
  /* Recente activiteit (max. 90 dagen bewaard) */
  abstract addActivity(userId: string, kind: string, meta?: ClientMeta): Promise<void>;
  abstract listActivity(userId: string, limit?: number): Promise<Activity[]>;
  /* E-mail wijzigen: link naar het nieuwe adres, 24 uur geldig, één keer te gebruiken */
  abstract createEmailChange(userId: string, email: string): Promise<string>;
  abstract useEmailChange(token: string): Promise<{ userId: string; email: string } | null>;
  /** Geldige sessie? Dan de gebruiker; sessies worden bij gebruik verlengd (max. 1x per dag) */
  abstract sessionUser(token: string): Promise<User | null>;
  abstract deleteSession(token: string): Promise<unknown>;
  abstract deleteSessionsOf(userId: string, exceptToken?: string): Promise<unknown>;
  /** Overzicht voor Mijn account: aantal codes, scans (totaal en laatste 30 dagen), ingelogde apparaten */
  abstract summary(userId: string): Promise<Summary>;

  /* Wachtwoord vergeten: één keer bruikbaar, 1 uur geldig */
  /** Link om een (nieuw) wachtwoord te kiezen; ook gebruikt voor uitnodigingen (dan 7 dagen geldig) */
  abstract createReset(userId: string, hours?: number): Promise<string>;
  abstract useReset(token: string): Promise<string | null>;
  /** Opruimen: verlopen sessies en links, nooit bevestigde accounts (na 7 dagen) */
  abstract cleanup(): Promise<void>;
  /** Alle accounts, nieuwste eerst (alleen voor het team) */
  abstract listCustomers(): Promise<Customer[]>;

  /* ---------- Beheer (alleen voor het team) ---------- */
  /** Alle QR-codes van iedereen, nieuwste eerst (zonder statistieken) */
  abstract allQrCodes(): Promise<QrCode[]>;
  /** Scans van alle codes samen per dag, vanaf 'since' (JJJJ-MM-DD) */
  abstract scansPerDay(since: string): Promise<DayCount[]>;
  /** Per code: unieke scans totaal + scans per dag vanaf 'since' */
  abstract codeTotals(since: string): Promise<CodeTotals>;
  /** Beheerlog: toevoegen en lezen (nieuwste eerst; optioneel alleen van één code) */
  abstract addAdminLog(e: AdminLogEntry): Promise<void>;
  abstract listAdminLog(f?: { codeId?: string; limit?: number }): Promise<AdminLogEntry[]>;
  /** Instellingen van het platform (vertalingen, DeepL-sleutel …): tekst per sleutel */
  abstract getSetting(key: string): Promise<string | null>;
  abstract setSetting(key: string, value: string | null): Promise<void>;

  /* ---------- QR-codes ---------- */
  /* Mappen (Mijn QR-codes). Map weg = de codes blijven, zonder map. */
  abstract listFolders(userId: string): Promise<Folder[]>;
  abstract createFolder(userId: string, f: { name: string; color: string }): Promise<Folder>;
  abstract updateFolder(userId: string, id: string, patch: { name?: string; color?: string }): Promise<Folder | null>;
  abstract deleteFolder(userId: string, id: string): Promise<boolean>;
  /** Codes (alleen eigen) in een map zetten; folderId null = uit de map. Geeft het aantal verplaatste codes. */
  abstract moveToFolder(userId: string, codeIds: string[], folderId: string | null): Promise<number>;
  /** Beheer: code (met bestanden en statistieken) naar een ander account; map los */
  abstract transferQrCode(id: string, toUserId: string): Promise<boolean>;
  abstract listQrCodes(userId: string): Promise<QrCode[]>;
  /** Met statistieken (voor /api/analytics): { stats: { dag: { sleutel: [scans, uniek] } } } */
  /** Codes met statistieken. Met days alleen die dagen (veel sneller bij veel scans). */
  abstract listWithStats(userId: string, days?: { from?: string; to?: string }): Promise<QrCode[]>;
  /** Openbaar (scannen) */
  abstract getQrCode(id: string): Promise<QrCode | null>;
  /** Eigen code (niet in de prullenbak; die kun je alleen terugzetten of definitief verwijderen) */
  async getOwnedQrCode(id: string, userId: string): Promise<QrCode | null> { const q = await this.getQrCode(id); return q && q.userId === userId && !q.trashedAt ? q : null; }
  /** Bestaat dit id al, of was het ooit van een (verwijderde) code? Een verwijderde link wordt nooit opnieuw uitgegeven. */
  abstract idTaken(id: string): Promise<boolean>;
  /** Was dit id van een code die is verwijderd? (dan krijgt de bezoeker "verwijderd" te zien) */
  async wasDeleted(id: string) { return !!(await this.getSetting('gone:' + id)); }
  /** Code echt weg: de link nooit opnieuw uitgeven, en losse gegevens van de code opruimen (geschiedenis, controle, A/B-telling) */
  protected async markGone(ids: string[]) { for (const id of ids) { await this.setSetting('gone:' + id, now()); for (const k of ['hist:', 'health:', 'ab:', 'quiet:', 'fb:', 'su:']) await this.setSetting(k + id, null).catch(() => {}); } }
  abstract insertQrCode(userId: string, q: NewQrCode): Promise<QrCode>;
  abstract updateQrCode(id: string, patch: QrPatch): Promise<QrCode>;
  /** Echt verwijderen (met statistieken en bestanden); de link wordt nooit opnieuw uitgegeven */
  abstract deleteQrCode(id: string, userId: string): Promise<boolean>;
  /** Prullenbak: 30 dagen bewaren (de link werkt dan niet), terugzetten kan */
  abstract trashQrCode(id: string, userId: string): Promise<boolean>;
  abstract restoreQrCode(id: string, userId: string): Promise<boolean>;
  abstract listTrash(userId: string): Promise<QrCode[]>;
  abstract trashedBefore(before: string): Promise<{ id: string; userId: string }[]>;
  /** Scan tellen: totaal + per dag per "systeem|land|stad" */
  abstract addScan(id: string, info?: ScanInfo): Promise<QrCode>;
  /** Logboek: losse scans van één code, nieuwste eerst (geen IP-adressen) */
  abstract listScans(codeId: string, q: ScanQuery): Promise<ScanRow[]>;
  /** Logboek samengevat in de database (snel, ook bij miljoenen scans): totaal en per plaats met coördinaten */
  abstract scanSummary(codeId: string, q: ScanQuery): Promise<{ total: number; places: ScanPlace[] }>;
  /** Alleen voor het overzetten van oude gegevens: statistieken van een code in één keer zetten */
  abstract importStats(codeId: string, stats: Record<string, Record<string, [number, number]>>, scans: number, lastScanAt: string | null): Promise<void>;

  /* ---------- Bestanden (PDF, MP3): op schijf, met een willekeurig id als naam ---------- */
  abstract saveFile(f: { userId: string; codeId: string | null; name: string; mime: string; buffer: Buffer }): Promise<string>;
  /** Bestand dat al op schijf staat (grote upload, zoals video) in de database zetten */
  abstract addFileRecord(f: { id: string; userId: string; codeId: string | null; name: string; mime: string; size: number }): Promise<void>;
  abstract attachFile(id: string, codeId: string): Promise<unknown>;
  abstract getFile(id: string): Promise<StoredFile | null>;
  /** Bestanden van een code die niet meer gebruikt worden (na bewerken) weghalen */
  abstract pruneFiles(codeId: string, keepIds: string[]): Promise<void>;
  /** Eén los bestand (nog zonder code) meteen weggooien, bv. een upload die geen echte foto bleek */
  abstract pruneLooseFile(id: string): Promise<void>;

  /** Versleutelde velden die nog leesbaar in de database staan alsnog versleutelen (bij het opstarten) */
  abstract sealOldRows(): Promise<void>;
  /** Back-up van de database naar een bestand (alleen SQLite; anders: pg_dump / mongodump) */
  abstract backup(to: string): Promise<unknown>;
  /** Voor tests: de inhoud van een code precies zoals hij in de database staat (om versleuteling te controleren) */
  abstract storedContent(id: string): Promise<string | null>;
}
