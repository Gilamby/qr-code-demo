/* =========================================================
   TEAM (/api/team) — alleen bij Business. Regels: zie server/src/team.ts
   ========================================================= */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService, INVITE_HOURS, INVITED } from '../database/database.service';
import { AuthService } from './auth.service';
import { CurrentUser, LoggedIn } from './auth.guard';
import { MailerService } from './mailer.service';
import { EMAIL } from '../qr-codes/validation';
import { baseUrl } from '../config/env';
import { fail } from '../common/http';
import type { User } from '../types';
import { planFor } from '../plans';
import { ROLES, Role, Member, memberOf, membersOf, saveMembers, setMembership, teamLog } from '../team';
import { isDisposable } from './email-rules';

@Controller('api/team')
@UseGuards(LoggedIn)
export class TeamController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly mailer: MailerService) {}

  /** Mag dit account een team hebben? Alleen bij een abonnement voor meer gebruikers (Pro: 3, Business: onbeperkt), nooit een teamlid zelf of het Optimasys-team */
  private async seats(user: User) { return (await planFor(this.db, user.id)).users; }
  private async canTeam(user: User) { const n = await this.seats(user); return !this.auth.isAdmin(user) && !(await memberOf(this.db, user.id)) && (n == null || n > 1); }
  private async owner(user: User) { if (!(await this.canTeam(user))) throw fail(403, 'not_business'); }

  /** Eigenaar: leden en of een team kan. Lid: van wiens team en met welke rol. */
  @Get()
  async get(@CurrentUser() user: User) {
    const m = await memberOf(this.db, user.id);
    if (m) { const o = await this.db.getUser(m.ownerId); return { member: { role: m.role, ownerName: (o && (o.name || o.email)) || '', ownerEmail: o ? o.email : '' } }; }
    const members = await membersOf(this.db, user.id);
    const out = await Promise.all(members.map(async (x) => ({ ...x, active: await this.db.isVerified(x.userId) })));
    return { canTeam: await this.canTeam(user), seats: await this.seats(user), members: out };
  }

  /** Wie deed wat (eigenaar en leden van hetzelfde team) */
  @Get('log')
  async log(@CurrentUser() user: User) {
    const m = await memberOf(this.db, user.id), ownerId = m ? m.ownerId : user.id;
    return { log: (await teamLog(this.db, ownerId)).slice(0, 100) };
  }

  /** Collega uitnodigen: { email, name, role } */
  @Post()
  @HttpCode(201)
  async add(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    await this.owner(user);
    const email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80), role = (ROLES.includes(b.role) ? b.role : 'editor') as Role;
    if (!EMAIL.test(email) || email.length > 254) throw fail(400, 'email');
    if (isDisposable(email)) throw fail(400, 'email_disposable');
    if (await this.db.userByEmail(email)) throw fail(409, 'exists');           // heeft al een eigen account: niet samenvoegen
    const seats = await this.seats(user);
    if (seats != null && (await membersOf(this.db, user.id)).length + 1 >= seats) throw fail(403, 'seats');   // abonnement vol (eigenaar telt mee)
    if (this.auth.limited('team:' + user.id, 30, 60)) throw fail(429, 'too_many');
    const nu = await this.db.createUser({ email, name, passwordHash: INVITED });
    await setMembership(this.db, nu.id, { ownerId: user.id, role });
    const members = await membersOf(this.db, user.id);
    members.push({ userId: nu.id, email, name, role, invitedAt: new Date().toISOString() });
    await saveMembers(this.db, user.id, members);
    return { ok: true, ...(await this.invite(req, user, nu.id, email, String(b.lang || 'en'))) };
  }

  /** Rol wijzigen: { role } */
  @Patch(':id')
  async role(@CurrentUser() user: User, @Param('id') id: string, @Body() b: any = {}) {
    await this.owner(user);
    if (!ROLES.includes(b.role)) throw fail(400, 'role');
    const members = await membersOf(this.db, user.id), x = members.find((m) => m.userId === id); if (!x) throw fail(404, 'Not found');
    x.role = b.role; await saveMembers(this.db, user.id, members); await setMembership(this.db, id, { ownerId: user.id, role: b.role });
    return { ok: true };
  }

  /** Uitnodiging opnieuw sturen */
  @Post(':id/invite')
  @HttpCode(200)
  async reinvite(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string, @Body() b: any = {}) {
    await this.owner(user);
    const x = (await membersOf(this.db, user.id)).find((m) => m.userId === id); if (!x) throw fail(404, 'Not found');
    if (await this.db.isVerified(id)) throw fail(409, 'active');
    return { ok: true, ...(await this.invite(req, user, id, x.email, String(b.lang || 'en'))) };
  }

  /** Lid verwijderen: zijn login verdwijnt, de codes blijven van het team */
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.owner(user);
    const members = await membersOf(this.db, user.id); if (!members.some((m) => m.userId === id)) throw fail(404, 'Not found');
    await removeMember(this.db, user.id, id);
  }

  private async invite(req: Request, owner: User, userId: string, email: string, lang: string) {
    const link = baseUrl(req) + '/?invite=' + encodeURIComponent(await this.db.createReset(userId, INVITE_HOURS));
    await this.mailer.sendTeamInvite(email, link, lang, owner.name || owner.email).catch((e) => console.error('Teamuitnodiging versturen mislukt:', e.message));
    return this.mailer.configured ? {} : { link };
  }
}

/** Lid uit het team halen en zijn login verwijderen */
export async function removeMember(db: DatabaseService, ownerId: string, userId: string) {
  await saveMembers(db, ownerId, (await membersOf(db, ownerId)).filter((m) => m.userId !== userId));
  await setMembership(db, userId, null);
  await db.deleteUser(userId);
}
/** Account verwijderd: eigenaar → alle leden weg; lid → uit het team van de eigenaar */
export async function cleanupTeam(db: DatabaseService, userId: string) {
  for (const m of await membersOf(db, userId)) await removeMember(db, userId, m.userId).catch(() => {});
  await saveMembers(db, userId, []);
  const mem = await memberOf(db, userId);
  if (mem) { await saveMembers(db, mem.ownerId, (await membersOf(db, mem.ownerId)).filter((m) => m.userId !== userId)); await setMembership(db, userId, null); }
}
