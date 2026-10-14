/* =========================================================
   STATISTIEKEN – berekening (gedeeld door server en online demo)
   Invoer: QR-codes met { id, createdAt, stats: { 'JJJJ-MM-DD': { 'systeem|land|stad': [scans, uniek] } } }
   ========================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ANALYTICS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function days(from, to) { const out = []; for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z') && out.length < 1200; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10)); return out; }
function list(v) { return String(v || '').split(',').map((x) => x.trim()).filter(Boolean); }
// Oude codes hebben alleen een teller per dag; die tellen mee als "onbekend"
function statsOf(q) {
  if (q.stats) return q.stats;
  const s = {}; Object.keys(q.daily || {}).forEach((d) => { s[d] = { 'other||': [q.daily[d], q.daily[d]] }; }); return s;
}

/** Sleutel van een scan: systeem|land|stad|browser|apparaat (oudere scans hebben alleen de eerste drie: dan 'unknown') */
function parts(key) { const a = String(key).split('|'); return { o: a[0] || 'other', cc: a[1] || '', city: a[2] || '', br: a[3] || 'unknown', dev: a[4] || 'unknown' }; }

function overview(codes, query) {
  const now = new Date().toISOString().slice(0, 10);
  let to = DAY.test(query.to || '') ? query.to : now;
  let from = DAY.test(query.from || '') ? query.from : null;
  if (!from) from = codes.reduce((m, q) => (q.createdAt.slice(0, 10) < m ? q.createdAt.slice(0, 10) : m), to);
  if (from > to) [from, to] = [to, from];
  const range = days(from, to); from = range[0]; to = range[range.length - 1];
  const want = { codes: list(query.codes), os: list(query.os), cc: list(query.cc), city: list(query.city), br: list(query.br), dev: list(query.dev) };
  const pick = codes.filter((q) => !want.codes.length || want.codes.includes(q.id));
  const series = {}; range.forEach((d) => { series[d] = { s: 0, u: 0 }; });
  const by = { os: {}, cc: {}, city: {}, br: {}, dev: {} }, opt = { os: {}, cc: {}, city: {}, br: {}, dev: {} }, perCode = {};
  let scans = 0, unique = 0;
  for (const q of codes) {
    const st = statsOf(q);
    for (const d of range) {
      const day = st[d]; if (!day) continue;
      for (const [key, v] of Object.entries(day)) {
        const { o, cc, city, br, dev } = parts(key), cityKey = cc + '|' + city;
        const inCode = pick.includes(q);
        if (inCode) { opt.os[o] = 1; opt.cc[cc] = 1; opt.city[cityKey] = 1; opt.br[br] = 1; opt.dev[dev] = 1; }
        if (!inCode) continue;
        if (want.os.length && !want.os.includes(o)) continue;
        if (want.cc.length && !want.cc.includes(cc)) continue;
        if (want.city.length && !want.city.includes(cityKey)) continue;
        if (want.br.length && !want.br.includes(br)) continue;
        if (want.dev.length && !want.dev.includes(dev)) continue;
        series[d].s += v[0]; series[d].u += v[1]; scans += v[0]; unique += v[1];
        by.os[o] = (by.os[o] || 0) + v[0]; by.cc[cc] = (by.cc[cc] || 0) + v[0]; by.city[cityKey] = (by.city[cityKey] || 0) + v[0];
        by.br[br] = (by.br[br] || 0) + v[0]; by.dev[dev] = (by.dev[dev] || 0) + v[0];
        perCode[q.id] = (perCode[q.id] || 0) + v[0];
      }
    }
  }
  const sorted = (o) => Object.entries(o).map(([k, s]) => ({ k, s })).sort((a, b) => b.s - a.s || a.k.localeCompare(b.k));
  const keyOk = (key) => { const { o, cc, city, br, dev } = parts(key); return (!want.os.length || want.os.includes(o)) && (!want.cc.length || want.cc.includes(cc)) && (!want.city.length || want.city.includes(cc + '|' + city)) && (!want.br.length || want.br.includes(br)) && (!want.dev.length || want.dev.includes(dev)); };
  // Vorige periode van dezelfde lengte (direct ervoor), met dezelfde filters: om groei of daling te tonen
  const prevTo = new Date(Date.parse(from + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(from + 'T00:00:00Z') - range.length * 864e5).toISOString().slice(0, 10);
  let prevScans = 0, prevUnique = 0;
  for (const q of pick) { const st = statsOf(q); for (const d of days(prevFrom, prevTo)) for (const [key, v] of Object.entries(st[d] || {})) if (keyOk(key)) { prevScans += v[0]; prevUnique += v[1]; } }
  // Per weekdag (0 = maandag) en per uur van de dag (in de tijdzone van de gebruiker)
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  range.forEach((d) => { weekdays[(new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7] += series[d].s; });
  const filtered = want.os.length || want.cc.length || want.city.length || want.br.length || want.dev.length;
  let hours = null, hoursSince = null;
  if (!filtered) {                                               // uren zijn niet per systeem/land opgeslagen: alleen zonder die filters
    let fmt = null; try { fmt = query.tz ? new Intl.DateTimeFormat('en-GB', { timeZone: String(query.tz), hour: '2-digit', weekday: 'short', hourCycle: 'h23' }) : null; } catch (e) { fmt = null; }
    hours = new Array(24).fill(0);
    for (const q of pick) for (const [d, hs] of Object.entries(q.hours || {})) {
      if (d < from || d > to) continue;
      if (!hoursSince || d < hoursSince) hoursSince = d;
      for (const [h, n] of Object.entries(hs)) {
        let local = Number(h);
        if (fmt) { const parts = fmt.formatToParts(new Date(d + 'T' + String(h).padStart(2, '0') + ':30:00Z')); local = Number((parts.find((x) => x.type === 'hour') || { value: h }).value) % 24; }
        hours[local] += n;
      }
    }
  }
  const best = range.reduce((b, d) => (series[d].s > (b ? series[b].s : 0) ? d : b), null);
  return {
    from, to,
    totals: { codes: pick.length, scans, unique },
    insights: { days: range.length, prevFrom, prevTo, prevScans, prevUnique, bestDay: best ? { d: best, s: series[best].s } : null,
      activeCodes: Object.keys(perCode).length, weekdays, hours, hoursSince, filtered: !!filtered },
    series: range.map((d) => ({ d, s: series[d].s, u: series[d].u })),
    os: sorted(by.os), countries: sorted(by.cc), cities: sorted(by.city), browsers: sorted(by.br), devices: sorted(by.dev), codes: sorted(perCode),
    options: { os: Object.keys(opt.os).sort(), countries: Object.keys(opt.cc).sort(), cities: Object.keys(opt.city).sort(), browsers: Object.keys(opt.br).sort(), devices: Object.keys(opt.dev).sort() }
  };
}

// Export: één regel per dag × code × systeem × land × stad × browser × apparaat
function csv(codes, query, nameOf) {
  const o = overview(codes, query), want = { codes: list(query.codes), os: list(query.os), cc: list(query.cc), city: list(query.city), br: list(query.br), dev: list(query.dev) };
  const esc = (v) => { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = [['date', 'qr_code_id', 'qr_code_name', 'operating_system', 'country', 'city', 'browser', 'device', 'scans', 'unique_scans']];
  const range = days(o.from, o.to);
  for (const q of codes) {
    if (want.codes.length && !want.codes.includes(q.id)) continue;
    const st = statsOf(q);
    for (const d of range) for (const [key, v] of Object.entries(st[d] || {})) {
      const { o: os_, cc, city, br, dev } = parts(key);
      if ((want.os.length && !want.os.includes(os_)) || (want.cc.length && !want.cc.includes(cc)) || (want.city.length && !want.city.includes(cc + '|' + city)) || (want.br.length && !want.br.includes(br)) || (want.dev.length && !want.dev.includes(dev))) continue;
      rows.push([d, q.id, nameOf(q), os_, cc, city, br, dev, v[0], v[1]]);
    }
  }
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}


  return { overview: overview, csv: csv, days: days };
});
