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
import { DatabaseService } from '../database/database.service';
import { overridesOf } from '../helpers/i18n-overrides';
import type { ReportData } from '../reports';
import type { User } from '../types';

const LANGS = ['nl', 'en', 'de', 'es', 'fr', 'it', 'pl', 'pt', 'el', 'sq'];
const esc = (s: string) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
type Kind = 'verify' | 'reset' | 'invite' | 'emailChange' | 'emailChanged';

@Injectable()
export class MailerService {
  private readonly transport = process.env.SMTP_HOST ? nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587), secure: +(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  }) : null;
  private readonly text: Record<string, Record<string, string>> = {};

  constructor(private readonly db: DatabaseService) {
    for (const l of LANGS) { try { this.text[l] = JSON.parse(fs.readFileSync(path.join(PATHS.locales, l + '.json'), 'utf8')).mail; } catch (e) { /* taal ontbreekt */ } }
  }

  get configured() { return !!this.transport; }
  sendVerify(to: string, link: string, lang: string) { return this.send('verify', to, link, lang); }
  sendReset(to: string, link: string, lang: string) { return this.send('reset', to, link, lang); }
  sendInvite(to: string, link: string, lang: string) { return this.send('invite', to, link, lang); }
  /** Link naar het nieuwe adres om de wijziging te bevestigen */
  sendEmailChange(to: string, link: string, lang: string) { return this.send('emailChange', to, link, lang); }
  /** Melding naar het oude adres (geen knop): niet jij? neem contact op */
  sendEmailChanged(to: string, newEmail: string, lang: string) { return this.send('emailChanged', to, '', lang, { email: newEmail }); }

  /** Contactformulier: bericht naar het team (CONTACT_EMAIL, anders MAIL_FROM); antwoorden gaat naar de afzender */
  async sendContact(m: { name: string; email: string; topic: string; message: string; account: string }) {
    const to = process.env.CONTACT_EMAIL || (process.env.MAIL_FROM || '').replace(/^.*<|>.*$/g, '');
    const body = 'Van: ' + m.name + ' <' + m.email + '>\nAccount: ' + m.account + '\nOnderwerp: ' + m.topic + '\n\n' + m.message;
    if (!this.transport || !to) { console.log('[e-mail niet ingesteld] Contactformulier:\n' + body.replace(/^/gm, '  ')); return; }
    await this.transport.sendMail({ from: process.env.MAIL_FROM || 'Optimasys QR <no-reply@optimasys.com>', to, replyTo: m.name + ' <' + m.email + '>',
      subject: '[Optimasys QR] ' + m.topic + ': ' + m.message.slice(0, 60).replace(/\s+/g, ' '), text: body });
  }

  /** Mailteksten van een taal, met de aanpassingen van admins erover (Beheer > Vertalingen) */
  private async texts(lang: string) {
    const t: Record<string, string> = { ...this.text.en, ...this.text[lang] };
    try { for (const [k, v] of Object.entries(await overridesOf(this.db, LANGS.includes(lang) ? lang : 'en'))) if (k.startsWith('mail.')) t[k.slice(5)] = v; } catch (e) { /* database even weg: standaardtekst */ }
    return t;
  }
  private from() { return process.env.MAIL_FROM || 'Optimasys QR <no-reply@optimasys.com>'; }
  private base() { return String(process.env.PUBLIC_URL || '').replace(/\/$/, ''); }

  /** Scanoverzicht: onderwerp + HTML (ook gebruikt voor het voorbeeld in Mijn account) */
  async renderReport(lang: string, user: User, d: ReportData, base?: string) {
    const t = await this.texts(lang), v = (s: string, vars: Record<string, string | number>) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
    const loc = LANGS.includes(lang) && lang !== 'sq' ? lang : 'en', num = (n: number) => new Intl.NumberFormat(loc).format(n);
    const fmt = (s: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { ...o, timeZone: 'UTC' }).format(new Date(s + 'T12:00:00Z'));
    const label = d.period === 'monthly' ? fmt(d.range.from, { month: 'long', year: 'numeric' }) : fmt(d.range.from, { day: 'numeric', month: 'short' }) + ' – ' + fmt(d.range.to, { day: 'numeric', month: 'short', year: 'numeric' });
    const pct = d.prevTotal ? Math.round((d.total - d.prevTotal) / d.prevTotal * 100) : null;
    const name = String(user.name || '').trim().split(/\s+/)[0] || '';
    const subject = v(d.period === 'monthly' ? t.reportSubjectMonth : t.reportSubjectWeek, { period: label });
    const link = (base || this.base() || '') + '/';
    const tile = (n: string, l: string) => '<td style="padding:14px 16px;background:#f1f6fb;border-radius:12px;width:50%"><div style="font-size:28px;font-weight:800;color:#0d1320">' + n + '</div><div style="font-size:13px;color:#5a6577">' + esc(l) + '</div></td>';
    const html = '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:520px">' +
      '<p style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#0b8fd8;font-weight:700;margin:0 0 6px">Optimasys QR</p>' +
      '<h1 style="font-size:22px;margin:0 0 4px">' + esc(subject) + '</h1>' +
      '<p style="margin:0 0 16px;color:#5a6577">' + esc(v(name ? t.reportHello : t.reportHelloPlain, { name })) + '<br>' + esc(t.reportLead) + '</p>' +
      '<table role="presentation" style="width:100%;border-spacing:8px 0;margin:0 -8px 12px"><tr>' + tile(num(d.total), t.reportTotal) + tile(num(d.unique), t.reportUnique) + '</tr></table>' +
      (pct !== null ? '<p style="margin:0 0 16px;color:' + (pct >= 0 ? '#138a52' : '#b91c1c') + ';font-weight:700">' + esc(v(pct >= 0 ? t.reportUp : t.reportDown, { pct: Math.abs(pct) })) + '</p>' : '') +
      (d.top.length ? '<p style="margin:0 0 6px;font-weight:700">' + esc(t.reportTop) + '</p><ol style="margin:0 0 18px;padding-left:20px">' + d.top.map((x) => '<li>' + esc(x.name) + ' <span style="color:#5a6577">– ' + num(x.scans) + '</span></li>').join('') + '</ol>'
        : '<p style="margin:0 0 18px;color:#5a6577">' + esc(t.reportNone) + '</p>') +
      '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.reportButton) + '</a></p>' +
      '<p style="color:#5a6577;font-size:13px;margin-top:20px">' + esc(t.reportFooter) + '</p></div>';
    const text = subject + '\n\n' + t.reportTotal + ': ' + num(d.total) + '\n' + t.reportUnique + ': ' + num(d.unique) + '\n' + d.top.map((x, i) => (i + 1) + '. ' + x.name + ' – ' + num(x.scans)).join('\n') + '\n\n' + link + '\n\n' + t.reportFooter;
    return { subject, html, text };
  }
  async sendReport(user: User, d: ReportData) {
    const r = await this.renderReport(user.lang || 'en', user, d);
    if (!this.transport) { console.log('[e-mail niet ingesteld] Scanoverzicht voor ' + user.email + ': ' + r.subject); return; }
    await this.transport.sendMail({ from: this.from(), to: user.email, subject: r.subject, text: r.text, html: r.html });
  }
  /** Beveiligingsmelding: nieuw apparaat of wachtwoord gewijzigd */
  async sendSecurity(user: User, kind: 'login' | 'password', info: { device?: string; ip?: string; time: string }) {
    if (user.emailPrefs && user.emailPrefs.security === false) return;
    const t = await this.texts(user.lang || 'en'), v = (s: string) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => ((info as any)[k] != null ? (info as any)[k] : m));
    const subject = kind === 'login' ? t.secLoginSubject : t.secPasswordSubject, body = v(kind === 'login' ? t.secLoginText : t.secPasswordText), link = (this.base() || '') + '/';
    if (!this.transport) { console.log('[e-mail niet ingesteld] Beveiligingsmelding voor ' + user.email + ': ' + body); return; }
    await this.transport.sendMail({ from: this.from(), to: user.email, subject, text: body + '\n\n' + t.secNotYou + '\n' + link,
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px"><p>' + esc(body) + '</p><p>' + esc(t.secNotYou) + '</p>' +
        '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.secButton) + '</a></p></div>' });
  }

  private async send(kind: Kind, to: string, link: string, lang: string, vars: Record<string, string> = {}) {
    const t = await this.texts(lang);
    for (const k of Object.keys(t)) t[k] = String(t[k]).replace(/\{(\w+)\}/g, (m, v) => (vars[v] != null ? vars[v] : m));
    if (!this.transport) { console.log('[e-mail niet ingesteld] ' + ({ verify: 'Bevestigingslink', reset: 'Wachtwoord-link', invite: 'Uitnodiging', emailChange: 'Nieuw e-mailadres bevestigen', emailChanged: 'Melding e-mail gewijzigd' }[kind]) + ' voor ' + to + ':\n  ' + (link || vars.email || '')); return; }
    await this.transport.sendMail({
      from: process.env.MAIL_FROM || 'Optimasys QR <no-reply@optimasys.com>', to, subject: t[kind + 'Subject'],
      text: (t[kind + 'Hello'] || t.resetHello) + '\n\n' + t[kind + 'Text'] + '\n' + (link ? link + '\n' : '') + '\n' + t[kind + 'Ignore'],
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px">' +
        '<p>' + esc(t[kind + 'Hello'] || t.resetHello) + '</p><p>' + esc(t[kind + 'Text']) + '</p>' +
        (link ? '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t[kind + 'Button']) + '</a></p>' : '') +
        '<p style="color:#555;font-size:14px">' + esc(t[kind + 'Ignore']) + '</p></div>',
    });
  }
}
