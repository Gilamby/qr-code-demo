/* =========================================================
   TWEESTAPSVERIFICATIE (TOTP, RFC 6238) — werkt met elke authenticator-app
   (Google Authenticator, Microsoft Authenticator, 1Password, Authy …).
   Opslag: settings 'totp:<userId>' = versleuteld JSON { secret, on, codes: [sha256 van herstelcodes] }.
   ========================================================= */
import * as crypto from 'crypto';
import { decrypt, encrypt } from '../database/secret';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newSecret(): string { const b = crypto.randomBytes(20); let bits = '', out = ''; for (const x of b) bits += x.toString(2).padStart(8, '0'); for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]; return out; }
function fromB32(s: string): Buffer { let bits = ''; for (const c of s.replace(/=+$/, '').toUpperCase()) { const v = B32.indexOf(c); if (v < 0) continue; bits += v.toString(2).padStart(5, '0'); } const out: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); }
export function codeAt(secret: string, step: number): string {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', fromB32(secret)).update(msg).digest(), o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
/** Klopt de code? (30 seconden per code, één stap speling voor een klok die iets afwijkt) */
export function checkCode(secret: string, code: string, now = Date.now()): boolean {
  const c = String(code || '').replace(/\s+/g, ''); if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(now / 30000);
  return [-1, 0, 1].some((d) => crypto.timingSafeEqual(Buffer.from(codeAt(secret, step + d)), Buffer.from(c)));
}
export function otpauth(secret: string, account: string): string {
  return 'otpauth://totp/' + encodeURIComponent('Optimasys QR:' + account) + '?secret=' + secret + '&issuer=' + encodeURIComponent('Optimasys QR') + '&algorithm=SHA1&digits=6&period=30';
}
export type Totp = { secret: string; on: boolean; codes: string[] };
const sha = (s: string) => crypto.createHash('sha256').update(s.replace(/[\s-]/g, '').toUpperCase()).digest('hex');
export function recoveryCodes(): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: 10 }, () => { const r = crypto.randomBytes(5).toString('hex').toUpperCase(); return r.slice(0, 5) + '-' + r.slice(5); });
  return { plain, hashed: plain.map(sha) };
}
/** Herstelcode gebruiken: geeft de overgebleven codes terug, of null als hij niet klopt */
export function useRecovery(t: Totp, code: string): string[] | null { const h = sha(String(code || '')); return t.codes.includes(h) ? t.codes.filter((x) => x !== h) : null; }
type Settings = { getSetting(k: string): Promise<string | null>; setSetting(k: string, v: string | null): Promise<void> };
export async function readTotp(db: Settings, userId: string): Promise<Totp | null> { const v = await db.getSetting('totp:' + userId); if (!v) return null; try { return JSON.parse(decrypt(v)); } catch (e) { return null; } }
export async function writeTotp(db: Settings, userId: string, t: Totp | null) { await db.setSetting('totp:' + userId, t ? encrypt(JSON.stringify(t)) : null); }
