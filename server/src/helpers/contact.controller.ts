/* =========================================================
   CONTACT  (POST /api/contact)
   Het contactformulier: het bericht gaat per e-mail naar het team (CONTACT_EMAIL).
   Zonder mailserver staat het in de serverlog. Alleen voor ingelogde gebruikers, met een limiet.
   ========================================================= */
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { MailerService } from '../auth/mailer.service';
import { EMAIL } from '../qr-codes/validation';
import { fail } from '../common/http';
import type { User } from '../types';
import { DatabaseService } from '../database/database.service';
import { addTicket } from './tickets.controller';

export const CONTACT_TOPICS = ['problem', 'billing', 'idea', 'other'];   // zoals de KB (Q179): Bugs & technical issues, Invoice and payment, Feedback or suggestions, Other

@Controller('api')
@UseGuards(LoggedIn)
export class ContactController {
  constructor(private readonly auth: AuthService, private readonly mailer: MailerService, private readonly db: DatabaseService) {}

  @Post('contact')
  @HttpCode(200)
  async contact(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (this.auth.limited('contact:' + user.id, 5, 60) || this.auth.limited('contact:' + req.ip, 20, 60)) throw fail(429, 'too_many');
    const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 254);
    const topic = CONTACT_TOPICS.includes(b.topic) ? b.topic : '';
    const message = String(b.message || '').replace(/\r\n/g, '\n').trim().slice(0, 4000);
    const errors = [!name && 'name', !EMAIL.test(email) && 'email', !topic && 'topic', message.length < 10 && 'message'].filter(Boolean);
    if (errors.length) throw fail(400, 'Invalid message', { details: errors });
    const tk = await addTicket(this.db, user, { name, email, topic, message });          // ook als vraag in "Mijn vragen"
    await this.mailer.sendContact({ name, email, topic: topic + ' #' + tk.id, message, account: user.email })
      .catch((e) => { console.error('Contactbericht versturen mislukt:', e.message); });   // staat al bewaard: het team ziet het in Beheer
    return { ok: true, ticket: tk };
  }
}
