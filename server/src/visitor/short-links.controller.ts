/* =========================================================
   KORTE LINK IN DE QR-CODE  (/q/:id)
   Regels toepassen (uit, verlopen, wachtwoord), scan tellen, en dan doorsturen of de echte pagina tonen.
   Openbaar: geen inloggen nodig.
   ========================================================= */
import { MailerService } from '../auth/mailer.service';
import { scanAlert } from '../scan-alerts';
import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { isBlocked } from '../subscription';
import type { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { describe } from '../analytics/scan-stats';
import { QR_TYPES } from '../qr-codes/validation';
import { secretKey } from '../qr-codes/qr-codes.service';
import * as rules from './rules';
import { livePage } from './live-page';
import type { QrCode } from '../types';

/* A/B-test: scans per versie, per code in instelling "ab:<id>" = { A, B, since }. Eén schrijver per code tegelijk. */
const abQueue = new Map<string, Promise<unknown>>();
function countAb(db: DatabaseService, id: string, v: 'A' | 'B') {
  const prev = abQueue.get(id) || Promise.resolve();
  const next = prev.then(async () => {
    let o: any = null; try { o = JSON.parse((await db.getSetting('ab:' + id)) || 'null'); } catch { o = null; }
    o = o || { A: 0, B: 0, since: new Date().toISOString() }; o[v] = (o[v] || 0) + 1;
    await db.setSetting('ab:' + id, JSON.stringify(o));
  }).catch(() => {});
  abQueue.set(id, next); next.then(() => { if (abQueue.get(id) === next) abQueue.delete(id); });
}

@Controller('q')
export class ShortLinksController {
  constructor(private readonly db: DatabaseService, private readonly mailer: MailerService) {}

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
    if (!q || q.paused || rules.isExpired(q) || isBlocked(q.userId)) return res.status(404).send(rules.notFoundPage(req));
    const secret = secretKey(q.typeId);
    if (secret && q.content[secret] && !rules.fileTokenOk(q, key, token)) return res.status(403).send(rules.passwordPage(req, false));
    return this.sendFile(res, q, key);
  }

  /** Eén foto van een fotogalerij */
  @Get(':id/photo/:n')
  async photo(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Param('n') n: string) {
    const q = await this.db.getQrCode(id);
    if (!q || q.paused || rules.isExpired(q) || isBlocked(q.userId)) return res.status(404).send(rules.notFoundPage(req));
    const field = (QR_TYPES.find((t) => t.id === q.typeId)?.fields || []).find((f: any) => f.type === 'gallery');
    let list: any[] = []; try { list = field ? JSON.parse(q.content[field.key] || '[]') : []; } catch (e) { /* leeg */ }
    const x = /^\d{1,3}$/.test(n) ? list[Number(n)] : null;
    if (!x) return res.status(404).send('Not found');
    res.set('X-Content-Type-Options', 'nosniff').set('Cache-Control', 'public, max-age=86400');
    if (typeof x === 'string') {   // oude code: foto staat als data-URL in de inhoud
      const m = x.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/); if (!m) return res.status(404).send('Not found');
      return res.set('Content-Type', m[1]).send(Buffer.from(m[2], 'base64'));
    }
    const f = await this.db.getFile(x.f);
    if (!f || f.code_id !== q.id) return res.status(404).send('Not found');
    res.set('Content-Type', f.mime);
    return res.sendFile(f.path, { dotfiles: 'allow' }, (err) => { if (err && !res.headersSent) res.status(404).send('Not found'); });
  }

  /** Tijdzone van de eigenaar (voor starttijd/eindtijd), 10 minuten onthouden */
  private zones = new Map<string, { at: number; tz: string }>();
  private async zoneOf(userId: string) {
    const z = this.zones.get(userId); if (z && Date.now() - z.at < 600e3) return z.tz;
    const u: any = await this.db.getUser(userId).catch(() => null), tz = (u && u.timezone) || 'Europe/Madrid';
    this.zones.set(userId, { at: Date.now(), tz }); return tz;
  }
  private async openCode(req: Request, res: Response, id: string, passwordOk: boolean) {
    const found = await this.db.getQrCode(id);
    if (!found) return res.status(/^[A-Za-z0-9_-]{4,16}$/.test(id) && (await this.db.wasDeleted(id)) ? 410 : 404).send(rules.notFoundPage(req));   // 410 = verwijderd, komt niet terug
    if (isBlocked(found.userId)) return res.status(503).set('Retry-After', '3600').send(rules.inactivePage(req));   // abonnement niet betaald: niet tellen
    if (found.paused) return res.status(503).set('Retry-After', '3600').send(rules.pausedPage(req));   // tijdelijk uit: niet tellen
    const now = rules.nowIn(found.content && (found.content.startsTime || found.content.expiresTime) ? await this.zoneOf(found.userId) : undefined);
    if (rules.isExpired(found, now)) {
      // Na afloop doorsturen naar een andere link (bv. de nieuwe actie), anders "Deze QR-code is verlopen"
      if (found.content.afterUrl && /^https?:\/\//i.test(found.content.afterUrl)) { res.set('Cache-Control', 'no-store'); return res.redirect(found.content.afterUrl); }
      return res.status(410).send(rules.expiredPage(req));
    }
    if (rules.notYet(found, now)) return res.status(503).send(rules.notYetPage(req, found.content.starts));   // nog niet begonnen: niet tellen
    const key = secretKey(found.typeId);
    if (key && found.content[key] && !passwordOk) {
      // Na het juiste wachtwoord stuurt het formulier door naar de bestemming (een andere website).
      // De browser staat dat alleen toe als form-action dat ook toestaat: hier dus ook http(s)-adressen.
      const csp = String(res.getHeader('Content-Security-Policy') || '');
      if (csp) res.set('Content-Security-Policy', csp.replace("form-action 'self'", "form-action 'self' https: http:"));
      return res.send(rules.passwordPage(req, req.method === 'POST'));
    }
    const q = await this.db.addScan(found.id, describe(found, req));
    setImmediate(() => { scanAlert(this.db, this.mailer, q); });           // eerste scan / mijlpaal: mail (na het antwoord)
    const c = q.content;
    res.set('Cache-Control', 'no-store');                               // elke scan moet bij ons langskomen
    if (q.contentType === 'url' && c.url && !(q.typeId === 'video' && c.file)) {
      const v = rules.abVariant(q); if (v) countAb(this.db, q.id, v);     // A/B-test: scans per versie tellen
      return res.redirect(rules.targetUrl(q, req.get('user-agent'), v));
    }   // eigen video: de videopagina met speler
    // WhatsApp of SMS. SMS: berichtenprogramma openen met nummer en tekst ("?&body=" werkt op iPhone én Android)
    if (q.contentType === 'message' && c.channel === 'sms' && c.phone) return res.redirect('sms:' + c.phone.replace(/[^\d+]/g, '') + (c.message ? '?&body=' + encodeURIComponent(c.message) : ''));
    if (q.contentType === 'message' && c.phone) return res.redirect('https://wa.me/' + c.phone.replace(/\D/g, '') + (c.message ? '?text=' + encodeURIComponent(c.message) : ''));
    // Doorsturen naar wat al bestaat
    const ua = req.get('user-agent') || '';
    if (q.typeId === 'facebook' && c.url) return res.redirect(c.url);
    if (q.typeId === 'menu') {   // menu: bestaande menupagina of bestelsite openen, of het geüploade menu (PDF/foto) tonen
      const mode = (QR_TYPES as any).choice(QR_TYPES.find((t) => t.id === 'menu'), 'mode', c);
      if (mode === 'link' && c.menuUrl) return res.redirect(c.menuUrl);
      if (mode === 'upload' && c.menuFile) return res.redirect((req.path.endsWith('/') ? '' : q.id + '/') + 'file/menuFile');
    }
    if (q.typeId === 'pdf' && c.file) return res.redirect((req.path.endsWith('/') ? '' : q.id + '/') + 'file/file');   // PDF: meteen openen in de pdf-lezer van de telefoon
    if (q.typeId === 'instagram' && (c.username || c.url)) return res.redirect(c.username ? 'https://www.instagram.com/' + encodeURIComponent(c.username.replace(/^@/, '')) + '/' : c.url);   // naam of profiellink
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
