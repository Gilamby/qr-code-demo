/* =========================================================
   Stuurprogramma: PostgreSQL (aan via DATABASE_URL). Voor productie.
   Zelfde vorm als sqlite.driver.ts (SqlDriver). SQL in de app gebruikt ? als plaatshouder; hier wordt dat $1, $2, …
   Tabellen worden bij het opstarten aangemaakt (IF NOT EXISTS): geen apart migratiescript nodig.
   ========================================================= */
import { Pool, PoolClient, types } from 'pg';
import type { SqlDriver } from '../types';

types.setTypeParser(20, (v: string) => Number(v));             // COUNT/SUM (bigint) als gewoon getal

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  background TEXT NOT NULL DEFAULT 'optimasys',
  custom_background TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  email_verified_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email));
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_verifications (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS qr_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  design TEXT NOT NULL,
  name TEXT,
  paused INTEGER NOT NULL DEFAULT 0,
  scans INTEGER NOT NULL DEFAULT 0,
  last_scan_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS qr_codes_user ON qr_codes(user_id, created_at);
CREATE TABLE IF NOT EXISTS scan_stats (
  code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  key TEXT NOT NULL,
  scans INTEGER NOT NULL DEFAULT 0,
  uniq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (code_id, day, key)
);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  code_id TEXT REFERENCES qr_codes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS files_code ON files(code_id);
`;

// ? -> $1, $2, … (de SQL van de app bevat geen ? in teksten)
const toPg = (sql: string) => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };
const fix = (p?: unknown[]) => (p || []).map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v));

export async function openPostgres(url: string): Promise<SqlDriver> {
  const ssl = /sslmode=(require|verify)/.test(url) || process.env.PGSSL === 'true' ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' } : undefined;
  const pool = new Pool({ connectionString: url, max: +(process.env.PG_POOL_MAX || 10), ssl });
  pool.on('error', (e) => console.error('PostgreSQL:', e.message));
  await pool.query(SCHEMA);
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS billing TEXT');
  for (const col of ['role', 'disabled_at', 'last_login_at', 'avatar', 'timezone', 'password_changed_at', 'theme', 'email_prefs', 'lang', 'media']) await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ' + col + ' TEXT');
  await pool.query('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)');
  // 13 okt 2026: apparaten (browser, IP, laatst actief), recente activiteit en e-mail wijzigen
  for (const col of ['ua', 'ip', 'seen_at']) await pool.query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ' + col + ' TEXT');
  // 14 okt 2026: mappen voor QR-codes
  await pool.query('ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS folder_id TEXT');
  await pool.query('ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS favorite INTEGER NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS labels TEXT');          // labels (JSON-lijst) en notitie bij een code
  await pool.query('ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS note TEXT');
  await pool.query('ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS trashed_at TEXT');   // prullenbak (30 dagen)
  // 14 okt 2026: scans per uur (UTC) voor Statistieken > wanneer wordt er gescand
  await pool.query(`CREATE TABLE IF NOT EXISTS scan_hours (
  code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  hour INTEGER NOT NULL,
  scans INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (code_id, day, hour)
);`);
  // 22 okt 2026: logboek per scan (detailpagina: waar, wanneer, waarmee) — geen IP-adressen
  await pool.query(`CREATE TABLE IF NOT EXISTS scan_log (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  cc TEXT, city TEXT, region TEXT, lat REAL, lon REAL, os TEXT, br TEXT, dev TEXT, uniq INTEGER NOT NULL DEFAULT 0
);`);
  await pool.query('CREATE INDEX IF NOT EXISTS scan_log_code_at ON scan_log (code_id, at)'); await pool.query('CREATE INDEX IF NOT EXISTS scan_log_at ON scan_log (at)');
  // 14 okt 2026: beheer (gepauzeerd door het team, gemarkeerd) + logboek van het beheer
  await pool.query('ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS moderation TEXT');
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  admin_name TEXT,
  action TEXT NOT NULL,
  code_id TEXT,
  owner_id TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS admin_log_at ON admin_log(at);
CREATE INDEX IF NOT EXISTS admin_log_code ON admin_log(code_id, at);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS folders_user ON folders(user_id);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  at TEXT NOT NULL,
  ip TEXT,
  ua TEXT
);
CREATE INDEX IF NOT EXISTS activity_user ON activity(user_id, at);
CREATE TABLE IF NOT EXISTS email_changes (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL
);`);

  const q = (client: Pool | PoolClient, sql: string, p?: unknown[]) => client.query(toPg(sql), fix(p));
  const safeUrl = url.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:***@');   // wachtwoord nooit in de log

  return {
    kind: 'postgres',
    label: safeUrl,
    all: async (sql, p) => (await q(pool, sql, p)).rows,
    get: async (sql, p) => (await q(pool, sql, p)).rows[0] || null,
    run: async (sql, p) => ({ changes: (await q(pool, sql, p)).rowCount }),
    // Alles of niets: één transactie op één verbinding
    batch: async (list) => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const out: { changes: number }[] = [];
        for (const [sql, p] of list) out.push({ changes: (await q(c, sql, p)).rowCount });
        await c.query('COMMIT');
        return out;
      } catch (e) { await c.query('ROLLBACK').catch(() => undefined); throw e; } finally { c.release(); }
    },
    ping: async () => (await pool.query('SELECT 1 AS ok')).rows[0].ok === 1,
    close: () => pool.end(),
    backup: null,                                           // back-ups: via pg_dump of de hostingpartij
  };
}
