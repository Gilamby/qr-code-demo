/* =========================================================
   QR-CODES: opslaan, bewerken, bestanden en wat er naar buiten gaat
   ========================================================= */
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService, newId } from '../database/database.service';
import { baseUrl } from '../config/env';
import { QR_TYPES } from './validation';
import type { QrCode } from '../types';

/** Wachtwoord van de pagina (veld met type 'password'). Het wifi-wachtwoord is gewone inhoud (versleuteld opgeslagen). */
export const secretKey = (typeId: string): string | null => {
  const t = QR_TYPES.find((x) => x.id === typeId); const f = t && t.fields.find((x) => x.type === 'password'); return f ? f.key : null;
};
const fileFields = (typeId: string): string[] => { const t = QR_TYPES.find((x) => x.id === typeId); return t ? t.fields.filter((f) => f.type === 'file').map((f) => f.key) : []; };
const galleryFields = (typeId: string): string[] => { const t = QR_TYPES.find((x) => x.id === typeId); return t ? t.fields.filter((f) => f.type === 'gallery').map((f) => f.key) : []; };
export const cleanName = (v: unknown) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 60);
export const newCodeId = () => crypto.randomBytes(5).toString('base64url');   // bv. "aZ3k9Qp"
/** Nieuw id dat nog nooit is gebruikt (ook niet door een verwijderde code: een oude, geprinte QR-code mag nooit bij iemand anders uitkomen) */
export async function freshCodeId(db: { idTaken(id: string): Promise<boolean> }) {
  for (let i = 0; i < 20; i++) { const id = newCodeId(); if (!(await db.idTaken(id))) return id; }
  throw new Error('no free id');
}
export const missingRequired = (typeId: string, content: Record<string, any>) => {
  const t = QR_TYPES.find((x) => x.id === typeId); return t.fields.filter((f) => f.required && (QR_TYPES as any).active(t, f, content) && !content[f.key] && !(f.or && content[f.or])).map((f) => f.key + ': required');
};

@Injectable()
export class QrCodesService {
  constructor(private readonly db: DatabaseService) {}

  /** Naar buiten: nooit het (gehashte) wachtwoord, nooit het bestand zelf; wel de korte link */
  out(req: Request, q: QrCode) {
    const content = { ...q.content }, key = secretKey(q.typeId);
    const hasPassword = !!(key && content[key]); if (key) delete content[key];
    Object.keys(content).forEach((k) => { if (typeof content[k] === 'string' && content[k].indexOf('"d":"data:') > 0) { try { const o = JSON.parse(content[k]); delete o.d; content[k] = JSON.stringify(o); } catch (e) { /* geen JSON */ } } });
    const r: any = { ...q, content, hasPassword, shortUrl: baseUrl(req) + '/q/' + q.id }; delete r.userId;
    // De klant ziet alleen dát het team de code heeft gepauzeerd (en waarom); een markering is intern
    const hold = q.moderation && q.moderation.hold; delete r.moderation;
    if (hold) r.hold = { reason: hold.reason, at: hold.at, lock: !!hold.lock };
    return r;
  }

  /** Bij dupliceren: elk bestand (PDF, MP3, video, foto's) krijgt een eigen kopie voor de nieuwe code,
   *  zodat het verwijderen van de ene code de andere niet kapotmaakt. Geeft de nieuwe bestanden terug:
   *  die worden na het opslaan van de nieuwe code aan die code gekoppeld (attachFile). */
  async copyFiles(userId: string, typeId: string, content: Record<string, any>) {
    const made: string[] = [];
    const copy = async (fileId: string) => {
      const f = await this.db.getFile(fileId); if (!f || f.user_id !== userId) return null;
      const id = newId(16);
      try { fs.copyFileSync(f.path, path.join(this.db.filesDir, id)); } catch (e) { return null; }
      await this.db.addFileRecord({ id, userId, codeId: null, name: f.name, mime: f.mime, size: f.size });
      made.push(id); return id;
    };
    for (const key of fileFields(typeId)) {
      if (!content[key]) continue;
      try { const o = JSON.parse(content[key]); const id = o.f && await copy(o.f); if (id) content[key] = JSON.stringify({ ...o, f: id }); else delete content[key]; } catch (e) { delete content[key]; }
    }
    for (const key of galleryFields(typeId)) {
      if (!content[key]) continue;
      const out = [];
      try { for (const x of JSON.parse(content[key])) { if (x && x.f) { const id = await copy(x.f); if (id) out.push({ ...x, f: id }); } } } catch (e) { /* kapotte galerij: overslaan */ }
      if (out.length) content[key] = JSON.stringify(out); else delete content[key];
    }
    return { content, files: made };
  }

  /** PDF/MP3 uit de inhoud halen en als bestand op schijf zetten; in de inhoud blijft { n, s, f } over */
  async storeFiles(userId: string, typeId: string, content: Record<string, any>, codeId: string | null) {
    const keep: string[] = [];
    for (const key of fileFields(typeId)) {
      if (!content[key]) continue;
      const o = JSON.parse(content[key]);
      if (o.d) {
        const m = o.d.match(/^data:([\w/.+-]+);base64,(.*)$/); if (!m) { delete content[key]; continue; }
        const buffer = Buffer.from(m[2], 'base64');
        const id = await this.db.saveFile({ userId, codeId, name: o.n, mime: m[1], buffer });
        content[key] = JSON.stringify({ n: o.n, s: buffer.length, f: id }); keep.push(id);
      } else if (o.f) {
        const f = await this.db.getFile(o.f);                           // alleen een eigen bestand van deze code
        if (!f || f.user_id !== userId || (codeId && f.code_id && f.code_id !== codeId)) delete content[key];
        else { content[key] = JSON.stringify({ n: o.n, s: f.size, f: f.id }); keep.push(f.id); }
      } else delete content[key];
    }
    // Fotogalerij: elke foto is een eigen bestand. Oude data-URL's worden bij opslaan ook een bestand.
    for (const key of galleryFields(typeId)) {
      if (!content[key]) continue;
      const out: { f: string; w?: number; h?: number }[] = [];
      for (const x of JSON.parse(content[key])) {
        if (typeof x === 'string') {
          const m = x.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/); if (!m) continue;
          const id = await this.db.saveFile({ userId, codeId, name: 'foto-' + (out.length + 1) + '.' + m[1].split('/')[1].replace('jpeg', 'jpg'), mime: m[1], buffer: Buffer.from(m[2], 'base64') });
          out.push({ f: id }); keep.push(id);
        } else {
          const f = await this.db.getFile(x.f);
          if (!f || f.user_id !== userId || !/^image\//.test(f.mime) || (codeId ? f.code_id && f.code_id !== codeId : f.code_id)) continue;
          out.push(x.w && x.h ? { f: f.id, w: x.w, h: x.h } : { f: f.id }); keep.push(f.id);
        }
      }
      if (out.length) content[key] = JSON.stringify(out); else delete content[key];
    }
    return keep;
  }
}
