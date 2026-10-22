/* =========================================================
   QR-CODES  (/api/qr-codes) — alleen eigen codes
   GET lijst · POST nieuw · GET/PUT/PATCH/DELETE één code
   ========================================================= */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { fail } from '../common/http';
import { hashPassword } from '../visitor/rules';
import { validateQrCode } from './validation';
import { QrCodesService, cleanName, freshCodeId, missingRequired, secretKey } from './qr-codes.service';
import type { User } from '../types';
import { planFor, typeAllowed } from '../plans';
import { activeCount, forgetPlanPaused } from '../plan-limit';
import { AuthService } from '../auth/auth.service';

@Controller('api/qr-codes')
@UseGuards(LoggedIn)
export class QrCodesController {
  constructor(private readonly db: DatabaseService, private readonly codes: QrCodesService, private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: Request, @CurrentUser() user: User) {
    const m = await this.codes.legacyMap(user.id), u = await this.codes.untilMap(user.id);
    return Promise.all((await this.db.listQrCodes(user.id)).map((q) => this.codes.outFull(req, q, m, u)));
  }

  @Get(':id')
  async one(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    const q = await this.db.getOwnedQrCode(id, user.id);
    if (!q) throw fail(404, 'QR code not found');
    return this.codes.outFull(req, q);
  }

  @Post()
  @HttpCode(201)
  async create(@Req() req: Request, @CurrentUser() user: User, @Body() body: any = {}) {
    await this.roomLeft(user);
    return this.createOne(req, user, body);
  }

  /** Veel QR-codes tegelijk (uit een bestand, Pro en Business; ook via de API). Max 500 per keer.
   *  Eerst alles controleren; past het niet in het pakket, dan wordt er niets gemaakt. Fouten per regel komen terug. */
  @Post('bulk')
  @HttpCode(200)
  async bulk(@Req() req: Request, @CurrentUser() user: User, @Body() body: any = {}) {
    const plan = await planFor(this.db, user.id);
    if (!plan.bulk) throw fail(403, 'plan_bulk', { plan: plan.id });
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) throw fail(400, 'no_items');
    if (items.length > 500) throw fail(400, 'too_many', { max: 500 });
    if (plan.codes != null) { const room = plan.codes - await activeCount(this.db, user.id); if (items.length > room) throw fail(403, 'plan_limit', { limit: plan.codes, plan: plan.id, room: Math.max(0, room) }); }
    const errors: any[] = [];
    items.forEach((it: any, i: number) => {
      const v = validateQrCode(it || {}); if (v.errors.length) { errors.push({ row: i, details: v.errors }); return; }
      const miss = missingRequired(v.value.typeId, v.value.content); if (miss.length) errors.push({ row: i, details: miss });
    });
    if (errors.length) throw fail(400, 'Invalid rows', { rows: errors });
    const created: any[] = [];
    for (const it of items) created.push(await this.createOne(req, user, { ...it, id: undefined, folderId: it.folderId || body.folderId }));
    return { created };
  }

  private async createOne(req: Request, user: User, body: any) {
    const { errors, value } = validateQrCode(body);
    if (errors.length) throw fail(400, 'Invalid QR code', { details: errors });
    await this.typeOk(user, value.typeId);
    const key = secretKey(value.typeId);
    if (key && value.content[key]) value.content[key] = hashPassword(value.content[key]);
    const record: any = { ...value };
    if (body.name) record.name = cleanName(body.name);
    // De app reserveert vooraf een eigen id, zodat de QR-code in de preview precies de code is die je krijgt.
    const id = typeof body.id === 'string' && /^[A-Za-z0-9_-]{7,12}$/.test(body.id) && !(await this.db.idTaken(body.id)) ? body.id : await freshCodeId(this.db);
    const files = await this.codes.storeFiles(user.id, value.typeId, value.content, null);
    const miss = missingRequired(value.typeId, value.content); if (miss.length) throw fail(400, 'Invalid QR code', { details: miss });
    let saved = await this.db.insertQrCode(user.id, { id, ...record });
    for (const f of files) await this.db.attachFile(f, id);
    // Gemaakt vanuit een map in Mijn QR-codes: meteen in die map
    if (typeof body.folderId === 'string' && (await this.db.listFolders(user.id)).some((f) => f.id === body.folderId)) {
      await this.db.moveToFolder(user.id, [id], body.folderId); saved = await this.db.getQrCode(id);
    }
    return this.codes.out(req, saved);
  }

  /** Soort QR-code zit niet in het pakket (bv. Standard: alleen de basis) */
  private async typeOk(user: User, typeId: string) {
    const plan = await planFor(this.db, user.id);
    if (!typeAllowed(plan, typeId)) throw fail(403, 'plan_type', { plan: plan.id, typeId });
  }
  /** Limiet van het abonnement (aantal QR-codes) */
  private async roomLeft(user: User) {
    const plan = await planFor(this.db, user.id);
    if (plan.codes != null && (await activeCount(this.db, user.id)) >= plan.codes) throw fail(403, 'plan_limit', { limit: plan.codes, plan: plan.id });   // alleen actieve codes tellen
  }

  /** Bewerken: nieuwe inhoud en ontwerp, zelfde link, scans blijven staan */
  @Put(':id')
  async update(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string, @Body() body: any = {}) {
    const old = await this.db.getOwnedQrCode(id, user.id);
    if (!old) throw fail(404, 'QR code not found');
    await this.typeOk(user, old.typeId);
    const { errors, value } = validateQrCode({ ...body, typeId: old.typeId });
    if (errors.length) throw fail(400, 'Invalid QR code', { details: errors });
    const key = secretKey(old.typeId);
    if (key) {
      if (value.content[key]) value.content[key] = hashPassword(value.content[key]);
      else if (body.keepPassword && old.content[key]) value.content[key] = old.content[key];   // wachtwoord niet opnieuw ingevuld: het oude blijft
    }
    const files = await this.codes.storeFiles(user.id, old.typeId, value.content, old.id);
    const miss = missingRequired(old.typeId, value.content); if (miss.length) throw fail(400, 'Invalid QR code', { details: miss });
    for (const f of files) await this.db.attachFile(f, old.id);
    await this.db.pruneFiles(old.id, files);                          // vervangen bestanden opruimen
    const patch: any = { content: value.content, design: value.design };
    if (body.name !== undefined) patch.name = cleanName(body.name);
    return this.codes.outFull(req, await this.db.updateQrCode(old.id, patch));
  }

  /** Kleine wijziging vanuit Mijn QR-codes: naam of aan/uit */
  @Patch(':id')
  async patch(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string, @Body() b: any = {}) {
    const cur = await this.db.getOwnedQrCode(id, user.id);
    if (!cur) throw fail(404, 'QR code not found');
    const patch: any = {}, errors: string[] = [];
    if (b.name !== undefined) { if (typeof b.name !== 'string') errors.push('name: must be text'); else patch.name = cleanName(b.name); }
    if (b.paused !== undefined) { if (typeof b.paused !== 'boolean') errors.push('paused: must be true or false'); else patch.paused = b.paused; }
    if (b.paused === false && cur.paused) {                                  // weer aanzetten: past het binnen het pakket?
      const plan = await planFor(this.db, user.id);
      if (plan.codes != null && (await activeCount(this.db, user.id)) >= plan.codes) throw fail(403, 'plan_limit', { limit: plan.codes, plan: plan.id });
    }
    if (b.paused !== undefined) await forgetPlanPaused(this.db, user.id, [id]);
    if (b.favorite !== undefined) { if (typeof b.favorite !== 'boolean') errors.push('favorite: must be true or false'); else patch.favorite = b.favorite; }
    if (b.labels !== undefined) {                                    // labels: max. 10, elk max. 30 tekens, dubbele (hoofdletters maken niet uit) eruit
      if (!Array.isArray(b.labels)) errors.push('labels: must be a list');
      else { const seen = new Set<string>(); patch.labels = b.labels.map((x: any) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, 30)).filter((x: string) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase())).slice(0, 10); }
    }
    if (b.note !== undefined) { if (b.note !== null && typeof b.note !== 'string') errors.push('note: must be text'); else patch.note = String(b.note || '').replace(/\r\n/g, '\n').trim().slice(0, 1000); }
    let legacy: string | null | undefined;
    // Overzetten uit een andere QR-app: alleen het team. Een klant komt er niet mee van zijn oude abonnement af
    // (de geprinte code gaat altijd eerst langs de oude app), dus voor klanten zou het vooral verwarring en klachten geven.
    if ((b.legacyUrl || b.legacyUntil) && !this.auth.isAdmin(user)) throw fail(403, 'team_only');
    if (b.legacyUrl !== undefined) {                                 // bestaande QR-code uit een andere app koppelen (overstappen zonder nieuwe codes te printen)
      if (b.legacyUrl === null || b.legacyUrl === '') legacy = null;
      else if (typeof b.legacyUrl !== 'string' || !/^https?:\/\/[^\s]{3,}$/i.test(b.legacyUrl.trim()) || b.legacyUrl.length > 500) errors.push('legacyUrl: must be a web address');
      else if (/\/q\/[A-Za-z0-9_-]+\/?$/.test(b.legacyUrl.trim()) && b.legacyUrl.trim().indexOf('/q/' + id) >= 0) errors.push('legacyUrl: that is this code itself');
      else legacy = b.legacyUrl.trim();
    }
    let until: string | null | undefined;
    if (b.legacyUntil !== undefined) {                               // tot wanneer loopt het account bij de oude app (voor herinneringen)
      if (b.legacyUntil === null || b.legacyUntil === '') until = null;
      else if (typeof b.legacyUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.legacyUntil) || isNaN(Date.parse(b.legacyUntil))) errors.push('legacyUntil: must be a date (YYYY-MM-DD)');
      else until = b.legacyUntil;
    }
    if (legacy === null) until = null;                               // ontkoppeld: geen herinnering meer
    if (errors.length || (!Object.keys(patch).length && legacy === undefined && until === undefined)) throw fail(400, 'Invalid update', { details: errors.length ? errors : ['nothing to change'] });
    if (legacy !== undefined) await this.codes.setLegacy(user.id, id, legacy);
    if (until !== undefined) await this.codes.setUntil(user.id, id, until);
    if ((legacy !== undefined || until !== undefined) && !Object.keys(patch).length) return this.codes.outFull(req, cur);
    // Gepauzeerd door het team: weer aanzetten mag alleen als het team dat toestaat (lock = nee)
    const hold = cur.moderation && cur.moderation.hold;
    if (patch.paused === false && hold) {
      if (hold.lock) throw fail(403, 'admin_hold');
      patch.moderation = cur.moderation.flag ? { flag: cur.moderation.flag } : null;
    }
    return this.codes.outFull(req, await this.db.updateQrCode(id, patch));
  }

  /** Kopie maken: zelfde type, inhoud, ontwerp, map en bestanden (gekopieerd), maar een nieuwe link en 0 scans */
  @Post(':id/duplicate')
  @HttpCode(201)
  async duplicate(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string, @Body() b: any = {}) {
    const old = await this.db.getOwnedQrCode(id, user.id);
    if (!old) throw fail(404, 'QR code not found');
    await this.roomLeft(user);
    const newId = await freshCodeId(this.db), { content, files } = await this.codes.copyFiles(user.id, old.typeId, { ...old.content });
    const saved = await this.db.insertQrCode(user.id, { id: newId, typeId: old.typeId, contentType: old.contentType, content, design: old.design,
      name: cleanName(typeof b.name === 'string' && b.name.trim() ? b.name : (old.name || '')) || undefined });
    for (const f of files) await this.db.attachFile(f, newId);
    if (old.folderId) await this.db.moveToFolder(user.id, [newId], old.folderId);
    if ((old.labels || []).length || old.note) await this.db.updateQrCode(newId, { labels: old.labels || [], note: old.note || '' });   // labels en notitie gaan mee
    return this.codes.out(req, old.folderId || (old.labels || []).length || old.note ? await this.db.getQrCode(newId) : saved);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    if (!(await this.db.deleteQrCode(id, user.id))) throw fail(404, 'QR code not found');
    await this.codes.setLegacy(user.id, id, null);
  }
}
