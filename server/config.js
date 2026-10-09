/* .env inlezen (KEY=waarde per regel). Variabelen die al gezet zijn (bv. door de hosting) gaan voor. */
const fs = require('fs');
const path = require('path');
const file = process.env.ENV_FILE || path.join(__dirname, '..', '.env');
try {
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m || line.trim().startsWith('#')) return;
    let v = m[2]; if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
} catch (e) { /* geen .env: standaardwaarden */ }
