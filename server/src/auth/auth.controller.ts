/* =========================================================
   INLOGGEN EN ACCOUNT MAKEN  (/api/auth/…)
   - Account maken -> bevestigingsmail -> link (24 uur) -> pas daarna inloggen.
   - Bestaat een e-mailadres al, dan hetzelfde antwoord (niemand kan zien welke adressen een account hebben).
   - Wachtwoord vergeten: link per e-mail, 1 uur geldig, één keer te gebruiken.
   - Te veel pogingen = even wachten (429).
   ========================================================= */
import { turnstileOk } from './turnstile';
import { wasKicked } from '../database/database.service';
import { pwnedCount } from './pwned';
import { isBlocked } from './blocklist';
import { acceptTerms } from './terms';
import { isDisposable, canonicalEmail } from './email-rules';
import { saveSub, emptySub } from '../subscription';
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { checkCode, readTotp, useRecovery, writeTotp } from './totp';
import type { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthService, DUMMY_HASH } from './auth.service';
import { MailerService } from './mailer.service';
import { EMAIL } from '../qr-codes/validation';
import { baseUrl } from '../config/env';
import { fail } from '../common/http';
import { device, maskIp } from './account.controller';
import { startPending, readPending, endPending, pendingSecret } from './pending';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly mailer: MailerService) {}

  @Get('me')
  me(@Req() req: Request) {
    if (!req.user) throw fail(401, req.sid && wasKicked(req.sid) ? 'device_limit' : 'Not logged in');
    return this.auth.me(req.user);
  }

  @Post('register')
  @HttpCode(201)
  async register(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() b: any = {}) {
    if (!(await this.auth.signupOpen())) throw fail(403, 'signup_closed');                 // licentie: het team maakt accounts aan
    const email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').trim().slice(0, 80), lang = String(b.lang || 'en');
    if (this.auth.limited('reg:' + req.ip, 50, 60) || this.auth.limited('reg:' + email, 3, 60)) throw fail(429, 'too_many');
    if (!EMAIL.test(email) || email.length > 254) throw fail(400, 'email');
    if (!(await turnstileOk(b.captcha))) throw fail(400, 'captcha');            // Cloudflare Turnstile (als het aanstaat)
    if (isDisposable(email)) throw fail(400, 'email_disposable');             // tijdelijke mailbox: geen account
    if (await isBlocked(this.db, email)) throw fail(403, 'blocked');            // geblokkeerd (Terms punt 14): geen nieuw account
    const pp = this.auth.passwordProblem(b.password); if (pp) throw fail(400, 'password_' + pp);
    if (await pwnedCount(b.password)) throw fail(400, 'password_pwned');           // komt voor in bekende datalekken
    if (b.accept !== true) throw fail(400, 'terms');                            // 18+ en akkoord met Terms en Privacy (Terms punt 1 en 3)
    const existing = await this.db.userByEmail(email);
    // Variant van een adres dat al een account heeft (jan.devries+2@gmail.com = jandevries@gmail.com): geen tweede account
    if (!existing) { const c = canonicalEmail(email); if ((await this.db.listCustomers()).some((u) => u.email !== email && canonicalEmail(u.email) === c)) throw fail(409, 'email_alias'); }
    let token: string = null;
    if (!existing) {
      const user = await this.db.createUser({ email, name, passwordHash: await this.auth.hashPassword(b.password) });
      await saveSub(this.db, user.id, { ...emptySub(), mustPay: true });   // zelf geregistreerd: eerst een abonnement, dan pas codes maken
      await acceptTerms(this.db, user.id);
      token = await this.sendVerifyMail(req, user.id, email, lang);
      this.mailer.notifySignup(email, name, 'e-mail');
      await startPending(this.db, user.id, res, this.auth.secure(req));   // deze browser gaat vanzelf verder na het bevestigen
    } else if (!(await this.db.isVerified(existing.id))) {                   // nog niet bevestigd: nieuwe link
      token = await this.sendVerifyMail(req, existing.id, email, lang);
      // Alleen met hetzelfde wachtwoord gaat deze browser vanzelf verder (anders kon iemand anders zo in dit account komen)
      if (await this.auth.checkPassword(b.password || '', existing.password_hash)) await startPending(this.db, existing.id, res, this.auth.secure(req));
    } else throw fail(409, 'exists');                                       // al bevestigd: de app stuurt je naar inloggen
    return { verify: true, email, ...this.demoToken(token) };
  }

  private async sendVerifyMail(req: Request, userId: string, email: string, lang: string) {
    const token = await this.db.createVerification(userId), link = baseUrl(req) + '/?verify=' + encodeURIComponent(token);
    this.mailer.sendVerify(email, link, lang).catch((e) => console.error('E-mail versturen mislukt:', e.message));
    return token;
  }
  /** Alleen voor een demo-server zonder e-mail (SHOW_VERIFY_LINK=true en geen SMTP): de bevestigingscode gaat mee in het antwoord,
   *  zodat de app een knop "bevestigingslink openen" kan tonen. Nooit gebruiken voor echte klanten. */
  private demoToken(token: string | null) { return token && process.env.SHOW_VERIFY_LINK === 'true' && !this.mailer.configured ? { token } : {}; }

  /** Link uit de mail: account bevestigd. Daarna zelf inloggen. */
  @Post('verify')
  @HttpCode(200)
  async verify(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() b: any = {}) {
    if (this.auth.limited('verify:' + req.ip, 30, 60)) throw fail(429, 'too_many');
    const token = String(b.token || ''), old = await this.db.expiredVerification(token);
    if (old) {                                                               // verlopen: meteen een nieuwe link sturen (niet eerst laten inloggen)
      const u = await this.db.getUser(old);
      if (u && !u.disabledAt && !(await this.db.isVerified(old)) && !this.auth.limited('resend:' + u.email, 3, 60)) await this.sendVerifyMail(req, old, u.email, String(b.lang || u.lang || 'en'));
      throw fail(400, 'token_expired');
    }
    const userId = await this.db.useVerification(token);
    if (!userId) throw fail(400, 'token');
    const user = await this.db.getUser(userId);
    // Link geopend in dezelfde browser als waar het account gemaakt is: meteen ingelogd
    const secret = pendingSecret(this.auth.cookies(req));
    if (secret && (await readPending(this.db, secret)) === userId && !user.disabledAt) {
      await endPending(this.db, secret, res, this.auth.secure(req));
      return { ok: true, loggedIn: true, user: await this.signIn(req, res, userId) };
    }
    return { ok: true, email: user.email };
  }

  /** Scherm "check je e-mail": is het account al bevestigd (op een ander apparaat)? Dan hier vanzelf inloggen. */
  @Post('pending')
  @HttpCode(200)
  async pending(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.auth.limited('pending:' + req.ip, 3000, 60)) throw fail(429, 'too_many');
    const secret = pendingSecret(this.auth.cookies(req)), uid = await readPending(this.db, secret);
    const user = uid && await this.db.getUser(uid);
    if (!user) { if (secret) await endPending(this.db, secret, res, this.auth.secure(req)); return { state: 'none' }; }
    if (!(await this.db.isVerified(uid))) return { state: 'waiting', email: user.email };
    await endPending(this.db, secret, res, this.auth.secure(req));
    if (user.disabledAt) return { state: 'none' };
    return { state: 'in', user: await this.signIn(req, res, uid) };
  }

  /** Inloggen zonder wachtwoord na het bevestigen (alleen via verify/pending hierboven) */
  private async signIn(req: Request, res: Response, uid: string) {
    const meta = this.auth.meta(req);
    this.auth.setSession(req, res, await this.db.startSession(uid, meta));
    await this.db.addActivity(uid, 'login', meta);
    return this.auth.me(await this.db.updateUser(uid, { lastLoginAt: new Date().toISOString() }));
  }

  /** Nieuwe bevestigingsmail (altijd hetzelfde antwoord) */
  @Post('resend')
  @HttpCode(200)
  async resend(@Req() req: Request, @Body() b: any = {}) {
    const email = String(b.email || '').trim().toLowerCase();
    if (this.auth.limited('resend:' + req.ip, 10, 60) || this.auth.limited('resend:' + email, 3, 60)) throw fail(429, 'too_many');
    const row = EMAIL.test(email) && await this.db.userByEmail(email);
    let token: string = null;
    if (row && !(await this.db.isVerified(row.id))) token = await this.sendVerifyMail(req, row.id, email, String(b.lang || 'en'));
    return { ok: true, ...this.demoToken(token) };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() b: any = {}) {
    const email = String(b.email || '').trim().toLowerCase();
    if (this.auth.limited('login:' + req.ip, 100, 15) || this.auth.limited('login:' + email, 10, 15)) throw fail(429, 'too_many');
    const row = await this.db.userByEmail(email);
    const ok = await this.auth.checkPassword(b.password || '', row ? row.password_hash : DUMMY_HASH);
    if (row && !ok) await this.db.addActivity(row.id, 'login_failed', this.auth.meta(req));   // zie je terug bij Recente activiteit
    if (!row || !ok) throw fail(401, 'wrong');
    if (!(await this.db.isVerified(row.id))) throw fail(403, 'unverified');   // eerst e-mail bevestigen
    const user = await this.db.getUser(row.id);
    if (user.disabledAt) throw fail(403, 'disabled');                         // uitgezet door het team
    // Tweestapsverificatie aan? Dan ook de code uit de app (of een herstelcode)
    const totp = await readTotp(this.db, row.id);
    if (totp && totp.on) {
      const code = String(b.code || '').trim();
      if (!code) throw fail(401, '2fa_required');
      if (!checkCode(totp.secret, code)) {
        const left = useRecovery(totp, code);
        if (!left) { await this.db.addActivity(row.id, 'login_failed', this.auth.meta(req)); throw fail(401, '2fa_wrong'); }
        await writeTotp(this.db, row.id, { ...totp, codes: left });            // herstelcode is daarna op
      }
    }
    // Nieuw apparaat (browser + systeem nog nooit gezien bij een geslaagde aanmelding)? Dan een beveiligingsmail.
    const meta = this.auth.meta(req), dev = (ua: string | null) => { const d = device(ua); return d.browser + '|' + d.os; };
    const seen = (await this.db.listActivity(row.id, 100)).some((a) => a.kind === 'login' && dev(a.ua) === dev(meta.ua));
    const hadLogins = (await this.db.listActivity(row.id, 100)).some((a) => a.kind === 'login');
    this.auth.setSession(req, res, await this.db.startSession(row.id, meta));
    await this.db.addActivity(row.id, 'login', meta);
    if (hadLogins && !seen) { const d = device(meta.ua); this.mailer.sendSecurity(user, 'login', { device: [d.browser, d.os].filter(Boolean).join(' / ') || '?', ip: maskIp(meta.ip) || '?', time: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC' }).catch(() => {}); }
    return this.auth.me(await this.db.updateUser(row.id, { lastLoginAt: new Date().toISOString() }));
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
    if (!(await turnstileOk(b.captcha))) throw fail(400, 'captcha');
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
    if (await pwnedCount(b.password)) throw fail(400, 'password_pwned');           // komt voor in bekende datalekken
    const userId = await this.db.useReset(String(b.token || '')); if (!userId) throw fail(400, 'token');
    if ((await this.db.getUser(userId)).disabledAt) throw fail(403, 'disabled');
    await this.db.updateUser(userId, { passwordHash: await this.auth.hashPassword(b.password), passwordChangedAt: new Date().toISOString() });
    await this.db.markVerified(userId);                                // link uit de mail = e-mailadres is van jou
    await this.db.deleteSessionsOf(userId);                            // overal uitloggen
    this.auth.setSession(req, res, await this.db.startSession(userId, this.auth.meta(req)));
    await this.db.addActivity(userId, 'password', this.auth.meta(req));
    const fresh = await this.db.getUser(userId);
    this.mailer.sendSecurity(fresh, 'password', { time: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC' }).catch(() => {});
    return this.auth.me(fresh);
  }

  /** Link uit de mail naar je nieuwe e-mailadres: vanaf nu log je daarmee in. Het oude adres krijgt een melding. */
  @Post('email-change')
  @HttpCode(200)
  async emailChange(@Req() req: Request, @Body() b: any = {}) {
    if (this.auth.limited('emailchange:' + req.ip, 30, 60)) throw fail(429, 'too_many');
    const r = await this.db.useEmailChange(String(b.token || '')); if (!r) throw fail(400, 'token');
    const user = await this.db.getUser(r.userId); if (!user) throw fail(400, 'token');
    const taken = await this.db.userByEmail(r.email); if (taken && taken.id !== user.id) throw fail(409, 'exists');
    if (await isBlocked(this.db, r.email)) throw fail(403, 'blocked');
    if (this.auth.emailLocked(user)) throw fail(403, 'locked');
    const old = user.email;
    await this.db.updateUser(user.id, { email: r.email });
    await this.db.markVerified(user.id);
    await this.db.addActivity(user.id, 'email', this.auth.meta(req));
    this.mailer.sendEmailChanged(old, r.email, String(b.lang || 'en')).catch((e) => console.error('Melding oud e-mailadres mislukt:', e.message));
    return { ok: true, email: r.email };
  }
}
