/* =========================================================
   STATISTIEKEN: wat er bij een scan wordt vastgelegd, en het overzicht
   Privacy (zie docs/juridisch.md):
   - Het IP-adres wordt alleen in het geheugen gebruikt om land en stad op te zoeken
     in een eigen database (DB-IP Lite). Het wordt nooit opgeslagen of doorgestuurd.
   - Van de browser bewaren we alleen het soort systeem (iOS, Android, Windows, …).
   - "Uniek" = een dagcode: hash(geheim van vandaag + IP + browser + code). Het geheim
     staat alleen in het geheugen en is de volgende dag weg; de codes worden dan ook gewist.
     Er worden geen cookies gebruikt.
   Opslag per QR-code per dag: { "iOS|NL|Amsterdam": [scans, uniek] }.
   ========================================================= */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as maxmind from 'maxmind';
import type { Request } from 'express';
import { PATHS, shared } from '../config/env';
import type { QrCode } from '../types';


/* ---------- Land en stad (offline database) ---------- */
const geo: { v4: any; v6: any; ready: boolean } = { v4: null, v6: null, ready: false };
function findDb(file: string) {
  const tries = [
    process.env['GEO_DB_' + (file.includes('ipv6') ? 'V6' : 'V4')],
    path.join(PATHS.data, 'geo', file),
    (() => { try { return require.resolve('@ip-location-db/dbip-city-mmdb/' + file); } catch (e) { return null; } })()
  ];
  return tries.find((p) => p && fs.existsSync(p)) || null;
}
export async function loadGeo() {
  try {
    // 1) Officiële maandelijkse download van db-ip.com (één bestand voor IPv4 + IPv6): GEO_DB of server/data/geo/dbip-city-lite.mmdb
    const one = [process.env.GEO_DB, path.join(PATHS.data, 'geo', 'dbip-city-lite.mmdb')].find((p) => p && fs.existsSync(p));
    if (one) { geo.v4 = geo.v6 = await maxmind.open(one); }
    else {
      // 2) Losse bestanden (npm-pakket @ip-location-db/dbip-city-mmdb)
      const p4 = findDb('dbip-city-ipv4.mmdb'), p6 = findDb('dbip-city-ipv6.mmdb');
      if (p4) geo.v4 = await maxmind.open(p4);
      if (p6) geo.v6 = await maxmind.open(p6);
    }
    geo.ready = !!(geo.v4 || geo.v6);
    console.log(geo.ready ? 'Statistieken: land/stad-database geladen' : 'Statistieken: geen land/stad-database (zie docs/statistieken.md)');
  } catch (e) { console.log('Statistieken: land/stad niet beschikbaar (' + e.message + ')'); }
}
export function place(ip: string) {
  ip = String(ip || '').replace(/^::ffff:/, '');
  if (!geo.ready || !ip) return { cc: '', city: '' };
  try {
    const r = (ip.includes(':') ? geo.v6 : geo.v4) && (ip.includes(':') ? geo.v6 : geo.v4).get(ip);
    if (!r) return { cc: '', city: '' };
    // Twee formaten: npm-pakket { country_code, city } of officieel { country: { iso_code }, city: { names: { en } } }
    const cc = r.country_code || (r.country && r.country.iso_code) || '';
    const city = typeof r.city === 'string' ? r.city : (r.city && r.city.names && (r.city.names.en || Object.values(r.city.names)[0])) || '';
    return { cc: String(cc).toUpperCase().slice(0, 2), city: String(city).replace(/\s*\(.*\)\s*$/, '').slice(0, 60) };
  } catch (e) { return { cc: '', city: '' }; }
}

/* ---------- Besturingssysteem (alleen de soort) ---------- */
export function os(ua: string) {
  ua = String(ua || '');
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'other';
}

/* ---------- Unieke bezoekers per dag, zonder cookies ---------- */
let today = '', salt: Buffer = null, seen = new Set<string>();
function isNew(id: string, ip: string, ua: string) {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== today) { today = day; salt = crypto.randomBytes(32); seen = new Set(); }   // nieuw geheim, oude codes weg
  const h = crypto.createHmac('sha256', salt).update(id + '\n' + ip + '\n' + ua).digest('base64url').slice(0, 22);
  if (seen.has(h)) return false;
  seen.add(h); return true;
}

// Eén scan: wat er bewaard wordt (zonder IP of volledige browsergegevens)
export function describe(q: QrCode, req: Request) {
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || '', ua = req.get('user-agent') || '';
  const p = place(ip);
  return { key: [os(ua), p.cc, p.city].join('|'), unique: isNew(q.id, ip, ua) };
}

/* ---------- Overzicht en export: gedeeld met de online demo (shared/analytics-core.js) ---------- */
const core = shared('analytics-core.js');
export const overview = (codes: QrCode[], query: Record<string, any>) => Object.assign(core.overview(codes, query), { geo: geo.ready });
export const csv = (codes: QrCode[], query: Record<string, any>, nameOf: (q: QrCode) => string): string => core.csv(codes, query, nameOf);
