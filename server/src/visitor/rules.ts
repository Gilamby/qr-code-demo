/* =========================================================
   REGELS BIJ HET SCANNEN en de kleine pagina's voor de bezoeker
   (wachtwoord, verlopen, uitgezet, niet gevonden), link per toestel, Google Analytics-labels,
   en sleutels voor bestanden van beveiligde pagina's.
   ========================================================= */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Request } from 'express';
import { PATHS } from '../config/env';
import type { QrCode } from '../types';

/* ---------- Wachtwoord veilig bewaren (nooit als leesbare tekst) ---------- */
export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
export function checkPassword(pw: string, stored: string) {
  const [, salt, hash] = String(stored).split('$');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex'), b = crypto.scryptSync(String(pw), salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- Regels bij het scannen ---------- */
export function isExpired(q: QrCode, today = new Date().toISOString().slice(0, 10)) {
  const c = q.content || {};
  if (c.expires && today > c.expires) return true;
  if (c.maxScans && q.scans >= Number(c.maxScans)) return true;
  return false;
}
export function targetUrl(q: QrCode, userAgent = '') {
  const c = q.content || {};
  let url = c.url;
  if (/iPhone|iPad|iPod/i.test(userAgent) && c.iosUrl) url = c.iosUrl;
  else if (/Android/i.test(userAgent) && c.androidUrl) url = c.androidUrl;
  if (c.utm && url) {
    const u = new URL(url);
    const campaign = (c.title || q.id).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || q.id;
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'qr');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'qr_code');
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', campaign);
    url = u.href;
  }
  return url;
}

/* ---------- Kleine pagina's voor de bezoeker (wachtwoord, verlopen) ---------- */
// Teksten in de taal van de bezoeker (uit public/locales/*.json, sleutel "visit")
const LOCALES: Record<string, Record<string, string>> = {};
['nl', 'en', 'de', 'es', 'fr', 'it', 'pl', 'pt', 'el', 'sq'].forEach((l) => { try { LOCALES[l] = JSON.parse(fs.readFileSync(path.join(PATHS.locales, l + '.json'), 'utf8')).visit; } catch (e) { /* taal ontbreekt */ } });
export function lang(req: Request) {
  const list = String(req.get('accept-language') || '').split(',').map((x) => x.trim().slice(0, 2).toLowerCase());
  return list.find((l) => LOCALES[l]) || 'en';
}
const text = (req: Request) => Object.assign({}, LOCALES.en, LOCALES[lang(req)]);
const esc = (s: string) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
function page(title: string, body: string, lng?: string) {
  return '<!doctype html><html lang="' + (lng || 'en') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f4f7;font:16px -apple-system,system-ui,sans-serif;color:#111}' +
    'main{width:min(360px,88vw);background:#fff;border-radius:20px;padding:28px 24px;box-shadow:0 20px 50px -20px rgba(0,0,0,.25);text-align:center}' +
    '.ic{width:56px;height:56px;margin:0 auto 14px;border-radius:16px;background:#eef6fd;color:#0b8fd8;display:grid;place-items:center;font-size:26px}' +
    'h1{font-size:20px;margin:0 0 6px}p{margin:0 0 18px;color:#5b6472;font-size:14.5px;line-height:1.45}' +
    'input{width:100%;box-sizing:border-box;height:48px;border:1px solid #d6dbe1;border-radius:12px;padding:0 14px;font-size:16px;margin-bottom:10px}' +
    'button{width:100%;height:48px;border:0;border-radius:12px;background:#0b8fd8;color:#fff;font-weight:700;font-size:16px}.err{color:#d33a2c;font-size:14px;margin:-4px 0 10px}</style></head>' +
    '<body><main>' + body + '</main></body></html>';
}
export function passwordPage(req: Request, wrong: boolean) {
  const t = text(req);
  return page(t.locked, '<div class="ic">🔒</div><h1>' + esc(t.locked) + '</h1><p>' + esc(t.enter) + '</p><form method="post">' +
    '<input type="text" name="username" autocomplete="username" value="" style="position:absolute;left:-9999px" tabindex="-1" aria-hidden="true"><input type="password" name="password" autocomplete="current-password" autofocus required>' + (wrong ? '<div class="err">' + esc(t.wrong) + '</div>' : '') + '<button>' + esc(t.open) + '</button></form>', lang(req));
}
export function expiredPage(req: Request) { const t = text(req); return page(t.expired, '<div class="ic">⌛</div><h1>' + esc(t.expired) + '</h1><p>' + esc(t.expiredText) + '</p>', lang(req)); }
export function pausedPage(req: Request) { const t = text(req); return page(t.paused, '<div class="ic">⏸</div><h1>' + esc(t.paused) + '</h1><p>' + esc(t.pausedText) + '</p>', lang(req)); }
export function notFoundPage(req: Request) { const t = text(req); return page(t.notFound, '<div class="ic">?</div><h1>' + esc(t.notFound) + '</h1>', lang(req)); }

// Bestanden (PDF/MP3) van een beveiligde pagina: alleen ophalen met een sleutel die we pas na het juiste wachtwoord meegeven.
const FILE_SECRET = process.env.FILE_SECRET || crypto.randomBytes(32).toString('hex');
export function fileToken(q: QrCode, key: string) { return crypto.createHmac('sha256', FILE_SECRET).update(q.id + ':' + key + ':' + String((q.content || {}).password || '')).digest('base64url').slice(0, 22); }
export function fileTokenOk(q: QrCode, key: string, token: unknown) { const a = Buffer.from(fileToken(q, key)), b = Buffer.from(String(token || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); }

