/* =========================================================
   API-SLEUTELS (Business): eigen software koppelen, bv. Optima-CRM
   - Een sleutel ziet eruit als qrc_<40 tekens>. We bewaren alleen een hash (sha256), nooit de sleutel zelf.
   - settings 'apikeys:<userId>' = [{ id, name, prefix, hash, createdAt, lastUsedAt }]
   - settings 'apikey:<hash>'    = '<userId>|<id>'  (snel opzoeken bij elk verzoek)
   - Gebruik: Authorization: Bearer qrc_…  op /api/v1/qr-codes … en /api/v1/analytics
   ========================================================= */
import { createHash, randomBytes } from 'crypto';

type Settings = { getSetting(k: string): Promise<string | null | undefined>; setSetting(k: string, v: string | null): Promise<void> };
export type ApiKey = { id: string; name: string; prefix: string; hash: string; createdAt: string; lastUsedAt: string | null };
export const MAX_KEYS = 10;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export async function listKeys(db: Settings, uid: string): Promise<ApiKey[]> {
  try { const x = JSON.parse((await db.getSetting('apikeys:' + uid)) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; }
}
async function save(db: Settings, uid: string, keys: ApiKey[]) { await db.setSetting('apikeys:' + uid, keys.length ? JSON.stringify(keys) : null); }
export const publicKey = (k: ApiKey) => ({ id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt });

export async function createKey(db: Settings, uid: string, name: string) {
  const keys = await listKeys(db, uid);
  if (keys.length >= MAX_KEYS) return null;
  const key = 'qrc_' + randomBytes(30).toString('base64url'), hash = sha(key);
  const rec: ApiKey = { id: randomBytes(6).toString('hex'), name: String(name || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'API', prefix: key.slice(0, 10), hash, createdAt: new Date().toISOString(), lastUsedAt: null };
  await save(db, uid, keys.concat(rec));
  await db.setSetting('apikey:' + hash, uid + '|' + rec.id);
  return { key, record: rec };
}
export async function revokeKey(db: Settings, uid: string, id: string) {
  const keys = await listKeys(db, uid), k = keys.find((x) => x.id === id);
  if (!k) return false;
  await db.setSetting('apikey:' + k.hash, null);
  await save(db, uid, keys.filter((x) => x.id !== id));
  return true;
}
export async function revokeAll(db: Settings, uid: string) {
  for (const k of await listKeys(db, uid)) await db.setSetting('apikey:' + k.hash, null);
  await save(db, uid, []);
}
/** Bij welke gebruiker hoort deze sleutel? (en "laatst gebruikt" bijwerken, hooguit één keer per minuut) */
export async function userOfKey(db: Settings, key: string): Promise<{ uid: string; id: string } | null> {
  if (!/^qrc_[A-Za-z0-9_-]{30,60}$/.test(key)) return null;
  const v = await db.getSetting('apikey:' + sha(key)); if (!v) return null;
  const [uid, id] = String(v).split('|');
  const keys = await listKeys(db, uid), k = keys.find((x) => x.id === id);
  if (!k) return null;
  if (!k.lastUsedAt || Date.now() - Date.parse(k.lastUsedAt) > 60000) { k.lastUsedAt = new Date().toISOString(); await save(db, uid, keys); }
  return { uid, id };
}
