/* =========================================================
   QR-CODES: opslaan, bewerken, bestanden en wat er naar buiten gaat
   ========================================================= */
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { baseUrl } from '../config/env';
import { QR_TYPES } from './validation';
import type { QrCode } from '../types';

/** Wachtwoord van de pagina (veld met type 'password'). Het wifi-wachtwoord is gewone inhoud (versleuteld opgeslagen). */
export const secretKey = (typeId: string): string | null => {
  const t = QR_TYPES.find((x) => x.id === typeId); const f = t && t.fields.find((x) => x.type === 'password'); return f ? f.key : null;
};
const fileFields = (typeId: string): string[] => { const t = QR_TYPES.find((x) => x.id === typeId); return t ? t.fields.filter((f) => f.type === 'file').map((f) => f.key) : []; };
export const cleanName = (v: unknown) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 60);
export const newCodeId = () => crypto.randomBytes(5).toString('base64url');   // bv. "aZ3k9Qp"
export const missingRequired = (typeId: string, content: Record<string, any>) => {
  const t = QR_TYPES.find((x) => x.id === typeId); return t.fields.filter((f) => f.required && !content[f.key]).map((f) => f.key + ': required');
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
    return r;
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
    return keep;
  }
}
