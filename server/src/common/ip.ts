/** IP-adres ingekort (laatste deel weg): zo bewaren en tonen we het, nooit het volledige adres (AVG). Al ingekort = blijft gelijk. */
export function maskIp(ip: string | null | undefined) {
  const v = String(ip || '').replace(/^::ffff:/, '');
  if (!v) return null;
  if (v.includes('•••')) return v;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) return v.replace(/\.\d+$/, '.•••');
  return v.split(':').slice(0, 3).join(':') + ':•••';
}
