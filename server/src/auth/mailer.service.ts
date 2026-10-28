/* =========================================================
   E-MAIL (account bevestigen, wachtwoord vergeten)
   Stel een mailserver in met SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS en MAIL_FROM.
   Zonder mailserver (ontwikkelen): de link verschijnt in de serverlog.
   Teksten in de taal van de gebruiker (public/locales/*.json, sleutel "mail").
   ========================================================= */
import { platform, teamEmail } from '../platform';
import { sign } from '../database/secret';
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import { PATHS } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { overridesOf, LANGS } from '../helpers/i18n-overrides';
import type { ReportData } from '../reports';
import type { User } from '../types';

const esc = (s: string) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
type Kind = 'verify' | 'reset' | 'invite' | 'teamInvite' | 'emailChange' | 'emailChanged' | 'exists';

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
  /** Iemand maakte een account met een adres dat al een account heeft: geen nieuw account, wel een mail (zonder te verraden dat het adres bestaat) */
  sendExists(to: string, link: string, lang: string) { return this.send('exists', to, link, lang); }
  sendInvite(to: string, link: string, lang: string) { return this.send('invite', to, link, lang); }
  /** Uitnodiging voor een team (Business): {name} = wie uitnodigt */
  sendTeamInvite(to: string, link: string, lang: string, name: string) { return this.send('teamInvite', to, link, lang, { name }); }
  /** Link naar het nieuwe adres om de wijziging te bevestigen */
  sendEmailChange(to: string, link: string, lang: string) { return this.send('emailChange', to, link, lang); }
  /** Melding naar het oude adres (geen knop): niet jij? neem contact op */
  sendEmailChanged(to: string, newEmail: string, lang: string) { return this.send('emailChanged', to, '', lang, { email: newEmail }); }

  /** Contactformulier: bericht naar het team (CONTACT_EMAIL, anders MAIL_FROM); antwoorden gaat naar de afzender */
  async sendContact(m: { name: string; email: string; topic: string; message: string; account: string }) {
    const to = await teamEmail(this.db);
    const body = 'Van: ' + m.name + ' <' + m.email + '>\nAccount: ' + m.account + '\nOnderwerp: ' + m.topic + '\n\n' + m.message;
    if (!this.transport || !to) { console.log('[e-mail niet ingesteld] Contactformulier:\n' + body.replace(/^/gm, '  ')); return; }
    await this.transport.sendMail({ from: process.env.MAIL_FROM || 'QR-Codex <no-reply@optimasys.com>', to, replyTo: m.name + ' <' + m.email + '>',
      subject: '[QR-Codex] ' + m.topic + ': ' + m.message.slice(0, 60).replace(/\s+/g, ' '), text: body });
  }

  /** Antwoord van het team op een supportvraag */
  async sendTicketReply(user: User, to: string, id: string, text: string) {
    const t = await this.texts(user.lang || 'en'), subject = String(t.ticketSubject || 'Reply to your question').replace('{id}', id);
    const link = (this.base() || '') + '/?go=contact';
    if (!this.transport) { console.log('[e-mail niet ingesteld] Antwoord op vraag #' + id + ' voor ' + to); return; }
    await this.transport.sendMail({ from: this.from(), to, subject, text: text + '\n\n' + link,
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:520px">' + this.logoHtml() +
        '<h1 style="font-size:21px;margin:0 0 10px">' + esc(subject) + '</h1><div style="white-space:pre-wrap;background:#f4f6f9;border-radius:10px;padding:14px 16px">' + esc(text) + '</div>' +
        '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0772ad;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.ticketButton || 'View in the app') + '</a></p></div>' });
  }

  /** Scanmelding: eerste scan van een code of een mijlpaal (100, 1.000, …). Uit te zetten in Mijn account > Meldingen */
  async sendScanAlert(user: User, code: { id: string; name: string; scans: number }, kind: 'first' | 'milestone' | 'target') {
    const t = await this.texts(user.lang || 'en'), loc = LANGS.includes(user.lang || '') ? user.lang : 'en';
    const n = new Intl.NumberFormat(loc).format(code.scans), v = (s: string) => String(s || '').replace(/\{name\}/g, code.name).replace(/\{n\}/g, n);
    const subject = v(kind === 'first' ? t.scanFirstSubject : kind === 'target' ? t.scanTargetSubject : t.scanMilestoneSubject), body = v(kind === 'first' ? t.scanFirstText : kind === 'target' ? t.scanTargetText : t.scanMilestoneText);
    const link = (this.base() || '') + '/?go=myCodes';
    if (!this.transport) { console.log('[e-mail niet ingesteld] Scanmelding voor ' + user.email + ': ' + subject); return; }
    await this.transport.sendMail({ from: this.from(), to: user.email, subject, text: body + '\n\n' + link + '\n\n' + t.scanFooter,
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px">' + this.logoHtml() +
        '<h1 style="font-size:21px;margin:0 0 10px">' + esc(subject) + '</h1><p>' + esc(body) + '</p>' +
        '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.scanButton) + '</a></p>' +
        '<p style="color:#5a6577;font-size:13px;margin-top:20px">' + esc(t.scanFooter) + '</p></div>' });
  }

  /** Een code wordt niet meer (of veel minder) gescand (quiet-alerts.ts) */
  async sendQuiet(user: User, code: { id: string; name: string }, q: { kind: 'stopped' | 'drop'; before: number; now: number; pct: number }) {
    const t = await this.texts(user.lang || 'en'), loc = LANGS.includes(user.lang || '') ? user.lang : 'en', f = (n: number) => new Intl.NumberFormat(loc).format(n);
    const v = (s: string) => String(s || '').replace(/\{name\}/g, code.name).replace(/\{before\}/g, f(q.before)).replace(/\{now\}/g, f(q.now)).replace(/\{pct\}/g, String(q.pct));
    const K = q.kind === 'stopped' ? 'quietStopped' : 'quietDrop', subject = v(t[K + 'Subject']), body = v(t[K + 'Text']), tip = t.quietTip || '';
    const link = (this.base() || '') + '/?go=myCodes';
    if (!this.transport) { console.log('[e-mail niet ingesteld] Stil-melding voor ' + user.email + ': ' + subject); return; }
    await this.transport.sendMail({ from: this.from(), to: user.email, subject, text: body + '\n\n' + tip + '\n\n' + link + '\n\n' + t.quietFooter,
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px">' + this.logoHtml() +
        '<h1 style="font-size:21px;margin:0 0 10px">' + esc(subject) + '</h1><p>' + esc(body) + '</p>' + (tip ? '<p style="color:#5a6577">' + esc(tip) + '</p>' : '') +
        '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.scanButton) + '</a></p>' +
        '<p style="color:#5a6577;font-size:13px;margin-top:20px">' + esc(t.quietFooter) + '</p></div>' });
  }

  /** Health check: de link van een QR-code werkt niet meer (één keer per keer dat hij stukgaat) */
  async sendLinkDown(user: User, code: { id: string; name: string }, url: string) {
    const t = await this.texts(user.lang || 'en'), v = (s: string) => String(s || '').replace(/\{name\}/g, code.name).replace(/\{url\}/g, url);
    const subject = v(t.linkDownSubject), body = v(t.linkDownText), link = (this.base() || '') + '/#/codes';
    if (!this.transport) { console.log('[e-mail niet ingesteld] Link werkt niet voor ' + user.email + ': ' + subject); return; }
    await this.transport.sendMail({ from: this.from(), to: user.email, subject, text: body + '\n\n' + link + '\n\n' + t.linkDownFooter,
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px">' + this.logoHtml() +
        '<h1 style="font-size:21px;margin:0 0 10px">' + esc(subject) + '</h1><p>' + esc(body) + '</p>' +
        '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.linkDownButton) + '</a></p>' +
        '<p style="color:#5a6577;font-size:13px;margin-top:20px">' + esc(t.linkDownFooter) + '</p></div>' });
  }

  /** Testmail vanuit Beheer > Instellingen > E-mail: werkt de mailserver? (gooit een fout als het niet lukt) */
  async sendTest(to: string) {
    if (!this.transport) throw new Error('not_configured');
    await this.transport.sendMail({ from: this.from(), to, subject: 'QR-Codex: test e-mail', text: 'Deze test-e-mail komt van QR-Codex (' + (this.base() || 'server') + '). De mailserver werkt.\n\nThis test email was sent from QR-Codex. Your mail server works.' });
  }
  /** Melding aan het team: veel serverfouten in korte tijd (error-alerts.ts) */
  async sendErrorAlert(count: number, lines: string[]) {
    const to = await teamEmail(this.db); if (!to) return;
    const body = count + ' serverfouten in de laatste 15 minuten / server errors in the last 15 minutes\n\n' + lines.join('\n') + '\n\nBeheer > Instellingen > Status: ' + (this.base() || '') + '/';
    if (!this.transport) { console.log('[e-mail niet ingesteld] Foutmelding: ' + count + ' fouten'); return; }
    await this.transport.sendMail({ from: this.from(), to, subject: '[QR-Codex] ' + count + ' serverfouten in 15 min', text: body });
  }
  /** Melding aan het team: nieuwe klant (aan te zetten in Beheer > Instellingen > Aanmelden) */
  async notifySignup(email: string, name: string, via: string) {
    try {
      if (!(await platform(this.db)).notifySignup) return;
      const to = await teamEmail(this.db); if (!to) return;
      const body = 'Nieuwe klant / New customer\n\n' + (name ? name + ' <' + email + '>' : email) + '\nVia: ' + via + '\n\n' + (this.base() || '') + '/';
      if (!this.transport) { console.log('[e-mail niet ingesteld] Nieuwe klant: ' + email); return; }
      await this.transport.sendMail({ from: this.from(), to, subject: '[QR-Codex] Nieuwe klant: ' + email, text: body });
    } catch (e) { console.error('Melding nieuwe klant mislukt:', (e as Error).message); }
  }

  /** Mailteksten van een taal, met de aanpassingen van admins erover (Beheer > Vertalingen) */
  private async texts(lang: string) {
    const t: Record<string, string> = { ...this.text.en, ...this.text[lang] };
    try { for (const [k, v] of Object.entries(await overridesOf(this.db, LANGS.includes(lang) ? lang : 'en'))) if (k.startsWith('mail.')) t[k.slice(5)] = v; } catch (e) { /* database even weg: standaardtekst */ }
    return t;
  }
  private from() { return process.env.MAIL_FROM || 'QR-Codex <no-reply@optimasys.com>'; }
  private base() { return String(process.env.PUBLIC_URL || '').replace(/\/$/, ''); }

  /** Logo bovenaan de mails (het ronde QR-Codex-logo); zonder PUBLIC_URL gewoon de naam */
  private logoHtml() {
    const b = this.base();
    return b ? '<p style="margin:0 0 10px"><img src="' + esc(b) + '/icons/logo-badge.png" width="64" height="64" alt="QR-Codex" style="display:block"></p>'
      : '<p style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#0b8fd8;font-weight:700;margin:0 0 6px">QR-Codex</p>';
  }

  /** Scanoverzicht: onderwerp + HTML (ook gebruikt voor het voorbeeld in Mijn account) */
  async renderReport(lang: string, user: User, d: ReportData, base?: string) {
    const t = await this.texts(lang), v = (s: string, vars: Record<string, string | number>) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
    const loc = LANGS.includes(lang) && Intl.NumberFormat.supportedLocalesOf([lang]).length ? lang : 'en', num = (n: number) => new Intl.NumberFormat(loc).format(n);
    const fmt = (s: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { ...o, timeZone: 'UTC' }).format(new Date(s + 'T12:00:00Z'));
    const label = d.period === 'monthly' ? fmt(d.range.from, { month: 'long', year: 'numeric' }) : fmt(d.range.from, { day: 'numeric', month: 'short' }) + ' – ' + fmt(d.range.to, { day: 'numeric', month: 'short', year: 'numeric' });
    const pct = d.prevTotal ? Math.round((d.total - d.prevTotal) / d.prevTotal * 100) : null;
    const name = String(user.name || '').trim().split(/\s+/)[0] || '';
    const subject = v(d.period === 'monthly' ? t.reportSubjectMonth : t.reportSubjectWeek, { period: label });
    const link = (base || this.base() || '') + '/', unsub = this.unsubLink(user, base);
    const tile = (n: string, l: string) => '<td style="padding:14px 16px;background:#f1f6fb;border-radius:12px;width:50%"><div style="font-size:28px;font-weight:800;color:#0d1320">' + n + '</div><div style="font-size:13px;color:#5a6577">' + esc(l) + '</div></td>';
    const html = '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:520px">' +
      this.logoHtml() +
      '<h1 style="font-size:22px;margin:0 0 4px">' + esc(subject) + '</h1>' +
      '<p style="margin:0 0 16px;color:#5a6577">' + esc(v(name ? t.reportHello : t.reportHelloPlain, { name })) + '<br>' + esc(t.reportLead) + '</p>' +
      '<table role="presentation" style="width:100%;border-spacing:8px 0;margin:0 -8px 12px"><tr>' + tile(num(d.total), t.reportTotal) + tile(num(d.unique), t.reportUnique) + '</tr></table>' +
      (pct !== null ? '<p style="margin:0 0 16px;color:' + (pct >= 0 ? '#138a52' : '#b91c1c') + ';font-weight:700">' + esc(v(pct >= 0 ? t.reportUp : t.reportDown, { pct: Math.abs(pct) })) + '</p>' : '') +
      (d.top.length ? '<p style="margin:0 0 6px;font-weight:700">' + esc(t.reportTop) + '</p><ol style="margin:0 0 18px;padding-left:20px">' + d.top.map((x) => '<li>' + esc(x.name) + ' <span style="color:#5a6577">– ' + num(x.scans) + '</span></li>').join('') + '</ol>'
        : '<p style="margin:0 0 18px;color:#5a6577">' + esc(t.reportNone) + '</p>') +
      '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.reportButton) + '</a></p>' +
      '<p style="color:#5a6577;font-size:13px;margin-top:20px">' + esc(t.reportFooter) + ' <a href="' + esc(unsub) + '" style="color:#5a6577">' + esc(t.reportUnsub || 'Unsubscribe') + '</a></p></div>';
    const text = subject + '\n\n' + t.reportTotal + ': ' + num(d.total) + '\n' + t.reportUnique + ': ' + num(d.unique) + '\n' + d.top.map((x, i) => (i + 1) + '. ' + x.name + ' – ' + num(x.scans)).join('\n') + '\n\n' + link + '\n\n' + t.reportFooter + '\n' + (t.reportUnsub || 'Unsubscribe') + ': ' + unsub;
    return { subject, html, text };
  }
  /** Afmeldlink voor het scanoverzicht: werkt zonder inloggen, ondertekend zodat niemand anders iemand kan afmelden */
  unsubLink(user: User, base?: string) { return (base || this.base() || '') + '/api/unsubscribe?u=' + encodeURIComponent(user.id) + '&t=' + sign('report:' + user.id); }
  /** Teksten voor de afmeldpagina */
  async pageTexts(lang: string) { return this.texts(lang); }
  async sendReport(user: User, d: ReportData) {
    const r = await this.renderReport(user.lang || 'en', user, d), unsub = this.unsubLink(user);
    if (!this.transport) { console.log('[e-mail niet ingesteld] Scanoverzicht voor ' + user.email + ': ' + r.subject); return; }
    // List-Unsubscribe: de knop "Afmelden" van Gmail/Outlook (RFC 8058: met één klik, zonder pagina)
    await this.transport.sendMail({ from: this.from(), to: user.email, subject: r.subject, text: r.text, html: r.html,
      headers: { 'List-Unsubscribe': '<' + unsub + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
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

  /** Abonnement verlopen: start van de bedenktijd, nog 7 dagen, nog 1 dag, codes verwijderd (regels: subscription.ts) */
  async sendLapse(user: User, kind: 'start' | 'week' | 'day' | 'deleted', until: number | null) {
    const t = await this.texts(user.lang || 'en'), K = 'lapse' + kind[0].toUpperCase() + kind.slice(1);
    const loc = LANGS.includes(user.lang) && Intl.DateTimeFormat.supportedLocalesOf([user.lang]).length ? user.lang : 'en';
    const date = until ? new Intl.DateTimeFormat(loc, { dateStyle: 'long', timeStyle: 'short', timeZone: user.timezone || 'Europe/Madrid' }).format(new Date(until)) : '';
    const name = String(user.name || '').trim().split(/\s+/)[0] || '';
    const body = String(t[K + 'Text'] || '').replace(/\{date\}/g, date), hello = name ? String(t.reportHello || 'Hello {name},').replace('{name}', name) : t.reportHelloPlain || 'Hello,';
    const link = (this.base() || '') + '/?go=plan';
    if (!this.transport) { console.log('[e-mail niet ingesteld] Abonnement (' + kind + ') voor ' + user.email + ': ' + body); return; }
    await this.transport.sendMail({ from: this.from(), to: user.email, subject: t[K + 'Subject'], text: hello + '\n\n' + body + (kind !== 'deleted' ? '\n\n' + link : ''),
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px"><p>' + esc(hello) + '</p><p>' + esc(body) + '</p>' +
        (kind !== 'deleted' ? '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.lapseButton || 'Renew') + '</a></p>' : '') + '</div>' });
  }

  /** Herinnering 3 dagen vooraf: opgezegd abonnement stopt ('end') of de gratis proef stopt en de eerste betaling volgt ('trial') */
  async sendReminder(user: User, kind: 'end' | 'trial' | 'renew', until: number, amount: number | null) {
    const t = await this.texts(user.lang || 'en'), K = kind === 'end' ? 'remindEnd' : kind === 'renew' ? 'remindRenew' : 'remindTrial';
    const loc = LANGS.includes(user.lang) && Intl.DateTimeFormat.supportedLocalesOf([user.lang]).length ? user.lang : 'en';
    const date = new Intl.DateTimeFormat(loc, { dateStyle: 'long', timeZone: user.timezone || 'Europe/Madrid' }).format(new Date(until));
    const money = amount == null ? '' : new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR' }).format(amount);
    const name = String(user.name || '').trim().split(/\s+/)[0] || '';
    const body = String(t[K + 'Text'] || '').replace(/\{date\}/g, date).replace(/\{amount\}/g, money), hello = name ? String(t.reportHello || 'Hello {name},').replace('{name}', name) : t.reportHelloPlain || 'Hello,';
    const link = (this.base() || '') + '/?go=plan';
    if (!this.transport) { console.log('[e-mail niet ingesteld] Herinnering (' + kind + ') voor ' + user.email + ': ' + body); return; }
    await this.transport.sendMail({ from: this.from(), to: user.email, subject: t[K + 'Subject'], text: hello + '\n\n' + body + '\n\n' + link,
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px"><p>' + esc(hello) + '</p><p>' + esc(body) + '</p>' +
        '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.cancelButton || 'My plan') + '</a></p></div>' });
  }

  /** Abonnement opgezegd (Stripe): bevestiging, loopt nog tot {date} (Terms punt 5) */
  async sendCancelled(user: User, until: number, trial = false) {
    const t = await this.texts(user.lang || 'en');
    const loc = LANGS.includes(user.lang) && Intl.DateTimeFormat.supportedLocalesOf([user.lang]).length ? user.lang : 'en';
    const date = new Intl.DateTimeFormat(loc, { dateStyle: 'long', timeZone: user.timezone || 'Europe/Madrid' }).format(new Date(until));
    const name = String(user.name || '').trim().split(/\s+/)[0] || '';
    const body = String((trial && t.cancelTrialText) || t.cancelText || '').replace(/\{date\}/g, date), hello = name ? String(t.reportHello || 'Hello {name},').replace('{name}', name) : t.reportHelloPlain || 'Hello,';
    const link = (this.base() || '') + '/?go=plan';
    if (!this.transport) { console.log('[e-mail niet ingesteld] Opgezegd voor ' + user.email + ': ' + body); return; }
    await this.transport.sendMail({ from: this.from(), to: user.email, subject: t.cancelSubject, text: hello + '\n\n' + body + '\n\n' + link,
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px"><p>' + esc(hello) + '</p><p>' + esc(body) + '</p>' +
        '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.cancelButton || 'My plan') + '</a></p></div>' });
  }

  /** Overgezette QR-code: het account bij de oude QR-app loopt (bijna) af, dan werkt de geprinte code niet meer */
  async sendLegacyDue(user: User, codeName: string, oldUrl: string, until: string, over: boolean) {
    const t = await this.texts(user.lang || 'en'), K = over ? 'legacyOver' : 'legacySoon';
    const loc = LANGS.includes(user.lang) && Intl.DateTimeFormat.supportedLocalesOf([user.lang]).length ? user.lang : 'en';
    const date = new Intl.DateTimeFormat(loc, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(until + 'T00:00:00Z'));
    let host = oldUrl; try { host = new URL(oldUrl).hostname.replace(/^www\./, ''); } catch (e) { /* zoals het is */ }
    host = ({ 'scan.page': 'qr-code.io' } as Record<string, string>)[host] || host;
    const name = String(user.name || '').trim().split(/\s+/)[0] || '';
    const fill = (x: any) => String(x || '').replace(/\{date\}/g, date).replace(/\{host\}/g, host).replace(/\{code\}/g, codeName || host);
    const body = fill(t[K + 'Text']), hello = name ? String(t.reportHello || 'Hello {name},').replace('{name}', name) : t.reportHelloPlain || 'Hello,';
    const link = (this.base() || '') + '/?go=myCodes';
    if (!this.transport) { console.log('[e-mail niet ingesteld] Oude QR-app (' + (over ? 'verlopen' : 'bijna') + ') voor ' + user.email + ': ' + body); return; }
    await this.transport.sendMail({ from: this.from(), to: user.email, subject: fill(t[K + 'Subject']), text: hello + '\n\n' + body + '\n\n' + link,
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px"><p>' + esc(hello) + '</p><p>' + esc(body) + '</p>' +
        '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(fill(t.legacyButton) || 'My QR codes') + '</a></p></div>' });
  }

  private async send(kind: Kind, to: string, link: string, lang: string, vars: Record<string, string> = {}) {
    const t = await this.texts(lang);
    for (const k of Object.keys(t)) t[k] = String(t[k]).replace(/\{(\w+)\}/g, (m, v) => (vars[v] != null ? vars[v] : m));
    if (!this.transport) { console.log('[e-mail niet ingesteld] ' + ({ verify: 'Bevestigingslink', reset: 'Wachtwoord-link', invite: 'Uitnodiging', emailChange: 'Nieuw e-mailadres bevestigen', emailChanged: 'Melding e-mail gewijzigd', exists: 'Melding: er is al een account' } as any)[kind] + ' voor ' + to + ':\n  ' + (link || vars.email || '')); return; }
    await this.transport.sendMail({
      from: process.env.MAIL_FROM || 'QR-Codex <no-reply@optimasys.com>', to, subject: t[kind + 'Subject'],
      text: (t[kind + 'Hello'] || t.resetHello) + '\n\n' + t[kind + 'Text'] + '\n' + (link ? link + '\n' : '') + '\n' + t[kind + 'Ignore'],
      html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px">' +
        '<p>' + esc(t[kind + 'Hello'] || t.resetHello) + '</p><p>' + esc(t[kind + 'Text']) + '</p>' +
        (link ? '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t[kind + 'Button']) + '</a></p>' : '') +
        '<p style="color:#555;font-size:14px">' + esc(t[kind + 'Ignore']) + '</p></div>',
    });
  }
}
