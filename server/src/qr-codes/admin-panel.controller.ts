/* =========================================================
   BEHEER (alleen voor het team: SUPPORT_EMAIL, ADMIN_EMAILS en wie de super-admin admin heeft gemaakt)
   GET    /api/admin/overview        tellers, scans per dag (30 dagen), types, top-codes, nieuwste accounts
   GET    /api/admin/codes           alle QR-codes van iedereen: zoeken, type, status, eigenaar, pagina's
   PATCH  /api/admin/codes/:id       pauzeren / weer aanzetten
   DELETE /api/admin/codes/:id       verwijderen (met statistieken en bestanden)
   Klanten zelf (toevoegen, uitnodigen, rol, uitzetten): auth/admin.controller.ts
   ========================================================= */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { LoggedIn } from '../auth/auth.guard';
import { TeamOnly } from '../auth/admin.controller';
import { AuthService } from '../auth/auth.service';
import { QrCodesService } from './qr-codes.service';
import { QR_TYPES } from './validation';
import { fail } from '../common/http';
import type { QrCode } from '../types';

const PAGE = 24;
const STATIC = ['contact', 'wifi'];                   // inhoud zit in de code zelf: geen link, geen scans
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Grote afbeeldingen (data-URL's) en wifi-wachtwoorden gaan niet mee naar het overzicht */
function slim(content: Record<string, any>, contentType: string) {
  const c: Record<string, any> = {};
  for (const [k, v] of Object.entries(content || {})) {
    if (typeof v === 'string' && v.length > 1000 && /^data:|"d":"data:/.test(v)) continue;
    c[k] = v;
  }
  if (contentType === 'wifi') delete c.password;
  return c;
}
/** Waar zoeken we in? Naam, id, type, link en korte teksten uit de inhoud */
function haystack(q: QrCode, owner: { name: string; email: string } | undefined) {
  const c = q.content || {}, parts = [q.id, q.name, q.typeId, owner && owner.name, owner && owner.email];
  for (const v of Object.values(c)) if (typeof v === 'string' && v.length < 300 && !/^[[{]/.test(v)) parts.push(v);
  return parts.filter(Boolean).join(' ').toLowerCase();
}

@Controller('api/admin')
@UseGuards(LoggedIn, TeamOnly)
export class AdminPanelController {
  constructor(private readonly db: DatabaseService, private readonly codes: QrCodesService, private readonly auth: AuthService) {}

  @Get('overview')
  async overview(@Req() req: Request) {
    const [users, all] = await Promise.all([this.db.listCustomers(), this.db.allQrCodes()]);
    const since = day(new Date(Date.now() - 29 * 864e5)), prev = day(new Date(Date.now() - 59 * 864e5));
    const perDay = await this.db.scansPerDay(prev);
    // 30 dagen, ook dagen zonder scans (0), plus de 30 dagen daarvoor om te vergelijken
    const byDay: Record<string, { scans: number; uniq: number }> = {};
    perDay.forEach((d) => { byDay[d.day] = d; });
    const days: { day: string; scans: number; uniq: number }[] = [];
    for (let i = 29; i >= 0; i--) { const d = day(new Date(Date.now() - i * 864e5)); days.push({ day: d, scans: (byDay[d] || { scans: 0 }).scans, uniq: (byDay[d] || { uniq: 0 }).uniq }); }
    const sum = (from: string, to?: string) => perDay.filter((d) => d.day >= from && (!to || d.day < to)).reduce((n, d) => n + d.scans, 0);
    const byType: Record<string, number> = {};
    all.forEach((q) => { byType[q.typeId] = (byType[q.typeId] || 0) + 1; });
    const owners: Record<string, { name: string; email: string }> = {};
    users.forEach((u) => { owners[u.id] = { name: u.name, email: u.email }; });
    const newSince = (list: { createdAt: string }[], from: string) => list.filter((x) => x.createdAt.slice(0, 10) >= from).length;
    return {
      totals: {
        users: users.length,
        active: users.filter((u) => u.active && !u.disabledAt).length,
        invited: users.filter((u) => !u.active).length,
        disabled: users.filter((u) => u.disabledAt).length,
        admins: users.filter((u) => this.auth.isAdmin(u)).length,
        codes: all.length,
        paused: all.filter((q) => q.paused).length,
        scans: all.reduce((n, q) => n + (q.scans || 0), 0),
        scans30: sum(since), scansPrev30: sum(prev, since),
        newUsers30: newSince(users, since), newCodes30: newSince(all, since),
      },
      days,
      types: Object.entries(byType).map(([typeId, n]) => ({ typeId, n })).sort((a, b) => b.n - a.n),
      top: all.filter((q) => q.scans > 0).sort((a, b) => b.scans - a.scans).slice(0, 5)
        .map((q) => ({ ...this.row(req, q), owner: owners[q.userId] || null })),
      recentUsers: users.slice(0, 5),
    };
  }

  @Get('codes')
  async list(@Req() req: Request, @Query() qs: Record<string, string>) {
    const [users, all] = await Promise.all([this.db.listCustomers(), this.db.allQrCodes()]);
    const owners: Record<string, { id: string; name: string; email: string }> = {};
    users.forEach((u) => { owners[u.id] = { id: u.id, name: u.name, email: u.email }; });
    const q = String(qs.q || '').trim().toLowerCase(), type = String(qs.type || ''), status = String(qs.status || ''), user = String(qs.user || '');
    const sort = ['new', 'old', 'scans', 'recent'].includes(qs.sort) ? qs.sort : 'new';
    let rows = all.filter((c) => (!type || c.typeId === type) && (!user || c.userId === user)
      && (!status || (status === 'paused' ? c.paused : status === 'active' ? !c.paused : true))
      && (!q || haystack(c, owners[c.userId]).indexOf(q) >= 0));
    if (sort === 'old') rows = rows.slice().reverse();
    if (sort === 'scans') rows = rows.slice().sort((a, b) => b.scans - a.scans);
    if (sort === 'recent') rows = rows.slice().sort((a, b) => String(b.lastScanAt || '').localeCompare(String(a.lastScanAt || '')));
    const page = Math.max(1, parseInt(qs.page, 10) || 1), pages = Math.max(1, Math.ceil(rows.length / PAGE));
    return {
      total: rows.length, all: all.length, page: Math.min(page, pages), pages, pageSize: PAGE,
      types: Array.from(new Set(all.map((c) => c.typeId))),
      items: rows.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE).map((c) => ({ ...this.row(req, c), owner: owners[c.userId] || null })),
    };
  }

  @Patch('codes/:id')
  async patch(@Req() req: Request, @Param('id') id: string, @Body() b: any = {}) {
    const q = await this.db.getQrCode(id); if (!q) throw fail(404, 'Not found');
    if (typeof b.paused !== 'boolean') throw fail(400, 'paused: true or false');
    if (STATIC.includes((QR_TYPES.find((t) => t.id === q.typeId) || {}).contentType)) throw fail(400, 'static');
    return this.row(req, await this.db.updateQrCode(id, { paused: b.paused }));
  }

  @Delete('codes/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const q = await this.db.getQrCode(id); if (!q) throw fail(404, 'Not found');
    await this.db.deleteQrCode(id, q.userId);
  }

  private row(req: Request, q: QrCode) {
    const r = this.codes.out(req, q);
    r.content = slim(r.content, q.contentType);
    r.userId = q.userId;
    return r;
  }
}
