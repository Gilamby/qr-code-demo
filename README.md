# Optimasys QR

Demo van een QR-code-maker voor Optimasys. Kies een type, vul de inhoud in, kies een ontwerp, en zie het resultaat live op een telefoon.

## Starten

Nodig: [Node.js](https://nodejs.org) 18 of nieuwer.

```bash
npm install
npm start
```

Open daarna <http://localhost:3000>.

Tijdens het programmeren kun je `npm run dev` gebruiken. De server herstart dan vanzelf als je iets aanpast.

## Mappen

```
public/              frontend (wat de gebruiker ziet)
  index.html         de pagina
  css/app.css        alle opmaak
  js/                de app, één bestand per taak (zie hieronder)
  locales/*.json     vertalingen, één bestand per taal
  assets/qr-types/   afbeeldingen van de QR-types
  assets/previews/   foto's voor de telefoon-preview (zie README daar)
shared/
  qr-types.js        DE lijst met QR-types en hun velden, gedeeld door frontend én backend
server/
  index.js           Express-server + API
  validate.js        controleert alles wat binnenkomt (op basis van shared/qr-types.js)
  db.js              opslag in server/data/db.json (later te vervangen door een echte database)
scripts/
  build-demo.js      bouwt dist/demo.html: één bestand voor de online demo zonder server
```

### Frontend (public/js)

De volgorde in `index.html` is: vertalingen → instellingen → API → state → logica → weergave.

| Bestand | Taak |
|---|---|
| `i18n.js` | vertalingen laden, taal onthouden, getallen/prijzen/datums per taal |
| `api.js` | het enige bestand dat met de backend praat |
| `background.js` | eigen achtergrond (opgeslagen in het profiel) |
| `config.js` | iconen, ontwerpkleuren, stappen |
| `state.js` | één centrale state + alle acties (één bron van waarheid) |
| `qr.js` | QR-data opbouwen (WiFi, vCard, links) en contrast controleren |
| `preview.js` | het telefoon-sjabloon |
| `components.js` | stappen, tegels, formulier, ontwerp, knoppen |
| `layout.js` | taalkiezer, zijbalk, pagina's, schalen |
| `account.js` | Mijn account: achtergrond kiezen of uploaden |
| `my-codes.js` | Mijn QR-codes: lijst uit de backend |
| `main.js` | koppelt de state aan de componenten en start de app |

Componenten lezen alleen de state en roepen alleen `actions` aan. Bedrijfslogica staat niet in de weergave.

## API

| Methode | Pad | Wat |
|---|---|---|
| GET | `/api/health` | draait de server? |
| GET | `/api/qr-types` | alle QR-types (uit `shared/qr-types.js`) |
| GET | `/api/qr-codes` | alle opgeslagen QR-codes |
| POST | `/api/qr-codes` | QR-code opslaan: `{ typeId, content, design }` |
| GET | `/api/qr-codes/:id` | één QR-code |
| DELETE | `/api/qr-codes/:id` | QR-code verwijderen |
| GET | `/api/me` | profiel (achtergrond) |
| PATCH | `/api/me` | profiel aanpassen: `{ background, customBackground }` |
| GET | `/q/:id` | korte link in de QR-code: telt de scan en stuurt door |

Fout in de invoer? Dan krijg je `400` met `{ error, details: [...] }`.

## Veelvoorkomende aanpassingen

- **QR-type of veld toevoegen:** alleen `shared/qr-types.js` aanpassen, plus de teksten in `public/locales/*.json`. De frontend en de validatie volgen vanzelf.
- **Foto's in de telefoon:** zie `public/assets/previews/README.md`.
- **Taal toevoegen:** één regel in `LANGUAGES` (`public/js/i18n.js`) en een nieuw bestand `public/locales/<code>.json`.
- **Echte database:** vervang `server/db.js`; de functies blijven hetzelfde.

## Online demo

`npm run build:demo` maakt `dist/demo.html` met de vertalingen en afbeeldingen ernaast. Die versie werkt zonder server. Opslaan gebeurt dan niet; de app laat zien dat hij in demo-modus draait.
