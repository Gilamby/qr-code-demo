/* Back-up van de database en de bestanden, ook terwijl de server draait.
   Gebruik: npm run backup            -> backups/optimasys-JJJJ-MM-DD-UUMM/
   Bewaart de laatste 14 back-ups. Zet dit bv. elke nacht in een cron-taak.
   SQLite: database-bestand + bestanden. MongoDB/PostgreSQL: alleen de bestanden; de database zelf met
   mongodump / pg_dump (of de automatische back-ups van de hostingpartij).
   De sleutel voor versleutelde velden (DATA_KEY of <DATA_DIR>/secret.key) zit NIET in de back-up: bewaar die apart. */
const { PATHS } = require('../server/dist/config/env');            // .env inlezen
const fs = require('fs');
const path = require('path');
const { NestFactory } = require('@nestjs/core');
const { DatabaseModule } = require('../server/dist/database/database.module');
const { DatabaseService } = require('../server/dist/database/database.service');
const root = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const dir = path.join(root, 'optimasys-' + stamp);

(async () => {
  const ctx = await NestFactory.createApplicationContext(DatabaseModule, { logger: ['error'] }), db = ctx.get(DatabaseService);
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  if (db.kind === 'sqlite') await db.backup(path.join(dir, 'optimasys.db'));
  else if (db.kind === 'mongodb') console.log('MongoDB: maak de database-back-up met mongodump (bv. mongodump --uri="$DATABASE_URL" --archive=optimasys.archive) of via de hostingpartij.');
  else console.log('PostgreSQL: maak de database-back-up met pg_dump (bv. pg_dump "$DATABASE_URL" > optimasys.sql) of via de hostingpartij.');
  // Bestanden veranderen nooit (elke upload krijgt een nieuw id): een harde link kost geen extra ruimte. Lukt dat niet (andere schijf), dan kopiëren.
  for (const f of fs.readdirSync(db.filesDir)) { const from = path.join(db.filesDir, f), to = path.join(dir, 'files', f); try { fs.linkSync(from, to); } catch (e) { fs.copyFileSync(from, to); } }
  const all = fs.readdirSync(root).filter((d) => d.startsWith('optimasys-')).sort();
  all.slice(0, Math.max(0, all.length - 14)).forEach((d) => fs.rmSync(path.join(root, d), { recursive: true, force: true }));
  console.log('Back-up klaar: ' + dir);
  await ctx.close(); process.exit(0);
})().catch((e) => { console.error('Back-up mislukt:', e.message); process.exit(1); });
