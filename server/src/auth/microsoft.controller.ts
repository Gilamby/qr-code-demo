/* =========================================================
   INLOGGEN MET MICROSOFT  (/api/auth/microsoft)
   Werkt alleen als MICROSOFT_CLIENT_ID en MICROSOFT_CLIENT_SECRET in .env staan (Azure-portal → App registrations,
   "Accounts in any organizational directory and personal Microsoft accounts", omleidings-URI (Web):
   <PUBLIC_URL>/api/auth/microsoft/callback). Anders is de knop onzichtbaar.
   Veiligheid: bij Microsoft kan het e-mailadres in een werk-account door de beheerder van dat bedrijf zelf zijn ingevuld
   (niet gecontroleerd). We vertrouwen het adres daarom alleen bij een persoonlijk Microsoft-account (outlook, hotmail, live)
   of als Microsoft meldt dat het domein van het adres van dat bedrijf is (claim xms_edov, in Azure aan te zetten).
   Verder hetzelfde als Google: bestaand account → inloggen; nieuw → alleen als zelf aanmelden aan staat (eerst betalen);
   tweestapsverificatie aan → daarna nog de code (zelfde stap als bij Google).
   ========================================================= */
import { MailerService } from './mailer.service';
import { isBlocked } from './blocklist';
import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';
import { readTotp } from './totp';
import { baseUrl } from '../config/env';
import { saveSub, emptySub } from '../subscription';
import { isDisposable } from './email-rules';
import { startSecondStep } from './google.controller';

export const microsoftOn = () => !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
const COOKIE = 'm_state';
const AUTHORITY = 'https://login.microsoftonline.com/' + (process.env.MICROSOFT_TENANT || 'common') + '/oauth2/v2.0';
const CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';   // persoonlijke Microsoft-accounts

/** De claims uit het id_token. We krijgen het token rechtstreeks van Microsoft (server tot server, via HTTPS), dus de inhoud is te vertrouwen. */
function claims(idToken: string): any {
  try { return JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8')); } catch { return {}; }
}

@Controller('api/auth/microsoft')
export class MicrosoftController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly mailer: MailerService) {}

  private back(req: Request) { return baseUrl(req) + '/api/auth/microsoft/callback'; }

  @Get()
  start(@Req() req: Request, @Res() res: Response) {
    if (!microsoftOn()) return res.redirect('/?merr=off');
    const state = crypto.randomBytes(24).toString('base64url');
    res.cookie(COOKIE, state, { httpOnly: true, sameSite: 'lax', secure: req.secure || /^https:/.test(baseUrl(req)), maxAge: 10 * 60 * 1000, path: '/api/auth/microsoft' });
    const q = new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID, redirect_uri: this.back(req), response_type: 'code', response_mode: 'query', scope: 'openid email profile', state, prompt: 'select_account' });
    res.redirect(AUTHORITY + '/authorize?' + q.toString());
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response, @Query('code') code: string, @Query('state') state: string) {
    const fail = (why: string) => res.redirect('/?merr=' + why);
    if (!microsoftOn()) return fail('off');
    const saved = (req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === COOKIE)?.[1];
    res.clearCookie(COOKIE, { path: '/api/auth/microsoft' });
    if (!code || !state || !saved || saved.length !== state.length || !crypto.timingSafeEqual(Buffer.from(saved), Buffer.from(state))) return fail('state');
    if (this.auth.limited('microsoft:' + req.ip, 30, 15)) return fail('too_many');
    try {
      const tok = await fetch(AUTHORITY + '/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: process.env.MICROSOFT_CLIENT_ID, client_secret: process.env.MICROSOFT_CLIENT_SECRET, redirect_uri: this.back(req), grant_type: 'authorization_code', scope: 'openid email profile' }) }).then((r) => r.json()) as any;
      if (!tok.id_token) return fail('microsoft');
      const c = claims(tok.id_token);
      if (c.aud !== process.env.MICROSOFT_CLIENT_ID) return fail('microsoft');
      const email = String(c.email || '').trim().toLowerCase();
      const trusted = c.tid === CONSUMER_TENANT || c.xms_edov === true || c.xms_edov === 1 || c.xms_edov === '1';
      if (!email || !trusted) return fail('unverified');
      let row = await this.db.userByEmail(email);
      if (!row) {
        if (!(await this.auth.signupOpen())) return fail('signup_closed');
        if (isDisposable(email)) return fail('email_disposable');
        if (await isBlocked(this.db, email)) return fail('blocked');
        const user = await this.db.createUser({ email, name: String(c.name || '').slice(0, 80), passwordHash: await this.auth.hashPassword(crypto.randomBytes(32).toString('hex')) });
        await saveSub(this.db, user.id, { ...emptySub(), mustPay: true });       // zoals elke nieuwe klant: eerst een abonnement kiezen
        this.mailer.notifySignup(email, user.name, 'Microsoft');
        row = await this.db.userByEmail(email);
      }
      const user = await this.db.getUser(row.id);
      if (user.disabledAt) return fail('disabled');
      if (!(await this.db.isVerified(row.id))) await this.db.markVerified(row.id);   // Microsoft heeft het adres bevestigd
      const totp = await readTotp(this.db, row.id);
      if (totp && totp.on) return res.redirect('/?g2fa=' + startSecondStep(row.id));   // de app vraagt nu om de code
      const meta = this.auth.meta(req);
      this.auth.setSession(req, res, await this.db.startSession(row.id, meta));
      await this.db.addActivity(row.id, 'login', meta);
      await this.db.updateUser(row.id, { lastLoginAt: new Date().toISOString() });
      res.redirect('/');
    } catch (e) {
      console.error('Microsoft-login mislukt:', (e as Error).message);
      fail('microsoft');
    }
  }
}
