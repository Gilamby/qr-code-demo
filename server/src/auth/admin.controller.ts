/* =========================================================
   KLANTEN (alleen voor het team)  /api/admin/customers
   Optimasys verkoopt licenties: klanten maken niet zelf een account aan.
   Het team voegt een klant toe (naam + e-mail); de klant krijgt een mail "kies je wachtwoord"
   (7 dagen geldig) en is daarna meteen ingelogd. Zonder mailserver krijgt het team de link terug om te kopiëren.
   Team = SUPPORT_EMAIL en ADMIN_EMAILS (zie auth.service.ts).
   ========================================================= */
import { Body, CanActivate, Controller, Delete, ExecutionContext, Get, HttpCode, Injectable, Param, Post, Req, UseGuards } from '@nestjs/common';
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
    return (await this.db.listCustomers()).map((c) => ({ ...c, team: this.auth.isAdmin(c) }));
  }

  /** Klant toevoegen en uitnodigen */
  @Post()
  @HttpCode(201)
  async add(@Req() req: Request, @Body() b: any = {}) {
    const email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const errors = [!name && 'name', (!EMAIL.test(email) || email.length > 254) && 'email'].filter(Boolean);
    if (errors.length) throw fail(400, 'Invalid customer', { details: errors });
    if (await this.db.userByEmail(email)) throw fail(409, 'exists');
    const user = await this.db.createUser({ email, name, passwordHash: INVITED });
    const link = await this.invite(req, user.id, email, String(b.lang || 'en'));
    return { customer: (await this.db.listCustomers()).find((c) => c.id === user.id), ...link };
  }

  /** Uitnodiging opnieuw sturen (nieuwe link; de oude werkt dan niet meer) */
  @Post(':id/invite')
  @HttpCode(200)
  async reinvite(@Req() req: Request, @Param('id') id: string, @Body() b: any = {}) {
    const u = await this.db.getUser(id); if (!u) throw fail(404, 'Not found');
    if (await this.db.isVerified(id)) throw fail(409, 'active');
    return { ok: true, ...(await this.invite(req, id, u.email, String(b.lang || 'en'))) };
  }

  /** Klant verwijderen (met alle codes, statistieken en bestanden). Niet jezelf en geen team-leden. */
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() me: User, @Param('id') id: string) {
    const u = await this.db.getUser(id); if (!u) throw fail(404, 'Not found');
    if (u.id === me.id || this.auth.isAdmin(u)) throw fail(403, 'team_member');
    await this.db.deleteUser(id);
  }

  private async invite(req: Request, userId: string, email: string, lang: string) {
    const link = baseUrl(req) + '/?invite=' + encodeURIComponent(await this.db.createReset(userId, INVITE_HOURS));
    await this.mailer.sendInvite(email, link, lang).catch((e) => console.error('Uitnodiging versturen mislukt:', e.message));
    return this.mailer.configured ? {} : { link };              // geen mailserver: het team kopieert de link zelf
  }
}
