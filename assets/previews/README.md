# Foto's voor de telefoon-preview

Zet hier per QR-type een foto neer. De naam moet precies kloppen:

| Type         | Bestand          |
|--------------|------------------|
| Website      | `website.jpg`    |
| PDF          | `pdf.jpg`        |
| Lijst met links | `links.jpg`   |
| vCard        | `vcard.jpg`      |
| Bedrijf      | `business.jpg`   |
| Video        | `video.jpg`      |
| Afbeeldingen | `images.jpg`     |
| Facebook     | `facebook.jpg`   |
| Instagram    | `instagram.jpg`  |
| Social media | `social.jpg`     |
| WhatsApp     | `whatsapp.jpg`   |
| MP3          | `mp3.jpg`        |
| Menu         | `menu.jpg`       |
| Apps         | `apps.jpg`       |
| Coupon       | `coupon.jpg`     |
| WiFi         | `wifi.jpg`       |

- Formaat: liggend of vierkant, minstens **1200 × 900 px**, JPG.
- De foto komt bovenin de telefoon en loopt onderaan zacht over in het donker.
- Geen foto? Dan toont de preview gewoon het icoon. Er gaat niets stuk.
- Andere naam of map? Pas `previewImage` aan in `shared/qr-types.js`.

## Volledig scherm-ontwerp

Heb je een ontwerp van de hele telefoonpagina? Zet het in `public/assets/screens/<id>.jpg` en voeg `previewScreen: 'assets/screens/<id>.jpg'` toe aan het type in `shared/qr-types.js`. De telefoon toont dan dat ontwerp in plaats van het sjabloon (voorbeeld: `images`).
