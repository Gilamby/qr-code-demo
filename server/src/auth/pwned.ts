/* =========================================================
   GELEKT WACHTWOORD? (Have I Been Pwned, "k-anonimiteit")
   We sturen alleen de eerste 5 tekens van de SHA-1-hash naar api.pwnedpasswords.com en vergelijken de rest hier.
   Het wachtwoord zelf (of de volledige hash) verlaat de server nooit.
   Niet bereikbaar of te traag (2,5 s)? Dan laten we het door: de dienst mag nooit inloggen of registreren blokkeren.
   Uit met PWNED_CHECK=off (en in de tests).
   ========================================================= */
import * as crypto from 'crypto';

export async function pwnedCount(password: string, timeoutMs = 2500): Promise<number> {
  if (process.env.PWNED_CHECK === 'off' || process.env.NODE_TEST_CONTEXT || process.env.NODE_ENV === 'test') return 0;
  const sha = crypto.createHash('sha1').update(String(password)).digest('hex').toUpperCase(), pre = sha.slice(0, 5), rest = sha.slice(5);
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch('https://api.pwnedpasswords.com/range/' + pre, { headers: { 'Add-Padding': 'true', 'User-Agent': 'QR-Codex password check' }, signal: ctrl.signal });
    if (!r.ok) return 0;
    for (const line of (await r.text()).split('\n')) { const [h, n] = line.trim().split(':'); if (h === rest) return parseInt(n, 10) || 0; }
    return 0;
  } catch (e) { return 0; } finally { clearTimeout(timer); }
}
