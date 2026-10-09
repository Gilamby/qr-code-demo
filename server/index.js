/* =========================================================
   OPTIMASYS QR — server
   - serveert de app (public/) en de gedeelde instellingen (shared/)
   - REST-API onder /api (accounts, QR-codes, statistieken, hulpdiensten)
   - korte links /q/:id: regels toepassen, scan tellen, pagina tonen of doorsturen
   Instellingen via omgevingsvariabelen of een .env-bestand (zie .env.example).
   ========================================================= */
require('./config');                                   // .env inlezen (vóór de rest)
require('./async-errors');                             // fouten in async routes netjes afhandelen (Express 4)
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');
const analytics = require('./analytics');
const links = require('./links');
const livePage = require('./live-page');
const { validateQrCode, validateMe, QR_TYPES, EMAIL } = require('./validate');

const app = express();
const PORT = +process.env.PORT || 3000;
app.disable('x-powered-by');
// Achter een proxy (nginx, hosting): het echte IP-adres uit X-Forwarded-For. Standaard alleen van deze machine.
// TRUST_PROXY: "true" (alles), een getal (aantal proxy's, bv. 1 bij Railway/Render) of IP-adressen/"loopback".
const tp = String(process.env.TRUST_PROXY || 'loopback').trim();
app.set('trust proxy', tp === 'true' ? true : tp === 'false' ? false : /^\d+$/.test(tp) ? +tp : tp);

/* ---------- Beveiliging: headers voor elke pagina ---------- */
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '16mb' }));             // ruimte voor een PDF/MP3 (max. 10 MB) of een fotogalerij
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
/* ---------- De app ----------
   Productie (NODE_ENV=production + npm run build): alleen de samengevoegde, gecomprimeerde bestanden uit build/.
   De leesbare broncode (js/, shared/, css/app.css) is dan niet op te vragen. Ontwikkelen: gewoon public/. */
const fs = require('fs');
const BUILD = path.join(__dirname, '..', 'build');
let bundle = null;
if (process.env.NODE_ENV === 'production') {
  try { bundle = JSON.parse(fs.readFileSync(path.join(BUILD, 'manifest.json'), 'utf8')); livePage.useBundle(bundle); }
  catch (e) { console.warn('Let op: geen productieversie gevonden. Draai eerst "npm run build".'); }
}
if (bundle) {
  app.get(['/', '/index.html'], (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(BUILD, 'index.html')));
  app.use((req, res, next) => (/^\/(js|shared|vendor)\//.test(req.path) || /^\/css\/(app|live)\.css$/.test(req.path) || req.path === '/manifest.json' ? res.status(404).end() : next()));
  app.use(express.static(BUILD, { index: false, maxAge: '365d', immutable: true }));   // namen met hash: mag lang in de cache
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: false, maxAge: '1h' }));
} else {
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: 0 }));
  app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
}
app.use(auth.session);                                 // req.user = wie is ingelogd (of null)
app.use('/api', auth.sameOrigin);                      // wijzigingen alleen vanaf onze eigen pagina's

// Het adres dat in elke QR-code komt. Een telefoon moet het kunnen openen:
// 1. PUBLIC_URL uit .env (live: bv. https://qr.optimasys.com)
// 2. anders, als je de app op "localhost" opent: het wifi-adres van deze computer (bv. http://192.168.1.20:3000),
//    want "localhost" op je telefoon is je telefoon zelf. Telefoon en computer moeten dan op hetzelfde wifi zitten.
// 3. anders het adres waarmee de app geopend is.
const os = require('os');
// Het wifi-adres van deze computer. Virtuele netwerken (WSL, Docker, VirtualBox, VMware, VPN) slaan we over,
// en we kiezen het liefst een thuis-/kantooradres (192.168.x.x, dan 10.x.x.x, dan 172.16-31.x.x).
function lanIp() {
  const VIRTUAL = /vethernet|virtualbox|vmware|vbox|docker|wsl|hyper-v|tailscale|zerotier|utun|tun|tap|loopback|bridge|br-|veth/i;
  const list = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) for (const a of addrs || []) {
    if (a.family !== 'IPv4' && a.family !== 4) continue;
    if (a.internal || /^169\.254\./.test(a.address) || VIRTUAL.test(name)) continue;
    list.push(a.address);
  }
  const rank = (ip) => /^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
  return list.sort((x, y) => rank(x) - rank(y))[0] || '';
}
const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/i;
// GitHub Codespaces: de app is bereikbaar via https://<naam>-<poort>.app.github.dev (poort op "Public" zetten)
const codespaceUrl = () => process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  ? 'https://' + process.env.CODESPACE_NAME + '-' + PORT + '.' + process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN : '';
const baseUrl = (req) => {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  if (codespaceUrl()) return codespaceUrl();
  const host = req.get('host') || '';
  if (LOCAL.test(host)) { const ip = lanIp(), port = (host.match(/:(\d+)$/) || [])[1]; if (ip) return req.protocol + '://' + ip + (port ? ':' + port : ''); }
  return req.protocol + '://' + host;
};
// Kan een telefoon dit adres openen? (niet bij localhost zonder wifi-adres)
const phoneReachable = (base) => !/^https?:\/\/(localhost|127\.|\[::1\])/i.test(base);
// Wachtwoord van de pagina (veld met type 'password'). Het wifi-wachtwoord is gewone inhoud en blijft leesbaar.
const secretKey = (typeId) => { const t = QR_TYPES.find((x) => x.id === typeId); const f = t && t.fields.find((x) => x.type === 'password'); return f ? f.key : null; };
const fileFields = (typeId) => { const t = QR_TYPES.find((x) => x.id === typeId); return t ? t.fields.filter((f) => f.type === 'file').map((f) => f.key) : []; };
// Naar buiten: nooit het (gehashte) wachtwoord, nooit het bestand zelf in de lijst
const out = (req, q) => {
  const content = Object.assign({}, q.content), key = secretKey(q.typeId);
  const hasPassword = !!(key && content[key]); if (key) delete content[key];
  Object.keys(content).forEach((k) => { if (typeof content[k] === 'string' && content[k].indexOf('"d":"data:') > 0) { try { const o = JSON.parse(content[k]); delete o.d; content[k] = JSON.stringify(o); } catch (e) {} } });
  const r = Object.assign({}, q, { content, hasPassword, shortUrl: baseUrl(req) + '/q/' + q.id }); delete r.userId;
  return r;
};
const cleanName = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 60);
const newId = () => crypto.randomBytes(5).toString('base64url');   // bv. "aZ3k9Qp"

// PDF/MP3 uit de inhoud halen en als bestand op schijf zetten; in de inhoud blijft { n, s, f } over
async function storeFiles(userId, typeId, content, codeId) {
  const keep = [];
  for (const key of fileFields(typeId)) {
    if (!content[key]) continue;
    const o = JSON.parse(content[key]);
    if (o.d) {
      const m = o.d.match(/^data:([\w/.+-]+);base64,(.*)$/); if (!m) { delete content[key]; continue; }
      const buffer = Buffer.from(m[2], 'base64');
      const id = await db.saveFile({ userId, codeId, name: o.n, mime: m[1], buffer });
      content[key] = JSON.stringify({ n: o.n, s: buffer.length, f: id }); keep.push(id);
    } else if (o.f) {
      const f = await db.getFile(o.f);                                       // alleen een eigen bestand van deze code
      if (!f || f.user_id !== userId || (codeId && f.code_id && f.code_id !== codeId)) delete content[key];
      else { content[key] = JSON.stringify({ n: o.n, s: f.size, f: f.id }); keep.push(f.id); }
    } else delete content[key];
  }
  return keep;
}
const missingRequired = (typeId, content) => { const t = QR_TYPES.find((x) => x.id === typeId); return t.fields.filter((f) => f.required && !content[f.key]).map((f) => f.key + ': required'); };

/* ---------- Openbaar ---------- */
app.get('/api/health', async (req, res) => { try { await db.ping(); const qrBase = baseUrl(req); res.json({ ok: true, qrBase, phoneReachable: phoneReachable(qrBase) }); } catch (e) { res.status(503).json({ ok: false }); } });
app.get('/api/qr-types', (req, res) => res.json(QR_TYPES));

/* ---------- Accounts ---------- */
auth.routes(app, baseUrl);
const need = auth.requireUser;

/* ---------- QR-codes (alleen eigen codes) ---------- */
app.get('/api/qr-codes', need, async (req, res) => res.json((await db.listQrCodes(req.user.id)).map((q) => out(req, q))));

app.get('/api/qr-codes/:id', need, async (req, res) => {
  const q = await db.getOwnedQrCode(req.params.id, req.user.id);
  if (!q) return res.status(404).json({ error: 'QR code not found' });
  res.json(out(req, q));
});

app.post('/api/qr-codes', need, async (req, res) => {
  const { errors, value } = validateQrCode(req.body);
  if (errors.length) return res.status(400).json({ error: 'Invalid QR code', details: errors });
  const key = secretKey(value.typeId);
  if (key && value.content[key]) value.content[key] = links.hashPassword(value.content[key]);
  if (req.body.name) value.name = cleanName(req.body.name);
  // De app reserveert vooraf een eigen id, zodat de QR-code in de preview precies de code is die je krijgt.
  const id = typeof req.body.id === 'string' && /^[A-Za-z0-9_-]{7,12}$/.test(req.body.id) && !(await db.idTaken(req.body.id)) ? req.body.id : newId();
  const files = await storeFiles(req.user.id, value.typeId, value.content, null);
  const miss = missingRequired(value.typeId, value.content); if (miss.length) return res.status(400).json({ error: 'Invalid QR code', details: miss });
  const record = await db.insertQrCode(req.user.id, Object.assign({ id }, value));
  for (const f of files) await db.attachFile(f, id);
  res.status(201).json(out(req, record));
});

// Bewerken: nieuwe inhoud en ontwerp, zelfde link, scans blijven staan.
app.put('/api/qr-codes/:id', need, async (req, res) => {
  const old = await db.getOwnedQrCode(req.params.id, req.user.id);
  if (!old) return res.status(404).json({ error: 'QR code not found' });
  const { errors, value } = validateQrCode(Object.assign({}, req.body, { typeId: old.typeId }));
  if (errors.length) return res.status(400).json({ error: 'Invalid QR code', details: errors });
  const key = secretKey(old.typeId);
  if (key) {
    if (value.content[key]) value.content[key] = links.hashPassword(value.content[key]);
    else if (req.body.keepPassword && old.content[key]) value.content[key] = old.content[key];   // wachtwoord niet opnieuw ingevuld: het oude blijft
  }
  const files = await storeFiles(req.user.id, old.typeId, value.content, old.id);
  const miss = missingRequired(old.typeId, value.content); if (miss.length) return res.status(400).json({ error: 'Invalid QR code', details: miss });
  for (const f of files) await db.attachFile(f, old.id);
  await db.pruneFiles(old.id, files);                                        // vervangen bestanden opruimen
  const patch = { content: value.content, design: value.design };
  if (req.body.name !== undefined) patch.name = cleanName(req.body.name);
  res.json(out(req, await db.updateQrCode(old.id, patch)));
});

// Kleine wijziging vanuit Mijn QR-codes: naam of aan/uit
app.patch('/api/qr-codes/:id', need, async (req, res) => {
  if (!(await db.getOwnedQrCode(req.params.id, req.user.id))) return res.status(404).json({ error: 'QR code not found' });
  const b = req.body || {}, patch = {}, errors = [];
  if (b.name !== undefined) { if (typeof b.name !== 'string') errors.push('name: must be text'); else patch.name = cleanName(b.name); }
  if (b.paused !== undefined) { if (typeof b.paused !== 'boolean') errors.push('paused: must be true or false'); else patch.paused = b.paused; }
  if (errors.length || !Object.keys(patch).length) return res.status(400).json({ error: 'Invalid update', details: errors.length ? errors : ['nothing to change'] });
  res.json(out(req, await db.updateQrCode(req.params.id, patch)));
});

app.delete('/api/qr-codes/:id', need, async (req, res) => {
  if (!(await db.deleteQrCode(req.params.id, req.user.id))) return res.status(404).json({ error: 'QR code not found' });
  res.status(204).end();
});

/* ---------- Statistieken (alleen eigen codes) ---------- */
app.get('/api/analytics', need, async (req, res) => res.json(analytics.overview(await db.listWithStats(req.user.id), req.query)));
app.get('/api/analytics.csv', need, async (req, res) => {
  const nameOf = (q) => q.name || q.content.title || q.content.name || q.content.pageName || q.content.restaurant || q.content.appName || q.content.company || q.content.ssid || q.content.url || q.typeId;
  res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="statistieken.csv"');
  res.send(analytics.csv(await db.listWithStats(req.user.id), req.query, nameOf));
});

/* ---------- Instellingen van de gebruiker (achtergrond) ---------- */
app.get('/api/me', need, (req, res) => res.json({ name: req.user.name, background: req.user.background, customBackground: req.user.customBackground }));
app.patch('/api/me', need, async (req, res) => {
  const { errors, value } = validateMe(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'Invalid profile update', details: errors });
  const u = await db.updateUser(req.user.id, value);
  res.json({ name: u.name, background: u.background, customBackground: u.customBackground });
});

/* ---------- Hulpdiensten voor het formulier (alleen ingelogd: geen open doorgeefluik voor anderen) ---------- */
// Website controleren: bestaat hij en wat is de titel? (voor de link-check en de automatische naam)
app.get('/api/url-info', need, async (req, res) => {
  const url = String(req.query.url || '');
  try { new URL(url); } catch (e) { return res.status(400).json({ ok: false, error: 'Invalid URL' }); }
  try { res.json(await links.urlInfo(url)); }
  catch (e) { res.json({ ok: false, status: 0, title: '' }); }
});

/* Adres zoeken via onze server (privacy): de gebruiker praat alleen met ons, wij vragen het aan Photon (OpenStreetMap).
   Zo ziet de adres-dienst nooit het IP-adres van de gebruiker. Voor groot gebruik: eigen Photon-server (PHOTON_URL). */
app.get('/api/geocode', need, async (req, res) => {
  const q = String(req.query.q || '').slice(0, 120).trim();
  if (q.length < 3) return res.json({ features: [] });
  const lang = ['de', 'en', 'fr'].includes(req.query.lang) ? '&lang=' + req.query.lang : '';
  const limit = Math.min(8, Math.max(1, parseInt(req.query.limit, 10) || 5));
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch((process.env.PHOTON_URL || 'https://photon.komoot.io') + '/api/?limit=' + limit + lang + '&q=' + encodeURIComponent(q), { signal: ctrl.signal, headers: { 'User-Agent': 'OptimasysQR (+https://optimasys.com)' } });
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    res.json({ features: (data.features || []).map((f) => ({ geometry: { coordinates: f.geometry.coordinates }, properties: f.properties })) });
  } catch (e) { res.status(502).json({ features: [], error: 'Address search unavailable' }); }
  finally { clearTimeout(timer); }
});

// E-mail controleren: klopt de vorm en kan het domein mail ontvangen (MX-record, anders een gewoon adres)?
// We sturen geen mail en bewaren niets; alleen het domein wordt opgezocht.
const dns = require('dns').promises;
const mailCache = new Map();
app.get('/api/email-check', need, async (req, res) => {
  const email = String(req.query.e || '').trim().slice(0, 254);
  if (!EMAIL.test(email)) return res.json({ ok: false, reason: 'format' });
  const domain = email.split('@')[1].toLowerCase();
  if (mailCache.has(domain)) return res.json({ ok: mailCache.get(domain), reason: mailCache.get(domain) ? '' : 'domain' });
  const timeout = new Promise((r) => setTimeout(() => r('timeout'), 3500));
  const look = (async () => {
    try { const mx = await dns.resolveMx(domain); if (mx && mx.some((m) => m.exchange && m.exchange !== '.')) return true; } catch (e) { if (e.code !== 'ENODATA' && e.code !== 'ENOTFOUND') throw e; }
    try { const a = await dns.resolve4(domain); return a.length > 0; } catch (e) { if (e.code === 'ENODATA' || e.code === 'ENOTFOUND') return false; throw e; }
  })().catch(() => 'unknown');
  const ok = await Promise.race([look, timeout]);
  if (ok === 'timeout' || ok === 'unknown') return res.json({ ok: true, reason: 'unchecked' });   // twijfel: niet blokkeren
  if (mailCache.size > 5000) mailCache.clear();
  mailCache.set(domain, ok);
  res.json({ ok, reason: ok ? '' : 'domain' });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

/* ---------- Korte link: regels toepassen, scan tellen en doorsturen ---------- */
async function openCode(req, res, passwordOk) {
  const found = await db.getQrCode(req.params.id);
  if (!found) return res.status(404).send(links.notFoundPage(req));
  if (found.paused) return res.status(503).set('Retry-After', '3600').send(links.pausedPage(req));   // tijdelijk uit: niet tellen
  if (links.isExpired(found)) return res.status(410).send(links.expiredPage(req));
  const key = secretKey(found.typeId);
  if (key && found.content[key] && !passwordOk) return res.send(links.passwordPage(req, req.method === 'POST'));
  const q = await db.addScan(found.id, analytics.describe(found, req));
  const c = q.content;
  res.set('Cache-Control', 'no-store');                               // elke scan moet bij ons langskomen
  if (q.contentType === 'url' && c.url) return res.redirect(links.targetUrl(q, req.get('user-agent')));
  if (q.contentType === 'message' && c.phone) return res.redirect('https://wa.me/' + c.phone.replace(/\D/g, '') + (c.message ? '?text=' + encodeURIComponent(c.message) : ''));
  // Doorsturen naar wat al bestaat
  const ua = req.get('user-agent') || '';
  if (q.typeId === 'facebook' && c.url) return res.redirect(c.url);
  if (q.typeId === 'instagram' && c.username) return res.redirect('https://instagram.com/' + encodeURIComponent(c.username.replace(/^@/, '')));
  if (q.typeId === 'apps') {                                   // telefoon: meteen naar de juiste winkel; computer: de pagina met beide knoppen
    if (/iPhone|iPad|iPod/i.test(ua) && c.ios) return res.redirect(c.ios);
    if (/Android/i.test(ua) && c.android) return res.redirect(c.android);
  }
  // Alle andere types: de echte pagina, met dezelfde sjablonen als de telefoon in de tool
  const type = QR_TYPES.find((t) => t.id === q.typeId);
  if (!type) return res.status(404).send(links.notFoundPage(req));
  res.send(livePage.livePage(req, q, type));
}
app.get('/q/:id', (req, res) => openCode(req, res, false));
app.get('/q/:id/file/:key', async (req, res) => {
  const q = await db.getQrCode(req.params.id);
  if (!q || q.paused || links.isExpired(q)) return res.status(404).send(links.notFoundPage(req));
  const key = secretKey(q.typeId);
  if (key && q.content[key] && !links.fileTokenOk(q, req.params.key, req.query.t)) return res.status(403).send(links.passwordPage(req, false));
  return livePage.sendFile(res, q, req.params.key);
});
app.post('/q/:id', async (req, res) => {
  const q = await db.getQrCode(req.params.id);
  const key = q && secretKey(q.typeId);
  return openCode(req, res, !!(key && q.content[key] && links.checkPassword((req.body || {}).password || '', q.content[key])));
});

/* ---------- Fouten: nette antwoorden, geen interne details ---------- */
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Too large (max. 10 MB per file)' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

/* ---------- Opruimen en netjes stoppen ---------- */
const tidy = () => db.cleanup().catch((e) => console.error('Opruimen mislukt:', e.message));
tidy(); setInterval(tidy, 3600e3).unref();
if (require.main === module) db.ready.then(start, (e) => {
  console.error('\nDe database is niet bereikbaar: ' + e.message);
  console.error(process.env.DATABASE_URL ? 'Controleer DATABASE_URL (adres, gebruiker, wachtwoord, database) en of de database aan staat.' : 'Controleer DATA_DIR / DB_PATH.');
  process.exit(1);
});
function start() {
  const server = app.listen(PORT, process.env.HOST || undefined, () => {
    db.label().then((l) => console.log('Optimasys QR draait op http://localhost:' + PORT + ' (database: ' + (db.kind === 'postgres' ? 'PostgreSQL ' : 'SQLite ') + l + ')')).catch(() => {});
    if (process.env.PUBLIC_URL) console.log('QR-codes wijzen naar: ' + process.env.PUBLIC_URL);
    else if (codespaceUrl()) {
      console.log('\nCodespaces: QR-codes wijzen naar ' + codespaceUrl());
      // Poort openbaar maken, zodat een telefoon hem kan openen (lukt dit niet: tab "Poorten" > rechtermuisknop op ' + PORT + ' > Port Visibility > Public)
      require('child_process').exec('gh codespace ports visibility ' + PORT + ':public -c ' + process.env.CODESPACE_NAME, (err) => console.log(err
        ? 'Zet poort ' + PORT + ' op "Public": tab "Poorten" (Ports) onderin > rechtermuisknop op ' + PORT + ' > Port Visibility > Public.'
        : 'Poort ' + PORT + ' staat op Public: je telefoon kan de codes openen (ook via 4G). Open de app via dit adres: ' + codespaceUrl()));
    }
    else if (lanIp()) console.log('QR-codes wijzen naar: http://' + lanIp() + ':' + PORT + '  (scannen met je telefoon: zelfde wifi als deze computer)');
    else console.log('Let op: geen wifi-adres gevonden. Zet PUBLIC_URL in .env, anders kan een telefoon de QR-codes niet openen.');
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error('\nPoort ' + PORT + ' is al bezet: de app draait waarschijnlijk al in een ander terminalvenster.\nStop die eerst (Ctrl+C in dat venster, of het prullenbakje bij die terminal) en typ dan opnieuw: npm start\n');
    else console.error(e);
    process.exit(1);
  });
  const stop = () => { server.close(() => { db.close().finally(() => process.exit(0)); }); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
module.exports = app;
