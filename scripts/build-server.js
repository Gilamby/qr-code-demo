/* Bouwt de server (TypeScript in server/src -> JavaScript in server/dist).
   Is TypeScript niet geïnstalleerd (bv. op een productieserver zonder dev-pakketten) en is de server al gebouwd,
   dan slaat dit de stap over. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const dist = path.join(__dirname, '..', 'server', 'dist', 'main.js');
let tsc = null;
try { tsc = require.resolve('typescript/bin/tsc'); } catch (e) { /* niet geïnstalleerd */ }
if (!tsc) {
  if (fs.existsSync(dist)) process.exit(0);
  console.error('De server is nog niet gebouwd en TypeScript ontbreekt. Draai eerst: npm install');
  process.exit(1);
}
try { execFileSync(process.execPath, [tsc, '-p', path.join(__dirname, '..', 'server')], { stdio: 'inherit' }); }
catch (e) { console.error('\nDe server kon niet gebouwd worden (zie de fouten hierboven).'); process.exit(1); }
