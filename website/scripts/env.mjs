// Zorgt dat er een .env is met een geheime sleutel (PAYLOAD_SECRET). Draait vanzelf vóór "npm run build".
// Bestaat .env al, dan wordt alleen een ontbrekende sleutel toegevoegd; de rest blijft zoals het is.
import fs from 'fs'
import crypto from 'crypto'
const file = new URL('../.env', import.meta.url)
let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
  .replace(/^DATABASE_URI=.*$/m, 'DATABASE_URI=')                       // nog geen MongoDB: SQLite-bestand website.db
if (!/^PAYLOAD_SECRET=\S+/m.test(text)) {
  const secret = crypto.randomBytes(32).toString('hex')
  text = /^PAYLOAD_SECRET=/m.test(text) ? text.replace(/^PAYLOAD_SECRET=.*$/m, 'PAYLOAD_SECRET=' + secret) : text + '\nPAYLOAD_SECRET=' + secret + '\n'
  console.log('.env: geheime sleutel aangemaakt')
}
fs.writeFileSync(file, text, { mode: 0o600 })
