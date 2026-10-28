/* =========================================================
   FEEDBACK (QR-soort "Feedback")
   POST /api/feedback/:codeId                 bezoeker: { rating 1-5, comment?, email?, consent }   (openbaar, met limiet)
   GET  /api/qr-codes/:id/feedback            eigenaar: gemiddelde, verdeling en antwoorden
   DELETE /api/qr-codes/:id/feedback/:fid     eigenaar: één antwoord wissen (bv. op verzoek van de bezoeker)
   AVG: e-mail alleen met toestemming; geen IP-adres opgeslagen (de limiet staat alleen even in het geheugen);
   antwoorden ouder dan een jaar vallen eraf; weg bij definitief verwijderen van de code. Settings 'fb:<code-id>', max. 1000.
   ========================================================= */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { EMAIL } from './validation';
import { fail } from '../common/http';
import { locked } from '../common/lock';
import { openForInput } from '../visitor/open';
import type { User } from '../types';

export type Answer = { id: string; at: string; rating: number; comment: string; email: string | null };
const key = (id: string) => 'fb:' + id, YEAR = 365 * 864e5;
export async function readAnswers(db: DatabaseService, codeId: string): Promise<Answer[]> {
  try { const v = JSON.parse((await db.getSetting(key(codeId))) || '[]'); return Array.isArray(v) ? v.filter((a) => Date.now() - Date.parse(a.at) < YEAR) : []; } catch (e) { return []; }
}
const save = (db: DatabaseService, id: string, list: Answer[]) => db.setSetting(key(id), list.length ? JSON.stringify(list.slice(0, 1000)) : null);

@Controller('api')
export class FeedbackController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  @Post('feedback/:id')
  @HttpCode(201)
  async send(@Req() req: Request, @Param('id') id: string, @Body() b: any = {}) {
    if (this.auth.limited('fb:' + req.ip, 10, 60) || this.auth.limited('fb-code:' + id, 300, 60)) throw fail(429, 'too_many');
    const q = await this.db.getQrCode(String(id)); if (!(await openForInput(this.db, q, 'feedback'))) throw fail(404, 'Not found');   // zelfde regels als de code openen (uit, verlopen, niet betaald …)
    const rating = Number(b.rating); if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw fail(400, 'rating');
    const comment = String(b.comment || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1000);
    let email: string | null = null;
    if (q.content && q.content.askEmail && b.consent === true && b.email) { const e = String(b.email).trim().toLowerCase().slice(0, 200); if (!EMAIL.test(e)) throw fail(400, 'email'); email = e; }
    return locked('fb:' + q.id, async () => {
      const list = await readAnswers(this.db, q.id);
      list.unshift({ id: crypto.randomBytes(5).toString('hex'), at: new Date().toISOString(), rating, comment, email });
      await save(this.db, q.id, list);
      return { ok: true };
    });
  }

  @Get('qr-codes/:id/feedback')
  @UseGuards(LoggedIn)
  async list(@CurrentUser() u: User, @Param('id') id: string) {
    const q = await this.db.getOwnedQrCode(id, u.id); if (!q) throw fail(404, 'QR code not found');
    const items = await readAnswers(this.db, q.id), dist = [0, 0, 0, 0, 0];
    items.forEach((a) => { dist[a.rating - 1]++; });
    const avg = items.length ? Math.round((items.reduce((s, a) => s + a.rating, 0) / items.length) * 10) / 10 : null;
    return { count: items.length, avg, dist, items };
  }

  @Delete('qr-codes/:id/feedback/:fid')
  @UseGuards(LoggedIn)
  @HttpCode(204)
  async remove(@CurrentUser() u: User, @Param('id') id: string, @Param('fid') fid: string) {
    const q = await this.db.getOwnedQrCode(id, u.id); if (!q) throw fail(404, 'QR code not found');
    return locked('fb:' + q.id, async () => {
      const list = await readAnswers(this.db, q.id); if (!list.some((a) => a.id === fid)) throw fail(404, 'Not found');
      await save(this.db, q.id, list.filter((a) => a.id !== fid));
    });
  }
}
