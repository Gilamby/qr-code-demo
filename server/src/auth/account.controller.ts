/* =========================================================
   MIJN ACCOUNT  (/api/account, /api/me)
   Naam, wachtwoord, overzicht, uitloggen op andere apparaten, achtergrond,
   en de AVG-rechten: al je gegevens downloaden en je account verwijderen.
   ========================================================= */
import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';
import { CurrentUser, LoggedIn } from './auth.guard';
import { validateMe } from '../qr-codes/validation';
import { fail } from '../common/http';
import type { User } from '../types';

@Controller('api')
@UseGuards(LoggedIn)
export class AccountController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  @Patch('account')
  async rename(@CurrentUser() user: User, @Body() b: any = {}) {
    if (typeof b.name !== 'string') throw fail(400, 'name');
    return this.auth.me(await this.db.updateUser(user.id, { name: b.name.trim().slice(0, 80) }));
  }

  @Post('account/password')
  @HttpCode(200)
  async password(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (this.auth.limited('pw:' + user.id, 10, 15)) throw fail(429, 'too_many');
    if (!(await this.auth.checkPassword(b.current || '', await this.db.passwordHashOf(user.id)))) throw fail(403, 'wrong');   // 403: wel ingelogd, verkeerd wachtwoord
    const pp = this.auth.passwordProblem(b.password); if (pp) throw fail(400, 'password_' + pp);
    await this.db.updateUser(user.id, { passwordHash: await this.auth.hashPassword(b.password) });
    await this.db.deleteSessionsOf(user.id, req.sid);                  // andere apparaten uitloggen
    return { ok: true };
  }

  /** Overzicht: aantal codes, scans, ingelogde apparaten */
  @Get('account/summary')
  async summary(@CurrentUser() user: User) {
    return { createdAt: user.createdAt, ...(await this.db.summary(user.id)) };
  }

  /** Uitloggen op alle andere apparaten (deze blijft ingelogd) */
  @Post('account/logout-others')
  @HttpCode(200)
  async logoutOthers(@Req() req: Request, @CurrentUser() user: User) {
    await this.db.deleteSessionsOf(user.id, req.sid);
    return { ok: true };
  }

  /** AVG: al je gegevens downloaden */
  @Get('account/export')
  async export(@CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
    const codes = (await this.db.listWithStats(user.id)).map((q) => {
      const c = { ...q.content }; Object.keys(c).forEach((k) => { if (/password/i.test(k) && q.typeId !== 'wifi') delete c[k]; });
      return { ...q, content: c, userId: undefined };
    });
    res.set('Content-Disposition', 'attachment; filename="optimasys-mijn-gegevens.json"');
    return { exportedAt: new Date().toISOString(), account: this.auth.me(user), qrCodes: codes };
  }

  /** AVG: account en alles verwijderen (met wachtwoord) */
  @Delete('account')
  @HttpCode(204)
  async remove(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser() user: User, @Body() b: any = {}) {
    if (!(await this.auth.checkPassword(b.password || '', await this.db.passwordHashOf(user.id)))) throw fail(403, 'wrong');
    await this.db.deleteUser(user.id);
    this.auth.clearSession(req, res);
  }

  /* Instellingen van de gebruiker (achtergrond) */
  @Get('me')
  settings(@CurrentUser() user: User) {
    return { name: user.name, background: user.background, customBackground: user.customBackground };
  }

  @Patch('me')
  async updateSettings(@CurrentUser() user: User, @Body() b: any = {}) {
    const { errors, value } = validateMe(b || {});
    if (errors.length) throw fail(400, 'Invalid profile update', { details: errors });
    const u = await this.db.updateUser(user.id, value);
    return { name: u.name, background: u.background, customBackground: u.customBackground };
  }
}
