# Beslissingen

Wat we hebben besloten en waarom. Nieuwste bovenaan.

## 8 oktober 2026 – Opgeschoond: alleen nette opties, nooit een contrastmelding

- **Weg, omdat het slordig oogde of slecht scant:**
  - *Patronen:* hartjes, sterren, ruitjes, plusjes, strepen (2×), mozaïek en fijn. Er blijven 5 over: vierkant, afgerond, vloeiend, rondjes en elegant.
  - *Hoeken:* buitenkant druppel en stippellijn; binnenkant ruit, plus, bloem, hart en ster.
  - *Frames:* telefoon, pijl, bestek, afhaalbakje, envelop, kalender, bonnetje, doos, locatie, laptop en deurhanger. De groep "Meer" is weg; er blijven 22 over.
  - *Lettertypes:* modern en speels (bijna niet te onderscheiden). Er blijven 4 over.
  - *Kleuren:* achtergrondkleur, transparante achtergrond, kleurverloop in het frame, rond kleurverloop en een aparte kleur voor de binnenkant van de hoeken. Kleurverloop is nu één schakelaar; de hoeken hebben één kleur.
  - *Stijl:* Neon.
- **Geen contrastmeldingen meer.** In plaats van waarschuwen zorgt `safeDesign()` (in `shared/design-data.js`) er altijd voor dat het goed is: witte achtergrond, en kleuren die te licht zijn worden vanzelf donkerder tot het contrast minstens 4,5 is (frame: 3). Dit geldt voor stijlen, de assistent, zelf aanpassen én de server bij het opslaan.
- Oude codes met een weggehaalde optie krijgen automatisch de dichtstbijzijnde nette optie.

## 8 oktober 2026 – Stap 3 op volgorde van belangrijkheid

- Volgorde: **1. Kies een stijl** (altijd open) → **2. Je logo** (altijd open) → **3. Zelf aanpassen** met tabbladen **Patroon en kleuren** (met Versiering onderaan) · **Frame** · **Hoeken**.
- Stijlen en logo staan open, omdat dat de belangrijkste keuzes zijn. Zo ziet iedereen meteen dat stijlen professioneel zijn en niet "kinderachtig". Onder *Meer stijlen* staat standaard de groep **Zakelijk** open.
- De QR-assistent staat onderaan bij de stijlen ("Of beschrijf wat je wilt"), want hij maakt ook stijlen. "Met mijn logo" springt naar het logo-blok.

## 8 oktober 2026 – Stap 3 volgens schets MOCK2: snel kiezen → QR-assistent → zelf aanpassen

- **Drie stappen, van snel naar precies:**
  1. *Snel kiezen:* 4 echte QR-codes (de eigen code van de gebruiker). Klassiek altijd eerst en standaard, daarna 3 aanbevelingen met een reden (bv. Past bij "Café", Past bij het seizoen). Link *Alle stijlen bekijken (39)* opent het tabblad Stijlen.
  2. *QR-assistent:* één invoerbalk "Beschrijf je QR-code" + **Maak**. Resultaat = 3 echte varianten (klik = kiezen, muis erover = voorbeeld op de telefoon), één korte regel *Herkend:* met de woorden die hij begreep, en knoppen **Donkerder · Zonder frame · Andere tekst · Met mijn logo**. Je kunt gewoon verder typen ("maak het blauw"); hij bouwt dan verder op het huidige ontwerp. **Geen lange uitlegtekst** in een chat.
  3. *Zelf aanpassen:* tabbladen met alleen tekst (geen iconen): **Stijlen · Frame · Vorm · Kleuren · Logo · Versiering**. Eén tabblad tegelijk zichtbaar.
- **Mijn stijlen is weg** (overbodig naast assistent en aanbevelingen). Ook uit het profiel op de server gehaald.
- **De assistent is zelf gebouwd** (`shared/assistant.js`), geen externe AI en geen kosten per vraag: woordenlijsten in 10 talen voor gelegenheden/branches, kleuren (ook "donkerblauw", "pastel", #hex), vormen, frames, versiering, lettertypes, tekst tussen aanhalingstekens en opdrachten (donkerder, lichter, verloop, simpeler, zonder frame, andere variant). Woorden tellen alleen aan het begin van een woord, korte woorden alleen als heel woord (anders vond "rondjes" muziek en "zielony" zwart).
- **Altijd scanbaar:** de assistent maakt kleuren zelf donkerder tot het contrast minstens 4,5 is, en zet een lichte code nooit op een donkere achtergrond.
- **Achterkant:** `POST /api/assistant` draait dezelfde motor, controleert elke variant met dezelfde regels als bij opslaan (`validateDesign`) en telt woorden die hij niet kende (`assistantMisses` in de database). Zo zien we welke woorden we nog moeten toevoegen. Zonder server (demo) draait de motor in de browser.
- Later eventueel: een taalmodel als reserve voor zinnen die de motor niet begrijpt.

## 8 oktober 2026 – Stap 3 simpel, zoals qr-code.io

- Optimasys gebruikt qr-code.io echt (Website-codes per vereniging, in mappen). Designs en stijlen blijven, want die zijn populair, maar **simpel**.
- Stap 3 is één rustige lijst, net als bij qr-code.io: **Stijlen · Frame · Patroon en kleuren · Hoeken · Logo · Versiering**. Eén regel tegelijk open; Stijlen staat open bij binnenkomst (met *Aanbevolen voor jou*, Klassiek altijd eerst).
- Beter dan qr-code.io: rechts op elke dichte regel staat **wat er nu gekozen is** (bv. "Klassiek" met een mini-QR, "Label onder", "Vierkant · Vierkant").
- De contrastmelding verschijnt alleen als er iets mis is. De unieke link staat klein onder de lijst.
- AI-assistent: idee bewaard, nog niet gebouwd (eerst navragen hoe Optimasys de tool gebruikt).

## 8 oktober 2026 – Elke QR-code uniek, rustiger Stijlen, zelf ontwerpen

- **Uniek:** elke QR-code krijgt vanaf het begin een eigen id (7 willekeurige tekens via `crypto.getRandomValues`, ±3,5 biljoen mogelijkheden). De code in de preview is dus precies de code die je krijgt; de server neemt dat id over (of kiest een nieuw als het al bestaat). Na opslaan krijgt de volgende code weer een nieuw id. Bovenin stap 3 staat de eigen link (bv. `qr.optimasys.com/q/CJphnxM`). WiFi en vCard zijn statisch: de inhoud zit in de code zelf.
- **Stijlen geven alleen het uiterlijk**, nooit de code: twee klanten met dezelfde stijl hebben dus twee verschillende codes. De stijl-voorbeelden tonen de eigen code van de gebruiker.
- **Rustiger:** standaard alleen *Aanbevolen voor jou* (4 tegels). *Alle stijlen bekijken (39)* klapt de groepen pas open als je erom vraagt.
- **Zelf ontwerpen:** knop die meteen naar Patroon en kleuren gaat.
- **Mijn stijlen:** je eigen ontwerp bewaren met een naam en later met één klik hergebruiken (max. 12, opgeslagen in het profiel via `/api/me`, met de browser als reserve). Handig voor bedrijven die al hun codes in dezelfde huisstijl willen.

## 8 oktober 2026 – Stijlen die passen bij het bedrijf + seizoensdecoratie

- **Klassiek is altijd de standaard en staat altijd vooraan** (meest gebruikt).
- **Aanbevolen voor jou** (bovenaan Stijlen): Klassiek + 3 suggesties met een reden eronder.
  1. *Wat je invulde:* woorden in naam, titel, beschrijving, link of adres (meertalig, zonder accenten), bv. "Café Aurora" → Koffie, Bakkerij; "Kapsalon Bella" → Salon, Spa.
  2. *Het type:* WiFi → Hotel, WiFi; Menu → Restaurant, Krijtbord; Coupon → Uitverkoop, Cadeaubon; vCard → Zakelijk.
  3. *Het seizoen* (datum van de gebruiker): februari → Valentijn, oktober → Halloween, december → Kerst, eind december → Nieuwjaar.
- **39 stijlen in 8 groepen:** Basis · Horeca · Winkel · Zakelijk · Hotel & reizen · Beauty & sport · Feest · Seizoenen.
- **Seizoensdecoratie** (bij Hoeken): Kerst, Winter, Nieuwjaar, Valentijn, Pasen, Lente, Halloween, Verjaardag. Alleen in een extra rand rond de code, nooit over de puntjes, zodat de code scanbaar blijft.

## 8 oktober 2026 – Stap 3: Ontwerp (meer dan qr-code.io, maar rustig)

Eigen QR-tekenaar (`public/js/qr-render.js`), geen extra library. Vijf secties, één tegelijk open:

| Sectie | Wat | Beter dan qr-code.io |
|---|---|---|
| **Stijlen** | 12 kant-en-klare looks: Klassiek, *Mijn merk*, Modern, Valentijn, Kerst, Zomer, Zakelijk, Koffie, Feest, Halloween, Winkel, Neon | Eén klik zet patroon, hoeken, kleuren én frame. *Mijn merk* gebruikt automatisch de paginakleuren uit stap 2 |
| **Frame** | 32 frames in 5 groepen: *Basis* (label, ballon, scanner, lint, ticket, postzegel, polaroid, telefoon, handgeschreven, embleem…), *Eten & drinken* (koffiebeker, krijtbord, bord en bestek, afhaalbakje, pizzadoos), *Winkel & post* (tas, cadeau, prijskaartje, envelop, kalender, bonnetje, pakketje), *Feestdagen* (hart, kerstbal, ballonnen, confetti, pompoen), *Overig* (locatiepin, laptop, deurhanger). Eigen tekst, 6 lettertypes, kleur + kleurverloop | Groepen houden het overzichtelijk; alle frames zelf getekend (niet gekopieerd); tekst past zich automatisch aan de ruimte aan |
| **Patroon en kleuren** | 13 patronen (o.a. vloeiend, rondjes, fijn, mozaïek, strepen, plusjes, hartjes, sterren), codekleur, kleurverloop (lineair/rond), achtergrond, transparant | Knop *Gebruik mijn paginakleuren* |
| **Hoeken** | 8 buitenvormen (o.a. druppel, achthoek), 10 binnenvormen (o.a. bloem, plus), eigen kleuren (of *zelfde als code*) | |
| **Logo** | Uploaden, of met één klik het icoon van het type | Code wordt automatisch extra sterk (foutcorrectie H) |

- **Live:** elke keuze direct op de telefoon; met de muis erover zie je het al vóór je klikt.
- **Leesbaarheidscheck** bovenin: contrast, lichte code op donkere achtergrond, transparant, speciale vormen.
- **Downloaden** als PNG (1024 px) en SVG na het maken.
- De server accepteert alleen bekende ontwerpwaarden (en een logo tot 1 MB).

## 8 oktober 2026 – Wachtwoord bij Website

- **Opslag:** het wachtwoord gaat via https naar de server en wordt alleen als hash bewaard (scrypt met salt; in PHP `password_hash()`). Het wordt nooit teruggestuurd; vergeten = nieuw instellen.
- **Oogje** om het wachtwoord te tonen/verbergen.
- **Sterk wachtwoord maken** (14 tekens, willekeurig via `crypto.getRandomValues`).
- **Bewaren op mijn apparaten:** Chrome/Edge/Android slaan het direct op in de wachtwoordmanager (Credential Management API, synchroniseert met het Google-account). Safari (iPhone/Mac) heeft die API niet; daar biedt Safari zelf aan het op te slaan in iCloud-sleutelhanger dankzij `autocomplete="new-password"`, en anders wordt het gekopieerd. De invoerpagina voor bezoekers gebruikt `autocomplete="current-password"`, zodat opgeslagen wachtwoorden daar automatisch ingevuld kunnen worden.
- **Telefoon:** het slot-scherm is klikbaar (*Openen* toont de website), met een balkje om weer te vergrendelen.
- *Andere link voor iPhone/Android* weggehaald bij Website: dat doet het type **Apps** al. De server ondersteunt het nog.

## 8 oktober 2026 – Website: alles wat nodig is, de rest onder *Meer opties*

Vergeleken met qr-code.io, QR TIGER en Uniqode. Alleen functies die klanten echt gebruiken; de rest dichtgeklapt.

- **Website-URL** (verplicht) met link-check: `https://` wordt automatisch toegevoegd, typfouten (`htps`, `.con`, …) worden verbeterd, en de server controleert of de site bestaat.
- **Naam van de QR-code** wordt automatisch de titel van de website (aan te passen).
- **Meer opties** (dichtgeklapt, met teller "2 actief"). Opengeklapt zie je alleen knopjes (`+ Wachtwoord`, `+ Geldig tot`, …); je voegt alleen toe wat je nodig hebt en haalt het weg met ×. Zo wordt het formulier nooit lang.
  - Wachtwoord – wordt versleuteld opgeslagen (scrypt), nooit leesbaar teruggestuurd. De telefoon toont het slot-scherm.
  - Geldig tot (datum) – daarna ziet de bezoeker "Deze QR-code is verlopen".
  - Andere link voor iPhone / Android.
  - Scans meten in Google Analytics (UTM-labels automatisch). De labels zelf bevatten geen persoonsgegevens; de cookietoestemming op de eigen website is de verantwoordelijkheid van de klant. Onze eigen scanteller bewaart geen IP-adressen.
- *Maximaal aantal scans* is weggehaald bij Website (bijna niemand gebruikt het voor een gewone link) en komt later bij **Coupon** ("de eerste 100 klanten"). De server ondersteunt het al.
- Niet overgenomen: map (hoort bij Mijn QR-codes), advertentiepixels, locatie-afbakening, leeftijdscheck.
- Veiligheid link-check: de server haalt alleen openbare websites op; interne adressen (localhost, 10.x, 192.168.x, …) worden geweigerd.
- Opslaan: nu bij *QR-code maken* in stap 3. **Nog te doen:** automatisch een concept bewaren tijdens het invullen.

## 8 oktober 2026 – Kleuren: hoofdkleur + knopkleur

- Uitgangspunt: qr-code.io heeft goede functies, maar zet ze rommelig neer. Wij bieden minstens dezelfde functies, beter georganiseerd en met extra's.
- Twee kleuren, net als bij hen: **hoofdkleur** (bovenbalk, iconen) en **knopkleur** (knoppen). Eén kleurkiezer met tabs, plus een wisselknop.
- Rustig gehouden (feedback Gilamby: thema-raster was onhandig en lelijk):
  - Twee regels, *Hoofdkleur* en *Knopkleur*, met kleurvakje en hexcode. Klik = kleurkiezer klapt open (één tegelijk); muis over de kleurkiezer = live op de telefoon.
  - **Kleuren uit je foto** (wel handig): na het uploaden van een omslagfoto drie passende combinaties als kleine bolletjes.
  - Geen raster met kant-en-klare thema's en geen rij snelle kleuren meer.
  - **Altijd leesbaar**: tekst op balk en knoppen wordt automatisch zwart of wit.

## 8 oktober 2026 – Bedrijf: echte gegevens in plaats van vrije tekst

**Openingstijden**
- Per dag (ma t/m zo) een schakelaar *open/gesloten* en een tijdkiezer. Vrij typen kan niet meer, dus ongeldige tijden zoals `28238293:29839238` zijn onmogelijk.
- Knop *Zelfde tijden voor alle dagen*.
- Optioneel een tweede tijdvak per dag (voor een middagpauze).
- Op de telefoon: een tabel per dag, vandaag vetgedrukt, met *Nu open* / *Nu gesloten* op basis van de echte tijd van de bezoeker.

**Adres**
- Zoeken en kiezen uit echte adressen (suggesties tijdens het typen). Een zelfverzonnen adres wordt niet geaccepteerd.
- We bewaren het adres plus de coördinaten. Op de telefoon staat *Toon op kaart*; dat opent Google Maps op precies die plek.
- Demo: gratis OpenStreetMap (Photon). Echte versie: Optimasys kiest tussen OpenStreetMap (gratis) en **Google Places**. Google Places kan ook het bedrijf zelf vinden en vult adres, openingstijden, telefoon en website automatisch in, maar vraagt een API-sleutel en kost een klein bedrag per zoekopdracht.
- Let op: een adres kunnen we controleren; of het bedrijf écht bestaat alleen met Google Places.

**Verplichte velden:** omslagfoto, bedrijfsnaam en adres. Rood sterretje; *Doorgaan* werkt pas als ze zijn ingevuld, met een melding wat er mist. De server controleert hetzelfde.

**Wat we overnemen van qr-code.io, en wat niet**

| Onderdeel | Keuze | Waarom |
|---|---|---|
| Over het bedrijf (beschrijving) | Houden | Bestond al |
| Contact: telefoon, e-mail, website | Houden, website toegevoegd | Zoekt elke klant |
| Social media | Compact: max. 8 bekende netwerken | Instagram, Facebook, TikTok, LinkedIn, X, YouTube, WhatsApp, Google-reviews in plaats van 40 |
| Faciliteiten (wifi, rolstoel, parkeren, …) | Later, onder *Meer opties* | Handig voor hotel/restaurant, overbodig voor de meeste bedrijven |
| Contactpersoon (naam) | Weg | Dubbel met vCard |

## 7 oktober 2026 – Telefoon en inhoud

- De telefoon heeft drie standen: stap 1 een vast voorbeeld (ook bij hover over een tegel), stap 2 de pagina live met wat de gebruiker typt (lege velden = grijze balkjes), stap 3 de QR-code.
- Elk type krijgt een eigen, echt scherm (WhatsApp-chat, Instagram-profiel, Safari, wifi-melding, …), niet één kaart voor alles.
- Per type: *Inhoud* (wat nodig is), *Uiterlijk* (kleurkiezer met live voorbeeld bij hover), *Meer opties* (dichtgeklapt). Map, lettertypes en welkomstscherm vervallen.
- Voorbeelddata is neutraal (verzonnen bedrijven). Alleen bij Website staat Optimasys.
- Bedrijf: eigen omslagfoto; zonder foto een mockup die verdwijnt zodra je een foto kiest.
- De telefoon gebruikt de echte tijd van de bezoeker (klok, chattijden, open/gesloten).
- Werkwijze: wijzigingen eerst in de online demo; pas op GitHub als Gilamby dat zegt.
