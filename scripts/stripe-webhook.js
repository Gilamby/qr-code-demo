#!/usr/bin/env node
/* =========================================================
   Stripe-webhook voor de facturen en abonnementen (QR-Codex én Flexichat, zelfde Stripe-account).
   Draai op de server als qrgen, NA het zetten van de nieuwe STRIPE_SECRET_KEY in ~/qr-app/.env:
       node scripts/stripe-webhook.js            (testmodus)
       node scripts/stripe-webhook.js --live     (live-sleutel: alleen met --live)
   Wat het doet (veilig om vaker te draaien):
   - Zoekt de webhook naar https://my.qr-codex.com/api/billing/webhook (of WEBHOOK_URL=...).
   - Bestaat hij niet: maakt hem aan en zet de geheime ondertekensleutel als STRIPE_WEBHOOK_SECRET in .env.
     De sleutel wordt nooit getoond.
   - Bestaat hij al: controleert de meldingen en vult ontbrekende aan. De sleutel staat dan al in .env
     (anders in Stripe > Developers > Webhooks > "Signing secret" opnieuw maken en dit script met --new draaien).
   Daarna de app herstarten: bash scripts/start-server.sh
   ========================================================= */
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const live = args.includes('--live'), fresh = args.includes('--new');
const ENV = process.env.ENV_FILE || path.join(os.homedir(), 'qr-app', '.env');
const URL_ = process.env.WEBHOOK_URL || 'https://my.qr-codex.com/api/billing/webhook';
const EVENTS = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid'];
const VERSION = '2026-09-30.endive';

const text = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
const m = text.match(/^\s*STRIPE_SECRET_KEY\s*=\s*["']?([^"'\s#]+)/m);
const KEY = m ? m[1] : '';
if (!/^sk_(test|live)_/.test(KEY)) { console.error('Geen STRIPE_SECRET_KEY in ' + ENV); process.exit(1); }
if (KEY.startsWith('sk_live_') && !live) { console.error('Dit is een LIVE-sleutel. Draai opnieuw met --live.'); process.exit(1); }
if (!KEY.startsWith('sk_live_') && live) { console.error('--live gevraagd, maar de sleutel in .env is een testsleutel.'); process.exit(1); }
console.log('Stripe: ' + (live ? 'LIVE' : 'testmodus') + ' · webhook ' + URL_);

function form(obj, prefix = '', out = []) {
  for (const k of Object.keys(obj || {})) {
    const v = obj[k], key = prefix ? prefix + '[' + k + ']' : k;
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x, i) => out.push(encodeURIComponent(key + '[' + i + ']') + '=' + encodeURIComponent(String(x))));
    else if (typeof v === 'object') form(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}
async function stripe(method, p, params) {
  const q = method === 'GET' && params ? '?' + form(params) : '';
  const r = await fetch('https://api.stripe.com/v1/' + p + q, { method, headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': VERSION }, body: method === 'GET' ? undefined : form(params || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || 'Stripe ' + r.status);
  return j;
}
function saveSecret(secret) {
  let t = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
  if (/^\s*STRIPE_WEBHOOK_SECRET\s*=.*$/m.test(t)) t = t.replace(/^\s*STRIPE_WEBHOOK_SECRET\s*=.*$/m, 'STRIPE_WEBHOOK_SECRET=' + secret);
  else t = t.replace(/\n?$/, '\n') + 'STRIPE_WEBHOOK_SECRET=' + secret + '\n';
  fs.writeFileSync(ENV, t, { mode: 0o600 });
}

(async () => {
  const list = await stripe('GET', 'webhook_endpoints', { limit: 100 });
  let hook = (list.data || []).find((w) => w.url === URL_ && w.status !== 'disabled');
  if (hook && fresh) { await stripe('DELETE', 'webhook_endpoints/' + hook.id); hook = null; console.log('Oude webhook verwijderd (--new).'); }
  if (!hook) {
    const made = await stripe('POST', 'webhook_endpoints', { url: URL_, enabled_events: EVENTS, api_version: VERSION, description: 'OptimaSys: abonnementen en facturen (QR-Codex en Flexichat)' });
    if (!made.secret) throw new Error('Stripe gaf geen ondertekensleutel terug');
    saveSecret(made.secret);
    console.log('Webhook aangemaakt. STRIPE_WEBHOOK_SECRET staat in ' + ENV + ' (niet getoond).');
  } else {
    const missing = EVENTS.filter((e) => !(hook.enabled_events || []).includes(e) && !(hook.enabled_events || []).includes('*'));
    if (missing.length) { await stripe('POST', 'webhook_endpoints/' + hook.id, { enabled_events: [...new Set([...(hook.enabled_events || []), ...missing])] }); console.log('Meldingen aangevuld: ' + missing.join(', ')); }
    else console.log('Webhook bestaat al en is compleet.');
    if (!/^\s*STRIPE_WEBHOOK_SECRET\s*=\s*whsec_/m.test(fs.readFileSync(ENV, 'utf8'))) console.log('LET OP: geen STRIPE_WEBHOOK_SECRET in .env. Draai opnieuw met --new' + (live ? ' --live' : '') + '.');
  }
  console.log('Klaar. Herstart de app: bash scripts/start-server.sh');
})().catch((e) => { console.error('Mislukt: ' + e.message); process.exit(1); });
