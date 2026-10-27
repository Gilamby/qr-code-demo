/* Eigen merk (white label, Business): instellen in Mijn account, icoon voor scanpagina's. Zie server/src/brand.ts */
import { Body, Controller, Delete, Get, HttpCode, Param, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { fail } from '../common/http';
import { planFor } from '../plans';
import { activeBrand, cleanBrand, forgetBrand, readBrand } from '../brand';
import type { User } from '../types';

@Controller()
export class BrandController {
  constructor(private readonly db: DatabaseService) {}

  @Get('b/:id/icon')
  async icon(@Param('id') id: string, @Res() res: Response) {
    const b = await activeBrand(this.db, String(id)); const m = b && b.logo && b.logo.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!m) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=86400').type(m[1]).send(Buffer.from(m[2], 'base64'));
  }

  @Get('api/account/brand')
  @UseGuards(LoggedIn)
  async get(@Req() req: Request, @CurrentUser() u: User) {
    if ((req as any).member) throw fail(403, 'team');
    return { allowed: (await planFor(this.db, u.id)).api, brand: await readBrand(this.db, u.id) };
  }
  @Put('api/account/brand')
  @UseGuards(LoggedIn)
  async put(@Req() req: Request, @CurrentUser() u: User, @Body() b: any = {}) {
    if ((req as any).member) throw fail(403, 'team');
    if (!(await planFor(this.db, u.id)).api) throw fail(403, 'plan_api');
    const v = cleanBrand(b); if (typeof v === 'string') throw fail(400, v);
    await this.db.setSetting('brand:' + u.id, JSON.stringify(v)); forgetBrand(u.id);
    return { brand: v };
  }
  @Delete('api/account/brand')
  @UseGuards(LoggedIn)
  @HttpCode(204)
  async remove(@Req() req: Request, @CurrentUser() u: User) {
    if ((req as any).member) throw fail(403, 'team');
    await this.db.setSetting('brand:' + u.id, null); forgetBrand(u.id);
  }
}
