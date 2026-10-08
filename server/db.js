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
  addScan: (id) => {
    const q = data.qrCodes.find((x) => x.id === id);
    if (!q) return null;
    q.scans += 1; q.lastScanAt = new Date().toISOString(); save();
    return q;
  },
  // Woorden die de QR-assistent niet kende, met een teller (om hem slimmer te maken)
  countAssistantMisses: (words) => {
    if (!words || !words.length) return;
    data.assistantMisses = data.assistantMisses || {};
    words.forEach((w) => { if (/^[\p{L}-]{3,24}$/u.test(w)) data.assistantMisses[w] = (data.assistantMisses[w] || 0) + 1; });
    save();
  },
  getMe: () => data.me,
  updateMe: (patch) => { data.me = Object.assign({}, data.me, patch); save(); return data.me; }
};
