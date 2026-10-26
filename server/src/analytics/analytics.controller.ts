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
    return { ...overview(await this.db.listWithStats(user.id, statsDays(query)), query), statsFloor: floor };
  }

  /** Detailpagina: losse scans van één code (logboek) + plaatsen voor de kaart. Zelfde filters als de statistiek. */
  @Get('analytics/scans')
  async scans(@CurrentUser() user: User, @Query() query: Record<string, any>, @Res({ passthrough: true }) res: Response) {
    const code = await this.db.getOwnedQrCode(String(query.code || ''), user.id);
    if (!code) { res.status(404); return { error: 'QR code not found' }; }
    const floor = await this.floor(user, query), day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : '');
    const from = day(query.from) ? query.from + 'T00:00:00.000Z' : undefined;
    const to = day(query.to) ? new Date(Date.parse(query.to + 'T00:00:00Z') + 864e5).toISOString() : undefined;
    const list = (k: string) => String(query[k] || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 200);
    const q = { from, to, os: list('os'), cc: list('cc'), city: list('city'), br: list('br'), dev: list('dev') };
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500), before = String(query.before || '') || undefined;
    // Telling en kaart in de database zelf (ook snel bij miljoenen scans); de pagina met regels apart
    const [sum, rows] = await Promise.all([this.db.scanSummary(code.id, q), this.db.listScans(code.id, { ...q, before, limit: limit + 1 })]);
    return { scans: rows.slice(0, limit), more: rows.length > limit, total: sum.total, points: sum.places, statsFloor: floor };
  }

  @Get('analytics.csv')
  async csv(@CurrentUser() user: User, @Query() query: Record<string, any>, @Res({ passthrough: true }) res: Response) {
    await this.floor(user, query);
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="statistieken.csv"');
    return csv(await this.db.listWithStats(user.id, statsDays(query)), query, nameOf);
  }
}

/** Alleen de dagen die het overzicht nodig heeft: de gekozen periode en de even lange periode ervoor (voor de vergelijking) */
export function statsDays(query: Record<string, any>) {
  const D = /^\d{4}-\d{2}-\d{2}$/; let from = D.test(query.from || '') ? String(query.from) : '', to = D.test(query.to || '') ? String(query.to) : '';
  if (!from) return undefined;                                         // "alles": geen grens
  if (!to) to = new Date().toISOString().slice(0, 10); if (from > to) [from, to] = [to, from];
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  return { from: new Date(Date.parse(from + 'T00:00:00Z') - span * 864e5).toISOString().slice(0, 10), to };
}
