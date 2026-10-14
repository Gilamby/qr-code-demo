/* =========================================================
   MongoDB-back-up terugzetten (gemaakt door scripts/backup.js).
   Gebruik:  npm run restore:mongo -- <map>            bv. ~/qr-backups/optimasys-2026-10-14-03-15
             npm run restore:mongo -- <map> --replace  eerst de collections leegmaken (volledig terugzetten)
   - Zonder --replace: alleen ontbrekende documenten worden toegevoegd (bestaande blijven staan).
   - Stop de app eerst (pkill -f server/dist/main.js) en start daarna met bash scripts/start-server.sh.
   - Kopieer ook de bestanden: <map>/files/* naar DATA_DIR/files/. DATA_KEY / secret.key moet dezelfde zijn.
   ========================================================= */
require('../server/dist/config/env');                                   // .env inlezen
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { MongoClient, BSON } = require('mongodb');

const dir = process.argv[2], replace = process.argv.includes('--replace'), url = process.env.DATABASE_URL || '';
if (!dir) { console.error('Geef de map van de back-up op.'); process.exit(1); }
const src = path.join(dir, 'mongo');
if (!fs.existsSync(path.join(src, 'manifest.json'))) { console.error('Geen MongoDB-back-up gevonden in ' + src); process.exit(1); }
if (!/^mongodb(\+srv)?:\/\//.test(url)) { console.error('DATABASE_URL moet mongodb://… zijn (in .env).'); process.exit(1); }

(async () => {
  const client = new MongoClient(url); await client.connect();
  const db = client.db();
  for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.jsonl.gz'))) {
    const name = f.replace(/\.jsonl\.gz$/, ''), col = db.collection(name);
    if (replace) await col.deleteMany({});
    const lines = readline.createInterface({ input: fs.createReadStream(path.join(src, f)).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    let batch = [], added = 0;
    const flush = async () => {
      if (!batch.length) return;
      try { added += (await col.insertMany(batch, { ordered: false })).insertedCount; }
      catch (e) { if (e.code !== 11000 && !(e.writeErrors && e.writeErrors.every((w) => w.code === 11000))) throw e; added += e.result ? e.result.insertedCount : 0; }   // bestaat al: overslaan
      batch = [];
    };
    for await (const line of lines) { if (!line.trim()) continue; batch.push(BSON.EJSON.parse(line, { relaxed: false })); if (batch.length >= 500) await flush(); }
    await flush();
    console.log(name + ': ' + added + ' teruggezet');
  }
  await client.close();
  console.log('Klaar. Kopieer ook ' + path.join(dir, 'files') + ' naar DATA_DIR/files en start de app.');
})().catch((e) => { console.error('Terugzetten mislukt:', e.message); process.exit(1); });
