/* =========================================================
   OPSLAG
   - PostgreSQL als DATABASE_URL is ingesteld (productie), anders SQLite (één bestand: ontwikkelen, Codespaces).
     Beide stuurprogramma's staan in server/db/; daarboven zit deze ene laag, zodat de rest van de app niet weet welke het is.
   - Tabellen: users, sessions, password_resets, email_verifications, qr_codes, scan_stats, files.
   - scan_stats: aantallen per code per dag per "systeem|land|stad" (geen IP-adressen).
   - PDF/MP3 staan als bestand op schijf (<DATA_DIR>/files), niet in de database.
   - Wifi-wachtwoorden staan versleuteld in de database (server/secret.js).
   Alle functies zijn async. Alles wat codes van een klant raakt vraagt het user-id: een klant ziet nooit codes van een ander.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const secret = require('./secret');

const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const SQLITE_FILE = process.env.DB_PATH || path.join(DATA, 'optimasys.db');
const FILES = path.join(DATA, 'files');
fs.mkdirSync(FILES, { recursive: true });

/* ---------- Gevoelige velden versleutelen (per soort inhoud) ---------- */
const SENSITIVE = { wifi: ['password'] };
function sealContent(contentType, content) {
  const keys = SENSITIVE[contentType]; if (!keys || !content) return content;
  const c = Object.assign({}, content); keys.forEach((k) => { if (c[k]) c[k] = secret.encrypt(c[k]); }); return c;
}
function openContent(contentType, content) {
  const keys = SENSITIVE[contentType]; if (!keys || !content) return content;
  keys.forEach((k) => { if (content[k]) content[k] = secret.decrypt(content[k]); }); return content;
}

const USE_PG = !!process.env.DATABASE_URL;
let driver = null;
const ready = (async () => {
  driver = USE_PG ? await require('./db/postgres').open(process.env.DATABASE_URL) : require('./db/sqlite').open(SQLITE_FILE);
  await sealOldRows(driver);
  return driver;
})();
// Eenmalig: gevoelige velden die nog leesbaar in de database staan (van vóór de versleuteling) alsnog versleutelen
async function sealOldRows(d) {
  for (const type of Object.keys(SENSITIVE)) {
    for (const r of await d.all('SELECT id, content FROM qr_codes WHERE content_type = ?', [type])) {
      const c = JSON.parse(r.content), sealed = sealContent(type, c);
      if (JSON.stringify(sealed) !== r.content) await d.run('UPDATE qr_codes SET content = ? WHERE id = ?', [JSON.stringify(sealed), r.id]);
    }
  }
}
ready.catch(() => {});                                     // de melding geeft index.js (en de server stopt dan)
const D = () => ready;                                     // altijd eerst wachten tot de database open is

const now = () => new Date().toISOString();
const newId = (n) => crypto.randomBytes(n || 9).toString('base64url');
const hash = (token) => crypto.createHash('sha256').update(String(token)).digest('base64url');
const SESSION_DAYS = 365;                     // ingelogd blijven tot je zelf uitlogt; elke dag dat je de app gebruikt, schuift dit op

/* ---------- Rij → object ---------- */
function codeOut(r) {
  if (!r) return null;
  return { id: r.id, userId: r.user_id, typeId: r.type_id, contentType: r.content_type, content: openContent(r.content_type, JSON.parse(r.content)), design: JSON.parse(r.design),
    name: r.name || undefined, paused: !!r.paused, scans: Number(r.scans) || 0, lastScanAt: r.last_scan_at, createdAt: r.created_at, updatedAt: r.updated_at || undefined };
}
function userOut(r) { return r && { id: r.id, email: r.email, name: r.name, background: r.background, customBackground: r.custom_background || null, createdAt: r.created_at }; }

const SQL = {
  userByEmail: 'SELECT * FROM users WHERE lower(email) = lower(?)',
  userById: 'SELECT * FROM users WHERE id = ?',
  code: 'SELECT * FROM qr_codes WHERE id = ?',
  codesOf: 'SELECT * FROM qr_codes WHERE user_id = ? ORDER BY created_at DESC',
  filesOfCode: 'SELECT id FROM files WHERE code_id = ?',
};

function removeFiles(ids) { ids.forEach((id) => { try { fs.unlinkSync(path.join(FILES, id)); } catch (e) {} }); }

const db = module.exports = {
  ready,
  path: USE_PG ? 'PostgreSQL' : SQLITE_FILE,
  kind: USE_PG ? 'postgres' : 'sqlite',
  label: async () => (await D()).label,
  ping: async () => (await D()).ping(),
  close: async () => (await D()).close(),

  /* Gebruikers en inloggen */
  async createUser({ email, name, passwordHash }) {
    const d = await D(), id = newId(9);
    await d.run('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [id, email.trim(), String(name || '').trim().slice(0, 80), passwordHash, now()]);
    return userOut(await d.get(SQL.userById, [id]));
  },
  userByEmail: async (email) => (await D()).get(SQL.userByEmail, [String(email || '').trim()]),     // met password_hash (alleen voor inloggen)
  isVerified: async (id) => !!((await (await D()).get('SELECT email_verified_at AS v FROM users WHERE id = ?', [id])) || {}).v,
  markVerified: async (id) => (await D()).run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', [now(), id]),
  // Bevestigingslink: 24 uur geldig, één keer te gebruiken
  async createVerification(userId) {
    const token = newId(32);
    await (await D()).batch([
      ['DELETE FROM email_verifications WHERE user_id = ?', [userId]],
      ['INSERT INTO email_verifications (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hash(token), userId, new Date(Date.now() + 24 * 3600e3).toISOString()]],
    ]);
    return token;
  },
  async useVerification(token) {
    const d = await D(), r = await d.get('SELECT * FROM email_verifications WHERE token_hash = ?', [hash(token)]); if (!r) return null;
    const del = await d.run('DELETE FROM email_verifications WHERE token_hash = ?', [hash(token)]);
    if (!del.changes || r.expires_at < now()) return null;                // al gebruikt (tegelijk geklikt) of verlopen
    await db.markVerified(r.user_id); return r.user_id;
  },
  getUser: async (id) => userOut(await (await D()).get(SQL.userById, [id])),
  passwordHashOf: async (id) => ((await (await D()).get(SQL.userById, [id])) || {}).password_hash,
  async updateUser(id, patch) {
    const cols = { name: 'name', background: 'background', customBackground: 'custom_background', passwordHash: 'password_hash', email: 'email' };
    const keys = Object.keys(patch).filter((k) => cols[k]); if (!keys.length) return db.getUser(id);
    await (await D()).run('UPDATE users SET ' + keys.map((k) => cols[k] + ' = ?').join(', ') + ', updated_at = ? WHERE id = ?', [...keys.map((k) => patch[k]), now(), id]);
    return db.getUser(id);
  },
  // Account verwijderen: alles weg (codes, statistieken, sessies, bestanden op schijf)
  async deleteUser(id) {
    const d = await D(), files = (await d.all('SELECT id FROM files WHERE user_id = ?', [id])).map((r) => r.id);
    await d.run('DELETE FROM users WHERE id = ?', [id]);
    removeFiles(files);
  },
  async createSession(userId) {
    const token = newId(32), exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
    await (await D()).run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [hash(token), userId, now(), exp]);
    return { token, expires: exp };
  },
  // Geldige sessie? Dan de gebruiker; sessies worden bij gebruik verlengd (max. 1x per dag)
  async sessionUser(token) {
    if (!token) return null;
    const d = await D(), r = await d.get('SELECT u.*, s.expires_at AS s_exp FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?', [hash(token)]);
    if (!r) return null;
    if (r.s_exp < now()) { await d.run('DELETE FROM sessions WHERE token_hash = ?', [hash(token)]); return null; }
    const u = userOut(r);
    if (new Date(r.s_exp) - Date.now() < (SESSION_DAYS - 1) * 864e5) {             // hooguit één keer per dag verlengen
      const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
      await d.run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', [exp, hash(token)]);
      Object.defineProperty(u, 'renewUntil', { value: exp, enumerable: false });   // auth.js ververst dan ook het cookie
    }
    return u;
  },
  deleteSession: async (token) => (await D()).run('DELETE FROM sessions WHERE token_hash = ?', [hash(token)]),
  deleteSessionsOf: async (userId, exceptToken) => (await D()).run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [userId, exceptToken ? hash(exceptToken) : '']),
  // Overzicht voor Mijn account: aantal codes, scans (totaal en laatste 30 dagen), ingelogde apparaten
  async summary(userId) {
    const d = await D(), since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
    const n = async (sql, p) => Number(((await d.get(sql, p)) || {}).n) || 0;
    return {
      codes: await n('SELECT COUNT(*) AS n FROM qr_codes WHERE user_id = ?', [userId]),
      scans: await n('SELECT COALESCE(SUM(s.scans), 0) AS n FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ?', [userId]),
      scans30: await n('SELECT COALESCE(SUM(s.scans), 0) AS n FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ? AND s.day >= ?', [userId, since]),
      sessions: await n('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ?', [userId, now()]),
    };
  },
  async createReset(userId) {
    const token = newId(32);
    await (await D()).batch([
      ['DELETE FROM password_resets WHERE user_id = ?', [userId]],
      ['INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hash(token), userId, new Date(Date.now() + 3600e3).toISOString()]],
    ]);
    return token;
  },
  // Eén keer bruikbaar, 1 uur geldig
  async useReset(token) {
    const d = await D(), r = await d.get('SELECT * FROM password_resets WHERE token_hash = ?', [hash(token)]); if (!r) return null;
    const del = await d.run('DELETE FROM password_resets WHERE token_hash = ?', [hash(token)]);
    return del.changes && r.expires_at > now() ? r.user_id : null;
  },
  // Opruimen: verlopen sessies en links, nooit bevestigde accounts (na 7 dagen)
  async cleanup() {
    const d = await D(), t = now();
    await d.run('DELETE FROM sessions WHERE expires_at < ?', [t]);
    await d.run('DELETE FROM password_resets WHERE expires_at < ?', [t]);
    await d.run('DELETE FROM email_verifications WHERE expires_at < ?', [t]);
    await d.run('DELETE FROM users WHERE email_verified_at IS NULL AND created_at < ?', [new Date(Date.now() - 7 * 864e5).toISOString()]);
  },

  /* QR-codes */
  listQrCodes: async (userId) => (await (await D()).all(SQL.codesOf, [userId])).map(codeOut),
  // Met statistieken (voor /api/analytics): { stats: { dag: { sleutel: [scans, uniek] } } }
  async listWithStats(userId) {
    const d = await D(), codes = (await d.all(SQL.codesOf, [userId])).map(codeOut), byId = {};
    codes.forEach((c) => { c.stats = {}; byId[c.id] = c; });
    (await d.all('SELECT s.code_id, s.day, s.key, s.scans, s.uniq FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ?', [userId]))
      .forEach((r) => { const c = byId[r.code_id]; if (!c) return; (c.stats[r.day] = c.stats[r.day] || {})[r.key] = [Number(r.scans), Number(r.uniq)]; });
    return codes;
  },
  getQrCode: async (id) => codeOut(await (await D()).get(SQL.code, [id])),                // openbaar (scannen)
  async getOwnedQrCode(id, userId) { const q = await db.getQrCode(id); return q && q.userId === userId ? q : null; },
  idTaken: async (id) => !!(await (await D()).get('SELECT 1 AS x FROM qr_codes WHERE id = ?', [id])),
  async insertQrCode(userId, q) {
    await (await D()).run('INSERT INTO qr_codes (id, user_id, type_id, content_type, content, design, name, paused, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
      [q.id, userId, q.typeId, q.contentType, JSON.stringify(sealContent(q.contentType, q.content)), JSON.stringify(q.design || {}), q.name || null, q.createdAt || now()]);
    return db.getQrCode(q.id);
  },
  async updateQrCode(id, patch) {
    const d = await D(), sets = [], vals = [];
    if (patch.content) {
      const cur = await d.get('SELECT content_type FROM qr_codes WHERE id = ?', [id]);
      sets.push('content = ?'); vals.push(JSON.stringify(sealContent(cur && cur.content_type, patch.content)));
    }
    if (patch.design) { sets.push('design = ?'); vals.push(JSON.stringify(patch.design)); }
    if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name || null); }
    if (patch.paused !== undefined) { sets.push('paused = ?'); vals.push(patch.paused ? 1 : 0); }
    sets.push('updated_at = ?'); vals.push(now());
    await d.run('UPDATE qr_codes SET ' + sets.join(', ') + ' WHERE id = ?', [...vals, id]);
    return db.getQrCode(id);
  },
  async deleteQrCode(id, userId) {
    const d = await D(), q = await d.get(SQL.code, [id]); if (!q || q.user_id !== userId) return false;
    const files = (await d.all(SQL.filesOfCode, [id])).map((r) => r.id);
    await d.run('DELETE FROM qr_codes WHERE id = ?', [id]); removeFiles(files);
    return true;
  },
  // Scan tellen (in één transactie): totaal + per dag per "systeem|land|stad"
  async addScan(id, info) {
    const d = await D(), t = now(), day = t.slice(0, 10), key = (info && info.key) || 'other||';
    await d.batch([
      ['UPDATE qr_codes SET scans = scans + 1, last_scan_at = ? WHERE id = ?', [t, id]],
      ['INSERT INTO scan_stats (code_id, day, key, scans, uniq) VALUES (?, ?, ?, 1, ?) ON CONFLICT (code_id, day, key) DO UPDATE SET scans = scan_stats.scans + 1, uniq = scan_stats.uniq + excluded.uniq',
        [id, day, key, !info || info.unique ? 1 : 0]],
    ]);
    return db.getQrCode(id);
  },

  /* Bestanden (PDF, MP3): op schijf, met een willekeurig id als naam */
  async saveFile({ userId, codeId, name, mime, buffer }) {
    const id = newId(16);
    fs.writeFileSync(path.join(FILES, id), buffer);
    await (await D()).run('INSERT INTO files (id, code_id, user_id, name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, codeId || null, userId, name, mime, buffer.length, now()]);
    return id;
  },
  attachFile: async (id, codeId) => (await D()).run('UPDATE files SET code_id = ? WHERE id = ?', [codeId, id]),
  async getFile(id) { const r = await (await D()).get('SELECT * FROM files WHERE id = ?', [id]); return r ? Object.assign({ path: path.join(FILES, r.id) }, r) : null; },
  // Bestanden van een code die niet meer gebruikt worden (na bewerken) weghalen
  async pruneFiles(codeId, keepIds) {
    const d = await D(), gone = (await d.all(SQL.filesOfCode, [codeId])).map((r) => r.id).filter((id) => keepIds.indexOf(id) < 0);
    for (const id of gone) await d.run('DELETE FROM files WHERE id = ?', [id]);
    removeFiles(gone);
  },

  /* Back-up (alleen SQLite; bij PostgreSQL: pg_dump of de back-ups van de hostingpartij) */
  async backup(to) { const d = await D(); if (!d.backup) throw new Error('Back-up via dit script kan alleen bij SQLite. Gebruik pg_dump voor PostgreSQL.'); return d.backup(to); },
  // Voor scripts (migratie): ruwe SQL
  async sql(kind, text, params) { return (await D())[kind](text, params); },
  filesDir: FILES,
};
