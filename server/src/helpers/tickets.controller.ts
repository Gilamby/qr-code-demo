/* =========================================================
   SUPPORTVRAGEN ("Mijn vragen")
   Elk contactbericht wordt een vraag met een gesprek. De klant ziet zijn vragen op de Contact-pagina,
   het team beantwoordt ze in Beheer > Instellingen > Support. Bij elk antwoord gaat er een e-mail naar de ander.
   GET  /api/tickets                       mijn vragen
   POST /api/tickets/:id/reply { text }    klant reageert (vraag gaat weer open)
   POST /api/tickets/:id/close             klant sluit de vraag
   GET  /api/admin/tickets                 alle vragen (team)
   POST /api/admin/tickets/:id/reply       team antwoordt (status: beantwoord)
   PATCH /api/admin/tickets/:id { status } open | answered | closed
   Opslag: settings 'tickets' (nieuwste eerst, max. 1000; gesloten vragen ouder dan een jaar vallen eraf).
   ========================================================= */
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { TeamOnly } from '../auth/admin.controller';
import { AuthService } from '../auth/auth.service';
import { MailerService } from '../auth/mailer.service';
import { fail } from '../common/http';
import type { User } from '../types';

export type Msg = { at: string; from: 'customer' | 'team'; by: string; text: string };
export type Ticket = { id: string; userId: string; email: string; name: string; topic: string; status: 'open' | 'answered' | 'closed'; at: string; updatedAt: string; messages: Msg[] };
const YEAR = 365 * 864e5;
const clean = (v: unknown, max: number) => String(v == null ? '' : v).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

export async function readTickets(db: DatabaseService): Promise<Ticket[]> {
  try { const v = JSON.parse((await db.getSetting('tickets')) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
async function save(db: DatabaseService, list: Ticket[]) {
  const now = Date.now();
  list = list.filter((x) => x.status !== 'closed' || now - Date.parse(x.updatedAt) < YEAR).slice(0, 1000);
  await db.setSetting('tickets', list.length ? JSON.stringify(list) : null);
}
export async function addTicket(db: DatabaseService, user: User, m: { name: string; email: string; topic: string; message: string }) {
  const list = await readTickets(db), at = new Date().toISOString();
  const tk: Ticket = { id: crypto.randomBytes(5).toString('base64url'), userId: user.id, email: m.email, name: m.name, topic: m.topic, status: 'open', at, updatedAt: at,
    messages: [{ at, from: 'customer', by: m.name, text: m.message }] };
  list.unshift(tk); await save(db, list); return tk;
}
export async function dropTicketsOf(db: DatabaseService, userId: string) { const list = await readTickets(db); await save(db, list.filter((x) => x.userId !== userId)); }

@Controller('api')
@UseGuards(LoggedIn)
export class TicketsController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly mailer: MailerService) {}

  @Get('tickets')
  async mine(@CurrentUser() u: User) { return { tickets: (await readTickets(this.db)).filter((x) => x.userId === u.id) }; }

  @Post('tickets/:id/reply')
  @HttpCode(200)
  async reply(@Req() req: Request, @CurrentUser() u: User, @Param('id') id: string, @Body() b: any = {}) {
    if (this.auth.limited('ticket:' + u.id, 20, 60)) throw fail(429, 'too_many');
    const text = clean(b.text, 4000); if (text.length < 2) throw fail(400, 'text');
    const list = await readTickets(this.db), tk = list.find((x) => x.id === id && x.userId === u.id); if (!tk) throw fail(404, 'Not found');
    const at = new Date().toISOString();
    tk.messages.push({ at, from: 'customer', by: u.name || tk.name, text }); tk.messages = tk.messages.slice(-50); tk.status = 'open'; tk.updatedAt = at;
    await save(this.db, [tk, ...list.filter((x) => x !== tk)]);
    this.mailer.sendContact({ name: tk.name, email: tk.email, topic: tk.topic + ' #' + tk.id, message: text, account: u.email }).catch(() => {});
    return { ticket: tk };
  }

  @Post('tickets/:id/close')
  @HttpCode(200)
  async close(@CurrentUser() u: User, @Param('id') id: string) {
    const list = await readTickets(this.db), tk = list.find((x) => x.id === id && x.userId === u.id); if (!tk) throw fail(404, 'Not found');
    tk.status = 'closed'; tk.updatedAt = new Date().toISOString(); await save(this.db, list);
    return { ticket: tk };
  }

  /* ---------- Team ---------- */
  @Get('admin/tickets')
  @UseGuards(TeamOnly)
  async all() { return { tickets: await readTickets(this.db) }; }

  @Post('admin/tickets/:id/reply')
  @UseGuards(TeamOnly)
  @HttpCode(200)
  async answer(@CurrentUser() me: User, @Param('id') id: string, @Body() b: any = {}) {
    const text = clean(b.text, 4000); if (text.length < 2) throw fail(400, 'text');
    const list = await readTickets(this.db), tk = list.find((x) => x.id === id); if (!tk) throw fail(404, 'Not found');
    const at = new Date().toISOString();
    tk.messages.push({ at, from: 'team', by: (me.name || 'QR-Codex').split(' ')[0], text }); tk.messages = tk.messages.slice(-50); tk.status = 'answered'; tk.updatedAt = at;
    await save(this.db, list);
    const owner = await this.db.getUser(tk.userId).catch(() => null);
    if (owner) this.mailer.sendTicketReply(owner, tk.email, tk.id, text).catch((e) => console.error('Antwoord op vraag mailen mislukt:', e.message));
    await this.db.addAdminLog({ adminId: me.id, adminName: me.name || me.email, action: 'ticket_reply', codeId: null, ownerId: tk.userId, detail: '#' + tk.id }).catch(() => {});
    return { tickets: list };
  }

  @Patch('admin/tickets/:id')
  @UseGuards(TeamOnly)
  async status(@Param('id') id: string, @Body() b: any = {}) {
    if (!['open', 'answered', 'closed'].includes(b.status)) throw fail(400, 'status');
    const list = await readTickets(this.db), tk = list.find((x) => x.id === id); if (!tk) throw fail(404, 'Not found');
    tk.status = b.status; tk.updatedAt = new Date().toISOString(); await save(this.db, list);
    return { tickets: list };
  }
}
