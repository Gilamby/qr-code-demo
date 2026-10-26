/* =========================================================
   FACTUURGEGEVENS (Mijn account > Facturatie)
   Bedrijf of particulier. Wordt gebruikt op facturen zodra er betaalde abonnementen zijn.
   Verplicht: bij een bedrijf de bedrijfsnaam, bij een particulier voor- en achternaam;
   altijd adres, postcode, plaats en land. Btw-nummer en factuur-e-mail zijn optioneel.
   ========================================================= */
import { EMAIL } from '../qr-codes/validation';
import type { Billing } from '../types';

const text = (v: unknown, max: number) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

export function validateBilling(body: any): { errors: string[]; value?: Billing } {
  const b = body || {}, errors: string[] = [];
  const type = b.type === 'private' ? 'private' : b.type === 'company' ? 'company' : null;
  if (!type) errors.push('type');
  const v: Billing = {
    type: type || 'company',
    companyName: type === 'company' ? text(b.companyName, 120) : '',
    taxId: type === 'company' ? text(b.taxId, 24).toUpperCase().replace(/[\s.]/g, '') : '',
    firstName: type === 'company' ? '' : text(b.firstName, 60),   // bedrijf: alleen bedrijfsnaam, geen persoonsnaam
    lastName: type === 'company' ? '' : text(b.lastName, 60),
    email: text(b.email, 254).toLowerCase(),
    address: text(b.address, 160),
    postalCode: text(b.postalCode, 12).toUpperCase(),
    city: text(b.city, 80),
    country: text(b.country, 3).toUpperCase(),
  };
  if (type === 'company' && !v.companyName) errors.push('companyName');
  if (type === 'private' && !v.firstName) errors.push('firstName');
  if (type === 'private' && !v.lastName) errors.push('lastName');
  // Btw-nummer: landcode + 2 tot 15 letters/cijfers (bv. NL123456789B01, ESB12345678); leeg mag
  if (v.taxId && !/^[A-Z]{2}[A-Z0-9-]{2,15}$/.test(v.taxId)) errors.push('taxId');
  if (v.email && !EMAIL.test(v.email)) errors.push('email');
  if (!v.address) errors.push('address');
  if (!/^[A-Z0-9][A-Z0-9 -]{1,11}$/.test(v.postalCode)) errors.push('postalCode');
  if (!v.city) errors.push('city');
  if (!/^[A-Z]{2}$/.test(v.country)) errors.push('country');
  return errors.length ? { errors } : { errors, value: v };
}
