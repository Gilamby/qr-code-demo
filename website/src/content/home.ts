/* Starttekst van de homepage per onderdeel (Engels, Nederlands, Spaans). Daarna aan te passen in /admin → Homepage.
   Regel: korte zinnen, meteen te begrijpen. Mensen lezen niet graag.
   Volgorde op de pagina: generator → waarom wij → de duik (wat gebeurt er als je scant) → toepassingen (verhaal)
   → zo werkt het (filmpje) → functies → prijzen → vragen + contact → afsluiter. Het menu bovenin springt naar dezelfde onderdelen. */
type Item = { key: string; title: string; text?: string }
type Section = { chapter?: string; eyebrow?: string; title?: string; text?: string; cta?: string; cta2?: string; note?: string; items?: Item[] }
const i = (key: string, title: string, text = ''): Item => ({ key, title, text })

export const HOME_VERSION = 7

export const HOME: Record<'en' | 'nl' | 'es', Record<string, Section>> = {
  en: {
    hero: { eyebrow: 'QR code generator for businesses', title: 'Make a QR code.\nChange it anytime.', text: 'Try it free below. Want to change it after printing? Use the app.', cta: 'Make a code you can change', cta2: 'Download', note: '1 free download. The app: 14 days free.',
      items: [
        i('website', 'Website', 'https://yourbusiness.com'), i('menu', 'Menu', 'https://yourbusiness.com/menu'), i('wifi', 'WiFi', 'Guest WiFi'),
        i('vcard', 'vCard', 'Lisa de Vries'), i('instagram', 'Instagram', 'yourbusiness'), i('whatsapp', 'WhatsApp', '+31 6 12345678'),
        i('pdf', 'PDF', 'https://yourbusiness.com/brochure.pdf'), i('video', 'Video', 'https://youtube.com/watch?v=…'),
        i('l:link', 'Link'), i('l:username', 'Username'), i('l:network', 'Network name'), i('l:password', 'Password'), i('l:name', 'Name'), i('l:phone', 'Phone'), i('l:email', 'Email'), i('l:company', 'Company'), i('l:message', 'Message'),
        i('l:shapes', 'Squares,Dots,Rounded,Diamonds'), i('l:color', 'Colour'), i('l:frame', 'Frame text'), i('l:frameDefault', 'SCAN ME'), i('l:logo', 'Logo'),
        i('l:lowContrast', 'Low contrast. Some phones can’t read this.'), i('l:static', 'This code can’t be changed later. In the app it can.'),
        i('l:download', 'Download'), i('l:limit', 'Free download used. Make an account for more.'), i('l:preview', 'Preview'), i('l:design', 'Design'), i('l:content', 'Content'),
      ] },
    trust: { eyebrow: 'Why us', title: 'No small print.',
      items: [
        i('watermark', 'No watermark', 'Never.'), i('ads', 'No ads', 'Only your page.'),
        i('scans', 'Unlimited scans', 'No limits.'), i('edit', 'Change after printing', 'Same code, new link.'),
        i('privacy', 'Privacy', 'No IP addresses. No tracking.'), i('languages', '19 languages', 'For you and your visitors.'),
      ] },
    dive: { eyebrow: 'What is a QR code?', title: 'What happens when you scan?', cta: 'Make one yourself', cta2: 'Skip', note: 'Drag to look around',
      items: [
        i('p1', 'QR codes are everywhere.', 'On tables, posters, boxes and cards.'),
        i('p2', 'A QR code is a pattern of squares.', 'That pattern holds a link.'),
        i('p3', 'You scan it…', '…and your phone opens that link.'),
        i('p4', 'You choose what it opens.', 'And you can change it anytime.'),
        i('website', 'Website', 'Any page you want.'),
        i('menu', 'Menu', 'Your menu on every table.'),
        i('video', 'Video', 'Plays right away.'),
        i('wifi', 'WiFi', 'Online without a password.'),
        i('social', 'Social media', 'All your channels in one place.'),
      ] },
    story: { eyebrow: 'Examples', title: 'Where do you use it?', text: 'Scroll down.', cta: 'Try 14 days free', cta2: 'Skip',
      items: [
        i('restaurant', 'Restaurant', 'Scan the table. See the menu.|Menu'), i('poster', 'Poster', 'Scan the poster. Buy tickets.|Website'),
        i('packaging', 'Packaging', 'Scan the box. Watch the how-to.|Video'), i('card', 'Business card', 'Scan the card. Save the contact.|vCard'),
        i('l:end', 'You see every scan.', 'Per code. So you know what works.'),
        i('l:scans', 'scans'), i('l:scan', 'Scanning…'), i('l:made', 'Made with QR-Codex'),
      ] },
    how: { eyebrow: 'How it works', title: 'Ready in 3 steps.', text: 'This is the app. No design skills needed.',
      items: [
        i('l:type', 'Type'), i('l:content', 'Content'), i('l:design', 'Design'), i('l:next', 'Continue'), i('l:save', 'Save'), i('l:done', 'Done! Your QR code is ready.'), i('l:link', 'Link to your menu'), i('l:codes', 'My QR codes'), i('l:scans', 'scans'), i('l:download', 'Download'), i('l:play', 'Play'), i('l:pause', 'Pause'),
        i('type', 'Pick a type', 'Website, menu, WiFi and more.'),
        i('content', 'Fill it in', 'For example your link.'),
        i('design', 'Make it yours', 'Your colours, your logo.'),
      ] },
    features: { eyebrow: 'Features', title: 'Everything in one place.', text: 'All your QR codes in one app.', cta: 'See how it works',
      items: [
        i('dynamic', 'Change anytime', 'New link, same printed code.'),
        i('design', 'Your design', 'Colours, shapes, logo, frame.'),
        i('stats', 'See your scans', 'Per day, place and device.'),
        i('folders', 'Stay organised', 'Folders, search and favourites.'),
        i('team', 'Work together', 'Invite your colleagues.'),
        i('formats', 'Print-ready', 'PNG, SVG, PDF and EPS.'),
      ] },
    pricing: { eyebrow: 'Pricing', title: 'Simple prices.', text: '14 days free. Cancel anytime.', cta: 'Compare all plans' },
    faq: { eyebrow: 'Questions', title: 'Questions', cta: 'All questions', cta2: 'Contact us', note: 'Something not working? We’ll help.' },
    final: { eyebrow: 'Get started', title: 'QR-Codex', text: 'Make your first code today.', cta: 'Try 14 days free', cta2: 'Log in', note: 'From €4.99 a month' },
  },

  nl: {
    hero: { eyebrow: 'QR-codegenerator voor bedrijven', title: 'Maak een QR-code.\nWijzig hem wanneer je wilt.', text: 'Probeer het hieronder gratis. Later wijzigen? Dat kan in de app.', cta: 'Maak een code die je kunt wijzigen', cta2: 'Downloaden', note: '1 gratis download. De app: 14 dagen gratis.',
      items: [
        i('website', 'Website', 'https://jouwbedrijf.nl'), i('menu', 'Menukaart', 'https://jouwbedrijf.nl/menu'), i('wifi', 'Wifi', 'Gasten-wifi'),
        i('vcard', 'vCard', 'Lisa de Vries'), i('instagram', 'Instagram', 'jouwbedrijf'), i('whatsapp', 'WhatsApp', '+31 6 12345678'),
        i('pdf', 'PDF', 'https://jouwbedrijf.nl/folder.pdf'), i('video', 'Video', 'https://youtube.com/watch?v=…'),
        i('l:link', 'Link'), i('l:username', 'Gebruikersnaam'), i('l:network', 'Netwerknaam'), i('l:password', 'Wachtwoord'), i('l:name', 'Naam'), i('l:phone', 'Telefoon'), i('l:email', 'E-mail'), i('l:company', 'Bedrijf'), i('l:message', 'Bericht'),
        i('l:shapes', 'Blokjes,Rondjes,Rond,Ruiten'), i('l:color', 'Kleur'), i('l:frame', 'Tekst in het frame'), i('l:frameDefault', 'SCAN MIJ'), i('l:logo', 'Logo'),
        i('l:lowContrast', 'Te weinig contrast. Sommige telefoons lezen dit niet.'), i('l:static', 'Deze code kun je later niet wijzigen. In de app wel.'),
        i('l:download', 'Downloaden'), i('l:limit', 'Gratis download gebruikt. Maak een account voor meer.'), i('l:preview', 'Voorbeeld'), i('l:design', 'Ontwerp'), i('l:content', 'Inhoud'),
      ] },
    trust: { eyebrow: 'Waarom wij', title: 'Geen kleine lettertjes.',
      items: [
        i('watermark', 'Geen watermerk', 'Nooit.'), i('ads', 'Geen reclame', 'Alleen jouw pagina.'),
        i('scans', 'Onbeperkt scans', 'Geen limiet.'), i('edit', 'Wijzigen na printen', 'Zelfde code, nieuwe link.'),
        i('privacy', 'Privacy', 'Geen IP-adressen. Geen tracking.'), i('languages', '19 talen', 'Voor jou en je bezoekers.'),
      ] },
    dive: { eyebrow: 'Wat is een QR-code?', title: 'Wat gebeurt er als je scant?', cta: 'Maak er zelf een', cta2: 'Overslaan', note: 'Sleep om rond te kijken',
      items: [
        i('p1', 'QR-codes zijn overal.', 'Op tafels, posters, dozen en kaartjes.'),
        i('p2', 'Een QR-code is een patroon van blokjes.', 'In dat patroon zit een link.'),
        i('p3', 'Je scant hem…', '…en je telefoon opent die link.'),
        i('p4', 'Jij kiest wat hij opent.', 'En je kunt het altijd wijzigen.'),
        i('website', 'Website', 'Elke pagina die je wilt.'),
        i('menu', 'Menukaart', 'Je menu op elke tafel.'),
        i('video', 'Video', 'Speelt meteen af.'),
        i('wifi', 'Wifi', 'Online zonder wachtwoord.'),
        i('social', 'Social media', 'Al je kanalen op één plek.'),
      ] },
    story: { eyebrow: 'Voorbeelden', title: 'Waar gebruik je het?', text: 'Scroll naar beneden.', cta: 'Probeer 14 dagen gratis', cta2: 'Overslaan',
      items: [
        i('restaurant', 'Restaurant', 'Scan de tafel. Zie de menukaart.|Menukaart'), i('poster', 'Poster', 'Scan de poster. Koop tickets.|Website'),
        i('packaging', 'Verpakking', 'Scan de doos. Bekijk de uitleg.|Video'), i('card', 'Visitekaartje', 'Scan het kaartje. Sla het contact op.|vCard'),
        i('l:end', 'Jij ziet elke scan.', 'Per code. Zo weet je wat werkt.'),
        i('l:scans', 'scans'), i('l:scan', 'Scannen…'), i('l:made', 'Gemaakt met QR-Codex'),
      ] },
    how: { eyebrow: 'Zo werkt het', title: 'Klaar in 3 stappen.', text: 'Dit is de app. Geen ontwerpkennis nodig.',
      items: [
        i('l:type', 'Soort'), i('l:content', 'Inhoud'), i('l:design', 'Ontwerp'), i('l:next', 'Verder'), i('l:save', 'Opslaan'), i('l:done', 'Klaar! Je QR-code staat klaar.'), i('l:link', 'Link naar je menukaart'), i('l:codes', 'Mijn QR-codes'), i('l:scans', 'scans'), i('l:download', 'Downloaden'), i('l:play', 'Afspelen'), i('l:pause', 'Pauze'),
        i('type', 'Kies een soort', 'Website, menukaart, wifi en meer.'),
        i('content', 'Vul het in', 'Bijvoorbeeld je link.'),
        i('design', 'Maak hem van jou', 'Jouw kleuren, jouw logo.'),
      ] },
    features: { eyebrow: 'Functies', title: 'Alles op één plek.', text: 'Al je QR-codes in één app.', cta: 'Bekijk hoe het werkt',
      items: [
        i('dynamic', 'Altijd wijzigen', 'Nieuwe link, zelfde geprinte code.'),
        i('design', 'Eigen ontwerp', 'Kleuren, vormen, logo, frame.'),
        i('stats', 'Zie je scans', 'Per dag, plaats en apparaat.'),
        i('folders', 'Overzichtelijk', 'Mappen, zoeken en favorieten.'),
        i('team', 'Samenwerken', 'Nodig je collega’s uit.'),
        i('formats', 'Klaar om te printen', 'PNG, SVG, PDF en EPS.'),
      ] },
    pricing: { eyebrow: 'Prijzen', title: 'Simpele prijzen.', text: '14 dagen gratis. Altijd opzegbaar.', cta: 'Vergelijk alle pakketten' },
    faq: { eyebrow: 'Vragen', title: 'Vragen', cta: 'Alle vragen', cta2: 'Neem contact op', note: 'Werkt er iets niet? Wij helpen je.' },
    final: { eyebrow: 'Begin vandaag', title: 'QR-Codex', text: 'Maak vandaag je eerste code.', cta: 'Probeer 14 dagen gratis', cta2: 'Inloggen', note: 'Vanaf €4,99 per maand' },
  },

  es: {
    hero: { eyebrow: 'Generador de códigos QR para empresas', title: 'Crea un código QR.\nCámbialo cuando quieras.', text: 'Pruébalo gratis aquí abajo. ¿Cambiarlo después? En la app.', cta: 'Crea un código que puedes cambiar', cta2: 'Descargar', note: '1 descarga gratis. La app: 14 días gratis.',
      items: [
        i('website', 'Sitio web', 'https://tuempresa.es'), i('menu', 'Menú', 'https://tuempresa.es/menu'), i('wifi', 'Wi-Fi', 'Wi-Fi invitados'),
        i('vcard', 'vCard', 'Lucía García'), i('instagram', 'Instagram', 'tuempresa'), i('whatsapp', 'WhatsApp', '+34 612 345 678'),
        i('pdf', 'PDF', 'https://tuempresa.es/folleto.pdf'), i('video', 'Vídeo', 'https://youtube.com/watch?v=…'),
        i('l:link', 'Enlace'), i('l:username', 'Usuario'), i('l:network', 'Nombre de la red'), i('l:password', 'Contraseña'), i('l:name', 'Nombre'), i('l:phone', 'Teléfono'), i('l:email', 'Correo'), i('l:company', 'Empresa'), i('l:message', 'Mensaje'),
        i('l:shapes', 'Cuadrados,Puntos,Redondeado,Rombos'), i('l:color', 'Color'), i('l:frame', 'Texto del marco'), i('l:frameDefault', 'ESCANÉAME'), i('l:logo', 'Logo'),
        i('l:lowContrast', 'Poco contraste. Algunos móviles no lo leen.'), i('l:static', 'Este código no se puede cambiar. En la app sí.'),
        i('l:download', 'Descargar'), i('l:limit', 'Descarga gratis usada. Crea una cuenta para más.'), i('l:preview', 'Vista previa'), i('l:design', 'Diseño'), i('l:content', 'Contenido'),
      ] },
    trust: { eyebrow: 'Por qué nosotros', title: 'Sin letra pequeña.',
      items: [
        i('watermark', 'Sin marca de agua', 'Nunca.'), i('ads', 'Sin anuncios', 'Solo tu página.'),
        i('scans', 'Escaneos ilimitados', 'Sin límites.'), i('edit', 'Cambia tras imprimir', 'Mismo código, nuevo enlace.'),
        i('privacy', 'Privacidad', 'Sin IP. Sin rastreo.'), i('languages', '19 idiomas', 'Para ti y tus visitantes.'),
      ] },
    dive: { eyebrow: '¿Qué es un código QR?', title: '¿Qué pasa cuando escaneas?', cta: 'Crea uno tú', cta2: 'Saltar', note: 'Arrastra para mirar',
      items: [
        i('p1', 'Los códigos QR están por todas partes.', 'En mesas, carteles, cajas y tarjetas.'),
        i('p2', 'Un código QR es un patrón de cuadrados.', 'Ese patrón guarda un enlace.'),
        i('p3', 'Lo escaneas…', '…y tu móvil abre ese enlace.'),
        i('p4', 'Tú eliges qué abre.', 'Y puedes cambiarlo cuando quieras.'),
        i('website', 'Sitio web', 'Cualquier página.'),
        i('menu', 'Menú', 'Tu carta en cada mesa.'),
        i('video', 'Vídeo', 'Se reproduce al instante.'),
        i('wifi', 'Wi-Fi', 'Conectados sin contraseña.'),
        i('social', 'Redes sociales', 'Todos tus canales juntos.'),
      ] },
    story: { eyebrow: 'Ejemplos', title: '¿Dónde lo usas?', text: 'Desplázate hacia abajo.', cta: 'Prueba 14 días gratis', cta2: 'Saltar',
      items: [
        i('restaurant', 'Restaurante', 'Escanea la mesa. Ve el menú.|Menú'), i('poster', 'Cartel', 'Escanea el cartel. Compra entradas.|Sitio web'),
        i('packaging', 'Envase', 'Escanea la caja. Mira el vídeo.|Vídeo'), i('card', 'Tarjeta de visita', 'Escanea la tarjeta. Guarda el contacto.|vCard'),
        i('l:end', 'Ves cada escaneo.', 'Por código. Así sabes qué funciona.'),
        i('l:scans', 'escaneos'), i('l:scan', 'Escaneando…'), i('l:made', 'Hecho con QR-Codex'),
      ] },
    how: { eyebrow: 'Cómo funciona', title: 'Listo en 3 pasos.', text: 'Esta es la app. Sin saber de diseño.',
      items: [
        i('l:type', 'Tipo'), i('l:content', 'Contenido'), i('l:design', 'Diseño'), i('l:next', 'Continuar'), i('l:save', 'Guardar'), i('l:done', '¡Listo! Tu código QR está preparado.'), i('l:link', 'Enlace a tu menú'), i('l:codes', 'Mis códigos QR'), i('l:scans', 'escaneos'), i('l:download', 'Descargar'), i('l:play', 'Reproducir'), i('l:pause', 'Pausa'),
        i('type', 'Elige un tipo', 'Web, menú, Wi-Fi y más.'),
        i('content', 'Rellénalo', 'Por ejemplo, tu enlace.'),
        i('design', 'Hazlo tuyo', 'Tus colores, tu logo.'),
      ] },
    features: { eyebrow: 'Funciones', title: 'Todo en un sitio.', text: 'Todos tus códigos QR en una app.', cta: 'Mira cómo funciona',
      items: [
        i('dynamic', 'Cambia cuando quieras', 'Nuevo enlace, mismo código impreso.'),
        i('design', 'Tu diseño', 'Colores, formas, logo, marco.'),
        i('stats', 'Ve tus escaneos', 'Por día, lugar y dispositivo.'),
        i('folders', 'Ordenado', 'Carpetas, búsqueda y favoritos.'),
        i('team', 'En equipo', 'Invita a tus compañeros.'),
        i('formats', 'Listo para imprimir', 'PNG, SVG, PDF y EPS.'),
      ] },
    pricing: { eyebrow: 'Precios', title: 'Precios simples.', text: '14 días gratis. Cancela cuando quieras.', cta: 'Compara todos los planes' },
    faq: { eyebrow: 'Preguntas', title: 'Preguntas', cta: 'Todas las preguntas', cta2: 'Contáctanos', note: '¿Algo no funciona? Te ayudamos.' },
    final: { eyebrow: 'Empieza hoy', title: 'QR-Codex', text: 'Crea hoy tu primer código.', cta: 'Prueba 14 días gratis', cta2: 'Iniciar sesión', note: 'Desde 4,99 € al mes' },
  },
}

/* Menu bovenin = de onderdelen van de homepage (zelfde namen, zelfde volgorde) */
export const NAV: Record<'en' | 'nl' | 'es', Record<string, string>> = {
  en: { why: 'Why us', offer: 'What we offer', generator: 'Generator', story: 'Examples', how: 'How it works', features: 'Features', solutions: 'Solutions', pricing: 'Pricing', faq: 'Questions', contact: 'Contact', login: 'Log in', tryFree: 'Try free', menu: 'Menu', close: 'Close' },
  nl: { why: 'Waarom wij', offer: 'Wat we bieden', generator: 'Generator', story: 'Voorbeelden', how: 'Zo werkt het', features: 'Functies', solutions: 'Oplossingen', pricing: 'Prijzen', faq: 'Vragen', contact: 'Contact', login: 'Inloggen', tryFree: 'Gratis proberen', menu: 'Menu', close: 'Sluiten' },
  es: { why: 'Por qué nosotros', offer: 'Qué ofrecemos', generator: 'Generador', story: 'Ejemplos', how: 'Cómo funciona', features: 'Funciones', solutions: 'Soluciones', pricing: 'Precios', faq: 'Preguntas', contact: 'Contacto', login: 'Iniciar sesión', tryFree: 'Prueba gratis', menu: 'Menú', close: 'Cerrar' },
}
