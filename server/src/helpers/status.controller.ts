/* =========================================================
   STORINGEN EN MELDINGEN
   GET    /status                       openbare pagina: werkt alles? lopende storing, onderhoud en eerdere meldingen
   GET    /api/status                   hetzelfde als JSON (de app toont hiermee een rode balk bij een storing)
   GET    /api/admin/incidents          alle meldingen (team)
   POST   /api/admin/incidents          { title, text }            nieuwe storing melden
   PATCH  /api/admin/incidents/:id      { status: open|solved } | { update } | { title, text }
   DELETE /api/admin/incidents/:id
   Opslag: settings 'incidents' (nieuwste eerst, max. 50). Server helemaal plat: dan toont nginx public/storing.html.
   ========================================================= */
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { TeamOnly } from '../auth/admin.controller';
import { AuthService } from '../auth/auth.service';
import { fail } from '../common/http';
import { statusPage } from '../visitor/rules';
import type { User } from '../types';

export type Incident = { id: string; at: string; title: string; text: string; status: 'open' | 'solved'; solvedAt?: string | null; updates: { at: string; text: string }[] };
const clean = (v: unknown, max: number) => String(v == null ? '' : v).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

let cache: { at: number; list: Incident[] } = { at: 0, list: [] };
export async function incidents(db: DatabaseService): Promise<Incident[]> {
  if (Date.now() - cache.at < 10000) return cache.list;
  let list: Incident[] = []; try { const v = JSON.parse((await db.getSetting('incidents')) || '[]'); if (Array.isArray(v)) list = v; } catch (e) { list = []; }
  cache = { at: Date.now(), list }; return list;
}
async function save(db: DatabaseService, list: Incident[]) { list = list.slice(0, 50); await db.setSetting('incidents', list.length ? JSON.stringify(list) : null); cache = { at: Date.now(), list }; }

/** Voor de app en de statuspagina: alleen wat klanten mogen zien */
export async function publicStatus(db: DatabaseService, auth: AuthService) {
  const list = await incidents(db), m = await auth.maintenance();
  const open = list.filter((i) => i.status === 'open');
  return {
    state: open.length ? 'incident' : m.on ? 'maintenance' : 'ok',
    maintenance: { on: m.on, message: m.message || '' },
    open: open.map((i) => ({ id: i.id, at: i.at, title: i.title, text: i.text, updates: i.updates || [] })),
    history: list.filter((i) => i.status === 'solved').slice(0, 20).map((i) => ({ id: i.id, at: i.at, title: i.title, text: i.text, solvedAt: i.solvedAt || null, updates: i.updates || [] })),
  };
}

@Controller()
export class StatusController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  @Get('status')
  async page(@Req() req: Request, @Res() res: Response) {
    res.set('Cache-Control', 'no-cache').type('html').send(statusPage(req, await publicStatus(this.db, this.auth)));
  }

  @Get('api/status')
  async json() { return publicStatus(this.db, this.auth); }

  @Get('api/admin/incidents')
  @UseGuards(LoggedIn, TeamOnly)
  async list() { return { incidents: await incidents(this.db) }; }

  @Post('api/admin/incidents')
  @UseGuards(LoggedIn, TeamOnly)
  async add(@CurrentUser() me: User, @Body() b: any = {}) {
    const title = clean(b.title, 120).replace(/\n/g, ' '), text = clean(b.text, 2000);
    if (!title) throw fail(400, 'Invalid incident', { details: ['title'] });
    const list = (await incidents(this.db)).slice();
    const inc: Incident = { id: crypto.randomBytes(6).toString('base64url'), at: new Date().toISOString(), title, text, status: 'open', solvedAt: null, updates: [] };
    list.unshift(inc); await save(this.db, list);
    await this.db.addAdminLog({ adminId: me.id, adminName: me.name || me.email, action: 'incident_open', codeId: null, ownerId: null, detail: title }).catch(() => {});
    return { incidents: list };
  }

  @Patch('api/admin/incidents/:id')
  @UseGuards(LoggedIn, TeamOnly)
  async edit(@CurrentUser() me: User, @Param('id') id: string, @Body() b: any = {}) {
    const list = (await incidents(this.db)).map((i) => ({ ...i, updates: (i.updates || []).slice() }));
    const inc = list.find((i) => i.id === id); if (!inc) throw fail(404, 'Not found');
    const now = new Date().toISOString(); let action = 'incident_edit';
    if (b.status === 'solved' || b.status === 'open') {
      inc.status = b.status; inc.solvedAt = b.status === 'solved' ? now : null; action = b.status === 'solved' ? 'incident_solved' : 'incident_open';
    }
    const upd = clean(b.update, 1000); if (upd) { inc.updates.push({ at: now, text: upd }); inc.updates = inc.updates.slice(-20); action = 'incident_update'; }
    if (b.title !== undefined) { const t = clean(b.title, 120).replace(/\n/g, ' '); if (!t) throw fail(400, 'Invalid incident', { details: ['title'] }); inc.title = t; }
    if (b.text !== undefined) inc.text = clean(b.text, 2000);
    await save(this.db, list);
    await this.db.addAdminLog({ adminId: me.id, adminName: me.name || me.email, action, codeId: null, ownerId: null, detail: inc.title }).catch(() => {});
    return { incidents: list };
  }

  @Delete('api/admin/incidents/:id')
  @UseGuards(LoggedIn, TeamOnly)
  async remove(@CurrentUser() me: User, @Param('id') id: string) {
    const list = await incidents(this.db), inc = list.find((i) => i.id === id); if (!inc) throw fail(404, 'Not found');
    await save(this.db, list.filter((i) => i.id !== id));
    await this.db.addAdminLog({ adminId: me.id, adminName: me.name || me.email, action: 'incident_delete', codeId: null, ownerId: null, detail: inc.title }).catch(() => {});
    return { incidents: await incidents(this.db) };
  }
}
