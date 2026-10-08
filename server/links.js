/* Links: website controleren (titel ophalen) en de regels bij het scannen
   (wachtwoord, vervaldatum, max. scans, link per toestel, Google Analytics-labels). */
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');

/* ---------- Wachtwoord veilig bewaren (nooit als leesbare tekst) ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPassword(pw, stored) {
  const [, salt, hash] = String(stored).split('$');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex'), b = crypto.scryptSync(String(pw), salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- Website controleren ----------
   Haalt de pagina op en leest de titel. Alleen openbare adressen: interne netwerken
   (localhost, 10.x, 192.168.x, ...) worden geweigerd, zodat niemand via ons de server van binnenuit kan bekijken. */
function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}
async function assertPublic(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('protocol');
  if (u.hostname === 'localhost' || u.hostname.endsWith('.local')) throw new Error('private');
  const host = u.hostname.replace(/^\[|\]$/g, '');                 // IPv6 staat tussen [ ]
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error('private');
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

async function urlInfo(url) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {                       // redirects zelf volgen, elke stap opnieuw controleren
    await assertPublic(current);
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 6000);
    let res;
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

/* ---------- Regels bij het scannen ---------- */
function isExpired(q, today = new Date().toISOString().slice(0, 10)) {
  const c = q.content || {};
  if (c.expires && today > c.expires) return true;
  if (c.maxScans && q.scans >= Number(c.maxScans)) return true;
  return false;
}
function targetUrl(q, userAgent = '') {
  const c = q.content || {};
  let url = c.url;
  if (/iPhone|iPad|iPod/i.test(userAgent) && c.iosUrl) url = c.iosUrl;
  else if (/Android/i.test(userAgent) && c.androidUrl) url = c.androidUrl;
  if (c.utm && url) {
    const u = new URL(url);
    const campaign = (c.title || q.id).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || q.id;
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'qr');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'qr_code');
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', campaign);
    url = u.href;
  }
  return url;
}

/* ---------- Kleine pagina's voor de bezoeker (wachtwoord, verlopen) ---------- */
const TEXT = {
  nl: { locked: 'Deze pagina is beveiligd', enter: 'Vul het wachtwoord in om verder te gaan.', open: 'Openen', wrong: 'Onjuist wachtwoord. Probeer het opnieuw.', expired: 'Deze QR-code is verlopen', expiredText: 'Deze code is niet meer geldig. Neem contact op met de eigenaar.' },
  en: { locked: 'This page is protected', enter: 'Enter the password to continue.', open: 'Open', wrong: 'Wrong password. Please try again.', expired: 'This QR code has expired', expiredText: 'This code is no longer valid. Please contact the owner.' }
};
const lang = (req) => (/^nl/i.test(req.get('accept-language') || '') ? 'nl' : 'en');
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
function page(title, body) {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f4f7;font:16px -apple-system,system-ui,sans-serif;color:#111}' +
    'main{width:min(360px,88vw);background:#fff;border-radius:20px;padding:28px 24px;box-shadow:0 20px 50px -20px rgba(0,0,0,.25);text-align:center}' +
    '.ic{width:56px;height:56px;margin:0 auto 14px;border-radius:16px;background:#eef6fd;color:#0b8fd8;display:grid;place-items:center;font-size:26px}' +
    'h1{font-size:20px;margin:0 0 6px}p{margin:0 0 18px;color:#5b6472;font-size:14.5px;line-height:1.45}' +
    'input{width:100%;box-sizing:border-box;height:48px;border:1px solid #d6dbe1;border-radius:12px;padding:0 14px;font-size:16px;margin-bottom:10px}' +
    'button{width:100%;height:48px;border:0;border-radius:12px;background:#0b8fd8;color:#fff;font-weight:700;font-size:16px}.err{color:#d33a2c;font-size:14px;margin:-4px 0 10px}</style></head>' +
    '<body><main>' + body + '</main></body></html>';
}
function passwordPage(req, wrong) {
  const t = TEXT[lang(req)];
  return page(t.locked, '<div class="ic">🔒</div><h1>' + t.locked + '</h1><p>' + t.enter + '</p><form method="post">' +
    '<input type="text" name="username" autocomplete="username" value="" style="position:absolute;left:-9999px" tabindex="-1" aria-hidden="true"><input type="password" name="password" autocomplete="current-password" autofocus required>' + (wrong ? '<div class="err">' + t.wrong + '</div>' : '') + '<button>' + t.open + '</button></form>');
}
function expiredPage(req) { const t = TEXT[lang(req)]; return page(t.expired, '<div class="ic">⌛</div><h1>' + t.expired + '</h1><p>' + t.expiredText + '</p>'); }

module.exports = { hashPassword, checkPassword, urlInfo, isExpired, targetUrl, passwordPage, expiredPage };
