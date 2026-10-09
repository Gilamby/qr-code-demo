/* =========================================================
   INLOGGEN EN ACCOUNT MAKEN  (/api/auth/…)
   - Account maken -> bevestigingsmail -> link (24 uur) -> pas daarna inloggen.
   - Bestaat een e-mailadres al, dan hetzelfde antwoord (niemand kan zien welke adressen een account hebben).
   - Wachtwoord vergeten: link per e-mail, 1 uur geldig, één keer te gebruiken.
   - Te veel pogingen = even wachten (429).
   ========================================================= */
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthService, DUMMY_HASH } from './auth.service';
import { MailerService } from './mailer.service';
import { EMAIL } from '../qr-codes/validation';
import { baseUrl } from '../config/env';
import { fail } from '../common/http';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly mailer: MailerService) {}

  @Get('me')
  me(@Req() req: Request) {
    if (!req.user) throw fail(401, 'Not logged in');
    return this.auth.me(req.user);
  }

  @Post('register')
  @HttpCode(201)
  async register(@Req() req: Request, @Body() b: any = {}) {
    const email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').trim().slice(0, 80), lang = String(b.lang || 'en');
    if (this.auth.limited('reg:' + req.ip, 50, 60) || this.auth.limited('reg:' + email, 3, 60)) throw fail(429, 'too_many');
    if (!EMAIL.test(email) || email.length > 254) throw fail(400, 'email');
    const pp = this.auth.passwordProblem(b.password); if (pp) throw fail(400, 'password_' + pp);
    const existing = await this.db.userByEmail(email);
    if (!existing) {
      const user = await this.db.createUser({ email, name, passwordHash: await this.auth.hashPassword(b.password) });
      await this.sendVerifyMail(req, user.id, email, lang);
    } else if (!(await this.db.isVerified(existing.id))) await this.sendVerifyMail(req, existing.id, email, lang);   // nog niet bevestigd: nieuwe link
    return { verify: true, email };
  }

  private async sendVerifyMail(req: Request, userId: string, email: string, lang: string) {
    const link = baseUrl(req) + '/?verify=' + encodeURIComponent(await this.db.createVerification(userId));
    this.mailer.sendVerify(email, link, lang).catch((e) => console.error('E-mail versturen mislukt:', e.message));
  }

  /** Link uit de mail: account bevestigd. Daarna zelf inloggen. */
  @Post('verify')
  @HttpCode(200)
  async verify(@Req() req: Request, @Body() b: any = {}) {
    if (this.auth.limited('verify:' + req.ip, 30, 60)) throw fail(429, 'too_many');
    const userId = await this.db.useVerification(String(b.token || ''));
    if (!userId) throw fail(400, 'token');
    return { ok: true, email: (await this.db.getUser(userId)).email };
  }

  /** Nieuwe bevestigingsmail (altijd hetzelfde antwoord) */
  @Post('resend')
  @HttpCode(200)
  async resend(@Req() req: Request, @Body() b: any = {}) {
    const email = String(b.email || '').trim().toLowerCase();
    if (this.auth.limited('resend:' + req.ip, 10, 60) || this.auth.limited('resend:' + email, 3, 60)) throw fail(429, 'too_many');
    const row = EMAIL.test(email) && await this.db.userByEmail(email);
    if (row && !(await this.db.isVerified(row.id))) await this.sendVerifyMail(req, row.id, email, String(b.lang || 'en'));
    return { ok: true };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() b: any = {}) {
    const email = String(b.email || '').trim().toLowerCase();
    if (this.auth.limited('login:' + req.ip, 100, 15) || this.auth.limited('login:' + email, 10, 15)) throw fail(429, 'too_many');
    const row = await this.db.userByEmail(email);
    const ok = await this.auth.checkPassword(b.password || '', row ? row.password_hash : DUMMY_HASH);
    if (!row || !ok) throw fail(401, 'wrong');
    if (!(await this.db.isVerified(row.id))) throw fail(403, 'unverified');   // eerst e-mail bevestigen
    this.auth.setSession(req, res, await this.db.createSession(row.id));
    return this.auth.me(await this.db.getUser(row.id));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.sid) await this.db.deleteSession(req.sid);
    this.auth.clearSession(req, res);
  }

  /** Wachtwoord vergeten: altijd hetzelfde antwoord */
  @Post('forgot')
  @HttpCode(200)
  async forgot(@Req() req: Request, @Body() b: any = {}) {
    const email = String(b.email || '').trim().toLowerCase();
    if (this.auth.limited('forgot:' + req.ip, 10, 60) || this.auth.limited('forgot:' + email, 3, 60)) throw fail(429, 'too_many');
    const row = EMAIL.test(email) && await this.db.userByEmail(email);
    if (row) {
      const link = baseUrl(req) + '/?reset=' + encodeURIComponent(await this.db.createReset(row.id));
      this.mailer.sendReset(row.email, link, String(b.lang || 'en')).catch((e) => console.error('E-mail versturen mislukt:', e.message));
    }
    return { ok: true };
  }

  @Post('reset')
  @HttpCode(200)
  async reset(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() b: any = {}) {
    if (this.auth.limited('reset:' + req.ip, 20, 60)) throw fail(429, 'too_many');
    const pp = this.auth.passwordProblem(b.password); if (pp) throw fail(400, 'password_' + pp);
    const userId = await this.db.useReset(String(b.token || '')); if (!userId) throw fail(400, 'token');
    await this.db.updateUser(userId, { passwordHash: await this.auth.hashPassword(b.password) });
    await this.db.markVerified(userId);                                // link uit de mail = e-mailadres is van jou
    await this.db.deleteSessionsOf(userId);                            // overal uitloggen
    this.auth.setSession(req, res, await this.db.createSession(userId));
    return this.auth.me(await this.db.getUser(userId));
  }
}
