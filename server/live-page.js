/* =========================================================
   ECHTE PAGINA VOOR DE BEZOEKER (na het scannen)
   Gebruikt precies dezelfde sjablonen als de telefoon in de tool (public/js/phone-templates.js),
   zodat wat de klant in de tool ziet ook echt is wat de bezoeker krijgt.
   ========================================================= */
const LANGS = ['nl', 'en', 'de', 'es', 'fr', 'it', 'pl', 'pt', 'el', 'sq'];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const HEX = /^#[0-9a-f]{6}$/i;

// Taal van de bezoeker (uit de browser), anders Engels
function visitorLang(req) {
  const list = String(req.get('accept-language') || '').split(',').map((x) => x.trim().slice(0, 2).toLowerCase());
  return list.find((l) => LANGS.includes(l)) || 'en';
}
function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ink = (c) => (luminance(c) > 0.42 ? '#14161a' : '#ffffff');

// Bestanden (PDF/MP3) gaan niet mee in de pagina zelf, alleen naam + grootte + een link om ze op te halen
function publicContent(q, type) {
  const out = {};
  for (const f of type.fields) {
    let v = q.content[f.key];
    if (v == null || f.key === 'password') continue;
    if (f.type === 'file') {
      try { const o = JSON.parse(v); v = JSON.stringify({ n: o.n, s: o.s, url: o.d || o.f ? 'q/' + q.id + '/file/' + f.key + (q.content.password ? '?t=' + require('./links').fileToken(q, f.key) : '') : '' }); } catch (e) { continue; }
    }
    out[f.key] = v;
  }
  return out;
}

function livePage(req, q, type) {
  const d = q.design || {};
  const pc = HEX.test(d.pageColor || '') ? d.pageColor : (type.theme || ['#2bb5f0'])[0];
  const ac = HEX.test(d.accentColor || '') ? d.accentColor : (type.theme || ['', '#0f172a'])[1];
  const content = publicContent(q, type);
  const title = content.title || content.name || content.restaurant || content.appName || content.pageName || 'QR';
  const data = JSON.stringify({ id: q.id, typeId: q.typeId, content, lang: visitorLang(req) }).replace(/</g, '\\u003c');
  const js = ['js/i18n.js', 'js/config.js', 'js/qr-render.js', 'js/preview.js', 'js/business-fields.js', 'js/content-fields.js', 'js/phone-templates.js', 'js/live.js'];
  return '<!doctype html><html lang="' + visitorLang(req) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<base href="/"><title>' + esc(title) + '</title><meta name="theme-color" content="' + pc + '">' +
    '<link rel="stylesheet" href="css/fonts.css">' + (bundle ? '<link rel="stylesheet" href="' + bundle.liveCss + '">' : '<link rel="stylesheet" href="css/app.css"><link rel="stylesheet" href="css/live.css">') + '</head>' +
    '<body class="live-body"><main id="live" class="live" style="--pc:' + pc + ';--pc-ink:' + ink(pc) + ';--ac:' + ac + ';--ac-ink:' + ink(ac) + '"></main>' +
    '<script>window.LIVE=' + data + ';</script>' +
    (bundle ? '<script src="' + bundle.live + '"></script>'                    // productie: één gecomprimeerd bestand
      : '<script src="vendor/qrcode.js"></script><script src="shared/qr-types.js"></script>' + js.map((s) => '<script src="' + s + '"></script>').join('')) + '</body></html>';
}

// Bestand ophalen: /q/:id/file/:key
async function sendFile(res, q, key) {
  let o = null; try { o = JSON.parse(q.content[key]); } catch (e) {}
  // Bestand op schijf (nieuw)
  if (o && o.f) {
    const f = await require('./db').getFile(o.f);
    if (!f || f.code_id !== q.id) return res.status(404).send('File not found');
    res.set('Content-Type', f.mime).set('X-Content-Type-Options', 'nosniff').set('Cache-Control', 'private, max-age=3600');
    res.set('Content-Disposition', 'inline; filename="' + String(o.n || f.name || 'file').replace(/[^\w.\- ]/g, '_') + '"');
    return res.sendFile(f.path, (err) => { if (err && !res.headersSent) res.status(404).send('File not found'); });
  }
  // Oud: als data-URL in de inhoud
  const m = o && typeof o.d === 'string' && o.d.match(/^data:([\w/.+-]+);base64,(.*)$/);
  if (!m) return res.status(404).send('File not found');
  res.set('Content-Type', m[1]);
  res.set('Content-Disposition', 'inline; filename="' + String(o.n || 'file').replace(/[^\w.\- ]/g, '_') + '"');
  res.send(Buffer.from(m[2], 'base64'));
}

// Productie: namen van de gecomprimeerde bestanden (build/manifest.json), zie server/index.js
let bundle = null;
function useBundle(m) { bundle = m; }

module.exports = { livePage, sendFile, visitorLang, useBundle };
