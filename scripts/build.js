/* Productieversie bouwen: alle JavaScript en CSS samengevoegd en gecomprimeerd (moeilijk leesbaar in Inspecteren).
   Gebruik: npm run build  ->  build/  (de server gebruikt dit automatisch als NODE_ENV=production)
   - build/index.html          de app, met één script en één stylesheet
   - build/app.<hash>.js/.css  alles samen, zonder uitleg, spaties of lange namen
   - build/live.<hash>.js      voor de bezoekerspagina na het scannen
   Bestandsnamen bevatten een hash: na een nieuwe versie haalt elke browser meteen de nieuwe op. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..'), pub = path.join(root, 'public'), out = path.join(root, 'build');
const read = (src) => fs.readFileSync(src.startsWith('shared/') ? path.join(root, src) : path.join(pub, src), 'utf8');
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);
const minJs = (code) => esbuild.transformSync(code, { minify: true, legalComments: 'none', target: 'es2018', charset: 'utf8' }).code;   // globale namen blijven, de rest wordt kort
const minCss = (code) => esbuild.transformSync(code, { loader: 'css', minify: true, legalComments: 'none', charset: 'utf8' }).code;

fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });

// 1) De app
let html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>\n?/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
const js = minJs(scripts.map((s) => '/* ' + s + ' */\n' + read(s)).join('\n;\n'));
const css = minCss(read('css/app.css'));
const jsName = 'app.' + hash(js) + '.js', cssName = 'app.' + hash(css) + '.css';
fs.writeFileSync(path.join(out, jsName), js); fs.writeFileSync(path.join(out, cssName), css);
html = html.replace(/<!--[\s\S]*?-->\n?/g, '')                                         // geen uitleg in de HTML
  .replace(/<script src="(?!https?:)[^"]+"><\/script>\n?/g, '')
  .replace('</body>', '<script src="' + jsName + '"></script>\n</body>')
  .replace(/<link rel="stylesheet" href="css\/app\.css">/, '<link rel="stylesheet" href="' + cssName + '">');
fs.writeFileSync(path.join(out, 'index.html'), html);

// 2) De bezoekerspagina (zelfde lijst als server/live-page.js)
const LIVE = ['vendor/qrcode.js', 'shared/qr-types.js', 'js/i18n.js', 'js/config.js', 'js/qr-render.js', 'js/preview.js', 'js/business-fields.js', 'js/content-fields.js', 'js/phone-templates.js', 'js/live.js'];
const live = minJs(LIVE.map(read).join('\n;\n')), liveCss = minCss(read('css/app.css') + '\n' + read('css/live.css'));
const liveName = 'live.' + hash(live) + '.js', liveCssName = 'live.' + hash(liveCss) + '.css';
fs.writeFileSync(path.join(out, liveName), live); fs.writeFileSync(path.join(out, liveCssName), liveCss);

fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ app: jsName, css: cssName, live: liveName, liveCss: liveCssName, builtAt: new Date().toISOString() }, null, 2));
const kb = (s) => Math.round(Buffer.byteLength(s) / 1024) + ' KB';
console.log('Klaar: build/' + jsName + ' (' + kb(js) + '), ' + cssName + ' (' + kb(css) + '), ' + liveName + ' (' + kb(live) + ')');
