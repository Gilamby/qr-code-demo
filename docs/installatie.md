# Live zetten

Wat er nodig is om Optimasys QR echt online te hebben, voor klanten.

## Eerst: scannen met je telefoon (testen of presenteren)

Een QR-code bevat een link naar de server (`…/q/abc123`). De telefoon moet die server kunnen bereiken.

| Waar draait de server? | Werkt scannen? |
|---|---|
| Online met `PUBLIC_URL` (bv. `https://qr.optimasys.com`) | Ja, overal (4G, elk wifi). **Dit is de veilige keuze voor een presentatie.** |
| Op je laptop (`npm start`) | Ja, als telefoon en laptop op **hetzelfde wifi** zitten. De server zet dan vanzelf het wifi-adres van de laptop in de code (bv. `http://192.168.1.20:3000`); je ziet het bij het opstarten. Werkt het niet: firewall van de laptop toestaan voor poort 3000, en sommige gast-/schoolnetwerken blokkeren apparaten onderling. |
| Online demo op claude.ai (zonder server) | Alleen wifi en contactkaart (die hebben geen server nodig). De app zegt dit er zelf bij. |

Let op: een code die je met de laptop-versie maakt, bevat het wifi-adres van de laptop. Voor geprinte codes altijd de online versie met een vaste `PUBLIC_URL` gebruiken.

Getest (9 okt 2026): alle 16 types gemaakt, PNG en SVG gedownload, uitgelezen met ZXing (de scanner van veel Android-telefoons) en de link geopend: alles werkt, ook met logo. Alle 102 ontwerpopties (thema's, patronen, hoeken, kaders, decoraties) zijn leesbaar. Bewerken van de inhoud verandert de QR-code niet; uitzetten toont een nette melding.

## 1. Een server

Elke plek waar Node.js 20+ of Docker draait, met een **vaste schijf** (voor de database en de bestanden). Bijvoorbeeld een VPS (Hetzner, TransIP, DigitalOcean) of een platform met een volume (Fly.io, Railway, Render).

Let op: de database is één bestand (SQLite). Draai daarom **één** server tegelijk. Voor duizenden klanten is dat ruim genoeg; wordt het later te groot, dan kan `server/db.js` naar PostgreSQL.

## 2. Domein en HTTPS

- Kies een adres, bv. `qr.optimasys.com`, en zet het in `.env` als `PUBLIC_URL`. Dit adres komt in elke QR-code. **Kies het één keer en verander het niet meer**: geprinte codes wijzen ernaar.
- HTTPS is verplicht (veilige cookies). Het makkelijkst met Caddy, dat het certificaat zelf regelt:

```
qr.optimasys.com {
  reverse_proxy localhost:3000
}
```

Met nginx of een andere proxy op een andere machine: zet `TRUST_PROXY` (zie `.env.example`), anders ziet de server niet het juiste IP-adres voor land/stad.

## 3. Starten

**Met Docker:**

```bash
cp .env.example .env      # en invullen
docker compose up -d
```

**Zonder Docker:**

```bash
npm ci
npm run build             # maakt de productieversie (build/)
cp .env.example .env      # en invullen
NODE_ENV=production node server/index.js
```

`npm run build` voegt alle JavaScript en CSS samen tot een paar kleine, onleesbare bestanden. In productie zijn de losse bronbestanden (`/js/...`, `/shared/...`) niet te downloaden. Na elke update opnieuw `npm run build` draaien (Docker doet dit vanzelf).

Laat het draaien met een procesbeheerder (systemd, pm2) zodat de server na een herstart vanzelf opstart.

Controle: `https://qr.optimasys.com/api/health` geeft `{"ok":true}`.

## 4. E-mail

Voor "wachtwoord vergeten" is een mailserver nodig (bv. Postmark, Mailgun, Brevo of de mailserver van je hosting). Vul `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` en `MAIL_FROM` in. Zonder mailserver staat de link alleen in de serverlog.

## 5. Back-up

Elke nacht een back-up, en die ook ergens anders bewaren (andere server of cloudopslag):

```
0 3 * * *  cd /pad/naar/optimasys && npm run backup
```

Terugzetten: server stoppen, `optimasys.db` en de map `files/` uit de back-up terugzetten in de datamap, server starten.

## 6. Land/stad-database

Maandelijks bijwerken, zie `docs/statistieken.md`.

## 7. Vóór de lancering (niet-technisch)

Zie `docs/juridisch.md`: privacyverklaring, voorwaarden, verwerkersovereenkomst, meldknop voor misbruik, bewaartermijnen.

## Wat de server al regelt

- Accounts met e-mail en wachtwoord (scrypt), sessie-cookie (HttpOnly, Secure, SameSite), uitloggen op andere apparaten na wachtwoordwijziging.
- Elke klant ziet alleen zijn eigen codes, statistieken en bestanden.
- Te veel inlogpogingen = even wachten. Verzoeken van andere websites worden geweigerd (CSRF).
- Beveiligingsheaders (CSP, nosniff, frame-options, HSTS op https).
- PDF/MP3 op schijf, niet in de database; weg zodra de code of het account wordt verwijderd.
- AVG: gegevens downloaden en account verwijderen in Mijn account.
- Verlopen sessies en resetlinks worden elk uur opgeruimd.
- Automatische test: `npm test`.
