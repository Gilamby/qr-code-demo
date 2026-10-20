/* =========================================================
   MIJN ACCOUNT  (/api/account, /api/me)
   Naam, wachtwoord, overzicht, uitloggen op andere apparaten, achtergrond, factuurgegevens,
   en de AVG-rechten: al je gegevens downloaden en je account verwijderen.
   ========================================================= */
import { cleanupTeam } from './team.controller';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';
import { CurrentUser, LoggedIn } from './auth.guard';
import { EMAIL, validateMe } from '../qr-codes/validation';
import { MailerService } from './mailer.service';
import { LANGS } from '../helpers/i18n-overrides';
import { buildReport, lastPeriod } from '../reports';
import { baseUrl } from '../config/env';
import { validateBilling } from './billing';
import { fail } from '../common/http';
import type { User } from '../types';
import { PLANS, planFor, usage } from '../plans';
import { subFor, publicSub, saveSub, renew, stateOf, DAY, toInterval } from '../subscription';
import { termsAccepted, acceptTerms, TERMS_VERSION } from './terms';
import { checkCode, newSecret, otpauth, readTotp, recoveryCodes, writeTotp } from './totp';

/** "Chrome op macOS" uit de browsertekst (alleen voor de lijst met apparaten) */
export function device(ua: string | null) {
  const s = String(ua || '');
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\/|CriOS/.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : s ? 'Browser' : '';
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? 'Android' : /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /CrOS/.test(s) ? 'ChromeOS' : /Linux/.test(s) ? 'Linux' : '';
  return { browser, os, mobile: /Mobi|iPhone|Android/.test(s) };
}
/** 84.104.12.7 -> 84.104.12.•••  (IPv6: alleen het begin) */
export function maskIp(ip: string | null) {
  const v = String(ip || '').replace(/^::ffff:/, '');
  if (!v) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) return v.replace(/\.\d+$/, '.•••');
  return v.split(':').slice(0, 3).join(':') + ':•••';
}

@Controller('api')
@UseGuards(LoggedIn)
export class AccountController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly mailer: MailerService) {}

  @Patch('account')
  async rename(@CurrentUser() user: User, @Body() b: any = {}) {
    const p: { name?: string; avatar?: string | null; timezone?: string | null; theme?: string | null; emailPrefs?: string; lang?: string } = {};
    if (b.name !== undefined) { if (typeof b.name !== 'string' || !b.name.trim()) throw fail(400, 'name'); p.name = b.name.trim().replace(/\s+/g, ' ').slice(0, 80); }
    if (b.avatar !== undefined) {                                       // profielfoto: al verkleind in de browser
      if (b.avatar !== null && !(typeof b.avatar === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.avatar) && b.avatar.length < 400000)) throw fail(400, 'avatar');
      p.avatar = b.avatar;
    }
    if (b.timezone !== undefined) {                                     // '' = volg het apparaat
      const tz = b.timezone ? String(b.timezone) : null;
      if (tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { throw fail(400, 'timezone'); } }
      p.timezone = tz && tz.length <= 64 ? tz : null;
    }
    if (b.emailPrefs !== undefined) {                                  // E-mailvoorkeuren (Mijn account > Meldingen)
      const e = b.emailPrefs || {}, cur = user.emailPrefs || { report: 'off', security: true, product: false };
      if (e.report !== undefined && !['off', 'weekly', 'monthly'].includes(e.report)) throw fail(400, 'emailPrefs');
      p.emailPrefs = JSON.stringify({ report: e.report !== undefined ? e.report : cur.report, security: e.security !== undefined ? !!e.security : cur.security, product: e.product !== undefined ? !!e.product : cur.product });
    }
    if (b.lang !== undefined) { if (!LANGS.includes(b.lang)) throw fail(400, 'lang'); p.lang = b.lang; }
    if (b.theme !== undefined) { if (!['dark', 'light', 'system'].includes(b.theme)) throw fail(400, 'theme'); p.theme = b.theme; }
    if (!Object.keys(p).length) throw fail(400, 'name');
    return this.auth.me(await this.db.updateUser(user.id, p));
  }

  @Post('account/password')
  @HttpCode(200)
  async password(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (this.auth.limited('pw:' + user.id, 10, 15)) throw fail(429, 'too_many');
    if (!(await this.auth.checkPassword(b.current || '', await this.db.passwordHashOf(user.id)))) throw fail(403, 'wrong');   // 403: wel ingelogd, verkeerd wachtwoord
    const pp = this.auth.passwordProblem(b.password); if (pp) throw fail(400, 'password_' + pp);
    await this.db.updateUser(user.id, { passwordHash: await this.auth.hashPassword(b.password), passwordChangedAt: new Date().toISOString() });
    await this.db.deleteSessionsOf(user.id, req.sid);                  // andere apparaten uitloggen
    await this.db.addActivity(user.id, 'password', this.auth.meta(req));
    this.mailer.sendSecurity(user, 'password', { time: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC' }).catch(() => {});
    return { ok: true, passwordChangedAt: new Date().toISOString() };
  }

  /* ---------- Tweestapsverificatie (authenticator-app) ---------- */
  @Get('account/2fa')
  async twoFactor(@CurrentUser() user: User) { const t = await readTotp(this.db, user.id); return { enabled: !!(t && t.on), recoveryLeft: t && t.on ? t.codes.length : 0 }; }

  /** Stap 1: nieuw geheim (nog niet aan); de app toont het als QR-code */
  @Post('account/2fa/setup')
  @HttpCode(200)
  async twoFactorSetup(@CurrentUser() user: User) {
    const cur = await readTotp(this.db, user.id); if (cur && cur.on) throw fail(409, 'already_on');
    const secret = newSecret(); await writeTotp(this.db, user.id, { secret, on: false, codes: [] });
    return { secret, otpauth: otpauth(secret, user.email) };
  }
  /** Stap 2: code uit de app klopt → aan, met 10 herstelcodes (alleen nu te zien) */
  @Post('account/2fa/enable')
  @HttpCode(200)
  async twoFactorEnable(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (this.auth.limited('2fa:' + user.id, 10, 15)) throw fail(429, 'too_many');
    const t = await readTotp(this.db, user.id); if (!t || t.on) throw fail(400, 'no_setup');
    if (!checkCode(t.secret, b.code)) throw fail(400, 'code_wrong');
    const rc = recoveryCodes(); await writeTotp(this.db, user.id, { secret: t.secret, on: true, codes: rc.hashed });
    await this.db.addActivity(user.id, '2fa_on', this.auth.meta(req));
    return { ok: true, recoveryCodes: rc.plain };
  }
  /** Uitzetten: alleen met het wachtwoord */
  @Post('account/2fa/disable')
  @HttpCode(200)
  async twoFactorDisable(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (this.auth.limited('pw:' + user.id, 10, 15)) throw fail(429, 'too_many');
    if (!(await this.auth.checkPassword(b.password || '', await this.db.passwordHashOf(user.id)))) throw fail(403, 'wrong');
    await writeTotp(this.db, user.id, null);
    await this.db.addActivity(user.id, '2fa_off', this.auth.meta(req));
    return { ok: true };
  }

  /** Factuurgegevens: ophalen (null = nog niet ingevuld) en opslaan */
  @Get('account/billing')
  async billing(@CurrentUser() user: User) { return { billing: await this.db.getBilling(user.id) }; }

  @Put('account/billing')
  async saveBilling(@CurrentUser() user: User, @Body() b: any = {}) {
    const { errors, value } = validateBilling(b);
    if (errors.length) throw fail(400, 'Invalid billing details', { details: errors });
    return { billing: await this.db.setBilling(user.id, value) };
  }

  /** Overzicht: aantal codes, scans, ingelogde apparaten */
  @Get('account/summary')
  async summary(@CurrentUser() user: User) {
    return { createdAt: user.createdAt, ...(await this.db.summary(user.id)) };
  }

  /** Abonnement: huidig pakket, gebruik en de pakketten (prijzen = voorstel, betalen kan nog niet) */
  @Get('account/plan')
  async plan(@CurrentUser() user: User) {
    const plan = await planFor(this.db, user.id), codes = (await this.db.listQrCodes(user.id)).length;
    return { plan, usage: usage(plan, codes), plans: Object.values(PLANS).filter((p) => p.id !== 'free'), payments: false, sub: publicSub(await subFor(this.db, user.id)) };
  }

  /** Akkoord met de voorwaarden (18+, Terms, Privacy). Wie via Google/Microsoft een account kreeg, of een account van het team,
   *  heeft nog niet akkoord gegeven: de app vraagt het dan één keer. Het team (beheer) hoeft niet. */
  @Get('account/terms')
  async terms(@CurrentUser() u: User) {
    return { ok: this.auth.isAdmin(u) || (await termsAccepted(this.db, u.id)), version: TERMS_VERSION };
  }
  @Post('account/terms')
  @HttpCode(200)
  async accept(@CurrentUser() u: User, @Body() b: any = {}) {
    if (b.accept !== true) throw fail(400, 'terms');
    await acceptTerms(this.db, u.id);
    return { ok: true, version: TERMS_VERSION };
  }

  /** DEMO-afrekenen (zolang Stripe er nog niet is; alleen met DEMO_CHECKOUT=true in .env).
   *  Alleen voor een nieuwe klant die nog nooit betaald heeft: pakket kiezen → "betaald" → de app in.
   *  Daarna zie je het pakket-scherm nooit meer. Zoals straks bij Stripe: 14 dagen gratis, daarna de eerste periode. */
  @Post('account/checkout-demo')
  @HttpCode(200)
  async checkoutDemo(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (process.env.DEMO_CHECKOUT !== 'true') throw fail(403, 'off');
    const planId = String(b.plan || ''), interval = toInterval(b.period);
    if (!['standard', 'pro', 'business'].includes(planId)) throw fail(400, 'plan');
    const sub = await subFor(this.db, user.id);
    if (stateOf(sub) !== 'unpaid') throw fail(409, 'done');                       // maar één keer, en nooit voor wie al betaalt
    const trial = (PLANS[planId].trialDays || 0) * DAY;
    await this.db.setSetting('plan:' + user.id, planId);
    await saveSub(this.db, user.id, renew({ ...sub, mustPay: false }, interval, Date.now() + trial));
    await this.db.addActivity(user.id, 'plan_chosen', this.auth.meta(req));
    return { ok: true, sub: publicSub(await subFor(this.db, user.id)) };
  }

  /** Uitloggen op alle andere apparaten (deze blijft ingelogd) */
  @Post('account/logout-others')
  @HttpCode(200)
  async logoutOthers(@Req() req: Request, @CurrentUser() user: User) {
    await this.db.deleteSessionsOf(user.id, req.sid);
    await this.db.addActivity(user.id, 'sessions_ended', this.auth.meta(req));
    return { ok: true };
  }

  /** Apparaten waar je bent ingelogd (browser, systeem, IP deels verborgen, laatst actief) */
  @Get('account/sessions')
  async sessions(@Req() req: Request, @CurrentUser() user: User) {
    return { sessions: (await this.db.listSessions(user.id, req.sid)).map((s) => ({ id: s.id, current: !!s.current, createdAt: s.createdAt, seenAt: s.seenAt, ...device(s.ua), ip: maskIp(s.ip) })) };
  }
  /** Eén ander apparaat uitloggen */
  @Delete('account/sessions/:id')
  @HttpCode(204)
  async endSession(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    const cur = (await this.db.listSessions(user.id, req.sid)).find((s) => s.current);
    if (cur && cur.id === id) throw fail(400, 'current');               // dit apparaat: gewoon uitloggen
    if (!(await this.db.endSession(user.id, String(id)))) throw fail(404, 'not_found');
    await this.db.addActivity(user.id, 'session_ended', this.auth.meta(req));
  }
  /** Recente activiteit: inloggen (ook mislukt), wachtwoord, e-mail, uitloggen op andere apparaten */
  @Get('account/activity')
  async activity(@CurrentUser() user: User) {
    return { activity: (await this.db.listActivity(user.id, 20)).map((a) => ({ kind: a.kind, at: a.at, ...device(a.ua), ip: maskIp(a.ip) })) };
  }

  /** E-mail wijzigen: met je wachtwoord; we sturen een link naar het nieuwe adres. Pas na klikken verandert het. */
  @Post('account/email')
  @HttpCode(200)
  async changeEmail(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (this.auth.limited('email:' + user.id, 5, 60)) throw fail(429, 'too_many');
    if (this.auth.emailLocked(user)) throw fail(403, 'locked');
    const email = String(b.email || '').trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) throw fail(400, 'email');
    if (email === String(user.email).toLowerCase()) throw fail(400, 'same');
    if (!(await this.auth.checkPassword(b.password || '', await this.db.passwordHashOf(user.id)))) throw fail(403, 'wrong');
    if (await this.db.userByEmail(email)) throw fail(409, 'exists');
    const token = await this.db.createEmailChange(user.id, email), link = baseUrl(req) + '/?email=' + encodeURIComponent(token);
    this.mailer.sendEmailChange(email, link, String(b.lang || 'en')).catch((e) => console.error('E-mail versturen mislukt:', e.message));
    // Demo-server zonder mail (SHOW_VERIFY_LINK=true): de link gaat mee, zodat je hem kunt testen
    return { sent: true, email, mail: this.mailer.configured, ...(process.env.SHOW_VERIFY_LINK === 'true' && !this.mailer.configured ? { link } : {}) };
  }

  /** Voorbeeld van het scanoverzicht (zoals de e-mail eruitziet), ook zonder mailserver */
  @Get('account/report-preview')
  async reportPreview(@Req() req: Request, @CurrentUser() user: User) {
    const period = req.query.period === 'weekly' ? 'weekly' : 'monthly', lang = LANGS.includes(String(req.query.lang)) ? String(req.query.lang) : user.lang || 'en';
    const data = await buildReport(this.db, user.id, period, lastPeriod(period, new Date()));
    return this.mailer.renderReport(lang, user, data, baseUrl(req));
  }

  /** AVG: al je gegevens downloaden */
  @Get('account/export')
  async export(@CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
    const codes = (await this.db.listWithStats(user.id)).map((q) => {
      const c = { ...q.content }; Object.keys(c).forEach((k) => { if (/password/i.test(k) && q.typeId !== 'wifi') delete c[k]; });
      return { ...q, content: c, userId: undefined };
    });
    res.set('Content-Disposition', 'attachment; filename="optimasys-mijn-gegevens.json"');
    return { exportedAt: new Date().toISOString(), account: this.auth.me(user), billing: await this.db.getBilling(user.id), qrCodes: codes };
  }

  /** AVG: account en alles verwijderen (met wachtwoord) */
  @Delete('account')
  @HttpCode(204)
  async remove(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser() user: User, @Body() b: any = {}) {
    if (this.auth.isSuper(user)) throw fail(403, 'super');                // het hoofdaccount van het team blijft altijd bestaan
    if (this.auth.limited('del:' + user.id, 10, 15)) throw fail(429, 'too_many');
    if (!(await this.auth.checkPassword(b.password || '', await this.db.passwordHashOf(user.id)))) throw fail(403, 'wrong');
    await cleanupTeam(this.db, user.id);                                    // team: leden weg (eigenaar) of uit het team (lid)
    await this.db.deleteUser(user.id);
    this.auth.clearSession(req, res);
  }

  /* Instellingen van de gebruiker (achtergrond) */
  @Get('me')
  async settings(@CurrentUser() user: User) {
    return { name: user.name, background: user.background, customBackground: user.customBackground, media: user.media || [], hiddenBackgrounds: await this.hiddenOf(user.id) };
  }
  /** Verborgen standaard-achtergronden (per gebruiker, in settings 'bghide:<id>') */
  private async hiddenOf(id: string): Promise<string[]> { try { return JSON.parse((await this.db.getSetting('bghide:' + id)) || '[]'); } catch (e) { return []; } }

  @Patch('me')
  async updateSettings(@CurrentUser() user: User, @Body() b: any = {}) {
    const { errors, value } = validateMe(b || {});
    if (errors.length) throw fail(400, 'Invalid profile update', { details: errors });
    if (value.background && value.background.startsWith('media:') && !(user.media || []).some((m) => 'media:' + m.id === value.background)) throw fail(400, 'Invalid profile update', { details: ['background: unknown'] });
    const { hidden, ...rest } = value as any;
    if (hidden) await this.db.setSetting('bghide:' + user.id, hidden.length ? JSON.stringify(hidden) : null);
    // Verborgen of weggehaald terwijl hij aan stond: terug naar Optimasys
    if ((hidden && hidden.includes(rest.background || user.background)) || (rest.customBackground === null && (rest.background || user.background) === 'custom')) rest.background = 'optimasys';
    const u = await this.db.updateUser(user.id, rest);
    return { name: u.name, background: u.background, customBackground: u.customBackground, media: u.media || [], hiddenBackgrounds: await this.hiddenOf(user.id) };
  }
}
