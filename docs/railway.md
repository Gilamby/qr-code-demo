# Online zetten met Railway (voor als het bedrijf het echt gaat gebruiken)

Gratis testen en presenteren kan zonder hosting: `npm run share` (zie README). Echte hosting kost geld; die rekening hoort bij het bedrijf, niet bij de student.

Railway bouwt de app vanuit GitHub (met de `Dockerfile`) en zet hem online met een eigen https-adres.
Na elke push naar GitHub wordt de site vanzelf bijgewerkt.

Kosten (oktober 2026): proefperiode met eenmalig $5 tegoed; daarna Hobby $5 per maand (inclusief $5 gebruik).
Zie <https://docs.railway.com/reference/pricing/plans>.

## Stappen

1. **Account:** ga naar <https://railway.com>, log in met GitHub.
2. **Nieuw project:** *New Project* → *Deploy from GitHub repo* → kies `Gilamby/qr-code-demo`.
   Geef Railway toegang tot de repo als hij daarom vraagt.
3. **Branch:** open de service → *Settings* → *Source* → branch `optimasys-qr-demo`.
4. **Schijf (volume) voor de database:** rechtermuisknop op de service (of *+ New* → *Volume*) → koppel aan de service, *Mount path*: `/data`.
   Zonder volume ben je bij elke update alle accounts en codes kwijt.
5. **Adres:** *Settings* → *Networking* → *Generate Domain*. Je krijgt iets als `optimasys-qr.up.railway.app`.
6. **Variabelen:** tab *Variables*, voeg toe:

   | Naam | Waarde |
   |---|---|
   | `PUBLIC_URL` | `https://optimasys-qr.up.railway.app` (jouw adres uit stap 5, zonder `/` aan het eind) |
   | `NODE_ENV` | `production` |
   | `DATA_DIR` | `/data` |
   | `TRUST_PROXY` | `1` |
   | `RAILWAY_RUN_UID` | `0` (zodat de app op het volume mag schrijven) |

7. **Deploy:** Railway bouwt opnieuw (± 2-4 minuten). Klaar als *Deployments* groen is.
8. **Controle:** open `https://<jouw-adres>/api/health` → `{"ok":true,"qrBase":"https://<jouw-adres>",…}`.
   Maak een account, maak een code, download hem en scan hem met je telefoon (ook via 4G).

## Later

- **Eigen domein** (bv. `qr.optimasys.com`): *Settings* → *Networking* → *Custom Domain*, en daarna `PUBLIC_URL` aanpassen.
  Doe dit vóórdat je codes print: geprinte codes wijzen naar het adres van dat moment.
- **E-mail** voor "wachtwoord vergeten": `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` toevoegen (zie `.env.example`).
- **Back-up:** het volume heeft in Railway een back-upknop; zet automatische back-ups aan.
