/* =========================================================
   AANMELDEN (QR-soort "Aanmelden": nieuwsbrief, open dag, workshop)
   POST   /api/signup/:codeId                  bezoeker: { name, email, phone?, consent: true }   (openbaar, met limiet)
   GET    /api/qr-codes/:id/signups            eigenaar: de aanmeldingen
   DELETE /api/qr-codes/:id/signups/:sid       eigenaar: één aanmelding wissen (bv. op verzoek van de bezoeker)
   AVG: alleen met toestemming; alleen naam, e-mail en (als gevraagd) telefoon; geen IP-adres opgeslagen
   (de limiet staat alleen even in het geheugen); zelfde e-mail nog eens = niets veranderd (niet dubbel, niet overschrijven);
   na een jaar of bij definitief verwijderen van de code weg. Settings 'su:<code-id>', max. 2000.
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
import type { User } from '../types';

export type Signup = { id: string; at: string; name: string; email: string; phone: string | null };
const key = (id: string) => 'su:' + id, MAX = 2000, YEAR = 365 * 864e5;
export async function readSignups(db: DatabaseService, codeId: string): Promise<Signup[]> {
  try { const v = JSON.parse((await db.getSetting(key(codeId))) || '[]'); return Array.isArray(v) ? v.filter((x) => Date.now() - Date.parse(x.at) < YEAR) : []; } catch (e) { return []; }   // na een jaar weg (AVG)
}
const save = (db: DatabaseService, id: string, list: Signup[]) => db.setSetting(key(id), list.length ? JSON.stringify(list.slice(0, MAX)) : null);
const clean = (v: any, max: number) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

@Controller('api')
export class SignupController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  @Post('signup/:id')
  @HttpCode(201)
  async send(@Req() req: Request, @Param('id') id: string, @Body() b: any = {}) {
    if (this.auth.limited('su:' + req.ip, 10, 60) || this.auth.limited('su-code:' + id, 300, 60)) throw fail(429, 'too_many');
    const q = await this.db.getQrCode(String(id)); if (!q || q.typeId !== 'signup' || q.trashedAt || q.paused) throw fail(404, 'Not found');
    const name = clean(b.name, 80), email = clean(b.email, 200).toLowerCase(), errors: string[] = [];
    if (name.length < 2) errors.push('name');
    if (!EMAIL.test(email)) errors.push('email');
    let phone: string | null = null;
    if (q.content && q.content.askPhone && b.phone) { phone = clean(b.phone, 30); if (!/^\+?[\d\s().-]{6,30}$/.test(phone)) errors.push('phone'); }
    if (b.consent !== true) errors.push('consent');
    if (errors.length) throw fail(400, 'invalid', { details: errors });
    return locked('su:' + q.id, async () => {
      const list = await readSignups(this.db, q.id);
      if (list.some((s) => s.email === email)) return { ok: true };   // al aangemeld: niets overschrijven (anders kan iemand met jouw e-mail je gegevens wijzigen)
      if (list.length >= MAX) throw fail(409, 'full');
      list.unshift({ id: crypto.randomBytes(5).toString('hex'), at: new Date().toISOString(), name, email, phone });
      await save(this.db, q.id, list);
      return { ok: true };
    });
  }

  @Get('qr-codes/:id/signups')
  @UseGuards(LoggedIn)
  async list(@CurrentUser() u: User, @Param('id') id: string) {
    const q = await this.db.getOwnedQrCode(id, u.id); if (!q) throw fail(404, 'QR code not found');
    const items = await readSignups(this.db, q.id);
    return { count: items.length, items };
  }

  @Delete('qr-codes/:id/signups/:sid')
  @UseGuards(LoggedIn)
  @HttpCode(204)
  async remove(@CurrentUser() u: User, @Param('id') id: string, @Param('sid') sid: string) {
    const q = await this.db.getOwnedQrCode(id, u.id); if (!q) throw fail(404, 'QR code not found');
    return locked('su:' + q.id, async () => {
      const list = await readSignups(this.db, q.id); if (!list.some((s) => s.id === sid)) throw fail(404, 'Not found');
      await save(this.db, q.id, list.filter((s) => s.id !== sid));
    });
  }
}
