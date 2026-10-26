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
  const vm = String(url).match(/^https:\/\/ec\.europa\.eu\/taxation_customs\/vies\/rest-api\/ms\/(\w+)\/vat\/(\w+)$/);
  if (vm) { global.__vies = (global.__vies || 0) + 1; if (global.__viesDown) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ isValid: vm[2] === '12345678901', requestDate: '2026-10-26+02:00', userError: vm[2] === '12345678901' ? 'VALID' : 'INVALID', name: 'PIZZA SRL' }) }; }
  if (!String(url).startsWith('https://api.stripe.com/')) return realFetch(url, o);
  const p = String(url).replace('https://api.stripe.com/v1/', '').split('?')[0], body = new URLSearchParams(o.body || '');
  calls.push({ method: o.method, path: p, body });
  const ok = (j) => ({ ok: true, status: 200, json: async () => j });
  if (p === 'customers') return ok({ id: 'cus_' + (++seq) });
  if (p === 'coupons') return ok({ id: 'co_' + (++seq) });
  if (p === 'products') return ok({ id: 'prod_extra' });
  if (p === 'subscription_items') { const s = subs[body.get('subscription')]; const it = { id: 'si_' + (++seq), quantity: +body.get('quantity'), price: { product: body.get('price_data[product]') } }; s.items = { data: [...((s.items && s.items.data) || []), it] }; return ok(it); }
  if (/^subscription_items\//.test(p)) { const id = p.split('/')[1]; for (const s of Object.values(subs)) for (const it of ((s.items && s.items.data) || [])) if (it.id === id) it.quantity = +body.get('quantity'); return ok({ id }); }
  if (p === 'checkout/sessions') return body.get('ui_mode') === 'elements'
    ? ok({ id: 'cs_' + (++seq), client_secret: 'cs_' + seq + '_secret_x', version: o.headers['Stripe-Version'] })
    : ok({ id: 'cs_' + (++seq), url: 'https://checkout.stripe.com/c/pay/cs_' + seq });
  if (p === 'billing_portal/sessions') return ok({ url: 'https://billing.stripe.com/p/session/x' });
  if (/^subscriptions\//.test(p)) {
    const id = p.split('/')[1];
    if (o.method === 'DELETE') subs[id] = { ...subs[id], status: 'canceled' };
    if (o.method === 'POST' && subs[id]) { if (body.has('cancel_at_period_end')) subs[id].cancel_at_period_end = body.get('cancel_at_period_end') === 'true'; if (body.has('default_payment_method')) subs[id].default_payment_method = body.get('default_payment_method'); }
    if (o.method === 'GET' && subs[id] && /expand/.test(String(url)) && typeof subs[id].default_payment_method === 'string') return ok({ ...subs[id], default_payment_method: { id: subs[id].default_payment_method, type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2034 } } });
    return ok(subs[id] || {});
  }
  if (/^checkout\/sessions\/cs_setup/.test(p)) return ok({ id: 'cs_setup1', mode: 'setup', status: 'complete', customer: global.__cus, setup_intent: 'seti_1' });
  if (p === 'setup_intents/seti_1') return ok({ id: 'seti_1', payment_method: 'pm_new' });
  if (p === 'invoices/upcoming') return global.__upcoming ? ok({ total: global.__upcoming }) : { ok: false, status: 404, json: async () => ({ error: { message: 'geen' } }) };
  if (p === 'tax/settings') return ok({ status: global.__taxOn ? 'active' : 'pending' });
  if (/^customers\/[^/]+\/tax_ids/.test(p)) { const cus = p.split('/')[1]; global.__tax = global.__tax || {}; const l = global.__tax[cus] = global.__tax[cus] || [];
    if (o.method === 'POST') { const t = { id: 'txi_' + (++seq), value: body.get('value'), type: body.get('type') }; l.push(t); return ok(t); }
    if (o.method === 'DELETE') { const id = p.split('/')[3]; global.__tax[cus] = l.filter((x) => x.id !== id); return ok({ deleted: true }); }
    return ok({ data: l }); }
  if (/^customers\//.test(p)) { if (o.method === 'POST') { global.__cusBody = body; } return ok({ id: p.split('/')[1], invoice_settings: {} }); }
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
  assert.equal(cs.get('allow_promotion_codes'), null, 'met coupon geen kortingscodeveld (Stripe staat niet beide toe)');
  assert.ok(cs.get('discounts[0][coupon]'), 'nieuwe klant: eerste jaar 2 maanden gratis (coupon, één keer)');
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

  // 4a. Betaald abonnement opgezegd: loopt nog tot het einde, één bevestigingsmail
  const upd = { ...subs.sub_1, status: 'active', trial_end: null, cancel_at_period_end: true };
  await hook({ type: 'customer.subscription.updated', data: { object: upd } });
  await hook({ type: 'customer.subscription.updated', data: { object: upd } });
  assert.equal(cancelled.length, 1, 'maar één mail');
  assert.equal((await c('GET', '/api/account/plan')).json.sub.state, 'active', 'tot het einde van de periode');
  await hook({ type: 'customer.subscription.updated', data: { object: { ...upd, cancel_at_period_end: false } } });   // toch weer door
  // 4b. Opgezegd in de gratis proef: meteen gestopt (bij Stripe ook), één mail
  await hook({ type: 'customer.subscription.updated', data: { object: { ...subs.sub_1, cancel_at_period_end: true } } });
  assert.equal(subs.sub_1.status, 'canceled', 'proef bij Stripe meteen gestopt');
  assert.notEqual((await c('GET', '/api/account/plan')).json.sub.state, 'active', 'proef opgezegd = meteen klaar');
  assert.equal(cancelled.length, 2);

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
  const del = calls.filter((x) => x.method === 'DELETE' && x.path === 'subscriptions/sub_1').pop();
  assert.ok(del, 'oude abonnement gestopt'); assert.equal(del.body.get('prorate'), 'true'); assert.equal(del.body.get('invoice_now'), 'true', 'tegoed meteen verrekend');
  plan = (await c('GET', '/api/account/plan')).json;
  assert.equal(plan.plan.id, 'business'); assert.equal(plan.sub.interval, 'quarter');
  // Melding over het oude (gestopte) abonnement verandert niets meer
  await hook({ type: 'customer.subscription.deleted', data: { object: { ...subs.sub_1, status: 'canceled' } } });
  assert.equal((await c('GET', '/api/account/plan')).json.sub.state, 'active');

  // 7. Account verwijderen: abonnement bij Stripe stopt meteen
  assert.equal((await c('DELETE', '/api/account', { password: pw })).status, 204);
  assert.ok(calls.some((x) => x.method === 'DELETE' && x.path === 'subscriptions/sub_2'));
});

test('Stripe: nieuwe klant per maand krijgt na de proef de eerste maand de actieprijs (alleen de eerste keer)', async () => {
  const c = client(), email = 'maand-klant@example.com', pw = 'Maand klant zin 8!';
  await c('POST', '/api/auth/register', { accept: true, email, password: pw, name: 'Maand' });
  await c('POST', '/api/auth/verify', { token: decodeURIComponent(mails[email].split('verify=')[1]) });
  await c('POST', '/api/auth/login', { email, password: pw });
  const plans = (await c('GET', '/api/account/plan')).json.plans;
  assert.deepEqual(plans.map((p) => p.priceFirstMonth), [1.99, 4.99, 9.99]);
  assert.equal((await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month' })).status, 200);
  const cs = calls.filter((x) => x.path === 'checkout/sessions').pop().body, co = calls.filter((x) => x.path === 'coupons').pop().body;
  assert.equal(cs.get('subscription_data[trial_period_days]'), '14');
  assert.ok(cs.get('discounts[0][coupon]'), 'korting eerste maand');
  assert.equal(co.get('amount_off'), '800'); assert.equal(co.get('duration'), 'repeating'); assert.equal(co.get('duration_in_months'), '1');
  assert.equal((await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'quarter' })).status, 200);
  const q = calls.filter((x) => x.path === 'checkout/sessions').pop().body;
  assert.equal(q.get('discounts[0][coupon]'), null, 'per kwartaal: geen eerste-maand-korting');
  assert.equal(q.get('allow_promotion_codes'), 'true', 'zonder coupon: kortingscode mogelijk');
});

test('betalen in de app: Checkout Session met ui_mode elements (alleen met openbare sleutel)', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { accept: true, email: 'inapp@example.com', password: 'In de app zin 7!', name: 'In' });
  await c('POST', '/api/auth/verify', { token: decodeURIComponent(mails['inapp@example.com'].split('verify=')[1]) });
  await c('POST', '/api/auth/login', { email: 'inapp@example.com', password: 'In de app zin 7!' });
  // Zonder STRIPE_PUBLISHABLE_KEY: gewoon de betaalpagina van Stripe
  assert.ok((await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', embedded: true })).json.url);
  assert.equal((await c('GET', '/api/health')).json.stripePk, undefined);
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_nep';
  assert.equal((await c('GET', '/api/health')).json.stripePk, 'pk_test_nep', 'openbare sleutel naar de app');
  const r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', embedded: true });
  assert.ok(r.json.clientSecret && !r.json.url, 'client secret, geen link');
  const call = calls.filter((x) => x.path === 'checkout/sessions').pop();
  assert.equal(call.body.get('ui_mode'), 'elements');
  assert.ok(/checkout=success/.test(call.body.get('return_url')));
  assert.equal(call.body.get('subscription_data[trial_period_days]'), '14', 'proef ook hier');
  assert.equal(call.body.get('tax_id_collection[enabled]'), null);
  delete process.env.STRIPE_PUBLISHABLE_KEY;
});

test('abonnement beheren in de app: betaalmethode, opzeggen (proef = meteen, betaald = tot einde), doorgaan', async () => {
  const c = client(), day = 864e5, sec = (ms) => Math.floor(ms / 1000);
  await c('POST', '/api/auth/register', { accept: true, email: 'beheer@example.com', password: 'Beheer zin hier 7!', name: 'Be' });
  await c('POST', '/api/auth/verify', { token: decodeURIComponent(mails['beheer@example.com'].split('verify=')[1]) });
  await c('POST', '/api/auth/login', { email: 'beheer@example.com', password: 'Beheer zin hier 7!' });
  const u = await db.userByEmail('beheer@example.com');
  assert.equal((await c('POST', '/api/billing/cancel')).status, 404, 'zonder abonnement niets op te zeggen');
  // Betaald abonnement
  global.__cus = 'cus_b';
  subs.sub_b = { id: 'sub_b', customer: 'cus_b', status: 'active', current_period_end: sec(Date.now() + 20 * day), cancel_at_period_end: false, metadata: { uid: u.id, plan: 'pro', period: 'month' } };
  await db.setSetting('stripe:' + u.id, JSON.stringify({ customer: 'cus_b', subscription: 'sub_b' }));
  // Nieuwe betaalmethode: wordt standaard op het abonnement
  const m = await c('POST', '/api/billing/method');
  assert.ok(m.json.url || m.json.clientSecret);
  assert.equal((await c('POST', '/api/billing/method/done', { session: 'cs_setup1' })).json.ok, true);
  assert.equal(subs.sub_b.default_payment_method, 'pm_new');
  const pm = (await c('GET', '/api/billing/method')).json.method;
  assert.equal(pm.type, 'card'); assert.equal(pm.last4, '4242'); assert.equal(pm.exp, '12/34');
  assert.equal((await c('POST', '/api/billing/method/done', { session: 'x" or 1' })).status, 400);
  // Opzeggen betaald: loopt door tot het einde
  const n = cancelled.length;
  assert.equal((await c('POST', '/api/billing/cancel', { reason: 'too_expensive', comment: 'Te duur voor ons' })).json.ended, false);
  assert.equal(subs.sub_b.cancel_at_period_end, true);
  const cx = calls.filter((x) => x.path === 'subscriptions/sub_b' && x.method === 'POST').pop().body;
  assert.equal(cx.get('cancellation_details[feedback]'), 'too_expensive'); assert.equal(cx.get('cancellation_details[comment]'), 'Te duur voor ons');
  let plan = (await c('GET', '/api/account/plan')).json;
  assert.equal(plan.sub.state, 'active'); assert.equal(plan.billing.cancelAtEnd, true);
  assert.equal(cancelled.length, n + 1, 'bevestigingsmail');
  // Toch doorgaan
  assert.equal((await c('POST', '/api/billing/resume')).json.ok, true);
  assert.equal(subs.sub_b.cancel_at_period_end, false);
  assert.equal((await c('GET', '/api/account/plan')).json.billing.cancelAtEnd, false);
  // Proef opzeggen: meteen gestopt
  subs.sub_b.status = 'trialing'; subs.sub_b.trial_end = sec(Date.now() + 10 * day);
  assert.equal((await c('POST', '/api/billing/cancel')).json.ended, true);
  assert.equal(subs.sub_b.status, 'canceled');
  assert.notEqual((await c('GET', '/api/account/plan')).json.sub.state, 'active');
});

test('herinnering 3 dagen vooraf: opgezegd abonnement en einde proef (één keer)', async () => {
  const { HousekeepingService } = require('../server/dist/housekeeping.service');
  const { saveSub, emptySub } = require('../server/dist/subscription');
  const hk = app.get(HousekeepingService), sent = [], m = app.get(MailerService);
  m.sendReminder = async (user, kind, until, amount) => { sent.push({ email: user.email, kind, amount }); };
  const c = client();
  await c('POST', '/api/auth/register', { accept: true, email: 'herinner@example.com', password: 'Herinner zin 77!', name: 'He' });
  const u = await db.userByEmail('herinner@example.com');
  const soon = new Date(Date.now() + 2 * 864e5).toISOString();
  await saveSub(db, u.id, { ...emptySub(), interval: 'month', periodEnd: soon });
  await db.setSetting('plan:' + u.id, 'pro');
  await db.setSetting('stripe:' + u.id, JSON.stringify({ customer: 'cus_h', subscription: 'sub_h', status: 'trialing' }));
  await hk.reminders(); await hk.reminders();
  let mine = sent.filter((x) => x.email === 'herinner@example.com');
  assert.equal(mine.length, 1, 'één keer'); assert.equal(mine[0].kind, 'trial'); assert.equal(mine[0].amount, 4.99, 'eerste maand Pro (actie)');
  await db.setSetting('stripe:' + u.id, JSON.stringify({ customer: 'cus_h', subscription: 'sub_h', status: 'active', cancelAtEnd: true }));
  await hk.reminders();
  mine = sent.filter((x) => x.email === 'herinner@example.com');
  assert.equal(mine.length, 2); assert.equal(mine[1].kind, 'end');
  // Nog ver weg: niets
  await saveSub(db, u.id, { ...emptySub(), interval: 'month', periodEnd: new Date(Date.now() + 10 * 864e5).toISOString() });
  await db.setSetting('remind:' + u.id, null); await hk.reminders();
  assert.equal(sent.filter((x) => x.email === 'herinner@example.com').length, 2);
  // Jaarabonnement: 7 dagen vooraf herinnering verlenging (maand niet)
  await saveSub(db, u.id, { ...emptySub(), interval: 'year', periodEnd: new Date(Date.now() + 6 * 864e5).toISOString() });
  await db.setSetting('stripe:' + u.id, JSON.stringify({ customer: 'cus_h', subscription: 'sub_h', status: 'active' }));
  await db.setSetting('remind:' + u.id, null); await hk.reminders(); await hk.reminders();
  mine = sent.filter((x) => x.email === 'herinner@example.com');
  assert.equal(mine.length, 3, 'één keer'); assert.equal(mine[2].kind, 'renew'); assert.ok(mine[2].amount > 0);
  // Bedrag komt van de echte volgende factuur bij Stripe (korting, btw)
  global.__upcoming = 18148; await db.setSetting('remind:' + u.id, null); await hk.reminders();
  mine = sent.filter((x) => x.email === 'herinner@example.com'); assert.equal(mine[3].amount, 181.48); global.__upcoming = 0;
  sent.length = 0; await db.setSetting('remind:' + u.id, null); await hk.reminders(); assert.equal(sent.filter((x) => x.email === 'herinner@example.com').length, 1);
  sent.length = 0; await saveSub(db, u.id, { ...emptySub(), interval: 'month', periodEnd: new Date(Date.now() + 6 * 864e5).toISOString() });
  await db.setSetting('remind:' + u.id, null); await hk.reminders();
  assert.equal(sent.filter((x) => x.email === 'herinner@example.com').length, 0, 'per maand geen verlengherinnering');
});

test('btw: bedrijf (prijs excl. btw, btw-nummer) of particulier (incl. btw), Stripe Tax aan', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { accept: true, email: 'btw@example.com', password: 'Btw test zin 77!', name: 'Bea Btw' });
  await c('POST', '/api/auth/verify', { token: decodeURIComponent(mails['btw@example.com'].split('verify=')[1]) });
  await c('POST', '/api/auth/login', { email: 'btw@example.com', password: 'Btw test zin 77!' });
  global.__taxOn = true;
  const { forgetTax } = require('../server/dist/billing/tax'); forgetTax();
  const last = () => calls.filter((x) => x.path === 'checkout/sessions').pop().body;
  // Bedrijf zonder (goed) btw-nummer binnen de EU: fout
  let r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'company', country: 'IT', companyName: 'Pizza Srl', address: 'Via Roma 1', city: 'Milano', vat: 'NL123' } });
  assert.equal(r.status, 400); assert.equal(r.json.error, 'buyer'); assert.ok(r.json.details.includes('vat'));
  // Btw-nummer met goede vorm maar niet in VIES: niet verder (geen btw verleggen)
  r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'company', country: 'IT', companyName: 'Pizza Srl', address: 'Via Roma 1', city: 'Milano', vat: 'IT99999999999' } });
  assert.equal(r.status, 400); assert.deepEqual(r.json.details, ['vies']);
  // VIES niet bereikbaar: ook niet verder
  global.__viesDown = true;
  r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'company', country: 'IT', companyName: 'Pizza Srl', address: 'Via Roma 1', city: 'Milano', vat: 'IT12345678901' } });
  assert.equal(r.status, 400); assert.deepEqual(r.json.details, ['viesDown']); global.__viesDown = false;
  // Italiaans bedrijf: prijs excl. btw, btw-nummer bij Stripe, adres in Italië, Stripe Tax aan
  r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'company', country: 'IT', companyName: 'Pizza Srl', address: 'Via Roma 1', postalCode: '20100', city: 'Milano', vat: 'IT 1234567890 1' } });
  assert.equal(r.status, 200);
  let b = last(); assert.equal(b.get('line_items[0][price_data][tax_behavior]'), 'exclusive'); assert.equal(b.get('automatic_tax[enabled]'), 'true');
  assert.equal(global.__cusBody.get('address[country]'), 'IT'); assert.equal(global.__cusBody.get('name'), 'Pizza Srl');
  const cus = Object.keys(global.__tax).pop(); assert.equal(global.__tax[cus][0].value, 'IT12345678901'); assert.equal(global.__tax[cus][0].type, 'eu_vat');
  assert.equal((await c('GET', '/api/account/plan')).json.billing.buyer, 'company');
  assert.equal((await c('GET', '/api/account/billing')).json.billing.companyName, 'Pizza Srl', 'factuurgegevens in de app bijgewerkt');
  assert.match(global.__cusBody.get('metadata[vies_checked]'), /^IT12345678901 2026-10-26/, 'VIES-controle vastgelegd bij de klant');
  // Spaans bedrijf: geen VIES nodig (altijd 21%)
  const nv = global.__vies;
  r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'company', country: 'ES', companyName: 'Tapas SL', address: 'Calle Mayor 1', city: 'Madrid', vat: 'ESB12345678' } });
  assert.equal(r.status, 400); assert.ok(r.json.details.includes('postalCode'), 'Spanje: postcode verplicht');
  r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'company', country: 'ES', companyName: 'Tapas SL', address: 'Calle Mayor 1', postalCode: '28013', city: 'Madrid', vat: 'ESB12345678' } });
  assert.equal(global.__cusBody.get('tax_exempt'), 'none');
  // Canarische Eilanden (particulier): geen IVA, vrijgesteld bij Stripe
  r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'private', country: 'ES', postalCode: '35001' } });
  assert.equal(r.status, 200); assert.equal(global.__cusBody.get('tax_exempt'), 'exempt');
  r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'private', country: 'ES' } });
  assert.equal(r.status, 400, 'particulier in Spanje zonder postcode');
  r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'company', country: 'ES', companyName: 'Tapas SL', address: 'Calle Mayor 1', postalCode: '28013', city: 'Madrid', vat: 'ESB12345678' } });
  assert.equal(r.status, 200); assert.equal(global.__vies, nv, 'Spanje: geen VIES-aanvraag');
  // Bedrijf buiten de EU (VS): geen btw-nummer bij Stripe
  r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'company', country: 'US', companyName: 'Burger Inc', address: '1 Main St', city: 'Austin', vat: '12-3456789' } });
  assert.equal(r.status, 200); assert.equal(global.__tax[cus].length, 0);
  // Particulier: prijs incl. btw, btw-nummer weg
  r = await c('POST', '/api/billing/checkout', { plan: 'pro', period: 'month', buyer: { type: 'private', country: 'NL' } });
  b = last(); assert.equal(b.get('line_items[0][price_data][tax_behavior]'), 'inclusive');
  assert.equal(global.__tax[cus].length, 0, 'geen btw-nummer meer bij particulier');
  // Betaalpagina van Stripe (zonder betalen in de app): Stripe vraagt geen btw-nummer (dat zou VIES overslaan)
  assert.equal(b.get('tax_id_collection[enabled]'), null);
  assert.equal(b.get('customer_update[address]'), null, 'land uit ons betaalscherm blijft staan');
  // Factuurgegevens in Mijn account: btw-nummer dat niet in VIES staat gaat niet naar Stripe
  const cusB = cus; global.__tax[cusB] = [];
  await c('PUT', '/api/account/billing', { type: 'company', companyName: 'Nep Srl', taxId: 'IT99999999999', firstName: 'Bea', lastName: 'Btw', address: 'Via 1', postalCode: '20100', city: 'Milano', country: 'IT' });
  await new Promise((ok) => setTimeout(ok, 100));
  assert.equal(global.__tax[cusB].length, 0, 'niet in VIES: geen btw-nummer bij Stripe');
  await c('PUT', '/api/account/billing', { type: 'company', companyName: 'Pizza Srl', taxId: 'IT12345678901', firstName: 'Bea', lastName: 'Btw', address: 'Via 1', postalCode: '20100', city: 'Milano', country: 'IT' });
  await new Promise((ok) => setTimeout(ok, 100));
  assert.equal(global.__tax[cusB].length, 1); assert.equal(global.__tax[cusB][0].value, 'IT12345678901');
  global.__taxOn = false; forgetTax();
});
