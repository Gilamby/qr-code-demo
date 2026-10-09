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
import { QrCodesService, cleanName, missingRequired, newCodeId, secretKey } from './qr-codes.service';
import type { User } from '../types';

@Controller('api/qr-codes')
@UseGuards(LoggedIn)
export class QrCodesController {
  constructor(private readonly db: DatabaseService, private readonly codes: QrCodesService) {}

  @Get()
  async list(@Req() req: Request, @CurrentUser() user: User) {
    return (await this.db.listQrCodes(user.id)).map((q) => this.codes.out(req, q));
  }

  @Get(':id')
  async one(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    const q = await this.db.getOwnedQrCode(id, user.id);
    if (!q) throw fail(404, 'QR code not found');
    return this.codes.out(req, q);
  }

  @Post()
  @HttpCode(201)
  async create(@Req() req: Request, @CurrentUser() user: User, @Body() body: any = {}) {
    const { errors, value } = validateQrCode(body);
    if (errors.length) throw fail(400, 'Invalid QR code', { details: errors });
    const key = secretKey(value.typeId);
    if (key && value.content[key]) value.content[key] = hashPassword(value.content[key]);
    const record: any = { ...value };
    if (body.name) record.name = cleanName(body.name);
    // De app reserveert vooraf een eigen id, zodat de QR-code in de preview precies de code is die je krijgt.
    const id = typeof body.id === 'string' && /^[A-Za-z0-9_-]{7,12}$/.test(body.id) && !(await this.db.idTaken(body.id)) ? body.id : newCodeId();
    const files = await this.codes.storeFiles(user.id, value.typeId, value.content, null);
    const miss = missingRequired(value.typeId, value.content); if (miss.length) throw fail(400, 'Invalid QR code', { details: miss });
    const saved = await this.db.insertQrCode(user.id, { id, ...record });
    for (const f of files) await this.db.attachFile(f, id);
    return this.codes.out(req, saved);
  }

  /** Bewerken: nieuwe inhoud en ontwerp, zelfde link, scans blijven staan */
  @Put(':id')
  async update(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string, @Body() body: any = {}) {
    const old = await this.db.getOwnedQrCode(id, user.id);
    if (!old) throw fail(404, 'QR code not found');
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
    return this.codes.out(req, await this.db.updateQrCode(old.id, patch));
  }

  /** Kleine wijziging vanuit Mijn QR-codes: naam of aan/uit */
  @Patch(':id')
  async patch(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string, @Body() b: any = {}) {
    if (!(await this.db.getOwnedQrCode(id, user.id))) throw fail(404, 'QR code not found');
    const patch: any = {}, errors: string[] = [];
    if (b.name !== undefined) { if (typeof b.name !== 'string') errors.push('name: must be text'); else patch.name = cleanName(b.name); }
    if (b.paused !== undefined) { if (typeof b.paused !== 'boolean') errors.push('paused: must be true or false'); else patch.paused = b.paused; }
    if (errors.length || !Object.keys(patch).length) throw fail(400, 'Invalid update', { details: errors.length ? errors : ['nothing to change'] });
    return this.codes.out(req, await this.db.updateQrCode(id, patch));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    if (!(await this.db.deleteQrCode(id, user.id))) throw fail(404, 'QR code not found');
  }
}
