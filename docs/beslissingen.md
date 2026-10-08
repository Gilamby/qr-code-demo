# Beslissingen

Wat we hebben besloten en waarom. Nieuwste bovenaan.

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
