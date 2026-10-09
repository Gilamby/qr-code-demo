/* Oude demo-opslag (server/data/db.json) overzetten naar de database, bij één account.
   Gebruik: npm run migrate -- jouw@email.nl
   Het account moet al bestaan (maak het eerst aan in de app). Bestanden (PDF/MP3) gaan naar schijf. */
const { ROOT } = require('../server/dist/config/env');             // .env inlezen
const fs = require('fs');
const path = require('path');
const { NestFactory } = require('@nestjs/core');
const { DatabaseModule } = require('../server/dist/database/database.module');
const { DatabaseService } = require('../server/dist/database/database.service');
const email = process.argv[2];
const file = process.argv[3] || path.join(ROOT, 'server', 'data', 'db.json');
if (!email) { console.error('Gebruik: npm run migrate -- jouw@email.nl [pad/naar/db.json]'); process.exit(1); }
(async () => {
const ctx = await NestFactory.createApplicationContext(DatabaseModule, { logger: ['error'] }), db = ctx.get(DatabaseService);
const user = await db.userByEmail(email);
if (!user) { console.error('Geen account met ' + email + '. Maak het eerst aan in de app.'); process.exit(1); }
const old = JSON.parse(fs.readFileSync(file, 'utf8'));
let n = 0, skipped = 0;
for (const q of old.qrCodes || []) {
  if (await db.idTaken(q.id)) { skipped++; continue; }
  const content = Object.assign({}, q.content), files = [];
  for (const [k, v] of Object.entries(content)) {
    if (typeof v !== 'string' || v.indexOf('"d":"data:') < 0) continue;
    try { const o = JSON.parse(v), m = o.d.match(/^data:([\w/.+-]+);base64,(.*)$/); const id = await db.saveFile({ userId: user.id, codeId: null, name: o.n, mime: m[1], buffer: Buffer.from(m[2], 'base64') }); content[k] = JSON.stringify({ n: o.n, s: o.s, f: id }); files.push(id); } catch (e) {}
  }
  await db.insertQrCode(user.id, { id: q.id, typeId: q.typeId, contentType: q.contentType, content, design: q.design, name: q.name, createdAt: q.createdAt });
  for (const f of files) await db.attachFile(f, q.id);
  if (q.paused) await db.updateQrCode(q.id, { paused: true });
  // Scans en statistieken overnemen
  const stats = q.stats || Object.fromEntries(Object.entries(q.daily || {}).map(([d, c]) => [d, { 'other||': [c, c] }]));
  for (const [day, keys] of Object.entries(stats)) for (const [key, v] of Object.entries(keys)) await db.sql('run', 'INSERT INTO scan_stats (code_id, day, key, scans, uniq) VALUES (?, ?, ?, ?, ?)', [q.id, day, key, v[0], v[1]]);
  await db.sql('run', 'UPDATE qr_codes SET scans = ?, last_scan_at = ? WHERE id = ?', [q.scans || 0, q.lastScanAt || null, q.id]);
  n++;
}
if (old.me && old.me.background) await db.updateUser(user.id, { background: old.me.background, customBackground: old.me.customBackground || null });
console.log(n + ' QR-codes overgezet naar ' + email + (skipped ? ' (' + skipped + ' bestonden al)' : '') + '.');
  await ctx.close();
})().catch((e) => { console.error('Overzetten mislukt:', e.message); process.exit(1); });
