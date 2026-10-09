/* =========================================================
   ACCOUNTS: wachtwoorden, sessiecookies en "te veel pogingen"
   - Wachtwoord: scrypt (zout per gebruiker), nooit leesbaar opgeslagen.
   - Sessie: willekeurige code in een cookie "sid" (HttpOnly, SameSite=Lax, Secure op https).
     Je blijft ingelogd tot je uitlogt: 1 jaar, en elke dag dat je de app gebruikt schuift dat op.
     In de database staat alleen een hash van die code. Noodzakelijke cookie: geen cookiebanner nodig.
   ========================================================= */
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
  /** '' = goed, anders 'short' | 'long' | 'common' */
  passwordProblem(pw: unknown) {
    const s = String(pw || '');
    if (s.length < 8) return 'short';
    if (s.length > 200) return 'long';
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

  /** Middleware: wie is ingelogd? (zet req.user, of null) en verleng het cookie als de sessie verlengd is */
  readonly session = async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.sid = this.cookies(req)[COOKIE] || '';
      req.user = await this.db.sessionUser(req.sid);
      if (req.user && req.user.renewUntil) this.setSession(req, res, { token: req.sid, expires: req.user.renewUntil });
      next();
    } catch (e) { next(e); }
  };

  /** Wat de app over de ingelogde gebruiker te zien krijgt */
  me(u: User) { return { id: u.id, email: u.email, name: u.name, background: u.background, customBackground: u.customBackground, createdAt: u.createdAt }; }
}
