/* Eigen 3D bundelen: scripts/wallpaper3d/src.js (+ three.js) → public/anim/wallpaper3d.js, en het inlogscherm (login3d)
   Gebruik: node scripts/build-3d.js  (alleen nodig na een wijziging in src.js; het resultaat staat in Git)
   Zet ook het versienummer (hash) in public/js/wallpaper-anim.js, zodat browsers meteen de nieuwe versie laden. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), esbuild = require('esbuild');
const root = path.join(__dirname, '..'), out = path.join(root, 'public', 'anim', 'wallpaper3d.js');
esbuild.buildSync({ entryPoints: [path.join(__dirname, 'wallpaper3d', 'src.js')], bundle: true, minify: true, format: 'iife', target: 'es2018', outfile: out, legalComments: 'none' });
const v = crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex').slice(0, 10);
const p = path.join(root, 'public', 'js', 'wallpaper-anim.js'), s = fs.readFileSync(p, 'utf8');
fs.writeFileSync(p, s.replace(/var ANIM_VERSION = '[^']*';/, "var ANIM_VERSION = '" + v + "';"));
console.log('wallpaper3d.js: ' + Math.round(fs.statSync(out).size / 1024) + ' KB, versie ' + v);

// Inlogscherm: glazen QR-sculptuur (scripts/login3d/src.js → public/anim/login3d.js), versie in public/js/login-scene.js
const out2 = path.join(root, 'public', 'anim', 'login3d.js');
esbuild.buildSync({ entryPoints: [path.join(__dirname, 'login3d', 'src.js')], bundle: true, minify: true, format: 'iife', target: 'es2018', outfile: out2, legalComments: 'none' });
const v2 = crypto.createHash('sha256').update(fs.readFileSync(out2)).digest('hex').slice(0, 10);
const p2 = path.join(root, 'public', 'js', 'login-scene.js');
if (fs.existsSync(p2)) fs.writeFileSync(p2, fs.readFileSync(p2, 'utf8').replace(/var SCENE_VERSION = '[^']*';/, "var SCENE_VERSION = '" + v2 + "';"));
console.log('login3d.js: ' + Math.round(fs.statSync(out2).size / 1024) + ' KB, versie ' + v2);
