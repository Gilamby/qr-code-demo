/* =========================================================
   VERSLEUTELEN van gevoelige velden in de database (nu: wifi-wachtwoorden).
   AES-256-GCM. De sleutel komt uit DATA_KEY (64 hex-tekens) of, als die er niet is,
   uit het bestand <DATA_DIR>/secret.key (wordt de eerste keer zelf gemaakt, alleen leesbaar voor de app).
   Zonder de sleutel zijn de velden in de database (of een gelekte back-up) onleesbaar.
   Bewaar de sleutel dus apart van de database-back-ups.
   ========================================================= */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PATHS } from '../config/env';

const PREFIX = 'enc:v1:';
let key: Buffer = null;

function loadKey(): Buffer {
  if (key) return key;
  const env = String(process.env.DATA_KEY || '').trim();
  if (env) {
    if (/^[0-9a-f]{64}$/i.test(env)) { key = Buffer.from(env, 'hex'); return key; }
    // Ander formaat (bv. een door de hosting gemaakt geheim): mag, als het lang genoeg is; de sleutel wordt er dan van afgeleid
    if (env.length < 32) throw new Error('DATA_KEY is te kort: gebruik 64 hex-tekens (openssl rand -hex 32) of een willekeurige tekst van minstens 32 tekens.');
    key = crypto.createHash('sha256').update('optimasys-data-key:' + env).digest(); return key;
  }
  const dir = PATHS.data, file = path.join(dir, 'secret.key');
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
  key = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex');
  return key;
}

export function encrypt(text: string): string {
  if (text == null || text === '' || String(text).startsWith(PREFIX)) return text;
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', loadKey(), iv);
  const data = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return PREFIX + [iv, c.getAuthTag(), data].map((b) => b.toString('base64url')).join(':');
}
export function decrypt(value: string): string {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;   // oude, nog niet versleutelde waarde
  try {
    const [iv, tag, data] = value.slice(PREFIX.length).split(':').map((s) => Buffer.from(s, 'base64url'));
    const d = crypto.createDecipheriv('aes-256-gcm', loadKey(), iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch (e) { console.error('Ontsleutelen mislukt (verkeerde DATA_KEY?)'); return ''; }
}

export const isEncrypted = (v: unknown): boolean => typeof v === 'string' && v.startsWith(PREFIX);
