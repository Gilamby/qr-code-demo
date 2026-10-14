/* Back-up van de database en de bestanden, ook terwijl de server draait.
   Gebruik: npm run backup            -> backups/optimasys-JJJJ-MM-DD-UUMM/
   Bewaart de laatste 14 back-ups. Zet dit bv. elke nacht in een cron-taak.
   SQLite: database-bestand + bestanden.
   MongoDB: elke collection als mongo/<naam>.jsonl.gz (Extended JSON, types blijven goed) + bestanden.
            Terugzetten: npm run restore:mongo -- <map van de back-up>
   PostgreSQL: alleen de bestanden; de database zelf met pg_dump (of de back-ups van de hostingpartij).
   De sleutel voor versleutelde velden (DATA_KEY of <DATA_DIR>/secret.key) zit NIET in de back-up: bewaar die apart. */
const { PATHS } = require('../server/dist/config/env');            // .env inlezen
const fs = require('fs');
const path = require('path');
const { NestFactory } = require('@nestjs/core');
const { DatabaseModule } = require('../server/dist/database/database.module');
const { DatabaseService } = require('../server/dist/database/database.service');
const zlib = require('zlib');
const root = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const dir = path.join(root, 'optimasys-' + stamp);

/** Alle collections van MongoDB wegschrijven: één regel per document, gzip. Leest per stuk (weinig geheugen). */
async function dumpMongo(mdb, out) {
  const { BSON } = require('mongodb');
  fs.mkdirSync(out, { recursive: true });
  const counts = {};
  for (const c of await mdb.listCollections({}, { nameOnly: true }).toArray()) {
    if (c.name.startsWith('system.')) continue;
    const gz = zlib.createGzip(), file = fs.createWriteStream(path.join(out, c.name + '.jsonl.gz')); gz.pipe(file);
    let n = 0;
    for await (const doc of mdb.collection(c.name).find({})) { if (!gz.write(BSON.EJSON.stringify(doc, { relaxed: false }) + '\n')) await new Promise((ok) => gz.once('drain', ok)); n++; }
    gz.end(); await new Promise((ok, bad) => { file.on('finish', ok); file.on('error', bad); });
    counts[c.name] = n;
  }
  // Indexen bewaren we niet: de app maakt ze zelf aan bij het starten (MongoDatabase.open)
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), db: mdb.databaseName, counts }, null, 2));
  console.log('MongoDB: ' + Object.keys(counts).length + ' collections, ' + Object.values(counts).reduce((a, b) => a + b, 0) + ' documenten');
}

(async () => {
  const ctx = await NestFactory.createApplicationContext(DatabaseModule, { logger: ['error'] }), db = ctx.get(DatabaseService);
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  if (db.kind === 'sqlite') await db.backup(path.join(dir, 'optimasys.db'));
  else if (db.kind === 'mongodb') await dumpMongo(db.db, path.join(dir, 'mongo'));
  else console.log('PostgreSQL: maak de database-back-up met pg_dump (bv. pg_dump "$DATABASE_URL" > optimasys.sql) of via de hostingpartij.');
  // Bestanden veranderen nooit (elke upload krijgt een nieuw id): een harde link kost geen extra ruimte. Lukt dat niet (andere schijf), dan kopiëren.
  for (const f of fs.readdirSync(db.filesDir)) { const from = path.join(db.filesDir, f), to = path.join(dir, 'files', f); try { fs.linkSync(from, to); } catch (e) { fs.copyFileSync(from, to); } }
  const all = fs.readdirSync(root).filter((d) => d.startsWith('optimasys-')).sort();
  all.slice(0, Math.max(0, all.length - 14)).forEach((d) => fs.rmSync(path.join(root, d), { recursive: true, force: true }));
  console.log('Back-up klaar: ' + dir);
  // Voor het beheer-dashboard: wanneer was de laatste back-up (gelukt of mislukt)
  await db.setSetting('backup:last', JSON.stringify({ at: new Date().toISOString(), ok: true, files: fs.readdirSync(path.join(dir, 'files')).length, kind: db.kind })).catch(() => {});
  await ctx.close(); process.exit(0);
})().catch(async (e) => {
  console.error('Back-up mislukt:', e.message);
  try { const ctx = await NestFactory.createApplicationContext(DatabaseModule, { logger: ['error'] }); await ctx.get(DatabaseService).setSetting('backup:failed', JSON.stringify({ at: new Date().toISOString(), message: String(e.message).slice(0, 200) })); await ctx.close(); } catch (x) { /* database ook niet bereikbaar */ }
  process.exit(1);
});
