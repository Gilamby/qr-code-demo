/* =========================================================
   FORMULIER (QR-soort "Formulier": eigen vragen)
   POST   /api/form/:codeId                  bezoeker: { answers: [...], consent }   (openbaar, met limiet)
   GET    /api/qr-codes/:id/form-answers     eigenaar: de vragen en de antwoorden
   DELETE /api/qr-codes/:id/form-answers/:aid  eigenaar: één inzending wissen
   Antwoord per vraag: tekst (text/long/email), nummer van de keuze (choice), lijst nummers (multi), 1-5 (stars).
   AVG: een e-mailadres alleen met toestemming; geen IP-adres opgeslagen (de limiet staat alleen even in het geheugen);
   na een jaar of bij definitief verwijderen van de code weg. Settings 'fm:<code-id>', max. 2000 inzendingen.
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

type Q = { t: string; q: string; o?: string[]; r?: boolean };
export type Entry = { id: string; at: string; a: any[]; q?: Q[] };   // q: de vragen zoals ze waren bij het insturen (vragen kunnen later veranderen)
const key = (id: string) => 'fm:' + id, MAX = 2000, YEAR = 365 * 864e5;
const questions = (content: any): Q[] => { try { const a = JSON.parse((content && content.questions) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
export async function readEntries(db: DatabaseService, codeId: string): Promise<Entry[]> {
  try { const v = JSON.parse((await db.getSetting(key(codeId))) || '[]'); return Array.isArray(v) ? v.filter((x) => Date.now() - Date.parse(x.at) < YEAR) : []; } catch (e) { return []; }   // na een jaar weg (AVG)
}
const save = (db: DatabaseService, id: string, list: Entry[]) => db.setSetting(key(id), list.length ? JSON.stringify(list.slice(0, MAX)) : null);
const text = (v: any, max: number) => String(v == null ? '' : v).replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

@Controller('api')
export class FormController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  @Post('form/:id')
  @HttpCode(201)
  async send(@Req() req: Request, @Param('id') id: string, @Body() b: any = {}) {
    if (this.auth.limited('fm:' + req.ip, 10, 60) || this.auth.limited('fm-code:' + id, 300, 60)) throw fail(429, 'too_many');
    const q = await this.db.getQrCode(String(id)); if (!(await openForInput(this.db, q, 'form'))) throw fail(404, 'Not found');   // zelfde regels als de code openen (uit, verlopen, niet betaald …)
    const qs = questions(q.content), input = Array.isArray(b.answers) ? b.answers : [], errors: string[] = [];
    const out = qs.map((x, i) => {
      const v = input[i];
      if (x.t === 'stars') { const n = Number(v); if (Number.isInteger(n) && n >= 1 && n <= 5) return n; if (v !== '' && v != null) errors.push(String(i)); return null; }
      if (x.t === 'choice') { const n = Number(v); if (v !== '' && v != null && Number.isInteger(n) && n >= 0 && n < (x.o || []).length) return n; if (v !== '' && v != null) errors.push(String(i)); return null; }
      if (x.t === 'multi') { const a = Array.isArray(v) ? [...new Set(v.map(Number))] : []; if (a.some((n) => !Number.isInteger(n) || n < 0 || n >= (x.o || []).length)) { errors.push(String(i)); return []; } return a.sort(); }
      const s = text(v, x.t === 'long' ? 1000 : 200);
      if (x.t === 'email' && s) { const e = s.toLowerCase(); if (!EMAIL.test(e)) errors.push(String(i)); return e; }
      return s;
    });
    qs.forEach((x, i) => { const a = out[i]; if (x.r && (a == null || a === '' || (Array.isArray(a) && !a.length))) errors.push(String(i)); });
    if (qs.some((x, i) => x.t === 'email' && out[i]) && b.consent !== true) errors.push('consent');
    if (out.every((a) => a == null || a === '' || (Array.isArray(a) && !a.length))) errors.push('empty');
    if (errors.length) throw fail(400, 'invalid', { details: [...new Set(errors)] });
    return locked('fm:' + q.id, async () => {
      const list = await readEntries(this.db, q.id); if (list.length >= MAX) throw fail(409, 'full');
      list.unshift({ id: crypto.randomBytes(5).toString('hex'), at: new Date().toISOString(), a: out, q: qs.map((x) => ({ t: x.t, q: x.q, o: x.o })) });
      await save(this.db, q.id, list);
      return { ok: true };
    });
  }

  @Get('qr-codes/:id/form-answers')
  @UseGuards(LoggedIn)
  async list(@CurrentUser() u: User, @Param('id') id: string) {
    const q = await this.db.getOwnedQrCode(id, u.id); if (!q) throw fail(404, 'QR code not found');
    const items = await readEntries(this.db, q.id);
    return { questions: questions(q.content), count: items.length, items };
  }

  @Delete('qr-codes/:id/form-answers/:aid')
  @UseGuards(LoggedIn)
  @HttpCode(204)
  async remove(@CurrentUser() u: User, @Param('id') id: string, @Param('aid') aid: string) {
    const q = await this.db.getOwnedQrCode(id, u.id); if (!q) throw fail(404, 'QR code not found');
    return locked('fm:' + q.id, async () => {
      const list = await readEntries(this.db, q.id); if (!list.some((s) => s.id === aid)) throw fail(404, 'Not found');
      await save(this.db, q.id, list.filter((s) => s.id !== aid));
    });
  }
}
