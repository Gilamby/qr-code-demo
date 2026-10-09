/* =========================================================
   INSTELLINGEN
   - .env inlezen (KEY=waarde per regel). Variabelen die al gezet zijn (bv. door de hosting) gaan voor.
   - Mappen van het project (public/, build/, shared/, data/).
   - Het adres dat in elke QR-code komt (PUBLIC_URL, Codespaces of het wifi-adres van deze computer).
   ========================================================= */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Request } from 'express';

/** Projectmap (server/dist/config -> ../../..) */
export const ROOT = path.resolve(__dirname, '..', '..', '..');

(function loadEnv() {
  const file = process.env.ENV_FILE || path.join(ROOT, '.env');
  try {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m || line.trim().startsWith('#')) return;
      let v = m[2]; if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  } catch (e) { /* geen .env: standaardwaarden */ }
})();

export const PATHS = {
  public: path.join(ROOT, 'public'),
  build: path.join(ROOT, 'build'),
  shared: path.join(ROOT, 'shared'),
  locales: path.join(ROOT, 'public', 'locales'),
  data: process.env.DATA_DIR || path.join(ROOT, 'server', 'data'),
};

export const PORT = (): number => +process.env.PORT || 3000;
export const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/** Gedeelde code met de frontend (UMD-bestanden in shared/) */
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const shared = (name: string): any => require(path.join(PATHS.shared, name));

/** TRUST_PROXY: "true" (alles), een getal (aantal proxy's, bv. 1 bij Railway/Render) of IP-adressen/"loopback". */
export function trustProxy(): boolean | number | string {
  const tp = String(process.env.TRUST_PROXY || 'loopback').trim();
  return tp === 'true' ? true : tp === 'false' ? false : /^\d+$/.test(tp) ? +tp : tp;
}

/* ---------- Het adres in de QR-codes ----------
   Een telefoon moet het kunnen openen:
   1. PUBLIC_URL uit .env (live: bv. https://qr.optimasys.com)
   2. GitHub Codespaces: https://<naam>-<poort>.app.github.dev
   3. Geopend op "localhost": het wifi-adres van deze computer (telefoon op hetzelfde wifi)
   4. anders het adres waarmee de app geopend is */

/** Het wifi-adres van deze computer; virtuele netwerken (WSL, Docker, VPN …) slaan we over. */
export function lanIp(): string {
  const VIRTUAL = /vethernet|virtualbox|vmware|vbox|docker|wsl|hyper-v|tailscale|zerotier|utun|tun|tap|loopback|bridge|br-|veth/i;
  const list: string[] = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) for (const a of addrs || []) {
    if (a.family !== 'IPv4' && (a.family as unknown) !== 4) continue;
    if (a.internal || /^169\.254\./.test(a.address) || VIRTUAL.test(name)) continue;
    list.push(a.address);
  }
  const rank = (ip: string) => (/^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return list.sort((x, y) => rank(x) - rank(y))[0] || '';
}
export const codespaceHost = (): string => (process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  ? process.env.CODESPACE_NAME + '-' + PORT() + '.' + process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN : '');
export const codespaceUrl = (): string => (codespaceHost() ? 'https://' + codespaceHost() : '');

const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/i;
export function baseUrl(req: Request): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  if (codespaceUrl()) return codespaceUrl();
  const host = req.get('host') || '';
  if (LOCAL.test(host)) { const ip = lanIp(), port = (host.match(/:(\d+)$/) || [])[1]; if (ip) return req.protocol + '://' + ip + (port ? ':' + port : ''); }
  return req.protocol + '://' + host;
}
/** Kan een telefoon dit adres openen? (niet bij localhost zonder wifi-adres) */
export const phoneReachable = (base: string): boolean => !/^https?:\/\/(localhost|127\.|\[::1\])/i.test(base);
