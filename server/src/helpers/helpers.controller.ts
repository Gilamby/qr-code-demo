/* =========================================================
   SYSTEEM EN HULPDIENSTEN
   - /api/health, /api/qr-types: openbaar
   - /api/url-info, /api/geocode, /api/email-check: hulp bij het invullen, alleen ingelogd
     (geen open doorgeefluik voor anderen)
   ========================================================= */
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { reply } from '../common/http';
import * as dns from 'dns/promises';
import { DatabaseService } from '../database/database.service';
import { LoggedIn } from '../auth/auth.guard';
import { baseUrl, phoneReachable } from '../config/env';
import { EMAIL, QR_TYPES } from '../qr-codes/validation';
import { urlInfo } from './url-check';

@Controller('api')
export class SystemController {
  constructor(private readonly db: DatabaseService) {}

  /** Draait de server en de database? En naar welk adres wijzen de QR-codes? */
  @Get('health')
  async health(@Req() req: Request) {
    try {
      await this.db.ping();
      const qrBase = baseUrl(req);
      return { ok: true, qrBase, phoneReachable: phoneReachable(qrBase) };
    } catch (e) { throw reply(503, { ok: false }); }
  }

  @Get('qr-types')
  types() { return QR_TYPES; }
}

@Controller('api')
@UseGuards(LoggedIn)
export class HelpersController {
  private readonly mailCache = new Map<string, boolean>();

  /** Website controleren: bestaat hij en wat is de titel? (link-check en automatische naam) */
  @Get('url-info')
  async urlInfo(@Query('url') url: string) {
    url = String(url || '');
    try { new URL(url); } catch (e) { throw reply(400, { ok: false, error: 'Invalid URL' }); }
    try { return await urlInfo(url); } catch (e) { return { ok: false, status: 0, title: '' }; }
  }

  /** Adres zoeken via onze server (privacy): de adres-dienst (Photon/OpenStreetMap) ziet nooit het IP-adres van de gebruiker.
      Voor groot gebruik: eigen Photon-server (PHOTON_URL). */
  @Get('geocode')
  async geocode(@Query() query: Record<string, string>) {
    const q = String(query.q || '').slice(0, 120).trim();
    if (q.length < 3) return { features: [] };
    const lang = ['de', 'en', 'fr'].includes(query.lang) ? '&lang=' + query.lang : '';
    const limit = Math.min(8, Math.max(1, parseInt(query.limit, 10) || 5));
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch((process.env.PHOTON_URL || 'https://photon.komoot.io') + '/api/?limit=' + limit + lang + '&q=' + encodeURIComponent(q), { signal: ctrl.signal, headers: { 'User-Agent': 'OptimasysQR (+https://optimasys.com)' } });
      if (!r.ok) throw new Error(String(r.status));
      const data: any = await r.json();
      return { features: (data.features || []).map((f) => ({ geometry: { coordinates: f.geometry.coordinates }, properties: f.properties })) };
    } catch (e) { throw reply(502, { features: [], error: 'Address search unavailable' }); } finally { clearTimeout(timer); }
  }

  /** E-mail controleren: klopt de vorm en kan het domein mail ontvangen (MX-record, anders een gewoon adres)?
      We sturen geen mail en bewaren niets; alleen het domein wordt opgezocht. */
  @Get('email-check')
  async emailCheck(@Query('e') e: string) {
    const email = String(e || '').trim().slice(0, 254);
    if (!EMAIL.test(email)) return { ok: false, reason: 'format' };
    const domain = email.split('@')[1].toLowerCase();
    if (this.mailCache.has(domain)) return { ok: this.mailCache.get(domain), reason: this.mailCache.get(domain) ? '' : 'domain' };
    const timeout = new Promise<string>((r) => setTimeout(() => r('timeout'), 3500));
    const look = (async () => {
      try { const mx = await dns.resolveMx(domain); if (mx && mx.some((m) => m.exchange && m.exchange !== '.')) return true; } catch (err) { if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') throw err; }
      try { const a = await dns.resolve4(domain); return a.length > 0; } catch (err) { if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') return false; throw err; }
    })().catch(() => 'unknown');
    const ok = await Promise.race([look, timeout]);
    if (ok === 'timeout' || ok === 'unknown') return { ok: true, reason: 'unchecked' };   // twijfel: niet blokkeren
    if (this.mailCache.size > 5000) this.mailCache.clear();
    this.mailCache.set(domain, ok as boolean);
    return { ok, reason: ok ? '' : 'domain' };
  }
}
