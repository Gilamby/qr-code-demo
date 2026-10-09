# Statistieken: hoe het werkt

## Wat er bij een scan gebeurt

1. De bezoeker opent `/q/<id>`.
2. De server bepaalt:
   - **systeem**: iOS, Android, Windows, macOS, ChromeOS, Linux of overig (alleen de soort, uit de browsergegevens);
   - **land en stad**: opgezocht in een eigen database op de server (DB-IP Lite). Het IP-adres gaat nergens heen en wordt niet bewaard;
   - **uniek**: een dagcode `HMAC(geheim van vandaag, IP + browser + code)`. Het geheim staat alleen in het geheugen en verdwijnt bij een nieuwe dag (en bij een herstart); de dagcodes worden dan gewist. Geen cookies.
3. Opgeslagen wordt alleen een teller per code per dag: `stats["2026-10-09"]["iOS|NL|Amsterdam"] = [scans, uniek]`.

## Overzicht

- `GET /api/analytics?from=2026-09-10&to=2026-10-09&codes=id1,id2&os=iOS&cc=NL&city=NL|Amsterdam` geeft totalen, een reeks per dag, verdelingen per systeem/land/stad/code en de filteropties.
- `GET /api/analytics.csv?...` geeft dezelfde selectie als CSV (één regel per dag × code × systeem × land × stad).
- De berekening staat in `shared/analytics-core.js` en wordt ook door de online demo gebruikt (met duidelijk gemarkeerde voorbeeldcijfers).
- "Unieke scans" over meerdere dagen = de som van de unieke bezoekers per dag.

## Land/stad-database bijwerken (maandelijks)

- Download "IP to City Lite" (MMDB) van https://db-ip.com/db/download/ip-to-city-lite en zet hem op `server/data/geo/dbip-city-lite.mmdb` (of geef het pad op met `GEO_DB`). Herstart de server.
- Zonder bestand gebruikt de server het npm-pakket `@ip-location-db/dbip-city-mmdb` (optioneel, wordt niet meer bijgewerkt). Zonder beide: land en stad "Onbekend", de rest werkt gewoon.
- Licentie CC BY 4.0: op elke pagina die de gegevens toont moet een link naar DB-IP staan. Dat staat onderaan Statistieken ("IP-geolocatie door DB-IP").

## Achter een proxy

Het echte IP-adres komt uit `X-Forwarded-For`. Standaard alleen vertrouwd vanaf dezelfde machine (`TRUST_PROXY=loopback`). Bij hosting achter een andere proxy: `TRUST_PROXY` instellen (zie de Express-documentatie over "trust proxy").
