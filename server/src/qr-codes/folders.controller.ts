/* =========================================================
   MAPPEN in Mijn QR-codes  (/api/folders) — alleen eigen mappen
   GET    /api/folders            alle mappen
   POST   /api/folders            nieuwe map { name, color }
   PATCH  /api/folders/:id        naam of kleur wijzigen
   DELETE /api/folders/:id        map weg (de codes blijven, zonder map)
   POST   /api/folders/move       codes verplaatsen { ids: [...], folderId | null }
   ========================================================= */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { fail } from '../common/http';
import type { User } from '../types';

/** Kleuren die de app kent (zelfde lijst als in my-codes.js) */
export const FOLDER_COLORS = ['cyan', 'blue', 'violet', 'pink', 'red', 'orange', 'amber', 'green'];
const MAX_FOLDERS = 100;

function cleanName(v: unknown) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 40); }

@Controller('api/folders')
@UseGuards(LoggedIn)
export class FoldersController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async list(@CurrentUser() user: User) { return { folders: await this.db.listFolders(user.id) }; }

  @Post()
  @HttpCode(201)
  async create(@CurrentUser() user: User, @Body() b: any = {}) {
    const name = cleanName(b.name), color = FOLDER_COLORS.includes(b.color) ? b.color : 'cyan';
    if (!name) throw fail(400, 'name');
    const all = await this.db.listFolders(user.id);
    if (all.length >= MAX_FOLDERS) throw fail(400, 'too_many_folders');
    if (all.some((f) => f.name.toLowerCase() === name.toLowerCase())) throw fail(409, 'exists');
    return { folder: await this.db.createFolder(user.id, { name, color }) };
  }

  @Patch(':id')
  async update(@CurrentUser() user: User, @Param('id') id: string, @Body() b: any = {}) {
    const all = await this.db.listFolders(user.id);
    if (!all.some((f) => f.id === id)) throw fail(404, 'not_found');
    const patch: { name?: string; color?: string } = {};
    if (b.name !== undefined) {
      patch.name = cleanName(b.name); if (!patch.name) throw fail(400, 'name');
      if (all.some((f) => f.id !== id && f.name.toLowerCase() === patch.name.toLowerCase())) throw fail(409, 'exists');
    }
    if (b.color !== undefined) { if (!FOLDER_COLORS.includes(b.color)) throw fail(400, 'color'); patch.color = b.color; }
    return { folder: await this.db.updateFolder(user.id, id, patch) };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    if (!(await this.db.deleteFolder(user.id, id))) throw fail(404, 'not_found');
  }

  @Post('move')
  @HttpCode(200)
  async move(@CurrentUser() user: User, @Body() b: any = {}) {
    const ids = Array.isArray(b.ids) ? b.ids.filter((x: unknown) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 500) : [];
    if (!ids.length) throw fail(400, 'ids');
    const folderId = b.folderId == null || b.folderId === '' ? null : String(b.folderId);
    if (folderId && !(await this.db.listFolders(user.id)).some((f) => f.id === folderId)) throw fail(404, 'not_found');
    return { moved: await this.db.moveToFolder(user.id, ids, folderId) };
  }
}
