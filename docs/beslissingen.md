# Beslissingen

Wat we hebben besloten en waarom. Nieuwste bovenaan.

## 8 oktober 2026 – Alles eruit wat juridisch niet mag

- Geen enkele aanvraag meer naar een andere server: Google Fonts en de QR-bibliotheek staan op onze eigen server, YouTube-miniatuur weg, adres zoeken via onze server.
- Geen verzonnen beoordelingen (sterren bij Bedrijf, cijfers bij Apps) en geen Apple/Google-logo's buiten de officiële badges.
- Volledige uitleg en de checklist voor de lancering (privacyverklaring, verwerkersovereenkomst, voorwaarden, DSA-meldknop, bewaartermijn, Photon): zie **docs/juridisch.md**.

## 8 oktober 2026 – Lijst met links aantrekkelijker, met een man als voorbeeld

- Voorbeeld is nu **Chef Ruben** (recepten & kookworkshops in Rotterdam), want er stonden al veel vrouwen als voorbeeld.
- Nieuw ontwerp: kleurrijke omslag in de themakleuren, ronde profielfoto die over de omslag valt, grote naam, en de **eerste link als grote uitgelichte kaart** met beeld en pijl. De andere links als witte kaarten met een kleurig plaatje. Licht en vrolijk, en duidelijk anders dan de donkere Social media-pagina.

## 8 oktober 2026 – Andere voorbeeldnamen, Lijst met links anders dan Social media

- **Voorbeeldnamen:** "Studio Luna" kwam te vaak terug. Nu heeft elk type een eigen voorbeeld: Lijst met links = *Yoga met Mila*, Social media = *Surfschool Ola*, Instagram = *marco.fotografie* (Marco Ferrer), PDF = *Velo Fietsen*, Coupon = *Boekhandel Pagina*, WiFi = *Hotel-Zonneveld-Gast*. De rest bleef (Sanne de Vries, Bloom & Co, Bakkerij De Molen, Restaurant De Haven, FitPlan, De Ochtendshow).
- **Lijst met links** leek te veel op Social media. Nu het tegenovergestelde: licht en strak, links uitgelijnd (logo, grote titel, ondertitel), en de links in één witte lijst zoals de instellingen op een iPhone (letter-icoon, naam, domein, pijltje). Social media blijft donker met glas en een profiel in het midden.

## 8 oktober 2026 – Afbeeldingen en Social media opnieuw (te simpel/lelijk)

- **Afbeeldingen:** grote foto bovenaan over de hele breedte met de titel er wit overheen ("ALBUM", aantal foto's, datum), daaronder een strak 3-koloms raster zoals Instagram, en een glazen *Alles downloaden*-knop. Voorbeeldfoto's zijn zachte kleurvlakken (zoals een iPhone-achtergrond) in plaats van getekende landschapjes.
- **Social media:** donkere, chique pagina met gloed in de kleuren van het type, grote profielfoto met gekleurde ring, rij met snelle logo's en per kanaal een glazen kaart (logo, naam, @naam, pijltje).
- Foto's met een doorzichtige achtergrond worden in het album wit in plaats van zwart.

## 8 oktober 2026 – De echte pagina's: wat de bezoeker na het scannen ziet

- **Doorsturen** naar wat al bestaat: Website, Video (naar de videolink), WhatsApp, Facebook (naar de pagina), Instagram (naar het profiel). **Apps**: iPhone → App Store, Android → Google Play, computer → de pagina met beide knoppen. WiFi werkt zonder ons (de gegevens zitten in de code zelf).
- **Eigen pagina** voor PDF, Lijst met links, vCard, Bedrijf, Afbeeldingen, Social media, MP3, Menu, Apps (op de computer) en Coupon.
  - Gemaakt met **precies dezelfde sjablonen** als de telefoon in de tool (`server/live-page.js` + `public/js/live.js` + `public/css/live.css`). Wat de klant in de tool ziet, is dus echt wat de bezoeker krijgt. Eén ontwerp, twee plekken.
  - In de taal van de bezoeker (uit de browser, 10 talen), in de kleuren die de klant koos.
  - Nep-telefoondelen (statusbalk, terug-knoppen, *Gereed*) zijn weg; lege velden worden weggelaten in plaats van grijze balkjes.
  - **Alles werkt:** bellen, mailen, route (Google Maps), website openen, delen, contact opslaan (.vcf), PDF openen en downloaden, muziek afspelen en doorspoelen, foto's groot bekijken en downloaden, social links, app-winkels, kortingscode kopiëren.
- **PDF en MP3 worden nu echt opgeslagen** (max. 10 MB), zodat de bezoeker ze kan openen. Voor nu in de database; bij veel gebruik later naar bestandsopslag (bv. S3).
- Eerlijkheid: "linktree" uit de mockup gehaald (merknaam van een ander) en de knop *Voeg toe aan Apple Wallet* vervangen door *Code kopiëren*. Een echte Wallet-kaart kan later, maar vraagt een Apple-ontwikkelaarscertificaat.
- **Coupon:** de korting staat nu groot bovenaan de kaart.

## 8 oktober 2026 – Zeven mockups opnieuw: echte app-schermen

- Goed bevonden (zo laten): WhatsApp, MP3, WiFi, Video, Facebook, vCard, Instagram, Menu, Website. Wat ze gemeen hebben: het is een **echt scherm van een echte app**.
- Daarom de andere zeven ook zo gemaakt:
  - **PDF** → PDF-viewer zoals Voorvertoning op de iPhone (*Gereed*, bestandsnaam, volledig blad met kop in de themakleur, grafiek, "1 / 12", downloadknop).
  - **Lijst met links** → zoals Linktree (zachte kleurvlakken, grote knoppen met icoon, rij met snelknoppen).
  - **Bedrijf** → zoals een bedrijfskaart in Google Maps (grote foto, sterren, *Nu open*, ronde actieknoppen Route/Bellen/Website/Delen, kaartje met pin, openingstijden).
  - **Afbeeldingen** → album zoals de Foto's-app (twee kolommen met verschillende hoogtes, *Alles downloaden*).
  - **Social media** → profiel met een grote tegel per kanaal in de echte merkkleur, met *Volgen*.
  - **Apps** → zoals de App Store (icoon, *Download*, beoordeling/leeftijd/hitlijst, schermafbeeldingen, winkelknoppen).
  - **Coupon** → kaart in Apple Wallet met een echte, scanbare QR-code van de kortingscode en *Voeg toe aan Apple Wallet*.

## 8 oktober 2026 – Elk type zijn eigen kleuren

- Eerst kregen alle mockups het Optimasys-blauw. Nu heeft elk type een eigen kleurenpaar dat bij het thema past (`theme` in `shared/qr-types.js`), bv. PDF rood, Video rood/zwart, Menu oranje/groen, MP3 paars/roze, Coupon goud, vCard petrol, Lijst met links paars.
- Die kleuren gelden overal: het voorbeeld in stap 1, de kleuren in stap 2 en de pagina die de bezoeker ziet. Past de gebruiker ze aan, dan onthouden we dat per type.
- Het oude foto-voorbeeld van Afbeeldingen (met Optimasys-huisstijl) is vervangen door de nieuwe mockup in de eigen kleuren.

## 8 oktober 2026 – Alle 16 types hebben een echte telefoon-mockup en echte invulvelden

- Nieuwe mockups (zelfde stijl als WhatsApp/Bedrijf/vCard, lege velden = grijze balkjes, kleuren van de pagina):
  - **PDF:** documentpagina met voorbeeld van het blad, bestandsnaam en grootte, knoppen *Open PDF* en *Downloaden*.
  - **Video:** videopagina met speler (bij YouTube de echte miniatuur), titel, kanaal en beschrijving.
  - **Afbeeldingen:** fotogalerij met de eigen foto's en *Alles downloaden*.
  - **Facebook:** de pagina zoals in de app (omslag, profielfoto, Vind ik leuk / Bericht, tabbladen, bericht).
  - **Social media:** profiel met een knop per kanaal, met de echte logo's.
  - **MP3:** muziekspeler met albumhoes, tijdbalk en knoppen.
  - **Menu:** menukaart met omslagfoto en gerechten met prijs.
  - **Apps:** app-pagina met icoon, sterren en de echte App Store- en Google Play-knoppen.
  - **Coupon:** kortingsbon met groot percentage, code om te kopiëren en geldigheidsdatum.
- Nieuwe veldsoorten in stap Inhoud: **bestand** (PDF/audio), **foto's** (max. 6, automatisch verkleind), **gerechten** (naam + prijs, rij voor rij). De server controleert ze ook.
- Verplicht per type: PDF-bestand, videolink, minstens één foto, Facebook-link, minstens één social kanaal, audiobestand, restaurantnaam + gerecht, app-naam, coupontitel.
- Demo-keuze: van een PDF/MP3 bewaren we nu alleen naam en grootte; echt opslaan van het bestand komt bij de opslag-stap (nog te kiezen: eigen server of cloudopslag).

## 8 oktober 2026 – QR-assistent eruit, vijf kaarten met gewone titels

- **De QR-assistent (AI) is helemaal weg**, ook op de achtergrond (`shared/assistant.js`, `/api/assistant`, de teller van onbekende woorden). Hij staat nog in de Git-geschiedenis als we hem later terug willen.
- **Gewone titels, elk een eigen kaart, in volgorde van belangrijkheid:** Stijlen · Logo · Patroon en kleuren · Frame · Hoeken. Geen tabbladen meer binnen een kaart. Stijlen en Logo staan open, de rest dicht.
- Fout opgelost: in de online demo stond "dz.step.own" in beeld. De demo gebruikte oude vertaalbestanden; die worden nu altijd mee gepubliceerd.

## Ontwerpregel (geldt voor de hele tool)

- **Ook fijn voor mensen met dyslexie:** zo min mogelijk tekst, korte kopjes, grote tegels met plaatjes in plaats van woorden, alles gegroepeerd in kaarten die je kunt in- en uitklappen, en geen opties die op elkaar lijken.

## 8 oktober 2026 – Ontwerp in glazen kaarten, in- en uitklapbaar

- De nummers 1/2/3 zijn weg. Elk onderdeel (**Kies een stijl**, **Je logo**, **Zelf aanpassen**) is een eigen glazen kaart, zodat je ziet wat bij elkaar hoort.
- Elke kaart klapt in en uit. Geen samenvatting op de dichte kaart (je ziet je keuze al op de telefoon).
- De regel "Unieke code met eigen link" is weg uit deze stap: je ziet de link pas na het maken van de code.
- Standaard open: Stijl en Logo (belangrijkst). Zelf aanpassen staat dicht en gaat vanzelf open als je de assistent-knop "Andere tekst" gebruikt.

## 8 oktober 2026 – Simpeler: minder vormen, elk duidelijk anders; kleuren per onderdeel

- **Kleuren zoals eerst** (één kleurkiezer + "Gebruik mijn paginakleuren" + kleurverloop), zonder de rijen kant-en-klare kleuren en combinaties (te druk).
- **Nieuw in de kleurkiezer zelf:** kies welk onderdeel je kleurt: *Alles · Puntjes · Hoeken buiten · Hoeken binnen*. Zo maak je zelf een combinatie. In de dichte regel zie je de drie kleuren als bolletjes.
- **Patronen (9), van basic naar creatief:** vierkant, afgerond, rondjes, vloeiend, elegant, staafjes, ruitjes, sterren, hartjes. Patronen die op elkaar leken zijn weg.
- **Hoeken, naast elkaar zoals bij qr-code.io:** buitenkant 6 (vierkant, afgerond, cirkel, blad, achthoek, stippen) en binnenkant 6 (vierkant, afgerond, rondje, ruit, negen bolletjes, ster). Een hart als binnenkant scant niet en is daarom niet teruggekomen.
- Alle 94 combinaties zijn opnieuw getest met een scanner: ze scannen allemaal.

## 8 oktober 2026 – Veel meer keuze, maar netjes en zonder opvulling

- **Veel meer opties, allemaal netjes en scanbaar:**
  - *Patronen:* 16 (o.a. zacht vloeiend, grote rondjes, zachte blokjes, losse blokjes, kussentjes, achthoekjes, blaadjes, druppels, staafjes, streepjes).
  - *Hoeken buiten:* 13 (o.a. zacht vierkant, blad gespiegeld, druppel, punt naar buiten, één ronde hoek, schild, licht afgeschuind).
  - *Hoeken binnen:* 12 (o.a. kussen, negen rondjes, druppel, punt, schild).
  - *Frames:* 35, in groepen Basis · Vormen · Eten & drinken · Winkel · Feestdagen. Nieuw: rand onder/boven, blok, kaart, knop, onderstreept, pijltje, label opzij, tabblad, rond, dubbele rand, sticker en menukaart.
  - *Kleuren:* 22 kant-en-klare kleuren en 16 kleurcombinaties (code + hoeken) met één klik, plus "Jouw kleuren" (paginakleuren) en een eigen kleur.
- **Getest met een echte scanner** (ZXing, dezelfde techniek als veel Android-telefoons): alle 114 combinaties van patronen, hoeken, frames en stijlen scannen.
- **Minder opvulling:** geen voorbeeldzinnen onder de assistent, geen uitlegtekst bij het logo, geen label "Meer stijlen".
- **Logo:** de knop "Gebruik het Website-icoon" is weg. Verwijderen werkt nu altijd (duidelijke knop "Verwijderen"). PNG-logo's met een doorzichtige achtergrond blijven doorzichtig (eerst werd dat zwart).
- De assistent kent de nieuwe frames ("knop", "sticker", "menukaart", "rand") en negeert woorden die in de tekst tussen aanhalingstekens staan.

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
