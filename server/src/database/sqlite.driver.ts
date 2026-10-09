/* =========================================================
   Stuurprogramma: SQLite (één bestand). Standaard voor ontwikkelen en kleine installaties.
   Zelfde vorm als postgres.driver.ts (SqlDriver). SQL gebruikt ? als plaatshouder.
   ========================================================= */
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import type { SqlDriver } from '../types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  background TEXT NOT NULL DEFAULT 'optimasys',
  custom_background TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
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

export function openSqlite(file: string): SqlDriver {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');        // snel en veilig bij veel scans tegelijk
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  // Kolom van 9 okt 2026 (e-mail bevestigen): bestaande accounts tellen als bevestigd
  if (!db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'email_verified_at'").get()) {
    db.exec('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
    db.prepare('UPDATE users SET email_verified_at = created_at').run();
  }

  const cache = new Map<string, Database.Statement>();
  const stmt = (sql: string) => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  const fix = (p?: unknown[]) => (p || []).map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v));
  const run = (sql: string, p?: unknown[]) => ({ changes: stmt(sql).run(...fix(p)).changes });
  const runAll = db.transaction((list: [string, unknown[]][]) => list.map(([sql, p]) => run(sql, p)));

  return {
    kind: 'sqlite',
    label: file,
    all: async (sql, p) => stmt(sql).all(...fix(p)) as any[],
    get: async (sql, p) => (stmt(sql).get(...fix(p)) as any) || null,
    run: async (sql, p) => run(sql, p),
    batch: async (list) => runAll(list),
    ping: async () => !!stmt('SELECT 1 AS ok').get(),
    close: async () => { db.close(); },
    backup: (to: string) => db.backup(to),
  };
}
