/* Eigen domein voor korte links (Business). Zie server/src/domains.ts */
import { Body, Controller, Delete, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { fail } from '../common/http';
import { planFor } from '../plans';
import type { User } from '../types';
import { addDomain, checkDomain, domainsOn, isCustomHost, normHost, recOf, removeDomain, target, loadDomains } from '../domains';

@Controller('api')
export class DomainsController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  /** Voor Caddy (certificaat "on demand"): mag er voor dit domein een certificaat komen? */
  @Get('domains/ask')
  async ask(@Query('domain') d: string, @Res() res: Response) { await loadDomains(this.db); return res.status(isCustomHost(String(d || '')) ? 200 : 404).end(); }

  private async gate(req: Request, user: User) {
    if (!domainsOn()) throw fail(404, 'off');
    if ((req as any).member) throw fail(403, 'team');
    const plan = await planFor(this.db, user.id); if (!plan.api) throw fail(403, 'plan_domain', { plan: plan.id });
  }

  @Get('account/domain')
  @UseGuards(LoggedIn)
  async get(@Req() req: Request, @CurrentUser() user: User) {
    if (!domainsOn()) return { available: false };
    await loadDomains(this.db);
    const plan = await planFor(this.db, user.id), r = recOf(user.id);
    return { available: true, allowed: !!plan.api && !(req as any).member, target: target(), host: r ? r[0] : null, state: r ? r[1].state : null, error: r ? r[1].error || null : null };
  }

  @Post('account/domain')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async add(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    await this.gate(req, user);
    if (this.auth.limited('domain:' + user.id, 10, 60)) throw fail(429, 'too_many');
    const host = normHost(b.host); if (!host) throw fail(400, 'host');
    const r: any = await addDomain(this.db, user.id, host);
    if (r.error === 'taken') throw fail(409, 'taken');
    if (r.error) throw fail(502, 'cloudflare');
    return { ...(await checkDomain(this.db, user.id)), target: target() };
  }

  @Post('account/domain/check')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async check(@Req() req: Request, @CurrentUser() user: User) {
    await this.gate(req, user);
    if (this.auth.limited('domaincheck:' + user.id, 30, 60)) throw fail(429, 'too_many');
    const r = await checkDomain(this.db, user.id); if (!r) throw fail(404, 'none');
    return r;
  }

  @Delete('account/domain')
  @UseGuards(LoggedIn)
  async remove(@Req() req: Request, @CurrentUser() user: User) {
    await this.gate(req, user);
    await removeDomain(this.db, user.id);
    return { ok: true };
  }
}
