/* Automatische test van de server: npm test
   Start de app met een lege, tijdelijke database en loopt alles na wat klanten doen. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'optimasys-test-'));
process.env.ALLOW_SIGNUP = 'true';                                   // de meeste tests maken zelf accounts (de test 'licentie' zet het weer uit)
process.env.SUPPORT_EMAIL = 'team@example.com'; process.env.SUPPORT_PASSWORD = 'Team geheime zin 4!';
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
  // regels: hoofdletter, cijfer, speciaal teken
  assert.equal((await a('POST', '/api/auth/register', { email: 'regel1@example.com', password: 'alleen kleine letters 1!' })).json.error, 'password_upper');
  assert.equal((await a('POST', '/api/auth/register', { email: 'regel2@example.com', password: 'Geen cijfer hier!' })).json.error, 'password_digit');
  assert.equal((await a('POST', '/api/auth/register', { email: 'regel3@example.com', password: 'Geen teken 123' })).json.error, 'password_special');
  const reg = await a('POST', '/api/auth/register', { email: 'a@example.com', password: 'Mijn geheime zin 1!', name: 'Anna' });
  assert.equal(reg.status, 201); assert.equal(reg.json.verify, true);
  assert.equal((await a('GET', '/api/auth/me')).status, 401, 'na account maken nog NIET ingelogd');
  assert.ok(mails['a@example.com'], 'bevestigingsmail verstuurd');
  assert.equal((await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'Mijn geheime zin 1!' })).json.error, 'unverified', 'inloggen kan pas na bevestigen');
  assert.equal((await a('POST', '/api/auth/verify', { token: 'verzonnen' })).status, 400);
  const tok = tokenFor('a@example.com');
  assert.equal((await a('POST', '/api/auth/verify', { token: tok })).json.email, 'a@example.com');
  assert.equal((await a('POST', '/api/auth/verify', { token: tok })).status, 400, 'link werkt maar één keer');
  assert.equal((await a('GET', '/api/auth/me')).status, 401, 'bevestigen logt niet vanzelf in');
  const dup = await client()('POST', '/api/auth/register', { email: 'A@example.com', password: 'Nog een zin hier 6!' });
  assert.equal(dup.status, 201, 'bestaand adres: zelfde antwoord (niet te zien wie een account heeft)');
  assert.equal((await client()('POST', '/api/auth/login', { email: 'a@example.com', password: 'Nog een zin hier 6!' })).status, 401, 'wachtwoord niet overschreven');
  assert.equal((await client()('POST', '/api/auth/login', { email: 'a@example.com', password: 'fout fout fout' })).status, 401);
  assert.equal((await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'Mijn geheime zin 1!' })).status, 200);
  assert.equal((await a('GET', '/api/auth/me')).json.email, 'a@example.com');
  await a('POST', '/api/auth/logout', {});
  assert.equal((await a('GET', '/api/auth/me')).status, 401, 'uitgelogd');
  assert.equal((await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'Mijn geheime zin 1!' })).status, 200);
});

test('codes zijn per klant, bestanden op schijf, scannen en statistieken', async () => {
  const a = client(), b = client();
  await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'Mijn geheime zin 1!' });
  await signup(b, 'b@example.com', 'Bobs geheime zin 8!');
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
  await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'Mijn geheime zin 1!' });
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
  assert.equal((await a('POST', '/api/auth/reset', { token, password: 'Nieuwe zin voor bob 2!' })).status, 200);
  assert.equal((await a('POST', '/api/auth/reset', { token, password: 'Nog een keer 7!' })).json.error, 'token', 'link maar één keer');
  await a('POST', '/api/qr-codes', { typeId: 'pdf', content: { file: pdf('%PDF bob') } });
  const before = filesOnDisk();
  assert.equal((await a('DELETE', '/api/account', { password: 'fout' })).status, 403);
  assert.equal((await a('DELETE', '/api/account', { password: 'Nieuwe zin voor bob 2!' })).status, 204);
  assert.equal(filesOnDisk(), before - 1, 'bestanden van het account weg');
  assert.equal((await client()('POST', '/api/auth/login', { email: 'b@example.com', password: 'Nieuwe zin voor bob 2!' })).status, 401);
});

test('wifi-wachtwoord staat versleuteld in de database, maar de eigenaar ziet het gewoon', async () => {
  const a = client();
  await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'Mijn geheime zin 1!' });
  const made = await a('POST', '/api/qr-codes', { typeId: 'wifi', content: { ssid: 'Kantoor', password: 'supergeheim123', security: 'WPA' } });
  assert.equal(made.status, 201);
  const raw = await db.storedContent(made.json.id);
  assert.ok(!raw.includes('supergeheim123'), 'niet leesbaar in de database');
  assert.ok(raw.includes('enc:v1:'), 'versleuteld');
  assert.equal((await a('GET', '/api/qr-codes/' + made.json.id)).json.content.password, 'supergeheim123', 'eigenaar ziet het wachtwoord');
  const edited = await a('PUT', '/api/qr-codes/' + made.json.id, { content: { ssid: 'Kantoor', password: 'nieuwwachtwoord9', security: 'WPA' }, design: {} });
  assert.equal(edited.json.content.password, 'nieuwwachtwoord9');
  assert.ok(!(await db.storedContent(made.json.id)).includes('nieuwwachtwoord9'));
});


test('veel scans tegelijk: geen enkele scan gaat verloren', async () => {
  const a = client();
  await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'Mijn geheime zin 1!' });
  const made = await a('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://example.com/druk' } });
  const N = 50;
  const codes = await Promise.all(Array.from({ length: N }, (_, i) => fetch(base + '/q/' + made.json.id, { redirect: 'manual', headers: { 'user-agent': i % 2 ? 'Mozilla/5.0 (iPhone)' : 'Mozilla/5.0 (Linux; Android 14)' } }).then((r) => r.status)));
  assert.deepEqual([...new Set(codes)], [302]);
  assert.equal((await a('GET', '/api/qr-codes/' + made.json.id)).json.scans, N, 'teller op de code');
  const an = await a('GET', '/api/analytics?codes=' + made.json.id);
  assert.equal(an.json.totals.scans, N, 'statistieken');
});

// Eén ingelogde sessie voor A in de laatste tests (te vaak inloggen = even wachten, zoals bij echte gebruikers)
let sessionA = null;
async function asA() { if (!sessionA) { sessionA = client(); await sessionA('POST', '/api/auth/login', { email: 'a@example.com', password: 'Mijn geheime zin 1!' }); } return sessionA; }

test('factuurgegevens: controleren, opslaan, alleen van jezelf, in de export', async () => {
  const a = await asA();
  assert.equal((await a('GET', '/api/account/billing')).json.billing, null, 'nog niet ingevuld');
  const badRes = await a('PUT', '/api/account/billing', { type: 'company', taxId: '123', postalCode: '!', country: 'Nederland' });
  assert.equal(badRes.status, 400);
  for (const k of ['companyName', 'taxId', 'address', 'postalCode', 'city', 'country']) assert.ok(badRes.json.details.includes(k), 'fout bij ' + k);
  const ok = await a('PUT', '/api/account/billing', { type: 'company', companyName: 'Voorbeeld BV', taxId: 'nl 1234.56789 b01', firstName: 'Anna', lastName: 'Jansen', email: '', address: 'Dorpsstraat 1', postalCode: '1234 ab', city: 'Utrecht', country: 'nl', extra: 'weg' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.billing.taxId, 'NL123456789B01', 'netjes geschreven');
  assert.equal(ok.json.billing.postalCode, '1234 AB');
  assert.equal(ok.json.billing.country, 'NL');
  assert.equal(ok.json.billing.extra, undefined, 'onbekende velden niet bewaard');
  const priv = await a('PUT', '/api/account/billing', { type: 'private', companyName: 'blijft niet', taxId: 'NL1', firstName: '', lastName: 'Jansen', address: 'x', postalCode: '1234', city: 'y', country: 'NL' });
  assert.deepEqual(priv.json.details, ['firstName'], 'particulier: voornaam nodig, btw-nummer telt niet');
  assert.equal((await a('GET', '/api/account/billing')).json.billing.companyName, 'Voorbeeld BV', 'bewaard');
  assert.equal((await a('GET', '/api/account/export')).json.billing.city, 'Utrecht', 'in de export');
  assert.equal((await client()('GET', '/api/account/billing')).status, 401, 'alleen ingelogd');
});

test('contactformulier', async () => {
  const a = await asA(), logs = [], orig = console.log;
  assert.equal((await client()('POST', '/api/contact', { name: 'X', email: 'x@example.com', topic: 'question', message: 'Een vraag over iets' })).status, 401);
  const bad = await a('POST', '/api/contact', { name: '', email: 'geen-mail', topic: 'onzin', message: 'kort' });
  assert.equal(bad.status, 400); assert.deepEqual(bad.json.details, ['name', 'email', 'topic', 'message']);
  console.log = (...x) => { logs.push(x.join(' ')); };
  const r = await a('POST', '/api/contact', { name: 'Anna', email: 'anna@example.com', topic: 'idea', message: 'Graag ook een donkere QR-stijl.' });
  console.log = orig;
  assert.equal(r.status, 200);
  assert.ok(logs.join('\n').includes('Graag ook een donkere QR-stijl.'), 'zonder mailserver: in de serverlog');
});

test('licentie: zelf aanmelden staat uit, het team nodigt klanten uit', async () => {
  process.env.ALLOW_SIGNUP = '';
  try {
    assert.equal((await fetch(base + '/api/health').then((r) => r.json())).signup, false, 'app weet dat aanmelden dicht is');
    assert.equal((await client()('POST', '/api/auth/register', { email: 'zelf@example.com', password: 'Zelf geheime zin 5!' })).json.error, 'signup_closed');
    const team = client();
    const me = await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
    assert.equal(me.status, 200, 'team-account is bij het opstarten aangemaakt'); assert.equal(me.json.admin, true);
    const klant = await asA();
    assert.equal((await klant('GET', '/api/admin/customers')).status, 403, 'gewone klant ziet de lijst niet');
    assert.equal((await client()('GET', '/api/admin/customers')).status, 401);
    // klant toevoegen
    assert.deepEqual((await team('POST', '/api/admin/customers', { name: '', email: 'fout' })).json.details, ['name', 'email']);
    const add = await team('POST', '/api/admin/customers', { name: 'Bakkerij De Korf', email: 'Info@Korf.example', lang: 'nl' });
    assert.equal(add.status, 201); assert.ok(add.json.link.includes('?invite='), 'zonder mailserver: link voor het team');
    assert.equal(add.json.customer.active, false); assert.ok(add.json.customer.inviteUntil > new Date(Date.now() + 6 * 864e5).toISOString(), '7 dagen geldig');
    assert.equal((await team('POST', '/api/admin/customers', { name: 'Dubbel', email: 'info@korf.example' })).status, 409, 'zelfde e-mail kan niet twee keer');
    assert.equal((await client()('POST', '/api/auth/login', { email: 'info@korf.example', password: 'invited' })).status, 401, 'zonder gekozen wachtwoord kan niemand inloggen');
    // opnieuw uitnodigen: oude link werkt niet meer
    const oldToken = decodeURIComponent(add.json.link.split('invite=')[1]);
    const again = await team('POST', '/api/admin/customers/' + add.json.customer.id + '/invite', {});
    const token = decodeURIComponent(again.json.link.split('invite=')[1]);
    const k = client();
    assert.equal((await k('POST', '/api/auth/reset', { token: oldToken, password: 'Korf geheime zin 3!' })).status, 400, 'oude link ongeldig');
    const accepted = await k('POST', '/api/auth/reset', { token, password: 'Korf geheime zin 3!' });
    assert.equal(accepted.status, 200, 'wachtwoord gekozen'); assert.equal(accepted.json.email, 'info@korf.example');
    assert.equal((await k('GET', '/api/auth/me')).status, 200, 'meteen ingelogd');
    const row = (await team('GET', '/api/admin/customers')).json.find((c) => c.email === 'info@korf.example');
    assert.equal(row.active, true); assert.equal(row.inviteUntil, null);
    assert.equal((await team('POST', '/api/admin/customers/' + row.id + '/invite', {})).status, 409, 'actief: niet opnieuw uitnodigen');
    // verwijderen
    const teamRow = (await team('GET', '/api/admin/customers')).json.find((c) => c.team);
    assert.equal((await team('DELETE', '/api/admin/customers/' + teamRow.id)).status, 403, 'team-account niet verwijderen');
    assert.equal((await team('DELETE', '/api/admin/customers/' + row.id)).status, 204);
    assert.equal((await k('GET', '/api/auth/me')).status, 401, 'verwijderde klant is uitgelogd');
  } finally { process.env.ALLOW_SIGNUP = 'true'; }
});
