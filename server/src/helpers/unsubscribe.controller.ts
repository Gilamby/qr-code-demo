/* =========================================================
   AFMELDEN voor het scanoverzicht per e-mail, zonder in te loggen.
   - GET  /api/unsubscribe?u=<id>&t=<handtekening>  pagina met één knop (een linkscanner van een mailprogramma
                                                   meldt je dus niet per ongeluk af)
   - POST dezelfde link                             afmelden; ook de "Afmelden"-knop van Gmail/Outlook (RFC 8058)
   De handtekening (HMAC, zie database/secret.ts) zorgt dat niemand anders iemand kan afmelden.
   ========================================================= */
import { Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { MailerService } from '../auth/mailer.service';
import { signed } from '../database/secret';

const esc = (s: string) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

@Controller('api')
export class UnsubscribeController {
  constructor(private readonly db: DatabaseService, private readonly mailer: MailerService) {}

  private async user(u: string, t: string) {
    if (!u || !t || !signed('report:' + u, t)) return null;
    try { return await this.db.getUser(String(u)); } catch (e) { return null; }
  }
  private page(res: Response, lang: string, title: string, body: string, status = 200) {
    res.status(status).type('html').send('<!doctype html><html lang="' + esc(lang) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">' +
      '<title>' + esc(title) + ' · QR-Codex</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0e13;color:#e8edf5;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
      'main{max-width:420px;margin:24px;padding:32px;border-radius:20px;background:#141a24;border:1px solid #243041;text-align:center}h1{font-size:22px;margin:0 0 8px}p{color:#9aa7b8;margin:0 0 20px}' +
      'button,a.b{display:inline-block;border:0;border-radius:12px;padding:12px 22px;font:inherit;font-weight:700;cursor:pointer;background:#29b6f6;color:#06121c;text-decoration:none}small{display:block;margin-top:18px;color:#6b778a}' +
      '.brand{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#29b6f6;font-weight:800;margin-bottom:10px}</style></head><body><main><div class="brand">QR-Codex</div><h1>' + esc(title) + '</h1>' + body + '</main></body></html>');
  }

  @Get('unsubscribe')
  async ask(@Query('u') u: string, @Query('t') t: string, @Res() res: Response) {
    const user = await this.user(u, t), t2 = await this.mailer.pageTexts((user && user.lang) || 'en');
    if (!user) return this.page(res, 'en', t2.unsubBadTitle || 'Link not valid', '<p>' + esc(t2.unsubBadText || 'This link is not valid (anymore). You can turn emails off in My account > Notifications.') + '</p>', 400);
    const off = !user.emailPrefs || user.emailPrefs.report === 'off';
    if (off) return this.page(res, user.lang || 'en', t2.unsubDoneTitle || 'You are unsubscribed', '<p>' + esc(t2.unsubDoneText || '') + '</p><a class="b" href="/">' + esc(t2.unsubOpen || 'Open QR-Codex') + '</a>');
    return this.page(res, user.lang || 'en', t2.unsubTitle || 'Unsubscribe from the scan report?',
      '<p>' + esc((t2.unsubText || 'You will no longer receive the scan report at {email}.').replace('{email}', user.email)) + '</p>' +
      '<form method="post" action="/api/unsubscribe?u=' + encodeURIComponent(u) + '&amp;t=' + encodeURIComponent(t) + '"><button type="submit">' + esc(t2.unsubButton || 'Unsubscribe') + '</button></form>' +
      '<small>' + esc(t2.unsubOther || '') + '</small>');
  }

  @Post('unsubscribe')
  @HttpCode(200)
  async confirm(@Query('u') u: string, @Query('t') t: string, @Res() res: Response) {
    const user = await this.user(u, t), t2 = await this.mailer.pageTexts((user && user.lang) || 'en');
    if (!user) return this.page(res, 'en', t2.unsubBadTitle || 'Link not valid', '<p>' + esc(t2.unsubBadText || '') + '</p>', 400);
    const cur = user.emailPrefs || { report: 'off', security: true, product: false };
    if (cur.report !== 'off') await this.db.updateUser(user.id, { emailPrefs: JSON.stringify({ ...cur, report: 'off' }) } as any);
    return this.page(res, user.lang || 'en', t2.unsubDoneTitle || 'You are unsubscribed', '<p>' + esc(t2.unsubDoneText || '') + '</p><a class="b" href="/">' + esc(t2.unsubOpen || 'Open QR-Codex') + '</a>');
  }
}
