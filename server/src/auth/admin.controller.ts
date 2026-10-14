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

@Injectable()
export class TeamOnly implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  canActivate(ctx: ExecutionContext) {
    if (!this.auth.isAdmin(ctx.switchToHttp().getRequest<Request>().user)) throw fail(403, 'team_only');
    return true;
  }
}

@Controller('api/admin/customers')
@UseGuards(LoggedIn, TeamOnly)
export class AdminController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly mailer: MailerService) {}

  @Get()
  async list() {
    return (await this.db.listCustomers()).map((c) => this.withRole(c));
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
    if (b.disabled !== undefined) {
      if (typeof b.disabled !== 'boolean') throw fail(400, 'disabled: true or false');
      if (this.auth.isAdmin(u) && !this.auth.isSuper(me)) throw fail(403, 'super_only');
      patch.disabledAt = b.disabled ? (u.disabledAt || new Date().toISOString()) : null;
    }
    if (!Object.keys(patch).length) throw fail(400, 'nothing to change');
    await this.db.updateUser(id, patch);
    if (patch.disabledAt) await this.db.deleteSessionsOf(id);                    // meteen uitgelogd
    if (patch.role !== undefined) await this.log(me, 'user_role', id, u.email + ' → ' + (patch.role || 'user'));
    if (patch.disabledAt !== undefined) await this.log(me, patch.disabledAt ? 'user_disable' : 'user_enable', id, u.email);
    return this.withRole((await this.db.listCustomers()).find((c) => c.id === id));
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
