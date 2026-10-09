/* =========================================================
   OVERSTAPPEN: alles uit SQLite naar PostgreSQL kopiëren.
   Gebruik:  DATABASE_URL=postgres://gebruiker:wachtwoord@host:5432/database npm run migrate:pg
             (optioneel: SQLITE_FILE=pad/naar/optimasys.db, standaard <DATA_DIR>/optimasys.db)
   - Maakt de tabellen in PostgreSQL aan als ze er nog niet zijn.
   - Kopieert accounts, sessies, QR-codes, statistieken en bestandsgegevens in één transactie:
     lukt iets niet, dan verandert er niets.
   - Wat al bestaat (zelfde id) wordt overgeslagen: het script mag vaker draaien.
   - De bestanden zelf (map files/) en de sleutel (DATA_KEY of secret.key) moeten mee naar de nieuwe server:
     zonder die sleutel zijn versleutelde wifi-wachtwoorden onleesbaar.
   ========================================================= */
require('../server/config');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
const file = process.env.SQLITE_FILE || path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'server', 'data'), 'optimasys.db');
if (!url) { console.error('Zet eerst DATABASE_URL (postgres://…).'); process.exit(1); }
if (!fs.existsSync(file)) { console.error('SQLite-bestand niet gevonden: ' + file); process.exit(1); }

// Volgorde telt: eerst users, dan wat ernaar verwijst
const TABLES = [
  ['users', ['id', 'email', 'name', 'password_hash', 'background', 'custom_background', 'created_at', 'updated_at', 'email_verified_at']],
  ['sessions', ['token_hash', 'user_id', 'created_at', 'expires_at']],
  ['qr_codes', ['id', 'user_id', 'type_id', 'content_type', 'content', 'design', 'name', 'paused', 'scans', 'last_scan_at', 'created_at', 'updated_at']],
  ['scan_stats', ['code_id', 'day', 'key', 'scans', 'uniq']],
  ['files', ['id', 'code_id', 'user_id', 'name', 'mime', 'size', 'created_at']],
];

(async () => {
  await require('../server/db/postgres').open(url).then((d) => d.close());       // tabellen aanmaken
  const src = new Database(file, { readonly: true });
  const pool = new Pool({ connectionString: url }), c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const [table, cols] of TABLES) {
      const have = new Set(src.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((r) => r.name));
      const use = cols.filter((k) => have.has(k));
      const rows = src.prepare(`SELECT ${use.join(', ')} FROM ${table}`).all();
      let added = 0;
      for (const r of rows) {
        const sql = `INSERT INTO ${table} (${use.join(', ')}) VALUES (${use.map((_, i) => '$' + (i + 1)).join(', ')}) ON CONFLICT DO NOTHING`;
        added += (await c.query(sql, use.map((k) => r[k]))).rowCount;
      }
      console.log(table.padEnd(11) + rows.length + ' gevonden, ' + added + ' nieuw overgezet');
    }
    await c.query('COMMIT');
    console.log('\nKlaar. Vergeet niet: de map files/ en de sleutel (DATA_KEY of secret.key) mee te nemen naar de nieuwe server.');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('Overzetten mislukt, er is niets veranderd:', e.message); process.exitCode = 1;
  } finally { c.release(); await pool.end(); src.close(); }
})();
