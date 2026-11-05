/* Betalen op de promotiesite (qr-codex.com) zonder account vooraf, zonder echte Stripe (nagebootst).
   Loopt na: alleen met de sleutel van de site, zelfde proef en actie als in de app, webhook maakt het account op het e-mailadres,
   koppelt het abonnement (uid in de metadata), zet het pakket en mailt een link om een wachtwoord te kiezen; daarna inloggen. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'optimasys-site-'));
process.env.ALLOW_SIGNUP = 'true';
process.env.STRIPE_SECRET_KEY = 'sk_test_nep';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_nep';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_nep';
process.env.SITE_CHECKOUT_KEY = 'k'.repeat(40);
process.env.SITE_URL = 'https://qr-codex.com';
const { createApp } = require('../server/dist/main');
const { MailerService } = require('../server/dist/auth/mailer.service');
const { DatabaseService } = require('../server/dist/database/database.service');

const calls = []; const subs = {}, sessions = {}; let seq = 0;
const realFetch = global.fetch;
global.fetch = async (url, o = {}) => {
  if (!String(url).startsWith('https://api.stripe.com/')) return realFetch(url, o);
  const p = String(url).replace('https://api.stripe.com/v1/', '').split('?')[0], body = new URLSearchParams(o.body || '');
  calls.push({ method: o.method, path: p, body });
  const ok = (j) => ({ ok: true, status: 200, json: async () => j });
  if (p === 'customers') return ok({ id: 'cus_' + (++seq) });
  if (/^customers\//.test(p)) return ok({ id: p.split('/')[1] });
  if (p === 'coupons') return ok({ id: 'co_' + (++seq) });
  if (p === 'tax/settings') return ok({ status: 'pending' });
  if (p === 'payment_method_domains') return ok({ id: 'pmd_1', domain_name: body.get('domain_name') });
  if (p === 'checkout/sessions') {
    const id = 'cs_test_' + (++seq), meta = {}; for (const [k, v] of body) { const m = k.match(/^metadata\[(\w+)\]$/); if (m) meta[m[1]] = v; }
    sessions[id] = { id, status: 'open', metadata: meta };
    return ok(body.get('ui_mode') === 'elements' ? { id, client_secret: id + '_secret_x' } : { id, url: 'https://checkout.stripe.com/c/pay/' + id });
  }
  if (/^checkout\/sessions\//.test(p)) return sessions[p.split('/')[2]] ? ok(sessions[p.split('/')[2]]) : { ok: false, status: 404, json: async () => ({ error: { message: 'no' } }) };
  if (/^subscriptions\//.test(p)) {
    const id = p.split('/')[1];
    if (o.method === 'POST' && subs[id]) for (const [k, v] of body) { const m = k.match(/^metadata\[(\w+)\]$/); if (m) subs[id].metadata[m[1]] = v; }
    return ok(subs[id] || {});
  }
  return { ok: false, status: 404, json: async () => ({ error: { message: 'onbekend ' + p } }) };
};

let base, app, db; const paid = [];
test.before(async () => {
  app = await createApp();
  const m = app.get(MailerService);
  m.sendPaid = async (to, link, lang, plan) => { paid.push({ to, link, lang, plan }); };
  db = app.get(DatabaseService);
  await app.listen(0);
  base = 'http://localhost:' + app.getHttpServer().address().port;
});
test.after(async () => { await app.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); global.fetch = realFetch; });

const KEY = { 'x-site-key': 'k'.repeat(40) };
async function call(method, url, body, headers = {}) {
  const r = await realFetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch (e) {}
  return { status: r.status, json, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
function hook(event) {
  const raw = JSON.stringify(event), t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_nep').update(t + '.' + raw).digest('hex');
  return realFetch(base + '/api/billing/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=' + t + ',v1=' + sig }, body: raw });
}
const order = { email: 'Makelaar@Example.com', name: 'Ana López', plan: 'pro', period: 'month', lang: 'es', accept: true, buyer: { type: 'private' }, ip: '' };

test('zonder (juiste) sleutel van de site: geweigerd', async () => {
  assert.strictEqual((await call('POST', '/api/billing/site-checkout', order)).status, 403);
  assert.strictEqual((await call('POST', '/api/billing/site-checkout', order, { 'x-site-key': 'x'.repeat(40) })).status, 403);
});

test('akkoord met de voorwaarden is verplicht', async () => {
  const r = await call('POST', '/api/billing/site-checkout', { ...order, accept: false }, KEY);
  assert.strictEqual(r.status, 400); assert.deepStrictEqual(r.json.details, ['accept']);
});

test('afrekenen op de site: zelfde proef en actie als de app, betaalvelden op de site', async () => {
  const r = await call('POST', '/api/billing/site-checkout', { ...order, embedded: true }, KEY);
  assert.strictEqual(r.status, 200, JSON.stringify(r.json));
  assert.ok(/^cs_test_\d+_secret_x$/.test(r.json.clientSecret)); assert.strictEqual(r.json.pk, 'pk_test_nep'); assert.strictEqual(r.json.trial, 14);
  const s = calls.filter((c) => c.path === 'checkout/sessions').pop().body;
  assert.strictEqual(s.get('ui_mode'), 'elements');
  assert.strictEqual(s.get('line_items[0][price_data][unit_amount]'), '1299');            // Pro per maand € 12,99 (zoals plans.ts)
  assert.strictEqual(s.get('subscription_data[trial_period_days]'), '14');
  assert.ok(s.get('discounts[0][coupon]'));                                                 // eerste maand € 4,99
  assert.strictEqual(s.get('metadata[site]'), '1'); assert.strictEqual(s.get('metadata[email]'), 'makelaar@example.com');
  assert.strictEqual(s.get('metadata[uid]'), null);                                         // nog geen account
  assert.strictEqual(s.get('return_url'), 'https://qr-codex.com/?checkout=done&session_id={CHECKOUT_SESSION_ID}');
  assert.ok(calls.some((c) => c.path === 'payment_method_domains' && c.body.get('domain_name') === 'qr-codex.com'));
  assert.strictEqual(await db.userByEmail('makelaar@example.com'), null);                  // geen account voor wie niet betaalt
});

test('betaald: webhook maakt het account, koppelt het abonnement en mailt de link', async () => {
  const sid = Object.keys(sessions).pop(), meta = sessions[sid].metadata;
  subs.sub_site = { id: 'sub_site', status: 'trialing', customer: 'cus_1', metadata: { ...meta }, trial_end: Math.floor(Date.now() / 1000) + 14 * 86400, items: { data: [] } };
  const ev = { type: 'checkout.session.completed', data: { object: { id: sid, mode: 'subscription', subscription: 'sub_site', customer: 'cus_1', metadata: meta, customer_details: { email: 'makelaar@example.com', name: 'Ana López' } } } };
  assert.strictEqual((await hook(ev)).status, 200);
  const u = await db.userByEmail('makelaar@example.com'); assert.ok(u);
  assert.strictEqual(await db.getSetting('plan:' + u.id), 'pro');
  assert.strictEqual(subs.sub_site.metadata.uid, u.id);                                    // latere meldingen horen bij dit account
  assert.strictEqual(paid.length, 1); assert.strictEqual(paid[0].lang, 'es'); assert.strictEqual(paid[0].plan, 'QR-Codex Pro');
  assert.ok(/\/\?invite=/.test(paid[0].link));
  assert.strictEqual((await hook(ev)).status, 200); assert.strictEqual(paid.length, 1);   // dezelfde melding nog eens: één mail
  // Link uit de mail: wachtwoord kiezen en ingelogd, met het pakket
  const token = decodeURIComponent(paid[0].link.split('invite=')[1]);
  const r = await call('POST', '/api/auth/reset', { token, password: 'Zeer-veilig-wachtwoord-2026!' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.json));
  const me = await call('GET', '/api/auth/me', null, { cookie: r.cookie });
  assert.strictEqual(me.status, 200); assert.strictEqual(me.json.email, 'makelaar@example.com');
});

test('bedankt-scherm: status van de betaling, zonder persoonsgegevens', async () => {
  const sid = Object.keys(sessions).pop(); sessions[sid].status = 'complete';
  const r = await call('GET', '/api/billing/site-checkout/session?id=' + sid, null, KEY);
  assert.deepStrictEqual(r.json, { status: 'complete', plan: 'pro', period: 'month' });
  assert.strictEqual((await call('GET', '/api/billing/site-checkout/session?id=' + sid)).status, 403);
});

test('account met abonnement: niet opnieuw via de site (inloggen in de app)', async () => {
  const r = await call('POST', '/api/billing/site-checkout', order, KEY);
  assert.strictEqual(r.status, 409); assert.strictEqual(r.json.error || r.json.message, 'exists');
});

test('zonder sleutel op de server staat betalen op de site uit', async () => {
  const keep = process.env.SITE_CHECKOUT_KEY; process.env.SITE_CHECKOUT_KEY = '';
  assert.strictEqual((await call('POST', '/api/billing/site-checkout', order, KEY)).status, 403);
  process.env.SITE_CHECKOUT_KEY = keep;
});
