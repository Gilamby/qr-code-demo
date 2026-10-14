/* =========================================================
   EIGEN ACHTERGRONDEN (Mijn account > Achtergrond)
   GET    /api/account/media          lijst (nieuwste eerst)
   POST   /api/account/media?name=…   foto (JPG/PNG/WebP, max 8 MB) of video (MP4/WebM, max BG_VIDEO_MAX_MB, standaard 50)
                                      als ruwe body; komt erbij (overschrijft niets) en wordt NIET meteen de achtergrond
   GET    /api/account/media/:id      het bestand (alleen voor de eigenaar)
   DELETE /api/account/media/:id      weg; was het de achtergrond, dan terug naar "optimasys"
   Max. 12 eigen achtergronden per gebruiker. Bestanden staan in <DATA_DIR>/files (naam = id), de lijst in users.media.
   ========================================================= */
import { Controller, Delete, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService, newId, removeFiles } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { fail } from '../common/http';
import type { MediaItem, User } from '../types';

const IMAGES = ['image/jpeg', 'image/png', 'image/webp'], VIDEOS = ['video/mp4', 'video/webm'];
const IMAGE_MAX = 8 * 1048576, videoMax = () => (Number(process.env.BG_VIDEO_MAX_MB) || 50) * 1048576, MAX_ITEMS = 12;
/** Klopt het bestand echt met het type? (eerste bytes) */
function sniff(file: string, mime: string) {
  const fd = fs.openSync(file, 'r'), b = Buffer.alloc(16); fs.readSync(fd, b, 0, 16, 0); fs.closeSync(fd);
  if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8;
  if (mime === 'image/png') return b.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (mime === 'image/webp') return b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP';
  if (mime === 'video/mp4') return b.slice(4, 8).toString('latin1') === 'ftyp';
  if (mime === 'video/webm') return b.slice(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

@Controller('api/account/media')
@UseGuards(LoggedIn)
export class MediaController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  @Get()
  async list(@CurrentUser() user: User) { return { items: user.media || [], max: MAX_ITEMS, videoMaxMb: videoMax() / 1048576 }; }

  @Post()
  @HttpCode(201)
  async upload(@Req() req: Request, @CurrentUser() user: User, @Query('name') name = '') {
    if (this.auth.limited('media:' + user.id, 40, 60)) throw fail(429, 'too_many');
    const items = (await this.db.getUser(user.id)).media || [];
    if (items.length >= MAX_ITEMS) throw fail(409, 'media_full', { max: MAX_ITEMS });
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const kind = IMAGES.includes(mime) ? 'image' : VIDEOS.includes(mime) ? 'video' : null;
    if (!kind) throw fail(415, 'media_type');
    const max = kind === 'image' ? IMAGE_MAX : videoMax();
    if (Number(req.headers['content-length'] || 0) > max) throw fail(413, 'too_big', { maxMb: max / 1048576 });
    const id = 'bg' + newId(15), file = path.join(this.db.filesDir, id);
    const size = await new Promise<number>((resolve, reject) => {
      let n = 0, done = false;
      const out = fs.createWriteStream(file, { flags: 'wx', mode: 0o600 });
      const stop = (e: Error) => { if (done) return; done = true; req.unpipe(out); out.destroy(); fs.unlink(file, () => {}); reject(e); };
      req.on('data', (c: Buffer) => { n += c.length; if (n > max) stop(fail(413, 'too_big', { maxMb: max / 1048576 })); });
      req.on('aborted', () => stop(fail(400, 'aborted'))); req.on('error', stop); out.on('error', stop);
      out.on('finish', () => { if (!done) { done = true; resolve(n); } });
      req.pipe(out);
    });
    if (!size || !sniff(file, mime)) { fs.unlink(file, () => {}); throw fail(415, 'media_type'); }
    const item: MediaItem = { id, kind, mime, size, name: String(name).replace(/[\\/\r\n"<>]/g, '_').trim().slice(0, 80) || (kind === 'image' ? 'foto' : 'video'), at: new Date().toISOString() };
    const fresh = (await this.db.getUser(user.id)).media || [];          // opnieuw lezen: twee uploads tegelijk overschrijven elkaar niet
    if (fresh.length >= MAX_ITEMS) { fs.unlink(file, () => {}); throw fail(409, 'media_full', { max: MAX_ITEMS }); }
    await this.db.updateUser(user.id, { media: JSON.stringify([item, ...fresh]) });
    return item;
  }

  @Get(':id')
  async file(@Res() res: Response, @CurrentUser() user: User, @Param('id') id: string) {
    const item = (user.media || []).find((m) => m.id === id);
    if (!item) return res.status(404).json({ error: 'not_found' });
    res.set('Content-Type', item.mime).set('X-Content-Type-Options', 'nosniff').set('Cache-Control', 'private, max-age=86400');
    return res.sendFile(path.join(this.db.filesDir, id), { dotfiles: 'allow', acceptRanges: true }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    const items = user.media || [];
    if (!items.some((m) => m.id === id)) throw fail(404, 'not_found');
    const patch: any = { media: JSON.stringify(items.filter((m) => m.id !== id)) };
    if (user.background === 'media:' + id) patch.background = 'optimasys';   // was de achtergrond: veilig terug naar de standaard
    await this.db.updateUser(user.id, patch);
    removeFiles([id]);
  }
}
