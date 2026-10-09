/* Bouwt dist/demo.html: één bestand voor de online demo (Claude-artifact), zonder server.
   CSS en JavaScript worden ingevoegd; vertalingen en afbeeldingen gaan als losse bestanden mee. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');
const out = path.join(root, 'dist');
const html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');

const title = html.match(/<title>.*?<\/title>/)[0];
// Lettertypes van onze eigen server (geen Google Fonts); in de demo staan ze als losse bestanden naast de pagina
const fonts = '<style>\n' + fs.readFileSync(path.join(pub, 'css', 'fonts.css'), 'utf8').replace(/\.\.\/fonts\//g, 'fonts/') + '\n</style>';
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<!-- Externe'));
const css = fs.readFileSync(path.join(pub, 'css', 'app.css'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const external = scripts.filter((s) => /^https?:/.test(s));
const local = scripts.filter((s) => !/^https?:/.test(s)).map((s) => {
  const file = s.startsWith('shared/') ? path.join(root, s) : path.join(pub, s);
  return '/* ---- ' + s + ' ---- */\n' + fs.readFileSync(file, 'utf8');
});
// Voorbeeldfoto's ín de demo (geen wachttijd bij het wisselen van type; zie asset() in preview.js)
const assetData = {};
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return walk(f);
    if (/\.jpe?g$/i.test(e.name)) assetData[path.relative(pub, f).split(path.sep).join('/')] = fs.readFileSync(f).toString('base64');
  });
})(path.join(pub, 'assets', 'previews'));
const en = fs.readFileSync(path.join(pub, 'locales', 'en.json'), 'utf8').replace(/<\//g, '<\\/');

const demo = [
  '<meta charset="utf-8">',
  title.replace('Optimasys QR', 'Optimasys QR Sidebar'),
  fonts,
  '<style>\n' + css + '\n</style>',
  body.trim(),
  '<script type="application/json" id="locale-en">' + en + '</script>',
  '<script type="application/json" id="asset-data">' + JSON.stringify(assetData) + '</script>',
  ...external.map((s) => '<script src="' + s + '"></script>'),
  '<script>\n' + local.join('\n') + '\n</script>'
].join('\n');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'demo.html'), demo);
fs.cpSync(path.join(pub, 'locales'), path.join(out, 'locales'), { recursive: true });
fs.cpSync(path.join(pub, 'assets'), path.join(out, 'assets'), { recursive: true });
fs.cpSync(path.join(pub, 'fonts'), path.join(out, 'fonts'), { recursive: true });
console.log('dist/demo.html gebouwd (' + Math.round(demo.length / 1024) + ' KB)');
