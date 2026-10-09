/* Automatische test van de server: npm test
   Start de app met een lege, tijdelijke database en loopt alles na wat klanten doen. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'optimasys-test-'));
const { createApp } = require('../server/dist/main');                 // NestJS-app (npm test bouwt eerst server/src)
const { MailerService } = require('../server/dist/auth/mailer.service');
const { DatabaseService } = require('../server/dist/database/database.service');

let base, app, db;
// E-mails onderscheppen: de bevestigingslink uit de "mail" halen
const mails = {};
const tokenFor = (email) => decodeURIComponent(mails[email].split('verify=')[1]);
test.before(async () => {
  app = await createApp();
  app.get(MailerService).sendVerify = async (to, link) => { mails[to] = link; };
  db = app.get(DatabaseService);
  await app.listen(0);
  base = 'http://localhost:' + app.getHttpServer().address().port;
});
test.after(async () => { await app.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

// Kleine "browser" met eigen cookie
function client() {
  let cookie = '';
  return async (method, url, body, headers) => {
    const r = await fetch(base + url, { method, redirect: 'manual', headers: Object.assign({ 'Content-Type': 'application/json', cookie }, headers || {}), body: body ? JSON.stringify(body) : undefined });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: r.status, json, text, headers: r.headers };
  };
}
// Account maken + bevestigen + inloggen (zoals een echte klant)
async function signup(c, email, password, name) {
  await c('POST', '/api/auth/register', { email, password, name });
  await c('POST', '/api/auth/verify', { token: tokenFor(email) });
  return c('POST', '/api/auth/login', { email, password });
}
const pdf = (s) => JSON.stringify({ n: 'test.pdf', s: s.length, d: 'data:application/pdf;base64,' + Buffer.from(s).toString('base64') });
const filesOnDisk = () => fs.readdirSync(path.join(process.env.DATA_DIR, 'files')).length;

test('inloggen en accounts (met e-mailbevestiging)', async () => {
  const a = client();
  assert.equal((await a('GET', '/api/qr-codes')).status, 401, 'zonder inloggen geen codes');
  assert.equal((await a('POST', '/api/auth/register', { email: 'a@example.com', password: 'kort' })).json.error, 'password_short');
  const reg = await a('POST', '/api/auth/register', { email: 'a@example.com', password: 'mijn geheime zin', name: 'Anna' });
  assert.equal(reg.status, 201); assert.equal(reg.json.verify, true);
  assert.equal((await a('GET', '/api/auth/me')).status, 401, 'na account maken nog NIET ingelogd');
  assert.ok(mails['a@example.com'], 'bevestigingsmail verstuurd');
  assert.equal((await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'mijn geheime zin' })).json.error, 'unverified', 'inloggen kan pas na bevestigen');
  assert.equal((await a('POST', '/api/auth/verify', { token: 'verzonnen' })).status, 400);
  const tok = tokenFor('a@example.com');
  assert.equal((await a('POST', '/api/auth/verify', { token: tok })).json.email, 'a@example.com');
  assert.equal((await a('POST', '/api/auth/verify', { token: tok })).status, 400, 'link werkt maar één keer');
  assert.equal((await a('GET', '/api/auth/me')).status, 401, 'bevestigen logt niet vanzelf in');
  const dup = await client()('POST', '/api/auth/register', { email: 'A@example.com', password: 'nog een zin hier' });
  assert.equal(dup.status, 201, 'bestaand adres: zelfde antwoord (niet te zien wie een account heeft)');
  assert.equal((await client()('POST', '/api/auth/login', { email: 'a@example.com', password: 'nog een zin hier' })).status, 401, 'wachtwoord niet overschreven');
  assert.equal((await client()('POST', '/api/auth/login', { email: 'a@example.com', password: 'fout fout fout' })).status, 401);
  assert.equal((await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'mijn geheime zin' })).status, 200);
  assert.equal((await a('GET', '/api/auth/me')).json.email, 'a@example.com');
  await a('POST', '/api/auth/logout', {});
  assert.equal((await a('GET', '/api/auth/me')).status, 401, 'uitgelogd');
  assert.equal((await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'mijn geheime zin' })).status, 200);
});

test('codes zijn per klant, bestanden op schijf, scannen en statistieken', async () => {
  const a = client(), b = client();
  await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'mijn geheime zin' });
  await signup(b, 'b@example.com', 'bobs geheime zin');
  const before = filesOnDisk();
  const made = await a('POST', '/api/qr-codes', { typeId: 'pdf', content: { file: pdf('%PDF eerste'), title: 'Prijzen' } });
  assert.equal(made.status, 201); const id = made.json.id;
  assert.ok(!made.text.includes('base64'), 'bestand niet terug in het antwoord');
  assert.equal(filesOnDisk(), before + 1, 'PDF staat op schijf');
  assert.equal((await a('GET', '/api/qr-codes')).json.length, 1);
  assert.equal((await b('GET', '/api/qr-codes')).json.length, 0, 'B ziet de code van A niet');
  assert.equal((await b('GET', '/api/qr-codes/' + id)).status, 404);
  assert.equal((await b('DELETE', '/api/qr-codes/' + id)).status, 404, 'B kan de code van A niet wissen');
  // scannen (iPhone uit Nederland)
  const page = await fetch(base + '/q/' + id, { headers: { 'user-agent': 'iPhone', 'x-forwarded-for': '145.53.10.1' } });
  assert.equal(page.status, 200);
  assert.equal(await (await fetch(base + '/q/' + id + '/file/file')).text(), '%PDF eerste');
  const stats = (await a('GET', '/api/analytics')).json;
  assert.equal(stats.totals.scans, 1); assert.equal(stats.os[0].k, 'iOS');
  assert.equal((await b('GET', '/api/analytics')).json.totals.scans, 0);
  // bewerken met een nieuw bestand: het oude verdwijnt van schijf
  const edited = await a('PUT', '/api/qr-codes/' + id, { content: { file: pdf('%PDF tweede'), title: 'Prijzen 2' } });
  assert.equal(edited.status, 200); assert.equal(filesOnDisk(), before + 1);
  assert.equal(await (await fetch(base + '/q/' + id + '/file/file')).text(), '%PDF tweede');
  // bewerken zonder nieuw bestand: het bestand blijft
  const kept = await a('PUT', '/api/qr-codes/' + id, { content: { file: JSON.parse(edited.json.content.file) && edited.json.content.file, title: 'Prijzen 3' } });
  assert.equal(kept.status, 200); assert.equal(filesOnDisk(), before + 1);
  // aan/uit
  await a('PATCH', '/api/qr-codes/' + id, { paused: true });
  assert.equal((await fetch(base + '/q/' + id)).status, 503);
  // verwijderen: bestand weg
  assert.equal((await a('DELETE', '/api/qr-codes/' + id)).status, 204);
  assert.equal(filesOnDisk(), before);
  assert.equal((await fetch(base + '/q/' + id)).status, 404);
});

test('beveiliging', async () => {
  const a = client();
  await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'mijn geheime zin' });
  const r = await a('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://example.com' } }, { origin: 'https://evil.example' });
  assert.equal(r.status, 403, 'andere website mag niets wijzigen');
  const h = await fetch(base + '/');
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(h.headers.get('content-security-policy'));
  assert.equal((await a('GET', '/api/geocode?q=test')).status !== 401, true);
  assert.equal((await client()('GET', '/api/geocode?q=test')).status, 401, 'hulpdiensten alleen voor ingelogde gebruikers');
});

test('wachtwoord vergeten en account verwijderen', async () => {
  const a = client(), logs = [], orig = console.log;
  console.log = (...x) => { logs.push(x.join(' ')); };
  await a('POST', '/api/auth/forgot', { email: 'b@example.com' });
  await new Promise((r) => setTimeout(r, 50)); console.log = orig;
  const token = decodeURIComponent((logs.join('\n').match(/reset=([^\s]+)/) || [])[1] || '');
  assert.ok(token, 'resetlink gemaakt');
  assert.equal((await a('POST', '/api/auth/reset', { token, password: 'nieuwe zin voor bob' })).status, 200);
  assert.equal((await a('POST', '/api/auth/reset', { token, password: 'nog een keer proberen' })).json.error, 'token', 'link maar één keer');
  await a('POST', '/api/qr-codes', { typeId: 'pdf', content: { file: pdf('%PDF bob') } });
  const before = filesOnDisk();
  assert.equal((await a('DELETE', '/api/account', { password: 'fout' })).status, 403);
  assert.equal((await a('DELETE', '/api/account', { password: 'nieuwe zin voor bob' })).status, 204);
  assert.equal(filesOnDisk(), before - 1, 'bestanden van het account weg');
  assert.equal((await client()('POST', '/api/auth/login', { email: 'b@example.com', password: 'nieuwe zin voor bob' })).status, 401);
});

test('wifi-wachtwoord staat versleuteld in de database, maar de eigenaar ziet het gewoon', async () => {
  const a = client();
  await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'mijn geheime zin' });
  const made = await a('POST', '/api/qr-codes', { typeId: 'wifi', content: { ssid: 'Kantoor', password: 'supergeheim123', security: 'WPA' } });
  assert.equal(made.status, 201);
  const raw = await db.sql('get', 'SELECT content FROM qr_codes WHERE id = ?', [made.json.id]);
  assert.ok(!raw.content.includes('supergeheim123'), 'niet leesbaar in de database');
  assert.ok(raw.content.includes('enc:v1:'), 'versleuteld');
  assert.equal((await a('GET', '/api/qr-codes/' + made.json.id)).json.content.password, 'supergeheim123', 'eigenaar ziet het wachtwoord');
  const edited = await a('PUT', '/api/qr-codes/' + made.json.id, { content: { ssid: 'Kantoor', password: 'nieuwwachtwoord9', security: 'WPA' }, design: {} });
  assert.equal(edited.json.content.password, 'nieuwwachtwoord9');
  assert.ok(!(await db.sql('get', 'SELECT content FROM qr_codes WHERE id = ?', [made.json.id])).content.includes('nieuwwachtwoord9'));
});

