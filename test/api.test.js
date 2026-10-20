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
async function markPaid(email) {
  const { DatabaseService } = require('../server/dist/database/database.service'), { saveSub } = require('../server/dist/subscription');
  const db = app.get(DatabaseService), u = await db.userByEmail(email); await saveSub(db, u.id, null);
}
// Zelf registreren = eerst betalen. In de tests is een klant standaard al betaald (unpaid: true = net geregistreerd, nog niet betaald).
async function signup(c, email, password, name, opts = {}) {
  await c('POST', '/api/auth/register', { accept: true, email, password, name });
  await c('POST', '/api/auth/verify', { token: tokenFor(email) });
  if (!opts.unpaid) await markPaid(email);
  return c('POST', '/api/auth/login', { email, password });
}
const pdf = (s) => JSON.stringify({ n: 'test.pdf', s: s.length, d: 'data:application/pdf;base64,' + Buffer.from(s).toString('base64') });
const filesOnDisk = () => fs.readdirSync(path.join(process.env.DATA_DIR, 'files')).length;

test('inloggen en accounts (met e-mailbevestiging)', async () => {
  const a = client();
  assert.equal((await a('GET', '/api/qr-codes')).status, 401, 'zonder inloggen geen codes');
  assert.equal((await a('POST', '/api/auth/register', { accept: true, email: 'a@example.com', password: 'kort' })).json.error, 'password_short');
  // regels: hoofdletter, cijfer, speciaal teken
  assert.equal((await a('POST', '/api/auth/register', { accept: true, email: 'regel1@example.com', password: 'alleen kleine letters 1!' })).json.error, 'password_upper');
  assert.equal((await a('POST', '/api/auth/register', { accept: true, email: 'regel2@example.com', password: 'Geen cijfer hier!' })).json.error, 'password_digit');
  assert.equal((await a('POST', '/api/auth/register', { accept: true, email: 'regel3@example.com', password: 'Geen teken 123' })).json.error, 'password_special');
  const reg = await a('POST', '/api/auth/register', { accept: true, email: 'a@example.com', password: 'Mijn geheime zin 1!', name: 'Anna' });
  assert.equal(reg.status, 201); assert.equal(reg.json.verify, true);
  assert.equal((await a('GET', '/api/auth/me')).status, 401, 'na account maken nog NIET ingelogd');
  assert.ok(mails['a@example.com'], 'bevestigingsmail verstuurd');
  assert.equal((await a('POST', '/api/auth/login', { email: 'a@example.com', password: 'Mijn geheime zin 1!' })).json.error, 'unverified', 'inloggen kan pas na bevestigen');
  assert.equal((await a('POST', '/api/auth/verify', { token: 'verzonnen' })).status, 400);
  const tok = tokenFor('a@example.com');
  assert.equal((await a('POST', '/api/auth/verify', { token: tok })).json.email, 'a@example.com');
  assert.equal((await a('POST', '/api/auth/verify', { token: tok })).status, 400, 'link werkt maar één keer');
  await markPaid('a@example.com');
  assert.equal((await a('GET', '/api/auth/me')).status, 401, 'bevestigen logt niet vanzelf in');
  const dup = await client()('POST', '/api/auth/register', { accept: true, email: 'A@example.com', password: 'Nog een zin hier 6!' });
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
  assert.equal((await fetch(base + '/q/' + id)).status, 410, 'verwijderd: 410 (komt nooit meer terug)');
  assert.equal((await fetch(base + '/q/nooitgebruikt')).status, 404);
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
    assert.equal((await client()('POST', '/api/auth/register', { accept: true, email: 'zelf@example.com', password: 'Zelf geheime zin 5!' })).json.error, 'signup_closed');
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

test('beheer: dashboard, alle QR-codes, rollen en uitzetten', async () => {
  const team = client();
  await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  assert.equal((await team('GET', '/api/auth/me')).json.superAdmin, true, 'support-account is super-admin');
  const b = client(); await signup(b, 'beheer-b@example.com', 'Beheer geheime zin 6!', 'Klant B');
  const code = await b('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://klant-b.example' }, design: {} });
  assert.equal(code.status, 201);
  assert.equal((await b('GET', '/api/admin/overview')).status, 403, 'klant ziet het beheer niet');
  const ov = await team('GET', '/api/admin/overview');
  assert.equal(ov.status, 200); assert.equal(ov.json.days.length, 30, '30 dagen in de grafiek'); assert.ok(ov.json.totals.codes >= 1);
  const list = await team('GET', '/api/admin/codes?q=klant-b');
  assert.equal(list.json.total, 1); assert.equal(list.json.items[0].owner.email, 'beheer-b@example.com');
  assert.equal((await team('PATCH', '/api/admin/codes/' + code.json.id, { paused: true })).json.paused, true, 'team pauzeert de code');
  assert.equal((await fetch(base + '/q/' + code.json.id, { redirect: 'manual' })).status, 503, 'gepauzeerde code werkt even niet');
  assert.equal((await team('GET', '/api/admin/codes?status=paused&q=klant-b')).json.total, 1);
  // rollen: alleen de super-admin; admin kan geen rollen wijzigen
  const rows = (await team('GET', '/api/admin/customers')).json, rb = rows.find((c) => c.email === 'beheer-b@example.com');
  assert.equal(rb.level, 'user');
  assert.equal((await team('PATCH', '/api/admin/customers/' + rb.id, { role: 'admin' })).json.level, 'admin');
  assert.equal((await b('GET', '/api/admin/overview')).status, 200, 'nu admin: ziet het beheer');
  const sup = rows.find((c) => c.level === 'super');
  assert.equal((await b('PATCH', '/api/admin/customers/' + sup.id, { disabled: true })).status, 403, 'super-admin is niet uit te zetten');
  assert.equal((await b('PATCH', '/api/admin/customers/' + rb.id, { role: 'user' })).status, 403, 'niet jezelf');
  assert.equal((await team('PATCH', '/api/admin/customers/' + rb.id, { role: 'user' })).json.level, 'user');
  // uitzetten: meteen uitgelogd, kan niet inloggen, code blijft van de klant
  assert.equal((await team('PATCH', '/api/admin/customers/' + rb.id, { disabled: true })).json.disabledAt != null, true);
  assert.equal((await b('GET', '/api/auth/me')).status, 401, 'uitgezet = uitgelogd');
  assert.equal((await client()('POST', '/api/auth/login', { email: 'beheer-b@example.com', password: 'Beheer geheime zin 6!' })).json.error, 'disabled');
  await team('PATCH', '/api/admin/customers/' + rb.id, { disabled: false });
  assert.equal((await client()('POST', '/api/auth/login', { email: 'beheer-b@example.com', password: 'Beheer geheime zin 6!' })).status, 200, 'weer aangezet');
  assert.equal((await team('DELETE', '/api/admin/codes/' + code.json.id)).status, 204);
  assert.equal((await team('GET', '/api/admin/codes?q=klant-b')).json.total, 0);
  const page = await fetch(base + '/admin', { redirect: 'manual' }); assert.equal(page.status, 302, 'alles op één adres: /admin gaat naar /');
});

test('beheer > alle QR-codes: rechten, pauzeren met reden, markeren, bewerken, bulk, export, logboek', async () => {
  const team = client();
  await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  const k = client(); await signup(k, 'mod-k@example.com', 'Moderatie zin 8!', 'Klant K');
  const a = client(); await signup(a, 'mod-a@example.com', 'Moderatie zin 9!', 'Admin A');
  const ka = (await team('GET', '/api/admin/customers')).json;
  await team('PATCH', '/api/admin/customers/' + ka.find((c) => c.email === 'mod-a@example.com').id, { role: 'admin' });
  const mk = (b) => k('POST', '/api/qr-codes', Object.assign({ design: {} }, b));
  const site = (await mk({ typeId: 'website', name: 'Site', content: { url: 'https://mod-k.example' } })).json;
  const fish = (await mk({ typeId: 'website', name: 'Actie', content: { url: 'https://paypal.com.login-secure.xyz/verify' } })).json;
  const wifi = (await mk({ typeId: 'wifi', name: 'Wifi', content: { ssid: 'Net', password: 'geheim123' } })).json;
  const own = (await team('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://team.example' }, design: {} })).json;

  // Filters en controle
  const l = (q) => team('GET', '/api/admin/codes?' + q).then((r) => r.json);
  assert.equal((await l('q=mod-k@example.com')).total, 3, 'zoeken op e-mail van de klant');
  assert.equal((await l('q=mod-k@example.com&kind=static')).total, 1, 'filter vast');
  const risky = await l('q=mod-k@example.com&check=risky');
  assert.equal(risky.total, 1); assert.ok(risky.items[0].risks.includes('brand'), 'merknaam op ander domein');
  assert.equal((await l('q=mod-k@example.com&size=10')).pageSize, 10);
  assert.equal((await l('q=mod-k@example.com&scans=none&kind=dynamic')).total, 2, 'filters combineren');

  // Pauzeren met reden: klant kan niet zelf weer aanzetten, ziet wel de reden
  const p = await team('PATCH', '/api/admin/codes/' + site.id, { paused: true, reason: 'Misbruik', lock: true });
  assert.equal(p.json.moderation.hold.reason, 'Misbruik');
  assert.equal((await fetch(base + '/q/' + site.id, { redirect: 'manual' })).status, 503, 'gepauzeerd = werkt niet');
  assert.equal((await k('PATCH', '/api/qr-codes/' + site.id, { paused: false })).json.error, 'admin_hold');
  const seen = (await k('GET', '/api/qr-codes/' + site.id)).json;
  assert.equal(seen.hold.reason, 'Misbruik'); assert.equal(seen.moderation, undefined, 'markering/beheer-info blijft intern');
  await team('PATCH', '/api/admin/codes/' + site.id, { paused: true, reason: 'Op verzoek', lock: false });
  assert.equal((await k('PATCH', '/api/qr-codes/' + site.id, { paused: false })).json.paused, false, 'zonder slot mag de klant hem zelf aanzetten');

  // Markeren, bewerken (geen vaste codes), dupliceren in het account van de klant
  assert.equal((await team('PATCH', '/api/admin/codes/' + fish.id, { flag: true, reason: 'Phishing' })).json.moderation.flag.reason, 'Phishing');
  assert.equal((await team('PATCH', '/api/admin/codes/' + site.id, { content: { url: 'geen-link' } })).status, 400);
  assert.equal((await team('PATCH', '/api/admin/codes/' + site.id, { name: 'Nieuw', content: { url: 'https://nieuw.example' } })).json.dest.value, 'https://nieuw.example');
  assert.equal((await team('PATCH', '/api/admin/codes/' + wifi.id, { content: { ssid: 'x' } })).status, 400, 'vaste code niet aanpassen');
  const dup = (await team('POST', '/api/admin/codes/' + site.id + '/duplicate')).json;
  assert.ok((await k('GET', '/api/qr-codes')).json.some((c) => c.id === dup.id), 'kopie staat bij de klant');
  assert.equal((await team('GET', '/api/admin/codes/' + wifi.id)).json.content.password, 'geheim123', 'super-admin kan de echte wifi-code downloaden');

  // Rechten: een gewone admin mag klantcodes aanpassen, maar niet die van de super-admin
  assert.equal((await a('PATCH', '/api/admin/codes/' + own.id, { paused: true })).status, 403);
  assert.equal((await a('DELETE', '/api/admin/codes/' + own.id)).status, 403);
  assert.equal((await a('GET', '/api/admin/codes/' + own.id)).json.canEdit, false);
  assert.equal((await a('PATCH', '/api/admin/codes/' + fish.id, { paused: true })).status, 200);
  const bulkA = (await a('POST', '/api/admin/codes/bulk', { ids: [own.id, fish.id], action: 'resume' })).json;
  assert.equal(bulkA.forbidden, 1); assert.equal(bulkA.done, 1);

  // Export (CSV, ook met formule-beveiliging) en logboek
  const csv = await team('POST', '/api/admin/codes/export', { filters: { q: 'mod-k@example.com' } });
  assert.match(csv.headers.get('content-type'), /text\/csv/); assert.equal(csv.text.trim().split('\r\n').length, 5, 'kop + 4 codes');
  const log = (await team('GET', '/api/admin/codes/' + site.id)).json.log.map((x) => x.action);
  for (const x of ['pause', 'edit', 'duplicate']) assert.ok(log.includes(x), 'logboek: ' + x);

  // Verwijderen: link komt nooit meer terug
  assert.equal((await team('POST', '/api/admin/codes/bulk', { ids: [dup.id], action: 'delete' })).json.done, 1);
  assert.equal((await fetch(base + '/q/' + dup.id, { redirect: 'manual' })).status, 410, 'verwijderd = weg');
  assert.notEqual((await k('POST', '/api/qr-codes', { id: dup.id, typeId: 'website', content: { url: 'https://x.example' }, design: {} })).json.id, dup.id, 'oud id wordt niet opnieuw uitgegeven');
});

test('eigen achtergronden: foto/video uploaden, kiezen, alleen voor jezelf, verwijderen', async () => {
  const u = client(); await signup(u, 'media-u@example.com', 'Media geheime zin 1!', 'Media U');
  const o = client(); await signup(o, 'media-o@example.com', 'Media geheime zin 2!', 'Media O');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const cookieOf = async (email, password) => (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).headers.get('set-cookie').split(';')[0];
  const ck = await cookieOf('media-u@example.com', 'Media geheime zin 1!');
  const up = (body, type) => fetch(base + '/api/account/media?name=zee', { method: 'POST', headers: { cookie: ck, 'Content-Type': type }, body });
  assert.equal((await up(Buffer.from('geen foto'), 'image/png')).status, 415, 'inhoud moet echt een foto zijn');
  assert.equal((await up(Buffer.from('x'), 'text/plain')).status, 415);
  const a = await (await up(png, 'image/png')).json(), b = await (await up(png, 'image/png')).json();
  assert.notEqual(a.id, b.id, 'tweede upload overschrijft de eerste niet');
  const me = (await u('GET', '/api/me')).json;
  assert.equal(me.media.length, 2); assert.equal(me.background, 'optimasys', 'uploaden zet hem niet meteen aan');
  assert.equal((await u('PATCH', '/api/me', { background: 'media:' + a.id })).json.background, 'media:' + a.id);
  assert.equal((await o('PATCH', '/api/me', { background: 'media:' + a.id })).status, 400, 'andermans foto kiezen kan niet');
  assert.equal((await o('GET', '/api/account/media/' + a.id)).status, 404, 'andermans foto bekijken kan niet');
  assert.equal((await u('GET', '/api/account/media/' + a.id)).status, 200);
  assert.equal((await u('PATCH', '/api/me', { background: 'tide' })).json.background, 'tide', 'bewegende achtergrond');
  const hid = (await u('PATCH', '/api/me', { hiddenBackgrounds: ['tide', 'aurora'] })).json;
  assert.deepEqual(hid.hiddenBackgrounds, ['tide', 'aurora']); assert.equal(hid.background, 'optimasys', 'verborgen terwijl hij aan stond: terug naar Optimasys');
  assert.equal((await u('PATCH', '/api/me', { hiddenBackgrounds: ['optimasys'] })).status, 400, 'Optimasys kan niet weg');
  assert.deepEqual((await u('PATCH', '/api/me', { hiddenBackgrounds: [] })).json.hiddenBackgrounds, []);
  await u('PATCH', '/api/me', { background: 'media:' + a.id });
  assert.equal((await u('DELETE', '/api/account/media/' + a.id)).status, 204);
  const after = (await u('GET', '/api/me')).json;
  assert.equal(after.background, 'optimasys', 'actieve achtergrond weg: terug naar de standaard'); assert.equal(after.media.length, 1);
});

test('abonnementen: team kent pakket toe, limiet geldt op de server, klant ziet het', async () => {
  const team = client();
  await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  const k = client(); await signup(k, 'plan-k@example.com', 'Pakket zin 12!', 'Klant Plan');
  const id = (await team('GET', '/api/admin/customers')).json.find((c) => c.email === 'plan-k@example.com').id;
  let p = (await k('GET', '/api/account/plan')).json;
  assert.equal(p.plan.id, 'free'); assert.equal(p.payments, false); assert.equal(p.plans.length, 3);
  assert.equal((await team('PATCH', '/api/admin/customers/' + id, { plan: 'nope' })).status, 400);
  assert.equal((await k('PATCH', '/api/admin/customers/' + id, { plan: 'business' })).status, 403, 'klant kan zichzelf geen pakket geven');
  const r = await team('PATCH', '/api/admin/customers/' + id, { plan: 'standard' });
  assert.equal(r.status, 200); assert.equal(r.json.plan, 'standard');
  const mk = () => k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://plan.example' }, design: {} });
  let last; for (let i = 0; i < 5; i++) { last = await mk(); assert.equal(last.status, 201); }
  const over = await mk(); assert.equal(over.status, 403); assert.equal(over.json.error, 'plan_limit');
  assert.equal((await k('POST', '/api/qr-codes/' + last.json.id + '/duplicate', {})).status, 403, 'kopie telt ook mee');
  p = (await k('GET', '/api/account/plan')).json; assert.equal(p.usage.state, 'full'); assert.equal(p.usage.limit, 5);
  const an = (await k('GET', '/api/analytics?from=2000-01-01')).json; assert.ok(an.statsFloor, 'geschiedenis beperkt');
  assert.ok((await team('GET', '/api/admin/log')).json.some((x) => x.action === 'user_plan'), 'wijziging in logboek');
  await team('PATCH', '/api/admin/customers/' + id, { plan: 'free' });
  assert.equal((await mk()).status, 201, 'terug naar testfase = geen limiet');
});

test('statistieken: browser en soort apparaat worden geteld (zonder details te bewaren)', async () => {
  const k = client(); await signup(k, 'dev-k@example.com', 'Apparaat zin 13!', 'Klant Dev');
  const id = (await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://dev.example' }, design: {} })).json.id;
  const UA = {
    iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0',
    insta: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0',
  };
  for (const ua of Object.values(UA)) await fetch(base + '/q/' + id, { redirect: 'manual', headers: { 'user-agent': ua } });
  const an = (await k('GET', '/api/analytics?codes=' + id)).json;
  const m = (rows) => Object.fromEntries(rows.map((r) => [r.k, r.s]));
  assert.deepEqual(m(an.devices), { mobile: 3, tablet: 1, desktop: 1 });
  assert.deepEqual(m(an.browsers), { Safari: 2, Chrome: 1, Edge: 1, 'In-app': 1 });
  assert.equal((await k('GET', '/api/analytics?codes=' + id + '&dev=mobile')).json.totals.scans, 3, 'filter op apparaat');
  assert.equal((await k('GET', '/api/analytics?codes=' + id + '&br=Edge&dev=desktop')).json.totals.scans, 1, 'filters combineren');
  const csv = await k('GET', '/api/analytics.csv?codes=' + id);
  assert.match(csv.text.split('\r\n')[0], /browser,device/, 'export heeft browser en apparaat');
});

test('beheer: reden bij uitzetten, uitnodiging intrekken, pakketten op het dashboard', async () => {
  const team = client();
  await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  const k = client(); await signup(k, 'why-k@example.com', 'Reden zin 14!', 'Klant Why');
  const id = (await team('GET', '/api/admin/customers')).json.find((c) => c.email === 'why-k@example.com').id;
  const off = await team('PATCH', '/api/admin/customers/' + id, { disabled: true, reason: 'Betaling uitgebleven' });
  assert.equal(off.status, 200); assert.equal(off.json.disabledReason, 'Betaling uitgebleven');
  assert.equal((await team('GET', '/api/admin/customers')).json.find((c) => c.id === id).disabledReason, 'Betaling uitgebleven');
  assert.ok((await team('GET', '/api/admin/log')).json.some((x) => x.action === 'user_disable' && /Betaling uitgebleven/.test(x.detail)));
  await team('PATCH', '/api/admin/customers/' + id, { disabled: false });
  assert.equal((await team('GET', '/api/admin/customers')).json.find((c) => c.id === id).disabledReason, null, 'aanzetten: reden weg');
  const inv = await team('POST', '/api/admin/customers', { name: 'Uitgenodigd', email: 'rev-x@example.com' });
  assert.equal(inv.status, 201);
  assert.equal((await team('DELETE', '/api/admin/customers/' + inv.json.customer.id)).status, 204, 'intrekken');
  const token = decodeURIComponent(inv.json.link.split('invite=')[1]);
  assert.equal((await client()('POST', '/api/auth/reset', { token, password: 'Nieuwe zin 15!x' })).status, 400, 'ingetrokken link werkt niet meer');
  const ov = (await team('GET', '/api/admin/overview')).json; assert.ok(ov.plans && ov.plans.free >= 1, 'telling per pakket');
});

test('tweestapsverificatie: aanzetten met de app, inloggen met code of herstelcode, uitzetten met wachtwoord', async () => {
  const { codeAt } = require('../server/dist/auth/totp');
  const now = () => codeAt(secret, Math.floor(Date.now() / 30000));
  const u = client(); await signup(u, 'tfa-u@example.com', 'Twee stappen 16!', 'Klant 2FA');
  assert.equal((await u('GET', '/api/account/2fa')).json.enabled, false);
  const setup = (await u('POST', '/api/account/2fa/setup', {})).json; var secret = setup.secret;
  assert.match(setup.otpauth, /^otpauth:\/\/totp\//);
  assert.equal((await u('POST', '/api/account/2fa/enable', { code: '000000' })).status, 400, 'verkeerde code');
  const on = await u('POST', '/api/account/2fa/enable', { code: now() });
  assert.equal(on.status, 200); assert.equal(on.json.recoveryCodes.length, 10);
  const login = (body) => client()('POST', '/api/auth/login', Object.assign({ email: 'tfa-u@example.com', password: 'Twee stappen 16!' }, body));
  assert.equal((await login({})).json.error, '2fa_required', 'zonder code geen toegang');
  assert.equal((await login({ code: '123456' })).json.error, '2fa_wrong');
  assert.equal((await login({ code: now() })).status, 200, 'met de code uit de app');
  const rc = on.json.recoveryCodes[0];
  assert.equal((await login({ code: rc })).status, 200, 'herstelcode werkt');
  assert.equal((await login({ code: rc })).status, 401, 'herstelcode werkt maar één keer');
  assert.equal((await u('GET', '/api/account/2fa')).json.recoveryLeft, 9);
  assert.equal((await u('POST', '/api/account/2fa/disable', { password: 'fout' })).status, 403);
  assert.equal((await u('POST', '/api/account/2fa/disable', { password: 'Twee stappen 16!' })).status, 200);
  assert.equal((await login({})).status, 200, 'uit: weer alleen wachtwoord');
});

test('instellingen: bedrijfsgegevens in de privacytekst, onderhoudsmodus blokkeert alleen wijzigingen van klanten', async () => {
  const team = client();
  await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  const k = client(); await signup(k, 'mnt-k@example.com', 'Onderhoud zin 17!', 'Klant M');
  assert.equal((await k('GET', '/api/admin/settings')).status, 403, 'alleen het team');
  assert.equal((await team('PATCH', '/api/admin/settings', { company: { email: 'geen-mail' } })).status, 400);
  await team('PATCH', '/api/admin/settings', { company: { name: 'Optimasys Testbedrijf', kvk: '12345678' } });
  const h = (await k('GET', '/api/health')).json; assert.equal(h.legal.name, 'Optimasys Testbedrijf'); assert.equal(h.legal.kvk, '12345678');
  const made = await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://m.example' }, design: {} });
  await team('PATCH', '/api/admin/settings', { maintenance: { on: true, message: 'Even geduld' } });
  const blocked = await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://m2.example' }, design: {} });
  assert.equal(blocked.status, 503); assert.equal(blocked.json.error, 'maintenance'); assert.equal(blocked.json.message, 'Even geduld');
  assert.equal((await k('GET', '/api/qr-codes')).status, 200, 'bekijken kan nog');
  assert.equal((await fetch(base + '/q/' + made.json.id, { redirect: 'manual' })).status, 302, 'scannen werkt gewoon');
  assert.equal((await team('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://t.example' }, design: {} })).status, 201, 'team kan wel');
  assert.equal((await k('GET', '/api/health')).json.maintenance.on, true);
  await team('PATCH', '/api/admin/settings', { maintenance: { on: false }, company: {} });
  assert.equal((await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://m3.example' }, design: {} })).status, 201, 'weer uit');
});

test('abonnement verlopen: codes werken niet, niets wijzigen, betalen zet alles terug, na 30 dagen weg', async () => {
  const { HousekeepingService } = require('../server/dist/housekeeping.service');
  const lapse = []; app.get(MailerService).sendLapse = async (u, kind) => { lapse.push(kind); };
  const team = client(); await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  const k = client(); await signup(k, 'sub-k@example.com', 'Abonnement zin 12!', 'Klant Sub');
  const id = (await team('GET', '/api/admin/customers')).json.find((c) => c.email === 'sub-k@example.com').id;
  const code = (await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://sub.example' }, design: {} })).json;
  const scan = () => fetch(base + '/q/' + code.id, { redirect: 'manual' });
  assert.equal((await k('POST', '/api/admin/customers/' + id + '/subscription', { action: 'paid' })).status, 403, 'klant kan zichzelf niet op betaald zetten');
  let r = await team('POST', '/api/admin/customers/' + id + '/subscription', { action: 'paid', interval: 'month' });
  assert.equal(r.status, 200); assert.equal(r.json.state, 'active');
  assert.equal((await scan()).status, 302, 'betaald: code werkt');
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  r = await team('POST', '/api/admin/customers/' + id + '/subscription', { action: 'set', periodEnd: yesterday });
  assert.equal(r.json.state, 'grace');
  const s1 = await scan(); assert.equal(s1.status, 503, 'niet betaald: code werkt niet'); assert.match(await s1.text(), /not active|niet actief/i);
  assert.equal((await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://x.example' }, design: {} })).json.error, 'subscription_lapsed');
  assert.equal((await k('GET', '/api/analytics')).status, 402, 'geen statistieken');
  assert.equal((await k('GET', '/api/qr-codes')).status, 200, 'lijst bekijken mag');
  const plan = (await k('GET', '/api/account/plan')).json; assert.equal(plan.sub.state, 'grace'); assert.ok(plan.sub.graceUntil);
  const hk = app.get(HousekeepingService);
  await hk.subscriptions(); assert.deepEqual(lapse, ['start'], 'mail bij het begin');
  await team('POST', '/api/admin/customers/' + id + '/subscription', { action: 'paid' });
  assert.equal((await scan()).status, 302, 'betaald in de bedenktijd: werkt weer');
  await team('POST', '/api/admin/customers/' + id + '/subscription', { action: 'set', periodEnd: yesterday });
  await hk.subscriptions(Date.now() + 20 * 864e5);
  assert.ok((await k('GET', '/api/qr-codes')).json.length > 0, 'na 200 dagen nog bewaard');
  await hk.subscriptions(Date.now() + 31 * 864e5);
  assert.equal((await k('GET', '/api/qr-codes')).json.length, 0, 'na 30 dagen verwijderd');
  assert.ok(lapse.includes('deleted'));
  assert.equal((await scan()).status, 410, 'code bestaat niet meer');
});

test('overgezette code: einddatum oude QR-app, herinnering 60 en 14 dagen ervoor en op de dag zelf', async () => {
  const { HousekeepingService } = require('../server/dist/housekeeping.service');
  const sent = []; app.get(MailerService).sendLegacyDue = async (u, name, url, until, over) => { sent.push(over ? 'over' : 'soon'); };
  const c = client(); await signup(c, 'legacy-k@example.com', 'Oude app zin 12!', 'Klant Oud');
  const own = (await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://dest.example' }, design: {} })).json;
  assert.equal((await c('PATCH', '/api/qr-codes/' + own.id, { legacyUrl: 'https://scan.page/abc' })).status, 403, 'overzetten: alleen het team');
  const k = client(); await k('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  const code = (await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://dest.example' }, design: {}, name: 'Flyer' })).json;
  assert.equal((await k('PATCH', '/api/qr-codes/' + code.id, { legacyUntil: 'morgen' })).status, 400, 'geen geldige datum');
  const until = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  let r = await k('PATCH', '/api/qr-codes/' + code.id, { legacyUrl: 'https://scan.page/abc', legacyUntil: until });
  assert.equal(r.status, 200); assert.equal(r.json.legacyUntil, until);
  assert.equal((await k('GET', '/api/qr-codes')).json.find((c) => c.id === code.id).legacyUntil, until, 'ook in de lijst');
  const hk = app.get(HousekeepingService), day = 864e5;
  await hk.legacyReminders(); assert.deepEqual(sent, [], 'nog ruim op tijd: niets');
  await hk.legacyReminders(Date.now() + 31 * day); assert.deepEqual(sent, ['soon'], '60 dagen ervoor');
  await hk.legacyReminders(Date.now() + 32 * day); assert.deepEqual(sent, ['soon'], 'niet elke dag opnieuw');
  await hk.legacyReminders(Date.now() + 80 * day); assert.deepEqual(sent, ['soon', 'soon'], '14 dagen ervoor');
  await hk.legacyReminders(Date.now() + 91 * day); assert.deepEqual(sent, ['soon', 'soon', 'over'], 'op de dag zelf');
  await hk.legacyReminders(Date.now() + 95 * day); assert.equal(sent.length, 3, 'daarna niets meer');
  r = await k('PATCH', '/api/qr-codes/' + code.id, { legacyUrl: null });
  assert.equal(r.json.legacyUrl, undefined); assert.equal(r.json.legacyUntil, undefined, 'ontkoppeld: datum weg');
});

test('WhatsApp / SMS: bij SMS opent het berichtenprogramma met nummer en tekst', async () => {
  const k = client(); await signup(k, 'sms-k@example.com', 'Sms code zin 12!', 'Klant Sms');
  const r = await k('POST', '/api/qr-codes', { typeId: 'whatsapp', content: { channel: 'sms', phone: '+31 6 1234 5678', message: 'Hallo daar' }, design: {} });
  assert.equal(r.status, 201);
  const s = await fetch(base + '/q/' + r.json.id, { redirect: 'manual' });
  assert.equal(s.status, 302); assert.equal(s.headers.get('location'), 'sms:+31612345678?&body=Hallo%20daar');
  assert.equal((await k('POST', '/api/qr-codes', { typeId: 'whatsapp', content: { channel: 'sms', message: 'zonder nummer' }, design: {} })).status, 400, 'nummer verplicht');
  const w = (await k('POST', '/api/qr-codes', { typeId: 'whatsapp', content: { phone: '+31 6 1234 5678' }, design: {} })).json;
  assert.match((await fetch(base + '/q/' + w.id, { redirect: 'manual' })).headers.get('location'), /^https:\/\/wa\.me\/31612345678/, 'zonder keuze: WhatsApp');
});

test('startdatum en maximum aantal scans (KB Q224)', async () => {
  const k = client(); await signup(k, 'start-k@example.com', 'Start datum zin 12!', 'Klant Start');
  const later = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  const a = (await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://later.example', starts: later }, design: {} })).json;
  const s = await fetch(base + '/q/' + a.id, { redirect: 'manual' });
  assert.equal(s.status, 503, 'nog niet begonnen'); assert.match(await s.text(), /active yet|nog niet actief/i);
  const b = (await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://max.example', maxScans: '1' }, design: {} })).json;
  assert.equal((await fetch(base + '/q/' + b.id, { redirect: 'manual' })).status, 302, 'eerste scan werkt');
  assert.equal((await fetch(base + '/q/' + b.id, { redirect: 'manual' })).status, 410, 'daarna verlopen');
  assert.equal((await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://x.example', maxScans: '0' }, design: {} })).status, 400, 'minimaal 1');
});

test('zelf registreren: account bestaat, maar codes maken kan pas na betalen', async () => {
  const k = client(); await signup(k, 'nieuw-k@example.com', 'Nieuwe klant zin 12!', 'Nieuw', { unpaid: true });
  assert.equal((await k('GET', '/api/account/plan')).json.sub.state, 'unpaid');
  assert.equal((await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://a.example' }, design: {} })).json.error, 'subscription_lapsed', 'nog geen code maken');
  const team = client(); await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  const c = (await team('GET', '/api/admin/customers')).json.find((x) => x.email === 'nieuw-k@example.com');
  assert.equal(c.sub.state, 'unpaid', 'team ziet: nog niet betaald');
  await team('POST', '/api/admin/customers/' + c.id + '/subscription', { action: 'paid', interval: 'month' });
  assert.equal((await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://a.example' }, design: {} })).status, 201, 'na betalen wel');
});

test('aanmelden: wegwerp-adressen en varianten van hetzelfde adres worden geweigerd', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/auth/register', { accept: true, email: 'iemand@mailinator.com', password: 'Proef periode zin 12!' })).json.error, 'email_disposable');
  assert.equal((await c('POST', '/api/auth/register', { accept: true, email: 'x@abc.yopmail.com', password: 'Proef periode zin 12!' })).json.error, 'email_disposable', 'ook subdomeinen');
  await signup(client(), 'jan.devries@gmail.com', 'Proef periode zin 12!', 'Jan');
  assert.equal((await c('POST', '/api/auth/register', { accept: true, email: 'jandevries+2@gmail.com', password: 'Proef periode zin 12!' })).json.error, 'email_alias');
  assert.equal((await c('POST', '/api/auth/register', { accept: true, email: 'jan.de.vries@googlemail.com', password: 'Proef periode zin 12!' })).json.error, 'email_alias');
  assert.equal((await c('POST', '/api/auth/register', { accept: true, email: 'jan.devries@outlook.com', password: 'Proef periode zin 12!' })).status, 201, 'ander domein: gewoon toegestaan');
});

test('team (Pro en Business): uitnodigen, samen codes beheren, kijker kan niets wijzigen, verwijderen', async () => {
  const team = client(); await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  const o = client(); await signup(o, 'baas@bedrijf.example', 'Baas bedrijf zin 12!', 'Baas');
  const oid = (await team('GET', '/api/admin/customers')).json.find((c) => c.email === 'baas@bedrijf.example').id;
  // Standard: geen team; Pro: 3 mensen (eigenaar + 2)
  await team('PATCH', '/api/admin/customers/' + oid, { plan: 'standard' });
  assert.equal((await o('GET', '/api/team')).json.canTeam, false);
  assert.equal((await o('POST', '/api/team', { email: 'anna@bedrijf.example', role: 'editor' })).status, 403, 'Standard: alleen jijzelf');
  await team('PATCH', '/api/admin/customers/' + oid, { plan: 'pro' });
  assert.equal((await o('GET', '/api/team')).json.seats, 3);
  assert.equal((await o('GET', '/api/team')).json.canTeam, true);
  const code = (await o('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://bedrijf.example' }, design: {}, name: 'Flyer' })).json;
  // uitnodigen: bewerker en kijker
  const inv = await o('POST', '/api/team', { email: 'anna@bedrijf.example', name: 'Anna', role: 'editor' });
  assert.equal(inv.status, 201); assert.ok(inv.json.link.includes('?invite='));
  assert.equal((await o('POST', '/api/team', { email: 'baas@bedrijf.example', role: 'editor' })).status, 409, 'bestaand account niet');
  const inv2 = await o('POST', '/api/team', { email: 'kees@bedrijf.example', name: 'Kees', role: 'viewer' });
  assert.equal((await o('POST', '/api/team', { email: 'piet@bedrijf.example', role: 'viewer' })).json.error, 'seats', 'Pro: vol bij 3');
  const accept = async (link, pw) => { const c = client(); await c('POST', '/api/auth/reset', { token: decodeURIComponent(link.split('invite=')[1]), password: pw }); return c; };
  const anna = await accept(inv.json.link, 'Anna geheime zin 12!'), kees = await accept(inv2.json.link, 'Kees geheime zin 12!');
  assert.deepEqual((await anna('GET', '/api/team')).json.member.role, 'editor');
  // zelfde codes
  assert.deepEqual((await anna('GET', '/api/qr-codes')).json.map((c) => c.id), [code.id], 'lid ziet de codes van het team');
  const made = await anna('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://anna.example' }, design: {}, name: 'Van Anna' });
  assert.equal(made.status, 201);
  assert.equal((await o('GET', '/api/qr-codes')).json.length, 2, 'eigenaar ziet de code van Anna');
  assert.equal((await kees('GET', '/api/qr-codes')).json.length, 2, 'kijker ziet alles');
  assert.equal((await kees('DELETE', '/api/qr-codes/' + code.id)).json.error, 'viewer', 'kijker kan niets wijzigen');
  assert.equal((await kees('GET', '/api/analytics')).status, 200, 'kijker ziet statistieken');
  // wie deed wat
  await new Promise((r) => setTimeout(r, 50));
  const log = (await o('GET', '/api/team/log')).json.log;
  assert.ok(log.some((e) => e.byName === 'Anna' && e.action === 'created'), 'Anna maakte een code');
  // rol wijzigen en verwijderen
  assert.equal((await o('PATCH', '/api/team/' + log.find((e) => e.byName === 'Anna').by, { role: 'viewer' })).status, 200);
  assert.equal((await anna('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://x.example' }, design: {} })).json.error, 'viewer', 'nu kijker');
  assert.equal((await anna('POST', '/api/team', { email: 'z@bedrijf.example' })).status, 403, 'lid kan geen leden uitnodigen');
  const annaId = (await o('GET', '/api/team')).json.members.find((m) => m.email === 'anna@bedrijf.example').userId;
  assert.equal((await o('DELETE', '/api/team/' + annaId)).status, 204);
  assert.equal((await anna('GET', '/api/qr-codes')).status, 401, 'verwijderd lid is uitgelogd');
  assert.equal((await o('GET', '/api/qr-codes')).json.length, 2, 'codes van het team blijven');
});

test('map hernoemen: de codes blijven in de map', async () => {
  const k = client(); await signup(k, 'map-k@example.com', 'Map hernoemen zin 12!', 'Map');
  const f = (await k('POST', '/api/folders', { name: 'Oud' })).json.folder;
  const c = (await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://m.example' }, design: {} })).json;
  await k('POST', '/api/folders/move', { ids: [c.id], folderId: f.id });
  const r = await k('PATCH', '/api/folders/' + f.id, { name: 'Nieuw' });
  assert.equal(r.status, 200); assert.equal(r.json.folder.id, f.id, 'zelfde map');
  assert.equal((await k('GET', '/api/qr-codes')).json.find((x) => x.id === c.id).folderId, f.id, 'code zit nog in de map');
  const r2 = await k('PATCH', '/api/folders/' + f.id, { name: 'Nieuw 2', color: 'red' });
  assert.equal((await k('GET', '/api/qr-codes')).json.find((x) => x.id === c.id).folderId, f.id, 'ook met kleur (oude app)');
});

test('inloggen met Google: uit zonder sleutels; tweede stap met een onbekende code faalt', async () => {
  const c = client();
  const r = await fetch(base + '/api/auth/google', { redirect: 'manual' });
  assert.equal(r.status, 302); assert.match(r.headers.get('location'), /gerr=off/);
  assert.equal((await c('POST', '/api/auth/google/2fa', { token: 'onzin', code: '123456' })).status, 400);
  assert.equal((await c('GET', '/api/health')).json.google, false, 'geen Google-knop zonder sleutels');
});

test('inloggen met Microsoft: uit zonder sleutels', async () => {
  const c = client();
  const r = await fetch(base + '/api/auth/microsoft', { redirect: 'manual' });
  assert.equal(r.status, 302); assert.match(r.headers.get('location'), /merr=off/);
  const cb = await fetch(base + '/api/auth/microsoft/callback?code=x&state=y', { redirect: 'manual' });
  assert.match(cb.headers.get('location'), /merr=off/);
  assert.equal((await c('GET', '/api/health')).json.microsoft, false, 'geen Microsoft-knop zonder sleutels');
});

test('akkoord met de voorwaarden: verplicht bij registreren, anders één keer in de app', async () => {
  const c = client();
  const r = await c('POST', '/api/auth/register', { email: 'zonder-akkoord@example.com', password: 'Geen akkoord zin 4!', name: 'Zonder' });
  assert.equal(r.status, 400); assert.equal(r.json.error, 'terms');
  await signup(c, 'met-akkoord@example.com', 'Wel akkoord zin 5!', 'Met');
  assert.equal((await c('GET', '/api/account/terms')).json.ok, true, 'akkoord gegeven bij registreren');
  assert.equal((await c('POST', '/api/account/terms', { accept: false })).status, 400);
  assert.equal((await c('POST', '/api/account/terms', { accept: true })).json.ok, true);
  assert.equal((await client()('GET', '/api/account/terms')).status, 401, 'alleen ingelogd');
});

test('demo-afrekenen: alleen met DEMO_CHECKOUT, alleen voor een nieuwe klant, één keer', async () => {
  const c = client(); await signup(c, 'demo-pay@example.com', 'Demo betalen zin 3!', 'Demo', { unpaid: true });
  assert.equal((await c('GET', '/api/account/plan')).json.sub.state, 'unpaid');
  delete process.env.DEMO_CHECKOUT;
  assert.equal((await c('POST', '/api/account/checkout-demo', { plan: 'pro', period: 'year' })).status, 403, 'uit zonder DEMO_CHECKOUT');
  process.env.DEMO_CHECKOUT = 'true';
  assert.equal((await c('POST', '/api/account/checkout-demo', { plan: 'gratis' })).status, 400);
  const r = await c('POST', '/api/account/checkout-demo', { plan: 'pro', period: 'year' });
  assert.equal(r.status, 200); assert.equal(r.json.sub.state, 'active');
  const plan = (await c('GET', '/api/account/plan')).json; assert.equal(plan.plan.id, 'pro');
  assert.ok(Date.parse(plan.sub.periodEnd) > Date.now() + 370 * 864e5, '14 dagen proef + een jaar');
  assert.equal((await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://na-betalen.example' }, design: {} })).status, 201, 'nu kan hij codes maken');
  assert.equal((await c('POST', '/api/account/checkout-demo', { plan: 'business' })).status, 409, 'maar één keer');
  delete process.env.DEMO_CHECKOUT;
});
