/* =========================================================
   KLANTEN (alleen voor het team)  /api/admin/customers
   Optimasys verkoopt licenties: klanten maken niet zelf een account aan.
   Het team voegt een klant toe (naam + e-mail); de klant krijgt een mail "kies je wachtwoord"
   (7 dagen geldig) en is daarna meteen ingelogd. Zonder mailserver krijgt het team de link terug om te kopiëren.
   Team = SUPPORT_EMAIL en ADMIN_EMAILS (zie auth.service.ts).
   ========================================================= */
import { Body, CanActivate, Controller, Delete, ExecutionContext, Get, HttpCode, Injectable, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService, INVITE_HOURS, INVITED } from '../database/database.service';
import { AuthService } from './auth.service';
import { CurrentUser, LoggedIn } from './auth.guard';
import { MailerService } from './mailer.service';
import { EMAIL } from '../qr-codes/validation';
import { baseUrl } from '../config/env';
import { fail } from '../common/http';
import type { User } from '../types';
import { PLAN_IDS, planFor } from '../plans';
import { subFor, saveSub, renew, emptySub, publicSub, toInterval } from '../subscription';

@Injectable()
export class TeamOnly implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  canActivate(ctx: ExecutionContext) {
    if (!this.auth.isAdmin(ctx.switchToHttp().getRequest<Request>().user)) throw fail(403, 'team_only');
    return true;
  }
}

/** Reden van uitzetten (settings 'disabled:<id>') */
function reasonOf(v: string | null | undefined) { try { const o = v ? JSON.parse(v) : null; return o && o.reason ? String(o.reason) : null; } catch (e) { return null; } }

@Controller('api/admin/customers')
@UseGuards(LoggedIn, TeamOnly)
export class AdminController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly mailer: MailerService) {}

  @Get()
  async list() {
    const all = await this.db.listCustomers();
    const plans = await Promise.all(all.map((c) => planFor(this.db, c.id)));
    const why = await Promise.all(all.map((c) => (c.disabledAt ? this.db.getSetting('disabled:' + c.id).catch(() => null) : null)));
    const subs = await Promise.all(all.map((c) => subFor(this.db, c.id)));
    return all.map((c, i) => ({ ...this.withRole(c), plan: plans[i].id, disabledReason: reasonOf(why[i]), sub: publicSub(subs[i]) }));
  }

  /** Betaalperiode (tot Stripe dit automatisch doet): { action: 'paid', interval } = een maand/jaar erbij,
      { action: 'set', periodEnd: 'YYYY-MM-DD' | null, interval } = einddatum zelf zetten (null = geen betaalperiode, testfase). */
  @Post(':id/subscription')
  @HttpCode(200)
  async subscription(@CurrentUser() me: User, @Param('id') id: string, @Body() b: any = {}) {
    const u = await this.db.getUser(id); if (!u) throw fail(404, 'Not found');
    if (this.auth.isAdmin(u)) throw fail(403, 'team');
    const interval = toInterval(b.interval);
    let s = (await subFor(this.db, id)) || emptySub(interval);
    if (b.action === 'paid') s = renew(s, interval);
    else if (b.action === 'set') {
      if (b.periodEnd === null || b.periodEnd === '') s = { ...s, interval, periodEnd: null, graceUntil: null, notified: [], deletedAt: null };
      else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.periodEnd)) || isNaN(Date.parse(b.periodEnd + 'T23:59:59Z'))) throw fail(400, 'periodEnd: YYYY-MM-DD');
        const end = new Date(b.periodEnd + 'T23:59:59Z').toISOString();
        s = { ...s, interval, periodEnd: end, ...(Date.parse(end) > Date.now() ? { graceUntil: null, notified: [], deletedAt: null } : {}) };
      }
    } else throw fail(400, 'action: paid or set');
    await saveSub(this.db, id, s);
    await this.log(me, 'user_sub', id, u.email + ': ' + (b.action === 'paid' ? 'betaald (' + interval + ')' : 'einde ' + (s.periodEnd ? s.periodEnd.slice(0, 10) : '—')) );
    return publicSub(s);
  }

  /** Klant toevoegen en uitnodigen */
  @Post()
  @HttpCode(201)
  async add(@Req() req: Request, @CurrentUser() me: User, @Body() b: any = {}) {
    const email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const errors = [!name && 'name', (!EMAIL.test(email) || email.length > 254) && 'email'].filter(Boolean);
    if (errors.length) throw fail(400, 'Invalid customer', { details: errors });
    if (await this.db.userByEmail(email)) throw fail(409, 'exists');
    const user = await this.db.createUser({ email, name, passwordHash: INVITED });
    const link = await this.invite(req, user.id, email, String(b.lang || 'en'));
    await this.log(me, 'user_invite', user.id, email);
    return { customer: this.withRole((await this.db.listCustomers()).find((c) => c.id === user.id)), ...link };
  }

  /** Uitnodiging opnieuw sturen (nieuwe link; de oude werkt dan niet meer) */
  @Post(':id/invite')
  @HttpCode(200)
  async reinvite(@Req() req: Request, @CurrentUser() me: User, @Param('id') id: string, @Body() b: any = {}) {
    const u = await this.db.getUser(id); if (!u) throw fail(404, 'Not found');
    if (await this.db.isVerified(id)) throw fail(409, 'active');
    await this.log(me, 'user_reinvite', id, u.email);
    return { ok: true, ...(await this.invite(req, id, u.email, String(b.lang || 'en'))) };
  }

  /** Rol en status: { role: 'admin' | 'user' } (alleen de super-admin) en/of { disabled: true | false }.
      Niet jezelf, nooit de super-admin; admins uitzetten mag alleen de super-admin. Uitzetten = meteen overal uitgelogd. */
  @Patch(':id')
  async update(@CurrentUser() me: User, @Param('id') id: string, @Body() b: any = {}) {
    const u = await this.db.getUser(id); if (!u) throw fail(404, 'Not found');
    if (u.id === me.id) throw fail(403, 'self');
    if (this.auth.isSuper(u)) throw fail(403, 'super');
    const patch: { role?: string | null; disabledAt?: string | null } = {};
    if (b.role !== undefined) {
      if (!this.auth.isSuper(me)) throw fail(403, 'super_only');
      if (b.role !== 'admin' && b.role !== 'user') throw fail(400, 'role: admin or user');
      patch.role = b.role === 'admin' ? 'admin' : null;
    }
    let why = '';
    if (b.disabled !== undefined) {
      if (typeof b.disabled !== 'boolean') throw fail(400, 'disabled: true or false');
      why = String(b.reason || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (this.auth.isAdmin(u) && !this.auth.isSuper(me)) throw fail(403, 'super_only');
      patch.disabledAt = b.disabled ? (u.disabledAt || new Date().toISOString()) : null;
    }
    if (b.plan !== undefined) {
      if (!PLAN_IDS.includes(b.plan)) throw fail(400, 'plan: ' + PLAN_IDS.join(', '));
      const was = (await planFor(this.db, id)).id;
      await this.db.setSetting('plan:' + id, b.plan === 'free' ? null : b.plan);
      if (was !== b.plan) await this.log(me, 'user_plan', id, u.email + ': ' + was + ' → ' + b.plan);
      if (!Object.keys(patch).length) return { ...this.withRole((await this.db.listCustomers()).find((c) => c.id === id)), plan: b.plan };
    }
    if (!Object.keys(patch).length) throw fail(400, 'nothing to change');
    await this.db.updateUser(id, patch);
    if (patch.disabledAt) await this.db.deleteSessionsOf(id);                    // meteen uitgelogd
    if (patch.disabledAt !== undefined) await this.db.setSetting('disabled:' + id, patch.disabledAt && why ? JSON.stringify({ reason: why, by: me.name || me.email, at: new Date().toISOString() }) : null);
    if (patch.role !== undefined) await this.log(me, 'user_role', id, u.email + ' → ' + (patch.role || 'user'));
    if (patch.disabledAt !== undefined) await this.log(me, patch.disabledAt ? 'user_disable' : 'user_enable', id, u.email + (patch.disabledAt && why ? ' · ' + why : ''));
    return { ...this.withRole((await this.db.listCustomers()).find((c) => c.id === id)), plan: (await planFor(this.db, id)).id, disabledReason: patch.disabledAt ? why || null : null };
  }

  /** Klant verwijderen (met alle codes, statistieken en bestanden). Niet jezelf, niet de super-admin;
      een admin alleen door de super-admin (en niet als hij in ADMIN_EMAILS staat). */
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() me: User, @Param('id') id: string) {
    const u = await this.db.getUser(id); if (!u) throw fail(404, 'Not found');
    if (u.id === me.id || this.auth.isSuper(u)) throw fail(403, 'team_member');
    if (this.auth.isAdmin(u) && (!this.auth.isSuper(me) || this.auth.isAdmin({ email: u.email }))) throw fail(403, 'team_member');
    await this.db.deleteUser(id);
    await this.log(me, 'user_delete', id, u.email);
  }

  /** Beheerlog (wie deed wat met welk account); nooit wachtwoorden of links */
  private async log(me: User, action: string, ownerId: string, detail: string) {
    await this.db.addAdminLog({ adminId: me.id, adminName: me.name || me.email, action, codeId: null, ownerId, detail }).catch(() => {});
  }

  /** Rol voor het scherm: super (vast team-account), admin, of klant. fixed = admin via ADMIN_EMAILS (niet te wijzigen in de app) */
  private withRole(c: any) {
    if (!c) return c;
    const sup = this.auth.isSuper(c), envAdmin = this.auth.isAdmin({ email: c.email });
    return { ...c, team: this.auth.isAdmin(c), level: sup ? 'super' : this.auth.isAdmin(c) ? 'admin' : 'user', fixed: sup || envAdmin };
  }

  private async invite(req: Request, userId: string, email: string, lang: string) {
    const link = baseUrl(req) + '/?invite=' + encodeURIComponent(await this.db.createReset(userId, INVITE_HOURS));
    await this.mailer.sendInvite(email, link, lang).catch((e) => console.error('Uitnodiging versturen mislukt:', e.message));
    return this.mailer.configured ? {} : { link };              // geen mailserver: het team kopieert de link zelf
  }
}
