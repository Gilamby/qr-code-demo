/* =========================================================
   MIJN ACCOUNT  (/api/account, /api/me)
   Naam, wachtwoord, overzicht, uitloggen op andere apparaten, achtergrond, factuurgegevens,
   en de AVG-rechten: al je gegevens downloaden en je account verwijderen.
   ========================================================= */
import { pwnedCount } from './pwned';
import * as crypto from 'crypto';
import { isBlocked } from './blocklist';
import { cleanupTeam } from './team.controller';
import { membersOf } from '../team';
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
import { PLANS, planFor, usage, bgAllowed, EXTRA_PRICE, EXTRA_MAX } from '../plans';
import { subFor, publicSub, saveSub, renew, stateOf, DAY, toInterval, emptySub } from '../subscription';
import { termsAccepted, acceptTerms, TERMS_VERSION } from './terms';
import { planPausedIds, fitToPlan, activeCount } from '../plan-limit';
import { stripeOn, readRecord, stripe, demoCheckoutOn, amountFor } from '../billing/stripe';
import { taxOn } from '../billing/tax';
import { listKeys, createKey, revokeKey, revokeAll, publicKey, MAX_KEYS } from './api-keys';
import { addPayment, listPayments, demoMethod, setDemoMethod } from '../billing/history';
import { readBuyer, applyBuyer, needsVies, checkVies } from '../billing/tax';
import { checkCode, newSecret, otpauth, readTotp, recoveryCodes, writeTotp } from './totp';

/** "Chrome op macOS" uit de browsertekst (alleen voor de lijst met apparaten) */
export function device(ua: string | null) {
  const s = String(ua || '');
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\/|CriOS/.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : s ? 'Browser' : '';
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? 'Android' : /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /CrOS/.test(s) ? 'ChromeOS' : /Linux/.test(s) ? 'Linux' : '';
  return { browser, os, mobile: /Mobi|iPhone|Android/.test(s) };
}
/** 84.104.12.7 -> 84.104.12.•••  (IPv6: alleen het begin) */
import { maskIp } from '../common/ip';
export { maskIp };

const START_PAGES = ['home', 'create', 'myCodes', 'analytics'];

const TOUR_SINCE = '2026-10-27';   // accounts van vóór de rondleiding krijgen hem niet automatisch (wel via Help > Rondleiding opnieuw)

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
      const e = b.emailPrefs || {}, cur: any = user.emailPrefs || { report: 'off', security: true, product: false, firstScan: true, milestones: true, brokenLinks: true };
      if (e.report !== undefined && !['off', 'weekly', 'monthly'].includes(e.report)) throw fail(400, 'emailPrefs');
      p.emailPrefs = JSON.stringify({ report: e.report !== undefined ? e.report : cur.report, security: e.security !== undefined ? !!e.security : cur.security, product: e.product !== undefined ? !!e.product : cur.product,
        firstScan: e.firstScan !== undefined ? !!e.firstScan : cur.firstScan !== false, milestones: e.milestones !== undefined ? !!e.milestones : cur.milestones !== false, brokenLinks: e.brokenLinks !== undefined ? !!e.brokenLinks : cur.brokenLinks !== false,
        quietCodes: e.quietCodes !== undefined ? !!e.quietCodes : cur.quietCodes !== false });
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
    if (await pwnedCount(b.password)) throw fail(400, 'password_pwned');           // komt voor in bekende datalekken
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
    const before = await this.db.getBilling(user.id);
    if (before && before.type && before.type !== value.type) throw fail(409, 'type_locked');   // bedrijf of particulier: één keer kiezen (btw)
    const saved = await this.db.setBilling(user.id, value);
    syncBillingToStripe(this.db, user, value).catch((e) => console.error('Factuurgegevens naar Stripe mislukt:', e.message));   // facturen van Stripe tonen dezelfde gegevens
    return { billing: saved };
  }

  /** Overzicht: aantal codes, scans, ingelogde apparaten */
  @Get('account/summary')
  async summary(@CurrentUser() user: User) {
    return { createdAt: user.createdAt, ...(await this.db.summary(user.id)) };
  }

  /** Abonnement: huidig pakket, gebruik en de pakketten (prijzen = voorstel, betalen kan nog niet) */
  @Get('account/plan')
  async plan(@CurrentUser() user: User) {
    const plan = await planFor(this.db, user.id), all = await this.db.listQrCodes(user.id), codes = all.filter((q) => !q.paused).length;
    const planPaused = (await planPausedIds(this.db, user.id)).filter((id) => all.some((q) => q.id === id && q.paused));
    const rec = await readRecord(this.db, user.id), demo = !stripeOn(), hist = demo ? await listPayments(this.db, user.id) : [];
    // Extra regels voor het overzicht: proefperiode, opgezegd, betaalmethode (demo), team-grootte
    const billing = {
      trial: demo ? ((pl) => !!pl && pl.status === 'trial' && Date.parse(pl.at) + ((PLANS[pl.plan] && PLANS[pl.plan].trialDays) || 0) * DAY > Date.now())(hist.find((x) => x.kind === 'plan')) : rec.status === 'trialing',
      cancelAtEnd: !!rec.cancelAtEnd, method: demo ? await demoMethod(this.db, user.id) : null,
      teamUsed: 1 + (await membersOf(this.db, user.id)).length,
      buyer: rec.buyer || null, tax: stripeOn() ? await taxOn() : false, next: rec.next || null,
    };
    return { plan, usage: { ...usage(plan, codes), total: all.length, planPaused }, extraPrice: EXTRA_PRICE, plans: Object.values(PLANS).filter((p) => p.id !== 'free'), payments: stripeOn(), portal: stripeOn() && !!rec.customer, sub: publicSub(await subFor(this.db, user.id)), billing };
  }

  /** API-sleutels (Business). De sleutel zelf zie je één keer, daarna alleen het begin. */
  @Get('account/api-keys')
  async apiKeys(@Req() req: Request, @CurrentUser() user: User) {
    if ((req as any).member) throw fail(403, 'team');
    const plan = await planFor(this.db, user.id);
    return { allowed: plan.api, keys: (await listKeys(this.db, user.id)).map(publicKey), max: MAX_KEYS };
  }
  @Post('account/api-keys')
  @HttpCode(201)
  async apiKeyNew(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if ((req as any).member) throw fail(403, 'team');
    if (!(await planFor(this.db, user.id)).api) throw fail(403, 'plan_api');
    if (this.auth.limited('apikey-new:' + user.id, 20, 60)) throw fail(429, 'too_many');
    const r = await createKey(this.db, user.id, b.name);
    if (!r) throw fail(400, 'max_keys', { max: MAX_KEYS });
    await this.db.addActivity(user.id, 'api_key_created', this.auth.meta(req)).catch(() => {});
    return { key: r.key, record: publicKey(r.record) };
  }
  @Delete('account/api-keys/:id')
  @HttpCode(204)
  async apiKeyDel(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    if ((req as any).member) throw fail(403, 'team');
    if (!(await revokeKey(this.db, user.id, String(id)))) throw fail(404, 'not_found');
  }

  /** Facturen: met Stripe de echte facturen (link naar factuur en PDF), anders de demo-betalingen */
  @Get('account/invoices')
  async invoices(@CurrentUser() user: User) {
    if (stripeOn()) {
      const rec = await readRecord(this.db, user.id); if (!rec.customer) return { demo: false, items: [] };
      try {
        const r = await stripe('GET', 'invoices', { customer: rec.customer, limit: 24 });
        return { demo: false, items: (r.data || []).filter((i: any) => i.status !== 'draft').map((i: any) => ({
          id: i.id, number: i.number || i.id, at: new Date((i.created || 0) * 1000).toISOString(), amount: (i.status === 'paid' ? i.amount_paid : i.amount_due) / 100,
          status: i.status, desc: (i.lines && i.lines.data && i.lines.data[0] && i.lines.data[0].description) || null, url: i.hosted_invoice_url || null, pdf: i.invoice_pdf || null })) };
      } catch (e: any) { console.error('Stripe facturen ophalen mislukt:', e.message); throw fail(502, 'stripe'); }
    }
    return { demo: true, items: (await listPayments(this.db, user.id)).map((x) => ({ id: x.id, number: x.id, at: x.at, amount: x.amount, status: x.status, kind: x.kind, plan: x.plan, interval: x.interval, n: x.n || 0, method: x.method })) };
  }

  /** Akkoord met de voorwaarden (18+, Terms, Privacy). Wie via Google/Microsoft een account kreeg, of een account van het team,
   *  heeft nog niet akkoord gegeven: de app vraagt het dan één keer. Het team (beheer) hoeft niet. */
  /* Huisstijl-sjablonen (KB Q74): ontwerp (kleuren, logo, kader) bewaren en hergebruiken. Max. 10, één kan standaard zijn. */
  private async tpls(uid: string): Promise<any[]> { try { const l = JSON.parse((await this.db.getSetting('templates:' + uid)) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  private async saveTpls(uid: string, l: any[]) { await this.db.setSetting('templates:' + uid, l.length ? JSON.stringify(l) : null); return { templates: l }; }
  @Get('account/templates')
  async templates(@CurrentUser() user: User) { return { templates: await this.tpls(user.id) }; }
  @Post('account/templates')
  @HttpCode(201)
  async addTemplate(@CurrentUser() user: User, @Body() b: any = {}) {
    const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 40), design = b.design;
    if (!name) throw fail(400, 'name');
    if (!design || typeof design !== 'object' || Array.isArray(design)) throw fail(400, 'design');
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(design)) if (/^[A-Za-z0-9]{1,40}$/.test(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) clean[k] = v;
    delete clean.pageColor; delete clean.accentColor;
    if (JSON.stringify(clean).length > 600000) throw fail(413, 'too_big');        // logo is een plaatje: niet eindeloos groot
    const list = await this.tpls(user.id);
    if (list.length >= 10) throw fail(403, 'too_many');
    const tpl = { id: crypto.randomBytes(6).toString('hex'), name, design: clean, isDefault: !!b.isDefault, at: new Date().toISOString() };
    return this.saveTpls(user.id, (tpl.isDefault ? list.map((x) => ({ ...x, isDefault: false })) : list).concat([tpl]));
  }
  @Patch('account/templates/:id')
  async patchTemplate(@CurrentUser() user: User, @Param('id') id: string, @Body() b: any = {}) {
    const list = await this.tpls(user.id); if (!list.some((x) => x.id === id)) throw fail(404, 'Not found');
    return this.saveTpls(user.id, list.map((x) => {
      const y = { ...x };
      if (b.isDefault !== undefined) y.isDefault = x.id === id ? !!b.isDefault : (b.isDefault ? false : x.isDefault);
      if (x.id === id && typeof b.name === 'string' && b.name.trim()) y.name = b.name.replace(/\s+/g, ' ').trim().slice(0, 40);
      return y;
    }));
  }
  @Delete('account/templates/:id')
  async deleteTemplate(@CurrentUser() user: User, @Param('id') id: string) {
    const list = await this.tpls(user.id), rest = list.filter((x) => x.id !== id);
    if (rest.length === list.length) throw fail(404, 'Not found');
    return this.saveTpls(user.id, rest);
  }

  /* Voorkeuren van de app: startpagina na inloggen (Mijn account > Voorkeuren), sneltoetsen aan/uit (Instellingen) */
  @Get('account/prefs')
  async prefs(@CurrentUser() user: User) {
    let p: any = {}; try { p = JSON.parse((await this.db.getSetting('uprefs:' + user.id)) || '{}'); } catch (e) { p = {}; }
    // tour: korte rondleiding alleen voor nieuwe accounts (gemaakt vanaf TOUR_SINCE); bestaande klanten zien hem niet vanzelf
    return { start: START_PAGES.includes(p.start) ? p.start : 'home', tour: !!p.tour || String(user.createdAt || '') < TOUR_SINCE, keys: p.keys !== false };   // keys: sneltoetsen aan (standaard)
  }
  /* Tijdzone van het apparaat, voor accounts met tijdzone 'automatisch': start- en eindtijden van codes gelden dan in die tijd */
  @Put('account/device-tz')
  async deviceTz(@CurrentUser() user: User, @Body() b: any = {}) {
    const tz = String((b && b.tz) || '').slice(0, 64); try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { throw fail(400, 'timezone'); }
    if (!tz) throw fail(400, 'timezone');
    if ((await this.db.getSetting('devtz:' + user.id)) !== tz) await this.db.setSetting('devtz:' + user.id, tz);
    return { ok: true };
  }
  @Patch('account/prefs')
  async savePrefs(@CurrentUser() user: User, @Body() b: any = {}) {
    if (b.start !== undefined && !START_PAGES.includes(b.start)) throw fail(400, 'start');
    const cur = await this.prefs(user), out = { start: b.start !== undefined ? b.start : cur.start, tour: b.tour !== undefined ? !!b.tour : cur.tour, keys: b.keys !== undefined ? b.keys !== false : cur.keys };   // tour: korte rondleiding gezien/overgeslagen
    await this.db.setSetting('uprefs:' + user.id, out.start === 'home' && !out.tour && out.keys ? null : JSON.stringify(out));
    return out;
  }

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

  /** DEMO-afrekenen (standaard aan zolang Stripe er nog niet is; uit met DEMO_CHECKOUT=false). Er wordt niets afgeschreven.
   *  - Nieuwe klant (nog nooit betaald): pakket kiezen → 14 dagen gratis, daarna de eerste periode → de app in.
   *  - Bestaande klant: ander pakket of andere periode → gaat meteen in (nieuwe periode vanaf vandaag, geen proefperiode).
   *  Niet voor het team en niet voor teamleden (het abonnement is van de eigenaar). */
  @Post('account/checkout-demo')
  @HttpCode(200)
  async checkoutDemo(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (!demoCheckoutOn()) throw fail(403, 'off');
    const planId = String(b.plan || ''), interval = toInterval(b.period);
    if (!['standard', 'pro', 'business'].includes(planId)) throw fail(400, 'plan');
    if (this.auth.isAdmin(user) || (req as any).member) throw fail(403, 'team');
    const sub = await subFor(this.db, user.id), st = stateOf(sub), first = st === 'unpaid';
    if (!first && st === 'active' && (await planFor(this.db, user.id)).id === planId && (sub && sub.interval) === interval) throw fail(409, 'same');   // niets te wijzigen
    const trial = first ? (PLANS[planId].trialDays || 0) * DAY : 0;                 // proefperiode alleen de eerste keer
    await this.db.setSetting('plan:' + user.id, planId);
    await saveSub(this.db, user.id, renew({ ...(sub || emptySub(interval)), periodEnd: null, mustPay: false, graceUntil: null, deletedAt: null }, interval, Date.now() + trial));
    await fitToPlan(this.db, user.id, Array.isArray(b.keep) ? b.keep.map(String) : null);   // minder codes: de gekozen blijven aan, de rest gepauzeerd
    const P = PLANS[planId], cents = first ? Math.round(Number(interval === 'month' ? P.priceFirstMonth : interval === 'year' ? P.priceYear : P.priceQuarter) * 100) : amountFor(P, interval);   // acties alleen de eerste keer
    await setDemoMethod(this.db, user.id, b.method);
    await addPayment(this.db, user.id, { kind: 'plan', plan: planId, interval, amount: trial ? 0 : cents / 100, status: trial ? 'trial' : 'paid', method: await demoMethod(this.db, user.id) });
    await this.db.addActivity(user.id, first ? 'plan_chosen' : 'plan_changed', this.auth.meta(req));
    return { ok: true, sub: publicSub(await subFor(this.db, user.id)) };
  }

  /** DEMO: losse QR-code(s) erbij kopen (er wordt niets afgeschreven). Met Stripe: POST /api/billing/extra. */
  @Post('account/extra-demo')
  @HttpCode(200)
  async extraDemo(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (!demoCheckoutOn()) throw fail(403, 'off');
    if (this.auth.isAdmin(user) || (req as any).member) throw fail(403, 'team');
    const n = Math.min(10, Math.max(1, Math.floor(Number(b.n) || 1))), plan = await planFor(this.db, user.id);
    if (plan.codes == null || plan.id === 'free') throw fail(400, 'no_limit');                       // onbeperkt of testfase: niet nodig
    const now = Number(await this.db.getSetting('extra:' + user.id)) || 0;
    if (now + n > EXTRA_MAX) throw fail(400, 'too_many');
    await this.db.setSetting('extra:' + user.id, String(now + n));
    const iv = toInterval(((await subFor(this.db, user.id)) || emptySub()).interval);
    await addPayment(this.db, user.id, { kind: 'extra', plan: plan.id, interval: iv, n, amount: Math.round(EXTRA_PRICE[iv] * n * 100) / 100, status: 'paid', method: await demoMethod(this.db, user.id) });
    await fitToPlan(this.db, user.id);                                         // door het pakket gepauzeerde codes kunnen weer aan
    await this.db.addActivity(user.id, 'extra_bought', this.auth.meta(req));
    const p2 = await planFor(this.db, user.id);
    return { ok: true, extra: now + n, usage: usage(p2, await activeCount(this.db, user.id)) };
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
    if (await isBlocked(this.db, email)) throw fail(403, 'blocked');
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
    const rec = stripeOn() ? await readRecord(this.db, user.id) : {} as any;  // account weg: abonnement bij Stripe meteen stoppen (niet meer afschrijven)
    if (rec.subscription) await stripe('DELETE', 'subscriptions/' + rec.subscription).catch((e) => console.error('Stripe-abonnement stoppen mislukt:', e.message));
    await revokeAll(this.db, user.id);                                     // API-sleutels werken niet meer
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
    if (value.background && !this.auth.isAdmin(user)) {                       // achtergrond hoort bij het pakket (Pro: meer + foto's, Business: video's)
      const plan = await planFor(this.db, user.id), m = (user.media || []).find((x) => 'media:' + x.id === value.background);
      const what = value.background === 'optimasys' || value.background === 'none' || value.background === 'custom' ? null : m ? m.kind : 'extra';
      if (what && !bgAllowed(plan, what as any)) throw fail(403, 'plan_bg', { plan: plan.id });
    }
    const { hidden, ...rest } = value as any;
    if (hidden) await this.db.setSetting('bghide:' + user.id, hidden.length ? JSON.stringify(hidden) : null);
    // Verborgen of weggehaald terwijl hij aan stond: terug naar Optimasys
    if ((hidden && hidden.includes(rest.background || user.background)) || (rest.customBackground === null && (rest.background || user.background) === 'custom')) rest.background = 'optimasys';
    const u = await this.db.updateUser(user.id, rest);
    return { name: u.name, background: u.background, customBackground: u.customBackground, media: u.media || [], hiddenBackgrounds: await this.hiddenOf(user.id) };
  }
}

/** Factuurgegevens uit de app ook bij de klant in Stripe zetten (naam, adres, btw-nummer).
    Zelfde regels als bij betalen: een btw-nummer uit een ander EU-land gaat alleen naar Stripe als het geldig is in VIES
    (anders zou Stripe de btw verleggen zonder controle). */
async function syncBillingToStripe(db: any, user: User, b: any) {
  if (!stripeOn()) return;
  const rec = await readRecord(db, user.id); if (!rec.customer) return;
  const r = readBuyer({ type: b.type, country: b.country, postalCode: b.postalCode, companyName: b.companyName, vat: b.taxId, address: b.address, city: b.city });
  if (!r.buyer) {   // bv. bedrijf in de EU zonder btw-nummer: alleen naam/adres bijwerken, geen btw-nummer
    await stripe('POST', 'customers/' + rec.customer, { name: b.type === 'company' ? b.companyName : (b.firstName + ' ' + b.lastName).trim(), address: { line1: b.address, postal_code: b.postalCode, city: b.city, country: b.country } });
    return;
  }
  const vies = needsVies(r.buyer) ? await checkVies(r.buyer.vat) : undefined;
  if (vies && vies.state !== 'valid') r.buyer.vat = '';                        // niet (aantoonbaar) geldig: geen btw verleggen
  await applyBuyer(rec.customer, r.buyer, b.email || user.email, (b.firstName + ' ' + b.lastName).trim(), vies);
}
