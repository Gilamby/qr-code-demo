/* =========================================================
   EIGEN FACTUREN MET REEKSEN (besluit OptimaSys, Geert 30 okt 2026)
   Stripe int het geld; wij maken de officiële factuur. Eén nummering voor QR-Codex én Flexichat (zelfde Stripe-account),
   maar een aparte reeks per soort klant:
     ES  Spanje (21% IVA). Ook particulieren in andere EU-landen: die betalen Spaanse IVA (zie tax.ts).
     UE  Bedrijf in een ander EU-land met een btw-nummer dat geldig is in VIES (btw verlegd, 0%).
     CN  Canarische Eilanden (postcode 35/38), ook Ceuta (51) en Melilla (52): geen IVA.
     EX  Buiten de EU: geen Spaanse IVA.
   Nummer: <reeks>-<jaar>-<volgnummer>, bv. ES-2026-0001. Elk jaar per reeks opnieuw vanaf 0001, zonder gaten.
   Moment: zodra Stripe meldt dat een factuur betaald is (webhook invoice.paid). Facturen van € 0 (proefperiode): geen factuur.
   Eén Stripe-factuur = één eigen factuur (ook als Stripe de melding twee keer stuurt).
   Opslag (settings): 'inv:doc:<nummer>' (de factuur), 'inv:stripe:<in_…>' → nummer, 'inv:seq:<reeks>:<jaar>' (laatste nummer),
     'inv:user:<uid>' (nummers van een QR-Codex-account), 'inv:year:<jaar>' (alle nummers van dat jaar, voor de boekhouding).
   Gegevens van OptimaSys op de factuur: INVOICE_SELLER_NAME, INVOICE_SELLER_TAX_ID (CIF), INVOICE_SELLER_ADDRESS (regels met |).
   Met een live Stripe-sleutel zonder CIF wordt géén factuur gemaakt (wel een foutmelding in de log): een factuur zonder CIF is niet geldig.
   LET OP: de wettelijke teksten per reeks (NOTES) laten controleren door de boekhouder. Vanaf 2027 geldt in Spanje Verifactu.
   ========================================================= */
import { locked } from '../common/lock';
import { EU, esNoVat, checkVies } from './tax';
import { stripe } from './stripe';

export type Series = 'ES' | 'UE' | 'CN' | 'EX';
export const SERIES: Series[] = ['ES', 'UE', 'CN', 'EX'];
type Settings = { getSetting(k: string): Promise<string | null | undefined>; setSetting(k: string, v: string | null): Promise<void> };

export type InvoiceLine = { desc: string; qty: number; unit: number; net: number; taxRate: number; tax: number };
export type InvoiceDoc = {
  number: string; series: Series; date: string; year: number; currency: string;
  seller: { name: string; taxId: string; address: string[] };
  buyer: { name: string; taxId: string; address: string[]; country: string; email: string; kind: 'company' | 'private' };
  lines: InvoiceLine[]; net: number; tax: number; total: number;
  test?: boolean;                                                  // gemaakt met een testsleutel: geen echte factuur
  note: string; stripeInvoice: string; stripeCustomer: string; uid: string | null; product: string; createdAt: string;
};

/** Wettelijke vermelding per reeks (Spaans + Engels). Door de boekhouder laten bevestigen. */
export const NOTES: Record<Series, string> = {
  ES: '',
  UE: 'Operación no sujeta al IVA español: inversión del sujeto pasivo (art. 69.Uno.1º Ley 37/1992; art. 196 Directiva 2006/112/CE). / Reverse charge: VAT to be accounted for by the recipient (Art. 196 Directive 2006/112/EC).',
  CN: 'Operación no sujeta al IVA: destinatario en Canarias, Ceuta o Melilla (art. 3 Ley 37/1992). / Not subject to Spanish VAT (Canary Islands, Ceuta, Melilla).',
  EX: 'Operación no sujeta al IVA español: destinatario establecido fuera de la Unión Europea (art. 69.Uno Ley 37/1992). / Not subject to Spanish VAT: customer outside the EU.',
};

const cents = (n: unknown) => (Number(n) || 0) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Jaar van een datum in Spanje (Europe/Madrid), zodat een betaling op 31 december 23:30 bij dat jaar hoort */
export function madridYear(d: Date) { return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Madrid' }).format(d)); }

/** Reeks voor een koper: land, postcode en of het btw-nummer geldig is in VIES */
export function seriesOf(b: { country?: string | null; postalCode?: string | null; viesValid?: boolean }): Series {
  const cc = String(b.country || 'ES').toUpperCase(), pc = String(b.postalCode || '').trim();
  if (cc === 'ES') return esNoVat('ES', pc) ? 'CN' : 'ES';
  if (EU.includes(cc)) return b.viesValid ? 'UE' : 'ES';   // EU-particulier of bedrijf zonder geldig nummer: Spaanse IVA
  return 'EX';
}

/** Voorvoegsel van een reeks: standaard ES/UE/CN/EX, aan te passen met INVOICE_SERIES_ES=… (hoofdletters/cijfers, max 8) */
export function seriesLabel(series: Series): string {
  const v = String(process.env['INVOICE_SERIES_' + series] || '').trim().toUpperCase();
  return /^[A-Z0-9]{1,8}$/.test(v) ? v : series;
}
/** Volgend nummer in een reeks voor een jaar (één tegelijk, zonder gaten).
 *  Testmodus (Stripe sk_test_): eigen teller en TEST- ervoor, zodat de echte nummering bij live gewoon bij 0001 begint.
 *  INVOICE_START_ES=15 (enz.): eerste nummer als er dit jaar al facturen buiten dit systeem waren. */
export async function nextNumber(db: Settings, series: Series, year: number, test = false): Promise<string> {
  const label = seriesLabel(series), key = 'inv:seq:' + (test ? 'test:' : '') + label + ':' + year;   // nieuw voorvoegsel = nieuwe reeks, begint bij 0001
  const start = test ? 1 : Math.max(1, Math.floor(Number(process.env['INVOICE_START_' + series]) || 1));
  const n = Math.max(Number(await db.getSetting(key)) || 0, start - 1) + 1;
  await db.setSetting(key, String(n));
  return (test ? 'TEST-' : '') + label + '-' + year + '-' + String(n).padStart(4, '0');
}
const yearKey = (year: number, test: boolean) => 'inv:year:' + (test ? 'test:' : '') + year;

async function pushList(db: Settings, key: string, value: string, max = 5000) {
  let list: string[] = [];
  try { const x = JSON.parse((await db.getSetting(key)) || '[]'); if (Array.isArray(x)) list = x; } catch { list = []; }
  if (!list.includes(value)) { list.unshift(value); await db.setSetting(key, JSON.stringify(list.slice(0, max))); }
}
async function readList(db: Settings, key: string): Promise<string[]> {
  try { const x = JSON.parse((await db.getSetting(key)) || '[]'); return Array.isArray(x) ? x.map(String) : []; } catch { return []; }
}

/** Eenmalig: facturen die vóór deze versie in testmodus zijn gemaakt, kregen een gewoon nummer (ES-2026-0001).
 *  Die krijgen nu TEST- ervoor en hun eigen teller, zodat de echte nummering bij live bij 0001 begint. */
const MIGRATED = 'inv:migr:test-numbers';
const migrating = new WeakMap<object, Promise<void>>();
function migrateTestNumbers(db: Settings): Promise<void> {
  let p = migrating.get(db as object);
  if (!p) { p = locked('invoices', () => doMigrate(db)).catch((e) => { migrating.delete(db as object); console.error('Testfacturen hernummeren mislukt:', (e as Error).message); }); migrating.set(db as object, p); }
  return p;
}
async function doMigrate(db: Settings) {
  if (await db.getSetting(MIGRATED)) return;
  const now = madridYear(new Date());
  for (let y = 2025; y <= now; y++) {
    const live = await readList(db, 'inv:year:' + y); if (!live.length) continue;
    const keep: string[] = [], seqLive: Record<string, number> = {}, seqTest: Record<string, number> = {};
    for (const num of live) {
      const m = /^([A-Z0-9]{1,8})-\d{4}-(\d{4,})$/.exec(num); let doc: InvoiceDoc | null = null;
      try { doc = JSON.parse((await db.getSetting('inv:doc:' + num)) || 'null'); } catch { doc = null; }
      if (!m || !doc || doc.test !== true) { keep.push(num); if (m) seqLive[m[1]] = Math.max(seqLive[m[1]] || 0, Number(m[2])); continue; }
      const nn = 'TEST-' + num; doc.number = nn;
      await db.setSetting('inv:doc:' + nn, JSON.stringify(doc));
      await db.setSetting('inv:doc:' + num, null);
      if (doc.stripeInvoice) await db.setSetting('inv:stripe:' + doc.stripeInvoice, nn);
      if (doc.uid) { const ul = await readList(db, 'inv:user:' + doc.uid); await db.setSetting('inv:user:' + doc.uid, JSON.stringify(ul.map((x) => (x === num ? nn : x)))); }
      await pushList(db, 'inv:year:test:' + y, nn, 100000);
      seqTest[m[1]] = Math.max(seqTest[m[1]] || 0, Number(m[2]));
    }
    await db.setSetting('inv:year:' + y, JSON.stringify(keep));
    for (const [label, n] of Object.entries(seqTest)) {
      const k = 'inv:seq:test:' + label + ':' + y; await db.setSetting(k, String(Math.max(Number(await db.getSetting(k)) || 0, n)));
      await db.setSetting('inv:seq:' + label + ':' + y, seqLive[label] ? String(seqLive[label]) : null);   // echte teller: alleen echte facturen
    }
  }
  await db.setSetting(MIGRATED, new Date().toISOString());
}

export function seller() {
  const address = String(process.env.INVOICE_SELLER_ADDRESS || 'Calle Alfredo Palma 10|29603 Marbella (Málaga)|España').split('|').map((s) => s.trim()).filter(Boolean);
  return { name: String(process.env.INVOICE_SELLER_NAME || 'OptimaSys').trim(), taxId: String(process.env.INVOICE_SELLER_TAX_ID || '').trim(), address };
}

/** Is het btw-nummer van deze klant geldig in VIES? Eerst wat wij al controleerden (metadata), dan Stripe, anders nu bij VIES. */
async function viesValid(customer: any, taxIds: any[]): Promise<{ valid: boolean; vat: string }> {
  const eu = (taxIds || []).find((t) => t && t.type === 'eu_vat' && t.value);
  if (!eu) return { valid: false, vat: '' };
  const vat = String(eu.value).toUpperCase().replace(/[\s.\-]/g, '');
  const meta = String((customer && customer.metadata && customer.metadata.vies_checked) || '');
  if (meta && meta.split(' ')[0] === vat) return { valid: true, vat };
  if (eu.verification && eu.verification.status === 'verified') return { valid: true, vat };
  const r = await checkVies(vat).catch(() => ({ state: 'down' as const }));
  if (r.state === 'down') throw new Error('VIES niet bereikbaar');   // later opnieuw (Stripe herhaalt de melding)
  return { valid: r.state === 'valid', vat };
}

/** Productnaam voor de factuur (alleen informatief): uit de regels of de metadata van het abonnement */
function productOf(inv: any): string {
  const app = inv && inv.subscription_details && inv.subscription_details.metadata && inv.subscription_details.metadata.app;
  const text = (((inv && inv.lines && inv.lines.data) || []).map((l: any) => l.description || '').join(' ') + ' ' + (app || '')).toLowerCase();
  return /flexichat/.test(text) ? 'Flexichat' : /qr-codex|qr codex/.test(text) ? 'QR-Codex' : '';
}

/** Factuur maken voor een betaalde Stripe-factuur. Geeft de factuur terug (of de al bestaande), of null als er geen nodig is. */
export async function issueInvoice(db: Settings, inv: any, opts: { live?: boolean } = {}): Promise<InvoiceDoc | null> {
  if (!inv || inv.object !== 'invoice' || !/^in_/.test(String(inv.id || ''))) return null;
  if (inv.status !== 'paid' || !(Number(inv.total) > 0)) return null;           // alleen betaald, en niet € 0 (proef)
  await migrateTestNumbers(db);
  return locked('invoices', async () => {
    const have = await db.getSetting('inv:stripe:' + inv.id);
    if (have) return readInvoice(db, have);
    const s = seller();
    const live = opts.live != null ? opts.live : /^sk_live_/.test(String(process.env.STRIPE_SECRET_KEY || ''));
    if (live && !s.taxId) throw new Error('INVOICE_SELLER_TAX_ID (CIF) ontbreekt in .env: geen factuur gemaakt voor ' + inv.id);
    const custId = typeof inv.customer === 'string' ? inv.customer : inv.customer && inv.customer.id;
    const customer = custId ? await stripe('GET', 'customers/' + custId, { 'expand[]': 'tax_ids' }).catch(() => null) : null;
    const addr = inv.customer_address || (customer && customer.address) || {};
    const taxIds = (inv.customer_tax_ids && inv.customer_tax_ids.length ? inv.customer_tax_ids : (customer && customer.tax_ids && customer.tax_ids.data) || []);
    const cc = String(addr.country || '').toUpperCase() || 'ES';
    const v = EU.includes(cc) && cc !== 'ES' ? await viesValid(customer, taxIds) : { valid: false, vat: '' };
    const series = seriesOf({ country: cc, postalCode: addr.postal_code, viesValid: v.valid });
    const anyTax = (taxIds || [])[0];
    const company = !!(v.vat || anyTax || (customer && customer.metadata && customer.metadata.buyer === 'company'));
    const paidAt = new Date(((inv.status_transitions && inv.status_transitions.paid_at) || inv.created || Date.now() / 1000) * 1000);
    const year = madridYear(paidAt);

    const lines: InvoiceLine[] = ((inv.lines && inv.lines.data) || []).map((l: any) => {
      const tax = round2(((l.tax_amounts || []) as any[]).reduce((a, t) => a + cents(t.amount), 0));
      const net = round2(l.amount_excluding_tax != null ? cents(l.amount_excluding_tax) : cents(l.amount) - ((l.tax_amounts || []).some((t: any) => t.inclusive) ? tax : 0));
      const qty = Number(l.quantity) || 1;
      return { desc: String(l.description || 'Servicio').slice(0, 200), qty, unit: round2(net / qty), net, tax, taxRate: net ? Math.round((tax / net) * 1000) / 10 : 0 };
    });
    const total = cents(inv.total);
    const tax = inv.tax != null ? cents(inv.tax) : round2(lines.reduce((a, l) => a + l.tax, 0));
    const net = inv.total_excluding_tax != null ? cents(inv.total_excluding_tax) : round2(total - tax);
    if (series !== 'ES' && tax > 0) console.error('Factuur ' + inv.id + ': reeks ' + series + ' maar er is btw gerekend (' + tax + '). Controleren.');

    const number = await nextNumber(db, series, year, !live);
    const doc: InvoiceDoc = {
      number, series, date: paidAt.toISOString(), year, currency: String(inv.currency || 'eur').toUpperCase(),
      seller: s,
      buyer: {
        name: String(inv.customer_name || (customer && customer.name) || inv.customer_email || '').slice(0, 160),
        taxId: v.vat || (anyTax ? String(anyTax.value) : ''),
        address: [addr.line1, addr.line2, [addr.postal_code, addr.city].filter(Boolean).join(' '), addr.state].filter(Boolean).map(String),
        country: cc, email: String(inv.customer_email || (customer && customer.email) || ''), kind: company ? 'company' : 'private',
      },
      lines, net, tax, total, test: !live, note: NOTES[series], stripeInvoice: inv.id, stripeCustomer: custId || '',
      uid: (customer && customer.metadata && customer.metadata.uid) || null, product: productOf(inv), createdAt: new Date().toISOString(),
    };
    await db.setSetting('inv:doc:' + number, JSON.stringify(doc));
    await db.setSetting('inv:stripe:' + inv.id, number);
    await pushList(db, yearKey(year, !live), number, 100000);
    if (doc.uid) await pushList(db, 'inv:user:' + doc.uid, number, 500);
    return doc;
  });
}

export async function readInvoice(db: Settings, number: string): Promise<InvoiceDoc | null> {
  if (!/^(TEST-)?[A-Z0-9]{1,8}-\d{4}-\d{4,}$/.test(String(number))) return null;
  try { return JSON.parse((await db.getSetting('inv:doc:' + number)) || 'null'); } catch { return null; }
}
export async function invoicesOfUser(db: Settings, uid: string): Promise<InvoiceDoc[]> {
  await migrateTestNumbers(db);
  const out: InvoiceDoc[] = [];
  for (const n of await readList(db, 'inv:user:' + uid)) { const d = await readInvoice(db, n); if (d) out.push(d); }
  return out;
}
/** Facturen van een jaar: de echte, of (test = true) die uit de testmodus */
export async function invoicesOfYear(db: Settings, year: number, test = false): Promise<InvoiceDoc[]> {
  await migrateTestNumbers(db);
  const out: InvoiceDoc[] = [];
  for (const n of await readList(db, yearKey(year, test))) { const d = await readInvoice(db, n); if (d) out.push(d); }
  return out.sort((a, b) => a.number.localeCompare(b.number));
}
export async function numberForStripe(db: Settings, stripeInvoice: string) { return (await db.getSetting('inv:stripe:' + stripeInvoice)) || null; }
