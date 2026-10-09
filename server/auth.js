/* =========================================================
   ACCOUNTS EN INLOGGEN
   - Wachtwoord: scrypt (zout per gebruiker), nooit leesbaar opgeslagen.
   - Sessie: willekeurige code in een cookie "sid" (HttpOnly, SameSite=Lax, Secure op https).
     Je blijft ingelogd tot je uitlogt: 1 jaar, en elke dag dat je de app gebruikt schuift dat op.
     In de database staat alleen een hash van die code. Dit is een noodzakelijke cookie: geen cookiebanner nodig.
   - Bescherming: te veel pogingen = even wachten; verzoeken van andere websites worden geweigerd (CSRF).
   - Wachtwoord vergeten: link per e-mail, 1 uur geldig, één keer te gebruiken.
   ========================================================= */
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const db = require('./db');
const mailer = require('./mailer');
const { EMAIL } = require('./validate');

const COOKIE = 'sid';
const secure = (req) => req.secure || process.env.NODE_ENV === 'production';

/* ---------- Wachtwoorden ---------- */
async function hashPassword(pw) { const salt = crypto.randomBytes(16).toString('hex'); return 'scrypt$' + salt + '$' + (await scrypt(String(pw), salt, 64)).toString('hex'); }
async function checkPassword(pw, stored) {
  const [, salt, h] = String(stored || '').split('$'); if (!salt || !h) return false;
  const a = Buffer.from(h, 'hex'), b = await scrypt(String(pw), salt, a.length || 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const DUMMY = 'scrypt$' + '0'.repeat(32) + '$' + '0'.repeat(128);          // zelfde rekentijd als het account niet bestaat
const COMMON = ['12345678', '123456789', '1234567890', 'password', 'wachtwoord', 'qwertyui', 'qwerty123', '11111111', '87654321', 'password1', 'iloveyou', 'welkom01', 'admin123'];
function passwordProblem(pw) {
  pw = String(pw || '');
  if (pw.length < 8) return 'short';
  if (pw.length > 200) return 'long';
  if (COMMON.indexOf(pw.toLowerCase()) >= 0) return 'common';
  return '';
}

/* ---------- Cookies ---------- */
function cookies(req) { const out = {}; String(req.get('cookie') || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return out; }
function setSession(req, res, s) {
  res.append('Set-Cookie', COOKIE + '=' + s.token + '; Path=/; HttpOnly; SameSite=Lax; Expires=' + new Date(s.expires).toUTCString() + (secure(req) ? '; Secure' : ''));
}
function clearSession(req, res) { res.append('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT' + (secure(req) ? '; Secure' : '')); }

/* ---------- Te veel pogingen: even wachten ---------- */
const hits = new Map();
function limited(key, max, minutes) {
  const t = Date.now(), win = minutes * 60e3, list = (hits.get(key) || []).filter((x) => t - x < win);
  list.push(t); hits.set(key, list);
  return list.length > max;
}
setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (!v.some((x) => t - x < 3600e3)) hits.delete(k); }, 600e3).unref();

/* ---------- Middleware ---------- */
// Wie is ingelogd? (zet req.user, of null)
async function session(req, res, next) {
  req.sid = cookies(req)[COOKIE] || ''; req.user = await db.sessionUser(req.sid);
  if (req.user && req.user.renewUntil) setSession(req, res, { token: req.sid, expires: req.user.renewUntil });   // cookie mee verlengen: je blijft ingelogd
  next();
}
// Alleen voor ingelogde gebruikers
function requireUser(req, res, next) { if (!req.user) return res.status(401).json({ error: 'Not logged in' }); next(); }
// Wijzigingen alleen vanaf onze eigen pagina's (niet via een andere website)
function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].indexOf(req.method) >= 0) return next();
  const site = req.get('sec-fetch-site'), origin = req.get('origin');
  if (site === 'same-origin') return next();                          // de browser zelf bevestigt: van onze eigen pagina
  if (site && site !== 'none') return res.status(403).json({ error: 'Cross-site request blocked' });
  if (origin) {
    // Achter een proxy (Codespaces, hosting) kan "Host" anders zijn dan het adres in de browser
    const ok = [req.get('host'), req.get('x-forwarded-host'), hostOf(process.env.PUBLIC_URL), process.env.CODESPACE_NAME && process.env.CODESPACE_NAME + '-' + (process.env.PORT || 3000) + '.' + process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN].filter(Boolean);
    try { if (ok.indexOf(new URL(origin).host) < 0) return res.status(403).json({ error: 'Cross-site request blocked' }); } catch (e) { return res.status(403).json({ error: 'Bad origin' }); }
  }
  next();
}
function hostOf(u) { try { return u ? new URL(u).host : ''; } catch (e) { return ''; } }

/* ---------- Routes ---------- */
function routes(app, baseUrl) {
  const me = (u) => ({ id: u.id, email: u.email, name: u.name, background: u.background, customBackground: u.customBackground, createdAt: u.createdAt });

  app.get('/api/auth/me', (req, res) => req.user ? res.json(me(req.user)) : res.status(401).json({ error: 'Not logged in' }));

  // Account maken: nog NIET ingelogd. Eerst het e-mailadres bevestigen via de link in de mail.
  // Bestaat het adres al, dan hetzelfde antwoord (zo kan niemand zien welke adressen een account hebben).
  app.post('/api/auth/register', async (req, res) => {
    const b = req.body || {}, email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').trim().slice(0, 80), lang = String(b.lang || 'en');
    if (limited('reg:' + req.ip, 50, 60) || limited('reg:' + email, 3, 60)) return res.status(429).json({ error: 'too_many' });
    if (!EMAIL.test(email) || email.length > 254) return res.status(400).json({ error: 'email' });
    const pp = passwordProblem(b.password); if (pp) return res.status(400).json({ error: 'password_' + pp });
    const existing = await db.userByEmail(email);
    if (!existing) {
      const user = await db.createUser({ email, name, passwordHash: await hashPassword(b.password) });
      await sendVerifyMail(req, user.id, email, lang);
    } else if (!(await db.isVerified(existing.id))) await sendVerifyMail(req, existing.id, email, lang);   // nog niet bevestigd: nieuwe link
    res.status(201).json({ verify: true, email });
  });
  async function sendVerifyMail(req, userId, email, lang) {
    const link = baseUrl(req) + '/?verify=' + encodeURIComponent(await db.createVerification(userId));
    mailer.sendVerify(email, link, lang).catch((e) => console.error('E-mail versturen mislukt:', e.message));
  }
  // Link uit de mail: account bevestigd. Daarna zelf inloggen.
  app.post('/api/auth/verify', async (req, res) => {
    if (limited('verify:' + req.ip, 30, 60)) return res.status(429).json({ error: 'too_many' });
    const userId = await db.useVerification(String((req.body || {}).token || ''));
    if (!userId) return res.status(400).json({ error: 'token' });
    res.json({ ok: true, email: (await db.getUser(userId)).email });
  });
  // Nieuwe bevestigingsmail (altijd hetzelfde antwoord)
  app.post('/api/auth/resend', async (req, res) => {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    if (limited('resend:' + req.ip, 10, 60) || limited('resend:' + email, 3, 60)) return res.status(429).json({ error: 'too_many' });
    const row = EMAIL.test(email) && await db.userByEmail(email);
    if (row && !(await db.isVerified(row.id))) await sendVerifyMail(req, row.id, email, String((req.body || {}).lang || 'en'));
    res.json({ ok: true });
  });

  app.post('/api/auth/login', async (req, res) => {
    const b = req.body || {}, email = String(b.email || '').trim().toLowerCase();
    if (limited('login:' + req.ip, 100, 15) || limited('login:' + email, 10, 15)) return res.status(429).json({ error: 'too_many' });
    const row = await db.userByEmail(email);
    const ok = await checkPassword(b.password || '', row ? row.password_hash : DUMMY);
    if (!row || !ok) return res.status(401).json({ error: 'wrong' });
    if (!(await db.isVerified(row.id))) return res.status(403).json({ error: 'unverified' });   // eerst e-mail bevestigen
    setSession(req, res, await db.createSession(row.id));
    res.json(me(await db.getUser(row.id)));
  });

  app.post('/api/auth/logout', async (req, res) => { if (req.sid) await db.deleteSession(req.sid); clearSession(req, res); res.status(204).end(); });

  // Wachtwoord vergeten: altijd hetzelfde antwoord (niemand kan zo zien of een e-mailadres een account heeft)
  app.post('/api/auth/forgot', async (req, res) => {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    if (limited('forgot:' + req.ip, 10, 60) || limited('forgot:' + email, 3, 60)) return res.status(429).json({ error: 'too_many' });
    const row = EMAIL.test(email) && await db.userByEmail(email);
    if (row) {
      const token = await db.createReset(row.id), link = baseUrl(req) + '/?reset=' + encodeURIComponent(token);
      mailer.sendReset(row.email, link, String((req.body || {}).lang || 'en')).catch((e) => console.error('E-mail versturen mislukt:', e.message));
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/reset', async (req, res) => {
    const b = req.body || {};
    if (limited('reset:' + req.ip, 20, 60)) return res.status(429).json({ error: 'too_many' });
    const pp = passwordProblem(b.password); if (pp) return res.status(400).json({ error: 'password_' + pp });
    const userId = await db.useReset(String(b.token || '')); if (!userId) return res.status(400).json({ error: 'token' });
    await db.updateUser(userId, { passwordHash: await hashPassword(b.password) });
    await db.markVerified(userId);                                           // link uit de mail = e-mailadres is van jou
    await db.deleteSessionsOf(userId);                                 // overal uitloggen
    setSession(req, res, await db.createSession(userId));
    res.json(me(await db.getUser(userId)));
  });

  /* Mijn account */
  app.patch('/api/account', requireUser, async (req, res) => {
    const name = (req.body || {}).name; if (typeof name !== 'string') return res.status(400).json({ error: 'name' });
    res.json(me(await db.updateUser(req.user.id, { name: name.trim().slice(0, 80) })));
  });
  app.post('/api/account/password', requireUser, async (req, res) => {
    const b = req.body || {};
    if (limited('pw:' + req.user.id, 10, 15)) return res.status(429).json({ error: 'too_many' });
    if (!(await checkPassword(b.current || '', await db.passwordHashOf(req.user.id)))) return res.status(403).json({ error: 'wrong' });   // 403: wel ingelogd, verkeerd wachtwoord
    const pp = passwordProblem(b.password); if (pp) return res.status(400).json({ error: 'password_' + pp });
    await db.updateUser(req.user.id, { passwordHash: await hashPassword(b.password) });
    await db.deleteSessionsOf(req.user.id, req.sid);                         // andere apparaten uitloggen
    res.json({ ok: true });
  });
  // Overzicht (Mijn account)
  app.get('/api/account/summary', requireUser, async (req, res) => res.json(Object.assign({ createdAt: req.user.createdAt }, await db.summary(req.user.id))));
  // Uitloggen op alle andere apparaten (deze blijft ingelogd)
  app.post('/api/account/logout-others', requireUser, async (req, res) => { await db.deleteSessionsOf(req.user.id, req.sid); res.json({ ok: true }); });
  // AVG: al je gegevens downloaden
  app.get('/api/account/export', requireUser, async (req, res) => {
    const codes = (await db.listWithStats(req.user.id)).map((q) => { const c = Object.assign({}, q.content); Object.keys(c).forEach((k) => { if (/password/i.test(k) && q.typeId !== 'wifi') delete c[k]; }); return Object.assign({}, q, { content: c, userId: undefined }); });
    res.set('Content-Disposition', 'attachment; filename="optimasys-mijn-gegevens.json"');
    res.json({ exportedAt: new Date().toISOString(), account: me(req.user), qrCodes: codes });
  });
  // AVG: account en alles verwijderen (met wachtwoord)
  app.delete('/api/account', requireUser, async (req, res) => {
    if (!(await checkPassword((req.body || {}).password || '', await db.passwordHashOf(req.user.id)))) return res.status(403).json({ error: 'wrong' });
    await db.deleteUser(req.user.id); clearSession(req, res); res.status(204).end();
  });
}

module.exports = { session, requireUser, sameOrigin, routes, hashPassword, checkPassword, passwordProblem };
