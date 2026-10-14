/* =========================================================
   STATISTIEKEN  (/api/analytics, /api/analytics.csv) — alleen eigen codes
   Filters: from, to, codes, os, cc, city. Berekening gedeeld met de online demo (shared/analytics-core.js).
   ========================================================= */
import { Controller, Get, OnModuleInit, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { csv, loadGeo, overview } from './scan-stats';
import type { QrCode, User } from '../types';
import { planFor, statsFloor } from '../plans';

const nameOf = (q: QrCode) => q.name || q.content.title || q.content.name || q.content.pageName || q.content.restaurant || q.content.appName || q.content.company || q.content.ssid || q.content.url || q.typeId;

@Controller('api')
@UseGuards(LoggedIn)
export class AnalyticsController implements OnModuleInit {
  constructor(private readonly db: DatabaseService) {}
  onModuleInit() { loadGeo(); }                                    // land/stad-database op de achtergrond laden

  /** Abonnement met beperkte geschiedenis: 'from' nooit vroeger dan toegestaan */
  private async floor(user: User, query: Record<string, any>) {
    const f = statsFloor(await planFor(this.db, user.id));
    if (f && (!/^\d{4}-\d{2}-\d{2}$/.test(query.from || '') || query.from < f)) query.from = f;
    return f;
  }

  @Get('analytics')
  async overview(@CurrentUser() user: User, @Query() query: Record<string, any>) {
    const floor = await this.floor(user, query);
    return { ...overview(await this.db.listWithStats(user.id), query), statsFloor: floor };
  }

  @Get('analytics.csv')
  async csv(@CurrentUser() user: User, @Query() query: Record<string, any>, @Res({ passthrough: true }) res: Response) {
    await this.floor(user, query);
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="statistieken.csv"');
    return csv(await this.db.listWithStats(user.id), query, nameOf);
  }
}
