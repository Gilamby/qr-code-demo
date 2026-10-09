/* Website controleren (link-check in het formulier): bestaat hij en wat is de titel?
   Alleen openbare adressen: interne netwerken (localhost, 10.x, 192.168.x, …) worden geweigerd,
   zodat niemand via ons de server van binnenuit kan bekijken. */
import * as dns from 'dns/promises';
import * as net from 'net';

/* ---------- Website controleren ----------
   Haalt de pagina op en leest de titel. Alleen openbare adressen: interne netwerken
   (localhost, 10.x, 192.168.x, ...) worden geweigerd, zodat niemand via ons de server van binnenuit kan bekijken. */
function isPrivate(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}
async function assertPublic(url: string) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('protocol');
  if (u.hostname === 'localhost' || u.hostname.endsWith('.local')) throw new Error('private');
  const host = u.hostname.replace(/^\[|\]$/g, '');                 // IPv6 staat tussen [ ]
  const addrs: { address: string }[] = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error('private');
}
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

export async function urlInfo(url: string) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {                       // redirects zelf volgen, elke stap opnieuw controleren
    await assertPublic(current);
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 6000);
    let res: globalThis.Response;
    try { res = await fetch(current, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (OptimasysQR link check)', Accept: 'text/html' } }); }
    finally { clearTimeout(timer); }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { current = new URL(res.headers.get('location'), current).href; continue; }
    let html = '';
    if ((res.headers.get('content-type') || '').includes('text/html')) {
      const reader = res.body.getReader(); let size = 0;
      while (size < 300000) { const { done, value } = await reader.read(); if (done) break; size += value.length; html += Buffer.from(value).toString('utf8'); if (/<\/head>/i.test(html)) break; }
      reader.cancel().catch(() => {});
    }
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i);
    const tt = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    return { ok: res.status < 400, status: res.status, finalUrl: current, title: og ? decode(og[1]) : tt ? decode(tt[1]) : '' };
  }
  return { ok: false, status: 310, finalUrl: current, title: '' };
}

