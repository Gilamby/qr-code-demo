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
// Naar buiten nooit het (gehashte) wachtwoord sturen; alleen of er een is.
const withLink = (req, q) => {
  const content = Object.assign({}, q.content);
  const hasPassword = !!content.password; delete content.password;
  return Object.assign({}, q, { content, hasPassword, shortUrl: baseUrl(req) + '/q/' + q.id });
};
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
  if (value.content.password) value.content.password = links.hashPassword(value.content.password);
  // De app reserveert vooraf een eigen id, zodat de QR-code in de preview precies de code is die je krijgt.
  const wanted = typeof req.body.id === 'string' && /^[A-Za-z0-9_-]{7,12}$/.test(req.body.id) && !db.getQrCode(req.body.id) ? req.body.id : newId();
  const record = db.insertQrCode(Object.assign({ id: wanted, createdAt: new Date().toISOString(), scans: 0, lastScanAt: null }, value));
  res.status(201).json(withLink(req, record));
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

app.get('/api/me', (req, res) => res.json(db.getMe()));

app.patch('/api/me', (req, res) => {
  const { errors, value } = validateMe(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'Invalid profile update', details: errors });
  res.json(db.updateMe(value));
});

/* ---------- Korte link: regels toepassen, scan tellen en doorsturen ---------- */
function openCode(req, res, passwordOk) {
  const found = db.getQrCode(req.params.id);
  if (!found) return res.status(404).send('QR code not found');
  if (links.isExpired(found)) return res.status(410).send(links.expiredPage(req));
  if (found.content.password && !passwordOk) return res.send(links.passwordPage(req, req.method === 'POST'));
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
  if (!q || links.isExpired(q)) return res.status(404).send('Not found');
  livePage.sendFile(res, q, req.params.key);
});
app.post('/q/:id', (req, res) => {
  const q = db.getQrCode(req.params.id);
  openCode(req, res, !!(q && q.content.password && links.checkPassword((req.body || {}).password || '', q.content.password)));
});

app.listen(PORT, () => console.log('Optimasys QR draait op http://localhost:' + PORT));
