/* =========================================================
   E-MAIL (account bevestigen, wachtwoord vergeten)
   Stel een mailserver in met SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS en MAIL_FROM.
   Zonder mailserver (ontwikkelen): de link verschijnt in de serverlog.
   Teksten in de taal van de gebruiker (public/locales/*.json, sleutel "mail").
   ========================================================= */
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import { PATHS } from '../config/env';

const LANGS = ['nl', 'en', 'de', 'es', 'fr', 'it', 'pl', 'pt', 'el', 'sq'];
const esc = (s: string) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
type Kind = 'verify' | 'reset' | 'invite';

@Injectable()
export class MailerService {
  private readonly transport = process.env.SMTP_HOST ? nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587), secure: +(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  }) : null;
  private readonly text: Record<string, Record<string, string>> = {};

  constructor() {
    for (const l of LANGS) { try { this.text[l] = JSON.parse(fs.readFileSync(path.join(PATHS.locales, l + '.json'), 'utf8')).mail; } catch (e) { /* taal ontbreekt */ } }
  }

  get configured() { return !!this.transport; }
  sendVerify(to: string, link: string, lang: string) { return this.send('verify', to, link, lang); }
  sendReset(to: string, link: string, lang: string) { return this.send('reset', to, link, lang); }
  sendInvite(to: string, link: string, lang: string) { return this.send('invite', to, link, lang); }

  /** Contactformulier: bericht naar het team (CONTACT_EMAIL, anders MAIL_FROM); antwoorden gaat naar de afzender */
  async sendContact(m: { name: string; email: string; topic: string; message: string; account: string }) {
    const to = process.env.CONTACT_EMAIL || (process.env.MAIL_FROM || '').replace(/^.*<|>.*$/g, '');
    const body = 'Van: ' + m.name + ' <' + m.email + '>\nAccount: ' + m.account + '\nOnderwerp: ' + m.topic + '\n\n' + m.message;
    if (!this.transport || !to) { console.log('[e-mail niet ingesteld] Contactformulier:\n' + body.replace(/^/gm, '  ')); return; }
    await this.transport.sendMail({ from: process.env.MAIL_FROM || 'Optimasys QR <no-reply@optimasys.com>', to, replyTo: m.name + ' <' + m.email + '>',
      subject: '[Optimasys QR] ' + m.topic + ': ' + m.message.slice(0, 60).replace(/\s+/g, ' '), text: body });
  }

  private async send(kind: Kind, to: string, link: string, lang: string) {
    const t = { ...this.text.en, ...this.text[lang] };
    if (!this.transport) { console.log('[e-mail niet ingesteld] ' + ({ verify: 'Bevestigingslink', reset: 'Wachtwoord-link', invite: 'Uitnodiging' }[kind]) + ' voor ' + to + ':\n  ' + link); return; }
    await this.transport.sendMail({
      from: process.env.MAIL_FROM || 'Optimasys QR <no-reply@optimasys.com>', to, subject: t[kind + 'Subject'],
      text: (t[kind + 'Hello'] || t.resetHello) + '\n\n' + t[kind + 'Text'] + '\n' + link + '\n\n' + t[kind + 'Ignore'],
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px">' +
        '<p>' + esc(t[kind + 'Hello'] || t.resetHello) + '</p><p>' + esc(t[kind + 'Text']) + '</p>' +
        '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t[kind + 'Button']) + '</a></p>' +
        '<p style="color:#555;font-size:14px">' + esc(t[kind + 'Ignore']) + '</p></div>',
    });
  }
}
