/* =========================================================
   CLOUDFLARE TURNSTILE: "ben je een mens?" bij Account maken en Wachtwoord vergeten
   Aan zodra beide sleutels in .env staan (TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY); anders verandert er niets.
   De app toont het vakje van Cloudflare; de server controleert het token bij Cloudflare (siteverify).
   Privacy: we sturen geen IP-adres mee (remoteip is optioneel).
   Cloudflare niet bereikbaar: niet blokkeren (de limieten per uur blijven gelden), wel loggen.
   ========================================================= */
export const turnstileSiteKey = () => (process.env.TURNSTILE_SECRET_KEY ? String(process.env.TURNSTILE_SITE_KEY || '').trim() : '');
export const turnstileOn = () => !!turnstileSiteKey();

export async function turnstileOk(token: unknown, f: typeof fetch = fetch): Promise<boolean> {
  if (!turnstileOn()) return true;
  const t = String(token || '');
  if (!t || t.length > 2048) return false;
  try {
    const r = await f('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: String(process.env.TURNSTILE_SECRET_KEY), response: t }).toString(),
      signal: AbortSignal.timeout(5000),
    });
    const j: any = await r.json().catch(() => ({}));
    return !!(j && j.success);
  } catch (e) {
    console.error('Turnstile niet bereikbaar, doorgelaten:', (e as Error).message);
    return true;
  }
}
