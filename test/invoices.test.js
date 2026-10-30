/* Eigen facturen met reeksen (ES/UE/CN/EX), zonder echte Stripe: de aanroepen naar api.stripe.com en VIES worden nagebootst.
   Loopt na: reeks per soort klant, nummering per reeks en jaar zonder gaten, één factuur per Stripe-factuur, geen factuur bij € 0,
   live zonder CIF = geen factuur, pdf, webhook invoice.paid → factuur in Mijn account + download (alleen eigen), export alleen voor het team. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'optimasys-invoices-'));
process.env.ALLOW_SIGNUP = 'true';
process.env.STRIPE_SECRET_KEY = 'sk_test_nep';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_nep';
process.env.INVOICE_SELLER_TAX_ID = 'B12345678';
const { createApp } = require('../server/dist/main');
const { MailerService } = require('../server/dist/auth/mailer.service');
const { DatabaseService } = require('../server/dist/database/database.service');
const inv = require('../server/dist/billing/invoices');
const { invoicePdf, money } = require('../server/dist/billing/invoice-pdf');

const customers = {}, stripeInvoices = [];
const realFetch = global.fetch;
global.fetch = async (url, o = {}) => {
  const vm = String(url).match(/vies\/rest-api\/ms\/(\w+)\/vat\/(\w+)$/);
  if (vm) return { ok: true, status: 200, json: async () => ({ isValid: vm[2] === '12345678901', userError: vm[2] === '12345678901' ? 'VALID' : 'INVALID', requestDate: '2026-10-30' }) };
  if (!String(url).startsWith('https://api.stripe.com/')) return realFetch(url, o);
  const p = String(url).replace('https://api.stripe.com/v1/', '').split('?')[0];
  const ok = (j) => ({ ok: true, status: 200, json: async () => j });
  if (/^customers\/[^/]+$/.test(p)) return ok(customers[p.split('/')[1]] || { id: p.split('/')[1], metadata: {} });
  if (p === 'invoices') return ok({ data: stripeInvoices });
  if (/^invoices\/in_/.test(p)) { global.__invGet = (global.__invGet || 0) + 1; return ok(stripeInvoices.find((i) => i.id === p.split('/')[1]) || {}); }
  return { ok: false, status: 404, json: async () => ({ error: { message: 'onbekend ' + p } }) };
};

/** Nep-database (alleen settings) voor de losse tests */
function memDb() { const m = new Map(); return { getSetting: async (k) => (m.has(k) ? m.get(k) : null), setSetting: async (k, v) => { if (v == null) m.delete(k); else m.set(k, v); }, m }; }
let n = 0;
function stripeInvoice(o = {}) {
  const id = 'in_' + (++n);
  return { object: 'invoice', id, status: 'paid', currency: 'eur', customer: o.customer || 'cus_x', customer_email: 'k@example.com', customer_name: o.name || 'Klant',
    customer_address: o.address || { country: 'ES', postal_code: '29603', line1: 'Calle 1', city: 'Marbella' }, customer_tax_ids: o.taxIds || [],
    total: o.total != null ? o.total : 1210, tax: o.tax != null ? o.tax : 210, total_excluding_tax: o.net != null ? o.net : 1000,
    status_transitions: { paid_at: o.paidAt || Math.floor(Date.parse('2026-10-30T10:00:00Z') / 1000) }, created: Math.floor(Date.now() / 1000),
    lines: { data: [{ description: o.desc || 'QR-Codex Pro', quantity: 1, amount: 1000, amount_excluding_tax: 1000, tax_amounts: [{ amount: o.tax != null ? o.tax : 210, inclusive: false }] }] } };
}

test('reeks per soort klant', () => {
  assert.equal(inv.seriesOf({ country: 'ES', postalCode: '29603' }), 'ES');
  assert.equal(inv.seriesOf({ country: 'ES', postalCode: '35001' }), 'CN', 'Las Palmas');
  assert.equal(inv.seriesOf({ country: 'ES', postalCode: '38001' }), 'CN', 'Tenerife');
  assert.equal(inv.seriesOf({ country: 'ES', postalCode: '51001' }), 'CN', 'Ceuta');
  assert.equal(inv.seriesOf({ country: 'IT', viesValid: true }), 'UE');
  assert.equal(inv.seriesOf({ country: 'IT', viesValid: false }), 'ES', 'EU zonder geldig nummer: Spaanse IVA');
  assert.equal(inv.seriesOf({ country: 'US' }), 'EX');
  assert.equal(inv.seriesOf({ country: 'GB' }), 'EX');
  assert.equal(inv.seriesOf({}), 'ES', 'geen land (particulier, altijd 21%)');
});

test('nummering per reeks en jaar, één factuur per Stripe-factuur, geen factuur bij € 0', async () => {
  const db = memDb();
  const a = await inv.issueInvoice(db, stripeInvoice());
  const b = await inv.issueInvoice(db, stripeInvoice());
  assert.equal(a.number, 'ES-2026-0001'); assert.equal(b.number, 'ES-2026-0002');
  const x = stripeInvoice({ address: { country: 'ES', postal_code: '38002' }, tax: 0, total: 1000 });
  assert.equal((await inv.issueInvoice(db, x)).number, 'CN-2026-0001', 'eigen reeks begint bij 0001');
  assert.equal((await inv.issueInvoice(db, x)).number, 'CN-2026-0001', 'zelfde Stripe-factuur twee keer: zelfde nummer');
  assert.equal(await db.getSetting('inv:seq:CN:2026'), '1', 'geen gat door de herhaling');
  customers.cus_it = { id: 'cus_it', metadata: {} };
  const it = await inv.issueInvoice(db, stripeInvoice({ customer: 'cus_it', address: { country: 'IT' }, taxIds: [{ type: 'eu_vat', value: 'IT12345678901' }], tax: 0, total: 1000 }));
  assert.equal(it.number, 'UE-2026-0001'); assert.equal(it.buyer.taxId, 'IT12345678901'); assert.match(it.note, /inversión del sujeto pasivo/);
  const itBad = await inv.issueInvoice(db, stripeInvoice({ customer: 'cus_it', address: { country: 'IT' }, taxIds: [{ type: 'eu_vat', value: 'IT99999999999' }] }));
  assert.equal(itBad.series, 'ES', 'nummer niet geldig in VIES: geen verlegging');
  assert.equal((await inv.issueInvoice(db, stripeInvoice({ address: { country: 'US' }, tax: 0, total: 1000 }))).number, 'EX-2026-0001');
  // Nieuw jaar (Spaanse tijd): 31 dec 23:30 UTC = 1 januari in Madrid
  assert.equal((await inv.issueInvoice(db, stripeInvoice({ paidAt: Math.floor(Date.parse('2026-12-31T23:30:00Z') / 1000) }))).number, 'ES-2027-0001');
  assert.equal(await inv.issueInvoice(db, stripeInvoice({ total: 0, tax: 0, net: 0 })), null, 'proef van € 0: geen factuur');
  assert.equal(await inv.issueInvoice(db, { ...stripeInvoice(), status: 'open' }), null, 'niet betaald: geen factuur');
  // Tegelijk binnen: geen dubbele nummers
  const many = await Promise.all([1, 2, 3, 4, 5].map(() => inv.issueInvoice(db, stripeInvoice())));
  assert.equal(new Set(many.map((d) => d.number)).size, 5);
  assert.deepEqual((await inv.invoicesOfYear(db, 2026)).filter((d) => d.series === 'ES').map((d) => d.number).slice(0, 3), ['ES-2026-0001', 'ES-2026-0002', 'ES-2026-0003']);
});

test('live zonder CIF: geen factuur', async () => {
  const db = memDb(), keep = process.env.INVOICE_SELLER_TAX_ID; delete process.env.INVOICE_SELLER_TAX_ID;
  await assert.rejects(inv.issueInvoice(db, stripeInvoice(), { live: true }), /CIF/);
  assert.equal(await db.getSetting('inv:seq:ES:2026'), null, 'ook geen nummer verbruikt');
  process.env.INVOICE_SELLER_TAX_ID = keep;
});

test('pdf', async () => {
  const db = memDb(), d = await inv.issueInvoice(db, stripeInvoice({ name: 'Peña & Müller S.L.' }));
  const pdf = invoicePdf(d), s = pdf.toString('latin1');
  assert.match(s, /^%PDF-1\.4/); assert.match(s, /%%EOF\n$/);
  assert.ok(s.includes('ES-2026-0001')); assert.ok(s.includes('Pe\xf1a & M\xfcller'), 'ñ en ü in WinAnsi');
  assert.ok(s.includes('12,10 \x80'), '€ als WinAnsi-teken');
  assert.ok(d.test && s.includes('PRUEBA / TEST'), 'testsleutel: duidelijk gemarkeerd als test');
  const xref = Number(s.match(/startxref\n(\d+)/)[1]); assert.equal(s.slice(xref, xref + 4), 'xref', 'verwijzing naar de tabel klopt');
  assert.equal(money(1234.5), '1.234,50 €');
});

let base, app, db; const mails = {}, invoiceMails = [];
test.before(async () => {
  app = await createApp();
  const m = app.get(MailerService);
  m.sendVerify = async (to, link) => { mails[to] = link; };
  m.sendInvoice = async (to, d, pdf) => { invoiceMails.push({ to, d, pdf }); };
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
    const buf = Buffer.from(await r.arrayBuffer()); let json = null; try { json = JSON.parse(buf.toString('utf8')); } catch (e) {}
    return { status: r.status, json, buf, type: r.headers.get('content-type') };
  };
}
function hook(event) {
  const raw = JSON.stringify(event), t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_nep').update(t + '.' + raw).digest('hex');
  return realFetch(base + '/api/billing/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=' + t + ',v1=' + sig }, body: raw });
}
async function account(email) {
  const c = client(), pw = 'Factuur test zin 9!';
  await c('POST', '/api/auth/register', { accept: true, email, password: pw, name: 'Klant' });
  await c('POST', '/api/auth/verify', { token: decodeURIComponent(mails[email].split('verify=')[1]) });
  await c('POST', '/api/auth/login', { email, password: pw });
  return { c, u: await db.userByEmail(email) };
}

test('webhook invoice.paid: factuur in Mijn account, pdf alleen voor jezelf, mail één keer', async () => {
  const { c, u } = await account('factuur-klant@example.com');
  const other = await account('ander@example.com');
  await db.setSetting('stripe:' + u.id, JSON.stringify({ customer: 'cus_u' }));
  customers.cus_u = { id: 'cus_u', email: 'factuur-klant@example.com', metadata: { uid: u.id } };
  const si = stripeInvoice({ customer: 'cus_u' });
  stripeInvoices.push({ ...si, amount_paid: 1210, number: 'L83K9HGV-0001', invoice_pdf: 'https://pay.stripe.com/x.pdf', hosted_invoice_url: 'https://invoice.stripe.com/x' });
  assert.equal((await hook({ type: 'invoice.paid', data: { object: { id: si.id, object: 'invoice', total_taxes: [] } } })).status, 200, 'melding in nieuwe API-versie: factuur wordt opnieuw opgehaald');
  assert.equal(global.__invGet, 1);
  assert.equal((await hook({ type: 'invoice.paid', data: { object: si } })).status, 200, 'herhaalde melding');
  assert.equal(invoiceMails.length, 1, 'maar één mail');
  assert.equal(invoiceMails[0].to, 'k@example.com'); assert.match(invoiceMails[0].pdf.toString('latin1'), /^%PDF/);
  const list = (await c('GET', '/api/account/invoices')).json.items;
  assert.equal(list[0].number, 'ES-2026-0001', 'ons nummer, niet dat van Stripe');
  assert.equal(list[0].pdf, 'api/account/invoices/ES-2026-0001/pdf'); assert.equal(list[0].url, null);
  const pdf = await c('GET', '/' + list[0].pdf);
  assert.equal(pdf.status, 200); assert.equal(pdf.type, 'application/pdf'); assert.match(pdf.buf.toString('latin1'), /^%PDF/);
  assert.equal((await other.c('GET', '/api/account/invoices/ES-2026-0001/pdf')).status, 404, 'niet van jou: niet te zien');
  assert.equal((await c('GET', '/api/account/invoices/..%2Fx/pdf')).status, 404);
  assert.equal((await c('GET', '/api/admin/invoices/export.csv?year=2026')).status, 403, 'export alleen voor het team');
});
