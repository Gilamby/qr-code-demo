/* =========================================================
   ACCOUNTS: wachtwoorden, sessiecookies en "te veel pogingen"
   - Wachtwoord: scrypt (zout per gebruiker), nooit leesbaar opgeslagen.
   - Sessie: willekeurige code in een cookie "sid" (HttpOnly, SameSite=Lax, Secure op https).
     Je blijft ingelogd tot je uitlogt: 1 jaar, en elke dag dat je de app gebruikt schuift dat op.
     In de database staat alleen een hash van die code. Noodzakelijke cookie: geen cookiebanner nodig.
   ========================================================= */
import { signupOpen } from '../platform';
import { userOfKey } from './api-keys';
import { planFor } from '../plans';
import { memberOf, hasTeam, actionOf, addTeamLog } from '../team';
import { isBlocked } from '../subscription';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import { promisify } from 'util';
import type { NextFunction, Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { isProduction } from '../config/env';
import type { User } from '../types';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;
const COOKIE = 'sid';
const COMMON = ['12345678', '123456789', '1234567890', 'password', 'wachtwoord', 'qwertyui', 'qwerty123', '11111111', '87654321', 'password1', 'iloveyou', 'welkom01', 'admin123'];
/** Zelfde rekentijd als het account niet bestaat (niemand kan zo zien welke e-mailadressen een account hebben) */
export const DUMMY_HASH = 'scrypt$' + '0'.repeat(32) + '$' + '0'.repeat(128);

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly hits = new Map<string, number[]>();
  private readonly sweeper = setInterval(() => { const t = Date.now(); for (const [k, v] of this.hits) if (!v.some((x) => t - x < 3600e3)) this.hits.delete(k); }, 600e3);

  constructor(private readonly db: DatabaseService) { this.sweeper.unref(); }
  onModuleDestroy() { clearInterval(this.sweeper); }

  /* ---------- Wachtwoorden ---------- */
  async hashPassword(pw: string) { const salt = crypto.randomBytes(16).toString('hex'); return 'scrypt$' + salt + '$' + (await scrypt(String(pw), salt, 64)).toString('hex'); }
  async checkPassword(pw: string, stored: string) {
    const [, salt, h] = String(stored || '').split('$'); if (!salt || !h) return false;
    const a = Buffer.from(h, 'hex'), b = await scrypt(String(pw), salt, a.length || 64);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  /** Regels: minstens 8 tekens, 1 hoofdletter, 1 cijfer, 1 speciaal teken (zelfde als public/js/password-rules.js).
   *  '' = goed, anders 'short' | 'long' | 'common' | 'upper' | 'digit' | 'special' */
  passwordProblem(pw: unknown) {
    const s = String(pw || '');
    if (s.length < 8) return 'short';
    if (s.length > 200) return 'long';
    if (!/\p{Lu}/u.test(s)) return 'upper';
    if (!/\p{N}/u.test(s)) return 'digit';
    if (!/[^\p{L}\p{N}\s]/u.test(s)) return 'special';
    if (COMMON.indexOf(s.toLowerCase()) >= 0) return 'common';
    return '';
  }

  /* ---------- Te veel pogingen: even wachten ---------- */
  limited(key: string, max: number, minutes: number) {
    const t = Date.now(), win = minutes * 60e3, list = (this.hits.get(key) || []).filter((x) => t - x < win);
    list.push(t); this.hits.set(key, list);
    return list.length > max;
  }

  /* ---------- Cookies ---------- */
  private secure(req: Request) { return req.secure || isProduction(); }
  setSession(req: Request, res: Response, s: { token: string; expires: string }) {
    res.append('Set-Cookie', COOKIE + '=' + s.token + '; Path=/; HttpOnly; SameSite=Lax; Expires=' + new Date(s.expires).toUTCString() + (this.secure(req) ? '; Secure' : ''));
  }
  clearSession(req: Request, res: Response) {
    res.append('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT' + (this.secure(req) ? '; Secure' : ''));
  }
  private cookies(req: Request) {
    const out: Record<string, string> = {};
    String(req.get('cookie') || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (e) { /* kapot cookie: negeren */ } } });
    return out;
  }

  /** API (Business): Authorization: Bearer qrc_…  op /api/v1/qr-codes… en /api/v1/analytics.
   *  Zet req.apiUser en stuurt het verzoek door naar dezelfde routes als de app (/api/…), met dezelfde regels. */
  readonly apiAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!/^\/api\/v1(\/|$)/.test(req.path)) return next();
      const m = /^\/api\/v1\/(qr-codes(?:\/.*)?|analytics(?:\.csv)?)$/.exec(req.path);
      if (!m) { res.status(404).json({ error: 'not_found', docs: 'Mijn account > API' }); return; }
      const h = String(req.get('authorization') || ''), key = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
      if (!key) { res.status(401).json({ error: 'missing_key', message: 'Use: Authorization: Bearer <API key>' }); return; }
      if (this.limited('apikey:' + key.slice(0, 14), 300, 1)) { res.status(429).json({ error: 'too_many' }); return; }
      const who = await userOfKey(this.db, key);
      const user = who && await this.db.getUser(who.uid);
      if (!who || !user || user.disabledAt) { res.status(401).json({ error: 'invalid_key' }); return; }
      if (!(await planFor(this.db, user.id)).api && !this.isAdmin(user)) { res.status(403).json({ error: 'plan_api', message: 'The API is part of the Business plan.' }); return; }
      req.apiUser = user;
      req.url = req.url.replace(/^\/api\/v1\//, '/api/');
      next();
    } catch (e) { next(e); }
  };

  /** Middleware: wie is ingelogd? (zet req.user, of null) en verleng het cookie als de sessie verlengd is */
  readonly session = async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.sid = this.cookies(req)[COOKIE] || '';
      req.user = req.apiUser || await this.db.sessionUser(req.sid);   // API-sleutel (apiAuth) of het cookie
      if (!req.apiUser && req.user && req.user.renewUntil) this.setSession(req, res, { token: req.sid, expires: req.user.renewUntil });
      // Team (Business): een teamlid werkt in het account van de eigenaar (codes, mappen, uploads, statistieken).
      // Eigen profiel, wachtwoord en 2-stapsverificatie blijven van het lid zelf. Kijkers kunnen niets wijzigen.
      if (req.user && /^\/api\/(qr-codes|folders|uploads|analytics|account\/media)(\/|\.|$)/.test(req.path)) {
        const m = await memberOf(this.db, req.user.id);
        if (m) {
          if (m.role === 'viewer' && req.method !== 'GET' && req.method !== 'HEAD') { res.status(403).json({ error: 'viewer' }); return; }
          const owner = await this.db.getUser(m.ownerId);
          if (!owner) { res.status(403).json({ error: 'team_gone' }); return; }
          req.member = req.user; req.user = owner;
        }
        // Wie deed wat: wijzigingen in een account met een team bijhouden (van de eigenaar én van de leden)
        const act = req.method !== 'GET' && actionOf(req.method, req.path);
        if (act && (req.member || await hasTeam(this.db, req.user.id))) {
          const by = req.member || req.user, ownerId = req.user.id;
          res.on('finish', () => { if (res.statusCode < 400) addTeamLog(this.db, ownerId, { at: new Date().toISOString(), by: by.id, byName: by.name || by.email, action: act.action, codeId: act.codeId }).catch(() => {}); });
        }
      }
      // Onderhoudsmodus: klanten kunnen even niets wijzigen (bekijken en scannen werkt gewoon); het team wel
      if (req.method !== 'GET' && req.method !== 'HEAD' && /^\/api\//.test(req.path) && !/^\/api\/(auth|admin)\//.test(req.path) && !(req.user && this.isAdmin(req.user))) {
        const m = await this.maintenance();
        if (m.on) { res.status(503).json({ error: 'maintenance', message: m.message || null }); return; }
      }
      // Abonnement niet betaald: codes niet wijzigen of maken en geen statistieken (bekijken van de lijst en Mijn account blijven werken)
      if (req.user && !this.isAdmin(req.user) && isBlocked(req.user.id) &&
          ((req.method !== 'GET' && req.method !== 'HEAD' && /^\/api\/(qr-codes|folders|uploads)(\/|$)/.test(req.path)) || /^\/api\/analytics/.test(req.path))) {
        res.status(402).json({ error: 'subscription_lapsed' }); return;
      }
      next();
    } catch (e) { next(e); }
  };

  /** Onderhoudsmodus (settings 'maintenance'), 10 seconden onthouden */
  private maint = { at: 0, v: { on: false, message: '' } };
  async maintenance(): Promise<{ on: boolean; message: string }> {
    if (Date.now() - this.maint.at < 10000) return this.maint.v;
    let v = { on: false, message: '' }; try { const r = await this.db.getSetting('maintenance'); if (r) v = { on: !!JSON.parse(r).on, message: String(JSON.parse(r).message || '') }; } catch (e) { /* standaard: uit */ }
    this.maint = { at: Date.now(), v }; return v;
  }
  forgetMaintenance() { this.maint.at = 0; }

  /** Wat de app over de ingelogde gebruiker te zien krijgt */
  me(u: User) { return { id: u.id, email: u.email, name: u.name, background: u.background, customBackground: u.customBackground, createdAt: u.createdAt, avatar: u.avatar || null, timezone: u.timezone || null, verified: u.verified !== false, passwordChangedAt: u.passwordChangedAt || null, theme: u.theme || null, emailPrefs: u.emailPrefs || { report: 'off', security: true, product: false }, lang: u.lang || null, emailLocked: this.emailLocked(u), role: this.isSuper(u) ? 'super' : this.isAdmin(u) ? 'admin' : 'user', admin: this.isAdmin(u), superAdmin: this.isSuper(u) }; }

  /** Browser en IP van een verzoek (voor Apparaten en Recente activiteit) */
  meta(req: Request) { return { ua: String(req.get('user-agent') || ''), ip: String(req.ip || '') }; }
  /** E-mail staat vast in de serverinstellingen (SUPPORT_EMAIL / ADMIN_EMAILS): wijzigen zou de rechten kapotmaken */
  emailLocked(u: { email?: string }) {
    return this.envTeam().indexOf(String(u.email || '').toLowerCase()) >= 0;
  }
  /** Alle adressen die in .env staan: SUPPORT_EMAIL, SUPER_ADMIN_EMAILS en ADMIN_EMAILS */
  private envTeam() { return [process.env.SUPPORT_EMAIL || ''].concat(this.superList(), String(process.env.ADMIN_EMAILS || '').split(',')).map((x) => x.trim().toLowerCase()).filter(Boolean); }
  private superList() { return [process.env.SUPPORT_EMAIL || ''].concat(String(process.env.SUPER_ADMIN_EMAILS || '').split(',')).map((x) => x.trim().toLowerCase()).filter(Boolean); }

  /* ---------- Team (beheer) ----------
     Team-leden zien de pagina Klanten en kunnen klanten uitnodigen.
     Wie: SUPPORT_EMAIL en de adressen in ADMIN_EMAILS (komma's ertussen). */
  isAdmin(u: { email?: string; role?: string | null } | null) {
    if (!u || !u.email) return false;
    if (u.role === 'admin') return true;                                    // admin gemaakt door de super-admin (pagina Gebruikers)
    return this.envTeam().indexOf(String(u.email).toLowerCase()) >= 0;
  }
  /** Super-admin: het vaste team-account (SUPPORT_EMAIL) en wie in SUPER_ADMIN_EMAILS staat (komma's ertussen).
      Kan anderen admin maken; kan zelf niet uitgezet of verwijderd worden. */
  isSuper(u: { email?: string } | null) {
    return !!(u && u.email && this.superList().indexOf(String(u.email).toLowerCase()) >= 0);
  }
  /** Mag iedereen zelf een account maken? Standaard niet: klanten krijgen een account bij hun licentie (ALLOW_SIGNUP=true zet het aan). */
  /** Zelf aanmelden open? (Beheer > Instellingen > Aanmelden, anders ALLOW_SIGNUP in .env) */
  signupOpen() { return signupOpen(this.db); }
}
