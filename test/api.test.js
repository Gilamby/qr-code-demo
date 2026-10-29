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
  const jar = {}, cookieHeader = () => Object.keys(jar).map((k) => k + '=' + jar[k]).join('; ');
  const c = async (method, url, body, headers) => {
    const r = await fetch(base + url, { method, redirect: 'manual', headers: Object.assign({ 'Content-Type': 'application/json', cookie: cookieHeader() }, headers || {}), body: body ? JSON.stringify(body) : undefined });
    (r.headers.getSetCookie ? r.headers.getSetCookie() : []).forEach((line) => {
      const [kv] = line.split(';'), i = kv.indexOf('='), k = kv.slice(0, i), v = kv.slice(i + 1);
      if (!v || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(line)) delete jar[k]; else jar[k] = v;
    });
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: r.status, json, text, headers: r.headers };
  };
  c.cookie = () => (jar.sid ? 'sid=' + jar.sid : '');
  return c;
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

test('bevestigingslink in dezelfde browser: meteen ingelogd; niemand anders kan meeliften', async () => {
  const b = client(), evil = client();
  await b('POST', '/api/auth/register', { accept: true, email: 'zelfde@example.com', password: 'Zelfde browser zin 1!', name: 'Zo' });
  // Iemand anders probeert hetzelfde (nog niet bevestigde) adres met een ander wachtwoord: krijgt geen wachtrij-cookie
  await evil('POST', '/api/auth/register', { accept: true, email: 'zelfde@example.com', password: 'Andere boze zin 9!' });
  assert.equal((await evil('POST', '/api/auth/pending')).json.state, 'none');
  const v = await b('POST', '/api/auth/verify', { token: tokenFor('zelfde@example.com') });
  assert.equal(v.json.loggedIn, true); assert.equal(v.json.user.email, 'zelfde@example.com');
  assert.equal((await b('GET', '/api/auth/me')).status, 200);
  assert.equal((await evil('GET', '/api/auth/me')).status, 401);
});

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
  assert.equal((await a('POST', '/api/auth/pending')).json.state, 'waiting', 'scherm check je e-mail: nog wachten');
  const phone = client();                                                    // link geopend op de telefoon
  assert.equal((await phone('POST', '/api/auth/verify', { token: tok })).json.email, 'a@example.com');
  assert.equal((await phone('POST', '/api/auth/verify', { token: tok })).status, 400, 'link werkt maar één keer');
  assert.equal((await phone('GET', '/api/auth/me')).status, 401, 'op de telefoon niet vanzelf ingelogd');
  await markPaid('a@example.com');
  const auto = await a('POST', '/api/auth/pending');
  assert.equal(auto.json.state, 'in', 'de computer gaat vanzelf verder'); assert.equal(auto.json.user.email, 'a@example.com');
  assert.equal((await a('GET', '/api/auth/me')).status, 200);
  assert.equal((await a('POST', '/api/auth/pending')).json.state, 'none', 'maar één keer');
  await a('POST', '/api/auth/logout');
  assert.equal((await a('GET', '/api/auth/me')).status, 401);
  const dup = await client()('POST', '/api/auth/register', { accept: true, email: 'A@example.com', password: 'Nog een zin hier 6!' });
  assert.equal(dup.status, 409, 'bestaand adres: de app stuurt je naar inloggen'); assert.equal(dup.json.error, 'exists');
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
  // verwijderen = prullenbak: link werkt niet meer, bestand blijft, terugzetten kan
  assert.equal((await a('DELETE', '/api/qr-codes/' + id)).status, 204);
  assert.equal(filesOnDisk(), before + 1);
  assert.equal((await fetch(base + '/q/' + id)).status, 404, 'in de prullenbak: link werkt niet');
  assert.ok(!(await a('GET', '/api/qr-codes')).json.some((q) => q.id === id), 'niet meer in de lijst');
  const bin = await a('GET', '/api/qr-codes/trash'); assert.equal(bin.json.length, 1); assert.ok(bin.json[0].purgeAt);
  assert.equal((await a('PUT', '/api/qr-codes/' + id, { content: { title: 'x' } })).status, 404, 'in de prullenbak niet te bewerken');
  const back = await a('POST', '/api/qr-codes/' + id + '/restore'); assert.equal(back.status, 200); assert.equal(back.json.code.id, id);
  assert.equal((await a('GET', '/api/qr-codes/trash')).json.length, 0);
  // definitief: alleen vanuit de prullenbak, dan bestand weg en 410
  assert.equal((await a('DELETE', '/api/qr-codes/' + id + '/permanent')).status, 404, 'eerst naar de prullenbak');
  assert.equal((await a('DELETE', '/api/qr-codes/' + id)).status, 204);
  assert.equal((await b('POST', '/api/qr-codes/' + id + '/restore')).status, 404, 'andere klant kan niet terugzetten');
  assert.equal((await a('DELETE', '/api/qr-codes/' + id + '/permanent')).status, 204);
  assert.equal(filesOnDisk(), before);
  const log = (await a('GET', '/api/qr-codes/purged')).json.purged; assert.equal(log.length, 1); assert.equal(log[0].auto, false); assert.ok(log[0].by && log[0].at);
  assert.equal((await b('GET', '/api/qr-codes/purged')).json.purged.length, 0, 'logboek is per klant');
  // na 30 dagen: de prullenbak wordt vanzelf geleegd
  const old = await a('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://example.com/oud' } });
  await a('DELETE', '/api/qr-codes/' + old.json.id);
  const { HousekeepingService } = require('../server/dist/housekeeping.service');
  const hk = app.get(HousekeepingService);
  assert.equal(await hk.trashSweep(Date.now()), 0, 'nog geen 30 dagen: blijft');
  assert.equal(await hk.trashSweep(Date.now() + 31 * 864e5), 1, 'na 30 dagen: echt weg');
  const log2 = (await a('GET', '/api/qr-codes/purged')).json.purged; assert.equal(log2.length, 2); assert.equal(log2[0].auto, true); assert.equal(log2[0].name, 'https://example.com/oud');
  assert.equal((await a('GET', '/api/qr-codes/trash')).json.length, 0);
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

test('pakket bepaalt wat kan: Standard = 5 codes (+ losse erbij), alle soorten, standaard-achtergrond, geen eigen foto of video', async () => {
  const c = client(); await signup(c, 'standaard@example.com', 'Standaard pakket zin 6!', 'Std');
  const { DatabaseService } = require('../server/dist/database/database.service');
  const db = app.get(DatabaseService), u = await db.userByEmail('standaard@example.com'); await db.setSetting('plan:' + u.id, 'standard');
  assert.equal((await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://basis.example' }, design: {} })).status, 201, 'website mag');
  assert.equal((await c('POST', '/api/qr-codes', { typeId: 'video', content: { url: 'https://video.example/x.mp4' }, design: {} })).status, 201, 'alle soorten mogen');
  for (const n of ['drie', 'vier', 'vijf']) assert.equal((await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://' + n + '.example' }, design: {} })).status, 201);
  const vol = await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://zes.example' }, design: {} });
  assert.equal(vol.status, 403); assert.equal(vol.json.error, 'plan_limit', 'Standard: 5 codes');
  const x = await c('POST', '/api/account/extra-demo', { n: 1 });
  assert.equal(x.status, 200); assert.equal(x.json.usage.limit, 6, 'een QR-code erbij gekocht');
  assert.equal((await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://zes.example' }, design: {} })).status, 201, 'nu past hij');
  assert.equal((await c('PATCH', '/api/me', { background: 'aurora' })).json.error, 'plan_bg');
  assert.equal((await c('PATCH', '/api/me', { background: 'optimasys' })).status, 200);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
  const up = await fetch(base + '/api/account/media?name=x', { method: 'POST', headers: { 'Content-Type': 'image/jpeg', cookie: c.cookie() }, body: jpg });
  assert.equal(up.status, 403, 'eigen foto pas vanaf Pro');
  await db.setSetting('plan:' + u.id, 'pro');
  assert.equal((await c('GET', '/api/account/plan')).json.usage.limit, 51, 'Pro: 50 + de gekochte extra');
  assert.equal((await c('PATCH', '/api/me', { background: 'aurora' })).status, 200, 'Pro: meer achtergronden');
});

test('demo-afrekenen: standaard aan zonder Stripe, uit met DEMO_CHECKOUT=false', async () => {
  const c = client(); await signup(c, 'demo-pay@example.com', 'Demo betalen zin 3!', 'Demo', { unpaid: true });
  assert.equal((await c('GET', '/api/account/plan')).json.sub.state, 'unpaid');
  process.env.DEMO_CHECKOUT = 'false';
  assert.equal((await c('POST', '/api/account/checkout-demo', { plan: 'pro', period: 'year' })).status, 403, 'uit met DEMO_CHECKOUT=false');
  delete process.env.DEMO_CHECKOUT;
  assert.equal((await c('POST', '/api/account/checkout-demo', { plan: 'gratis' })).status, 400);
  const r = await c('POST', '/api/account/checkout-demo', { plan: 'pro', period: 'year' });
  assert.equal(r.status, 200); assert.equal(r.json.sub.state, 'active');
  const plan = (await c('GET', '/api/account/plan')).json; assert.equal(plan.plan.id, 'pro');
  assert.ok(Date.parse(plan.sub.periodEnd) > Date.now() + 370 * 864e5, '14 dagen proef + een jaar');
  assert.equal((await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://na-betalen.example' }, design: {} })).status, 201, 'nu kan hij codes maken');
  assert.equal((await c('POST', '/api/account/checkout-demo', { plan: 'pro', period: 'year' })).status, 409, 'zelfde pakket en periode: niets te doen');
  const up = await c('POST', '/api/account/checkout-demo', { plan: 'business', period: 'quarter' });
  assert.equal(up.status, 200, 'wisselen naar een ander pakket');
  const after = (await c('GET', '/api/account/plan')).json; assert.equal(after.plan.id, 'business'); assert.equal(after.sub.interval, 'quarter');
  const days = (Date.parse(after.sub.periodEnd) - Date.now()) / 864e5; assert.ok(days > 85 && days < 95, 'wisselen: meteen een kwartaal, geen proefperiode');
  delete process.env.DEMO_CHECKOUT;
});

test('downgraden: niets wordt verwijderd, de klant kiest wat aan blijft, de rest wordt gepauzeerd; upgraden zet ze weer aan', async () => {
  const c = client(); await signup(c, 'downgrade@example.com', 'Minder codes zin 4!', 'Down', { unpaid: true });
  assert.equal((await c('POST', '/api/account/checkout-demo', { plan: 'pro', period: 'month' })).status, 200);
  const { DatabaseService } = require('../server/dist/database/database.service');
  const db = app.get(DatabaseService);
  const ids = [];
  for (let i = 0; i < 8; i++) ids.push((await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://down' + i + '.example' }, design: {} })).json.id);
  const wifi = (await c('POST', '/api/qr-codes', { typeId: 'wifi', content: { ssid: 'Zaak', password: 'geheim12345', security: 'WPA' } })).json.id;
  for (let i = 0; i < 9; i++) await db.addScan(ids[7]);          // de meest gescande
  for (let i = 0; i < 4; i++) await db.addScan(ids[6]);
  // Naar Standard (5): wifi blijft altijd aan (telt mee), klant kiest 3, de 4e plek gaat naar de meest gescande
  assert.equal((await c('POST', '/api/account/checkout-demo', { plan: 'standard', period: 'month', keep: [ids[0], ids[1], ids[2]] })).status, 200);
  let list = (await c('GET', '/api/qr-codes')).json, on = list.filter((q) => !q.paused).map((q) => q.id).sort();
  assert.equal(list.length, 9, 'niets verwijderd');
  assert.deepEqual(on, [ids[0], ids[1], ids[2], ids[7], wifi].sort(), 'gekozen + wifi + meest gescande');
  let plan = (await c('GET', '/api/account/plan')).json;
  assert.equal(plan.usage.used, 5); assert.equal(plan.usage.limit, 5); assert.equal(plan.usage.planPaused.length, 4);
  // Zelf weer aanzetten kan niet als het vol is
  const r = await c('PATCH', '/api/qr-codes/' + ids[6], { paused: false });
  assert.equal(r.status, 403); assert.equal(r.json.error, 'plan_limit');
  // QR-code erbij gekocht: de meest gescande gepauzeerde gaat vanzelf weer aan
  assert.equal((await c('POST', '/api/account/extra-demo', { n: 1 })).status, 200);
  assert.equal((await c('GET', '/api/qr-codes')).json.find((q) => q.id === ids[6]).paused, false);
  // Een code zelf uitzetten maakt ruimte: dan mag een andere weer aan
  assert.equal((await c('PATCH', '/api/qr-codes/' + ids[0], { paused: true })).status, 200);
  assert.equal((await c('PATCH', '/api/qr-codes/' + ids[3], { paused: false })).status, 200);
  // Upgraden naar Business (onbeperkt): alles wat door het pakket uit stond, weer aan; zelf uitgezet blijft uit
  assert.equal((await c('POST', '/api/account/checkout-demo', { plan: 'business', period: 'month' })).status, 200);
  list = (await c('GET', '/api/qr-codes')).json;
  assert.deepEqual(list.filter((q) => q.paused).map((q) => q.id), [ids[0]], 'alleen de zelf gepauzeerde staat nog uit');
  assert.equal((await c('GET', '/api/account/plan')).json.usage.planPaused.length, 0);
});

test('veel QR-codes tegelijk (Pro en Business): alles of niets, fouten per regel, limiet van het pakket', async () => {
  const c = client(); await signup(c, 'bulk@example.com', 'Veel tegelijk zin 5!', 'Bulk');
  const { DatabaseService } = require('../server/dist/database/database.service');
  const db = app.get(DatabaseService), u = await db.userByEmail('bulk@example.com');
  const items = (n, from = 0) => Array.from({ length: n }, (_, i) => ({ typeId: 'website', name: 'Tafel ' + (from + i + 1), content: { url: 'https://tafel' + (from + i + 1) + '.example' }, design: {} }));
  await db.setSetting('plan:' + u.id, 'standard');
  assert.equal((await c('POST', '/api/qr-codes/bulk', { items: items(2) })).json.error, 'plan_bulk', 'Standard: niet');
  await db.setSetting('plan:' + u.id, 'pro');
  const bad = await c('POST', '/api/qr-codes/bulk', { items: items(2).concat([{ typeId: 'website', name: 'x', content: { url: 'geen link' }, design: {} }]) });
  assert.equal(bad.status, 400); assert.equal(bad.json.rows[0].row, 2, 'fout in regel 3');
  assert.equal((await c('GET', '/api/qr-codes')).json.length, 0, 'bij een fout: niets gemaakt');
  const ok = await c('POST', '/api/qr-codes/bulk', { items: items(48) });
  assert.equal(ok.status, 200); assert.equal(ok.json.created.length, 48);
  const full = await c('POST', '/api/qr-codes/bulk', { items: items(3, 48) });
  assert.equal(full.json.error, 'plan_limit'); assert.equal(full.json.room, 2, 'Pro 50: nog 2 over');
  assert.equal((await c('GET', '/api/qr-codes')).json.length, 48);
});

test('API (Business): sleutel maken, codes via /api/v1 met Bearer, intrekken', async () => {
  const c = client(); await signup(c, 'api@example.com', 'Api koppeling zin 6!', 'Api');
  const { DatabaseService } = require('../server/dist/database/database.service');
  const db = app.get(DatabaseService), u = await db.userByEmail('api@example.com');
  await db.setSetting('plan:' + u.id, 'pro');
  assert.equal((await c('POST', '/api/account/api-keys', { name: 'CRM' })).json.error, 'plan_api', 'Pro: geen API');
  await db.setSetting('plan:' + u.id, 'business');
  const k = await c('POST', '/api/account/api-keys', { name: 'Optima-CRM' });
  assert.equal(k.status, 201); assert.match(k.json.key, /^qrc_/);
  const list = (await c('GET', '/api/account/api-keys')).json;
  assert.equal(list.keys.length, 1); assert.equal(list.keys[0].name, 'Optima-CRM'); assert.equal(list.keys[0].hash, undefined, 'hash gaat nooit naar buiten');
  const api = (method, url, body, key = k.json.key) => fetch(base + url, { method, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Origin: 'https://crm.example' }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
  assert.equal((await api('GET', '/api/v1/qr-codes', null, 'qrc_fout' + 'x'.repeat(40))).status, 401);
  assert.equal((await fetch(base + '/api/v1/qr-codes')).status, 401, 'zonder sleutel');
  const made = await api('POST', '/api/v1/qr-codes', { typeId: 'website', name: 'Uit het CRM', content: { url: 'https://crm.example/1' }, design: {} });
  assert.equal(made.status, 201, 'maken via de API (ook vanaf een andere site)');
  const all = await api('GET', '/api/v1/qr-codes'); assert.equal(all.status, 200); assert.equal(all.json.length, 1);
  assert.equal((await api('PATCH', '/api/v1/qr-codes/' + made.json.id, { paused: true })).status, 200);
  assert.equal((await api('GET', '/api/v1/analytics?codes=' + made.json.id)).status, 200);
  const bulk = await api('POST', '/api/v1/qr-codes/bulk', { items: [{ typeId: 'website', name: 'B1', content: { url: 'https://b1.example' }, design: {} }] });
  assert.equal(bulk.status, 200);
  assert.equal((await api('GET', '/api/v1/account')).status, 404, 'alleen QR-codes en statistieken');
  await db.setSetting('plan:' + u.id, 'pro');
  assert.equal((await api('GET', '/api/v1/qr-codes')).json.error, 'plan_api', 'na downgraden werkt de sleutel niet meer');
  await db.setSetting('plan:' + u.id, 'business');
  assert.equal((await c('DELETE', '/api/account/api-keys/' + list.keys[0].id)).status, 204);
  assert.equal((await api('GET', '/api/v1/qr-codes')).status, 401, 'ingetrokken');
});

test('afmelden voor het scanoverzicht via de link in de mail (zonder inloggen, ondertekend)', async () => {
  const c = client(); await signup(c, 'afmeld@example.com', 'Afmelden lukt 7!', 'Af Meld');
  assert.equal((await c('PATCH', '/api/account', { emailPrefs: { report: 'weekly' } })).status, 200);
  const u = await db.userByEmail('afmeld@example.com'), link = app.get(MailerService).unsubLink(u, base);
  assert.equal((await fetch(link.replace(/t=[^&]+/, 't=fout'))).status, 400, 'zonder geldige handtekening niets');
  const page = await fetch(link); assert.equal(page.status, 200); assert.match(await page.text(), /<form method="post"/);
  assert.equal((await db.getUser(u.id)).emailPrefs.report, 'weekly', 'alleen de pagina openen meldt niet af');
  const one = await fetch(link, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
  assert.equal(one.status, 200, 'één-klik-afmelden van Gmail/Outlook');
  assert.equal((await db.getUser(u.id)).emailPrefs.report, 'off');
  const r = await app.get(MailerService).renderReport('nl', u, { period: 'weekly', range: { from: '2026-10-12', to: '2026-10-18' }, total: 1, unique: 1, prevTotal: 0, top: [] }, base);
  assert.ok(r.html.includes('/api/unsubscribe?u=') && r.text.includes('/api/unsubscribe?u='), 'afmeldlink staat in de mail');
});

test('blokkeerlijst: geblokkeerd adres of domein kan geen nieuw account maken (Terms punt 14)', async () => {
  app.get(require('../server/dist/auth/auth.service').AuthService).hits.delete('login:team@example.com');   // het team-account logde in eerdere tests al vaak in
  const team = client(); assert.equal((await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' })).status, 200);
  assert.equal((await team('POST', '/api/admin/blocklist', { value: 'geen-adres' })).json.error, 'block_value');
  assert.equal((await team('POST', '/api/admin/blocklist', { value: '@example.com' })).json.error, 'block_self', 'eigen domein niet');
  assert.equal((await team('POST', '/api/admin/blocklist', { value: 'Fraude.Jan@Gmail.com', note: 'terugboeking' })).status, 201);
  assert.equal((await team('POST', '/api/admin/blocklist', { value: 'spamfirma.test' })).json.v, '@spamfirma.test', 'domein zonder @ wordt @domein');
  const a = client();
  assert.equal((await a('POST', '/api/auth/register', { accept: true, email: 'fraudejan+2@gmail.com', password: 'Nieuw account 9!', name: 'Jan' })).json.error, 'blocked', 'variant van het adres ook');
  assert.equal((await a('POST', '/api/auth/register', { accept: true, email: 'info@mail.spamfirma.test', password: 'Nieuw account 9!', name: 'X' })).json.error, 'blocked', 'subdomein ook');
  assert.equal((await team('POST', '/api/admin/customers', { email: 'iemand@spamfirma.test', name: 'X' })).json.error, 'blocked', 'ook niet uitnodigen');
  const list = (await team('GET', '/api/admin/blocklist')).json.items; assert.equal(list.length, 2);
  assert.equal((await team('DELETE', '/api/admin/blocklist?v=' + encodeURIComponent('@spamfirma.test'))).status, 204);
  assert.equal((await a('POST', '/api/auth/register', { accept: true, email: 'info@spamfirma.test', password: 'Nieuw account 9!', name: 'X' })).status, 201, 'na opheffen weer welkom');
  // Uitzetten + blokkeren in één keer
  const k = client(); await signup(k, 'weg@klant.test', 'Weg ermee 77!', 'Weg');
  const u = await db.userByEmail('weg@klant.test');
  assert.equal((await team('PATCH', '/api/admin/customers/' + u.id, { disabled: true, reason: 'misbruik', block: true })).status, 200);
  assert.ok((await team('GET', '/api/admin/blocklist')).json.items.some((b) => b.v === 'weg@klant.test' && b.accounts[0].disabled));
  const normal = client(); assert.equal((await normal('GET', '/api/admin/blocklist')).status, 401);
});

test('labels en notitie bij een code; startdatum ook voor pagina-codes', async () => {
  app.get(require('../server/dist/auth/auth.service').AuthService).hits.clear();   // na alle eerdere tests: limiet van aanmelden per IP weer leeg
  const c = client(); await signup(c, 'labels@example.com', 'Labels zijn fijn 8!', 'Lab');
  const made = (await c('POST', '/api/qr-codes', { typeId: 'website', name: 'Flyer', content: { url: 'https://example.com' }, design: {} })).json;
  const p = await c('PATCH', '/api/qr-codes/' + made.id, { labels: ['Actie', 'actie', ' Zomer ', '', 'x'.repeat(40)], note: 'Hangt bij de ingang' });
  assert.equal(p.status, 200); assert.deepEqual(p.json.labels, ['Actie', 'Zomer', 'x'.repeat(30)], 'dubbel/leeg eruit, max 30 tekens'); assert.equal(p.json.note, 'Hangt bij de ingang');
  assert.equal((await c('PATCH', '/api/qr-codes/' + made.id, { labels: 'geen lijst' })).status, 400);
  const dup = (await c('POST', '/api/qr-codes/' + made.id + '/duplicate', {})).json;
  assert.deepEqual(dup.labels, ['Actie', 'Zomer', 'x'.repeat(30)], 'kopie houdt labels');
  const lr = await c('POST', '/api/qr-codes', { typeId: 'links', name: 'Later', content: { link1: 'https://example.com', starts: '2099-01-01', utm: '1' }, design: {} }); const later = lr.json; assert.equal(lr.status, 201);
  assert.equal(later.content.starts, '2099-01-01', 'startdatum ook bij een linkpagina');
  const r = await fetch(base + '/q/' + later.id, { redirect: 'manual' }); assert.equal(r.status, 503, 'nog niet begonnen');
});

test('scanmelding: mail bij de eerste scan (uit te zetten)', async () => {
  app.get(require('../server/dist/auth/auth.service').AuthService).hits.clear();
  const sent = []; const m = app.get(MailerService), orig = m.sendScanAlert; m.sendScanAlert = async (u, c, kind) => { sent.push([u.email, c.scans, kind]); };
  try {
    const c = client(); await signup(c, 'scanmail@example.com', 'Scan meldingen 9!', 'Scan');
    const q = (await c('POST', '/api/qr-codes', { typeId: 'website', name: 'Melding', content: { url: 'https://example.com' }, design: {} })).json;
    await fetch(base + '/q/' + q.id, { redirect: 'manual' }); await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(sent, [['scanmail@example.com', 1, 'first']]);
    await fetch(base + '/q/' + q.id, { redirect: 'manual' }); await new Promise((r) => setTimeout(r, 50));
    assert.equal(sent.length, 1, 'tweede scan: geen mail');
    await c('PATCH', '/api/account', { emailPrefs: { firstScan: false } });
    const q2 = (await c('POST', '/api/qr-codes', { typeId: 'website', name: 'Stil', content: { url: 'https://example.com' }, design: {} })).json;
    await fetch(base + '/q/' + q2.id, { redirect: 'manual' }); await new Promise((r) => setTimeout(r, 50));
    assert.equal(sent.length, 1, 'uitgezet: geen mail');
  } finally { m.sendScanAlert = orig; }
});

test('logboek per scan en kaart (detailpagina): tijd, plaats, apparaat; geen IP', async () => {
  app.get(require('../server/dist/auth/auth.service').AuthService).hits.clear();
  const c = client(); await signup(c, 'logboek@example.com', 'Logboek zien 77!', 'Log');
  const q = (await c('POST', '/api/qr-codes', { typeId: 'website', name: 'Log', content: { url: 'https://example.com' }, design: {} })).json;
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  await fetch(base + '/q/' + q.id, { redirect: 'manual', headers: { 'user-agent': iphone } });
  await fetch(base + '/q/' + q.id, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36' } });
  const r = await c('GET', '/api/analytics/scans?code=' + q.id);
  assert.equal(r.status, 200); assert.equal(r.json.total, 2); assert.equal(r.json.scans.length, 2);
  const s = r.json.scans.find((x) => x.os === 'iOS'); assert.ok(s, 'iPhone-scan in het logboek'); assert.ok(s.at && s.dev);
  assert.ok(!JSON.stringify(r.json).includes('127.0.0.1') && !('ip' in s), 'geen IP-adres');
  assert.equal((await c('GET', '/api/analytics/scans?code=' + q.id + '&os=iOS')).json.total, 1, 'filter werkt');
  assert.equal((await c('GET', '/api/analytics/scans?code=' + q.id + '&limit=1')).json.more, true, 'meer laden');
  const other = client(); await signup(other, 'ander-log@example.com', 'Andere klant 77!', 'X');
  assert.equal((await other('GET', '/api/analytics/scans?code=' + q.id)).status, 404, 'niet van een ander');
});

test('health check: link niet bereikbaar (intern adres) = werkt niet; code zonder link = niets; bewerken = opnieuw', async () => {
  const c = client();
  await signup(c, 'health@example.com', 'Health check zin 9!', 'He');
  const bad = (await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'http://127.0.0.1:9/weg' } })).json;
  const h = await c('POST', '/api/qr-codes/' + bad.id + '/health');
  assert.equal(h.status, 200); assert.equal(h.json.state, 'down'); assert.equal(h.json.bad[0].url, 'http://127.0.0.1:9/weg');
  assert.equal((await c('GET', '/api/qr-codes/health')).json[bad.id].state, 'down');
  const wifi = (await c('POST', '/api/qr-codes', { typeId: 'wifi', content: { ssid: 'Gasten', password: 'geheim123', security: 'WPA' } })).json;
  assert.equal((await c('POST', '/api/qr-codes/' + wifi.id + '/health')).json.state, 'none', 'geen link: niets te controleren');
  await c('PUT', '/api/qr-codes/' + bad.id, { typeId: 'website', content: { url: 'https://example.org/nieuw' } });
  assert.equal((await c('GET', '/api/qr-codes/health')).json[bad.id], undefined, 'nieuwe link: oude uitslag weg');
  const other = client(); await signup(other, 'health2@example.com', 'Health check zin 8!', 'Ho');
  assert.equal((await other('POST', '/api/qr-codes/' + bad.id + '/health')).status, 404, 'niet van een ander');
});

test('health check: pas na 2 mislukte pogingen "werkt niet" (geen vals alarm)', async () => {
  const { checkCode, due } = require('../server/dist/health');
  const q = { id: 'x', content: { url: 'http://10.0.0.1/' } };
  const one = await checkCode(q, null); assert.equal(one.state, 'checking'); assert.equal(one.fails, 1);
  assert.ok(due(one, Date.now() + 3601e3), 'na een mislukte poging over een uur opnieuw');
  const two = await checkCode(q, one); assert.equal(two.state, 'down');
  assert.equal(await checkCode({ id: 'y', content: {} }, null), null);
});

test('plannen: start- en eindtijd in de tijdzone van de eigenaar, na afloop naar een andere link', async () => {
  const rules = require('../server/dist/visitor/rules');
  const q = { scans: 0, content: { starts: '2026-11-01', startsTime: '18:00', expires: '2026-11-30', expiresTime: '23:00' } };
  assert.equal(rules.notYet(q, { d: '2026-11-01', t: '17:59' }), true); assert.equal(rules.notYet(q, { d: '2026-11-01', t: '18:00' }), false);
  assert.equal(rules.isExpired(q, { d: '2026-11-30', t: '22:59' }), false); assert.equal(rules.isExpired(q, { d: '2026-11-30', t: '23:00' }), true);
  assert.equal(rules.isExpired({ scans: 0, content: { expires: '2026-11-30' } }, { d: '2026-11-30', t: '23:59' }), false, 'zonder tijd: de hele dag geldig');
  assert.equal(rules.nowIn('Europe/Madrid', new Date('2026-07-01T10:00:00Z')).t, '12:00');
  const c = client(); await signup(c, 'plan-tijd@example.com', 'Plannen zin 77!', 'Pt');
  assert.equal((await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://example.com', expires: '2026-01-01', expiresTime: '25:00' } })).status, 400, 'geen geldige tijd');
  const made = (await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://example.com', expires: '2020-01-01', afterUrl: 'https://example.com/nieuwe-actie' } })).json;
  const r = await fetch(base + '/q/' + made.id, { redirect: 'manual' });
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), 'https://example.com/nieuwe-actie');
  const made2 = (await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://example.com', expires: '2020-01-01' } })).json;
  assert.equal((await fetch(base + '/q/' + made2.id, { redirect: 'manual' })).status, 410, 'zonder link: verlopen-pagina');
});

test('A/B-test: verdeling over twee links, utm_content per versie, scans per versie, opnieuw tellen bij nieuwe link', async () => {
  const rules = require('../server/dist/visitor/rules');
  const q = { id: 'ab', content: { url: 'https://a.example/', abUrl: 'https://b.example/', abShare: '20', utm: '1', title: 'Actie' } };
  assert.equal(rules.abVariant(q, 0.1), 'B'); assert.equal(rules.abVariant(q, 0.5), 'A'); assert.equal(rules.abVariant({ content: { url: 'x' } }), null);
  assert.match(rules.targetUrl(q, '', 'B'), /^https:\/\/b\.example\/\?.*utm_content=b/);
  const c = client(); await signup(c, 'ab@example.com', 'AB test zin 77!', 'Ab');
  const made = (await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://a.example/', abUrl: 'https://b.example/' } })).json;
  const seen = {};
  for (let i = 0; i < 40; i++) { const r = await fetch(base + '/q/' + made.id, { redirect: 'manual' }); seen[r.headers.get('location')] = 1; }
  assert.ok(seen['https://a.example/'] && seen['https://b.example/'], 'beide links krijgen bezoekers');
  await new Promise((ok) => setTimeout(ok, 50));
  const ab = (await c('GET', '/api/qr-codes/' + made.id)).json.ab;
  assert.equal(ab.A + ab.B, 40);
  await c('PUT', '/api/qr-codes/' + made.id, { typeId: 'website', content: { url: 'https://a.example/', abUrl: 'https://c.example/' } });
  assert.deepEqual((await c('GET', '/api/qr-codes/' + made.id)).json.ab, { A: 0, B: 0 }, 'nieuwe B-link: opnieuw tellen');
});

test('factuurgegevens: bedrijf of particulier één keer kiezen, daarna niet wisselen', async () => {
  const c = client(); await signup(c, 'type-lock@example.com', 'Type vast zin 77!', 'Tv');
  const co = { type: 'company', companyName: 'Vast BV', address: 'Straat 1', postalCode: '1000AA', city: 'Amsterdam', country: 'NL' };
  assert.equal((await c('PUT', '/api/account/billing', co)).status, 200);
  assert.equal((await c('PUT', '/api/account/billing', { ...co, companyName: 'Vast BV 2' })).status, 200, 'gegevens aanpassen mag');
  const r = await c('PUT', '/api/account/billing', { type: 'private', firstName: 'Tim', lastName: 'Vast', address: 'Straat 1', postalCode: '1000AA', city: 'Amsterdam', country: 'NL' });
  assert.equal(r.status, 409); assert.equal(r.json.error, 'type_locked');
});

test('eigen domein (Business): toevoegen, korte links op dat domein, alleen eigen codes op dat domein', async () => {
  const http = require('http');
  const get = (host, p) => new Promise((ok) => { const u = new URL(base); http.get({ host: u.hostname, port: u.port, path: p, headers: { Host: host } }, (r) => { r.resume(); ok({ status: r.statusCode, location: r.headers.location }); }); });
  const c = client(); await signup(c, 'domein@example.com', 'Eigen domein zin 9!', 'Do');
  delete process.env.CUSTOM_DOMAIN_TARGET;
  assert.equal((await c('GET', '/api/account/domain')).json.available, false, 'zonder instelling: functie uit');
  process.env.CUSTOM_DOMAIN_TARGET = 'domains.qr-codex.test';
  const u = await db.userByEmail('domein@example.com');
  await db.setSetting('plan:' + u.id, 'standard');
  assert.equal((await c('POST', '/api/account/domain', { host: 'qr.voorbeeld.nl' })).status, 403, 'alleen Business');
  await db.setSetting('plan:' + u.id, 'business');
  assert.equal((await c('POST', '/api/account/domain', { host: 'voorbeeld.nl' })).status, 400, 'hoofddomein: nee, een subdomein');
  const r = await c('POST', '/api/account/domain', { host: 'https://QR.Voorbeeld.nl/' });
  assert.equal(r.status, 200); assert.equal(r.json.host, 'qr.voorbeeld.nl'); assert.equal(r.json.state, 'pending');
  const other = client(); await signup(other, 'domein2@example.com', 'Eigen domein zin 8!', 'Do2');
  const u2 = await db.userByEmail('domein2@example.com'); await db.setSetting('plan:' + u2.id, 'business');
  assert.equal((await other('POST', '/api/account/domain', { host: 'qr.voorbeeld.nl' })).status, 409, 'al van een ander');
  // DNS klopt (in de test zetten we het zelf op actief)
  const { loadDomains } = require('../server/dist/domains');
  const m = JSON.parse(await db.getSetting('domains')); m['qr.voorbeeld.nl'].state = 'active'; await db.setSetting('domains', JSON.stringify(m)); await loadDomains(db);
  const mine = (await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://voorbeeld.nl/' } })).json;
  assert.equal(mine.shortUrl, 'https://qr.voorbeeld.nl/q/' + mine.id, 'korte link op het eigen domein');
  const theirs = (await other('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://ander.nl/' } })).json;
  assert.equal((await get('qr.voorbeeld.nl', '/q/' + mine.id)).location, 'https://voorbeeld.nl/');
  assert.equal((await get('qr.voorbeeld.nl', '/q/' + theirs.id)).status, 404, 'codes van anderen niet via dit domein');
  assert.equal((await get('qr.voorbeeld.nl', '/api/me')).status, 404, 'geen app/API op het eigen domein');
  assert.equal((await get('qr.voorbeeld.nl', '/')).status, 302);
  assert.equal((await fetch(base + '/api/domains/ask?domain=qr.voorbeeld.nl')).status, 200);
  assert.equal((await fetch(base + '/api/domains/ask?domain=onbekend.voorbeeld.nl')).status, 404);
  assert.equal((await c('DELETE', '/api/account/domain')).status, 200);
  assert.doesNotMatch((await c('GET', '/api/qr-codes/' + mine.id)).json.shortUrl, /voorbeeld\.nl/, 'na verwijderen weer het gewone adres');
  delete process.env.CUSTOM_DOMAIN_TARGET;
});

test('melding bij zelfgekozen aantal scans en mail als een link stukgaat (één keer)', async () => {
  const { MailerService: M } = require('../server/dist/auth/mailer.service');
  const m = app.get(M), sent = [], down = [];
  const oldScan = m.sendScanAlert, oldDown = m.sendLinkDown;
  m.sendScanAlert = async (u, code, kind) => { sent.push({ kind, scans: code.scans }); };
  m.sendLinkDown = async (u, code, url) => { down.push({ id: code.id, url }); };
  const c = client(); await signup(c, 'meldingen@example.com', 'Meldingen zin 77!', 'Me');
  const made = (await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://example.com/', alertAt: '3' } })).json;
  for (let i = 0; i < 4; i++) await fetch(base + '/q/' + made.id, { redirect: 'manual' });
  await new Promise((ok) => setTimeout(ok, 100));
  assert.deepEqual(sent.map((x) => x.kind), ['first', 'target'], 'eerste scan en bij 3 scans, niet bij 2 of 4');
  // Health check: link stuk (2x mislukt) = één mail; nog een keer = geen tweede mail
  const { healthSweep } = require('../server/dist/health');
  const bad = (await c('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'http://127.0.0.1:9/weg' } })).json;
  const all = db.allQrCodes.bind(db); db.allQrCodes = async () => (await all()).filter((q) => q.id === bad.id);
  const t0 = Date.now();
  await healthSweep(db, t0, m); assert.equal(down.length, 0, 'eerste mislukking: nog geen mail');
  await healthSweep(db, t0 + 3700e3, m); assert.equal(down.length, 1, 'tweede keer mis: mail'); assert.equal(down[0].id, bad.id);
  await healthSweep(db, t0 + 7400e3, m); assert.equal(down.length, 1, 'blijft stuk: geen nieuwe mail');
  db.allQrCodes = all; m.sendScanAlert = oldScan; m.sendLinkDown = oldDown;
});

test('geschiedenis: vorige bestemming bewaren en terugzetten (ook het terugzetten kan terug)', async () => {
  const k = client(); await signup(k, 'hist-k@example.com', 'Geschiedenis zin 13!', 'Klant Hist');
  const c = (await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://een.example', password: 'geheim123' }, design: {} })).json;
  assert.equal((await k('GET', '/api/qr-codes/' + c.id + '/history')).json.length, 0, 'nog niets veranderd');
  await k('PUT', '/api/qr-codes/' + c.id, { content: { url: 'https://een.example' }, keepPassword: true, design: {} });
  assert.equal((await k('GET', '/api/qr-codes/' + c.id + '/history')).json.length, 0, 'zelfde inhoud: geen versie');
  await k('PUT', '/api/qr-codes/' + c.id, { content: { url: 'https://twee.example' }, keepPassword: true, design: {} });
  await k('PUT', '/api/qr-codes/' + c.id, { content: { url: 'https://drie.example' }, keepPassword: true, design: {} });
  const h = (await k('GET', '/api/qr-codes/' + c.id + '/history')).json;
  assert.deepEqual(h.map((v) => v.content.url), ['https://twee.example', 'https://een.example']);
  assert.ok(h[0].hasPassword && !('password' in h[0].content), 'geen wachtwoord-hash naar de browser');
  assert.ok(h[0].restorable && h[0].by);
  const back = await k('POST', '/api/qr-codes/' + c.id + '/history/1/restore');
  assert.equal(back.status, 200); assert.equal(back.json.content.url, 'https://een.example');
  assert.equal((await fetch(base + '/q/' + c.id, { method: 'POST', body: new URLSearchParams({ password: 'geheim123' }), redirect: 'manual' })).headers.get('location'), 'https://een.example', 'wachtwoord werkt nog na terugzetten');
  assert.equal((await k('GET', '/api/qr-codes/' + c.id + '/history')).json[0].content.url, 'https://drie.example', 'terugzetten is zelf ook weer terug te draaien');
  const other = client(); await signup(other, 'hist-o@example.com', 'Andere klant zin 14!', 'Ander');
  assert.equal((await other('GET', '/api/qr-codes/' + c.id + '/history')).status, 404, 'niet van een ander');
  assert.equal((await k('POST', '/api/qr-codes/' + c.id + '/history/9/restore')).status, 404);
});

test('slim doorsturen: per taal, apparaat en tijd; ongeldige regels geweigerd', async () => {
  const k = client(); await signup(k, 'route-k@example.com', 'Doorsturen zin 15!', 'Klant Route');
  const route = JSON.stringify([{ k: 'lang', v: 'es', url: 'https://es.example/' }, { k: 'device', v: 'ios', url: 'https://ios.example/' }]);
  const c = (await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://gewoon.example/', route }, design: {} })).json;
  const go = (h) => fetch(base + '/q/' + c.id, { redirect: 'manual', headers: h }).then((r) => r.headers.get('location'));
  assert.equal(await go({ 'accept-language': 'es-ES,es;q=0.9' }), 'https://es.example/');
  assert.equal(await go({ 'accept-language': 'nl-NL', 'user-agent': 'Mozilla/5.0 (iPhone)' }), 'https://ios.example/');
  assert.equal(await go({ 'accept-language': 'nl-NL', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0)' }), 'https://gewoon.example/');
  const bad = await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://gewoon.example/', route: JSON.stringify([{ k: 'lang', v: 'xx1', url: 'nope' }]) }, design: {} });
  assert.equal(bad.status, 400);
  const rules = require('../server/dist/visitor/rules');
  const q = { content: { route: JSON.stringify([{ k: 'time', d: 'wd', f: '22:00', t: '02:00', url: 'https://nacht.example/' }, { k: 'time', d: 'all', f: '12:00', t: '16:00', url: 'https://lunch.example/' }]) } };
  const at = (d, t) => rules.routeUrl(q, { lang: 'en', cc: '', ua: '', now: { d, t } });
  assert.equal(at('2026-10-27', '13:00'), 'https://lunch.example/', 'dinsdag lunch');
  assert.equal(at('2026-10-27', '23:30'), 'https://nacht.example/', 'dinsdagavond laat');
  assert.equal(at('2026-10-31', '01:00'), 'https://nacht.example/', 'zaterdag 01:00 hoort bij vrijdagnacht');
  assert.equal(at('2026-11-01', '01:00'), null, 'zondag 01:00 hoort bij zaterdagnacht: weekend, geen regel');
  assert.equal(at('2026-10-27', '17:00'), null);
});

test('melding bij geen of veel minder scans: één keer, en weer gewapend als het normaal is', async () => {
  const { judge, quietSweep } = require('../server/dist/quiet-alerts');
  const today = Date.UTC(2026, 9, 27), day = (n) => new Date(today - n * 864e5).toISOString().slice(0, 10);
  const mk = (base, last) => { const s = {}; for (let i = 8; i <= 35; i++) s[day(i)] = { k: [base, base] }; for (let i = 1; i <= 7; i++) s[day(i)] = { k: [last, last] }; return { stats: s }; };
  assert.equal(judge(mk(1, 0), today).kind, 'stopped', '28 scans ervoor, 0 nu');
  assert.equal(judge(mk(10, 1), today).kind, 'drop', '70/week ervoor, 7 nu');
  assert.equal(judge(mk(10, 8), today), 'normal');
  assert.equal(judge(mk(0, 0), today), null, 'nooit gescand: geen melding');
  // hele ronde met een echte code
  const k = client(); await signup(k, 'quiet-k@example.com', 'Stille code zin 16!', 'Klant Stil');
  const c = (await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://stil.example/' }, design: {} })).json;
  const db = app.get(require('../server/dist/database/database.service').DatabaseService);
  const lws = db.listWithStats.bind(db);
  db.listWithStats = async (uid, r) => (await lws(uid, r)).map((q) => (q.id === c.id ? Object.assign(q, mk(1, 0)) : Object.assign(q, { stats: {} })));
  const sent = [], m = { sendQuiet: async (u, code, q) => { sent.push([code.id, q.kind]); } };
  const at = new Date(today + 10 * 3600e3).getTime();
  await db.setSetting('quietSweep', null); await quietSweep(db, m, at);
  assert.ok(sent.some((x) => x[0] === c.id && x[1] === 'stopped'));
  const n = sent.length; await quietSweep(db, m, at); assert.equal(sent.length, n, 'zelfde dag: niet nog eens');
  await db.setSetting('quietSweep', null); await quietSweep(db, m, at); assert.equal(sent.filter((x) => x[0] === c.id).length, 1, 'zelfde episode: geen tweede mail');
  db.listWithStats = lws; await db.setSetting('quietSweep', null);
});

test('beheer: code overzetten naar een ander account (met bestanden), niet naar onbekend of hetzelfde', async () => {
  const team = client(); await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  const a = client(); await signup(a, 'tr-a@example.com', 'Overzetten zin 18!', 'Bureau A');
  const b = client(); await signup(b, 'tr-b@example.com', 'Overzetten zin 19!', 'Klant B');
  const c = (await a('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://over.example/' }, design: {} })).json;
  assert.equal((await team('POST', '/api/admin/codes/' + c.id + '/transfer', { email: 'niemand@example.com' })).status, 404);
  assert.equal((await team('POST', '/api/admin/codes/' + c.id + '/transfer', { email: 'tr-a@example.com' })).status, 400, 'zelfde eigenaar');
  assert.equal((await a('POST', '/api/admin/codes/' + c.id + '/transfer', { email: 'tr-b@example.com' })).status, 403, 'klant mag niet');
  const r = await team('POST', '/api/admin/codes/' + c.id + '/transfer', { email: 'TR-B@example.com ' }); assert.equal(r.status, 200);
  assert.ok(!(await a('GET', '/api/qr-codes')).json.some((q) => q.id === c.id), 'weg bij A');
  assert.ok((await b('GET', '/api/qr-codes')).json.some((q) => q.id === c.id), 'nu bij B');
  assert.equal((await fetch(base + '/q/' + c.id, { redirect: 'manual' })).status, 302, 'blijft werken');
  assert.ok((await team('GET', '/api/admin/log')).json.some((e) => e.action === 'transfer'));
});

test('supportvragen: contactbericht wordt een vraag; klant en team praten verder; alleen eigen vragen', async () => {
  const k = client(); await signup(k, 'tk-k@example.com', 'Vraag stellen zin 20!', 'Klant Vraag');
  const sent = await k('POST', '/api/contact', { name: 'Klant Vraag', email: 'tk-k@example.com', topic: 'problem', message: 'Mijn code doet het niet op de poster.' });
  assert.equal(sent.status, 200); const id = sent.json.ticket.id;
  assert.equal((await k('GET', '/api/tickets')).json.tickets[0].status, 'open');
  const team = client(); await team('POST', '/api/auth/login', { email: 'team@example.com', password: 'Team geheime zin 4!' });
  assert.equal((await k('GET', '/api/admin/tickets')).status, 403);
  assert.equal((await team('POST', '/api/admin/tickets/' + id + '/reply', { text: 'We kijken ernaar, probeer het nu nog eens.' })).status, 200);
  const mine = (await k('GET', '/api/tickets')).json.tickets[0]; assert.equal(mine.status, 'answered'); assert.equal(mine.messages.length, 2);
  assert.equal((await k('POST', '/api/tickets/' + id + '/reply', { text: 'Werkt weer, dank!' })).json.ticket.status, 'open');
  const other = client(); await signup(other, 'tk-o@example.com', 'Andere vraag zin 21!', 'Ander');
  assert.equal((await other('POST', '/api/tickets/' + id + '/reply', { text: 'hoi' })).status, 404, 'niet van een ander');
  assert.equal((await other('GET', '/api/tickets')).json.tickets.length, 0);
  assert.equal((await k('POST', '/api/tickets/' + id + '/close')).json.ticket.status, 'closed');
});

test('feedback: bezoeker stuurt sterren, e-mail alleen met toestemming, eigenaar ziet en wist antwoorden', async () => {
  const k = client(); await signup(k, 'fb-k@example.com', 'Feedback zin 23!', 'Klant Feedback');
  const c = (await k('POST', '/api/qr-codes', { typeId: 'feedback', content: { title: 'Café Lumen', askEmail: '1' }, design: {} }));
  assert.equal(c.status, 201, JSON.stringify(c.json)); const id = c.json.id;
  assert.equal((await fetch(base + '/q/' + id)).status, 200, 'feedbackpagina');
  const post = (b) => fetch(base + '/api/feedback/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  assert.equal((await post({ rating: 6 })).status, 400);
  assert.equal((await post({ rating: 5, comment: 'Heerlijk!', email: 'gast@example.com', consent: true })).status, 201);
  assert.equal((await post({ rating: 2, comment: 'Lang wachten', email: 'stil@example.com', consent: false })).status, 201);
  const r = (await k('GET', '/api/qr-codes/' + id + '/feedback')).json;
  assert.equal(r.count, 2); assert.equal(r.avg, 3.5); assert.deepEqual(r.dist, [0, 1, 0, 0, 1]);
  assert.equal(r.items.find((a) => a.rating === 2).email, null, 'zonder toestemming geen e-mail');
  assert.equal(r.items.find((a) => a.rating === 5).email, 'gast@example.com');
  const other = client(); await signup(other, 'fb-o@example.com', 'Andere feedback zin 24!', 'Ander');
  assert.equal((await other('GET', '/api/qr-codes/' + id + '/feedback')).status, 404);
  assert.equal((await k('DELETE', '/api/qr-codes/' + id + '/feedback/' + r.items[0].id)).status, 204);
  assert.equal((await k('GET', '/api/qr-codes/' + id + '/feedback')).json.count, 1);
  const web = (await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://x.example/' }, design: {} })).json;
  assert.equal((await fetch(base + '/api/feedback/' + web.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"rating":5}' })).status, 404, 'alleen feedback-codes');
});

test('foutmelding voor het team: pas bij 10 fouten in 15 minuten, dan max. één per uur', async () => {
  const { recentErrors } = require('../server/dist/common/http'); const { checkErrors, resetErrorAlert } = require('../server/dist/error-alerts');
  const keep = recentErrors.splice(0); resetErrorAlert(); const sent = []; const m = { sendErrorAlert: async (n, lines) => { sent.push([n, lines]); } };
  const now = Date.now(), add = (k) => { for (let i = 0; i < k; i++) recentErrors.unshift({ at: new Date(now - i * 1000).toISOString(), method: 'GET', path: '/api/x', message: 'boom' }); };
  add(5); assert.equal(await checkErrors(m, now), false);
  add(6); assert.equal(await checkErrors(m, now), true); assert.equal(sent[0][0], 11); assert.ok(sent[0][1][0].startsWith('11× GET /api/x'));
  assert.equal(await checkErrors(m, now + 60e3), false, 'binnen het uur niet nog eens');
  recentErrors.splice(0); recentErrors.push(...keep); resetErrorAlert();
});

test('extra soorten: e-mail, bellen en locatie openen de juiste app; links alleen van het juiste domein', async () => {
  const k = client(); await signup(k, 'ex-k@example.com', 'Extra soorten zin 26!', 'Klant Extra');
  const mk = (typeId, content) => k('POST', '/api/qr-codes', { typeId, content, design: {} });
  const loc = async (c) => (await fetch(base + '/q/' + c.json.id, { redirect: 'manual' })).headers.get('location');
  assert.equal(await loc(await mk('email', { email: 'hallo@cafe.example', subject: 'Vraag', body: 'Hoi daar' })), 'mailto:hallo@cafe.example?subject=Vraag&body=Hoi%20daar');
  assert.equal(await loc(await mk('phone', { phone: '+34 600 123 456' })), 'tel:+34600123456');
  assert.ok((await loc(await mk('location', { address: JSON.stringify({ l: 'Calle Larios 1, Málaga', lat: 36.72, lon: -4.42 }) }))).endsWith('query=36.72,-4.42'));
  assert.equal((await mk('tiktok', { url: 'https://example.com/x' })).status, 400, 'geen TikTok-link');
  assert.equal(await loc(await mk('tiktok', { url: 'https://www.tiktok.com/@cafe' })), 'https://www.tiktok.com/@cafe');
  const lost = await mk('lostfound', { name: 'Max', phone: '+34600123456' }); assert.equal(lost.status, 201);
  assert.equal((await fetch(base + '/q/' + lost.json.id)).status, 200, 'gevonden-pagina');
  assert.equal((await mk('text', { title: 'Huisregels', text: 'Stil na 22:00' })).status, 201);
  // Handleiding: PDF is verplicht, daarna een eigen pagina
  assert.equal((await mk('manual', { title: 'Koffiemachine' })).status, 400, 'zonder PDF');
  const pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF').toString('base64');
  const man = await mk('manual', { title: 'Koffiemachine', model: 'BP-200', file: JSON.stringify({ n: 'handleiding.pdf', s: 12, d: pdf }) }); assert.equal(man.status, 201);
  assert.equal((await fetch(base + '/q/' + man.json.id)).status, 200, 'handleiding-pagina');
});

test('formulier: vragen gecontroleerd, verplicht en e-mail met toestemming; landingspagina met blokken', async () => {
  const k = client(); await signup(k, 'fm-k@example.com', 'Formulier zin 29!', 'Klant Formulier');
  const mk = (typeId, content) => k('POST', '/api/qr-codes', { typeId, content, design: {} });
  assert.equal((await mk('form', { title: 'Enquête', questions: '[]' })).status, 400, 'minstens één vraag');
  assert.equal((await mk('form', { title: 'Enquête', questions: JSON.stringify([{ t: 'choice', q: 'Kies', o: ['alleen één'] }]) })).status, 400, 'keuze: min. 2 opties');
  const qs = [{ t: 'stars', q: 'Tevreden?', r: true }, { t: 'choice', q: 'Hoe gevonden?', o: ['Google', 'Vrienden'] }, { t: 'multi', q: 'Wat vond je goed?', o: ['Eten', 'Service', 'Sfeer'] }, { t: 'email', q: 'E-mail' }];
  const c = await mk('form', { title: 'Enquête', questions: JSON.stringify(qs) }); assert.equal(c.status, 201);
  const post = (b) => fetch(base + '/api/form/' + c.json.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  assert.equal((await post({ answers: ['', 0, [], ''] })).status, 400, 'verplichte sterren');
  assert.equal((await post({ answers: [4, 5, [], ''] })).status, 400, 'keuze bestaat niet');
  assert.equal((await post({ answers: [4, 1, [0, 2], 'ana@example.com'] })).status, 400, 'e-mail zonder toestemming');
  assert.equal((await post({ answers: [4, 1, [0, 2], 'ana@example.com'], consent: true })).status, 201);
  assert.equal((await post({ answers: [5, '', [], ''] })).status, 201);
  const l = await k('GET', '/api/qr-codes/' + c.json.id + '/form-answers'); assert.equal(l.json.count, 2); assert.equal(l.json.questions.length, 4);
  assert.deepEqual(l.json.items[1].a, [4, 1, [0, 2], 'ana@example.com']);
  assert.equal((await k('DELETE', '/api/qr-codes/' + c.json.id + '/form-answers/' + l.json.items[0].id)).status, 204);
  assert.equal((await fetch(base + '/q/' + c.json.id)).status, 200, 'formulierpagina');
  // Landingspagina
  assert.equal((await mk('landing', { title: 'Summit', blocks: JSON.stringify([{ k: 'btn', v: 'Tickets', url: 'geen-link' }]) })).status, 400, 'knop zonder geldige link');
  const lp = await mk('landing', { title: 'Summit', blocks: JSON.stringify([{ k: 'h', v: 'Programma' }, { k: 'p', v: 'Dag 1' }, { k: 'btn', v: 'Tickets', url: 'https://example.com/t' }]) });
  assert.equal(lp.status, 201); assert.equal((await fetch(base + '/q/' + lp.json.id)).status, 200, 'landingspagina');
  assert.deepEqual(l.json.items[0].q.map((x) => x.t), ['stars', 'choice', 'multi', 'email'], 'vragen bewaard bij elke inzending');
  assert.equal((await mk('landing', { title: 'Lang', text: 'x'.repeat(900) })).status, 201, 'eigen max (1000) gaat voor 500');
  assert.equal((await mk('text', { text: 'y'.repeat(2500) })).status, 201, 'tekst tot 3000');
  assert.equal((await mk('landing', { title: 'Te lang', text: 'x'.repeat(1001) })).status, 400);
});

test('aanmelden: alleen met toestemming, zelfde e-mail niet dubbel, eigenaar ziet en wist', async () => {
  const k = client(); await signup(k, 'su-k@example.com', 'Aanmelden zin 27!', 'Klant Aanmelden');
  const c = await k('POST', '/api/qr-codes', { typeId: 'signup', content: { title: 'Open dag', askPhone: '1' }, design: {} }); assert.equal(c.status, 201);
  const post = (b) => fetch(base + '/api/signup/' + c.json.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  assert.equal((await post({ name: 'Ana', email: 'ana@example.com' })).status, 400, 'zonder toestemming');
  assert.equal((await post({ name: 'A', email: 'geen-mail', consent: true })).status, 400);
  assert.equal((await post({ name: 'Ana', email: 'ana@example.com', phone: '+34 600 111 222', consent: true })).status, 201);
  assert.equal((await post({ name: 'Ana Ruiz', email: 'ANA@example.com', consent: true })).status, 201);
  const l = await k('GET', '/api/qr-codes/' + c.json.id + '/signups'); assert.equal(l.json.count, 1, 'zelfde e-mail = niet dubbel'); assert.equal(l.json.items[0].name, 'Ana', 'niet overschreven');
  const other = client(); await signup(other, 'su-o@example.com', 'Aanmelden zin 28!', 'Ander');
  assert.equal((await other('GET', '/api/qr-codes/' + c.json.id + '/signups')).status, 404, 'alleen de eigenaar');
  // 8 tegelijk: geen enkele mag verloren gaan
  const many = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((n) => post({ name: 'Gast ' + n, email: 'gast' + n + '@example.com', consent: true })));
  assert.ok(many.every((r) => r.status === 201 || r.status === 429));
  const ok = many.filter((r) => r.status === 201).length;
  assert.equal((await k('GET', '/api/qr-codes/' + c.json.id + '/signups')).json.count, 1 + ok, 'tegelijk insturen: niets kwijt');
  assert.equal((await k('DELETE', '/api/qr-codes/' + c.json.id + '/signups/' + l.json.items[0].id)).status, 204);
  assert.equal((await k('GET', '/api/qr-codes/' + c.json.id + '/signups')).json.count, ok);
});

test('extra soorten alleen in Pro en Business: Standard krijgt 403', async () => {
  const k = client(); await signup(k, 'std-k@example.com', 'Standaard pakket zin 27!', 'Klant Standard');
  assert.equal((await k('POST', '/api/account/checkout-demo', { plan: 'standard', period: 'month' })).status, 200);
  assert.equal((await k('POST', '/api/qr-codes', { typeId: 'tiktok', content: { url: 'https://www.tiktok.com/@x' }, design: {} })).status, 403);
  assert.equal((await k('POST', '/api/qr-codes', { typeId: 'website', content: { url: 'https://x.example/' }, design: {} })).status, 201);
  await k('POST', '/api/account/checkout-demo', { plan: 'pro', period: 'month' });
  assert.equal((await k('POST', '/api/qr-codes', { typeId: 'tiktok', content: { url: 'https://www.tiktok.com/@x' }, design: {} })).status, 201);
});

test('controle-fixes: bestand niet stelen, einde na start, tijdzone van het apparaat, insturen alleen als de code werkt, IP ingekort', async () => {
  const k = client(); await signup(k, 'fix-k@example.com', 'Fixes zin 30 ok!', 'Klant Fixes');
  const mk = (typeId, content) => k('POST', '/api/qr-codes', { typeId, content, design: {} });
  const pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF').toString('base64');
  // 1. Een nieuwe code mag het bestand van een andere code niet overnemen
  const a = await mk('pdf', { file: JSON.stringify({ n: 'a.pdf', s: 12, d: pdf }) }); assert.equal(a.status, 201);
  const ref = JSON.parse(a.json.content.file);
  const b = await mk('pdf', { file: JSON.stringify({ n: 'a.pdf', s: 12, f: ref.f }) });
  assert.equal(b.status, 400, 'bestand van A hoort niet bij B (verplicht veld leeg)');
  assert.equal((await fetch(base + '/q/' + a.json.id + '/file/file', { redirect: 'manual' })).status, 200, 'A houdt zijn bestand');
  // 6. Einde voor de start
  const bad = await mk('website', { url: 'https://example.com', starts: '2026-11-10', expires: '2026-11-05' });
  assert.equal(bad.status, 400); assert.ok(bad.json.details.some((d) => /before start/.test(d)));
  // 2. Tijdzone van het apparaat: alleen geldige zones
  assert.equal((await k('PUT', '/api/account/device-tz', { tz: 'Mars/Base' })).status, 400);
  assert.equal((await k('PUT', '/api/account/device-tz', { tz: 'America/New_York' })).status, 200);
  // 9. Feedback op een verlopen code: niet aannemen
  const fb = await mk('feedback', { title: 'Bistro', expires: '2020-01-01' }); assert.equal(fb.status, 201);
  const r = await fetch(base + '/api/feedback/' + fb.json.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: 5 }) });
  assert.equal(r.status, 404, 'verlopen code: geen antwoorden meer');
  // 8. IP wordt alleen ingekort bewaard
  assert.equal(require('../server/dist/common/ip').maskIp('203.0.113.77'), '203.0.113.•••');
  assert.equal(require('../server/dist/common/ip').maskIp('203.0.113.•••'), '203.0.113.•••', 'twee keer inkorten = hetzelfde');
});

test('max. 3 apparaten tegelijk: een vierde login logt het oudste uit, met de reden erbij', async () => {
  // Account van de vorige test (nog een nieuw account maken loopt tegen de registratielimiet per uur aan)
  const cred = { email: 'fix-k@example.com', password: 'Fixes zin 30 ok!' }, devs = [];
  for (let i = 0; i < 4; i++) { const c = client(), r = await c('POST', '/api/auth/login', cred); assert.equal(r.status, 200, JSON.stringify(r.json)); devs.push(c); }
  const c1 = devs[0];
  const first = await c1('GET', '/api/auth/me');
  assert.equal(first.status, 401); assert.equal(first.json.error, 'device_limit', 'oudste apparaat: uitgelogd met reden');
  for (const c of devs.slice(1)) assert.equal((await c('GET', '/api/auth/me')).status, 200, 'de laatste 3 blijven ingelogd');
  assert.equal((await devs[3]('GET', '/api/account/sessions')).json.sessions.length, 3);
  assert.ok((await devs[3]('GET', '/api/account/activity')).json.activity.some((a) => a.kind === 'device_limit'));
});

test('registreren met een bevestigd e-mailadres: 409 exists (de app stuurt naar inloggen), geen mail; link werkt 15 minuten', async () => {
  const c = client(), r = await c('POST', '/api/auth/register', { accept: true, email: 'fix-k@example.com', password: 'Nog een zin 31 ok!', name: 'X' });
  assert.equal(r.status, 409); assert.equal(r.json.error, 'exists');
  const { DatabaseService, VERIFY_MINUTES } = require('../server/dist/database/database.service');
  assert.equal(VERIFY_MINUTES, 15);
  const db = app.get(DatabaseService), u = await db.userByEmail('fix-k@example.com'), tok = await db.createVerification(u.id);
  assert.ok(tok);
});

test('verlopen bevestigingslink: token_expired en meteen een nieuwe link', async () => {
  const c = client(); await c('POST', '/api/auth/register', { accept: true, email: 'verlopen@example.com', password: 'Verlopen zin 41 ok!', name: 'V' });
  const { DatabaseService } = require('../server/dist/database/database.service'), db = app.get(DatabaseService);
  const old = tokenFor('verlopen@example.com');
  await db.d.run('UPDATE email_verifications SET expires_at = ?', ['2000-01-01T00:00:00.000Z']);
  const r = await c('POST', '/api/auth/verify', { token: old });
  assert.equal(r.status, 400); assert.equal(r.json.error, 'token_expired');
  const fresh = tokenFor('verlopen@example.com'); assert.notEqual(fresh, old, 'nieuwe link gemaakt');
  assert.equal((await c('POST', '/api/auth/verify', { token: fresh })).status, 200);
  assert.equal((await c('POST', '/api/auth/verify', { token: 'onzin' })).json.error, 'token');
});

test('privacyverklaring, voorwaarden en cookies: eigen openbare pagina, in de gekozen taal', async () => {
  for (const d of ['privacy', 'terms', 'cookies']) {
    const r = await fetch(base + '/' + d + '?lang=nl'); assert.equal(r.status, 200); const h = await r.text();
    assert.match(h, /<html lang="nl"/); assert.match(h, /<h1>/); assert.match(h, /aria-current="page"/);
  }
  assert.match(await (await fetch(base + '/privacy', { headers: { 'accept-language': 'de-DE,de;q=0.9' } })).text(), /<html lang="de"/);
});

test('Cloudflare Turnstile: uit zonder sleutels; aan = token nodig en bij Cloudflare gecontroleerd', async () => {
  const ts = require('../server/dist/auth/turnstile');
  assert.equal(ts.turnstileOn(), false); assert.equal(await ts.turnstileOk(''), true, 'uit: niets veranderd');
  process.env.TURNSTILE_SITE_KEY = '0x4AAAA-site'; process.env.TURNSTILE_SECRET_KEY = '0x4AAAA-secret';
  try {
    assert.equal(ts.turnstileOn(), true);
    assert.equal(await ts.turnstileOk(''), false, 'geen token: geweigerd');
    let sent = null; const fake = (ok) => async (url, o) => { sent = { url, body: String(o.body) }; return { json: async () => ({ success: ok }) }; };
    assert.equal(await ts.turnstileOk('tok', fake(true)), true); assert.match(sent.url, /siteverify$/); assert.match(sent.body, /secret=0x4AAAA-secret/); assert.doesNotMatch(sent.body, /remoteip/, 'geen IP-adres naar Cloudflare');
    assert.equal(await ts.turnstileOk('tok', fake(false)), false);
    assert.equal(await ts.turnstileOk('tok', async () => { throw new Error('netwerk'); }), true, 'Cloudflare onbereikbaar: niet blokkeren');
    assert.equal((await fetch(base + '/api/health').then((r) => r.json())).turnstile, '0x4AAAA-site');
    const r = await fetch(base + '/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: 'x@example.com' }) });
    assert.equal((await r.json()).error, 'captcha');
  } finally { delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY; }
});
