/* =========================================================
   INLOGGEN MET GOOGLE  (/api/auth/google)
   Werkt alleen als GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET in .env staan (Google Cloud Console → OAuth-client,
   type "Webapplicatie", terugkeer-URL: <PUBLIC_URL>/api/auth/google/callback). Anders is de knop onzichtbaar.
   - Bestaand account met hetzelfde (door Google bevestigde) e-mailadres: inloggen.
   - Geen account: alleen als zelf aanmelden aan staat (ALLOW_SIGNUP); dan net als een gewone aanmelding eerst betalen.
   - Tweestapsverificatie aan: na Google nog de code uit de authenticator-app (Google slaat die stap niet over).
   ========================================================= */
import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';
import { readTotp, checkCode, useRecovery, writeTotp } from './totp';
import { fail as httpFail } from '../common/http';
import { baseUrl } from '../config/env';
import { saveSub, emptySub } from '../subscription';
import { isDisposable } from './email-rules';

export const googleOn = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const COOKIE = 'g_state';
// Google gelukt, maar tweestapsverificatie staat aan: kort bewaren wie dit is, tot de code is ingevuld (5 minuten, één keer)
const pending = new Map<string, { userId: string; exp: number }>();
/** Ook gebruikt door inloggen met Microsoft: na de externe login nog de code uit de authenticator-app vragen */
export function startSecondStep(userId: string) { const t = crypto.randomBytes(24).toString('base64url'); pending.set(t, { userId, exp: Date.now() + 5 * 60e3 }); return t; }

@Controller('api/auth/google')
export class GoogleController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  private back(req: Request) { return baseUrl(req) + '/api/auth/google/callback'; }

  @Get()
  start(@Req() req: Request, @Res() res: Response) {
    if (!googleOn()) return res.redirect('/?gerr=off');
    const state = crypto.randomBytes(24).toString('base64url');
    res.cookie(COOKIE, state, { httpOnly: true, sameSite: 'lax', secure: req.secure || /^https:/.test(baseUrl(req)), maxAge: 10 * 60 * 1000, path: '/api/auth/google' });
    const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: this.back(req), response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
    res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + q.toString());
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response, @Query('code') code: string, @Query('state') state: string) {
    const fail = (why: string) => res.redirect('/?gerr=' + why);
    if (!googleOn()) return fail('off');
    const saved = (req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === COOKIE)?.[1];
    res.clearCookie(COOKIE, { path: '/api/auth/google' });
    if (!code || !state || !saved || saved.length !== state.length || !crypto.timingSafeEqual(Buffer.from(saved), Buffer.from(state))) return fail('state');
    if (this.auth.limited('google:' + req.ip, 30, 15)) return fail('too_many');
    try {
      // Code inwisselen bij Google (server tot server, met ons geheim) en het e-mailadres ophalen
      const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: this.back(req), grant_type: 'authorization_code' }) }).then((r) => r.json()) as any;
      if (!tok.access_token) return fail('google');
      const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token } }).then((r) => r.json()) as any;
      const email = String(info.email || '').trim().toLowerCase();
      if (!email || info.email_verified !== true) return fail('unverified');
      let row = await this.db.userByEmail(email);
      if (!row) {
        if (!this.auth.signupOpen()) return fail('signup_closed');
        if (isDisposable(email)) return fail('email_disposable');
        const user = await this.db.createUser({ email, name: String(info.name || '').slice(0, 80), passwordHash: await this.auth.hashPassword(crypto.randomBytes(32).toString('hex')) });
        await saveSub(this.db, user.id, { ...emptySub(), mustPay: true });       // zoals elke nieuwe klant: eerst een abonnement kiezen
        row = await this.db.userByEmail(email);
      }
      const user = await this.db.getUser(row.id);
      if (user.disabledAt) return fail('disabled');
      const totp = await readTotp(this.db, row.id);
      if (!(await this.db.isVerified(row.id))) await this.db.markVerified(row.id);   // Google heeft het adres bevestigd
      if (totp && totp.on) {
        return res.redirect('/?g2fa=' + startSecondStep(row.id));                                            // de app vraagt nu om de code
      }
      await this.enter(req, res, row.id)
      res.redirect('/');
    } catch (e) {
      console.error('Google-login mislukt:', (e as Error).message);
      fail('google');
    }
  }

  /** Tweede stap na Google: de code uit de authenticator-app (of een herstelcode) */
  @Post('2fa')
  @HttpCode(200)
  async second(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() b: any = {}) {
    if (this.auth.limited('g2fa:' + req.ip, 20, 15)) throw httpFail(429, 'too_many');
    const p = pending.get(String(b.token || ''));
    if (!p || p.exp < Date.now()) { pending.delete(String(b.token || '')); throw httpFail(400, 'token'); }
    const totp = await readTotp(this.db, p.userId), code = String(b.code || '').trim();
    if (!totp || !totp.on) { pending.delete(b.token); throw httpFail(400, 'token'); }
    if (!checkCode(totp.secret, code)) {
      const left = useRecovery(totp, code);
      if (!left) { await this.db.addActivity(p.userId, 'login_failed', this.auth.meta(req)); throw httpFail(401, '2fa_wrong'); }
      await writeTotp(this.db, p.userId, { ...totp, codes: left });
    }
    pending.delete(b.token);
    await this.enter(req, res, p.userId);
    return this.auth.me(await this.db.getUser(p.userId));
  }

  private async enter(req: Request, res: Response, userId: string) {
    const meta = this.auth.meta(req);
    this.auth.setSession(req, res, await this.db.createSession(userId, meta));
    await this.db.addActivity(userId, 'login', meta);
    await this.db.updateUser(userId, { lastLoginAt: new Date().toISOString() });
  }
}
