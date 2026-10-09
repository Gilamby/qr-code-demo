# Live zetten

Wat er nodig is om Optimasys QR echt online te hebben, voor klanten.

## Eerst: scannen met je telefoon (testen of presenteren)

Een QR-code bevat een link naar de server (`…/q/abc123`). De telefoon moet die server kunnen bereiken.

| Waar draait de server? | Werkt scannen? |
|---|---|
| **GitHub Codespaces** (`npm start` in de Codespace) | Ja, overal. De app herkent Codespaces zelf en zet `https://<naam>-3000.app.github.dev` in de codes. Poort 3000 moet op **Public** staan (de app probeert dat zelf; anders: tab *Poorten* > rechtermuisknop > *Port Visibility* > *Public*). Open de app via dat adres. Het adres blijft hetzelfde zolang je dezelfde Codespace gebruikt; de Codespace moet wel aan staan. |
| **Gratis online vanaf je laptop: `npm run share`** | Ja, overal (4G, elk wifi). Je krijgt een `https://…trycloudflare.com`-adres, zonder account of kosten. Laat het venster open. Elke keer starten = nieuw adres, dus maak de codes voor een presentatie op de dag zelf. **Beste gratis keuze voor testen en presenteren.** |
| Echte hosting met `PUBLIC_URL` (bv. `https://qr.optimasys.com`) | Ja, overal, ook als je laptop uit staat. Voor als het bedrijf het echt gaat gebruiken (zie `docs/railway.md`); de kosten zijn dan voor het bedrijf. |
| Op je laptop (`npm start`) | Ja, als telefoon en laptop op **hetzelfde wifi** zitten. De server zet dan vanzelf het wifi-adres van de laptop in de code (bv. `http://192.168.1.20:3000`); je ziet het bij het opstarten. Werkt het niet: firewall van de laptop toestaan voor poort 3000, en sommige gast-/schoolnetwerken blokkeren apparaten onderling. |
| Online demo op claude.ai (zonder server) | Alleen wifi en contactkaart (die hebben geen server nodig). De app zegt dit er zelf bij. |

Let op: een code die je met de laptop-versie maakt, bevat het wifi-adres van de laptop. Voor geprinte codes altijd de online versie met een vaste `PUBLIC_URL` gebruiken.

Getest (9 okt 2026): alle 16 types gemaakt, PNG en SVG gedownload, uitgelezen met ZXing (de scanner van veel Android-telefoons) en de link geopend: alles werkt, ook met logo. Alle 102 ontwerpopties (thema's, patronen, hoeken, kaders, decoraties) zijn leesbaar. Bewerken van de inhoud verandert de QR-code niet; uitzetten toont een nette melding.

## 1. Een server

Elke plek waar Node.js 20+ of Docker draait, met een **vaste schijf** (voor de database en de bestanden). Bijvoorbeeld een VPS (Hetzner, TransIP, DigitalOcean) of een platform met een volume (Fly.io, Railway, Render).

**Database:** zet `DATABASE_URL` (PostgreSQL 15+, bij voorkeur beheerd door de hostingpartij met automatische back-ups). Zonder `DATABASE_URL` gebruikt de app een SQLite-bestand in `DATA_DIR`; prima om te ontwikkelen, maar dan maximaal één server.

- Tabellen worden bij het opstarten zelf aangemaakt; een apart migratiescript is niet nodig.
- Al data in SQLite? `DATABASE_URL=… npm run migrate:pg` zet alles over (mag vaker draaien). Neem daarna de map `files/` en de sleutel (`DATA_KEY` of `secret.key`) mee.
- **DATA_KEY** (`openssl rand -hex 32`): sleutel voor versleutelde velden (wifi-wachtwoorden). Zet hem in het secretbeheer en bewaar hem apart van de database-back-ups; zonder sleutel zijn die velden onleesbaar.
- Bestanden (PDF/MP3) staan in `DATA_DIR/files`: dat moet een persistent volume zijn.

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
NODE_ENV=production node server/dist/main.js
```

`npm run build` voegt alle JavaScript en CSS samen tot een paar kleine, onleesbare bestanden. In productie zijn de losse bronbestanden (`/js/...`, `/shared/...`) niet te downloaden. Na elke update opnieuw `npm run build` draaien (Docker doet dit vanzelf).

Laat het draaien met een procesbeheerder (systemd, pm2) zodat de server na een herstart vanzelf opstart.

Controle: `https://qr.optimasys.com/api/health` geeft `{"ok":true}`.

## 4. E-mail

Nodig voor **account bevestigen** (na "Account maken" krijg je een bevestigingslink; pas daarna kun je inloggen) en **wachtwoord vergeten**.

**Zonder mailserver** (testen): de link verschijnt in de terminal waar de server draait (`[e-mail niet ingesteld] Bevestigingslink voor …`). Kopieer hem naar je browser.

**Gratis echte e-mail met Gmail** (genoeg voor testen en een demo, ± 500 mails per dag):
1. Zet in je Google-account *2-stapsverificatie* aan.
2. Ga naar <https://myaccount.google.com/apppasswords>, maak een app-wachtwoord ("Optimasys QR"). Je krijgt 16 letters.
3. Zet in `.env` (in Codespaces: maak het bestand `.env` naast `package.json`):
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=jouwnaam@gmail.com
   SMTP_PASS=de16letters
   MAIL_FROM=Optimasys QR <jouwnaam@gmail.com>
   ```
4. Server opnieuw starten. `.env` staat in `.gitignore`: je wachtwoord komt nooit op GitHub.

Voor echt gebruik door het bedrijf: een eigen afzender (bv. Postmark, Brevo, Mailgun of de mailserver van Optimasys).

## 5. Back-up

Elke nacht een back-up, en die ook ergens anders bewaren (andere server of cloudopslag):

```
0 3 * * *  cd /pad/naar/optimasys && npm run backup
```

- **PostgreSQL:** de automatische back-ups van de hostingpartij (point-in-time recovery), of `pg_dump "$DATABASE_URL" > optimasys.sql`. `npm run backup` kopieert dan alleen de bestanden.
- **SQLite:** `npm run backup` kopieert database én bestanden.

Terugzetten: server stoppen, database (pg_restore / `optimasys.db`) en de map `files/` terugzetten, server starten. De sleutel (`DATA_KEY`) zit bewust niet in de back-up: bewaar hem apart.

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
