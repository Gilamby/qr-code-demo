/* =========================================================
   KORTE LINK IN DE QR-CODE  (/q/:id)
   Regels toepassen (uit, verlopen, wachtwoord), scan tellen, en dan doorsturen of de echte pagina tonen.
   Openbaar: geen inloggen nodig.
   ========================================================= */
import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { describe } from '../analytics/scan-stats';
import { QR_TYPES } from '../qr-codes/validation';
import { secretKey } from '../qr-codes/qr-codes.service';
import * as rules from './rules';
import { livePage } from './live-page';
import type { QrCode } from '../types';

@Controller('q')
export class ShortLinksController {
  constructor(private readonly db: DatabaseService) {}

  @Get(':id')
  open(@Req() req: Request, @Res() res: Response, @Param('id') id: string) { return this.openCode(req, res, id, false); }

  /** Wachtwoord van een beveiligde pagina */
  @Post(':id')
  async unlock(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Body() b: any = {}) {
    const q = await this.db.getQrCode(id);
    const key = q && secretKey(q.typeId);
    return this.openCode(req, res, id, !!(key && q.content[key] && rules.checkPassword(b.password || '', q.content[key])));
  }

  /** Bestand (PDF/MP3) ophalen */
  @Get(':id/file/:key')
  async file(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Param('key') key: string, @Query('t') token: string) {
    const q = await this.db.getQrCode(id);
    if (!q || q.paused || rules.isExpired(q)) return res.status(404).send(rules.notFoundPage(req));
    const secret = secretKey(q.typeId);
    if (secret && q.content[secret] && !rules.fileTokenOk(q, key, token)) return res.status(403).send(rules.passwordPage(req, false));
    return this.sendFile(res, q, key);
  }

  private async openCode(req: Request, res: Response, id: string, passwordOk: boolean) {
    const found = await this.db.getQrCode(id);
    if (!found) return res.status(404).send(rules.notFoundPage(req));
    if (found.paused) return res.status(503).set('Retry-After', '3600').send(rules.pausedPage(req));   // tijdelijk uit: niet tellen
    if (rules.isExpired(found)) return res.status(410).send(rules.expiredPage(req));
    const key = secretKey(found.typeId);
    if (key && found.content[key] && !passwordOk) return res.send(rules.passwordPage(req, req.method === 'POST'));
    const q = await this.db.addScan(found.id, describe(found, req));
    const c = q.content;
    res.set('Cache-Control', 'no-store');                               // elke scan moet bij ons langskomen
    if (q.contentType === 'url' && c.url) return res.redirect(rules.targetUrl(q, req.get('user-agent')));
    if (q.contentType === 'message' && c.phone) return res.redirect('https://wa.me/' + c.phone.replace(/\D/g, '') + (c.message ? '?text=' + encodeURIComponent(c.message) : ''));
    // Doorsturen naar wat al bestaat
    const ua = req.get('user-agent') || '';
    if (q.typeId === 'facebook' && c.url) return res.redirect(c.url);
    if (q.typeId === 'instagram' && c.username) return res.redirect('https://instagram.com/' + encodeURIComponent(c.username.replace(/^@/, '')));
    if (q.typeId === 'apps') {                                   // telefoon: meteen naar de juiste winkel; computer: de pagina met beide knoppen
      if (/iPhone|iPad|iPod/i.test(ua) && c.ios) return res.redirect(c.ios);
      if (/Android/i.test(ua) && c.android) return res.redirect(c.android);
    }
    // Alle andere types: de echte pagina, met dezelfde sjablonen als de telefoon in de tool
    const type = QR_TYPES.find((t) => t.id === q.typeId);
    if (!type) return res.status(404).send(rules.notFoundPage(req));
    res.send(livePage(req, q, type));
  }

  private async sendFile(res: Response, q: QrCode, key: string) {
    let o = null; try { o = JSON.parse(q.content[key]); } catch (e) { /* geen bestand */ }
    // Bestand op schijf
    if (o && o.f) {
      const f = await this.db.getFile(o.f);
      if (!f || f.code_id !== q.id) return res.status(404).send('File not found');
      res.set('Content-Type', f.mime).set('X-Content-Type-Options', 'nosniff').set('Cache-Control', 'private, max-age=3600');
      res.set('Content-Disposition', 'inline; filename="' + String(o.n || f.name || 'file').replace(/[^\w.\- ]/g, '_') + '"');
      return res.sendFile(f.path, { dotfiles: 'allow' }, (err) => { if (err && !res.headersSent) res.status(404).send('File not found'); });
    }
    // Oud: als data-URL in de inhoud
    const m = o && typeof o.d === 'string' && o.d.match(/^data:([\w/.+-]+);base64,(.*)$/);
    if (!m) return res.status(404).send('File not found');
    res.set('Content-Type', m[1]);
    res.set('Content-Disposition', 'inline; filename="' + String(o.n || 'file').replace(/[^\w.\- ]/g, '_') + '"');
    res.send(Buffer.from(m[2], 'base64'));
  }
}
