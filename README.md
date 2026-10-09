# Optimasys QR

Web-app om QR-codes te maken, te beheren en te meten. Kies een type, vul de inhoud in, kies een ontwerp en zie het resultaat live op een telefoon. Met accounts, een eigen server en een SQLite-database.

## Starten (op je eigen computer)

Nodig: [Node.js](https://nodejs.org) 20 of nieuwer.

```bash
npm install
npm start
```

Open daarna <http://localhost:3000> en maak een account aan.

- `npm run share`: **gratis online** vanaf je laptop (Cloudflare-tunnel). Je krijgt een https-adres dat je telefoon overal kan openen; dat adres komt in de QR-codes. Laat het venster open.
- `npm run dev`: de server herstart vanzelf als je iets aanpast.
- `npm test`: automatische test van de server (accounts, codes per klant, bestanden, scans, statistieken, beveiliging).
- `npm run build`: productieversie (samengevoegd en verkleind, in `build/`). Met `NODE_ENV=production` gebruikt de server alleen deze versie; de losse bronbestanden zijn dan niet te zien.
- `npm run backup`: back-up van database en bestanden naar `backups/`.
- `npm run migrate -- jouw@email.nl`: oude demo-gegevens (`server/data/db.json`) overzetten naar een account.

Instellingen (webadres, e-mail, enzovoort): kopieer `.env.example` naar `.env`. Live zetten: zie **docs/installatie.md**.

## Hoe het in elkaar zit

```
Browser (public/)  ──fetch──▶  Server (server/)  ──▶  SQLite (server/data/optimasys.db)
                                     │                 Bestanden (server/data/files/)
Bezoeker scant QR ──/q/:id──▶  scan tellen + pagina tonen of doorsturen
```

```
public/              de app (wat de gebruiker ziet)
  index.html         de pagina
  css/app.css        alle opmaak
  js/                één bestand per taak (zie hieronder)
  locales/*.json     teksten in 10 talen
shared/
  qr-types.js        DE lijst met QR-types en velden (frontend én server)
  design-data.js     ontwerpopties (patronen, hoeken, kaders)
  analytics-core.js  berekening van de statistieken (server én online demo)
server/
  index.js           Express-server, API en korte links
  db.js              SQLite: users, sessions, password_resets, qr_codes, scan_stats, files
  auth.js            accounts, inloggen, sessies, wachtwoord vergeten, AVG (export/verwijderen)
  mailer.js          e-mail (SMTP) voor "wachtwoord vergeten"
  validate.js        controleert alles wat binnenkomt
  analytics.js       wat er bij een scan wordt vastgelegd (systeem, land/stad, uniek)
  links.js           regels bij het scannen (wachtwoord, verlopen, uit) en bezoekerspagina's
  live-page.js       de echte pagina die een bezoeker na het scannen ziet
  config.js          .env inlezen
scripts/             back-up, migratie, online demo bouwen
test/                automatische tests (npm test)
docs/                beslissingen, juridisch, statistieken, installatie
```

### Frontend (public/js)

| Bestand | Taak |
|---|---|
| `i18n.js` | vertalingen, taal onthouden, getallen/datums per taal |
| `api.js` | het enige bestand dat met de server praat (zonder server: demo-opslag in de browser) |
| `session.js` | inlogscherm, account maken, wachtwoord vergeten, uitloggen |
| `state.js` | centrale state + alle acties (maken, bewerken) |
| `components.js`, `design-panel.js`, `content-fields.js`, `business-fields.js` | de drie stappen van QR-code maken |
| `phone-templates.js`, `preview.js` | de telefoon (ook gebruikt voor de echte bezoekerspagina) |
| `my-codes.js` | Mijn QR-codes |
| `analytics.js` | Statistieken |
| `account.js`, `account-settings.js`, `background.js` | Mijn account |
| `layout.js`, `main.js` | zijbalk, pagina's, opstarten |

## API

Alles onder `/api` (behalve health, qr-types en de inlogroutes) vraagt een ingelogde gebruiker. Je ziet en wijzigt alleen je eigen codes.

| Methode | Pad | Wat |
|---|---|---|
| GET | `/api/health` | draait de server en de database? |
| POST | `/api/auth/register` · `/login` · `/logout` | account maken, inloggen, uitloggen |
| GET | `/api/auth/me` | wie is ingelogd? |
| POST | `/api/auth/forgot` · `/reset` | wachtwoord vergeten (link per e-mail, 1 uur geldig) |
| PATCH | `/api/account` | naam wijzigen |
| POST | `/api/account/password` | wachtwoord wijzigen |
| GET | `/api/account/export` | al mijn gegevens (JSON) |
| DELETE | `/api/account` | account en alles verwijderen (met wachtwoord) |
| GET / POST | `/api/qr-codes` | mijn codes / nieuwe code |
| GET / PUT / PATCH / DELETE | `/api/qr-codes/:id` | één code: ophalen, bewerken, naam of aan/uit, verwijderen |
| GET | `/api/analytics` · `/api/analytics.csv` | statistieken (filters: from, to, codes, os, cc, city) |
| GET / PATCH | `/api/me` | achtergrond |
| GET | `/api/url-info` · `/api/geocode` · `/api/email-check` | hulp bij het invullen |
| GET | `/q/:id` | korte link in de QR-code |

Fout in de invoer: `400` met `{ error, details }`. Niet ingelogd: `401`.

## Veelvoorkomende aanpassingen

- **QR-type of veld toevoegen:** `shared/qr-types.js` + teksten in `public/locales/*.json`. Formulier en controle volgen vanzelf.
- **Foto's in de voorbeelden:** `public/assets/previews/` (zie de README daar).
- **Taal toevoegen:** één regel in `LANGUAGES` (`public/js/i18n.js`) en `public/locales/<code>.json`.
- **Naar PostgreSQL:** alleen `server/db.js` vervangen; de functies blijven hetzelfde.

## Online demo

`npm run build:demo` maakt `dist/demo.html` (met vertalingen en afbeeldingen ernaast). Die werkt zonder server en zonder account: codes worden in de browser bewaard en Statistieken toont gemarkeerde voorbeeldcijfers.
