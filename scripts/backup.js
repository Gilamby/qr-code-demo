/* Back-up van de database en de bestanden, ook terwijl de server draait.
   Gebruik: npm run backup            -> backups/optimasys-JJJJ-MM-DD-UUMM/
   Bewaart de laatste 14 back-ups. Zet dit bv. elke nacht in een cron-taak. */
require('../server/config');
const fs = require('fs');
const path = require('path');
const db = require('../server/db');
const root = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const dir = path.join(root, 'optimasys-' + stamp);
fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
db.backup(path.join(dir, 'optimasys.db')).then(() => {
  const src = path.join(path.dirname(db.path), 'files');
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dir, 'files', f));
  const all = fs.readdirSync(root).filter((d) => d.startsWith('optimasys-')).sort();
  all.slice(0, Math.max(0, all.length - 14)).forEach((d) => fs.rmSync(path.join(root, d), { recursive: true, force: true }));
  console.log('Back-up klaar: ' + dir);
  process.exit(0);
}).catch((e) => { console.error('Back-up mislukt:', e.message); process.exit(1); });
