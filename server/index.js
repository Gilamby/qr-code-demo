/* Optimasys QR — server
   - serveert de frontend (public/) en de gedeelde config (shared/)
   - REST-API onder /api
   - korte links /q/:id die scans tellen en doorsturen */
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { validateQrCode, validateMe, QR_TYPES } = require('./validate');
const links = require('./links');
const livePage = require('./live-page');
const { validateDesign } = require('./validate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '16mb' }));   // ruimte voor een fotogalerij (max. 6 verkleinde foto's)
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

const baseUrl = (req) => process.env.PUBLIC_URL || (req.protocol + '://' + req.get('host'));
// Wachtwoord van de pagina (veld met type 'password'). Het wifi-wachtwoord is gewone inhoud en blijft leesbaar.
const secretKey = (typeId) => { const t = QR_TYPES.find((x) => x.id === typeId); const f = t && t.fields.find((x) => x.type === 'password'); return f ? f.key : null; };
// Naar buiten nooit het (gehashte) wachtwoord sturen; alleen of er een is.
const withLink = (req, q) => {
  const content = Object.assign({}, q.content), key = secretKey(q.typeId);
  const hasPassword = !!(key && content[key]); if (key) delete content[key];
  return Object.assign({}, q, { content, hasPassword, shortUrl: baseUrl(req) + '/q/' + q.id });
};
const cleanName = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 60);
const newId = () => crypto.randomBytes(5).toString('base64url');   // bv. "aZ3k9Qp"

/* ---------- API ---------- */
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/qr-types', (req, res) => res.json(QR_TYPES));

// Lijst zonder de bestanden zelf (PDF/MP3), anders wordt hij onnodig groot
const withoutFiles = (q) => { const c = Object.assign({}, q.content); Object.keys(c).forEach((k) => { if (typeof c[k] === 'string' && c[k].indexOf('"d":"data:') > 0) { try { const o = JSON.parse(c[k]); delete o.d; c[k] = JSON.stringify(o); } catch (e) {} } }); return Object.assign({}, q, { content: c }); };
app.get('/api/qr-codes', (req, res) => res.json(db.listQrCodes().map((q) => withLink(req, withoutFiles(q)))));

app.get('/api/qr-codes/:id', (req, res) => {
  const q = db.getQrCode(req.params.id);
  if (!q) return res.status(404).json({ error: 'QR code not found' });
  res.json(withLink(req, q));
});

app.post('/api/qr-codes', (req, res) => {
  const { errors, value } = validateQrCode(req.body);
  if (errors.length) return res.status(400).json({ error: 'Invalid QR code', details: errors });
  const key = secretKey(value.typeId);
  if (key && value.content[key]) value.content[key] = links.hashPassword(value.content[key]);
  if (req.body.name) value.name = cleanName(req.body.name);
  // De app reserveert vooraf een eigen id, zodat de QR-code in de preview precies de code is die je krijgt.
  const wanted = typeof req.body.id === 'string' && /^[A-Za-z0-9_-]{7,12}$/.test(req.body.id) && !db.getQrCode(req.body.id) ? req.body.id : newId();
  const record = db.insertQrCode(Object.assign({ id: wanted, createdAt: new Date().toISOString(), scans: 0, lastScanAt: null }, value));
  res.status(201).json(withLink(req, record));
});

// Bewerken: nieuwe inhoud en ontwerp, zelfde link, scans blijven staan.
app.put('/api/qr-codes/:id', (req, res) => {
  const old = db.getQrCode(req.params.id);
  if (!old) return res.status(404).json({ error: 'QR code not found' });
  const { errors, value } = validateQrCode(Object.assign({}, req.body, { typeId: old.typeId }));
  if (errors.length) return res.status(400).json({ error: 'Invalid QR code', details: errors });
  const key = secretKey(old.typeId);
  if (key) {
    if (value.content[key]) value.content[key] = links.hashPassword(value.content[key]);
    else if (req.body.keepPassword && old.content[key]) value.content[key] = old.content[key];   // wachtwoord niet opnieuw ingevuld: het oude blijft
  }
  const patch = { content: value.content, design: value.design, updatedAt: new Date().toISOString() };
  if (req.body.name !== undefined) patch.name = cleanName(req.body.name);
  res.json(withLink(req, withoutFiles(db.updateQrCode(old.id, patch))));
});

// Kleine wijziging vanuit Mijn QR-codes: naam of aan/uit
app.patch('/api/qr-codes/:id', (req, res) => {
  if (!db.getQrCode(req.params.id)) return res.status(404).json({ error: 'QR code not found' });
  const b = req.body || {}, patch = {}, errors = [];
  if (b.name !== undefined) { if (typeof b.name !== 'string') errors.push('name: must be text'); else patch.name = cleanName(b.name); }
  if (b.paused !== undefined) { if (typeof b.paused !== 'boolean') errors.push('paused: must be true or false'); else patch.paused = b.paused; }
  if (errors.length || !Object.keys(patch).length) return res.status(400).json({ error: 'Invalid update', details: errors.length ? errors : ['nothing to change'] });
  res.json(withLink(req, withoutFiles(db.updateQrCode(req.params.id, patch))));
});

app.delete('/api/qr-codes/:id', (req, res) => {
  if (!db.deleteQrCode(req.params.id)) return res.status(404).json({ error: 'QR code not found' });
  res.status(204).end();
});

// Website controleren: bestaat hij en wat is de titel? (voor de link-check en de automatische naam)
app.get('/api/url-info', async (req, res) => {
  const url = String(req.query.url || '');
  try { new URL(url); } catch (e) { return res.status(400).json({ ok: false, error: 'Invalid URL' }); }
  try { res.json(await links.urlInfo(url)); }
  catch (e) { res.json({ ok: false, status: 0, title: '' }); }
});

/* Adres zoeken via onze server (privacy): de gebruiker praat alleen met ons, wij vragen het aan Photon (OpenStreetMap).
   Zo ziet de adres-dienst nooit het IP-adres van de gebruiker. Voor groot gebruik: eigen Photon-server draaien (zie docs). */
app.get('/api/geocode', async (req, res) => {
  const q = String(req.query.q || '').slice(0, 120).trim();
  if (q.length < 3) return res.json({ features: [] });
  const lang = ['de', 'en', 'fr'].includes(req.query.lang) ? '&lang=' + req.query.lang : '';
  const limit = Math.min(8, Math.max(1, parseInt(req.query.limit, 10) || 5));
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch((process.env.PHOTON_URL || 'https://photon.komoot.io') + '/api/?limit=' + limit + lang + '&q=' + encodeURIComponent(q), { signal: ctrl.signal, headers: { 'User-Agent': 'OptimasysQR (+https://optimasys.com)' } });
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    // Alleen doorgeven wat de app nodig heeft
    res.json({ features: (data.features || []).map((f) => ({ geometry: { coordinates: f.geometry.coordinates }, properties: f.properties })) });
  } catch (e) { res.status(502).json({ features: [], error: 'Address search unavailable' }); }
  finally { clearTimeout(timer); }
});

app.get('/api/me', (req, res) => res.json(db.getMe()));

app.patch('/api/me', (req, res) => {
  const { errors, value } = validateMe(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'Invalid profile update', details: errors });
  res.json(db.updateMe(value));
});

/* ---------- Korte link: regels toepassen, scan tellen en doorsturen ---------- */
function openCode(req, res, passwordOk) {
  const found = db.getQrCode(req.params.id);
  if (!found) return res.status(404).send(links.notFoundPage(req));
  if (found.paused) return res.status(503).set('Retry-After', '3600').send(links.pausedPage(req));   // tijdelijk uit: niet tellen
  if (links.isExpired(found)) return res.status(410).send(links.expiredPage(req));
  const key = secretKey(found.typeId);
  if (key && found.content[key] && !passwordOk) return res.send(links.passwordPage(req, req.method === 'POST'));
  const q = db.addScan(found.id);
  const c = q.content;
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
  if (!type) return res.status(404).send('Unknown type');
  res.send(livePage.livePage(req, q, type));
}
app.get('/q/:id', (req, res) => openCode(req, res, false));
app.get('/q/:id/file/:key', (req, res) => {
  const q = db.getQrCode(req.params.id);
  if (!q || q.paused || links.isExpired(q)) return res.status(404).send(links.notFoundPage(req));
  const key = secretKey(q.typeId);
  if (key && q.content[key] && !links.fileTokenOk(q, req.params.key, req.query.t)) return res.status(403).send(links.passwordPage(req, false));
  livePage.sendFile(res, q, req.params.key);
});
app.post('/q/:id', (req, res) => {
  const q = db.getQrCode(req.params.id);
  const key = q && secretKey(q.typeId);
  openCode(req, res, !!(key && q.content[key] && links.checkPassword((req.body || {}).password || '', q.content[key])));
});

app.listen(PORT, () => console.log('Optimasys QR draait op http://localhost:' + PORT));
