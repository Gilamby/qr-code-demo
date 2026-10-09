/* Opslag: één JSON-bestand (server/data/db.json).
   Simpel genoeg voor de demo. Wil je later een echte database (MySQL, PostgreSQL)?
   Vervang dan alleen dit bestand; de rest van de server gebruikt deze functies. */
const fs = require('fs');
const path = require('path');

const FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');
const EMPTY = { qrCodes: [], me: { name: 'Optimasys', background: 'optimasys', customBackground: null } };

let data = load();

function load() {
  try { return Object.assign({}, EMPTY, JSON.parse(fs.readFileSync(FILE, 'utf8'))); }
  catch (e) { return JSON.parse(JSON.stringify(EMPTY)); }
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);   // eerst tijdelijk bestand, dan hernoemen: geen half geschreven bestand bij een crash
}

module.exports = {
  listQrCodes: () => data.qrCodes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getQrCode: (id) => data.qrCodes.find((q) => q.id === id) || null,
  insertQrCode: (record) => { data.qrCodes.push(record); save(); return record; },
  deleteQrCode: (id) => {
    const before = data.qrCodes.length;
    data.qrCodes = data.qrCodes.filter((q) => q.id !== id);
    if (data.qrCodes.length !== before) { save(); return true; }
    return false;
  },
  updateQrCode: (id, patch) => {
    const i = data.qrCodes.findIndex((q) => q.id === id);
    if (i < 0) return null;
    data.qrCodes[i] = Object.assign({}, data.qrCodes[i], patch); save();
    return data.qrCodes[i];
  },
  // Scan tellen: totaal + per dag per soort (systeem|land|stad). Geen IP-adres, geen volledige browsergegevens.
  addScan: (id, info) => {
    const q = data.qrCodes.find((x) => x.id === id);
    if (!q) return null;
    const now = new Date(), day = now.toISOString().slice(0, 10), key = (info && info.key) || 'other||';
    q.scans += 1; q.lastScanAt = now.toISOString();
    q.daily = Object.assign({}, q.daily); q.daily[day] = (q.daily[day] || 0) + 1;
    if (!q.stats) { q.stats = {}; Object.keys(q.daily).forEach((d) => { if (d !== day) q.stats[d] = { 'other||': [q.daily[d], q.daily[d]] }; }); }   // oude tellers overnemen
    const d = q.stats[day] = q.stats[day] || {}, v = d[key] = d[key] || [0, 0];
    v[0] += 1; if (!info || info.unique) v[1] += 1;
    save();
    return q;
  },
  getMe: () => data.me,
  updateMe: (patch) => { data.me = Object.assign({}, data.me, patch); save(); return data.me; }
};
