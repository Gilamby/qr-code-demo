/* =========================================================
   Stuurprogramma: PostgreSQL (aan via DATABASE_URL). Voor productie.
   Zelfde vorm als sqlite.js: all / get / run / batch / ping / close (allemaal async).
   SQL in de app gebruikt ? als plaatshouder; hier wordt dat $1, $2, …
   Tabellen worden bij het opstarten aangemaakt (IF NOT EXISTS): geen apart migratiescript nodig.
   ========================================================= */
const { Pool, types } = require('pg');

types.setTypeParser(20, (v) => Number(v));             // COUNT/SUM (bigint) als gewoon getal

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
const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };
const fix = (p) => (p || []).map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v));

async function open(url) {
  const ssl = /sslmode=(require|verify)/.test(url) || process.env.PGSSL === 'true' ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' } : undefined;
  const pool = new Pool({ connectionString: url, max: +(process.env.PG_POOL_MAX || 10), ssl });
  pool.on('error', (e) => console.error('PostgreSQL:', e.message));
  await pool.query(SCHEMA);
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT');

  const q = (client, sql, p) => client.query(toPg(sql), fix(p));
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
        const out = [];
        for (const [sql, p] of list) out.push({ changes: (await q(c, sql, p)).rowCount });
        await c.query('COMMIT');
        return out;
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    },
    ping: async () => (await pool.query('SELECT 1 AS ok')).rows[0].ok === 1,
    close: () => pool.end(),
    backup: null,                                           // back-ups: via pg_dump of de hostingpartij
  };
}

module.exports = { open };
