/* =========================================================
   VERDER NA HET BEVESTIGEN (zoals bij Claude)
   Wie een account maakt, krijgt in die browser een geheim cookie (vpend, 24 uur).
   - Klikt hij de link in de mail in DEZELFDE browser: meteen ingelogd.
   - Klikt hij de link op een ander apparaat (bv. de telefoon): daar "e-mail bevestigd, je kunt dit sluiten",
     en de browser waar hij het account maakte (die wacht op het scherm "check je e-mail") logt vanzelf in.
   Alleen de browser met het cookie kan zo inloggen; het geheim staat alleen gehasht in de database.
   ========================================================= */
import * as crypto from 'crypto';
import type { Request, Response } from 'express';

export const PENDING_COOKIE = 'vpend';
const TTL = 24 * 3600 * 1000;
type Settings = { getSetting(k: string): Promise<string | null | undefined>; setSetting(k: string, v: string | null): Promise<void> };
const keyOf = (secret: string) => 'vpend:' + crypto.createHash('sha256').update(secret).digest('hex');

export async function startPending(db: Settings, uid: string, res: Response, secure: boolean) {
  const secret = crypto.randomBytes(24).toString('base64url');
  await db.setSetting(keyOf(secret), JSON.stringify({ uid, exp: Date.now() + TTL }));
  res.append('Set-Cookie', PENDING_COOKIE + '=' + secret + '; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=' + TTL / 1000 + (secure ? '; Secure' : ''));
}
/** Voor wie wacht deze browser? (uid) of null */
export async function readPending(db: Settings, secret: string): Promise<string | null> {
  if (!secret) return null;
  try {
    const r = JSON.parse((await db.getSetting(keyOf(secret))) || 'null');
    if (!r || !r.uid || r.exp < Date.now()) return null;
    return String(r.uid);
  } catch { return null; }
}
export async function endPending(db: Settings, secret: string, res: Response, secure: boolean) {
  if (secret) await db.setSetting(keyOf(secret), null);
  res.append('Set-Cookie', PENDING_COOKIE + '=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0' + (secure ? '; Secure' : ''));
}
export const pendingSecret = (cookies: Record<string, string>) => cookies[PENDING_COOKIE] || '';
