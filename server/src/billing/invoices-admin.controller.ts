/* =========================================================
   FACTUREN VOOR DE BOEKHOUDING (alleen het team)
   GET /api/admin/invoices?year=2026        → lijst (json)
   GET /api/admin/invoices/export.csv?year=2026 → csv voor de boekhouder (puntkomma, Spaanse decimalen)
   GET /api/admin/invoices/:nummer/pdf      → de factuur als pdf
   ========================================================= */
import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { LoggedIn } from '../auth/auth.guard';
import { TeamOnly } from '../auth/admin.controller';
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

@Controller('api/admin/invoices')
@UseGuards(LoggedIn, TeamOnly)
export class InvoicesAdminController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async list(@Query('year') year: string) {
    const y = yearOf(year);
    const items = (await invoicesOfYear(this.db, y, testMode())).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
    return { year: y, test: testMode(), items: items.map((d) => ({ number: d.number, series: d.series, date: d.date, buyer: d.buyer.name, email: d.buyer.email, taxId: d.buyer.taxId, country: d.buyer.country,
      net: d.net, tax: d.tax, total: d.total, currency: d.currency, product: d.product, kind: d.kind || 'invoice', rectifies: d.rectifies || null })) };
  }

  @Get('export.csv')
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
