/* =========================================================
   BTW BIJ BETALEN (Stripe Tax)
   - Particulier: de prijs is inclusief btw (wat je ziet, betaal je). Btw van het land van de klant (EU, via OSS).
   - Bedrijf: prijs + btw. Bedrijf in een ander EU-land met een btw-nummer dat GELDIG is in VIES: btw verlegd (0%).
     Het nummer wordt vóór het betalen bij VIES (Europese Commissie) gecontroleerd; niet geldig = niet verder.
     Spaans bedrijf: + 21%. Buiten de EU: meestal geen Spaanse btw.
   Stripe Tax rekent het uit zodra het in het Stripe-dashboard aanstaat (Instellingen > Belastingen). Staat het uit,
   dan betaalt iedereen de getoonde prijs (zoals hiervoor).
   ========================================================= */
import { stripe } from './stripe';

export const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
export type Buyer = { type: 'private' | 'company'; country: string; postalCode: string; companyName: string; vat: string; address: string; city: string };
const text = (v: unknown, max: number) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

/** Gegevens van de koper uit het betaalscherm controleren. Bedrijf: naam, land en adres verplicht; btw-nummer verplicht binnen de EU. */
export function readBuyer(b: any): { errors: string[]; buyer?: Buyer } {
  const x = b || {}, errors: string[] = [];
  const type = x.type === 'company' ? 'company' : 'private', country = text(x.country, 2).toUpperCase();
  const buyer: Buyer = { type, country, postalCode: text(x.postalCode, 12).toUpperCase(), companyName: type === 'company' ? text(x.companyName, 120) : '',
    vat: type === 'company' ? text(x.vat, 24).toUpperCase().replace(/[\s.\-]/g, '') : '', address: text(x.address, 160), city: text(x.city, 80) };
  if (!/^[A-Z]{2}$/.test(country)) errors.push('country');
  if (country === 'ES' && !/^\d{5}$/.test(buyer.postalCode)) errors.push('postalCode');   // nodig voor Canarias/Ceuta/Melilla (geen IVA)
  if (BLOCKED.includes(country)) errors.push('blocked');
  else if (type === 'private' && /^[A-Z]{2}$/.test(country) && !privateAllowed(country)) errors.push('nonEuB2c');
  else if (type === 'private' && /^(35|38|51|52)\d{3}$/.test(buyer.postalCode) && country === 'ES' && !esSpecialB2cAllowed()) errors.push('esB2c');
  if (type === 'company') {
    if (!buyer.companyName) errors.push('companyName');
    if (!buyer.address) errors.push('address');
    if (!buyer.city) errors.push('city');
    if (EU.includes(country) && !buyer.vat) errors.push('vat');
    if (buyer.vat) {
      if (EU.includes(country) && !/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(buyer.vat)) errors.push('vat');
      // Griekenland gebruikt EL als voorvoegsel; anders hoort het voorvoegsel bij het land
      if (EU.includes(country) && buyer.vat.slice(0, 2) !== (country === 'GR' ? 'EL' : country)) errors.push('vat');
    }
  }
  return errors.length ? { errors } : { errors, buyer };
}
/* Canarische Eilanden (35/38), Ceuta (51) en Melilla (52) horen bij Spanje maar vallen buiten de EU-btw: geen IVA.
   Daarom vragen we in Spanje altijd de postcode en zetten we die klanten bij Stripe op 'vrijgesteld' (zeker weten, niet afhankelijk van Stripe Tax). */
/* Landen met sancties (EU/VN/VS): niet verkopen. Stripe kan daar ook niet betalen. */
export const BLOCKED = ['KP', 'IR', 'CU', 'SY', 'RU', 'BY'];
/* Particulieren op Canarias/Ceuta/Melilla: daar geldt IGIC/IPSI en moet de verkoper zich eerst bij die belastingdienst registreren.
   Tot OptimaSys dat geregeld heeft: niet aan particulieren daar verkopen (bedrijven wel, die betalen het zelf).
   Na registratie: ES_SPECIAL_B2C=allow in .env (dan wel verkopen; IGIC/IPSI aangeven via de boekhouder). */
export const esSpecialB2cAllowed = () => String(process.env.ES_SPECIAL_B2C || '').toLowerCase() === 'allow';
/* Particulieren buiten de EU: veel landen (VK, Noorwegen, Zwitserland, India, Turkije, Australië …) willen dat een buitenlandse
   verkoper zich daar registreert en btw/GST afdraagt, soms vanaf de eerste verkoop. Tot OptimaSys dat per land geregeld heeft:
   particulieren alleen in de EU (btw via OSS). Bedrijven buiten de EU wel (die rekenen de belasting zelf af).
   Land toegevoegd na registratie: PRIVATE_COUNTRIES=GB,NO in .env (en het land in Stripe Tax aanzetten). */
export const privateAllowed = (country: string) => EU.includes(country) || String(process.env.PRIVATE_COUNTRIES || '').toUpperCase().split(/[\s,]+/).includes(country);
export const esNoVat = (country: string, postalCode: string) => country === 'ES' && /^(35|38|51|52)\d{3}$/.test(postalCode || '');
export const taxBehavior = (type?: string) => (type === 'company' ? 'exclusive' : 'inclusive');

/* ---------- VIES: is het btw-nummer echt geregistreerd? ----------
   Officiële REST-dienst van de Europese Commissie. Alleen nodig voor bedrijven in een ander EU-land dan Spanje
   (daar wordt de btw verlegd). Geldige uitkomsten worden 24 uur onthouden. */
const VIES = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms/';
export type ViesResult = { state: 'valid' | 'invalid' | 'down'; date?: string; name?: string };
const viesCache = new Map<string, { at: number; r: ViesResult }>();
export const needsVies = (b: Buyer) => b.type === 'company' && !!b.vat && EU.includes(b.country) && b.country !== 'ES';
export async function checkVies(vat: string, fresh = false): Promise<ViesResult> {
  const hit = viesCache.get(vat); if (!fresh && hit && Date.now() - hit.at < 864e5) return hit.r;
  const cc = vat.slice(0, 2), num = vat.slice(2);
  let r: ViesResult = { state: 'down' };
  try {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 10000);
    const res = await fetch(VIES + encodeURIComponent(cc) + '/vat/' + encodeURIComponent(num), { headers: { Accept: 'application/json' }, signal: ctl.signal });
    clearTimeout(tm);
    const j: any = res.ok ? await res.json() : null;
    const ok = j ? (typeof j.isValid === 'boolean' ? j.isValid : j.valid) : undefined;   // GET-dienst: isValid, POST-dienst: valid
    if (ok === true) r = { state: 'valid', date: String(j.requestDate || new Date().toISOString()).slice(0, 10), name: j.name && j.name !== '---' ? String(j.name).slice(0, 120) : undefined };
    else if (ok === false && (!j.userError || j.userError === 'INVALID' || j.userError === 'VALID')) r = { state: 'invalid' };   // MS_UNAVAILABLE e.d. = niet bereikbaar
  } catch { r = { state: 'down' }; }
  if (r.state === 'valid') viesCache.set(vat, { at: Date.now(), r });
  return r;
}

/** Staat Stripe Tax aan in het dashboard? (1 minuut onthouden) */
let cache: { at: number; on: boolean } | null = null;
export async function taxOn(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 60000) return cache.on;
  let on = false;
  try { const s = await stripe('GET', 'tax/settings'); on = s && s.status === 'active'; } catch { on = false; }
  cache = { at: Date.now(), on }; return on;
}
export const forgetTax = () => { cache = null; };

/** Koper bij Stripe zetten: naam, adres (voor het juiste btw-land) en btw-nummer */
export async function applyBuyer(customer: string, buyer: Buyer, email: string, name: string, vies?: ViesResult) {
  await stripe('POST', 'customers/' + customer, {
    name: buyer.type === 'company' ? buyer.companyName : name || undefined, email,
    address: { country: buyer.country, postal_code: buyer.postalCode || undefined, line1: buyer.address || undefined, city: buyer.city || undefined },
    tax_exempt: esNoVat(buyer.country, buyer.postalCode) ? 'exempt' : 'none',
    metadata: { buyer: buyer.type, vies_checked: vies && vies.state === 'valid' ? buyer.vat + ' ' + vies.date : '' },
  });
  const have = await stripe('GET', 'customers/' + customer + '/tax_ids', { limit: 10 });
  for (const t of have.data || []) if (buyer.type !== 'company' || String(t.value).toUpperCase() !== buyer.vat) await stripe('DELETE', 'customers/' + customer + '/tax_ids/' + t.id, {}).catch(() => {});
  // Alleen EU-nummers (na VIES-controle) en Britse nummers; andere landen buiten de EU: geen Spaanse btw, nummer niet nodig
  const kind = EU.includes(buyer.country) ? 'eu_vat' : buyer.country === 'GB' ? 'gb_vat' : '';
  if (kind && buyer.type === 'company' && buyer.vat && !(have.data || []).some((t: any) => String(t.value).toUpperCase() === buyer.vat)) {
    await stripe('POST', 'customers/' + customer + '/tax_ids', { type: kind, value: buyer.vat });
  }
}
