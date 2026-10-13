/* =========================================================
   BESTANDEN UPLOADEN
   - POST /api/uploads/video?name=film.mp4   video (groot)
   - POST /api/uploads/image?name=foto.jpg   één foto voor een fotogalerij (al verkleind in de browser)
   - GET  /api/uploads/:id                   eigen bestand terughalen (voorbeeld bij het bewerken)
   Het bestand komt als ruwe body (Content-Type video/mp4, video/quicktime, video/webm) en gaat
   rechtstreeks naar schijf (<DATA_DIR>/files), zonder alles in het geheugen te laden.
   Maximaal VIDEO_MAX_MB (standaard 100) MB. Antwoord: { n, s, f } — dat komt in de inhoud van de code.
   Nooit bij een code opgeslagen? Dan ruimt de database het na een dag op (cleanup).
   ========================================================= */
import { Controller, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService, newId } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { fail } from '../common/http';
import type { User } from '../types';

export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
export const videoMaxBytes = () => (Number(process.env.VIDEO_MAX_MB) || 100) * 1048576;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_MAX = 8 * 1048576;
/** Echt een afbeelding? (de eerste bytes, niet alleen wat de browser zegt) */
function looksLikeImage(file: string, mime: string) {
  const fd = fs.openSync(file, 'r'), b = Buffer.alloc(12); fs.readSync(fd, b, 0, 12, 0); fs.closeSync(fd);
  if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') return b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP';
}

@Controller('api/uploads')
@UseGuards(LoggedIn)
export class UploadsController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  @Post('video')
  @HttpCode(201)
  async video(@Req() req: Request, @CurrentUser() user: User, @Query('name') name = '') {
    if (this.auth.limited('upload:' + user.id, 30, 60)) throw fail(429, 'too_many');
    return this.receive(req, user, name || 'video', VIDEO_TYPES, videoMaxBytes(), 'video_type');
  }

  /** Eén foto van een galerij. Per uur ruim genoeg voor een paar volle galerijen. */
  @Post('image')
  @HttpCode(201)
  async image(@Req() req: Request, @CurrentUser() user: User, @Query('name') name = '') {
    if (this.auth.limited('photo:' + user.id, 300, 60)) throw fail(429, 'too_many');
    const out = await this.receive(req, user, name || 'foto.jpg', IMAGE_TYPES, IMAGE_MAX, 'image_type');
    const f = await this.db.getFile(out.f);
    if (f && !looksLikeImage(f.path, f.mime)) { await this.db.pruneLooseFile(out.f); throw fail(415, 'image_type'); }
    return out;
  }

  /** Eigen bestand (bv. de foto's bij het bewerken van een galerij) */
  @Get(':id')
  async own(@Res() res: Response, @CurrentUser() user: User, @Param('id') id: string) {
    const f = /^[A-Za-z0-9_-]{10,40}$/.test(id) ? await this.db.getFile(id) : null;
    if (!f || f.user_id !== user.id) return res.status(404).json({ error: 'not_found' });
    res.set('Content-Type', f.mime).set('X-Content-Type-Options', 'nosniff').set('Cache-Control', 'private, max-age=3600');
    return res.sendFile(f.path, { dotfiles: 'allow' }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  }

  /** Ruwe body rechtstreeks naar schijf, met een maximum; daarna een bestand zonder code (wordt bij opslaan gekoppeld) */
  private async receive(req: Request, user: User, name: string, types: string[], max: number, typeError: string) {
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!types.includes(mime)) throw fail(415, typeError);
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > max) throw fail(413, 'too_big', { maxMb: max / 1048576 });
    const id = newId(16), file = path.join(this.db.filesDir, id);
    const size = await new Promise<number>((resolve, reject) => {
      let n = 0, done = false;
      const out = fs.createWriteStream(file, { flags: 'wx', mode: 0o600 });
      const stop = (e: Error) => { if (done) return; done = true; req.unpipe(out); out.destroy(); fs.unlink(file, () => {}); reject(e); };
      req.on('data', (chunk: Buffer) => { n += chunk.length; if (n > max) stop(fail(413, 'too_big', { maxMb: max / 1048576 })); });
      req.on('aborted', () => stop(fail(400, 'aborted')));
      req.on('error', stop); out.on('error', stop);
      out.on('finish', () => { if (!done) { done = true; resolve(n); } });
      req.pipe(out);
    });
    if (!size) { fs.unlink(file, () => {}); throw fail(400, 'empty'); }
    const clean = String(name).replace(/[\\/\r\n"]/g, '_').trim().slice(0, 120) || 'file';
    await this.db.addFileRecord({ id, userId: user.id, codeId: null, name: clean, mime, size });
    return { n: clean, s: size, f: id };
  }
}
