/* =========================================================
   FACTUREN VOOR DE BOEKHOUDING (de Super Admin, en beheerders aan wie hij toegang gaf)
   GET /api/admin/invoices?year=2026        → lijst (json)
   GET /api/admin/invoices/export.csv?year=2026 → csv voor de boekhouder (puntkomma, Spaanse decimalen)
   GET /api/admin/invoices/:nummer/pdf      → de factuur als pdf
   ========================================================= */
import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Param, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.service';
import { LoggedIn } from '../auth/auth.guard';
import { SuperOnly } from '../auth/admin.controller';
import { fail } from '../common/http';
import { invoicesOfYear, readInvoice, madridYear } from './invoices';
import { invoicePdf } from './invoice-pdf';
import { sign, signed } from '../database/secret';
import { publicUrl } from '../config/env';

const yearOf = (y: unknown) => { const n = Math.floor(Number(y)); return n >= 2020 && n <= 2100 ? n : madridYear(new Date()); };
const csvCell = (v: unknown) => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"' : s; };
/** Zolang Stripe in test staat: de testfacturen tonen (TEST-…); live alleen de echte */
const testMode = () => !/^sk_live_/.test(String(process.env.STRIPE_SECRET_KEY || ''));
const num = (n: number) => n.toFixed(2).replace('.', ',');

/** Wie de facturen mag zien: de Super Admin, en beheerders aan wie de Super Admin toegang gaf (settings 'inv:access'). */
const ACCESS = 'inv:access';
async function accessList(db: DatabaseService): Promise<string[]> {
  try { const x = JSON.parse((await db.getSetting(ACCESS)) || '[]'); return Array.isArray(x) ? x.map((e) => String(e).toLowerCase()) : []; } catch { return []; }
}
async function canView(auth: AuthService, db: DatabaseService, u: any): Promise<boolean> {
  if (!u) return false;
  if (auth.isSuper(u)) return true;
  return auth.isAdmin(u) && (await accessList(db)).includes(String(u.email || '').toLowerCase());   // alleen beheerders, en alleen met toegang
}
@Injectable()
export class InvoiceViewers implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly db: DatabaseService) {}
  async canActivate(ctx: ExecutionContext) {
    if (!(await canView(this.auth, this.db, ctx.switchToHttp().getRequest<Request>().user))) throw fail(403, 'no_invoice_access');
    return true;
  }
}

@Controller('api/admin/invoices')
@UseGuards(LoggedIn)
export class InvoicesAdminController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  /** Mag ik de facturen zien? (voor het menu) */
  @Get('can')
  async can(@Req() req: Request) { const u = (req as any).user; return { view: await canView(this.auth, this.db, u), manage: this.auth.isSuper(u) }; }

  /** Toegang beheren: alleen de Super Admin. Alleen bestaande beheerders kunnen toegang krijgen. */
  @Get('access')
  @UseGuards(SuperOnly)
  async access() { return { emails: await accessList(this.db) }; }

  @Put('access')
  @UseGuards(SuperOnly)
  async setAccess(@Body() b: any) {
    const want = Array.isArray(b && b.emails) ? b.emails.map((e: unknown) => String(e || '').trim().toLowerCase()).filter(Boolean) : null;
    if (!want || want.length > 25) throw fail(400, 'emails');
    const out: string[] = [], bad: string[] = [];
    for (const e of [...new Set(want)] as string[]) {
      const u = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? await this.db.userByEmail(e) : null;
      if (u && this.auth.isAdmin(u as any) && !this.auth.isSuper(u as any)) out.push(e); else bad.push(e);
    }
    if (bad.length) throw fail(400, 'not_admin', { details: bad });
    await this.db.setSetting(ACCESS, JSON.stringify(out));
    return { emails: out };
  }

  @Get()
  @UseGuards(InvoiceViewers)
  async list(@Query('year') year: string) {
    const y = yearOf(year);
    const items = (await invoicesOfYear(this.db, y, testMode())).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
    return { year: y, test: testMode(), items: items.map((d) => ({ number: d.number, series: d.series, date: d.date, buyer: d.buyer.name, email: d.buyer.email, taxId: d.buyer.taxId, country: d.buyer.country,
      net: d.net, tax: d.tax, total: d.total, currency: d.currency, product: d.product, kind: d.kind || 'invoice', rectifies: d.rectifies || null })) };
  }

  @Get('export.csv')
  @UseGuards(InvoiceViewers)
  async csv(@Query('year') year: string, @Res() res: Response) {
    const y = yearOf(year), rows = await invoicesOfYear(this.db, y, testMode());
    const head = ['Numero', 'Serie', 'Fecha', 'Cliente', 'NIF/VAT', 'Pais', 'Base imponible', 'IVA', 'Total', 'Moneda', 'Producto', 'Rectifica', 'Stripe'];
    const lines = rows.map((d) => [d.number, d.series, d.date.slice(0, 10), d.buyer.name, d.buyer.taxId, d.buyer.country, num(d.net), num(d.tax), num(d.total), d.currency, d.product, d.rectifies || '', d.stripeInvoice].map(csvCell).join(';'));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="facturas-' + y + '.csv"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end('﻿' + [head.join(';'), ...lines].join('\r\n') + '\r\n');
  }

  @Get(':number/pdf')
  @UseGuards(InvoiceViewers)
  async pdf(@Param('number') number: string, @Res() res: Response) {
    const d = await readInvoice(this.db, String(number)); if (!d) throw fail(404, 'not_found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Factura-' + d.number + '.pdf"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(invoicePdf(d));
  }
}

/** Downloadlink zonder inloggen, voor in Stripe (metadata "factura_pdf" bij de betaling).
 *  Alleen met de juiste handtekening: niet te raden zonder de sleutel van de server. */
export function invoiceLink(number: string): string {
  const base = (publicUrl() || 'https://my.qr-codex.com').replace(/\/$/, '');
  return base + '/api/invoice-file/' + encodeURIComponent(number) + '?s=' + sign('invoice:' + number);
}
@Controller('api/invoice-file')
export class InvoiceFileController {
  constructor(private readonly db: DatabaseService) {}
  @Get(':number')
  async file(@Param('number') number: string, @Query('s') s: string, @Res() res: Response) {
    if (!signed('invoice:' + String(number), String(s || ''))) throw fail(404, 'not_found');
    const d = await readInvoice(this.db, String(number)); if (!d) throw fail(404, 'not_found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Factura-' + d.number + '.pdf"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.end(invoicePdf(d));
  }
}
