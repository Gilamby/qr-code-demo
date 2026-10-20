/* Betalen met Stripe, zonder echte Stripe: de aanroepen naar api.stripe.com worden hier nagebootst.
   Loopt na: afrekenen (14 dagen proef de eerste keer), webhook met handtekening, opzeggen (mail), betaling mislukt (codes stoppen),
   wisselen van pakket (oud abonnement stopt), Mijn account toont "Abonnement beheren". */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'optimasys-stripe-'));
process.env.ALLOW_SIGNUP = 'true';
process.env.STRIPE_SECRET_KEY = 'sk_test_nep';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_nep';
const { createApp } = require('../server/dist/main');
const { MailerService } = require('../server/dist/auth/mailer.service');
const { DatabaseService } = require('../server/dist/database/database.service');

// Nagebootste Stripe
const calls = []; let subs = {}, seq = 0;
const realFetch = global.fetch;
global.fetch = async (url, o = {}) => {
  if (!String(url).startsWith('https://api.stripe.com/')) return realFetch(url, o);
  const p = String(url).replace('https://api.stripe.com/v1/', '').split('?')[0], body = new URLSearchParams(o.body || '');
  calls.push({ method: o.method, path: p, body });
  const ok = (j) => ({ ok: true, status: 200, json: async () => j });
  if (p === 'customers') return ok({ id: 'cus_' + (++seq) });
  if (p === 'coupons') return ok({ id: 'co_' + (++seq) });
  if (p === 'products') return ok({ id: 'prod_extra' });
  if (p === 'subscription_items') { const s = subs[body.get('subscription')]; const it = { id: 'si_' + (++seq), quantity: +body.get('quantity'), price: { product: body.get('price_data[product]') } }; s.items = { data: [...((s.items && s.items.data) || []), it] }; return ok(it); }
  if (/^subscription_items\//.test(p)) { const id = p.split('/')[1]; for (const s of Object.values(subs)) for (const it of ((s.items && s.items.data) || [])) if (it.id === id) it.quantity = +body.get('quantity'); return ok({ id }); }
  if (p === 'checkout/sessions') return ok({ id: 'cs_' + (++seq), url: 'https://checkout.stripe.com/c/pay/cs_' + seq });
  if (p === 'billing_portal/sessions') return ok({ url: 'https://billing.stripe.com/p/session/x' });
  if (/^subscriptions\//.test(p)) { const id = p.split('/')[1]; if (o.method === 'DELETE') subs[id] = { ...subs[id], status: 'canceled' }; return ok(subs[id] || {}); }
  return { ok: false, status: 404, json: async () => ({ error: { message: 'onbekend ' + p } }) };
};

let base, app, db; const mails = {}, cancelled = [];
test.before(async () => {
  app = await createApp();
  const m = app.get(MailerService);
  m.sendVerify = async (to, link) => { mails[to] = link; };
  m.sendCancelled = async (user, until) => { cancelled.push({ email: user.email, until }); };
  db = app.get(DatabaseService);
  await app.listen(0);
  base = 'http://localhost:' + app.getHttpServer().address().port;
});
test.after(async () => { await app.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); global.fetch = realFetch; });

function client() {
  let cookie = '';
  return async (method, url, body) => {
    const r = await realFetch(base + url, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: r.status, json };
  };
}
function hook(event, secret = 'whsec_nep') {
  const raw = JSON.stringify(event), t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(t + '.' + raw).digest('hex');
  return realFetch(base + '/api/billing/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=' + t + ',v1=' + sig }, body: raw });
}
const day = 864e5, sec = (ms) => Math.floor(ms / 1000);

test('Stripe: afrekenen, webhook, opzeggen, mislukte betaling, wisselen', async () => {
  const c = client(), email = 'stripe-klant@example.com', pw = 'Stripe klant zin 7!';
  await c('POST', '/api/auth/register', { accept: true, email, password: pw, name: 'Klant' });
  await c('POST', '/api/auth/verify', { token: decodeURIComponent(mails[email].split('verify=')[1]) });
  await c('POST', '/api/auth/login', { email, password: pw });
  const u = await db.userByEmail(email);
  assert.equal((await c('GET', '/api/health')).json.stripe, true);
  assert.equal((await c('GET', '/api/account/plan')).json.sub.state, 'unpaid');

  // 1. Afrekenen: eerste keer met 14 dagen proef, per jaar met coupon (2 maanden gratis)
  const r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'year' });
  assert.equal(r.status, 200); assert.match(r.json.url, /^https:\/\/checkout\.stripe\.com\//);
  const cs = calls.filter((x) => x.path === 'checkout/sessions').pop().body;
  assert.equal(cs.get('subscription_data[trial_period_days]'), '14');
  assert.equal(cs.get('line_items[0][price_data][unit_amount]'), '15588', 'gewone jaarprijs Pro');
  assert.equal(cs.get('line_items[0][price_data][recurring][interval]'), 'year');
  assert.ok(cs.get('discounts[0][coupon]'), 'korting eerste jaar');
  assert.equal(cs.get('payment_method_collection'), 'always', 'kaart vooraf');

  // 2. Webhook zonder geldige handtekening: geweigerd
  assert.equal((await hook({ type: 'checkout.session.completed', data: { object: {} } }, 'fout')).status, 400);

  // 3. Betaald (proef loopt): pakket Pro, betaald tot het einde van de proef
  const trialEnd = Date.now() + 14 * day;
  subs.sub_1 = { id: 'sub_1', customer: 'cus_1', status: 'trialing', trial_end: sec(trialEnd), current_period_end: sec(trialEnd), cancel_at_period_end: false, metadata: { uid: u.id, plan: 'pro', period: 'year' } };
  assert.equal((await hook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', client_reference_id: u.id } } })).status, 200);
  let plan = (await c('GET', '/api/account/plan')).json;
  assert.equal(plan.plan.id, 'pro'); assert.equal(plan.sub.state, 'active'); assert.equal(plan.sub.interval, 'year'); assert.equal(plan.portal, true);
  assert.ok(Math.abs(Date.parse(plan.sub.periodEnd) - trialEnd) < 2000);
  assert.equal((await c('POST', '/api/billing/portal')).json.url, 'https://billing.stripe.com/p/session/x');

  // 4. Opgezegd (loopt nog tot het einde): één bevestigingsmail
  const upd = { ...subs.sub_1, cancel_at_period_end: true };
  await hook({ type: 'customer.subscription.updated', data: { object: upd } });
  await hook({ type: 'customer.subscription.updated', data: { object: upd } });
  assert.equal(cancelled.length, 1, 'maar één mail');
  assert.equal((await c('GET', '/api/account/plan')).json.sub.state, 'active', 'tot het einde van de periode');

  // 5. Betaling mislukt: codes stoppen meteen (bedenktijd 30 dagen)
  await hook({ type: 'customer.subscription.updated', data: { object: { ...subs.sub_1, status: 'past_due', cancel_at_period_end: false, current_period_end: sec(Date.now() + 30 * day) } } });
  assert.equal((await c('GET', '/api/account/plan')).json.sub.state, 'grace');
  // ... en toch betaald: alles weer aan
  await hook({ type: 'customer.subscription.updated', data: { object: { ...subs.sub_1, status: 'active', current_period_end: sec(Date.now() + 365 * day) } } });
  assert.equal((await c('GET', '/api/account/plan')).json.sub.state, 'active');

  // 5b. Eén QR-code erbij (Pro per jaar): extra regel in het abonnement, limiet 51
  assert.equal((await c('POST', '/api/billing/extra', { n: 1 })).status, 200);
  const si = calls.filter((x) => x.path === 'subscription_items').pop().body;
  assert.equal(si.get('price_data[recurring][interval]'), 'year'); assert.equal(si.get('price_data[unit_amount]'), '990');
  assert.equal((await c('GET', '/api/account/plan')).json.usage.limit, 51);
  await c('POST', '/api/billing/extra', { n: 1 });
  assert.equal((await c('GET', '/api/account/plan')).json.usage.limit, 52, 'tweede keer: aantal omhoog');

  // 6. Wisselen naar Business per kwartaal: geen nieuwe proef, oud abonnement stopt
  await c('POST', '/api/billing/checkout', { plan: 'business', period: 'quarter' });
  const cs2 = calls.filter((x) => x.path === 'checkout/sessions').pop().body;
  assert.equal(cs2.get('subscription_data[trial_period_days]'), null, 'geen tweede proefperiode');
  assert.equal(cs2.get('line_items[0][price_data][recurring][interval_count]'), '3');
  assert.equal(cs2.get('line_items[0][price_data][unit_amount]'), '6749');
  assert.equal(cs2.get('line_items[1][quantity]'), null, 'Business is onbeperkt: geen losse codes mee');
  subs.sub_2 = { id: 'sub_2', customer: 'cus_1', status: 'active', current_period_end: sec(Date.now() + 90 * day), cancel_at_period_end: false, metadata: { uid: u.id, plan: 'business', period: 'quarter' } };
  await hook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_2', customer: 'cus_1', client_reference_id: u.id } } });
  assert.ok(calls.some((x) => x.method === 'DELETE' && x.path === 'subscriptions/sub_1'), 'oude abonnement gestopt');
  plan = (await c('GET', '/api/account/plan')).json;
  assert.equal(plan.plan.id, 'business'); assert.equal(plan.sub.interval, 'quarter');
  // Melding over het oude (gestopte) abonnement verandert niets meer
  await hook({ type: 'customer.subscription.deleted', data: { object: { ...subs.sub_1, status: 'canceled' } } });
  assert.equal((await c('GET', '/api/account/plan')).json.sub.state, 'active');

  // 7. Account verwijderen: abonnement bij Stripe stopt meteen
  assert.equal((await c('DELETE', '/api/account', { password: pw })).status, 204);
  assert.ok(calls.some((x) => x.method === 'DELETE' && x.path === 'subscriptions/sub_2'));
});
