/* =========================================================
   BEHEER (alleen voor het team: SUPPORT_EMAIL, ADMIN_EMAILS en wie de super-admin admin heeft gemaakt)
   GET    /api/admin/overview              tellers, scans per dag (30 dagen), types, top-codes, nieuwste accounts
   GET    /api/admin/codes                 alle QR-codes van iedereen: zoeken, filters (combineerbaar), sorteren, pagina's
   GET    /api/admin/codes/:id             één code met alles: eigenaar + abonnement, bestemming, controles, logboek
   PATCH  /api/admin/codes/:id             { paused, reason, lock } | { flag, reason } | { name, content } (bewerken)
   POST   /api/admin/codes/:id/duplicate   kopie in het account van de eigenaar
   GET    /api/admin/codes/:id/check       bestemming controleren (bestaat de website, welke status?)
   DELETE /api/admin/codes/:id             verwijderen (met statistieken en bestanden; de link komt nooit meer terug)
   POST   /api/admin/codes/bulk            { ids, action: pause | resume | delete, reason, lock }
   POST   /api/admin/codes/export          CSV van de gefilterde of geselecteerde codes
   GET    /api/admin/log                   logboek van het beheer (wie deed wat, wanneer)
   Rechten: elke admin mag codes van klanten (en zijn eigen) aanpassen. Codes van andere teamleden (admins, super-admin)
   alleen de super-admin. Bekijken mag iedereen in het team. Elke aanpassing komt in het logboek.
   Klanten zelf (toevoegen, uitnodigen, rol, uitzetten): auth/admin.controller.ts
   ========================================================= */
import { platform, forgetPlatform } from '../platform';
import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Customer, DatabaseService, Moderation } from '../database/database.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { TeamOnly } from '../auth/admin.controller';
import { AuthService } from '../auth/auth.service';
import { QrCodesService, cleanName, freshCodeId, secretKey } from './qr-codes.service';
import { QR_TYPES, validateQrCode } from './validation';
import { STATIC, destinationOf, patternSince, problemOf, riskOf, scanPattern } from './moderation';
import { urlInfo } from '../helpers/url-check';
import { planFor, usage } from '../plans';
import { fail, recentErrors } from '../common/http';
import { MailerService } from '../auth/mailer.service';
import { addBlock, isBlocked, listBlocks, normBlock, removeBlock } from '../auth/blocklist';
import type { QrCode, User } from '../types';

const SIZES = [10, 25, 50, 100];
const SORTS = ['new', 'old', 'scans', 'recent', 'name', 'updated'];
const ACTIONS = ['pause', 'resume', 'delete'];
const MAX_BULK = 500;
const EDITABLE = [undefined, 'url', 'email', 'tel', 'date', 'number', 'select'];     // velden die het team hier mag aanpassen (geen bestanden/foto's)
const day = (d: Date) => d.toISOString().slice(0, 10);
const reasonOf = (v: unknown) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 300);
type Owner = { id: string; name: string; email: string; level: 'super' | 'admin' | 'user'; codes: number };

/** Grote afbeeldingen (data-URL's) en wifi-wachtwoorden gaan niet mee naar het overzicht */
function slim(content: Record<string, any>, contentType: string) {
  const c: Record<string, any> = {};
  for (const [k, v] of Object.entries(content || {})) {
    if (typeof v === 'string' && v.length > 1000 && /^data:|"d":"data:/.test(v)) continue;
    c[k] = v;
  }
  if (contentType === 'wifi') delete c.password;
  return c;
}
/** Waar zoeken we in? Naam, id, type (ook de vertaalde naam via de client), link en korte teksten uit de inhoud, eigenaar */
function haystack(q: QrCode, owner: Owner | undefined) {
  const c = q.content || {}, parts = [q.id, q.name, q.typeId, owner && owner.name, owner && owner.email];
  for (const [k, v] of Object.entries(c)) if (typeof v === 'string' && v.length < 300 && !/^[[{]/.test(v) && k !== 'password') parts.push(v);
  return parts.filter(Boolean).join(' ').toLowerCase();
}
/** CSV-veld: tussen aanhalingstekens; begint het met = + - @ dan een ' ervoor (anders voert Excel het uit als formule) */
const csv = (v: unknown) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

@Controller('api/admin')
@UseGuards(LoggedIn, TeamOnly)
export class AdminPanelController {
  constructor(private readonly db: DatabaseService, private readonly codes: QrCodesService, private readonly auth: AuthService, private readonly mailer: MailerService) {}

  @Get('overview')
  async overview(@Req() req: Request) {
    const [users, all] = await Promise.all([this.db.listCustomers(), this.db.allQrCodes()]);
    const since = day(new Date(Date.now() - 29 * 864e5)), prev = day(new Date(Date.now() - 59 * 864e5));
    const perDay = await this.db.scansPerDay(prev);
    // 30 dagen, ook dagen zonder scans (0), plus de 30 dagen daarvoor om te vergelijken
    const byDay: Record<string, { scans: number; uniq: number }> = {};
    perDay.forEach((d) => { byDay[d.day] = d; });
    const days: { day: string; scans: number; uniq: number }[] = [];
    for (let i = 29; i >= 0; i--) { const d = day(new Date(Date.now() - i * 864e5)); days.push({ day: d, scans: (byDay[d] || { scans: 0 }).scans, uniq: (byDay[d] || { uniq: 0 }).uniq }); }
    const sum = (from: string, to?: string) => perDay.filter((d) => d.day >= from && (!to || d.day < to)).reduce((n, d) => n + d.scans, 0);
    const byType: Record<string, number> = {};
    all.forEach((q) => { byType[q.typeId] = (byType[q.typeId] || 0) + 1; });
    const owners: Record<string, { name: string; email: string }> = {};
    users.forEach((u) => { owners[u.id] = { name: u.name, email: u.email }; });
    const newSince = (list: { createdAt: string }[], from: string) => list.filter((x) => x.createdAt.slice(0, 10) >= from).length;
    const plans: Record<string, number> = {};
    for (const p of await Promise.all(users.map((u) => planFor(this.db, u.id)))) plans[p.id] = (plans[p.id] || 0) + 1;
    return {
      totals: {
        users: users.length,
        active: users.filter((u) => u.active && !u.disabledAt).length,
        invited: users.filter((u) => !u.active).length,
        disabled: users.filter((u) => u.disabledAt).length,
        admins: users.filter((u) => this.auth.isAdmin(u)).length,
        codes: all.length,
        paused: all.filter((q) => q.paused).length,
        flagged: all.filter((q) => q.moderation && q.moderation.flag).length,
        scans: all.reduce((n, q) => n + (q.scans || 0), 0),
        scans30: sum(since), scansPrev30: sum(prev, since),
        newUsers30: newSince(users, since), newCodes30: newSince(all, since),
      },
      days,
      types: Object.entries(byType).map(([typeId, n]) => ({ typeId, n })).sort((a, b) => b.n - a.n),
      top: all.filter((q) => q.scans > 0).sort((a, b) => b.scans - a.scans).slice(0, 5)
        .map((q) => ({ ...this.row(req, q), owner: owners[q.userId] || null })),
      recentUsers: users.slice(0, 5),
      plans,
    };
  }

  /* ---------------- Instellingen: bedrijfsgegevens en onderhoud ---------------- */
  @Get('settings')
  async getSettings() {
    const j = async (k: string) => { try { return JSON.parse((await this.db.getSetting(k)) || '{}'); } catch (e) { return {}; } };
    const env = (k: string) => String(process.env[k] || '').trim();
    const pf = await platform(this.db);
    return { platform: pf, platformEnv: { signup: process.env.ALLOW_SIGNUP === 'true', contactEmail: env('CONTACT_EMAIL'), mailFrom: env('MAIL_FROM'), mail: this.mailer.configured }, company: await j('company'), companyEnv: { name: env('LEGAL_NAME'), address: env('LEGAL_ADDRESS'), kvk: env('LEGAL_KVK'), vat: env('LEGAL_VAT'), email: env('LEGAL_EMAIL'), phone: env('LEGAL_PHONE'), website: env('LEGAL_WEBSITE') }, maintenance: await j('maintenance') };
  }
  @Patch('settings')
  async saveSettings(@CurrentUser() me: User, @Body() b: any = {}) {
    if (b.company !== undefined) {
      const c = b.company || {}, out: Record<string, string> = {}, bad: string[] = [];
      const LIM: Record<string, number> = { name: 120, address: 240, kvk: 40, vat: 40, email: 254, phone: 40, website: 200 };
      for (const k of Object.keys(LIM)) { const v = String(c[k] || '').replace(/\s+/g, ' ').trim(); if (v.length > LIM[k]) bad.push(k); else if (v) out[k] = v; }
      if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) bad.push('email');
      if (out.website && !/^https?:\/\/[^\s]+$/i.test(out.website)) bad.push('website');
      if (bad.length) throw fail(400, 'Invalid settings', { details: bad });
      await this.db.setSetting('company', Object.keys(out).length ? JSON.stringify(out) : null);
      await this.db.addAdminLog({ adminId: me.id, adminName: me.name || me.email, action: 'settings_company', codeId: null, ownerId: null, detail: out.name || '' }).catch(() => {});
    }
    if (b.platform !== undefined) {
      const x = b.platform || {}, cur = await platform(this.db);
      const signup = x.signup === undefined ? cur.signup : x.signup === 'open' || x.signup === 'closed' ? x.signup : null;
      const contactEmail = x.contactEmail === undefined ? cur.contactEmail : String(x.contactEmail || '').trim().toLowerCase().slice(0, 254);
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw fail(400, 'Invalid settings', { details: ['contactEmail'] });
      const out = { signup, notifySignup: x.notifySignup === undefined ? cur.notifySignup : !!x.notifySignup, contactEmail };
      await this.db.setSetting('platform', JSON.stringify(out)); forgetPlatform();
      await this.db.addAdminLog({ adminId: me.id, adminName: me.name || me.email, action: 'settings_platform', codeId: null, ownerId: null, detail: 'signup: ' + (signup || 'env') + ' · notify: ' + (out.notifySignup ? 'on' : 'off') + (contactEmail ? ' · ' + contactEmail : '') }).catch(() => {});
    }
    if (b.maintenance !== undefined) {
      const on = !!(b.maintenance && b.maintenance.on), message = String((b.maintenance && b.maintenance.message) || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      await this.db.setSetting('maintenance', on || message ? JSON.stringify({ on, message, by: me.name || me.email, at: new Date().toISOString() }) : null);
      this.auth.forgetMaintenance();
      await this.db.addAdminLog({ adminId: me.id, adminName: me.name || me.email, action: on ? 'maintenance_on' : 'maintenance_off', codeId: null, ownerId: null, detail: message }).catch(() => {});
    }
    return this.getSettings();
  }

  /** Testmail naar jezelf: werkt de mailserver? */
  @Post('test-mail')
  @HttpCode(200)
  async testMail(@CurrentUser() me: User) {
    if (!this.mailer.configured) throw fail(400, 'mail_off');
    if (this.auth.limited('testmail:' + me.id, 5, 10)) throw fail(429, 'too_many');
    try { await this.mailer.sendTest(me.email); } catch (e) { throw fail(502, 'mail_failed', { message: String((e as Error).message || '').slice(0, 200) }); }
    return { ok: true, to: me.email };
  }

  /* ---------------- Blokkeerlijst (Terms punt 14): geen nieuw account voor deze adressen/domeinen ---------------- */
  @Get('blocklist')
  async blocklist() {
    const [list, users] = await Promise.all([listBlocks(this.db), this.db.listCustomers()]);
    // Per regel: welke bestaande accounts eronder vallen (die blijven werken tot een admin ze uitzet)
    return { items: await Promise.all(list.map(async (b) => {
      const hits = [];
      for (const u of users) if (await isBlocked({ getSetting: async () => JSON.stringify([b]), setSetting: async () => null }, u.email)) hits.push({ id: u.id, email: u.email, disabled: !!u.disabledAt });
      return { ...b, accounts: hits.slice(0, 20) };
    })) };
  }
  @Post('blocklist')
  @HttpCode(201)
  async block(@CurrentUser() me: User, @Body() b: any = {}) {
    const v = normBlock(b.value); if (!v) throw fail(400, 'block_value');
    const own = String(me.email).toLowerCase();
    if (await isBlocked({ getSetting: async () => JSON.stringify([{ v }]), setSetting: async () => null }, own)) throw fail(400, 'block_self');   // jezelf (of je eigen domein) niet buitensluiten
    const added = await addBlock(this.db, v, b.note, me.name || me.email);
    await this.log(me, 'block_add', null, v + (added.note ? ' · ' + added.note : ''));
    return added;
  }
  @Delete('blocklist')
  @HttpCode(204)
  async unblock(@CurrentUser() me: User, @Query('v') v: string) {
    if (!(await removeBlock(this.db, v))) throw fail(404, 'Not found');
    await this.log(me, 'block_remove', null, normBlock(v));
  }

  /* ---------------- Systeemstatus en aandachtspunten (dashboard) ---------------- */
  @Get('system')
  async system() {
    const t0 = Date.now(); let dbOk = true; try { await this.db.ping(); } catch (e) { dbOk = false; }
    const dbMs = Date.now() - t0;
    const parse = (v: string | null) => { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } };
    const [users, all, totals, lastBackup, failedBackup, deeplStored, log] = await Promise.all([this.db.listCustomers(), this.db.allQrCodes(), this.db.codeTotals(patternSince()),
      this.db.getSetting('backup:last').then(parse), this.db.getSetting('backup:failed').then(parse), this.db.getSetting('deepl_key'), this.db.listAdminLog({ limit: 8 })]);
    const day = new Date(Date.now() - 864e5).toISOString(), errors24 = recentErrors.filter((e) => e.at >= day);
    let risky = 0, problems = 0;
    for (const q of all) { const d = destinationOf(q); if (problemOf(q, d)) problems++; if ((d.value && riskOf(d.value).length) || scanPattern((totals[q.id] || { days: {} }).days).length) risky++; }
    const backupAge = lastBackup ? (Date.now() - new Date(lastBackup.at).getTime()) / 36e5 : null;
    const expiredInvites = users.filter((u) => !u.active && !u.disabledAt && (!u.inviteUntil || u.inviteUntil < new Date().toISOString())).length;
    const warnings: { kind: string; level: 'bad' | 'warn' | 'info'; n?: number; go?: string }[] = [];
    if (!dbOk) warnings.push({ kind: 'db', level: 'bad' });
    if (errors24.length) warnings.push({ kind: 'errors', level: errors24.length >= 5 ? 'bad' : 'warn', n: errors24.length });
    if (failedBackup && (!lastBackup || failedBackup.at > lastBackup.at)) warnings.push({ kind: 'backupFailed', level: 'bad' });
    else if (backupAge == null) warnings.push({ kind: 'backupNone', level: 'warn' });
    else if (backupAge > 36) warnings.push({ kind: 'backupOld', level: 'warn', n: Math.round(backupAge / 24) });
    const flagged = all.filter((q) => q.moderation && q.moderation.flag).length;
    if (flagged) warnings.push({ kind: 'flagged', level: 'bad', n: flagged, go: 'flagged' });
    if (risky) warnings.push({ kind: 'risky', level: 'warn', n: risky, go: 'risky' });
    if (problems) warnings.push({ kind: 'problems', level: 'warn', n: problems, go: 'problem' });
    if (expiredInvites) warnings.push({ kind: 'invites', level: 'info', n: expiredInvites });
    if (!this.mailer.configured) warnings.push({ kind: 'mail', level: 'info' });
    return {
      db: { ok: dbOk, ms: dbMs, kind: this.db.kind }, uptime: Math.round(process.uptime()), node: process.version,
      mail: { configured: this.mailer.configured }, deepl: { configured: !!(process.env.DEEPL_API_KEY || deeplStored) },
      backup: { last: lastBackup, failed: failedBackup },
      errors: { last24h: errors24.length, recent: errors24.slice(0, 5) },
      codes: { active: all.filter((q) => !q.paused).length, paused: all.filter((q) => q.paused).length, held: all.filter((q) => q.moderation && q.moderation.hold).length,
        static: all.filter((q) => STATIC.includes(q.contentType)).length, withoutScans: all.filter((q) => !q.scans && !STATIC.includes(q.contentType)).length },
      warnings, log,
    };
  }

  /* ---------------- Lijst ---------------- */
  @Get('codes')
  async list(@Req() req: Request, @CurrentUser() me: User, @Query() qs: Record<string, string>) {
    const { rows, owners, all, totals } = await this.filtered(qs);
    const size = SIZES.includes(+qs.size) ? +qs.size : 25;
    const page = Math.max(1, parseInt(qs.page, 10) || 1), pages = Math.max(1, Math.ceil(rows.length / size)), p = Math.min(page, pages);
    // Klanten met codes (voor het filter "Klant"), met hun aantal codes
    const people = Object.values(owners).filter((o) => o.codes > 0).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    return {
      total: rows.length, all: all.length, page: p, pages, pageSize: size,
      types: Array.from(new Set(all.map((c) => c.typeId))),
      owners: people.map((o) => ({ id: o.id, name: o.name, email: o.email, codes: o.codes })),
      ids: qs.ids === '1' ? rows.slice(0, MAX_BULK).map((c) => c.id) : undefined,
      items: rows.slice((p - 1) * size, p * size).map((c) => this.item(req, me, c, owners[c.userId], totals)),
    };
  }

  /* ---------------- Eén code ---------------- */
  @Get('codes/:id')
  async one(@Req() req: Request, @CurrentUser() me: User, @Param('id') id: string) {
    const q = await this.db.getQrCode(id); if (!q) throw fail(404, 'Not found');
    const [owners, totals, log, ownerUser] = await Promise.all([this.owners(), this.db.codeTotals(patternSince()), this.db.listAdminLog({ codeId: id, limit: 30 }), this.db.getUser(q.userId)]);
    const owner = owners[q.userId], can = this.canTouch(me, owner);
    const out: any = this.item(req, me, q, owner, totals);
    // Volledige inhoud (ook het wifi-wachtwoord, nodig om de echte QR-code te downloaden): alleen als je de code mag aanpassen
    if (can && q.contentType === 'wifi' && q.content.password) out.content = { ...out.content, password: q.content.password };
    if (req.query.for === 'download') { if (!can && q.contentType === 'wifi') throw fail(403, 'team_code'); await this.log(me, 'download', q, String(req.query.format || '')); }
    const plan = await planFor(this.db, q.userId); void ownerUser;
    out.plan = { id: plan.id, ...usage(plan, owner ? owner.codes : 0) };
    out.log = log;
    out.editable = STATIC.includes(q.contentType) ? [] : (QR_TYPES.find((t) => t.id === q.typeId) || { fields: [] }).fields
      .filter((f: any) => EDITABLE.includes(f.type) && (QR_TYPES as any).active(QR_TYPES.find((t) => t.id === q.typeId), f, q.content)).map((f: any) => f.key);
    return out;
  }

  @Patch('codes/:id')
  async patch(@Req() req: Request, @CurrentUser() me: User, @Param('id') id: string, @Body() b: any = {}) {
    const q = await this.db.getQrCode(id); if (!q) throw fail(404, 'Not found');
    const owner = (await this.owners())[q.userId];
    if (!this.canTouch(me, owner)) throw fail(403, 'team_code');
    const mod: Moderation = { ...(q.moderation || {}) }, stamp = () => ({ by: me.id, byName: me.name || me.email, at: new Date().toISOString() });
    // Pauzeren / weer aanzetten
    if (b.paused !== undefined) {
      if (typeof b.paused !== 'boolean') throw fail(400, 'paused: true or false');
      if (STATIC.includes(q.contentType)) throw fail(400, 'static');
      if (b.paused) mod.hold = { reason: reasonOf(b.reason), lock: b.lock !== false, ...stamp() }; else delete mod.hold;
      const saved = await this.db.updateQrCode(id, { paused: b.paused, moderation: mod });
      await this.log(me, b.paused ? 'pause' : 'resume', q, b.paused ? reasonOf(b.reason) : '');
      return this.item(req, me, saved, owner, await this.db.codeTotals(patternSince()));
    }
    // Markeren als verdacht (phishing, misbruik) of de markering weghalen
    if (b.flag !== undefined) {
      if (typeof b.flag !== 'boolean') throw fail(400, 'flag: true or false');
      if (b.flag) mod.flag = { reason: reasonOf(b.reason), ...stamp() }; else delete mod.flag;
      const saved = await this.db.updateQrCode(id, { moderation: mod });
      await this.log(me, b.flag ? 'flag' : 'unflag', q, b.flag ? reasonOf(b.reason) : '');
      return this.item(req, me, saved, owner, await this.db.codeTotals(patternSince()));
    }
    // Bewerken: naam en eenvoudige velden (links, teksten, e-mail, telefoon, datum). Bestanden en ontwerp blijven zoals ze zijn.
    if (b.name === undefined && b.content === undefined) throw fail(400, 'nothing to change');
    const patch: any = {}, changed: string[] = [];
    if (b.name !== undefined) { if (typeof b.name !== 'string') throw fail(400, 'name: text'); patch.name = cleanName(b.name); if ((patch.name || '') !== (q.name || '')) changed.push('name'); }
    if (b.content !== undefined) {
      const type = QR_TYPES.find((t) => t.id === q.typeId), input = b.content && typeof b.content === 'object' ? b.content : null;
      if (!input) throw fail(400, 'content: object');
      // Vaste code (wifi, contact): de inhoud zit in de geprinte QR-code zelf, aanpassen heeft geen zin (en maakt hem anders dan op papier)
      if (STATIC.includes(q.contentType)) throw fail(400, 'static');
      const content: Record<string, any> = { ...q.content }, key = secretKey(q.typeId), secret = key ? content[key] : undefined;
      for (const [k, v] of Object.entries(input)) {
        const f = type.fields.find((x: any) => x.key === k);
        if (!f || !EDITABLE.includes(f.type)) throw fail(400, 'Invalid QR code', { details: [k + ': cannot be changed here'] });
        const nv = v == null ? '' : String(v).trim();
        if (nv !== String(content[k] == null ? '' : content[k])) changed.push(k);
        if (nv) content[k] = nv; else delete content[k];
      }
      if (key) delete content[key];                                       // gehasht paginawachtwoord: niet opnieuw controleren
      const { errors, value } = validateQrCode({ typeId: q.typeId, content, design: q.design });
      if (errors.length) throw fail(400, 'Invalid QR code', { details: errors });
      if (key && secret) value.content[key] = secret;
      patch.content = value.content;
    }
    if (!changed.length) return this.item(req, me, q, owner, await this.db.codeTotals(patternSince()));
    const saved = await this.db.updateQrCode(id, patch);
    await this.log(me, 'edit', q, changed.join(', '));
    return this.item(req, me, saved, owner, await this.db.codeTotals(patternSince()));
  }

  @Post('codes/:id/duplicate')
  @HttpCode(201)
  async duplicate(@Req() req: Request, @CurrentUser() me: User, @Param('id') id: string) {
    const old = await this.db.getQrCode(id); if (!old) throw fail(404, 'Not found');
    const owners = await this.owners(), owner = owners[old.userId];
    if (!this.canTouch(me, owner)) throw fail(403, 'team_code');
    const newId = await freshCodeId(this.db), { content, files } = await this.codes.copyFiles(old.userId, old.typeId, { ...old.content });
    await this.db.insertQrCode(old.userId, { id: newId, typeId: old.typeId, contentType: old.contentType, content, design: old.design, name: cleanName(old.name || '') || undefined });
    for (const f of files) await this.db.attachFile(f, newId);
    if (old.folderId) await this.db.moveToFolder(old.userId, [newId], old.folderId);
    const saved = await this.db.getQrCode(newId);
    await this.log(me, 'duplicate', old, newId);
    owner.codes++;
    return this.item(req, me, saved, owner, {});
  }

  @Get('codes/:id/check')
  async check(@CurrentUser() me: User, @Param('id') id: string) {
    const q = await this.db.getQrCode(id); if (!q) throw fail(404, 'Not found');
    const d = destinationOf(q);
    if (!d.value || !/^https?:\/\//i.test(d.value)) return { ok: false, reason: d.kind === 'url' ? 'missing' : 'nolink' };
    try {
      const r = await urlInfo(d.value);
      return { ok: r.ok, status: r.status, finalUrl: r.finalUrl, title: r.title, redirected: r.finalUrl !== d.value };
    } catch (e) {
      const m = (e as Error).message;
      return { ok: false, reason: m === 'private' ? 'private' : m === 'protocol' ? 'invalid' : /abort/i.test(m) ? 'timeout' : 'unreachable' };
    }
  }

  @Delete('codes/:id')
  @HttpCode(204)
  async remove(@CurrentUser() me: User, @Param('id') id: string) {
    const q = await this.db.getQrCode(id); if (!q) throw fail(404, 'Not found');
    if (!this.canTouch(me, (await this.owners())[q.userId])) throw fail(403, 'team_code');
    await this.db.deleteQrCode(id, q.userId);
    await this.log(me, 'delete', q, q.scans + ' scans');
  }

  /* ---------------- Meerdere tegelijk ---------------- */
  @Post('codes/bulk')
  @HttpCode(200)
  async bulk(@CurrentUser() me: User, @Body() b: any = {}) {
    const ids: string[] = Array.isArray(b.ids) ? Array.from(new Set(b.ids.filter((x: unknown) => typeof x === 'string'))) as string[] : [];
    if (!ids.length || ids.length > MAX_BULK) throw fail(400, 'ids: 1-' + MAX_BULK);
    if (!ACTIONS.includes(b.action)) throw fail(400, 'action: ' + ACTIONS.join(' | '));
    const owners = await this.owners(), reason = reasonOf(b.reason), res = { done: 0, skipped: 0, forbidden: 0, missing: 0 };
    for (const id of ids) {
      const q = await this.db.getQrCode(id);
      if (!q) { res.missing++; continue; }
      if (!this.canTouch(me, owners[q.userId])) { res.forbidden++; continue; }
      if (b.action === 'delete') { await this.db.deleteQrCode(id, q.userId); await this.log(me, 'delete', q, 'bulk'); res.done++; continue; }
      const pause = b.action === 'pause';
      if (STATIC.includes(q.contentType) || q.paused === pause) { res.skipped++; continue; }     // vaste code, of staat al zo
      const mod: Moderation = { ...(q.moderation || {}) };
      if (pause) mod.hold = { reason, lock: b.lock !== false, by: me.id, byName: me.name || me.email, at: new Date().toISOString() }; else delete mod.hold;
      await this.db.updateQrCode(id, { paused: pause, moderation: mod });
      await this.log(me, pause ? 'pause' : 'resume', q, (reason ? reason + ' · ' : '') + 'bulk'); res.done++;
    }
    return res;
  }

  /* ---------------- Exporteren (CSV) ---------------- */
  @Post('codes/export')
  @HttpCode(200)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(@Req() req: Request, @CurrentUser() me: User, @Body() b: any = {}) {
    const { rows, owners, totals } = await this.filtered(b.filters || {});
    const pick = Array.isArray(b.ids) && b.ids.length ? new Set(b.ids.map(String)) : null;
    const list = pick ? rows.filter((r) => pick.has(r.id)) : rows;
    const head = ['id', 'name', 'type', 'kind', 'status', 'owner_name', 'owner_email', 'scans', 'unique_scans', 'last_scan', 'created', 'updated', 'destination', 'short_link', 'warnings', 'pause_reason', 'flag_reason'];
    const lines = list.map((q) => {
      const it = this.item(req, me, q, owners[q.userId], totals);
      return [q.id, it.displayName, q.typeId, it.kind, q.paused ? 'paused' : 'active', it.owner && it.owner.name, it.owner && it.owner.email, q.scans, it.uniq, q.lastScanAt || '', q.createdAt, q.updatedAt || '',
        it.dest.value || '', it.kind === 'static' ? '' : it.shortUrl, [it.problem, ...it.risks, ...it.pattern].filter(Boolean).join(' '),
        q.moderation && q.moderation.hold ? q.moderation.hold.reason : '', q.moderation && q.moderation.flag ? q.moderation.flag.reason : ''].map(csv).join(',');
    });
    await this.log(me, 'export', null, list.length + (pick ? ' selected' : ' filtered'));
    return '﻿' + [head.join(','), ...lines].join('\r\n') + '\r\n';     // BOM: Excel leest dan é, ü … goed
  }

  @Get('log')
  async adminLog(@Query('code') code?: string, @Query('limit') limit?: string) {
    return this.db.listAdminLog({ codeId: code || undefined, limit: parseInt(limit, 10) || 100 });
  }

  /* ---------------- Hulpjes ---------------- */
  /** Alle accounts als eigenaar (met rol en aantal codes) */
  private async owners(): Promise<Record<string, Owner>> {
    const out: Record<string, Owner> = {};
    (await this.db.listCustomers()).forEach((u: Customer) => {
      out[u.id] = { id: u.id, name: u.name, email: u.email, level: this.auth.isSuper(u) ? 'super' : this.auth.isAdmin(u) ? 'admin' : 'user', codes: u.codes };
    });
    return out;
  }
  /** Mag deze admin de code van deze eigenaar aanpassen? Super-admin: alles. Admin: klanten en zichzelf, niet andere teamleden. */
  private canTouch(me: User, owner: Owner | undefined) {
    if (this.auth.isSuper(me)) return true;
    if (!owner) return true;                                      // eigenaar bestaat niet meer (zou niet moeten): opruimen mag
    return owner.id === me.id || owner.level === 'user';
  }
  private async log(me: User, action: string, q: QrCode | null, detail = '') {
    await this.db.addAdminLog({ adminId: me.id, adminName: me.name || me.email, action, codeId: q ? q.id : null, ownerId: q ? q.userId : null,
      detail: [q ? (q.name || '') : '', detail].filter(Boolean).join(' · ') || null }).catch((e) => console.error('Beheerlog:', e.message));
  }

  /** Alle filters samen (ze werken allemaal tegelijk) */
  private async filtered(qs: Record<string, any>) {
    const [owners, all, totals] = await Promise.all([this.owners(), this.db.allQrCodes(), this.db.codeTotals(patternSince())]);
    const s = (k: string) => String(qs[k] == null ? '' : qs[k]);
    const q = s('q').trim().toLowerCase(), type = s('type'), status = s('status'), user = s('user'), kind = s('kind'), scans = s('scans'), last = s('last'), check = s('check');
    const now = Date.now(), daysAgo = (n: number) => new Date(now - n * 864e5).toISOString();
    const created = /^\d{1,3}$/.test(s('created')) ? daysAgo(+s('created')) : '';
    const from = /^\d{4}-\d{2}-\d{2}$/.test(s('from')) ? s('from') : '', to = /^\d{4}-\d{2}-\d{2}$/.test(s('to')) ? s('to') : '';
    const sort = SORTS.includes(s('sort')) ? s('sort') : 'new';
    const qt = s('qt').split(',').filter((x) => /^[a-z0-9]{1,30}$/i.test(x));        // types waarvan de vertaalde naam past bij de zoekterm (van de app)
    const isStatic = (c: QrCode) => STATIC.includes(c.contentType);
    const checks = (c: QrCode) => {
      const d = destinationOf(c);
      return { flagged: !!(c.moderation && c.moderation.flag), held: !!(c.moderation && c.moderation.hold), problem: !!problemOf(c, d),
        risky: !!(d.value && riskOf(d.value).length) || scanPattern((totals[c.id] || { days: {} }).days).length > 0 };
    };
    let rows = all.filter((c) => {
      if (type && c.typeId !== type) return false;
      if (user && c.userId !== user) return false;
      if (status === 'paused' && !c.paused) return false;
      if (status === 'active' && c.paused) return false;
      if (kind === 'static' && !isStatic(c)) return false;
      if (kind === 'dynamic' && isStatic(c)) return false;
      if (created && c.createdAt < created) return false;
      if (from && c.createdAt.slice(0, 10) < from) return false;
      if (to && c.createdAt.slice(0, 10) > to) return false;
      if (scans === 'none' && (c.scans > 0 || isStatic(c))) return false;
      if (scans === 'some' && !(c.scans > 0)) return false;
      if (scans === '100' && !(c.scans >= 100)) return false;
      if (last === 'never' && (c.lastScanAt || isStatic(c))) return false;
      if (/^\d+$/.test(last) && !(c.lastScanAt && c.lastScanAt >= daysAgo(+last))) return false;
      if (last === 'old' && !(c.lastScanAt && c.lastScanAt < daysAgo(30))) return false;
      if (check) { const k = checks(c); if (check === 'attention' ? !(k.flagged || k.problem || k.risky) : !k[check as keyof typeof k]) return false; }
      if (q && haystack(c, owners[c.userId]).indexOf(q) < 0 && !qt.includes(c.typeId)) return false;
      return true;
    });
    const name = (c: QrCode) => String(c.name || (c.content && (c.content.title || c.content.name || c.content.url)) || c.typeId).toLowerCase();
    if (sort === 'old') rows = rows.slice().reverse();
    if (sort === 'scans') rows = rows.slice().sort((a, b) => b.scans - a.scans);
    if (sort === 'recent') rows = rows.slice().sort((a, b) => String(b.lastScanAt || '').localeCompare(String(a.lastScanAt || '')));
    if (sort === 'updated') rows = rows.slice().sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    if (sort === 'name') rows = rows.slice().sort((a, b) => name(a).localeCompare(name(b)));
    return { rows, owners, all, totals };
  }

  /** Eén code voor het scherm: met eigenaar, soort, unieke scans, bestemming, controles en of je hem mag aanpassen */
  private item(req: Request, me: User, q: QrCode, owner: Owner | undefined, totals: Record<string, { uniq: number; days: Record<string, [number, number]> }>) {
    const r = this.row(req, q), d = destinationOf(q), t = totals[q.id];
    const name = q.name || (q.content && (q.content.title || q.content.name || q.content.ssid)) || '';
    return { ...r, displayName: name, owner: owner || null, kind: STATIC.includes(q.contentType) ? 'static' : 'dynamic', uniq: t ? t.uniq : 0,
      dest: { kind: d.kind, value: d.value && d.value.length < 2000 ? d.value : d.value ? d.value.slice(0, 2000) : '' },
      problem: problemOf(q, d), risks: d.value ? riskOf(d.value) : [], pattern: t ? scanPattern(t.days) : [],
      moderation: q.moderation || null, canEdit: this.canTouch(me, owner) };
  }
  private row(req: Request, q: QrCode) {
    const r = this.codes.out(req, q);
    r.content = slim(r.content, q.contentType);
    r.userId = q.userId;
    delete r.hold;
    return r;
  }
}
