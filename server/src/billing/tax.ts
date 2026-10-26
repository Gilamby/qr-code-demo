/* =========================================================
   BTW BIJ BETALEN (Stripe Tax)
   - Particulier: de prijs is inclusief btw (wat je ziet, betaal je). Btw van het land van de klant (EU, via OSS).
   - Bedrijf: prijs + btw. Bedrijf in een ander EU-land met btw-nummer: btw verlegd (0%), Stripe zet dat op de factuur.
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
export const taxBehavior = (type?: string) => (type === 'company' ? 'exclusive' : 'inclusive');

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
export async function applyBuyer(customer: string, buyer: Buyer, email: string, name: string) {
  await stripe('POST', 'customers/' + customer, {
    name: buyer.type === 'company' ? buyer.companyName : name || undefined, email,
    address: { country: buyer.country, postal_code: buyer.postalCode || undefined, line1: buyer.address || undefined, city: buyer.city || undefined },
    metadata: { buyer: buyer.type },
  });
  const have = await stripe('GET', 'customers/' + customer + '/tax_ids', { limit: 10 });
  for (const t of have.data || []) if (buyer.type !== 'company' || String(t.value).toUpperCase() !== buyer.vat) await stripe('DELETE', 'customers/' + customer + '/tax_ids/' + t.id, {}).catch(() => {});
  if (buyer.type === 'company' && buyer.vat && !(have.data || []).some((t: any) => String(t.value).toUpperCase() === buyer.vat)) {
    await stripe('POST', 'customers/' + customer + '/tax_ids', { type: EU.includes(buyer.country) ? 'eu_vat' : buyer.country === 'GB' ? 'gb_vat' : 'eu_vat', value: buyer.vat });
  }
}
