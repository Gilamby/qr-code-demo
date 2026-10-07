/* Optimasys QR — server
   - serveert de frontend (public/) en de gedeelde config (shared/)
   - REST-API onder /api
   - korte links /q/:id die scans tellen en doorsturen */
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { validateQrCode, validateMe, QR_TYPES } = require('./validate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

const baseUrl = (req) => process.env.PUBLIC_URL || (req.protocol + '://' + req.get('host'));
const withLink = (req, q) => Object.assign({}, q, { shortUrl: baseUrl(req) + '/q/' + q.id });
const newId = () => crypto.randomBytes(5).toString('base64url');   // bv. "aZ3k9Qp"

/* ---------- API ---------- */
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/qr-types', (req, res) => res.json(QR_TYPES));

app.get('/api/qr-codes', (req, res) => res.json(db.listQrCodes().map((q) => withLink(req, q))));

app.get('/api/qr-codes/:id', (req, res) => {
  const q = db.getQrCode(req.params.id);
  if (!q) return res.status(404).json({ error: 'QR code not found' });
  res.json(withLink(req, q));
});

app.post('/api/qr-codes', (req, res) => {
  const { errors, value } = validateQrCode(req.body);
  if (errors.length) return res.status(400).json({ error: 'Invalid QR code', details: errors });
  const record = db.insertQrCode(Object.assign({ id: newId(), createdAt: new Date().toISOString(), scans: 0, lastScanAt: null }, value));
  res.status(201).json(withLink(req, record));
});

app.delete('/api/qr-codes/:id', (req, res) => {
  if (!db.deleteQrCode(req.params.id)) return res.status(404).json({ error: 'QR code not found' });
  res.status(204).end();
});

app.get('/api/me', (req, res) => res.json(db.getMe()));

app.patch('/api/me', (req, res) => {
  const { errors, value } = validateMe(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'Invalid profile update', details: errors });
  res.json(db.updateMe(value));
});

/* ---------- Korte link: scan tellen en doorsturen ---------- */
app.get('/q/:id', (req, res) => {
  const q = db.addScan(req.params.id);
  if (!q) return res.status(404).send('QR code not found');
  const c = q.content;
  if (q.contentType === 'url' && c.url) return res.redirect(c.url);
  if (q.contentType === 'message' && c.phone) return res.redirect('https://wa.me/' + c.phone.replace(/\D/g, '') + (c.message ? '?text=' + encodeURIComponent(c.message) : ''));
  // Overige types: eenvoudige landingspagina (later vervangen door de echte Optimasys-pagina per type)
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const rows = Object.entries(c).map(([k, v]) => '<li><span>' + esc(k) + '</span>' + esc(v) + '</li>').join('');
  res.send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Optimasys</title>' +
    '<style>body{margin:0;font:16px system-ui;background:#0b0e13;color:#f3f5f8;display:grid;place-items:center;min-height:100vh}main{width:min(420px,90vw)}h1{font-size:28px}ul{list-style:none;padding:0}li{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid #222}span{color:#98a2b3}</style>' +
    '<main><p style="color:#2bb5f0">Optimasys</p><h1>' + esc(q.typeId) + '</h1><ul>' + rows + '</ul></main>');
});

app.listen(PORT, () => console.log('Optimasys QR draait op http://localhost:' + PORT));
