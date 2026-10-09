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

function overview(codes, query) {
  const now = new Date().toISOString().slice(0, 10);
  let to = DAY.test(query.to || '') ? query.to : now;
  let from = DAY.test(query.from || '') ? query.from : null;
  if (!from) from = codes.reduce((m, q) => (q.createdAt.slice(0, 10) < m ? q.createdAt.slice(0, 10) : m), to);
  if (from > to) [from, to] = [to, from];
  const range = days(from, to); from = range[0]; to = range[range.length - 1];
  const want = { codes: list(query.codes), os: list(query.os), cc: list(query.cc), city: list(query.city) };
  const pick = codes.filter((q) => !want.codes.length || want.codes.includes(q.id));
  const series = {}; range.forEach((d) => { series[d] = { s: 0, u: 0 }; });
  const by = { os: {}, cc: {}, city: {} }, opt = { os: {}, cc: {}, city: {} }, perCode = {};
  let scans = 0, unique = 0;
  for (const q of codes) {
    const st = statsOf(q);
    for (const d of range) {
      const day = st[d]; if (!day) continue;
      for (const [key, v] of Object.entries(day)) {
        const [o, cc, city] = key.split('|'), cityKey = cc + '|' + city;
        const inCode = pick.includes(q);
        if (inCode) { opt.os[o] = 1; opt.cc[cc] = 1; opt.city[cityKey] = 1; }
        if (!inCode) continue;
        if (want.os.length && !want.os.includes(o)) continue;
        if (want.cc.length && !want.cc.includes(cc)) continue;
        if (want.city.length && !want.city.includes(cityKey)) continue;
        series[d].s += v[0]; series[d].u += v[1]; scans += v[0]; unique += v[1];
        by.os[o] = (by.os[o] || 0) + v[0]; by.cc[cc] = (by.cc[cc] || 0) + v[0]; by.city[cityKey] = (by.city[cityKey] || 0) + v[0];
        perCode[q.id] = (perCode[q.id] || 0) + v[0];
      }
    }
  }
  const sorted = (o) => Object.entries(o).map(([k, s]) => ({ k, s })).sort((a, b) => b.s - a.s || a.k.localeCompare(b.k));
  return {
    from, to,
    totals: { codes: pick.length, scans, unique },
    series: range.map((d) => ({ d, s: series[d].s, u: series[d].u })),
    os: sorted(by.os), countries: sorted(by.cc), cities: sorted(by.city), codes: sorted(perCode),
    options: { os: Object.keys(opt.os).sort(), countries: Object.keys(opt.cc).sort(), cities: Object.keys(opt.city).sort() }
  };
}

// Export: één regel per dag × code × systeem × land × stad
function csv(codes, query, nameOf) {
  const o = overview(codes, query), want = { codes: list(query.codes), os: list(query.os), cc: list(query.cc), city: list(query.city) };
  const esc = (v) => { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = [['date', 'qr_code_id', 'qr_code_name', 'operating_system', 'country', 'city', 'scans', 'unique_scans']];
  const range = days(o.from, o.to);
  for (const q of codes) {
    if (want.codes.length && !want.codes.includes(q.id)) continue;
    const st = statsOf(q);
    for (const d of range) for (const [key, v] of Object.entries(st[d] || {})) {
      const [os_, cc, city] = key.split('|');
      if ((want.os.length && !want.os.includes(os_)) || (want.cc.length && !want.cc.includes(cc)) || (want.city.length && !want.city.includes(cc + '|' + city))) continue;
      rows.push([d, q.id, nameOf(q), os_, cc, city, v[0], v[1]]);
    }
  }
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}


  return { overview: overview, csv: csv, days: days };
});
