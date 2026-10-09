/* =========================================================
   OPSLAG: SQLite (één bestand, standaard server/data/optimasys.db)
   - users, sessions, password_resets: accounts en inloggen
   - qr_codes: de codes van elke klant (inhoud en ontwerp als JSON)
   - scan_stats: aantallen per code per dag per "systeem|land|stad" (geen IP-adressen)
   - files: PDF/MP3 staan als bestand op schijf (server/data/files), niet in de database
   Alle functies die codes van een klant raken vragen het user-id: een klant ziet nooit codes van een ander.
   Overstappen naar PostgreSQL later: alleen dit bestand vervangen.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = process.env.DB_PATH || path.join(DATA, 'optimasys.db');
const FILES = path.join(path.dirname(FILE), 'files');
fs.mkdirSync(FILES, { recursive: true });

const db = new Database(FILE);
db.pragma('journal_mode = WAL');        // snel en veilig bij veel scans tegelijk
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  background TEXT NOT NULL DEFAULT 'optimasys',
  custom_background TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS qr_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  design TEXT NOT NULL,
  name TEXT,
  paused INTEGER NOT NULL DEFAULT 0,
  scans INTEGER NOT NULL DEFAULT 0,
  last_scan_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS qr_codes_user ON qr_codes(user_id, created_at);
CREATE TABLE IF NOT EXISTS scan_stats (
  code_id TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  key TEXT NOT NULL,
  scans INTEGER NOT NULL DEFAULT 0,
  uniq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (code_id, day, key)
);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  code_id TEXT REFERENCES qr_codes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS files_code ON files(code_id);
`);

const now = () => new Date().toISOString();
const newId = (n) => crypto.randomBytes(n || 9).toString('base64url');
const hash = (token) => crypto.createHash('sha256').update(String(token)).digest('base64url');
const SESSION_DAYS = 365;                     // ingelogd blijven tot je zelf uitlogt; elke dag dat je de app gebruikt, schuift dit op

/* ---------- Rij → object ---------- */
function codeOut(r) {
  if (!r) return null;
  return { id: r.id, userId: r.user_id, typeId: r.type_id, contentType: r.content_type, content: JSON.parse(r.content), design: JSON.parse(r.design),
    name: r.name || undefined, paused: !!r.paused, scans: r.scans, lastScanAt: r.last_scan_at, createdAt: r.created_at, updatedAt: r.updated_at || undefined };
}
function userOut(r) { return r && { id: r.id, email: r.email, name: r.name, background: r.background, customBackground: r.custom_background || null, createdAt: r.created_at }; }

/* ---------- Gebruikers ---------- */
const st = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'),
  insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'),
  sessionUser: db.prepare('SELECT u.*, s.expires_at AS s_exp FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'),
  extendSession: db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  codesOf: db.prepare('SELECT * FROM qr_codes WHERE user_id = ? ORDER BY created_at DESC'),
  code: db.prepare('SELECT * FROM qr_codes WHERE id = ?'),
  statsOf: db.prepare('SELECT s.code_id, s.day, s.key, s.scans, s.uniq FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ?'),
  scan: db.prepare('UPDATE qr_codes SET scans = scans + 1, last_scan_at = ? WHERE id = ?'),
  stat: db.prepare(`INSERT INTO scan_stats (code_id, day, key, scans, uniq) VALUES (?, ?, ?, 1, ?)
                    ON CONFLICT(code_id, day, key) DO UPDATE SET scans = scans + 1, uniq = uniq + excluded.uniq`),
  fileById: db.prepare('SELECT * FROM files WHERE id = ?'),
  filesOfCode: db.prepare('SELECT id FROM files WHERE code_id = ?'),
  filesOfUser: db.prepare('SELECT id FROM files WHERE user_id = ?')
};

function removeFiles(ids) { ids.forEach((id) => { try { fs.unlinkSync(path.join(FILES, id)); } catch (e) {} }); }

module.exports = {
  path: FILE,
  raw: db,

  /* Gebruikers en inloggen */
  createUser({ email, name, passwordHash }) {
    const id = newId(9); st.insertUser.run(id, email.trim(), String(name || '').trim().slice(0, 80), passwordHash, now());
    return userOut(st.userById.get(id));
  },
  userByEmail: (email) => st.userByEmail.get(String(email || '').trim()) || null,     // met password_hash (alleen voor inloggen)
  getUser: (id) => userOut(st.userById.get(id)),
  passwordHashOf: (id) => (st.userById.get(id) || {}).password_hash,
  updateUser(id, patch) {
    const cols = { name: 'name', background: 'background', customBackground: 'custom_background', passwordHash: 'password_hash', email: 'email' };
    const keys = Object.keys(patch).filter((k) => cols[k]); if (!keys.length) return module.exports.getUser(id);
    db.prepare('UPDATE users SET ' + keys.map((k) => cols[k] + ' = ?').join(', ') + ', updated_at = ? WHERE id = ?').run(...keys.map((k) => patch[k]), now(), id);
    return module.exports.getUser(id);
  },
  // Account verwijderen: alles weg (codes, statistieken, sessies, bestanden op schijf)
  deleteUser(id) {
    const files = st.filesOfUser.all(id).map((r) => r.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    removeFiles(files);
  },
  createSession(userId) {
    const token = newId(32), exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
    st.insertSession.run(hash(token), userId, now(), exp);
    return { token, expires: exp };
  },
  // Geldige sessie? Dan de gebruiker; sessies worden bij gebruik verlengd (max. 1x per dag)
  sessionUser(token) {
    if (!token) return null;
    const r = st.sessionUser.get(hash(token)); if (!r) return null;
    if (r.s_exp < now()) { st.deleteSession.run(hash(token)); return null; }
    const u = userOut(r);
    if (new Date(r.s_exp) - Date.now() < (SESSION_DAYS - 1) * 864e5) {             // hooguit één keer per dag verlengen
      const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
      st.extendSession.run(exp, hash(token));
      Object.defineProperty(u, 'renewUntil', { value: exp, enumerable: false });   // auth.js ververst dan ook het cookie
    }
    return u;
  },
  deleteSession: (token) => st.deleteSession.run(hash(token)),
  deleteSessionsOf: (userId, exceptToken) => db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, exceptToken ? hash(exceptToken) : ''),
  // Overzicht voor Mijn account: aantal codes, scans (totaal en laatste 30 dagen), ingelogde apparaten
  summary(userId) {
    const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
    const one = (sql, ...a) => db.prepare(sql).get(...a);
    return {
      codes: one('SELECT COUNT(*) n FROM qr_codes WHERE user_id = ?', userId).n,
      scans: one('SELECT COALESCE(SUM(s.scans),0) n FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ?', userId).n,
      scans30: one('SELECT COALESCE(SUM(s.scans),0) n FROM scan_stats s JOIN qr_codes q ON q.id = s.code_id WHERE q.user_id = ? AND s.day >= ?', userId, since).n,
      sessions: one('SELECT COUNT(*) n FROM sessions WHERE user_id = ? AND expires_at > ?', userId, new Date().toISOString()).n,
    };
  },
  createReset(userId) {
    const token = newId(32);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
    db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hash(token), userId, new Date(Date.now() + 3600e3).toISOString());
    return token;
  },
  // Eén keer bruikbaar, 1 uur geldig
  useReset(token) {
    const r = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(hash(token)); if (!r) return null;
    db.prepare('DELETE FROM password_resets WHERE token_hash = ?').run(hash(token));
    return r.expires_at > now() ? r.user_id : null;
  },
  // Opruimen: verlopen sessies en reset-links
  cleanup() {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
    db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(now());
  },

  /* QR-codes */
  listQrCodes: (userId) => st.codesOf.all(userId).map(codeOut),
  // Met statistieken (voor /api/analytics): { stats: { dag: { sleutel: [scans, uniek] } } }
  listWithStats(userId) {
    const codes = st.codesOf.all(userId).map(codeOut), byId = {};
    codes.forEach((c) => { c.stats = {}; byId[c.id] = c; });
    st.statsOf.all(userId).forEach((r) => { const c = byId[r.code_id]; if (!c) return; (c.stats[r.day] = c.stats[r.day] || {})[r.key] = [r.scans, r.uniq]; });
    return codes;
  },
  getQrCode: (id) => codeOut(st.code.get(id)),                                     // openbaar (scannen)
  getOwnedQrCode(id, userId) { const q = codeOut(st.code.get(id)); return q && q.userId === userId ? q : null; },
  idTaken: (id) => !!st.code.get(id),
  insertQrCode(userId, q) {
    db.prepare(`INSERT INTO qr_codes (id, user_id, type_id, content_type, content, design, name, paused, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(q.id, userId, q.typeId, q.contentType, JSON.stringify(q.content), JSON.stringify(q.design || {}), q.name || null, q.createdAt || now());
    return codeOut(st.code.get(q.id));
  },
  updateQrCode(id, patch) {
    const sets = [], vals = [];
    if (patch.content) { sets.push('content = ?'); vals.push(JSON.stringify(patch.content)); }
    if (patch.design) { sets.push('design = ?'); vals.push(JSON.stringify(patch.design)); }
    if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name || null); }
    if (patch.paused !== undefined) { sets.push('paused = ?'); vals.push(patch.paused ? 1 : 0); }
    sets.push('updated_at = ?'); vals.push(now());
    db.prepare('UPDATE qr_codes SET ' + sets.join(', ') + ' WHERE id = ?').run(...vals, id);
    return codeOut(st.code.get(id));
  },
  deleteQrCode(id, userId) {
    const q = st.code.get(id); if (!q || q.user_id !== userId) return false;
    const files = st.filesOfCode.all(id).map((r) => r.id);
    db.prepare('DELETE FROM qr_codes WHERE id = ?').run(id); removeFiles(files);
    return true;
  },
  // Scan tellen (in één transactie): totaal + per dag per "systeem|land|stad"
  addScan: db.transaction((id, info) => {
    const t = now(), day = t.slice(0, 10), key = (info && info.key) || 'other||';
    st.scan.run(t, id); st.stat.run(id, day, key, !info || info.unique ? 1 : 0);
    return codeOut(st.code.get(id));
  }),

  /* Bestanden (PDF, MP3): op schijf, met een willekeurig id als naam */
  saveFile({ userId, codeId, name, mime, buffer }) {
    const id = newId(16);
    fs.writeFileSync(path.join(FILES, id), buffer);
    db.prepare('INSERT INTO files (id, code_id, user_id, name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, codeId || null, userId, name, mime, buffer.length, now());
    return id;
  },
  attachFile: (id, codeId) => db.prepare('UPDATE files SET code_id = ? WHERE id = ?').run(codeId, id),
  getFile(id) { const r = st.fileById.get(id); return r ? Object.assign({ path: path.join(FILES, r.id) }, r) : null; },
  // Bestanden van een code die niet meer gebruikt worden (na bewerken) weghalen
  pruneFiles(codeId, keepIds) {
    const gone = st.filesOfCode.all(codeId).map((r) => r.id).filter((id) => keepIds.indexOf(id) < 0);
    gone.forEach((id) => db.prepare('DELETE FROM files WHERE id = ?').run(id)); removeFiles(gone);
  },

  /* Back-up (veilig, ook terwijl de server draait) */
  backup: (to) => db.backup(to)
};
