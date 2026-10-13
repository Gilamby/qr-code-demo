/* =========================================================
   GROTE BESTANDEN UPLOADEN (nu: video)  POST /api/uploads/video?name=film.mp4
   Het bestand komt als ruwe body (Content-Type video/mp4, video/quicktime, video/webm) en gaat
   rechtstreeks naar schijf (<DATA_DIR>/files), zonder alles in het geheugen te laden.
   Maximaal VIDEO_MAX_MB (standaard 100) MB. Antwoord: { n, s, f } — dat komt in de inhoud van de code.
   Nooit bij een code opgeslagen? Dan ruimt de database het na een dag op (cleanup).
   ========================================================= */
import { Controller, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService, newId } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { fail } from '../common/http';
import type { User } from '../types';

export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
export const videoMaxBytes = () => (Number(process.env.VIDEO_MAX_MB) || 100) * 1048576;

@Controller('api/uploads')
@UseGuards(LoggedIn)
export class UploadsController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  @Post('video')
  @HttpCode(201)
  async video(@Req() req: Request, @CurrentUser() user: User, @Query('name') name = '') {
    if (this.auth.limited('upload:' + user.id, 30, 60)) throw fail(429, 'too_many');
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!VIDEO_TYPES.includes(mime)) throw fail(415, 'video_type');
    const max = videoMaxBytes(), declared = Number(req.headers['content-length'] || 0);
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
    const clean = String(name || 'video').replace(/[\\/\r\n"]/g, '_').trim().slice(0, 120) || 'video';
    await this.db.addFileRecord({ id, userId: user.id, codeId: null, name: clean, mime, size });
    return { n: clean, s: size, f: id };
  }
}
