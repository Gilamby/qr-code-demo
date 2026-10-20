# Website qr-codex.com

De promotiewebsite voor de app Optimasys QR (my.qr-codex.com). Gebouwd met **Next.js 15 + Payload CMS 3**.
De app zelf staat hier los van: deze website stuurt bezoekers alleen door naar de app (inloggen, account maken).

- Website: `https://qr-codex.com` (deze map)
- Beheer van alle teksten, prijzen, vragen en juridische pagina's: `https://qr-codex.com/admin`
- App: `https://my.qr-codex.com` (de map erboven, niet aanraken voor de website)

## Wat staat waar

| Map / bestand | Wat |
|---|---|
| `src/app/(site)/[lang]/` | De pagina's: home, pricing, faq, contact, privacy/terms/cookies. Taal in het adres (`/nl`, `/es`, …) |
| `src/components/` | Onderdelen. De 3D-duik staat in `dive/` (Three.js, wordt pas geladen als je erbij komt) |
| `src/globals/`, `src/collections/` | Wat je in het beheer kunt aanpassen |
| `src/content/` | Startteksten (Engels, Nederlands, Spaans). Alleen gebruikt bij de allereerste start |
| `public/app/` | Schermafbeeldingen van de echte app (voorbeeldaccount "Café Lumen", fictief) |

**Talen:** alle 19 talen van de app werken. Engels, Nederlands en Spaans zijn ingevuld; de andere talen tonen Engels
tot iemand ze in het beheer invult (rechtsboven in het beheer de taal kiezen).

**Knoppen naar de app:** `https://my.qr-codex.com/?signup&plan=pro&period=year&lang=nl`. De app opent dan "Account maken"
in die taal en gaat na het inloggen meteen naar Abonnement. Stripe (betalen) komt later.

## Op de server zetten (eerste keer)

Nodig: Node.js 20.9 of nieuwer, en een eigen MongoDB-database (mag in hetzelfde Atlas-cluster als de app, maar met een andere naam, bv. `qrcodex-website`).

```bash
cd ~/qr-app/website
cp .env.example .env
nano .env            # DATABASE_URI, PAYLOAD_SECRET (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD
npm ci
npm run build
bash scripts/start.sh
```

Bij de eerste start vult de website zelf alle teksten in en maakt de beheerder aan (ADMIN_EMAIL / ADMIN_PASSWORD).
Daarna mogen die twee regels uit `.env`.

De website draait op poort 3200 (alleen intern). Wie de webserver beheert (Slava) laat `qr-codex.com` doorsturen naar
`http://127.0.0.1:3200` (reverse proxy, net als bij de app). `www.qr-codex.com` → doorsturen naar `qr-codex.com`.

Vanzelf weer starten (crontab -e):

```
@reboot cd ~/qr-app/website && bash scripts/start.sh
* * * * * cd ~/qr-app/website && bash scripts/start.sh check
```

## Bijwerken

```bash
cd ~/qr-app && git pull
cd website && npm ci && npm run build && bash scripts/start.sh
```

Teksten aanpassen kan zonder bijwerken: in `/admin`. Na opslaan staat het binnen een paar seconden op de website.

## Lokaal testen (zonder MongoDB)

```bash
npm ci
npm run dev          # http://localhost:3200, gebruikt een SQLite-bestand website.db
```

## Log

`~/qr-website.log` (boven 10 MB wordt het oude log `~/qr-website.log.1`).
