/* =========================================================
   EIGEN DOMEIN (Business): korte links als https://qr.jouwmerk.nl/q/abc in plaats van my.qr-codex.com/q/abc
   - De klant maakt bij zijn domeinbeheer een CNAME: qr.jouwmerk.nl → CUSTOM_DOMAIN_TARGET (bv. domains.qr-codex.com).
   - Met Cloudflare for SaaS (CF_API_TOKEN + CF_ZONE_ID) regelt Cloudflare het https-certificaat; anders kijken we alleen
     naar de DNS en moet de server zelf het certificaat regelen (bv. Caddy "on demand", vraagt /api/domains/ask).
   - Staat CUSTOM_DOMAIN_TARGET niet in .env, dan is de functie uit (niet zichtbaar in de app).
   - Op een eigen domein werken alleen de QR-codes van die klant (/q/…) en bestanden voor die pagina's; de app zelf niet.
   Opslag: instelling "domains" = { host: { uid, state, cf, at } }  (state: pending | active)
   ========================================================= */
import * as dns from 'dns/promises';

export type DomainRec = { uid: string; state: 'pending' | 'active'; cf?: string; at: string; error?: string };
type Db = { getSetting(k: string): Promise<string | null>; setSetting(k: string, v: string | null): Promise<unknown> };

export const target = () => String(process.env.CUSTOM_DOMAIN_TARGET || '').trim().toLowerCase().replace(/\.$/, '');
export const domainsOn = () => !!target();
const cfOn = () => !!(process.env.CF_API_TOKEN && process.env.CF_ZONE_ID);

let map: Record<string, DomainRec> = {}, loaded = false;
export async function loadDomains(db: Db) { try { map = JSON.parse((await db.getSetting('domains')) || '{}') || {}; } catch { map = {}; } loaded = true; return map; }
async function save(db: Db) { await db.setSetting('domains', JSON.stringify(map)); }

/** Geldige naam: altijd een subdomein (qr.jouwmerk.nl), want een CNAME op het hoofddomein kan meestal niet */
export function normHost(v: unknown): string | null {
  const h = String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
  if (!/^(?=.{4,200}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.){2,}[a-z]{2,24}$/.test(h)) return null;
  if (h === target() || /(^|\.)qr-codex\.com$/.test(h) || /(^|\.)optimasys\./.test(h)) return null;   // niet ons eigen domein
  return h;
}
/** Bij een binnenkomend verzoek: is dit een (actief) eigen domein? Dan de eigenaar. */
export function ownerOfHost(host: string): string | null { const r = map[String(host || '').toLowerCase()]; return r && r.state === 'active' ? r.uid : null; }
export function isCustomHost(host: string) { return !!map[String(host || '').toLowerCase()]; }
/** Actief domein van een gebruiker (voor de korte links) */
export function hostOf(uid: string): string | null { for (const h of Object.keys(map)) if (map[h].uid === uid && map[h].state === 'active') return h; return null; }
export function recOf(uid: string): [string, DomainRec] | null { for (const h of Object.keys(map)) if (map[h].uid === uid) return [h, map[h]]; return null; }

/* ---------- Cloudflare for SaaS (optioneel) ---------- */
async function cf(method: string, path: string, body?: unknown) {
  const r = await fetch('https://api.cloudflare.com/client/v4/zones/' + process.env.CF_ZONE_ID + '/custom_hostnames' + path, {
    method, headers: { Authorization: 'Bearer ' + process.env.CF_API_TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || 'cloudflare ' + r.status);
  return j.result;
}

/** Domein toevoegen (één per account): opslaan als "pending"; bij Cloudflare aanmelden als dat aan staat */
export async function addDomain(db: Db, uid: string, host: string) {
  if (!loaded) await loadDomains(db);
  const cur = map[host]; if (cur && cur.uid !== uid) return { error: 'taken' };
  const old = recOf(uid); if (old && old[0] !== host) await removeDomain(db, uid);
  const rec: DomainRec = { uid, state: 'pending', at: new Date().toISOString() };
  if (cfOn()) { try { const r = await cf('POST', '', { hostname: host, ssl: { method: 'http', type: 'dv' } }); rec.cf = r.id; } catch (e) { return { error: 'cloudflare', message: (e as Error).message }; } }
  map[host] = rec; await save(db);
  return { ok: true };
}
export async function removeDomain(db: Db, uid: string) {
  if (!loaded) await loadDomains(db);
  const r = recOf(uid); if (!r) return;
  if (r[1].cf && cfOn()) await cf('DELETE', '/' + r[1].cf).catch(() => {});
  delete map[r[0]]; await save(db);
}
/** Controleren: wijst de CNAME naar ons (en is het certificaat bij Cloudflare klaar)? Dan "active". */
export async function checkDomain(db: Db, uid: string) {
  if (!loaded) await loadDomains(db);
  const r = recOf(uid); if (!r) return null;
  const [host, rec] = r;
  let dnsOk = false;
  try { const c = await dns.resolveCname(host); dnsOk = c.some((x) => x.toLowerCase().replace(/\.$/, '') === target()); } catch { dnsOk = false; }
  let sslOk = !cfOn();
  if (cfOn() && rec.cf) { try { const x = await cf('GET', '/' + rec.cf); sslOk = x.status === 'active' && x.ssl && x.ssl.status === 'active'; if (x.status === 'active') dnsOk = true; } catch { sslOk = false; } }
  const before = rec.state;
  rec.state = dnsOk && sslOk ? 'active' : 'pending'; rec.error = dnsOk ? (sslOk ? undefined : 'ssl') : 'dns';
  if (rec.state !== before || rec.error) { rec.at = new Date().toISOString(); await save(db); }
  return { host, state: rec.state, error: rec.error };
}
/** Onderhoud: domeinen die nog wachten af en toe opnieuw controleren */
export async function domainSweep(db: Db) {
  if (!domainsOn()) return; await loadDomains(db);
  for (const h of Object.keys(map)) if (map[h].state === 'pending') await checkDomain(db, map[h].uid).catch(() => null);
}
