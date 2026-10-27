/* =========================================================
   REGELS BIJ HET SCANNEN en de kleine pagina's voor de bezoeker
   (wachtwoord, verlopen, uitgezet, niet gevonden), link per toestel, Google Analytics-labels,
   en sleutels voor bestanden van beveiligde pagina's.
   ========================================================= */
import * as crypto from 'crypto';
import { LANGS, fromAcceptLanguage } from '../helpers/i18n-overrides';
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
/** Datum en tijd nu in een tijdzone (van de eigenaar): { d: 'YYYY-MM-DD', t: 'HH:MM' } */
export function nowIn(tz = 'Europe/Madrid', at = new Date()) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((x) => [x.type, x.value]));
    return { d: p.year + '-' + p.month + '-' + p.day, t: p.hour + ':' + p.minute };
  } catch { const i = at.toISOString(); return { d: i.slice(0, 10), t: i.slice(11, 16) }; }
}
type Now = string | { d: string; t: string };
const asNow = (n?: Now) => (n == null ? nowIn() : typeof n === 'string' ? { d: n, t: '00:00' } : n);
/** Afgelopen: na de einddatum (en eindtijd, anders de hele dag nog geldig) of het max. aantal scans bereikt */
export function isExpired(q: QrCode, now?: Now) {
  const c = q.content || {}, n = asNow(now);
  if (c.expires && (n.d > c.expires || (n.d === c.expires && c.expiresTime && n.t >= c.expiresTime))) return true;
  if (c.maxScans && q.scans >= Number(c.maxScans)) return true;
  return false;
}
/** Startdatum (KB Q224) en eventueel starttijd: daarvóór werkt de code nog niet */
export function notYet(q: QrCode, now?: Now) {
  const c = q.content || {}, n = asNow(now);
  return !!(c.starts && (n.d < c.starts || (n.d === c.starts && c.startsTime && n.t < c.startsTime)));
}
/** A/B-test: welke versie krijgt deze bezoeker? B met kans abShare % (standaard 50) */
export function abVariant(q: QrCode, rnd = Math.random()): 'A' | 'B' | null {
  const c = q.content || {}; if (!c.abUrl) return null;
  const share = Math.min(99, Math.max(1, Number(c.abShare) || 50));
  return rnd * 100 < share ? 'B' : 'A';
}
/* ---------- Slim doorsturen (Website > Meer opties > "Slim doorsturen") ----------
   Regels op volgorde; de eerste die past wint, anders de gewone link. Soorten:
   lang (taal van de telefoon), country (land, alleen als de land-database er is), time (tijd + dagen in de tijdzone van de eigenaar), device (iPhone/Android/computer).
   Niets wordt bewaard: we kijken alleen op het moment van scannen. */
export type RouteCtx = { lang: string; cc: string; now: { d: string; t: string }; ua: string };
export function parseRoute(v: unknown): any[] { try { const a = JSON.parse(String(v || '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
export function routeUrl(q: QrCode, ctx: RouteCtx): string | null {
  const list = parseRoute((q.content || {}).route); if (!list.length) return null;
  const dow = new Date(ctx.now.d + 'T12:00:00Z').getUTCDay();            // 0 = zondag
  const dev = /iPhone|iPad|iPod/i.test(ctx.ua) ? 'ios' : /Android/i.test(ctx.ua) ? 'android' : 'desktop';
  for (const r of list) {
    if (!r || !r.url) continue;
    if (r.k === 'lang' && r.v && ctx.lang === r.v) return r.url;
    if (r.k === 'country' && r.v && ctx.cc && ctx.cc === r.v) return r.url;
    if (r.k === 'device' && r.v === dev) return r.url;
    if (r.k === 'time' && r.f && r.t) {
      const night = r.f > r.t, inTime = night ? ctx.now.t >= r.f || ctx.now.t < r.t : ctx.now.t >= r.f && ctx.now.t < r.t;
      // bij een nachtregel (22:00–02:00) hoort na middernacht nog bij de dag ervoor
      const day = night && ctx.now.t < r.t ? (dow + 6) % 7 : dow;
      const dayOk = r.d === 'wd' ? day >= 1 && day <= 5 : r.d === 'we' ? day === 0 || day === 6 : true;
      if (inTime && dayOk) return r.url;
    }
  }
  return null;
}
/** Eerste taal van de telefoon ("es-ES,es;q=0.9" → "es") */
export const firstLang = (h: unknown) => String(h || '').split(',')[0].trim().slice(0, 2).toLowerCase();

export function targetUrl(q: QrCode, userAgent = '', variant: 'A' | 'B' | null = null, routed: string | null = null) {
  const c = q.content || {};
  let url = routed || (variant === 'B' && c.abUrl ? c.abUrl : c.url);
  if (!routed && /iPhone|iPad|iPod/i.test(userAgent) && c.iosUrl) url = c.iosUrl;
  else if (!routed && /Android/i.test(userAgent) && c.androidUrl) url = c.androidUrl;
  if (c.utm && url) {
    const u = new URL(url);
    const campaign = (c.title || q.id).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || q.id;
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'qr');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'qr_code');
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', campaign);
    if (variant && !u.searchParams.has('utm_content')) u.searchParams.set('utm_content', variant.toLowerCase());   // A/B: resultaat per versie in Google Analytics
    url = u.href;
  }
  return url;
}

/* ---------- Kleine pagina's voor de bezoeker (wachtwoord, verlopen) ---------- */
// Teksten in de taal van de bezoeker (uit public/locales/*.json, sleutel "visit")
const LOCALES: Record<string, Record<string, string>> = {};
LANGS.forEach((l) => { try { LOCALES[l] = JSON.parse(fs.readFileSync(path.join(PATHS.locales, l + '.json'), 'utf8')).visit; } catch (e) { /* taal ontbreekt */ } });
export function lang(req: Request) {
  const q = String((req.query && (req.query as any).lang) || '').toLowerCase();   // ?lang=nl: de taal die iemand in de app koos (zie PICK_LANG)
  if (LOCALES[q]) return q;
  return fromAcceptLanguage(req.get('accept-language'), (l) => !!LOCALES[l]);
}
/** In de <head> van onze eigen pagina's (404, /status): heeft iemand in de app een taal gekozen, dan die gebruiken in plaats van de browsertaal */
const PICK_LANG = '<script>try{var s=localStorage.getItem("optimasys-lang");if(s&&/^[a-z]{2}$/.test(s)&&s!==document.documentElement.lang&&!/[?&]lang=/.test(location.search)){var u=new URL(location.href);u.searchParams.set("lang",s);location.replace(u.toString())}}catch(e){}</script>';
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
/** Abonnement van de eigenaar niet betaald: code tijdelijk niet actief (zonder te zeggen waarom) */
export function inactivePage(req: Request) { const t = text(req); return page(t.inactive || t.paused, '<div class="ic">⏸</div><h1>' + esc(t.inactive || t.paused) + '</h1><p>' + esc(t.inactiveText || t.pausedText) + '</p>', lang(req)); }
export function notYetPage(req: Request, from: string) {
  const t = text(req), l = lang(req);
  let d = from; try { d = new Intl.DateTimeFormat(l, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(from + 'T00:00:00Z')); } catch (e) { /* zoals het is */ }
  return page(t.notYet || t.paused, '<div class="ic">🗓</div><h1>' + esc(t.notYet || t.paused) + '</h1><p>' + esc(String(t.notYetText || '').replace('{date}', d)) + '</p>', l);
}
export function pausedPage(req: Request) { const t = text(req); return page(t.paused, '<div class="ic">⏸</div><h1>' + esc(t.paused) + '</h1><p>' + esc(t.pausedText) + '</p>', lang(req)); }
export function notFoundPage(req: Request) { const t = text(req); return page(t.notFound, '<div class="ic">?</div><h1>' + esc(t.notFound) + '</h1>', lang(req)); }

// Bestanden (PDF/MP3) van een beveiligde pagina: alleen ophalen met een sleutel die we pas na het juiste wachtwoord meegeven.
const FILE_SECRET = process.env.FILE_SECRET || crypto.randomBytes(32).toString('hex');
export function fileToken(q: QrCode, key: string) { return crypto.createHmac('sha256', FILE_SECRET).update(q.id + ':' + key + ':' + String((q.content || {}).password || '')).digest('base64url').slice(0, 22); }
export function fileTokenOk(q: QrCode, key: string, token: unknown) { const a = Buffer.from(fileToken(q, key)), b = Buffer.from(String(token || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); }


/** Onbekend adres op de site zelf (geen QR-code): 404 met het QR Runner-spelletje (public/404.html), in de taal van de bezoeker */
let tpl404: string | null = null;
export function appNotFoundPage(req: Request) {
  const t = text(req), l = lang(req);
  if (tpl404 == null) { try { tpl404 = fs.readFileSync(path.join(PATHS.public, '404.html'), 'utf8'); } catch (e) { tpl404 = ''; } }
  const k = ['sub', 'sub2', 'start', 'startBtn', 'hint', 'lost', 'again', 'newBest', 'soundOn', 'soundOff'];
  const L: Record<string, string> = { lang: l, title: t.page404Title, home: t.page404Btn };
  k.forEach((x) => { L[x] = t['g404' + x[0].toUpperCase() + x.slice(1)]; });
  const json = JSON.stringify(L).replace(/</g, '\\u003c');
  if (!tpl404) return page(t.page404Title, '<div class="ic">?</div><h1>' + esc(t.page404Title) + '</h1><p><a href="/">' + esc(t.page404Btn) + '</a></p>', l);
  return tpl404.replace('<html lang="en" data-404>', '<html lang="' + l + '" data-404>').replace('<meta charset="utf-8">', () => '<meta charset="utf-8">' + PICK_LANG)
    .replace('<script id="t404" type="application/json">{}</script>', () => '<script id="t404" type="application/json">' + json + '</script>');
}

/** Openbare pagina "Storingen en meldingen" (/status): werkt alles, lopende storing of onderhoud, en eerdere meldingen */
type StatusData = { state: string; maintenance: { on: boolean; message: string }; open: any[]; history: any[] };
export function statusPage(req: Request, s: StatusData) {
  const t = text(req), l = lang(req);
  const when = (iso: string) => { try { return new Intl.DateTimeFormat(l, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(iso)); } catch (e) { return iso.slice(0, 16).replace('T', ' '); } };
  const day = (iso: string) => { try { return new Intl.DateTimeFormat(l, { dateStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(iso)); } catch (e) { return iso.slice(0, 10); } };
  const para = (x: string) => x ? '<p>' + esc(x).replace(/\n/g, '<br>') + '</p>' : '';
  const ups = (u: any[]) => (u && u.length ? '<ol class="ups">' + u.slice().reverse().map((x) => '<li><time>' + esc(when(x.at)) + '</time>' + para(x.text) + '</li>').join('') + '</ol>' : '');
  const now = s.state === 'incident'
    ? s.open.map((i) => '<section class="now bad" role="alert"><div class="dot"></div><div><h2>' + esc(t.stDown) + ': ' + esc(i.title) + '</h2><small>' + esc(String(t.stSince).replace('{date}', when(i.at))) + '</small>' + para(i.text) + ups(i.updates) + '</div></section>').join('')
    : s.state === 'maintenance'
      ? '<section class="now warn" role="status"><div class="dot"></div><div><h2>' + esc(t.stMaint) + '</h2>' + para(s.maintenance.message || t.stMaintText) + (s.maintenance.message ? para(t.stMaintText) : '') + '</div></section>'
      : '<section class="now ok" role="status"><div class="dot"></div><div><h2>' + esc(t.stOk) + '</h2><p>' + esc(t.stOkText) + '</p></div></section>';
  const hist = s.history.length
    ? '<ul class="hist">' + s.history.map((i) => '<li><details><summary><span class="d">' + esc(day(i.at)) + '</span> <span class="tt">' + esc(i.title) + '</span> <span class="tag">' + esc(t.stSolved) + '</span></summary>' + para(i.text) + ups(i.updates) +
        (i.solvedAt ? '<p class="sv">' + esc(t.stSolved) + ': ' + esc(when(i.solvedAt)) + '</p>' : '') + '</details></li>').join('') + '</ul>'
    : '<p class="none">' + esc(t.stNone) + '</p>';
  return '<!doctype html><html lang="' + l + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(t.stTitle) + ' · QR-Codex</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/css/fonts.css">' +
    '<meta http-equiv="refresh" content="60">' + PICK_LANG + '<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse 80% 50% at 50% 0,rgba(30,90,170,.28),transparent 70%),#050b17;color:#eef3fb;font:16px/1.5 Manrope,system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '.top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:820px;margin:0 auto;padding:22px 20px}.top a{color:inherit;text-decoration:none;display:flex;align-items:center;gap:10px;font-weight:700}.top img{width:34px;height:34px}.top b span{color:#3aa8f0}.top .back{font-weight:600;color:#3aa8f0;font-size:14px}' +
    'main{max-width:820px;margin:0 auto;padding:10px 20px 60px}h1{font-size:clamp(28px,5vw,40px);letter-spacing:-.02em;margin:10px 0 6px}.lead{color:#9aa6b5;margin:0 0 26px}' +
    '.now{display:flex;gap:14px;padding:20px 22px;border-radius:18px;border:1px solid rgba(255,255,255,.1);margin-bottom:14px}.now h2{margin:0;font-size:19px}.now p{margin:8px 0 0;color:#d5deea}.now small{color:#9aa6b5}' +
    '.dot{flex:none;width:14px;height:14px;border-radius:50%;margin-top:6px}.ok{background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.35)}.ok .dot{background:#22c55e;box-shadow:0 0 0 5px rgba(34,197,94,.2)}' +
    '.bad{background:rgba(255,84,112,.1);border-color:rgba(255,84,112,.45)}.bad .dot{background:#ff5470;box-shadow:0 0 0 5px rgba(255,84,112,.22);animation:p 1.6s infinite}.warn{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.45)}.warn .dot{background:#f59e0b;box-shadow:0 0 0 5px rgba(245,158,11,.2)}' +
    '@keyframes p{50%{box-shadow:0 0 0 9px rgba(255,84,112,0)}}@media (prefers-reduced-motion:reduce){.bad .dot{animation:none}}' +
    '.ups{list-style:none;margin:12px 0 0;padding:0 0 0 14px;border-left:2px solid rgba(255,255,255,.12)}.ups li{margin:0 0 10px}.ups time{font-size:13px;color:#9aa6b5}.ups p{margin:2px 0 0}' +
    'h3{font-size:18px;margin:36px 0 8px}.hist{list-style:none;margin:0;padding:0}.hist li{border-bottom:1px solid rgba(255,255,255,.1)}summary{cursor:pointer;padding:14px 0;list-style:none;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}summary::-webkit-details-marker{display:none}' +
    '.d{color:#9aa6b5;font-variant-numeric:tabular-nums}.tt{font-weight:600}.tag{font-size:12px;font-weight:700;color:#22c55e;background:rgba(34,197,94,.12);border-radius:999px;padding:2px 9px}details p{margin:0 0 10px;color:#d5deea}.sv{font-size:13px;color:#9aa6b5!important}.none{color:#9aa6b5}' +
    'a:focus-visible,summary:focus-visible{outline:2px solid #fff;outline-offset:3px;border-radius:6px}</style></head><body>' +
    '<div class="top"><a href="/"><img src="/icons/logo-badge.png" alt=""><b>QR-<span>Codex</span></b></a><a class="back" href="/">' + esc(t.page404Btn) + ' →</a></div>' +
    '<main><h1>' + esc(t.stTitle) + '</h1><p class="lead">' + esc(t.stLead) + '</p>' + now + '<h3>' + esc(t.stHistory) + '</h3>' + hist + '</main></body></html>';
}
