/* =========================================================
   OVERSTAPPEN: alles uit SQLite naar MongoDB kopiëren.
   Gebruik:  DATABASE_URL=mongodb://gebruiker:wachtwoord@host:27017/optimasys npm run migrate:mongo
             (optioneel: SQLITE_FILE=pad/naar/optimasys.db, standaard <DATA_DIR>/optimasys.db)
   - Maakt de collections en indexen in MongoDB aan als ze er nog niet zijn.
   - Kopieert accounts, sessies (je blijft ingelogd), QR-codes, statistieken en bestandsgegevens.
   - Wat al bestaat (zelfde id) wordt overgeslagen: het script mag vaker draaien.
   - Bevestigings- en wachtwoordlinks gaan niet mee (die verlopen toch snel).
   - De bestanden zelf (map files/) en de sleutel (DATA_KEY of secret.key) moeten mee naar de nieuwe server:
     zonder die sleutel zijn versleutelde wifi-wachtwoorden onleesbaar.
   ========================================================= */
const { PATHS } = require('../server/dist/config/env');            // .env inlezen
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const url = process.env.DATABASE_URL || '';
const file = process.env.SQLITE_FILE || path.join(PATHS.data, 'optimasys.db');
if (!/^mongodb(\+srv)?:\/\//.test(url)) { console.error('Zet eerst DATABASE_URL (mongodb://…).'); process.exit(1); }
if (!fs.existsSync(file)) { console.error('SQLite-bestand niet gevonden: ' + file); process.exit(1); }

const json = (s, fallback) => { try { return JSON.parse(s); } catch (e) { return fallback; } };
const has = (src, table) => !!src.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);

(async () => {
  const { MongoDatabase } = require('../server/dist/database/mongo.database');
  const m = await MongoDatabase.open(url);                                 // collections + indexen
  const db = m.db, src = new Database(file, { readonly: true });
  const owner = {};                                                        // code-id → user-id (voor de statistieken)
  const PLAN = [
    ['users', 'users', (r) => ({ _id: r.id, email: r.email, emailLower: String(r.email).toLowerCase(), name: r.name || '', passwordHash: r.password_hash,
      background: r.background || 'optimasys', customBackground: r.custom_background || null, emailVerifiedAt: r.email_verified_at || null, billing: json(r.billing, null), createdAt: r.created_at, updatedAt: r.updated_at || null })],
    ['sessions', 'sessions', (r) => ({ _id: r.token_hash, userId: r.user_id, createdAt: r.created_at, expiresAt: r.expires_at })],
    ['qr_codes', 'qrCodes', (r) => { owner[r.id] = r.user_id; return { _id: r.id, userId: r.user_id, typeId: r.type_id, contentType: r.content_type, content: json(r.content, {}), design: json(r.design, {}),
      name: r.name || null, paused: !!r.paused, scans: Number(r.scans) || 0, lastScanAt: r.last_scan_at || null, createdAt: r.created_at, updatedAt: r.updated_at || null }; }],
    ['scan_stats', 'scanStats', (r) => owner[r.code_id] && ({ codeId: r.code_id, userId: owner[r.code_id], day: r.day, key: r.key, scans: Number(r.scans) || 0, uniq: Number(r.uniq) || 0 })],
    ['files', 'files', (r) => ({ _id: r.id, codeId: r.code_id || null, userId: r.user_id, name: r.name, mime: r.mime, size: Number(r.size) || 0, createdAt: r.created_at })],
  ];
  try {
    for (const [table, coll, toDoc] of PLAN) {
      if (!has(src, table)) continue;
      const rows = src.prepare(`SELECT * FROM ${table}`).all();
      let added = 0;
      for (const r of rows) {
        const doc = toDoc(r); if (!doc) continue;
        // bestaat al (zelfde id, of bij statistieken: zelfde code + dag + sleutel)? dan overslaan
        const filter = doc._id !== undefined ? { _id: doc._id } : { codeId: doc.codeId, day: doc.day, key: doc.key };
        const { _id, ...rest } = doc;
        const res = await db.collection(coll).updateOne(filter, { $setOnInsert: rest }, { upsert: true });
        added += res.upsertedCount;
      }
      console.log(table.padEnd(11) + rows.length + ' gevonden, ' + added + ' nieuw overgezet');
    }
    console.log('\nKlaar. Vergeet niet: de map files/ en de sleutel (DATA_KEY of secret.key) mee te nemen naar de nieuwe server.');
  } catch (e) {
    console.error('Overzetten mislukt:', e.message, '\nWat al overgezet was blijft staan; los het probleem op en draai het script opnieuw (dubbele gegevens worden overgeslagen).');
    process.exitCode = 1;
  } finally { src.close(); await m.close(); }
})();
