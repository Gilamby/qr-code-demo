# Juridisch en privacy: wat er is gedaan en wat er vóór de lancering nog moet

Doel: niets in de tool dat een boete of claim kan opleveren (AVG/GDPR, merkenrecht, consumentenrecht).
Geen juridisch advies: laat de punten onder "Vóór de lancering" nalopen door iemand met verstand van zaken (bv. een privacyjurist).

## Al geregeld in de code (8 oktober 2026)

| Wat | Risico | Oplossing |
|---|---|---|
| Google Fonts | IP-adres naar Google zonder toestemming. Een Duitse rechter (LG München, jan. 2022) gaf daarvoor een boete. | Lettertypes staan op onze eigen server (`public/fonts`, licentie SIL OFL 1.1, zie `public/fonts/LICENSES`). |
| jsDelivr (CDN) | IP-adres naar een derde partij | QR-bibliotheek staat op onze eigen server (`public/vendor/qrcode.js`, MIT-licentie). |
| YouTube-miniatuur | IP-adres naar Google | Verwijderd; de videospeler toont een kleurvlak. |
| Adres zoeken (Photon) | IP-adres en zoektekst naar een derde | Loopt via onze server (`/api/geocode`): Photon ziet alleen onze server. |
| Verzonnen beoordelingen | Nep-reviews/sterren zijn verboden (EU-richtlijn Omnibus, Nederland sinds 2022) | Sterren en "(128)" bij Bedrijf en de cijfers (4,8, 4+, #12) bij Apps zijn weg. |
| Apple- en Google Play-logo | Merkregels: de logo's mogen alleen in de officiële badges | Gewone knoppen met de naam van de winkel, zonder logo. |
| "linktree" in de mockup | Merknaam van een ander bedrijf | Verwijderd. |
| "Voeg toe aan Apple Wallet" | Belofte die we niet waarmaken (vraagt een Apple-certificaat) | Vervangen door *Code kopiëren*. |
| Batterij-API | Werd vroeger misbruikt om mensen te herkennen | Niet gebouwd. Als we het bouwen: alleen lokaal tonen, nooit opslaan of versturen. |

Gecontroleerd: bij het gebruik van de tool en het openen van alle echte pagina's gaat er **geen enkele aanvraag naar een andere server** (getest met Playwright, 8 okt.).

## Wat de app opslaat

- **Scans (vanaf 9 okt 2026, voor Statistieken):** per QR-code per dag alleen aantallen per *systeem* (iOS, Android, …), *land* en *stad*.
  - Land en stad worden bij het scannen opgezocht in een eigen database op onze server (DB-IP Lite). Het **IP-adres wordt niet opgeslagen** en niet doorgestuurd.
  - "Unieke scans" zonder cookies: een dagcode met een geheim dat alleen in het geheugen staat en elke dag vervangen wordt. Na die dag is niet meer te herleiden wie er scande.
  - Dit is wel *verwerking* van persoonsgegevens (het IP-adres wordt even gebruikt). Grondslag: gerechtvaardigd belang. **Moet in de privacyverklaring** (wat, waarom, dat IP niet wordt bewaard). Laat dit door een privacyjurist nakijken; het is dezelfde aanpak als privacyvriendelijke tools zoals Plausible.
  - DB-IP-licentie (CC BY 4.0): bronvermelding staat onderaan Statistieken.
- **Wachtwoorden** van beveiligde codes: alleen versleuteld (scrypt), nooit leesbaar.
- **Inhoud** die de klant invult (teksten, foto's, PDF's, audio): nodig om de pagina te tonen.
- **In de browser (localStorage):** alleen voorkeuren: taal, achtergrond, ingeklapte zijbalk. Dat zijn functionele voorkeuren: daarvoor is geen cookiemelding nodig.
- **Geen cookies, geen tracking, geen analytics.** Daarom is er ook geen cookiebanner nodig.

## Links naar andere diensten

Google Maps (route), Instagram, Facebook, WhatsApp, YouTube, App Store, Google Play: dit zijn **gewone links**. Er gaat pas iets naar die dienst als de bezoeker zelf klikt. Dat mag.

De mockups van WhatsApp, Instagram en Facebook in de tool laten zien waar de bezoeker uitkomt (die types sturen door naar de echte app). Dat is een beschrijvend gebruik; we gebruiken geen officiële logo's of beeldmateriaal van die bedrijven.

## Vóór de lancering (geen code, wel verplicht)

1. **Privacyverklaring** op de site en in de app: welke gegevens, waarom, hoe lang, wie ze ziet (hosting, Photon via onze server), rechten van de gebruiker.
2. **Verwerkersovereenkomst** met de hostingpartij. Optimasys is verwerker voor de klanten die pagina's maken. Dus: een verwerkersovereenkomst aanbieden aan zakelijke klanten.
3. **Algemene voorwaarden / gebruiksvoorwaarden:** de klant is verantwoordelijk voor wat hij uploadt (foto's van mensen, auteursrecht op PDF's/muziek, kortingsacties). Optimasys mag ongepaste inhoud verwijderen.
4. **Meldknop / notice-and-takedown** voor illegale inhoud op de gehoste pagina's (EU Digital Services Act).
5. **Bewaartermijn:** wat gebeurt er met codes en bestanden als een klant stopt? Opschrijven en automatisch opruimen.
6. **Photon:** de openbare server is voor licht gebruik. Bij echte lancering: eigen Photon-server of een betaalde adresdienst (instellen via `PHOTON_URL`). Bron vermelden: © OpenStreetMap-bijdragers.
7. **Toegankelijkheid:** sinds juni 2025 geldt de European Accessibility Act voor veel digitale diensten. De tool is er al op gebouwd (dyslexievriendelijk, toetsenbord, labels), maar laat het testen.
8. **Coupons:** de klant moet de actievoorwaarden zelf eerlijk vermelden (veld *Voorwaarden* staat klaar).
