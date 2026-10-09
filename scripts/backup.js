/* Back-up van de database en de bestanden, ook terwijl de server draait.
   Gebruik: npm run backup            -> backups/optimasys-JJJJ-MM-DD-UUMM/
   Bewaart de laatste 14 back-ups. Zet dit bv. elke nacht in een cron-taak.
   SQLite: database-bestand + bestanden. PostgreSQL: alleen de bestanden; de database zelf met pg_dump
   (of de automatische back-ups van de hostingpartij).
   De sleutel voor versleutelde velden (DATA_KEY of <DATA_DIR>/secret.key) zit NIET in de back-up: bewaar die apart. */
require('../server/config');
const fs = require('fs');
const path = require('path');
const db = require('../server/db');
const root = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const dir = path.join(root, 'optimasys-' + stamp);

(async () => {
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  if (db.kind === 'sqlite') await db.backup(path.join(dir, 'optimasys.db'));
  else console.log('PostgreSQL: maak de database-back-up met pg_dump (bv. pg_dump "$DATABASE_URL" > optimasys.sql) of via de hostingpartij.');
  for (const f of fs.readdirSync(db.filesDir)) fs.copyFileSync(path.join(db.filesDir, f), path.join(dir, 'files', f));
  const all = fs.readdirSync(root).filter((d) => d.startsWith('optimasys-')).sort();
  all.slice(0, Math.max(0, all.length - 14)).forEach((d) => fs.rmSync(path.join(root, d), { recursive: true, force: true }));
  console.log('Back-up klaar: ' + dir);
  await db.close(); process.exit(0);
})().catch((e) => { console.error('Back-up mislukt:', e.message); process.exit(1); });
