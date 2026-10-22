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

  /** Detailpagina: losse scans van één code (logboek) + plaatsen voor de kaart. Zelfde filters als de statistiek. */
  @Get('analytics/scans')
  async scans(@CurrentUser() user: User, @Query() query: Record<string, any>, @Res({ passthrough: true }) res: Response) {
    const code = await this.db.getOwnedQrCode(String(query.code || ''), user.id);
    if (!code) { res.status(404); return { error: 'QR code not found' }; }
    const floor = await this.floor(user, query), day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : '');
    const from = day(query.from) ? query.from + 'T00:00:00.000Z' : undefined;
    const to = day(query.to) ? new Date(Date.parse(query.to + 'T00:00:00Z') + 864e5).toISOString() : undefined;
    const list = (k: string) => String(query[k] || '').split(',').map((x) => x.trim()).filter(Boolean);
    const want = { os: list('os'), cc: list('cc'), city: list('city'), br: list('br'), dev: list('dev') };
    const ok = (r: any) => (!want.os.length || want.os.includes(r.os)) && (!want.cc.length || want.cc.includes(r.cc)) && (!want.city.length || want.city.includes(r.cc + '|' + r.city))
      && (!want.br.length || want.br.includes(r.br)) && (!want.dev.length || want.dev.includes(r.dev));
    const all = (await this.db.listScans(code.id, { from, to, limit: 5000 })).filter(ok);
    // Kaart: per plaats opgeteld (stad-niveau)
    const pts: Record<string, any> = {};
    for (const r of all) if (r.lat != null && r.lon != null) {
      const k = r.cc + '|' + r.city; const p = pts[k] || (pts[k] = { cc: r.cc, city: r.city, region: r.region, lat: r.lat, lon: r.lon, n: 0, u: 0 }); p.n++; if (r.uniq) p.u++;
    }
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500), before = String(query.before || '');
    const page = (before ? all.filter((r) => r.at < before) : all).slice(0, limit);
    return { scans: page, more: (before ? all.filter((r) => r.at < before) : all).length > limit, total: all.length, points: Object.values(pts).sort((a: any, b: any) => b.n - a.n), statsFloor: floor };
  }

  @Get('analytics.csv')
  async csv(@CurrentUser() user: User, @Query() query: Record<string, any>, @Res({ passthrough: true }) res: Response) {
    await this.floor(user, query);
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="statistieken.csv"');
    return csv(await this.db.listWithStats(user.id), query, nameOf);
  }
}
