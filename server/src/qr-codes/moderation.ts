/* =========================================================
   CONTROLE VOOR HET BEHEER (Beheer > Alle QR-codes)
   - destinationOf: waar gaat de code naartoe? (link, bestand, eigen pagina of vast: wifi/contact)
   - problemOf:     ontbreekt de bestemming, of is hij ongeldig?
   - riskOf:        lijkt de link op phishing/misbruik? (alleen een signaal: het team beslist zelf)
   - scanPattern:   verdachte scans: plotselinge piek, of heel veel scans van steeds dezelfde bezoekers
   Niets hiervan zet een code automatisch uit: het team ziet een waarschuwing en kiest zelf.
   ========================================================= */
import * as net from 'net';
import { QR_TYPES } from './validation';
import type { QrCode } from '../types';

export const STATIC = ['contact', 'wifi'];       // inhoud zit in de code zelf: geen link, geen scans

export type Destination = { kind: 'url' | 'file' | 'page' | 'static'; value?: string; field?: string };
export type Problem = 'missing' | 'invalid' | null;

const typeOf = (q: QrCode) => QR_TYPES.find((t) => t.id === q.typeId);
const isHttp = (v: string) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; } };

/** De belangrijkste bestemming van een code */
export function destinationOf(q: QrCode): Destination {
  const t = typeOf(q); if (!t) return { kind: 'page' };
  if (STATIC.includes(t.contentType)) return { kind: 'static' };
  const c = q.content || {}, active = (f: any) => (QR_TYPES as any).active(t, f, c);
  const url = t.fields.find((f: any) => f.type === 'url' && active(f) && c[f.key]);
  const file = t.fields.find((f: any) => f.type === 'file' && active(f) && c[f.key]);
  if (!(QR_TYPES as any).hasPage(t, c)) {
    if (url) return { kind: 'url', value: String(c[url.key]), field: url.key };
    if (file) { let n = ''; try { n = JSON.parse(c[file.key]).n; } catch (e) { /* */ } return { kind: 'file', value: n, field: file.key }; }
    const need = t.fields.find((f: any) => (f.type === 'url' || f.type === 'file') && f.required && active(f));
    return need ? { kind: need.type === 'file' ? 'file' : 'url', field: need.key } : { kind: 'page' };
  }
  return url ? { kind: 'page', value: String(c[url.key]), field: url.key } : { kind: 'page' };
}

/** Ontbreekt de bestemming (verplicht veld leeg) of is de link geen geldige http(s)-link? */
export function problemOf(q: QrCode, d = destinationOf(q)): Problem {
  if ((d.kind === 'url' || d.kind === 'file') && !d.value) return 'missing';
  if (d.kind === 'url' && !isHttp(d.value)) return 'invalid';
  const t = typeOf(q), c = q.content || {};
  if (t) for (const f of t.fields) {
    if (f.required && (QR_TYPES as any).active(t, f, c) && !c[f.key] && !(f.or && c[f.or]) && f.type !== 'password') return 'missing';
  }
  return null;
}

/* ---------- Phishing-signalen ---------- */
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rebrand.ly', 'ow.ly', 's.id', 'shorturl.at', 'rb.gy', 'tiny.cc', 'v.gd', 'buff.ly', 'bl.ink'];
const ODD_TLDS = ['zip', 'mov', 'xyz', 'top', 'click', 'country', 'gq', 'tk', 'ml', 'cf', 'ga', 'work', 'support', 'rest', 'cam', 'quest', 'icu', 'buzz', 'monster'];
// Merken die vaak worden nagemaakt, met hun echte domeinen
const BRANDS: Record<string, string[]> = {
  paypal: ['paypal.com', 'paypal.me'], apple: ['apple.com', 'icloud.com'], microsoft: ['microsoft.com', 'live.com', 'office.com', 'outlook.com'],
  google: ['google.com', 'google.nl', 'goo.gl', 'youtube.com'], amazon: ['amazon.com', 'amazon.nl', 'amazon.de'], netflix: ['netflix.com'],
  ing: ['ing.nl', 'ing.com'], rabobank: ['rabobank.nl', 'rabobank.com'], abnamro: ['abnamro.nl', 'abnamro.com'], bunq: ['bunq.com'], knab: ['knab.nl'],
  postnl: ['postnl.nl'], dhl: ['dhl.com', 'dhl.nl', 'dhlparcel.nl'], belastingdienst: ['belastingdienst.nl'], digid: ['digid.nl'],
  facebook: ['facebook.com', 'fb.com'], instagram: ['instagram.com'], whatsapp: ['whatsapp.com', 'wa.me'], linkedin: ['linkedin.com'],
  binance: ['binance.com'], coinbase: ['coinbase.com'], metamask: ['metamask.io'],
};
const LURE = /(log-?in|sign-?in|verif|account|wallet|password|wachtwoord|update|secure|unlock|claim|refund|betaal|invoice|factuur)/i;
const regDomain = (host: string) => { const p = host.split('.'); return p.length > 2 && /^(co|com|org|net|gov|ac)$/.test(p[p.length - 2]) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };

/** Signalen dat een link misbruik kan zijn: ip, punycode, shortener, tld, brand, at, lure */
export function riskOf(url: string): string[] {
  let u: URL; try { u = new URL(url); } catch (e) { return []; }
  const host = u.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, ''), out: string[] = [];
  if (net.isIP(host)) out.push('ip');
  if (host.split('.').some((l) => l.startsWith('xn--'))) out.push('punycode');
  if (u.username || /@/.test(u.href.split('?')[0].replace(/^https?:\/\//, '').split('/')[0])) out.push('at');
  if (SHORTENERS.includes(host) || SHORTENERS.includes(host.replace(/^www\./, ''))) out.push('shortener');
  const tld = host.split('.').pop();
  if (ODD_TLDS.includes(tld)) out.push('tld');
  const reg = regDomain(host), tokens = host.split(/[.-]/);
  const fake = Object.keys(BRANDS).find((b) => tokens.includes(b) && !BRANDS[b].some((d) => host === d || host.endsWith('.' + d)));
  if (fake && !net.isIP(host)) out.push('brand');
  if (out.length && LURE.test(u.pathname + u.search + host.replace(reg, ''))) out.push('lure');
  return out;
}

/* ---------- Scanpatronen ---------- */
const DAY = (d: Date) => d.toISOString().slice(0, 10);
/** spike: vandaag of gisteren minstens 50 scans en 10x zoveel als gemiddeld in de week ervoor.
 *  repeat: in 7 dagen minstens 100 scans waarvan minder dan 5% van verschillende bezoekers (bots of steeds dezelfde). */
export function scanPattern(days: Record<string, [number, number]>, now = new Date()): string[] {
  const get = (offset: number) => days[DAY(new Date(now.getTime() - offset * 864e5))] || [0, 0];
  const out: string[] = [];
  let before = 0; for (let i = 2; i <= 8; i++) before += get(i)[0];
  const avg = Math.max(1, before / 7), recent = Math.max(get(0)[0], get(1)[0]);
  if (recent >= 50 && recent >= avg * 10) out.push('spike');
  let s7 = 0, u7 = 0; for (let i = 0; i < 7; i++) { s7 += get(i)[0]; u7 += get(i)[1]; }
  if (s7 >= 100 && u7 / s7 < 0.05) out.push('repeat');
  return out;
}
export const patternSince = (now = new Date()) => DAY(new Date(now.getTime() - 8 * 864e5));
