/* =========================================================
   GRATIS ONLINE (voor testen en presenteren)
   npm run share
   Start de app op je laptop én een gratis Cloudflare-tunnel. Je krijgt een https-adres
   (bv. https://iets-willekeurigs.trycloudflare.com) dat overal werkt: andere wifi, 4G.
   Dat adres komt in alle QR-codes.

   Let op:
   - Laat dit venster open; sluit je het (of gaat de laptop slapen), dan werken de codes even niet.
   - Elke keer dat je dit start, krijg je een NIEUW adres. Codes van een vorige keer werken dan niet meer.
     Voor een vast adres: eigen domein + Cloudflare named tunnel, of echte hosting (zie docs/installatie.md).
   - Geen account, geen creditcard, geen kosten.
   ========================================================= */
const fs = require('fs');
const { bin, install, Tunnel } = require('cloudflared');
const { createApp } = require('../server/dist/main');

const PORT = +process.env.PORT || 3000;

(async () => {
  const app = await createApp();
  await app.listen(PORT); console.log('App draait op deze laptop: http://localhost:' + PORT);
  const server = { close: (cb) => app.close().then(cb) };
  if (!fs.existsSync(bin)) { console.log('Cloudflare-tunnel installeren (eenmalig)…'); await install(bin); }
  console.log('Tunnel openen…');
  const t = Tunnel.quick('http://localhost:' + PORT);
  t.on('error', (e) => console.error('Tunnel:', e.message));
  const url = await new Promise((resolve, reject) => {
    t.once('url', resolve);
    t.once('exit', (code) => reject(new Error('cloudflared stopte (code ' + code + ')')));
    setTimeout(() => reject(new Error('geen adres gekregen binnen 60 seconden (internet/firewall?)')), 60000).unref();
  });
  process.env.PUBLIC_URL = String(url).replace(/\/+$/, '');   // alle QR-codes wijzen nu naar dit adres
  await new Promise((r) => { t.once('connected', r); setTimeout(r, 15000).unref(); });
  const line = '='.repeat(64);
  console.log('\n' + line + '\n  Je app staat online op:\n\n    ' + process.env.PUBLIC_URL + '\n\n  Open dit adres op je laptop, maak een QR-code en scan hem met je telefoon.' +
    '\n  Werkt ook via 4G. Laat dit venster open.\n  Nieuwe keer starten = nieuw adres (oude codes werken dan niet meer).\n' + line + '\n');
  const stop = () => { try { t.stop(); } catch (e) {} server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  t.on('exit', (code) => { console.error('De tunnel is gestopt (code ' + code + '). Start opnieuw met: npm run share'); });
})().catch((e) => { console.error('Kon de tunnel niet starten:', e.message); process.exit(1); });
