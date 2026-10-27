/* Offline-pagina maken: public/offline.html = de 404-pagina (QR Runner) zonder internet.
   sw.js toont deze als er geen verbinding is; zodra de verbinding terug is, laadt de pagina vanzelf opnieuw.
   Alles zit in één bestand (logo als data-URI, teksten in alle talen), want offline kan niets anders geladen worden.
   Draait vanzelf bij npm run build; los: node scripts/offline-page.js */
const fs = require('fs'), path = require('path');
function build(root) {
  const pub = path.join(root, 'public');
  let html = fs.readFileSync(path.join(pub, '404.html'), 'utf8');
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(pub, 'icons', 'logo-small.png')).toString('base64');
  const K = ['start', 'startBtn', 'hint', 'lost', 'again', 'newBest', 'soundOn', 'soundOff'];
  const D = {};
  for (const f of fs.readdirSync(path.join(pub, 'locales')).filter((x) => /^[a-z]{2}\.json$/.test(x))) {
    const v = JSON.parse(fs.readFileSync(path.join(pub, 'locales', f), 'utf8')).visit || {}, l = f.slice(0, 2);
    const o = { lang: l, offline: 1, big: 'Offline', title: v.g404OffTitle, sub: v.g404OffTitle, sub2: v.g404OffSub + ' ' + v.g404OffSub2 };
    K.forEach((k) => { o[k] = v['g404' + k[0].toUpperCase() + k.slice(1)]; });
    D[l] = o;
  }
  const pick = '<script>(function(){var D=' + JSON.stringify(D).replace(/</g, '\\u003c') + ',k="en",L=(navigator.languages||[navigator.language||"en"]);' +
    'for(var i=0;i<L.length;i++){var x=String(L[i]).toLowerCase().split("-")[0];if(x==="no"||x==="nn")x="nb";if(D[x]){k=x;break}}' +
    'document.getElementById("t404").textContent=JSON.stringify(D[k])})()</script>';
  html = html.replace('<script id="t404" type="application/json">{}</script>', () => '<script id="t404" type="application/json">{}</script>\n' + pick)
    .replace('<link rel="stylesheet" href="/css/fonts.css">\n', '')
    .replace('<link rel="icon" href="/favicon.ico">', '<link rel="icon" href="' + logo + '">')
    .split('/icons/logo-badge.png').join(logo)
    .replace('<title>404 · QR-Codex</title>', '<title>Offline · QR-Codex</title>')
    .replace('<html lang="en" data-404>', '<!-- Gemaakt door scripts/offline-page.js uit 404.html: niet hier aanpassen -->\n<html lang="en" data-offline>');
  fs.writeFileSync(path.join(pub, 'offline.html'), html);
  // Nieuwe offline-pagina = nieuwe naam voor de cache in sw.js, zodat telefoons de nieuwe versie ophalen
  const h = require('crypto').createHash('sha256').update(html).digest('hex').slice(0, 10);
  const sw = path.join(pub, 'sw.js'); fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/const CACHE = 'qrc-offline-[^']*';/, "const CACHE = 'qrc-offline-" + h + "';"));
}
module.exports = { build };
if (require.main === module) build(path.join(__dirname, '..'));
