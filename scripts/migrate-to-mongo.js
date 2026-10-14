/* =========================================================
   OVERSTAPPEN: alles uit SQLite naar MongoDB kopiëren.
   Gebruik:  DATABASE_URL=mongodb://gebruiker:wachtwoord@host:27017/optimasys npm run migrate:mongo
             (optioneel: SQLITE_FILE=pad/naar/optimasys.db, standaard <DATA_DIR>/optimasys.db)
   - Maakt de collections en indexen in MongoDB aan als ze er nog niet zijn.
   - Kopieert accounts, sessies (je blijft ingelogd), QR-codes, statistieken en bestandsgegevens.
   - Alles gaat mee: accounts (met rol, voorkeuren, eigen achtergronden), sessies, uitnodigingen, mappen, favorieten,
     QR-codes, statistieken (dag + uur), bestanden, instellingen (vertalingen, abonnementen), beheerlog en activiteit.
   - SQLite is de bron: wat al in MongoDB staat wordt bijgewerkt, niets dubbel. Het script mag vaker draaien.
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
  // [tabel, collection, omzetten, sleutelvelden (als er geen _id is)]
  const PLAN = [
    ['users', 'users', (r) => ({ _id: r.id, email: r.email, emailLower: String(r.email).toLowerCase(), name: r.name || '', passwordHash: r.password_hash,
      background: r.background || 'optimasys', customBackground: r.custom_background || null, emailVerifiedAt: r.email_verified_at || null, billing: json(r.billing, null),
      role: r.role || null, disabledAt: r.disabled_at || null, lastLoginAt: r.last_login_at || null, avatar: r.avatar || null, timezone: r.timezone || null,
      passwordChangedAt: r.password_changed_at || null, theme: r.theme || null, emailPrefs: json(r.email_prefs, null), lang: r.lang || null, media: json(r.media, []),
      createdAt: r.created_at, updatedAt: r.updated_at || null })],
    ['sessions', 'sessions', (r) => ({ _id: r.token_hash, userId: r.user_id, createdAt: r.created_at, expiresAt: r.expires_at, ua: r.ua || null, ip: r.ip || null, seenAt: r.seen_at || r.created_at })],
    ['password_resets', 'passwordResets', (r) => ({ _id: r.token_hash, userId: r.user_id, expiresAt: r.expires_at })],      // o.a. openstaande uitnodigingen
    ['email_verifications', 'emailVerifications', (r) => ({ _id: r.token_hash, userId: r.user_id, expiresAt: r.expires_at })],
    ['email_changes', 'emailChanges', (r) => ({ _id: r.token_hash, userId: r.user_id, email: r.email, expiresAt: r.expires_at })],
    ['folders', 'folders', (r) => ({ _id: r.id, userId: r.user_id, name: r.name, color: r.color, createdAt: r.created_at })],
    ['qr_codes', 'qrCodes', (r) => { owner[r.id] = r.user_id; return { _id: r.id, userId: r.user_id, typeId: r.type_id, contentType: r.content_type, content: json(r.content, {}), design: json(r.design, {}),
      name: r.name || null, paused: !!r.paused, scans: Number(r.scans) || 0, lastScanAt: r.last_scan_at || null, folderId: r.folder_id || null, favorite: !!r.favorite,
      moderation: json(r.moderation, null), createdAt: r.created_at, updatedAt: r.updated_at || null }; }],
    ['scan_stats', 'scanStats', (r) => owner[r.code_id] && ({ codeId: r.code_id, userId: owner[r.code_id], day: r.day, key: r.key, scans: Number(r.scans) || 0, uniq: Number(r.uniq) || 0 }), ['codeId', 'day', 'key']],
    ['scan_hours', 'scanHours', (r) => owner[r.code_id] && ({ codeId: r.code_id, userId: owner[r.code_id], day: r.day, hour: Number(r.hour), scans: Number(r.scans) || 0 }), ['codeId', 'day', 'hour']],
    ['files', 'files', (r) => ({ _id: r.id, codeId: r.code_id || null, userId: r.user_id, name: r.name, mime: r.mime, size: Number(r.size) || 0, createdAt: r.created_at })],
    ['settings', 'settings', (r) => ({ _id: r.key, value: r.value, updatedAt: r.updated_at || null })],                  // vertalingen, abonnementen, verborgen achtergronden, back-upstatus …
    ['admin_log', 'adminLog', (r) => ({ _id: r.id, at: r.at, adminId: r.admin_id, adminName: r.admin_name || null, action: r.action, codeId: r.code_id || null, ownerId: r.owner_id || null, detail: r.detail || null })],
    ['activity', 'activity', (r) => ({ _id: r.id, userId: r.user_id, kind: r.kind, at: r.at, ip: r.ip || null, ua: r.ua || null })],
  ];
  try {
    for (const [table, coll, toDoc, keys] of PLAN) {
      if (!has(src, table)) continue;
      const rows = src.prepare(`SELECT * FROM ${table}`).all();
      let added = 0, updated = 0;
      for (const r of rows) {
        const doc = toDoc(r); if (!doc) continue;
        // SQLite is de bron: bestaat het al (zelfde id of zelfde sleutelvelden), dan bijwerken; anders toevoegen
        const filter = doc._id !== undefined ? { _id: doc._id } : Object.fromEntries(keys.map((k) => [k, doc[k]]));
        const { _id, ...rest } = doc;
        const res = await db.collection(coll).updateOne(filter, { $set: rest }, { upsert: true });
        if (res.upsertedCount) added++; else if (res.modifiedCount) updated++;
      }
      console.log(table.padEnd(20) + rows.length + ' gevonden, ' + added + ' nieuw, ' + updated + ' bijgewerkt');
    }
    console.log('\nKlaar. Vergeet niet: de map files/ en de sleutel (DATA_KEY of secret.key) mee te nemen naar de nieuwe server.');
  } catch (e) {
    console.error('Overzetten mislukt:', e.message, '\nWat al overgezet was blijft staan; los het probleem op en draai het script opnieuw (niets wordt dubbel).');
    process.exitCode = 1;
  } finally { src.close(); await m.close(); }
})();
